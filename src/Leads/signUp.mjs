import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { DB_DOC_CLIENT, headers } from "../Utils/constants.mjs";
import { INDEX_NAMES, TABLE_NAMES } from "../Utils/tableNames.mjs";
import { v4 as uuidv4 } from "uuid";
import { generateTokensAndReturnMultiValueHeaders } from "../Utils/multiValueHeaders.mjs";
import { recipients, sendEmail } from "../Form/sendEmail.mjs";

export const signUp = async (
  phoneNumber,
  name,
  organization,
  email,
  role,
  hiddenText
) => {
  try {
    //check if user already exists in the db with phone number

    const isUserExisted = await checkUserExists(phoneNumber);
    if (isUserExisted && isUserExisted.id) {
      //update the existing user details

      const params = setDynamicParams(
        name,
        email,
        organization,
        role,
        hiddenText,
        isUserExisted
      );

      const { multiValueHeaders } = generateTokensAndReturnMultiValueHeaders(
        isUserExisted.id,
        phoneNumber
      );

      if (!isUserExisted) await DB_DOC_CLIENT.send(new PutCommand(params));
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "User details updated successfully" }),
        headers,
        multiValueHeaders,
      };
    } else {
      const params = {
        TableName: TABLE_NAMES.B2B_SMF_LEADS_TABLE,
        Item: {
          id: uuidv4(),
          phoneNumber,
          name,
          organization,
          email,
          role,
          hiddenText,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      const { multiValueHeaders } = generateTokensAndReturnMultiValueHeaders(
        params.Item.id,
        phoneNumber
      );

      await DB_DOC_CLIENT.send(new PutCommand(params));
      const userData = {
        name,
        organization,
        phoneNumber,
        role,
        createdOn: params.Item.createdAt,
        emailId: email,
      };
      await sendEmail(userData, recipients);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Sign up successful" }),
        headers,
        multiValueHeaders,
      };
    }
  } catch (error) {
    console.error("Error in signUp:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error" }),
      headers,
    };
  }
};

const checkUserExists = async (phoneNumber) => {
  try {
    const params = {
      TableName: TABLE_NAMES.B2B_SMF_LEADS_TABLE,
      IndexName: INDEX_NAMES.PHONE_NUMBER_INDEX,
      KeyConditionExpression: "phoneNumber = :phoneNumber",
      ExpressionAttributeValues: {
        ":phoneNumber": phoneNumber,
      },
    };

    const response = await DB_DOC_CLIENT.send(new QueryCommand(params));
    if (response && response.Items.length > 0) {
      return response.Items[0];
    }
  } catch (error) {
    console.error("Error checking user existence:", error);
    return null;
  }
};

export const setDynamicParams = (
  name,
  email,
  organization,
  role,
  hiddenText,
  isUserExisted
) => {
  let updateExpression = "SET updatedAt = :updatedAt";
  let expressionAttributeValues = {
    ":updatedAt": new Date().toISOString(),
  };

  const expressionAttributeNames = {};

  if (isNotEmpty(name)) {
    updateExpression += ", #name = :name";
    expressionAttributeNames["#name"] = "name";
    expressionAttributeValues[":name"] = name;
  }

  if (isNotEmpty(organization)) {
    updateExpression += ", organization = :organization";
    expressionAttributeValues[":organization"] = organization;
  }

  if (isNotEmpty(email)) {
    updateExpression += ", email = :email";
    expressionAttributeValues[":email"] = email;
  }

  if (isNotEmpty(role)) {
    updateExpression += ", role = :role";
    expressionAttributeValues[":role"] = role;
  }

  if (isNotEmpty(hiddenText)) {
    updateExpression += ", hiddenText = :hiddenText";
    expressionAttributeValues[":hiddenText"] = hiddenText;
  }

  const params = {
    TableName: TABLE_NAMES.B2B_SMF_LEADS_TABLE,
    Key: { id: isUserExisted.id },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionAttributeValues,
    ...(Object.keys(expressionAttributeNames).length > 0 && {
      ExpressionAttributeNames: expressionAttributeNames,
    }),
  };

  return params;
};

const isNotEmpty = (value) =>
  value !== undefined && value !== null && value !== "";

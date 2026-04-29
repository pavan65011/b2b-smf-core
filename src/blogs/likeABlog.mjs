import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { TABLE_NAMES} from "../Utils/tableNames.mjs";
import { headers } from "../Utils/constants.mjs";
import { generateHashId } from "../Utils/helper.mjs";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
  try {
    const { blogUrl } = event.pathParameters;
    const { action } = JSON.parse(event.body) || {};

    if (!blogUrl || !action || !["like", "unlike"].includes(action)) {
      return {
        headers,
        statusCode: 400,
        body: JSON.stringify({
          message: "Invalid request. 'blogId' and 'action' are required.",
        }),
      };
    }

    const blogId = generateHashId(blogUrl);

    const val = action === "like" ? 1 : -1;
    const updateParams = {
      TableName: TABLE_NAMES.BLOGS_TABLE,
      Key: { id: blogId },
      UpdateExpression: "ADD #likesAttr :inc",
      ExpressionAttributeNames: {
        "#likesAttr": "likes",
      },
      ExpressionAttributeValues: {
        ":inc": val,
      },
      ReturnValues: "UPDATED_NEW",
    };

    const command = new UpdateCommand(updateParams);
    const response = await docClient.send(command);

    return {
      headers,
      statusCode: 200,
      body: JSON.stringify({
        message: "Success",
        updatedLikes: response.Attributes.likes,
      }),
    };
  } catch (error) {
    console.error(error);
    return {
      headers,
      statusCode: 500,
      body: JSON.stringify({
        message: "Error processing request",
        error: error.message,
      }),
    };
  }
};

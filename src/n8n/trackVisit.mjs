import crypto from "crypto";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { TABLE_NAMES } from "../Utils/tableNames.mjs";
import { DB_DOC_CLIENT, hashToken } from "../Utils/constants.mjs";

/* ---------- Handler ---------- */
export const handler = async (event) => {
  try {
    const { token, sig } = JSON.parse(event.body || "{}");
    console.log("Received tracking token:", token);

    //  Security gate
    if (!token || sig !== process.env.INTERNAL_API_SECRET) {
      return success(); // silently ignore
    }
    const id = hashToken(token);

    await DB_DOC_CLIENT.send(
      new UpdateCommand({
        TableName: TABLE_NAMES.LEAD_LINK_VISITS_TABLE,
        Key: { id },
        UpdateExpression: "SET visited = :true, visitedAt = :now",
        ConditionExpression: "attribute_exists(id) AND visited = :false",
        ExpressionAttributeValues: {
          ":true": true,
          ":false": false,
          ":now": new Date().toISOString(),
        },
      }),
    );

    return success();
  } catch (err) {
    // ConditionalCheckFailedException = already visited (OK)
    return success();
  }
};

function success() {
  return {
    statusCode: 200,
    body: JSON.stringify({ success: true }),
  };
}

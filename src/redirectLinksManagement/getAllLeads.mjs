import { DB_DOC_CLIENT, redirectLinksHeaders } from "../Utils/constants.mjs";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { TABLE_NAMES } from "../Utils/tableNames.mjs";

export const handler = async () => {
  try {
    let items = [];
    let ExclusiveStartKey;

    /* ---------- SCAN ALL RECORDS ---------- */
    do {
      const res = await DB_DOC_CLIENT.send(
        new ScanCommand({
          TableName: TABLE_NAMES.LEAD_LINK_VISITS_TABLE,
          ExclusiveStartKey,
        }),
      );

      items = items.concat(res.Items || []);
      ExclusiveStartKey = res.LastEvaluatedKey;
    } while (ExclusiveStartKey);

    /* ---------- SORT (by createdAt DESC) ---------- */
    items.sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return {
      statusCode: 200,
      headers: redirectLinksHeaders,
      body: JSON.stringify({
        success: true,
        count: items.length,
        data: items,
      }),
    };
  } catch (err) {
    console.error("Fetch error:", err);

    return {
      statusCode: 500,
      headers: redirectLinksHeaders,
      body: JSON.stringify({
        success: false,
        message: err.message,
      }),
    };
  }
};

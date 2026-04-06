import crypto from "crypto";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { DB_DOC_CLIENT, hashToken } from "../Utils/constants.mjs";
import { PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { TABLE_NAMES } from "../Utils/tableNames.mjs";
import csv from "csv-parser";
import { Parser } from "json2csv";

/* ---------- CONFIG ---------- */
const ALGO = "aes-256-gcm";

const TRACKING_SECRET = crypto
  .createHash("sha256")
  .update(process.env.TRACKING_TOKEN_SECRET)
  .digest();

const s3 = new S3Client({});
const BUCKET = "ai-chatbot-media";

const isValidString = (val) => {
  if (!val) return false;

  const cleaned = val.trim().toLowerCase();

  return (
    cleaned !== "" &&
    cleaned !== "null" &&
    cleaned !== "undefined" &&
    cleaned !== "n/a"
  );
};

/* ---------- Encrypt ---------- */
function encrypt(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, TRACKING_SECRET, iv);

  let encrypted = cipher.update(JSON.stringify(payload), "utf8", "hex");
  encrypted += cipher.final("hex");

  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}.${tag.toString("hex")}.${encrypted}`;
}

/* ---------- STREAM → JSON ---------- */
async function parseCsv(stream) {
  return new Promise((resolve, reject) => {
    const results = [];

    stream
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", reject);
  });
}

/* ---------- FIND EXISTING RECORD ---------- */
async function findExistingRecord(email, phoneNumber) {
  const cleanEmail = email?.trim();
  const cleanPhone = phoneNumber?.trim();

  /* ---------- EMAIL CHECK ---------- */
  if (isValidString(cleanEmail)) {
    const res = await DB_DOC_CLIENT.send(
      new QueryCommand({
        TableName: TABLE_NAMES.LEAD_LINK_VISITS_TABLE,
        IndexName: "EmailIndex",
        KeyConditionExpression: "email = :email",
        ExpressionAttributeValues: {
          ":email": cleanEmail,
        },
        Limit: 1,
      }),
    );

    if (res.Items?.length) return res.Items[0];
  }

  /* ---------- PHONE CHECK ---------- */
  if (isValidString(cleanPhone)) {
    const res = await DB_DOC_CLIENT.send(
      new QueryCommand({
        TableName: TABLE_NAMES.LEAD_LINK_VISITS_TABLE,
        IndexName: "PhoneIndex",
        KeyConditionExpression: "phoneNumber = :phone",
        ExpressionAttributeValues: {
          ":phone": cleanPhone,
        },
        Limit: 1,
      }),
    );

    if (res.Items?.length) return res.Items[0];
  }

  return null;
}

/* ---------- HANDLER ---------- */
export const handler = async (event) => {
  try {
    /* ---- Body ---- */
    const { key } = JSON.parse(event.body || "{}");

    if (!key) {
      return response(400, {
        success: false,
        message: "S3 key is required",
      });
    }

    /* ---- Get CSV ---- */
    const file = await s3.send(
      new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
      }),
    );

    const rows = await parseCsv(file.Body);

    const processedRows = [];
    const dbPromises = [];

    /* ---- Process Rows ---- */
    for (const row of rows) {
      const rawEmail = row.email;
      const rawPhone = row.phoneNumber;

      const email = isValidString(rawEmail) ? rawEmail.trim() : null;
      const phoneNumber = isValidString(rawPhone) ? rawPhone.trim() : null;

      if (!email && !phoneNumber) continue;

      const existing = await findExistingRecord(email, phoneNumber);

      let url;
      let trackingToken;
      let tokenHash;

      if (existing) {
        /* ---------- EXISTING ---------- */
        url = existing.url;
        trackingToken = existing.token;
        tokenHash = existing.id;

        // Update missing phoneNumber
        if (!existing.phoneNumber && phoneNumber) {
          dbPromises.push(
            DB_DOC_CLIENT.send(
              new UpdateCommand({
                TableName: TABLE_NAMES.LEAD_LINK_VISITS_TABLE,
                Key: { id: existing.id },
                UpdateExpression: "SET phoneNumber = :phone",
                ExpressionAttributeValues: {
                  ":phone": phoneNumber,
                },
              }),
            ),
          );
        }

        // Update missing email
        if (!existing.email && email) {
          dbPromises.push(
            DB_DOC_CLIENT.send(
              new UpdateCommand({
                TableName: TABLE_NAMES.LEAD_LINK_VISITS_TABLE,
                Key: { id: existing.id },
                UpdateExpression: "SET email = :email",
                ExpressionAttributeValues: {
                  ":email": email,
                },
              }),
            ),
          );
        }
      } else {
        /* ---------- NEW ---------- */
        const payload = email ? { email } : { phoneNumber };

        trackingToken = encrypt(payload);
        tokenHash = hashToken(trackingToken);

          url = `https://b2b.showmyflat.com?token=${trackingToken}`;
          
          const item = {
            id: tokenHash,
            visited: false,
            token: trackingToken,
            url,
            generatedBy: email ? "email" : "phoneNumber",
            createdAt: new Date().toISOString(),
          };

          // Only add if present
          if (email) item.email = email;
          if (phoneNumber) item.phoneNumber = phoneNumber;


        dbPromises.push(
          DB_DOC_CLIENT.send(
            new PutCommand({
              TableName: TABLE_NAMES.LEAD_LINK_VISITS_TABLE,
              Item: item,
              ConditionExpression: "attribute_not_exists(id)",
            }),
          ),
        );
      }

      /* ---------- OUTPUT ROW ---------- */
      processedRows.push({
        ...row,
        redirectLink: url,
      });
    }

    /* ---- Execute DB Ops ---- */
    await Promise.all(dbPromises);

    /* ---- Convert to CSV ---- */
    const parser = new Parser();
    const newCsv = parser.parse(processedRows);

    /* ---- Upload New CSV ---- */
    const outputKey = `processed/${Date.now()}-output.csv`;

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: outputKey,
        Body: newCsv,
        ContentType: "text/csv",
      }),
    );

    const fileUrl = `https://${BUCKET}.s3.amazonaws.com/${outputKey}`;

    /* ---- Response ---- */
    return response(200, {
      success: true,
      message: "CSV processed successfully",
      data: {
        fileUrl,
        totalProcessed: processedRows.length,
      },
    });
  } catch (err) {
    console.error("process-csv error:", err);

    return response(500, {
      success: false,
      message: err.message,
    });
  }
};

/* ---------- RESPONSE ---------- */
function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "allow-origin": "*",
    },
    body: JSON.stringify(body),
  };
}

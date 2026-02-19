import jwt from "jsonwebtoken";
import crypto from "crypto";
import { DB_DOC_CLIENT, hashToken } from "../Utils/constants.mjs";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { TABLE_NAMES } from "../Utils/tableNames.mjs";

/* ---------- CONFIG ---------- */
const ALGO = "aes-256-gcm";
const MAX_EMAILS_PER_REQUEST = 25;

const TRACKING_SECRET = crypto
  .createHash("sha256")
  .update(process.env.TRACKING_TOKEN_SECRET)
  .digest();

/* ---------- JWT VERIFY ---------- */
function verifyJWT(authHeader) {
  if (!authHeader) throw new Error("Missing Authorization header");

  const token = authHeader.split(" ")[1];
  if (!token) throw new Error("Invalid Authorization header");

  return jwt.verify(token, process.env.INTERNAL_JWT_SECRET);
}

/* ---------- ENCRYPT ---------- */
function encrypt(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, TRACKING_SECRET, iv);

  let encrypted = cipher.update(JSON.stringify(payload), "utf8", "hex");
  encrypted += cipher.final("hex");

  const tag = cipher.getAuthTag();

  return `${iv.toString("hex")}.${tag.toString("hex")}.${encrypted}`;
}

/* ---------- HANDLER ---------- */
export const handler = async (event) => {
  try {
    /* ---- Auth ---- */
    const decoded = verifyJWT(event.headers?.Authorization);

    if (decoded.type !== "internal-service") {
      return response(403, {
        success: false,
        message: "Forbidden",
      });
    }

    /* ---- Payload ---- */
    const { emails } = JSON.parse(event.body || "{}");

    if (!Array.isArray(emails) || emails.length === 0) {
      return response(400, {
        success: false,
        message: "Emails array is required",
      });
    }

    if (emails.length > MAX_EMAILS_PER_REQUEST) {
      return response(400, {
        success: false,
        message: `Maximum ${MAX_EMAILS_PER_REQUEST} emails allowed per request`,
      });
    }

    /* ---- Process Emails ---- */
    const results = [];

    for (const email of emails) {
      if (!email) continue;

      const payload = { email };

      const trackingToken = encrypt(payload);
      const tokenHash = hashToken(trackingToken);

      await DB_DOC_CLIENT.send(
        new PutCommand({
          TableName: TABLE_NAMES.LEAD_LINK_VISITS_TABLE,
          Item: {
            id: tokenHash, // PK
            email,
            visited: false,
            token: trackingToken, // stored for reference/debug
            createdAt: new Date().toISOString(),
          },
          ConditionExpression: "attribute_not_exists(id)",
        }),
      );

      results.push({
        email,
        url: `https://b2b.showmyflat.com?token=${trackingToken}`,
      });
    }

    /* ---- Response ---- */
    return response(200, {
      success: true,
      message: "Redirect URLs generated successfully",
      data: results,
    });
  } catch (err) {
    return response(401, {
      success: false,
      message: err.message || "Unauthorized",
    });
  }
};

/* ---------- RESPONSE HELPER ---------- */
function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

import jwt from "jsonwebtoken";
import crypto from "crypto";
import { DB_DOC_CLIENT, hashToken } from "../Utils/constants.mjs";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { TABLE_NAMES } from "../Utils/tableNames.mjs";

const ALGO = "aes-256-gcm";
// const TRACKING_SECRET = Buffer.from(process.env.TRACKING_TOKEN_SECRET, "hex");
const TRACKING_SECRET = crypto
  .createHash("sha256")
  .update(process.env.TRACKING_TOKEN_SECRET)
  .digest();

/* ---------- JWT Verify ---------- */
function verifyJWT(authHeader) {
  if (!authHeader) throw new Error("Missing auth header");

  const token = authHeader.split(" ")[1];
  if (!token) throw new Error("Invalid auth header");
  console.log("Received JWT:", token);

  return jwt.verify(token, process.env.INTERNAL_JWT_SECRET);
}

/* ---------- Encrypt ---------- */
function encrypt(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, TRACKING_SECRET, iv);

  let encrypted = cipher.update(JSON.stringify(payload), "utf8", "hex");
  encrypted += cipher.final("hex");

  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}.${tag.toString("hex")}.${encrypted}`;
}

/* ---------- Handler ---------- */
export const handler = async (event) => {
  try {
    const decoded = verifyJWT(event.headers?.Authorization);

    if (decoded.type !== "internal-service") {
      return response(403, {
        success: false,
        message: "Forbidden",
      });
    }

    const { email } = JSON.parse(event.body || "{}");
    if (!email) {
      return response(400, {
        success: false,
        message: "Email required",
      });
    }

    const payload = {
      email,
      //   iat: Date.now(),
      //   exp: Date.now() + 24 * 60 * 60 * 1000,
    };

      const trackingToken = encrypt(payload);
      const tokenHash = hashToken(trackingToken);
      
      await DB_DOC_CLIENT.send(
        new PutCommand({
          TableName: TABLE_NAMES.LEAD_LINK_VISITS_TABLE,
          Item: {
            id: tokenHash, // PRIMARY KEY
            email,
            visited: false,
            createdAt: new Date().toISOString(),   
          },
          ConditionExpression: "attribute_not_exists(id)", // safety
        }),
      );

    return response(200, {
      success: true,
      // url: `https://b2b.showmyflat.com?token=${trackingToken}`,
      message: "Redirect URL generated successfully",
      data: {
        url: `https://b2b.showmyflat.com?token=${trackingToken}`,
      },
    });
  } catch (err) {
    return response(401, {
      success: false,
      message: err.message,
    });
  }
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

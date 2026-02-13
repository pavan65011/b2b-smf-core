import crypto from "crypto";

/* ================== CONFIG ================== */

const ALGO = "aes-256-gcm";
// const SECRET_KEY = Buffer.from(process.env.TRACKING_TOKEN_SECRET, "hex");
const SECRET_KEY = crypto
  .createHash("sha256")
  .update(process.env.TRACKING_TOKEN_SECRET)
  .digest();

/* ================== DECRYPT ================== */

function decryptTrackingToken(token) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token format");
  }

  const [ivHex, tagHex, encrypted] = parts;

  const decipher = crypto.createDecipheriv(
    ALGO,
    SECRET_KEY,
    Buffer.from(ivHex, "hex"),
  );

  decipher.setAuthTag(Buffer.from(tagHex, "hex"));

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return JSON.parse(decrypted);
}

/* ================== HANDLER ================== */

export const handler = async (event) => {
  const token = event.queryStringParameters?.token;

  if (!token) {
    return htmlResponse(200, "<h1>Welcome to ShowMyFlat B2B</h1>");
  }

  try {
    const payload = decryptTrackingToken(token);

    console.log("Decrypted payload:", payload);

    // 📝 Save visit log
    // await saveVisitLog({
    //   email: payload.email,
    //   ip: event.requestContext?.http?.sourceIp,
    //   userAgent: event.headers?.["user-agent"],
    //   visitedAt: new Date().toISOString(),
    // });

    return htmlResponse(200, "<h1>Welcome to ShowMyFlat B2B</h1>");
  } catch (err) {
    console.error("Token decrypt error:", err.message);

    // Do NOT expose error to user
    return htmlResponse(200, "<h1>Welcome to ShowMyFlat B2B</h1>");
  }
};

/* ================== DB LOG (Stub) ================== */

async function saveVisitLog(log) {
  // Replace with DynamoDB / RDS / Firehose
  console.log("VISIT LOG:", log);
}

/* ================== RESPONSE ================== */

function htmlResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "text/html",
      "Cache-Control": "no-store",
    },
    body,
  };
}

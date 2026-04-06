import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

const s3 = new S3Client({ });

const BUCKET_NAME = "ai-chatbot-media";
const URL_EXPIRY = 60 * 5; // 5 minutes

export const handler = async (event) => {
  try {
    /* ---------- Parse Body ---------- */
    const body = JSON.parse(event.body || "{}");
    const { fileName, contentType } = body;

    /* ---------- Validations ---------- */
    if (!fileName) {
      return response(400, "fileName is required");
    }

    // Optional strict validation
    if (!fileName.endsWith(".csv")) {
      return response(400, "Only CSV files are allowed");
    }

    /* ---------- Generate Unique File Key ---------- */
    const uniqueId = crypto.randomUUID();

    const key = `uploads/${uniqueId}-${fileName}`;

    /* ---------- Create S3 Command ---------- */
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType || "text/csv",
    });

    /* ---------- Generate Presigned URL ---------- */
    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: URL_EXPIRY,
    });

    /* ---------- Public File URL ---------- */
    const fileUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;

    /* ---------- Response ---------- */
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Presigned URL generated",
        data: {
          uploadUrl,
          fileUrl,
          key,
          expiresIn: URL_EXPIRY,
        },
      }),
    };
  } catch (err) {
    console.error("Error generating presigned URL:", err);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: err.message || "Internal server error",
      }),
    };
  }
};

/* ---------- RESPONSE HELPER ---------- */
function response(statusCode, message) {
  return {
      statusCode,
      headers: {
          "Content-Type": "application/json",
          "allow-origin": "*",
      },
    body: JSON.stringify({
      success: false,
      message,
    }),
  };
}

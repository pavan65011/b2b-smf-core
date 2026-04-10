import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { headers, redirectLinksHeaders } from "../Utils/constants.mjs";

const s3 = new S3Client({ region: "ap-south-1" });

const BUCKET_NAME = "b2b-smf-redirect-links-management";

export const handler = async (event) => {
  try {
    // You can pass folder via query param ?folder=xyz/
    const folder = "uploads/";

    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: folder, // folder path
    });

    const response = await s3.send(command);

    const files = (response.Contents || []).map((item) => ({
      key: item.Key,
      url: `https://${BUCKET_NAME}.s3.amazonaws.com/${item.Key}`,
      size: item.Size,
      lastModified: item.LastModified,
    }));

    return {
      statusCode: 200,
      headers: redirectLinksHeaders,
      body: JSON.stringify({
        message: "Files fetched successfully",
        count: files.length,
        files,
      }),
    };
  } catch (error) {
    console.error("Error:", error);

    return {
      statusCode: 500,
      headers: redirectLinksHeaders,
      body: JSON.stringify({
        message: "Error fetching files",
        error: error.message,
      }),
    };
  }
};

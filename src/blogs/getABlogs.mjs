import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import {  TABLE_NAMES } from "../Utils/tableNames.mjs";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { UpdateCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { generateHashId } from "../Utils/helper.mjs";
import { headers } from "../Utils/constants.mjs";
const bucket = process.env.AWS_BUCKET_NAME_MEDIA;
const s3Client = new S3Client({
  region: process.env.AWS_REGION_SHOW_FLAT,
});
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
// Helper function to stream the S3 file data
const streamToString = (stream) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  }
);
const incrementNumberOfViews = async(blogUrl)=>{
  try {
    const blogId = generateHashId(blogUrl);
    
    const updateParams = {
      TableName: TABLE_NAMES.BLOGS_TABLE,
      Key: { id: blogId }, 
      UpdateExpression: "ADD #viewsAttr :inc",
      ExpressionAttributeNames: {
        "#viewsAttr": "views", 
      },
      ExpressionAttributeValues: {
        ":inc": 1, 
      },
    };
    const command = new UpdateCommand(updateParams);
    const result = await docClient.send(command);
    return 1 ;
  } catch (error) {
    console.error(error);
    return 0 ;
  }
}
export const handler = async (event) => {
  try {
    const { blogUrl } = event.pathParameters;

    if (!blogUrl) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing blogUrl parameter" }),
      };
    }

    const s3Key = `blogs/${blogUrl}.html`;
    const getParams = {
      Bucket: bucket,
      Key: s3Key,
    };

    // Retrieve the HTML file from S3
    const getObjectCommand = new GetObjectCommand(getParams);
    const s3Response = await s3Client.send(getObjectCommand);

    // Convert the file stream to string
    const htmlContent = await streamToString(s3Response.Body);
    await incrementNumberOfViews(blogUrl);
    return {
      statusCode: 200,
      headers: {
        ...headers,
        "Content-Type": "text/html", // Ensure the content type is set to HTML
      },
      body: htmlContent,
    };
  } catch (error) {
    console.error("Error loading HTML from S3:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Error loading blog content", error }),
    };
  }
};
    
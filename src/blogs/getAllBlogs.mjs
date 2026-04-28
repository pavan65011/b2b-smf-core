import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import {  TABLE_NAMES } from "../Utils/tableNames.mjs";
import { headers } from "../Utils/constants.mjs";

const s3Client = new S3Client({
  region: process.env.AWS_REGION_SHOW_FLAT,
});

const bucket = process.env.AWS_BUCKET_NAME_MEDIA;
const cloudfrontUrl = process.env.AWS_CLOUDFRONT_URL;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const getAllMediaUrls = async (url) => {
  const imagePrefix = `blogs/media/${url}`;
  const imageCommand = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: imagePrefix,
  });
  const response = await s3Client.send(imageCommand);
  const imageUrls = response.Contents.map((item) => {
    return `${cloudfrontUrl}/${item.Key}`;
  });

  return imageUrls[0];
};
export const handler = async (event, context) => {
  const params = {
    TableName: TABLE_NAMES.BLOGS_TABLE,
  };

  try {
    const { admin } = event.queryStringParameters || {};

    const command = new ScanCommand(params);
    const data = await docClient.send(command);
    const dataIncludedWithMediaURLS = await Promise.all(
      data.Items.map(async (blog) => {
        const urls = await getAllMediaUrls(blog.blogUrl);
        return {
          // id: id,
          title: blog.title,
          blogUrl: blog.blogUrl,
          // content: s3Url,
          timeToRead: blog.timeToRead,
          views: blog.views,
          likes: blog.likes,
          tags: blog.tags,
          isActive: blog.isActive,
          timeStamp: blog.timeStamp,
          brief: blog.brief,
          imgUrl: urls,
        };
      }),
    );

    if (admin && admin === "true") {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: "succesfully retrieved latest blogs",
          data: dataIncludedWithMediaURLS,
        }),
      };
    }
    const activeBlogs = dataIncludedWithMediaURLS.filter(
      (blog) => blog.isActive,
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: "succesfully retrieved latest blogs",
        data: activeBlogs,
      }),
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Error fetching blogs", error }),
    };
  }
};

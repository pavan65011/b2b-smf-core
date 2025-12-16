import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { setDynamicParams } from "../Leads/signUp.mjs";
import { DB_DOC_CLIENT } from "../Utils/constants.mjs";
import { verifyUserFromCookies } from "../Utils/verifyUser.mjs";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({ region: "ap-south-1" });

export const handler = async (event) => {
  try {
    const { name, organization, email, role, hiddenText } = JSON.parse(
      event.body
    );
    const user = await verifyUserFromCookies(event.headers);
    if (!user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          message: "Unauthorized: Invalid or missing access token",
        }),
      };
    }

    const params = setDynamicParams(
      name,
      email,
      organization,
      role,
      hiddenText
    );

    await DB_DOC_CLIENT.send(new PutCommand(params));

    const url = await generatePdfUrl(
      "b2b-smf-media",
      "ShowMyFlat - Real Estate Marketing Lead Leakage Report.pdf"
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        downloadUrl: url,
      }),
    };
  } catch (error) {
    console.error("Error updating user profile:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};

export const generatePdfUrl = async (bucketName, objectKey) => {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
  });

  // 5 minutes = 300 seconds
  const signedUrl = await getSignedUrl(s3, command, {
    expiresIn: 300,
  });

  return signedUrl;
};

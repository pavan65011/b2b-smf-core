import { formDataSchema } from "../zod/form.mjs";
import { ZodError } from "zod";
import { ZodErrorHandler } from "../zod/zodHelper.mjs";
import { DB_DOC_CLIENT, headers } from "../Utils/constants.mjs";
import { TABLE_NAMES } from "../Utils/tableNames.mjs";
import nodemailer from "nodemailer";
import { GetCommand } from "@aws-sdk/lib-dynamodb";

const recipients = [
  { name: "Vishal", email: "vishal@dzynkraft.ai" },
  { name: "Kranti", email: "kranti@dzynkraft.ai" },
  { name: "pavan", email: "pavan@dzynkraft.ai" },
  { name: "Shailendra", email: "sthakur@dzynkraft.ai" },
];

export const handler = async (event) => {
  try {
    const { name, organization, phoneNumber, role } = formDataSchema.parse(
      JSON.parse(event.body)
    );
    // Process the validated data (e.g., send an email)
    const createdOn = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
    });
    const userData = { name, organization, phoneNumber, role, createdOn };
    await sendEmail(userData, recipients);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Email sent successfully" }),
      headers,
    };
  } catch (error) {
    console.error("Error parsing form data:", error);
    if (error instanceof ZodError) {
      return await ZodErrorHandler(error);
    }
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error" }),
      headers,
    };
  }
};

const sendEmailToRecipient = async (
  transporter,
  mailOptions,
  recipient,
  retryCount = 0
) => {
  try {
    const customMailOptions = {
      ...mailOptions,
      to: recipient.email,
    };

    const info = await transporter.sendMail(customMailOptions);
    console.log(`Message sent to ${recipient.email}:`, info.messageId);
    return true;
  } catch (error) {
    console.error(`Error sending email to ${recipient.email}:`, error);

    if (retryCount < 3) {
      console.log(`Retrying... (${retryCount + 1})`);
      return sendEmailToRecipient(
        transporter,
        mailOptions,
        recipient,
        retryCount + 1
      );
    }

    console.log(`Failed after multiple attempts for ${recipient.email}`);
    return false;
  }
};

const sendEmail = async (data, recipients) => {
  const { name, phoneNumber, createdOn, organization, role } = data;

  const masterUserData = await getMasterUserData();
  if (!masterUserData) {
    return { message: "Failed to send email: Master user data not found." };
  }

  const { email, password } = masterUserData;
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: email,
      pass: password,
    },
  });
  try {
    await transporter.verify();
    console.log("SMTP connection verified successfully");
  } catch (error) {
    console.error("SMTP connection verification failed:", error);
    throw new Error("Failed to establish SMTP connection");
  }

  let mailOptions = {
    from: '"Team ShowMyFlat" <support@dzynkraft.ai>',
    subject: "[B2B ShowMyFla] A new B2B lead has submitted interest!",
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
          }

          .container {

            padding: 20px;
            background-color: #fff;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
          }
          .header {
            text-align: center;
            padding: 10px;
          }
          .header img {
            max-width: 100px;
            height: auto;
            border-radius: 50%;
          }
          .content {
              display: flex;
              flex-direction: column;
            text-align: start;
            margin: 20px 0;
        
          }

          .footer {
            text-align: center;
            font-size: 0.9em;
            color: #777;
            font-family: Sans-Serif;
          }

            .content h1{
              margin: 0px;
              font-size: 24px;
              font-weight: ;
              color: #00000;
              font-family: Sans-Serif;
              margin-bottom: 10px;
              font-weight: 500;
          }
          .content p{
              margin: 0px;
              line-height: 1.5;
              font-family: Sans-Serif;
          }
          .tags{
              color: #ff5a5f;
              font-weight: bold;
              font-family: Sans-Serif;
          }
        </style>
      </head>
      <body>
        <div class="container">
            <div>
          <div class="content">
            <h1>Yippee! A new lead has registered in ShowMyFlat. Here are the details:</h1>
            <p><span class="tags">Name:-</span> ${name}</p>
            <p></p><span class="tags">Organization:-</span> ${organization}</p>
            <p><span class="tags">Phone Number:-</span><a href=tel:+${phoneNumber}> +${phoneNumber}</a></p>
            <p><span class="tags">Role:-</span> ${role ? role : "N/A"}</p>
            <p><span class="tags">Time Visited:-</span> ${createdOn}</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Showmyflat. All rights reserved.</p>
          </div>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  const results = await Promise.all(
    recipients.map((recipient) =>
      sendEmailToRecipient(transporter, mailOptions, recipient)
    )
  );
  const successCount = results.filter(Boolean).length;
  console.log(
    `Successfully sent ${successCount} out of ${recipients.length} emails`
  );

  if (successCount === 0) {
    throw new Error("Failed to send any emails");
  }
};

const getMasterUserData = async () => {
  try {
    const params = {
      TableName: TABLE_NAMES.MFAI_MASTER_USERS_TABLE,
      Key: {
        email: "support@dzynkraft.ai",
      },
    };
    const result = await DB_DOC_CLIENT.send(new GetCommand(params));
    return result.Item;
  } catch (error) {
    console.error("Error fetching master user data:", error);
    return null;
  }
};

import { headers } from "../Utils/constants.mjs";
import { encryptPhoneNumber, sendOtp } from "../Utils/otpHelpers.mjs";

export const handler = async (event) => {
  try {
    const { phoneNumber } = JSON.parse(event.body);
    console.log("Received phone number:", phoneNumber);

    if (!phoneNumber) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Phone number is required" }),
        headers,
      };
    }

    //check if phonenumber starts with + or not, if not add +
    const formattedPhoneNumber = phoneNumber.startsWith("+")
      ? phoneNumber
      : `+${phoneNumber}`;
    const verificationId = await sendOtp(formattedPhoneNumber);

    const { encryptedData, iv: encryptedIv } = encryptPhoneNumber(phoneNumber);
    return {
      statusCode: 200,
      body: JSON.stringify({
        verificationId,
        otpNumberData: encryptedData,
        otpNumberVerifyId: encryptedIv,
      }),
      headers,
    };
  } catch (error) {
    console.error("Error in sendOtp handler:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error" }),
      headers,
    };
  }
};

import { signUp } from "../Leads/signUp.mjs";
import { headers } from "../Utils/constants.mjs";
import { decryptPhoneNumber, verifyOtp } from "../Utils/otpHelpers.mjs";

const attemptCounts = {}; // This should be replaced with a persistent storage in production
const allowedAttempts = 5; //number of allowed attempts for otp

export const handler = async (event) => {
  try {
    const {
      otp,
      verificationId,
      otpNumberData,
      otpNumberVerifyId,
      name,
      organization,
      email,
      role,
      hiddenText,
    } = JSON.parse(event.body);
    if (!otp || !verificationId || !otpNumberData || !otpNumberVerifyId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing required fields" }),
        headers,
      };
    }

    if (!attemptCounts[verificationId]) {
      attemptCounts[verificationId] = 0;
    }
    if (attemptCounts[verificationId] >= allowedAttempts) {
      return {
        statusCode: 205, // Too Many Requests
        headers,
        body: JSON.stringify({
          message: "Maximum number of attempts exceeded",
        }),
      };
    }

    const result = await verifyOtp(verificationId, otp);

    let phoneNumber = decryptPhoneNumber(otpNumberData, otpNumberVerifyId);
    phoneNumber = phoneNumber && phoneNumber.replace("+", "");

    if (result.statusCode === 200) {
      attemptCounts[verificationId] = 0;

      const otpVerified = true;
      const response = await signUp(
        phoneNumber,
        name,
        organization,
        email,
        role,
        hiddenText,
        otpVerified
      );
      return {
        statusCode: response.statusCode,
        body: response.body,
        headers,
        multiValueHeaders: response.multiValueHeaders,
      };
    } else {
      attemptCounts[verificationId] += 1;
    }

    console.log("OTP verification result:", result);
    return {
      statusCode: result.statusCode,
      body: result.body,
      headers,
    };
  } catch (error) {
    console.error("Error in verifyOtp handler:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error" }),
      headers,
    };
  }
};

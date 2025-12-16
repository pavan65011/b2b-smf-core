import crypto from "crypto";
import axios from "axios";

export const sendOtp = async (phoneNumber) => {
  const APP_ID = process.env.APP_ID;
  const APP_SECRET = process.env.APP_SECRET;
  const url = `https://exoverify.exotel.com/v2/accounts/dzynkraft2/verifications/sms`;

  const authString = Buffer.from(`${APP_ID}:${APP_SECRET}`).toString("base64");

  try {
    const { data } = await axios.post(
      url,
      {
        application_id: APP_ID,
        phone_number: phoneNumber,
      },
      {
        headers: {
          Authorization: `Basic ${authString}`,
          "Content-Type": "application/json",
        },
      }
    );
    const { response } = data;
    const verification_id = response.data.verification_id; // sending back the verification id for verifying the OTP
    return verification_id;
  } catch (error) {
    console.error("Error sending OTP:", error.response?.data || error.message);
    throw error;
  }
};

export const verifyOtp = async (verification_id, OTP) => {
  const APP_ID = process.env.APP_ID;
  const APP_SECRET = process.env.APP_SECRET;
  const url = `https://exoverify.exotel.com/v2/accounts/dzynkraft2/verifications/sms/${verification_id}`;

  // Set up the authorization header
  const authString = Buffer.from(`${APP_ID}:${APP_SECRET}`).toString("base64");

  try {
    const { data } = await axios.post(
      url,
      { otp: OTP },
      {
        headers: {
          Authorization: `Basic ${authString}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Check for success
    if (data.http_code === 200) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "OTP verified successfully" }),
      };
    }
  } catch (error) {
    const response = error.response?.data.response || {};
    console.log("response", response);

    // Handle different error cases based on the error code
    switch (response.error_data?.code) {
      case 1017:
        // Verification already done
        return {
          statusCode: 201,
          body: JSON.stringify({ message: "OTP already verified" }),
        };
      case 1210:
        // OTP expired
        return {
          statusCode: 202,
          body: JSON.stringify({ message: "OTP expired" }),
        };
      case 1211:
        // OTP invalid
        return {
          statusCode: 203,
          body: JSON.stringify({ message: "Invalid OTP" }),
        };
      case 1016:
        // OTP attempts already exceeded the limit
        return {
          statusCode: 204,
          body: JSON.stringify({ message: "Number of attempts exceeded" }),
        };
      default:
        console.error(
          "Error Verifying OTP:",
          error.response?.data || error.message
        );
        return {
          statusCode: 500,
          body: JSON.stringify({ message: "Network Error" }),
        };
    }
  }
};

// AES-256-CBC encryption parameters
const algorithm = "aes-256-cbc";
const secretKey =
  process.env.SECRET_KEY ||
  "e805b7a3f543b60c07ded9e86c323dc654352d75b8718fd7ab96bcf755450d7d"; // Set this key as an environment variable (32 bytes)
const ivLength = 16; // IV length for AES-256-CBC (16 bytes)

export function encryptPhoneNumber(phoneNumber) {
  const iv = crypto.randomBytes(ivLength); // Generate random IV
  const cipher = crypto.createCipheriv(
    algorithm,
    Buffer.from(secretKey, "hex"),
    iv
  );
  let encrypted = cipher.update(phoneNumber, "utf8", "hex");
  encrypted += cipher.final("hex");
  return { encryptedData: encrypted, iv: iv.toString("hex") };
}

// Decrypt function with error handling
export function decryptPhoneNumber(encryptedData, iv) {
  try {
    const decipher = crypto.createDecipheriv(
      algorithm,
      Buffer.from(secretKey, "hex"),
      Buffer.from(iv, "hex")
    );
    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    console.error("Decryption failed:", error.message);
    throw new Error("Failed to decrypt phone number");
  }
}

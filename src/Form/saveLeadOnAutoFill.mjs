import { signUp } from "../Leads/signUp.mjs";
import { headers } from "../Utils/constants.mjs";

export const handler = async (event) => {
  try {
    const { phoneNumber, name, organization, email, role, hiddenText } =
      JSON.parse(event.body);

    if (!phoneNumber) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Phone number is required" }),
        headers,
      };
    }

    const otpVerified = false;
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
    };
  } catch (error) {
    console.error("Error in saveLeadOnAutoFill handler:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error" }),
      headers,
    };
  }
};

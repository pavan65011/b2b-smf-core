import { headers } from "../Utils/constants.mjs";

export const ZodErrorHandler = async (error) => {
  if (error.message) {
    const errorMessages = JSON.parse(error.message);

    const formattedErrors = errorMessages.map((e) => ({
      path: e.path.join("."),
      message: e.message,
    }));

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: formattedErrors,
      }),
      headers,
    };
  }
  // In case error message is not in the expected format, return a generic error
  return {
    statusCode: 500,
    body: JSON.stringify({
      message: "Internal Server Error: Invalid error format",
    }),
    headers,
  };
};

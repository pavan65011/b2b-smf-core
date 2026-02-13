import jwt from "jsonwebtoken";

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const { clientId, clientSecret } = body;

    if (
      clientId !== process.env.INTERNAL_CLIENT_ID ||
      clientSecret !== process.env.INTERNAL_CLIENT_SECRET
    ) {
      return response(401, { message: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        type: "internal-service",
        service: clientId,
      },
      process.env.INTERNAL_JWT_SECRET,
      { expiresIn: "30d" },
    );

    return response(200, { token });
  } catch (err) {
    return response(500, { message: "Auth error" });
  }
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

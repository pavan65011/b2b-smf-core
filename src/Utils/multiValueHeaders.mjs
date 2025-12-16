import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET_KEY;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET_KEY;

export const generateTokensAndReturnMultiValueHeaders = (
  userId,
  phoneNumber
) => {
  const accessToken = jwt.sign({ id: userId, phoneNumber }, JWT_SECRET, {
    expiresIn: "5m",
  });
  const refreshToken = jwt.sign(
    { id: userId, phoneNumber },
    JWT_REFRESH_SECRET,
    {
      expiresIn: "5m",
    }
  );

  const multiValueHeaders = {
    "Set-Cookie": [
      `sh5dz$sl=${accessToken}; Max-Age=300; Path=/; HttpOnly; Secure; SameSite=None`,
      `cr8dz$ll=${refreshToken}; Max-Age=300; Path=/; HttpOnly; Secure; SameSite=None`,
    ],
  };

  return { refreshToken, multiValueHeaders };
};

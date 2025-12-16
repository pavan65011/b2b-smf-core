import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { DB_DOC_CLIENT } from "./constants.mjs";
import { TABLE_NAMES } from "./tableNames.mjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET_KEY;

export const parseCookies = (cookieHeader) => {
  const cookies = {};
  if (cookieHeader) {
    cookieHeader.split(";").forEach((cookie) => {
      const [name, ...rest] = cookie.split("=");
      cookies[name.trim()] = rest.join("=").trim();
    });
  }
  return cookies;
};

export function verifyToken(token, secret) {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    console.error("Error decoding access token:", error);
    return {
      statusCode: 401,
      body: JSON.stringify({ message: "Unauthorized" }),
    };
  }
}

export async function getUserById(userId) {
  const params = {
    TableName: TABLE_NAMES.B2B_SMF_LEADS_TABLE,
    Key: {
      id: userId,
    },
  };

  const result = await DB_DOC_CLIENT.send(new GetCommand(params));
  return result.Item;
}

export const verifyUserFromCookies = async (headers) => {
  const cookies = parseCookies(headers.Cookie || headers.cookie);
  console.log("cookies", cookies);
  const accessToken = cookies.sh5dz$sl;

  if (!accessToken) {
    return null;
  }
  const decodedToken = verifyToken(accessToken, JWT_SECRET);
  if (decodedToken.statusCode === 401) {
    return null;
    throw new Error("Unauthorized");
  }

  const userId = decodedToken.id;

  console.log("userId verify", userId);
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  return user;
};

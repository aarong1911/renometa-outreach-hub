// netlify/functions/googleOAuthStart.js

const { requireUser } = require("./_lib/auth");
const { oauthClient, signState } = require("./_lib/googleOAuth");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "GET") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  try {
    const user = await requireUser(event);

    const returnTo = event.queryStringParameters?.returnTo || process.env.APP_BASE_URL || "/";
    const state = signState({
      uid: user.uid,
      returnTo,
      exp: Date.now() + 10 * 60 * 1000, // 10 min
    });

    const client = oauthClient();
    const url = client.generateAuthUrl({
      access_type: "offline", // required for refresh_token
      prompt: "consent",      // ensures refresh_token on first connect
      scope: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
      state,
    });

    return { statusCode: 200, headers, body: JSON.stringify({ url }) };
  } catch (error) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: error.message }) };
  }
};

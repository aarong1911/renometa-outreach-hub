// netlify/functions/googleConnectionStatus.js

const { requireUser } = require("./_lib/auth");
const { getTokensForUser } = require("./_lib/googleOAuth");

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
    const tokens = await getTokensForUser(user.uid);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ connected: !!(tokens?.refresh_token || tokens?.access_token) }),
    };
  } catch (e) {
    return { statusCode: 200, headers, body: JSON.stringify({ connected: false }) };
  }
};

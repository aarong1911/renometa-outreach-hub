// netlify/functions/googleOAuthCallback.js

const { oauthClient, verifyState, saveTokensForUser } = require("./_lib/googleOAuth");

exports.handler = async (event) => {
  try {
    const code = event.queryStringParameters?.code;
    const state = event.queryStringParameters?.state;

    if (!code || !state) {
      return { statusCode: 400, body: "Missing code/state" };
    }

    const payload = verifyState(state);
    const client = oauthClient();

    const { tokens } = await client.getToken(code);

    // IMPORTANT: only save refresh_token when provided
    await saveTokensForUser(payload.uid, tokens);

    const redirectTo = payload.returnTo || process.env.APP_BASE_URL || "/";
    return {
      statusCode: 302,
      headers: { Location: `${redirectTo}?google=connected` },
      body: "",
    };
  } catch (error) {
    const fallback = process.env.APP_BASE_URL || "/";
    return {
      statusCode: 302,
      headers: { Location: `${fallback}?google=error` },
      body: "",
    };
  }
};

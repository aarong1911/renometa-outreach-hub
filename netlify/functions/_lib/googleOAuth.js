// netlify/functions/_lib/googleOAuth.js

const crypto = require("crypto");
const { google } = require("googleapis");
const { getDb } = require("./firebaseAdmin");

const TOKEN_COLLECTION = "google_tokens"; // Firestore collection

function oauthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_OAUTH_REDIRECT_URI) {
    throw new Error("Missing GOOGLE oauth env vars");
  }
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI);
}

function signState(payload) {
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret) throw new Error("Missing OAUTH_STATE_SECRET");

  const json = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", secret).update(json).digest("hex");
  return Buffer.from(JSON.stringify({ json, sig })).toString("base64url");
}

function verifyState(stateB64) {
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret) throw new Error("Missing OAUTH_STATE_SECRET");

  const decoded = JSON.parse(Buffer.from(stateB64, "base64url").toString("utf8"));
  const { json, sig } = decoded;

  const expected = crypto.createHmac("sha256", secret).update(json).digest("hex");
  if (expected !== sig) throw new Error("Invalid OAuth state signature");

  const payload = JSON.parse(json);
  if (payload.exp && Date.now() > payload.exp) throw new Error("OAuth state expired");

  return payload;
}

// ✅ Robust extractor: accepts ID or almost any Google Sheets URL format
function extractSpreadsheetId(input) {
  if (!input) return null;
  const raw = String(input).trim();

  // If user pasted just the ID
  if (/^[a-zA-Z0-9-_]{20,}$/.test(raw) && !raw.includes("/") && !raw.includes("?")) {
    return raw;
  }

  // Try URL parsing
  try {
    const u = new URL(raw);

    // Common query params
    const idParam = u.searchParams.get("id");
    if (idParam && /^[a-zA-Z0-9-_]{20,}$/.test(idParam)) return idParam;

    const keyParam = u.searchParams.get("key");
    if (keyParam && /^[a-zA-Z0-9-_]{20,}$/.test(keyParam)) return keyParam;

    const path = u.pathname || "";

    // Standard
    let m = path.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (m?.[1]) return m[1];

    // /u/0/d/<id>
    m = path.match(/\/spreadsheets\/u\/\d+\/d\/([a-zA-Z0-9-_]+)/);
    if (m?.[1]) return m[1];

    // Sometimes /d/<id>
    m = path.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (m?.[1]) return m[1];
  } catch {
    // Not a URL, continue to regex extraction
  }

  // Regex fallback
  let m = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m?.[1]) return m[1];

  m = raw.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  if (m?.[1]) return m[1];

  // Catch any long file-like token
  m = raw.match(/([a-zA-Z0-9-_]{25,})/);
  if (m?.[1]) return m[1];

  return null;
}

async function saveTokensForUser(uid, tokens) {
  const db = getDb();
  await db.collection(TOKEN_COLLECTION).doc(uid).set(
    {
      provider: "google",
      access_token: tokens.access_token || null,
      refresh_token: tokens.refresh_token || null,
      scope: tokens.scope || null,
      token_type: tokens.token_type || null,
      expiry_date: tokens.expiry_date || null,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

async function getTokensForUser(uid) {
  const db = getDb();
  const snap = await db.collection(TOKEN_COLLECTION).doc(uid).get();
  if (!snap.exists) return null;
  return snap.data();
}

async function getSheetsClientForUser(uid) {
  const tokens = await getTokensForUser(uid);
  if (!tokens) throw new Error("Google not connected");

  const client = oauthClient();
  client.setCredentials({
    access_token: tokens.access_token || undefined,
    refresh_token: tokens.refresh_token || undefined,
    expiry_date: tokens.expiry_date || undefined,
  });

  // googleapis auto-refreshes access_token if refresh_token exists
  return google.sheets({ version: "v4", auth: client });
}

module.exports = {
  oauthClient,
  signState,
  verifyState,
  extractSpreadsheetId,
  saveTokensForUser,
  getTokensForUser,
  getSheetsClientForUser,
};

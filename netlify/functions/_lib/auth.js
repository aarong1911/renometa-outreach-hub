// netlify/functions/_lib/auth.js
const { getAdmin } = require("./firebaseAdmin");

async function requireUser(event) {
  const authHeader =
    event.headers.authorization || event.headers.Authorization || "";

  const m = authHeader.match(/^Bearer (.+)$/);
  if (!m) {
    const err = new Error("Missing Authorization Bearer token");
    err.statusCode = 401;
    throw err;
  }

  const idToken = m[1];
  const admin = getAdmin();
  const decoded = await admin.auth().verifyIdToken(idToken);

  return { uid: decoded.uid, email: decoded.email || "" };
}

module.exports = { requireUser };

// netlify/functions/_lib/firebaseAdmin.js
const admin = require("firebase-admin");

function normalizePrivateKey(raw) {
  let key = String(raw || "");

  // If someone pasted the key with surrounding quotes, remove them
  // (this happens a LOT when copying from JSON or CI UI)
  key = key.replace(/^"|"$/g, "");
  key = key.replace(/^'|'$/g, "");

  // Convert escaped newlines into real newlines
  key = key.replace(/\\n/g, "\n");

  // Normalize Windows newlines (just in case)
  key = key.replace(/\r\n/g, "\n");

  return key;
}

function getAdmin() {
  if (admin.apps.length) return admin;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new Error(
      "Missing Firebase env vars. Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY"
    );
  }

  const privateKey = normalizePrivateKey(privateKeyRaw);

  // Optional: super quick sanity check (safe to leave in)
  if (!privateKey.includes("BEGIN PRIVATE KEY") || !privateKey.includes("END PRIVATE KEY")) {
    throw new Error("FIREBASE_PRIVATE_KEY does not look like a valid PEM private key");
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });

  return admin;
}

module.exports = { getAdmin };

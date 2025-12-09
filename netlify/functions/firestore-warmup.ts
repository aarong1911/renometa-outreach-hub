// netlify/functions/firestore-warmup.ts
import type { Handler } from "@netlify/functions";
import admin from "firebase-admin";

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  throw new Error("FIREBASE_SERVICE_ACCOUNT env var is missing");
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

// Initialize Firebase Admin only once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    }),
  });
}

const db = admin.firestore();

export const handler: Handler = async (event) => {
  try {
    // Simple API key protection
    const expectedKey = process.env.INTERNAL_API_KEY;
    const providedKey =
      event.headers["x-api-key"] || event.headers["X-Api-Key"];

    if (!expectedKey || providedKey !== expectedKey) {
      return {
        statusCode: 401,
        body: "Unauthorized",
      };
    }

    // For now: just list documents in a collection
    const collectionPath =
      event.queryStringParameters?.collectionPath || "warmupAccounts";

    const snap = await db.collection(collectionPath).get();
    const documents = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documents }),
    };
  } catch (err: any) {
    console.error("firestore-warmup error", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err.message ?? "Unknown error",
      }),
    };
  }
};

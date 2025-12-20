// netlify/functions/updateLeadList.js
const Airtable = require("airtable");
const { requireUser } = require("./_lib/auth");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  try {
    const user = await requireUser(event);
    const { listId, name } = JSON.parse(event.body || "{}");

    if (!listId) return { statusCode: 400, headers, body: JSON.stringify({ error: "listId is required" }) };
    if (!name || !String(name).trim()) return { statusCode: 400, headers, body: JSON.stringify({ error: "name is required" }) };

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    // Optional safety: verify ownership
    const list = await base("LeadLists").find(listId);
    if ((list.fields.userId || "") !== user.uid) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden" }) };
    }

    const updated = await base("LeadLists").update([{ id: listId, fields: { name: String(name).trim() } }]);

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, list: { id: listId, name: updated[0].fields.name } }) };
  } catch (error) {
    console.error("updateLeadList error:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to update list", details: error.message }) };
  }
};

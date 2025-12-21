// netlify/functions/deleteDomain.js
const Airtable = require("airtable");
const { requireUser } = require("./_lib/auth");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const user = await requireUser(event);
    const { domainId } = JSON.parse(event.body || "{}");

    if (!domainId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "domainId required" }) };
    }

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    // Verify ownership
    const domain = await base("Domains").find(domainId);
    if (domain.fields.userId !== user.uid) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden" }) };
    }

    // Check if domain is in use
    if (domain.fields.accountsUsing > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Cannot delete domain in use",
          details: `${domain.fields.accountsUsing} email accounts are using this domain`,
        }),
      };
    }

    await base("Domains").destroy(domainId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, id: domainId }),
    };
  } catch (error) {
    console.error("deleteDomain error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to delete domain", details: error.message }),
    };
  }
};
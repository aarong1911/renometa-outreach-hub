// netlify/functions/getCampaignEvents.js
const Airtable = require("airtable");
const { requireUser } = require("./_lib/auth");

function escapeFormulaString(value) {
  return String(value || "").replace(/'/g, "\\'");
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const user = await requireUser(event);
    const { campaignId, leadId, eventType, limit } = event.queryStringParameters || {};

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    // Build filter formula
    const filters = [`{userId} = '${escapeFormulaString(user.uid)}'`];
    
    if (campaignId) {
      filters.push(`ARRAYJOIN({campaignId}) = '${escapeFormulaString(campaignId)}'`);
    }
    if (leadId) {
      filters.push(`ARRAYJOIN({leadId}) = '${escapeFormulaString(leadId)}'`);
    }
    if (eventType) {
      filters.push(`{eventType} = '${escapeFormulaString(eventType)}'`);
    }

    const filterByFormula = filters.length > 1 ? `AND(${filters.join(", ")})` : filters[0];

    const records = await base("CampaignEvents")
      .select({
        filterByFormula,
        sort: [{ field: "timestamp", direction: "desc" }],
        maxRecords: limit ? Number(limit) : 100,
      })
      .all();

    const events = records.map((r) => ({
      id: r.id,
      campaignId: r.fields.campaignId,
      leadId: r.fields.leadId,
      stepId: r.fields.stepId,
      accountId: r.fields.accountId,
      eventType: r.fields.eventType || "",
      timestamp: r.fields.timestamp || "",
      errorMessage: r.fields.errorMessage || "",
      metadata: r.fields.metadata || "",
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ events }),
    };
  } catch (error) {
    console.error("getCampaignEvents error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to fetch campaign events", details: error.message }),
    };
  }
};
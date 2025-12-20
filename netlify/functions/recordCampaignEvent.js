// netlify/functions/recordCampaignEvent.js
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
    const { campaignId, leadId, stepId, accountId, eventType, errorMessage, metadata } = JSON.parse(
      event.body || "{}"
    );

    if (!campaignId || !leadId || !eventType) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "campaignId, leadId, and eventType are required" }),
      };
    }

    const validEventTypes = ["sent", "delivered", "bounced", "opened", "clicked", "replied", "error"];
    if (!validEventTypes.includes(eventType)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `eventType must be one of: ${validEventTypes.join(", ")}` }),
      };
    }

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    const record = await base("CampaignEvents").create(
      {
        campaignId: [campaignId],
        leadId: [leadId],
        ...(stepId ? { stepId: [stepId] } : {}),
        ...(accountId ? { accountId: [accountId] } : {}),
        eventType,
        userId: user.uid,
        ...(errorMessage ? { errorMessage: String(errorMessage) } : {}),
        ...(metadata ? { metadata: JSON.stringify(metadata) } : {}),
      },
      { typecast: true }
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        event: {
          id: record.id,
          campaignId: record.fields.campaignId,
          leadId: record.fields.leadId,
          stepId: record.fields.stepId,
          accountId: record.fields.accountId,
          eventType: record.fields.eventType,
          timestamp: record.fields.timestamp,
        },
      }),
    };
  } catch (error) {
    console.error("recordCampaignEvent error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to record campaign event", details: error.message }),
    };
  }
};
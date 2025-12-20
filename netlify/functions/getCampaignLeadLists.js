// netlify/functions/getCampaignLeadLists.js
const Airtable = require("airtable");
const { requireUser } = require("./_lib/auth");

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
    const campaignId = event.queryStringParameters?.campaignId || "";
    if (!campaignId) return { statusCode: 400, headers, body: JSON.stringify({ error: "campaignId is required" }) };

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    const links = await base("CampaignLeads")
      .select({
        filterByFormula: `AND({userId}='${user.uid}', ARRAYJOIN({campaignId})='${campaignId}')`,
        sort: [{ field: "createdAt", direction: "desc" }],
      })
      .all();

    // listId is a linked record array
    const listIds = links
      .map((r) => (Array.isArray(r.fields.listId) ? r.fields.listId[0] : r.fields.listId))
      .filter(Boolean);

    // fetch list details (optional)
    const lists = [];
    for (const id of listIds) {
      // eslint-disable-next-line no-await-in-loop
      const rec = await base("LeadLists").find(id);
      lists.push({ id: rec.id, name: rec.fields.name || "", source: rec.fields.source || "manual" });
    }

    return { statusCode: 200, headers, body: JSON.stringify({ lists, linkCount: links.length }) };
  } catch (error) {
    console.error("getCampaignLeadLists error:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to fetch campaign lists", details: error.message }) };
  }
};

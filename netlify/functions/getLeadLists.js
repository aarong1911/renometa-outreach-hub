// netlify/functions/getLeadLists.js
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

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    const listRecords = await base("LeadLists")
      .select({
        filterByFormula: `{userId}='${user.uid}'`,
        sort: [{ field: "createdAt", direction: "desc" }],
      })
      .all();

    const lists = listRecords.map((r) => ({
      id: r.id,
      name: r.fields.name || "",
      source: r.fields.source || "manual",
      createdAt: r.fields.createdAt || null,
      leadCount: 0,
    }));

    const leadRecords = await base("Leads")
      .select({
        filterByFormula: `{userId}='${user.uid}'`,
        fields: ["listId"],
        pageSize: 100,
      })
      .all();

    const counts = new Map();
    for (const lr of leadRecords) {
      const linked = lr.fields.listId;
      const arr = Array.isArray(linked) ? linked : linked ? [linked] : [];
      const listId = arr[0];
      if (!listId) continue;
      counts.set(listId, (counts.get(listId) || 0) + 1);
    }

    const withCounts = lists.map((l) => ({ ...l, leadCount: counts.get(l.id) || 0 }));

    return { statusCode: 200, headers, body: JSON.stringify({ lists: withCounts }) };
  } catch (error) {
    console.error("getLeadLists error:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to fetch LeadLists", details: error.message }) };
  }
};

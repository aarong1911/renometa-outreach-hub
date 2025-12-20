// netlify/functions/getLeads.js
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
    const listIdFilter = event.queryStringParameters?.listId || "";

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    const records = await base("Leads")
      .select({
        filterByFormula: `{userId}='${user.uid}'`,
        sort: [{ field: "createdAt", direction: "desc" }],
      })
      .all();

    const filtered = listIdFilter
      ? records.filter((r) => {
          const linked = r.fields.listId;
          const arr = Array.isArray(linked) ? linked : linked ? [linked] : [];
          return arr.includes(listIdFilter);
        })
      : records;

    const leads = filtered.map((record) => {
      const f = record.fields;
      const linked = f.listId;
      const listArr = Array.isArray(linked) ? linked : linked ? [linked] : [];
      const listId = listArr[0] || "";

      return {
        id: record.id,
        firstName: f.firstName || "",
        lastName: f.lastName || "",
        email: f.email || "",
        company: f.company || "",
        phone: f.phone || "",
        website: f.website || "",
        address: f.address || "",
        city: f.city || "",
        state: f.state || "",
        zip: f.zip || "",
        type: f.type || "",
        rating: f.rating || 0,
        reviews: f.reviews || 0,
        status: f.status || "new",
        source: f.source || "manual",
        listId,
        createdAt: f.createdAt || null,
        notes: f.notes || "",
      };
    });

    return { statusCode: 200, headers, body: JSON.stringify({ leads }) };
  } catch (error) {
    console.error("getLeads error:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to fetch leads", details: error.message }) };
  }
};

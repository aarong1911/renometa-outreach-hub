// netlify/functions/getTemplates.js
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
    const { category } = event.queryStringParameters || {};

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    let filterByFormula = `{userId} = '${escapeFormulaString(user.uid)}'`;
    
    if (category) {
      filterByFormula = `AND(${filterByFormula}, {category} = '${escapeFormulaString(category)}')`;
    }

    const records = await base("Templates")
      .select({
        filterByFormula,
        sort: [{ field: "createdAt", direction: "desc" }],
      })
      .all();

    const templates = records.map((r) => ({
      id: r.id,
      name: r.fields.name || "",
      subject: r.fields.subject || "",
      body: r.fields.body || "",
      category: r.fields.category || "cold-outreach",
      createdAt: r.fields.createdAt || "",
      lastUsed: r.fields.lastUsed || "",
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ templates }),
    };
  } catch (error) {
    console.error("getTemplates error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to fetch templates", details: error.message }),
    };
  }
};
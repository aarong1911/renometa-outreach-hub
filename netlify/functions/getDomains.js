// netlify/functions/getDomains.js
const Airtable = require("airtable");
const { requireUser } = require("./_lib/auth");

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
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    const records = await base("Domains")
      .select({
        filterByFormula: `{userId} = '${user.uid}'`,
        sort: [{ field: "createdAt", direction: "desc" }],
      })
      .all();

    const domains = records.map((r) => ({
      id: r.id,
      domain: r.fields.domain || "",
      subdomain: r.fields.subdomain || null,
      fullDomain: r.fields.fullDomain || r.fields.domain,
      type: r.fields.type || "gmail",
      provider: r.fields.provider || "",
      status: r.fields.status || "pending",
      dns: {
        spf: r.fields.spfStatus || "pending",
        dkim: r.fields.dkimStatus || "pending",
        dmarc: r.fields.dmarcStatus || "pending",
        mx: r.fields.mxStatus || "pending",
      },
      accountsUsing: r.fields.accountsUsing || 0,
      purchaseDate: r.fields.purchaseDate || null,
      renewalDate: r.fields.renewalDate || null,
      monthlyPrice: r.fields.monthlyPrice || null,
      createdAt: r.fields.createdAt || "",
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ domains }),
    };
  } catch (error) {
    console.error("getDomains error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to fetch domains", details: error.message }),
    };
  }
};
// netlify/functions/bulkAddLeads.js
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
    const payload = JSON.parse(event.body || "{}");
    const { leads, listId, source, duplicateAction = "skip" } = payload;

    if (!listId) return { statusCode: 400, headers, body: JSON.stringify({ error: "listId is required" }) };
    if (!Array.isArray(leads) || leads.length === 0) return { statusCode: 400, headers, body: JSON.stringify({ error: "No leads provided" }) };

    const importSource = (source || "csv-import").toString();
    const uid = user.uid;

    const cleanedLeads = leads
      .map((l) => ({
        firstName: (l.firstName || "").trim(),
        lastName: (l.lastName || "").trim(),
        email: (l.email || "").trim().toLowerCase(),
        company: (l.company || "").trim(),
        phone: (l.phone || "").trim(),
        website: (l.website || "").trim(),
        address: (l.address || "").trim(),
        city: (l.city || "").trim(),
        state: (l.state || "").trim(),
        zip: (l.zip || "").trim(),
        type: (l.type || "").trim(),
        rating: Number.parseFloat(l.rating) || 0,
        reviews: Number.parseInt(l.reviews, 10) || 0,
      }))
      .filter((l) => l.email);

    if (cleanedLeads.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "No valid leads (email required)" }) };
    }

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    // Build existing email -> recordId map (for this user only)
    const existing = await base("Leads")
      .select({ filterByFormula: `{userId}='${uid}'`, fields: ["email"] })
      .all();

    const existingMap = new Map();
    for (const r of existing) {
      const e = (r.fields.email || "").toString().trim().toLowerCase();
      if (e) existingMap.set(e, r.id);
    }

    const toCreate = [];
    const toUpdate = [];

    for (const lead of cleanedLeads) {
      const existingId = existingMap.get(lead.email);

      if (existingId) {
        if (duplicateAction === "skip") continue;
        if (duplicateAction === "update") {
          toUpdate.push({
            id: existingId,
            fields: {
              ...lead,
              status: "new",
              source: importSource,
              userId: uid,
              listId: [listId],
            },
          });
          continue;
        }
        // duplicateAction === "import" -> fallthrough to create a new record
      }

      toCreate.push({
        fields: {
          ...lead,
          status: "new",
          source: importSource,
          userId: uid,
          listId: [listId],
        },
      });
    }

    const chunkSize = 10;
    const createdIds = [];
    const updatedIds = [];

    for (let i = 0; i < toUpdate.length; i += chunkSize) {
      const chunk = toUpdate.slice(i, i + chunkSize);
      // eslint-disable-next-line no-await-in-loop
      const updated = await base("Leads").update(chunk, { typecast: true });
      updated.forEach((r) => updatedIds.push(r.id));
    }

    for (let i = 0; i < toCreate.length; i += chunkSize) {
      const chunk = toCreate.slice(i, i + chunkSize);
      // eslint-disable-next-line no-await-in-loop
      const created = await base("Leads").create(chunk, { typecast: true });
      created.forEach((r) => createdIds.push(r.id));
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        imported: createdIds.length + updatedIds.length,
        created: createdIds.length,
        updated: updatedIds.length,
        leadIds: [...createdIds, ...updatedIds],
      }),
    };
  } catch (error) {
    console.error("bulkAddLeads error:", error);
    const details = error?.response?.body || error.message || "Unknown error";
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to bulk add leads", details }) };
  }
};

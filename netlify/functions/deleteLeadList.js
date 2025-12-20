// netlify/functions/deleteLeadList.js
// Delete a LeadList and (by default) all leads linked to it

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
    const { listId, deleteLeads = true } = JSON.parse(event.body || "{}");

    if (!listId) return { statusCode: 400, headers, body: JSON.stringify({ error: "listId is required" }) };

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    // Load user's leads and filter in code (linked field filtering in Airtable formulas is annoying)
    const leadRecords = await base("Leads")
      .select({
        filterByFormula: `{userId} = '${user.uid}'`,
        fields: ["listId"],
        pageSize: 100,
      })
      .all();

    const toAffect = leadRecords.filter((r) => {
      const linked = r.fields.listId;
      const arr = Array.isArray(linked) ? linked : linked ? [linked] : [];
      return arr.includes(listId);
    });

    const chunkSize = 10;
    let affectedCount = 0;

    if (toAffect.length) {
      for (let i = 0; i < toAffect.length; i += chunkSize) {
        const chunk = toAffect.slice(i, i + chunkSize);
        const ids = chunk.map((r) => r.id);

        // eslint-disable-next-line no-await-in-loop
        if (deleteLeads) {
          await base("Leads").destroy(ids);
        } else {
          // unlink only
          await base("Leads").update(
            ids.map((id) => ({ id, fields: { listId: [] } })),
            { typecast: true }
          );
        }
        affectedCount += ids.length;
      }
    }

    // Delete the list itself
    await base("LeadLists").destroy([listId]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        deletedListId: listId,
        affectedLeads: affectedCount,
        mode: deleteLeads ? "deleted-leads" : "unlinked-leads",
      }),
    };
  } catch (error) {
    console.error("deleteLeadList error:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to delete LeadList", details: error.message }) };
  }
};

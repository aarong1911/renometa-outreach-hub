// netlify/functions/duplicateLeadList.js
const Airtable = require("airtable");
const { requireUser } = require("./_lib/auth");

function escapeFormulaString(value) {
  return String(value || "").replace(/'/g, "\\'");
}

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
    const { listId, newName } = JSON.parse(event.body || "{}");

    if (!listId) return { statusCode: 400, headers, body: JSON.stringify({ error: "listId is required" }) };

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    const original = await base("LeadLists").find(listId);
    if ((original.fields.userId || "") !== user.uid) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden" }) };
    }

    const name = (newName && String(newName).trim()) || `${original.fields.name || "List"} (Copy)`;

    // Create the duplicate list (without createdAt)
    const createdList = await base("LeadLists").create(
      {
        name,
        userId: user.uid,
        source: original.fields.source || "manual",
      },
      { typecast: true }
    );

    // Find leads in the original list
    const filterByFormula = `{userId} = '${escapeFormulaString(user.uid)}'`;
    const leads = await base("Leads")
      .select({
        filterByFormula,
        pageSize: 100,
      })
      .all();

    const inList = leads.filter((r) => {
      const linked = r.fields.listId;
      const arr = Array.isArray(linked) ? linked : linked ? [linked] : [];
      return arr.includes(listId);
    });

    const chunkSize = 10;
    let cloned = 0;

    for (let i = 0; i < inList.length; i += chunkSize) {
      const chunk = inList.slice(i, i + chunkSize);

      const recordsToCreate = chunk.map((r) => {
        const f = r.fields;
        return {
          fields: {
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
            userId: user.uid,
            // Removed createdAt - Airtable handles this automatically
            listId: [createdList.id],
          },
        };
      });

      // eslint-disable-next-line no-await-in-loop
      await base("Leads").create(recordsToCreate, { typecast: true });
      cloned += recordsToCreate.length;
    }

    return { 
      statusCode: 200, 
      headers, 
      body: JSON.stringify({ 
        success: true, 
        newListId: createdList.id, 
        clonedLeads: cloned,
        createdAt: createdList.fields.createdAt,
      }) 
    };
  } catch (error) {
    console.error("duplicateLeadList error:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to duplicate list", details: error.message }) };
  }
};
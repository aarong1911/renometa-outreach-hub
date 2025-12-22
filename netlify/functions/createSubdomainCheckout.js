// netlify/functions/createSubdomainCheckout.js
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
    const { subdomain, domain } = JSON.parse(event.body || "{}");

    if (!subdomain || !domain) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "subdomain and domain required" }),
      };
    }

    const fullDomain = `${subdomain}.${domain}`;

    // TODO: Integrate with Stripe
    // For now, add domain directly to Airtable with purchased status
    
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    const record = await base("Domains").create({
      userId: user.uid,
      domain: domain,
      subdomain: subdomain,
      type: "purchased",
      status: "active",
      provider: "RenοMeta",
      spfStatus: "pending",
      dkimStatus: "pending",
      dmarcStatus: "pending",
      mxStatus: "pending",
      monthlyPrice: 5,
      purchaseDate: new Date().toISOString(),
      autoRenew: true,
      accountsUsing: 0,
    });

    // TODO: When Stripe is integrated, this should:
    // 1. Create Stripe checkout session
    // 2. Return checkout URL
    // 3. On success webhook, create domain record
    // 4. Set up DNS automatically

    // For now, simulate success
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        domain: {
          id: record.id,
          fullDomain,
          ...record.fields,
        },
        // When Stripe integrated: checkoutUrl: session.url
      }),
    };
  } catch (error) {
    console.error("createSubdomainCheckout error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to create checkout", details: error.message }),
    };
  }
};
// netlify/functions/createSubdomainCheckout.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
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

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: process.env.STRIPE_SUBDOMAIN_PRICE_ID, // Your $5/month price ID
        quantity: 1,
      }],
      success_url: `${process.env.URL}/domains?success=true&subdomain=${encodeURIComponent(fullDomain)}`,
      cancel_url: `${process.env.URL}/domains?canceled=true`,
      customer_email: user.email,
      client_reference_id: user.uid,
      metadata: {
        userId: user.uid,
        subdomain: subdomain,
        domain: domain,
        fullDomain: fullDomain,
        type: 'subdomain_purchase',
      },
      subscription_data: {
        metadata: {
          userId: user.uid,
          subdomain: subdomain,
          domain: domain,
          fullDomain: fullDomain,
        },
      },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        checkoutUrl: session.url,
        sessionId: session.id,
      }),
    };
  } catch (error) {
    console.error("createSubdomainCheckout error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: "Failed to create checkout", 
        details: error.message 
      }),
    };
  }
};
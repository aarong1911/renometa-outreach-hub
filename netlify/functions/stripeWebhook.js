// netlify/functions/stripeWebhook.js
const Airtable = require("airtable");
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Stripe-Signature",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { 
      statusCode: 400, 
      headers, 
      body: JSON.stringify({ error: 'Invalid signature' }) 
    };
  }

  const base = new Airtable({ 
    apiKey: process.env.AIRTABLE_API_KEY 
  }).base(process.env.AIRTABLE_BASE_ID);

  try {
    // Handle successful checkout
    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object;
      const { userId, subdomain, domain, fullDomain } = session.metadata;

      console.log(`Creating subdomain: ${fullDomain} for user ${userId}`);

      // Generate DNS records
      const dnsRecords = generateDNSRecords(subdomain, domain);

      // Create domain in Airtable
      await base("Domains").create({
        userId: userId,
        domain: domain,
        subdomain: subdomain,
        type: "purchased",
        status: "pending_dns", // User needs to configure DNS
        provider: "RenoMeta",
        spfStatus: "pending",
        dkimStatus: "pending",
        dmarcStatus: "pending",
        mxStatus: "pending",
        spfRecord: dnsRecords.spf,
        dkimRecord: dnsRecords.dkim,
        dmarcRecord: dnsRecords.dmarc,
        mxRecord: dnsRecords.mx,
        monthlyPrice: 5,
        purchaseDate: new Date().toISOString(),
        renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        autoRenew: true,
        accountsUsing: 0,
        stripeSubscriptionId: session.subscription,
        stripeCustomerId: session.customer,
      });

      console.log(`Subdomain ${fullDomain} created successfully`);

      // TODO: Send setup email to user with DNS instructions
    }

    // Handle successful payment (renewal)
    if (stripeEvent.type === 'invoice.payment_succeeded') {
      const invoice = stripeEvent.data.object;
      const subscriptionId = invoice.subscription;

      console.log(`Payment succeeded for subscription: ${subscriptionId}`);

      // Update renewal date in Airtable
      const domains = await base("Domains")
        .select({
          filterByFormula: `{stripeSubscriptionId} = '${subscriptionId}'`,
          maxRecords: 1,
        })
        .firstPage();

      if (domains.length > 0) {
        await base("Domains").update(domains[0].id, {
          renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          status: "active",
        });
        console.log(`Updated renewal date for domain ${domains[0].fields.fullDomain}`);
      }
    }

    // Handle failed payment
    if (stripeEvent.type === 'invoice.payment_failed') {
      const invoice = stripeEvent.data.object;
      const subscriptionId = invoice.subscription;

      console.log(`Payment failed for subscription: ${subscriptionId}`);

      // Update domain status to payment_failed
      const domains = await base("Domains")
        .select({
          filterByFormula: `{stripeSubscriptionId} = '${subscriptionId}'`,
          maxRecords: 1,
        })
        .firstPage();

      if (domains.length > 0) {
        await base("Domains").update(domains[0].id, {
          status: "payment_failed",
        });
        console.log(`Marked domain ${domains[0].fields.fullDomain} as payment_failed`);
      }

      // TODO: Send payment failed email to user
    }

    // Handle subscription cancellation
    if (stripeEvent.type === 'customer.subscription.deleted') {
      const subscription = stripeEvent.data.object;
      const subscriptionId = subscription.id;

      console.log(`Subscription cancelled: ${subscriptionId}`);

      // Find and deactivate domain
      const domains = await base("Domains")
        .select({
          filterByFormula: `{stripeSubscriptionId} = '${subscriptionId}'`,
          maxRecords: 1,
        })
        .firstPage();

      if (domains.length > 0) {
        await base("Domains").update(domains[0].id, {
          status: "cancelled",
          autoRenew: false,
        });
        console.log(`Cancelled domain ${domains[0].fields.fullDomain}`);
      }

      // TODO: Send cancellation confirmation email
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ received: true }),
    };
  } catch (error) {
    console.error('Webhook handler error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Webhook handler failed', 
        details: error.message 
      }),
    };
  }
};

// Helper function to generate DNS records
function generateDNSRecords(subdomain, domain) {
  // These should point to your email sending infrastructure
  // For now, using placeholder values - update with your actual mail server
  
  return {
    spf: `v=spf1 include:_spf.renometa.com ~all`,
    dkim: `v=DKIM1; k=rsa; p=[YOUR_DKIM_PUBLIC_KEY]`,
    dmarc: `v=DMARC1; p=none; rua=mailto:dmarc@renometa.com`,
    mx: `10 mx.renometa.com`,
  };
}
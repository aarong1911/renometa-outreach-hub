// netlify/functions/getDNSRecords.js
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
    const domainId = event.queryStringParameters?.domainId;

    if (!domainId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "domainId required" }) };
    }

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    const domain = await base("Domains").find(domainId);
    if (domain.fields.userId !== user.uid) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden" }) };
    }

    const fullDomain = domain.fields.fullDomain || domain.fields.domain;
    const rootDomain = domain.fields.domain;
    const type = domain.fields.type || "gmail";

    // Generate DNS records based on domain type
    const records = [];

    // SPF Record
    let spfValue = "";
    if (type === "gmail") {
      spfValue = "v=spf1 include:_spf.google.com ~all";
    } else if (type === "smtp" && domain.fields.smtpHost) {
      spfValue = `v=spf1 include:${domain.fields.smtpHost} ~all`;
    } else {
      spfValue = "v=spf1 ~all";
    }

    records.push({
      type: "TXT",
      name: fullDomain === rootDomain ? "@" : domain.fields.subdomain || "@",
      value: spfValue,
      ttl: "3600",
      description: "SPF record - Prevents email spoofing",
    });

    // DMARC Record
    records.push({
      type: "TXT",
      name: `_dmarc${fullDomain === rootDomain ? "" : "." + domain.fields.subdomain}`,
      value: `v=DMARC1; p=none; rua=mailto:dmarc@${rootDomain}`,
      ttl: "3600",
      description: "DMARC record - Email authentication policy",
    });

    // MX Records (for Gmail)
    if (type === "gmail") {
      const mxRecords = [
        { priority: 1, value: "ASPMX.L.GOOGLE.COM" },
        { priority: 5, value: "ALT1.ASPMX.L.GOOGLE.COM" },
        { priority: 5, value: "ALT2.ASPMX.L.GOOGLE.COM" },
        { priority: 10, value: "ALT3.ASPMX.L.GOOGLE.COM" },
        { priority: 10, value: "ALT4.ASPMX.L.GOOGLE.COM" },
      ];

      mxRecords.forEach((mx) => {
        records.push({
          type: "MX",
          name: fullDomain === rootDomain ? "@" : domain.fields.subdomain || "@",
          value: mx.value,
          priority: mx.priority,
          ttl: "3600",
          description: "MX record - Mail server routing",
        });
      });
    } else if (type === "smtp" && domain.fields.smtpHost) {
      records.push({
        type: "MX",
        name: fullDomain === rootDomain ? "@" : domain.fields.subdomain || "@",
        value: domain.fields.smtpHost,
        priority: 10,
        ttl: "3600",
        description: "MX record - Mail server routing",
      });
    }

    // DKIM instructions (actual keys come from email provider)
    records.push({
      type: "TXT",
      name: "default._domainkey" + (domain.fields.subdomain ? "." + domain.fields.subdomain : ""),
      value: "[Get from Google Workspace Admin or your email provider]",
      ttl: "3600",
      description: "DKIM record - Email signature verification",
      note: type === "gmail" 
        ? "Go to Google Workspace Admin Console → Apps → Google Workspace → Gmail → Authenticate email"
        : "Contact your email provider for DKIM keys",
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        domain: fullDomain,
        rootDomain,
        type,
        records,
        instructions: {
          gmail: "Add these records to your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.)",
          smtp: "Add these records to your domain's DNS settings",
          general: "DNS changes can take up to 48 hours to propagate",
        },
      }),
    };
  } catch (error) {
    console.error("getDNSRecords error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to get DNS records", details: error.message }),
    };
  }
};
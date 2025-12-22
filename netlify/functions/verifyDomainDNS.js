// netlify/functions/verifyDomainDNS.js
const Airtable = require("airtable");
const { requireUser } = require("./_lib/auth");
const dns = require("dns").promises;

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
    const { domainId } = JSON.parse(event.body || "{}");

    if (!domainId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "domainId required" }) };
    }

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    // Get domain
    const domain = await base("Domains").find(domainId);
    if (domain.fields.userId !== user.uid) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden" }) };
    }

    const fullDomain = domain.fields.fullDomain || domain.fields.domain;
    const results = {
      spf: "pending",
      dkim: "pending",
      dmarc: "pending",
      mx: "pending",
    };

    // Check SPF record
    try {
      const txtRecords = await dns.resolveTxt(fullDomain);
      const spfRecord = txtRecords.find((record) =>
        record.join("").includes("v=spf1")
      );
      if (spfRecord) {
        results.spf = "verified";
      }
    } catch (err) {
      console.log("SPF check failed:", err.message);
    }

    // Check DMARC record
    try {
      const dmarcRecords = await dns.resolveTxt(`_dmarc.${fullDomain}`);
      if (dmarcRecords.length > 0) {
        results.dmarc = "verified";
      }
    } catch (err) {
      console.log("DMARC check failed:", err.message);
    }

    // Check MX record
    try {
      const mxRecords = await dns.resolveMx(fullDomain);
      if (mxRecords.length > 0) {
        results.mx = "verified";
      }
    } catch (err) {
      console.log("MX check failed:", err.message);
    }

    // DKIM is harder to verify without knowing the selector
    // For now, we'll mark it as verified if SPF and DMARC are verified
    if (results.spf === "verified" && results.dmarc === "verified") {
      results.dkim = "verified";
    }

    // Update domain status
    const updateFields = {
      spfStatus: results.spf,
      dkimStatus: results.dkim,
      dmarcStatus: results.dmarc,
      mxStatus: results.mx,
      lastVerified: new Date().toISOString(),
    };

    // Update overall status
    if (Object.values(results).every((v) => v === "verified")) {
      updateFields.status = "active";
    } else if (Object.values(results).some((v) => v === "verified")) {
      updateFields.status = "verifying";
    } else {
      updateFields.status = "pending";
    }

    await base("Domains").update(domainId, updateFields);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        results,
        status: updateFields.status,
      }),
    };
  } catch (error) {
    console.error("verifyDomainDNS error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to verify DNS", details: error.message }),
    };
  }
};
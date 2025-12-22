// netlify/functions/searchDomains.js
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
    const { query } = JSON.parse(event.body || "{}");

    if (!query) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Query required" }) };
    }

    // Generate subdomain suggestions
    const subdomainOptions = [
      // Popular Classic Options
      {
        subdomain: "mail",
        description: "Classic choice for email sending - most commonly used",
        popular: true,
        price: 5,
      },
      {
        subdomain: "send",
        description: "Clean and professional sending subdomain",
        popular: true,
        price: 5,
      },
      {
        subdomain: "outreach",
        description: "Perfect for outreach and prospecting campaigns",
        popular: true,
        price: 5,
      },
      
      // First Names - Male
      {
        subdomain: "steve",
        description: "Professional first name subdomain - looks authentic",
        popular: true,
        price: 5,
      },
      {
        subdomain: "john",
        description: "Common professional name - high trust factor",
        popular: true,
        price: 5,
      },
      {
        subdomain: "mike",
        description: "Friendly and approachable sender name",
        popular: false,
        price: 5,
      },
      {
        subdomain: "david",
        description: "Professional sender identity",
        popular: false,
        price: 5,
      },
      {
        subdomain: "james",
        description: "Classic professional name",
        popular: false,
        price: 5,
      },
      {
        subdomain: "robert",
        description: "Traditional business name",
        popular: false,
        price: 5,
      },
      {
        subdomain: "michael",
        description: "Trustworthy sender name",
        popular: false,
        price: 5,
      },
      {
        subdomain: "chris",
        description: "Modern professional name",
        popular: false,
        price: 5,
      },
      {
        subdomain: "alex",
        description: "Gender-neutral professional name",
        popular: false,
        price: 5,
      },
      {
        subdomain: "tom",
        description: "Short and memorable",
        popular: false,
        price: 5,
      },
      {
        subdomain: "ryan",
        description: "Modern professional identity",
        popular: false,
        price: 5,
      },
      {
        subdomain: "kevin",
        description: "Friendly business name",
        popular: false,
        price: 5,
      },
      {
        subdomain: "brian",
        description: "Professional sender identity",
        popular: false,
        price: 5,
      },
      {
        subdomain: "mark",
        description: "Executive-level sender name",
        popular: false,
        price: 5,
      },
      {
        subdomain: "paul",
        description: "Classic business name",
        popular: false,
        price: 5,
      },
      {
        subdomain: "daniel",
        description: "Professional and trustworthy",
        popular: false,
        price: 5,
      },
      
      // First Names - Female
      {
        subdomain: "sarah",
        description: "Professional female sender name",
        popular: true,
        price: 5,
      },
      {
        subdomain: "emily",
        description: "Warm and professional identity",
        popular: false,
        price: 5,
      },
      {
        subdomain: "jessica",
        description: "Trustworthy sender name",
        popular: false,
        price: 5,
      },
      {
        subdomain: "lisa",
        description: "Classic professional name",
        popular: false,
        price: 5,
      },
      {
        subdomain: "jennifer",
        description: "Executive sender identity",
        popular: false,
        price: 5,
      },
      {
        subdomain: "amanda",
        description: "Modern professional name",
        popular: false,
        price: 5,
      },
      {
        subdomain: "rachel",
        description: "Professional and approachable",
        popular: false,
        price: 5,
      },
      {
        subdomain: "nicole",
        description: "Business professional name",
        popular: false,
        price: 5,
      },
      {
        subdomain: "michelle",
        description: "Classic sender identity",
        popular: false,
        price: 5,
      },
      {
        subdomain: "laura",
        description: "Professional sender name",
        popular: false,
        price: 5,
      },
      {
        subdomain: "amy",
        description: "Friendly and professional",
        popular: false,
        price: 5,
      },
      {
        subdomain: "kate",
        description: "Short and professional",
        popular: false,
        price: 5,
      },
      
      // Professional Roles
      {
        subdomain: "sales",
        description: "Sales outreach and prospecting",
        popular: true,
        price: 5,
      },
      {
        subdomain: "team",
        description: "Team communications and updates",
        popular: false,
        price: 5,
      },
      {
        subdomain: "support",
        description: "Customer support communications",
        popular: false,
        price: 5,
      },
      {
        subdomain: "info",
        description: "Informational emails",
        popular: false,
        price: 5,
      },
      {
        subdomain: "contact",
        description: "General contact emails",
        popular: false,
        price: 5,
      },
      {
        subdomain: "hello",
        description: "Friendly greeting subdomain",
        popular: false,
        price: 5,
      },
      {
        subdomain: "help",
        description: "Help and assistance emails",
        popular: false,
        price: 5,
      },
      
      // Business Functions
      {
        subdomain: "marketing",
        description: "Marketing campaigns and promotions",
        popular: false,
        price: 5,
      },
      {
        subdomain: "news",
        description: "Newsletters and company news",
        popular: false,
        price: 5,
      },
      {
        subdomain: "updates",
        description: "Product updates and announcements",
        popular: false,
        price: 5,
      },
      {
        subdomain: "notify",
        description: "Notifications and alerts",
        popular: false,
        price: 5,
      },
      {
        subdomain: "alerts",
        description: "System alerts and notifications",
        popular: false,
        price: 5,
      },
      {
        subdomain: "email",
        description: "General email subdomain",
        popular: false,
        price: 5,
      },
      
      // Modern/Trendy Names
      {
        subdomain: "taylor",
        description: "Modern gender-neutral name",
        popular: false,
        price: 5,
      },
      {
        subdomain: "jordan",
        description: "Contemporary professional name",
        popular: false,
        price: 5,
      },
      {
        subdomain: "morgan",
        description: "Professional gender-neutral identity",
        popular: false,
        price: 5,
      },
      {
        subdomain: "casey",
        description: "Modern business name",
        popular: false,
        price: 5,
      },
      {
        subdomain: "sam",
        description: "Short professional name",
        popular: false,
        price: 5,
      },
    ];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ results: subdomainOptions }),
    };
  } catch (error) {
    console.error("searchDomains error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to search domains", details: error.message }),
    };
  }
};
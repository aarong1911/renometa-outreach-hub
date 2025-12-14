// netlify/functions/addCampaign.js
// Create a new campaign in Airtable

const Airtable = require('airtable');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { name } = JSON.parse(event.body);

    // Validate required fields
    if (!name) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Campaign name is required' })
      };
    }

    const base = new Airtable({ 
      apiKey: process.env.AIRTABLE_API_KEY 
    }).base(process.env.AIRTABLE_BASE_ID);

    // Create new campaign
    const record = await base('Campaigns').create({
      name: name,
      status: 'draft',
      sent: 0,
      opened: 0,
      replied: 0,
      userId: 'temp-migration' // TODO: Use actual user ID from auth
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        campaign: {
          id: record.id,
          name: record.fields.name,
          status: record.fields.status
        }
      }),
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to create campaign', 
        details: error.message 
      }),
    };
  }
};
// netlify/functions/getCampaigns.js
// Fetch campaigns from Airtable

const Airtable = require('airtable');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const base = new Airtable({ 
      apiKey: process.env.AIRTABLE_API_KEY 
    }).base(process.env.AIRTABLE_BASE_ID);

    // Get all campaigns
    const records = await base('Campaigns')
      .select({
        sort: [{ field: 'createdAt', direction: 'desc' }]
      })
      .all();

    const campaigns = records.map(record => {
      const fields = record.fields;
      return {
        id: record.id,
        name: fields.name,
        userId: fields.userId,
        status: fields.status || 'draft',
        sent: fields.sent || 0,
        opened: fields.opened || 0,
        replied: fields.replied || 0,
        createdAt: fields.createdAt,
        startedAt: fields.startedAt,
        completedAt: fields.completedAt
      };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ campaigns }),
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to fetch campaigns', 
        details: error.message 
      }),
    };
  }
};
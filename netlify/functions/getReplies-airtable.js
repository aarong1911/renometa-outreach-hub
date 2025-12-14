// netlify/functions/getReplies-airtable.js
// Fetch warmup replies from Airtable

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
    // Get userId from query parameters
    const userId = event.queryStringParameters?.userId;

    if (!userId) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'User ID is required' }),
      };
    }

    const base = new Airtable({ 
      apiKey: process.env.AIRTABLE_API_KEY 
    }).base(process.env.AIRTABLE_BASE_ID);

    // Get recent replies (last 50) for this user
    const records = await base('Warmup Replies')
      .select({
        filterByFormula: `{userId} = '${userId}'`,
        maxRecords: 50,
        sort: [{ field: 'repliedAt', direction: 'desc' }]
      })
      .all();

    const replies = records.map(record => {
      const fields = record.fields;
      return {
        id: record.id,
        fromAccountId: fields.fromAccountId,
        toAccountId: fields.toAccountId,
        originalEmailId: fields.originalEmailId,
        repliedAt: fields.repliedAt,
        delayMinutes: fields.delayMinutes,
      };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ replies }),
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch replies', details: error.message }),
    };
  }
};
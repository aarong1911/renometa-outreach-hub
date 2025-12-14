// netlify/functions/getActivity-airtable.js
// Fetch recent email activity from Airtable

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

    // Get recent email logs (last 50) for this user
    const records = await base('Email Logs')
      .select({
        filterByFormula: `{userId} = '${userId}'`,
        maxRecords: 50,
        sort: [{ field: 'sentAt', direction: 'desc' }]
      })
      .all();

    const activity = records.map(record => {
      const fields = record.fields;
      return {
        id: record.id,
        fromEmail: fields.fromEmail,
        toEmail: fields.toEmail,
        subject: fields.subject,
        emailType: fields.emailType,
        status: fields.status,
        sentAt: fields.sentAt,
        openedAt: fields.openedAt,
        repliedAt: fields.repliedAt,
      };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ activity }),
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch activity', details: error.message }),
    };
  }
};
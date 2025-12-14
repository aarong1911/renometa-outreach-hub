// netlify/functions/addLead.js
// Add a new lead to Airtable

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
    const { name, email, company, userId } = JSON.parse(event.body);

    // Validate required fields
    if (!name || !email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Name and email are required' })
      };
    }

    if (!userId) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'User ID is required' })
      };
    }

    const base = new Airtable({ 
      apiKey: process.env.AIRTABLE_API_KEY 
    }).base(process.env.AIRTABLE_BASE_ID);

    // Create new lead
    const record = await base('Leads').create({
      name: name,
      email: email,
      company: company || '',
      status: 'new',
      source: 'manual',
      userId: userId
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        lead: {
          id: record.id,
          name: record.fields.name,
          email: record.fields.email,
          company: record.fields.company
        }
      }),
    };

  } catch (error) {
  console.error('Error adding lead:', error);

  const details =
    error?.response?.body ||
    error?.message ||
    'Unknown error';

  return {
    statusCode: 500,
    headers,
    body: JSON.stringify({
      error: 'Failed to add lead',
      details,
    }),
  };
}

};
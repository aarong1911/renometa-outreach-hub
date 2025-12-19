// netlify/functions/getLeads.js
// Fetch leads from Airtable

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
        body: JSON.stringify({ error: 'User ID is required' })
      };
    }

    const base = new Airtable({ 
      apiKey: process.env.AIRTABLE_API_KEY 
    }).base(process.env.AIRTABLE_BASE_ID);

    // Get leads for this user only
    const records = await base('Leads')
      .select({
        filterByFormula: `{userId} = '${userId}'`,
        sort: [{ field: 'createdAt', direction: 'desc' }]
      })
      .all();

    const leads = records.map(record => {
      const fields = record.fields;
      return {
        id: record.id,
        firstName: fields.firstName || '',
        lastName: fields.lastName || '',
        email: fields.email,
        company: fields.company || '',
        phone: fields.phone || '',
        website: fields.website || '',
        address: fields.address || '',
        city: fields.city || '',
        state: fields.state || '',
        zip: fields.zip || '',
        type: fields.type || '',
        rating: fields.rating || 0,
        reviews: fields.reviews || 0,
        status: fields.status || 'new',
        source: fields.source || 'manual', // manual, csv-import, excel-import, gsheet-import, api
        listId: fields.listId || '',
        userId: fields.userId,
        createdAt: fields.createdAt,
        notes: fields.notes || ''
      };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ leads }),
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to fetch leads', 
        details: error.message 
      }),
    };
  }
};
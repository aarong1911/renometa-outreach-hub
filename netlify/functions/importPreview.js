// netlify/functions/importPreview.js
// Parse CSV/XLSX and return headers + preview rows for mapping

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
    const { userId, fileContent, fileType } = JSON.parse(event.body);

    if (!userId) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'User ID is required' })
      };
    }

    if (!fileContent) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'File content is required' })
      };
    }

    // Parse CSV (simple implementation - for production use papaparse or similar)
    const lines = fileContent.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'File is empty' })
      };
    }

    // Get headers from first line
    const headerLine = lines[0];
    const rawHeaders = headerLine.split(',').map(h => h.trim().replace(/['"]/g, ''));
    
    // Parse sample rows (first 20)
    const sampleRows = [];
    const maxPreviewRows = Math.min(20, lines.length - 1);
    
    for (let i = 1; i <= maxPreviewRows; i++) {
      const row = lines[i].split(',').map(cell => cell.trim().replace(/['"]/g, ''));
      const rowObject = {};
      rawHeaders.forEach((header, index) => {
        rowObject[header] = row[index] || '';
      });
      sampleRows.push(rowObject);
    }

    // Auto-suggest field mappings
    const suggestedMapping = autoMapHeaders(rawHeaders);

    // Get existing emails from Airtable for duplicate detection
    const base = new Airtable({ 
      apiKey: process.env.AIRTABLE_API_KEY 
    }).base(process.env.AIRTABLE_BASE_ID);

    const existingRecords = await base('Leads')
      .select({
        filterByFormula: `{userId} = '${userId}'`,
        fields: ['email']
      })
      .all();

    const existingEmails = new Set(
      existingRecords.map(r => r.fields.email?.toLowerCase())
    );

    // Validate preview rows
    const validation = validateRows(sampleRows, suggestedMapping, existingEmails);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        headers: rawHeaders,
        sampleRows,
        suggestedMapping,
        totalRows: lines.length - 1,
        validation,
        existingEmailCount: existingEmails.size
      }),
    };

  } catch (error) {
    console.error('Error in importPreview:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to preview import', 
        details: error.message 
      }),
    };
  }
};

// Auto-map headers to standard fields
function autoMapHeaders(headers) {
  const mapping = {};
  
  const synonyms = {
    email: ['email', 'e-mail', 'mail', 'email address', 'e_mail'],
    firstName: ['first', 'firstname', 'first_name', 'first name', 'fname'],
    lastName: ['last', 'lastname', 'last_name', 'last name', 'lname'],
    name: ['name', 'full name', 'fullname', 'full_name', 'contact name'],
    company: ['company', 'business', 'org', 'organization', 'company name'],
    phone: ['phone', 'tel', 'mobile', 'telephone', 'phone number'],
    website: ['site', 'website', 'url', 'web', 'domain'],
    address: ['address', 'street', 'location'],
    city: ['city', 'town'],
    state: ['state', 'province', 'region'],
    zip: ['zip', 'postal', 'postcode', 'zipcode', 'postal code'],
    type: ['industry', 'type', 'category', 'sector'],
    rating: ['rating', 'stars', 'score'],
    reviews: ['reviews', 'review_count', 'review count', 'total reviews']
  };

  headers.forEach(header => {
    const normalized = header.toLowerCase().trim().replace(/[_-]/g, ' ');
    let mapped = false;

    for (const [field, patterns] of Object.entries(synonyms)) {
      if (patterns.some(pattern => normalized === pattern || normalized.includes(pattern))) {
        mapping[header] = field;
        mapped = true;
        break;
      }
    }

    if (!mapped) {
      mapping[header] = 'custom'; // Custom field
    }
  });

  return mapping;
}

// Validate rows for errors
function validateRows(rows, mapping, existingEmails) {
  let validCount = 0;
  let invalidEmailCount = 0;
  let duplicateCount = 0;
  const errors = [];

  // Find which column is mapped to email
  const emailColumn = Object.keys(mapping).find(key => mapping[key] === 'email');

  rows.forEach((row, index) => {
    const email = emailColumn ? row[emailColumn]?.toLowerCase().trim() : '';
    
    // Check if email exists
    if (!email) {
      invalidEmailCount++;
      errors.push({ row: index + 2, error: 'Missing email' });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      invalidEmailCount++;
      errors.push({ row: index + 2, error: 'Invalid email format' });
      return;
    }

    // Check for duplicates
    if (existingEmails.has(email)) {
      duplicateCount++;
      errors.push({ row: index + 2, error: 'Duplicate email (already in system)' });
      return;
    }

    validCount++;
  });

  return {
    validCount,
    invalidEmailCount,
    duplicateCount,
    errors: errors.slice(0, 10), // Return first 10 errors
    totalErrors: errors.length
  };
}
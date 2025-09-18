const fs = require('node:fs/promises');
const path = require('node:path');
const { readProducts } = require('./products');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SUBMISSIONS_PATH = path.join(DATA_DIR, 'submissions.json');

const REQUIRED_FIELDS = [
  'employeeName',
  'department',
  'shippingAddress',
  'recipientName',
  'recipientPhone',
  'giftId',
];

function sanitize(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function readSubmissions() {
  try {
    const raw = await fs.readFile(SUBMISSIONS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
  return [];
}

function validatePhone(phone) {
  return /^[+\d][\d\s\-()]{6,}$/.test(phone);
}

async function handleSubmission(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
    const rawBody = await readBody(req);
    const data = JSON.parse(rawBody || '{}');
    const cleaned = {};
    for (const field of REQUIRED_FIELDS) {
      cleaned[field] = sanitize(data[field]);
      if (!cleaned[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!validatePhone(cleaned.recipientPhone)) {
      throw new Error('Recipient phone number must contain at least seven digits.');
    }

    const products = await readProducts();
    const selected = products.find((item) => item.id === cleaned.giftId);
    if (!selected) {
      throw new Error('Selected gift could not be found. Please refresh and try again.');
    }

    const submissionRecord = {
      ...cleaned,
      notes: sanitize(data.notes || ''),
      giftName: selected.name,
      submittedAt: new Date().toISOString(),
    };

    const submissions = await readSubmissions();
    submissions.push(submissionRecord);
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(SUBMISSIONS_PATH, `${JSON.stringify(submissions, null, 2)}\n`, 'utf8');

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({ message: 'Thank you! Your submission has been recorded.', submission: submissionRecord })
    );
  } catch (error) {
    let status = 400;
    if (error instanceof SyntaxError) {
      status = 400;
    }
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message || 'Failed to submit survey.' }));
  }
}

module.exports = {
  handleSubmission,
};

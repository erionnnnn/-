const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const PRODUCTS_PATH = path.join(DATA_DIR, 'products.json');
const XLSX_SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'parse_xlsx.py');

const REQUIRED_HEADERS = ['giftid', 'name', 'description'];
const OPTIONAL_HEADERS = ['category'];

function parseMultipart(bodyBuffer, boundary) {
  const boundaryMarker = `--${boundary}`;
  const body = bodyBuffer.toString('binary');
  const sections = body.split(boundaryMarker);
  const result = { fields: {}, files: [] };

  for (let index = 1; index < sections.length - 1; index += 1) {
    let section = sections[index];
    if (!section) {
      continue;
    }

    if (section.startsWith('\r\n')) {
      section = section.slice(2);
    }
    if (section.endsWith('\r\n')) {
      section = section.slice(0, -2);
    }

    const [rawHeaders, rawContent] = splitOnce(section, '\r\n\r\n');
    if (!rawHeaders || rawContent === undefined) {
      continue;
    }
    const headers = parseHeaders(rawHeaders);
    const disposition = headers['content-disposition'];
    if (!disposition) {
      continue;
    }
    const info = parseContentDisposition(disposition);
    const bufferContent = Buffer.from(stripTrailingNewlines(rawContent), 'binary');

    if (info.filename) {
      result.files.push({
        name: info.name,
        filename: info.filename,
        contentType: headers['content-type'] || 'application/octet-stream',
        buffer: bufferContent,
      });
    } else if (info.name) {
      result.fields[info.name] = bufferContent.toString('utf8');
    }
  }

  return result;
}

function splitOnce(source, delimiter) {
  const index = source.indexOf(delimiter);
  if (index === -1) {
    return [source];
  }
  return [source.slice(0, index), source.slice(index + delimiter.length)];
}

function parseHeaders(raw) {
  const headerLines = raw.split('\r\n');
  const headers = {};
  for (const line of headerLines) {
    const [key, value] = splitOnce(line, ':');
    if (value !== undefined) {
      headers[key.trim().toLowerCase()] = value.trim();
    }
  }
  return headers;
}

function parseContentDisposition(value) {
  const result = {};
  const parts = value.split(';').map((item) => item.trim());
  for (const part of parts) {
    const [key, val] = splitOnce(part, '=');
    if (val === undefined) {
      continue;
    }
    const cleaned = val.trim().replace(/^"|"$/g, '');
    if (key === 'name') {
      result.name = cleaned;
    } else if (key === 'filename') {
      result.filename = cleaned;
    }
  }
  return result;
}

function stripTrailingNewlines(value) {
  if (value.endsWith('\r\n')) {
    return value.slice(0, -2);
  }
  if (value.endsWith('\n') || value.endsWith('\r')) {
    return value.slice(0, -1);
  }
  return value;
}

function parseCsv(buffer) {
  const text = buffer.toString('utf8');
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char === '\r') {
      // ignore carriage returns
    } else {
      field += char;
    }
  }

  if (inQuotes) {
    throw new Error('Unterminated quote in CSV input');
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function parseXlsx(buffer) {
  const tempDir = fs.mkdtemp(path.join(os.tmpdir(), 'gift-upload-'));
  return tempDir.then(async (dir) => {
    const tempPath = path.join(dir, 'upload.xlsx');
    await fs.writeFile(tempPath, buffer);
    const result = spawnSync('python3', [XLSX_SCRIPT, tempPath], {
      encoding: 'utf8',
    });
    await fs.unlink(tempPath).catch(() => {});
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    if (result.error) {
      throw new Error(`Failed to parse XLSX file: ${result.error.message}`);
    }
    if (result.status !== 0) {
      throw new Error(result.stderr.trim() || 'Failed to parse XLSX file');
    }
    try {
      const rows = JSON.parse(result.stdout);
      if (!Array.isArray(rows)) {
        throw new Error('Invalid XLSX output');
      }
      return rows;
    } catch (error) {
      throw new Error(`Failed to parse XLSX rows: ${error.message}`);
    }
  });
}

function normalizeProducts(rows) {
  if (!rows || rows.length === 0) {
    throw new Error('The uploaded file is empty.');
  }

  if (!Array.isArray(rows[0]) || rows[0].length === 0) {
    throw new Error('The uploaded file must contain a header row.');
  }

  const headerRow = rows[0].map((cell) => String(cell || '').trim().toLowerCase());
  for (const required of REQUIRED_HEADERS) {
    if (!headerRow.includes(required)) {
      throw new Error(`Missing required column: ${required}`);
    }
  }

  const indexes = {};
  for (const header of [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS]) {
    const idx = headerRow.indexOf(header);
    indexes[header] = idx;
  }

  const items = [];
  const ids = new Set();
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || row.every((cell) => !cell || String(cell).trim() === '')) {
      continue;
    }

    const giftId = String(row[indexes.giftid] || '').trim();
    const name = String(row[indexes.name] || '').trim();
    const description = String(row[indexes.description] || '').trim();
    const categoryIndex = indexes.category;
    const category = categoryIndex >= 0 ? String(row[categoryIndex] || '').trim() : '';

    if (!giftId || !name || !description) {
      throw new Error(`Row ${i + 1} is missing one of the required fields (giftId, name, description).`);
    }

    if (ids.has(giftId)) {
      throw new Error(`Duplicate giftId detected: ${giftId}`);
    }

    ids.add(giftId);
    const product = { id: giftId, name, description };
    if (category) {
      product.category = category;
    }
    items.push(product);
  }

  if (items.length === 0) {
    throw new Error('No gift rows were found in the uploaded file.');
  }

  return items;
}

async function saveProducts(products) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(PRODUCTS_PATH, `${JSON.stringify(products, null, 2)}\n`, 'utf8');
}

async function handleProductsUpload(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
  if (!boundaryMatch) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing multipart boundary' }));
    return;
  }

  try {
    const bodyChunks = [];
    for await (const chunk of req) {
      bodyChunks.push(chunk);
    }
    const bodyBuffer = Buffer.concat(bodyChunks);
    const parsed = parseMultipart(bodyBuffer, boundaryMatch[1]);
    if (!parsed.files.length) {
      throw new Error('No file was provided.');
    }

    const file = parsed.files[0];
    const extension = (file.filename.split('.').pop() || '').toLowerCase();
    let rows;
    if (extension === 'csv') {
      rows = parseCsv(file.buffer);
    } else if (extension === 'xlsx') {
      rows = await parseXlsx(file.buffer);
    } else {
      throw new Error('Unsupported file format. Please upload a CSV or XLSX file.');
    }

    const products = normalizeProducts(rows);
    await saveProducts(products);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: `Successfully uploaded ${products.length} gifts.` }));
  } catch (error) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message || 'Failed to process file upload.' }));
  }
}

module.exports = {
  handleProductsUpload,
  normalizeProducts,
};

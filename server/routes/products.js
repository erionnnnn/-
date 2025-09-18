const fs = require('node:fs/promises');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const PRODUCTS_PATH = path.join(DATA_DIR, 'products.json');

async function readProducts() {
  try {
    const raw = await fs.readFile(PRODUCTS_PATH, 'utf8');
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

async function handleProducts(req, res) {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
    const products = await readProducts();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ products }));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to load products' }));
  }
}

module.exports = {
  handleProducts,
  readProducts,
};

const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');
const { handleProducts } = require('./routes/products');
const { handleProductsUpload } = require('./routes/productsUpload');
const { handleSubmission } = require('./routes/submissions');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function getContentType(extension) {
  switch (extension) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

async function serveStatic(req, res, pathname) {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method not allowed');
    return;
  }

  let requestedPath = pathname;
  if (requestedPath === '/') {
    requestedPath = '/index.html';
  } else if (requestedPath === '/admin') {
    requestedPath = '/admin.html';
  }

  const cleanedPath = requestedPath.startsWith('/') ? requestedPath.slice(1) : requestedPath;
  const filePath = path.join(PUBLIC_DIR, cleanedPath);
  const normalized = path.normalize(filePath);
  const relative = path.relative(PUBLIC_DIR, normalized);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  try {
    const data = await fs.readFile(normalized);
    const contentType = getContentType(path.extname(normalized));
    res.writeHead(200, { 'Content-Type': contentType });
    if (req.method === 'GET') {
      res.end(data);
    } else {
      res.end();
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    } else {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal server error');
    }
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (url.pathname === '/api/products') {
    await handleProducts(req, res);
    return;
  }

  if (url.pathname === '/api/admin/upload') {
    await handleProductsUpload(req, res);
    return;
  }

  if (url.pathname === '/api/submissions') {
    await handleSubmission(req, res);
    return;
  }

  await serveStatic(req, res, url.pathname);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Employee gifting survey server listening on port ${PORT}`);
});

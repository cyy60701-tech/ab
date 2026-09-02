const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const HOST = '0.0.0.0';
const ROOT = __dirname;

const allowedOrigins = ['http://127.0.0.1:8000', 'http://localhost:8000', 'http://0.0.0.0:8000'];

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  res.end(JSON.stringify(payload));
}

function isFileRequest(url) {
  return url && url !== '/' && !url.startsWith('/.netlify/functions/');
}

function serveStaticFile(url, res) {
  let reqPath = url === '/' ? '/index.html' : url;
  reqPath = reqPath.split('?')[0];
  const filePath = path.join(ROOT, reqPath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.txt': 'text/plain; charset=utf-8'
    };

    const cacheHeaders = {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0'
    };

    res.writeHead(200, cacheHeaders);
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    });
    res.end();
    return;
  }

  if (url.pathname === '/.netlify/functions/telegram') {
    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, error: 'Method not allowed' });
      return;
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const message = payload.message || payload.text || '';

        if (!message) {
          sendJson(res, 400, { ok: false, error: 'Message is required' });
          return;
        }

        const token = '8714454572:AAFInLxfuBjHpBQsj-houYfgV-OeuRcS8KQ';
        const chatId = '6025858761';

        const tgResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: payload.parseMode || 'HTML',
            disable_notification: Boolean(payload.disableNotification)
          })
        });

        const data = await tgResponse.json();

        if (!tgResponse.ok || !data.ok) {
          sendJson(res, 500, { ok: false, error: data?.description || 'Telegram send failed' });
          return;
        }

        sendJson(res, 200, { ok: true, result: data });
      } catch (error) {
        sendJson(res, 500, { ok: false, error: error.message || 'Telegram send failed' });
      }
    });
    return;
  }

  if (url.pathname.startsWith('/.netlify')) {
    sendJson(res, 404, { ok: false, error: 'Function not found' });
    return;
  }

  serveStaticFile(url.pathname, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Local server running at http://${HOST}:${PORT}`);
});

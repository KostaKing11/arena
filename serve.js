'use strict';
/* Sitni statični server za lokalno testiranje sajta iz docs/.
   GitHub Pages ionako servira te iste fajlove — ovo je samo da ih vidiš
   pre nego što gurneš na GitHub.   Pokretanje:  npm run dev              */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'docs');
const PORT = process.env.PORT || 3000;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('nope'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }).end('404'); return; }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file)] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(buf);
  });
}).listen(PORT, () => {
  const ips = Object.values(require('os').networkInterfaces()).flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log(`\n  ARENA (lokalno)\n  ───────────────`);
  console.log(`  http://localhost:${PORT}`);
  ips.forEach((ip) => console.log(`  http://${ip}:${PORT}`));
  console.log(`\n  Sa Firebase emulatorom:  http://localhost:${PORT}/?emu=1\n`);
});

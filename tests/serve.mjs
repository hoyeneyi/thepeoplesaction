// Minimal static server for tests (mirrors GitHub Pages: /dir/ -> index.html, unknown -> 404.html)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain', '.svg': 'image/svg+xml' };
export function serve(root, port = 0) {
  const server = createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = normalize(join(root, p));
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    try {
      let s = await stat(file);
      if (s.isDirectory()) {
        if (!p.endsWith('/')) { res.writeHead(301, { Location: p + '/' }).end(); return; }
        file = join(file, 'index.html'); await stat(file);
      }
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }).end(await readFile(file));
    } catch {
      res.writeHead(404, { 'Content-Type': TYPES['.html'] }).end(await readFile(join(root, '404.html')));
    }
  });
  return new Promise((r) => server.listen(port, '127.0.0.1', () => r({ server, url: `http://127.0.0.1:${server.address().port}` })));
}

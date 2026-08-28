/*
 * 8080 전용 정적 서빙 + API 프록시.
 * cloudflared 터널이 8080으로 가리키므로, 이 포트에서는 프론트엔드(dist/)를
 * 서빙하고 /api · /healthz 는 백엔드(기본 8082)로 프록시한다.
 *
 *   BACKEND=http://127.0.0.1:8082 PORT=8080 node serve-static.mjs
 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const PORT = Number(process.env.PORT ?? 8080);
const BACKEND = process.env.BACKEND ?? 'http://127.0.0.1:8082';
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
};

function proxy(req, res) {
  const target = new URL(BACKEND);
  const opts = {
    hostname: target.hostname,
    port: target.port,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: target.host },
  };
  const up = http.request(opts, (upRes) => {
    res.writeHead(upRes.statusCode ?? 502, upRes.headers);
    upRes.pipe(res);
  });
  up.on('error', (err) => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: `백엔드 연결 실패: ${err.message}` }));
  });
  req.pipe(up);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  if (url.pathname.startsWith('/api/') || url.pathname === '/healthz') {
    return proxy(req, res);
  }
  let file = path.normalize(path.join(root, url.pathname === '/' ? 'index.html' : url.pathname));
  if (!file.startsWith(root)) {
    res.writeHead(403);
    return res.end('forbidden');
  }
  try {
    const st = await stat(file);
    if (st.isDirectory()) file = path.join(file, 'index.html');
  } catch {
    file = path.join(root, 'index.html'); // SPA fallback
  }
  try {
    const body = await readFile(file);
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'content-type': MIME[ext] ?? 'application/octet-stream',
      'content-length': body.length,
      'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`static server on :${PORT} (root=${root}, api -> ${BACKEND})`);
});

/**
 * Servidor de desenvolvimento LOCAL apenas — simula o roteamento de funções
 * serverless da Vercel (api/**) servindo também os arquivos estáticos de
 * public/. Não é usado em produção (lá quem roteia é a própria Vercel).
 */
require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROUTES = [
  { pattern: /^\/api\/auth\/login$/, file: 'api/auth/login.js' },
  { pattern: /^\/api\/auth\/logout$/, file: 'api/auth/logout.js' },
  { pattern: /^\/api\/auth\/me$/, file: 'api/auth/me.js' },
  { pattern: /^\/api\/grupos$/, file: 'api/grupos/index.js' },
  { pattern: /^\/api\/empresas$/, file: 'api/empresas/index.js' },
  { pattern: /^\/api\/empresas\/([^/]+)$/, file: 'api/empresas/[id].js', param: 'id' },
  { pattern: /^\/api\/usuarios$/, file: 'api/usuarios/index.js' },
  { pattern: /^\/api\/usuarios\/([^/]+)$/, file: 'api/usuarios/[id].js', param: 'id' },
  { pattern: /^\/api\/papeis$/, file: 'api/papeis/index.js' },
  { pattern: /^\/api\/papeis\/([^/]+)$/, file: 'api/papeis/[id].js', param: 'id' },
  { pattern: /^\/api\/permissoes$/, file: 'api/permissoes/index.js' },
  { pattern: /^\/api\/claude\/messages$/, file: 'api/claude/messages.js' }
];

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      if (!data) { resolve({}); return; }
      try { resolve(JSON.parse(data)); } catch (e) { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  for (const route of ROUTES) {
    const match = pathname.match(route.pattern);
    if (match) {
      req.body = await readBody(req);
      req.query = { ...parsed.query };
      if (route.param) req.query[route.param] = match[1];

      res.status = (code) => { res.statusCode = code; return res; };
      res.json = (obj) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); };

      try {
        delete require.cache[require.resolve('./' + route.file)];
        const handler = require('./' + route.file);
        await handler(req, res);
      } catch (e) {
        console.error(e);
        res.status(500).json({ error: { message: 'Erro interno: ' + e.message } });
      }
      return;
    }
  }

  // arquivos estáticos de public/
  let filePath = path.join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
  const ext = path.extname(filePath);
  const type = ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : 'text/plain';
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(filePath).pipe(res);
});

const PORT = process.env.DEV_PORT || 3050;
server.listen(PORT, () => console.log(`Dev server rodando em http://localhost:${PORT}`));

/**
 * Autenticação e autorização.
 * - Senhas: bcrypt (nunca armazenadas em texto puro).
 * - Sessão: JWT assinado, guardado em cookie httpOnly (o navegador não
 *   consegue ler via JS — reduz risco de roubo de sessão por XSS).
 * - Toda checagem de permissão acontece no SERVIDOR. O frontend pode
 *   esconder botões por conveniência, mas quem decide de verdade é a API.
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = 'session';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dias

function assertSecret() {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET não definida nas variáveis de ambiente.');
  }
}

async function hashPassword(senha) {
  return bcrypt.hash(senha, 10);
}
async function verifyPassword(senha, hash) {
  return bcrypt.compare(senha, hash);
}

function signSessionToken(usuario) {
  assertSecret();
  return jwt.sign(
    { sub: usuario.id, grupoId: usuario.grupo_id, email: usuario.email },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL_SECONDS }
  );
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    out[key] = decodeURIComponent(val);
  });
  return out;
}

function setSessionCookie(res, token) {
  const isProd = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${TOKEN_TTL_SECONDS}`
  ];
  if (isProd) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0`);
}

/** Decodifica o usuário autenticado a partir do cookie da requisição, ou null. */
function getSessionFromRequest(req) {
  assertSecret();
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET); // { sub, grupoId, email, iat, exp }
  } catch (e) {
    return null;
  }
}

/** Carrega o usuário completo (com papéis e permissões efetivas) a partir da sessão. */
async function loadUsuarioCompleto(usuarioId) {
  const { rows } = await query(
    `SELECT u.id, u.nome, u.email, u.ativo, u.grupo_id, g.nome AS grupo_nome
     FROM usuarios u JOIN grupos_empresa g ON g.id = u.grupo_id
     WHERE u.id = $1`,
    [usuarioId]
  );
  const usuario = rows[0];
  if (!usuario) return null;

  const papeisResult = await query(
    `SELECT p.id, p.nome FROM papeis p
     JOIN usuario_papeis up ON up.papel_id = p.id
     WHERE up.usuario_id = $1`,
    [usuarioId]
  );
  const permissoesResult = await query(
    `SELECT DISTINCT perm.chave FROM permissoes perm
     JOIN papel_permissoes pp ON pp.permissao_id = perm.id
     JOIN usuario_papeis up ON up.papel_id = pp.papel_id
     WHERE up.usuario_id = $1`,
    [usuarioId]
  );
  const empresasResult = await query(
    `SELECT empresa_id FROM usuario_empresas WHERE usuario_id = $1`,
    [usuarioId]
  );

  return {
    ...usuario,
    papeis: papeisResult.rows,
    permissoes: permissoesResult.rows.map(r => r.chave),
    // lista vazia = sem restrição específica = acessa todas as empresas do grupo (gestão agregada)
    empresasRestritas: empresasResult.rows.map(r => r.empresa_id)
  };
}

/**
 * Middleware de autenticação para handlers do estilo Vercel (req, res).
 * Uso: module.exports = requireAuth(async (req, res, usuario) => {...})
 */
function requireAuth(handler) {
  return async (req, res) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      res.status(401).json({ error: { message: 'Não autenticado.' } });
      return;
    }
    const usuario = await loadUsuarioCompleto(session.sub);
    if (!usuario || !usuario.ativo) {
      res.status(401).json({ error: { message: 'Sessão inválida ou usuário inativo.' } });
      return;
    }
    return handler(req, res, usuario);
  };
}

/** Igual a requireAuth, mas também exige uma permissão específica. */
function requirePermission(chave, handler) {
  return requireAuth(async (req, res, usuario) => {
    if (!usuario.permissoes.includes(chave)) {
      res.status(403).json({ error: { message: `Permissão negada: ${chave}` } });
      return;
    }
    return handler(req, res, usuario);
  });
}

module.exports = {
  hashPassword, verifyPassword, signSessionToken,
  setSessionCookie, clearSessionCookie, getSessionFromRequest,
  loadUsuarioCompleto, requireAuth, requirePermission
};

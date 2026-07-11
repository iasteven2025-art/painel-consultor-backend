const { query } = require('../../lib/db');
const { verifyPassword, signSessionToken, setSessionCookie, loadUsuarioCompleto } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Método não permitido.' } });
    return;
  }
  const { email, senha } = req.body || {};
  if (!email || !senha) {
    res.status(400).json({ error: { message: 'Informe e-mail e senha.' } });
    return;
  }

  const { rows } = await query('SELECT * FROM usuarios WHERE email=$1', [email.toLowerCase().trim()]);
  const usuario = rows[0];
  // Mensagem genérica de propósito — não revela se o e-mail existe ou não.
  const credenciaisInvalidas = () => res.status(401).json({ error: { message: 'E-mail ou senha inválidos.' } });

  if (!usuario) { credenciaisInvalidas(); return; }
  if (!usuario.ativo) { res.status(403).json({ error: { message: 'Usuário inativo. Contate o administrador do grupo.' } }); return; }

  const ok = await verifyPassword(senha, usuario.senha_hash);
  if (!ok) { credenciaisInvalidas(); return; }

  const token = signSessionToken(usuario);
  setSessionCookie(res, token);

  const completo = await loadUsuarioCompleto(usuario.id);
  res.status(200).json({ usuario: completo });
};

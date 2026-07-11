const { query } = require('../../../lib/db');
const { verifyPassword, signPlatformToken, setPlatformSessionCookie } = require('../../../lib/auth');

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

  const { rows } = await query('SELECT * FROM admins_plataforma WHERE email=$1', [email.toLowerCase().trim()]);
  const admin = rows[0];
  const credenciaisInvalidas = () => res.status(401).json({ error: { message: 'E-mail ou senha inválidos.' } });

  if (!admin) { credenciaisInvalidas(); return; }
  if (!admin.ativo) { res.status(403).json({ error: { message: 'Acesso de plataforma desativado.' } }); return; }

  const ok = await verifyPassword(senha, admin.senha_hash);
  if (!ok) { credenciaisInvalidas(); return; }

  const token = signPlatformToken(admin);
  setPlatformSessionCookie(res, token);
  res.status(200).json({ admin: { id: admin.id, nome: admin.nome, email: admin.email } });
};

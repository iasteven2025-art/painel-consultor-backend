const { query } = require('../../lib/db');
const { requireAuth } = require('../../lib/auth');

module.exports = requireAuth(async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: { message: 'Método não permitido.' } });
    return;
  }
  const { rows } = await query('SELECT chave, modulo, descricao FROM permissoes ORDER BY modulo, chave');
  res.status(200).json({ permissoes: rows });
});

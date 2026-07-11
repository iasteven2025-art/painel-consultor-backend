const { query } = require('../../lib/db');
const { requireAuth, requirePermission } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    return requireAuth(async (req, res, usuario) => {
      const { rows } = await query('SELECT * FROM grupos_empresa WHERE id=$1', [usuario.grupo_id]);
      res.status(200).json({ grupo: rows[0] || null });
    })(req, res);
  }

  if (req.method === 'PUT') {
    return requirePermission('empresas.gerenciar', async (req, res, usuario) => {
      const { nome } = req.body || {};
      if (!nome || !nome.trim()) {
        res.status(400).json({ error: { message: 'Informe o nome do grupo.' } });
        return;
      }
      const { rows } = await query(
        'UPDATE grupos_empresa SET nome=$1 WHERE id=$2 RETURNING *',
        [nome.trim(), usuario.grupo_id]
      );
      res.status(200).json({ grupo: rows[0] });
    })(req, res);
  }

  res.status(405).json({ error: { message: 'Método não permitido.' } });
};

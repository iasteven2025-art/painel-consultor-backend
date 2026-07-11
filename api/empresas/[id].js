const { query } = require('../../lib/db');
const { requireAuth, requirePermission } = require('../../lib/auth');

function getId(req) {
  // Vercel injeta req.query.id para rotas dinâmicas [id].js
  return req.query && req.query.id;
}

module.exports = async (req, res) => {
  const id = getId(req);

  if (req.method === 'GET') {
    return requireAuth(async (req, res, usuario) => {
      const { rows } = await query(
        'SELECT * FROM empresas WHERE id=$1 AND grupo_id=$2',
        [id, usuario.grupo_id]
      );
      if (!rows[0]) { res.status(404).json({ error: { message: 'Empresa não encontrada.' } }); return; }
      res.status(200).json({ empresa: rows[0] });
    })(req, res);
  }

  if (req.method === 'PUT') {
    return requirePermission('empresas.gerenciar', async (req, res, usuario) => {
      // Confirma que a empresa pertence ao grupo do usuário ANTES de alterar —
      // nunca confiar apenas no id vindo da URL.
      const existente = await query('SELECT id FROM empresas WHERE id=$1 AND grupo_id=$2', [id, usuario.grupo_id]);
      if (!existente.rows[0]) { res.status(404).json({ error: { message: 'Empresa não encontrada.' } }); return; }

      const { nome, cnpj, endereco, corPrimaria, logoBase64, logoMime, carimboBase64, carimboMime } = req.body || {};
      const { rows } = await query(
        `UPDATE empresas SET
           nome = COALESCE($1, nome),
           cnpj = COALESCE($2, cnpj),
           endereco = COALESCE($3, endereco),
           cor_primaria = COALESCE($4, cor_primaria),
           logo_base64 = COALESCE($5, logo_base64),
           logo_mime = COALESCE($6, logo_mime),
           carimbo_base64 = COALESCE($7, carimbo_base64),
           carimbo_mime = COALESCE($8, carimbo_mime)
         WHERE id=$9 AND grupo_id=$10
         RETURNING *`,
        [nome, cnpj, endereco, corPrimaria, logoBase64, logoMime, carimboBase64, carimboMime, id, usuario.grupo_id]
      );
      res.status(200).json({ empresa: rows[0] });
    })(req, res);
  }

  if (req.method === 'DELETE') {
    return requirePermission('empresas.gerenciar', async (req, res, usuario) => {
      const { rowCount } = await query('DELETE FROM empresas WHERE id=$1 AND grupo_id=$2', [id, usuario.grupo_id]);
      if (!rowCount) { res.status(404).json({ error: { message: 'Empresa não encontrada.' } }); return; }
      res.status(200).json({ ok: true });
    })(req, res);
  }

  res.status(405).json({ error: { message: 'Método não permitido.' } });
};

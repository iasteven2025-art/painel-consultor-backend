const { query } = require('../../../lib/db');
const { requirePlatformAuth } = require('../../../lib/auth');

function getId(req) { return req.query && req.query.id; }

module.exports = requirePlatformAuth(async (req, res, admin) => {
  const id = getId(req);

  if (req.method === 'GET') {
    const { rows } = await query(
      `SELECT g.*, p.nome AS plano_nome FROM grupos_empresa g
       LEFT JOIN planos_faturamento p ON p.id = g.plano_id WHERE g.id=$1`,
      [id]
    );
    if (!rows[0]) { res.status(404).json({ error: { message: 'Grupo não encontrado.' } }); return; }
    res.status(200).json({ grupo: rows[0] });
    return;
  }

  if (req.method === 'PUT') {
    const { nome, planoId, status, observacoes } = req.body || {};
    const validStatus = ['ativo', 'trial', 'suspenso', 'cancelado'];
    if (status && !validStatus.includes(status)) {
      res.status(400).json({ error: { message: 'Status inválido.' } });
      return;
    }
    const { rows } = await query(
      `UPDATE grupos_empresa SET
         nome = COALESCE($1, nome),
         plano_id = COALESCE($2, plano_id),
         status = COALESCE($3, status),
         observacoes = COALESCE($4, observacoes)
       WHERE id=$5 RETURNING *`,
      [nome, planoId, status, observacoes, id]
    );
    if (!rows[0]) { res.status(404).json({ error: { message: 'Grupo não encontrado.' } }); return; }
    res.status(200).json({ grupo: rows[0] });
    return;
  }

  if (req.method === 'DELETE') {
    const { rowCount } = await query('DELETE FROM grupos_empresa WHERE id=$1', [id]);
    if (!rowCount) { res.status(404).json({ error: { message: 'Grupo não encontrado.' } }); return; }
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: { message: 'Método não permitido.' } });
});

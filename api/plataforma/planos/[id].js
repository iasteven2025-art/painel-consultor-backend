const { query } = require('../../../lib/db');
const { requirePlatformAuth } = require('../../../lib/auth');

function getId(req) { return req.query && req.query.id; }

module.exports = requirePlatformAuth(async (req, res, admin) => {
  const id = getId(req);

  if (req.method === 'PUT') {
    const { nome, descricao, valorMensal, limiteUsuarios, limiteEmpresas, ativo } = req.body || {};
    const { rows } = await query(
      `UPDATE planos_faturamento SET
         nome = COALESCE($1, nome),
         descricao = COALESCE($2, descricao),
         valor_mensal = COALESCE($3, valor_mensal),
         limite_usuarios = COALESCE($4, limite_usuarios),
         limite_empresas = COALESCE($5, limite_empresas),
         ativo = COALESCE($6, ativo)
       WHERE id=$7 RETURNING *`,
      [nome, descricao, valorMensal, limiteUsuarios, limiteEmpresas, ativo, id]
    );
    if (!rows[0]) { res.status(404).json({ error: { message: 'Plano não encontrado.' } }); return; }
    res.status(200).json({ plano: rows[0] });
    return;
  }

  if (req.method === 'DELETE') {
    const { rowCount } = await query('DELETE FROM planos_faturamento WHERE id=$1', [id]);
    if (!rowCount) { res.status(404).json({ error: { message: 'Plano não encontrado.' } }); return; }
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: { message: 'Método não permitido.' } });
});

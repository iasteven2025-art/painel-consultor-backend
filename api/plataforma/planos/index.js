const { query } = require('../../../lib/db');
const { requirePlatformAuth } = require('../../../lib/auth');

module.exports = requirePlatformAuth(async (req, res, admin) => {
  if (req.method === 'GET') {
    const { rows } = await query('SELECT * FROM planos_faturamento ORDER BY valor_mensal NULLS FIRST');
    res.status(200).json({ planos: rows });
    return;
  }

  if (req.method === 'POST') {
    const { nome, descricao, valorMensal, limiteUsuarios, limiteEmpresas } = req.body || {};
    if (!nome || !nome.trim()) {
      res.status(400).json({ error: { message: 'Informe o nome do plano.' } });
      return;
    }
    const { rows } = await query(
      `INSERT INTO planos_faturamento (nome, descricao, valor_mensal, limite_usuarios, limite_empresas)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [nome.trim(), descricao ?? null, valorMensal ?? null, limiteUsuarios ?? null, limiteEmpresas ?? null]
    );
    res.status(201).json({ plano: rows[0] });
    return;
  }

  res.status(405).json({ error: { message: 'Método não permitido.' } });
});

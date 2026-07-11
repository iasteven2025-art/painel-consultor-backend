const { query } = require('../../lib/db');
const { requireAuth, requirePermission } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    return requireAuth(async (req, res, usuario) => {
      const { busca, regiao } = req.query || {};
      let sql = 'SELECT * FROM clientes WHERE grupo_id=$1';
      const params = [usuario.grupo_id];
      if (busca) {
        params.push(`%${busca}%`);
        sql += ` AND (nome_completo ILIKE $${params.length} OR municipio ILIKE $${params.length})`;
      }
      if (regiao) {
        params.push(regiao);
        sql += ` AND regiao = $${params.length}`;
      }
      sql += ' ORDER BY nome_abreviado NULLS LAST, nome_completo';
      const { rows } = await query(sql, params);
      res.status(200).json({ clientes: rows });
    })(req, res);
  }

  if (req.method === 'POST') {
    return requirePermission('clientes.editar', async (req, res, usuario) => {
      const { nomeCompleto, nomeAbreviado, municipio, regiao, populacao, dominio, observacoes, contatos } = req.body || {};
      if (!nomeCompleto || !nomeCompleto.trim()) {
        res.status(400).json({ error: { message: 'Informe o nome do cliente.' } });
        return;
      }
      const { rows } = await query(
        `INSERT INTO clientes (grupo_id, nome_completo, nome_abreviado, municipio, regiao, populacao, dominio, observacoes, contatos)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [
          usuario.grupo_id, nomeCompleto.trim(), nomeAbreviado || null, municipio || null,
          regiao || null, populacao || null, dominio || null, observacoes || null,
          JSON.stringify(contatos || [])
        ]
      );
      res.status(201).json({ cliente: rows[0] });
    })(req, res);
  }

  res.status(405).json({ error: { message: 'Método não permitido.' } });
};

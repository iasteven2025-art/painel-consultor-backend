const { query } = require('../../lib/db');
const { requireAuth, requirePermission } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    return requireAuth(async (req, res, usuario) => {
      let sql = 'SELECT * FROM empresas WHERE grupo_id=$1';
      const params = [usuario.grupo_id];
      // Se o usuário tiver acesso restrito a empresas específicas, filtra.
      // Lista vazia = sem restrição = vê todas as empresas do grupo (gestão agregada).
      if (usuario.empresasRestritas.length) {
        sql += ' AND id = ANY($2)';
        params.push(usuario.empresasRestritas);
      }
      sql += ' ORDER BY nome';
      const { rows } = await query(sql, params);
      res.status(200).json({ empresas: rows });
    })(req, res);
  }

  if (req.method === 'POST') {
    return requirePermission('empresas.gerenciar', async (req, res, usuario) => {
      const { nome, cnpj, endereco, corPrimaria } = req.body || {};
      if (!nome || !nome.trim()) {
        res.status(400).json({ error: { message: 'Informe a razão social.' } });
        return;
      }
      const { rows } = await query(
        `INSERT INTO empresas (grupo_id, nome, cnpj, endereco, cor_primaria)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [usuario.grupo_id, nome.trim(), cnpj || null, endereco || null, corPrimaria || '#1F6FB2']
      );
      res.status(201).json({ empresa: rows[0] });
    })(req, res);
  }

  res.status(405).json({ error: { message: 'Método não permitido.' } });
};

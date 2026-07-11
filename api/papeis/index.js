const { query } = require('../../lib/db');
const { requireAuth, requirePermission } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    return requireAuth(async (req, res, usuario) => {
      // Papéis globais do sistema (grupo_id NULL) + papéis específicos deste grupo.
      const { rows } = await query(
        `SELECT p.id, p.nome, p.descricao, (p.grupo_id IS NULL) AS padrao_sistema,
                COALESCE(json_agg(perm.chave) FILTER (WHERE perm.chave IS NOT NULL), '[]') AS permissoes
         FROM papeis p
         LEFT JOIN papel_permissoes pp ON pp.papel_id = p.id
         LEFT JOIN permissoes perm ON perm.id = pp.permissao_id
         WHERE p.grupo_id IS NULL OR p.grupo_id = $1
         GROUP BY p.id
         ORDER BY padrao_sistema DESC, p.nome`,
        [usuario.grupo_id]
      );
      res.status(200).json({ papeis: rows });
    })(req, res);
  }

  if (req.method === 'POST') {
    return requirePermission('usuarios.gerenciar', async (req, res, usuario) => {
      const { nome, descricao, permissoesChaves } = req.body || {};
      if (!nome || !nome.trim()) { res.status(400).json({ error: { message: 'Informe o nome do papel.' } }); return; }

      const { rows } = await query(
        'INSERT INTO papeis (grupo_id, nome, descricao) VALUES ($1,$2,$3) RETURNING id, nome, descricao',
        [usuario.grupo_id, nome.trim(), descricao || null]
      );
      const papel = rows[0];

      if (Array.isArray(permissoesChaves) && permissoesChaves.length) {
        const permsResult = await query('SELECT id, chave FROM permissoes WHERE chave = ANY($1)', [permissoesChaves]);
        for (const perm of permsResult.rows) {
          await query('INSERT INTO papel_permissoes (papel_id, permissao_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [papel.id, perm.id]);
        }
      }
      res.status(201).json({ papel });
    })(req, res);
  }

  res.status(405).json({ error: { message: 'Método não permitido.' } });
};

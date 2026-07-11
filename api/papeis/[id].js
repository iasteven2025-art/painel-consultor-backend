const { query } = require('../../lib/db');
const { requirePermission } = require('../../lib/auth');

function getId(req) { return req.query && req.query.id; }

module.exports = async (req, res) => {
  const id = getId(req);

  if (req.method === 'PUT') {
    return requirePermission('usuarios.gerenciar', async (req, res, usuario) => {
      // Só permite editar papéis do próprio grupo — papéis padrão do sistema
      // (grupo_id NULL) são somente leitura, para não quebrar outros grupos.
      const existente = await query('SELECT id FROM papeis WHERE id=$1 AND grupo_id=$2', [id, usuario.grupo_id]);
      if (!existente.rows[0]) {
        res.status(404).json({ error: { message: 'Papel não encontrado ou é um papel padrão do sistema (não editável).' } });
        return;
      }

      const { nome, descricao, permissoesChaves } = req.body || {};
      await query('UPDATE papeis SET nome=COALESCE($1,nome), descricao=COALESCE($2,descricao) WHERE id=$3', [nome, descricao, id]);

      if (Array.isArray(permissoesChaves)) {
        await query('DELETE FROM papel_permissoes WHERE papel_id=$1', [id]);
        const permsResult = await query('SELECT id, chave FROM permissoes WHERE chave = ANY($1)', [permissoesChaves]);
        for (const perm of permsResult.rows) {
          await query('INSERT INTO papel_permissoes (papel_id, permissao_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, perm.id]);
        }
      }
      const { rows } = await query('SELECT id, nome, descricao FROM papeis WHERE id=$1', [id]);
      res.status(200).json({ papel: rows[0] });
    })(req, res);
  }

  if (req.method === 'DELETE') {
    return requirePermission('usuarios.gerenciar', async (req, res, usuario) => {
      const { rowCount } = await query('DELETE FROM papeis WHERE id=$1 AND grupo_id=$2', [id, usuario.grupo_id]);
      if (!rowCount) {
        res.status(404).json({ error: { message: 'Papel não encontrado ou é um papel padrão do sistema (não excluível).' } });
        return;
      }
      res.status(200).json({ ok: true });
    })(req, res);
  }

  res.status(405).json({ error: { message: 'Método não permitido.' } });
};

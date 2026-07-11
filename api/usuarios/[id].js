const { query } = require('../../lib/db');
const { requireAuth, requirePermission, hashPassword } = require('../../lib/auth');

function getId(req) { return req.query && req.query.id; }

module.exports = async (req, res) => {
  const id = getId(req);

  if (req.method === 'GET') {
    return requireAuth(async (req, res, usuario) => {
      const { rows } = await query('SELECT id, nome, email, ativo, criado_em FROM usuarios WHERE id=$1 AND grupo_id=$2', [id, usuario.grupo_id]);
      if (!rows[0]) { res.status(404).json({ error: { message: 'Usuário não encontrado.' } }); return; }
      const papeis = await query(
        `SELECT p.id, p.nome FROM papeis p JOIN usuario_papeis up ON up.papel_id=p.id WHERE up.usuario_id=$1`,
        [id]
      );
      res.status(200).json({ usuario: { ...rows[0], papeis: papeis.rows } });
    })(req, res);
  }

  if (req.method === 'PUT') {
    return requirePermission('usuarios.gerenciar', async (req, res, usuarioLogado) => {
      const existente = await query('SELECT id FROM usuarios WHERE id=$1 AND grupo_id=$2', [id, usuarioLogado.grupo_id]);
      if (!existente.rows[0]) { res.status(404).json({ error: { message: 'Usuário não encontrado.' } }); return; }

      const { nome, ativo, senha, papeisIds } = req.body || {};
      let senhaHash = null;
      if (senha) {
        if (senha.length < 8) { res.status(400).json({ error: { message: 'A senha deve ter ao menos 8 caracteres.' } }); return; }
        senhaHash = await hashPassword(senha);
      }
      const { rows } = await query(
        `UPDATE usuarios SET
           nome = COALESCE($1, nome),
           ativo = COALESCE($2, ativo),
           senha_hash = COALESCE($3, senha_hash)
         WHERE id=$4 AND grupo_id=$5
         RETURNING id, nome, email, ativo`,
        [nome, ativo, senhaHash, id, usuarioLogado.grupo_id]
      );

      if (Array.isArray(papeisIds)) {
        await query('DELETE FROM usuario_papeis WHERE usuario_id=$1', [id]);
        for (const papelId of papeisIds) {
          await query('INSERT INTO usuario_papeis (usuario_id, papel_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, papelId]);
        }
      }
      res.status(200).json({ usuario: rows[0] });
    })(req, res);
  }

  if (req.method === 'DELETE') {
    return requirePermission('usuarios.gerenciar', async (req, res, usuarioLogado) => {
      if (id === usuarioLogado.id) {
        res.status(400).json({ error: { message: 'Você não pode excluir seu próprio usuário.' } });
        return;
      }
      const { rowCount } = await query('DELETE FROM usuarios WHERE id=$1 AND grupo_id=$2', [id, usuarioLogado.grupo_id]);
      if (!rowCount) { res.status(404).json({ error: { message: 'Usuário não encontrado.' } }); return; }
      res.status(200).json({ ok: true });
    })(req, res);
  }

  res.status(405).json({ error: { message: 'Método não permitido.' } });
};

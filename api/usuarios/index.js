const { query } = require('../../lib/db');
const { requireAuth, requirePermission, hashPassword } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    return requireAuth(async (req, res, usuario) => {
      const { rows } = await query(
        `SELECT u.id, u.nome, u.email, u.ativo, u.criado_em,
                COALESCE(json_agg(json_build_object('id', p.id, 'nome', p.nome)) FILTER (WHERE p.id IS NOT NULL), '[]') AS papeis
         FROM usuarios u
         LEFT JOIN usuario_papeis up ON up.usuario_id = u.id
         LEFT JOIN papeis p ON p.id = up.papel_id
         WHERE u.grupo_id = $1
         GROUP BY u.id
         ORDER BY u.nome`,
        [usuario.grupo_id]
      );
      res.status(200).json({ usuarios: rows });
    })(req, res);
  }

  if (req.method === 'POST') {
    return requirePermission('usuarios.gerenciar', async (req, res, usuario) => {
      const { nome, email, senha, papeisIds } = req.body || {};
      if (!nome || !email || !senha) {
        res.status(400).json({ error: { message: 'Informe nome, e-mail e senha.' } });
        return;
      }
      if (senha.length < 8) {
        res.status(400).json({ error: { message: 'A senha deve ter ao menos 8 caracteres.' } });
        return;
      }
      const senhaHash = await hashPassword(senha);
      let novoUsuario;
      try {
        const { rows } = await query(
          `INSERT INTO usuarios (grupo_id, nome, email, senha_hash) VALUES ($1,$2,$3,$4) RETURNING id, nome, email, ativo`,
          [usuario.grupo_id, nome.trim(), email.toLowerCase().trim(), senhaHash]
        );
        novoUsuario = rows[0];
      } catch (e) {
        if (e.code === '23505') { res.status(409).json({ error: { message: 'Já existe um usuário com este e-mail.' } }); return; }
        throw e;
      }

      if (Array.isArray(papeisIds)) {
        for (const papelId of papeisIds) {
          await query('INSERT INTO usuario_papeis (usuario_id, papel_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [novoUsuario.id, papelId]);
        }
      }
      res.status(201).json({ usuario: novoUsuario });
    })(req, res);
  }

  res.status(405).json({ error: { message: 'Método não permitido.' } });
};

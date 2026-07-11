const { query, getClient } = require('../../../lib/db');
const { requirePlatformAuth, hashPassword } = require('../../../lib/auth');

module.exports = requirePlatformAuth(async (req, res, admin) => {
  if (req.method === 'GET') {
    const { rows } = await query(
      `SELECT g.*, p.nome AS plano_nome, p.valor_mensal,
              (SELECT count(*) FROM usuarios u WHERE u.grupo_id = g.id) AS total_usuarios,
              (SELECT count(*) FROM empresas e WHERE e.grupo_id = g.id) AS total_empresas
       FROM grupos_empresa g
       LEFT JOIN planos_faturamento p ON p.id = g.plano_id
       ORDER BY g.criado_em DESC`
    );
    res.status(200).json({ grupos: rows });
    return;
  }

  if (req.method === 'POST') {
    const { nomeGrupo, planoId, status, adminNome, adminEmail, adminSenha } = req.body || {};
    if (!nomeGrupo || !nomeGrupo.trim()) {
      res.status(400).json({ error: { message: 'Informe o nome do grupo.' } });
      return;
    }
    if (!adminNome || !adminEmail || !adminSenha) {
      res.status(400).json({ error: { message: 'Informe nome, e-mail e senha do administrador principal deste grupo.' } });
      return;
    }
    if (adminSenha.length < 8) {
      res.status(400).json({ error: { message: 'A senha do administrador deve ter ao menos 8 caracteres.' } });
      return;
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const grupoResult = await client.query(
        `INSERT INTO grupos_empresa (nome, plano_id, status) VALUES ($1,$2,$3) RETURNING *`,
        [nomeGrupo.trim(), planoId || null, status || 'trial']
      );
      const grupo = grupoResult.rows[0];

      const senhaHash = await hashPassword(adminSenha);
      let usuario;
      try {
        const usuarioResult = await client.query(
          `INSERT INTO usuarios (grupo_id, nome, email, senha_hash) VALUES ($1,$2,$3,$4) RETURNING id, nome, email`,
          [grupo.id, adminNome.trim(), adminEmail.toLowerCase().trim(), senhaHash]
        );
        usuario = usuarioResult.rows[0];
      } catch (e) {
        if (e.code === '23505') { throw Object.assign(new Error('Já existe um usuário com este e-mail em outro grupo.'), { status: 409 }); }
        throw e;
      }

      const papelAdmin = await client.query(`SELECT id FROM papeis WHERE nome='Administrador' AND grupo_id IS NULL`);
      if (papelAdmin.rows[0]) {
        await client.query(
          `INSERT INTO usuario_papeis (usuario_id, papel_id) VALUES ($1,$2)`,
          [usuario.id, papelAdmin.rows[0].id]
        );
      }

      await client.query('COMMIT');
      res.status(201).json({ grupo, adminPrincipal: usuario });
    } catch (e) {
      await client.query('ROLLBACK');
      res.status(e.status || 500).json({ error: { message: e.message || 'Erro ao criar grupo.' } });
    } finally {
      client.release();
    }
    return;
  }

  res.status(405).json({ error: { message: 'Método não permitido.' } });
});

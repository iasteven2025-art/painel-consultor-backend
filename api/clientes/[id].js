const { query } = require('../../lib/db');
const { requireAuth, requirePermission } = require('../../lib/auth');

function getId(req) { return req.query && req.query.id; }

module.exports = async (req, res) => {
  const id = getId(req);

  if (req.method === 'GET') {
    return requireAuth(async (req, res, usuario) => {
      const { rows } = await query('SELECT * FROM clientes WHERE id=$1 AND grupo_id=$2', [id, usuario.grupo_id]);
      if (!rows[0]) { res.status(404).json({ error: { message: 'Cliente não encontrado.' } } ); return; }
      res.status(200).json({ cliente: rows[0] });
    })(req, res);
  }

  if (req.method === 'PUT') {
    return requirePermission('clientes.editar', async (req, res, usuario) => {
      const existente = await query('SELECT id FROM clientes WHERE id=$1 AND grupo_id=$2', [id, usuario.grupo_id]);
      if (!existente.rows[0]) { res.status(404).json({ error: { message: 'Cliente não encontrado.' } }); return; }

      const { nomeCompleto, nomeAbreviado, municipio, regiao, populacao, dominio, observacoes, contatos } = req.body || {};
      const { rows } = await query(
        `UPDATE clientes SET
           nome_completo = COALESCE($1, nome_completo),
           nome_abreviado = COALESCE($2, nome_abreviado),
           municipio = COALESCE($3, municipio),
           regiao = COALESCE($4, regiao),
           populacao = COALESCE($5, populacao),
           dominio = COALESCE($6, dominio),
           observacoes = COALESCE($7, observacoes),
           contatos = COALESCE($8, contatos),
           atualizado_em = now()
         WHERE id=$9 AND grupo_id=$10
         RETURNING *`,
        [
          nomeCompleto, nomeAbreviado, municipio, regiao, populacao, dominio, observacoes,
          contatos ? JSON.stringify(contatos) : null,
          id, usuario.grupo_id
        ]
      );
      res.status(200).json({ cliente: rows[0] });
    })(req, res);
  }

  if (req.method === 'DELETE') {
    return requirePermission('clientes.excluir', async (req, res, usuario) => {
      const { rowCount } = await query('DELETE FROM clientes WHERE id=$1 AND grupo_id=$2', [id, usuario.grupo_id]);
      if (!rowCount) { res.status(404).json({ error: { message: 'Cliente não encontrado.' } }); return; }
      res.status(200).json({ ok: true });
    })(req, res);
  }

  res.status(405).json({ error: { message: 'Método não permitido.' } });
};

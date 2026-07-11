/**
 * Popula o banco com dados iniciais: catálogo de permissões, papéis padrão,
 * o Grupo Actcon com suas duas empresas, e um usuário administrador.
 * Idempotente — pode ser rodado mais de uma vez sem duplicar nada.
 *
 * Uso: npm run seed
 * Variáveis opcionais: SEED_ADMIN_EMAIL, SEED_ADMIN_SENHA, SEED_ADMIN_NOME
 */
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const PERMISSOES = [
  ['dashboard.ver', 'Dashboard', 'Ver painel de controle'],
  ['clientes.ver', 'Clientes', 'Ver clientes'],
  ['clientes.editar', 'Clientes', 'Criar e editar clientes'],
  ['clientes.excluir', 'Clientes', 'Excluir clientes'],
  ['contratos.ver', 'Contratos', 'Ver contratos'],
  ['contratos.editar', 'Contratos', 'Criar e editar contratos'],
  ['contratos.excluir', 'Contratos', 'Excluir contratos'],
  ['licitacoes.ver', 'Licitações', 'Ver licitações'],
  ['licitacoes.editar', 'Licitações', 'Criar e editar licitações'],
  ['propostas.ver', 'Propostas', 'Ver propostas'],
  ['propostas.editar', 'Propostas', 'Criar e editar propostas'],
  ['documentos.ver', 'Documentos', 'Ver documentos da empresa'],
  ['documentos.editar', 'Documentos', 'Enviar e editar documentos da empresa'],
  ['produtos.ver', 'Produtos', 'Ver catálogo de produtos e serviços'],
  ['produtos.editar', 'Produtos', 'Editar catálogo de produtos e serviços'],
  ['comissoes.ver', 'Comissões', 'Ver comissões e extratos'],
  ['comissoes.editar', 'Comissões', 'Editar simulações e tabela de preços'],
  ['agenda.ver', 'Agenda', 'Ver agenda e roteiros'],
  ['agenda.editar', 'Agenda', 'Criar e editar compromissos e roteiros'],
  ['descritivos.ver', 'Descritivos Técnicos', 'Ver ETP/DFD/TR'],
  ['descritivos.editar', 'Descritivos Técnicos', 'Criar e editar ETP/DFD/TR'],
  ['regioes.ver', 'Regiões', 'Ver regiões e consultores'],
  ['regioes.editar', 'Regiões', 'Editar regiões e consultores'],
  ['relatorios.ver', 'Relatórios', 'Ver relatórios gerenciais'],
  ['empresas.gerenciar', 'Administração', 'Gerenciar empresas do grupo'],
  ['usuarios.gerenciar', 'Administração', 'Gerenciar usuários, papéis e permissões']
];

const PAPEIS_PADRAO = {
  'Administrador': { descricao: 'Acesso completo a todos os módulos e à administração do grupo.', permissoes: '*' },
  'Consultor': {
    descricao: 'Acesso operacional aos módulos do dia a dia, sem administração de usuários.',
    permissoes: [
      'dashboard.ver','clientes.ver','clientes.editar','contratos.ver','contratos.editar',
      'licitacoes.ver','licitacoes.editar','propostas.ver','propostas.editar',
      'documentos.ver','documentos.editar','produtos.ver','agenda.ver','agenda.editar',
      'descritivos.ver','descritivos.editar','regioes.ver','comissoes.ver','relatorios.ver'
    ]
  },
  'Financeiro': {
    descricao: 'Foco em comissões, contratos e relatórios.',
    permissoes: ['dashboard.ver','comissoes.ver','comissoes.editar','contratos.ver','clientes.ver','relatorios.ver']
  },
  'Visualizador': {
    descricao: 'Acesso somente leitura a todos os módulos.',
    permissoes: [
      'dashboard.ver','clientes.ver','contratos.ver','licitacoes.ver','propostas.ver',
      'documentos.ver','produtos.ver','comissoes.ver','agenda.ver','descritivos.ver',
      'regioes.ver','relatorios.ver'
    ]
  }
};

async function main() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error('Defina POSTGRES_URL no .env antes de rodar o seed.');
    process.exit(1);
  }
  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  // 1) Permissões
  for (const [chave, modulo, descricao] of PERMISSOES) {
    await pool.query(
      `INSERT INTO permissoes (chave, modulo, descricao) VALUES ($1,$2,$3)
       ON CONFLICT (chave) DO NOTHING`,
      [chave, modulo, descricao]
    );
  }
  console.log(`Permissões OK (${PERMISSOES.length} no catálogo).`);

  // 2) Papéis padrão (globais, grupo_id NULL) + vínculo de permissões
  const todasPermissoes = await pool.query('SELECT id, chave FROM permissoes');
  for (const [nome, def] of Object.entries(PAPEIS_PADRAO)) {
    let papelId;
    const existente = await pool.query('SELECT id FROM papeis WHERE nome=$1 AND grupo_id IS NULL', [nome]);
    if (existente.rows.length) {
      papelId = existente.rows[0].id;
    } else {
      const inserted = await pool.query(
        'INSERT INTO papeis (grupo_id, nome, descricao) VALUES (NULL,$1,$2) RETURNING id',
        [nome, def.descricao]
      );
      papelId = inserted.rows[0].id;
    }
    const chavesDesejadas = def.permissoes === '*' ? todasPermissoes.rows.map(r => r.chave) : def.permissoes;
    for (const chave of chavesDesejadas) {
      const perm = todasPermissoes.rows.find(r => r.chave === chave);
      if (!perm) continue;
      await pool.query(
        'INSERT INTO papel_permissoes (papel_id, permissao_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [papelId, perm.id]
      );
    }
  }
  console.log('Papéis padrão OK (Administrador, Consultor, Financeiro, Visualizador).');

  // 3) Grupo Actcon + empresas
  let grupoId;
  const grupoExistente = await pool.query('SELECT id FROM grupos_empresa WHERE nome=$1', ['Grupo Actcon']);
  if (grupoExistente.rows.length) {
    grupoId = grupoExistente.rows[0].id;
  } else {
    const g = await pool.query('INSERT INTO grupos_empresa (nome) VALUES ($1) RETURNING id', ['Grupo Actcon']);
    grupoId = g.rows[0].id;
  }
  console.log('Grupo Actcon OK.');

  const empresas = [
    { nome: 'Actcon Soluções Web S/A', cnpj: '07.051.313/0001-18' },
    { nome: 'Portal Soluções Ltda', cnpj: '23.456.789/0001-01' }
  ];
  for (const emp of empresas) {
    const existente = await pool.query('SELECT id FROM empresas WHERE nome=$1 AND grupo_id=$2', [emp.nome, grupoId]);
    if (!existente.rows.length) {
      await pool.query(
        'INSERT INTO empresas (grupo_id, nome, cnpj, cor_primaria) VALUES ($1,$2,$3,$4)',
        [grupoId, emp.nome, emp.cnpj, '#1F6FB2']
      );
    }
  }
  console.log('Empresas do grupo OK.');

  // 4) Usuário administrador inicial
  const email = process.env.SEED_ADMIN_EMAIL || 'steven.passos@actcon.com.br';
  const senha = process.env.SEED_ADMIN_SENHA || 'trocar123';
  const nome = process.env.SEED_ADMIN_NOME || 'Steven Oliveira Passos';

  let usuarioId;
  const usuarioExistente = await pool.query('SELECT id FROM usuarios WHERE email=$1', [email]);
  if (usuarioExistente.rows.length) {
    usuarioId = usuarioExistente.rows[0].id;
    console.log(`Usuário admin já existia (${email}).`);
  } else {
    const senhaHash = await bcrypt.hash(senha, 10);
    const u = await pool.query(
      'INSERT INTO usuarios (grupo_id, nome, email, senha_hash) VALUES ($1,$2,$3,$4) RETURNING id',
      [grupoId, nome, email, senhaHash]
    );
    usuarioId = u.rows[0].id;
    console.log(`Usuário admin criado: ${email} / senha inicial: ${senha}`);
    console.log('IMPORTANTE: troque essa senha no primeiro acesso.');
  }

  const papelAdmin = await pool.query('SELECT id FROM papeis WHERE nome=$1 AND grupo_id IS NULL', ['Administrador']);
  if (papelAdmin.rows.length) {
    await pool.query(
      'INSERT INTO usuario_papeis (usuario_id, papel_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [usuarioId, papelAdmin.rows[0].id]
    );
  }
  console.log('Papel Administrador vinculado ao usuário inicial.');

  // 5) Planos de faturamento padrão
  const planosDefault = [
    { nome: 'Básico', descricao: 'Até 3 usuários, 1 empresa.', valor: 297.00, limiteUsuarios: 3, limiteEmpresas: 1 },
    { nome: 'Profissional', descricao: 'Até 10 usuários, 5 empresas.', valor: 697.00, limiteUsuarios: 10, limiteEmpresas: 5 },
    { nome: 'Enterprise', descricao: 'Usuários e empresas ilimitados.', valor: 1497.00, limiteUsuarios: null, limiteEmpresas: null }
  ];
  for (const p of planosDefault) {
    const existente = await pool.query('SELECT id FROM planos_faturamento WHERE nome=$1', [p.nome]);
    if (!existente.rows.length) {
      await pool.query(
        'INSERT INTO planos_faturamento (nome, descricao, valor_mensal, limite_usuarios, limite_empresas) VALUES ($1,$2,$3,$4,$5)',
        [p.nome, p.descricao, p.valor, p.limiteUsuarios, p.limiteEmpresas]
      );
    }
  }
  console.log('Planos de faturamento padrão OK (Básico, Profissional, Enterprise).');

  // Vincula o Grupo Actcon (o seu próprio grupo, vendedor da plataforma) ao plano Enterprise e status ativo
  const planoEnterprise = await pool.query("SELECT id FROM planos_faturamento WHERE nome='Enterprise'");
  if (planoEnterprise.rows.length) {
    await pool.query("UPDATE grupos_empresa SET plano_id=$1, status='ativo' WHERE id=$2 AND plano_id IS NULL", [planoEnterprise.rows[0].id, grupoId]);
  }

  // 6) Administrador da plataforma (você e sua equipe interna — diferente do admin do Grupo Actcon)
  const platformEmail = process.env.SEED_PLATFORM_EMAIL || email;
  const platformSenha = process.env.SEED_PLATFORM_SENHA || senha;
  const platformNome = process.env.SEED_PLATFORM_NOME || nome;

  const platformExistente = await pool.query('SELECT id FROM admins_plataforma WHERE email=$1', [platformEmail]);
  if (platformExistente.rows.length) {
    console.log(`Administrador de plataforma já existia (${platformEmail}).`);
  } else {
    const platformSenhaHash = await bcrypt.hash(platformSenha, 10);
    await pool.query(
      'INSERT INTO admins_plataforma (nome, email, senha_hash) VALUES ($1,$2,$3)',
      [platformNome, platformEmail, platformSenhaHash]
    );
    console.log(`Administrador de plataforma criado: ${platformEmail} / senha inicial: ${platformSenha}`);
    console.log('Este login é separado do login de usuário do Grupo Actcon — acesse via /plataforma.');
  }

  await pool.end();
  console.log('\nSeed concluído com sucesso.');
}

main().catch(err => {
  console.error('Erro ao popular o banco:', err);
  process.exit(1);
});

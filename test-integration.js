/**
 * Teste manual de integração — simula requisições HTTP chamando os handlers
 * Vercel diretamente, contra um Postgres real. Não faz parte do deploy.
 */
require('dotenv').config();

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
    setHeader(k, v) { this.headers[k] = v; }
  };
  return res;
}
function mockReq({ method = 'GET', body = {}, cookie = null, query = {} } = {}) {
  return { method, body, headers: cookie ? { cookie } : {}, query };
}
function extractCookie(res) {
  const setCookie = res.headers['Set-Cookie'];
  if (!setCookie) return null;
  return setCookie.split(';')[0]; // "session=xxxx"
}
function assert(cond, label) {
  console.log((cond ? '✅ PASS' : '❌ FAIL') + ' — ' + label);
  if (!cond) process.exitCode = 1;
}

async function main() {
  const login = require('./api/auth/login');
  const me = require('./api/auth/me');
  const logout = require('./api/auth/logout');
  const empresasIndex = require('./api/empresas/index');
  const empresaDetail = require('./api/empresas/[id]');
  const usuariosIndex = require('./api/usuarios/index');
  const usuarioDetail = require('./api/usuarios/[id]');
  const papeisIndex = require('./api/papeis/index');
  const permissoesIndex = require('./api/permissoes/index');

  console.log('\n--- 1) Login com senha errada deve falhar ---');
  let res = mockRes();
  await login(mockReq({ method: 'POST', body: { email: 'steven.passos@actcon.com.br', senha: 'senhaerrada' } }), res);
  assert(res.statusCode === 401, 'login com senha errada retorna 401');

  console.log('\n--- 2) Login correto ---');
  res = mockRes();
  await login(mockReq({ method: 'POST', body: { email: 'steven.passos@actcon.com.br', senha: 'trocar123' } }), res);
  assert(res.statusCode === 200, 'login correto retorna 200');
  assert(res.body.usuario.permissoes.includes('usuarios.gerenciar'), 'usuário admin tem permissão usuarios.gerenciar');
  const cookieAdmin = extractCookie(res);
  assert(!!cookieAdmin, 'cookie de sessão foi setado');

  console.log('\n--- 3) /me com cookie válido ---');
  res = mockRes();
  await me(mockReq({ cookie: cookieAdmin }), res);
  assert(res.statusCode === 200 && res.body.usuario.email === 'steven.passos@actcon.com.br', '/me retorna o usuário correto');

  console.log('\n--- 4) /me sem cookie deve falhar ---');
  res = mockRes();
  await me(mockReq({}), res);
  assert(res.statusCode === 401, '/me sem cookie retorna 401');

  console.log('\n--- 5) Listar empresas do grupo (deve ter 2: Actcon + Portal) ---');
  res = mockRes();
  await empresasIndex(mockReq({ cookie: cookieAdmin }), res);
  assert(res.statusCode === 200 && res.body.empresas.length === 2, 'lista 2 empresas do Grupo Actcon');
  const empresaId = res.body.empresas[0].id;

  console.log('\n--- 6) Criar novo usuário (Consultor) ---');
  const papeisRes1 = mockRes();
  await papeisIndex(mockReq({ cookie: cookieAdmin }), papeisRes1);
  const papelConsultor = papeisRes1.body.papeis.find(p => p.nome === 'Consultor');
  assert(!!papelConsultor, 'papel Consultor existe na lista');

  res = mockRes();
  await usuariosIndex(mockReq({
    method: 'POST', cookie: cookieAdmin,
    body: { nome: 'Maria Consultora', email: 'maria@actcon.com.br', senha: 'senhaSegura123', papeisIds: [papelConsultor.id] }
  }), res);
  assert(res.statusCode === 201, 'novo usuário criado com sucesso');
  const novoUsuarioId = res.body.usuario.id;

  console.log('\n--- 7) Login do novo usuário (Consultor) ---');
  res = mockRes();
  await login(mockReq({ method: 'POST', body: { email: 'maria@actcon.com.br', senha: 'senhaSegura123' } }), res);
  assert(res.statusCode === 200, 'consultora consegue logar');
  const cookieConsultora = extractCookie(res);
  assert(!res.body.usuario.permissoes.includes('usuarios.gerenciar'), 'consultora NÃO tem permissão usuarios.gerenciar');
  assert(res.body.usuario.permissoes.includes('clientes.editar'), 'consultora TEM permissão clientes.editar');

  console.log('\n--- 8) Consultora tentando criar usuário deve ser barrada (403) ---');
  res = mockRes();
  await usuariosIndex(mockReq({
    method: 'POST', cookie: cookieConsultora,
    body: { nome: 'Outro', email: 'outro@actcon.com.br', senha: 'senha12345' }
  }), res);
  assert(res.statusCode === 403, 'consultora recebe 403 ao tentar criar usuário (sem permissão)');

  console.log('\n--- 9) Consultora consegue LER empresas (permissão implícita via requireAuth) ---');
  res = mockRes();
  await empresasIndex(mockReq({ cookie: cookieConsultora }), res);
  assert(res.statusCode === 200 && res.body.empresas.length === 2, 'consultora lê as 2 empresas do mesmo grupo');

  console.log('\n--- 10) Isolamento multi-tenant: criar 2º grupo com outro usuário, garantir que não vê dados do Grupo Actcon ---');
  const { Pool } = require('pg');
  const bcrypt = require('bcryptjs');
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  const grupo2 = await pool.query("INSERT INTO grupos_empresa (nome) VALUES ('Grupo Concorrente') RETURNING id");
  const grupo2Id = grupo2.rows[0].id;
  await pool.query("INSERT INTO empresas (grupo_id, nome) VALUES ($1, 'Empresa Rival Ltda')", [grupo2Id]);
  const senhaHash2 = await bcrypt.hash('outraSenha123', 10);
  await pool.query(
    'INSERT INTO usuarios (grupo_id, nome, email, senha_hash) VALUES ($1,$2,$3,$4)',
    [grupo2Id, 'Usuário Rival', 'rival@concorrente.com', senhaHash2]
  );

  res = mockRes();
  await login(mockReq({ method: 'POST', body: { email: 'rival@concorrente.com', senha: 'outraSenha123' } }), res);
  const cookieRival = extractCookie(res);
  assert(res.statusCode === 200, 'usuário do Grupo Concorrente consegue logar');

  res = mockRes();
  await empresasIndex(mockReq({ cookie: cookieRival }), res);
  assert(res.body.empresas.length === 1 && res.body.empresas[0].nome === 'Empresa Rival Ltda', 'usuário rival só vê a empresa do PRÓPRIO grupo');

  console.log('\n--- 11) Tentativa de acessar empresa de OUTRO grupo diretamente pelo ID deve dar 404 ---');
  res = mockRes();
  await empresaDetail(mockReq({ cookie: cookieRival, query: { id: empresaId } }), res); // empresaId é do Grupo Actcon
  assert(res.statusCode === 404, 'usuário rival NÃO consegue acessar empresa de outro grupo (retorna 404, não vaza dado)');

  console.log('\n--- 12) Logout limpa o cookie ---');
  res = mockRes();
  await logout(mockReq({ method: 'POST' }), res);
  assert(res.statusCode === 200 && res.headers['Set-Cookie'].includes('Max-Age=0'), 'logout limpa o cookie de sessão');

  console.log('\n--- 13) Catálogo de permissões acessível a qualquer usuário autenticado ---');
  res = mockRes();
  await permissoesIndex(mockReq({ cookie: cookieConsultora }), res);
  assert(res.statusCode === 200 && res.body.permissoes.length === 26, 'catálogo de permissões retorna as 26 permissões');

  console.log('\n--- 14) Clientes: criar, listar, isolar por grupo ---');
  const clientesIndex = require('./api/clientes/index');
  const clienteDetail = require('./api/clientes/[id]');

  // precisa logar de novo como admin, pois o cookieAdmin do teste 12 (logout) foi invalidado
  res = mockRes();
  await login(mockReq({ method: 'POST', body: { email: 'steven.passos@actcon.com.br', senha: 'trocar123' } }), res);
  const cookieAdmin2 = extractCookie(res);

  res = mockRes();
  await clientesIndex(mockReq({
    method: 'POST', cookie: cookieAdmin2,
    body: { nomeCompleto: 'Prefeitura Municipal de Ipatinga', nomeAbreviado: 'PM Ipatinga', municipio: 'Ipatinga', regiao: 'Vale do Aço', populacao: 250000, contatos: [{ id: '1', nome: 'Fulano', principal: true }] }
  }), res);
  assert(res.statusCode === 201, 'cliente criado com sucesso');
  const clienteId = res.body.cliente.id;
  assert(res.body.cliente.contatos.length === 1, 'contatos (JSONB) salvos corretamente');

  res = mockRes();
  await clientesIndex(mockReq({ cookie: cookieAdmin2, query: { busca: 'Ipatinga' } }), res);
  assert(res.body.clientes.length === 1, 'busca por nome/município encontra o cliente criado');

  res = mockRes();
  await clienteDetail(mockReq({ method: 'PUT', cookie: cookieAdmin2, query: { id: clienteId }, body: { populacao: 260000 } }), res);
  assert(res.body.cliente.populacao === 260000, 'atualização parcial (PUT) funciona sem apagar os outros campos');
  assert(res.body.cliente.nome_completo === 'Prefeitura Municipal de Ipatinga', 'campos não enviados permanecem intactos');

  res = mockRes();
  await clienteDetail(mockReq({ cookie: cookieRival, query: { id: clienteId } }), res);
  assert(res.statusCode === 404, 'usuário de outro grupo não acessa o cliente pelo ID direto');

  res = mockRes();
  await clientesIndex(mockReq({ cookie: cookieConsultora, method: 'POST', body: { nomeCompleto: 'Teste sem permissão' } }), res);
  assert(res.statusCode === 201, 'consultora (papel com clientes.editar) consegue criar cliente');

  res = mockRes();
  await clienteDetail(mockReq({ method: 'DELETE', cookie: cookieAdmin2, query: { id: clienteId } }), res);
  assert(res.statusCode === 200, 'exclusão de cliente funciona');

  console.log('\n--- 15) Plataforma: login de admin de plataforma é separado do login de usuário de grupo ---');
  const platformLogin = require('./api/plataforma/auth/login');
  const platformMe = require('./api/plataforma/auth/me');
  const gruposPlataforma = require('./api/plataforma/grupos/index');
  const planosPlataforma = require('./api/plataforma/planos/index');

  res = mockRes();
  await platformLogin(mockReq({ method: 'POST', body: { email: 'steven.passos@actcon.com.br', senha: 'trocar123' } }), res);
  assert(res.statusCode === 200, 'login de plataforma funciona com o mesmo e-mail/senha do seed');
  const cookiePlataforma = extractCookie(res);

  res = mockRes();
  await platformMe(mockReq({ cookie: cookiePlataforma }), res);
  assert(res.statusCode === 200, '/api/plataforma/auth/me retorna o admin autenticado');

  res = mockRes();
  await gruposPlataforma(mockReq({ cookie: cookieAdmin2 }), res); // cookie de USUÁRIO comum, não de plataforma
  assert(res.statusCode === 401, 'usuário comum (sessão de grupo) NÃO acessa rotas de plataforma com seu cookie');

  console.log('\n--- 16) Plataforma: criar novo grupo cliente + admin principal em uma transação ---');
  res = mockRes();
  await planosPlataforma(mockReq({ cookie: cookiePlataforma }), res);
  const planoProfissional = res.body.planos.find(p => p.nome === 'Profissional');

  res = mockRes();
  await gruposPlataforma(mockReq({
    method: 'POST', cookie: cookiePlataforma,
    body: { nomeGrupo: 'Cliente Teste LTDA', planoId: planoProfissional.id, status: 'trial', adminNome: 'Admin Teste', adminEmail: 'admin@clienteteste.com.br', adminSenha: 'senhaForte123' }
  }), res);
  assert(res.statusCode === 201, 'grupo cliente criado com sucesso');
  assert(res.body.adminPrincipal.email === 'admin@clienteteste.com.br', 'administrador principal criado junto, na mesma transação');

  res = mockRes();
  await login(mockReq({ method: 'POST', body: { email: 'admin@clienteteste.com.br', senha: 'senhaForte123' } }), res);
  assert(res.statusCode === 200, 'administrador principal do novo grupo consegue logar normalmente');
  assert(res.body.usuario.permissoes.includes('usuarios.gerenciar'), 'administrador principal já nasce com papel Administrador completo');
  const cookieNovoCliente = extractCookie(res);

  res = mockRes();
  await empresasIndex(mockReq({ cookie: cookieNovoCliente }), res);
  assert(res.body.empresas.length === 0, 'novo grupo começa isolado, sem nenhuma empresa do Grupo Actcon');

  console.log('\n--- 17) Plataforma: valor de plano igual a zero não deve virar null (bug corrigido) ---');
  res = mockRes();
  await planosPlataforma(mockReq({ method: 'POST', cookie: cookiePlataforma, body: { nome: 'Gratuito Teste', valorMensal: 0, limiteUsuarios: 1, limiteEmpresas: 1 } }), res);
  assert(res.statusCode === 201 && Number(res.body.plano.valor_mensal) === 0, 'plano com valor mensal 0 é salvo como 0, não como null');

  await pool.end();
  console.log('\n' + (process.exitCode ? 'ALGUM TESTE FALHOU' : 'TODOS OS TESTES PASSARAM'));
}

main().catch(e => { console.error(e); process.exit(1); });

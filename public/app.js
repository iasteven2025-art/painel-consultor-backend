/* ============================================================
   Backoffice — Painel do Consultor
   Login + Gestão de Empresas, Usuários e Papéis/Permissões
   ============================================================ */
const API = ''; // mesmo domínio (funções serverless em /api/...)
let usuarioAtual = null;
let activeSection = 'clientes';
let permissoesCatalogo = [];

async function apiFetch(path, options = {}) {
  const resp = await fetch(API + path, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error((data.error && data.error.message) || `Erro ${resp.status}`);
  return data;
}

function toast(msg, kind) {
  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ' ' + kind : '');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

/* ---------------- Login ---------------- */
async function fazerLogin() {
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  const errorEl = document.getElementById('login-error');
  errorEl.style.display = 'none';
  if (!email || !senha) { errorEl.textContent = 'Informe e-mail e senha.'; errorEl.style.display = 'block'; return; }

  const btn = document.getElementById('login-btn');
  btn.disabled = true; btn.textContent = 'Entrando...';
  try {
    const data = await apiFetch('/api/auth/login', { method: 'POST', body: { email, senha } });
    usuarioAtual = data.usuario;
    iniciarApp();
  } catch (e) {
    errorEl.textContent = e.message;
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = 'Entrar';
  }
}
async function fazerLogout() {
  await apiFetch('/api/auth/logout', { method: 'POST' });
  usuarioAtual = null;
  document.getElementById('app-shell').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}
document.getElementById('login-senha').addEventListener('keydown', e => { if (e.key === 'Enter') fazerLogin(); });

/* ---------------- Shell / navegação ---------------- */
const SECOES = [
  { id: 'clientes', label: 'Clientes', permissao: 'clientes.ver' },
  { id: 'empresas', label: 'Empresas do Grupo', permissao: null },
  { id: 'usuarios', label: 'Usuários', permissao: 'usuarios.gerenciar' },
  { id: 'papeis', label: 'Papéis e Permissões', permissao: 'usuarios.gerenciar' }
];
const REGIOES_PADRAO = ['Zona da Mata','Vale do Rio Doce','Vale do Aço','Norte de Minas','Sul de Minas','Central Mineira','Triângulo Mineiro','Espírito Santo','Não informada'];

function iniciarApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-shell').style.display = 'flex';
  renderSidebar();
  renderTopbar();
  renderContent();
}
function renderSidebar() {
  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = SECOES
    .filter(s => !s.permissao || usuarioAtual.permissoes.includes(s.permissao))
    .map(s => `<div class="nav-item ${activeSection===s.id?'active':''}" onclick="irPara('${s.id}')">${s.label}</div>`)
    .join('');
}
function renderTopbar() {
  document.getElementById('topbar').innerHTML = `
    <div style="font-size:13px;color:var(--text-muted)">${usuarioAtual.grupo_nome}</div>
    <div style="display:flex;align-items:center;gap:12px">
      <div style="text-align:right">
        <div style="font-size:13px;font-weight:600">${usuarioAtual.nome}</div>
        <div style="font-size:11.5px;color:var(--text-muted)">${(usuarioAtual.papeis||[]).map(p=>p.nome).join(', ')}</div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="fazerLogout()">Sair</button>
    </div>
  `;
}
function irPara(secao) { activeSection = secao; renderSidebar(); renderContent(); }

async function renderContent() {
  const el = document.getElementById('content');
  el.innerHTML = '<div class="empty-state">Carregando...</div>';
  try {
    if (activeSection === 'clientes') await renderClientes(el);
    else if (activeSection === 'empresas') await renderEmpresas(el);
    else if (activeSection === 'usuarios') await renderUsuarios(el);
    else if (activeSection === 'papeis') await renderPapeis(el);
  } catch (e) {
    el.innerHTML = `<div class="empty-state" style="color:var(--danger)">${e.message}</div>`;
  }
}

/* ---------------- Clientes ---------------- */
let clientesFiltro = { busca: '', regiao: '' };
let clienteContatosTemp = [];

async function renderClientes(el) {
  const params = new URLSearchParams();
  if (clientesFiltro.busca) params.set('busca', clientesFiltro.busca);
  if (clientesFiltro.regiao) params.set('regiao', clientesFiltro.regiao);
  const { clientes } = await apiFetch('/api/clientes?' + params.toString());
  const podeEditar = usuarioAtual.permissoes.includes('clientes.editar');
  const podeExcluir = usuarioAtual.permissoes.includes('clientes.excluir');

  el.innerHTML = `
    <div class="page-header-row">
      <div><h1 class="page-title">Clientes</h1><div class="page-subtitle">Órgãos públicos atendidos pelo ${usuarioAtual.grupo_nome}</div></div>
      ${podeEditar ? `<button class="btn btn-primary btn-sm" onclick="abrirModalCliente()">+ Novo Cliente</button>` : ''}
    </div>
    <div style="display:flex;gap:10px;margin-bottom:16px">
      <input id="f-busca" placeholder="Buscar por nome ou município..." value="${clientesFiltro.busca}" style="flex:1;padding:9px 12px;border:1px solid var(--border-strong);border-radius:8px" onkeydown="if(event.key==='Enter') aplicarFiltroClientes()">
      <select id="f-regiao-filtro" style="padding:9px 12px;border:1px solid var(--border-strong);border-radius:8px" onchange="aplicarFiltroClientes()">
        <option value="">Todas as regiões</option>
        ${REGIOES_PADRAO.map(r => `<option value="${r}" ${clientesFiltro.regiao===r?'selected':''}>${r}</option>`).join('')}
      </select>
      <button class="btn btn-ghost btn-sm" onclick="aplicarFiltroClientes()">Buscar</button>
    </div>
    ${clientes.map(c => `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:600">${c.nome_abreviado || c.nome_completo}</div>
            <div style="font-size:12.5px;color:var(--text-muted)">${c.municipio || ''}${c.regiao ? ' · ' + c.regiao : ''}${c.populacao ? ' · ' + Number(c.populacao).toLocaleString('pt-BR') + ' hab.' : ''}</div>
            ${(c.contatos||[]).length ? `<div style="margin-top:6px;font-size:12px;color:var(--text-muted)">${(c.contatos||[]).map(ct=>ct.nome).join(', ')}</div>` : ''}
          </div>
          <div class="row-actions">
            ${podeEditar ? `<button class="btn btn-ghost btn-sm" onclick='abrirModalCliente(${JSON.stringify(c).replace(/'/g,"&apos;")})'>Editar</button>` : ''}
            ${podeExcluir ? `<button class="btn btn-danger-ghost btn-sm" onclick="excluirCliente('${c.id}')">Excluir</button>` : ''}
          </div>
        </div>
      </div>
    `).join('') || '<div class="empty-state">Nenhum cliente encontrado.</div>'}
  `;
}
function aplicarFiltroClientes() {
  clientesFiltro.busca = document.getElementById('f-busca').value.trim();
  clientesFiltro.regiao = document.getElementById('f-regiao-filtro').value;
  renderContent();
}

function abrirModalCliente(cliente) {
  const editing = !!cliente;
  clienteContatosTemp = editing ? (cliente.contatos || []).map(c => ({ ...c })) : [];
  const bodyHtml = () => `
    <div class="form-field"><label>Razão social / nome completo</label><input id="m-nome-completo" value="${editing?cliente.nome_completo:''}" placeholder="Ex: Prefeitura Municipal de Ipatinga"></div>
    <div class="form-field"><label>Nome abreviado</label><input id="m-nome-abrev" value="${editing?(cliente.nome_abreviado||''):''}" placeholder="Ex: PM Ipatinga"></div>
    <div class="form-field"><label>Município</label><input id="m-municipio" value="${editing?(cliente.municipio||''):''}"></div>
    <div class="form-field"><label>Região</label>
      <select id="m-regiao">
        <option value="">Selecione...</option>
        ${REGIOES_PADRAO.map(r => `<option value="${r}" ${editing && cliente.regiao===r?'selected':''}>${r}</option>`).join('')}
      </select>
    </div>
    <div class="form-field"><label>População estimada</label><input id="m-populacao" type="number" value="${editing?(cliente.populacao||''):''}"></div>
    <div class="form-field"><label>Domínio (site)</label><input id="m-dominio" value="${editing?(cliente.dominio||''):''}" placeholder="municipio.mg.gov.br"></div>
    <div class="form-field"><label>Observações</label><input id="m-observacoes" value="${editing?(cliente.observacoes||''):''}"></div>
    <div class="form-field">
      <label>Contatos</label>
      <div id="contatos-lista"></div>
      <button type="button" class="btn btn-ghost btn-sm" onclick="adicionarContatoTemp()" style="margin-top:6px">+ Adicionar contato</button>
    </div>
  `;
  abrirModal(editing ? 'Editar Cliente' : 'Novo Cliente', bodyHtml(), async () => {
    const body = {
      nomeCompleto: document.getElementById('m-nome-completo').value.trim(),
      nomeAbreviado: document.getElementById('m-nome-abrev').value.trim(),
      municipio: document.getElementById('m-municipio').value.trim(),
      regiao: document.getElementById('m-regiao').value,
      populacao: parseInt(document.getElementById('m-populacao').value) || null,
      dominio: document.getElementById('m-dominio').value.trim(),
      observacoes: document.getElementById('m-observacoes').value.trim(),
      contatos: clienteContatosTemp
    };
    if (!body.nomeCompleto) { toast('Informe o nome do cliente', 'danger'); return false; }
    if (editing) await apiFetch(`/api/clientes/${cliente.id}`, { method: 'PUT', body });
    else await apiFetch('/api/clientes', { method: 'POST', body });
    toast('Cliente salvo com sucesso', 'success');
    renderContent();
    return true;
  });
  renderContatosTemp();
}
function renderContatosTemp() {
  const el = document.getElementById('contatos-lista');
  if (!el) return;
  el.innerHTML = clienteContatosTemp.map((ct, i) => `
    <div style="display:flex;gap:6px;margin-bottom:6px;align-items:center">
      <input placeholder="Nome" value="${ct.nome||''}" oninput="clienteContatosTemp[${i}].nome=this.value" style="flex:2;padding:7px 9px;border:1px solid var(--border-strong);border-radius:6px;font-size:12.5px">
      <input placeholder="E-mail" value="${ct.email||''}" oninput="clienteContatosTemp[${i}].email=this.value" style="flex:2;padding:7px 9px;border:1px solid var(--border-strong);border-radius:6px;font-size:12.5px">
      <input placeholder="Telefone" value="${ct.telefone||''}" oninput="clienteContatosTemp[${i}].telefone=this.value" style="flex:1;padding:7px 9px;border:1px solid var(--border-strong);border-radius:6px;font-size:12.5px">
      <button type="button" class="btn btn-danger-ghost btn-sm" onclick="removerContatoTemp(${i})">✕</button>
    </div>
  `).join('') || '<div style="font-size:12px;color:var(--text-muted)">Nenhum contato adicionado</div>';
}
function adicionarContatoTemp() {
  clienteContatosTemp.push({ id: 'c' + Date.now(), nome: '', email: '', telefone: '', principal: clienteContatosTemp.length === 0 });
  renderContatosTemp();
}
function removerContatoTemp(i) {
  clienteContatosTemp.splice(i, 1);
  renderContatosTemp();
}
async function excluirCliente(id) {
  if (!confirm('Excluir este cliente?')) return;
  try { await apiFetch(`/api/clientes/${id}`, { method: 'DELETE' }); toast('Cliente excluído', 'success'); renderContent(); }
  catch (e) { toast(e.message, 'danger'); }
}

/* ---------------- Empresas ---------------- */
async function renderEmpresas(el) {
  const { empresas } = await apiFetch('/api/empresas');
  const podeGerenciar = usuarioAtual.permissoes.includes('empresas.gerenciar');
  el.innerHTML = `
    <div class="page-header-row">
      <div><h1 class="page-title">Empresas do Grupo</h1><div class="page-subtitle">Gestão agregada de todas as empresas do ${usuarioAtual.grupo_nome}</div></div>
      ${podeGerenciar ? `<button class="btn btn-primary btn-sm" onclick="abrirModalEmpresa()">+ Nova Empresa</button>` : ''}
    </div>
    ${empresas.map(e => `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:600">${e.nome}</div>
            <div style="font-size:12.5px;color:var(--text-muted)">${e.cnpj || 'CNPJ não informado'}</div>
          </div>
          ${podeGerenciar ? `<div class="row-actions">
            <button class="btn btn-ghost btn-sm" onclick='abrirModalEmpresa(${JSON.stringify(e).replace(/'/g,"&apos;")})'>Editar</button>
            <button class="btn btn-danger-ghost btn-sm" onclick="excluirEmpresa('${e.id}')">Excluir</button>
          </div>` : ''}
        </div>
      </div>
    `).join('') || '<div class="empty-state">Nenhuma empresa cadastrada.</div>'}
  `;
}
function abrirModalEmpresa(empresa) {
  const editing = !!empresa;
  abrirModal(editing ? 'Editar Empresa' : 'Nova Empresa', `
    <div class="form-field"><label>Razão social</label><input id="m-nome" value="${editing?empresa.nome:''}"></div>
    <div class="form-field"><label>CNPJ</label><input id="m-cnpj" value="${editing?(empresa.cnpj||''):''}"></div>
    <div class="form-field"><label>Endereço</label><input id="m-endereco" value="${editing?(empresa.endereco||''):''}"></div>
    <div class="form-field"><label>Cor primária</label><input id="m-cor" type="color" value="${editing?(empresa.cor_primaria||'#1F6FB2'):'#1F6FB2'}" style="height:38px"></div>
  `, async () => {
    const body = {
      nome: document.getElementById('m-nome').value.trim(),
      cnpj: document.getElementById('m-cnpj').value.trim(),
      endereco: document.getElementById('m-endereco').value.trim(),
      corPrimaria: document.getElementById('m-cor').value
    };
    if (!body.nome) { toast('Informe a razão social', 'danger'); return false; }
    if (editing) await apiFetch(`/api/empresas/${empresa.id}`, { method: 'PUT', body });
    else await apiFetch('/api/empresas', { method: 'POST', body });
    toast('Empresa salva com sucesso', 'success');
    renderContent();
    return true;
  });
}
async function excluirEmpresa(id) {
  if (!confirm('Excluir esta empresa?')) return;
  try { await apiFetch(`/api/empresas/${id}`, { method: 'DELETE' }); toast('Empresa excluída', 'success'); renderContent(); }
  catch (e) { toast(e.message, 'danger'); }
}

/* ---------------- Usuários ---------------- */
async function renderUsuarios(el) {
  const [{ usuarios }, { papeis }] = await Promise.all([apiFetch('/api/usuarios'), apiFetch('/api/papeis')]);
  window.__papeisCache = papeis;
  el.innerHTML = `
    <div class="page-header-row">
      <div><h1 class="page-title">Usuários</h1><div class="page-subtitle">Pessoas com acesso ao sistema, dentro do ${usuarioAtual.grupo_nome}</div></div>
      <button class="btn btn-primary btn-sm" onclick="abrirModalUsuario()">+ Novo Usuário</button>
    </div>
    ${usuarios.map(u => `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-weight:600">${u.nome}</span>
              ${u.ativo ? '<span class="badge badge-success">Ativo</span>' : '<span class="badge badge-neutral">Inativo</span>'}
            </div>
            <div style="font-size:12.5px;color:var(--text-muted)">${u.email}</div>
            <div style="margin-top:6px">${(u.papeis||[]).map(p=>`<span class="badge badge-gold" style="margin-right:4px">${p.nome}</span>`).join('') || '<span class="badge badge-neutral">Sem papel</span>'}</div>
          </div>
          <div class="row-actions">
            <button class="btn btn-ghost btn-sm" onclick='abrirModalUsuario(${JSON.stringify(u).replace(/'/g,"&apos;")})'>Editar</button>
            <button class="btn btn-danger-ghost btn-sm" onclick="excluirUsuario('${u.id}')">Excluir</button>
          </div>
        </div>
      </div>
    `).join('') || '<div class="empty-state">Nenhum usuário cadastrado.</div>'}
  `;
}
function abrirModalUsuario(usuario) {
  const editing = !!usuario;
  const papeis = window.__papeisCache || [];
  const papeisIdsAtuais = editing ? (usuario.papeis || []).map(p => p.id) : [];
  const papeisHtml = papeis.map(p => `
    <div class="checkbox-row">
      <input type="checkbox" id="papel-${p.id}" value="${p.id}" ${papeisIdsAtuais.includes(p.id)?'checked':''}>
      <label for="papel-${p.id}">${p.nome}${p.padrao_sistema?' <span class="badge badge-neutral">padrão</span>':''}</label>
    </div>`).join('');

  abrirModal(editing ? 'Editar Usuário' : 'Novo Usuário', `
    <div class="form-field"><label>Nome</label><input id="m-nome" value="${editing?usuario.nome:''}"></div>
    ${!editing ? `<div class="form-field"><label>E-mail</label><input id="m-email" type="email"></div>` : `<div class="form-field"><label>E-mail</label><input value="${usuario.email}" disabled style="background:var(--surface-sunken)"></div>`}
    <div class="form-field"><label>${editing?'Nova senha (deixe em branco para manter)':'Senha (mínimo 8 caracteres)'}</label><input id="m-senha" type="password"></div>
    ${editing ? `<div class="checkbox-row"><input type="checkbox" id="m-ativo" ${usuario.ativo?'checked':''}><label for="m-ativo">Usuário ativo</label></div>` : ''}
    <div class="form-field"><label>Papéis</label>${papeisHtml || '<div class="page-subtitle">Nenhum papel cadastrado</div>'}</div>
  `, async () => {
    const papeisIds = papeis.filter(p => document.getElementById(`papel-${p.id}`).checked).map(p => p.id);
    const senha = document.getElementById('m-senha').value;
    if (editing) {
      const body = { nome: document.getElementById('m-nome').value.trim(), ativo: document.getElementById('m-ativo').checked, papeisIds };
      if (senha) body.senha = senha;
      await apiFetch(`/api/usuarios/${usuario.id}`, { method: 'PUT', body });
    } else {
      const email = document.getElementById('m-email').value.trim();
      const nome = document.getElementById('m-nome').value.trim();
      if (!nome || !email || !senha) { toast('Preencha nome, e-mail e senha', 'danger'); return false; }
      await apiFetch('/api/usuarios', { method: 'POST', body: { nome, email, senha, papeisIds } });
    }
    toast('Usuário salvo com sucesso', 'success');
    renderContent();
    return true;
  });
}
async function excluirUsuario(id) {
  if (!confirm('Excluir este usuário?')) return;
  try { await apiFetch(`/api/usuarios/${id}`, { method: 'DELETE' }); toast('Usuário excluído', 'success'); renderContent(); }
  catch (e) { toast(e.message, 'danger'); }
}

/* ---------------- Papéis e Permissões ---------------- */
async function renderPapeis(el) {
  const [{ papeis }, { permissoes }] = await Promise.all([apiFetch('/api/papeis'), apiFetch('/api/permissoes')]);
  permissoesCatalogo = permissoes;
  el.innerHTML = `
    <div class="page-header-row">
      <div><h1 class="page-title">Papéis e Permissões</h1><div class="page-subtitle">Papéis padrão do sistema não podem ser editados — crie um papel próprio do grupo para personalizar</div></div>
      <button class="btn btn-primary btn-sm" onclick="abrirModalPapel()">+ Novo Papel</button>
    </div>
    ${papeis.map(p => `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-weight:600">${p.nome}</span>
              ${p.padrao_sistema ? '<span class="badge badge-neutral">Padrão do sistema</span>' : '<span class="badge badge-gold">Personalizado</span>'}
            </div>
            <div style="font-size:12.5px;color:var(--text-muted);margin-top:2px">${p.descricao || ''}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:6px">${p.permissoes.length} permissão(ões)</div>
          </div>
          ${!p.padrao_sistema ? `<div class="row-actions">
            <button class="btn btn-ghost btn-sm" onclick='abrirModalPapel(${JSON.stringify(p).replace(/'/g,"&apos;")})'>Editar</button>
            <button class="btn btn-danger-ghost btn-sm" onclick="excluirPapel('${p.id}')">Excluir</button>
          </div>` : ''}
        </div>
      </div>
    `).join('')}
  `;
}
function abrirModalPapel(papel) {
  const editing = !!papel;
  const permsAtuais = editing ? papel.permissoes : [];
  const porModulo = {};
  permissoesCatalogo.forEach(p => { (porModulo[p.modulo] = porModulo[p.modulo] || []).push(p); });
  const gruposHtml = Object.entries(porModulo).map(([modulo, perms]) => `
    <div class="perm-group">
      <div class="perm-group-title">${modulo}</div>
      ${perms.map(p => `
        <div class="checkbox-row">
          <input type="checkbox" id="perm-${p.chave}" value="${p.chave}" ${permsAtuais.includes(p.chave)?'checked':''}>
          <label for="perm-${p.chave}">${p.descricao || p.chave}</label>
        </div>`).join('')}
    </div>`).join('');

  abrirModal(editing ? 'Editar Papel' : 'Novo Papel', `
    <div class="form-field"><label>Nome do papel</label><input id="m-nome" value="${editing?papel.nome:''}" placeholder="Ex: Estagiário"></div>
    <div class="form-field"><label>Descrição</label><input id="m-descricao" value="${editing?(papel.descricao||''):''}"></div>
    <div class="form-field"><label>Permissões</label><div style="max-height:280px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:12px">${gruposHtml}</div></div>
  `, async () => {
    const nome = document.getElementById('m-nome').value.trim();
    if (!nome) { toast('Informe o nome do papel', 'danger'); return false; }
    const permissoesChaves = permissoesCatalogo.filter(p => document.getElementById(`perm-${p.chave}`).checked).map(p => p.chave);
    const body = { nome, descricao: document.getElementById('m-descricao').value.trim(), permissoesChaves };
    if (editing) await apiFetch(`/api/papeis/${papel.id}`, { method: 'PUT', body });
    else await apiFetch('/api/papeis', { method: 'POST', body });
    toast('Papel salvo com sucesso', 'success');
    renderContent();
    return true;
  });
}
async function excluirPapel(id) {
  if (!confirm('Excluir este papel? Usuários com este papel perderão as permissões associadas.')) return;
  try { await apiFetch(`/api/papeis/${id}`, { method: 'DELETE' }); toast('Papel excluído', 'success'); renderContent(); }
  catch (e) { toast(e.message, 'danger'); }
}

/* ---------------- Modal genérico ---------------- */
function abrirModal(titulo, bodyHtml, onSave) {
  const root = document.createElement('div');
  root.className = 'modal-overlay';
  root.id = 'modal-overlay';
  root.innerHTML = `
    <div class="modal">
      <div class="modal-header"><h3 style="font-size:16px">${titulo}</h3><button class="btn btn-danger-ghost btn-sm" onclick="fecharModal()">✕</button></div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-footer">
        <button class="btn btn-ghost btn-sm" onclick="fecharModal()">Cancelar</button>
        <button class="btn btn-primary btn-sm" id="modal-save-btn">Salvar</button>
      </div>
    </div>
  `;
  document.body.appendChild(root);
  document.getElementById('modal-save-btn').onclick = async () => {
    try { const ok = await onSave(); if (ok !== false) fecharModal(); }
    catch (e) { toast(e.message, 'danger'); }
  };
}
function fecharModal() {
  const el = document.getElementById('modal-overlay');
  if (el) el.remove();
}

/* ---------------- Bootstrap ---------------- */
(async function bootstrap() {
  try {
    const data = await apiFetch('/api/auth/me');
    usuarioAtual = data.usuario;
    iniciarApp();
  } catch (e) {
    document.getElementById('login-screen').style.display = 'flex';
  }
})();

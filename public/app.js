/* ============================================================
   Backoffice — Painel do Consultor
   Login + Gestão de Empresas, Usuários e Papéis/Permissões
   ============================================================ */
const API = ''; // mesmo domínio (funções serverless em /api/...)
let usuarioAtual = null;
let activeSection = 'empresas';
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
  { id: 'empresas', label: 'Empresas do Grupo', permissao: null },
  { id: 'usuarios', label: 'Usuários', permissao: 'usuarios.gerenciar' },
  { id: 'papeis', label: 'Papéis e Permissões', permissao: 'usuarios.gerenciar' }
];

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
    if (activeSection === 'empresas') await renderEmpresas(el);
    else if (activeSection === 'usuarios') await renderUsuarios(el);
    else if (activeSection === 'papeis') await renderPapeis(el);
  } catch (e) {
    el.innerHTML = `<div class="empty-state" style="color:var(--danger)">${e.message}</div>`;
  }
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

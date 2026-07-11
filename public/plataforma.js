/* ============================================================
   Plataforma — Gestão de Grupos de Empresa clientes e Planos
   ============================================================ */
let adminAtual = null;
let activeSection = 'grupos';
let planosCache = [];

async function apiFetch(path, options = {}) {
  const resp = await fetch(path, {
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
function fmtMoeda(v) {
  if (v === null || v === undefined) return '—';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
    const data = await apiFetch('/api/plataforma/auth/login', { method: 'POST', body: { email, senha } });
    adminAtual = data.admin;
    iniciarApp();
  } catch (e) {
    errorEl.textContent = e.message;
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = 'Entrar';
  }
}
async function fazerLogout() {
  await apiFetch('/api/plataforma/auth/logout', { method: 'POST' });
  adminAtual = null;
  document.getElementById('app-shell').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}
document.getElementById('login-senha').addEventListener('keydown', e => { if (e.key === 'Enter') fazerLogin(); });

/* ---------------- Shell ---------------- */
const SECOES = [
  { id: 'grupos', label: 'Grupos de Empresa (clientes)' },
  { id: 'planos', label: 'Planos de Faturamento' }
];

function iniciarApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-shell').style.display = 'flex';
  renderSidebar();
  renderTopbar();
  renderContent();
}
function renderSidebar() {
  document.getElementById('sidebar-nav').innerHTML = SECOES
    .map(s => `<div class="nav-item ${activeSection===s.id?'active':''}" onclick="irPara('${s.id}')">${s.label}</div>`)
    .join('');
}
function renderTopbar() {
  document.getElementById('topbar').innerHTML = `
    <div style="font-size:13px;color:var(--text-muted)">Administração da Plataforma</div>
    <div style="display:flex;align-items:center;gap:12px">
      <div style="text-align:right"><div style="font-size:13px;font-weight:600">${adminAtual.nome}</div></div>
      <button class="btn btn-ghost btn-sm" onclick="fazerLogout()">Sair</button>
    </div>
  `;
}
function irPara(secao) { activeSection = secao; renderSidebar(); renderContent(); }

async function renderContent() {
  const el = document.getElementById('content');
  el.innerHTML = '<div class="empty-state">Carregando...</div>';
  try {
    if (activeSection === 'grupos') await renderGrupos(el);
    else if (activeSection === 'planos') await renderPlanos(el);
  } catch (e) {
    el.innerHTML = `<div class="empty-state" style="color:var(--danger)">${e.message}</div>`;
  }
}

/* ---------------- Grupos de Empresa (clientes) ---------------- */
const STATUS_LABEL = { ativo: 'Ativo', trial: 'Trial', suspenso: 'Suspenso', cancelado: 'Cancelado' };
const STATUS_BADGE = { ativo: 'badge-success', trial: 'badge-warning', suspenso: 'badge-danger', cancelado: 'badge-neutral' };

async function renderGrupos(el) {
  const [{ grupos }, { planos }] = await Promise.all([apiFetch('/api/plataforma/grupos'), apiFetch('/api/plataforma/planos')]);
  planosCache = planos;
  el.innerHTML = `
    <div class="page-header-row">
      <div><h1 class="page-title">Grupos de Empresa</h1><div class="page-subtitle">Cada grupo é um cliente da plataforma, com seus próprios usuários, empresas e dados — totalmente isolado dos demais.</div></div>
      <button class="btn btn-gold btn-sm" onclick="abrirModalNovoGrupo()">+ Novo Grupo Cliente</button>
    </div>
    ${grupos.map(g => `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-weight:600;font-size:15px">${g.nome}</span>
              <span class="badge ${STATUS_BADGE[g.status]||'badge-neutral'}">${STATUS_LABEL[g.status]||g.status}</span>
            </div>
            <div style="font-size:12.5px;color:var(--text-muted);margin-top:4px">
              Plano: <b>${g.plano_nome || 'Nenhum'}</b>${g.valor_mensal ? ' · ' + fmtMoeda(g.valor_mensal) + '/mês' : ''}
              · ${g.total_usuarios} usuário(s) · ${g.total_empresas} empresa(s)
            </div>
            ${g.observacoes ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px">${g.observacoes}</div>` : ''}
          </div>
          <div class="row-actions">
            <button class="btn btn-ghost btn-sm" onclick='abrirModalEditarGrupo(${JSON.stringify(g).replace(/'/g,"&apos;")})'>Editar</button>
          </div>
        </div>
      </div>
    `).join('') || '<div class="empty-state">Nenhum grupo cadastrado ainda.</div>'}
  `;
}

function abrirModalNovoGrupo() {
  const planoOpts = planosCache.map(p => `<option value="${p.id}">${p.nome} (${fmtMoeda(p.valor_mensal)}/mês)</option>`).join('');
  abrirModal('Novo Grupo Cliente', `
    <div class="form-field"><label>Nome do grupo</label><input id="m-nome-grupo" placeholder="Ex: Consultoria Municipal LTDA"></div>
    <div class="form-field"><label>Plano</label><select id="m-plano"><option value="">Nenhum</option>${planoOpts}</select></div>
    <div class="form-field"><label>Status inicial</label>
      <select id="m-status">
        <option value="trial">Trial</option>
        <option value="ativo">Ativo</option>
      </select>
    </div>
    <div class="divider">
      <div style="font-size:12.5px;font-weight:600;color:var(--text-muted);margin-bottom:10px">Administrador principal deste grupo</div>
      <div class="form-field"><label>Nome</label><input id="m-admin-nome"></div>
      <div class="form-field"><label>E-mail</label><input id="m-admin-email" type="email"></div>
      <div class="form-field"><label>Senha inicial (mínimo 8 caracteres)</label><input id="m-admin-senha" type="password"></div>
    </div>
  `, async () => {
    const body = {
      nomeGrupo: document.getElementById('m-nome-grupo').value.trim(),
      planoId: document.getElementById('m-plano').value || null,
      status: document.getElementById('m-status').value,
      adminNome: document.getElementById('m-admin-nome').value.trim(),
      adminEmail: document.getElementById('m-admin-email').value.trim(),
      adminSenha: document.getElementById('m-admin-senha').value
    };
    if (!body.nomeGrupo) { toast('Informe o nome do grupo', 'danger'); return false; }
    if (!body.adminNome || !body.adminEmail || !body.adminSenha) { toast('Preencha os dados do administrador principal', 'danger'); return false; }
    await apiFetch('/api/plataforma/grupos', { method: 'POST', body });
    toast('Grupo criado com sucesso — administrador principal já pode fazer login', 'success');
    renderContent();
    return true;
  });
}

function abrirModalEditarGrupo(grupo) {
  const planoOpts = planosCache.map(p => `<option value="${p.id}" ${grupo.plano_id===p.id?'selected':''}>${p.nome}</option>`).join('');
  abrirModal('Editar Grupo', `
    <div class="form-field"><label>Nome do grupo</label><input id="m-nome-grupo" value="${grupo.nome}"></div>
    <div class="form-field"><label>Plano</label><select id="m-plano"><option value="">Nenhum</option>${planoOpts}</select></div>
    <div class="form-field"><label>Status</label>
      <select id="m-status">
        <option value="trial" ${grupo.status==='trial'?'selected':''}>Trial</option>
        <option value="ativo" ${grupo.status==='ativo'?'selected':''}>Ativo</option>
        <option value="suspenso" ${grupo.status==='suspenso'?'selected':''}>Suspenso</option>
        <option value="cancelado" ${grupo.status==='cancelado'?'selected':''}>Cancelado</option>
      </select>
    </div>
    <div class="form-field"><label>Observações</label><input id="m-observacoes" value="${grupo.observacoes||''}"></div>
  `, async () => {
    const body = {
      nome: document.getElementById('m-nome-grupo').value.trim(),
      planoId: document.getElementById('m-plano').value || null,
      status: document.getElementById('m-status').value,
      observacoes: document.getElementById('m-observacoes').value.trim()
    };
    await apiFetch(`/api/plataforma/grupos/${grupo.id}`, { method: 'PUT', body });
    toast('Grupo atualizado com sucesso', 'success');
    renderContent();
    return true;
  });
}

/* ---------------- Planos de Faturamento ---------------- */
async function renderPlanos(el) {
  const { planos } = await apiFetch('/api/plataforma/planos');
  el.innerHTML = `
    <div class="page-header-row">
      <div><h1 class="page-title">Planos de Faturamento</h1><div class="page-subtitle">Planos disponíveis para atribuir aos grupos clientes</div></div>
      <button class="btn btn-gold btn-sm" onclick="abrirModalPlano()">+ Novo Plano</button>
    </div>
    ${planos.map(p => `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-weight:600">${p.nome}</span>
              ${!p.ativo ? '<span class="badge badge-neutral">Inativo</span>' : ''}
            </div>
            <div style="font-size:12.5px;color:var(--text-muted);margin-top:2px">${p.descricao||''}</div>
            <div style="font-size:12.5px;color:var(--text-muted);margin-top:4px">
              ${fmtMoeda(p.valor_mensal)}/mês · ${p.limite_usuarios ? p.limite_usuarios + ' usuário(s)' : 'usuários ilimitados'} · ${p.limite_empresas ? p.limite_empresas + ' empresa(s)' : 'empresas ilimitadas'}
            </div>
          </div>
          <div class="row-actions">
            <button class="btn btn-ghost btn-sm" onclick='abrirModalPlano(${JSON.stringify(p).replace(/'/g,"&apos;")})'>Editar</button>
            <button class="btn btn-danger-ghost btn-sm" onclick="excluirPlano('${p.id}')">Excluir</button>
          </div>
        </div>
      </div>
    `).join('') || '<div class="empty-state">Nenhum plano cadastrado.</div>'}
  `;
}
function abrirModalPlano(plano) {
  const editing = !!plano;
  abrirModal(editing ? 'Editar Plano' : 'Novo Plano', `
    <div class="form-field"><label>Nome</label><input id="m-nome" value="${editing?plano.nome:''}"></div>
    <div class="form-field"><label>Descrição</label><input id="m-descricao" value="${editing?(plano.descricao||''):''}"></div>
    <div class="form-field"><label>Valor mensal (R$)</label><input id="m-valor" type="number" step="0.01" value="${editing?plano.valor_mensal:''}"></div>
    <div class="form-field"><label>Limite de usuários (vazio = ilimitado)</label><input id="m-limite-usuarios" type="number" value="${editing&&plano.limite_usuarios?plano.limite_usuarios:''}"></div>
    <div class="form-field"><label>Limite de empresas (vazio = ilimitado)</label><input id="m-limite-empresas" type="number" value="${editing&&plano.limite_empresas?plano.limite_empresas:''}"></div>
  `, async () => {
    const valorInput = document.getElementById('m-valor').value;
    const usuariosInput = document.getElementById('m-limite-usuarios').value;
    const empresasInput = document.getElementById('m-limite-empresas').value;
    const body = {
      nome: document.getElementById('m-nome').value.trim(),
      descricao: document.getElementById('m-descricao').value.trim(),
      valorMensal: valorInput === '' ? null : parseFloat(valorInput),
      limiteUsuarios: usuariosInput === '' ? null : parseInt(usuariosInput),
      limiteEmpresas: empresasInput === '' ? null : parseInt(empresasInput)
    };
    if (!body.nome) { toast('Informe o nome do plano', 'danger'); return false; }
    if (editing) await apiFetch(`/api/plataforma/planos/${plano.id}`, { method: 'PUT', body });
    else await apiFetch('/api/plataforma/planos', { method: 'POST', body });
    toast('Plano salvo com sucesso', 'success');
    renderContent();
    return true;
  });
}
async function excluirPlano(id) {
  if (!confirm('Excluir este plano? Grupos que já usam este plano continuarão como estão, só não será mais possível atribuí-lo a novos grupos.')) return;
  try { await apiFetch(`/api/plataforma/planos/${id}`, { method: 'DELETE' }); toast('Plano excluído', 'success'); renderContent(); }
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
        <button class="btn btn-primary btn-sm" id="modal-save-btn" style="width:auto">Salvar</button>
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
    const data = await apiFetch('/api/plataforma/auth/me');
    adminAtual = data.admin;
    iniciarApp();
  } catch (e) {
    document.getElementById('login-screen').style.display = 'flex';
  }
})();

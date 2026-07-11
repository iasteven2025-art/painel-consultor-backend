-- ============================================================
-- Painel do Consultor — Schema Multi-Tenant
-- ============================================================
-- Hierarquia: Grupo Econômico (tenant) -> Empresas -> Usuários
-- Ex: "Grupo Actcon" contém "Actcon Soluções Web" e "Portal Soluções"
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- Grupos Econômicos (unidade de isolamento multi-tenant) ----------
CREATE TABLE IF NOT EXISTS grupos_empresa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Empresas (pertencem a um grupo; gestão agregada por grupo) ----------
CREATE TABLE IF NOT EXISTS empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID NOT NULL REFERENCES grupos_empresa(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cnpj TEXT,
  endereco TEXT,
  cor_primaria TEXT DEFAULT '#1F6FB2',
  logo_base64 TEXT,
  logo_mime TEXT,
  carimbo_base64 TEXT,
  carimbo_mime TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_empresas_grupo ON empresas(grupo_id);

-- ---------- Usuários (pertencem a um grupo — nunca enxergam dados de outro) ----------
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID NOT NULL REFERENCES grupos_empresa(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_usuarios_grupo ON usuarios(grupo_id);

-- ---------- Papéis (roles) — podem ser globais (grupo_id NULL) ou específicos de um grupo ----------
CREATE TABLE IF NOT EXISTS papeis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID REFERENCES grupos_empresa(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Permissões (catálogo fixo de ações do sistema) ----------
CREATE TABLE IF NOT EXISTS permissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave TEXT NOT NULL UNIQUE,
  modulo TEXT NOT NULL,
  descricao TEXT
);

-- ---------- Relação Papel <-> Permissão (N:N) ----------
CREATE TABLE IF NOT EXISTS papel_permissoes (
  papel_id UUID NOT NULL REFERENCES papeis(id) ON DELETE CASCADE,
  permissao_id UUID NOT NULL REFERENCES permissoes(id) ON DELETE CASCADE,
  PRIMARY KEY (papel_id, permissao_id)
);

-- ---------- Relação Usuário <-> Papel (N:N — um usuário pode ter mais de um papel) ----------
CREATE TABLE IF NOT EXISTS usuario_papeis (
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  papel_id UUID NOT NULL REFERENCES papeis(id) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, papel_id)
);

-- ---------- Relação Usuário <-> Empresa (escopo de acesso dentro do grupo) ----------
-- Se um usuário não tiver nenhuma linha aqui, considera-se que ele acessa
-- TODAS as empresas do seu grupo (gestão agregada, padrão para Administradores).
CREATE TABLE IF NOT EXISTS usuario_empresas (
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, empresa_id)
);

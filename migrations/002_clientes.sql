-- ============================================================
-- Painel do Consultor — Módulo Clientes
-- ============================================================

CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID NOT NULL REFERENCES grupos_empresa(id) ON DELETE CASCADE,
  nome_completo TEXT NOT NULL,
  nome_abreviado TEXT,
  municipio TEXT,
  regiao TEXT,
  populacao INTEGER,
  dominio TEXT,
  observacoes TEXT,
  -- Lista de contatos como JSON: [{id, nome, cargo, email, telefone, principal}, ...]
  -- Optamos por JSONB em vez de tabela separada porque os contatos sempre são
  -- lidos/gravados junto com o cliente, sem necessidade de consultá-los isoladamente.
  contatos JSONB NOT NULL DEFAULT '[]'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clientes_grupo ON clientes(grupo_id);
CREATE INDEX IF NOT EXISTS idx_clientes_regiao ON clientes(grupo_id, regiao);

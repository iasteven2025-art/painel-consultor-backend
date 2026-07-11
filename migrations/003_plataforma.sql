-- ============================================================
-- Painel do Consultor — Camada de Plataforma
-- ============================================================
-- Separação importante: "admins_plataforma" NÃO pertence a nenhum
-- grupo_id — são as pessoas que vendem/administram o sistema como um
-- todo (você e sua equipe interna), diferentes dos administradores de
-- cada Grupo de Empresa cliente (que só enxergam o próprio grupo).
-- ============================================================

CREATE TABLE IF NOT EXISTS planos_faturamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  valor_mensal NUMERIC(10,2),
  limite_usuarios INTEGER,  -- NULL = ilimitado
  limite_empresas INTEGER,  -- NULL = ilimitado
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE grupos_empresa ADD COLUMN IF NOT EXISTS plano_id UUID REFERENCES planos_faturamento(id);
ALTER TABLE grupos_empresa ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ativo'; -- ativo | trial | suspenso | cancelado
ALTER TABLE grupos_empresa ADD COLUMN IF NOT EXISTS observacoes TEXT;

CREATE TABLE IF NOT EXISTS admins_plataforma (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

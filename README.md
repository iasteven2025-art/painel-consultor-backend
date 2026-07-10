# Painel do Consultor — Backend Multi-Tenant

Backoffice com **Grupos de Empresa** (multi-tenant), **Empresas**, **Usuários** e
**Papéis/Permissões**. Pronto para deploy na Vercel com Postgres.

```
Grupo Actcon (tenant)
 ├─ Actcon Soluções Web S/A
 ├─ Portal Soluções Ltda
 └─ Usuários (Steven, ...) — cada um com um ou mais Papéis (Administrador,
    Consultor, Financeiro, Visualizador, ou papéis personalizados que você criar)
```

Cada grupo é completamente isolado dos demais — um usuário nunca consegue ler ou
escrever dados de outro grupo, mesmo tentando adivinhar IDs. Isso foi testado
automaticamente (veja `test-integration.js`).

## O que está pronto e testado

- **Autenticação**: login com e-mail/senha (bcrypt), sessão em cookie httpOnly, logout.
- **Multi-tenant**: cada usuário pertence a um Grupo; todas as consultas ao banco
  são filtradas pelo grupo da sessão — nunca por um ID que o navegador manda.
- **Empresas do Grupo**: CRUD completo, gestão agregada (ver todas de uma vez).
- **Usuários**: criar, editar, desativar, trocar senha, atribuir papéis.
- **Papéis e Permissões**: 4 papéis padrão prontos (Administrador, Consultor,
  Financeiro, Visualizador) + você pode criar papéis próprios do seu grupo,
  escolhendo exatamente quais das 26 permissões do sistema cada um tem.
- **Proxy de IA**: mesma função de antes, agora atrás de login (só usuário
  autenticado consome sua chave da Anthropic).
- Testei tudo com um Postgres real rodando localmente antes de te entregar —
  18 verificações automáticas, incluindo a mais importante: um usuário de um
  grupo tentando acessar dado de outro grupo pelo ID direto recebe 404, não o dado.

## O que NÃO está migrado ainda (fica no localStorage, por enquanto)

Clientes, Contratos, Licitações, Propostas, Documentos, Produtos, Comissões,
Agenda, Descritivos Técnicos e Regiões continuam exatamente como estavam —
rodando no navegador, sem tenant. Migrar cada um segue o mesmo padrão usado
aqui em Empresas (rota em `/api`, sempre filtrando por `usuario.grupo_id`,
nunca confiando em ID vindo do cliente). Quando quiser seguir com a migração,
é só pedir — o alicerce já está pronto, cada módulo novo é incremental.

## 1. Rodar localmente

Requer Node.js 18+ e um Postgres (local ou na nuvem, ex: [Neon](https://neon.tech) free tier).

```bash
npm install
cp .env.example .env
```

Edite o `.env`:
```
POSTGRES_URL=postgresql://usuario:senha@host:5432/banco
JWT_SECRET=                    # gere com: openssl rand -base64 48
ANTHROPIC_API_KEY=sk-ant-...
SEED_ADMIN_EMAIL=steven.passos@actcon.com.br
SEED_ADMIN_SENHA=escolha-uma-senha-forte
```

Aplique o schema e popule os dados iniciais:
```bash
npm run migrate
npm run seed
```

Isso cria o Grupo Actcon, as duas empresas, o catálogo de permissões, os 4
papéis padrão, e seu usuário administrador com a senha que você definiu.

Para testar tudo localmente antes de mexer em qualquer coisa:
```bash
node dev-server.js
```
Abra `http://localhost:3050` — login com o e-mail/senha do seed.

`dev-server.js` e `test-integration.js` são só ferramentas de desenvolvimento
local (simulam o roteamento da Vercel) — não fazem parte do deploy.

## 2. Publicar na Vercel

Você já tem conta lá, então:

1. Suba esta pasta inteira para um repositório no GitHub.
2. No dashboard da Vercel: **Add New → Project** → importe o repositório.
3. **Antes de fazer o primeiro deploy**, crie o banco:
   **Storage → Create Database → Postgres** (usa Neon por baixo, é gratuito
   para começar). A Vercel já injeta `POSTGRES_URL` automaticamente no projeto
   quando você faz isso — não precisa copiar/colar a connection string.
4. Em **Project Settings → Environment Variables**, adicione:
   - `JWT_SECRET` (gere uma string aleatória forte)
   - `ANTHROPIC_API_KEY`
5. Clique em **Deploy**.
6. Depois do primeiro deploy, rode a migração e o seed **apontando pro banco
   de produção** (copie a `POSTGRES_URL` de Storage → seu banco → `.env.local`
   tab, cole num `.env` local temporário) e rode:
   ```bash
   npm run migrate
   npm run seed
   ```
   Isso só precisa ser feito uma vez.
7. Acesse a URL que a Vercel te deu (`seu-projeto.vercel.app`) e faça login.

**Domínio próprio**: em Project Settings → Domains, adicione seu domínio/subdomínio
e siga a instrução de DNS que a Vercel mostra.

## Segurança — o que já está coberto e o que fica pra depois

Cobre:
- Senhas com bcrypt (nunca texto puro).
- Sessão em cookie `httpOnly` (JavaScript no navegador não consegue ler, reduz
  risco de roubo de sessão via XSS).
- Toda decisão de permissão acontece no servidor — o frontend só esconde botão
  por conveniência, quem decide de verdade é a API.
- Isolamento de tenant em toda query — testado automaticamente.

Fica pra quando o uso crescer:
- **Rate limiting de verdade** no proxy de IA — hoje não tem, porque limitar
  por IP em função serverless exige um armazenamento compartilhado (ex: Vercel
  KV ou Upstash Redis), que não configurei ainda para não adicionar mais uma
  peça de infraestrutura sem você pedir.
- **Recuperação de senha por e-mail** — hoje, se um usuário esquecer a senha,
  só o Administrador pode trocar pela tela de Usuários.
- **Log de auditoria** (quem alterou o quê e quando) — útil conforme a equipe crescer.

## Estrutura do projeto

```
/api                    → cada arquivo é uma função serverless (rota da Vercel)
  /auth (login, logout, me)
  /grupos, /empresas, /usuarios, /papeis, /permissoes
  /claude/messages.js    → proxy de IA
/lib
  db.js                  → conexão com Postgres
  auth.js                → hash de senha, JWT, middlewares de permissão
/migrations
  001_init.sql            → schema completo
/scripts
  migrate.js, seed.js
/public                  → frontend do backoffice (login + Empresas/Usuários/Papéis)
vercel.json
```

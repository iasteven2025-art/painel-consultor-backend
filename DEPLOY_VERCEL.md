# Publicar na Vercel — passo a passo direto

O código já está pronto e commitado num repositório git local (dentro desta
pasta). Faltam só os passos que só você consegue fazer, porque exigem login
na sua conta — eu não tenho acesso a ela daqui.

Duas formas de publicar. **Recomendo a primeira** (sem precisar de terminal).

---

## Caminho A — GitHub + Dashboard da Vercel (sem terminal, ~5 min)

### 1. Suba o código para o GitHub
Se você já tem um repositório vazio criado no GitHub, pule pro passo 2.
Senão, crie um agora: [github.com/new](https://github.com/new) → nome
sugerido `painel-consultor-backend` → **não** marque "Add README" (já temos
um) → Create repository.

No terminal, dentro desta pasta (`multi-tenant-backend/`):
```bash
git remote add origin https://github.com/SEU_USUARIO/painel-consultor-backend.git
git branch -M main
git push -u origin main
```
(Troque `SEU_USUARIO` pelo seu usuário do GitHub. Ele vai pedir login/token
na primeira vez — se preferir, use o GitHub Desktop ou a extensão do VS Code
em vez da linha de comando, o resultado é o mesmo.)

### 2. Crie o banco de dados na Vercel
No [dashboard da Vercel](https://vercel.com/dashboard):
**Storage** (menu superior) → **Create Database** → **Postgres** → dê um
nome (ex: `painel-consultor-db`) → **Create**.

### 3. Importe o projeto
**Add New...** → **Project** → escolha o repositório `painel-consultor-backend`
que você acabou de subir → **Import**.

Na tela de configuração, **antes de clicar em Deploy**:
- Em **Environment Variables**, adicione:
  - `JWT_SECRET` → cole uma string aleatória (gere uma em
    [generate-secret.vercel.app/48](https://generate-secret.vercel.app/48) ou
    rode `openssl rand -base64 48` no terminal)
  - `ANTHROPIC_API_KEY` → sua chave da Anthropic
- Em **Storage**, conecte o banco `painel-consultor-db` que você criou no
  passo 2 a este projeto (a Vercel oferece essa opção na própria tela de
  import, ou depois em Project Settings → Storage → Connect). Isso preenche
  `POSTGRES_URL` automaticamente — você não digita isso na mão.

Clique em **Deploy**. Em 1-2 minutos o projeto está no ar (ainda sem dados).

### 4. Rode a migração e o seed (uma vez só)
Isso cria as tabelas e o usuário administrador inicial. Precisa ser feito
apontando pro banco de produção:

No dashboard: **Storage → painel-consultor-db → `.env.local`** (ou aba
similar) → copie o valor de `POSTGRES_URL`.

No seu terminal, dentro desta pasta:
```bash
npm install
echo "POSTGRES_URL=cole_aqui_o_valor_copiado" > .env
echo "SEED_ADMIN_EMAIL=steven.passos@actcon.com.br" >> .env
echo "SEED_ADMIN_SENHA=escolha-uma-senha-forte-aqui" >> .env
npm run migrate
npm run seed
rm .env
```
(O `rm .env` no final é de propósito — depois de rodar, apague esse arquivo
local pra não ficar com a senha do banco de produção salva na sua máquina.)

### 5. Acesse
Abra a URL que a Vercel te deu (algo como `painel-consultor-backend.vercel.app`)
e faça login com o e-mail/senha que você definiu no passo 4.

---

## Caminho B — Vercel CLI (se preferir terminal do início ao fim)

```bash
npm install -g vercel
cd multi-tenant-backend
vercel login          # abre o navegador pra você autorizar
vercel                # primeiro deploy, ele pergunta as configurações
vercel --prod         # deploy de produção
```
Depois disso, configure as variáveis de ambiente e o banco do mesmo jeito
do Caminho A (passos 2 e 4), pelo dashboard — a CLI não cria banco de dados
sozinha.

---

## Se algo der errado

- **Erro "POSTGRES_URL não definida"**: o banco não foi conectado ao projeto
  em Project Settings → Storage, ou as variáveis de ambiente não foram salvas
  antes do deploy — edite em Settings → Environment Variables e clique em
  **Redeploy**.
- **Login não funciona depois do deploy**: confirme que rodou `npm run seed`
  apontando pro banco de *produção* (não o local) — veja o passo 4.
- **Tela em branco**: abra o Console do navegador (F12) e me mande o erro
  que aparecer — geralmente é `JWT_SECRET` ou `ANTHROPIC_API_KEY` faltando.

Se travar em qualquer passo, me manda a mensagem de erro exata (print ou
texto) que eu te ajudo a resolver.

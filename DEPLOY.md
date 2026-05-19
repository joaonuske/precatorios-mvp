# Deploy no Railway

Passo-a-passo pra colocar a plataforma no ar pela primeira vez.

## 1. Repositório no GitHub

```bash
# Já está inicializado e com o primeiro commit feito.
# Crie um repo VAZIO no GitHub (precatorios-mvp) e:
git remote add origin git@github.com:SEU-USUARIO/precatorios-mvp.git
git push -u origin main
```

## 2. Projeto no Railway

1. Acesse https://railway.app, **New Project → Deploy from GitHub repo**
2. Selecione o repo `precatorios-mvp`
3. Railway detecta Next.js e começa o build (vai falhar na primeira vez — sem DATABASE_URL ainda; tudo bem)

## 3. Adicionar Postgres ao projeto

1. No projeto, **+ New → Database → PostgreSQL**
2. Aguarde provisionar
3. Clique no serviço Postgres → aba **Variables** → copie `DATABASE_URL`
4. No serviço da app (precatorios-mvp), aba **Variables** → cole `DATABASE_URL`

## 4. Configurar volume pra uploads de PDF

1. No serviço da app → aba **Settings** → **Volumes** → **+ New Volume**
2. Mount path: `/uploads`
3. Tamanho inicial: 1 GB (basta)

## 5. Adicionar as outras variáveis de ambiente

No serviço da app → **Variables**, copie do `.env.example` e adicione:

```
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=https://<seu-app>.up.railway.app
CRON_SECRET=<openssl rand -hex 24>
DATAJUD_API_KEY=cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==
COMMISSION_PCT_DEFAULT=5
SOFT_CLOSE_MINUTES=5
DD_WINDOW_DAYS=7
UPLOADS_DIR=/uploads
```

(O `NEXTAUTH_URL` você ajusta depois que o Railway te der o domínio público.)

## 6. Criar as tabelas no Postgres (primeira vez)

Localmente, com o `DATABASE_URL` do Railway na mão:

```bash
DATABASE_URL="postgresql://...railway..." npx prisma migrate dev --name init
```

Isso cria as tabelas no Postgres da Railway. Faça o commit do diretório
`prisma/migrations/` que será gerado, e dê push:

```bash
git add prisma/migrations
git commit -m "feat: migração inicial Postgres"
git push
```

Em deploys subsequentes, o Railway vai rodar `prisma migrate deploy`
automaticamente (a gente configura na próxima etapa).

## 7. Build command no Railway

No serviço da app → **Settings** → **Build Command**:

```
npx prisma generate && npx prisma migrate deploy && npm run build
```

E **Start Command**:

```
npm run start
```

## 8. Habilitar domínio público

No serviço da app → **Settings** → **Networking** → **Generate Domain**.
Copie o domínio gerado e cole em `NEXTAUTH_URL`.

## 9. Cron de monitoramento contínuo

No projeto Railway → **+ New → Empty Service** → batize de "cron-monitor".

Em **Settings**:
- Cron Schedule: `0 */6 * * *` (a cada 6h)
- Start Command:
  ```
  curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<seu-app>.up.railway.app/api/cron/monitor
  ```

Em **Variables** desse serviço cron: adicione `CRON_SECRET` com o mesmo valor.

## 10. Primeiro acesso

1. Abra o domínio público
2. Crie uma conta
3. No banco Postgres do Railway, promova a primeira conta a admin:
   ```sql
   UPDATE "User" SET "isAdmin" = true WHERE email = 'voce@example.com';
   ```
   (rode pelo Railway → Postgres → **Data** ou via `psql` localmente)
4. Acesse `/kyc`, envie verificação, e no `/admin/kyc` aprove você mesmo
5. Crie o primeiro leilão real

## (opcional) Truststore ICP-Brasil

Pra validação completa de assinatura de PDFs:

1. Baixe `ACraiz.crt` em https://estrutura.iti.gov.br/repositorio/
2. Coloque em `certs/icpbrasil/` no repo
3. Commit + push — Railway recria o container com os certs disponíveis

## Rodando local depois do deploy

Você pode continuar mexendo local de duas formas:

**A) Apontando pro Postgres do Railway** (rápido, dados compartilhados):
```bash
cp .env.example .env
# preencha DATABASE_URL com a connection string do Railway
npm run dev
```

**B) Postgres local via Docker** (isolado):
```bash
docker run -d --name pg-precatorios \
  -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=precatorios \
  -p 5432:5432 postgres:16
# DATABASE_URL=postgresql://postgres:dev@localhost:5432/precatorios
npx prisma migrate dev
npm run dev
```

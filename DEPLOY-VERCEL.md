# Deploy na Vercel (período de teste)

## Como funciona
- **Front-end**: build Vite (`dist/`) servido como site estático.
- **API**: o Express roda como **uma função serverless** (`api/index.js`), e `vercel.json` encaminha `/api/*` para ela.
- `api/index.js` é um **arquivo gerado** (bundle de `src/server/vercelEntry.ts`) e precisa ficar no repositório.

> **Sempre que alterar qualquer arquivo em `src/server/` (ou utilitários usados por ele), rode `npm run build:api` e comite o `api/index.js` atualizado.**

## Passo a passo
1. Suba o projeto para um repositório no GitHub (o `.gitignore` já exclui `node_modules`, `dist`, `.env*` e `admin-credentials.json`).
2. Na Vercel: **Add New → Project** → importe o repositório. O `vercel.json` já define framework, build e rewrites; não precisa alterar nada.
3. **Deploy**. Depois, teste: `https://SEU-PROJETO.vercel.app/api/health` deve responder `{"status":"ok",...}`.

Alternativa pela CLI: `npm i -g vercel` → `vercel` (preview) → `vercel --prod`.

## Limitações do período de teste
- **Estado do servidor em memória** (assinaturas/cobrança, estoque do servidor, cache da ReceitaWS, limitadores) **zera** a cada reinício/nova instância da função. Dados guardados no navegador (localStorage) não são afetados.
- O vínculo com banco (`.database-config.json`) é gravado em `/tmp` (temporário, por instância).
- Limite da ReceitaWS (3/min) e limite por IP valem **por instância**.
- Autenticação é de demonstração (token sem assinatura) e a senha padrão do admin está no código do front-end. **Não use dados reais/sensíveis** e não divulgue a URL amplamente.
- Para proteger o acesso durante o teste, ative **Settings → Deployment Protection** (Vercel Authentication) no projeto.

## Antes da versão oficial
Banco externo (Postgres) para persistir dados, JWT assinado com segredo em variável de ambiente, senha do admin fora do código do front, e remover o `/api/auth/token` aberto.

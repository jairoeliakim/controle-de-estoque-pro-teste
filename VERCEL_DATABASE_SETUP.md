# Configuração persistente do banco na Vercel

O vínculo de banco salvo pela tela do sistema não pode depender de arquivo local ou de memória do processo: as funções serverless da Vercel podem iniciar em instâncias diferentes. Configure a conexão no ambiente de produção.

## Supabase/PostgreSQL (recomendado)

1. No Supabase, abra **Connect** e selecione **Session pooler** quando a conexão direta não estiver acessível pela Vercel.
2. Copie a connection string PostgreSQL. Não compartilhe essa string publicamente: ela contém credenciais.
3. Na Vercel, abra o projeto → **Settings → Environment Variables**.
4. Crie `DATABASE_URL` com a connection string completa (`postgresql://...`). Marque os ambientes em que o app será usado, pelo menos **Production**; marque **Preview** também se testar deploys de preview.
5. Salve e faça um novo deploy. Variáveis de ambiente só são aplicadas a novas implantações.
6. Abra o app em uma janela anônima ou outro dispositivo e confira se as empresas aparecem.

A aplicação também aceita configuração por variáveis separadas caso não use `DATABASE_URL`:

- `DB_ENGINE` (`postgres` ou `mysql`)
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_SSL` (`true` ou `false`)
- `DEFAULT_TENANT_ID` (opcional; padrão `00000000000001`)

Use **uma** abordagem: `DATABASE_URL` ou as variáveis separadas. Não coloque senha no código-fonte, em `VITE_*`, no frontend ou no repositório. O arquivo local `.database-config.json` é ignorado pelo Git e não deve ser enviado para a Vercel.

## O que foi ajustado no código

- A configuração de banco pode ser reconstruída a cada inicialização a partir de variáveis de ambiente.
- A configuração de ambiente é associada ao tenant padrão, em vez de existir apenas no estado da instância.
- O sistema não tenta tratar `/tmp/.database-config.json` como armazenamento persistente na Vercel.
- O comando de build da Vercel agora recompila tanto a API quanto o frontend (`npm run build:vercel`), para que mudanças no servidor sejam implantadas.

## Segurança

Como o ZIP anterior continha um arquivo de configuração de banco, troque a senha do banco antes de colocar a nova connection string na Vercel. Não inclua `.database-config.json` no repositório nem no pacote de deploy.

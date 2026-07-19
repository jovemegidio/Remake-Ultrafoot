# Ultrafoot Multiplayer Relay

Relay WSS autoritativo para campeonatos remotos com 20–32 técnicos. Usa Cloudflare Workers + Durable Objects e não depende de abertura de portas ou da rede local dos jogadores.

## Desenvolvimento

```powershell
npm install
npm run typecheck
npm test
npm run dev
```

## Implantação oficial

1. No painel Cloudflare, abrir **Workers & Pages** e confirmar que a conta possui um subdomínio `workers.dev`.
2. Abrir **Manage Account > Account API Tokens > Create Token > Custom token**.
3. Dar somente: `Account / Workers Scripts / Edit`, `Account / Workers Durable Objects / Edit` e `Account / Account Settings / Read`. Restringir o token à conta do Ultrafoot.
4. Copiar o **Account ID** da página inicial de Workers. O segredo do token só é exibido uma vez.
5. No GitHub do jogo, abrir **Settings > Secrets and variables > Actions > New repository secret** e criar:
   - `CLOUDFLARE_API_TOKEN`: token do passo 3;
   - `CLOUDFLARE_ACCOUNT_ID`: ID do passo 4.
6. Em **Actions**, executar manualmente o workflow `Multiplayer Relay`. A primeira implantação cria o Durable Object SQLite e retorna uma URL parecida com `https://ultrafoot-multiplayer-relay.<conta>.workers.dev`.
7. Testar `https://...workers.dev/health`. A resposta deve conter `{"ok":true}` e `gameVersion:"1.0.96"`.
8. Em **Settings > Secrets and variables > Actions > Variables**, criar `NEXT_PUBLIC_ULTRAFOOT_RELAY_URL` com a URL sem barra final. Para teste local, a mesma URL pode ser colada diretamente no FC Hub.
9. Opcionalmente, em **Workers > Settings > Domains & Routes**, associar `relay.seudominio.com`. O Cloudflare fornece HTTPS/WSS automaticamente.

Nunca coloque o API token dentro do jogo, `.env.local` distribuído ou instalador. Ele serve apenas para implantação. O cliente conhece somente a URL pública do relay. Para um teste local, prefira `npx wrangler login`; o token da tela enviada não precisa ser criado nem copiado para o executável.

## Plano gratuito e VPS

Para testes, Workers + Durable Objects é a opção recomendada: não requer abrir portas, já fornece TLS/WSS e hiberna WebSockets inativos. Monitore os limites no painel; ao aproximar do limite diário, migre para o plano Workers Paid ou limite a quantidade de salas.

Um VPS passa a ser melhor quando o servidor precisar executar a simulação completa continuamente, usar processos de fundo, banco SQL próprio ou tráfego fora de HTTP/WebSocket. Nesse cenário também será necessário cuidar de firewall, TLS, atualizações, backups, monitoramento e mitigação de abuso.

O workflow de release recusa publicação se o relay estiver ausente/incompatível ou se não houver certificado Authenticode.

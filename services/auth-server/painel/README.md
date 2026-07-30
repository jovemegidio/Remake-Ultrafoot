# Painel de administração do Ultrafoot

Substitui o `painel.html` de uma página só que existia aqui até 29/07/2026.
Mesma URL de sempre — `https://ultrafoot.179-198-103-30.sslip.io/painel/` — e o
atalho do launcher (`components/launcher/social-panel.tsx`) continua valendo.

## O que ele mostra

Tudo sai do servidor de contas (`../server.py`), das rotas `/admin/*`. **Não há
número inventado em tela nenhuma**: se um dado não existe no banco, a tela não
finge que existe.

| Tela          | De onde vem                                                      |
| ------------- | ---------------------------------------------------------------- |
| Visão geral   | `/admin/resumo` — contas, entradas, receita, saúde do serviço     |
| Jogadores     | `/admin/contas` + `/admin/conta` (ficha completa)                 |
| FC Hub        | `/admin/hub` — presença e chat, com moderação                     |
| Economia      | `/admin/economia` — compras, pedidos, créditos                    |
| Equipe admin  | `/admin/equipe`                                                   |
| Auditoria     | `/admin/auditoria` — o `admin_log` inteiro                        |

Ações que ele executa: banir (motivo obrigatório), desbanir, lançar crédito na
carteira e apagar mensagem do chat. Todas entram no `admin_log`.

## Quem autoriza

Ninguém aqui. O painel é uma página estática: quem decide é o servidor, olhando
a coluna `admin` da conta em cada rota `/admin/*`, e ele responde **404** para
quem não é admin — nem a existência da área vaza. Esconder botão nunca foi
controle de acesso; as telas só escolhem o que mostrar.

Promover alguém continua sendo só pelo servidor, de propósito:

    python3 /opt/ultrafoot-auth/tornar-admin.py conta@exemplo.com

## Build e publicação

O Next **não builda no drive G:** (Google Drive). Copie para disco local:

```sh
robocopy "services\auth-server\painel" C:\ultrafoot-painel /MIR /XD node_modules .next out
cd C:\ultrafoot-painel
npm install
npx next build          # gera out/, ~1,4 MB
```

Depois, da raiz do repositório:

```sh
scripts/deploy-painel.sh          # usa /c/ultrafoot-painel/out
```

O script troca o diretório inteiro de uma vez e guarda o anterior em
`/var/www/ultrafoot/painel.antigo` — voltar atrás é um `mv`.

⚠️ `basePath` é `/painel`. Sem ele o navegador pediria `/_next/...` na raiz do
site e a página abriria sem estilo nenhum. Se um dia o painel mudar de caminho,
mude junto o `PAINEL_BASE_PATH` (variável de ambiente lida pelo `next.config.mjs`).

## Duas armadilhas do nginx que já custaram tempo

O `sites-available/ultrafoot` da VPS **não está neste repositório**; estas duas
linhas precisam continuar como estão:

1. `location ^~ /painel/` — o `^~` é obrigatório. Existe mais abaixo um
   `location ~* \.(png|jpg|svg|woff2|...)$` para cache, e location por **regex
   vence prefixo**: sem o `^~`, todo `.png`, `.svg` e `.woff2` do painel caía na
   raiz do jogo e voltava 404. O sintoma é traiçoeiro — o painel abre e funciona,
   só que sem logo, sem ícone e com a fonte trocada pela do sistema.
2. O bloco do painel vem **antes** do `location /` da SPA do jogo, senão
   `/painel/` cairia no `index.html` do jogo com 200.

## Rodar contra um servidor de teste

```sh
cd C:\ultrafoot-painel
NEXT_PUBLIC_AUTH_BASE=http://127.0.0.1:8799 npx next dev
```

Em produção o `BASE` é o caminho relativo `/auth`, servido pelo mesmo nginx —
assim trocar a VPS de endereço não obriga a republicar o painel.

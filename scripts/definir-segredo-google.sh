#!/usr/bin/env bash
# LIGA O LOGIN COM GOOGLE NA VPS.
#
#   ./scripts/definir-segredo-google.sh 'GOCSPX-...'
#
# ⚠️ POR QUE ESTE SCRIPT EXISTE. Em 07/09/2026 a migracao de servidor nao levou
# o `ULTRAFOOT_GOOGLE_CLIENT_SECRET`, e o login com Google parou. O client_id e
# publico (vai na URL do consentimento e mora em `Launcher/lib/auth.ts`), mas o
# secret so existia no servidor antigo, que saiu do ar. Nao ha copia: tem de vir
# do console.cloud.google.com > APIs e Servicos > Credenciais > o cliente OAuth
# "381589978146-tkrlbf40498...".
#
# E o Google EXIGE o secret mesmo com PKCE. Conferido chamando o endpoint dele
# com o client_id e um codigo falso: respondeu `client_secret is missing`. Nao
# ha caminho sem essa credencial.
#
# O secret entra por ARGUMENTO e nunca e ecoado. Ele vai parar no historico do
# seu shell — se isso incomodar, prefixe o comando com um espaco (bash ignora
# linhas iniciadas por espaco quando HISTCONTROL contem ignorespace).

set -euo pipefail

SEGREDO="${1:-}"
if [ -z "$SEGREDO" ]; then
  echo "uso: $0 'GOCSPX-...'" >&2
  echo "pegue em console.cloud.google.com > Credenciais > cliente OAuth do Ultrafoot" >&2
  exit 1
fi

HOST="${VPS_HOST:-31.97.64.102}"
USUARIO="${VPS_USER:-root}"
CHAVE="${VPS_SSH_KEY:-$HOME/.ssh/id_ed25519_vps}"
ENV_REMOTO="/etc/ultrafoot/auth.env"

# O segredo viaja pelo STDIN da sessao SSH, nao na linha de comando: argumento
# de `ssh` aparece no `ps` da VPS para qualquer processo que estiver olhando.
printf '%s' "$SEGREDO" | ssh -i "$CHAVE" -o StrictHostKeyChecking=accept-new "$USUARIO@$HOST" '
set -e
novo=$(cat)
# Reescreve SO a linha do secret. Um `cat >` no arquivo inteiro apagaria a chave
# da licenca junto, e o registro do jogo voltaria a dar 503.
tmp=$(mktemp)
grep -v "^ULTRAFOOT_GOOGLE_CLIENT_SECRET=" '"$ENV_REMOTO"' > "$tmp"
printf "ULTRAFOOT_GOOGLE_CLIENT_SECRET=%s\n" "$novo" >> "$tmp"
cat "$tmp" > '"$ENV_REMOTO"'
rm -f "$tmp"
chown root:root '"$ENV_REMOTO"'; chmod 600 '"$ENV_REMOTO"'
systemctl restart ultrafoot-auth
'

sleep 2

# CONFERE PELO COMPORTAMENTO, nao por "o comando nao deu erro". Enquanto faltar
# a credencial a rota responde 503 com a causa; ligada, ela passa a responder
# 401 para um codigo falso — que e o certo, porque o codigo E falso.
codigo=$(curl -s -o /dev/null -w '%{http_code}' -m 20 \
  -X POST "https://ultrafoot.zyntraerp.com.br/auth/google" \
  -H "Content-Type: application/json" \
  -d '{"code":"x","code_verifier":"y","redirect_uri":"http://127.0.0.1:1/"}')

case "$codigo" in
  401) echo "OK — o Google esta configurado (401 e a resposta certa para o codigo falso deste teste)." ;;
  503) echo "AINDA NAO — o servidor continua sem a credencial. Confira se colou o secret certo." >&2; exit 1 ;;
  *)   echo "resposta inesperada: HTTP $codigo — veja 'journalctl -u ultrafoot-auth -n 50'." >&2; exit 1 ;;
esac

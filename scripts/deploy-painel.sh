#!/usr/bin/env bash
# Publica o PAINEL DE ADMINISTRACAO na VPS.
#
# Uso:  ./deploy-painel.sh [caminho-do-out]
#   ex: ./deploy-painel.sh /c/ultrafoot-painel/out
#
# O painel e um site estatico exportado de services/auth-server/painel/. O build
# tem de acontecer em DISCO LOCAL (C:) — no drive do Google Drive o Next nao
# builda. Receita completa:
#
#   robocopy "services\auth-server\painel" C:\ultrafoot-painel /MIR /XD node_modules .next out
#   cd C:\ultrafoot-painel && npm install && npx next build
#   scripts/deploy-painel.sh
#
# A troca e feita por diretorio novo + mv: um `scp` por cima deixaria o painel
# meio antigo meio novo por alguns segundos, e o _next/ com hash de outra versao
# quebra a pagina inteira.

set -euo pipefail

OUT="${1:-/c/ultrafoot-painel/out}"
VPS="root@179.198.103.30"
CHAVE="$HOME/.ssh/id_ed25519_vps"
DESTINO="/var/www/ultrafoot/painel"

[ -f "$OUT/index.html" ] || { echo "ERRO: $OUT/index.html nao existe — o build nao terminou?"; exit 1; }
[ -d "$OUT/_next" ] || { echo "ERRO: $OUT/_next nao existe — export incompleto"; exit 1; }
grep -q '/painel/_next/' "$OUT/index.html" || {
  echo "ERRO: o index.html nao aponta para /painel/_next — o basePath saiu errado"; exit 1; }

# A pagina do recibo viaja JUNTO com o painel, copiada da unica copia que existe
# (public/recibo/). Assim o botao "emitir" funciona sem depender de quando a
# versao web do jogo for publicada — e continua havendo um so template para
# manter em dia. O logo vai junto porque o <img> do recibo e relativo.
RECIBO="$(dirname "$0")/../public/recibo/index.html"
LOGO="$(dirname "$0")/../public/brand/agencia-do-japa.png"
[ -f "$RECIBO" ] || { echo "ERRO: $RECIBO nao existe — o painel iria sem a pagina do recibo"; exit 1; }
echo "==> incluindo a pagina do recibo"
mkdir -p "$OUT/recibo" "$OUT/brand"
cp "$RECIBO" "$OUT/recibo/index.html"
[ -f "$LOGO" ] && cp "$LOGO" "$OUT/brand/agencia-do-japa.png"

echo "==> empacotando $OUT"
tar czf /tmp/ultrafoot-painel.tar.gz -C "$OUT" .

echo "==> enviando"
scp -i "$CHAVE" -o BatchMode=yes /tmp/ultrafoot-painel.tar.gz "$VPS:/tmp/ultrafoot-painel.tar.gz"

echo "==> instalando"
ssh -i "$CHAVE" -o BatchMode=yes "$VPS" bash -s <<REMOTO
set -euo pipefail
rm -rf "$DESTINO.novo"
mkdir -p "$DESTINO.novo"
tar xzf /tmp/ultrafoot-painel.tar.gz -C "$DESTINO.novo"
rm -f /tmp/ultrafoot-painel.tar.gz
[ -f "$DESTINO.novo/index.html" ] || { echo "ERRO: pacote sem index.html"; exit 1; }
chown -R www-data:www-data "$DESTINO.novo"
rm -rf "$DESTINO.antigo"
[ -e "$DESTINO" ] && mv -T "$DESTINO" "$DESTINO.antigo"
mv -T "$DESTINO.novo" "$DESTINO"
nginx -t >/dev/null && systemctl reload nginx
echo "painel instalado: \$(ls -1 $DESTINO | tr '\n' ' ')"
REMOTO

rm -f /tmp/ultrafoot-painel.tar.gz
echo "==> conferindo de fora"
curl -s -o /dev/null -w "    painel: %{http_code}\n" "https://ultrafoot.179-198-103-30.sslip.io/painel/"
curl -s -o /dev/null -w "    recibo: %{http_code}\n" "https://ultrafoot.179-198-103-30.sslip.io/painel/recibo/"
echo "pronto: https://ultrafoot.179-198-103-30.sslip.io/painel/"

#!/usr/bin/env bash
# Publica a VERSAO WEB do Ultrafoot na VPS.
#
# Uso:  ./deploy-web-vps.sh <versao> [caminho-do-out]
#   ex: ./deploy-web-vps.sh 1.0.199 /c/ultrafoot-web/out
#
# Por que existe: publicar a mao e 5 passos e um deles (trocar o link) tem de ser
# atomico. Cada versao vai para releases/<versao> e o link `current` passa a
# apontar para ela num unico comando — o site nunca fica meio antigo meio novo, e
# voltar atras e trocar o link de volta, sem reenviar 471 MB.
#
# O tar viaja como UM arquivo: enviar 39 mil arquivos soltos por scp levaria horas.

set -euo pipefail

VERSAO="${1:?informe a versao, ex: 1.0.199}"
OUT="${2:-/c/ultrafoot-web/out}"
VPS="root@179.198.103.30"
CHAVE="$HOME/.ssh/id_ed25519_vps"
RAIZ="/var/www/ultrafoot"

[ -f "$OUT/index.html" ] || { echo "ERRO: $OUT/index.html nao existe — o build nao terminou?"; exit 1; }

echo "==> empacotando $OUT"
tar czf /tmp/ultrafoot-web-$VERSAO.tar.gz -C "$OUT" .
TAM=$(du -m /tmp/ultrafoot-web-$VERSAO.tar.gz | cut -f1)
echo "    ${TAM} MB"

echo "==> enviando para a VPS"
scp -i "$CHAVE" -o BatchMode=yes /tmp/ultrafoot-web-$VERSAO.tar.gz "$VPS:$RAIZ/entrada.tar.gz"

echo "==> instalando a versao $VERSAO"
ssh -i "$CHAVE" -o BatchMode=yes "$VPS" bash -s <<REMOTO
set -euo pipefail
rm -rf "$RAIZ/releases/$VERSAO.novo"
mkdir -p "$RAIZ/releases/$VERSAO.novo"
tar xzf "$RAIZ/entrada.tar.gz" -C "$RAIZ/releases/$VERSAO.novo"
rm -f "$RAIZ/entrada.tar.gz"
[ -f "$RAIZ/releases/$VERSAO.novo/index.html" ] || { echo "ERRO: pacote sem index.html"; exit 1; }
rm -rf "$RAIZ/releases/$VERSAO"
mv "$RAIZ/releases/$VERSAO.novo" "$RAIZ/releases/$VERSAO"
chown -R www-data:www-data "$RAIZ/releases/$VERSAO"
# A TROCA. ln -sfn num diretorio temporario + mv e o jeito atomico: o link nunca
# fica inexistente entre um comando e outro.
ln -sfn "$RAIZ/releases/$VERSAO" "$RAIZ/current.novo"
mv -T "$RAIZ/current.novo" "$RAIZ/current"
nginx -t >/dev/null && systemctl reload nginx
echo "current -> \$(readlink -f $RAIZ/current)"
# Guarda so as 3 ultimas versoes: 471 MB cada enche 48 GB rapido.
ls -1dt "$RAIZ"/releases/*/ 2>/dev/null | tail -n +4 | xargs -r rm -rf
echo "versoes mantidas:"; ls -1 "$RAIZ/releases"
REMOTO

rm -f /tmp/ultrafoot-web-$VERSAO.tar.gz
echo "==> verificando de fora"
curl -s -o /dev/null -w "    home: %{http_code}\n" "https://ultrafoot.179-198-103-30.sslip.io/"
echo "pronto: https://ultrafoot.179-198-103-30.sslip.io/"

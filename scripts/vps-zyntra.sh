#!/usr/bin/env bash
# ULTRAFOOT NA VPS zyntraerp — versao web + canal de atualizacao do launcher.
#
#   ./vps-zyntra.sh auditar    # SO LE. Mostra o que ja existe no servidor.
#   ./vps-zyntra.sh preparar   # cria o que falta (idempotente)
#   ./vps-zyntra.sh publicar   # envia o build web e troca o link
#   ./vps-zyntra.sh downloads  # envia instalador + manifestos do launcher
#
# ⚠️ ESTE SERVIDOR HOSPEDA OUTRA COISA (zyntraerp.com.br). Todo comando aqui foi
# escrito para conviver, nao para assumir. As regras, e o motivo de cada uma:
#
#   1. NENHUM `default_server`. A config de referencia do projeto usa
#      `listen 80 default_server` — copiar aquilo aqui faria o Ultrafoot
#      responder por QUALQUER dominio que chegue no IP, inclusive o ERP. O
#      nosso bloco atende so `ultrafoot.zyntraerp.com.br`.
#   2. NENHUM arquivo de config existente e editado. Criamos UM arquivo novo em
#      sites-available e UM link em sites-enabled. Nada mais e tocado.
#   3. `nginx -t` antes de qualquer reload, e `reload` — nunca `restart`.
#      Restart derruba o ERP por alguns segundos; reload nao derruba nada.
#   4. Diretorios so em caminhos que ainda nao existem. Se ja existir algo no
#      lugar, o script PARA e mostra o que achou, em vez de escrever por cima.
#   5. certbot so para o nosso host, nunca `--expand` num certificado alheio.
#
# Variaveis:
#   VPS_HOST   (padrao 31.97.64.102)
#   VPS_PWFILE arquivo com a senha (usado via plink/pscp do PuTTY no Windows)
#   VPS_HOSTKEY impressao digital SHA256 da chave do servidor

set -euo pipefail

HOST="${VPS_HOST:-31.97.64.102}"
USUARIO="${VPS_USER:-root}"
DOMINIO="${VPS_DOMINIO:-ultrafoot.zyntraerp.com.br}"
# A MESMA CHAVE DO DEPLOY DO ERP que ja vive neste servidor. Nao ha senha em
# lugar nenhum deste fluxo, e e de proposito: senha em script vaza para o
# historico do shell, para o log de CI e para o proximo print que alguem mandar.
CHAVE="${VPS_SSH_KEY:-$HOME/.ssh/id_ed25519_vps}"

# Onde o Ultrafoot vive. Tudo debaixo de um prefixo so, para ser trivial
# conferir — e remover — sem tocar em mais nada.
RAIZ="/var/www/ultrafoot"
DOWNLOADS="/var/www/ultrafoot/downloads"
CONF_NOME="ultrafoot-zyntra.conf"

remoto() {
  ssh -i "$CHAVE" -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=20 "$USUARIO@$HOST" "$@"
}

enviar() {
  scp -i "$CHAVE" -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=20 "$1" "$USUARIO@$HOST:$2"
}

# ─────────────────────────────────────────────────────────────────────────────
# AUDITAR — so leitura. Nada aqui muda o servidor.
# ─────────────────────────────────────────────────────────────────────────────
auditar() {
  remoto 'bash -s' <<'REMOTO'
set -u
echo "=== IDENTIDADE ==="
hostname; grep -h PRETTY_NAME /etc/os-release 2>/dev/null
uptime | sed 's/^ *//'

echo; echo "=== DISCO ==="
df -h / /var 2>/dev/null | grep -v ^Filesystem | sort -u

echo; echo "=== MEMORIA ==="
free -h 2>/dev/null | head -2

echo; echo "=== QUEM ESCUTA 80/443 ==="
(ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null) | grep -E ':80 |:443 ' || echo "  (ninguem)"

echo; echo "=== SERVIDOR WEB ==="
for s in nginx apache2 httpd caddy; do
  if command -v "$s" >/dev/null 2>&1; then
    printf '  %s instalado: ' "$s"; "$s" -v 2>&1 | head -1
    systemctl is-active "$s" 2>/dev/null | sed 's/^/    estado: /'
  fi
done

echo; echo "=== VHOSTS NGINX JA EXISTENTES (nao serao tocados) ==="
if [ -d /etc/nginx ]; then
  ls -1 /etc/nginx/sites-enabled/ 2>/dev/null | sed 's/^/  sites-enabled: /' || true
  ls -1 /etc/nginx/conf.d/ 2>/dev/null | sed 's/^/  conf.d: /' || true
  echo "  --- server_name declarados ---"
  grep -RhoP 'server_name\s+\K[^;]+' /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null \
    | tr ' ' '\n' | grep -v '^$' | sort -u | sed 's/^/    /'
fi

echo; echo "=== DOCKER (pode estar segurando as portas) ==="
command -v docker >/dev/null 2>&1 && docker ps --format '  {{.Names}} {{.Ports}}' 2>/dev/null | head -10 || echo "  (sem docker)"

echo; echo "=== /var/www ==="
ls -la /var/www 2>/dev/null | sed 's/^/  /' || echo "  (nao existe)"

echo; echo "=== OS CAMINHOS QUE O ULTRAFOOT USARIA ==="
for p in /var/www/ultrafoot /var/www/ultrafoot-downloads /etc/nginx/sites-available/ultrafoot-zyntra.conf; do
  if [ -e "$p" ]; then echo "  JA EXISTE: $p"; else echo "  livre:     $p"; fi
done

echo; echo "=== CERTIFICADOS ==="
command -v certbot >/dev/null 2>&1 && certbot certificates 2>/dev/null | grep -E 'Certificate Name|Domains' | sed 's/^/  /' || echo "  (certbot ausente)"
REMOTO
}

# ─────────────────────────────────────────────────────────────────────────────
# PREPARAR — cria diretorios, vhost e TLS. Idempotente.
# ─────────────────────────────────────────────────────────────────────────────
preparar() {
  # ⚠️ ESTE SERVIDOR JA ESTAVA PROVISIONADO — descoberto na auditoria, e por
  # pouco. A versao anterior desta funcao criava um vhost novo
  # (`ultrafoot-zyntra.conf`) para `ultrafoot.zyntraerp.com.br`; como o
  # `/etc/nginx/sites-enabled/ultrafoot.conf` ja atende esse mesmo nome, o
  # resultado seria dois blocos disputando o dominio — o nginx escolheria o
  # primeiro que carregasse e o outro viraria configuracao morta que ninguem
  # encontra depois. O certbot ja emitiu o certificado, e o `/downloads/`,
  # `/auth/`, `/relay/` e `/atualizacoes/` ja estao mapeados la.
  #
  # Entao aqui NAO se escreve nginx. So se garante o andaime de arquivos que
  # falta e se CONFERE que o vhost esperado continua de pe.
  remoto "RAIZ='$RAIZ' DOWNLOADS='$DOWNLOADS' DOMINIO='$DOMINIO' bash -s" <<'REMOTO'
set -euo pipefail

# ⚠️ DOIS DEFEITOS EMPILHADOS MORAVAM NESTA LINHA, e juntos produziam o pior
# sintoma possivel: exit 1 com ZERO byte de saida, como se o ssh nao tivesse
# rodado nada.
#   1. `grep -r` PULA SYMLINK em silencio, e tudo em `sites-enabled` e symlink
#      para `sites-available` — a busca voltava vazia num servidor que atende
#      o dominio. (Foi o mesmo falso negativo que encurtou a lista de dominios
#      da auditoria.) Por isso `-R`.
#   2. `set -o pipefail` faz `CONF=$(grep ... | head -1)` herdar o exit 1 do
#      grep mesmo com o `head` bem-sucedido; com `set -e`, o script morre ali,
#      ANTES do `echo` que explicaria o problema. Por isso o `|| true`.
# ⚠️ `-R` E NAO `-r`. Tudo em `sites-enabled` e symlink para
# `sites-available`, e o `grep -r` PULA symlink em silencio: a busca voltava
# vazia e o script concluia "nenhum vhost atende este dominio" num servidor que
# atende. O mesmo falso negativo encurtou a lista de dominios da auditoria.
CONF=$(grep -Rl "server_name .*$DOMINIO" /etc/nginx/sites-enabled/ 2>/dev/null | head -1 || true)
if [ -z "$CONF" ]; then
  echo "ERRO: nenhum vhost atende $DOMINIO. Este script NAO cria vhost neste"
  echo "      servidor de proposito (ha quatro ERPs em producao nele)."
  exit 1
fi
echo "vhost em uso: $CONF"
grep -E 'root |ssl_certificate ' "$CONF" | sed 's/^ */  /'

mkdir -p "$RAIZ/releases" "$DOWNLOADS"
chown www-data:www-data "$RAIZ/releases" "$DOWNLOADS"

# A raiz do site aponta para `current`. Sem ele o nginx responde 500 — foi
# exatamente o estado encontrado. Uma pagina de espera evita que o dominio
# fique quebrado entre o provisionamento e o primeiro deploy.
if [ ! -e "$RAIZ/current" ]; then
  mkdir -p "$RAIZ/releases/espera"
  cat > "$RAIZ/releases/espera/index.html" <<'HTML'
<!doctype html><meta charset="utf-8"><title>Ultrafoot</title>
<body style="margin:0;display:grid;place-items:center;height:100vh;background:#071316;color:#f4f8f7;font:15px system-ui">
Ultrafoot — publicacao em andamento.
</body>
HTML
  chown -R www-data:www-data "$RAIZ/releases/espera"
  ln -sfn "$RAIZ/releases/espera" "$RAIZ/current"
  echo "current criado (pagina de espera)"
else
  echo "current -> $(readlink -f "$RAIZ/current")"
fi

# ⚠️ `nginx -t` sem reload: nada foi alterado aqui, e recarregar um nginx que
# atende quatro ERPs sem necessidade e risco de graca.
nginx -t
REMOTO
}

# ─────────────────────────────────────────────────────────────────────────────
# TLS — certificado so para o nosso host.
# ─────────────────────────────────────────────────────────────────────────────
tls() {
  # O certbot ja emitiu o certificado deste dominio. Esta funcao so confere —
  # rodar `certbot --nginx` de novo reescreveria o vhost que ja funciona.
  remoto "DOMINIO='$DOMINIO' bash -s" <<'REMOTO'
set -euo pipefail
certbot certificates 2>/dev/null | grep -A3 "$DOMINIO" | sed 's/^/  /' || echo "  (certbot nao encontrou o certificado)"
REMOTO
}

# ─────────────────────────────────────────────────────────────────────────────
# PUBLICAR — envia o build web e troca o link atomicamente.
# ─────────────────────────────────────────────────────────────────────────────
publicar() {
  local versao="${1:?informe a versao, ex: 1.0.388}"
  local out="${2:-out}"
  [ -f "$out/index.html" ] || { echo "ERRO: $out/index.html nao existe"; exit 1; }

  echo "==> empacotando $out"
  tar czf "/tmp/uf-web-$versao.tar.gz" -C "$out" .
  echo "    $(du -m "/tmp/uf-web-$versao.tar.gz" | cut -f1) MB"

  echo "==> enviando"
  enviar "/tmp/uf-web-$versao.tar.gz" "$RAIZ/entrada.tar.gz"

  echo "==> instalando"
  remoto "VERSAO='$versao' RAIZ='$RAIZ' bash -s" <<'REMOTO'
set -euo pipefail
rm -rf "$RAIZ/releases/$VERSAO.novo"
mkdir -p "$RAIZ/releases/$VERSAO.novo"
tar xzf "$RAIZ/entrada.tar.gz" -C "$RAIZ/releases/$VERSAO.novo"
rm -f "$RAIZ/entrada.tar.gz"
[ -f "$RAIZ/releases/$VERSAO.novo/index.html" ] || { echo "ERRO: pacote sem index.html"; exit 1; }
rm -rf "$RAIZ/releases/$VERSAO"
mv "$RAIZ/releases/$VERSAO.novo" "$RAIZ/releases/$VERSAO"
chown -R www-data:www-data "$RAIZ/releases/$VERSAO"
# A troca e atomica: `ln -sfn` num nome temporario e `mv -T` por cima. O site
# nunca fica meio antigo meio novo, e voltar atras e trocar o link de volta.
ln -sfn "$RAIZ/releases/$VERSAO" "$RAIZ/current.novo"
mv -T "$RAIZ/current.novo" "$RAIZ/current"
echo "current -> $(readlink -f "$RAIZ/current")"
# Guarda as 3 ultimas: cada uma pesa centenas de MB.
ls -1dt "$RAIZ"/releases/*/ 2>/dev/null | tail -n +4 | xargs -r rm -rf
echo "versoes mantidas:"; ls -1 "$RAIZ/releases"
df -h /var | tail -1
REMOTO
  rm -f "/tmp/uf-web-$versao.tar.gz"
}

# ─────────────────────────────────────────────────────────────────────────────
# DOWNLOADS — manifestos e instalador do canal de atualizacao.
# ─────────────────────────────────────────────────────────────────────────────
downloads() {
  local arquivo="${1:?informe o arquivo a enviar}"
  local nome; nome="$(basename "$arquivo")"
  echo "==> enviando $nome ($(du -m "$arquivo" | cut -f1) MB)"
  enviar "$arquivo" "$DOWNLOADS/$nome"
  remoto "chown www-data:www-data '$DOWNLOADS/$nome'; ls -la '$DOWNLOADS/$nome'"
}

case "${1:-auditar}" in
  auditar)   auditar ;;
  preparar)  preparar ;;
  tls)       tls ;;
  publicar)  shift; publicar "$@" ;;
  downloads) shift; downloads "$@" ;;
  *) echo "uso: $0 {auditar|preparar|tls|publicar <versao> [out]|downloads <arquivo>}"; exit 1 ;;
esac

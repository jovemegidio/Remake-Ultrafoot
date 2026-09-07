#!/usr/bin/env bash
# TRAZ A COPIA DE SEGURANCA DO SERVIDOR PARA FORA DELE.
#
#   ./scripts/baixar-backup.sh            # traz o backup mais recente
#   ./scripts/baixar-backup.sh --tudo     # traz tudo que estiver no servidor
#
# ⚠️ POR QUE A METADE DE FORA E A QUE IMPORTA.
#
# O servidor ja faz backup sozinho (`ultrafoot-backup.timer`, todo dia as 04:10).
# Mas backup que mora na mesma maquina cobre erro humano e corrupcao de arquivo —
# NAO cobre perder a maquina. E foi exatamente isso que aconteceu em 05/09/2026:
# o servidor antigo saiu do ar levando junto o banco de contas, os saves na nuvem
# e a chave privada da licenca. Nao havia copia em lugar nenhum fora dele.
#
# A unica coisa que salvou os compradores naquele dia foi um CSV de emissao que
# por acaso vivia no computador de casa. Este script existe para que a proxima
# vez nao dependa de acaso.
#
# ONDE ELE GRAVA: ~/.ultrafoot-keys/backups/ — a mesma pasta do segredo de
# licenca e da chave do updater, de proposito. Um lugar so para lembrar de levar
# para fora do computador tambem (pendrive, nuvem pessoal, o que for). Backup em
# um disco so ainda e um disco so.

set -euo pipefail

HOST="${VPS_HOST:-31.97.64.102}"
USUARIO="${VPS_USER:-root}"
CHAVE="${VPS_SSH_KEY:-$HOME/.ssh/id_ed25519_vps}"
REMOTO="/var/backups/ultrafoot"
LOCAL="${ULTRAFOOT_BACKUPS:-$HOME/.ultrafoot-keys/backups}"

tudo=0
[ "${1:-}" = "--tudo" ] && tudo=1

mkdir -p "$LOCAL"
chmod 700 "$LOCAL"

echo "==> o que existe no servidor"
ssh -i "$CHAVE" -o BatchMode=yes -o ConnectTimeout=20 "$USUARIO@$HOST" \
  "ls -lh $REMOTO/ 2>/dev/null | tail -n +2" || {
    echo "ERRO: nao consegui listar $REMOTO no servidor." >&2
    echo "O backup automatico ja rodou? Veja: systemctl list-timers ultrafoot-backup.timer" >&2
    exit 1
  }

if [ "$tudo" = "1" ]; then
  padrao="$REMOTO/*"
else
  # So o dia mais recente. `date` do servidor, e nao daqui: fuso diferente ja
  # fez script baixar "o de hoje" que ainda nao existia.
  dia="$(ssh -i "$CHAVE" -o BatchMode=yes "$USUARIO@$HOST" \
    "ls -1 $REMOTO/ | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | sort -u | tail -1")"
  [ -n "$dia" ] || { echo "ERRO: nenhum backup no servidor." >&2; exit 1; }
  echo
  echo "==> trazendo o dia $dia"
  padrao="$REMOTO/*${dia}*"
fi

# shellcheck disable=SC2086
scp -i "$CHAVE" -o BatchMode=yes -o ConnectTimeout=20 "$USUARIO@$HOST:$padrao" "$LOCAL/"

echo
echo "==> conferindo o que chegou"
falhas=0
for arq in "$LOCAL"/auth-*.db.gz; do
  [ -e "$arq" ] || continue
  # ⚠️ CONFERIR AQUI, e nao confiar no `integrity_check` que o servidor ja fez.
  # O que interessa e se o arquivo restaura DEPOIS de atravessar a rede: copia
  # truncada tem o mesmo nome e o mesmo ar de copia boa.
  tmp="$(mktemp)"
  if ! gzip -dc "$arq" > "$tmp" 2>/dev/null; then
    echo "  FALHOU (gzip): $(basename "$arq")"; falhas=$((falhas + 1)); rm -f "$tmp"; continue
  fi
  # ⚠️ NAO DEPENDER DO `sqlite3` DE LINHA DE COMANDO. Ele nao existe no Windows,
  # onde este script mais roda — e a primeira versao caia num "ok (gzip)" que
  # so provava que o arquivo descompacta, nao que ele RESTAURA. Backup conferido
  # pela metade da a mesma sensacao de seguranca de um conferido inteiro.
  # O Python 3 traz o sqlite3 embutido e esta em toda maquina do projeto.
  linha=""
  if command -v sqlite3 >/dev/null 2>&1; then
    estado="$(sqlite3 "$tmp" 'PRAGMA integrity_check;' 2>&1 | head -1)"
    contas="$(sqlite3 "$tmp" 'SELECT COUNT(*) FROM contas;' 2>/dev/null || echo '?')"
    licencas="$(sqlite3 "$tmp" 'SELECT COUNT(*) FROM licencas;' 2>/dev/null || echo '?')"
    linha="$estado|$contas|$licencas"
  elif command -v python >/dev/null 2>&1 || command -v python3 >/dev/null 2>&1; then
    py="$(command -v python3 || command -v python)"
    linha="$("$py" -c "
import sqlite3, sys
con = sqlite3.connect(sys.argv[1])
estado = con.execute('PRAGMA integrity_check').fetchone()[0]
def conta(t):
    try: return con.execute('SELECT COUNT(*) FROM ' + t).fetchone()[0]
    except Exception: return '?'
print('%s|%s|%s' % (estado, conta('contas'), conta('licencas')))
" "$tmp" 2>/dev/null)"
  fi

  if [ -z "$linha" ]; then
    echo "  NAO CONFERIDO: $(basename "$arq") — sem sqlite3 nem python nesta maquina"
    falhas=$((falhas + 1))
  else
    estado="${linha%%|*}"; resto="${linha#*|}"
    contas="${resto%%|*}"; licencas="${resto#*|}"
    if [ "$estado" = "ok" ]; then
      echo "  ok: $(basename "$arq")  —  $contas conta(s), $licencas licenca(s)"
    else
      echo "  FALHOU (integridade): $(basename "$arq")  —  $estado"; falhas=$((falhas + 1))
    fi
  fi
  rm -f "$tmp"
done

echo
if [ "$falhas" -gt 0 ]; then
  echo "$falhas arquivo(s) NAO conferem. Nao considere isto um backup." >&2
  exit 1
fi

echo "Backup em: $LOCAL"
echo "Leve uma copia para FORA deste computador — pendrive, nuvem pessoal, o que for."
echo "Backup que vive num disco so ainda e um disco so."

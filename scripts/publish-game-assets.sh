#!/usr/bin/env bash
# Empacota os assets visuais/áudio do jogo e publica no release "game-assets".
# A CI (desktop-platforms.yml) baixa esse zip antes de buildar Mac/Linux — assim a
# nuvem monta o jogo COMPLETO mesmo com os assets fora do Git (.gitignore).
#
# IMPORTANTE: rode de um DISCO LOCAL confiável. No Google Drive (G:) alguns arquivos
# ficam "só na nuvem" e corrompem a leitura em massa. Se precisar usar o G:, marque as
# pastas de assets como "Disponível off-line" no Google Drive antes de rodar.
#
# Requisitos: 7-Zip (usa o do projeto) e GitHub CLI (`gh`) autenticado.
# Uso (na raiz do projeto):  bash scripts/publish-game-assets.sh
set -euo pipefail

SZ="src-tauri/resources/extractor/7z.exe"
[ -x "$SZ" ] || SZ="7z"   # cai para o 7z do sistema se não achar o do projeto
OUT="game-assets.zip"
REPO="jovemegidio/Ultrafoot26"
TAG="game-assets"

DIRS=(
  public/escudos public/jogadores public/camisas public/camisas2 public/camisas3
  public/escudos-mini public/escudos-selecoes public/selecoes public/trofeus
  public/kits-imported public/audio/commentary
)

echo "==> 1/4 Conferindo pastas de assets"
for d in "${DIRS[@]}"; do
  if [ ! -d "$d" ] || [ -z "$(ls -A "$d" 2>/dev/null)" ]; then
    echo "ERRO: '$d' ausente/vazio. Os assets precisam estar locais para empacotar."
    exit 1
  fi
done

echo "==> 2/4 Empacotando ($OUT) — pode demorar (muitos arquivos)"
rm -f "$OUT"
# -xr!desktop.ini remove os arquivos de config do Windows/Google Drive.
"$SZ" a -tzip -mx=1 "-xr!desktop.ini" "$OUT" "${DIRS[@]}"

echo "==> 3/4 Testando integridade do zip"
"$SZ" t "$OUT" | grep -qi "Everything is Ok" || {
  echo "ERRO: zip corrompido (provável arquivo 'só na nuvem' no Google Drive)."
  echo "Marque as pastas como 'Disponível off-line' ou rode de um disco local."
  exit 1
}

echo "==> 4/4 Publicando no release '$TAG'"
if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  gh release upload "$TAG" "$OUT" --repo "$REPO" --clobber
else
  gh release create "$TAG" "$OUT" --repo "$REPO" \
    --title "Assets do jogo (para build na nuvem)" \
    --notes "Pacote de assets visuais/áudio usado pela CI para buildar Mac/Linux. Não é para jogadores."
fi

echo ""
echo "Pronto! Agora dispare o build multiplataforma:"
echo "  gh workflow run desktop-platforms.yml --ref feat/launcher-desktop --repo $REPO"

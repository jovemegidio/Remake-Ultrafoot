#!/usr/bin/env bash
# Builda o Ultrafoot 26 para LINUX (.AppImage + .deb).
#
# IMPORTANTE: rode DENTRO de um Linux que TENHA os assets do jogo (WSL2 Ubuntu,
# VM ou PC Linux). A CI da nuvem NÃO serve: os assets pesados (public/escudos,
# public/jogadores, public/camisas*, ...) são gitignored e não existem num
# checkout limpo — por isso o build precisa acontecer onde eles estão.
#
# Uso (dentro do WSL2/Linux, na raiz do projeto):
#   bash scripts/build-linux.sh
set -euo pipefail

echo "==> 1/5 Dependências de sistema (Ubuntu/Debian)"
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev patchelf \
  libayatana-appindicator3-dev build-essential curl wget file libssl-dev

echo "==> 2/5 Rust (instala se faltar)"
if ! command -v cargo >/dev/null 2>&1; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  # shellcheck disable=SC1090
  source "$HOME/.cargo/env"
fi

echo "==> 3/5 Confere os assets (precisam existir e não estar vazios)"
missing=0
for d in public/escudos public/jogadores; do
  if [ ! -d "$d" ] || [ -z "$(ls -A "$d" 2>/dev/null)" ]; then
    echo "   ERRO: '$d' ausente ou vazio."
    missing=1
  fi
done
if [ "$missing" = "1" ]; then
  echo "Copie os assets do jogo para estas pastas antes de buildar (eles não estão no Git)."
  exit 1
fi

echo "==> 4/5 Dependências do projeto (npm)"
npm install

echo "==> 5/5 Build Linux (Tauri: AppImage + deb)"
npx tauri build --config src-tauri/tauri.linux.conf.json

echo ""
echo "==> Concluído. Artefatos gerados:"
find src-tauri/target/release/bundle -type f \( -name "*.AppImage" -o -name "*.deb" \) -print

echo ""
echo "Distribua o .AppImage: o jogador Linux baixa, dá 'chmod +x' e executa (sem instalar)."

# Ultrafoot Launcher

App desktop (Tauri) que **baixa, instala e atualiza** o Ultrafoot 26 na máquina do
jogador — em **modo silencioso** — sem precisar atualizar por dentro do jogo.

- UI: Next.js (export estático em `out/`), reaproveitando os componentes em `components/launcher/`.
- Backend nativo: Rust em `src-tauri/` (`src/lib.rs`).
- Dados do jogo: `lib/ultrafoot-data.ts` (versão/changelog/notícias). A **última versão real**
  é confirmada em runtime pelo `latest.json` do GitHub.

## O que o launcher faz

1. **Detecta** a versão instalada do jogo lendo o registro do Windows (`get_installed_game`).
2. **Consulta** a última versão publicada em
   `github.com/jovemegidio/Ultrafoot26/releases/latest/download/latest.json` (`fetch_latest`).
3. **Baixa** o `setup.exe` com progresso real e **instala/atualiza em silêncio** rodando
   `setup.exe /S` (`download_and_install`).
4. **Abre** o jogo instalado (`launch_game`).

O botão único mostra **Instalar** / **Atualizar** / **Jogar** conforme o estado real.

---

## Pré-requisitos (uma vez por máquina)

- Node + **pnpm** (já usado no projeto).
- **Rust** (stable) + toolchain MSVC — igual ao do jogo.
- **Importante:** compile a partir de um **disco local (C:)**. A pasta do Google Drive (`G:`)
  não builda (o Next/Tauri falha com `Get-Volume … DriveLetter G` e I/O lento). Copie o projeto
  para, por exemplo, `C:\ultrafoot-launcher` antes de buildar.

## Rodar em desenvolvimento

```bash
cd Launcher
pnpm install
pnpm tauri:dev
```

No navegador puro (`pnpm dev`) a UI abre com download **simulado** (fallback), útil para mexer no visual.

## Gerar os ícones (uma vez, opcional)

Os ícones do jogo já foram copiados para `src-tauri/icons`, então o build já funciona.
Para regenerar a partir da arte do launcher:

```bash
cd Launcher
pnpm tauri:icon         # usa ../public/games/ultrafoot-icon.png
```

## Buildar o instalador do launcher

```bash
cd Launcher
pnpm tauri:build
```

Saída (NSIS): `src-tauri/target/release/bundle/nsis/Ultrafoot Launcher_<versão>_x64-setup.exe`.
Esse instalador suporta modo silencioso: `"...setup.exe" /S`.

> Assinatura Authenticode (opcional): assine o `-setup.exe` do launcher com o mesmo
> certificado do jogo (`scripts/sign-installer.ps1` na raiz) antes de distribuir.

---

## Distribuir para os jogadores

### Quem ainda NÃO tem o jogo
Entregue o `Ultrafoot Launcher_<versão>_x64-setup.exe`. Ao abrir, o launcher mostra
**Instalar**, baixa o jogo do GitHub e instala em silêncio.

### Quem JÁ tem o jogo (launcher automático e silencioso)
O instalador do **jogo** passa a embutir o launcher e instalá-lo em silêncio no
pós-instalação (hook NSIS). Fluxo a cada nova build do jogo:

```bash
# 1) builda o launcher (em C:)
cd Launcher && pnpm tauri:build

# 2) coloca o setup do launcher dentro dos resources do jogo
cd ..                       # raiz do projeto
node scripts/stage-launcher.mjs        # copia p/ src-tauri/resources/launcher/UltrafootLauncher-setup.exe

# 3) builda o jogo normalmente
npm run tauri:build
```

Assim, quando o jogador atualizar o jogo **uma última vez** (pelo caminho atual), o
instalador do jogo instala o Ultrafoot Launcher em silêncio. Dali em diante, todas as
atualizações passam a ser feitas pelo launcher.

Se a pasta `src-tauri/resources/launcher/` estiver vazia, o build do jogo funciona
normalmente e o passo do launcher é ignorado.

---

## O que mudou no JOGO (resumo)

- **Abrir o jogo abre o launcher primeiro:** ao ser iniciado direto (atalho/`.exe`),
  o jogo procura o launcher instalado, abre-o e se encerra. O launcher abre o jogo com
  `--via-launcher`, e aí o jogo roda normalmente. Sem launcher instalado, o jogo abre
  direto (nunca trava o jogador). Ao clicar **Jogar** no launcher, ele fecha e o jogo assume.
- **Sem updater in-game:** o plugin `tauri-plugin-updater` não é mais registrado
  (`src-tauri/src/lib.rs`) e `updater:default` saiu das capabilities. O jogo não baixa
  nem instala atualização sozinho.
- **Checagem de versão preservada:** `lib/updater.ts` agora só lê o `latest.json` e compara
  a versão — isso mantém o **bloqueio do online** para clientes desatualizados e mostra um
  aviso orientando a atualizar pelo launcher.
- **latest.json intacto:** `createUpdaterArtifacts` e a assinatura (`.sig`) continuam sendo
  gerados, então `scripts/publish-release.mjs` segue funcionando sem mudanças.

## Publicar uma nova versão do jogo (inalterado)

```bash
npm run tauri:build
node scripts/publish-release.mjs --publish   # gera latest.json + cria o release no GitHub
```

O launcher (e o aviso de versão do jogo) enxergam a nova versão automaticamente pelo `latest.json`.

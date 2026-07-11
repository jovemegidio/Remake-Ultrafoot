# Auto-updater — Ultrafoot 26

Configurado com `tauri-plugin-updater` + `tauri-plugin-process`. O app verifica
atualizações ~5s após o boot (silencioso) e também pode ser chamado manualmente
via `checkForUpdates()` ([lib/updater.ts](../lib/updater.ts)).

## O que já está pronto no código

- **Rust**: plugins registrados em `src-tauri/src/lib.rs`; deps em `Cargo.toml`.
- **Permissões**: `updater:default` + `process:default` em `capabilities/default.json`.
- **Config**: `plugins.updater` em `tauri.conf.json` (pubkey + endpoint) e
  `bundle.createUpdaterArtifacts: true`.
- **Frontend**: `lib/updater.ts` + chamada em `components/native-app-provider.tsx`.
- **Chave pública** já embutida no `tauri.conf.json`.

## Endpoint

Configurado em `src-tauri/tauri.conf.json` → `plugins.updater.endpoints`:
```
https://github.com/jovemegidio/Ultrafoot26/releases/latest/download/latest.json
```
> Se o repositório real tiver outro nome, troque `jovemegidio/Ultrafoot26` aqui **e** no
> endpoint do release. É o único lugar acoplado ao nome do repo.

## Publicação automática (CI) — jeito recomendado

O workflow [`.github/workflows/release.yml`](../.github/workflows/release.yml)
builda, **assina** e publica sozinho. Ninguém gera `.exe` na mão, então não
existe "build em cima de build" nem binário desatualizado circulando.

### Configuração única (1 vez)
1. **Chave privada** (já salva em `C:\Users\SnyX\.ultrafoot-keys\ultrafoot-updater.key` —
   guarde uma cópia num gerenciador de senhas; se perder, os updates assinados
   param e os usuários precisam reinstalar).
2. No GitHub: **Settings → Secrets and variables → Actions**, crie:
   - `TAURI_SIGNING_PRIVATE_KEY` = conteúdo do arquivo `.key`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` = (vazio — a chave foi gerada sem senha)

### Publicar uma nova versão
```bash
# 1. bump da versão nos DOIS arquivos (têm que bater)
#    - package.json         -> "version"
#    - src-tauri/tauri.conf.json -> "version"
git commit -am "chore: bump versao X.Y.Z"
git tag vX.Y.Z
git push origin master --tags   # o push da tag dispara o workflow
```
O CI gera e sobe no GitHub Release os 3 assets que o updater precisa:
`Ultrafoot 26_X.Y.Z_x64-setup.exe`, o `.sig` e o `latest.json`.

## Publicação manual (fallback, sem CI)

Só se precisar buildar localmente (PowerShell):
```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content "$HOME\.ultrafoot-keys\ultrafoot-updater.key" -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
npm run tauri:build
```
Saída em `src-tauri/target/release/bundle/nsis/` — suba os 3 arquivos
(`*-setup.exe`, `*-setup.exe.sig`, `latest.json`) como assets de um GitHub Release.

## Testar
Instale uma versão antiga, publique um release com versão maior e abra o app:
em ~5s deve aparecer o diálogo "Atualização disponível".

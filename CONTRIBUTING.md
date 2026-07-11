# Trabalhando no Ultrafoot 26

Guia para desenvolvedores. O objetivo aqui é **ninguém gerar `.exe` na mão** —
a build oficial sai só do CI, e o jogo instalado se atualiza sozinho. Assim não
existe "build em cima de build" nem binário desatualizado circulando.

## Regra de ouro

- **Desenvolvimento** → rode em modo dev, nunca builde um instalador para testar.
- **Release** → só via tag + GitHub Actions (ver abaixo). Nunca suba `.exe` manual.
- **Nunca commite artefatos de build.** Já estão no `.gitignore`:
  `out/`, `.next/`, `dist/`, `src-tauri/target/`, `src-tauri/gen/` e as chaves `*.key`.
  Se aparecer um desses no `git status`, **não** faça `git add` nele.

## Rodando o projeto (dev)

Requisitos: Node 20+, pnpm 9+, Rust (para o app desktop).

```bash
pnpm install

# App web (browser) — iteração rápida de UI:
npm run dev            # http://localhost:3000

# App desktop (Tauri) — testa o comportamento nativo/updater:
npm run tauri:dev
```

`tauri:dev` roda o Next em memória e abre a janela nativa apontando pra ele —
**não gera instalador**. É o jeito certo de testar mudanças no dia a dia.

## Publicando uma versão (só quem tem a chave de assinatura)

O fluxo completo está em [`src-tauri/AUTO-UPDATER.md`](src-tauri/AUTO-UPDATER.md).
Resumo:

```bash
# bump da versão nos DOIS arquivos (têm que bater):
#   package.json            -> "version"
#   src-tauri/tauri.conf.json -> "version"
git commit -am "chore: bump versao X.Y.Z"
git tag vX.Y.Z
git push origin master --tags
```

O push da tag dispara `.github/workflows/release.yml`, que builda, assina e
publica o instalador + `latest.json` no GitHub Release. Os jogadores recebem a
atualização automaticamente (~5s após abrir o jogo).

> Fazer `npm run tauri:build` na sua máquina é só fallback de emergência. O
> resultado **não** deve ser distribuído no lugar do release do CI — senão volta
> o problema de builds paralelas desatualizadas.

## Assets grandes (escudos, camisas, música)

Não são versionados (ver `.gitignore`). Eles são empacotados no instalador via
`bundle.resources` do `tauri.conf.json` e/ou baixados pelo downloader. Não tente
commitá-los.

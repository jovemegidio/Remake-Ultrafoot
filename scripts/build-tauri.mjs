import { spawnSync } from "node:child_process"

/**
 * BUILD WEB DO EMPACOTAMENTO DESKTOP (o `beforeBuildCommand` do Tauri).
 *
 * Era uma linha so no package.json:
 *   cross-env TAURI_BUILD=1 npm run build && node scripts/prune-export-music.mjs
 *
 * Virou script por causa da ORDEM e do `finally`. O export do Next copia tudo o
 * que esta em `public/` para `out/` — ~40 mil imagens — e o prune apaga esses
 * mesmos diretorios logo depois. Alem de desperdicio, era onde o build morria:
 * copiar dezenas de milhares de arquivos recem-escritos disputa cada um deles
 * com o antivirus e com o cliente do Google Drive, e o Next abortava em
 * `EBUSY: resource busy or locked, copyfile ...`, sempre num arquivo diferente.
 *
 * A ordem aqui NAO e livre:
 *   1. prebuild   — `build-team-player-photos` ESCREVE em public/jogadores;
 *                   se as pastas ja estivessem reservadas, ele escreveria no
 *                   vazio e o manifesto sairia errado.
 *   2. guardar    — tira as pastas pesadas do caminho do export.
 *   3. next build — agora copia so o que de fato vai para `out/`.
 *   4. devolver   — SEMPRE, mesmo se o passo 3 falhar. Sem isto, um build
 *                   interrompido deixaria `public/` sem as imagens.
 *   5. prune      — segue existindo: ainda ha musica e sobras a remover, e ele
 *                   e a rede de seguranca se esta lista um dia divergir.
 *
 * As imagens nao somem do jogo: elas entram como *resources* do Tauri,
 * empacotadas a partir de `public/` na etapa do cargo, que roda depois disto.
 */

function rodar(comando, argumentos) {
  const r = spawnSync(comando, argumentos, { stdio: "inherit", shell: true })
  if (r.status !== 0) throw new Error(`${comando} ${argumentos.join(" ")} falhou (${r.status})`)
}

const reservar = (acao) => rodar("node", ["scripts/reservar-imagens-pesadas.mjs", acao])

// 1. prebuild explicito. Chamado aqui porque o `npm run build` do passo 3 e
//    disparado com --ignore-scripts justamente para o prebuild nao rodar de
//    novo DEPOIS das pastas ja terem sido reservadas.
rodar("node", ["scripts/preparar-env-licenca.mjs"])
rodar("node", ["scripts/embutir-edicoes.mjs"])
rodar("node", ["scripts/build-team-player-photos.mjs"])
// ⚠️ TEM DE ESTAR AQUI TAMBEM, e nao so no `prebuild` do package.json: o passo 3
// roda o next build com --ignore-scripts, entao o prebuild do npm NAO dispara
// neste caminho. Sem esta linha o `pool-elencos-compacto.json` nao e gerado, o
// import dinamico cai no catch e o jogo abre com os elencos VAZIOS — em
// silencio, porque o catch existe justamente para nao travar a tela.
rodar("node", ["scripts/compactar-elencos-do-pool.mjs"])
rodar("node", ["scripts/compactar-elencos-tm.mjs"])
rodar("node", ["scripts/compactar-manifesto-de-fotos.mjs"])

// 2 a 4.
reservar("guardar")
try {
  rodar("npx", [
    "cross-env", "TAURI_BUILD=1",
    "node", "--max-old-space-size=8192",
    "node_modules/next/dist/bin/next", "build", "--webpack",
  ])
  rodar("node", ["scripts/fix-next-export-rsc.mjs"])
} finally {
  reservar("devolver")
}

// 5.
rodar("node", ["scripts/prune-export-music.mjs"])

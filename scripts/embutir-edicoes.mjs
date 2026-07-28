// EMBUTE AS EDIÇÕES DO EDITOR NO BUILD — automático, roda no prebuild.
//
// O PROBLEMA que isto resolve: escudos e uniformes editados no Editor de Equipes
// ficam no save LOCAL da máquina. Para chegarem aos outros jogadores é preciso
// "assar" (bake) essas imagens no seed `data/seeds/team-overrides.json`, que
// viaja no instalador. Isso era MANUAL: se quem builda esquecesse de rodar os
// scripts, a edição simplesmente não ia — e o usuário não tinha como saber.
// Relato: "edito um uniforme/escudo e não permanece para os outros usuários".
//
// Agora roda sozinho antes de todo build. Sequência:
//   1. bake-user-logos  → escudos do save entram no seed (comprimidos)
//   2. bake-user-kits   → uniformes do save entram no seed
//   3. split-override-assets → tira os base64 do JSON e grava PNGs em
//      public/overrides (senão o seed incharia o bundle em dezenas de MB)
//
// Em máquina SEM o save (CI, outro dev) não há o que embutir: avisa e segue.

import { existsSync, readFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import path from "node:path"
import os from "node:os"

const SAVE = path.join(
  process.env.APPDATA || path.join(os.homedir(), "AppData/Roaming"),
  "com.ultrafoot.remake",
  "ultrafoot-clubs.json",
)

function rodar(script, args = []) {
  execFileSync(process.execPath, [path.join("scripts", script), ...args], { stdio: "inherit" })
}

function contarNoSeed() {
  try {
    const seed = JSON.parse(readFileSync("data/seeds/team-overrides.json", "utf8"))
    const vals = Object.values(seed)
    return { escudos: vals.filter(v => v?.logoUrl).length, uniformes: vals.filter(v => v?.kits).length }
  } catch { return { escudos: 0, uniformes: 0 } }
}

if (!existsSync(SAVE)) {
  console.log("[edicoes] sem save local nesta maquina — nada a embutir (ok em CI).")
  process.exit(0)
}

const antes = contarNoSeed()
try {
  rodar("bake-user-logos.mjs")
  rodar("bake-user-kits.mjs")
  // Fotos de jogador importadas no editor. Sem esta etapa elas ficavam so na
  // maquina de quem editou — o elenco "licenciado" nao chegava a ninguem.
  rodar("bake-user-player-photos.mjs")
  rodar("split-override-assets.mjs")
} catch (e) {
  // NUNCA derruba o build por causa disto: um bake que falha significa "sem
  // edição nova", não "build quebrado". Mas avisa ALTO, porque o silêncio aqui
  // foi exatamente o problema original.
  console.warn("\n[edicoes] AVISO: falha ao embutir edicoes do editor:", e?.message ?? e)
  console.warn("[edicoes] O build segue, mas escudos/uniformes novos podem NAO ir para os jogadores.\n")
  process.exit(0)
}

const depois = contarNoSeed()
console.log(
  `[edicoes] embutidos no build: ${depois.escudos} escudos, ${depois.uniformes} uniformes` +
  (depois.escudos !== antes.escudos || depois.uniformes !== antes.uniformes
    ? ` (novos: +${depois.escudos - antes.escudos} escudos, +${depois.uniformes - antes.uniformes} uniformes)`
    : " (nenhuma edicao nova)"),
)

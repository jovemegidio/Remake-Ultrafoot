// Quanto custa o boot dos seeds? A tela de splash carrega o grafo inteiro de
// dados antes de aparecer; num PC modesto isso e tempo de tela preta.
//
// Mede o custo de JSON.parse + a indexacao de modulo de cada camada. Nao e o
// numero exato do navegador (o V8 do WebView2 e o mesmo motor, mas a maquina do
// jogador e mais lenta) — serve para saber ONDE esta o custo e se vale refatorar.

import { readFileSync } from "node:fs"
import { join } from "node:path"

const SEEDS = join(process.cwd(), "data", "seeds")

function medir(label: string, fn: () => unknown) {
  const t0 = performance.now()
  const r = fn()
  const ms = performance.now() - t0
  console.log(`  ${label.padEnd(34)} ${ms.toFixed(0).padStart(6)} ms`)
  return { ms, r }
}

console.log("== Custo de parse dos seeds (JSON.parse puro) ==")
let totalParse = 0
const arquivos = [
  "imported-bf2026.json",
  "real-squads-tm.json",
  "tm-photos.json",
  "real-positions.json",
  "tm-fotos-local.json",
  "players_br.json",
]
for (const nome of arquivos) {
  try {
    const raw = readFileSync(join(SEEDS, nome), "utf8")
    const mb = raw.length / 1024 / 1024
    const { ms } = medir(`${nome} (${mb.toFixed(1)} MB)`, () => JSON.parse(raw))
    totalParse += ms
  } catch {
    console.log(`  ${nome.padEnd(34)}  ausente`)
  }
}
console.log(`  ${"TOTAL parse".padEnd(34)} ${totalParse.toFixed(0).padStart(6)} ms`)

async function grafo() {
  console.log("\n== Custo de import dos modulos (parse + indexacao) ==")
  const t0 = performance.now()
  const teams = await import("../lib/teams-data")
  console.log("  lib/teams-data".padEnd(36) + `${(performance.now() - t0).toFixed(0).padStart(6)} ms  (${teams.allPoolTeams.length} clubes no pool)`)

  const t1 = performance.now()
  await import("../lib/players-data")
  console.log("  lib/players-data".padEnd(36) + `${(performance.now() - t1).toFixed(0).padStart(6)} ms`)

  const t2 = performance.now()
  await import("../lib/game-engine")
  console.log("  lib/game-engine".padEnd(36) + `${(performance.now() - t2).toFixed(0).padStart(6)} ms`)

  console.log("\n  " + "TOTAL do grafo".padEnd(34) + `${(performance.now() - t0).toFixed(0).padStart(6)} ms`)
  console.log("\nNota: a maquina do jogador e mais lenta. Multiplique por 3-5x")
  console.log("para estimar um PC modesto de 2014.")
}

grafo()

// Quanto do jogo esta LICENCIADO: rosto de atleta e escudo de clube.
//
//   node scripts/auditar-licenciamento.mjs
//   node scripts/auditar-licenciamento.mjs --pais Brasil
//
// Responde a pergunta que nenhum dos scripts de importacao responde: depois de
// tudo, quantos atletas o jogador VE com rosto? A conta segue a mesma ordem de
// `lib/player-photos.ts` — arquivo empacotado (por id, depois por nome) e, na
// falta dele, foto do Transfermarkt.

import { readFileSync } from "node:fs"
import path from "node:path"

const RAIZ = path.resolve(import.meta.dirname, "..")
const ler = (p) => JSON.parse(readFileSync(path.join(RAIZ, p), "utf-8"))

const manifesto = ler("data/seeds/faces-manifest.json").entries
const jogo = ler("data/seeds/imported-bf2026.json")

const paisFiltro = process.argv.includes("--pais")
  ? process.argv[process.argv.indexOf("--pais") + 1]
  : null

/** Mesma normalizacao de `normalizePlayerKey`: sem acento, minusculo, com hifen. */
const chaveDoNome = (nome) => String(nome ?? "").normalize("NFD")
  .replace(/[̀-ͯ]/g, "").toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

let atletas = 0, comDf11 = 0, comOutroArquivo = 0, comTm = 0, semNada = 0
const semPorPais = new Map()
const comPorPais = new Map()

for (const time of jogo.teams ?? []) {
  if (paisFiltro && time.pais !== paisFiltro) continue
  for (const j of time.jogadores ?? []) {
    atletas++
    const arquivo = manifesto[j.id] ?? manifesto[chaveDoNome(j.nome)]
    const temTm = typeof j.ft === "string" && j.ft.length > 0
    if (arquivo?.includes("df11-")) comDf11++
    else if (arquivo) comOutroArquivo++
    else if (temTm) comTm++
    else {
      semNada++
      semPorPais.set(time.pais, (semPorPais.get(time.pais) ?? 0) + 1)
      continue
    }
    comPorPais.set(time.pais, (comPorPais.get(time.pais) ?? 0) + 1)
  }
}

const pct = (n) => `${((n / atletas) * 100).toFixed(1)}%`

console.log(`ATLETAS${paisFiltro ? ` (${paisFiltro})` : ""}: ${atletas}`)
console.log(`  rosto do DF11          ${String(comDf11).padStart(6)}  ${pct(comDf11)}`)
console.log(`  outro arquivo local    ${String(comOutroArquivo).padStart(6)}  ${pct(comOutroArquivo)}`)
console.log(`  foto do Transfermarkt  ${String(comTm).padStart(6)}  ${pct(comTm)}`)
console.log(`  SEM ROSTO              ${String(semNada).padStart(6)}  ${pct(semNada)}`)
console.log(`  com algum rosto        ${String(atletas - semNada).padStart(6)}  ${pct(atletas - semNada)}`)

if (!paisFiltro) {
  console.log("\nPAISES COM MAIS ATLETAS SEM ROSTO")
  const ordenado = [...semPorPais.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
  for (const [pais, quantos] of ordenado) {
    const com = comPorPais.get(pais) ?? 0
    const total = com + quantos
    console.log(`  ${String(quantos).padStart(5)} sem  de ${String(total).padStart(5)}`
      + `  (${((com / total) * 100).toFixed(0)}% coberto)  ${pais}`)
  }

  const times = (jogo.teams ?? []).filter(t => !paisFiltro || t.pais === paisFiltro)
  const comEscudo = times.filter(t =>
    t.escudoDisponivel === true
    || (typeof t.escudo === "string" && t.escudo && t.escudo !== "null")).length
  console.log(`\nCLUBES: ${times.length}  |  com escudo ${comEscudo}`
    + `  (${((comEscudo / times.length) * 100).toFixed(1)}%)`)
}

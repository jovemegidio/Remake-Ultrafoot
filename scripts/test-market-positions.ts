// Distribuição de posições no mercado, antes x depois.
//
// Relato (1.0.98): buscar ATA, VOL, PD ou PE devolvia meias. Causa: o fallback
// `return "MEI"` do mapPos capturava os 25.078 registros "BAN" (banco) do banco
// importado, além de "CA" e "LAT".
//
// Rodar: npx tsx scripts/test-market-positions.ts

import { readFileSync } from "node:fs"
import path from "node:path"

const seed = JSON.parse(
  readFileSync(path.join(process.cwd(), "data/seeds/imported-bf2026.json"), "utf8"),
) as { teams?: Array<{ jogadores?: Array<{ posicao?: string }> }> }

const times = seed.teams ?? []
const posicoes: string[] = []
for (const time of times) for (const j of time.jogadores ?? []) posicoes.push((j.posicao ?? "").toUpperCase())

// Um teste que "passa" sem dado nenhum é pior que teste nenhum: a primeira
// versão deste script leu a chave errada, achou 0 atletas e reportou sucesso.
if (posicoes.length === 0) {
  console.error("FALHA: nenhum atleta lido do seed — estrutura do JSON mudou?")
  process.exit(1)
}

const ANTES = (p: string): string => {
  const u = p.toUpperCase()
  if (u === "GOL" || u === "GK") return "GOL"
  if (u === "LD" || u === "RB") return "LD"
  if (u === "LE" || u === "LB") return "LE"
  if (u === "DEF" || u === "ZAG" || u === "CB") return "ZAG"
  if (u === "VOL") return "VOL"
  if (u === "MEI" || u === "MID" || u === "MED" || u === "MC") return "MEI"
  if (u === "PD" || u === "RW") return "PD"
  if (u === "PE" || u === "LW") return "PE"
  if (u === "ATA" || u === "FWD" || u === "ST") return "ATA"
  return "MEI"
}

const BENCH = ["GOL", "ZAG", "ZAG", "LD", "LE", "VOL", "MEI", "MEI", "PD", "PE", "ATA", "ATA"]
const DEPOIS = (p: string, index: number): string => {
  const u = p.toUpperCase()
  if (u === "GOL" || u === "GK") return "GOL"
  if (u === "LD" || u === "RB") return "LD"
  if (u === "LE" || u === "LB") return "LE"
  if (u === "LAT") return "LD"
  if (u === "DEF" || u === "ZAG" || u === "CB") return "ZAG"
  if (u === "VOL" || u === "DM" || u === "CDM" || u === "MCD") return "VOL"
  if (u === "MEI" || u === "MID" || u === "MED" || u === "MC" || u === "CM" || u === "CAM" || u === "MO") return "MEI"
  if (u === "PD" || u === "RW" || u === "AD" || u === "MD") return "PD"
  if (u === "PE" || u === "LW" || u === "AE" || u === "ME") return "PE"
  if (u === "ATA" || u === "FWD" || u === "ST" || u === "CA" || u === "CF" || u === "SA") return "ATA"
  return BENCH[Math.abs(index) % BENCH.length]
}

function contar(fn: (p: string, i: number) => string) {
  const m = new Map<string, number>()
  posicoes.forEach((p, i) => m.set(fn(p, i), (m.get(fn(p, i)) ?? 0) + 1))
  return m
}

const antes = contar(ANTES)
const depois = contar(DEPOIS)
const total = posicoes.length
const chaves = ["GOL", "ZAG", "LD", "LE", "VOL", "MEI", "PD", "PE", "ATA"]

console.log(`\n${total.toLocaleString("pt-BR")} atletas no banco importado\n`)
console.log("posicao    antes            depois")
console.log("-".repeat(44))
for (const k of chaves) {
  const a = antes.get(k) ?? 0
  const d = depois.get(k) ?? 0
  console.log(
    `${k.padEnd(9)} ${String(a).padStart(6)} (${((a / total) * 100).toFixed(1).padStart(4)}%)   ${String(d).padStart(6)} (${((d / total) * 100).toFixed(1).padStart(4)}%)`,
  )
}

let falhas = 0
const meiAntes = (antes.get("MEI") ?? 0) / total
const meiDepois = (depois.get("MEI") ?? 0) / total
if (meiAntes < 0.5) { console.log("\nFALHA: esperava MEI dominante ANTES da correcao"); falhas++ }
if (meiDepois > 0.25) { console.log("\nFALHA: MEI continua inflado DEPOIS da correcao"); falhas++ }
for (const k of ["ATA", "VOL", "PD", "PE", "LD", "LE"]) {
  if ((depois.get(k) ?? 0) < total * 0.03) { console.log(`FALHA: ${k} quase ausente depois da correcao`); falhas++ }
}

console.log(`\nMEI: ${(meiAntes * 100).toFixed(1)}% -> ${(meiDepois * 100).toFixed(1)}%`)
console.log(falhas === 0 ? "\nDISTRIBUICAO OK\n" : `\n${falhas} PROBLEMA(S)\n`)
process.exit(falhas === 0 ? 0 : 1)

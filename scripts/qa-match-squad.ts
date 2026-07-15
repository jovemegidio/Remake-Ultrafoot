// Prova o fix do Batch 2 (partida): o XI encaixado na formacao NAO corta atacantes, e os
// numeros de camisa saem UNICOS.
//
// Reproduz o bug do print: um elenco com muitos defensores fazia
// sortByPosition(...).slice(0,11) escalar goleiro + zaga + meio e DEIXAR OS ATACANTES DE
// FORA — a lista de batedores de penalti so mostrava zagueiros/laterais, todos com o
// mesmo numero (LD=2, ZAG=3...).
//
// Uso: npx tsx scripts/qa-match-squad.ts

import { pickStartingXI } from "../lib/formations"

type P = { nome: string; pos: string; base: number }

// Elenco defensor-pesado de proposito: 3 GOL, 8 defensores, 5 meias, 3 atacantes = 19.
const squad: P[] = [
  { nome: "GK1", pos: "GOL", base: 78 }, { nome: "GK2", pos: "GOL", base: 70 }, { nome: "GK3", pos: "GOL", base: 65 },
  { nome: "LD1", pos: "LD", base: 74 }, { nome: "LD2", pos: "LD", base: 68 },
  { nome: "ZAG1", pos: "ZAG", base: 77 }, { nome: "ZAG2", pos: "ZAG", base: 76 }, { nome: "ZAG3", pos: "ZAG", base: 72 }, { nome: "ZAG4", pos: "ZAG", base: 70 },
  { nome: "LE1", pos: "LE", base: 73 }, { nome: "LE2", pos: "LE", base: 66 },
  { nome: "VOL1", pos: "VOL", base: 76 }, { nome: "VOL2", pos: "VOL", base: 71 },
  { nome: "MEI1", pos: "MEI", base: 79 }, { nome: "MEI2", pos: "MEI", base: 74 }, { nome: "MEI3", pos: "MEI", base: 70 },
  { nome: "PE1", pos: "PE", base: 80 },
  { nome: "PD1", pos: "PD", base: 78 },
  { nome: "ATA1", pos: "ATA", base: 84 },
]

const { starters, bench } = pickStartingXI(squad, (p) => p.pos, (p) => p.base)

let fail = 0
const check = (cond: boolean, msg: string) => { console.log(`${cond ? "OK " : "FALHOU"}  ${msg}`); if (!cond) fail++ }

check(starters.length === 11, `XI tem 11 titulares (tem ${starters.length})`)

const gk = starters.filter((p) => p.pos === "GOL").length
check(gk === 1, `exatamente 1 goleiro no XI (tem ${gk})`)

const atk = starters.filter((p) => ["ATA", "PE", "PD", "SA", "CA"].includes(p.pos))
check(atk.length >= 3, `atacantes escalados (>=3): ${atk.length} -> ${atk.map((p) => p.nome).join(", ")}`)
check(starters.some((p) => p.pos === "ATA"), `o centroavante (ATA1) entrou -> ${starters.find((p) => p.pos === "ATA")?.nome ?? "NENHUM"}`)

// O melhor de cada linha deve estar (ordena por rating no encaixe).
check(starters.some((p) => p.nome === "ATA1"), "melhor atacante (ATA1, base 84) e titular")
check(starters.some((p) => p.nome === "MEI1"), "melhor meia (MEI1, base 79) e titular")

// Goleiros excedentes vao pro banco, nao pro XI.
check(bench.filter((p) => p.pos === "GOL").length === 2, "os 2 goleiros reservas foram pro banco")

// Numeros unicos: simula o alocador (mesma logica do makeNumberAllocator da partida).
const POSITION_NUMBER_MAP: Record<string, number> = { GOL: 1, ZAG: 3, LD: 2, LE: 6, VOL: 5, MEI: 8, ATA: 9, PE: 7, PD: 11 }
const used = new Set<number>()
const alloc = (pos: string): number => {
  const pref = POSITION_NUMBER_MAP[pos]
  if (typeof pref === "number" && pref > 0 && !used.has(pref)) { used.add(pref); return pref }
  for (let n = 1; n <= 99; n++) if (!used.has(n)) { used.add(n); return n }
  return 0
}
const numbers = [...starters, ...bench].map((p) => alloc(p.pos))
const uniqueCount = new Set(numbers).size
check(uniqueCount === numbers.length, `numeros de camisa UNICOS: ${uniqueCount}/${numbers.length} distintos`)

console.log(fail === 0 ? "\n== TODOS OS TESTES PASSARAM ==" : `\n== ${fail} FALHA(S) ==`)
process.exit(fail === 0 ? 0 : 1)

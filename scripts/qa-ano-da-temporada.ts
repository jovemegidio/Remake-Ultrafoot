// O ANO ACOMPANHA A TEMPORADA?
//
// Relato: "ao iniciar uma nova temporada o calendario deve mudar — terminei 2026
// deve comecar 2027; para alguns jogadores buga".
//
// A virada em si funciona (ver scripts/qa-virada-de-temporada.ts). O que estava
// quebrado era a EXIBICAO: varias telas cravavam o ano 2026 na hora de montar a
// data, entao a partir da segunda temporada:
//
//   • a grade do calendario mantinha o alinhamento de dias da semana de 2026 —
//     em 2027 todo dia caia na coluna errada;
//   • em ano bissexto (2028) fevereiro vinha com 28 dias e o dia 29 sumia;
//   • a tela de competicoes anunciava "11 jun – 19 jul 2026" para sempre.
//
//   npx tsx scripts/qa-ano-da-temporada.ts
import assert from "node:assert/strict"
import { periodoLabelPorNome, TEMPORADA_DAS_DATAS } from "../lib/competition-dates-2026"
import { getGameDate } from "../lib/game-date"

// ─── 1. A grade do calendario muda de ano ────────────────────────────────────
//
// Reproduz exatamente o calculo de app/calendario/page.tsx.
const gradeDoMes = (season: number, mes: number) => ({
  dias: new Date(season, mes + 1, 0).getDate(),
  primeiroDiaDaSemana: new Date(season, mes, 1).getDay(),
})

const jan2026 = gradeDoMes(2026, 0)
const jan2027 = gradeDoMes(2027, 0)
console.log(`jan/2026: ${jan2026.dias} dias, comeca no dia-da-semana ${jan2026.primeiroDiaDaSemana}`)
console.log(`jan/2027: ${jan2027.dias} dias, comeca no dia-da-semana ${jan2027.primeiroDiaDaSemana}`)
assert.notEqual(
  jan2026.primeiroDiaDaSemana, jan2027.primeiroDiaDaSemana,
  "2026 e 2027 comecam no mesmo dia da semana? entao este teste nao prova nada",
)

// ─── 2. Ano bissexto tem 29 de fevereiro ─────────────────────────────────────
const fev2027 = gradeDoMes(2027, 1)
const fev2028 = gradeDoMes(2028, 1)
console.log(`fev/2027: ${fev2027.dias} dias | fev/2028: ${fev2028.dias} dias`)
assert.equal(fev2027.dias, 28)
assert.equal(fev2028.dias, 29, "2028 e bissexto — com o ano cravado em 2026 o dia 29 sumia")

// ─── 3. getGameDate ja acompanhava a temporada (nao regredir) ────────────────
assert.equal(getGameDate(2026, 1).getFullYear(), 2026)
assert.equal(getGameDate(2027, 1).getFullYear(), 2027)
assert.equal(getGameDate(2030, 1).getFullYear(), 2030)

// ─── 4. As datas das competicoes deslocam com a temporada ────────────────────
const copa2026 = periodoLabelPorNome("Copa do Mundo", 2026)
const copa2027 = periodoLabelPorNome("Copa do Mundo", 2027)
const copaSemAno = periodoLabelPorNome("Copa do Mundo")
console.log(`Copa do Mundo (2026): ${copa2026}`)
console.log(`Copa do Mundo (2027): ${copa2027}`)
assert.ok(copa2026?.includes("2026"), `esperava 2026 em "${copa2026}"`)
assert.ok(copa2027?.includes("2027"), `esperava 2027 em "${copa2027}"`)
assert.ok(!copa2027?.includes("2026"), `2027 nao pode anunciar 2026: "${copa2027}"`)
// Sem temporada informada, mantem o comportamento antigo (a base cadastrada).
assert.equal(copaSemAno, copa2026)
assert.equal(TEMPORADA_DAS_DATAS, 2026)

// Competicao que ATRAVESSA o ano (UEFA 2025/26) desloca as duas pontas.
const ucl2026 = periodoLabelPorNome("Champions League", 2026)
const ucl2028 = periodoLabelPorNome("Champions League", 2028)
console.log(`Champions (2026): ${ucl2026}`)
console.log(`Champions (2028): ${ucl2028}`)
assert.ok(ucl2026?.includes("2025") && ucl2026?.includes("2026"), `esperava 2025 e 2026 em "${ucl2026}"`)
assert.ok(ucl2028?.includes("2027") && ucl2028?.includes("2028"), `esperava 2027 e 2028 em "${ucl2028}"`)

console.log("\nOK — grade, bissexto e datas de competicao acompanham a temporada")

// PERFIL DA CURVA DE ENERGIA — o que custa jogar e quanto rende descansar.
//
// Existe por causa do relato "ao terminar uma partida, de uma semana para a
// outra o jogador nao se descansa/recupera". A calibracao antiga tinha base de
// recuperacao 13 contra um desgaste de ~15 no titular: ele subia +2 por semana e
// o veterano CAIA, sem volta. Como o modelo e puro (sem store, sem React), da
// para imprimir a curva inteira e conferir o numero em vez de sentir na tela.
//
//   npx tsx scripts/qa-curva-energia.ts
import assert from "node:assert/strict"
import { aplicarSemanaDeTreino, type AtletaNaSemana, type PlanoDeTreino } from "../lib/treino-e-entrosamento"

const MEDIO: PlanoDeTreino = { intensidade: "media", foco: "entrosamento" }
const REGEN: PlanoDeTreino = { intensidade: "leve", foco: "recuperacao" }
const ALTA: PlanoDeTreino = { intensidade: "alta", foco: "fisico" }

function semana(energia: number, idade: number, minutos: number, plano = MEDIO, fadiga = 0) {
  const a: AtletaNaSemana = {
    id: 1, idade, energia, fadigaCronica: fadiga, minutosJogados: minutos,
    resistencia: 70, lesionado: false, emTreinoIndividual: false, focoIndividual: null,
  }
  return aplicarSemanaDeTreino([a], plano, { centroDeTreinamento: 2, centroMedico: 2 }).efeitos[0]
}

const delta = (energia: number, ...args: [number, number, PlanoDeTreino?]) =>
  semana(energia, ...args).energia - energia

console.log("=== DELTA DE ENERGIA NA SEMANA (partindo de 70%) ===")
for (const idade of [19, 25, 30, 34]) {
  console.log(`\n-- ${idade} anos --`)
  const casos: [string, number, PlanoDeTreino][] = [
    ["folga total (0 min), treino medio", 0, MEDIO],
    ["um jogo (90 min), treino medio", 90, MEDIO],
    ["dois jogos (180 min), treino medio", 180, MEDIO],
    ["um jogo (90 min), treino ALTA/fisico", 90, ALTA],
    ["folga total, semana REGENERATIVA", 0, REGEN],
  ]
  for (const [rot, min, plano] of casos) {
    const d = delta(70, idade, min, plano)
    console.log(`  ${rot.padEnd(40)} ${d >= 0 ? "+" : ""}${d.toFixed(1)}`)
  }
}

console.log("\n=== ESGOTADO (40%, fadiga 55, 27 anos) SEM JOGAR ===")
let en = 40, fad = 55
for (let s = 1; s <= 5; s++) {
  const e = semana(en, 27, 0, MEDIO, fad)
  en = e.energia; fad = e.fadigaCronica
  console.log(`  semana ${s}: energia ${en.toFixed(0)}%  fadiga ${fad.toFixed(0)}`)
}

console.log("\n=== TITULAR DE 33 ANOS JOGANDO TODA SEMANA ===")
let ev = 100, fv = 0
for (let s = 1; s <= 12; s++) {
  const e = semana(ev, 33, 90, MEDIO, fv)
  ev = e.energia; fv = e.fadigaCronica
  if (s % 3 === 0) console.log(`  semana ${s}: energia ${ev.toFixed(0)}%  fadiga ${fv.toFixed(0)}  risco ${(e.risco * 100).toFixed(1)}%`)
}

// ─── As invariantes que a calibracao nao pode perder ───────────────────────────

// 1. DESCANSAR TEM DE REPOR — era exatamente isto que faltava. Uma semana cheia
//    sem jogo devolve ao menos 14 pontos MESMO no veterano de 34 (que e o piso
//    da tabela de idade). Na calibracao antiga esse numero era ~+2.
for (const idade of [19, 25, 30, 34]) {
  assert.ok(delta(70, idade, 0) >= 14, `folga de ${idade} anos repos pouco: ${delta(70, idade, 0)}`)
}

// 2. JOGAR TEM DE CUSTAR: a semana com jogo sempre rende menos que a de folga.
for (const idade of [19, 25, 30, 34]) {
  assert.ok(delta(70, idade, 90) < delta(70, idade, 0) - 8, `jogo barato demais aos ${idade}`)
}

// 3. RODIZIO PRECISA IMPORTAR: dois jogos na semana derrubam a energia.
assert.ok(delta(70, 25, 180) < 0, "semana de dois jogos deveria ser negativa")

// 4. IDADE PESA: o veterano se recupera menos que o garoto, em toda situacao.
assert.ok(delta(70, 34, 90) < delta(70, 19, 90), "idade deixou de pesar")

// 5. O TETO CONTINUA VALENDO.
assert.equal(semana(98, 19, 0, REGEN).energia, 100)

console.log("\nOK curva de energia: folga repoe, jogo custa, rodizio importa e idade pesa")

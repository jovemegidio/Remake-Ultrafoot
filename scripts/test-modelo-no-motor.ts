// O MODELO CANÔNICO TEM CONSEQUÊNCIA NO MOTOR?
//
// O critério é do próprio usuário: "nenhum controle de interface sem
// consequência no motor". Um modelo de atleta bonito que o `match-engine`
// ignora é pior do que não ter modelo nenhum — vira número na tela.
//
// `test-modelo-de-jogador` prova que o perfil é coerente. ESTE prova que ele
// MUDA A PARTIDA: cada asserção abaixo compara duas simulações que diferem em
// UM campo do modelo e em mais nada, mesma semente de aleatoriedade.
//
//   npx tsx scripts/test-modelo-no-motor.ts

import { semearMotorDePartida, simulateFullMatch, type MatchConfig, type SquadPlayer } from "../lib/match-engine"
import type { Team } from "../lib/teams-data"

let falhas = 0
function check(nome: string, cond: boolean, detalhe = "") {
  if (!cond) falhas++
  console.log(`${cond ? "  ok  " : " FALHA"} ${nome}${cond ? "" : ` — ${detalhe}`}`)
}

const time = (nome: string): Team => ({
  nome, curto: nome.slice(0, 3).toUpperCase(), cor1: "#000", cor2: "#fff",
  file_key: nome.toLowerCase(), divisao: "serie_a",
} as unknown as Team)

const POSICOES = ["GOL", "ZAG", "ZAG", "LD", "LE", "VOL", "VOL", "MEI", "PD", "PE", "ATA"]

function elenco(extra: Partial<SquadPlayer> = {}, extraGol: Partial<SquadPlayer> = {}): SquadPlayer[] {
  return POSICOES.map((pos, i) => ({
    nome: `${pos}${i}`,
    pos,
    posNatural: pos,
    rating: 75, shooting: 75, passing: 75, dribbling: 75, defending: 75, physical: 75, pace: 75,
    stamina: 100,
    ...(pos === "GOL" ? extraGol : extra),
  }))
}

function config(casa: SquadPlayer[], fora: SquadPlayer[]): MatchConfig {
  return {
    homeTeam: time("Casa"), awayTeam: time("Fora"),
    homeRating: 75, awayRating: 75,
    homeSquad: casa, awaySquad: fora,
    durationMinutes: 90,
  } as MatchConfig
}

/**
 * Média de gols em N partidas, com SEMENTE FIXA.
 *
 * ⚠️ A semente é o que torna a comparação honesta. Sem ela as duas configurações
 * recebem sequências de sorteio diferentes, e a diferença medida é ruído: este
 * teste chegou a passar e falhar alternadamente na MESMA versão do código. Com
 * a mesma semente nos dois lados, qualquer diferença veio do campo que mudou.
 */
function mediaDeGols(casa: SquadPlayer[], fora: SquadPlayer[], n = 400): { pro: number; contra: number } {
  let pro = 0, contra = 0
  for (let i = 0; i < n; i++) {
    semearMotorDePartida(1000 + i)
    const r = simulateFullMatch(config(casa, fora))
    pro += r.home.goals
    contra += r.away.goals
  }
  semearMotorDePartida(null)
  return { pro: pro / n, contra: contra / n }
}

console.log("\nFamiliaridade muda a forca do time\n")

const familiar = mediaDeGols(elenco({ familiaridade: 20 }), elenco({ familiaridade: 20 }))
const improvisado = mediaDeGols(elenco({ familiaridade: 0 }), elenco({ familiaridade: 20 }))
check("elenco todo improvisado marca menos",
  improvisado.pro < familiar.pro,
  `improvisado ${improvisado.pro.toFixed(2)} x familiar ${familiar.pro.toFixed(2)}`)
check("elenco todo improvisado sofre mais",
  improvisado.contra > familiar.contra,
  `improvisado ${improvisado.contra.toFixed(2)} x familiar ${familiar.contra.toFixed(2)}`)

console.log("\nAtributos de goleiro mudam o que se sofre\n")

const goleiraoContra = mediaDeGols(elenco({ familiaridade: 20 }), elenco({ familiaridade: 20 }, { familiaridade: 20, forcaGoleiro: 95 }))
const frangueiroContra = mediaDeGols(elenco({ familiaridade: 20 }), elenco({ familiaridade: 20 }, { familiaridade: 20, forcaGoleiro: 45 }))
check("goleiro melhor adversario reduz os gols de quem ataca",
  goleiraoContra.pro < frangueiroContra.pro,
  `contra goleirao ${goleiraoContra.pro.toFixed(2)} x contra frangueiro ${frangueiroContra.pro.toFixed(2)}`)

console.log("\nRetrocompatibilidade: sem os campos, nada muda\n")

// ⚠️ A guarda mais importante do arquivo. Saves e elencos que não carregam o
// perfil (partida rápida, adversário sem elenco no save) TÊM de simular
// exatamente como antes da 1.0.293 — senão o modelo teria mexido no equilíbrio
// calibrado em 20 mil partidas sem ninguém pedir.
const semModelo = mediaDeGols(elenco(), elenco(), 600)
const comFamiliaridadeCheia = mediaDeGols(elenco({ familiaridade: 20 }), elenco({ familiaridade: 20 }), 600)
check("sem perfil = familiaridade 20 (a posicao natural rende 1,00)",
  Math.abs(semModelo.pro - comFamiliaridadeCheia.pro) < 0.12,
  `sem ${semModelo.pro.toFixed(2)} x cheia ${comFamiliaridadeCheia.pro.toFixed(2)}`)

console.log("\nPeso de lesao direciona o sorteio\n")

// Um atleta com peso alto entre dez de peso baixo tem de aparecer mais nas
// lesoes do que a fatia uniforme (1 em 11 ≈ 9%).
const vidro = elenco({ familiaridade: 20, pesoLesao: 0.55 }).map((p, i) =>
  i === 5 ? { ...p, nome: "DEVIDRO", pesoLesao: 1.45 } : p)
let lesoesDoVidro = 0, lesoesTotais = 0
for (let i = 0; i < 900; i++) {
  semearMotorDePartida(50_000 + i)
  const r = simulateFullMatch(config(vidro, elenco({ familiaridade: 20 })))
  for (const ev of r.events) {
    if (ev.type !== "injury" || ev.side !== "home") continue
    lesoesTotais++
    if (ev.player === "DEVIDRO") lesoesDoVidro++
  }
}
semearMotorDePartida(null)
const fatia = lesoesTotais ? lesoesDoVidro / lesoesTotais : 0
check("houve lesoes suficientes para medir", lesoesTotais >= 30, `${lesoesTotais} lesoes`)
check("o atleta de vidro se machuca acima da fatia uniforme",
  fatia > 0.09,
  `${(fatia * 100).toFixed(1)}% de ${lesoesTotais} lesoes (uniforme seria ~9%)`)

console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM\n" : `\n${falhas} FALHA(S)\n`)
process.exit(falhas === 0 ? 0 : 1)

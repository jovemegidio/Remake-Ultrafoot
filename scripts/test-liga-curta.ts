// LIGA CURTA NAO PODE VIRAR BRASILEIRAO.
//
// A auditoria de 31/07/2026 achou ONZE divisoes com menos de oito clubes
// curados — sete delas com UM so. E o que o jogo fazia com elas era pior do que
// nao ter liga:
//
//   • `getLeagueTeams` caia em `serieATeams`: escolher o Olympiacos montava um
//     campeonato com DEZENOVE clubes da Serie A brasileira. O grego jogava o
//     Brasileirao.
//   • `getUserLeagueTeams` devolvia a divisao como estava, e um unico clube gera
//     ZERO confrontos — o calendario ficava sem liga nenhuma.
//
// A correcao completa a divisao com clubes do MESMO PAIS (pool importado) e, so
// em ultimo caso, com vizinhos da mesma confederacao.
import {
  completarLigaComPool, getTeamsByDivision, serieATeams, allPoolTeams,
  MIN_TIMES_PARA_LIGA,
} from "../lib/teams-data"

let falhas = 0
const check = (ok: boolean, msg: string) => { if (!ok) { falhas++; console.log(`  FALHA: ${msg}`) } }

console.log("== Liga curta ==")

// As onze divisoes que a auditoria pegou.
const CURTAS = [
  "super_league_gre", "superliga_den", "fortuna_liga_cze", "premyer_liqa_aze",
  "eliteserien_nor", "protathlima_cyp", "premier_liga_kaz",
  "primera_div_bol", "primera_div_par", "primera_div_per", "primera_div_ven",
]

const brasileiros = new Set(serieATeams.map(t => t.file_key))

for (const div of CURTAS) {
  const antes = getTeamsByDivision(div)
  const depois = completarLigaComPool(div)

  // 1. A liga passa a ter tamanho de campeonato.
  check(depois.length >= MIN_TIMES_PARA_LIGA,
    `${div}: ficou com ${depois.length} clubes (minimo ${MIN_TIMES_PARA_LIGA})`)

  // 2. O CORACAO: nenhum clube da Serie A brasileira entra numa liga estrangeira.
  const invasores = depois.filter(t => brasileiros.has(t.file_key))
  check(invasores.length === 0,
    `${div}: ${invasores.length} clubes da Serie A BR entraram (${invasores.slice(0, 3).map(t => t.nome).join(", ")})`)

  // 3. Os curados originais continuam la — sao eles que tem elenco e escudo.
  for (const t of antes) {
    check(depois.some(d => d.file_key === t.file_key), `${div}: o curado ${t.nome} sumiu da propria liga`)
  }

  // 4. Ninguem duplicado (duas entradas do mesmo clube quebram o round-robin).
  check(new Set(depois.map(t => t.file_key)).size === depois.length, `${div}: clube duplicado na liga`)
}

// 5. A MAIORIA vem do proprio pais. Grecia tem 30 clubes no pool: nao ha desculpa
//    para o campeonato grego ser disputado por estrangeiros.
//
//    A comparacao precisa ser CANONICA. O catalogo grava "Grecia" e o pool
//    "Grécia" — comparar as strings cruas foi exatamente o bug que fazia o
//    Olympiacos nao achar nenhum compatriota, e um teste que repete o mesmo erro
//    reprova codigo certo.
const canon = (p: string) => (p ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
for (const div of ["super_league_gre", "primera_div_per", "primera_div_bol", "primera_div_par"]) {
  const liga = completarLigaComPool(div)
  const paisDaLiga = canon(getTeamsByDivision(div).map(t => String(t.pais ?? "")).find(Boolean) ?? "")
  const doPais = liga.filter(t => canon(String(t.pais ?? "")) === paisDaLiga).length
  check(doPais === liga.length,
    `${div}: so ${doPais} de ${liga.length} clubes sao do "${paisDaLiga}" — havia gente do pais sobrando no pool`)
}

// 6. Divisao que JA tem gente nao pode ser mexida.
for (const div of ["serie_a", "premier_league", "la_liga", "liga_argentina"]) {
  const antes = getTeamsByDivision(div)
  const depois = completarLigaComPool(div)
  check(depois.length === antes.length, `${div}: divisao cheia foi alterada (${antes.length} -> ${depois.length})`)
}

// 7. Os tres casos sem pool suficiente (Chipre 1, Tchequia 4, Cazaquistao 5)
//    completam com vizinhos da MESMA confederacao — europeus, nao brasileiros.
for (const div of ["protathlima_cyp", "fortuna_liga_cze", "premier_liga_kaz"]) {
  const liga = completarLigaComPool(div)
  check(liga.length >= MIN_TIMES_PARA_LIGA, `${div}: nem com vizinhos chegou a ${MIN_TIMES_PARA_LIGA}`)
  const sulamericanos = liga.filter(t => ["Brasil", "Argentina", "Uruguai", "Chile"].includes(String(t.pais ?? "")))
  check(sulamericanos.length === 0,
    `${div}: entraram ${sulamericanos.length} sul-americanos numa liga europeia`)
}

// 8. Sanidade da fonte: o pool precisa mesmo ter os clubes que estamos usando.
check(allPoolTeams.length > 2000, `o pool deveria ter milhares de clubes, tem ${allPoolTeams.length}`)

console.log(falhas === 0
  ? "\nOK — as 11 ligas curtas viraram campeonato de verdade, com clubes do pais certo"
  : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)

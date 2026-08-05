// A TEMPORADA CONSEGUE VIRAR? (2026 -> 2027 -> ...)
//
// Relato: "ao iniciar uma nova temporada o calendario deve mudar; para alguns
// jogadores buga". Este script cobre a metade estrutural: existe divisao em que
// a virada e IMPOSSIVEL?
//
// O portao e `isSeasonOver`, e ele tem uma trava dura:
//
//     if (!input.leagueComplete) return false
//
// ou seja, `currentWeek > seasonEndWeek` NAO salva ninguem: passada a ultima
// semana, o jogador simplesmente avanca semanas para sempre dentro de 2026.
// E `leagueComplete` e:
//
//     leagueUserFixtures.length >= (getUserLeagueTeams().length - 1) * 2
//
// O lado ESQUERDO e gerado UMA VEZ, no inicio da temporada. O lado DIREITO e
// recalculado A CADA SEMANA. Se os dois discordarem, a condicao fica impossivel
// e a temporada nunca acaba — foi assim que Serie C, Serie D, Scottish
// Premiership e Pro League BEL travaram antes (auditoria de 20/07).
//
//   npx tsx scripts/qa-virada-de-temporada.ts
import assert from "node:assert/strict"
import { getUserLeagueTeams, getLeagueRounds } from "../lib/use-game-manager"
import { generateSeasonFixtures } from "../lib/career-engine"
import { allTeams, effectiveDivision } from "../lib/teams-data"

const SEASON = 2026

// Uma divisao por clube real, sem repetir.
const divisoes = new Map<string, string>() // divisao -> um clube dela
for (const t of allTeams) {
  const d = effectiveDivision(t)
  if (d && !divisoes.has(d)) divisoes.set(d, t.curto)
}

console.log(`Divisoes encontradas: ${divisoes.size}\n`)

const travadas: string[] = []
const suspeitas: string[] = []

for (const [divisao, clube] of [...divisoes].sort()) {
  const times = getUserLeagueTeams(clube, divisao)
  const esperado = Math.max(1, (times.length - 1) * 2)

  let doUsuario = 0
  let erro = ""
  try {
    const fixtures = generateSeasonFixtures(times, clube, SEASON)
    doUsuario = fixtures.filter(f => f.homeCurto === clube || f.awayCurto === clube).length
  } catch (e) {
    erro = (e as Error).message
  }

  const rodadasDeclaradas = getLeagueRounds(divisao)
  const ok = !erro && doUsuario >= esperado
  const marca = ok ? "ok  " : "TRAVA"
  console.log(
    `${marca} ${divisao.padEnd(24)} times=${String(times.length).padStart(3)}` +
    ` jogos_do_clube=${String(doUsuario).padStart(3)} exigido=${String(esperado).padStart(3)}` +
    ` declarado=${String(rodadasDeclaradas).padStart(3)}${erro ? "  ERRO: " + erro : ""}`,
  )
  if (!ok) travadas.push(`${divisao} (gera ${doUsuario}, exige ${esperado})`)
  // Sinal amarelo: o calendario real e MENOR que o declarado. Nao trava a virada
  // (o `expectedLeagueFixtures` usa o real), mas desloca `seasonEndWeek`.
  else if (doUsuario < rodadasDeclaradas) {
    suspeitas.push(`${divisao}: joga ${doUsuario}, LEAGUE_CALENDAR declara ${rodadasDeclaradas}`)
  }
}

if (suspeitas.length) {
  console.log(`\nAviso — calendario real menor que o declarado (${suspeitas.length}):`)
  for (const s of suspeitas) console.log("  -", s)
}

if (travadas.length) {
  console.log(`\nDIVISOES EM QUE A TEMPORADA NAO VIRA (${travadas.length}):`)
  for (const t of travadas) console.log("  -", t)
}

assert.equal(
  travadas.length, 0,
  `${travadas.length} divisao(oes) nunca conseguem terminar a temporada`,
)
console.log("\nOK — toda divisao consegue completar a liga e virar a temporada")

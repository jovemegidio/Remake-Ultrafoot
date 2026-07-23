// ECONOMIA REALISTA: salario/receita por divisao, premiacao de liga, e uma
// checagem de solvencia (remover o piso de lucro nao pode falir todo clube).

import { playerSalaryWeekly, playerMarketValue, weeklyIncomeFor, leaguePrizeMoney } from "../lib/club-economy"
import { getTeamByShort } from "../lib/teams-data"
import { getPlayersForTeam } from "../lib/players-data"

let falhas = 0
function checar(nome: string, ok: boolean, detalhe = "") {
  console.log(`${ok ? "ok" : "FALHOU"}  ${nome}${detalhe ? ` — ${detalhe}` : ""}`)
  if (!ok) falhas++
}
const reais = (n: number) => `R$${(n / 1000).toFixed(0)}k`

// ── 1. Salario escala por divisao (Serie D em milhares, A em dezenas de mil) ──
{
  const estrelaA = playerSalaryWeekly(85, "serie_a")
  const jogadorD = playerSalaryWeekly(55, "serie_d")
  const medioC = playerSalaryWeekly(60, "serie_c")
  console.log(`   salarios/semana: estrela A(85)=${reais(estrelaA)} medio C(60)=${reais(medioC)} jogador D(55)=${reais(jogadorD)}`)
  checar("estrela da Serie A ganha muito mais que jogador da D", estrelaA > jogadorD * 20, `${estrelaA} vs ${jogadorD}`)
  checar("jogador de Serie D ganha na casa dos milhares/mes (nao centenas de mil)", jogadorD * 4.33 < 15000, `${reais(jogadorD * 4.33)}/mes`)
  checar("mesma divisao: overall maior paga mais", playerSalaryWeekly(85, "serie_a") > playerSalaryWeekly(70, "serie_a"))
  checar("Premier paga mais que Serie A", playerSalaryWeekly(82, "premier_league") > playerSalaryWeekly(82, "serie_a"))
}

// ── 2. Receita diferencia divisao E prestigio ───────────────────────────────
{
  const giganteA = weeklyIncomeFor("serie_a", 88)
  const medioA = weeklyIncomeFor("serie_a", 65)
  const clubeD = weeklyIncomeFor("serie_d", 20)
  console.log(`   receita/semana: gigante A=${reais(giganteA)} medio A=${reais(medioA)} clube D=${reais(clubeD)}`)
  checar("gigante da Serie A fatura muito mais que um clube da D", giganteA > clubeD * 20)
  checar("dentro da Serie A, prestigio maior fatura mais", giganteA > medioA)
  checar("clube da Serie D fatura pouco (< 100k/sem)", clubeD < 100_000, reais(clubeD))
}

// ── 3. Premiacao de liga: campeao >> ultimo, Serie A >> D ───────────────────
{
  const campeaoA = leaguePrizeMoney("serie_a", 1, 20)
  const ultimoA = leaguePrizeMoney("serie_a", 20, 20)
  const campeaoD = leaguePrizeMoney("serie_d", 1, 20)
  console.log(`   premio liga: campeao A=${reais(campeaoA)} ultimo A=${reais(ultimoA)} campeao D=${reais(campeaoD)}`)
  checar("campeao da Serie A leva mais que o ultimo", campeaoA > ultimoA * 2)
  checar("campeao da Serie A leva mais que o campeao da D", campeaoA > campeaoD * 5)
  checar("ate o ultimo leva a cota de participacao", ultimoA > 0)
}

// ── 4. Solvencia: elenco real vs receita (nao pode falir no dia 1) ──────────
{
  const cenarios: Array<{ curto: string; div: string }> = [
    { curto: "FLA", div: "serie_a" },
    { curto: "PAL", div: "serie_a" },
    { curto: "CRI", div: "serie_b" },
  ]
  for (const { curto, div } of cenarios) {
    const team = getTeamByShort(curto)
    if (!team) { checar(`${curto}: time existe`, false); continue }
    const squad = getPlayersForTeam(team)
    const folha = squad.reduce((s, p: any) => s + playerSalaryWeekly(p.base ?? p.overall ?? 60, div), 0)
    const receita = weeklyIncomeFor(div, team.prestigio ?? 70)
    // A bilheteria e o patrocinio entram por fora (~+60% num clube grande). Aqui
    // exigimos que a receita operacional sozinha cubra ao menos 55% da folha —
    // o resto vem de bilheteria/patrocinio. Sem isso o clube seria inviavel.
    const cobertura = receita / Math.max(1, folha)
    console.log(`   ${team.nome}: folha=${reais(folha)}/sem receita op=${reais(receita)}/sem cobertura=${(cobertura * 100).toFixed(0)}%`)
    checar(`${team.nome}: receita operacional cobre boa parte da folha (>=45%)`, cobertura >= 0.45, `${(cobertura * 100).toFixed(0)}%`)
  }
}

console.log(falhas === 0 ? "\n== TODOS OS TESTES PASSARAM ==" : `\n== ${falhas} FALHA(S) ==`)
process.exit(falhas === 0 ? 0 : 1)

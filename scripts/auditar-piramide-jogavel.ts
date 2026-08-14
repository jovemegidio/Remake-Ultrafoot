// AUDITA A PIRÂMIDE DAS LIGAS JOGÁVEIS: quem tem acesso, quem tem rebaixamento,
// quem tem elenco de verdade.
//
// A auditoria da 3.0 apontou "seis divisões sem acesso/rebaixamento" e "725
// clubes com menos de 18 atletas no seed cru". Este script diz QUAIS são, para
// não corrigir no escuro.
//
//   npx tsx scripts/auditar-piramide-jogavel.ts

import { competitionsByLeague } from "../lib/international-competitions"
import { promotionCount, relegationCount } from "../lib/league-pyramid"
import { completarLigaComPool, getTeamsByDivision } from "../lib/teams-data"
import { getPlayersForTeam } from "../lib/players-data"

const divisoes = Object.keys(competitionsByLeague)

interface Linha {
  divisao: string
  clubes: number
  sobe: number
  desce: number
  semElencoReal: number
  abaixoDe18: number
}

const linhas: Linha[] = []

for (const divisao of divisoes) {
  const times = completarLigaComPool(divisao)
  let semElencoReal = 0
  let abaixoDe18 = 0
  for (const time of times) {
    const elenco = getPlayersForTeam(time, { raw: true })
    const provisorios = elenco.filter(p => p.generatedOrigin === "provisional").length
    if (elenco.length - provisorios === 0) semElencoReal++
    if (elenco.length - provisorios < 18) abaixoDe18++
  }
  linhas.push({
    divisao,
    clubes: times.length,
    sobe: promotionCount(divisao),
    desce: relegationCount(divisao),
    semElencoReal,
    abaixoDe18,
  })
}

const semAcesso = linhas.filter(l => l.sobe === 0 && l.desce === 0)
const semSaida = linhas.filter(l => l.sobe === 0 || l.desce === 0)

console.log(`divisões jogáveis: ${linhas.length}`)
console.log(`clubes cobertos:   ${linhas.reduce((s, l) => s + l.clubes, 0)}`)
console.log("")
console.log("── SEM ACESSO E SEM REBAIXAMENTO (a divisão é um beco sem saída) ──")
for (const l of semAcesso) console.log(`  ${l.divisao} (${l.clubes} clubes)`)
if (!semAcesso.length) console.log("  nenhuma")
console.log("")
console.log("── SÓ UMA DAS PONTAS (sobe mas não desce, ou o contrário) ──")
for (const l of semSaida.filter(l => !semAcesso.includes(l))) {
  console.log(`  ${l.divisao}: sobe ${l.sobe}, desce ${l.desce}`)
}
console.log("")
console.log("── ELENCO ──")
for (const l of linhas.filter(l => l.abaixoDe18 > 0).sort((a, b) => b.abaixoDe18 - a.abaixoDe18)) {
  console.log(`  ${l.divisao}: ${l.abaixoDe18}/${l.clubes} clubes com menos de 18 atletas de fonte real (${l.semElencoReal} sem nenhum)`)
}
const totalAbaixo = linhas.reduce((s, l) => s + l.abaixoDe18, 0)
const totalSem = linhas.reduce((s, l) => s + l.semElencoReal, 0)
console.log("")
console.log(`total: ${totalAbaixo} clubes jogáveis abaixo de 18 atletas reais, ${totalSem} sem nenhum`)

/**
 * A TAÇA GUANABARA É UMA FASE, NÃO UMA COMPETIÇÃO.
 *
 * O título sai da liderança da classificação geral ao fim da fase de grupos do
 * Carioca — não de uma final. Este arquivo prova as três pontas de que o código
 * do motor depende, porque nenhuma delas é visível numa partida avulsa:
 *
 *  1. Todo clube do Carioca A1 resolve para um regulamento com `firstPhaseTitle`
 *     — se `getStateCompetitionRule` cair na divisão errada (armadilha já
 *     conhecida: nome de clube contido no nome de outro), o título simplesmente
 *     nunca é emitido e ninguém percebe.
 *  2. NENHUM outro estadual ganha título de fase por tabela. Sem isto, um campo
 *     novo copiado de linha em linha espalharia "Taça Guanabara" por estados
 *     que não têm nada disso.
 *  3. Com a fase inteira jogada, a tabela geral produz UM líder — e ele é o
 *     mesmo que a ordenação oficial (pontos, saldo, gols) aponta. É este líder
 *     que vira campeão; um empate técnico não resolvido coroaria dois clubes.
 */
import { allTeams } from "../lib/teams-data"
import { COMPETITION_REGULATIONS_2026 } from "../lib/competition-regulations-2026"
import {
  computeStandingsFromFixtures,
  generateStateChampionshipFixtures,
  getStateChampionshipTeams,
  getStateCompetitionRule,
  type Fixture,
} from "../lib/use-game-manager"

const fail = (message: string): never => { throw new Error(message) }
let ok = 0
const teste = (nome: string, corpo: () => void) => { corpo(); ok++; console.log(`OK    ${nome}`) }

const TITULO = "Taça Guanabara"

teste("todo clube do Carioca A1 resolve para o regulamento com título de fase", () => {
  const clubes = COMPETITION_REGULATIONS_2026.carioca_a1?.clubs ?? []
  if (clubes.length !== 12) fail(`carioca_a1 deveria listar 12 clubes, listou ${clubes.length}`)
  for (const nome of clubes) {
    const time = allTeams.find(t => t.nome === nome) ?? allTeams.find(t => t.curto === nome)
    if (!time) continue // clube fora da base: o import de elencos cobre isso, não este teste
    const regra = getStateCompetitionRule(time.curto)
    if (regra?.id !== "carioca_a1") fail(`${nome} caiu em ${regra?.id ?? "nenhum regulamento"}, não em carioca_a1`)
    if (regra?.firstPhaseTitle !== TITULO) fail(`${nome}: regulamento sem firstPhaseTitle`)
  }
})

teste("nenhum outro campeonato ganhou título de fase por tabela", () => {
  const comTitulo = Object.values(COMPETITION_REGULATIONS_2026)
    .filter(regra => regra.firstPhaseTitle)
    .map(regra => regra.id)
  if (comTitulo.join(",") !== "carioca_a1") {
    fail(`só o carioca_a1 deveria ter firstPhaseTitle; tem: ${comTitulo.join(", ") || "nenhum"}`)
  }
})

teste("a fase classificatória inteira jogada produz UM líder", () => {
  const clube = (COMPETITION_REGULATIONS_2026.carioca_a1?.clubs ?? [])
    .map(nome => allTeams.find(t => t.nome === nome) ?? allTeams.find(t => t.curto === nome))
    .find(Boolean)
  if (!clube) fail("nenhum clube do Carioca existe na base")

  const times = getStateChampionshipTeams(clube!.curto)
  const competicao = "QA Carioca"
  const fixtures = generateStateChampionshipFixtures(times, clube!.curto, competicao)
  const primeiraFase = fixtures.filter(f => f.stage === "fase_classificatoria")
  if (!primeiraFase.length) fail("o Carioca saiu sem fase classificatória")

  const rodadas = new Set(primeiraFase.map(f => f.round))
  if (rodadas.size !== 6) fail(`a fase de grupos deveria ter 6 rodadas, teve ${rodadas.size}`)

  // Placares DETERMINÍSTICOS (nada de Math.random: teste instável é pior que
  // teste nenhum). O critério é arbitrário de propósito — o que se afere é que
  // a tabela resolve em um líder só, não quem ganha.
  const jogadas: Fixture[] = primeiraFase.map((f, i) => ({
    ...f,
    played: true,
    homeScore: (i * 7) % 4,
    awayScore: (i * 3) % 3,
  }))

  const tabela = computeStandingsFromFixtures(jogadas, competicao)
  if (tabela.length !== times.length) fail(`tabela com ${tabela.length} clubes, esperado ${times.length}`)

  const lider = tabela[0]
  const empatados = tabela.filter(linha =>
    linha.points === lider.points &&
    linha.goalsFor - linha.goalsAgainst === lider.goalsFor - lider.goalsAgainst &&
    linha.goalsFor === lider.goalsFor,
  )
  if (empatados.length !== 1) {
    fail(`${empatados.length} clubes empatados na liderança sem desempate: ${empatados.map(e => e.teamShort).join(", ")}`)
  }
  if (lider.played === 0) fail("o líder não jogou nenhuma partida — a fase não foi conciliada")
})

console.log(`\n${ok} verificações, tudo OK`)

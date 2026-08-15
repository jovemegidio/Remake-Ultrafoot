import { COMPETITION_REGULATIONS_2026 } from "../lib/competition-regulations-2026"
import { competitionsByLeague } from "../lib/international-competitions"
import { NATIONAL_COMPETITIONS } from "../lib/national-competitions"
import { getContinentalSpot } from "../lib/country-competitions"
import { planWindowCompetition } from "../lib/national-windows"
import { acessoDoPais } from "../lib/divisao-de-acesso"

const failures: string[] = []
const assert = (condition: unknown, message: string) => { if (!condition) failures.push(message) }

for (const rule of Object.values(COMPETITION_REGULATIONS_2026)) {
  assert(rule.season === 2026, `${rule.id}: temporada divergente`)
  assert(rule.participants > 1, `${rule.id}: participantes inválidos`)
  if (rule.clubs) {
    assert(rule.clubs.length === rule.participants, `${rule.id}: ${rule.clubs.length}/${rule.participants} clubes`)
    assert(new Set(rule.clubs.map(club => club.toLocaleLowerCase("pt-BR"))).size === rule.clubs.length, `${rule.id}: clube duplicado`)
  }
}

const ids = new Set<string>()
const catalogById = new Map<string, (typeof competitionsByLeague)[keyof typeof competitionsByLeague][number]>()
for (const competitions of Object.values(competitionsByLeague)) {
  for (const competition of competitions) {
    assert(!ids.has(competition.id) || ["libertadores", "sulamericana", "champions_league", "europa_league", "conference_league"].includes(competition.id), `${competition.id}: id duplicado inesperado`)
    ids.add(competition.id)
    catalogById.set(competition.id, competition)
    if (competition.format === "points") {
      const cycles = competition.roundRobinCycles ?? 2
      assert(competition.rounds === (competition.teams - 1) * cycles, `${competition.id}: pontos corridos incompatível com número de rodadas`)
    }
  }
}

for (const [id, competition] of catalogById) {
  const regulation = COMPETITION_REGULATIONS_2026[id]
  assert(regulation, `${id}: sem regulamento detalhado 2026`)
  assert(regulation?.participants === competition.teams, `${id}: participantes divergem entre catálogo e regulamento`)
  assert(regulation?.sourceUrl?.startsWith("https://"), `${id}: fonte oficial ausente`)
  assert(regulation?.cycle === "2026" || regulation?.cycle === "2026/27", `${id}: ciclo da temporada ausente`)
  assert((regulation?.tiebreakers?.length ?? 0) >= 4, `${id}: desempates não cadastrados`)
}

assert(!catalogById.has("copa_mx"), "copa_mx: competição inativa não pode permanecer no calendário")
assert(catalogById.get("leagues_cup")?.teams === 36, "leagues_cup: deve ter 36 clubes em 2026")
assert(catalogById.get("mls")?.teams === 30, "mls: deve ter 30 clubes")
assert(catalogById.get("mls_cup")?.teams === 18, "mls_cup: 18 classificados (incluindo Wild Card)")
assert(catalogById.get("us_open_cup")?.teams === 80, "us_open_cup: torneio principal deve ter 80 clubes em 2026")
assert(catalogById.get("kings_cup")?.teams === 32, "kings_cup: fase principal deve ter 32 clubes")
assert(catalogById.get("saudi_first_division")?.teams === 18, "saudi_first_division: deve ter 18 clubes")
assert(catalogById.get("pro_league_bel")?.teams === 18 && catalogById.get("pro_league_bel")?.rounds === 34, "pro_league_bel: formato 2026/27 deve ser 18 clubes/34 rodadas")
assert(catalogById.get("liga_argentina")?.teams === 30 && catalogById.get("liga_argentina")?.groups === 2, "liga_argentina: deve ter 30 clubes em duas zonas")
assert(catalogById.get("j_league")?.relegation === 0, "j_league: torneio especial 2026 não possui rebaixamento")
assert(catalogById.get("j2_league")?.promotion === 0 && catalogById.get("j2_league")?.relegation === 0, "j2_league: transição 2026 sem acesso/descenso")
assert(catalogById.get("k_league_2")?.teams === 17 && catalogById.get("k_league_2")?.promotion === 3, "k_league_2: formato 2026 divergente")
assert(catalogById.get("afc_champions_league")?.teams === 32 && catalogById.get("afc_champions_league")?.rounds === 8, "afc_champions_league: formato 2026/27 divergente")
// ⚠️ `relegation` cobrava 0 ATE A 1.0.319, e o motivo era explicito: "a divisao
// abaixo (Torneo Federal) nao existe no jogo, e zona de rebaixamento que nunca
// rebaixa e pior do que nao ter zona".
//
// Essa premissa caiu quando o `acesso_arg` nasceu. Agora HA para onde cair, e
// cobrar 0 seria o defeito inverso: a Primera Nacional anunciando que ninguem
// desce enquanto a piramide desce dois por temporada.
//
// O numero e lido do CATALOGO, e nao escrito aqui: se um dia o degrau de baixo
// sumir, `acessoDoPais` devolve `undefined` e a assercao volta sozinha a cobrar
// zero — em vez de virar um numero herdado que ninguem lembra de onde veio.
{
  const quedaEsperada = acessoDoPais("Argentina")?.sobem ?? 0
  assert(
    catalogById.get("primera_b_arg")?.teams === 36
    && catalogById.get("primera_b_arg")?.groups === 2
    && catalogById.get("primera_b_arg")?.promotion === 2
    && catalogById.get("primera_b_arg")?.relegation === quedaEsperada,
    `primera_b_arg: formato AFA 2026 divergente (rebaixamento esperado ${quedaEsperada})`,
  )
}
assert(catalogById.get("torneo_betplay")?.teams === 16 && catalogById.get("torneo_betplay")?.format === "group_knockout", "torneo_betplay: formato DIMAYOR 2026 divergente")
assert(catalogById.get("primera_div_ury")?.rounds === 37 && catalogById.get("primera_div_ury")?.groups === 2, "primera_div_ury: Apertura/Intermedio/Clausura não configurados")
// 14 clubes, nao os 13 reais: com 13 o turno-returno fecha em 24 rodadas e o
// calendario declara 26 — a liga nao fecharia a temporada. Ver o comentario no
// catalogo. O que importa aqui e as rodadas baterem com o numero de clubes.
assert(catalogById.get("segunda_div_ury")?.teams === 14 && catalogById.get("segunda_div_ury")?.rounds === 26, "segunda_div_ury: formato AUF 2026 divergente")
assert((COMPETITION_REGULATIONS_2026.primera_div_chi.registrationRules?.length ?? 0) >= 4, "primera_div_chi: regras de estrangeiros/base ausentes")
assert(!getContinentalSpot("serie_b", 1).qualified, "serie_b: clube de divisão inferior não pode obter vaga continental pela colocação")
assert(getContinentalSpot("premier_league", 5).competition === "UEFA Champions League", "premier_league: quinta vaga da Champions não aplicada")
assert(getContinentalSpot("premier_league", 6).competition === "UEFA Europa League", "premier_league: vaga da Europa League não aplicada")
assert(getContinentalSpot("premier_league", 8).competition === "UEFA Conference League", "premier_league: vaga da Conference League não aplicada")

const worldCup = NATIONAL_COMPETITIONS.find(c => c.id === "copa_mundo")
assert(worldCup?.participants === 48, "copa_mundo: deve ter 48 seleções")
assert(worldCup?.groups === 12 && worldCup.groupSize === 4, "copa_mundo: deve ter 12 grupos de quatro")
assert(worldCup?.bestThirdPlaces === 8, "copa_mundo: devem avançar os oito melhores terceiros")
assert(worldCup?.knockoutStages?.[0] === "Fase de 32", "copa_mundo: mata-mata deve começar na fase de 32")

const nationalById = new Map(NATIONAL_COMPETITIONS.map(competition => [competition.id, competition]))
assert(nationalById.get("eurocopa")?.bestThirdPlaces === 4, "eurocopa: quatro melhores terceiros ausentes")
assert(nationalById.get("copa_africana")?.bestThirdPlaces === 4, "CAN: quatro melhores terceiros ausentes")
assert(nationalById.get("copa_asia")?.participants === 24 && nationalById.get("copa_asia")?.bestThirdPlaces === 4, "copa_asia: formato 24/6 grupos divergente")
assert(nationalById.get("copa_ouro")?.participants === 16 && nationalById.get("copa_ouro")?.groups === 4, "copa_ouro: formato 16/4 grupos divergente")
assert(nationalById.get("copa_oceania")?.participants === 8 && nationalById.get("copa_oceania")?.groups === 2, "OFC: formato de dois grupos divergente")
assert(nationalById.get("nations_league_uefa")?.doubleRoundRobin === true && nationalById.get("nations_league_uefa")?.knockoutStages?.[0] === "Quartas de Final", "UEFA Nations League: grupos/quatras ausentes")
assert(nationalById.get("eliminatorias_conmebol")?.leagueTeams === 10 && nationalById.get("eliminatorias_conmebol")?.leagueQualify === 6 && nationalById.get("eliminatorias_conmebol")?.playoffFrom === 7, "eliminatorias CONMEBOL: 6+1 divergente")
for (const confederation of ["uefa", "afc", "caf", "concacaf", "ofc"]) assert(nationalById.has(`eliminatorias_${confederation}`), `eliminatorias ${confederation}: regulamento separado ausente`)
assert(planWindowCompetition({ season: 2029, month: 8, confederation: "CONMEBOL" }).competitionId === "eliminatorias_conmebol", "janela CONMEBOL usa eliminatória genérica")
assert(planWindowCompetition({ season: 2029, month: 8, confederation: "AFC" }).competitionId === "eliminatorias_afc", "janela AFC usa eliminatória genérica")
assert(planWindowCompetition({ season: 2027, month: 5, confederation: "CAF" }).competitionId === "copa_africana", "CAN ausente do ciclo continental")
assert(planWindowCompetition({ season: 2027, month: 8, confederation: "UEFA" }).competitionId === "nations_league_uefa", "Nations League UEFA ausente da janela")

const expected: Record<string, Partial<{ participants: number; firstPhaseRounds: number; groups: number; relegation: number }>> = {
  brasileirao_a: { participants: 20, relegation: 4 },
  brasileirao_b: { participants: 20, relegation: 4 },
  // 20, e nao os 96 da competicao real: o jogo disputa a Serie D em chave unica,
  // como as outras divisoes (ver o comentario no catalogo). Este numero pedia 96
  // enquanto a assercao de cima cobrava igualdade com o catalogo (20) — as duas
  // regras se contradiziam e o gate ficava vermelho de forma permanente.
  brasileirao_d: { participants: 20 },
  copa_brasil: { participants: 126 },
  paulistao_a1: { participants: 16, firstPhaseRounds: 8, relegation: 2 },
  paulistao_a2: { participants: 16, firstPhaseRounds: 15, relegation: 2 },
  carioca_a1: { participants: 12, firstPhaseRounds: 6, groups: 2 },
  mineiro_modulo_i: { participants: 12, firstPhaseRounds: 8, groups: 3, relegation: 2 },
  gaucho_a1: { participants: 12, firstPhaseRounds: 6, groups: 2, relegation: 2 },
  champions_league: { participants: 36 },
}
for (const [id, fields] of Object.entries(expected)) {
  const rule = COMPETITION_REGULATIONS_2026[id]
  assert(rule, `${id}: regulamento ausente`)
  for (const [field, value] of Object.entries(fields)) assert(rule?.[field as keyof typeof rule] === value, `${id}: ${field} divergente`)
}

if (failures.length) {
  console.error(failures.map(failure => `- ${failure}`).join("\n"))
  process.exit(1)
}
const regulationSources = Object.values(COMPETITION_REGULATIONS_2026).filter(rule => rule.validationLevel === "official-specific-source").length
const officialPages = Object.values(COMPETITION_REGULATIONS_2026).filter(rule => rule.validationLevel === "official-entity-index").length
console.log(`OK: ${ids.size}/${ids.size} competições do catálogo possuem regulamento, ciclo, desempates e fonte oficial; ${Object.keys(COMPETITION_REGULATIONS_2026).length} regras totais (${regulationSources} com regulamento/fonte específica e ${officialPages} indexadas em página oficial da entidade).`)

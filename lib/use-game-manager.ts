// Hook centralizado que integra save-system com game-engine
// Gerencia a progressao da temporada, classificacao dinamica e simulacao de partidas

"use client"

import { safeLocalSet } from "@/lib/safe-storage"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createCareerId, createFreshCareerState, setActiveCareerId, useGameState, type CoachSkillId, type GameState } from "@/lib/save-system"
// Modo Desafios: a avaliação e o prêmio acontecem na virada de temporada.
import { claimReward, evaluateChallenge } from "@/lib/challenge-engine"
import { evoluirTreinador, registrarSemanaDoTreinador } from "@/lib/evolucao-do-treinador"
import { competicaoHabilitada283 } from "@/lib/configuracoes-iniciais-283"
import { atualizarAdesao282, avaliarConduta291, avaliarMetas282, negociosPorQuinzena282, normalizarGestao282, PUNICOES_CONDUTA_291, registrarTemporadaAcademia291, relatoriosDaComissao282, type EventoCarreira282 } from "@/lib/gestao-282"
import { getLeagueTeams, generateSeasonFixtures, initStandings } from "@/lib/career-engine"
import { useGameEngine, absoluteWeek, getContractStatus, isTransferWindowOpen, type StandingsEntry, type MatchResult, type MatchEvent } from "@/lib/game-engine"
import { getTeamsByDivision, getPlayablePoolTeams, getTeamByFileKey, getTeamByShort, getAllTimesFemininos, setClubDivisions, effectiveDivision, initialDivision, clubDivisionKey, allBrazilianTeams, allPoolTeams, allTeams, completarLigaComPool, MIN_TIMES_PARA_LIGA, type Team } from "@/lib/teams-data"
import { SUFIXO_FEMININO } from "@/lib/futebol-feminino"
import { getGameDate, configurarDuracaoDaTemporada } from "@/lib/game-date"
import { getPlayersForTeam } from "@/lib/players-data"
import { carregarElencosDoPool } from "@/lib/pool-elencos"
import { carregarElencosReaisTM } from "@/lib/elencos-reais-tm"
import { appendWorldTransferLog, recordWorldTransfer } from "@/lib/world-market"
import { setTemporadaDoMundo, setClubeDoUsuario } from "@/lib/temporada-do-mundo"
import { decidirReacoesDaIA, type ReacaoDaIA } from "@/lib/ai-club-engine"
import { evolveAIClubSocialState } from "@/lib/ai-club-social"
import { competitionsByLeague, type Competition } from "@/lib/international-competitions"
import { UEFA_EXPANSION_COMPETITIONS } from "@/lib/uefa-expansion"
import {
  calendarWindowForDivision,
  generateLeaguePairings,
  leagueCompetitionForDivision,
  leagueNameForDivision,
  leagueSeasonPlan,
} from "@/lib/domestic-league-engine"
import { pedidoDaSemana, montarPedido, agenteProcuraOutroClube, chanceDePreContrato, RELACAO_INICIAL } from "@/lib/pressao-do-agente"
import { generateOffers } from "@/lib/sponsor-engine"
import { caminhoDaCopa, passouNoConfronto, passouNoGrupo, resultadoDoConfronto, disputaDeterministica, type FaseCopa, type PlacarDaCopa } from "@/lib/cup-bracket"
import { COMPETITION_REGULATIONS_2026, type CompetitionRegulation2026 } from "@/lib/competition-regulations-2026"
import { DESEMPATE_CBF, ordenarPorCriterios } from "@/lib/desempate"
// Propostas de outros clubes: o motor existia mas nunca era chamado (codigo morto).
import { generateJobOffers, computeBoardConfidence, calcSeasonObjective, shouldFireManager } from "@/lib/board-engine"
import { condutaDoTreinador } from "@/lib/legado-do-treinador"
import { DIVISOES_SEM_REGISTRO, jogoRegistrado } from "@/lib/beneficios"
// As vagas de generateJobOffers vinham do nada: agora os outros clubes demitem.
import { demissoesDaRodada, manchete, tecnicoDoClube } from "@/lib/mercado-de-tecnicos"
import { addJobOffers, clearJobOffers, encerrarPassagem } from "@/lib/career-moves"
import { hardNavigate } from "@/lib/hard-navigation"
// Acesso/rebaixamento: a posicao final muda a divisao do clube na proxima temporada.
import { resolveDivisionChange, evolvePyramids, PYRAMIDS, type PyramidClub } from "@/lib/league-pyramid"
import { DIVISOES_DE_ACESSO } from "@/lib/divisao-de-acesso"
import { applySponsorDebtContribution, debtConsequences, processDebtMonth, renegotiateDebt, successorDebtBudget } from "@/lib/debt-engine"
import { advanceScoutingWeek } from "@/lib/scout-engine"
import { useNotifications } from "@/components/notifications-system"
import { isSeasonOver, selectOverdueUserFixtures } from "@/lib/fixture-catchup"
import {
  amistososVencidos, atribuirDiasDoMes, construirFixturesDeAmistoso, diaDaPartida, ehAmistoso,
  fixturesQueContamNaTemporada, migrarAmistososSemSemana,
} from "@/lib/amistosos-calendario"
import { calcMatchdayRevenue, countCareerTitles, fanBaseGrowth, stadiumCapacity, type MatchdayRevenue, type TicketTier } from "@/lib/stadium-economy"
import { calcularRenda, precosSugeridos, obraConcluida, aplicarObra } from "@/lib/stadium-sectors"
import { leaguePrizeMoney } from "@/lib/club-economy"
import { calcSeasonAwards } from "@/lib/awards-engine"
import {
  promocoesDePrestigio, ROTULO_DO_PRESTIGIO, virarTemporada,
  type FeitoDaTemporada,
} from "@/lib/prestigio-do-atleta"
import { berthsForSeason, continentalTitleBerth, type SuperCupBerth } from "@/lib/super-cups"
import { adversarioDaSupercopa, campeoesDaTemporada, type VerdadeDoSave } from "@/lib/campeoes-do-mundo"
import { qualificacaoReal2026 } from "@/lib/qualificacao-2026"
import { isFifaWindowMonth, windowLabel, cyclePhase, worldCupHosts, worldCupNote } from "@/lib/national-windows"
import { gerarScorersDaPartida } from "@/lib/competition-scorers"
import { regionalCupForState } from "@/lib/regional-cups"
import { getConfederation as getDivisionConfederation, getCountryCompetitions as getCountryCompetitionProfile } from "@/lib/country-competitions"
import {
  humorDasOrganizadas, organizadasDoClube, quadroDeSocios, satisfacaoDaTorcida,
  torcidaAposTemporada, type ConquistaDaTemporada,
} from "@/lib/torcida"
import {
  avancarUniverso286,
  candidatosScouting286,
  criarUniversoPersistente286,
  definirUniversoAtivo286,
  type NegocioUniverso286,
  type UniversoPersistente286,
} from "@/lib/universo-286"
import type { ScoutCandidate } from "@/lib/scout-engine"
import {
  desmarcarPronto, ehMultitecnico, faltamFechar, iniciarRodada, marcarPronto, podeAvancar,
  proximoAJogar, tecnicosDoSave, type TecnicoDoSave,
} from "@/lib/tecnicos-do-save"
import {
  forcasDoPlantel, titularesAptos, type AtletaEmCampo,
} from "@/lib/forca-do-plantel"
import {
  simularPartida, forcaPorPrestigio, type ForcaPorSetor,
} from "@/lib/simulacao-da-partida"
import {
  chaveDaLiga, guardarEstadoDaLiga, guardarEstadoDoClube, guardarEstadoDoMundo,
  guardarEstadoDoTempo, guardarSaveDaLiga, guardarSaveDoTecnico,
  restaurarEstadoDoClube, restaurarSaveDoTecnico,
} from "@/lib/chaveamento-de-tecnico"

/** Monta uma vez o mundo de uma carreira a partir dos elencos reais do build. */
function semearUniverso286(temporada: number, clubeDoUsuario: string): UniversoPersistente286 {
  // Nunca deixe o cache de outra carreira contaminar a fotografia inicial.
  definirUniversoAtivo286(null)
  // ⚠️ O MUNDO DA CARREIRA É O DA MODALIDADE. Numa carreira feminina, semear o
  // universo com os clubes masculinos daria à técnica um mundo de rivais,
  // mercado e elencos que ela nunca vai encontrar — o clube dela disputaria a
  // liga feminina enquanto o "mundo vivo" ao lado envelhecia outro futebol.
  const doUsuario = getTeamByShort(clubeDoUsuario)
  const feminino = String(doUsuario?.file_key ?? "").endsWith(SUFIXO_FEMININO)
  const clubesJogaveis = (feminino
    ? getAllTimesFemininos()
    : [...allTeams, ...getPlayablePoolTeams()]
  ).filter((time, index, todos) =>
    todos.findIndex(outro => outro.file_key === time.file_key) === index)
  return criarUniversoPersistente286({
    temporada,
    clubeDoUsuario,
    clubes: clubesJogaveis.map(time => ({
      curto: time.curto,
      nome: time.nome,
      pais: time.pais,
      divisao: String(effectiveDivision(time)),
      prestigio: time.prestigio ?? 55,
      saldo: time.saldo ?? 0,
      jogadores: getPlayersForTeam(time).map(jogador => ({
        id: jogador.ft,
        nome: jogador.nome,
        posicao: String(jogador.pos),
        idade: jogador.idade,
        overall: jogador.base,
        nacionalidade: jogador.nac,
        pace: jogador.pace,
        shooting: jogador.shooting,
        passing: jogador.passing,
        dribbling: jogador.dribbling,
        defending: jogador.defending,
        physical: jogador.physical,
      })),
    })),
  })
}

function candidatosDoUniversoParaScouting(estado?: UniversoPersistente286): ScoutCandidate[] {
  if (!estado) return []
  return candidatosScouting286(estado).map(jogador => {
    const clube = jogador.clubeCurto ? estado.clubes[jogador.clubeCurto] : undefined
    return {
      id: jogador.id,
      name: jogador.nome,
      clubShort: jogador.clubeCurto,
      clubName: clube?.nome ?? "Sem clube",
      country: clube?.pais ?? jogador.nacionalidade ?? "Desconhecido",
      nationality: jogador.nacionalidade,
      position: jogador.posicao,
      age: jogador.idade,
      overall: jogador.overall,
      potential: jogador.potencial,
      value: jogador.valor,
      weeklySalary: jogador.contrato.salarioSemanal,
      contractEndSeason: jogador.contrato.ateTemporada,
      currentSeason: estado.temporada,
      morale: jogador.moral,
      injuryWeeks: jogador.lesaoSemanas,
      attributes: jogador.atributos,
    }
  })
}

/** Mantém a Central e os elencos legados sincronizados com os negócios da IA. */
function publicarNegociosDoUniverso(negocios: NegocioUniverso286[]): void {
  for (const negocio of negocios) {
    recordWorldTransfer(negocio.de, negocio.para, {
      nome: negocio.jogador,
      pos: negocio.posicao,
      idade: negocio.idade,
      base: negocio.overall,
      temporada: negocio.temporada,
    })
  }
  appendWorldTransferLog(negocios.map(negocio => ({
    atleta: negocio.jogador,
    de: negocio.de,
    para: negocio.para,
    valor: negocio.valor,
    pos: negocio.posicao,
    idade: negocio.idade,
    base: negocio.overall,
    temporada: negocio.temporada,
    semana: negocio.semana,
  })))
}

const LEAGUE_NAMES: Record<string, string> = {
  serie_a: "Brasileirao Serie A",
  serie_b: "Brasileirao Serie B",
  serie_c: "Brasileirao Serie C",
  serie_d: "Brasileirao Serie D",
  premier_league: "Premier League",
  la_liga: "La Liga",
  serie_a_ita: "Serie A",
  bundesliga: "Bundesliga",
  ligue_1: "Ligue 1",
  saudi_pro: "Saudi Pro League",
  mls: "Major League Soccer",
  liga_mx: "Liga MX",
  primeira_liga: "Primeira Liga",
  j_league: "J-League",
  paulistao: "Campeonato Paulista",
  carioca: "Campeonato Carioca",
  mineiro: "Campeonato Mineiro",
  gaucho: "Campeonato Gaucho",
  // Os nomes das divisoes de acesso saem do catalogo (lib/divisao-de-acesso).
  ...Object.fromEntries(DIVISOES_DE_ACESSO.map(d => [d.id, d.rotulo])),
}

// Configuracao do calendario de cada liga: mes de inicio (0=Jan) e duracao em meses
interface LeagueCalendarConfig {
  startMonth: number
  monthsInSeason: number
  rounds: number
}

const LEAGUE_CALENDAR: Record<string, LeagueCalendarConfig> = {
  // Ligas brasileiras: parte nacional comeca em abril
  // Brasileirao: abril a DEZEMBRO (9 meses), como na vida real — a ultima rodada
  // cai no comeco de dezembro. Antes ia so ate novembro (8 meses) e o jogador
  // reclamava do calendario "sem dezembro".
  serie_a:        { startMonth: 3,  monthsInSeason: 9,  rounds: 38 },
  serie_b:        { startMonth: 3,  monthsInSeason: 9,  rounds: 38 },
  serie_c:        { startMonth: 3,  monthsInSeason: 8,  rounds: 38 },
  serie_d:        { startMonth: 3,  monthsInSeason: 8,  rounds: 38 },
  // Estaduais isolados (divisao propria)
  paulistao:      { startMonth: 0,  monthsInSeason: 3,  rounds: 14 },
  carioca:        { startMonth: 0,  monthsInSeason: 3,  rounds: 12 },
  mineiro:        { startMonth: 0,  monthsInSeason: 3,  rounds: 12 },
  gaucho:         { startMonth: 0,  monthsInSeason: 3,  rounds: 12 },
  // Europa: agosto a maio
  premier_league: { startMonth: 7,  monthsInSeason: 10, rounds: 38 },
  la_liga:        { startMonth: 7,  monthsInSeason: 10, rounds: 38 },
  serie_a_ita:    { startMonth: 7,  monthsInSeason: 10, rounds: 38 },
  bundesliga:     { startMonth: 7,  monthsInSeason: 10, rounds: 34 },
  ligue_1:        { startMonth: 7,  monthsInSeason: 10, rounds: 34 },
  primeira_liga:  { startMonth: 7,  monthsInSeason: 10, rounds: 34 },
  eredivisie:     { startMonth: 7,  monthsInSeason: 10, rounds: 34 },
  scottish_prem:  { startMonth: 7,  monthsInSeason: 10, rounds: 38 },
  scottish_champ: { startMonth: 7,  monthsInSeason: 10, rounds: 18 },
  super_lig:      { startMonth: 7,  monthsInSeason: 10, rounds: 34 },
  // 18 clubes desde 2026/27 => 34 rodadas. Este numero TEM de acompanhar
  // `teams`/`rounds` do catalogo: foi a divergencia entre as duas fontes que
  // deixou quatro ligas sem conseguir fechar a temporada (bug #1).
  pro_league_bel: { startMonth: 7,  monthsInSeason: 10, rounds: 34 },
  russian_prem:   { startMonth: 6,  monthsInSeason: 11, rounds: 30 },
  // Americas nao-Brasil
  mls:            { startMonth: 2,  monthsInSeason: 9,  rounds: 34 },
  liga_mx:        { startMonth: 6,  monthsInSeason: 11, rounds: 34 },
  liga_argentina: { startMonth: 0,  monthsInSeason: 12, rounds: 46 },
  primera_a_col:  { startMonth: 1,  monthsInSeason: 11, rounds: 38 },
  primera_div_chi:{ startMonth: 1,  monthsInSeason: 10, rounds: 36 },
  // Apertura (15) + Intermedio (7) + Clausura (15) = 37, igual ao catalogo.
  primera_div_ury:{ startMonth: 1,  monthsInSeason: 10, rounds: 37 },
  primera_a_ecu:  { startMonth: 1,  monthsInSeason: 10, rounds: 30 },
  serie_b_ecu:    { startMonth: 1,  monthsInSeason: 10, rounds: 18 },
  // Asia
  saudi_pro:      { startMonth: 7,  monthsInSeason: 10, rounds: 34 },
  j_league:       { startMonth: 1,  monthsInSeason: 11, rounds: 38 },
  k_league_1:     { startMonth: 1,  monthsInSeason: 11, rounds: 38 },
  chinese_super:  { startMonth: 1,  monthsInSeason: 10, rounds: 30 },
  // 2as divisoes Europa
  championship:   { startMonth: 7,  monthsInSeason: 10, rounds: 46 },
  la_liga_2:      { startMonth: 7,  monthsInSeason: 10, rounds: 42 },
  serie_b_ita:    { startMonth: 7,  monthsInSeason: 10, rounds: 38 },
  bundesliga_2:   { startMonth: 7,  monthsInSeason: 10, rounds: 34 },
  ligue_2:        { startMonth: 7,  monthsInSeason: 10, rounds: 34 },
  liga_portugal_2:{ startMonth: 7,  monthsInSeason: 10, rounds: 34 },
  eerste_divisie: { startMonth: 7,  monthsInSeason: 10, rounds: 38 },
  challenger_pro: { startMonth: 7,  monthsInSeason: 10, rounds: 30 },
  tff_1_lig:      { startMonth: 7,  monthsInSeason: 10, rounds: 38 },
  russian_first:  { startMonth: 6,  monthsInSeason: 11, rounds: 38 },
  // 2as divisoes Americas
  primera_b_arg:  { startMonth: 0,  monthsInSeason: 12, rounds: 38 },
  torneo_betplay: { startMonth: 1,  monthsInSeason: 11, rounds: 30 },
  primera_b_chi:  { startMonth: 1,  monthsInSeason: 10, rounds: 30 },
  segunda_div_ury:{ startMonth: 1,  monthsInSeason: 10, rounds: 26 },
  // 2as divisoes Asia
  saudi_first_div:{ startMonth: 7,  monthsInSeason: 10, rounds: 34 },
  j2_league:      { startMonth: 1,  monthsInSeason: 11, rounds: 40 },
  k_league_2:     { startMonth: 1,  monthsInSeason: 11, rounds: 36 },
  china_league_one:{ startMonth: 1, monthsInSeason: 10, rounds: 20 },
}

/**
 * A divisao de acesso HERDA a janela de calendario da divisao acima dela.
 *
 * Faz sentido no mundo (o quinto nivel de um pais joga na mesma epoca do quarto)
 * e evita o erro que este mapa ja teve: uma liga com janela europeia num pais de
 * calendario invertido faz a temporada terminar antes de a tabela acabar. Como o
 * numero de rodadas que VALE sai do elenco real da divisao, este campo so
 * dimensiona a liga quando o usuario nao esta nela.
 *
 * Escrito depois do objeto porque ele nao pode se referenciar durante a propria
 * inicializacao.
 */
for (const acesso of DIVISOES_DE_ACESSO) {
  if (LEAGUE_CALENDAR[acesso.id]) continue
  // A janela PRÓPRIA vence a herança — hoje só o Brasil tem uma, para fechar em
  // dezembro em vez do novembro que a Série D dita.
  const janela = acesso.calendario ?? LEAGUE_CALENDAR[acesso.acima]
  if (janela) LEAGUE_CALENDAR[acesso.id] = { ...janela }
}

function leagueCalendarConfig(division: string): LeagueCalendarConfig {
  const explicit = LEAGUE_CALENDAR[division]
  if (explicit) return explicit
  const competition = leagueCompetitionForDivision(division)
  const teamCount = competition?.teams ?? 20
  const window = calendarWindowForDivision(division)
  return {
    ...window,
    rounds: leagueSeasonPlan(division, teamCount).maximumMatches,
  }
}

// Meses que o calendario deve MOSTRAR, derivados do MESMO LEAGUE_CALENDAR que
// posiciona os jogos (getRoundMonth). Antes a tela usava listas de regiao
// escritas a mao que NAO batiam com os meses reais dos jogos — o time argentino
// via Jul-Mai enquanto os jogos iam de Jan a Dez, e o brasileiro nao via
// dezembro. Derivar da fonte unica elimina o descompasso: aba e jogo sempre no
// mesmo mes.
export function seasonMonthsForDivision(division: string): number[] {
  const cfg = leagueCalendarConfig(division)
  // Europa (e ligas que cruzam o ano, comecando no 2o semestre): arco ago->mai.
  if (cfg.startMonth >= 6) {
    const meses: number[] = []
    for (let i = 0; i < 10; i++) meses.push((cfg.startMonth + i) % 12)
    return meses
  }
  // Brasil e ligas de ANO-CALENDARIO: o futebol vai de JANEIRO a DEZEMBRO —
  // estaduais no comeco do ano, a liga do meio ao fim, copas/continental e o
  // Mundial no meio. O jogador pediu ver o ano inteiro; meses sem jogo ficam
  // vazios, mas o calendario reflete a temporada real completa.
  return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
}

export const ESTADO_CAMPEONATO: Record<string, string> = {
  SP: "Campeonato Paulista",
  RJ: "Campeonato Carioca",
  RS: "Campeonato Gaucho",
  MG: "Campeonato Mineiro",
  BA: "Campeonato Baiano",
  PR: "Campeonato Paranaense",
  PE: "Campeonato Pernambucano",
  CE: "Campeonato Cearense",
  GO: "Campeonato Goiano",
  SC: "Campeonato Catarinense",
  AL: "Campeonato Alagoano",
  PA: "Campeonato Paraense",
  AM: "Campeonato Amazonense",
  DF: "Campeonato Brasiliense",
  ES: "Campeonato Capixaba",
  MT: "Campeonato Mato-Grossense",
  RN: "Campeonato Potiguar",
  PB: "Campeonato Paraibano",
  MA: "Campeonato Maranhense",
  PI: "Campeonato Piauiense",
  SE: "Campeonato Sergipano",
  RO: "Campeonato Rondoniense",
  AP: "Campeonato Amapaense",
  // Auditoria 2026-07-20 (scripts/audit-estados.ts): MS e AC têm 4 clubes cada
  // no dado real e estavam FORA do mapa — jogadores desses estados ficavam sem
  // estadual. MT/RO/AP continuam mapeados mas com <4 clubes: o
  // getStateChampionshipTeams devolve [] e o estadual não acontece; para
  // resolver esses é preciso importar mais clubes, não mudar código.
  MS: "Campeonato Sul-Mato-Grossense",
  AC: "Campeonato Acreano",
  // Auditoria 2026-07-23: RR (8 clubes na base) e TO (7) tinham clubes e
  // NENHUM estadual mapeado — eram os dois ultimos estados de fora. Com eles,
  // os 27 estados estao cobertos.
  RR: "Campeonato Roraimense",
  TO: "Campeonato Tocantinense",
}

const BRAZILIAN_DIVISIONS = ["serie_a", "serie_b", "serie_c", "serie_d", "divisao_acesso_br"]

function isBrazilianDivision(division: string): boolean {
  return BRAZILIAN_DIVISIONS.includes(division)
}

// Clube brasileiro para efeito de ESTADUAL. Diferente de isBrazilianDivision,
// que responde "esta em uma das quatro Series" e governa a geracao das LIGAS
// nacionais — ali `pool:Brasil` nao entra mesmo.
//
// O estadual, porem, nao depende de divisao: clube de varzea disputa estadual.
// Barrar por divisao deixava SEM estadual todo clube que existe apenas no pool
// (MS e AC inteiros, e qualquer clube pool-only dos outros 25 estados).
function disputaEstadual(division: string): boolean {
  return isBrazilianDivision(division) || division === "pool:Brasil"
}

// Mapeia rodada para mes com base na config do calendario da liga
function getRoundMonth(round: number, startMonth: number, monthsInSeason: number, totalRounds: number): number {
  const monthOffset = Math.floor((round - 1) * monthsInSeason / totalRounds)
  return (startMonth + monthOffset) % 12
}

// PAUSA PARA DATA FIFA. Na vida real o campeonato de clubes PARA quando abre a
// janela de selecoes (amistosos, Eliminatorias, Copa America/Euro, Copa do
// Mundo) e so volta quando ela fecha. O jogo marcava rodada de clube em cima da
// data FIFA. Aqui inserimos uma semana de pausa no calendario de clubes toda vez
// que a temporada ENTRA numa janela FIFA (uma pausa por janela, nao por rodada),
// deslocando os jogos seguintes — exatamente o "fica parado ate acabar".
//
// A pausa e isUserMatch:false + played:true: nao conta como compromisso do
// clube, entao nao interfere na deteccao de fim de temporada; so cria o buraco.
export function aplicarPausasFifa(fixtures: Fixture[], userTeam: Team, season = 2026): Fixture[] {
  // Mes de cada semana de LIGA — a pausa e do calendario de CLUBES.
  const monthOfWeek = new Map<number, number>()
  for (const f of fixtures) {
    if (f.competitionType === "league" && !monthOfWeek.has(f.week)) monthOfWeek.set(f.week, f.month)
  }
  const weeks = [...monthOfWeek.keys()].sort((a, b) => a - b)
  if (weeks.length < 2) return fixtures

  // Em ano de Copa do Mundo, a janela de JUNHO deixa de ser uma data FIFA de 1
  // semana e vira a pausa do MUNDIAL: ~6 semanas (11/jun a 19/jul), o clube para
  // de verdade. Era esse o buraco do relato "nao teve a pausa para copa do mundo"
  // — o codigo so inseria 1 semaninha em junho, imperceptivel. Fora do ano de
  // Mundial, cada janela FIFA (Mar/Jun/Set/Out/Nov) pausa 1 semana, como antes.
  const anoDeCopa = cyclePhase(season) === "wc"

  // Ponto de pausa: a 1a semana de liga de CADA mes de janela FIFA. Setembro,
  // Outubro e Novembro sao janelas SEPARADAS (cada uma pausa), por isso a condicao
  // e "mudou para um mes FIFA", nao "entrou numa sequencia FIFA". Comeca do 2o
  // para nunca abrir a temporada com uma pausa antes do 1o jogo.
  const pausas: { week: number; month: number; count: number; label: string; mundial: boolean }[] = []
  let prevMonth = monthOfWeek.get(weeks[0]) ?? -1
  for (let i = 1; i < weeks.length; i++) {
    const m = monthOfWeek.get(weeks[i]) ?? -1
    if (isFifaWindowMonth(m) && m !== prevMonth) {
      const mundial = anoDeCopa && m === 5 // junho do ano de Copa
      pausas.push({
        week: weeks[i], month: m,
        count: mundial ? 6 : 1,
        label: mundial ? "Copa do Mundo FIFA" : windowLabel(m),
        mundial,
      })
    }
    prevMonth = m
  }
  if (pausas.length === 0) return fixtures

  const out = [...fixtures]
  let breakId = 90000
  // Do fim para o comeco: cada insercao desloca tudo a partir da semana em +count,
  // e as pausas de semanas menores nao sao afetadas pelas de semanas maiores.
  for (const p of [...pausas].sort((a, b) => b.week - a.week)) {
    for (const f of out) if (f.week >= p.week) {
      f.week += p.count
      // O MÊS precisa acompanhar a nova semana: sem isto, um jogo de clube
      // empurrado pela pausa da Copa continuava com month=Junho e AINDA aparecia
      // em Junho no calendário, ao lado do aviso "clubes pausados" (relato). Os
      // fifa_break têm mês próprio (Jun/Jul do Mundial) e não são recomputados.
      if (f.competitionType !== "fifa_break") {
        const data = getGameDate(season, f.week)
        // A temporada que ESTOURA O ANO (as pausas somam ~9 semanas em ano de
        // Mundial e empurram as últimas rodadas para depois de 31/dez) não pode
        // voltar para JANEIRO: janeiro já é o estadual do começo do ano, e os
        // dois campeonatos disputavam as mesmas células do calendário — um deles
        // simplesmente não era desenhado. A sobra fica em dezembro.
        f.month = data.getFullYear() > season ? 11 : data.getMonth()
      }
    }
    for (let k = 0; k < p.count; k++) {
      // O Mundial atravessa junho->julho: as primeiras semanas ficam em junho (5),
      // as ultimas em julho (6), para o calendario mostrar o torneio nos dois meses.
      const mes = p.mundial ? (k < 3 ? 5 : 6) : p.month
      out.push({
        id: breakId++, round: 0, week: p.week + k,
        homeTeam: userTeam, awayTeam: userTeam,
        competition: p.label,
        played: true, isUserMatch: false, month: mes,
        competitionType: "fifa_break",
        worldCup: p.mundial,
      })
    }
  }
  return out
}

// Acima deste numero de times o estadual roda em TURNO UNICO, para nao virar um
// campeonato de 24+ rodadas (o Paulista real tem ~12 rodadas de fase de grupos).
const STATE_SINGLE_ROUND_THRESHOLD = 8
const STATE_MAX_TEAMS = 20

const normalizeCompetitionClub = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")
const STATE_RULE_IDS: Record<string, readonly string[]> = {
  SP: ["paulistao_a1", "paulistao_a2", "paulistao_a3"],
  RJ: ["carioca_a1"],
  MG: ["mineiro_modulo_i"],
  RS: ["gaucho_a1"],
  BA: ["baiano"],
  PR: ["paranaense"],
  PE: ["pernambucano"],
  CE: ["cearense"],
  GO: ["goiano"],
  SC: ["catarinense"],
  AL: ["alagoano"],
  PA: ["paraense"],
  AM: ["amazonense"],
  DF: ["brasiliense"],
  ES: ["capixaba"],
  MT: ["mato_grossense"],
  RN: ["potiguar"],
  PB: ["paraibano"],
  MA: ["maranhense"],
  PI: ["piauiense"],
  SE: ["sergipano"],
  RO: ["rondoniense"],
  AP: ["amapaense"],
  MS: ["sul_mato_grossense"],
  AC: ["acreano"],
  RR: ["roraimense"],
  TO: ["tocantinense"],
}

export function getStateCompetitionRule(userTeamShort: string): CompetitionRegulation2026 | undefined {
  const userTeam = getTeamByShort(userTeamShort)
  if (!userTeam) return undefined
  const normalized = normalizeCompetitionClub(userTeam.nome)
  const candidates = (STATE_RULE_IDS[userTeam.estado] ?? []).map(id => COMPETITION_REGULATIONS_2026[id]).filter(Boolean)

  // DIVISAO do estadual (A1/A2/A3). O nome tem que casar EXATO antes de qualquer
  // aproximacao. So com substring, o nome curto de um clube da A1 esta contido no
  // nome longo de outro clube, de outra divisao, e como a busca devolvia a
  // PRIMEIRA divisao da lista o clube menor era promovido:
  //   "Portuguesa" (A1)    dentro de "Portuguesa Santista" (A3)
  //   "Sao Bernardo" (A1)  dentro de "EC Sao Bernardo"     (A3)
  // Os dois clubes da A3 jogavam o regulamento da A1.
  const exact = candidates.find(rule =>
    rule.clubs?.some(name => normalizeCompetitionClub(name) === normalized),
  )
  if (exact) return exact

  // Sem casamento exato, vence a aproximacao MAIS ESPECIFICA (maior trecho de
  // nome em comum) em vez da primeira divisao encontrada.
  let best: { rule: CompetitionRegulation2026; score: number } | undefined
  for (const rule of candidates) {
    for (const name of rule.clubs ?? []) {
      const club = normalizeCompetitionClub(name)
      if (!club || !(club.includes(normalized) || normalized.includes(club))) continue
      const score = Math.min(club.length, normalized.length)
      if (!best || score > best.score) best = { rule, score }
    }
  }
  return best?.rule ?? candidates[0]
}

// Retorna TODOS os times do estado que disputam o estadual (minimo 4).
// Antes havia um cap fixo de 8 -> SP (13 times) ficava com 5 clubes de fora.
export function getStateChampionshipTeams(userTeamShort: string): Team[] {
  const userTeam = getTeamByShort(userTeamShort)
  if (!userTeam || !disputaEstadual(userTeam.divisao)) return []
  const estado = userTeam.estado
  if (!ESTADO_CAMPEONATO[estado]) return []
  // Curados + clubes do POOL do mesmo estado (o pool ganhou `estado` via
  // assign-pool-br-states.mjs), para estaduais de BA/RS/CE/PR/etc. deixarem de ficar vazios.
  // Dedup por file_key/curto; ordena por prestigio (mais forte primeiro).
  // Dedup por file_key E POR `curto`. O codigo curto NAO e unico na base (134
  // codigos para ~400 clubes): Rio Branco-ES e Rio Branco VN, por exemplo, tem
  // file_keys diferentes e o mesmo RIOBRANC. Como o motor de partidas identifica
  // time por `curto`, os dois no mesmo estadual faziam o clube jogar duas vezes
  // na mesma rodada. Dois clubes com o mesmo codigo nao podem dividir a mesma
  // competicao — fica o de maior prestigio, que entra primeiro na ordenacao.
  const seen = new Set<string>()
  const codigosUsados = new Set<string>()
  const stateTeams = [...allBrazilianTeams, ...allPoolTeams]
    .filter(t => t.estado === estado)
    .sort((a, b) => b.prestigio - a.prestigio || a.nome.localeCompare(b.nome))
    .filter(t => {
      const k = (t.file_key || t.curto || t.nome).toLowerCase()
      const codigo = (t.curto || "").toLowerCase()
      if (seen.has(k) || (codigo && codigosUsados.has(codigo))) return false
      seen.add(k)
      if (codigo) codigosUsados.add(codigo)
      return true
    })
    .sort((a, b) => b.prestigio - a.prestigio || a.nome.localeCompare(b.nome))
  if (stateTeams.length < 4) return []

  const regulation = getStateCompetitionRule(userTeamShort)
  if (regulation?.clubs?.length) {
    // Alguns clubes importados chegam sem `estado` (ou com a UF no campo `pais`).
    // Procurar somente em `stateTeams` deixava regulamentos oficiais incompletos:
    // a A2 paulista, por exemplo, podia ficar com 5 equipes e ainda tentar disputar
    // 15 rodadas, reiniciando o algoritmo e repetindo os mesmos confrontos.
    const globalCandidates = [...allBrazilianTeams, ...allPoolTeams]
    const selected = regulation.clubs.map(name => {
      const expected = normalizeCompetitionClub(name)
      const exact = [...stateTeams, ...globalCandidates].find(team =>
        normalizeCompetitionClub(team.nome) === expected,
      )
      if (exact) return exact
      return stateTeams.find(team => {
        const actual = normalizeCompetitionClub(team.nome)
        return actual.includes(expected) || expected.includes(actual)
      })
    }).filter((team): team is Team => Boolean(team))

    const completed: Team[] = []
    const completedKeys = new Set<string>()
    const completedCodes = new Set<string>()
    const addUnique = (team: Team) => {
      const key = (team.file_key || team.curto || team.nome).toLowerCase()
      const codigo = (team.curto || "").toLowerCase()
      if (completedKeys.has(key) || (codigo && completedCodes.has(codigo))) return
      completedKeys.add(key)
      if (codigo) completedCodes.add(codigo)
      completed.push(team)
    }
    selected.forEach(addUnique)
    if (!completed.some(team => team.curto === userTeamShort)) addUnique(userTeam)
    // Se algum participante oficial ainda não existe na base, completa a quantidade
    // com clubes reais da mesma UF. O calendário nunca recebe menos equipes do que o
    // formato exige quando há alternativas locais disponíveis.
    stateTeams.forEach(team => {
      if (completed.length < regulation.participants) addUnique(team)
    })
    if (completed.length >= 4) return completed.slice(0, regulation.participants)
  }

  // Sem lista nominal de participantes, o teto era sempre STATE_MAX_TEAMS (20).
  // Isso ignorava o `participants` do regulamento: Paranaense e Catarinense sao
  // formatos de 12 e entravam com 15 e 14 clubes, e o Goiano de 12 com 16 — o
  // numero de rodadas do regulamento deixa de fechar com o numero de times, e a
  // fase de grupos fica torta. Quando ha regulamento, ele manda no tamanho.
  const limite = regulation?.participants ?? STATE_MAX_TEAMS
  const teams = stateTeams.slice(0, Math.min(limite, STATE_MAX_TEAMS))
  if (!teams.some(t => t.curto === userTeamShort)) teams[0] = userTeam
  return teams
}

/** Campos grandes rodam em turno unico; campos pequenos em ida e volta. */
function stateChampIsDoubleRound(teamCount: number): boolean {
  return teamCount <= STATE_SINGLE_ROUND_THRESHOLD
}

/** Um turno com quantidade ímpar precisa de N rodadas (uma folga por clube). */
function getRoundRobinHalfRounds(teamCount: number): number {
  return teamCount % 2 === 0 ? teamCount - 1 : teamCount
}

// Retorna o numero de rodadas do campeonato estadual
export function getStateChampRounds(userTeamShort: string): number {
  const teams = getStateChampionshipTeams(userTeamShort)
  if (teams.length < 4) return 0
  const regulation = getStateCompetitionRule(userTeamShort)
  const officialRounds = regulation?.firstPhaseRounds
  const half = getRoundRobinHalfRounds(teams.length)
  // O teto do turno unico (`half`) impedia um regulamento de TURNO E RETURNO de
  // acontecer: o Rondoniense (7 clubes, 42 jogos) ficava com 7 rodadas em vez de
  // 14 — meio campeonato. Se o proprio regulamento pede mais rodadas do que um
  // turno do seu campo comporta, ele e de returno, e o teto passa a ser dois
  // turnos. Quando faltam clubes na base para o formato oficial (Brasiliense e
  // Roraimense hoje), o clamp continua valendo: melhor um turno curto do que
  // rodadas que o campo nao tem como jogar.
  const regulationIsDoubleRound = Boolean(
    officialRounds && regulation && officialRounds > getRoundRobinHalfRounds(regulation.participants),
  )
  const maxJogavel = regulationIsDoubleRound ? half * 2 : half
  const firstPhase = officialRounds
    ? Math.min(officialRounds, maxJogavel)
    : stateChampIsDoubleRound(teams.length) ? half * 2 : half
  const finalPhases = regulation
    ? (regulation.knockout ?? []).reduce((total, stage) =>
        total + (regulation.stageRounds?.[stage] ?? regulation.knockoutLegs?.[stage] ?? (stage === "final" ? regulation.finalLegs : 1) ?? 1), 0)
    : 0
  return firstPhase + finalPhases
}

/**
 * Premio em dinheiro por conquistar um titulo, por peso da competicao. Valores
 * na moeda do jogo (saldo inicial ~27,5M; receita semanal 0,8-4,5M), calibrados
 * para o titulo pesar sem quebrar a economia: uma Libertadores paga varias
 * semanas de operacao, um estadual e simbolico.
 */
export function cupTitlePrize(competitionName: string): number {
  const c = competitionName
    .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  if (/champions league|libertadores/.test(c)) return 45_000_000
  if (/europa league|sul-?americana|sudamericana/.test(c)) return 18_000_000
  if (/conference league/.test(c)) return 9_000_000
  if (/copa do brasil/.test(c)) return 12_000_000
  // O Mundial de 32 paga muito mais que uma supercopa — e o torneio mais rico do
  // calendario de clubes. A Intercontinental fica no meio do caminho.
  if (/mundial/.test(c)) return 60_000_000
  if (/intercontinental/.test(c)) return 20_000_000
  if (/supercopa|recopa|super cup/.test(c)) return 8_000_000
  // Estaduais e demais copas regionais: simbolico.
  return 1_500_000
}

// Retorna o total de rodadas da liga principal
export function getLeagueRounds(division: string): number {
  const doCalendario = LEAGUE_CALENDAR[division]?.rounds
  if (doCalendario) return doCalendario

  // ⚠️ AS DIVISOES DA EXPANSAO UEFA NAO ESTAO NO LEAGUE_CALENDAR e caiam no
  // padrao de 38. Mas elas declaram 21 (Romenia), 30 (Austria), 34 (Polonia) e
  // 36 (Suica) — e quando o calendario pede mais rodadas do que a competicao
  // tem, a liga NUNCA FECHA A TEMPORADA. E o mesmo defeito que a Pro League
  // belga ja teve (16 clubes/30 rodadas contra 34 do calendario), documentado
  // em international-competitions.
  //
  // Perguntar a propria competicao evita ter de repetir cada numero aqui e
  // mantem as proximas federacoes corretas sem ninguem lembrar deste arquivo.
  const daCompeticao = UEFA_EXPANSION_COMPETITIONS[division]?.[0]?.rounds
  if (daCompeticao) return daCompeticao

  const competition = leagueCompetitionForDivision(division)
  if (competition) return leagueSeasonPlan(division, competition.teams).maximumMatches

  return 38
}

// ── Copas e competicoes continentais ─────────────────────────────────────────
// O calendario jogavel inclui, alem da liga (e do estadual no Brasil), as copas
// nacionais e as competicoes continentais que o time do usuario disputa. Apenas
// as partidas do usuario sao geradas (acompanhamos a campanha dele); os
// resultados nao alteram a classificacao da liga.

// Divisoes por confederacao (para sortear adversarios continentais coerentes)
const SOUTH_AMERICAN_DIVISIONS = new Set([
  "serie_a", "serie_b", "serie_c", "serie_d",
  "liga_argentina", "primera_a_col", "primera_div_chi", "primera_div_ury",
  "primera_b_arg", "torneo_betplay", "primera_b_chi", "segunda_div_ury",
])
const EUROPEAN_DIVISIONS = new Set([
  "premier_league", "la_liga", "serie_a_ita", "bundesliga", "ligue_1",
  "primeira_liga", "eredivisie", "scottish_prem", "super_lig", "pro_league_bel",
  "russian_prem", "championship", "la_liga_2", "serie_b_ita", "bundesliga_2",
  "ligue_2", "liga_portugal_2", "eerste_divisie", "challenger_pro", "tff_1_lig",
  "russian_first",
])

// RNG deterministico por seed (mantém adversarios estaveis entre re-renders)
function seededRandom(seed: string): () => number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return () => {
    h += 0x6d2b79f5
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Confederacao por divisao (para derivar competicoes continentais quando os
// dados da liga nao as declaram explicitamente)
function getConfederation(division: string): "uefa" | "conmebol" | "afc" | "concacaf" | null {
  const confederation = getDivisionConfederation(division)
  return confederation === "UNAFFILIATED" ? null : confederation.toLowerCase() as "uefa" | "conmebol" | "afc" | "concacaf"
}

// Cria um Competition sintetico (usado nos fallbacks por confederacao)
function makeComp(id: string, name: string, prestige: number, region: string, type: "cup" | "continental"): Competition {
  return { id, name, shortName: name, type, region, format: type === "cup" ? "knockout" : "group_knockout", teams: 32, prize: 0, prestige }
}

// Competicoes continentais por confederacao, da mais para a menos prestigiada
const CONTINENTAL_FALLBACK: Record<string, Competition[]> = {
  uefa: [
    makeComp("champions_league", "UEFA Champions League", 100, "europa", "continental"),
    makeComp("europa_league", "UEFA Europa League", 80, "europa", "continental"),
    makeComp("conference_league", "UEFA Conference League", 65, "europa", "continental"),
  ],
  conmebol: [
    makeComp("libertadores", "CONMEBOL Libertadores", 95, "america_sul", "continental"),
    makeComp("sulamericana", "CONMEBOL Sul-Americana", 70, "america_sul", "continental"),
  ],
  afc: [makeComp("afc_champions", "AFC Champions League Elite", 78, "asia", "continental")],
  concacaf: [makeComp("concacaf_champions", "CONCACAF Champions Cup", 72, "concacaf", "continental")],
}

// Copa nacional por divisao quando a liga nao declara uma copa (principais ligas)
const NATIONAL_CUP_FALLBACK: Record<string, string> = {
  eredivisie: "KNVB Beker",
  scottish_prem: "Scottish Cup",
  super_lig: "Turkiye Kupasi",
  pro_league_bel: "Croky Cup",
  russian_prem: "Copa da Russia",
  liga_argentina: "Copa Argentina",
  primera_a_col: "Copa Colombia",
  primera_div_chi: "Copa Chile",
  primera_div_ury: "Copa Uruguay",
  primera_a_ecu: "Copa Ecuador",
  j_league: "Copa do Imperador",
  k_league_1: "Copa da Coreia",
  chinese_super: "Copa da China",
}

export interface CupCompetitionPlan {
  competition: Competition
  competitionType: "cup" | "continental"
  matchCount: number
  /** Copas regionais: restringe os adversários a estas UFs (ver lib/regional-cups.ts). */
  opponentStates?: readonly string[]
  /**
   * Adversário JÁ DEFINIDO — decisão entre campeões, não sorteio.
   *
   * ⚠️ Só as supercopas usam isto. Numa copa comum o adversário de cada fase sai
   * do sorteio ponderado de `getOpponentPool`, e é assim que tem de ser; aqui o
   * regulamento nomeia os dois finalistas antes de a bola rolar.
   */
  adversarioFixo?: Team
}

// Define se uma divisao e de primeiro nivel (top flight) — so o top flight tem
// vaga continental; copas nacionais valem para 1a e 2a divisao.
const TOP_FLIGHT_DIVISIONS = new Set([
  "serie_a", "premier_league", "la_liga", "serie_a_ita", "bundesliga", "ligue_1",
  "primeira_liga", "eredivisie", "scottish_prem", "super_lig", "pro_league_bel",
  "russian_prem", "saudi_pro", "mls", "liga_mx", "j_league", "k_league_1",
  "chinese_super", "liga_argentina", "primera_a_col", "primera_div_chi", "primera_div_ury", "primera_a_ecu",
])

/** A própria competição declara se é elite por meio das vagas continentais. */
function isTopFlightDivision(division: string): boolean {
  const competitions = competitionsByLeague[division as keyof typeof competitionsByLeague] ?? []
  return TOP_FLIGHT_DIVISIONS.has(division)
    || competitions.some(competition => competition.type === "league" && (competition.continentalSpots?.length ?? 0) > 0)
}

// Determina quais copas/continentais o time do usuario disputa e quantos jogos.
// Usa os dados de competitionsByLeague e, quando faltam, deriva por confederacao.
export function getUserCupPlan(
  userTeam: Team,
  superCups: readonly SuperCupBerth[] = [],
  continentalBerth: "primary" | null = null,
  temporada = 0,
  /** Posição FINAL na liga na temporada ANTERIOR (1 = campeão). Decide a vaga
   *  continental de forma REALISTA — o campeão SEMPRE entra na principal. 0/undefined
   *  = desconhecido, cai no fallback por prestígio. */
  lastLeaguePosition = 0,
  /** Histórico + clube do usuário: quem é o campeão adversário das supercopas. */
  verdade?: VerdadeDoSave,
): CupCompetitionPlan[] {
  const division = String(userTeam.divisao)
  const comps = competitionsByLeague[division as keyof typeof competitionsByLeague] ?? []
  const plans: CupCompetitionPlan[] = []

  // ── Supercopas ─────────────────────────────────────────────────────────
  // Decisões entre campeões da temporada anterior. Vêm primeiro porque são
  // disputadas antes do calendário regular. Só existem quando o clube conquistou
  // a vaga — ver lib/super-cups.ts.
  for (const vaga of superCups) {
    // A REGIAO decide de onde sai o adversario. Todas as supercopas nasciam como
    // "nacional", entao getOpponentPool sorteava um clube do MESMO PAIS: o
    // Mundial de Clubes e a Recopa eram disputados contra times brasileiros.
    // Supercopa do Brasil e nacional de verdade; as outras sao internacionais.
    // Regioes validas em getOpponentPool: "america_sul", "europa" e qualquer
    // outra = pool GLOBAL (que e justamente o certo para o Mundial de Clubes).
    const regiao = vaga.id === "supercopa_brasil" ? "nacional"
      : vaga.id === "recopa_sulamericana" ? "america_sul"
      : vaga.id === "supercopa_uefa" ? "europa"
      : "mundo" // mundial_clubes e copa_intercontinental -> qualquer confederacao
    // ⚠️ O ADVERSÁRIO DE UMA DECISÃO ENTRE CAMPEÕES É O OUTRO CAMPEÃO (1.0.385).
    // Sem isto o `regiao` acima é tudo o que restava, e ele só garante o
    // CONTINENTE do sorteado: a Supercopa da UEFA saía contra qualquer clube
    // europeu. Quando o campeão não puder ser resolvido (save antigo, sem
    // histórico), `adversarioFixo` fica indefinido e o sorteio antigo volta a
    // valer — falhar para o comportamento anterior, nunca para nenhum jogo.
    const campeaoAdversario = vaga.adversarioCampeaoDe
      ? adversarioDaSupercopa(vaga.adversarioCampeaoDe, temporada - 1, verdade)
      : null
    const adversarioFixo = campeaoAdversario
      ? allTeams.find(t => t.curto === campeaoAdversario.clube)
        ?? allPoolTeams.find(t => t.curto === campeaoAdversario.clube)
      : undefined
    plans.push({
      competition: makeComp(vaga.id, vaga.name, 75, regiao, vaga.id === "supercopa_brasil" ? "cup" : "continental"),
      competitionType: "cup",
      matchCount: vaga.matchCount,
      // O clube do usuário nunca pode ser o próprio adversário.
      adversarioFixo: adversarioFixo?.curto === userTeam.curto ? undefined : adversarioFixo,
    })
  }

  // ── Copa regional (Nordeste / Verde) ───────────────────────────────────
  // Elegibilidade pelo ESTADO do clube, como no regulamento da CBF. Estados do
  // eixo Sul/Sudeste (menos ES) não disputam nenhuma — igual à vida real.
  if (isBrazilianDivision(division)) {
    const regional = regionalCupForState(userTeam.estado)
    if (regional) {
      plans.push({
        competition: makeComp(regional.id, regional.name, 55, "nacional", "cup"),
        competitionType: "cup",
        matchCount: regional.matchCount,
        opponentStates: regional.states,
      })
    }
  }

  // ── Copa nacional ──────────────────────────────────────────────────────
  const nationalCups = comps.filter(c => c.type === "cup").sort((a, b) => b.prestige - a.prestige)
  if (nationalCups.length > 0) {
    plans.push({ competition: nationalCups[0], competitionType: "cup", matchCount: 5 })

    // ⚠️ A SEGUNDA COPA NACIONAL ERA DECLARADA E DESCARTADA (corrigido na
    // 1.0.381). `nationalCups` sempre foi um ARRAY ordenado por prestigio, mas
    // so `[0]` virava partida: a Inglaterra tem FA Cup E EFL Cup (Carabao) no
    // dado, e o jogador so disputava a FA Cup. O mesmo valia para qualquer pais
    // com copa da liga.
    //
    // Ela tem MENOS jogos de proposito: a copa da liga entra mais tarde para os
    // clubes grandes e e eliminada mais cedo do calendario real. Cinco partidas
    // nas duas encheria a temporada de mata-mata e roubaria espaco da liga.
    if (nationalCups.length > 1) {
      plans.push({ competition: nationalCups[1], competitionType: "cup", matchCount: 4 })
    }
  } else {
    const profile = getCountryCompetitionProfile(division)
    const cupName = NATIONAL_CUP_FALLBACK[division]
      ?? (profile.country !== "Internacional" && profile.domesticCup !== "Copa Nacional" ? profile.domesticCup : null)
    if (cupName) plans.push({
      competition: makeComp(`${division}_cup`, cupName, 60, "nacional", "cup"),
      competitionType: "cup",
      matchCount: 5,
    })
  }

  // ── Competicao continental (apenas top flight) ─────────────────────────
  let continentals = comps.filter(c => c.type === "continental").sort((a, b) => b.prestige - a.prestige)
  const topFlight = isTopFlightDivision(division)
  if (continentals.length === 0 && topFlight) {
    const conf = getConfederation(division)
    if (conf) continentals = CONTINENTAL_FALLBACK[conf] ?? []
  }
  if (continentals.length > 0 && topFlight) {
    const leagueTeams = [...getUserLeagueTeams(userTeam.curto)].sort((a, b) => b.prestigio - a.prestigio)
    const rank = leagueTeams.findIndex(t => t.curto === userTeam.curto)
    let chosen: Competition | null = null
    // TEMPORADA INICIAL: quem decide e a vida real, nao o ranking de prestigio.
    // As vagas de 2026 ja estavam definidas pelo que aconteceu em 2025 — o
    // Corinthians entrou pela Copa do Brasil, o Flamengo como campeao da
    // Libertadores. Sem isto o jogo mandaria o Corinthians (rank 5 de prestigio)
    // para a Sul-Americana, e o jogador percebe o erro na primeira tela.
    // De 2027 em diante manda o que aconteceu DENTRO do jogo.
    const real = qualificacaoReal2026(userTeam.nome, temporada)
    if (real) {
      const alvo = real.competicao === "libertadores" || real.competicao === "champions_league"
        ? continentals[0]
        : (continentals[1] ?? continentals[0])
      chosen = alvo ?? null
    }
    // Titulo continental na temporada anterior garante a PRINCIPAL (Libertadores/
    // Champions) independentemente da posicao na liga — campeao da Sul-Americana
    // sobe para a Libertadores, campeao da Europa League para a Champions.
    else if (continentalBerth === "primary") chosen = continentals[0]
    // CLASSIFICACAO REAL pela POSICAO FINAL da temporada anterior. O campeao (1o)
    // SEMPRE entra na principal — era o bug do relato ("fui campeao mas nao fui pra
    // Libertadores/Champions"), porque a vaga saia do rank de PRESTIGIO (clube
    // pequeno campeao tinha prestigio baixo e nao classificava). Cortes por
    // confederacao: CONMEBOL top6 Libertadores / 7-12 Sul-Americana; UEFA e demais
    // top4 principal / 5-6 secundaria / 7 terciaria.
    else if (lastLeaguePosition >= 1) {
      const conmebol = getConfederation(division) === "conmebol"
      const tier = conmebol
        ? (lastLeaguePosition <= 6 ? 0 : lastLeaguePosition <= 12 ? 1 : -1)
        : (lastLeaguePosition <= 4 ? 0 : lastLeaguePosition <= 6 ? 1 : lastLeaguePosition <= 7 ? 2 : -1)
      if (tier >= 0) chosen = continentals[Math.min(tier, continentals.length - 1)]
    }
    // Sem posicao conhecida (1a temporada de um save antigo): fallback por prestigio.
    else if (rank >= 0 && rank < 4) chosen = continentals[0]
    else if (rank >= 0 && rank < 10) chosen = continentals[1] ?? continentals[0]
    else if (continentals.length >= 3) chosen = continentals[2]
    // Times de elite (prestigio alto) garantem ao menos a continental secundaria
    if (!chosen && lastLeaguePosition === 0 && userTeam.prestigio >= 75) chosen = continentals[continentals.length - 1]
    if (chosen) {
      const matchCount = chosen.prestige >= 90 ? 8 : 6
      plans.push({ competition: chosen, competitionType: "continental", matchCount })
    }
  }

  // O tamanho de cada campanha vem do REGULAMENTO, nao mais de um numero fixo
  // (5 para copa nacional, 6/8 para continental). E o caminho ate a final: as
  // semanas ficam reservadas mesmo que o clube caia antes.
  return plans.map(plan => ({ ...plan, matchCount: tamanhoDoCaminho(userTeam, plan) }))
}

// Conta deterministicamente quantos jogos de copa/continental o usuario tem na temporada
function getUserCupMatchCount(userTeamShort: string, superCups: readonly SuperCupBerth[] = []): number {
  const userTeam = getTeamByShort(userTeamShort)
  if (!userTeam) return 0
  return getUserCupPlan(userTeam, superCups).reduce((sum, p) => sum + p.matchCount, 0)
}

/** Partidas do caminho COMPLETO (ate a final) — e o que reserva as semanas. */
export function tamanhoDoCaminho(userTeam: Team, plan: CupCompetitionPlan): number {
  const entraTarde = isTopFlightDivision(String(userTeam.divisao))
  return caminhoDaCopa(plan.competition.id, plan.competition.name, plan.competitionType, entraTarde)
    .reduce((soma, etapa) => soma + etapa.jogos, 0)
}

// Monta o pool de adversarios para uma competicao
export function getOpponentPool(userTeam: Team, plan: CupCompetitionPlan): Team[] {
  const userShort = userTeam.curto
  // Copa regional: só clubes das UFs elegíveis. Sem este filtro a Copa do
  // Nordeste sortearia adversário paulista.
  if (plan.opponentStates?.length) {
    const seen = new Set<string>()
    return [...allBrazilianTeams, ...allPoolTeams]
      .filter(t => t.curto !== userShort && t.estado && plan.opponentStates!.includes(t.estado))
      .filter(team => {
        const key = (team.file_key || team.curto).trim().toLocaleLowerCase()
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
      })
  }
  if (plan.competitionType === "cup") {
    // Copa nacional: todas as divisoes do MESMO pais. O código antigo usava somente
    // a liga atual; como os 19 rivais já estavam marcados como usados, o sorteio
    // liberava esses clubes novamente e criava um 3º/4º confronto na temporada.
    const profile = getCountryCompetitionProfile(String(userTeam.divisao))
    const country = normalizeCompetitionClub(profile.country !== "Internacional" ? profile.country : userTeam.pais ?? "")
    const nationalPool = [...allTeams, ...allPoolTeams].filter(t => {
      if (t.curto === userShort || country.length === 0) return false
      const teamCountry = getCountryCompetitionProfile(String(t.divisao)).country
      return normalizeCompetitionClub(teamCountry !== "Internacional" ? teamCountry : t.pais ?? "") === country
    })
    const fallback = isBrazilianDivision(userTeam.divisao)
      ? allBrazilianTeams.filter(t => t.curto !== userShort)
      : getTeamsByDivision(userTeam.divisao).filter(t => t.curto !== userShort)
    const source = nationalPool.length >= 4 ? nationalPool : fallback
    const seen = new Set<string>()
    return source.filter(team => {
      const key = (team.file_key || team.curto).trim().toLocaleLowerCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
  // Continental: times da mesma confederacao
  const confederation = getDivisionConfederation(String(userTeam.divisao))
  const pool = confederation !== "UNAFFILIATED"
    ? allTeams.filter(t => t.curto !== userShort && getDivisionConfederation(String(t.divisao)) === confederation)
    : allTeams.filter(t => t.curto !== userShort)
  // Prioriza times mais fortes (campeonato continental reune a elite)
  return [...pool].sort((a, b) => b.prestigio - a.prestigio).slice(0, 60)
}

// Gera as partidas do usuario em uma copa/continental (somente o time do usuario joga)
interface CupMatchDescriptor {
  competition: string
  competitionId: string
  competitionType: "cup" | "continental"
  homeTeam: Team
  awayTeam: Team
  /** Fase do regulamento — e o que o calendario destaca. */
  stage: FaseCopa
}

/**
 * Partidas do usuario na copa, FASE A FASE e com eliminacao.
 *
 * Devolve uma posicao por partida do caminho maximo (ate a final). `null` marca
 * a partida que NAO acontece porque o clube ja foi eliminado. Devolver o vetor
 * do mesmo tamanho sempre e proposital: as semanas da temporada sao distribuidas
 * a partir dele, e encolher o vetor no meio da campanha deslocaria todas as
 * rodadas de liga seguintes, fazendo o calendario pular partidas ja agendadas.
 * Sem confronto, a semana simplesmente fica livre — o clube esta fora da copa.
 */
export function generateUserCupMatches(
  userTeam: Team,
  plan: CupCompetitionPlan,
  season: number,
  usedOpponents = new Set<string>(),
  resultados: readonly MatchResult[] = [],
): Array<CupMatchDescriptor | null> {
  const pool = getOpponentPool(userTeam, plan)
  if (pool.length === 0) return []

  const entraTarde = isTopFlightDivision(String(userTeam.divisao))
  const etapas = caminhoDaCopa(plan.competition.id, plan.competition.name, plan.competitionType, entraTarde)

  // Placares do usuario NESTA copa, em ordem de disputa.
  const placares: PlacarDaCopa[] = resultados
    .filter(r => r.season === season && r.competition === plan.competition.name
      && (r.homeTeam === userTeam.curto || r.awayTeam === userTeam.curto))
    .sort((a, b) => a.week - b.week)
    // A disputa de pênaltis viaja junto: sem ela o confronto empatado voltaria a
    // ser decidido pela simulação determinística, ignorando a disputa que o
    // técnico acabou de jogar na tela.
    .map(r => r.homeTeam === userTeam.curto
      ? { golsPro: r.homeScore, golsContra: r.awayScore, penaltisPro: r.homePenalties, penaltisContra: r.awayPenalties }
      : { golsPro: r.awayScore, golsContra: r.homeScore, penaltisPro: r.awayPenalties, penaltisContra: r.homePenalties })

  // Adversario fica mais forte a cada fase: quem chega a semifinal nao pega o
  // lanterna da segunda divisao.
  const porForca = [...pool].sort((a, b) => (b.prestigio ?? 0) - (a.prestigio ?? 0))
  const escolher = (indiceDaEtapa: number, quantos: number, semente: string): Team[] => {
    const rng = seededRandom(semente)
    const fatia = Math.max(1, Math.floor(porForca.length / Math.max(1, etapas.length)))
    // Ultimas fases sorteiam do topo da lista; as primeiras, do fundo.
    const restantes = etapas.length - indiceDaEtapa
    const inicio = Math.min(porForca.length - 1, Math.max(0, (restantes - 1) * fatia))
    const janela = porForca.slice(inicio, inicio + Math.max(fatia, quantos * 3))
    const candidatos = (janela.length >= quantos ? janela : porForca)
      .filter(t => !usedOpponents.has(t.curto))
    // ⚠️ FALTAVA UM DEGRAU AQUI. A faixa de forca e escolhida ANTES de filtrar
    // quem ja foi usado; quando a faixa nao tinha ninguem livre, o fallback ia
    // direto para `porForca` — o pool INTEIRO, com os rivais de liga junto.
    //
    // Medido na Copa da Albania: pool de 13 clubes, 9 da propria liga, 4 livres
    // (Teuta, Kukesi, Laci, Burreli). Era preciso 1 rival e o sorteio devolvia um
    // adversario de liga com os 4 livres parados. Em pais pequeno isso e a regra.
    const livresNoPool = porForca.filter(t => !usedOpponents.has(t.curto))
    const base = candidatos.length >= quantos
      ? candidatos
      : (livresNoPool.length >= quantos ? livresNoPool : porForca)
    const saida: Team[] = []
    const vistos = new Set<string>()
    while (saida.length < quantos && vistos.size < base.length) {
      const t = base[Math.floor(rng() * base.length)]
      if (!t || vistos.has(t.curto)) { vistos.add(t?.curto ?? String(vistos.size)); continue }
      vistos.add(t.curto)
      usedOpponents.add(t.curto)
      saida.push(t)
    }
    return saida
  }

  const partidas: Array<CupMatchDescriptor | null> = []
  let consumidos = 0
  let eliminado = false
  // A fase seguinte so aparece depois que a atual termina. Sem isto o calendario
  // ja mostrava a FINAL da Copa do Brasil antes de o clube passar pelas oitavas.
  let aguardando = false

  for (const [indice, etapa] of etapas.entries()) {
    const semente = `${userTeam.curto}:${plan.competition.id}:${season}:${etapa.stage}`

    if (eliminado || aguardando) {
      for (let i = 0; i < etapa.jogos; i++) partidas.push(null)
      continue
    }

    if (etapa.tipo === "grupo") {
      const rivais = escolher(indice, 3, semente)
      if (rivais.length < 3) { for (let i = 0; i < etapa.jogos; i++) partidas.push(null); continue }
      // Turno e returno contra os tres do grupo.
      for (let i = 0; i < etapa.jogos; i++) {
        const rival = rivais[i % rivais.length]
        const emCasa = i < rivais.length
        partidas.push({
          competition: plan.competition.name,
          competitionId: plan.competition.id,
          competitionType: plan.competitionType,
          homeTeam: emCasa ? userTeam : rival,
          awayTeam: emCasa ? rival : userTeam,
          stage: etapa.stage,
        })
      }
      const passou = passouNoGrupo(placares.slice(consumidos, consumidos + etapa.jogos), etapa.jogos, rivais, userTeam.prestigio ?? 60, semente)
      consumidos += etapa.jogos
      if (passou === false) eliminado = true
      else if (passou === null) aguardando = true
      continue
    }

    // ⚠️ DECISÃO ENTRE CAMPEÕES NÃO SORTEIA ADVERSÁRIO. `adversarioFixo` só é
    // preenchido pelas supercopas (ver getUserCupPlan); ausente, o sorteio
    // ponderado de sempre decide.
    const [rival] = plan.adversarioFixo ? [plan.adversarioFixo] : escolher(indice, 1, semente)
    if (!rival) { for (let i = 0; i < etapa.jogos; i++) partidas.push(null); continue }
    // Desviar do sorteio tambem desvia do registro que ele mantem: sem esta
    // linha o campeao adversario da supercopa continuaria "livre" e poderia ser
    // sorteado de novo na copa da mesma temporada, dando tres ou quatro
    // confrontos contra o mesmo clube — que e exatamente o que `usedOpponents`
    // existe para impedir.
    if (plan.adversarioFixo) usedOpponents.add(rival.curto)
    for (let i = 0; i < etapa.jogos; i++) {
      // Ida fora, volta em casa — quem tem melhor campanha decide em casa.
      const emCasa = etapa.jogos === 1 ? (userTeam.prestigio ?? 0) >= (rival.prestigio ?? 0) : i === 1
      partidas.push({
        competition: plan.competition.name,
        competitionId: plan.competition.id,
        competitionType: plan.competitionType,
        homeTeam: emCasa ? userTeam : rival,
        awayTeam: emCasa ? rival : userTeam,
        stage: etapa.stage,
      })
    }
    const passou = passouNoConfronto(placares.slice(consumidos, consumidos + etapa.jogos), etapa.jogos, semente)
    consumidos += etapa.jogos
    if (passou === false) eliminado = true
    else if (passou === null) aguardando = true   // confronto em aberto: para por aqui
  }

  return partidas
}

/**
 * Qual clube leva o atleta que assinou pré-contrato.
 *
 * A primeira versão disto gravava a string literal "outro clube" — e a
 * notificação mais dura do jogo ("você vai perder o cara de graça") não dizia
 * quem levou, que é justamente a informação que dói e que ensina.
 *
 * Quem leva tem de ser PLAUSÍVEL: ninguém perde um atleta de 82 para um clube de
 * prestígio 40, e um reserva de 65 não vai para o Real Madrid. A faixa é
 * ancorada no nível do atleta — um clube um pouco melhor que ele, que é quem de
 * fato assedia. Cai no clube mais forte disponível se a faixa vier vazia.
 */
function clubeQueLevaOAtleta(overall: number, clubeDoUsuario: string): string {
  const candidatos = allTeams.filter(t =>
    t.curto !== clubeDoUsuario &&
    (t.prestigio ?? 0) >= overall - 4 &&
    (t.prestigio ?? 0) <= overall + 14,
  )
  const lista = candidatos.length
    ? candidatos
    : [...allTeams].filter(t => t.curto !== clubeDoUsuario)
        .sort((a, b) => (b.prestigio ?? 0) - (a.prestigio ?? 0))
        .slice(0, 10)
  if (!lista.length) return "outro clube"
  return lista[Math.floor(Math.random() * lista.length)].nome
}

// Decompoe um conjunto de confrontos em rodadas onde todo mundo joga uma vez.
// Backtracking: escolhe o primeiro time sem adversario e testa cada aresta livre.
function dividirEmRodadas(teams: Team[], arestas: Array<[Team, Team]>, roundCount: number): Array<Array<[Team, Team]>> {
  const rounds: Array<Array<[Team, Team]>> = []
  let restantes = arestas
  const chave = (a: Team, b: Team) => [a.curto, b.curto].sort().join(":")

  for (let round = 0; round < roundCount; round++) {
    const disponiveis = restantes
    const buscar = (semAdversario: Team[], escolhidas: Array<[Team, Team]>): Array<[Team, Team]> | null => {
      if (!semAdversario.length) return escolhidas
      const casa = semAdversario[0]
      for (const par of disponiveis) {
        const [a, b] = par
        const ehDele = a.curto === casa.curto || b.curto === casa.curto
        if (!ehDele) continue
        const fora = a.curto === casa.curto ? b : a
        if (!semAdversario.some(t => t.curto === fora.curto)) continue
        if (escolhidas.some(([x, y]) => chave(x, y) === chave(a, b))) continue
        const r = buscar(semAdversario.filter(t => t.curto !== casa.curto && t.curto !== fora.curto), [...escolhidas, par])
        if (r) return r
      }
      return null
    }
    const rodada = buscar(teams, [])
    if (!rodada) return []   // deu no que nao dava: quem chama volta ao sorteio simples
    rounds.push(rodada.map(par => [par[0], par[1]] as [Team, Team]))
    const usadas = new Set(rodada.map(([a, b]) => chave(a, b)))
    restantes = restantes.filter(([a, b]) => !usadas.has(chave(a, b)))
  }
  return equilibrarMando(rounds)
}

/**
 * Distribui o mando de campo. Sem isto o alternar ingenuo por indice de rodada
 * deixava clube com 7 jogos em casa e outro com 1 — o regulamento prevê metade
 * e metade. Passa varias vezes invertendo o confronto sempre que o mandante ja
 * tem mais jogos em casa do que o visitante.
 */
function equilibrarMando(rounds: Array<Array<[Team, Team]>>): Array<Array<[Team, Team]>> {
  const emCasa = new Map<string, number>()
  for (const rodada of rounds) for (const [casa] of rodada) emCasa.set(casa.curto, (emCasa.get(casa.curto) ?? 0) + 1)
  const conta = (t: Team) => emCasa.get(t.curto) ?? 0

  for (let passo = 0; passo < 12; passo++) {
    let mudou = false
    for (const rodada of rounds) {
      for (let i = 0; i < rodada.length; i++) {
        const [casa, fora] = rodada[i]
        if (conta(casa) - conta(fora) < 2) continue
        rodada[i] = [fora, casa]
        emCasa.set(casa.curto, conta(casa) - 1)
        emCasa.set(fora.curto, conta(fora) + 1)
        mudou = true
      }
    }
    if (!mudou) break
  }
  return rounds
}

/**
 * Formato de POTES (Paulistao 2026, inspirado na Champions): 4 potes de 4, cada
 * clube enfrenta os 3 do proprio pote e mais 5 de fora, em turno unico.
 *
 * Os 5 cruzados nao dividem por igual entre os 3 outros potes, entao a distribuicao
 * e 2+2+1, rotacionada para que os dois lados de cada par de potes fechem a conta.
 * Devolve [] se os nomes do regulamento nao casarem com os times em jogo — quem
 * chama entao cai no sorteio simples, que e melhor do que um calendario torto.
 */
function generatePotRounds(
  teams: Team[],
  pots: readonly (readonly string[])[],
  roundCount: number,
): Array<Array<[Team, Team]>> {
  if (pots.length !== 4 || teams.length !== 16) return []
  const doPote = new Map<string, number>()
  for (const [indice, pote] of pots.entries()) {
    for (const nome of pote) {
      const alvo = normalizeCompetitionClub(nome)
      const time = teams.find(t => {
        const n = normalizeCompetitionClub(t.nome)
        return n === alvo || n.includes(alvo) || alvo.includes(n)
      })
      if (!time || doPote.has(time.curto)) return []
      doPote.set(time.curto, indice)
    }
  }
  if (doPote.size !== 16) return []

  const porPote = Array.from({ length: 4 }, (_, p) => teams.filter(t => doPote.get(t.curto) === p))
  if (porPote.some(p => p.length !== 4)) return []

  const arestas: Array<[Team, Team]> = []
  // Dentro do pote: todos contra todos (3 jogos para cada um).
  for (const pote of porPote) {
    for (let i = 0; i < pote.length; i++) for (let j = i + 1; j < pote.length; j++) arestas.push([pote[i], pote[j]])
  }
  // Entre potes: 2 jogos nos pares "fortes" e 1 no par restante, somando 5 por clube.
  const doisJogos: Array<[number, number]> = [[0, 1], [0, 2], [1, 3], [2, 3]]
  const umJogo: Array<[number, number]> = [[0, 3], [1, 2]]
  for (const [p, q] of doisJogos) {
    for (let i = 0; i < 4; i++) for (const desloc of [0, 1]) arestas.push([porPote[p][i], porPote[q][(i + desloc) % 4]])
  }
  for (const [p, q] of umJogo) {
    for (let i = 0; i < 4; i++) arestas.push([porPote[p][i], porPote[q][i]])
  }

  return dividirEmRodadas(teams, arestas, roundCount)
}

// Gera fixtures do campeonato estadual (Jan-Mar)
function generateCrossGroupRounds(teams: Team[], groupCount: number, roundCount: number): Array<Array<[Team, Team]>> {
  if (groupCount < 2 || teams.length % groupCount !== 0) return []
  // Distribuição determinística em potes: evita que a composição mude ao recarregar.
  const groups = Array.from({ length: groupCount }, () => [] as Team[])
  teams.forEach((team, index) => groups[index % groupCount].push(team))
  const groupOf = new Map(groups.flatMap((group, groupIndex) => group.map(team => [team.curto, groupIndex] as const)))
  let remaining = teams.flatMap((home, i) => teams.slice(i + 1)
    .filter(away => groupOf.get(home.curto) !== groupOf.get(away.curto))
    .map(away => [home, away] as [Team, Team]))
  const rounds: Array<Array<[Team, Team]>> = []

  const findPerfectRound = (available: Array<[Team, Team]>): Array<[Team, Team]> | null => {
    const search = (unmatched: Team[], chosen: Array<[Team, Team]>): Array<[Team, Team]> | null => {
      if (!unmatched.length) return chosen
      const home = unmatched[0]
      const opponents = available.filter(([a, b]) => (a.curto === home.curto && unmatched.some(t => t.curto === b.curto)) || (b.curto === home.curto && unmatched.some(t => t.curto === a.curto)))
      for (const edge of opponents) {
        const away = edge[0].curto === home.curto ? edge[1] : edge[0]
        const result = search(unmatched.filter(team => team.curto !== home.curto && team.curto !== away.curto), [...chosen, [home, away]])
        if (result) return result
      }
      return null
    }
    return search(teams, [])
  }

  for (let round = 0; round < roundCount; round++) {
    const matches = findPerfectRound(remaining)
    if (!matches) return []
    rounds.push(matches.map(([home, away], index) => (round + index) % 2 ? [away, home] : [home, away]))
    const used = new Set(matches.map(([a, b]) => [a.curto, b.curto].sort().join(":")))
    remaining = remaining.filter(([a, b]) => !used.has([a.curto, b.curto].sort().join(":")))
  }
  return rounds
}

/**
 * A BILHETERIA DE UM JOGO COM MANDO — a conta ÚNICA do jogo.
 *
 * ⚠️ O QUE ISTO CORRIGE: a renda só entrava no caixa quando o técnico disputava
 * a partida na tela. Jogo em casa resolvido pelo avanço da semana (partida
 * atrasada, temporada simulada, técnico que só clica "avançar") rendia
 * **zero** — e o clube ainda pagava a folha da semana. Quem simulava a
 * temporada via o caixa afundar sem entender por quê, e a projeção de
 * /financas, que estima pela CONTAGEM de jogos em casa, prometia um dinheiro
 * que nunca chegava.
 *
 * REGRA DE MANDO, explícita porque é a pergunta que sempre volta: a renda é
 * INTEIRA do mandante. O visitante não leva percentual nenhum — é assim no
 * Brasileirão e na Copa do Brasil desde que o mando passou a ser do clube da
 * casa. Por isso a função só é chamada quando o clube do técnico joga em casa,
 * e jogo fora credita rigorosamente nada.
 *
 * O setorizado manda quando existe (camarote/cadeira/arquibancada com preços
 * próprios); sem ele, o preço único de sempre. Nos dois caminhos a OCUPAÇÃO
 * sai do mesmo `calcMatchdayRevenue`, então público e renda continuam
 * reagindo a prestígio, torcida, títulos e resultado.
 */
function bilheteriaDoMando(params: {
  time: Team
  infraestruturaDoEstadio: number
  torcida: number
  titulos: number
  resultado: "win" | "draw" | "loss"
  ehLiga: boolean
  tier: TicketTier
  // Vem do save (`GameState.estadioSetores`), que declara o formato inline —
  // não há tipo exportado para referenciar, e copiá-lo à mão criaria uma
  // segunda definição para divergir no primeiro ajuste de setor.
  setores: NonNullable<GameState["estadioSetores"]> | null | undefined
}): { renda: number; matchday: MatchdayRevenue } {
  const matchday = calcMatchdayRevenue({
    capacity: stadiumCapacity(params.time.estadio_cap ?? 30000, params.infraestruturaDoEstadio),
    prestige: params.time.prestigio,
    fanBase: params.torcida,
    ticketTier: params.tier,
    titles: params.titulos,
    result: params.resultado,
    // Copa e continental enchem mais e valem ingresso mais caro que rodada de liga.
    competitionWeight: params.ehLiga ? 1 : 1.12,
  })
  const setorizada = params.setores
    ? calcularRenda({
        capacidades: params.setores.capacidades,
        precos: params.setores.usarSugeridos ? precosSugeridos(params.time.prestigio) : params.setores.precos,
        prestigio: params.time.prestigio,
        atracao: matchday.occupancy,
      })
    : null
  return { renda: setorizada ? setorizada.renda : matchday.revenue, matchday }
}

export function generateStateChampionshipFixtures(
  stateTeams: Team[],
  userTeamShort: string,
  competition: string,
  knownResults: MatchResult[] = [],
  season = 2026,
): Fixture[] {
  const fixtures: Fixture[] = []
  let fixtureId = 10000
  const officialRounds = getStateCompetitionRule(userTeamShort)?.firstPhaseRounds
  // Nunca solicita mais rodadas do que um ciclo round-robin comporta. Quando a
  // base antiga tem menos participantes do que o regulamento, repetir o array de
  // confrontos seria pior do que encerrar a fase disponível sem duplicatas.
  const roundRobinRounds = getRoundRobinHalfRounds(stateTeams.length)
  const halfSeason = officialRounds ? Math.min(officialRounds, roundRobinRounds) : roundRobinRounds
  const isDouble = officialRounds ? false : stateChampIsDoubleRound(stateTeams.length)
  const totalRounds = isDouble ? halfSeason * 2 : halfSeason

  const regulation = getStateCompetitionRule(userTeamShort)
  // Formato de GRUPOS/POTES exige clubes suficientes. O Amazonense preve 2 grupos
  // mas o AM tem 5 clubes na base: dividir 5 em 2 grupos gerava pareamento
  // invalido e o clube chegava a enfrentar A SI MESMO. Sem gente para o formato
  // oficial, cai no returno simples — melhor um formato mais simples do que uma
  // tabela quebrada.
  const grupos = regulation?.groups ?? 0
  const cabeNosGrupos = grupos > 0 && stateTeams.length >= grupos * 3
  const cabemOsPotes = Boolean(regulation?.pots) && stateTeams.length >= (regulation?.pots?.length ?? 0) * 2
  const crossGroupRounds = cabemOsPotes && regulation?.pots
    ? generatePotRounds(stateTeams, regulation.pots, halfSeason)
    : cabeNosGrupos ? generateCrossGroupRounds(stateTeams, grupos, halfSeason) : []
  for (let round = 1; round <= halfSeason; round++) {
    const matchups = crossGroupRounds[round - 1] ?? generateRoundMatchups(stateTeams, round)
    matchups.forEach(([home, away]) => {
      // Blindagem final: nenhum confronto pode ter o mesmo clube dos dois lados.
      if (!home || !away || home.curto === away.curto) return
      fixtures.push({
        id: fixtureId++,
        round,
        week: round,
        homeTeam: home,
        awayTeam: away,
        competition,
        played: false,
        isUserMatch: home.curto === userTeamShort || away.curto === userTeamShort,
        month: getRoundMonth(round, 0, 3, totalRounds),
        competitionType: "state",
        stage: "fase_classificatoria",
      })
    })
  }

  // Returno so existe em campos pequenos (ida e volta). Campos grandes (ex: SP com
  // 13 clubes) rodam turno unico para o estadual nao virar 24+ rodadas.
  if (isDouble) {
    for (let round = halfSeason + 1; round <= totalRounds; round++) {
      const turnoRound = round - halfSeason
      const turnoFixtures = fixtures.filter(f => f.round === turnoRound)
      turnoFixtures.forEach(f => {
        fixtures.push({
          id: fixtureId++,
          round,
          week: round,
          homeTeam: f.awayTeam,
          awayTeam: f.homeTeam,
          competition,
          played: false,
          isUserMatch: f.awayTeam.curto === userTeamShort || f.homeTeam.curto === userTeamShort,
          month: getRoundMonth(round, 0, 3, totalRounds),
          competitionType: "state",
          stage: "fase_classificatoria",
        })
      })
    }
  }

  // As versões anteriores terminavam o estadual na fase classificatória. A liga
  // nacional era liberada sem quartas/semifinais/final e, portanto, nunca existia
  // campeão estadual no calendário oficial da carreira. A partir daqui as fases
  // finais são parte do mesmo calendário e usam os resultados já persistidos para
  // recalcular classificados e vencedores sem um segundo estado paralelo.
  const rule = getStateCompetitionRule(userTeamShort)
  if (!rule?.knockout?.length) return fixtures

  const teamByShort = new Map(stateTeams.map(team => [team.curto, team]))
  const prestige = (short: string) => teamByShort.get(short)?.prestigio ?? 0
  const hydratedRegular = reconcilePlayedFixtures(fixtures, knownResults, season)
  const rowByShort = new Map(computeStandingsFromFixtures(hydratedRegular, competition).map(row => [row.teamShort, row]))
  const compareShort = (a: string, b: string) => {
    const x = rowByShort.get(a)
    const y = rowByShort.get(b)
    if (x && y) {
      const diff = y.points - x.points ||
        (y.goalsFor - y.goalsAgainst) - (x.goalsFor - x.goalsAgainst) ||
        y.goalsFor - x.goalsFor
      if (diff) return diff
    }
    return prestige(b) - prestige(a) || a.localeCompare(b)
  }

  const groupIndex = new Map(stateTeams.map((team, index) => [team.curto, rule.groups ? index % rule.groups : 0]))
  const qualify = (count: number): string[] => {
    if (!rule.groups) return stateTeams.map(team => team.curto).sort(compareShort).slice(0, count)
    const groups = Array.from({ length: rule.groups }, (_, index) =>
      stateTeams.filter(team => groupIndex.get(team.curto) === index).map(team => team.curto).sort(compareShort),
    )
    if (rule.groups === 3 && count === 4) {
      const leaders = groups.map(group => group[0]).filter(Boolean)
      const bestRunnerUp = groups.flatMap(group => group.slice(1)).sort(compareShort)[0]
      return [...leaders, ...(bestRunnerUp ? [bestRunnerUp] : [])].sort(compareShort)
    }
    const perGroup = Math.max(1, Math.floor(count / rule.groups))
    return groups.flatMap(group => group.slice(0, perGroup)).sort(compareShort).slice(0, count)
  }

  let nextWeek = totalRounds + 1
  const addPairStage = (stage: string, entrants: string[], legs: number): Fixture[] => {
    const created: Fixture[] = []
    const pairs: Array<[string, string]> = []
    // Math.FLOOR e o par (a, b) tem de ser distinto. Com numero IMPAR de
    // classificados (estadual pequeno, ex.: Amazonense com 5 clubes na base),
    // `i < length/2` chegava ao meio e casava entrants[2] com entrants[2] — o
    // clube enfrentava A SI MESMO. O do meio agora passa direto (bye).
    for (let i = 0; i < Math.floor(entrants.length / 2); i++) {
      const casa = entrants[i], fora = entrants[entrants.length - 1 - i]
      if (casa && fora && casa !== fora) pairs.push([casa, fora])
    }
    for (let leg = 0; leg < legs; leg++) {
      for (const [seededHome, seededAway] of pairs) {
        const first = teamByShort.get(leg % 2 === 0 ? seededHome : seededAway)
        const second = teamByShort.get(leg % 2 === 0 ? seededAway : seededHome)
        if (!first || !second) continue
        created.push({
          id: fixtureId++, round: nextWeek, week: nextWeek,
          homeTeam: first, awayTeam: second, competition,
          played: false,
          isUserMatch: first.curto === userTeamShort || second.curto === userTeamShort,
          month: Math.min(4, Math.floor((nextWeek - 1) / 4)),
          competitionType: "state", stage,
        })
      }
      nextWeek++
    }
    fixtures.push(...created)
    return created
  }

  const winners = (entrants: string[], stageFixtures: Fixture[], stage: string): string[] => {
    const hydrated = reconcilePlayedFixtures(stageFixtures, knownResults, season)
    const output: string[] = []
    for (let i = 0; i < entrants.length / 2; i++) {
      const a = entrants[i]
      const b = entrants[entrants.length - 1 - i]
      let goalsA = 0
      let goalsB = 0
      let complete = false
      // Pênaltis da disputa jogada na tela, quando um dos dois é o clube do usuário.
      let penA: number | undefined
      let penB: number | undefined
      for (const match of hydrated.filter(item =>
        (item.homeTeam.curto === a && item.awayTeam.curto === b) ||
        (item.homeTeam.curto === b && item.awayTeam.curto === a),
      )) {
        if (!match.played || match.homeScore === undefined || match.awayScore === undefined) continue
        complete = true
        const resultado = knownResults.find(r =>
          r.season === season && r.week === match.week &&
          ((r.homeTeam === match.homeTeam.curto && r.awayTeam === match.awayTeam.curto) ||
           (r.homeTeam === match.awayTeam.curto && r.awayTeam === match.homeTeam.curto)),
        )
        if (match.homeTeam.curto === a) {
          goalsA += match.homeScore; goalsB += match.awayScore
          if (resultado?.homePenalties != null) {
            const invertido = resultado.homeTeam !== a
            penA = invertido ? resultado.awayPenalties : resultado.homePenalties
            penB = invertido ? resultado.homePenalties : resultado.awayPenalties
          }
        } else {
          goalsA += match.awayScore; goalsB += match.homeScore
          if (resultado?.homePenalties != null) {
            const invertido = resultado.homeTeam !== a
            penA = invertido ? resultado.awayPenalties : resultado.homePenalties
            penB = invertido ? resultado.homePenalties : resultado.awayPenalties
          }
        }
      }
      if (!complete) { output.push([a, b].sort(compareShort)[0]); continue }
      if (goalsA !== goalsB) { output.push(goalsA > goalsB ? a : b); continue }
      // EMPATE NO AGREGADO -> PÊNALTIS.
      //
      // Antes: `[a, b].sort(compareShort)[0]` — passava quem tinha melhor campanha
      // (pontos, saldo, prestígio). Determinístico e permanentemente injusto: no
      // Paulistão, Carioca, Gaúcho e todos os outros estaduais o azarão NUNCA
      // eliminava o favorito num empate, porque não havia disputa nenhuma.
      if (penA != null && penB != null && penA !== penB) { output.push(penA > penB ? a : b); continue }
      const [pa, pb] = disputaDeterministica(
        `${competition}:${season}:${stage}:${[a, b].sort().join("x")}`,
        teamByShort.get(a)?.prestigio ?? 70,
        teamByShort.get(b)?.prestigio ?? 70,
      )
      output.push(pa > pb ? a : b)
    }
    return output.sort(compareShort)
  }

  let entrants: string[] = []
  for (const stage of rule.knockout) {
    if (stage === "segunda_fase") {
      entrants = qualify(8)
      const groups = [
        [entrants[0], entrants[2], entrants[5], entrants[7]],
        [entrants[1], entrants[3], entrants[4], entrants[6]],
      ].map(group => group.filter(Boolean))
      const secondPhaseFixtures: Fixture[] = []
      for (let round = 1; round <= 6; round++) {
        for (const group of groups) {
          const teams = group.map(short => teamByShort.get(short)).filter((team): team is Team => Boolean(team))
          for (const [home, away] of generateRoundMatchups(teams, round)) {
            secondPhaseFixtures.push({
              id: fixtureId++, round: nextWeek, week: nextWeek, homeTeam: home, awayTeam: away,
              competition, played: false,
              isUserMatch: home.curto === userTeamShort || away.curto === userTeamShort,
              month: Math.min(4, Math.floor((nextWeek - 1) / 4)), competitionType: "state", stage,
            })
          }
        }
        nextWeek++
      }
      fixtures.push(...secondPhaseFixtures)
      // Idem: não interrompe mais a geração; os classificados saem das mini-tabelas
      // (provisórias até os jogos acontecerem) e se firmam a cada rebuild.
      const hydrated = reconcilePlayedFixtures(secondPhaseFixtures, knownResults, season)
      entrants = groups.flatMap(group => {
        const mini0 = computeStandingsFromFixtures(hydrated, competition)
          .filter(row => group.includes(row.teamShort))
          // ⚠️ TERCEIRA COPIA DA REGRA DE DESEMPATE (ver `lib/desempate.ts`), e a
          // que mais pesa: esta mini-tabela decide QUEM AVANCA do grupo. Num
          // estadual brasileiro o criterio depois dos pontos e o numero de
          // VITORIAS, e ordenar por saldo mandava o clube errado as quartas.
        const ordenadas = ordenarPorCriterios(
          mini0.map(row => ({ linha: row, points: row.points, won: row.won, goalsFor: row.goalsFor, goalsAgainst: row.goalsAgainst, nome: row.teamShort })),
          // Esta funcao gera ESTADUAL BRASILEIRO e so ele, entao o criterio e o da
          // CBF sem consulta: pontos, vitorias, saldo, gols pro.
          DESEMPATE_CBF,
        ).map(x => x.linha)
        return (ordenadas.length ? ordenadas.map(row => row.teamShort) : group.sort(compareShort)).slice(0, 2)
      }).sort(compareShort)
      continue
    }

    const required = stage === "quartas" ? 8 : stage === "semifinal" ? 4 : 2
    if (!entrants.length || entrants.length !== required) entrants = qualify(required)
    const legs = rule.stageRounds?.[stage] ?? rule.knockoutLegs?.[stage] ?? (stage === "final" ? rule.finalLegs : 1) ?? 1
    const stageFixtures = addPairStage(stage, entrants, legs)
    // GERA O BRACKET COMPLETO (relato "estadual travou nas oitavas e a temporada
    // não saiu disso"): antes um `break` parava de gerar as fases seguintes
    // enquanto a atual não estivesse 100% decidida — se qualquer confronto (mesmo
    // CPU) não fechasse, semifinal/final NUNCA eram criadas e o estadual ficava
    // preso. Agora todas as fases entram no calendário; os participantes vêm de
    // `winners()` (provisórios enquanto o confronto não acontece) e se atualizam a
    // cada rebuild conforme os jogos são disputados. A EstadualView mostra sempre a
    // fase ATUAL (1ª não jogada), então o "finalista provisório" não fica à vista.
    entrants = winners(entrants, stageFixtures, stage)
  }

  return fixtures
}

// divisionOverride: divisao ATUAL do usuario apos acesso/rebaixamento (do save). Quando
// presente, os adversarios da liga vem dela — e nao da divisao estatica do time.
// Exportada para a auditoria da virada de temporada
// (scripts/qa-virada-de-temporada.ts) poder chamar a funcao DE VERDADE. Uma
// copia no script testaria a copia — e o numero que esta funcao devolve e
// exatamente o que decide se a temporada acaba.
export function getUserLeagueTeams(teamShort: string, divisionOverride?: string, teamFileKey?: string): Team[] {
  const userTeam = (teamFileKey ? getTeamByFileKey(teamFileKey) : undefined) ?? getTeamByShort(teamShort)
  if (!userTeam) return []
  const division = divisionOverride ?? String(effectiveDivision(userTeam))
  // LIGA CURTA: onze divisoes tinham menos de oito clubes curados (sete tinham UM
  // so). Devolver a divisao como estava gerava ZERO confrontos — o calendario
  // ficava sem liga nenhuma. `completarLigaComPool` traz adversarios do MESMO
  // PAIS a partir do pool importado; so quando nem isso basta e que recorre a
  // vizinhos da confederacao. Quando a divisao ja tem gente, devolve intacta.
  const divisionTeams = completarLigaComPool(division)
  // Guarda: divisao sem times (nunca deveria) -> cai na estatica para nao quebrar a liga.
  if (divisionTeams.length < 4) return getTeamsByDivision(userTeam.divisao)
  // Garante que o time do usuario esta na lista (ele sobe/cai levando o proprio clube).
  //
  // ⚠️ O caminho antigo montava `[userTeam, ...slice(0, ceil(rodadas/2) - 1)]`,
  // que com 38 rodadas declaradas da 19 clubes — IMPAR. Liga impar nao fecha
  // turno-returno e a temporada nunca termina (ver resolveLeagueTeams). Agora o
  // clube do usuario ENTRA no lugar do mais fraco e o TAMANHO nao muda: a lista
  // que sai daqui vale exatamente o que o regulamento da divisao manda.
  const hasUser = divisionTeams.some(t => t.file_key === userTeam.file_key)
  if (!hasUser) {
    const semOMaisFraco = [...divisionTeams]
      .sort((a, b) => (b.prestigio ?? 0) - (a.prestigio ?? 0))
      .slice(0, Math.max(3, divisionTeams.length - 1))
    return [userTeam, ...semOMaisFraco]
  }
  return divisionTeams
}

/**
 * A liga do usuario NA TEMPORADA EM CURSO — preferindo a composicao congelada.
 *
 * `getUserLeagueTeams` monta a divisao a partir dos DADOS DO JOGO (clubes
 * curados + pool). Isso significa que ela muda quando o jogo e ATUALIZADO: uma
 * versao que traga clubes novos para a Serie D reescreve a liga no meio da
 * carreira. Quando isso acontece, `expectedLeagueFixtures` — que e
 * `(times - 1) * 2` recalculado TODA semana — passa a exigir mais partidas do
 * que a temporada chegou a gerar, `leagueComplete` fica falso para sempre e a
 * temporada NUNCA vira. Sem virada nao ha acesso nem rebaixamento: o jogador
 * avanca semanas dentro do mesmo ano ate desistir.
 *
 * Caso real (06/08/2026): carreira na Portuguesa comecou com uma Serie D de 19
 * clubes, jogou 40 partidas — e a mesma divisao ja valia 27 clubes, exigindo 52.
 * A temporada estava travada havia semanas com o clube em 2o lugar.
 *
 * Por isso a composicao e congelada no save (`leagueTeams`) e so recalculada na
 * virada. A lista congelada e aceita mesmo se algum clube tiver sumido dos
 * dados: o calendario e a exigencia saem os DOIS dela, entao continuam
 * coerentes entre si — que e a unica coisa que a virada precisa.
 */
export function resolveLeagueTeams(
  teamShort: string,
  divisionOverride: string | undefined,
  congelada: readonly string[] | undefined,
): Team[] {
  if (congelada && congelada.length >= MIN_TIMES_PARA_LIGA) {
    const times = congelada
      .map(curto => getTeamByShort(curto))
      .filter((time): time is Team => Boolean(time))
    if (times.length >= MIN_TIMES_PARA_LIGA && times.some(time => time.curto === teamShort)) {
      return times
    }
  }
  return getUserLeagueTeams(teamShort, divisionOverride)
}

export function getLeagueName(teamShort: string, divisionOverride?: string): string {
  const userTeam = getTeamByShort(teamShort)
  if (!userTeam) return "Liga"
  // `effectiveDivision`, e NAO `userTeam.divisao`.
  //
  // O calendario e as ligas sao montados por getTeamsByDivision, que resolve a
  // divisao EFETIVA (piramide do save > tabela de 2026 > estatica). Aqui lia-se
  // a estatica: quando as duas discordam — e desde a correcao das divisoes de
  // 2026 elas discordam para varios clubes — o nome da liga nao batia com o das
  // partidas, `computeStandingsFromFixtures` devolvia tabela VAZIA e a posicao
  // final do usuario virava 0. Sem posicao nao ha acesso nem rebaixamento, e
  // nenhuma mensagem aparece: era o relato "terminei em 3o na Serie D e
  // continuei na Serie D, sem aviso nenhum".
  const division = String(divisionOverride ?? effectiveDivision(userTeam))
  return LEAGUE_NAMES[division] ?? leagueNameForDivision(division)
}

export function getDivisionLeagueTeams(teamShort: string): Team[] {
  return getUserLeagueTeams(teamShort)
}

export interface Fixture {
  id: number
  round: number
  week: number
  homeTeam: Team
  awayTeam: Team
  competition: string
  /** Identificador estável usado no sorteio e no desempate determinístico. */
  competitionId?: string
  played: boolean
  homeScore?: number
  awayScore?: number
  isUserMatch: boolean
  month: number
  /**
   * `friendly` é o amistoso marcado pelo técnico. Ele é jogável e aparece no
   * calendário como qualquer outro jogo, mas NÃO conta para o fim da temporada
   * nem é simulado como partida atrasada. Ver lib/amistosos-calendario.ts.
   */
  competitionType: "state" | "league" | "cup" | "continental" | "fifa_break" | "friendly"
  /**
   * Só em `fifa_break`: esta pausa é a do MUNDIAL (junho de ano de Copa), não uma
   * data FIFA comum. Antes isso era deduzido comparando `competition` com o texto
   * "Copa do Mundo FIFA" — o rótulo de EXIBIÇÃO. Qualquer mudança nesse texto
   * derrubava silenciosamente a Central do Mundial e a pausa virava uma data FIFA
   * qualquer, que o botão do escritório atravessa direto até o próximo jogo do
   * clube. A flag é o dado; o rótulo segue sendo só rótulo.
   */
  worldCup?: boolean
  stage?: string
  /**
   * Dia do mês em que a partida aparece no calendário. Os jogos oficiais não
   * têm data real — o dia sai da tabela por rodada (`roundToDay`) — mas o
   * AMISTOSO tem semana escolhida pelo técnico e por isso traz o dia calculado.
   */
  dayOfMonth?: number
  /**
   * Jogo de MEIO DE SEMANA: divide a semana com a rodada de liga, como no
   * futebol de verdade. Sem isto cada partida de copa consumia uma semana
   * inteira e a temporada 2026 do Flamengo terminava em maio de 2027.
   */
  midweek?: boolean
}

export interface SeasonCalendar {
  fixtures: Fixture[]
  currentRound: number
  nextUserMatch: Fixture | null
  previousUserMatch: Fixture | null
}

/** Chave persistente e determinística de uma partida. O ID sozinho não basta,
 * pois estadual, liga e copa usam faixas próprias que podem mudar em saves antigos. */
export function getCalendarFixtureKey(fixture: Fixture, season: number): string {
  return [
    season,
    fixture.competitionType,
    fixture.competition,
    fixture.week,
    fixture.id,
    fixture.homeTeam.curto,
    fixture.awayTeam.curto,
  ].join("::")
}

/** Aplica resultados ao calendário em relação 1:1. O `find` antigo reutilizava o
 * mesmo placar em toda fixture com os mesmos clubes/competição. */
export function reconcilePlayedFixtures(
  fixtures: Fixture[],
  results: MatchResult[],
  season: number,
  completedFixtureKeys: readonly string[] = [],
): Fixture[] {
  const completed = new Set(completedFixtureKeys)
  const seasonResults = results.filter(result => result.season === season)
  const consumedResults = new Set<number>()

  /**
   * ⚠️ A CHAVE EXATA NAO SOBREVIVE A UM CALENDARIO REGENERADO (1.0.341).
   *
   * `completedFixtureKeys` guarda temporada::tipo::competicao::SEMANA::ID::casa::fora.
   * Semana e ID mudam sempre que o calendario e remontado com outro regulamento,
   * outra migracao ou outra ordem — e ai a chave salva nao casa com nenhuma
   * fixture, a partida disputada volta como POR DISPUTAR, e o jogador ve o
   * escritorio "como se nao tivesse sido simulada".
   *
   * Os RESULTADOS ja tinham esse cuidado logo abaixo (o pareamento por clubes +
   * competicao); as chaves, nao. Aqui elas ganham a mesma rede, com a mesma
   * identidade que o projeto ja considera segura: direcional (casa x fora) e
   * dentro da mesma competicao, entao ida e volta continuam sendo duas partidas
   * distintas e confronto alheio nunca e marcado.
   */
  const identidadeFrouxa = (competitionType: string, competition: string, casa: string, fora: string) =>
    [competitionType, competition, casa, fora].join("::")
  //
  // ⚠️ CONTA, NAO MARCA PRESENCA. Isto era um `Set`, e o defeito aparecia no
  // ESTADUAL: la o mesmo confronto ocorre legitimamente em duas fases (a
  // classificatoria e o mata-mata), e a identidade frouxa nao carrega a fase.
  // Concluir Flamengo x Vasco na classificatoria marcava TAMBEM o Flamengo x
  // Vasco das quartas — uma partida que o jogador nunca disputou sumia do
  // calendario, com placar inventado. Depois de 4 jogos concluidos o calendario
  // ja dizia 5.
  //
  // Contando quantas conclusoes existem para cada confronto, no maximo esse
  // tanto de partidas e marcado. A rede da 1.0.341 continua inteira: calendario
  // regenerado ainda casa pela identidade frouxa.
  //
  // ⚠️ A REDE FROUXA SO VALE PARA CHAVE ORFA. Foi criada para o calendario
  // REGENERADO, onde a chave salva nao casa com fixture nenhuma. Se a chave
  // ainda casa com uma partida que existe, usa-la de forma frouxa noutra e
  // duplicar: foi assim que a semifinal FLA x VAS era marcada junto com a
  // classificatoria FLA x VAS, e uma partida sumia do estadual.
  const chavesDoCalendario = new Set(fixtures.map(f => getCalendarFixtureKey(f, season)))
  const restantesPorConfronto = new Map<string, number>()
  for (const chave of completedFixtureKeys) {
    const partes = chave.split("::")
    if (partes.length < 7) continue
    const [temporadaDaChave, tipo, competicao] = partes
    if (Number(temporadaDaChave) !== season) continue
    // Chave que ainda encontra a propria partida nao precisa da rede.
    if (chavesDoCalendario.has(chave)) continue
    const id = identidadeFrouxa(tipo, competicao, partes[5], partes[6])
    restantesPorConfronto.set(id, (restantesPorConfronto.get(id) ?? 0) + 1)
  }

  return fixtures.map(fixture => {
    const key = getCalendarFixtureKey(fixture, season)
    let resultIndex = seasonResults.findIndex((result, index) =>
      !consumedResults.has(index) && result.fixtureKey === key,
    )

    // Compatibilidade com saves antigos e também com calendários regenerados por
    // uma correção de regulamento. Nesses casos o resultado pode ter fixtureKey,
    // porém a chave contém semana/ID do calendário anterior. O pareamento continua
    // seguro porque é direcional, inclui competição e consome cada resultado uma vez.
    if (resultIndex < 0) {
      const compatible = (result: MatchResult, index: number) =>
        !consumedResults.has(index) &&
        // Resultado cuja chave ainda aponta para uma partida existente pertence
        // AQUELA partida — nao a esta. Sem esta linha, a semifinal roubava o
        // resultado da classificatoria do mesmo confronto.
        (!result.fixtureKey || !chavesDoCalendario.has(result.fixtureKey)) &&
        result.homeTeam === fixture.homeTeam.curto &&
        result.awayTeam === fixture.awayTeam.curto &&
        result.competition === fixture.competition
      resultIndex = seasonResults.findIndex((result, index) => compatible(result, index) && result.week === fixture.week)
      if (resultIndex < 0) resultIndex = seasonResults.findIndex(compatible)
    }

    if (resultIndex >= 0) consumedResults.add(resultIndex)
    const result = resultIndex >= 0 ? seasonResults[resultIndex] : undefined
    // A chave exata nao consome cota: ela ja identifica UMA partida.
    const idDoConfronto = identidadeFrouxa(
      fixture.competitionType, fixture.competition, fixture.homeTeam.curto, fixture.awayTeam.curto,
    )
    let concluidaPorConfronto = false
    if (!completed.has(key) && !result) {
      const restantes = restantesPorConfronto.get(idDoConfronto) ?? 0
      if (restantes > 0) {
        concluidaPorConfronto = true
        restantesPorConfronto.set(idDoConfronto, restantes - 1)
      }
    }
    if (!completed.has(key) && !concluidaPorConfronto && !result) return fixture
    return {
      ...fixture,
      played: true,
      homeScore: result?.homeScore ?? fixture.homeScore,
      awayScore: result?.awayScore ?? fixture.awayScore,
    }
  })
}

// Gera confrontos da liga (todos contra todos, turno e returno) — dinamico por qtd de times
// weekOffset: deslocamento de semanas para colocar a liga apos o estadual (para times brasileiros)
export function generateBrasileirao(
  teams: Team[],
  userTeamShort: string,
  competition: string,
  division: string,
  weekOffset = 0,
  knownResults: MatchResult[] = [],
  season = 2026,
): Fixture[] {
  // O Brasil já possui calendário e regressões próprios. A internacionalização
  // não altera a ordem histórica dos seus confrontos nem os saves existentes.
  if (isBrazilianDivision(division)) {
    const fixtures: Fixture[] = []
    let fixtureId = 1
    // ⚠️ COM NUMERO IMPAR DE CLUBES SAO N RODADAS POR TURNO, NAO N-1.
    //
    // `generateRoundMatchups` completa o par com um time FANTASMA quando a
    // divisao e impar (27 clubes -> 28 posicoes), e o metodo do circulo precisa
    // de posicoes-1 = 27 rodadas. Fixado em `teams.length - 1` = 26, faltava
    // UMA RODADA INTEIRA por turno.
    //
    // Medido na Serie D (27 clubes): 676 partidas em vez de 702, com 26 clubes
    // jogando 50 e um jogando 52 — porque o time FIXO do circulo e o primeiro do
    // array e o fantasma so cai sobre ele na 27a rodada, a que nao era gerada.
    // Um clube fazia a temporada inteira SEM FOLGA e com dois jogos a mais, numa
    // tabela que decide acesso.
    const halfSeason = teams.length % 2 === 0 ? teams.length - 1 : teams.length
    const totalRounds = halfSeason * 2
    const calCfg = leagueCalendarConfig(division)
    for (let round = 1; round <= halfSeason; round++) {
      const matchups = generateRoundMatchups(teams, round)
      for (const [home, away] of matchups) fixtures.push({
        id: fixtureId++, round, week: round + weekOffset,
        homeTeam: home, awayTeam: away, competition,
        played: false,
        isUserMatch: home.curto === userTeamShort || away.curto === userTeamShort,
        month: getRoundMonth(round, calCfg.startMonth, calCfg.monthsInSeason, totalRounds),
        competitionType: "league",
        stage: "temporada_regular",
      })
    }
    for (let round = halfSeason + 1; round <= totalRounds; round++) {
      const firstLeg = fixtures.filter(fixture => fixture.round === round - halfSeason)
      for (const fixture of firstLeg) fixtures.push({
        id: fixtureId++, round, week: round + weekOffset,
        homeTeam: fixture.awayTeam, awayTeam: fixture.homeTeam, competition,
        played: false,
        isUserMatch: fixture.isUserMatch,
        month: getRoundMonth(round, calCfg.startMonth, calCfg.monthsInSeason, totalRounds),
        competitionType: "league",
        stage: "temporada_regular",
      })
    }
    return fixtures
  }

  const byId = new Map(teams.map(team => [team.curto, team]))
  const scheduleTeams = teams.map(team => ({ id: team.curto, name: team.nome }))
  const calCfg = leagueCalendarConfig(division)
  const plan = leagueSeasonPlan(division, teams.length)

  const toFixtures = (ranking?: readonly string[]): Fixture[] => {
    const pairings = generateLeaguePairings({ division, teams: scheduleTeams, regularRanking: ranking })
    // Mantém datas estáveis antes e depois de revelar os grupos do split. Se o
    // divisor fosse 33 na fase regular escocesa e 38 depois do corte, todas as
    // rodadas já disputadas mudariam de mês quando a tabela fosse regenerada.
    const totalRounds = Math.max(1, plan.maximumMatches, ...pairings.map(pairing => pairing.round))
    return pairings.flatMap((pairing, index) => {
      const home = byId.get(pairing.homeId)
      const away = byId.get(pairing.awayId)
      if (!home || !away || home.curto === away.curto) return []
      return [{
        id: index + 1,
        round: pairing.round,
        week: pairing.round + weekOffset,
        homeTeam: home,
        awayTeam: away,
        competition,
        competitionId: plan.competitionId,
        played: false,
        isUserMatch: home.curto === userTeamShort || away.curto === userTeamShort,
        month: getRoundMonth(pairing.round, calCfg.startMonth, calCfg.monthsInSeason, totalRounds),
        competitionType: "league" as const,
        stage: pairing.stage,
      }]
    })
  }

  const regular = toFixtures()
  if (plan.kind !== "split" || knownResults.length === 0) return regular

  const hydrated = reconcilePlayedFixtures(regular, knownResults, season)
  if (!hydrated.length || hydrated.some(fixture => !fixture.played)) return regular

  const ranking = computeStandingsFromFixtures(hydrated, competition).map(row => row.teamShort)
  return ranking.length === teams.length ? toFixtures(ranking) : regular
}

// Algoritmo de circulo para gerar confrontos de uma rodada
// Suporta numero impar de times adicionando um "bye" virtual como ultimo time
function generateRoundMatchups(teams: Team[], round: number): [Team, Team][] {
  const matchups: [Team, Team][] = []

  // Se impar, adiciona um time fantasma (bye) para completar o par
  const list: (Team | null)[] = teams.length % 2 === 0 ? [...teams] : [...teams, null]
  const n = list.length

  // Time fixo = list[0]; restante rotaciona
  const fixed = list[0]
  const rotating = list.slice(1)

  const rotated = [...rotating]
  for (let i = 1; i < round; i++) {
    const last = rotated.pop()!
    rotated.unshift(last)
  }

  const allTeams = [fixed, ...rotated]
  for (let i = 0; i < n / 2; i++) {
    const home = allTeams[i]
    const away = allTeams[n - 1 - i]
    // Ignora partidas envolvendo o time fantasma (bye)
    if (!home || !away) continue
    if (round % 2 === 0) {
      matchups.push([away as Team, home as Team])
    } else {
      matchups.push([home as Team, away as Team])
    }
  }

  return matchups
}

// Simula resultado de uma partida entre dois times
// competition: nome REAL da competicao do fixture (estadual/liga/copa/continental).
// Antes caia sempre em getLeagueName(mandante), o que rotulava jogos de estadual/copa
// como se fossem da liga e quebrava o agrupamento por competicao.
/**
 * Força por setor do XI do jogador, no formato que `simularPartida` espera.
 *
 * Reaproveita `forcasDoPlantel` de propósito: é a MESMA régua que mede o
 * adversário humano no co-op. Duas contas diferentes para "quão forte é este
 * time" acabariam divergindo, e a divergência sairia como um viés que ninguém
 * prova olhando o jogo — só sente depois de dez partidas.
 */
function forcasPorSetorDoXI(xi: AtletaEmCampo[]): ForcaPorSetor {
  const titulares = titularesAptos(xi)
  const f = forcasDoPlantel(titulares.length ? titulares : xi, 60)
  // O `mod` (forma + moral) vem separado da fonte e é do CLUBE de quem joga:
  // entra por igual nos três setores, porque time desanimado não rende só na
  // defesa.
  return {
    ataque: f.attack + f.mod,
    meio: f.midfield + f.mod,
    defesa: f.defense + f.mod,
  }
}

function simulateMatchResult(
  homeTeam: Team,
  awayTeam: Team,
  week: number,
  season: number,
  competition?: string,
  /**
   * O lado do JOGADOR, quando a partida é dele. Sem isto o placar sai só do
   * prestígio dos escudos — ver o bloco abaixo.
   */
  ladoDoJogador?: { curto: string; xi: { position: string; overall: number; form?: number }[] },
): MatchResult {
  /**
   * ⚠️ O PLACAR PASSOU A OUVIR O ELENCO (1.0.316).
   *
   * Este cálculo saía do PRESTÍGIO do clube e de mais nada — contratar, escalar
   * e mudar a tática não moviam o resultado de nenhuma partida que o jogador não
   * disputasse ao vivo, inclusive a dele quando escolhia simular. É o mesmo
   * defeito que o co-op já barrava do outro lado: elenco que não vale nada no
   * placar torna o modo um enfeite (ver `lib/forca-do-plantel.ts`).
   *
   * Agora o lado do jogador entra com a força REAL do elenco por setor; os
   * clubes da CPU seguem no prestígio, que é barato e é o que permite resolver
   * uma rodada inteira sem repetir o O(n²) que travou o apito final.
   */
  const forcaDoJogador = ladoDoJogador?.xi?.length
    ? forcasPorSetorDoXI(ladoDoJogador.xi)
    : null
  const ehCasa = ladoDoJogador?.curto === homeTeam.curto
  const ehFora = ladoDoJogador?.curto === awayTeam.curto

  const explicado = simularPartida(
    {
      forca: forcaDoJogador && ehCasa ? forcaDoJogador : forcaPorPrestigio(homeTeam.prestigio),
    },
    {
      forca: forcaDoJogador && ehFora ? forcaDoJogador : forcaPorPrestigio(awayTeam.prestigio),
      mandante: false,
    },
    `${homeTeam.curto}-${awayTeam.curto}-${season}-${week}`,
    ehFora ? "visitante" : "mandante",
  )
  const homeScore = explicado.golsMandante
  const awayScore = explicado.golsVisitante

  // Goleadores REAIS da partida, ponderados por posicao e overall, com assistencia
  // (~62%). Substitui o sorteio uniforme entre atacantes que existia aqui. Os
  // scorers sao GRAVADOS no resultado para a estatistica ler dado persistido; os
  // eventos (usados nos modais) saem dos mesmos scorers, com minuto sorteado.
  const homePlayers = getPlayersForTeam(homeTeam)
  const awayPlayers = getPlayersForTeam(awayTeam)
  const scorers = gerarScorersDaPartida({
    homeShort: homeTeam.curto, awayShort: awayTeam.curto,
    homePlayers, awayPlayers, homeScore, awayScore,
    seedBase: `${homeTeam.curto}-${awayTeam.curto}-${season}-${week}`,
  })
  const events: MatchEvent[] = scorers.map(s => ({
    minute: Math.floor(Math.random() * 90) + 1,
    type: "goal" as const,
    playerId: 0,
    playerName: s.name,
    assistPlayerName: s.assist,
  }))

  return {
    week,
    season,
    competition: competition ?? getLeagueName(homeTeam.curto),
    homeTeam: homeTeam.curto,
    awayTeam: awayTeam.curto,
    homeScore,
    awayScore,
    events: events.sort((a, b) => a.minute - b.minute),
    scorers,
    // A CONTA QUE GEROU O PLACAR. Vazia quando o jogo foi entre dois clubes da
    // CPU (ali não há nada que o técnico pudesse ter mudado) e quando a partida
    // saiu equilibrada — inventar uma causa para um jogo parelho é pior que não
    // explicar. Ver `lib/simulacao-da-partida.ts`.
    ...(ladoDoJogador && explicado.porQue.length ? { porQue: explicado.porQue } : {}),
  }
}

// Inicializa classificacao com times da Serie A
function initializeStandings(teams: Team[]): StandingsEntry[] {
  return teams.map(team => ({
    teamShort: team.curto,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
    form: []
  }))
}

/**
 * O NASCIMENTO DE UMA CARREIRA — clube, liga, divisão, calendário e tabela.
 *
 * ⚠️ EXISTE PARA SER CHAMADA DOS DOIS LADOS. Era daqui que vinha o defeito de
 * fundo do co-op: `initializeNewGame` montava tudo isto para o anfitrião,
 * enquanto o segundo técnico recebia só um `initializeGame` — elenco carregado,
 * mas sem liga, sem calendário e sem tabela próprios. Ele "jogava", e não estava
 * disputando campeonato nenhum.
 *
 * Extraída em vez de duplicada de propósito: uma cópia paralela envelheceria, e
 * o modo voltaria a ser uma imitação da carreira solo em vez de a mesma coisa.
 * O que sai daqui é dado puro; quem chama decide onde grava.
 */
export function nascimentoDeCarreira(teamShort: string, teamFileKey?: string) {
  // `curto` não é identidade global (134 códigos se repetem). Com a escolha
  // livre de país no co-op, resolver pelo `file_key` deixou de ser um detalhe.
  const userTeam = (teamFileKey ? getTeamByFileKey(teamFileKey) : undefined) ?? getTeamByShort(teamShort)
  const divisao = userTeam ? String(effectiveDivision(userTeam)) : "serie_a"
  const leagueTeams = getUserLeagueTeams(teamShort, divisao, teamFileKey)
  const standingsDoMotor = initializeStandings(leagueTeams)

  const careerTeam = userTeam
    ? {
        nome: userTeam.nome, curto: userTeam.curto,
        cor1: userTeam.cor1, cor2: userTeam.cor2,
        prestigio: userTeam.prestigio, saldo: userTeam.saldo,
        divisao, pais: userTeam.pais ?? "",
        cidade: userTeam.cidade, estado: userTeam.estado,
        torcida: userTeam.torcida, estadio_cap: userTeam.estadio_cap,
        fileKey: userTeam.file_key, estadio: userTeam.estadio_nome ?? "",
        patrocinador: userTeam.patrocinador, escudo: userTeam.escudo_url,
      }
    : null

  let fixtures: import("@/lib/career-types").MatchFixture[] = []
  let standings: import("@/lib/career-types").StandingEntry[] = []
  if (careerTeam) {
    const cLeagueTeams = getLeagueTeams(careerTeam)
    // Determinístico sobre a lista de clubes: dois técnicos do MESMO campeonato
    // recebem exatamente o mesmo calendário, e só a marca `isUserMatch` difere.
    // É o que permite eles dividirem uma tabela só sem sincronizar nada.
    fixtures = generateSeasonFixtures(cLeagueTeams, teamShort, 2026)
    standings = initStandings(cLeagueTeams)
  }

  return { userTeam, careerTeam, divisao, leagueTeams, standingsDoMotor, fixtures, standings }
}

/**
 * Calcula a classificacao de UMA competicao a partir dos fixtures dela (estadual,
 * liga, etc.). Inclui todos os times que a disputam, mesmo sem jogos, e ordena por
 * pontos > saldo > gols pro. Necessario porque o engine so mantem a tabela da liga
 * (serieAStandings) — durante o estadual o dashboard mostrava a tabela errada.
 */
export function computeStandingsFromFixtures(fixtures: Fixture[], competition: string): StandingsEntry[] {
  const rows = new Map<string, StandingsEntry>()
  const ensure = (curto: string): StandingsEntry => {
    let r = rows.get(curto)
    if (!r) {
      r = { teamShort: curto, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, form: [] }
      rows.set(curto, r)
    }
    return r
  }

  for (const f of fixtures) {
    if (f.competition !== competition) continue
    const home = ensure(f.homeTeam.curto)
    const away = ensure(f.awayTeam.curto)
    if (!f.played || f.homeScore === undefined || f.awayScore === undefined) continue

    const hg = f.homeScore
    const ag = f.awayScore
    home.played++; away.played++
    home.goalsFor += hg; home.goalsAgainst += ag
    away.goalsFor += ag; away.goalsAgainst += hg

    if (hg > ag) { home.won++; home.points += 3; away.lost++ }
    else if (hg < ag) { away.won++; away.points += 3; home.lost++ }
    else { home.drawn++; away.drawn++; home.points++; away.points++ }
  }

  return [...rows.values()].sort((a, b) =>
    b.points - a.points ||
    (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) ||
    b.goalsFor - a.goalsFor ||
    a.teamShort.localeCompare(b.teamShort),
  )
}

/**
 * useMemo COMPARTILHADO ENTRE INSTANCIAS.
 *
 * Por que existe: `useGameManager` e um hook comum, nao um provider — 22 pontos
 * do jogo o chamam. Cada `useMemo` dele e por INSTANCIA, entao toda navegacao
 * desmontava a tela e remontava o calendario da temporada inteiro (estadual +
 * liga + copas + continental) do zero, e de novo para cada componente da mesma
 * tela que chamasse o hook. Era isso que deixava mercado, elenco e as demais
 * telas lentas — nao o tamanho do bundle.
 *
 * A comparacao e por referencia, elemento a elemento, igual a do proprio React
 * (Object.is). O estado vem sempre do mesmo snapshot da store, entao instancias
 * diferentes veem as MESMAS referencias e o cache acerta; se qualquer entrada
 * mudar de referencia, recalcula. Nao ha como servir calendario velho.
 */
function criarMemoCompartilhado<T>() {
  let depsAnteriores: readonly unknown[] | null = null
  let valor: T
  return (calcular: () => T, deps: readonly unknown[]): T => {
    if (
      depsAnteriores === null ||
      depsAnteriores.length !== deps.length ||
      deps.some((d, i) => !Object.is(d, depsAnteriores![i]))
    ) {
      valor = calcular()
      depsAnteriores = deps
    }
    return valor
  }
}

const memoDoCalendario = criarMemoCompartilhado<SeasonCalendar>()

export function useGameManager() {
  const { state: saveState, setState: setSaveState, replaceState: replaceSaveState, hydrated } = useGameState()
  const gameEngine = useGameEngine()
  const [engineHydrated, setEngineHydrated] = useState(() => useGameEngine.persist.hasHydrated())

  // Refs always pointing at latest values — prevents stale closures in callbacks called in loops
  const saveStateRef = useRef(saveState)
  saveStateRef.current = saveState
  const seasonCalendarRef = useRef<SeasonCalendar>({ fixtures: [], currentRound: 1, nextUserMatch: null, previousUserMatch: null })
  const lastCompletedFixtureWeekRef = useRef<number | null>(null)
  // Ref para não entrar nas deps do advanceWeek (o provider recria addNotification
  // a cada render e isso invalidaria o callback a cada ciclo).
  const { addNotification } = useNotifications()
  const addNotificationRef = useRef(addNotification)
  addNotificationRef.current = addNotification

  useEffect(() => {
    setEngineHydrated(useGameEngine.persist.hasHydrated())
    const unsub = useGameEngine.persist.onFinishHydration(() => {
      setEngineHydrated(true)
    })
    return unsub
  }, [])

  // AQUECIMENTO DOS ELENCOS DO POOL. Este hook é usado por toda tela, então é o
  // ponto que cobre também o caso de recarregar a página direto em /elenco ou
  // /mercado (o `hardNavigate` faz isso). Não bloqueia a montagem: só garante
  // que os 7,91 MB comecem a chegar antes de alguém pedir um elenco.
  // Ver `lib/pool-elencos.ts`.
  useEffect(() => {
    void carregarElencosDoPool()
    void carregarElencosReaisTM()
  }, [])

  // O MUNDO PRECISA SABER EM QUE ANO ESTA. `players-data` monta o elenco de todo
  // clube da IA e envelhece esse elenco pela temporada corrente — mas nao pode
  // importar este hook (ciclo). Entao a informacao viaja por `temporada-do-mundo`,
  // e e AQUI que ela e mantida em dia: na virada de temporada e quando o usuario
  // troca de clube. Sem este efeito o mundo fica parado em 2026, que era o
  // comportamento anterior.
  useEffect(() => {
    if (!hydrated) return
    setTemporadaDoMundo(saveState.season)
    setClubeDoUsuario(saveState.selectedTeamShort ?? null)
  }, [hydrated, saveState.season, saveState.selectedTeamShort])

  // O save é a fonte durável; players-data lê este cache para montar os elencos
  // persistentes dos adversários sem importar hooks React.
  useEffect(() => {
    if (!hydrated) return
    definirUniversoAtivo286(saveState.universo286)
    return () => definirUniversoAtivo286(null)
  }, [hydrated, saveState.universo286])

  // Migração preguiçosa da 1.0.285: a carreira abre com os dados intactos e a
  // primeira tela central semeia o novo universo. Não alteramos VERSION do
  // formato-base porque o campo é opcional e safeParse já preserva extensões.
  useEffect(() => {
    if (!hydrated || !engineHydrated || !saveState.selectedTeamShort || saveState.universo286) return
    const universo286 = semearUniverso286(saveState.season, saveState.selectedTeamShort)
    definirUniversoAtivo286(universo286)
    setSaveState({ universo286 })
  }, [hydrated, engineHydrated, saveState.selectedTeamShort, saveState.season, saveState.universo286, setSaveState])

  // MIGRACAO de save antigo para o relogio ABSOLUTO de contrato. Ate a 1.0.136 o
  // endDate era comparado com a semana da temporada (que zera todo ano) e nenhum
  // contrato vencia. Sem esta migracao, um save em andamento veria o elenco
  // inteiro como "vencido" de uma vez ao abrir a versao corrigida.
  useEffect(() => {
    if (!hydrated || !engineHydrated) return
    if (!saveState.selectedTeamShort) return
    gameEngine.migrarContratosParaSemanaAbsoluta()
    // Entrosamento por minutos juntos (1.0.223): reconstroi as duplas do que ja
    // foi jogado, para o save em andamento nao perder o entrosamento conquistado.
    gameEngine.semearEntrosamentoDoHistorico()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, engineHydrated, saveState.selectedTeamShort])

  // Auto-reinit: engine resetou (versão nova) mas save tem time selecionado
  useEffect(() => {
    if (!hydrated) return
    if (!engineHydrated) return
    if (!saveState.selectedTeamShort) return
    // Reinit se standings ou squad estiverem vazios (initialPlayers tem 1 jogador default)
    if (gameEngine.squadPlayers.length > 1 && gameEngine.serieAStandings.length > 0) return
    const teamShort = saveState.selectedTeamShort
    setClubDivisions(saveState.clubDivisions) // piramide viva antes de montar a liga
    const leagueTeams = resolveLeagueTeams(teamShort, saveState.divisionOverride, saveState.leagueTeams)
    gameEngine.initializeGame(teamShort, saveState.selectedTeam?.fileKey)
    useGameEngine.setState({
      serieAStandings: initializeStandings(leagueTeams),
      currentWeek: saveState.week,
      currentSeason: saveState.season,
    })
  }, [hydrated, engineHydrated, saveState.selectedTeamShort, saveState.week, saveState.season, gameEngine.squadPlayers.length, gameEngine.serieAStandings.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── MIGRACAO: congela a liga das carreiras que comecaram antes de `leagueTeams`
  //
  // A carreira em andamento nao tem a lista congelada, e a divisao dela ja pode
  // ter mudado de tamanho por atualizacao do jogo — que e exatamente o estado em
  // que a temporada nao vira mais. A liga que ela REALMENTE jogou esta na tabela
  // do motor (`serieAStandings` vale para qualquer divisao; o nome engana), e e
  // dali que a lista e adotada: e a unica fonte que descreve os adversarios que
  // o jogador de fato enfrentou.
  //
  // ⚠️ So grava depois de `hydrated` E `engineHydrated`. Escrever antes disso
  // salvaria a tabela do estado default por cima da carreira do jogador.
  useEffect(() => {
    if (!hydrated) return
    if (!engineHydrated) return
    if (!saveState.selectedTeamShort) return
    if (saveState.leagueTeams?.length) return
    const daTabela = gameEngine.serieAStandings.map(linha => linha.teamShort).filter(Boolean)
    if (daTabela.length < MIN_TIMES_PARA_LIGA) return
    if (!daTabela.includes(saveState.selectedTeamShort)) return
    setSaveState({ leagueTeams: daTabela })
  }, [hydrated, engineHydrated, saveState.selectedTeamShort, saveState.leagueTeams, gameEngine.serieAStandings]) // eslint-disable-line react-hooks/exhaustive-deps

  // Inicializa o jogo quando o usuario seleciona um time
  /**
   * PASSAR O COMPUTADOR PARA OUTRO TÉCNICO DA MESA.
   *
   * O que acontece, em ordem, e por quê:
   *
   *  1. GUARDA o bolso de quem sai — as 49 propriedades de clube do motor.
   *  2. GUARDA o mundo (rodada, temporada, tabelas, resultados) à parte.
   *  3. Devolve o bolso de quem entra. Se ele nunca sentou, o clube dele
   *     precisa ser CARREGADO do zero, e o único caminho para isso é o
   *     `initializeGame`.
   *  4. ⚠️ REPÕE O MUNDO POR CIMA. Este passo parece redundante e não é: o
   *     `initializeGame` zera `currentWeek`, `currentSeason`, `matchResults` e
   *     a tabela. Chamado no meio de uma carreira compartilhada, sem o passo 4,
   *     ele mandaria os quatro técnicos de volta para a rodada zero — e o save
   *     já teria sido gravado assim.
   *
   * Ver `lib/chaveamento-de-tecnico.ts` para as duas listas de campos e o teste
   * que reprova campo novo do motor que ninguém classificou.
   */
  const trocarTecnicoAtivo = useCallback((tecnicoId: string) => {
    const atual = saveStateRef.current
    const tecnicos = tecnicosDoSave(atual.tecnicos, atual.managerName, atual.selectedTeamShort)
    const entrando = tecnicos.find(t => t.id === tecnicoId)
    if (!entrando) return
    const saindoId = atual.tecnicoAtivoId ?? tecnicos[0]?.id
    if (saindoId === tecnicoId) return
    const saindo = tecnicos.find(t => t.id === saindoId) ?? null

    const saveAtual = atual as unknown as Record<string, unknown>
    const estadoDoMotor = useGameEngine.getState() as unknown as Record<string, unknown>

    // ── 1) GUARDA quem sai: as duas metades dele ─────────────────────────────
    const bolsos = { ...(atual.estadoPorTecnico ?? {}) }
    const bolsosDeSave = { ...(atual.saveDoTecnico ?? {}) }
    if (saindoId) {
      bolsos[saindoId] = guardarEstadoDoClube(estadoDoMotor)
      bolsosDeSave[saindoId] = guardarSaveDoTecnico(saveAtual)
    }

    // ── 2) GUARDA a liga de quem sai, e o tempo ──────────────────────────────
    //
    // A tabela fica arquivada pela LIGA, não por quem estava jogando: se os dois
    // disputam o mesmo campeonato, o que um fez é o que o outro vai encontrar.
    const arquivosDeLiga = { ...(atual.estadoPorLiga ?? {}) }
    // A liga de quem sai é a que está NA TELA: o save ativo é o dele.
    const doQueSai = nascimentoDeCarreira(atual.selectedTeamShort ?? "", saindo?.clubeFileKey)
    const ligaDeQuemSai = chaveDaLiga(
      saindo?.paisNome ?? doQueSai.userTeam?.pais,
      atual.divisionOverride ?? doQueSai.divisao,
    )
    arquivosDeLiga[ligaDeQuemSai] = {
      motor: guardarEstadoDaLiga(estadoDoMotor),
      save: guardarSaveDaLiga(saveAtual),
    }
    // ⚠️ O TEMPO É INTOCÁVEL. `initializeGame`, logo abaixo, zera semana e
    // temporada; sem repor isto por cima a mesa inteira voltaria à rodada zero,
    // já gravada.
    const tempo = guardarEstadoDoTempo(estadoDoMotor)

    // ── 3) DEVOLVE quem entra ────────────────────────────────────────────────
    const clubeDeQuemEntra = entrando.clubeCurto ?? ""
    const doQueEntra = nascimentoDeCarreira(clubeDeQuemEntra, entrando.clubeFileKey)
    const bolsoDeQuemEntra = restaurarEstadoDoClube(bolsos, tecnicoId)
    const saveDeQuemEntra = restaurarSaveDoTecnico(bolsosDeSave, tecnicoId)
    let patchDoSave: Record<string, unknown>

    if (bolsoDeQuemEntra && saveDeQuemEntra) {
      useGameEngine.setState(bolsoDeQuemEntra as never)
      patchDoSave = { ...saveDeQuemEntra }
    } else {
      // PRIMEIRA VEZ QUE ESTA PESSOA SENTA. A carreira dela precisa NASCER — e
      // pelo mesmo caminho da carreira solo, senão ela entra sem liga, sem
      // calendário e sem tabela, que era o defeito do modo até a 1.0.303.
      gameEngine.initializeGame(clubeDeQuemEntra, entrando.clubeFileKey ?? doQueEntra.userTeam?.file_key)
      patchDoSave = {
        selectedTeamShort: clubeDeQuemEntra,
        selectedTeam: doQueEntra.careerTeam ?? undefined,
        managerName: entrando.nome,
        saveName: `Carreira de ${entrando.nome} - ${doQueEntra.userTeam?.nome || clubeDeQuemEntra}`,
        divisionOverride: doQueEntra.divisao === String(doQueEntra.userTeam?.divisao ?? "")
          ? undefined
          : doQueEntra.divisao,
        leagueTeams: doQueEntra.leagueTeams.map(time => time.curto),
        fixtures: doQueEntra.fixtures,
        completedFixtureKeys: [],
        results: [],
        finances: [],
        seasonHistory: [],
        injuries: [],
        playerFatigue: {},
        teamMorale: 70,
        // Ele assume o clube HOJE, não na rodada zero: a mesa já andou.
        contratadoEm: { season: atual.season, week: atual.week },
      }
    }

    // ── 4) A LIGA DE QUEM ENTRA, e o tempo por cima ──────────────────────────
    const ligaDeQuemEntra = chaveDaLiga(
      entrando.paisNome ?? doQueEntra.userTeam?.pais,
      (patchDoSave.divisionOverride as string | undefined) ?? doQueEntra.divisao,
    )
    const arquivoDaLiga = arquivosDeLiga[ligaDeQuemEntra]
    if (arquivoDaLiga?.motor) {
      useGameEngine.setState(arquivoDaLiga.motor as never)
    } else {
      // Campeonato que ninguém jogou ainda: tabela zerada da liga DELE.
      useGameEngine.setState({
        serieAStandings: doQueEntra.standingsDoMotor,
        matchResults: [], topScorers: [], headToHeadRecords: [], copaBrasil: [],
      } as never)
      patchDoSave.standings = doQueEntra.standings
    }
    if (arquivoDaLiga?.save) Object.assign(patchDoSave, arquivoDaLiga.save)
    // SEMPRE por último: o tempo não pertence a ninguém da mesa.
    useGameEngine.setState(tempo as never)

    setSaveState({
      ...patchDoSave,
      estadoPorTecnico: bolsos,
      saveDoTecnico: bolsosDeSave,
      estadoPorLiga: arquivosDeLiga,
      tecnicoAtivoId: tecnicoId,
      // Os campos singulares continuam sendo "de quem é a vez": é o que permite
      // as dezenas de telas que leem `managerName`/`selectedTeamShort` seguirem
      // funcionando sem alteração nenhuma.
      managerName: entrando.nome,
      selectedTeamShort: entrando.clubeCurto,
    } as Parameters<typeof setSaveState>[0])
    if (entrando.clubeCurto) setClubeDoUsuario(entrando.clubeCurto)
  }, [gameEngine, setSaveState])

  /**
   * "FECHEI, PASSA PARA O PRÓXIMO" — o botão que faltava para o modo existir.
   *
   * ⚠️ SEM ISTO O CO-OP TRAVAVA PARA SEMPRE. A trava dentro do `advanceWeek` só
   * deixa a rodada andar quando todos fecham, e nenhuma tela chamava
   * `marcarPronto`: uma carreira com dois técnicos nunca chegava à rodada 1.
   * A trava estava certa; era a outra metade que não tinha sido ligada.
   *
   * Devolve para quem chama o que aconteceu, porque a tela precisa dizer coisas
   * diferentes em cada caso — "passe o computador para o João" ou "todos
   * fecharam, pode avançar".
   */
  const fecharDecisoesEPassarAVez = useCallback((): {
    fechou: boolean
    proximo: TecnicoDoSave | null
    todosFecharam: boolean
  } => {
    const atual = saveStateRef.current
    const tecnicos = tecnicosDoSave(atual.tecnicos, atual.managerName, atual.selectedTeamShort)
    if (!ehMultitecnico(tecnicos)) return { fechou: false, proximo: null, todosFecharam: true }

    const euId = atual.tecnicoAtivoId ?? tecnicos[0]?.id
    if (!euId) return { fechou: false, proximo: null, todosFecharam: false }

    const rodada = marcarPronto(
      atual.rodadaCompartilhada ?? iniciarRodada(atual.week),
      euId,
    )
    // O ref precisa enxergar a rodada nova ANTES da troca: `trocarTecnicoAtivo`
    // lê `saveStateRef.current`, e sem isto o "pronto" que acabou de ser dado
    // seria perdido no patch dele.
    saveStateRef.current = { ...atual, rodadaCompartilhada: rodada } as typeof atual
    setSaveState({ rodadaCompartilhada: rodada } as Parameters<typeof setSaveState>[0])

    const proximo = proximoAJogar(rodada, tecnicos)
    if (proximo && proximo.id !== euId) trocarTecnicoAtivo(proximo.id)

    return {
      fechou: true,
      proximo,
      todosFecharam: podeAvancar(rodada, tecnicos),
    }
  }, [setSaveState, trocarTecnicoAtivo])

  /** Voltei atrás: quero mexer no time antes de a rodada rodar. */
  const reabrirMinhasDecisoes = useCallback(() => {
    const atual = saveStateRef.current
    const tecnicos = tecnicosDoSave(atual.tecnicos, atual.managerName, atual.selectedTeamShort)
    if (!ehMultitecnico(tecnicos)) return
    const euId = atual.tecnicoAtivoId ?? tecnicos[0]?.id
    if (!euId) return
    const rodada = desmarcarPronto(atual.rodadaCompartilhada ?? iniciarRodada(atual.week), euId)
    saveStateRef.current = { ...atual, rodadaCompartilhada: rodada } as typeof atual
    setSaveState({ rodadaCompartilhada: rodada } as Parameters<typeof setSaveState>[0])
  }, [setSaveState])

  const initializeNewGame = useCallback((teamShort: string, managerName?: string, initialCareerState: Partial<GameState> = {}, teamFileKey?: string) => {
    // Define a identidade ANTES de inicializar o Zustand. Assim o elenco/tatica
    // nasce no arquivo da nova carreira, nunca no slot que estava ativo antes.
    const careerId = createCareerId()
    setActiveCareerId(careerId)
    setTemporadaDoMundo(2026)
    setClubeDoUsuario(teamShort)
    // ⚠️ MESMO CAMINHO DO CO-OP. Um técnico convidado que senta pela primeira vez
    // passa por `nascimentoDeCarreira` também — é o que faz o modo ser a mesma
    // carreira, e não uma imitação dela. Ver `trocarTecnicoAtivo`.
    const nascimento = nascimentoDeCarreira(teamShort, teamFileKey)
    const { userTeam, careerTeam, divisao: effectiveInitialDivision, leagueTeams } = nascimento
    const initialFixtures = nascimento.fixtures
    const initialStandings = nascimento.standings
    const universo286 = semearUniverso286(2026, teamShort)
    definirUniversoAtivo286(universo286)

    // Inicializa no game engine (carrega elenco do seed para o time)
    gameEngine.initializeGame(teamShort, teamFileKey)

    // Reseta standings e semana no game engine
    useGameEngine.setState({
      serieAStandings: nascimento.standingsDoMotor,
      currentWeek: 0,
      currentSeason: 2026,
      matchResults: [],
    })

    // Nova carreira e uma SUBSTITUICAO, nao merge. O merge antigo mantinha squadPlayers,
    // selectedTeam e outros campos opcionais do primeiro save.
    clearJobOffers()
    if (typeof window !== "undefined") {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("ultrafoot-competitions:")) localStorage.removeItem(key)
      }
    }
    replaceSaveState(createFreshCareerState(saveState, {
      careerId,
      saveName: `Carreira de ${(managerName?.trim() || "Tecnico")} - ${userTeam?.nome || teamShort}`,
      selectedTeamShort: teamShort,
      selectedTeam: careerTeam ?? undefined,
      divisionOverride: effectiveInitialDivision === String(userTeam?.divisao ?? "")
        ? undefined
        : effectiveInitialDivision,
      week: 0,
      season: 2026,
      // Data de posse do primeiro clube. Antes só trocas de emprego preenchiam
      // este campo, então a Área do Treinador não sabia quando a carreira começou.
      contratadoEm: { season: 2026, week: 0 },
      // Congela a liga ja na criacao: a partir daqui uma atualizacao do jogo nao
      // reescreve mais os adversarios desta temporada.
      leagueTeams: leagueTeams.map(time => time.curto),
      ...(managerName ? { managerName: managerName.trim() || "Tecnico" } : {}),
      // Fixtures semeadas para rastreamento de fim de temporada
      fixtures: initialFixtures,
      standings: initialStandings,
      results: [],
      finances: [],
      seasonHistory: [],
      injuries: [],
      playerFatigue: {},
      teamMorale: 70,
      universo286,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...initialCareerState,
    }))
  }, [gameEngine, replaceSaveState, saveState])
  
  // Calendario da temporada — ref is updated after useMemo so advanceWeek loop calls see latest fixtures
  const seasonCalendar = memoDoCalendario((): SeasonCalendar => {
    if (!saveState.selectedTeamShort) {
      return { fixtures: [], currentRound: 1, nextUserMatch: null, previousUserMatch: null }
    }

    const userTeamShort = saveState.selectedTeamShort
    const currentWeek = saveState.week
    // PIRAMIDE VIVA: aplica os acessos/rebaixamentos acumulados ANTES de montar a
    // liga, para os rivais desta divisao ja serem os clubes que realmente subiram.
    setClubDivisions(saveState.clubDivisions)
    const userTeam = getTeamByShort(userTeamShort)
    // Divisao ATUAL (override de acesso/rebaixamento) — define o campeonato desta temporada.
    const division = saveState.divisionOverride ?? userTeam?.divisao ?? "serie_a"

    // Para times brasileiros: gera campeonato estadual (Jan-Mar) + liga nacional (Abr+)
    let allFixtures: Fixture[] = []
    let stateChampRoundsCount = 0

    // Quem disputa estadual e decidido SO por getStateChampionshipTeams (que ja
    // aplica disputaEstadual). Havia aqui um segundo portao, `isBrazilianDivision`,
    // mais restrito que aquele: clube que existe apenas no POOL (`pool:Brasil`,
    // ex.: Inter de Limeira) ficava SEM estadual no calendario — mas
    // getStateChampRounds e a tela de competicoes, que passam so pelo
    // getStateChampionshipTeams, CONTAVAM o estadual dele. Os dois lados
    // discordavam: a liga comecava na semana 1 enquanto o resto do jogo
    // acreditava que havia N rodadas de estadual antes, e o estadual reaparecia
    // fora de lugar no calendario. Um portao so elimina a divergencia.
    {
      const stateTeams = getStateChampionshipTeams(userTeamShort)
      if (stateTeams.length >= 4) {
        const stateName = ESTADO_CAMPEONATO[userTeam?.estado ?? ""] ?? "Campeonato Estadual"
        const stateFixtures = generateStateChampionshipFixtures(
          stateTeams,
          userTeamShort,
          stateName,
          gameEngine.matchResults.filter(result => result.season === saveState.season),
          saveState.season,
        )
        stateChampRoundsCount = Math.max(0, ...stateFixtures.map(fixture => fixture.week))
        allFixtures.push(...stateFixtures)
      }
    }

    // Supercopas conquistadas na temporada anterior (Supercopa do Brasil,
    // Recopa, Supercopa da UEFA, Mundial). Vazio quando o clube não foi campeão
    // de nada — a maioria das temporadas.
    //
    // ⚠️ A DIVISÃO ENTRA AQUI (1.0.381) e sem ela a supercopa NACIONAL nunca
    // apareceria: é por ela que se sabe se o clube disputa o Community Shield,
    // a Supercoppa Italiana ou nenhuma. As continentais não dependem dela.
    const superCupBerths = berthsForSeason(saveState.seasonHistory, userTeamShort, saveState.season, division)
    // Vaga na continental principal por titulo continental do ano anterior
    // (Sul-Americana -> Libertadores, Europa League -> Champions).
    const continentalBerth = continentalTitleBerth(saveState.seasonHistory, userTeamShort, saveState.season)
    // POSICAO FINAL na LIGA da temporada anterior — decide a vaga continental de
    // forma realista (campeao -> principal). Entre os registros da temporada
    // passada do clube, o da LIGA e o que tem mais jogos (a copa tem ~5).
    const lastLeaguePosition = (saveState.seasonHistory ?? [])
      .filter(r => r.season === saveState.season - 1 && r.teamCurto === userTeamShort)
      .sort((a, b) => (b.won + b.drawn + b.lost) - (a.won + a.drawn + a.lost))[0]?.position ?? 0

    const leagueTeams = resolveLeagueTeams(userTeamShort, saveState.divisionOverride, saveState.leagueTeams)
    const competition = LEAGUE_NAMES[division] ?? getLeagueName(userTeamShort)
    // Gera a liga com round=1..L (semana sera reatribuida ao intercalar as copas)
    const leagueFixtures = generateBrasileirao(
      leagueTeams,
      userTeamShort,
      competition,
      division,
      stateChampRoundsCount,
      gameEngine.matchResults.filter(result => result.season === saveState.season),
      saveState.season,
    )

    // ── Intercala copas nacionais e competicoes continentais ────────────────
    // Cada partida do usuario ocupa uma semana unica (1 jogo por semana). As
    // partidas de copa entram em "meios de semana" distribuidos ao longo da liga.
    // O espaçamento das copas precisa usar o formato REAL da liga. A fórmula
    // antiga só servia para ida e volta: na MLS criava 58 semanas apesar de a
    // fase regular ter 34 jogos; em Escócia/Coreia ignorava o split; e nas
    // ligas de três ou quatro turnos concentrava todas as copas no começo.
    const leagueRoundCount = getLeagueRounds(division)
    const cupMatches: Array<CupMatchDescriptor | null> = []
    if (userTeam) {
      // Um rival da mesma liga ja aparece em ida e volta. Prioriza adversarios externos
      // nas copas para nao criar o relato confuso de tres jogos contra o mesmo clube.
      const cupOpponents = new Set(leagueTeams.filter(t => t.curto !== userTeam.curto).map(t => t.curto))
      for (const plan of getUserCupPlan(userTeam, superCupBerths, continentalBerth, saveState.season, lastLeaguePosition, { historico: saveState.seasonHistory, clubeDoUsuario: userTeamShort })) {
        cupMatches.push(...generateUserCupMatches(
          userTeam, plan, saveState.season, cupOpponents,
          gameEngine.matchResults.filter(r => r.season === saveState.season),
        ))
      }
    }

    if (cupMatches.length === 0) {
      // Sem copas: comportamento original (liga apos o estadual)
      allFixtures.push(...leagueFixtures)
    } else {
      // Agrupa fixtures da liga por rodada para reatribuir semanas
      const leagueByRound = new Map<number, Fixture[]>()
      for (const f of leagueFixtures) {
        const arr = leagueByRound.get(f.round)
        if (arr) arr.push(f)
        else leagueByRound.set(f.round, [f])
      }

      const C = cupMatches.length
      let week = stateChampRoundsCount
      let cupIdx = 0
      let cupFixtureId = 50000

      for (let r = 1; r <= leagueRoundCount; r++) {
        week++
        const roundFixtures = leagueByRound.get(r) ?? []
        const roundMonth = roundFixtures[0]?.month ?? 0
        for (const f of roundFixtures) {
          f.week = week
          allFixtures.push(f)
        }
        // Copa entra no MEIO DA SEMANA da rodada de liga — sem consumir semana
        // propria. `if` e nao `while`: no maximo um jogo de copa por rodada,
        // senao tres partidas do usuario cairiam na mesma semana.
        if (cupIdx < C && r >= Math.round(((cupIdx + 1) * leagueRoundCount) / (C + 1))) {
          const cm = cupMatches[cupIdx]
          // `null` = clube eliminado: a semana existe, o jogo nao.
          if (cm) allFixtures.push({
            id: cupFixtureId++,
            round: cupIdx + 1,
            week,
            homeTeam: cm.homeTeam,
            awayTeam: cm.awayTeam,
            competition: cm.competition,
            competitionId: cm.competitionId,
            played: false,
            isUserMatch: true,
            month: roundMonth,
            competitionType: cm.competitionType,
            stage: cm.stage,
            midweek: true,
          })
          cupIdx++
        }
      }
      // Partidas de copa restantes vao para o fim da temporada
      while (cupIdx < C) {
        week++
        const cm = cupMatches[cupIdx]
        if (cm) allFixtures.push({
          id: cupFixtureId++,
          round: cupIdx + 1,
          week,
          homeTeam: cm.homeTeam,
          awayTeam: cm.awayTeam,
          competition: cm.competition,
          competitionId: cm.competitionId,
          played: false,
          isUserMatch: true,
          month: 11,
          competitionType: cm.competitionType,
          stage: cm.stage,
        })
        cupIdx++
      }
    }

    // Marca partidas ja jogadas. IMPORTANTE: casa por par DIRECIONAL (mandante x
    // visitante) + temporada, SEM exigir que a semana do resultado seja igual a do
    // fixture. Antes exigia r.week === f.week; qualquer deriva de semana (ex.: uma
    // rodada em que o usuario nao joga, ou o resultado gravado em week+1) fazia o
    // fixture NUNCA ser marcado como jogado -> nextUserMatch travava na mesma
    // partida ("termino e continua a mesma"). Cada par home/away e unico no ida-volta,
    // entao casar so pela direcao + temporada e seguro.
    // Insere as pausas de data FIFA ANTES de reconciliar/numerar: o calendario
    // de clubes para na janela de selecoes e os jogos seguintes deslizam.
    if (userTeam) allFixtures = aplicarPausasFifa(allFixtures, userTeam, saveState.season)

    const seasonNow = saveState.season
    allFixtures = reconcilePlayedFixtures(
      allFixtures,
      gameEngine.matchResults,
      seasonNow,
      saveState.completedFixtureKeys ?? [],
    )

    // Ao assumir um clube no meio da temporada, os compromissos que esse clube
    // disputou antes da chegada do treinador não podem voltar para a agenda como
    // se fossem jogos futuros. Isso acontecia sobretudo com clubes de estadual:
    // aceitar a Inter de Limeira em julho fazia o Paulista de janeiro reaparecer
    // como "próximo jogo". Os resultados históricos continuam no calendário,
    // mas todo fixture anterior à semana atual passa a ser tratado como concluído.
    //
    // Não gravamos placares inventados aqui: a classificação usa os resultados
    // reais/simulados do motor. Para a agenda, `played` é a informação necessária
    // para impedir a repetição do campeonato.
    allFixtures = allFixtures.map(fixture =>
      fixture.isUserMatch && !fixture.played && fixture.week < currentWeek
        ? { ...fixture, played: true }
        : fixture,
    )

    // DATAS DO MES. Só aqui, no fim, os fixtures têm semana e mês definitivos
    // (a pausa FIFA já deslocou tudo). O dia de cada jogo passa a sair da ORDEM
    // das semanas dentro do mês, e não mais de `roundToDay(round)` — que para um
    // jogo de copa usava a posição do confronto no chaveamento e jogava a final
    // para o começo do mês, antes de rodadas anteriores a ela. Ver
    // lib/amistosos-calendario#atribuirDiasDoMes.
    allFixtures = atribuirDiasDoMes(allFixtures, seasonNow)

    // ── AMISTOSOS MARCADOS ────────────────────────────────────────────────────
    // Entram POR ÚLTIMO, depois da reconciliação: eles não têm resultado no motor
    // (um amistoso não é registrado como partida oficial) e o próprio save guarda
    // se já foram jogados e com que placar.
    //
    // A semana escolhida pelo técnico já é livre por construção (a Área do
    // Treinador só oferece semanas sem compromisso), mas revalidamos aqui: entre
    // marcar e jogar, o calendário pode ter sido remontado por uma copa nova ou
    // pela pausa da Copa do Mundo, que empurra tudo para frente.
    if (userTeam) {
      const semanasOcupadas = new Set(
        allFixtures.filter(f => f.isUserMatch && !ehAmistoso(f)).map(f => f.week),
      )
      const diasOcupadosPorMes = new Map<number, Set<number>>()
      for (const f of allFixtures) {
        if (!f.isUserMatch) continue
        const set = diasOcupadosPorMes.get(f.month) ?? new Set<number>()
        set.add(diaDaPartida(f))
        diasOcupadosPorMes.set(f.month, set)
      }

      const marcados = (saveState.amistososAgendados ?? []).filter(
        a => a.jogado || a.week == null || !semanasOcupadas.has(a.week),
      )
      allFixtures = allFixtures.concat(construirFixturesDeAmistoso<Fixture>(marcados, {
        userTeam,
        season: seasonNow,
        currentWeek,
        resolveTeam: (curto) => getTeamByShort(curto) ?? undefined,
        diasOcupadosPorMes,
        monta: (d) => ({
          id: d.id,
          round: 0,
          week: d.week,
          homeTeam: d.homeTeam,
          awayTeam: d.awayTeam,
          competition: "Amistoso",
          played: d.played,
          homeScore: d.homeScore,
          awayScore: d.awayScore,
          isUserMatch: true,
          month: d.month,
          dayOfMonth: d.dayOfMonth,
          competitionType: "friendly",
          stage: d.rotulo,
        }),
      }))
    }

    // Encontra rodada atual — total inclui estadual + liga + copas/continentais
    // As copas agora dividem a semana com a liga, entao NAO somam semanas. O que
    // ainda pode alongar a temporada e a sobra que nao coube em nenhuma rodada,
    // e essa ja aparece na maior semana dos fixtures.
    // Amistoso fora da conta: um jogo-treino marcado para depois da última
    // rodada não pode esticar a temporada.
    const totalWeeks = Math.max(
      stateChampRoundsCount + (leagueTeams.length - 1) * 2,
      ...fixturesQueContamNaTemporada(allFixtures).map(f => f.week),
    )
    const currentRound = Math.max(1, Math.min(totalWeeks, currentWeek))

    // Proxima partida do usuario (a de menor semana ainda nao jogada).
    // O desempate pelo DIA importa: uma semana pode ter dois jogos seus (a copa
    // entra no meio da semana da rodada de liga) e a ordem entre eles nao pode
    // depender de quem foi empilhado primeiro no array.
    const porData = (a: Fixture, b: Fixture) =>
      a.week - b.week || diaDaPartida(a) - diaDaPartida(b) || a.id - b.id
    const nextUserMatch = allFixtures
      .filter(f => f.isUserMatch && !f.played && f.week >= currentWeek)
      .sort(porData)[0] || null

    // Ultima partida do usuario (a de maior semana ja jogada)
    const playedUserMatches = allFixtures
      .filter(f => f.isUserMatch && f.played)
      .sort(porData)
    const previousUserMatch = playedUserMatches.length > 0
      ? playedUserMatches[playedUserMatches.length - 1]
      : null

    // As escolhas feitas antes da carreira alteram o motor, não apenas a tela.
    // Partidas já jogadas são preservadas para saves migrados/auditoria histórica.
    allFixtures = allFixtures.filter(f => f.played || competicaoHabilitada283(f, saveState.configuracoesIniciais283))
    const nextFiltered = allFixtures.filter(f => f.isUserMatch && !f.played && f.week >= currentWeek).sort(porData)[0] || null
    const playedFiltered = allFixtures.filter(f => f.isUserMatch && f.played).sort(porData)
    const result = { fixtures: allFixtures, currentRound, nextUserMatch: nextFiltered, previousUserMatch: playedFiltered.at(-1) ?? null }
    seasonCalendarRef.current = result
    return result
    // divisionOverride nas deps: ao subir/cair, o calendario e os adversarios da liga
    // precisam ser recalculados para a divisao nova.
  }, [saveState.selectedTeamShort, saveState.week, saveState.season, saveState.divisionOverride, saveState.completedFixtureKeys, saveState.amistososAgendados, saveState.configuracoesIniciais283, gameEngine.matchResults])
  
  // ── MANUTENÇÃO DOS AMISTOSOS MARCADOS ─────────────────────────────────────
  //
  // Duas coisas, ambas fora do caminho crítico do avanço de semana:
  //
  //  1. MIGRAÇÃO. Saves anteriores à 1.0.223 guardavam o amistoso só com um
  //     rótulo de data ("Sáb, 14 Mar"), sem semana — e sem semana ele não tem
  //     onde entrar no calendário. Realocamos para a próxima semana livre em vez
  //     de descartar o que o técnico marcou.
  //  2. VALIDADE. O amistoso que ficou para trás sem ser disputado não é
  //     simulado (ver fixture-catchup): ele simplesmente não aconteceu e sai da
  //     agenda. Sem esta limpeza ele ficaria preso no save para sempre, ocupando
  //     uma das três vagas.
  useEffect(() => {
    if (!hydrated) return
    if (!saveState.selectedTeamShort) return
    const marcados = saveState.amistososAgendados
    if (!marcados?.length) return

    const migrados = migrarAmistososSemSemana(marcados, seasonCalendarRef.current.fixtures, saveState.week)
    const base = migrados ?? marcados
    const vencidos = amistososVencidos(base, saveState.week)
    if (!migrados && vencidos.length === 0) return

    const limpos = vencidos.length
      ? base.filter(a => !vencidos.includes(a))
      : base
    setSaveState({ amistososAgendados: limpos } as Parameters<typeof setSaveState>[0])
    if (vencidos.length > 0) {
      addNotificationRef.current({
        type: "system", priority: "low",
        title: vencidos.length === 1 ? "Amistoso cancelado" : "Amistosos cancelados",
        message: `${vencidos.map(a => a.oppNome).join(", ")} — a data passou sem o jogo acontecer. Marque outro na Área do Treinador.`,
      })
    }
  }, [hydrated, saveState.selectedTeamShort, saveState.amistososAgendados, saveState.week, setSaveState])

  // Avanca uma semana/rodada
  // Uses refs so sequential calls within a loop always read the latest week (fixes stale closure bug)
  const advanceWeek = useCallback(async () => {
    const currentState = saveStateRef.current

    /**
     * A RODADA NÃO ANDA SEM TODOS FECHAREM.
     *
     * ⚠️ Esta trava precisa existir AQUI, e não só no botão. Se alguma tela
     * chamar `advanceWeek` sem consultar `podeAvancar` — e há várias que
     * chamam —, o mundo avançaria com o time de alguém sem escalação. Essa
     * pessoa perderia a rodada sem ter jogado, e nada no jogo diria por quê:
     * ela veria só um resultado ruim inexplicável.
     *
     * Carreira de um técnico só passa direto: `tecnicosDoSave` devolve uma
     * lista de um, e um único técnico está sempre pronto para si mesmo.
     */
    const tecnicosAgora = tecnicosDoSave(
      currentState.tecnicos, currentState.managerName, currentState.selectedTeamShort,
    )
    if (ehMultitecnico(tecnicosAgora)) {
      const rodada = currentState.rodadaCompartilhada ?? iniciarRodada(currentState.week)
      if (!podeAvancar(rodada, tecnicosAgora)) {
        const faltam = faltamFechar(rodada, tecnicosAgora)
        addNotificationRef.current({
          type: "system", priority: "high",
          title: "A rodada ainda não pode andar",
          message: faltam.length === 1
            ? `${faltam[0].nome} ainda não fechou as decisões.`
            : `Faltam fechar: ${faltam.map(t => t.nome).join(", ")}.`,
        })
        return
      }
    }

    const currentWeek = currentState.week
    // Se a partida estava numa semana futura (transição estadual -> liga ou copa),
    // avança até a semana REAL dela. Incrementar apenas +1 deixava o calendário e o
    // resultado em linhas de tempo diferentes e podia reapresentar o confronto.
    const newWeek = Math.max(currentWeek + 1, lastCompletedFixtureWeekRef.current ?? currentWeek + 1)
    lastCompletedFixtureWeekRef.current = null

    // Verifica fim de temporada — total inclui estadual + liga + copas/continentais
    const userShort = currentState.selectedTeamShort ?? ""
    const divOverride = currentState.divisionOverride
    setClubDivisions(currentState.clubDivisions) // piramide viva antes de montar ligas
    const leagueTeamsForEnd = resolveLeagueTeams(userShort, divOverride, currentState.leagueTeams)
    const stateRoundsForEnd = getStateChampRounds(userShort)
    // A temporada de liga jamais pode acabar por ter menos confrontos do que o
    // regulamento cadastrado. Em saves antigos havia bancos parciais e o cálculo
    // por `times.length` podia encerrar uma campanha antes do returno completo.
    const leagueRoundsForEnd = getLeagueRounds(
      divOverride ?? (() => { const tm = getTeamByShort(userShort); return tm ? effectiveDivision(tm) : null })() ?? "serie_a",
    )
    // Copa em meio de semana nao alonga a temporada; o Math.max abaixo cobre a
    // sobra que porventura tenha ido para o fim.
    const computedSeasonEndWeek = stateRoundsForEnd + leagueRoundsForEnd
    // AMISTOSO FORA DA CONTA (1.0.223). Um jogo-treino marcado para depois da
    // última rodada empurraria `seasonEndWeek` e a temporada só fecharia quando o
    // contador passasse dele — o mesmo mecanismo do bug histórico "a temporada
    // nunca terminava".
    const seasonEndWeek = Math.max(
      computedSeasonEndWeek,
      ...fixturesQueContamNaTemporada(seasonCalendarRef.current.fixtures).map(fixture => fixture.week),
    )

    // ⚠️ SAVE ANTIGO NAO TEM `competitionType` (07/08/2026, diagnosticado NO save
    // do jogador: carreira do Botafogo, semana 57, com 38 partidas do usuario —
    // 24 jogadas — e **zero** casando `competitionType === "league"`).
    //
    // Aquelas 38 sao "Brasileirao Serie A": o campo simplesmente nao existia
    // quando o calendario foi gravado. Com o filtro so por tipo, a lista vinha
    // VAZIA, `0 >= expectedLeagueFixtures` era falso e `leagueComplete` ficava
    // falso para sempre — a temporada nunca virava, o escritorio anunciava "o
    // clube nao tem mais jogos" e o botao "Iniciar nova temporada" nao fazia
    // nada. Nenhum teste pegou porque todos geram calendario novo, que tem o
    // campo; o defeito so existe em save antigo.
    //
    // O nome da competicao e a rede: quando o tipo falta, vale o que casa com a
    // liga do clube nesta temporada.
    const nomeDaLiga = getLeagueName(userShort, divOverride)
    const leagueUserFixtures = seasonCalendarRef.current.fixtures.filter(
      fixture => fixture.isUserMatch && (
        fixture.competitionType === "league" ||
        (!fixture.competitionType && fixture.competition === nomeDaLiga)
      ),
    )
    // Quantas partidas de liga a temporada REALMENTE tem, pelo turno-returno dos
    // times inscritos — que é exatamente o que generateSeasonFixtures produz.
    //
    // Antes esta comparação usava `leagueRoundsForEnd`, que embute o valor
    // declarado em LEAGUE_CALENDAR. Quando a constante superava o calendário real
    // a condição ficava impossível e a temporada NUNCA terminava. Auditoria de
    // 2026-07-20 (scripts/audit-competicoes.ts) pegou quatro ligas nesse estado:
    //   Série C (30 partidas x 38 declaradas), Série D (36 x 38),
    //   Scottish Premiership (22 x 38) e Pro League BEL (30 x 34).
    // Quem escolhesse esses clubes ficava presa no fim da temporada para sempre.
    //
    // ⚠️ E `(times - 1) * 2` reincidia no MESMO erro quando a liga tem numero
    // IMPAR de clubes. Com N impar, `generateBrasileirao` monta N-1 rodadas com
    // um folga por rodada: cada clube joga no maximo 2*floor((N-1)²/N) partidas
    // — 34 numa liga de 19, nunca as 36 que a formula exige. A condicao ficava
    // impossivel de novo. Caso real (06/08/2026): Serie D de 19 clubes, o
    // jogador em 2o lugar, temporada travada em 2026 havia semanas.
    //
    // O piso agora e UM TURNO completo. Continua barrando o "rebaixado com 15
    // jogos" (a liga pela metade) e e alcancavel nas duas paridades. Quem manda
    // de verdade e o `every(played)` da linha seguinte, sobre o calendario
    // REALMENTE gerado para a liga congelada desta temporada.
    // ⚠️ SEM LISTA CONGELADA, QUEM MANDA E O CALENDARIO (07/08/2026: "nao estou
    // conseguindo iniciar a temporada").
    //
    // O bloco de `resolveLeagueTeams` ja explica o veneno: a composicao da liga
    // e RECALCULADA a partir dos dados do jogo, entao uma atualizacao que traga
    // clubes novos para a divisao faz `expectedLeagueFixtures` exigir mais
    // partidas do que a temporada gerou — `leagueComplete` fica falso PARA
    // SEMPRE e a temporada nunca vira. A defesa criada na epoca foi congelar
    // `leagueTeams` no save; ela protege quem comecou a carreira DEPOIS disso.
    //
    // Quem tem save anterior nao tem a lista congelada, cai no recalculo e fica
    // exatamente no beco: escritorio anunciando "o clube nao tem mais jogos" e o
    // botao "Iniciar nova temporada" sem efeito nenhum.
    //
    // Aqui, quando NAO ha lista congelada, a exigencia e limitada ao que o
    // calendario realmente tem. Isso nao afrouxa a trava do "rebaixado com 15
    // jogos": ela existe para o caso de haver partida PENDENTE, e o
    // `every(played)` logo abaixo continua valendo integralmente. O que muda e
    // so parar de exigir jogos que nunca foram marcados.
    const ligaCongelada = (currentState.leagueTeams?.length ?? 0) >= MIN_TIMES_PARA_LIGA
    const expectedLeagueFixtures = ligaCongelada
      ? Math.max(1, leagueTeamsForEnd.length - 1)
      : Math.max(1, Math.min(leagueTeamsForEnd.length - 1, leagueUserFixtures.length))
    const leagueFixturesComplete = leagueUserFixtures.length >= expectedLeagueFixtures &&
      leagueUserFixtures.every(fixture => fixture.played)

    // O clube ainda tem algum compromisso? Cobre liga, estadual, copas e
    // continentais de uma vez.
    //
    // Sem isto a temporada só fechava quando o CONTADOR DE SEMANAS ultrapassava
    // seasonEndWeek, mesmo com o time sem absolutamente nada para jogar: quem
    // caía cedo nas copas terminava a liga e ficava clicando "avançar" em
    // semanas vazias até o contador alcançar um fim de temporada teórico.
    // Agora, acabou a última partida do clube, acabou a temporada.
    // E o amistoso também fica de fora daqui: um jogo-treino pendente deixaria
    // `semCompromissos` falso para sempre.
    const allUserFixtures = seasonCalendarRef.current.fixtures.filter(
      fixture => fixture.isUserMatch && !ehAmistoso(fixture),
    )

    // Mesmo que uma semana tenha sido avançada rapidamente, não permite que o
    // save processe acesso/rebaixamento enquanto a liga do usuário estiver
    // incompleta. Isto impede o caso reportado de rebaixamento após 15 jogos.
    if (isSeasonOver({
      leagueComplete: leagueFixturesComplete,
      currentWeek: newWeek,
      seasonEndWeek,
      userFixtures: allUserFixtures,
    })) {
      // Classificacao final REAL da liga do usuario, derivada dos fixtures — a
      // mesma fonte que a tela mostra.
      //
      // Antes isto lia `serieAStandings` do motor, que e montada a partir de
      // serieATeams. Para QUALQUER clube fora da Serie A a tabela nao continha
      // sequer o time do usuario: findIndex devolvia -1, userFinalPos virava 0 e
      // `userFinalOrder` levava a ordem da Serie A para uma piramide de outra
      // divisao. Resultado: ninguem subia e ninguem caia (relato). A lista do
      // motor fica como reserva para saves em que os fixtures nao rendam tabela.
      const leagueNameNow = getLeagueName(userShort, divOverride)
      const derivedStandings = leagueNameNow
        ? computeStandingsFromFixtures(seasonCalendarRef.current.fixtures, leagueNameNow)
        : []
      const currentStandings = derivedStandings.length
        ? derivedStandings
        : useGameEngine.getState().serieAStandings
      const nextSeason = currentState.season + 1

      // Determina o campeao ANTES de resetar as standings
      const sortedForChampion = [...currentStandings].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        const sgA = a.goalsFor - a.goalsAgainst
        const sgB = b.goalsFor - b.goalsAgainst
        if (sgB !== sgA) return sgB - sgA
        return b.goalsFor - a.goalsFor
      })
      const champion = sortedForChampion[0]?.teamShort ?? null

      // ── ACESSO / REBAIXAMENTO ────────────────────────────────────────────
      // A auditoria mostrou que isto era CALCULADO mas nunca aplicado. Agora a
      // posicao final decide a divisao do clube na proxima temporada, e os adversarios
      // do reset ja vem da divisao nova.
      const userTeamStatic = getTeamByShort(userShort)
      const currentDivision = divOverride ?? (userTeamStatic ? effectiveDivision(userTeamStatic) : null) ?? "serie_a"
      const userFinalPos = sortedForChampion.findIndex(s => s.teamShort === userShort) + 1

      // PIRAMIDE VIVA: evolui TODOS os clubes de todas as piramides. A divisao do
      // usuario sai da classificacao real; as demais, do prestigio com ruido.
      setClubDivisions(currentState.clubDivisions)
      // Inclui os clubes do pool que completam divisões oficiais. Eles antes
      // apareciam na tabela, mas ficavam fora do acesso/rebaixamento.
      const pyramidTeams = new Map<string, { team: Team; division: string }>()
      for (const pyramid of PYRAMIDS) for (const division of pyramid.tiers) {
        for (const team of getTeamsByDivision(division)) {
          pyramidTeams.set(clubDivisionKey(team), { team, division })
        }
      }
      const staticDiv = new Map([...pyramidTeams.entries()].map(
        ([key, { team }]) => [key, initialDivision(team)],
      ))
      const pyramidClubs: PyramidClub[] = [...pyramidTeams.entries()].map(([id, { team: t, division }]) => ({
        id,
        curto: t.curto,
        division,
        prestige: t.prestigio ?? 60,
        promotionEligible: t.promotionEligible,
      }))
      const moved = evolvePyramids({
        clubs: pyramidClubs,
        userDivision: currentDivision,
        userFinalOrder: sortedForChampion.map(s => s.teamShort),
        seed: currentState.season,
      })
      // Mapa absoluto atualizado: aplica quem mudou; limpa quem voltou a estatica.
      const nextClubDivisions: Record<string, string> = { ...(currentState.clubDivisions ?? {}) }
      for (const [clubKey, div] of Object.entries(moved)) {
        const club = pyramidTeams.get(clubKey)?.team
        if (club) delete nextClubDivisions[club.curto]
        if (div === staticDiv.get(clubKey)) delete nextClubDivisions[clubKey]
        else nextClubDivisions[clubKey] = div
      }

      // PREMIACAO DE LIGA (creditada de verdade — antes so aparecia no painel).
      // Campeao leva muito mais; todo mundo leva a cota de participacao. Escala
      // com a divisao (Serie A paga muito mais que a D).
      if (userFinalPos > 0) {
        const premio = leaguePrizeMoney(currentDivision, userFinalPos, sortedForChampion.length)
        if (premio > 0) gameEngine.addClubRevenue(premio)
      }

      // Divisao do usuario na proxima temporada, do MESMO resultado da piramide.
      const userClubKey = userTeamStatic ? clubDivisionKey(userTeamStatic) : userShort
      const userNextDivision = nextClubDivisions[userClubKey]
        ?? nextClubDivisions[userShort]
        ?? (userTeamStatic ? initialDivision(userTeamStatic) : currentDivision)
      let nextDivisionOverride = userNextDivision === userTeamStatic?.divisao ? undefined : userNextDivision
      let divisionMovement = currentState.divisionMovement
      if (userFinalPos > 0 && userNextDivision !== currentDivision) {
        const outcome = resolveDivisionChange(
          currentDivision, userFinalPos, sortedForChampion.length, userTeamStatic?.nome ?? "Seu clube",
        )
        divisionMovement = {
          movement: outcome.movement === "stay"
            ? "promoted" : outcome.movement, // seguranca: mudou de divisao => houve movimento
          message: outcome.message, season: nextSeason,
        }
      }

      // Registro da temporada encerrada.
      //
      // `seasonHistory` era inicializado como [] e NUNCA recebia nada. Tudo que
      // depende dele lia um array vazio para sempre: hall da fama (carreira do
      // técnico), museu do clube, contagem de títulos da bilheteria e os
      // desafios que checam promoção/posição final. A carreira não acumulava
      // história nenhuma entre temporadas.
      const userStanding = sortedForChampion.find(entry => entry.teamShort === userShort)
      const seasonRecord = userStanding && userFinalPos > 0 ? {
        season: currentState.season,
        competition: getLeagueName(userShort, divOverride),
        position: userFinalPos,
        points: userStanding.points,
        won: userStanding.won,
        drawn: userStanding.drawn,
        lost: userStanding.lost,
        goalsFor: userStanding.goalsFor,
        goalsAgainst: userStanding.goalsAgainst,
        champion: champion ?? "",
        managerName: currentState.managerName || "Técnico",
        promoted: divisionMovement?.movement === "promoted" && divisionMovement.season === nextSeason,
        relegated: divisionMovement?.movement === "relegated" && divisionMovement.season === nextSeason,
        teamCurto: userShort,
        teamNome: userTeamStatic?.nome ?? userShort,
      } : null

      // Adversarios da PROXIMA temporada: da divisao ja atualizada E com a
      // piramide nova aplicada (rivais que subiram/cairam ja no lugar certo).
      setClubDivisions(nextClubDivisions)

      // CONTRATO VENCENDO: agora dispara de verdade. Antes o relogio comparava o
      // endDate absoluto com a semana da temporada (que zera), entao nenhum
      // contrato chegava a "expiring" — o aviso nunca saia. Ver absoluteWeek.
      try {
        const elenco = useGameEngine.getState().squadPlayers
        const vencendo = elenco.filter(p => getContractStatus(p, 0, nextSeason) === "expiring")
        const vencidos = elenco.filter(p => getContractStatus(p, 0, nextSeason) === "expired")

        // O ATLETA VAI EMBORA DE VERDADE.
        //
        // Antes daqui só saía a notificação "renove antes de perder o atleta de
        // graça" — e ninguém nunca saía. O elenco carregava contratos vencidos
        // para sempre e o aviso era um blefe: ignorar a renovação não custava
        // nada. Agora o fim de contrato tem a consequência do futebol de
        // verdade, e o técnico teve a temporada inteira de aviso ("expiring" já
        // acende a 6 meses do fim).
        // TRAVA DE ELENCO MÍNIMO. Um save negligenciado pode ter dez contratos
        // vencendo juntos; soltar todos deixaria o clube sem time para escalar e
        // travaria a temporada — quebrar o jogo é pior que a regra realista.
        // A diretoria "renova de emergência" os melhores até fechar 14 atletas;
        // os demais saem. Sair primeiro o pior é o inverso do que um clube faz.
        const MINIMO_DE_ELENCO = 14
        const podeSair = Math.max(0, elenco.length - MINIMO_DE_ELENCO)

        // PRÉ-CONTRATO tem prioridade e NÃO respeita a trava de elenco mínimo:
        // ele já assinou com outro clube, não há como a diretoria segurá-lo. A
        // trava existe para o clube não ficar sem time, e para isso sobram os
        // vencidos comuns e o mercado.
        const assinaramFora = new Set(Object.keys(currentState.preContratos ?? {}))
        const porPreContrato = elenco.filter(p => assinaramFora.has(String(p.id)))
        const vencidosComuns = vencidos.filter(p => !assinaramFora.has(String(p.id)))
        const saemAgora = [
          ...porPreContrato,
          ...[...vencidosComuns]
            .sort((a, b) => a.overall - b.overall)   // os piores vão primeiro
            .slice(0, podeSair),
        ]
        const perdidos = saemAgora.length > 0
          ? useGameEngine.getState().releaseExpiredPlayers(saemAgora.map(p => p.id))
          : []
        // Quem a trava segurou precisa ser RENOVADO DE VERDADE, não só anunciado.
        // Deixar o contrato vencido e dizer que renovou seria a mesma mentira que
        // este conserto veio corrigir — e no ano seguinte o atleta apareceria
        // vencido de novo, sem nunca ter tido contrato.
        const idsQueSairam = new Set(saemAgora.map(p => p.id))

        // Pré-contrato cumprido some do registro. Sem isto o mapa cresceria a
        // cada temporada com atletas que nem estão mais no clube — e um id
        // reaproveitado por uma contratação futura herdaria a marca de alguém
        // que já foi embora.
        if (idsQueSairam.size > 0) {
          const restantes: Record<string, { clube: string; semana: number }> = {}
          for (const [id, dado] of Object.entries(currentState.preContratos ?? {})) {
            if (!idsQueSairam.has(Number(id))) restantes[id] = dado
          }
          setSaveState({ preContratos: restantes })
        }

        // ── PATROCÍNIO: contratos VENCEM e o mercado volta a procurar o clube ──
        //
        // O motor (lib/sponsor-engine) sempre teve `evaluateContract`, `renew` e
        // `contractEnd`, e NADA os consultava. As propostas eram geradas UMA vez
        // — no novo jogo — e nunca mais: aceitas ou recusadas aquelas, nenhum
        // patrocinador aparecia pelo resto da carreira, e os aceitos valiam para
        // sempre. Uma receita eterna que não se renegocia não é patrocínio.
        try {
          const ativosAgora = currentState.activeSponsors ?? []
          const expirados = ativosAgora.filter(s => s.contractEnd <= currentState.season)
          const seguem = ativosAgora.filter(s => s.contractEnd > currentState.season)

          // O diretor de marketing melhora o que chega — é o efeito passivo que
          // a ficha dele promete ("negocia cláusulas mais justas") e que nunca
          // tinha sido ligado às propostas.
          const diretor = useGameEngine.getState().staffMembers?.find(s => s.role === "diretor_marketing")
          const nivelMarketing = diretor ? Math.max(1, Math.min(5, Math.round(diretor.competence / 20))) : 1

          const prestigioAtual = getTeamByShort(currentState.selectedTeamShort ?? "")?.prestigio ?? 50
          const novas = generateOffers(prestigioAtual, nivelMarketing, currentState.season)
          setSaveState({ activeSponsors: seguem, sponsorOffers: novas })

          if (expirados.length > 0) {
            addNotificationRef.current({
              type: "system", priority: "high",
              title: `${expirados.length} patrocínio${expirados.length === 1 ? "" : "s"} chegou ao fim`,
              message: `${expirados.map(s => s.name).join(", ")}. `
                + "A receita mensal caiu — há novas propostas na mesa para repor.",
              href: "/mensagens",
            })
          } else if (novas.length > 0) {
            addNotificationRef.current({
              type: "system", priority: "medium",
              title: `${novas.length} proposta${novas.length === 1 ? "" : "s"} de patrocínio`,
              message: "Empresas procuraram o clube para a nova temporada. Dá para negociar valor e duração.",
              href: "/mensagens",
            })
          }
        } catch { /* patrocinio nunca pode travar a virada de temporada */ }

        const segurados = vencidos.filter(p => !idsQueSairam.has(p.id))
        for (const p of segurados) {
          useGameEngine.getState().renewContract(p.id, p.contract?.salary ?? 0, 52)
        }
        if (segurados.length > 0) {
          addNotificationRef.current({
            type: "system", priority: "high",
            title: `A diretoria renovou ${segurados.length} contrato${segurados.length === 1 ? "" : "s"} de emergência`,
            message: `${segurados.slice(0, 3).map(p => p.name).join(", ")}${segurados.length > 3 ? " e outros" : ""}`
              + " — o elenco ficaria pequeno demais para competir. Foi renovação forçada por um ano, não planejamento.",
            href: "/contratos",
          })
        }

        if (perdidos.length > 0) {
          const lista = perdidos.slice(0, 4).join(", ")
          addNotificationRef.current({
            type: "system", priority: "high",
            title: `${perdidos.length} atleta${perdidos.length === 1 ? "" : "s"} saiu por fim de contrato`,
            message: `${lista}${perdidos.length > 4 ? " e outros" : ""} deixaram o clube de graça. `
              + `A folha aliviou, mas o elenco encolheu.`,
            href: "/elenco",
          })
        }
        if (vencendo.length > 0) {
          const nomes = vencendo.slice(0, 4).map(p => p.name).join(", ")
          addNotificationRef.current({
            type: "system", priority: "high",
            title: `${vencendo.length} contrato${vencendo.length === 1 ? "" : "s"} perto do fim`,
            message: `${nomes}${vencendo.length > 4 ? " e outros" : ""}. Renove agora — no fim da temporada eles saem de graça.`,
            href: "/contratos",
          })
        }
      } catch { /* aviso e extra */ }

      // UNIVERSO 286: fecha estatísticas/contratos de TODAS as ligas, envelhece
      // cada atleta e abre a janela com IA orientada por carência e orçamento.
      // O antigo mercado escolhia apenas "clube maior compra craque de menor";
      // agora há encaixe por setor/estilo, folha e compradores concorrentes.
      let universo286 = currentState.universo286 ?? semearUniverso286(currentState.season, userShort)
      try {
        const avancado = avancarUniverso286(universo286, {
          temporada: nextSeason,
          semana: 0,
          janelaAberta: true,
          quantidadeNegocios: Math.max(8, negociosPorQuinzena282(normalizarGestao282(currentState.gestao282).modoDeMundo) * 5),
        })
        universo286 = avancado.estado
        definirUniversoAtivo286(universo286)
        publicarNegociosDoUniverso(avancado.novosNegocios)
        if (avancado.novosNegocios.length > 0) {
          const destaque = avancado.novosNegocios.slice(0, 3).map(n => `${n.jogador} (${n.de} → ${n.para})`).join("; ")
          addNotificationRef.current({
            type: "transfer", priority: "medium",
            title: `Mercado movimentado: ${avancado.novosNegocios.length} transferências`,
            message: `A janela mexeu com os elencos rivais. Destaques: ${destaque}.`,
            href: "/mercado",
          })
        }
      } catch { /* o mercado do mundo e um extra: nunca derruba a virada de temporada */ }
      const teamsForReset = getUserLeagueTeams(userShort, nextDivisionOverride)
      const newStandings = initializeStandings(teamsForReset)

      // Prêmios individuais — apurados ANTES do processSeasonEnd, que zera as
      // estatísticas da temporada e faz aposentadorias.
      const squadForAwards = useGameEngine.getState().squadPlayers
      const criasNoProfissional = squadForAwards.filter(player => player.criaDaBase)
      const graduadosNestaTemporada = criasNoProfissional.filter(player => player.joinedClubSeason === currentState.season)
      const potenciaisDaBase = (currentState.youthPlayers ?? []).map(player => player.potential ?? player.overall)
      const registroAcademia291 = registrarTemporadaAcademia291({
        season: currentState.season,
        clube: userTeamStatic?.nome ?? userShort,
        nivel: useGameEngine.getState().clubInfrastructure?.youth ?? 1,
        graduados: graduadosNestaTemporada.length,
        minutosDeJovens: criasNoProfissional.reduce((total, player) => total + (player.seasonStats?.minutesPlayed ?? 0), 0),
        mediaPotencial: potenciaisDaBase.length
          ? potenciaisDaBase.reduce((total, value) => total + value, 0) / potenciaisDaBase.length
          : 0,
      })
      const gestaoNaVirada291 = normalizarGestao282(currentState.gestao282)
      const gestaoComAcademia291 = {
        ...gestaoNaVirada291,
        historicoAcademia291: [
          registroAcademia291,
          ...gestaoNaVirada291.historicoAcademia291.filter(item => item.season !== currentState.season),
        ].slice(0, 30),
      }
      const seasonAwards = champion ? calcSeasonAwards(
        currentState.season,
        getLeagueName(userShort, divOverride),
        champion,
        currentState.managerName || "Técnico",
        squadForAwards.map(player => ({
          playerId: player.id,
          playerName: player.name,
          teamShort: userShort,
          position: player.position,
          age: player.age,
          overall: player.overall,
          goals: player.seasonStats?.goals ?? 0,
          assists: player.seasonStats?.assists ?? 0,
          matches: player.seasonStats?.matchesPlayed ?? 0,
          cleanSheets: player.seasonStats?.cleanSheets ?? 0,
        })),
      ) : null

      // ─── PRESTÍGIO: O FEITO VIRA REPUTAÇÃO ─────────────────────────────────
      //
      // Os prêmios acima já eram calculados e iam para um histórico que ninguém
      // lia — nenhum deles mudava nada no atleta. Aqui a Bola de Ouro, a
      // artilharia e o título viram pontos, e os pontos viram Estrela e Top
      // Mundial (lib/prestigio-do-atleta.ts).
      //
      // ⚠️ Prestígio NÃO mexe no overall. Ele muda valor de mercado, salário
      // pedido, procura do mercado e o que o jogo já sabe do atleta sem olheiro
      // — nunca a força dele em campo. Um 89 pode ser Top Mundial e um 90 não.
      const feitosDaTemporada: FeitoDaTemporada[] = []
      for (const vencedor of seasonAwards?.winners ?? []) {
        if (vencedor.playerId != null) feitosDaTemporada.push({ playerId: vencedor.playerId, feito: vencedor.award })
      }
      for (const escolhido of seasonAwards?.teamOfTheSeason ?? []) {
        if (escolhido.playerId != null) feitosDaTemporada.push({ playerId: escolhido.playerId, feito: "selecao_do_campeonato" })
      }
      // O título é do elenco inteiro que jogou, não só de quem levou prêmio.
      // (`ganhouALiga` só é declarado adiante, depois do processSeasonEnd — a
      // condição é a mesma, calculada aqui para não reordenar aquele bloco.)
      if (champion != null && champion === userShort) {
        for (const atleta of squadForAwards) {
          if ((atleta.seasonStats?.matchesPlayed ?? 0) >= 10) {
            feitosDaTemporada.push({ playerId: atleta.id, feito: "titulo_nacional" })
          }
        }
      }
      const prestigioAntes = currentState.prestigioDosAtletas
      const prestigioDepois = virarTemporada(prestigioAntes, feitosDaTemporada)
      for (const promocao of promocoesDePrestigio(prestigioAntes, prestigioDepois)) {
        const atleta = squadForAwards.find(p => p.id === promocao.playerId)
        if (!atleta) continue
        addNotificationRef.current({
          type: "achievement", priority: "high",
          title: `${atleta.name} agora é ${ROTULO_DO_PRESTIGIO[promocao.para]}`,
          message: promocao.para === "top_mundial"
            ? `O que ele fez em campo o colocou entre os nomes que o mundo inteiro conhece. Espere procura — e salário — de outro patamar.`
            : `A temporada dele virou reputação: o mercado passa a tratá-lo como craque, e ele sabe disso.`,
          href: "/elenco",
        })
      }

      // Processa fim de temporada: envelhece jogadores, aposentadorias, jovens da base, reseta standings
      gameEngine.processSeasonEnd(nextSeason, newStandings, currentStandings, {
        antes: prestigioAntes, depois: prestigioDepois,
      })

      // O TITULO DA LIGA tambem conta para a reputacao do tecnico
      // (coachTotalTitles) — mesmo motivo do titulo de copa: e o que abre as
      // propostas de clube e de selecao. So quando o usuario foi o campeao.
      const ganhouALiga = champion != null && champion === userShort

      // ─── A TORCIDA SENTE A TEMPORADA ───────────────────────────────────────
      //
      // Antes SO jogo em casa mexia na torcida (fanBaseGrowth), e pouco: dava
      // para ganhar a liga e a massa nao mudar de tamanho. Aqui entram os feitos
      // da temporada — que e o que faz uma carreira longa ter efeito visivel.
      const conquistas: ConquistaDaTemporada[] = []
      if (ganhouALiga) conquistas.push("titulo_nacional")
      if (divisionMovement?.season === nextSeason) {
        if (divisionMovement.movement === "promoted") conquistas.push("acesso")
        else if (divisionMovement.movement === "relegated") conquistas.push("rebaixamento")
      }
      // Sem titulo e na metade de baixo: temporada esquecivel, torcedor de
      // ocasiao se afasta.
      if (!conquistas.length && userFinalPos > sortedForChampion.length / 2) {
        conquistas.push("temporada_fraca")
      }

      const torcidaAntes = currentState.fanBase
        ?? userTeamStatic?.torcida
        ?? 50_000
      const { torcida: torcidaDepois } = torcidaAposTemporada(torcidaAntes, conquistas)
      const organizadasDepois = humorDasOrganizadas(
        currentState.torcidaOrganizadas?.length
          ? currentState.torcidaOrganizadas
          : organizadasDoClube(userShort, torcidaAntes),
        {
          vitorias: userStanding?.won ?? 0,
          derrotas: userStanding?.lost ?? 0,
          conquistas,
        },
      )

      // ─── MODO DESAFIOS: A HORA DA VERDADE ─────────────────────────────────
      //
      // `evaluateChallenge` existia desde a 1.0.? e NUNCA foi chamada por
      // ninguém — o progresso do desafio ficava congelado no estado em que
      // nasceu, nenhuma meta era cumprida e o prazo nunca estourava. É aqui que
      // ela cabe: DEPOIS de `seasonRecord` existir, porque metade das metas lê
      // exatamente esse registro (posição final, acesso, título).
      //
      // O prêmio em dinheiro entra pelo MOTOR (`addClubRevenue`), não pelo
      // `balance` do save: o caixa que as telas mostram é o do motor.
      let desafioPatch: Partial<GameState> = {}
      const desafioEmCurso = currentState.activeChallenge
      if (desafioEmCurso && !desafioEmCurso.completed && !desafioEmCurso.failed) {
        const registrosDaTemporada = [
          ...(currentState.seasonHistory ?? []).filter(r => r.season === currentState.season),
          ...(seasonRecord ? [seasonRecord] : []),
        ]
        const elencoAtual = useGameEngine.getState().squadPlayers
        const desafioDepois = evaluateChallenge(desafioEmCurso, {
          season: currentState.season,
          registrosDaTemporada,
          transfers: currentState.transfers ?? [],
          idadesDoElenco: elencoAtual.map(p => p.age),
          saldo: useGameEngine.getState().balance,
        })
        const premio = claimReward(desafioDepois, currentState)
        if (premio) {
          desafioPatch = premio.patch
          gameEngine.addClubRevenue(premio.premioEmCaixa)
        } else {
          desafioPatch = { activeChallenge: desafioDepois }
        }
      }

      // ─── O TÉCNICO TAMBÉM FECHA A TEMPORADA ───────────────────────────────
      //
      // Mesmo lugar e mesmo motivo do desafio: `seasonRecord` já existe, e é
      // dele que saem aproveitamento, título, acesso e queda. A trava contra
      // creditar duas vezes está dentro de `evoluirTreinador` (a virada passa
      // por mais de um caminho no jogo). Ver lib/evolucao-do-treinador.ts.
      let crescimentoDoTecnico = currentState.managerGrowth26
      if (currentState.managerProfile26) {
        const jogos = seasonRecord ? seasonRecord.won + seasonRecord.drawn + seasonRecord.lost : 0
        crescimentoDoTecnico = evoluirTreinador(
          currentState.managerProfile26,
          currentState.managerGrowth26,
          {
            season: currentState.season,
            aproveitamento: jogos > 0 && seasonRecord ? seasonRecord.points / (jogos * 3) : 0,
            campeao: Boolean(ganhouALiga),
            promovido: Boolean(seasonRecord?.promoted),
            rebaixado: Boolean(seasonRecord?.relegated),
          },
        )
      }

      const patch = {
        week: 0, season: nextSeason,
        universo286,
        ...(crescimentoDoTecnico ? { managerGrowth26: crescimentoDoTecnico } : {}),
        ...desafioPatch,
        fanBase: torcidaDepois,
        torcidaOrganizadas: organizadasDepois,
        divisionOverride: nextDivisionOverride,
        clubDivisions: nextClubDivisions,
        // A liga da temporada NOVA e recalculada aqui — e so aqui. Congelada no
        // save, ela deixa de mudar quando o jogo for atualizado no meio do ano.
        leagueTeams: teamsForReset.map(time => time.curto),
        divisionMovement,
        completedFixtureKeys: [],
        ...(ganhouALiga ? { coachTotalTitles: (currentState.coachTotalTitles ?? 0) + 1 } : {}),
        seasonAwards: seasonAwards
          ? [...(currentState.seasonAwards ?? []), seasonAwards]
          : currentState.seasonAwards,
        prestigioDosAtletas: prestigioDepois,
        seasonHistory: seasonRecord
          ? [...(currentState.seasonHistory ?? []), seasonRecord]
          : currentState.seasonHistory,
        gestao282: gestaoComAcademia291,
        // COMPETICOES DA SELECAO VOLTAM A SER JOGAVEIS (relato: "com uma selecao
        // no comando nao consigo jogar a Copa do Mundo").
        //
        // `completedThisSeason` — o nome diz "nesta temporada" — era preenchido
        // por `finishCompetition` e NUNCA zerado: nem aqui, nem em lugar nenhum
        // do jogo. A vitrine desabilita o que esta nessa lista
        // (`disabled={done}`), entao cada competicao encerrada sumia PARA O
        // RESTO DA CARREIRA. Quem encerrou a Copa do Mundo uma vez nunca mais
        // conseguia entrar nela — e o mesmo valia para Copa America, Eurocopa e
        // Eliminatorias.
        //
        // O contrato com a selecao atravessa a virada, entao so a lista da
        // temporada e limpa; `completedWindows` fica (a chave dele ja inclui a
        // temporada) e `currentCompetition` tambem, para nao apagar uma
        // competicao em andamento no meio da virada.
        ...(currentState.nationalCareer
          ? { nationalCareer: { ...currentState.nationalCareer, completedThisSeason: [] } }
          : {}),
      }
      saveStateRef.current = { ...currentState, ...patch }
      // Virada de temporada é o momento mais caro de perder: grava direto, sem
      // depender de o React processar a fila (ver o comentário em advanceWeek).
      setSaveState(patch)

      // CERIMONIA DO TITULO DA LIGA. Antes o campeao so era sinalizado quando
      // `newWeek === seasonEndWeek` (mais abaixo, no caminho newSeason:false), o
      // que so coincidia com a ultima rodada na Serie A. Nas demais ligas a
      // temporada fecha aqui por "fixtures completas" e aquele bloco nunca roda —
      // o jogador vira campeao e nao ve nada (relato: Brasileirao/Libertadores/
      // Paulista/"outras ligas"). Este bloco roda para TODA liga, entao gravamos
      // o pending-champion e devolvemos leagueChampion tambem por aqui.
      let leagueChampion: { competition: string; season: string; stats: { won: number; drawn: number; lost: number; goalsFor: number } } | null = null
      if (champion && champion === userShort && userStanding && typeof window !== "undefined") {
        const stats = { won: userStanding.won, drawn: userStanding.drawn, lost: userStanding.lost, goalsFor: userStanding.goalsFor }
        leagueChampion = {
          competition: getLeagueName(userShort, divOverride),
          season: `${currentState.season}/${String(currentState.season + 1).slice(-2)}`,
          stats,
        }
        safeLocalSet("ultrafoot-pending-champion", JSON.stringify({
          competition: leagueChampion.competition,
          season: String(currentState.season),
          type: "league",
          stats,
        }))
      }

      // O MUNDO NOTICIA OS CAMPEOES DELE (1.0.385).
      //
      // ⚠️ SEM ISTO O PALMARES SO EXISTIRIA PARA QUEM ABRISSE A TELA DE
      // HISTORICO — e um mundo que tem campeoes e nunca os anuncia continua
      // parecendo o album de figurinhas que a 1.0.265 tirou daqui. A virada de
      // temporada e o momento em que o resto do planeta fecha a conta junto.
      //
      // A temporada que acabou de fechar JA esta em `seasonHistory` (o patch
      // acima acrescentou o registro), entao o quadro sai com o titulo real do
      // usuario no lugar da derivacao — que e a ordem certa.
      try {
        const historicoAtualizado = seasonRecord
          ? [...(currentState.seasonHistory ?? []), seasonRecord]
          : currentState.seasonHistory
        // A divisao e a que o clube JOGOU na temporada que fecha — o mesmo
        // caminho que `getLeagueRounds` usa mais acima, e nao a divisao para a
        // qual ele acabou de subir ou descer.
        const divisaoDaTemporada = divOverride
          ?? (() => { const tm = getTeamByShort(userShort); return tm ? effectiveDivision(tm) : null })()
          ?? "serie_a"
        const quadro = campeoesDaTemporada(divisaoDaTemporada, currentState.season, {
          historico: historicoAtualizado,
          clubeDoUsuario: userShort,
        }).filter(c => c.clube !== userShort)
        if (quadro.length > 0) {
          addNotificationRef.current({
            type: "system", priority: "low",
            title: `Os campeoes de ${currentState.season}`,
            message: quadro.map(c => `${c.competicao}: ${c.nome}`).join(" · "),
            href: "/historico",
          })
        }
      } catch { /* o quadro de campeoes nunca pode travar a virada de temporada */ }

      return { newSeason: true, champion, leagueChampion, phaseTitle: null }
    }

    // Simula partidas de outros times desta rodada
    const roundFixtures = seasonCalendarRef.current.fixtures.filter(
      f => f.week > currentWeek && f.week <= newWeek && !f.isUserMatch && !f.played
    )

    // Partidas do USUÁRIO que ficaram para trás.
    //
    // Antes só os adversários eram simulados: uma partida do usuário não
    // disputada permanecia pendente para sempre enquanto o resto da liga seguia.
    // O clube acumulava jogos a menos (relato: 15 partidas contra 38 dos rivais)
    // e era rebaixado por pontos que nunca teve chance de somar. A 1.0.98 tentou
    // conter isso travando o fim de temporada até o usuário completar a liga —
    // o que só trocou o rebaixamento indevido por uma carreira presa em
    // "aguardando sorteio", porque as partidas continuavam sem nunca acontecer.
    //
    // `week < newWeek` (estritamente no passado) é intencional: a partida da
    // semana que está começando ainda é do jogador para disputar; só o que ficou
    // para trás é resolvido automaticamente.
    const overdueUserFixtures = selectOverdueUserFixtures(seasonCalendarRef.current.fixtures, newWeek)

    // Atualiza fixtures no gameState para rastreamento de fim de temporada
    const prevFixtures = (saveStateRef.current as unknown as Record<string, unknown>).fixtures as import("@/lib/career-types").MatchFixture[] | undefined ?? []
    let updatedStateFixtures = [...prevFixtures]

    for (const fixture of roundFixtures) {
      const simulated = simulateMatchResult(
        fixture.homeTeam,
        fixture.awayTeam,
        newWeek,
        currentState.season,
        fixture.competition
      )
      const result: MatchResult = {
        ...simulated,
        fixtureKey: getCalendarFixtureKey(fixture, currentState.season),
        fixtureId: fixture.id,
        week: fixture.week,
      }
      // Apenas atualiza standings da liga principal (nao do estadual)
      if (fixture.competitionType === "league") {
        gameEngine.updateStandings(result)
      } else {
        gameEngine.addMatchResultOnly(result)
      }
      // Marca fixture correspondente como jogada no gameState
      const idx = updatedStateFixtures.findIndex(
        f => !f.isUserMatch && f.round === (fixture.round ?? newWeek)
          && f.homeCurto === fixture.homeTeam.curto && f.awayCurto === fixture.awayTeam.curto
      )
      if (idx !== -1) {
        updatedStateFixtures[idx] = {
          ...updatedStateFixtures[idx],
          played: true,
          homeGoals: result.homeScore,
          awayGoals: result.awayScore,
        }
      }
    }

    // Resolve as partidas do usuário que ficaram para trás, pelo mesmo motor que
    // simula os adversários. Sem isto o clube fica com jogos a menos que o resto
    // da liga e a temporada nunca fecha.
    const autoPlayed: string[] = []
    const completedKeysFromAuto: string[] = []
    for (const fixture of overdueUserFixtures) {
      // ⚠️ A PARTIDA DO JOGADOR OUVE O ELENCO DELE. As dos rivais continuam no
      // caminho barato do prestígio: carregar o elenco de todo clube da rodada é
      // o custo que já travou o jogo no apito final. Ver `simulateMatchResult`.
      const simulated = simulateMatchResult(
        fixture.homeTeam,
        fixture.awayTeam,
        fixture.week,
        currentState.season,
        fixture.competition,
        { curto: userShort, xi: useGameEngine.getState().squadPlayers },
      )
      const fixtureKey = getCalendarFixtureKey(fixture, currentState.season)
      // Não reprocessa o que já foi registrado (ex.: partida disputada cujo
      // fixture em memória ainda não recebeu played=true neste tick).
      const already = useGameEngine.getState().matchResults.some(r => r.fixtureKey === fixtureKey)
        || (currentState.completedFixtureKeys ?? []).includes(fixtureKey)
      if (already) continue

      const result: MatchResult = {
        ...simulated,
        fixtureKey,
        fixtureId: fixture.id,
        week: fixture.week,
      }
      if (fixture.competitionType === "league") {
        gameEngine.updateStandings(result)
      } else {
        gameEngine.addMatchResultOnly(result)
      }
      completedKeysFromAuto.push(fixtureKey)
      // Partida do usuario SIMULADA (nao jogada ao vivo): rola a chance de lesao
      // no elenco, para uma temporada simulada nao sair sem nenhuma lesao.
      gameEngine.rolarLesaoSimulada(1)
      // E acumula as estatisticas da temporada (JOGOS/GOLS/ASSIST/cartoes) no XI
      // titular. Sem isto, simular a carreira deixava o perfil de todos zerado.
      const usuarioEmCasa = fixture.homeTeam.curto === (currentState.selectedTeamShort ?? "")
      gameEngine.acumularEstatisticasSimuladas(
        usuarioEmCasa ? result.homeScore : result.awayScore,
        usuarioEmCasa ? result.awayScore : result.homeScore,
      )

      const idx = updatedStateFixtures.findIndex(
        f => f.isUserMatch && !f.played && f.round === (fixture.round ?? fixture.week)
          && f.homeCurto === fixture.homeTeam.curto && f.awayCurto === fixture.awayTeam.curto
      )
      if (idx !== -1) {
        updatedStateFixtures[idx] = {
          ...updatedStateFixtures[idx],
          played: true,
          homeGoals: result.homeScore,
          awayGoals: result.awayScore,
        }
      }

      const userIsHome = fixture.homeTeam.curto === userShort
      const userGoals = userIsHome ? result.homeScore : result.awayScore
      const rivalGoals = userIsHome ? result.awayScore : result.homeScore
      autoPlayed.push(
        `${fixture.homeTeam.curto} ${result.homeScore}x${result.awayScore} ${fixture.awayTeam.curto}` +
        ` (${userGoals > rivalGoals ? "vitória" : userGoals < rivalGoals ? "derrota" : "empate"})`,
      )
    }

    // ── TAÇA GUANABARA: O TÍTULO DA PRIMEIRA FASE DO ESTADUAL ────────────────
    //
    // A Taça Guanabara não é torneio à parte: é o nome que a FERJ dá à fase de
    // grupos do Carioca, e quem lidera a classificação geral ao fim dela leva
    // um título. O jogo já disputava exatamente essa fase (`carioca_a1`: dois
    // grupos de seis, seis rodadas cruzadas), mas ela terminava sem vencedor —
    // só o campeão do mata-mata virava troféu. Quem entrasse nas quartas como
    // líder geral não recebia nada, e o histórico do clube não registrava uma
    // conquista que existe no futebol de verdade.
    //
    // POR QUE AQUI E NÃO EM `registerUserMatchResult`: o líder só está definido
    // depois que os jogos dos ADVERSÁRIOS da última rodada são simulados, e é o
    // laço logo acima que os simula. Emitir no apito da partida do usuário
    // coroaria o líder de uma tabela pela metade — o time que jogou no sábado
    // seria campeão antes do jogo de domingo do rival.
    let tituloDePrimeiraFase: import("@/lib/career-types").SeasonRecord | null = null
    try {
      const nomeDoTitulo = getStateCompetitionRule(userShort)?.firstPhaseTitle
      const userTeamDoEstadual = getTeamByShort(userShort)
      const nomeDoEstadual = ESTADO_CAMPEONATO[userTeamDoEstadual?.estado ?? ""] ?? ""
      // Idempotente pelo mesmo motivo do título de copa: avançar a semana duas
      // vezes não pode render dois troféus.
      const jaRegistrado = (currentState.seasonHistory ?? []).some(
        registro => registro.season === currentState.season && registro.competition === nomeDoTitulo,
      )
      if (nomeDoTitulo && nomeDoEstadual && !jaRegistrado) {
        const hidratado = reconcilePlayedFixtures(
          seasonCalendarRef.current.fixtures,
          useGameEngine.getState().matchResults,
          currentState.season,
          currentState.completedFixtureKeys ?? [],
        )
        const primeiraFase = hidratado.filter(fixture =>
          fixture.competitionType === "state" && fixture.competition === nomeDoEstadual &&
          String(fixture.stage ?? "") === "fase_classificatoria",
        )
        // FASE COMPLETA, não "a minha última rodada acabou": com um só jogo
        // pendente a liderança ainda pode trocar de dono.
        const faseCompleta = primeiraFase.length > 0 && primeiraFase.every(fixture => fixture.played)
        const lider = faseCompleta ? computeStandingsFromFixtures(primeiraFase, nomeDoEstadual)[0] : null
        if (lider && lider.teamShort === userShort) {
          safeLocalSet("ultrafoot-pending-champion", JSON.stringify({
            competition: nomeDoTitulo,
            season: String(currentState.season),
            type: "cup",
            // Este título não sai de uma final: sai da tabela. A cerimônia diz
            // isso em vez de anunciar um agregado ou pênaltis que não houve.
            decidedBy: "classificacao",
            legs: 1,
            stats: { won: lider.won, drawn: lider.drawn, lost: lider.lost, goalsFor: lider.goalsFor },
          }))
          tituloDePrimeiraFase = {
            season: currentState.season,
            competition: nomeDoTitulo,
            position: 1,
            points: lider.points,
            won: lider.won, drawn: lider.drawn, lost: lider.lost,
            goalsFor: lider.goalsFor, goalsAgainst: lider.goalsAgainst,
            champion: userShort,
            managerName: currentState.managerName || "Técnico",
            promoted: false,
            relegated: false,
            teamCurto: userShort,
            teamNome: userTeamDoEstadual?.nome ?? userShort,
          }
        }
      }
    } catch { /* um título de fase nunca pode impedir o avanço da semana */ }

    // Minutos ANTES do avanço: é o que permite saber quem realmente jogou na
    // semana (a adesão aos princípios depende disso). Precisa ser lido de
    // `getState()` e antes de `advanceWeek`, porque o valor de render fica
    // desatualizado dentro deste callback.
    const minutosAntesDaSemana = new Map(
      useGameEngine.getState().squadPlayers.map(p => [p.id, p.seasonStats?.minutesPlayed ?? 0]),
    )

    // Avanca game engine
    gameEngine.advanceWeek()

    // UNIVERSO PERSISTENTE: todas as ligas e atletas da CPU avançam junto com a
    // carreira. A janela é quinzenal, mas partidas, condição, lesões, moral e
    // estatísticas evoluem em TODA semana.
    let universo286 = currentState.universo286 ?? semearUniverso286(currentState.season, userShort)
    try {
      const janelaDoMercado = isTransferWindowOpen(newWeek) && newWeek % 2 === 0
      const avancado = avancarUniverso286(universo286, {
        temporada: currentState.season,
        semana: newWeek,
        janelaAberta: janelaDoMercado,
        quantidadeNegocios: janelaDoMercado
          ? negociosPorQuinzena282(normalizarGestao282(currentState.gestao282).modoDeMundo)
          : 0,
      })
      universo286 = avancado.estado
      definirUniversoAtivo286(universo286)
      publicarNegociosDoUniverso(avancado.novosNegocios)
    } catch { /* o mundo da CPU nunca pode impedir o avanço da carreira */ }

    // ── O EMPRESÁRIO LIGA ────────────────────────────────────────────────────
    //
    // UM pedido por vez, de propósito: três agentes cobrando na mesma semana
    // viram ruído e o técnico passa a fechar tudo sem ler — que é o oposto do
    // efeito pretendido. Enquanto houver pedido sem resposta, ninguém mais liga.
    let relacoesComAgentes = { ...(currentState.relacoesComAgentes ?? {}) }
    let pedidoDeAgente = currentState.pedidoDeAgente ?? null
    if (!pedidoDeAgente) {
      try {
        const elencoAgora = useGameEngine.getState().squadPlayers
        const jogosDoClube = seasonCalendarRef.current.fixtures
          .filter(f => f.isUserMatch && f.played).length
        // Ordena por qualidade: o agente do craque liga antes do agente do reserva.
        const candidatos = [...elencoAgora].sort((a, b) => b.overall - a.overall)
        for (const p of candidatos) {
          const relacao = relacoesComAgentes[String(p.id)] ?? RELACAO_INICIAL
          const atleta = {
            id: p.id, nome: p.name, overall: p.overall, idade: p.age,
            salarioMensal: p.contract?.salary ?? 0,
            valorDeMercado: p.marketValue ?? 0,
            semanasDeContrato: Math.max(0, (p.contract?.endDate ?? 0) - absoluteWeek(currentState.season, newWeek)),
            minutosNaTemporada: p.seasonStats?.minutesPlayed ?? 0,
            jogosDoClube,
            titular: !!p.isStarter,
            moral: p.moralePoints ?? 70,
          }
          const tipo = pedidoDaSemana(atleta, relacao, newWeek)
          if (!tipo) continue
          pedidoDeAgente = montarPedido(atleta, tipo)
          relacoesComAgentes[String(p.id)] = { ...relacao, ultimoPedidoSemana: newWeek }
          addNotificationRef.current({
            type: "system", priority: "medium",
            title: `O empresário de ${p.name} quer conversar`,
            message: pedidoDeAgente.fala,
            href: "/contratos",
          })
          break
        }
      } catch { /* a cobranca do agente nunca pode travar o avanco da semana */ }
    }

    // ── PATROCÍNIO CHEGA DURANTE A TEMPORADA ────────────────────────────────
    //
    // ⚠️ POR QUE ISTO EXISTE (pedido: "implemente propostas de patrocinio,
    // chegando na central de notificacoes").
    //
    // O mercado publicitario so procurava o clube na VIRADA DE TEMPORADA: quem
    // recusasse as propostas de janeiro ficava o ano inteiro sem nenhuma, e a
    // receita de patrocinio virava uma decisao unica tomada antes da primeira
    // rodada. Empresa nao funciona assim — ela procura quem esta em evidencia.
    //
    // A cada 6 semanas, e so quando ha ESPACO (ate 4 contratos ativos), uma nova
    // proposta aparece. A chance sobe com a campanha: lider recebe procura, quem
    // esta na parte de baixo, nao — e e isso que liga a receita ao desempenho.
    try {
      const ativos = currentState.activeSponsors ?? []
      const naMesa = currentState.sponsorOffers ?? []
      const cabeMais = ativos.length < 4 && naMesa.length < 3
      if (cabeMais && newWeek > 0 && newWeek % 6 === 0) {
        const tabelaAgora = useGameEngine.getState().serieAStandings
        const posicaoAtual = tabelaAgora.findIndex(l => l.teamShort === userShort) + 1
        const total = Math.max(1, tabelaAgora.length)
        // Campanha boa atrai; campanha ruim, nem tanto. Nunca zero: clube pequeno
        // tambem fecha patrocinio, so que menos.
        const posicaoRelativa = posicaoAtual > 0 ? 1 - (posicaoAtual - 1) / total : 0.5
        const chance = 0.25 + posicaoRelativa * 0.45
        if (Math.random() < chance) {
          const diretor = useGameEngine.getState().staffMembers?.find(st => st.role === "diretor_marketing")
          const nivelMkt = diretor ? Math.max(1, Math.min(5, Math.round(diretor.competence / 20))) : 1
          const prestigioAtual = getTeamByShort(currentState.selectedTeamShort ?? "")?.prestigio ?? 50
          const nova = generateOffers(prestigioAtual, nivelMkt, currentState.season).slice(0, 1)
          if (nova.length > 0) {
            setSaveState({ sponsorOffers: [...naMesa, ...nova] })
            addNotificationRef.current({
              type: "system", priority: "medium",
              title: `Proposta de patrocínio: ${nova[0].sponsor.name}`,
              message: `${nova[0].sponsor.name} quer estampar a camisa do clube por `
                + `R$ ${nova[0].sponsor.monthlyValue.toLocaleString("pt-BR")}/mês `
                + `em ${nova[0].durationSeasons} temporada(s). Aceite, recuse ou faça contraproposta.`,
              href: "/mensagens",
            })
          }
        }
      }
    } catch { /* patrocinio e receita extra: nunca pode travar o avanco da semana */ }


    // ── CONSEQUÊNCIAS DO DESGASTE ────────────────────────────────────────────
    //
    // Sem isto a relação azedava e não acontecia nada — a ameaça do agente seria
    // um blefe, exatamente como era o aviso de fim de contrato.
    let preContratos = { ...(currentState.preContratos ?? {}) }
    try {
      const elencoAgora = useGameEngine.getState().squadPlayers
      const semanaAbsoluta = absoluteWeek(currentState.season, newWeek)
      for (const p of elencoAgora) {
        const relacao = relacoesComAgentes[String(p.id)]
        if (!relacao || !agenteProcuraOutroClube(relacao)) continue

        // 1) O agente passa a oferecer o atleta. Reusa a lista de transferíveis,
        //    que a geração de propostas da IA já consulta — quem está na lista
        //    entra SEMPRE no mercado. Só lista uma vez.
        if (!(useGameEngine.getState().transferListedIds ?? []).includes(p.id)) {
          useGameEngine.getState().toggleTransferListed(p.id)
          addNotificationRef.current({
            type: "system", priority: "high",
            title: `O empresário de ${p.name} rompeu com o clube`,
            message: "Depois de sucessivas negativas, ele está oferecendo o atleta a outros clubes. Espere sondagens.",
            href: "/mercado",
          })
        }

        // 2) PRÉ-CONTRATO: em fim de contrato, o atleta pode acertar com outro
        //    clube e sair de graça na virada — e aí nem renovar adianta mais.
        if (preContratos[String(p.id)]) continue
        const semanasDeContrato = Math.max(0, (p.contract?.endDate ?? 0) - semanaAbsoluta)
        const risco = chanceDePreContrato({
          id: p.id, nome: p.name, overall: p.overall, idade: p.age,
          salarioMensal: p.contract?.salary ?? 0, valorDeMercado: p.marketValue ?? 0,
          semanasDeContrato, minutosNaTemporada: p.seasonStats?.minutesPlayed ?? 0,
          jogosDoClube: 0, titular: !!p.isStarter, moral: p.moralePoints ?? 70,
        }, relacao)
        if (risco > 0 && Math.random() < risco / 12) {
          // /12 porque o risco é da TEMPORADA, e isto roda toda semana.
          const destino = clubeQueLevaOAtleta(p.overall, currentState.selectedTeamShort ?? "")
          preContratos[String(p.id)] = { clube: destino, semana: newWeek }
          addNotificationRef.current({
            type: "system", priority: "high",
            title: `${p.name} assinou pré-contrato com o ${destino}`,
            message: `Ele acertou com o ${destino} e sai de graça no fim da temporada. `
              + "Renovar já não resolve — a hora de agir era antes.",
            href: "/contratos",
          })
        }
      }
    } catch { /* consequencia e importante, mas nao pode travar a semana */ }

    // Update ref immediately so the next loop iteration sees the incremented week
    let debt=currentState.debt
    let debtByClub={...(currentState.debtByClub??{})}
    let teamMorale=currentState.teamMorale??70
    let boardConfidenceBonus=currentState.boardConfidenceBonus??0
    if(debt?.enabled&&newWeek>=debt.nextPaymentWeek){
      const antesMissed=debt.missedPayments
      const payment=processDebtMonth(debt,useGameEngine.getState().balance);gameEngine.payClubDebt(payment.paid);debt=payment.debt
      // CONSEQUENCIA da inadimplencia (antes missedPayments so era contado, nunca
      // usado): a diretoria pressiona, e ao atrasar a 3a parcela o mercado congela.
      if(debt.missedPayments>antesMissed){
        const consequencia=debtConsequences(debt)
        teamMorale=Math.max(0,teamMorale+consequencia.moraleDelta)
        boardConfidenceBonus=Math.max(-40,boardConfidenceBonus+consequencia.confidenceDelta)
        addNotificationRef.current({
          type:"system",priority:"high",
          title:consequencia.label,
          message:`A parcela não foi quitada integralmente (${debt.missedPayments} atraso(s)). ${consequencia.description} A multa de mora foi incorporada ao saldo devedor.`,
        })
      }else if(debt.missedPayments<antesMissed){
        // Gestão responsável recupera o ambiente aos poucos, assim como limpa
        // um atraso por vez. Não volta a 100 de confiança instantaneamente.
        teamMorale=Math.min(100,teamMorale+2)
        boardConfidenceBonus=Math.min(0,boardConfidenceBonus+2)
      }
    }

    // O clube deixado para trás continua existindo. A nova diretoria reserva
    // caixa conforme porte/prestígio, paga ou atrasa parcelas e pode renegociar.
    // Assim a dívida pertence ao clube durante toda a carreira, mesmo com outro
    // treinador, e estará evoluída caso o usuário volte anos depois.
    for(const [clubShort,arquivada] of Object.entries(debtByClub)){
      if(clubShort===userShort||!arquivada?.enabled||newWeek<arquivada.nextPaymentWeek)continue
      const clube=getTeamByShort(clubShort)
      let gerida=arquivada
      const atrasosAntes=gerida.missedPayments
      // Limite evita loop enorme ao migrar um save antigo muito avançado.
      for(let parcela=0;parcela<3&&gerida.enabled&&newWeek>=gerida.nextPaymentWeek;parcela++){
        const caixa=successorDebtBudget(clube?.saldo??0,clube?.prestigio??50)
        gerida=processDebtMonth(gerida,caixa).debt
      }
      // A administração sucessora reage à crise; renegociar reduz a parcela,
      // mas cobra taxa maior e não apaga os atrasos já acumulados.
      if(gerida.enabled&&gerida.missedPayments>=3&&gerida.missedPayments>atrasosAntes&&gerida.renegotiations<2){
        gerida=renegotiateDebt(gerida)
      }
      debtByClub[clubShort]=gerida
      const cruzouMarco=[3,6,8].some(m=>atrasosAntes<m&&gerida.missedPayments>=m)
      if(cruzouMarco){
        const c=debtConsequences(gerida)
        addNotificationRef.current({type:"news",priority:gerida.missedPayments>=6?"high":"low",title:`Crise financeira no ${clube?.nome??clubShort}`,message:`A gestão que sucedeu você herdou a dívida e chegou a ${gerida.missedPayments} atraso(s). ${c.description}`,href:"/financas"})
      }
    }
    if(newWeek%4===0){const sponsorship=(currentState.activeSponsors??[]).reduce((sum,sponsor)=>sum+sponsor.monthlyValue,0)
      // ANTECIPACAO DO PATROCINADOR CONTRA A DIVIDA.
      //
      // `applySponsorDebtContribution` e o campo `sponsorContributions` existiam
      // no motor de divida desde sempre e NINGUEM os chamava: nenhum centavo de
      // patrocinio jamais abateu o saldo devedor, e o contador ficava zerado
      // para todo mundo. E o unico mecanismo do sistema de dividas que estava
      // escrito e desligado.
      //
      // So acontece com o clube EM ATRASO — que e quando isso acontece na vida
      // real: o patrocinador antecipa parte da cota para segurar o credor, e o
      // dinheiro nao passa pelo caixa (por isso a receita entra ja liquida).
      let aporte=0
      if(debt?.enabled&&debt.missedPayments>0&&sponsorship>0){
        aporte=Math.min(Math.round(sponsorship*.25),debt.principal)
        if(aporte>0){
          debt=applySponsorDebtContribution(debt,aporte)
          addNotificationRef.current({type:"system",priority:"low",title:"Patrocinador antecipou cota",
            message:`Com parcelas em atraso, o patrocinador direcionou R$ ${Math.round(aporte).toLocaleString("pt-BR")} da cota mensal direto para o saldo devedor. O valor não entra no caixa.`,href:"/financas"})
        }
      }
      if(sponsorship-aporte>0)gameEngine.addClubRevenue(sponsorship-aporte);if(currentState.stadiumPitch?.monthlyMaintenance)gameEngine.spendClubFunds(currentState.stadiumPitch.monthlyMaintenance)
      // SÓCIO TORCEDOR. Entra no mesmo ciclo mensal do patrocínio. Existia um
      // `calculateFanRevenue` no game-engine sem nenhum chamador: nenhum real
      // pingava no caixa por sócio. Agora pinga, e o valor ACOMPANHA a carreira
      // — torcida maior e mais satisfeita = quadro social maior.
      // `userTeamStatic` e do bloco de fim de temporada; aqui a busca e propria.
      const torcidaAgora = currentState.fanBase ?? getTeamByShort(userShort)?.torcida ?? 50_000
      const organizadasAgora = currentState.torcidaOrganizadas?.length
        ? currentState.torcidaOrganizadas
        : organizadasDoClube(userShort, torcidaAgora)
      const quadro = quadroDeSocios({
        torcida: torcidaAgora,
        satisfacao: satisfacaoDaTorcida(organizadasAgora),
        plano: currentState.planoDeSocio ?? "padrao",
        // `clubInfrastructure` ainda nao tem chave de marketing; quando tiver,
        // ela entra aqui sozinha. Ate la vale o nivel medio.
        nivelMarketing: useGameEngine.getState().clubInfrastructure?.marketing ?? 2,
      })
      if (quadro.receitaMensal > 0) gameEngine.addClubRevenue(quadro.receitaMensal)
    }
    // RELATÓRIO FINANCEIRO MENSAL na central de notificações (pedido: acompanhar
    // entradas/saídas e dívidas). Também esclarece a dúvida "como pago as dívidas?"
    // — a parcela é quitada AUTOMATICAMENTE do caixa todo mês; dá para renegociar
    // ou amortizar em Finanças.
    if (newWeek % 4 === 0) {
      const eng = useGameEngine.getState()
      const fmt = (v: number) => "R$ " + Math.round(v || 0).toLocaleString("pt-BR")
      const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
      const mesNome = MESES[getGameDate(currentState.season, newWeek).getMonth()]
      const sponsorship = (currentState.activeSponsors ?? []).reduce((s, sp) => s + sp.monthlyValue, 0)
      const rendaMes = (eng.weeklyIncome ?? 0) * 4 + sponsorship
      const gastoMes = (eng.weeklyExpenses ?? 0) * 4 + (currentState.stadiumPitch?.monthlyMaintenance ?? 0)
      const saldo = eng.balance ?? 0
      const resultado = rendaMes - gastoMes
      const deficit = saldo < 0 || resultado < 0
      const alerta = deficit
        ? `\n\n⚠️ ${saldo < 0 ? "Caixa NEGATIVO" : "As saídas superam as entradas"} — corte folha/staff ou aumente a receita para não travar as contratações.`
        : `\n\n📈 Contas equilibradas.`
      const linhaDivida = debt?.enabled
        ? `\n💳 Dívida: ${fmt(debt.principal)} em aberto — parcela ${fmt(debt.monthlyPayment)}/mês é descontada automática do caixa. Renegocie ou amortize em Finanças.`
        : `\n✅ Sem dívidas ativas.`
      addNotificationRef.current({
        type: "system",
        priority: deficit ? "high" : "low",
        title: `📊 Relatório financeiro — ${mesNome}`,
        message:
          `Saldo em caixa: ${fmt(saldo)}\n\n` +
          `▸ Entradas: ~${fmt(rendaMes)}/mês (bilheteria, patrocínio, premiações)\n` +
          `▸ Saídas: ~${fmt(gastoMes)}/mês (salários, staff, manutenção)\n` +
          `▸ Resultado do mês: ${resultado >= 0 ? "+" : "−"}${fmt(Math.abs(resultado))}` +
          alerta + linhaDivida,
      })
    }
    // ── OS CLUBES DA IA REAGEM ────────────────────────────────────────────────
    //
    // `tickAIDecisions` existia desde a fase 38 e devolvia sempre lista vazia —
    // e ninguem o chamava. O motor prometia clubes que entram em crise, mudam de
    // postura e demitem o tecnico; nada disso acontecia. Agora acontece, e
    // acontece ONDE O JOGADOR SENTE: a postura entra na partida dele pelo
    // `posturasDaIA` (ver app/partida/ao-vivo), entao um rival em crise
    // realmente se fecha contra voce.
    const posturasDaIA = { ...(currentState.posturasDaIA ?? {}) }
    const socialDaIA = { ...(currentState.socialDaIA ?? {}) }
    try {
      const formaPorClube = new Map<string, ("W" | "D" | "L")[]>()
      for (const f of updatedStateFixtures) {
        if (!f.played || f.homeGoals == null || f.awayGoals == null) continue
        const registrar = (curto: string, r: "W" | "D" | "L") => {
          const lista = formaPorClube.get(curto) ?? []
          lista.push(r)
          formaPorClube.set(curto, lista.slice(-5))
        }
        registrar(f.homeCurto, f.homeGoals > f.awayGoals ? "W" : f.homeGoals < f.awayGoals ? "L" : "D")
        registrar(f.awayCurto, f.awayGoals > f.homeGoals ? "W" : f.awayGoals < f.homeGoals ? "L" : "D")
      }
      const candidatosIA = [...formaPorClube]
        .filter(([curto]) => curto !== userShort)
        .map(([curto, ultimos]) => {
          const t = getTeamByShort(curto)
          return {
            curto,
            nome: t?.nome ?? curto,
            prestigio: t?.prestigio ?? 60,
            ultimos,
            identidade: (posturasDaIA[curto] === "ofensivo" ? "ofensivo" : posturasDaIA[curto] === "defensivo" ? "retranca" : "posse") as Parameters<typeof decidirReacoesDaIA>[0][number]["identidade"],
          }
        })
      const semanaSocial = absoluteWeek(currentState.season, newWeek)
      for (const candidato of candidatosIA) {
        const anterior = socialDaIA[candidato.curto]
        const evolucao = evolveAIClubSocialState(
          anterior,
          candidato.ultimos,
          semanaSocial,
          candidato.prestigio,
        )
        socialDaIA[candidato.curto] = evolucao.state
      }
      const reacoes: ReacaoDaIA[] = decidirReacoesDaIA(candidatosIA, absoluteWeek(currentState.season, newWeek))
      for (const r of reacoes) {
        posturasDaIA[r.curto] = r.novaIdentidade === "retranca" ? "defensivo" : "ofensivo"
      }
      // Só o que envolve o PRÓXIMO adversário vira notícia — o mundo inteiro
      // mudando de postura toda semana seria ruído na Central.
      const proximo = seasonCalendarRef.current.nextUserMatch
      const adversario = proximo
        ? (proximo.homeTeam.curto === userShort ? proximo.awayTeam.curto : proximo.homeTeam.curto)
        : null
      const doAdversario = reacoes.find(r => r.curto === adversario)
      if (doAdversario) {
        addNotificationRef.current({
          type: "news",
          title: doAdversario.motivo === "crise" ? `${doAdversario.clube} em crise` : `${doAdversario.clube} embalado`,
          message: doAdversario.motivo === "crise"
            ? `Seu próximo adversário vem de uma sequência ruim e deve se fechar atrás${doAdversario.demitiuTecnico ? " — e acabou de trocar de técnico" : ""}.`
            : `Seu próximo adversário vem embalado e deve vir para cima.`,
        })
      }
    } catch { /* reação da IA nunca pode derrubar o avanço de semana */ }

    // ---- A OBRA DO ESTADIO FICA PRONTA ----
    //
    // O motor de setores (lib/stadium-sectors) existia desde 29/07 sem NENHUM
    // consumidor: era o unico da lista de "pronto porem desligado" que nao tinha
    // equivalente vivo em outro lugar. A obra so entrega aqui — os lugares novos
    // entram na capacidade e a bilheteria da proxima partida ja os cobra.
    let estadioSetores = currentState.estadioSetores
    if (estadioSetores?.obra && obraConcluida(estadioSetores.obra, currentState.season, newWeek)) {
      const capacidades = aplicarObra(estadioSetores.capacidades, estadioSetores.obra)
      const lugares = estadioSetores.obra.lugares
      estadioSetores = { ...estadioSetores, capacidades, obra: undefined }
      const total = Object.values(lugares).reduce((t, n) => t + (n ?? 0), 0)
      addNotificationRef.current({
        type: "news",
        title: "Obra do estadio concluida",
        message: `${total.toLocaleString("pt-BR")} lugares novos ja valem na proxima partida em casa.`,
      })
    }

    const scoutingDepartment=currentState.scoutingDepartment
      ?advanceScoutingWeek(
        currentState.scoutingDepartment,
        newWeek,
        currentState.scoutingDepartment.missions.some(mission=>mission.status==="active")
          ?candidatosDoUniversoParaScouting(universo286)
          :[],
      )
      :undefined
    // As chaves das partidas resolvidas automaticamente entram no save junto com
    // a semana: sem isso elas voltariam a ser candidatas na próxima chamada.
    const completedFixtureKeys = completedKeysFromAuto.length > 0
      ? Array.from(new Set([...(currentState.completedFixtureKeys ?? []), ...completedKeysFromAuto]))
      : currentState.completedFixtureKeys
    // Mantém também uma cópia da dívida ativa no arquivo por clube. Isso torna
    // impossível uma troca de treinador perder o saldo entre dois renders.
    if(userShort&&debt)debtByClub[userShort]=debt
    /**
     * CENTRAL DE GESTÃO NA VIRADA DA SEMANA.
     *
     * Metas individuais e adesão ao discurso eram gravadas e nunca reavaliadas:
     * `concluida` e `falhou` jamais viravam `true` e o percentual de adesão era
     * recalculado na tela a cada abertura. Agora a semana fecha as metas
     * vencidas, premia as cumpridas e move a adesão conforme o que o treinador
     * de fato fez — com a consequência caindo na moral do atleta.
     */
    const gestaoAtual = normalizarGestao282(currentState.gestao282)
    // Elenco DEPOIS do avanço, pela mesma razão do snapshot acima.
    const motorAgora = useGameEngine.getState()
    const elencoDaSemana = motorAgora.squadPlayers
    const disciplina = avaliarConduta291(
      gestaoAtual.codigoConduta291,
      elencoDaSemana,
      currentState.season,
      newWeek,
    )
    for (const incidente of disciplina.novos) {
      const punicao = PUNICOES_CONDUTA_291[incidente.punicao]
      if (punicao.moral) motorAgora.ajustarMoralJogador(incidente.playerId, punicao.moral)
      addNotificationRef.current({
        type: "system",
        priority: incidente.tipo === "vermelho" || incidente.tipo === "rede_social" ? "high" : "low",
        title: `Código de conduta: ${incidente.jogador}`,
        message: `${incidente.tipo.replaceAll("_", " ")} — ${punicao.nome}${incidente.multa > 0 ? ` (${incidente.multa.toLocaleString("pt-BR")})` : ""}.`,
        href: "/gestao-avancada?aba=disciplina",
      })
    }
    // Multa disciplinar é descontada do profissional e entra no caixa do clube;
    // tratá-la como despesa punia financeiramente quem aplicava o regulamento.
    if (disciplina.totalMultas > 0) motorAgora.addClubRevenue(disciplina.totalMultas)
    const jogouNaSemana = new Set(
      elencoDaSemana
        .filter(p => (p.seasonStats?.minutesPlayed ?? 0) > (minutosAntesDaSemana.get(p.id) ?? 0))
        .map(p => p.id),
    )

    const metasAvaliadas = avaliarMetas282(gestaoAtual, elencoDaSemana, newWeek)
    for (const meta of metasAvaliadas.concluidas) {
      motorAgora.ajustarMoralJogador(meta.playerId, 2)
      addNotificationRef.current({
        type: "system", priority: "medium",
        title: "Meta cumprida",
        message: `${meta.jogador} bateu a meta de ${meta.alvo} em ${meta.tipo.replaceAll("_", " ")}.`,
        href: "/gestao-avancada",
      })
    }
    for (const meta of metasAvaliadas.falhadas) {
      motorAgora.ajustarMoralJogador(meta.playerId, -1)
      addNotificationRef.current({
        type: "system", priority: "low",
        title: "Meta vencida",
        message: `${meta.jogador} não alcançou a meta de ${meta.alvo} em ${meta.tipo.replaceAll("_", " ")}.`,
        href: "/gestao-avancada",
      })
    }

    const adesaoAvaliada = atualizarAdesao282(gestaoAtual, elencoDaSemana.map(p => ({
      id: p.id,
      age: p.age,
      form: p.form,
      energy: p.energy,
      jogouNaSemana: jogouNaSemana.has(p.id),
    })))
    // A adesão só cobra quando chega ao extremo: o meio da tabela não mexe na
    // moral, senão o vestiário oscilaria toda semana sem o técnico fazer nada.
    for (const id of adesaoAvaliada.contentes) motorAgora.ajustarMoralJogador(id, 1)
    for (const id of adesaoAvaliada.descontentes) motorAgora.ajustarMoralJogador(id, -1)

    const eventosDaGestao: EventoCarreira282[] = [
      ...metasAvaliadas.concluidas.map(m => ({
        id: `meta-ok-${m.id}`, season: currentState.season, week: newWeek, tipo: "elenco" as const,
        titulo: "Meta cumprida", descricao: `${m.jogador} alcançou ${m.alvo} em ${m.tipo.replaceAll("_", " ")}.`,
      })),
      ...metasAvaliadas.falhadas.map(m => ({
        id: `meta-fim-${m.id}`, season: currentState.season, week: newWeek, tipo: "elenco" as const,
        titulo: "Meta vencida", descricao: `${m.jogador} ficou abaixo da meta de ${m.alvo}.`,
      })),
      ...disciplina.novos.map(incidente => ({
        id: `conduta-${incidente.id}`, season: currentState.season, week: newWeek, tipo: "elenco" as const,
        titulo: `Conduta: ${incidente.jogador}`,
        descricao: `${incidente.tipo.replaceAll("_", " ")} — ${PUNICOES_CONDUTA_291[incidente.punicao].nome}.`,
      })),
    ]

    // RELATÓRIOS DA COMISSÃO. A pauta escolhida pelo treinador só fazia sentido
    // se existisse relatório a entregar — e não existia. Agora "resumo na caixa"
    // vira notificação, "na reunião" fica guardado para a Central de Gestão e
    // "ignorar" não gera nada.
    // Primeiro jogo do usuário ainda não disputado. Não dá para filtrar por
    // semana aqui: `MatchFixture.round` é a rodada da competição, não a semana
    // do calendário — numa copa os dois divergem.
    const proximoAdversarioDaSemana = updatedStateFixtures
      .find(f => f.isUserMatch && !f.played)
    const relatorios = relatoriosDaComissao282(gestaoAtual, {
      elenco: elencoDaSemana,
      proximoAdversario: proximoAdversarioDaSemana
        ? (proximoAdversarioDaSemana.homeCurto === userShort
          ? proximoAdversarioDaSemana.awayNome
          : proximoAdversarioDaSemana.homeNome)
        : undefined,
    })
    for (const relatorio of relatorios.filter(r => r.entrega === "resumo")) {
      addNotificationRef.current({
        type: "system", priority: "low",
        title: relatorio.titulo,
        message: relatorio.texto,
        href: "/gestao-avancada",
      })
    }

    const gestao282 = {
      ...gestaoAtual,
      metasIndividuais: metasAvaliadas.metas,
      adesao: adesaoAvaliada.adesao,
      relatoriosComissao: relatorios.filter(r => r.entrega === "reuniao"),
      codigoConduta291: disciplina.codigo,
      linhaDoTempo: eventosDaGestao.length
        ? [...eventosDaGestao, ...gestaoAtual.linhaDoTempo].slice(0, 200)
        : gestaoAtual.linhaDoTempo,
    }

    // ⚠️ A RODADA COMPARTILHADA RECOMEÇA AQUI, e isto não é detalhe: sem zerar
    // os "prontos" da rodada que acabou de rodar, todos continuariam marcados
    // para sempre e a trava do co-op nunca mais fecharia — a partir da segunda
    // rodada o modo viraria de novo um jogo em que qualquer um avança o mundo
    // por cima dos outros. Carreira de um técnico só não grava o campo.
    const tecnicosDaSemana = tecnicosDoSave(
      currentState.tecnicos, currentState.managerName, currentState.selectedTeamShort,
    )
    /**
     * IDENTIDADE TÁTICA: uma semana a mais no estilo que ele de fato usou.
     *
     * ⚠️ Só é gravado quando MUDA de objeto — `registrarSemanaDoTreinador`
     * devolve a mesma referência quando não há estilo, e um save de 22 MB não
     * pode engordar por um contador que não mexeu. Mesma disciplina de
     * `aprenderPosicao`. Ver lib/evolucao-do-treinador.ts.
     */
    const crescimentoDaSemana = currentState.managerProfile26
      ? registrarSemanaDoTreinador(
          currentState.managerGrowth26,
          useGameEngine.getState().teamTactics?.playingStyle,
        )
      : undefined
    const patchDaSemana = { week: newWeek, fixtures: updatedStateFixtures, debt, debtByClub, teamMorale, boardConfidenceBonus, scoutingDepartment, universo286, completedFixtureKeys, relacoesComAgentes, pedidoDeAgente, preContratos, posturasDaIA, socialDaIA, estadioSetores, gestao282,
      ...(crescimentoDaSemana && crescimentoDaSemana !== currentState.managerGrowth26
        ? { managerGrowth26: crescimentoDaSemana } : {}),
      ...(ehMultitecnico(tecnicosDaSemana) ? { rodadaCompartilhada: iniciarRodada(newWeek) } : {}),
      // Título de fase (Taça Guanabara) entra no histórico na MESMA gravação da
      // semana. Pelo mesmo motivo do título de copa, ele conta na reputação do
      // técnico: é o que as propostas de clube e de seleção leem.
      ...(tituloDePrimeiraFase
        ? {
            seasonHistory: [...(currentState.seasonHistory ?? []), tituloDePrimeiraFase],
            coachTotalTitles: (currentState.coachTotalTitles ?? 0) + 1,
          }
        : {}) }
    saveStateRef.current = { ...currentState, ...patchDaSemana } as typeof currentState & { fixtures: unknown }
    // ⚠️ NAO TROQUE ISTO POR `commitGameState` (tentado em 07/08/2026 e
    // REVERTIDO: o office ficava carregando para sempre depois de escolher o
    // time).
    //
    // A intencao era boa — garantir que a semana chegasse ao disco mesmo se a
    // tela desmontasse. Mas `commitGameState` mescla sobre o que esta NO DISCO
    // *agora*, e criar carreira usa `replaceState`, que adia a gravacao para um
    // microtask. Rodando antes dele, o commit reescrevia o save com o estado
    // ANTIGO + o patch: `selectedTeamShort` sumia, `getTeamByShort` devolvia
    // null e `app/page.tsx` ficava preso no `if (!hydrated || !userTeam)`.
    //
    // A durabilidade da simulacao e resolvida pelo `flushPersistentStore()` no
    // fim do laco (app/calendario) e no botao Simular (app/partida) — sem mexer
    // na ordem de gravacao.
    setSaveState(patchDaSemana as Partial<typeof currentState> & { fixtures: unknown })

    // O jogador precisa saber que uma partida dele foi resolvida sem ele.
    if (autoPlayed.length > 0) {
      addNotificationRef.current({
        type: "system",
        title: autoPlayed.length === 1 ? "Partida simulada" : `${autoPlayed.length} partidas simuladas`,
        message: `Você avançou o calendário sem disputar. Resultado: ${autoPlayed.join(" · ")}`,
        priority: "high",
      })
    }

    // Detecta campeao da liga apenas ao final da ultima rodada
    let leagueChampion: { competition: string; season: string; stats: { won: number; drawn: number; lost: number; goalsFor: number } } | null = null
    if (newWeek === seasonEndWeek) {
      const finalStandings = useGameEngine.getState().serieAStandings
      const sorted = [...finalStandings].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        const sgA = a.goalsFor - a.goalsAgainst
        const sgB = b.goalsFor - b.goalsAgainst
        if (sgB !== sgA) return sgB - sgA
        return b.goalsFor - a.goalsFor
      })
      const userEntry = finalStandings.find(s => s.teamShort === userShort)
      if (sorted[0]?.teamShort === userShort && userEntry) {
        leagueChampion = {
          competition: getLeagueName(userShort),
          season: `${currentState.season}/${String(currentState.season + 1).slice(-2)}`,
          stats: {
            won: userEntry.won,
            drawn: userEntry.drawn,
            lost: userEntry.lost,
            goalsFor: userEntry.goalsFor,
          },
        }
      }
    }

    // ── PROPOSTAS DE OUTROS CLUBES ──────────────────────────────────────────
    //
    // BUG que isto corrige: `generateJobOffers()` (lib/board-engine.ts) existia completa
    // e NUNCA era chamada. Codigo morto — nenhum clube jamais procurava o tecnico, por
    // melhor que fosse a campanha, e o ciclo "performar -> ser cortejado -> subir de
    // patamar" nunca fechava.
    //
    // Agora ele roda a cada semana. O proprio motor ja e conservador (so procura quem
    // tem confianca >= 70 e esta no top 6), entao nao vira spam.
    try {
      const st = saveStateRef.current
      const shortNow = st.selectedTeamShort ?? ""
      const teamNow = getTeamByShort(shortNow)
      if (teamNow) {
        const tabela = [...useGameEngine.getState().serieAStandings].sort(
          (a, b) => b.points - a.points,
        )
        const posNow = tabela.findIndex((s) => s.teamShort === shortNow) + 1 || 20

        // Forma recente do usuario (mais recente primeiro), a partir dos resultados dele.
        const recentForm = [...useGameEngine.getState().matchResults]
          // A nova diretoria/temporada não pune o treinador por resultados do
          // ano anterior. Também garante três jogos oficiais antes de avaliar.
          .filter((r) => r.season === st.season)
          .filter((r) => r.homeTeam === shortNow || r.awayTeam === shortNow)
          .slice(-5)
          .reverse()
          .map((r) => {
            const isHome = r.homeTeam === shortNow
            const pro = isHome ? r.homeScore : r.awayScore
            const contra = isHome ? r.awayScore : r.homeScore
            return pro > contra ? "V" : pro === contra ? "E" : "D"
          }) as ("V" | "E" | "D")[]

        const confiancaEsportiva = computeBoardConfidence({
          currentPosition: posNow,
          // calcSeasonObjective so le prestigio/nome/divisao, presentes em Team; cast e seguro.
          objective: calcSeasonObjective(teamNow as unknown as Parameters<typeof calcSeasonObjective>[0]),
          recentForm,
          seasonProgress: Math.min(1, newWeek / Math.max(1, seasonEndWeek)),
          // ⚠️ ESTE E O UNICO PONTO AUTORITATIVO (1.0.377). As outras quatro
          // chamadas de `computeBoardConfidence` sao de TELA — elas mostram o
          // numero, esta aqui e a que decide demissao. A conduta entra aqui
          // porque e aqui que ela precisa mudar alguma coisa.
          conduta: condutaDoTreinador(st.incidentesDoTreinador ?? [], st.season),
        })
        // Crise financeira também é crise de governança: atraso recorrente
        // desgasta a diretoria mesmo quando o resultado em campo ainda é bom.
        const confianca = Math.max(0, Math.min(100, confiancaEsportiva + (st.boardConfidenceBonus ?? 0)))

        // A regra dos paises sem registro (lib/beneficios.ts) tambem vale aqui:
        // sem o codigo, o tecnico dirige clube do Brasil, da Franca ou da Espanha.
        // Sem este filtro a proposta de emprego era a porta dos fundos — bastava
        // aceitar o convite de um clube italiano para furar a regra do menu.
        const semRegistro = !jogoRegistrado()
        const candidatos = allTeams
          .filter((t) => t.curto !== shortNow)
          .filter((t) => !semRegistro || DIVISOES_SEM_REGISTRO.includes(String(t.divisao)))
          .map((t) => ({ curto: t.curto, nome: t.nome, prestigio: t.prestigio ?? 60, divisao: String(t.divisao) }))

        const ofertas = generateJobOffers(
          confianca,
          posNow,
          teamNow.prestigio ?? 60,
          candidatos,
          {
            allowNationalTeam: true,
            experienceSeasons: Math.max(st.coachLegacy.totalSeasons, Math.max(0, st.season - 2026)),
            careerTitles: st.coachTotalTitles + st.coachLegacy.totalTitles,
            currentWeek: newWeek,
            currentDivision: String(st.divisionOverride ?? teamNow.divisao ?? ""),
          },
        )
        if (ofertas.length) addJobOffers(ofertas, st.season, newWeek)

        // ── DEMISSOES NO RESTO DO MUNDO ──────────────────────────────────────
        //
        // As vagas acima saiam do NADA: generateJobOffers escolhia clubes por
        // prestigio, sem ninguem nunca ter sido demitido em lugar nenhum. Agora
        // os outros clubes tambem caem, por campanha ruim, e isso vira noticia.
        //
        // A tabela do usuario e a unica que o jogo simula em detalhe, entao a
        // berlinda sai dela — os clubes que ele enfrenta, que sao os que ele
        // reconhece na noticia.
        const jaDemitidos = st.demissoesMundo ?? []
        const trocasDe = (curto: string) =>
          jaDemitidos.filter(d => d.curto === curto).length
        const naBerlinda = tabela
          .map((linha, i) => {
            const time = getTeamByShort(linha.teamShort)
            if (!time || linha.teamShort === shortNow) return null
            // Sem clube demitido na MESMA temporada: uma queda por ano por clube
            // ja e mais rotatividade do que o futebol tem.
            if (jaDemitidos.some(d => d.curto === linha.teamShort && d.season === st.season)) return null
            const recentes = [...useGameEngine.getState().matchResults]
              .filter(r => r.homeTeam === linha.teamShort || r.awayTeam === linha.teamShort)
              .slice(-5)
            const vitorias = recentes.filter(r => {
              const casa = r.homeTeam === linha.teamShort
              return (casa ? r.homeScore : r.awayScore) > (casa ? r.awayScore : r.homeScore)
            }).length
            // Expectativa a partir do prestigio: quanto maior, mais alto se
            // espera chegar. Prestigio 90 espera ~2o; prestigio 60, ~14o.
            const prest = time.prestigio ?? 60
            const expectativa = Math.max(1, Math.round(tabela.length - (prest - 50) * 0.36))
            return {
              curto: linha.teamShort,
              nome: time.nome,
              tecnico: tecnicoDoClube(linha.teamShort, trocasDe(linha.teamShort)),
              posicao: i + 1,
              totalTimes: tabela.length,
              vitoriasRecentes: vitorias,
              expectativa,
            }
          })
          .filter((c): c is NonNullable<typeof c> => c !== null)

        const quedas = newWeek > 6 ? demissoesDaRodada(naBerlinda) : []
        if (quedas.length) {
          for (const q of quedas) {
            addNotificationRef.current({
              type: "news",
              title: `${q.clubeNome} troca de técnico`,
              message: manchete(q),
              priority: "low",
              href: "/treinador",
            })
          }
          setSaveState({
            demissoesMundo: [
              ...jaDemitidos,
              ...quedas.map(q => ({ curto: q.clubeCurto, season: st.season, week: newWeek, tecnico: q.tecnico })),
            ].slice(-120), // memoria suficiente para varias temporadas
          } as Partial<typeof currentState>)
        }

        // ── DEMISSAO PELA DIRETORIA ──────────────────────────────────────────
        //
        // shouldFireManager (board-engine) existia mas nunca era chamada — por
        // pior que fosse a campanha, o jogo jamais te tirava do clube. Agora a
        // diretoria demite em estado CRITICO (confianca < 25) e, ainda assim,
        // por chance, com mais paciencia no comeco da temporada. Poupamos o
        // comeco absoluto (semana <= 4) para nao demitir antes de o time jogar.
        const progressoTemporada = Math.min(1, newWeek / Math.max(1, seasonEndWeek))
        // A diretoria só reavalia o cargo depois de uma partida OFICIAL do clube.
        // Amistosos de pré-temporada não valem pontos e não podem demitir alguém
        // antes da estreia; antes, qualquer avanço de calendário disparava a regra.
        const jogouOficialNestaSemana = useGameEngine.getState().matchResults.some(r =>
          r.season === currentState.season && r.week === newWeek &&
          (r.homeTeam === shortNow || r.awayTeam === shortNow) &&
          r.competition !== "Amistoso",
        )
        if (jogouOficialNestaSemana && recentForm.length >= 3 && newWeek > 4 && shouldFireManager(confianca, progressoTemporada)) {
          // CASO FERNANDO DINIZ: quem acumula clube + SELEÇÃO não fica sem emprego
          // ao ser demitido do clube — segue no comando da seleção, como na vida
          // real (Diniz seguiu na Seleção Brasileira após sair do Fluminense).
          const selecaoAtual = currentState.nationalCareer?.nationalTeamId
          const selecaoNome = currentState.nationalCareer?.nationalTeamName
          if (selecaoAtual) {
            addNotificationRef.current({
              type: "system",
              title: "Demitido do clube — você segue na seleção",
              message: `A diretoria do ${teamNow.nome} encerrou seu ciclo. Mas, como Fernando Diniz após o Fluminense, você continua no comando da ${selecaoNome ?? "seleção"} e assume a seleção em tempo integral.`,
              priority: "urgent",
            })
            if (typeof window !== "undefined") safeLocalSet("ultrafoot-pending-fired", JSON.stringify({ clube: teamNow.nome, season: currentState.season, continuaSelecao: selecaoNome ?? true }))
            // Sai do clube MAS entra no modo seleção: cai no office da seleção.
            // A passagem é registrada como "fired" mesmo aqui — ele foi demitido
            // do clube; seguir na seleção não apaga isso do histórico.
            encerrarPassagem("fired", {
              teamCurto: userShort, teamNome: teamNow.nome,
              season: currentState.season, week: newWeek,
              passagensAtuais: currentState.passagens,
              setSaveState: (patch) => setSaveState(patch as Partial<typeof currentState>),
              limparClubeNoMotor: () => useGameEngine.getState().limparClubeAtual(),
              dividaAtual: currentState.debt,
              dividasPorClube: currentState.debtByClub,
              patchExtra: { managingNationalTeamId: selecaoAtual },
            })
            if (typeof window !== "undefined") hardNavigate("/")
            return { newSeason: false, simulatedMatches: roundFixtures.length, nextUserMatch: seasonCalendarRef.current.nextUserMatch, leagueChampion: null, phaseTitle: null }
          }
          addNotificationRef.current({
            type: "system",
            title: "Você foi demitido",
            message: `A diretoria do ${teamNow.nome} decidiu encerrar seu ciclo após a sequência de resultados. Você está livre no mercado de treinadores — veja as propostas na Área do Treinador.`,
            priority: "urgent",
          })
          // NAO limpa as ofertas: as propostas de clube ja recebidas continuam
          // valendo, e a Area do Treinador ainda gera o mercado de desempregado.
          // Um flag deixa a demissao INEQUIVOCA na proxima tela (antes o aviso
          // passava batido na simulacao rapida e o jogador "virava" o time de
          // fallback sem entender o que houve).
          if (typeof window !== "undefined") safeLocalSet("ultrafoot-pending-fired", JSON.stringify({ clube: teamNow.nome, season: currentState.season }))
          // Registra a passagem como DEMISSÃO e limpa o clube do motor. Antes só
          // zerava `selectedTeamShort`: o histórico não guardava que você tinha
          // sido demitido, e o elenco/mercado do clube antigo continuavam ativos
          // enquanto você procurava emprego. `encerrarPassagem` NÃO limpa as
          // ofertas de clube aqui — é justamente agora que elas servem.
          encerrarPassagem("fired", {
            teamCurto: userShort, teamNome: teamNow.nome,
            season: currentState.season, week: newWeek,
            passagensAtuais: currentState.passagens,
            setSaveState: (patch) => setSaveState(patch as Partial<typeof currentState>),
            limparClubeNoMotor: () => useGameEngine.getState().limparClubeAtual(),
            dividaAtual: currentState.debt,
            dividasPorClube: currentState.debtByClub,
          })
          if (typeof window !== "undefined") hardNavigate("/treinador")
          // Encerra o avanco: sem clube, nao ha ceremonia de campeao a checar.
          return { newSeason: false, simulatedMatches: roundFixtures.length, nextUserMatch: seasonCalendarRef.current.nextUserMatch, leagueChampion: null, phaseTitle: null }
        }
      }
    } catch {
      // Propostas sao um extra: se algo falhar aqui, o avanco de semana NAO pode quebrar.
    }

    return {
      newSeason: false,
      simulatedMatches: roundFixtures.length,
      nextUserMatch: seasonCalendarRef.current.nextUserMatch,
      leagueChampion,
      // TÍTULO DE FASE (Taça Guanabara) PRECISA DE QUEM O LEVE À CERIMÔNIA.
      // Título de copa é descoberto pela tela da partida logo após o apito; este
      // nasce no avanço da semana, quando não há tela de partida nenhuma para
      // notar o flag. Sem devolvê-lo aqui, o clube ganharia a Taça Guanabara e
      // o jogador seria mandado direto para /partida — o mesmo "ganhou e nem
      // percebeu" que a cerimônia de campeão existe para evitar.
      phaseTitle: tituloDePrimeiraFase?.competition ?? null,
    }
  }, [setSaveState, gameEngine])
  
  // Registra resultado da partida do usuario
  // week+1 porque saveState.week é a rodada anterior — o usuario acabou de jogar a rodada atual (week+1)
  const registerUserMatchResult = useCallback((
    homeTeam: string,
    awayTeam: string,
    homeScore: number,
    awayScore: number,
    events: MatchEvent[],
    /**
     * Placar da disputa de pênaltis, quando o mata-mata empatou e a disputa foi
     * jogada na tela. Não mexe no placar da partida — entra no resultado como
     * dado próprio e é o que decide o classificado adiante.
     */
    penalties?: { home: number; away: number } | null,
    performance?: MatchResult["performance"],
  ) => {
    const currentState = saveStateRef.current
    // Amistoso fora: ele não passa por aqui (o resultado é gravado no save pela
    // própria tela), e deixá-lo na fila permitiria que um placar oficial contra o
    // mesmo adversário fosse atribuído ao jogo-treino pelo fallback de confronto.
    const orderedPending = seasonCalendarRef.current.fixtures
      .filter(fixture => fixture.isUserMatch && !fixture.played && !ehAmistoso(fixture))
      .sort((a, b) => a.week - b.week || a.id - b.id)
    /**
     * A qual confronto do calendario este placar pertence.
     *
     * ⚠️ O fallback era `?? nextUserMatch` INCONDICIONAL, e ele atribuia o placar
     * a um jogo entre OUTROS clubes. Relato: o jogador venceu COR 2x0 SAN e o
     * jogo anunciou "PON 1x1 COR simulada" — o resultado tinha sido gravado sob
     * a chave de PON x COR, entao o confronto real nunca foi marcado como
     * disputado e voltou como pendente para o motor resolver sozinho. O clube
     * aparecia duas vezes na mesma rodada.
     *
     * Agora: par exato, depois o mesmo par invertido (mando trocado), e o
     * fallback so vale se envolver OS MESMOS DOIS CLUBES. Sem isso preferimos
     * uma chave avulsa a atribuir o jogo a quem nao o disputou.
     */
    const mesmoConfronto = (f: { homeTeam: { curto: string }; awayTeam: { curto: string } }) => {
      const par = new Set([f.homeTeam.curto, f.awayTeam.curto])
      return par.has(homeTeam) && par.has(awayTeam)
    }
    const fixtureForWeek =
      orderedPending.find(f => f.homeTeam.curto === homeTeam && f.awayTeam.curto === awayTeam)
      ?? orderedPending.find(mesmoConfronto)
      ?? (seasonCalendarRef.current.nextUserMatch && mesmoConfronto(seasonCalendarRef.current.nextUserMatch)
        ? seasonCalendarRef.current.nextUserMatch
        : null)
    const targetWeek = fixtureForWeek?.week ?? currentState.week + 1
    const fixtureKey = fixtureForWeek
      ? getCalendarFixtureKey(fixtureForWeek, currentState.season)
      : `${currentState.season}::legacy::${targetWeek}::${homeTeam}::${awayTeam}`

    // Guard idempotente por fixture. Semana + clubes não diferencia liga/copa e
    // causava tanto duplo registro quanto bloqueio de uma partida válida.
    const alreadyRegistered = useGameEngine.getState().matchResults.some(
      r => r.fixtureKey === fixtureKey || (
        !r.fixtureKey && r.week === targetWeek && r.season === currentState.season &&
        r.homeTeam === homeTeam && r.awayTeam === awayTeam
      ),
    ) || (currentState.completedFixtureKeys ?? []).includes(fixtureKey)
    if (alreadyRegistered) return

    const leagueName = getLeagueName(currentState.selectedTeamShort ?? "", currentState.divisionOverride)
    const stateRounds = getStateChampRounds(currentState.selectedTeamShort ?? "")
    const userTeamForComp = getTeamByShort(currentState.selectedTeamShort ?? "")

    // Usa a fixture corrente (não week+1) para saber a competição exata.
    const competitionType = fixtureForWeek?.competitionType
      ?? (targetWeek > stateRounds ? "league" : "state")
    const isLeagueMatch = competitionType === "league"

    const fallbackName = isLeagueMatch
      ? leagueName
      : (ESTADO_CAMPEONATO[userTeamForComp?.estado ?? ""] ?? leagueName)
    const competitionName = fixtureForWeek?.competition ?? fallbackName

    const result: MatchResult = {
      fixtureKey,
      fixtureId: fixtureForWeek?.id,
      week: targetWeek,
      season: currentState.season,
      competition: competitionName,
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      events,
      homePenalties: penalties?.home,
      awayPenalties: penalties?.away,
      performance,
    }

    // So atualiza standings da liga principal (nao do estadual/copas/continentais)
    if (isLeagueMatch) {
      gameEngine.updateStandings(result)
    } else {
      gameEngine.addMatchResultOnly(result)
    }

    // === XP e habilidades do treinador ===
    const userShort = currentState.selectedTeamShort ?? ""
    const userIsHome = homeTeam === userShort
    const userScore = userIsHome ? homeScore : awayScore
    const oppScore = userIsHome ? awayScore : homeScore
    const won = userScore > oppScore

    // Título de mata-mata (estadual/copa): a cerimônia de campeão só disparava
    // para a LIGA (leagueChampion no fim de temporada). Relato real: ganhou o
    // Gauchão e "nem percebeu". Regra: esta era a ÚLTIMA partida do usuário
    // nessa competição não-liga e ele venceu → campeão. A página /campeao lê
    // "ultrafoot-pending-champion" (contrato já existente).
    // Registro do titulo de copa (continental/nacional/estadual) e premiacao.
    // Antes a cerimonia era so uma tela: o titulo NAO entrava no seasonHistory,
    // entao nao virava trofeu na carreira, nao dava vaga na Recopa/Supercopa nem
    // classificava para a Libertadores/Champions, e nao rendia premio. Tudo isso
    // lia o seasonHistory, que so tinha a liga. Aqui o titulo passa a existir.
    let cupTitleRecord: import("@/lib/career-types").SeasonRecord | null = null
    if (!isLeagueMatch && typeof window !== "undefined") {
      // A partida precisa ser a FINAL. "Nao restam partidas no calendario" nao
      // basta mais: as fases de mata-mata agora so entram DEPOIS da classificacao,
      // entao logo apos vencer as quartas nao ha semifinal agendada ainda — e o
      // criterio antigo disparava a cerimonia de campeao nas quartas (relato).
      const ehFinal = String(fixtureForWeek?.stage ?? "").toLowerCase() === "final"
      const restantes = seasonCalendarRef.current.fixtures.filter(f =>
        f.isUserMatch && !f.played && f.competition === competitionName &&
        getCalendarFixtureKey(f, currentState.season) !== fixtureKey,
      ).length

      // ── QUEM É O CAMPEÃO: O AGREGADO, NÃO O ÚLTIMO JOGO ──────────────────
      //
      // DOIS BUGS que isto corrige, os dois no mesmo `if (won && ...)` antigo:
      //
      //  1. FINAL DE IDA E VOLTA. Recopa, Copa do Nordeste e a Copa Verde
      //     decidem em dois jogos (`confronto("final", 2)` em cup-bracket).
      //     O título saía de `won` — o placar da PARTIDA. Quem vencia a ida por
      //     3x0 e perdia a volta por 1x0 era campeão no agregado e NÃO ganhava
      //     nada; quem perdia a ida por 4x0 e vencia a volta por 1x0 era
      //     coroado campeão.
      //  2. FINAL EMPATADA. Mata-mata não termina em empate, mas `won` era
      //     falso num 1x1 — a final acabava sem campeão nenhum, a cerimônia
      //     não disparava e a competição ficava sem vencedor no histórico.
      //     Agora o empate no agregado vai aos pênaltis, decididos pelo mesmo
      //     `passouNoConfronto` que já resolve as outras fases (determinístico:
      //     recarregar a tela não muda o resultado).
      const fixturesDaFinal = seasonCalendarRef.current.fixtures.filter(f =>
        f.isUserMatch && f.competition === competitionName &&
        String(f.stage ?? "").toLowerCase() === "final",
      )
      const jogosDaFinal = Math.max(1, fixturesDaFinal.length)
      const idsDaFinal = new Set(fixturesDaFinal.map(f => f.id))
      const placaresDaFinal: PlacarDaCopa[] = useGameEngine.getState().matchResults
        .filter(r => r.season === currentState.season && r.competition === competitionName &&
          (r.fixtureId != null ? idsDaFinal.has(r.fixtureId) : false) &&
          (r.homeTeam === userShort || r.awayTeam === userShort))
        .sort((a, b) => a.week - b.week)
        .map(r => r.homeTeam === userShort
          ? { golsPro: r.homeScore, golsContra: r.awayScore, penaltisPro: r.homePenalties, penaltisContra: r.awayPenalties }
          : { golsPro: r.awayScore, golsContra: r.homeScore, penaltisPro: r.awayPenalties, penaltisContra: r.homePenalties })

      // A FINAL empatada é decidida pela disputa que acabou de acontecer na tela
      // (ou, para finais antigas, pela disputa determinística). Antes o título
      // saía de um cara-ou-coroa e a cerimônia ainda anunciava "decidido nos
      // pênaltis" — uma disputa que nunca existiu.
      const decisaoDaFinal = ehFinal
        ? resultadoDoConfronto(
            placaresDaFinal,
            jogosDaFinal,
            `final:${competitionName}:${currentState.season}:${userShort}`,
            userTeamForComp?.prestigio ?? 70,
            (fixtureForWeek?.homeTeam.curto === userShort
              ? fixtureForWeek?.awayTeam.prestigio
              : fixtureForWeek?.homeTeam.prestigio) ?? 70,
          )
        : { passou: null, penaltis: null }
      const campeao = decisaoDaFinal.passou
      const decidiuNosPenaltis = decisaoDaFinal.penaltis != null

      if (ehFinal && restantes === 0 && campeao === true) {
        safeLocalSet("ultrafoot-pending-champion", JSON.stringify({
          competition: competitionName,
          season: String(currentState.season),
          type: "cup",
          // A cerimônia agora sabe DIZER como o título veio. Um agregado virado
          // na volta ou uma decisão nos pênaltis é a história da conquista.
          decidedBy: decidiuNosPenaltis ? "penaltis" : jogosDaFinal > 1 ? "agregado" : "jogo_unico",
          legs: jogosDaFinal,
          stats: null,
        }))
        // Um registro de copa no seasonHistory: posicao 1 e champion = usuario.
        // Distinto do registro da liga (que entra no fim da temporada) — cada
        // competicao e uma linha. berthsForSeason, o hall da fama e a contagem de
        // titulos passam a enxergar a conquista.
        cupTitleRecord = {
          season: currentState.season,
          competition: competitionName,
          position: 1,
          points: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0,
          champion: userShort,
          managerName: currentState.managerName || "Técnico",
          promoted: false,
          relegated: false,
          teamCurto: userShort,
          teamNome: userTeamForComp?.nome ?? userShort,
        }
        const cupPrize = cupTitlePrize(competitionName)
        if (cupPrize > 0) gameEngine.addClubRevenue(cupPrize)
      }
    }
    const lost = userScore < oppScore

    // === Bilheteria ===
    // Antes a renda de jogo em casa era só uma estimativa exibida em /financas:
    // nada entrava no caixa e as obras do estádio não mudavam nada. Agora cada
    // mando de campo credita a renda real e move a torcida.
    let fanBase = currentState.fanBase ?? userTeamForComp?.torcida ?? 50000
    if (userIsHome && userTeamForComp) {
      const engineState = useGameEngine.getState()
      const resultado = won ? "win" : lost ? "loss" : "draw"
      const { renda, matchday } = bilheteriaDoMando({
        time: userTeamForComp,
        infraestruturaDoEstadio: engineState.clubInfrastructure?.stadium ?? 2,
        torcida: fanBase,
        titulos: countCareerTitles(currentState.seasonHistory, userTeamForComp.curto),
        resultado,
        ehLiga: isLeagueMatch,
        tier: engineState.ticketTier ?? "normal",
        setores: currentState.estadioSetores,
      })
      gameEngine.addClubRevenue(renda)
      fanBase = fanBaseGrowth(fanBase, matchday, resultado, engineState.ticketTier ?? "normal")
    }

    // XP: +10 por jogo, +15 por vitoria, +5 por empate
    const xpGain = 10 + (won ? 15 : userScore === oppScore ? 5 : 0)
    const newXP = currentState.coachXP + xpGain

    // Sequencia de vitorias
    const newStreak = won ? currentState.coachWinStreak + 1 : 0

    // Verifica desbloqueio de habilidades Just-in-Time
    const skillsToUnlock: CoachSkillId[] = []
    const updatedSkills = currentState.coachSkills.map(skill => {
      if (skill.unlocked) return skill
      if (skill.unlockTrigger.type === "win_streak" && newStreak >= skill.unlockTrigger.threshold) {
        skillsToUnlock.push(skill.id)
        return { ...skill, unlocked: true, unlockedSeason: currentState.season }
      }
      return skill
    })

    const completedFixtureKeys = Array.from(new Set([
      ...(currentState.completedFixtureKeys ?? []),
      fixtureKey,
    ]))
    const patch = {
      coachXP: newXP,
      coachWinStreak: newStreak,
      coachSkills: updatedSkills,
      completedFixtureKeys,
      fanBase,
      // Titulo de copa entra no historico ja aqui (a liga entra no fim da
      // temporada). Sem duplicar: o guard idempotente no topo garante um registro.
      // Alem do historico, o titulo CONTA para a reputacao do tecnico
      // (coachTotalTitles) — que e o que as propostas de clube e de selecao leem.
      // Antes so titulo de selecao incrementava isso, entao ganhar Copa do Brasil/
      // Libertadores/estadual nao abria porta nenhuma no mercado de tecnicos.
      ...(cupTitleRecord
        ? {
            seasonHistory: [...(currentState.seasonHistory ?? []), cupTitleRecord],
            coachTotalTitles: (currentState.coachTotalTitles ?? 0) + 1,
          }
        : {}),
    }
    saveStateRef.current = { ...currentState, ...patch }
    lastCompletedFixtureWeekRef.current = targetWeek
    // Mesmo motivo do `advanceWeek` acima: NAO usar `commitGameState` aqui.
    setSaveState(patch)

    // Atualiza o calendário em memória no mesmo tick. Assim advanceWeek e um clique
    // rápido em Continuar já enxergam a próxima partida, sem esperar o React renderizar.
    const updatedFixtures = seasonCalendarRef.current.fixtures.map(fixture =>
      getCalendarFixtureKey(fixture, currentState.season) === fixtureKey
        ? { ...fixture, played: true, homeScore, awayScore }
        : fixture,
    )
    const pending = updatedFixtures
      .filter(fixture => fixture.isUserMatch && !fixture.played)
      .sort((a, b) => a.week - b.week || a.id - b.id)
    const played = updatedFixtures
      .filter(fixture => fixture.isUserMatch && fixture.played)
      .sort((a, b) => a.week - b.week || a.id - b.id)
    seasonCalendarRef.current = {
      ...seasonCalendarRef.current,
      fixtures: updatedFixtures,
      nextUserMatch: pending[0] ?? null,
      previousUserMatch: played.at(-1) ?? fixtureForWeek ?? null,
    }
  }, [gameEngine, setSaveState])
  
  /**
   * Ainda ha partida SUA por disputar nesta semana?
   *
   * Existe por causa das copas em MEIO DE SEMANA: elas entram na MESMA semana da
   * rodada de liga (ver a montagem do calendario), entao uma semana pode ter dois
   * jogos seus. Ao terminar o primeiro, o jogo chamava `advanceWeek()` sozinho —
   * a semana virava, e o segundo jogo (quase sempre o de COPA, porque o de liga e
   * o que aparece como "proxima partida") caia na regra de partida atrasada e era
   * SIMULADO pelo motor. O jogador perdia jogos de Copa do Brasil/Libertadores
   * sem nunca ver a tela deles: "tem hora que simula as partidas sem pedir".
   *
   * Le o REF, nao o estado do render: `registerUserMatchResult` atualiza o
   * calendario em memoria no mesmo tick, entao a partida recem-terminada ja
   * consta como jogada aqui e nao conta como pendente.
   */
  const temPartidaPendenteNaSemana = useCallback(() => {
    const semanaAtual = saveStateRef.current.week
    return seasonCalendarRef.current.fixtures.some(
      fixture => fixture.isUserMatch && !fixture.played && fixture.week <= semanaAtual,
    )
  }, [])

  // Classificacao atual ordenada
  const engineStandings = useMemo(() => {
    return [...gameEngine.serieAStandings].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      const sgA = a.goalsFor - a.goalsAgainst
      const sgB = b.goalsFor - b.goalsAgainst
      if (sgB !== sgA) return sgB - sgA
      return b.goalsFor - a.goalsFor
    })
  }, [gameEngine.serieAStandings])

  // A tabela exibida é sempre reconstituída dos placares persistidos no calendário.
  // `serieAStandings` continua sendo mantida pelo motor por compatibilidade, mas não é
  // mais a fonte visual: isso elimina divergências após carregar save, migrar calendário
  // ou concluir uma partida enquanto o Zustand ainda estava propagando a atualização.
  const leagueCompetition = saveState.selectedTeamShort ? getLeagueName(saveState.selectedTeamShort, saveState.divisionOverride) : ""
  const standings = useMemo(() => {
    const derived = leagueCompetition
      ? computeStandingsFromFixtures(seasonCalendar.fixtures, leagueCompetition)
      : []
    return derived.length ? derived : engineStandings
  }, [engineStandings, leagueCompetition, seasonCalendar.fixtures])
  
  // Competicao que esta sendo disputada agora (ex: "Campeonato Paulista").
  const currentCompetition = useMemo(
    () => seasonCalendar.nextUserMatch?.competition ?? seasonCalendar.previousUserMatch?.competition ?? null,
    [seasonCalendar.nextUserMatch, seasonCalendar.previousUserMatch],
  )
  const currentCompetitionType = useMemo(
    () => seasonCalendar.nextUserMatch?.competitionType ?? seasonCalendar.previousUserMatch?.competitionType ?? "league",
    [seasonCalendar.nextUserMatch, seasonCalendar.previousUserMatch],
  )

  // Tabela do campeonato EM DISPUTA. O engine so mantem a tabela da liga, entao
  // para estadual/copa a tabela e derivada dos fixtures da propria competicao.
  const currentStandings = useMemo(() => {
    if (!currentCompetition) return standings
    const derived = computeStandingsFromFixtures(seasonCalendar.fixtures, currentCompetition)
    return derived.length ? derived : standings
  }, [currentCompetition, currentCompetitionType, seasonCalendar.fixtures, standings])

  // Posicao do usuario na tabela do campeonato em disputa
  const userPosition = useMemo(() => {
    if (!saveState.selectedTeamShort) return 0
    const index = currentStandings.findIndex(s => s.teamShort === saveState.selectedTeamShort)
    return index + 1
  }, [currentStandings, saveState.selectedTeamShort])
  
  // Time do usuario — com a divisao ATUAL (override de acesso/rebaixamento) aplicada, para
  // que TUDO que deriva de userTeam.divisao (copas, competicoes, nome da liga) acompanhe.
  const userTeam = useMemo(() => {
    if (!saveState.selectedTeamShort) return null
    const base = getTeamByShort(saveState.selectedTeamShort)
    if (!base) return null
    return saveState.divisionOverride && saveState.divisionOverride !== base.divisao
      ? { ...base, divisao: saveState.divisionOverride }
      : base
  }, [saveState.selectedTeamShort, saveState.divisionOverride])
  
  // Desbloqueia habilidade do treinador manualmente (crise resolvida, titulo, etc)
  const unlockCoachSkill = useCallback((skillId: CoachSkillId) => {
    const currentState = saveStateRef.current
    setSaveState({
      coachSkills: currentState.coachSkills.map(s =>
        s.id === skillId && !s.unlocked
          ? { ...s, unlocked: true, unlockedSeason: currentState.season }
          : s
      )
    })
  }, [setSaveState])

  // Incrementa contador de crises e verifica desbloqueio de habilidades por crise
  const recordCrisisResolved = useCallback(() => {
    const currentState = saveStateRef.current
    const newCount = currentState.coachCrisisCount + 1
    const updatedSkills = currentState.coachSkills.map(skill => {
      if (skill.unlocked) return skill
      if (skill.unlockTrigger.type === "crisis_resolved" && newCount >= skill.unlockTrigger.threshold) {
        return { ...skill, unlocked: true, unlockedSeason: currentState.season }
      }
      return skill
    })
    setSaveState({ coachCrisisCount: newCount, coachSkills: updatedSkills })
  }, [setSaveState])

  // Salva historico de carreira (chamado quando treinador e demitido ou muda de clube)
  const saveCareerRecord = useCallback((params: {
    teamShort: string, teamName: string, titles: string[],
    bestPosition: number, youthAcademyLevelLeft: number,
    endReason: "demitido" | "aposentado" | "novo_desafio"
  }) => {
    const currentState = saveStateRef.current
    const record = {
      ...params,
      seasons: currentState.season - (currentState.coachLegacy.careerRecords.length > 0
        ? (currentState.coachLegacy.careerRecords[currentState.coachLegacy.careerRecords.length - 1].endedSeason + 1)
        : 2026),
      startedSeason: 2026,
      endedSeason: currentState.season,
    }
    // Habilidades desbloqueadas nessa carreira ficam no legado
    const newLegacySkills = Array.from(new Set([
      ...currentState.coachLegacy.legacySkills,
      ...currentState.coachSkills.filter(s => s.unlocked).map(s => s.id),
    ])) as CoachSkillId[]
    const newRep = Math.min(5, currentState.coachLegacy.reputationLevel + (params.titles.length > 0 ? 1 : 0))
    setSaveState({
      coachLegacy: {
        ...currentState.coachLegacy,
        totalSeasons: currentState.coachLegacy.totalSeasons + record.seasons,
        totalTitles: currentState.coachLegacy.totalTitles + params.titles.length,
        careerRecords: [...currentState.coachLegacy.careerRecords, record],
        legacySkills: newLegacySkills,
        reputationLevel: newRep,
        legacyXP: currentState.coachLegacy.legacyXP + currentState.coachXP,
      }
    })
  }, [setSaveState])

  const league = useMemo(
    () => getTeamByShort(saveState.selectedTeamShort ?? "")?.divisao ?? "serie_a",
    [saveState.selectedTeamShort]
  )

  /**
   * INFORMA AO CALENDARIO QUANTO DURA ESTA TEMPORADA.
   *
   * Sem isto o `getGameDate` avanca 7 dias fixos por rodada, e uma temporada de
   * estadual + liga (ate ~58 rodadas) estoura o ano: a semana 57 caia em
   * 28/jan do ano SEGUINTE com o rotulo ainda na temporada velha. Ver o
   * cabecalho de lib/game-date.
   *
   * A duracao sai das mesmas duas fontes que o fim de temporada usa — estadual
   * e liga —, entao data e regra nao podem divergir.
   */
  useEffect(() => {
    const curto = saveState.selectedTeamShort
    if (!curto) return
    const estadual = getStateChampRounds(curto)
    const daLiga = getLeagueRounds(saveState.divisionOverride ?? league)
    configurarDuracaoDaTemporada(estadual + daLiga)
  }, [saveState.selectedTeamShort, saveState.divisionOverride, league])

  // PAUSA FIFA ATIVA. Na vida real, enquanto a janela de selecoes (data FIFA ou
  // Copa do Mundo) esta aberta, o campeonato de CLUBES para: o tecnico de clube
  // nao joga ate a janela fechar. Aqui detectamos que a pausa esta valendo AGORA —
  // ha um fifa_break entre a semana atual e a proxima partida do clube. Enquanto
  // isso, a UI bloqueia o "jogar" e mostra a janela (Copa do Mundo para acompanhar).
  const fifaPause = useMemo(() => {
    const prox = seasonCalendar.nextUserMatch
    const limite = prox?.week ?? Number.POSITIVE_INFINITY
    // ⚠️ A JANELA NAO ENCOLHE CONFORME AS SEMANAS PASSAM (relato: "nao avanca a
    // proxima rodada, os jogos do time nao desbloqueiam").
    //
    // O filtro era `f.week >= saveState.week`, entao `breaks[0]` — e com ele o
    // `fromWeek` — andava JUNTO com a semana atual. A Central do Mundial calcula
    // a rodada exibida como `currentWeek - fromWeek`, que assim dava **sempre
    // zero**: por mais que se clicasse em "Acompanhar proxima rodada", a tela
    // repetia a Rodada 1 e a Copa parecia travada.
    //
    // Agora a janela e a sequencia CONTIGUA de semanas de pausa que contem a
    // semana atual — o comeco dela nao se move. Continua havendo pausa so
    // enquanto sobrar pelo menos uma semana a cumprir (`pendentes`), entao o
    // desbloqueio dos jogos do clube segue automatico quando a ultima passa.
    const naJanela = seasonCalendar.fixtures
      .filter(f => f.competitionType === "fifa_break" && f.week < limite)
      .sort((a, b) => a.week - b.week)
    const pendentes = naJanela.filter(f => f.week >= saveState.week)
    if (pendentes.length === 0) return null

    // Anda para tras enquanto as semanas forem coladas: e a MESMA pausa.
    const semanas = new Set(naJanela.map(f => f.week))
    let inicio = pendentes[0].week
    while (semanas.has(inicio - 1)) inicio--

    const breaks = naJanela.filter(f => f.week >= inicio)
    if (breaks.length === 0) return null
    // A flag manda. O casamento pelo rótulo fica como rede para saves gerados
    // antes de `worldCup` existir; em ano de Copa, uma pausa de junho com várias
    // semanas só pode ser o Mundial.
    const isWorldCup = breaks.some(b =>
      b.worldCup === true ||
      b.competition === "Copa do Mundo FIFA" ||
      (cyclePhase(saveState.season) === "wc" && b.month === 5 && breaks.length > 1),
    )
    return {
      active: true,
      isWorldCup,
      label: isWorldCup ? "Copa do Mundo FIFA" : (breaks[0].competition ?? "Data FIFA"),
      // Pais(es)-sede da edicao (2026 EUA/CAN/MEX, 2030 ESP/POR/MAR, 2034 Arabia).
      hosts: isWorldCup ? worldCupHosts(saveState.season) : "",
      note: isWorldCup ? worldCupNote(saveState.season) : "",
      fromWeek: breaks[0].week,
      untilWeek: breaks[breaks.length - 1].week + 1,
      // Mes da janela (0 = Janeiro). A Central da Data FIFA precisa dele para
      // saber QUAL janela e — Marco de Eliminatorias nao gera os mesmos jogos
      // que Setembro da Liga das Nacoes.
      month: breaks[0].month,
    }
  }, [seasonCalendar.fixtures, seasonCalendar.nextUserMatch, saveState.week, saveState.season])

  // Avanca as semanas da janela FIFA de uma vez, ate o clube voltar a ter jogo.
  const advancePastFifaBreak = useCallback(async () => {
    let guard = 0
    while (guard++ < 24) {
      const fixtures = seasonCalendarRef.current.fixtures
      const wk = saveStateRef.current.week
      const prox = seasonCalendarRef.current.nextUserMatch
      const limite = prox?.week ?? Number.POSITIVE_INFINITY
      const temBreak = fixtures.some(f => f.competitionType === "fifa_break" && f.week >= wk && f.week < limite)
      if (!temBreak) break
      await advanceWeek()
    }
  }, [advanceWeek])

  return {
    // Estado
    hydrated,
    userTeam,
    userPosition,
    standings,
    fifaPause,
    advancePastFifaBreak,
    // Tabela + nome do campeonato que esta sendo disputado (estadual, liga, copa...)
    currentStandings,
    currentCompetition,
    currentCompetitionType,
    seasonCalendar,
    temPartidaPendenteNaSemana,
    currentWeek: saveState.week,
    currentSeason: saveState.season,

    // Convenências derivadas (usadas por /partida e /partida/ao-vivo)
    league,
    currentMatch: seasonCalendar.nextUserMatch ?? null,
    currentRound: seasonCalendar.currentRound,

    // Game Engine direto
    gameEngine,

    // Acoes
    initializeNewGame,
    trocarTecnicoAtivo,
    fecharDecisoesEPassarAVez,
    reabrirMinhasDecisoes,
    advanceWeek,
    registerUserMatchResult,
    unlockCoachSkill,
    recordCrisisResolved,
    saveCareerRecord,

    // Save state
    saveState,
    setSaveState
  }
}

// Hook para obter proxima partida do usuario
export function useNextMatch() {
  const { seasonCalendar, userTeam } = useGameManager()
  return {
    nextMatch: seasonCalendar.nextUserMatch,
    userTeam
  }
}

// Hook para obter classificacao com destaques
export function useStandings() {
  const { standings, userPosition, userTeam } = useGameManager()
  
  return {
    standings: standings.map((entry, index) => ({
      ...entry,
      position: index + 1,
      team: getTeamByShort(entry.teamShort),
      isUserTeam: entry.teamShort === userTeam?.curto,
      zone: index < 4 ? "libertadores" : 
            index < 6 ? "sulamericana" : 
            index < 12 ? "meio" : 
            index < 16 ? "danger" : "rebaixamento"
    })),
    userPosition,
    userTeam
  }
}

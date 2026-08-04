// Hook que gerencia as propostas de selecao, a aceitacao e as competicoes
// internacionais de selecao (Copa America, Eurocopa, Liga das Nacoes,
// Eliminatorias e Copa do Mundo). Tudo persistido no save offline.

"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import { useGameState, commitGameState, type NationalOffer, DEFAULT_NATIONAL_CAREER } from "@/lib/save-system"
import {
  getAllNationalTeams,
  getNationalTeamById,
  getAllNationalStrengths,
  getNationalSquad,
  getNationalStrength,
  type NationalTeam,
} from "@/lib/national-teams"
import {
  getCompetitionsForConfederation,
  getCompetitionDef,
  createNationalCompetition,
  advanceNationalRound,
  getUserNextFixture,
  type NationalCompetitionDef,
} from "@/lib/national-competitions"
import { cyclePhase } from "@/lib/national-windows"
import { useGameEngine } from "@/lib/game-engine"

// Piso de reputacao para receber convite de SELECAO. Baixo de proposito: uma
// selecao FRACA (ranking baixo) chama ate um tecnico modesto — como na vida real.
// O buildOffers ja escala a FORCA da selecao pelo score (desiredMax = 62 + score*2),
// entao score baixo -> so selecoes fracas; as fortes exigem score alto (titulos +
// aproveitamento + XP). Era 6 e, na pratica, quase ninguem recebia convite
// (relato: "nunca vem proposta de selecao, nem pequena"). 2 abre as pequenas.
const MIN_SCORE_FOR_OFFERS = 2
// QUANDO chega o convite de selecao.
//
// ⚠️ MUDOU NA 1.0.231. Antes o convite chegava DEPOIS da data FIFA de junho
// (semana 24 ~ 11 de junho), com o raciocinio de que o carrossel de tecnicos
// acontece apos os grandes torneios. Na pratica isso deixava o tecnico aceitar
// uma selecao e ficar MESES sem nada para fazer: a janela em que ele comandaria
// a equipe tinha acabado de passar.
//
// Agora o convite chega ANTES da data FIFA — quem aceita ja assume a tempo de
// dirigir a selecao naquela janela, que e o ponto de aceitar. As semanas saem da
// data real (temporada comeca em 01/01 e cada rodada avanca 7 dias), e nao de
// numeros soltos: `primeiraSemanaDoMes` mantem isso valido se o calendario mudar.

/** Semana em que um mes (0-indexed) comeca. Ver lib/game-date: 1 rodada = 7 dias. */
function primeiraSemanaDoMes(mes: number): number {
  const diasAteOMes = Math.round(
    (new Date(2026, mes, 1).getTime() - new Date(2026, 0, 1).getTime()) / 86_400_000,
  )
  return Math.floor(diasAteOMes / 7) + 1
}

// A primeira janela FIFA relevante do ano-calendario do jogo e a de JUNHO (mes 5),
// que e quando cai a Copa do Mundo / Copa America / Eurocopa.
const PRIMEIRA_JANELA_FIFA = primeiraSemanaDoMes(5)   // ~semana 23 (04/06)
// Abre cinco semanas antes: da tempo de negociar, recusar e receber outra.
const OFFER_START_WEEK = Math.max(1, PRIMEIRA_JANELA_FIFA - 5)      // ~18 (30/04)
// E esta na mesa antes de a janela comecar, nunca depois.
const OFFER_GUARANTEE_WEEK = Math.max(1, PRIMEIRA_JANELA_FIFA - 1)  // ~22 (28/05)
// Quantos convites por temporada, conforme o ANO do ciclo: em ano de Copa do
// Mundo (2026, 2030) e de torneio continental (2028) MUITAS selecoes trocam de
// tecnico -> ate 3 convites, incluindo as mais fortes. Em ano "comum" abrem
// menos vagas -> 1 a 2.
const MAX_OFFERS_TOURNAMENT = 3
const MAX_OFFERS_OFFYEAR = 2

// Pontuacao de reputacao do treinador. Antes so titulos + reputacao + XP. Agora
// VITORIAS e APROVEITAMENTO tambem pesam (pedido): quem ganha muito e/ou tem bom
// aproveitamento e cortejado mesmo sem muitos titulos. Como o score eleva o teto
// de forca em buildOffers, aproveitamento alto abre selecoes fortes; um registro
// so mediano ainda rende convite de selecoes mais fracas — "boas ou nao".
//
// Titulos de estadual/copa JA entram aqui porque passaram a incrementar
// coachTotalTitles no motor (fim de temporada / final de copa).
export function computeCoachScore(
  state: {
    coachTotalTitles?: number
    coachXP?: number
    coachLegacy?: { totalTitles?: number; reputationLevel?: number; legacyXP?: number }
    seasonHistory?: { won?: number; drawn?: number; lost?: number }[]
  },
  // Registro da temporada CORRENTE (ainda nao fechada no seasonHistory). Sem ele,
  // no 1o ano — quando as propostas chegam (semana 24-30) — nao haveria vitoria
  // nenhuma contabilizada e o tecnico ficava invisivel apesar da boa campanha.
  currentRecord?: { won: number; drawn: number; lost: number },
): number {
  const titles = (state.coachTotalTitles ?? 0) + (state.coachLegacy?.totalTitles ?? 0)
  const rep = state.coachLegacy?.reputationLevel ?? 0
  const xp = (state.coachXP ?? 0) + (state.coachLegacy?.legacyXP ?? 0)

  let won = currentRecord?.won ?? 0
  let drawn = currentRecord?.drawn ?? 0
  let lost = currentRecord?.lost ?? 0
  for (const r of state.seasonHistory ?? []) {
    won += r.won ?? 0; drawn += r.drawn ?? 0; lost += r.lost ?? 0
  }
  const games = won + drawn + lost
  // Aproveitamento = pontos ganhos / pontos possiveis (metrica classica do futebol).
  const aproveitamento = games > 0 ? (won * 3 + drawn) / (games * 3) : 0
  const winBonus =
    Math.floor(won / 10) +
    (aproveitamento >= 0.66 ? 5 : aproveitamento >= 0.55 ? 3 : aproveitamento >= 0.45 ? 1 : 0)

  return titles * 3 + rep * 3 + Math.floor(xp / 250) + winBonus
}

function makeRng(seedStr: string): () => number {
  let h = 1779033703 ^ seedStr.length
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let state = h >>> 0
  return () => {
    state = Math.imul(state ^ (state >>> 15), state | 1) >>> 0
    let t = (state + 0x6d2b79f5) >>> 0
    t = Math.imul(t ^ (t >>> 7), t | 61)
    t ^= t + Math.imul(t ^ (t >>> 14), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Gera propostas com base na reputacao: quanto maior o score, mais fortes as selecoes.
function buildOffers(score: number, declined: string[], season: number, week: number, seed: string, maxOffers: number): NationalOffer[] {
  const strengths = getAllNationalStrengths()
  const desiredMax = Math.min(95, 62 + score * 2)
  let desiredMin = desiredMax - 18

  const eligible = (min: number) =>
    getAllNationalTeams().filter(nt => {
      if (declined.includes(nt.id)) return false
      const s = strengths[nt.id] ?? 60
      return s <= desiredMax + 2 && s >= min
    })

  let candidates = eligible(desiredMin)
  // Relaxa o piso ate ter candidatos suficientes
  while (candidates.length < 1 && desiredMin > 40) {
    desiredMin -= 8
    candidates = eligible(desiredMin)
  }
  if (candidates.length === 0) return []

  const rng = makeRng(seed)
  // embaralha priorizando variedade de confederacoes
  const shuffled = [...candidates]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const chosen: NationalTeam[] = []
  const confsUsed = new Set<string>()
  for (const nt of shuffled) {
    if (chosen.length >= maxOffers) break
    if (confsUsed.has(nt.confederation) && chosen.length < shuffled.length) {
      // tenta variar confederacao primeiro
      continue
    }
    chosen.push(nt)
    confsUsed.add(nt.confederation)
  }
  // completa caso a variacao tenha limitado demais
  if (chosen.length < Math.min(maxOffers, shuffled.length)) {
    for (const nt of shuffled) {
      if (chosen.length >= maxOffers) break
      if (!chosen.some(c => c.id === nt.id)) chosen.push(nt)
    }
  }

  return chosen.map(nt => ({
    nationalTeamId: nt.id,
    nationalTeamName: nt.name,
    code: nt.code,
    confederation: nt.confederation,
    strength: strengths[nt.id] ?? 60,
    createdSeason: season,
    createdWeek: week,
    monthlySalary: Math.round((45_000 + (strengths[nt.id] ?? 60) * 3_500 + score * 4_000) / 5_000) * 5_000,
    contractMonths: (strengths[nt.id] ?? 60) >= 84 ? 24 : 18,
    objectives: (strengths[nt.id] ?? 60) >= 84
      ? ["Chegar às fases finais da principal competição", "Manter aproveitamento mínimo de 60%"]
      : ["Melhorar o ranking da seleção", "Cumprir a meta da competição continental"],
    obligations: ["Participar das janelas internacionais", "Convocar atletas por mérito e posição", "Prestar contas após cada competição"],
    negotiationRound: 0,
    status: "open" as const,
  }))
}

export function useNationalTeam() {
  const { state, hydrated, setState } = useGameState()
  const attemptedSeasonRef = useRef<number | null>(null)

  const career = state.nationalCareer ?? DEFAULT_NATIONAL_CAREER
  const nationalTeam = getNationalTeamById(career.nationalTeamId)

  /**
   * AUTO-REPARO de saves em que o par contrato/modo se separou.
   *
   * Antes da gravação atômica em `acceptOffer`, dava para terminar com
   * `managingNationalTeamId` apontando para uma seleção e o contrato vazio. O
   * save fica num limbo visível: o escritório mostra a seleção no cabeçalho mas
   * com FORÇA 0, o convite reaparece e as telas do menu expulsam o técnico.
   *
   * Quem já está nesse estado não deveria precisar recomeçar a carreira. Se o
   * MODO aponta para uma seleção válida e não há contrato, reconstruímos o
   * contrato a partir dela — o técnico de fato assinou, só a gravação se perdeu.
   */
  useEffect(() => {
    if (!hydrated) return
    const modo = state.managingNationalTeamId
    if (!modo || career.nationalTeamId) return
    const selecao = getNationalTeamById(modo)
    if (!selecao) return
    const patch = {
      nationalCareer: {
        ...DEFAULT_NATIONAL_CAREER,
        ...(state.nationalCareer ?? {}),
        nationalTeamId: selecao.id,
        nationalTeamName: selecao.name,
        acceptedSeason: state.season,
        contract: {
          nationalTeamId: selecao.id,
          monthlySalary: Math.round((45_000 + getNationalStrength(selecao) * 3_500) / 5_000) * 5_000,
          contractMonths: 18,
          startSeason: state.season,
          startWeek: state.week,
          objectives: ["Cumprir a meta da principal competição"],
          obligations: ["Participar das janelas internacionais", "Convocar atletas por mérito"],
        },
        lastSalaryPaidWeek: state.week,
      },
      pendingNationalOffers: [],
      lastNationalOfferSeason: state.season,
    }
    commitGameState(patch)
    setState(patch)
  }, [hydrated, state.managingNationalTeamId, career.nationalTeamId, state.nationalCareer, state.season, state.week, setState])
  // Registro da temporada corrente (vitorias/empates/derrotas na liga do usuario),
  // para o aproveitamento pesar ja no 1o ano, antes de a temporada fechar.
  const userShort = state.selectedTeamShort ?? ""
  const currentStanding = useGameEngine(s => s.serieAStandings.find(e => e.teamShort === userShort))
  const coachScore = computeCoachScore(
    state,
    currentStanding ? { won: currentStanding.won, drawn: currentStanding.drawn, lost: currentStanding.lost } : undefined,
  )
  const eligible = state.week >= OFFER_START_WEEK && coachScore >= MIN_SCORE_FOR_OFFERS

  // Auto-gera propostas por temporada quando elegivel e sem selecao
  useEffect(() => {
    if (!hydrated) return
    if (career.nationalTeamId) return
    if ((state.pendingNationalOffers?.length ?? 0) > 0) return
    // UMA RODADA DE CONVITES POR TEMPORADA — e a trava tem de estar no SAVE.
    //
    // `attemptedSeasonRef` é um `useRef`: ele zera a cada montagem do hook, e o
    // hook monta de novo a cada troca de tela. Sozinho, ele nunca impediu nada
    // entre telas — bastava ir ao escritório para as mesmas propostas (a semente
    // é determinística) voltarem, inclusive depois de aceitas ou recusadas.
    // `lastNationalOfferSeason` já era gravado e nunca era consultado.
    if (state.lastNationalOfferSeason === state.season) return
    if (attemptedSeasonRef.current === state.season) return
    if (!eligible) return
    // Entre o terceiro e quarto mês a proposta passa a ser obrigatória; antes
    // disso o hook não gera convites, independentemente da reputação.
    if (state.week < OFFER_START_WEEK) return
    attemptedSeasonRef.current = state.season

    // Ano de Copa/continental abre mais vagas de selecao (carrossel pos-torneio).
    const fase = cyclePhase(state.season)
    const maxOffers = fase === "wc" || fase === "continental" ? MAX_OFFERS_TOURNAMENT : MAX_OFFERS_OFFYEAR
    const offers = buildOffers(
      coachScore,
      state.declinedNationalTeamIds ?? [],
      state.season,
      state.week,
      `${state.managerName}-${state.season}-${coachScore}`,
      maxOffers,
    )
    if (offers.length > 0) {
      setState({
        pendingNationalOffers: offers,
        lastNationalOfferSeason: state.season,
      })
    }
  }, [hydrated, career.nationalTeamId, state.pendingNationalOffers, state.season, state.week, state.lastNationalOfferSeason, eligible, coachScore, state.declinedNationalTeamIds, state.managerName, setState])

  // Pagamento pessoal mensal do treinador. Não sai do caixa do clube.
  useEffect(() => {
    const contract = career.contract
    if (!hydrated || !career.nationalTeamId || !contract) return
    const lastPaid = career.lastSalaryPaidWeek ?? contract.startWeek
    const elapsed = state.week - lastPaid
    if (elapsed < 4) return
    const months = Math.floor(elapsed / 4)
    setState({
      nationalCareer: {
        ...career,
        totalSalaryEarned: (career.totalSalaryEarned ?? 0) + months * contract.monthlySalary,
        lastSalaryPaidWeek: lastPaid + months * 4,
      },
    })
  }, [hydrated, state.week, career, setState])

  const availableCompetitions = useMemo<NationalCompetitionDef[]>(() => {
    if (!nationalTeam) return []
    return getCompetitionsForConfederation(nationalTeam.confederation)
  }, [nationalTeam])

  /**
   * Aceita a proposta.
   *
   * ⚠️ Grava por `commitGameState` (direto no save) ANTES de tocar no estado do
   * React. Quem chama isto normalmente navega em seguida (`assumirSelecao` leva
   * ao escritório), e a navegação desmonta a tela antes de o React processar o
   * `setState` — a gravação era descartada e a proposta continuava aberta. Era
   * exatamente o relato "aceito e o escritório não atualiza". O `setState` logo
   * abaixo continua, para a tela atual reagir na hora.
   */
  const acceptOffer = useCallback((offer: NationalOffer) => {
    const salary = offer.monthlySalary ?? Math.round((45_000 + offer.strength * 3_500) / 5_000) * 5_000
    const months = offer.contractMonths ?? 18
    const objectives = offer.objectives ?? ["Cumprir a meta da principal competição"]
    const obligations = offer.obligations ?? ["Participar das janelas internacionais", "Convocar atletas por mérito"]
    const patch = {
      nationalCareer: {
        ...DEFAULT_NATIONAL_CAREER,
        ...(state.nationalCareer ?? {}),
        nationalTeamId: offer.nationalTeamId,
        nationalTeamName: offer.nationalTeamName,
        acceptedSeason: state.season,
        currentCompetition: null,
        completedThisSeason: [],
        contract: {
          nationalTeamId: offer.nationalTeamId,
          monthlySalary: salary,
          contractMonths: months,
          startSeason: state.season,
          startWeek: state.week,
          objectives,
          obligations,
        },
        lastSalaryPaidWeek: state.week,
      },
      pendingNationalOffers: [],
      // Fecha o carrossel desta temporada. Sem isto o escritório REGERAVA as
      // mesmas propostas (a semente é `${managerName}-${season}-${score}`) assim
      // que a tela remontava, porque a trava era um `useRef` que zera a cada
      // montagem — o "ainda diz que tem propostas em aberto" do relato.
      lastNationalOfferSeason: state.season,
    }
    // GRAVAÇÃO ATÔMICA DO PAR. Assinar com uma seleção grava DOIS registros:
    // o contrato (`nationalCareer.nationalTeamId`) e o modo em que o técnico
    // fica (`managingNationalTeamId`). Eles eram escritos por caminhos
    // diferentes — este e o `assumirSelecao` — e por mecanismos diferentes:
    // `commitGameState` relê o disco e mescla, enquanto o `setState` do
    // useGameState grava o estado INTEIRO a partir do snapshot do React. Quando
    // divergiam, o save ficava com o modo apontando para a seleção e o contrato
    // vazio, e o estrago era triplo: o banner de convite voltava, a força da
    // seleção aparecia como 0 e as telas de convocação/competições/amistosos
    // expulsavam o técnico de volta (a guarda delas olha o CONTRATO).
    //
    // Escrevendo os dois no MESMO patch, o par não tem como se separar.
    const completo = { ...patch, managingNationalTeamId: offer.nationalTeamId }
    commitGameState(prev => ({
      ...completo,
      nationalCareer: { ...(prev.nationalCareer ?? {}), ...patch.nationalCareer },
      pendingNationalOffers: [],
    }))
    setState(completo)
  }, [setState, state.nationalCareer, state.season, state.week])

  const counterOffer = useCallback((offer: NationalOffer, monthlySalary: number, contractMonths: number) => {
    const currentSalary = offer.monthlySalary ?? Math.round((45_000 + offer.strength * 3_500) / 5_000) * 5_000
    const salaryIncrease = monthlySalary / Math.max(1, currentSalary)
    const round = (offer.negotiationRound ?? 0) + 1
    // Federação tolera até 25% na primeira contraproposta e 12% na segunda.
    const limit = round === 1 ? 1.25 : 1.12
    const accepted = salaryIncrease <= limit && contractMonths >= 12 && contractMonths <= 48
    const updated = (state.pendingNationalOffers ?? []).map(item => {
      if (item.nationalTeamId !== offer.nationalTeamId) return item
      if (accepted) return { ...item, monthlySalary, contractMonths, negotiationRound: round, status: "countered" as const }
      return {
        ...item,
        monthlySalary: Math.round(item.monthlySalary * (round === 1 ? 1.1 : 1.04) / 5_000) * 5_000,
        negotiationRound: round,
        status: "countered" as const,
      }
    })
    setState({ pendingNationalOffers: updated })
    return accepted
  }, [setState, state.pendingNationalOffers])

  const declineOffer = useCallback((nationalTeamId: string) => {
    const remaining = (state.pendingNationalOffers ?? []).filter(o => o.nationalTeamId !== nationalTeamId)
    setState({
      pendingNationalOffers: remaining,
      declinedNationalTeamIds: [...(state.declinedNationalTeamIds ?? []), nationalTeamId],
    })
  }, [setState, state.pendingNationalOffers, state.declinedNationalTeamIds])

  const declineAll = useCallback(() => {
    const ids = (state.pendingNationalOffers ?? []).map(o => o.nationalTeamId)
    setState({
      pendingNationalOffers: [],
      declinedNationalTeamIds: [...(state.declinedNationalTeamIds ?? []), ...ids],
    })
  }, [setState, state.pendingNationalOffers, state.declinedNationalTeamIds])

  /**
   * Deixar a seleção precisa desfazer as DUAS coisas que aceitar fez.
   *
   * Antes isto zerava só o `nationalCareer` (o contrato). O
   * `managingNationalTeamId` — que é o que decide o "time atual" de TODAS as
   * telas (save-system.useUserTeam) — continuava apontando para a seleção. O
   * resultado era um beco sem saída: o técnico seguia visualmente no modo
   * seleção, comandando uma seleção que não era mais dele, e as três telas
   * (convocação, competições, amistosos) o EXPULSAVAM de volta para /selecao a
   * cada tentativa, porque a guarda delas olha o contrato, não o modo.
   *
   * `commitGameState` porque a tela costuma navegar logo depois de sair, e um
   * `setState` sozinho se perde na navegação — o mesmo motivo de `assumirSelecao`.
   */
  const leaveNationalTeam = useCallback(() => {
    const patch = {
      nationalCareer: { ...DEFAULT_NATIONAL_CAREER },
      managingNationalTeamId: null,
      // A convocação era daquela seleção; guardá-la só vazaria para a próxima.
      nationalCuts: [],
      nationalCalls: [],
    }
    commitGameState(patch)
    setState(patch)
  }, [setState])

  const startCompetition = useCallback((competitionId: string) => {
    if (!nationalTeam) return
    const def = getCompetitionDef(competitionId)
    if (!def) return
    const comp = createNationalCompetition(def, nationalTeam, state.season)
    setState({
      nationalCareer: {
        ...DEFAULT_NATIONAL_CAREER,
        ...(state.nationalCareer ?? {}),
        currentCompetition: comp,
      },
    })
  }, [nationalTeam, state.nationalCareer, state.season, setState])

  const playNextRound = useCallback(() => {
    const current = state.nationalCareer?.currentCompetition
    if (!current || !nationalTeam) return
    if (current.status !== "active") return

    const playedBefore = current.fixtures.filter(f => f.isUserMatch && f.played)
    const selectedSquad = getNationalSquad(nationalTeam, {
      cuts: state.nationalCuts ?? [],
      calls: state.nationalCalls ?? [],
    })
    const updated = advanceNationalRound(current, nationalTeam.id, getNationalStrength(nationalTeam, selectedSquad))
    const playedAfter = updated.fixtures.filter(f => f.isUserMatch && f.played)
    const newMatches = playedAfter.slice(playedBefore.length)

    let wins = 0, draws = 0, losses = 0
    for (const f of newMatches) {
      const userIsHome = f.homeId === nationalTeam.id
      const ug = userIsHome ? (f.homeScore ?? 0) : (f.awayScore ?? 0)
      const og = userIsHome ? (f.awayScore ?? 0) : (f.homeScore ?? 0)
      if (f.decidedOnPens) {
        if (f.userAdvanced) wins++; else losses++
      } else if (ug > og) wins++
      else if (ug === og) draws++
      else losses++
    }

    const prev = state.nationalCareer ?? DEFAULT_NATIONAL_CAREER
    const careerPatch: typeof prev = {
      ...prev,
      currentCompetition: updated,
      matchesPlayed: prev.matchesPlayed + newMatches.length,
      wins: prev.wins + wins,
      draws: prev.draws + draws,
      losses: prev.losses + losses,
    }

    // Recompensa por titulo / classificacao
    const justFinished = current.status === "active" && updated.status !== "active"
    let coachPatch: Record<string, unknown> = {}
    if (justFinished) {
      if (updated.status === "champion") {
        careerPatch.titles = [...prev.titles, { competition: updated.competitionName, season: updated.season }]
        coachPatch = {
          coachTotalTitles: (state.coachTotalTitles ?? 0) + 1,
          coachXP: (state.coachXP ?? 0) + 120,
        }
      } else if (updated.status === "qualified") {
        careerPatch.worldCupQualifications = prev.worldCupQualifications + 1
        coachPatch = { coachXP: (state.coachXP ?? 0) + 60 }
      }
    }

    setState({ nationalCareer: careerPatch, ...coachPatch })
  }, [state.nationalCareer, state.coachTotalTitles, state.coachXP, nationalTeam, setState])

  // AMISTOSO de selecao (preparacao antes dos torneios, como na vida real). E
  // SIMULADO — como as partidas oficiais de selecao — pela forca dos dois lados,
  // nao conta para competicao e da um pequeno ganho de preparo (coachXP). Guarda
  // os ultimos 6 resultados para exibir.
  const playNationalFriendly = useCallback((opponentId: string) => {
    if (!nationalTeam || opponentId === nationalTeam.id) return
    const opponent = getNationalTeamById(opponentId)
    if (!opponent) return
    const squad = getNationalSquad(nationalTeam, { cuts: state.nationalCuts ?? [], calls: state.nationalCalls ?? [] })
    const userStr = getNationalStrength(nationalTeam, squad)
    const oppStr = getNationalStrength(opponent)

    // O XP do tecnico entra na semente por ser MONOTONICO (cada amistoso soma 8).
    // Sem ele, dois amistosos contra o mesmo adversario na MESMA semana davam
    // exatamente o mesmo placar — a semana nao avanca entre um e outro —, o que
    // denunciava a simulacao. O historico nao serve para isso: e limitado a 6.
    const rng = makeRng(
      `${state.managerName}-${nationalTeam.id}-${opponentId}-${state.season}-${state.week}-${state.coachXP ?? 0}`,
    )
    // Poisson simples: a diferenca de forca desloca o numero esperado de gols.
    const dif = (userStr - oppStr) / 9
    const golsPoisson = (media: number) => {
      const lambda = Math.max(0.25, media)
      let L = Math.exp(-lambda), k = 0, p = 1
      do { k++; p *= rng() } while (p > L)
      return Math.min(6, k - 1)
    }
    const userScore = golsPoisson(1.35 + dif * 0.55)
    const oppScore = golsPoisson(1.35 - dif * 0.55)

    const prev = state.nationalFriendlies ?? []
    // O amistoso E um jogo dirigido: entra no RETROSPECTO da carreira na selecao
    // (jogos/V-E-D). Sem isto o painel "Retrospecto" do escritorio ficava 0-0-0
    // para sempre enquanto nao houvesse competicao em disputa — parecia quebrado.
    const prevCareer = state.nationalCareer ?? DEFAULT_NATIONAL_CAREER
    setState({
      nationalFriendlies: [
        { opponentId, opponentName: opponent.name, userScore, oppScore, season: state.season },
        ...prev,
      ].slice(0, 6),
      nationalCareer: {
        ...prevCareer,
        matchesPlayed: prevCareer.matchesPlayed + 1,
        wins: prevCareer.wins + (userScore > oppScore ? 1 : 0),
        draws: prevCareer.draws + (userScore === oppScore ? 1 : 0),
        losses: prevCareer.losses + (userScore < oppScore ? 1 : 0),
      },
      coachXP: (state.coachXP ?? 0) + 8, // preparo/entrosamento da selecao
    } as Parameters<typeof setState>[0])
  }, [nationalTeam, state.nationalCuts, state.nationalCalls, state.managerName, state.season, state.week, state.nationalFriendlies, state.nationalCareer, state.coachXP, setState])

  // Encerra a competicao atual (apos terminada) e libera para iniciar outra
  const finishCompetition = useCallback(() => {
    const current = state.nationalCareer?.currentCompetition
    if (!current) return
    const prev = state.nationalCareer ?? DEFAULT_NATIONAL_CAREER
    setState({
      nationalCareer: {
        ...prev,
        currentCompetition: null,
        completedThisSeason: [...prev.completedThisSeason, current.competitionId],
      },
    })
  }, [state.nationalCareer, setState])

  const currentCompetition = career.currentCompetition ?? null
  const userNextFixture = currentCompetition ? getUserNextFixture(currentCompetition) : null

  return {
    hydrated,
    eligible,
    coachScore,
    minScoreForOffers: MIN_SCORE_FOR_OFFERS,
    offerStartWeek: OFFER_START_WEEK,
    offerGuaranteeWeek: OFFER_GUARANTEE_WEEK,
    offers: state.pendingNationalOffers ?? [],
    hasNationalTeam: !!career.nationalTeamId,
    nationalTeam,
    career,
    availableCompetitions,
    currentCompetition,
    userNextFixture,
    season: state.season,
    // acoes
    acceptOffer,
    counterOffer,
    declineOffer,
    declineAll,
    leaveNationalTeam,
    startCompetition,
    playNextRound,
    playNationalFriendly,
    nationalFriendlies: state.nationalFriendlies ?? [],
    finishCompetition,
  }
}

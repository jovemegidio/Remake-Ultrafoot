import type { GameState, SquadPlayer, YouthAlumniRecord, YouthCareerState } from "@/lib/save-system"
import type { Team } from "@/lib/teams-data"
import { completarLigaComPool } from "@/lib/teams-data"
import { generateYouthBatch } from "@/lib/youth-engine"
import { generateSeasonFixtures, initStandings, sortStandings, updateStandings } from "@/lib/career-engine"
import { generateCupBracket, isCupTriggerRound, simulateCupRound } from "@/lib/cup-engine"
import { simulateFullMatch } from "@/lib/match-engine"
import type { MatchFixture } from "@/lib/career-types"

export const YOUTH_COMPETITIONS = [
  "Copa São Paulo de Futebol Júnior",
  "Campeonato Brasileiro Sub-20",
  "Copa do Brasil Sub-20",
] as const

type YouthStage = { name: string; matches: number; kind: "group" | "league" | "knockout"; qualificationPoints?: number }
export type YouthCompetitionFormat = {
  /**
   * ⚠️ Era `typeof YOUTH_COMPETITIONS[number]` — três nomes brasileiros e mais
   * nada. O tipo é o que impedia a carreira de base de existir fora do Brasil:
   * um clube inglês na Copinha é o mesmo erro do grego jogando o Brasileirão.
   */
  name: string
  participants: number
  registrationLimit: number
  maximumAge: number
  stages: YouthStage[]
  source: string
}

/** Formatos BRASILEIROS vigentes em 2026. O motor simula somente a chave do usuario. */
export const YOUTH_COMPETITION_FORMATS_2026: YouthCompetitionFormat[] = [
  {
    name: YOUTH_COMPETITIONS[0], participants: 128, registrationLimit: 30, maximumAge: 20,
    stages: [
      { name: "Fase de grupos", matches: 3, kind: "group", qualificationPoints: 4 },
      { name: "Segunda fase", matches: 1, kind: "knockout" },
      { name: "Terceira fase", matches: 1, kind: "knockout" },
      { name: "Oitavas de final", matches: 1, kind: "knockout" },
      { name: "Quartas de final", matches: 1, kind: "knockout" },
      { name: "Semifinal", matches: 1, kind: "knockout" },
      { name: "Final", matches: 1, kind: "knockout" },
    ],
    source: "FPF REC Copinha 2026",
  },
  {
    name: YOUTH_COMPETITIONS[1], participants: 20, registrationLimit: 50, maximumAge: 20,
    stages: [
      { name: "Primeira fase", matches: 19, kind: "league", qualificationPoints: 27 },
      { name: "Quartas de final", matches: 2, kind: "knockout" },
      { name: "Semifinal", matches: 2, kind: "knockout" },
      { name: "Final", matches: 2, kind: "knockout" },
    ],
    source: "CBF Brasileiro Sub-20 2026",
  },
  {
    name: YOUTH_COMPETITIONS[2], participants: 64, registrationLimit: 50, maximumAge: 20,
    stages: [
      { name: "Primeira fase", matches: 1, kind: "knockout" },
      { name: "Segunda fase", matches: 2, kind: "knockout" },
      { name: "Oitavas de final", matches: 2, kind: "knockout" },
      { name: "Quartas de final", matches: 2, kind: "knockout" },
      { name: "Semifinal", matches: 2, kind: "knockout" },
      { name: "Final", matches: 2, kind: "knockout" },
    ],
    source: "CBF calendario nacional de base 2026",
  },
]

// ─── AS COMPETIÇÕES DE BASE DE CADA PAÍS ─────────────────────────────────────
//
// A carreira de base existia só no Brasil: Copinha, Brasileirão Sub-20 e Copa do
// Brasil Sub-20 estavam no CÓDIGO como se fossem "as" competições de base do
// mundo. Um clube do Ajax dirigido na base disputaria a Copa São Paulo.
//
// Cada país declara as suas. Onde o dado não existe, o fallback é NOMEADO pelo
// país (`Campeonato Sub-20 de <país>`) — genérico, mas honesto: melhor do que
// mandar um clube japonês para um torneio de São Paulo.

const ESTAGIOS_LIGA = (jogos: number, pontos: number): YouthStage[] => [
  { name: "Fase regular", matches: jogos, kind: "league", qualificationPoints: pontos },
  { name: "Semifinal", matches: 2, kind: "knockout" },
  { name: "Final", matches: 1, kind: "knockout" },
]
const ESTAGIOS_COPA: YouthStage[] = [
  { name: "Primeira fase", matches: 1, kind: "knockout" },
  { name: "Oitavas de final", matches: 1, kind: "knockout" },
  { name: "Quartas de final", matches: 1, kind: "knockout" },
  { name: "Semifinal", matches: 1, kind: "knockout" },
  { name: "Final", matches: 1, kind: "knockout" },
]

const FORMATOS_DE_BASE_POR_PAIS: Record<string, YouthCompetitionFormat[]> = {
  brasil: YOUTH_COMPETITION_FORMATS_2026,
  inglaterra: [
    { name: "Premier League 2", participants: 26, registrationLimit: 30, maximumAge: 21, stages: ESTAGIOS_LIGA(20, 28), source: "Premier League Academy 2026" },
    { name: "FA Youth Cup", participants: 64, registrationLimit: 25, maximumAge: 18, stages: ESTAGIOS_COPA, source: "The FA 2026" },
    { name: "UEFA Youth League", participants: 64, registrationLimit: 40, maximumAge: 19, stages: ESTAGIOS_COPA, source: "UEFA 2026" },
  ],
  espanha: [
    { name: "División de Honor Juvenil", participants: 18, registrationLimit: 25, maximumAge: 19, stages: ESTAGIOS_LIGA(18, 26), source: "RFEF 2026" },
    { name: "Copa del Rey Juvenil", participants: 32, registrationLimit: 25, maximumAge: 19, stages: ESTAGIOS_COPA, source: "RFEF 2026" },
    { name: "UEFA Youth League", participants: 64, registrationLimit: 40, maximumAge: 19, stages: ESTAGIOS_COPA, source: "UEFA 2026" },
  ],
  italia: [
    { name: "Campionato Primavera 1", participants: 18, registrationLimit: 25, maximumAge: 19, stages: ESTAGIOS_LIGA(18, 26), source: "Lega Serie A 2026" },
    { name: "Coppa Italia Primavera", participants: 32, registrationLimit: 25, maximumAge: 19, stages: ESTAGIOS_COPA, source: "FIGC 2026" },
    { name: "UEFA Youth League", participants: 64, registrationLimit: 40, maximumAge: 19, stages: ESTAGIOS_COPA, source: "UEFA 2026" },
  ],
  alemanha: [
    { name: "A-Junioren Bundesliga", participants: 16, registrationLimit: 25, maximumAge: 19, stages: ESTAGIOS_LIGA(16, 24), source: "DFB 2026" },
    { name: "DFB-Junioren-Pokal", participants: 32, registrationLimit: 25, maximumAge: 19, stages: ESTAGIOS_COPA, source: "DFB 2026" },
    { name: "UEFA Youth League", participants: 64, registrationLimit: 40, maximumAge: 19, stages: ESTAGIOS_COPA, source: "UEFA 2026" },
  ],
  franca: [
    { name: "Championnat National U19", participants: 14, registrationLimit: 25, maximumAge: 19, stages: ESTAGIOS_LIGA(14, 20), source: "FFF 2026" },
    { name: "Coupe Gambardella", participants: 64, registrationLimit: 25, maximumAge: 19, stages: ESTAGIOS_COPA, source: "FFF 2026" },
    { name: "UEFA Youth League", participants: 64, registrationLimit: 40, maximumAge: 19, stages: ESTAGIOS_COPA, source: "UEFA 2026" },
  ],
  portugal: [
    { name: "Campeonato Nacional de Juniores", participants: 18, registrationLimit: 25, maximumAge: 19, stages: ESTAGIOS_LIGA(18, 26), source: "FPF 2026" },
    { name: "Taça Nacional de Juniores", participants: 32, registrationLimit: 25, maximumAge: 19, stages: ESTAGIOS_COPA, source: "FPF 2026" },
    { name: "UEFA Youth League", participants: 64, registrationLimit: 40, maximumAge: 19, stages: ESTAGIOS_COPA, source: "UEFA 2026" },
  ],
  argentina: [
    { name: "Torneo de Reserva", participants: 28, registrationLimit: 30, maximumAge: 21, stages: ESTAGIOS_LIGA(22, 30), source: "AFA 2026" },
    { name: "Copa Proyección", participants: 32, registrationLimit: 30, maximumAge: 21, stages: ESTAGIOS_COPA, source: "AFA 2026" },
  ],
  holanda: [
    { name: "Beloften Eredivisie", participants: 16, registrationLimit: 25, maximumAge: 21, stages: ESTAGIOS_LIGA(16, 22), source: "KNVB 2026" },
    { name: "UEFA Youth League", participants: 64, registrationLimit: 40, maximumAge: 19, stages: ESTAGIOS_COPA, source: "UEFA 2026" },
  ],
}

const semAcento = (s: string) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()

/**
 * As competições de base do país do clube.
 *
 * País ausente devolve o conjunto BRASILEIRO — não é um chute: toda carreira de
 * base que existe em save anterior a esta versão foi criada quando o Brasil era
 * a única possibilidade, e trocar o calendário dela na virada de versão apagaria
 * o progresso da temporada em curso.
 */
export function formatosDeBase(pais?: string): YouthCompetitionFormat[] {
  if (!pais) return YOUTH_COMPETITION_FORMATS_2026
  const chave = semAcento(pais)
  const conhecido = FORMATOS_DE_BASE_POR_PAIS[chave]
  if (conhecido) return conhecido
  return [
    { name: `Campeonato Sub-20 — ${pais}`, participants: 16, registrationLimit: 25, maximumAge: 20, stages: ESTAGIOS_LIGA(16, 22), source: `Federação de ${pais}` },
    { name: `Copa Sub-20 — ${pais}`, participants: 32, registrationLimit: 25, maximumAge: 20, stages: ESTAGIOS_COPA, source: `Federação de ${pais}` },
  ]
}

function hash(seed: string): number { let h=2166136261; for(const c of seed){h^=c.charCodeAt(0);h=Math.imul(h,16777619)} return h>>>0 }
function roll(seed: string): number { return (hash(seed)%10000)/10000 }

// ─── A TEMPORADA DA BASE, NA MÁQUINA DO PROFISSIONAL ─────────────────────────
//
// As academias rivais são as dos clubes da DIVISÃO do clube-mãe: quem dirige a
// base do Palmeiras enfrenta a base do Corinthians, não um adversário sorteado
// do país inteiro (que era o que a tela fazia — `pool[(round*7+season)%n]`).
//
// O clube rival mantém o `curto` do profissional de propósito: é ele que faz o
// ESCUDO certo aparecer na tabela sem cadastrar um segundo catálogo de clubes.

/** Quantas academias disputam a liga de base. Par, senão a temporada não fecha. */
const CLUBES_NA_BASE = 16

export function academiasDaDivisao(divisao: string, clubeDoUsuario: string): Team[] {
  const profissionais = completarLigaComPool(divisao)
  const doUsuario = profissionais.find(t => t.curto === clubeDoUsuario)
  const demais = profissionais
    .filter(t => t.curto !== clubeDoUsuario)
    .sort((a, b) => (b.prestigio ?? 0) - (a.prestigio ?? 0))
  const escolhidos = [...(doUsuario ? [doUsuario] : []), ...demais].slice(0, CLUBES_NA_BASE)
  // Ímpar deixa um clube de folga por rodada e ninguém completa o turno-returno.
  const pares = escolhidos.length % 2 === 0 ? escolhidos : escolhidos.slice(0, escolhidos.length - 1)
  return pares.map(t => ({
    ...t,
    nome: `${t.nome} Sub-20`,
    // A academia é mais fraca e mais nivelada que o profissional: sem esta
    // compressão, a base do clube grande ganharia o campeonato sozinha.
    prestigio: Math.round(45 + (t.prestigio ?? 55) * 0.42),
  }))
}

/** A competição de LIGA do país (a que tem tabela). Copa fica para o mata-mata. */
function ligaDaBase(pais?: string): YouthCompetitionFormat {
  const formatos = formatosDeBase(pais)
  return formatos.find(f => f.stages[0]?.kind === "league") ?? formatos[0]
}

/** A competição de COPA do país (a primeira de mata-mata puro). */
function copaDaBase(pais?: string): YouthCompetitionFormat | undefined {
  const liga = ligaDaBase(pais)
  return formatosDeBase(pais).find(f => f !== liga)
}

/**
 * Monta calendário, tabela e copa da temporada da base. Muta o `career` — é
 * chamado tanto na criação quanto na virada de temporada.
 */
export function montarTemporadaDaBase(career: YouthCareerState, divisao: string): void {
  const clubes = academiasDaDivisao(divisao, career.clubCurto)
  if (clubes.length < 4) return
  const liga = ligaDaBase(career.pais)
  const copa = copaDaBase(career.pais)
  career.divisao = divisao
  career.ligaNome = liga.name
  career.copaNome = copa?.name
  career.calendario = generateSeasonFixtures(clubes, career.clubCurto, career.currentSeason, liga.name)
  career.tabela = initStandings(clubes)
  career.copa = copa ? generateCupBracket(clubes, career.clubCurto, career.currentSeason, copa.name) : undefined
  career.currentCompetition = liga.name
  career.competitionStage = "Fase regular"
}

/** A próxima partida da base ainda não jogada (a do clube do usuário). */
export function proximaPartidaDaBase(career: YouthCareerState | undefined): MatchFixture | undefined {
  return career?.calendario?.find(f => !f.played && f.isUserMatch)
}

/** Força da equipe do usuário: sai do ELENCO, não do prestígio do clube-mãe. */
function forcaDoElencoDaBase(state: GameState): number {
  const titulares = (state.youthPlayers ?? [])
    .filter(p => (state.youthCareer?.startingPlayerIds ?? []).includes(p.id))
  const base = (titulares.length ? titulares : (state.youthPlayers ?? []).slice(0, 11))
  return base.length ? Math.round(base.reduce((n, p) => n + p.overall, 0) / base.length) : 60
}

/**
 * Joga a próxima rodada da base: a partida do clube do usuário e as dos rivais.
 *
 * É a mesma sequência do profissional — simula a rodada inteira, atualiza a
 * tabela e, nas rodadas de gatilho, avança a copa. O resultado do usuário
 * continua alimentando reputação, XP e evolução dos garotos.
 */
export function jogarRodadaDaBase(state: GameState, placarDoUsuario?: { pro: number; contra: number }): GameState {
  const career = state.youthCareer
  if (!career?.active || !career.calendario || !career.tabela) return state
  const proxima = career.calendario.find(f => !f.played)
  if (!proxima) return { ...state, youthCareer: { ...career, seasonFinished: true } }

  const next: GameState = structuredClone(state)
  const c = next.youthCareer!
  const rodada = proxima.round
  const clubes = new Map(academiasDaDivisao(c.divisao ?? "serie_a", c.clubCurto).map(t => [t.curto, t]))
  const forcaDoUsuario = forcaDoElencoDaBase(next)

  for (const fixture of c.calendario!.filter(f => f.round === rodada && !f.played)) {
    const casa = clubes.get(fixture.homeCurto)
    const fora = clubes.get(fixture.awayCurto)
    if (!casa || !fora) { fixture.played = true; continue }

    let golsCasa: number, golsFora: number
    const doUsuario = fixture.isUserMatch
    if (doUsuario && placarDoUsuario) {
      // Partida DISPUTADA ao vivo: o placar vem de campo, não do simulador.
      const emCasa = fixture.homeCurto === c.clubCurto
      golsCasa = emCasa ? placarDoUsuario.pro : placarDoUsuario.contra
      golsFora = emCasa ? placarDoUsuario.contra : placarDoUsuario.pro
    } else {
      const partida = simulateFullMatch({
        homeTeam: casa, awayTeam: fora,
        // A força do clube do usuário sai do ELENCO que ele montou — é o que
        // faz escalar e desenvolver os garotos mudar o resultado.
        homeRating: fixture.homeCurto === c.clubCurto ? forcaDoUsuario : casa.prestigio,
        awayRating: fixture.awayCurto === c.clubCurto ? forcaDoUsuario : fora.prestigio,
        durationMinutes: 90,
      })
      golsCasa = partida.home.goals
      golsFora = partida.away.goals
    }

    fixture.played = true
    fixture.homeGoals = golsCasa
    fixture.awayGoals = golsFora
    c.tabela = updateStandings(c.tabela!, fixture.homeCurto, fixture.awayCurto, golsCasa, golsFora)

    if (!doUsuario) continue
    const emCasa = fixture.homeCurto === c.clubCurto
    aplicarResultadoDaBase(c, emCasa ? golsCasa : golsFora, emCasa ? golsFora : golsCasa)
  }

  c.tabela = sortStandings(c.tabela!)
  c.round = rodada

  // COPA nas mesmas rodadas de gatilho do profissional.
  if (c.copa && isCupTriggerRound(rodada) && !c.copa.champion) {
    c.copa = simulateCupRound(c.copa, c.clubCurto, [...clubes.values()])
    if (c.copa.champion === c.clubCurto) {
      const titulo = `${c.copaNome ?? "Copa"} ${c.currentSeason}`
      if (!c.titles.includes(titulo)) c.titles.push(titulo)
      c.coachReputation = Math.min(100, c.coachReputation + 8)
      c.coachXP += 120
    }
  }

  // Desenvolvimento dos garotos: mesma taxa da rodada simulada antiga.
  developPlayers(next, .2)

  if (!c.calendario!.some(f => !f.played)) {
    c.seasonFinished = true
    const campeao = sortStandings(c.tabela!)[0]
    if (campeao?.curto === c.clubCurto) {
      const titulo = `${c.ligaNome ?? "Campeonato"} ${c.currentSeason}`
      if (!c.titles.includes(titulo)) c.titles.push(titulo)
      c.coachReputation = Math.min(100, c.coachReputation + 12)
      c.coachXP += 180
      c.seasonPlacements = { ...(c.seasonPlacements ?? {}), [c.ligaNome ?? "Campeonato"]: "Campeao" }
    } else {
      const posicao = sortStandings(c.tabela!).findIndex(l => l.curto === c.clubCurto) + 1
      c.seasonPlacements = { ...(c.seasonPlacements ?? {}), [c.ligaNome ?? "Campeonato"]: `${posicao}º lugar` }
    }
  }
  next.updatedAt = Date.now()
  return next
}

/** Números da campanha do usuário (pontos, moral do técnico, XP). */
function aplicarResultadoDaBase(c: YouthCareerState, golsPro: number, golsContra: number): void {
  const venceu = golsPro > golsContra, empatou = golsPro === golsContra
  c.matches++
  c.goalsFor += golsPro
  c.goalsAgainst += golsContra
  c.wins += venceu ? 1 : 0
  c.draws += empatou ? 1 : 0
  c.losses += !venceu && !empatou ? 1 : 0
  c.points += venceu ? 3 : empatou ? 1 : 0
  c.coachXP += venceu ? 15 : empatou ? 8 : 4
  c.coachReputation = Math.min(100, Math.max(0, c.coachReputation + (venceu ? .8 : empatou ? .25 : -.12)))
}

function initializeProgress(career: YouthCareerState): void {
  const formatos = formatosDeBase(career.pais)
  career.competitionIndex ??= Math.max(0, formatos.findIndex(f => f.name === career.currentCompetition))
  career.competitionStageIndex ??= 0
  career.competitionMatchInStage ??= 0
  career.competitionPoints ??= 0
  career.competitionAggregateFor ??= 0
  career.competitionAggregateAgainst ??= 0
  career.seasonPlacements ??= {}
  const format = formatos[career.competitionIndex] ?? formatos[0]
  career.currentCompetition = format.name
  career.competitionStage = format.stages[career.competitionStageIndex]?.name ?? "Encerrada"
}

export function createYouthCareer(team: Team, season=2026): { career: YouthCareerState; players: SquadPlayer[] } {
  // O país do clube manda em DUAS coisas: as competições que a base disputa e o
  // nome dos garotos que ela revela.
  const pais = team.pais || (String(team.divisao).startsWith("serie_") ? "Brasil" : "")
  const feminino = String(team.file_key ?? "").endsWith("__fem")
  const formatos = formatosDeBase(pais || undefined)
  const players=generateYouthBatch(season,22,team.prestigio,{pais:pais||undefined,feminino}).map((p,i)=>({...p,id:`academy_${team.curto}_${season}_${i}`,age:16+i%4,value:Math.max(150000,p.value),fromTeam:`${team.nome} Sub-20`,seasonSigned:season}))
  const career: YouthCareerState = {
    active:true,category:"sub20",clubCurto:team.curto,clubNome:`${team.nome} Sub-20`,startedSeason:season,currentSeason:season,
    pais:pais||undefined,feminino:feminino||undefined,
    round:0,matches:0,wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0,points:0,coachReputation:8,coachXP:0,
    titles:[],promotedPlayerIds:[],alumni:[],professionalOffers:[],seasonFinished:false,formation:"4-3-3",
    startingPlayerIds:players.slice(0,11).map(p=>p.id),currentCompetition:formatos[0].name,
    competitionIndex:0,competitionStageIndex:0,competitionMatchInStage:0,competitionPoints:0,
    competitionAggregateFor:0,competitionAggregateAgainst:0,competitionStage:formatos[0].stages[0].name,seasonPlacements:{},
  }
  // Calendário, tabela e copa da temporada — a mesma máquina do profissional.
  montarTemporadaDaBase(career, String(team.divisao))
  return { players, career }
}

function advanceCompetition(career: YouthCareerState, placement: string): void {
  initializeProgress(career)
  const formatos = formatosDeBase(career.pais)
  career.seasonPlacements![career.currentCompetition!] = placement
  career.competitionIndex = (career.competitionIndex ?? 0) + 1
  career.competitionStageIndex = 0
  career.competitionMatchInStage = 0
  career.competitionPoints = 0
  career.competitionAggregateFor = 0
  career.competitionAggregateAgainst = 0
  const next = formatos[career.competitionIndex]
  if (!next) {
    career.seasonFinished = true
    career.currentCompetition = formatos[formatos.length - 1].name
    career.competitionStage = "Temporada encerrada"
    return
  }
  career.currentCompetition = next.name
  career.competitionStage = next.stages[0].name
}

function applyYouthResult(next: GameState, goalsFor: number, goalsAgainst: number): void {
  const c=next.youthCareer
  if(!c?.active||c.seasonFinished)return
  initializeProgress(c)
  const format=formatosDeBase(c.pais)[c.competitionIndex ?? 0]
  const stage=format?.stages[c.competitionStageIndex ?? 0]
  if(!format||!stage){advanceCompetition(c,"Encerrada");return}

  const win=goalsFor>goalsAgainst,draw=goalsFor===goalsAgainst
  c.round++;c.matches++;c.goalsFor+=goalsFor;c.goalsAgainst+=goalsAgainst;c.wins+=win?1:0;c.draws+=draw?1:0;c.losses+=!win&&!draw?1:0;c.points+=win?3:draw?1:0
  c.coachXP+=win?15:draw?8:4;c.coachReputation=Math.min(100,c.coachReputation+(win?.8:draw?.25:-.12))
  c.competitionMatchInStage=(c.competitionMatchInStage ?? 0)+1
  c.competitionPoints=(c.competitionPoints ?? 0)+(win?3:draw?1:0)
  c.competitionAggregateFor=(c.competitionAggregateFor ?? 0)+goalsFor
  c.competitionAggregateAgainst=(c.competitionAggregateAgainst ?? 0)+goalsAgainst

  if((c.competitionMatchInStage ?? 0)<stage.matches)return
  let qualified:boolean
  if(stage.kind==="group"||stage.kind==="league") qualified=(c.competitionPoints ?? 0)>=(stage.qualificationPoints ?? 0)
  else {
    const gf=c.competitionAggregateFor ?? 0,ga=c.competitionAggregateAgainst ?? 0
    qualified=gf>ga||(gf===ga&&roll(`${c.clubCurto}:${c.currentSeason}:${format.name}:${stage.name}:penalties`)>=.5)
  }

  if(!qualified){advanceCompetition(c,`Eliminado - ${stage.name}`);return}
  const lastStage=(c.competitionStageIndex ?? 0)===format.stages.length-1
  if(lastStage){
    const title=`${format.name} ${c.currentSeason}`
    if(!c.titles.includes(title))c.titles.push(title)
    c.coachReputation=Math.min(100,c.coachReputation+12);c.coachXP+=180
    advanceCompetition(c,"Campeao")
    return
  }
  c.competitionStageIndex=(c.competitionStageIndex ?? 0)+1
  c.competitionMatchInStage=0;c.competitionPoints=0;c.competitionAggregateFor=0;c.competitionAggregateAgainst=0
  c.competitionStage=format.stages[c.competitionStageIndex].name
}

function developPlayers(next: GameState, chance: number): void {
  const c=next.youthCareer!
  next.youthPlayers=(next.youthPlayers??[]).map(p=>p.age<=20&&p.overall<p.potential&&roll(`${p.id}:${c.currentSeason}:${c.round}`)<chance?{...p,overall:p.overall+1,trend:"up"}:p)
  next.week++;next.updatedAt=Date.now()
}

export function applyPlayedYouthMatch(state: GameState, goalsFor: number, goalsAgainst: number): GameState {
  if(!state.youthCareer?.active||state.youthCareer.seasonFinished)return state
  // Carreira COM calendário: o placar de campo entra na rodada e a tabela do
  // campeonato se move junto com os rivais. Sem isto a partida jogada ao vivo
  // ficaria num contador paralelo e a classificação não conheceria o jogo.
  if(state.youthCareer.calendario?.length)return jogarRodadaDaBase(state,{pro:goalsFor,contra:goalsAgainst})
  const next=structuredClone(state);applyYouthResult(next,goalsFor,goalsAgainst);developPlayers(next,.22);return next
}

export function simulateYouthRound(state: GameState): GameState {
  const career=state.youthCareer;if(!career?.active||career.seasonFinished)return state
  if(career.calendario?.length)return jogarRodadaDaBase(state)
  const quality=(state.youthPlayers??[]).slice(0,11).reduce((n,p)=>n+p.overall,0)/Math.max(1,Math.min(11,(state.youthPlayers??[]).length))
  const r=roll(`${career.clubCurto}:${career.currentSeason}:${career.currentCompetition}:${career.round}`)
  const gf=Math.max(0,Math.floor(r*4+(quality-60)/18)),ga=Math.max(0,Math.floor(roll(`opp:${career.currentSeason}:${career.currentCompetition}:${career.round}:${career.clubCurto}`)*4))
  const next=structuredClone(state);applyYouthResult(next,gf,ga);developPlayers(next,.18);return next
}

export function finishYouthSeason(state: GameState): GameState {
  if(!state.youthCareer?.seasonFinished)return state
  const next=structuredClone(state),c=next.youthCareer!,champion=Object.values(c.seasonPlacements??{}).includes("Campeao")
  const graduates=(next.youthPlayers??[]).filter(p=>p.age>=19).slice(0,Math.max(2,champion?5:3)),elite=["Liverpool","FC Barcelona","Real Madrid","Bayern de Munique","Manchester City"]
  for(const p of graduates){const level=p.potential>=86?"elite":"professional",record:YouthAlumniRecord={playerId:p.id,playerName:p.name,position:p.position,potential:p.potential,trainedFromSeason:p.seasonSigned??c.currentSeason,trainedToSeason:c.currentSeason,currentClub:level==="elite"?elite[hash(p.id)%elite.length]:c.clubNome.replace(" Sub-20",""),currentLevel:level,careerTitles:[],nationalTeamCaps:0,worldCupTitles:0,relationship:85};c.alumni.push(record);c.promotedPlayerIds.push(p.id)}
  next.youthPlayers=(next.youthPlayers??[]).filter(p=>!graduates.some(g=>g.id===p.id)).map(p=>({...p,age:p.age+1}));next.youthPlayers.push(...generateYouthBatch(c.currentSeason+1,graduates.length,c.coachReputation+55,{pais:c.pais,feminino:c.feminino}).map((p,i)=>({...p,id:`academy_${c.clubCurto}_${c.currentSeason+1}_${i}`,age:16+i%3,fromTeam:c.clubNome})))
  c.alumni=advanceAlumni(c.alumni,c.currentSeason);c.currentSeason++;c.round=0;c.matches=0;c.wins=0;c.draws=0;c.losses=0;c.goalsFor=0;c.goalsAgainst=0;c.points=0;c.seasonFinished=false;c.professionalOffers=generateProfessionalOffers(c)
  const formatosDaTemporada=formatosDeBase(c.pais)
  c.competitionIndex=0;c.competitionStageIndex=0;c.competitionMatchInStage=0;c.competitionPoints=0;c.competitionAggregateFor=0;c.competitionAggregateAgainst=0;c.currentCompetition=formatosDaTemporada[0].name;c.competitionStage=formatosDaTemporada[0].stages[0].name;c.seasonPlacements={}
  // TEMPORADA NOVA com calendário, tabela e copa novos — a virada da base é a
  // mesma do profissional. Carreira antiga (sem `divisao` gravada) segue no
  // caminho de simulação livre, sem tabela, como sempre foi.
  if(c.divisao)montarTemporadaDaBase(c,c.divisao)
  next.season=c.currentSeason;next.week=0;next.updatedAt=Date.now();return next
}

export function generateProfessionalOffers(career: YouthCareerState): YouthCareerState["professionalOffers"] {
  if(career.coachReputation<22)return[]
  const clubs=[{clubCurto:"PON",clubNome:"Ponte Preta"},{clubCurto:"CRB",clubNome:"CRB"},{clubCurto:"CEA",clubNome:"Ceara"},{clubCurto:career.clubCurto,clubNome:career.clubNome.replace(" Sub-20","")}]
  return clubs.filter((_,i)=>career.coachReputation>=22+i*12).map((x,i)=>({id:`offer-${career.currentSeason}-${x.clubCurto}`,...x,role:i===clubs.length-1?"head_coach":"assistant",reputationRequired:22+i*12,monthlySalary:18000+i*14000,contractMonths:24,objectives:i<2?["Evitar rebaixamento","Promover 2 atletas da base"]:["Classificar para competicao continental","Valorizar jovens do elenco"]}))
}

export function acceptProfessionalOffer(state: GameState, offerId: string): GameState {
  const next=structuredClone(state),offer=next.youthCareer?.professionalOffers.find(o=>o.id===offerId);if(!offer)return state;next.selectedTeamShort=offer.clubCurto;if(next.youthCareer)next.youthCareer.active=false;next.coachLegacy.careerRecords.push({teamShort:offer.clubCurto,teamName:offer.clubNome,seasons:0,titles:[],bestPosition:0,youthAcademyLevelLeft:1,startedSeason:next.season,endedSeason:next.season,endReason:"novo_desafio"});next.updatedAt=Date.now();return next
}

export function advanceAlumni(alumni: YouthAlumniRecord[], season: number): YouthAlumniRecord[] {return alumni.map(a=>{const next={...a,careerTitles:[...a.careerTitles]};if(roll(`${a.playerId}:title:${season}`)<(a.currentLevel==="elite"?.42:.12))next.careerTitles.push(a.currentLevel==="elite"?"Liga dos Campeoes":"Campeonato nacional");if(a.potential>=82&&roll(`${a.playerId}:caps:${season}`)<.65)next.nationalTeamCaps+=2+hash(`${season}:${a.playerId}`)%9;if(next.nationalTeamCaps>20&&season%4===2&&roll(`${a.playerId}:wc:${season}`)<.08)next.worldCupTitles++;return next})}

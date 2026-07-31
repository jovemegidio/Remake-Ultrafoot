// Motor de carreira — gera fixtures, simula rodadas CPU, atualiza tabela, controla finanças e mensagens.

import type { Team } from "@/lib/teams-data"
import { serieATeams, serieBTeams, getTeamsByDivision, completarLigaComPool } from "@/lib/teams-data"
import { simulateFullMatch } from "@/lib/match-engine"
import type { SavedTeam } from "@/lib/save-system"
import type {
  StandingEntry,
  MatchFixture,
  MatchResult,
  FinanceEntry,
  CareerMessage,
  SeasonRecord,
} from "@/lib/career-types"

export type {
  StandingEntry,
  MatchFixture,
  MatchResult,
  FinanceEntry,
  CareerMessage,
  SeasonRecord,
}

// ─── Equipes da Liga ───────────────────────────────────────────────────────────

/** Retorna 20 times para a liga do usuário, incluindo o time do usuário. */
export function getLeagueTeams(userTeam: SavedTeam): Team[] {
  // O FALLBACK ERA A SERIE A BRASILEIRA — e isso levava o grego a jogar o
  // Brasileirao. Onze divisoes tinham menos de oito clubes curados; escolher o
  // Olympiacos montava uma liga com dezenove clubes brasileiros. Agora a divisao
  // curta e completada com clubes do PROPRIO PAIS (pool importado), e a Serie A
  // so entra se de fato nao houver nada — o que, hoje, nao acontece para nenhuma
  // divisao. Ver completarLigaComPool em lib/teams-data.
  const divTeams = completarLigaComPool(userTeam.divisao as string)
  const base: Team[] = divTeams.length >= 8 ? divTeams : serieATeams

  const hasUser = base.some(t => t.curto === userTeam.curto)
  if (hasUser) return base.slice(0, 20)

  const userAsTeam: Team = {
    nome: userTeam.nome,
    curto: userTeam.curto,
    cor1: userTeam.cor1,
    cor2: userTeam.cor2,
    prestigio: userTeam.prestigio,
    saldo: userTeam.saldo,
    divisao: (userTeam.divisao as Team["divisao"]) || "serie_a",
    pais: userTeam.pais,
    cidade: userTeam.cidade ?? "",
    estado: userTeam.estado ?? "",
    torcida: userTeam.torcida ?? 50000,
    estadio_cap: userTeam.estadio_cap ?? 30000,
    file_key: userTeam.fileKey || userTeam.curto.toLowerCase(),
    estadio_nome: userTeam.estadio,
    patrocinador: userTeam.patrocinador ?? "",
    escudo_url: userTeam.escudo ?? "",
  }

  const sorted = [...base].sort((a, b) => b.prestigio - a.prestigio)
  return [userAsTeam, ...sorted.slice(0, 19)]
}

// ─── Round-Robin ───────────────────────────────────────────────────────────────

function buildRoundRobin(curtos: string[]): { home: string; away: string }[][] {
  const list = curtos.length % 2 === 0 ? [...curtos] : [...curtos, "__BYE__"]
  const n = list.length
  const rounds: { home: string; away: string }[][] = []

  for (let r = 0; r < n - 1; r++) {
    const round: { home: string; away: string }[] = []
    for (let i = 0; i < n / 2; i++) {
      const home = list[i]
      const away = list[n - 1 - i]
      if (home !== "__BYE__" && away !== "__BYE__") {
        round.push(r % 2 === 0 ? { home, away } : { home: away, away: home })
      }
    }
    rounds.push(round)
    // Rotate: fix index 0, rotate rest
    list.splice(1, 0, list.pop()!)
  }

  // Turno de volta: inverte casa/fora
  const secondHalf = rounds.map(r => r.map(f => ({ home: f.away, away: f.home })))
  return [...rounds, ...secondHalf]
}

/** Gera o calendário completo de uma temporada. */
export function generateSeasonFixtures(
  teams: Team[],
  userTeamCurto: string,
  season: number,
  competition = "Brasileirao Serie A"
): MatchFixture[] {
  const teamMap = new Map(teams.map(t => [t.curto, t]))
  const rounds = buildRoundRobin(teams.map(t => t.curto))
  const fixtures: MatchFixture[] = []

  rounds.forEach((round, roundIdx) => {
    round.forEach(({ home, away }) => {
      const homeTeam = teamMap.get(home)
      const awayTeam = teamMap.get(away)
      fixtures.push({
        id: `${season}_r${roundIdx + 1}_${home}_${away}`,
        round: roundIdx + 1,
        homeCurto: home,
        awayCurto: away,
        homeNome: homeTeam?.nome ?? home,
        awayNome: awayTeam?.nome ?? away,
        competition,
        played: false,
        isUserMatch: home === userTeamCurto || away === userTeamCurto,
      })
    })
  })

  return fixtures
}

/** Inicializa tabela zerada a partir dos times. */
export function initStandings(teams: Team[]): StandingEntry[] {
  return teams.map(t => ({
    curto: t.curto,
    nome: t.nome,
    cor1: t.cor1,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    points: 0,
    form: [],
  }))
}

/** Atualiza a tabela com o resultado de uma partida. */
export function updateStandings(
  standings: StandingEntry[],
  homeCurto: string,
  awayCurto: string,
  homeGoals: number,
  awayGoals: number
): StandingEntry[] {
  return standings.map(s => {
    if (s.curto !== homeCurto && s.curto !== awayCurto) return s

    const isHome = s.curto === homeCurto
    const gf = isHome ? homeGoals : awayGoals
    const ga = isHome ? awayGoals : homeGoals
    const diff = gf - ga

    let pts = 0
    let w = 0, d = 0, l = 0
    let res: "W" | "D" | "L"
    if (diff > 0) { w = 1; pts = 3; res = "W" }
    else if (diff === 0) { d = 1; pts = 1; res = "D" }
    else { l = 1; pts = 0; res = "L" }

    return {
      ...s,
      played: s.played + 1,
      won: s.won + w,
      drawn: s.drawn + d,
      lost: s.lost + l,
      goalsFor: s.goalsFor + gf,
      goalsAgainst: s.goalsAgainst + ga,
      goalDiff: s.goalDiff + diff,
      points: s.points + pts,
      form: [res, ...s.form].slice(0, 5) as ("W" | "D" | "L")[],
    }
  })
}

/** Ordena a tabela: pontos → SG → GP → nome. */
export function sortStandings(standings: StandingEntry[]): StandingEntry[] {
  return [...standings].sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDiff - a.goalDiff ||
      b.goalsFor - a.goalsFor ||
      a.nome.localeCompare(b.nome)
  )
}

// ─── Simulação CPU ─────────────────────────────────────────────────────────────

/** Simula todas as partidas CPU de uma rodada (excluindo a partida do usuário). */
export function simulateCPURound(
  fixtures: MatchFixture[],
  round: number,
  userTeamCurto: string,
  leagueTeams: Team[],
  season: number
): { fixtures: MatchFixture[]; results: MatchResult[] } {
  const teamMap = new Map(leagueTeams.map(t => [t.curto, t]))
  const roundFixtures = fixtures.filter(f => f.round === round && !f.played && !f.isUserMatch)
  const results: MatchResult[] = []
  const updated = fixtures.map(f => ({ ...f }))

  for (const fixture of roundFixtures) {
    const homeTeam = teamMap.get(fixture.homeCurto)
    const awayTeam = teamMap.get(fixture.awayCurto)
    if (!homeTeam || !awayTeam) continue

    const matchState = simulateFullMatch({
      homeTeam,
      awayTeam,
      homeRating: homeTeam.prestigio,
      awayRating: awayTeam.prestigio,
      durationMinutes: 90,
    })

    const homeGoals = matchState.home.goals
    const awayGoals = matchState.away.goals

    const idx = updated.findIndex(f => f.id === fixture.id)
    if (idx !== -1) {
      updated[idx] = { ...updated[idx], played: true, homeGoals, awayGoals }
    }

    results.push({
      id: fixture.id,
      round,
      season,
      homeCurto: fixture.homeCurto,
      homeNome: fixture.homeNome,
      awayCurto: fixture.awayCurto,
      awayNome: fixture.awayNome,
      homeGoals,
      awayGoals,
      competition: fixture.competition,
      isUserMatch: false,
    })
  }

  return { fixtures: updated, results }
}

// ─── Finanças ──────────────────────────────────────────────────────────────────

/** Calcula receitas/despesas para uma rodada. */
export function calcRoundFinances(
  userTeam: SavedTeam,
  round: number,
  season: number,
  isHome: boolean,
  matchWon: boolean,
  matchDrawn: boolean
): FinanceEntry[] {
  const entries: FinanceEntry[] = []

  if (round % 4 === 0) {
    const tvValue = Math.round(Math.max(500000, userTeam.prestigio * 85000))
    entries.push({
      id: `tv_${season}_${round}`,
      type: "income",
      description: "Cota mensal de direitos de TV",
      value: tvValue,
      week: round,
      season,
      category: "tv",
    })
  }

  if (round % 2 === 0) {
    const patrocinio = Math.round(Math.max(200000, userTeam.prestigio * 25000))
    entries.push({
      id: `pat_${season}_${round}`,
      type: "income",
      description: "Patrocinio — parcela quinzenal",
      value: patrocinio,
      week: round,
      season,
      category: "patrocinio",
    })
  }

  if (isHome) {
    const cap = userTeam.estadio_cap ?? 30000
    const fillRate = matchWon ? 0.82 : matchDrawn ? 0.68 : 0.58
    const ticketPrice = 55 + userTeam.prestigio * 0.9
    const bilheteria = Math.round(cap * fillRate * ticketPrice)
    entries.push({
      id: `bilheteria_${season}_${round}`,
      type: "income",
      description: `Bilheteria — Rodada ${round}`,
      value: bilheteria,
      week: round,
      season,
      category: "bilheteria",
    })
  }

  if (round % 4 === 1) {
    const salario = Math.round(Math.max(300000, userTeam.saldo * 0.022))
    entries.push({
      id: `salario_${season}_${round}`,
      type: "expense",
      description: "Folha salarial — pagamento mensal",
      value: salario,
      week: round,
      season,
      category: "salario",
    })
    const manutencao = Math.round(Math.max(50000, userTeam.estadio_cap ?? 30000) * 3)
    entries.push({
      id: `manutencao_${season}_${round}`,
      type: "expense",
      description: "Manutencao e infraestrutura",
      value: manutencao,
      week: round,
      season,
      category: "manutencao",
    })
  }

  return entries
}

// ─── Mensagens ─────────────────────────────────────────────────────────────────

/** Gera mensagem após resultado de partida do usuário. */
export function generateMatchMessage(
  result: MatchResult,
  userTeamCurto: string,
  managerName: string
): CareerMessage {
  const isHome = result.homeCurto === userTeamCurto
  const userGoals = isHome ? result.homeGoals : result.awayGoals
  const oppGoals = isHome ? result.awayGoals : result.homeGoals
  const oppNome = isHome ? result.awayNome : result.homeNome

  let subject: string
  let content: string
  let from = "Comissao Tecnica"
  let category: CareerMessage["category"] = "resultado"

  if (userGoals > oppGoals) {
    subject = `Vitoria ${userGoals}x${oppGoals} contra ${oppNome}!`
    content = `Parabens, ${managerName}!\n\nExcelente vitoria por ${userGoals} a ${oppGoals} contra ${oppNome}. O elenco respondeu bem taticamente e a equipe mostrou consistencia.\n\nContinue assim — estamos no caminho certo!`
  } else if (userGoals === oppGoals) {
    subject = `Empate ${userGoals}x${oppGoals} com ${oppNome}`
    content = `Rodada ${result.round} encerrada com empate em ${userGoals} a ${oppGoals} diante de ${oppNome}.\n\nResultado justo pelo que foi apresentado em campo. Precisamos melhorar a eficiencia ofensiva para conquistar os 3 pontos nas proximas rodadas.`
    from = "Analise Tatica"
  } else {
    subject = `Derrota ${userGoals}x${oppGoals} para ${oppNome}`
    content = `A diretoria lamenta a derrota por ${userGoals} a ${oppGoals} para ${oppNome} na rodada ${result.round}.\n\nEsperamos uma rapida recuperacao. Analise os pontos fracos da equipe e ajuste a tatica para os proximos compromissos.`
    from = "Diretoria"
    category = "diretoria"
  }

  return {
    id: `msg_result_${result.id}`,
    from,
    subject,
    preview: subject,
    fullContent: content,
    date: `Rodada ${result.round}`,
    read: false,
    starred: false,
    archived: false,
    deleted: false,
    category,
    week: result.round,
    season: result.season,
  }
}

/** Gera mensagem de boas-vindas ao iniciar carreira. */
export function generateWelcomeMessages(
  teamNome: string,
  managerName: string,
  season: number
): CareerMessage[] {
  return [
    {
      id: `welcome_${season}`,
      from: "Diretoria",
      subject: `Bem-vindo a nova temporada ${season}!`,
      preview: `A diretoria do clube deseja a voce uma excelente temporada ${season}.`,
      fullContent: `A diretoria do ${teamNome} deseja a voce, ${managerName}, uma excelente temporada ${season}.\n\nNossas metas foram definidas e contamos com seu trabalho para levar o time ao mais alto nivel. Boa sorte, tecnico!\n\nAbrace cada rodada como uma oportunidade. Estamos confiantes no seu trabalho.`,
      date: "Pre-temporada",
      read: false,
      starred: true,
      archived: false,
      deleted: false,
      category: "diretoria",
      week: 0,
      season,
    },
    {
      id: `preseason_${season}`,
      from: "Comissao Tecnica",
      subject: "Relatorio de pre-temporada",
      preview: "Os jogadores estao em otimas condicoes e prontos para o inicio do campeonato.",
      fullContent: `Relatorio completo da pre-temporada do ${teamNome}:\n\n- Departamento medico: sem lesoes graves registradas\n- Condicao fisica: 85% do plantel em nivel otimo\n- Treinos taticos: esquemas bem absorvidos pelo grupo\n- Moral do elenco: alta — elenco motivado para a temporada\n\nRecomendamos manter a intensidade dos treinos nas primeiras semanas de competicao.`,
      date: "Pre-temporada",
      read: false,
      starred: false,
      archived: false,
      deleted: false,
      category: "staff",
      week: 0,
      season,
    },
  ]
}

/** Gera mensagem de fim de temporada. */
export function generateEndSeasonMessage(
  teamNome: string,
  position: number,
  points: number,
  champion: string,
  relegated: boolean,
  promoted: boolean,
  season: number
): CareerMessage {
  let subject: string
  let content: string
  let category: CareerMessage["category"] = "competicao"
  let starred = false

  if (position === 1) {
    subject = `CAMPEAO! ${teamNome} conquista o titulo da temporada ${season}!`
    content = `HISTORIA! O ${teamNome} e CAMPEAO da temporada ${season} com ${points} pontos!\n\nUma temporada historica sob o comando de nosso tecnico. Parabens a todos!`
    starred = true
  } else if (promoted) {
    subject = `Acesso conquistado! ${teamNome} sobe de divisao!`
    content = `O ${teamNome} garantiu o acesso na temporada ${season} terminando na ${position}a posicao com ${points} pontos.\n\nAgora e hora de planejar o proximo nivel!`
    starred = true
  } else if (relegated) {
    subject = `Rebaixamento — ${teamNome} cai de divisao`
    content = `Infelizmente o ${teamNome} foi rebaixado nesta temporada terminando na ${position}a posicao com ${points} pontos.\n\nPrecisamos fazer uma analise profunda e reestruturar o elenco para retornar a elite.`
    category = "diretoria"
  } else {
    subject = `Temporada ${season} encerrada — ${position}o lugar com ${points} pts`
    content = `A temporada ${season} chegou ao fim. O ${teamNome} terminou na ${position}a posicao com ${points} pontos.\n\nO campeao da temporada foi: ${champion}.\n\nAnalise os pontos de melhoria para a proxima temporada.`
  }

  return {
    id: `season_end_${season}`,
    from: "CBF / Competicao",
    subject,
    preview: subject,
    fullContent: content,
    date: `Fim da Temporada ${season}`,
    read: false,
    starred,
    archived: false,
    deleted: false,
    category,
    week: 38,
    season,
  }
}

// ─── Fim de Temporada ──────────────────────────────────────────────────────────

export function endSeason(standings: StandingEntry[]): {
  champion: string
  promoted: string[]
  relegated: string[]
} {
  const sorted = sortStandings(standings)
  const n = sorted.length
  return {
    champion: sorted[0]?.curto ?? "",
    promoted: sorted.slice(0, 4).map(s => s.curto),
    relegated: sorted.slice(Math.max(0, n - 4), n).map(s => s.curto),
  }
}

/** Calcula o saldo total a partir de uma lista de transações. */
export function calcBalanceFromFinances(
  baseBalance: number,
  finances: FinanceEntry[]
): number {
  return finances.reduce((total, f) => {
    return f.type === "income" ? total + f.value : total - f.value
  }, baseBalance)
}

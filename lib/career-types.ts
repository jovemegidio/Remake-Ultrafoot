// Tipos de dados da carreira — usados pelo save-system e career-engine
// Sem dependências de outros módulos do jogo para evitar importações circulares.

export interface StandingEntry {
  curto: string
  nome: string
  cor1: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
  points: number
  form: ('W' | 'D' | 'L')[]
}

export interface MatchFixture {
  id: string
  round: number
  homeCurto: string
  awayCurto: string
  homeNome: string
  awayNome: string
  competition: string
  played: boolean
  homeGoals?: number
  awayGoals?: number
  isUserMatch: boolean
}

export interface MatchResult {
  id: string
  round: number
  season: number
  homeCurto: string
  homeNome: string
  awayCurto: string
  awayNome: string
  homeGoals: number
  awayGoals: number
  competition: string
  isUserMatch: boolean
}

export interface FinanceEntry {
  id: string
  type: 'income' | 'expense'
  description: string
  value: number
  week: number
  season: number
  category: 'tv' | 'bilheteria' | 'patrocinio' | 'premiacao' | 'salario' | 'manutencao' | 'transferencia' | 'outros'
}

export interface CareerMessage {
  id: string
  from: string
  subject: string
  preview: string
  fullContent: string
  date: string
  read: boolean
  starred: boolean
  archived: boolean
  deleted: boolean
  category: 'diretoria' | 'staff' | 'mercado' | 'competicao' | 'resultado'
  week: number
  season: number
}

export interface SeasonRecord {
  season: number
  competition: string
  position: number
  points: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  champion: string
  managerName: string
  promoted: boolean
  relegated: boolean
  teamCurto: string
  teamNome: string
}

/**
 * TIPO DE MOVIMENTACAO no elenco.
 *
 * Era so `buy | sell | loan`, e por isso o save guardava um recorte do que o
 * tecnico fez: compra pelo mercado e venda de jovem entravam, mas rescisao,
 * renovacao, emprestimo de saida, devolucao, promocao da base, fim de contrato e
 * leilao nao existiam em lugar nenhum — nem no historico, nem no save. Pedido:
 * "ao salvar deve salvar tudo... todas as movimentacoes feitas pelo jogador".
 *
 * Os tres antigos continuam com o MESMO significado (challenge-engine conta
 * `type === "buy"` para o desafio de nao contratar), entao saves anteriores
 * seguem sendo lidos sem migracao.
 */
export type TransferRecordType =
  | 'buy'          // contratacao em definitivo (mercado, livre, junior)
  | 'sell'         // venda em definitivo
  | 'loan'         // empréstimo de ENTRADA (compatibilidade: era o unico que existia)
  | 'loan_out'     // empréstimo de SAIDA
  | 'loan_return'  // fim/devolucao de empréstimo
  | 'loan_buy'     // opcao de compra exercida ao fim do empréstimo
  | 'auction'      // saida por leilao
  | 'release'      // rescisao ou fim de contrato
  | 'renew'        // renovacao de contrato
  | 'promote'      // subiu da base ao profissional
  | 'retire'       // encerrou a carreira

export interface TransferRecord {
  id: string
  playerName: string
  fromTeam: string
  toTeam: string
  value: number
  type: TransferRecordType
  week: number
  season: number
  /** Linha em português para a tela de movimentações (opcional em saves antigos). */
  detalhe?: string
  /** Quando aconteceu, em tempo real — ordena o extrato quando semana/temporada empatam. */
  em?: number
}

/** Lesão ativa de um jogador. weeksRemaining decrementa a cada rodada. */
export interface InjuryRecord {
  playerId: string
  playerName: string
  type: 'leve' | 'moderada' | 'grave'
  weeksRemaining: number
  startedRound: number
  startedSeason: number
}

/** Mapa playerId -> stamina atual (0-100). Persistido entre rodadas. */
export type FatigueMap = Record<string, number>

/** Acumulado de envelhecimento e mudança de overall por jogador (relativo ao seed base). */
export interface PlayerProgression {
  ageDelta: number       // anos somados
  overallDelta: number   // pontos somados (pode ser negativo)
}

export type ProgressionMap = Record<string, PlayerProgression>

/** Alvo de transferência exposto ao usuário (vitrine do mercado). */
export interface MarketTarget {
  id: string
  name: string
  position: string
  age: number
  overall: number
  potential: number
  value: number
  teamCurto: string
  teamNome: string
  teamCor1: string
  trend: 'up' | 'down' | 'stable'
}

/** Partida da copa eliminatória (Copa do Brasil / Libertadores). */
export interface CupMatch {
  id: string
  cupRound: number       // 1=oitavas, 2=quartas, 3=semi, 4=final
  bracketSlot: number    // posição no chaveamento (0-7 oitavas, 0-3 quartas, etc)
  homeCurto: string
  awayCurto: string
  homeNome: string
  awayNome: string
  played: boolean
  /** Jogo de IDA (na casa de homeCurto). */
  homeGoals?: number
  awayGoals?: number
  /** Jogo de VOLTA — o mandante e o awayCurto. Ausente em jogo unico (final). */
  leg2HomeGoals?: number   // gols do awayCurto jogando em casa
  leg2AwayGoals?: number   // gols do homeCurto jogando fora
  twoLegged?: boolean
  /** Agregado [homeCurto, awayCurto] apos os dois jogos. */
  aggHome?: number
  aggAway?: number
  /** Penaltis — so quando o agregado empata (sem gol qualificado fora de casa). */
  penaltiesHome?: number
  penaltiesAway?: number
  /** Curto do classificado. */
  winnerCurto?: string
  isUserMatch: boolean
}

/** Chaveamento completo de uma copa eliminatória. */
export interface CupBracket {
  competition: string
  season: number
  matches: CupMatch[]
  champion?: string
  userEliminatedAtRound?: number
  /** Round eliminatório atual sendo disputado (1-4). 0 = não iniciado. */
  currentCupRound: number
}

/** Oferta recebida pelo usuário por algum dos seus jogadores. */
export interface IncomingOffer {
  id: string
  playerId: string         // nome do jogador (squadPlayers.name) ou base player name
  playerName: string
  fromTeamCurto: string
  fromTeamNome: string
  fromTeamCor1: string
  value: number
  reservationPrice: number  // valor minimo que CPU aceita (escondido do usuario)
  status: 'pending' | 'accepted' | 'rejected' | 'countered'
  receivedRound: number
  receivedSeason: number
  expiresInRounds: number   // expira apos N rodadas se nao respondida
}

// Sistema central do jogo - gerencia jogadores, contratos, lesoes, treinamento, temporada, etc.

"use client"

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createTauriZustandStorage, storeSet } from "@/lib/persistent-store"
import { getCareerScopedKey } from "@/lib/save-system"
import { allTeams, getTeamByShort } from "@/lib/teams-data"
import { getCanonicalSeedPosition, getPlayersForTeam } from "@/lib/players-data"
import { getClubAIConfig, evaluateBuy } from "@/lib/ai-club-engine"
import { pickStartingXI } from "@/lib/formations"
import { infrastructureUpgradeWeeks, type TicketTier } from "@/lib/stadium-economy"

// ============================================
// TIPOS E INTERFACES
// ============================================

export interface ContractBonus {
  type: "goals" | "assists" | "titles" | "appearances" | "cleanSheets" | "nationalTeam"
  threshold: number // Quantidade necessaria
  amount: number // Valor do bonus
  achieved: boolean
}

/**
 * Custo de rescindir um contrato: salário restante até o vencimento, com 40% de
 * desconto (acordo negociado). Piso de 4 semanas para que dispensar alguém de
 * contrato quase vencido ainda custe algo.
 */
/**
 * A contratação estoura o teto salarial da diretoria?
 *
 * `wageBudget` é MENSAL (o save o calcula como folha semanal x 4 com margem),
 * então a folha semanal precisa ser convertida antes de comparar.
 */
export function exceedsWageBudget(
  state: { squadPlayers: { contract?: { salary: number } | null }[]; wageBudget: number },
  newSalary: number,
): boolean {
  if (state.wageBudget <= 0) return false
  const currentWeekly = state.squadPlayers.reduce((sum, p) => sum + (p.contract?.salary ?? 0), 0)
  return (currentWeekly + newSalary) * 4 > state.wageBudget
}

export function terminationCost(
  player: { contract?: { salary: number; endDate: number } | null },
  currentWeek: number,
): number {
  const salary = player.contract?.salary ?? 0
  if (salary <= 0) return 0
  const weeksLeft = Math.max(4, (player.contract?.endDate ?? currentWeek) - currentWeek)
  return Math.round(salary * weeksLeft * 0.6)
}

export interface PlayerContract {
  salary: number // Salario semanal
  endDate: number // Semana de termino (week absoluto)
  releaseClause: number | null
  signedWeek: number
  signedSeason: number
  // Clausulas de bonus
  bonuses?: ContractBonus[]
  // Opcao de renovacao automatica
  autoRenewalOption?: boolean
  autoRenewalWeeks?: number // Semanas adicionais se renovar
  // Clausula de revenda (% para time anterior)
  resaleClause?: number // 0-50%
  previousClub?: string | null
  // Clausulas toxicas
  clauses?: ContractClause[]
  // Fatiamento de direitos de passe
  ownedPercentage?: number // 0-100 — % que o clube possui
  fundPercentage?: number  // % pertencente a fundo de investimento
  fundName?: string        // Nome do fundo
  fundForceSaleWeek?: number // Semana em que o fundo pode forcar venda
}

// ============================================
// CLAUSULAS TOXICAS DE CONTRATO
// ============================================

export type ContractClauseType =
  | "min_starter_pct"    // Jogador precisa ser titular X% dos jogos
  | "no_bench_streak"    // Nao pode ficar X jogos seguidos no banco
  | "performance_bonus_mandatory" // Bonus obrigatorio se atingir meta
  | "loan_recall"        // Clube pode chamar de volta antes do fim

export interface ContractClause {
  id: number
  type: ContractClauseType
  description: string
  threshold: number   // ex: 80 para "80% como titular"
  penaltyAmount: number  // multa se descumprir
  weeksToAudit: number   // frequencia da auditoria
  lastAuditedWeek: number
  breached: boolean
  active: boolean
}

// ============================================
// STATUS EFFECTS (TRAUMAS E VIRTUDES)
// ============================================

export type StatusEffectType =
  // Traumas (negativos)
  | "trauma_derrota_historica"  // Ex: Maracanasso — -15% atributos mentais
  | "trauma_lesao_grave"        // Medo de se machucar — -10% pace/physical
  | "trauma_vaias_torcida"      // Publico hostil — -10% em jogos em casa
  | "bode_expiatorio"           // Torcida pegou no pe — -12% geral
  // Virtudes (positivos)
  | "heroi_titulo"              // Fez gol do titulo — +10% lideranca/moral permanente
  | "idolo_historico"           // Lenda do clube — +8% geral em partidas em casa
  | "veterano_invicto"          // Nunca perdeu derby — +5% em clasicos
  | "destaque_midia"            // Destaque da semana — +5% forma por 4 semanas
  // Psicologicos
  | "momentum_positivo"         // 3+ vitorias seguidas — +8% confianca
  | "crise_confianca"           // 3+ derrotas seguidas — -10% geral
  | "peso_camisa"               // Grande clube lutando contra rebaixamento — -12% geral

export interface StatusEffect {
  id: number
  type: StatusEffectType
  label: string
  description: string
  // Modificadores numericos (aplicados ao overall para calculo de partida)
  overallModifier: number  // -20 a +20
  moraleModifier: number   // -20 a +20
  // Duracao (null = permanente)
  durationWeeks: number | null
  appliedWeek: number
  // Condicoes de cura (para traumas curáveis)
  cureCondition?: {
    type: "win_derby" | "win_title" | "clean_sheet_streak" | "time" | "sold"
    threshold: number // ex: 5 clean sheets seguidos
    progress: number
  }
  isPermanent: boolean
  isPositive: boolean
}

export const STATUS_EFFECT_TEMPLATES: Record<StatusEffectType, Omit<StatusEffect, "id" | "appliedWeek">> = {
  trauma_derrota_historica: {
    type: "trauma_derrota_historica", label: "Trauma: Derrota Histórica",
    description: "Carrega o peso de uma derrota marcante. Atributos mentais reduzidos.",
    overallModifier: -8, moraleModifier: -15, durationWeeks: null,
    cureCondition: { type: "win_derby", threshold: 1, progress: 0 },
    isPermanent: false, isPositive: false
  },
  trauma_lesao_grave: {
    type: "trauma_lesao_grave", label: "Medo de Lesão",
    description: "Recuperado fisicamente mas psicologicamente abalado. Evita disputas duras.",
    overallModifier: -5, moraleModifier: -8, durationWeeks: 12,
    cureCondition: { type: "time", threshold: 12, progress: 0 },
    isPermanent: false, isPositive: false
  },
  trauma_vaias_torcida: {
    type: "trauma_vaias_torcida", label: "Trauma: Vaias da Torcida",
    description: "A torcida o perseguiu. Rende menos jogando em casa.",
    overallModifier: -10, moraleModifier: -12, durationWeeks: null,
    cureCondition: { type: "win_title", threshold: 1, progress: 0 },
    isPermanent: false, isPositive: false
  },
  bode_expiatorio: {
    type: "bode_expiatorio", label: "Bode Expiatório",
    description: "A torcida colocou toda a culpa nele. Precisa ser vendido ou curado.",
    overallModifier: -12, moraleModifier: -20, durationWeeks: null,
    cureCondition: { type: "sold", threshold: 1, progress: 0 },
    isPermanent: false, isPositive: false
  },
  heroi_titulo: {
    type: "heroi_titulo", label: "Herói do Título",
    description: "Fez o gol que trouxe o título. Ídolo eterno da torcida.",
    overallModifier: 6, moraleModifier: 15, durationWeeks: null,
    isPermanent: true, isPositive: true
  },
  idolo_historico: {
    type: "idolo_historico", label: "Ídolo Histórico",
    description: "Reconhecido como lenda pelo clube e pela torcida.",
    overallModifier: 8, moraleModifier: 20, durationWeeks: null,
    isPermanent: true, isPositive: true
  },
  veterano_invicto: {
    type: "veterano_invicto", label: "Veterano Invicto em Clássicos",
    description: "Nunca perdeu um clássico. Emana autoridade nos duelos.",
    overallModifier: 5, moraleModifier: 10, durationWeeks: null,
    isPermanent: true, isPositive: true
  },
  destaque_midia: {
    type: "destaque_midia", label: "Destaque da Semana",
    description: "Está em alta na mídia. Maior confiança por algumas semanas.",
    overallModifier: 5, moraleModifier: 8, durationWeeks: 4,
    isPermanent: false, isPositive: true
  },
  momentum_positivo: {
    type: "momentum_positivo", label: "Momento Positivo",
    description: "O time está em uma sequência de vitórias. Confiança elevada.",
    overallModifier: 8, moraleModifier: 12, durationWeeks: null,
    cureCondition: { type: "time", threshold: 0, progress: 0 },
    isPermanent: false, isPositive: true
  },
  crise_confianca: {
    type: "crise_confianca", label: "Crise de Confiança",
    description: "3 ou mais derrotas seguidas. O grupo está abalado.",
    overallModifier: -10, moraleModifier: -15, durationWeeks: null,
    cureCondition: { type: "win_derby", threshold: 2, progress: 0 },
    isPermanent: false, isPositive: false
  },
  peso_camisa: {
    type: "peso_camisa", label: "Peso da Camisa",
    description: "Grande clube em crise. A ansiedade coletiva compromete o rendimento.",
    overallModifier: -12, moraleModifier: -18, durationWeeks: null,
    cureCondition: { type: "time", threshold: 0, progress: 0 },
    isPermanent: false, isPositive: false
  },
}

// ============================================
// PANELINHAS (GRUPOS DE AFINIDADE)
// ============================================

export type AffinityGroupType =
  | "mesma_nacionalidade"
  | "mesmo_ex_clube"
  | "mesma_faixa_etaria"
  | "companheiros_selecao"

export interface AffinityGroup {
  id: number
  type: AffinityGroupType
  label: string
  memberIds: number[]    // IDs dos jogadores do grupo
  leaderId: number       // Jogador com mais influencia
  cohesion: number       // 0-100 — unidade do grupo
  loyaltyToCoach: number // 0-100 — lealdade ao treinador
  // Modificador de entrosamento em campo
  chemistryBonus: number // +1 a +5 no overall de partida para membros do grupo
}

// ============================================
// MARKETING DINAMICO
// ============================================

export type MarketingCampaignType =
  | "esquadrao_imbativel"   // Promete time invencivel — alta receita, meta de G4
  | "revelacao_da_base"     // Foca em jovens — receita moderada, sem meta rigida
  | "retorno_da_lenda"      // Contrata estrela — mega receita, meta de titulo
  | "projeto_futuro"        // Vende ideia de reconstrucao — baixa receita, sem pressao

export interface MarketingContract {
  id: number
  type: MarketingCampaignType
  name: string
  description: string
  sponsor: string
  // Financeiro
  upfrontPayment: number     // Pagamento imediato
  weeklyBonus: number        // Bonus semanal se cumprir meta
  penaltyAmount: number      // Multa por quebra de meta
  // Meta de desempenho
  performanceGoal: {
    type: "min_table_position" | "win_title" | "no_relegation" | "none"
    threshold: number // ex: 4 para "estar no G4"
    checkWeek: number // semana que a meta é auditada
  }
  startWeek: number
  endWeek: number
  active: boolean
  breached: boolean
  fulfilled: boolean
}

export const MARKETING_CAMPAIGN_TEMPLATES: Record<MarketingCampaignType, Omit<MarketingContract, "id" | "startWeek" | "endWeek" | "active" | "breached" | "fulfilled">> = {
  esquadrao_imbativel: {
    type: "esquadrao_imbativel", name: "Esquadrão Imbatível",
    description: "Campanha agressiva que posiciona o time como favorito absoluto.",
    sponsor: "Bet+ Sports",
    upfrontPayment: 8000000, weeklyBonus: 200000, penaltyAmount: 15000000,
    performanceGoal: { type: "min_table_position", threshold: 4, checkWeek: 38 }
  },
  revelacao_da_base: {
    type: "revelacao_da_base", name: "Revelação da Base",
    description: "Campanha focada em jovens talentos. Imagem positiva sem metas agressivas.",
    sponsor: "Globo Esporte",
    upfrontPayment: 3000000, weeklyBonus: 80000, penaltyAmount: 0,
    performanceGoal: { type: "none", threshold: 0, checkWeek: 38 }
  },
  retorno_da_lenda: {
    type: "retorno_da_lenda", name: "Retorno da Lenda",
    description: "Grande contratação como âncora da campanha. Expectativa máxima.",
    sponsor: "Nike Brasil",
    upfrontPayment: 12000000, weeklyBonus: 400000, penaltyAmount: 25000000,
    performanceGoal: { type: "win_title", threshold: 1, checkWeek: 38 }
  },
  projeto_futuro: {
    type: "projeto_futuro", name: "Projeto Futuro",
    description: "Vende reconstrução ao torcedor. Baixa pressão, receita moderada.",
    sponsor: "Banco do Brasil",
    upfrontPayment: 2000000, weeklyBonus: 50000, penaltyAmount: 0,
    performanceGoal: { type: "no_relegation", threshold: 16, checkWeek: 38 }
  },
}

// ============================================
// GESTAO DE STAFF
// ============================================

export type StaffRole =
  | "diretor_futebol"
  | "chefe_seguranca"
  | "psicologo_chefe"
  | "diretor_marketing"
  | "chefe_medico"
  | "coordenador_base"

export interface StaffMember {
  id: number
  name: string
  role: StaffRole
  // Atributos (0-100)
  competence: number
  loyalty: number
  // Efeitos passivos
  passiveEffect: string // descricao do efeito passivo
  salary: number // semanal
  hiredWeek: number
  hiredSeason: number
  // Chance de causar problemas se competencia baixa
  problemChance: number // 0-1
}

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  diretor_futebol: "Diretor de Futebol",
  chefe_seguranca: "Chefe de Segurança",
  psicologo_chefe: "Psicólogo Chefe",
  diretor_marketing: "Diretor de Marketing",
  chefe_medico: "Chefe Médico",
  coordenador_base: "Coordenador de Base",
}

export const AVAILABLE_STAFF: Omit<StaffMember, "hiredWeek" | "hiredSeason">[] = [
  { id: 101, name: "Eduardo Barros", role: "diretor_futebol", competence: 82, loyalty: 75, passiveEffect: "Negocia contratos com 15% de desconto. Bônus +10% qualidade de scouting.", salary: 80000, problemChance: 0.05 },
  { id: 102, name: "Marcus Silva", role: "diretor_futebol", competence: 65, loyalty: 90, passiveEffect: "Bônus +5% qualidade de scouting. Pode impor metas irreais.", salary: 45000, problemChance: 0.15 },
  { id: 103, name: "Roberto Campos", role: "chefe_seguranca", competence: 88, loyalty: 80, passiveEffect: "Reduz probabilidade de eventos negativos de torcida em 60%.", salary: 35000, problemChance: 0.03 },
  { id: 104, name: "Antônio Ramos", role: "chefe_seguranca", competence: 55, loyalty: 70, passiveEffect: "Reduz probabilidade de eventos negativos em 20%.", salary: 20000, problemChance: 0.20 },
  { id: 105, name: "Dra. Paula Menezes", role: "psicologo_chefe", competence: 90, loyalty: 85, passiveEffect: "Curas de trauma 2x mais rápidas. Bônus +8 moral do elenco.", salary: 50000, problemChance: 0.02 },
  { id: 106, name: "Dr. Sérgio Lima", role: "psicologo_chefe", competence: 68, loyalty: 65, passiveEffect: "Curas de trauma ligeiramente aceleradas. Bônus +3 moral.", salary: 30000, problemChance: 0.10 },
  { id: 107, name: "Carlos Menezes", role: "diretor_marketing", competence: 85, loyalty: 75, passiveEffect: "Receita de marketing +20%. Negocia cláusulas mais justas.", salary: 70000, problemChance: 0.08 },
  { id: 108, name: "Fábio Alves", role: "diretor_marketing", competence: 62, loyalty: 80, passiveEffect: "Receita de marketing +8%. Pode criar expectativas irreais.", salary: 40000, problemChance: 0.18 },
  { id: 109, name: "Dr. André Costa", role: "chefe_medico", competence: 88, loyalty: 90, passiveEffect: "Recuperação de lesões 25% mais rápida. Risco de lesão -15%.", salary: 55000, problemChance: 0.02 },
  { id: 110, name: "Dr. Renato Melo", role: "chefe_medico", competence: 70, loyalty: 75, passiveEffect: "Recuperação de lesões 10% mais rápida.", salary: 35000, problemChance: 0.08 },
  { id: 111, name: "Júnior Santos", role: "coordenador_base", competence: 80, loyalty: 85, passiveEffect: "Jovens gerados pela base chegam com +5 overall e +8 potencial.", salary: 40000, problemChance: 0.04 },
  { id: 112, name: "Marcos Oliveira", role: "coordenador_base", competence: 60, loyalty: 70, passiveEffect: "Leve melhora na qualidade dos jovens da base.", salary: 25000, problemChance: 0.12 },
]

// Historico de confrontos entre times
export interface HeadToHead {
  team1: string
  team2: string
  matches: HeadToHeadMatch[]
  team1Wins: number
  team2Wins: number
  draws: number
  team1Goals: number
  team2Goals: number
}

export interface HeadToHeadMatch {
  season: number
  week: number
  competition: string
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
}

export interface PlayerInjury {
  type: string
  severity: "leve" | "media" | "grave"
  weeksRemaining: number
  startWeek: number
}

export interface PlayerStats {
  goals: number
  assists: number
  yellowCards: number
  redCards: number
  matchesPlayed: number
  minutesPlayed: number
  cleanSheets: number // para goleiros
  manOfTheMatch: number
}

export interface PlayerTraining {
  currentFocus: string | null // atributo sendo treinado
  weeksTrained: number
  lastTrainingWeek: number
}

export interface Player {
  id: number
  name: string
  position: string
  secondaryPositions?: string[]
  age: number
  overall: number
  potential: number
  nationality: string
  
  // Atributos
  pace: number
  shooting: number
  passing: number
  dribbling: number
  defending: number
  physical: number
  
  // Status
  energy: number
  morale: "Feliz" | "Motivado" | "Normal" | "Insatisfeito" | "Infeliz"
  form: number // 0-100
  
  // Contrato
  contract: PlayerContract | null
  
  // Lesao
  injury: PlayerInjury | null
  
  // Estatisticas da temporada
  seasonStats: PlayerStats
  
  // Treinamento
  training: PlayerTraining
  
  // Selecao
  nationalTeam: string | null
  calledUp: boolean
  
  // Valores
  shirtNumber?: number
  marketValue: number
  
  // Historico
  joinedClubWeek: number
  joinedClubSeason: number
  isLoanedIn: boolean
  loanedOut?: boolean
  loanEndWeek?: number
  loanSalaryReduction?: number
  parentClub?: string

  // Escalacao manual (true = titular, false = reserva)
  isStarter?: boolean

  // Status Effects permanentes/temporarios (traumas, virtudes, momentum)
  statusEffects?: StatusEffect[]

  // Ex-clube (para deteccao de panelinhas)
  previousClubShort?: string
}

export interface Scout {
  id: number
  name: string
  region: string // "Brasil" | "Europa" | "Americas" | "Asia"
  skill: number // 1-5 estrelas
  salary: number
  nationality?: string
  isSearching: boolean
  searchProgress: number
  searchTarget?: string | null
  weeksSearching?: number
  foundPlayers: number[] // IDs dos jogadores descobertos
  weeksToComplete?: number // semanas restantes para completar busca
  searchCost?: number // custo da viagem/busca
  /**
   * O QUE o olheiro foi procurar (pedido: "dizer qual jogador voce procura").
   * Sem isto ele saia e trazia qualquer coisa; agora a missao tem alvo.
   */
  searchCriteria?: ScoutCriteria | null
}

export interface ScoutCriteria {
  /** Posicao desejada; vazio = qualquer. */
  position?: string | null
  /** Potencial minimo aceitavel — filtra o que o olheiro reporta. */
  minPotential?: number
  /** Idade maxima (buscar promessa jovem x pronto). */
  maxAge?: number
}

export interface ScoutedPlayer {
  id: number
  name: string
  position: string
  team: string
  age: number
  nationality: string
  overall: number
  potential: number
  value: number
  reportProgress: number
}

export const AVAILABLE_SCOUTS: Omit<Scout, "isSearching" | "searchProgress" | "foundPlayers">[] = [
  { id: 201, name: "Carlos Mendes", region: "Brasil", skill: 4, salary: 25000, nationality: "Brasileiro", weeksToComplete: 4, searchCost: 10000 },
  { id: 202, name: "Roberto Alves", region: "Brasil", skill: 3, salary: 15000, nationality: "Brasileiro", weeksToComplete: 4, searchCost: 8000 },
  { id: 203, name: "Juan Garcia", region: "Americas", skill: 4, salary: 30000, nationality: "Argentino", weeksToComplete: 6, searchCost: 20000 },
  { id: 204, name: "Hans Mueller", region: "Europa", skill: 5, salary: 50000, nationality: "Alemão", weeksToComplete: 8, searchCost: 40000 },
  { id: 205, name: "Pierre Dupont", region: "Europa", skill: 4, salary: 35000, nationality: "Francês", weeksToComplete: 8, searchCost: 30000 },
  { id: 206, name: "Kenji Tanaka", region: "Asia", skill: 3, salary: 20000, nationality: "Japonês", weeksToComplete: 10, searchCost: 25000 },
  { id: 207, name: "Kofi Mensah", region: "Africa", skill: 3, salary: 18000, nationality: "Ganês", weeksToComplete: 8, searchCost: 22000 },
]

export const DISCOVERABLE_PLAYERS: ScoutedPlayer[] = []

export interface ScoutedLead {
  id: number
  name: string
  position: string
  age: number
  nationality: string
  overall: number
  potential: number
  marketValue: number
  revealedAttributes: boolean
  scoutedRegion: string
  discoveredWeek: number
  pace: number
  shooting: number
  passing: number
  dribbling: number
  defending: number
  physical: number
}

const SCOUT_NAMES_BY_REGION: Record<string, { names: string[]; nationalities: string[] }> = {
  brasil: {
    names: ["Lucas Mendes", "Gabriel Rodrigues", "Matheus Costa", "Felipe Oliveira", "Bruno Santos", "Rafael Lima", "Thiago Alves", "Vitor Pereira", "Diego Ferreira", "Caio Martins", "Henrique Souza", "Guilherme Barbosa", "Pedro Carvalho", "Enzo Ribeiro", "Kaue Nascimento"],
    nationalities: ["Brasil"],
  },
  americas: {
    names: ["Juan Rodriguez", "Carlos Diaz", "Diego Herrera", "Alejandro Torres", "Sebastian Romero", "Nicolas Vargas", "Andres Morales", "Santiago Reyes", "Matias Gonzalez", "Pablo Soto", "Facundo Lopez", "Lautaro Medina"],
    nationalities: ["Argentina", "Colombia", "Uruguai", "Chile", "Mexico", "Peru"],
  },
  europa: {
    names: ["Marco Rossi", "Pierre Dubois", "Jonas Weber", "Luca Bianchi", "Erik Lindqvist", "Andrei Popescu", "Tomas Novak", "Sven Hansen", "Mikel Arroyo", "Fionn O'Brien", "Daan Visser", "Nikola Petrovic"],
    nationalities: ["Italia", "Franca", "Alemanha", "Holanda", "Portugal", "Espanha", "Belgica", "Serbia"],
  },
  asia: {
    names: ["Kenji Yamada", "Park Ji-sung", "Chen Wei", "Ryo Kobayashi", "Kim Tae-yang", "Arif Hasan", "Takuya Morita", "Li Xiang", "Ryota Suzuki", "Min-jun Lee"],
    nationalities: ["Japao", "Coreia do Sul", "China", "Arabia Saudita", "Ira"],
  },
  africa: {
    names: ["Kwame Asante", "Ibrahim Diallo", "Moussa Camara", "Youssef El Arbi", "Emmanuel Mensah", "Cheikh Diop", "Abdi Hassan", "Sekou Kouyate", "Oumar Toure", "Mamadou Sylla"],
    nationalities: ["Gana", "Senegal", "Costa do Marfim", "Nigeria", "Marrocos", "Mali"],
  },
}

const LEAD_POSITIONS = ["GOL", "ZAG", "ZAG", "LE", "LD", "VOL", "VOL", "MEI", "ALA", "ALA", "ATA", "ATA"]

function randAttr(base: number): number {
  return Math.min(99, Math.max(30, base + Math.floor((Math.random() - 0.5) * 28)))
}

// Finalizacao COERENTE com a posicao. Antes shooting era ~f(overall) ignorando a
// posicao, entao um zagueiro de elenco forte (base ~90) saia com FIN 94/95 e liderava
// a lista de batedores de penalti. Aqui goleiros/zagueiros/laterais tem finalizacao
// baixa e atacantes/meias alta — como manda a posicao.
export function shootingForPosition(base: number, position: string): number {
  const r = (spread: number) => Math.floor(Math.random() * spread)
  const clamp = (v: number) => Math.max(18, Math.min(99, v))
  switch (position) {
    case "GOL": return clamp(15 + r(10))
    case "ZAG": case "LD": case "LE": case "ALD": case "ALE": case "LAT":
      return clamp(base - 34 + r(14))
    case "VOL": return clamp(base - 18 + r(12))
    case "MEI": case "MD": case "ME": case "MC": return clamp(base - 8 + r(10))
    case "PD": case "PE": return clamp(base - 4 + r(8))
    default: return clamp(base + r(4)) // ATA / CA / SA
  }
}

export function generateScoutedLead(region: string, scoutSkill: number, week: number, criteria?: ScoutCriteria | null): ScoutedLead {
  const key = region.toLowerCase().replace(/[^a-z]/g, "")
  const regionData = SCOUT_NAMES_BY_REGION[key] ?? SCOUT_NAMES_BY_REGION.brasil
  const name = regionData.names[Math.floor(Math.random() * regionData.names.length)]
  const nationality = regionData.nationalities[Math.floor(Math.random() * regionData.nationalities.length)]
  // Posicao PEDIDA na missao vence o sorteio — o olheiro foi atras do que o
  // tecnico mandou procurar, nao de qualquer um.
  const position = criteria?.position && LEAD_POSITIONS.includes(criteria.position)
    ? criteria.position
    : LEAD_POSITIONS[Math.floor(Math.random() * LEAD_POSITIONS.length)]
  // 16-23: olheiro traz PROJETO, nao pronto. Idade maxima da missao estreita a faixa.
  const tetoIdade = Math.max(16, Math.min(23, criteria?.maxAge ?? 23))
  const age = 16 + Math.floor(Math.random() * Math.max(1, tetoIdade - 15))

  // Revelado nasce com overall BAIXO e potencial ALTO — e um projeto que evolui
  // por treino e temporadas, nao um reforco pronto (pedido do usuario). Quanto
  // mais jovem, mais cru o overall atual e maior a margem de crescimento.
  // O scout melhor nao entrega jogador mais PRONTO, entrega mais POTENCIAL (acha
  // a joia antes de amadurecer).
  const crueza = age <= 17 ? 14 : age <= 19 ? 10 : age <= 21 ? 6 : 3
  const baseOvr = 52 + scoutSkill * 2 + Math.floor(Math.random() * 6)
  const overall = Math.min(78, Math.max(46, baseOvr - crueza))
  // Potencial: margem grande para jovem (ate ~+34), estreita para quem ja tem 22-23.
  const margem = (age <= 17 ? 22 : age <= 19 ? 16 : age <= 21 ? 11 : 7) + scoutSkill * 2
  let potential = Math.min(94, overall + 6 + Math.floor(Math.random() * margem))
  // Potencial minimo da missao: o olheiro so REPORTA quem atende ao pedido, entao
  // garantimos o piso (limitado a 94 para nao criar joia impossivel).
  if (criteria?.minPotential) potential = Math.min(94, Math.max(potential, criteria.minPotential))

  const ageMultiplier = age <= 19 ? 2.5 : age <= 22 ? 1.8 : 1.0
  const marketValue = Math.round(overall * 80000 * ageMultiplier * (0.8 + Math.random() * 0.4))

  return {
    id: Date.now() + Math.floor(Math.random() * 9999),
    name, position, age, nationality, overall, potential, marketValue,
    revealedAttributes: false,
    scoutedRegion: region,
    discoveredWeek: week,
    pace: randAttr(overall),
    shooting: shootingForPosition(overall, position),
    passing: randAttr(overall),
    dribbling: randAttr(overall),
    defending: randAttr(overall),
    physical: randAttr(overall),
  }
}

// ============================================
// SISTEMA DE INFRAESTRUTURA DO CLUBE
// ============================================

export interface ClubInfrastructure {
  // Estadio
  stadiumLevel: number // 1-5
  stadiumCapacity: number
  stadiumName: string
  
  // Acustica e pressao (afeta visitantes)
  acousticsLevel: number // 1-5 - maior = mais pressao em visitantes
  soundSystemLevel: number // 1-5
  
  // Gramado (afeta estilo de jogo)
  pitchQuality: number // 1-5 - 5 = perfeito para toque de bola
  pitchHeight: "baixo" | "medio" | "alto" // alto prejudica times tecnicos
  
  // Centro de Treinamento
  trainingFacilitiesLevel: number // 1-5 - afeta desenvolvimento
  youthAcademyLevel: number // 1-5 - afeta geracao de jovens
  medicalCenterLevel: number // 1-5 - afeta recuperacao de lesoes
  
  // Seguranca
  securityLevel: number // 1-5 - previne eventos negativos
  dataSecurityLevel: number // 1-5 - protege dados de olheiros
  
  // Custos de manutencao
  maintenanceCost: number
}

export interface InfrastructureUpgrade {
  type: keyof ClubInfrastructure
  currentLevel: number
  nextLevel: number
  cost: number
  weeksToComplete: number
  benefits: string[]
}

// ============================================
// SISTEMA DE EVENTOS ALEATORIOS
// ============================================

export type RandomEventType = 
  | "torcida_briga" | "protestos_ct" | "emboscada_onibus"
  | "vazamento_dados" | "jogador_problema" | "lesao_treino"
  | "investidor_interesse" | "patrocinador_novo" | "premios_fifa"
  | "jogador_destaque" | "clima_extremo" | "greve_funcionarios"
  | "crise_financeira" | "boom_economia" | "rival_reforcos"

export interface RandomEvent {
  id: number
  type: RandomEventType
  title: string
  description: string
  week: number
  severity: "baixa" | "media" | "alta"
  
  // Efeitos
  financialImpact: number // pode ser negativo
  moraleImpact: number
  
  // Decisoes disponiveis
  choices: EventChoice[]
  
  // Status
  resolved: boolean
  selectedChoice: number | null
}

export interface EventChoice {
  id: number
  text: string
  cost: number
  moraleEffect: number
  reputationEffect: number
  successChance: number // 0-100
  outcomes: {
    success: { description: string; effects: EventEffect[] }
    failure: { description: string; effects: EventEffect[] }
  }
}

export interface EventEffect {
  type: "financial" | "morale" | "reputation" | "player_injury" | "ban" | "stadium_damage"
  value: number
  playerId?: number
  duration?: number // semanas
}

// Pool de eventos aleatorios
export const RANDOM_EVENTS_POOL: Omit<RandomEvent, "id" | "week" | "resolved" | "selectedChoice">[] = [
  {
    type: "torcida_briga",
    title: "Briga de Torcidas",
    description: "Confronto entre torcidas antes do classico. A seguranca do estadio esta sendo questionada.",
    severity: "alta",
    financialImpact: -500000,
    moraleImpact: -10,
    choices: [
      {
        id: 1,
        text: "Aumentar seguranca imediatamente (custo alto)",
        cost: 300000,
        moraleEffect: 5,
        reputationEffect: 10,
        successChance: 90,
        outcomes: {
          success: { description: "Seguranca reforcada. Federacao elogiou as medidas.", effects: [] },
          failure: { description: "Apesar do investimento, houve incidentes menores.", effects: [{ type: "financial", value: -100000 }] }
        }
      },
      {
        id: 2,
        text: "Manter seguranca atual e torcer pelo melhor",
        cost: 0,
        moraleEffect: -5,
        reputationEffect: -15,
        successChance: 40,
        outcomes: {
          success: { description: "Felizmente nao houve mais incidentes.", effects: [] },
          failure: { description: "Novos confrontos! Multa pesada da federacao.", effects: [{ type: "financial", value: -800000 }, { type: "ban", value: 2 }] }
        }
      }
    ]
  },
  {
    type: "protestos_ct",
    title: "Protestos no CT",
    description: "Torcedores insatisfeitos com os resultados invadiram o CT exigindo mudancas.",
    severity: "media",
    financialImpact: -100000,
    moraleImpact: -15,
    choices: [
      {
        id: 1,
        text: "Reunir com lideres da torcida",
        cost: 0,
        moraleEffect: 10,
        reputationEffect: 5,
        successChance: 70,
        outcomes: {
          success: { description: "Dialogo produtivo. Torcida deu voto de confianca.", effects: [{ type: "morale", value: 10 }] },
          failure: { description: "Reuniao terminou em discussao. Clima piorou.", effects: [{ type: "morale", value: -10 }] }
        }
      },
      {
        id: 2,
        text: "Ignorar e focar nos treinos",
        cost: 0,
        moraleEffect: -10,
        reputationEffect: -10,
        successChance: 50,
        outcomes: {
          success: { description: "Protestos diminuiram com o tempo.", effects: [] },
          failure: { description: "Protestos intensificaram. Jogadores abalados.", effects: [{ type: "morale", value: -20 }] }
        }
      }
    ]
  },
  {
    type: "investidor_interesse",
    title: "Interesse de Investidor",
    description: "Um grupo de investidores demonstrou interesse em aportar capital no clube.",
    severity: "baixa",
    financialImpact: 0,
    moraleImpact: 5,
    choices: [
      {
        id: 1,
        text: "Abrir negociacoes",
        cost: 50000,
        moraleEffect: 10,
        reputationEffect: 5,
        successChance: 60,
        outcomes: {
          success: { description: "Acordo fechado! Aporte de capital significativo.", effects: [{ type: "financial", value: 10000000 }] },
          failure: { description: "Negociacoes nao avancaram.", effects: [] }
        }
      },
      {
        id: 2,
        text: "Recusar - manter independencia",
        cost: 0,
        moraleEffect: 0,
        reputationEffect: 5,
        successChance: 100,
        outcomes: {
          success: { description: "Clube mantem sua identidade e independencia.", effects: [] },
          failure: { description: "", effects: [] }
        }
      }
    ]
  },
  {
    type: "vazamento_dados",
    title: "Vazamento de Dados de Olheiros",
    description: "Informacoes sobre alvos do scouting foram vazadas para clubes rivais.",
    severity: "media",
    financialImpact: 0,
    moraleImpact: -5,
    choices: [
      {
        id: 1,
        text: "Investigar e demitir responsaveis",
        cost: 100000,
        moraleEffect: -5,
        reputationEffect: 10,
        successChance: 70,
        outcomes: {
          success: { description: "Vazamento contido. Seguranca reforcada.", effects: [] },
          failure: { description: "Nao foi possivel identificar a fonte.", effects: [{ type: "reputation", value: -10 }] }
        }
      },
      {
        id: 2,
        text: "Investir em seguranca de dados",
        cost: 500000,
        moraleEffect: 0,
        reputationEffect: 5,
        successChance: 95,
        outcomes: {
          success: { description: "Sistema de seguranca atualizado. Dados protegidos.", effects: [] },
          failure: { description: "Investimento insuficiente.", effects: [] }
        }
      }
    ]
  },
  {
    type: "clima_extremo",
    title: "Clima Extremo na Cidade",
    description: "Previsao de tempestade forte no dia da partida em casa.",
    severity: "baixa",
    financialImpact: -50000,
    moraleImpact: 0,
    choices: [
      {
        id: 1,
        text: "Adiar partida (acordo com federacao)",
        cost: 200000,
        moraleEffect: 0,
        reputationEffect: 0,
        successChance: 80,
        outcomes: {
          success: { description: "Partida adiada com sucesso.", effects: [] },
          failure: { description: "Federacao negou. Partida mantem data.", effects: [] }
        }
      },
      {
        id: 2,
        text: "Jogar normalmente",
        cost: 0,
        moraleEffect: -5,
        reputationEffect: 0,
        successChance: 100,
        outcomes: {
          success: { description: "Partida sera disputada com condicoes adversas.", effects: [] },
          failure: { description: "", effects: [] }
        }
      }
    ]
  }
]

// ============================================
// SISTEMA DE HIERARQUIA E DISCIPLINA
// ============================================

export interface PlayerHierarchy {
  playerId: number
  role: "capitao" | "vice_capitao" | "veterano" | "referencia" | "jovem" | "novato"
  influence: number // 0-100 - quanto influencia o vestiario
  respect: number // 0-100 - respeito pelo treinador
  disciplineIssues: DisciplineIssue[]
}

export interface DisciplineIssue {
  id: number
  playerId: number
  type: "atraso_treino" | "falta_treino" | "problema_extracampo" | "discussao_vestiario" | "desrespeito_tecnico" | "vazamento_midia"
  week: number
  severity: "leve" | "moderada" | "grave"
  resolved: boolean
  punishment?: DisciplinePunishment
}

export type DisciplinePunishment = 
  | "advertencia" | "multa_leve" | "multa_pesada" 
  | "banco_1_jogo" | "banco_3_jogos" | "afastamento_treinos"
  | "rescisao_contrato"

export const DISCIPLINE_PUNISHMENTS: Record<DisciplinePunishment, { label: string; finePercent: number; moraleImpact: number; respectChange: number }> = {
  advertencia: { label: "Advertencia Verbal", finePercent: 0, moraleImpact: -5, respectChange: 5 },
  multa_leve: { label: "Multa Leve (10% salario)", finePercent: 10, moraleImpact: -10, respectChange: 10 },
  multa_pesada: { label: "Multa Pesada (30% salario)", finePercent: 30, moraleImpact: -20, respectChange: 15 },
  banco_1_jogo: { label: "Banco por 1 Jogo", finePercent: 0, moraleImpact: -15, respectChange: 10 },
  banco_3_jogos: { label: "Banco por 3 Jogos", finePercent: 0, moraleImpact: -25, respectChange: 15 },
  afastamento_treinos: { label: "Afastamento dos Treinos", finePercent: 20, moraleImpact: -30, respectChange: 20 },
  rescisao_contrato: { label: "Rescisao de Contrato", finePercent: 100, moraleImpact: -50, respectChange: 25 }
}

// ============================================
// MODIFICADORES DE PARTIDA
// ============================================

export interface MatchModifiers {
  // Fator casa/fora
  homeAdvantage: number // 0-20 pontos extras para mandante
  crowdPressure: number // 0-20 pressao da torcida (afeta visitante)
  
  // Clima e altitude
  weather: "sol" | "nublado" | "chuva" | "tempestade" | "neve"
  temperature: number // celsius
  altitude: number // metros
  
  // Rivalidade
  isDerby: boolean
  derbyIntensity: number // 0-100
  
  // Importancia da partida
  matchImportance: "normal" | "decisivo" | "final"
  
  // Efeitos calculados
  homeTeamBoost: number
  awayTeamDebuff: number
  staminaDrainMultiplier: number // >1 = drena mais (altitude, calor)
  technicalPenalty: number // reducao em passe/drible (chuva, gramado ruim)
}

export function calculateMatchModifiers(
  homeInfra: ClubInfrastructure,
  weather: MatchModifiers["weather"],
  altitude: number,
  isDerby: boolean,
  matchImportance: MatchModifiers["matchImportance"],
  options?: {
    homeSquadPlayers?: Player[]    // para calcular Bola de Ouro
    homeTablePosition?: number     // posicao na tabela (1-20)
    awayTablePosition?: number
    homeClubPrestige?: number      // prestigio esperado (0-100)
    leagueSize?: number
  }
): MatchModifiers {
  let homeAdvantage = 5 + (homeInfra.acousticsLevel * 2) + (homeInfra.soundSystemLevel)
  let crowdPressure = 5 + (homeInfra.acousticsLevel * 3)

  // Gramado afeta tecnica
  let technicalPenalty = 0
  if (homeInfra.pitchHeight === "alto") technicalPenalty += 5
  if (homeInfra.pitchQuality < 3) technicalPenalty += (3 - homeInfra.pitchQuality) * 3

  // Clima
  if (weather === "chuva") technicalPenalty += 8
  if (weather === "tempestade") technicalPenalty += 15
  if (weather === "neve") technicalPenalty += 12

  // Altitude
  let staminaDrainMultiplier = 1
  if (altitude > 2500) staminaDrainMultiplier = 1.5
  else if (altitude > 1500) staminaDrainMultiplier = 1.25
  else if (altitude > 800) staminaDrainMultiplier = 1.1

  // Derby intensifica tudo
  const derbyIntensity = isDerby ? 80 : 0
  if (isDerby) {
    homeAdvantage += 5
    crowdPressure += 10
  }

  // Importancia
  if (matchImportance === "decisivo") {
    crowdPressure += 5
    homeAdvantage += 3
  } else if (matchImportance === "final") {
    crowdPressure += 10
    homeAdvantage += 5
  }

  // === EFEITO BOLA DE OURO ===
  // Estrela (overall >= 88) no elenco intimida adversário e eleva companheiros
  let starPlayerBoost = 0
  let starPlayerAwayDebuff = 0
  if (options?.homeSquadPlayers) {
    const stars = options.homeSquadPlayers.filter(p => p.overall >= 88 && !p.injury)
    if (stars.length > 0) {
      const topStar = stars.reduce((best, p) => p.overall > best.overall ? p : best)
      // Cada estrela acima de 88 adiciona 2pts; acima de 92 adiciona 5pts
      starPlayerBoost += stars.length * 2
      if (topStar.overall >= 92) starPlayerBoost += 3
      starPlayerAwayDebuff += Math.round(topStar.overall / 20) // 4-5 pts de debuff no time rival
      // Status effects da estrela também contam
      const effectBonus = (topStar.statusEffects ?? [])
        .filter(e => e.isPositive)
        .reduce((sum, e) => sum + Math.max(0, e.overallModifier), 0)
      starPlayerBoost += Math.min(5, effectBonus)
    }
  }

  // === PESO DA CAMISA / DEBUFF DE ANSIEDADE ===
  // Grande clube esperado (prestigio >= 75) que está lutando contra rebaixamento
  let anxietyDebuff = 0
  const tablePos = options?.homeTablePosition ?? 0
  const prestige = options?.homeClubPrestige ?? 0
  const leagueSize = options?.leagueSize ?? 20
  if (prestige >= 75 && tablePos > leagueSize - 6 && tablePos > 0) {
    // Quanto mais próximo do rebaixamento e mais famoso o clube, maior a ansiedade
    const relegationPressure = (tablePos - (leagueSize - 6)) // 1-5
    anxietyDebuff = relegationPressure * 3 + Math.round((prestige - 75) / 5)
  }

  const finalHomeBoost = homeAdvantage + starPlayerBoost
  const finalAwayDebuff = Math.round(crowdPressure * 0.7) + starPlayerAwayDebuff

  return {
    homeAdvantage: Math.min(finalHomeBoost, 30),
    crowdPressure: Math.min(crowdPressure, 25),
    weather,
    temperature: weather === "neve" ? -2 : weather === "sol" ? 30 : 22,
    altitude,
    isDerby,
    derbyIntensity,
    matchImportance,
    homeTeamBoost: Math.max(0, finalHomeBoost - anxietyDebuff),
    awayTeamDebuff: finalAwayDebuff,
    staminaDrainMultiplier,
    technicalPenalty
  }
}

// ============================================
// SOCIO-TORCEDOR (ECONOMIA DINAMICA)
// ============================================

export interface FanBase {
  totalMembers: number
  activeMembers: number // pagam mensalidade
  monthlyRevenue: number
  satisfaction: number // 0-100
  loyalty: number // 0-100
  
  // Fatores que afetam
  recentResults: number // -100 a +100
  signings: number // contratacoes de peso aumentam
  ticketPrices: "barato" | "normal" | "caro"
}

export function calculateFanRevenue(fanBase: FanBase, results: number, hasStarSigning: boolean): number {
  let memberChange = 0
  
  // Resultados afetam adesao
  if (results > 50) memberChange = Math.round(fanBase.totalMembers * 0.05)
  else if (results > 20) memberChange = Math.round(fanBase.totalMembers * 0.02)
  else if (results < -20) memberChange = -Math.round(fanBase.totalMembers * 0.03)
  else if (results < -50) memberChange = -Math.round(fanBase.totalMembers * 0.08)
  
  // Contratacao de peso
  if (hasStarSigning) memberChange += Math.round(fanBase.totalMembers * 0.1)
  
  const newActiveMembers = Math.max(100, fanBase.activeMembers + memberChange)
  const avgMonthlyfee = 50 // R$ 50 por socio
  
  return newActiveMembers * avgMonthlyfee
}

export interface MatchResult {
  /** Identidade estável da partida no calendário. Impede que um placar seja
   * reaproveitado por outro confronto entre os mesmos clubes. */
  fixtureKey?: string
  fixtureId?: number
  week: number
  season: number
  competition: string
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  events: MatchEvent[]
}

export interface MatchEvent {
  minute: number
  type: "goal" | "assist" | "yellow" | "red" | "sub" | "injury"
  playerId: number
  playerName: string
  assistPlayerId?: number
  assistPlayerName?: string
}

export interface StandingsEntry {
  teamShort: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  points: number
  form: ("W" | "D" | "L")[]
}

export interface CopaBracket {
  round: "32avos" | "16avos" | "oitavas" | "quartas" | "semis" | "final"
  matches: CopaBracketMatch[]
}

export interface CopaBracketMatch {
  id: number
  team1: string
  team2: string
  score1: number | null
  score2: number | null
  winner: string | null
  nextMatchId: number | null
}

export interface NationalTeamCall {
  playerId: number
  playerName: string
  country: string
  competition: string
  weeksAway: number
  startWeek: number
}

export interface TopScorer {
  playerId: number
  playerName: string
  teamShort: string
  goals: number
  assists: number
  matches: number
}

// ============================================
// SISTEMA DE TATICAS AVANCADO (FM STYLE)
// ============================================

export type TeamMentality = "muito_defensivo" | "defensivo" | "equilibrado" | "ofensivo" | "muito_ofensivo"
export type PlayingStyle = "posse_bola" | "contra_ataque" | "pressao_alta" | "jogo_direto" | "jogo_posicional"
export type PassingStyle = "curto" | "misto" | "direto"
export type TempoStyle = "lento" | "normal" | "rapido"
export type DefensiveLine = "baixa" | "media" | "alta"
export type PressingIntensity = "baixa" | "media" | "alta" | "muito_alta"
export type MarkingStyle = "zonal" | "individual" | "misto"
export type BuildUpStyle = "curto" | "misto" | "longo"
export type ChanceCreation = "largura" | "centro" | "misto"
export type CrossingStyle = "baixo" | "misto" | "alto"

export interface TeamTactics {
  // Mentalidade geral
  mentality: TeamMentality
  playingStyle: PlayingStyle
  
  // Com a bola
  passingStyle: PassingStyle
  tempo: TempoStyle
  buildUp: BuildUpStyle
  chanceCreation: ChanceCreation
  crossingStyle: CrossingStyle
  shootFromDistance: boolean
  playThroughBalls: boolean
  
  // Sem a bola
  defensiveLine: DefensiveLine
  pressingIntensity: PressingIntensity
  markingStyle: MarkingStyle
  offsideTrap: boolean
  counterPress: boolean
  
  // Transicoes
  counterAttack: boolean
  holdPosition: boolean
  
  // Bolas paradas
  cornersAggressive: boolean
  freekickSpecialist: number | null // ID do jogador
  penaltyTaker: number | null
}

export interface TacticalAssignments {
  corner: string
  freeKick: string
  freeKickLeft: string
  freeKickRight: string
  penalty: string
  captain: string
  playerRoles: Record<string, string>
}

export type PlayerRole = 
  // Goleiros (4 funcoes)
  | "goleiro_defensor" | "goleiro_libero" | "goleiro_sweeper" | "goleiro_distribuidor"
  // Zagueiros Centrais (8 funcoes)
  | "zagueiro_central" | "zagueiro_stopper" | "zagueiro_cover" | "zagueiro_saidor" 
  | "zagueiro_libero" | "zagueiro_marcador" | "zagueiro_aereo" | "zagueiro_lider"
  // Laterais/Alas Defensivos (10 funcoes)
  | "lateral_defensivo" | "lateral_equilibrado" | "lateral_ofensivo" | "ala" | "lateral_invertido"
  | "ala_completo" | "lateral_cruzador" | "carrilero" | "lateral_zona" | "lateral_sobreposto"
  // Volantes/Meio Defensivo (10 funcoes)
  | "volante_destruidor" | "volante_box_to_box" | "volante_saidor" | "meia_defensivo" | "regista"
  | "volante_ancora" | "volante_cobertura" | "segundo_volante" | "meio_campo_central" | "volante_tecnico"
  // Meias/Armadores (12 funcoes)
  | "meia_central" | "meia_armador" | "meia_atacante" | "meia_box_to_box" | "enganche"
  | "mezzala" | "trequartista" | "meia_infiltrador" | "meia_organizador" | "meia_livre"
  | "meia_defensivo_avancado" | "construtor_jogo"
  // Pontas/Alas Ofensivos (10 funcoes)
  | "ponta" | "ponta_invertido" | "ala_ofensivo" | "meia_ponta"
  | "extremo" | "ponta_fixo" | "ponta_flutuante" | "segundo_atacante_ponta" | "ponta_velocista" | "ponta_finalizador"
  // Atacantes (12 funcoes)
  | "centroavante" | "atacante_movel" | "falso_nove" | "target_man" | "poacher"
  | "atacante_completo" | "atacante_pressing" | "atacante_referencia" | "atacante_area"
  | "segundo_atacante" | "atacante_profundidade" | "atacante_pivot"

// Descricoes das funcoes para UI
export const PLAYER_ROLE_INFO: Record<PlayerRole, { name: string; description: string; positions: string[] }> = {
  // Goleiros
  goleiro_defensor: { name: "Goleiro Defensor", description: "Foca em defesas e evita riscos", positions: ["GOL"] },
  goleiro_libero: { name: "Goleiro Libero", description: "Sai da area para cortar jogadas", positions: ["GOL"] },
  goleiro_sweeper: { name: "Goleiro Sweeper", description: "Joga como ultimo defensor, muito adiantado", positions: ["GOL"] },
  goleiro_distribuidor: { name: "Goleiro Distribuidor", description: "Inicia jogadas com passes precisos", positions: ["GOL"] },
  // Zagueiros
  zagueiro_central: { name: "Zagueiro Central", description: "Equilibrio entre marcacao e saida de bola", positions: ["ZAG"] },
  zagueiro_stopper: { name: "Zagueiro Stopper", description: "Agressivo, antecipa e desarma", positions: ["ZAG"] },
  zagueiro_cover: { name: "Zagueiro Cover", description: "Cobre espacos e protege a defesa", positions: ["ZAG"] },
  zagueiro_saidor: { name: "Zagueiro Saidor", description: "Conduz a bola e inicia jogadas", positions: ["ZAG"] },
  zagueiro_libero: { name: "Libero", description: "Zagueiro livre que avanca com a bola", positions: ["ZAG"] },
  zagueiro_marcador: { name: "Zagueiro Marcador", description: "Focado em marcacao individual", positions: ["ZAG"] },
  zagueiro_aereo: { name: "Zagueiro Aereo", description: "Especialista em jogadas aereas", positions: ["ZAG"] },
  zagueiro_lider: { name: "Zagueiro Lider", description: "Organiza a defesa e lidera a equipe", positions: ["ZAG"] },
  // Laterais
  lateral_defensivo: { name: "Lateral Defensivo", description: "Prioriza a marcacao", positions: ["LD", "LE"] },
  lateral_equilibrado: { name: "Lateral Equilibrado", description: "Equilibra ataque e defesa", positions: ["LD", "LE"] },
  lateral_ofensivo: { name: "Lateral Ofensivo", description: "Ataca constantemente", positions: ["LD", "LE"] },
  ala: { name: "Ala", description: "Joga toda a lateral do campo", positions: ["LD", "LE"] },
  lateral_invertido: { name: "Lateral Invertido", description: "Corta para o centro", positions: ["LD", "LE"] },
  ala_completo: { name: "Ala Completo", description: "Cobre toda a faixa lateral com intensidade", positions: ["LD", "LE"] },
  lateral_cruzador: { name: "Lateral Cruzador", description: "Especialista em cruzamentos", positions: ["LD", "LE"] },
  carrilero: { name: "Carrilero", description: "Lateral que joga como volante", positions: ["LD", "LE"] },
  lateral_zona: { name: "Lateral por Dentro", description: "Entra no meio campo ao atacar", positions: ["LD", "LE"] },
  lateral_sobreposto: { name: "Lateral Sobreposto", description: "Sempre ultrapassa o ponta", positions: ["LD", "LE"] },
  // Volantes
  volante_destruidor: { name: "Volante Destruidor", description: "Desarma e protege a defesa", positions: ["VOL"] },
  volante_box_to_box: { name: "Volante Box-to-Box", description: "Cobre todo o campo", positions: ["VOL"] },
  volante_saidor: { name: "Volante Saidor", description: "Sai jogando com qualidade", positions: ["VOL"] },
  meia_defensivo: { name: "Meia Defensivo", description: "Protege a defesa e distribui", positions: ["VOL"] },
  regista: { name: "Regista", description: "Organizador de jogo profundo", positions: ["VOL"] },
  volante_ancora: { name: "Volante Ancora", description: "Fica fixo protegendo a defesa", positions: ["VOL"] },
  volante_cobertura: { name: "Volante Cobertura", description: "Cobre os laterais que avancam", positions: ["VOL"] },
  segundo_volante: { name: "Segundo Volante", description: "Chega na area para finalizar", positions: ["VOL"] },
  meio_campo_central: { name: "Meio-Campo Central", description: "Equilibrio total no meio", positions: ["VOL", "MEI"] },
  volante_tecnico: { name: "Volante Tecnico", description: "Qualidade tecnica acima da media", positions: ["VOL"] },
  // Meias
  meia_central: { name: "Meia Central", description: "Controla o ritmo do jogo", positions: ["MEI"] },
  meia_armador: { name: "Meia Armador", description: "Cria jogadas e da assistencias", positions: ["MEI"] },
  meia_atacante: { name: "Meia Atacante", description: "Joga proximo aos atacantes", positions: ["MEI"] },
  meia_box_to_box: { name: "Meia Box-to-Box", description: "Defende e ataca com intensidade", positions: ["MEI"] },
  enganche: { name: "Enganche", description: "Camisa 10 classico, liberdade criativa", positions: ["MEI"] },
  mezzala: { name: "Mezzala", description: "Meia que infiltra pelos lados", positions: ["MEI"] },
  trequartista: { name: "Trequartista", description: "Armador puro, sem funcao defensiva", positions: ["MEI"] },
  meia_infiltrador: { name: "Meia Infiltrador", description: "Chega na area para finalizar", positions: ["MEI"] },
  meia_organizador: { name: "Meia Organizador", description: "Dita o ritmo e organiza jogadas", positions: ["MEI"] },
  meia_livre: { name: "Meia Livre", description: "Sem posicao fixa, circula pelo ataque", positions: ["MEI"] },
  meia_defensivo_avancado: { name: "Meia Defensivo Avancado", description: "Marca alto e pressiona", positions: ["MEI"] },
  construtor_jogo: { name: "Construtor de Jogo", description: "Inicia todas as jogadas ofensivas", positions: ["MEI"] },
  // Pontas
  ponta: { name: "Ponta", description: "Joga aberto na lateral", positions: ["PD", "PE"] },
  ponta_invertido: { name: "Ponta Invertido", description: "Corta para finalizar", positions: ["PD", "PE"] },
  ala_ofensivo: { name: "Ala Ofensivo", description: "Extremo que cruza", positions: ["PD", "PE"] },
  meia_ponta: { name: "Meia-Ponta", description: "Flutua entre meio e ataque", positions: ["PD", "PE", "MEI"] },
  extremo: { name: "Extremo", description: "Joga grudado na linha lateral", positions: ["PD", "PE"] },
  ponta_fixo: { name: "Ponta Fixo", description: "Mantem largura no ataque", positions: ["PD", "PE"] },
  ponta_flutuante: { name: "Ponta Flutuante", description: "Circula por todo o ataque", positions: ["PD", "PE"] },
  segundo_atacante_ponta: { name: "Segundo Atacante Ponta", description: "Ponta que joga como atacante", positions: ["PD", "PE"] },
  ponta_velocista: { name: "Ponta Velocista", description: "Usa velocidade para criar", positions: ["PD", "PE"] },
  ponta_finalizador: { name: "Ponta Finalizador", description: "Foca em finalizar", positions: ["PD", "PE"] },
  // Atacantes
  centroavante: { name: "Centroavante", description: "Atacante classico de area", positions: ["ATA"] },
  atacante_movel: { name: "Atacante Movel", description: "Circula pelo ataque", positions: ["ATA"] },
  falso_nove: { name: "Falso Nove", description: "Recua para criar espacos", positions: ["ATA"] },
  target_man: { name: "Pivo", description: "Segura a bola e pivotea", positions: ["ATA"] },
  poacher: { name: "Oportunista", description: "Vive de gols de oportunidade", positions: ["ATA"] },
  atacante_completo: { name: "Atacante Completo", description: "Faz tudo no ataque", positions: ["ATA"] },
  atacante_pressing: { name: "Atacante Pressing", description: "Marca alto e pressiona", positions: ["ATA"] },
  atacante_referencia: { name: "Atacante Referencia", description: "Ponto focal do ataque", positions: ["ATA"] },
  atacante_area: { name: "Finalizador de Area", description: "Especialista dentro da area", positions: ["ATA"] },
  segundo_atacante: { name: "Segundo Atacante", description: "Joga atras do centroavante", positions: ["ATA"] },
  atacante_profundidade: { name: "Atacante de Profundidade", description: "Busca espacos nas costas", positions: ["ATA"] },
  atacante_pivot: { name: "Atacante Pivot", description: "Segura e distribui no ataque", positions: ["ATA"] },
}

/**
 * Função padrão por posição. Sem isto, todo jogador sem instrução salva caía em
 * "meia_central" — um zagueiro aparecia como meia na tela de tática.
 */
const DEFAULT_ROLE_BY_POSITION: Record<string, PlayerRole> = {
  GOL: "goleiro_defensor",
  ZAG: "zagueiro_central",
  LD: "lateral_equilibrado",
  LE: "lateral_equilibrado",
  VOL: "volante_box_to_box",
  MEI: "meia_central",
  MD: "ponta",
  ME: "ponta",
  PD: "ponta",
  PE: "ponta",
  ATA: "centroavante",
}

export function defaultRoleForPosition(position: string | undefined): PlayerRole {
  return DEFAULT_ROLE_BY_POSITION[(position ?? "").toUpperCase()] ?? "meia_central"
}

export interface PlayerInstructions {
  role: PlayerRole
  
  // Movimentacao
  roaming: "ficar_posicao" | "liberdade_moderada" | "liberdade_total"
  runs: "raramente" | "as_vezes" | "frequentemente"
  
  // Marcacao
  markingTightness: "solto" | "normal" | "apertado"
  closingDown: "menos" | "normal" | "mais"
  
  // Com a bola
  dribbling: "menos" | "normal" | "mais"
  passingRisk: "seguro" | "normal" | "arriscado"
  crossFrequency: "menos" | "normal" | "mais"
  shootFrequency: "menos" | "normal" | "mais"
  
  // Especiais
  stayWider: boolean
  cutInside: boolean
  getForward: boolean
  holdPosition: boolean
  tackleHarder: boolean
}

export interface OpponentAnalysis {
  teamShort: string
  teamName: string
  analyzedWeek: number
  analysisProgress: number // 0-100
  
  // Dados descobertos
  formation: string | null
  mentality: TeamMentality | null
  keyPlayers: { name: string; position: string; threat: number }[]
  weaknesses: string[]
  strengths: string[]
  
  // Estatisticas
  avgGoalsScored: number
  avgGoalsConceded: number
  homeRecord: { w: number; d: number; l: number }
  awayRecord: { w: number; d: number; l: number }
}

// Moral do vestiario
export interface SquadMorale {
  overall: number // 0-100
  unity: number // 0-100
  confidence: number // 0-100
  recentEvents: MoraleEvent[]
}

export interface MoraleEvent {
  week: number
  type: "vitoria" | "derrota" | "empate" | "titulo" | "contratacao" | "venda" | "lesao" | "conflito" | "elogio"
  description: string
  impact: number // -20 to +20
}

// Conferencia de imprensa
export interface PressConference {
  week: number
  questions: PressQuestion[]
  responses: PressResponse[]
  moraleImpact: number
}

export interface PressQuestion {
  id: number
  type: "match" | "player" | "transfer" | "rival" | "tactics" | "injury"
  question: string
  options: { text: string; tone: "positivo" | "neutro" | "negativo" | "agressivo"; impact: number }[]
}

export interface PressResponse {
  questionId: number
  selectedOption: number
  impact: number
}

// Relatorio de desempenho
export interface PerformanceReport {
  playerId: number
  playerName: string
  period: "semana" | "mes" | "temporada"
  
  // Notas
  avgRating: number
  matchRatings: { week: number; rating: number; opponent: string }[]
  
  // Comparacoes
  vsLastPeriod: number // -100 to +100
  vsSquadAvg: number // -100 to +100
  vsPositionAvg: number // -100 to +100
  
  // Destaques
  strengths: string[]
  weaknesses: string[]
  recommendation: string
}

// ============================================
// SISTEMA DE REUNIOES COM JOGADORES
// ============================================

export type MeetingType = 
  | "elogio" | "critica" | "motivacao" | "cobranca"
  | "conversa_futuro" | "pedido_foco" | "aviso_disciplinar"
  | "promessa_titularidade" | "promessa_venda" | "integracao"
  | "felicitacao_gol" | "apoio_lesao" | "discussao_contrato"
  | "pedido_lideranca" | "explicar_reserva"

export interface PlayerMeeting {
  id: number
  playerId: number
  playerName: string
  week: number
  type: MeetingType
  playerResponse: "positivo" | "neutro" | "negativo"
  moraleChange: number
  relationshipChange: number
  details: string
}

export interface MeetingOption {
  type: MeetingType
  label: string
  description: string
  icon: string
  possibleOutcomes: {
    positive: { chance: number; moraleChange: number; message: string }
    neutral: { chance: number; moraleChange: number; message: string }
    negative: { chance: number; moraleChange: number; message: string }
  }
}

export const MEETING_OPTIONS: MeetingOption[] = [
  {
    type: "elogio",
    label: "Elogiar Desempenho",
    description: "Reconhecer o bom trabalho do jogador",
    icon: "thumb-up",
    possibleOutcomes: {
      positive: { chance: 70, moraleChange: 10, message: "ficou motivado com o reconhecimento" },
      neutral: { chance: 25, moraleChange: 2, message: "agradeceu educadamente" },
      negative: { chance: 5, moraleChange: -5, message: "achou o elogio falso" }
    }
  },
  {
    type: "critica",
    label: "Criticar Desempenho",
    description: "Apontar erros e cobrar melhora",
    icon: "alert-triangle",
    possibleOutcomes: {
      positive: { chance: 30, moraleChange: 5, message: "aceitou a critica e prometeu melhorar" },
      neutral: { chance: 40, moraleChange: -3, message: "ouviu em silencio" },
      negative: { chance: 30, moraleChange: -15, message: "ficou irritado e discordou" }
    }
  },
  {
    type: "motivacao",
    label: "Discurso Motivacional",
    description: "Inspirar o jogador a dar o maximo",
    icon: "flame",
    possibleOutcomes: {
      positive: { chance: 60, moraleChange: 12, message: "ficou inspirado e motivado" },
      neutral: { chance: 30, moraleChange: 3, message: "ouviu com atencao" },
      negative: { chance: 10, moraleChange: -5, message: "pareceu indiferente" }
    }
  },
  {
    type: "cobranca",
    label: "Cobrar Mais Dedicacao",
    description: "Exigir mais empenho nos treinos",
    icon: "target",
    possibleOutcomes: {
      positive: { chance: 40, moraleChange: 5, message: "entendeu a mensagem e vai se esforcar mais" },
      neutral: { chance: 35, moraleChange: -2, message: "disse que ja esta fazendo o possivel" },
      negative: { chance: 25, moraleChange: -10, message: "ficou ofendido com a cobranca" }
    }
  },
  {
    type: "conversa_futuro",
    label: "Conversar Sobre Futuro",
    description: "Discutir planos de carreira",
    icon: "compass",
    possibleOutcomes: {
      positive: { chance: 50, moraleChange: 8, message: "gostou de saber que tem futuro no clube" },
      neutral: { chance: 35, moraleChange: 0, message: "quer ver na pratica" },
      negative: { chance: 15, moraleChange: -8, message: "quer sair do clube" }
    }
  },
  {
    type: "promessa_titularidade",
    label: "Prometer Titularidade",
    description: "Garantir que sera titular",
    icon: "star",
    possibleOutcomes: {
      positive: { chance: 80, moraleChange: 15, message: "ficou muito feliz com a promessa" },
      neutral: { chance: 15, moraleChange: 5, message: "quer ver a promessa cumprida" },
      negative: { chance: 5, moraleChange: -5, message: "nao acreditou" }
    }
  },
  {
    type: "explicar_reserva",
    label: "Explicar Tempo no Banco",
    description: "Justificar falta de minutos",
    icon: "info",
    possibleOutcomes: {
      positive: { chance: 45, moraleChange: 5, message: "entendeu a situacao" },
      neutral: { chance: 35, moraleChange: -2, message: "aceitou mas nao gostou" },
      negative: { chance: 20, moraleChange: -12, message: "ficou mais insatisfeito" }
    }
  },
  {
    type: "pedido_lideranca",
    label: "Pedir Lideranca",
    description: "Solicitar que lidere o grupo",
    icon: "crown",
    possibleOutcomes: {
      positive: { chance: 55, moraleChange: 10, message: "aceitou o desafio com orgulho" },
      neutral: { chance: 30, moraleChange: 3, message: "disse que vai tentar" },
      negative: { chance: 15, moraleChange: -5, message: "nao se sente preparado" }
    }
  },
  {
    type: "apoio_lesao",
    label: "Apoiar Durante Lesao",
    description: "Dar suporte durante recuperacao",
    icon: "heart",
    possibleOutcomes: {
      positive: { chance: 85, moraleChange: 12, message: "agradeceu muito o apoio" },
      neutral: { chance: 13, moraleChange: 5, message: "ficou grato" },
      negative: { chance: 2, moraleChange: 0, message: "prefere ficar sozinho" }
    }
  },
  {
    type: "aviso_disciplinar",
    label: "Aviso Disciplinar",
    description: "Alertar sobre comportamento inadequado",
    icon: "alert-circle",
    possibleOutcomes: {
      positive: { chance: 35, moraleChange: 0, message: "pediu desculpas e vai mudar" },
      neutral: { chance: 40, moraleChange: -5, message: "ficou em silencio" },
      negative: { chance: 25, moraleChange: -15, message: "reagiu mal e discutiu" }
    }
  },
  {
    type: "integracao",
    label: "Conversa de Integracao",
    description: "Ajudar novo jogador a se adaptar",
    icon: "users",
    possibleOutcomes: {
      positive: { chance: 75, moraleChange: 10, message: "se sentiu acolhido no grupo" },
      neutral: { chance: 20, moraleChange: 3, message: "esta se adaptando aos poucos" },
      negative: { chance: 5, moraleChange: -3, message: "ainda se sente deslocado" }
    }
  },
  {
    type: "felicitacao_gol",
    label: "Parabenizar por Gol",
    description: "Celebrar gol marcado",
    icon: "trophy",
    possibleOutcomes: {
      positive: { chance: 90, moraleChange: 8, message: "ficou muito feliz com o reconhecimento" },
      neutral: { chance: 10, moraleChange: 3, message: "agradeceu" },
      negative: { chance: 0, moraleChange: 0, message: "" }
    }
  }
]

// ============================================
// ANALISE TATICA POS-PARTIDA
// ============================================

export interface PostMatchAnalysis {
  matchId: number
  week: number
  opponent: string
  result: { home: number; away: number }
  isHome: boolean
  
  // Avaliacao geral
  overallRating: number // 1-10
  tacticsRating: number // 1-10
  
  // Pontos positivos
  positives: AnalysisPoint[]
  
  // Pontos negativos
  negatives: AnalysisPoint[]
  
  // Jogadores destaque
  bestPlayers: { playerId: number; name: string; rating: number; reason: string }[]
  worstPlayers: { playerId: number; name: string; rating: number; reason: string }[]
  
  // Estatisticas chave
  keyStats: {
    possession: number
    shots: number
    shotsOnTarget: number
    xG: number
    xGA: number
    passAccuracy: number
    duelsWon: number
    aerialDuelsWon: number
  }
  
  // Recomendacoes
  recommendations: string[]
  
  // Comparacao com plano tatico
  tacticAdherence: number // 0-100%
  tacticDeviations: string[]
}

export interface AnalysisPoint {
  category: "ataque" | "defesa" | "meio" | "tatica" | "individual" | "coletivo"
  title: string
  description: string
  impact: "alto" | "medio" | "baixo"
  relatedPlayers?: number[]
}

// Pool de pontos de analise para geracao
export const ANALYSIS_POSITIVES: Omit<AnalysisPoint, "relatedPlayers">[] = [
  { category: "ataque", title: "Finalizacoes precisas", description: "Time aproveitou bem as chances criadas", impact: "alto" },
  { category: "ataque", title: "Movimentacao ofensiva", description: "Atacantes se movimentaram bem entre linhas", impact: "medio" },
  { category: "ataque", title: "Triangulacoes eficientes", description: "Boas trocas de passes no ultimo terco", impact: "medio" },
  { category: "ataque", title: "Cruzamentos perigosos", description: "Laterais criaram perigo com cruzamentos", impact: "medio" },
  { category: "defesa", title: "Linha defensiva solida", description: "Defesa bem postada e sem espacos", impact: "alto" },
  { category: "defesa", title: "Goleiro seguro", description: "Goleiro fez defesas importantes", impact: "alto" },
  { category: "defesa", title: "Duelos aereos ganhos", description: "Time dominou as disputas de cabeca", impact: "medio" },
  { category: "defesa", title: "Transicao defensiva rapida", description: "Recomposicao defensiva eficiente", impact: "medio" },
  { category: "meio", title: "Controle do meio-campo", description: "Dominio na regiao central", impact: "alto" },
  { category: "meio", title: "Distribuicao de qualidade", description: "Passes precisos e criativos", impact: "medio" },
  { category: "meio", title: "Pressing eficiente", description: "Recuperacao de bola no campo ofensivo", impact: "medio" },
  { category: "tatica", title: "Plano tatico executado", description: "Time seguiu as instrucoes a risca", impact: "alto" },
  { category: "tatica", title: "Adaptacao durante o jogo", description: "Ajustes taticos foram eficazes", impact: "medio" },
  { category: "coletivo", title: "Intensidade constante", description: "Time manteve ritmo durante 90 minutos", impact: "alto" },
  { category: "coletivo", title: "Comunicacao em campo", description: "Jogadores bem sincronizados", impact: "medio" },
]

export const ANALYSIS_NEGATIVES: Omit<AnalysisPoint, "relatedPlayers">[] = [
  { category: "ataque", title: "Desperdicio de chances", description: "Finalizacoes imprecisas em boas oportunidades", impact: "alto" },
  { category: "ataque", title: "Falta de criatividade", description: "Dificuldade em criar chances claras", impact: "medio" },
  { category: "ataque", title: "Pouca movimentacao", description: "Atacantes estaticos facilitaram marcacao", impact: "medio" },
  { category: "defesa", title: "Espacos na defesa", description: "Linha defensiva deixou buracos", impact: "alto" },
  { category: "defesa", title: "Erros individuais", description: "Falhas defensivas comprometeram", impact: "alto" },
  { category: "defesa", title: "Bola aerea fragil", description: "Perdemos muitos duelos de cabeca", impact: "medio" },
  { category: "defesa", title: "Laterais expostos", description: "Adversario explorou as laterais", impact: "medio" },
  { category: "meio", title: "Perda do meio-campo", description: "Adversario dominou a regiao central", impact: "alto" },
  { category: "meio", title: "Passes errados", description: "Muitos passes interceptados", impact: "medio" },
  { category: "meio", title: "Falta de intensidade", description: "Meio-campo nao pressionou o suficiente", impact: "medio" },
  { category: "tatica", title: "Plano tatico ignorado", description: "Jogadores nao seguiram instrucoes", impact: "alto" },
  { category: "tatica", title: "Formacao inadequada", description: "Esquema tatico nao funcionou", impact: "alto" },
  { category: "coletivo", title: "Queda de ritmo", description: "Time caiu fisicamente na etapa final", impact: "medio" },
  { category: "coletivo", title: "Falta de comunicacao", description: "Jogadores desorganizados em campo", impact: "medio" },
  { category: "individual", title: "Jogador abaixo", description: "Desempenho individual comprometeu o time", impact: "medio" },
]

// Sistema de Ofertas da IA
export interface MarketInterest {
  id: string
  playerId: number
  playerName: string
  club: string
  week: number
}

export interface TransferOffer {
  id: number
  playerId: number
  playerName: string
  fromTeam: string
  offerType: "compra" | "emprestimo"
  offerAmount: number
  wageCoverage?: number // % do salario coberto no emprestimo
  loanWeeks?: number
  status: "pendente" | "aceita" | "rejeitada" | "expirada"
  createdWeek: number
  expiresWeek: number
  negotiationRound?: number
  counterStatus?: "sent" | "accepted" | "revised" | "rejected"
  counterMessage?: string
}

export interface PendingIncomingTransfer {
  id: string
  player: Player
  kind: "compra" | "emprestimo"
  fee: number
  agreedWeek: number
  agreedSeason: number
  loanWeeks?: number
  salary?: number
}

/** Janelas brasileiras simplificadas no calendario semanal: jan-mar e jul-set. */
export function isTransferWindowOpen(week: number): boolean {
  const seasonWeek = ((Math.max(1, week) - 1) % 52) + 1
  return seasonWeek <= 12 || (seasonWeek >= 27 && seasonWeek <= 36)
}

export function nextTransferWindowWeek(week: number): number {
  const seasonWeek = ((Math.max(1, week) - 1) % 52) + 1
  if (seasonWeek < 27 && seasonWeek > 12) return week + (27 - seasonWeek)
  if (seasonWeek > 36) return week + (53 - seasonWeek)
  return week
}

// Times que podem fazer ofertas
export const AI_TEAMS = [
  { short: "FLA", name: "Flamengo", budget: 80000000, prestige: 90 },
  { short: "PAL", name: "Palmeiras", budget: 75000000, prestige: 88 },
  { short: "COR", name: "Corinthians", budget: 50000000, prestige: 85 },
  { short: "SAO", name: "Sao Paulo", budget: 45000000, prestige: 84 },
  { short: "INT", name: "Internacional", budget: 40000000, prestige: 82 },
  { short: "GRE", name: "Gremio", budget: 38000000, prestige: 81 },
  { short: "CAM", name: "Atletico-MG", budget: 55000000, prestige: 83 },
  { short: "FLU", name: "Fluminense", budget: 35000000, prestige: 80 },
  { short: "BOT", name: "Botafogo", budget: 60000000, prestige: 79 },
  { short: "BAH", name: "Bahia", budget: 25000000, prestige: 75 },
  // Times europeus
  { short: "POR", name: "Porto", budget: 40000000, prestige: 85 },
  { short: "BEN", name: "Benfica", budget: 45000000, prestige: 84 },
  { short: "LEV", name: "Bayer Leverkusen", budget: 60000000, prestige: 82 },
  { short: "SEV", name: "Sevilla", budget: 35000000, prestige: 80 },
  { short: "LYO", name: "Lyon", budget: 30000000, prestige: 78 },
]

// ============================================
// ESTADO GLOBAL DO JOGO
// ============================================

interface GameEngineState {
  // Tempo
  currentWeek: number
  currentSeason: number
  isPaused: boolean
  
  // Jogadores do usuario
  squadPlayers: Player[]
  
  // Olheiros
  scouts: Scout[]
  discoveredPlayers: Player[]
  
  // Classificacoes
  serieAStandings: StandingsEntry[]
  serieBStandings: StandingsEntry[]
  
  // Copa do Brasil
  copaBrasil: CopaBracket[]
  
  // Resultados
  matchResults: MatchResult[]
  
  // Historico de confrontos
  headToHeadRecords: HeadToHead[]
  
  // Selecoes
  nationalTeamCalls: NationalTeamCall[]
  fifaDates: number[] // semanas com datas FIFA
  
  // Artilharia
  topScorers: TopScorer[]
  
  // Ofertas de transferencia
  transferOffers: TransferOffer[]
  pendingIncomingTransfers: PendingIncomingTransfer[]
  /** Sondagens: clubes de olho num jogador meu, antes de uma proposta formal. */
  marketInterests: MarketInterest[]
  
  // Taticas
  teamTactics: TeamTactics
  playerInstructions: Record<number, PlayerInstructions>
  tacticalAssignments: TacticalAssignments
  /** Coordenadas personalizadas do campo, por nome do atleta (IDs podem mudar ao importar). */
  tacticalPlayerPositions: Record<string, { x: number; y: number }>
  opponentAnalyses: OpponentAnalysis[]
  
  // Moral e vestiario
  squadMorale: SquadMorale
  
  // Conferencias de imprensa
  pressConferences: PressConference[]
  nextPressConference: PressQuestion[] | null
  
  // Relatorios de desempenho
  performanceReports: PerformanceReport[]
  
  // Reunioes com jogadores
  playerMeetings: PlayerMeeting[]
  meetingCooldowns: Record<number, number> // playerId -> week quando pode ter nova reuniao
  
  // Analises pos-partida
  postMatchAnalyses: PostMatchAnalysis[]
  
  // Financas
  balance: number
  weeklyIncome: number
  weeklyExpenses: number
  transferBudget: number
  wageBudget: number

  // Formacao tatica
  formation: string

  // Classificacao da temporada anterior
  lastSeasonStandings: StandingsEntry[]

  // Respostas acumuladas da conferencia de imprensa atual
  currentConferenceResponses: { questionId: number; selectedOption: number; impact: number }[]

  // Acoes
  advanceWeek: () => void
  generateAIOffers: (userTeamShort?: string) => void
  respondToOffer: (offerId: number, accept: boolean) => void
  counterTransferOffer: (offerId: number, amount: number, wageCoverage?: number, loanWeeks?: number) => "accepted" | "revised" | "rejected"
  trainPlayer: (playerId: number, attribute: string) => void
  setStarter: (playerId: number, isStarter: boolean) => void
  renewContract: (playerId: number, newSalary: number, weeks: number) => void
  sellPlayer: (playerId: number) => void
  /**
   * Sobe um garoto da base ao elenco profissional. NAO passa por buyPlayer de
   * proposito: promocao da base nao e transferencia e nao depende de janela.
   * Devolve false quando falta caixa.
   */
  promoverDaBase: (jovem: {
    name: string; position: string; age: number; overall: number; potential: number
    pace?: number; shooting?: number; passing?: number; dribbling?: number; defending?: number; physical?: number
  }, taxa: number) => boolean
  /** Entrada de caixa da venda de um atleta da base. */
  receberPorJovem: (valor: number) => void
  ajustarMoralJogador: (playerId: number, degraus: number) => void
  /** "wage_budget" = recusado pela diretoria por estourar o teto salarial. */
  buyPlayer: (player: Player, fee: number, isFreeAgent?: boolean) => "joined" | "pending" | "failed" | "wage_budget"
  payClubDebt: (amount: number) => number
  spendClubFunds: (amount: number) => boolean
  addClubRevenue: (amount: number) => void
  loanPlayer: (player: Player, weeks: number, salary: number) => "joined" | "pending" | "failed"
  hireScout: (scout: Scout) => void
  startScoutSearch: (scoutId: number, region: string, weeksToComplete?: number, searchCost?: number, criteria?: ScoutCriteria | null) => void
  stopScoutSearch: (scoutId: number) => void
  fireScout: (scoutId: number) => void
  simulateOtherMatches: () => void
  drawCopaBracket: () => void
  updateStandings: (result: MatchResult) => void
  addMatchResultOnly: (result: MatchResult) => void
  callUpPlayer: (playerId: number, call: NationalTeamCall) => void
  returnFromNationalTeam: (playerId: number) => void
  getPlayerById: (playerId: number) => Player | undefined
  updatePlayerStats: (playerId: number, stats: Partial<PlayerStats>) => void
  setPlayerShirtNumber: (playerId: number, shirtNumber: number) => boolean
  injurePlayer: (playerId: number, injury: PlayerInjury) => void
  healPlayer: (playerId: number) => void
  initializeGame: (teamShort: string) => void
  updateHeadToHead: (result: MatchResult) => void
  getHeadToHead: (team1: string, team2: string) => HeadToHead | null
  checkContractBonuses: (playerId: number) => void
  
  // Taticas
  setFormation: (formation: string) => void
  setTeamTactics: (tactics: Partial<TeamTactics>) => void
  setPlayerInstructions: (playerId: number, instructions: Partial<PlayerInstructions>) => void
  setTacticalAssignments: (assignments: Partial<TacticalAssignments>) => void
  setTacticalPlayerPositions: (positions: Record<string, { x: number; y: number }>) => void
  analyzeOpponent: (teamShort: string) => void
  updateOpponentAnalysis: () => void
  
  // Moral
  addMoraleEvent: (event: Omit<MoraleEvent, "week">) => void
  updateSquadMorale: () => void
  
  // Conferencias
  generatePressConference: () => void
  respondToPressConference: (questionId: number, optionIndex: number) => void
  
  // Relatorios
  generatePerformanceReport: (playerId: number, period: "semana" | "mes" | "temporada") => PerformanceReport
  
  // Reunioes
  holdMeeting: (playerId: number, meetingType: MeetingType) => PlayerMeeting
  canMeetPlayer: (playerId: number) => boolean
  
  // Analise pos-partida
  generatePostMatchAnalysis: (matchResult: MatchResult, isHome: boolean, stats: any) => PostMatchAnalysis

  // Panelinhas
  affinityGroups: AffinityGroup[]
  detectAffinityGroups: () => void

  // Marketing dinamico
  marketingContracts: MarketingContract[]
  createMarketingContract: (type: MarketingCampaignType) => void
  cancelMarketingContract: (id: number) => void

  // Gestao de staff
  staffMembers: StaffMember[]
  hireStaff: (staffId: number) => void
  fireStaff: (staffId: number) => void

  // Status effects (traumas e virtudes)
  addStatusEffect: (playerId: number, type: StatusEffectType) => void
  removeStatusEffect: (playerId: number, effectId: number) => void

  // Fundo de investimento (fatiamento de direitos)
  pendingFundOffers: InvestmentFundOffer[]
  respondToFundOffer: (offerId: number, accept: boolean) => void

  // Eventos aleatorios
  pendingEvents: RandomEvent[]
  resolveRandomEvent: (eventId: number, choiceId: number) => void

  // Leads de scouting
  scoutedLeads: ScoutedLead[]
  revealScoutedLead: (leadId: number) => void
  dismissScoutedLead: (leadId: number) => void

  // Infraestrutura do clube
  clubInfrastructure: Record<string, number>
  infraUpgradesInProgress: Record<string, { weeksLeft: number; targetLevel: number }>
  startInfrastructureUpgrade: (areaId: string, cost: number) => void

  /** Política de preço do ingresso — controla público e renda de bilheteria. */
  ticketTier: TicketTier
  setTicketTier: (tier: TicketTier) => void

  /**
   * Cobradores designados de bola parada.
   *
   * Antes o motor sorteava o cobrador por POSIÇÃO a cada lance
   * (`pickPlayerFull(side, config, ["MEI","PD","PE"])`), então o especialista do
   * elenco batia por acaso. Guardamos o NOME porque os IDs divergem entre o
   * elenco da tela e o do engine para atletas importados — é a mesma ponte que
   * o resto do projeto usa.
   */
  setPieceTakers: { freeKick?: string; corner?: string; penalty?: string }
  setSetPieceTaker: (tipo: "freeKick" | "corner" | "penalty", playerName: string | null) => void

  /** Atletas anunciados no mercado: a IA passa a sondá-los ativamente. */
  transferListedIds: number[]
  toggleTransferListed: (playerId: number) => void

  /** Rescinde o contrato pagando multa. `false` = sem caixa suficiente. */
  terminateContract: (playerId: number) => boolean

  /** Muda a POSIÇÃO do atleta (ATA→MEI etc.) — pedido do modal de gerenciamento. */
  setPlayerPosition: (playerId: number, position: string) => void

  /** Clube do usuário — impede a IA de ofertar por atleta do próprio elenco. */
  myTeamShort: string
  /** Atletas listados para EMPRÉSTIMO: a IA passa a fazer ofertas de empréstimo. */
  loanListedIds: number[]
  toggleLoanListed: (playerId: number) => void

  // Processar fim de temporada (envelhecimento, aposentadoria, jovens da base)
  processSeasonEnd: (nextSeason: number, newStandings: StandingsEntry[], lastSeasonStandings: StandingsEntry[]) => void
}

export interface InvestmentFundOffer {
  id: number
  playerId: number
  playerName: string
  fundName: string
  offerAmount: number
  fundPercentage: number
  createdWeek: number
  expiresWeek: number
  status: "pendente" | "aceita" | "rejeitada"
}

// Jogadores iniciais do Bragantino (exemplo)
const initialPlayers: Player[] = [
  {
    id: 1,
    name: "Cleiton",
    position: "GOL",
    age: 28,
    overall: 78,
    potential: 80,
    nationality: "Brasil",
    pace: 45,
    shooting: 20,
    passing: 55,
    dribbling: 35,
    defending: 25,
    physical: 70,
    energy: 100,
    morale: "Feliz",
    form: 75,
    contract: { 
      salary: 120000, 
      endDate: 156, 
      releaseClause: 15000000, 
      signedWeek: 0, 
      signedSeason: 2026,
      bonuses: [
        { type: "cleanSheets", threshold: 15, amount: 500000, achieved: false }
      ],
      autoRenewalOption: true,
      autoRenewalWeeks: 52,
      resaleClause: 0,
      previousClub: null
    },
    injury: null,
    seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
    training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
    nationalTeam: null,
    calledUp: false,
    marketValue: 8000000,
    joinedClubWeek: 0,
    joinedClubSeason: 2024,
    isLoanedIn: false,
  },
  {
    id: 2,
    name: "Nathan Mendes",
    position: "LD",
    age: 24,
    overall: 75,
    potential: 82,
    nationality: "Brasil",
    pace: 82,
    shooting: 55,
    passing: 70,
    dribbling: 72,
    defending: 74,
    physical: 70,
    energy: 100,
    morale: "Motivado",
    form: 78,
    contract: { salary: 80000, endDate: 104, releaseClause: 10000000, signedWeek: 0, signedSeason: 2026 },
    injury: null,
    seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
    training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
    nationalTeam: null,
    calledUp: false,
    marketValue: 5000000,
    joinedClubWeek: 0,
    joinedClubSeason: 2025,
    isLoanedIn: false,
  },
  {
    id: 3,
    name: "Pedro Henrique",
    position: "ZAG",
    age: 27,
    overall: 77,
    potential: 78,
    nationality: "Brasil",
    pace: 68,
    shooting: 45,
    passing: 60,
    dribbling: 55,
    defending: 80,
    physical: 82,
    energy: 100,
    morale: "Normal",
    form: 72,
    contract: { salary: 100000, endDate: 130, releaseClause: 12000000, signedWeek: 0, signedSeason: 2026 },
    injury: null,
    seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
    training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
    nationalTeam: null,
    calledUp: false,
    marketValue: 7000000,
    joinedClubWeek: 0,
    joinedClubSeason: 2024,
    isLoanedIn: false,
  },
  {
    id: 4,
    name: "Eduardo Santos",
    position: "ZAG",
    age: 25,
    overall: 76,
    potential: 80,
    nationality: "Brasil",
    pace: 70,
    shooting: 42,
    passing: 58,
    dribbling: 52,
    defending: 78,
    physical: 80,
    energy: 100,
    morale: "Feliz",
    form: 74,
    contract: { salary: 90000, endDate: 156, releaseClause: 11000000, signedWeek: 0, signedSeason: 2026 },
    injury: null,
    seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
    training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
    nationalTeam: null,
    calledUp: false,
    marketValue: 6000000,
    joinedClubWeek: 0,
    joinedClubSeason: 2025,
    isLoanedIn: false,
  },
  {
    id: 5,
    name: "Luan Candido",
    position: "LE",
    age: 23,
    overall: 74,
    potential: 83,
    nationality: "Brasil",
    pace: 85,
    shooting: 58,
    passing: 72,
    dribbling: 75,
    defending: 70,
    physical: 68,
    energy: 100,
    morale: "Motivado",
    form: 80,
    contract: { salary: 75000, endDate: 104, releaseClause: 8000000, signedWeek: 0, signedSeason: 2026 },
    injury: null,
    seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
    training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
    nationalTeam: "Brasil Sub-23",
    calledUp: false,
    marketValue: 4500000,
    joinedClubWeek: 0,
    joinedClubSeason: 2025,
    isLoanedIn: false,
  },
  {
    id: 6,
    name: "Jadsom Silva",
    position: "VOL",
    age: 22,
    overall: 73,
    potential: 84,
    nationality: "Brasil",
    pace: 72,
    shooting: 60,
    passing: 75,
    dribbling: 72,
    defending: 76,
    physical: 75,
    energy: 100,
    morale: "Normal",
    form: 76,
    contract: { salary: 70000, endDate: 130, releaseClause: 15000000, signedWeek: 0, signedSeason: 2026 },
    injury: null,
    seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
    training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
    nationalTeam: null,
    calledUp: false,
    marketValue: 5500000,
    joinedClubWeek: 0,
    joinedClubSeason: 2024,
    isLoanedIn: false,
  },
  {
    id: 7,
    name: "Eric Ramires",
    position: "MEI",
    age: 26,
    overall: 79,
    potential: 81,
    nationality: "Brasil",
    pace: 75,
    shooting: 72,
    passing: 82,
    dribbling: 80,
    defending: 55,
    physical: 70,
    energy: 100,
    morale: "Feliz",
    form: 79,
    contract: { salary: 130000, endDate: 156, releaseClause: 20000000, signedWeek: 0, signedSeason: 2026 },
    injury: null,
    seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
    training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
    nationalTeam: null,
    calledUp: false,
    marketValue: 12000000,
    joinedClubWeek: 0,
    joinedClubSeason: 2024,
    isLoanedIn: false,
  },
  {
    id: 8,
    name: "Lincoln",
    position: "MEI",
    age: 24,
    overall: 78,
    potential: 85,
    nationality: "Brasil",
    pace: 80,
    shooting: 75,
    passing: 80,
    dribbling: 82,
    defending: 55,
    physical: 68,
    energy: 100,
    morale: "Motivado",
    form: 80,
    contract: { salary: 120000, endDate: 130, releaseClause: 25000000, signedWeek: 0, signedSeason: 2026 },
    injury: null,
    seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
    training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
    nationalTeam: "Brasil",
    calledUp: false,
    marketValue: 15000000,
    joinedClubWeek: 0,
    joinedClubSeason: 2023,
    isLoanedIn: false,
  },
  {
    id: 9,
    name: "Vitinho",
    position: "PD",
    age: 25,
    overall: 76,
    potential: 80,
    nationality: "Brasil",
    pace: 88,
    shooting: 72,
    passing: 70,
    dribbling: 80,
    defending: 35,
    physical: 65,
    energy: 100,
    morale: "Normal",
    form: 77,
    contract: { salary: 85000, endDate: 104, releaseClause: 10000000, signedWeek: 0, signedSeason: 2026 },
    injury: null,
    seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
    training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
    nationalTeam: null,
    calledUp: false,
    marketValue: 6000000,
    joinedClubWeek: 0,
    joinedClubSeason: 2025,
    isLoanedIn: false,
  },
  {
    id: 10,
    name: "Eduardo Sasha",
    position: "ATA",
    age: 30,
    overall: 81,
    potential: 81,
    nationality: "Brasil",
    pace: 78,
    shooting: 85,
    passing: 68,
    dribbling: 75,
    defending: 38,
    physical: 76,
    energy: 100,
    morale: "Feliz",
    form: 75,
    contract: { salary: 180000, endDate: 78, releaseClause: null, signedWeek: 0, signedSeason: 2026 },
    injury: null,
    seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
    training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
    nationalTeam: null,
    calledUp: false,
    marketValue: 8000000,
    joinedClubWeek: 0,
    joinedClubSeason: 2024,
    isLoanedIn: false,
  },
  {
    id: 11,
    name: "Helinho",
    position: "PE",
    age: 22,
    overall: 75,
    potential: 84,
    nationality: "Brasil",
    pace: 90,
    shooting: 70,
    passing: 72,
    dribbling: 82,
    defending: 32,
    physical: 62,
    energy: 100,
    morale: "Motivado",
    form: 82,
    contract: { salary: 75000, endDate: 156, releaseClause: 20000000, signedWeek: 0, signedSeason: 2026 },
    injury: null,
    seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
    training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
    nationalTeam: "Brasil Sub-23",
    calledUp: false,
    marketValue: 7000000,
    joinedClubWeek: 0,
    joinedClubSeason: 2024,
    isLoanedIn: false,
  },
]

// Datas FIFA 2026 (semanas do ano com jogos de selecao)
const FIFA_DATES_2026 = [10, 11, 22, 23, 36, 37, 40, 41] // Marco, Junho, Setembro, Outubro

// ============================================
// STORE ZUSTAND
// ============================================

export const useGameEngine = create<GameEngineState>()(
  persist(
    (set, get) => ({
      currentWeek: 0,
      currentSeason: 2026,
      isPaused: false,
      
      squadPlayers: initialPlayers,
      
      scouts: [],
      discoveredPlayers: [],
      
      serieAStandings: [],
      serieBStandings: [],
      
      copaBrasil: [],
      
      matchResults: [],
      
      headToHeadRecords: [],
      
      nationalTeamCalls: [],
      fifaDates: FIFA_DATES_2026,
      
      topScorers: [],
      
      transferOffers: [],
      marketInterests: [],
      pendingIncomingTransfers: [],

      // Panelinhas
      affinityGroups: [],

      // Marketing dinamico
      marketingContracts: [],

      // Staff
      staffMembers: [],

      // Fundo de investimento
      pendingFundOffers: [],

      // Eventos aleatorios e leads de scouting
      pendingEvents: [],
      scoutedLeads: [],

      // Infraestrutura do clube
      clubInfrastructure: { stadium: 2, acoustics: 1, pitch: 2, training: 2, youth: 1, medical: 2, security: 1, data: 1 },
      infraUpgradesInProgress: {},
      ticketTier: "normal",
      setPieceTakers: {},
      transferListedIds: [],
      loanListedIds: [],
      myTeamShort: "",

      // Taticas padrao
      teamTactics: {
        mentality: "equilibrado",
        playingStyle: "jogo_posicional",
        passingStyle: "misto",
        tempo: "normal",
        buildUp: "misto",
        chanceCreation: "misto",
        crossingStyle: "misto",
        shootFromDistance: false,
        playThroughBalls: true,
        defensiveLine: "media",
        pressingIntensity: "media",
        markingStyle: "zonal",
        offsideTrap: false,
        counterPress: true,
        counterAttack: true,
        holdPosition: false,
        cornersAggressive: false,
        freekickSpecialist: null,
        penaltyTaker: 10, // Sasha
      },
      playerInstructions: {},
      tacticalAssignments: { corner: "", freeKick: "", freeKickLeft: "", freeKickRight: "", penalty: "", captain: "", playerRoles: {} },
      tacticalPlayerPositions: {},
      opponentAnalyses: [],
      
      // Moral
      squadMorale: {
        overall: 70,
        unity: 75,
        confidence: 70,
        recentEvents: []
      },
      
      // Conferencias
      pressConferences: [],
      nextPressConference: null,
      
      // Relatorios
      performanceReports: [],
      
      // Reunioes
      playerMeetings: [],
      meetingCooldowns: {},
      
      // Analises pos-partida
      postMatchAnalyses: [],
      
      balance: 27500000,
      weeklyIncome: 2100000,
      weeklyExpenses: 1800000,
      transferBudget: 15000000,
      wageBudget: 2500000,

      formation: "4-3-3",
      lastSeasonStandings: [],
      currentConferenceResponses: [],

      advanceWeek: () => {
        const state = get()
        const newWeek = state.currentWeek + 1
        
        set((s) => {
          // Chance de o treino render +1 no atributo. Antes era 0.7 fixo; agora o Centro de
          // Treinamento (clubInfrastructure.training, nivel 1-5) mexe na %: nivel 2 (padrao)
          // mantem 0.70, cada nivel = +5%, ate 0.90. Assim investir na estrutura acelera o
          // desenvolvimento — o "treinador/estrutura na %" que o jogador pediu.
          const trainingLvl = s.clubInfrastructure?.training ?? 2
          const trainImproveChance = Math.min(0.9, 0.6 + trainingLvl * 0.05)

          // Processar recuperacao de lesoes.
          // O Centro Medico era decorativo: a tela de infraestrutura promete
          // "-10% a -50% no tempo de lesao" por nivel, mas a recuperacao descontava
          // sempre 1 semana fixa. Agora o nivel acelera de verdade (nivel 1 = 1
          // semana, nivel 5 = 2 semanas por rodada), e o gramado sintetico — que
          // pitchInjuryDurationMultiplier ja penalizava — pesa contra.
          const medicalLvl = s.clubInfrastructure?.medical ?? 2
          // Chefe Médico da comissão soma à estrutura. O AVAILABLE_STAFF promete
          // "curas mais rápidas" no passiveEffect desde sempre, mas só o Diretor
          // de Marketing tinha efeito realmente aplicado — os demais eram texto.
          const chefeMedico = s.staffMembers.find(m => m.role === "chefe_medico")
          const bonusMedico = chefeMedico ? chefeMedico.competence / 100 : 0
          const recoveryPerWeek = Math.max(1, Math.round(1 + (medicalLvl - 1) * 0.25 + bonusMedico))
          const updatedPlayers = s.squadPlayers.map(player => {
            if (player.injury) {
              const weeksRemaining = player.injury.weeksRemaining - recoveryPerWeek
              if (weeksRemaining <= 0) {
                return { ...player, injury: null, energy: 70 }
              }
              return { ...player, injury: { ...player.injury, weeksRemaining } }
            }
            
            // Recuperar energia
            const energyGain = player.training.currentFocus ? 5 : 10
            const newEnergy = Math.min(100, player.energy + energyGain)
            
            // Processar treinamento (lastTrainingWeek check removed — would never match since currentWeek already advanced)
            if (player.training.currentFocus) {
              const weeksTrained = player.training.weeksTrained + 1
              
              // A cada 4 semanas, chance de melhoria
              if (weeksTrained >= 4) {
                const attribute = player.training.currentFocus as keyof Player
                const currentValue = player[attribute] as number
                const maxValue = player.potential

                if (currentValue < maxValue) {
                  const improvement = Math.random() < trainImproveChance ? 1 : 0
                  return {
                    ...player,
                    [attribute]: Math.min(99, currentValue + improvement),
                    energy: newEnergy,
                    training: { ...player.training, weeksTrained: 0 }
                  }
                }
                // Jogador no potencial maximo — reseta contador para nao acumular
                return {
                  ...player,
                  energy: newEnergy,
                  training: { ...player.training, weeksTrained: 0 }
                }
              }
              
              return {
                ...player,
                energy: newEnergy,
                training: { ...player.training, weeksTrained }
              }
            }
            
            return { ...player, energy: newEnergy }
          })
          
          // Fim de temporada e gerenciado por processSeasonEnd() chamado via use-game-manager
          const newSeason = s.currentSeason
          const finalWeek = newWeek
          const seasonPlayers = updatedPlayers
          const lastStandings = s.lastSeasonStandings
          
          // Processar convocacoes de selecao
          const isFifaDate = s.fifaDates.includes(newWeek)
          
          // Atualizar financas
          const weeklyBalance = s.weeklyIncome - s.weeklyExpenses
          
          // Expirar ofertas antigas
          const updatedOffers = s.transferOffers.map(offer => {
            if (offer.status === "pendente" && offer.expiresWeek <= newWeek) {
              return { ...offer, status: "expirada" as const }
            }
            return offer
          })

          // Contratos fechados fora da janela ficam registrados e chegam automaticamente
          // na primeira semana habilitada. Livres nao passam por esta fila.
          const canRegisterTransfers = isTransferWindowOpen(newWeek)
          const arrivals = canRegisterTransfers ? s.pendingIncomingTransfers : []
          const existingNames = new Set(updatedPlayers.map(p => p.name.trim().toLocaleLowerCase("pt-BR")))
          const arrivedPlayers = arrivals
            .filter(item => !existingNames.has(item.player.name.trim().toLocaleLowerCase("pt-BR")))
            .map((item, index) => ({
              ...item.player,
              id: Math.max(Date.now() + index, ...updatedPlayers.map(p => p.id + index + 1)),
              joinedClubWeek: newWeek,
              joinedClubSeason: s.currentSeason,
              isLoanedIn: item.kind === "emprestimo",
              loanEndWeek: item.kind === "emprestimo" ? newWeek + (item.loanWeeks ?? 26) : undefined,
              contract: item.kind === "emprestimo"
                ? { salary: item.salary ?? 0, endDate: newWeek + (item.loanWeeks ?? 26), releaseClause: null, signedWeek: item.agreedWeek, signedSeason: item.agreedSeason }
                : item.player.contract ? { ...item.player.contract, signedWeek: item.agreedWeek, signedSeason: item.agreedSeason } : null,
              isStarter: false,
              seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
            }))
          if (arrivedPlayers.length) updatedPlayers.push(...arrivedPlayers)

          // ---- STATUS EFFECTS: processar duracao e curas por tempo ----
          const playersAfterEffects = seasonPlayers.map(player => {
            if (!player.statusEffects?.length) return player
            const updatedEffects = player.statusEffects.filter(effect => {
              // Remove efeitos temporarios expirados
              if (!effect.isPermanent && effect.durationWeeks !== null) {
                const elapsed = newWeek - effect.appliedWeek
                if (elapsed >= effect.durationWeeks) return false
              }
              // Avanca progresso de cura por tempo
              if (effect.cureCondition?.type === "time" && effect.cureCondition.threshold > 0) {
                effect = {
                  ...effect,
                  cureCondition: {
                    ...effect.cureCondition,
                    progress: effect.cureCondition.progress + 1
                  }
                }
                if (effect.cureCondition!.progress >= effect.cureCondition!.threshold) return false
              }
              return true
            })
            return { ...player, statusEffects: updatedEffects }
          })

          // ---- MARKETING: bonus semanal e verificacao de meta no fim da temporada ----
          let marketingBonus = 0
          let updatedMarketing = s.marketingContracts.map(c => {
            if (!c.active || c.breached) return c
            marketingBonus += c.weeklyBonus
            // Verifica meta no final da temporada
            if (newWeek === c.performanceGoal.checkWeek) {
              const userPos = s.serieAStandings.findIndex(e => e.teamShort === (s.serieAStandings[0]?.teamShort ?? ""))
              const goal = c.performanceGoal
              let metGoal = false
              if (goal.type === "none") metGoal = true
              else if (goal.type === "no_relegation") metGoal = userPos < goal.threshold - 1
              // outros tipos (min_table_position, win_title) verificados externamente
              if (!metGoal && goal.type !== "none" && goal.type !== "no_relegation") {
                return { ...c, active: false, breached: true }
              }
              if (metGoal) return { ...c, active: false, fulfilled: true }
            }
            return c
          })

          // ---- CLAUSULAS TOXICAS: auditoria semanal ----
          let penaltyTotal = 0
          const playersAfterClauses = playersAfterEffects.map(player => {
            if (!player.contract?.clauses?.length) return player
            const updatedClauses = player.contract.clauses.map(clause => {
              if (!clause.active || clause.breached) return clause
              if (newWeek - clause.lastAuditedWeek < clause.weeksToAudit) return clause
              // Verifica clausula min_starter_pct
              if (clause.type === "min_starter_pct") {
                const total = player.seasonStats.matchesPlayed
                const started = Math.round(total * ((player.isStarter ? 0.8 : 0.4)))
                const pct = total > 0 ? (started / total) * 100 : 100
                if (pct < clause.threshold) {
                  penaltyTotal += clause.penaltyAmount
                  return { ...clause, breached: true, active: false, lastAuditedWeek: newWeek }
                }
              }
              // Verifica clausula no_bench_streak
              if (clause.type === "no_bench_streak" && !player.isStarter) {
                return { ...clause, breached: true, active: false, lastAuditedWeek: newWeek }
              }
              return { ...clause, lastAuditedWeek: newWeek }
            })
            return { ...player, contract: { ...player.contract, clauses: updatedClauses } }
          })

          // ---- SELEÇÕES: retornos e convocações automáticas em data FIFA ----
          let updatedCalls = s.nationalTeamCalls
          let playersAfterNT = playersAfterClauses

          // Retorno de convocados (janela terminou)
          const returningCalls = updatedCalls.filter(c => c.startWeek + c.weeksAway <= newWeek)
          if (returningCalls.length > 0) {
            const returningIds = new Set(returningCalls.map(c => c.playerId))
            playersAfterNT = playersAfterNT.map(p => returningIds.has(p.id)
              ? { ...p, calledUp: false, energy: Math.max(50, p.energy - 15) }
              : p)
            updatedCalls = updatedCalls.filter(c => !returningIds.has(c.playerId))
          }

          // Novas convocações: overall alto garante vaga; jovens promissores vão ao Sub-23
          if (isFifaDate) {
            const competition = newWeek >= 30 ? "Eliminatorias da Copa" : "Amistosos Internacionais"
            const newCalls: NationalTeamCall[] = []
            const calledIds = new Set<number>()
            for (const p of playersAfterNT) {
              if (p.calledUp || p.injury || p.loanedOut) continue
              // Brasil tem elenco mais profundo — corte mais alto
              const seniorCut = p.nationality === "Brasil" ? 82 : 77
              const isSenior = p.overall >= seniorCut
              const isU23 = !isSenior && p.age <= 23 && p.potential >= 82 && p.overall >= 74
              if (!isSenior && !isU23) continue
              // Forma influencia a convocação; titular indiscutível quase sempre vai
              const callChance = isSenior
                ? Math.min(0.95, 0.65 + Math.max(0, p.form - p.overall) * 0.03 + (p.overall - seniorCut) * 0.04)
                : 0.45
              if (Math.random() > callChance) continue
              newCalls.push({
                playerId: p.id,
                playerName: p.name,
                country: isU23 ? `${p.nationality} Sub-23` : p.nationality,
                competition,
                weeksAway: 2,
                startWeek: newWeek,
              })
              calledIds.add(p.id)
            }
            if (newCalls.length > 0) {
              updatedCalls = [...updatedCalls, ...newCalls]
              playersAfterNT = playersAfterNT.map(p => calledIds.has(p.id) ? { ...p, calledUp: true } : p)
            }
          }

          // ---- FUNDO DE INVESTIMENTO: forcar venda se chegou a semana ----
          const fundOffers: InvestmentFundOffer[] = [...s.pendingFundOffers]
          const FUND_NAMES = ["Alpha Capital", "Sport Ventures", "Global FC Fund", "Emerald Sports"]
          playersAfterNT.forEach(player => {
            if (!player.contract?.fundPercentage || player.contract.fundForceSaleWeek !== newWeek) return
            const offer: InvestmentFundOffer = {
              id: Date.now() + player.id,
              playerId: player.id,
              playerName: player.name,
              fundName: player.contract.fundName ?? FUND_NAMES[Math.floor(Math.random() * FUND_NAMES.length)],
              offerAmount: Math.round(player.marketValue * (player.contract.fundPercentage / 100)),
              fundPercentage: player.contract.fundPercentage ?? 30,
              createdWeek: newWeek,
              expiresWeek: newWeek + 3,
              status: "pendente" as const,
            }
            if (!fundOffers.some(o => o.playerId === player.id && o.status === "pendente")) {
              fundOffers.push(offer)
            }
          })

          return {
            ...s,
            currentWeek: finalWeek,
            currentSeason: newSeason,
            squadPlayers: playersAfterNT,
            nationalTeamCalls: updatedCalls,
            transferOffers: updatedOffers,
            pendingIncomingTransfers: canRegisterTransfers ? [] : s.pendingIncomingTransfers,
            marketingContracts: updatedMarketing,
            pendingFundOffers: fundOffers,
            balance: s.balance + weeklyBalance + marketingBonus - penaltyTotal,
            lastSeasonStandings: lastStandings,
          }
        })
        
        // Processar progresso dos olheiros
        set((s) => {
          const newLeads: ScoutedLead[] = []
          const updatedScouts = s.scouts.map(scout => {
            if (!scout.isSearching) return scout
            const elapsed = (scout.weeksSearching ?? 0) + 1
            const remaining = Math.max(0, (scout.weeksToComplete ?? 4) - 1)
            const total = elapsed + remaining
            const progress = Math.round((elapsed / total) * 100)
            if (remaining === 0) {
              const lead = generateScoutedLead(scout.region, scout.skill, newWeek, scout.searchCriteria)
              newLeads.push(lead)
              return { ...scout, isSearching: false, searchProgress: 100, weeksToComplete: 0, weeksSearching: elapsed, foundPlayers: [...scout.foundPlayers, lead.id] }
            }
            return { ...scout, weeksToComplete: remaining, weeksSearching: elapsed, searchProgress: progress }
          })
          return { scouts: updatedScouts, scoutedLeads: [...s.scoutedLeads, ...newLeads] }
        })

        // Processar melhorias de infraestrutura
        set((s) => {
          const completed: Record<string, number> = {}
          const remaining: Record<string, { weeksLeft: number; targetLevel: number }> = {}
          for (const [areaId, upgrade] of Object.entries(s.infraUpgradesInProgress)) {
            if (upgrade.weeksLeft <= 1) {
              completed[areaId] = upgrade.targetLevel
            } else {
              remaining[areaId] = { ...upgrade, weeksLeft: upgrade.weeksLeft - 1 }
            }
          }
          return {
            infraUpgradesInProgress: remaining,
            clubInfrastructure: { ...s.clubInfrastructure, ...completed }
          }
        })

        // Gerar evento aleatorio (~18% de chance por semana, sem repetir tipo ja pendente)
        if (Math.random() < 0.18) {
          const s = get()
          const pendingTypes = new Set(s.pendingEvents.filter(e => !e.resolved).map(e => e.type))
          const available = RANDOM_EVENTS_POOL.filter(e => !pendingTypes.has(e.type))
          if (available.length > 0) {
            const template = available[Math.floor(Math.random() * available.length)]
            const newEvent: RandomEvent = { ...template, id: Date.now() + Math.floor(Math.random() * 9999), week: newWeek, resolved: false, selectedChoice: null }
            set(cur => ({ pendingEvents: [...cur.pendingEvents, newEvent] }))
          }
        }

        // Gera novas ofertas da IA
        get().generateAIOffers()
      },
      
      trainPlayer: (playerId, attribute) => {
        set((s) => ({
          squadPlayers: s.squadPlayers.map(p =>
            p.id === playerId
              ? {
                  ...p,
                  training: {
                    currentFocus: attribute,
                    weeksTrained: 0,
                    lastTrainingWeek: s.currentWeek
                  },
                  energy: Math.max(0, p.energy - 10)
                }
              : p
          )
        }))
      },

      setStarter: (playerId, isStarter) => {
        set((s) => ({
          squadPlayers: s.squadPlayers.map(p =>
            p.id === playerId ? { ...p, isStarter } : p
          )
        }))
      },
      
      renewContract: (playerId, newSalary, weeks) => {
        const oldSalary = get().squadPlayers.find(p => p.id === playerId)?.contract?.salary || 0
        set((s) => ({
          squadPlayers: s.squadPlayers.map(p =>
            p.id === playerId
              ? {
                  ...p,
                  contract: {
                    salary: newSalary,
                    endDate: s.currentWeek + weeks,
                    releaseClause: p.contract?.releaseClause || null,
                    signedWeek: s.currentWeek,
                    signedSeason: s.currentSeason
                  },
                  morale: "Feliz"
                }
              : p
          ),
          weeklyExpenses: s.weeklyExpenses + (newSalary - oldSalary)
        }))
      },
      
      promoverDaBase: (jovem, taxa) => {
        const state = get()
        if (state.balance < taxa) return false

        // O card da base as vezes vem com os atributos zerados (o gerador de
        // prospectos nem sempre os preenche). Subir assim criaria um
        // profissional com VEL/FIN/PAS 0, que o motor de partida trata como
        // perna de pau. Sem atributo, deriva-se do overall.
        const base = jovem.overall
        const ou = (v: number | undefined, desvio: number) =>
          v && v > 0 ? v : Math.max(20, Math.min(99, Math.round(base + desvio)))

        const salario = Math.round(Math.max(8_000, base * 900))
        const novo: Player = {
          id: Math.max(Date.now(), ...state.squadPlayers.map(p => p.id + 1)),
          name: jovem.name,
          position: jovem.position,
          age: jovem.age,
          overall: jovem.overall,
          potential: Math.max(jovem.potential, jovem.overall),
          nationality: "Brasil",
          pace: ou(jovem.pace, 4), shooting: ou(jovem.shooting, -3), passing: ou(jovem.passing, -1),
          dribbling: ou(jovem.dribbling, 2), defending: ou(jovem.defending, -5), physical: ou(jovem.physical, -4),
          energy: 100, morale: "Motivado", form: 70,
          contract: {
            salary: salario,
            // Tres temporadas de contrato para o garoto da base — tempo de se
            // firmar sem virar agente livre no meio do caminho.
            endDate: state.currentWeek + 52 * 3,
            releaseClause: null,
            signedWeek: state.currentWeek,
            signedSeason: state.currentSeason,
          },
          marketValue: Math.round(base * base * 900),
          isStarter: false,
          isLoanedIn: false,
          joinedClubWeek: state.currentWeek,
          joinedClubSeason: state.currentSeason,
          seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
          injury: null,
          training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
          nationalTeam: null,
          calledUp: false,
        }

        set((s) => ({
          squadPlayers: [...s.squadPlayers, novo],
          balance: s.balance - taxa,
          weeklyExpenses: s.weeklyExpenses + salario,
        }))
        return true
      },

      receberPorJovem: (valor) => {
        if (!Number.isFinite(valor) || valor <= 0) return
        set((s) => ({ balance: s.balance + valor }))
      },

      /** Move a moral de um atleta N degraus (+ melhora, - piora). Usado pela
       *  conversa com o reserva insatisfeito. */
      ajustarMoralJogador: (playerId, degraus) => {
        const escala: Player["morale"][] = ["Infeliz", "Insatisfeito", "Normal", "Motivado", "Feliz"]
        set((s) => ({
          squadPlayers: s.squadPlayers.map(p => {
            if (p.id !== playerId) return p
            const i = Math.max(0, escala.indexOf(p.morale))
            const novo = Math.max(0, Math.min(escala.length - 1, i + degraus))
            return { ...p, morale: escala[novo] }
          }),
        }))
      },

      sellPlayer: (playerId) => {
        const state = get()
        const player = state.squadPlayers.find(p => p.id === playerId)
        if (!player) return
        
        set((s) => ({
          squadPlayers: s.squadPlayers.filter(p => p.id !== playerId),
          balance: s.balance + player.marketValue,
          weeklyExpenses: s.weeklyExpenses - (player.contract?.salary || 0)
        }))
      },
      
      /**
       * Rescinde o contrato pagando multa. Não existia forma de dispensar
       * ninguém: um atleta caro que o mercado não quisesse ficava travado no
       * elenco consumindo folha até o contrato vencer sozinho.
       *
       * A multa é o salário restante até o fim do contrato, com desconto — é
       * assim que funciona a rescisão real, e impede que dispensar saia de graça.
       */
      terminateContract: (playerId) => {
        const state = get()
        const player = state.squadPlayers.find(p => p.id === playerId)
        if (!player) return false
        const cost = terminationCost(player, state.currentWeek)
        if (state.balance < cost) return false
        set((s) => ({
          squadPlayers: s.squadPlayers.filter(p => p.id !== playerId),
          transferListedIds: (s.transferListedIds ?? []).filter(id => id !== playerId),
          balance: s.balance - cost,
          weeklyExpenses: Math.max(0, s.weeklyExpenses - (player.contract?.salary ?? 0)),
        }))
        return true
      },

      buyPlayer: (player, fee, isFreeAgent = false) => {
        const state = get()
        if (state.balance < fee) return "failed"
        // Teto salarial: a tela de Finanças já avisava "limite salarial excedido",
        // mas nada impedia a contratação — o orçamento era decorativo e o clube
        // podia se afundar em folha sem nenhuma barreira. Agora a diretoria
        // recusa o negócio que estoura o teto.
        if (exceedsWageBudget(state, player.contract?.salary ?? 0)) return "wage_budget"
        // Uma confirmacao repetida do modal nao pode cobrar duas vezes nem criar clones.
        const normalizedName = player.name.trim().toLocaleLowerCase("pt-BR")
        if (state.squadPlayers.some(p => p.name.trim().toLocaleLowerCase("pt-BR") === normalizedName) || state.pendingIncomingTransfers.some(p => p.player.name.trim().toLocaleLowerCase("pt-BR") === normalizedName)) return "failed"
        const nextId = Math.max(Date.now(), ...state.squadPlayers.map(p => p.id + 1))
        
        const newPlayer: Player = {
          ...player,
          id: nextId,
          joinedClubWeek: state.currentWeek,
          joinedClubSeason: state.currentSeason,
          isLoanedIn: false,
          isStarter: false,
          contract: player.contract ? {
            ...player.contract,
            signedWeek: state.currentWeek,
            signedSeason: state.currentSeason,
          } : null,
          seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
        }
        
        const joinsNow = isFreeAgent || isTransferWindowOpen(state.currentWeek)
        set((s) => ({
          squadPlayers: joinsNow ? [...s.squadPlayers, newPlayer] : s.squadPlayers,
          pendingIncomingTransfers: joinsNow ? s.pendingIncomingTransfers : [...s.pendingIncomingTransfers, {
            id: `incoming-${state.currentSeason}-${state.currentWeek}-${nextId}`,
            player: newPlayer,
            kind: "compra" as const,
            fee,
            agreedWeek: state.currentWeek,
            agreedSeason: state.currentSeason,
          }],
          balance: s.balance - fee,
          transferBudget: Math.max(0, s.transferBudget - fee),
          weeklyExpenses: s.weeklyExpenses + (player.contract?.salary || 50000)
        }))
        return joinsNow ? "joined" : "pending"
      },

      payClubDebt: (amount) => {
        const available=Math.max(0,get().balance),paid=Math.min(Math.max(0,amount),available)
        if(paid>0)set(state=>({balance:state.balance-paid,weeklyExpenses:state.weeklyExpenses+paid}))
        return paid
      },
      spendClubFunds:(amount)=>{const value=Math.max(0,amount);if(get().balance<value)return false;set(state=>({balance:state.balance-value,weeklyExpenses:state.weeklyExpenses+value}));return true},
      addClubRevenue:(amount)=>{const value=Math.max(0,amount);if(value>0)set(state=>({balance:state.balance+value,weeklyIncome:state.weeklyIncome+value}))},
      
      loanPlayer: (player, weeks, salary) => {
        const state = get()
        const normalizedName = player.name.trim().toLocaleLowerCase("pt-BR")
        if (state.squadPlayers.some(p => p.name.trim().toLocaleLowerCase("pt-BR") === normalizedName) || state.pendingIncomingTransfers.some(p => p.player.name.trim().toLocaleLowerCase("pt-BR") === normalizedName)) return "failed"
        
        const loanedPlayer: Player = {
          ...player,
          id: Date.now(),
          joinedClubWeek: state.currentWeek,
          joinedClubSeason: state.currentSeason,
          isLoanedIn: true,
          loanEndWeek: state.currentWeek + weeks,
          contract: { salary, endDate: state.currentWeek + weeks, releaseClause: null, signedWeek: state.currentWeek, signedSeason: state.currentSeason },
          seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
        }
        
        const joinsNow = isTransferWindowOpen(state.currentWeek)
        set((s) => ({
          squadPlayers: joinsNow ? [...s.squadPlayers, loanedPlayer] : s.squadPlayers,
          pendingIncomingTransfers: joinsNow ? s.pendingIncomingTransfers : [...s.pendingIncomingTransfers, {
            id: `incoming-loan-${state.currentSeason}-${state.currentWeek}-${loanedPlayer.id}`,
            player: loanedPlayer,
            kind: "emprestimo" as const,
            fee: 0,
            agreedWeek: state.currentWeek,
            agreedSeason: state.currentSeason,
            loanWeeks: weeks,
            salary,
          }],
          weeklyExpenses: s.weeklyExpenses + salary
        }))
        return joinsNow ? "joined" : "pending"
      },
      
      hireScout: (scout) => {
        set((s) => {
          if (s.scouts.some((item) => item.id === scout.id)) return s
          return {
            scouts: [...s.scouts, scout],
            weeklyExpenses: s.weeklyExpenses + scout.salary
          }
        })
      },
      
      startScoutSearch: (scoutId, region, weeksToComplete, searchCost, criteria) => {
        set((s) => {
          const scout = s.scouts.find((item) => item.id === scoutId)
          const cost = searchCost ?? scout?.searchCost ?? 0
          if (!scout || scout.isSearching || s.balance < cost) return s

          return {
            balance: s.balance - cost,
            scouts: s.scouts.map((item) =>
              item.id === scoutId
                ? { ...item, isSearching: true, searchProgress: 0, searchTarget: region, region, weeksToComplete: weeksToComplete ?? 4, weeksSearching: 0, searchCost: cost, searchCriteria: criteria ?? null }
                : item
            )
          }
        })
      },

      stopScoutSearch: (scoutId) => {
        set((s) => ({
          scouts: s.scouts.map(scout =>
            scout.id === scoutId
              ? { ...scout, isSearching: false, searchProgress: 0, searchTarget: null }
              : scout
          )
        }))
      },

      fireScout: (scoutId) => {
        set((s) => {
          const scout = s.scouts.find(sc => sc.id === scoutId)
          return {
            scouts: s.scouts.filter(sc => sc.id !== scoutId),
            weeklyExpenses: s.weeklyExpenses - (scout?.salary ?? 0),
          }
        })
      },

      resolveRandomEvent: (eventId, choiceId) => {
        set((s) => ({
          pendingEvents: s.pendingEvents.map(e =>
            e.id === eventId ? { ...e, resolved: true, selectedChoice: choiceId } : e
          )
        }))
      },

      revealScoutedLead: (leadId) => {
        set((s) => {
          const lead = s.scoutedLeads.find((item) => item.id === leadId)
          if (!lead || lead.revealedAttributes || s.balance < 50000) return s

          return {
            scoutedLeads: s.scoutedLeads.map((item) =>
              item.id === leadId ? { ...item, revealedAttributes: true } : item
            ),
            balance: s.balance - 50000,
          }
        })
      },

      dismissScoutedLead: (leadId) => {
        set((s) => ({ scoutedLeads: s.scoutedLeads.filter(l => l.id !== leadId) }))
      },

      startInfrastructureUpgrade: (areaId, cost) => {
        const s = get()
        const currentLevel = s.clubInfrastructure[areaId] ?? 1
        if (currentLevel >= 5 || s.infraUpgradesInProgress[areaId]) return
        if (s.balance < cost) return
        // Obra de arquibancada não sai em 4 semanas como trocar um gramado: o
        // estádio escala com o degrau construído, as demais áreas seguem rápidas.
        const weeksLeft = infrastructureUpgradeWeeks(areaId, currentLevel + 1)
        set(cur => ({
          balance: cur.balance - cost,
          infraUpgradesInProgress: {
            ...cur.infraUpgradesInProgress,
            [areaId]: { weeksLeft, targetLevel: currentLevel + 1 }
          }
        }))
      },

      setTicketTier: (tier) => set({ ticketTier: tier }),

      setSetPieceTaker: (tipo, playerName) => set((s) => ({
        setPieceTakers: { ...s.setPieceTakers, [tipo]: playerName ?? undefined },
      })),

      toggleTransferListed: (playerId) => set((s) => {
        const current = s.transferListedIds ?? []
        return current.includes(playerId)
          ? { transferListedIds: current.filter(id => id !== playerId) }
          : { transferListedIds: [...current, playerId] }
      }),

      toggleLoanListed: (playerId) => set((s) => {
        const current = s.loanListedIds ?? []
        return current.includes(playerId)
          ? { loanListedIds: current.filter(id => id !== playerId) }
          : { loanListedIds: [...current, playerId] }
      }),

      // Mudanca de POSICAO pelo modal do gerenciamento (ATA->MEI, MEI->VOL...).
      // A FUNCAO dentro da posicao (falso 9, segundo atacante) vive em
      // playerInstructions.role — sao camadas diferentes.
      setPlayerPosition: (playerId, position) => set((s) => ({
        squadPlayers: s.squadPlayers.map(p => p.id === playerId ? { ...p, position } : p),
      })),

      simulateOtherMatches: () => {
        const poissonGoals = (lambda: number): number => {
          const L = Math.exp(-lambda)
          let k = 0
          let p = 1
          do { k++; p *= Math.random() } while (p > L)
          return k - 1
        }

        set((s) => {
          const teams = s.serieAStandings.map(e => e.teamShort)
          const userShort = s.serieAStandings.find(() => true)?.teamShort
          const results: MatchResult[] = []

          for (let i = 0; i < teams.length; i += 2) {
            const home = teams[i]
            const away = teams[i + 1]
            if (!away) break
            const homeScore = poissonGoals(1.4)
            const awayScore = poissonGoals(1.1)
            results.push({ homeTeam: home, awayTeam: away, homeScore, awayScore, week: s.currentWeek, season: s.currentSeason, competition: "Brasileirao Serie A", events: [] })
          }

          const mapped = s.serieAStandings.map(entry => {
            let e = { ...entry }
            for (const r of results) {
              const isHome = e.teamShort === r.homeTeam
              const isAway = e.teamShort === r.awayTeam
              if (!isHome && !isAway) continue
              const gf = isHome ? r.homeScore : r.awayScore
              const ga = isHome ? r.awayScore : r.homeScore
              const won = gf > ga
              const draw = gf === ga
              const outcome: "W" | "D" | "L" = draw ? "D" : (won ? "W" : "L")
              e = {
                ...e,
                played: e.played + 1,
                won: e.won + (won ? 1 : 0),
                drawn: e.drawn + (draw ? 1 : 0),
                lost: e.lost + (!won && !draw ? 1 : 0),
                goalsFor: e.goalsFor + gf,
                goalsAgainst: e.goalsAgainst + ga,
                points: e.points + (draw ? 1 : won ? 3 : 0),
                form: [...e.form.slice(-4), outcome],
              }
            }
            return e
          })

          const sorted = [...mapped].sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points
            const sgA = a.goalsFor - a.goalsAgainst
            const sgB = b.goalsFor - b.goalsAgainst
            if (sgB !== sgA) return sgB - sgA
            return b.goalsFor - a.goalsFor
          })

          return {
            serieAStandings: sorted,
            matchResults: [...s.matchResults, ...results]
          }
        })
      },
      
      generateAIOffers: (userTeamShort?: string) => {
        const state = get()
        const listed = new Set([...(state.transferListedIds ?? []), ...(state.loanListedIds ?? [])])
        // O próprio clube NÃO pode ofertar por atleta do próprio elenco (relato:
        // "recebo proposta do São Paulo por jogador do São Paulo"). AI_TEAMS é
        // uma lista fixa de clubes BR; se o usuário É um deles, ele saía como
        // pretendente.
        const meuTime = (userTeamShort ?? state.myTeamShort ?? "").trim().toUpperCase()

        // Jogadores com mercado: overall alto, jovens com potencial ou em boa forma.
        // Quem o técnico colocou na lista de transferíveis entra SEMPRE — é o
        // ponto da lista: sinalizar ao mercado que o atleta está disponível.
        const marketable = state.squadPlayers.filter(p => {
          if (p.isLoanedIn || p.injury) return false
          if (p.calledUp) return false
          if (listed.has(p.id)) return true
          const youngGem = p.age <= 22 && p.potential >= 80
          const goodForm = p.form >= p.overall + 3 && p.overall >= 72
          return p.overall >= 75 || youngGem || goodForm
        })
        if (marketable.length === 0) return

        // Interesse por jogador cresce com overall/forma; janela ativa gera mais ofertas
        const newOffers: TransferOffer[] = []
        const pendingIds = new Set(
          state.transferOffers.filter(o => o.status === "pendente").map(o => o.playerId)
        )

        for (const player of marketable) {
          // No máximo 1 oferta pendente por jogador; frequência escala com atratividade
          if (pendingIds.has(player.id)) continue
          const attractiveness = (player.overall - 70) * 0.012
            + (player.potential - player.overall) * 0.008
            + Math.max(0, player.form - player.overall) * 0.01
            // Estar na lista multiplica o interesse: o clube está anunciando o atleta.
            + (listed.has(player.id) ? 0.35 : 0)
          if (Math.random() > Math.max(0.03, Math.min(0.7, attractiveness))) continue

          // Clubes candidatos avaliados pela própria IA (perfil + orçamento)
          const interested = AI_TEAMS
            .map(t => {
              const cfg = getClubAIConfig(t.short, t.prestige)
              const verdict = evaluateBuy(cfg, {
                overall: player.overall,
                age: player.age,
                value: player.marketValue,
                nationality: player.nationality,
              })
              return { team: t, cfg, verdict }
            })
            .filter(({ team, verdict }) =>
              verdict.wants &&
              team.short.toUpperCase() !== meuTime &&
              team.budget >= verdict.maxFee * 0.6 &&
              // Clube grande não busca reserva mediano; clube menor não alcança estrela
              Math.abs(team.prestige - (player.overall + 5)) <= 18
            )
          if (interested.length === 0) continue

          const { team: buyingTeam, cfg, verdict } =
            interested[Math.floor(Math.random() * interested.length)]

          // Empréstimo: jovens fora do time titular ou clube sem caixa para compra
          const wantsLoan =
            // Listado para empréstimo pelo técnico: a IA vem com proposta de
            // empréstimo, não de compra (modal do gerenciamento).
            (state.loanListedIds ?? []).includes(player.id) ||
            (player.age <= 22 && !player.isStarter && Math.random() < 0.55) ||
            buyingTeam.budget < verdict.maxFee

          let offerAmount: number
          if (wantsLoan) {
            offerAmount = player.contract?.salary
              ? Math.round(player.contract.salary * 4 * (0.5 + Math.random() * 0.5))
              : 100000
          } else {
            // Abertura de negociação: 78-95% do teto do clube (deixa espaço p/ contraproposta)
            const opening = 0.78 + Math.random() * 0.17
            offerAmount = Math.round((verdict.maxFee * opening) / 100_000) * 100_000
          }

          newOffers.push({
            id: Date.now() + player.id,
            playerId: player.id,
            playerName: player.name,
            fromTeam: buyingTeam.name,
            offerType: wantsLoan ? "emprestimo" : "compra",
            offerAmount,
            wageCoverage: wantsLoan
              ? Math.round(cfg.budgetCaution < 45 ? 80 + Math.random() * 20 : 50 + Math.random() * 40)
              : undefined,
            loanWeeks: wantsLoan ? Math.round(26 + Math.random() * 26) : undefined,
            status: "pendente",
            createdWeek: state.currentWeek,
            expiresWeek: state.currentWeek + 3,
          })
          pendingIds.add(player.id)
          if (newOffers.length >= 2) break // máx 2 ofertas novas por semana
        }

        // SONDAGENS: alem das ofertas formais, alguns clubes so "ficam de olho".
        // Um jogador atraente que nao recebeu proposta esta semana pode virar
        // sondagem — o aviso antecipa que uma oferta pode chegar. Mantem no
        // maximo as 8 mais recentes para nao inchar o save.
        const novasSondagens: MarketInterest[] = []
        const jaSondados = new Set((state.marketInterests ?? []).map(i => i.playerId))
        // O sondador NUNCA pode ser o proprio clube (relato: "meu time esta
        // sondando meu jogador"). A oferta formal ja excluia meuTime; a sondagem
        // sorteava de AI_TEAMS sem esse filtro.
        const clubesSondadores = AI_TEAMS.filter(t => t.short.toUpperCase() !== meuTime)
        for (const player of marketable) {
          if (pendingIds.has(player.id) || jaSondados.has(player.id)) continue
          if (player.overall < 74) continue
          if (Math.random() > 0.12) continue
          if (clubesSondadores.length === 0) break
          const club = clubesSondadores[Math.floor(Math.random() * clubesSondadores.length)]
          novasSondagens.push({
            id: `interest-${state.currentSeason}-${state.currentWeek}-${player.id}`,
            playerId: player.id, playerName: player.name,
            club: typeof club === "string" ? club : (club?.name ?? "Um clube"),
            week: state.currentWeek,
          })
          if (novasSondagens.length >= 2) break
        }

        if (newOffers.length > 0 || novasSondagens.length > 0) {
          set((s) => ({
            transferOffers: newOffers.length ? [...s.transferOffers, ...newOffers] : s.transferOffers,
            marketInterests: novasSondagens.length
              ? [...(s.marketInterests ?? []), ...novasSondagens].slice(-8)
              : s.marketInterests,
          }))
        }
      },
      
      respondToOffer: (offerId: number, accept: boolean) => {
        const state = get()
        const offer = state.transferOffers.find(o => o.id === offerId)
        
        if (!offer || offer.status !== "pendente") return
        
        if (accept) {
          const player = state.squadPlayers.find(p => p.id === offer.playerId)
          if (!player) return
          
          if (offer.offerType === "compra") {
            // Vende o jogador
            set((s) => ({
              squadPlayers: s.squadPlayers.filter(p => p.id !== offer.playerId),
              balance: s.balance + offer.offerAmount,
              transferBudget: s.transferBudget + offer.offerAmount,
              weeklyExpenses: s.weeklyExpenses - (player.contract?.salary || 0),
              transferOffers: s.transferOffers.map(o => 
                o.id === offerId ? { ...o, status: "aceita" as const } : o
              )
            }))
          } else {
            // Empresta o jogador — marca como loanedOut para manter rastreio no elenco
            set((s) => ({
              squadPlayers: s.squadPlayers.map(p =>
                p.id === offer.playerId
                  ? {
                      ...p,
                      loanedOut: true,
                      loanEndWeek: state.currentWeek + (offer.loanWeeks || 26),
                      parentClub: offer.fromTeam,
                    }
                  : p
              ),
              balance: s.balance + offer.offerAmount,
              weeklyExpenses: s.weeklyExpenses - (player.contract?.salary || 0) * ((offer.wageCoverage || 100) / 100),
              transferOffers: s.transferOffers.map(o =>
                o.id === offerId ? { ...o, status: "aceita" as const } : o
              )
            }))
          }
        } else {
          set((s) => ({
            transferOffers: s.transferOffers.map(o => 
              o.id === offerId ? { ...o, status: "rejeitada" as const } : o
            )
          }))
        }
      },

      counterTransferOffer: (offerId, amount, wageCoverage, loanWeeks) => {
        const state=get(),offer=state.transferOffers.find(item=>item.id===offerId)
        if(!offer||offer.status!=="pendente")return "rejected"
        const player=state.squadPlayers.find(item=>item.id===offer.playerId)
        if(!player)return "rejected"
        const team=AI_TEAMS.find(item=>item.name===offer.fromTeam||item.short===offer.fromTeam)
        const round=(offer.negotiationRound??0)+1,requested=Math.max(0,Math.round(amount/100_000)*100_000)
        const ceiling=offer.offerType==="compra"?Math.min(team?.budget??player.marketValue*1.2,player.marketValue*(1.08+round*.04)):Math.max(player.marketValue*.08,offer.offerAmount*1.35)
        if(round>3||requested>ceiling*1.18){set(s=>({transferOffers:s.transferOffers.map(item=>item.id===offerId?{...item,negotiationRound:round,counterStatus:"rejected",counterMessage:"O clube encerrou a negociação.",status:"rejeitada" as const}:item)}));return "rejected"}
        if(requested<=ceiling){set(s=>({transferOffers:s.transferOffers.map(item=>item.id===offerId?{...item,offerAmount:requested,wageCoverage:offer.offerType==="emprestimo"?Math.max(0,Math.min(100,wageCoverage??item.wageCoverage??100)):item.wageCoverage,loanWeeks:offer.offerType==="emprestimo"?Math.max(4,loanWeeks??item.loanWeeks??26):item.loanWeeks,negotiationRound:round,counterStatus:"accepted",counterMessage:"Contraproposta aceita. Confirme para concluir.",expiresWeek:state.currentWeek+1}:item)}));return "accepted"}
        const revised=Math.round(((offer.offerAmount+ceiling)/2)/100_000)*100_000
        set(s=>({transferOffers:s.transferOffers.map(item=>item.id===offerId?{...item,offerAmount:revised,negotiationRound:round,counterStatus:"revised",counterMessage:`O clube aceita chegar a ${revised.toLocaleString("pt-BR")}.`,expiresWeek:state.currentWeek+1}:item)}));return "revised"
      },
      
      drawCopaBracket: () => {
        set((s) => {
          const allShorts = s.serieAStandings.map(e => e.teamShort)
          const pool = [...allShorts].sort(() => Math.random() - 0.5).slice(0, 8)
          const p = (i: number) => pool[i] || "TBD"
          return {
            copaBrasil: [
              {
                round: "oitavas" as const,
                matches: [
                  { id: 1, team1: p(0), team2: p(1), score1: null, score2: null, winner: null, nextMatchId: 5 },
                  { id: 2, team1: p(2), team2: p(3), score1: null, score2: null, winner: null, nextMatchId: 6 },
                  { id: 3, team1: p(4), team2: p(5), score1: null, score2: null, winner: null, nextMatchId: 7 },
                  { id: 4, team1: p(6), team2: p(7), score1: null, score2: null, winner: null, nextMatchId: 8 },
                ]
              },
              {
                round: "semis" as const,
                matches: [
                  { id: 5, team1: "", team2: "", score1: null, score2: null, winner: null, nextMatchId: 9 },
                  { id: 6, team1: "", team2: "", score1: null, score2: null, winner: null, nextMatchId: 9 },
                  { id: 7, team1: "", team2: "", score1: null, score2: null, winner: null, nextMatchId: 9 },
                  { id: 8, team1: "", team2: "", score1: null, score2: null, winner: null, nextMatchId: 9 },
                ]
              },
              {
                round: "final" as const,
                matches: [
                  { id: 9, team1: "", team2: "", score1: null, score2: null, winner: null, nextMatchId: null }
                ]
              }
            ]
          }
        })
      },
      
      updateStandings: (result) => {
        set((s) => {
          const mapped = s.serieAStandings.map(entry => {
            const isHome = entry.teamShort === result.homeTeam
            const isAway = entry.teamShort === result.awayTeam
            if (!isHome && !isAway) return entry

            const gf = isHome ? result.homeScore : result.awayScore
            const ga = isHome ? result.awayScore : result.homeScore
            const homeWon = result.homeScore > result.awayScore
            const draw = result.homeScore === result.awayScore

            const outcome: "W" | "D" | "L" = draw ? "D" : (isHome ? (homeWon ? "W" : "L") : (homeWon ? "L" : "W"))
            const pts = draw ? 1 : (outcome === "W" ? 3 : 0)

            return {
              ...entry,
              played: entry.played + 1,
              won: entry.won + (outcome === "W" ? 1 : 0),
              drawn: entry.drawn + (draw ? 1 : 0),
              lost: entry.lost + (outcome === "L" ? 1 : 0),
              goalsFor: entry.goalsFor + gf,
              goalsAgainst: entry.goalsAgainst + ga,
              points: entry.points + pts,
              form: [...entry.form.slice(-4), outcome],
            }
          })

          const sorted = [...mapped].sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points
            const sgA = a.goalsFor - a.goalsAgainst
            const sgB = b.goalsFor - b.goalsAgainst
            if (sgB !== sgA) return sgB - sgA
            return b.goalsFor - a.goalsFor
          })

          return { serieAStandings: sorted, matchResults: [...s.matchResults, result] }
        })
      },

      addMatchResultOnly: (result) => {
        set((s) => ({ matchResults: [...s.matchResults, result] }))
      },

      callUpPlayer: (playerId, call) => {
        set((s) => ({
          squadPlayers: s.squadPlayers.map(p => 
            p.id === playerId ? { ...p, calledUp: true } : p
          ),
          nationalTeamCalls: [...s.nationalTeamCalls, call]
        }))
      },
      
      returnFromNationalTeam: (playerId) => {
        set((s) => ({
          squadPlayers: s.squadPlayers.map(p => 
            p.id === playerId ? { ...p, calledUp: false, energy: Math.max(50, p.energy - 20) } : p
          ),
          nationalTeamCalls: s.nationalTeamCalls.filter(c => c.playerId !== playerId)
        }))
      },
      
      getPlayerById: (playerId) => {
        return get().squadPlayers.find(p => p.id === playerId)
      },
      
      updatePlayerStats: (playerId, stats) => {
        set((s) => ({
          squadPlayers: s.squadPlayers.map(p => 
            p.id === playerId 
              ? { ...p, seasonStats: { ...p.seasonStats, ...stats } }
              : p
          )
        }))
      },

      setPlayerShirtNumber: (playerId, shirtNumber) => {
        const normalized = Math.max(1, Math.min(99, Math.floor(shirtNumber)))
        const player = get().squadPlayers.find(item => item.id === playerId)
        if (!player || get().squadPlayers.some(item => item.id !== playerId && item.shirtNumber === normalized)) return false
        set((s) => ({ squadPlayers: s.squadPlayers.map(item => item.id === playerId ? { ...item, shirtNumber: normalized } : item) }))
        return true
      },
      
      injurePlayer: (playerId, injury) => {
        set((s) => ({
          squadPlayers: s.squadPlayers.map(p => 
            p.id === playerId 
              ? { ...p, injury, morale: "Infeliz" }
              : p
          )
        }))
      },
      
      healPlayer: (playerId) => {
        set((s) => ({
          squadPlayers: s.squadPlayers.map(p => 
            p.id === playerId 
              ? { ...p, injury: null, energy: 70 }
              : p
          )
        }))
      },
      
      initializeGame: (teamShort) => {
        const serieATeams = allTeams.filter(team => team.divisao === "serie_a").map(team => team.curto)

        const serieAStandings: StandingsEntry[] = serieATeams.map(team => ({
          teamShort: team,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          points: 0,
          form: []
        }))

        // Carrega elenco do time escolhido a partir dos dados de seed
        const chosenTeam = getTeamByShort(teamShort)
        let seedPlayers: Player[] = []

        if (chosenTeam) {
          const seedList = getPlayersForTeam(chosenTeam)
          seedPlayers = seedList.map((sp, idx) => {
            const posMap: Record<string, string> = {
              MC: "VOL", ME: "MEI", MD: "MEI", CA: "ATA"
            }
            const position = posMap[sp.pos] || sp.pos
            const base = sp.base

            return {
              id: 1000 + idx,
              name: sp.nome,
              position,
              age: sp.idade,
              overall: base,
              potential: Math.min(99, base + Math.floor(Math.random() * 8)),
              nationality: "Brasil",
              pace: Math.min(99, base - 5 + Math.floor(Math.random() * 15)),
              shooting: shootingForPosition(base, position),
              passing: Math.min(99, base - 5 + Math.floor(Math.random() * 15)),
              dribbling: Math.min(99, base - 8 + Math.floor(Math.random() * 18)),
              defending: Math.min(99, base - 10 + Math.floor(Math.random() * 20)),
              physical: Math.min(99, base - 5 + Math.floor(Math.random() * 15)),
              energy: 100,
              morale: "Normal" as const,
              form: base,
              contract: {
                salary: Math.round(base * 800),
                endDate: 52 + Math.floor(Math.random() * 104),
                releaseClause: base >= 80 ? base * 500000 : null,
                signedWeek: 0,
                signedSeason: 2026
              },
              injury: null,
              seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
              training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
              nationalTeam: null,
              calledUp: false,
              marketValue: base >= 80 ? base * 300000 : base * 100000,
              joinedClubWeek: 0,
              joinedClubSeason: 2026,
              isLoanedIn: false,
              isStarter: false,
            }
          })

          // Monta um XI por SLOTS da formacao. A ordenacao simples por posicao colocava
          // ate tres goleiros e defensores demais entre os 11.
          const starterIds = new Set(
            pickStartingXI(seedPlayers, p => p.position, p => p.overall, "4-3-3").starters.map(p => p.id),
          )
          seedPlayers = seedPlayers.map(p => ({ ...p, isStarter: starterIds.has(p.id) }))
        }

        const initialBalance = chosenTeam?.saldo ?? 27500000
        const initialWeeklyExpenses = (seedPlayers.length > 0 ? seedPlayers : initialPlayers)
          .reduce((sum, p) => sum + (p.contract?.salary ?? 0), 0)
        const prestige = chosenTeam?.prestigio ?? 70
        const prestigeWeeklyIncome = prestige >= 85 ? 4500000
          : prestige >= 75 ? 2500000
          : prestige >= 60 ? 1400000
          : 800000
        // TV, bilheteria, sócios, marketing e patrocínios precisam ao menos sustentar
        // a operação inicial. Sem este piso, clubes importados com folhas reais
        // acumulavam centenas de milhões em dívida mesmo sem nenhuma contratação.
        const initialWeeklyIncome = Math.max(prestigeWeeklyIncome, Math.round(initialWeeklyExpenses * 1.08))

        set({
          currentWeek: 0,
          currentSeason: 2026,
          serieAStandings,
          copaBrasil: [],
          matchResults: [],
          headToHeadRecords: [],
          topScorers: [],
          squadPlayers: seedPlayers.length > 0 ? seedPlayers : initialPlayers,
          lastSeasonStandings: [],
          currentConferenceResponses: [],
          balance: initialBalance,
          transferBudget: Math.round(initialBalance * 0.25),
          // Garante que o orcamento salarial cubra a folha do elenco herdado (+15% de margem).
          // Antes era so 8% do caixa, o que deixava clubes com elenco caro (ex: Botafogo)
          // ja acima do limite no dia 1, sem nenhuma decisao do jogador.
          wageBudget: Math.round(Math.max(initialBalance * 0.08, initialWeeklyExpenses * 4 * 1.15)),
          weeklyIncome: initialWeeklyIncome,
          weeklyExpenses: initialWeeklyExpenses,
          pressConferences: [],
          performanceReports: [],
          playerMeetings: [],
          meetingCooldowns: {},
          postMatchAnalyses: [],
          scoutedLeads: [],
          transferOffers: [],
      marketInterests: [],
          formation: "4-3-3",
          myTeamShort: teamShort,
        })
      },
      
      updateHeadToHead: (result: MatchResult) => {
        set((s) => {
          const team1 = result.homeTeam < result.awayTeam ? result.homeTeam : result.awayTeam
          const team2 = result.homeTeam < result.awayTeam ? result.awayTeam : result.homeTeam
          
          const existingRecord = s.headToHeadRecords.find(
            h => h.team1 === team1 && h.team2 === team2
          )
          
          const newMatch: HeadToHeadMatch = {
            season: result.season,
            week: result.week,
            competition: result.competition,
            homeTeam: result.homeTeam,
            awayTeam: result.awayTeam,
            homeScore: result.homeScore,
            awayScore: result.awayScore
          }
          
          if (existingRecord) {
            // Atualiza registro existente
            const isTeam1Home = result.homeTeam === team1
            const team1Score = isTeam1Home ? result.homeScore : result.awayScore
            const team2Score = isTeam1Home ? result.awayScore : result.homeScore
            
            return {
              headToHeadRecords: s.headToHeadRecords.map(h => {
                if (h.team1 === team1 && h.team2 === team2) {
                  return {
                    ...h,
                    matches: [...h.matches, newMatch],
                    team1Wins: h.team1Wins + (team1Score > team2Score ? 1 : 0),
                    team2Wins: h.team2Wins + (team2Score > team1Score ? 1 : 0),
                    draws: h.draws + (team1Score === team2Score ? 1 : 0),
                    team1Goals: h.team1Goals + team1Score,
                    team2Goals: h.team2Goals + team2Score
                  }
                }
                return h
              })
            }
          } else {
            // Cria novo registro
            const isTeam1Home = result.homeTeam === team1
            const team1Score = isTeam1Home ? result.homeScore : result.awayScore
            const team2Score = isTeam1Home ? result.awayScore : result.homeScore
            
            const newRecord: HeadToHead = {
              team1,
              team2,
              matches: [newMatch],
              team1Wins: team1Score > team2Score ? 1 : 0,
              team2Wins: team2Score > team1Score ? 1 : 0,
              draws: team1Score === team2Score ? 1 : 0,
              team1Goals: team1Score,
              team2Goals: team2Score
            }
            
            return {
              headToHeadRecords: [...s.headToHeadRecords, newRecord]
            }
          }
        })
      },
      
      getHeadToHead: (team1: string, team2: string) => {
        const state = get()
        const t1 = team1 < team2 ? team1 : team2
        const t2 = team1 < team2 ? team2 : team1
        return state.headToHeadRecords.find(h => h.team1 === t1 && h.team2 === t2) || null
      },
      
      checkContractBonuses: (playerId: number) => {
        set((s) => {
          let bonusPaid = 0
          const squadPlayers = s.squadPlayers.map(p => {
            if (p.id !== playerId || !p.contract) return p

            const updatedBonuses = (p.contract.bonuses ?? []).map(bonus => {
              if (bonus.achieved) return bonus

              let currentValue = 0
              switch (bonus.type) {
                case "goals": currentValue = p.seasonStats.goals; break
                case "assists": currentValue = p.seasonStats.assists; break
                case "appearances": currentValue = p.seasonStats.matchesPlayed; break
                case "cleanSheets": currentValue = p.seasonStats.cleanSheets; break
                case "nationalTeam": currentValue = p.calledUp ? 1 : 0; break
                case "titles": currentValue = 0; break
              }

              if (currentValue >= bonus.threshold) {
                bonusPaid += bonus.amount
                return { ...bonus, achieved: true }
              }
              return bonus
            })

            return { ...p, contract: { ...p.contract, bonuses: updatedBonuses } }
          })

          return {
            squadPlayers,
            balance: s.balance - bonusPaid,
          }
        })
      },
      
      // ============================================
      // TATICAS
      // ============================================
      
      setFormation: (formation: string) => {
        set({ formation })
      },

      setTeamTactics: (tactics: Partial<TeamTactics>) => {
        set((s) => ({
          teamTactics: { ...s.teamTactics, ...tactics }
        }))
      },
      
      setPlayerInstructions: (playerId: number, instructions: Partial<PlayerInstructions>) => {
        set((s) => {
          const existing = s.playerInstructions[playerId] || {
            role: "meia_central",
            roaming: "liberdade_moderada",
            runs: "as_vezes",
            markingTightness: "normal",
            closingDown: "normal",
            dribbling: "normal",
            passingRisk: "normal",
            crossFrequency: "normal",
            shootFrequency: "normal",
            stayWider: false,
            cutInside: false,
            getForward: false,
            holdPosition: false,
            tackleHarder: false
          }
          return {
            playerInstructions: {
              ...s.playerInstructions,
              [playerId]: { ...existing, ...instructions }
            }
          }
        })
      },

      setTacticalAssignments: (assignments: Partial<TacticalAssignments>) => {
        set((state) => ({
          tacticalAssignments: {
            ...state.tacticalAssignments,
            ...assignments,
            playerRoles: assignments.playerRoles
              ? { ...state.tacticalAssignments.playerRoles, ...assignments.playerRoles }
              : state.tacticalAssignments.playerRoles,
          },
        }))
      },

      setTacticalPlayerPositions: (positions) => {
        set({ tacticalPlayerPositions: positions })
      },
      
      analyzeOpponent: (teamShort: string) => {
        const state = get()
        const existing = state.opponentAnalyses.find(a => a.teamShort === teamShort)
        
        if (existing && existing.analysisProgress >= 100) return
        
        const teamNames: Record<string, string> = {
          FLA: "Flamengo", PAL: "Palmeiras", COR: "Corinthians", SAO: "Sao Paulo",
          INT: "Internacional", GRE: "Gremio", CAM: "Atletico-MG", FLU: "Fluminense",
          BOT: "Botafogo", BAH: "Bahia", CRU: "Cruzeiro", FOR: "Fortaleza",
          VAS: "Vasco", CAP: "Athletico-PR", SAN: "Santos", VIT: "Vitoria",
          JUV: "Juventude", MIR: "Mirassol", SPT: "Sport", CEA: "Ceara"
        }
        
        set((s) => {
          if (existing) {
            return {
              opponentAnalyses: s.opponentAnalyses.map(a => 
                a.teamShort === teamShort 
                  ? { ...a, analysisProgress: Math.min(100, a.analysisProgress + 25) }
                  : a
              )
            }
          }
          
          const newAnalysis: OpponentAnalysis = {
            teamShort,
            teamName: teamNames[teamShort] || teamShort,
            analyzedWeek: s.currentWeek,
            analysisProgress: 25,
            formation: null,
            mentality: null,
            keyPlayers: [],
            weaknesses: [],
            strengths: [],
            avgGoalsScored: 0,
            avgGoalsConceded: 0,
            homeRecord: { w: 0, d: 0, l: 0 },
            awayRecord: { w: 0, d: 0, l: 0 }
          }
          
          return {
            opponentAnalyses: [...s.opponentAnalyses, newAnalysis]
          }
        })
      },
      
      updateOpponentAnalysis: () => {
        set((s) => ({
          opponentAnalyses: s.opponentAnalyses.map(analysis => {
            if (analysis.analysisProgress < 100) {
              const progress = Math.min(100, analysis.analysisProgress + 10)
              
              // Revela informacoes conforme progresso
              let updates: Partial<OpponentAnalysis> = { analysisProgress: progress }
              
              if (progress >= 50 && !analysis.formation) {
                const formations = ["4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "5-3-2"]
                updates.formation = formations[Math.floor(Math.random() * formations.length)]
              }
              
              if (progress >= 75 && !analysis.mentality) {
                const mentalities: TeamMentality[] = ["defensivo", "equilibrado", "ofensivo"]
                updates.mentality = mentalities[Math.floor(Math.random() * mentalities.length)]
              }
              
              if (progress >= 100) {
                const weaknessPool = ["Vulneravel em contra-ataques", "Laterais sobem muito", "Goleiro inseguro", "Bola aerea defensiva", "Saida de bola ruim"]
                const strengthPool = ["Forte no jogo aereo", "Transicao rapida", "Meio-campo criativo", "Defesa solida", "Pressao alta eficiente"]
                
                updates.weaknesses = [weaknessPool[Math.floor(Math.random() * weaknessPool.length)]]
                updates.strengths = [strengthPool[Math.floor(Math.random() * strengthPool.length)]]
                updates.avgGoalsScored = 1 + Math.random() * 1.5
                updates.avgGoalsConceded = 0.8 + Math.random() * 1.2
              }
              
              return { ...analysis, ...updates }
            }
            return analysis
          })
        }))
      },
      
      // ============================================
      // MORAL
      // ============================================
      
      addMoraleEvent: (event: Omit<MoraleEvent, "week">) => {
        const state = get()
        const newEvent: MoraleEvent = { ...event, week: state.currentWeek }
        
        set((s) => {
          const newMorale = Math.max(0, Math.min(100, s.squadMorale.overall + event.impact))
          const newConfidence = Math.max(0, Math.min(100, s.squadMorale.confidence + (event.impact * 0.7)))
          
          return {
            squadMorale: {
              ...s.squadMorale,
              overall: newMorale,
              confidence: newConfidence,
              recentEvents: [newEvent, ...s.squadMorale.recentEvents.slice(0, 9)]
            }
          }
        })
      },
      
      updateSquadMorale: () => {
        set((s) => {
          // Moral tende a voltar a 70 com o tempo
          const targetMorale = 70
          const diff = targetMorale - s.squadMorale.overall
          const adjustment = diff * 0.1
          
          return {
            squadMorale: {
              ...s.squadMorale,
              overall: Math.round(s.squadMorale.overall + adjustment)
            }
          }
        })
      },
      
      // ============================================
      // CONFERENCIAS DE IMPRENSA
      // ============================================
      
      generatePressConference: () => {
        const state = get()
        
        const questionPool: PressQuestion[] = [
          // PERGUNTAS SOBRE PARTIDA
          {
            id: 1,
            type: "match",
            question: "Como avalia o desempenho do time na ultima partida?",
            options: [
              { text: "Estou muito satisfeito, jogamos muito bem.", tone: "positivo", impact: 5 },
              { text: "Foi um resultado justo, mas podemos melhorar.", tone: "neutro", impact: 0 },
              { text: "Nao estou feliz, precisamos reagir.", tone: "negativo", impact: -3 }
            ]
          },
          {
            id: 2,
            type: "match",
            question: "O que achou da arbitragem no ultimo jogo?",
            options: [
              { text: "A arbitragem foi correta, sem reclamacoes.", tone: "neutro", impact: 1 },
              { text: "Houve erros, mas faz parte do futebol.", tone: "neutro", impact: 0 },
              { text: "Fomos prejudicados, isso e inaceitavel!", tone: "agressivo", impact: -5 }
            ]
          },
          {
            id: 3,
            type: "match",
            question: "O time sentiu pressao da torcida?",
            options: [
              { text: "A torcida nos apoiou e foi fundamental.", tone: "positivo", impact: 4 },
              { text: "Sabemos lidar com a pressao.", tone: "neutro", impact: 1 },
              { text: "A cobranca excessiva atrapalha.", tone: "negativo", impact: -6 }
            ]
          },
          // PERGUNTAS SOBRE JOGADORES
          {
            id: 4,
            type: "player",
            question: "Algum jogador tem te impressionado nos treinos?",
            options: [
              { text: "Todos estao se dedicando muito.", tone: "positivo", impact: 3 },
              { text: "Prefiro nao individualizar.", tone: "neutro", impact: 0 },
              { text: "Alguns precisam se esforcar mais.", tone: "negativo", impact: -5 }
            ]
          },
          {
            id: 5,
            type: "player",
            question: "Como esta a situacao do jogador que nao vem sendo escalado?",
            options: [
              { text: "Ele tera sua chance, estou contando com ele.", tone: "positivo", impact: 5 },
              { text: "A concorrencia e grande, precisa trabalhar.", tone: "neutro", impact: 0 },
              { text: "Nao vou falar sobre escalacao na imprensa.", tone: "agressivo", impact: -2 }
            ]
          },
          {
            id: 6,
            type: "player",
            question: "Ha jogadores insatisfeitos no elenco?",
            options: [
              { text: "O grupo esta unido e focado.", tone: "positivo", impact: 4 },
              { text: "E normal haver competicao interna.", tone: "neutro", impact: 0 },
              { text: "Quem nao estiver feliz pode procurar outro clube.", tone: "agressivo", impact: -8 }
            ]
          },
          {
            id: 7,
            type: "player",
            question: "O que espera do jovem que subiu da base?",
            options: [
              { text: "Tem muito talento, vai nos ajudar muito.", tone: "positivo", impact: 5 },
              { text: "Precisa de tempo para se adaptar.", tone: "neutro", impact: 1 },
              { text: "Ainda nao esta pronto para o time principal.", tone: "negativo", impact: -4 }
            ]
          },
          // PERGUNTAS SOBRE RIVAIS
          {
            id: 8,
            type: "rival",
            question: "O que espera do proximo adversario?",
            options: [
              { text: "Respeitamos, mas vamos jogar para vencer.", tone: "positivo", impact: 2 },
              { text: "Sera um jogo dificil, estamos preparados.", tone: "neutro", impact: 1 },
              { text: "Nao estou preocupado com eles.", tone: "agressivo", impact: -2 }
            ]
          },
          {
            id: 9,
            type: "rival",
            question: "O tecnico adversario fez provocacoes. Quer responder?",
            options: [
              { text: "Prefiro falar apenas dentro de campo.", tone: "neutro", impact: 2 },
              { text: "Cada um sabe a sua capacidade.", tone: "positivo", impact: 1 },
              { text: "Ele fala muito, vamos ver no jogo.", tone: "agressivo", impact: -3 }
            ]
          },
          {
            id: 10,
            type: "rival",
            question: "Considera este classico o mais importante do ano?",
            options: [
              { text: "Todo jogo e importante, mas este e especial.", tone: "positivo", impact: 3 },
              { text: "Sao 3 pontos como qualquer outro jogo.", tone: "neutro", impact: 0 },
              { text: "E o jogo que todos querem vencer.", tone: "positivo", impact: 2 }
            ]
          },
          // PERGUNTAS SOBRE TATICA
          {
            id: 11,
            type: "tactics",
            question: "Pretende mudar a tatica para o proximo jogo?",
            options: [
              { text: "Estamos bem como estamos.", tone: "neutro", impact: 0 },
              { text: "Sempre fazemos ajustes conforme o adversario.", tone: "positivo", impact: 2 },
              { text: "Nao vou revelar nossa estrategia.", tone: "agressivo", impact: -1 }
            ]
          },
          {
            id: 12,
            type: "tactics",
            question: "O time vai jogar mais ofensivo ou defensivo?",
            options: [
              { text: "Vamos impor nosso jogo, como sempre.", tone: "positivo", impact: 3 },
              { text: "Depende do andamento da partida.", tone: "neutro", impact: 1 },
              { text: "Nao comento sobre tatica antes do jogo.", tone: "agressivo", impact: -1 }
            ]
          },
          {
            id: 13,
            type: "tactics",
            question: "Por que o time tem sofrido tantos gols?",
            options: [
              { text: "Estamos trabalhando para corrigir isso.", tone: "neutro", impact: 0 },
              { text: "Sao detalhes que acontecem no futebol.", tone: "neutro", impact: -1 },
              { text: "A culpa nao e so da defesa, e do coletivo.", tone: "negativo", impact: -4 }
            ]
          },
          // PERGUNTAS SOBRE TRANSFERENCIAS
          {
            id: 14,
            type: "transfer",
            question: "O clube esta no mercado por reforcos?",
            options: [
              { text: "Estamos sempre atentos a oportunidades.", tone: "positivo", impact: 1 },
              { text: "Confio no elenco que temos.", tone: "neutro", impact: 2 },
              { text: "Precisamos de reforcos urgentemente.", tone: "negativo", impact: -4 }
            ]
          },
          {
            id: 15,
            type: "transfer",
            question: "Ha interesse de clubes europeus em seus jogadores?",
            options: [
              { text: "Jogadores de qualidade sempre tem mercado.", tone: "positivo", impact: 2 },
              { text: "Nao vou comentar sobre especulacoes.", tone: "neutro", impact: 0 },
              { text: "Quem quiser leva-los tera que pagar caro.", tone: "agressivo", impact: -2 }
            ]
          },
          {
            id: 16,
            type: "transfer",
            question: "Venderia seu principal jogador nesta janela?",
            options: [
              { text: "Nao ha negociacao no momento.", tone: "neutro", impact: 1 },
              { text: "Se for bom para todos, conversamos.", tone: "positivo", impact: 0 },
              { text: "Ele e fundamental e nao sai.", tone: "positivo", impact: 3 }
            ]
          },
          // PERGUNTAS SOBRE LESOES
          {
            id: 17,
            type: "injury",
            question: "Como esta a situacao do departamento medico?",
            options: [
              { text: "Estamos com o grupo praticamente completo.", tone: "positivo", impact: 2 },
              { text: "Alguns jogadores ainda se recuperam.", tone: "neutro", impact: 0 },
              { text: "As lesoes tem nos prejudicado muito.", tone: "negativo", impact: -3 }
            ]
          },
          {
            id: 18,
            type: "injury",
            question: "O jogador lesionado voltara a tempo para o classico?",
            options: [
              { text: "Estamos otimistas com a recuperacao.", tone: "positivo", impact: 2 },
              { text: "Vamos avaliar dia a dia.", tone: "neutro", impact: 0 },
              { text: "Infelizmente nao, mas temos substitutos.", tone: "neutro", impact: -1 }
            ]
          },
          // PERGUNTAS GERAIS
          {
            id: 19,
            type: "match",
            question: "Seu cargo esta ameacado apos os ultimos resultados?",
            options: [
              { text: "Tenho confianca da diretoria.", tone: "positivo", impact: 2 },
              { text: "Trabalho duro e os resultados virao.", tone: "neutro", impact: 1 },
              { text: "Isso e problema da diretoria, nao meu.", tone: "agressivo", impact: -5 }
            ]
          },
          {
            id: 20,
            type: "match",
            question: "Qual a meta do clube para esta temporada?",
            options: [
              { text: "Lutar pelo titulo, sempre.", tone: "positivo", impact: 4 },
              { text: "Chegar o mais longe possivel.", tone: "neutro", impact: 1 },
              { text: "Primeiro nos livrar do rebaixamento.", tone: "negativo", impact: -3 }
            ]
          }
        ]
        
        // Seleciona 3 perguntas aleatorias
        const shuffled = questionPool.sort(() => Math.random() - 0.5)
        const selectedQuestions = shuffled.slice(0, 3)
        
        set({ nextPressConference: selectedQuestions })
      },
      
      respondToPressConference: (questionId: number, optionIndex: number) => {
        const state = get()
        if (!state.nextPressConference) return

        const question = state.nextPressConference.find(q => q.id === questionId)
        if (!question) return

        const option = question.options[optionIndex]

        get().addMoraleEvent({
          type: option.tone === "positivo" ? "elogio" : option.tone === "negativo" ? "conflito" : "elogio",
          description: `Conferencia: "${option.text}"`,
          impact: option.impact
        })

        const newResponse = { questionId, selectedOption: optionIndex, impact: option.impact }

        set((s) => {
          const remaining = s.nextPressConference?.filter(q => q.id !== questionId) || []
          const accumulated = [...s.currentConferenceResponses, newResponse]
          const isLast = remaining.length === 0

          return {
            nextPressConference: isLast ? null : remaining,
            currentConferenceResponses: isLast ? [] : accumulated,
            pressConferences: isLast
              ? [...s.pressConferences, {
                  week: s.currentWeek,
                  questions: s.nextPressConference ?? [],
                  responses: accumulated,
                  moraleImpact: accumulated.reduce((sum, r) => sum + r.impact, 0)
                }]
              : s.pressConferences,
          }
        })
      },
      
      // ============================================
      // RELATORIOS DE DESEMPENHO
      // ============================================
      
      generatePerformanceReport: (playerId: number, period: "semana" | "mes" | "temporada"): PerformanceReport => {
        const state = get()
        const player = state.squadPlayers.find(p => p.id === playerId)
        
        if (!player) {
          return {
            playerId,
            playerName: "Desconhecido",
            period,
            avgRating: 0,
            matchRatings: [],
            vsLastPeriod: 0,
            vsSquadAvg: 0,
            vsPositionAvg: 0,
            strengths: [],
            weaknesses: [],
            recommendation: "Jogador nao encontrado"
          }
        }
        
        // Calcula nota media baseada em atributos e forma
        const avgRating = (player.overall + player.form) / 20
        
        // Identifica pontos fortes
        const strengths: string[] = []
        if (player.pace >= 85) strengths.push("Velocidade excepcional")
        if (player.shooting >= 80) strengths.push("Finalizacao precisa")
        if (player.passing >= 80) strengths.push("Qualidade de passe")
        if (player.dribbling >= 80) strengths.push("Habilidade com a bola")
        if (player.defending >= 80) strengths.push("Solidez defensiva")
        if (player.physical >= 80) strengths.push("Forca fisica")
        
        // Identifica pontos fracos
        const weaknesses: string[] = []
        if (player.pace < 60) weaknesses.push("Falta de velocidade")
        if (player.shooting < 50) weaknesses.push("Finalizacao fraca")
        if (player.passing < 60) weaknesses.push("Passes imprecisos")
        if (player.defending < 50 && !["ATA", "PE", "PD", "MEI"].includes(player.position)) weaknesses.push("Vulnerabilidade defensiva")
        
        // Recomendacao
        let recommendation = "Manter no elenco"
        if (player.form < 60) recommendation = "Precisa de mais minutos para ganhar ritmo"
        if (player.morale === "Infeliz" || player.morale === "Insatisfeito") recommendation = "Conversar com o jogador sobre sua situacao"
        if (player.age < 23 && player.potential > player.overall + 5) recommendation = "Investir em treinamento - alto potencial"
        
        return {
          playerId,
          playerName: player.name,
          period,
          avgRating,
          matchRatings: [],
          vsLastPeriod: Math.round((Math.random() - 0.5) * 20),
          vsSquadAvg: Math.round((avgRating - 7) * 10),
          vsPositionAvg: Math.round((Math.random() - 0.3) * 15),
          strengths,
          weaknesses,
          recommendation
        }
      },
      
      // ============================================
      // REUNIOES COM JOGADORES
      // ============================================
      
      canMeetPlayer: (playerId: number): boolean => {
        const state = get()
        const cooldown = state.meetingCooldowns[playerId]
        return !cooldown || cooldown <= state.currentWeek
      },
      
      holdMeeting: (playerId: number, meetingType: MeetingType): PlayerMeeting => {
        const state = get()
        const player = state.squadPlayers.find(p => p.id === playerId)
        
        if (!player) {
          return {
            id: Date.now(),
            playerId,
            playerName: "Desconhecido",
            week: state.currentWeek,
            type: meetingType,
            playerResponse: "neutro",
            moraleChange: 0,
            relationshipChange: 0,
            details: "Jogador nao encontrado"
          }
        }
        
        const meetingOption = MEETING_OPTIONS.find(m => m.type === meetingType)
        if (!meetingOption) {
          return {
            id: Date.now(),
            playerId,
            playerName: player.name,
            week: state.currentWeek,
            type: meetingType,
            playerResponse: "neutro",
            moraleChange: 0,
            relationshipChange: 0,
            details: "Tipo de reuniao invalido"
          }
        }
        
        // Determina resultado baseado nas chances
        const roll = Math.random() * 100
        let outcome: "positive" | "neutral" | "negative"
        let response: "positivo" | "neutro" | "negativo"
        
        // Modifica chances baseado na moral atual do jogador
        const moraleMod = player.morale === "Feliz" ? 10 : player.morale === "Infeliz" ? -15 : 0
        const adjustedPositiveChance = meetingOption.possibleOutcomes.positive.chance + moraleMod
        
        if (roll < adjustedPositiveChance) {
          outcome = "positive"
          response = "positivo"
        } else if (roll < adjustedPositiveChance + meetingOption.possibleOutcomes.neutral.chance) {
          outcome = "neutral"
          response = "neutro"
        } else {
          outcome = "negative"
          response = "negativo"
        }
        
        const selectedOutcome = meetingOption.possibleOutcomes[outcome]
        
        const meeting: PlayerMeeting = {
          id: Date.now(),
          playerId,
          playerName: player.name,
          week: state.currentWeek,
          type: meetingType,
          playerResponse: response,
          moraleChange: selectedOutcome.moraleChange,
          relationshipChange: outcome === "positive" ? 5 : outcome === "negative" ? -5 : 0,
          details: `${player.name} ${selectedOutcome.message}`
        }
        
        // Aplica mudancas de moral ao jogador
        const newMorale = outcome === "positive" ? "Feliz" : outcome === "negative" ? "Insatisfeito" : player.morale
        
        set((s) => ({
          playerMeetings: [meeting, ...s.playerMeetings.slice(0, 49)],
          meetingCooldowns: {
            ...s.meetingCooldowns,
            [playerId]: s.currentWeek + 2 // Cooldown de 2 semanas
          },
          squadPlayers: s.squadPlayers.map(p => 
            p.id === playerId ? { ...p, morale: newMorale, form: Math.max(50, Math.min(100, p.form + selectedOutcome.moraleChange)) } : p
          )
        }))
        
        // Adiciona evento de moral
        get().addMoraleEvent({
          type: outcome === "positive" ? "elogio" : outcome === "negative" ? "conflito" : "elogio",
          description: `Reuniao com ${player.name}: ${selectedOutcome.message}`,
          impact: Math.round(selectedOutcome.moraleChange / 2)
        })
        
        return meeting
      },
      
      // ============================================
      // ANALISE POS-PARTIDA
      // ============================================
      
      generatePostMatchAnalysis: (matchResult: MatchResult, isHome: boolean, stats: any): PostMatchAnalysis => {
        const state = get()
        
        const ourScore = isHome ? matchResult.homeScore : matchResult.awayScore
        const theirScore = isHome ? matchResult.awayScore : matchResult.homeScore
        const won = ourScore > theirScore
        const lost = ourScore < theirScore
        
        // Calcula rating geral baseado no resultado
        let overallRating = 6
        if (won) overallRating = 7 + Math.min(2, (ourScore - theirScore) * 0.5)
        if (lost) overallRating = 5 - Math.min(2, (theirScore - ourScore) * 0.5)
        overallRating = Math.round(overallRating * 10) / 10
        
        // Rating tatico
        const tacticsRating = overallRating + (Math.random() - 0.5) * 2
        
        // Seleciona pontos positivos e negativos
        const numPositives = won ? 3 : lost ? 1 : 2
        const numNegatives = lost ? 3 : won ? 1 : 2
        
        const shuffledPositives = [...ANALYSIS_POSITIVES].sort(() => Math.random() - 0.5)
        const shuffledNegatives = [...ANALYSIS_NEGATIVES].sort(() => Math.random() - 0.5)
        
        const positives: AnalysisPoint[] = shuffledPositives.slice(0, numPositives)
        const negatives: AnalysisPoint[] = shuffledNegatives.slice(0, numNegatives)
        
        // Seleciona melhores e piores jogadores
        const sortedPlayers = [...state.squadPlayers]
          .filter(p => !p.injury)
          .sort((a, b) => (b.overall + b.form) - (a.overall + a.form))
        
        const bestPlayers = sortedPlayers.slice(0, 3).map(p => ({
          playerId: p.id,
          name: p.name,
          rating: 6 + Math.random() * 3,
          reason: ["Otima atuacao", "Decisivo", "Seguro", "Criativo"][Math.floor(Math.random() * 4)]
        }))
        
        const worstPlayers = sortedPlayers.slice(-2).map(p => ({
          playerId: p.id,
          name: p.name,
          rating: 4 + Math.random() * 2,
          reason: ["Abaixo do esperado", "Erros frequentes", "Sem ritmo"][Math.floor(Math.random() * 3)]
        }))
        
        // Gera estatisticas
        const keyStats = {
          possession: 45 + Math.floor(Math.random() * 20),
          shots: 8 + Math.floor(Math.random() * 10),
          shotsOnTarget: 3 + Math.floor(Math.random() * 5),
          xG: Math.max(0, ourScore - 0.5 + Math.random()),
          xGA: Math.max(0, theirScore - 0.3 + Math.random()),
          passAccuracy: 75 + Math.floor(Math.random() * 15),
          duelsWon: 45 + Math.floor(Math.random() * 15),
          aerialDuelsWon: 40 + Math.floor(Math.random() * 20)
        }
        
        // Recomendacoes baseadas no resultado
        const recommendations: string[] = []
        if (lost) {
          recommendations.push("Revisar posicionamento defensivo")
          recommendations.push("Treinar finalizacoes")
        }
        if (keyStats.possession < 50) {
          recommendations.push("Trabalhar posse de bola")
        }
        if (keyStats.passAccuracy < 80) {
          recommendations.push("Melhorar precisao de passes")
        }
        if (won) {
          recommendations.push("Manter a estrategia atual")
        }
        
        // Desvios taticos
        const tacticDeviations: string[] = []
        if (Math.random() > 0.6) tacticDeviations.push("Laterais nao avancaram como pedido")
        if (Math.random() > 0.7) tacticDeviations.push("Pressing nao foi intenso o suficiente")
        if (Math.random() > 0.8) tacticDeviations.push("Linha defensiva muito recuada")
        
        const analysis: PostMatchAnalysis = {
          matchId: Date.now(),
          week: matchResult.week,
          opponent: isHome ? matchResult.awayTeam : matchResult.homeTeam,
          result: { home: matchResult.homeScore, away: matchResult.awayScore },
          isHome,
          overallRating,
          tacticsRating: Math.round(tacticsRating * 10) / 10,
          positives,
          negatives,
          bestPlayers,
          worstPlayers,
          keyStats,
          recommendations: recommendations.slice(0, 3),
          tacticAdherence: 60 + Math.floor(Math.random() * 35),
          tacticDeviations
        }
        
        set((s) => ({
          postMatchAnalyses: [analysis, ...s.postMatchAnalyses.slice(0, 19)]
        }))

        return analysis
      },

      // ============================================
      // STATUS EFFECTS (TRAUMAS E VIRTUDES)
      // ============================================

      addStatusEffect: (playerId: number, type: StatusEffectType) => {
        const template = STATUS_EFFECT_TEMPLATES[type]
        const effect: StatusEffect = {
          ...template,
          id: Date.now() + Math.floor(Math.random() * 1000),
          appliedWeek: get().currentWeek,
          cureCondition: template.cureCondition ? { ...template.cureCondition, progress: 0 } : undefined,
        }
        set((s) => ({
          squadPlayers: s.squadPlayers.map(p =>
            p.id === playerId
              ? { ...p, statusEffects: [...(p.statusEffects ?? []).filter(e => e.type !== type), effect] }
              : p
          )
        }))
      },

      removeStatusEffect: (playerId: number, effectId: number) => {
        set((s) => ({
          squadPlayers: s.squadPlayers.map(p =>
            p.id === playerId
              ? { ...p, statusEffects: (p.statusEffects ?? []).filter(e => e.id !== effectId) }
              : p
          )
        }))
      },

      // ============================================
      // PANELINHAS (GRUPOS DE AFINIDADE)
      // ============================================

      detectAffinityGroups: () => {
        const { squadPlayers, currentWeek } = get()
        const groups: AffinityGroup[] = []
        let gid = currentWeek * 100

        // Agrupa por nacionalidade (minimo 3 jogadores)
        const byNat: Record<string, number[]> = {}
        squadPlayers.forEach(p => {
          const key = p.nationality
          if (!byNat[key]) byNat[key] = []
          byNat[key].push(p.id)
        })
        Object.entries(byNat).forEach(([, ids]) => {
          if (ids.length >= 3) {
            const sorted = [...ids].sort((a, b) => {
              const pa = squadPlayers.find(p => p.id === a)!
              const pb = squadPlayers.find(p => p.id === b)!
              return pb.overall - pa.overall
            })
            groups.push({
              id: ++gid,
              type: "mesma_nacionalidade",
              label: `Grupo: ${squadPlayers.find(p => p.id === sorted[0])?.nationality ?? ""}`,
              memberIds: sorted,
              leaderId: sorted[0],
              cohesion: 60 + Math.floor(Math.random() * 30),
              loyaltyToCoach: 70,
              chemistryBonus: 2,
            })
          }
        })

        // Agrupa por ex-clube (previousClubShort)
        const byClub: Record<string, number[]> = {}
        squadPlayers.forEach(p => {
          if (!p.previousClubShort) return
          const key = p.previousClubShort
          if (!byClub[key]) byClub[key] = []
          byClub[key].push(p.id)
        })
        Object.entries(byClub).forEach(([club, ids]) => {
          if (ids.length >= 2) {
            const sorted = [...ids].sort((a, b) => {
              const pa = squadPlayers.find(p => p.id === a)!
              const pb = squadPlayers.find(p => p.id === b)!
              return pb.overall - pa.overall
            })
            groups.push({
              id: ++gid,
              type: "mesmo_ex_clube",
              label: `Ex-companheiros: ${club}`,
              memberIds: sorted,
              leaderId: sorted[0],
              cohesion: 50 + Math.floor(Math.random() * 35),
              loyaltyToCoach: 65,
              chemistryBonus: 3,
            })
          }
        })

        // Agrupa por faixa etaria (17-23 jovens, 24-29 meia-idade, 30+ veteranos)
        const ageGroups: Record<string, number[]> = { jovens: [], adultos: [], veteranos: [] }
        squadPlayers.forEach(p => {
          if (p.age <= 23) ageGroups.jovens.push(p.id)
          else if (p.age <= 29) ageGroups.adultos.push(p.id)
          else ageGroups.veteranos.push(p.id)
        })
        const ageLabels: Record<string, string> = { jovens: "Turma dos Jovens", adultos: "Núcleo Adulto", veteranos: "Veteranos" }
        Object.entries(ageGroups).forEach(([key, ids]) => {
          if (ids.length >= 4) {
            const sorted = [...ids].sort((a, b) => {
              const pa = squadPlayers.find(p => p.id === a)!
              const pb = squadPlayers.find(p => p.id === b)!
              return pb.overall - pa.overall
            })
            groups.push({
              id: ++gid,
              type: "mesma_faixa_etaria",
              label: ageLabels[key],
              memberIds: sorted,
              leaderId: sorted[0],
              cohesion: 55 + Math.floor(Math.random() * 25),
              loyaltyToCoach: 70,
              chemistryBonus: 2,
            })
          }
        })

        set({ affinityGroups: groups })
      },

      // ============================================
      // MARKETING DINAMICO
      // ============================================

      createMarketingContract: (type: MarketingCampaignType) => {
        const state = get()
        const template = MARKETING_CAMPAIGN_TEMPLATES[type]
        const staffMarketing = state.staffMembers.find(s => s.role === "diretor_marketing")
        const bonusMultiplier = staffMarketing ? (0.8 + staffMarketing.competence / 500) : 1
        const contract: MarketingContract = {
          ...template,
          id: Date.now(),
          startWeek: state.currentWeek,
          endWeek: state.currentWeek + 38,
          active: true,
          breached: false,
          fulfilled: false,
          upfrontPayment: Math.round(template.upfrontPayment * bonusMultiplier),
          weeklyBonus: Math.round(template.weeklyBonus * bonusMultiplier),
          performanceGoal: { ...template.performanceGoal },
        }
        set((s) => ({
          marketingContracts: [...s.marketingContracts, contract],
          balance: s.balance + contract.upfrontPayment,
        }))
      },

      cancelMarketingContract: (id: number) => {
        const contract = get().marketingContracts.find(c => c.id === id)
        if (!contract || !contract.active) return
        set((s) => ({
          marketingContracts: s.marketingContracts.map(c =>
            c.id === id ? { ...c, active: false, breached: true } : c
          ),
          balance: s.balance - Math.round(contract.penaltyAmount * 0.5),
        }))
      },

      // ============================================
      // GESTAO DE STAFF
      // ============================================

      hireStaff: (staffId: number) => {
        const state = get()
        const template = AVAILABLE_STAFF.find(s => s.id === staffId)
        if (!template) return
        // Nao pode ter dois no mesmo cargo
        if (state.staffMembers.some(s => s.role === template.role)) return
        const member: StaffMember = {
          ...template,
          hiredWeek: state.currentWeek,
          hiredSeason: state.currentSeason,
        }
        set((s) => ({
          staffMembers: [...s.staffMembers, member],
          weeklyExpenses: s.weeklyExpenses + member.salary,
        }))
      },

      fireStaff: (staffId: number) => {
        const state = get()
        const member = state.staffMembers.find(s => s.id === staffId)
        if (!member) return
        set((s) => ({
          staffMembers: s.staffMembers.filter(s => s.id !== staffId),
          weeklyExpenses: s.weeklyExpenses - member.salary,
        }))
      },

      // ============================================
      // FUNDO DE INVESTIMENTO (FATIAMENTO DE DIREITOS)
      // ============================================

      respondToFundOffer: (offerId: number, accept: boolean) => {
        const state = get()
        const offer = state.pendingFundOffers.find(o => o.id === offerId)
        if (!offer || offer.status !== "pendente") return
        if (accept) {
          set((s) => ({
            pendingFundOffers: s.pendingFundOffers.map(o =>
              o.id === offerId ? { ...o, status: "aceita" as const } : o
            ),
            squadPlayers: s.squadPlayers.map(p =>
              p.id === offer.playerId
                ? {
                    ...p,
                    contract: p.contract ? {
                      ...p.contract,
                      ownedPercentage: 100 - offer.fundPercentage,
                      fundPercentage: offer.fundPercentage,
                      fundName: offer.fundName,
                      fundForceSaleWeek: s.currentWeek + 26 + Math.floor(Math.random() * 26),
                    } : p.contract
                  }
                : p
            ),
            balance: s.balance + offer.offerAmount,
          }))
        } else {
          set((s) => ({
            pendingFundOffers: s.pendingFundOffers.map(o =>
              o.id === offerId ? { ...o, status: "rejeitada" as const } : o
            ),
          }))
        }
      },

      // ============================================
      // FIM DE TEMPORADA (envelhecimento, aposentadoria, jovens da base)
      // Chamado por use-game-manager quando a rodada final e concluida
      // ============================================

      processSeasonEnd: (nextSeason: number, newStandings: StandingsEntry[], lastSeasonStandings: StandingsEntry[]) => {
        set((s) => {
          // Envelhece jogadores e reseta stats da temporada
          const agedPlayers = s.squadPlayers.map(p => {
            const age = p.age + 1
            // EVOLUCAO POR TEMPORADA (pedido: revelado começa baixo e evolui por
            // treino E temporadas). Jovem com margem para o potencial ganha alguns
            // pontos ao virar o ano — mais quanto mais jogou e mais nova a idade;
            // veterano acima do pico começa a cair. O treino continua somando por
            // cima disto durante o ano (training-engine).
            const margem = p.potential - p.overall
            let overall = p.overall
            if (age <= 23 && margem > 0) {
              const jogos = p.seasonStats?.matchesPlayed ?? 0
              const ritmo = age <= 19 ? 4 : age <= 21 ? 3 : 2
              const ganho = Math.min(margem, ritmo + Math.floor(jogos / 12))
              overall = Math.min(p.potential, p.overall + ganho)
            } else if (age >= 32) {
              overall = Math.max(p.potential - 12, p.overall - (age >= 35 ? 2 : 1))
            }
            return {
              ...p,
              age,
              overall,
              seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
            }
          })

          // Aposentadoria: 38+ se aposentam, 35-37 tem 30% de chance
          const retiredPositions: string[] = []
          const activePlayers = agedPlayers.filter(p => {
            if (p.isLoanedIn) return true
            if (p.age >= 38) { retiredPositions.push(p.position); return false }
            if (p.age >= 35 && Math.random() < 0.30) { retiredPositions.push(p.position); return false }
            return true
          })

          // Decay de valor de mercado com a idade
          const playersWithMarketUpdate = activePlayers.map(p => {
            let mult = 1.0
            if (p.age >= 34) mult = 0.78
            else if (p.age >= 31) mult = 0.92
            else if (p.age <= 22 && p.potential > p.overall + 5) mult = 1.08
            return { ...p, marketValue: Math.round(p.marketValue * mult) }
          })

          // Gera jovens da base para substituir aposentados
          const youthAcadLevel = (s as any).infrastructure?.youthAcademyLevel ?? 2
          const staffCoord = (s as any).staffMembers?.find((sm: StaffMember) => sm.role === "coordenador_base")
          const coordBonus = staffCoord ? Math.round(staffCoord.competence / 20) : 0

          const YOUTH_NAMES = ["Lucas","Gabriel","Pedro","Matheus","João","Rafael","Felipe","André","Bruno","Carlos","Thiago","Vitor","Diego","Leandro","Ricardo","Kauan","Luan","Kayke","Guilherme","Alexandre"]
          const YOUTH_SURNAMES = ["Silva","Santos","Oliveira","Lima","Costa","Ferreira","Ribeiro","Alves","Carvalho","Nascimento","Gomes","Martins","Pereira","Araújo","Souza","Teixeira","Freitas","Castro","Barbosa","Rocha"]
          const REGIONS_BY_LEVEL: Record<number, { names: string[], nationality: string, physBonus: number, techBonus: number }> = {
            1: { names: YOUTH_NAMES, nationality: "Brasil", physBonus: 0, techBonus: 0 },
            2: { names: YOUTH_NAMES, nationality: "Brasil", physBonus: 1, techBonus: 1 },
            3: { names: [...YOUTH_NAMES, "Nduka","Diallo","Mensah"], nationality: "África", physBonus: 5, techBonus: 2 },
            4: { names: [...YOUTH_NAMES, "Tran","Park","Kim","Santos"], nationality: "Misto", physBonus: 3, techBonus: 5 },
            5: { names: YOUTH_NAMES, nationality: "Brasil", physBonus: 4, techBonus: 6 },
          }
          const region = REGIONS_BY_LEVEL[Math.min(5, youthAcadLevel)]
          const FALLBACK_POSITIONS = ["GOL","ZAG","ZAG","LAT","LAT","VOL","VOL","MEI","MEI","ATA","PD","PE"]
          const MIN_SQUAD = 18
          const needed = Math.max(retiredPositions.length, Math.max(0, MIN_SQUAD - playersWithMarketUpdate.length))
          const baseMin = 55 + youthAcadLevel * 3 + coordBonus
          const baseRange = 10 + youthAcadLevel * 2
          const potentialBonus = youthAcadLevel * 3 + coordBonus

          const youthPlayers: Player[] = Array.from({ length: needed }).map((_, i) => {
            const firstName = region.names[Math.floor(Math.random() * region.names.length)]
            const lastName = YOUTH_SURNAMES[Math.floor(Math.random() * YOUTH_SURNAMES.length)]
            const pos = retiredPositions[i] ?? FALLBACK_POSITIONS[i % FALLBACK_POSITIONS.length]
            const age = 17 + Math.floor(Math.random() * 4)
            const base = Math.min(82, baseMin + Math.floor(Math.random() * baseRange))
            const potential = Math.min(95, base + 8 + potentialBonus + Math.floor(Math.random() * 12))
            const nationality = region.nationality === "Misto"
              ? (Math.random() > 0.5 ? "Brasil" : "Internacional")
              : region.nationality
            return {
              id: Date.now() + i * 7 + 5000,
              name: `${firstName} ${lastName}`,
              position: pos,
              age,
              overall: base,
              potential,
              nationality,
              pace: Math.min(99, base + Math.floor(Math.random() * 15) + region.physBonus),
              shooting: Math.min(99, shootingForPosition(base, pos) + region.techBonus),
              passing: Math.min(99, base - 5 + Math.floor(Math.random() * 15) + region.techBonus),
              dribbling: Math.min(99, base - 8 + Math.floor(Math.random() * 18) + region.techBonus),
              defending: Math.min(99, base - 10 + Math.floor(Math.random() * 20) + region.physBonus),
              physical: Math.min(99, base - 5 + Math.floor(Math.random() * 15) + region.physBonus),
              energy: 100,
              morale: "Motivado" as const,
              form: base - 5,
              contract: {
                salary: Math.round(base * 400),
                endDate: 78 + Math.floor(Math.random() * 78),
                releaseClause: null,
                signedWeek: 0,
                signedSeason: nextSeason
              },
              injury: null,
              seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
              training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
              nationalTeam: null,
              calledUp: false,
              marketValue: base * 80000,
              joinedClubWeek: 0,
              joinedClubSeason: nextSeason,
              isLoanedIn: false,
              statusEffects: [],
            }
          })

          return {
            squadPlayers: [...playersWithMarketUpdate, ...youthPlayers],
            serieAStandings: newStandings,
            lastSeasonStandings,
            currentWeek: 0,
            currentSeason: nextSeason,
            matchResults: [],
          }
        })
      },
    }),
    {
      name: 'ultrafoot-game-engine',
      version: 3,
      migrate: (persistedState, version) => {
        const state = persistedState as Partial<GameEngineState>
        if (version >= 3 || !Array.isArray(state.squadPlayers)) return state as GameEngineState
        // v2 convertia CA (centroavante) em MEI ao criar o elenco. Repara somente
        // esse sentido inequívoco da conversão, preservando edições manuais de
        // posição feitas pelo usuário em qualquer outro jogador.
        return {
          ...state,
          squadPlayers: state.squadPlayers.map((player: Player) => {
            const canonical = getCanonicalSeedPosition(player.name)
            return player.position === "MEI" && canonical === "ATA"
              ? { ...player, position: "ATA" }
              : player
          }),
        } as GameEngineState
      },
      // Persistido no persistent-store (arquivo, sobrevive a reinstalacao) em vez do
      // localStorage da webview, que era limpo nos updates e fazia o elenco/tabela
      // "sumir". O adaptador migra automaticamente qualquer save legado do localStorage.
      storage: createJSONStorage(() => createTauriZustandStorage()),
    }
  )
)

/**
 * Forca um snapshot imediato do motor principal. O middleware ja persiste cada mudanca,
 * mas esta funcao permite que botoes de salvar e o autosave deem uma garantia explicita
 * antes de navegar ou fechar o jogo.
 */
export function persistGameEngineNow(): void {
  if (typeof window === "undefined") return
  const state = useGameEngine.getState()
  storeSet(getCareerScopedKey("ultrafoot-game-engine"), JSON.stringify({ state, version: 3 }))
}

/** Salva titulares e formacao de uma vez, evitando um radar ler um estado intermediario. */
export function saveTacticalSetup(
  starterNames: string[],
  formation: string,
  tacticalPlayerPositions?: Record<string, { x: number; y: number }>,
): void {
  const names = new Set(starterNames)
  useGameEngine.setState(state => ({
    formation,
    tacticalPlayerPositions: tacticalPlayerPositions ?? state.tacticalPlayerPositions,
    squadPlayers: state.squadPlayers.map(player => ({
      ...player,
      isStarter: names.has(player.name),
    })),
  }))
  persistGameEngineNow()
}

// ============================================
// HELPERS
// ============================================

export function formatWeeksToDate(weeks: number, startSeason: number): string {
  const totalWeeks = weeks
  const years = Math.floor(totalWeeks / 52)
  const remainingWeeks = totalWeeks % 52
  const season = startSeason + years
  const month = Math.floor((remainingWeeks / 52) * 12)
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
  return `${months[month]} ${season}`
}

export function getContractStatus(player: Player, currentWeek: number): "ok" | "expiring" | "expired" {
  if (!player.contract) return "expired"
  const weeksRemaining = player.contract.endDate - currentWeek
  if (weeksRemaining <= 0) return "expired"
  if (weeksRemaining <= 26) return "expiring" // 6 meses
  return "ok"
}

export function calculatePlayerGrowth(player: Player): number {
  // Calcula o crescimento baseado em potencial, idade e treinamento
  const ageFactor = player.age < 24 ? 1.5 : player.age < 28 ? 1.0 : 0.3
  const potentialGap = player.potential - player.overall
  return Math.round(potentialGap * ageFactor)
}

export function getInjuryRecoveryTime(severity: "leve" | "media" | "grave"): number {
  switch (severity) {
    case "leve": return Math.floor(Math.random() * 2) + 1 // 1-2 semanas
    case "media": return Math.floor(Math.random() * 4) + 3 // 3-6 semanas
    case "grave": return Math.floor(Math.random() * 12) + 8 // 8-20 semanas
  }
}

export const INJURY_TYPES = [
  "Distensao muscular",
  "Entorse de tornozelo",
  "Lesao no joelho",
  "Contusao",
  "Fadiga muscular",
  "Lesao no ombro",
  "Fratura"
]

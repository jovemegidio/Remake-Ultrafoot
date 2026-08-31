// Sistema central do jogo - gerencia jogadores, contratos, lesoes, treinamento, temporada, etc.

"use client"

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createTauriZustandStorage, storeSet } from "@/lib/persistent-store"
import { getCareerScopedKey, loadGameState } from "@/lib/save-system"
import { bonusMentoria282, normalizarGestao282, rendimentoUnidade282 } from "@/lib/gestao-282"
import { repartirVenda, descreverRepasses } from "@/lib/repartir-venda"
import {
  TERMOS_A_VISTA, descontoPorRecompra, descontoPorRevenda, parcelasRestantes, parcelasVencidas,
  recompraValida, resolverNegocio, saldoDasParcelas,
  type Parcela, type Recompra, type TermosDoNegocio,
} from "@/lib/clausulas-do-negocio"
import { allTeams, getTeamByFileKey, getTeamByShort, effectiveDivision } from "@/lib/teams-data"
import {
  type PlayerPersona, gerarPersona, contribuicoesPorJogador, calcularNota, suspensaoPorCartoes,
  rotuloDaMoral, pontosDoRotulo,
} from "@/lib/player-realism"
import { getCanonicalSeedPosition, getPlayersForTeam } from "@/lib/players-data"
import { getClubAIConfig } from "@/lib/ai-club-engine"
import {
  avaliarCompra, decisaoDoAtleta, papelPrevisto, perfilDeElenco, ROTULO_DO_PAPEL, sondagemDe,
  type AtletaAlvo, type AvaliacaoDeCompra, type ClubeComprador, type PapelPrevisto, type Sondagem,
} from "@/lib/mercado-realista"
import { normalizePosition, pickStartingXI } from "@/lib/formations"
import { aprenderPosicao, exercerFuncao, perfilDoAtleta, type ProgressoDoPerfil } from "@/lib/modelo-de-jogador"
import { registrarLesao, riscoPorHistorico, type LesaoRegistrada } from "@/lib/historico-de-lesoes"
import { CAMPOS_DO_CLUBE } from "@/lib/chaveamento-de-tecnico"
import { infrastructureUpgradeWeeks, type TicketTier } from "@/lib/stadium-economy"
import { playerSalaryWeekly, playerMarketValue, weeklyIncomeFor, FRACAO_DO_CUSTO_OPERACIONAL, youthPromotionSalaryWeekly } from "@/lib/club-economy"
import { reforcosEmergenciais, gerarNomeDeAtleta, ELENCO_MINIMO } from "@/lib/reposicao-emergencial"
import { decidirRenovacoes, decidirContratacoes } from "@/lib/diretoria"
import { nomeDeAtleta } from "@/lib/nomes-por-pais"
import { normalizeCountry, PAIS_DESCONHECIDO } from "@/lib/country-normalize"
// Fiscalização do Modo Desafios. O módulo só guarda dados e funções puras (os
// TIPOS que ele importa do save-system somem na compilação), então não há ciclo.
import { podeReforcar } from "@/lib/challenge-engine"

/** Prazo minimo que um reforco assina ao chegar. Ver o contrato em `buyPlayer`. */
const PRAZO_MINIMO_DE_CONTRATO_ANOS = 2
import { attributesFromOverall, evoluirAtributos, overallFromAttributes } from "@/lib/player-attributes"
import { multiplicadorDeValor, prestigioDe, type PrestigioDosAtletas } from "@/lib/prestigio-do-atleta"
// Modulo puro (sem imports proprios): entra aqui sem risco de ciclo. Serve para
// o promovido da base chegar ao elenco valendo o MESMO que valia na base.
import { valorDeMercadoJovem } from "@/lib/youth-academy-rules"
import { recordWorldTransfer } from "@/lib/world-market"
// ROTINA DA SEMANA (dia de jogo / treino / descanso). Modulo puro: so calcula a
// composicao da semana e os fatores que ela impoe ao treino e a recuperacao.
import { montarRotina, type Postura } from "@/lib/rotina-da-semana"
// EXTRATO DE MOVIMENTACOES. Toda entrada/saida do elenco passa a deixar rastro no
// save (pedido: "ao salvar deve salvar tudo... todas as movimentacoes feitas pelo
// jogador"). O modulo so importa save-system, que NAO importa o motor — sem ciclo.
import { registrarMovimentacao } from "@/lib/movimentacoes"
// Modulo puro (sem imports): a expulsao vira julgamento em vez de 1 jogo fixo.
import { julgar, inferirInfracao, type JulgamentoTribunal } from "@/lib/tribunal"
import {
  aplicarSemanaDeTreino, decairEntrosamento, entrosamentoDoGrupo, minutosDeTreinoColetivo,
  PISO_ENTROSAMENTO, PLANO_PADRAO, registrarMinutosJuntos as creditarMinutosJuntos,
  semearParesDeHistorico,
  type AtletaNaSemana, type ParesDeEntrosamento, type PlanoDeTreino,
} from "@/lib/treino-e-entrosamento"
import { analyseSquadDynamics, applyWeeklyPlayingTimeMorale } from "@/lib/squad-dynamics"
// O TÉCNICO EM NÚMEROS. Retrato publicado pelo save-system — o motor não pode
// importar o save (ciclo), como já acontece com o Modo Desafios.
import { efeitosDoTreinador } from "@/lib/efeito-do-treinador"
import { modalidadeAtual } from "@/lib/tom-da-modalidade"

/**
 * Versao do formato persistido do motor. Fica numa constante porque e usada em
 * DOIS lugares: o `persist` do zustand e o `persistGameEngineNow`.
 *
 * Estavam separados, cada um com o numero escrito a mao. Ao subir o `persist`
 * para 4, o snapshot manual continuaria gravando 3 — e a migracao rodaria de
 * novo a cada gravacao, para sempre.
 */
const GAME_ENGINE_PERSIST_VERSION = 5


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
  /** Evolucao da carreira da comissao (1.0.291). Opcionais em saves antigos. */
  potential?: number
  experienceWeeks?: number
  contractEndSeason?: number
  marketInterest?: number
  generatedCandidate?: boolean
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

const STAFF_FIRST_NAMES = ["Alex", "Bruno", "Caio", "Daniel", "Felipe", "Gustavo", "Henrique", "Igor", "João", "Lucas", "Mateus", "Nicolas"]
const STAFF_LAST_NAMES = ["Azevedo", "Barbosa", "Cardoso", "Duarte", "Esteves", "Freitas", "Gomes", "Lopes", "Moura", "Nunes", "Ribeiro", "Tavares"]

function staffSeed(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619)
  return hash >>> 0
}

/** Mercado renovavel: dois candidatos novos por cargo a cada temporada. */
export function staffCandidatesForSeason(
  season: number,
  role?: StaffRole,
): Omit<StaffMember, "hiredWeek" | "hiredSeason">[] {
  const allRoles = Object.keys(STAFF_ROLE_LABELS) as StaffRole[]
  const roles = allRoles.filter(item => !role || item === role)
  const generated = roles.flatMap((candidateRole) => Array.from({ length: 2 }, (_, slot) => {
    const seed = staffSeed(`${season}:${candidateRole}:${slot}`)
    const competence = 52 + seed % 34
    const potential = Math.min(96, competence + 5 + ((seed >>> 8) % 12))
    return {
      id: season * 100 + allRoles.indexOf(candidateRole) * 2 + slot + 1,
      name: `${STAFF_FIRST_NAMES[seed % STAFF_FIRST_NAMES.length]} ${STAFF_LAST_NAMES[(seed >>> 5) % STAFF_LAST_NAMES.length]}`,
      role: candidateRole,
      competence,
      potential,
      loyalty: 48 + ((seed >>> 11) % 48),
      passiveEffect: `${STAFF_ROLE_LABELS[candidateRole]} em ascensão; potencial ${potential}.`,
      salary: Math.round((12_000 + competence ** 2 * 8) / 500) * 500,
      problemChance: Math.max(0.02, (78 - competence) / 180),
      experienceWeeks: 0,
      contractEndSeason: season + 3,
      marketInterest: 0,
      generatedCandidate: true,
    }
  }))
  const base = AVAILABLE_STAFF
    .filter(item => !role || item.role === role)
    .map(item => ({ ...item, potential: Math.min(96, item.competence + 7), experienceWeeks: 0, contractEndSeason: season + 3, marketInterest: 0 }))
  return [...base, ...generated]
}

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
  /**
   * Tratamento ja aplicado nesta lesao. Existe para TRAVAR repeticao: sem ele,
   * mandar fisioterapia em sequencia multiplica 0,8 ate a lesao sumir por
   * R$ 50 mil a rodada. Uma lesao, um tratamento.
   */
  tratamento?: TratamentoMedico
}

/**
 * DEPARTAMENTO MEDICO. O tratamento e uma decisao de uma vez por lesao: paga-se
 * na hora e o prazo muda na hora. A recuperacao semanal continua sendo do
 * avanco de semana — aqui so se encurta (ou alonga) o que falta.
 */
export type TratamentoMedico = "conservador" | "fisioterapia" | "cirurgia"

export interface ResultadoDoTratamento {
  ok: boolean
  /** Por que falhou, para a tela dizer algo util em vez de nao reagir. */
  motivo?: "sem-lesao" | "sem-dinheiro" | "ja-tratado"
  custo: number
  semanasAntes: number
  semanasDepois: number
}

/**
 * Custo e efeito de cada tratamento. `fator` multiplica as semanas restantes:
 * a cirurgia alonga o prazo de proposito — ela e para lesao grave, onde o
 * ganho e nao ter recaida, nao voltar antes.
 */
export const TRATAMENTOS_MEDICOS: Record<TratamentoMedico, { custo: number; fator: number }> = {
  conservador: { custo: 0, fator: 1 },
  fisioterapia: { custo: 50_000, fator: 0.8 },
  cirurgia: { custo: 200_000, fator: 1.3 },
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
  /**
   * POSICAO que o atleta esta aprendendo (normalizada: "ZAG", "VOL"...).
   *
   * Ate esta versao so se aprendia uma posicao JOGANDO nela (`aprenderPosicao`,
   * creditado pelos minutos oficiais) — ou seja, para adaptar um lateral a
   * zagueiro era preciso escala-lo fora de posicao em jogo valendo pontos, e
   * pagar o preco disso rodada apos rodada. Nao havia como preparar a mudanca no
   * CT, que e como um clube de verdade faz.
   *
   * ⚠️ EXCLUSIVO com `currentFocus`: e o MESMO slot de treino individual. Deixar
   * os dois ativos daria dois treinos pelo preco de um, e o atleta ganharia
   * atributo e posicao na mesma semana pagando so uma vez de energia.
   */
  positionFocus?: string | null
}

export interface Player {
  /**
   * Lesoes que este atleta ja teve (as 12 mais recentes).
   *
   * Mora no ATLETA de proposito: viaja junto numa transferencia e entra/sai do
   * bolso do tecnico no co-op pelo mesmo caminho do elenco, sem exigir campo
   * novo no save. Ver lib/historico-de-lesoes.ts.
   */
  historicoDeLesoes?: LesaoRegistrada[]
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
  /**
   * CRIA DA BASE — subiu da categoria de base DESTE clube.
   *
   * Não é enfeite: quem formou o atleta é informação que muda decisão (segurar,
   * emprestar para rodar, vender). No elenco ele era indistinguível de um
   * reforço comprado. Opcional porque saves anteriores não têm a marca — e
   * inventá-la para quem já estava no elenco seria falsificar o histórico.
   */
  criaDaBase?: boolean
  isLoanedIn: boolean
  loanedOut?: boolean
  loanEndWeek?: number
  loanSalaryReduction?: number
  parentClub?: string
  /**
   * OPÇÃO DE COMPRA acertada na mesa do empréstimo (0/ausente = sem opção).
   *
   * A negociação de empréstimo (lib/emprestimos.ts, `TermosNovoEmprestimo`) já
   * discutia opção de compra desde a 1.0.228 — o dono aceitava ou não, cobrava um
   * piso, e a barra de satisfação contava com ela. Só que o valor acertado
   * MORRIA na tela: `loanPlayer` não recebia o campo e o atleta chegava sem
   * nenhum registro do combinado. No fim do vínculo ele simplesmente voltava para
   * casa, e a cláusula que você pagou mais caro para incluir nunca existiu.
   */
  loanBuyOption?: number

  // Escalacao manual (true = titular, false = reserva)
  isStarter?: boolean

  // ── REALISMO estilo FM ──────────────────────────────────────────────────
  /** Nota da ultima partida (6.0-10.0). Alimenta forma/moral/homem do jogo. */
  lastMatchRating?: number
  /** Media de notas na temporada (para o perfil do atleta). */
  avgMatchRating?: number
  /** Moral continua 0-100 que sustenta o rotulo morale. */
  moralePoints?: number
  /** Amarelos acumulados na temporada rumo a suspensao automatica. */
  seasonYellows?: number
  /** Partidas de suspensao pendentes — fica FORA da escalacao ate zerar. */
  suspendedMatches?: number
  /**
   * Personalidade e atributos ocultos (estilo FM): moldam desenvolvimento,
   * consistencia, reacao a moral e negociacao. Gerados uma vez por atleta.
   */
  persona?: PlayerPersona
  /**
   * O QUE EVOLUI do perfil canonico (lib/modelo-de-jogador.ts): familiaridade
   * ganha jogando fora da posicao natural.
   *
   * O resto do perfil — atributos de goleiro, pe fraco, tendencias, os quatro
   * ocultos — NAO fica aqui: e derivado do `id` a cada leitura, como a persona,
   * e por isso nao ocupa um byte do save. Ausente = ninguem ainda jogou fora de
   * posicao, que e o caso da esmagadora maioria dos atletas.
   */
  perfilProgresso?: ProgressoDoPerfil
  /**
   * CARACTERISTICAS marcadas A MAO no editor (lib/caracteristicas-do-atleta.ts).
   *
   * Ausente — o caso da esmagadora maioria — significa "ninguem editou", e NAO
   * "sem caracteristica": `caracteristicasDoAtleta` deriva 0 a 2 do id, da
   * posicao e do perfil de atributos dele, sem gravar nada. Este campo existe so
   * para a escolha manual do editor sobreviver a viagem pool -> motor, senao a
   * ficha do atleta prometeria "Cabeceio" e o motor sortearia outra coisa.
   */
  traits?: string[]

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
// Os 6 atributos coerentes com a posicao, a partir do overall. Fina camada sobre
// lib/player-attributes (o modulo puro e testado). Substitui a geracao antiga em
// que so `shooting` respeitava a posicao.
function atributosPorPosicao(base: number, position: string, seed: string) {
  return attributesFromOverall(base, position, seed)
}

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
  /**
   * Goleadores REAIS da partida (um item por gol), com o time de cada um. O motor
   * passa a gravar isto na simulacao — inclusive nos jogos de CPU — para a tela de
   * estatisticas ler dado persistido em vez de atribuir o gol pelo placar na hora.
   * Opcional: saves antigos e partidas sem geracao caem na atribuicao deterministica.
   */
  scorers?: MatchScorer[]
  /**
   * POR QUE O PLACAR SAIU ASSIM — frases curtas, do desequilíbrio maior para o
   * menor ("Seu meio-campo foi dominado por 9").
   *
   * ⚠️ Existe porque o jogo não conseguia responder isso. O 3D encena um
   * resultado já decidido, então assistir não ensina nada sobre a derrota; e a
   * partida simulada saía do prestígio do escudo, então não HAVIA causa tática
   * para contar. Com o placar ouvindo o elenco (ver `simulateMatchResult`), a
   * conta passou a existir — e esta é ela.
   *
   * Ausente em jogo entre dois clubes da CPU e em jogo equilibrado.
   */
  porQue?: string[]
  /**
   * Placar da DISPUTA DE PÊNALTIS, quando o mata-mata empatou e a disputa foi
   * jogada (lib/match-engine, fase "penaltis"). Os gols da disputa NÃO entram em
   * homeScore/awayScore — a súmula continua 1x1, como na regra.
   *
   * Ausente na esmagadora maioria dos jogos: só existe em confronto decisivo
   * empatado. É o dado que `lib/cup-bracket.resultadoDoConfronto` usa para saber
   * quem se classificou, no lugar do cara-ou-coroa que havia antes.
   */
  homePenalties?: number
  awayPenalties?: number
  /** Estatísticas produzidas pelo motor ao vivo. Ausente em saves antigos e
   * partidas simuladas rapidamente; o Data Hub trata os dois casos. */
  performance?: {
    home: MatchPerformanceStats
    away: MatchPerformanceStats
  }
}

export interface MatchPerformanceStats {
  shots: number
  shotsOnTarget: number
  xG: number
  corners: number
  fouls: number
  yellows: number
  reds: number
  possession: number
  passes: number
  passAccuracy: number
  /** Métricas espaciais produzidas pelo motor 1.0.286. Opcionais em saves antigos. */
  xA?: number
  boxEntries?: number
  highRecoveries?: number
  attacksByChannel?: { left: number; center: number; right: number }
}

export interface MatchScorer {
  teamShort: string
  name: string
  nat?: string
  /** Nome do assistente (mesmo time), quando houve. */
  assist?: string
}

export interface MatchEvent {
  minute: number
  type: "goal" | "assist" | "yellow" | "red" | "sub" | "injury"
  playerId: number
  playerName: string
  assistPlayerId?: number
  assistPlayerName?: string
  /** Só em `red`: natureza da expulsao, para o tribunal julgar (lib/tribunal). */
  motivoExpulsao?: "segundo_amarelo" | "vermelho_direto"
  expulsaoViolenta?: boolean
}

/** Expulsao julgada no pos-jogo (lib/tribunal), pronta para virar noticia. */
export interface VeredictoDaPartida {
  playerId: number
  playerName: string
  julgamento: JulgamentoTribunal
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

  /**
   * Estruturas por fase. `formation` no estado continua sendo a forma usada
   * para escalar o XI; estes campos descrevem a reorganização com e sem bola.
   * São opcionais para manter saves anteriores à 1.0.279 legíveis.
   */
  buildUpFormation?: string
  inPossessionFormation?: string
  outOfPossessionFormation?: string

  /** Organização da última linha ao defender laterais no próprio campo. */
  defensiveThrowInShape?: "zona" | "mista" | "individual"
  
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
  /**
   * Funcao COM A BOLA. Continua chamando-se `role` (e nao `roleComBola`) porque
   * e o campo que todo save existente ja tem gravado — renomear exigiria
   * migracao para nao apagar as instrucoes de quem ja jogava.
   */
  role: PlayerRole
  /**
   * Funcao SEM A BOLA. Ausente = a mesma de cima, que e o comportamento de
   * antes desta versao, numero por numero.
   *
   * Existe porque posicao, funcao e FASE sao tres coisas: o mesmo PD pode ser
   * `ponta_invertido` com a bola e `lateral_defensivo` sem ela, e era isso que o
   * jogo nao sabia representar — ver lib/forcas-individuais.ts.
   */
  roleSemBola?: PlayerRole

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
  /**
   * POR QUE aquele clube esta olhando (1.0.223). Antes a sondagem era um sorteio
   * — clube aleatorio, atleta aleatorio, sem motivo — e por isso nao dizia nada
   * ao tecnico. Agora ela sai da MESMA avaliacao da proposta (lib/mercado-realista),
   * entao consegue explicar o interesse. Opcionais para saves antigos.
   */
  motivo?: string
  /** Papel que o atleta teria no elenco do sondador ("titular", "rotação"...). */
  papel?: string
  /** O sondador tem caixa para transformar isto em proposta? */
  temCaixa?: boolean
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
  /** Opção de compra acertada na mesa do empréstimo (ver `Player.loanBuyOption`). */
  opcaoDeCompra?: number
}

/**
 * SAÍDA JÁ ACERTADA que só se efetiva quando a janela abrir.
 *
 * ⚠️ POR QUE ISTO EXISTE (pedido: "colocar seus jogadores em leilão — caso algum
 * time compre, o dinheiro entra em caixa e o jogador sai na abertura da janela").
 *
 * A chegada de reforço fora da janela já esperava em `pendingIncomingTransfers`
 * desde sempre; a SAÍDA não tinha equivalente — vender fora da janela era
 * simplesmente impossível, ou (pior) instantâneo por outro caminho. O leilão
 * fecha em qualquer semana, então precisa dos dois tempos separados: o dinheiro
 * entra na hora do martelo (é o que o clube comprador paga para garantir o
 * atleta) e o vínculo só termina quando a janela abre.
 */
export interface PendingOutgoingTransfer {
  id: string
  playerId: number
  playerName: string
  /** Clube que levou o atleta. */
  toTeam: string
  fee: number
  agreedWeek: number
  agreedSeason: number
  kind: "venda" | "leilao"
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

/**
 * Quantas semanas faltam para a janela FECHAR. Zero (ou menos) quando ela ja
 * esta fechada. E o relogio do deadline day: a ultima quinzena e onde o mercado
 * enlouquece, e sem esta conta a IA tratava julho e a ultima semana como iguais.
 */
export function weeksUntilWindowCloses(week: number): number {
  const seasonWeek = ((Math.max(1, week) - 1) % 52) + 1
  if (seasonWeek <= 12) return 12 - seasonWeek + 1
  if (seasonWeek >= 27 && seasonWeek <= 36) return 36 - seasonWeek + 1
  return 0
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
  /**
   * Saidas ja acertadas esperando a janela abrir (leilao/venda fora da janela).
   * Opcional: saves anteriores nao tem o campo.
   */
  pendingOutgoingTransfers?: PendingOutgoingTransfer[]
  /** Sondagens: clubes de olho num jogador meu, antes de uma proposta formal. */
  marketInterests: MarketInterest[]
  
  // Taticas
  teamTactics: TeamTactics
  playerInstructions: Record<number, PlayerInstructions>
  tacticalAssignments: TacticalAssignments
  /** Coordenadas personalizadas do campo, por nome do atleta (IDs podem mudar ao importar). */
  tacticalPlayerPositions: Record<string, { x: number; y: number }>
  /**
   * MOVIMENTAÇÃO: para onde o atleta se desloca com a bola, em % do campo.
   * É o DESTINO da seta desenhada na prancheta — a posição base continua em
   * `tacticalPlayerPositions`. Também por nome, pelo mesmo motivo.
   */
  tacticalPlayerMovements: Record<string, { x: number; y: number }>
  opponentAnalyses: OpponentAnalysis[]
  /**
   * PARCELAS DE TRANSFERÊNCIA em aberto, a receber e a pagar.
   *
   * ⚠️ Antes da 1.0.383 toda transferência era à vista: `buyPlayer` fazia
   * `balance - fee` e `sellPlayer` fazia `balance + líquido`, sempre no ato.
   * Um clube pequeno nunca alcançava um reforço caro porque o único caminho era
   * ter o valor cheio no caixa naquela semana. Ver `lib/clausulas-do-negocio.ts`.
   */
  parcelasDeTransferencia: Parcela[]
  /** Direitos de recompra que este clube guarda sobre atletas que vendeu. */
  recompras: Recompra[]
  
  // Moral e vestiario
  squadMorale: SquadMorale
  /** Semana em que cada ação coletiva foi usada. Persistido para impedir reset ao trocar de tela. */
  groupActionCooldowns: Record<string, number>
  /**
   * Entrosamento do XI, 0-100. DERIVADO de `entrosamentoPares` desde a 1.0.223 —
   * continua aqui porque meia dezena de telas e o bonus em campo o leem, mas ja
   * nao e um contador que sobe por botao.
   */
  squadCohesion: number
  /**
   * MINUTOS JOGADOS JUNTOS, dupla a dupla. E daqui que sai o entrosamento: dois
   * atletas que nunca dividiram o gramado nao se entendem, por melhores que
   * sejam. Ver lib/treino-e-entrosamento.ts.
   */
  entrosamentoPares: ParesDeEntrosamento
  /** Ja reconstruiu as duplas a partir do historico do save antigo? (roda uma vez) */
  entrosamentoSemeado?: boolean
  /** Fadiga CRONICA por atleta (0-100) — o cansaco que a semana nao repos. */
  fadigaCronica: Record<number, number>
  /**
   * MINUTOS ACUMULADOS na ultima virada de semana, por atleta.
   *
   * ⚠️ E o que permite saber quanto cada um JOGOU na semana que passou, e nao
   * quanto ele *costuma* jogar. Antes o desgaste usava `isStarter ? 90 : 0`, um
   * atalho com dois defeitos que se somavam e produziam o relato "o jogador nao
   * descansa de uma semana para a outra":
   *
   *   • `isStarter` e um ESTADO ("esta no XI"), nao um evento ("jogou"). Semana
   *     sem partida — data FIFA, intervalo, pre-temporada — cobrava os mesmos 90
   *     minutos de quem passou a semana inteira descansando.
   *   • quem entrou no segundo tempo nao pagava minuto nenhum.
   *
   * Aqui a conta e a diferenca do contador real de minutos (creditado em
   * `registerMatchResult`), entao semana sem jogo custa ZERO e semana de dois
   * jogos custa o dobro. Virada de temporada zera `seasonStats`; o `Math.max(0,
   * ...)` absorve isso sozinho e o retrato e regravado logo em seguida.
   */
  minutosNaViradaDaSemana: Record<number, number>
  /** Plano de treino COLETIVO da semana (intensidade x foco). */
  planoDeTreino: PlanoDeTreino
  /**
   * Como o tecnico usa os dias LIVRES da semana (ver lib/rotina-da-semana.ts).
   * Opcional: save anterior a esta versao cai no equilibrado, que e o
   * comportamento de sempre.
   */
  posturaDaSemana?: Postura
  /** Ultimo resumo do treino semanal, para a tela mostrar carga/fadiga/risco. */
  ultimoTreino: { carga: number; energiaMedia: number; fadigaMedia: number; riscoMedio: number; lesionados: string[]; semana: number } | null
  /** Save ja migrado para o relogio absoluto de contrato (ver migracao). */
  contractsAbsoluteMigrated?: boolean
  
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
  /** Recibos das vendas de jovens ja creditadas (ver receberPorJovem). */
  vendasDeJovensPagas?: string[]
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
  /**
   * Responde a uma proposta recebida.
   *
   * Desde a 1.0.223 aceitar NAO fecha o negocio sozinho: o ATLETA ainda decide.
   * Ele pesa projeto (prestigio do comprador) e minutos (o papel que teria la) —
   * um idolo do seu clube pode simplesmente recusar descer de patamar, como no
   * futebol de verdade. Devolve `ok: false` com o motivo quando isso acontece.
   */
  respondToOffer: (offerId: number, accept: boolean) => { ok: boolean; motivo?: string }
  counterTransferOffer: (offerId: number, amount: number, wageCoverage?: number, loanWeeks?: number) => "accepted" | "revised" | "rejected"
  trainPlayer: (playerId: number, attribute: string) => void
  /** Poe o atleta para aprender uma posicao no CT. `null` encerra o treino. */
  treinarPosicao: (playerId: number, posicao: string | null) => void
  setStarter: (playerId: number, isStarter: boolean) => void
  /**
   * Grava o XI INTEIRO de uma vez.
   *
   * Existe porque as telas de escalacao chamavam `setStarter` um jogador por vez,
   * e cada chamada e um `set` do zustand — ou seja, o elenco passava por estados
   * intermediarios INVALIDOS. Ao promover um reserva, havia um instante com DOZE
   * titulares (o reserva ja dentro, o titular ainda nao removido), e quem lesse o
   * elenco nesse instante mandava a escalacao para `repararEscalacao`, que corta o
   * de menor overall — justamente o reserva recem-promovido. A escolha do tecnico
   * era desfeita e a tela voltava a sincronizar: o "loop" relatado.
   *
   * Com uma escrita so, esse instante deixa de existir.
   */
  setStarters: (starterIds: readonly number[]) => void
  renewContract: (playerId: number, newSalary: number, weeks: number) => void
  /** Migra contratos de saves antigos para o relogio absoluto (roda uma vez). */
  migrarContratosParaSemanaAbsoluta: () => void
  /**
   * Reconstroi a tabela de duplas a partir dos jogos ja disputados (roda uma
   * vez). Sem isto, quem ja tinha o time entrosado veria o numero despencar ao
   * instalar a 1.0.223 — uma punicao por atualizar.
   */
  semearEntrosamentoDoHistorico: () => void
  /**
   * SAIU DO CLUBE (demissao ou pedido de demissao): zera o que era do emprego
   * anterior. Sem isto o tecnico sem clube continuava com o elenco, a tabela e
   * o mercado do clube que acabou de deixar — e a ponte de notificacoes seguia
   * avisando de proposta por atleta que ja nao era dele. Ver `encerrarPassagem`
   * em lib/career-moves.
   */
  limparClubeAtual: () => void
  /** `valor` = o que a compradora ofereceu; sem ele, o valor de mercado cheio. */
  sellPlayer: (playerId: number, valor?: number, termos?: TermosDoNegocio) => void
  /**
   * Exerce um direito de recompra guardado. Devolve o motivo quando não dá.
   *
   * ⚠️ O atleta volta com o contrato do CLUBE, não com o que ele tinha lá fora:
   * recompra é uma transferência nova, não um desfazer.
   */
  exercerRecompra: (recompraId: string) => "ok" | "sem_caixa" | "expirada" | "inexistente"
  /** Aposenta um veterano sem multa nem receita e o remove da folha. */
  retirePlayer: (playerId: number) => boolean
  /**
   * Sobe um garoto da base ao elenco profissional. NAO passa por buyPlayer de
   * proposito: promocao da base nao e transferencia e nao depende de janela.
   * Devolve false quando falta caixa.
   */
  promoverDaBase: (jovem: {
    name: string; position: string; age: number; overall: number; potential: number; nationality?: string
    pace?: number; shooting?: number; passing?: number; dribbling?: number; defending?: number; physical?: number
  }, taxa: number, divisao?: string) => boolean
  /** Entrada de caixa da venda de um atleta da base. */
  receberPorJovem: (valor: number, vendaId?: string) => void
  ajustarMoralJogador: (playerId: number, degraus: number) => void
  /**
   * PRELEÇÃO (`lib/prelecao.ts`): aplica os pontos de moral que a conversa com o
   * elenco rendeu, atleta por atleta.
   *
   * ⚠️ Separada de `ajustarMoralJogador` de propósito: aquela move DEGRAUS do
   * rótulo (a escala grossa da conversa com o reserva), esta move a moral
   * CONTÍNUA `moralePoints`, que é a que chega ao campo por `userForces` na
   * partida ao vivo. Mexer no rótulo aqui perderia a resolução fina: a preleção
   * rende de 1 a 8 pontos, e um degrau inteiro do rótulo vale ~20.
   */
  aplicarPrelecao: (deltas: readonly { id: number; delta: number }[]) => void
  /**
   * APRENDER A POSICAO JOGANDO NELA (1.0.293).
   *
   * A improvisacao custava o mesmo no primeiro e no trigesimo jogo: nao havia
   * como um lateral virar zagueiro razoavel a forca de ser escalado ali. Cada
   * partida credita familiaridade no slot em que o atleta atuou.
   */
  registrarPosicoesJogadas: (minutos: Array<{ id: number; posicao: string; minutos: number; funcao?: string; funcaoSemBola?: string }>) => void
  /** Verba liberada pela diretoria num pedido aprovado (ver Central de Gestão). */
  liberarVerbaDaDiretoria: (valor: number, destino: "transferencias" | "caixa") => void
  /** "wage_budget" = recusado pela diretoria por estourar o teto salarial. */
  /**
   * `janelaAberta` vem de FORA de proposito. O motor conhece `currentWeek`, que
   * conta 0..51 dentro da temporada corrente, enquanto a temporada de verdade
   * nao tem 52 semanas — ela termina na ultima rodada do calendario. As duas
   * contas divergiam mais a cada temporada, e era por isso que contratar com a
   * janela aberta ainda deixava o reforco esperando. Quem chama sabe a semana
   * da TEMPORADA; o motor, nao.
   *
   * ⚠️ `currentWeek` NAO e um contador absoluto — `processSeasonEnd` zera ele
   * todo ano. Para qualquer data que precise sobreviver a virada de temporada
   * (fim de contrato, fim de emprestimo) use `absoluteWeek(season, week)`.
   * Esta descricao dizia o contrario e foi a origem de quatro gravadores que
   * faziam o atleta sair de graca (corrigido na v5 do save).
   */
  /**
   * `termos` ausente = à vista, exatamente como antes da 1.0.383. Toda chamada
   * antiga continua valendo sem mudar uma linha.
   */
  buyPlayer: (player: Player, fee: number, isFreeAgent?: boolean, janelaAberta?: boolean, termos?: TermosDoNegocio) => "joined" | "pending" | "failed" | "wage_budget" | "desafio"
  /**
   * Desiste de um reforco que ainda espera a janela e DEVOLVE o dinheiro.
   *
   * O valor sai do caixa na hora do acordo, mas nao havia como desfazer: o
   * atleta ficava presos na fila e o dinheiro, gasto. Devolve a taxa paga e
   * tira o salario dele da folha.
   */
  cancelarChegadaPendente: (id: string) => boolean
  payClubDebt: (amount: number) => number
  spendClubFunds: (amount: number) => boolean
  addClubRevenue: (amount: number) => void
  /** Debita do caixa. Contrapartida de `addClubRevenue` (que só soma). */
  addClubExpense: (amount: number) => void
  /**
   * `fee` = taxa paga ao clube dono pelo período (0 = empréstimo gratuito).
   * Sem ela a taxa negociada era apenas um número na tela: o empréstimo não
   * tirava um centavo do caixa, por mais caro que fosse o acordo.
   */
  loanPlayer: (player: Player, weeks: number, salary: number, fee?: number, janelaAberta?: boolean, opcaoDeCompra?: number) => "joined" | "pending" | "failed" | "no_cash" | "desafio"
  /**
   * EXERCE A OPÇÃO DE COMPRA de um atleta que chegou por empréstimo.
   *
   * É o que o futebol faz de verdade no fim do vínculo: o clube que emprestou
   * paga o valor combinado na mesa e o passe passa a ser dele. Só existe para
   * quem tem `loanBuyOption` — a cláusula precisa ter sido negociada.
   *
   * "no_cash" quando falta caixa, "no_window" quando a janela está fechada
   * (comprar É transferência, e transferência respeita a janela), "failed"
   * quando o atleta não é emprestado ou não tem opção.
   */
  exercerOpcaoDeCompra: (playerId: number, janelaAberta?: boolean) => "comprado" | "no_cash" | "no_window" | "failed"
  /**
   * Fecha a SAÍDA de um atleta seu (leilão vencido por um clube da IA).
   *
   * O dinheiro entra na hora; o atleta só deixa o elenco quando a janela abrir —
   * até lá ele segue treinando e jogando por você, como no futebol real. Com a
   * janela ABERTA sai na hora. Ver `PendingOutgoingTransfer`.
   */
  registrarSaidaAcertada: (
    playerId: number, valor: number, clubeComprador: string, janelaAberta: boolean, origem?: "venda" | "leilao",
  ) => "saiu" | "pendente" | "failed"
  hireScout: (scout: Scout) => void
  startScoutSearch: (scoutId: number, region: string, weeksToComplete?: number, searchCost?: number, criteria?: ScoutCriteria | null) => void
  stopScoutSearch: (scoutId: number) => void
  /** Demite o olheiro e devolve o custo da rescisão cobrado do caixa. */
  fireScout: (scoutId: number) => number
  simulateOtherMatches: () => void
  drawCopaBracket: () => void
  updateStandings: (result: MatchResult) => void
  addMatchResultOnly: (result: MatchResult) => void
  callUpPlayer: (playerId: number, call: NationalTeamCall) => void
  returnFromNationalTeam: (playerId: number) => void
  getPlayerById: (playerId: number) => Player | undefined
  updatePlayerStats: (playerId: number, stats: Partial<PlayerStats>) => void
  /**
   * Devolve os julgamentos do tribunal desta partida, para a tela noticiar. Era
   * `void`; quem nao usa o retorno segue funcionando igual.
   */
  processarDesempenhoPartida: (golsPro: number, golsContra: number, events: MatchEvent[]) => VeredictoDaPartida[]
  /**
   * Ajusta o entrosamento (squadCohesion, 0-100) diretamente.
   *
   * @deprecated Desde a 1.0.223 o entrosamento vem de MINUTOS JOGADOS JUNTOS —
   * prefira `registrarMinutosJuntos`, que alimenta a conta de verdade em vez de
   * empurrar o numero. Este metodo sobreviveu para eventos avulsos (excursao,
   * confraternizacao) e para saves antigos.
   */
  adjustSquadCohesion: (delta: number) => void
  /**
   * Credita minutos em campo juntos as duplas informadas e recalcula o
   * entrosamento do XI. E por aqui que partida, amistoso e treino coletivo
   * alimentam o MESMO numero. Sem `ids`, usa os titulares atuais.
   */
  registrarMinutosJuntos: (minutos: number, ids?: number[]) => void
  /** Define o plano de treino coletivo da semana. */
  /** Como usar os dias LIVRES da semana (ver lib/rotina-da-semana.ts). */
  definirPosturaDaSemana: (postura: Postura) => void
  definirPlanoDeTreino: (plano: Partial<PlanoDeTreino>) => void
  rolarLesaoSimulada: (qtdJogos: number) => void
  acumularEstatisticasSimuladas: (golsPro: number, golsContra: number) => void
  cumprirSuspensao: (playerId: number) => void
  setPlayerShirtNumber: (playerId: number, shirtNumber: number) => boolean
  injurePlayer: (playerId: number, injury: PlayerInjury) => void
  tratarLesao: (playerId: number, tratamento: TratamentoMedico) => ResultadoDoTratamento
  healPlayer: (playerId: number) => void
  initializeGame: (teamShort: string, teamFileKey?: string) => void
  updateHeadToHead: (result: MatchResult) => void
  getHeadToHead: (team1: string, team2: string) => HeadToHead | null
  checkContractBonuses: (playerId: number) => void
  
  // Taticas
  setFormation: (formation: string) => void
  setTeamTactics: (tactics: Partial<TeamTactics>) => void
  setPlayerInstructions: (playerId: number, instructions: Partial<PlayerInstructions>) => void
  setTacticalAssignments: (assignments: Partial<TacticalAssignments>) => void
  setTacticalPlayerPositions: (positions: Record<string, { x: number; y: number }>) => void
  /** Setas de movimentação (destino por nome). Traduzidas para as instruções do motor. */
  setTacticalPlayerMovements: (movements: Record<string, { x: number; y: number }>) => void
  analyzeOpponent: (teamShort: string) => void
  updateOpponentAnalysis: () => void
  
  // Moral
  addMoraleEvent: (event: Omit<MoraleEvent, "week">) => void
  performGroupAction: (action: { id: string; cooldown: number; impact: number; description: string }) => boolean
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
  /** Renova por três temporadas; assédio alto encarece luvas e salário. */
  renewStaffContract: (staffId: number) => boolean
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
  /**
   * Libera quem teve o contrato vencido: sai de graça, sem receber nada, e a
   * folha alivia. Devolve os NOMES de quem saiu, para a notificação dizer quem
   * foi perdido — o aviso genérico não ensinava nada.
   */
  releaseExpiredPlayers: (playerIds: readonly number[]) => string[]

  /** Muda a POSIÇÃO do atleta (ATA→MEI etc.) — pedido do modal de gerenciamento. */
  setPlayerPosition: (playerId: number, position: string) => void

  /** Clube do usuário — impede a IA de ofertar por atleta do próprio elenco. */
  myTeamShort: string
  /** Atletas listados para EMPRÉSTIMO: a IA passa a fazer ofertas de empréstimo. */
  loanListedIds: number[]
  toggleLoanListed: (playerId: number) => void
  /** Devolve AGORA o atleta emprestado ao clube de origem. */
  devolverEmprestimo: (playerId: number) => boolean
  /** Estende o emprestimo por mais N semanas (acordo ja fechado com o dono). */
  renovarEmprestimo: (playerId: number, semanas: number, salarioSemanal?: number) => boolean

  // Processar fim de temporada (envelhecimento, aposentadoria, jovens da base)
  /**
   * Fim de temporada. `prestigio` traz os mapas ANTES e DEPOIS da virada — os
   * dois, porque o preco do atleta e ajustado pela MUDANCA de nivel e nao pelo
   * nivel absoluto (senao a estrela encareceria de novo a cada temporada).
   */
  processSeasonEnd: (nextSeason: number, newStandings: StandingsEntry[], lastSeasonStandings: StandingsEntry[], prestigio?: { antes?: PrestigioDosAtletas; depois?: PrestigioDosAtletas }) => void
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

/**
 * FOLHA SALARIAL REAL — somada do elenco, nunca acumulada.
 *
 * `weeklyExpenses` era um total mantido a mao, somado na contratacao e subtraido
 * na venda em uma duzia de lugares. Bastava um caminho esquecer de subtrair (a
 * reposicao de fim de temporada, por exemplo, adicionava atletas sem somar
 * salario) para o numero descolar do elenco de vez — e ele so descola para cima.
 *
 * Derivar da lista nao pode divergir: se o atleta esta no elenco, o salario dele
 * conta; se saiu, nao conta. Sem estado para sincronizar.
 */
export function folhaSemanal(jogadores: readonly { contract?: { salary?: number } | null }[]): number {
  return jogadores.reduce((total, j) => total + (j.contract?.salary ?? 0), 0)
}

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
      pendingOutgoingTransfers: [],

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
        buildUpFormation: "4-3-3",
        inPossessionFormation: "4-3-3",
        outOfPossessionFormation: "4-4-2",
        defensiveThrowInShape: "mista",
        cornersAggressive: false,
        freekickSpecialist: null,
        penaltyTaker: 10, // Sasha
      },
      playerInstructions: {},
      tacticalAssignments: { corner: "", freeKick: "", freeKickLeft: "", freeKickRight: "", penalty: "", captain: "", playerRoles: {} },
      tacticalPlayerPositions: {},
      tacticalPlayerMovements: {},
      opponentAnalyses: [],
      parcelasDeTransferencia: [],
      recompras: [],
      
      // Moral
      squadCohesion: PISO_ENTROSAMENTO,
      entrosamentoPares: {},
      fadigaCronica: {},
      minutosNaViradaDaSemana: {},
      planoDeTreino: { ...PLANO_PADRAO },
      posturaDaSemana: "equilibrado",
      ultimoTreino: null,
      squadMorale: {
        overall: 70,
        unity: 75,
        confidence: 70,
        recentEvents: []
      },
      groupActionCooldowns: {},
      
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
        const expiredDepartures: Array<{
          player: Player
          origin: string
          destination: string
        }> = []
        /**
         * MOVIMENTACOES A REGISTRAR DEPOIS DO `set`.
         *
         * `registrarMovimentacao` grava no disco (commitGameState). Chamar isso de
         * DENTRO do updater do zustand seria efeito colateral em reducer: o
         * updater pode ser reexecutado, e a mesma saida entraria duas vezes no
         * extrato. Mesmo padrao de `expiredDepartures`, logo acima.
         */
        const movimentacoesDaSemana: Array<Parameters<typeof registrarMovimentacao>[0]> = []

        // CENTRAL DE GESTÃO NO TREINO. As unidades (goleiros/defesa/ataque) e os
        // grupos de mentoria ficavam gravados no save e o treino semanal nunca os
        // consultava. A leitura sai daqui, e não de dentro do `set`, pela mesma
        // razão do bloco acima: o updater pode ser reexecutado. Save ainda não
        // hidratado devolve o estado vazio e o treino se comporta como antes.
        const gestaoDoSave = normalizarGestao282(loadGameState().gestao282)

        /**
         * CLÁUSULAS DO NEGÓCIO: as parcelas que vencem nesta virada.
         *
         * ⚠️ Calculado FORA do `set` pela mesma razão dos blocos acima — o
         * updater do zustand pode ser reexecutado, e uma parcela liquidada duas
         * vezes é dinheiro criado do nada. O que entra no `set` é um número já
         * fechado e a lista do que sobrou.
         *
         * ⚠️ E é UM saldo, não duas operações: aplicar entrada e saída em passos
         * separados abriria um instante em que o caixa fica negativo e a régua
         * de inadimplência (`lib/debt-engine.ts`) dispararia sem motivo.
         *
         * A semana absoluta é a da virada — `newWeek` —, senão a parcela do
         * aniversário do negócio ficaria uma semana presa.
         */
        const semanaDaVirada = absoluteWeek(state.currentSeason, newWeek)
        const parcelasEmAberto = state.parcelasDeTransferencia ?? []
        const vencidas = parcelasVencidas(parcelasEmAberto, semanaDaVirada)
        const saldoDeParcelas = saldoDasParcelas(vencidas)
        const parcelasQueSobram = parcelasRestantes(parcelasEmAberto, semanaDaVirada)
        for (const p of vencidas) {
          movimentacoesDaSemana.push({
            playerName: p.atleta,
            type: p.tipo === "receber" ? "sell" : "buy",
            value: p.valor,
            fromTeam: p.tipo === "receber" ? p.clube : "",
            toTeam: p.tipo === "receber" ? "" : (state.myTeamShort ?? ""),
            season: state.currentSeason,
            week: newWeek,
            detalhe: `Parcela de transferência ${p.tipo === "receber" ? "recebida" : "paga"}`,
          })
        }

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

          // ── SEMANA DE TREINO (1.0.223) ───────────────────────────────────────
          //
          // A energia ja nao sobe +10 para todo mundo. O plano coletivo produz uma
          // CARGA; a carga mais os minutos jogados produzem DESGASTE; o que a
          // recuperacao (idade, folego, Centro Medico, foco regenerativo) nao
          // repoe vira FADIGA CRONICA; e a fadiga realimenta o RISCO DE LESAO.
          // Ver lib/treino-e-entrosamento.ts.
          //
          // `minutosJogados` sao os minutos REAIS da semana que passou: a
          // diferenca do contador acumulado desde a ultima virada. Ver
          // `minutosNaViradaDaSemana` — semana sem partida custa ZERO, que e o
          // que devolve o descanso ao jogo.
          const plano = s.planoDeTreino ?? PLANO_PADRAO
          const fadigaAnterior = s.fadigaCronica ?? {}
          const minutosAntes = s.minutosNaViradaDaSemana ?? {}
          const minutosDaSemana = new Map<number, number>()
          for (const p of s.squadPlayers) {
            const acumulado = p.seasonStats?.minutesPlayed ?? 0
            // ⚠️ SEM RETRATO ANTERIOR, NAO SE COBRA NADA. Duas situacoes caem
            // aqui, e nas duas o `?? 0` seria destrutivo:
            //
            //  • SAVE ANTERIOR A ESTA VERSAO: o campo inteiro nao existe. Tratar
            //    ausencia como zero faria a primeira virada cobrar os minutos da
            //    TEMPORADA INTEIRA de uma vez — 900 minutos viram 144 de
            //    desgaste e zeram a energia de todo o elenco. Seria uma punicao
            //    por atualizar o jogo.
            //  • ATLETA QUE ACABOU DE CHEGAR: ainda nao entrou em nenhum
            //    retrato.
            //
            // Cobrar zero na primeira virada e exato: nao ha semana anterior
            // medida. Da segunda em diante a conta e a diferenca real.
            // Virada de temporada zera o acumulado; o clamp evita minuto negativo.
            const anterior = minutosAntes[p.id] ?? acumulado
            minutosDaSemana.set(p.id, Math.max(0, acumulado - anterior))
          }
          const entrada: AtletaNaSemana[] = s.squadPlayers.map(p => ({
            id: p.id,
            idade: p.age,
            energia: p.energy ?? 100,
            fadigaCronica: fadigaAnterior[p.id] ?? 0,
            minutosJogados: minutosDaSemana.get(p.id) ?? 0,
            resistencia: p.physical ?? 70,
            lesionado: Boolean(p.injury),
            // O treino de POSICAO ocupa o mesmo slot e cobra a mesma energia —
            // senao adaptar o elenco inteiro sairia de graca.
            emTreinoIndividual: Boolean(p.training.currentFocus || p.training.positionFocus),
            focoIndividual: p.training.currentFocus ?? null,
          }))
          // ── A SEMANA TEM DIAS (ver lib/rotina-da-semana.ts) ─────────────
          //
          // Quantos jogos o clube tem nesta semana decide quantos dias sobram, e
          // a POSTURA do tecnico decide o que fazer com eles. Treinar mais rende
          // mais e cansa mais; poupar devolve energia e custa evolucao. Antes o
          // plano era aplicado de bloco e descansar so acontecia por acidente,
          // numa semana sem partida.
          const jogosNaSemana = s.matchResults.filter(r =>
            r.season === s.currentSeason && r.week === newWeek &&
            (r.homeTeam === s.myTeamShort || r.awayTeam === s.myTeamShort),
          ).length
          const rotina = montarRotina(jogosNaSemana, s.posturaDaSemana ?? "equilibrado")

          const resumoTreino = aplicarSemanaDeTreino(entrada, plano, {
            centroDeTreinamento: trainingLvl,
            centroMedico: medicalLvl,
            treinador: efeitosDoTreinador(),
          }, rotina.fatorDeCarga, rotina.recuperacaoExtra)
          const efeitoPorId = new Map(resumoTreino.efeitos.map(e => [e.id, e]))
          const lesionadosNoTreino: string[] = []

          // O save é a fonte única das unidades e mentorias — espelhar no motor
          // criaria o segundo cofre de sempre. `gestaoDoSave` é lido acima.
          const idsNoElenco = new Set(s.squadPlayers.map(p => p.id))

          const updatedPlayers = s.squadPlayers.map(player => {
            const efeito = efeitoPorId.get(player.id)
            if (player.injury) {
              const weeksRemaining = player.injury.weeksRemaining - recoveryPerWeek
              if (weeksRemaining <= 0) {
                return { ...player, injury: null, energy: 70 }
              }
              return { ...player, injury: { ...player.injury, weeksRemaining } }
            }

            // LESAO DE TREINO: carga alta num elenco cansado quebra gente. Este
            // era o elo que faltava para a intensidade ter consequencia.
            if (efeito && Math.random() < efeito.risco) {
              const grave = Math.random()
              const sev: PlayerInjury["severity"] = grave < 0.62 ? "leve" : grave < 0.92 ? "media" : "grave"
              const semanas = sev === "leve" ? 1 + Math.floor(Math.random() * 2)
                : sev === "media" ? 3 + Math.floor(Math.random() * 3) : 5 + Math.floor(Math.random() * 6)
              lesionadosNoTreino.push(player.name)
              return {
                ...player,
                energy: Math.round(efeito.energia),
                training: { ...player.training, currentFocus: null, weeksTrained: 0 },
                injury: {
                  type: INJURY_TYPES[Math.floor(Math.random() * INJURY_TYPES.length)],
                  severity: sev, weeksRemaining: semanas, startWeek: newWeek,
                },
              }
            }

            const newEnergy = Math.round(efeito?.energia ?? Math.min(100, player.energy + 10))

            /**
             * TREINO DE POSICAO — a semana no CT vale menos que a partida.
             *
             * 70 minutos equivalentes contra os 90 de um jogo inteiro, de
             * proposito: o gramado continua sendo o melhor professor, e
             * escalar o atleta fora de posicao segue valendo a pena para quem
             * tem pressa. O que muda e que agora existe o caminho lento e sem
             * risco — que e o que um clube de verdade faz na pre-temporada.
             *
             * Quando a familiaridade satura, a posicao entra nas SECUNDARIAS e
             * o treino se encerra sozinho: sem isso o slot ficaria ocupado para
             * sempre num atleta que ja aprendeu tudo o que podia.
             */
            if (player.training.positionFocus) {
              const alvo = player.training.positionFocus
              const perfilDoAluno = perfilDoAtleta(player.id, player.position, player.overall, player.secondaryPositions ?? [])
              const rendimento = efeito?.rendimentoIndividual ?? 1
              const progresso = aprenderPosicao(
                perfilDoAluno, player.perfilProgresso, alvo, 70 * rendimento,
              )
              const aprendeuTudo = progresso === player.perfilProgresso
              const jaSecundaria = (player.secondaryPositions ?? []).some(p => normalizePosition(p) === alvo)
              return {
                ...player,
                energy: newEnergy,
                perfilProgresso: progresso,
                // `aprenderPosicao` devolve o MESMO objeto quando bateu no teto —
                // e a deixa de que nao ha mais o que ensinar.
                ...(aprendeuTudo ? {
                  training: { ...player.training, positionFocus: null, weeksTrained: 0 },
                  secondaryPositions: jaSecundaria
                    ? player.secondaryPositions
                    : [...(player.secondaryPositions ?? []), alvo],
                } : {
                  training: { ...player.training, weeksTrained: player.training.weeksTrained + 1 },
                }),
              }
            }

            // Processar treinamento (lastTrainingWeek check removed — would never match since currentWeek already advanced)
            if (player.training.currentFocus) {
              const weeksTrained = player.training.weeksTrained + 1
              
              // A cada 4 semanas, chance de melhoria
              if (weeksTrained >= 4) {
                const attribute = player.training.currentFocus as keyof Player
                const currentValue = player[attribute] as number

                // O TETO e o OVERALL (nao cada atributo): um atacante pode ter
                // finalizacao acima do overall. Se ja atingiu o potencial, para.
                if (player.overall >= player.potential) {
                  return { ...player, energy: newEnergy, training: { ...player.training, weeksTrained: 0 } }
                }

                // Jovem evolui mais rapido; veterano mais devagar. Antes o treino
                // semanal IGNORAVA a idade (so o fim de temporada diferenciava).
                const fatorIdade = player.age <= 20 ? 1.5 : player.age <= 24 ? 1.15 : player.age <= 29 ? 0.9 : 0.55
                // O TREINO COLETIVO manda no individual: intensidade alta ensina
                // mais, elenco esgotado nao aprende nada, e treinar o atributo que
                // o time inteiro esta treinando rende mais. Sem isto, a intensidade
                // so tinha custo (fadiga) e nenhum beneficio — ninguem escolheria
                // "alta" nunca.
                const rendimento = efeito?.rendimentoIndividual ?? 1
                // Unidade coerente com o atributo treinado rende mais; o jovem
                // orientado por um veterano do elenco rende mais ainda.
                const rendimentoUnidade = rendimentoUnidade282(
                  gestaoDoSave.unidadesTreino[player.id],
                  player.training.currentFocus,
                )
                const rendimentoMentoria = bonusMentoria282(gestaoDoSave, player.id, idsNoElenco)
                const chance = Math.min(
                  0.95,
                  trainImproveChance * fatorIdade * rendimento * rendimentoUnidade * rendimentoMentoria,
                )
                const ganho = Math.random() < chance ? (player.age <= 20 && Math.random() < 0.3 ? 2 : 1) : 0
                if (ganho === 0) {
                  return { ...player, energy: newEnergy, training: { ...player.training, weeksTrained: 0 } }
                }

                const atualizado = { ...player, [attribute]: Math.min(99, currentValue + ganho) }
                // RECALCULA o overall a partir dos atributos. Antes treinar 20
                // semanas subia o atributo mas NUNCA o overall — o craque so
                // crescia na virada de temporada. Treino nunca REDUZ o overall,
                // e nunca passa do potencial.
                const novoOverall = overallFromAttributes({
                  pace: atualizado.pace, shooting: atualizado.shooting, passing: atualizado.passing,
                  dribbling: atualizado.dribbling, defending: atualizado.defending, physical: atualizado.physical,
                }, player.position)
                return {
                  ...atualizado,
                  overall: Math.min(player.potential, Math.max(player.overall, novoOverall)),
                  energy: newEnergy,
                  training: { ...player.training, weeksTrained: 0 },
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

          // DINAMICA DO ELENCO: o papel esperado agora tem consequencia. Um
          // jogador-chave ignorado por varias partidas perde moral aos poucos;
          // quem volta a receber minutos recupera confiança. Lesionados,
          // convocados e semanas sem jogo nunca são punidos.
          const dinamica = analyseSquadDynamics(updatedPlayers)
          const dinamicaPorId = new Map(dinamica.players.map(item => [item.playerId, item]))
          for (let index = 0; index < updatedPlayers.length; index++) {
            const player = updatedPlayers[index]
            const perfil = dinamicaPorId.get(player.id)
            if (!perfil) continue
            updatedPlayers[index] = applyWeeklyPlayingTimeMorale(
              player,
              perfil,
              minutosDaSemana.get(player.id) ?? 0,
              jogosNaSemana,
              efeitosDoTreinador().moralSemanal,
            )
          }
          
          // Fim de temporada e gerenciado por processSeasonEnd() chamado via use-game-manager
          const newSeason = s.currentSeason
          const finalWeek = newWeek
          const seasonPlayers = updatedPlayers
          const lastStandings = s.lastSeasonStandings
          
          // Processar convocacoes de selecao
          const isFifaDate = s.fifaDates.includes(newWeek)
          
          // Atualizar financas
          //
          // CUSTO OPERACIONAL: a despesa que nao encolhe junto com o elenco.
          // Ate a 1.0.264 a unica saida recorrente era a folha — entao um tecnico
          // que parava de agir via o elenco cair ao piso, a folha despencar e o
          // caixa crescer para sempre (medido: City x4,2 e ABC x9,3 em 10
          // temporadas passivas). Estadio, base, viagem e comissao administrativa
          // custam igual com 30 ou com 18 atletas; e isso que esta linha cobra.
          // Derivado da RECEITA JA CALCULADA, e nao da divisao do cadastro. O
          // `weeklyIncome` ja e mantido pela divisao EFETIVA (1.0.260); ler a
          // divisao estatica aqui repetiria o defeito que aquela versao corrigiu
          // — o ABC tem `serie_c` gravado e joga a `serie_d`, e cobrar custo de
          // Serie C sobre receita de Serie D quebrava o clube em duas temporadas.
          const custoOperacional = Math.round(Math.max(0, s.weeklyIncome) * FRACAO_DO_CUSTO_OPERACIONAL)
          const weeklyBalance = s.weeklyIncome - s.weeklyExpenses - custoOperacional
          
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
              // Semana ABSOLUTA nos dois campos: `newWeek` zera a cada temporada,
              // entao um emprestimo fechado na semana 40 gravava fim na 66 — que
              // o contador da temporada nunca alcanca. O vinculo nao terminava
              // nunca, e o contract.endDate relativo ainda fazia o atleta ser
              // expulso como "contrato vencido" nas temporadas seguintes.
              loanEndWeek: item.kind === "emprestimo" ? absoluteWeek(s.currentSeason, newWeek) + (item.loanWeeks ?? 26) : undefined,
              contract: item.kind === "emprestimo"
                ? { salary: item.salary ?? 0, endDate: absoluteWeek(s.currentSeason, newWeek) + (item.loanWeeks ?? 26), releaseClause: null, signedWeek: item.agreedWeek, signedSeason: item.agreedSeason }
                : item.player.contract ? { ...item.player.contract, signedWeek: item.agreedWeek, signedSeason: item.agreedSeason } : null,
              isStarter: false,
              seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
            }))
          if (arrivedPlayers.length) updatedPlayers.push(...arrivedPlayers)

          // ---- SAIDA JA ACERTADA: o atleta sai QUANDO A JANELA ABRE ----
          //
          // Contrapartida da fila de chegada. O leilao de venda fecha em qualquer
          // semana e o dinheiro entra na hora do martelo, mas o vinculo so termina
          // na janela — e o futebol de verdade (e o pedido: "o dinheiro entra em
          // caixa e o jogador sai na abertura da janela"). Ate la ele continua
          // treinando, jogando e na folha.
          // A FOLHA se acerta sozinha: `ajusteDaFolhaSemanal` (mais abaixo) compara
          // a folha do elenco DEPOIS com a de ANTES, então tirar o atleta daqui já
          // devolve o salário dele. Subtrair também aqui cobraria duas vezes.
          const saidasAgora = canRegisterTransfers ? (s.pendingOutgoingTransfers ?? []) : []
          if (saidasAgora.length > 0) {
            const idsQueSaem = new Set(saidasAgora.map(t => t.playerId))
            const nomesQueSaem = new Set(saidasAgora.map(t => t.playerName.trim().toLocaleLowerCase("pt-BR")))
            for (let i = updatedPlayers.length - 1; i >= 0; i--) {
              const p = updatedPlayers[i]
              // Casa por ID e, como reserva, por NOME: a fila de chegada
              // reatribui ids, e um atleta vendido logo apos chegar por essa fila
              // teria id novo. Perder a saida deixaria o clube com o dinheiro E
              // com o jogador.
              if (idsQueSaem.has(p.id) || nomesQueSaem.has(p.name.trim().toLocaleLowerCase("pt-BR"))) {
                updatedPlayers.splice(i, 1)
              }
            }
          }

          // ---- EMPRESTIMO QUE VENCEU: o atleta VOLTA para casa ----
          //
          // `loanEndWeek` era gravado na chegada e nunca mais consultado: quem
          // vinha por emprestimo ficava no elenco para sempre, de graca. Agora a
          // data vale — sem renovacao (ver lib/emprestimos.ts), ele sai.
          const emprestimosVencidos = updatedPlayers.filter(
            p => p.isLoanedIn && p.loanEndWeek != null && p.loanEndWeek <= absoluteWeek(s.currentSeason, newWeek),
          )
          if (emprestimosVencidos.length > 0) {
            const idsQueVoltaram = new Set(emprestimosVencidos.map(p => p.id))
            for (let i = updatedPlayers.length - 1; i >= 0; i--) {
              if (idsQueVoltaram.has(updatedPlayers[i].id)) updatedPlayers.splice(i, 1)
            }
            // O fim do vinculo entra no extrato — inclusive quando havia uma opcao
            // de compra que o tecnico deixou passar, que e informacao de verdade
            // ("por que o atleta sumiu do meu elenco?").
            for (const p of emprestimosVencidos) {
              movimentacoesDaSemana.push({
                playerName: p.name,
                type: "loan_return",
                value: 0,
                fromTeam: s.myTeamShort ?? "",
                toTeam: p.parentClub ?? "clube de origem",
                season: s.currentSeason,
                week: newWeek,
                detalhe: (p.loanBuyOption ?? 0) > 0
                  ? "Empréstimo encerrado — a opção de compra não foi exercida"
                  : "Empréstimo encerrado",
              })
            }
          }

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

          // ---- CONTRATOS: saída real ao término do vínculo ----
          // Antes a interface avisava que o contrato estava vencendo, mas o
          // jogador continuava para sempre no elenco se o técnico esquecesse de
          // renovar. A partir da primeira semana após o fim:
          //   • a opção automática, quando contratada, prorroga o vínculo;
          //   • a DIRETORIA renova quem ainda interessa (ver lib/diretoria.ts);
          //   • sem nada disso, o atleta sai sem taxa e assina por outro clube.
          const absoluteNow = absoluteWeek(s.currentSeason, newWeek)

          // ---- A DIRETORIA AGE ANTES DA PORTA SE FECHAR ----
          //
          // Sem isto, um técnico que não renova perde 100% do elenco em 6
          // temporadas (medido: overall médio 74 -> 42). A diretoria segura quem
          // está da mediana do elenco para cima e as promessas até 23 anos; o
          // resto sai como sempre saiu.
          const renovacoesDaDiretoria = decidirRenovacoes(
            playersAfterNT
              .filter(p => p.contract && !p.isLoanedIn)
              .map(p => ({
                id: p.id,
                name: p.name,
                overall: p.overall,
                age: p.age,
                salarioSemanal: p.contract?.salary ?? 0,
                fimDoContrato: p.contract?.endDate ?? Infinity,
                listadoParaSair: (s.transferListedIds ?? []).includes(p.id),
              })),
            {
              agora: absoluteNow,
              caixa: s.balance,
              folhaAtual: folhaSemanal(playersAfterNT),
              tetoDeFolha: Math.max(0, s.weeklyIncome) * 1.6,
            },
          )
          if (renovacoesDaDiretoria.length > 0) {
            const porId = new Map(renovacoesDaDiretoria.map(r => [r.id, r]))
            playersAfterNT = playersAfterNT.map(p => {
              const r = porId.get(p.id)
              if (!r || !p.contract) return p
              return {
                ...p,
                contract: { ...p.contract, endDate: r.novoFim, salary: r.novoSalario, signedWeek: newWeek, signedSeason: s.currentSeason },
              }
            })
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("ultrafoot:renovacoes-da-diretoria", {
                detail: renovacoesDaDiretoria.map(r => ({ nome: r.name, motivo: r.motivo, salario: r.novoSalario })),
              }))
            }
          }

          const renewedPlayers = playersAfterNT.map(player => {
            const contract = player.contract
            if (!contract || contract.endDate > absoluteNow || !contract.autoRenewalOption) return player
            const extension = Math.max(26, contract.autoRenewalWeeks ?? 52)
            return {
              ...player,
              contract: {
                ...contract,
                endDate: absoluteNow + extension,
                signedWeek: newWeek,
                signedSeason: s.currentSeason,
              },
            }
          })

          const originTeam = getTeamByShort(s.myTeamShort)
          const originName = originTeam?.nome ?? s.myTeamShort ?? "Clube anterior"

          playersAfterNT = renewedPlayers.filter(player => {
            if (!player.contract || player.contract.endDate > absoluteNow) return true
            const destinationCandidates = allTeams
              .filter(team => team.curto !== s.myTeamShort)
              .filter(team => Math.abs((team.prestigio ?? 50) - Math.max(35, Math.min(95, player.overall))) <= 30)
            const candidates = destinationCandidates.length
              ? destinationCandidates
              : allTeams.filter(team => team.curto !== s.myTeamShort)
            const seed = Math.abs(
              [...`${player.name}:${s.currentSeason}:${newWeek}`]
                .reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261),
            )
            const destination = candidates[seed % Math.max(1, candidates.length)]
            if (destination) {
              expiredDepartures.push({
                player,
                origin: originName,
                destination: destination.nome,
              })
            }
            return false
          })

          // ---- PISO DE ELENCO NO MEIO DA TEMPORADA ----
          //
          // A rede de seguranca so existia no `processSeasonEnd`, mas contrato
          // vence semana a semana: entre uma virada e outra o elenco despencava
          // sem piso nenhum (medido: 39 -> 15 em uma temporada). Aqui o clube
          // corre ao mercado e tapa o buraco assim que ele aparece.
          //
          // Emergencial vale 0 no mercado — a mesma regra do fim de temporada,
          // para a rede nao virar impressora de dinheiro.
          const reforcosDeEmergencia = reforcosEmergenciais(playersAfterNT, {
            divisao: String(getTeamByShort(s.myTeamShort ?? "")?.divisao ?? "serie_a"),
            temporada: s.currentSeason,
            semana: newWeek,
          })
          if (reforcosDeEmergencia.length > 0) {
            const fimDoVinculo = absoluteWeek(s.currentSeason, newWeek) + 52
            playersAfterNT = [
              ...playersAfterNT,
              ...reforcosDeEmergencia.map((r, i) => ({
                id: Math.max(Date.now() + i, ...playersAfterNT.map(p => p.id + i + 1)),
                name: r.name,
                position: r.position,
                age: r.age,
                overall: r.overall,
                potential: r.potential,
                nationality: r.nationality,
                ...atributosPorPosicao(r.overall, r.position, r.name),
                energy: 100,
                morale: "Normal" as const,
                form: r.overall,
                contract: {
                  salary: r.salarioSemanal,
                  endDate: fimDoVinculo,
                  releaseClause: null,
                  signedWeek: newWeek,
                  signedSeason: s.currentSeason,
                },
                injury: null,
                marketValue: r.marketValue,
                seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
                training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
                nationalTeam: null,
                calledUp: false,
                joinedClubWeek: newWeek,
                joinedClubSeason: s.currentSeason,
                isLoanedIn: false,
                isStarter: false,
                statusEffects: [],
              } as Player)),
            ]
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("ultrafoot:reforcos-emergenciais", {
                detail: reforcosDeEmergencia.map(r => ({ nome: r.name, posicao: r.position, overall: r.overall })),
              }))
            }
          }

          // ---- A DIRETORIA VAI AO MERCADO ----
          //
          // Renovar segurava a queda mas nao repunha ninguem: em 10 temporadas
          // passivas o elenco convergia para EXATAMENTE 18, o piso, em todo clube
          // testado. Aqui a diretoria completa o plantel de trabalho quando a
          // janela esta aberta — e PAGA por isso, o que tambem e o freio do caixa
          // que so crescia. Vem DEPOIS do reforco emergencial de proposito: o
          // emergencial e a rede de seguranca (vale 0), este e contratacao de
          // verdade.
          let saidaDeCaixaDaDiretoria = 0
          {
            const timeDoUsuario = getTeamByShort(s.myTeamShort ?? "")
            // EFETIVA, nao a do cadastro — mesma armadilha do custo operacional.
            const divisaoDoClube = timeDoUsuario ? String(effectiveDivision(timeDoUsuario)) : "serie_a"
            const contratacoes = decidirContratacoes(
              playersAfterNT.map(p => ({ overall: p.overall, age: p.age, position: p.position })),
              {
                agora: absoluteWeek(s.currentSeason, newWeek),
                caixa: s.balance,
                folhaAtual: folhaSemanal(playersAfterNT),
                tetoDeFolha: Math.max(0, s.weeklyIncome) * 1.6,
                janelaAberta: isTransferWindowOpen(newWeek),
                salarioDe: (overall) => playerSalaryWeekly(overall, divisaoDoClube),
                valorDe: (overall) => playerMarketValue(overall, divisaoDoClube),
              },
            )
            if (contratacoes.length > 0) {
              const usados = new Set(playersAfterNT.map(p => p.name.trim().toLocaleLowerCase("pt-BR")))
              const fimDoVinculo = absoluteWeek(s.currentSeason, newWeek) + 52 * 3
              playersAfterNT = [
                ...playersAfterNT,
                ...contratacoes.map((c, i) => {
                  const name = gerarNomeDeAtleta(`diretoria:${s.myTeamShort}:${s.currentSeason}:${newWeek}:${i}`, usados)
                  return {
                    id: Math.max(Date.now() + 1000 + i, ...playersAfterNT.map(p => p.id + i + 1)),
                    name,
                    position: c.position as Player["position"],
                    age: c.age,
                    overall: c.overall,
                    potential: Math.min(99, c.overall + 3),
                    nationality: timeDoUsuario?.pais ?? "Brasil",
                    ...atributosPorPosicao(c.overall, c.position as Player["position"], name),
                    energy: 100,
                    morale: "Normal" as const,
                    form: c.overall,
                    contract: {
                      salary: c.salarioSemanal,
                      endDate: fimDoVinculo,
                      releaseClause: null,
                      signedWeek: newWeek,
                      signedSeason: s.currentSeason,
                    },
                    injury: null,
                    marketValue: c.marketValue,
                    seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
                    training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
                    nationalTeam: null,
                    calledUp: false,
                    joinedClubWeek: newWeek,
                    joinedClubSeason: s.currentSeason,
                    isLoanedIn: false,
                    isStarter: false,
                    statusEffects: [],
                  } as Player
                }),
              ]
              saidaDeCaixaDaDiretoria = contratacoes.reduce((t, c) => t + c.custo, 0)
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("ultrafoot:contratacoes-da-diretoria", {
                  detail: contratacoes.map((c, i) => ({ posicao: c.position, overall: c.overall, custo: c.custo, indice: i })),
                }))
              }
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

          // ── ENTROSAMENTO DA SEMANA ───────────────────────────────────────────
          //
          // O treino coletivo credita minutos juntos (bem menos que uma partida —
          // ver minutosDeTreinoColetivo) e o esquecimento corroi as duplas que
          // pararam de jogar. As duplas de quem SAIU do clube somem: elas nunca
          // mais serao usadas e so inchariam o save.
          const idsQueTreinaram = playersAfterNT.filter(p => !p.injury && p.isStarter).map(p => p.id)
          let paresDaSemana = decairEntrosamento(
            s.entrosamentoPares ?? {},
            playersAfterNT.map(p => p.id),
          )
          if (idsQueTreinaram.length >= 2) {
            paresDaSemana = creditarMinutosJuntos(paresDaSemana, idsQueTreinaram, minutosDeTreinoColetivo(plano))
          }
          const entrosamentoDaSemana = idsQueTreinaram.length >= 2
            ? entrosamentoDoGrupo(paresDaSemana, idsQueTreinaram)
            : (s.squadCohesion ?? PISO_ENTROSAMENTO)

          // Fadiga cronica só dos atletas que continuam no elenco.
          const fadigaAtualizada: Record<number, number> = {}
          for (const p of playersAfterNT) {
            const e = efeitoPorId.get(p.id)
            if (e) fadigaAtualizada[p.id] = Math.round(e.fadigaCronica)
          }

          // NOVO RETRATO DOS MINUTOS. Tem de sair de `playersAfterNT` (o elenco
          // como ele fica no fim da virada) e nao da entrada: quem chegou agora
          // parte do proprio acumulado, e nao herda a divida de ninguem.
          const minutosDepois: Record<number, number> = {}
          for (const p of playersAfterNT) minutosDepois[p.id] = p.seasonStats?.minutesPlayed ?? 0

          // A FOLHA TEM DE ACOMPANHAR O ELENCO — mesmo ajuste por DIFERENCA que o
          // `processSeasonEnd` ja faz. Contrato vencido saia sem devolver salario
          // e o reforco emergencial entrava sem cobrar: `weeklyExpenses` ficava
          // congelado no valor do elenco original enquanto o elenco encolhia. Em
          // 6 temporadas o clube pagava 953 mil por uma folha real de 93 mil.
          //
          // Ajusta pela diferenca (e nao por `folhaSemanal` puro) porque
          // `weeklyExpenses` tambem carrega comissao tecnica e olheiros.
          const ajusteDaFolhaSemanal = folhaSemanal(playersAfterNT) - folhaSemanal(s.squadPlayers)

          // COMISSAO VIVA (1.0.291). Trabalhar gera experiencia; a cada bloco
          // de 18 semanas o profissional pode subir um ponto, sem ultrapassar
          // o potencial. Competencia alta + lealdade baixa chama concorrentes.
          const staffEvoluido = s.staffMembers.map(member => {
            const experienceWeeks = (member.experienceWeeks ?? 0) + 1
            const potential = Math.max(member.competence, member.potential ?? Math.min(96, member.competence + 6))
            const develops = experienceWeeks % 18 === 0 && member.competence < potential
            const competence = develops ? member.competence + 1 : member.competence
            const marketInterest = Math.max(0, Math.min(100,
              Math.round((competence - 70) * 2 + (70 - member.loyalty) * 0.7 + experienceWeeks / 13),
            ))
            return {
              ...member,
              competence,
              potential,
              experienceWeeks,
              contractEndSeason: member.contractEndSeason ?? member.hiredSeason + 3,
              marketInterest,
            }
          })

          return {
            ...s,
            currentWeek: finalWeek,
            currentSeason: newSeason,
            squadPlayers: playersAfterNT,
            weeklyExpenses: Math.max(0, s.weeklyExpenses + ajusteDaFolhaSemanal),
            entrosamentoPares: paresDaSemana,
            squadCohesion: entrosamentoDaSemana,
            fadigaCronica: fadigaAtualizada,
            minutosNaViradaDaSemana: minutosDepois,
            staffMembers: staffEvoluido,
            ultimoTreino: {
              carga: resumoTreino.carga,
              energiaMedia: resumoTreino.energiaMedia,
              fadigaMedia: resumoTreino.fadigaMedia,
              riscoMedio: resumoTreino.riscoMedio,
              lesionados: lesionadosNoTreino,
              semana: newWeek,
            },
            nationalTeamCalls: updatedCalls,
            transferOffers: updatedOffers,
            pendingIncomingTransfers: canRegisterTransfers ? [] : s.pendingIncomingTransfers,
            pendingOutgoingTransfers: canRegisterTransfers ? [] : (s.pendingOutgoingTransfers ?? []),
            marketingContracts: updatedMarketing,
            pendingFundOffers: fundOffers,
            // `saldoDeParcelas` entra na MESMA soma do caixa da semana: uma
            // operação só, pelo motivo explicado onde ele é calculado.
            balance: s.balance + weeklyBalance + marketingBonus - penaltyTotal - saidaDeCaixaDaDiretoria + saldoDeParcelas,
            parcelasDeTransferencia: parcelasQueSobram,
            // Direito de recompra vencido sai do save: guardar cláusula morta
            // é inchaço com aparência de funcionalidade.
            recompras: (s.recompras ?? []).filter(r => recompraValida(r, newSeason)),
            lastSeasonStandings: lastStandings,
          }
        })

        // Extrato: gravado FORA do updater, pelo motivo explicado na declaracao.
        for (const mov of movimentacoesDaSemana) registrarMovimentacao(mov)

        // Atualiza o mercado mundial fora do updater do Zustand. Isso também
        // remove o atleta do elenco-base de origem e o adiciona ao novo clube,
        // portanto a saída não é apenas uma mensagem visual.
        for (const departure of expiredDepartures) {
          recordWorldTransfer(departure.origin, departure.destination, {
            nome: departure.player.name,
            pos: departure.player.position,
            idade: departure.player.age,
            base: departure.player.overall,
            nac: departure.player.nationality,
            temporada: state.currentSeason,
          })
        }
        if (expiredDepartures.length > 0 && typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("ultrafoot:contracts-expired", {
            detail: expiredDepartures.map(item => ({
              playerName: item.player.name,
              destination: item.destination,
            })),
          }))
        }
        
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

        // Gera novas ofertas da IA.
        //
        // Passa o clube do usuario EXPLICITAMENTE: sem isto a funcao caia em
        // `state.myTeamShort`, e quando esse campo esta vazio o proprio clube do
        // tecnico entrava na lista de pretendentes — o relato "recebo proposta do
        // Sao Paulo por jogador do Sao Paulo".
        get().generateAIOffers(get().myTeamShort)
      },
      
      trainPlayer: (playerId, attribute) => {
        set((s) => ({
          squadPlayers: s.squadPlayers.map(p =>
            p.id === playerId
              ? {
                  ...p,
                  training: {
                    currentFocus: attribute,
                    // ⚠️ Escolher atributo CANCELA o treino de posicao: e o mesmo
                    // slot. Sem esta linha o atleta acumularia os dois e ganharia
                    // duas evolucoes pagando uma so de energia.
                    positionFocus: null,
                    weeksTrained: 0,
                    lastTrainingWeek: s.currentWeek
                  },
                  energy: Math.max(0, p.energy - 10)
                }
              : p
          )
        }))
      },

      /**
       * Poe o atleta para APRENDER UMA POSICAO no CT. `posicao` nula encerra.
       *
       * A contrapartida de `trainPlayer`, e exclusiva com ela pelo mesmo motivo.
       * Quem manda no ganho semanal e `aprenderPosicao` (lib/modelo-de-jogador),
       * a mesma funcao que credita os minutos jogados fora de posicao — duas
       * fontes para a mesma familiaridade seriam duas escalas para a mesma
       * grandeza, o defeito recorrente deste projeto.
       */
      treinarPosicao: (playerId, posicao) => {
        const alvo = posicao ? normalizePosition(posicao) : null
        set((s) => ({
          squadPlayers: s.squadPlayers.map(p => {
            if (p.id !== playerId) return p
            // Treinar a POSICAO NATURAL nao faz sentido: ela ja e 20.
            if (alvo && normalizePosition(p.position) === alvo) return p
            return {
              ...p,
              training: {
                ...p.training,
                currentFocus: alvo ? null : p.training.currentFocus,
                positionFocus: alvo,
                weeksTrained: 0,
                lastTrainingWeek: s.currentWeek,
              },
              energy: alvo ? Math.max(0, p.energy - 10) : p.energy,
            }
          }),
        }))
      },

      setStarter: (playerId, isStarter) => {
        set((s) => ({
          squadPlayers: s.squadPlayers.map(p =>
            p.id === playerId ? { ...p, isStarter } : p
          )
        }))
      },

      setStarters: (starterIds) => {
        const titulares = new Set(starterIds)
        set((s) => ({
          squadPlayers: s.squadPlayers.map(p => {
            const deveSerTitular = titulares.has(p.id)
            // Preserva a referencia de quem nao mudou: sem isto todo objeto do
            // elenco vira novo a cada gravacao e as telas que comparam por
            // identidade re-renderizam a toa.
            return p.isStarter === deveSerTitular ? p : { ...p, isStarter: deveSerTitular }
          }),
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
                    // Semana ABSOLUTA. Era `currentWeek + weeks` — a semana zera
                    // a cada temporada, entao renovar num save avancado gravava
                    // um contrato que ja nascia vencido.
                    endDate: absoluteWeek(s.currentSeason, s.currentWeek) + weeks,
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
        const renovado = get().squadPlayers.find(p => p.id === playerId)
        if (renovado) {
          registrarMovimentacao({
            playerName: renovado.name, type: "renew", value: newSalary,
            fromTeam: get().myTeamShort ?? "", toTeam: get().myTeamShort ?? "",
            season: get().currentSeason, week: get().currentWeek,
            detalhe: `Renovou por ${Math.max(1, Math.round(weeks / 52))} ano(s) a ${newSalary.toLocaleString("pt-BR")}/semana`,
          })
        }
      },

      /**
       * MIGRACAO de saves antigos para o relogio ABSOLUTO de contrato.
       *
       * Ate a 1.0.136 o `endDate` era comparado com a semana da temporada (que
       * zera todo ano), entao nenhum contrato vencia — e os saves carregam
       * valores gravados sob essa regra. Ao ligar o relogio correto, um save
       * avancado veria TODO o elenco como vencido de uma vez.
       *
       * Aqui rebaseamos apenas quem ficaria vencido/quase, dando um prazo
       * plausivel a partir de agora (jovem e craque assinam mais longo). Roda
       * uma unica vez por carreira.
       */
      limparClubeAtual: () => {
        // ESTORNO DAS CHEGADAS PENDENTES. A fila era simplesmente descartada, e
        // o dinheiro ja debitado sumia junto: quem acertou um reforco fora da
        // janela e depois trocou de clube pagava por um atleta que nunca chegou.
        const pendentes = get().pendingIncomingTransfers
        const aEstornar = pendentes.reduce((soma, t) => soma + t.fee, 0)
        set(s => ({
          balance: s.balance + aEstornar,
          transferBudget: s.transferBudget + aEstornar,
        }))
        set({
          myTeamShort: "",
          squadPlayers: [],
          // Mercado: propostas e sondagens sao do clube que ficou para tras.
          transferOffers: [],
          marketInterests: [],
          pendingIncomingTransfers: [],
          // Saida acertada tambem fica para tras: ela era do clube anterior.
          pendingOutgoingTransfers: [],
          transferListedIds: [],
          loanListedIds: [],
          // Tabela e resultados do emprego anterior nao valem para o proximo.
          serieAStandings: [],
          // Entrosamento e minutos JUNTOS: um elenco novo comeca do zero.
          entrosamentoPares: {},
          fadigaCronica: {},
          minutosNaViradaDaSemana: {},
          squadCohesion: PISO_ENTROSAMENTO,
          ultimoTreino: null,
        })
      },

      semearEntrosamentoDoHistorico: () => {
        const s = get()
        if (s.entrosamentoSemeado) return
        // Save que ja nasceu na 1.0.223 nao tem historico para semear — so marca
        // como feito para nao repetir a checagem toda semana.
        const comJogos = s.squadPlayers
          .map(p => ({ id: p.id, jogos: p.seasonStats?.matchesPlayed ?? 0 }))
          .filter(p => p.jogos > 0)
        if (comJogos.length < 2) {
          set({ entrosamentoSemeado: true })
          return
        }
        const pares = semearParesDeHistorico(comJogos)
        const titulares = s.squadPlayers.filter(p => p.isStarter).map(p => p.id)
        set({
          entrosamentoSemeado: true,
          entrosamentoPares: pares,
          squadCohesion: titulares.length >= 2
            ? entrosamentoDoGrupo(pares, titulares)
            : (s.squadCohesion ?? PISO_ENTROSAMENTO),
        })
      },

      migrarContratosParaSemanaAbsoluta: () => {
        const s = get()
        if (s.contractsAbsoluteMigrated) return
        const agora = absoluteWeek(s.currentSeason, s.currentWeek)
        set((st) => ({
          contractsAbsoluteMigrated: true,
          squadPlayers: st.squadPlayers.map(p => {
            if (!p.contract) return p
            const restante = p.contract.endDate - agora
            if (restante > 26) return p // ainda faz sentido, nao mexe
            // Prazo novo: 1 a 4 anos, mais longo para jovem/craque.
            const anos = p.age <= 23 ? 4 : p.overall >= 80 ? 3 : p.age >= 32 ? 1 : 2
            return { ...p, contract: { ...p.contract, endDate: agora + 52 * anos } }
          }),
        }))
      },

      promoverDaBase: (jovem, taxa, divisao) => {
        const state = get()
        if (state.balance < taxa) return false

        // O card da base as vezes vem com os atributos zerados (o gerador de
        // prospectos nem sempre os preenche). Subir assim criaria um
        // profissional com VEL/FIN/PAS 0, que o motor de partida trata como
        // perna de pau. Sem atributo, deriva-se do overall.
        const base = jovem.overall
        const ou = (v: number | undefined, desvio: number) =>
          v && v > 0 ? v : Math.max(20, Math.min(99, Math.round(base + desvio)))

        // SALÁRIO DE CRIA DA BASE.
        //
        // Era `base * 900`: um garoto de overall 60 saía com R$ 54.000 por
        // semana. Virou `base * 400 * 0,6` (piso 4 mil) para acompanhar o
        // profissional — mas essa conta é CEGA À DIVISÃO, e o elenco à volta
        // dele não é. Numa Serie D (fator 0.045) o profissional de overall 58
        // ganha R$ 700/semana e o promovido saía com R$ 13.920: vinte vezes o
        // salário do titular ao lado. Só na Serie A os dois números batiam —
        // por isso o conserto anterior pareceu resolver.
        //
        // Agora sai de `youthPromotionSalaryWeekly`, a MESMA curva do
        // profissional (overall + divisão) com o desconto de primeiro contrato
        // de cria. A divisão vem da tela (que conhece o acesso/rebaixamento em
        // `divisionOverride`); sem ela, do cadastro do clube.
        const clubeDaBase = getTeamByShort(state.myTeamShort ?? "")
        const divisaoDoClube = divisao ?? String(clubeDaBase?.divisao ?? "serie_a")
        const salario = youthPromotionSalaryWeekly(base, divisaoDoClube)
        const novo: Player = {
          id: Math.max(Date.now(), ...state.squadPlayers.map(p => p.id + 1)),
          name: jovem.name,
          position: jovem.position,
          age: jovem.age,
          overall: jovem.overall,
          potential: Math.max(jovem.potential, jovem.overall),
          nationality: jovem.nationality
            ?? (normalizeCountry(clubeDaBase?.pais) === PAIS_DESCONHECIDO
              ? "Brasil"
              : normalizeCountry(clubeDaBase?.pais)),
          pace: ou(jovem.pace, 4), shooting: ou(jovem.shooting, -3), passing: ou(jovem.passing, -1),
          dribbling: ou(jovem.dribbling, 2), defending: ou(jovem.defending, -5), physical: ou(jovem.physical, -4),
          energy: 100, morale: "Motivado", form: 70,
          contract: {
            salary: salario,
            // Tres temporadas de contrato para o garoto da base — tempo de se
            // firmar sem virar agente livre no meio do caminho.
            //
            // ⚠️ SEMANA ABSOLUTA, sempre. `currentWeek` zera a cada temporada e o
            // vencimento e conferido contra `absoluteWeek` (ver o filtro de
            // contratos vencidos no advanceWeek). Com a conta relativa, o garoto
            // promovido em 2029 nascia com endDate=156 contra um absoluteNow=156:
            // saia de graca no advanceWeek seguinte, e promover da base virava
            // jogar dinheiro fora.
            endDate: absoluteWeek(state.currentSeason, state.currentWeek) + 52 * 3,
            releaseClause: null,
            signedWeek: state.currentWeek,
            signedSeason: state.currentSeason,
          },
          // ⚠️ NAO usar aqui a formula de profissional (`overall² * 900`).
          //
          // O garoto valia uma coisa na base (`valorDeMercadoJovem`, que pesa a
          // habilidade ATUAL e da um premio modesto pela promessa) e chegava ao
          // elenco valendo outra, bem maior — a formula de atleta pronto. Com o
          // "Vender agora" do elenco pagando o marketValue INTEGRAL, na hora, sem
          // sorteio de interesse e sem esperar a janela, promover virou o caminho
          // curto para imprimir dinheiro: medido em 200 mil simulacoes, render o
          // garoto pelo elenco pagava 2,6x o que a base pagava, e uma peneira de
          // R$ 100 mil devolvia ~R$ 6,3 milhoes.
          //
          // Usando a MESMA conta da base, promover para revender vira PREJUIZO
          // (paga-se a taxa de promocao e o preco nao muda). Promover para USAR o
          // atleta — que e o ponto da categoria de base — segue valendo a pena.
          marketValue: valorDeMercadoJovem({
            id: "", name: jovem.name, position: jovem.position,
            age: jovem.age, overall: jovem.overall, potential: jovem.potential,
          }),
          isStarter: false,
          isLoanedIn: false,
          // Marca de origem: este subiu da NOSSA base.
          criaDaBase: true,
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
        registrarMovimentacao({
          playerName: novo.name, type: "promote", value: taxa,
          fromTeam: "Categoria de base", toTeam: state.myTeamShort ?? "",
          season: state.currentSeason, week: state.currentWeek,
          detalhe: `Subiu ao profissional aos ${novo.age} anos`,
        })
        return true
      },

      /**
       * Credita a venda de um jovem UMA VEZ SO.
       *
       * O dinheiro mora aqui (motor) e a lista de jovens mora no save — dois
       * armazenamentos diferentes. Se o save nao chegasse ao disco antes de uma
       * navegacao (que recarrega a pagina inteira), o jovem "voltava" e a venda
       * era paga de novo. Ja tentei consertar isso pelo lado do save duas vezes;
       * nao resolve, porque a corrida e entre os DOIS armazenamentos.
       *
       * Guardando o recibo NO MESMO lugar do dinheiro, pagar duas vezes deixa de
       * ser possivel: se o saldo foi creditado, o recibo foi junto, no mesmo
       * `set`. Nao existe estado intermediario.
       */
      receberPorJovem: (valor, vendaId) => {
        if (!Number.isFinite(valor) || valor <= 0) return
        const recibo = vendaId ? String(vendaId) : ""
        set((s) => {
          const pagos = s.vendasDeJovensPagas ?? []
          if (recibo && pagos.includes(recibo)) return s  // ja foi pago
          return {
            balance: s.balance + valor,
            // Guarda so os ultimos recibos: o objetivo e barrar o pagamento
            // repetido de uma venda recente, nao manter historico eterno.
            vendasDeJovensPagas: recibo ? [...pagos, recibo].slice(-400) : pagos,
          }
        })
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

      /**
       * Aplica a preleção à moral contínua do elenco.
       *
       * ⚠️ QUEM CHAMA MANDA NO MOMENTO. No "pre" e no "fim" isto é chamado; no
       * INTERVALO não é — lá a conversa chega ao jogo pelo canal
       * `CoachDecisionEffect`, e gravar moral no meio da partida faria
       * `userForces` recalcular por cima do efeito, contando a mesma preleção
       * duas vezes. A regra inteira está no cabeçalho de `lib/prelecao.ts`.
       *
       * ⚠️ No fim da partida tem de vir DEPOIS de `processarDesempenhoPartida`,
       * que também escreve `moralePoints`: aqui a conta é somada sobre o estado
       * corrente, então a ordem inversa perderia o que a nota rendeu.
       */
      aplicarPrelecao: (deltas) => {
        if (!deltas.length) return
        const porId = new Map(deltas.map(d => [d.id, d.delta]))
        set((s) => ({
          squadPlayers: s.squadPlayers.map(p => {
            const delta = porId.get(p.id)
            if (!delta) return p
            const pontos = Math.max(0, Math.min(100, (p.moralePoints ?? pontosDoRotulo(p.morale)) + delta))
            return { ...p, moralePoints: Math.round(pontos), morale: rotuloDaMoral(pontos) }
          }),
        }))
      },

      registrarPosicoesJogadas: (minutos) => {
        if (!minutos.length) return
        const porId = new Map(minutos.map(m => [m.id, m]))
        set((s) => {
          let mudou = false
          const squadPlayers = s.squadPlayers.map(p => {
            const entrada = porId.get(p.id)
            if (!entrada || entrada.minutos <= 0) return p
            const perfil = perfilDoAtleta(p.id, p.position, p.overall, p.secondaryPositions ?? [])
            const aprendeu = aprenderPosicao(perfil, p.perfilProgresso, entrada.posicao, entrada.minutos)
            // A FUNCAO tambem se aprende exercendo — e por partida, nao por
            // minuto: assentar numa funcao e questao de repeticao de jogo.
            // AS DUAS FASES CONTAM. A funcao sem bola tambem se assenta com
            // repeticao — se so a com bola contasse, o tecnico que usa funcoes
            // diferentes nas duas fases pagaria eterno preco de novidade em uma
            // delas. `exercerFuncao` devolve o mesmo objeto quando nao ha o que
            // creditar, entao a segunda chamada e de graca no caso comum.
            const comBola = exercerFuncao(aprendeu, entrada.funcao)
            const progresso = entrada.funcaoSemBola && entrada.funcaoSemBola !== entrada.funcao
              ? exercerFuncao(comBola, entrada.funcaoSemBola)
              : comBola
            // As duas devolvem o MESMO objeto quando nada mudou (posicao
            // natural, funcao ja saturada, teto atingido). Comparar por
            // referencia evita reescrever o save inteiro a cada partida.
            if (progresso === p.perfilProgresso) return p
            mudou = true
            return { ...p, perfilProgresso: progresso }
          })
          return mudou ? { squadPlayers } : {}
        })
      },

      /**
       * Verba liberada pela diretoria depois de um pedido APROVADO.
       *
       * Existe porque o pedido aprovado na Central de Gestao nao mexia em
       * dinheiro nenhum: a tela dizia "aprovado" e nada mudava. Pedido de
       * orcamento cai na verba de transferencias; obra e estrutura caem no
       * caixa, que e de onde `startInfrastructureUpgrade` tira o custo.
       */
      liberarVerbaDaDiretoria: (valor, destino) => {
        if (!Number.isFinite(valor) || valor <= 0) return
        set((s) => destino === "transferencias"
          ? { transferBudget: Math.max(0, s.transferBudget + valor) }
          : { balance: s.balance + valor })
      },

      /**
       * Vende um atleta do elenco.
       *
       * `valor` e o que a compradora ofereceu de fato. Sem ele cai no valor de
       * mercado, que era o comportamento antigo — a venda pagava sempre o preco
       * cheio, e a tela nem negociava. Quem chama e que faz o sorteio de
       * interesse e a checagem de janela.
       */
      sellPlayer: (playerId, valor, termos = TERMOS_A_VISTA) => {
        const state = get()
        const player = state.squadPlayers.find(p => p.id === playerId)
        if (!player) return

        const recebido = typeof valor === "number" && valor > 0 ? valor : player.marketValue

        // ⚠️ NEM TUDO QUE ENTRA NA VENDA É DO CLUBE. O contrato já declarava a
        // revenda devida ao clube anterior e o fatiamento de direitos (fundo,
        // coproprietário) — e nada lia esses campos: o caixa recebia o valor
        // cheio. Além de irreal, era a jogada mais rentável do jogo. Ver
        // `lib/repartir-venda.ts`.
        const venda = repartirVenda(recebido, player.contract ?? undefined)

        /**
         * CLÁUSULAS DO NEGÓCIO (1.0.383).
         *
         * ⚠️ A ORDEM IMPORTA E É ESTA: primeiro `repartirVenda` tira o que nunca
         * foi nosso (fundo, coproprietário, revenda ao clube anterior), e só o
         * LÍQUIDO é parcelado. Parcelar o bruto e repartir depois faria o clube
         * anterior esperar as nossas parcelas para receber o que já era dele.
         */
        const negocio = resolverNegocio(venda.liquido, termos, {
          atleta: player.name,
          clube: state.myTeamShort ?? "",
          semanaAtual: absoluteWeek(state.currentSeason, state.currentWeek),
          tipo: "receber",
        })
        // Direito de recompra que ficamos guardando: vender mais barato hoje em
        // troca de poder trazer de volta por valor fixo. Sem prazo não é
        // cláusula, é opção eterna — daí `ateTemporada` ser obrigatório.
        const recompraNova: Recompra[] = termos.recompra
          ? [{
              id: `recompra-${state.currentSeason}-${state.currentWeek}-${playerId}`,
              atleta: player.name,
              clube: "",
              valor: termos.recompra.valor,
              ateTemporada: termos.recompra.ateTemporada,
            }]
          : []

        set((s) => ({
          squadPlayers: s.squadPlayers.filter(p => p.id !== playerId),
          parcelasDeTransferencia: [...(s.parcelasDeTransferencia ?? []), ...negocio.parcelas],
          recompras: [...(s.recompras ?? []), ...recompraNova],
          // Sai tambem das listas: atleta vendido nao pode continuar anunciado
          // nem recebendo sondagem de quem ja nao o tem.
          transferListedIds: (s.transferListedIds ?? []).filter(id => id !== playerId),
          loanListedIds: (s.loanListedIds ?? []).filter(id => id !== playerId),
          transferOffers: s.transferOffers.filter(offer => offer.playerId !== playerId),
          balance: s.balance + negocio.aVista,
          weeklyExpenses: Math.max(0, s.weeklyExpenses - (player.contract?.salary || 0)),
        }))
        // O extrato registra o valor NEGOCIADO e diz para onde foi o que não
        // entrou: ver "vendi por 10 milhões" e o caixa subir 4 sem explicação
        // seria pior do que não ter a regra.
        registrarMovimentacao({
          playerName: player.name, type: "sell", value: recebido,
          fromTeam: state.myTeamShort ?? "", toTeam: "",
          season: state.currentSeason, week: state.currentWeek,
          detalhe: [
            venda.repasses.length
              ? `Venda em definitivo · líquido ${Math.round(venda.liquido / 1000)}k (${descreverRepasses(venda).join(", ")})`
              : "Venda em definitivo",
            ...(negocio.parcelas.length ? negocio.descricao : []),
            termos.recompra ? `Recompra garantida até ${termos.recompra.ateTemporada}` : "",
          ].filter(Boolean).join(" · "),
        })
      },

      /**
       * Traz de volta um atleta vendido com direito de recompra.
       *
       * ⚠️ NÃO É UM DESFAZER. Ele volta com contrato novo e sem histórico de
       * cláusulas do negócio anterior: uma recompra é uma transferência como
       * outra qualquer, só que com o preço travado desde antes.
       */
      exercerRecompra: (recompraId) => {
        const state = get()
        const recompra = (state.recompras ?? []).find(r => r.id === recompraId)
        if (!recompra) return "inexistente"
        if (state.currentSeason > recompra.ateTemporada) return "expirada"
        if (state.balance < recompra.valor) return "sem_caixa"
        set((s) => ({
          balance: s.balance - recompra.valor,
          transferBudget: Math.max(0, s.transferBudget - recompra.valor),
          recompras: (s.recompras ?? []).filter(r => r.id !== recompraId),
        }))
        registrarMovimentacao({
          playerName: recompra.atleta, type: "buy", value: recompra.valor,
          fromTeam: recompra.clube, toTeam: state.myTeamShort ?? "",
          season: state.currentSeason, week: state.currentWeek,
          detalhe: "Recompra exercida pelo valor pactuado na venda",
        })
        return "ok"
      },

      retirePlayer: (playerId) => {
        const state = get()
        const player = state.squadPlayers.find(p => p.id === playerId)
        if (!player || player.age < 32) return false
        set((s) => ({
          squadPlayers: s.squadPlayers.filter(p => p.id !== playerId),
          transferListedIds: (s.transferListedIds ?? []).filter(id => id !== playerId),
          loanListedIds: (s.loanListedIds ?? []).filter(id => id !== playerId),
          transferOffers: s.transferOffers.filter(offer => offer.playerId !== playerId),
          weeklyExpenses: Math.max(0, s.weeklyExpenses - (player.contract?.salary ?? 0)),
        }))
        registrarMovimentacao({
          playerName: player.name, type: "retire", value: 0,
          fromTeam: state.myTeamShort ?? "", toTeam: "",
          season: state.currentSeason, week: state.currentWeek,
          detalhe: `Encerrou a carreira aos ${player.age} anos`,
        })
        return true
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
        registrarMovimentacao({
          playerName: player.name, type: "release", value: cost,
          fromTeam: state.myTeamShort ?? "", toTeam: "",
          season: state.currentSeason, week: state.currentWeek,
          detalhe: "Rescisão de contrato (multa paga)",
        })
        return true
      },

      /**
       * FIM DE CONTRATO: o atleta vai embora DE GRAÇA.
       *
       * Até aqui a virada de temporada só DISPARAVA A NOTIFICAÇÃO — "renove
       * antes de perder o atleta de graça" — e ninguém nunca saía. O elenco
       * ficava com contratos vencidos indefinidamente e o aviso era um blefe:
       * ignorar a renovação não custava nada.
       *
       * Não entra dinheiro (é transferência livre) e a folha alivia na hora.
       * Devolve quem realmente saiu, para a tela poder nomeá-los.
       */
      releaseExpiredPlayers: (playerIds) => {
        const alvo = new Set(playerIds)
        const state = get()
        const saindo = state.squadPlayers.filter(p => alvo.has(p.id))
        if (!saindo.length) return []
        const folhaLiberada = saindo.reduce((s, p) => s + (p.contract?.salary ?? 0), 0)
        set((s) => ({
          squadPlayers: s.squadPlayers.filter(p => !alvo.has(p.id)),
          // Some das listas junto: atleta que não é mais do clube não pode
          // continuar anunciado nem recebendo sondagem.
          transferListedIds: (s.transferListedIds ?? []).filter(id => !alvo.has(id)),
          loanListedIds: (s.loanListedIds ?? []).filter(id => !alvo.has(id)),
          transferOffers: s.transferOffers.filter(o => !alvo.has(o.playerId)),
          weeklyExpenses: Math.max(0, s.weeklyExpenses - folhaLiberada),
        }))
        for (const p of saindo) {
          registrarMovimentacao({
            playerName: p.name, type: "release", value: 0,
            fromTeam: state.myTeamShort ?? "", toTeam: "",
            season: state.currentSeason, week: state.currentWeek,
            detalhe: "Saiu de graça por fim de contrato",
          })
        }
        return saindo.map(p => p.name)
      },

      buyPlayer: (player, fee, isFreeAgent = false, janelaAberta, termos = TERMOS_A_VISTA) => {
        const state = get()
        // REGRA DO DESAFIO ANTES DE QUALQUER COISA. É a única barreira que vale
        // para TODOS os caminhos de contratação (mercado, rede mundial, leilão,
        // scripts): fiscalizar tela por tela deixaria a tela esquecida como
        // brecha. Sem desafio ativo, `podeReforcar` devolve true e não custa nada.
        if (!podeReforcar({ idade: player.age, semClube: isFreeAgent }).pode) return "desafio"
        /**
         * CLÁUSULAS DO NEGÓCIO (1.0.383). A `fee` continua sendo o valor cheio
         * acertado; os termos decidem QUANTO sai agora e o que fica agendado.
         *
         * ⚠️ A CHECAGEM DE CAIXA PASSA A SER SOBRE A ENTRADA, não sobre o total.
         * É o ponto inteiro do parcelamento: um clube que não tem 40 milhões
         * hoje pode ter 10 hoje e três parcelas depois. O total é MAIOR que o
         * valor à vista (`totalComParcelamento`), então parcelar não é de graça —
         * é caixa comprado com juros.
         */
        const negocio = resolverNegocio(fee, termos, {
          atleta: player.name,
          clube: player.previousClubShort ?? "Clube vendedor",
          semanaAtual: absoluteWeek(state.currentSeason, state.currentWeek),
          tipo: "pagar",
        })
        if (state.balance < negocio.aVista) return "failed"
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
          // CONTRATAR E ASSINAR UM VINCULO NOVO — nao herdar o do vendedor.
          //
          // `buyPlayer` so trocava `signedWeek`/`signedSeason` e mantinha o
          // `endDate` que veio junto. Quem chegava com contrato curto (ou ja
          // vencido, no caso de um objeto montado a partir de outro atleta) saia
          // de graca poucas semanas depois de custar dinheiro. A tela do Mercado
          // ja negocia o prazo e passa o `endDate` certo; este piso protege todos
          // os outros caminhos.
          contract: player.contract ? {
            ...player.contract,
            endDate: Math.max(
              player.contract.endDate ?? 0,
              absoluteWeek(state.currentSeason, state.currentWeek) + 52 * PRAZO_MINIMO_DE_CONTRATO_ANOS,
            ),
            signedWeek: state.currentWeek,
            signedSeason: state.currentSeason,
            /**
             * ⚠️ AQUI SE FECHA UM CICLO QUE ESTAVA ABERTO HÁ VERSÕES.
             *
             * `resaleClause` e `previousClub` existem no contrato desde sempre,
             * e `lib/repartir-venda.ts` já desconta a revenda devida ao clube
             * anterior quando revendemos o atleta. Só que NADA no jogo jamais
             * escrevia um valor ali: a regra estava pronta, testada, e nunca
             * disparava porque o campo era sempre 0. Esta é a porta de entrada.
             *
             * Só sobrescreve quando o negócio pactuou revenda: um atleta que já
             * chega com cláusula de um dono anterior mantém a dele.
             */
            resaleClause: termos.revendaAoVendedor && termos.revendaAoVendedor > 0
              ? termos.revendaAoVendedor
              : player.contract.resaleClause,
            previousClub: termos.revendaAoVendedor && termos.revendaAoVendedor > 0
              ? (player.previousClubShort ?? "Clube vendedor")
              : player.contract.previousClub,
          } : null,
          seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
        }
        
        // JANELA ABERTA = REFORCO NA HORA. `janelaAberta` chega de quem conhece a
        // semana da TEMPORADA; `currentWeek` e o contador absoluto e so serve de
        // ultimo recurso para chamadas antigas que ainda nao passam o parametro.
        const joinsNow = isFreeAgent || (janelaAberta ?? isTransferWindowOpen(state.currentWeek))
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
          balance: s.balance - negocio.aVista,
          // ⚠️ O ORÇAMENTO COMPROMETE O TOTAL, não só a entrada. Descontar apenas
          // o que sai hoje deixaria o técnico parcelar o elenco inteiro e a
          // diretoria só descobrir na virada da temporada.
          transferBudget: Math.max(0, s.transferBudget - negocio.total),
          parcelasDeTransferencia: [...(s.parcelasDeTransferencia ?? []), ...negocio.parcelas],
          weeklyExpenses: s.weeklyExpenses + (player.contract?.salary || 50000)
        }))
        registrarMovimentacao({
          playerName: newPlayer.name, type: "buy", value: fee,
          fromTeam: isFreeAgent ? "Sem clube" : "", toTeam: state.myTeamShort ?? "",
          season: state.currentSeason, week: state.currentWeek,
          detalhe: isFreeAgent
            ? "Assinou livre, sem custo de transferência"
            : joinsNow ? "Contratação registrada na hora" : "Contratação registrada — chega quando a janela abrir",
        })
        return joinsNow ? "joined" : "pending"
      },

      cancelarChegadaPendente: (id) => {
        const alvo = get().pendingIncomingTransfers.find(t => t.id === id)
        if (!alvo) return false
        set(s => ({
          pendingIncomingTransfers: s.pendingIncomingTransfers.filter(t => t.id !== id),
          // ESTORNO. A taxa saiu do caixa quando o acordo foi fechado; desistindo,
          // ela volta — inclusive para o orcamento de transferencias, que foi
          // debitado junto.
          balance: s.balance + alvo.fee,
          transferBudget: s.transferBudget + alvo.fee,
          // E o salario dele sai da folha: ele nunca chegou a vestir a camisa.
          weeklyExpenses: Math.max(0, s.weeklyExpenses - (alvo.salary ?? alvo.player.contract?.salary ?? 50000)),
        }))
        return true
      },

      // ⚠️ GASTO AVULSO NAO ENTRA NA DESPESA SEMANAL.
      //
      // Estes tres somavam o valor de UMA compra em `weeklyExpenses` (ou
      // `weeklyIncome`), que sao valores RECORRENTES — descontados toda semana.
      // Pagar uma divida de 5 milhoes uma vez passava a custar 5 milhoes POR
      // SEMANA, para sempre. Era a maior parte do "gasto que nao bate com a
      // realidade" relatado: a despesa so subia, nunca voltava.
      //
      // O caixa e debitado/creditado normalmente; o recorrente fica intocado.
      payClubDebt: (amount) => {
        const available = Math.max(0, get().balance)
        const paid = Math.min(Math.max(0, amount), available)
        if (paid > 0) set(state => ({ balance: state.balance - paid }))
        return paid
      },
      spendClubFunds: (amount) => {
        const value = Math.max(0, amount)
        if (get().balance < value) return false
        set(state => ({ balance: state.balance - value }))
        return true
      },
      addClubRevenue: (amount) => {
        const value = Math.max(0, amount)
        if (value > 0) set(state => ({ balance: state.balance + value }))
      },

      /**
       * Contrapartida de `addClubRevenue`. Existia só o lado da receita, e como
       * ele trava em `Math.max(0, ...)` não dava para debitar nada por ele —
       * cada tela que precisava cobrar algo inventava o próprio jeito ou
       * simplesmente não cobrava (foi o caso da rescisão de olheiro).
       */
      addClubExpense: (amount) => {
        const value = Math.max(0, amount)
        if (value > 0) set(state => ({ balance: state.balance - value }))
      },
      
      loanPlayer: (player, weeks, salary, fee = 0, janelaAberta, opcaoDeCompra = 0) => {
        const state = get()
        // Empréstimo é reforço: sem esta linha, "proibido contratar" teria a
        // brecha óbvia de trazer o mesmo atleta por empréstimo.
        if (!podeReforcar({ idade: player.age, emprestimo: true }).pode) return "desafio"
        const normalizedName = player.name.trim().toLocaleLowerCase("pt-BR")
        if (state.squadPlayers.some(p => p.name.trim().toLocaleLowerCase("pt-BR") === normalizedName) || state.pendingIncomingTransfers.some(p => p.player.name.trim().toLocaleLowerCase("pt-BR") === normalizedName)) return "failed"
        // A TAXA SAI DO CAIXA. Antes o empréstimo era de graça: o valor acertado
        // com o dono nunca era cobrado, então emprestar craque não custava nada.
        const taxa = Math.max(0, Math.round(fee))
        if (taxa > state.balance) return "no_cash"

        // A OPÇÃO DE COMPRA acertada na mesa vem JUNTO com o atleta. Ela era
        // negociada e descartada aqui (ver `Player.loanBuyOption`).
        const opcao = Math.max(0, Math.round(opcaoDeCompra))
        const loanedPlayer: Player = {
          ...player,
          id: Date.now(),
          joinedClubWeek: state.currentWeek,
          joinedClubSeason: state.currentSeason,
          isLoanedIn: true,
          loanBuyOption: opcao > 0 ? opcao : undefined,
          // Semana ABSOLUTA (ver a chegada da fila de transferencias acima).
          loanEndWeek: absoluteWeek(state.currentSeason, state.currentWeek) + weeks,
          contract: { salary, endDate: absoluteWeek(state.currentSeason, state.currentWeek) + weeks, releaseClause: null, signedWeek: state.currentWeek, signedSeason: state.currentSeason },
          seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
        }

        // Mesma regra da compra: a semana da TEMPORADA manda, nao o contador absoluto.
        const joinsNow = janelaAberta ?? isTransferWindowOpen(state.currentWeek)
        set((s) => ({
          balance: s.balance - taxa,
          squadPlayers: joinsNow ? [...s.squadPlayers, loanedPlayer] : s.squadPlayers,
          pendingIncomingTransfers: joinsNow ? s.pendingIncomingTransfers : [...s.pendingIncomingTransfers, {
            id: `incoming-loan-${state.currentSeason}-${state.currentWeek}-${loanedPlayer.id}`,
            player: loanedPlayer,
            kind: "emprestimo" as const,
            fee: taxa,
            agreedWeek: state.currentWeek,
            agreedSeason: state.currentSeason,
            loanWeeks: weeks,
            salary,
            opcaoDeCompra: opcao > 0 ? opcao : undefined,
          }],
          weeklyExpenses: s.weeklyExpenses + salary
        }))
        registrarMovimentacao({
          playerName: player.name,
          type: "loan",
          value: taxa,
          fromTeam: player.parentClub ?? "",
          toTeam: state.myTeamShort ?? "",
          season: state.currentSeason,
          week: state.currentWeek,
          detalhe: `${weeks} semanas${opcao > 0 ? ` · opção de compra de ${opcao.toLocaleString("pt-BR")}` : " · sem opção de compra"}`,
        })
        return joinsNow ? "joined" : "pending"
      },

      /**
       * EXERCER A OPÇÃO DE COMPRA (pedido: "comprar jogador emprestado, assim
       * como na vida real, onde o time ao fim do empréstimo exerce a opção de
       * compra se assim disponível").
       *
       * O atleta deixa de ser emprestado e passa a ser do clube: sai o vínculo
       * temporário (`isLoanedIn`, `loanEndWeek`, `parentClub`) e entra um contrato
       * de verdade, com o MESMO salário que ele já recebia — quem bancou a folha
       * durante o empréstimo não é surpreendido por um salário novo, e o teto de
       * folha não muda (por isso a diretoria não veta aqui: nada aumenta).
       */
      exercerOpcaoDeCompra: (playerId, janelaAberta) => {
        const state = get()
        const alvo = state.squadPlayers.find(p => p.id === playerId)
        if (!alvo?.isLoanedIn) return "failed"
        const preco = Math.max(0, Math.round(alvo.loanBuyOption ?? 0))
        if (preco <= 0) return "failed"
        // Comprar É transferência: respeita a janela como qualquer outra.
        const aberta = janelaAberta ?? isTransferWindowOpen(state.currentWeek)
        if (!aberta) return "no_window"
        if (state.balance < preco) return "no_cash"

        const salario = alvo.contract?.salary ?? 0
        set(s => ({
          balance: s.balance - preco,
          squadPlayers: s.squadPlayers.map(p => p.id !== playerId ? p : {
            ...p,
            isLoanedIn: false,
            loanEndWeek: undefined,
            loanBuyOption: undefined,
            loanSalaryReduction: undefined,
            parentClub: undefined,
            joinedClubWeek: s.currentWeek,
            joinedClubSeason: s.currentSeason,
            morale: "Feliz",
            contract: {
              salary: salario,
              // Semana ABSOLUTA, sempre: `currentWeek` zera a cada temporada e um
              // contrato relativo nasceria vencido no ano seguinte.
              endDate: absoluteWeek(s.currentSeason, s.currentWeek) + 52 * PRAZO_MINIMO_DE_CONTRATO_ANOS,
              releaseClause: null,
              signedWeek: s.currentWeek,
              signedSeason: s.currentSeason,
            },
          }),
        }))
        registrarMovimentacao({
          playerName: alvo.name,
          type: "loan_buy",
          value: preco,
          fromTeam: alvo.parentClub ?? "clube de origem",
          toTeam: state.myTeamShort ?? "",
          season: state.currentSeason,
          week: state.currentWeek,
          detalhe: "Opção de compra exercida ao fim do empréstimo",
        })
        return "comprado"
      },

      /**
       * SAÍDA ACERTADA (leilão vencido por um clube da IA, ou venda fora da
       * janela). Dinheiro na hora; o atleta só sai quando a janela abre.
       */
      registrarSaidaAcertada: (playerId, valor, clubeComprador, janelaAberta, origem = "leilao") => {
        const state = get()
        const alvo = state.squadPlayers.find(p => p.id === playerId)
        // Emprestado não se vende: o passe não é seu (mesma trava de
        // `toggleTransferListed`). E ninguém sai duas vezes pela mesma fila.
        if (!alvo || alvo.isLoanedIn) return "failed"
        if ((state.pendingOutgoingTransfers ?? []).some(t => t.playerId === playerId)) return "failed"

        const recebido = Math.max(0, Math.round(valor))
        if (janelaAberta) {
          set(s => ({
            balance: s.balance + recebido,
            squadPlayers: s.squadPlayers.filter(p => p.id !== playerId),
            transferListedIds: (s.transferListedIds ?? []).filter(id => id !== playerId),
            loanListedIds: (s.loanListedIds ?? []).filter(id => id !== playerId),
            transferOffers: s.transferOffers.filter(o => o.playerId !== playerId),
            weeklyExpenses: Math.max(0, s.weeklyExpenses - (alvo.contract?.salary ?? 0)),
          }))
        } else {
          // O DINHEIRO ENTRA AGORA e o atleta continua jogando por você até a
          // janela. A folha dele também continua — ele ainda é seu funcionário.
          set(s => ({
            balance: s.balance + recebido,
            transferOffers: s.transferOffers.filter(o => o.playerId !== playerId),
            pendingOutgoingTransfers: [...(s.pendingOutgoingTransfers ?? []), {
              id: `outgoing-${origem}-${s.currentSeason}-${s.currentWeek}-${playerId}`,
              playerId,
              playerName: alvo.name,
              toTeam: clubeComprador,
              fee: recebido,
              agreedWeek: s.currentWeek,
              agreedSeason: s.currentSeason,
              kind: origem,
            }],
          }))
        }
        registrarMovimentacao({
          playerName: alvo.name,
          type: origem === "leilao" ? "auction" : "sell",
          value: recebido,
          fromTeam: state.myTeamShort ?? "",
          toTeam: clubeComprador,
          season: state.currentSeason,
          week: state.currentWeek,
          detalhe: janelaAberta
            ? "Saída imediata — janela aberta"
            : "Valor em caixa; o atleta sai na abertura da janela",
        })
        return janelaAberta ? "saiu" : "pendente"
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

      /**
       * Demite um olheiro.
       *
       * DUAS COISAS QUE FALTAVAM (1.0.228):
       *
       *  1. RESCISÃO CUSTA. Demitir era de graça — dava para contratar os oito
       *     olheiros, disparar as buscas e demitir todo mundo antes da folha
       *     rodar. Agora sai o equivalente a 4 semanas de salário, como qualquer
       *     rescisão do jogo.
       *  2. A BUSCA EM ANDAMENTO MORRE COM ELE. O olheiro saía do elenco mas a
       *     busca continuava no save (`isSearching` num registro que não existe
       *     mais); o dinheiro da expedição ficava pago e nada era entregue.
       *     Quem demite no meio da busca perde o que investiu — e é avisado
       *     disso na tela antes de confirmar.
       *
       * Devolve o custo cobrado (0 quando o olheiro não existe).
       */
      fireScout: (scoutId) => {
        const scout = get().scouts.find(sc => sc.id === scoutId)
        if (!scout) return 0
        const rescisao = Math.round(scout.salary * 4)
        set((s) => ({
          scouts: s.scouts.filter(sc => sc.id !== scoutId),
          weeklyExpenses: Math.max(0, s.weeklyExpenses - scout.salary),
          balance: s.balance - rescisao,
        }))
        return rescisao
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

      // ATLETA EMPRESTADO NAO SE VENDE NEM SE EMPRESTA DE NOVO.
      //
      // Ele nao e seu: o passe pertence ao clube de origem. Vender ou repassar
      // por emprestimo quem chegou emprestado era uma brecha real — dava para
      // pegar um craque por emprestimo e vende-lo no mesmo mercado. O que se
      // pode fazer com ele esta em `lib/emprestimos.ts`: devolver antes da hora
      // ou negociar a renovacao com o clube dono.
      toggleTransferListed: (playerId) => set((s) => {
        if (s.squadPlayers.find(p => p.id === playerId)?.isLoanedIn) return {}
        const current = s.transferListedIds ?? []
        return current.includes(playerId)
          ? { transferListedIds: current.filter(id => id !== playerId) }
          : { transferListedIds: [...current, playerId] }
      }),

      toggleLoanListed: (playerId) => set((s) => {
        if (s.squadPlayers.find(p => p.id === playerId)?.isLoanedIn) return {}
        const current = s.loanListedIds ?? []
        return current.includes(playerId)
          ? { loanListedIds: current.filter(id => id !== playerId) }
          : { loanListedIds: [...current, playerId] }
      }),

      /**
       * DEVOLVER AGORA ao clube de origem (rescindir o emprestimo).
       * O atleta sai do elenco na hora; nao ha multa porque quem devolve antes
       * esta abrindo mao do resto do vinculo — o custo e nao ter mais o jogador.
       */
      devolverEmprestimo: (playerId) => {
        const alvo = get().squadPlayers.find(p => p.id === playerId)
        if (!alvo?.isLoanedIn) return false
        set((s) => ({
          squadPlayers: s.squadPlayers.filter(p => p.id !== playerId),
          transferListedIds: (s.transferListedIds ?? []).filter(id => id !== playerId),
          loanListedIds: (s.loanListedIds ?? []).filter(id => id !== playerId),
          // A folha volta ao normal: durante o emprestimo o salario dele era seu.
          weeklyExpenses: Math.max(0, s.weeklyExpenses - (alvo.contract?.salary ?? 0)),
        }))
        registrarMovimentacao({
          playerName: alvo.name, type: "loan_return", value: 0,
          fromTeam: get().myTeamShort ?? "", toTeam: alvo.parentClub ?? "clube de origem",
          season: get().currentSeason, week: get().currentWeek,
          detalhe: "Devolvido antes do prazo",
        })
        return true
      },

      /** Estende o vinculo de emprestimo por mais N semanas (acordo fechado). */
      renovarEmprestimo: (playerId, semanas, salarioSemanal) => {
        const alvo = get().squadPlayers.find(p => p.id === playerId)
        if (!alvo?.isLoanedIn) return false
        set((s) => {
          // Estende a partir do MAIOR entre o fim atual e agora, sempre em semana
          // ABSOLUTA — renovar um emprestimo ja vencido nao pode devolver uma data
          // no passado, e `currentWeek` sozinho zera a cada temporada.
          const agora = absoluteWeek(s.currentSeason, s.currentWeek)
          const novoFim = Math.max(alvo.loanEndWeek ?? agora, agora) + semanas
          return {
            squadPlayers: s.squadPlayers.map(p => p.id !== playerId ? p : {
              ...p,
              loanEndWeek: novoFim,
              contract: p.contract
                ? { ...p.contract, salary: salarioSemanal ?? p.contract.salary, endDate: novoFim }
                : p.contract,
            }),
          }
        })
        return true
      },

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

        // JANELA DE TRANSFERENCIAS. O comentario antigo aqui dizia que "janela
        // ativa gera mais ofertas", mas a funcao NUNCA olhou a janela: chovia
        // proposta em qualquer semana do ano. Fora da janela o que existe e
        // sondagem — acontece, mas e bem mais raro.
        //
        // Desde a 1.0.223 a janela tambem tem RELOGIO: `semanasParaFechar` faz a
        // ultima quinzena virar deadline day, quando quem nao resolveu paga mais
        // caro e abre mais perto do teto (ver urgenciaDaJanela).
        const janelaAberta = isTransferWindowOpen(state.currentWeek)
        const fatorJanela = janelaAberta ? 1 : 0.22
        const contextoJanela = {
          aberta: janelaAberta,
          semanasParaFechar: weeksUntilWindowCloses(state.currentWeek),
        }

        /**
         * COMPRADORES POSSIVEIS, com o elenco REAL de cada um.
         *
         * O pool antigo era `AI_TEAMS`: dezesseis clubes com orcamento chumbado
         * na constante e nenhuma nocao do proprio elenco. Agora cada candidato
         * traz o elenco de verdade (`getPlayersForTeam`, a mesma fonte do resto
         * do jogo) e o saldo do proprio clube — e por isso consegue responder as
         * perguntas que importam: "eu preciso de um zagueiro?" e "eu tenho
         * dinheiro para este?".
         *
         * O calculo do perfil e caro (percorre o elenco), entao fica em cache por
         * chamada: os mesmos candidatos servem todos os atletas da rodada.
         */
        const perfilCache = new Map<string, ClubeComprador | null>()
        const compradorDe = (curto: string, nome: string, prestigio: number, caixa: number): ClubeComprador | null => {
          if (perfilCache.has(curto)) return perfilCache.get(curto) ?? null
          let comprador: ClubeComprador | null = null
          try {
            const time = getTeamByShort(curto)
            const elenco = time ? getPlayersForTeam(time) : []
            // Sem elenco nao da para avaliar necessidade — e avaliar no chute e
            // exatamente o que se esta corrigindo aqui.
            if (elenco.length >= 11) {
              comprador = {
                curto, nome, prestigio,
                caixa,
                folhaSemanal: undefined,
                perfil: perfilDeElenco(elenco.map(p => ({
                  posicao: String(p.pos ?? "MEI"),
                  overall: p.base ?? 65,
                  idade: p.idade ?? 26,
                }))),
              }
            }
          } catch { /* clube sem elenco no banco: fica de fora, sem quebrar a semana */ }
          perfilCache.set(curto, comprador)
          return comprador
        }

        /**
         * O POOL DE COMPRADORES.
         *
         * `AI_TEAMS` (16 clubes com orcamento chumbado) continua na base, porque
         * e la que estao os pesos-pesados com caixa calibrado. Mas ele sozinho
         * fazia o mercado inteiro girar em torno dos mesmos dezesseis nomes.
         * Somamos clubes do catalogo com prestigio proximo do elenco do usuario:
         * o caixa deles sai do proprio `saldo`, e o elenco de `getPlayersForTeam`.
         *
         * O corte por prestigio nao e enfeite: e o que impede o time da Serie D
         * de sondar o craque e o gigante de perder tempo com o reserva — sem
         * precisar avaliar dois mil clubes por semana.
         */
        const prestigioBase = getTeamByShort(meuTime)?.prestigio ?? 70
        const candidatosDeCompra = [
          ...AI_TEAMS.map(t => ({ short: t.short, name: t.name, prestige: t.prestige, budget: t.budget })),
          ...allTeams
            .filter(t => Math.abs((t.prestigio ?? 60) - prestigioBase) <= 14)
            .map(t => ({
              short: t.curto, name: t.nome, prestige: t.prestigio ?? 60,
              budget: Math.max(500_000, t.saldo ?? 0),
            })),
        ]
          .filter(t => t.short.toUpperCase() !== meuTime)
          // Sem duplicar quem esta nas duas listas (AI_TEAMS manda: caixa calibrado).
          .filter((t, i, arr) => arr.findIndex(o => o.short === t.short) === i)
          .slice(0, 40)

        const newOffers: TransferOffer[] = []
        const candidatosASondagem: { player: Player; sondagem: Sondagem }[] = []
        const pendingIds = new Set(
          state.transferOffers.filter(o => o.status === "pendente").map(o => o.playerId)
        )

        for (const player of marketable) {
          // No máximo 1 oferta pendente por jogador; frequência escala com atratividade
          if (pendingIds.has(player.id)) continue
          // CONTRATO PERTO DO FIM atrai mais: o comprador sabe que leva barato — e
          // se chegar ao fim, de graca. E o motivo real pelo qual clube europeu
          // sonda brasileiro no ultimo ano de vinculo.
          // `endDate` e semana ABSOLUTA (a mesma escala de getContractStatus).
          const semanasDeContrato = player.contract
            ? player.contract.endDate - absoluteWeek(state.currentSeason, state.currentWeek)
            : 52
          const fimDeContrato = semanasDeContrato <= 26 ? 0.22 : semanasDeContrato <= 52 ? 0.10 : 0
          // INSATISFACAO: atleta infeliz pede para sair, e isso vaza para o mercado.
          const moral = player.moralePoints ?? 55
          const insatisfacao = moral <= 25 ? 0.20 : moral <= 40 ? 0.10 : 0

          const attractiveness = ((player.overall - 70) * 0.012
            + (player.potential - player.overall) * 0.008
            + Math.max(0, player.form - player.overall) * 0.01
            // Estar na lista multiplica o interesse: o clube está anunciando o atleta.
            + (listed.has(player.id) ? 0.35 : 0)
            + fimDeContrato
            + insatisfacao) * fatorJanela
          if (Math.random() > Math.max(0.02, Math.min(0.7, attractiveness))) continue

          // ── QUEM QUER, E POR QUÊ ────────────────────────────────────────────
          //
          // Cada candidato responde a mesma pergunta que um diretor de futebol
          // faria: "eu preciso disto? ele joga aqui? eu tenho o dinheiro?". A
          // avaliacao devolve o PAPEL PREVISTO (titular/rotacao/reserva) e e ele
          // que corta o valor da proposta — a raiz do "clube grande manda 13
          // milhoes por um reserva" era o preco sair do valor de mercado sozinho,
          // sem passar por "ele vai jogar?".
          const alvo: AtletaAlvo = {
            id: player.id,
            nome: player.name,
            posicao: player.position,
            overall: player.overall,
            potencial: player.potential,
            idade: player.age,
            valorDeMercado: player.marketValue,
            salarioSemanal: player.contract?.salary ?? Math.round(player.marketValue * 0.0006),
            semanasDeContrato,
            moral,
            listado: listed.has(player.id),
            papelAtual: player.isStarter ? "titular" : "rotacao",
          }

          const avaliacoes = candidatosDeCompra
            .map(t => {
              const comprador = compradorDe(t.short, t.name, t.prestige, t.budget)
              if (!comprador) return null
              return { comprador, avaliacao: avaliarCompra(comprador, alvo, contextoJanela) }
            })
            .filter((x): x is { comprador: ClubeComprador; avaliacao: AvaliacaoDeCompra } => x !== null)

          const interessados = avaliacoes.filter(a => a.avaliacao.quer)
          if (interessados.length === 0) {
            // Ninguem chegou a proposta, mas quem CHEGOU PERTO fica de olho —
            // e a sondagem passa a ter motivo em vez de ser sorteio.
            candidatosASondagem.push(
              ...avaliacoes
                .map(a => ({ player, sondagem: sondagemDe(a.comprador, alvo, a.avaliacao) }))
                .filter((x): x is { player: typeof player; sondagem: Sondagem } => x.sondagem !== null),
            )
            continue
          }

          // Entre os interessados, ganha quem PRECISA mais — nao um sorteio
          // uniforme. Clube com o setor furado se move antes do que esta servido.
          const escolhido = interessados.sort(
            (a, b) => (b.avaliacao.necessidade + (b.avaliacao.papel === "estrela" ? 0.3 : 0))
              - (a.avaliacao.necessidade + (a.avaliacao.papel === "estrela" ? 0.3 : 0)),
          )[0]
          const { comprador: buyingTeam, avaliacao } = escolhido
          const cfg = getClubAIConfig(buyingTeam.curto, buyingTeam.prestigio)

          // EMPRESTIMO: quem entraria como rotacao, o jovem sem espaco e o clube
          // que quer mas nao alcanca o preco vem buscar cedido, nao comprado.
          const wantsLoan =
            // Listado para empréstimo pelo técnico: a IA vem com proposta de
            // empréstimo, não de compra (modal do gerenciamento).
            (state.loanListedIds ?? []).includes(player.id) ||
            (player.age <= 22 && !player.isStarter && Math.random() < 0.55) ||
            (avaliacao.papel === "rotacao" && Math.random() < 0.45) ||
            buyingTeam.caixa < avaliacao.teto

          const offerAmount = wantsLoan
            ? (player.contract?.salary
                ? Math.round(player.contract.salary * 4 * (0.5 + Math.random() * 0.5))
                : 100000)
            : avaliacao.proposta

          newOffers.push({
            id: Date.now() + player.id,
            playerId: player.id,
            playerName: player.name,
            fromTeam: buyingTeam.nome,
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

        // SONDAGENS: os clubes que olharam o atleta e nao fecharam proposta esta
        // semana. Antes era um sorteio puro — `Math.random() > 0.12` e um clube
        // qualquer de AI_TEAMS, sem relacao nenhuma com o atleta ou com o elenco
        // do sondador. Agora sai da MESMA avaliacao da compra, entao a sondagem
        // sabe dizer por que existe e costuma virar proposta na janela seguinte.
        const novasSondagens: MarketInterest[] = []
        const jaSondados = new Set((state.marketInterests ?? []).map(i => i.playerId))
        for (const { player, sondagem } of candidatosASondagem) {
          if (pendingIds.has(player.id) || jaSondados.has(player.id)) continue
          // Fora da janela a sondagem e mais rara — mas ela EXISTE fora da janela,
          // que e justamente quando um clube monta a lista da temporada seguinte.
          if (Math.random() > (janelaAberta ? 0.5 : 0.18)) continue
          jaSondados.add(player.id)
          novasSondagens.push({
            id: `interest-${state.currentSeason}-${state.currentWeek}-${player.id}`,
            playerId: player.id, playerName: player.name,
            club: sondagem.clube,
            week: state.currentWeek,
            motivo: sondagem.motivo,
            papel: ROTULO_DO_PAPEL[sondagem.papel],
            temCaixa: sondagem.temCaixa,
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

        if (!offer || offer.status !== "pendente") return { ok: false }

        if (accept) {
          const player = state.squadPlayers.find(p => p.id === offer.playerId)
          if (!player) return { ok: false }

          // ── O ATLETA TAMBEM DECIDE (1.0.223) ──────────────────────────────
          //
          // Aceitar a proposta era, ate aqui, decisao exclusiva do tecnico: o
          // atleta ia, sempre, para onde mandassem. Agora ele pesa PROJETO
          // (prestigio do comprador contra o do clube atual) e MINUTOS (o papel
          // que teria no elenco de la) — os dois fatores que de fato derrubam
          // transferencia no futebol real.
          //
          // Emprestimo nao passa por aqui: ceder um atleta que nao esta jogando
          // e, quase sempre, do interesse dele proprio.
          if (offer.offerType === "compra") {
            const compradorTime = getTeamByShort(offer.fromTeam)
              ?? allTeams.find(t => t.nome === offer.fromTeam)
            const prestigioComprador = compradorTime?.prestigio
              ?? AI_TEAMS.find(t => t.name === offer.fromTeam)?.prestige
              ?? 70
            const meuPrestigio = getTeamByShort(state.myTeamShort ?? "")?.prestigio ?? 70
            let papelLa: PapelPrevisto = "titular"
            try {
              const elencoComprador = compradorTime ? getPlayersForTeam(compradorTime) : []
              if (elencoComprador.length >= 11) {
                papelLa = papelPrevisto(
                  perfilDeElenco(elencoComprador.map(p => ({
                    posicao: String(p.pos ?? "MEI"), overall: p.base ?? 65, idade: p.idade ?? 26,
                  }))),
                  player.position,
                  player.overall,
                )
              }
            } catch { /* sem elenco do comprador: fica no palpite neutro (titular) */ }

            const decisao = decisaoDoAtleta({
              atleta: {
                id: player.id, nome: player.name, posicao: player.position,
                overall: player.overall, potencial: player.potential, idade: player.age,
                valorDeMercado: player.marketValue,
                salarioSemanal: player.contract?.salary ?? 0,
                semanasDeContrato: player.contract
                  ? player.contract.endDate - absoluteWeek(state.currentSeason, state.currentWeek)
                  : 52,
                moral: player.moralePoints ?? 55,
                listado: (state.transferListedIds ?? []).includes(player.id),
                papelAtual: player.isStarter ? "titular" : "rotacao",
              },
              prestigioClubeAtual: meuPrestigio,
              prestigioClubeNovo: prestigioComprador,
              papelNoClubeNovo: papelLa,
              // O comprador cobre o salario atual com o agio do papel previsto.
              salarioOferecido: Math.round((player.contract?.salary ?? 0)
                * (papelLa === "estrela" ? 1.45 : papelLa === "titular" ? 1.20 : 1.02)),
            })

            if (!decisao.aceita) {
              // A proposta MORRE (o clube nao insiste em quem nao quer ir) e o
              // atleta ganha um pouco de moral: ficou onde queria ficar.
              set((s) => ({
                transferOffers: s.transferOffers.map(o =>
                  o.id === offerId ? { ...o, status: "rejeitada" as const } : o,
                ),
                squadPlayers: s.squadPlayers.map(p =>
                  p.id === player.id
                    ? { ...p, moralePoints: Math.min(100, (p.moralePoints ?? 55) + 4) }
                    : p,
                ),
              }))
              return { ok: false, motivo: `${player.name} recusou a transferência: ${decisao.motivo.toLowerCase()}` }
            }
          }

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
          // Aceitar proposta era a saida MAIS comum do elenco e a unica que nao
          // deixava rastro nenhum no save (ver lib/movimentacoes.ts).
          registrarMovimentacao({
            playerName: player.name,
            type: offer.offerType === "compra" ? "sell" : "loan_out",
            value: offer.offerAmount,
            fromTeam: state.myTeamShort ?? "",
            toTeam: offer.fromTeam,
            season: state.currentSeason,
            week: state.currentWeek,
            detalhe: offer.offerType === "compra"
              ? "Proposta aceita — venda em definitivo"
              : `Emprestado por ${offer.loanWeeks ?? 26} semanas (${offer.wageCoverage ?? 100}% do salário coberto)`,
          })
          return { ok: true }
        }

        set((s) => ({
          transferOffers: s.transferOffers.map(o =>
            o.id === offerId ? { ...o, status: "rejeitada" as const } : o
          )
        }))
        return { ok: true }
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

      /**
       * PÓS-PARTIDA (realismo FM): calcula a NOTA de cada titular, acumula
       * cartoes -> suspensao, e ajusta forma/moral pela atuacao. Chamado ao fim
       * de uma partida do usuario, com os eventos (gols, cartoes) da peleja.
       */
      processarDesempenhoPartida: (golsPro, golsContra, events) => {
        // Vereditos do tribunal desta partida. Preenchido dentro do `set` (onde
        // os jogadores sao percorridos) e devolvido para a TELA poder noticiar —
        // o engine nao tem acesso ao sistema de notificacoes.
        const vereditos: VeredictoDaPartida[] = []
        const resultado: "win" | "draw" | "loss" =
          golsPro > golsContra ? "win" : golsPro === golsContra ? "draw" : "loss"
        const contrib = contribuicoesPorJogador(events)
        // LESAO real a partir do evento da partida (antes era so narracao). O
        // atleta lesionado fica indisponivel por 1-6 semanas e sai da escalacao.
        const lesionados = new Map<number, PlayerInjury>()
        for (const e of events) {
          if (e.type !== "injury" || !e.playerId) continue
          const alvoP = get().squadPlayers.find(p => p.id === e.playerId)
          const prof = (alvoP?.persona ?? (alvoP ? gerarPersona(alvoP.id, alvoP.overall) : null))?.profissionalismo ?? 10
          // PROPENSAO: o profissional (cuida do corpo) tem chance de sair so com
          // um susto — a lesao pode ser "amortecida" para mais leve ou evitada.
          if (prof >= 15 && Math.random() < 0.35) continue // escapou
          let grav = Math.random()
          if (prof >= 13) grav *= 0.75 // puxa para gravidade menor
          const sev: PlayerInjury["severity"] = grav < 0.55 ? "leve" : grav < 0.88 ? "media" : "grave"
          const semanas = sev === "leve" ? 1 + Math.floor(Math.random() * 2)
            : sev === "media" ? 3 + Math.floor(Math.random() * 3) : 6 + Math.floor(Math.random() * 8)
          lesionados.set(e.playerId, {
            type: INJURY_TYPES[Math.floor(Math.random() * INJURY_TYPES.length)],
            severity: sev, weeksRemaining: semanas, startWeek: get().currentWeek,
          })
        }
        set((s) => {
          // Melhor nota entre os titulares vira homem do jogo.
          let melhorId = -1
          let melhorNota = -1
          const comNota = s.squadPlayers.map(p => {
            // Lesionado NA partida: aplica a lesao real (fica indisponivel).
            const novaLesao = lesionados.get(p.id)
            if (!p.isStarter || p.injury) {
              // Quem estava suspenso e NAO jogou cumpriu um jogo da punicao.
              if ((p.suspendedMatches ?? 0) > 0) {
                return { ...p, suspendedMatches: (p.suspendedMatches ?? 0) - 1 }
              }
              return p
            }
            const persona = p.persona ?? gerarPersona(p.id, p.overall)
            const c = contrib.get(p.id) ?? { gols: 0, assistencias: 0, amarelos: 0, vermelho: false }
            const nota = calcularNota({
              posicao: p.position, contrib: c, resultado, golsSofridos: golsContra,
              consistencia: persona.consistencia, semente: p.id + golsPro * 7 + golsContra * 13,
            })
            if (nota > melhorNota) { melhorNota = nota; melhorId = p.id }

            // TRIBUNAL: a expulsao vai a julgamento em vez de valer 1 jogo fixo.
            // Segundo amarelo continua 1; falta dura da 1-3; agressao, 4-8.
            const julgamento = c.vermelho
              ? julgar(inferirInfracao(
                  c.motivoExpulsao ?? "segundo_amarelo",
                  c.expulsaoViolenta ?? false,
                ))
              : null
            if (julgamento) vereditos.push({ playerId: p.id, playerName: p.name, julgamento })
            const { suspender, amarelosRestantes } = suspensaoPorCartoes(
              p.seasonYellows ?? 0, c.amarelos, c.vermelho, julgamento?.jogos ?? 1,
            )
            // Forma e moral reagem a nota: >=7.5 sobe, <6.0 cai.
            const deltaForma = nota >= 7.5 ? 4 : nota >= 7 ? 2 : nota < 6 ? -4 : 0
            // MORAL CONTINUA (0-100) sustenta o rotulo: a nota move os pontos de
            // forma fina (jogador reativo — temperamento baixo — oscila mais).
            const pontosAtuais = p.moralePoints ?? pontosDoRotulo(p.morale)
            const reatividade = 1 + (12 - persona.temperamentoNum) / 20 // ~0.6-1.5
            const deltaMoral = (nota - 6.7) * 6 * reatividade + (resultado === "win" ? 3 : resultado === "loss" ? -3 : 0)
            const novosPontos = Math.max(0, Math.min(100, pontosAtuais + deltaMoral))
            const novoRotulo = rotuloDaMoral(novosPontos)

            const jogos = (p.avgMatchRating ? p.seasonStats.matchesPlayed : 0)
            const novaMedia = jogos > 0
              ? ((p.avgMatchRating ?? nota) * jogos + nota) / (jogos + 1)
              : nota

            const persist: Partial<Player> = {
              persona,
              lastMatchRating: nota,
              avgMatchRating: Math.round(novaMedia * 10) / 10,
              seasonYellows: amarelosRestantes,
              suspendedMatches: (p.suspendedMatches ?? 0) + suspender,
              form: Math.max(0, Math.min(100, (p.form ?? 70) + deltaForma)),
              moralePoints: Math.round(novosPontos),
              morale: novoRotulo,
              // ESTATISTICAS DA TEMPORADA — o perfil do jogador mostrava tudo 0
              // porque NINGUEM acumulava estes campos: processarDesempenhoPartida
              // so gravava nota/moral/craque, e updatePlayerStats nunca era
              // chamado. Este titular JOGOU, entao conta o jogo e o que ele
              // produziu (contrib vem dos eventos reais da partida).
              seasonStats: {
                ...p.seasonStats,
                matchesPlayed: (p.seasonStats.matchesPlayed ?? 0) + 1,
                minutesPlayed: (p.seasonStats.minutesPlayed ?? 0) + 90,
                goals: (p.seasonStats.goals ?? 0) + c.gols,
                assists: (p.seasonStats.assists ?? 0) + c.assistencias,
                yellowCards: (p.seasonStats.yellowCards ?? 0) + c.amarelos,
                redCards: (p.seasonStats.redCards ?? 0) + (c.vermelho ? 1 : 0),
                cleanSheets: (p.seasonStats.cleanSheets ?? 0)
                  + (p.position === "GOL" && golsContra === 0 ? 1 : 0),
              },
              ...(novaLesao ? { injury: novaLesao } : {}),
            }
            return { ...p, ...persist }
          })
          // ENTROSAMENTO: os 90 minutos que ESTE onze acabou de jogar JUNTO.
          //
          // Antes era `+3 por vitoria, +2 por empate, +1 por derrota` sobre um
          // contador global — o time podia trocar de titular toda semana que o
          // numero subia igual. Agora o credito vai para as DUPLAS que estavam em
          // campo, e o entrosamento e recalculado a partir delas. Time que roda
          // demais o elenco simplesmente nao entrosa, como na vida real.
          //
          // O resultado ainda pesa, mas de leve e onde faz sentido: vitoria
          // costura, derrota desune. Vira um pequeno bonus/desconto de minutos.
          const idsQueJogaram = s.squadPlayers.filter(p => p.isStarter && !p.injury).map(p => p.id)
          const minutosDoJogo = 90 + (resultado === "win" ? 12 : resultado === "loss" ? -14 : 0)
          const paresAtualizados = creditarMinutosJuntos(
            s.entrosamentoPares ?? {}, idsQueJogaram, minutosDoJogo,
          )
          const novoEntrosamento = idsQueJogaram.length >= 2
            ? entrosamentoDoGrupo(paresAtualizados, idsQueJogaram)
            : (s.squadCohesion ?? PISO_ENTROSAMENTO)
          // Multa do tribunal sai do caixa do clube (o julgamento pune os dois).
          const multas = vereditos.reduce((soma, v) => soma + v.julgamento.multaClube, 0)
          return {
            squadCohesion: novoEntrosamento,
            entrosamentoPares: paresAtualizados,
            ...(multas > 0 ? { balance: Math.round((s.balance ?? 0) - multas) } : {}),
            squadPlayers: comNota.map(p =>
              p.id === melhorId
                ? { ...p, seasonStats: { ...p.seasonStats, manOfTheMatch: (p.seasonStats.manOfTheMatch ?? 0) + 1 } }
                : p,
            ),
          }
        })
        return vereditos
      },

      // Empurrao direto no entrosamento, para eventos avulsos. Ver a nota de
      // depreciacao na interface: o caminho normal e registrarMinutosJuntos.
      adjustSquadCohesion: (delta) => {
        set((s) => ({ squadCohesion: Math.max(0, Math.min(100, (s.squadCohesion ?? PISO_ENTROSAMENTO) + delta)) }))
      },

      /**
       * A PONTE entre os dois sistemas que nao se falavam.
       *
       * Partida oficial, amistoso e treino coletivo passam TODOS por aqui, cada
       * um com o seu peso em minutos. O entrosamento do XI deixa de ser um
       * contador que alguem incrementa e passa a ser a leitura de quanto aquele
       * grupo especifico ja jogou junto — trocar meio time na janela derruba o
       * numero sozinho, sem ninguem precisar lembrar de descontar.
       */
      registrarMinutosJuntos: (minutos, ids) => {
        set((s) => {
          // EXPULSO CONTA COMO LESIONADO AQUI: quem cumpre suspensao nao entrou
          // em campo, entao nao acumula minutos jogados juntos. Antes so a lesao
          // era descontada, e o suspenso ganhava entrosamento de um jogo que
          // assistiu do banco — inflando o numero justamente na semana em que o
          // time teve de se rearranjar sem ele.
          const disponiveis = s.squadPlayers.filter(p => !p.injury && (p.suspendedMatches ?? 0) <= 0)
          const alvo = ids?.length
            ? ids
            : disponiveis.filter(p => p.isStarter).map(p => p.id)
          if (alvo.length < 2) return {}
          const pares = creditarMinutosJuntos(s.entrosamentoPares ?? {}, alvo, minutos)
          return { entrosamentoPares: pares, squadCohesion: entrosamentoDoGrupo(pares, alvo) }
        })
      },

      definirPlanoDeTreino: (plano) => {
        set((s) => ({ planoDeTreino: { ...(s.planoDeTreino ?? PLANO_PADRAO), ...plano } }))
      },

      definirPosturaDaSemana: (postura) => set({ posturaDaSemana: postura }),

      /**
       * LESAO EM JOGO SIMULADO (pedido): quando o usuario SIMULA a partida (nao
       * joga ao vivo), o motor ao-vivo nao roda, entao nenhuma lesao surgia — uma
       * temporada simulada saia sem lesao, o que e irreal. Aqui rolamos, por jogo
       * simulado, uma chance de lesionar um titular apto. A PROPENSAO e por
       * jogador: profissionalismo alto (persona) reduz o risco — o "durao" x o
       * "de vidro".
       */
      rolarLesaoSimulada: (qtdJogos) => {
        for (let i = 0; i < Math.max(0, qtdJogos); i++) {
          const s = get()
          const aptos = s.squadPlayers.filter(p => p.isStarter && !p.injury && (p.suspendedMatches ?? 0) <= 0)
          if (aptos.length === 0) return
          // ~22% base por jogo; sobe um pouco com elenco cansado nao modelado aqui.
          if (Math.random() > 0.22) continue
          // Escolhe o alvo ponderando pela FRAGILIDADE (menos profissional, mais
          // provavel). GK quase nunca se lesiona em jogo.
          const pesos = aptos.map(p => {
            const persona = p.persona ?? gerarPersona(p.id, p.overall)
            const fragil = 1.4 - persona.profissionalismo / 20 // ~0.4-1.35
            // ⚠️ DUAS COISAS QUE JA EXISTIAM E NAO ENTRAVAM AQUI:
            //
            // `propensaoALesao` nasce em lib/modelo-de-jogador (atributo oculto,
            // derivado do id) e ja pesava no motor de PARTIDA — mas o sorteio
            // semanal a ignorava, entao o atleta fragil so era fragil em campo.
            //
            // E o passado do atleta nao contava: quem voltou de tres lesoes
            // seguidas corria o mesmo risco de quem nunca se machucou. Ver
            // lib/historico-de-lesoes.ts.
            const perfil = perfilDoAtleta(p.id, p.position, p.overall, p.secondaryPositions ?? [])
            const propensao = 0.7 + (perfil.propensaoALesao / 20) * 0.6 // ~0.7-1.3
            const passado = riscoPorHistorico(p.historicoDeLesoes, get().currentWeek)
            return {
              p,
              peso: (p.position === "GOL" ? 0.3 : 1) * Math.max(0.2, fragil) * propensao * passado,
            }
          })
          const soma = pesos.reduce((a, b) => a + b.peso, 0)
          let r = Math.random() * soma
          const alvo = (pesos.find(x => (r -= x.peso) <= 0) ?? pesos[0]).p
          const grav = Math.random()
          const sev: PlayerInjury["severity"] = grav < 0.6 ? "leve" : grav < 0.9 ? "media" : "grave"
          const semanas = sev === "leve" ? 1 + Math.floor(Math.random() * 2)
            : sev === "media" ? 3 + Math.floor(Math.random() * 3) : 6 + Math.floor(Math.random() * 8)
          set((st) => ({
            squadPlayers: st.squadPlayers.map(p => {
              if (p.id !== alvo.id) return p
              const tipo = INJURY_TYPES[Math.floor(Math.random() * INJURY_TYPES.length)]
              return {
                ...p,
                injury: { type: tipo, severity: sev, weeksRemaining: semanas, startWeek: st.currentWeek },
                // O historico e escrito AQUI, junto com a lesao: separar os dois
                // criaria o caso de uma lesao existir sem registro.
                historicoDeLesoes: registrarLesao(p.historicoDeLesoes, {
                  tipo, severidade: sev, semana: st.currentWeek, duracao: semanas,
                }),
              }
            }),
          }))
        }
      },

      /**
       * ESTATISTICAS DE UM JOGO SIMULADO. Quando o usuario nao joga ao vivo, o
       * motor ao-vivo (que emite os eventos por jogador) nao roda — so temos o
       * PLACAR. Sem isto, JOGOS/GOLS/ASSIST do perfil ficavam 0 mesmo depois de
       * uma temporada inteira simulada.
       *
       * O jogo (matchesPlayed) e certo: todo titular apto disputou. Os gols e
       * assistencias do placar sao DISTRIBUIDOS entre os titulares ponderando
       * pela posicao e finalizacao — atacante marca muito mais que zagueiro —
       * para os totais da temporada baterem com o placar e ficarem plausiveis
       * por atleta. Cartoes saem de uma pequena chance por jogo.
       */
      acumularEstatisticasSimuladas: (golsPro, golsContra) => {
        set((s) => {
          const titulares = s.squadPlayers.filter(
            p => p.isStarter && !p.injury && (p.suspendedMatches ?? 0) <= 0,
          )
          if (titulares.length === 0) return {}

          // Peso de marcar/assistir por linha. Zagueiro nao fica em 0 (bola
          // parada existe), mas fica bem abaixo do atacante.
          const pesoGol = (pos: string) =>
            pos === "ATA" ? 10 : pos === "PE" || pos === "PD" ? 7
              : pos === "MEI" ? 5 : pos === "VOL" ? 2 : pos === "GOL" ? 0 : 1.2
          const pesoAssist = (pos: string) =>
            pos === "MEI" ? 9 : pos === "PE" || pos === "PD" ? 8 : pos === "ATA" ? 5
              : pos === "VOL" ? 4 : pos === "LD" || pos === "LE" ? 4 : pos === "GOL" ? 0 : 2

        const sortear = (pesoDe: (pos: string) => number): number | null => {
            const pesos = titulares.map(p => ({ id: p.id, peso: pesoDe(p.position) * (0.6 + (p.overall ?? 65) / 100) }))
            const soma = pesos.reduce((a, b) => a + b.peso, 0)
            if (soma <= 0) return null
            let r = Math.random() * soma
            return (pesos.find(x => (r -= x.peso) <= 0) ?? pesos[pesos.length - 1]).id
          }

          const golsPorId = new Map<number, number>()
          const assistsPorId = new Map<number, number>()
          for (let g = 0; g < golsPro; g++) {
            const artilheiro = sortear(pesoGol)
            if (artilheiro != null) golsPorId.set(artilheiro, (golsPorId.get(artilheiro) ?? 0) + 1)
            // ~65% dos gols tem assistencia, de outro jogador.
            if (Math.random() < 0.65) {
              const assistente = sortear(pesoAssist)
              if (assistente != null && assistente !== artilheiro) {
                assistsPorId.set(assistente, (assistsPorId.get(assistente) ?? 0) + 1)
              }
            }
          }

          const titularIds = new Set(titulares.map(p => p.id))
          return {
            squadPlayers: s.squadPlayers.map(p => {
              if (!titularIds.has(p.id)) return p
              const gols = golsPorId.get(p.id) ?? 0
              const assists = assistsPorId.get(p.id) ?? 0
              // Cartao: ~14% amarelo por jogo (volante/zaga um pouco mais), ~1% vermelho.
              const propAmarelo = p.position === "VOL" || p.position === "ZAG" ? 0.18 : 0.12
              const amarelo = Math.random() < propAmarelo ? 1 : 0
              const vermelho = Math.random() < 0.01 ? 1 : 0
              return {
                ...p,
                seasonStats: {
                  ...p.seasonStats,
                  matchesPlayed: (p.seasonStats.matchesPlayed ?? 0) + 1,
                  minutesPlayed: (p.seasonStats.minutesPlayed ?? 0) + 90,
                  goals: (p.seasonStats.goals ?? 0) + gols,
                  assists: (p.seasonStats.assists ?? 0) + assists,
                  yellowCards: (p.seasonStats.yellowCards ?? 0) + amarelo,
                  redCards: (p.seasonStats.redCards ?? 0) + vermelho,
                  cleanSheets: (p.seasonStats.cleanSheets ?? 0)
                    + (p.position === "GOL" && golsContra === 0 ? 1 : 0),
                },
              }
            }),
          }
        })
      },

      /** Ao entrar em campo, um jogo de suspensao e cumprido (decrementa). */
      cumprirSuspensao: (playerId) => {
        set((s) => ({
          squadPlayers: s.squadPlayers.map(p =>
            p.id === playerId && (p.suspendedMatches ?? 0) > 0
              ? { ...p, suspendedMatches: (p.suspendedMatches ?? 0) - 1 }
              : p),
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
      
      tratarLesao: (playerId, tratamento) => {
        const alvo = get().squadPlayers.find(p => p.id === playerId)
        const semanasAntes = alvo?.injury?.weeksRemaining ?? 0
        const { custo, fator } = TRATAMENTOS_MEDICOS[tratamento]
        const falha = (motivo: ResultadoDoTratamento["motivo"]): ResultadoDoTratamento =>
          ({ ok: false, motivo, custo: 0, semanasAntes, semanasDepois: semanasAntes })

        if (!alvo?.injury) return falha("sem-lesao")
        if (alvo.injury.tratamento) return falha("ja-tratado")
        // Cobra ANTES de mexer no prazo: se o caixa nao cobre, nada acontece.
        if (custo > 0 && !get().spendClubFunds(custo)) return falha("sem-dinheiro")

        // Piso de 1 semana: nenhum tratamento cura no mesmo instante em que e
        // contratado — senao a fisioterapia vira "curar por R$ 50 mil".
        const semanasDepois = Math.max(1, Math.round(semanasAntes * fator))
        set(s => ({
          squadPlayers: s.squadPlayers.map(p =>
            p.id === playerId && p.injury
              ? { ...p, injury: { ...p.injury, weeksRemaining: semanasDepois, tratamento } }
              : p,
          ),
        }))
        return { ok: true, custo, semanasAntes, semanasDepois }
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
      
      initializeGame: (teamShort, teamFileKey) => {
        /**
         * ⚠️ CARREIRA NOVA NÃO PODE HERDAR A ANTERIOR.
         *
         * Relato de jogador: "o jogo puxa históricos dos saves passados,
         * negociação com jogador por exemplo". O SAVE nascia limpo — quem não
         * nascia era o MOTOR: ele é um store persistido à parte, e este
         * `initializeGame` zerava semana, temporada, tabela e resultados, mas
         * deixava passar propostas, interesses de mercado, transferências
         * pendentes, conversas com atletas e atletas descobertos. O técnico
         * começava do zero com o mercado da carreira anterior em cima da mesa.
         *
         * O reset é pela lista FECHADA `CAMPOS_DO_CLUBE` — a mesma que o co-op
         * usa para trocar de técnico, e que já é conferida por teste contra o
         * estado real do motor. Zerar por enumeração à mão foi o que criou o
         * defeito: `scoutedLeads` estava na conta e os seis vizinhos não.
         * Assim, campo novo do motor entra no reset sozinho.
         */
        const limpos: Record<string, unknown> = {}
        const atual = get() as unknown as Record<string, unknown>
        for (const campo of CAMPOS_DO_CLUBE) {
          const valor = atual[campo]
          if (Array.isArray(valor)) limpos[campo] = []
          else if (valor && typeof valor === "object") limpos[campo] = {}
        }
        set(limpos as never)

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
        // `curto` não é identidade global: 134 códigos se repetem no banco.
        // A criação de carreira passa o file_key para o clube do pool não ser
        // trocado silenciosamente por um homônimo curado.
        const chosenTeam = (teamFileKey ? getTeamByFileKey(teamFileKey) : undefined)
          ?? getTeamByShort(teamShort)
        // DIVISAO EFETIVA (a de 2026 / a da piramide do save), nao o campo estatico
        // do cadastro. Os dois divergem em varios clubes — o ABC tem `serie_c`
        // gravado e joga a `serie_d` — e a carreira inteira nascia torta: salario,
        // valor de mercado e receita semanal calculados numa divisao, o calendario
        // e a tabela em outra. Aparecia como um tombo de receita na primeira virada
        // de temporada, quando o recalculo passava a usar a divisao certa.
        const chosenDivision = chosenTeam ? String(effectiveDivision(chosenTeam)) : "serie_a"
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
              nationality: sp.nac
                ?? (normalizeCountry(chosenTeam.pais) === PAIS_DESCONHECIDO
                  ? "Internacional"
                  : normalizeCountry(chosenTeam.pais)),
              // Atributos COERENTES com a posicao e reconciliados com o overall
              // (zagueiro: defesa alta/finalizacao baixa; atacante o inverso).
              // Antes so shooting respeitava a posicao; o resto saia cego a ela.
              ...atributosPorPosicao(base, position, sp.nome),
              // A escolha do EDITOR viaja junto. Sem ela o motor derivaria a
              // caracteristica do perfil de atributos e poderia discordar da
              // ficha que a tela mostra.
              ...(sp.traits?.length ? { traits: sp.traits } : {}),
              energy: 100,
              morale: "Normal" as const,
              form: base,
              contract: {
                // Salario realista por DIVISAO (Serie D em milhares, A em dezenas
                // de milhar). Antes base*800 pagava R$166 mil/mes a um jogador de D.
                salary: playerSalaryWeekly(base, chosenDivision),
                endDate: 52 + Math.floor(Math.random() * 104),
                releaseClause: base >= 80 ? playerMarketValue(base, chosenDivision) * 1.6 : null,
                signedWeek: 0,
                signedSeason: 2026
              },
              injury: null,
              seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
              training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
              nationalTeam: null,
              calledUp: false,
              marketValue: playerMarketValue(base, chosenDivision),
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
        // Receita operacional REALISTA por divisao e prestigio (TV + socios +
        // comercial). SEM piso: antes a receita era forcada a >= 108% da folha, o
        // que fazia TODO clube lucrar toda semana. Agora um clube pode operar no
        // vermelho — a bilheteria e o patrocinio (creditados por fora) ajudam a
        // fechar a conta, mas nao ha garantia. Salarios ja escalam por divisao.
        const initialWeeklyIncome = weeklyIncomeFor(chosenDivision, prestige)

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
            // `?? {}` nos DOIS ramos: o estado pode ter chegado sem o mapa
            // (save antigo, ou o retrato de clube que o co-op restaura inteiro,
            // que não passa pela re-hidratação). Sem isto, gravar uma função
            // devolvia `playerRoles` indefinido ao estado e a tela voltava a
            // quebrar na leitura seguinte.
            playerRoles: assignments.playerRoles
              ? { ...(state.tacticalAssignments?.playerRoles ?? {}), ...assignments.playerRoles }
              : state.tacticalAssignments?.playerRoles ?? {},
          },
        }))
      },

      setTacticalPlayerPositions: (positions) => {
        set({ tacticalPlayerPositions: positions })
      },

      /**
       * Grava a seta de movimentação E a traduz para as instruções que a
       * SIMULAÇÃO já lê. Sem esta tradução a seta seria enfeite: o motor não
       * sabe ler coordenada, sabe ler `getForward`, `holdPosition`, `stayWider`
       * e `cutInside`. No campo da prancheta y=0 é o gol adversário, então
       * subir (dy negativo) é avançar.
       */
      setTacticalPlayerMovements: (movements) => {
        const anteriores = get().tacticalPlayerMovements
        set({ tacticalPlayerMovements: movements })
        const base = get().tacticalPlayerPositions
        const porNome = new Map(get().squadPlayers.map(p => [p.name, p.id]))

        /**
         * ⚠️ APAGAR A SETA PRECISA APAGAR A INSTRUÇÃO QUE ELA GEROU.
         *
         * Este laço não existia, e era o relato do jogador: "não é possível
         * zerar a instrução depois de mexer nela uma vez". A tradução abaixo só
         * percorre as setas QUE EXISTEM; quem apagava a seta saía do mapa e
         * nunca mais era visitado, então `getForward`/`holdPosition`/
         * `stayWider`/`cutInside`/`roaming`/`runs` ficavam congelados no valor
         * derivado da seta antiga — para sempre, inclusive na simulação.
         *
         * Os valores abaixo são os MESMOS defaults de `setPlayerInstructions`:
         * sem seta, o atleta volta a ser neutro.
         */
        for (const nome of Object.keys(anteriores)) {
          if (nome in movements) continue
          const id = porNome.get(nome)
          if (id == null) continue
          get().setPlayerInstructions(id, {
            getForward: false,
            holdPosition: false,
            stayWider: false,
            cutInside: false,
            roaming: "liberdade_moderada",
            runs: "as_vezes",
          })
        }

        for (const [nome, destino] of Object.entries(movements)) {
          const id = porNome.get(nome)
          const origem = base[nome]
          if (id == null || !origem) continue
          const dx = destino.x - origem.x
          const dy = destino.y - origem.y
          const avanca = dy <= -6
          const recua = dy >= 6
          // Abrir = ir para a lateral mais próxima; fechar = ir para o miolo.
          const paraFora = Math.abs(destino.x - 50) - Math.abs(origem.x - 50) >= 6
          const paraDentro = Math.abs(destino.x - 50) - Math.abs(origem.x - 50) <= -6
          get().setPlayerInstructions(id, {
            getForward: avanca,
            holdPosition: recua,
            stayWider: paraFora,
            cutInside: paraDentro,
            // Seta longa = liberdade para se soltar; seta curta = posição.
            roaming: Math.hypot(dx, dy) >= 22 ? "liberdade_total"
              : Math.hypot(dx, dy) >= 10 ? "liberdade_moderada" : "ficar_posicao",
            runs: avanca ? "frequentemente" : recua ? "raramente" : "as_vezes",
          })
        }
      },
      
      analyzeOpponent: (teamShort: string) => {
        const state = get()
        const existing = state.opponentAnalyses.find(a => a.teamShort === teamShort)
        if (existing && existing.analysisProgress >= 100) return
        const team = getTeamByShort(teamShort)
        if (!team) return
        const squad = getPlayersForTeam(team)
        const average = (positions: string[]) => {
          const line = squad.filter(player => positions.includes(player.pos))
          return line.length ? line.reduce((sum, player) => sum + player.base, 0) / line.length : 0
        }
        const attack = average(["ATA", "CA", "SA", "PE", "PD"])
        const midfield = average(["VOL", "MEI", "MO", "MC", "ME", "MD"])
        const defense = average(["ZAG", "LD", "LE", "ALD", "ALE"])
        const results = state.matchResults.filter(result => result.homeTeam === teamShort || result.awayTeam === teamShort)
        const homeRecord = { w: 0, d: 0, l: 0 }
        const awayRecord = { w: 0, d: 0, l: 0 }
        let goalsFor = 0
        let goalsAgainst = 0
        for (const result of results) {
          const home = result.homeTeam === teamShort
          const scored = home ? result.homeScore : result.awayScore
          const conceded = home ? result.awayScore : result.homeScore
          goalsFor += scored
          goalsAgainst += conceded
          const record = home ? homeRecord : awayRecord
          if (scored > conceded) record.w++
          else if (scored < conceded) record.l++
          else record.d++
        }
        const strengths: string[] = []
        const weaknesses: string[] = []
        if (attack >= 78) strengths.push("Ataque de alto nível")
        if (midfield >= 78) strengths.push("Meio-campo de alto nível")
        if (defense >= 78) strengths.push("Defesa de alto nível")
        if (attack > 0 && attack < 72) weaknesses.push("Produção ofensiva limitada")
        if (midfield > 0 && midfield < 72) weaknesses.push("Meio-campo abaixo da média")
        if (defense > 0 && defense < 72) weaknesses.push("Linha defensiva vulnerável")

        const analysis: OpponentAnalysis = {
          teamShort,
          teamName: team.nome,
          analyzedWeek: state.currentWeek,
          analysisProgress: 100,
          // O jogo ainda não registra a formação usada pela IA em súmula.
          formation: null,
          mentality: attack - defense >= 3 ? "ofensivo" : defense - attack >= 3 ? "defensivo" : "equilibrado",
          keyPlayers: [...squad].sort((a, b) => b.base - a.base).slice(0, 4).map(player => ({ name: player.nome, position: player.pos, threat: player.base })),
          weaknesses,
          strengths,
          avgGoalsScored: results.length ? goalsFor / results.length : 0,
          avgGoalsConceded: results.length ? goalsAgainst / results.length : 0,
          homeRecord,
          awayRecord,
        }
        set(s => ({
          opponentAnalyses: existing
            ? s.opponentAnalyses.map(item => item.teamShort === teamShort ? analysis : item)
            : [...s.opponentAnalyses, analysis],
        }))
      },
      
      updateOpponentAnalysis: () => {
        // Mantida por compatibilidade com saves/telas antigas. A análise agora
        // é calculada integralmente a partir do elenco e das súmulas em analyzeOpponent.
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

      performGroupAction: (action) => {
        const state = get()
        const lastUsed = (state.groupActionCooldowns ?? {})[action.id]
        if (lastUsed != null && state.currentWeek - lastUsed < action.cooldown) return false

        const newEvent: MoraleEvent = {
          type: "elogio",
          description: action.description,
          impact: action.impact,
          week: state.currentWeek,
        }
        set(s => ({
          groupActionCooldowns: { ...(s.groupActionCooldowns ?? {}), [action.id]: s.currentWeek },
          squadMorale: {
            ...s.squadMorale,
            overall: Math.max(0, Math.min(100, s.squadMorale.overall + action.impact)),
            confidence: Math.max(0, Math.min(100, s.squadMorale.confidence + action.impact * 0.7)),
            unity: Math.max(0, Math.min(100, s.squadMorale.unity + Math.max(1, Math.round(action.impact * 0.45)))),
            recentEvents: [newEvent, ...s.squadMorale.recentEvents.slice(0, 9)],
          },
        }))
        return true
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
          },

          // ── MERCADO E BASTIDORES ────────────────────────────────────────────
          // O pool inteiro falava de partida, tatica e lesao. Nada de mercado,
          // nada de dinheiro — justo os assuntos que a imprensa mais persegue, e
          // agora tambem os sistemas de agente e patrocinio.
          {
            id: 21,
            type: "transfer",
            question: "O empresario de um atleta seu disse publicamente que ele quer sair. Procede?",
            options: [
              { text: "Conversei com o atleta. Ele fica e esta comprometido.", tone: "positivo", impact: 4 },
              { text: "Toda negociacao tem ruido. Trato isso internamente.", tone: "neutro", impact: 1 },
              { text: "Quem nao quiser vestir a camisa pode procurar outro clube.", tone: "agressivo", impact: -2 }
            ]
          },
          {
            id: 22,
            type: "transfer",
            question: "Um titular entra nos ultimos meses de contrato. Vai renovar?",
            options: [
              { text: "A proposta ja esta na mesa. Ele e prioridade.", tone: "positivo", impact: 5 },
              { text: "Estamos conversando. Nao vou negociar pela imprensa.", tone: "neutro", impact: 1 },
              { text: "Se ele quisesse ficar, ja teria assinado.", tone: "negativo", impact: -4 }
            ]
          },
          {
            id: 23,
            type: "transfer",
            question: "A torcida cobra reforcos. O clube vai gastar nesta janela?",
            options: [
              { text: "Vamos investir. O elenco precisa de qualidade.", tone: "positivo", impact: 3 },
              { text: "So chega quem melhorar o grupo de verdade.", tone: "neutro", impact: 2 },
              { text: "Nao ha dinheiro. Vamos com o que temos.", tone: "negativo", impact: -3 }
            ]
          },
          {
            id: 24,
            type: "transfer",
            question: "Um clube grande sondou seu principal jogador. Ele tem preco?",
            options: [
              { text: "Nao esta a venda. Ponto final.", tone: "agressivo", impact: 3 },
              { text: "Todo mundo tem preco. Depende da proposta.", tone: "neutro", impact: 0 },
              { text: "Se a oferta for boa, o clube precisa do dinheiro.", tone: "negativo", impact: -4 }
            ]
          },
          {
            id: 25,
            type: "transfer",
            question: "Voce perdeu um atleta de graca por fim de contrato. Falha de gestao?",
            options: [
              { text: "Assumo. Era para termos resolvido antes.", tone: "neutro", impact: 2 },
              { text: "A decisao foi dele. Oferecemos o que podiamos.", tone: "neutro", impact: 0 },
              { text: "Pergunte a diretoria, nao a mim.", tone: "agressivo", impact: -5 }
            ]
          },
          {
            id: 26,
            type: "transfer",
            question: "O clube fechou um patrocinio maior. Esse dinheiro vira reforco?",
            options: [
              { text: "Vira elenco. Foi para isso que buscamos o contrato.", tone: "positivo", impact: 4 },
              { text: "Primeiro equilibra a folha, depois pensamos em chegar.", tone: "neutro", impact: 1 },
              { text: "Nao me meto em dinheiro. Cuido do time.", tone: "neutro", impact: -1 }
            ]
          },
          {
            id: 27,
            type: "transfer",
            question: "Um patrocinador cobrou publicamente melhores resultados. Incomoda?",
            options: [
              { text: "Quem investe tem o direito de cobrar. Cobro mais de mim.", tone: "positivo", impact: 3 },
              { text: "Cada um faz o seu trabalho. O meu e dentro de campo.", tone: "neutro", impact: 1 },
              { text: "Nao trabalho sob pressao de patrocinador.", tone: "agressivo", impact: -3 }
            ]
          },
          {
            id: 28,
            type: "player",
            question: "Um reserva reclamou de falta de minutos. O que responde?",
            options: [
              { text: "Ele tem razao em querer jogar. Vai ter chance.", tone: "positivo", impact: 3 },
              { text: "Quem treina bem joga. E simples assim.", tone: "neutro", impact: 1 },
              { text: "Quem escala sou eu. Se nao gostou, a porta e larga.", tone: "agressivo", impact: -4 }
            ]
          },
          {
            id: 29,
            type: "transfer",
            question: "Sobre a folha salarial: o clube paga acima do que arrecada?",
            options: [
              { text: "Estamos ajustando com responsabilidade.", tone: "neutro", impact: 2 },
              { text: "Investir em elenco e investir em resultado.", tone: "positivo", impact: 1 },
              { text: "Essa conta nao e minha.", tone: "negativo", impact: -4 }
            ]
          },
          {
            id: 30,
            type: "transfer",
            question: "A base tem revelado nomes. Vai apostar neles em vez de contratar?",
            options: [
              { text: "Quem tiver nivel joga, tenha 18 ou 32 anos.", tone: "positivo", impact: 5 },
              { text: "A base complementa, nao substitui o mercado.", tone: "neutro", impact: 1 },
              { text: "Garoto nao ganha campeonato.", tone: "negativo", impact: -3 }
            ]
          }
        ]

        // SORTEIO DE VERDADE. Era `sort(() => Math.random() - 0.5)`, que nao
        // embaralha: o comparador aleatorio viola a transitividade que o `sort`
        // pressupoe e o resultado fica preso perto da ordem original. Com 30
        // perguntas e so 3 escolhidas, as primeiras do pool apareciam muito mais
        // — e as dez novas, no fim da lista, quase nunca sairiam.
        // ⚠️ A IMPRENSA PERGUNTAVA A MESMA COISA A TODA MODALIDADE (1.0.347).
        //
        // O pool acima e de clube profissional masculino: briga por titulo,
        // mercado, pressao da torcida. Perguntado a quem dirige o Sub-20, soa
        // como se ninguem na sala soubesse que aquilo e uma equipe de formacao —
        // e essa era a maior fonte da sensacao de "modalidade de segunda".
        //
        // Estas perguntas ENTRAM no mesmo sorteio, entao a coletiva continua
        // variada; o que muda e que agora ela reconhece onde esta.
        const modalidade = modalidadeAtual()
        if (modalidade === "sub20") {
          questionPool.push(
            {
              id: 9101, type: "match",
              question: "Quantos desses garotos o senhor ve jogando no profissional?",
              options: [
                { text: "Tenho pelo menos tres prontos para subir.", tone: "positivo", impact: 4 },
                { text: "Formar leva tempo. Nao vou queimar ninguem.", tone: "neutro", impact: 1 },
                { text: "Nao e disso que eu cuido aqui.", tone: "negativo", impact: -5 },
              ],
            },
            {
              id: 9102, type: "match",
              question: "Vale sacrificar o titulo da categoria para dar minutos a quem precisa?",
              options: [
                { text: "Vale. Eles estao aqui para se formar.", tone: "positivo", impact: 3 },
                { text: "Da para fazer os dois com equilibrio.", tone: "neutro", impact: 1 },
                { text: "Aqui se joga para ganhar, como em qualquer lugar.", tone: "agressivo", impact: -2 },
              ],
            },
          )
        } else if (modalidade === "feminino") {
          questionPool.push(
            {
              id: 9201, type: "match",
              question: "O publico do departamento cresceu. Isso muda a cobranca sobre o time?",
              options: [
                { text: "Muda para melhor: elas merecem casa cheia.", tone: "positivo", impact: 4 },
                { text: "A cobranca ja existia dentro do vestiario.", tone: "neutro", impact: 1 },
                { text: "Publico nao ganha jogo.", tone: "negativo", impact: -3 },
              ],
            },
            {
              id: 9202, type: "match",
              question: "O clube investe o suficiente na estrutura da equipe feminina?",
              options: [
                { text: "Temos o que precisamos para competir.", tone: "positivo", impact: 2 },
                { text: "Sempre da para melhorar, e estamos conversando.", tone: "neutro", impact: 0 },
                { text: "Nao. E isso precisa ser dito.", tone: "agressivo", impact: -4 },
              ],
            },
          )
        }

        const shuffled = [...questionPool]
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        const selectedQuestions = shuffled.slice(0, 3)
        
        set({ nextPressConference: selectedQuestions, currentConferenceResponses: [] })
      },
      
      respondToPressConference: (questionId: number, optionIndex: number) => {
        const state = get()
        if (!state.nextPressConference) return

        const question = state.nextPressConference.find(q => q.id === questionId)
        if (!question) return

        // Impede clique duplo de aplicar o mesmo efeito duas vezes.
        if (state.currentConferenceResponses.some(response => response.questionId === questionId)) return

        const option = question.options[optionIndex]
        if (!option) return

        get().addMoraleEvent({
          type: option.tone === "positivo" ? "elogio" : option.tone === "negativo" ? "conflito" : "elogio",
          description: `Conferencia: "${option.text}"`,
          impact: option.impact
        })

        const newResponse = { questionId, selectedOption: optionIndex, impact: option.impact }

        set((s) => {
          const accumulated = [...s.currentConferenceResponses, newResponse]
          const questions = s.nextPressConference ?? []
          const remaining = questions.filter(q => !accumulated.some(response => response.questionId === q.id))
          const isLast = remaining.length === 0

          return {
            // Mantemos o conjunto completo enquanto a coletiva esta aberta.
            // Assim o historico consegue persistir as perguntas realmente feitas.
            nextPressConference: isLast ? null : questions,
            currentConferenceResponses: isLast ? [] : accumulated,
            pressConferences: isLast
              ? [...s.pressConferences, {
                  week: s.currentWeek,
                  questions,
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
        
        // Nota de DESEMPENHO precisa vir de partida. Overall e forma nao sao
        // uma sumula e nao podem ser apresentados como se fossem nota media.
        // Saves antigos podem nao ter a serie historica; nesse caso exibimos 0
        // (a UI traduz para "sem registro") em vez de fabricar uma avaliacao.
        const avgRating = player.avgMatchRating ?? player.lastMatchRating ?? 0
        const avaliados = state.squadPlayers.filter(p => (p.avgMatchRating ?? p.lastMatchRating) != null)
        const mediaElenco = avaliados.length
          ? avaliados.reduce((soma, p) => soma + (p.avgMatchRating ?? p.lastMatchRating ?? 0), 0) / avaliados.length
          : 0
        const mesmaPosicao = avaliados.filter(p => p.position === player.position)
        const mediaPosicao = mesmaPosicao.length
          ? mesmaPosicao.reduce((soma, p) => soma + (p.avgMatchRating ?? p.lastMatchRating ?? 0), 0) / mesmaPosicao.length
          : 0
        const diferencaPercentual = (valor: number, referencia: number) =>
          valor > 0 && referencia > 0 ? Math.round(((valor - referencia) / referencia) * 100) : 0
        
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
          // O motor ainda nao guarda uma serie por periodo. Inventar a variacao
          // com Math.random fazia o mesmo atleta "melhorar" ao reabrir a tela.
          vsLastPeriod: 0,
          vsSquadAvg: diferencaPercentual(avgRating, mediaElenco),
          vsPositionAvg: diferencaPercentual(avgRating, mediaPosicao),
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
        // Mesma regra do lesionado para o EXPULSO/suspenso: quem nao jogou nao
        // pode aparecer como melhor nem como pior da partida.
        const sortedPlayers = [...state.squadPlayers]
          .filter(p => !p.injury && (p.suspendedMatches ?? 0) <= 0)
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
        // ⚠️ UM CONTRATO ATIVO POR TIPO. Sem esta linha, cada chamada criava um
        // contrato novo e creditava o `upfrontPayment` outra vez — de R$ 2 a
        // R$ 12 milhões, sem limite. Hoje nenhuma tela chama esta função, então
        // o dinheiro infinito era LATENTE: bastaria ligar um botão a ela para
        // publicar o exploit sem que ninguém tivesse escrito uma linha errada.
        // Defeito que só existe quando alguém usa a função continua sendo
        // defeito, e sai mais barato fechar agora.
        if (state.marketingContracts.some(c => c.type === type && c.active)) return
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
        const template = staffCandidatesForSeason(state.currentSeason).find(s => s.id === staffId)
        if (!template) return
        // Nao pode ter dois no mesmo cargo
        if (state.staffMembers.some(s => s.role === template.role)) return
        const member: StaffMember = {
          ...template,
          hiredWeek: state.currentWeek,
          hiredSeason: state.currentSeason,
          potential: template.potential ?? Math.min(96, template.competence + 6),
          experienceWeeks: 0,
          contractEndSeason: state.currentSeason + 3,
          marketInterest: 0,
        }
        set((s) => ({
          staffMembers: [...s.staffMembers, member],
          weeklyExpenses: s.weeklyExpenses + member.salary,
        }))
      },

      renewStaffContract: (staffId: number) => {
        const state = get()
        const member = state.staffMembers.find(item => item.id === staffId)
        if (!member) return false
        const interest = member.marketInterest ?? 0
        const signingBonus = Math.round(member.salary * (8 + interest / 20))
        if (state.balance < signingBonus) return false
        const newSalary = Math.round(member.salary * (1.04 + interest / 500) / 500) * 500
        set(current => ({
          balance: current.balance - signingBonus,
          weeklyExpenses: current.weeklyExpenses + (newSalary - member.salary),
          staffMembers: current.staffMembers.map(item => item.id === staffId ? {
            ...item,
            salary: newSalary,
            contractEndSeason: current.currentSeason + 3,
            marketInterest: 0,
            loyalty: Math.min(100, item.loyalty + 8),
          } : item),
        }))
        return true
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

      processSeasonEnd: (nextSeason: number, newStandings: StandingsEntry[], lastSeasonStandings: StandingsEntry[], prestigio?: { antes?: PrestigioDosAtletas; depois?: PrestigioDosAtletas }) => {
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
            // PERSONA molda o desenvolvimento (realismo FM): determinacao e
            // profissionalismo altos aceleram o jovem rumo ao potencial; baixos
            // fazem o talento "se perder". E por isso que dois jovens de mesmo
            // potencial evoluem diferente.
            const persona = p.persona ?? gerarPersona(p.id, p.overall)
            const fatorPersona = 0.7 + ((persona.determinacao + persona.profissionalismo) / 40) * 0.9 // ~0.7-1.6
            if (age <= 23 && margem > 0) {
              const jogos = p.seasonStats?.matchesPlayed ?? 0
              const ritmo = age <= 19 ? 4 : age <= 21 ? 3 : 2
              const ganhoBase = ritmo + Math.floor(jogos / 12)
              // A ESCALA RESISTE NO TOPO (1.0.298). Subir de 50 para 60 e uma
              // temporada boa; de 90 para 95, uma carreira inteira. Antes o
              // ganho so dependia da idade e do potencial, entao um garoto de 19
              // com potencial 95 andava de 88 para 92 no mesmo passo com que
              // andaria de 58 para 62 — e a diferenca entre um bom jogador e um
              // fenomeno virava so uma questao de tempo.
              //
              // O piso de 1 ponto tambem cai a partir de 82: acima disso a
              // temporada pode nao render NADA, que e o que faz "estagnou" ser
              // um destino possivel em vez de um degrau garantido por ano.
              const resistencia = p.overall >= 88 ? 0.25
                : p.overall >= 82 ? 0.45
                  : p.overall >= 75 ? 0.7
                    : p.overall >= 65 ? 0.9 : 1
              const piso = p.overall >= 82 ? 0 : 1
              const ganho = Math.min(margem, Math.max(piso, Math.round(ganhoBase * fatorPersona * resistencia)))
              overall = Math.min(p.potential, p.overall + ganho)
            } else if (age >= 32) {
              // Declinio do veterano — mais forte a cada ano apos os 32. Antes o
              // piso era `potential-12` (um craque de potencial 90 nunca caia de
              // 78, irreal); agora o veterano de fato desbota, ate um piso baixo.
              const cai = (age >= 36 ? 3 : age >= 34 ? 2 : 1) - (persona.profissionalismo >= 15 ? 1 : 0)
              overall = Math.max(42, p.overall - Math.max(0, cai))
            }
            // Overall mudou -> desloca os atributos para acompanhar (mantem overall
            // e atributos reconciliados; senao voltariam a divergir).
            const deltaOverall = overall - p.overall
            // A virada de ano distribui o delta com VIES POR IDADE: o veterano
            // perde as pernas antes da cabeca, o jovem cresce mais em tecnica do
            // que em fisico. `shiftAttributes` somava o mesmo numero em tudo.
            const attrsAjustados = deltaOverall !== 0
              ? evoluirAtributos(
                  { pace: p.pace, shooting: p.shooting, passing: p.passing, dribbling: p.dribbling, defending: p.defending, physical: p.physical },
                  p.position, deltaOverall, age,
                )
              : null
            return {
              ...p,
              age,
              overall,
              ...(attrsAjustados ?? {}),
              persona,
              seasonYellows: 0, // zera o acumulo de cartoes a cada temporada
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
            // PRESTIGIO NO PRECO (1.0.298). Comprar um Top Mundial e comprar um
            // NOME, e isso custa acima do que o overall dele sozinho pediria.
            //
            // ⚠️ Aplicado sobre o valor JA REESCALADO do ano anterior, e nao
            // acumulado: quem era estrela na temporada passada e continua estrela
            // nesta paga o mesmo 1,35, nao 1,35². Por isso a razao entre o nivel
            // de agora e o de antes, e nao o multiplicador cru.
            const nivelAgora = prestigioDe(prestigio?.depois, p.id)
            const nivelAntes = prestigioDe(prestigio?.antes, p.id)
            const ajuste = multiplicadorDeValor(nivelAgora) / multiplicadorDeValor(nivelAntes)
            return { ...p, marketValue: Math.round(p.marketValue * mult * ajuste) }
          })

          // Gera jovens da base para substituir aposentados. A academia de base e
          // clubInfrastructure.youth (nivel 1-5). Antes lia infrastructure.
          // youthAcademyLevel — campo inexistente — e caia sempre no default 2,
          // entao a academia NAO afetava os jovens do fim de temporada.
          const youthAcadLevel = s.clubInfrastructure?.youth ?? 2
          // Divisao do clube: o salario destes garotos precisa dela (ver o
          // contrato deles, mais abaixo).
          // DIVISAO EFETIVA, nao a estatica do cadastro: quem subiu ou caiu tem a
          // divisao nova no `clubDivisions` do save (piramide viva). Ler o campo
          // cru fazia o clube seguir para sempre com a divisao de estreia.
          const timeDoClube = getTeamByShort(s.myTeamShort ?? "")
          const divisaoDoClube = timeDoClube
            ? String(effectiveDivision(timeDoClube))
            : "serie_a"
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
          const paisDaBase = normalizeCountry(timeDoClube?.pais)
          const baseEstrangeira = paisDaBase !== "Brasil" && paisDaBase !== PAIS_DESCONHECIDO
          const FALLBACK_POSITIONS = ["GOL","ZAG","ZAG","LAT","LAT","VOL","VOL","MEI","MEI","ATA","PD","PE"]
          // ⚠️ IMPRESSORA DE DINHEIRO — leia antes de mexer.
          //
          // Isto reenchia o elenco ate 18 DE GRACA no fim de cada temporada. O
          // ciclo era: vender o elenco inteiro, avancar a temporada, receber 18
          // atletas do nada, vender tudo de novo. Dinheiro infinito, e tambem o
          // "do nada aparecem jogadores aleatorios no time" que o jogador
          // relatou. As duas correcoes anteriores da base nao pegaram porque o
          // vazamento nunca esteve na tela da base — estava aqui.
          //
          // O que continua valendo: repor quem SE APOSENTOU. Isso e reposicao,
          // nao criacao de valor — o atleta saiu do elenco.
          //
          // O que muda: quem VENDEU o elenco nao ganha elenco novo. Sobra so uma
          // rede de seguranca para o save nao virar injogavel (sem 11 atletas nao
          // da nem para escalar), e esses emergenciais valem ZERO no mercado, de
          // modo que revende-los nao rende nada.
          // O piso era 11 — exatamente o minimo para escalar, sem banco e sem
          // cobertura: um lesionado ja deixava o time impossivel de montar.
          // ELENCO_MINIMO (18) e o mesmo numero que o qa-smoke cobra de "elenco
          // jogavel". Subir o piso NAO reabre a impressora de dinheiro: o
          // emergencial continua valendo 0 no mercado (ver `marketValue` abaixo).
          const reposicaoDeAposentados = retiredPositions.length
          const emergenciais = Math.max(
            0,
            ELENCO_MINIMO - (playersWithMarketUpdate.length + reposicaoDeAposentados),
          )
          const needed = reposicaoDeAposentados + emergenciais
          const baseMin = 55 + youthAcadLevel * 3 + coordBonus
          const baseRange = 10 + youthAcadLevel * 2
          const potentialBonus = youthAcadLevel * 3 + coordBonus

          const youthPlayers: Player[] = Array.from({ length: needed }).map((_, i) => {
            const nomeCompleto = baseEstrangeira
              ? nomeDeAtleta(paisDaBase, Math.random)
              : `${region.names[Math.floor(Math.random() * region.names.length)]} ${YOUTH_SURNAMES[Math.floor(Math.random() * YOUTH_SURNAMES.length)]}`
            const pos = retiredPositions[i] ?? FALLBACK_POSITIONS[i % FALLBACK_POSITIONS.length]
            const age = 17 + Math.floor(Math.random() * 4)
            const base = Math.min(82, baseMin + Math.floor(Math.random() * baseRange))
            const potential = Math.min(95, base + 8 + potentialBonus + Math.floor(Math.random() * 12))
            const nationality = baseEstrangeira
              ? paisDaBase
              : region.nationality === "Misto"
                ? (Math.random() > 0.5 ? "Brasil" : "Internacional")
                : region.nationality
            return {
              id: Date.now() + i * 7 + 5000,
              name: nomeCompleto,
              position: pos,
              age,
              overall: base,
              potential,
              nationality,
              // Atributos por posicao, reconciliados com o overall (como no elenco).
              ...atributosPorPosicao(base, pos, nomeCompleto),
              energy: 100,
              morale: "Motivado" as const,
              form: base - 5,
              contract: {
                // MESMA conta do botao PROMOVER (ver `youthPromotionSalaryWeekly`).
                // Era `base * 400`: salario de profissional, cego a divisao e sem
                // o desconto de cria. Este e o caminho AUTOMATICO — o garoto entra
                // no elenco no virar da temporada sem ninguem clicar em nada —,
                // entao a folha da Serie C/D estourava sozinha a cada ano.
                salary: youthPromotionSalaryWeekly(base, divisaoDoClube),
                // ⚠️ SEMANA ABSOLUTA. Com `78 + random*78` cru, a partir de 2029
                // o proprio garoto da rede de seguranca ja nascia com o contrato
                // vencido (absoluteWeek(2029,0) = 156) e sumia no primeiro
                // advanceWeek — a rede desfazia a si mesma em silencio.
                endDate: absoluteWeek(nextSeason, 0) + 78 + Math.floor(Math.random() * 78),
                releaseClause: null,
                signedWeek: 0,
                signedSeason: nextSeason
              },
              injury: null,
              seasonStats: { goals: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 0, minutesPlayed: 0, cleanSheets: 0, manOfTheMatch: 0 },
              training: { currentFocus: null, weeksTrained: 0, lastTrainingWeek: 0 },
              nationalTeam: null,
              calledUp: false,
              // Emergencial (indice alem da reposicao de aposentados) nao tem valor
              // de mercado: ele existe so para o time conseguir entrar em campo.
              // Com valor, a rede de seguranca voltaria a ser impressora.
              marketValue: i < reposicaoDeAposentados ? base * 80000 : 0,
              joinedClubWeek: 0,
              joinedClubSeason: nextSeason,
              isLoanedIn: false,
              statusEffects: [],
            }
          })

          // A folha tem de acompanhar o elenco. Aposentado saindo sem devolver
          // salario e reposicao entrando sem cobrar faziam `weeklyExpenses`
          // descolar do elenco a cada temporada — sempre para mais, e sem volta.
          // Ajustamos pela DIFERENCA exata entre a folha nova e a antiga.
          const elencoNovo = [...playersWithMarketUpdate, ...youthPlayers]
          const ajusteDaFolha = folhaSemanal(elencoNovo) - folhaSemanal(s.squadPlayers)

          // RECEITA RECORRENTE ACOMPANHA A DIVISAO.
          //
          // `weeklyIncome` era calculado UMA vez, no `initializeGame`, e nunca mais.
          // O clube subia da Serie D a Serie A e continuava recebendo como Serie D
          // (e vice-versa) — acesso e rebaixamento nao tinham consequencia no caixa
          // semanal, so na premiacao de fim de temporada. Recalculamos aqui, com a
          // divisao EFETIVA da temporada que comeca.
          const receitaSemanal = weeklyIncomeFor(divisaoDoClube, timeDoClube?.prestigio ?? 50)

          return {
            squadPlayers: elencoNovo,
            weeklyExpenses: Math.max(0, s.weeklyExpenses + ajusteDaFolha),
            weeklyIncome: receitaSemanal,
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
      version: GAME_ENGINE_PERSIST_VERSION,
      migrate: (persistedState, version) => {
        let state = persistedState as Partial<GameEngineState>
        if (!Array.isArray(state.squadPlayers)) return state as GameEngineState

        // v2 -> v3: v2 convertia CA (centroavante) em MEI ao criar o elenco.
        // Repara somente esse sentido inequívoco da conversão, preservando
        // edições manuais de posição feitas pelo usuário em qualquer outro
        // jogador.
        //
        // O `return` daqui virou encadeamento: com ele, um save v2 pularia a
        // migração v4 abaixo.
        if (version < 3) {
          state = {
            ...state,
            squadPlayers: state.squadPlayers.map((player: Player) => {
              const canonical = getCanonicalSeedPosition(player.name)
              return player.position === "MEI" && canonical === "ATA"
                ? { ...player, position: "ATA" }
                : player
            }),
          }
        }

        // v3 -> v4: `isStarter` nasceu opcional e saves antigos não o têm.
        //
        // Sem ele, `available.filter(p => p.isStarter === true)` devolvia lista
        // VAZIA na hora da partida, o motor caía no remonte automático e a
        // escalação do treinador nunca valia — nem no primeiro jogo, sem
        // desfalque nenhum. É a mesma queixa de "salvo e os jogadores que tirei
        // continuam jogando", por uma terceira porta: o próprio relator suspeitou
        // ("será que é por ser save antigo?").
        //
        // Marcamos um XI plausível em vez de deixar tudo `undefined`, para a tela
        // abrir com titulares de verdade. Quem JÁ tem escalação salva não é
        // tocado — só preenchemos quando ninguém está marcado.
        if (version < 4) {
          const jogadores = state.squadPlayers as Player[]
          const alguemMarcado = jogadores.some(p => p.isStarter === true)
          if (!alguemMarcado && jogadores.length > 0) {
            const aptos = jogadores.filter(p => !p.injury)
            const base = aptos.length >= 11 ? aptos : jogadores
            const { starters } = pickStartingXI(base, (p) => p.position, (p) => p.overall)

            // REDE DE SEGURANÇA: `pickStartingXI` encaixa por slot de formação e
            // devolve MENOS de 11 quando o elenco não tem as posições certas. Sem
            // isto a migração podia deixar o save sem titular nenhum — o mesmo
            // problema que ela existe para resolver. Um XI imperfeito é melhor do
            // que nenhum: o treinador ajusta na tela.
            const titulares = new Set(starters.map(p => p.id))
            if (titulares.size < Math.min(11, base.length)) {
              for (const p of [...base].sort((a, b) => b.overall - a.overall)) {
                if (titulares.size >= Math.min(11, base.length)) break
                titulares.add(p.id)
              }
            }

            state = {
              ...state,
              squadPlayers: jogadores.map(p => ({ ...p, isStarter: titulares.has(p.id) })),
            }
          } else {
            // Já havia escalação: só normaliza o campo ausente para false, para
            // `isStarter === true` passar a ser uma comparação confiável.
            state = {
              ...state,
              squadPlayers: jogadores.map(p => ({ ...p, isStarter: p.isStarter === true })),
            }
          }
        }

        // v4 -> v5: CONTRATO GRAVADO NA BASE ERRADA DE TEMPO.
        //
        // `contract.endDate` e `loanEndWeek` sao conferidos contra
        // `absoluteWeek(season, week)`, mas quatro gravadores usavam `currentWeek`,
        // que ZERA a cada temporada: promover da base, contratar emprestado, a
        // chegada da fila de transferencias e a renovacao de emprestimo. O atleta
        // nascia com um vencimento no passado e saia de graca na semana seguinte.
        //
        // O reparo e possivel porque o contrato guarda `signedWeek`/`signedSeason`:
        // se o fim e ANTERIOR ao proprio momento da assinatura, o numero so pode
        // ter sido escrito na base relativa. Rebasamos preservando a DURACAO
        // acordada (`endDate - signedWeek`). Contrato legitimamente vencido tem
        // fim posterior a assinatura e nao e tocado.
        if (version < 5) {
          const rebase = (fim: number | undefined, assinaturaSemana: number, assinaturaTemporada: number) => {
            if (fim == null) return fim
            const assinaturaAbsoluta = absoluteWeek(assinaturaTemporada, assinaturaSemana)
            if (fim >= assinaturaAbsoluta) return fim          // ja estava absoluto
            return assinaturaAbsoluta + Math.max(0, fim - assinaturaSemana)
          }
          state = {
            ...state,
            squadPlayers: (state.squadPlayers as Player[]).map(p => {
              const assinaturaSemana = p.contract?.signedWeek ?? p.joinedClubWeek ?? 0
              const assinaturaTemporada = p.contract?.signedSeason ?? p.joinedClubSeason ?? CONTRACT_EPOCH_SEASON
              return {
                ...p,
                loanEndWeek: rebase(p.loanEndWeek, assinaturaSemana, assinaturaTemporada),
                contract: p.contract
                  ? { ...p.contract, endDate: rebase(p.contract.endDate, assinaturaSemana, assinaturaTemporada) ?? p.contract.endDate }
                  : p.contract,
              }
            }),
          }
        }

        return state as GameEngineState
      },
      /**
       * ⚠️ SAVE ANTIGO CHEGA SEM OS MAPAS QUE AS TELAS INDEXAM — E A TELA CRASHA.
       *
       * Relato: "/elenco/gerenciamento/ — Cannot read properties of undefined
       * (reading 'Gabriel Batista')", em TODOS os clubes. O nome do atleta na
       * mensagem é a pista: alguém fez `mapa[jogador.nome]` com `mapa`
       * indefinido. Era `tacticalAssignments.playerRoles`, que passou a existir
       * junto com as funções individuais — em save gravado ANTES disso a chave
       * simplesmente não está lá.
       *
       * Por que o `migrate` acima não resolve: ele só roda quando a versão
       * persistida é MENOR que a atual. Campo novo acrescentado sem bump de
       * versão entra num save que o zustand considera atualizado, e o merge do
       * persist é RASO — o `tacticalAssignments` do disco substitui o objeto
       * padrão inteiro, levando embora o `playerRoles: {}` que o padrão tinha.
       * Nenhuma migração corrige um save que não é migrado.
       *
       * Aqui a rede é por classe, não por linha: todo mapa de estado tático que
       * as telas leem por chave nasce vazio quando falta. Preencher com vazio é
       * semanticamente igual a "nada definido" — não inventa configuração
       * nenhuma, só impede que a ausência vire tela de erro.
       */
      onRehydrateStorage: () => (state) => {
        if (!state) return
        // Campo a campo, sem espalhar o objeto do disco por cima de um padrão:
        // o espalhamento repetiria as mesmas chaves e o TypeScript reprova
        // (TS2783) — com razão, porque a ordem de quem vence fica implícita.
        // Aqui o valor do disco vence explicitamente, e a falta vira vazio.
        const taticas = state.tacticalAssignments
        state.tacticalAssignments = {
          corner: taticas?.corner ?? "",
          freeKick: taticas?.freeKick ?? "",
          freeKickLeft: taticas?.freeKickLeft ?? "",
          freeKickRight: taticas?.freeKickRight ?? "",
          penalty: taticas?.penalty ?? "",
          captain: taticas?.captain ?? "",
          playerRoles: taticas?.playerRoles ?? {},
        }
        state.tacticalPlayerPositions = state.tacticalPlayerPositions ?? {}
        state.tacticalPlayerMovements = state.tacticalPlayerMovements ?? {}
        state.playerInstructions = state.playerInstructions ?? {}
        state.setPieceTakers = state.setPieceTakers ?? {}
        // Cláusulas do negócio (1.0.383): save anterior não tem os dois vetores, e
        // o merge do persist é RASO — sem isto, a primeira semana avançada em
        // carreira antiga quebraria em `.filter` de `undefined`.
        state.parcelasDeTransferencia = state.parcelasDeTransferencia ?? []
        state.recompras = state.recompras ?? []
        // ⚠️ MORAL DO ELENCO: CAMPO NOVO EM OBJETO ANTIGO DERRUBA A TELA.
        //
        // `recentEvents` entrou depois de muita carreira ja existir. Em quem
        // salvou antes, `squadMorale` chega do disco SEM ele, e o vestiario
        // quebrava em "Cannot read properties of undefined (reading 'length')" —
        // a tela inteira em branco, sem mensagem util. Normalizar aqui conserta
        // todas as telas que leem moral de uma vez, em vez de cada uma se
        // defender por conta propria. Achado pela auditoria de telas (qa:audit).
        const moral = state.squadMorale
        state.squadMorale = {
          overall: moral?.overall ?? 75,
          unity: moral?.unity ?? 70,
          confidence: moral?.confidence ?? 70,
          recentEvents: moral?.recentEvents ?? [],
        }
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
  storeSet(
    getCareerScopedKey("ultrafoot-game-engine"),
    JSON.stringify({ state, version: GAME_ENGINE_PERSIST_VERSION }),
  )
}

/**
 * Salva titulares e formacao de uma vez, evitando um radar ler um estado intermediario.
 *
 * Recebe os IDS do motor (resolvidos por `resolverIdsDosTitulares`), nao nomes.
 * O casamento por nome existia porque "os ids divergem entre UI e motor" — o que
 * so vale no caminho de fallback do roster. Com nome, homonimo no mesmo elenco
 * (33 clubes dos dados reais tem) tornava impossivel saber QUAL dos dois o
 * tecnico escalou: salvar 11 titulares podia gravar o xara no lugar.
 */
export function saveTacticalSetup(
  starterIds: readonly number[],
  formation: string,
  tacticalPlayerPositions?: Record<string, { x: number; y: number }>,
): void {
  const titulares = new Set(starterIds)
  useGameEngine.setState(state => ({
    formation,
    tacticalPlayerPositions: tacticalPlayerPositions ?? state.tacticalPlayerPositions,
    squadPlayers: state.squadPlayers.map(player => {
      const deveSerTitular = titulares.has(player.id)
      return player.isStarter === deveSerTitular ? player : { ...player, isStarter: deveSerTitular }
    }),
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

/** Temporada em que a carreira comeca — epoca do relogio de contratos. */
export const CONTRACT_EPOCH_SEASON = 2026

/**
 * Semana ABSOLUTA desde o inicio da carreira. O `week` do save ZERA a cada
 * temporada; `contract.endDate` e absoluto. Comparar os dois direto fazia
 * `endDate - week` nunca diminuir entre temporadas — nenhum contrato vencia
 * jamais, e o aviso de "contrato acabando" nunca disparava.
 */
export function absoluteWeek(season: number, week: number): number {
  return Math.max(0, (season - CONTRACT_EPOCH_SEASON)) * 52 + Math.max(0, week)
}

export function getContractStatus(
  player: Player,
  currentWeek: number,
  currentSeason = CONTRACT_EPOCH_SEASON,
): "ok" | "expiring" | "expired" {
  if (!player.contract) return "expired"
  const weeksRemaining = player.contract.endDate - absoluteWeek(currentSeason, currentWeek)
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

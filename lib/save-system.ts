// Sistema de save offline (localStorage). Brasfoot-like: tudo persiste localmente.

"use client"

import { useEffect, useState } from "react"
import { allTeams, getTeamByShort, serieATeams, type Team } from "@/lib/teams-data"
import { getNationalTeamById, getNationalStrength, type NationalTeam } from "@/lib/national-teams"
import { getNationalCrestUrl } from "@/lib/national-assets"
import { applyTeamOverride } from "@/lib/team-overrides"
import type { NationalCompetitionState } from "@/lib/national-competitions"
import { storeGet, storeSet, storeRemove, initPersistentStore, flushPersistentStore } from "@/lib/persistent-store"
import { mirrorSaveToFolder, deleteSaveFromFolder, listMirroredCareerSuffixes } from "@/lib/save-folder"
import type { TransferRecord, MatchFixture, StandingEntry, MatchResult, FinanceEntry, SeasonRecord, InjuryRecord, FatigueMap } from "@/lib/career-types"
import type { ClubDebtState } from "@/lib/debt-engine"
import type { ScoutingDepartmentState } from "@/lib/scout-engine"
import type { StadiumPitch } from "@/lib/infrastructure-engine"
import type { SeasonAwards } from "@/lib/awards-engine"
import type { Sponsor, SponsorOffer } from "@/lib/sponsor-engine"
import type { ChallengeProgress } from "@/lib/challenge-engine"

const LEGACY_STORAGE_KEY = "ultrafoot:save"
const ACTIVE_CAREER_KEY = "ultrafoot:active-career"
const CAREER_INDEX_KEY = "ultrafoot:career-index"
const CAREER_SAVE_PREFIX = "ultrafoot:save:"

/**
 * Jogador do elenco/base persistido no save. Forma gerada por
 * [lib/youth-engine.ts](lib/youth-engine.ts) `generateYouthBatch` e consumida por
 * base/mercado/transferencias. Distinto do SquadPlayer (nome/pos) do match-engine.
 */
export interface SquadPlayer {
  id: string
  name: string
  position: string
  age: number
  overall: number
  potential: number
  value: number
  pace?: number
  shooting?: number
  passing?: number
  dribbling?: number
  defending?: number
  physical?: number
  fromTeam?: string
  trend?: "up" | "down" | "stable"
  seasonSigned?: number
  /** Venda de jovem acertada fora da janela: efetivada quando a janela abre. */
  vendaPendente?: { clube: string; valor: number }
}

export interface YouthAlumniRecord {
  playerId: string
  playerName: string
  position: string
  potential: number
  trainedFromSeason: number
  trainedToSeason: number
  currentClub: string
  currentLevel: "base" | "professional" | "elite"
  careerTitles: string[]
  nationalTeamCaps: number
  worldCupTitles: number
  relationship: number
}

export interface YouthCareerState {
  active: boolean
  category: "sub20"
  clubCurto: string
  clubNome: string
  startedSeason: number
  currentSeason: number
  round: number
  matches: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  points: number
  coachReputation: number
  coachXP: number
  titles: string[]
  promotedPlayerIds: string[]
  alumni: YouthAlumniRecord[]
  professionalOffers: { id: string; clubCurto: string; clubNome: string; role: "assistant" | "head_coach"; reputationRequired: number; monthlySalary: number; contractMonths: number; objectives: string[] }[]
  seasonFinished: boolean
  formation?: string
  startingPlayerIds?: string[]
  currentCompetition?: string
  /** Progresso independente das competicoes de base (campos opcionais para saves antigos). */
  competitionIndex?: number
  competitionStageIndex?: number
  competitionMatchInStage?: number
  competitionPoints?: number
  competitionAggregateFor?: number
  competitionAggregateAgainst?: number
  competitionStage?: string
  seasonPlacements?: Record<string, string>
}
const VERSION = 7

// ============================================
// ARVORE DE HABILIDADES DO TREINADOR
// ============================================

export type CoachSkillId =
  | "fechamento_casinha"     // Resiliencia defensiva nos ultimos 10 min
  | "motivacao_vestiario"    // Discurso pre-jogo da uma moral extra
  | "gestao_crise"           // Reduz impacto de eventos negativos
  | "olho_clinico"           // Descobre atributos ocultos dos jogadores mais rapido
  | "fidelizador"            // Jogadores felizes renovam por salarios menores
  | "mestre_tatico"          // Mudancas de formacao em jogo tem mais efeito
  | "identificacao_talentos" // Base gera jovens com maior potencial
  | "negociador_nato"        // Negocia transferencias com desconto de 10%
  | "psicologia_aplicada"    // Traumas curam 50% mais rapido
  | "lideranca_carismo"      // Capitaes tem 50% mais influencia no vestiario

export interface CoachSkill {
  id: CoachSkillId
  name: string
  description: string
  effect: string // descricao do efeito em jogo
  xpCost: number // XP necessario para desbloquear
  unlocked: boolean
  unlockedSeason: number | null
  // Evento que desbloqueia (Just-in-Time)
  unlockTrigger: {
    type: "crisis_resolved" | "win_streak" | "title_won" | "youth_breakout" | "manual"
    threshold: number
    description: string
  }
}

export const COACH_SKILL_CATALOG: CoachSkill[] = [
  {
    id: "fechamento_casinha", name: "Fechamento de Casinha",
    description: "Seu time fica mais resistente nos minutos finais.",
    effect: "+8% rendimento defensivo nos últimos 10 min.",
    xpCost: 100,
    unlocked: false, unlockedSeason: null,
    unlockTrigger: { type: "crisis_resolved", threshold: 3, description: "Supere 3 viradas sofridas" }
  },
  {
    id: "motivacao_vestiario", name: "Motivação no Vestiário",
    description: "Discurso pré-jogo eleva o nível de entrega.",
    effect: "+5% moral do elenco antes de cada partida.",
    xpCost: 80,
    unlocked: false, unlockedSeason: null,
    unlockTrigger: { type: "win_streak", threshold: 5, description: "Vença 5 jogos seguidos" }
  },
  {
    id: "gestao_crise", name: "Gestão de Crise",
    description: "Você mantém o barco estável em momentos difíceis.",
    effect: "Eventos negativos causam 30% menos impacto na moral.",
    xpCost: 150,
    unlocked: false, unlockedSeason: null,
    unlockTrigger: { type: "crisis_resolved", threshold: 5, description: "Supere 5 eventos de crise sem demissão" }
  },
  {
    id: "olho_clinico", name: "Olho Clínico",
    description: "Você enxerga potencial onde outros não veem.",
    effect: "Atributos de jogadores descobertos são revelados 50% mais rápido.",
    xpCost: 120,
    unlocked: false, unlockedSeason: null,
    unlockTrigger: { type: "youth_breakout", threshold: 2, description: "Revele 2 jovens com potencial >= 85" }
  },
  {
    id: "fidelizador", name: "Fidelizador",
    description: "Jogadores contentes não querem sair.",
    effect: "Renovações de contrato custam 15% menos quando moral está alta.",
    xpCost: 100,
    unlocked: false, unlockedSeason: null,
    unlockTrigger: { type: "win_streak", threshold: 3, description: "Mantenha moral acima de 80 por 10 semanas" }
  },
  {
    id: "mestre_tatico", name: "Mestre Tático",
    description: "Suas mudanças táticas no intervalo fazem diferença real.",
    effect: "+10% eficácia das substituições e ajustes de formação.",
    xpCost: 180,
    unlocked: false, unlockedSeason: null,
    unlockTrigger: { type: "manual", threshold: 0, description: "Ganhe 20 pontos acima da expectativa em uma temporada" }
  },
  {
    id: "identificacao_talentos", name: "Identificação de Talentos",
    description: "A base produz jogadores acima da média.",
    effect: "+5 overall e +8 potencial em jovens gerados pela categoria de base.",
    xpCost: 160,
    unlocked: false, unlockedSeason: null,
    unlockTrigger: { type: "youth_breakout", threshold: 5, description: "Revele 5 jovens com potencial >= 82" }
  },
  {
    id: "negociador_nato", name: "Negociador Nato",
    description: "Você sempre fecha o melhor negócio.",
    effect: "-10% em taxas de transferência e comissões de agentes.",
    xpCost: 140,
    unlocked: false, unlockedSeason: null,
    unlockTrigger: { type: "manual", threshold: 0, description: "Complete 10 transferências em uma temporada" }
  },
  {
    id: "psicologia_aplicada", name: "Psicologia Aplicada",
    description: "Você entende o lado humano dos atletas.",
    effect: "Traumas e crises de confiança curam 50% mais rápido.",
    xpCost: 130,
    unlocked: false, unlockedSeason: null,
    unlockTrigger: { type: "crisis_resolved", threshold: 8, description: "Cure 8 status effects negativos de jogadores" }
  },
  {
    id: "lideranca_carismo", name: "Liderança e Carisma",
    description: "Sua presença inspira os líderes do vestiário.",
    effect: "Capitães têm 50% mais influência sobre companheiros.",
    xpCost: 200,
    unlocked: false, unlockedSeason: null,
    unlockTrigger: { type: "title_won", threshold: 1, description: "Conquiste um título" }
  },
]

// ============================================
// LEGADO ENTRE CARREIRAS (ROGUELIKE)
// ============================================

export interface CareerRecord {
  teamShort: string
  teamName: string
  seasons: number
  titles: string[]
  bestPosition: number
  youthAcademyLevelLeft: number // nivel que o clube ficou quando saiu
  startedSeason: number
  endedSeason: number
  endReason: "demitido" | "aposentado" | "novo_desafio"
}

export interface CoachLegacy {
  totalSeasons: number
  totalTitles: number
  careerRecords: CareerRecord[]
  // Bonus que persistem entre carreiras
  legacySkills: CoachSkillId[] // skills desbloqueadas em carreiras anteriores
  reputationLevel: number // 0-5 — desbloqueia times maiores
  legacyXP: number
}

// ============================================
// CONFIGURACAO DE CONFIGURACOES
// ============================================

// Configuracao de um tecnico/jogador
export interface ManagerProfile {
  id: string
  name: string
  teamShort: string
  color: string // Cor de identificacao do jogador
  controllerIndex: number // -1 = teclado, 0-3 = controles
}

// ============================================
// SELECAO NACIONAL
// ============================================

export interface NationalOffer {
  nationalTeamId: string
  nationalTeamName: string
  code: string
  confederation: string
  strength: number
  createdSeason: number
  createdWeek: number
  monthlySalary: number
  contractMonths: number
  objectives: string[]
  obligations: string[]
  negotiationRound?: number
  status?: "open" | "countered"
}

export interface NationalCoachContract {
  nationalTeamId: string
  monthlySalary: number
  contractMonths: number
  startSeason: number
  startWeek: number
  objectives: string[]
  obligations: string[]
}

export interface NationalTitle {
  competition: string
  season: number
}

// Janela FIFA ativa: quando o jogo desvia para a Selecao durante o calendario
// do clube. Rastreia quantos jogos faltam disputar antes de voltar ao clube.
export interface NationalWindow {
  season: number
  month: number
  competitionId: string
  /** Jogos do usuario ja disputados na competicao quando a janela comecou. */
  gamesAtStart: number
  /** Quantos jogos disputar nesta janela (alto = torneio em bloco unico). */
  gamesTarget: number
  isFinalTournament: boolean
  label: string
}

export interface NationalCareer {
  nationalTeamId: string | null
  nationalTeamName: string | null
  acceptedSeason: number | null
  titles: NationalTitle[]
  worldCupQualifications: number
  matchesPlayed: number
  wins: number
  draws: number
  losses: number
  currentCompetition: NationalCompetitionState | null
  completedThisSeason: string[]
  /** Janelas FIFA ja cumpridas (chave temporada-mes), para nao repetir. */
  completedWindows: string[]
  /** Janela FIFA em andamento (null fora de uma janela). */
  activeWindow: NationalWindow | null
  contract: NationalCoachContract | null
  totalSalaryEarned: number
  lastSalaryPaidWeek: number | null
}

export const DEFAULT_NATIONAL_CAREER: NationalCareer = {
  nationalTeamId: null,
  nationalTeamName: null,
  acceptedSeason: null,
  titles: [],
  worldCupQualifications: 0,
  matchesPlayed: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  currentCompetition: null,
  completedThisSeason: [],
  completedWindows: [],
  activeWindow: null,
  contract: null,
  totalSalaryEarned: 0,
  lastSalaryPaidWeek: null,
}

/** Dados do time escolhido pelo usuário, persistidos no save. */
export interface SavedTeam {
  nome: string
  curto: string
  cor1: string
  cor2: string
  prestigio: number
  saldo: number
  divisao: string
  pais: string
  cidade?: string
  estado?: string
  torcida?: number
  estadio_cap?: number
  /** Chave de arquivo (usada para carregar escudos/camisas). */
  fileKey: string
  /** Nome do estádio. */
  estadio: string
  patrocinador?: string
  escudo?: string
}

export interface GameState {
  version: number
  /** Identidade imutavel da campanha. Impede duas carreiras de compartilharem save/motor. */
  careerId: string | null
  saveName: string
  selectedTeamShort: string | null
  managerName: string
  /**
   * Foto do tecnico, como data URI ja reduzida (128px, JPEG). Fica no save e nao
   * num arquivo porque e por CARREIRA: duas carreiras podem ter tecnicos
   * diferentes, e exportar o save leva a foto junto.
   */
  managerAvatar: string
  season: number
  week: number
  language: string
  selectedUniform: "home" | "away" | "third"
  /**
   * Prancheta do gerenciamento na HORIZONTAL, com os onze em cartas de foto no
   * estilo EA FC (em vez da camisa do clube na vertical). Fica no save porque é
   * preferência de leitura do técnico: quem gosta de uma não quer reescolher a
   * cada abertura. Ver app/elenco/gerenciamento.
   */
  campoHorizontal?: boolean
  createdAt: number
  updatedAt: number
  // Multiplayer
  multiplayerEnabled: boolean
  managers: ManagerProfile[]
  activeManagerId: string | null
  // Configuracoes de controle. "auto" = detecta pelo controle conectado; xbox/playstation
  // forcam os prompts de botao (glifos) no jogo inteiro.
  controllerType: "auto" | "xbox" | "playstation"
  controllerBindings: Record<string, Record<string, string>> // context -> button -> action
  commentaryEnabled: boolean
  commentaryVoice: string
  commentaryVolume: number
  /**
   * Volume dos EFEITOS sonoros (0-100). A trilha e do player do sistema; o que
   * o jogo toca sao apito, torcida e bola na rede (hooks/use-match-sounds).
   */
  sfxVolume: number
  /** Velocidade com que a partida ao vivo COMECA. O jogador ainda troca em campo. */
  matchSpeed: "lento" | "normal" | "rapido"
  /** false = sem os avisos que saltam na tela; o histórico continua sendo gravado. */
  notificationsEnabled: boolean
  /** 0 desativa; os demais valores salvam apos essa quantidade de partidas. */
  autoSaveInterval: 0 | 1 | 3 | 5
  lastAutoSaveMatchCount: number
  /**
   * A carreira so pode ser salva depois que o tecnico entra no PRE-OFFICE pela
   * primeira vez. Antes disso a carreira ainda nao comecou de fato e salvar
   * criava um slot vazio, que depois aparecia na lista de "Carregar" sem nada
   * dentro. Marcado ao abrir o pre-office com clube ja escolhido.
   */
  preOfficeVisitado: boolean
  // Arvore de habilidades do treinador (Just-in-Time)
  coachSkills: CoachSkill[]
  coachXP: number
  coachCrisisCount: number   // quantas crises resolvidas (gatilho de habilidades)
  coachWinStreak: number     // sequencia atual de vitorias
  coachTotalTitles: number
  // ── Reuniões com a diretoria (lib/conversa-diretoria.ts) ────────────────
  /** Quantas vezes você pediu algo nesta temporada — a paciência do conselho acaba. */
  pedidosADiretoria?: number
  /** Ajuste acumulado de confiança que veio das reuniões (soma ao cálculo do motor). */
  boardConfidenceBonus?: number
  /** Meta renegociada na reunião (posição), quando o conselho cedeu. */
  metaDaDiretoria?: number
  // ── Conversa com o atleta (lib/conversa-atleta.ts) ──────────────────────
  /**
   * PROMESSAS DE TITULARIDADE em aberto, por id de atleta.
   *
   * É o que transforma a conversa em compromisso: ao prometer, guardamos quantas
   * partidas o TIME e o ATLETA tinham. Se o time joga e ele continua fora, a
   * promessa foi quebrada — a moral cai e a sua palavra passa a valer menos nas
   * próximas conversas (`promessasQuebradas`).
   */
  promessasAoAtleta?: Record<string, { semana: number; jogosDoTime: number; jogosDoAtleta: number }>
  /** Quantas promessas de titularidade você já deixou de cumprir nesta carreira. */
  promessasQuebradas?: number
  // Legado entre carreiras (Roguelike)
  coachLegacy: CoachLegacy
  // Selecao nacional
  nationalCareer: NationalCareer
  pendingNationalOffers: NationalOffer[]
  declinedNationalTeamIds: string[]
  lastNationalOfferSeason: number | null
  /**
   * MODO SELEÇÃO (Task 2 — seleção como time pleno). Quando preenchido, o técnico
   * está comandando esta seleção como seu "time atual": o office, central,
   * calendário, elenco (convocação) e a partida ao vivo passam a operar sobre a
   * seleção em vez do clube. `null` = comandando o clube normalmente
   * (retrocompatível: saves antigos não têm o campo e caem em null).
   */
  managingNationalTeamId?: string | null
  // Estado de carreira detalhado (opcional — semeado ao iniciar/carregar uma carreira).
  // Convive com o useGameEngine; estas telas (base/mercado/calendario/partida) leem daqui.
  squadPlayers?: SquadPlayer[]
  youthPlayers?: SquadPlayer[]
  /** Ofertas do mercado de juniores já compradas no ciclo em que apareceram. */
  youthMarketPurchasedIds?: string[]
  /**
   * Jovens que JÁ SAÍRAM da base (vendidos, dispensados ou promovidos).
   *
   * BUG que isto corrige (relato: "vendi os juniores e ao voltar eles aparecem
   * de novo"): `generateYouthProspects` é DETERMINÍSTICO — a semente é
   * `hash("CLUBE:TEMPORADA:base")`, então o mesmo clube na mesma temporada
   * sempre devolve os mesmos garotos, com os mesmos ids. Sem um registro de
   * quem saiu, qualquer nova semeadura ressuscitava exatamente quem foi vendido.
   *
   * É o mesmo papel que `lib/departed-players.ts` cumpre para os profissionais.
   * Aqui mora no save (e não num módulo à parte) porque a base já vive no save:
   * não há o risco de ciclo de import que obrigou a separar o outro.
   */
  youthDeparted?: string[]
  // Temporada em que a base foi semeada — evita re-gerar prospectos toda visita.
  youthSeededSeason?: number
  // Carimbo (absoluto: season*52 + week) da ÚLTIMA peneira. A peneira acontece a
  // cada ~2 meses (8 semanas), como na vida real — sem isto dava para rodar
  // peneira→vender em loop e imprimir dinheiro infinito (relato).
  youthTryoutStamp?: number
  // Marco da carreira da base para a promoção automática após três temporadas.
  // Opcional para manter compatibilidade com saves anteriores.
  youthCareerStartSeason?: number
  youthAutoPromotedSeason?: number
  /** Ultima temporada em que a base envelheceu (promocao automatica aos 18). */
  youthAgedSeason?: number
  /** Semana da ultima cobranca da diretoria sobre a base. */
  youthBoardCheckWeek?: number
  /** Carreira opcional iniciada nas categorias de base. */
  youthCareer?: YouthCareerState
  /**
   * Técnicos demitidos pelos OUTROS clubes nesta carreira (lib/mercado-de-tecnicos).
   * Serve a dois propósitos: virar notícia da rodada e impedir que o mesmo clube
   * seja "demitido" toda semana — sem esta memória o feed repetiria o mesmo
   * clube em crise indefinidamente.
   */
  demissoesMundo?: { curto: string; season: number; week: number; tecnico: string }[]
  /**
   * Lances DO USUÁRIO em leilões (lib/leilao). Só isto precisa ser salvo: quem
   * está em disputa e quanto a IA ofereceu são derivados da semana, para o leilão
   * não virar um simulador paralelo do mercado.
   */
  lancesEmLeilao?: { chave: string; valor: number; encerraNaSemana: number; season: number }[]
  /**
   * Leilão que o técnico VENCEU e ainda não fechou contrato.
   *
   * A tela de leilões não conclui a transferência — ela manda o vencedor para a
   * negociação normal do Mercado, que já trata teto de dívida, teto de folha e a
   * baixa no clube de origem. Este campo é o recado entre as duas telas.
   */
  leilaoVencido?: { jogador: string; valor: number; season: number } | null
  /**
   * Torneio amistoso criado pelo técnico (lib/torneio-amistoso). Fica no save
   * porque jogar uma partida sai desta tela e volta — sem persistir, a tabela
   * zerava a cada jogo.
   */
  torneioAmistoso?: {
    nome: string
    formato: "mata_mata" | "pontos_corridos"
    participantes: string[]
    idaEVolta: boolean
    jogos: {
      rodada: number
      mandanteCurto: string
      visitanteCurto: string
      golsMandante?: number
      golsVisitante?: number
      jogado: boolean
    }[]
    campeao?: string | null
  } | null
  /** Finalíssima disputada pela seleção do técnico (lib/finalissima). */
  finalissima?: {
    temporada: number
    campeaoSulamericano: string
    campeaoEuropeu: string
    golsSulamericano?: number
    golsEuropeu?: number
    penaltisSulamericano?: number
    penaltisEuropeu?: number
    campeao?: string
    jogada: boolean
  } | null
  debt?: ClubDebtState
  scoutingDepartment?: ScoutingDepartmentState
  stadiumPitch?: StadiumPitch
  /** Torcida do clube já movimentada pela carreira (undefined = valor estático do time). */
  fanBase?: number
  /** Organizadas do clube com o humor acumulado. Semeadas por `organizadasDoClube`. */
  torcidaOrganizadas?: import("@/lib/torcida").Organizada[]
  /** Plano do sócio torcedor em vigor (define mensalidade e adesão). */
  planoDeSocio?: import("@/lib/torcida").PlanoDeSocio
  /** Prêmios individuais apurados ao fim de cada temporada. */
  seasonAwards?: SeasonAwards[]
  sponsorOffers?: SponsorOffer[]
  activeSponsors?: Sponsor[]
  // Divisao ATUAL do clube do usuario quando ela difere da estatica (teams-data), por
  // causa de acesso/rebaixamento. A resolucao da liga prefere isto. undefined = usa a
  // divisao original do time.
  divisionOverride?: string
  // PIRAMIDE VIVA: divisao ATUAL de cada clube (curto -> divisao) apos os acessos
  // e rebaixamentos acumulados. Guarda so quem saiu da divisao estatica. Alimenta
  // getTeamsByDivision via setClubDivisions, para os rivais tambem trocarem de
  // divisao entre temporadas (nao so o clube do usuario).
  clubDivisions?: Record<string, string>
  // Quando o tecnico assumiu o clube ATUAL. Trava a troca de clube no meio da
  // temporada (ver podeTrocarDeClube em career-moves).
  contratadoEm?: { season: number; week: number }
  /**
   * COMO cada passagem por um clube terminou (pediu demissao / foi demitido).
   *
   * Sem isto o hall da fama chumbava "contract_ended" para todos os ciclos — dava
   * para ser demitido dez vezes e o historico dizer que os dez contratos apenas
   * chegaram ao fim. Ver `encerrarPassagem` em lib/career-moves.
   */
  passagens?: import("@/lib/career-moves").PassagemPorClube[]
  // Aviso a mostrar no office apos subir/cair (limpo depois de exibido).
  divisionMovement?: { movement: "promoted" | "relegated"; message: string; season: number }
  // Convocacao manual da selecao: jogadores CORTADOS e CONVOCADOS a dedo pelo tecnico
  // (chaves nome__clube). Vazio = convocacao 100% automatica.
  nationalCuts?: string[]
  // Amistosos marcados na Area do Treinador (maximo 3). Desde a 1.0.223 cada um
  // carrega a SEMANA em que acontece e vira um fixture de verdade no calendario
  // (ver lib/amistosos-calendario.ts). `week` e opcional so por causa dos saves
  // antigos, que sao migrados na primeira abertura.
  amistososAgendados?: import("@/lib/amistosos-calendario").AmistosoAgendado[]
  // Chave (season-mes) da ultima janela FIFA em que o tecnico treinou o
  // entrosamento — impede treinar a mesma data FIFA duas vezes.
  dataFifaTreinada?: string
  nationalCalls?: string[]
  // Amistosos de SELECAO ja jogados (preparacao antes dos torneios). Guarda os
  // ultimos resultados para exibir. Ver use-national-team.playNationalFriendly.
  nationalFriendlies?: { opponentId: string; opponentName: string; userScore: number; oppScore: number; season: number }[]
  balance?: number
  selectedTeam?: SavedTeam
  currentRound?: number
  transfers?: TransferRecord[]
  fixtures?: MatchFixture[]
  /** Fixtures oficiais já encerradas nesta carreira/temporada. Mantido no save
   * para a próxima partida não depender apenas da hidratação do motor Zustand. */
  completedFixtureKeys?: string[]
  standings?: StandingEntry[]
  results?: MatchResult[]
  finances?: FinanceEntry[]
  seasonHistory?: SeasonRecord[]
  /** Resultado da avaliacao da diretoria no fim da temporada. */
  renewalStatus?: "auto" | "negociar" | "ofertas"
  injuries?: InjuryRecord[]
  playerFatigue?: FatigueMap
  teamMorale?: number
  /**
   * Confianca da diretoria (0-100). Sobe e desce conforme as respostas na
   * coletiva pos-jogo; antes as respostas nao afetavam nada.
   */
  boardConfidence?: number
  activeChallenge?: ChallengeProgress
}

export const DEFAULT_COACH_LEGACY: CoachLegacy = {
  totalSeasons: 0,
  totalTitles: 0,
  careerRecords: [],
  legacySkills: [],
  reputationLevel: 0,
  legacyXP: 0,
}

export const DEFAULT_STATE: GameState = {
  version: VERSION,
  careerId: null,
  saveName: "Carreira principal",
  selectedTeamShort: null,
  managerName: "Tecnico",
  managerAvatar: "",
  season: 2026,
  week: 0,
  language: "pt-BR",
  selectedUniform: "home",
  createdAt: 0,
  updatedAt: 0,
  // Multiplayer
  multiplayerEnabled: false,
  managers: [],
  activeManagerId: null,
  // Controles
  controllerType: "auto",
  controllerBindings: {},
  commentaryEnabled: true,
  commentaryVoice: "padrao",
  commentaryVolume: 80,
  sfxVolume: 80,
  matchSpeed: "normal",
  notificationsEnabled: true,
  autoSaveInterval: 1,
  lastAutoSaveMatchCount: 0,
  preOfficeVisitado: false,
  // Treinador
  coachSkills: COACH_SKILL_CATALOG.map(s => ({ ...s })),
  coachXP: 0,
  coachCrisisCount: 0,
  coachWinStreak: 0,
  coachTotalTitles: 0,
  pedidosADiretoria: 0,
  boardConfidenceBonus: 0,
  // Legado
  coachLegacy: DEFAULT_COACH_LEGACY,
  // Selecao nacional
  nationalCareer: DEFAULT_NATIONAL_CAREER,
  pendingNationalOffers: [],
  declinedNationalTeamIds: [],
  lastNationalOfferSeason: null,
  managingNationalTeamId: null,
  completedFixtureKeys: [],
}

/** Cria uma campanha limpa sem carregar campos opcionais do save anterior. */
export function createFreshCareerState(previous: GameState, campaign: Partial<GameState>): GameState {
  const now = Date.now()
  return {
    ...DEFAULT_STATE,
    // Preferencias globais sobrevivem; progresso esportivo nao.
    language: previous.language,
    controllerType: previous.controllerType,
    controllerBindings: previous.controllerBindings,
    commentaryEnabled: previous.commentaryEnabled,
    commentaryVoice: previous.commentaryVoice,
    commentaryVolume: previous.commentaryVolume,
    autoSaveInterval: previous.autoSaveInterval,
    createdAt: now,
    updatedAt: now,
    ...campaign,
  }
}

export interface CareerSaveSummary {
  id: string
  name: string
  teamShort: string
  managerName: string
  season: number
  week: number
  updatedAt: number
}

function makeCareerId(): string {
  return `career-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function createCareerId(): string {
  return makeCareerId()
}

export function getActiveCareerId(): string | null {
  return storeGet(ACTIVE_CAREER_KEY)
}

export function setActiveCareerId(careerId: string): void {
  storeSet(ACTIVE_CAREER_KEY, careerId)
}

export function getCareerScopedKey(base: string, careerId = getActiveCareerId()): string {
  return careerId ? `${base}:${careerId}` : base
}

function saveKey(careerId: string): string {
  return `${CAREER_SAVE_PREFIX}${careerId}`
}

function backupKey(careerId: string): string {
  return `${saveKey(careerId)}:backup`
}

function readCareerIndex(): CareerSaveSummary[] {
  try {
    const parsed = JSON.parse(storeGet(CAREER_INDEX_KEY) ?? "[]")
    return Array.isArray(parsed) ? parsed as CareerSaveSummary[] : []
  } catch {
    return []
  }
}

function updateCareerIndex(state: GameState): void {
  if (!state.careerId || !state.selectedTeamShort) return
  const summary: CareerSaveSummary = {
    id: state.careerId,
    name: state.saveName || `Carreira de ${state.managerName}`,
    teamShort: state.selectedTeamShort,
    managerName: state.managerName,
    season: state.season,
    week: state.week,
    updatedAt: state.updatedAt,
  }
  const next = [summary, ...readCareerIndex().filter(item => item.id !== summary.id)]
    .sort((a, b) => b.updatedAt - a.updatedAt)
  storeSet(CAREER_INDEX_KEY, JSON.stringify(next))
}

export function listCareerSaves(): CareerSaveSummary[] {
  return readCareerIndex().filter(item => storeGet(saveKey(item.id)) !== null || storeGet(backupKey(item.id)) !== null)
}

export function activateCareerSave(careerId: string): boolean {
  const raw = storeGet(saveKey(careerId)) ?? storeGet(backupKey(careerId))
  if (!safeParse(raw)) return false
  setActiveCareerId(careerId)
  return true
}

function safeParse(raw: string | null): GameState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as GameState
    // Carreira que JA existia em disco nasceu antes da trava do pre-office. Se
    // ficasse com o padrao `false`, o tecnico veria "nao da para salvar" numa
    // campanha em andamento — regressao pior do que o problema que a trava
    // resolve. Um save gravado e, por definicao, uma carreira ja iniciada.
    if (parsed.preOfficeVisitado === undefined) parsed.preOfficeVisitado = true
    // Migra version 2 para a atual (adiciona campos de treinador e legado)
    if (parsed.version === 2) {
      return {
        ...DEFAULT_STATE,
        ...parsed,
        version: VERSION,
        coachSkills: DEFAULT_STATE.coachSkills,
        coachXP: 0,
        coachCrisisCount: 0,
        coachWinStreak: 0,
        coachTotalTitles: 0,
        coachLegacy: DEFAULT_COACH_LEGACY,
        nationalCareer: DEFAULT_NATIONAL_CAREER,
        pendingNationalOffers: [],
        declinedNationalTeamIds: [],
        lastNationalOfferSeason: null,
      }
    }
    // Migra version 3 para a atual (adiciona campos de selecao nacional)
    if (parsed.version === 3) {
      return {
        ...DEFAULT_STATE,
        ...parsed,
        version: VERSION,
        nationalCareer: DEFAULT_NATIONAL_CAREER,
        pendingNationalOffers: [],
        declinedNationalTeamIds: [],
        lastNationalOfferSeason: null,
      }
    }
    // v4 -> v7: adiciona os sistemas opcionais sem alterar campanhas existentes.
    // dados profissionais permanecem intactos.
    if (parsed.version === 4) {
      return { ...DEFAULT_STATE, ...parsed, version: VERSION, youthCareer: undefined }
    }
    if (parsed.version === 5) {
      return { ...DEFAULT_STATE, ...parsed, version: VERSION, debt: undefined, scoutingDepartment: undefined }
    }
    if (parsed.version === 6) {
      return { ...DEFAULT_STATE, ...parsed, version: VERSION, careerId: parsed.careerId ?? null, saveName: parsed.saveName ?? "Carreira principal" }
    }
    if (parsed.version !== VERSION) return null
    return { ...DEFAULT_STATE, ...parsed }
  } catch {
    return null
  }
}

// O save agora vive no persistent-store (tauri-plugin-store, baseado em arquivo),
// que SOBREVIVE a reinstalacoes/updates — ao contrario do localStorage da webview,
// que era limpo ao atualizar e fazia o jogo "sumir" (calendario/partidas em mock).
// storeGet/storeSet leem/escrevem no cache sincrono; a persistencia em disco e async.
export function loadGameState(): GameState {
  if (typeof window === "undefined") return DEFAULT_STATE
  const activeId = getActiveCareerId()
  if (activeId) {
    const current = safeParse(storeGet(saveKey(activeId)))
    if (current) return { ...current, careerId: activeId }
    const backup = safeParse(storeGet(backupKey(activeId)))
    if (backup) return { ...backup, careerId: activeId }
  }

  // Migracao unica do save global usado ate a 1.0.81.
  const legacy = safeParse(storeGet(LEGACY_STORAGE_KEY))
  if (!legacy) return DEFAULT_STATE
  if (!legacy.selectedTeamShort) return legacy
  const careerId = legacy.careerId || `career-legacy-${legacy.createdAt || Date.now()}`
  const migrated = { ...legacy, careerId, saveName: legacy.saveName || "Carreira principal", version: VERSION }
  setActiveCareerId(careerId)
  storeSet(saveKey(careerId), JSON.stringify(migrated))
  updateCareerIndex(migrated)
  return migrated
}

export function saveGameState(state: GameState): void {
  if (typeof window === "undefined") return
  const careerId = state.careerId || getActiveCareerId()
  // Preferencias antes de uma carreira continuam no legado, sem criar slot vazio.
  if (!careerId && !state.selectedTeamShort) {
    storeSet(LEGACY_STORAGE_KEY, JSON.stringify({ ...state, version: VERSION, updatedAt: Date.now() }))
    return
  }
  const resolvedId = careerId || makeCareerId()
  const next = { ...state, careerId: resolvedId, version: VERSION, updatedAt: Date.now() }
  const key = saveKey(resolvedId)
  const previous = storeGet(key)
  // Snapshot anterior permite recuperar fechamento/queda de energia durante a gravacao.
  if (previous) storeSet(backupKey(resolvedId), previous)
  setActiveCareerId(resolvedId)
  const serialized = JSON.stringify(next)
  storeSet(key, serialized)
  updateCareerIndex(next)
  // Espelho na pasta VISÍVEL do Windows (Documentos\Ultrafoot 26 Saves). Throttle
  // de 15s por carreira: saveGameState roda a cada setState; sem isto gravaria um
  // arquivo a cada tecla. Fire-and-forget — nunca bloqueia nem quebra o save real.
  const agora = Date.now()
  if (agora - (_lastMirror[resolvedId] ?? 0) > 15_000) {
    _lastMirror[resolvedId] = agora
    void mirrorSaveToFolder(next.saveName, resolvedId, serialized)
  }
}
const _lastMirror: Record<string, number> = {}

export async function saveGameStateAndFlush(state: GameState): Promise<void> {
  saveGameState(state)
  await flushPersistentStore()
  // Checkpoint (navegação): garante o espelho na pasta do Windows atualizado,
  // sem esperar o throttle de 15s do saveGameState.
  const id = state.careerId || getActiveCareerId()
  if (id) { _lastMirror[id] = Date.now(); void mirrorSaveToFolder(state.saveName, id, JSON.stringify({ ...state, careerId: id, version: VERSION })) }
}

/**
 * A carreira so e salvavel depois de o tecnico entrar no pre-office. Antes disso
 * ele ainda esta no fluxo de criacao (escolha de clube, cutscene, escritorio
 * inicial) e um save ali gravava um slot sem temporada nenhuma.
 */
export function podeSalvarCarreira(state: GameState): boolean {
  return Boolean(state.careerId && state.selectedTeamShort && state.preOfficeVisitado)
}

export function clearGameState(): void {
  if (typeof window === "undefined") return
  const careerId = getActiveCareerId()
  if (careerId) {
    storeRemove(saveKey(careerId))
    storeRemove(backupKey(careerId))
    storeSet(CAREER_INDEX_KEY, JSON.stringify(readCareerIndex().filter(item => item.id !== careerId)))
    storeRemove(`ultrafoot-game-engine:${careerId}`)
  } else {
    storeRemove(LEGACY_STORAGE_KEY)
  }
  storeRemove(ACTIVE_CAREER_KEY)
}

/**
 * Apaga UMA carreira (pedido: "apagar um save apenas, não todos"). Remove save,
 * backup, motor e a entrada do índice; se era a carreira ativa, zera o ponteiro.
 * Também apaga o arquivo espelho na pasta de saves do Windows.
 */
export function deleteCareerSave(careerId: string): void {
  if (typeof window === "undefined" || !careerId) return
  const summary = readCareerIndex().find(item => item.id === careerId)
  storeRemove(saveKey(careerId))
  storeRemove(backupKey(careerId))
  storeRemove(`ultrafoot-game-engine:${careerId}`)
  storeSet(CAREER_INDEX_KEY, JSON.stringify(readCareerIndex().filter(item => item.id !== careerId)))
  if (getActiveCareerId() === careerId) storeRemove(ACTIVE_CAREER_KEY)
  void deleteSaveFromFolder(summary?.name ?? "", careerId)
  void flushPersistentStore()
}

/**
 * Reconcilia o índice com a PASTA de saves do Windows: se o jogador apagou o
 * arquivo .json de um save direto na pasta, ele some daqui também (pedido). Só
 * roda quando a pasta está acessível E populada (evita apagar saves de quem nunca
 * teve espelho). Retorna quantas carreiras foram removidas.
 */
export async function reconcileCareersWithFolder(): Promise<number> {
  if (typeof window === "undefined") return 0
  const sufixos = await listMirroredCareerSuffixes()
  if (!sufixos || sufixos.size === 0) return 0 // pasta vazia/indisponível: não mexe
  const index = readCareerIndex()
  const mantidos = index.filter(item => sufixos.has(item.id.slice(-6)))
  const removidos = index.length - mantidos.length
  if (removidos > 0) {
    for (const item of index) {
      if (sufixos.has(item.id.slice(-6))) continue
      storeRemove(saveKey(item.id))
      storeRemove(backupKey(item.id))
      storeRemove(`ultrafoot-game-engine:${item.id}`)
      if (getActiveCareerId() === item.id) storeRemove(ACTIVE_CAREER_KEY)
    }
    storeSet(CAREER_INDEX_KEY, JSON.stringify(mantidos))
    void flushPersistentStore()
  }
  return removidos
}

export function clearAllGameData(): void {
  if (typeof window === "undefined") return
  // TODAS as carreiras, nao so a ativa. O botao "Apagar save" chamava
  // clearGameState (que limpa apenas a carreira ativa): com mais de uma
  // carreira, as outras continuavam existindo e a lista de "Carregar" voltava
  // cheia — "nao consigo apagar o save".
  for (const item of readCareerIndex()) {
    storeRemove(saveKey(item.id))
    storeRemove(backupKey(item.id))
    storeRemove(`ultrafoot-game-engine:${item.id}`)
  }
  storeRemove(CAREER_INDEX_KEY)
  storeRemove(LEGACY_STORAGE_KEY)
  storeRemove(ACTIVE_CAREER_KEY)
  // Garante que a exclusao chegou ao ARQUIVO antes de qualquer recarga; sem o
  // flush, reabrir rapido o jogo ressuscitava o save do disco.
  void flushPersistentStore()
}

export function hasSave(): boolean {
  if (typeof window === "undefined") return false
  return listCareerSaves().length > 0 || Boolean(safeParse(storeGet(LEGACY_STORAGE_KEY))?.selectedTeamShort)
}

/**
 * React hook: state do jogo + sincronia com outras abas.
 * SSR-safe (retorna DEFAULT_STATE no servidor, hidrata no client).
 */
export function useGameState(): {
  state: GameState
  hydrated: boolean
  setState: (next: Partial<GameState> | ((prev: GameState) => Partial<GameState>)) => void
  replaceState: (next: GameState) => void
  reset: () => void
} {
  const [state, setStateInternal] = useState<GameState>(DEFAULT_STATE)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let mounted = true
    let hydrationFinished = false
    const refresh = () => { if (mounted) setStateInternal(loadGameState()) }
    // Leitura imediata (o cache pode ja estar populado por outra tela)
    refresh()
    // O persistent-store carrega do disco de forma async; so entao hidratamos de
    // verdade. Sem isso, o save (que sobrevive a reinstalacao) chegaria depois do
    // primeiro render e as telas ficariam em mock/vazio.
    // Um store grande/corrompido não pode prender o jogo para sempre na tela de
    // carregamento. Após 4 s liberamos a UI com o cache disponível; quando o disco
    // terminar, o save real ainda é reaplicado pelo refresh/evento store:ready.
    const hydrationTimeout = window.setTimeout(() => {
      if (!mounted || hydrationFinished) return
      setHydrated(true)
    }, 4000)
    initPersistentStore().then(() => {
      if (!mounted) return
      hydrationFinished = true
      window.clearTimeout(hydrationTimeout)
      refresh()
      setHydrated(true)
    }).catch(() => {
      if (!mounted) return
      hydrationFinished = true
      window.clearTimeout(hydrationTimeout)
      refresh()
      setHydrated(true)
    })
    // Sincroniza quando o save muda em qualquer tela e quando o store fica pronto.
    const onChange = (e: Event) => {
      const key = (e as CustomEvent).detail?.key
      if (key && !key.startsWith(CAREER_SAVE_PREFIX) && key !== ACTIVE_CAREER_KEY && key !== LEGACY_STORAGE_KEY) return
      setTimeout(refresh, 0)
    }
    window.addEventListener("ultrafoot:store:changed", onChange)
    window.addEventListener("ultrafoot:store:ready", refresh)
    return () => {
      mounted = false
      window.clearTimeout(hydrationTimeout)
      window.removeEventListener("ultrafoot:store:changed", onChange)
      window.removeEventListener("ultrafoot:store:ready", refresh)
    }
  }, [])

  // Aceita objeto OU atualizador funcional (prev => patch). O funcional le sempre
  // o estado MAIS NOVO — essencial para acoes em sequencia sem re-render entre elas
  // (ex.: vender varios jovens da base seguidos; com objeto+closure so a ultima
  // valia e as outras "voltavam").
  const setState = (next: Partial<GameState> | ((prev: GameState) => Partial<GameState>)) => {
    setStateInternal(prev => {
      const patch = typeof next === "function" ? next(prev) : next
      const merged = { ...prev, ...patch }
      // Salva de forma assincrona para nao bloquear
      queueMicrotask(() => saveGameState(merged))
      return merged
    })
  }

  /** Substitui o save inteiro. Necessario ao iniciar outra carreira: um merge preservava
   * elenco, fixtures e clube da campanha anterior nos campos opcionais. */
  const replaceState = (next: GameState) => {
    const clean = { ...next, updatedAt: Date.now() }
    setStateInternal(clean)
    queueMicrotask(() => saveGameState(clean))
  }

  const reset = () => {
    clearGameState()
    setStateInternal(DEFAULT_STATE)
  }

  return { state, hydrated, setState, replaceState, reset }
}

/**
 * Time atual escolhido pelo usuario. Cai num default razoavel ate o save existir
 * (evita hydration mismatch ao retornar sempre o mesmo valor no SSR).
 */
const FALLBACK_TEAM: Team =
  serieATeams[0] ?? allTeams[0]

/**
 * Converte um SavedTeam (persistido no save) para o tipo Team usado pelos componentes.
 * Se já for um Team (tem file_key), retorna sem conversão.
 */
export function savedTeamToTeam(t: Team | SavedTeam | null | undefined): Team | null {
  if (!t) return null
  // Team já tem file_key; SavedTeam tem fileKey
  if ("file_key" in t) return t as Team
  const s = t as SavedTeam
  return {
    nome: s.nome,
    curto: s.curto,
    cor1: s.cor1,
    cor2: s.cor2,
    prestigio: s.prestigio,
    saldo: s.saldo,
    divisao: s.divisao as Team["divisao"],
    pais: s.pais,
    cidade: s.cidade ?? "",
    estado: s.estado ?? "",
    torcida: s.torcida ?? 50000,
    estadio_cap: s.estadio_cap ?? 30000,
    file_key: s.fileKey || s.curto.toLowerCase(),
    estadio_nome: s.estadio,
    patrocinador: s.patrocinador ?? "",
    escudo_url: s.escudo ?? "",
  }
}

/**
 * Converte uma SELEÇÃO nacional no tipo Team usado por todas as telas (office,
 * central, calendário, elenco, partida). É a peça que permite "comandar uma
 * seleção como um clube" (Task 2): as telas continuam falando `Team`, sem saber
 * se por trás há um clube ou uma seleção.
 *
 * `file_key` recebe o prefixo `nation_` para NÃO colidir com nenhum clube; o
 * `escudo_url` já aponta para o escudo real da seleção, então o TeamCrest resolve
 * pela imagem mesmo sem entrada no mapa de escudos de clubes.
 */
export function nationalTeamToTeam(nt: NationalTeam): Team {
  const forca = getNationalStrength(nt)
  return applyTeamOverride({
    nome: nt.name,
    curto: nt.code,
    cor1: nt.cor1,
    cor2: nt.cor2,
    prestigio: forca,
    saldo: 0,
    // Seleção não tem divisão de liga; sentinela só para satisfazer o tipo.
    divisao: "selecao" as Team["divisao"],
    pais: nt.name,
    cidade: "",
    estado: "",
    torcida: 0,
    estadio_cap: 0,
    file_key: `nation_${nt.id}`,
    estadio_nome: "",
    patrocinador: "",
    escudo_url: getNationalCrestUrl(nt.id),
  })
}

export function useUserTeam(): { team: Team; hydrated: boolean } {
  const { state, hydrated } = useGameState()
  // MODO SELEÇÃO tem prioridade: se o técnico assumiu uma seleção, o "time atual"
  // de todas as telas passa a ser ela. Cai no clube quando o id não resolve.
  const nation = state.managingNationalTeamId ? getNationalTeamById(state.managingNationalTeamId) : null
  const team = nation
    ? nationalTeamToTeam(nation)
    : state.selectedTeamShort
      ? getTeamByShort(state.selectedTeamShort) ?? FALLBACK_TEAM
      : FALLBACK_TEAM
  return { team, hydrated }
}

/**
 * Estado do MODO SELEÇÃO para as telas que precisam adaptar o comportamento
 * (não só o rótulo): elenco vira convocação, calendário usa janelas FIFA, etc.
 */
export function useManagingNational(): { isNational: boolean; nationalTeam: NationalTeam | null; hydrated: boolean } {
  const { state, hydrated } = useGameState()
  const nationalTeam = (state.managingNationalTeamId ? getNationalTeamById(state.managingNationalTeamId) : null) ?? null
  return { isNational: !!nationalTeam, nationalTeam, hydrated }
}

export function selectTeam(shortName: string, managerName?: string): void {
  const current = loadGameState()
  saveGameState({
    ...current,
    selectedTeamShort: shortName,
    managerName: managerName?.trim() || current.managerName || "Tecnico",
    season: current.season || 2026,
    week: 0,
    createdAt: current.createdAt || Date.now(),
  })
}

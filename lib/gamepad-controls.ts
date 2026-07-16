"use client"

import type { GamepadButtonName } from "@/hooks/use-gamepad"

// ============================================================
// MAPEAMENTO DE CONTROLES - XBOX E PLAYSTATION
// ============================================================

/**
 * Contextos do jogo onde os controles tem acoes diferentes
 */
export type GameContext = 
  | "menu"           // Menu principal, dashboard, navegacao
  | "match_preview"  // Tela de pre-jogo
  | "match_live"     // Partida ao vivo
  | "match_paused"   // Partida pausada
  | "tactical"       // Editor tatico
  | "substitution"   // Tela de substituicao
  | "calendar"       // Calendario
  | "squad"          // Elenco
  | "transfers"      // Mercado de transferencias
  | "modal"          // Qualquer modal aberto

/**
 * Acoes possiveis no jogo
 */
export type GameAction =
  // Navegacao
  | "navigate_up"
  | "navigate_down"
  | "navigate_left"
  | "navigate_right"
  // Acoes primarias
  | "confirm"
  | "cancel"
  | "back"
  // Partida
  | "pause_resume"
  | "fast_forward"
  | "slow_motion"
  | "skip_to_result"
  | "show_stats"
  | "show_tactics"
  | "substitute"
  | "change_camera"
  // Menu
  | "open_menu"
  | "tab_left"
  | "tab_right"
  | "scroll_up"
  | "scroll_down"
  // Tatico
  | "select_player"
  | "move_player"
  | "change_formation"
  | "swap_players"
  | "set_captain"
  // Especiais
  | "quick_save"
  | "screenshot"
  | "toggle_music"

/**
 * Mapeamento de botoes para cada contexto
 * Xbox: A, B, X, Y, LB, RB, LT, RT, START, SELECT, L3, R3, DPAD, HOME
 * PS:   X, O, □, △, L1, R1, L2, R2, OPTIONS, SHARE, L3, R3, DPAD, PS
 */
export const CONTROL_MAPPINGS: Record<GameContext, Partial<Record<GamepadButtonName, GameAction>>> = {
  // ============================================================
  // MENU / NAVEGACAO GERAL
  // ============================================================
  menu: {
    A: "confirm",           // Xbox A / PS X - Confirmar selecao
    B: "back",              // Xbox B / PS O - Voltar
    X: "show_stats",        // Xbox X / PS □ - Ver detalhes/stats
    Y: "open_menu",         // Xbox Y / PS △ - Menu de opcoes
    LB: "tab_left",         // Xbox LB / PS L1 - Tab anterior
    RB: "tab_right",        // Xbox RB / PS R1 - Proxima tab
    LT: "scroll_up",        // Xbox LT / PS L2 - Scroll rapido cima
    RT: "scroll_down",      // Xbox RT / PS R2 - Scroll rapido baixo
    START: "open_menu",     // Xbox Start / PS Options - Menu
    SELECT: "quick_save",   // Xbox Select / PS Share - Salvar
    DPAD_UP: "navigate_up",
    DPAD_DOWN: "navigate_down",
    DPAD_LEFT: "navigate_left",
    DPAD_RIGHT: "navigate_right",
    HOME: "pause_resume",   // Xbox / PS - Pausar/Home
  },

  // ============================================================
  // TELA DE PRE-JOGO
  // ============================================================
  match_preview: {
    A: "confirm",           // Iniciar partida / Confirmar
    B: "back",              // Voltar ao dashboard
    X: "show_tactics",      // Ver/Editar tatica
    Y: "substitute",        // Abrir substituicoes
    LB: "tab_left",         // Trocar uniforme (anterior)
    RB: "tab_right",        // Trocar uniforme (proximo)
    LT: "change_formation", // Formacao anterior
    RT: "change_formation", // Proxima formacao
    START: "skip_to_result",// Simular rapido
    SELECT: "show_stats",   // Ver estatisticas H2H
    DPAD_UP: "navigate_up",
    DPAD_DOWN: "navigate_down",
    DPAD_LEFT: "navigate_left",
    DPAD_RIGHT: "navigate_right",
    HOME: "back",
  },

  // ============================================================
  // PARTIDA AO VIVO
  // ============================================================
  match_live: {
    A: "fast_forward",      // Acelerar simulacao
    B: "slow_motion",       // Desacelerar simulacao
    X: "skip_to_result",    // Avancar diretamente ao resultado
    Y: "substitute",        // Abrir substituicoes
    LB: "tab_left",         // Evento anterior
    RB: "tab_right",        // Proximo evento
    LT: "show_tactics",     // Ver campo tatico
    RT: "change_camera",    // Trocar camera
    START: "pause_resume",  // PAUSAR PARTIDA
    SELECT: "skip_to_result",// Ir direto ao resultado
    L3: "toggle_music",     // Ligar/desligar musica
    R3: "screenshot",       // Screenshot
    DPAD_UP: "navigate_up",
    DPAD_DOWN: "navigate_down",
    DPAD_LEFT: "navigate_left",
    DPAD_RIGHT: "navigate_right",
    HOME: "pause_resume",   // PAUSAR PARTIDA
  },

  // ============================================================
  // PARTIDA PAUSADA
  // ============================================================
  match_paused: {
    A: "confirm",           // Confirmar opcao do menu
    B: "pause_resume",      // CONTINUAR PARTIDA
    X: "show_stats",        // Ver estatisticas
    Y: "substitute",        // Abrir substituicoes
    LB: "tab_left",
    RB: "tab_right",
    START: "pause_resume",  // CONTINUAR PARTIDA
    SELECT: "skip_to_result",
    DPAD_UP: "navigate_up",
    DPAD_DOWN: "navigate_down",
    DPAD_LEFT: "navigate_left",
    DPAD_RIGHT: "navigate_right",
    HOME: "pause_resume",   // CONTINUAR PARTIDA
  },

  // ============================================================
  // EDITOR TATICO
  // ============================================================
  tactical: {
    A: "select_player",     // Selecionar jogador
    B: "back",              // Fechar editor
    X: "swap_players",      // Trocar jogadores
    Y: "set_captain",       // Definir capitao
    LB: "change_formation", // Formacao anterior
    RB: "change_formation", // Proxima formacao
    LT: "tab_left",         // Tab anterior (Escalacao/Tatica)
    RT: "tab_right",        // Proxima tab
    START: "confirm",       // Confirmar e salvar
    SELECT: "show_stats",   // Ver stats do jogador
    L3: "move_player",      // Modo mover jogador
    R3: "change_camera",    // Rotacionar campo
    DPAD_UP: "navigate_up",
    DPAD_DOWN: "navigate_down",
    DPAD_LEFT: "navigate_left",
    DPAD_RIGHT: "navigate_right",
    HOME: "back",
  },

  // ============================================================
  // TELA DE SUBSTITUICAO
  // ============================================================
  substitution: {
    A: "confirm",           // Confirmar substituicao
    B: "cancel",            // Cancelar
    X: "show_stats",        // Comparar jogadores
    Y: "swap_players",      // Trocar posicao
    LB: "tab_left",         // Filtrar por posicao
    RB: "tab_right",        // Filtrar por posicao
    LT: "scroll_up",        // Scroll lista
    RT: "scroll_down",      // Scroll lista
    START: "confirm",       // Confirmar todas
    SELECT: "cancel",       // Cancelar todas
    DPAD_UP: "navigate_up",
    DPAD_DOWN: "navigate_down",
    DPAD_LEFT: "navigate_left",
    DPAD_RIGHT: "navigate_right",
    HOME: "cancel",
  },

  // ============================================================
  // CALENDARIO
  // ============================================================
  calendar: {
    A: "confirm",           // Selecionar partida
    B: "back",              // Voltar
    X: "show_stats",        // Ver detalhes da partida
    Y: "skip_to_result",    // Simular partida
    LB: "tab_left",         // Mes anterior
    RB: "tab_right",        // Proximo mes
    LT: "scroll_up",
    RT: "scroll_down",
    START: "open_menu",
    SELECT: "quick_save",
    DPAD_UP: "navigate_up",
    DPAD_DOWN: "navigate_down",
    DPAD_LEFT: "navigate_left",
    DPAD_RIGHT: "navigate_right",
    HOME: "back",
  },

  // ============================================================
  // ELENCO
  // ============================================================
  squad: {
    A: "confirm",           // Ver jogador
    B: "back",              // Voltar
    X: "show_stats",        // Comparar jogadores
    Y: "substitute",        // Promover/Rebaixar
    LB: "tab_left",         // Filtrar por posicao
    RB: "tab_right",        // Filtrar por posicao
    LT: "scroll_up",
    RT: "scroll_down",
    START: "open_menu",
    SELECT: "quick_save",
    DPAD_UP: "navigate_up",
    DPAD_DOWN: "navigate_down",
    DPAD_LEFT: "navigate_left",
    DPAD_RIGHT: "navigate_right",
    HOME: "back",
  },

  // ============================================================
  // MERCADO DE TRANSFERENCIAS
  // ============================================================
  transfers: {
    A: "confirm",           // Ver/Negociar jogador
    B: "back",              // Voltar
    X: "show_stats",        // Comparar com elenco
    Y: "open_menu",         // Filtros
    LB: "tab_left",         // Tab anterior
    RB: "tab_right",        // Proxima tab
    LT: "scroll_up",
    RT: "scroll_down",
    START: "open_menu",
    SELECT: "quick_save",
    DPAD_UP: "navigate_up",
    DPAD_DOWN: "navigate_down",
    DPAD_LEFT: "navigate_left",
    DPAD_RIGHT: "navigate_right",
    HOME: "back",
  },

  // ============================================================
  // MODAL GENERICO
  // ============================================================
  modal: {
    A: "confirm",           // Confirmar
    B: "cancel",            // Cancelar/Fechar
    X: "show_stats",        // Acao secundaria
    Y: "open_menu",         // Acao terciaria
    START: "confirm",
    SELECT: "cancel",
    DPAD_UP: "navigate_up",
    DPAD_DOWN: "navigate_down",
    DPAD_LEFT: "navigate_left",
    DPAD_RIGHT: "navigate_right",
    HOME: "cancel",
  },
}

/**
 * Obtem a acao para um botao em um contexto especifico
 */
export function getActionForButton(
  button: GamepadButtonName,
  context: GameContext
): GameAction | undefined {
  return CONTROL_MAPPINGS[context]?.[button]
}

/**
 * Obtem todos os botoes que executam uma acao em um contexto
 */
export function getButtonsForAction(
  action: GameAction,
  context: GameContext
): GamepadButtonName[] {
  const mapping = CONTROL_MAPPINGS[context]
  if (!mapping) return []
  
  return Object.entries(mapping)
    .filter(([_, a]) => a === action)
    .map(([button]) => button as GamepadButtonName)
}

/**
 * Labels para exibicao das acoes
 */
export const ACTION_LABELS: Record<GameAction, string> = {
  navigate_up: "Cima",
  navigate_down: "Baixo",
  navigate_left: "Esquerda",
  navigate_right: "Direita",
  confirm: "Confirmar",
  cancel: "Cancelar",
  back: "Voltar",
  pause_resume: "Pausar/Continuar",
  fast_forward: "Acelerar",
  slow_motion: "Desacelerar",
  skip_to_result: "Simular Rapido",
  show_stats: "Estatisticas",
  show_tactics: "Tatica",
  substitute: "Substituir",
  change_camera: "Camera",
  open_menu: "Menu",
  tab_left: "Tab Anterior",
  tab_right: "Proxima Tab",
  scroll_up: "Scroll Cima",
  scroll_down: "Scroll Baixo",
  select_player: "Selecionar",
  move_player: "Mover",
  change_formation: "Formacao",
  swap_players: "Trocar",
  set_captain: "Capitao",
  quick_save: "Salvar",
  screenshot: "Screenshot",
  toggle_music: "Musica",
}

/**
 * Icones dos botoes para Xbox
 */
export const XBOX_BUTTON_ICONS: Record<string, string> = {
  A: "A",
  B: "B",
  X: "X",
  Y: "Y",
  LB: "LB",
  RB: "RB",
  LT: "LT",
  RT: "RT",
  START: "≡",
  SELECT: "⧉",
  L3: "L3",
  R3: "R3",
  HOME: "⊕",
}

/**
 * Icones dos botoes para PlayStation
 */
export const PLAYSTATION_BUTTON_ICONS: Record<string, string> = {
  A: "✕",
  B: "○",
  X: "□",
  Y: "△",
  LB: "L1",
  RB: "R1",
  LT: "L2",
  RT: "R2",
  START: "OPTIONS",
  SELECT: "SHARE",
  L3: "L3",
  R3: "R3",
  HOME: "PS",
}

/**
 * Cores dos botoes Xbox
 */
export const XBOX_BUTTON_COLORS: Record<string, string> = {
  A: "#107C10", // Verde
  B: "#E81123", // Vermelho
  X: "#0078D7", // Azul
  Y: "#FFB900", // Amarelo
}

/**
 * Cores dos botoes PlayStation
 */
export const PLAYSTATION_BUTTON_COLORS: Record<string, string> = {
  A: "#2E6DB4", // Azul (X)
  B: "#E6003A", // Vermelho (O)
  X: "#D64292", // Rosa (□)
  Y: "#00AC9F", // Verde agua (△)
}

/**
 * Helper para obter hints de controle para exibir na UI
 */
export function getControlHints(
  context: GameContext,
  controllerType: "xbox" | "playstation"
): Array<{ button: string; action: string; color?: string }> {
  const mapping = CONTROL_MAPPINGS[context]
  if (!mapping) return []

  const icons = controllerType === "playstation" ? PLAYSTATION_BUTTON_ICONS : XBOX_BUTTON_ICONS
  const colors = controllerType === "playstation" ? PLAYSTATION_BUTTON_COLORS : XBOX_BUTTON_COLORS

  // Retornar apenas os botoes principais (A, B, X, Y, LB, RB)
  const mainButtons: GamepadButtonName[] = ["A", "B", "X", "Y", "LB", "RB"]
  
  return mainButtons
    .filter(button => mapping[button])
    .map(button => ({
      button: icons[button] || button,
      action: ACTION_LABELS[mapping[button]!] || mapping[button]!,
      color: colors[button],
    }))
}

// AS ACOES DO JOGO — o vocabulario que a interface conhece.
//
// A regra que este arquivo existe para impor: NENHUMA tela do jogo pode falar
// "botao A", "button === 0" ou "Cross". Tela fala AÇÃO. Quem traduz aperto em
// acao e o ControllerMapper (lib/controller/profiles.ts) + as amarracoes
// (lib/input/bindings.ts), e so eles.
//
// Por que isso nao e purismo: o mesmo `buttons[0]` e ✕ num DualSense por USB e
// □ num DualShock 4 por Bluetooth sem driver (ver o comentario grande em
// hooks/use-gamepad.ts, que ja custou o bug "meu controle de PlayStation faz a
// acao errada"). Se a tela guardasse o indice, cada controle novo obrigaria a
// caçar indices espalhados por 44 arquivos. Guardando a AÇÃO, controle novo e
// um perfil novo num arquivo so.
//
// ⚠️ Nao confundir com o `GameAction` de lib/gamepad-controls.ts. Aquele e a
// tabela antiga (snake_case, por GameContext de rota) e continua viva porque a
// barra de controles e a partida ao vivo a consomem. A ponte entre as duas esta
// em lib/input/bindings.ts — de proposito num lugar so, para nao existir uma
// terceira tabela daqui a seis meses.

/** Tudo que o jogador consegue PEDIR, independente de como pediu. */
export type GameAction =
  // ── Navegacao ─────────────────────────────────────────────────────────────
  | "UI_UP"
  | "UI_DOWN"
  | "UI_LEFT"
  | "UI_RIGHT"
  | "UI_CONFIRM"
  | "UI_BACK"
  // ── Abas e paginas ────────────────────────────────────────────────────────
  | "TAB_NEXT"
  | "TAB_PREVIOUS"
  | "PAGE_NEXT"
  | "PAGE_PREVIOUS"
  // ── Acoes contextuais ─────────────────────────────────────────────────────
  | "OPEN_ACTIONS"
  | "OPEN_DETAILS"
  | "QUICK_MENU"
  | "SEARCH"
  | "PAUSE"
  | "CONTEXT_SECONDARY"
  // ── Taticas ───────────────────────────────────────────────────────────────
  | "TACTIC_PICK"
  | "TACTIC_DROP"
  | "TACTIC_INSTRUCTIONS"
  | "TACTIC_ROLE"
  // ── Partida ───────────────────────────────────────────────────────────────
  | "MATCH_PAUSE"
  | "MATCH_SPEED_UP"
  | "MATCH_SPEED_DOWN"
  | "MATCH_SKIP"
  | "MATCH_SUBSTITUTE"
  | "MATCH_CAMERA"
  // ── Sistema ───────────────────────────────────────────────────────────────
  | "TOGGLE_INPUT_MODE"

/**
 * Nome que aparece na barra de dicas e na tela de configuracao.
 *
 * Curto de proposito: a barra tem uma linha e precisa ser lida a tres metros da
 * TV. "Confirmar", nao "Confirmar a selecao atual".
 */
export const ROTULO_DA_ACAO: Record<GameAction, string> = {
  UI_UP: "Cima",
  UI_DOWN: "Baixo",
  UI_LEFT: "Esquerda",
  UI_RIGHT: "Direita",
  UI_CONFIRM: "Selecionar",
  UI_BACK: "Voltar",
  TAB_NEXT: "Próxima aba",
  TAB_PREVIOUS: "Aba anterior",
  PAGE_NEXT: "Avançar",
  PAGE_PREVIOUS: "Recuar",
  OPEN_ACTIONS: "Ações",
  OPEN_DETAILS: "Detalhes",
  QUICK_MENU: "Menu rápido",
  SEARCH: "Buscar",
  PAUSE: "Menu",
  CONTEXT_SECONDARY: "Contexto",
  TACTIC_PICK: "Pegar",
  TACTIC_DROP: "Soltar",
  TACTIC_INSTRUCTIONS: "Instruções",
  TACTIC_ROLE: "Função",
  MATCH_PAUSE: "Pausar",
  MATCH_SPEED_UP: "Acelerar",
  MATCH_SPEED_DOWN: "Desacelerar",
  MATCH_SKIP: "Ir ao resultado",
  MATCH_SUBSTITUTE: "Substituir",
  MATCH_CAMERA: "Câmera",
  TOGGLE_INPUT_MODE: "Modo Controle",
}

/**
 * Acoes de NAVEGACAO. O repetidor (lib/input/repeat.ts) so acelera estas: um
 * D-pad segurado tem de descer a lista, mas um A segurado NAO pode confirmar
 * trinta vezes — foi assim que a versao antiga assinava contrato em duplicata
 * quando alguem apoiava o controle no colo.
 */
export const ACOES_REPETIVEIS: ReadonlySet<GameAction> = new Set<GameAction>([
  "UI_UP",
  "UI_DOWN",
  "UI_LEFT",
  "UI_RIGHT",
  "PAGE_NEXT",
  "PAGE_PREVIOUS",
])

/** Origem de uma acao. A interface usa para decidir se mostra glifo ou tecla. */
export type OrigemDaAcao = "gamepad" | "keyboard" | "mouse" | "touch" | "system"

/** Uma acao entregue, com o contexto de quem a pediu. */
export interface EventoDeAcao {
  action: GameAction
  origem: OrigemDaAcao
  /** Repeticao automatica (D-pad segurado), nao um aperto novo. */
  repetida: boolean
  /** Contexto que estava no topo da pilha no instante do aperto. */
  contexto: string
  /** `performance.now()` do aperto — para medir latencia na tela de depuracao. */
  instante: number
}

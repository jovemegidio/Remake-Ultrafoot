// AMARRACOES — botao fisico + contexto => acao do jogo.
//
// Este e o UNICO lugar onde hardware encosta em regra de jogo. Acima dele so
// existe `GameAction`; abaixo, so existe `PhysicalButton`. Uma tela nova nao
// precisa abrir este arquivo: ela declara o contexto e escuta acoes.
//
// ── Por que a tabela e por camadas ──────────────────────────────────────────
// `PADRAO` vale em toda parte. Cada contexto so declara o que MUDA. Uma tabela
// completa por contexto (foi assim que CONTROL_MAPPINGS nasceu, em
// lib/gamepad-controls.ts) envelhece mal: quando "voltar" mudou de botao, era
// preciso lembrar de mudar em dez tabelas, e as que ficassem para tras viravam
// telas onde o B fazia outra coisa. Com camadas, "voltar" muda num lugar.
//
// ── Remapeamento ────────────────────────────────────────────────────────────
// `resolverAcao` consulta primeiro as amarracoes do jogador. Nenhuma acao
// critica esta presa ao layout fisico — e o que permite oferecer remapeamento
// depois sem reescrever nada (acessibilidade).

import type { GameAction } from "./actions"
import type { InputContext } from "./contexts"
import type { PhysicalButton } from "@/lib/controller/profiles"

export type TabelaDeBotoes = Partial<Record<PhysicalButton, GameAction>>

/**
 * O padrao do jogo. Segue a convencao de console de PC:
 * botao de baixo confirma, botao da direita volta.
 */
export const PADRAO: TabelaDeBotoes = {
  FACE_DOWN: "UI_CONFIRM",
  FACE_RIGHT: "UI_BACK",
  FACE_LEFT: "OPEN_ACTIONS",
  FACE_UP: "OPEN_DETAILS",

  DPAD_UP: "UI_UP",
  DPAD_DOWN: "UI_DOWN",
  DPAD_LEFT: "UI_LEFT",
  DPAD_RIGHT: "UI_RIGHT",

  SHOULDER_L: "TAB_PREVIOUS",
  SHOULDER_R: "TAB_NEXT",
  TRIGGER_L: "PAGE_PREVIOUS",
  TRIGGER_R: "PAGE_NEXT",

  SELECT: "CONTEXT_SECONDARY",
  START: "PAUSE",
  STICK_R: "SEARCH",

  CENTER: "TOGGLE_INPUT_MODE",
}

/**
 * So o que cada contexto MUDA em relacao ao padrao.
 *
 * A partida tem tabela propria de proposito: reaproveitar o mapa de menu ali
 * seria pedir que o jogador aperte "confirmar" no meio de um lance. Ver o
 * requisito de Action Set separado.
 */
export const POR_CONTEXTO: Partial<Record<InputContext, TabelaDeBotoes>> = {
  MATCH: {
    // O losango vira acao de jogo; nada aqui confirma nem volta por engano.
    FACE_DOWN: "MATCH_SPEED_UP",
    FACE_RIGHT: "MATCH_SPEED_DOWN",
    FACE_LEFT: "MATCH_SKIP",
    FACE_UP: "MATCH_SUBSTITUTE",
    TRIGGER_L: "MATCH_SPEED_DOWN",
    TRIGGER_R: "MATCH_SPEED_UP",
    START: "MATCH_PAUSE",
    STICK_R: "MATCH_CAMERA",
  },

  TACTICS: {
    // Pegar e soltar no MESMO botao: e o gesto de prancheta, e evita que o
    // jogador precise decorar dois. A tela sabe em qual metade do gesto esta.
    FACE_DOWN: "TACTIC_PICK",
    FACE_LEFT: "TACTIC_INSTRUCTIONS",
    TRIGGER_L: "TACTIC_ROLE",
    TRIGGER_R: "TACTIC_INSTRUCTIONS",
  },

  MODAL: {
    // Um modal nao tem "aba" nem "pagina": esses botoes viram navegacao entre
    // os focaveis dele. Sem isso, LB/RB vazavam para a tela DE TRAS e trocavam
    // a aba escondida atras do modal.
    SHOULDER_L: "UI_UP",
    SHOULDER_R: "UI_DOWN",
    TRIGGER_L: "UI_UP",
    TRIGGER_R: "UI_DOWN",
    FACE_LEFT: "OPEN_ACTIONS",
    FACE_UP: "OPEN_DETAILS",
  },

  QUICK_MENU: {
    // O menu rapido fecha com qualquer coisa que signifique "sai daqui".
    FACE_RIGHT: "UI_BACK",
    SELECT: "UI_BACK",
    START: "UI_BACK",
  },

  PLAYER_PROFILE: {
    // Perfil do atleta: os ombros passam de aba para ATLETA anterior/proximo —
    // e o gesto que faz a ficha valer a pena no controle.
    SHOULDER_L: "PAGE_PREVIOUS",
    SHOULDER_R: "PAGE_NEXT",
  },
}

/** Amarracoes do jogador (Configuracoes ▸ Reconfigurar controles). */
export type AmarracoesDoJogador = Partial<Record<InputContext | "PADRAO", TabelaDeBotoes>>

/**
 * Resolve o aperto.
 *
 * Ordem: jogador-no-contexto, jogador-no-padrao, jogo-no-contexto,
 * jogo-no-padrao. A escolha explicita do jogador sempre vence a nossa.
 */
export function resolverAcao(
  botao: PhysicalButton,
  contexto: InputContext,
  doJogador?: AmarracoesDoJogador,
): GameAction | null {
  return (
    doJogador?.[contexto]?.[botao] ??
    doJogador?.PADRAO?.[botao] ??
    POR_CONTEXTO[contexto]?.[botao] ??
    PADRAO[botao] ??
    null
  )
}

/**
 * Caminho inverso: qual botao mostrar para uma acao.
 *
 * A barra de dicas e a tela de configuracoes precisam disso, e precisam da
 * MESMA resposta que `resolverAcao` daria — senao a barra ensina um botao e o
 * jogo obedece a outro, que e o pior tipo de bug de interface porque parece
 * mentira deliberada.
 */
export function botaoDaAcao(
  acao: GameAction,
  contexto: InputContext,
  doJogador?: AmarracoesDoJogador,
): PhysicalButton | null {
  const camadas: (TabelaDeBotoes | undefined)[] = [
    doJogador?.[contexto],
    doJogador?.PADRAO,
    POR_CONTEXTO[contexto],
    PADRAO,
  ]
  for (const camada of camadas) {
    if (!camada) continue
    for (const [botao, mapeada] of Object.entries(camada)) {
      if (mapeada === acao) return botao as PhysicalButton
    }
  }
  return null
}

// ── Ponte com a tabela antiga ───────────────────────────────────────────────
//
// 44 arquivos ouvem `gamepad:button` com nomes de botao Xbox ("A", "LB",
// "DPAD_UP"). Eles continuam funcionando: o InputManager reemite esses eventos.
// Este mapa e a traducao, e existe SO aqui para nao nascer uma terceira tabela.
export const NOME_LEGADO: Record<PhysicalButton, string> = {
  FACE_DOWN: "A",
  FACE_RIGHT: "B",
  FACE_LEFT: "X",
  FACE_UP: "Y",
  SHOULDER_L: "LB",
  SHOULDER_R: "RB",
  TRIGGER_L: "LT",
  TRIGGER_R: "RT",
  SELECT: "SELECT",
  START: "START",
  STICK_L: "L3",
  STICK_R: "R3",
  DPAD_UP: "DPAD_UP",
  DPAD_DOWN: "DPAD_DOWN",
  DPAD_LEFT: "DPAD_LEFT",
  DPAD_RIGHT: "DPAD_RIGHT",
  CENTER: "HOME",
  TOUCHPAD: "TOUCHPAD",
}

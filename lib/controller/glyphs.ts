// GLIFOS — um so lugar decide se o botao de baixo se desenha como "A" ou "✕".
//
// ── Por que nao ha PNG/SVG em disco ─────────────────────────────────────────
// O pedido original era uma pasta `assets/controller/{xbox,playstation}/`. Nao
// fizemos assim, e o motivo e concreto neste projeto: o jogo e exportado
// estaticamente e servido pelo protocolo `game-asset://` do Tauri, onde o
// bundler ACHATA subpastas — um caminho como `controller/xbox/a.svg` ja quebrou
// aqui antes e o sintoma e um icone invisivel no app instalado, que nao aparece
// em `npm run dev` nenhuma vez.
//
// Glifo desenhado em SVG inline nao tem caminho, nao tem 404, herda `currentColor`
// (entao segue o tema e o contraste sem uma segunda arte), e escala de 12 px a
// 48 px sem borrar — o requisito de legibilidade em 1080p, 1440p, 4K e handheld
// sai de graca. Vinte arquivos de arte resolveriam pior e ainda pesariam no
// instalador.
//
// ── Uma so fonte de verdade ─────────────────────────────────────────────────
// A interface pede `glifoDaAcao("UI_CONFIRM")`. Ela nunca pergunta "que botao
// e esse" nem escolhe simbolo. Trocar de DualSense para Xbox no meio da partida
// muda o retorno desta funcao e a tela inteira se atualiza sozinha.

import type { GameAction } from "@/lib/input/actions"
import { botaoDaAcao, type AmarracoesDoJogador } from "@/lib/input/bindings"
import type { InputContext } from "@/lib/input/contexts"
import type { PhysicalButton } from "./profiles"

export type FamiliaDeGlifo = "xbox" | "playstation" | "nintendo" | "generic"

export type FormaDeGlifo =
  | "texto"
  | "cruz"
  | "circulo"
  | "quadrado"
  | "triangulo"
  | "dpad_cima"
  | "dpad_baixo"
  | "dpad_esquerda"
  | "dpad_direita"
  | "menu"
  | "view"
  | "stick"

export interface Glifo {
  /** O que desenhar. `texto` usa `rotulo`. */
  forma: FormaDeGlifo
  /** Texto do glifo quando `forma === "texto"` ("A", "LB", "R1"). */
  rotulo: string
  /** Cor da marca do botao, quando existe. Sempre com contraste conferido. */
  cor?: string
  /** Nome acessivel, lido por leitor de tela. */
  descricao: string
  /** Formato do contorno. Ombro e gatilho sao "pilulas", nao circulos. */
  contorno: "circulo" | "pilula"
}

// ── Cores ───────────────────────────────────────────────────────────────────
// As oficiais da Microsoft e da Sony, com uma correcao: o ✕ do DualSense e azul
// escuro e o ○ e vermelho escuro, e ambos somem sobre o fundo escuro do jogo.
// Os valores abaixo sao as mesmas cores CLAREADAS o suficiente para passar em
// contraste sobre `#0a0e1a` — ninguem percebe a diferenca de matiz, todo mundo
// percebe um glifo ilegivel.

const XBOX = { a: "#3BA55C", b: "#E8495B", x: "#3B8BE8", y: "#F2C037" }
const SONY = { cruz: "#7FA8E8", circulo: "#F06A80", quadrado: "#E88BC4", triangulo: "#5FD6C8" }

function g(
  forma: FormaDeGlifo,
  rotulo: string,
  descricao: string,
  cor?: string,
  contorno: "circulo" | "pilula" = "circulo",
): Glifo {
  return { forma, rotulo, descricao, cor, contorno }
}

/**
 * Tabela por familia. Repare que a chave e o botao FISICO (posicao), nunca o
 * nome comercial — e por isso que "o de baixo" acha o simbolo certo em qualquer
 * controle sem nenhum `if` no meio da interface.
 */
const TABELA: Record<FamiliaDeGlifo, Partial<Record<PhysicalButton, Glifo>>> = {
  xbox: {
    FACE_DOWN: g("texto", "A", "botão A", XBOX.a),
    FACE_RIGHT: g("texto", "B", "botão B", XBOX.b),
    FACE_LEFT: g("texto", "X", "botão X", XBOX.x),
    FACE_UP: g("texto", "Y", "botão Y", XBOX.y),
    SHOULDER_L: g("texto", "LB", "botão LB", undefined, "pilula"),
    SHOULDER_R: g("texto", "RB", "botão RB", undefined, "pilula"),
    TRIGGER_L: g("texto", "LT", "gatilho LT", undefined, "pilula"),
    TRIGGER_R: g("texto", "RT", "gatilho RT", undefined, "pilula"),
    SELECT: g("view", "View", "botão View", undefined, "pilula"),
    START: g("menu", "Menu", "botão Menu", undefined, "pilula"),
    STICK_L: g("stick", "L3", "clique do analógico esquerdo"),
    STICK_R: g("stick", "R3", "clique do analógico direito"),
    DPAD_UP: g("dpad_cima", "▲", "direcional para cima"),
    DPAD_DOWN: g("dpad_baixo", "▼", "direcional para baixo"),
    DPAD_LEFT: g("dpad_esquerda", "◀", "direcional para a esquerda"),
    DPAD_RIGHT: g("dpad_direita", "▶", "direcional para a direita"),
    CENTER: g("texto", "Xbox", "botão Xbox", undefined, "pilula"),
  },
  playstation: {
    FACE_DOWN: g("cruz", "✕", "botão Cruz", SONY.cruz),
    FACE_RIGHT: g("circulo", "○", "botão Círculo", SONY.circulo),
    FACE_LEFT: g("quadrado", "□", "botão Quadrado", SONY.quadrado),
    FACE_UP: g("triangulo", "△", "botão Triângulo", SONY.triangulo),
    SHOULDER_L: g("texto", "L1", "botão L1", undefined, "pilula"),
    SHOULDER_R: g("texto", "R1", "botão R1", undefined, "pilula"),
    TRIGGER_L: g("texto", "L2", "gatilho L2", undefined, "pilula"),
    TRIGGER_R: g("texto", "R2", "gatilho R2", undefined, "pilula"),
    SELECT: g("view", "Create", "botão Create/Share", undefined, "pilula"),
    START: g("menu", "Options", "botão Options", undefined, "pilula"),
    STICK_L: g("stick", "L3", "clique do analógico esquerdo"),
    STICK_R: g("stick", "R3", "clique do analógico direito"),
    DPAD_UP: g("dpad_cima", "▲", "direcional para cima"),
    DPAD_DOWN: g("dpad_baixo", "▼", "direcional para baixo"),
    DPAD_LEFT: g("dpad_esquerda", "◀", "direcional para a esquerda"),
    DPAD_RIGHT: g("dpad_direita", "▶", "direcional para a direita"),
    CENTER: g("texto", "PS", "botão PS", undefined, "pilula"),
  },
  // Nintendo inverte A/B e X/Y em relacao ao Xbox. A tabela ja resolve porque a
  // chave e a POSICAO: o botao de baixo do Switch e o B, e e isso que aparece.
  nintendo: {
    FACE_DOWN: g("texto", "B", "botão B"),
    FACE_RIGHT: g("texto", "A", "botão A"),
    FACE_LEFT: g("texto", "Y", "botão Y"),
    FACE_UP: g("texto", "X", "botão X"),
    SHOULDER_L: g("texto", "L", "botão L", undefined, "pilula"),
    SHOULDER_R: g("texto", "R", "botão R", undefined, "pilula"),
    TRIGGER_L: g("texto", "ZL", "gatilho ZL", undefined, "pilula"),
    TRIGGER_R: g("texto", "ZR", "gatilho ZR", undefined, "pilula"),
    SELECT: g("view", "-", "botão menos", undefined, "pilula"),
    START: g("menu", "+", "botão mais", undefined, "pilula"),
    STICK_L: g("stick", "L3", "clique do analógico esquerdo"),
    STICK_R: g("stick", "R3", "clique do analógico direito"),
    DPAD_UP: g("dpad_cima", "▲", "direcional para cima"),
    DPAD_DOWN: g("dpad_baixo", "▼", "direcional para baixo"),
    DPAD_LEFT: g("dpad_esquerda", "◀", "direcional para a esquerda"),
    DPAD_RIGHT: g("dpad_direita", "▶", "direcional para a direita"),
    CENTER: g("texto", "HOME", "botão Home", undefined, "pilula"),
  },
  generic: {
    FACE_DOWN: g("texto", "1", "botão 1"),
    FACE_RIGHT: g("texto", "2", "botão 2"),
    FACE_LEFT: g("texto", "3", "botão 3"),
    FACE_UP: g("texto", "4", "botão 4"),
    SHOULDER_L: g("texto", "L1", "ombro esquerdo", undefined, "pilula"),
    SHOULDER_R: g("texto", "R1", "ombro direito", undefined, "pilula"),
    TRIGGER_L: g("texto", "L2", "gatilho esquerdo", undefined, "pilula"),
    TRIGGER_R: g("texto", "R2", "gatilho direito", undefined, "pilula"),
    SELECT: g("view", "Select", "botão Select", undefined, "pilula"),
    START: g("menu", "Start", "botão Start", undefined, "pilula"),
    STICK_L: g("stick", "L3", "clique do analógico esquerdo"),
    STICK_R: g("stick", "R3", "clique do analógico direito"),
    DPAD_UP: g("dpad_cima", "▲", "direcional para cima"),
    DPAD_DOWN: g("dpad_baixo", "▼", "direcional para baixo"),
    DPAD_LEFT: g("dpad_esquerda", "◀", "direcional para a esquerda"),
    DPAD_RIGHT: g("dpad_direita", "▶", "direcional para a direita"),
    CENTER: g("texto", "◉", "botão central", undefined, "pilula"),
  },
}

export function glifoDoBotao(botao: PhysicalButton, familia: FamiliaDeGlifo): Glifo | null {
  return TABELA[familia][botao] ?? TABELA.generic[botao] ?? null
}

/**
 * O caminho que a interface usa: acao → glifo.
 *
 * Passa pelo MESMO `botaoDaAcao` que o gerente usa para resolver o aperto. Se
 * um dia forem tabelas diferentes, a barra de dicas ensina um botao e o jogo
 * obedece a outro — mentira que o jogador enxerga na hora.
 */
export function glifoDaAcao(
  acao: GameAction,
  familia: FamiliaDeGlifo,
  contexto: InputContext,
  amarracoes?: AmarracoesDoJogador,
): Glifo | null {
  const botao = botaoDaAcao(acao, contexto, amarracoes)
  return botao ? glifoDoBotao(botao, familia) : null
}

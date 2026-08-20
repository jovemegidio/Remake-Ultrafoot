"use client"

// CONTROLE PADRAO DE TELA — uma linha por tela, convencao unica.
//
// A auditoria de 23/07/2026 encontrou o problema: existia uma tabela oficial
// (CONTROL_MAPPINGS em lib/gamepad-controls.ts), mas SO a partida ao vivo a
// usava. As outras telas escreviam handlers proprios, cada uma do seu jeito —
// 16 telas sem controle nenhum, 5 so com "B", e o "B" fazendo coisa diferente
// em cada uma (router.back, hardNavigate fixo, fechar modal).
//
// Este hook aplica o contexto "menu" da tabela oficial: B volta, Y abre o menu
// [W], LB/RB trocam aba, D-pad navega. A tela so precisa dizer o que e "voltar"
// e, se quiser, o que sao suas abas/itens.
//
//   useTelaGamepad({ aoVoltar: () => hardNavigate("/") })
//
// Telas que ja tem handler proprio continuam funcionando — este hook e aditivo e
// respeita `quando: false` para desligar (ex.: com um modal aberto).

import { useEffect, useRef } from "react"
import { hardNavigate } from "@/lib/hard-navigation"
import { dialogoAberto } from "@/components/gamepad-modal-bridge"
import { modalidadeDoSave } from "@/lib/modalidade-de-carreira"
import { loadGameState } from "@/lib/save-system"
import { gerenteDeFoco } from "@/lib/focus/manager"
import type { InputContext } from "@/lib/input/contexts"
import type { DicaDeControle } from "@/lib/input/hints"
import { useContextoDeInput, useDicasDeControle } from "@/hooks/use-input"

/** Para onde o B volta quando a tela nao diz. Depende da modalidade do save. */
function escritorioDaModalidade(): string {
  try {
    const modalidade = modalidadeDoSave(loadGameState())
    if (modalidade === "sub20") return "/base/carreira"
    if (modalidade === "jogador") return "/carreira/jogador"
  } catch { /* save ilegivel: o escritorio padrao serve */ }
  return "/"
}

/**
 * Navegacao da tela — gerente de foco primeiro, nada depois.
 *
 * ⚠️ Aqui NAO ha varredura de DOM de proposito, e a diferenca importa: quem
 * varre o DOM nesta arvore e a camada global
 * (components/gamepad-navegacao-global.tsx), e ela so age quando NENHUMA tela
 * assumiu o gamepad (`telaAssumiuOGamepad()`). Como este hook incrementa
 * `telasAtivas`, as duas sao mutuamente exclusivas por construcao — duplicar a
 * varredura aqui faria o foco andar DUAS casas por aperto nas telas que usam o
 * hook, que e exatamente o conflito que desligou o piloto automatico do provider.
 */
function navegar(direcao: "up" | "down" | "left" | "right"): boolean {
  return gerenteDeFoco.mover(direcao, true)
}

function confirmar(): boolean {
  return gerenteDeFoco.activate()
}

export interface OpcoesTelaGamepad {
  /** O que "voltar" (B) faz nesta tela. Padrao: volta ao escritorio. */
  aoVoltar?: () => void
  /** Aba/item anterior (LB) e proximo (RB). */
  aoAbaAnterior?: () => void
  aoAbaProxima?: () => void
  /** Navegacao no D-pad, quando a tela tem lista. */
  aoNavegar?: (direcao: "up" | "down" | "left" | "right") => void
  /** Confirmar (A) — normalmente abrir o item em foco. */
  aoConfirmar?: () => void
  /**
   * Acao secundaria (X). Na tabela oficial o X e "ver detalhes/estatisticas" —
   * as telas que tem um "ver ficha" devem ligar aqui.
   */
  aoDetalhes?: () => void
  /** Rolagem rapida da lista (LT/RT). Sem isso listas longas so andam item a item. */
  aoRolar?: (direcao: "up" | "down") => void
  /** Desliga o hook (ex.: modal aberto cuida do proprio input). */
  quando?: boolean
  /**
   * Contexto de input desta tela. Padrao: "MENU".
   *
   * Declarar o contexto certo muda o mapeamento (a partida usa um conjunto
   * proprio de acoes) e a barra de dicas. Ver lib/input/contexts.ts.
   */
  contexto?: InputContext
  /** Dicas da barra inferior. Sem isto sao DERIVADAS do que a tela declarou. */
  dicas?: readonly DicaDeControle[]
}

/**
 * Dicas a partir do que a tela ja disse que faz.
 *
 * E o motivo de as telas que usam este hook terem ganhado barra de dicas sem que
 * nenhuma fosse editada: quem passa `aoConfirmar` e `aoDetalhes` ja declarou,
 * implicitamente, que tem "selecionar" e "ver ficha". Pedir que repita isso numa
 * lista de dicas seria duplicar a informacao, e a copia e que envelheceria.
 */
function dicasDerivadas(o: OpcoesTelaGamepad): DicaDeControle[] {
  const dicas: DicaDeControle[] = [{ acao: "UI_CONFIRM" }, { acao: "UI_BACK" }]
  if (o.aoDetalhes) dicas.push({ acao: "OPEN_DETAILS" })
  if (o.aoAbaAnterior || o.aoAbaProxima) dicas.push({ acao: "TAB_NEXT" })
  if (o.aoRolar) dicas.push({ acao: "PAGE_NEXT", rotulo: "Rolar" })
  return dicas
}

/**
 * Quantas telas estao com o controle assumido AGORA.
 *
 * A camada global (components/gamepad-navegacao-global.tsx) so age quando este
 * numero e zero. Sem isso o B voltaria duas vezes e o A clicaria o item errado —
 * foi exatamente por esse conflito que o piloto automatico do provider ficou
 * desligado, deixando 47 das 64 telas sem controle nenhum.
 */
let telasAtivas = 0
export const telaAssumiuOGamepad = (): boolean => telasAtivas > 0

export function useTelaGamepad(opcoes: OpcoesTelaGamepad = {}): void {
  // Tudo em ref: o listener e registrado UMA vez e le sempre a versao atual,
  // sem se re-registrar a cada render (foi o bug que matou o gamepad antes).
  const ref = useRef(opcoes)
  ref.current = opcoes

  // Contexto e dicas vem de graca para as telas que ja usavam este hook.
  useContextoDeInput(opcoes.contexto ?? "MENU", opcoes.quando !== false)
  useDicasDeControle(opcoes.dicas ?? dicasDerivadas(opcoes), opcoes.quando !== false)

  useEffect(() => {
    const onBotao = (e: Event) => {
      const o = ref.current
      if (o.quando === false) return
      // MODAL ABERTO MANDA. Quem cuida do input aí é a GamepadModalBridge; sem
      // esta guarda o B fechava o modal E voltava de tela no mesmo aperto —
      // exatamente o "voltou em dobro" que obrigava cada tela a lembrar de
      // passar `quando: false`. Agora é automático para todas.
      if (dialogoAberto()) return
      const { button } = (e as CustomEvent<{ button: string }>).detail ?? {}
      switch (button) {
        case "B":
          // Convencao unica: B SEMPRE volta. Sem destino informado, volta ao
          // escritorio (a tela inicial da carreira).
          // Sem destino informado, volta ao escritorio DA MODALIDADE — nao a
          // "/". Numa carreira de atleta ou de base, "/" mandava para o
          // escritorio do tecnico e a GuardaDeModalidade devolvia em seguida:
          // dois saltos de tela para uma tecla de "voltar", com o piscar no meio.
          if (o.aoVoltar) o.aoVoltar()
          else hardNavigate(escritorioDaModalidade())
          break
        case "A":
          if (o.aoConfirmar) o.aoConfirmar()
          else confirmar()
          break
        case "LB":
          o.aoAbaAnterior?.()
          break
        case "RB":
          o.aoAbaProxima?.()
          break
        case "X":
          o.aoDetalhes?.()
          break
        case "LT":
          // Sem fallback para navegar: em lista longa o gatilho tem de rolar de
          // verdade. Quem nao define `aoRolar` cai no passo simples do D-pad.
          if (o.aoRolar) o.aoRolar("up")
          else o.aoNavegar?.("up")
          break
        case "RT":
          if (o.aoRolar) o.aoRolar("down")
          else o.aoNavegar?.("down")
          break
        case "DPAD_UP":
          if (o.aoNavegar) o.aoNavegar("up"); else navegar("up")
          break
        case "DPAD_DOWN":
          if (o.aoNavegar) o.aoNavegar("down"); else navegar("down")
          break
        case "DPAD_LEFT":
          if (o.aoNavegar) o.aoNavegar("left"); else navegar("left")
          break
        case "DPAD_RIGHT":
          if (o.aoNavegar) o.aoNavegar("right"); else navegar("right")
          break
        // Y/START abrem o menu [W] — tratado globalmente pelo game-header.
      }
    }
    telasAtivas++
    window.addEventListener("gamepad:button", onBotao)
    return () => {
      telasAtivas = Math.max(0, telasAtivas - 1)
      window.removeEventListener("gamepad:button", onBotao)
    }
  }, [])
}

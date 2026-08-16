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
          if (o.aoVoltar) o.aoVoltar()
          else hardNavigate("/")
          break
        case "A":
          o.aoConfirmar?.()
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
        case "DPAD_UP": o.aoNavegar?.("up"); break
        case "DPAD_DOWN": o.aoNavegar?.("down"); break
        case "DPAD_LEFT": o.aoNavegar?.("left"); break
        case "DPAD_RIGHT": o.aoNavegar?.("right"); break
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

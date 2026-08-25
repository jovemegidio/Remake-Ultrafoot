"use client"

// CONTROLE EM TODA TELA — a camada que cobre o que ninguem cobriu.
//
// ⚠️ POR QUE EXISTE. O provider tinha um "piloto automatico" global que foi
// DESLIGADO (ver components/gamepad-provider.tsx): ele brigava com o handler da
// propria tela — o B voltava duas vezes, o A clicava um item da sidebar no meio
// de outra acao. A saida na epoca foi cada tela cuidar do proprio input; o custo
// foi ficarem 47 das 64 telas sem controle nenhum.
//
// Esta camada resolve os dois lados: ela so age quando NENHUMA tela assumiu o
// gamepad (`telaAssumiuOGamepad()`) e nenhum dialogo esta aberto. Onde a tela
// tem handler proprio, nada muda; onde nao tem, o jogador passa a navegar.
//
// E ela nao depende de registro: varre o DOM atras dos focaveis de verdade
// (botao, link, aba, campo) que estao VISIVEIS, e navega por geometria. Assim
// vale para telas que ainda nem existem, sem uma linha por tela.

import { useEffect, useRef } from "react"
import { telaAssumiuOGamepad } from "@/hooks/use-tela-gamepad"
import { dialogoAberto } from "@/components/gamepad-modal-bridge"
import {
  ATRIBUTO_FOCADO as ATRIBUTO, focaveis, rolavel, vizinho,
  type Caixa, type Direcao,
} from "@/lib/focus/varredura"

// Reexportados: `escolherVizinho` e os tipos tinham consumidores neste
// caminho antes da extração, e quebrar o import deles seria cobrar de
// outras telas um refactor que não é delas.
export { escolherVizinho } from "@/lib/focus/varredura"
export type { Caixa, Direcao }

// ⚠️ A GEOMETRIA MORA EM `lib/focus/varredura` DESDE A 1.0.374, e não aqui.
// Ela nasceu neste arquivo e funcionava — o problema é que só funcionava neste
// arquivo. As telas da carreira de jogador chamavam `useTelaGamepad` só para
// declarar o "voltar", o que marca a tela como dona do gamepad e DESLIGA esta
// camada: elas ficavam com um controle que só voltava, e nenhum dos dois
// arquivos, lido sozinho, mostrava o problema.
//
// Duplicar a varredura lá teria sido pior: dois cálculos de vizinho envelhecem
// separados, e este projeto já teve duas escalas para a mesma grandeza mais de
// uma vez. Agora existe uma só, e quem quiser navegação a importa.

export function GamepadNavegacaoGlobal() {
  const focadoRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const marcar = (el: HTMLElement | null) => {
      const antigo = focadoRef.current
      if (antigo && antigo !== el) antigo.removeAttribute(ATRIBUTO)
      focadoRef.current = el
      if (!el) return
      el.setAttribute(ATRIBUTO, "true")
      el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" })
      try { el.focus({ preventScroll: true }) } catch { /* elemento sem foco proprio */ }
    }

    const navegar = (direcao: "up" | "down" | "left" | "right") => {
      const atual = focadoRef.current
      // Sem foco ainda (ou o foco morreu numa troca de tela): comeca no primeiro.
      if (!atual || !atual.isConnected) { marcar(focaveis()[0] ?? null); return }
      const proximo = vizinho(atual, direcao)
      if (proximo) { marcar(proximo); return }
      // Chegou na borda: rola e tenta de novo, senao a lista longa trava no fim
      // do que esta visivel.
      const cx = rolavel(atual)
      const passo = direcao === "down" ? 240 : direcao === "up" ? -240 : 0
      if (passo) {
        cx.scrollBy({ top: passo, behavior: "smooth" })
        setTimeout(() => {
          const depois = vizinho(atual, direcao)
          if (depois) marcar(depois)
        }, 180)
      }
    }

    const onBotao = (e: Event) => {
      // A tela manda. Esta camada e so o que sobra.
      if (telaAssumiuOGamepad() || dialogoAberto()) return
      const { button } = (e as CustomEvent<{ button: string }>).detail ?? {}
      switch (button) {
        case "DPAD_UP": navegar("up"); break
        case "DPAD_DOWN": navegar("down"); break
        case "DPAD_LEFT": navegar("left"); break
        case "DPAD_RIGHT": navegar("right"); break
        case "A": {
          const el = focadoRef.current
          if (el?.isConnected) el.click()
          else marcar(focaveis()[0] ?? null)
          break
        }
        case "B":
          // Convencao unica do jogo: B volta. Aqui e o historico, porque a
          // camada global nao sabe qual e o "pai" desta tela.
          if (window.history.length > 1) window.history.back()
          break
        case "LB":
        case "RB": {
          const abas = Array.from(document.querySelectorAll<HTMLElement>('[role="tab"]'))
          if (abas.length < 2) break
          const atual = abas.findIndex(t => t.getAttribute("aria-selected") === "true" || t === focadoRef.current)
          const base = atual < 0 ? 0 : atual
          const alvo = abas[(base + (button === "RB" ? 1 : abas.length - 1)) % abas.length]
          alvo.click(); marcar(alvo)
          break
        }
        case "LT":
        case "RT": {
          const cx = rolavel(focadoRef.current)
          cx.scrollBy({ top: button === "RT" ? window.innerHeight * 0.8 : -window.innerHeight * 0.8, behavior: "smooth" })
          break
        }
      }
    }

    window.addEventListener("gamepad:button", onBotao)
    return () => {
      window.removeEventListener("gamepad:button", onBotao)
      focadoRef.current?.removeAttribute(ATRIBUTO)
    }
  }, [])

  return null
}

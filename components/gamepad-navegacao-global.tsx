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

const SELETOR = [
  "button:not([disabled])",
  "a[href]",
  '[role="tab"]',
  '[role="button"]',
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",")

const ATRIBUTO = "data-gamepad-focused"

/** Focaveis visiveis na tela, em ordem de leitura (cima->baixo, esquerda->direita). */
function focaveis(): HTMLElement[] {
  const todos = Array.from(document.querySelectorAll<HTMLElement>(SELETOR))
  return todos
    .filter(el => {
      if (el.hasAttribute("disabled") || el.getAttribute("aria-hidden") === "true") return false
      const r = el.getBoundingClientRect()
      if (r.width < 4 || r.height < 4) return false
      // Fora da janela nao conta: a lista longa so entra no alcance depois de rolar.
      if (r.bottom < 0 || r.top > window.innerHeight) return false
      const s = getComputedStyle(el)
      return s.visibility !== "hidden" && s.display !== "none" && s.pointerEvents !== "none"
    })
    .sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect()
      // Mesma "linha" (tolerancia de 12px) ordena pela horizontal.
      if (Math.abs(ra.top - rb.top) > 12) return ra.top - rb.top
      return ra.left - rb.left
    })
}

export type Direcao = "up" | "down" | "left" | "right"
/** So o que a geometria precisa saber — deixa a escolha testavel sem DOM. */
export interface Caixa { left: number; top: number; width: number; height: number }

/**
 * Qual caixa recebe o foco ao empurrar o direcional. Devolve o INDICE em
 * `candidatos`, ou -1 quando nao ha ninguem naquela direcao.
 *
 * O desvio lateral pesa 2,5x o avanco de proposito: sem isso o "para baixo" num
 * formulario de duas colunas pula para a outra coluna em vez de descer na sua.
 */
export function escolherVizinho(atual: Caixa, candidatos: Caixa[], direcao: Direcao): number {
  const cx = atual.left + atual.width / 2, cy = atual.top + atual.height / 2
  let melhor = -1, melhorCusto = Infinity
  candidatos.forEach((r, i) => {
    const dx = r.left + r.width / 2 - cx
    const dy = r.top + r.height / 2 - cy
    const naDirecao =
      direcao === "up" ? dy < -4 :
      direcao === "down" ? dy > 4 :
      direcao === "left" ? dx < -4 : dx > 4
    if (!naDirecao) return
    const vertical = direcao === "up" || direcao === "down"
    const custo = (vertical ? Math.abs(dy) : Math.abs(dx)) + (vertical ? Math.abs(dx) : Math.abs(dy)) * 2.5
    if (custo < melhorCusto) { melhorCusto = custo; melhor = i }
  })
  return melhor
}

/** O vizinho na direcao pedida, por distancia com peso no eixo do movimento. */
function vizinho(atual: HTMLElement, direcao: Direcao): HTMLElement | null {
  const lista = focaveis().filter(el => el !== atual)
  const i = escolherVizinho(atual.getBoundingClientRect(), lista.map(el => el.getBoundingClientRect()), direcao)
  return i < 0 ? null : lista[i]
}

/** O contenedor que realmente rola sob este elemento (o corpo, quando nenhum). */
function rolavel(de: HTMLElement | null): HTMLElement {
  let no: HTMLElement | null = de
  while (no && no !== document.body) {
    const s = getComputedStyle(no)
    if ((s.overflowY === "auto" || s.overflowY === "scroll") && no.scrollHeight > no.clientHeight + 8) return no
    no = no.parentElement
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement
}

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

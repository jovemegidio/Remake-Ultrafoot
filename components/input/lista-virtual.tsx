"use client"

// LISTA VIRTUAL — renderiza a janela, navega a lista inteira.
//
// ── Por que sem biblioteca ─────────────────────────────────────────────────
// react-window, virtua e @tanstack/react-virtual resolvem a virtualizacao, e
// nenhuma delas resolve o problema que temos: o FOCO precisa alcancar um item
// que nao esta no DOM. Com qualquer uma delas, o D-pad para no ultimo item
// renderizado e a lista "acaba" no meio — o jogador desce a lista de atletas e
// ela trava no item 40 de 700, sem nenhuma pista do motivo.
//
// A ponte com o gerente de foco (`registrarLista` + `resolverPendenteVirtual`)
// seria escrita de qualquer jeito. Com altura FIXA por linha — que e o caso de
// toda tabela deste jogo — a virtualizacao em si sao vinte linhas de conta.
// Uma dependencia a mais custaria mais do que resolve.
//
// ⚠️ Altura de linha FIXA. Item de altura variavel exigiria medicao e cache, e
// ai a biblioteca passaria a valer a pena. Se um dia aparecer essa necessidade,
// e hora de trocar — nao de remendar aqui.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"
import { gerenteDeFoco } from "@/lib/focus/manager"

export interface PropsDaListaVirtual<T> {
  /** Id estavel. E por ele que o gerente de foco pede rolagem. */
  id: string
  itens: readonly T[]
  /** Altura de CADA linha, em pixels. Precisa bater com o que voce desenha. */
  alturaDaLinha: number
  /** Altura visivel. Sem ela, a lista ocupa o container e mede sozinha. */
  altura?: number
  /**
   * Quantas linhas desenhar alem da janela, de cada lado.
   *
   * 4 nao e chute: com o D-pad em repeticao rapida (70 ms), o foco anda ~14
   * linhas por segundo. Com overscan 0, cada passo alem da borda exigiria um
   * ciclo render→registrar→focar e a navegacao engasgaria linha sim, linha nao.
   * Quatro linhas cobrem ~280 ms de repeticao — folga suficiente para o
   * registro acontecer antes de o foco chegar la.
   */
  overscan?: number
  renderItem: (item: T, indice: number) => React.ReactNode
  className?: string
}

export function ListaVirtual<T>({
  id,
  itens,
  alturaDaLinha,
  altura,
  overscan = 4,
  renderItem,
  className,
}: PropsDaListaVirtual<T>) {
  const container = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [alturaMedida, setAlturaMedida] = useState(altura ?? 0)
  const agendado = useRef(false)

  const alturaUtil = altura ?? alturaMedida

  // Mede o container quando a altura não foi informada. `ResizeObserver` e não
  // um `useEffect` com `offsetHeight`: a lista costuma viver dentro de um flex
  // que só ganha altura depois do primeiro layout, e uma medição única pegaria
  // zero — a lista renderizaria nenhuma linha e pareceria vazia.
  useLayoutEffect(() => {
    if (altura != null || !container.current) return
    const alvo = container.current
    const observador = new ResizeObserver(([entrada]) => {
      setAlturaMedida(entrada.contentRect.height)
    })
    observador.observe(alvo)
    return () => observador.disconnect()
  }, [altura])

  const aoRolar = useCallback(() => {
    // Uma leitura por quadro. `scroll` dispara muito mais que 60 Hz em roda de
    // mouse livre, e cada `setState` aqui é um render da lista inteira.
    if (agendado.current) return
    agendado.current = true
    requestAnimationFrame(() => {
      agendado.current = false
      setScrollTop(container.current?.scrollTop ?? 0)
    })
  }, [])

  const primeiro = Math.max(0, Math.floor(scrollTop / alturaDaLinha) - overscan)
  const visiveis = Math.ceil((alturaUtil || alturaDaLinha) / alturaDaLinha) + overscan * 2
  const ultimo = Math.min(itens.length, primeiro + visiveis)

  // Ponte com o foco: o gerente pede `rolarPara(indice)` quando o D-pad passa
  // do que está renderizado.
  useEffect(() => {
    return gerenteDeFoco.registrarLista({
      id,
      total: () => itens.length,
      rolarPara: indice => {
        const el = container.current
        if (!el) return
        const topo = indice * alturaDaLinha
        const base = topo + alturaDaLinha
        // `block: nearest` na mão: rolar só o necessário. Centralizar a cada
        // passo faria a lista dar um pulo a cada linha, e a 14 linhas por
        // segundo isso é ilegível.
        if (topo < el.scrollTop) el.scrollTop = topo
        else if (base > el.scrollTop + el.clientHeight) el.scrollTop = base - el.clientHeight
      },
      indiceEmFoco: () => null,
    })
  }, [id, itens.length, alturaDaLinha])

  // Depois de cada render, resolve um pedido pendente de foco virtual: o item
  // que o gerente estava esperando pode ter acabado de se registrar.
  useEffect(() => {
    gerenteDeFoco.resolverPendenteVirtual()
  })

  const janela: React.ReactNode[] = []
  for (let i = primeiro; i < ultimo; i++) {
    janela.push(
      <div
        key={i}
        style={{
          position: "absolute",
          top: i * alturaDaLinha,
          left: 0,
          right: 0,
          height: alturaDaLinha,
        }}
      >
        {renderItem(itens[i], i)}
      </div>,
    )
  }

  return (
    <div
      ref={container}
      onScroll={aoRolar}
      className={cn("relative overflow-y-auto", className)}
      style={altura != null ? { height: altura } : undefined}
    >
      {/* Espaçador com a altura TOTAL: é ele que dá à barra de rolagem o
          tamanho e a posição corretos. Sem ele, a barra refletiria só a janela
          e o jogador de mouse veria uma lista de 700 itens com barra de 40. */}
      <div style={{ height: itens.length * alturaDaLinha, position: "relative" }}>{janela}</div>
    </div>
  )
}

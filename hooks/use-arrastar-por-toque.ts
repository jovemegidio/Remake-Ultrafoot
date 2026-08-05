"use client"

// ARRASTAR COM O DEDO — a camada que faltava para o jogo funcionar no celular.
//
// A escalação e o gerenciamento de elenco usam `draggable` + `onDragStart` /
// `onDrop` do HTML5. Esses eventos NÃO EXISTEM no toque: no celular as duas
// telas mais importantes do jogo ficam inertes, e é por isso que o app mobile
// (que é um WebView do jogo web) não consegue montar time.
//
// ⚠️ ESTA CAMADA É ADITIVA. O caminho do mouse continua sendo o HTML5 nativo,
// intocado — se algo aqui estiver errado, quem joga no PC não sente. O hook
// ignora `pointerType === "mouse"` de propósito para não haver dois mecanismos
// disputando o mesmo gesto.
//
// POR QUE PRESSIONAR E SEGURAR, e não arrastar direto: numa lista que rola, o
// arrasto imediato rouba o gesto de rolagem e a tela trava no dedo. Segurar
// ~250 ms é o mesmo padrão que o Android e o iOS usam para reordenar — e um
// toque curto continua sendo um toque curto (abre o modal do atleta).
//
// COMO O ALVO É DESCOBERTO: não há `dataTransfer` no toque. Marcamos os
// elementos com `data-uf-arrastavel="<id>"` e a área de solta com
// `data-uf-area`, e no dedo levantado perguntamos ao documento quem está
// embaixo (`elementFromPoint`). Por isso o item arrastado NÃO ganha um fantasma
// seguindo o dedo: ele apareceria embaixo do ponteiro e seria sempre o alvo.

import { useCallback, useEffect, useRef, useState } from "react"

/** Quanto tempo o dedo fica parado antes de o item "grudar". */
const ATRASO_PADRAO_MS = 250
/** Movimento além disto antes de grudar = a pessoa quis rolar a lista. */
const TOLERANCIA_PX = 10

export interface ArrastarPorToqueOpts {
  /** Soltou em cima de outro item: troca os dois. */
  aoSoltarSobreItem: (arrastadoId: number, alvoId: number) => void
  /** Soltou numa área livre (o campo). Recebe a coordenada da tela. */
  aoSoltarNaArea?: (arrastadoId: number, clientX: number, clientY: number) => void
  /** Desliga o gesto (tela em modo leitura, partida em andamento etc.). */
  desabilitado?: boolean
  atrasoMs?: number
}

export interface ArrastarPorToque {
  /** Id do item que está grudado no dedo agora, ou null. */
  arrastando: number | null
  /** Espalhe em cada item arrastável: `{...toque.propsDoItem(jogador.id)}`. */
  propsDoItem: (id: number) => {
    "data-uf-arrastavel": number
    onPointerDown: (e: React.PointerEvent) => void
    style: React.CSSProperties
  }
  /** Espalhe na área de solta (o campo): `{...toque.propsDaArea}`. */
  propsDaArea: { "data-uf-area": true }
}

export function useArrastarPorToque(opts: ArrastarPorToqueOpts): ArrastarPorToque {
  const { aoSoltarSobreItem, aoSoltarNaArea, desabilitado, atrasoMs = ATRASO_PADRAO_MS } = opts
  const [arrastando, setArrastando] = useState<number | null>(null)

  // Refs em vez de estado: estes valores mudam a cada movimento do dedo e não
  // devem redesenhar a tela.
  const timer = useRef<number | null>(null)
  const inicio = useRef<{ x: number; y: number } | null>(null)
  const candidato = useRef<number | null>(null)
  const arrastandoRef = useRef<number | null>(null)
  arrastandoRef.current = arrastando

  const cancelarEspera = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    candidato.current = null
    inicio.current = null
  }, [])

  const onPointerDown = useCallback(
    (id: number) => (e: React.PointerEvent) => {
      // O mouse continua no caminho HTML5 nativo — ver o aviso do topo.
      if (desabilitado || e.pointerType === "mouse") return
      candidato.current = id
      inicio.current = { x: e.clientX, y: e.clientY }
      if (timer.current !== null) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        timer.current = null
        if (candidato.current === null) return
        setArrastando(candidato.current)
        // Retorno tátil: sem ele não dá para saber que o item grudou.
        try { navigator.vibrate?.(15) } catch { /* nem todo aparelho tem */ }
      }, atrasoMs)
    },
    [desabilitado, atrasoMs],
  )

  useEffect(() => {
    if (desabilitado) return

    const mover = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return
      // Ainda esperando grudar: se o dedo andou, era rolagem. Desiste.
      if (timer.current !== null && inicio.current) {
        const andou = Math.hypot(e.clientX - inicio.current.x, e.clientY - inicio.current.y)
        if (andou > TOLERANCIA_PX) cancelarEspera()
        return
      }
      // Já grudou: segura o gesto para a página não rolar junto.
      if (arrastandoRef.current !== null && e.cancelable) e.preventDefault()
    }

    const soltar = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return
      const id = arrastandoRef.current
      cancelarEspera()
      if (id === null) return
      setArrastando(null)

      const embaixo = document.elementFromPoint(e.clientX, e.clientY)
      if (!embaixo) return

      const alvo = embaixo.closest("[data-uf-arrastavel]")
      if (alvo) {
        const alvoId = Number(alvo.getAttribute("data-uf-arrastavel"))
        if (Number.isFinite(alvoId) && alvoId !== id) aoSoltarSobreItem(id, alvoId)
        return
      }
      if (aoSoltarNaArea && embaixo.closest("[data-uf-area]")) {
        aoSoltarNaArea(id, e.clientX, e.clientY)
      }
    }

    const cancelar = () => {
      cancelarEspera()
      setArrastando(null)
    }

    // `passive: false` é obrigatório no pointermove: sem isso o `preventDefault`
    // é ignorado e a página rola embaixo do item que está sendo arrastado.
    window.addEventListener("pointermove", mover, { passive: false })
    window.addEventListener("pointerup", soltar)
    window.addEventListener("pointercancel", cancelar)
    return () => {
      window.removeEventListener("pointermove", mover)
      window.removeEventListener("pointerup", soltar)
      window.removeEventListener("pointercancel", cancelar)
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [desabilitado, cancelarEspera, aoSoltarSobreItem, aoSoltarNaArea])

  const propsDoItem = useCallback(
    (id: number) => ({
      "data-uf-arrastavel": id,
      onPointerDown: onPointerDown(id),
      style: {
        // `none` só no item que está grudado: nos demais a lista continua
        // rolando normalmente com o dedo.
        touchAction: arrastando === id ? ("none" as const) : undefined,
        // Segurar para arrastar não pode acionar o menu de seleção do sistema.
        WebkitUserSelect: "none" as const,
        userSelect: "none" as const,
        WebkitTouchCallout: "none" as const,
      } as React.CSSProperties,
    }),
    [onPointerDown, arrastando],
  )

  return { arrastando, propsDoItem, propsDaArea: { "data-uf-area": true } }
}

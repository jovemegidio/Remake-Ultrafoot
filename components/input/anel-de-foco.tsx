"use client"

// ANEL DE FOCO — um retangulo que persegue o item selecionado.
//
// ── Por que um elemento flutuante e nao `outline` no proprio item ───────────
// `outline` no item funciona, e o jogo ja fazia isso (a regra continua em
// app/globals.css como rede de seguranca). Mas ele nao consegue duas coisas que
// o Modo Controle precisa:
//
//   1. TRANSICAO entre itens. Com outline, o realce PISCA de um lugar para o
//      outro. Um retangulo unico que desliza diz para onde o foco foi — e a 3 m
//      de uma TV, essa continuidade e a diferenca entre acompanhar e se perder.
//   2. Sair por fora do item. Anel com folga e brilho sobre um card que tem
//      `overflow: hidden` fica cortado; flutuando por cima, nao.
//
// ── Por que ele nao renderiza a cada quadro ─────────────────────────────────
// Ele NAO segue o item continuamente. Ele se reposiciona quando o foco muda e
// quando a pagina rola/redimensiona — eventos raros. Um `requestAnimationFrame`
// eterno medindo `getBoundingClientRect` seria layout forcado 60x por segundo
// pelo jogo inteiro, exatamente o custo que o resto deste sistema evita.

import { useEffect, useRef, useState } from "react"

import { gerenteDeFoco } from "@/lib/focus/manager"
import { useModoControle } from "@/hooks/use-input"

interface Caixa {
  x: number
  y: number
  largura: number
  altura: number
  raio: string
}

export function AnelDeFoco() {
  const modoControle = useModoControle()
  const [caixa, setCaixa] = useState<Caixa | null>(null)
  const alvo = useRef<HTMLElement | null>(null)
  const agendado = useRef(false)

  useEffect(() => {
    if (!modoControle) {
      setCaixa(null)
      alvo.current = null
      return
    }

    const medir = () => {
      agendado.current = false
      const el = alvo.current
      if (!el || !el.isConnected) {
        setCaixa(null)
        return
      }
      const r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) {
        setCaixa(null)
        return
      }
      // Herda o arredondamento do proprio item: um anel retangular em volta de
      // uma carta redonda parece defeito de renderizacao.
      const raio = getComputedStyle(el).borderRadius || "8px"
      setCaixa({ x: r.left, y: r.top, largura: r.width, altura: r.height, raio })
    }

    const agendar = () => {
      if (agendado.current) return
      agendado.current = true
      requestAnimationFrame(medir)
    }

    const pararDeObservar = gerenteDeFoco.observar((_id, el) => {
      alvo.current = el
      agendar()
    })

    // `capture: true` no scroll: rolagem acontece em containers internos (a
    // tabela de elenco rola dentro de um painel, nao na janela). Sem captura, o
    // anel ficaria parado enquanto a lista anda por baixo dele.
    window.addEventListener("scroll", agendar, { passive: true, capture: true })
    window.addEventListener("resize", agendar, { passive: true })

    alvo.current = gerenteDeFoco.elementoAtual()
    agendar()

    return () => {
      pararDeObservar()
      window.removeEventListener("scroll", agendar, { capture: true })
      window.removeEventListener("resize", agendar)
    }
  }, [modoControle])

  if (!modoControle || !caixa) return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-[60] motion-safe:transition-[transform,width,height] motion-safe:duration-150 motion-safe:ease-out"
      style={{
        // `translate` em vez de `left/top`: transform e composto na GPU e nao
        // dispara layout. Com left/top, cada passo do D-pad reflui a pagina.
        transform: `translate3d(${caixa.x}px, ${caixa.y}px, 0)`,
        width: caixa.largura,
        height: caixa.altura,
        borderRadius: caixa.raio,
        boxShadow: [
          "0 0 0 var(--uf-focus-ring, 2px) var(--brand, #00ffc8)",
          "0 0 0 calc(var(--uf-focus-ring, 2px) + 4px) color-mix(in srgb, var(--brand, #00ffc8) 22%, transparent)",
        ].join(", "),
      }}
    />
  )
}

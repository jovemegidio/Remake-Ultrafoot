"use client"

// FUNDO DA TELA PRINCIPAL — carrossel com crossfade suave.
//
// Histórico, porque ele importa para não repetir o erro: até 26/07/26 o menu
// tinha um carrossel de PRINTS DO JOGO com vinheta pesada por cima; foi trocado
// por um fundo fixo justamente porque aquilo ficou pesado e sujo. O pedido agora
// é o carrossel de volta — mas com arte feita para ser fundo (as seis imagens de
// `Tela/`, já convertidas para WebP: 13 MB de PNG viraram 940 KB) e sem o
// escurecimento que apagava a arte.
//
// Duas coisas que este componente NÃO faz, de propósito:
//
//   • não usa `backdrop-blur` nem filtro: fundo de tela cheia é a superfície mais
//     cara que existe para o compositor, e blur aqui derrubaria o FPS do menu em
//     máquina fraca;
//   • não troca `src` de uma <img> só. Trocar a fonte faz o navegador descarregar
//     a textura antiga e decodificar a nova NO MEIO da transição — o que produz um
//     "piscar" branco. Todas ficam montadas e o que muda é só a opacidade, que a
//     GPU resolve sem tocar na imagem.

import Image from "next/image"
import { useEffect, useState } from "react"

/** Os seis fundos, na ordem em que o usuário os entregou (Tela I..VI). */
export const FUNDOS_DO_MENU = [
  "/images/menu/menu-1.webp",
  "/images/menu/menu-2.webp",
  "/images/menu/menu-3.webp",
  "/images/menu/menu-4.webp",
  "/images/menu/menu-5.webp",
  "/images/menu/menu-6.webp",
] as const

/** Quanto tempo cada fundo fica na tela, e quanto dura a passagem entre eles. */
const SEGUNDOS_POR_FUNDO = 9
const SEGUNDOS_DE_TRANSICAO = 2.2

export interface MenuBackgroundProps {
  /** Só roda quando a tela está de fato visível — o menu vive dentro de um fade. */
  ativo?: boolean
  className?: string
}

export function MenuBackground({ ativo = true, className }: MenuBackgroundProps) {
  const [indice, setIndice] = useState(0)
  /**
   * MOVIMENTO REDUZIDO ≠ FUNDO PARADO.
   *
   * A primeira versão disto congelava o carrossel inteiro quando
   * `prefers-reduced-motion` estava ativo — e foi assim que o carrossel nunca
   * rodou na máquina do autor: o Windows estava com as animações desligadas
   * (`MinAnimate = 0`), a WebView reporta `reduce`, e o fundo ficava eternamente
   * no primeiro quadro. Parecia que a transição não tinha sido implementada.
   *
   * A preferência existe para evitar desconforto vestibular — paralaxe, giro,
   * zoom, movimento rápido. Um crossfade de 2,2s entre duas fotos PARADAS não é
   * isso. O que se enquadra ali é o ZOOM, e é só ele que desligamos.
   */
  const [semMovimento, setSemMovimento] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const consulta = window.matchMedia("(prefers-reduced-motion: reduce)")
    const avaliar = () => setSemMovimento(
      consulta.matches || document.documentElement.hasAttribute("data-a11y-reduce-motion"),
    )
    avaliar()
    // A preferência pode mudar com o jogo aberto (tanto no Windows quanto no
    // painel de acessibilidade do próprio jogo).
    consulta.addEventListener("change", avaliar)
    return () => consulta.removeEventListener("change", avaliar)
  }, [])

  useEffect(() => {
    if (!ativo) return
    const id = setInterval(
      () => setIndice(i => (i + 1) % FUNDOS_DO_MENU.length),
      SEGUNDOS_POR_FUNDO * 1000,
    )
    return () => clearInterval(id)
  }, [ativo])

  return (
    <div className={className}>
      {FUNDOS_DO_MENU.map((src, i) => (
        <Image
          key={src}
          src={src}
          alt=""
          fill
          // `priority` só no primeiro: ele é o que aparece de imediato. Marcar os
          // seis como prioritários faria o Next disputar banda para carregar tudo
          // de uma vez e atrasaria justamente o que está na tela.
          priority={i === 0}
          unoptimized
          className="object-cover"
          style={{
            opacity: i === indice ? 1 : 0,
            // O ZOOM é a única parte que o movimento reduzido desliga: ele é o
            // que pode incomodar. A troca de imagem continua acontecendo.
            transform: semMovimento ? undefined : i === indice ? "scale(1.05)" : "scale(1)",
            transitionProperty: semMovimento ? "opacity" : "opacity, transform",
            transitionDuration: semMovimento
              ? `${SEGUNDOS_DE_TRANSICAO}s`
              : `${SEGUNDOS_DE_TRANSICAO}s, ${SEGUNDOS_POR_FUNDO + SEGUNDOS_DE_TRANSICAO}s`,
            transitionTimingFunction: semMovimento ? "ease-in-out" : "ease-in-out, ease-out",
          }}
        />
      ))}
    </div>
  )
}

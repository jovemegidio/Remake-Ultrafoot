"use client"

// Numero que conta ate o valor ao aparecer, para o destaque de fundacao e
// titulos na escolha de clube.
//
// ⚠️ ANO NAO CONTA DE ZERO. Um ano subindo de 0 a 1915 passa por 1200 numeros
// sem significado e demora uma eternidade; a contagem comeca 60 anos antes e
// sobe so o trecho final, que e o que da a sensacao de contador sem virar
// espera. Titulo, que e numero pequeno, comeca do zero mesmo.
//
// ⚠️ E RESPEITA "REDUZIR MOVIMENTO": ali o valor final aparece direto. Contador
// e exatamente o tipo de animacao que incomoda quem liga essa preferencia.

import { useEffect, useRef, useState } from "react"

interface Props {
  valor: number | null
  /** `ano` conta so o trecho final; `contagem` comeca do zero. */
  tipo?: "ano" | "contagem"
  duracao?: number
  className?: string
  /** O que mostrar quando nao ha dado curado. */
  vazio?: string
}

function semMovimento(): boolean {
  if (typeof window === "undefined") return true
  return document.documentElement.hasAttribute("data-a11y-reduce-motion") ||
    Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
}

export function NumeroQueConta({ valor, tipo = "contagem", duracao = 900, className, vazio = "—" }: Props) {
  const [mostrado, setMostrado] = useState<number | null>(valor)
  const rafRef = useRef(0)

  useEffect(() => {
    if (valor === null) { setMostrado(null); return }
    if (semMovimento()) { setMostrado(valor); return }

    const de = tipo === "ano" ? Math.max(0, valor - 60) : 0
    const inicio = performance.now()
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / duracao)
      // easeOutCubic: corre no comeco e assenta no fim, que e o que faz o
      // numero "chegar" em vez de simplesmente parar.
      const e = 1 - Math.pow(1 - t, 3)
      setMostrado(Math.round(de + (valor - de) * e))
      if (t < 1) rafRef.current = requestAnimationFrame(passo)
    }
    rafRef.current = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(rafRef.current)
  }, [valor, tipo, duracao])

  if (mostrado === null) return <span className={className}>{vazio}</span>
  return <span className={className}>{mostrado}</span>
}

"use client"

// KIT DE MOVIMENTO DA CERIMONIA DE CAMPEAO.
//
// A TELA continua em app/campeao/page.tsx — com o trofeu, o pedestal, o reflexo
// e a coroa que ja existiam. Aqui moram so as pecas de movimento que ela usa.
//
// Antes tudo entrava junto num `animate-fade-in`: o clube era campeao e a tela
// simplesmente aparecia pronta. Aqui a conquista e ENCENADA, na ordem em que uma
// transmissao mostraria — escuro, refletores acendendo, escudo subindo, o nome
// carimbando na tela com impacto, papel picado e so entao os numeros.
//
// ⚠️ MOVIMENTO E OPCIONAL. Respeita `prefers-reduced-motion` do sistema E o
// `data-a11y-reduce-motion` que a store de acessibilidade escreve no <html>.
// Nesse caso a cena inteira aparece no estado final, sem coreografia e sem
// papel picado — a informacao e a mesma; so o espetaculo sai.

import { useEffect, useMemo, useState } from "react"
import { motion, useReducedMotion, type Variants } from "framer-motion"

/** A store de acessibilidade marca o <html>; o SO marca via media query. */
export function useMovimentoReduzido(): boolean {
  const preferenciaDoSistema = useReducedMotion()
  const [preferenciaDoJogo, setPreferenciaDoJogo] = useState(false)
  useEffect(() => {
    const ler = () => setPreferenciaDoJogo(document.documentElement.hasAttribute("data-a11y-reduce-motion"))
    ler()
    const obs = new MutationObserver(ler)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-a11y-reduce-motion"] })
    return () => obs.disconnect()
  }, [])
  return Boolean(preferenciaDoSistema) || preferenciaDoJogo
}

// ─── Papel picado ────────────────────────────────────────────────────────────
// Estoura NO MOMENTO do erguer do troféu, não desde o primeiro frame: papel
// caindo antes de o título aparecer entrega o final antes da cena começar.

interface Papel { id: number; x: number; atraso: number; duracao: number; cor: string; largura: number; giro: number; deriva: number }

function usePapelPicado(quantidade: number, cores: readonly string[]): Papel[] {
  return useMemo(
    () =>
      Array.from({ length: quantidade }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        atraso: Math.random() * 2.5,
        duracao: 3.5 + Math.random() * 3.5,
        cor: cores[Math.floor(Math.random() * cores.length)],
        largura: 5 + Math.random() * 7,
        giro: Math.random() * 360,
        deriva: (Math.random() - 0.5) * 22,
      })),
    [quantidade, cores],
  )
}

export function PapelPicado({ ativo, cores }: { ativo: boolean; cores: readonly string[] }) {
  const papeis = usePapelPicado(140, cores)
  if (!ativo) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-hidden>
      {papeis.map(p => (
        <motion.span
          key={p.id}
          className="absolute block rounded-[1px]"
          style={{ left: `${p.x}%`, top: "-6vh", backgroundColor: p.cor, width: p.largura, height: p.largura * 1.7 }}
          initial={{ y: "-10vh", opacity: 0, rotate: p.giro }}
          animate={{ y: "115vh", opacity: [0, 1, 1, 0.85, 0], rotate: p.giro + 540, x: [0, p.deriva, -p.deriva, 0] }}
          transition={{ duration: p.duracao, delay: p.atraso, ease: "linear", repeat: Infinity, repeatDelay: Math.random() * 1.5 }}
        />
      ))}
    </div>
  )
}

// ─── Faíscas douradas subindo (contraponto ao papel que desce) ───────────────

export function FaiscasDouradas({ ativo }: { ativo: boolean }) {
  const faiscas = useMemo(
    () => Array.from({ length: 26 }).map((_, i) => ({ id: i, x: Math.random() * 100, atraso: Math.random() * 5, duracao: 6 + Math.random() * 5, tamanho: 2 + Math.random() * 3 })),
    [],
  )
  if (!ativo) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden>
      {faiscas.map(f => (
        <motion.span
          key={f.id}
          className="absolute block rounded-full bg-yellow-200"
          style={{ left: `${f.x}%`, bottom: "-4vh", width: f.tamanho, height: f.tamanho, boxShadow: "0 0 8px rgba(251,191,36,0.9)" }}
          initial={{ y: 0, opacity: 0 }}
          animate={{ y: "-105vh", opacity: [0, 0.9, 0.9, 0] }}
          transition={{ duration: f.duracao, delay: f.atraso, ease: "easeOut", repeat: Infinity }}
        />
      ))}
    </div>
  )
}

// ─── Coreografia ─────────────────────────────────────────────────────────────
// Os tempos são o roteiro da cena. Mexer aqui muda o ritmo da cerimônia inteira.

export const TEMPOS = {
  refletores: 0.15,
  escudo: 0.75,
  carimbo: 1.5,
  papel: 1.75,
  competicao: 2.05,
  numeros: 2.5,
  acao: 3.15,
} as const

export const subirComPeso: Variants = {
  oculto: { opacity: 0, y: 70, scale: 0.86 },
  visivel: (atraso: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    // Mola pesada: o escudo "assenta" em vez de deslizar. É o que dá a sensação
    // de peso — troféu leve parece adesivo.
    transition: { delay: atraso, type: "spring", stiffness: 90, damping: 14, mass: 1.1 },
  }),
}

export const entrarDeBaixo: Variants = {
  oculto: { opacity: 0, y: 24 },
  visivel: (atraso: number) => ({ opacity: 1, y: 0, transition: { delay: atraso, duration: 0.55, ease: [0.16, 1, 0.3, 1] } }),
}

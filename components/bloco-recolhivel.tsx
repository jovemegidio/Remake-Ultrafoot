"use client"

// BLOCO RECOLHIVEL — usado onde a tela tem mais frentes do que atencao.
//
// Nasceu na Infraestrutura e foi para ca quando a area do treinador precisou do
// mesmo comportamento. Uma copia por tela envelheceria em uma so: este projeto
// ja tem historico disso (regra duplicada em dois arquivos que divergiram).
//
// A ideia: quando fechado, o bloco mostra o RESUMO — o numero pelo qual se
// decide se vale abrir. Nada fica escondido; o que espera ser chamado e o
// formulario, nao a informacao.

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export function BlocoRecolhivel({
  titulo,
  resumo,
  children,
  aberto: abertoInicial = false,
  destaque,
  icone,
  className,
}: {
  titulo: string
  /** Some quando o bloco esta aberto — la o proprio conteudo ja responde. */
  resumo?: React.ReactNode
  children: React.ReactNode
  aberto?: boolean
  destaque?: boolean
  icone?: React.ReactNode
  className?: string
}) {
  const [aberto, setAberto] = useState(abertoInicial)
  return (
    <section className={cn(
      "overflow-hidden rounded-xl border",
      destaque ? "border-[var(--brand)]/25 bg-[var(--brand)]/[0.04]" : "border-white/[0.07] bg-white/[0.02]",
      className,
    )}>
      <button
        onClick={() => setAberto(v => !v)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
      >
        {icone && <span className="shrink-0 text-[var(--brand)]">{icone}</span>}
        <span className="text-sm font-bold text-white">{titulo}</span>
        {resumo && !aberto && (
          <span className="ml-auto flex items-center gap-3 text-xs text-white/55">{resumo}</span>
        )}
        <ChevronDown className={cn(
          "h-4 w-4 shrink-0 text-white/35 transition-transform",
          aberto && "rotate-180",
          (!resumo || aberto) && "ml-auto",
        )} />
      </button>
      {aberto && <div className="border-t border-white/[0.06] p-4">{children}</div>}
    </section>
  )
}

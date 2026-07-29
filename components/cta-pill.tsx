"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Botao CTA principal estilo EA FC ("Modo Carreira").
 * Pilula com borda de gradiente brilhante (ciano -> azul -> roxo), glow externo,
 * um "key chip" com o glifo de enter e o rotulo em negrito.
 *
 * Usado nas telas principais (hub, listas, estados vazios) para a acao primaria.
 */
interface CtaPillProps {
  children: ReactNode
  /** Se informado, renderiza como link de navegacao. */
  href?: string
  onClick?: () => void
  /** Glifo/letra exibido no key chip. Padrao: enter. */
  keyLabel?: string
  /** Icone opcional antes do rotulo (substitui o key chip se keyLabel for null). */
  icon?: ReactNode
  className?: string
}

export function CtaPill({ children, href, onClick, keyLabel = "enter", icon, className }: CtaPillProps) {
  const inner = (
    <span
      className={cn(
        "relative inline-flex items-center gap-2.5 rounded-full p-[2px]",
        "bg-[linear-gradient(110deg,var(--brand)_0%,var(--brand-2)_45%,#7b5cff_100%)]",
        "shadow-[0_0_22px_rgba(0,200,255,0.45)] transition-all duration-200",
        "hover:shadow-[0_0_30px_rgba(0,200,255,0.65)] active:scale-[0.98]",
        className,
      )}
    >
      <span className="flex items-center gap-2.5 rounded-full bg-[#0b0e14] px-4 py-2">
        {keyLabel ? (
          <kbd className="inline-flex h-[20px] min-w-[26px] items-center justify-center rounded-[6px] border border-white/15 bg-white/[0.08] px-1.5 font-mono text-[11px] font-semibold text-white/85 shadow-[inset_0_-1px_0_rgba(0,0,0,0.45)]">
            {keyLabel.toLowerCase() === "enter" ? "\u23CE" : keyLabel}
          </kbd>
        ) : icon ? (
          <span className="text-white [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        ) : null}
        <span className="text-sm font-bold tracking-wide text-white">{children}</span>
      </span>
    </span>
  )

  if (href) {
    return (
      <Link href={href} className="inline-flex">
        {inner}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className="inline-flex">
      {inner}
    </button>
  )
}

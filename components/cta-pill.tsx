"use client"

import { LinkLeve as Link } from "@/components/link-leve"
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
      // ⚠️ A REFERENCIA NAO USA GRADIENTE AQUI, e eu tinha posto um.
      //
      // A acao primaria do hub ("Avancar", no video) e uma PILULA DE VIDRO
      // CLARO: medido, ela e branco a ~14% sobre o ambiente (#4d6c76 de fill
      // sobre um fundo de #35565e), sem borda colorida e sem brilho. O anel
      // ciano com halo que estava aqui gritava mais que o proprio conteudo da
      // tela e nao existe no material de referencia.
      //
      // A marca continua presente onde ela de fato aparece: no foco, na tecla
      // e no hover — nao no repouso.
      className={cn(
        "uf-pilula relative inline-flex items-center gap-2.5 rounded-full",
        className,
      )}
    >
      <span className="flex items-center gap-2.5 rounded-full px-4 py-2">
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

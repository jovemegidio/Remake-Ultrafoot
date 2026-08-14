"use client"

import { LinkLeve as Link } from "@/components/link-leve"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export interface PageTab {
  label: string
  href: string
}

interface PageTabsProps {
  tabs: PageTab[]
  className?: string
}

// Barra de sub-navegacao no topo de paginas-pai. Permite navegar entre paginas
// "irmas" agrupadas sob o mesmo item do sidebar (ex: Elenco | Tatica | Treinamento | Contratos).
export function PageTabs({ tabs, className }: PageTabsProps) {
  const pathname = usePathname()

  return (
    <nav
      className={cn(
        "flex items-center gap-1 border-b border-white/[0.04] bg-[#0d0d0d]/80 px-4",
        className,
      )}
      aria-label="Sub-navegacao"
    >
      {tabs.map(tab => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + "/")
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "relative px-3 py-2.5 text-[12px] font-medium uppercase tracking-wider transition-colors",
              active
                ? "text-white"
                : "text-white/45 hover:text-white/70",
            )}
          >
            {tab.label}
            {active && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--brand)]" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}

// Tabs predefinidas dos grupos. Importadas pelas paginas relevantes.
export const ELENCO_TABS: PageTab[] = [
  { label: "Elenco", href: "/elenco" },
  { label: "Taticas", href: "/taticas" },
  { label: "Treinamento", href: "/treinamento" },
  { label: "Contratos", href: "/contratos" },
]

export const CALENDARIO_TABS: PageTab[] = [
  { label: "Calendario", href: "/calendario" },
  { label: "Competicoes", href: "/competicoes" },
]

export const ANALISE_TABS: PageTab[] = [
  { label: "Adversarios", href: "/adversarios" },
  { label: "Estatisticas", href: "/estatisticas" },
  { label: "Relatorios", href: "/relatorios" },
]

export const VESTIARIO_TABS: PageTab[] = [
  { label: "Vestiario", href: "/vestiario" },
  { label: "Reunioes", href: "/reunioes" },
]

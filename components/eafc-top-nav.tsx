"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { TeamCrest } from "@/components/team-crest"
import type { Team } from "@/lib/teams-data"
import { Star } from "lucide-react"

const tabs: { label: string; href: string }[] = [
  { label: "Home", href: "/" },
  { label: "Central", href: "/central" },
  { label: "Calendario", href: "/calendario" },
  { label: "Elenco", href: "/elenco" },
  { label: "Mercado", href: "/mercado" },
  { label: "Competicoes", href: "/competicoes" },
  { label: "Partida", href: "/partida" },
  { label: "Configuracoes", href: "/configuracoes" },
]

interface EafcTopNavProps {
  userTeam: Team
  xp?: number
  level?: number
}

export function EafcTopNav({ userTeam, xp = 64, level = 12 }: EafcTopNavProps) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="flex items-center justify-between px-6 h-14">
        {/* Tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const active =
              tab.href === "/"
                ? pathname === "/"
                : pathname.startsWith(tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "relative px-3 py-2 text-sm font-display tracking-wider transition-colors whitespace-nowrap",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground/70 hover:text-foreground",
                )}
              >
                {tab.label.toUpperCase()}
                {active && (
                  <span className="absolute -bottom-px left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_10px_oklch(0.78_0.18_195_/_0.8)]" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Club + XP bar */}
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-display tracking-wider text-foreground/90">
                {userTeam.nome}
              </span>
              <Star className="h-3 w-3 fill-gold text-gold" />
            </div>
            <div className="flex items-center gap-1.5">
              <div className="relative h-1.5 w-32 overflow-hidden rounded-full bg-card border border-border">
                <div
                  className="absolute inset-y-0 left-0 xp-bar-fill rounded-full"
                  style={{ width: `${xp}%` }}
                />
              </div>
              <span className="text-[10px] font-display tracking-wider text-muted-foreground tabular-nums w-6">
                {level}
              </span>
            </div>
          </div>
          <TeamCrest team={userTeam} size="sm" />
        </div>
      </div>
    </header>
  )
}

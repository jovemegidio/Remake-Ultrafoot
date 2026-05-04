"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { ChevronRight, Save, FastForward, Settings } from "lucide-react"
import { TeamCrest } from "@/components/team-crest"
import { getTeamByShort, serieATeams, type Team } from "@/lib/teams-data"
import { cn } from "@/lib/utils"

interface GameHeaderProps {
  team?: Team
  showNav?: boolean
  className?: string
}

const navItems = [
  { label: "Inicio", href: "/" },
  { label: "Calendario", href: "/calendario" },
  { label: "Elenco", href: "/elenco" },
  { label: "Partida", href: "/partida" },
  { label: "Financas", href: "/financas" },
  { label: "Mercado", href: "/mercado" },
]

export function GameHeader({ team, showNav = true, className }: GameHeaderProps) {
  const pathname = usePathname()
  const userTeam = team || getTeamByShort("RBB") || serieATeams[0]

  return (
    <header className={cn(
      "sticky top-0 z-30 flex h-12 items-center justify-between bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-white/5 px-4",
      className
    )}>
      {/* Left - Navigation */}
      <div className="flex items-center gap-1">
        {showNav && navItems.map((item, index) => {
          const isActive = item.href === "/" 
            ? pathname === "/" 
            : pathname.startsWith(item.href)
          
          return (
            <div key={item.href} className="flex items-center">
              <Link
                href={item.href}
                className={cn(
                  "px-3 py-1.5 text-[11px] font-medium tracking-wide transition-colors rounded",
                  isActive
                    ? "text-white bg-white/10"
                    : "text-white/40 hover:text-white/70 hover:bg-white/5"
                )}
              >
                {item.label}
              </Link>
              {index < navItems.length - 1 && (
                <ChevronRight className="h-3 w-3 text-white/20 mx-0.5" />
              )}
            </div>
          )
        })}
      </div>

      {/* Center - Season Info (optional) */}
      <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-4 text-[11px] text-white/50">
        <span>Season <span className="text-white font-medium">2026</span></span>
        <span className="w-px h-3 bg-white/20" />
        <span>Week <span className="text-white font-medium">0/48</span></span>
      </div>

      {/* Right - Team & Actions */}
      <div className="flex items-center gap-3">
        <button className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium tracking-wider text-white/60 hover:text-white/80 transition-colors rounded hover:bg-white/5">
          <Save className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Salvar</span>
        </button>
        
        <Link 
          href="/partida"
          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold tracking-wider bg-[#1db954] text-black rounded hover:bg-[#1ed760] transition-colors"
        >
          <FastForward className="h-3.5 w-3.5" />
          <span>Avancar</span>
        </Link>

        <div className="w-px h-6 bg-white/10 mx-1" />

        <Link href="/configuracoes" className="p-1.5 text-white/40 hover:text-white/70 transition-colors rounded hover:bg-white/5">
          <Settings className="h-4 w-4" />
        </Link>

        <div className="flex items-center gap-2 pl-2 border-l border-white/10">
          <TeamCrest team={userTeam} size="xs" />
          <span className="text-[11px] font-medium text-white/80 hidden sm:inline">{userTeam.curto}</span>
        </div>
      </div>
    </header>
  )
}

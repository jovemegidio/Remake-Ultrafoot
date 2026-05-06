"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useContext } from "react"
import { ChevronRight, Save, FastForward, Settings, Check, Loader2 } from "lucide-react"
import { TeamCrest } from "@/components/team-crest"
import { HeaderControls, ControllerTypeContext } from "@/components/controller-buttons"
import { NotificationBell, NotificationCenter } from "@/components/notifications-system"
import { getTeamByShort, serieATeams, type Team } from "@/lib/teams-data"
import { useGameState } from "@/lib/save-system"
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
  const router = useRouter()
  const { state, setState } = useGameState()
  const userTeam = team || getTeamByShort(state.selectedTeamShort || "BGT") || serieATeams[0]
  
  // Detecta o tipo de controlador do contexto
  const controllerType = useContext(ControllerTypeContext)
  
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  
  // Demo notifications desativado - notificacoes de gol e partida agora sao reais
  // useNotificationDemo(false)

  const handleSave = async () => {
    setSaving(true)
    // Simulate save delay for visual feedback
    await new Promise(resolve => setTimeout(resolve, 500))
    setState({ updatedAt: Date.now() })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleAdvance = async () => {
    setAdvancing(true)
    // Advance to next week
    await new Promise(resolve => setTimeout(resolve, 300))
    setState({ week: state.week + 1 })
    setAdvancing(false)
    // Navigate to partida page
    router.push("/partida")
  }

  return (
    <header className={cn(
      "sticky top-0 z-30 flex h-12 items-center justify-between bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-white/5 px-4",
      className
    )}>
      {/* Left - Controller indicators + Navigation */}
      <div className="flex items-center gap-4">
        {/* Console controller navigation indicators - detecta automaticamente */}
        <HeaderControls controller={controllerType} className="hidden sm:flex" />
        
        <div className="w-px h-5 bg-white/10 hidden sm:block" />
        
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
      </div>

      {/* Center - Season Info (optional) */}
      <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-4 text-[11px] text-white/50">
        <span>Temporada <span className="text-white font-medium">{state.season}</span></span>
        <span className="w-px h-3 bg-white/20" />
        <span>Semana <span className="text-white font-medium">{state.week}/48</span></span>
      </div>

      {/* Right - Team & Actions */}
      <div className="flex items-center gap-3">
        <button 
          onClick={handleSave}
          disabled={saving}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium tracking-wider transition-colors rounded",
            saved 
              ? "text-[#1db954] bg-[#1db954]/10" 
              : "text-white/60 hover:text-white/80 hover:bg-white/5",
            saving && "opacity-50 cursor-wait"
          )}
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : saved ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">{saved ? "Salvo!" : "Salvar"}</span>
        </button>
        
        <button 
          onClick={handleAdvance}
          disabled={advancing}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold tracking-wider bg-[#1db954] text-black rounded hover:bg-[#1ed760] transition-colors",
            advancing && "opacity-50 cursor-wait"
          )}
        >
          {advancing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FastForward className="h-3.5 w-3.5" />
          )}
          <span>Avancar</span>
        </button>

        <div className="w-px h-6 bg-white/10 mx-1" />

        <NotificationBell onClick={() => setShowNotifications(true)} />

        <Link href="/configuracoes" className="p-1.5 text-white/40 hover:text-white/70 transition-colors rounded hover:bg-white/5">
          <Settings className="h-4 w-4" />
        </Link>

        <NotificationCenter isOpen={showNotifications} onClose={() => setShowNotifications(false)} />

        <div className="flex items-center gap-2 pl-2 border-l border-white/10">
          <TeamCrest team={userTeam} size="xs" />
          <span className="text-[11px] font-medium text-white/80 hidden sm:inline">{userTeam.curto}</span>
        </div>
      </div>
    </header>
  )
}

"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useContext, useRef, useEffect } from "react"
import { ChevronRight, Save, FastForward, Settings, Check, Loader2, ChevronDown, User, Trophy, Calendar, TrendingUp } from "lucide-react"
import { TeamCrest } from "@/components/team-crest"
import { HeaderControls, ControllerTypeContext } from "@/components/controller-buttons"
import { NotificationBell, NotificationCenter } from "@/components/notifications-system"
import { getTeamByShort, serieATeams, type Team } from "@/lib/teams-data"
import { useGameState } from "@/lib/save-system"
import { useGameManager } from "@/lib/use-game-manager"
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
  const { advanceWeek: advanceGameWeek, currentWeek, currentSeason, seasonCalendar } = useGameManager()
  const userTeam = team || getTeamByShort(state.selectedTeamShort || "BGT") || serieATeams[0]
  
  const controllerType = useContext(ControllerTypeContext)
  
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showCoachDropdown, setShowCoachDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowCoachDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const coachData = {
    nome: "Voce",
    cargo: "Tecnico Principal",
    partidasTotal: 24,
    vitorias: 16,
    empates: 5,
    derrotas: 3,
    aproveitamento: Math.round((16 * 3 + 5) / (24 * 3) * 100),
    titulosTemporada: 0,
    sequencia: "+5V",
  }

  const handleSave = async () => {
    setSaving(true)
    await new Promise(resolve => setTimeout(resolve, 500))
    setState({ updatedAt: Date.now() })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleAdvance = async () => {
    setAdvancing(true)
    await new Promise(resolve => setTimeout(resolve, 300))
    const result = await advanceGameWeek()
    setAdvancing(false)
    if (seasonCalendar.nextUserMatch) {
      router.push("/partida")
    }
  }

  return (
    <header className={cn(
      "sticky top-0 z-30 flex h-14 items-center justify-between bg-[#050508]/95 backdrop-blur-xl border-b border-white/[0.04] px-5",
      className
    )}>
      {/* Left - Controller indicators + Navigation */}
      <div className="flex items-center gap-5">
        <HeaderControls controller={controllerType} className="hidden sm:flex" />
        
        <div className="w-px h-6 bg-white/[0.06] hidden sm:block" />
        
        <div className="flex items-center gap-0.5">
          {showNav && navItems.map((item, index) => {
            const isActive = item.href === "/" 
              ? pathname === "/" 
              : pathname.startsWith(item.href)
            
            return (
              <div key={item.href} className="flex items-center">
                <Link
                  href={item.href}
                  className={cn(
                    "px-3.5 py-2 text-[11px] font-medium tracking-wide transition-all duration-200 rounded-lg",
                    isActive
                      ? "text-[#00ffc8] bg-[#00ffc8]/10 shadow-[inset_0_1px_0_rgba(0,255,200,0.1)]"
                      : "text-white/40 hover:text-white/70 hover:bg-white/5"
                  )}
                >
                  {item.label}
                </Link>
                {index < navItems.length - 1 && (
                  <ChevronRight className="h-3 w-3 text-white/15 mx-0.5" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Right - Season Info & Actions */}
      <div className="flex items-center gap-4">
        {/* Season/Week Info */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
          <Calendar className="h-3.5 w-3.5 text-[#00ffc8]" />
          <span className="text-[10px] text-white/50 font-medium">{currentSeason}</span>
          <span className="text-white/15">|</span>
          <span className="text-[10px] text-white/50">Rod</span>
          <span className="text-[11px] text-white font-semibold">{currentWeek}<span className="text-white/30">/38</span></span>
        </div>

        <div className="w-px h-6 bg-white/[0.06] hidden lg:block" />

        {/* Save Button */}
        <button 
          onClick={handleSave}
          disabled={saving}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 text-[10px] font-semibold tracking-wider transition-all duration-200 rounded-lg",
            saved 
              ? "text-[#00ffc8] bg-[#00ffc8]/10 ring-1 ring-[#00ffc8]/20" 
              : "text-white/50 hover:text-white/80 hover:bg-white/5",
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
          <span className="hidden sm:inline uppercase">{saved ? "Salvo!" : "Salvar"}</span>
        </button>
        
        {/* Advance Button - EA FC Style */}
        <button 
          onClick={handleAdvance}
          disabled={advancing}
          className={cn(
            "eafc-btn flex items-center gap-2 px-4 py-2 text-[10px] font-bold tracking-wider uppercase",
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

        <div className="w-px h-6 bg-white/[0.06] mx-1" />

        <NotificationBell onClick={() => setShowNotifications(true)} />

        <Link href="/configuracoes" className="p-2 text-white/40 hover:text-white/70 transition-colors rounded-lg hover:bg-white/5">
          <Settings className="h-4 w-4" />
        </Link>

        <NotificationCenter isOpen={showNotifications} onClose={() => setShowNotifications(false)} />

        {/* Team badge com dropdown do tecnico */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowCoachDropdown(!showCoachDropdown)}
            className={cn(
              "flex items-center gap-2.5 pl-3 border-l border-white/[0.06] py-1.5 pr-3 rounded-r-lg transition-all duration-200",
              showCoachDropdown ? "bg-white/10" : "hover:bg-white/5"
            )}
          >
            <TeamCrest team={userTeam} size="xs" />
            <span className="text-[11px] font-semibold text-white/80 hidden sm:inline">{userTeam.curto}</span>
            <ChevronDown className={cn(
              "h-3 w-3 text-white/40 transition-transform hidden sm:block",
              showCoachDropdown && "rotate-180"
            )} />
          </button>

          {/* Coach Dropdown */}
          {showCoachDropdown && (
            <div className="absolute top-full right-0 mt-2 w-80 rounded-xl border border-white/[0.08] bg-[#0a0a0c]/98 shadow-2xl overflow-hidden z-50 animate-fade-in backdrop-blur-xl">
              {/* Header */}
              <div className="p-5 border-b border-white/[0.04] bg-gradient-to-r from-[#00ffc8]/10 via-transparent to-transparent">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#00ffc8]/20 to-[#00c8ff]/10 flex items-center justify-center ring-2 ring-[#00ffc8]/20">
                    <User className="h-7 w-7 text-[#00ffc8]" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{coachData.nome}</div>
                    <div className="text-[10px] text-[#00ffc8]/70 uppercase tracking-wider font-medium">{coachData.cargo}</div>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="p-5 space-y-4">
                <div className="text-[10px] font-semibold text-white/30 uppercase tracking-wider flex items-center gap-2">
                  <Trophy className="h-3 w-3 text-[#ffd700]" />
                  Estatisticas da Temporada
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center p-3 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                    <div className="text-lg font-bold text-white">{coachData.partidasTotal}</div>
                    <div className="text-[9px] text-white/40 uppercase">Jogos</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-[#00ffc8]/10 border border-[#00ffc8]/20">
                    <div className="text-lg font-bold text-[#00ffc8]">{coachData.vitorias}</div>
                    <div className="text-[9px] text-white/40 uppercase">V</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-[#ffd700]/10 border border-[#ffd700]/20">
                    <div className="text-lg font-bold text-yellow-400">{coachData.empates}</div>
                    <div className="text-[9px] text-white/40 uppercase">E</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="text-lg font-bold text-red-400">{coachData.derrotas}</div>
                    <div className="text-[9px] text-white/40 uppercase">D</div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-[#00ffc8]" />
                    <span className="text-xs text-white/60">Aproveitamento</span>
                  </div>
                  <span className="text-sm font-bold text-[#00ffc8]">{coachData.aproveitamento}%</span>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-white/40" />
                    <span className="text-xs text-white/60">Sequencia</span>
                  </div>
                  <span className="text-sm font-bold text-[#00ffc8]">{coachData.sequencia}</span>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-400" />
                    <span className="text-xs text-white/60">Titulos na Temporada</span>
                  </div>
                  <span className="text-sm font-bold text-white">{coachData.titulosTemporada}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-white/[0.04] bg-white/[0.01]">
                <Link 
                  href="/perfil" 
                  onClick={() => setShowCoachDropdown(false)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 text-xs font-semibold text-[#00ffc8] hover:text-[#00ffdc] transition-colors rounded-lg hover:bg-[#00ffc8]/10"
                >
                  Ver perfil completo
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

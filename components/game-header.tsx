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
  const [showCoachDropdown, setShowCoachDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowCoachDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Dados do tecnico (mock - pode ser integrado com save-system)
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

      {/* Right - Season Info & Actions */}
      <div className="flex items-center gap-3">
        {/* Season/Week Info - compacto */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10">
          <Calendar className="h-3 w-3 text-[#1db954]" />
          <span className="text-[10px] text-white/60">{state.season}</span>
          <span className="text-white/20">|</span>
          <span className="text-[10px] text-white/60">Sem</span>
          <span className="text-[10px] text-white font-medium">{state.week}<span className="text-white/40">/48</span></span>
        </div>

        <div className="w-px h-5 bg-white/10 hidden lg:block" />

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

        {/* Team badge com dropdown do tecnico */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowCoachDropdown(!showCoachDropdown)}
            className={cn(
              "flex items-center gap-2 pl-2 border-l border-white/10 py-1 pr-2 rounded-r transition-colors",
              showCoachDropdown ? "bg-white/10" : "hover:bg-white/5"
            )}
          >
            <TeamCrest team={userTeam} size="xs" />
            <span className="text-[11px] font-medium text-white/80 hidden sm:inline">{userTeam.curto}</span>
            <ChevronDown className={cn(
              "h-3 w-3 text-white/40 transition-transform hidden sm:block",
              showCoachDropdown && "rotate-180"
            )} />
          </button>

          {/* Dropdown do tecnico */}
          {showCoachDropdown && (
            <div className="absolute top-full right-0 mt-2 w-72 rounded-xl border border-white/10 bg-[#111111] shadow-2xl overflow-hidden z-50 animate-fade-in">
              {/* Header do dropdown */}
              <div className="p-4 border-b border-white/5 bg-gradient-to-r from-[#1db954]/10 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#1db954]/20 flex items-center justify-center">
                    <User className="h-6 w-6 text-[#1db954]" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{coachData.nome}</div>
                    <div className="text-[10px] text-white/50 uppercase tracking-wider">{coachData.cargo}</div>
                  </div>
                </div>
              </div>

              {/* Estatisticas do tecnico */}
              <div className="p-4 space-y-3">
                <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider flex items-center gap-1.5">
                  <Trophy className="h-3 w-3" />
                  Estatisticas da Temporada
                </div>

                {/* Linha de partidas */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center p-2 rounded-lg bg-white/5">
                    <div className="text-lg font-bold text-white">{coachData.partidasTotal}</div>
                    <div className="text-[9px] text-white/40">Jogos</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-[#1db954]/10">
                    <div className="text-lg font-bold text-[#1db954]">{coachData.vitorias}</div>
                    <div className="text-[9px] text-white/40">V</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-yellow-500/10">
                    <div className="text-lg font-bold text-yellow-400">{coachData.empates}</div>
                    <div className="text-[9px] text-white/40">E</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-red-500/10">
                    <div className="text-lg font-bold text-red-400">{coachData.derrotas}</div>
                    <div className="text-[9px] text-white/40">D</div>
                  </div>
                </div>

                {/* Aproveitamento e sequencia */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-[#1db954]" />
                    <span className="text-xs text-white/60">Aproveitamento</span>
                  </div>
                  <span className="text-sm font-bold text-[#1db954]">{coachData.aproveitamento}%</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-white/40" />
                    <span className="text-xs text-white/60">Sequencia</span>
                  </div>
                  <span className="text-sm font-bold text-[#1db954]">{coachData.sequencia}</span>
                </div>

                {/* Titulos */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-400" />
                    <span className="text-xs text-white/60">Titulos na Temporada</span>
                  </div>
                  <span className="text-sm font-bold text-white">{coachData.titulosTemporada}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-white/5 bg-white/[0.02]">
                <Link 
                  href="/perfil" 
                  onClick={() => setShowCoachDropdown(false)}
                  className="flex items-center justify-center gap-2 w-full py-2 text-xs font-medium text-[#1db954] hover:text-[#1ed760] transition-colors"
                >
                  Ver perfil completo
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

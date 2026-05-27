"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { 
  Scale, 
  Users, 
  LayoutList,
  Zap,
  Heart,
  TrendingUp,
  ChevronRight,
  Plus,
  Folder
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { TeamCrest } from "@/components/team-crest"
import { cn } from "@/lib/utils"
import { getTeamByShort, serieATeams } from "@/lib/teams-data"
import { useGameState } from "@/lib/save-system"
import { useDiscordActivity } from "@/hooks/use-discord-rpc"
import { getPlayersForTeam, sortByPosition } from "@/lib/players-data"

// Icone de formacao tatica (campo com jogadores)
function FormationIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 120" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
      {/* Campo */}
      <rect x="5" y="5" width="90" height="110" rx="2" strokeOpacity="0.4" />
      {/* Linha do meio */}
      <line x1="5" y1="60" x2="95" y2="60" strokeOpacity="0.3" />
      {/* Circulo central */}
      <circle cx="50" cy="60" r="12" strokeOpacity="0.3" />
      {/* Area superior */}
      <rect x="25" y="5" width="50" height="18" strokeOpacity="0.3" />
      {/* Area inferior */}
      <rect x="25" y="97" width="50" height="18" strokeOpacity="0.3" />
      
      {/* Jogadores - 4-3-3 */}
      {/* Goleiro */}
      <circle cx="50" cy="105" r="4" fill="currentColor" fillOpacity="0.9" />
      {/* Defesa */}
      <circle cx="20" cy="85" r="4" fill="currentColor" fillOpacity="0.9" />
      <circle cx="40" cy="88" r="4" fill="currentColor" fillOpacity="0.9" />
      <circle cx="60" cy="88" r="4" fill="currentColor" fillOpacity="0.9" />
      <circle cx="80" cy="85" r="4" fill="currentColor" fillOpacity="0.9" />
      {/* Meio */}
      <circle cx="30" cy="60" r="4" fill="currentColor" fillOpacity="0.9" />
      <circle cx="50" cy="65" r="4" fill="currentColor" fillOpacity="0.9" />
      <circle cx="70" cy="60" r="4" fill="currentColor" fillOpacity="0.9" />
      {/* Ataque */}
      <circle cx="25" cy="35" r="4" fill="currentColor" fillOpacity="0.9" />
      <circle cx="50" cy="25" r="4" fill="currentColor" fillOpacity="0.9" />
      <circle cx="75" cy="35" r="4" fill="currentColor" fillOpacity="0.9" />
    </svg>
  )
}

// Icone de escalacoes (campo simples)
function LineupsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 120" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      {/* Campo principal */}
      <rect x="10" y="10" width="80" height="100" rx="2" />
      {/* Linha do meio */}
      <line x1="10" y1="60" x2="90" y2="60" />
      {/* Circulo central */}
      <circle cx="50" cy="60" r="10" />
      {/* Ponto central */}
      <circle cx="50" cy="60" r="2" fill="currentColor" />
      {/* Area superior */}
      <rect x="30" y="10" width="40" height="15" />
      {/* Pequena area superior */}
      <rect x="40" y="10" width="20" height="6" />
      {/* Area inferior */}
      <rect x="30" y="95" width="40" height="15" />
      {/* Pequena area inferior */}
      <rect x="40" y="104" width="20" height="6" />
    </svg>
  )
}

export default function ElencoHubPage() {
  const router = useRouter()
  const { state } = useGameState()
  const userTeam = getTeamByShort(state.selectedTeamShort || "BGT") || serieATeams[0]
  const [selectedCard, setSelectedCard] = useState<number | null>(null)
  const [hoveredCard, setHoveredCard] = useState<number | null>(null)

  // Obter jogadores do time
  const teamPlayers = useMemo(() => {
    return getPlayersForTeam(userTeam)
  }, [userTeam])

  // Calcular estatisticas medias do elenco
  const squadStats = useMemo(() => {
    if (teamPlayers.length === 0) return { avgOverall: 0, avgAge: 0, totalPlayers: 0 }
    const avgOverall = Math.round(teamPlayers.reduce((sum, p) => sum + p.base, 0) / teamPlayers.length)
    const avgAge = Math.round(teamPlayers.reduce((sum, p) => sum + p.idade, 0) / teamPlayers.length)
    return { avgOverall, avgAge, totalPlayers: teamPlayers.length }
  }, [teamPlayers])

  // Discord RPC
  useDiscordActivity({
    state: `Gerenciando ${userTeam.nome}`,
    details: "Elenco",
    largeImageKey: "logo",
  })

  const cards = [
    {
      id: 1,
      title: "Visao Tatica",
      subtitle: "Visao tatica atual",
      icon: Scale,
      description: "Padrao",
      bottomText: "Impacto em atleta",
      route: "/elenco/taticas",
      color: "from-cyan-500/20 to-teal-500/10",
      borderColor: "border-cyan-500/30",
      accentColor: "text-cyan-400",
    },
    {
      id: 2,
      title: "Gerenciamento do Time",
      subtitle: `Padrao ${userTeam.nome.toUpperCase()}`,
      icon: null, // Usara FormationIcon
      customIcon: true,
      stats: [
        { icon: Zap, label: "Prep. fisico", value: 78 },
        { icon: TrendingUp, label: "Ritmo", value: 82 },
        { icon: Heart, label: "Moral", value: 85 },
      ],
      route: "/elenco/gerenciamento",
      color: "from-cyan-500/20 to-teal-500/10",
      borderColor: "border-cyan-500/30",
      accentColor: "text-cyan-400",
    },
    {
      id: 3,
      title: "Escalacoes",
      subtitle: "Escalacoes criadas: 1",
      icon: null,
      customIcon: "lineups",
      description: "Monte e use diversas escalacoes para aproveitar o elenco ao maximo. Alterne escalacoes para se adaptar aos times adversarios e dar ao elenco inteiro uma chance de entrar em campo.",
      route: "/elenco/escalacoes",
      color: "from-cyan-500/20 to-teal-500/10",
      borderColor: "border-cyan-500/30",
      accentColor: "text-cyan-400",
    },
  ]

  const handleCardClick = (card: typeof cards[0]) => {
    setSelectedCard(card.id)
    setTimeout(() => {
      router.push(card.route)
    }, 150)
  }

  return (
    <div className="flex h-screen bg-[#050508] overflow-hidden">
      <GameSidebar />
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <GameHeader />
        
        <main className="flex-1 overflow-hidden relative">
          {/* Background com gradiente e pattern */}
          <div 
            className="absolute inset-0 opacity-30"
            style={{
              background: `
                radial-gradient(ellipse at 30% 50%, ${userTeam.cor1}15 0%, transparent 50%),
                radial-gradient(ellipse at 70% 50%, ${userTeam.cor1}10 0%, transparent 50%),
                linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.5) 100%)
              `,
            }}
          />
          
          {/* Pattern de linhas */}
          <div 
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `
                linear-gradient(45deg, white 1px, transparent 1px),
                linear-gradient(-45deg, white 1px, transparent 1px)
              `,
              backgroundSize: "60px 60px",
            }}
          />

          <div className="relative h-full flex flex-col p-6 lg:p-8">
            {/* Header com info do time */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div 
                    className="absolute inset-0 blur-2xl opacity-40 scale-150"
                    style={{ backgroundColor: userTeam.cor1 }}
                  />
                  <TeamCrest team={userTeam} size="lg" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">{userTeam.nome}</h1>
                  <p className="text-sm text-white/50">
                    {squadStats.totalPlayers} jogadores · Media {squadStats.avgOverall} OVR · {squadStats.avgAge} anos
                  </p>
                </div>
              </div>
            </div>

            {/* Cards Grid */}
            <div className="flex-1 flex items-center justify-center">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
                {cards.map((card, index) => (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={cn(
                      "relative group cursor-pointer",
                      selectedCard === card.id && "scale-95 opacity-50"
                    )}
                    onMouseEnter={() => setHoveredCard(card.id)}
                    onMouseLeave={() => setHoveredCard(null)}
                    onClick={() => handleCardClick(card)}
                  >
                    {/* Card */}
                    <div 
                      className={cn(
                        "relative overflow-hidden rounded-2xl border-2 transition-all duration-300",
                        "bg-gradient-to-br",
                        card.color,
                        hoveredCard === card.id ? "border-cyan-400/60 shadow-lg shadow-cyan-500/20" : card.borderColor,
                        "h-[380px] flex flex-col"
                      )}
                    >
                      {/* Glow effect on hover */}
                      <div 
                        className={cn(
                          "absolute inset-0 opacity-0 transition-opacity duration-300",
                          hoveredCard === card.id && "opacity-100"
                        )}
                        style={{
                          background: "radial-gradient(circle at 50% 0%, rgba(0,255,200,0.15) 0%, transparent 60%)",
                        }}
                      />

                      {/* Content */}
                      <div className="relative flex flex-col h-full p-6">
                        {/* Header */}
                        <div className="text-center mb-4">
                          <h2 className="text-xl font-bold text-white mb-1">{card.title}</h2>
                          <p className={cn("text-sm font-medium", card.accentColor)}>{card.subtitle}</p>
                        </div>

                        {/* Icon/Visual */}
                        <div className="flex-1 flex items-center justify-center">
                          {card.id === 1 && (
                            <div className="flex flex-col items-center">
                              <Scale className="h-24 w-24 text-white/80 mb-4" strokeWidth={1.5} />
                              <span className="text-lg font-semibold text-white/90">{card.description}</span>
                            </div>
                          )}
                          
                          {card.id === 2 && (
                            <div className="flex flex-col items-center w-full">
                              <FormationIcon className="h-32 w-32 text-white/90 mb-4" />
                              
                              {/* Stats */}
                              <div className="flex items-center justify-center gap-6 mt-2">
                                {card.stats?.map((stat, i) => (
                                  <div key={i} className="flex flex-col items-center">
                                    <div className="w-10 h-10 rounded-full border-2 border-cyan-400/50 flex items-center justify-center mb-1">
                                      <stat.icon className="h-5 w-5 text-cyan-400" />
                                    </div>
                                    <span className="text-[10px] text-white/60">{stat.label}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {card.id === 3 && (
                            <div className="flex flex-col items-center px-4">
                              <LineupsIcon className="h-24 w-24 text-white/80 mb-4" />
                              <p className="text-xs text-white/60 text-center leading-relaxed">
                                {card.description}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Bottom */}
                        {card.id === 1 && (
                          <div className="flex items-center justify-between pt-4 border-t border-white/10">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
                                <span className="text-[10px] text-white/60">X</span>
                              </div>
                              <span className="text-xs text-white/50">{card.bottomText}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4].map((dot) => (
                                <div 
                                  key={dot} 
                                  className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    dot === 1 ? "bg-white/60" : "bg-white/20"
                                  )} 
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Hover indicator */}
                      <div 
                        className={cn(
                          "absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 to-teal-400 transition-opacity duration-300",
                          hoveredCard === card.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Bottom action bar */}
            <div className="flex items-center justify-center gap-4 mt-6">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push("/elenco/gerenciamento")}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-semibold shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-shadow"
              >
                <Users className="h-5 w-5" />
                Entrar em gerenciamento
              </motion.button>
            </div>

            {/* Footer controls hint */}
            <div className="flex items-center justify-center gap-8 mt-4 text-xs text-white/30">
              <div className="flex items-center gap-2">
                <div className="px-2 py-1 rounded bg-white/10 text-[10px] font-medium">A</div>
                <span>Selecionar</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-2 py-1 rounded bg-white/10 text-[10px] font-medium">B</div>
                <span>Voltar</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

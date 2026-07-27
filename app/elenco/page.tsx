"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { 
  Scale, 
  Target,
  Users, 
  LayoutList,
  Zap,
  Heart,
  TrendingUp,
  ChevronRight,
  ArrowRight,
  SlidersHorizontal,
  Plus,
  Folder
} from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { TeamCrest } from "@/components/team-crest"
import { cn } from "@/lib/utils"
import { getTeamByShort, serieATeams } from "@/lib/teams-data"
import { hardNavigate } from "@/lib/hard-navigation"
import { useGameState, useManagingNational } from "@/lib/save-system"
import { useDiscordActivity } from "@/hooks/use-discord-rpc"
import { getPlayersForTeam, sortByPosition } from "@/lib/players-data"
import { useGameEngine } from "@/lib/game-engine"
import { useTelaGamepad } from "@/hooks/use-tela-gamepad"
import { useRequireClub } from "@/lib/use-require-team"

const TACTICAL_STYLE_DETAILS = {
  posse_bola: { label: "Posse de Bola", impact: "Passe curto e controle do ritmo", icon: Target },
  contra_ataque: { label: "Contra-Ataque", impact: "Transições rápidas ao recuperar", icon: Zap },
  pressao_alta: { label: "Pressão Alta", impact: "Recuperação no campo adversário", icon: TrendingUp },
  jogo_direto: { label: "Jogo Direto", impact: "Bolas verticais e ataque rápido", icon: ArrowRight },
  jogo_posicional: { label: "Jogo Posicional", impact: "Estrutura e ocupação de espaços", icon: Scale },
} as const

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
  useRequireClub()
  // Controle: convencao unica (B volta). Ver hooks/use-tela-gamepad.ts.
  useTelaGamepad({ aoVoltar: () => hardNavigate("/") })

  const router = useRouter()
  const { state } = useGameState()
  // MODO SELEÇÃO: o "elenco" da seleção é a CONVOCAÇÃO, que vive na página da
  // seleção. Redireciona para lá em vez de mostrar o elenco de clube.
  const { isNational } = useManagingNational()
  useEffect(() => { if (isNational) hardNavigate("/selecao") }, [isNational])
  const playingStyle = useGameEngine((game) => game.teamTactics.playingStyle)
  // Sem time default "BGT": no Tauri o save hidrata assincrono e o primeiro render vinha
  // sem time, mostrando o elenco do RB Bragantino (34 jog, 79 OVR) para qualquer clube.
  const resolvedTeam = state.selectedTeamShort ? getTeamByShort(state.selectedTeamShort) : undefined
  const userTeam = resolvedTeam ?? serieATeams[0]
  const teamReady = Boolean(resolvedTeam)
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
  useDiscordActivity("Elenco", `Gerenciando ${userTeam.nome}`)
  const tacticalStyle = TACTICAL_STYLE_DETAILS[playingStyle] ?? TACTICAL_STYLE_DETAILS.jogo_posicional
  const TacticalStyleIcon = tacticalStyle.icon

  const cards = [
    {
      id: 1,
      title: "Visao Tatica",
      subtitle: "Visao tatica atual",
      icon: Scale,
      description: tacticalStyle.label,
      bottomText: tacticalStyle.impact,
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
    // "Escalacoes" saiu daqui: Gerenciamento do Time ja monta e salva a escalacao,
    // e o card duplicado so dava dois caminhos para a mesma coisa.
  ]

  const handleCardClick = (card: typeof cards[0]) => {
    setSelectedCard(card.id)
    setTimeout(() => {
      hardNavigate(card.route)
    }, 150)
  }

  // Save ainda hidratando: nao ha time. Melhor um loading rapido do que mostrar o
  // elenco do Bragantino para o clube de outra pessoa.
  if (!teamReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050508] text-sm text-white/40">
        Carregando elenco...
      </div>
    )
  }

  return (
    <div className="flex h-screen md:pl-0 pl-0 pb-20 md:pb-0 bg-[#050508] overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <GameHeader />
        
        <main className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 relative pb-12">
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

          <div className="relative min-h-full flex flex-col p-6 lg:p-8">
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
              {/* Colunas derivadas da QUANTIDADE de cards. Era `md:grid-cols-3`
                  fixo; ao remover o card "Escalacoes" sobraram dois, a terceira
                  coluna ficou vazia e o conjunto encostou na esquerda. Assim,
                  incluir ou remover um card nunca mais desalinha a tela. */}
              <div
                className={cn(
                  "grid w-full min-w-0 grid-cols-1 gap-4",
                  cards.length >= 3 ? "max-w-5xl md:grid-cols-3" : "max-w-3xl md:grid-cols-2",
                )}
              >
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
                        hoveredCard === card.id
                          ? "border-cyan-400/80 shadow-[0_0_30px_rgba(0,255,200,0.22)]"
                          : "border-cyan-500/20 shadow-[0_0_18px_rgba(0,255,200,0.06)]",
                        "h-[320px] lg:h-[380px] flex flex-col"
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
                              <TacticalStyleIcon className="h-24 w-24 text-white/80 mb-4" strokeWidth={1.5} />
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
                              <SlidersHorizontal className="h-4 w-4 text-cyan-300" />
                              <span className="text-xs text-white/50">{card.bottomText}</span>
                            </div>
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-300">
                              Editar <ArrowRight className="h-3.5 w-3.5" />
                            </span>
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
                className="group flex items-center gap-3 pl-2 pr-6 py-2 rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400 text-white font-semibold shadow-[0_0_24px_rgba(56,128,255,0.45)] hover:shadow-[0_0_32px_rgba(0,255,200,0.5)] transition-shadow"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-sm">
                  &#9166;
                </span>
                Entrar em gerenciamento
              </motion.button>
            </div>

          </div>
        </main>
      </div>
    </div>
  )
}

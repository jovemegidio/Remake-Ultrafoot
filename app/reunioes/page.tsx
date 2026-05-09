"use client"

import { useState, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  MessageSquare,
  ThumbsUp,
  AlertTriangle,
  Flame,
  Target,
  Compass,
  Star,
  Info,
  Crown,
  Heart,
  AlertCircle,
  Users,
  Trophy,
  Check,
  X,
  Clock,
  ChevronRight,
  Search,
  Filter
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useGameState } from "@/lib/save-system"
import { getTeamByShort, serieATeams, formatCurrency } from "@/lib/teams-data"
import { useGameEngine, MEETING_OPTIONS, type MeetingType, type PlayerMeeting } from "@/lib/game-engine"

const MEETING_ICONS: Record<string, typeof ThumbsUp> = {
  "thumb-up": ThumbsUp,
  "alert-triangle": AlertTriangle,
  "flame": Flame,
  "target": Target,
  "compass": Compass,
  "star": Star,
  "info": Info,
  "crown": Crown,
  "heart": Heart,
  "alert-circle": AlertCircle,
  "users": Users,
  "trophy": Trophy,
}

export default function ReunioesPage() {
  const { state } = useGameState()
  const userTeam = getTeamByShort(state.selectedTeamShort || "BGT") || serieATeams[0]
  const gameEngine = useGameEngine()
  
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null)
  const [selectedMeetingType, setSelectedMeetingType] = useState<MeetingType | null>(null)
  const [lastMeetingResult, setLastMeetingResult] = useState<PlayerMeeting | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterPosition, setFilterPosition] = useState<string>("all")
  const [mounted, setMounted] = useState(false)
  
  const { squadPlayers, playerMeetings, holdMeeting, canMeetPlayer, currentWeek } = gameEngine
  
  // Evita erro de hidratacao
  useEffect(() => {
    setMounted(true)
  }, [])

  // Filtra jogadores
  const filteredPlayers = useMemo(() => {
    return squadPlayers.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesPosition = filterPosition === "all" || p.position === filterPosition
      return matchesSearch && matchesPosition
    })
  }, [squadPlayers, searchTerm, filterPosition])

  const selectedPlayer = selectedPlayerId ? squadPlayers.find(p => p.id === selectedPlayerId) : null
  const canMeet = selectedPlayerId && mounted ? canMeetPlayer(selectedPlayerId) : false

  // Realiza a reuniao
  const handleMeeting = () => {
    if (!selectedPlayerId || !selectedMeetingType) return
    
    const result = holdMeeting(selectedPlayerId, selectedMeetingType)
    setLastMeetingResult(result)
    setSelectedMeetingType(null)
  }

  // Opcoes de reuniao filtradas pelo contexto do jogador
  const availableMeetings = useMemo(() => {
    if (!selectedPlayer) return MEETING_OPTIONS
    
    return MEETING_OPTIONS.filter(m => {
      // Filtra reunioes baseado no contexto
      if (m.type === "apoio_lesao" && !selectedPlayer.injury) return false
      if (m.type === "felicitacao_gol" && selectedPlayer.seasonStats.goals === 0) return false
      if (m.type === "integracao" && currentWeek > 10) return false // So para novos jogadores
      return true
    })
  }, [selectedPlayer, currentWeek])

  // Ultimas reunioes do jogador selecionado
  const playerRecentMeetings = useMemo(() => {
    if (!selectedPlayerId) return []
    return playerMeetings.filter(m => m.playerId === selectedPlayerId).slice(0, 5)
  }, [selectedPlayerId, playerMeetings])

  return (
    <div className="h-screen pl-[72px] bg-[#0a0a0a] flex flex-col overflow-hidden">
      <GameSidebar />
      <GameHeader team={userTeam} />
      
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-6">
            
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                  <MessageSquare className="h-7 w-7 text-primary" />
                  Reunioes com Jogadores
                </h1>
                <p className="text-white/60 mt-1">
                  Converse com seus jogadores para motivar, cobrar ou resolver conflitos
                </p>
              </div>
              
              <div className="text-right">
                <div className="text-sm text-white/50">Reunioes esta semana</div>
                <div className="text-2xl font-bold text-primary">
                  {playerMeetings.filter(m => m.week === currentWeek).length}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-6">
              
              {/* Lista de Jogadores */}
              <div className="col-span-4 bg-[#12121a] rounded-xl border border-white/5 overflow-hidden">
                <div className="p-4 border-b border-white/5">
                  <h3 className="text-sm font-semibold text-white/80 mb-3">Selecionar Jogador</h3>
                  
                  {/* Busca */}
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar jogador..."
                      className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:border-primary/50"
                    />
                  </div>
                  
                  {/* Filtro de posicao */}
                  <div className="flex gap-1 flex-wrap">
                    {["all", "GOL", "ZAG", "LD", "LE", "VOL", "MEI", "PD", "PE", "ATA"].map(pos => (
                      <button
                        key={pos}
                        onClick={() => setFilterPosition(pos)}
                        className={cn(
                          "px-2 py-1 rounded text-xs transition-all",
                          filterPosition === pos
                            ? "bg-primary text-black font-medium"
                            : "bg-white/5 text-white/60 hover:bg-white/10"
                        )}
                      >
                        {pos === "all" ? "Todos" : pos}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="max-h-[500px] overflow-y-auto scrollbar-thin">
                  {filteredPlayers.map(player => {
                    const canMeetThisPlayer = mounted ? canMeetPlayer(player.id) : true
                    const isSelected = selectedPlayerId === player.id
                    
                    return (
                      <button
                        key={player.id}
                        onClick={() => setSelectedPlayerId(player.id)}
                        className={cn(
                          "w-full p-3 flex items-center gap-3 border-b border-white/5 transition-all text-left",
                          isSelected
                            ? "bg-primary/20 border-l-2 border-l-primary"
                            : "hover:bg-white/5"
                        )}
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                          {player.shirtNumber}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">{player.name}</div>
                          <div className="flex items-center gap-2 text-xs text-white/50">
                            <span className="px-1.5 py-0.5 rounded bg-white/10">{player.position}</span>
                            <span>OVR {player.overall}</span>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-1">
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full",
                            player.morale === "Feliz" ? "bg-green-500/20 text-green-400" :
                            player.morale === "Infeliz" ? "bg-red-500/20 text-red-400" :
                            "bg-white/10 text-white/60"
                          )}>
                            {player.morale}
                          </span>
                          {!canMeetThisPlayer && (
                            <span className="text-xs text-white/30 flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Cooldown
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Painel de Reuniao */}
              <div className="col-span-8 space-y-6">
                
                {/* Info do jogador selecionado */}
                {selectedPlayer ? (
                  <>
                    <div className="bg-[#12121a] rounded-xl border border-white/5 p-5">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                          {selectedPlayer.shirtNumber}
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-white">{selectedPlayer.name}</h2>
                          <div className="flex items-center gap-3 text-sm text-white/60">
                            <span>{selectedPlayer.position}</span>
                            <span>|</span>
                            <span>{selectedPlayer.age} anos</span>
                            <span>|</span>
                            <span>OVR {selectedPlayer.overall}</span>
                            <span>|</span>
                            <span className={cn(
                              selectedPlayer.morale === "Feliz" ? "text-green-400" :
                              selectedPlayer.morale === "Infeliz" ? "text-red-400" :
                              "text-white/60"
                            )}>
                              {selectedPlayer.morale}
                            </span>
                          </div>
                        </div>
                        
                        {!canMeet && (
                          <div className="ml-auto px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                            <div className="flex items-center gap-2 text-yellow-400 text-sm">
                              <Clock className="h-4 w-4" />
                              Aguarde para nova reuniao
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Estatisticas do jogador */}
                      <div className="grid grid-cols-4 gap-4">
                        <div className="bg-white/5 rounded-lg p-3 text-center">
                          <div className="text-lg font-bold text-white">{selectedPlayer.seasonStats.matchesPlayed}</div>
                          <div className="text-xs text-white/50">Jogos</div>
                        </div>
                        <div className="bg-white/5 rounded-lg p-3 text-center">
                          <div className="text-lg font-bold text-white">{selectedPlayer.seasonStats.goals}</div>
                          <div className="text-xs text-white/50">Gols</div>
                        </div>
                        <div className="bg-white/5 rounded-lg p-3 text-center">
                          <div className="text-lg font-bold text-white">{selectedPlayer.seasonStats.assists}</div>
                          <div className="text-xs text-white/50">Assistencias</div>
                        </div>
                        <div className="bg-white/5 rounded-lg p-3 text-center">
                          <div className="text-lg font-bold text-white">{selectedPlayer.form}%</div>
                          <div className="text-xs text-white/50">Forma</div>
                        </div>
                      </div>
                    </div>

                    {/* Opcoes de Reuniao */}
                    <div className="bg-[#12121a] rounded-xl border border-white/5 p-5">
                      <h3 className="text-sm font-semibold text-white/80 mb-4">Escolha o Tipo de Conversa</h3>
                      
                      <div className="grid grid-cols-3 gap-3">
                        {availableMeetings.map(meeting => {
                          const Icon = MEETING_ICONS[meeting.icon] || MessageSquare
                          const isSelected = selectedMeetingType === meeting.type
                          
                          return (
                            <button
                              key={meeting.type}
                              onClick={() => canMeet && setSelectedMeetingType(meeting.type)}
                              disabled={!canMeet}
                              className={cn(
                                "p-4 rounded-xl border text-left transition-all",
                                isSelected
                                  ? "bg-primary/20 border-primary"
                                  : canMeet
                                    ? "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                                    : "bg-white/5 border-white/5 opacity-50 cursor-not-allowed"
                              )}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <Icon className={cn("h-5 w-5", isSelected ? "text-primary" : "text-white/60")} />
                                <span className={cn("font-medium text-sm", isSelected ? "text-primary" : "text-white")}>
                                  {meeting.label}
                                </span>
                              </div>
                              <p className="text-xs text-white/50">{meeting.description}</p>
                            </button>
                          )
                        })}
                      </div>
                      
                      {/* Botao de confirmar */}
                      {selectedMeetingType && canMeet && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-6 flex justify-end"
                        >
                          <Button
                            onClick={handleMeeting}
                            className="bg-primary hover:bg-primary/90 text-black font-medium px-6"
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Iniciar Conversa
                          </Button>
                        </motion.div>
                      )}
                    </div>

                    {/* Resultado da Reuniao */}
                    <AnimatePresence>
                      {lastMeetingResult && lastMeetingResult.playerId === selectedPlayerId && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className={cn(
                            "rounded-xl border p-5",
                            lastMeetingResult.playerResponse === "positivo"
                              ? "bg-green-500/10 border-green-500/30"
                              : lastMeetingResult.playerResponse === "negativo"
                                ? "bg-red-500/10 border-red-500/30"
                                : "bg-white/5 border-white/10"
                          )}
                        >
                          <div className="flex items-center gap-3 mb-3">
                            {lastMeetingResult.playerResponse === "positivo" ? (
                              <Check className="h-6 w-6 text-green-400" />
                            ) : lastMeetingResult.playerResponse === "negativo" ? (
                              <X className="h-6 w-6 text-red-400" />
                            ) : (
                              <Info className="h-6 w-6 text-white/60" />
                            )}
                            <h4 className={cn(
                              "font-semibold",
                              lastMeetingResult.playerResponse === "positivo" ? "text-green-400" :
                              lastMeetingResult.playerResponse === "negativo" ? "text-red-400" :
                              "text-white"
                            )}>
                              Resultado da Conversa
                            </h4>
                          </div>
                          <p className="text-white/80">{lastMeetingResult.details}</p>
                          <div className="mt-3 flex gap-4 text-sm">
                            <span className={cn(
                              lastMeetingResult.moraleChange > 0 ? "text-green-400" : 
                              lastMeetingResult.moraleChange < 0 ? "text-red-400" : "text-white/50"
                            )}>
                              Moral: {lastMeetingResult.moraleChange > 0 ? "+" : ""}{lastMeetingResult.moraleChange}
                            </span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Historico de reunioes com este jogador */}
                    {playerRecentMeetings.length > 0 && (
                      <div className="bg-[#12121a] rounded-xl border border-white/5 p-5">
                        <h3 className="text-sm font-semibold text-white/80 mb-4">Historico de Reunioes</h3>
                        <div className="space-y-2">
                          {playerRecentMeetings.map(meeting => (
                            <div
                              key={meeting.id}
                              className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-2 h-2 rounded-full",
                                  meeting.playerResponse === "positivo" ? "bg-green-400" :
                                  meeting.playerResponse === "negativo" ? "bg-red-400" :
                                  "bg-white/40"
                                )} />
                                <div>
                                  <div className="text-sm text-white">
                                    {MEETING_OPTIONS.find(m => m.type === meeting.type)?.label}
                                  </div>
                                  <div className="text-xs text-white/50">Semana {meeting.week}</div>
                                </div>
                              </div>
                              <span className={cn(
                                "text-xs px-2 py-1 rounded",
                                meeting.playerResponse === "positivo" ? "bg-green-500/20 text-green-400" :
                                meeting.playerResponse === "negativo" ? "bg-red-500/20 text-red-400" :
                                "bg-white/10 text-white/60"
                              )}>
                                {meeting.playerResponse}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-[#12121a] rounded-xl border border-white/5 p-12 text-center">
                    <Users className="h-12 w-12 text-white/20 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white/60">Selecione um jogador</h3>
                    <p className="text-sm text-white/40 mt-1">
                      Escolha um jogador da lista para iniciar uma conversa
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Reunioes Recentes (Geral) */}
            <div className="bg-[#12121a] rounded-xl border border-white/5 p-5">
              <h3 className="text-sm font-semibold text-white/80 mb-4">Todas as Reunioes Recentes</h3>
              
              {playerMeetings.length > 0 ? (
                <div className="grid grid-cols-3 gap-3">
                  {playerMeetings.slice(0, 6).map(meeting => (
                    <div
                      key={meeting.id}
                      className="p-4 bg-white/5 rounded-lg border border-white/5"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-white">{meeting.playerName}</span>
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full",
                          meeting.playerResponse === "positivo" ? "bg-green-500/20 text-green-400" :
                          meeting.playerResponse === "negativo" ? "bg-red-500/20 text-red-400" :
                          "bg-white/10 text-white/60"
                        )}>
                          {meeting.playerResponse}
                        </span>
                      </div>
                      <div className="text-xs text-white/50 mb-1">
                        {MEETING_OPTIONS.find(m => m.type === meeting.type)?.label}
                      </div>
                      <div className="text-xs text-white/30">Semana {meeting.week}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-white/40">
                  Nenhuma reuniao realizada ainda
                </div>
              )}
            </div>
            
        </div>
      </main>
    </div>
  )
}

"use client"

import Image from "next/image"
import { useState, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Heart,
  MessageSquare,
  PlayCircle,
  AlertTriangle,
  FileText,
  Dumbbell,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Trophy,
  Newspaper,
  TrendingUp,
  ShoppingBag,
} from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { GamepadControlsBar } from "@/components/gamepad-controls-bar"
import { TeamCrest } from "@/components/team-crest"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { faseDaPartida } from "@/lib/competition-phase"
import { useGameManager } from "@/lib/use-game-manager"
import { useGameEngine, getContractStatus } from "@/lib/game-engine"
import { hardNavigate } from "@/lib/hard-navigation"
import { generateDynamicNews, NEWS_SOURCES, type NewsItem } from "@/components/news-feed"
import { getGameDate } from "@/lib/game-date"
import { useGameState } from "@/lib/save-system"

const WEEKDAYS = ["DOMINGO", "SEGUNDA-FEIRA", "TERCA-FEIRA", "QUARTA-FEIRA", "QUINTA-FEIRA", "SEXTA-FEIRA", "SABADO"]
const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]


// Nomes de torcedores usados so para gerar os comentarios simulados abaixo das noticias.
const FAN_NAMES = [
  "Carlos_Torcedor", "Mari.FC", "JoaoPedro10", "Beatriz_Nacao", "RafaGoleiro",
  "Lucas_Arquibancada", "AnaPaula_FC", "Diego1987", "Camila_Resenha", "Vitor_Bola",
]

// Comentarios simulados (client-side, sem backend) — texto generico reaproveitavel
// para qualquer noticia, ajustado conforme o tipo dela.
function generateSimulatedComments(news: NewsItem): { author: string; text: string }[] {
  const byType: Record<string, string[]> = {
    match_result: ["Mereceu o resultado!", "Faltou atencao na defesa hoje.", "Vamos pra cima na proxima rodada!", "Esse time ta voando esse ano."],
    transfer: ["Reforco que a gente precisava.", "Espero que de certo essa contratacao.", "Diretoria trabalhando bem no mercado."],
    injury: ["Que pena, recupera rapido!", "Vai desfalcar bastante o time.", "Saude pra ele em primeiro lugar."],
    ranking: ["Artilheiro decidindo os jogos.", "Esse cara ta on fire esse ano."],
    standings: ["Time precisa manter a consistencia.", "Falta pouco pra subir mais na tabela."],
    match_preview: ["Vai ser jogo dificil.", "Confio no nosso time pra esse confronto."],
    highlight: ["Boa fase do clube.", "Torcida confiante pro resto da temporada."],
    announcement: ["Otima noticia pro clube!"],
  }
  const pool = byType[news.type] ?? ["Bom saber disso.", "Vamos acompanhar de perto."]
  const count = 3 + (seedHash(news.id) % 4)
  return Array.from({ length: count }, (_, i) => ({
    author: FAN_NAMES[(seedHash(news.id + i) ) % FAN_NAMES.length],
    text: pool[(seedHash(news.id + i + "t")) % pool.length],
  }))
}

function seedHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function formatNewsCount(num: number): string {
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

export default function PreOfficePage() {
  const {
    hydrated,
    userTeam,
    seasonCalendar,
    currentRound,
    advanceWeek,
    saveState,
  } = useGameManager()
  const gameEngine = useGameEngine()

  // A partir daqui a carreira existe de verdade e pode ser salva. Antes do
  // pre-office o tecnico ainda esta no fluxo de criacao, e salvar gravava um
  // slot vazio que aparecia em "Carregar" sem temporada nenhuma.
  const { state: estadoSalvo, setState: setEstadoSalvo } = useGameState()
  useEffect(() => {
    if (!hydrated) return
    if (!estadoSalvo.selectedTeamShort || estadoSalvo.preOfficeVisitado) return
    setEstadoSalvo({ preOfficeVisitado: true })
  }, [hydrated, estadoSalvo.selectedTeamShort, estadoSalvo.preOfficeVisitado, setEstadoSalvo])

  const [isAdvancing, setIsAdvancing] = useState(false)
  const [selectedTask, setSelectedTask] = useState(0)
  const [currentNewsIndex, setCurrentNewsIndex] = useState(0)
  const [likedNews, setLikedNews] = useState<Set<string>>(new Set())
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [extraComments, setExtraComments] = useState<Record<string, { author: string; text: string }[]>>({})
  const [commentDraft, setCommentDraft] = useState("")

  // Noticias geradas a partir de dados reais da carreira (resultados, tabela, artilharia),
  // mesma fonte usada no widget de noticias do dashboard (components/news-feed.tsx).
  const news = useMemo(
    () => generateDynamicNews(
      userTeam?.curto ?? null,
      saveState.season,
      saveState.week,
      gameEngine.matchResults ?? [],
      gameEngine.serieAStandings ?? [],
      gameEngine.topScorers ?? [],
    ),
    [userTeam, saveState.season, saveState.week, gameEngine.matchResults, gameEngine.serieAStandings, gameEngine.topScorers],
  )
  const currentNews = news[currentNewsIndex] ?? news[0]
  const simulatedComments = useMemo(
    () => (currentNews ? generateSimulatedComments(currentNews) : []),
    [currentNews],
  )
  const visibleComments = currentNews
    ? [...simulatedComments, ...(extraComments[currentNews.id] ?? [])]
    : []

  const toggleLikeNews = useCallback((id: string) => {
    setLikedNews(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const postComment = useCallback(() => {
    if (!currentNews || !commentDraft.trim()) return
    setExtraComments(prev => ({
      ...prev,
      [currentNews.id]: [...(prev[currentNews.id] ?? []), { author: "Voce", text: commentDraft.trim() }],
    }))
    setCommentDraft("")
  }, [currentNews, commentDraft])

  useEffect(() => {
    setCommentsOpen(false)
    setCommentDraft("")
  }, [currentNewsIndex])

  // Data do jogo derivada da semana real do saveState
  const gameDate = useMemo(
    () => getGameDate(saveState.season, saveState.week),
    [saveState.week, saveState.season],
  )

  const dayOfWeek = WEEKDAYS[gameDate.getDay()]
  const day = gameDate.getDate().toString().padStart(2, '0')
  const month = MONTHS[gameDate.getMonth()]

  const nextUserMatch = seasonCalendar.nextUserMatch

  // Dias ate proxima partida (aprox 7 dias por rodada)
  const daysUntilMatch = nextUserMatch
    ? Math.max(1, (nextUserMatch.round - currentRound) * 7)
    : null

  // Adversario da proxima partida
  const nextOpponent = nextUserMatch && userTeam
    ? (nextUserMatch.homeTeam.curto === userTeam.curto
        ? nextUserMatch.awayTeam
        : nextUserMatch.homeTeam)
    : null

  // Tarefas dinamicas baseadas em dados reais do jogo
  const realTasks = useMemo(() => {
    if (!userTeam) return []
    const engineWeek = gameEngine.currentWeek
    const tasks: Array<{
      id: number
      title: string
      icon: React.ElementType
      action: string
      actionLabel: string
      priority: "high" | "medium" | "low"
    }> = []

    // Proxima partida
    if (nextUserMatch) {
      const opponent = nextUserMatch.homeTeam.curto === userTeam.curto
        ? nextUserMatch.awayTeam.nome
        : nextUserMatch.homeTeam.nome
      tasks.push({
        id: 1,
        title: `Preparar para ${opponent}`,
        icon: Trophy,
        action: "/partida",
        actionLabel: "Ir para Partida",
        priority: "high"
      })
    }

    // Jogadores lesionados
    const injured = gameEngine.squadPlayers.filter(p => p.injury)
    if (injured.length > 0) {
      tasks.push({
        id: 2,
        title: `${injured.length} Jogador${injured.length > 1 ? "es" : ""} Lesionado${injured.length > 1 ? "s" : ""}`,
        icon: AlertTriangle,
        action: "/elenco",
        actionLabel: "Ver Elenco",
        priority: "high"
      })
    }

    // Contratos expirando
    const expiring = gameEngine.squadPlayers.filter(p =>
      getContractStatus(p, engineWeek) === "expiring" ||
      getContractStatus(p, engineWeek) === "expired"
    )
    if (expiring.length > 0) {
      tasks.push({
        id: 3,
        title: `${expiring.length} Contrato${expiring.length > 1 ? "s" : ""} Expirando`,
        icon: FileText,
        action: "/elenco",
        actionLabel: "Renovar Contratos",
        priority: "medium"
      })
    }

    // Ofertas de transferencia pendentes
    const pendingOffers = gameEngine.transferOffers.filter(o => o.status === "pendente")
    if (pendingOffers.length > 0) {
      tasks.push({
        id: 4,
        title: `${pendingOffers.length} Oferta${pendingOffers.length > 1 ? "s" : ""} de Transferencia`,
        icon: ShoppingBag,
        action: "/mercado",
        actionLabel: "Ver Mercado",
        priority: "medium"
      })
    }

    // Treino (sempre disponivel)
    tasks.push({
      id: 5,
      title: "Sessao de Treinamento",
      icon: Dumbbell,
      action: "/treinamento",
      actionLabel: "Abrir Treino",
      priority: tasks.length === 0 ? "high" : "low"
    })

    // Classificacao (sempre disponivel)
    tasks.push({
      id: 6,
      title: "Ver Classificacao",
      icon: TrendingUp,
      action: "/competicoes",
      actionLabel: "Ver Tabela",
      priority: "low"
    })

    return tasks
  }, [gameEngine.squadPlayers, gameEngine.transferOffers, gameEngine.currentWeek, nextUserMatch, userTeam])

  // Avanca rodada real e navega conforme resultado
  const handleAdvance = useCallback(async () => {
    setIsAdvancing(true)
    try {
      const result = await advanceWeek()
      if (result?.newSeason) {
        hardNavigate("/", true)
        return
      }
      const nextMatch = result?.nextUserMatch
      if (nextMatch && nextMatch.round === (saveState.week + 1)) {
        hardNavigate("/partida", true)
      }
      // Sem jogo nesta rodada: fica na pre-office, data atualiza via saveState
    } finally {
      setIsAdvancing(false)
    }
  }, [advanceWeek, saveState.week])

  // Suporte a gamepad
  useEffect(() => {
    const handler = (e: Event) => {
      const btn = (e as CustomEvent).detail?.button
      if (btn === 'B') hardNavigate("/")
      if (btn === 'A') {
        const task = realTasks[selectedTask]
        if (task) hardNavigate(task.action)
      }
      if (btn === 'X') handleAdvance()
      if (btn === 'DPAD_UP') setSelectedTask(prev => Math.max(0, prev - 1))
      if (btn === 'DPAD_DOWN') setSelectedTask(prev => Math.min(realTasks.length - 1, prev + 1))
      if (btn === 'RB') setCurrentNewsIndex(prev => (prev + 1) % news.length)
      if (btn === 'LB') setCurrentNewsIndex(prev => (prev - 1 + news.length) % news.length)
    }
    window.addEventListener('gamepad:button', handler)
    return () => window.removeEventListener('gamepad:button', handler)
  }, [selectedTask, realTasks, handleAdvance, news])

  if (!hydrated || !userTeam) {
    return (
      <div className="h-screen bg-[#050508] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-[#00ffc8] border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="relative flex h-screen md:pl-0 pl-0 pb-20 md:pb-0 overflow-hidden">
      {/* Background base escura */}
      <div className="absolute inset-0 bg-[#050508]" />
      {/* Mesmos fundos do escritorio (/), com o crossfade suave — a pedido do usuario. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <Image src="/images/office-bg-1.png" alt="" fill priority unoptimized className="office-bg-a object-cover" />
        <Image src="/images/office-bg-2.png" alt="" fill unoptimized className="office-bg-b object-cover" />
      </div>
      {/* Brilho radial para profundidade. Em DIA DE FINAL o escritorio fica
          tematico: o verde padrao da lugar ao dourado de decisao (pedido). */}
      <div className="absolute inset-0" style={{
        background: faseDaPartida(nextUserMatch)?.isFinal
          ? "radial-gradient(ellipse 95% 75% at 50% 15%, rgba(255,199,0,0.22) 0%, rgba(255,140,0,0.08) 38%, transparent 65%)"
          : "radial-gradient(ellipse 90% 70% at 50% 20%, rgba(34,197,94,0.12) 0%, transparent 60%)"
      }} />
      {/* Moldura dourada sutil emoldurando a tela na final. */}
      {faseDaPartida(nextUserMatch)?.isFinal && (
        <div className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-[#ffd700]/25" />
      )}
      {/* Camadas de escurecimento para legibilidade do conteudo */}
      <div className="absolute inset-0 bg-[#050508]/78" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#050b07] via-[#050b07]/70 to-[#050b07]/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#050b07] via-transparent to-[#050b07]/60" />
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse 120% 100% at 50% 50%, transparent 35%, rgba(0,0,0,0.55) 100%)"
      }} />


      <main className="relative z-10 flex-1 overflow-hidden flex flex-col">
        <GameHeader team={userTeam} />

        <div className="flex-1 p-6 md:p-8 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,420px] gap-8 max-w-7xl mx-auto">

            {/* Coluna Esquerda */}
            <div className="space-y-6">

              {/* Data atual do jogo */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={gameDate.toISOString()}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
                    {dayOfWeek}, {month} {day}
                  </h1>
                </motion.div>
              </AnimatePresence>

              {/* Proximo evento */}
              <motion.div
                className="flex items-center gap-4 text-white/70"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                {daysUntilMatch !== null ? (
                  <span className="text-lg">
                    Proxima Partida em {daysUntilMatch} dia{daysUntilMatch !== 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="text-lg text-white/40">Sem partidas agendadas</span>
                )}
              </motion.div>

              {/* Preview da proxima partida */}
              <div className="flex flex-col items-center py-4">
                {nextUserMatch && nextOpponent ? (
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-center gap-2">
                      <TeamCrest team={userTeam} size="lg" />
                      <span className="text-xs text-white/50">Seu time</span>
                    </div>
                    <span className="text-white text-2xl font-bold">vs</span>
                    <div className="flex flex-col items-center gap-2">
                      <TeamCrest team={nextOpponent} size="lg" />
                      <span className="text-xs text-white/50">{nextOpponent.curto}</span>
                    </div>
                    <div className="ml-4 text-right">
                      <div className="text-xs text-white/40 uppercase tracking-wider">{nextUserMatch.competition}</div>
                      {(() => {
                        const fase = faseDaPartida(nextUserMatch)
                        if (!fase) return <div className="text-sm text-white/70">Rod. {nextUserMatch.round}</div>
                        return (
                          <div className={cn(
                            "mt-0.5 inline-block rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider",
                            fase.isFinal
                              ? "bg-gradient-to-r from-[#ffd700] to-[#ffb300] text-black shadow-[0_0_12px_rgba(255,215,0,0.5)]"
                              : fase.isKnockout ? "bg-red-500/20 text-red-300" : "bg-white/10 text-white/60",
                          )}>
                            {fase.isFinal ? "🏆 " : ""}{fase.label}
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                      <Calendar className="w-8 h-8 text-white/40" />
                    </div>
                    <span className="text-white/40 text-sm">Nenhuma partida proxima</span>
                  </div>
                )}
              </div>

              {/* Lista de Tarefas dinamica */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-white/50 text-sm font-medium">
                    Lista de Tarefas ({realTasks.length})
                  </h2>
                  {saveState.week > 0 && (
                    <span className="text-xs text-white/30">Rodada {saveState.week}</span>
                  )}
                </div>

                <div className="space-y-2">
                  {realTasks.map((task, index) => {
                    const Icon = task.icon
                    const isSelected = index === selectedTask

                    return (
                      <motion.button
                        key={task.id}
                        onClick={() => {
                          setSelectedTask(index)
                          hardNavigate(task.action)
                        }}
                        className={cn(
                          "w-full flex items-center gap-4 p-4 rounded-xl transition-all text-left",
                          "bg-gradient-to-r from-white/[0.03] to-transparent",
                          "border border-white/[0.06]",
                          isSelected && "border-white/20 bg-white/[0.06]",
                          "hover:border-white/15 hover:bg-white/[0.04]"
                        )}
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className={cn(
                          "w-14 h-14 rounded-xl flex items-center justify-center",
                          "bg-gradient-to-br from-white/10 to-white/5",
                          task.priority === "high" && "from-amber-500/20 to-amber-500/5"
                        )}>
                          <Icon className={cn(
                            "w-6 h-6",
                            task.priority === "high" ? "text-amber-400" : "text-white/60"
                          )} />
                        </div>

                        <div className="flex-1">
                          <h3 className="text-white font-medium">{task.title}</h3>
                          <div className="flex items-center gap-2 text-white/40 text-sm mt-0.5">
                            <span className="text-xs bg-white/10 rounded px-1.5 py-0.5">A</span>
                            <span>{task.actionLabel}</span>
                          </div>
                        </div>

                        <ChevronRight className="w-5 h-5 text-white/20" />
                      </motion.button>
                    )
                  })}
                </div>

                {/* Botoes */}
                <div className="flex items-center gap-3 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1 bg-white/5 border-white/10 text-white hover:bg-white/10"
                    onClick={() => hardNavigate("/")}
                  >
                    Voltar ao Dashboard
                  </Button>
                  <Button
                    className="flex-1 bg-primary hover:bg-primary/90"
                    onClick={handleAdvance}
                    disabled={isAdvancing}
                  >
                    {isAdvancing ? "Avancando..." : "Avancar"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Coluna Direita - Feed de Noticias */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-white/50 text-sm font-medium flex items-center gap-2">
                  <Newspaper className="w-4 h-4" />
                  Feed de Noticias
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentNewsIndex(prev => (prev - 1 + news.length) % news.length)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 text-white/60" />
                  </button>
                  <button
                    onClick={() => setCurrentNewsIndex(prev => (prev + 1) % news.length)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 text-white/60" />
                  </button>
                </div>
              </div>

              {currentNews && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentNewsIndex}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="rounded-2xl overflow-hidden bg-gradient-to-br from-white/[0.04] to-transparent border border-white/[0.06]"
                >
                  <div className="relative aspect-[16/10] bg-gradient-to-br from-green-900/50 to-green-800/30">
                    <div
                      className="absolute inset-0 bg-cover bg-center opacity-80"
                      style={{ backgroundImage: "url('/stadium-bg.jpg')" }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    {currentNews.isNew && (
                      <span className="absolute top-3 right-3 px-3 py-1 rounded-lg bg-[#c8ff00] text-black text-xs font-bold">
                        New
                      </span>
                    )}
                  </div>

                  <div className="p-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center">
                        <span className="text-xs font-bold text-white">FC</span>
                      </div>
                      <span className="text-white font-semibold text-sm">
                        {NEWS_SOURCES[currentNews.source].name}
                      </span>
                      <span className="text-white/40 text-sm">
                        {currentNews.date}
                      </span>
                    </div>

                    <p className="text-white/80 text-sm leading-relaxed">
                      {currentNews.title}{currentNews.description ? ` — ${currentNews.description}` : ""}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => toggleLikeNews(currentNews.id)}
                          className={cn(
                            "flex items-center gap-1.5 transition-colors",
                            likedNews.has(currentNews.id) ? "text-red-400" : "text-white/50 hover:text-red-400"
                          )}
                        >
                          <Heart className={cn("w-4 h-4", likedNews.has(currentNews.id) && "fill-red-400")} />
                          <span className="text-sm">
                            {formatNewsCount(currentNews.likes + (likedNews.has(currentNews.id) ? 1 : 0))}
                          </span>
                        </button>
                        <button
                          onClick={() => setCommentsOpen(v => !v)}
                          className={cn(
                            "flex items-center gap-1.5 transition-colors",
                            commentsOpen ? "text-primary" : "text-white/50 hover:text-primary"
                          )}
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span className="text-sm">{formatNewsCount(currentNews.comments + (extraComments[currentNews.id]?.length ?? 0))}</span>
                        </button>
                      </div>
                      <button
                        onClick={() => setCommentsOpen(v => !v)}
                        className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors text-sm"
                      >
                        <PlayCircle className="w-4 h-4" />
                        {commentsOpen ? "Ocultar Comentarios" : "Ver Comentarios"}
                      </button>
                    </div>

                    {commentsOpen && (
                      <div className="space-y-3 pt-2 border-t border-white/[0.06]">
                        <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                          {visibleComments.map((c, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <span className="font-semibold text-white/70 shrink-0">{c.author}:</span>
                              <span className="text-white/60">{c.text}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            value={commentDraft}
                            onChange={(e) => setCommentDraft(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") postComment() }}
                            placeholder="Escreva um comentario..."
                            className="bg-white/5 border-white/10 text-white text-sm h-9"
                          />
                          <Button size="sm" onClick={postComment} disabled={!commentDraft.trim()}>
                            Enviar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
              )}

              <div className="flex items-center justify-center gap-2">
                {news.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentNewsIndex(index)}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all",
                      index === currentNewsIndex ? "bg-white w-6" : "bg-white/30 hover:bg-white/50"
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <GamepadControlsBar
          customActions={[
            { button: "A", label: "Selecionar Tarefa" },
            { button: "B", label: "Voltar" },
            { button: "X", label: "Avancar Rodada" },
            { button: "LB", label: "Feed Anterior" },
            { button: "RB", label: "Proximo Feed" },
          ]}
        />
      </main>

      {/* Overlay de avanco de rodada */}
      <AnimatePresence>
        {isAdvancing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="text-center"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, ease: "linear", repeat: Infinity }}
                className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full mx-auto mb-6"
              />
              <h2 className="text-3xl font-bold text-white mb-2">Avancando...</h2>
              <p className="text-white/60">Processando eventos do dia</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

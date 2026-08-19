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
  Users,
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
import { siglaExibivel } from "@/lib/club-identity"
import { modalidadeDoSave } from "@/lib/modalidade-de-carreira"
import { tomDaModalidade } from "@/lib/tom-da-modalidade"

/** Sentinela: nao e rota, e a acao de virar o ano. */
const PROXIMA_TEMPORADA = "__proxima-temporada__"

/** Uma tarefa do escritorio. Nomeado para a adaptacao por modalidade poder cita-lo. */
interface TarefaDoEscritorio {
  id: number
  title: string
  icon: React.ElementType
  action: string
  actionLabel: string
  priority: "high" | "medium" | "low"
}

/** As tarefas que NAO fazem sentido em cada modalidade, por rota de destino. */
const TAREFAS_FORA_DA_MODALIDADE: Record<string, string[]> = {
  // Na base nao se compra atleta nem se marca amistoso de pre-temporada de
  // profissional: o calendario e o da categoria e o elenco vem de dentro de casa.
  sub20: ["/mercado", "/amistosos"],
  // O atleta nao gere elenco, nao cuida de contrato alheio e nao abre mercado.
  jogador: ["/mercado", "/amistosos", "/elenco", "/competicoes"],
}

/**
 * O ESCRITORIO DE CADA CARREIRA.
 *
 * ⚠️ Tira o que nao e daquele trabalho e poe o que e. A regra da lista original
 * continua valendo aqui: tarefa que aponta para tela que nao serve aquela
 * carreira e pior do que tarefa nenhuma, porque ensina o jogador a ignorar o
 * escritorio inteiro.
 */
function adaptarTarefasAModalidade(
  tarefas: TarefaDoEscritorio[],
  modalidade: string,
): TarefaDoEscritorio[] {
  const fora = TAREFAS_FORA_DA_MODALIDADE[modalidade] ?? []
  const restantes = tarefas.filter(t => !fora.includes(t.action))

  if (modalidade === "sub20") {
    restantes.push({
      id: 201,
      title: "Promover garotos ao profissional",
      icon: TrendingUp,
      action: "/base/carreira",
      actionLabel: "Ver a base",
      priority: "high",
    })
    return restantes
  }

  if (modalidade === "jogador") {
    // O escritorio do ATLETA: o que ele de fato decide na semana.
    return [
      {
        id: 301,
        title: "Sua semana de treino",
        icon: Dumbbell,
        action: "/carreira/jogador?aba=treino",
        actionLabel: "Definir intensidade",
        priority: "high",
      },
      {
        id: 302,
        title: "Conversas e entrevistas",
        icon: MessageSquare,
        action: "/carreira/jogador?aba=conversas",
        actionLabel: "Responder",
        priority: "medium",
      },
      {
        id: 303,
        title: "Propostas e contrato",
        icon: FileText,
        action: "/carreira/jogador?aba=propostas",
        actionLabel: "Ver propostas",
        priority: "medium",
      },
      {
        id: 304,
        title: "Sua carreira",
        icon: Trophy,
        action: "/carreira/jogador",
        actionLabel: "Abrir",
        priority: "low",
      },
      ...restantes.filter(t => t.action === "/partida"),
    ]
  }

  return restantes
}

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
  const modalidade = modalidadeDoSave(estadoSalvo)
  const tomDaCarreira = tomDaModalidade(modalidade)
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
      if (next.has(id)) next.delete(id)
      else next.add(id)
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
    const engineSeason = gameEngine.currentSeason
    const tasks: TarefaDoEscritorio[] = []

    // FIM DE TEMPORADA. Sem partida marcada, a lista ficava sem o item principal
    // e o tecnico nao tinha por onde seguir — nao havia como iniciar o ano
    // seguinte a nao ser avancando semanas no escuro.
    if (!nextUserMatch) {
      // A diretoria (SeasonReviewBridge) definiu o desfecho da renovacao:
      //  - ofertas: sem renovacao -> Area do Treinador para ver as propostas;
      //  - negociar: renovacao com contraproposta na Area do Treinador;
      //  - auto/indefinido: renovado, segue para a proxima temporada.
      const renovacao = estadoSalvo.renewalStatus
      if (renovacao === "ofertas") {
        tasks.push({
          id: 102,
          title: "Contrato não renovado — ver propostas",
          icon: Users,
          action: "/treinador",
          actionLabel: "Área do Treinador",
          priority: "high",
        })
      } else if (renovacao === "negociar") {
        tasks.push({
          id: 103,
          title: "Negociar renovação com a diretoria",
          icon: Users,
          action: "/treinador",
          actionLabel: "Negociar renovação",
          priority: "high",
        })
      }
      tasks.push({
        id: 100,
        title: renovacao === "ofertas" ? "Ignorar propostas e seguir com o clube" : "Iniciar a proxima temporada",
        icon: Trophy,
        action: PROXIMA_TEMPORADA,
        actionLabel: "Comecar temporada",
        priority: renovacao === "ofertas" || renovacao === "negociar" ? "medium" : "high",
      })
      tasks.push({
        id: 101,
        title: "Marcar amistosos da pre-temporada",
        icon: Users,
        action: "/amistosos",
        actionLabel: "Marcar amistosos",
        priority: "medium",
      })
    }

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
      getContractStatus(p, engineWeek, engineSeason) === "expiring" ||
      getContractStatus(p, engineWeek, engineSeason) === "expired"
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

    // ⚠️ O ESCRITORIO ERA SO DO TECNICO PROFISSIONAL (corrigido na 1.0.348).
    //
    // A lista acima nasceu para um clube masculino de Serie A e era servida
    // igual a todo mundo: quem dirige o Sub-20 recebia "Ofertas de
    // Transferencia" e "Marcar amistosos da pre-temporada" como se comandasse um
    // profissional, e quem faz carreira de ATLETA recebia tarefas de treinador —
    // gerir elenco, cuidar de contrato, abrir o mercado. Nenhuma delas e o
    // trabalho dele.
    //
    // Aqui a lista passa pela modalidade antes de ir para a tela. Ver
    // lib/tom-da-modalidade.
    return adaptarTarefasAModalidade(tasks, modalidade)
  }, [gameEngine.squadPlayers, gameEngine.transferOffers, gameEngine.currentWeek, nextUserMatch, userTeam, estadoSalvo.renewalStatus, modalidade])

  // A tarefa de virar a temporada nao e uma rota: precisa RODAR o avanco, que e
  // quem apura campeao, acesso/rebaixamento e monta o calendario novo.
  const abrirTarefa = useCallback(async (destino: string) => {
    if (destino !== PROXIMA_TEMPORADA) { hardNavigate(destino); return }
    await advanceWeek()
    hardNavigate("/")
  }, [advanceWeek])

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
        <div className="w-12 h-12 rounded-full border-2 border-[var(--brand)] border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="relative flex h-screen md:pl-0 pl-0 pb-20 md:pb-0 overflow-hidden">
      {/* Background base escura */}
      <div className="absolute inset-0 bg-[#050508]" />
      {/* Mesmos fundos do escritorio (/), com o crossfade suave — a pedido do usuario. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <Image src="/images/office-bg-1.webp" alt="" fill priority unoptimized className="office-bg-a object-cover" />
        <Image src="/images/office-bg-2.webp" alt="" fill unoptimized className="office-bg-b object-cover" />
      </div>
      {/* Em DIA DE FINAL o pre-office fica tematico (dourado de decisao). Fora
          disso NAO ha mais brilho radial: era mais uma camada por cima da arte. */}
      {faseDaPartida(nextUserMatch)?.isFinal && (
        <div className="absolute inset-0" style={{
          background: "radial-gradient(ellipse 95% 75% at 50% 15%, rgba(255,199,0,0.16) 0%, rgba(255,140,0,0.06) 38%, transparent 65%)"
        }} />
      )}
      {/* Moldura dourada sutil emoldurando a tela na final. */}
      {faseDaPartida(nextUserMatch)?.isFinal && (
        <div className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-[#ffd700]/25" />
      )}
      {/*
        VINHETA NO MINIMO (pedido). Eram QUATRO camadas empilhadas sobre a arte:
        preto a 78%, um gradiente lateral, um vertical e ainda um vignette radial
        de 55% nas bordas — o cenario quase nao aparecia, e cada camada e uma
        superficie a mais para o compositor desenhar a cada frame.
        Ficou uma so: o veu escuro que da contraste ao texto.
      */}
      <div className="absolute inset-0 bg-[#050508]/45" />


      <main className="relative z-10 flex-1 overflow-hidden flex flex-col">
        <GameHeader team={userTeam} />

        {/* ⚠️ NADA AQUI ROLA (pedido, com print).
            A tela era duas colunas que rolavam por dentro: a de tarefas cortava
            os botões "Voltar / Avançar" no meio, e o feed de notícias era um
            cartão do tamanho de meia tela com foto de estádio, empurrando tudo
            para baixo. Agora o escritório é uma coluna que CABE: cabeçalho,
            tarefas (todas visíveis), botões — e as notícias viraram uma BARRA no
            rodapé, que é onde a informação de uma linha pertence.

            `min-h-0` em toda a cadeia e nada de altura em `vh`: sob o zoom do
            jogo o `vh` mede a janela sem escala e deixa faixa morta no pé. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-5">
          <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-3">

            {/* Data atual do jogo */}
            <div className="shrink-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={gameDate.toISOString()}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
                    {dayOfWeek}, {month} {day}
                  </h1>
                </motion.div>
              </AnimatePresence>

              {/* Proximo evento */}
              <motion.div
                className="mt-1 flex items-center gap-4 text-white/70"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                {daysUntilMatch !== null ? (
                  <span className="text-base">
                    Proxima Partida em {daysUntilMatch} dia{daysUntilMatch !== 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="text-base text-white/40">Sem partidas agendadas</span>
                )}
              </motion.div>
            </div>

            {/* Preview da proxima partida */}
            <div className="flex shrink-0 flex-col items-center py-1">
              {nextUserMatch && nextOpponent ? (
                <div className="flex items-center gap-6">
                  <div className="flex flex-col items-center gap-1">
                    <TeamCrest team={userTeam} size="lg" />
                    <span className="text-xs text-white/50">Seu time</span>
                  </div>
                  <span className="text-2xl font-bold text-white">vs</span>
                  <div className="flex flex-col items-center gap-1">
                    <TeamCrest team={nextOpponent} size="lg" />
                    <span className="text-xs text-white/50">{siglaExibivel(nextOpponent.curto, nextOpponent.nome)}</span>
                  </div>
                  <div className="ml-4 text-right">
                    <div className="text-xs uppercase tracking-wider text-white/40">{nextUserMatch.competition}</div>
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
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                    <Calendar className="h-7 w-7 text-white/40" />
                  </div>
                  <span className="text-sm text-white/40">Nenhuma partida proxima</span>
                </div>
              )}
            </div>

            {/* ── LISTA DE TAREFAS: TODAS VISÍVEIS ─────────────────────────
                Ela ocupa o que sobra e os cartões dividem essa altura entre si.
                Com muitas tarefas eles ficam mais baixos — o que não acontece
                mais é a lista rolar por dentro e esconder o que falta fazer. */}
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <div className="flex shrink-0 items-center justify-between">
                {/* O escritorio diz de quem ele e: quem dirige o Sub-20 le
                    "o Sub-20", e quem faz carreira de atleta nao le "elenco". */}
                <h2 className="text-sm font-medium text-white/50">
                  Tarefas {tomDaCarreira.deQuem} ({realTasks.length})
                </h2>
                {saveState.week > 0 && (
                  <span className="text-xs text-white/30">Rodada {saveState.week}</span>
                )}
              </div>

              {/*
                VINHETA LOCAL DA LISTA DE TAREFAS.

                Os cartoes sao quase transparentes de proposito — a arte do
                escritorio precisa aparecer. Só que justamente ATRÁS desta lista o
                cenário tem as mesas e as cadeiras, que é a região de maior ruído
                da imagem. A vinheta é radial e termina em alfa 0: ela não desenha
                uma caixa em volta da lista.
              */}
              <div className="relative flex min-h-0 flex-1 flex-col">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -inset-x-4 -inset-y-3"
                  style={{
                    background:
                      "radial-gradient(115% 95% at 50% 50%, rgba(5,5,8,0.74) 0%, rgba(5,5,8,0.60) 52%, rgba(5,5,8,0.28) 80%, rgba(5,5,8,0) 100%)",
                  }}
                />

                <div className="relative flex min-h-0 flex-1 flex-col gap-2">
                  {realTasks.map((task, index) => {
                    const Icon = task.icon
                    const isSelected = index === selectedTask

                    return (
                      <motion.button
                        key={task.id}
                        onClick={() => {
                          setSelectedTask(index)
                          void abrirTarefa(task.action)
                        }}
                        className={cn(
                          "flex min-h-[52px] w-full flex-1 items-center gap-4 rounded-xl px-4 text-left transition-all",
                          "bg-gradient-to-r from-white/[0.03] to-transparent",
                          "border border-white/[0.06]",
                          isSelected && "border-white/20 bg-white/[0.06]",
                          "hover:border-white/15 hover:bg-white/[0.04]"
                        )}
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                          "bg-gradient-to-br from-white/10 to-white/5",
                          task.priority === "high" && "from-amber-500/20 to-amber-500/5"
                        )}>
                          <Icon className={cn(
                            "h-5 w-5",
                            task.priority === "high" ? "text-amber-400" : "text-white/60"
                          )} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="truncate font-medium text-white">{task.title}</h3>
                          <div className="mt-0.5 flex items-center gap-2 text-sm text-white/40">
                            <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs">A</span>
                            <span className="truncate">{task.actionLabel}</span>
                          </div>
                        </div>

                        <ChevronRight className="h-5 w-5 shrink-0 text-white/20" />
                      </motion.button>
                    )
                  })}
                </div>
              </div>

              {/* Botoes */}
              <div className="flex shrink-0 items-center gap-3 pt-1">
                <Button
                  variant="outline"
                  className="flex-1 border-white/10 bg-white/5 text-white hover:bg-white/10"
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

          {/* ── AS NOTÍCIAS VIRARAM UMA BARRA (pedido, com print) ───────────
              Era um cartão com foto de estádio de meia tela para mostrar UMA
              frase. A barra diz a mesma coisa numa linha — fonte, quando, e a
              manchete — com as setas para percorrer o feed e o contador de
              curtidas/comentários no fim.

              Os comentários não sumiram: eles abrem ACIMA da barra, num painel
              curto que rola por dentro. É o único lugar da tela que rola, e só
              quando alguém pede. */}
          {currentNews && (
            <div className="mx-auto mt-3 w-full max-w-5xl shrink-0">
              {commentsOpen && (
                <div className="mb-2 rounded-xl border border-white/[0.06] bg-black/70 p-3">
                  <div className="max-h-32 space-y-1.5 overflow-y-auto pr-1 scrollbar-thin">
                    {visibleComments.map((c, i) => (
                      <div key={i} className="flex items-start gap-2 text-[13px]">
                        <span className="shrink-0 font-semibold text-white/70">{c.author}:</span>
                        <span className="text-white/60">{c.text}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      value={commentDraft}
                      onChange={(e) => setCommentDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") postComment() }}
                      placeholder="Escreva um comentario..."
                      className="h-8 border-white/10 bg-white/5 text-sm text-white"
                    />
                    <Button size="sm" onClick={postComment} disabled={!commentDraft.trim()}>
                      Enviar
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-black/70 px-3 py-2 backdrop-blur-sm">
                <Newspaper className="h-4 w-4 shrink-0 text-white/40" />
                <button
                  onClick={() => setCurrentNewsIndex(prev => (prev - 1 + news.length) % news.length)}
                  aria-label="Noticia anterior"
                  className="shrink-0 rounded-lg p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentNewsIndex}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="flex min-w-0 flex-1 items-center gap-2"
                  >
                    <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-[var(--brand)]">
                      {NEWS_SOURCES[currentNews.source].name}
                    </span>
                    <span className="shrink-0 text-[11px] text-white/30">{currentNews.date}</span>
                    {currentNews.isNew && (
                      <span className="shrink-0 rounded bg-[#c8ff00] px-1.5 text-[10px] font-black text-black">New</span>
                    )}
                    <span className="truncate text-sm text-white/80">
                      {currentNews.title}{currentNews.description ? ` — ${currentNews.description}` : ""}
                    </span>
                  </motion.div>
                </AnimatePresence>

                <button
                  onClick={() => setCurrentNewsIndex(prev => (prev + 1) % news.length)}
                  aria-label="Proxima noticia"
                  className="shrink-0 rounded-lg p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>

                <button
                  onClick={() => toggleLikeNews(currentNews.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-1 text-xs transition-colors",
                    likedNews.has(currentNews.id) ? "text-red-400" : "text-white/45 hover:text-red-400"
                  )}
                >
                  <Heart className={cn("h-3.5 w-3.5", likedNews.has(currentNews.id) && "fill-red-400")} />
                  {formatNewsCount(currentNews.likes + (likedNews.has(currentNews.id) ? 1 : 0))}
                </button>
                <button
                  onClick={() => setCommentsOpen(v => !v)}
                  className={cn(
                    "flex shrink-0 items-center gap-1 text-xs transition-colors",
                    commentsOpen ? "text-[var(--brand)]" : "text-white/45 hover:text-[var(--brand)]"
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  {formatNewsCount(currentNews.comments + (extraComments[currentNews.id]?.length ?? 0))}
                </button>
                <span className="hidden shrink-0 items-center gap-1 text-[10px] text-white/25 md:flex">
                  {currentNewsIndex + 1}/{news.length}
                </span>
              </div>
            </div>
          )}
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

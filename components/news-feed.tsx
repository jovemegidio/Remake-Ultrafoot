"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight, Heart, MessageCircle, Share2, Bookmark, TrendingUp, Trophy, Users, DollarSign, Sparkles, Zap, Star, AlertCircle } from "lucide-react"
import { getNewsImageUrl, seedFromString } from "@/lib/news-image"
import { buscarNoticiasReais, type RealNewsItem } from "@/lib/real-news"
import { getCountryCompetitions } from "@/lib/country-competitions"
import { getLeagueName } from "@/lib/use-game-manager"
import { motion, AnimatePresence } from "framer-motion"
import { TeamCrest } from "@/components/team-crest"
import { allTeams, serieATeams, getTeamByShort, formatCurrency, type Team } from "@/lib/teams-data"
import { useGameState } from "@/lib/save-system"
import { useGameEngine, isTransferWindowOpen, type MatchResult, type StandingsEntry, type TopScorer } from "@/lib/game-engine"
import { cn } from "@/lib/utils"

export const NEWS_SOURCES = {
  ge: {
    name: "ge",
    logo: "/logos/ge.jpg",
    color: "#00A859",
    bgColor: "bg-[#00A859]",
  },
  espn: {
    name: "ESPN Brasil",
    logo: "/logos/espn.jpg",
    color: "#E60000",
    bgColor: "bg-[#E60000]",
  },
  brasileirao: {
    name: "Brasileirao",
    logo: "/logos/brasileirao.png",
    color: "#BFFF00",
    bgColor: "bg-[#BFFF00]",
  },
  league: {
    name: "Liga",
    logo: "/brand/uf26-logo.png",
    color: "#00ffc8",
    bgColor: "bg-[var(--brand)]",
  },
  cazeTv: {
    name: "CazeTV",
    logo: "/logos/cazetv.png",
    color: "#0066FF",
    bgColor: "bg-[#0066FF]",
  },
  tntSports: {
    name: "TNT Sports",
    logo: "/logos/tnt-sports.png",
    color: "#FF00FF",
    bgColor: "bg-[#FF00FF]",
  },
}

export interface NewsItem {
  id: string
  source: keyof typeof NEWS_SOURCES
  date: string
  type: "match_preview" | "match_result" | "transfer" | "highlight" | "announcement" | "ranking" | "injury" | "standings"
  title: string
  description?: string
  image?: string
  matches?: Array<{ home: Team; away: Team }>
  likes: number
  comments: number
  isNew?: boolean
  icon?: React.ReactNode
  /** Manchete REAL vinda da internet (ver lib/real-news), nao gerada pelo jogo. */
  isReal?: boolean
  /** Link da materia original — so nas reais. */
  link?: string
  /** Foto REAL publicada pelo feed da materia. Quando ausente, cai na capa local. */
  imagem?: string
  /** Card patrocinado — nao e noticia, e publicidade. */
  isAd?: boolean
}

// CARD PATROCINADO do carrossel. Fica na 2a posicao (depois das manchetes
// reais) para nao ser a primeira coisa que o jogador ve ao abrir a tela.
//
// A imagem usa a MESMA fonte das capas locais das materias, entao o anuncio
// nao destoa visualmente nem depende de rede para renderizar. Para trocar a
// campanha, basta editar este objeto — ou, quando houver campanha remota,
// alimentar `imagem`/`link` pelo launcher-config.json, que ja e baixado.
const AD_CARD: NewsItem = {
  id: "ad-ultrafoot",
  source: "espn" as keyof typeof NEWS_SOURCES,
  date: "",
  type: "announcement",
  title: "Garagem Comics",
  description: "Quadrinhos, colecionaveis e cultura pop.",
  likes: 0,
  comments: 0,
  isAd: true,
  // Arte da campanha empacotada no jogo (public/ads). Nao depende de rede: o
  // anuncio renderiza igual offline, ao contrario das capas remotas do RSS.
  imagem: "/ads/garagem-comics.png",
}

/**
 * Intercala publicidade no carrossel: 1 noticia, 1 anuncio, 1 noticia...
 *
 * Cada insercao recebe um `id` PROPRIO. Reusar o mesmo id em varias posicoes
 * daria chaves duplicadas no React, que passa a reciclar o card errado ao
 * navegar o carrossel. O criativo e o mesmo; so a identidade da instancia muda.
 */
function intercalarAnuncios(noticias: NewsItem[]): NewsItem[] {
  const saida: NewsItem[] = []
  noticias.forEach((noticia, i) => {
    saida.push(noticia)
    saida.push({ ...AD_CARD, id: `${AD_CARD.id}-${i}` })
  })
  return saida
}

export function generateDynamicNews(
  userTeamShort: string | null,
  season: number,
  week: number,
  matchResults: MatchResult[],
  standings: StandingsEntry[],
  topScorers: TopScorer[]
): NewsItem[] {
  const userTeam = userTeamShort ? getTeamByShort(userTeamShort) : null
  const leaguePool = userTeam
    ? allTeams.filter(team => team.divisao === userTeam.divisao && team.pais === userTeam.pais)
    : []
  const teams = leaguePool.length >= 8 ? leaguePool : userTeam
    ? allTeams.filter(team => team.pais === userTeam.pais)
    : serieATeams
  const randomTeam = () => teams[Math.floor(Math.random() * teams.length)]
  const randomPlayer = () => {
    const names = [
      "Gabriel Silva", "Lucas Oliveira", "Matheus Santos", "Pedro Henrique",
      "Gustavo Ferreira", "Rafael Costa", "Bruno Almeida", "Vinicius Lima",
      "Felipe Souza", "Arthur Pereira", "Caio Ribeiro", "Diego Martins",
      "Ronaldo Jr", "Neymar Filho", "Carlos Eduardo", "Thiago Maia"
    ]
    return names[Math.floor(Math.random() * names.length)]
  }

  const news: NewsItem[] = []
  // Nome da liga do clube: um time europeu nao pode ver noticia do "Brasileirao".
  // Travessao no lugar de "do/da" evita problema de genero entre ligas
  // ("Premier League" vs "Serie A").
  const leagueName = userTeamShort ? getLeagueName(userTeamShort) : "a liga"
  const leagueHasStarted = standings.some(entry => (entry.played ?? 0) > 0)

  // === NOTÍCIA 1: Resultado recente do time do usuário ===
  const userResults = matchResults
    .filter(r => r.homeTeam === userTeamShort || r.awayTeam === userTeamShort)
    .slice(-3)
    .reverse()

  if (userResults.length > 0 && userTeam) {
    const last = userResults[0]
    const isHome = last.homeTeam === userTeamShort
    const myScore = isHome ? last.homeScore : last.awayScore
    const oppScore = isHome ? last.awayScore : last.homeScore
    const oppShort = isHome ? last.awayTeam : last.homeTeam
    const oppTeam = getTeamByShort(oppShort)
    const oppName = oppTeam?.nome ?? oppShort

    const result = myScore > oppScore ? "venceu" : myScore < oppScore ? "perdeu" : "empatou"
    const resultLabel = myScore > oppScore ? "VITORIA" : myScore < oppScore ? "DERROTA" : "EMPATE"
    const resultEmphasis = myScore > oppScore
      ? `${userTeam.nome} goleia em grande estilo!`
      : myScore < oppScore
      ? `Derrota deixa torcida preocupada`
      : `Ponto valioso fora de casa`

    news.push({
      id: `result-${last.week}-${last.season}`,
      source: "espn",
      date: `Rod. ${last.week}`,
      type: "match_result",
      title: `${userTeam.nome} ${result} o ${oppName} por ${myScore}-${oppScore}`,
      description: resultEmphasis,
      isNew: true,
      icon: myScore > oppScore ? <Trophy className="h-5 w-5 text-yellow-400" /> : <AlertCircle className="h-5 w-5 text-red-400" />,
      likes: Math.floor(Math.random() * 40000 + 15000),
      comments: Math.floor(Math.random() * 4000 + 800),
    })
  }

  // === NOTÍCIA 2: Outros resultados recentes (destaques da rodada) ===
  const otherResults = matchResults
    .filter(r => r.homeTeam !== userTeamShort && r.awayTeam !== userTeamShort)
    .slice(-6)
  const bigGame = otherResults.find(r => r.homeScore + r.awayScore >= 4) ?? otherResults[0]

  if (bigGame) {
    const homeTeam = getTeamByShort(bigGame.homeTeam)
    const awayTeam = getTeamByShort(bigGame.awayTeam)
    if (homeTeam && awayTeam) {
      const totalGols = bigGame.homeScore + bigGame.awayScore
      news.push({
        id: `bigresult-${bigGame.week}-${bigGame.homeTeam}`,
        source: "ge",
        date: `Rod. ${bigGame.week}`,
        type: "match_result",
        title: `${homeTeam.nome} ${bigGame.homeScore}x${bigGame.awayScore} ${awayTeam.nome}`,
        description: totalGols >= 5
          ? `Goleada historica na rodada ${bigGame.week}!`
          : totalGols >= 4
          ? `Jogo eletrizante com ${totalGols} gols`
          : `Resultado define nova configuracao da tabela`,
        icon: <Zap className="h-5 w-5 text-yellow-400" />,
        likes: Math.floor(Math.random() * 55000 + 20000),
        comments: Math.floor(Math.random() * 6000 + 1500),
      })
    }
  }

  // === NOTÍCIA 3: Artilharia atualizada ===
  if (leagueHasStarted && topScorers.length > 0) {
    const leader = topScorers[0]
    const leaderTeam = getTeamByShort(leader.teamShort)
    news.push({
      id: `artilharia-${season}-${week}`,
      source: "league",
      date: "Agora",
      type: "ranking",
      title: `${leader.playerName} lidera artilharia com ${leader.goals} gols`,
      description: `${leaderTeam?.nome ?? leader.teamShort} tem o melhor atacante do campeonato na temporada ${season}`,
      isNew: week > 0,
      icon: <TrendingUp className="h-5 w-5 text-purple-400" />,
      likes: Math.floor(Math.random() * 45000 + 20000),
      comments: Math.floor(Math.random() * 5000 + 1500),
    })
  }

  // === NOTÍCIA 4: Posição na tabela do time do usuário ===
  if (leagueHasStarted && standings.length > 0 && userTeamShort && userTeam) {
    const pos = standings.findIndex(s => s.teamShort === userTeamShort)
    if (pos >= 0) {
      const entry = standings[pos]
      const position = pos + 1
      // As zonas seguem a CONTINENTAL do clube. Antes diziam sempre
      // "zona de Libertadores"/"Sul-Americana" — errado para um clube europeu,
      // que briga por Champions / Europa League.
      const comps = getCountryCompetitions(userTeam.divisao)
      const zoneLabel =
        position <= 4 ? `zona de ${comps.continental}` :
        position <= 6 && comps.continentalSecondary ? `zona de ${comps.continentalSecondary}` :
        position >= standings.length - 3 ? "zona de rebaixamento" :
        "parte do meio da tabela"

      const leader = standings[0]
      const leaderTeam = getTeamByShort(leader.teamShort)
      const diff = leader.points - entry.points

      news.push({
        id: `standings-${season}-${week}-${userTeamShort}`,
        source: "ge",
        date: `${week}ª rod.`,
        type: "standings",
        title: `${userTeam.nome} ocupa a ${position}ª posicao`,
        description: position === 1
          ? `Lider isolado com ${entry.points} pts! Vantagem sobre o segundo`
          : `${diff} ponto${diff !== 1 ? "s" : ""} do lider ${leaderTeam?.nome ?? ""}. ${entry.won}V ${entry.drawn}E ${entry.lost}D`,
        icon: position <= 4 ? <Trophy className="h-5 w-5 text-yellow-400" /> : <Star className="h-5 w-5 text-white/60" />,
        likes: Math.floor(Math.random() * 30000 + 10000),
        comments: Math.floor(Math.random() * 3000 + 500),
      })
    }
  }

  // === NOTÍCIA 5: Próximos jogos (rodada) ===
  const shuffled = [...teams].sort(() => Math.random() - 0.5)
  const nextMatches: Array<{ home: Team; away: Team }> = []
  for (let i = 0; i < Math.min(4, shuffled.length - 1); i += 2) {
    nextMatches.push({ home: shuffled[i], away: shuffled[i + 1] })
  }
  if (leagueHasStarted) news.push({
    id: `matches-${season}-${week}`,
    source: "league",
    date: "Agora",
    type: "match_preview",
    title: "PROXIMOS JOGOS",
    description: `Rodada ${week + 1} — ${leagueName} ${season}`,
    matches: nextMatches,
    likes: Math.floor(Math.random() * 50000 + 30000),
    comments: Math.floor(Math.random() * 5000 + 2000),
    isNew: true,
  })

  // === NOTÍCIA 6: Destaque do time do usuário ===
  if (userTeam) {
    const headlines = [
      `${userTeam.nome}: Comissao tecnica projeta temporada forte`,
      `${userTeam.nome} aquece para rodada decisiva`,
      `Torcida do ${userTeam.nome} lota treino aberto`,
      `Treino do ${userTeam.nome} ganha intensidade antes do proximo compromisso`,
    ]
    news.push({
      id: `user-highlight-${season}-${week}`,
      source: "espn",
      date: "4h",
      type: "highlight",
      title: headlines[week % headlines.length],
      description: `Temporada ${season}: expectativa alta no clube`,
      icon: <Trophy className="h-5 w-5 text-blue-400" />,
      likes: Math.floor(Math.random() * 25000 + 15000),
      comments: Math.floor(Math.random() * 2000 + 800),
    })
  }

  // === NOTÍCIA 7: Transferência ===
  const transferHeadlines = [
    () => `${randomTeam().nome} anuncia contratacao de ${randomPlayer()}`,
    () => `${randomPlayer()} rescinde com ${randomTeam().nome} e ja tem novo clube`,
    () => `Proposta milionaria: ${randomTeam().nome} mira jogador europeu`,
  ]
  const headline = transferHeadlines[Math.floor(Math.random() * transferHeadlines.length)]
  if (isTransferWindowOpen(week)) news.push({
    id: `transfer-${season}-${week}-${Math.floor(Math.random() * 1000)}`,
    source: "ge",
    date: "2h",
    type: "transfer",
    title: headline(),
    description: `Janela de transferencias agita o mercado nacional`,
    icon: <DollarSign className="h-5 w-5 text-yellow-400" />,
    likes: Math.floor(Math.random() * 30000 + 10000),
    comments: Math.floor(Math.random() * 3000 + 500),
  })

  // Lesoes nao sao inventadas: o feed de campanha recebe eventos reais do motor.

  // === NOTÍCIA 9: Mercado agitado (CazeTV) ===
  const cazeTvHeadlines = [
    "Clubes da Serie A movimentam mercado antes do fechamento da janela",
    `Semana de decisoes: ${Math.floor(Math.random() * 4 + 2)} transferencias confirmadas`,
    "Agente revela bastidores de negociacao bilionaria",
  ]
  if (isTransferWindowOpen(week)) news.push({
    id: `market-${season}-${week}`,
    source: "cazeTv",
    date: "12h",
    type: "transfer",
    title: cazeTvHeadlines[week % cazeTvHeadlines.length],
    description: "Bastidores esquentam com propostas milionarias entre clubes",
    icon: <DollarSign className="h-5 w-5 text-blue-400" />,
    likes: Math.floor(Math.random() * 35000 + 15000),
    comments: Math.floor(Math.random() * 3500 + 1000),
  })

  // A materia em destaque (indice 0) deve ser sempre uma noticia com imagem,
  // como nas telas de referencia. Os "proximos jogos" (globo) vao para o fim.
  news.sort((a, b) => {
    const aPreview = a.type === "match_preview" ? 1 : 0
    const bPreview = b.type === "match_preview" ? 1 : 0
    return aPreview - bPreview
  })

  return news
}

interface NewsFeedProps {
  className?: string
  compact?: boolean
}

export function NewsFeed({ className, compact = false }: NewsFeedProps) {
  const { state } = useGameState()
  const engine = useGameEngine()
  const userTeamShort = state.selectedTeamShort ?? null

  const [news, setNews] = useState<NewsItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)
  const [isClient, setIsClient] = useState(false)
  const [likedItems, setLikedItems] = useState<Set<string>>(new Set())
  const [bookmarkedItems, setBookmarkedItems] = useState<Set<string>>(new Set())

  const toggleLike = (id: string) => {
    setLikedItems(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleBookmark = (id: string) => {
    setBookmarkedItems(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  useEffect(() => {
    setIsClient(true)
    const inGame = generateDynamicNews(
      userTeamShort,
      state.season,
      state.week,
      engine.matchResults ?? [],
      engine.serieAStandings ?? [],
      engine.topScorers ?? []
    )
    // OFFLINE: so a noticia gerada (a da propria carreira). ONLINE: as manchetes
    // REAIS entram na frente, para o jogador acompanhar o futebol de verdade
    // sem sair do jogo — e a noticia da carreira continua logo atras.
    // O anuncio entra JA no estado inicial, nao so quando as manchetes reais
    // chegam. Antes ele so era inserido dentro do .then() do buscarNoticiasReais:
    // sem rede — ou com o feed devolvendo vazio — aquele bloco nunca rodava e a
    // publicidade simplesmente nao aparecia offline. A arte e local
    // (public/ads), entao o card renderiza igual nos dois casos.
    setNews(intercalarAnuncios(inGame))
    let vivo = true
    buscarNoticiasReais()
      .then((reais: RealNewsItem[]) => {
        if (!vivo || reais.length === 0) return
        const comoNoticia: NewsItem[] = reais.slice(0, 6).map((r: RealNewsItem, i: number) => ({
          id: `real-${i}`,
          source: "espn" as keyof typeof NEWS_SOURCES,
          date: new Date(r.publicadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
          type: "highlight" as const,
          title: r.titulo,
          description: `${r.fonte} · notícia real`,
          likes: 0,
          comments: 0,
          isNew: true,
          isReal: true,
          link: r.link,
          imagem: r.imagem,
        }))
        setNews(intercalarAnuncios([...comoNoticia, ...inGame]))
      })
      .catch(() => { /* sem rede: fica so a noticia in-game */ })
    return () => { vivo = false }
  }, [userTeamShort, state.season, state.week, engine.matchResults, engine.serieAStandings, engine.topScorers])

  const nextNews = useCallback(() => {
    setDirection(1)
    setCurrentIndex((i) => (i + 1) % news.length)
  }, [news.length])

  const prevNews = useCallback(() => {
    setDirection(-1)
    setCurrentIndex((i) => (i - 1 + news.length) % news.length)
  }, [news.length])

  useEffect(() => {
    if (!isAutoPlaying) return
    const interval = setInterval(nextNews, 6000)
    return () => clearInterval(interval)
  }, [isAutoPlaying, nextNews])

  const currentNews = news[currentIndex]

  if (!isClient || news.length === 0 || !currentNews) {
    return (
      <div className={cn("rounded-2xl bg-[#0c0c10] border border-white/[0.04] animate-pulse", className)}>
        <div className="h-64 flex items-center justify-center">
          <div className="text-white/30 text-sm">Carregando noticias...</div>
        </div>
      </div>
    )
  }

  const source = NEWS_SOURCES[currentNews.source]

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0, scale: 0.95 }),
    center: { zIndex: 1, x: 0, opacity: 1, scale: 1 },
    exit: (dir: number) => ({ zIndex: 0, x: dir < 0 ? 300 : -300, opacity: 0, scale: 0.95 }),
  }

  if (compact) {
    return (
      <div className={cn("space-y-3", className)}>
        {news.slice(0, 3).map((item) => (
          <NewsItemCompact key={item.id} news={item} />
        ))}
      </div>
    )
  }

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={prevNews}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-8 h-8 rounded-full bg-black/80 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-black transition-colors"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={nextNews}
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-8 h-8 rounded-full bg-black/80 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-black transition-colors"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <div
        className="rounded-2xl overflow-hidden bg-[#0c0c10] border border-white/[0.04]"
        onMouseEnter={() => setIsAutoPlaying(false)}
        onMouseLeave={() => setIsAutoPlaying(true)}
      >
        {/* Header — oculto no anuncio: fonte, selo verificado e data sao do
            jornalismo. Exibi-los numa peca paga dava a ela cara de materia. */}
        <div className={cn(
          "flex items-center justify-between px-4 py-3 border-b border-white/[0.04]",
          currentNews.isAd && "hidden",
        )}>
          <div className="flex items-center gap-3">
            <SourceLogo source={currentNews.source} size="md" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm text-white">{source.name}</span>
                <VerifiedBadge />
              </div>
              <span className="text-xs text-white/40">{currentNews.date}</span>
            </div>
          </div>
          {currentNews.isNew && (
            <span className="px-2.5 py-1 rounded-full bg-yellow-400 text-black text-[10px] font-bold tracking-wider">
              New
            </span>
          )}
        </div>

        {/* Content */}
        <div className="relative overflow-hidden">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 },
                scale: { duration: 0.2 },
              }}
            >
              {currentNews.type === "match_preview" && currentNews.matches ? (
                <MatchPreviewCard
                  matches={currentNews.matches}
                  title={currentNews.title}
                  description={currentNews.description}
                  season={state.season}
                />
              ) : (
                <NewsContentCard news={currentNews} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.04]">
          <div className="flex items-center gap-6">
            <button
              onClick={() => toggleLike(currentNews.id)}
              className={cn(
                "flex items-center gap-1.5 transition-colors",
                likedItems.has(currentNews.id) ? "text-red-400" : "text-white/50 hover:text-red-400"
              )}
            >
              <Heart className={cn("h-4 w-4 transition-all", likedItems.has(currentNews.id) && "fill-red-400")} />
              <span className="text-xs">
                {formatEngagement(currentNews.likes + (likedItems.has(currentNews.id) ? 1 : 0))}
              </span>
            </button>
            <button className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors">
              <MessageCircle className="h-4 w-4" />
              <span className="text-xs">{formatEngagement(currentNews.comments)}</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button className="text-white/50 hover:text-white transition-colors">
              <Share2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => toggleBookmark(currentNews.id)}
              className={cn(
                "transition-colors",
                bookmarkedItems.has(currentNews.id) ? "text-[#1db954]" : "text-white/50 hover:text-white"
              )}
            >
              <Bookmark className={cn("h-4 w-4 transition-all", bookmarkedItems.has(currentNews.id) && "fill-[#1db954]")} />
            </button>
          </div>
        </div>
      </div>

      {/* Dots */}
      <div className="flex items-center justify-center gap-1.5 mt-3">
        {news.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            className={cn(
              "rounded-full transition-all",
              i === currentIndex
                ? "w-5 h-1.5 bg-[var(--brand)]"
                : "w-1.5 h-1.5 bg-white/20 hover:bg-white/40"
            )}
          />
        ))}
      </div>
    </div>
  )
}

function SourceLogo({ source, size = "md" }: { source: keyof typeof NEWS_SOURCES; size?: "sm" | "md" }) {
  const sourceData = NEWS_SOURCES[source]
  const [failed, setFailed] = useState(false)
  const sizeClass = size === "sm" ? "w-8 h-8" : "w-10 h-10"
  const textSize = size === "sm" ? "text-[9px]" : "text-[10px]"
  const initials = sourceData.name.split(" ").map(w => w[0]).join("").slice(0, 3)

  // As iniciais so aparecem se a logo falhar. Antes o span ficava SEMPRE renderizado
  // por cima da imagem (ambos absolute), sujando a logo do canal; e o padding + cor de
  // fundo deixavam a logo pequena com uma borda colorida em volta.
  if (failed) {
    return (
      <div
        className={cn(sizeClass, "rounded-full flex items-center justify-center shrink-0")}
        style={{ backgroundColor: sourceData.color }}
      >
        <span className={cn(textSize, "font-bold text-white leading-none select-none")}>{initials}</span>
      </div>
    )
  }

  return (
    <div className={cn(sizeClass, "rounded-full overflow-hidden relative shrink-0 bg-white")}>
      <Image
        src={sourceData.logo}
        alt={sourceData.name}
        fill
        className="object-cover"
        sizes={size === "sm" ? "32px" : "40px"}
        onError={() => setFailed(true)}
        unoptimized
      />
    </div>
  )
}

function VerifiedBadge() {
  return (
    <svg className="w-4 h-4 text-[#1da1f2]" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z"/>
    </svg>
  )
}

function MatchPreviewCard({
  matches,
  title,
  description,
  season,
}: {
  matches: Array<{ home: Team; away: Team }>
  title: string
  description?: string
  season: number
}) {
  return (
    <div className="relative aspect-[4/3] bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#081020] overflow-hidden">
      <div className="absolute inset-0 opacity-40">
        <svg viewBox="0 0 400 300" className="w-full h-full">
          <path
            d="M180,25 Q240,20 280,35 Q320,50 350,90 Q370,130 365,170 Q360,210 340,240 Q310,270 270,280 Q230,290 190,285 Q150,280 120,260 Q90,240 70,200 Q50,160 55,120 Q60,80 90,55 Q120,30 180,25"
            fill="none"
            stroke="url(#brazilGradient)"
            strokeWidth="2"
          />
          <defs>
            <linearGradient id="brazilGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00875A" stopOpacity="0.6"/>
              <stop offset="50%" stopColor="#FFDF00" stopOpacity="0.4"/>
              <stop offset="100%" stopColor="#00875A" stopOpacity="0.6"/>
            </linearGradient>
          </defs>
          <g stroke="white" strokeWidth="0.3" opacity="0.1">
            {[0,1,2,3,4,5,6].map(i => <line key={`h${i}`} x1="0" y1={i*50} x2="400" y2={i*50} />)}
            {[0,1,2,3,4,5,6,7,8].map(i => <line key={`v${i}`} x1={i*50} y1="0" x2={i*50} y2="300" />)}
          </g>
          <g fill="#00ffc8">
            <circle cx="280" cy="100" r="3" opacity="0.6"/>
            <circle cx="300" cy="150" r="3" opacity="0.6"/>
            <circle cx="270" cy="200" r="3" opacity="0.6"/>
            <circle cx="200" cy="180" r="3" opacity="0.6"/>
            <circle cx="150" cy="140" r="3" opacity="0.6"/>
          </g>
        </svg>
      </div>
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white tracking-wide drop-shadow-lg">{title}</h3>
          {description && <p className="text-xs text-white/60 mt-0.5">{description}</p>}
        </div>
        <div className="px-3 py-1 rounded-full bg-[#00875A]/20 border border-[#00875A]/30">
          <span className="text-[#00875A] text-xs font-bold">{season}</span>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 top-16 flex items-center justify-center px-6">
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          {matches.map((match, i) => (
            <div key={i} className="flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/10">
              <TeamCrest team={match.home} size="sm" className="drop-shadow-lg" />
              <span className="text-[10px] text-white/50 font-medium px-1">vs</span>
              <TeamCrest team={match.away} size="sm" className="drop-shadow-lg" />
            </div>
          ))}
        </div>
      </div>
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 300">
        <defs>
          <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00ffc8" stopOpacity="0"/>
            <stop offset="50%" stopColor="#00ffc8" stopOpacity="0.5"/>
            <stop offset="100%" stopColor="#00ffc8" stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d="M60,150 Q200,80 340,150" fill="none" stroke="url(#routeGradient)" strokeWidth="1.5" strokeDasharray="6,4"/>
        <path d="M80,200 Q200,130 320,200" fill="none" stroke="url(#routeGradient)" strokeWidth="1.5" strokeDasharray="6,4"/>
      </svg>
    </div>
  )
}

const NEWS_TYPE_TO_IMAGE_CATEGORY: Record<string, string> = {
  transfer: "transfer",
  injury: "injury",
  highlight: "highlight",
  ranking: "highlight",
  announcement: "announcement",
  match_preview: "match",
  match_result: "match",
  standings: "highlight",
}

function NewsContentCard({ news }: { news: NewsItem }) {
  const source = NEWS_SOURCES[news.source]

  const imageCategory = NEWS_TYPE_TO_IMAGE_CATEGORY[news.type] ?? "match"
  const seed = seedFromString(news.id)
  // Capa da materia: a FOTO REAL publicada pelo feed tem prioridade; sem ela
  // (o Google Noticias quase nunca manda), cai na capa local por categoria. O
  // onError abaixo tambem devolve para a local se a remota falhar em carregar.
  const capaLocal = getNewsImageUrl(imageCategory, seed)
  const aiImageUrl = news.imagem ?? capaLocal

  const [imgError, setImgError] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  const typeColors: Record<string, string> = {
    transfer: "from-yellow-900/50 to-yellow-950/30",
    highlight: "from-blue-900/50 to-blue-950/30",
    ranking: "from-purple-900/50 to-purple-950/30",
    injury: "from-red-900/50 to-red-950/30",
    announcement: "from-green-900/50 to-green-950/30",
    match_result: "from-emerald-900/50 to-emerald-950/30",
    standings: "from-indigo-900/50 to-indigo-950/30",
  }

  const typeIcons: Record<string, React.ReactNode> = {
    transfer: <DollarSign className="h-6 w-6 text-yellow-400" />,
    highlight: <Trophy className="h-6 w-6 text-blue-400" />,
    ranking: <TrendingUp className="h-6 w-6 text-purple-400" />,
    injury: <Users className="h-6 w-6 text-red-400" />,
    announcement: <Trophy className="h-6 w-6 text-green-400" />,
    match_result: <Zap className="h-6 w-6 text-yellow-400" />,
    standings: <Star className="h-6 w-6 text-indigo-400" />,
  }

  const typeLabels: Record<string, string> = {
    transfer: "Mercado",
    highlight: "Destaque",
    ranking: "Ranking",
    injury: "Lesao",
    announcement: "Noticia",
    match_result: "Resultado",
    standings: "Tabela",
  }

  return (
    <div className={cn(
      "relative aspect-video bg-gradient-to-br overflow-hidden",
      typeColors[news.type] || "from-gray-900/50 to-gray-950/30"
    )}>
      <div className="absolute inset-0">
        {!imgLoaded && !imgError && (
          <div
            className="absolute inset-0 opacity-90 animate-pulse"
            style={{ background: `linear-gradient(135deg, ${source.color}33 0%, rgba(0,255,200,0.16) 42%, rgba(255,255,255,0.06) 100%)` }}
          />
        )}
        {imgError && (
          <div className="absolute inset-0">
            <div className="absolute inset-0 opacity-90" style={{ background: `linear-gradient(135deg, ${source.color}33 0%, rgba(0,255,200,0.16) 42%, rgba(255,255,255,0.06) 100%)` }} />
            <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.08)_0_1px,transparent_1px_18px)] opacity-40" />
            <div className="absolute right-4 top-4 flex h-20 w-20 items-center justify-center rounded-full bg-black/25 text-white/70">
              {news.icon || typeIcons[news.type]}
            </div>
          </div>
        )}
        {aiImageUrl && (
          <img
            src={aiImageUrl}
            alt=""
            aria-hidden="true"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            className={`absolute inset-0 w-full h-full transition-opacity duration-700 ${news.isAd ? "object-contain bg-black" : "object-cover"} ${imgLoaded ? "opacity-100" : "opacity-0"}`}
          />
        )}
        {!news.isAd && <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />}
        {imgLoaded && aiImageUrl && (
          <div className="absolute top-2 right-2 px-2 py-1 rounded bg-primary/20 border border-primary/30 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="text-[10px] text-primary font-medium">AI</span>
          </div>
        )}
      </div>

      {/* Icone de TIPO da noticia — nao existe "tipo" numa peca publicitaria. */}
      {!news.isAd && (
        <div className="absolute top-4 left-4 w-12 h-12 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
          {news.icon || typeIcons[news.type]}
        </div>
      )}

      <div className={cn(
        "absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent",
        // A arte do anuncio ja traz titulo, contato e identidade. Sobrepor
        // etiqueta e texto do feed em cima dela tapava justamente o conteudo.
        news.isAd && "hidden",
      )}>
        <div className="flex items-center gap-2 mb-2">
          {/* Publicidade e sinalizada SEMPRE. Um anuncio disfarcado de materia
              engana o jogador e some com a confianca no resto do feed. */}
          {news.isAd ? (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-400/20 text-amber-300 ring-1 ring-amber-300/40">
              Patrocinado
            </span>
          ) : (
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
              style={{ backgroundColor: source.color + "20", color: source.color }}
            >
              {typeLabels[news.type] ?? "Noticia"}
            </span>
          )}
        </div>
        <h3 className="text-lg font-bold text-white mb-1 line-clamp-2">{news.title}</h3>
        {news.description && (
          <p className="text-sm text-white/70 line-clamp-2">{news.description}</p>
        )}
      </div>
    </div>
  )
}

function NewsItemCompact({ news }: { news: NewsItem }) {
  const source = NEWS_SOURCES[news.source]
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-white/10 transition-colors cursor-pointer">
      <SourceLogo source={news.source} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs font-medium text-white/60">{source.name}</span>
          <span className="text-[10px] text-white/30">{news.date}</span>
          {news.isNew && (
            <span className="px-1.5 py-0.5 rounded bg-yellow-400/20 text-yellow-400 text-[9px] font-bold">New</span>
          )}
        </div>
        <p className="text-sm text-white line-clamp-2">{news.title}</p>
        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-white/30">
          <span>{formatEngagement(news.likes)} likes</span>
          <span>{formatEngagement(news.comments)} comentarios</span>
        </div>
      </div>
    </div>
  )
}

function formatEngagement(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

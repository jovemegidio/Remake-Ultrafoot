"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight, Heart, MessageCircle, Share2, Bookmark, TrendingUp, Trophy, Users, DollarSign, Loader2, Sparkles } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { TeamCrest } from "@/components/team-crest"
import { serieATeams, getTeamByShort, formatCurrency, type Team } from "@/lib/teams-data"
import { useGameState } from "@/lib/save-system"
import { cn } from "@/lib/utils"

// Veiculos de comunicacao brasileiros com logos reais
const NEWS_SOURCES = {
  ge: {
    name: "ge",
    logo: "/logos/ge.png",
    color: "#00A859",
    bgColor: "bg-[#00A859]",
  },
  espn: {
    name: "ESPN Brasil",
    logo: "/logos/espn.png",
    color: "#E60000",
    bgColor: "bg-[#E60000]",
  },
  brasileirao: {
    name: "Brasileirao",
    logo: "/logos/brasileirao.png",
    color: "#BFFF00",
    bgColor: "bg-[#BFFF00]",
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

interface NewsItem {
  id: string
  source: keyof typeof NEWS_SOURCES
  date: string
  type: "match_preview" | "transfer" | "highlight" | "announcement" | "ranking" | "injury"
  title: string
  description?: string
  image?: string
  generatedImage?: string // Imagem gerada por IA
  matches?: Array<{
    home: Team
    away: Team
  }>
  likes: number
  comments: number
  isNew?: boolean
  icon?: React.ReactNode
  teamName?: string
  playerName?: string
}

// Gera noticias simuladas baseadas no estado do jogo
function generateSimulatedNews(
  userTeam: Team | null,
  season: number,
  week: number
): NewsItem[] {
  const teams = serieATeams
  const randomTeam = () => teams[Math.floor(Math.random() * teams.length)]
  const randomPlayer = () => {
    const names = [
      "Gabriel Silva", "Lucas Oliveira", "Matheus Santos", "Pedro Henrique",
      "Gustavo Ferreira", "Rafael Costa", "Bruno Almeida", "Vinicius Lima",
      "Felipe Souza", "Arthur Pereira", "Caio Ribeiro", "Diego Martins"
    ]
    return names[Math.floor(Math.random() * names.length)]
  }
  
  const randomValue = () => Math.floor(Math.random() * 20 + 5) * 1000000
  const randomAge = () => Math.floor(Math.random() * 15 + 18)
  
  // Gera confrontos para proxima rodada
  const generateMatches = () => {
    const shuffled = [...teams].sort(() => Math.random() - 0.5)
    const matches: Array<{ home: Team; away: Team }> = []
    for (let i = 0; i < Math.min(4, shuffled.length - 1); i += 2) {
      matches.push({ home: shuffled[i], away: shuffled[i + 1] })
    }
    return matches
  }

  // Noticias templates simuladas
  const newsTemplates: NewsItem[] = [
    // Proximos jogos
    {
      id: "matches-" + season + "-" + week,
      source: "brasileirao",
      date: "Agora",
      type: "match_preview",
      title: "PROXIMOS JOGOS",
      description: `Rodada ${week + 1} do Brasileirao ${season} - Confira os confrontos`,
      matches: generateMatches(),
      likes: Math.floor(Math.random() * 50000 + 30000),
      comments: Math.floor(Math.random() * 5000 + 2000),
      isNew: true,
    },
    // Transferencia
    {
      id: "transfer-" + Date.now(),
      source: "ge",
      date: "2h",
      type: "transfer",
      title: `${randomTeam().nome} anuncia contratacao de ${randomPlayer()}`,
      description: `Jogador de ${randomAge()} anos chega por ${formatCurrency(randomValue())} e assina ate ${season + 3}`,
      icon: <DollarSign className="h-5 w-5" />,
      likes: Math.floor(Math.random() * 30000 + 10000),
      comments: Math.floor(Math.random() * 3000 + 500),
    },
    // Destaque do time do usuario
    ...(userTeam ? [{
      id: "user-team-" + Date.now(),
      source: "espn" as const,
      date: "4h",
      type: "highlight" as const,
      title: `${userTeam.nome}: tecnico projeta temporada ${season}`,
      description: `Comissao tecnica define estrategia para buscar titulo do Brasileirao`,
      icon: <Trophy className="h-5 w-5" />,
      likes: Math.floor(Math.random() * 25000 + 15000),
      comments: Math.floor(Math.random() * 2000 + 800),
    }] : []),
    // Ranking
    {
      id: "ranking-" + Date.now(),
      source: "cazeTv",
      date: "6h",
      type: "ranking",
      title: "Artilharia do Brasileirao atualizada",
      description: `${randomPlayer()} assume lideranca com ${Math.floor(Math.random() * 10 + 5)} gols`,
      icon: <TrendingUp className="h-5 w-5" />,
      likes: Math.floor(Math.random() * 40000 + 20000),
      comments: Math.floor(Math.random() * 4000 + 1500),
    },
    // Lesao
    {
      id: "injury-" + Date.now(),
      source: "tntSports",
      date: "8h",
      type: "injury",
      title: `${randomPlayer()} sofre lesao e desfalca ${randomTeam().nome}`,
      description: `Jogador passa por exames e deve ficar de fora por ${Math.floor(Math.random() * 6 + 2)} semanas`,
      icon: <Users className="h-5 w-5" />,
      likes: Math.floor(Math.random() * 15000 + 5000),
      comments: Math.floor(Math.random() * 2000 + 300),
    },
    // Mercado agitado
    {
      id: "market-" + Date.now(),
      source: "ge",
      date: "12h",
      type: "transfer",
      title: "Clubes da Serie A movimentam mercado",
      description: `Janela de transferencias aquece com propostas milionarias`,
      icon: <DollarSign className="h-5 w-5" />,
      likes: Math.floor(Math.random() * 35000 + 15000),
      comments: Math.floor(Math.random() * 3500 + 1000),
    },
  ]

  return newsTemplates
}

interface NewsFeedProps {
  className?: string
  compact?: boolean
}

export function NewsFeed({ className, compact = false }: NewsFeedProps) {
  const { state } = useGameState()
  const userTeam = state.selectedTeamShort ? getTeamByShort(state.selectedTeamShort) : null
  
  const [news, setNews] = useState<NewsItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)
  const [isClient, setIsClient] = useState(false)

  // Gera noticias apenas no cliente para evitar erro de hidratacao
  useEffect(() => {
    setIsClient(true)
    setNews(generateSimulatedNews(userTeam ?? null, state.season, state.week))
  }, [userTeam, state.season, state.week])

  const nextNews = useCallback(() => {
    setDirection(1)
    setCurrentIndex((i) => (i + 1) % news.length)
  }, [news.length])
  
  const prevNews = useCallback(() => {
    setDirection(-1)
    setCurrentIndex((i) => (i - 1 + news.length) % news.length)
  }, [news.length])

  // Auto-play news carousel
  useEffect(() => {
    if (!isAutoPlaying) return
    const interval = setInterval(nextNews, 6000)
    return () => clearInterval(interval)
  }, [isAutoPlaying, nextNews])

  const currentNews = news[currentIndex]

  // Renderiza placeholder enquanto carrega no cliente ou nao ha noticias
  if (!isClient || news.length === 0 || !currentNews) {
    return (
      <div className={cn("rounded-2xl bg-[#141414] border border-white/5 animate-pulse", className)}>
        <div className="h-64 flex items-center justify-center">
          <div className="text-white/30 text-sm">Carregando noticias...</div>
        </div>
      </div>
    )
  }

  const source = NEWS_SOURCES[currentNews.source]

  // Variants para animacao
  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.95
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.95
    })
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
      {/* Navigation Arrows */}
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

      {/* News Card with Animation */}
      <div 
        className="rounded-2xl overflow-hidden bg-[#141414] border border-white/5"
        onMouseEnter={() => setIsAutoPlaying(false)}
        onMouseLeave={() => setIsAutoPlaying(true)}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
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

        {/* Content with smooth transitions */}
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
                scale: { duration: 0.2 }
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

        {/* Footer - Engagement */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
          <div className="flex items-center gap-6">
            <button className="flex items-center gap-1.5 text-white/50 hover:text-red-400 transition-colors">
              <Heart className="h-4 w-4" />
              <span className="text-xs">{formatEngagement(currentNews.likes)}</span>
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
            <button className="text-white/50 hover:text-white transition-colors">
              <Bookmark className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Dots indicator */}
      <div className="flex items-center justify-center gap-1.5 mt-3">
        {news.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            className={cn(
              "rounded-full transition-all",
              i === currentIndex 
                ? "w-5 h-1.5 bg-[#1db954]" 
                : "w-1.5 h-1.5 bg-white/20 hover:bg-white/40"
            )}
          />
        ))}
      </div>
    </div>
  )
}

// Logo do veiculo de comunicacao usando imagens reais
function SourceLogo({ source, size = "md" }: { source: keyof typeof NEWS_SOURCES; size?: "sm" | "md" }) {
  const sourceData = NEWS_SOURCES[source]
  const sizeClass = size === "sm" ? "w-8 h-8" : "w-10 h-10"
  
  return (
    <div className={cn(sizeClass, "rounded-full overflow-hidden relative")}>
      <Image
        src={sourceData.logo}
        alt={sourceData.name}
        fill
        className="object-cover"
        sizes={size === "sm" ? "32px" : "40px"}
      />
    </div>
  )
}

// Badge de verificado
function VerifiedBadge() {
  return (
    <svg className="w-4 h-4 text-[#1da1f2]" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z"/>
    </svg>
  )
}

// Card de preview de partidas com mapa do Brasil estilizado
function MatchPreviewCard({ 
  matches, 
  title, 
  description,
  season 
}: { 
  matches: Array<{ home: Team; away: Team }>
  title: string
  description?: string
  season: number
}) {
  return (
    <div className="relative aspect-[4/3] bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#081020] overflow-hidden">
      {/* Background - Mapa do Brasil estilizado */}
      <div className="absolute inset-0 opacity-40">
        <svg viewBox="0 0 400 300" className="w-full h-full">
          {/* Contorno simplificado do Brasil */}
          <path
            d="M180,25 Q240,20 280,35 Q320,50 350,90 Q370,130 365,170 Q360,210 340,240 Q310,270 270,280 Q230,290 190,285 Q150,280 120,260 Q90,240 70,200 Q50,160 55,120 Q60,80 90,55 Q120,30 180,25"
            fill="none"
            stroke="url(#brazilGradient)"
            strokeWidth="2"
            className="drop-shadow-lg"
          />
          <defs>
            <linearGradient id="brazilGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00875A" stopOpacity="0.6"/>
              <stop offset="50%" stopColor="#FFDF00" stopOpacity="0.4"/>
              <stop offset="100%" stopColor="#00875A" stopOpacity="0.6"/>
            </linearGradient>
          </defs>
          {/* Grid de fundo */}
          <g stroke="white" strokeWidth="0.3" opacity="0.1">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <line key={`h${i}`} x1="0" y1={i * 50} x2="400" y2={i * 50} />
            ))}
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <line key={`v${i}`} x1={i * 50} y1="0" x2={i * 50} y2="300" />
            ))}
          </g>
          {/* Pontos de cidade */}
          <g fill="#1db954">
            <circle cx="280" cy="100" r="3" opacity="0.6"/>
            <circle cx="300" cy="150" r="3" opacity="0.6"/>
            <circle cx="270" cy="200" r="3" opacity="0.6"/>
            <circle cx="200" cy="180" r="3" opacity="0.6"/>
            <circle cx="150" cy="140" r="3" opacity="0.6"/>
          </g>
        </svg>
      </div>

      {/* Titulo e temporada */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white tracking-wide drop-shadow-lg">
            {title}
          </h3>
          {description && (
            <p className="text-xs text-white/60 mt-0.5">{description}</p>
          )}
        </div>
        <div className="px-3 py-1 rounded-full bg-[#00875A]/20 border border-[#00875A]/30">
          <span className="text-[#00875A] text-xs font-bold">{season}</span>
        </div>
      </div>

      {/* Confrontos */}
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

      {/* Rotas decorativas */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 300">
        <defs>
          <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1db954" stopOpacity="0"/>
            <stop offset="50%" stopColor="#1db954" stopOpacity="0.5"/>
            <stop offset="100%" stopColor="#1db954" stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path 
          d="M60,150 Q200,80 340,150" 
          fill="none" 
          stroke="url(#routeGradient)" 
          strokeWidth="1.5" 
          strokeDasharray="6,4"
        />
        <path 
          d="M80,200 Q200,130 320,200" 
          fill="none" 
          stroke="url(#routeGradient)" 
          strokeWidth="1.5" 
          strokeDasharray="6,4"
        />
      </svg>
    </div>
  )
}

// Card de conteudo de noticia padrao com suporte a imagens geradas por IA
function NewsContentCard({ news }: { news: NewsItem }) {
  const source = NEWS_SOURCES[news.source]
  const [aiImage, setAiImage] = useState<string | null>(news.generatedImage || null)
  const [isLoadingImage, setIsLoadingImage] = useState(false)
  const [imageError, setImageError] = useState(false)
  
  // Gera imagem com IA ao clicar no botao
  const generateAIImage = async () => {
    if (isLoadingImage) return
    setIsLoadingImage(true)
    setImageError(false)
    
    try {
      const response = await fetch("/api/generate-news-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newsType: news.type,
          title: news.title,
          teamName: news.teamName,
          playerName: news.playerName,
        }),
      })
      
      if (!response.ok) throw new Error("Failed to generate image")
      
      const data = await response.json()
      if (data.imageUrl) {
        setAiImage(data.imageUrl)
      } else {
        setImageError(true)
      }
    } catch (error) {
      console.error("[v0] Error generating AI image:", error)
      setImageError(true)
    } finally {
      setIsLoadingImage(false)
    }
  }
  
  const typeColors: Record<string, string> = {
    transfer: "from-yellow-900/50 to-yellow-950/30",
    highlight: "from-blue-900/50 to-blue-950/30",
    ranking: "from-purple-900/50 to-purple-950/30",
    injury: "from-red-900/50 to-red-950/30",
    announcement: "from-green-900/50 to-green-950/30",
  }

  const typeIcons: Record<string, React.ReactNode> = {
    transfer: <DollarSign className="h-6 w-6 text-yellow-400" />,
    highlight: <Trophy className="h-6 w-6 text-blue-400" />,
    ranking: <TrendingUp className="h-6 w-6 text-purple-400" />,
    injury: <Users className="h-6 w-6 text-red-400" />,
    announcement: <Trophy className="h-6 w-6 text-green-400" />,
  }

  return (
    <div className={cn(
      "relative aspect-video bg-gradient-to-br overflow-hidden",
      typeColors[news.type] || "from-gray-900/50 to-gray-950/30"
    )}>
      {/* Background - Imagem gerada por IA ou padrao */}
      {aiImage ? (
        <div className="absolute inset-0">
          <Image
            src={aiImage}
            alt={news.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute top-2 right-2 px-2 py-1 rounded bg-primary/20 border border-primary/30 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="text-[10px] text-primary font-medium">AI</span>
          </div>
        </div>
      ) : (
        <>
          {/* Background pattern padrao */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_70%)]" />
          </div>
          
          {/* Botao para gerar imagem com IA */}
          <button
            onClick={generateAIImage}
            disabled={isLoadingImage}
            className={cn(
              "absolute top-2 right-2 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all",
              isLoadingImage 
                ? "bg-white/10 cursor-wait" 
                : "bg-primary/20 border border-primary/30 hover:bg-primary/30"
            )}
          >
            {isLoadingImage ? (
              <>
                <Loader2 className="h-3 w-3 text-primary animate-spin" />
                <span className="text-[10px] text-primary font-medium">Gerando...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3 text-primary" />
                <span className="text-[10px] text-primary font-medium">Gerar Imagem AI</span>
              </>
            )}
          </button>
          
          {imageError && (
            <div className="absolute top-12 right-2 px-2 py-1 rounded bg-red-500/20 border border-red-500/30">
              <span className="text-[10px] text-red-400">Erro ao gerar</span>
            </div>
          )}
        </>
      )}
      
      {/* Icon */}
      <div className="absolute top-4 left-4 w-12 h-12 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
        {news.icon || typeIcons[news.type]}
      </div>
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
        <div className="flex items-center gap-2 mb-2">
          <span 
            className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
            style={{ backgroundColor: source.color + "20", color: source.color }}
          >
            {news.type === "transfer" ? "Mercado" : 
             news.type === "highlight" ? "Destaque" :
             news.type === "ranking" ? "Ranking" :
             news.type === "injury" ? "Lesao" : "Noticia"}
          </span>
        </div>
        <h3 className="text-lg font-bold text-white mb-1 line-clamp-2">{news.title}</h3>
        {news.description && (
          <p className="text-sm text-white/70 line-clamp-2">{news.description}</p>
        )}
      </div>
    </div>
  )
}

// Item compacto de noticia
function NewsItemCompact({ news }: { news: NewsItem }) {
  const source = NEWS_SOURCES[news.source]
  
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors cursor-pointer">
      <SourceLogo source={news.source} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs font-medium text-white/60">{source.name}</span>
          <span className="text-[10px] text-white/30">{news.date}</span>
          {news.isNew && (
            <span className="px-1.5 py-0.5 rounded bg-yellow-400/20 text-yellow-400 text-[9px] font-bold">
              New
            </span>
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

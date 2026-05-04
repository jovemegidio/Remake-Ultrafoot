"use client"

import { useState } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight, Heart, MessageCircle, Share2, Bookmark } from "lucide-react"
import { TeamCrest } from "@/components/team-crest"
import { serieATeams, type Team } from "@/lib/teams-data"
import { cn } from "@/lib/utils"

interface NewsItem {
  id: string
  source: {
    name: string
    logo: string
    verified: boolean
  }
  date: string
  type: "match_preview" | "transfer" | "highlight" | "announcement"
  title: string
  description?: string
  image?: string
  matches?: Array<{
    home: Team
    away: Team
  }>
  likes: number
  comments: number
  isNew?: boolean
}

// Sample news data
const sampleNews: NewsItem[] = [
  {
    id: "1",
    source: {
      name: "Brasileirao",
      logo: "https://logodetimes.com/times/brasileirao-assai/logo-brasileirao-assai-256.png",
      verified: true
    },
    date: "Hoje",
    type: "match_preview",
    title: "PROXIMAS PARTIDAS",
    description: "Confira os confrontos da proxima rodada do Campeonato Brasileiro",
    matches: [
      { home: serieATeams[0], away: serieATeams[1] },
      { home: serieATeams[2], away: serieATeams[3] },
      { home: serieATeams[4], away: serieATeams[5] },
      { home: serieATeams[6], away: serieATeams[7] },
    ],
    likes: 54940,
    comments: 3700,
    isNew: true
  },
  {
    id: "2",
    source: {
      name: "GE",
      logo: "https://s3.glbimg.com/v1/AUTH_7d75c8cbc9b549699dab464fd549ac33/ge/logos/ge-144.png",
      verified: true
    },
    date: "2h",
    type: "transfer",
    title: "Mercado agitado na Serie A",
    description: "Clubes brasileiros se movimentam para reforcar elencos na janela de transferencias",
    image: "https://s2-ge.glbimg.com/H9TqW_mJGNjQl8zswOlFBiOZ_Jc=/0x0:1920x1080/984x0/smart/filters:strip_icc()/i.s3.glbimg.com/v1/AUTH_bc8228b6673f488aa253bbcb03c80ec5/internal_photos/bs/2024/k/f/JMQm8wTEeGrJSYPMAFKg/brasileirao.jpg",
    likes: 12500,
    comments: 890,
  },
  {
    id: "3",
    source: {
      name: "ESPN",
      logo: "https://a.espncdn.com/i/espn/teamlogos/lrg/trans/espn_dotcom_black.gif",
      verified: true
    },
    date: "5h",
    type: "highlight",
    title: "Melhores momentos da rodada",
    description: "Gols, lances e destaques da ultima rodada do campeonato",
    image: "https://a.espncdn.com/photo/2024/0423/r1324678_1296x729_16-9.jpg",
    likes: 28300,
    comments: 1540,
  }
]

interface NewsFeedProps {
  className?: string
  compact?: boolean
}

export function NewsFeed({ className, compact = false }: NewsFeedProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const news = sampleNews

  const nextNews = () => setCurrentIndex((i) => (i + 1) % news.length)
  const prevNews = () => setCurrentIndex((i) => (i - 1 + news.length) % news.length)

  const currentNews = news[currentIndex]

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

      {/* News Card */}
      <div className="rounded-2xl overflow-hidden bg-[#141414] border border-white/5">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-full overflow-hidden bg-yellow-500 flex items-center justify-center">
              {currentNews.source.logo ? (
                <Image 
                  src={currentNews.source.logo} 
                  alt={currentNews.source.name}
                  fill
                  className="object-contain p-1"
                  unoptimized
                />
              ) : (
                <span className="text-sm font-bold text-black">{currentNews.source.name.charAt(0)}</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm text-white">{currentNews.source.name}</span>
                {currentNews.source.verified && (
                  <svg className="w-4 h-4 text-[#1da1f2]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z"/>
                  </svg>
                )}
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
        {currentNews.type === "match_preview" && currentNews.matches ? (
          <MatchPreviewCard matches={currentNews.matches} title={currentNews.title} />
        ) : (
          <div className="relative aspect-video">
            {currentNews.image && (
              <Image 
                src={currentNews.image}
                alt={currentNews.title}
                fill
                className="object-cover"
                unoptimized
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <h3 className="text-lg font-bold text-white mb-1">{currentNews.title}</h3>
              {currentNews.description && (
                <p className="text-sm text-white/70 line-clamp-2">{currentNews.description}</p>
              )}
            </div>
          </div>
        )}

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

// Match Preview Card com mapa estilizado
function MatchPreviewCard({ matches, title }: { matches: Array<{ home: Team; away: Team }>; title: string }) {
  return (
    <div className="relative aspect-[4/3] bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#081020] overflow-hidden">
      {/* Background pattern - mapa estilizado */}
      <div className="absolute inset-0 opacity-30">
        <svg viewBox="0 0 400 300" className="w-full h-full">
          {/* Simplified Brazil map outline */}
          <path
            d="M200,20 Q280,40 320,80 Q360,120 340,180 Q320,240 260,280 Q200,300 140,280 Q80,260 60,200 Q40,140 80,80 Q120,40 200,20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            className="text-[#1db954]/30"
          />
          {/* Grid lines */}
          <g stroke="currentColor" strokeWidth="0.5" className="text-white/10">
            {[0, 1, 2, 3, 4].map((i) => (
              <line key={`h${i}`} x1="0" y1={i * 75} x2="400" y2={i * 75} />
            ))}
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <line key={`v${i}`} x1={i * 80} y1="0" x2={i * 80} y2="300" />
            ))}
          </g>
        </svg>
      </div>

      {/* Title */}
      <div className="absolute top-4 left-4 right-4">
        <h3 className="text-xl font-bold text-white tracking-wide text-center drop-shadow-lg">
          {title}
        </h3>
      </div>

      {/* Match pairs with connecting lines */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="grid grid-cols-2 gap-x-16 gap-y-6">
          {matches.map((match, i) => (
            <div key={i} className="flex items-center gap-3">
              <TeamCrest team={match.home} size="md" className="drop-shadow-lg" />
              <div className="flex items-center gap-1">
                <span className="text-white/30 text-xs">vs</span>
              </div>
              <TeamCrest team={match.away} size="md" className="drop-shadow-lg" />
            </div>
          ))}
        </div>
      </div>

      {/* Decorative airplane routes */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 300">
        <defs>
          <marker id="plane" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0,5 L10,5 M5,0 L5,10 M3,3 L7,7 M7,3 L3,7" stroke="white" strokeWidth="1" fill="none" opacity="0.5"/>
          </marker>
        </defs>
        {/* Curved flight paths */}
        <path 
          d="M80,100 Q200,50 320,100" 
          fill="none" 
          stroke="white" 
          strokeWidth="1" 
          strokeDasharray="4,4"
          opacity="0.2"
        />
        <path 
          d="M100,200 Q200,150 300,200" 
          fill="none" 
          stroke="white" 
          strokeWidth="1" 
          strokeDasharray="4,4"
          opacity="0.2"
        />
      </svg>
    </div>
  )
}

// Compact news item
function NewsItemCompact({ news }: { news: NewsItem }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors cursor-pointer">
      <div className="relative w-8 h-8 rounded-full overflow-hidden bg-white/10 flex-shrink-0">
        {news.source.logo ? (
          <Image 
            src={news.source.logo} 
            alt={news.source.name}
            fill
            className="object-contain p-1"
            unoptimized
          />
        ) : (
          <span className="text-xs font-bold text-white/60">{news.source.name.charAt(0)}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs font-medium text-white/60">{news.source.name}</span>
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

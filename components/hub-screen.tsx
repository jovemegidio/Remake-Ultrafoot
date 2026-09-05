"use client"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { TeamCrest } from "@/components/team-crest"
import { cn } from "@/lib/utils"
import { getTeamByShort, serieATeams } from "@/lib/teams-data"
import { useGameState } from "@/lib/save-system"

export interface HubCard {
  id: number
  title: string
  subtitle: string
  icon: LucideIcon
  /** Conteudo central opcional (substitui o icone padrao) */
  visual?: ReactNode
  /** Texto descritivo abaixo do icone */
  description?: string
  route: string
}

interface HubScreenProps {
  /** Linha de subtitulo ao lado do escudo (ex.: "Mercado de transferencias") */
  tagline: string
  cards: HubCard[]
  primaryActionLabel: string
  primaryActionRoute: string
  /** Fundo editorial opcional para hubs tematicos. */
  backgroundImage?: string
}

export function HubScreen({ tagline, cards, primaryActionLabel, primaryActionRoute, backgroundImage }: HubScreenProps) {
  const router = useRouter()
  const { state } = useGameState()
  const userTeam = getTeamByShort(state.selectedTeamShort || "BGT") || serieATeams[0]
  const [selectedCard, setSelectedCard] = useState<number | null>(null)
  const [hoveredCard, setHoveredCard] = useState<number | null>(null)

  const handleCardClick = (card: HubCard) => {
    setSelectedCard(card.id)
    router.push(card.route)
  }

  return (
    <div className="flex h-screen pl-0 pb-20 md:pb-0 bg-[var(--uf-bg-deep)] overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <GameHeader />

        <main className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 relative">
          {backgroundImage && <>
            <Image src={backgroundImage} alt="" fill priority className="pointer-events-none object-cover object-center" />
            <div className="pointer-events-none absolute inset-0 bg-black/35" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/75" />
          </>}
          {/* Background com gradiente */}
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
                  <h1 className="uf-heading text-2xl font-bold text-white">{userTeam.nome}</h1>
                  <p className="text-sm text-white/50">{tagline}</p>
                </div>
              </div>
            </div>

            {/* Cards Grid */}
            <div className="flex-1 flex items-center justify-center">
              <div
                className={cn(
                  "grid grid-cols-1 gap-4 w-full min-w-0",
                  cards.length === 2 && "md:grid-cols-2 max-w-3xl",
                  cards.length === 3 && "md:grid-cols-3 max-w-5xl",
                  cards.length >= 4 && "md:grid-cols-3 lg:grid-cols-5 max-w-6xl",
                )}
              >
                {cards.map((card, index) => {
                  const Icon = card.icon
                  // Card "ativo": o que esta sob hover, ou o primeiro por padrao
                  const isActive = hoveredCard === card.id || (hoveredCard === null && index === 0)
                  return (
                    <motion.div
                      key={card.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={cn("relative group cursor-pointer", selectedCard === card.id && "scale-95 opacity-50")}
                      onMouseEnter={() => setHoveredCard(card.id)}
                      onMouseLeave={() => setHoveredCard(null)}
                      onClick={() => handleCardClick(card)}
                    >
                      <div
                        className={cn(
                          "relative overflow-hidden rounded-2xl border transition-all duration-300",
                          "h-[320px] lg:h-[380px] flex flex-col",
                          isActive
                            ? "border-[var(--brand)]/70 shadow-[0_0_34px_rgba(0,255,200,0.18)]"
                            : "border-white/[0.07] shadow-[0_18px_40px_rgba(0,0,0,0.5)]",
                        )}
                        style={{
                          background: isActive
                            ? "linear-gradient(160deg, rgba(0,255,200,0.10) 0%, rgba(8,14,18,0.92) 42%, rgba(0,0,0,0.85) 100%)"
                            : "linear-gradient(160deg, rgba(0,255,200,0.05) 0%, rgba(10,12,16,0.92) 38%, rgba(0,0,0,0.85) 100%)",
                        }}
                      >
                        <div className="relative flex flex-col h-full p-6">
                          <div className="text-center mb-4">
                            <h2 className="uf-heading text-xl font-bold text-white mb-1">{card.title}</h2>
                            <p className="text-sm font-semibold text-[var(--brand)]">{card.subtitle}</p>
                          </div>

                          <div className="flex-1 flex flex-col items-center justify-center px-2">
                            {card.visual ?? <Icon className="h-24 w-24 text-white/85 mb-4" strokeWidth={1.5} />}
                            {card.description && (
                              <p className="text-xs text-white/55 text-center leading-relaxed mt-2">
                                {card.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>

            {/* Bottom action */}
            <div className="flex items-center justify-center gap-4 mt-6">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push(primaryActionRoute)}
                className="group flex items-center gap-3 pl-2 pr-6 py-2 rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400 text-white font-semibold shadow-[0_0_24px_rgba(56,128,255,0.45)] hover:shadow-[0_0_32px_rgba(0,255,200,0.5)] transition-shadow"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-sm">&#9166;</span>
                {primaryActionLabel}
              </motion.button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

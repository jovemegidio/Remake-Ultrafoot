"use client"

import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { ChevronLeft, Globe2, Repeat2, ArrowRight } from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { MusicPlayer } from "@/components/music-player"
import { ClubCrest } from "@/components/club-crest"
import { Jersey } from "@/components/jersey"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type KitId = "home" | "away" | "third"

const kits: {
  id: KitId
  label: string
  primary: string
  secondary: string
  pattern: "stripes" | "solid" | "diagonal"
}[] = [
  { id: "home", label: "Titular", primary: "oklch(0.13 0.015 250)", secondary: "oklch(0.95 0.005 240)", pattern: "stripes" },
  { id: "away", label: "Reserva", primary: "oklch(0.95 0.005 240)", secondary: "oklch(0.13 0.015 250)", pattern: "solid" },
  { id: "third", label: "Alternativo", primary: "oklch(0.2 0.02 250)", secondary: "oklch(0.65 0.22 25)", pattern: "diagonal" },
]

export default function PreMatchPage() {
  const [selected, setSelected] = useState<KitId>("third")

  return (
    <div className="relative min-h-screen pl-[72px] pb-24">
      <GameSidebar />

      {/* Cinematic background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <Image
          src="/office-bg.jpg"
          alt=""
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/85 via-background/70 to-background" />
        <div className="absolute inset-0 bg-grid opacity-20" />
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex h-14 items-center justify-between border-b border-border/60 bg-card/30 px-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-card transition"
            aria-label="Voltar"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="font-display tracking-widest text-xs">PARTIDA</span>
          <span className="text-border">/</span>
          <span className="text-xs text-muted-foreground">Pré-Jogo</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="font-display tracking-wider">
            <Repeat2 className="mr-1 h-3.5 w-3.5" />
            REPLAY
          </Button>
          <Button variant="outline" size="sm" className="font-display tracking-wider">
            2X
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 flex min-h-[calc(100vh-7.5rem)] flex-col items-center justify-center px-6 py-12">
        <div className="mx-auto w-full max-w-5xl text-center">
          {/* Title */}
          <div className="font-display tracking-[0.5em] text-[10px] text-primary mb-2">
            ATO 1 · PREPARAÇÃO
          </div>
          <h1 className="font-display-italic text-7xl leading-none tracking-tight text-balance">
            PRÉ-JOGO
          </h1>

          {/* Match header */}
          <div className="mt-10 flex items-center justify-center gap-8">
            <div className="flex items-center gap-3">
              <ClubCrest
                abbr="TBS"
                size="lg"
                primary="oklch(0.65 0.22 25)"
                secondary="oklch(0.13 0.015 250)"
              />
              <div className="text-left">
                <div className="text-[10px] font-display tracking-widest text-muted-foreground">
                  MANDANTE
                </div>
                <div className="font-display-italic text-2xl">TOMBENSE</div>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div className="font-display-italic text-3xl text-muted-foreground">VS</div>
              <div className="mt-1 h-px w-12 bg-gradient-to-r from-transparent via-primary to-transparent" />
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[10px] font-display tracking-widest text-muted-foreground">
                  VISITANTE
                </div>
                <div className="font-display-italic text-2xl">ATLÉTICO-MG</div>
              </div>
              <ClubCrest
                abbr="CAM"
                size="lg"
                primary="oklch(0.13 0.015 250)"
                secondary="oklch(0.95 0.005 240)"
              />
            </div>
          </div>

          {/* Competition badge */}
          <div className="mt-6 inline-flex items-center gap-2 rounded-sm border border-border bg-card/60 px-3 py-1.5 backdrop-blur">
            <Globe2 className="h-3 w-3 text-primary" />
            <span className="font-display tracking-widest text-[10px]">
              CAMPEONATO MINEIRO BETANO
            </span>
            <span className="text-border">·</span>
            <span className="text-[10px] text-muted-foreground">Rodada 1 · Independência</span>
          </div>

          {/* Kit selector */}
          <div className="mt-12">
            <div className="mb-4 font-display tracking-[0.4em] text-[10px] text-muted-foreground">
              ESCOLHA SEU UNIFORME
            </div>

            <div className="grid grid-cols-3 gap-3 max-w-2xl mx-auto">
              {kits.map((kit) => {
                const active = selected === kit.id
                return (
                  <button
                    key={kit.id}
                    onClick={() => setSelected(kit.id)}
                    className={cn(
                      "group relative overflow-hidden rounded-lg border-2 p-4 transition-all",
                      active
                        ? "border-accent bg-accent/5 shadow-glow-accent"
                        : "border-border bg-card/60 backdrop-blur hover:border-primary/50",
                    )}
                  >
                    {active && (
                      <span className="absolute right-2 top-2 rounded-sm bg-accent px-1.5 py-0.5 text-[9px] font-display tracking-widest text-accent-foreground">
                        SELECIONADO
                      </span>
                    )}

                    <div className="mx-auto w-24">
                      <Jersey
                        variant={kit.id}
                        primary={kit.primary}
                        secondary={kit.secondary}
                        pattern={kit.pattern}
                      />
                    </div>

                    <div
                      className={cn(
                        "mt-3 font-display tracking-widest text-xs transition",
                        active ? "text-accent" : "text-foreground/80",
                      )}
                    >
                      {kit.label.toUpperCase()}
                    </div>

                    {/* Diagonal accent on active */}
                    {active && (
                      <div className="absolute -bottom-2 -right-2 h-12 w-12 rotate-45 bg-accent/10" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Start match CTA */}
          <div className="mt-12 flex flex-col items-center gap-3">
            <Link href="/partida/ao-vivo">
              <Button
                size="lg"
                className="group h-12 px-8 font-display tracking-[0.2em] bg-accent text-accent-foreground hover:bg-accent/90 shadow-glow-accent"
              >
                <Globe2 className="mr-2 h-4 w-4" />
                INICIAR PARTIDA
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <p className="text-[11px] text-muted-foreground">
              Pressione para começar a transmissão · 90 minutos · Modo Normal
            </p>
          </div>
        </div>
      </main>

      <MusicPlayer />
    </div>
  )
}

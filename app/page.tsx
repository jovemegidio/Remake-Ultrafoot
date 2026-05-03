"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { allTeams, getLogoUrl } from "@/lib/teams-data"
import { allPlayers } from "@/lib/players-data"

const STAGES = [
  { at: 8, label: "Inicializando o motor" },
  { at: 28, label: "Carregando ligas e calendarios" },
  { at: 52, label: "Importando elencos brasileiros" },
  { at: 74, label: "Preparando mercado de transferencias" },
  { at: 92, label: "Sincronizando temporada 2026" },
  { at: 100, label: "Pronto para jogar" },
]

const TIPS = [
  "Avance a semana com calma — cada decisao afeta seu prestigio.",
  "Renove contratos antes do mercado abrir.",
  "Times com torcida grande recebem mais por bilheteria.",
  "Goleiros velhos podem ter base alta, mas baixam rapido.",
  "Defina metas realistas com a diretoria no inicio da temporada.",
]

export default function SplashPage() {
  const router = useRouter()
  const [progress, setProgress] = useState(0)
  const [ready, setReady] = useState(false)
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)])

  const totalTeams = allTeams.length
  const totalPlayers = allPlayers.length

  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const duration = 2400
    const tick = (t: number) => {
      const pct = Math.min(100, Math.round(((t - start) / duration) * 100))
      setProgress(pct)
      if (pct < 100) raf = requestAnimationFrame(tick)
      else setReady(true)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    router.prefetch("/dashboard")
  }, [router])

  const stage =
    [...STAGES].reverse().find(s => progress >= s.at) ?? STAGES[0]

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#080808] text-white antialiased"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at 30% 20%, oklch(0.32 0.10 195 / 0.18) 0%, transparent 55%)," +
          "radial-gradient(ellipse at 70% 80%, oklch(0.30 0.18 140 / 0.14) 0%, transparent 60%)",
      }}
    >
      {/* Subtle dotted grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Soft top vignette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.04), transparent)",
        }}
      />

      <div className="relative z-10 flex w-full max-w-[560px] flex-col items-center px-8">
        {/* Logo + halo */}
        <div className="relative mb-9 h-32 w-32">
          <div
            aria-hidden
            className="absolute inset-0 rounded-full blur-2xl"
            style={{
              background:
                "radial-gradient(circle, oklch(0.78 0.18 195 / 0.45) 0%, transparent 70%)",
            }}
          />
          <div className="relative flex h-32 w-32 items-center justify-center rounded-full ring-1 ring-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.01] backdrop-blur-sm">
            <Image
              src={getLogoUrl()}
              alt="Ultrafoot"
              width={84}
              height={84}
              className="object-contain drop-shadow-[0_2px_12px_rgba(0,212,255,0.35)]"
              priority
              unoptimized
            />
          </div>
        </div>

        {/* Wordmark */}
        <h1
          className="text-center text-[2.6rem] font-extrabold leading-none tracking-[0.02em]"
          style={{
            fontFamily: "var(--font-oswald), var(--font-geist), sans-serif",
            background:
              "linear-gradient(180deg, #ffffff 0%, #d6d6d6 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          ULTRAFOOT
        </h1>
        <p className="mt-2 text-[11px] uppercase tracking-[0.45em] text-white/40">
          Football Manager · Edicao 2026
        </p>

        {/* Counter strip */}
        <div className="mt-8 flex items-center justify-center gap-8 text-center">
          <Counter label="Times" value={totalTeams} />
          <Divider />
          <Counter label="Jogadores" value={totalPlayers} />
          <Divider />
          <Counter label="Modo" value="Offline" small />
        </div>

        {/* Progress */}
        <div className="mt-10 w-full">
          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            className="relative h-[3px] w-full overflow-hidden rounded-full bg-white/[0.06]"
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ease-out"
              style={{
                width: `${progress}%`,
                background:
                  "linear-gradient(90deg, oklch(0.78 0.18 195) 0%, oklch(0.85 0.22 140) 100%)",
                boxShadow: "0 0 12px oklch(0.78 0.18 195 / 0.65)",
              }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] tracking-wider text-white/45">
            <span className="uppercase">{stage.label}</span>
            <span className="tabular-nums text-white/70">{progress}%</span>
          </div>
        </div>

        {/* CTA / Tip */}
        <div className="mt-10 flex w-full items-center justify-between gap-4">
          <p className="max-w-[260px] text-left text-xs leading-relaxed text-white/40">
            <span className="mr-1.5 text-white/60">Dica:</span>
            {tip}
          </p>

          <Link
            href="/dashboard"
            className={
              "group inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all " +
              (ready
                ? "bg-white text-black hover:bg-white/90 shadow-[0_8px_30px_rgba(255,255,255,0.18)]"
                : "pointer-events-none bg-white/10 text-white/40")
            }
          >
            {ready ? "Entrar no jogo" : "Carregando…"}
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="absolute inset-x-0 bottom-6 flex items-center justify-between px-8 text-[10px] tracking-widest text-white/25">
        <span>v2.0.0 · BUILD 2026.05</span>
        <span>JOGAVEL OFFLINE · SAVE LOCAL</span>
      </footer>
    </main>
  )
}

function Counter({
  label,
  value,
  small,
}: {
  label: string
  value: number | string
  small?: boolean
}) {
  return (
    <div className="flex flex-col items-center">
      <span
        className={
          "tabular-nums font-semibold text-white " +
          (small ? "text-base" : "text-2xl")
        }
        style={{
          fontFamily: "var(--font-oswald), var(--font-geist), sans-serif",
        }}
      >
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </span>
      <span className="mt-0.5 text-[10px] uppercase tracking-[0.3em] text-white/35">
        {label}
      </span>
    </div>
  )
}

function Divider() {
  return <div aria-hidden className="h-8 w-px bg-white/10" />
}

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { SkipForward } from "lucide-react"
import type { CompetitionIntroConfig } from "@/lib/competition-intro"
import { useGamepadDetection } from "@/components/gamepad-controls-bar"
import { cn } from "@/lib/utils"

interface CompetitionIntroProps {
  config: CompetitionIntroConfig
  onComplete: () => void
  /** duracao automatica em ms (default 6000) */
  durationMs?: number
}

/**
 * Intro cinematografica full-screen de uma competicao.
 * - Anima logo, trofeu e nome com as cores do tema.
 * - Pode ser pulada: PC (clique / Enter / Espaco / Esc) e controle (qualquer botao).
 * - Auto-avanca apos `durationMs`.
 * - Se `config.video` existir, toca o video local em vez da animacao.
 */
export function CompetitionIntro({ config, onComplete, durationMs = 6000 }: CompetitionIntroProps) {
  const { connected: gamepadConnected, type: controllerType } = useGamepadDetection()
  const [exiting, setExiting] = useState(false)
  const [progress, setProgress] = useState(0)
  const finishedRef = useRef(false)
  const startRef = useRef<number>(0)
  const rafRef = useRef<number | undefined>(undefined)

  const finish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    setExiting(true)
    // aguarda animacao de saida antes de desmontar
    window.setTimeout(() => onComplete(), 450)
  }, [onComplete])

  // Auto-avanco + barra de progresso
  useEffect(() => {
    startRef.current = performance.now()
    const tick = (now: number) => {
      const elapsed = now - startRef.current
      const pct = Math.min(1, elapsed / durationMs)
      setProgress(pct)
      if (pct >= 1) {
        finish()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [durationMs, finish])

  // Skip via teclado (PC)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["Enter", " ", "Spacebar", "Escape"].includes(e.key)) {
        e.preventDefault()
        finish()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [finish])

  // Skip via controle (qualquer botao)
  useEffect(() => {
    const onPad = () => finish()
    window.addEventListener("gamepad:button", onPad)
    return () => window.removeEventListener("gamepad:button", onPad)
  }, [finish])

  const skipLabel = gamepadConnected
    ? controllerType === "playstation"
      ? "Pular ✕"
      : "Pular Ⓐ"
    : "Pular ENTER"

  return (
    <AnimatePresence>
      {!exiting && (
        <motion.div
          key="competition-intro"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden cursor-pointer"
          style={{ background: config.colors.background }}
          onClick={finish}
          role="button"
          aria-label="Pular introducao da competicao"
        >
          {config.video ? (
            <video
              src={config.video}
              autoPlay
              muted
              playsInline
              onEnded={finish}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <IntroAnimation config={config} />
          )}

          {/* Barra de progresso */}
          <div className="absolute bottom-0 left-0 h-1 w-full bg-white/10">
            <motion.div
              className="h-full"
              style={{ width: `${progress * 100}%`, backgroundColor: config.colors.accent }}
            />
          </div>

          {/* Botao Pular */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              finish()
            }}
            className="absolute bottom-6 right-6 flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-4 py-2 text-sm font-semibold text-white/90 backdrop-blur-sm transition-colors hover:bg-black/60"
          >
            <SkipForward className="h-4 w-4" />
            {skipLabel}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function IntroAnimation({ config }: { config: CompetitionIntroConfig }) {
  return (
    <div className="relative flex flex-col items-center justify-center px-6 text-center">
      {/* Halo de luz pulsante */}
      <motion.div
        className="pointer-events-none absolute -z-10 h-[60vmin] w-[60vmin] rounded-full blur-3xl"
        style={{ backgroundColor: config.colors.primary, opacity: 0.25 }}
        animate={{ scale: [0.9, 1.15, 0.95], opacity: [0.18, 0.32, 0.2] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Raios girando atras do trofeu */}
      <motion.div
        className="pointer-events-none absolute -z-10 h-[80vmin] w-[80vmin]"
        style={{
          background: `conic-gradient(from 0deg, transparent 0deg, ${config.colors.accent}22 18deg, transparent 36deg, transparent 54deg, ${config.colors.accent}22 72deg, transparent 90deg)`,
          maskImage: "radial-gradient(circle, transparent 30%, black 70%)",
          WebkitMaskImage: "radial-gradient(circle, transparent 30%, black 70%)",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
      />

      {/* Logo da competicao */}
      {config.logo && (
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="mb-4"
        >
          <Image
            src={config.logo || "/placeholder.svg"}
            alt={config.name}
            width={120}
            height={120}
            className="h-20 w-auto object-contain drop-shadow-[0_0_18px_rgba(0,0,0,0.6)]"
            unoptimized
          />
        </motion.div>
      )}

      {/* Trofeu com entrada dramatica */}
      <motion.div
        initial={{ opacity: 0, scale: 0.4, rotate: -8 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ delay: 0.3, duration: 0.9, type: "spring", bounce: 0.35 }}
        className="relative"
      >
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <Image
            src={config.trophy || "/placeholder.svg"}
            alt={`Trofeu ${config.name}`}
            width={300}
            height={420}
            className="h-[42vmin] max-h-[420px] w-auto object-contain"
            style={{ filter: `drop-shadow(0 0 32px ${config.colors.primary}aa)` }}
            unoptimized
            priority
          />
        </motion.div>
        {/* Brilho que cruza o trofeu */}
        <motion.div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ delay: 1.1, duration: 1.4, repeat: Infinity, repeatDelay: 2.5 }}
        >
          <div
            className="absolute -inset-y-4 -left-1/2 w-1/2 -skew-x-12"
            style={{
              background: `linear-gradient(90deg, transparent, ${config.colors.accent}88, transparent)`,
              animation: "intro-shine 1.4s ease-in-out",
            }}
          />
        </motion.div>
      </motion.div>

      {/* Nome da competicao */}
      <motion.h1
        initial={{ opacity: 0, y: 30, letterSpacing: "0.05em" }}
        animate={{ opacity: 1, y: 0, letterSpacing: "0.18em" }}
        transition={{ delay: 0.7, duration: 0.7 }}
        className="mt-6 text-3xl font-black uppercase tracking-widest text-balance md:text-5xl"
        style={{
          color: config.colors.text,
          fontFamily: "var(--font-oswald), sans-serif",
          textShadow: `0 2px 24px ${config.colors.primary}88`,
        }}
      >
        {config.name}
      </motion.h1>

      {/* Tagline */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.8 }}
        className={cn("mt-3 text-sm font-semibold uppercase tracking-[0.35em] md:text-base")}
        style={{ color: config.colors.accent }}
      >
        {config.tagline}
      </motion.p>

      <style jsx>{`
        @keyframes intro-shine {
          0% {
            left: -50%;
          }
          100% {
            left: 150%;
          }
        }
      `}</style>
    </div>
  )
}

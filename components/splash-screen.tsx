"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface SplashScreenProps {
  onComplete: () => void
  minDuration?: number
}

export function SplashScreen({ onComplete, minDuration = 3500 }: SplashScreenProps) {
  const [phase, setPhase] = useState<"loading" | "ready" | "exiting">("loading")
  const [progress, setProgress] = useState(0)
  const [showPressStart, setShowPressStart] = useState(false)

  // Simulate loading progress
  useEffect(() => {
    const startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const newProgress = Math.min((elapsed / minDuration) * 100, 100)
      setProgress(newProgress)
      
      if (newProgress >= 100) {
        clearInterval(interval)
        setPhase("ready")
        setShowPressStart(true)
      }
    }, 50)

    return () => clearInterval(interval)
  }, [minDuration])

  // Handle any key/click to start
  useEffect(() => {
    if (phase !== "ready") return

    const handleStart = () => {
      setPhase("exiting")
      setTimeout(onComplete, 800)
    }

    window.addEventListener("keydown", handleStart)
    window.addEventListener("click", handleStart)
    window.addEventListener("gamepadconnected", handleStart)

    // Check for gamepad input
    const checkGamepad = () => {
      const gamepads = navigator.getGamepads()
      for (const gamepad of gamepads) {
        if (gamepad) {
          for (const button of gamepad.buttons) {
            if (button.pressed) {
              handleStart()
              return
            }
          }
        }
      }
      if (phase === "ready") {
        requestAnimationFrame(checkGamepad)
      }
    }
    requestAnimationFrame(checkGamepad)

    return () => {
      window.removeEventListener("keydown", handleStart)
      window.removeEventListener("click", handleStart)
      window.removeEventListener("gamepadconnected", handleStart)
    }
  }, [phase, onComplete])

  return (
    <div 
      className={cn(
        "fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center transition-opacity duration-700",
        phase === "exiting" && "opacity-0"
      )}
    >
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Animated gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a1a0a] via-black to-[#0a0a1a] animate-pulse" />
        
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(29, 185, 84, 0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(29, 185, 84, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: "50px 50px",
          }}
        />

        {/* Glowing orbs */}
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-[#1db954]/5 blur-[150px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-[#1db954]/3 blur-[120px] animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      {/* Content */}
      <div className="relative flex flex-col items-center gap-8">
        {/* Publisher logo */}
        <div className={cn(
          "text-xs tracking-[0.3em] text-white/30 uppercase transition-all duration-1000",
          phase === "loading" ? "opacity-100 translate-y-0" : "opacity-50"
        )}>
          JVN Studios Apresenta
        </div>

        {/* Main logo */}
        <div className={cn(
          "relative transition-all duration-700",
          phase === "loading" ? "scale-90 opacity-80" : "scale-100 opacity-100"
        )}>
          <div className="relative w-[300px] h-[120px] md:w-[400px] md:h-[160px]">
            <Image
              src="https://raw.githubusercontent.com/jovemegidio/Ultrafoot/main/Logo%20-%20UF26%20III.png"
              alt="Ultrafoot 26"
              fill
              className="object-contain"
              priority
              loading="eager"
            />
          </div>
          
          {/* Glow effect */}
          <div className="absolute inset-0 blur-xl opacity-50">
            <Image
              src="https://raw.githubusercontent.com/jovemegidio/Ultrafoot/main/Logo%20-%20UF26%20III.png"
              alt=""
              fill
              className="object-contain"
            />
          </div>
        </div>

        {/* Version badge */}
        <div className="flex items-center gap-3 text-xs text-white/40">
          <span className="px-2 py-0.5 rounded bg-[#1db954]/20 text-[#1db954] font-semibold">v1.0</span>
          <span>2026 Edition</span>
        </div>

        {/* Loading section */}
        <div className="w-[300px] md:w-[400px] mt-8">
          {phase === "loading" ? (
            <div className="space-y-3">
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#1db954] to-[#1ed760] transition-all duration-100"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-white/40">
                <span>Carregando...</span>
                <span>{Math.round(progress)}%</span>
              </div>
            </div>
          ) : (
            <div className={cn(
              "text-center transition-opacity duration-500",
              showPressStart ? "opacity-100" : "opacity-0"
            )}>
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-lg bg-white/5 border border-white/10">
                <span className="animate-pulse text-[#1db954]">●</span>
                <span className="text-sm text-white/80 tracking-wide">
                  Pressione qualquer tecla para continuar
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom info */}
        <div className="absolute -bottom-32 flex flex-col items-center gap-2 text-[10px] text-white/20">
          <div className="flex items-center gap-4">
            <span>Xbox</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span>PlayStation</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span>PC</span>
          </div>
          <span>&copy; 2026 JVN Studios. Todos os direitos reservados.</span>
        </div>
      </div>

      {/* Controller hints at bottom */}
      {phase === "ready" && (
        <div className="absolute bottom-8 flex items-center gap-6 text-[10px] text-white/30">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#1db954] flex items-center justify-center text-[8px] font-bold text-black">A</div>
            <span>Continuar</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded border border-white/30 flex items-center justify-center text-[8px] font-medium text-white/50">ESC</div>
            <span>Sair</span>
          </div>
        </div>
      )}

      {/* Decorative elements */}
      <div className="absolute top-8 left-8 text-[10px] text-white/10 font-mono">
        BUILD 2026.05.04
      </div>
      <div className="absolute top-8 right-8 text-[10px] text-white/10">
        Powered by Next.js
      </div>
    </div>
  )
}

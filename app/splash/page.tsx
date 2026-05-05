"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { cn } from "@/lib/utils"

// Fases da splash screen
type SplashPhase = 
  | "black" 
  | "studio-logo" 
  | "ea-warning" 
  | "loading" 
  | "title" 
  | "press-start"
  | "fade-out"

export default function SplashPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<SplashPhase>("black")
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [showPressStart, setShowPressStart] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  // Sequencia de fases da splash
  useEffect(() => {
    const sequence = async () => {
      // Fase 1: Tela preta inicial
      await delay(800)
      setPhase("studio-logo")
      
      // Fase 2: Logo do estudio
      await delay(2500)
      setPhase("ea-warning")
      
      // Fase 3: Aviso legal
      await delay(3000)
      setPhase("loading")
      
      // Fase 4: Tela de carregamento
      // Progresso simulado
      for (let i = 0; i <= 100; i += 2) {
        await delay(40)
        setLoadingProgress(i)
      }
      
      await delay(500)
      setPhase("title")
      
      // Fase 5: Titulo do jogo
      await delay(2000)
      setPhase("press-start")
      setShowPressStart(true)
    }
    
    sequence()
  }, [])

  // Handler para continuar
  const handleContinue = useCallback(() => {
    if (phase === "press-start" && !isExiting) {
      setIsExiting(true)
      setPhase("fade-out")
      setTimeout(() => {
        router.push("/")
      }, 1000)
    }
  }, [phase, isExiting, router])

  // Listeners para input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        handleContinue()
      }
    }

    const handleGamepadAction = (e: CustomEvent<{ action: string }>) => {
      if (e.detail.action === "A" || e.detail.action === "X") {
        handleContinue()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("gamepad:action", handleGamepadAction as EventListener)
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("gamepad:action", handleGamepadAction as EventListener)
    }
  }, [handleContinue])

  return (
    <div 
      className={cn(
        "fixed inset-0 bg-black flex items-center justify-center overflow-hidden transition-opacity duration-1000",
        isExiting && "opacity-0"
      )}
      onClick={handleContinue}
    >
      {/* Background elements */}
      <div className="absolute inset-0">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black via-[#050505] to-black" />
        
        {/* Animated particles */}
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-[#1db954]/20 rounded-full animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${5 + Math.random() * 10}s`,
              }}
            />
          ))}
        </div>

        {/* Scan lines effect */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              rgba(255, 255, 255, 0.03) 2px,
              rgba(255, 255, 255, 0.03) 4px
            )`,
          }}
        />
      </div>

      {/* Phase: Studio Logo */}
      <div className={cn(
        "absolute inset-0 flex flex-col items-center justify-center transition-all duration-1000",
        phase === "studio-logo" ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
      )}>
        <div className="relative">
          <div className="text-[#1db954] text-sm font-mono tracking-[0.5em] uppercase mb-4 animate-pulse">
            Egidio Studios
          </div>
          <div className="text-white/40 text-xs tracking-wider">
            Apresenta
          </div>
        </div>
      </div>

      {/* Phase: EA-style Warning */}
      <div className={cn(
        "absolute inset-0 flex items-center justify-center p-8 transition-all duration-1000",
        phase === "ea-warning" ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        <div className="max-w-2xl text-center">
          <div className="text-white/60 text-xs leading-relaxed space-y-4">
            <p>
              Este jogo e uma simulacao de gerenciamento de futebol. 
              Todos os nomes de times, jogadores e competicoes sao ficticios 
              ou usados apenas para fins de entretenimento.
            </p>
            <p className="text-white/40">
              Ultrafoot 26 - Todos os direitos reservados
            </p>
          </div>
        </div>
      </div>

      {/* Phase: Loading */}
      <div className={cn(
        "absolute inset-0 flex flex-col items-center justify-center transition-all duration-1000",
        phase === "loading" ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        <div className="w-full max-w-md px-8">
          {/* Loading tips */}
          <div className="text-center mb-8">
            <p className="text-white/40 text-xs">
              {loadingProgress < 30 && "Carregando dados dos times..."}
              {loadingProgress >= 30 && loadingProgress < 60 && "Preparando estatisticas..."}
              {loadingProgress >= 60 && loadingProgress < 90 && "Sincronizando temporada..."}
              {loadingProgress >= 90 && "Finalizando..."}
            </p>
          </div>

          {/* Progress bar */}
          <div className="relative h-1 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#1db954] to-[#1ed760] transition-all duration-100 ease-out"
              style={{ width: `${loadingProgress}%` }}
            />
            {/* Glow effect */}
            <div 
              className="absolute inset-y-0 left-0 bg-[#1db954]/50 blur-sm transition-all duration-100"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>

          {/* Percentage */}
          <div className="text-center mt-4">
            <span className="text-[#1db954] font-mono text-lg tabular-nums">
              {loadingProgress}%
            </span>
          </div>
        </div>
      </div>

      {/* Phase: Title */}
      <div className={cn(
        "absolute inset-0 flex flex-col items-center justify-center transition-all duration-1000",
        (phase === "title" || phase === "press-start") ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        {/* Main logo */}
        <div className="relative mb-8">
          {/* Glow behind logo */}
          <div className="absolute inset-0 blur-3xl bg-[#1db954]/20 scale-150" />
          
          {/* Logo */}
          <div className="relative w-64 h-64 md:w-80 md:h-80">
            <Image
              src="https://raw.githubusercontent.com/jovemegidio/Ultrafoot/main/Logo%20-%20UF26%20III.png"
              alt="Ultrafoot 26"
              fill
              className="object-contain drop-shadow-2xl animate-logo-float"
              priority
              unoptimized
            />
          </div>
        </div>

        {/* Game title text */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter">
            ULTRA<span className="text-[#1db954]">FOOT</span>
          </h1>
          <div className="text-white/40 text-sm tracking-[0.3em] mt-2">
            TEMPORADA 2026
          </div>
        </div>

        {/* Press Start */}
        <div className={cn(
          "transition-all duration-500",
          showPressStart ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}>
          <div className="flex flex-col items-center gap-4">
            {/* Controller button indicator - PlayStation */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#2e6db4] flex items-center justify-center text-white font-bold text-sm animate-pulse">
                X
              </div>
              <span className="text-white/60 text-sm">ou</span>
              <div className="px-3 py-1 rounded bg-white/10 text-white/60 text-xs font-mono">
                ENTER
              </div>
            </div>
            
            <p className="text-white/50 text-sm tracking-wider animate-blink">
              PRESSIONE PARA CONTINUAR
            </p>
          </div>
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-8 left-0 right-0 flex justify-between items-center px-8">
          <div className="text-white/20 text-[10px]">
            v1.0.0
          </div>
          <div className="text-white/20 text-[10px]">
            2026 Egidio Studios
          </div>
        </div>
      </div>

      {/* Vignette overlay */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, transparent 0%, transparent 50%, rgba(0,0,0,0.8) 100%)`,
        }}
      />
    </div>
  )
}

// Helper function
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

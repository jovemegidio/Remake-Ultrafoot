"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { Globe, Save, FileEdit, Trophy, X } from "lucide-react"

// Fases da splash screen
type SplashPhase = 
  | "black" 
  | "studio-logo" 
  | "ea-warning" 
  | "loading" 
  | "main-menu"
  | "fade-out"

type MenuOption = "novo-jogo" | "editar" | "carregar"

export default function SplashPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<SplashPhase>("black")
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isExiting, setIsExiting] = useState(false)

  const mainMenuOptions: { id: MenuOption; label: string; icon: React.ReactNode; href: string }[] = [
    { id: "novo-jogo", label: "NOVO JOGO", icon: <Globe className="h-7 w-7" strokeWidth={1.5} />, href: "/novo-jogo" },
    { id: "editar", label: "EDITOR DE CLUBES", icon: <FileEdit className="h-7 w-7" strokeWidth={1.5} />, href: "/editar" },
    { id: "carregar", label: "CARREGAR JOGO", icon: <Save className="h-7 w-7" strokeWidth={1.5} />, href: "/dashboard" },
  ]

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
      for (let i = 0; i <= 100; i += 2) {
        await delay(40)
        setLoadingProgress(i)
      }
      
      await delay(500)
      setPhase("main-menu")
    }
    
    sequence()
  }, [])

  // Handler para navegacao no menu
  const handleMenuSelect = useCallback((index: number) => {
    const menuOption = mainMenuOptions[index]
    if (menuOption?.href && !isExiting) {
      setIsExiting(true)
      setPhase("fade-out")
      setTimeout(() => {
        router.push(menuOption.href)
      }, 400)
    }
  }, [isExiting, router, mainMenuOptions])

  // Navegacao por teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (phase !== "main-menu") return

      if (e.key === "ArrowLeft") {
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : mainMenuOptions.length - 1)
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        setSelectedIndex(prev => prev < mainMenuOptions.length - 1 ? prev + 1 : 0)
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        handleMenuSelect(selectedIndex)
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault()
        // Registrar action - pode abrir modal
      } else if (e.key === "Escape" || e.key === "x" || e.key === "X") {
        e.preventDefault()
        // Sair action
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [phase, selectedIndex, handleMenuSelect, mainMenuOptions])

  return (
    <div 
      className={cn(
        "fixed inset-0 flex flex-col overflow-hidden transition-opacity duration-400",
        isExiting && "opacity-0"
      )}
      style={{
        background: "linear-gradient(180deg, #1f1f1f 0%, #171717 50%, #1a1a1a 100%)"
      }}
    >
      {/* Phase: Black screen */}
      <div className={cn(
        "absolute inset-0 bg-black transition-opacity duration-1000",
        phase === "black" ? "opacity-100" : "opacity-0 pointer-events-none"
      )} />

      {/* Phase: Studio Logo - Agencia do Japa */}
      <div className={cn(
        "absolute inset-0 flex flex-col items-center justify-center transition-all duration-1000 bg-black overflow-hidden",
        phase === "studio-logo" ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        {/* Subtle ambient particles */}
        <div className="absolute inset-0 overflow-hidden">
          {phase === "studio-logo" && [...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-0.5 h-0.5 bg-white/5 rounded-full"
              style={{
                left: `${15 + i * 15}%`,
                top: `${30 + (i % 2) * 40}%`,
                animation: `float ${5 + i * 0.5}s ease-in-out infinite`,
                animationDelay: `${i * 0.4}s`,
              }}
            />
          ))}
        </div>

        {/* Main content container */}
        <div 
          className="relative flex flex-col items-center"
          style={{
            animation: phase === "studio-logo" ? "studioFadeIn 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards" : "none",
          }}
        >
          {/* Soft glow behind logo */}
          <div 
            className="absolute -inset-20 opacity-20"
            style={{
              background: "radial-gradient(ellipse at center, rgba(34, 197, 94, 0.3) 0%, transparent 60%)",
              animation: phase === "studio-logo" ? "glowPulse 3s ease-in-out infinite" : "none",
            }}
          />
          
          {/* Logo with animation */}
          <div 
            className="relative"
            style={{
              animation: phase === "studio-logo" ? "logoSlideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards" : "none",
              opacity: 0,
            }}
          >
            <Image
              src="/images/agencia-do-japa-logo.png"
              alt="Agencia do Japa"
              width={400}
              height={200}
              className="object-contain h-auto w-auto max-w-[80vw]"
              style={{
                filter: "drop-shadow(0 0 40px rgba(34, 197, 94, 0.15))",
              }}
              priority
            />
          </div>
          
          {/* "Apresenta" text with delayed animation */}
          <div 
            className="mt-8"
            style={{
              animation: phase === "studio-logo" ? "apresentaFadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.8s forwards" : "none",
              opacity: 0,
            }}
          >
            <span 
              className="text-white/40 text-sm tracking-[0.3em] uppercase font-light"
              style={{
                textShadow: "0 0 20px rgba(255, 255, 255, 0.1)",
              }}
            >
              Apresenta
            </span>
          </div>
        </div>

        {/* Bottom gradient fade */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
          style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 100%)",
          }}
        />
      </div>

      {/* Phase: Warning */}
      <div className={cn(
        "absolute inset-0 flex items-center justify-center p-8 transition-all duration-1000 bg-black",
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
        "absolute inset-0 flex flex-col items-center justify-center transition-all duration-1000 bg-black overflow-hidden",
        phase === "loading" ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        {/* Animated background particles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-cyan-500/30 rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 3}s`,
              }}
            />
          ))}
        </div>

        {/* Radial glow behind logo */}
        <div 
          className="absolute w-[500px] h-[500px] rounded-full opacity-20 animate-pulse"
          style={{
            background: "radial-gradient(circle, rgba(6, 182, 212, 0.4) 0%, transparent 70%)",
            animationDuration: "3s",
          }}
        />

        <div className="w-full max-w-md px-8 relative z-10">
          {/* Logo ULTRAFOOT with animation */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              {/* Glow effect */}
              <div 
                className="absolute inset-0 blur-xl opacity-50 animate-pulse"
                style={{
                  background: "linear-gradient(90deg, transparent, rgba(6, 182, 212, 0.5), transparent)",
                  animationDuration: "2s",
                }}
              />
              <Image
                src="/brand/ultrafoot-text.png"
                alt="Ultrafoot"
                width={280}
                height={60}
                className="object-contain h-auto w-auto relative z-10 animate-[pulse_3s_ease-in-out_infinite]"
                style={{
                  filter: "drop-shadow(0 0 20px rgba(6, 182, 212, 0.3))",
                }}
                priority
              />
            </div>
          </div>

          {/* Loading status text with fade animation */}
          <div className="text-center mb-4 h-5 overflow-hidden">
            <p 
              key={loadingProgress < 30 ? "1" : loadingProgress < 60 ? "2" : loadingProgress < 90 ? "3" : "4"}
              className="text-white/40 text-xs animate-[fadeIn_0.5s_ease-out]"
            >
              {loadingProgress < 30 && "Carregando dados dos times..."}
              {loadingProgress >= 30 && loadingProgress < 60 && "Preparando estatisticas..."}
              {loadingProgress >= 60 && loadingProgress < 90 && "Sincronizando temporada..."}
              {loadingProgress >= 90 && "Finalizando..."}
            </p>
          </div>

          {/* Progress bar with shimmer effect */}
          <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden">
            {/* Progress fill */}
            <div 
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-400 transition-all duration-100 ease-out rounded-full"
              style={{ width: `${loadingProgress}%` }}
            />
            {/* Shimmer overlay */}
            <div 
              className="absolute inset-y-0 left-0 overflow-hidden rounded-full"
              style={{ width: `${loadingProgress}%` }}
            >
              <div 
                className="absolute inset-0 animate-[shimmer_1.5s_infinite]"
                style={{
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
                  transform: "translateX(-100%)",
                }}
              />
            </div>
            {/* Glow at the end */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-cyan-400 blur-md animate-pulse"
              style={{ 
                left: `calc(${loadingProgress}% - 8px)`,
                opacity: loadingProgress > 0 ? 1 : 0,
              }}
            />
          </div>

          {/* Percentage with animation */}
          <div className="text-center mt-4">
            <span 
              className="text-cyan-400 font-mono text-lg tabular-nums inline-block"
              style={{
                textShadow: "0 0 20px rgba(6, 182, 212, 0.5)",
              }}
            >
              {loadingProgress}%
            </span>
          </div>

          {/* Loading dots */}
          <div className="flex justify-center gap-1 mt-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 bg-cyan-500/50 rounded-full animate-bounce"
                style={{
                  animationDelay: `${i * 0.15}s`,
                  animationDuration: "0.8s",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Phase: Main Menu - EAFC Style */}
      <div className={cn(
        "absolute inset-0 flex flex-col transition-all duration-700",
        phase === "main-menu" ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        
        {/* Animated background gradient */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            background: "radial-gradient(ellipse at 50% 0%, rgba(102, 126, 234, 0.15) 0%, transparent 50%)",
          }}
        />
        
        {/* Subtle moving particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {phase === "main-menu" && [...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white/10 rounded-full"
              style={{
                left: `${10 + i * 12}%`,
                top: `${20 + (i % 3) * 25}%`,
                animation: `float ${4 + i * 0.5}s ease-in-out infinite`,
                animationDelay: `${i * 0.3}s`,
              }}
            />
          ))}
        </div>

        {/* Header with UF26 logo */}
        <div 
          className="flex flex-col items-center pt-16 pb-6"
          style={{
            animation: phase === "main-menu" ? "slideDown 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards" : "none",
          }}
        >
          {/* Logo container with gradient background */}
          <div className="relative mb-4 group">
            {/* Glow effect behind logo */}
            <div 
              className="absolute -inset-4 rounded-3xl opacity-60 blur-2xl transition-opacity duration-500"
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f64f59 100%)",
              }}
            />
            <div 
              className="relative w-32 h-32 rounded-2xl flex items-center justify-center overflow-hidden shadow-2xl transition-transform duration-300 hover:scale-105"
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f64f59 100%)"
              }}
            >
              {/* Shimmer overlay */}
              <div 
                className="absolute inset-0 opacity-30"
                style={{
                  background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.4) 50%, transparent 60%)",
                  animation: "shimmerSlow 3s infinite",
                }}
              />
              <Image
                src="/brand/ultrafoot-text.png"
                alt="UF26"
                width={90}
                height={45}
                className="object-contain brightness-0 invert h-auto w-auto relative z-10"
                priority
              />
            </div>
          </div>
          
          {/* Version warning with pulse */}
          <span 
            className="text-red-500 text-sm font-medium tracking-wide"
            style={{
              animation: "pulse 2s ease-in-out infinite",
              textShadow: "0 0 20px rgba(239, 68, 68, 0.3)",
            }}
          >
            versao nao registrada
          </span>
        </div>

        {/* Main menu options - horizontal row */}
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="flex items-center justify-center gap-6 md:gap-10">
            {mainMenuOptions.map((option, index) => {
              const isSelected = selectedIndex === index
              return (
                <button
                  key={option.id}
                  onClick={() => handleMenuSelect(index)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className="relative flex flex-col items-center gap-5 px-4 py-4 rounded-2xl transition-all duration-300"
                  style={{
                    animation: phase === "main-menu" ? `slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${0.1 + index * 0.1}s forwards` : "none",
                    opacity: 0,
                  }}
                >
                  {/* Selection glow background */}
                  <div 
                    className={cn(
                      "absolute inset-0 rounded-2xl transition-all duration-400",
                      isSelected ? "opacity-100" : "opacity-0"
                    )}
                    style={{
                      background: "radial-gradient(ellipse at center, rgba(255,255,255,0.06) 0%, transparent 70%)",
                    }}
                  />
                  
                  {/* Icon container */}
                  <div className="relative">
                    {/* Glow effect for selected */}
                    <div 
                      className={cn(
                        "absolute -inset-2 rounded-2xl blur-xl transition-all duration-400",
                        isSelected ? "opacity-40" : "opacity-0"
                      )}
                      style={{
                        background: "linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(150,150,150,0.2) 100%)",
                      }}
                    />
                    <div className={cn(
                      "relative w-20 h-20 md:w-24 md:h-24 rounded-xl flex items-center justify-center transition-all duration-300 border",
                      isSelected 
                        ? "bg-gradient-to-br from-gray-400/40 to-gray-600/50 border-white/40 scale-105 shadow-lg" 
                        : "bg-gradient-to-br from-gray-700/30 to-gray-800/40 border-white/10 hover:border-white/20"
                    )}
                    style={{
                      boxShadow: isSelected ? "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)" : "none",
                    }}
                    >
                      <div className={cn(
                        "transition-all duration-300",
                        isSelected ? "text-white scale-110" : "text-white/40"
                      )}>
                        {option.icon}
                      </div>
                    </div>
                  </div>
                  
                  {/* Label */}
                  <span className={cn(
                    "font-bold text-xs md:text-sm tracking-wide transition-all duration-300 whitespace-nowrap",
                    isSelected ? "text-white" : "text-white/35"
                  )}>
                    {option.label}
                  </span>
                  
                  {/* Selection indicator line */}
                  <div 
                    className={cn(
                      "absolute -bottom-1 left-1/2 -translate-x-1/2 h-0.5 bg-gradient-to-r from-transparent via-white/60 to-transparent rounded-full transition-all duration-300",
                      isSelected ? "w-16 opacity-100" : "w-0 opacity-0"
                    )}
                  />
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div 
          className="flex items-center justify-between px-6 md:px-8 pb-6 md:pb-8 pt-4"
          style={{
            animation: phase === "main-menu" ? "slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.5s forwards" : "none",
            opacity: 0,
          }}
        >
          {/* Registrar button */}
          <button
            className="flex items-center gap-3 px-4 py-2 text-white/40 hover:text-white/80 transition-all duration-300 group"
          >
            <div className="w-8 h-8 rounded-full border border-current flex items-center justify-center transition-all duration-300 group-hover:border-white/60 group-hover:bg-white/5">
              <span className="font-bold text-xs">R</span>
            </div>
            <span className="font-medium text-sm tracking-wide hidden sm:block">REGISTRAR JOGO</span>
          </button>

          {/* Center - Navigation hints + Trophy */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-3 text-xs text-white/25">
              <span className="hidden md:inline">Use as setas para navegar</span>
              <span className="hidden md:inline text-white/10">|</span>
              <span>Enter para selecionar</span>
            </div>
            <div className="flex items-center gap-2 group cursor-pointer">
              <Trophy 
                className="h-6 w-6 text-yellow-500/60 transition-all duration-300 group-hover:text-yellow-400 group-hover:scale-110" 
                style={{
                  filter: "drop-shadow(0 0 8px rgba(234, 179, 8, 0.3))",
                }}
              />
              <div className="text-center">
                <div className="text-white/40 text-xs font-medium group-hover:text-white/60 transition-colors">ULTRAFOOT 26</div>
                <div className="text-white/20 text-[10px]">Enter para selecionar</div>
              </div>
            </div>
          </div>

          {/* Sair button */}
          <button
            className="flex items-center gap-2 px-4 py-2 text-white/40 hover:text-red-400/80 transition-all duration-300 group"
          >
            <X className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
            <span className="font-medium text-sm tracking-wide hidden sm:block">SAIR</span>
          </button>
        </div>
      </div>

      {/* Vignette overlay */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, transparent 0%, transparent 60%, rgba(0,0,0,0.4) 100%)`,
        }}
      />
    </div>
  )
}

// Helper function
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

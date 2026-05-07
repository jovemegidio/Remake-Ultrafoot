"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { Globe, Save, FileEdit, Trophy, X, Key, CheckCircle2, AlertCircle, Clock, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

// Fases da splash screen
type SplashPhase = 
  | "black" 
  | "studio-logo" 
  | "ea-warning" 
  | "leagues"
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
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [serialKey, setSerialKey] = useState("")
  const [isRegistered, setIsRegistered] = useState(false)
  const [registerError, setRegisterError] = useState("")
  const [isValidating, setIsValidating] = useState(false)
  const [selectedSaveIndex, setSelectedSaveIndex] = useState(0)

  // Mock saved games data
  const savedGames = [
    { id: 1, teamName: "Flamengo", season: "2025/26", date: "05/07/2026", position: "1º lugar", competition: "Serie A" },
    { id: 2, teamName: "Palmeiras", season: "2024/25", date: "28/06/2026", position: "3º lugar", competition: "Serie A" },
    { id: 3, teamName: "Santos", season: "2025/26", date: "15/06/2026", position: "8º lugar", competition: "Serie A" },
  ]

  const mainMenuOptions: { id: MenuOption; label: string; icon: React.ReactNode; href?: string }[] = [
    { id: "novo-jogo", label: "NOVO JOGO", icon: <Globe className="h-7 w-7" strokeWidth={1.5} />, href: "/novo-jogo" },
    { id: "editar", label: "EDITOR DE CLUBES", icon: <FileEdit className="h-7 w-7" strokeWidth={1.5} />, href: "/editar" },
    { id: "carregar", label: "CARREGAR JOGO", icon: <Save className="h-7 w-7" strokeWidth={1.5} /> },
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
      setPhase("leagues")
      
      // Fase 4: Logos das ligas e competicoes
      await delay(3500)
      setPhase("loading")
      
      // Fase 5: Tela de carregamento
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
    if (isExiting) return
    
    // Se for carregar jogo, mostra o modal de saves
    if (menuOption?.id === "carregar") {
      setShowLoadModal(true)
      return
    }
    
    if (menuOption?.href) {
      setIsExiting(true)
      setPhase("fade-out")
      setTimeout(() => {
        router.push(menuOption.href)
      }, 400)
    }
  }, [isExiting, router, mainMenuOptions])

  // Handler para carregar save
  const handleLoadSave = useCallback((saveId: number) => {
    setIsExiting(true)
    setPhase("fade-out")
    setTimeout(() => {
      router.push(`/dashboard?save=${saveId}`)
    }, 400)
  }, [router])

  // Funcao para validar e registrar o jogo
  const handleRegister = useCallback(async () => {
    setRegisterError("")
    setIsValidating(true)
    
    // Simula validacao da chave (em producao, seria uma API call)
    await delay(1500)
    
    // Chave de exemplo valida: ULTRA-FOOT-2026-XXXX
    const validKeyPattern = /^ULTRA-FOOT-2026-[A-Z0-9]{4}$/
    
    if (validKeyPattern.test(serialKey.toUpperCase())) {
      setIsRegistered(true)
      setIsValidating(false)
      // Fecha o modal apos 2 segundos de sucesso
      setTimeout(() => {
        setShowRegisterModal(false)
      }, 2000)
    } else {
      setRegisterError("Chave de serial invalida. Verifique e tente novamente.")
      setIsValidating(false)
    }
  }, [serialKey])

  // Navegacao por teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showRegisterModal) {
        if (e.key === "Escape") {
          setShowRegisterModal(false)
        }
        return
      }
      
      if (showLoadModal) {
        if (e.key === "Escape") {
          setShowLoadModal(false)
        } else if (e.key === "ArrowUp") {
          e.preventDefault()
          setSelectedSaveIndex(prev => prev > 0 ? prev - 1 : savedGames.length - 1)
        } else if (e.key === "ArrowDown") {
          e.preventDefault()
          setSelectedSaveIndex(prev => prev < savedGames.length - 1 ? prev + 1 : 0)
        } else if (e.key === "Enter") {
          e.preventDefault()
          handleLoadSave(savedGames[selectedSaveIndex].id)
        }
        return
      }
      
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
        if (!isRegistered) {
          setShowRegisterModal(true)
        }
      } else if (e.key === "Escape" || e.key === "x" || e.key === "X") {
        e.preventDefault()
        // Sair action
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [phase, selectedIndex, handleMenuSelect, mainMenuOptions, showRegisterModal, showLoadModal, isRegistered, selectedSaveIndex, savedGames, handleLoadSave])

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
            className="absolute -inset-20 opacity-10"
            style={{
              background: "radial-gradient(ellipse at center, rgba(255, 255, 255, 0.15) 0%, transparent 60%)",
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
              width={180}
              height={90}
              className="object-contain h-auto w-auto max-w-[45vw]"
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

      {/* Phase: Leagues - Logos das ligas e competicoes */}
      <div className={cn(
        "absolute inset-0 flex flex-col items-center justify-center transition-all duration-1000 bg-black overflow-hidden",
        phase === "leagues" ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        {/* Gradient overlay top */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.6) 100%)",
          }}
        />
        
        {/* Leagues logos image */}
        <div 
          className="relative w-full max-w-4xl px-8"
          style={{
            animation: phase === "leagues" ? "leaguesFadeIn 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards" : "none",
          }}
        >
          <Image
            src="/images/leagues-logos.png"
            alt="Ligas e Competicoes"
            width={1200}
            height={600}
            className="w-full h-auto object-contain opacity-90"
            priority
          />
        </div>
        
        {/* Text overlay */}
        <div 
          className="absolute bottom-16 left-0 right-0 text-center"
          style={{
            animation: phase === "leagues" ? "fadeIn 1s ease-out 0.5s forwards" : "none",
            opacity: 0,
          }}
        >
          <span className="text-white/40 text-xs tracking-[0.3em] uppercase">
            Ligas Licenciadas
          </span>
        </div>
      </div>

      {/* Phase: Loading */}
      <div className={cn(
        "absolute inset-0 flex flex-col items-center justify-center transition-all duration-1000 bg-black overflow-hidden",
        phase === "loading" ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
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
        
        {/* Subtle top gradient - EAFC style */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            background: "radial-gradient(ellipse at 50% 0%, rgba(102, 126, 234, 0.1) 0%, transparent 40%)",
          }}
        />
        
        {/* Minimal ambient dots */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {phase === "main-menu" && [...Array(4)].map((_, i) => (
            <div
              key={i}
              className="absolute w-0.5 h-0.5 bg-white/5 rounded-full"
              style={{
                left: `${15 + i * 20}%`,
                top: `${25 + (i % 2) * 30}%`,
                animation: `float ${6 + i}s ease-in-out infinite`,
                animationDelay: `${i * 0.5}s`,
              }}
            />
          ))}
        </div>

        {/* Header with UF26 logo - Compact */}
        <div 
          className="flex flex-col items-center pt-10 md:pt-14 lg:pt-16 pb-2"
          style={{
            animation: phase === "main-menu" ? "slideDown 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards" : "none",
          }}
        >
          {/* Logo container with gradient background - EAFC Style */}
          <div className="relative mb-4 group">
            {/* Subtle glow effect */}
            <div 
              className="absolute -inset-2 rounded-xl opacity-30 blur-lg transition-opacity duration-500"
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              }}
            />
            <div 
              className="relative w-16 h-16 md:w-18 md:h-18 lg:w-20 lg:h-20 rounded-lg md:rounded-xl flex items-center justify-center overflow-hidden shadow-xl transition-transform duration-300 hover:scale-105"
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f64f59 100%)"
              }}
            >
              {/* Subtle shimmer overlay */}
              <div 
                className="absolute inset-0 opacity-20"
                style={{
                  background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.3) 50%, transparent 60%)",
                  animation: "shimmerSlow 4s infinite",
                }}
              />
              <Image
                src="/brand/uf26-logo.png"
                alt="UF26"
                width={48}
                height={24}
                className="object-contain h-auto w-auto max-w-[38px] md:max-w-[44px] lg:max-w-[48px] relative z-10"
                priority
              />
            </div>
          </div>
          
          {/* Version warning - minimal style */}
          {!isRegistered ? (
            <span className="text-amber-500/70 text-[10px] font-medium tracking-widest uppercase">
              versao nao registrada
            </span>
          ) : (
            <span className="text-emerald-500/70 text-[10px] font-medium tracking-widest uppercase flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3" />
              registrado
            </span>
          )}
        </div>

        {/* Main menu options - horizontal row */}
        <div className="flex-1 flex items-center justify-center px-4 sm:px-6 md:px-8">
          <div className="flex items-center justify-center gap-3 sm:gap-4 md:gap-6 lg:gap-10">
            {mainMenuOptions.map((option, index) => {
              const isSelected = selectedIndex === index
              return (
                <button
                  key={option.id}
                  onClick={() => handleMenuSelect(index)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className="relative flex flex-col items-center gap-3 sm:gap-4 md:gap-5 px-2 sm:px-3 md:px-4 py-3 md:py-4 rounded-xl md:rounded-2xl transition-all duration-300"
                  style={{
                    animation: phase === "main-menu" ? `slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${0.1 + index * 0.1}s forwards` : "none",
                    opacity: 0,
                  }}
                >
                  {/* Minimal selection background */}
                  <div 
                    className={cn(
                      "absolute inset-0 rounded-xl transition-all duration-300",
                      isSelected ? "opacity-100" : "opacity-0"
                    )}
                    style={{
                      background: "radial-gradient(ellipse at center, rgba(255,255,255,0.03) 0%, transparent 60%)",
                    }}
                  />
                  
                  {/* Icon container */}
                  <div className="relative">
                    <div className={cn(
                      "relative w-14 h-14 sm:w-16 sm:h-16 md:w-18 md:h-18 lg:w-20 lg:h-20 rounded-lg md:rounded-xl flex items-center justify-center transition-all duration-300 border",
                      isSelected 
                        ? "bg-gradient-to-br from-white/15 to-white/5 border-white/30 scale-105" 
                        : "bg-gradient-to-br from-white/5 to-transparent border-white/10 hover:border-white/15"
                    )}
                    style={{
                      boxShadow: isSelected ? "0 4px 20px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)" : "none",
                    }}
                    >
                      <div className={cn(
                        "transition-all duration-300 [&>svg]:h-5 [&>svg]:w-5 sm:[&>svg]:h-5 sm:[&>svg]:w-5 md:[&>svg]:h-6 md:[&>svg]:w-6",
                        isSelected ? "text-white" : "text-white/35"
                      )}>
                        {option.icon}
                      </div>
                    </div>
                  </div>
                  
                  {/* Label */}
                  <span className={cn(
                    "font-bold text-[10px] sm:text-xs md:text-sm tracking-wide transition-all duration-300 whitespace-nowrap",
                    isSelected ? "text-white" : "text-white/35"
                  )}>
                    {option.label}
                  </span>
                  
                  {/* Selection indicator line */}
                  <div 
                    className={cn(
                      "absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-[2px] bg-white/50 rounded-full transition-all duration-300",
                      isSelected ? "w-10 opacity-100" : "w-0 opacity-0"
                    )}
                  />
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div 
          className="flex items-center justify-between px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 md:pb-8 pt-2"
          style={{
            animation: phase === "main-menu" ? "slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.5s forwards" : "none",
            opacity: 0,
          }}
        >
          {/* Registrar button */}
          <button
            onClick={() => !isRegistered && setShowRegisterModal(true)}
            className={cn(
              "flex items-center gap-2 px-2 sm:px-4 py-2 transition-all duration-300 group",
              isRegistered 
                ? "text-emerald-500/60 cursor-default" 
                : "text-white/40 hover:text-white/80"
            )}
          >
            <div className={cn(
              "w-7 h-7 sm:w-8 sm:h-8 rounded-full border flex items-center justify-center transition-all duration-300",
              isRegistered 
                ? "border-emerald-500/40 bg-emerald-500/10" 
                : "border-current group-hover:border-white/60 group-hover:bg-white/5"
            )}>
              {isRegistered ? (
                <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              ) : (
                <span className="font-bold text-[10px] sm:text-xs">R</span>
              )}
            </div>
            <span className="font-medium text-xs sm:text-sm tracking-wide hidden sm:block">
              {isRegistered ? "REGISTRADO" : "REGISTRAR"}
            </span>
          </button>

          {/* Center - Navigation hints + Trophy */}
          <div className="flex flex-col items-center gap-1">
            <div className="hidden sm:flex items-center gap-3 text-[10px] sm:text-xs text-white/25">
              <span className="hidden md:inline">Use as setas para navegar</span>
              <span className="hidden md:inline text-white/10">|</span>
              <span>Enter para selecionar</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 group cursor-pointer">
              <Trophy 
                className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-500/60 transition-all duration-300 group-hover:text-yellow-400 group-hover:scale-110" 
                style={{
                  filter: "drop-shadow(0 0 8px rgba(234, 179, 8, 0.3))",
                }}
              />
              <div className="text-center">
                <div className="text-white/40 text-[10px] sm:text-xs font-medium group-hover:text-white/60 transition-colors">ULTRAFOOT 26</div>
              </div>
            </div>
          </div>

          {/* Sair button */}
          <button
            className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 text-white/40 hover:text-red-400/80 transition-all duration-300 group"
          >
            <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform duration-300 group-hover:rotate-90" />
            <span className="font-medium text-xs sm:text-sm tracking-wide hidden sm:block">SAIR</span>
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

      {/* Modal de Registro */}
      <Dialog open={showRegisterModal} onOpenChange={setShowRegisterModal}>
        <DialogContent 
          className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 border-white/10 text-white max-w-md"
          showCloseButton={!isValidating}
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f64f59 100%)"
                }}
              >
                <Key className="h-5 w-5 text-white" />
              </div>
              Registrar Ultrafoot 26
            </DialogTitle>
            <DialogDescription className="text-white/50">
              Insira sua chave de serial para desbloquear todos os recursos do jogo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-4">
            {/* Input da chave serial */}
            <div className="space-y-2">
              <label className="text-sm text-white/60 font-medium">
                Chave de Serial
              </label>
              <input
                type="text"
                value={serialKey}
                onChange={(e) => {
                  setSerialKey(e.target.value.toUpperCase())
                  setRegisterError("")
                }}
                placeholder="ULTRA-FOOT-2026-XXXX"
                disabled={isValidating || isRegistered}
                className={cn(
                  "w-full px-4 py-3 bg-black/40 border rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 transition-all duration-300 font-mono tracking-wider",
                  registerError 
                    ? "border-red-500/50 focus:ring-red-500/30" 
                    : "border-white/10 focus:ring-white/20 focus:border-white/30"
                )}
              />
              
              {/* Mensagem de erro */}
              {registerError && (
                <div className="flex items-center gap-2 text-red-400 text-sm animate-[fadeIn_0.3s_ease-out]">
                  <AlertCircle className="h-4 w-4" />
                  {registerError}
                </div>
              )}
            </div>

            {/* Botao de registro */}
            <button
              onClick={handleRegister}
              disabled={!serialKey.trim() || isValidating || isRegistered}
              className={cn(
                "w-full py-3.5 rounded-xl font-semibold text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-2",
                isRegistered
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : !serialKey.trim() || isValidating
                    ? "bg-white/5 text-white/30 cursor-not-allowed"
                    : "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white hover:opacity-90 hover:scale-[1.02]"
              )}
            >
              {isValidating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Validando...
                </>
              ) : isRegistered ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Jogo Registrado com Sucesso!
                </>
              ) : (
                "Ativar Jogo"
              )}
            </button>

            {/* Dica */}
            <p className="text-center text-white/30 text-xs">
              Nao possui uma chave? Entre em contato com o suporte.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Carregar Jogo */}
      <Dialog open={showLoadModal} onOpenChange={setShowLoadModal}>
        <DialogContent 
          className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 border-white/10 text-white max-w-lg"
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-cyan-500 to-blue-600"
              >
                <Save className="h-5 w-5 text-white" />
              </div>
              Carregar Jogo
            </DialogTitle>
            <DialogDescription className="text-white/50">
              Selecione um save para continuar sua carreira.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-4">
            {savedGames.length === 0 ? (
              <div className="text-center py-8 text-white/40">
                <Save className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum save encontrado.</p>
                <p className="text-sm mt-1">Comece um novo jogo para criar seu primeiro save.</p>
              </div>
            ) : (
              savedGames.map((save, index) => (
                <button
                  key={save.id}
                  onClick={() => handleLoadSave(save.id)}
                  onMouseEnter={() => setSelectedSaveIndex(index)}
                  className={cn(
                    "w-full p-4 rounded-xl border transition-all duration-200 text-left",
                    selectedSaveIndex === index
                      ? "bg-gradient-to-r from-cyan-500/20 via-blue-500/10 to-transparent border-cyan-500/40"
                      : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                        <span className="text-lg font-bold text-white/80">{save.teamName.charAt(0)}</span>
                      </div>
                      <div>
                        <div className="font-semibold text-white">{save.teamName}</div>
                        <div className="text-xs text-white/50">{save.competition} - {save.position}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-white/60">{save.season}</div>
                      <div className="text-xs text-white/30 flex items-center gap-1 justify-end">
                        <Clock className="h-3 w-3" />
                        {save.date}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {savedGames.length > 0 && (
            <div className="flex items-center justify-between pt-4 border-t border-white/10 mt-4">
              <div className="text-xs text-white/30">
                Use as setas para navegar, Enter para selecionar
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400/60 hover:text-red-400 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
                Gerenciar Saves
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Helper function
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

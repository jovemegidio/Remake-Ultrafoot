"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Globe, Save, FileEdit, KeyRound, X, Trophy } from "lucide-react"

// Fases da splash screen
type SplashPhase = 
  | "black" 
  | "studio-logo" 
  | "ea-warning" 
  | "loading" 
  | "main-menu"
  | "fade-out"

type MenuOption = "novo-jogo" | "carregar" | "editar" | "registrar" | "sair"

export default function SplashPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<SplashPhase>("black")
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [selectedOption, setSelectedOption] = useState<MenuOption>("novo-jogo")
  const [isExiting, setIsExiting] = useState(false)

  const menuOptions: { id: MenuOption; label: string; icon: React.ReactNode; href?: string }[] = [
    { id: "novo-jogo", label: "NOVO JOGO", icon: <Globe className="h-8 w-8" />, href: "/novo-jogo" },
    { id: "carregar", label: "CARREGAR", icon: <Save className="h-8 w-8" />, href: "/" },
    { id: "editar", label: "EDITAR", icon: <FileEdit className="h-8 w-8" />, href: "/editar" },
    { id: "registrar", label: "REGISTRAR JOGO", icon: <KeyRound className="h-8 w-8" /> },
    { id: "sair", label: "SAIR", icon: <X className="h-8 w-8" /> },
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
  const handleMenuSelect = useCallback(() => {
    const option = menuOptions.find(o => o.id === selectedOption)
    if (option?.href && !isExiting) {
      setIsExiting(true)
      setPhase("fade-out")
      setTimeout(() => {
        router.push(option.href!)
      }, 500)
    }
  }, [selectedOption, isExiting, router, menuOptions])

  // Navegacao por teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (phase !== "main-menu") return

      const currentIndex = menuOptions.findIndex(o => o.id === selectedOption)
      
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault()
        const newIndex = currentIndex > 0 ? currentIndex - 1 : menuOptions.length - 1
        setSelectedOption(menuOptions[newIndex].id)
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault()
        const newIndex = currentIndex < menuOptions.length - 1 ? currentIndex + 1 : 0
        setSelectedOption(menuOptions[newIndex].id)
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        handleMenuSelect()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [phase, selectedOption, handleMenuSelect, menuOptions])

  return (
    <div 
      className={cn(
        "fixed inset-0 min-w-[1280px] flex items-center justify-center overflow-hidden transition-opacity duration-500",
        isExiting && "opacity-0"
      )}
      style={{
        background: "linear-gradient(135deg, #2a2a2a 0%, #3d3d3d 25%, #4a4a4a 50%, #3d3d3d 75%, #2a2a2a 100%)"
      }}
    >
      {/* Scan lines effect */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, 0.1) 2px,
            rgba(0, 0, 0, 0.1) 4px
          )`,
        }}
      />

      {/* Phase: Studio Logo */}
      <div className={cn(
        "absolute inset-0 flex flex-col items-center justify-center transition-all duration-1000 bg-black",
        phase === "studio-logo" ? "opacity-100" : "opacity-0 pointer-events-none"
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
        "absolute inset-0 flex flex-col items-center justify-center transition-all duration-1000 bg-black",
        phase === "loading" ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        <div className="w-full max-w-md px-8">
          <div className="text-center mb-8">
            <p className="text-white/40 text-xs">
              {loadingProgress < 30 && "Carregando dados dos times..."}
              {loadingProgress >= 30 && loadingProgress < 60 && "Preparando estatisticas..."}
              {loadingProgress >= 60 && loadingProgress < 90 && "Sincronizando temporada..."}
              {loadingProgress >= 90 && "Finalizando..."}
            </p>
          </div>

          <div className="relative h-1 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#1db954] to-[#1ed760] transition-all duration-100 ease-out"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>

          <div className="text-center mt-4">
            <span className="text-[#1db954] font-mono text-lg tabular-nums">
              {loadingProgress}%
            </span>
          </div>
        </div>
      </div>

      {/* Phase: Main Menu - Brasfoot Style */}
      <div className={cn(
        "absolute inset-0 flex flex-col transition-all duration-500",
        phase === "main-menu" ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        {/* Header with game title */}
        <div className="flex justify-center pt-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight italic">
              ULTRAFOOT
            </h1>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="text-2xl md:text-3xl font-black text-white/80">26-27</span>
              <span className="text-xs text-red-400 font-medium">versao nao registrada</span>
            </div>
          </div>
        </div>

        {/* Main menu grid */}
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="grid grid-cols-3 gap-8 max-w-3xl w-full">
            {/* Top row - Main options */}
            {menuOptions.slice(0, 3).map((option) => (
              <MenuButton
                key={option.id}
                option={option}
                selected={selectedOption === option.id}
                onClick={() => {
                  setSelectedOption(option.id)
                  if (option.href) {
                    setIsExiting(true)
                    setPhase("fade-out")
                    setTimeout(() => router.push(option.href!), 500)
                  }
                }}
                onMouseEnter={() => setSelectedOption(option.id)}
              />
            ))}
          </div>
        </div>

        {/* Bottom row - Secondary options */}
        <div className="flex items-center justify-between px-12 pb-8">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedOption("registrar")
              }}
              onMouseEnter={() => setSelectedOption("registrar")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded transition-colors",
                selectedOption === "registrar" 
                  ? "text-white bg-white/10" 
                  : "text-white/60 hover:text-white"
              )}
            >
              <div className="w-8 h-8 rounded-full border-2 border-current flex items-center justify-center">
                <span className="font-bold text-sm">R</span>
              </div>
              <span className="font-semibold text-sm">REGISTRAR JOGO</span>
            </button>
          </div>

          {/* FIFA World Cup Logo placeholder */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center">
              <Trophy className="h-12 w-12 text-yellow-500/60" />
              <span className="text-white/40 text-xs mt-1">FIFA 26</span>
            </div>
          </div>

          <button
            onClick={() => {
              // Close/exit action
            }}
            onMouseEnter={() => setSelectedOption("sair")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded transition-colors",
              selectedOption === "sair" 
                ? "text-white bg-white/10" 
                : "text-white/60 hover:text-white"
            )}
          >
            <X className="h-5 w-5" />
            <span className="font-semibold text-sm">SAIR</span>
          </button>
        </div>

        {/* Navigation hint */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 text-xs text-white/40">
          <span>Use as setas para navegar</span>
          <span>|</span>
          <span>Enter para selecionar</span>
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

// Menu Button Component - Brasfoot Style
function MenuButton({
  option,
  selected,
  onClick,
  onMouseEnter,
}: {
  option: { id: string; label: string; icon: React.ReactNode; href?: string }
  selected: boolean
  onClick: () => void
  onMouseEnter: () => void
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={cn(
        "flex flex-col items-center gap-3 p-6 rounded-lg transition-all duration-200",
        "bg-gradient-to-b from-white/5 to-transparent",
        selected 
          ? "ring-2 ring-white/30 bg-white/10 scale-105" 
          : "hover:bg-white/5"
      )}
    >
      {/* Icon container */}
      <div className={cn(
        "w-20 h-20 rounded-lg flex items-center justify-center transition-colors",
        "bg-gradient-to-br from-gray-600 to-gray-800",
        selected && "from-gray-500 to-gray-700"
      )}>
        <div className={cn(
          "text-white/80 transition-colors",
          selected && "text-white"
        )}>
          {option.icon}
        </div>
      </div>
      
      {/* Label */}
      <span className={cn(
        "font-bold text-sm tracking-wide transition-colors",
        selected ? "text-white" : "text-white/70"
      )}>
        {option.label}
      </span>
    </button>
  )
}

// Helper function
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

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
        "absolute inset-0 flex flex-col items-center justify-center transition-all duration-1000 bg-black",
        phase === "studio-logo" ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        <div className="relative flex flex-col items-center">
          <Image
            src="/images/agencia-do-japa-logo.png"
            alt="Agencia do Japa"
            width={320}
            height={160}
            className="object-contain h-auto w-auto"
            priority
          />
          <div className="text-white/40 text-xs tracking-wider mt-4">
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
          {/* Logo ULTRAFOOT */}
          <div className="flex justify-center mb-8">
            <Image
              src="/brand/ultrafoot-text.png"
              alt="Ultrafoot"
              width={280}
              height={60}
              className="object-contain h-auto w-auto"
              priority
            />
          </div>
          <div className="text-center mb-4">
            <p className="text-white/40 text-xs">
              {loadingProgress < 30 && "Carregando dados dos times..."}
              {loadingProgress >= 30 && loadingProgress < 60 && "Preparando estatisticas..."}
              {loadingProgress >= 60 && loadingProgress < 90 && "Sincronizando temporada..."}
              {loadingProgress >= 90 && "Finalizando..."}
            </p>
          </div>

          <div className="relative h-1 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-100 ease-out"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>

          <div className="text-center mt-4">
            <span className="text-cyan-400 font-mono text-lg tabular-nums">
              {loadingProgress}%
            </span>
          </div>
        </div>
      </div>

      {/* Phase: Main Menu - EAFC Style */}
      <div className={cn(
        "absolute inset-0 flex flex-col transition-all duration-500",
        phase === "main-menu" ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        
        {/* Header with UF26 logo */}
        <div className="flex flex-col items-center pt-16 pb-6">
          {/* Logo container with gradient background */}
          <div className="relative mb-4">
            <div 
              className="w-32 h-32 rounded-2xl flex items-center justify-center overflow-hidden shadow-xl"
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f64f59 100%)"
              }}
            >
              <Image
                src="/brand/ultrafoot-text.png"
                alt="UF26"
                width={90}
                height={45}
                className="object-contain brightness-0 invert h-auto w-auto"
                priority
              />
            </div>
          </div>
          
          {/* Version warning */}
          <span className="text-red-500 text-sm font-medium tracking-wide">
            versao nao registrada
          </span>
        </div>

        {/* Main menu options - horizontal row */}
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="flex items-center justify-center gap-8">
            {mainMenuOptions.map((option, index) => {
              const isSelected = selectedIndex === index
              return (
                <button
                  key={option.id}
                  onClick={() => handleMenuSelect(index)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    "flex flex-col items-center gap-5 px-6 py-4 rounded-xl transition-all duration-200",
                    isSelected 
                      ? "bg-white/[0.06]" 
                      : "bg-transparent hover:bg-white/[0.03]"
                  )}
                >
                  {/* Icon container */}
                  <div className={cn(
                    "w-24 h-24 rounded-xl flex items-center justify-center transition-all duration-200 border-2",
                    isSelected 
                      ? "bg-gradient-to-br from-gray-500/60 to-gray-700/60 border-white/30 shadow-lg shadow-white/5" 
                      : "bg-gradient-to-br from-gray-700/40 to-gray-800/40 border-white/10"
                  )}>
                    <div className={cn(
                      "transition-colors duration-200",
                      isSelected ? "text-white" : "text-white/50"
                    )}>
                      {option.icon}
                    </div>
                  </div>
                  
                  {/* Label */}
                  <span className={cn(
                    "font-bold text-sm tracking-wide transition-colors duration-200 whitespace-nowrap",
                    isSelected ? "text-white" : "text-white/40"
                  )}>
                    {option.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-8 pb-8 pt-4">
          {/* Registrar button */}
          <button
            className="flex items-center gap-3 px-4 py-2 text-white/50 hover:text-white transition-colors"
          >
            <div className="w-8 h-8 rounded-full border-2 border-current flex items-center justify-center">
              <span className="font-bold text-xs">R</span>
            </div>
            <span className="font-semibold text-sm tracking-wide">REGISTRAR JOGO</span>
          </button>

          {/* Center - Navigation hints + Trophy */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-3 text-xs text-white/30">
              <span>Use as setas para navegar</span>
              <span className="text-white/15">|</span>
              <span>Enter para selecionar</span>
            </div>
            <div className="flex items-center gap-2">
              <Trophy className="h-7 w-7 text-yellow-500/70" />
              <div className="text-center">
                <div className="text-white/50 text-xs font-medium">FIFA 26</div>
                <div className="text-white/25 text-[10px]">Enter para selecionar</div>
              </div>
            </div>
          </div>

          {/* Sair button */}
          <button
            className="flex items-center gap-3 px-4 py-2 text-white/50 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
            <span className="font-semibold text-sm tracking-wide">SAIR</span>
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

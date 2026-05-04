"use client"

import { createContext, useContext, useEffect, useState, useMemo, useCallback, type ReactNode } from "react"
import {
  type PerformanceLevel,
  type PerformanceSettings,
  performancePresets,
  loadPerformanceLevel,
  savePerformanceLevel,
  detectPerformanceLevel,
  getPerformanceClasses,
} from "@/lib/performance-config"

interface PerformanceContextValue {
  level: PerformanceLevel
  settings: PerformanceSettings
  setLevel: (level: PerformanceLevel) => void
  isLowPerformance: boolean
  shouldAnimate: boolean
  shouldBlur: boolean
  tickRate: number
  cssClasses: string
}

const PerformanceContext = createContext<PerformanceContextValue | null>(null)

export function usePerformance() {
  const context = useContext(PerformanceContext)
  if (!context) {
    // Fallback para quando nao estiver dentro do provider
    return {
      level: "medium" as PerformanceLevel,
      settings: performancePresets.medium,
      setLevel: () => {},
      isLowPerformance: false,
      shouldAnimate: true,
      shouldBlur: true,
      tickRate: 250,
      cssClasses: "",
    }
  }
  return context
}

interface PerformanceProviderProps {
  children: ReactNode
}

export function PerformanceProvider({ children }: PerformanceProviderProps) {
  const [level, setLevelState] = useState<PerformanceLevel>("medium")
  const [hydrated, setHydrated] = useState(false)

  // Carrega configuracoes no mount
  useEffect(() => {
    const saved = loadPerformanceLevel()
    setLevelState(saved)
    setHydrated(true)

    // Detecta automaticamente se nao houver configuracao salva
    if (!localStorage.getItem("ultrafoot:performance")) {
      const detected = detectPerformanceLevel()
      setLevelState(detected)
      savePerformanceLevel(detected)
    }
  }, [])

  // Aplica CSS classes no body
  useEffect(() => {
    if (!hydrated) return

    const settings = performancePresets[level]
    const body = document.body

    // Remove classes anteriores
    body.classList.remove(
      "perf-low",
      "perf-medium",
      "perf-high",
      "perf-ultra",
      "no-animations",
      "no-blur",
      "no-transitions"
    )

    // Adiciona classe do nivel
    body.classList.add(`perf-${level}`)

    // Classes baseadas nas configuracoes
    if (!settings.enableAnimations) {
      body.classList.add("no-animations")
    }
    if (!settings.enableBlur) {
      body.classList.add("no-blur")
    }
    if (!settings.enableTransitions) {
      body.classList.add("no-transitions")
    }

    // CSS variables para animacoes
    document.documentElement.style.setProperty(
      "--animation-duration",
      `${settings.animationDuration}ms`
    )

    return () => {
      body.classList.remove(
        `perf-${level}`,
        "no-animations",
        "no-blur",
        "no-transitions"
      )
    }
  }, [level, hydrated])

  const setLevel = useCallback((newLevel: PerformanceLevel) => {
    setLevelState(newLevel)
    savePerformanceLevel(newLevel)
  }, [])

  const value = useMemo<PerformanceContextValue>(() => {
    const settings = performancePresets[level]
    return {
      level,
      settings,
      setLevel,
      isLowPerformance: level === "low",
      shouldAnimate: settings.enableAnimations,
      shouldBlur: settings.enableBlur,
      tickRate: settings.matchTickRate,
      cssClasses: getPerformanceClasses(settings),
    }
  }, [level, setLevel])

  return (
    <PerformanceContext.Provider value={value}>
      {children}
    </PerformanceContext.Provider>
  )
}

// Componente utilitario para envolver animacoes condicionais
export function AnimatedDiv({
  children,
  className = "",
  animate = true,
  ...props
}: {
  children: ReactNode
  className?: string
  animate?: boolean
} & React.HTMLAttributes<HTMLDivElement>) {
  const { shouldAnimate } = usePerformance()
  
  return (
    <div
      className={`${className} ${!shouldAnimate || !animate ? "!animate-none !transition-none" : ""}`}
      {...props}
    >
      {children}
    </div>
  )
}

// Hook para simplificar uso de classes condicionais
export function usePerformanceClass(baseClass: string, animationClass: string) {
  const { shouldAnimate } = usePerformance()
  return shouldAnimate ? `${baseClass} ${animationClass}` : baseClass
}

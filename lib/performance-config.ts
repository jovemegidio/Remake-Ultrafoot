import { safeLocalSet } from "@/lib/safe-storage"
// Sistema de configuracao de performance para diferentes tipos de hardware
// Otimizado para computadores fracos e de alta performance

export type PerformanceLevel = "low" | "medium" | "high" | "ultra"

export interface PerformanceSettings {
  // Animacoes
  enableAnimations: boolean
  animationDuration: number // ms
  enableTransitions: boolean
  enableParticles: boolean
  
  // Rendering
  enableBlur: boolean
  enableShadows: boolean
  enableGradients: boolean
  imageQuality: "low" | "medium" | "high"
  
  // Match simulation
  matchTickRate: number // ms entre updates
  enableMatchEffects: boolean
  enableGoalCelebration: boolean
  
  // UI
  enableHoverEffects: boolean
  enableTooltips: boolean
  lazyLoadImages: boolean
  prefetchPages: boolean
  
  // Audio
  enableBackgroundMusic: boolean
  enableSoundEffects: boolean
}

// Presets de performance
export const performancePresets: Record<PerformanceLevel, PerformanceSettings> = {
  low: {
    // Minimo para PCs fracos
    enableAnimations: false,
    animationDuration: 0,
    enableTransitions: false,
    enableParticles: false,
    enableBlur: false,
    enableShadows: false,
    enableGradients: false,
    imageQuality: "low",
    matchTickRate: 500, // Atualiza menos frequentemente
    enableMatchEffects: false,
    enableGoalCelebration: false,
    enableHoverEffects: false,
    enableTooltips: false,
    lazyLoadImages: true,
    prefetchPages: false,
    enableBackgroundMusic: false,
    enableSoundEffects: false,
  },
  medium: {
    // Balanceado
    enableAnimations: true,
    animationDuration: 200,
    enableTransitions: true,
    enableParticles: false,
    enableBlur: false,
    enableShadows: true,
    enableGradients: true,
    imageQuality: "medium",
    matchTickRate: 250,
    enableMatchEffects: true,
    enableGoalCelebration: true,
    enableHoverEffects: true,
    enableTooltips: true,
    lazyLoadImages: true,
    prefetchPages: false,
    enableBackgroundMusic: true,
    enableSoundEffects: true,
  },
  high: {
    // Alta qualidade
    enableAnimations: true,
    animationDuration: 150,
    enableTransitions: true,
    enableParticles: true,
    enableBlur: true,
    enableShadows: true,
    enableGradients: true,
    imageQuality: "high",
    matchTickRate: 100,
    enableMatchEffects: true,
    enableGoalCelebration: true,
    enableHoverEffects: true,
    enableTooltips: true,
    lazyLoadImages: false,
    prefetchPages: true,
    enableBackgroundMusic: true,
    enableSoundEffects: true,
  },
  ultra: {
    // Maximo para PCs de alta performance
    enableAnimations: true,
    animationDuration: 100,
    enableTransitions: true,
    enableParticles: true,
    enableBlur: true,
    enableShadows: true,
    enableGradients: true,
    imageQuality: "high",
    matchTickRate: 50, // Simulacao mais fluida
    enableMatchEffects: true,
    enableGoalCelebration: true,
    enableHoverEffects: true,
    enableTooltips: true,
    lazyLoadImages: false,
    prefetchPages: true,
    enableBackgroundMusic: true,
    enableSoundEffects: true,
  },
}

// Detecta automaticamente o nivel de performance recomendado
export function detectPerformanceLevel(): PerformanceLevel {
  if (typeof window === "undefined") return "medium"
  
  // Verifica memoria disponivel
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  
  // Verifica numero de cores
  const cores = navigator.hardwareConcurrency || 4
  
  // Verifica se e mobile
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
  
  // Verifica conexao
  const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection
  const isSlowConnection = connection?.effectiveType === "2g" || connection?.effectiveType === "slow-2g"
  
  // Logica de deteccao
  if (isMobile || isSlowConnection) {
    return "low"
  }
  
  if (memory && memory <= 4) {
    return "low"
  }
  
  if (memory && memory <= 8 && cores <= 4) {
    return "medium"
  }
  
  if (memory && memory >= 16 && cores >= 8) {
    return "ultra"
  }
  
  return "high"
}

// Storage key
const PERF_STORAGE_KEY = "ultrafoot:performance"

// Salva configuracao de performance
export function savePerformanceLevel(level: PerformanceLevel): void {
  if (typeof window !== "undefined") {
    safeLocalSet(PERF_STORAGE_KEY, level)
  }
}

// Carrega configuracao de performance
export function loadPerformanceLevel(): PerformanceLevel {
  if (typeof window === "undefined") return "medium"
  
  const saved = localStorage.getItem(PERF_STORAGE_KEY)
  if (saved && saved in performancePresets) {
    return saved as PerformanceLevel
  }
  
  return detectPerformanceLevel()
}

// Obtem configuracoes atuais
export function getPerformanceSettings(): PerformanceSettings {
  const level = loadPerformanceLevel()
  return performancePresets[level]
}

// Aplica estilos CSS baseado em performance
export function getPerformanceClasses(settings: PerformanceSettings): string {
  const classes: string[] = []
  
  if (!settings.enableAnimations) {
    classes.push("[&_*]:!animate-none")
  }
  
  if (!settings.enableTransitions) {
    classes.push("[&_*]:!transition-none")
  }
  
  if (!settings.enableBlur) {
    classes.push("[&_.backdrop-blur-sm]:!backdrop-blur-none")
    classes.push("[&_.backdrop-blur-xl]:!backdrop-blur-none")
  }
  
  return classes.join(" ")
}

// Labels para UI
export const performanceLevelLabels: Record<PerformanceLevel, { name: string; description: string }> = {
  low: {
    name: "Baixo",
    description: "Para PCs mais antigos ou com recursos limitados. Desativa animacoes e efeitos visuais.",
  },
  medium: {
    name: "Medio",
    description: "Equilibrio entre qualidade visual e desempenho. Recomendado para a maioria dos PCs.",
  },
  high: {
    name: "Alto",
    description: "Qualidade visual elevada com todos os efeitos ativados. Requer hardware moderno.",
  },
  ultra: {
    name: "Ultra",
    description: "Maxima qualidade com simulacao fluida. Recomendado para PCs de alta performance.",
  },
}

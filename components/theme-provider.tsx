"use client"

import { safeLocalGet } from "@/lib/safe-storage"
import { initPersistentStore, storeGet, storeSet } from "@/lib/persistent-store"
import { createContext, useContext, useEffect, useState } from "react"

// PERSISTENCIA DO TEMA — por que nao e mais localStorage puro.
//
// O tema era gravado em "ultrafoot-theme", com HIFEN. O persistent-store so
// promove para o arquivo duravel as chaves que comecam com "ultrafoot:" (dois
// pontos), entao esta ficava de fora — e o WebView2 limpa o localStorage na
// atualizacao do jogo. Resultado: quem escolhia Roxo Neon voltava para o ciano
// padrao a cada versao nova, sem explicacao. As chaves antigas continuam sendo
// lidas uma ultima vez, para ninguem perder a escolha nesta troca.
const CHAVE_TEMA = "ultrafoot:theme"
const CHAVE_CORES = "ultrafoot:team-colors"
const CHAVE_TEMA_ANTIGA = "ultrafoot-theme"
const CHAVE_CORES_ANTIGA = "ultrafoot-team-colors"

type ThemeColor = "cyan" | "green" | "red" | "blue" | "orange" | "purple" | "gold" | "team"

interface ThemeConfig {
  name: string
  primary: string
  accent: string
  primaryOklch: string
  accentOklch: string
}

const themePresets: Record<Exclude<ThemeColor, "team">, ThemeConfig> = {
  cyan: {
    name: "EA FC Cyan",
    primary: "#00d4ff",
    accent: "#a3ff12",
    primaryOklch: "oklch(0.78 0.18 195)",
    accentOklch: "oklch(0.85 0.22 140)"
  },
  green: {
    name: "Spotify Green",
    primary: "#00ffc8",
    accent: "#00c8ff",
    primaryOklch: "oklch(0.65 0.20 145)",
    accentOklch: "oklch(0.75 0.22 140)"
  },
  red: {
    name: "Vermelho Classico",
    primary: "#e53935",
    accent: "#ff6659",
    primaryOklch: "oklch(0.55 0.22 25)",
    accentOklch: "oklch(0.65 0.20 30)"
  },
  blue: {
    name: "Azul Royal",
    primary: "#1976d2",
    accent: "#42a5f5",
    primaryOklch: "oklch(0.55 0.18 250)",
    accentOklch: "oklch(0.65 0.16 245)"
  },
  orange: {
    name: "Laranja Vibrante",
    primary: "#ff9100",
    accent: "#ffab40",
    primaryOklch: "oklch(0.75 0.20 65)",
    accentOklch: "oklch(0.80 0.18 70)"
  },
  purple: {
    name: "Roxo Neon",
    primary: "#9c27b0",
    accent: "#ce93d8",
    primaryOklch: "oklch(0.50 0.22 310)",
    accentOklch: "oklch(0.70 0.15 315)"
  },
  gold: {
    name: "Dourado Premium",
    primary: "#ffc107",
    accent: "#ffeb3b",
    primaryOklch: "oklch(0.80 0.18 85)",
    accentOklch: "oklch(0.90 0.16 95)"
  }
}

interface ThemeContextType {
  theme: ThemeColor
  setTheme: (theme: ThemeColor) => void
  teamColors: { primary: string; secondary: string } | null
  setTeamColors: (colors: { primary: string; secondary: string } | null) => void
  config: ThemeConfig | null
  presets: typeof themePresets
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

function hexToOklch(hex: string): string {
  hex = hex.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const c = (max - min) * 0.4
  let h = 0
  if (max !== min) {
    if (max === r) h = ((g - b) / (max - min)) * 60
    else if (max === g) h = (2 + (b - r) / (max - min)) * 60
    else h = (4 + (r - g) / (max - min)) * 60
    if (h < 0) h += 360
  }
  return `oklch(${(l * 0.7 + 0.3).toFixed(2)} ${c.toFixed(2)} ${Math.round(h)})`
}

/**
 * Preto ou branco, o que ler melhor por cima da cor do tema.
 *
 * Luminancia relativa (a mesma conta da WCAG, sem a correcao gama — basta para
 * separar tema claro de tema escuro). Cores claras (dourado, ciano) pedem tinta
 * preta; escuras (roxo, azul) pedem branca.
 */
function tintaLegivel(hex: string): string {
  const limpo = hex.replace("#", "")
  if (limpo.length < 6) return "#000000"
  const r = parseInt(limpo.substring(0, 2), 16) / 255
  const g = parseInt(limpo.substring(2, 4), 16) / 255
  const b = parseInt(limpo.substring(4, 6), 16) / 255
  const luminancia = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminancia > 0.45 ? "#000000" : "#ffffff"
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeColor>("cyan")
  const [teamColors, setTeamColors] = useState<{ primary: string; secondary: string } | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Roda de novo quando o store termina de ler o disco: a primeira passada
    // acontece antes da hidratacao e leria vazio.
    const carregar = () => {
      const salvo = (storeGet(CHAVE_TEMA) ?? safeLocalGet(CHAVE_TEMA_ANTIGA)) as ThemeColor | null
      if (salvo) setThemeState(salvo)
      const cores = storeGet(CHAVE_CORES) ?? safeLocalGet(CHAVE_CORES_ANTIGA)
      if (cores) {
        try { setTeamColors(JSON.parse(cores)) } catch { /* valor corrompido: mantem o padrao */ }
      }
    }
    carregar()
    void initPersistentStore().then(carregar)
    window.addEventListener("ultrafoot:store:ready", carregar)
    return () => window.removeEventListener("ultrafoot:store:ready", carregar)
  }, [])

  const setTheme = (newTheme: ThemeColor) => {
    setThemeState(newTheme)
    if (mounted) storeSet(CHAVE_TEMA, newTheme)
  }

  useEffect(() => {
    if (!mounted) return
    const root = document.documentElement
    
    // --brand/--brand-2 sao o que faz o tema valer no JOGO INTEIRO: as telas
    // usam a cor da marca em classe arbitraria (text-[var(--brand)]), nao so
    // via `primary`. Sem estas duas linhas, trocar de tema mudava meia duzia de
    // botoes e o resto continuava verde-agua.
    const aplicar = (primaryHex: string, accentHex: string, primaryOklch: string, accentOklch: string) => {
      root.style.setProperty("--primary", primaryOklch)
      root.style.setProperty("--ring", primaryOklch)
      root.style.setProperty("--accent", accentOklch)
      root.style.setProperty("--sidebar-primary", primaryOklch)
      root.style.setProperty("--sidebar-ring", primaryOklch)
      root.style.setProperty("--brand", primaryHex)
      root.style.setProperty("--brand-2", accentHex)
      root.style.setProperty("--brand-ink", tintaLegivel(primaryHex))
    }

    if (theme === "team" && teamColors) {
      aplicar(
        teamColors.primary,
        teamColors.secondary,
        hexToOklch(teamColors.primary),
        hexToOklch(teamColors.secondary),
      )
    } else if (theme !== "team") {
      const config = themePresets[theme]
      aplicar(config.primary, config.accent, config.primaryOklch, config.accentOklch)
    }
  }, [theme, teamColors, mounted])

  useEffect(() => {
    if (!mounted || !teamColors) return
    storeSet(CHAVE_CORES, JSON.stringify(teamColors))
  }, [teamColors, mounted])

  const config = theme === "team" 
    ? teamColors 
      ? { name: "Cores do Time", primary: teamColors.primary, accent: teamColors.secondary, primaryOklch: hexToOklch(teamColors.primary), accentOklch: hexToOklch(teamColors.secondary) }
      : null
    : themePresets[theme]

  return (
    <ThemeContext.Provider value={{ theme, setTheme, teamColors, setTeamColors, config, presets: themePresets }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error("useTheme must be used within ThemeProvider")
  return context
}

export { themePresets, type ThemeColor, type ThemeConfig }

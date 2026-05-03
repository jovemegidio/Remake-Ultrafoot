"use client"

import { createContext, useContext, useEffect, useState } from "react"

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
    primary: "#1db954",
    accent: "#1ed760",
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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeColor>("cyan")
  const [teamColors, setTeamColors] = useState<{ primary: string; secondary: string } | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem("ultrafoot-theme") as ThemeColor | null
    if (saved) setThemeState(saved)
    const savedTeamColors = localStorage.getItem("ultrafoot-team-colors")
    if (savedTeamColors) setTeamColors(JSON.parse(savedTeamColors))
  }, [])

  const setTheme = (newTheme: ThemeColor) => {
    setThemeState(newTheme)
    if (mounted) localStorage.setItem("ultrafoot-theme", newTheme)
  }

  useEffect(() => {
    if (!mounted) return
    const root = document.documentElement
    
    if (theme === "team" && teamColors) {
      const primaryOklch = hexToOklch(teamColors.primary)
      const accentOklch = hexToOklch(teamColors.secondary)
      root.style.setProperty("--primary", primaryOklch)
      root.style.setProperty("--ring", primaryOklch)
      root.style.setProperty("--accent", accentOklch)
      root.style.setProperty("--sidebar-primary", primaryOklch)
      root.style.setProperty("--sidebar-ring", primaryOklch)
    } else if (theme !== "team") {
      const config = themePresets[theme]
      root.style.setProperty("--primary", config.primaryOklch)
      root.style.setProperty("--ring", config.primaryOklch)
      root.style.setProperty("--accent", config.accentOklch)
      root.style.setProperty("--sidebar-primary", config.primaryOklch)
      root.style.setProperty("--sidebar-ring", config.primaryOklch)
    }
  }, [theme, teamColors, mounted])

  useEffect(() => {
    if (!mounted || !teamColors) return
    localStorage.setItem("ultrafoot-team-colors", JSON.stringify(teamColors))
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

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
}

const themePresets: Record<Exclude<ThemeColor, "team">, ThemeConfig> = {
  cyan: {
    name: "EA FC Cyan",
    primary: "#00d4ff",
    accent: "#a3ff12"
  },
  green: {
    name: "Spotify Green",
    primary: "#00ffc8",
    accent: "#00c8ff"
  },
  red: {
    name: "Vermelho Classico",
    primary: "#e53935",
    accent: "#ff6659"
  },
  blue: {
    name: "Azul Royal",
    primary: "#1976d2",
    accent: "#42a5f5"
  },
  orange: {
    name: "Laranja Vibrante",
    primary: "#ff9100",
    accent: "#ffab40"
  },
  purple: {
    name: "Roxo Neon",
    primary: "#9c27b0",
    accent: "#ce93d8"
  },
  gold: {
    name: "Dourado Premium",
    primary: "#ffc107",
    accent: "#ffeb3b"
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

// hexToOklch FOI REMOVIDA (1.0.211).
//
// Ela convertia o hex do tema para oklch por aproximacao, e errava feio: o croma
// saia de `(max-min) * 0.4` — 0.40 para qualquer cor saturada, contra ~0.15 do
// valor real de #00d4ff. Fora do gamut, o navegador satura na forca. A matiz
// tambem escorregava (medido: ate 40 graus em azul e dourado).
//
// Os tokens (--primary/--ring/--accent) aceitam hex, e ninguem faz aritmetica
// oklch sobre eles. Se alguem precisar de oklch de verdade aqui, use uma
// conversao correta (via CIE XYZ), nao esta.


/**
 * Preto ou branco, o que ler melhor por cima da cor do tema.
 *
 * Luminancia relativa (a mesma conta da WCAG, sem a correcao gama — basta para
 * separar tema claro de tema escuro). Cores claras (dourado, ciano) pedem tinta
 * preta; escuras (roxo, azul) pedem branca.
 */
/**
 * Clareia a cor até ela ser LEGÍVEL COMO TEXTO no fundo escuro do jogo.
 *
 * BUG que isto corrige (relato: "toda area que contem escrita"): o tema "Cores do
 * Time" joga a cor do clube direto em `--brand`, e meia tela usa
 * `text-[var(--brand)]` — valores em destaque, potencial do atleta, rótulos. Num
 * clube de cor preta ou muito escura, esse texto virava invisível sobre o fundo
 * `#050508`. O `tintaLegivel` cuidava do caso contrário (texto SOBRE a marca) e
 * ninguém cuidava deste.
 *
 * Preserva o MATIZ — a identidade do clube continua lá — e sobe só a
 * luminosidade até passar do piso. Cores já claras não são tocadas.
 */
function clarearParaLerNoEscuro(hex: string): string {
  const limpo = hex.replace("#", "")
  if (limpo.length < 6) return hex
  let r = parseInt(limpo.substring(0, 2), 16)
  let g = parseInt(limpo.substring(2, 4), 16)
  let b = parseInt(limpo.substring(4, 6), 16)

  const luminancia = (rr: number, gg: number, bb: number) =>
    (0.2126 * rr + 0.7152 * gg + 0.0722 * bb) / 255

  // 0.38 é o piso: abaixo disso o texto compete com o fundo #050508. Testado no
  // extremo (preto puro), que sai como um cinza claro em vez de invisível.
  const PISO = 0.38
  if (luminancia(r, g, b) >= PISO) return hex

  // Preto puro não tem matiz para preservar: vira cinza claro neutro.
  if (r === 0 && g === 0 && b === 0) return "#b4b4b4"

  // Sobe todos os canais na mesma proporção, o que mantém o matiz.
  for (let i = 0; i < 40 && luminancia(r, g, b) < PISO; i++) {
    r = Math.min(255, Math.round(r * 1.12) + 6)
    g = Math.min(255, Math.round(g * 1.12) + 6)
    b = Math.min(255, Math.round(b * 1.12) + 6)
  }
  const hx = (v: number) => v.toString(16).padStart(2, "0")
  return `#${hx(r)}${hx(g)}${hx(b)}`
}

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
    /**
     * UMA FONTE DE VERDADE: o HEX.
     *
     * Antes esta funcao recebia o oklch PRONTO, escrito a mao em cada preset, e
     * os dois nao descreviam a mesma cor. No tema "green" o hex era #00ffc8
     * (verde-agua, matiz ~168) e o oklch era `oklch(0.65 0.20 145)` — verde de
     * verdade. Resultado: os componentes que leem `--primary`/`--accent` (botoes,
     * anel de foco, sidebar) pintavam de UMA cor e as telas que usam
     * `var(--brand)` pintavam de OUTRA, no mesmo tema. O usuario via o jogo com
     * duas cores brigando e chamava de "tema errado".
     *
     * Agora todos os tokens recebem O MESMO HEX. Nao ha conversao no meio.
     *
     * Por que NAO converter para oklch: `hexToOklch` e uma aproximacao grosseira
     * — o croma sai de `(max-min) * 0.4`, o que da 0.40 para qualquer cor
     * saturada, quando o valor real de #00d4ff fica perto de 0.15. Fora do gamut,
     * o navegador satura na forca e o botao sai mais berrante que a cor escolhida.
     * Medido nos sete temas: a divergencia de matiz chegava a 40 graus (azul e
     * dourado), e o croma errava por quase 3x.
     *
     * `--primary`/`--ring`/`--accent` aceitam qualquer cor CSS valida, e ninguem
     * faz aritmetica oklch sobre eles (conferido no globals.css). Hex e exato.
     *
     * E a mesma licao das duas escalas de valor: dois numeros descrevendo a mesma
     * coisa acabam discordando.
     */
    const aplicar = (primaryHex: string, accentHex: string) => {
      // `--brand` e usada nas DUAS pontas: como fundo de botao (com --brand-ink
      // por cima) e como COR DE TEXTO em meia tela (`text-[var(--brand)]`). Um
      // clube de cor preta zerava a segunda ponta — o texto sumia no fundo
      // #050508. Clareamos para o uso legivel; o matiz do clube e preservado.
      const marca = clarearParaLerNoEscuro(primaryHex)
      const marca2 = clarearParaLerNoEscuro(accentHex)
      root.style.setProperty("--primary", marca)
      root.style.setProperty("--ring", marca)
      root.style.setProperty("--accent", marca2)
      root.style.setProperty("--sidebar-primary", marca)
      root.style.setProperty("--sidebar-ring", marca)
      root.style.setProperty("--brand", marca)
      root.style.setProperty("--brand-2", marca2)
      // A tinta e calculada sobre a cor JA clareada — senao um clube escuro
      // clareado para cinza continuaria recebendo tinta branca, ilegivel.
      root.style.setProperty("--brand-ink", tintaLegivel(marca))
    }

    if (theme === "team" && teamColors) {
      aplicar(teamColors.primary, teamColors.secondary)
    } else if (theme !== "team") {
      const config = themePresets[theme]
      aplicar(config.primary, config.accent)
    }
  }, [theme, teamColors, mounted])

  useEffect(() => {
    if (!mounted || !teamColors) return
    storeSet(CHAVE_CORES, JSON.stringify(teamColors))
  }, [teamColors, mounted])

  const config = theme === "team" 
    ? teamColors 
      ? { name: "Cores do Time", primary: teamColors.primary, accent: teamColors.secondary }
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

"use client"

// Acessibilidade: escala de fonte, alto contraste, reducao de movimento e foco visivel.
//
// Aplica tudo no elemento <html> (data-attributes + uma variavel CSS de escala), entao
// vale para o jogo inteiro sem precisar tocar tela por tela. As preferencias persistem
// em localStorage e sao reaplicadas no boot ANTES da UI aparecer.

export type FontScale = 100 | 110 | 125 | 150

export interface AccessibilitySettings {
  /** Escala da fonte em %, aplicada ao root. */
  fontScale: FontScale
  /** Alto contraste: texto e bordas mais fortes, fundos mais escuros. */
  highContrast: boolean
  /** Reduz animacoes (util para enjoo/vestibular e para quem se distrai). */
  reduceMotion: boolean
  /** Realce forte no elemento focado (navegacao por teclado/controle). */
  focusHighlight: boolean
  /** Sublinha todos os links/acoes clicaveis. */
  underlineLinks: boolean
}

export const DEFAULT_A11Y: AccessibilitySettings = {
  fontScale: 100,
  highContrast: false,
  reduceMotion: false,
  focusHighlight: false,
  underlineLinks: false,
}

const KEY = "ultrafoot:a11y"

let settings: AccessibilitySettings = { ...DEFAULT_A11Y }
let loaded = false
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

/** Escreve as preferencias no <html>. O CSS (globals.css) reage a estes atributos. */
function apply(s: AccessibilitySettings) {
  if (typeof document === "undefined") return
  const root = document.documentElement

  // A escala multiplica o font-size do root; todo rem do jogo acompanha.
  root.style.setProperty("--a11y-font-scale", String(s.fontScale / 100))

  root.toggleAttribute("data-a11y-contrast", s.highContrast)
  root.toggleAttribute("data-a11y-reduce-motion", s.reduceMotion)
  root.toggleAttribute("data-a11y-focus", s.focusHighlight)
  root.toggleAttribute("data-a11y-underline", s.underlineLinks)
}

function load(): AccessibilitySettings {
  if (typeof window === "undefined") return { ...DEFAULT_A11Y }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_A11Y }
    // Merge com o default: uma opcao nova nao quebra um save antigo.
    return { ...DEFAULT_A11Y, ...(JSON.parse(raw) as Partial<AccessibilitySettings>) }
  } catch {
    return { ...DEFAULT_A11Y }
  }
}

function persist(s: AccessibilitySettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return
  loaded = true
  settings = load()
  apply(settings)
}

export const accessibilityStore = {
  subscribe(listener: () => void) {
    ensureLoaded()
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot(): AccessibilitySettings {
    return settings
  },
  getServerSnapshot(): AccessibilitySettings {
    return DEFAULT_A11Y
  },
  set<K extends keyof AccessibilitySettings>(key: K, value: AccessibilitySettings[K]) {
    settings = { ...settings, [key]: value }
    apply(settings)
    persist(settings)
    emit()
  },
  reset() {
    settings = { ...DEFAULT_A11Y }
    apply(settings)
    persist(settings)
    emit()
  },
  /** Reaplica no boot (chamado pelo provider). */
  init() {
    ensureLoaded()
  },
}

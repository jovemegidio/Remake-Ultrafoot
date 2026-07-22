"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { safeLocalGet, safeLocalSet } from "@/lib/safe-storage"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { Globe, Save, FileEdit, X, Key, CheckCircle2, AlertCircle, Clock, Trash2, LogOut, Download, Cloud, ChevronRight } from "lucide-react"
import { activateCareerSave, listCareerSaves, loadGameState, hasSave, clearAllGameData, useGameState } from "@/lib/save-system"
import { useGameEngine } from "@/lib/game-engine"
import { getTeamByShort } from "@/lib/teams-data"
import { useTranslation } from "@/lib/i18n"
import { isTauri } from "@/lib/game-asset"
import { hardNavigate } from "@/lib/hard-navigation"
import { LegalConsent } from "@/components/legal-consent"
import { downloadSave, getSavedCloudCode } from "@/lib/cloud-save"
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

type MenuOption = "novo-jogo" | "editar" | "carregar" | "registrar" | "sair"

const MENU_BGS = ["/images/pre-jogo/in-game-1.png", "/images/pre-jogo/in-game-5.png", "/images/pre-jogo/in-game-8.png", "/images/pre-jogo/in-game-2.png"]

/** Marca que a abertura institucional ja foi exibida — a partir dai o jogo abre curto. */
const INTRO_VISTA = "ultrafoot:intro-vista"

const LANGUAGE_COUNTRIES = [
  { id: "pt-BR", language: "Português", country: "Brasil", flag: "br", code: "BR" },
  { id: "pt-PT", language: "Português", country: "Portugal", flag: "pt", code: "PT" },
  { id: "en-US", language: "English", country: "United States", flag: "us", code: "US" },
  { id: "en-GB", language: "English", country: "United Kingdom", flag: "gb-eng", code: "UK" },
  { id: "es-ES", language: "Español", country: "España", flag: "es", code: "ES" },
  { id: "es-MX", language: "Español", country: "México", flag: "mx", code: "MX" },
] as const

export default function SplashPage() {
  const t = useTranslation()
  const { state: gameState, setState: setGameState } = useGameState()
  const [phase, setPhase] = useState<SplashPhase>("black")
  // Idioma é a primeira decisão da sessão, antes de qualquer opção de carreira.
  // Selecao de idioma REMOVIDA da splash a pedido do usuario (2026-07-20):
  // o idioma agora se ajusta somente nas Configuracoes. Iniciar como true pula
  // o carrossel direto para o menu; o restante do fluxo fica intacto.
  const [languageSelected, setLanguageSelected] = useState(true)
  // Fundos do menu em rotacao (ordem pedida: 1, 5, 8, 2).
  const [menuBgIndex, setMenuBgIndex] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => setMenuBgIndex(i => (i + 1) % MENU_BGS.length), 10000)
    return () => window.clearInterval(timer)
  }, [])
  const [languageIndex, setLanguageIndex] = useState(0)
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
  // Cloud save
  const [cloudCode, setCloudCode] = useState("")
  const [cloudLoading, setCloudLoading] = useState(false)
  const [cloudError, setCloudError] = useState("")
  const [cloudSuccess, setCloudSuccess] = useState("")
  const [cloudSaveReady, setCloudSaveReady] = useState(false)

  const moveLanguage = useCallback((direction: 1 | -1) => {
    setLanguageIndex(current => (current + direction + LANGUAGE_COUNTRIES.length) % LANGUAGE_COUNTRIES.length)
  }, [])
  const selectLanguage = useCallback((index?: number) => {
    const chosen = LANGUAGE_COUNTRIES[index ?? languageIndex]
    setGameState({ language: chosen.id })
    setLanguageSelected(true)
  }, [languageIndex, setGameState])

  // Carrega estado de registro e código de nuvem do localStorage ao montar
  useEffect(() => {
    setIsRegistered(window.localStorage.getItem("ultrafoot:registered") === "1")
    const savedCode = getSavedCloudCode()
    if (savedCode) setCloudCode(savedCode)
  }, [])

  // Save real (persistent-store). Como o store carrega do disco de forma async,
  // lemos em estado e re-lemos quando ele fica pronto / muda — senao o menu
  // "Carregar" apareceria vazio no primeiro render mesmo havendo save.
  const [saveInfo, setSaveInfo] = useState<{ realSave: ReturnType<typeof loadGameState> | null; hasSaveGame: boolean; careers: ReturnType<typeof listCareerSaves> }>({ realSave: null, hasSaveGame: false, careers: [] })
  useEffect(() => {
    const refresh = () => setSaveInfo({ realSave: loadGameState(), hasSaveGame: hasSave(), careers: listCareerSaves() })
    refresh()
    window.addEventListener("ultrafoot:store:ready", refresh)
    window.addEventListener("ultrafoot:store:changed", refresh)
    return () => {
      window.removeEventListener("ultrafoot:store:ready", refresh)
      window.removeEventListener("ultrafoot:store:changed", refresh)
    }
  }, [])
  const hasSaveGame = saveInfo.hasSaveGame
  const savedGames = saveInfo.careers.map(career => {
    const team = getTeamByShort(career.teamShort)
    return {
        id: career.id,
        name: career.name,
        teamName: team?.nome || career.teamShort,
        season: `${career.season}/${career.season + 1}`,
        date: career.updatedAt ? new Date(career.updatedAt).toLocaleDateString("pt-BR") : "-",
        position: `Semana ${career.week}`,
        competition: "Serie A",
      }
  })

  const mainMenuOptions: { id: MenuOption; label: string; icon: React.ReactNode; href?: string }[] = [
    { id: "novo-jogo", label: t.splash.newGame, icon: <Globe className="h-7 w-7" strokeWidth={1.5} />, href: "/novo-jogo" },
    { id: "editar", label: t.splash.clubEditor, icon: <FileEdit className="h-7 w-7" strokeWidth={1.5} />, href: "/editar" },
    { id: "carregar", label: t.splash.loadGame, icon: <Save className="h-7 w-7" strokeWidth={1.5} /> },
    { id: "registrar", label: t.splash.register, icon: <Key className="h-7 w-7" strokeWidth={1.5} /> },
    { id: "sair", label: t.splash.exit, icon: <LogOut className="h-7 w-7" strokeWidth={1.5} /> },
  ]

  // ABERTURA. Era uma sequencia de 8,5 s: preto 0,8 + estudio 2 + aviso 2 + ligas
  // 2,5 + barra 1,2. Cada troca de fase ainda levava 1 s de dissolucao. Ficava
  // longa e arrastada — jogo profissional abre rapido e deixa pular.
  //
  // Agora: ~3,4 s na primeira vez, ~1,2 s nas seguintes (a abertura institucional
  // e apresentacao, nao precisa se repetir a cada partida), e qualquer clique ou
  // tecla corta direto para o menu.
  const pulou = useRef(false)

  useEffect(() => {
    if (!languageSelected) return
    let vivo = true

    const sequence = async () => {
      // Se vier com ?menu=1 (ex: ao pressionar Voltar de outra tela), pula direto pro menu
      if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("menu") === "1") {
        setPhase("main-menu")
        return
      }

      const nav = navigator as Navigator & { deviceMemory?: number }
      const lightweight = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4
      // `pulou` checado a cada espera: sem isso o clique de pular levava ao menu
      // e a sequencia continuava rodando por tras, voltando para o carregamento.
      const wait = async (ms: number) => {
        await delay(lightweight ? Math.min(ms, 250) : ms)
        return vivo && !pulou.current
      }

      const jaViu = safeLocalGet(INTRO_VISTA) === "1"

      if (!jaViu) {
        if (!(await wait(200))) return
        setPhase("studio-logo")
        if (!(await wait(1300))) return
        setPhase("ea-warning")
        if (!(await wait(900))) return
        setPhase("leagues")
        if (!(await wait(1000))) return
        safeLocalSet(INTRO_VISTA, "1")
      }

      setPhase("loading")
      for (let i = 0; i <= 100; i += 5) {
        if (!(await wait(lightweight ? 5 : 16))) return
        setLoadingProgress(i)
      }
      if (!(await wait(150))) return
      setPhase("main-menu")
    }

    sequence()
    return () => { vivo = false }
  }, [hasSaveGame, languageSelected])

  // PULAR: um clique ou uma tecla durante a abertura vai direto ao menu.
  useEffect(() => {
    if (phase === "main-menu" || phase === "fade-out") return
    const cortar = () => {
      pulou.current = true
      safeLocalSet(INTRO_VISTA, "1")
      setLoadingProgress(100)
      setPhase("main-menu")
    }
    window.addEventListener("pointerdown", cortar)
    window.addEventListener("keydown", cortar)
    return () => {
      window.removeEventListener("pointerdown", cortar)
      window.removeEventListener("keydown", cortar)
    }
  }, [phase])

  // Handler para navegacao no menu
  const handleMenuSelect = useCallback((index: number) => {
    const menuOption = mainMenuOptions[index]
    if (isExiting) return
    
    // Se for carregar jogo, mostra o modal de saves
    if (menuOption?.id === "carregar") {
      setShowLoadModal(true)
      return
    }
    
    // Se for registrar, mostra o modal de registro
    if (menuOption?.id === "registrar") {
      if (!isRegistered) {
        setShowRegisterModal(true)
      }
      return
    }
    
    // Se for sair, fecha a janela
    if (menuOption?.id === "sair") {
      if (isTauri()) {
        // Tauri v2: fecha a janela nativa corretamente
        import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
          getCurrentWindow().close()
        }).catch(() => window.close())
      } else {
        window.close()
      }
      return
    }
    
    if (menuOption?.href) {
      const href = menuOption.href
      setIsExiting(true)
      setPhase("fade-out")
      setTimeout(() => {
        hardNavigate(href)
      }, 400)
    }
  }, [isExiting, mainMenuOptions, isRegistered])

  // Handler para carregar save
  const handleLoadSave = useCallback(async (saveId: string) => {
    if (!activateCareerSave(saveId)) {
      setCloudError("Este save esta danificado e nao possui copia de recuperacao valida.")
      return
    }
    // O app permanece em uma unica WebView. Rehidrata explicitamente o motor do
    // slot escolhido antes de abrir o escritorio, sem reaproveitar elenco/tatica.
    await useGameEngine.persist.rehydrate()
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("ultrafoot:session-active", "true")
    }
    setIsExiting(true)
    setPhase("fade-out")
    setTimeout(() => {
      hardNavigate("/")
    }, 400)
  }, [])

  // Funcao para validar e registrar o jogo
  const handleRegister = useCallback(async () => {
    setRegisterError("")
    setIsValidating(true)
    
    // Simula validacao da chave (em producao, seria uma API call)
    await delay(1500)
    
    // Chave de exemplo valida: ULTRA-FOOT-2026-XXXX
    const validKeyPattern = /^ULTRA-FOOT-2026-[A-Z0-9]{4}$/
    
    if (validKeyPattern.test(serialKey.toUpperCase())) {
      safeLocalSet("ultrafoot:registered", "1")
      setIsRegistered(true)
      setIsValidating(false)
      setTimeout(() => {
        setShowRegisterModal(false)
      }, 2000)
    } else {
      setRegisterError("Chave de serial invalida. Verifique e tente novamente.")
      setIsValidating(false)
    }
  }, [serialKey])

  // Handler para baixar save da nuvem
  const handleCloudDownload = useCallback(async () => {
    if (cloudCode.length !== 6) return
    setCloudLoading(true)
    setCloudError("")
    setCloudSuccess("")
    setCloudSaveReady(false)

    const result = await downloadSave(cloudCode)

    if (result.success) {
      setCloudSuccess(t.splash.cloudSuccess)
      setCloudSaveReady(true)
    } else if (result.error?.includes("não encontrado") || result.error?.includes("nao encontrado") || result.error?.includes("not found") || result.error?.includes("404")) {
      setCloudError(t.splash.cloudNotFound)
    } else {
      setCloudError(t.splash.cloudError)
    }
    setCloudLoading(false)
  }, [cloudCode, t.splash])

  // Navegacao por teclado e controle
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

      if (!languageSelected) {
        if (e.key === "ArrowLeft") { e.preventDefault(); moveLanguage(-1) }
        else if (e.key === "ArrowRight") { e.preventDefault(); moveLanguage(1) }
        else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectLanguage() }
        return
      }

      if (phase !== "main-menu") return

      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : mainMenuOptions.length - 1)
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
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

    // Gamepad button handler - mapeia botoes do controle para acoes do menu
    const handleGamepadButton = (e: Event) => {
      const { button } = (e as CustomEvent<{ button: string }>).detail

      if (showRegisterModal) {
        if (button === "B") setShowRegisterModal(false)
        return
      }

      if (showLoadModal) {
        if (button === "B") {
          setShowLoadModal(false)
        } else if (button === "DPAD_UP") {
          setSelectedSaveIndex(prev => prev > 0 ? prev - 1 : savedGames.length - 1)
        } else if (button === "DPAD_DOWN") {
          setSelectedSaveIndex(prev => prev < savedGames.length - 1 ? prev + 1 : 0)
        } else if (button === "A") {
          if (savedGames[selectedSaveIndex]) {
            handleLoadSave(savedGames[selectedSaveIndex].id)
          }
        }
        return
      }

      if (!languageSelected) {
        if (button === "DPAD_LEFT" || button === "LB") moveLanguage(-1)
        else if (button === "DPAD_RIGHT" || button === "RB") moveLanguage(1)
        else if (button === "A") selectLanguage()
        return
      }

      if (phase !== "main-menu") return

      if (button === "DPAD_UP" || button === "DPAD_LEFT" || button === "LB") {
        setSelectedIndex(prev => prev > 0 ? prev - 1 : mainMenuOptions.length - 1)
      } else if (button === "DPAD_DOWN" || button === "DPAD_RIGHT" || button === "RB") {
        setSelectedIndex(prev => prev < mainMenuOptions.length - 1 ? prev + 1 : 0)
      } else if (button === "A") {
        handleMenuSelect(selectedIndex)
      } else if (button === "B") {
        // Botao B fecha modais ou sai
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("gamepad:button", handleGamepadButton)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("gamepad:button", handleGamepadButton)
    }
  }, [phase, selectedIndex, handleMenuSelect, mainMenuOptions, showRegisterModal, showLoadModal, isRegistered, selectedSaveIndex, savedGames, handleLoadSave, languageSelected, moveLanguage, selectLanguage])

  return (
    <div
      data-gamepad-exclude
      className={cn(
        "fixed inset-0 flex flex-col overflow-hidden transition-opacity duration-400",
        isExiting && "opacity-0"
      )}
      style={{
        background: "linear-gradient(180deg, #1f1f1f 0%, #171717 50%, #1a1a1a 100%)"
      }}
    >
      <LegalConsent onAccepted={() => undefined} />
      {!languageSelected && (() => {
        const current = LANGUAGE_COUNTRIES[languageIndex]
        const previous = LANGUAGE_COUNTRIES[(languageIndex - 1 + LANGUAGE_COUNTRIES.length) % LANGUAGE_COUNTRIES.length]
        const next = LANGUAGE_COUNTRIES[(languageIndex + 1) % LANGUAGE_COUNTRIES.length]
        return <div className="absolute inset-0 z-[100] flex items-center justify-center bg-[#050508] px-5">
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-gradient-to-br from-[#102925] to-[#0b0c10] p-7 text-center shadow-2xl">
            <Globe className="mx-auto h-11 w-11 text-[#00ffc8]" />
            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.24em] text-[#00ffc8]">Ultrafoot 26</p>
            <h1 className="mt-2 text-2xl font-black text-white">Escolha o idioma</h1>
            <p className="mt-2 text-sm text-white/50">Você poderá alterá-lo depois nas configurações.</p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button onClick={() => moveLanguage(-1)} aria-label="País anterior" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-6 text-xl text-white/70 hover:border-[#00ffc8] hover:text-[#00ffc8]">‹</button>
              <button onClick={() => moveLanguage(-1)} className="hidden w-24 rounded-xl border border-white/10 bg-white/[0.03] p-2 opacity-45 transition hover:opacity-80 sm:block"><Image src={`/flags/${previous.flag}.png`} alt={previous.country} width={48} height={32} className="mx-auto h-8 w-12 object-cover" /><span className="mt-2 block truncate text-[10px] text-white">{previous.code}</span></button>
              <button onClick={() => selectLanguage()} className="w-44 rounded-2xl border-2 border-[#00ffc8] bg-[#00ffc8]/10 px-4 py-4 shadow-[0_0_26px_rgba(0,255,200,.16)] transition hover:bg-[#00ffc8]/20"><Image src={`/flags/${current.flag}.png`} alt={`Bandeira de ${current.country}`} width={96} height={64} className="mx-auto h-14 w-24 rounded object-cover shadow" /><span className="mt-3 block text-lg font-black text-white">{current.language}</span><span className="mt-1 block text-xs text-[#00ffc8]">{current.country}</span></button>
              <button onClick={() => moveLanguage(1)} className="hidden w-24 rounded-xl border border-white/10 bg-white/[0.03] p-2 opacity-45 transition hover:opacity-80 sm:block"><Image src={`/flags/${next.flag}.png`} alt={next.country} width={48} height={32} className="mx-auto h-8 w-12 object-cover" /><span className="mt-2 block truncate text-[10px] text-white">{next.code}</span></button>
              <button onClick={() => moveLanguage(1)} aria-label="Próximo país" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-6 text-xl text-white/70 hover:border-[#00ffc8] hover:text-[#00ffc8]">›</button>
            </div>
            <p className="mt-5 text-[11px] text-white/40">← / → ou direcional para trocar país · Enter / A para confirmar</p>
          </div>
        </div>
      })()}
      {/* Depois da escolha inicial, o idioma fica fixo durante a sessão. A troca
          continua disponível somente em Configurações, como no fluxo solicitado. */}

      {/* Phase: Black screen */}
      <div className={cn(
        "absolute inset-0 bg-black transition-opacity duration-500",
        phase === "black" ? "opacity-100" : "opacity-0 pointer-events-none"
      )} />

      {/* Phase: Studio Logo - Agencia do Japa */}
      <div className={cn(
        "absolute inset-0 flex flex-col items-center justify-center transition-all duration-500 bg-black overflow-hidden",
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
              {t.splash.presents}
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
        "absolute inset-0 flex items-center justify-center p-8 transition-all duration-500 bg-black",
        phase === "ea-warning" ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        <div className="max-w-2xl text-center">
          <div className="text-white/60 text-xs leading-relaxed space-y-4">
            <p>{t.splash.disclaimer}</p>
            <p className="text-white/40">{t.splash.copyright}</p>
          </div>
        </div>
      </div>

      {/* Phase: Leagues - Logos das ligas e competicoes */}
      <div className={cn(
        "absolute inset-0 flex flex-col items-center justify-center transition-all duration-500 overflow-hidden bg-black",
        phase === "leagues" ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        {/* Leagues image container with fade-in animation */}
        <div 
          className="relative w-full h-full flex items-center justify-center"
          style={{
            animation: phase === "leagues" ? "leaguesFadeIn 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards" : "none",
          }}
        >
          {/* Imagem das ligas */}
          <Image
            src="/images/leagues-ultrafoot.jpg"
            alt="Ligas e competicoes licenciadas"
            fill
            className="object-contain"
            unoptimized
            style={{
              animation: phase === "leagues" ? "leaguesZoom 3.5s ease-out forwards" : "none",
            }}
            priority
          />
          
          {/* Vignette overlay */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)",
            }}
          />
        </div>
        
        {/* Text overlay */}
        <div 
          className="absolute bottom-16 left-0 right-0 text-center"
          style={{
            animation: phase === "leagues" ? "fadeIn 0.8s ease-out 1.5s forwards" : "none",
            opacity: 0,
          }}
        >
          <span className="text-white/50 text-xs tracking-[0.4em] uppercase font-medium">
            {t.splash.licensedLeagues}
          </span>
        </div>
      </div>

      {/* Phase: Loading - Professional Institutional Style */}
      <div className={cn(
        "absolute inset-0 flex flex-col items-center justify-center transition-all duration-500 overflow-hidden",
        phase === "loading" ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        {/* Background with subtle gradient */}
        <div 
          className="absolute inset-0"
          style={{
            background: "linear-gradient(180deg, #0a0a0a 0%, #0d1117 40%, #0a1628 70%, #0a0a0a 100%)",
          }}
        />
        
        {/* Animated ambient light - top */}
        <div 
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at center top, rgba(0, 255, 200, 0.06) 0%, transparent 60%)",
            animation: "breathe 4s ease-in-out infinite",
          }}
        />
        
        {/* Subtle grid pattern overlay */}
        <div 
          className="absolute inset-0 opacity-[0.02] pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />

        {/* Main content */}
        <div className="relative z-10 flex flex-col items-center w-full max-w-lg px-8">
          
          {/* Logo container */}
          <div 
            className="relative mb-16"
            style={{
              animation: phase === "loading" ? "logoFadeIn 1s cubic-bezier(0.16, 1, 0.3, 1) forwards" : "none",
            }}
          >
            <Image
              src="/brand/ultrafoot-logo.png"
              alt="Ultrafoot"
              width={320}
              height={70}
              className="object-contain w-auto"
              style={{ height: "auto" }}
              priority
            />
          </div>

          {/* Loading section with elegant design */}
          <div 
            className="w-full"
            style={{
              animation: phase === "loading" ? "fadeInUp 0.8s ease-out 0.3s forwards" : "none",
              opacity: 0,
            }}
          >
            {/* Status text - refined typography */}
            <div className="text-center mb-6">
              <p 
                key={loadingProgress < 25 ? "1" : loadingProgress < 50 ? "2" : loadingProgress < 75 ? "3" : "4"}
                className="text-white/50 text-[11px] tracking-[0.2em] uppercase font-light transition-all duration-300"
              >
                {loadingProgress < 25 && t.splash.loadingEngine}
                {loadingProgress >= 25 && loadingProgress < 50 && t.splash.loadingClubs}
                {loadingProgress >= 50 && loadingProgress < 75 && t.splash.loadingSeason}
                {loadingProgress >= 75 && t.splash.loadingExperience}
              </p>
            </div>

            {/* Progress bar - sleek modern design */}
            <div className="relative">
              {/* Track background */}
              <div 
                className="h-[3px] rounded-full overflow-hidden"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.3)",
                }}
              >
                {/* Progress fill with gradient */}
                <div 
                  className="h-full rounded-full transition-all duration-150 ease-out relative overflow-hidden"
                  style={{ 
                    width: `${loadingProgress}%`,
                    background: "linear-gradient(90deg, #00ffc8 0%, #00c8ff 50%, #00ffc8 100%)",
                    boxShadow: "0 0 20px rgba(0, 255, 200, 0.5), 0 0 40px rgba(0, 255, 200, 0.3)",
                  }}
                >
                  {/* Shimmer effect */}
                  <div 
                    className="absolute inset-0"
                    style={{
                      background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
                      animation: "shimmerMove 1.5s ease-in-out infinite",
                    }}
                  />
                </div>
              </div>
              
              {/* Glow indicator at progress end */}
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full transition-all duration-150"
                style={{ 
                  left: `calc(${loadingProgress}% - 4px)`,
                  background: "#00ffc8",
                  boxShadow: "0 0 12px rgba(0, 255, 200, 0.8), 0 0 24px rgba(0, 255, 200, 0.4)",
                  opacity: loadingProgress > 0 ? 1 : 0,
                }}
              />
            </div>

            {/* Percentage display - elegant monospace */}
            <div className="flex justify-center mt-5">
              <div className="relative">
                <span 
                  className="text-white/80 font-mono text-sm tabular-nums tracking-wider"
                  style={{
                    textShadow: "0 0 20px rgba(0, 255, 200, 0.3)",
                  }}
                >
                  {loadingProgress}
                </span>
                <span className="text-white/40 font-mono text-sm ml-0.5">%</span>
              </div>
            </div>

            {/* Animated loading indicator - refined dots */}
            <div className="flex justify-center gap-1.5 mt-8">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1 h-1 rounded-full"
                  style={{
                    background: "rgba(0, 255, 200, 0.6)",
                    boxShadow: "0 0 6px rgba(0, 255, 200, 0.4)",
                    animation: `dotPulse 1.2s ease-in-out infinite`,
                    animationDelay: `${i * 0.2}s`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Bottom branding bar */}
        <div 
          className="absolute bottom-0 left-0 right-0 py-6 px-8"
          style={{
            background: "linear-gradient(0deg, rgba(0,0,0,0.5) 0%, transparent 100%)",
          }}
        >
          <div className="flex justify-between items-center max-w-4xl mx-auto">
            <span className="text-white/20 text-[9px] tracking-[0.15em] uppercase font-light">
              Ultrafoot 26
            </span>
            <span className="text-white/20 text-[9px] tracking-[0.1em] uppercase font-light">
              Agencia do Japa
            </span>
          </div>
        </div>
      </div>

      {/* Phase: Main Menu - EAFC Style */}
      <div className={cn(
        "absolute inset-0 flex flex-col transition-all duration-700",
        phase === "main-menu" ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>

        {/* Cinematic stadium backdrop — roda os fundos 1→5→8→2 (pedido com
            print), com crossfade suave a cada troca. */}
        <div className="absolute inset-0 overflow-hidden">
          <Image
            key={MENU_BGS[menuBgIndex]}
            src={MENU_BGS[menuBgIndex]}
            alt=""
            fill
            className="object-cover animate-in fade-in duration-1000"
            style={{
              transform: phase === "main-menu" ? "scale(1.08)" : "scale(1)",
              transition: "transform 12s ease-out",
              filter: "saturate(0.85) brightness(0.55)",
            }}
            priority
            unoptimized
          />
          {/* Darkening gradients for depth + readability */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(5,8,12,0.85) 0%, rgba(5,8,12,0.45) 35%, rgba(5,8,12,0.55) 65%, rgba(5,8,12,0.95) 100%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 50% 38%, rgba(0,255,200,0.08) 0%, transparent 55%)",
            }}
          />
        </div>

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

        {/* Conteudo do menu - layout cinematografico alinhado a esquerda */}
        <div className="relative z-10 flex h-full flex-col justify-center px-8 sm:px-12 md:px-16 lg:px-24 pt-16 pb-24">
          <div className="w-full max-w-md">

            {/* Logo + badge de registro */}
            <div
              className="mb-6"
              style={{
                animation: phase === "main-menu" ? "slideDown 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards" : "none",
              }}
            >
              <Image
                src="/brand/ultrafoot-logo.png"
                alt="Ultrafoot"
                width={300}
                height={64}
                className="object-contain w-auto max-w-[220px] sm:max-w-[260px] md:max-w-[300px]"
                style={{ height: "auto" }}
                priority
              />
              <div className="mt-3 flex items-center gap-3">
                <span className="text-white/45 text-[11px] tracking-[0.25em] uppercase font-medium">
                  Modo Carreira · 2026
                </span>
                <span className="h-1 w-1 rounded-full bg-white/20" />
                {!isRegistered ? (
                  <span className="text-amber-500/80 text-[10px] font-semibold tracking-widest uppercase">
                    {t.splash.unregistered}
                  </span>
                ) : (
                  <span className="text-emerald-400/90 text-[10px] font-semibold tracking-widest uppercase flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3" />
                    {t.splash.registered}
                  </span>
                )}
              </div>
            </div>

            {/* Menu vertical estilo EA FC */}
            <nav className="flex flex-col gap-1.5">
              {mainMenuOptions.map((option, index) => {
                const isSelected = selectedIndex === index
                return (
                  <button
                    key={option.id}
                    onClick={() => handleMenuSelect(index)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      "group relative flex items-center gap-4 rounded-xl border px-4 py-3 text-left transition-all duration-300 overflow-hidden",
                      isSelected
                        ? "border-[#00ffc8]/40 translate-x-1.5"
                        : "border-white/[0.06] hover:border-white/15"
                    )}
                    style={{
                      animation: phase === "main-menu" ? `slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.1 + index * 0.07}s forwards` : "none",
                      opacity: 0,
                      background: isSelected
                        ? "linear-gradient(90deg, rgba(0,255,200,0.14) 0%, rgba(0,200,255,0.05) 45%, rgba(8,12,18,0.2) 100%)"
                        : "rgba(8,12,18,0.35)",
                      boxShadow: isSelected ? "0 8px 30px rgba(0,255,200,0.12)" : "none",
                    }}
                  >
                    {/* Barra de acento esquerda */}
                    <span
                      className={cn(
                        "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full transition-all duration-300",
                        isSelected ? "h-8 bg-gradient-to-b from-[#00ffc8] to-[#00c8ff]" : "h-0 bg-transparent"
                      )}
                    />

                    {/* Icone */}
                    <div className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-all duration-300 [&>svg]:h-5 [&>svg]:w-5",
                      isSelected ? "bg-[#00ffc8]/15 text-[#00ffc8]" : "bg-white/[0.04] text-white/40 group-hover:text-white/60"
                    )}>
                      {option.icon}
                    </div>

                    {/* Label */}
                    <span className={cn(
                      "flex-1 font-bold text-sm tracking-wide transition-colors duration-300",
                      isSelected ? "text-white" : "text-white/45 group-hover:text-white/70"
                    )}>
                      {option.label}
                    </span>

                    {/* Chevron do item selecionado */}
                    <ChevronRight className={cn(
                      "h-4 w-4 shrink-0 transition-all duration-300",
                      isSelected ? "text-[#00ffc8] opacity-100 translate-x-0" : "text-white/0 opacity-0 -translate-x-2"
                    )} />
                  </button>
                )
              })}
            </nav>
          </div>
        </div>

        {/* Barra de dicas de controle - estilo EA FC */}
        <div
          className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-between gap-4 px-6 py-4 sm:px-10"
          style={{
            background: "linear-gradient(0deg, rgba(5,8,12,0.92) 0%, transparent 100%)",
            animation: phase === "main-menu" ? "fadeIn 0.6s ease-out 0.5s forwards" : "none",
            opacity: 0,
          }}
        >
          <span className="text-white/25 text-[10px] tracking-[0.2em] uppercase font-medium">
            Ultrafoot 26 · Agencia do Japa
          </span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 text-white/45 text-[11px] font-medium">
              <kbd className="flex h-5 min-w-5 items-center justify-center rounded border border-white/15 bg-white/[0.06] px-1 text-[10px]">↑↓</kbd>
              Navegar
            </span>
            <span className="flex items-center gap-2 text-white/45 text-[11px] font-medium">
              <kbd className="flex h-5 min-w-5 items-center justify-center rounded border border-[#00ffc8]/30 bg-[#00ffc8]/10 px-1 text-[10px] text-[#00ffc8]">↵</kbd>
              Selecionar
            </span>
          </div>
        </div>

      </div>

      {/* Modal de Registro */}
      <Dialog open={showRegisterModal} onOpenChange={setShowRegisterModal}>
        <DialogContent 
          className="bg-gradient-to-br from-[#0a1414] via-[#091018] to-[#060b0e] border-[#00ffc8]/15 text-white max-w-md"
          showCloseButton={!isValidating}
        >
          {/* Glow teal sutil no topo, alinhado a identidade do jogo */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#00ffc8]/40 to-transparent" />
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#00ffc8] to-[#00c8ff] shadow-lg shadow-[#00ffc8]/25">
                <Key className="h-5 w-5 text-black" />
              </div>
              {t.splash.registerTitle}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              {t.splash.registerDesc}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-4">
            {/* Input da chave serial */}
            <div className="space-y-2">
              <label className="text-sm text-white/60 font-medium">
                {t.splash.serialKey}
              </label>
              <input
                type="text"
                value={serialKey}
                onChange={(e) => {
                  setSerialKey(e.target.value.toUpperCase())
                  setRegisterError("")
                }}
                placeholder={t.splash.serialPlaceholder}
                disabled={isValidating || isRegistered}
                className={cn(
                  "w-full px-4 py-3 bg-black/40 border rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 transition-all duration-300 font-mono tracking-wider",
                  registerError 
                    ? "border-red-500/50 focus:ring-red-500/30" 
                    : "border-white/10 focus:ring-[#00ffc8]/30 focus:border-[#00ffc8]/40"
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
                    : "bg-gradient-to-r from-[#00ffc8] to-[#00c8ff] text-black shadow-lg shadow-[#00ffc8]/25 hover:opacity-90 hover:scale-[1.02]"
              )}
            >
              {isValidating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t.splash.validating}
                </>
              ) : isRegistered ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {t.splash.successTitle}
                </>
              ) : (
                t.splash.activate
              )}
            </button>

            {/* Dica */}
            <p className="text-center text-white/30 text-xs">
              {t.splash.noKey}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Carregar Jogo */}
      <Dialog open={showLoadModal} onOpenChange={setShowLoadModal}>
        <DialogContent 
          className="bg-gradient-to-br from-[#0a1414] via-[#091018] to-[#060b0e] border-[#00ffc8]/15 text-white max-w-lg"
        >
          {/* Glow teal sutil no topo, alinhado a identidade do jogo */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#00ffc8]/40 to-transparent" />
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#00ffc8] to-[#00c8ff] shadow-lg shadow-[#00ffc8]/25">
                <Save className="h-5 w-5 text-black" />
              </div>
              {t.splash.loadTitle}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              {t.splash.loadDesc}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-4">
            {savedGames.length === 0 ? (
              <div className="text-center py-8 text-white/40">
                <Save className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>{t.splash.noSave}</p>
                <p className="text-sm mt-1">{t.splash.noSaveDesc}</p>
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
                      ? "bg-gradient-to-r from-[#00ffc8]/15 via-[#00c8ff]/8 to-transparent border-[#00ffc8]/40"
                      : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                        selectedSaveIndex === index ? "bg-[#00ffc8]/15 text-[#00ffc8]" : "bg-white/10 text-white/80"
                      )}>
                        <span className="text-lg font-bold">{save.teamName.charAt(0)}</span>
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
                {t.splash.navHint}
              </div>
              <button
                onClick={() => { clearAllGameData(); setShowLoadModal(false) }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400/60 hover:text-red-400 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t.splash.deleteSave}
              </button>
            </div>
          )}

          {/* Divisor cloud save */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#091018] px-3 text-white/30 flex items-center gap-1.5">
                <Cloud className="h-3 w-3" />
                {t.splash.cloudOr}
              </span>
            </div>
          </div>

          {/* Seção cloud save */}
          <div className="space-y-2">
            <label className="text-sm text-white/60 font-medium">{t.splash.cloudCodeLabel}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={cloudCode}
                onChange={(e) => {
                  setCloudCode(e.target.value.toUpperCase().replace(/[^A-F0-9]/g, ""))
                  setCloudError("")
                  setCloudSuccess("")
                  setCloudSaveReady(false)
                }}
                placeholder={t.splash.cloudCodePlaceholder}
                maxLength={6}
                disabled={cloudLoading}
                className="flex-1 px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#00ffc8]/30 focus:border-[#00ffc8]/40 font-mono tracking-[0.3em] uppercase transition-all"
              />
              {cloudSaveReady ? (
                <button
                  onClick={() => {
                    const downloaded = loadGameState()
                    if (downloaded.careerId) void handleLoadSave(downloaded.careerId)
                    else setCloudError("O save baixado nao possui uma carreira valida.")
                  }}
                  className="px-4 py-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-semibold text-sm flex items-center gap-2 hover:bg-emerald-500/30 transition-colors"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={handleCloudDownload}
                  disabled={cloudCode.length !== 6 || cloudLoading}
                  className="px-4 py-3 rounded-xl bg-gradient-to-r from-[#00ffc8] to-[#00c8ff] text-black font-semibold text-sm shadow-lg shadow-[#00ffc8]/25 disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed flex items-center gap-2 hover:opacity-90 transition-opacity"
                >
                  {cloudLoading
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <Download className="h-4 w-4" />}
                </button>
              )}
            </div>
            {cloudError && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {cloudError}
              </div>
            )}
            {cloudSuccess && (
              <div className="flex items-center gap-2 text-emerald-400 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {cloudSuccess}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Helper function
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

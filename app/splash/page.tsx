"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { safeLocalGet, safeLocalSet } from "@/lib/safe-storage"
import { mensagemDeErro, validarCodigo } from "@/lib/license"
import { getDeviceId } from "@/lib/device-id"
import { lerRegistro, gravarRegistro } from "@/lib/registration"
import { BENEFICIOS } from "@/lib/beneficios"
import licencasRevogadas from "@/data/seeds/licencas-revogadas.json"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { Globe, Save, FileEdit, X, Key, CheckCircle2, AlertCircle, Clock, Trash2, LogOut, Download, Cloud, ChevronRight, FolderOpen } from "lucide-react"
import { openSavesFolder } from "@/lib/save-folder"
import { activateCareerSave, listCareerSaves, loadGameState, hasSave, clearAllGameData, deleteCareerSave, reconcileCareersWithFolder, useGameState } from "@/lib/save-system"
import { useGameEngine } from "@/lib/game-engine"
import { getTeamByShort } from "@/lib/teams-data"
import { useTranslation } from "@/lib/i18n"
import { useVersaoDoJogo } from "@/lib/versao-do-jogo"
import { isTauri } from "@/lib/game-asset"
import { hardNavigate } from "@/lib/hard-navigation"
import { LegalConsent } from "@/components/legal-consent"
import { downloadSave, getSavedCloudCode } from "@/lib/cloud-save"
import { contaLogada, listarSavesDaConta, type SaveDaConta } from "@/lib/conta-ultrafoot"
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

// Fundo FIXO da tela principal (pedido do usuário 26/07/26): estádio escuro com
// gramado. Substitui o carrossel de prints com vinheta pesada.
const MAIN_MENU_BG = "/images/main-menu-bg.webp"

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
  const versaoDoJogo = useVersaoDoJogo()
  const { state: gameState, setState: setGameState } = useGameState()
  const [phase, setPhase] = useState<SplashPhase>("black")
  // Idioma é a primeira decisão da sessão, antes de qualquer opção de carreira.
  // Selecao de idioma REMOVIDA da splash a pedido do usuario (2026-07-20):
  // o idioma agora se ajusta somente nas Configuracoes. Iniciar como true pula
  // o carrossel direto para o menu; o restante do fluxo fica intacto.
  const [languageSelected, setLanguageSelected] = useState(true)
  const [languageIndex, setLanguageIndex] = useState(0)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isExiting, setIsExiting] = useState(false)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [showLoadModal, setShowLoadModal] = useState(false)
  // Confirmacao de exclusao de save. Substitui o window.confirm nativo, que no
  // Tauri abre uma caixa do Windows sem relacao com a identidade do jogo.
  // `um` guarda o save alvo; `todos` limpa a carreira inteira.
  const [confirmarExclusao, setConfirmarExclusao] = useState<
    { tipo: "um"; id: string; nome: string } | { tipo: "todos" } | null
  >(null)
  const [serialKey, setSerialKey] = useState("")
  const [isRegistered, setIsRegistered] = useState(false)
  const [registerError, setRegisterError] = useState("")
  const [isValidating, setIsValidating] = useState(false)
  const [selectedSaveIndex, setSelectedSaveIndex] = useState(0)
  // Cloud save
  const [cloudCode, setCloudCode] = useState("")
  // Saves catalogados NA CONTA (o launcher e quem entra). Sem isso o jogador
  // precisa lembrar do codigo de cabeca — e quem formatou nao lembra.
  const [savesDaConta, setSavesDaConta] = useState<SaveDaConta[]>([])
  const [nomeDaConta, setNomeDaConta] = useState("")
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

  // Carrega o registro do armazenamento DURAVEL (sobrevive a atualizacoes) e
  // re-le quando o store termina de hidratar do disco — senao o primeiro render
  // (antes do arquivo carregar) diria "nao registrado" a quem esta registrado.
  useEffect(() => {
    const aplicar = () => setIsRegistered(lerRegistro().registrado)
    aplicar()
    window.addEventListener("ultrafoot:store:ready", aplicar)
    const savedCode = getSavedCloudCode()
    if (savedCode) setCloudCode(savedCode)
    void ativarPeloLauncher(aplicar)
    void contaLogada().then(async conta => {
      if (!conta) return
      setNomeDaConta(conta.nome || conta.email)
      setSavesDaConta(await listarSavesDaConta())
    })
    return () => window.removeEventListener("ultrafoot:store:ready", aplicar)
  }, [])

  /**
   * ATIVACAO VINDA DO LAUNCHER — quem informou a chave na conta nao digita de novo.
   *
   * O launcher apenas DEPOSITA a chave num arquivo; a validacao continua sendo
   * feita aqui, com o segredo do jogo. Por isso adulterar o arquivo nao libera
   * nada: um codigo sem assinatura valida e recusado igual ao digitado a mao.
   */
  const ativarPeloLauncher = useCallback(async (aplicar: () => void) => {
    if (lerRegistro().registrado) return
    try {
      const { invoke } = await import("@tauri-apps/api/core")
      const cru = await invoke<string | null>("ler_ativacao_do_launcher")
      if (!cru) return
      const { codigo } = JSON.parse(cru) as { codigo?: string }
      if (!codigo) return
      const r = await validarCodigo(codigo, licencasRevogadas)
      if (!r.valido) return
      gravarRegistro({
        registrado: true,
        serie: r.serie !== undefined ? String(r.serie) : undefined,
        device: getDeviceId(),
        dev: !!r.dev,
      })
      aplicar()
    } catch {
      // Sem Tauri, sem arquivo ou JSON quebrado: segue o fluxo normal de registro.
    }
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
  // Reconcilia com a PASTA de saves quando o modal abre: se o jogador apagou o
  // .json direto na pasta do Windows, o save some daqui também (pedido). O
  // reconcile faz storeRemove/storeSet, que já disparam o refresh acima.
  useEffect(() => {
    if (!showLoadModal) return
    void reconcileCareersWithFolder()
  }, [showLoadModal])

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

  // MENU PRINCIPAL, em tres blocos: jogar, ferramentas e sistema. A ordem antiga
  // punha o Editor de Clubes ENTRE "Novo jogo" e "Carregar jogo", separando as
  // duas acoes que todo mundo procura primeiro.
  //
  // `grupo` so serve para desenhar o divisor: a lista continua sendo UM array,
  // porque teclado e controle navegam por indice sobre ela.
  const mainMenuOptions: {
    id: MenuOption
    label: string
    hint?: string
    grupo: "jogar" | "ferramentas" | "sistema"
    icon: React.ReactNode
    href?: string
  }[] = useMemo(() => [
    { id: "novo-jogo", label: t.splash.newGame, hint: "Escolher clube e comecar uma carreira", grupo: "jogar", icon: <Globe className="h-7 w-7" strokeWidth={1.5} />, href: "/novo-jogo" },
    { id: "carregar", label: t.splash.loadGame, hint: hasSaveGame ? "Continuar uma carreira salva" : "Nenhuma carreira salva ainda", grupo: "jogar", icon: <Save className="h-7 w-7" strokeWidth={1.5} /> },
    { id: "editar", label: t.splash.clubEditor, hint: "Nomes, escudos, uniformes e elencos", grupo: "ferramentas", icon: <FileEdit className="h-7 w-7" strokeWidth={1.5} />, href: "/editar" },
    // REGISTRAR so aparece para quem AINDA NAO registrou (pedido 30/07/26): depois
    // do codigo aceito o item nao tem mais funcao — o estado ja fica no selo
    // "Registrado" ao lado do titulo. O jogo continua sem travar quem nao registrou.
    ...(!isRegistered
      ? [{ id: "registrar" as MenuOption, label: t.splash.register, hint: "Liberar os extras com o seu codigo", grupo: "sistema" as const, icon: <Key className="h-7 w-7 text-amber-400" strokeWidth={1.5} /> }]
      : []),
    { id: "sair", label: t.splash.exit, hint: "Fechar o jogo", grupo: "sistema", icon: <LogOut className="h-7 w-7" strokeWidth={1.5} /> },
    // Memoizado porque a lista entra nas dependencias do teclado/controle: um
    // array novo a cada render reinstalava os listeners sem parar.
  ], [t, isRegistered, hasSaveGame])

  // Quem registra COM O MENU ABERTO perde um item da lista. Sem este ajuste o
  // cursor ficaria apontando para fora dela e o Enter nao faria nada.
  useEffect(() => {
    setSelectedIndex(atual => Math.min(atual, mainMenuOptions.length - 1))
  }, [mainMenuOptions.length])

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
      const parametros = typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams()

      // ?registrar=1 — veio de uma tela de recurso extra ("Registrar o jogo").
      // Cai no menu JA com o campo do codigo aberto; obrigar a pessoa a caçar o
      // item no menu depois de clicar em registrar seria um convite pela metade.
      if (parametros.get("registrar") === "1") {
        setPhase("main-menu")
        setShowRegisterModal(true)
        return
      }

      // Se vier com ?menu=1 (ex: ao pressionar Voltar de outra tela), pula direto pro menu
      if (parametros.get("menu") === "1") {
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
    
    // A validacao e local e instantanea; a espera existe so para o campo nao
    // piscar entre "validando" e o resultado.
    await delay(600)

    const r = await validarCodigo(serialKey, licencasRevogadas)
    if (r.valido) {
      // UM CODIGO POR MAQUINA (pedido). Se esta instalacao ja foi registrada com
      // OUTRO codigo, recusa — sem isso a mesma maquina cadastraria varios
      // codigos. O codigo MASTER (dev) e isento: o time testa em varias maquinas
      // e alterna com codigos de venda para reproduzir o que o comprador ve.
      const serieAtual = lerRegistro().serie
      if (!r.dev && serieAtual && r.serie !== undefined && serieAtual !== String(r.serie)) {
        setRegisterError("Esta máquina já foi registrada com outro código.")
        setIsValidating(false)
        return
      }
      // Grava no armazenamento DURAVEL (+ espelho no localStorage). E por isso
      // que atualizar o jogo nao desregistra mais: a fonte de verdade e o mesmo
      // arquivo que guarda os saves.
      gravarRegistro({
        registrado: true,
        serie: r.serie !== undefined ? String(r.serie) : undefined,
        device: getDeviceId(),
        dev: !!r.dev,
      })
      setIsRegistered(true)
      setIsValidating(false)
      setTimeout(() => {
        setShowRegisterModal(false)
      }, 2000)
    } else {
      setRegisterError(mensagemDeErro(r.motivo))
      setIsValidating(false)
    }
  }, [serialKey])

  // Handler para baixar save da nuvem
  const handleCloudDownload = useCallback(async () => {
    if (cloudCode.length !== 6) return
    // Recuperar da nuvem e o outro lado do save na nuvem: extra de quem
    // registrou (lib/beneficios.ts). O save LOCAL continua livre para todos.
    if (!lerRegistro().registrado) {
      setCloudError("Recuperar da nuvem é um extra de quem registrou o jogo. Use o código no menu Registrar.")
      return
    }
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
          // Se o foco esta em OUTRO botao do modal (ex.: "Apagar save"), deixa o
          // Enter nativo clicar nele. Antes este handler interceptava sempre e
          // carregava o save — "seleciono para apagar e ele abre o jogo".
          const focado = document.activeElement as HTMLElement | null
          if (focado?.closest("[data-acao-modal]")) return
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
            <Globe className="mx-auto h-11 w-11 text-[var(--brand)]" />
            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.24em] text-[var(--brand)]">Ultrafoot 26</p>
            <h1 className="mt-2 text-2xl font-black text-white">Escolha o idioma</h1>
            <p className="mt-2 text-sm text-white/50">Você poderá alterá-lo depois nas configurações.</p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button onClick={() => moveLanguage(-1)} aria-label="País anterior" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-6 text-xl text-white/70 hover:border-[var(--brand)] hover:text-[var(--brand)]">‹</button>
              <button onClick={() => moveLanguage(-1)} className="hidden w-24 rounded-xl border border-white/10 bg-white/[0.03] p-2 opacity-45 transition hover:opacity-80 sm:block"><Image src={`/flags/${previous.flag}.png`} alt={previous.country} width={48} height={32} className="mx-auto h-8 w-12 object-cover" /><span className="mt-2 block truncate text-[10px] text-white">{previous.code}</span></button>
              <button onClick={() => selectLanguage()} className="w-44 rounded-2xl border-2 border-[var(--brand)] bg-[var(--brand)]/10 px-4 py-4 shadow-[0_0_26px_rgba(0,255,200,.16)] transition hover:bg-[var(--brand)]/20"><Image src={`/flags/${current.flag}.png`} alt={`Bandeira de ${current.country}`} width={96} height={64} className="mx-auto h-14 w-24 rounded object-cover shadow" /><span className="mt-3 block text-lg font-black text-white">{current.language}</span><span className="mt-1 block text-xs text-[var(--brand)]">{current.country}</span></button>
              <button onClick={() => moveLanguage(1)} className="hidden w-24 rounded-xl border border-white/10 bg-white/[0.03] p-2 opacity-45 transition hover:opacity-80 sm:block"><Image src={`/flags/${next.flag}.png`} alt={next.country} width={48} height={32} className="mx-auto h-8 w-12 object-cover" /><span className="mt-2 block truncate text-[10px] text-white">{next.code}</span></button>
              <button onClick={() => moveLanguage(1)} aria-label="Próximo país" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-6 text-xl text-white/70 hover:border-[var(--brand)] hover:text-[var(--brand)]">›</button>
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
                    background: "linear-gradient(90deg, var(--brand) 0%, var(--brand-2) 50%, var(--brand) 100%)",
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

        {/* Fundo FIXO (tela principal.png): estádio escuro com gramado. Vinheta
            reduzida ao MÍNIMO — o fundo aparece quase limpo. Só um leve reforço
            à esquerda (legibilidade dos botões) e um rodapé sutil para a barra
            de dicas. Sem o escurecimento pesado de tela cheia que havia antes. */}
        <div className="absolute inset-0 overflow-hidden">
          <Image
            src={MAIN_MENU_BG}
            alt=""
            fill
            className="object-cover"
            style={{
              transform: phase === "main-menu" ? "scale(1.04)" : "scale(1)",
              transition: "transform 16s ease-out",
            }}
            priority
            unoptimized
          />
          {/* Vinheta mínima só à esquerda, sob os botões. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(4,6,10,0.78) 0%, rgba(4,6,10,0.42) 28%, rgba(4,6,10,0.05) 52%, transparent 68%)",
            }}
          />
          {/* Rodapé sutil para a barra de dicas de controle. */}
          <div
            className="absolute inset-x-0 bottom-0 h-36"
            style={{ background: "linear-gradient(0deg, rgba(4,6,10,0.6) 0%, transparent 100%)" }}
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

            {/* Menu vertical — agrupado num painel de vidro para leitura limpa e
                organizada sobre o fundo do estádio. */}
            <nav
              className="flex flex-col gap-1.5 rounded-2xl border border-white/[0.08] bg-[#080b12]/55 p-2.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)] backdrop-blur-md"
              style={{
                animation: phase === "main-menu" ? "slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards" : "none",
                opacity: 0,
              }}
            >
              {mainMenuOptions.map((option, index) => {
                const isSelected = selectedIndex === index
                // Divisor entre blocos (jogar / ferramentas / sistema).
                const abreBloco = index > 0 && mainMenuOptions[index - 1].grupo !== option.grupo
                return (
                  <div key={option.id}>
                    {abreBloco && <div className="mx-3 my-1.5 h-px bg-white/[0.07]" />}
                    <button
                      onClick={() => handleMenuSelect(index)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        "group relative flex w-full items-center gap-3.5 rounded-xl border px-3.5 py-2.5 text-left transition-all duration-200 overflow-hidden",
                        isSelected
                          ? "border-[var(--brand)]/35"
                          : "border-transparent hover:border-white/10 hover:bg-white/[0.03]"
                      )}
                      style={{
                        background: isSelected
                          ? "linear-gradient(90deg, rgba(0,255,200,0.16) 0%, rgba(0,200,255,0.06) 50%, transparent 100%)"
                          : "transparent",
                        boxShadow: isSelected ? "0 8px 26px rgba(0,255,200,0.1)" : "none",
                      }}
                    >
                      {/* Barra de acento esquerda */}
                      <span
                        className={cn(
                          "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full transition-all duration-300",
                          isSelected ? "h-9 bg-gradient-to-b from-[var(--brand)] to-[var(--brand-2)]" : "h-0 bg-transparent"
                        )}
                      />

                      {/* Icone */}
                      <div className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-all duration-200 [&>svg]:h-5 [&>svg]:w-5",
                        isSelected ? "bg-[var(--brand)]/15 text-[var(--brand)]" : "bg-white/[0.05] text-white/45 group-hover:text-white/70"
                      )}>
                        {option.icon}
                      </div>

                      {/* Label + linha de apoio (o menu dizia so o nome da acao) */}
                      <span className="min-w-0 flex-1">
                        <span className={cn(
                          "block truncate font-bold text-sm tracking-wide transition-colors duration-200",
                          isSelected ? "text-white" : "text-white/55 group-hover:text-white/80"
                        )}>
                          {option.label}
                        </span>
                        {option.hint && (
                          <span className={cn(
                            "block truncate text-[10.5px] font-medium transition-colors duration-200",
                            isSelected ? "text-white/45" : "text-white/25"
                          )}>
                            {option.hint}
                          </span>
                        )}
                      </span>

                      {/* Chevron do item selecionado */}
                      <ChevronRight className={cn(
                        "h-4 w-4 shrink-0 transition-all duration-200",
                        isSelected ? "text-[var(--brand)] opacity-100 translate-x-0" : "text-white/0 opacity-0 -translate-x-2"
                      )} />
                    </button>
                  </div>
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
              <kbd className="flex h-5 min-w-5 items-center justify-center rounded border border-[var(--brand)]/30 bg-[var(--brand)]/10 px-1 text-[10px] text-[var(--brand)]">↵</kbd>
              Selecionar
            </span>
            {/* VERSAO DO JOGO no canto direito do rodape (pedido). Sai do
                package.json no build e, no desktop, da versao realmente
                instalada — util para saber se a atualizacao pegou. */}
            {versaoDoJogo && (
              <>
                <span className="h-4 w-px bg-white/10" />
                <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold tabular-nums tracking-wider text-white/40">
                  v{versaoDoJogo}
                </span>
              </>
            )}
          </div>
        </div>

      </div>

      {/* Modal de Registro */}
      <Dialog open={showRegisterModal} onOpenChange={setShowRegisterModal}>
        <DialogContent 
          className="bg-gradient-to-br from-[#0a1414] via-[#091018] to-[#060b0e] border-[var(--brand)]/15 text-white max-w-md"
          showCloseButton={!isValidating}
        >
          {/* Glow teal sutil no topo, alinhado a identidade do jogo */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--brand)]/40 to-transparent" />
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[var(--brand)] to-[var(--brand-2)] shadow-lg shadow-[var(--brand)]/25">
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
                    : "border-white/10 focus:ring-[var(--brand)]/30 focus:border-[var(--brand)]/40"
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
                    : "bg-gradient-to-r from-[var(--brand)] to-[var(--brand-2)] text-black shadow-lg shadow-[var(--brand)]/25 hover:opacity-90 hover:scale-[1.02]"
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

            {/* O QUE O CODIGO LIBERA. O modal pedia a chave sem nunca dizer o
                que vinha em troca — registrar parecia burocracia. A lista sai de
                lib/beneficios.ts, a mesma que as telas bloqueadas mostram. */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                {isRegistered ? "Liberado para você" : "O que o código libera"}
              </p>
              <ul className="space-y-1.5">
                {BENEFICIOS.map(b => (
                  <li key={b.id} className="flex items-start gap-2 text-xs text-white/50">
                    <CheckCircle2 className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", isRegistered ? "text-emerald-400" : "text-[var(--brand)]/60")} />
                    <span><span className="text-white/75">{b.titulo}</span> — {b.descricao}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-white/30">
                Sem o código o jogo continua completo: carreira, competições e todos os modos.
              </p>
            </div>

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
          className="bg-gradient-to-br from-[#0a1414] via-[#091018] to-[#060b0e] border-[var(--brand)]/15 text-white max-w-lg"
        >
          {/* Glow teal sutil no topo, alinhado a identidade do jogo */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--brand)]/40 to-transparent" />
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[var(--brand)] to-[var(--brand-2)] shadow-lg shadow-[var(--brand)]/25">
                <Save className="h-5 w-5 text-black" />
              </div>
              {t.splash.loadTitle}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              {t.splash.loadDesc}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-4 max-h-[52vh] overflow-y-auto pr-1 scrollbar-thin">
            {savedGames.length === 0 ? (
              <div className="text-center py-8 text-white/40">
                <Save className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>{t.splash.noSave}</p>
                <p className="text-sm mt-1">{t.splash.noSaveDesc}</p>
              </div>
            ) : (
              savedGames.map((save, index) => (
                <div
                  key={save.id}
                  onMouseEnter={() => setSelectedSaveIndex(index)}
                  className={cn(
                    "group relative rounded-xl border transition-all duration-200",
                    selectedSaveIndex === index
                      ? "bg-gradient-to-r from-[var(--brand)]/15 via-[var(--brand-2)]/8 to-transparent border-[var(--brand)]/40"
                      : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20"
                  )}
                >
                  <button onClick={() => handleLoadSave(save.id)} className="w-full p-4 pr-14 text-left">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center transition-colors ring-1",
                          selectedSaveIndex === index
                            ? "bg-[var(--brand)]/15 text-[var(--brand)] ring-[var(--brand)]/30"
                            : "bg-white/10 text-white/80 ring-white/10"
                        )}>
                          <span className="text-xl font-bold">{save.teamName.charAt(0)}</span>
                        </div>
                        <div>
                          <div className="font-bold text-white leading-tight">{save.teamName}</div>
                          <div className="mt-0.5 text-xs text-white/45">{save.competition} · {save.position}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-white/70 tabular-nums">{save.season}</div>
                        <div className="text-xs text-white/30 flex items-center gap-1 justify-end">
                          <Clock className="h-3 w-3" />
                          <span className="tabular-nums">{save.date}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                  {/* Apagar ESTE save (pedido: um de cada vez, não todos). */}
                  <button
                    data-acao-modal="apagar-um"
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirmarExclusao({ tipo: "um", id: save.id, nome: save.teamName })
                    }}
                    title="Apagar este save"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2.5 text-red-400/50 opacity-0 transition-all group-hover:opacity-100 focus-visible:opacity-100 hover:bg-red-500/15 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/10 mt-4">
            {/* Abrir a pasta VISÍVEL de saves no Windows (Documentos\Ultrafoot 26 Saves). */}
            <button
              data-acao-modal="pasta"
              onClick={() => { void openSavesFolder() }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/40 hover:text-[var(--brand)] transition-colors"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Abrir pasta de saves
            </button>
            {savedGames.length > 0 && (
              <button
                data-acao-modal="apagar"
                onClick={() => setConfirmarExclusao({ tipo: "todos" })}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400/60 hover:text-red-400 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t.splash.deleteSave}
              </button>
            )}
          </div>

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
            {/* SAVES DA CONTA — aparece so para quem entrou pelo launcher. Um
                clique baixa; o campo de codigo continua ali para quem prefere
                digitar ou recebeu um codigo de outra pessoa. */}
            {savesDaConta.length > 0 && (
              <div className="mb-3 rounded-xl border border-[var(--brand)]/20 bg-[var(--brand)]/[0.04] p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[var(--brand)]">
                  <Cloud className="h-3.5 w-3.5" />
                  Suas carreiras na nuvem
                  {nomeDaConta && <span className="font-normal text-white/35">· {nomeDaConta}</span>}
                </div>
                <div className="space-y-1.5">
                  {savesDaConta.slice(0, 5).map(save => (
                    <button
                      key={save.codigo}
                      onClick={() => { setCloudCode(save.codigo); setCloudError(""); setCloudSuccess("") }}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/5 bg-black/30 px-3 py-2 text-left transition-colors hover:border-[var(--brand)]/30 hover:bg-black/50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-white">
                          {save.rotulo || "Carreira salva"}
                        </span>
                        <span className="block text-[11px] text-white/35">
                          {new Date(save.atualizado_em * 1000).toLocaleDateString("pt-BR")}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-xs tracking-widest text-[var(--brand)]">
                        {save.codigo}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
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
                className="flex-1 px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/30 focus:border-[var(--brand)]/40 font-mono tracking-[0.3em] uppercase transition-all"
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
                  className="px-4 py-3 rounded-xl bg-gradient-to-r from-[var(--brand)] to-[var(--brand-2)] text-black font-semibold text-sm shadow-lg shadow-[var(--brand)]/25 disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed flex items-center gap-2 hover:opacity-90 transition-opacity"
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

      {/* Confirmacao de exclusao — mesmo visual do modal de Carregar Jogo.
          Apagar save e irreversivel, entao a acao destrutiva nunca e a primeira
          do teclado: o botao "Cancelar" vem antes e recebe o foco. Quando o alvo
          e UM save, oferecemos tambem apagar todos, que era o par de opcoes
          pedido ("todos os saves ou apenas esse?"). */}
      <Dialog open={confirmarExclusao !== null} onOpenChange={(aberto) => { if (!aberto) setConfirmarExclusao(null) }}>
        <DialogContent className="bg-gradient-to-br from-[#140a0a] via-[#180909] to-[#0e0606] border-red-500/20 text-white max-w-md">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent" />
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-red-500 to-orange-500 shadow-lg shadow-red-500/25">
                <Trash2 className="h-5 w-5 text-black" />
              </div>
              {confirmarExclusao?.tipo === "todos" ? "Apagar todos os saves" : "Apagar save"}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              {confirmarExclusao?.tipo === "todos"
                ? "Todas as carreiras salvas serão removidas. Esta ação não pode ser desfeita."
                : `A carreira "${confirmarExclusao?.tipo === "um" ? confirmarExclusao.nome : ""}" será removida. Esta ação não pode ser desfeita.`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 pt-4">
            <button
              autoFocus
              onClick={() => setConfirmarExclusao(null)}
              className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/15 text-white font-semibold text-sm hover:bg-white/10 transition-colors"
            >
              Cancelar
            </button>

            {confirmarExclusao?.tipo === "um" && (
              <button
                onClick={() => {
                  deleteCareerSave(confirmarExclusao.id)
                  setConfirmarExclusao(null)
                }}
                className="w-full px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 font-semibold text-sm hover:bg-red-500/25 transition-colors"
              >
                Apagar apenas este save
              </button>
            )}

            <button
              onClick={() => {
                clearAllGameData()
                setConfirmarExclusao(null)
                setShowLoadModal(false)
              }}
              className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 text-white font-bold text-sm shadow-lg shadow-red-600/25 hover:opacity-90 transition-opacity"
            >
              Apagar TODOS os saves
            </button>
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

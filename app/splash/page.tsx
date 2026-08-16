"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { safeLocalGet, safeLocalSet } from "@/lib/safe-storage"
import { mensagemDeErro, normalizarCodigo, validarCodigo } from "@/lib/license"
import { ativarOnline, migrarSePreciso, pareceFormatoDeCodigo } from "@/lib/licenca-certificado"
import { getDeviceId } from "@/lib/device-id"
import { lerRegistro, gravarRegistro } from "@/lib/registration"
import { BENEFICIOS } from "@/lib/beneficios"
import licencasRevogadas from "@/data/seeds/licencas-revogadas.json"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { Globe, Save, X, Key, CheckCircle2, AlertCircle, Clock, Trash2, Download, Cloud, FolderOpen, Settings, PersonStanding, Loader2, Users } from "lucide-react"
import { openSavesFolder } from "@/lib/save-folder"
import { activateCareerSave, listCareerSaves, loadGameState, hasSave, clearAllGameData, deleteCareerSave, reconcileCareersWithFolder, useGameState } from "@/lib/save-system"
// ⚠️ NADA DE `@/lib/game-engine` NEM `@/lib/teams-data` NO TOPO DESTE ARQUIVO.
// Os dois arrastam os seeds (pool de 2.452 clubes + elencos reais): 17 MB de
// JavaScript que o jogador baixava e o navegador interpretava ANTES do menu
// principal aparecer. Aqui eles entram por `await import(...)`, no momento em que
// a pessoa realmente entra numa carreira. Ver lib/time-da-carreira.
import { useTranslation } from "@/lib/i18n"
import { useVersaoDoJogo } from "@/lib/versao-do-jogo"
import { isTauri } from "@/lib/game-asset"
import { hardNavigate } from "@/lib/hard-navigation"
import { carregarElencosDoPool } from "@/lib/pool-elencos"
import { carregarElencosReaisTM } from "@/lib/elencos-reais-tm"
import { LegalConsent } from "@/components/legal-consent"
import { MenuBackground } from "@/components/menu-background"
import { PainelConfiguracoes, PainelAcessibilidade } from "@/components/menu-preferencias"
import { downloadSave, getSavedCloudCode, inspecionarCodigo } from "@/lib/cloud-save"
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
  | "main-menu"
  | "fade-out"

type MenuOption = "novo-jogo" | "carreira-jogador" | "online" | "editar" | "carregar" | "registrar" | "sair"

// O fundo da tela principal virou um CARROSSEL com crossfade (ver
// components/menu-background). Antes era o carrossel de PRINTS do jogo com
// vinheta pesada; em 26/07/26 virou o estádio fixo (`main-menu-bg.webp`) para
// tirar o peso e a sujeira; agora volta a alternar, mas com arte feita para ser
// fundo e sem o escurecimento que apagava a imagem.

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
  const { state: gameState, setState: setGameState, hydrated } = useGameState()
  const [phase, setPhase] = useState<SplashPhase>("black")
  // Idioma é a primeira decisão da sessão, antes de qualquer opção de carreira.
  // Selecao de idioma REMOVIDA da splash a pedido do usuario (2026-07-20):
  // o idioma agora se ajusta somente nas Configuracoes. Iniciar como true pula
  // o carrossel direto para o menu; o restante do fluxo fica intacto.
  const [languageSelected, setLanguageSelected] = useState(true)
  const [languageIndex, setLanguageIndex] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isExiting, setIsExiting] = useState(false)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [showLoadModal, setShowLoadModal] = useState(false)
  // Painel lateral aberto pelos dois icones do canto superior esquerdo. Um por
  // vez: sao a mesma gaveta, com conteudos diferentes.
  const [painel, setPainel] = useState<"config" | "acessibilidade" | null>(null)
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
  // Os elencos do pool (7,91 MB) saíram do bundle e chegam sob demanda. A splash
  // é o melhor momento para buscá-los: o usuário ainda vai escolher clube, e
  // quando chegar em "COMEÇAR" o dado já está na memória — sem espera visível.
  // Ver `lib/pool-elencos.ts`.
  useEffect(() => {
    void carregarElencosDoPool()
    void carregarElencosReaisTM()
  }, [])

  useEffect(() => {
    const aplicar = () => setIsRegistered(lerRegistro().registrado)
    aplicar()
    window.addEventListener("ultrafoot:store:ready", aplicar)
    const savedCode = getSavedCloudCode()
    if (savedCode) setCloudCode(savedCode)
    void ativarPeloLauncher(aplicar)

    // MIGRACAO SILENCIOSA PARA Ed25519 (etapa 7 do plano).
    //
    // Quem tem chave do esquema antigo recebe a nova sozinho: o modulo busca em
    // /licenca/minha e ativa. O jogador abre o jogo e continua registrado, sem
    // digitar nada.
    //
    // Best-effort de proposito — falhar aqui NAO desregistra ninguem. Sem conta
    // ou sem rede, o registro antigo segue valendo ate o corte da v1.0.202, e o
    // jogo continua nao travando de qualquer jeito.
    void migrarSePreciso().then(migrou => {
      if (migrou) {
        gravarRegistro({ registrado: true, device: getDeviceId() })
        setIsRegistered(true)
      }
    })
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

  // NOME DO CLUBE DE CADA CARREIRA — só quando o modal de carregar abre.
  //
  // Resolver isto exige `teams-data`, que traz o pool de 2.452 clubes junto. Era
  // o último fio prendendo os 17 MB de seeds ao menu principal, para escrever
  // "Flamengo" em vez de "FLA" numa lista que a maioria nem abre. Agora o dado
  // chega depois: a lista aparece com a sigla e o nome entra quando carregar.
  const [nomesDeClube, setNomesDeClube] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!showLoadModal) return
    let vivo = true
    void import("@/lib/teams-data").then(({ getTeamByShort }) => {
      if (!vivo) return
      const mapa: Record<string, string> = {}
      for (const carreira of saveInfo.careers) {
        const nome = getTeamByShort(carreira.teamShort)?.nome
        if (nome) mapa[carreira.teamShort] = nome
      }
      setNomesDeClube(mapa)
    })
    return () => {
      vivo = false
    }
  }, [showLoadModal, saveInfo.careers])

  const hasSaveGame = saveInfo.hasSaveGame
  const savedGames = saveInfo.careers.map(career => {
    return {
        id: career.id,
        name: career.name,
        // Cai na sigla enquanto o nome não chega — que já era o comportamento
        // quando o clube não estava no pool.
        teamName: nomesDeClube[career.teamShort] || career.teamShort,
        season: `${career.season}/${career.season + 1}`,
        date: career.updatedAt ? new Date(career.updatedAt).toLocaleDateString("pt-BR") : "-",
        position: `Semana ${career.week}`,
        competition: "Serie A",
        // Carreira de mesa (co-op local). Ver `CareerSaveSummary.tecnicos`.
        tecnicos: career.tecnicos ?? 1,
      }
  })

  // MENU PRINCIPAL, em tres blocos: jogar, ferramentas e sistema. A ordem antiga
  // punha o Editor de Clubes ENTRE "Novo jogo" e "Carregar jogo", separando as
  // duas acoes que todo mundo procura primeiro.
  //
  // `grupo` so serve para separar visualmente os blocos: a lista continua sendo
  // UM array, porque teclado e controle navegam por indice sobre ela.
  //
  // Os icones sairam na 1.0.267: o menu virou lista de texto puro (referencia do
  // eFootball), onde o item ativo se destaca pelo TAMANHO e pelo tracinho da
  // marca, nao por um quadradinho colorido.
  const mainMenuOptions: {
    id: MenuOption
    label: string
    hint?: string
    grupo: "jogar" | "ferramentas" | "sistema"
    href?: string
  }[] = useMemo(() => [
    { id: "novo-jogo", label: t.splash.newGame, hint: "Escolher clube e comecar uma carreira", grupo: "jogar", href: "/novo-jogo" },
    // CARREIRA DE JOGADOR no menu principal (1.0.324, pedido do usuario).
    //
    // Ela nasceu como uma das opcoes do seletor de modalidade da tela de
    // criacao, ao lado de profissional/feminino/sub-20. Estava no lugar errado:
    // aquele seletor responde "que clube voce vai dirigir?", e quem escolhe ser
    // ATLETA nao esta dirigindo clube nenhum — escolhe um corpo primeiro. As
    // tres de tecnico continuam juntas la dentro; esta ganha porta propria.
    { id: "carreira-jogador", label: "Carreira de jogador", hint: "Um atleta so: da estreia a aposentadoria", grupo: "jogar", href: "/novo-jogo?modo=jogador" },
    // ONLINE só existe quando o jogo está EM MODO ONLINE (1.0.327, pedido do
    // usuario: "devem aparecer na tela de novo jogo e menu apenas no modo
    // online"). O interruptor nao e novo — e o `multiplayerEnabled` do save,
    // ligado em Configuracoes. Desligado, quem joga sozinho nao ve um item
    // sequer de online no caminho.
    ...(gameState.multiplayerEnabled
      ? [{ id: "online" as MenuOption, label: "Online", hint: "FC Hub, amistosos e modos entre tecnicos", grupo: "jogar" as const, href: "/online" }]
      : []),
    { id: "carregar", label: t.splash.loadGame, hint: hasSaveGame ? "Continuar uma carreira salva" : "Nenhuma carreira salva ainda", grupo: "jogar" },
    { id: "editar", label: t.splash.clubEditor, hint: "Nomes, escudos, uniformes e elencos", grupo: "ferramentas", href: "/editar" },
    // REGISTRAR so aparece para quem AINDA NAO registrou (pedido 30/07/26): depois
    // do codigo aceito o item nao tem mais funcao — o estado ja fica no selo
    // "Registrado" ao lado do titulo. O jogo continua sem travar quem nao registrou.
    ...(!isRegistered
      ? [{ id: "registrar" as MenuOption, label: t.splash.register, hint: "Liberar os extras com o seu codigo", grupo: "sistema" as const }]
      : []),
    { id: "sair", label: t.splash.exit, hint: "Fechar o jogo", grupo: "sistema" },
    // Memoizado porque a lista entra nas dependencias do teclado/controle: um
    // array novo a cada render reinstalava os listeners sem parar.
  ], [t, isRegistered, hasSaveGame, gameState.multiplayerEnabled])

  // Quem registra COM O MENU ABERTO perde um item da lista. Sem este ajuste o
  // cursor ficaria apontando para fora dela e o Enter nao faria nada.
  useEffect(() => {
    setSelectedIndex(atual => Math.min(atual, mainMenuOptions.length - 1))
  }, [mainMenuOptions.length])

  // ABERTURA. Era uma sequencia de 8,5 s: preto 0,8 + estudio 2 + aviso 2 + ligas
  // 2,5 + barra 1,2. Cada troca de fase ainda levava 1 s de dissolucao. Ficava
  // longa e arrastada — jogo profissional abre rapido e deixa pular.
  //
  // Agora: ~1,3 s somente na primeira vez. A abertura continua identificando o
  // jogo, mas nunca se comporta como uma tela de carregamento; qualquer clique
  // ou tecla ainda corta direto para o menu.
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
        if (!(await wait(80))) return
        setPhase("studio-logo")
        if (!(await wait(500))) return
        setPhase("ea-warning")
        if (!(await wait(350))) return
        setPhase("leagues")
        if (!(await wait(350))) return
        safeLocalSet(INTRO_VISTA, "1")
      }

      // A TELA DE CARREGAMENTO SAIU (1.0.267, pedido). Ela era teatro: a barra
      // andava de 0 a 100 por temporizador, sem esperar carga nenhuma — o menu
      // já estava pronto. Agora a abertura vai direto para ele.
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
      hardNavigate(href)
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
    //
    // O motor entra por import dinamico: e aqui, ao ABRIR uma carreira, que os
    // seeds passam a fazer falta — nao na hora de desenhar o menu.
    const [{ useGameEngine, persistGameEngineNow }, { storeGet }] = await Promise.all([
      import("@/lib/game-engine"),
      import("@/lib/persistent-store"),
    ])
    const salvo = loadGameState()
    const chaveDoMotor = `ultrafoot-game-engine:${saveId}`
    const tinhaMotorProprio = storeGet(chaveDoMotor) !== null

    if (tinhaMotorProprio) await useGameEngine.persist.rehydrate()

    // Save antigo/importado pode nao ter um motor proprio. O Zustand conserva o
    // estado atual quando rehydrate recebe null; sem zerar, abrir B reutilizava
    // elenco, caixa e tatica de A. Tambem repara um motor cuja identidade nao
    // corresponde ao clube persistido no save.
    const motorBate = Boolean(
      salvo.selectedTeamShort
      && useGameEngine.getState().myTeamShort === salvo.selectedTeamShort
      && useGameEngine.getState().squadPlayers.length > 0,
    )
    if (!tinhaMotorProprio || (salvo.selectedTeamShort && !motorBate)) {
      useGameEngine.setState(useGameEngine.getInitialState(), true)
      if (salvo.selectedTeamShort) {
        await Promise.all([carregarElencosDoPool(), carregarElencosReaisTM()])
        useGameEngine.getState().initializeGame(
          salvo.selectedTeamShort,
          salvo.selectedTeam?.fileKey,
        )
      }
      persistGameEngineNow()
    }
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("ultrafoot:session-active", "true")
    }
    setIsExiting(true)
    hardNavigate("/")
  }, [])

  // Funcao para validar e registrar o jogo
  const handleRegister = useCallback(async () => {
    setRegisterError("")
    setIsValidating(true)
    
    // Guardado para o caso de os DOIS esquemas recusarem: a mensagem do servidor
    // ("ja esta em uso em outro computador", "indisponivel") explica melhor do
    // que o "codigo invalido" generico do esquema antigo.
    let erroDoEsquemaNovo: string | undefined

    // ESQUEMA NOVO PRIMEIRO (Ed25519). O codigo digitado e conferido no
    // servidor, que devolve um certificado assinado para o jogo guardar.
    //
    // Os dois formatos sao IDENTICOS na tela (UF26-XXXXX-XXXXX-XXXXX), entao nao
    // da para saber qual e qual olhando o texto: quem decide e o servidor. Por
    // isso tentamos o novo e, se ele nao reconhecer, caimos no antigo — que
    // continua valendo ate o corte da v1.0.202.
    if (pareceFormatoDeCodigo(serialKey)) {
      const novo = await ativarOnline(normalizarCodigo(serialKey))
      if (novo.ok) {
        gravarRegistro({ registrado: true, device: getDeviceId() })
        setIsRegistered(true)
        setIsValidating(false)
        setTimeout(() => setShowRegisterModal(false), 600)
        return
      }
      erroDoEsquemaNovo = novo.erro
    }

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
      setTimeout(() => setShowRegisterModal(false), 600)
    } else {
      // Os DOIS esquemas recusaram. Quando o servidor deu um motivo concreto
      // ("ja em uso em outro computador", "servidor indisponivel"), ele explica
      // melhor do que o generico — quem pagou merece saber o que fazer.
      setRegisterError(erroDoEsquemaNovo ?? mensagemDeErro(r.motivo))
      setIsValidating(false)
    }
  }, [serialKey])

  // Handler para baixar save da nuvem
  const handleCloudDownload = useCallback(async (codigoDireto?: string) => {
    const codigo = (codigoDireto ?? cloudCode).trim().toUpperCase()
    if (codigo.length !== 6) return
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

    // ⚠️ CÓDIGO ANTIGO (v2) APAGA AS CARREIRAS DESTE APARELHO. Ele é o retrato de
    // uma máquina inteira, não uma carreira — restaurá-lo é voltar tudo para
    // aquele dia. Um código novo traz UMA carreira e entra ao lado das outras.
    // A pessoa precisa saber qual dos dois está prestes a usar.
    const previa = await inspecionarCodigo(codigo)
    if (previa.ok && previa.substituiTudo) {
      const segue = window.confirm(
        `Este é um código antigo: ele guarda o aparelho inteiro (${previa.rotulo}).\n\n`
        + "Baixar vai SUBSTITUIR todas as carreiras que estão neste aparelho.\n\n"
        + "Continuar?",
      )
      if (!segue) { setCloudLoading(false); return }
    }

    const result = await downloadSave(codigo)

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
      // Painel aberto engole a navegacao: sem isto as setas continuavam movendo
      // o cursor do menu atras da gaveta e o Enter abria a tela escondida.
      if (painel) {
        if (e.key === "Escape") {
          e.preventDefault()
          setPainel(null)
        }
        return
      }

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

      if (painel) {
        if (button === "B") setPainel(null)
        return
      }

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
  }, [phase, selectedIndex, handleMenuSelect, mainMenuOptions, showRegisterModal, showLoadModal, painel, isRegistered, selectedSaveIndex, savedGames, handleLoadSave, languageSelected, moveLanguage, selectLanguage])

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
              src="/images/agencia-do-japa-logo.webp"
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

      {/* Phase: Main Menu - EAFC Style */}
      <div className={cn(
        "absolute inset-0 flex flex-col transition-all duration-700",
        phase === "main-menu" ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>

        {/* Fundo em CARROSSEL com crossfade suave (pedido): as seis artes de
            `Tela/`, alternando a cada 9s com 2,2s de passagem. Substituiu o fundo
            fixo do estádio. A vinheta continua no mínimo — só o reforço à esquerda,
            sob os botões, e o rodapé da barra de dicas. Ver components/menu-background. */}
        <div className="absolute inset-0 overflow-hidden">
          <MenuBackground ativo={phase === "main-menu"} className="absolute inset-0" />
          {/* VINHETA SÓ DO LADO DO MENU, no tom mais leve que ainda sustenta o
              texto (pedido). Uma camada só, sem recorte: qualquer clip-path aqui
              cria uma borda diagonal DURA, que é o oposto de suave. O degradê
              tem cinco paradas justamente para não ter degrau — ele morre por
              volta de 36% da tela e não encosta na arte central.
              A legibilidade que a vinheta deixou de dar veio para o texto, em
              forma de sombra (ver a lista abaixo): sombra pesa no glifo, não na
              foto inteira. */}
          <div
            className="absolute inset-y-0 left-0 w-[44%]"
            style={{
              background:
                "linear-gradient(90deg, rgba(2,4,7,0.72) 0%, rgba(2,4,7,0.58) 26%, rgba(2,4,7,0.34) 48%, rgba(2,4,7,0.12) 68%, transparent 86%)",
            }}
          />
          {/* Rodapé sutil para a barra de dicas de controle. */}
          <div
            className="absolute inset-x-0 bottom-0 h-36"
            style={{ background: "linear-gradient(0deg, rgba(4,6,10,0.6) 0%, transparent 100%)" }}
          />

          {/* As faixas diagonais coloridas saíram a pedido (05/08/26). Sobre a
              arte fotográfica do carrossel elas liam como risco na imagem, não
              como identidade — o original pode usá-las porque o fundo dele é
              preto liso. O ângulo da referência sobrevive no traço do item
              selecionado, que é inclinado. */}
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

        {/* ATALHOS DO CANTO — engrenagem e acessibilidade, como na referência.
            Ficam sobre a cunha escura do topo para nunca sumirem no fundo claro.
            São os DOIS únicos itens fora da lista; nada aqui mexe na navegação
            por teclado/controle do menu (que continua por índice). */}
        <div
          className="absolute left-4 top-4 z-20 flex flex-col gap-1 sm:left-6 sm:top-6"
          style={{
            animation: phase === "main-menu" ? "fadeIn 0.6s ease-out 0.35s forwards" : "none",
            opacity: 0,
          }}
        >
          {([
            { id: "config" as const, rotulo: "Configurações", icone: <Settings className="h-[18px] w-[18px]" strokeWidth={1.7} /> },
            { id: "acessibilidade" as const, rotulo: "Acessibilidade", icone: <PersonStanding className="h-[19px] w-[19px]" strokeWidth={1.9} /> },
          ]).map(atalho => (
            <button
              key={atalho.id}
              onClick={() => setPainel(atalho.id)}
              aria-label={atalho.rotulo}
              title={atalho.rotulo}
              // A cunha escura do topo saiu junto com as faixas; a sombra é o
              // que mantém os dois ícones visíveis quando a arte do carrossel é
              // clara.
              className="group flex items-center gap-2.5 rounded-full py-1.5 pl-2 pr-3 text-white/55 drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)] transition-all duration-200 hover:bg-white/[0.07] hover:text-[var(--brand)]"
            >
              {atalho.icone}
              {/* O rótulo só aparece no hover/foco: a referência mostra ícone
                  puro, mas ícone sem nome deixa a função adivinhada. */}
              <span className="max-w-0 overflow-hidden whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.16em] opacity-0 transition-all duration-200 group-hover:max-w-[10rem] group-hover:opacity-100 group-focus-visible:max-w-[10rem] group-focus-visible:opacity-100">
                {atalho.rotulo}
              </span>
            </button>
          ))}
        </div>

        {/* Conteudo do menu - layout cinematografico alinhado a esquerda */}
        <div className="relative z-10 flex h-full flex-col justify-center px-8 sm:px-12 md:px-16 lg:px-24 pt-16 pb-24">
          <div className="w-full max-w-md">

            {/* Logo + badge de registro */}
            <div
              className="mb-9"
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
              {/* A linha "Modo Carreira · 2026 · Versão não registrada" saiu a
                  pedido (1.0.267): sob a marca, ela era uma terceira voz numa
                  tela que ficou de propósito com duas — logo e lista.
                  Nada se perdeu de função: quem não registrou continua vendo o
                  item "Registrar" na lista (ele some sozinho depois do código
                  aceito), e o estado completo está no modal de registro. */}
            </div>

            {/* MENU EM LISTA DE TEXTO (1.0.267). Saiu o painel de vidro com um
                cartão por item: a caixa competia com a arte do fundo e todos os
                itens tinham o mesmo peso visual. Agora é a mesma lista, na mesma
                ordem e com a mesma navegação — o que muda é a hierarquia: o item
                sob o cursor cresce, ganha o traço da marca e revela a linha de
                apoio; os outros recuam para um cinza discreto.

                Sem divisor entre os blocos: o respiro maior (mt-*) já separa
                jogar / ferramentas / sistema sem desenhar nada. */}
            <div className="relative">
            {/* HALO DA LISTA. A vinheta da tela é fraca de propósito (pedido), e
                sobre a camisa branca do carrossel os itens ficavam no limite.
                Em vez de escurecer a tela de novo, o apoio vem SÓ onde o texto
                está — e em degradê radial, que não tem borda: ele se dissolve
                antes de chegar em qualquer canto, então não vira caixa. */}
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-14 -left-28 -right-24 -top-12"
              style={{
                background:
                  "radial-gradient(52% 58% at 30% 50%, rgba(2,4,7,0.62) 0%, rgba(2,4,7,0.44) 38%, rgba(2,4,7,0.18) 66%, transparent 88%)",
              }}
            />
            <nav
              className="relative flex flex-col items-start"
              style={{
                animation: phase === "main-menu" ? "slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards" : "none",
                opacity: 0,
              }}
            >
              {mainMenuOptions.map((option, index) => {
                const isSelected = selectedIndex === index
                const abreBloco = index > 0 && mainMenuOptions[index - 1].grupo !== option.grupo
                return (
                  <button
                    key={option.id}
                    onClick={() => handleMenuSelect(index)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onFocus={() => setSelectedIndex(index)}
                    className={cn(
                      "group relative w-full py-3 pl-5 pr-2 text-left transition-transform duration-300 ease-out",
                      abreBloco && "mt-5",
                      isSelected ? "translate-x-2" : "translate-x-0",
                    )}
                  >
                    {/* Traço inclinado da marca — o "slash" da referência. */}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute left-0 w-[3px] rounded-sm transition-all duration-300",
                        isSelected ? "h-7 opacity-100" : "h-0 opacity-0",
                      )}
                      style={{
                        top: "50%",
                        transform: "translateY(-50%) skewX(-14deg)",
                        background: "linear-gradient(180deg, var(--brand) 0%, var(--brand-2) 100%)",
                        boxShadow: isSelected ? "0 0 16px rgba(0,255,200,0.55)" : "none",
                      }}
                    />

                    {/* Peso e cor seguem a referência: o ativo é bold branco, os
                        outros ficam num cinza que ainda se LÊ (o /35 da primeira
                        versão sumia sobre a arte clara do carrossel). */}
                    {/* TIPOGRAFIA — geométrica (estilo Century Gothic) em caixa
                        mista, que é o pedido. Duas coisas mudaram junto e uma
                        depende da outra:
                          • a caixa mista vem do TEXTO da tradução, não de CSS —
                            `capitalize`/`lowercase` global escreveria errado em
                            idioma que exige maiúscula no substantivo;
                          • com caixa mista o espaçamento entre letras cai muito
                            (0,01em/0,05em contra os 0,05/0,13 de antes): quem
                            precisava de ar era a caixa alta; a mista já tem o
                            contorno de palavra que a leitura procura.
                        A Poppins é mais leve no desenho que a Geist, então o peso
                        subiu um degrau para o ativo continuar firme.
                        Sombra difusa e única; a curta dava contorno duro no
                        glifo e com o halo atrás não fazia falta. */}
                    <span
                      className={cn(
                        "font-geometrica block truncate leading-[1.15] transition-all duration-300 [text-shadow:0_2px_18px_rgba(0,0,0,0.7)]",
                        isSelected
                          ? "text-[26px] font-semibold tracking-[0.01em] text-white sm:text-[30px]"
                          : "text-[18px] font-normal tracking-[0.05em] text-white/45 group-hover:text-white/80 sm:text-[20px]",
                      )}
                    >
                      {option.label}
                    </span>

                    {/* A linha de apoio continua existindo, mas só para o item
                        ativo: a lista inteira com duas linhas viraria um bloco de
                        texto e mataria o destaque. */}
                    {option.hint && (
                      <span
                        className={cn(
                          "font-geometrica block overflow-hidden truncate text-[10.5px] font-normal uppercase tracking-[0.16em] transition-all duration-300 [text-shadow:0_1px_10px_rgba(0,0,0,0.85)]",
                          isSelected
                            ? "mt-2.5 max-h-5 text-white/45 opacity-100"
                            : "mt-0 max-h-0 opacity-0",
                        )}
                      >
                        {option.hint}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>
            </div>
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

      {/* GAVETAS DOS DOIS ATALHOS DO CANTO. Ficam fora do bloco do menu de
          propósito: o menu inteiro vive dentro de um fade com
          `pointer-events-none`, e um painel aberto ali herdaria isso. */}
      {painel === "config" && (
        <PainelConfiguracoes
          aoFechar={() => setPainel(null)}
          idioma={gameState.language || "pt-BR"}
          aoEscolherIdioma={id => setGameState({ language: id })}
          volumeSfx={gameState.sfxVolume ?? 80}
          aoMudarVolumeSfx={v => setGameState({ sfxVolume: v })}
          // Sem o store hidratado, gravar aqui escreveria o DEFAULT por cima do
          // save real — o mesmo tropeço já visto no boot das telas de carreira.
          podeGravar={hydrated}
        />
      )}
      {painel === "acessibilidade" && <PainelAcessibilidade aoFechar={() => setPainel(null)} />}

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
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white leading-tight">{save.teamName}</span>
                            {/* CARREIRA DE MESA. Carregar uma dessas não é a
                                mesma coisa que carregar a sua: o computador vai
                                cair na vez de quem estava jogando, e a rodada só
                                anda quando todos fecharem. Sem o selo, a pessoa
                                descobre isso depois de abrir. */}
                            {save.tecnicos > 1 && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-400/35 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-300">
                                <Users className="h-2.5 w-2.5" />
                                {save.tecnicos} técnicos
                              </span>
                            )}
                          </div>
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
                  {/* ⚠️ UM CLIQUE BAIXA. Antes ele só copiava o código para o
                      campo abaixo, e ainda era preciso achar e apertar o botão de
                      baixar — a lista PARECIA a forma de recuperar a carreira e
                      não era. Cada linha é uma carreira, com o código dela. */}
                  {savesDaConta.slice(0, 8).map(save => (
                    <button
                      key={save.codigo}
                      disabled={cloudLoading}
                      onClick={() => {
                        setCloudCode(save.codigo)
                        setCloudError("")
                        setCloudSuccess("")
                        void handleCloudDownload(save.codigo)
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/5 bg-black/30 px-3 py-2 text-left transition-colors hover:border-[var(--brand)]/30 hover:bg-black/50 disabled:opacity-50"
                    >
                      <span className="min-w-0">
                        {/* Rótulo antigo (carreira enviada antes de ele existir)
                            fica CINZA: assim "Carreira salva" se lê como "sem
                            informação", e não como o nome da carreira. */}
                        <span className={cn(
                          "block truncate text-sm",
                          save.rotulo ? "text-white" : "italic text-white/40",
                        )}>
                          {save.rotulo || "Carreira salva"}
                        </span>
                        {/* ⚠️ A HORA NÃO É ENFEITE. Sem ela, quem salva várias
                            vezes no mesmo dia vê linhas idênticas e não tem como
                            escolher — era o caso de 5 das 8 desta lista. */}
                        <span className="block text-[11px] tabular-nums text-white/35">
                          {new Date(save.atualizado_em * 1000).toLocaleString("pt-BR", {
                            day: "2-digit", month: "2-digit", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2.5">
                        {/* O código serve para DIGITAR noutro computador, não para
                            escolher aqui — por isso deixou de ser o elemento mais
                            colorido da linha. Quem manda na cor é a ação. */}
                        <span className="font-mono text-[11px] tracking-widest text-white/25">
                          {save.codigo}
                        </span>
                        {cloudLoading && cloudCode === save.codigo
                          ? <Loader2 className="h-4 w-4 animate-spin text-[var(--brand)]" />
                          : <Download className="h-4 w-4 text-[var(--brand)]/70" />}
                      </span>
                    </button>
                  ))}
                </div>
                {/* A lista mostra 8. Sem esta linha, a nona carreira simplesmente
                    não existia para quem olha — e o campo de código abaixo é
                    justamente como alcançá-la. */}
                {savesDaConta.length > 8 && (
                  <p className="mt-2 text-[11px] text-white/30">
                    +{savesDaConta.length - 8} carreira{savesDaConta.length - 8 > 1 ? "s" : ""} mais
                    antiga{savesDaConta.length - 8 > 1 ? "s" : ""} — use o código abaixo para baixá-la
                    {savesDaConta.length - 8 > 1 ? "s" : ""}.
                  </p>
                )}
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
              {/* ⚠️ O botao de baixar chama `handleCloudDownload()` dentro de uma
                  seta: passado direto como `onClick={handleCloudDownload}`, o
                  React entregaria o EVENTO de clique no primeiro parametro — que
                  agora e o codigo do save. */}
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
                  onClick={() => { void handleCloudDownload() }}
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

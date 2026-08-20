"use client"

import { safeLocalSet } from "@/lib/safe-storage"
import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { CalendarDays, Clock3, Copy, Database, ExternalLink, Inbox, LoaderCircle, LogOut, MessageCircle, MessagesSquare, Play, Power, RefreshCw, Search, Server, ShieldCheck, UserPlus, Users, Wifi, X } from "lucide-react"
import { useGameState, type GameState } from "@/lib/save-system"
import { useUserTeam } from "@/lib/time-da-carreira"
import {
  disconnectDiscordSocial,
  getDiscordSocialSnapshot,
  loginDiscordSocial,
  updateDiscordPresence,
  type DiscordSocialSnapshot,
} from "@/lib/discord-social"
import {
  GAME_DATA_HASH,
  GAME_DATA_VERSION,
  ONLINE_GAME_VERSION,
  joinOnlineServer,
  leaveOnlineSession,
  refreshOnlineRoom,
  restoreOnlineSession,
  setOnlineReady,
  startOnlineServer,
  stopOnlineServer,
  submitOnlineAction,
  type OnlineSession,
} from "@/lib/online-multiplayer"
import { HubOnlineChat } from "@/components/hub-online-chat"
import { HubAmigos, type SecaoDoHub } from "@/components/hub-amigos"
import { atividadeDaRota } from "@/lib/hub-social"
import { HubCampeonato } from "@/components/hub-campeonato"
import { HubDraft } from "@/components/hub-draft"
import type { AtletaDoDraft } from "@/lib/draft-online"
import { useJogoRegistrado } from "@/lib/beneficios"
import { AvisoDeRegistro } from "@/components/registro-necessario"
import {
  checkRelayHealth,
  configuredRelayUrl,
  ONLINE_RELAY_ENABLED,
  connectInternetRoom,
  createInternetRoom,
  joinInternetRoom,
  leaveInternetRoom,
  restoreInternetSession,
  setRelayOverride,
  type InternetConnectionState,
  type InternetRoomSocket,
  type InternetSession,
} from "@/lib/internet-multiplayer"
import { competicoesDaModalidadeOnline, type ModalidadeOnline } from "@/lib/competicoes-online"
import { NIVEIS, type NivelDeDificuldade } from "@/lib/dificuldade"
import { useTranslation } from "@/lib/i18n"

const TOTAL_PLAYTIME_KEY = "ultrafoot:playtime:total-seconds"
const SESSION_START_KEY = "ultrafoot:playtime:session-start"
const SESSION_VISIBLE_KEY = "ultrafoot:playtime:session-visible-ms"

type PlaytimeSnapshot = { sessionSeconds: number; totalSeconds: number; sessionStartedAt: number }
type LivePresence = { home: string; away: string; homeGoals: number; awayGoals: number; minute: number; phase: string; competition: string }

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours >= 100) return `${hours} h`
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}min`
  return `${minutes}min`
}

function presenceFor(pathname: string, state: GameState, teamName: string, live: LivePresence | null) {
  const season = `Temporada ${state.season}`
  const club = state.selectedTeamShort ? teamName : "Sem clube"
  if (pathname.startsWith("/partida/ao-vivo") && live) {
    const clock = live.phase === "fulltime" ? "Encerrada" : live.phase === "pre" ? "Pré-jogo" : `${live.minute}'`
    return { details: `${live.home} ${live.homeGoals} × ${live.awayGoals} ${live.away}`, state: `${live.competition} • ${clock}`, largeText: `${club} • ${season}` }
  }
  if (pathname.startsWith("/partida")) return { details: "Preparando a próxima partida", state: `${club} • ${season}`, largeText: "Dia de jogo" }
  if (pathname.startsWith("/elenco/gerenciamento")) return { details: "Montando escalação e tática", state: `${club} • ${season}`, largeText: "Gerenciamento do time" }
  if (pathname.startsWith("/elenco") || pathname.startsWith("/taticas")) return { details: "Gerenciando o elenco", state: `${club} • ${season}`, largeText: "Elenco e táticas" }
  if (pathname.startsWith("/mercado") || pathname.startsWith("/transferencias") || pathname.startsWith("/contratos")) return { details: "No mercado de transferências", state: `Negociando pelo ${club}`, largeText: season }
  if (pathname.startsWith("/olheiros") || pathname.startsWith("/relatorios") || pathname.startsWith("/adversarios")) return { details: "Analisando jogadores e adversários", state: `${club} • ${season}`, largeText: "Scouting e análise" }
  if (pathname.startsWith("/base")) return { details: state.youthCareer?.active ? `Comandando ${state.youthCareer.clubNome}` : "Desenvolvendo a categoria de base", state: state.youthCareer?.currentCompetition ?? `${club} • ${season}`, largeText: "Categorias de base" }
  if (pathname.startsWith("/selecao")) return { details: state.nationalCareer.nationalTeamName ? `Comandando ${state.nationalCareer.nationalTeamName}` : "Acompanhando seleções", state: state.nationalCareer.currentCompetition?.competitionName ?? season, largeText: "Futebol internacional" }
  if (pathname.startsWith("/competicoes") || pathname.startsWith("/calendario")) return { details: "Planejando a temporada", state: `${club} • Semana ${state.week + 1}`, largeText: season }
  if (pathname.startsWith("/treinamento")) return { details: "Preparando a equipe", state: `Treinamento do ${club}`, largeText: season }
  if (pathname.startsWith("/financas") || pathname.startsWith("/infraestrutura")) return { details: "Administrando o clube", state: `${club} • ${season}`, largeText: "Gestão e finanças" }
  if (pathname.startsWith("/imprensa") || pathname.startsWith("/reunioes") || pathname.startsWith("/vestiario")) return { details: "Nos bastidores do clube", state: `${club} • ${season}`, largeText: "Gestão de pessoas" }
  if (pathname.startsWith("/sem-clube")) return { details: "Em busca de um novo desafio", state: `Técnico disponível • ${season}`, largeText: "Mercado de treinadores" }
  if (pathname.startsWith("/novo-jogo")) return { details: "Iniciando uma nova carreira", state: "Escolhendo clube e treinador", largeText: "Nova carreira" }
  return { details: "No escritório do treinador", state: `${club} • ${season}`, largeText: `Semana ${state.week + 1}` }
}

export function FcHub() {
  const { registrado, hidratado: registroHidratado } = useJogoRegistrado()
  const [open, setOpen] = useState(false)
  const [isNative, setIsNative] = useState(false)
  const [hubTab, setHubTab] = useState("friends")
  const [social, setSocial] = useState<DiscordSocialSnapshot | null>(null)
  const [busy, setBusy] = useState(false)
  const [playtime, setPlaytime] = useState<PlaytimeSnapshot>({ sessionSeconds: 0, totalSeconds: 0, sessionStartedAt: 0 })
  const [livePresence, setLivePresence] = useState<LivePresence | null>(null)

  useEffect(() => {
    setIsNative("__TAURI_INTERNALS__" in window)
  }, [])
  const [online, setOnline] = useState<OnlineSession | null>(null)
  const [onlineBusy, setOnlineBusy] = useState(false)
  const [onlineError, setOnlineError] = useState("")
  const [joinAddress, setJoinAddress] = useState("")
  const [joinCode, setJoinCode] = useState("")
  const [internet, setInternet] = useState<InternetSession | null>(null)
  const [internetState, setInternetState] = useState<InternetConnectionState>("closed")
  const [internetBusy, setInternetBusy] = useState(false)
  const [internetError, setInternetError] = useState("")
  // DRAFT X DRAFT: só o host abre, e só antes de a tabela existir. Sob demanda
  // porque o catálogo do draft vem do banco de atletas — carregá-lo sempre que o
  // FC Hub abre traria o seed de elencos para dentro do painel social.
  const [draftLigado, setDraftLigado] = useState(false)
  // Quem chega pela tela do Manager Draft (/online/draft) ja pediu o draft: a
  // bandeira poupa o passo que mantinha o modo "em obras" — descobrir sozinho
  // que existe um botao "Abrir draft x draft nesta sala" visivel so ao host.
  useEffect(() => {
    try {
      if (sessionStorage.getItem("ultrafoot:abrir-draft") !== "1") return
      sessionStorage.removeItem("ultrafoot:abrir-draft")
      setDraftLigado(true)
    } catch { /* sem sessionStorage o host liga o draft no botao de sempre */ }
  }, [])
  const [elencoParaDraft, setElencoParaDraft] = useState<AtletaDoDraft[]>([])
  useEffect(() => {
    if (!draftLigado || elencoParaDraft.length > 0) return
    let vivo = true
    void (async () => {
      const [{ allTeams }, { getPlayersForTeam }, { setorDaPosicao286 }] = await Promise.all([
        import("@/lib/teams-data"),
        import("@/lib/players-data"),
        import("@/lib/universo-286"),
      ])
      // Um recorte dos clubes de maior prestígio: o draft quer um catálogo bom,
      // não os 42 mil atletas do mundo — e a lista precisa caber na tela.
      const clubes = [...allTeams].sort((a, b) => (b.prestigio ?? 0) - (a.prestigio ?? 0)).slice(0, 24)
      const atletas: AtletaDoDraft[] = []
      for (const clube of clubes) {
        for (const jogador of getPlayersForTeam(clube)) {
          atletas.push({
            id: String(jogador.ft ?? `${clube.curto}-${jogador.nome}`),
            nome: jogador.nome,
            posicao: String(jogador.pos ?? "MEI"),
            setor: setorDaPosicao286(String(jogador.pos ?? "MEI")),
            overall: jogador.base ?? 65,
            idade: jogador.idade ?? 24,
            clube: clube.nome,
          })
        }
      }
      if (vivo) setElencoParaDraft(atletas)
    })()
    return () => { vivo = false }
  }, [draftLigado, elencoParaDraft.length])
  const [internetJoinCode, setInternetJoinCode] = useState("")
  const [relayUrl, setRelayUrl] = useState("")
  const [onlineLeague, setOnlineLeague] = useState("brasileirao_a")
  const [onlineModalidade, setOnlineModalidade] = useState<ModalidadeOnline>("profissional")
  const [onlineDifficulty, setOnlineDifficulty] = useState<NivelDeDificuldade>("normal")
  const [onlineSpeed, setOnlineSpeed] = useState<"normal" | "rapida">("normal")
  const [roundDeadline, setRoundDeadline] = useState<24 | 48 | 72 | 168>(72)
  const [allowSpectators, setAllowSpectators] = useState(true)
  const internetSocket = useRef<InternetRoomSocket | null>(null)
  // Espelho em ESTADO do socket. O ref sozinho não re-renderiza: o painel do
  // campeonato montava com `socket = null` e os botões de enviar placar nasciam
  // desabilitados até algum outro render acontecer por acaso.
  const [socketAtivo, setSocketAtivo] = useState<InternetRoomSocket | null>(null)
  const [entrarComoEspectador, setEntrarComoEspectador] = useState(false)
  const { state } = useGameState()
  const t = useTranslation()
  const { team } = useUserTeam()
  const pathname = usePathname()
  const competicoesOnline = competicoesDaModalidadeOnline(onlineModalidade)

  useEffect(() => {
    const sugerida: ModalidadeOnline = state.managingNationalTeamId
      ? "selecao"
      : state.modalidade === "feminino"
        ? "feminino"
        : state.modalidade === "sub20"
          ? "sub20"
          : state.modalidade === "jogador" && state.carreiraDeJogador?.atleta.genero === "feminino"
            ? "feminino"
            : "profissional"
    setOnlineModalidade(sugerida)
    setOnlineDifficulty(state.dificuldade ?? "normal")
  }, [state.managingNationalTeamId, state.modalidade, state.dificuldade, state.carreiraDeJogador?.atleta.genero])

  useEffect(() => {
    const primeira = competicoesDaModalidadeOnline(onlineModalidade)[0]
    if (primeira && !competicoesDaModalidadeOnline(onlineModalidade).some(item => item.id === onlineLeague)) setOnlineLeague(primeira.id)
  }, [onlineModalidade, onlineLeague])

  useEffect(() => {
    setOnline(restoreOnlineSession())
    setInternet(restoreInternetSession())
    setRelayUrl(configuredRelayUrl())
  }, [])

  useEffect(() => {
    internetSocket.current?.close()
    internetSocket.current = null
    if (!internet) { setInternetState("closed"); return }
    const socket = connectInternetRoom(internet, {
      onRoom: room => setInternet(current => current ? { ...current, room } : current),
      onState: setInternetState,
      onError: setInternetError,
    })
    internetSocket.current = socket
    setSocketAtivo(socket)
    return () => {
      socket.close()
      if (internetSocket.current === socket) { internetSocket.current = null; setSocketAtivo(null) }
    }
  }, [internet?.relayUrl, internet?.participantId, internet?.sessionToken, internet?.room.code])

  // Tempo real de jogo, acumulado entre sessões. Conta somente enquanto a janela
  // está visível e grava periodicamente para sobreviver a fechamento inesperado.
  useEffect(() => {
    const now = Date.now()
    const storedStart = Number(sessionStorage.getItem(SESSION_START_KEY))
    const sessionStartedAt = Number.isFinite(storedStart) && storedStart > 0 ? storedStart : now
    if (!storedStart) sessionStorage.setItem(SESSION_START_KEY, String(sessionStartedAt))
    let visibleMs = Math.max(0, Number(sessionStorage.getItem(SESSION_VISIBLE_KEY)) || 0)
    let persistedTotal = Math.max(0, Number(localStorage.getItem(TOTAL_PLAYTIME_KEY)) || 0)
    let pendingMs = 0
    let lastTick = now

    const flush = () => {
      if (pendingMs < 1) return
      persistedTotal += Math.floor(pendingMs / 1000)
      pendingMs %= 1000
      safeLocalSet(TOTAL_PLAYTIME_KEY, String(persistedTotal))
      sessionStorage.setItem(SESSION_VISIBLE_KEY, String(visibleMs))
    }
    const tick = () => {
      const current = Date.now()
      const elapsed = Math.max(0, Math.min(5000, current - lastTick))
      lastTick = current
      if (document.visibilityState === "visible") {
        visibleMs += elapsed
        pendingMs += elapsed
      }
      if (pendingMs >= 10_000) flush()
      setPlaytime({ sessionSeconds: Math.floor(visibleMs / 1000), totalSeconds: persistedTotal + Math.floor(pendingMs / 1000), sessionStartedAt })
    }
    const onVisibility = () => { tick(); if (document.visibilityState === "hidden") flush() }
    const timer = window.setInterval(tick, 1000)
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("pagehide", flush)
    tick()
    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("pagehide", flush)
      tick()
      flush()
    }
  }, [])

  useEffect(() => {
    const onLive = (event: Event) => setLivePresence((event as CustomEvent<LivePresence>).detail)
    window.addEventListener("ultrafoot:live-presence", onLive)
    return () => window.removeEventListener("ultrafoot:live-presence", onLive)
  }, [])

  // Rich Presence contextual. Atualiza ao navegar, avançar a temporada ou quando
  // minuto/placar da partida muda; o Rust reconecta caso o Discord seja aberto depois.
  useEffect(() => {
    if (!playtime.sessionStartedAt) return
    const basePresence = presenceFor(pathname, state, team.nome, livePresence)
    const presence = internet && !pathname.startsWith("/partida/ao-vivo")
      ? { details: `Campeonato ${internet.room.code} · rodada ${internet.room.competition?.currentRound ?? 0}`, state: `${internet.room.participants.length}/${internet.room.maxPlayers} técnicos · ${team.nome}`, largeText: basePresence.largeText }
      : online && !pathname.startsWith("/partida/ao-vivo")
      ? { details: `Sala LAN ${online.room.roomCode} · rodada ${online.room.currentRound}`, state: `${online.room.participants.length}/${online.room.maxPlayers} técnicos · ${team.nome}`, largeText: basePresence.largeText }
      : basePresence
    const publish = () => void updateDiscordPresence({
      ...presence,
      startTimestamp: Math.floor(playtime.sessionStartedAt / 1000),
    })
    publish()
    const timer = window.setInterval(publish, 15_000)
    return () => window.clearInterval(timer)
  }, [pathname, state.selectedTeamShort, state.season, state.week, state.youthCareer?.currentCompetition, state.nationalCareer.nationalTeamName, state.nationalCareer.currentCompetition?.competitionName, team.nome, livePresence, playtime.sessionStartedAt, online?.room.roomCode, online?.room.currentRound, online?.room.participants.length, online?.room.maxPlayers, internet?.room.code, internet?.room.competition?.currentRound, internet?.room.participants.length, internet?.room.maxPlayers])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || event.ctrlKey || event.altKey || event.metaKey) return
      const target = event.target as HTMLElement | null
      if (target?.matches("input, textarea, select, [contenteditable=true]")) return
      event.preventDefault()
      setOpen(value => !value)
    }
    const onOpen = () => setOpen(true)
    window.addEventListener("keydown", onKey, true)
    window.addEventListener("ultrafoot:fc-hub", onOpen)
    // Quem caiu no atalho antigo dos Modos locais chega pedindo o Hub aberto.
    try {
      if (sessionStorage.getItem("ultrafoot:abrir-fc-hub") === "1") {
        sessionStorage.removeItem("ultrafoot:abrir-fc-hub")
        setOpen(true)
      }
    } catch { /* sem sessionStorage, o atalho apenas nao abre sozinho */ }
    return () => { window.removeEventListener("keydown", onKey, true); window.removeEventListener("ultrafoot:fc-hub", onOpen) }
  }, [])

  useEffect(() => {
    if (!open) return
    let alive = true
    const refresh = async () => {
      const next = await getDiscordSocialSnapshot()
      if (alive) setSocial(next)
    }
    void refresh()
    const timer = window.setInterval(refresh, 1500)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [open])

  useEffect(() => {
    if (!open || !online) return
    let alive = true
    const refresh = () => void refreshOnlineRoom(online).then(next => { if (alive) { setOnline(next); setOnlineError("") } }).catch(error => { if (alive) setOnlineError(error instanceof Error ? error.message : String(error)) })
    refresh()
    const timer = window.setInterval(refresh, 2_000)
    return () => { alive = false; window.clearInterval(timer) }
  }, [open, online?.address, online?.room.roomCode, online?.participantId])

  useEffect(() => {
    if (!online) return
    const onAction = (event: Event) => {
      const detail = (event as CustomEvent<{ actionType: string; payload: unknown }>).detail
      if (!detail?.actionType) return
      void submitOnlineAction(online, detail.actionType, detail.payload).then(setOnline).catch(error => setOnlineError(error instanceof Error ? error.message : String(error)))
    }
    window.addEventListener("ultrafoot:online-action", onAction)
    return () => window.removeEventListener("ultrafoot:online-action", onAction)
  }, [online?.address, online?.room.roomCode, online?.participantId, online?.sessionToken])

  const login = async () => {
    setBusy(true)
    try {
      await loginDiscordSocial()
      setSocial(await getDiscordSocialSnapshot())
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    setBusy(true)
    try {
      await disconnectDiscordSocial()
      setSocial(await getDiscordSocialSnapshot())
    } finally {
      setBusy(false)
    }
  }

  const runOnline = async (operation: () => Promise<OnlineSession>) => {
    setOnlineBusy(true); setOnlineError("")
    try { setOnline(await operation()) }
    catch (error) { setOnlineError(error instanceof Error ? error.message : String(error)) }
    finally { setOnlineBusy(false) }
  }

  const runInternet = async (operation: () => Promise<InternetSession>) => {
    setInternetBusy(true); setInternetError("")
    try {
      setRelayOverride(relayUrl)
      await checkRelayHealth(relayUrl)
      setInternet(await operation())
    } catch (error) { setInternetError(error instanceof Error ? error.message : String(error)) }
    finally { setInternetBusy(false) }
  }

  const closeInternet = () => {
    internetSocket.current?.close()
    internetSocket.current = null
    leaveInternetRoom()
    setInternet(null)
    setInternetState("closed")
  }

  const closeOnline = async () => {
    setOnlineBusy(true); setOnlineError("")
    try { if (online?.isHost) await stopOnlineServer(); else leaveOnlineSession(); setOnline(null) }
    catch (error) { setOnlineError(error instanceof Error ? error.message : String(error)) }
    finally { setOnlineBusy(false) }
  }

  if (!open) return null

  // FC HUB = extra de quem registrou (lib/beneficios.ts). O hub e a unica parte
  // do jogo que depende de servidor e de identidade — e o beneficio mais direto
  // de ter comprado. Abre o mesmo convite das outras telas, dentro do overlay.
  if (registroHidratado && !registrado) {
    return (
      <div className="fixed inset-0 z-[9998] grid place-items-center bg-[#020407]/70 p-5" onClick={() => setOpen(false)}>
        <div onClick={e => e.stopPropagation()} className="w-full max-w-xl">
          <AvisoDeRegistro id="hub" />
        </div>
      </div>
    )
  }

  // AS ABAS DE AMIGOS APONTAM PARA A CONTA DO ULTRAFOOT, nao para o Discord.
  // "Mensagens", "Solicitacoes" e "Buscar pessoas" levavam ao botao de abrir o
  // Discord — ou seja, quem nao usa Discord clicava e nao acontecia nada util.
  const hubTabs: { id: string; label: string; icon: typeof Users; target: string; secao?: SecaoDoHub }[] = [
    { id: "friends", label: t.fcHub.aba_amigos, icon: Users, target: "hub-friends", secao: "amigos" },
    { id: "messages", label: t.fcHub.aba_mensagens, icon: MessagesSquare, target: "hub-friends", secao: "amigos" },
    { id: "requests", label: t.fcHub.aba_solicitacoes, icon: Inbox, target: "hub-friends", secao: "pedidos" },
    { id: "search", label: t.fcHub.aba_buscar, icon: Search, target: "hub-friends", secao: "buscar" },
    { id: "activity", label: t.fcHub.aba_atividade, icon: Clock3, target: "hub-friends", secao: "mural" },
    { id: "groups", label: t.fcHub.aba_liga_online, icon: Wifi, target: "hub-groups" },
    { id: "club", label: t.fcHub.aba_meu_clube, icon: ShieldCheck, target: "hub-club" },
  ]
  const secaoDeAmigos: SecaoDoHub = hubTabs.find(tab => tab.id === hubTab)?.secao ?? "amigos"
  const goToSection = (id: string, target: string) => {
    setHubTab(id)
    window.setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0)
  }
  const onlineFriends = social?.friends.filter(friend => friend.playingUltrafoot) ?? []
  const offlineFriends = social?.friends.filter(friend => !friend.playingUltrafoot) ?? []

  return <div className="fixed inset-0 z-[9998] bg-[#020407]/30 p-3 backdrop-blur-[2px] sm:p-5" onClick={() => setOpen(false)}>
    <aside className="mx-auto flex h-full w-full max-w-[1240px] flex-col overflow-hidden rounded-xl border border-white/[12%] bg-[#071017]/[.58] shadow-[0_30px_120px_rgba(0,0,0,.48)] backdrop-blur-xl" onClick={e => e.stopPropagation()}>
      <header className="flex items-center justify-between border-b border-white/[0.10] bg-black/[.10] px-6 py-4">
        <div className="flex items-center gap-3"><div className="grid h-8 w-8 place-items-center rounded-full border border-[var(--brand)]/35 bg-[var(--brand)]/10 text-[10px] font-black text-[var(--brand)]">UF</div><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-white/35">{t.fcHub.ultrafoot_connect}</p><h2 className="text-lg font-bold text-white">{t.fcHub.fc_hub_social}</h2></div></div>
        <div className="flex items-center gap-3"><span className="hidden text-[10px] text-white/35 sm:block">{onlineFriends.length} online · sessão {formatDuration(playtime.sessionSeconds)}</span><button onClick={() => setOpen(false)} className="rounded-md border border-white/10 p-2 text-white/50 hover:bg-white/10"><X className="h-4 w-4" /></button></div>
      </header>
      <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/[0.10] bg-black/[.08] px-5 py-2 scrollbar-none">
        {hubTabs.map(tab => { const Icon = tab.icon; const active = hubTab === tab.id; return <button key={tab.id} onClick={() => goToSection(tab.id, tab.target)} className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-[11px] font-semibold transition-colors ${active ? "border-[var(--brand)] text-white" : "border-transparent text-white/40 hover:text-white/70"}`}><Icon className="h-3.5 w-3.5"/>{tab.label}</button> })}
      </nav>
      <section className="grid min-h-0 flex-1 lg:grid-cols-[260px_1fr]">
        <aside className="hidden min-h-0 overflow-y-auto border-r border-white/[0.10] bg-black/[.10] p-4 lg:block">
          <p className="mb-3 text-[9px] font-black uppercase tracking-[.18em] text-white/30">Discord · {onlineFriends.length} online</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 rounded-lg bg-[var(--brand)]/7 p-2"><div className="grid h-8 w-8 place-items-center rounded-full bg-[var(--brand)]/15 text-xs font-black text-[var(--brand)]">{(state.managerName || "T").slice(0,1)}</div><div className="min-w-0"><p className="truncate text-xs font-bold text-white">{state.managerName || "Técnico"}</p><p className="truncate text-[9px] text-emerald-300">No {team.nome}</p></div></div>
            {onlineFriends.map(friend => <div key={friend.id} className="flex items-center gap-2.5 rounded-lg p-2 hover:bg-white/[0.04]"><img src={friend.avatarUrl} alt="" className="h-8 w-8 rounded-full"/><div className="min-w-0"><p className="truncate text-xs font-semibold text-white/80">{friend.displayName}</p><p className="text-[9px] text-emerald-300">{t.fcHub.jogando_ultrafoot}</p></div></div>)}
          </div>
          <p className="mb-2 mt-6 text-[9px] font-black uppercase tracking-[.18em] text-white/25">Offline · {offlineFriends.length}</p>
          <div className="space-y-1">{offlineFriends.slice(0,8).map(friend => <div key={friend.id} className="flex items-center gap-2 p-2 opacity-45"><img src={friend.avatarUrl} alt="" className="h-7 w-7 rounded-full grayscale"/><p className="truncate text-[11px] text-white/65">{friend.displayName}</p></div>)}</div>
          {!social?.authenticated && <button onClick={login} disabled={busy || !social?.available} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#5865F2] py-2.5 text-[10px] font-black text-white disabled:opacity-40"><UserPlus className="h-3.5 w-3.5"/>{t.fcHub.conectar_discord}</button>}
        </aside>
        <div className="min-h-0 space-y-4 overflow-y-auto bg-black/[.04] p-5 lg:p-6">
        {/* PRESENCA E CHAT DA CONTA. Vem antes do bloco do Discord porque e o
            que responde "tem alguem online?" — a pergunta que faz alguem abrir
            o FC Hub. O bloco do Discord segue abaixo, para quem usa. */}
        <div id="hub-online" className="scroll-mt-5">
          <HubOnlineChat
            clube={team.nome}
            situacao={state.nationalCareer?.nationalTeamName ? "Comandando selecao" : "Em carreira"}
            detalhe={presenceFor(pathname, state, team.nome, livePresence).details}
            atividade={atividadeDaRota(pathname)}
          />
        </div>

        <div id="hub-profile" className="scroll-mt-5 rounded-xl border border-[var(--brand)]/25 bg-[var(--brand)]/[.07] p-4 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            {social?.user?.avatarUrl ? <img src={social.user.avatarUrl} alt="" className="h-11 w-11 rounded-full" /> : <div className="grid h-11 w-11 place-items-center rounded-full bg-[#5865F2]/20 text-[#8d96ff]"><MessageCircle /></div>}
            <div className="min-w-0"><p className="truncate text-sm font-bold text-white">{social?.user?.displayName || social?.detectedName || state.managerName || "Técnico"}</p><p className="text-xs text-white/50">Jogando com {team.nome}</p></div>
          </div>
          <p className={`mt-3 text-xs ${social?.phase === "ready" ? "text-emerald-400" : "text-white/45"}`}>
            {social?.phase === "ready" ? "● Conta Discord conectada" : social?.phase === "authorizing" || social?.phase === "exchanging_token" || social?.phase === "connecting" ? "Conectando ao Discord…" : social?.phase === "discord_closed" ? "Discord não foi encontrado. Abra o aplicativo do Discord." : "Vincule sua conta para encontrar outros jogadores."}
          </p>
          {social?.error && social.phase === "auth_error" && <p className="mt-2 text-xs text-red-300">{social.error}</p>}
          <div className="mt-3 flex gap-2">
            {!social?.authenticated ? <button disabled={busy || !social?.available} onClick={login} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#5865F2] py-2.5 text-xs font-bold text-white disabled:opacity-40">{busy ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <MessageCircle className="h-4 w-4"/>}Conectar Discord</button> : <button disabled={busy} onClick={disconnect} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 py-2.5 text-xs font-bold text-white"><LogOut className="h-4 w-4"/>Desconectar</button>}
            <button onClick={() => void getDiscordSocialSnapshot().then(setSocial)} className="rounded-lg border border-white/10 px-3 text-white/60" aria-label="Atualizar"><RefreshCw className="h-4 w-4"/></button>
          </div>
        </div>
        {ONLINE_RELAY_ENABLED && <div id="hub-groups" className="scroll-mt-5 rounded-xl border border-violet-400/30 bg-violet-400/[.06] p-4 backdrop-blur-sm" data-testid="fc-hub-internet">
          <div className="flex flex-wrap items-center gap-2 text-white"><Wifi className="h-4 w-4 text-violet-300"/><b>{t.fcHub.liga_online_beta}</b><span className="ml-auto rounded bg-violet-400/10 px-2 py-0.5 text-[10px] font-bold text-violet-200">{t.fcHub.n_2_32_tecnicos}</span></div>
          <p className="mt-1 text-[11px] text-violet-100/55">{t.fcHub.liga_assincrona_com_reconexao_e_confirmaca}</p>
          <p className="mt-2 text-xs leading-relaxed text-white/45">{t.fcHub.cada_tecnico_joga_de_sua_propria}</p>
          {!internet ? <div className="mt-4 space-y-3">
            <input value={relayUrl} onChange={event => setRelayUrl(event.target.value)} placeholder="https://relay.ultrafoot..." aria-label={t.fcHub.endereco_do_relay_publico} className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none focus:border-violet-300/60"/>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">Modalidade
                <select value={onlineModalidade} onChange={event => setOnlineModalidade(event.target.value as ModalidadeOnline)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#12131a] px-3 py-2 text-xs normal-case text-white">
                  <option value="profissional">{t.fcHub.profissional_masculino}</option><option value="feminino">{t.fcHub.futebol_feminino}</option><option value="sub20">{t.fcHub.categoria_sub_20}</option><option value="selecao">{t.fcHub.selecoes}</option>
                </select>
              </label>
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">Liga
                <select value={onlineLeague} onChange={event => setOnlineLeague(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#12131a] px-3 py-2 text-xs normal-case text-white">
                  {competicoesOnline.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                </select>
              </label>
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">Dificuldade
                <select value={onlineDifficulty} onChange={event => setOnlineDifficulty(event.target.value as NivelDeDificuldade)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#12131a] px-3 py-2 text-xs normal-case text-white">
                  {NIVEIS.map(nivel => <option key={nivel.id} value={nivel.id}>{nivel.nome}</option>)}
                </select>
              </label>
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">Prazo por rodada
                <select value={roundDeadline} onChange={event => setRoundDeadline(Number(event.target.value) as 24 | 48 | 72 | 168)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#12131a] px-3 py-2 text-xs normal-case text-white">
                  <option value={24}>{t.fcHub.n_24_horas}</option><option value={48}>{t.fcHub.n_48_horas}</option><option value={72}>{t.fcHub.n_72_horas}</option><option value={168}>{t.fcHub.n_7_dias}</option>
                </select>
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/65"><input type="checkbox" checked={onlineSpeed === "rapida"} onChange={event => setOnlineSpeed(event.target.checked ? "rapida" : "normal")} /> {t.fcHub.simulacao_rapida}</label>
              <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/65"><input type="checkbox" checked={allowSpectators} onChange={event => setAllowSpectators(event.target.checked)} /> {t.fcHub.permitir_espectadores}</label>
            </div>
            <p className="text-[10px] text-white/35">{t.fcHub.os_pontos_desempates_inscricoes_e_demais}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button disabled={internetBusy || !relayUrl || !state.selectedTeamShort} onClick={() => void runInternet(async () => {
                const { checkForUpdates } = await import("@/lib/updater")
                if (await checkForUpdates({ silent: true }) === "available") throw new Error("Instale a atualização do jogo/elencos antes de criar o campeonato.")
                const competicao = competicoesOnline.find(item => item.id === onlineLeague)
                return createInternetRoom({ managerName: state.managerName || "Técnico", teamShort: team.curto || state.selectedTeamShort || "", maxPlayers: 32, mode: "tournament", leagueSettings: { leagueId: onlineLeague, leagueName: competicao?.nome ?? "Liga FC Hub", modalidade: onlineModalidade, dificuldade: onlineDifficulty, matchSpeed: onlineSpeed, roundDeadlineHours: roundDeadline, allowSpectators } })
              })} className="flex items-center justify-center gap-2 rounded-lg bg-violet-300 py-2.5 text-xs font-black text-black disabled:opacity-35">{internetBusy ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <Power className="h-4 w-4"/>}{t.fcHub.criar_campeonato}</button>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    value={internetJoinCode}
                    onChange={event => setInternetJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                    maxLength={8}
                    placeholder={t.fcHub.codigo_2}
                    aria-label={t.fcHub.codigo_do_campeonato}
                    className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-center text-xs font-black tracking-[.18em] text-white outline-none focus:border-violet-300/60"
                  />
                  <button
                    disabled={internetBusy || !relayUrl || internetJoinCode.length < 6 || (!entrarComoEspectador && !state.selectedTeamShort)}
                    onClick={() => void runInternet(() => joinInternetRoom({
                      code: internetJoinCode,
                      managerName: state.managerName || "Técnico",
                      teamShort: state.selectedTeamShort || team.curto,
                      spectator: entrarComoEspectador,
                    }))}
                    className="rounded-lg border border-violet-300/35 px-4 py-2 text-xs font-bold text-violet-200 disabled:opacity-35"
                  >
                    {entrarComoEspectador ? t.fcHub.assistir : t.fcHub.entrar_na_sala}
                  </button>
                </div>
                {/* ASSISTIR: entra sem ocupar vaga e sem escolher clube — e pode
                    entrar com o campeonato já em andamento, que é o caso de uso
                    (ver a final de uma liga da qual você não participa). */}
                <label className="flex items-center gap-2 text-[10px] text-white/50">
                  <input type="checkbox" checked={entrarComoEspectador} onChange={e => setEntrarComoEspectador(e.target.checked)} />
                  Entrar apenas como espectador (não ocupa vaga e funciona com o campeonato já começado)
                </label>
                <p className="text-[10px] text-white/30">
                  O código tem 8 caracteres e é gerado por quem cria o campeonato. Peça a ele e cole aqui —
                  quem entra escolhe o próprio clube, e dois técnicos não podem pegar o mesmo.
                </p>
              </div>
            </div>
            {!relayUrl && <p className="rounded-lg border border-amber-300/20 bg-amber-300/5 p-2 text-[11px] text-amber-200">{t.fcHub.o_relay_publico_ainda_precisa_ser}</p>}
          </div> : <div className="mt-4 space-y-3">
            <div className="grid gap-2 sm:grid-cols-4">
              <div className="rounded-lg bg-black/25 p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-white/35">{t.fcHub.codigo}</p><button onClick={() => void navigator.clipboard.writeText(internet.room.code)} className="mt-1 flex items-center gap-2 text-base font-black tracking-[.18em] text-violet-200">{internet.room.code}<Copy className="h-3 w-3 text-white/40"/></button></div>
              <div className="rounded-lg bg-black/25 p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-white/35">{t.fcHub.participantes}</p><p className="mt-1 text-base font-black text-white">{internet.room.participants.length}/{internet.room.maxPlayers}</p><p className="text-[9px] text-white/35">{t.fcHub.minimo_2_para_iniciar}</p></div>
              <div className="rounded-lg bg-black/25 p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-white/35">{t.fcHub.conexao}</p><p className={`mt-1 text-xs font-black ${internetState === "connected" ? "text-emerald-300" : "text-amber-200"}`}>{internetState === "connected" ? t.fcHub.conectado : internetState.toUpperCase()}</p></div>
              <div className="rounded-lg bg-black/25 p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-white/35">{t.fcHub.regra_da_sala}</p><p className="mt-1 text-xs font-black text-violet-200">{internet.room.leagueSettings.modalidade ?? "profissional"}</p><p className="text-[9px] text-white/35">{internet.room.leagueSettings.dificuldade ?? "normal"}</p></div>
            </div>
            <div className="grid max-h-44 gap-2 overflow-y-auto sm:grid-cols-2">{internet.room.participants.map(participant => <div key={participant.id} className="flex items-center gap-2 rounded-lg bg-black/20 p-2"><span className={`h-2 w-2 rounded-full ${participant.connected ? "bg-emerald-400" : "bg-white/20"}`}/><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-white">{participant.managerName}{participant.id === internet.room.hostId ? " · host" : ""}</p><p className="text-[9px] text-white/40">{participant.teamShort}</p></div><span className={`text-[9px] font-black ${participant.ready ? "text-emerald-300" : "text-white/30"}`}>{participant.ready ? t.fcHub.pronto_maiusculo : t.fcHub.aguardando_maiusculo}</span></div>)}</div>
            {/* DRAFT X DRAFT. Vale ANTES de existir tabela: primeiro cada técnico
                monta o elenco escolhendo na vez dele, depois a sala vira
                campeonato. Fora do draft a sala segue como sempre foi. */}
            {draftLigado && !internet.room.competition && (
              <HubDraft
                room={internet.room}
                participantId={internet.participantId}
                socket={socketAtivo}
                elencoDoMundo={elencoParaDraft}
              />
            )}
            {internet.room.hostId === internet.participantId && !internet.room.competition && (
              <button
                onClick={() => setDraftLigado(v => !v)}
                className="w-full rounded-lg border border-violet-300/30 px-3 py-2 text-xs font-bold text-violet-200"
              >
                {draftLigado ? t.fcHub.fechar_draft_da_sala : t.fcHub.abrir_draft_na_sala}
              </button>
            )}
            {internet.room.competition && (
              <HubCampeonato
                room={internet.room}
                participantId={internet.participantId}
                socket={socketAtivo}
              />
            )}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => internetSocket.current?.send("set_ready", { ready: !internet.room.participants.find(item => item.id === internet.participantId)?.ready })} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-3 py-2.5 text-xs font-black text-black"><ShieldCheck className="h-4 w-4"/>{t.fcHub.confirmar_decisoes}</button>
              {internet.room.hostId === internet.participantId && !internet.room.competition && <button disabled={internet.room.participants.length < 2} onClick={() => internetSocket.current?.send("create_competition", { name: "Liga FC Hub" })} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-violet-300 px-3 py-2.5 text-xs font-black text-black disabled:opacity-35"><Users className="h-4 w-4"/>{t.fcHub.montar_tabela}</button>}
              {internet.room.hostId === internet.participantId && internet.room.competition && !internet.room.competition.finished && <button onClick={() => internetSocket.current?.send("start_round")} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-violet-300 px-3 py-2.5 text-xs font-black text-black"><Play className="h-4 w-4"/>{t.fcHub.iniciar_rodada}</button>}
              {internet.room.hostId !== internet.participantId && !internet.room.participants.find(item => item.id === internet.room.hostId)?.connected && <button onClick={() => internetSocket.current?.send("claim_host")} className="rounded-lg border border-amber-300/30 px-3 py-2.5 text-xs font-bold text-amber-200">{t.fcHub.recuperar_host}</button>}
              <button onClick={closeInternet} className="rounded-lg border border-red-400/25 px-3 py-2.5 text-xs font-bold text-red-300"><LogOut className="h-4 w-4"/></button>
            </div>
          </div>}
          {internetError && <p className="mt-3 rounded-lg border border-red-400/20 bg-red-400/5 p-2 text-xs text-red-300">{internetError}</p>}
        </div>}
        {isNative ? <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/[.04] p-4" data-testid="fc-hub-online">
          <div className="flex items-center gap-2 text-white"><Server className="h-4 w-4 text-cyan-300"/><b>{t.fcHub.sala_local_lan}</b><span className="ml-auto rounded bg-cyan-400/10 px-2 py-0.5 text-[10px] font-bold text-cyan-200">{t.fcHub.mesma_rede}</span></div>
          <p className="mt-2 text-xs leading-relaxed text-white/45">{t.fcHub.o_host_mantem_o_save_oficial}</p>
          {!online ? <div className="mt-4 space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <button disabled={onlineBusy || !state.selectedTeamShort} onClick={() => void runOnline(async () => {
                const { checkForUpdates } = await import("@/lib/updater")
                if (await checkForUpdates({ silent: true }) === "available") throw new Error("Existe uma atualização de jogo/elencos. Instale-a antes de abrir a sala.")
                return startOnlineServer({ managerName: state.managerName || "Técnico", teamShort: state.selectedTeamShort || team.curto, maxPlayers: 8 })
              })} className="flex items-center justify-center gap-2 rounded-lg bg-cyan-300 py-2.5 text-xs font-black text-black disabled:opacity-40">{onlineBusy ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <Power className="h-4 w-4"/>}Ligar servidor</button>
              <button onClick={() => void import("@/lib/updater").then(module => module.checkForUpdates({ silent: false }))} className="flex items-center justify-center gap-2 rounded-lg border border-white/10 py-2.5 text-xs font-bold text-white"><Database className="h-4 w-4"/>{t.fcHub.atualizar_jogo_e_elencos}</button>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
              <input value={joinAddress} onChange={event => setJoinAddress(event.target.value)} placeholder={t.fcHub.ip_porta_ex_192_168_0} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none focus:border-cyan-300/60"/>
              <input value={joinCode} onChange={event => setJoinCode(event.target.value.toUpperCase())} maxLength={6} placeholder={t.fcHub.codigo_3} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-center text-xs font-black tracking-[.2em] text-white outline-none focus:border-cyan-300/60"/>
              <button disabled={onlineBusy || !joinAddress || joinCode.length < 6 || !state.selectedTeamShort} onClick={() => void runOnline(() => joinOnlineServer({ address: joinAddress, roomCode: joinCode, managerName: state.managerName || "Técnico", teamShort: state.selectedTeamShort || team.curto }))} className="rounded-lg border border-cyan-300/30 px-4 py-2 text-xs font-bold text-cyan-200 disabled:opacity-40">Entrar</button>
            </div>
          </div> : <div className="mt-4 space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg bg-black/25 p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-white/35">{t.fcHub.endereco_lan}</p><button onClick={() => void navigator.clipboard.writeText(online.address)} className="mt-1 flex items-center gap-2 text-xs font-bold text-white">{online.address}<Copy className="h-3 w-3 text-white/40"/></button></div>
              <div className="rounded-lg bg-black/25 p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-white/35">{t.fcHub.codigo_da_sala}</p><p className="mt-1 text-base font-black tracking-[.2em] text-cyan-200">{online.room.roomCode}</p></div>
              <div className="rounded-lg bg-black/25 p-3"><p className="text-[9px] font-bold uppercase tracking-wider text-white/35">{t.fcHub.rodada_compartilhada}</p><p className="mt-1 text-base font-black text-white">{online.room.currentRound}</p></div>
            </div>
            <div className="space-y-2">{online.room.participants.map(participant => <div key={participant.id} className="flex items-center gap-3 rounded-lg bg-black/20 p-2.5"><span className={`h-2 w-2 rounded-full ${participant.connected ? "bg-emerald-400" : "bg-white/20"}`}/><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-white">{participant.managerName}{participant.id === "host" ? " · host" : ""}</p><p className="text-[10px] text-white/40">{participant.teamShort}</p></div><span className={`rounded px-2 py-1 text-[9px] font-black ${participant.ready ? "bg-emerald-400/15 text-emerald-300" : "bg-white/5 text-white/35"}`}>{participant.ready ? t.fcHub.pronto_maiusculo : t.fcHub.decidindo_maiusculo}</span></div>)}</div>
            <div className="flex flex-wrap gap-2">
              <button disabled={onlineBusy} onClick={() => void runOnline(() => setOnlineReady(online, !online.room.participants.find(item => item.id === online.participantId)?.ready))} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-3 py-2.5 text-xs font-black text-black disabled:opacity-40"><ShieldCheck className="h-4 w-4"/>{t.fcHub.confirmar_decisoes_2}</button>
              {online.isHost && <button disabled={onlineBusy || !online.room.participants.every(item => item.ready)} onClick={() => void runOnline(() => submitOnlineAction(online, "advance_round", { season: state.season, week: state.week }))} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-3 py-2.5 text-xs font-black text-black disabled:opacity-35"><Play className="h-4 w-4"/>{t.fcHub.avancar_rodada}</button>}
              <button disabled={onlineBusy} onClick={() => void closeOnline()} className="rounded-lg border border-red-400/25 px-3 py-2.5 text-xs font-bold text-red-300"><LogOut className="h-4 w-4"/></button>
            </div>
          </div>}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] text-white/35"><span className="flex items-center gap-1"><Wifi className="h-3 w-3"/>v{ONLINE_GAME_VERSION}</span><span>dados {GAME_DATA_VERSION}</span><span className="font-mono">hash {GAME_DATA_HASH.slice(0,8)}</span></div>
          {onlineError && <p className="mt-3 rounded-lg border border-red-400/20 bg-red-400/5 p-2 text-xs text-red-300">{onlineError}</p>}
        </div> : <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/[.03] p-4 text-xs text-white/50"><b className="text-white">{t.fcHub.sala_local_lan_2}</b><p className="mt-1">{t.fcHub.disponivel_no_aplicativo_instalado_no_nave}</p></div>}
        {/* AMIGOS DE VERDADE. Este bloco mostrava a lista do Discord — vazia
            para quem nao usa Discord, que e a maioria. Agora e a conta do
            Ultrafoot: adicionar, conversar em particular e ver o que os amigos
            andaram fazendo. */}
        <div id="hub-friends" className="scroll-mt-5">
          <HubAmigos secao={secaoDeAmigos} />
        </div>
        <div id="hub-club" className="scroll-mt-5 rounded-xl border border-white/10 bg-white/[.03] p-4">
          <div className="flex items-center gap-2 text-white"><Clock3 className="h-4 w-4 text-[var(--brand)]"/><b>{t.fcHub.tempo_de_jogo}</b></div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-black/25 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-white/35">{t.fcHub.sessao_atual}</p><p className="mt-1 text-lg font-black text-white">{formatDuration(playtime.sessionSeconds)}</p></div>
            <div className="rounded-lg bg-black/25 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-white/35">{t.fcHub.tempo_total}</p><p className="mt-1 text-lg font-black text-[var(--brand)]">{formatDuration(playtime.totalSeconds)}</p></div>
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-white/45"><CalendarDays className="h-3.5 w-3.5"/>Temporada {state.season} · Semana {state.week + 1}</p>
        </div>
        <button id="hub-discord" onClick={() => window.open("https://discord.com/app", "_blank")} className="flex w-full scroll-mt-5 items-center justify-center gap-2 rounded-lg border border-[#5865F2]/40 py-3 text-sm font-bold text-[#aeb4ff]"><ExternalLink className="h-4 w-4"/>{t.fcHub.abrir_discord}</button>
        </div>
      </section>
    </aside>
  </div>
}

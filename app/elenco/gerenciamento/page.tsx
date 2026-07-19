"use client"

import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ChevronLeft, 
  ChevronRight,
  Star,
  Zap,
  Heart,
  Gauge,
  Shield,
  Target,
  TrendingUp,
  Smile,
  ArrowLeftRight,
  RotateCcw,
  Shuffle,
  Info,
  Scale,
  Clock,
  X,
  Gamepad2,
  Save,
  Check,
} from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { TeamCrest } from "@/components/team-crest"
import { PlayerAvatarCircle } from "@/components/player-avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { FORMATIONS, assignPlayersToFormation } from "@/lib/formations"
import { getTeamByShort, serieATeams } from "@/lib/teams-data"
import { useGameState } from "@/lib/save-system"
import { useDiscordActivity } from "@/hooks/use-discord-rpc"
import { saveTacticalSetup, useGameEngine, type Player as EnginePlayer } from "@/lib/game-engine"
import { useUserRoster } from "@/lib/use-user-roster"
import { useNotifications } from "@/components/notifications-system"
import { useTranslation } from "@/lib/i18n"
import { announceOnlineAction } from "@/lib/online-multiplayer"

// FORMATIONS agora vive em lib/formations.ts (compartilhado com a Central de Transferencias).

// Mock players data
// Os elencos MOCK (playersData/benchData) foram REMOVIDOS: eram o elenco do RB
// Bragantino que vazava para todos os clubes quando o save ainda nao havia hidratado.
// Sem time nao se monta elenco nenhum — a tela mostra "carregando".

const positionColors: Record<string, { bg: string; text: string; border: string }> = {
  GOL: { bg: "bg-amber-500/30", text: "text-amber-400", border: "border-amber-500/50" },
  ZAG: { bg: "bg-blue-500/30", text: "text-blue-400", border: "border-blue-500/50" },
  LD: { bg: "bg-blue-500/30", text: "text-blue-400", border: "border-blue-500/50" },
  LE: { bg: "bg-blue-500/30", text: "text-blue-400", border: "border-blue-500/50" },
  ALD: { bg: "bg-blue-500/30", text: "text-blue-400", border: "border-blue-500/50" },
  ALE: { bg: "bg-blue-500/30", text: "text-blue-400", border: "border-blue-500/50" },
  VOL: { bg: "bg-green-500/30", text: "text-green-400", border: "border-green-500/50" },
  MEI: { bg: "bg-green-500/30", text: "text-green-400", border: "border-green-500/50" },
  MD: { bg: "bg-green-500/30", text: "text-green-400", border: "border-green-500/50" },
  ME: { bg: "bg-green-500/30", text: "text-green-400", border: "border-green-500/50" },
  PD: { bg: "bg-purple-500/30", text: "text-purple-400", border: "border-purple-500/50" },
  PE: { bg: "bg-purple-500/30", text: "text-purple-400", border: "border-purple-500/50" },
  ATA: { bg: "bg-red-500/30", text: "text-red-400", border: "border-red-500/50" },
  GL: { bg: "bg-amber-500/30", text: "text-amber-400", border: "border-amber-500/50" },
}

function getOverallColor(overall: number) {
  if (overall >= 85) return "text-yellow-400"
  if (overall >= 80) return "text-lime-400"
  if (overall >= 75) return "text-green-400"
  if (overall >= 70) return "text-blue-400"
  return "text-gray-400"
}

function getStatColor(stat: number) {
  if (stat >= 85) return "text-yellow-400"
  if (stat >= 80) return "text-lime-400"
  if (stat >= 70) return "text-green-400"
  if (stat >= 60) return "text-orange-400"
  return "text-red-400"
}

function getMoralColor(moral: string) {
  switch (moral) {
    case "Feliz": return "text-green-400"
    case "Motivado": return "text-lime-400"
    case "Normal": return "text-yellow-400"
    default: return "text-gray-400"
  }
}

function getStarRating(fintas: number) {
  return Array(5).fill(0).map((_, i) => (
    <Star 
      key={i} 
      className={cn(
        "h-3 w-3",
        i < fintas ? "fill-yellow-400 text-yellow-400" : "text-white/20"
      )} 
    />
  ))
}

// buildElencoPlayers agora vive em lib/use-user-roster.ts (compartilhado com a Escalacao).

type ViewType = "menu" | "visao_tatica" | "gerenciamento" | "escalacoes"

export default function ElencoPage() {
  const router = useRouter()
  const { state } = useGameState()
  const { addNotification } = useNotifications()
  const engineFormation = useGameEngine(s => s.formation)
  const engineSetFormation = useGameEngine(s => s.setFormation)
  const engineSquadPlayers = useGameEngine(s => s.squadPlayers)
  const engineSetStarter = useGameEngine(s => s.setStarter)
  const engineSetPlayerShirtNumber = useGameEngine(s => s.setPlayerShirtNumber)
  const teamTactics = useGameEngine(s => s.teamTactics)
  const setTeamTactics = useGameEngine(s => s.setTeamTactics)
  const tacticalAssignments = useGameEngine(s => s.tacticalAssignments)
  const setTacticalAssignments = useGameEngine(s => s.setTacticalAssignments)
  const tacticalPlayerPositions = useGameEngine(s => s.tacticalPlayerPositions ?? {})
  const setTacticalPlayerPositions = useGameEngine(s => s.setTacticalPlayerPositions)
  // ATENCAO: NAO colocar um time default aqui.
  //
  // Antes era getTeamByShort(state.selectedTeamShort || "BGT"): enquanto o save nao
  // hidratava (no Tauri o persistent-store carrega do disco de forma ASSINCRONA), o
  // primeiro render usava o RB Bragantino e montava o elenco DELE — que o useState logo
  // abaixo congelava. Resultado: o cabecalho mostrava "Barcelona" (recalculado a cada
  // render) enquanto o elenco continuava sendo o do Bragantino, para sempre.
  // Elenco vem do hook compartilhado (lib/use-user-roster), o mesmo usado pela Escalacao.
  // O hook ja lida com a hidratacao assincrona do save: teamReady=false enquanto nao ha
  // time, e o roster e recarregado quando o clube resolve.
  const { userTeam, teamReady, players, setPlayers, bench, setBench } =
    useUserRoster(state.selectedTeamShort, engineSquadPlayers)

  const t = useTranslation()
  useDiscordActivity("Gerenciando o elenco", userTeam.nome)

  const [currentView, setCurrentView] = useState<ViewType>("gerenciamento")
  const [activeTab, setActiveTab] = useState<"elenco" | "taticas" | "atribuicoes">("elenco")
  const formation = engineFormation ?? "4-3-3"
  const setFormation = engineSetFormation
  const [selectedPlayerId, setSelectedPlayerId] = useState<number>(1)
  const [draggingPlayer, setDraggingPlayer] = useState<number | null>(null)
  const [dragOverTarget, setDragOverTarget] = useState<number | null>(null)
  const [playerPositions, setPlayerPositions] = useState<Record<number, { x: number; y: number }>>({})
  const [showMatchNotification, setShowMatchNotification] = useState(false)
  const [isMatchInProgress] = useState(false)
  const [showSubstitutionModal, setShowSubstitutionModal] = useState(false)
  const [showPlayerProfile, setShowPlayerProfile] = useState(false)
  const [showTutorials, setShowTutorials] = useState(false)
  const [showSuggestedSubs, setShowSuggestedSubs] = useState(false)
  const [tacticalSaved, setTacticalSaved] = useState(false)
  const [ballInstruction, setBallInstruction] = useState<"sem_bola" | "com_bola">("sem_bola")
  const pitchRef = useRef<HTMLDivElement>(null)
  const positionsHydratedForTeam = useRef("")

  const TABS: Array<"elenco" | "taticas" | "atribuicoes"> = ["elenco", "taticas", "atribuicoes"]
  const allPlayers = useMemo(() => [...players, ...bench], [players, bench])

  // Restaura e salva automaticamente os ajustes manuais do campo. Usamos o nome
  // como chave porque atletas importados/contratados podem receber outro ID interno.
  useEffect(() => {
    if (!teamReady || allPlayers.length === 0 || positionsHydratedForTeam.current === userTeam.curto) return
    const byName = new Map(allPlayers.map(player => [player.name, player.id]))
    const restored: Record<number, { x: number; y: number }> = {}
    for (const [name, position] of Object.entries(tacticalPlayerPositions)) {
      const id = byName.get(name)
      if (id !== undefined) restored[id] = position
    }
    positionsHydratedForTeam.current = userTeam.curto
    setPlayerPositions(restored)
  }, [allPlayers, tacticalPlayerPositions, teamReady, userTeam.curto])

  useEffect(() => {
    if (!teamReady || positionsHydratedForTeam.current !== userTeam.curto) return
    const byId = new Map(allPlayers.map(player => [player.id, player.name]))
    const saved: Record<string, { x: number; y: number }> = {}
    for (const [rawId, position] of Object.entries(playerPositions)) {
      const name = byId.get(Number(rawId))
      if (name) saved[name] = position
    }
    setTacticalPlayerPositions(saved)
  }, [allPlayers, playerPositions, setTacticalPlayerPositions, teamReady, userTeam.curto])

  // ── TATICAS: antes os botoes eram DECORATIVOS (o "selecionado" era um `i === 1`
  // chumbado no JSX). Agora tem estado de verdade e o clique muda a instrucao.
  const [linhaDefensiva, setLinhaDefensiva] = useState(() => ["baixa", "media", "alta"].indexOf(teamTactics.defensiveLine))
  const [marcacao, setMarcacao] = useState(() => teamTactics.pressingIntensity === "alta" || teamTactics.pressingIntensity === "muito_alta" ? 0 : teamTactics.pressingIntensity === "baixa" ? 2 : 1)
  const [construcao, setConstrucao] = useState(() => ["curto", "misto", "longo"].indexOf(teamTactics.buildUp))
  const [velocidadeAtaque, setVelocidadeAtaque] = useState(() => ["lento", "normal", "rapido"].indexOf(teamTactics.tempo))
  const [mentalidade, setMentalidade] = useState(() => ["muito_defensivo", "defensivo", "equilibrado", "ofensivo", "muito_ofensivo"].indexOf(teamTactics.mentality))

  useEffect(() => {
    setTeamTactics({
      defensiveLine: (["baixa", "media", "alta"] as const)[linhaDefensiva] ?? "media",
      pressingIntensity: (["alta", "media", "baixa"] as const)[marcacao] ?? "media",
      buildUp: (["curto", "misto", "longo"] as const)[construcao] ?? "misto",
      tempo: (["lento", "normal", "rapido"] as const)[velocidadeAtaque] ?? "normal",
      mentality: (["muito_defensivo", "defensivo", "equilibrado", "ofensivo", "muito_ofensivo"] as const)[mentalidade] ?? "equilibrado",
    })
  }, [construcao, linhaDefensiva, marcacao, mentalidade, setTeamTactics, velocidadeAtaque])

  // ── ATRIBUICOES: cobradores/capitao vinham CHUMBADOS ("Eric Ramires", "Lincoln",
  // "Eduardo Sasha", "Pedro Henrique" — elenco do RB Bragantino) e apareciam mesmo
  // jogando com o Corinthians. Agora saem do elenco REAL, por atributo + posicao.
  const setPieceDefaults = useMemo(() => {
    const outfield = allPlayers.filter((p) => p.position !== "GOL")
    if (outfield.length === 0) return { corner: "", freeKick: "", freeKickLeft: "", freeKickRight: "", penalty: "", captain: "" }
    // Peso por posicao: quem realmente bate bola parada.
    const KICK_BIAS: Record<string, number> = {
      ATA: 8, PE: 10, PD: 10, MEI: 12, VOL: 4, LD: 2, LE: 2, ZAG: -6, ALD: 2, ALE: 2,
    }
    const bias = (p: (typeof outfield)[number]) => KICK_BIAS[p.position] ?? 0
    const top = (score: (p: (typeof outfield)[number]) => number) =>
      [...outfield].sort((a, b) => score(b) - score(a))[0]?.name ?? ""
    const fk = top((p) => p.shooting * 0.6 + p.passing * 0.4 + bias(p))
    return {
      corner: top((p) => p.passing + bias(p)),
      freeKick: fk,
      // Batedor de falta por lado (relatado). Sem dado de pe dominante, ambos caem no melhor
      // batedor por padrao; o usuario ajusta cada lado a mao.
      freeKickLeft: fk,
      freeKickRight: fk,
      penalty: top((p) => p.shooting + bias(p)),
      // Capitao: mistura qualidade e experiencia (idade), nao so overall.
      captain: [...allPlayers].sort((a, b) => (b.overall + b.age * 0.6) - (a.overall + a.age * 0.6))[0]?.name ?? "",
    }
  }, [allPlayers])

  const [setPieces, setSetPieces] = useState(setPieceDefaults)
  useEffect(() => {
    setSetPieces({
      corner: tacticalAssignments.corner || setPieceDefaults.corner,
      freeKick: tacticalAssignments.freeKick || setPieceDefaults.freeKick,
      freeKickLeft: tacticalAssignments.freeKickLeft || setPieceDefaults.freeKickLeft,
      freeKickRight: tacticalAssignments.freeKickRight || setPieceDefaults.freeKickRight,
      penalty: tacticalAssignments.penalty || setPieceDefaults.penalty,
      captain: tacticalAssignments.captain || setPieceDefaults.captain,
    })
  }, [setPieceDefaults, tacticalAssignments.captain, tacticalAssignments.corner, tacticalAssignments.freeKick, tacticalAssignments.freeKickLeft, tacticalAssignments.freeKickRight, tacticalAssignments.penalty])

  const updateSetPiece = (key: keyof typeof setPieces, value: string) => {
    setSetPieces(current => ({ ...current, [key]: value }))
    setTacticalAssignments({ [key]: value })
  }

  // Funcao individual por jogador (o <select> antes nao tinha estado nem onChange).
  const [playerRoles, setPlayerRoles] = useState<Record<number, string>>({})
  useEffect(() => {
    const restored = Object.fromEntries(allPlayers.map(player => [player.id, tacticalAssignments.playerRoles[player.name] ?? player.function]))
    setPlayerRoles(restored)
  }, [allPlayers, tacticalAssignments.playerRoles])

  const updatePlayerRole = (playerId: number, role: string) => {
    const player = allPlayers.find(item => item.id === playerId)
    if (!player) return
    setPlayerRoles(current => ({ ...current, [playerId]: role }))
    setTacticalAssignments({ playerRoles: { [player.name]: role } })
  }

  // Match notifications should only show during actual matches (simulations)
  // This would be triggered by the match simulation system
  // For now, we check a hypothetical state flag
  
  const selectedPlayer = useMemo(() => {
    return [...players, ...bench].find(p => p.id === selectedPlayerId) || players[0]
  }, [selectedPlayerId, players, bench])
  
  const formationKeys = Object.keys(FORMATIONS)
  const currentFormationIndex = formationKeys.indexOf(formation)
  
  // Encaixe por POSICAO (nao por indice do array) — ver lib/formations.ts.
  const positionedPlayers = useMemo(
    () => assignPlayersToFormation(players, formation, playerPositions),
    [players, formation, playerPositions],
  )
  
  const nextFormation = () => {
    const nextIndex = (currentFormationIndex + 1) % formationKeys.length
    setFormation(formationKeys[nextIndex])
    setPlayerPositions({}) // Reset custom positions on formation change
  }
  
  const prevFormation = () => {
    const prevIndex = (currentFormationIndex - 1 + formationKeys.length) % formationKeys.length
    setFormation(formationKeys[prevIndex])
    setPlayerPositions({})
  }

  const handleSaveTacticalSetup = () => {
    if (players.length !== 11) {
      addNotification({ type: "system", title: "Escalação incompleta", message: "Selecione exatamente 11 titulares antes de salvar.", priority: "high" })
      return
    }
    // Faz um snapshot das posições junto com XI e formação. Não depende do efeito
    // assíncrono de arrastar/salvar, que podia deixar a partida seguinte com o layout
    // anterior quando o usuário iniciava o jogo logo após clicar em Salvar.
    const nameById = new Map(allPlayers.map(player => [player.id, player.name]))
    const savedPositions: Record<string, { x: number; y: number }> = {}
    for (const [id, position] of Object.entries(playerPositions)) {
      const name = nameById.get(Number(id))
      if (name) savedPositions[name] = position
    }
    saveTacticalSetup(players.map(player => player.name), formation, savedPositions)
    announceOnlineAction("lineup_update", { formation, starters: players.map(player => player.name) })
    setTacticalSaved(true)
    addNotification({ type: "system", title: "Tática salva", message: `${formation} e os 11 titulares serão usados na partida e no radar ao vivo.`, priority: "medium" })
    window.setTimeout(() => setTacticalSaved(false), 2200)
  }

  // Sincroniza titulares com o game-engine sempre que players mudar
  // (game-engine usa nome como chave pois os IDs internos diferem)
  useEffect(() => {
    if (engineSquadPlayers.length === 0) return
    const starterNames = new Set(players.map(p => p.name))
    engineSquadPlayers.forEach((ep: EnginePlayer) => {
      const shouldBeStarter = starterNames.has(ep.name)
      if (ep.isStarter !== shouldBeStarter) {
        engineSetStarter(ep.id, shouldBeStarter)
      }
    })
  }, [players, engineSquadPlayers, engineSetStarter])

  // Navegacao por controle no elenco
  useEffect(() => {
    const handleGamepadButton = (e: Event) => {
      const { button } = (e as CustomEvent<{ button: string }>).detail

      if (showSubstitutionModal) {
        if (button === "B") setShowSubstitutionModal(false)
        return
      }
      if (showPlayerProfile) {
        if (button === "B") setShowPlayerProfile(false)
        return
      }

      switch (button) {
        case "B":
          router.back()
          break
        case "LB": {
          const i = TABS.indexOf(activeTab)
          setActiveTab(TABS[(i - 1 + TABS.length) % TABS.length])
          break
        }
        case "RB": {
          const i = TABS.indexOf(activeTab)
          setActiveTab(TABS[(i + 1) % TABS.length])
          break
        }
        case "LT":
          prevFormation()
          break
        case "RT":
          nextFormation()
          break
        case "DPAD_UP": {
          const idx = allPlayers.findIndex(p => p.id === selectedPlayerId)
          if (idx > 0) setSelectedPlayerId(allPlayers[idx - 1].id)
          break
        }
        case "DPAD_DOWN": {
          const idx = allPlayers.findIndex(p => p.id === selectedPlayerId)
          if (idx < allPlayers.length - 1) setSelectedPlayerId(allPlayers[idx + 1].id)
          break
        }
        case "A":
          setShowPlayerProfile(true)
          break
        case "Y":
          setShowSubstitutionModal(true)
          break
      }
    }

    window.addEventListener("gamepad:button", handleGamepadButton)
    return () => window.removeEventListener("gamepad:button", handleGamepadButton)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, activeTab, selectedPlayerId, allPlayers, showSubstitutionModal, showPlayerProfile])

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, playerId: number) => {
    setDraggingPlayer(playerId)
    e.dataTransfer.setData("playerId", playerId.toString())
    e.dataTransfer.effectAllowed = "move"
  }, [])
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }, [])
  
  const handleDragOverPlayer = useCallback((e: React.DragEvent, playerId: number) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverTarget(playerId)
  }, [])
  
  const handleDragLeave = useCallback(() => {
    setDragOverTarget(null)
  }, [])
  
  /**
   * Congela o slot de TODOS os 11 em campo e troca so as coordenadas de A e B.
   *
   * BUG que isto corrige ("ao substituir um jogador, o sistema rotaciona o time"):
   * positionedPlayers reencaixa o elenco por POSICAO a cada mudanca em `players`. Trocar
   * um unico jogador mudava o conjunto de posicoes e o encaixe recalculava para TODOS —
   * varios jogadores pulavam de slot de uma vez. Pior: os handlers ainda APAGAVAM a
   * posicao fixada dos envolvidos, forcando o reencaixe.
   *
   * Fixando os 11 slots atuais, o encaixe automatico nao tem mais o que "decidir": so
   * os dois jogadores da troca mudam de lugar.
   *
   * Precisa vir ANTES de handleDropOnPitch — que o referencia nas deps.
   */
  const pinSlotsAndSwap = useCallback((aId: number, bId: number) => {
    setPlayerPositions(() => {
      const pinned: Record<number, { x: number; y: number }> = {}
      for (const p of positionedPlayers) pinned[p.id] = { x: p.x, y: p.y }

      const slotA = pinned[aId]
      const slotB = pinned[bId]
      // Um deles pode vir do banco (sem slot): quem entra herda o slot de quem sai.
      if (slotA && slotB) {
        pinned[aId] = slotB
        pinned[bId] = slotA
      } else if (slotB) {
        pinned[aId] = slotB   // A veio do banco, assume o slot de B
        delete pinned[bId]
      } else if (slotA) {
        pinned[bId] = slotA   // B veio do banco, assume o slot de A
        delete pinned[aId]
      }
      return pinned
    })
  }, [positionedPlayers])

  const handleDropOnPitch = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const playerId = parseInt(e.dataTransfer.getData("playerId"))
    
    if (!pitchRef.current || !playerId) return
    
    const rect = pitchRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    
    // Clamp to field bounds
    const clampedX = Math.max(5, Math.min(95, x))
    const clampedY = Math.max(5, Math.min(95, y))
    
    // Check if player is from bench
    const benchPlayer = bench.find(p => p.id === playerId)
    if (benchPlayer) {
      // Find closest field player to swap
      const fieldPlayer = positionedPlayers.reduce((closest, p) => {
        const dist = Math.hypot(p.x - clampedX, p.y - clampedY)
        const closestDist = closest ? Math.hypot(closest.x - clampedX, closest.y - clampedY) : Infinity
        return dist < closestDist ? p : closest
      }, null as typeof positionedPlayers[0] | null)

      if (fieldPlayer) {
        setPlayers(prev => prev.map(p => p.id === fieldPlayer.id ? benchPlayer : p))
        setBench(prev => prev.map(p => p.id === benchPlayer.id ? fieldPlayer : p))
        // Mesmo motivo do handleDropOnPlayer: sem fixar os slots, o encaixe por posicao
        // recalcula e "rotaciona" varios jogadores de uma vez.
        pinSlotsAndSwap(benchPlayer.id, fieldPlayer.id)
      }
    } else {
      // Jogador de campo largado num ponto livre: so ele se move.
      setPlayerPositions(prev => {
        const pinned = { ...prev }
        for (const p of positionedPlayers) {
          if (pinned[p.id] === undefined) pinned[p.id] = { x: p.x, y: p.y }
        }
        pinned[playerId] = { x: clampedX, y: clampedY }
        return pinned
      })
    }

    setDraggingPlayer(null)
    setDragOverTarget(null)
  }, [bench, positionedPlayers, pinSlotsAndSwap])
  
  const handleDropOnPlayer = useCallback((e: React.DragEvent, targetId: number) => {
    e.preventDefault()
    e.stopPropagation()

    const draggedId = parseInt(e.dataTransfer.getData("playerId"))
    if (!draggedId || draggedId === targetId) {
      setDraggingPlayer(null)
      setDragOverTarget(null)
      return
    }

    const draggedFromField = players.find(p => p.id === draggedId)
    const draggedFromBench = bench.find(p => p.id === draggedId)
    const targetFromField = players.find(p => p.id === targetId)
    const targetFromBench = bench.find(p => p.id === targetId)

    if (draggedFromField && targetFromField) {
      // Troca em campo: os dois apenas trocam de slot, o resto fica parado.
      const draggedIdx = players.findIndex(p => p.id === draggedId)
      const targetIdx = players.findIndex(p => p.id === targetId)
      setPlayers(prev => {
        const newPlayers = [...prev]
        ;[newPlayers[draggedIdx], newPlayers[targetIdx]] = [newPlayers[targetIdx], newPlayers[draggedIdx]]
        return newPlayers
      })
      pinSlotsAndSwap(draggedId, targetId)
    } else if (draggedFromBench && targetFromField) {
      // Reserva ENTRA no lugar exato do titular que sai.
      setPlayers(prev => prev.map(p => p.id === targetId ? draggedFromBench : p))
      setBench(prev => prev.map(p => p.id === draggedId ? targetFromField : p))
      pinSlotsAndSwap(draggedId, targetId)
    } else if (draggedFromField && targetFromBench) {
      // Titular vai para o banco; o reserva assume o slot dele.
      setPlayers(prev => prev.map(p => p.id === draggedId ? targetFromBench : p))
      setBench(prev => prev.map(p => p.id === targetId ? draggedFromField : p))
      pinSlotsAndSwap(targetId, draggedId)
    } else if (draggedFromBench && targetFromBench) {
      // Troca dentro do banco: ninguem em campo se mexe.
      const draggedIdx = bench.findIndex(p => p.id === draggedId)
      const targetIdx = bench.findIndex(p => p.id === targetId)
      setBench(prev => {
        const newBench = [...prev]
        ;[newBench[draggedIdx], newBench[targetIdx]] = [newBench[targetIdx], newBench[draggedIdx]]
        return newBench
      })
    }

    setDraggingPlayer(null)
    setDragOverTarget(null)
  }, [players, bench, pinSlotsAndSwap])
  
  const handleDragEnd = useCallback(() => {
    setDraggingPlayer(null)
    setDragOverTarget(null)
  }, [])

  /**
   * Save ainda hidratando: nao ha time nem elenco.
   *
   * Antes a pagina "resolvia" isso com um time default (RB Bragantino) e montava o
   * elenco dele — que o useState congelava. Melhor mostrar carregando por um instante
   * do que exibir, para sempre, o elenco de um clube que nao e o seu.
   * (Todos os hooks ja rodaram acima; este early-return nao quebra a ordem deles.)
   */
  if (!teamReady || players.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050508] text-sm text-white/40">
        Carregando elenco...
      </div>
    )
  }

  // Menu view with cards
  if (currentView === "menu") {
    return (
      <div className="h-screen md:pl-0 pl-0 pb-20 md:pb-0 bg-[#050508] flex flex-col overflow-hidden">
        <GameHeader team={userTeam} />
        
        <main className="flex-1 p-4 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <TeamCrest team={userTeam} size="lg" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">{userTeam.nome}</h1>
              <p className="text-sm text-white/50">{t.squad.title}</p>
            </div>
          </div>
          
          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {/* Visao Tatica Card */}
            <motion.button
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setCurrentView("visao_tatica")}
              className="relative p-6 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-left overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
              <h2 className="text-xl md:text-2xl font-bold text-white mb-1">{t.squad.tacticalView}</h2>
              <p className="text-sm text-primary mb-6">{t.squad.currentTactic}</p>
              
              <div className="flex justify-center mb-6">
                <Scale className="h-20 w-20 md:h-24 md:w-24 text-white/80" />
              </div>
              
              <p className="text-lg font-semibold text-white">{t.squad.standard}</p>

              <div className="flex items-center gap-2 mt-4 text-white/60 text-sm">
                <X className="h-4 w-4" />
                <span>{t.squad.playerImpact}</span>
              </div>
            </motion.button>
            
            {/* Gerenciamento do Time Card */}
            <motion.button
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setCurrentView("gerenciamento")}
              className="relative p-6 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-left overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
              <h2 className="text-xl md:text-2xl font-bold text-white mb-1">{t.squad.teamManagement}</h2>
              <p className="text-sm text-primary mb-4">{t.squad.standard} {userTeam.nome.toUpperCase()}</p>
              
              {/* Mini field preview */}
              <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-green-900/30 mb-4">
                <svg viewBox="0 0 100 75" className="absolute inset-0 w-full h-full">
                  <g stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" fill="none">
                    <rect x="5" y="5" width="90" height="65" />
                    <line x1="50" y1="5" x2="50" y2="70" />
                    <circle cx="50" cy="37.5" r="8" />
                  </g>
                  {/* Players dots */}
                  {FORMATIONS[formation].positions.map((pos, i) => (
                    <circle key={i} cx={pos.x} cy={pos.y * 0.75} r="3" fill="white" />
                  ))}
                </svg>
              </div>
              
              {/* Stats indicators */}
              <div className="flex justify-around">
                <div className="flex flex-col items-center gap-1">
                  <div className="h-8 w-8 rounded-full border-2 border-green-500 flex items-center justify-center">
                    <Zap className="h-4 w-4 text-green-500" />
                  </div>
                  <span className="text-[10px] text-white/60">{t.squad.physicalPrep}</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="h-8 w-8 rounded-full border-2 border-green-500 flex items-center justify-center">
                    <Gauge className="h-4 w-4 text-green-500" />
                  </div>
                  <span className="text-[10px] text-white/60">{t.squad.rhythm}</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="h-8 w-8 rounded-full border-2 border-green-500 flex items-center justify-center">
                    <Heart className="h-4 w-4 text-green-500" />
                  </div>
                  <span className="text-[10px] text-white/60">{t.squad.morale}</span>
                </div>
              </div>
            </motion.button>
            
            {/* Escalacoes Card */}
            <motion.button
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setCurrentView("escalacoes")}
              className="relative p-6 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-left overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
              <h2 className="text-xl md:text-2xl font-bold text-white mb-1">{t.squad.lineups}</h2>
              <p className="text-sm text-primary mb-6">{t.squad.lineupsCreated}</p>
              
              <div className="flex justify-center mb-6">
                <div className="relative w-20 h-20 md:w-24 md:h-24">
                  <div className="absolute inset-0 border-2 border-white/80 rounded-lg" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 border-2 border-white/80 rounded-full" />
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-4 border-2 border-t-0 border-white/80" />
                </div>
              </div>
              
              <p className="text-xs text-white/60 text-center leading-relaxed">
                {t.squad.lineupsDesc}
              </p>
            </motion.button>
          </div>
          
          {/* Bottom controls */}
          <div className="fixed bottom-0 left-0 md:left-16 right-0 h-14 bg-[#0d0d0d] border-t border-white/10 flex items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-2 md:gap-4">
              <Button variant="ghost" size="sm" className="text-white/60 hover:text-white text-xs md:text-sm">
                <Gamepad2 className="h-4 w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">{t.settings.selectBtn}</span>
              </Button>
              <Button variant="ghost" size="sm" className="text-white/60 hover:text-white text-xs md:text-sm">
                <ChevronLeft className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">{t.common.back}</span>
              </Button>
              <Button variant="ghost" size="sm" className="text-white/60 hover:text-white text-xs md:text-sm">
                <Info className="h-4 w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">{t.squad.tutorials}</span>
              </Button>
            </div>
            
            <Button
              onClick={() => setCurrentView("gerenciamento")}
              className="bg-primary hover:bg-primary/90 text-black font-semibold text-xs md:text-sm"
            >
              <Gamepad2 className="h-4 w-4 mr-1 md:mr-2" />
              {t.squad.enterTacticalView}
            </Button>
          </div>
        </main>
      </div>
    )
  }
  
  // Visao Tatica view
  if (currentView === "visao_tatica") {
    return (
      <div className="h-screen md:pl-0 pl-0 pb-20 md:pb-0 bg-gradient-to-br from-primary/20 via-[#0a0a0a] to-primary/10 flex flex-col overflow-hidden">
        <GameHeader team={userTeam} />
        
        <main className="flex-1 p-4 overflow-y-auto">
          {/* Sub-header */}
          <div className="flex items-center gap-4 md:gap-6 mb-6 flex-wrap">
            <Button 
              variant="ghost" 
              onClick={() => setCurrentView("menu")}
              className="text-white/60 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              {t.sidebar.squad}
            </Button>
            <h1 className="text-lg md:text-xl font-bold text-white">{t.squad.tacticalView}</h1>
            <div className="hidden md:flex items-center gap-4 text-white/60">
              <span>Gestao de Auxiliares Tec.</span>
              <span>Predefinicoes Taticas</span>
            </div>
          </div>
          
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left panel - Tactical info */}
            <div className="lg:w-1/3 space-y-6">
              <div>
                <h2 className="text-sm text-white/60 uppercase tracking-wider mb-4">{t.squad.currentTactic}</h2>

                <div className="flex flex-col items-center text-center mb-6">
                  <Scale className="h-24 w-24 md:h-32 md:w-32 text-white/80 mb-4" />
                  <h3 className="text-2xl md:text-3xl font-bold text-white uppercase tracking-wider">{t.squad.standard}</h3>
                </div>
                
                <p className="text-sm text-white/60 text-center leading-relaxed mb-6">
                  O seu time adota um estilo equilibrado, com foco em conservar uma estrutura tatica que de solidez defensiva sem abrir mao de levar perigo no ataque.
                </p>
                
                {/* Tactical categories */}
                <div className="space-y-3">
                  {["Ataque", "Meio-campo", "Defesa", "Gol"].map((cat) => (
                    <div key={cat} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                      <span className="text-white">{cat}</span>
                      <span className="text-white/40 text-sm">ND</span>
                    </div>
                  ))}
                </div>
                
                <Button variant="outline" className="w-full mt-4 border-white/20 text-white">
                  <Gamepad2 className="h-4 w-4 mr-2" />
                  {t.squad.changeTactic}
                </Button>
              </div>
            </div>
            
            {/* Right panel - Field with players */}
            <div className="lg:flex-1">
              <div className="flex items-center gap-2 mb-4">
                <X className="h-4 w-4 text-white/40" />
                <span className="text-sm text-white/60">{t.squad.playerImpact}</span>
              </div>
              
              <div 
                className="relative rounded-2xl overflow-hidden"
                style={{
                  background: `linear-gradient(180deg, oklch(0.42 0.14 145), oklch(0.32 0.11 145))`,
                  aspectRatio: "3 / 4",
                }}
              >
                {/* Pitch stripes */}
                <div
                  className="absolute inset-0 opacity-15"
                  style={{
                    backgroundImage: "repeating-linear-gradient(0deg, transparent 0 8%, rgba(0,0,0,0.15) 8% 16%)",
                  }}
                />
                
                {/* Pitch markings */}
                <svg viewBox="0 0 100 133" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
                  <g stroke="rgba(255,255,255,0.35)" strokeWidth="0.3" fill="none">
                    {/* Campo exterior */}
                    <rect x="3" y="3" width="94" height="127" rx="1" />
                    {/* Linha do meio */}
                    <line x1="3" y1="66.5" x2="97" y2="66.5" />
                    {/* Circulo central */}
                    <circle cx="50" cy="66.5" r="12" />
                    <circle cx="50" cy="66.5" r="0.8" fill="rgba(255,255,255,0.35)" />
                    {/* Area grande - topo (ataque) */}
                    <rect x="20" y="3" width="60" height="20" />
                    {/* Area pequena - topo */}
                    <rect x="32" y="3" width="36" height="8" />
                    {/* Arco da area - topo */}
                    <path d="M 35 23 Q 50 30 65 23" />
                    {/* Area grande - baixo (defesa) */}
                    <rect x="20" y="110" width="60" height="20" />
                    {/* Area pequena - baixo */}
                    <rect x="32" y="122" width="36" height="8" />
                    {/* Arco da area - baixo */}
                    <path d="M 35 110 Q 50 103 65 110" />
                    {/* Gol - topo */}
                    <rect x="40" y="0" width="20" height="3" strokeWidth="0.4" />
                    {/* Gol - baixo */}
                    <rect x="40" y="130" width="20" height="3" strokeWidth="0.4" />
                  </g>
                </svg>
                
                {/* Players */}
                {positionedPlayers.map((player) => (
                  <motion.button
                    key={player.id}
                    initial={false}
                    animate={{ left: `${player.x}%`, top: `${player.y}%` }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    onClick={() => setSelectedPlayerId(player.id)}
                    className={cn(
                      "absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group z-10",
                      selectedPlayerId === player.id && "z-20"
                    )}
                  >
                    <div className={cn(
                      "px-2 py-0.5 rounded text-[8px] md:text-[9px] font-semibold mb-1 whitespace-nowrap transition-all",
                      selectedPlayerId === player.id
                        ? "bg-[#00ffc8] text-black"
                        : "bg-black/60 text-white/90"
                    )}>
                      {player.name.split(" ").pop()}
                    </div>
                    
                    <div className="relative">
                      {player.potential > player.overall + 3 && (
                        <div className="absolute -top-1 -left-1 h-3 w-3 md:h-4 md:w-4 rounded-full bg-[#00ffc8] flex items-center justify-center z-10">
                          <TrendingUp className="h-2 w-2 md:h-2.5 md:w-2.5 text-black" />
                        </div>
                      )}
                      
                      <PlayerAvatarCircle
                        name={player.name}
                        teamColor={userTeam.cor1}
                        size="sm"
                        className={cn(
                          "border-2 transition-all",
                          selectedPlayerId === player.id
                            ? "border-[#00ffc8] shadow-[0_0_12px_rgba(29,185,84,0.5)]"
                            : "border-white/30"
                        )}
                      />
                      
                      <div className={cn(
                        "absolute -bottom-1 -right-1 h-5 w-5 md:h-6 md:w-6 rounded-full flex items-center justify-center text-[9px] md:text-[10px] font-black",
                        "bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border",
                        selectedPlayerId === player.id ? "border-[#00ffc8]" : "border-white/30"
                      )}>
                        <span className={getOverallColor(player.overall)}>{player.overall}</span>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
          
          {/* Bottom controls */}
          <div className="fixed bottom-0 left-0 md:left-16 right-0 h-14 bg-[#0d0d0d] border-t border-white/10 flex items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-2 md:gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setCurrentView("menu")}
                className="text-white/60 hover:text-white text-xs md:text-sm"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t.common.back}
              </Button>
              <Button variant="ghost" size="sm" className="text-white/60 hover:text-white text-xs md:text-sm">
                <Info className="h-4 w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">{t.squad.showDetails}</span>
              </Button>
            </div>

            <Button
              onClick={() => setCurrentView("gerenciamento")}
              className="bg-primary/20 hover:bg-primary/30 text-primary text-xs md:text-sm"
            >
              {t.squad.goToTeamManagement}
            </Button>
          </div>
        </main>
      </div>
    )
  }

  // Gerenciamento view (main view)
  return (
    // pl-16 removido: reservava 64px para uma sidebar que nao existe nesta view,
    // deixando uma faixa vazia a esquerda. Agora o conteudo ocupa a largura toda.
    // flex flex-col: sem isso o flex-1 do conteudo nao tinha efeito (o pai nao era flex),
    // o campo parava na altura natural e sobrava uma faixa preta ate o rodape.
    <div className="flex h-screen flex-col overflow-hidden bg-[#050508]">
      <GameHeader team={userTeam} />
      
      {/* Match notification toast - only shows during actual match simulations */}
      <AnimatePresence>
        {isMatchInProgress && showMatchNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-[#1a1a1a] border border-white/10 shadow-2xl"
          >
            <Clock className="h-5 w-5 text-white/60" />
            <div>
              <p className="text-sm font-semibold text-white">Partida Iniciada</p>
              <p className="text-xs text-white/50">{userTeam.nome} x Sao Paulo - Campeonato Brasileiro</p>
            </div>
            <button 
              onClick={() => setShowMatchNotification(false)}
              className="p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* flex-1 min-h-0 em vez de h-[calc(100vh-48px-56px)]: a altura fixa reservava ~56px
          a mais que o header realmente ocupa, deixando uma faixa preta vazia no rodape. */}
      <main className="flex-1 min-h-0 flex flex-col">
        {/* Sub-header with tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between px-3 md:px-6 py-2 md:py-3 border-b border-white/10 bg-[#0d0d0d] gap-2 md:gap-0">
          <div className="flex items-center gap-3 md:gap-6">
            <div className="flex items-center gap-2 md:gap-3">
              <TeamCrest team={userTeam} size="sm" />
              <div className="hidden sm:block">
                <h1 className="text-sm font-bold text-white">{t.squad.teamManagement}</h1>
                <p className="text-[10px] text-white/40">{userTeam.nome}</p>
              </div>
            </div>
            
            {/* Tabs */}
            <div className="flex items-center gap-1">
              {(["elenco", "taticas", "atribuicoes"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-2 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium transition-all rounded",
                    activeTab === tab
                      ? "text-white bg-white/10"
                      : "text-white/40 hover:text-white/70"
                  )}
                >
                  {tab === "elenco" ? t.sidebar.squad : tab === "taticas" ? t.squad.tactics : t.squad.assignments}
                </button>
              ))}
            </div>
          </div>
          
          {/* Formation controls */}
          <div className="flex items-center gap-2 justify-center md:justify-end">
            <button
              onClick={handleSaveTacticalSetup}
              title="Salvar tática e escalação"
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-all",
                tacticalSaved
                  ? "border-[#00ffc8] bg-[#00ffc8]/20 text-[#00ffc8]"
                  : "border-white/10 bg-white/5 text-white hover:border-[#00ffc8]/50 hover:text-[#00ffc8]",
              )}
            >
              {tacticalSaved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              <span className="hidden xl:inline">{tacticalSaved ? "Salvo" : "Salvar"}</span>
            </button>
            <button
              onClick={prevFormation}
              className="p-1.5 md:p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {/* Dropdown: escolher a formacao direto (o relatorio pediu — antes so setas). */}
            <select
              value={formation}
              onChange={(e) => { setFormation(e.target.value); setPlayerPositions({}) }}
              title="Escolher formacao"
              className="px-3 md:px-4 py-1.5 md:py-2 min-w-[80px] md:min-w-[110px] text-center rounded-lg bg-[#00ffc8]/20 border border-[#00ffc8]/30 text-base md:text-lg font-black text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#00ffc8]/50 appearance-none"
            >
              {formationKeys.map((f) => (
                <option key={f} value={f} className="bg-[#0c0c14] text-white font-bold">{f}</option>
              ))}
            </select>
            <button 
              onClick={nextFormation}
              className="p-1.5 md:p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          {/* Main content area */}
          <div className="flex-1 flex flex-col p-2 md:p-4 min-h-0">
            {/* Tab Content: Elenco */}
            {activeTab === "elenco" && (
            <>
            {/* Pitch area */}
            <div
              ref={pitchRef}
              onDragOver={handleDragOver}
              onDrop={handleDropOnPitch}
              className="relative rounded-xl md:rounded-2xl overflow-hidden flex-1 min-h-[350px] w-full max-w-[560px] mx-auto"
              style={{
                // Turfa em gradiente radial (mais viva ao alto) + sombra interna — a
                // direcao visual aprovada, evolucao do gradiente chapado anterior.
                background:
                  "radial-gradient(120% 90% at 50% -6%, #1c5a3a 0%, #164a31 44%, #0f3722 78%, #0a2718 100%)",
                boxShadow: "inset 0 0 60px rgba(0,0,0,0.5)",
              }}
            >
              {/* Refletores nos quatro cantos (clima de estadio a noite). */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(60% 55% at 15% 8%, rgba(255,255,235,0.10), transparent 70%)," +
                    "radial-gradient(60% 55% at 85% 8%, rgba(255,255,235,0.10), transparent 70%)," +
                    "radial-gradient(60% 55% at 15% 92%, rgba(255,255,235,0.07), transparent 70%)," +
                    "radial-gradient(60% 55% at 85% 92%, rgba(255,255,235,0.07), transparent 70%)",
                }}
              />
              {/* Pitch stripes */}
              <div
                className="absolute inset-0 opacity-15"
                style={{
                  backgroundImage: "repeating-linear-gradient(0deg, transparent 0 8%, rgba(0,0,0,0.15) 8% 16%)",
                }}
              />
              
              {/* Pitch markings */}
              <svg viewBox="0 0 100 133" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
                <g stroke="rgba(255,255,255,0.35)" strokeWidth="0.3" fill="none">
                  {/* Campo exterior */}
                  <rect x="3" y="3" width="94" height="127" rx="1" />
                  {/* Linha do meio */}
                  <line x1="3" y1="66.5" x2="97" y2="66.5" />
                  {/* Circulo central */}
                  <circle cx="50" cy="66.5" r="12" />
                  <circle cx="50" cy="66.5" r="0.8" fill="rgba(255,255,255,0.35)" />
                  {/* Area grande - topo (ataque) */}
                  <rect x="20" y="3" width="60" height="20" />
                  {/* Area pequena - topo */}
                  <rect x="32" y="3" width="36" height="8" />
                  {/* Ponto do penalti - topo */}
                  <circle cx="50" cy="16" r="0.8" fill="rgba(255,255,255,0.35)" />
                  {/* Arco da area - topo */}
                  <path d="M 35 23 Q 50 30 65 23" />
                  {/* Area grande - baixo (defesa) */}
                  <rect x="20" y="110" width="60" height="20" />
                  {/* Area pequena - baixo */}
                  <rect x="32" y="122" width="36" height="8" />
                  {/* Ponto do penalti - baixo */}
                  <circle cx="50" cy="117" r="0.8" fill="rgba(255,255,255,0.35)" />
                  {/* Arco da area - baixo */}
                  <path d="M 35 110 Q 50 103 65 110" />
                  {/* Gol - topo */}
                  <rect x="40" y="0" width="20" height="3" strokeWidth="0.4" />
                  {/* Gol - baixo */}
                  <rect x="40" y="130" width="20" height="3" strokeWidth="0.4" />
                </g>
              </svg>

              {/* Players on pitch */}
              {positionedPlayers.map((player) => (
                <motion.div
                  key={player.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, player.id)}
                  onDragOver={(e) => handleDragOverPlayer(e as unknown as React.DragEvent, player.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDropOnPlayer(e as unknown as React.DragEvent, player.id)}
                  onDragEnd={handleDragEnd}
                  initial={false}
                  animate={{ 
                    left: `${player.x}%`, 
                    top: `${player.y}%`,
                    scale: draggingPlayer === player.id ? 1.1 : dragOverTarget === player.id ? 1.15 : selectedPlayerId === player.id ? 1.05 : 1,
                    opacity: draggingPlayer === player.id ? 0.7 : 1,
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  onClick={() => setSelectedPlayerId(player.id)}
                  className={cn(
                    "absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-grab active:cursor-grabbing group z-10",
                    selectedPlayerId === player.id && "z-20",
                    dragOverTarget === player.id && "ring-2 ring-[#00ffc8] ring-offset-2 ring-offset-transparent rounded-full"
                  )}
                >
                  {/* Player name tag */}
                  <div className={cn(
                    "px-1.5 md:px-2 py-0.5 rounded text-[8px] md:text-[9px] font-semibold mb-1 whitespace-nowrap transition-all",
                    selectedPlayerId === player.id
                      ? "bg-[#00ffc8] text-black"
                      : "bg-black/60 text-white/90 group-hover:bg-black/80"
                  )}>
                    {player.name.split(" ").pop()}
                  </div>
                  
                  {/* Player avatar */}
                  <div className="relative">
                    {/* Sombra de chao: da a profundidade "acima da grama" da direcao aprovada. */}
                    <span
                      className="pointer-events-none absolute left-1/2 -bottom-1 h-2 w-8 -translate-x-1/2 rounded-[50%]"
                      style={{ background: "rgba(0,0,0,0.45)", filter: "blur(3px)" }}
                    />
                    <PlayerAvatarCircle
                      name={player.name}
                      teamColor={userTeam.cor1}
                      size="sm"
                      className={cn(
                        "relative border-2 shadow-[0_3px_8px_rgba(0,0,0,0.55)] transition-all",
                        selectedPlayerId === player.id
                          ? "border-[#00ffc8] shadow-[0_0_12px_rgba(0,255,200,0.5)]"
                          : "border-white/30 group-hover:border-white/60"
                      )}
                    />
                    
                    {/* Overall badge */}
                    <div className={cn(
                      "absolute -bottom-1 -right-1 h-5 w-5 md:h-6 md:w-6 rounded-full flex items-center justify-center text-[9px] md:text-[10px] font-black",
                      "bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border",
                      selectedPlayerId === player.id ? "border-[#00ffc8]" : "border-white/30"
                    )}>
                      <span className={getOverallColor(player.overall)}>{player.overall}</span>
                    </div>
                    
                    {/* Potential indicator */}
                    {player.potential > player.overall + 3 && (
                      <div className="absolute -top-1 -left-1 h-3 w-3 md:h-4 md:w-4 rounded-full bg-[#00ffc8] flex items-center justify-center">
                        <TrendingUp className="h-2 w-2 md:h-2.5 md:w-2.5 text-black" />
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
              
              {/* Tactical instruction overlay */}
              <button 
                onClick={() => setBallInstruction(prev => prev === "sem_bola" ? "com_bola" : "sem_bola")}
                className="absolute bottom-2 md:bottom-4 left-2 md:left-4 flex items-center gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white/70 text-[10px] md:text-xs transition-colors border border-white/10"
              >
                <span>{ballInstruction === "sem_bola" ? "Sem a bola" : "Com a bola"}</span>
                <span className="text-white/40">|</span>
                <span className="text-[#00ffc8]">Trocar instrucao</span>
                <ChevronRight className="h-3 w-3 text-[#00ffc8]" />
              </button>
            </div>
            
            {/* Reserves section - Melhorado com scroll vertical */}
            <div className="mt-2 p-3 rounded-xl bg-[#111111] border border-white/[0.04] flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-white/80 uppercase tracking-wider">{t.squad.reserves} ({bench.length})</h3>
                <span className="text-[10px] text-white/40">{t.squad.dragToSubstitute}</span>
              </div>
              
              {/* Container com altura maxima e scroll vertical */}
              <div className="max-h-[280px] overflow-y-auto scrollbar-game pr-1">
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-2">
                  {bench.map((player) => {
                    const posColors = positionColors[player.position] || positionColors.MEI
                    return (
                      <motion.div
                        key={player.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, player.id)}
                        onDragOver={(e) => handleDragOverPlayer(e as unknown as React.DragEvent, player.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDropOnPlayer(e as unknown as React.DragEvent, player.id)}
                        onDragEnd={handleDragEnd}
                        animate={{
                          scale: draggingPlayer === player.id ? 1.05 : dragOverTarget === player.id ? 1.1 : 1,
                          opacity: draggingPlayer === player.id ? 0.7 : 1,
                        }}
                        onClick={() => setSelectedPlayerId(player.id)}
                        className={cn(
                          "flex flex-col items-center p-2 rounded-lg cursor-grab active:cursor-grabbing transition-all",
                          selectedPlayerId === player.id
                            ? "bg-[#00ffc8]/15 ring-1 ring-[#00ffc8]/40"
                            : "bg-white/[0.03] hover:bg-white/[0.06]",
                          dragOverTarget === player.id && "ring-2 ring-[#00ffc8]"
                        )}
                      >
                        <div className="relative mb-1">
                          <PlayerAvatarCircle
                            name={player.name}
                            teamColor={userTeam.cor1}
                            size="xs"
                            className={cn(
                              "border-2 transition-colors",
                              selectedPlayerId === player.id ? "border-[#00ffc8]/60" : "border-white/10"
                            )}
                          />
                          <div className={cn(
                            "absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-black",
                            "bg-[#1a1a1a] border",
                            selectedPlayerId === player.id ? "border-[#00ffc8]/50" : "border-white/20"
                          )}>
                            <span className={getOverallColor(player.overall)}>{player.overall}</span>
                          </div>
                        </div>
                        <span className="text-[9px] text-white/80 font-medium truncate w-full text-center">{player.name.split(" ").pop()}</span>
                        <span className={cn("text-[8px] font-semibold mt-0.5 px-1 py-px rounded", posColors.bg, posColors.text)}>{player.position}</span>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            </div>
            </>
            )}

            {/* Tab Content: Taticas */}
            {activeTab === "taticas" && (
              <div className="flex-1 rounded-xl md:rounded-2xl bg-[#111111] border border-white/10 overflow-auto p-4 md:p-6">
                <div className="max-w-4xl mx-auto space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-white mb-2">{t.squad.tacticalInstructions}</h2>
                    <p className="text-sm text-white/50">{t.squad.tacticalInstructionsDesc}</p>
                    {/* A tatica é salva automaticamente a cada mudança — nao ha botao "gravar"
                        (foi relatado como confuso). Este selo deixa isso claro. */}
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#00ffc8]/10 px-3 py-1 text-[11px] font-medium text-[#00ffc8]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#00ffc8]" /> Alterações salvas automaticamente
                    </div>
                  </div>

                  {/* Defensive Style */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-blue-400" />
                      {t.squad.defensiveStyle}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-white/60 block mb-2">{t.squad.defensiveLine}</label>
                        <div className="flex gap-2">
                          {[t.squad.low, t.squad.medium, t.squad.high].map((opt, i) => (
                            <button key={opt} onClick={() => setLinhaDefensiva(i)} className={cn(
                              "flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                              linhaDefensiva === i ? "bg-[#00ffc8] text-black" : "bg-white/5 text-white/60 hover:bg-white/10"
                            )}>{opt}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-white/60 block mb-2">{t.squad.marking}</label>
                        <div className="flex gap-2">
                          {[t.squad.pressure, t.squad.balanced, t.squad.withdrawn].map((opt, i) => (
                            <button key={opt} onClick={() => setMarcacao(i)} className={cn(
                              "flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                              marcacao === i ? "bg-[#00ffc8] text-black" : "bg-white/5 text-white/60 hover:bg-white/10"
                            )}>{opt}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Offensive Style */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                      <Target className="h-4 w-4 text-red-400" />
                      {t.squad.offensiveStyle}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-white/60 block mb-2">{t.squad.buildStyle}</label>
                        <div className="flex gap-2">
                          {[t.squad.short, t.squad.mixed, t.squad.direct].map((opt, i) => (
                            <button key={opt} onClick={() => setConstrucao(i)} className={cn(
                              "flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                              construcao === i ? "bg-[#00ffc8] text-black" : "bg-white/5 text-white/60 hover:bg-white/10"
                            )}>{opt}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-white/60 block mb-2">{t.squad.attackSpeed}</label>
                        <div className="flex gap-2">
                          {[t.squad.slow, t.squad.normal, t.squad.fast].map((opt, i) => (
                            <button key={opt} onClick={() => setVelocidadeAtaque(i)} className={cn(
                              "flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                              velocidadeAtaque === i ? "bg-[#00ffc8] text-black" : "bg-white/5 text-white/60 hover:bg-white/10"
                            )}>{opt}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Team Mentality */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-400" />
                      {t.squad.mentality}
                    </h3>
                    <div className="flex gap-2">
                      {[t.squad.ultraDefensive, t.squad.defensive, t.squad.balanced2, t.squad.offensive, t.squad.ultraOffensive].map((opt, i) => (
                        <button key={opt} onClick={() => setMentalidade(i)} className={cn(
                          "flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                          mentalidade === i ? "bg-[#00ffc8] text-black" : "bg-white/5 text-white/60 hover:bg-white/10"
                        )}>{opt}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab Content: Atribuicoes */}
            {activeTab === "atribuicoes" && (
              <div className="flex-1 rounded-xl md:rounded-2xl bg-[#111111] border border-white/10 overflow-auto p-4 md:p-6">
                <div className="max-w-4xl mx-auto space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-white mb-2">{t.squad.playerRoles}</h2>
                    <p className="text-sm text-white/50">{t.squad.playerRolesDesc}</p>
                  </div>

                  {/* Bolas paradas — cobradores REAIS do elenco, escolhiveis. */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="text-sm font-semibold text-white mb-4">{t.squad.setPieces}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {([
                        { key: "corner", label: t.squad.cornerKicker, pool: allPlayers.filter(p => p.position !== "GOL") },
                        { key: "freeKickLeft", label: "Falta (esquerda)", pool: allPlayers.filter(p => p.position !== "GOL") },
                        { key: "freeKickRight", label: "Falta (direita)", pool: allPlayers.filter(p => p.position !== "GOL") },
                        { key: "penalty", label: t.squad.penaltyKicker, pool: allPlayers.filter(p => p.position !== "GOL") },
                        { key: "captain", label: t.squad.captain, pool: allPlayers },
                      ] as const).map(({ key, label, pool }) => (
                        <div key={key} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-white/5">
                          <span className="text-xs text-white/70 shrink-0">{label}</span>
                          <select
                            value={setPieces[key]}
                            onChange={(e) => updateSetPiece(key, e.target.value)}
                            className="min-w-0 flex-1 max-w-[60%] truncate rounded-lg border border-white/10 bg-white/10 px-2 py-1 text-xs font-medium text-[#00ffc8] focus:border-[#00ffc8] focus:outline-none"
                          >
                            {pool.map(p => (
                              <option key={p.id} value={p.name} className="bg-[#111111] text-white">
                                {p.name} ({p.position})
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Funcoes individuais — agora com estado (o select nao fazia nada). */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="text-sm font-semibold text-white mb-4">{t.squad.individualRoles}</h3>
                    <div className="space-y-3">
                      {players.map(player => (
                        <div key={player.id} className="flex items-center gap-4 p-3 rounded-lg bg-white/5">
                          <PlayerAvatarCircle name={player.name} teamColor={userTeam.cor1} size="xs" />
                          <div className="flex-1 min-w-0">
                            <div className="truncate text-sm font-medium text-white">{player.name}</div>
                            <div className="text-[10px] text-white/40">{player.position}</div>
                          </div>
                          <select
                            value={playerRoles[player.id] ?? player.function}
                            onChange={(e) => updatePlayerRole(player.id, e.target.value)}
                            className="shrink-0 rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-xs text-white focus:border-[#00ffc8] focus:outline-none"
                          >
                            {Array.from(new Set([player.function, "Equilibrado", "Ofensivo", "Defensivo"])).map(opt => (
                              <option key={opt} value={opt} className="bg-[#111111]">{opt}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right panel - Player details (hidden on mobile, shown in drawer) */}
          <aside className="hidden lg:block w-72 xl:w-80 flex-shrink-0 border-l border-white/[0.04] bg-[#050508] overflow-y-auto">
            {/* Player header - Melhorado */}
            <div className="p-4 border-b border-white/[0.04]" style={{
              background: `linear-gradient(135deg, ${userTeam.cor1}20 0%, transparent 60%)`
            }}>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className={cn(
                    "w-16 h-16 rounded-xl flex items-center justify-center text-3xl font-black",
                    "bg-gradient-to-br from-white/10 to-white/5 border border-white/10"
                  )}>
                    <span className={getOverallColor(selectedPlayer.overall)}>{selectedPlayer.overall}</span>
                  </div>
                  <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md bg-[#1a1a1a] border border-white/10 text-[9px] font-bold text-white/70">
                    {selectedPlayer.position}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-white uppercase truncate">{selectedPlayer.name}</h2>
                  <p className="text-[11px] text-white/40 mt-0.5">
                    {selectedPlayer.position === "ATA" || selectedPlayer.position === "PD" || selectedPlayer.position === "PE" ? "Atacante" : selectedPlayer.position === "MEI" || selectedPlayer.position === "VOL" ? "Meio-campista" : selectedPlayer.position === "ZAG" || selectedPlayer.position === "LD" || selectedPlayer.position === "LE" ? "Defensor" : "Goleiro"}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Player info - Melhorado */}
            <div className="p-4 space-y-4">
              {/* Energia com barra maior */}
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-white/50 font-medium">{t.squad.energy}</span>
                  <span className="text-sm font-bold text-[#00ffc8]">{selectedPlayer.energy}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-[#00ffc8] to-[#00c8ff] rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${selectedPlayer.energy}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              {/* Informacoes do atleta - Grid melhorado */}
              <div>
                <h3 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-3">
                  Informacoes do Atleta
                </h3>

                <label className="mb-3 flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] p-2 text-[10px] text-white/55">
                  Número da camisa
                  <select
                    value={engineSquadPlayers.find(player => player.id === selectedPlayer.id)?.shirtNumber ?? ""}
                    onChange={(event) => {
                      const number = Number(event.target.value)
                      if (number && !engineSetPlayerShirtNumber(selectedPlayer.id, number)) {
                        addNotification({ type: "system", title: "Número indisponível", message: `A camisa ${number} já está em uso no elenco.`, priority: "high" })
                      }
                    }}
                    className="rounded border border-white/10 bg-black/50 px-2 py-1 text-xs font-bold text-[#00ffc8]"
                    aria-label={`Número da camisa de ${selectedPlayer.name}`}
                  >
                    <option value="">Automático</option>
                    {Array.from({ length: 99 }, (_, index) => index + 1).map(number => <option key={number} value={number}>{number}</option>)}
                  </select>
                </label>
                
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Ritmo", value: selectedPlayer.rhythm, isNum: true },
                    { label: "Idade", value: selectedPlayer.age, isNum: false },
                    { label: "Moral", value: selectedPlayer.moral, isMoral: true },
                    { label: "Finaliz.", value: selectedPlayer.shooting, isNum: true },
                    { label: "Perna", value: selectedPlayer.foot, isNum: false },
                    { label: "Passes", value: selectedPlayer.passing, isNum: true },
                    { label: "Aceleracao", value: selectedPlayer.acceleration, isNum: false },
                    { label: "Conducao", value: selectedPlayer.dribbling, isNum: true },
                    { label: "Funcao", value: selectedPlayer.function, isNum: false, truncate: true },
                    { label: "Defesa", value: selectedPlayer.defending, isNum: true },
                    { label: "Altura", value: `${selectedPlayer.height} cm`, isNum: false },
                    { label: "Fisico", value: selectedPlayer.physical, isNum: true },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02]">
                      <span className="text-[10px] text-white/40">{item.label}</span>
                      <span className={cn(
                        "text-[11px] font-medium",
                        item.isNum ? getStatColor(item.value as number) : 
                        item.isMoral ? getMoralColor(item.value as string) : "text-white/80",
                        item.truncate && "truncate max-w-[50px]"
                      )}>
                        {item.value}
                        {item.isMoral && item.value === "Feliz" && <Smile className="h-3 w-3 inline ml-1" />}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Playstyles - Melhorado */}
              <div className="pt-3 border-t border-white/[0.04]">
                <h3 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-3">
                  Estilos de Jogo
                </h3>
                
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-white/60">Fintas</span>
                    <div className="flex items-center gap-0.5">
                      {getStarRating(selectedPlayer.fintas)}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Actions - Melhorado */}
              <div className="pt-3 border-t border-white/[0.04]">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSubstitutionModal(true)}
                  className="w-full h-10 border-white/10 text-white/70 hover:text-white hover:bg-[#00ffc8]/10 hover:border-[#00ffc8]/30 text-xs mb-2"
                >
                  <ArrowLeftRight className="h-4 w-4 mr-2" />
                  Substituir
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPlayerProfile(true)}
                  className="w-full h-9 text-white/50 hover:text-white hover:bg-white/5 text-xs"
                >
                  <Info className="h-3.5 w-3.5 mr-2" />
                  Ver Perfil Completo
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </main>
      
      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 h-12 md:h-14 bg-[#0d0d0d] border-t border-white/10 flex items-center justify-between px-2 md:px-6">
        <div className="flex items-center gap-1 md:gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setCurrentView("menu")}
            className="text-white/60 hover:text-white text-[10px] md:text-sm px-2 md:px-3"
          >
            <ChevronLeft className="h-3 w-3 md:h-4 md:w-4 mr-0.5 md:mr-1" />
            <span className="hidden sm:inline">{t.common.back}</span>
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setCurrentView("visao_tatica")}
            className="text-white/60 hover:text-white text-[10px] md:text-sm px-2 md:px-3"
          >
            <RotateCcw className="h-3 w-3 md:h-4 md:w-4 mr-0.5 md:mr-1" />
            <span className="hidden md:inline">Editar tatica ativa</span>
          </Button>
        </div>
        
        <div className="flex items-center gap-1 md:gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowSuggestedSubs(true)}
            aria-label="Substituicoes sugeridas"
            title="Substituicoes sugeridas"
            className="bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white text-[10px] md:text-sm px-2 md:px-3"
          >
            <Shuffle className="h-3 w-3 md:h-4 md:w-4 mr-0.5 md:mr-1" />
            <span className="inline max-w-[76px] truncate sm:max-w-none">Substituicoes sugeridas</span>
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowSubstitutionModal(true)}
            className="text-white/60 hover:text-white text-[10px] md:text-sm px-2 md:px-3 hidden sm:flex"
          >
            <ArrowLeftRight className="h-3 w-3 md:h-4 md:w-4 mr-0.5 md:mr-1" />
            <span>Substituicoes rapidas</span>
          </Button>
          <div className="w-px h-4 md:h-6 bg-white/10 hidden md:block" />
          <Button variant="ghost" size="sm" className="text-white/60 hover:text-white text-[10px] md:text-sm px-2 md:px-3 hidden md:flex">
            Rolagem
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowTutorials(true)}
            className="text-white/60 hover:text-white text-[10px] md:text-sm px-2 md:px-3"
          >
            <Info className="h-3 w-3 md:h-4 md:w-4 sm:mr-1" />
            <span className="hidden sm:inline">{t.squad.tutorials}</span>
          </Button>
        </div>
      </div>
      
      {/* Substitution Modal */}
      <AnimatePresence>
        {showSubstitutionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowSubstitutionModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-6 max-w-lg w-full"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Substituir Jogador</h2>
                <button onClick={() => setShowSubstitutionModal(false)} className="p-2 rounded-lg hover:bg-white/10">
                  <X className="h-5 w-5 text-white/60" />
                </button>
              </div>
              <p className="text-sm text-white/60 mb-4">
                Arraste jogadores entre o campo e os reservas para fazer substituicoes, ou selecione um jogador abaixo:
              </p>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {bench.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => {
                      // Swap selected player with this bench player
                      const selectedInField = players.find(p => p.id === selectedPlayerId)
                      if (selectedInField) {
                        setPlayers(prev => prev.map(p => p.id === selectedPlayerId ? player : p))
                        setBench(prev => prev.map(p => p.id === player.id ? selectedInField : p))
                        setShowSubstitutionModal(false)
                      }
                    }}
                    className="flex items-center gap-2 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-left"
                  >
                    <PlayerAvatarCircle name={player.name} teamColor={userTeam.cor1} size="xs" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white truncate">{player.name}</div>
                      <div className="text-[10px] text-white/40">{player.position}</div>
                    </div>
                    <span className={cn("text-sm font-bold", getOverallColor(player.overall))}>{player.overall}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Player Profile Modal */}
      <AnimatePresence>
        {showPlayerProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowPlayerProfile(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-6 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Perfil do Jogador</h2>
                <button onClick={() => setShowPlayerProfile(false)} className="p-2 rounded-lg hover:bg-white/10">
                  <X className="h-5 w-5 text-white/60" />
                </button>
              </div>
              <div className="flex items-center gap-4 mb-6">
                <PlayerAvatarCircle name={selectedPlayer.name} teamColor={userTeam.cor1} size="lg" />
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedPlayer.name}</h3>
                  <p className="text-sm text-white/50">{selectedPlayer.position} - {selectedPlayer.age} anos</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn("text-2xl font-black", getOverallColor(selectedPlayer.overall))}>{selectedPlayer.overall}</span>
                    <span className="text-xs text-white/40">OVR</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Ritmo", value: selectedPlayer.pace },
                  { label: "Finaliz.", value: selectedPlayer.shooting },
                  { label: "Passe", value: selectedPlayer.passing },
                  { label: "Drible", value: selectedPlayer.dribbling },
                  { label: "Defesa", value: selectedPlayer.defending },
                  { label: "Fisico", value: selectedPlayer.physical },
                ].map(stat => (
                  <div key={stat.label} className="p-3 rounded-lg bg-white/5 text-center">
                    <div className={cn("text-lg font-bold", getStatColor(stat.value))}>{stat.value}</div>
                    <div className="text-[10px] text-white/40">{stat.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Tutorials Modal */}
      <AnimatePresence>
        {showTutorials && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowTutorials(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-6 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">{t.squad.tutorials}</h2>
                <button onClick={() => setShowTutorials(false)} className="p-2 rounded-lg hover:bg-white/10">
                  <X className="h-5 w-5 text-white/60" />
                </button>
              </div>
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-white/5">
                  <h3 className="text-sm font-medium text-white mb-1">Arrastar jogadores</h3>
                  <p className="text-xs text-white/50">Arraste jogadores no campo para reposiciona-los ou troca-los com reservas.</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5">
                  <h3 className="text-sm font-medium text-white mb-1">Trocar formacao</h3>
                  <p className="text-xs text-white/50">Escolha a formacao no menu suspenso (ou use as setas ao lado) para alterar entre os esquemas taticos.</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5">
                  <h3 className="text-sm font-medium text-white mb-1">Ver detalhes</h3>
                  <p className="text-xs text-white/50">Clique em um jogador para ver seus atributos no painel lateral.</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Suggested Substitutions Modal */}
      <AnimatePresence>
        {showSuggestedSubs && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowSuggestedSubs(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-6 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Substituicoes Sugeridas</h2>
                <button onClick={() => setShowSuggestedSubs(false)} className="p-2 rounded-lg hover:bg-white/10">
                  <X className="h-5 w-5 text-white/60" />
                </button>
              </div>
              <div className="space-y-3">
                {players.filter(p => p.energy < 80).slice(0, 3).map(tiredPlayer => {
                  const replacement = bench.find(b => b.position === tiredPlayer.position) || bench[0]
                  return (
                    <button
                      key={tiredPlayer.id}
                      onClick={() => {
                        setPlayers(prev => prev.map(p => p.id === tiredPlayer.id ? replacement : p))
                        setBench(prev => prev.map(p => p.id === replacement.id ? tiredPlayer : p))
                        setShowSuggestedSubs(false)
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <PlayerAvatarCircle name={tiredPlayer.name} teamColor={userTeam.cor1} size="xs" />
                        <div className="text-left">
                          <div className="text-xs text-white">{tiredPlayer.name}</div>
                          <div className="text-[10px] text-red-400">{tiredPlayer.energy}% energia</div>
                        </div>
                      </div>
                      <ArrowLeftRight className="h-4 w-4 text-white/40" />
                      <div className="flex items-center gap-2">
                        <PlayerAvatarCircle name={replacement.name} teamColor={userTeam.cor1} size="xs" />
                        <div className="text-left">
                          <div className="text-xs text-white">{replacement.name}</div>
                          <div className="text-[10px] text-green-400">{replacement.energy}% energia</div>
                        </div>
                      </div>
                    </button>
                  )
                })}
                {players.filter(p => p.energy < 80).length === 0 && (
                  <p className="text-sm text-white/50 text-center py-4">
                    Nenhuma substituicao sugerida no momento. Todos os jogadores estao com energia adequada.
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

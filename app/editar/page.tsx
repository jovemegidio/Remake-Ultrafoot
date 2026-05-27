"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import {
  Search,
  ArrowLeft,
  ChevronUp,
  ChevronDown,
  MapPin,
  Plus,
  Shuffle,
  Pencil,
  Trash2,
  Users,
  Shield,
  X,
  Check,
  RotateCcw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  serieATeams,
  serieBTeams,
  serieCTeams,
  serieDTeams,
  getCamisaUrl,
  type Team,
} from "@/lib/teams-data"
import { allInternationalTeams } from "@/lib/international-teams"
import { getExtraTeams, isNationalTeam } from "@/lib/extra-teams"
import { getPlayersForTeam, sortByPosition, type Player } from "@/lib/players-data"
import { TeamCrest } from "@/components/team-crest"

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface EditorPlayer {
  id: number
  nome: string
  pos: string
  idade: number
  base: number
}

type ModalMode = "add" | "edit" | null

const POSITIONS = ["GOL", "ZAG", "LD", "LE", "VOL", "MEI", "ATA"]

const BLANK_PLAYER: Omit<EditorPlayer, "id"> = { nome: "", pos: "MEI", idade: 22, base: 65 }

// ─── Persistência ─────────────────────────────────────────────────────────────

const EDITOR_KEY = "ultrafoot-editor-overrides"

function loadOverrides(): Record<string, EditorPlayer[]> {
  if (typeof window === "undefined") return {}
  try { return JSON.parse(localStorage.getItem(EDITOR_KEY) || "{}") }
  catch { return {} }
}

function saveOverrides(overrides: Record<string, EditorPlayer[]>) {
  if (typeof window === "undefined") return
  localStorage.setItem(EDITOR_KEY, JSON.stringify(overrides))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DIVISION_COUNTRY: Record<string, string> = {
  serie_a: "BRA", serie_b: "BRA", serie_c: "BRA", serie_d: "BRA",
  premier_league: "ENG", la_liga: "ESP", serie_a_ita: "ITA",
  bundesliga: "GER", ligue_1: "FRA", saudi_pro: "KSA",
  mls: "USA", liga_mx: "MEX", primeira_liga: "POR",
  j_league: "JPN", paulistao: "BRA", carioca: "BRA",
  mineiro: "BRA", gaucho: "BRA",
}

function teamCountry(team: Team): string {
  return team.pais ?? DIVISION_COUNTRY[team.divisao] ?? "BRA"
}

function seedToEditor(players: Player[]): EditorPlayer[] {
  return players.map((p, i) => ({
    id: i + 1,
    nome: p.nome,
    pos: p.pos,
    idade: p.idade,
    base: p.base,
  }))
}

function nextId(players: EditorPlayer[]): number {
  return players.length === 0 ? 1 : Math.max(...players.map(p => p.id)) + 1
}

const hardcodedTeams = [...serieATeams, ...serieBTeams, ...serieCTeams, ...serieDTeams, ...allInternationalTeams]
  .filter(t => !isNationalTeam(t))
const hardcodedNames = new Set(hardcodedTeams.map(t => t.nome))
const allTeams = [...hardcodedTeams, ...getExtraTeams(hardcodedNames)]

// ─── Componente Principal ────────────────────────────────────────────────────

export default function EditarPage() {
  const router = useRouter()

  const [selectedTeam, setSelectedTeam] = useState<Team | null>(allTeams[0])
  const [searchTeam, setSearchTeam] = useState("")
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<"principal" | "juniores">("principal")
  const [sortColumn, setSortColumn] = useState<keyof EditorPlayer | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  // Overrides persistidos: { [teamNome]: EditorPlayer[] }
  const [overrides, setOverrides] = useState<Record<string, EditorPlayer[]>>({})

  // Modal add/edit
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [modalForm, setModalForm] = useState<Omit<EditorPlayer, "id">>(BLANK_PLAYER)

  // Confirmação de remoção
  const [confirmRemove, setConfirmRemove] = useState(false)

  // Erros de carregamento das camisas por "fileKey-variant"
  const [kitErrors, setKitErrors] = useState<Set<string>>(new Set())

  // Reset kit errors when team changes
  useEffect(() => { setKitErrors(new Set()) }, [selectedTeam?.file_key])

  // Carrega overrides do localStorage na montagem
  useEffect(() => { setOverrides(loadOverrides()) }, [])

  // Gamepad B = voltar
  useEffect(() => {
    const handler = (e: Event) => {
      const btn = (e as CustomEvent).detail?.button
      if (btn === "B") { if (modalMode) setModalMode(null); else router.back() }
    }
    window.addEventListener("gamepad:button", handler)
    return () => window.removeEventListener("gamepad:button", handler)
  }, [router, modalMode])

  // ESC fecha modal ou volta
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (modalMode) setModalMode(null); else router.back() }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [router, modalMode])

  // Jogadores do time selecionado (override > seed)
  const players: EditorPlayer[] = useMemo(() => {
    if (!selectedTeam) return []
    if (overrides[selectedTeam.nome]) return overrides[selectedTeam.nome]
    const seed = sortByPosition(getPlayersForTeam(selectedTeam))
    return seedToEditor(seed)
  }, [selectedTeam, overrides])

  // Auto-seleciona o primeiro jogador quando o time muda (melhora UX — botões Editar/Remover ficam ativos)
  useEffect(() => {
    if (players.length > 0 && selectedPlayerId === null) {
      setSelectedPlayerId(players[0].id)
    }
  }, [players, selectedPlayerId])

  // Persiste overrides toda vez que mudam
  const persistOverrides = useCallback((next: Record<string, EditorPlayer[]>) => {
    setOverrides(next)
    saveOverrides(next)
  }, [])

  // Atualiza lista do time atual e persiste
  const setTeamPlayers = useCallback((teamNome: string, list: EditorPlayer[]) => {
    setOverrides(prev => {
      const next = { ...prev, [teamNome]: list }
      saveOverrides(next)
      return next
    })
  }, [])

  // Filtra times pelo search
  const filteredTeams = useMemo(() => {
    if (!searchTeam) return allTeams
    const q = searchTeam.toLowerCase()
    return allTeams.filter(t =>
      t.nome.toLowerCase().includes(q) || t.curto.toLowerCase().includes(q)
    )
  }, [searchTeam])

  // Filtra por aba
  const tabPlayers = useMemo(() => {
    if (activeTab === "juniores") return players.filter(p => p.idade <= 22)
    return players
  }, [players, activeTab])

  // Ordena
  const sortedPlayers = useMemo(() => {
    if (!sortColumn) return tabPlayers
    return [...tabPlayers].sort((a, b) => {
      const av = a[sortColumn]
      const bv = b[sortColumn]
      if (typeof av === "number" && typeof bv === "number")
        return sortDirection === "asc" ? av - bv : bv - av
      return sortDirection === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })
  }, [tabPlayers, sortColumn, sortDirection])

  const selectedPlayer = players.find(p => p.id === selectedPlayerId) ?? null

  const handleSort = (col: keyof EditorPlayer) => {
    if (sortColumn === col) setSortDirection(d => d === "asc" ? "desc" : "asc")
    else { setSortColumn(col); setSortDirection("asc") }
  }

  // Seleciona time → reseta seleção de jogador e aba
  const handleSelectTeam = (team: Team) => {
    setSelectedTeam(team)
    setSelectedPlayerId(null)
    setActiveTab("principal")
    setModalMode(null)
    setConfirmRemove(false)
  }

  // ─── Ações dos botões ────────────────────────────────────────────────────

  const handleAdd = () => {
    setModalForm(BLANK_PLAYER)
    setModalMode("add")
    setConfirmRemove(false)
  }

  const handleEdit = () => {
    if (!selectedPlayer) return
    setModalForm({ nome: selectedPlayer.nome, pos: selectedPlayer.pos, idade: selectedPlayer.idade, base: selectedPlayer.base })
    setModalMode("edit")
    setConfirmRemove(false)
  }

  const handleRemove = () => {
    if (!selectedPlayer || !selectedTeam) return
    if (!confirmRemove) { setConfirmRemove(true); return }
    const next = players.filter(p => p.id !== selectedPlayer.id)
    setTeamPlayers(selectedTeam.nome, next)
    setSelectedPlayerId(null)
    setConfirmRemove(false)
  }

  const handleAleatorio = () => {
    if (!selectedPlayer || !selectedTeam) return
    const newBase = 50 + Math.floor(Math.random() * 45)
    const newIdade = 17 + Math.floor(Math.random() * 22)
    const next = players.map(p =>
      p.id === selectedPlayer.id ? { ...p, base: newBase, idade: newIdade } : p
    )
    setTeamPlayers(selectedTeam.nome, next)
    setConfirmRemove(false)
  }

  const handleResetTeam = () => {
    if (!selectedTeam) return
    setOverrides(prev => {
      const next = { ...prev }
      delete next[selectedTeam.nome]
      saveOverrides(next)
      return next
    })
    setSelectedPlayerId(null)
  }

  const handleModalSave = () => {
    if (!selectedTeam || !modalForm.nome.trim()) return
    if (modalMode === "add") {
      const newPlayer: EditorPlayer = { id: nextId(players), ...modalForm, nome: modalForm.nome.trim() }
      setTeamPlayers(selectedTeam.nome, [...players, newPlayer])
      setSelectedPlayerId(newPlayer.id)
    } else if (modalMode === "edit" && selectedPlayer) {
      const next = players.map(p =>
        p.id === selectedPlayer.id ? { ...p, ...modalForm, nome: modalForm.nome.trim() } : p
      )
      setTeamPlayers(selectedTeam.nome, next)
    }
    setModalMode(null)
  }

  // ─── Cores ────────────────────────────────────────────────────────────────

  const posColor = (pos: string) => ({
    GOL: "text-amber-400", ZAG: "text-blue-400", LD: "text-cyan-400",
    LE: "text-sky-400", VOL: "text-emerald-400", MEI: "text-green-400",
    ATA: "text-rose-400",
  }[pos] ?? "text-white/60")

  const posColorBg = (pos: string) => ({
    GOL: "bg-amber-400", ZAG: "bg-blue-400", LD: "bg-cyan-400",
    LE: "bg-sky-400", VOL: "bg-emerald-400", MEI: "bg-green-400",
    ATA: "bg-rose-400",
  }[pos] ?? "bg-white/60")

  const ovrColor = (v: number) =>
    v >= 80 ? "text-emerald-400" : v >= 70 ? "text-green-400" : v >= 60 ? "text-yellow-400" : "text-white/50"

  const hasOverride = selectedTeam ? !!overrides[selectedTeam.nome] : false

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0a0a0a]">

      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-150 h-150 rounded-full opacity-3"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.5) 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 right-1/4 w-125 h-125 rounded-full opacity-3"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.5) 0%, transparent 70%)" }} />
      </div>

      {/* Header */}
      <header className="relative z-10 h-12 lg:h-14 shrink-0 bg-black/60 backdrop-blur-xl border-b border-white/6 px-3 lg:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3 lg:gap-6">
          <button onClick={() => router.back()}
            className="flex items-center gap-2 px-3 lg:px-4 py-1.5 lg:py-2 bg-white/4 hover:bg-white/8 text-white/70 hover:text-white rounded-lg transition-all duration-300 text-xs lg:text-sm font-medium border border-white/6">
            <ArrowLeft className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
            <span className="hidden sm:inline">Voltar</span>
          </button>
          <div className="flex items-center gap-3 lg:gap-4">
            <Image src="/brand/uf26-logo.png" alt="UF26" width={100} height={40} className="object-contain h-6 lg:h-7 w-auto" priority />
            <div className="hidden md:flex items-center gap-3">
              <div className="h-5 w-px bg-white/10" />
              <div className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-white/40" />
                <h1 className="text-xs lg:text-sm font-semibold text-white/80 tracking-wide">Editor de Clubes</h1>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/30">
          <kbd className="px-2 py-1 bg-white/5 rounded border border-white/10 font-mono text-[10px] lg:text-xs">ESC</kbd>
          <span className="hidden sm:inline">para voltar</span>
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex overflow-hidden relative z-10">

        {/* Painel Esquerdo — Lista de Times */}
        <aside className="w-64 md:w-72 lg:w-80 xl:w-88 2xl:w-96 shrink-0 flex flex-col bg-black/40 backdrop-blur-sm border-r border-white/6">
          <div className="p-4 border-b border-white/[0.06]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <input type="text" value={searchTeam} onChange={e => setSearchTeam(e.target.value)}
                placeholder="Procurar time..."
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white/[0.03] border border-white/[0.08] rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-white/20 transition-all duration-300" />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_50px_50px] bg-white/[0.02] text-white/50 text-xs font-medium border-b border-white/[0.06]">
            <div className="px-4 py-2.5">Time</div>
            <div className="px-2 py-2.5 text-center">País</div>
            <div className="px-2 py-2.5 text-center">OVR</div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-editor">
            {filteredTeams.map(team => {
              const isSelected = selectedTeam?.curto === team.curto && selectedTeam?.divisao === team.divisao
              const edited = !!overrides[team.nome]
              return (
                <button key={`${team.curto}-${team.divisao}`} onClick={() => handleSelectTeam(team)}
                  className={cn(
                    "w-full grid grid-cols-[1fr_50px_50px] text-sm border-b border-white/[0.04] transition-all duration-200",
                    isSelected
                      ? "bg-gradient-to-r from-violet-500/20 via-purple-500/15 to-transparent border-l-2 border-l-violet-400"
                      : "hover:bg-white/[0.03]"
                  )}>
                  <div className="px-4 py-2.5 text-left truncate flex items-center gap-2.5">
                    <TeamCrest team={team} size="xs" />
                    <span className={cn("truncate transition-colors", isSelected ? "text-white font-medium" : "text-white/70")}>
                      {team.nome}
                    </span>
                    {edited && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" title="Editado" />}
                  </div>
                  <div className="px-2 py-2.5 flex items-center justify-center text-[10px] text-white/40">
                    {teamCountry(team)}
                  </div>
                  <div className={cn("px-2 py-2.5 text-center font-bold text-sm", ovrColor(team.prestigio))}>
                    {team.prestigio}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="px-4 py-2.5 text-xs text-white/30 bg-black/40 border-t border-white/[0.06] flex items-center gap-2">
            <Users className="h-3.5 w-3.5" />
            <span>{filteredTeams.length} times</span>
          </div>
        </aside>

        {/* Painel Direito — Detalhes do Time */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {selectedTeam && (
            <>
              {/* Header do Time */}
              <div className="shrink-0 bg-gradient-to-r from-[#1a1a2e] via-[#16162b] to-[#1a1a2e] border-b border-white/[0.06]">
                <div className="px-6 py-4 flex items-center gap-6">
                  <div className="shrink-0 w-16 h-16 flex items-center justify-center rounded-xl overflow-hidden">
                    <TeamCrest team={selectedTeam} size="md" className="rounded-xl" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold text-white truncate">{selectedTeam.nome}</h2>
                      <span className="px-2 py-0.5 text-[10px] font-medium bg-white/10 text-white/50 rounded-full uppercase tracking-wider">
                        {selectedTeam.divisao}
                      </span>
                      {hasOverride && (
                        <span className="px-2 py-0.5 text-[10px] font-medium bg-violet-500/20 text-violet-400 rounded-full">
                          editado
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-sm text-white/50">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{selectedTeam.cidade ?? selectedTeam.estado}</span>
                      </div>
                      <div className="h-3 w-px bg-white/10" />
                      <span>{selectedTeam.estadio_nome}</span>
                    </div>
                  </div>
                  <div className="hidden lg:flex items-center gap-2">
                    {(["home", "away", "third"] as const).map(v => {
                      const errKey = `${selectedTeam.file_key}-${v}`
                      const hasError = kitErrors.has(errKey)
                      return (
                        <div key={v} className="flex flex-col items-center gap-1">
                          <div className="w-12 h-14 bg-white/[0.05] rounded-lg flex items-center justify-center p-1.5 border border-white/[0.06] overflow-hidden">
                            {hasError ? (
                              <svg viewBox="0 0 40 50" width={32} height={40} className="opacity-40">
                                <path d="M20 2 L4 10 L4 20 C4 35 12 44 20 48 C28 44 36 35 36 20 L36 10 Z"
                                  fill={selectedTeam.cor1} stroke={selectedTeam.cor2} strokeWidth="2" />
                              </svg>
                            ) : (
                              <Image
                                src={getCamisaUrl(selectedTeam.file_key, v)}
                                alt={v}
                                width={40}
                                height={50}
                                className="object-contain h-auto w-auto"
                                onError={() => setKitErrors(prev => new Set([...prev, errKey]))}
                                unoptimized
                              />
                            )}
                          </div>
                          <span className="text-[9px] text-white/30 uppercase">{v}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="shrink-0 text-center">
                    <div className="text-4xl font-black text-white tracking-tight">{selectedTeam.prestigio}</div>
                    <div className="text-[10px] text-white/40 font-medium tracking-widest mt-0.5">OVERALL</div>
                  </div>
                  <div className="shrink-0 flex gap-1.5">
                    {(["principal", "juniores"] as const).map(tab => (
                      <button key={tab} onClick={() => setActiveTab(tab)}
                        className={cn(
                          "px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-300 capitalize",
                          activeTab === tab
                            ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20"
                            : "bg-white/[0.05] text-white/50 hover:bg-white/[0.1] hover:text-white/80"
                        )}>
                        {tab}
                        {tab === "juniores" && (
                          <span className="ml-1.5 text-[10px] opacity-70">
                            ({players.filter(p => p.idade <= 22).length})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tabela de Jogadores */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="shrink-0 grid grid-cols-[1fr_60px_52px_62px_58px] bg-white/[0.02] text-white/40 text-[11px] font-medium border-b border-white/[0.06]">
                  {([
                    ["nome", "Nome", "px-4 text-left"],
                    ["pos", "Pos", "px-2 text-center"],
                    [null, "País", "px-2 text-center"],
                    ["idade", "Idade", "px-2 text-center"],
                    ["base", "OVR", "px-2 text-center"],
                  ] as [keyof EditorPlayer | null, string, string][]).map(([col, label, align]) => (
                    <button key={label} onClick={() => col && handleSort(col)}
                      className={cn(
                        align, "py-2.5 uppercase tracking-wider transition-colors",
                        col ? "hover:bg-white/[0.02] cursor-pointer" : "cursor-default"
                      )}>
                      <span className={cn("flex items-center gap-1", align.includes("center") && "justify-center")}>
                        {label}
                        {col && sortColumn === col && (
                          sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                        )}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-amber">
                  {sortedPlayers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-white/30 gap-2">
                      <Users className="h-10 w-10 opacity-30" />
                      <span className="text-sm">
                        {activeTab === "juniores" ? "Nenhum jogador sub-23 neste time." : "Nenhum jogador encontrado."}
                      </span>
                    </div>
                  ) : (
                    sortedPlayers.map(player => (
                      <button key={player.id} onClick={() => { setSelectedPlayerId(player.id); setConfirmRemove(false) }}
                        className={cn(
                          "w-full grid grid-cols-[1fr_60px_52px_62px_58px] text-sm border-b border-white/[0.04] transition-all duration-200",
                          selectedPlayerId === player.id
                            ? "bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-transparent border-l-2 border-l-amber-400"
                            : "hover:bg-white/[0.02]"
                        )}>
                        <div className={cn("px-4 py-2 text-left truncate font-medium",
                          selectedPlayerId === player.id ? "text-white" : "text-white/70")}>
                          {player.nome}
                        </div>
                        <div className={cn("px-2 py-2 text-center text-xs font-semibold", posColor(player.pos))}>
                          {player.pos}
                        </div>
                        <div className="px-2 py-2 text-center text-[10px] text-white/40">
                          {teamCountry(selectedTeam)}
                        </div>
                        <div className="px-2 py-2 text-center text-white/60">{player.idade}</div>
                        <div className={cn("px-2 py-2 text-center font-bold", ovrColor(player.base))}>
                          {player.base}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Barra de Ações */}
              <div className="shrink-0 h-14 flex items-center justify-between bg-black/60 backdrop-blur-sm border-t border-white/[0.06] px-6">
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-bold text-white">{tabPlayers.length}</span>
                  <span className="text-white/40">jogadores</span>
                  {hasOverride && (
                    <button onClick={handleResetTeam}
                      className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors ml-2">
                      <RotateCcw className="h-3 w-3" /> Restaurar original
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleAdd}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white rounded-lg transition-all duration-200 border border-white/[0.06]">
                    <Plus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Adicionar</span>
                  </button>
                  <button onClick={handleEdit} disabled={!selectedPlayer}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white rounded-lg transition-all duration-200 border border-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed">
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Editar</span>
                  </button>
                  <button onClick={handleAleatorio} disabled={!selectedPlayer}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white rounded-lg transition-all duration-200 border border-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed">
                    <Shuffle className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Aleatório</span>
                  </button>
                  <button onClick={handleRemove} disabled={!selectedPlayer}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all duration-200 border disabled:opacity-30 disabled:cursor-not-allowed",
                      confirmRemove
                        ? "bg-rose-500/30 text-rose-300 border-rose-500/50 animate-pulse"
                        : "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border-rose-500/20"
                    )}>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{confirmRemove ? "Confirmar?" : "Remover"}</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Modal Adicionar / Editar */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setModalMode(null) }}>
          <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-white">
                {modalMode === "add" ? "Adicionar Jogador" : "Editar Jogador"}
              </h3>
              <button onClick={() => setModalMode(null)} className="text-white/40 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-xs text-white/50 mb-1.5 uppercase tracking-wider">Nome</label>
                <input type="text" value={modalForm.nome}
                  onChange={e => setModalForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Nome do jogador"
                  className="w-full px-3 py-2.5 bg-white/[0.05] border border-white/10 rounded-lg text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/30 transition-colors" />
              </div>

              {/* Posição */}
              <div>
                <label className="block text-xs text-white/50 mb-1.5 uppercase tracking-wider">Posição</label>
                <div className="flex gap-1.5 flex-wrap">
                  {POSITIONS.map(pos => (
                    <button key={pos} onClick={() => setModalForm(f => ({ ...f, pos }))}
                      className={cn(
                        "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200",
                        modalForm.pos === pos
                          ? cn("text-black", posColorBg(pos))
                          : "bg-white/[0.05] text-white/50 hover:bg-white/[0.1]"
                      )}>
                      {pos}
                    </button>
                  ))}
                </div>
              </div>

              {/* Idade e OVR */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/50 mb-1.5 uppercase tracking-wider">Idade</label>
                  <input type="number" min={15} max={45} value={modalForm.idade}
                    onChange={e => setModalForm(f => ({ ...f, idade: Math.max(15, Math.min(45, Number(e.target.value))) }))}
                    className="w-full px-3 py-2.5 bg-white/[0.05] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/30 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1.5 uppercase tracking-wider">Overall</label>
                  <input type="number" min={40} max={99} value={modalForm.base}
                    onChange={e => setModalForm(f => ({ ...f, base: Math.max(40, Math.min(99, Number(e.target.value))) }))}
                    className="w-full px-3 py-2.5 bg-white/[0.05] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/30 transition-colors" />
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => setModalMode(null)}
                className="flex-1 py-2.5 text-sm text-white/50 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-all duration-200 border border-white/[0.06]">
                Cancelar
              </button>
              <button onClick={handleModalSave} disabled={!modalForm.nome.trim()}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90 rounded-lg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                <Check className="h-4 w-4" />
                {modalMode === "add" ? "Adicionar" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

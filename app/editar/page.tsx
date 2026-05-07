"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { 
  Search, 
  ArrowLeft,
  ChevronUp, 
  ChevronDown,
  Flag,
  Plus,
  Shuffle,
  Pencil,
  Trash2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { 
  serieATeams, 
  serieBTeams, 
  serieCTeams,
  serieDTeams,
  getCamisaUrl,
  type Team 
} from "@/lib/teams-data"
import { TeamCrest } from "@/components/team-crest"

// Mock players data generator based on team
const generatePlayersForTeam = (team: Team) => {
  const positions = ["Goleiro", "Lateral", "Zagueiro", "Meia", "Atacante"]
  const characteristics = ["DPe/Ref", "Mar/Vel", "Pas/Fin", "Des/Vel", "Fin/Cab", "Cab/Res", "Vel/Dri"]
  const countries = ["BRA", "ARG", "URU", "COL", "CHI", "PAR", "ECU", "PER"]
  const sides = ["D", "E", "C"]
  
  const names = [
    "Silva", "Santos", "Oliveira", "Souza", "Lima", "Pereira", "Costa", "Ferreira",
    "Rodrigues", "Almeida", "Nascimento", "Carvalho", "Araujo", "Ribeiro", "Martins",
    "Gomes", "Barbosa", "Moreira", "Fernandez", "Gonzalez", "Rodriguez", "Martinez"
  ]
  
  const firstNames = [
    "Lucas", "Gabriel", "Rafael", "Bruno", "Matheus", "Felipe", "Gustavo", "Pedro",
    "Thiago", "Marcos", "Andre", "Carlos", "Diego", "Eduardo", "Fernando", "Henrique"
  ]

  return Array.from({ length: 22 }, (_, i) => ({
    id: i + 1,
    nome: `${firstNames[i % firstNames.length]} ${names[i % names.length]}`,
    posicao: positions[Math.floor(i / 4) % positions.length],
    pais: countries[Math.floor(Math.random() * countries.length)],
    idade: 18 + Math.floor(Math.random() * 18),
    caracteristica: characteristics[Math.floor(Math.random() * characteristics.length)],
    lado: sides[Math.floor(Math.random() * sides.length)]
  }))
}

// All teams combined
const allTeams = [...serieATeams, ...serieBTeams, ...serieCTeams, ...serieDTeams]

export default function EditarPage() {
  const router = useRouter()
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(allTeams[0])
  const [searchTeam, setSearchTeam] = useState("")
  const [selectedPlayerIndex, setSelectedPlayerIndex] = useState(0)
  const [activeTab, setActiveTab] = useState<"principal" | "juniores">("principal")
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [players, setPlayers] = useState(() => generatePlayersForTeam(allTeams[0]))

  // Update players when team changes
  useEffect(() => {
    if (selectedTeam) {
      setPlayers(generatePlayersForTeam(selectedTeam))
      setSelectedPlayerIndex(0)
    }
  }, [selectedTeam])

  // Filter teams
  const filteredTeams = useMemo(() => {
    if (!searchTeam) return allTeams
    return allTeams.filter(team => 
      team.nome.toLowerCase().includes(searchTeam.toLowerCase()) ||
      team.curto.toLowerCase().includes(searchTeam.toLowerCase())
    )
  }, [searchTeam])

  // Sort players
  const sortedPlayers = useMemo(() => {
    if (!sortColumn) return players
    return [...players].sort((a, b) => {
      const aVal = a[sortColumn as keyof typeof a]
      const bVal = b[sortColumn as keyof typeof b]
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal
      }
      return sortDirection === "asc" 
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal))
    })
  }, [players, sortColumn, sortDirection])

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        router.push("/splash")
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [router])

  return (
    <div 
      className="min-h-screen flex flex-col"
      style={{
        background: "linear-gradient(180deg, #2d2d2d 0%, #1a1a1a 50%, #1f1f1f 100%)"
      }}
    >
      {/* Header */}
      <div className="bg-black/30 border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link
            href="/splash"
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-lg transition-all text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Menu
          </Link>
          <div className="flex items-center gap-3">
            <Image
              src="/brand/ultrafoot-text.png"
              alt="Ultrafoot"
              width={120}
              height={30}
              className="object-contain opacity-80 h-auto w-auto"
            />
            <div className="h-6 w-px bg-white/20" />
            <h1 className="text-lg font-bold text-white/90">Editor de Clubes</h1>
          </div>
        </div>
        <div className="text-xs text-white/40">
          ESC para voltar
        </div>
      </div>

      {/* Main container */}
      <div className="flex-1 grid grid-cols-[400px_1fr] gap-0">
        
        {/* Left Panel - Teams List */}
        <div className="flex flex-col border-r border-white/5 bg-black/20">
          {/* Search */}
          <div className="p-4 border-b border-white/5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                type="text"
                value={searchTeam}
                onChange={(e) => setSearchTeam(e.target.value)}
                placeholder="Procurar time..."
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-white/20 transition-colors"
              />
            </div>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-[1fr_80px_50px] bg-white/5 text-white/70 text-xs font-semibold border-b border-white/5">
            <div className="px-4 py-3">Time</div>
            <div className="px-3 py-3 text-center">Pais</div>
            <div className="px-3 py-3 text-center">OVR</div>
          </div>
          
          {/* Teams List */}
          <div className="flex-1 overflow-y-auto">
            {filteredTeams.map((team, index) => (
              <button
                key={`${team.curto}-${team.divisao}`}
                onClick={() => setSelectedTeam(team)}
                className={cn(
                  "w-full grid grid-cols-[1fr_80px_50px] text-sm border-b border-white/5 transition-all",
                  selectedTeam?.curto === team.curto && selectedTeam?.divisao === team.divisao
                    ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-white" 
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                )}
              >
                <div className="px-4 py-3 text-left truncate flex items-center gap-2">
                  <TeamCrest team={team} size="xs" />
                  <span>{team.nome}</span>
                </div>
                <div className="px-3 py-3 flex items-center justify-center gap-1.5 text-xs">
                  <span>{getCountryFlag("BRA")}</span>
                  <span className="text-white/50">BRA</span>
                </div>
                <div className={cn(
                  "px-3 py-3 text-center font-bold",
                  team.prestigio >= 80 ? "text-green-400" :
                  team.prestigio >= 70 ? "text-yellow-400" :
                  team.prestigio >= 60 ? "text-orange-400" : "text-white/60"
                )}>
                  {team.prestigio}
                </div>
              </button>
            ))}
          </div>

          {/* Teams count */}
          <div className="px-4 py-3 text-xs text-white/40 bg-black/30 border-t border-white/5">
            {filteredTeams.length} times encontrados
          </div>
        </div>

        {/* Right Panel - Team Details */}
        <div className="flex flex-col">
          {selectedTeam && (
            <>
              {/* Team Info Header */}
              <div className="bg-gradient-to-r from-[#3d3d6b] to-[#2d2d5b] text-white p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold">{selectedTeam.nome}</h2>
                    <div className="text-sm text-white/60 mt-1">{selectedTeam.divisao}</div>
                    <div className="flex items-center gap-2 mt-3 text-sm">
                      <Flag className="h-4 w-4 text-white/60" />
                      <span>Brasil - {selectedTeam.estado}</span>
                    </div>
                    <div className="mt-2 text-sm">
                      <span className="text-white/60">Estadio:</span>{" "}
                      <span className="font-medium">{selectedTeam.estadio_nome}</span>
                    </div>
                    <div className="text-sm text-white/50">
                      {new Intl.NumberFormat("pt-BR").format(selectedTeam.estadio_cap)} lugares
                    </div>
                    <div className="mt-3 text-sm">
                      <span className="text-white/60">Tecnico:</span>{" "}
                      <span className="font-semibold">{selectedTeam.tecnico}</span>
                    </div>
                  </div>
                  
                  {/* Team OVR */}
                  <div className="text-right mr-6">
                    <div className="text-5xl font-black">{selectedTeam.prestigio}</div>
                    <div className="text-xs text-white/50 mt-1">OVERALL</div>
                  </div>

                  {/* Team Crest */}
                  <div className="w-24 h-24 flex items-center justify-center bg-white/10 rounded-xl p-2">
                    <TeamCrest team={selectedTeam} size="lg" />
                  </div>
                </div>
              </div>

              {/* Kits Preview and Tabs */}
              <div className="bg-gradient-to-r from-[#2d2d5b] to-[#252550] px-6 py-4 flex items-center justify-between border-b border-white/5">
                <div className="flex gap-3">
                  {["home", "away", "third"].map((variant) => (
                    <div 
                      key={variant} 
                      className="w-16 h-20 bg-white/10 rounded-lg flex items-center justify-center p-2 hover:bg-white/20 transition-colors cursor-pointer"
                    >
                      <Image
                        src={getCamisaUrl(selectedTeam.file_key, variant as "home" | "away" | "third")}
                        alt={`${selectedTeam.nome} ${variant}`}
                        width={48}
                        height={60}
                        className="object-contain h-auto w-auto"
                        unoptimized
                      />
                    </div>
                  ))}
                </div>

                {/* Tabs */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab("principal")}
                    className={cn(
                      "px-6 py-2.5 text-sm font-bold rounded-lg transition-all",
                      activeTab === "principal"
                        ? "bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 shadow-lg shadow-yellow-500/20"
                        : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                    )}
                  >
                    Principal
                  </button>
                  <button
                    onClick={() => setActiveTab("juniores")}
                    className={cn(
                      "px-6 py-2.5 text-sm font-bold rounded-lg transition-all",
                      activeTab === "juniores"
                        ? "bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 shadow-lg shadow-yellow-500/20"
                        : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                    )}
                  >
                    Juniores
                  </button>
                </div>
              </div>

              {/* Players Table */}
              <div className="flex-1 flex flex-col overflow-hidden bg-black/20">
                {/* Table Header */}
                <div className="grid grid-cols-[1fr_100px_70px_60px_90px_50px] bg-white/5 text-white/60 text-xs font-semibold border-b border-white/5">
                  <button 
                    onClick={() => handleSort("nome")}
                    className="px-4 py-3 text-left hover:bg-white/5 flex items-center gap-1 transition-colors"
                  >
                    Nome
                    {sortColumn === "nome" && (
                      sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                  <button 
                    onClick={() => handleSort("posicao")}
                    className="px-3 py-3 text-left hover:bg-white/5 transition-colors"
                  >
                    Posicao
                  </button>
                  <div className="px-3 py-3 text-center">Pais</div>
                  <button 
                    onClick={() => handleSort("idade")}
                    className="px-3 py-3 text-center hover:bg-white/5 transition-colors"
                  >
                    Idade
                  </button>
                  <div className="px-3 py-3 text-center">Carac.</div>
                  <div className="px-3 py-3 text-center">Lado</div>
                </div>
                
                {/* Players List */}
                <div className="flex-1 overflow-y-auto">
                  {sortedPlayers.map((player, index) => (
                    <button
                      key={player.id}
                      onClick={() => setSelectedPlayerIndex(index)}
                      className={cn(
                        "w-full grid grid-cols-[1fr_100px_70px_60px_90px_50px] text-sm border-b border-white/5 transition-all",
                        selectedPlayerIndex === index 
                          ? "bg-gradient-to-r from-yellow-500/30 to-yellow-600/20 text-white" 
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <div className="px-4 py-2.5 text-left truncate font-medium">{player.nome}</div>
                      <div className={cn(
                        "px-3 py-2.5 text-left text-xs",
                        player.posicao === "Goleiro" && "text-yellow-400",
                        player.posicao === "Zagueiro" && "text-blue-400",
                        player.posicao === "Lateral" && "text-cyan-400",
                        player.posicao === "Meia" && "text-green-400",
                        player.posicao === "Atacante" && "text-red-400"
                      )}>
                        {player.posicao}
                      </div>
                      <div className="px-3 py-2.5 flex items-center justify-center gap-1 text-xs">
                        <span>{getCountryFlag(player.pais)}</span>
                        <span className="text-white/50">{player.pais}</span>
                      </div>
                      <div className="px-3 py-2.5 text-center">{player.idade}</div>
                      <div className="px-3 py-2.5 text-center text-xs text-white/50">{player.caracteristica}</div>
                      <div className="px-3 py-2.5 text-center text-xs">{player.lado}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between bg-black/40 border-t border-white/5 px-6 py-4">
                <div className="flex items-center gap-3 text-sm text-white/60">
                  <span className="font-semibold text-white">{players.length}</span>
                  <span>/55 jogadores</span>
                </div>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-2 px-4 py-2 text-sm bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-lg transition-all">
                    <Plus className="h-4 w-4" />
                    Adicionar
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 text-sm bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-lg transition-all">
                    <Pencil className="h-4 w-4" />
                    Editar
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 text-sm bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-lg transition-all">
                    <Shuffle className="h-4 w-4" />
                    Aleatorio
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-all">
                    <Trash2 className="h-4 w-4" />
                    Remover
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper function
function getCountryFlag(code: string): string {
  const flags: Record<string, string> = {
    "BRA": "🇧🇷", "ARG": "🇦🇷", "URU": "🇺🇾", "CHI": "🇨🇱", 
    "COL": "🇨🇴", "ECU": "🇪🇨", "PER": "🇵🇪", "PAR": "🇵🇾",
    "VEN": "🇻🇪", "BOL": "🇧🇴", "MEX": "🇲🇽",
  }
  return flags[code] || "🏳️"
}

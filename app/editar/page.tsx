"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Search, 
  Home, 
  X, 
  ChevronUp, 
  ChevronDown,
  Users,
  Shuffle,
  Flag,
  ArrowLeft
} from "lucide-react"
import { cn } from "@/lib/utils"
import { 
  serieATeams, 
  serieBTeams, 
  getEscudoUrl, 
  getCamisaUrl,
  type Team 
} from "@/lib/teams-data"
import { TeamCrest } from "@/components/team-crest"

// Mock players data
const mockPlayers = [
  { id: 1, nome: "Casanova", posicao: "Goleiro", pais: "URU", idade: 24, caracteristica: "DPe/Ref", lado: "D" },
  { id: 2, nome: "Jeremias Young", posicao: "Goleiro", pais: "ARG", idade: 23, caracteristica: "Ref/Col", lado: "E" },
  { id: 3, nome: "Gualberto", posicao: "Goleiro", pais: "URU", idade: 29, caracteristica: "DPe/Ref", lado: "D" },
  { id: 4, nome: "Juan Alvez", posicao: "Lateral", pais: "URU", idade: 37, caracteristica: "Mar/Vel", lado: "D" },
  { id: 5, nome: "Adrian Argacha", posicao: "Lateral", pais: "URU", idade: 34, caracteristica: "Mar/Pas", lado: "E" },
  { id: 6, nome: "Jonathan Toledo", posicao: "Zagueiro", pais: "URU", idade: 25, caracteristica: "Mar/Vel", lado: "E" },
  { id: 7, nome: "Fernando Souza", posicao: "Zagueiro", pais: "URU", idade: 22, caracteristica: "Mar/Vel", lado: "D" },
  { id: 8, nome: "Lucas Otero", posicao: "Zagueiro", pais: "URU", idade: 31, caracteristica: "Cab/Res", lado: "E" },
  { id: 9, nome: "Roberto Fernandez", posicao: "Meia", pais: "URU", idade: 23, caracteristica: "Des/Fin", lado: "E" },
  { id: 10, nome: "Kevin Alaniz", posicao: "Meia", pais: "URU", idade: 18, caracteristica: "Fin/Pas", lado: "E" },
  { id: 11, nome: "Angel Rodriguez", posicao: "Meia", pais: "URU", idade: 28, caracteristica: "Des/Pas", lado: "D" },
  { id: 12, nome: "Camilo Nunez", posicao: "Meia", pais: "URU", idade: 27, caracteristica: "Des/Vel", lado: "D" },
  { id: 13, nome: "Agustin Alfaro", posicao: "Meia", pais: "URU", idade: 21, caracteristica: "Pas/Fin", lado: "E" },
  { id: 14, nome: "Andres Barboza", posicao: "Meia", pais: "URU", idade: 26, caracteristica: "Des/Mar", lado: "C" },
  { id: 15, nome: "Luciano Nequecaur", posicao: "Atacante", pais: "ARG", idade: 28, caracteristica: "Cab/Vel", lado: "E" },
  { id: 16, nome: "Maureen Franco", posicao: "Atacante", pais: "URU", idade: 37, caracteristica: "Fin/Vel", lado: "D" },
  { id: 17, nome: "Kaique", posicao: "Atacante", pais: "BRA", idade: 25, caracteristica: "Fin/Cab", lado: "E" },
  { id: 18, nome: "Gonzalo Vega", posicao: "Atacante", pais: "URU", idade: 29, caracteristica: "Fin/Res", lado: "D" },
  { id: 19, nome: "Facundo Curuchet", posicao: "Atacante", pais: "ARG", idade: 31, caracteristica: "Vel/Fin", lado: "D" },
]

// All teams combined
const allTeams = [...serieATeams, ...serieBTeams]

// Country flags mapping
const countryFlags: Record<string, string> = {
  "Brasil": "BRA",
  "Uruguai": "URU",
  "Argentina": "ARG",
  "Equador": "ECU",
  "Uzbequistao": "UZB",
  "Chile": "CHI",
  "Ucrania": "UKR",
  "EUA": "USA",
  "Mexico": "MEX",
  "Holanda": "HOL",
  "Russia": "RUS",
  "Austria": "AUT",
  "Belgica": "BEL",
}

export default function EditarPage() {
  const router = useRouter()
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(allTeams[0])
  const [searchTeam, setSearchTeam] = useState("")
  const [searchPlayer, setSearchPlayer] = useState("")
  const [selectedPlayerIndex, setSelectedPlayerIndex] = useState(0)
  const [activeTab, setActiveTab] = useState<"principal" | "juniores">("principal")
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

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
    if (!sortColumn) return mockPlayers
    return [...mockPlayers].sort((a, b) => {
      const aVal = a[sortColumn as keyof typeof a]
      const bVal = b[sortColumn as keyof typeof b]
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal
      }
      return sortDirection === "asc" 
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal))
    })
  }, [sortColumn, sortDirection])

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex flex-col">
      {/* Header with back button */}
      <div className="bg-[#16213e] border-b border-[#0f3460]/50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/splash"
            className="flex items-center gap-2 px-4 py-2 bg-[#0f3460] hover:bg-[#1a4a7a] text-white rounded-lg transition-colors text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Menu
          </Link>
          <h1 className="text-xl font-bold text-white">Editor de Clubes</h1>
        </div>
      </div>

      {/* Main container */}
      <div className="flex-1 grid grid-cols-2 gap-0 p-0">
        
        {/* Left Panel - Teams List */}
        <div className="flex flex-col border-r border-[#0f3460]/50">
          {/* Table Header */}
          <div className="grid grid-cols-[1fr_120px_60px] bg-[#3d3d6b] text-white text-sm font-semibold">
            <div className="px-3 py-2 border-r border-[#2d2d5b]">Time</div>
            <div className="px-3 py-2 border-r border-[#2d2d5b] text-center">Pais</div>
            <div className="px-3 py-2 text-center">Nivel</div>
          </div>
          
          {/* Teams List */}
          <div className="flex-1 overflow-y-auto bg-white">
            {filteredTeams.map((team, index) => (
              <button
                key={team.curto}
                onClick={() => setSelectedTeam(team)}
                className={cn(
                  "w-full grid grid-cols-[1fr_120px_60px] text-sm border-b border-gray-200 transition-colors",
                  selectedTeam?.curto === team.curto 
                    ? "bg-[#3d3d6b] text-white" 
                    : index % 2 === 0 ? "bg-white hover:bg-blue-50 text-gray-800" : "bg-gray-50 hover:bg-blue-50 text-gray-800"
                )}
              >
                <div className="px-3 py-2 text-left truncate">{team.nome}</div>
                <div className="px-3 py-2 flex items-center justify-center gap-1">
                  <span className="text-xs">{getCountryFlag(team.estado)}</span>
                  <span>Brasil</span>
                </div>
                <div className="px-3 py-2 text-center font-semibold">{team.prestigio}</div>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="bg-[#16213e] p-3 border-t border-[#0f3460]/50">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchTeam}
                onChange={(e) => setSearchTeam(e.target.value)}
                placeholder="Procurar time..."
                className="flex-1 px-3 py-2 text-sm bg-[#0f3460] border border-[#1a4a7a] rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-[#4a7ab0]"
              />
              <button className="p-2 bg-[#0f3460] hover:bg-[#1a4a7a] rounded-lg transition-colors">
                <Search className="h-4 w-4 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel - Team Details */}
        <div className="flex flex-col bg-[#1a1a2e]">
          {selectedTeam && (
            <>
              {/* Team Info Header */}
              <div className="bg-[#3d3d6b] text-white p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold">{selectedTeam.nome}</h2>
                    <div className="text-sm text-white/70 mt-1">Regional</div>
                    <div className="flex items-center gap-2 mt-3 text-sm">
                      <Flag className="h-4 w-4" />
                      <span>Brasil</span>
                    </div>
                    <div className="mt-2 text-sm">
                      <span className="text-white/70">Estadio</span>{" "}
                      <span className="font-medium">{selectedTeam.estadio_nome}</span>
                    </div>
                    <div className="text-sm text-white/70">
                      {selectedTeam.estadio_cap.toLocaleString()} lugares
                    </div>
                    <div className="mt-3 text-sm">
                      <span className="text-white/70">Tecnico:</span>{" "}
                      <span className="font-semibold">Ramon Carrasco</span>
                    </div>
                  </div>
                  
                  {/* Team Level */}
                  <div className="text-right mr-4">
                    <div className="text-4xl font-bold">{selectedTeam.prestigio}</div>
                  </div>

                  {/* Team Crest */}
                  <div className="w-20 h-20 flex items-center justify-center">
                    <TeamCrest team={selectedTeam} size="lg" />
                  </div>
                </div>
              </div>

              {/* Kits Preview and Tabs */}
              <div className="bg-[#3d3d6b] px-4 pb-4 flex items-center justify-between">
                <div className="flex gap-2">
                  {["home", "away", "third"].map((variant) => (
                    <div key={variant} className="w-14 h-18 bg-white/10 rounded-lg flex items-center justify-center p-1">
                      <Image
                        src={getCamisaUrl(selectedTeam.file_key, variant as "home" | "away" | "third")}
                        alt={`${selectedTeam.nome} ${variant}`}
                        width={48}
                        height={60}
                        className="object-contain"
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
                      "px-5 py-2 text-sm font-semibold rounded transition-colors",
                      activeTab === "principal"
                        ? "bg-[#f4d03f] text-[#1a1a2e]"
                        : "bg-white/20 text-white hover:bg-white/30"
                    )}
                  >
                    Principal
                  </button>
                  <button
                    onClick={() => setActiveTab("juniores")}
                    className={cn(
                      "px-5 py-2 text-sm font-semibold rounded transition-colors",
                      activeTab === "juniores"
                        ? "bg-[#f4d03f] text-[#1a1a2e]"
                        : "bg-white/20 text-white hover:bg-white/30"
                    )}
                  >
                    Juniores
                  </button>
                </div>
              </div>

              {/* Players Table */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-[1fr_90px_60px_50px_80px_50px] bg-[#3d3d6b] text-white text-xs font-semibold">
                  <button 
                    onClick={() => handleSort("nome")}
                    className="px-3 py-2 border-r border-[#2d2d5b] text-left hover:bg-[#4d4d7b] flex items-center gap-1"
                  >
                    Nome
                    {sortColumn === "nome" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </button>
                  <button 
                    onClick={() => handleSort("posicao")}
                    className="px-3 py-2 border-r border-[#2d2d5b] text-left hover:bg-[#4d4d7b]"
                  >
                    Posicao
                  </button>
                  <div className="px-3 py-2 border-r border-[#2d2d5b] text-center">Pais</div>
                  <button 
                    onClick={() => handleSort("idade")}
                    className="px-3 py-2 border-r border-[#2d2d5b] text-center hover:bg-[#4d4d7b]"
                  >
                    Idade
                  </button>
                  <div className="px-3 py-2 border-r border-[#2d2d5b] text-center">Carac.</div>
                  <div className="px-3 py-2 text-center">Lado</div>
                </div>
                
                {/* Players List */}
                <div className="flex-1 overflow-y-auto bg-white">
                  {sortedPlayers.map((player, index) => (
                    <button
                      key={player.id}
                      onClick={() => setSelectedPlayerIndex(index)}
                      className={cn(
                        "w-full grid grid-cols-[1fr_90px_60px_50px_80px_50px] text-xs border-b border-gray-200 transition-colors",
                        selectedPlayerIndex === index 
                          ? "bg-[#f4d03f] text-[#1a1a2e]" 
                          : index % 2 === 0 ? "bg-white hover:bg-yellow-50 text-gray-800" : "bg-gray-50 hover:bg-yellow-50 text-gray-800"
                      )}
                    >
                      <div className="px-3 py-2 text-left truncate font-medium">{player.nome}</div>
                      <div className="px-3 py-2 text-left">{player.posicao}</div>
                      <div className="px-3 py-2 flex items-center justify-center gap-0.5">
                        <span className="text-[10px]">{getCountryFlag(player.pais)}</span>
                        <span>{player.pais}</span>
                      </div>
                      <div className="px-3 py-2 text-center">{player.idade}</div>
                      <div className="px-3 py-2 text-center">{player.caracteristica}</div>
                      <div className="px-3 py-2 text-center">{player.lado}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bottom Stats */}
              <div className="flex items-center justify-between bg-[#16213e] border-t border-[#0f3460]/50 p-3">
                <div className="flex items-center gap-4 text-sm text-white">
                  <span className="font-semibold">{mockPlayers.length}/55 jogadores</span>
                </div>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-2 px-3 py-1.5 text-xs bg-[#0f3460] hover:bg-[#1a4a7a] text-white rounded transition-colors">
                    <Plus className="h-3 w-3" />
                    Adicionar
                  </button>
                  <button className="flex items-center gap-2 px-3 py-1.5 text-xs bg-[#0f3460] hover:bg-[#1a4a7a] text-white rounded transition-colors">
                    <Shuffle className="h-3 w-3" />
                    Aleatorio
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

// Helper functions
function getCountryFlag(code: string): string {
  const flags: Record<string, string> = {
    "RJ": "🇧🇷", "SP": "🇧🇷", "MG": "🇧🇷", "RS": "🇧🇷", "PR": "🇧🇷", 
    "BA": "🇧🇷", "CE": "🇧🇷", "PE": "🇧🇷", "PA": "🇧🇷", "SC": "🇧🇷",
    "GO": "🇧🇷", "AM": "🇧🇷", "AL": "🇧🇷",
    "BRA": "🇧🇷", "URU": "🇺🇾", "ARG": "🇦🇷", "CHI": "🇨🇱", 
    "COL": "🇨🇴", "ECU": "🇪🇨", "PER": "🇵🇪", "MEX": "🇲🇽",
  }
  return flags[code] || "🏳️"
}

function getCountryName(estado: string): string {
  return "Brasil"
}

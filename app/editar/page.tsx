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
  Flag
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

  // Get country code from estado (simplified)
  const getCountryCode = (estado: string) => {
    return "BRA"
  }

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
    <div className="min-h-screen bg-[#c0c0c0] p-2">
      {/* Main container - Brasfoot style */}
      <div className="grid grid-cols-2 gap-2 h-[calc(100vh-16px)]">
        
        {/* Left Panel - Teams List */}
        <div className="flex flex-col gap-2">
          {/* Teams Table */}
          <div className="flex-1 bg-white border-2 border-gray-400 rounded overflow-hidden flex flex-col">
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_120px_60px] bg-[#000080] text-white text-xs font-semibold">
              <div className="px-2 py-1 border-r border-[#000060]">Time</div>
              <div className="px-2 py-1 border-r border-[#000060]">Pais</div>
              <div className="px-2 py-1">Nivel</div>
            </div>
            
            {/* Teams List */}
            <div className="flex-1 overflow-y-auto">
              {filteredTeams.map((team, index) => (
                <button
                  key={team.curto}
                  onClick={() => setSelectedTeam(team)}
                  className={cn(
                    "w-full grid grid-cols-[1fr_120px_60px] text-xs border-b border-gray-200 transition-colors",
                    selectedTeam?.curto === team.curto 
                      ? "bg-[#000080] text-white" 
                      : index % 2 === 0 ? "bg-white hover:bg-blue-50" : "bg-gray-50 hover:bg-blue-50"
                  )}
                >
                  <div className="px-2 py-1.5 text-left truncate">{team.nome}</div>
                  <div className="px-2 py-1.5 flex items-center gap-1">
                    <span className="text-[10px]">{getCountryFlag(team.estado)}</span>
                    <span>{getCountryName(team.estado)}</span>
                  </div>
                  <div className="px-2 py-1.5 text-center">{team.prestigio}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-1">
            <button className="flex items-center justify-center gap-1 px-3 py-2 bg-[#e0e0e0] border-2 border-t-white border-l-white border-b-gray-500 border-r-gray-500 text-xs font-semibold hover:bg-[#d0d0d0] active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white">
              <Plus className="h-4 w-4 text-green-600" />
              adicionar
            </button>
            <button className="flex items-center justify-center gap-1 px-3 py-2 bg-[#e0e0e0] border-2 border-t-white border-l-white border-b-gray-500 border-r-gray-500 text-xs font-semibold hover:bg-[#d0d0d0] active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white">
              <Pencil className="h-4 w-4 text-blue-600" />
              editar
            </button>
            <button className="flex items-center justify-center gap-1 px-3 py-2 bg-[#e0e0e0] border-2 border-t-white border-l-white border-b-gray-500 border-r-gray-500 text-xs font-semibold hover:bg-[#d0d0d0] active:border-t-gray-500 active:border-l-gray-500 active:border-b-white active:border-r-white">
              <Trash2 className="h-4 w-4 text-red-600" />
              deletar
            </button>
          </div>

          {/* Search Fields */}
          <div className="bg-[#e0e0e0] border-2 border-t-gray-500 border-l-gray-500 border-b-white border-r-white p-2 space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold w-24">Procurar time:</label>
              <input
                type="text"
                value={searchTeam}
                onChange={(e) => setSearchTeam(e.target.value)}
                className="flex-1 px-2 py-1 text-xs border-2 border-t-gray-500 border-l-gray-500 border-b-white border-r-white bg-white"
              />
              <button className="p-1 bg-[#e0e0e0] border-2 border-t-white border-l-white border-b-gray-500 border-r-gray-500">
                <Search className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold w-24">Procurar jogador:</label>
              <input
                type="text"
                value={searchPlayer}
                onChange={(e) => setSearchPlayer(e.target.value)}
                className="flex-1 px-2 py-1 text-xs border-2 border-t-gray-500 border-l-gray-500 border-b-white border-r-white bg-white"
              />
              <button className="p-1 bg-[#e0e0e0] border-2 border-t-white border-l-white border-b-gray-500 border-r-gray-500">
                <Search className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Filter Buttons */}
          <div className="bg-[#e0e0e0] border-2 border-t-gray-500 border-l-gray-500 border-b-white border-r-white p-2">
            <div className="text-xs font-semibold mb-1">Mostrar times:</div>
            <div className="flex gap-1">
              <button className="flex-1 px-2 py-1 text-xs bg-white border-2 border-t-gray-500 border-l-gray-500 border-b-white border-r-white hover:bg-gray-100">
                sem escudo
              </button>
              <button className="flex-1 px-2 py-1 text-xs bg-white border-2 border-t-gray-500 border-l-gray-500 border-b-white border-r-white hover:bg-gray-100">
                sem camisas
              </button>
              <button className="flex-1 px-2 py-1 text-xs bg-white border-2 border-t-gray-500 border-l-gray-500 border-b-white border-r-white hover:bg-gray-100">
                jogadores duplicados
              </button>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="flex gap-2">
            <Link
              href="/splash"
              className="flex items-center justify-center gap-1 px-4 py-2 bg-[#e0e0e0] border-2 border-t-white border-l-white border-b-gray-500 border-r-gray-500 text-xs font-semibold hover:bg-[#d0d0d0]"
            >
              <Home className="h-4 w-4" />
              inicio
            </Link>
            <button className="flex items-center justify-center gap-1 px-4 py-2 bg-[#e0e0e0] border-2 border-t-white border-l-white border-b-gray-500 border-r-gray-500 text-xs font-semibold hover:bg-[#d0d0d0]">
              <X className="h-4 w-4 text-red-600" />
              sair jogo
            </button>
          </div>
        </div>

        {/* Right Panel - Team Details */}
        <div className="flex flex-col gap-2">
          {selectedTeam && (
            <>
              {/* Team Info Header */}
              <div className="bg-[#6b5b95] text-white p-3 rounded-t flex items-start gap-4">
                <div className="flex-1">
                  <h2 className="text-lg font-bold">{selectedTeam.nome}</h2>
                  <div className="text-xs text-white/80">Regional</div>
                  <div className="flex items-center gap-2 mt-2 text-sm">
                    <Flag className="h-4 w-4" />
                    <span>Brasil</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-sm">
                    <span className="text-xs">Estadio</span>
                    <span>{selectedTeam.estadio_nome}</span>
                  </div>
                  <div className="text-xs mt-1 text-white/70">
                    {selectedTeam.estadio_cap.toLocaleString()} lugares
                  </div>
                  <div className="text-xs mt-2">
                    Tecnico: <span className="font-semibold">Ramon Carrasco</span>
                  </div>
                </div>
                
                {/* Team Level */}
                <div className="text-right">
                  <div className="text-3xl font-bold">{selectedTeam.prestigio}</div>
                </div>

                {/* Team Crest */}
                <div className="w-16 h-16 flex items-center justify-center">
                  <TeamCrest team={selectedTeam} size="lg" />
                </div>
              </div>

              {/* Kits Preview */}
              <div className="bg-[#6b5b95] px-3 pb-3 flex items-center gap-4">
                <div className="flex gap-2">
                  {["home", "away", "third"].map((variant) => (
                    <div key={variant} className="w-12 h-16 bg-white/10 rounded flex items-center justify-center">
                      <Image
                        src={getCamisaUrl(selectedTeam.file_key, variant as "home" | "away" | "third")}
                        alt={`${selectedTeam.nome} ${variant}`}
                        width={40}
                        height={50}
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                  ))}
                </div>

                {/* Tabs */}
                <div className="flex-1 flex justify-end gap-2">
                  <button
                    onClick={() => setActiveTab("principal")}
                    className={cn(
                      "px-4 py-1 text-xs font-semibold rounded transition-colors",
                      activeTab === "principal"
                        ? "bg-white text-[#6b5b95]"
                        : "bg-white/20 text-white hover:bg-white/30"
                    )}
                  >
                    Principal
                  </button>
                  <button
                    onClick={() => setActiveTab("juniores")}
                    className={cn(
                      "px-4 py-1 text-xs font-semibold rounded transition-colors",
                      activeTab === "juniores"
                        ? "bg-white text-[#6b5b95]"
                        : "bg-white/20 text-white hover:bg-white/30"
                    )}
                  >
                    Juniores
                  </button>
                </div>
              </div>

              {/* Players Table */}
              <div className="flex-1 bg-white border-2 border-gray-400 rounded overflow-hidden flex flex-col">
                {/* Table Header */}
                <div className="grid grid-cols-[1fr_80px_50px_50px_70px_40px] bg-[#000080] text-white text-[10px] font-semibold">
                  <button 
                    onClick={() => handleSort("nome")}
                    className="px-2 py-1 border-r border-[#000060] text-left hover:bg-[#0000a0] flex items-center gap-1"
                  >
                    Nome
                    {sortColumn === "nome" && (sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </button>
                  <button 
                    onClick={() => handleSort("posicao")}
                    className="px-2 py-1 border-r border-[#000060] text-left hover:bg-[#0000a0]"
                  >
                    Posicao
                  </button>
                  <div className="px-2 py-1 border-r border-[#000060]">Pais</div>
                  <button 
                    onClick={() => handleSort("idade")}
                    className="px-2 py-1 border-r border-[#000060] hover:bg-[#0000a0]"
                  >
                    idade
                  </button>
                  <div className="px-2 py-1 border-r border-[#000060]">Carac.</div>
                  <div className="px-2 py-1">Lado</div>
                </div>
                
                {/* Players List */}
                <div className="flex-1 overflow-y-auto">
                  {sortedPlayers.map((player, index) => (
                    <button
                      key={player.id}
                      onClick={() => setSelectedPlayerIndex(index)}
                      className={cn(
                        "w-full grid grid-cols-[1fr_80px_50px_50px_70px_40px] text-[10px] border-b border-gray-200 transition-colors",
                        selectedPlayerIndex === index 
                          ? "bg-yellow-300" 
                          : index % 2 === 0 ? "bg-white hover:bg-yellow-100" : "bg-gray-50 hover:bg-yellow-100"
                      )}
                    >
                      <div className="px-2 py-1 text-left truncate">{player.nome}</div>
                      <div className="px-2 py-1 text-left">{player.posicao}</div>
                      <div className="px-2 py-1 flex items-center gap-0.5">
                        <span className="text-[8px]">{getCountryFlag(player.pais)}</span>
                        <span>{player.pais}</span>
                      </div>
                      <div className="px-2 py-1 text-center">{player.idade}</div>
                      <div className="px-2 py-1 text-center">{player.caracteristica}</div>
                      <div className="px-2 py-1 text-center">{player.lado}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bottom Stats */}
              <div className="flex items-center justify-between bg-[#e0e0e0] border-2 border-t-gray-500 border-l-gray-500 border-b-white border-r-white p-2">
                <div className="flex items-center gap-4 text-xs">
                  <span className="font-semibold">{mockPlayers.length}/55</span>
                  <span className="font-semibold">8</span>
                  <div className="flex items-center gap-1">
                    <button className="p-0.5 bg-green-500 rounded">
                      <Plus className="h-3 w-3 text-white" />
                    </button>
                    <button className="p-0.5 bg-green-500 rounded">
                      <Users className="h-3 w-3 text-white" />
                    </button>
                    <button className="p-0.5 bg-red-500 rounded">
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-1 px-2 py-1 text-xs bg-white border border-gray-400 rounded hover:bg-gray-100">
                    <Shuffle className="h-3 w-3" />
                    Criar aleatorio
                  </button>
                  <select className="px-2 py-1 text-xs border border-gray-400 rounded bg-white">
                    <option>Goleiro</option>
                    <option>Lateral</option>
                    <option>Zagueiro</option>
                    <option>Meia</option>
                    <option>Atacante</option>
                  </select>
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
    "BRA": "🇧🇷", "URU": "🇺🇾", "ARG": "🇦🇷", "CHI": "🇨🇱", "ECU": "🇪🇨",
    "COL": "🇨🇴", "PAR": "🇵🇾", "PER": "🇵🇪", "VEN": "🇻🇪", "BOL": "🇧🇴"
  }
  return flags[code] || "🏴"
}

function getCountryName(estado: string): string {
  // All Brazilian states return Brasil
  const brazilianStates = ["RJ", "SP", "MG", "RS", "PR", "BA", "CE", "PE", "PA", "SC", "GO", "AM", "AL", "SE", "RN", "PB", "MA", "PI", "AC", "AP", "RO", "RR", "TO", "MT", "MS", "DF", "ES"]
  if (brazilianStates.includes(estado)) return "Brasil"
  return estado
}

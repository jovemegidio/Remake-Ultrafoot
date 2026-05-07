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
  MapPin,
  Plus,
  Shuffle,
  Pencil,
  Trash2,
  Users,
  Shield
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
  const positions = ["GOL", "LAT", "ZAG", "VOL", "MEI", "ATA"]
  const characteristics = ["Reflexos", "Marcacao", "Passe", "Drible", "Finalizacao", "Cabecada", "Velocidade"]
  const countries = ["BRA", "ARG", "URU", "COL", "CHI", "PAR"]
  const sides = ["D", "E", "A"]
  
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
    overall: 55 + Math.floor(Math.random() * 35),
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

  const getPositionColor = (pos: string) => {
    const colors: Record<string, string> = {
      "GOL": "text-amber-400",
      "ZAG": "text-blue-400", 
      "LAT": "text-cyan-400",
      "VOL": "text-emerald-400",
      "MEI": "text-green-400",
      "ATA": "text-rose-400"
    }
    return colors[pos] || "text-white/60"
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0a0a0a]">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full opacity-[0.03]"
          style={{
            background: "radial-gradient(circle, rgba(139, 92, 246, 0.5) 0%, transparent 70%)",
          }}
        />
        <div 
          className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full opacity-[0.03]"
          style={{
            background: "radial-gradient(circle, rgba(59, 130, 246, 0.5) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Header - Fixed height */}
      <header className="relative z-10 h-16 flex-shrink-0 bg-black/60 backdrop-blur-xl border-b border-white/[0.06] px-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link
            href="/splash"
            className="flex items-center gap-2 px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white rounded-lg transition-all duration-300 text-sm font-medium border border-white/[0.06]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar ao Menu</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <Image
              src="/brand/ultrafoot-text.png"
              alt="Ultrafoot"
              width={140}
              height={35}
              className="object-contain h-8 w-auto"
              priority
            />
            <div className="hidden md:flex items-center gap-3">
              <div className="h-5 w-px bg-white/10" />
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-white/40" />
                <h1 className="text-sm font-semibold text-white/80 tracking-wide">Editor de Clubes</h1>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-xs text-white/30">
          <kbd className="px-2 py-1 bg-white/5 rounded border border-white/10 font-mono">ESC</kbd>
          <span>para voltar</span>
        </div>
      </header>

      {/* Main Content - Takes remaining height */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        
        {/* Left Panel - Teams List */}
        <aside className="w-80 lg:w-96 flex-shrink-0 flex flex-col bg-black/40 backdrop-blur-sm border-r border-white/[0.06]">
          {/* Search */}
          <div className="p-4 border-b border-white/[0.06]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <input
                type="text"
                value={searchTeam}
                onChange={(e) => setSearchTeam(e.target.value)}
                placeholder="Procurar time..."
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white/[0.03] border border-white/[0.08] rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-white/20 focus:bg-white/[0.05] transition-all duration-300"
              />
            </div>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-[1fr_60px_50px] bg-white/[0.02] text-white/50 text-xs font-medium border-b border-white/[0.06]">
            <div className="px-4 py-2.5">Time</div>
            <div className="px-2 py-2.5 text-center">Pais</div>
            <div className="px-2 py-2.5 text-center">OVR</div>
          </div>
          
          {/* Teams List */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {filteredTeams.map((team) => (
              <button
                key={`${team.curto}-${team.divisao}`}
                onClick={() => setSelectedTeam(team)}
                className={cn(
                  "w-full grid grid-cols-[1fr_60px_50px] text-sm border-b border-white/[0.04] transition-all duration-200",
                  selectedTeam?.curto === team.curto && selectedTeam?.divisao === team.divisao
                    ? "bg-gradient-to-r from-violet-500/20 via-purple-500/15 to-transparent border-l-2 border-l-violet-400" 
                    : "hover:bg-white/[0.03]"
                )}
              >
                <div className="px-4 py-2.5 text-left truncate flex items-center gap-2.5">
                  <TeamCrest team={team} size="xs" />
                  <span className={cn(
                    "truncate transition-colors",
                    selectedTeam?.curto === team.curto && selectedTeam?.divisao === team.divisao
                      ? "text-white font-medium"
                      : "text-white/70"
                  )}>{team.nome}</span>
                </div>
                <div className="px-2 py-2.5 flex items-center justify-center text-[10px] text-white/40">
                  BRA
                </div>
                <div className={cn(
                  "px-2 py-2.5 text-center font-bold text-sm",
                  team.prestigio >= 85 ? "text-emerald-400" :
                  team.prestigio >= 75 ? "text-green-400" :
                  team.prestigio >= 65 ? "text-yellow-400" :
                  team.prestigio >= 55 ? "text-orange-400" : "text-white/50"
                )}>
                  {team.prestigio}
                </div>
              </button>
            ))}
          </div>

          {/* Teams count */}
          <div className="px-4 py-2.5 text-xs text-white/30 bg-black/40 border-t border-white/[0.06] flex items-center gap-2">
            <Users className="h-3.5 w-3.5" />
            <span>{filteredTeams.length} times</span>
          </div>
        </aside>

        {/* Right Panel - Team Details */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {selectedTeam && (
            <>
              {/* Team Info Header - Compact */}
              <div className="flex-shrink-0 bg-gradient-to-r from-[#1a1a2e] via-[#16162b] to-[#1a1a2e] border-b border-white/[0.06]">
                <div className="px-6 py-4 flex items-center gap-6">
                  {/* Team Crest */}
                  <div className="flex-shrink-0 w-16 h-16 flex items-center justify-center bg-white/[0.05] rounded-xl border border-white/[0.08]">
                    <TeamCrest team={selectedTeam} size="md" />
                  </div>

                  {/* Team Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold text-white truncate">{selectedTeam.nome}</h2>
                      <span className="px-2 py-0.5 text-[10px] font-medium bg-white/10 text-white/50 rounded-full uppercase tracking-wider">
                        {selectedTeam.divisao}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-sm text-white/50">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{selectedTeam.estado}, Brasil</span>
                      </div>
                      <div className="h-3 w-px bg-white/10" />
                      <span>{selectedTeam.estadio_nome}</span>
                    </div>
                  </div>

                  {/* Kits */}
                  <div className="hidden lg:flex items-center gap-2">
                    {["home", "away", "third"].map((variant) => (
                      <div 
                        key={variant} 
                        className="w-12 h-14 bg-white/[0.05] rounded-lg flex items-center justify-center p-1.5 hover:bg-white/[0.1] transition-all duration-200 cursor-pointer border border-white/[0.06] hover:border-white/[0.12]"
                      >
                        <Image
                          src={getCamisaUrl(selectedTeam.file_key, variant as "home" | "away" | "third")}
                          alt={`${selectedTeam.nome} ${variant}`}
                          width={40}
                          height={50}
                          className="object-contain h-auto w-auto"
                          unoptimized
                        />
                      </div>
                    ))}
                  </div>

                  {/* Team OVR */}
                  <div className="flex-shrink-0 text-center">
                    <div className="text-4xl font-black text-white tracking-tight">{selectedTeam.prestigio}</div>
                    <div className="text-[10px] text-white/40 font-medium tracking-widest mt-0.5">OVERALL</div>
                  </div>

                  {/* Tabs */}
                  <div className="flex-shrink-0 flex gap-1.5">
                    <button
                      onClick={() => setActiveTab("principal")}
                      className={cn(
                        "px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-300",
                        activeTab === "principal"
                          ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20"
                          : "bg-white/[0.05] text-white/50 hover:bg-white/[0.1] hover:text-white/80"
                      )}
                    >
                      Principal
                    </button>
                    <button
                      onClick={() => setActiveTab("juniores")}
                      className={cn(
                        "px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-300",
                        activeTab === "juniores"
                          ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20"
                          : "bg-white/[0.05] text-white/50 hover:bg-white/[0.1] hover:text-white/80"
                      )}
                    >
                      Juniores
                    </button>
                  </div>
                </div>
              </div>

              {/* Players Table - Takes remaining space */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Table Header */}
                <div className="flex-shrink-0 grid grid-cols-[1fr_70px_55px_50px_50px_90px_45px] bg-white/[0.02] text-white/40 text-[11px] font-medium border-b border-white/[0.06]">
                  <button 
                    onClick={() => handleSort("nome")}
                    className="px-4 py-2.5 text-left hover:bg-white/[0.02] flex items-center gap-1 transition-colors uppercase tracking-wider"
                  >
                    Nome
                    {sortColumn === "nome" && (
                      sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                  <button 
                    onClick={() => handleSort("posicao")}
                    className="px-2 py-2.5 text-center hover:bg-white/[0.02] transition-colors uppercase tracking-wider"
                  >
                    Pos
                  </button>
                  <div className="px-2 py-2.5 text-center uppercase tracking-wider">Pais</div>
                  <button 
                    onClick={() => handleSort("idade")}
                    className="px-2 py-2.5 text-center hover:bg-white/[0.02] transition-colors uppercase tracking-wider"
                  >
                    Idade
                  </button>
                  <button 
                    onClick={() => handleSort("overall")}
                    className="px-2 py-2.5 text-center hover:bg-white/[0.02] transition-colors uppercase tracking-wider"
                  >
                    OVR
                  </button>
                  <div className="px-2 py-2.5 text-center uppercase tracking-wider">Carac.</div>
                  <div className="px-2 py-2.5 text-center uppercase tracking-wider">Lado</div>
                </div>
                
                {/* Players List - Scrollable */}
                <div className="flex-1 overflow-y-auto scrollbar-thin">
                  {sortedPlayers.map((player, index) => (
                    <button
                      key={player.id}
                      onClick={() => setSelectedPlayerIndex(index)}
                      className={cn(
                        "w-full grid grid-cols-[1fr_70px_55px_50px_50px_90px_45px] text-sm border-b border-white/[0.04] transition-all duration-200",
                        selectedPlayerIndex === index 
                          ? "bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-transparent border-l-2 border-l-amber-400" 
                          : "hover:bg-white/[0.02]"
                      )}
                    >
                      <div className={cn(
                        "px-4 py-2 text-left truncate font-medium",
                        selectedPlayerIndex === index ? "text-white" : "text-white/70"
                      )}>{player.nome}</div>
                      <div className={cn(
                        "px-2 py-2 text-center text-xs font-semibold",
                        getPositionColor(player.posicao)
                      )}>
                        {player.posicao}
                      </div>
                      <div className="px-2 py-2 text-center text-[10px] text-white/40">
                        {player.pais}
                      </div>
                      <div className="px-2 py-2 text-center text-white/60">{player.idade}</div>
                      <div className={cn(
                        "px-2 py-2 text-center font-bold",
                        player.overall >= 80 ? "text-emerald-400" :
                        player.overall >= 70 ? "text-green-400" :
                        player.overall >= 60 ? "text-yellow-400" : "text-white/50"
                      )}>{player.overall}</div>
                      <div className="px-2 py-2 text-center text-[11px] text-white/40 truncate">{player.caracteristica}</div>
                      <div className="px-2 py-2 text-center text-xs text-white/50">{player.lado}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bottom Actions - Fixed height */}
              <div className="flex-shrink-0 h-14 flex items-center justify-between bg-black/60 backdrop-blur-sm border-t border-white/[0.06] px-6">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-bold text-white">{players.length}</span>
                  <span className="text-white/40">/55 jogadores</span>
                </div>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white rounded-lg transition-all duration-200 border border-white/[0.06]">
                    <Plus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Adicionar</span>
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white rounded-lg transition-all duration-200 border border-white/[0.06]">
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Editar</span>
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white rounded-lg transition-all duration-200 border border-white/[0.06]">
                    <Shuffle className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Aleatorio</span>
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-lg transition-all duration-200 border border-rose-500/20">
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Remover</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

"use client"

import { useState, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { TeamCrest } from "@/components/team-crest"
import { PlayerAvatar } from "@/components/player-avatar"
import { Search, Filter, TrendingUp, TrendingDown, X } from "lucide-react"
import { serieATeams, getTeamByShort, type Team } from "@/lib/teams-data"
import { formatCurrency } from "@/lib/currency"
import { cn } from "@/lib/utils"

interface Player {
  id: number
  name: string
  team: Team
  position: string
  age: number
  overall: number
  value: number
  trend: "up" | "down" | "stable"
}

interface SearchPlayerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  players: Player[]
  onSelect: (player: Player) => void
}

const positionColors: Record<string, string> = {
  GOL: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  ZAG: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  LD: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  LE: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  VOL: "bg-green-500/20 text-green-400 border-green-500/30",
  MEI: "bg-green-500/20 text-green-400 border-green-500/30",
  PD: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  PE: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  ATA: "bg-red-500/20 text-red-400 border-red-500/30",
}

export function SearchPlayerModal({
  open,
  onOpenChange,
  players,
  onSelect,
}: SearchPlayerModalProps) {
  const [search, setSearch] = useState("")
  const [positionFilter, setPositionFilter] = useState<string | null>(null)

  const filteredPlayers = useMemo(() => {
    return players.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.team.nome.toLowerCase().includes(search.toLowerCase())
      const matchesPosition = !positionFilter || p.position === positionFilter
      return matchesSearch && matchesPosition
    })
  }, [players, search, positionFilter])

  const positions = useMemo(() => {
    const uniquePositions = [...new Set(players.map(p => p.position))]
    return uniquePositions.sort()
  }, [players])

  const handleSelect = (player: Player) => {
    onSelect(player)
    onOpenChange(false)
    setSearch("")
    setPositionFilter(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-[#0c0c10] border-white/10 max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white">Buscar Jogador</DialogTitle>
          <DialogDescription className="text-white/50">
            Encontre jogadores disponiveis no mercado
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <Input
              placeholder="Buscar por nome ou clube..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Position Filters */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setPositionFilter(null)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium border transition-all",
                !positionFilter
                  ? "bg-[var(--brand)]/20 text-[var(--brand)] border-[var(--brand)]/30"
                  : "bg-white/5 text-white/40 border-white/10 hover:border-white/20"
              )}
            >
              Todos
            </button>
            {positions.map((pos) => (
              <button
                key={pos}
                onClick={() => setPositionFilter(pos)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-bold border transition-all",
                  positionFilter === pos
                    ? positionColors[pos]
                    : "bg-white/5 text-white/40 border-white/10 hover:border-white/20"
                )}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-2">
          {filteredPlayers.length === 0 ? (
            <div className="py-12 text-center">
              <Search className="h-12 w-12 mx-auto text-white/20 mb-4" />
              <div className="text-white/50">Nenhum jogador encontrado</div>
              <div className="text-sm text-white/30 mt-1">Tente ajustar os filtros</div>
            </div>
          ) : (
            filteredPlayers.map((player) => (
              <button
                key={player.id}
                onClick={() => handleSelect(player)}
                className="w-full p-4 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-all text-left group"
              >
                <div className="flex items-center gap-4">
                  {/* Player Avatar */}
                  <div className="relative">
                    <PlayerAvatar
                      name={player.name}
                      teamColor={player.team.cor1}
                      fileKey={player.team.file_key}
                      position={player.position}
                      size="md"
                    />
                    <div className={cn(
                      "absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-md border",
                      positionColors[player.position]
                    )}>
                      <span className="text-[9px] font-bold">{player.position}</span>
                    </div>
                  </div>

                  {/* Player Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-white truncate group-hover:text-[var(--brand)] transition-colors">
                        {player.name}
                      </span>
                      <span className="text-xl font-bold text-[#ffd700]">{player.overall}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-white/50 mt-0.5">
                      <TeamCrest team={player.team} size="xs" />
                      <span>{player.team.nome}</span>
                      <span className="text-white/20">|</span>
                      <span>{player.age} anos</span>
                    </div>
                  </div>

                  {/* Value */}
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <span className="text-sm font-medium text-[var(--brand)]">{formatCurrency(player.value)}</span>
                      {player.trend === "up" && <TrendingUp className="h-3 w-3 text-[var(--brand)]" />}
                      {player.trend === "down" && <TrendingDown className="h-3 w-3 text-red-500" />}
                    </div>
                    <div className="text-[10px] text-white/40 mt-0.5">Valor de mercado</div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="text-center text-xs text-white/40 pt-4 border-t border-white/10">
          {filteredPlayers.length} jogadores encontrados
        </div>
      </DialogContent>
    </Dialog>
  )
}

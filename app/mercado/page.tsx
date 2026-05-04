"use client"

import { useState } from "react"
import {
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Star,
  DollarSign,
  ArrowLeftRight,
  UserPlus,
  UserMinus,
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { MusicPlayer } from "@/components/music-player"
import { TeamCrest } from "@/components/team-crest"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { getTeamByShort, formatCurrency, type Team } from "@/lib/teams-data"
import { useUserTeam } from "@/lib/save-system"

// Mock transfer targets
const transferTargets = [
  { id: 1, name: "Gabriel Veron", team: getTeamByShort("PLM")!, position: "PD", age: 21, overall: 78, value: 18000000, trend: "up" },
  { id: 2, name: "Gustavo Scarpa", team: getTeamByShort("PLM")!, position: "MEI", age: 30, overall: 81, value: 12000000, trend: "down" },
  { id: 3, name: "Bruno Henrique", team: getTeamByShort("FLM")!, position: "PE", age: 33, overall: 80, value: 8000000, trend: "down" },
  { id: 4, name: "Yuri Alberto", team: getTeamByShort("CRN")!, position: "ATA", age: 23, overall: 79, value: 22000000, trend: "up" },
  { id: 5, name: "Luciano", team: getTeamByShort("SPL")!, position: "ATA", age: 30, overall: 80, value: 15000000, trend: "stable" },
  { id: 6, name: "Dudu", team: getTeamByShort("PLM")!, position: "PE", age: 32, overall: 82, value: 10000000, trend: "down" },
]

// Mock transfer offers received
const offersReceived = [
  { id: 1, player: "Lincoln", from: getTeamByShort("FLM")!, value: 15000000, status: "pending" },
  { id: 2, player: "Helinho", from: getTeamByShort("SPL")!, value: 8500000, status: "pending" },
]

// Mock loans
const loansAvailable = [
  { id: 1, name: "Wesley", team: getTeamByShort("PLM")!, position: "PD", age: 19, overall: 72, loanFee: 500000 },
  { id: 2, name: "Giovani", team: getTeamByShort("CRN")!, position: "MEI", age: 20, overall: 70, loanFee: 300000 },
]

export default function MercadoPage() {
  const { team: userTeam } = useUserTeam()
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState("comprar")

  const filteredTargets = transferTargets.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen pl-[72px] pb-24">
      <GameSidebar />

      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-6">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-display tracking-widest text-primary">ULTRAFOOT</span>
          <span className="text-border">/</span>
          <span className="text-foreground">Mercado</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground font-display tracking-wider">VERBA DISPONIVEL</div>
            <div className="text-sm font-display text-accent">{formatCurrency(15000000)}</div>
          </div>
          <TeamCrest team={userTeam} size="sm" />
        </div>
      </header>

      <main className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display-italic text-3xl tracking-tight">MERCADO</h1>
            <p className="text-sm text-muted-foreground">Janela de transferencias aberta</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar jogador..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-[200px] bg-card border-border"
              />
            </div>
            <Button variant="outline" size="icon" className="border-border">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Transfer Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="eafc-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-display tracking-widest">
              <DollarSign className="h-4 w-4 text-accent" />
              VERBA TOTAL
            </div>
            <div className="mt-2 font-display-italic text-2xl text-accent">{formatCurrency(15000000)}</div>
          </div>
          <div className="eafc-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-display tracking-widest">
              <UserPlus className="h-4 w-4 text-primary" />
              CONTRATACOES
            </div>
            <div className="mt-2 font-display-italic text-2xl">0</div>
          </div>
          <div className="eafc-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-display tracking-widest">
              <UserMinus className="h-4 w-4 text-destructive" />
              VENDAS
            </div>
            <div className="mt-2 font-display-italic text-2xl">0</div>
          </div>
          <div className="eafc-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-display tracking-widest">
              <ArrowLeftRight className="h-4 w-4 text-gold" />
              PROPOSTAS
            </div>
            <div className="mt-2 font-display-italic text-2xl text-gold">{offersReceived.length}</div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="comprar" className="font-display text-xs tracking-wider">COMPRAR</TabsTrigger>
            <TabsTrigger value="vender" className="font-display text-xs tracking-wider">VENDER</TabsTrigger>
            <TabsTrigger value="propostas" className="font-display text-xs tracking-wider">
              PROPOSTAS
              {offersReceived.length > 0 && (
                <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[10px] text-gold-foreground font-bold">
                  {offersReceived.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="emprestimos" className="font-display text-xs tracking-wider">EMPRESTIMOS</TabsTrigger>
          </TabsList>

          {/* Buy Tab */}
          <TabsContent value="comprar" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredTargets.map((player) => (
                <PlayerCard key={player.id} player={player} type="buy" />
              ))}
            </div>
          </TabsContent>

          {/* Sell Tab */}
          <TabsContent value="vender" className="mt-6">
            <div className="eafc-card p-8 text-center">
              <UserMinus className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="font-display text-lg">LISTE JOGADORES PARA VENDA</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Acesse o elenco para colocar jogadores disponiveis para transferencia
              </p>
              <Button className="mt-4 font-display text-xs tracking-wider">
                IR PARA ELENCO
              </Button>
            </div>
          </TabsContent>

          {/* Offers Tab */}
          <TabsContent value="propostas" className="mt-6">
            <div className="space-y-4">
              {offersReceived.map((offer) => (
                <div key={offer.id} className="eafc-card p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-lg bg-card flex items-center justify-center">
                        <span className="font-display-italic text-xl text-muted-foreground">
                          {offer.player.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium">{offer.player}</div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>Proposta de</span>
                          <TeamCrest team={offer.from} size="xs" />
                          <span>{offer.from.nome}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-display-italic text-xl text-accent">{formatCurrency(offer.value)}</div>
                        <div className="text-[10px] text-muted-foreground font-display tracking-wider">OFERTA</div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="font-display text-xs tracking-wider bg-accent">
                          ACEITAR
                        </Button>
                        <Button size="sm" variant="outline" className="font-display text-xs tracking-wider border-border">
                          RECUSAR
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Loans Tab */}
          <TabsContent value="emprestimos" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2">
              {loansAvailable.map((player) => (
                <div key={player.id} className="eafc-card p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-lg bg-card flex items-center justify-center">
                      <span className="font-display-italic text-2xl text-muted-foreground">
                        {player.name.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{player.name}</span>
                        <span className="font-display-italic text-lg text-gold">{player.overall}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <TeamCrest team={player.team} size="xs" />
                        <span>{player.team.nome}</span>
                        <span className="text-border">|</span>
                        <span>{player.position}</span>
                        <span className="text-border">|</span>
                        <span>{player.age} anos</span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">Taxa: {formatCurrency(player.loanFee)}/temporada</span>
                        <Button size="sm" variant="outline" className="font-display text-xs tracking-wider border-border">
                          NEGOCIAR
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <MusicPlayer />
    </div>
  )
}

function PlayerCard({ 
  player, 
  type 
}: { 
  player: {
    id: number
    name: string
    team: Team
    position: string
    age: number
    overall: number
    value: number
    trend: string
  }
  type: "buy" | "sell"
}) {
  return (
    <div className="eafc-card p-4 transition-all hover:border-primary/30">
      <div className="flex items-start gap-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-card to-muted flex items-center justify-center">
            <span className="font-display-italic text-2xl text-muted-foreground">
              {player.name.charAt(0)}
            </span>
          </div>
          <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-md bg-card border border-border">
            <span className="text-[10px] font-bold">{player.position}</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium truncate">{player.name}</h3>
            <span className="font-display-italic text-xl text-gold">{player.overall}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <TeamCrest team={player.team} size="xs" />
            <span>{player.team.nome}</span>
            <span className="text-border">|</span>
            <span>{player.age} anos</span>
          </div>
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-1">
              <span className="font-display text-sm text-accent">{formatCurrency(player.value)}</span>
              {player.trend === "up" && <TrendingUp className="h-3 w-3 text-accent" />}
              {player.trend === "down" && <TrendingDown className="h-3 w-3 text-destructive" />}
            </div>
            <Button size="sm" variant="outline" className="font-display text-xs tracking-wider border-border">
              NEGOCIAR
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

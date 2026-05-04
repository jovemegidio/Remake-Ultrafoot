"use client"

import {
  History,
  Trophy,
  TrendingUp,
  Star,
  Calendar,
  Medal,
  Users,
  Target,
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { MusicPlayer } from "@/components/music-player"
import { TeamCrest } from "@/components/team-crest"
import { formatCurrency } from "@/lib/teams-data"
import { useUserTeam } from "@/lib/save-system"

const titles = [
  { name: "Campeonato Brasileiro Serie B", year: 2019, icon: Trophy },
  { name: "Copa Paulista", year: 2007, icon: Trophy },
  { name: "Campeonato Paulista A2", year: 1990, icon: Medal },
  { name: "Campeonato Paulista A3", year: 1965, icon: Medal },
]

const seasonHistory = [
  { year: 2025, competition: "Serie A", position: 12, points: 48, manager: "Pedro Caixinha" },
  { year: 2024, competition: "Serie A", position: 8, points: 54, manager: "Pedro Caixinha" },
  { year: 2023, competition: "Serie A", position: 10, points: 50, manager: "Mauricio Barbieri" },
  { year: 2022, competition: "Serie A", position: 15, points: 44, manager: "Mauricio Barbieri" },
  { year: 2021, competition: "Serie A", position: 5, points: 56, manager: "Mauricio Barbieri" },
  { year: 2020, competition: "Serie A", position: 6, points: 53, manager: "Mauricio Barbieri" },
]

const legends = [
  { name: "Walter", position: "ATA", years: "2018-2020", goals: 45 },
  { name: "Claudinho", position: "MEI", years: "2019-2021", goals: 25 },
  { name: "Ytalo", position: "ATA", years: "2017-2019", goals: 38 },
  { name: "Artur", position: "PD", years: "2019-2021", goals: 18 },
]

export default function HistoricoPage() {
  const { team: userTeam } = useUserTeam()
  const clubHistory = {
    founded: 1928,
    seasons: 98,
    bestPosition: "Campeao Serie B (2019)",
    totalTitles: 5,
    stadiumCapacity: userTeam.estadio_cap,
  }
  return (
    <div className="min-h-screen pl-[72px] pb-24">
      <GameSidebar />

      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-6">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-display tracking-widest text-primary">ULTRAFOOT</span>
          <span className="text-border">/</span>
          <span className="text-foreground">Historico</span>
        </div>
        <div className="flex items-center gap-2">
          <TeamCrest team={userTeam} size="sm" />
          <span className="text-sm font-medium">{userTeam.nome}</span>
        </div>
      </header>

      <main className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-6">
          <TeamCrest team={userTeam} size="2xl" />
          <div>
            <h1 className="font-display-italic text-4xl tracking-tight">{userTeam.nome.toUpperCase()}</h1>
            <p className="text-muted-foreground mt-1">Fundado em {clubHistory.founded} - {clubHistory.seasons} anos de historia</p>
            <div className="flex items-center gap-4 mt-2">
              <span className="flex items-center gap-1 text-sm">
                <Trophy className="h-4 w-4 text-gold" />
                {clubHistory.totalTitles} titulos
              </span>
              <span className="flex items-center gap-1 text-sm">
                <Star className="h-4 w-4 text-primary" />
                Prestigio {userTeam.prestigio}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="eafc-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-display tracking-widest">
              <Calendar className="h-4 w-4 text-primary" />
              FUNDACAO
            </div>
            <div className="mt-2 font-display-italic text-3xl">{clubHistory.founded}</div>
            <div className="text-xs text-muted-foreground mt-1">{clubHistory.seasons} temporadas</div>
          </div>

          <div className="eafc-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-display tracking-widest">
              <Trophy className="h-4 w-4 text-gold" />
              TITULOS
            </div>
            <div className="mt-2 font-display-italic text-3xl text-gold">{clubHistory.totalTitles}</div>
            <div className="text-xs text-muted-foreground mt-1">Conquistas na historia</div>
          </div>

          <div className="eafc-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-display tracking-widest">
              <Users className="h-4 w-4 text-accent" />
              TORCIDA
            </div>
            <div className="mt-2 font-display-italic text-3xl text-accent">
              {(userTeam.torcida / 1000000).toFixed(1)}M
            </div>
            <div className="text-xs text-muted-foreground mt-1">Torcedores estimados</div>
          </div>

          <div className="eafc-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-display tracking-widest">
              <Target className="h-4 w-4 text-primary" />
              ESTADIO
            </div>
            <div className="mt-2 font-display-italic text-2xl">{userTeam.estadio_nome}</div>
            <div className="text-xs text-muted-foreground mt-1">{userTeam.estadio_cap.toLocaleString()} lugares</div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Titles */}
          <section className="eafc-card overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-card/50">
              <Trophy className="h-4 w-4 text-gold" />
              <h2 className="font-display tracking-widest text-xs">TITULOS</h2>
            </div>
            <div className="divide-y divide-border">
              {titles.map((title, index) => (
                <div key={index} className="flex items-center gap-4 px-5 py-4 hover:bg-card/50 transition-colors">
                  <div className="h-12 w-12 rounded-lg bg-gold/20 flex items-center justify-center">
                    <title.icon className="h-6 w-6 text-gold" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{title.name}</div>
                    <div className="text-sm text-muted-foreground">{title.year}</div>
                  </div>
                  <div className="text-2xl font-display-italic text-gold">{title.year}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Legends */}
          <section className="eafc-card overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-card/50">
              <Star className="h-4 w-4 text-primary" />
              <h2 className="font-display tracking-widest text-xs">LENDAS DO CLUBE</h2>
            </div>
            <div className="divide-y divide-border">
              {legends.map((legend, index) => (
                <div key={index} className="flex items-center gap-4 px-5 py-4 hover:bg-card/50 transition-colors">
                  <div className="h-12 w-12 rounded-lg bg-card flex items-center justify-center">
                    <span className="font-display-italic text-xl text-muted-foreground">
                      {legend.name.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{legend.name}</div>
                    <div className="text-sm text-muted-foreground">{legend.position} - {legend.years}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display-italic text-xl text-accent">{legend.goals}</div>
                    <div className="text-[10px] text-muted-foreground font-display tracking-wider">GOLS</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Season History */}
        <section className="eafc-card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-card/50">
            <History className="h-4 w-4 text-primary" />
            <h2 className="font-display tracking-widest text-xs">HISTORICO DE TEMPORADAS</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-[10px] font-display tracking-widest text-muted-foreground">
                  <th className="px-5 py-3 text-left">ANO</th>
                  <th className="px-5 py-3 text-left">COMPETICAO</th>
                  <th className="px-5 py-3 text-center">POSICAO</th>
                  <th className="px-5 py-3 text-center">PONTOS</th>
                  <th className="px-5 py-3 text-left">TREINADOR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {seasonHistory.map((season) => (
                  <tr key={season.year} className="hover:bg-card/50 transition-colors">
                    <td className="px-5 py-3 font-display text-lg">{season.year}</td>
                    <td className="px-5 py-3">{season.competition}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg font-display ${
                        season.position <= 4 ? "bg-accent/20 text-accent" :
                        season.position <= 12 ? "bg-primary/20 text-primary" :
                        season.position >= 17 ? "bg-destructive/20 text-destructive" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {season.position}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center font-display-italic text-lg">{season.points}</td>
                    <td className="px-5 py-3 text-muted-foreground">{season.manager}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <MusicPlayer />
    </div>
  )
}

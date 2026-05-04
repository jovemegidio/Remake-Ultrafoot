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
  MapPin,
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { MusicPlayer } from "@/components/music-player"
import { TeamCrest } from "@/components/team-crest"
import { getTeamByShort, serieATeams } from "@/lib/teams-data"
import { cn } from "@/lib/utils"

const userTeam = getTeamByShort("RBB") || serieATeams[0]

// Historical data
const clubHistory = {
  founded: 1928,
  seasons: 98,
  bestPosition: "Campeao Serie B (2019)",
  totalTitles: 5,
  stadiumCapacity: userTeam.estadio_cap,
}

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
  return (
    <div className="min-h-screen pl-[72px] pb-24 bg-[#0a0a0a]">
      <GameSidebar />
      <GameHeader team={userTeam} />

      <main className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-6">
          <div className="relative">
            <TeamCrest team={userTeam} size="2xl" />
            <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1a1a] border-2 border-[#1db954] text-xs font-bold text-[#1db954]">
              {userTeam.prestigio}
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">{userTeam.nome.toUpperCase()}</h1>
            <p className="text-white/50 mt-1">Fundado em {clubHistory.founded} - {clubHistory.seasons} anos de historia</p>
            <div className="flex items-center gap-4 mt-3">
              <span className="flex items-center gap-1.5 text-sm text-white/70">
                <Trophy className="h-4 w-4 text-yellow-400" />
                {clubHistory.totalTitles} titulos
              </span>
              <span className="flex items-center gap-1.5 text-sm text-white/70">
                <MapPin className="h-4 w-4 text-[#1db954]" />
                {userTeam.cidade}, {userTeam.estado}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl bg-[#141414] border border-white/5 p-4">
            <div className="flex items-center gap-2 text-xs text-white/40 font-medium tracking-wider">
              <Calendar className="h-4 w-4 text-blue-400" />
              FUNDACAO
            </div>
            <div className="mt-2 text-3xl font-bold text-white">{clubHistory.founded}</div>
            <div className="text-xs text-white/40 mt-1">{clubHistory.seasons} temporadas</div>
          </div>

          <div className="rounded-xl bg-[#141414] border border-white/5 p-4">
            <div className="flex items-center gap-2 text-xs text-white/40 font-medium tracking-wider">
              <Trophy className="h-4 w-4 text-yellow-400" />
              TITULOS
            </div>
            <div className="mt-2 text-3xl font-bold text-yellow-400">{clubHistory.totalTitles}</div>
            <div className="text-xs text-white/40 mt-1">Conquistas na historia</div>
          </div>

          <div className="rounded-xl bg-[#141414] border border-white/5 p-4">
            <div className="flex items-center gap-2 text-xs text-white/40 font-medium tracking-wider">
              <Users className="h-4 w-4 text-[#1db954]" />
              TORCIDA
            </div>
            <div className="mt-2 text-3xl font-bold text-[#1db954]">
              {(userTeam.torcida / 1000000).toFixed(1)}M
            </div>
            <div className="text-xs text-white/40 mt-1">Torcedores estimados</div>
          </div>

          <div className="rounded-xl bg-[#141414] border border-white/5 p-4">
            <div className="flex items-center gap-2 text-xs text-white/40 font-medium tracking-wider">
              <Target className="h-4 w-4 text-purple-400" />
              ESTADIO
            </div>
            <div className="mt-2 text-xl font-bold text-white truncate">{userTeam.estadio_nome}</div>
            <div className="text-xs text-white/40 mt-1">{userTeam.estadio_cap.toLocaleString()} lugares</div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Titles */}
          <section className="rounded-xl bg-[#141414] border border-white/5 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5 bg-white/[0.02]">
              <Trophy className="h-4 w-4 text-yellow-400" />
              <h2 className="text-xs font-medium text-white tracking-wider">TITULOS</h2>
            </div>
            <div className="divide-y divide-white/5">
              {titles.map((title, index) => (
                <div key={index} className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors">
                  <div className="h-12 w-12 rounded-lg bg-yellow-400/20 flex items-center justify-center">
                    <title.icon className="h-6 w-6 text-yellow-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-white">{title.name}</div>
                    <div className="text-sm text-white/50">{title.year}</div>
                  </div>
                  <div className="text-2xl font-bold text-yellow-400">{title.year}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Legends */}
          <section className="rounded-xl bg-[#141414] border border-white/5 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5 bg-white/[0.02]">
              <Star className="h-4 w-4 text-[#1db954]" />
              <h2 className="text-xs font-medium text-white tracking-wider">LENDAS DO CLUBE</h2>
            </div>
            <div className="divide-y divide-white/5">
              {legends.map((legend, index) => (
                <div key={index} className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors">
                  <div className="h-12 w-12 rounded-lg bg-[#1a1a1a] flex items-center justify-center">
                    <span className="text-xl font-bold text-white/50">
                      {legend.name.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-white">{legend.name}</div>
                    <div className="text-sm text-white/50">{legend.position} - {legend.years}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-[#1db954]">{legend.goals}</div>
                    <div className="text-[10px] text-white/40 font-medium tracking-wider">GOLS</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Season History */}
        <section className="rounded-xl bg-[#141414] border border-white/5 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5 bg-white/[0.02]">
            <History className="h-4 w-4 text-blue-400" />
            <h2 className="text-xs font-medium text-white tracking-wider">HISTORICO DE TEMPORADAS</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 text-[10px] font-medium tracking-wider text-white/40">
                  <th className="px-5 py-3 text-left">ANO</th>
                  <th className="px-5 py-3 text-left">COMPETICAO</th>
                  <th className="px-5 py-3 text-center">POSICAO</th>
                  <th className="px-5 py-3 text-center">PONTOS</th>
                  <th className="px-5 py-3 text-left">TREINADOR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {seasonHistory.map((season) => (
                  <tr key={season.year} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 text-lg font-semibold text-white">{season.year}</td>
                    <td className="px-5 py-3 text-white/70">{season.competition}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={cn(
                        "inline-flex h-8 w-8 items-center justify-center rounded-lg font-bold",
                        season.position <= 4 ? "bg-[#1db954]/20 text-[#1db954]" :
                        season.position <= 12 ? "bg-blue-400/20 text-blue-400" :
                        season.position >= 17 ? "bg-red-400/20 text-red-400" :
                        "bg-white/10 text-white/60"
                      )}>
                        {season.position}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center text-lg font-semibold text-white">{season.points}</td>
                    <td className="px-5 py-3 text-white/50">{season.manager}</td>
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

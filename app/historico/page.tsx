"use client"

import { useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"

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
import { TeamCrest } from "@/components/team-crest"
import { getTeamByShort, serieATeams } from "@/lib/teams-data"
import { useUserTeam } from "@/lib/save-system"
import { cn } from "@/lib/utils"

// Gera dados históricos determinísticos baseados no time (sem Math.random)
function getTeamHistory(teamShort: string, teamName: string, prestige: number) {
  const hash = (s: string, seed: number) => {
    let h = seed
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
    return Math.abs(h)
  }

  const founded = 1900 + (hash(teamShort, 1) % 70) + 10
  const titleCount = Math.max(1, Math.round(prestige / 18))
  const seasons = new Date().getFullYear() - founded

  const titleNames = [
    "Campeonato Brasileiro", "Copa do Brasil", "Copa Libertadores",
    "Campeonato Estadual", "Supercopa do Brasil", "Recopa Sul-Americana",
    "Copa Sul-Americana", "Copa do Nordeste",
  ]
  const titles = Array.from({ length: Math.min(titleCount, 5) }, (_, i) => ({
    name: titleNames[hash(teamShort, i + 10) % titleNames.length],
    year: founded + 20 + (hash(teamShort, i + 20) % (seasons - 20)),
    icon: i < 2 ? Trophy : Medal,
  }))

  const firstNames = ["Carlos", "Roberto", "Paulo", "Felipe", "Lucas", "André", "Pedro", "Rafael"]
  const lastNames = ["Silva", "Santos", "Oliveira", "Costa", "Ferreira", "Souza", "Lima", "Pereira"]
  const positions = ["GOL", "ZAG", "VOL", "MEI", "ATA", "PD", "PE", "LD"]
  const legends = Array.from({ length: 4 }, (_, i) => {
    const fn = firstNames[hash(teamShort, i + 30) % firstNames.length]
    const ln = lastNames[hash(teamShort, i + 40) % lastNames.length]
    const startYear = founded + 30 + (hash(teamShort, i + 50) % 40)
    return {
      name: `${fn} ${ln}`,
      position: positions[hash(teamShort, i + 60) % positions.length],
      years: `${startYear}-${startYear + 3}`,
      goals: 15 + (hash(teamShort, i + 70) % 50),
    }
  })

  const managerNames = ["Dorival Jr.", "Renato Gaúcho", "Abel Ferreira", "Artur Jorge", "Tite", "Cuca"]
  const seasonHistory = Array.from({ length: 6 }, (_, i) => {
    const year = 2025 - i
    const pos = 1 + (hash(teamShort, year) % 20)
    const pts = 70 - pos * 2 + (hash(teamShort, year + 1) % 6)
    return {
      year,
      competition: "Serie A",
      position: pos,
      points: pts,
      manager: managerNames[hash(teamShort, year + 2) % managerNames.length],
    }
  })

  return { founded, seasons, titleCount: titles.length, titles, legends, seasonHistory }
}

export default function HistoricoPage() {
  const router = useRouter()
  const { team: userTeam } = useUserTeam()

  const history = useMemo(
    () => getTeamHistory(userTeam.curto, userTeam.nome, userTeam.prestigio),
    [userTeam]
  )

  useEffect(() => {
    const handler = (e: Event) => {
      const btn = (e as CustomEvent).detail?.button
      if (btn === "B") router.back()
    }
    window.addEventListener("gamepad:button", handler)
    return () => window.removeEventListener("gamepad:button", handler)
  }, [router])

  return (
    <div className="h-screen md:pl-0 pl-0 pb-20 md:pb-0 bg-[#050508] flex flex-col overflow-hidden">
      <GameSidebar />
      <GameHeader team={userTeam} />

      <main className="flex-1 p-4 overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-6">
          <div className="relative">
            <TeamCrest team={userTeam} size="2xl" />
            <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1a1a] border-2 border-[#00ffc8] text-xs font-bold text-[#00ffc8]">
              {userTeam.prestigio}
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">{userTeam.nome.toUpperCase()}</h1>
            <p className="text-white/50 mt-1">
              Fundado em {history.founded} · {history.seasons} anos de história
            </p>
            <div className="flex items-center gap-4 mt-3">
              <span className="flex items-center gap-1.5 text-sm text-white/70">
                <Trophy className="h-4 w-4 text-yellow-400" />
                {history.titleCount} títulos
              </span>
              <span className="flex items-center gap-1.5 text-sm text-white/70">
                <MapPin className="h-4 w-4 text-[#00ffc8]" />
                {userTeam.cidade}, {userTeam.estado}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-xs text-white/40 font-medium tracking-wider">
              <Calendar className="h-4 w-4 text-blue-400" />
              FUNDAÇÃO
            </div>
            <div className="mt-2 text-3xl font-bold text-white">{history.founded}</div>
            <div className="text-xs text-white/40 mt-1">{history.seasons} temporadas</div>
          </div>

          <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-xs text-white/40 font-medium tracking-wider">
              <Trophy className="h-4 w-4 text-yellow-400" />
              TÍTULOS
            </div>
            <div className="mt-2 text-3xl font-bold text-yellow-400">{history.titleCount}</div>
            <div className="text-xs text-white/40 mt-1">Conquistas na história</div>
          </div>

          <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-xs text-white/40 font-medium tracking-wider">
              <Users className="h-4 w-4 text-[#00ffc8]" />
              TORCIDA
            </div>
            <div className="mt-2 text-3xl font-bold text-[#00ffc8]">
              {(userTeam.torcida / 1000000).toFixed(1)}M
            </div>
            <div className="text-xs text-white/40 mt-1">Torcedores estimados</div>
          </div>

          <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-xs text-white/40 font-medium tracking-wider">
              <Target className="h-4 w-4 text-purple-400" />
              ESTÁDIO
            </div>
            <div className="mt-2 text-xl font-bold text-white truncate">{userTeam.estadio_nome}</div>
            <div className="text-xs text-white/40 mt-1">{userTeam.estadio_cap.toLocaleString()} lugares</div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Titles */}
          <section className="rounded-xl bg-[#0c0c10] border border-white/[0.04] overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.04] bg-white/[0.02]">
              <Trophy className="h-4 w-4 text-yellow-400" />
              <h2 className="text-xs font-medium text-white tracking-wider">TÍTULOS</h2>
            </div>
            <div className="divide-y divide-white/5">
              {history.titles.map((title, index) => (
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
          <section className="rounded-xl bg-[#0c0c10] border border-white/[0.04] overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.04] bg-white/[0.02]">
              <Star className="h-4 w-4 text-[#00ffc8]" />
              <h2 className="text-xs font-medium text-white tracking-wider">LENDAS DO CLUBE</h2>
            </div>
            <div className="divide-y divide-white/5">
              {history.legends.map((legend, index) => (
                <div key={index} className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors">
                  <div className="h-12 w-12 rounded-lg bg-[#1a1a1a] flex items-center justify-center">
                    <span className="text-xl font-bold text-white/50">{legend.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-white">{legend.name}</div>
                    <div className="text-sm text-white/50">{legend.position} · {legend.years}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-[#00ffc8]">{legend.goals}</div>
                    <div className="text-[10px] text-white/40 font-medium tracking-wider">GOLS</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Season History */}
        <section className="rounded-xl bg-[#0c0c10] border border-white/[0.04] overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.04] bg-white/[0.02]">
            <History className="h-4 w-4 text-blue-400" />
            <h2 className="text-xs font-medium text-white tracking-wider">HISTÓRICO DE TEMPORADAS</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.04] text-[10px] font-medium tracking-wider text-white/40">
                  <th className="px-5 py-3 text-left">ANO</th>
                  <th className="px-5 py-3 text-left">COMPETIÇÃO</th>
                  <th className="px-5 py-3 text-center">POSIÇÃO</th>
                  <th className="px-5 py-3 text-center">PONTOS</th>
                  <th className="px-5 py-3 text-left">TREINADOR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {history.seasonHistory.map((season) => (
                  <tr key={season.year} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 text-lg font-semibold text-white">{season.year}</td>
                    <td className="px-5 py-3 text-white/70">{season.competition}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={cn(
                        "inline-flex h-8 w-8 items-center justify-center rounded-lg font-bold",
                        season.position <= 4 ? "bg-[#00ffc8]/20 text-[#00ffc8]" :
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

    </div>
  )
}
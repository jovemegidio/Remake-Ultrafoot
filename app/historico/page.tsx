"use client"

import { useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Calendar, History, MapPin, Target, Trophy, Users } from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { TeamCrest } from "@/components/team-crest"
import { useGameState } from "@/lib/save-system"
import { useUserTeam } from "@/lib/time-da-carreira"
import { buildCareerStats } from "@/lib/hall-of-fame-engine"
import { cn } from "@/lib/utils"

export default function HistoricoPage() {
  const router = useRouter()
  const { team: userTeam } = useUserTeam()
  const { state } = useGameState()
  const temporadas = state.seasonHistory ?? []
  const carreira = useMemo(
    () => temporadas.length > 0 ? buildCareerStats(temporadas) : null,
    [temporadas],
  )

  useEffect(() => {
    const handler = (event: Event) => {
      if ((event as CustomEvent).detail?.button === "B") router.back()
    }
    window.addEventListener("gamepad:button", handler)
    return () => window.removeEventListener("gamepad:button", handler)
  }, [router])

  return (
    <div className="h-screen bg-[#050508] flex flex-col overflow-hidden pb-20 md:pb-0">
      <GameHeader team={userTeam} />
      <main className="flex-1 overflow-y-auto p-4 space-y-5">
        <header className="flex flex-wrap items-center gap-5 rounded-xl border border-white/[0.06] bg-[#0c0c10] p-5">
          <TeamCrest team={userTeam} size="2xl" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-3xl font-bold text-white">{userTeam.nome}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-white/50">
              <MapPin className="h-4 w-4 text-[var(--brand)]" />
              {[userTeam.cidade, userTeam.estado, userTeam.pais].filter(Boolean).join(", ")}
            </p>
          </div>
          <div className="rounded-lg bg-[var(--brand)]/10 px-4 py-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-white/40">Prestígio atual</p>
            <p className="text-2xl font-bold text-[var(--brand)]">{userTeam.prestigio}</p>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          <InfoCard icon={Users} label="Torcida cadastrada" value={userTeam.torcida.toLocaleString("pt-BR")} />
          <InfoCard icon={Target} label="Estádio" value={userTeam.estadio_nome || "Não cadastrado"} />
          <InfoCard icon={Users} label="Capacidade" value={userTeam.estadio_cap.toLocaleString("pt-BR")} />
        </section>

        <section className="rounded-xl border border-[#ffd700]/20 bg-[#ffd700]/[0.04] p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <Trophy className="h-5 w-5 text-[#ffd700]" />
            Carreira registrada
          </h2>
          {!carreira ? (
            <p className="mt-3 text-sm text-white/45">
              O histórico será preenchido ao concluir a primeira temporada. Nenhuma conquista anterior foi inventada.
            </p>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                {[
                  ["Temporadas", carreira.totalSeasons],
                  ["Partidas", carreira.totalMatches],
                  ["Vitórias", carreira.totalWins],
                  ["Aproveitamento", `${carreira.winRate}%`],
                  ["Títulos", carreira.trophies.length],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-black/30 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-white/40">{label}</p>
                    <p className="mt-1 text-xl font-bold text-white">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/60">Clubes treinados</p>
                  <div className="mt-2 space-y-2">
                    {carreira.clubs.map(club => (
                      <div key={club.clubCurto} className="flex items-center justify-between rounded-lg bg-black/25 px-3 py-2">
                        <span className="text-sm text-white">{club.clubNome}</span>
                        <span className="text-[11px] text-white/40">{club.fromSeason}–{club.toSeason} · {club.wins}/{club.matches} vitórias</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/60">Títulos conquistados</p>
                  {carreira.trophies.length === 0 ? (
                    <p className="mt-2 text-sm text-white/35">Nenhum título registrado.</p>
                  ) : carreira.trophies.map(trophy => (
                    <div key={`${trophy.competition}-${trophy.season}`} className="mt-2 flex items-center justify-between rounded-lg bg-black/25 px-3 py-2">
                      <span className="text-sm text-white">{trophy.competition}</span>
                      <span className="text-[11px] text-[#ffd700]">{trophy.season} · {trophy.clubNome}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-white/[0.04] bg-[#0c0c10]">
          <div className="flex items-center gap-2 border-b border-white/[0.04] px-5 py-3">
            <History className="h-4 w-4 text-blue-400" />
            <h2 className="text-xs font-medium tracking-wider text-white">TEMPORADAS CONCLUÍDAS</h2>
          </div>
          {temporadas.length === 0 ? (
            <div className="p-8 text-center text-sm text-white/40">Ainda não há temporadas concluídas nesta carreira.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-white/[0.04] text-[10px] text-white/40"><th className="px-5 py-3 text-left">ANO</th><th className="px-5 py-3 text-left">CLUBE</th><th className="px-5 py-3 text-left">COMPETIÇÃO</th><th className="px-5 py-3 text-center">POS.</th><th className="px-5 py-3 text-center">PONTOS</th><th className="px-5 py-3 text-center">CAMPANHA</th></tr></thead>
                <tbody className="divide-y divide-white/5">
                  {[...temporadas].reverse().map((season, index) => (
                    <tr key={`${season.season}-${season.competition}-${index}`} className="text-sm hover:bg-white/[0.02]">
                      <td className="px-5 py-3 font-semibold text-white">{season.season}</td>
                      <td className="px-5 py-3 text-white/70">{season.teamNome}</td>
                      <td className="px-5 py-3 text-white/70">{season.competition}</td>
                      <td className="px-5 py-3 text-center"><span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-lg font-bold", season.position === 1 ? "bg-yellow-400/20 text-yellow-400" : "bg-white/10 text-white/70")}>{season.position}</span></td>
                      <td className="px-5 py-3 text-center font-semibold text-white">{season.points}</td>
                      <td className="px-5 py-3 text-center text-white/50">{season.won}V · {season.drawn}E · {season.lost}D</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function InfoCard({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.04] bg-[#0c0c10] p-4">
      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-white/40"><Icon className="h-4 w-4 text-[var(--brand)]" />{label}</div>
      <p className="mt-2 truncate text-xl font-bold text-white">{value}</p>
    </div>
  )
}

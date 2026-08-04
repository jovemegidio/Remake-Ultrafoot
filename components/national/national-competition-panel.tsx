"use client"

// COMPETIÇÕES DA SELEÇÃO — painel da competição em disputa e a vitrine das que
// podem ser iniciadas. Vivia dentro de app/selecao/page.tsx; saiu para cá para a
// tela dedicada (/selecao/competicoes) e o hub mostrarem exatamente a mesma
// coisa, sem duas versões da tabela para manter.

import { Flag, Trophy, Check, X, Play, Crown, Star, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNationalTeam } from "@/lib/use-national-team"
import { periodoLabelPorNome } from "@/lib/competition-dates-2026"
import { getCompetitionDef, type NationalCompetitionDef } from "@/lib/national-competitions"
import { prepararPartidaDaSelecao } from "@/lib/partida-da-selecao"
import { hardNavigate } from "@/lib/hard-navigation"

export function NationalCompetitionPanel() {
  const { currentCompetition, userNextFixture, nationalTeam, playNextRound, finishCompetition } = useNationalTeam()
  if (!currentCompetition || !nationalTeam) return null

  const comp = currentCompetition
  const def = getCompetitionDef(comp.competitionId)
  const isActive = comp.status === "active"
  const statusBanner = (() => {
    switch (comp.status) {
      case "champion":
        return { label: comp.lastSummary || "Campeao!", tone: "bg-[var(--brand)]/15 text-[var(--brand)] border-[var(--brand)]/30", icon: Crown }
      case "qualified":
        return { label: comp.lastSummary || "Classificado!", tone: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: Check }
      case "eliminated":
        return { label: comp.lastSummary || "Eliminado", tone: "bg-red-500/10 text-red-400 border-red-500/20", icon: X }
      case "finished":
        return { label: comp.lastSummary || "Encerrada", tone: "bg-white/[0.05] text-white/60 border-white/10", icon: Flag }
      default:
        return null
    }
  })()

  return (
    <div className="rounded-xl bg-[#0c0c10] border border-white/[0.06] overflow-hidden">
      {/* Banner com tema da competicao */}
      <div
        className="relative h-32 sm:h-36 flex items-end p-5"
        style={
          def?.theme
            ? { backgroundImage: `url(${def.theme})`, backgroundSize: "cover", backgroundPosition: "center" }
            : undefined
        }
      >
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c10] via-[#0c0c10]/70 to-[#0c0c10]/20" />
        <div className="relative flex items-end justify-between w-full gap-3">
          <div className="flex items-center gap-3">
            <div
              className="h-11 w-11 rounded-lg flex items-center justify-center shrink-0 shadow-lg overflow-hidden"
              style={{ backgroundColor: def?.accent ?? "#00ffc8" }}
            >
              {def?.logo ? (
                <img
                  src={def.logo || "/placeholder.svg"}
                  alt={comp.competitionName}
                  className="h-full w-full object-contain p-1"
                />
              ) : (
                <Trophy className="h-5 w-5 text-white" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white drop-shadow">{comp.competitionName}</h3>
              <p className="text-xs text-white/70 drop-shadow">Temporada {comp.season} - {comp.stage}</p>
              {/* Periodo REAL da competicao (Copa do Mundo 11 jun – 19 jul 2026 etc.). */}
              {periodoLabelPorNome(comp.competitionName) && (
                <p className="mt-0.5 text-[11px] text-white/55 drop-shadow">📅 {periodoLabelPorNome(comp.competitionName)}</p>
              )}
            </div>
          </div>
          {comp.lastSummary && isActive && (
            <span className="hidden sm:block text-xs text-white/70 max-w-[40%] text-right drop-shadow">{comp.lastSummary}</span>
          )}
        </div>
      </div>

      <div className="p-5 space-y-5">
        {statusBanner && (
          <div className={cn("flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium", statusBanner.tone)}>
            <statusBanner.icon className="h-4 w-4 shrink-0" />
            {statusBanner.label}
          </div>
        )}

        {/* Tabela (grupos / liga) */}
        {comp.currentRound <= comp.totalGroupRounds + 0 && comp.table.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-white/[0.04]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/[0.03] text-white/40 text-[11px] uppercase tracking-wide">
                  <th className="text-left font-medium px-3 py-2">Selecao</th>
                  <th className="text-center font-medium px-2 py-2">J</th>
                  <th className="text-center font-medium px-2 py-2">V</th>
                  <th className="text-center font-medium px-2 py-2">E</th>
                  <th className="text-center font-medium px-2 py-2">D</th>
                  <th className="text-center font-medium px-2 py-2">SG</th>
                  <th className="text-center font-medium px-2 py-2">Pts</th>
                </tr>
              </thead>
              <tbody>
                {comp.table.map((row, idx) => (
                  <tr
                    key={row.teamId}
                    className={cn(
                      "border-t border-white/[0.03]",
                      row.isUser ? "bg-[var(--brand)]/[0.06]" : idx % 2 ? "bg-white/[0.01]" : "",
                    )}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-white/30 text-xs w-4">{idx + 1}</span>
                        <span className={cn("font-medium", row.isUser ? "text-[var(--brand)]" : "text-white/80")}>{row.teamName}</span>
                      </div>
                    </td>
                    <td className="text-center text-white/60 px-2 py-2">{row.played}</td>
                    <td className="text-center text-white/60 px-2 py-2">{row.won}</td>
                    <td className="text-center text-white/60 px-2 py-2">{row.drawn}</td>
                    <td className="text-center text-white/60 px-2 py-2">{row.lost}</td>
                    <td className="text-center text-white/60 px-2 py-2">{row.gf - row.ga}</td>
                    <td className="text-center font-semibold text-white px-2 py-2">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Jogos do usuario */}
        <div className="space-y-2">
          <p className="text-xs text-white/40 uppercase tracking-wide">Seus jogos</p>
          {comp.fixtures.filter(f => f.isUserMatch).map(f => {
            const userIsHome = f.homeId === nationalTeam.id
            const oppName = userIsHome ? f.awayName : f.homeName
            return (
              <div
                key={f.id}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm",
                  f.played ? "border-white/[0.04] bg-white/[0.02]" : "border-[var(--brand)]/20 bg-[var(--brand)]/[0.04]",
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] uppercase tracking-wide text-white/40 w-28 shrink-0">{f.stage}</span>
                  <span className="text-white/80 truncate">vs {oppName}</span>
                  {f.played && f.decidedOnPens && (
                    <span className="text-[10px] text-yellow-400">(pen)</span>
                  )}
                </div>
                {f.played ? (
                  <span className="font-semibold tabular-nums text-white">
                    {userIsHome ? f.homeScore : f.awayScore} x {userIsHome ? f.awayScore : f.homeScore}
                  </span>
                ) : (
                  <span className="text-xs text-white/30">a jogar</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Acoes */}
        {isActive && userNextFixture ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            {/* JOGAR de verdade: pre-jogo -> ao vivo -> coletiva -> escritorio,
                o mesmo fluxo do clube. Antes so existia a resolucao instantanea. */}
            <button
              onClick={() => {
                if (!nationalTeam || !currentCompetition) return
                hardNavigate(prepararPartidaDaSelecao(nationalTeam, userNextFixture, currentCompetition))
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--brand)] py-3 font-semibold text-[#050508] transition-colors hover:bg-[var(--brand)]/90"
            >
              <Play className="h-4 w-4" /> Jogar partida
            </button>
            {/* Simular continua disponivel para quem nao quer dirigir o jogo. */}
            <button
              onClick={() => playNextRound()}
              className="flex items-center justify-center gap-2 rounded-lg border border-white/15 px-4 py-3 font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              Simular rodada
            </button>
          </div>
        ) : !isActive ? (
          <button
            onClick={finishCompetition}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-white/[0.05] text-white/80 font-medium py-3 hover:bg-white/[0.1] transition-colors"
          >
            <Flag className="h-4 w-4" /> Encerrar competicao
          </button>
        ) : null}
      </div>
    </div>
  )
}

/** Vitrine das competições que a confederação da seleção oferece nesta temporada. */
export function NationalCompetitionList({
  competitions,
  completedThisSeason,
  onStart,
}: {
  competitions: NationalCompetitionDef[]
  completedThisSeason: string[]
  onStart: (competitionId: string) => void
}) {
  if (competitions.length === 0) {
    return (
      <p className="rounded-xl border border-white/[0.06] bg-[#0c0c10] p-6 text-center text-sm text-white/40">
        A confederação desta seleção ainda não tem competições cadastradas.
      </p>
    )
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {competitions.map(comp => {
        const done = completedThisSeason.includes(comp.id)
        return (
          <button
            key={comp.id}
            disabled={done}
            onClick={() => onStart(comp.id)}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl border p-4 text-left transition-all overflow-hidden min-h-[88px]",
              done
                ? "border-white/[0.04] opacity-50 cursor-not-allowed"
                : "border-white/[0.06] hover:border-white/20",
            )}
          >
            {/* Fundo tema */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${comp.theme})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
              aria-hidden
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0c0c10] via-[#0c0c10]/85 to-[#0c0c10]/55 group-hover:from-[#0c0c10] group-hover:via-[#0c0c10]/75 transition-colors" />
            <div
              className="relative h-10 w-10 rounded-lg flex items-center justify-center shrink-0 shadow-lg overflow-hidden"
              style={{ backgroundColor: comp.accent }}
            >
              {comp.logo ? (
                <img
                  src={comp.logo || "/placeholder.svg"}
                  alt={comp.name}
                  className="h-full w-full object-contain p-0.5"
                />
              ) : comp.kind === "title" ? (
                <Crown className="h-5 w-5 text-white" />
              ) : (
                <Star className="h-5 w-5 text-white" />
              )}
            </div>
            <div className="relative flex-1 min-w-0">
              <p className="font-semibold text-white drop-shadow">{comp.name}</p>
              <p className="text-xs text-white/60 drop-shadow">
                {comp.kind === "title" ? "Titulo" : "Classificatoria"} - Prestigio {comp.prestige}
                {done ? " - concluida" : ""}
              </p>
              {periodoLabelPorNome(comp.name) && (
                <p className="mt-0.5 text-[11px] text-white/45 drop-shadow">📅 {periodoLabelPorNome(comp.name)}</p>
              )}
            </div>
            {!done && <ChevronRight className="relative h-4 w-4 text-white/50" />}
          </button>
        )
      })}
    </div>
  )
}

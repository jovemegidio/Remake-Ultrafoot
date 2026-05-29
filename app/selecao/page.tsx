"use client"

import { useMemo, useState } from "react"
import {
  Flag,
  Trophy,
  Shield,
  Check,
  X,
  Play,
  Crown,
  Globe,
  Star,
  ChevronRight,
  Lock,
  Award,
  Users,
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { useUserTeam } from "@/lib/save-system"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useNationalTeam } from "@/lib/use-national-team"
import {
  getNationalSquad,
  getNationalStrength,
  getNationalTeamById,
  CONFEDERATION_LABEL,
  type NationalTeam,
} from "@/lib/national-teams"
import { getCompetitionsForConfederation, getCompetitionDef } from "@/lib/national-competitions"
import type { NationalOffer } from "@/lib/save-system"

function NationalCrest({ team, size = 48 }: { team: { code: string; cor1: string; cor2: string }; size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg font-bold text-white shadow-inner"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${team.cor1} 0%, ${team.cor2} 100%)`,
        fontSize: size * 0.3,
        textShadow: "0 1px 2px rgba(0,0,0,0.5)",
      }}
      aria-hidden
    >
      {team.code}
    </div>
  )
}

function strengthTone(strength: number): string {
  if (strength >= 85) return "text-[#00ffc8]"
  if (strength >= 75) return "text-emerald-400"
  if (strength >= 65) return "text-yellow-400"
  return "text-white/60"
}

// ---------------------------------------------------------
// PROPOSTAS
// ---------------------------------------------------------
function OfferCard({
  offer,
  onAccept,
  onDecline,
}: {
  offer: NationalOffer
  onAccept: () => void
  onDecline: () => void
}) {
  const nt = getNationalTeamById(offer.nationalTeamId)
  const comps = nt ? getCompetitionsForConfederation(nt.confederation) : []
  return (
    <div className="rounded-xl bg-[#0c0c10] border border-white/[0.06] p-5 flex flex-col gap-4">
      <div className="flex items-center gap-4">
        {nt && <NationalCrest team={nt} size={56} />}
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-white truncate">{offer.nationalTeamName}</h3>
          <p className="text-xs text-white/50">{CONFEDERATION_LABEL[offer.confederation as NationalTeam["confederation"]] ?? offer.confederation}</p>
        </div>
        <div className="ml-auto text-right">
          <p className={cn("text-2xl font-bold tabular-nums", strengthTone(offer.strength))}>{offer.strength}</p>
          <p className="text-[10px] uppercase tracking-wide text-white/40">Forca</p>
        </div>
      </div>

      <div>
        <p className="text-xs text-white/40 mb-2">Competicoes que voce disputaria:</p>
        <div className="flex flex-wrap gap-1.5">
          {comps.map(c => (
            <span key={c.id} className="text-[11px] px-2 py-1 rounded-md bg-white/[0.04] text-white/70 border border-white/[0.04]">
              {c.shortName}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-2 mt-1">
        <button
          onClick={onAccept}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#00ffc8] text-[#050508] font-semibold text-sm py-2.5 hover:bg-[#00ffc8]/90 transition-colors"
        >
          <Check className="h-4 w-4" /> Aceitar
        </button>
        <button
          onClick={onDecline}
          className="flex items-center justify-center gap-2 rounded-lg bg-white/[0.04] text-white/70 font-medium text-sm py-2.5 px-4 hover:bg-white/[0.08] transition-colors"
        >
          <X className="h-4 w-4" /> Recusar
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------
// COMPETICAO ATIVA
// ---------------------------------------------------------
function CompetitionPanel() {
  const { currentCompetition, userNextFixture, nationalTeam, playNextRound, finishCompetition } = useNationalTeam()
  if (!currentCompetition || !nationalTeam) return null

  const comp = currentCompetition
  const def = getCompetitionDef(comp.competitionId)
  const isActive = comp.status === "active"
  const statusBanner = (() => {
    switch (comp.status) {
      case "champion":
        return { label: comp.lastSummary || "Campeao!", tone: "bg-[#00ffc8]/15 text-[#00ffc8] border-[#00ffc8]/30", icon: Crown }
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
              className="h-11 w-11 rounded-lg flex items-center justify-center shrink-0 shadow-lg"
              style={{ backgroundColor: def?.accent ?? "#00ffc8" }}
            >
              <Trophy className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white drop-shadow">{comp.competitionName}</h3>
              <p className="text-xs text-white/70 drop-shadow">Temporada {comp.season} - {comp.stage}</p>
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
                    row.isUser ? "bg-[#00ffc8]/[0.06]" : idx % 2 ? "bg-white/[0.01]" : "",
                  )}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-white/30 text-xs w-4">{idx + 1}</span>
                      <span className={cn("font-medium", row.isUser ? "text-[#00ffc8]" : "text-white/80")}>{row.teamName}</span>
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
                f.played ? "border-white/[0.04] bg-white/[0.02]" : "border-[#00ffc8]/20 bg-[#00ffc8]/[0.04]",
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
        <button
          onClick={playNextRound}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#00ffc8] text-[#050508] font-semibold py-3 hover:bg-[#00ffc8]/90 transition-colors"
        >
          <Play className="h-4 w-4" /> Jogar proxima partida
        </button>
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

export default function SelecaoPage() {
  const { team: userTeam, hydrated: teamHydrated } = useUserTeam()
  const t = useTranslation()
  const {
    hydrated,
    eligible,
    coachScore,
    minScoreForOffers,
    offers,
    hasNationalTeam,
    nationalTeam,
    career,
    availableCompetitions,
    currentCompetition,
    acceptOffer,
    declineOffer,
    declineAll,
    leaveNationalTeam,
    startCompetition,
  } = useNationalTeam()

  const [confirmLeave, setConfirmLeave] = useState(false)

  const squad = useMemo(() => (nationalTeam ? getNationalSquad(nationalTeam) : []), [nationalTeam])
  const strength = useMemo(() => (nationalTeam ? getNationalStrength(nationalTeam) : 0), [nationalTeam])

  if (!hydrated || !teamHydrated) {
    return (
      <div className="h-screen bg-[#050508] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-[#00ffc8] border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-screen md:pl-16 pl-0 pb-20 md:pb-0 bg-[#050508] flex flex-col overflow-hidden">
      <GameSidebar />
      <GameHeader team={userTeam} />

      <main className="flex-1 p-4 overflow-y-auto scrollbar-premium space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-[#00ffc8]/10 flex items-center justify-center">
            <Flag className="h-5 w-5 text-[#00ffc8]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Selecao Nacional</h1>
            <p className="text-sm text-white/50">
              {hasNationalTeam
                ? `Voce comanda ${career.nationalTeamName} e segue no comando do ${userTeam.nome}.`
                : "Construa sua reputacao para receber convites de selecoes."}
            </p>
          </div>
        </div>

        {/* SEM SELECAO */}
        {!hasNationalTeam && (
          <>
            {offers.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Award className="h-5 w-5 text-[#00ffc8]" /> Propostas recebidas
                  </h2>
                  <button
                    onClick={declineAll}
                    className="text-xs text-white/50 hover:text-white/80 transition-colors"
                  >
                    Recusar todas
                  </button>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {offers.map(offer => (
                    <OfferCard
                      key={offer.nationalTeamId}
                      offer={offer}
                      onAccept={() => acceptOffer(offer)}
                      onDecline={() => declineOffer(offer.nationalTeamId)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-[#0c0c10] border border-white/[0.06] p-8 text-center space-y-4">
                <div className="mx-auto h-14 w-14 rounded-full bg-white/[0.04] flex items-center justify-center">
                  {eligible ? <Globe className="h-7 w-7 text-white/40" /> : <Lock className="h-7 w-7 text-white/40" />}
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-white">
                    {eligible ? "Nenhuma proposta no momento" : "Ganhe reputacao primeiro"}
                  </h2>
                  <p className="text-sm text-white/50 max-w-md mx-auto text-pretty">
                    {eligible
                      ? "As federacoes estao de olho no seu trabalho. Continue vencendo e novas propostas chegarao nas proximas temporadas."
                      : "Conquiste titulos com seu clube e aumente sua reputacao como treinador. Quando seu prestigio crescer, selecoes nacionais virao te procurar."}
                  </p>
                </div>
                <div className="max-w-xs mx-auto">
                  <div className="flex items-center justify-between text-xs text-white/40 mb-1">
                    <span>Reputacao</span>
                    <span>{coachScore} / {minScoreForOffers}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full bg-[#00ffc8] transition-all"
                      style={{ width: `${Math.min(100, (coachScore / minScoreForOffers) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* COM SELECAO */}
        {hasNationalTeam && nationalTeam && (
          <div className="space-y-4">
            {/* Cabecalho da selecao */}
            <div className="rounded-xl bg-[#0c0c10] border border-white/[0.06] p-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <NationalCrest team={nationalTeam} size={64} />
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-semibold text-white">{nationalTeam.name}</h2>
                  <p className="text-xs text-white/50">{CONFEDERATION_LABEL[nationalTeam.confederation]}</p>
                </div>
                <div className="grid grid-cols-4 gap-4 sm:gap-6">
                  <div className="text-center">
                    <p className={cn("text-xl font-bold tabular-nums", strengthTone(strength))}>{strength}</p>
                    <p className="text-[10px] uppercase tracking-wide text-white/40">Forca</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-white tabular-nums">{career.titles.length}</p>
                    <p className="text-[10px] uppercase tracking-wide text-white/40">Titulos</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-white tabular-nums">{career.matchesPlayed}</p>
                    <p className="text-[10px] uppercase tracking-wide text-white/40">Jogos</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-white tabular-nums">{career.wins}-{career.draws}-{career.losses}</p>
                    <p className="text-[10px] uppercase tracking-wide text-white/40">V-E-D</p>
                  </div>
                </div>
              </div>

              {career.titles.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {career.titles.map((titulo, i) => (
                    <span key={i} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-[#00ffc8]/10 text-[#00ffc8] border border-[#00ffc8]/20">
                      <Crown className="h-3 w-3" /> {titulo.competition} {titulo.season}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 flex justify-end">
                {confirmLeave ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/50">Deixar a selecao?</span>
                    <button
                      onClick={() => { leaveNationalTeam(); setConfirmLeave(false) }}
                      className="text-xs px-3 py-1.5 rounded-md bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => setConfirmLeave(false)}
                      className="text-xs px-3 py-1.5 rounded-md bg-white/[0.05] text-white/60 hover:bg-white/[0.1] transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmLeave(true)}
                    className="text-xs px-3 py-1.5 rounded-md bg-white/[0.04] text-white/50 hover:text-white/80 hover:bg-white/[0.08] transition-colors"
                  >
                    Deixar a selecao
                  </button>
                )}
              </div>
            </div>

            {/* Competicao ativa OU lista de competicoes */}
            {currentCompetition ? (
              <CompetitionPanel />
            ) : (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-[#00ffc8]" /> Competicoes disponiveis
                </h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {availableCompetitions.map(comp => {
                    const done = career.completedThisSeason.includes(comp.id)
                    return (
                      <button
                        key={comp.id}
                        disabled={done}
                        onClick={() => startCompetition(comp.id)}
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
                          className="relative h-10 w-10 rounded-lg flex items-center justify-center shrink-0 shadow-lg"
                          style={{ backgroundColor: comp.accent }}
                        >
                          {comp.kind === "title" ? <Crown className="h-5 w-5 text-white" /> : <Star className="h-5 w-5 text-white" />}
                        </div>
                        <div className="relative flex-1 min-w-0">
                          <p className="font-semibold text-white drop-shadow">{comp.name}</p>
                          <p className="text-xs text-white/60 drop-shadow">
                            {comp.kind === "title" ? "Titulo" : "Classificatoria"} - Prestigio {comp.prestige}
                            {done ? " - concluida" : ""}
                          </p>
                        </div>
                        {!done && <ChevronRight className="relative h-4 w-4 text-white/50" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Convocacao */}
            <div className="rounded-xl bg-[#0c0c10] border border-white/[0.06] p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-[#00ffc8]" />
                <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Convocacao ({squad.length})</h2>
                <span className="text-[11px] text-white/30 ml-1">jogadores que atuam em clubes do pais</span>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {squad.map((p, i) => (
                  <div key={`${p.nome}-${i}`} className="flex items-center gap-2 rounded-lg bg-white/[0.02] px-3 py-2">
                    <span className="text-[10px] font-medium text-[#00ffc8] w-8 shrink-0">{p.pos}</span>
                    <span className="text-sm text-white/80 truncate flex-1">{p.nome}</span>
                    <span className="text-xs text-white/40 tabular-nums">{p.base}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

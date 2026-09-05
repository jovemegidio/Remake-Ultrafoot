"use client"

import { useMemo, useState } from "react"
import { ChevronRight, Globe2, Trophy, X } from "lucide-react"
import { buildWorldCupSpectator } from "@/lib/world-cup-spectator"
import { getNationalTeamById } from "@/lib/national-teams"
import { NationalCrest } from "@/components/national/national-crest"
import { cn } from "@/lib/utils"

/**
 * Brasao da selecao no placar do Mundial.
 *
 * Ate aqui a Central do Mundial era so TEXTO: "Brasil 2 x 0 Escocia". Os escudos
 * das selecoes ja existiam (public/escudos/nations/<id>.png, resolvidos por
 * getNationalCrestUrl) e eram usados nas telas de selecao — so nao chegavam
 * nesta. NationalCrest cai sozinho num bloco com as cores do pais quando o
 * arquivo nao existe (Peru, Venezuela e Bolivia ainda nao tem PNG), entao
 * nenhuma partida fica com um quadrado quebrado.
 */
function Brasao({ id, code }: { id: string; code: string }) {
  const nt = getNationalTeamById(id)
  return (
    <NationalCrest
      team={{ id, code, cor1: nt?.cor1 ?? "#1b2733", cor2: nt?.cor2 ?? "#0b1219" }}
      size={26}
    />
  )
}

interface WorldCupCenterProps {
  open: boolean
  season: number
  hosts: string
  currentWeek: number
  fromWeek: number
  untilWeek: number
  onClose: () => void
  onAdvance: () => Promise<void>
}

export function WorldCupCenter({
  open,
  season,
  hosts,
  currentWeek,
  fromWeek,
  untilWeek,
  onClose,
  onAdvance,
}: WorldCupCenterProps) {
  const [advancing, setAdvancing] = useState(false)
  const stages = useMemo(() => buildWorldCupSpectator(season), [season])
  const stageIndex = Math.max(0, Math.min(stages.length - 1, currentWeek - fromWeek))
  const stage = stages[stageIndex]
  const featured = useMemo(() => {
    const priority = stage.matches.filter(match => match.homeId === "brasil" || match.awayId === "brasil")
    const remaining = stage.matches.filter(match => !priority.includes(match))
    return [...priority, ...remaining].slice(0, stageIndex < 3 ? 12 : 16)
  }, [stage, stageIndex])
  if (!open) return null

  const lastStep = currentWeek + 1 >= untilWeek
  const advance = async () => {
    if (advancing) return
    setAdvancing(true)
    try {
      await onAdvance()
      if (lastStep) onClose()
    } finally {
      setAdvancing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center uf-veu p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#080d13] shadow-[0_30px_120px_rgba(0,0,0,.75)]">
        <header className="relative overflow-hidden border-b border-white/10 px-6 py-5 md:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(245,190,44,.18),transparent_48%)]" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-2xl border border-amber-300/25 bg-amber-300/10">
                <Trophy className="h-7 w-7 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.22em] text-amber-300">
                  <Globe2 className="h-3.5 w-3.5" /> Central do Mundial
                </div>
                <h2 className="uf-heading mt-1 text-2xl font-black uppercase tracking-tight text-white">Copa do Mundo FIFA {season}</h2>
                <p className="mt-1 text-xs text-white/45">{hosts} · os campeonatos de clubes estão oficialmente pausados</p>
              </div>
            </div>
            <button onClick={onClose} className="rounded-xl border border-white/10 p-2 text-white/45 transition hover:bg-white/10 hover:text-white" aria-label="Fechar">
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="border-b border-white/[0.07] px-6 py-4 md:px-8">
          <div className="flex gap-2 overflow-x-auto">
            {stages.map(item => (
              <div
                key={item.index}
                className={cn(
                  "min-w-max rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider",
                  item.index < stageIndex && "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
                  item.index === stageIndex && "border-amber-300/35 bg-amber-300/10 text-amber-200",
                  item.index > stageIndex && "border-white/8 text-white/25",
                )}
              >
                {item.shortName}
              </div>
            ))}
          </div>
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto px-6 py-5 md:px-8">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.2em] text-white/35">Rodada acompanhada</p>
              <h3 className="mt-1 text-xl font-black text-white">{stage.name}</h3>
            </div>
            <span className="text-xs font-semibold text-white/35">{stage.matches.length} partidas</span>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {featured.map((match, index) => {
              const isBrazil = match.homeId === "brasil" || match.awayId === "brasil"
              return (
                <div key={`${match.homeId}-${match.awayId}-${index}`} className={cn(
                  "rounded-2xl border bg-white/[0.025] px-4 py-3",
                  isBrazil ? "border-amber-300/30 bg-amber-300/[0.055]" : "border-white/[0.07]",
                )}>
                  <div className="mb-2 flex justify-between text-[9px] font-bold uppercase tracking-wider text-white/30">
                    <span>{match.group ? `Grupo ${match.group}` : stage.shortName}</span>
                    {match.penalties ? <span>Pênaltis {match.penalties[0]}–{match.penalties[1]}</span> : <span>Encerrado</span>}
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <div className="flex min-w-0 items-center justify-end gap-2">
                      <div className="min-w-0 text-right">
                        <p className="truncate text-sm font-bold text-white">{match.home}</p>
                        <p className="text-[10px] font-black text-white/30">{match.homeCode}</p>
                      </div>
                      <Brasao id={match.homeId} code={match.homeCode} />
                    </div>
                    <div className="rounded-lg bg-black/45 px-3 py-1.5 font-mono text-lg font-black text-white">
                      {match.homeScore}<span className="px-1.5 text-white/25">:</span>{match.awayScore}
                    </div>
                    <div className="flex min-w-0 items-center gap-2">
                      <Brasao id={match.awayId} code={match.awayCode} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">{match.away}</p>
                        <p className="text-[10px] font-black text-white/30">{match.awayCode}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {stage.matches.length > featured.length && (
            <p className="mt-4 text-center text-xs text-white/30">Mais {stage.matches.length - featured.length} resultados processados nesta rodada.</p>
          )}
        </main>

        <footer className="flex flex-col gap-3 border-t border-white/10 bg-black/25 px-6 py-4 sm:flex-row sm:items-center sm:justify-between md:px-8">
          <p className="text-xs text-white/40">
            O próximo jogo do seu clube permanece bloqueado até o encerramento do Mundial.
          </p>
          <button
            onClick={advance}
            disabled={advancing}
            className="inline-flex min-w-56 items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 py-3 text-sm font-black text-[#171105] transition hover:brightness-110 disabled:opacity-50"
          >
            {advancing ? "Processando rodada…" : lastStep ? "Encerrar Mundial e voltar ao clube" : "Acompanhar próxima rodada"}
            {!advancing && <ChevronRight className="h-4 w-4" />}
          </button>
        </footer>
      </div>
    </div>
  )
}

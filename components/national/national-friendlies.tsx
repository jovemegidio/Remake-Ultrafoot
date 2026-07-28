"use client"

// AMISTOSOS DE PREPARAÇÃO da seleção.
//
// São simulados pela força dos dois lados — a mesma conta das partidas oficiais
// de seleção (que também não são jogadas ao vivo). Não contam para competição,
// não avançam a semana e usam a convocação salva: cortar um titular aqui aparece
// no placar. O ganho é de preparo (XP do técnico), como no jogo real de treinar
// o entrosamento antes da janela.

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search, Swords, Users, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { NationalCrest, strengthTone } from "@/components/national/national-crest"
import { useNationalTeam } from "@/lib/use-national-team"
import {
  getAllNationalTeams,
  getAllNationalStrengths,
  getNationalSquad,
  getNationalStrength,
  CONFEDERATION_LABEL,
  type Confederation,
  type NationalTeam,
} from "@/lib/national-teams"
import { useGameState } from "@/lib/save-system"

const CONFEDERACOES: Confederation[] = ["CONMEBOL", "UEFA", "CONCACAF", "AFC", "CAF", "OFC"]

function norm(s: string): string {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

export function NationalFriendlies({ nationalTeam }: { nationalTeam: NationalTeam }) {
  const { state } = useGameState()
  const { playNationalFriendly, nationalFriendlies } = useNationalTeam()
  const [busca, setBusca] = useState("")
  const [conf, setConf] = useState<Confederation | "TODAS">("TODAS")

  const forcas = useMemo(() => getAllNationalStrengths(), [])

  // Força da CONVOCAÇÃO atual — é ela que entra no amistoso, não um número solto.
  const forcaConvocada = useMemo(
    () =>
      getNationalStrength(
        nationalTeam,
        getNationalSquad(nationalTeam, { cuts: state.nationalCuts ?? [], calls: state.nationalCalls ?? [] }),
      ),
    [nationalTeam, state.nationalCuts, state.nationalCalls],
  )

  const adversarios = useMemo(() => {
    const q = norm(busca.trim())
    return getAllNationalTeams()
      .filter(n => n.id !== nationalTeam.id)
      .filter(n => conf === "TODAS" || n.confederation === conf)
      .filter(n => !q || norm(n.name).includes(q) || norm(n.code).includes(q))
      .sort((a, b) => (forcas[b.id] ?? 0) - (forcas[a.id] ?? 0))
  }, [nationalTeam.id, busca, conf, forcas])

  const retrospecto = useMemo(() => {
    let v = 0, e = 0, d = 0
    for (const f of nationalFriendlies) {
      if (f.userScore > f.oppScore) v++
      else if (f.userScore === f.oppScore) e++
      else d++
    }
    return { v, e, d }
  }, [nationalFriendlies])

  return (
    <div className="space-y-4">
      {/* Contexto: com que time você entra em campo */}
      <section className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl border border-white/[0.06] bg-[#0c0c10] p-5">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-white/40">Força da convocação</p>
          <p className={cn("text-2xl font-bold tabular-nums", strengthTone(forcaConvocada))}>{forcaConvocada}</p>
        </div>
        {nationalFriendlies.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-white/40">Amistosos recentes</p>
            <p className="text-2xl font-bold tabular-nums text-white">
              {retrospecto.v}-{retrospecto.e}-{retrospecto.d}
              <span className="ml-1.5 text-xs font-medium text-white/30">V-E-D</span>
            </p>
          </div>
        )}
        <Link
          href="/selecao/convocacao"
          className="ml-auto flex items-center gap-2 rounded-lg bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white/70 transition-colors hover:bg-white/[0.1]"
        >
          <Users className="h-3.5 w-3.5" /> Ajustar convocação
          <ChevronRight className="h-3.5 w-3.5 text-white/30" />
        </Link>
      </section>

      {/* Histórico */}
      {nationalFriendlies.length > 0 && (
        <section className="rounded-xl border border-white/[0.06] bg-[#0c0c10] p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/60">Últimos resultados</h3>
          <div className="space-y-1.5">
            {nationalFriendlies.map((f, i) => {
              const r = f.userScore > f.oppScore ? "V" : f.userScore < f.oppScore ? "D" : "E"
              return (
                <div key={`${f.opponentId}-${i}`} className="flex items-center gap-3 rounded-lg bg-black/25 px-3 py-2">
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px] font-black",
                      r === "V" ? "bg-[#00ffc8]/20 text-[#00ffc8]" : r === "D" ? "bg-red-400/20 text-red-300" : "bg-white/10 text-white/60",
                    )}
                  >
                    {r}
                  </span>
                  <span className="w-14 shrink-0 font-mono text-sm text-white">{f.userScore} x {f.oppScore}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-white/70">{f.opponentName}</span>
                  <span className="shrink-0 text-[10px] text-white/30">Temporada {f.season}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Escolha do adversário */}
      <section className="rounded-xl border border-white/[0.06] bg-[#0c0c10] p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/60">Marcar amistoso</h3>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3">
            <Search className="h-4 w-4 shrink-0 text-white/30" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar seleção..."
              className="w-full bg-transparent py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["TODAS", ...CONFEDERACOES] as const).map(c => (
              <button
                key={c}
                onClick={() => setConf(c)}
                className={cn(
                  "rounded-lg border px-2.5 py-2 text-[11px] font-semibold transition-colors",
                  conf === c
                    ? "border-[#00ffc8]/40 bg-[#00ffc8]/15 text-[#00ffc8]"
                    : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.07]",
                )}
                title={c === "TODAS" ? "Todas as confederações" : CONFEDERATION_LABEL[c]}
              >
                {c === "TODAS" ? "Todas" : c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {adversarios.map(n => {
            const forca = forcas[n.id] ?? 0
            return (
              <button
                key={n.id}
                onClick={() => playNationalFriendly(n.id)}
                className="group flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 text-left transition-all hover:border-[#00ffc8]/40 hover:bg-white/[0.06]"
              >
                <NationalCrest team={n} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{n.name}</p>
                  <p className="truncate text-[11px] text-white/40">{n.confederation}</p>
                </div>
                <span className={cn("shrink-0 text-sm font-bold tabular-nums", strengthTone(forca))}>{forca}</span>
                <Swords className="h-4 w-4 shrink-0 text-white/20 transition-colors group-hover:text-[#00ffc8]" />
              </button>
            )
          })}
          {adversarios.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-white/40">Nenhuma seleção encontrada.</p>
          )}
        </div>

        <p className="mt-3 text-[11px] text-white/35">
          O amistoso é simulado na hora, não conta para nenhuma competição e não avança a semana. Serve para testar a
          convocação e ganhar preparo antes da janela FIFA.
        </p>
      </section>
    </div>
  )
}

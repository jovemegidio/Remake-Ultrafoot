"use client"

// CONVOCAÇÃO da seleção — a lista de 23 que o motor usa de verdade.
//
// Não é uma tela decorativa: `getNationalSquad` (mesma função chamada por
// `playNextRound` e pelos amistosos) é quem monta a lista, e os cortes/chamadas
// daqui são os `nationalCuts`/`nationalCalls` do save. Ou seja: o que você
// convoca aqui é o time que entra em campo, e a força exibida é a força que a
// simulação vai usar.
//
// A regra automática (cotas por setor, elegíveis = atletas em clubes do país)
// vem de lib/national-teams — a tela LÊ a regra em vez de repeti-la, para não
// existir uma "convocação da UI" divergente da convocação do jogo.

import { useMemo, useState } from "react"
import { Plus, X, Search, RotateCcw, TriangleAlert, Info, Users } from "lucide-react"
import { useGameState } from "@/lib/save-system"
import { PlayerAvatar } from "@/components/player-avatar"
import { cn } from "@/lib/utils"
import {
  getNationalSquad,
  getNationalPlayerPool,
  getNationalStrength,
  nationalPlayerKey,
  nationalSector,
  NATIONAL_SQUAD_QUOTAS,
  NATIONAL_SQUAD_SIZE,
  NATIONAL_SECTOR_LABEL,
  type NationalSector,
  type NationalTeam,
} from "@/lib/national-teams"
import type { Player } from "@/lib/players-data"

const SECTORS: NationalSector[] = ["GOL", "DEF", "MEI", "ATA"]

function norm(s: string): string {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

/** Por que este atleta está na lista. Deriva do próprio elenco — nada inventado. */
function criterioDaChamada(
  p: Player,
  ctx: { calls: Set<string>; melhorDaPosicao: Set<string>; titulares: Set<string> },
): { label: string; tone: string } | null {
  const key = nationalPlayerKey(p)
  if (ctx.calls.has(key)) return { label: "Escolha do técnico", tone: "bg-[#00ffc8]/15 text-[#00ffc8]" }
  if (ctx.melhorDaPosicao.has(key)) return { label: "Melhor da posição", tone: "bg-amber-400/15 text-amber-300" }
  if (ctx.titulares.has(key)) return { label: "Titular", tone: "bg-white/10 text-white/70" }
  if (p.idade <= 21) return { label: "Jovem", tone: "bg-sky-400/15 text-sky-300" }
  if (p.idade >= 33) return { label: "Experiência", tone: "bg-violet-400/15 text-violet-300" }
  return null
}

export function NationalSquadManager({ nationalTeam }: { nationalTeam: NationalTeam }) {
  const { state, setState } = useGameState()
  const cuts = useMemo(() => state.nationalCuts ?? [], [state.nationalCuts])
  const calls = useMemo(() => state.nationalCalls ?? [], [state.nationalCalls])

  const [busca, setBusca] = useState("")
  const [filtro, setFiltro] = useState<NationalSector | "TODOS">("TODOS")
  const [verCriterios, setVerCriterios] = useState(false)

  const squad = useMemo(
    () => getNationalSquad(nationalTeam, { cuts, calls }),
    [nationalTeam, cuts, calls],
  )
  const pool = useMemo(() => getNationalPlayerPool(nationalTeam), [nationalTeam])

  // Força da LISTA ATUAL contra a força da convocação automática: mostra, em
  // número, o preço (ou o ganho) de cada corte. É a mesma conta da simulação.
  const forcaAtual = useMemo(() => getNationalStrength(nationalTeam, squad), [nationalTeam, squad])
  const forcaAutomatica = useMemo(
    () => getNationalStrength(nationalTeam, getNationalSquad(nationalTeam)),
    [nationalTeam],
  )
  const delta = forcaAtual - forcaAutomatica

  const contagem = useMemo(() => {
    const c: Record<NationalSector, number> = { GOL: 0, DEF: 0, MEI: 0, ATA: 0 }
    for (const p of squad) c[nationalSector(p.pos)]++
    return c
  }, [squad])

  const callsSet = useMemo(() => new Set(calls), [calls])
  const cutsSet = useMemo(() => new Set(cuts), [cuts])

  const contexto = useMemo(() => {
    // Melhor de cada posição no POOL inteiro (inclusive quem está cortado — se o
    // melhor lateral está fora, ninguém herda o selo).
    const melhor = new Map<string, { key: string; base: number }>()
    for (const p of pool) {
      const atual = melhor.get(p.pos)
      if (!atual || p.base > atual.base) melhor.set(p.pos, { key: nationalPlayerKey(p), base: p.base })
    }
    const titulares = new Set(
      [...squad].sort((a, b) => b.base - a.base).slice(0, 11).map(nationalPlayerKey),
    )
    return {
      calls: callsSet,
      melhorDaPosicao: new Set([...melhor.values()].map(v => v.key)),
      titulares,
    }
  }, [pool, squad, callsSet])

  const elegiveis = useMemo(() => {
    const naLista = new Set(squad.map(nationalPlayerKey))
    const q = norm(busca.trim())
    return pool
      .filter(p => !naLista.has(nationalPlayerKey(p)))
      .filter(p => filtro === "TODOS" || nationalSector(p.pos) === filtro)
      .filter(p => !q || norm(p.nome).includes(q) || norm(p.time ?? "").includes(q))
      .sort((a, b) => b.base - a.base)
      .slice(0, 60)
  }, [pool, squad, busca, filtro])

  const cortar = (p: Player) => {
    const key = nationalPlayerKey(p)
    setState({
      nationalCuts: [...cuts.filter(k => k !== key), key],
      nationalCalls: calls.filter(k => k !== key),
    })
  }
  const convocar = (p: Player) => {
    const key = nationalPlayerKey(p)
    setState({
      nationalCalls: [...calls.filter(k => k !== key), key],
      nationalCuts: cuts.filter(k => k !== key),
    })
  }
  const restaurarAutomatica = () => setState({ nationalCuts: [], nationalCalls: [] })

  const alertas: string[] = []
  for (const s of SECTORS) {
    if (contagem[s] < NATIONAL_SQUAD_QUOTAS[s]) {
      alertas.push(`${NATIONAL_SECTOR_LABEL[s]}: ${contagem[s]} de ${NATIONAL_SQUAD_QUOTAS[s]} — a cota do setor não fechou.`)
    }
  }
  if (squad.length < NATIONAL_SQUAD_SIZE) {
    alertas.push(`A lista tem ${squad.length} atletas; o regulamento pede ${NATIONAL_SQUAD_SIZE}. Faltam elegíveis no país.`)
  }
  const temIntervencao = cuts.length > 0 || calls.length > 0

  return (
    <div className="space-y-4">
      {/* Resumo: o que a lista vale e como ela está distribuída */}
      <section className="rounded-xl border border-white/[0.06] bg-[#0c0c10] p-5">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-white/40">Convocados</p>
            <p className="text-2xl font-bold tabular-nums text-white">
              {squad.length}
              <span className="text-base font-medium text-white/30">/{NATIONAL_SQUAD_SIZE}</span>
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-white/40">Força da lista</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold tabular-nums text-[#00ffc8]">{forcaAtual}</p>
              {delta !== 0 && (
                <span
                  className={cn(
                    "text-xs font-semibold tabular-nums",
                    delta > 0 ? "text-emerald-400" : "text-red-400",
                  )}
                >
                  {delta > 0 ? "+" : ""}{delta} vs automática
                </span>
              )}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setVerCriterios(v => !v)}
              className="flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white/70 transition-colors hover:bg-white/[0.1]"
            >
              <Info className="h-3.5 w-3.5" /> Critérios de chamada
            </button>
            <button
              onClick={restaurarAutomatica}
              disabled={!temIntervencao}
              className="flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white/70 transition-colors hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Convocação automática
            </button>
          </div>
        </div>

        {/* Cotas por setor */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SECTORS.map(s => {
            const falta = contagem[s] < NATIONAL_SQUAD_QUOTAS[s]
            return (
              <div
                key={s}
                className={cn(
                  "rounded-lg border px-3 py-2",
                  falta ? "border-amber-400/30 bg-amber-400/[0.06]" : "border-white/[0.05] bg-white/[0.02]",
                )}
              >
                <p className="text-[10px] uppercase tracking-wide text-white/40">{NATIONAL_SECTOR_LABEL[s]}</p>
                <p className={cn("text-sm font-bold tabular-nums", falta ? "text-amber-300" : "text-white")}>
                  {contagem[s]}<span className="text-white/30">/{NATIONAL_SQUAD_QUOTAS[s]}</span>
                </p>
              </div>
            )
          })}
        </div>

        {alertas.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {alertas.map(a => (
              <p key={a} className="flex items-start gap-2 text-xs text-amber-300/90">
                <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" /> {a}
              </p>
            ))}
          </div>
        )}

        {verCriterios && (
          <div className="mt-4 space-y-2 rounded-lg border border-white/[0.06] bg-black/25 p-4 text-xs text-white/60">
            <p className="font-semibold text-white/80">Como a convocação automática é montada</p>
            <p>
              • <span className="text-white/80">Elegíveis:</span> atletas que atuam em clubes de {nationalTeam.name}
              {" "}— {pool.length} no total nesta temporada.
            </p>
            <p>
              • <span className="text-white/80">Cotas:</span> {NATIONAL_SQUAD_QUOTAS.GOL} goleiros,{" "}
              {NATIONAL_SQUAD_QUOTAS.DEF} defensores, {NATIONAL_SQUAD_QUOTAS.MEI} meio-campistas e{" "}
              {NATIONAL_SQUAD_QUOTAS.ATA} atacantes, preenchidas pelo maior overall de cada setor.
            </p>
            <p>
              • <span className="text-white/80">Suas intervenções mandam:</span> quem você convoca a dedo entra
              primeiro, antes da cota; quem você corta libera a vaga para o próximo melhor do setor.
            </p>
            <p>
              • <span className="text-white/80">Força:</span> média dos 11 melhores da lista, ancorada no patamar
              histórico da seleção. É o número que a simulação das partidas usa.
            </p>
            <p className="pt-1 text-white/45">
              A lista fica salva no jogo: vale para as competições, as eliminatórias e os amistosos até você mudá-la.
            </p>
          </div>
        )}
      </section>

      {/* Lista convocada, por setor */}
      <section className="space-y-3">
        {SECTORS.map(s => {
          const doSetor = squad.filter(p => nationalSector(p.pos) === s)
          if (doSetor.length === 0) return null
          return (
            <div key={s} className="rounded-xl border border-white/[0.06] bg-[#0c0c10] p-4">
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-[#00ffc8]" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  {NATIONAL_SECTOR_LABEL[s]}
                </h3>
                <span className="text-xs tabular-nums text-white/30">
                  {doSetor.length}/{NATIONAL_SQUAD_QUOTAS[s]}
                </span>
              </div>
              <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
                {doSetor.map((p, i) => {
                  const criterio = criterioDaChamada(p, contexto)
                  return (
                    <div
                      key={`${nationalPlayerKey(p)}-${i}`}
                      className="flex items-center gap-2.5 rounded-lg bg-white/[0.02] px-2.5 py-2"
                    >
                      <PlayerAvatar name={p.nome} size="xs" position={p.pos} teamColor={nationalTeam.cor1} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium text-white/90">{p.nome}</span>
                          {criterio && (
                            <span className={cn("shrink-0 rounded px-1.5 py-px text-[9px] font-semibold uppercase", criterio.tone)}>
                              {criterio.label}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-[11px] text-white/40">
                          {p.pos} · {p.idade} anos · {p.time}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-bold tabular-nums text-white/70">{p.base}</span>
                      <button
                        onClick={() => cortar(p)}
                        title={`Cortar ${p.nome} da convocação`}
                        aria-label={`Cortar ${p.nome} da convocação`}
                        className="shrink-0 rounded p-1 text-white/25 transition-colors hover:bg-red-500/15 hover:text-red-300"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </section>

      {/* Elegíveis fora da lista */}
      <section className="rounded-xl border border-white/[0.06] bg-[#0c0c10] p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/60">
          Elegíveis fora da convocação
        </h3>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3">
            <Search className="h-4 w-4 shrink-0 text-white/30" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por nome ou clube..."
              className="w-full bg-transparent py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
            />
          </div>
          <div className="flex gap-1.5">
            {(["TODOS", ...SECTORS] as const).map(f => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={cn(
                  "rounded-lg border px-2.5 py-2 text-[11px] font-semibold transition-colors",
                  filtro === f
                    ? "border-[#00ffc8]/40 bg-[#00ffc8]/15 text-[#00ffc8]"
                    : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.07]",
                )}
              >
                {f === "TODOS" ? "Todos" : f}
              </button>
            ))}
          </div>
        </div>

        <div className="grid max-h-[420px] gap-1.5 overflow-y-auto pr-1 scrollbar-thin md:grid-cols-2 xl:grid-cols-3">
          {elegiveis.map((p, i) => {
            const cortado = cutsSet.has(nationalPlayerKey(p))
            return (
              <div
                key={`${nationalPlayerKey(p)}-pool-${i}`}
                className="flex items-center gap-2.5 rounded-lg bg-white/[0.02] px-2.5 py-2"
              >
                <PlayerAvatar name={p.nome} size="xs" position={p.pos} teamColor={nationalTeam.cor2} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm text-white/75">{p.nome}</span>
                    {cortado && (
                      <span className="shrink-0 rounded bg-red-400/15 px-1.5 py-px text-[9px] font-semibold uppercase text-red-300">
                        cortado
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[11px] text-white/35">
                    {p.pos} · {p.idade} anos · {p.time}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums text-white/50">{p.base}</span>
                <button
                  onClick={() => convocar(p)}
                  title={cortado ? `Desfazer o corte de ${p.nome}` : `Convocar ${p.nome}`}
                  aria-label={cortado ? `Desfazer o corte de ${p.nome}` : `Convocar ${p.nome}`}
                  className="shrink-0 rounded p-1 text-[#00ffc8]/60 transition-colors hover:bg-[#00ffc8]/15 hover:text-[#00ffc8]"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
          {elegiveis.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-white/40">
              {pool.length <= squad.length
                ? `Todos os ${pool.length} elegíveis de ${nationalTeam.name} já estão na lista — não há reserva para chamar.`
                : "Nenhum atleta elegível encontrado com esse filtro."}
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

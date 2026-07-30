"use client"

// REDE MUNDIAL DE TRANSFERENCIAS — quem esta livre ou de saida.
//
// Antes esta aba era uma segunda vitrine do catalogo inteiro (53 mil atletas
// paginados), exatamente o que a aba "Buscar Atletas" ja faz — e por isso a
// duplicidade nunca teve utilidade propria. A pedido do usuario ela passa a ser
// a tela de quem da para levar por pouco (ou de graca):
//
//   • SEM CLUBE      — contrato venceu e ninguem renovou: chega sem taxa de
//                      transferencia e pode entrar fora da janela (o motor ja
//                      trata isso em buyPlayer(..., isFreeAgent = true)).
//   • FIM DE CONTRATO — ultima temporada de vinculo. Ainda custa, mas o clube
//                      cede mais barato, e no ano que vem sai livre.
//   • OBSERVADOS      — a lista que voce marcou para acompanhar.
//
// A situacao contratual vem de lib/mercado-livre (derivada e estavel na
// temporada), nao de um sorteio a cada render.

import { useMemo, useState } from "react"
import { Eye, EyeOff, Handshake, Search, Timer, UserX, Users } from "lucide-react"
import { TeamCrest } from "@/components/team-crest"
import { PlayerAvatar } from "@/components/player-avatar"
import { formatCurrency, type Team } from "@/lib/teams-data"
import { hasDeparted } from "@/lib/departed-players"
import { normalizePosition } from "@/lib/formations"
import type { DetailedMarketTarget } from "@/lib/transfer-engine"
import {
  alternarObservado,
  getObservados,
  situacaoContratual,
  temporadasRestantes,
} from "@/lib/mercado-livre"
import { cn } from "@/lib/utils"

type Aba = "sem_clube" | "fim_de_contrato" | "observados"

const SETORES: Record<string, string[]> = {
  Ata: ["ATA", "PD", "PE"],
  Mei: ["MEI", "VOL", "MD", "ME"],
  Def: ["ZAG", "LD", "LE", "GOL"],
}

const LIMITE_POR_ABA = 300

function normalizar(s: string): string {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

export function RedeMundial({
  catalogo,
  userTeam,
  temporada,
  onNegociar,
  onContratarLivre,
}: {
  /** Catalogo completo do mercado, ja gerado pela pagina. */
  catalogo: DetailedMarketTarget[]
  userTeam: Team
  temporada: number
  /** Negociacao normal (atleta com contrato em vigor). */
  onNegociar: (player: DetailedMarketTarget, tipo: "buy" | "loan") => void
  /** Contratacao sem taxa: o atleta esta sem clube. */
  onContratarLivre: (player: DetailedMarketTarget) => void
}) {
  const [aba, setAba] = useState<Aba>("sem_clube")
  const [busca, setBusca] = useState("")
  const [setor, setSetor] = useState<"Tudo" | "Ata" | "Mei" | "Def">("Tudo")
  const [observados, setObservados] = useState<number[]>(() => getObservados())

  // Uma passada no catalogo por temporada: classifica e corta nos melhores de
  // cada grupo (o catalogo ja vem ordenado por overall).
  const grupos = useMemo(() => {
    const livres: DetailedMarketTarget[] = []
    const fim: DetailedMarketTarget[] = []
    for (const p of catalogo) {
      if (p.team?.nome && hasDeparted(p.team.nome, p.name)) continue
      const s = situacaoContratual(p, temporada)
      if (s === "sem_clube") { if (livres.length < LIMITE_POR_ABA) livres.push(p) }
      else if (s === "fim_de_contrato") { if (fim.length < LIMITE_POR_ABA) fim.push(p) }
      if (livres.length >= LIMITE_POR_ABA && fim.length >= LIMITE_POR_ABA) break
    }
    return { livres, fim }
  }, [catalogo, temporada])

  const observadosDetalhe = useMemo(() => {
    if (observados.length === 0) return []
    const ids = new Set(observados)
    return catalogo.filter(p => ids.has(p.id))
  }, [catalogo, observados])

  const lista = useMemo(() => {
    const base =
      aba === "sem_clube" ? grupos.livres : aba === "fim_de_contrato" ? grupos.fim : observadosDetalhe
    const q = normalizar(busca.trim())
    return base.filter(p => {
      if (q && !normalizar(p.name).includes(q) && !normalizar(p.team?.nome ?? "").includes(q)) return false
      if (setor !== "Tudo") {
        const alvo = SETORES[setor]
        const posicoes = [p.position, ...(p.secondaryPositions ?? [])].map(normalizePosition)
        if (!posicoes.some(pos => alvo.includes(pos))) return false
      }
      return true
    })
  }, [aba, grupos, observadosDetalhe, busca, setor])

  const abas: { id: Aba; label: string; icon: typeof UserX; total: number }[] = [
    { id: "sem_clube", label: "Sem clube", icon: UserX, total: grupos.livres.length },
    { id: "fim_de_contrato", label: "Fim de contrato", icon: Timer, total: grupos.fim.length },
    { id: "observados", label: "Observados", icon: Eye, total: observados.length },
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="shrink-0 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold leading-tight text-white">Rede Mundial de Transferências</h2>
          <p className="text-sm text-white/45">Atletas sem clube e em fim de contrato — contrate ou deixe na mira.</p>
          <div className="ml-auto flex items-center gap-3">
            <TeamCrest team={userTeam} size="sm" />
            <span className="hidden text-sm font-medium text-white sm:inline">{userTeam.nome}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {abas.map(({ id, label, icon: Icon, total }) => (
            <button
              key={id}
              type="button"
              onClick={() => setAba(id)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                aba === id
                  ? "border-[var(--brand)]/40 bg-[var(--brand)]/15 text-[var(--brand)]"
                  : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.07]",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              <span className={cn("rounded px-1.5 py-0.5 text-[10px] tabular-nums", aba === id ? "bg-[var(--brand)]/20" : "bg-white/[0.06]")}>
                {total}
              </span>
            </button>
          ))}

          <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3">
            <Search className="h-4 w-4 shrink-0 text-white/30" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar atleta ou clube..."
              className="w-full bg-transparent py-2 text-sm text-white placeholder:text-white/30 focus:outline-none"
            />
          </div>

          <div className="flex gap-1.5">
            {(["Tudo", "Ata", "Mei", "Def"] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setSetor(s)}
                className={cn(
                  "rounded-lg border px-2.5 py-2 text-[11px] font-semibold transition-colors",
                  setor === s
                    ? "border-white/25 bg-white/10 text-white"
                    : "border-white/10 bg-white/[0.03] text-white/45 hover:bg-white/[0.07]",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto pr-1">
        {lista.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-[#0c0c10]/70 p-10 text-center backdrop-blur-sm">
            <Users className="h-12 w-12 text-white/10" />
            <p className="mt-4 text-white/60">
              {aba === "observados"
                ? "Você ainda não marcou nenhum atleta."
                : "Nenhum atleta nesta situação com os filtros atuais."}
            </p>
            <p className="mt-2 max-w-md text-sm text-white/35">
              {aba === "observados"
                ? "Use o olho ao lado de um atleta para acompanhá-lo aqui — a lista fica salva na carreira."
                : "Limpe a busca ou troque o setor. A situação contratual muda a cada virada de temporada."}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {lista.map(p => {
              const situacao = situacaoContratual(p, temporada)
              const livre = situacao === "sem_clube"
              const restantes = temporadasRestantes(p.id, temporada)
              const observado = observados.includes(p.id)
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-[#0c0c10]/75 px-3 py-2.5 backdrop-blur-sm transition-colors hover:border-white/[0.12] hover:bg-[#0c0c10]/95"
                >
                  <PlayerAvatar name={p.name} teamColor={p.team?.cor1} size="sm" />

                  <div className="min-w-0 flex-[1.3]">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-white">{p.name}</p>
                      {livre ? (
                        <span className="shrink-0 rounded bg-[var(--brand)]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--brand)]">
                          Livre
                        </span>
                      ) : (
                        <span className="shrink-0 rounded bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
                          Último ano
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-white/40">
                      {p.position} · {p.age} anos · OVR {p.overall} · {p.nationality}
                    </p>
                  </div>

                  <div className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
                    {livre ? (
                      <span className="truncate text-xs text-white/40">
                        Sem clube · último: {p.team?.nome ?? "—"}
                      </span>
                    ) : (
                      <>
                        <TeamCrest team={p.team as unknown as Team} size="xs" />
                        <span className="truncate text-xs text-white/60">{p.team?.nome}</span>
                      </>
                    )}
                  </div>

                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="text-sm font-bold tabular-nums text-white">
                      {livre ? "Sem taxa" : formatCurrency(p.value)}
                    </p>
                    <p className="text-[10px] text-white/35">
                      {livre ? "só salário" : restantes <= 1 ? "sai livre na próxima" : `${restantes} temporadas`}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setObservados(alternarObservado(p.id))}
                      title={observado ? "Deixar de observar" : "Observar"}
                      aria-label={observado ? "Deixar de observar" : "Observar"}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
                        observado
                          ? "border-[var(--brand)]/40 bg-[var(--brand)]/15 text-[var(--brand)]"
                          : "border-white/10 bg-white/[0.03] text-white/40 hover:bg-white/[0.08] hover:text-white/70",
                      )}
                    >
                      {observado ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => (livre ? onContratarLivre(p) : onNegociar(p, "buy"))}
                      className="flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-xs font-bold text-[var(--brand-ink)] transition-all hover:brightness-110"
                    >
                      <Handshake className="h-3.5 w-3.5" />
                      Contratar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

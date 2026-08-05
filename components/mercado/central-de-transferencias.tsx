"use client"

// CENTRAL DE TRANSFERENCIAS — o que os OUTROS clubes estao fazendo.
//
// Antes esta aba mostrava o proprio 11 titular do usuario num campinho: um
// planejador de elenco com o nome de "central de transferencias", e nenhum lugar
// no jogo para acompanhar o mercado alheio (pedido do usuario).
//
// A fonte e o diario do mercado mundial (lib/world-market): a IA negocia entre
// si a cada quinzena de janela aberta e na virada da temporada, e cada negocio
// fica registrado com temporada e semana. Nada aqui e decorativo — o atleta que
// aparece nesta lista saiu MESMO do elenco de origem e entrou no de destino.

import { useMemo, useState } from "react"
import { ArrowRight, Search, TrendingUp, Trophy, Users, Radio } from "lucide-react"
import { TeamCrest } from "@/components/team-crest"
import { PlayerAvatar } from "@/components/player-avatar"
import { formatCurrency, type Team } from "@/lib/teams-data"
import { clubeCuradoPorNome, siglaDoNome } from "@/lib/club-identity"
import { getWorldTransferLog, type WorldTransferNews } from "@/lib/world-market"
import { getGameDate } from "@/lib/game-date"
import { cn } from "@/lib/utils"

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]

/** Clube para o TeamCrest: o curado quando existe, senao um minimo com sigla do nome. */
function timeParaEscudo(nome: string): Team {
  const curado = clubeCuradoPorNome(nome)
  if (curado) return curado
  return {
    nome,
    curto: siglaDoNome(nome),
    cor1: "#26263a",
    cor2: "#101018",
    file_key: "",
  } as unknown as Team
}

function normalizar(s: string): string {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

function quando(n: WorldTransferNews, temporadaAtual: number): string {
  if (!n.temporada) return "—"
  if (n.semana) {
    const d = getGameDate(n.temporada, n.semana)
    return `${d.getDate().toString().padStart(2, "0")} ${MESES[d.getMonth()]} ${n.temporada}`
  }
  return n.temporada === temporadaAtual ? "Pré-temporada" : `Janela ${n.temporada}`
}

export function CentralDeTransferencias({
  userTeam,
  temporada,
  /** Muda a cada semana avancada: reobtem o diario sem efeito nem estado extra. */
  semana,
}: {
  userTeam: Team
  temporada: number
  semana: number
}) {
  const [busca, setBusca] = useState("")
  const [soEstaTemporada, setSoEstaTemporada] = useState(false)

  const diario = useMemo(() => getWorldTransferLog(), [semana, temporada])

  const resumo = useMemo(() => {
    const daTemporada = diario.filter(n => n.temporada === temporada)
    const maior = diario.reduce<WorldTransferNews | null>((a, n) => (!a || n.valor > a.valor ? n : a), null)
    const porClube = new Map<string, number>()
    for (const n of diario) porClube.set(n.para, (porClube.get(n.para) ?? 0) + 1)
    const ativo = [...porClube.entries()].sort((a, b) => b[1] - a[1])[0]
    return {
      total: diario.length,
      naTemporada: daTemporada.length,
      maior,
      clubeAtivo: ativo ? { nome: ativo[0], negocios: ativo[1] } : null,
    }
  }, [diario, temporada])

  const lista = useMemo(() => {
    const q = normalizar(busca.trim())
    return diario
      .filter(n => !soEstaTemporada || n.temporada === temporada)
      .filter(n => !q || normalizar(n.atleta).includes(q) || normalizar(n.de).includes(q) || normalizar(n.para).includes(q))
      .slice(0, 200)
  }, [diario, busca, soEstaTemporada, temporada])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Cabecalho: o que o mercado fez */}
      <div className="shrink-0 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand)]/70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--brand)]" />
            </span>
            <h2 className="text-xl font-bold leading-tight text-white">Central de Transferências</h2>
          </div>
          <p className="text-sm text-white/45">
            Contratações fechadas pelos outros clubes, negócio por negócio.
          </p>
          <div className="ml-auto flex items-center gap-3">
            <TeamCrest team={userTeam} size="sm" />
            <span className="hidden text-sm font-medium text-white sm:inline">{userTeam.nome}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { icon: <Radio className="h-3.5 w-3.5" />, label: "Negócios registrados", value: String(resumo.total) },
            { icon: <Trophy className="h-3.5 w-3.5" />, label: `Nesta temporada (${temporada})`, value: String(resumo.naTemporada) },
            {
              icon: <TrendingUp className="h-3.5 w-3.5" />,
              label: "Maior negócio",
              value: resumo.maior ? formatCurrency(resumo.maior.valor) : "—",
              detalhe: resumo.maior?.atleta,
            },
            {
              icon: <Users className="h-3.5 w-3.5" />,
              label: "Clube mais ativo",
              value: resumo.clubeAtivo?.nome ?? "—",
              detalhe: resumo.clubeAtivo ? `${resumo.clubeAtivo.negocios} contratações` : undefined,
            },
          ].map(chip => (
            <div key={chip.label} className="rounded-xl border border-white/[0.06] bg-[#0c0c10]/80 p-3 backdrop-blur-sm">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40">
                <span className="text-[var(--brand)]">{chip.icon}</span>
                {chip.label}
              </div>
              <p className="mt-1 truncate text-base font-bold text-white">{chip.value}</p>
              {chip.detalhe && <p className="truncate text-[11px] text-white/35">{chip.detalhe}</p>}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3">
            <Search className="h-4 w-4 shrink-0 text-white/30" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar atleta ou clube..."
              className="w-full bg-transparent py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setSoEstaTemporada(v => !v)}
            className={cn(
              "rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors",
              soEstaTemporada
                ? "border-[var(--brand)]/40 bg-[var(--brand)]/15 text-[var(--brand)]"
                : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.07]",
            )}
          >
            Só a temporada {temporada}
          </button>
        </div>
      </div>

      {/* O feed */}
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto pr-1">
        {lista.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-[#0c0c10]/70 p-10 text-center backdrop-blur-sm">
            <Radio className="h-12 w-12 text-white/10" />
            <p className="mt-4 text-white/60">
              {diario.length === 0
                ? "Nenhuma transferência no mundo ainda."
                : "Nenhum negócio corresponde à busca."}
            </p>
            <p className="mt-2 max-w-md text-sm text-white/35">
              {diario.length === 0
                ? "O mercado dos outros clubes se movimenta com a janela aberta (janeiro a março e julho a setembro) e na virada da temporada. Avance semanas para acompanhar."
                : "Tente outro nome de atleta ou de clube."}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {lista.map((n, i) => {
              const destino = timeParaEscudo(n.para)
              const origem = timeParaEscudo(n.de)
              return (
                <div
                  key={`${n.atleta}-${n.para}-${n.temporada ?? 0}-${n.semana ?? 0}-${i}`}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-[#0c0c10]/75 px-3 py-2.5 backdrop-blur-sm transition-colors hover:border-white/[0.12] hover:bg-[#0c0c10]/95"
                >
                  <PlayerAvatar name={n.atleta} teamColor={destino.cor1} fileKey={origem.file_key || destino.file_key} position={n.pos} size="sm" />
                  <div className="min-w-0 flex-[1.2]">
                    <p className="truncate text-sm font-semibold text-white">{n.atleta}</p>
                    <p className="truncate text-[11px] text-white/40">
                      {[n.pos, n.idade ? `${n.idade} anos` : null, n.base ? `OVR ${n.base}` : null]
                        .filter(Boolean)
                        .join(" · ") || "Reforço"}
                    </p>
                  </div>

                  <div className="hidden min-w-0 flex-1 items-center gap-2 sm:flex">
                    <TeamCrest team={origem} size="xs" />
                    <span className="truncate text-xs text-white/45">{n.de}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--brand)]/70" />
                    <TeamCrest team={destino} size="xs" />
                    <span className="truncate text-xs font-medium text-white/80">{n.para}</span>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums text-[var(--brand)]">{formatCurrency(n.valor)}</p>
                    <p className="text-[10px] text-white/35">{quando(n, temporada)}</p>
                  </div>
                </div>
              )
            })}
            {diario.length > lista.length && (
              <p className="py-3 text-center text-[11px] text-white/30">
                Mostrando os {lista.length} negócios mais recentes.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

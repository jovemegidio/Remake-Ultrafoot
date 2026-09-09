"use client"

// PLANOS DE DESENVOLVIMENTO — o que cada atleta ainda pode virar.
//
// Pedido do PDF Ultra26 (p.15/16). A referência mostra, por atleta: a fase, uma
// projeção de nível ("sobe em 16 a 18 semanas → 57"), os atributos com o valor
// atual e as estrelas de nota e potencial.
//
// ⚠️ O NÚMERO DESTA TELA É O NÚMERO DO MOTOR.
//
// A projeção sai de `projetarDesenvolvimento`, que chama a MESMA
// `ganhoDaTemporada` que a virada de ano executa — ela foi extraída do
// game-engine justamente para isto (ver lib/plano-de-desenvolvimento.ts). Se um
// dia o balanceamento mudar, os dois mudam juntos. Uma tela que promete +4 e um
// motor que entrega +2 seria pior do que não ter tela.

import { useMemo, useState } from "react"
import { ChevronLeft, TrendingUp, TrendingDown, Minus, Star } from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { PlayerAvatarCircle } from "@/components/player-avatar"
import { cn } from "@/lib/utils"
import { getTeamByShort, serieATeams } from "@/lib/teams-data"
import { useGameState } from "@/lib/save-system"
import { useTranslation } from "@/lib/i18n"
import { useGameEngine } from "@/lib/game-engine"
import { useTelaGamepad } from "@/hooks/use-tela-gamepad"
import { useActionBar } from "@/components/ea-action-bar"
import { hardNavigate } from "@/lib/hard-navigation"
import {
  projetarDesenvolvimento,
  estrelas,
  ROTULO_DA_FASE,
  DESCRICAO_DA_FASE,
  type FaseDeDesenvolvimento,
} from "@/lib/plano-de-desenvolvimento"

const COR_DA_FASE: Record<FaseDeDesenvolvimento, string> = {
  crescimento: "text-[var(--uf-green)]",
  regular: "text-[var(--uf-cyan)]",
  pico: "text-white/75",
  declinio: "text-[var(--uf-yellow)]",
}

/** Estrelas cheias/meias, como a referência desenha o FN e o PR. */
function Estrelas({ valor }: { valor: number }) {
  return (
    <span className="flex items-center gap-[1px]" title={`${valor} de 5`}>
      {[1, 2, 3, 4, 5].map(i => {
        const cheia = valor >= i
        const meia = !cheia && valor >= i - 0.5
        return (
          <Star
            key={i}
            className={cn(
              "h-3 w-3",
              cheia ? "fill-[var(--uf-yellow)] text-[var(--uf-yellow)]"
                : meia ? "fill-[var(--uf-yellow)]/45 text-[var(--uf-yellow)]/70"
                  : "text-white/15",
            )}
          />
        )
      })}
    </span>
  )
}

/**
 * As seis chaves de atributo. O ROTULO nao mora aqui: ele vem do dicionario
 * dentro do componente, senao a lista nasceria chumbada em portugues e a
 * catraca de scripts/qa-traducao.mjs reprovaria a tela — com razao.
 */
const ATRIBUTOS = ["pace", "shooting", "passing", "dribbling", "defending", "physical"] as const

export default function DesenvolvimentoPage() {
  const t = useTranslation()
  const { state } = useGameState()
  const userTeam = getTeamByShort(state.selectedTeamShort || "BGT") || serieATeams[0]
  const squadPlayers = useGameEngine(s => s.squadPlayers)

  const [selecionadoId, setSelecionadoId] = useState<number | null>(null)

  useTelaGamepad({ aoVoltar: () => hardNavigate("/academia"), contexto: "GLOBAL" })
  useActionBar([
    { keyLabel: "enter", label: t.desenvolvimento.selecionar },
    { keyLabel: "Esc", label: t.desenvolvimento.voltar },
  ])

  const ROTULO_DO_ATRIBUTO: Record<(typeof ATRIBUTOS)[number], string> = {
    pace: t.desenvolvimento.attr_ritmo,
    shooting: t.desenvolvimento.attr_finalizacao,
    passing: t.desenvolvimento.attr_passe,
    dribbling: t.desenvolvimento.attr_conducao,
    defending: t.desenvolvimento.attr_defesa,
    physical: t.desenvolvimento.attr_fisico,
  }

  const lista = useMemo(
    () =>
      [...squadPlayers]
        // Mais novo primeiro: um plano de desenvolvimento é sobre quem ainda
        // tem para onde crescer, e ordenar por overall enterraria as promessas
        // no fim de uma lista de trinta nomes.
        .sort((a, b) => a.age - b.age || b.potential - a.potential)
        .map(p => ({ atleta: p, projecao: projetarDesenvolvimento(p) })),
    [squadPlayers],
  )

  const selecionado = lista.find(l => l.atleta.id === selecionadoId) ?? lista[0] ?? null

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <GameHeader team={userTeam} />

      <main className="uf-margem-segura flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4">
        <header className="flex items-center gap-3">
          <button
            onClick={() => hardNavigate("/academia")}
            className="rounded-lg p-2 text-white/50 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Voltar"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white">{t.desenvolvimento.planos_de_desenvolvimento}</h1>
            <p className="text-xs text-white/45">
              Em que fase cada atleta está e quanto ele ainda cresce, mantendo o ritmo de jogos atual.
            </p>
          </div>
        </header>

        {lista.length === 0 ? (
          <p className="py-12 text-center text-sm text-white/35">
            Sem elenco carregado. Abra uma carreira para ver os planos.
          </p>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            {/* ── A LISTA ──────────────────────────────────────────────── */}
            <section className="uf-superficie rounded-2xl p-3">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">{t.desenvolvimento.atleta}</span>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">{t.desenvolvimento.fase}</span>
              </div>
              <div className="max-h-[62vh] space-y-0.5 overflow-y-auto pr-1">
                {lista.map(({ atleta, projecao }) => {
                  const ativo = selecionado?.atleta.id === atleta.id
                  return (
                    <button
                      key={atleta.id}
                      onClick={() => setSelecionadoId(atleta.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg border-l-2 px-2 py-1.5 text-left transition-colors",
                        ativo
                          ? "border-l-[var(--brand)] bg-[var(--brand)]/10"
                          : "border-l-transparent hover:bg-white/[0.04]",
                      )}
                    >
                      <PlayerAvatarCircle name={atleta.name} size="xs" position={atleta.position} />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-semibold text-white">{atleta.name}</span>
                        <span className="text-[10px] text-white/35">
                          {atleta.position} · {atleta.age} anos
                        </span>
                      </div>
                      <span className={cn("shrink-0 text-[10px] font-bold uppercase", COR_DA_FASE[projecao.fase])}>
                        {ROTULO_DA_FASE[projecao.fase]}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* ── O DETALHE ────────────────────────────────────────────── */}
            {selecionado && (
              <section className="uf-superficie rounded-2xl p-5">
                <div className="flex items-start gap-4">
                  <PlayerAvatarCircle
                    name={selecionado.atleta.name}
                    size="lg"
                    position={selecionado.atleta.position}
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-black text-white">{selecionado.atleta.name}</h2>
                    <p className="text-xs text-white/45">
                      {selecionado.atleta.position} · {selecionado.atleta.age} anos
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                      <span className="flex items-center gap-1.5 text-white/50">
                        <span className="font-black uppercase tracking-wider text-white/35">FN</span>
                        <Estrelas valor={estrelas(selecionado.atleta.overall)} />
                      </span>
                      <span className="flex items-center gap-1.5 text-white/50">
                        <span className="font-black uppercase tracking-wider text-white/35">PR</span>
                        <Estrelas valor={estrelas(selecionado.atleta.potential)} />
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="uf-num text-3xl font-black leading-none text-white">
                      {selecionado.atleta.overall}
                    </div>
                    <div className="uf-num mt-0.5 text-[11px] font-bold text-white/35">
                      pot. {selecionado.atleta.potential}
                    </div>
                  </div>
                </div>

                {/* ── A FASE E A PROJEÇÃO ─────────────────────────────── */}
                <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2">
                    {selecionado.projecao.ganhoNaTemporada > 0 ? (
                      <TrendingUp className="h-4 w-4 text-[var(--uf-green)]" />
                    ) : selecionado.projecao.ganhoNaTemporada < 0 ? (
                      <TrendingDown className="h-4 w-4 text-[var(--uf-yellow)]" />
                    ) : (
                      <Minus className="h-4 w-4 text-white/40" />
                    )}
                    <span className={cn("text-sm font-black uppercase tracking-wider", COR_DA_FASE[selecionado.projecao.fase])}>
                      {ROTULO_DA_FASE[selecionado.projecao.fase]}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-snug text-white/45">
                    {DESCRICAO_DA_FASE[selecionado.projecao.fase]}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-white/35">{t.desenvolvimento.na_proxima_temporada}</div>
                      <div className="uf-num mt-0.5 text-xl font-black text-white">
                        {selecionado.projecao.ganhoNaTemporada > 0 && "+"}
                        {selecionado.projecao.ganhoNaTemporada}
                        <span className="ml-2 text-sm font-bold text-white/40">
                          → {selecionado.projecao.overallProjetado}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-white/35">{t.desenvolvimento.ate_o_potencial}</div>
                      <div className="uf-num mt-0.5 text-xl font-black text-white">
                        {selecionado.projecao.temporadasAtePotencial === null
                          ? <span className="text-sm font-bold text-white/40">{t.desenvolvimento.nao_cresce_mais}</span>
                          : `${selecionado.projecao.temporadasAtePotencial} temp.`}
                      </div>
                    </div>
                  </div>

                  {/* Barra: onde ele está entre o overall atual e o potencial. */}
                  {selecionado.projecao.margem > 0 && (
                    <div className="mt-4">
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[var(--brand)] to-[var(--brand-2)] transition-all"
                          style={{
                            width: `${Math.round(
                              ((selecionado.atleta.overall - 40) /
                                Math.max(1, selecionado.atleta.potential - 40)) * 100,
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="mt-1.5 text-[10px] text-white/35">
                        Faltam <span className="uf-num font-bold text-white/60">{selecionado.projecao.margem}</span> pontos
                        para o teto. A projeção mantém o ritmo de jogos desta temporada
                        ({selecionado.atleta.seasonStats?.matchesPlayed ?? 0} partidas): mais minutos aceleram.
                      </p>
                    </div>
                  )}
                </div>

                {/* ── OS ATRIBUTOS ────────────────────────────────────── */}
                <div className="mt-4">
                  <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/35">{t.desenvolvimento.atributos}</h3>
                  <div className="grid grid-cols-2 gap-x-5 gap-y-1.5 sm:grid-cols-3">
                    {ATRIBUTOS.map((chave) => {
                      const rotulo = ROTULO_DO_ATRIBUTO[chave]
                      const valor = (selecionado.atleta[chave] as number) ?? 0
                      return (
                        <div key={chave}>
                          <div className="flex items-baseline justify-between">
                            <span className="text-[10px] uppercase tracking-wider text-white/40">{rotulo}</span>
                            <span className="uf-num text-sm font-black text-white">{Math.round(valor)}</span>
                          </div>
                          <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/8">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                valor >= 80 ? "bg-[var(--uf-green)]"
                                  : valor >= 65 ? "bg-[var(--uf-cyan)]"
                                    : valor >= 50 ? "bg-[var(--uf-yellow)]"
                                      : "bg-[var(--uf-magenta)]",
                              )}
                              style={{ width: `${Math.min(100, valor)}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* O treino individual que já está rodando, se houver. */}
                {selecionado.atleta.training?.currentFocus && (
                  <p className="mt-4 rounded-lg border border-[var(--brand)]/25 bg-[var(--brand)]/[0.06] px-3 py-2 text-[11px] text-white/60">
                    Em treino individual de{" "}
                    <span className="font-bold text-white">{selecionado.atleta.training.currentFocus}</span>
                    {typeof selecionado.atleta.training.weeksTrained === "number" &&
                      ` há ${selecionado.atleta.training.weeksTrained} semana(s)`}
                    .
                  </p>
                )}
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

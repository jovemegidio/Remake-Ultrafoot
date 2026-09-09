"use client"

// PLANO DE TREINO — as regras que cuidam do elenco sozinhas.
//
// Pedido do PDF Ultra26 (p.15/16): "em elenco implemente Plano de
// desenvolvimento / plano de treino e escalacoes (...) e ajuste para funcionar
// corretamente com dados reais".
//
// ⚠️ "COM DADOS REAIS" e a parte que decide se esta tela vale alguma coisa.
// Ela nao mostra numero decorativo: o ritmo e a energia saem do elenco vivo do
// motor, e o plano que ela calcula e EXATAMENTE o que a virada de semana aplica
// (lib/game-engine, no bloco da semana de treino, via `cargaIndividual`). Mudar
// uma regra aqui muda o treino da proxima semana de verdade.

import { useMemo } from "react"
import { ChevronLeft, Gauge, BatteryCharging, Sparkles, RotateCcw } from "lucide-react"
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
  planoDoAtleta,
  resumoDosPlanos,
  REGRAS_PADRAO,
  ROTULO_DO_PLANO,
  DESCRICAO_DO_PLANO,
  ENERGIA_DE_RECUPERACAO,
  type PlanoAutomatico,
  type RegraDePlano,
} from "@/lib/plano-de-treino-automatico"
import { RITMO_INICIAL, rotuloDoRitmo } from "@/lib/ritmo-de-jogo"

const COR_DO_PLANO: Record<PlanoAutomatico, string> = {
  intenso: "text-[var(--uf-magenta)]",
  pesado: "text-[var(--uf-yellow)]",
  equilibrado: "text-white/70",
  leve: "text-[var(--uf-cyan)]",
  recuperacao: "text-[var(--uf-green)]",
}

export default function PlanoDeTreinoPage() {
  const t = useTranslation()
  const { state } = useGameState()
  const userTeam = getTeamByShort(state.selectedTeamShort || "BGT") || serieATeams[0]

  const squadPlayers = useGameEngine(s => s.squadPlayers)
  const regras = useGameEngine(s => s.regrasDePlanoDeTreino) ?? REGRAS_PADRAO
  const manuaisDoSave = useGameEngine(s => s.planoManualPorAtleta)
  // `?? {}` direto na leitura criaria um objeto novo a cada render e o useMemo
  // abaixo recalcularia o elenco inteiro sempre.
  const manuais = useMemo(() => manuaisDoSave ?? {}, [manuaisDoSave])
  const definirRegras = useGameEngine(s => s.definirRegrasDePlanoDeTreino)
  const definirManual = useGameEngine(s => s.definirPlanoManualDoAtleta)

  useTelaGamepad({ aoVoltar: () => hardNavigate("/academia"), contexto: "GLOBAL" })
  useActionBar([
    { keyLabel: "enter", label: t.planoTreino.alternar_regra },
    { keyLabel: "Esc", label: t.planoTreino.voltar },
  ])

  /** O plano de cada atleta AGORA — a mesma conta que a virada de semana faz. */
  const decididos = useMemo(
    () =>
      squadPlayers.map(p => {
        const automatico = planoDoAtleta(
          { id: p.id, ritmo: p.ritmo, energy: p.energy, injury: p.injury },
          regras,
        )
        const manual = manuais[p.id]
        return {
          atleta: p,
          plano: manual ?? automatico.plano,
          motivo: manual ? t.planoTreino.escolhido_por_voce : automatico.motivo,
          manual: Boolean(manual),
        }
      }),
    [squadPlayers, regras, manuais],
  )

  const resumo = useMemo(
    () => resumoDosPlanos(decididos.map(d => ({ id: d.atleta.id, plano: d.plano, motivo: d.motivo }))),
    [decididos],
  )

  const alternarRegra = (plano: PlanoAutomatico) => {
    const novas: RegraDePlano[] = regras.map(r =>
      r.plano === plano ? { ...r, ativa: !r.ativa } : r,
    )
    definirRegras(novas)
  }

  const mudarLimite = (plano: PlanoAutomatico, delta: number) => {
    const novas: RegraDePlano[] = regras.map(r =>
      r.plano === plano && r.limite !== null
        // Preso entre 20 e 99: limite 0 desligaria a regra por outro caminho
        // (melhor desligar pelo interruptor, que e explicito) e 100 faria a
        // regra alcancar o elenco inteiro sempre.
        ? { ...r, limite: Math.min(99, Math.max(20, r.limite + delta)) }
        : r,
    )
    definirRegras(novas)
  }

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
            <h1 className="text-xl font-black tracking-tight text-white">{t.planoTreino.plano_de_treino}</h1>
            <p className="text-xs text-white/45">
              As regras decidem o treino de cada atleta pelo ritmo de jogo e pela energia dele.
            </p>
          </div>
        </header>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          {/* ── AS REGRAS ─────────────────────────────────────────────── */}
          <section className="uf-superficie rounded-2xl p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white/70">{t.planoTreino.plano_automatico}</h2>
              <span className="text-[10px] uppercase tracking-wider text-white/35">{t.planoTreino.limite_de_ritmo}</span>
            </div>

            <div className="space-y-1.5">
              {regras.map(regra => {
                const quantos = resumo[regra.plano]
                return (
                  <div
                    key={regra.plano}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 transition-colors",
                      regra.ativa
                        ? "border-white/12 bg-white/[0.04]"
                        : "border-white/[0.06] bg-transparent opacity-50",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => alternarRegra(regra.plano)}
                        className={cn(
                          "h-4 w-4 shrink-0 rounded-full border-2 transition-colors",
                          regra.ativa ? "border-[var(--brand)] bg-[var(--brand)]" : "border-white/25",
                        )}
                        aria-label={regra.ativa ? t.planoTreino.desligar_regra : t.planoTreino.ligar_regra}
                      />
                      <span className={cn("flex-1 text-sm font-bold", COR_DO_PLANO[regra.plano])}>
                        {ROTULO_DO_PLANO[regra.plano]}
                      </span>

                      {regra.limite === null ? (
                        <span className="uf-num text-xs font-semibold text-white/35">N/A</span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => mudarLimite(regra.plano, -5)}
                            className="h-5 w-5 rounded text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                            aria-label={t.planoTreino.diminuir_limite}
                          >
                            -
                          </button>
                          <span className="uf-num w-7 text-center text-sm font-black text-white">{regra.limite}</span>
                          <button
                            onClick={() => mudarLimite(regra.plano, 5)}
                            className="h-5 w-5 rounded text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                            aria-label={t.planoTreino.aumentar_limite}
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>

                    <p className="mt-1 pl-7 text-[11px] leading-snug text-white/40">
                      {DESCRICAO_DO_PLANO[regra.plano]}
                    </p>
                    <p className="mt-1 pl-7 text-[11px] font-semibold text-white/55">
                      {quantos === 0 ? t.planoTreino.nenhum_atleta_agora : `${quantos} atleta${quantos > 1 ? "s" : ""} agora`}
                    </p>
                  </div>
                )
              })}
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <BatteryCharging className="mt-0.5 h-4 w-4 shrink-0 text-[var(--uf-green)]" />
              <p className="text-[11px] leading-snug text-white/45">
                Energia abaixo de <span className="uf-num font-bold text-white/70">{ENERGIA_DE_RECUPERACAO}%</span> manda
                o atleta para a recuperação, mesmo que outra regra o alcance. Quem está exausto não vai para o treino
                mais pesado do jogo.
              </p>
            </div>

            <button
              onClick={() => definirRegras([...REGRAS_PADRAO])}
              className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-white/40 transition-colors hover:text-white"
            >
              <RotateCcw className="h-3 w-3" />
              Restaurar padrão
            </button>
          </section>

          {/* ── O ELENCO, ATLETA A ATLETA ─────────────────────────────── */}
          <section className="uf-superficie rounded-2xl p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white/70">{t.planoTreino.plano_manual}</h2>
              <span className="text-[10px] uppercase tracking-wider text-white/35">{t.planoTreino.sua_escolha_vence_a_regra}</span>
            </div>

            {decididos.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/35">
                Sem elenco carregado. Abra uma carreira para ver os planos.
              </p>
            ) : (
              <div className="space-y-1">
                {decididos.map(({ atleta, plano, motivo, manual }) => {
                  const ritmo = atleta.ritmo ?? RITMO_INICIAL
                  const energia = Math.round(atleta.energy ?? 100)
                  return (
                    <div
                      key={atleta.id}
                      className="flex items-center gap-3 rounded-lg border-b border-white/[0.05] px-2 py-2 last:border-b-0"
                    >
                      <PlayerAvatarCircle name={atleta.name} size="xs" position={atleta.position} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[13px] font-semibold text-white">{atleta.name}</span>
                          <span className="shrink-0 text-[10px] font-bold uppercase text-white/35">{atleta.position}</span>
                          {manual && <Sparkles className="h-3 w-3 shrink-0 text-[var(--brand)]" />}
                        </div>
                        <p className="truncate text-[10px] text-white/35">{motivo}</p>
                      </div>

                      {/* Ritmo e energia — exatamente o que as regras leem. */}
                      <div className="hidden shrink-0 items-center gap-3 sm:flex">
                        <span className="flex items-center gap-1 text-[11px] text-white/50" title={rotuloDoRitmo(ritmo)}>
                          <Gauge className="h-3 w-3" />
                          <span className="uf-num w-6 text-right font-bold">{Math.round(ritmo)}</span>
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-white/50" title={t.planoTreino.energia}>
                          <BatteryCharging className="h-3 w-3" />
                          <span className="uf-num w-7 text-right font-bold">{energia}%</span>
                        </span>
                      </div>

                      <select
                        value={manual ? plano : ""}
                        onChange={e => definirManual(atleta.id, (e.target.value || null) as PlanoAutomatico | null)}
                        className={cn(
                          "shrink-0 rounded-lg border border-white/12 bg-black/40 px-2 py-1 text-[11px] font-bold outline-none",
                          COR_DO_PLANO[plano],
                        )}
                      >
                        <option value="" className="text-white">
                          Automático ({ROTULO_DO_PLANO[plano]})
                        </option>
                        {(Object.keys(ROTULO_DO_PLANO) as PlanoAutomatico[]).map(p => (
                          <option key={p} value={p} className="text-white">
                            {ROTULO_DO_PLANO[p]}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}

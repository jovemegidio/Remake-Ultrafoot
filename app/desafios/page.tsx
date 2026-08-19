"use client"

// MODO DESAFIOS.
//
// A tela anterior listava os oito cenários e tinha um botão "Iniciar desafio"
// que gravava um progresso que nada no jogo lia depois. Não havia como saber a
// regra do desafio antes de aceitar, nem acompanhar meta, prazo ou recompensa —
// e a página não era alcançável por nenhum menu.
//
// Agora ela mostra as três coisas que um desafio precisa ter para ser um
// desafio: O QUE MUDA na carreira (as regras), O QUE PRECISA SER FEITO (as
// metas, com o valor atingido) e ATÉ QUANDO. Ver lib/challenge-engine.

import { useMemo, useState } from "react"
import { Award, CalendarClock, CheckCircle2, Clock, Lock, Medal, Target, Trophy, XCircle } from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { useGameState } from "@/lib/save-system"
import { useUserTeam } from "@/lib/time-da-carreira"
import { useGameEngine } from "@/lib/game-engine"
import {
  CHALLENGES,
  SEMANA_LIMITE_PARA_COMECAR,
  abandonarDesafio,
  acharDesafio,
  contarReforcos,
  descreverRegras,
  startChallenge,
  temporadaDeInicio,
  type ChallengeConfig,
  type ChallengeId,
} from "@/lib/challenge-engine"
import { formatCurrency } from "@/lib/currency"
import { useTelaGamepad } from "@/hooks/use-tela-gamepad"
import { hardNavigate } from "@/lib/hard-navigation"
import { cn } from "@/lib/utils"

const CORES_DA_DIFICULDADE: Record<string, string> = {
  facil: "text-green-400 bg-green-400/10 border-green-400/20",
  medio: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  dificil: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  lendario: "text-purple-300 bg-purple-400/10 border-purple-400/25",
}

export default function DesafiosPage() {
  // Controle: convencao unica (B volta). Ver hooks/use-tela-gamepad.ts.
  useTelaGamepad({ aoVoltar: () => hardNavigate("/") })

  const { team } = useUserTeam()
  const { state, setState } = useGameState()
  const gameEngine = useGameEngine()
  const [confirmarAbandono, setConfirmarAbandono] = useState(false)

  const ativo = state.activeChallenge
  const emAndamento = Boolean(ativo && !ativo.completed && !ativo.failed)
  const configAtivo = ativo ? acharDesafio(ativo.challengeId) : undefined
  const concluidos = state.desafiosConcluidos ?? []

  const inicio = temporadaDeInicio(state.season, state.week ?? 0)
  const comecaNaProxima = inicio > state.season
  const reforcosNaTemporada = useMemo(
    () => contarReforcos(state.transfers, state.season),
    [state.transfers, state.season],
  )

  const iniciar = (id: ChallengeId) => {
    if (!state.selectedTeamShort) return
    const { estado, caixaAlvo } = startChallenge(id, state, gameEngine.balance)
    // O CAIXA É DO MOTOR. Gravar `balance` no save não mudaria um centavo do que
    // as telas mostram — quem manda no dinheiro é o game-engine.
    if (caixaAlvo !== undefined) {
      const delta = Math.round(caixaAlvo - gameEngine.balance)
      if (delta > 0) gameEngine.addClubRevenue(delta)
      else if (delta < 0) gameEngine.addClubExpense(-delta)
    }
    setState({ activeChallenge: estado.activeChallenge, teamMorale: estado.teamMorale })
  }

  const abandonar = () => {
    // `abandonarDesafio` limpa também a regra que o MOTOR consulta — sem ela o
    // mercado continuaria travado até a próxima gravação do save.
    const semDesafio = abandonarDesafio(state)
    setState({ activeChallenge: semDesafio.activeChallenge })
    setConfirmarAbandono(false)
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#050508] pb-20 md:pb-0">
      <GameHeader team={team} />
      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <header className="flex items-center gap-3">
          <Trophy className="h-7 w-7 text-[#ffd700]" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">DESAFIOS</h1>
            <p className="mt-1 text-white/50">
              A mesma carreira, com regra, prazo e recompensa. Um por vez.
            </p>
          </div>
        </header>

        {!state.selectedTeamShort && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] p-4 text-sm text-amber-100/80">
            <Lock className="h-5 w-5 shrink-0 text-amber-300" />
            Assuma um clube antes de aceitar um desafio — as regras valem sobre a carreira.
          </div>
        )}

        {/* DESAFIO EM ANDAMENTO */}
        {ativo && configAtivo && (
          <DesafioAtivo
            config={configAtivo}
            progresso={ativo}
            temporadaAtual={state.season}
            reforcosNaTemporada={reforcosNaTemporada}
            aoAbandonar={() => setConfirmarAbandono(true)}
          />
        )}

        {emAndamento && comecaNaProxima && (
          <p className="text-xs text-white/40">
            Este desafio começa a valer na temporada {ativo?.startSeason}: ele foi aceito com a
            atual já em andamento.
          </p>
        )}

        {/* CATÁLOGO */}
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-white/40">
            {emAndamento ? "Outros cenários (indisponíveis enquanto há um desafio ativo)" : "Escolha um cenário"}
          </h2>
          {!emAndamento && comecaNaProxima && state.selectedTeamShort && (
            <p className="mb-3 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-white/50">
              A temporada {state.season} já está na semana {state.week}. Um desafio aceito agora
              passa a valer na temporada {inicio} — só até a semana {SEMANA_LIMITE_PARA_COMECAR} ele
              conta para o ano corrente.
            </p>
          )}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {CHALLENGES.map(config => {
              const jaConcluido = concluidos.some(c => c.challengeId === config.id)
              return (
                <CartaoDoDesafio
                  key={config.id}
                  config={config}
                  concluido={jaConcluido}
                  bloqueado={emAndamento || !state.selectedTeamShort}
                  ehOAtivo={ativo?.challengeId === config.id}
                  aoIniciar={() => iniciar(config.id)}
                />
              )
            })}
          </div>
        </section>

        {/* CONQUISTAS */}
        {concluidos.length > 0 && (
          <section className="rounded-xl border border-[#ffd700]/20 bg-[#ffd700]/[0.04] p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white/70">
              <Medal className="h-4 w-4 text-[#ffd700]" />
              Desafios concluídos
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {concluidos.map(c => (
                <span
                  key={`${c.challengeId}-${c.em}`}
                  className="rounded-lg border border-[#ffd700]/25 bg-black/30 px-3 py-1.5 text-xs text-white"
                >
                  <strong className="text-[#ffd700]">{c.titulo}</strong>
                  <span className="ml-2 text-white/40">
                    {acharDesafio(c.challengeId as ChallengeId)?.nome ?? c.challengeId} · {c.season}
                  </span>
                </span>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Abandonar é irreversível: o progresso não volta. */}
      {confirmarAbandono && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setConfirmarAbandono(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c0c14] p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-white">Abandonar o desafio?</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              As regras deixam de valer na hora e o progresso é perdido. A carreira continua
              exatamente como está — nada do que aconteceu é desfeito.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setConfirmarAbandono(false)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10"
              >
                Continuar no desafio
              </button>
              <button
                onClick={abandonar}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-400"
              >
                Abandonar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DesafioAtivo({
  config, progresso, temporadaAtual, reforcosNaTemporada, aoAbandonar,
}: {
  config: ChallengeConfig
  progresso: NonNullable<ReturnType<typeof useGameState>["state"]["activeChallenge"]>
  temporadaAtual: number
  reforcosNaTemporada: number
  aoAbandonar: () => void
}) {
  const cumpridas = progresso.goals.filter(g => g.completed).length
  const total = progresso.goals.length
  const ultimaTemporada = progresso.startSeason + config.durationSeasons - 1
  const restam = Math.max(0, ultimaTemporada - temporadaAtual + 1)
  const encerrado = progresso.completed || progresso.failed

  return (
    <section
      className={cn(
        "rounded-xl border p-5",
        progresso.completed
          ? "border-[#ffd700]/30 bg-[#ffd700]/[0.06]"
          : progresso.failed
            ? "border-red-500/30 bg-red-500/[0.06]"
            : "border-[var(--brand)]/25 bg-[var(--brand)]/[0.05]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
            {progresso.completed ? "Desafio concluído" : progresso.failed ? "Desafio falhado" : "Desafio em andamento"}
          </p>
          <h2 className="mt-1 text-2xl font-black text-white">{config.nome}</h2>
          <p className="mt-1 text-sm text-white/55">{config.descricao}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-white/40">Metas</p>
          <p className="text-2xl font-bold text-white tabular-nums">{cumpridas}/{total}</p>
        </div>
      </div>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            progresso.completed ? "bg-[#ffd700]" : progresso.failed ? "bg-red-500" : "bg-[var(--brand)]",
          )}
          style={{ width: `${total > 0 ? (cumpridas / total) * 100 : 0}%` }}
        />
      </div>

      <div className="mt-4 space-y-2">
        {progresso.goals.map(goal => (
          <div key={goal.id} className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2.5">
            {goal.completed
              ? <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--brand)]" />
              : <Target className="h-4 w-4 shrink-0 text-white/30" />}
            <span className={cn("flex-1 text-sm", goal.completed ? "text-white" : "text-white/60")}>
              {goal.description}
            </span>
            {goal.currentValue !== undefined && (
              <span className="shrink-0 rounded bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white/60">
                {typeof goal.currentValue === "number" && goal.metric === "finish_positive"
                  ? formatCurrency(goal.currentValue)
                  : goal.currentValue}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
        {/* Regra viva: quantos reforços ainda cabem NESTA temporada. Sem este
            número o técnico só descobre o teto ao ser recusado no mercado. */}
        {config.rules.reforcosPorTemporada !== undefined && !encerrado && (
          <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-white/60">
            Reforços na temporada: {reforcosNaTemporada}/{config.rules.reforcosPorTemporada}
          </span>
        )}
        {descreverRegras(config).map(regra => (
          <span key={regra} className="rounded-md border border-white/[0.07] bg-black/25 px-2 py-1 text-white/45">
            {regra}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
        <p className="flex items-center gap-2 text-xs text-white/45">
          <CalendarClock className="h-4 w-4 text-white/30" />
          {progresso.completed
            ? `Concluído na temporada ${progresso.currentSeason} · prêmio de ${formatCurrency(config.reward.saldo)} creditado`
            : progresso.failed
              ? `O prazo terminou na temporada ${ultimaTemporada}`
              : `Prazo até o fim de ${ultimaTemporada} · ${restam} temporada(s) restante(s)`}
        </p>
        <button
          onClick={aoAbandonar}
          className="rounded-lg border border-red-500/25 px-3 py-1.5 text-xs font-semibold text-red-300/80 transition-colors hover:bg-red-500/10 hover:text-red-200"
        >
          {encerrado ? "Limpar e escolher outro" : "Abandonar desafio"}
        </button>
      </div>
    </section>
  )
}

function CartaoDoDesafio({
  config, concluido, bloqueado, ehOAtivo, aoIniciar,
}: {
  config: ChallengeConfig
  concluido: boolean
  bloqueado: boolean
  ehOAtivo: boolean
  aoIniciar: () => void
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border bg-[#0c0c10] p-3 transition",
        ehOAtivo ? "border-[var(--brand)]/40" : "border-white/[0.05] hover:border-white/15",
        bloqueado && !ehOAtivo && "opacity-45",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Award className="h-6 w-6 text-[var(--brand)]" />
        <span className={cn(
          "rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
          CORES_DA_DIFICULDADE[config.difficulty],
        )}>
          {config.difficulty}
        </span>
      </div>

      <h3 className="mt-2 text-base font-bold text-white">{config.nome}</h3>
      <p className="mt-1 text-xs leading-relaxed text-white/50">{config.descricao}</p>

      <p className="mt-3 text-[11px] text-white/35">Ideal em: {config.clubeIdeal}</p>

      <ul className="mt-3 space-y-1">
        {descreverRegras(config).map(regra => (
          <li key={regra} className="flex items-start gap-1.5 text-[11px] text-white/55">
            <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-[var(--brand)]/70" />
            {regra}
          </li>
        ))}
      </ul>

      <div className="mt-3 rounded-lg border border-[#ffd700]/15 bg-[#ffd700]/[0.05] px-3 py-2 text-[11px] text-white/60">
        <span className="font-semibold text-[#ffd700]">Recompensa</span>
        {" · "}{formatCurrency(config.reward.saldo)}
        {" · "}+{config.reward.xp} XP
        {" · "}título “{config.reward.titulo}”
      </div>

      <div className="mt-auto pt-4">
        {concluido ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-[#ffd700]/25 bg-[#ffd700]/[0.06] px-3 py-2 text-xs font-semibold text-[#ffd700]">
            <Trophy className="h-3.5 w-3.5" />
            Já conquistado
          </div>
        ) : ehOAtivo ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-[var(--brand)]/30 bg-[var(--brand)]/[0.08] px-3 py-2 text-xs font-semibold text-[var(--brand)]">
            <Clock className="h-3.5 w-3.5" />
            Em andamento
          </div>
        ) : (
          <button
            onClick={aoIniciar}
            disabled={bloqueado}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs font-semibold text-white/75 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
          >
            {bloqueado ? <XCircle className="h-3.5 w-3.5" /> : <Target className="h-3.5 w-3.5" />}
            {bloqueado ? "Indisponível agora" : "Aceitar desafio"}
          </button>
        )}
      </div>
    </div>
  )
}

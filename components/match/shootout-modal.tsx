"use client"

// DISPUTA DE PENALTIS da partida do usuario.
//
// Antes desta tela, um mata-mata empatado aos 90 simplesmente acabava: o apito
// final soava num 1x1 de final e o classificado era decidido DEPOIS, fora da
// partida, por um cara-ou-coroa em `passouNoConfronto` (lib/cup-bracket:181).
// A tela de chaveamento ainda exibia "Decidido nos penaltis: 5-4" — um placar
// chumbado no codigo para uma disputa que nunca aconteceu.
//
// Aqui a disputa acontece de verdade: voce escolhe cada batedor, o motor cobra
// com a finalizacao dele (lib/match-engine.takeShootoutKick) e o placar que sai
// daqui e o que fica gravado no save.

import { useCallback, useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { TeamCrest } from "@/components/team-crest"
import type { Team } from "@/lib/teams-data"
import type { ShootoutState, ShootoutKick, SquadPlayer, Side } from "@/lib/match-engine"
import { Button } from "@/components/ui/button"
import { Target, Zap, Trophy } from "lucide-react"

interface ShootoutModalProps {
  shootout: ShootoutState
  homeTeam: Team
  awayTeam: Team
  userSide: Side
  /** Batedores ainda disponiveis do lado que vai bater. */
  takers: (side: Side) => SquadPlayer[]
  /** Cobra a proxima penalidade. `null` = o motor escolhe o batedor. */
  onKick: (taker: SquadPlayer | null) => ShootoutKick | null
  /** Disputa encerrada e narrada: a tela da partida segue o fluxo normal. */
  onFinish: (winner: Side) => void
}

// Mesmo espirito do PenaltyTakerModal: um zagueiro com finalizacao inflada nao
// pode liderar a lista de batedores. A posicao pesa.
const POS_PENALTY_BIAS: Record<string, number> = {
  ATA: 14, CA: 14, SA: 12, PE: 10, PD: 10, MEI: 9, MC: 8, MO: 9,
  ME: 6, MD: 6, VOL: 3, LD: -4, LE: -4, ALD: -3, ALE: -3, ZAG: -8, GOL: -40,
}

const BUILDUPS = [
  "Ajeita a bola no ponto. O estadio prende a respiracao.",
  "Encara o goleiro. Nao pisca.",
  "Toma distancia. Da pra ouvir o silencio.",
  "Respira fundo. Tudo depende disto.",
  "Limpa a chuteira na meia. Frieza total.",
]

export function ShootoutModal({
  shootout,
  homeTeam,
  awayTeam,
  userSide,
  takers,
  onKick,
  onFinish,
}: ShootoutModalProps) {
  const [selected, setSelected] = useState<SquadPlayer | null>(null)
  const [narration, setNarration] = useState<string[] | null>(null)
  const [narrationStep, setNarrationStep] = useState(0)
  const [lastKick, setLastKick] = useState<ShootoutKick | null>(null)

  const side = shootout.nextSide
  const ehVezDoUsuario = side === userSide && !shootout.finished
  const timeDaVez = side === "home" ? homeTeam : awayTeam

  // onFinish num REF: o pai recria o callback a cada render e, sem isto, o efeito
  // de narracao reiniciaria o timer para sempre — o mesmo defeito que ja travou o
  // PenaltyTakerModal ("o modal nunca fechava e a partida se repetia").
  const onFinishRef = useRef(onFinish)
  useEffect(() => { onFinishRef.current = onFinish }, [onFinish])

  const narrar = useCallback((kick: ShootoutKick) => {
    const finale =
      kick.resultado === "gol" ? `GOOOOL! ${kick.batedor} nao tremeu!`
        : kick.resultado === "defesa" ? `DEFENDEU! ${kick.goleiro} pegou!`
          : `PRA FORA! ${kick.batedor} mandou por cima!`
    setLastKick(kick)
    setNarration([
      `Na bola, ${kick.batedor}...`,
      BUILDUPS[Math.floor(Math.random() * BUILDUPS.length)],
      "Chutou...",
      finale,
    ])
    setNarrationStep(0)
    setSelected(null)
  }, [])

  const cobrar = useCallback((taker: SquadPlayer | null) => {
    const kick = onKick(taker)
    if (kick) narrar(kick)
  }, [onKick, narrar])

  // Revela a narracao fala a fala; a ultima (o desfecho) demora mais.
  useEffect(() => {
    if (!narration) return
    if (narrationStep >= narration.length) {
      const t = setTimeout(() => { setNarration(null); setLastKick(null) }, 900)
      return () => clearTimeout(t)
    }
    const isFinale = narrationStep === narration.length - 1
    const t = setTimeout(() => setNarrationStep(s => s + 1), isFinale ? 1100 : 850)
    return () => clearTimeout(t)
  }, [narration, narrationStep])

  // A CPU bate sozinha assim que chega a vez dela e a narracao anterior termina.
  useEffect(() => {
    if (narration || shootout.finished || ehVezDoUsuario) return
    const t = setTimeout(() => cobrar(null), 700)
    return () => clearTimeout(t)
  }, [narration, shootout.finished, ehVezDoUsuario, cobrar])

  // Disputa decidida: deixa o placar final na tela por um instante e devolve o
  // controle a partida.
  useEffect(() => {
    if (!shootout.finished || !shootout.winner || narration) return
    const t = setTimeout(() => onFinishRef.current(shootout.winner!), 2600)
    return () => clearTimeout(t)
  }, [shootout.finished, shootout.winner, narration])

  const disponiveis = ehVezDoUsuario ? takers(side) : []
  const ordenados = [...disponiveis].sort((a, b) =>
    ((b.shooting ?? b.rating ?? 70) + (POS_PENALTY_BIAS[b.pos] ?? 0)) -
    ((a.shooting ?? a.rating ?? 70) + (POS_PENALTY_BIAS[a.pos] ?? 0)),
  )

  // Marcadores das cinco cobrancas regulamentares por lado; na morte subita a
  // fila cresce e a linha continua.
  const linhaDe = (lado: Side) => {
    const meus = shootout.kicks.filter(k => k.side === lado)
    const total = Math.max(5, meus.length)
    return Array.from({ length: total }, (_, i) => meus[i] ?? null)
  }

  const vencedor = shootout.winner === "home" ? homeTeam : shootout.winner === "away" ? awayTeam : null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 p-4"
      >
        <motion.div
          initial={{ scale: 0.92, y: 40 }}
          animate={{ scale: 1, y: 0 }}
          className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#0d1a1a]"
        >
          {/* Cabecalho: placar da disputa */}
          <div className="border-b border-white/10 bg-gradient-to-r from-[#1a2a2a] to-[#0d1a1a] p-5">
            <div className="mb-4 flex items-center justify-center gap-2 text-amber-300">
              <Target className="h-4 w-4" />
              <span className="text-xs font-black uppercase tracking-[0.2em]">
                {shootout.suddenDeath ? "Morte subita" : "Disputa de penaltis"}
              </span>
            </div>
            <div className="flex items-center justify-center gap-5">
              <div className="flex flex-1 items-center justify-end gap-3">
                <span className="truncate text-right font-semibold text-white">{homeTeam.nome}</span>
                <TeamCrest team={homeTeam} size="lg" />
              </div>
              <div className="rounded-xl bg-black/50 px-5 py-2 text-3xl font-black tabular-nums text-white">
                {shootout.homeGoals}<span className="mx-1 text-white/30">-</span>{shootout.awayGoals}
              </div>
              <div className="flex flex-1 items-center gap-3">
                <TeamCrest team={awayTeam} size="lg" />
                <span className="truncate font-semibold text-white">{awayTeam.nome}</span>
              </div>
            </div>

            {/* Fila de cobrancas */}
            <div className="mt-4 space-y-2">
              {(["home", "away"] as Side[]).map(lado => (
                <div key={lado} className="flex items-center gap-2">
                  <span className="w-12 shrink-0 text-[10px] font-bold uppercase text-white/40">
                    {(lado === "home" ? homeTeam : awayTeam).curto}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {linhaDe(lado).map((kick, i) => (
                      <div
                        key={i}
                        title={kick ? `${kick.batedor}: ${kick.resultado}` : "a cobrar"}
                        className={cn(
                          "h-4 w-4 rounded-full border transition-colors",
                          !kick && "border-white/20 bg-transparent",
                          kick?.resultado === "gol" && "border-emerald-400 bg-emerald-400",
                          kick?.resultado === "defesa" && "border-amber-400/70 bg-amber-400/20",
                          kick?.resultado === "fora" && "border-red-400/70 bg-red-400/20",
                        )}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Corpo: narracao, escolha do batedor, ou desfecho */}
          <div className="min-h-[280px] p-5">
            {shootout.finished && vencedor ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex h-full min-h-[240px] flex-col items-center justify-center gap-4 text-center"
              >
                <Trophy className="h-12 w-12 text-amber-400" />
                <TeamCrest team={vencedor} size="lg" />
                <p className="text-2xl font-black text-white">{vencedor.nome} se classifica!</p>
                <p className="text-sm text-white/50">
                  Nos penaltis, por {Math.max(shootout.homeGoals, shootout.awayGoals)} a {Math.min(shootout.homeGoals, shootout.awayGoals)}
                </p>
              </motion.div>
            ) : narration ? (
              <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3">
                {narration.slice(0, narrationStep + 1).map((line, i) => {
                  const isFinale = i === narration.length - 1
                  return (
                    <motion.p
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "text-center",
                        isFinale
                          ? cn(
                              "text-3xl font-black tracking-tight",
                              lastKick?.resultado === "gol" && "text-emerald-400",
                              lastKick?.resultado === "defesa" && "text-amber-400",
                              lastKick?.resultado === "fora" && "text-red-400",
                            )
                          : "text-lg text-white/70",
                      )}
                    >
                      {line}
                    </motion.p>
                  )
                })}
              </div>
            ) : ehVezDoUsuario ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-bold uppercase tracking-wider text-white/60">
                    Cobranca {shootout.kicks.filter(k => k.side === side).length + 1} — escolha o batedor
                  </p>
                  <span className="text-xs text-white/30">{timeDaVez.nome}</span>
                </div>
                <div className="max-h-[220px] space-y-1.5 overflow-y-auto pr-1">
                  {ordenados.map((p, index) => {
                    const isSelected = selected?.nome === p.nome
                    return (
                      <button
                        key={p.nome}
                        onClick={() => setSelected(p)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border-2 p-2.5 text-left transition-all",
                          isSelected
                            ? "border-[var(--brand)] bg-[var(--brand)]/20"
                            : "border-transparent bg-white/5 hover:bg-white/10",
                        )}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{p.nome}</span>
                            {index === 0 && (
                              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-400">
                                Recomendado
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-white/40">{p.pos}</span>
                        </div>
                        <div className="flex items-center gap-1 text-white/40">
                          <Zap className="h-3 w-3" />
                          <span className="text-sm font-bold text-white">{p.shooting ?? p.rating ?? 70}</span>
                        </div>
                      </button>
                    )
                  })}
                  {!ordenados.length && (
                    <p className="py-8 text-center text-sm text-white/40">
                      Sem batedores disponiveis — o motor escolhe.
                    </p>
                  )}
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => cobrar(null)}
                    className="border-white/20 text-white/60 hover:bg-white/10"
                  >
                    Deixar o auxiliar decidir
                  </Button>
                  <Button
                    onClick={() => cobrar(selected)}
                    disabled={!selected}
                    className={cn(
                      "font-bold",
                      selected
                        ? "bg-[var(--brand)] text-[var(--brand-ink)] hover:opacity-90"
                        : "bg-white/10 text-white/40",
                    )}
                  >
                    <Target className="mr-2 h-4 w-4" />
                    BATER
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex h-full min-h-[240px] items-center justify-center">
                <p className="text-lg text-white/50">{timeDaVez.nome} vai bater...</p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

"use client"

// PAINEL DOS JOGOS QUE IMPORTAM, durante a sua partida.
//
// Mostra o que os concorrentes diretos estão fazendo AGORA, com o placar
// evoluindo junto do relógio do seu jogo. A régua é a distância na tabela, não a
// fama do clube — ver lib/rivais-ao-vivo.

import { useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { getTeamByShort } from "@/lib/teams-data"
import { TeamCrest } from "@/components/team-crest"
import {
  placarNoMinuto, golAgora, ROTULO_DO_MOTIVO,
  type JogoRival,
} from "@/lib/rivais-ao-vivo"

interface Props {
  jogos: readonly JogoRival[]
  /** Minuto do relógio da SUA partida — é ele que faz os rivais andarem. */
  minuto: number
  /** Semente da rodada, para a mesma rodada contar sempre a mesma história. */
  semente: string
}

export function RivaisAoVivoPainel({ jogos, minuto, semente }: Props) {
  const linhas = useMemo(() => jogos.map(jogo => {
    const home = getTeamByShort(jogo.homeCurto)
    const away = getTeamByShort(jogo.awayCurto)
    const placar = placarNoMinuto(
      jogo,
      home?.prestigio ?? 60,
      away?.prestigio ?? 60,
      minuto,
      semente,
    )
    return { jogo, home, away, placar, gol: golAgora(placar, minuto) }
  }), [jogos, minuto, semente])

  if (!linhas.length) return null

  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/45 p-3 backdrop-blur-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
          Rodada ao vivo
        </span>
      </div>

      <div className="space-y-1.5">
        {linhas.map(({ jogo, home, away, placar, gol }) => (
          <div
            key={`${jogo.homeCurto}-${jogo.awayCurto}`}
            className={cn(
              "relative flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors",
              gol ? "bg-[var(--brand)]/15" : "bg-white/[0.03]",
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {home && <TeamCrest team={home} size="xs" className="h-4 w-4 shrink-0" />}
                <span className="truncate text-[11px] font-medium text-white/80">{jogo.homeNome}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5">
                {away && <TeamCrest team={away} size="xs" className="h-4 w-4 shrink-0" />}
                <span className="truncate text-[11px] font-medium text-white/80">{jogo.awayNome}</span>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <div className="text-[13px] font-black leading-tight tabular-nums text-white">
                {placar.homeGols}
              </div>
              <div className="text-[13px] font-black leading-tight tabular-nums text-white">
                {placar.awayGols}
              </div>
            </div>

            {/* GOL AGORA — o alerta é o ponto do painel: é ele que faz o técnico
                olhar para cá no meio da própria partida. */}
            <AnimatePresence>
              {gol && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute -top-1 right-1 rounded bg-[var(--brand)] px-1.5 py-0.5 text-[9px] font-black uppercase text-[var(--brand-ink)]"
                >
                  Gol
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* O MOTIVO fica no rodapé, uma vez só: repetir "Briga pelo G4" em cada
          linha ocuparia a largura que os nomes dos clubes precisam. */}
      <div className="mt-2 truncate text-[10px] text-white/35">
        {ROTULO_DO_MOTIVO[linhas[0].jogo.motivo]}
        {linhas.length > 1 && ` · ${linhas.length} jogos de olho`}
      </div>
    </div>
  )
}

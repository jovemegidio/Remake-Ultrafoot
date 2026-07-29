"use client"

// ASSISTIR À DISPUTA DE PÊNALTIS DE OUTRO JOGO.
//
// A disputa de um confronto que não é o seu era resolvida em silêncio: a tela
// mostrava "4-3 nos pênaltis" e pronto. As cobranças EXISTIAM (o motor calcula
// batedor por batedor, em lib/cup-engine.disputarPenaltis) mas eram descartadas
// antes de chegar aqui — o técnico nunca via quem errou a decisiva.
//
// Este modal reproduz a disputa chute a chute, com um intervalo entre elas, para
// haver tensão. `Pular` mostra tudo de uma vez — quem só quer o resultado não
// deve ser obrigado a esperar.

import { useEffect, useState } from "react"
import { X, Check, Circle, SkipForward, Trophy } from "lucide-react"
import { TeamCrest } from "@/components/team-crest"
import { cn } from "@/lib/utils"
import type { CobrancaPenalti } from "@/lib/cup-engine"

interface Props {
  aberto: boolean
  /** Lado "A" da disputa (mandante do confronto). */
  clubeA: { curto: string; nome: string }
  clubeB: { curto: string; nome: string }
  cobrancas: CobrancaPenalti[]
  placar: [number, number]
  vencedorCurto: string
  onFechar: () => void
}

const INTERVALO_MS = 900

export function PenaltisAlheiosModal({
  aberto, clubeA, clubeB, cobrancas, placar, vencedorCurto, onFechar,
}: Props) {
  const [mostradas, setMostradas] = useState(0)

  // Reinicia a cada abertura: reabrir a mesma disputa deve mostrá-la de novo do
  // começo, não já terminada.
  useEffect(() => {
    if (aberto) setMostradas(0)
  }, [aberto, cobrancas])

  useEffect(() => {
    if (!aberto || mostradas >= cobrancas.length) return
    const t = setTimeout(() => setMostradas(n => n + 1), INTERVALO_MS)
    return () => clearTimeout(t)
  }, [aberto, mostradas, cobrancas.length])

  if (!aberto) return null

  const visiveis = cobrancas.slice(0, mostradas)
  const acabou = mostradas >= cobrancas.length
  const golsA = visiveis.filter(c => c.lado === "A" && c.converteu).length
  const golsB = visiveis.filter(c => c.lado === "B" && c.converteu).length
  const vencedorNome = vencedorCurto === clubeA.curto ? clubeA.nome : clubeB.nome

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b0b10] p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Disputa de pênaltis</h2>
            <p className="text-xs text-white/45">{clubeA.nome} x {clubeB.nome}</p>
          </div>
          <button type="button" onClick={onFechar} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Placar corrente da disputa */}
        <div className="mb-5 flex items-center justify-center gap-5 rounded-xl border border-white/[0.08] bg-white/[0.02] py-4">
          <div className="flex flex-col items-center gap-1.5">
            <TeamCrest teamShort={clubeA.curto} size="md" />
            <span className="max-w-[110px] truncate text-xs text-white/60">{clubeA.nome}</span>
          </div>
          <div className="text-3xl font-bold tabular-nums text-white">
            {acabou ? placar[0] : golsA}
            <span className="mx-2 text-white/25">-</span>
            {acabou ? placar[1] : golsB}
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <TeamCrest teamShort={clubeB.curto} size="md" />
            <span className="max-w-[110px] truncate text-xs text-white/60">{clubeB.nome}</span>
          </div>
        </div>

        {/* Cobranças */}
        <div className="mb-4 max-h-64 space-y-1.5 overflow-y-auto">
          {visiveis.map((c) => {
            const doA = c.lado === "A"
            return (
              <div
                key={c.ordem}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                  doA ? "justify-start bg-white/[0.04]" : "flex-row-reverse justify-start bg-white/[0.02]",
                )}
              >
                {c.converteu
                  ? <Check className="h-4 w-4 shrink-0 text-[var(--brand)]" />
                  : <Circle className="h-4 w-4 shrink-0 text-red-400" />}
                <span className="text-white/80">{c.batedor}</span>
                <span className={cn("text-xs", c.converteu ? "text-[var(--brand)]/70" : "text-red-400/80")}>
                  {c.converteu ? "converteu" : "perdeu"}
                </span>
                {c.decisiva && (
                  <span className="rounded bg-[#ffd700]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#ffd700]">
                    decisiva
                  </span>
                )}
                <span className="ml-auto shrink-0 text-[10px] text-white/25">{c.ordem}ª</span>
              </div>
            )
          })}
          {visiveis.length === 0 && (
            <p className="py-6 text-center text-sm text-white/35">Os batedores vão para a marca...</p>
          )}
        </div>

        {acabou ? (
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-[var(--brand)]">
              <Trophy className="h-4 w-4" /> {vencedorNome} avança.
            </p>
            <button
              type="button"
              onClick={onFechar}
              className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-black hover:brightness-110"
            >
              Fechar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setMostradas(cobrancas.length)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 py-2 text-sm text-white/60 hover:border-white/25 hover:text-white"
          >
            <SkipForward className="h-4 w-4" /> Pular para o resultado
          </button>
        )}
      </div>
    </div>
  )
}

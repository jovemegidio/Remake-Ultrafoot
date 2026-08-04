"use client"

import { useMemo, useState } from "react"
import { CalendarDays, Globe2, X } from "lucide-react"
import { jogosDaJanelaFifa, tituloDaJanela } from "@/lib/data-fifa-espectador"
import { NationalCrest } from "@/components/national/national-crest"
import { getNationalTeamById } from "@/lib/national-teams"
import { cn } from "@/lib/utils"

/**
 * Central da Data FIFA — o irmao da Central do Mundial para as janelas comuns.
 *
 * O Mundial ja tinha painel; Marco, Setembro, Outubro e Novembro nao tinham
 * nada, entao o tecnico que nao dirige selecao so via o campeonato parar. Aqui
 * ele acompanha Eliminatorias, Liga das Nacoes e amistosos das confederacoes
 * enquanto avanca a janela.
 */

interface DataFifaCenterProps {
  open: boolean
  temporada: number
  /** Mes do jogo (0 = Janeiro), usado para escolher a janela. */
  mes: number
  semanaAtual: number
  ateSemana: number
  onClose: () => void
  onAvancar: () => Promise<void>
}

/** NationalCrest exige um time nao-nulo; a selecao sempre existe no banco, mas
 * o fallback evita que um id novo derrube a tela inteira. */
function escudo(id: string, sigla: string) {
  return getNationalTeamById(id) ?? { id, code: sigla, cor1: "#1e293b", cor2: "#0f172a" }
}

export function DataFifaCenter({
  open,
  temporada,
  mes,
  semanaAtual,
  ateSemana,
  onClose,
  onAvancar,
}: DataFifaCenterProps) {
  const [avancando, setAvancando] = useState(false)
  const blocos = useMemo(() => jogosDaJanelaFifa(temporada, mes), [temporada, mes])
  const [confSelecionada, setConfSelecionada] = useState<string | null>(null)

  if (!open) return null

  const bloco = blocos.find(b => b.confederacao === confSelecionada) ?? blocos[0]
  const ultimoPasso = semanaAtual + 1 >= ateSemana

  const avancar = async () => {
    if (avancando) return
    setAvancando(true)
    try {
      await onAvancar()
      if (ultimoPasso) onClose()
    } finally {
      setAvancando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/85 p-4 backdrop-blur-xl">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#080d13] shadow-[0_30px_120px_rgba(0,0,0,.75)]">
        <header className="relative overflow-hidden border-b border-white/10 px-6 py-5 md:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(56,189,248,.18),transparent_48%)]" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-2xl border border-sky-300/25 bg-sky-300/10">
                <CalendarDays className="h-7 w-7 text-sky-300" />
              </div>
              <div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.22em] text-sky-300">
                  <Globe2 className="h-3.5 w-3.5" /> Central da Data FIFA
                </div>
                <h2 className="mt-1 text-2xl font-black uppercase tracking-tight text-white">
                  {tituloDaJanela(mes)}
                </h2>
                <p className="mt-1 text-xs text-white/45">
                  Os campeonatos de clubes estão pausados — aproveite para treinar e ajustar o elenco.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl border border-white/10 p-2 text-white/45 transition hover:bg-white/10 hover:text-white"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="border-b border-white/[0.07] px-6 py-4 md:px-8">
          <div className="flex gap-2 overflow-x-auto">
            {blocos.map(item => (
              <button
                key={item.confederacao}
                onClick={() => setConfSelecionada(item.confederacao)}
                className={cn(
                  "min-w-max rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition",
                  item.confederacao === bloco?.confederacao
                    ? "border-sky-300/35 bg-sky-300/10 text-sky-200"
                    : "border-white/8 text-white/30 hover:text-white/60",
                )}
              >
                {item.confederacao}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 md:px-8">
          {bloco ? (
            <>
              <div className="mb-4">
                <div className="text-sm font-bold text-white">{bloco.rotuloConfederacao}</div>
                <div className="text-[11px] uppercase tracking-wider text-sky-300/70">{bloco.competicao}</div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {bloco.jogos.map(jogo => (
                  <div
                    key={`${jogo.mandanteId}-${jogo.visitanteId}`}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <NationalCrest team={escudo(jogo.mandanteId, jogo.siglaMandante)} size={22} />
                      <span className="truncate text-xs font-semibold text-white/85">{jogo.mandante}</span>
                    </div>
                    <div className="shrink-0 rounded-lg bg-black/40 px-2.5 py-1 text-sm font-black tabular-nums text-white">
                      {jogo.golsMandante} <span className="text-white/25">×</span> {jogo.golsVisitante}
                    </div>
                    <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                      <span className="truncate text-right text-xs font-semibold text-white/85">{jogo.visitante}</span>
                      <NationalCrest team={escudo(jogo.visitanteId, jogo.siglaVisitante)} size={22} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-center text-sm text-white/40">Sem jogos de seleção nesta janela.</p>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-white/10 px-6 py-4 md:px-8">
          <span className="text-[11px] text-white/35">
            {ultimoPasso ? "Última semana da pausa" : `Pausa até a semana ${ateSemana}`}
          </span>
          <button
            onClick={avancar}
            disabled={avancando}
            className="rounded-xl bg-gradient-to-r from-sky-400 to-cyan-400 px-5 py-2.5 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-50"
          >
            {avancando ? "Avançando..." : ultimoPasso ? "Voltar ao clube" : "Avançar semana"}
          </button>
        </footer>
      </div>
    </div>
  )
}

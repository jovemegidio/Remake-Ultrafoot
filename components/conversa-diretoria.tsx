"use client"

// A CONVERSA COM A DIRETORIA — escolhe o assunto, escolhe o tom, e o clube
// responde de acordo com o que você vem entregando. Ver lib/conversa-diretoria.ts
// (inclusive o porquê de não ser um chat de IA em nuvem).

import { useMemo, useState } from "react"
import { Building2, X } from "lucide-react"
import { formatCurrency } from "@/lib/teams-data"
import {
  ASSUNTOS,
  RESPOSTAS,
  aberturaDaDiretoria,
  responderDiretoria,
  type AssuntoDaDiretoria,
  type DesfechoDaConversa,
  type EstadoDaDiretoria,
  type FalaDaConversa,
} from "@/lib/conversa-diretoria"
import { cn } from "@/lib/utils"

export function ConversaDiretoria({
  aberto,
  onFechar,
  clube,
  estado,
  onDesfecho,
}: {
  aberto: boolean
  onFechar: () => void
  clube: string
  estado: EstadoDaDiretoria
  /** Aplica o resultado no save: confiança, verba liberada, meta nova. */
  onDesfecho: (d: DesfechoDaConversa) => void
}) {
  const [assunto, setAssunto] = useState<AssuntoDaDiretoria | null>(null)
  const [falas, setFalas] = useState<FalaDaConversa[]>([])
  const [encerrada, setEncerrada] = useState(false)

  const opcoes = useMemo(() => (assunto ? RESPOSTAS[assunto] : []), [assunto])

  if (!aberto) return null

  const abrirAssunto = (id: AssuntoDaDiretoria) => {
    setAssunto(id)
    setEncerrada(false)
    setFalas([{ autor: "diretoria", texto: aberturaDaDiretoria(id, estado) }])
  }

  const responder = (tom: (typeof opcoes)[number]) => {
    if (!assunto) return
    const desfecho = responderDiretoria(assunto, tom.id, estado)
    setFalas(f => [
      ...f,
      { autor: "tecnico", texto: tom.texto },
      { autor: "diretoria", texto: desfecho.resposta },
    ])
    setEncerrada(true)
    onDesfecho(desfecho)
  }

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-black/75 p-6" onClick={onFechar}>
      <div
        className="flex max-h-[80%] w-full max-w-xl flex-col rounded-2xl border border-white/10 bg-[#0c0c14]"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/[0.06] p-5">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-white">
              <Building2 className="h-5 w-5 text-[var(--brand)]" />
              Reunião com a diretoria
            </h2>
            <p className="mt-1 text-sm text-white/50">
              {clube} · confiança da diretoria em {Math.round(estado.confianca)}%
            </p>
          </div>
          <button onClick={onFechar} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="scrollbar-game min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          {!assunto ? (
            <>
              <p className="text-sm text-white/55">Sobre o que você quer falar?</p>
              {ASSUNTOS.map(a => (
                <button
                  key={a.id}
                  onClick={() => abrirAssunto(a.id)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition-colors hover:border-[var(--brand)]/40 hover:bg-white/[0.06]"
                >
                  <span className="block text-sm font-semibold text-white">{a.titulo}</span>
                  <span className="block text-xs text-white/45">{a.descricao}</span>
                </button>
              ))}
            </>
          ) : (
            falas.map((f, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  f.autor === "diretoria"
                    ? "bg-white/[0.06] text-white/80"
                    : "ml-auto bg-[var(--brand)]/15 text-[var(--brand)]",
                )}
              >
                {f.texto}
              </div>
            ))
          )}
        </div>

        {assunto && (
          <footer className="border-t border-white/[0.06] p-4">
            {encerrada ? (
              <div className="flex justify-between gap-3">
                <button
                  onClick={() => { setAssunto(null); setFalas([]); setEncerrada(false) }}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white/60 hover:bg-white/10"
                >
                  Outro assunto
                </button>
                <button
                  onClick={onFechar}
                  className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-black text-[var(--brand-ink)]"
                >
                  Encerrar reunião
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {opcoes.map(op => (
                  <button
                    key={op.id}
                    onClick={() => responder(op)}
                    className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left text-sm text-white/75 transition-colors hover:border-[var(--brand)]/40 hover:text-white"
                  >
                    {op.texto}
                  </button>
                ))}
                <p className="pt-1 text-center text-[11px] text-white/30">
                  Caixa do clube: {formatCurrency(estado.caixa)} · meta: até o {estado.metaPosicao}º
                </p>
              </div>
            )}
          </footer>
        )}
      </div>
    </div>
  )
}

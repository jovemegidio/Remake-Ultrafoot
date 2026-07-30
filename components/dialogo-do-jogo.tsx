"use client"

// O modal que substitui as caixas do Windows (ver lib/dialogo-do-jogo.ts).
// Montado UMA vez no layout: qualquer tela chama `avisar()`/`confirmar()` e o
// aviso aparece aqui, com a cara do jogo.

import { useEffect, useState, useSyncExternalStore } from "react"
import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react"
import {
  assinarDialogos,
  dialogoAtual,
  dialogoAtualNoServidor,
  responderDialogo,
  type TomDoDialogo,
} from "@/lib/dialogo-do-jogo"
import { cn } from "@/lib/utils"

const ESTILO: Record<TomDoDialogo, { icone: typeof Info; cor: string; fundo: string; borda: string; botao: string }> = {
  info: {
    icone: Info,
    cor: "text-[var(--brand)]",
    fundo: "bg-[var(--brand)]/12",
    borda: "border-[var(--brand)]/20",
    botao: "bg-[var(--brand)] text-[var(--brand-ink)] hover:brightness-110",
  },
  sucesso: {
    icone: CheckCircle2,
    cor: "text-emerald-400",
    fundo: "bg-emerald-400/12",
    borda: "border-emerald-400/20",
    botao: "bg-emerald-500 text-black hover:brightness-110",
  },
  alerta: {
    icone: AlertTriangle,
    cor: "text-amber-400",
    fundo: "bg-amber-400/12",
    borda: "border-amber-400/20",
    botao: "bg-amber-400 text-black hover:brightness-110",
  },
  perigo: {
    icone: OctagonAlert,
    cor: "text-red-400",
    fundo: "bg-red-500/12",
    borda: "border-red-500/25",
    botao: "bg-red-500 text-white hover:bg-red-400",
  },
}

export function DialogoDoJogo() {
  const pedido = useSyncExternalStore(assinarDialogos, dialogoAtual, dialogoAtualNoServidor)
  const [texto, setTexto] = useState("")

  // Cada diálogo com campo começa do valor inicial dele.
  useEffect(() => {
    setTexto(pedido?.campo?.valorInicial ?? "")
  }, [pedido?.id, pedido?.campo?.valorInicial])

  // Enter confirma, Esc cancela — o mesmo reflexo da caixa nativa que isto
  // substitui. Sem `capture` outros handlers de tela (o Enter do modal de saves,
  // por exemplo) chegariam antes.
  useEffect(() => {
    if (!pedido) return
    const negativa = pedido.campo ? null : pedido.cancelar ? false : true
    const positiva = pedido.campo ? texto.trim() : true
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault(); e.stopPropagation()
        if (pedido.campo && !texto.trim()) return
        responderDialogo(positiva)
      } else if (e.key === "Escape") {
        e.preventDefault(); e.stopPropagation()
        responderDialogo(negativa)
      }
    }
    window.addEventListener("keydown", aoTeclar, true)
    return () => window.removeEventListener("keydown", aoTeclar, true)
  }, [pedido, texto])

  if (!pedido) return null

  const estilo = ESTILO[pedido.tom]
  const Icone = estilo.icone
  const ehConfirmacao = Boolean(pedido.cancelar)
  /** O que "fechar sem responder" significa neste diálogo. */
  const respostaNegativa = pedido.campo ? null : ehConfirmacao ? false : true
  const respostaPositiva = pedido.campo ? texto.trim() : true

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-black/75 p-6"
      // Clicar fora equivale a fechar: cancela a confirmação, encerra o aviso.
      onClick={() => responderDialogo(respostaNegativa)}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c14] shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
        onClick={e => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-4 p-6">
          <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl border", estilo.fundo, estilo.borda)}>
            <Icone className={cn("h-5 w-5", estilo.cor)} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold leading-snug text-white">{pedido.titulo}</h2>
            {/* whitespace-pre-line: as mensagens vieram do window.alert e usam \n. */}
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-white/60">
              {pedido.mensagem}
            </p>
            {pedido.campo && (
              <input
                autoFocus
                value={texto}
                onChange={e => setTexto(e.target.value)}
                placeholder={pedido.campo.placeholder}
                maxLength={80}
                className="mt-4 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[var(--brand)]/40 focus:outline-none"
              />
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-white/[0.06] bg-white/[0.02] px-6 py-4">
          {ehConfirmacao && (
            <button
              onClick={() => responderDialogo(respostaNegativa)}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white/60 transition-colors hover:bg-white/[0.07] hover:text-white"
            >
              {pedido.cancelar}
            </button>
          )}
          <button
            autoFocus={!pedido.campo}
            disabled={Boolean(pedido.campo) && !texto.trim()}
            onClick={() => responderDialogo(respostaPositiva)}
            className={cn("rounded-xl px-5 py-2.5 text-sm font-bold transition-all disabled:opacity-40", estilo.botao)}
          >
            {pedido.confirmar}
          </button>
        </div>
      </div>
    </div>
  )
}

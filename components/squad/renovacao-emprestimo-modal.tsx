"use client"

// MESA DE RENOVAÇÃO DE EMPRÉSTIMO — você x o clube DONO do passe.
//
// Não é um botão de "renovar": o dono pede termos, você responde, ele volta com
// contraproposta. Duas rodadas; sem acordo, o vínculo acaba na data e o atleta
// volta para casa. A cabeça do outro lado está em lib/emprestimos.ts — aqui só
// mora a tela.

import { useMemo, useState } from "react"
import { ArrowLeftRight, Check, Handshake, X } from "lucide-react"
import { formatCurrency } from "@/lib/currency"
import {
  pedidoInicial,
  responderRenovacao,
  type ContextoDaRenovacao,
  type RespostaDoDono,
  type TermosDeEmprestimo,
} from "@/lib/emprestimos"
import { cn } from "@/lib/utils"

export function RenovacaoEmprestimoModal({
  aberto,
  onFechar,
  nome,
  clubeDono,
  contexto,
  onAcordo,
}: {
  aberto: boolean
  onFechar: () => void
  nome: string
  clubeDono: string
  contexto: ContextoDaRenovacao
  /** Acordo fechado: estenda o vínculo com estes termos. */
  onAcordo: (termos: TermosDeEmprestimo) => void
}) {
  const semente = `${nome}:${clubeDono}:${contexto.semanasNoClube}`
  const pedido = useMemo(() => pedidoInicial(contexto, semente), [contexto, semente])

  const [termos, setTermos] = useState<TermosDeEmprestimo>(pedido)
  const [rodada, setRodada] = useState(0)
  const [resposta, setResposta] = useState<RespostaDoDono | null>(null)

  if (!aberto) return null

  const encerrado = resposta?.aceito || (resposta && !resposta.contraproposta)
  const custoTotal = termos.taxa + (termos.coberturaSalarial / 100) * contexto.salarioSemanal * termos.semanas

  const enviar = () => {
    const r = responderRenovacao(termos, contexto, rodada, semente)
    setResposta(r)
    if (r.aceito) {
      onAcordo(termos)
      return
    }
    if (r.contraproposta) {
      setTermos(r.contraproposta)
      setRodada(n => n + 1)
    }
  }

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-black/75 p-6" onClick={onFechar}>
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0c0c14] p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-white">
              <ArrowLeftRight className="h-5 w-5 text-sky-300" />
              Renovar o empréstimo de {nome}
            </h2>
            <p className="mt-1 text-sm text-white/50">
              Conversa com o {clubeDono}, dono do passe. {contexto.jogos} jogo
              {contexto.jogos === 1 ? "" : "s"} nesta passagem.
            </p>
          </div>
          <button onClick={onFechar} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* O que o dono pediu de saída */}
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs text-white/60">
          <p className="font-semibold text-white/80">O que o {clubeDono} pede</p>
          <p className="mt-1">
            {formatCurrency(pedido.taxa)} de taxa · {pedido.coberturaSalarial}% do salário coberto ·{" "}
            {pedido.semanas} semanas
          </p>
        </div>

        {/* Seus termos */}
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-white/45">Taxa pelo período</span>
            <input
              type="range"
              min={0}
              max={Math.max(pedido.taxa * 2, 1_000_000)}
              step={50_000}
              value={termos.taxa}
              disabled={Boolean(encerrado)}
              onChange={e => setTermos(t => ({ ...t, taxa: Number(e.target.value) }))}
              className="mt-2 w-full accent-[var(--brand)]"
            />
            <span className="text-sm font-bold text-white">{formatCurrency(termos.taxa)}</span>
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-white/45">Salário coberto</span>
              <input
                type="range"
                min={40}
                max={100}
                step={5}
                value={termos.coberturaSalarial}
                disabled={Boolean(encerrado)}
                onChange={e => setTermos(t => ({ ...t, coberturaSalarial: Number(e.target.value) }))}
                className="mt-2 w-full accent-[var(--brand)]"
              />
              <span className="text-sm font-bold text-white">{termos.coberturaSalarial}%</span>
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wide text-white/45">Duração</span>
              <select
                value={termos.semanas}
                disabled={Boolean(encerrado)}
                onChange={e => setTermos(t => ({ ...t, semanas: Number(e.target.value) }))}
                className="mt-2 w-full rounded bg-black/40 px-2 py-1.5 text-sm text-white"
              >
                <option value={13}>Meia temporada (13 semanas)</option>
                <option value={26}>Uma temporada (26 semanas)</option>
                <option value={52}>Duas temporadas (52 semanas)</option>
              </select>
            </label>
          </div>

          <p className="text-xs text-white/45">
            Custo total para o seu clube: <span className="font-bold text-white">{formatCurrency(custoTotal)}</span>
            {" "}(taxa + salário no período).
          </p>
        </div>

        {/* Resposta do dono */}
        {resposta && (
          <div className={cn(
            "mt-4 flex items-start gap-3 rounded-xl border p-3 text-sm",
            resposta.aceito
              ? "border-[var(--brand)]/30 bg-[var(--brand)]/10 text-[var(--brand)]"
              : resposta.contraproposta
                ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                : "border-red-500/30 bg-red-500/10 text-red-200",
          )}>
            {resposta.aceito ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <X className="mt-0.5 h-4 w-4 shrink-0" />}
            <p>{resposta.recado}</p>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onFechar} className="rounded-lg px-4 py-2 text-sm font-semibold text-white/60 hover:bg-white/10">
            {encerrado ? "Fechar" : "Desistir"}
          </button>
          {!encerrado && (
            <button
              onClick={enviar}
              className="flex items-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-black text-[var(--brand-ink)] transition-all hover:brightness-110"
            >
              <Handshake className="h-4 w-4" />
              {rodada === 0 ? "Enviar proposta" : "Responder"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

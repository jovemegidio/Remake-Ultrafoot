"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, Check, HandCoins, Handshake, X } from "lucide-react"
import {
  computeRenewalDemands,
  custoCheio,
  evaluateRenewal,
  evaluateRescission,
  sugestaoInicialRenovacao,
  ROLE_LABEL,
  type ContractPlayer,
  type RenewalTerms,
} from "@/lib/contract-negotiation"
import type { SquadRole } from "@/lib/negotiation-engine"
import { cn } from "@/lib/utils"

/**
 * Negociacao de RENOVACAO e RESCISAO.
 *
 * Antes os dois botoes executavam direto: renovar gravava o salario e rescindir
 * debitava o custo. Nao havia outro lado da mesa. Agora ha rodadas — o agente
 * contrapropoe, o clube ajusta, e da para sair sem acordo.
 *
 * A contraproposta e CLICAVEL de proposito: recusar uma exigencia e uma decisao,
 * mas obrigar o usuario a redigitar os numeros dela nao e desafio, e trabalho
 * repetitivo.
 */

type Modo = "renovar" | "rescindir"

const PAPEIS: SquadRole[] = ["banco", "reforco", "primordial"]

function moeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
}

function Campo({
  rotulo, valor, onChange, passo, min, sufixo,
}: {
  rotulo: string
  valor: number
  onChange: (v: number) => void
  passo: number
  min: number
  sufixo?: string
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-wider text-white/40">{rotulo}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, valor - passo))}
          className="h-8 w-8 shrink-0 rounded-lg border border-white/10 text-white/60 transition-colors hover:border-white/30 hover:text-white"
        >
          −
        </button>
        <input
          type="number"
          value={valor}
          min={min}
          step={passo}
          onChange={e => onChange(Math.max(min, Number(e.target.value) || min))}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-center text-sm font-semibold text-white outline-none focus:border-[var(--brand)]/60"
        />
        <button
          type="button"
          onClick={() => onChange(valor + passo)}
          className="h-8 w-8 shrink-0 rounded-lg border border-white/10 text-white/60 transition-colors hover:border-white/30 hover:text-white"
        >
          +
        </button>
      </div>
      {sufixo && <span className="text-[10px] text-white/30">{sufixo}</span>}
    </label>
  )
}

export function ContractNegotiationModal({
  open, modo, player, clubPrestige, clubBalance, onClose, onRenew, onRescind,
}: {
  open: boolean
  modo: Modo
  player: ContractPlayer
  clubPrestige: number
  clubBalance: number
  onClose: () => void
  onRenew: (terms: RenewalTerms) => void
  onRescind: (valor: number) => void
}) {
  const exigencias = useMemo(
    () => computeRenewalDemands(player, clubPrestige),
    [player, clubPrestige],
  )
  const [terms, setTerms] = useState<RenewalTerms>(() => sugestaoInicialRenovacao(player, clubPrestige))
  const [oferta, setOferta] = useState(() => Math.round(custoCheio(player) * 0.6))
  const [rodada, setRodada] = useState(0)
  const [resposta, setResposta] = useState<{
    verdict: string; message: string; counter?: RenewalTerms; counterAmount?: number
  } | null>(null)

  if (!open) return null

  const cheio = custoCheio(player)

  const negociarRenovacao = () => {
    const r = evaluateRenewal(player, clubPrestige, terms)
    setRodada(n => n + 1)
    setResposta({
      verdict: r.verdict,
      message: r.message,
      counter: r.counter
        ? {
            salary: r.counter.salary,
            contractYears: r.counter.contractYears,
            loyaltyBonus: r.counter.signingBonus,
            role: r.counter.role,
          }
        : undefined,
    })
    if (r.verdict === "accepted") onRenew(terms)
  }

  const negociarRescisao = () => {
    const r = evaluateRescission(player, oferta)
    setRodada(n => n + 1)
    setResposta({ verdict: r.verdict, message: r.message, counterAmount: r.counterAmount })
    if (r.verdict === "accepted") onRescind(oferta)
  }

  const semCaixa = modo === "rescindir" ? oferta > clubBalance : terms.loyaltyBonus > clubBalance

  return (
    <div
      role="dialog"
      className="fixed inset-0 z-[90] flex items-center justify-center uf-veu p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#0b0f12] p-6 shadow-2xl scrollbar-game"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--brand)]/70">
              {modo === "renovar" ? "Renovacao de contrato" : "Rescisao de contrato"}
            </div>
            <h2 className="uf-heading mt-1 text-xl font-black text-white">{player.name}</h2>
            <p className="text-xs text-white/40">
              {player.overall} OVR · {player.age} anos · {moeda(player.salary)}/mes ·{" "}
              {player.weeksLeft} semanas de contrato
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-white/40 hover:bg-white/5 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {modo === "renovar" ? (
          <>
            {/* O pedido do agente fica VISIVEL. Esconder a exigencia nao cria
                tensao, cria tentativa e erro as cegas. */}
            <div className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs">
              <div className="mb-1.5 font-semibold text-white/70">O que o estafe pede</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-white/50">
                <span>Salario: <b className="text-white/80">{moeda(exigencias.salary)}</b></span>
                <span>Premio: <b className="text-white/80">{moeda(exigencias.signingBonus)}</b></span>
                <span>Duracao: <b className="text-white/80">{exigencias.contractYears} anos</b></span>
                <span>Papel min.: <b className="text-white/80">{ROLE_LABEL[exigencias.minRole]}</b></span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Salario mensal" valor={terms.salary} min={1000} passo={5000}
                onChange={v => setTerms(t => ({ ...t, salary: v }))} sufixo={moeda(terms.salary)} />
              <Campo rotulo="Premio por renovar" valor={terms.loyaltyBonus} min={0} passo={10000}
                onChange={v => setTerms(t => ({ ...t, loyaltyBonus: v }))} sufixo={moeda(terms.loyaltyBonus)} />
              <Campo rotulo="Duracao (anos)" valor={terms.contractYears} min={1} passo={1}
                onChange={v => setTerms(t => ({ ...t, contractYears: Math.min(5, v) }))} />
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] uppercase tracking-wider text-white/40">Papel no elenco</span>
                <div className="flex gap-1">
                  {PAPEIS.map(p => (
                    <button
                      key={p}
                      onClick={() => setTerms(t => ({ ...t, role: p }))}
                      className={cn(
                        "flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors",
                        terms.role === p
                          ? "border-[var(--brand)]/60 bg-[var(--brand)]/10 text-[var(--brand)]"
                          : "border-white/10 text-white/50 hover:border-white/25",
                      )}
                    >
                      {ROLE_LABEL[p]}
                    </button>
                  ))}
                </div>
              </label>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs text-white/55">
              Pagar o contrato ate o fim custaria <b className="text-white/85">{moeda(cheio)}</b>.
              Voce pode oferecer menos — quem quer jogar costuma abrir mao de parte.
            </div>
            <Campo rotulo="Valor oferecido" valor={oferta} min={0} passo={Math.max(10000, Math.round(cheio / 20))}
              onChange={setOferta} sufixo={`${moeda(oferta)} · ${cheio > 0 ? Math.round((oferta / cheio) * 100) : 100}% do contrato`} />
          </>
        )}

        {semCaixa && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/[0.07] px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />
            <span className="text-[11px] text-red-200/85">
              O clube tem {moeda(clubBalance)} em caixa. Esse valor nao cabe.
            </span>
          </div>
        )}

        {resposta && (
          <div
            className={cn(
              "mt-4 rounded-xl border p-3",
              resposta.verdict === "accepted" ? "border-emerald-500/30 bg-emerald-500/[0.07]"
                : resposta.verdict === "counter" ? "border-amber-500/30 bg-amber-500/[0.07]"
                  : "border-red-500/30 bg-red-500/[0.07]",
            )}
          >
            <div className="flex items-start gap-2">
              {resposta.verdict === "accepted" ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                : resposta.verdict === "counter" ? <HandCoins className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  : <X className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />}
              <p className="text-xs leading-relaxed text-white/80">{resposta.message}</p>
            </div>

            {/* Aceitar a contraproposta com UM clique. */}
            {resposta.counter && (
              <button
                onClick={() => { setTerms(resposta.counter!); setResposta(null) }}
                className="mt-3 w-full rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-[11px] font-bold text-amber-200 hover:bg-amber-400/20"
              >
                Aceitar exigencia — {moeda(resposta.counter.salary)}/mes · {resposta.counter.contractYears} anos ·{" "}
                {ROLE_LABEL[resposta.counter.role]}
              </button>
            )}
            {resposta.counterAmount !== undefined && (
              <button
                onClick={() => { setOferta(resposta.counterAmount!); setResposta(null) }}
                className="mt-3 w-full rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-[11px] font-bold text-amber-200 hover:bg-amber-400/20"
              >
                Aceitar {moeda(resposta.counterAmount)}
              </button>
            )}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="text-[10px] text-white/25">
            {rodada === 0 ? "Nenhuma proposta enviada" : `${rodada} ${rodada === 1 ? "proposta enviada" : "propostas enviadas"}`}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-white/55 hover:text-white"
            >
              Sair sem acordo
            </button>
            <button
              onClick={modo === "renovar" ? negociarRenovacao : negociarRescisao}
              disabled={semCaixa || resposta?.verdict === "accepted"}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[var(--brand)] to-[var(--brand-2)] px-5 py-2 text-xs font-bold text-black transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Handshake className="h-3.5 w-3.5" />
              {resposta?.verdict === "accepted" ? "Acordo fechado" : "Enviar proposta"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

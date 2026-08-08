"use client"

// PAINEL DO TREINADOR — o que ele precisa saber antes de decidir qualquer coisa.
//
// A área do treinador tinha o retrospecto e o mercado de técnicos, mas as três
// perguntas que ele realmente faz ao sentar na mesa estavam espalhadas por
// outras telas: "o que a diretoria cobra de mim?" (escritório), "quanto sobra
// por semana?" (finanças) e "onde meu elenco está fraco?" (não existia em lugar
// nenhum — o jogador tinha de abrir o elenco e contar de cabeça).
//
// Nada aqui inventa dado novo: metas vêm do `board-engine`, o caixa do motor, e
// a carência por posição sai do MESMO `necessidadeNaPosicao` que o mercado usa
// para decidir o que a IA oferece. Se a comissão técnica aponta um zagueiro, é
// porque o mercado também o considera necessário — as duas leituras não brigam.

import { Target, Wallet, ClipboardCheck, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react"
import { formatCurrency } from "@/lib/teams-data"
import { perfilDeElenco, necessidadeNaPosicao, type AtletaDoElenco } from "@/lib/mercado-realista"
import { cn } from "@/lib/utils"

/** Posições que a comissão avalia, na ordem em que um técnico pensa o time. */
const POSICOES = ["GOL", "ZAG", "LD", "LE", "VOL", "MEI", "PD", "PE", "ATA"] as const

export interface MetaDaDiretoria {
  rotulo: string
  detalhe?: string
  progresso?: number
  cumprida?: boolean
}

export function PainelDoTreinador({
  metas,
  confianca,
  statusCarreira,
  caixa,
  receitaSemanal,
  despesaSemanal,
  elenco,
  className,
}: {
  metas: MetaDaDiretoria[]
  confianca: number
  statusCarreira?: string
  caixa: number
  receitaSemanal: number
  despesaSemanal: number
  elenco: readonly AtletaDoElenco[]
  className?: string
}) {
  const saldoSemanal = receitaSemanal - despesaSemanal

  // ── Carências por posição ────────────────────────────────────────────────
  // Só entra na lista quem passa de 0,35: abaixo disso o setor está atendido, e
  // uma lista com as nove posições sempre presentes não indicaria nada.
  const perfil = elenco.length ? perfilDeElenco(elenco) : null
  const carencias = perfil
    ? POSICOES
        .map(pos => ({ pos, n: necessidadeNaPosicao(perfil, pos) }))
        .filter(c => c.n > 0.35)
        .sort((a, b) => b.n - a.n)
        .slice(0, 4)
    : []

  return (
    <div className={cn("grid gap-4 lg:grid-cols-3", className)}>
      {/* ── METAS DA DIRETORIA ──────────────────────────────────────────── */}
      <Cartao icone={<Target className="h-4 w-4" />} titulo="Metas da diretoria"
        acessorio={
          <span className={cn("rounded px-2 py-0.5 text-[10px] font-black",
            confianca >= 60 ? "bg-emerald-500/15 text-emerald-300"
              : confianca >= 35 ? "bg-amber-400/15 text-amber-300"
              : "bg-red-500/15 text-red-300")}>
            {confianca}% {statusCarreira ? `· ${statusCarreira}` : ""}
          </span>
        }
      >
        {metas.length === 0 ? (
          <p className="text-xs text-white/35">A diretoria ainda não fixou cobranças para esta temporada.</p>
        ) : (
          <ul className="space-y-2.5">
            {metas.map((m, i) => (
              <li key={i}>
                <div className="flex items-start gap-2">
                  <ClipboardCheck className={cn("mt-0.5 h-3.5 w-3.5 shrink-0",
                    m.cumprida ? "text-emerald-400" : "text-white/25")} />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-xs font-medium", m.cumprida ? "text-emerald-300" : "text-white/80")}>
                      {m.rotulo}
                    </p>
                    {m.detalhe && <p className="text-[10px] leading-tight text-white/35">{m.detalhe}</p>}
                    {typeof m.progresso === "number" && (
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.07]">
                        <div
                          className={cn("h-full rounded-full", m.cumprida ? "bg-emerald-400" : "bg-[var(--brand)]")}
                          style={{ width: `${Math.round(Math.max(0, Math.min(1, m.progresso)) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      {/* ── FINANCEIRO ──────────────────────────────────────────────────── */}
      <Cartao icone={<Wallet className="h-4 w-4" />} titulo="Financeiro">
        <div className="space-y-2.5">
          <Linha rotulo="Caixa disponível" valor={formatCurrency(caixa)} forte />
          <Linha rotulo="Receita semanal" valor={formatCurrency(receitaSemanal)} tom="bom" />
          <Linha rotulo="Despesa semanal" valor={formatCurrency(despesaSemanal)} tom="ruim" />
          <div className="border-t border-white/[0.07] pt-2.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-white/55">
                {saldoSemanal >= 0
                  ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                  : <TrendingDown className="h-3.5 w-3.5 text-red-400" />}
                Saldo por semana
              </span>
              <span className={cn("text-sm font-black tabular-nums",
                saldoSemanal >= 0 ? "text-emerald-300" : "text-red-300")}>
                {saldoSemanal >= 0 ? "+" : ""}{formatCurrency(saldoSemanal)}
              </span>
            </div>
            {/* O número que muda decisão: quantas semanas o caixa aguenta no
                ritmo atual. Só faz sentido quando o clube perde dinheiro. */}
            {saldoSemanal < 0 && caixa > 0 && (
              <p className="mt-1 flex items-center gap-1 text-[10px] text-amber-300/80">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                No ritmo atual, o caixa cobre {Math.floor(caixa / Math.abs(saldoSemanal))} semana(s).
              </p>
            )}
          </div>
        </div>
      </Cartao>

      {/* ── INDICAÇÕES DA COMISSÃO ──────────────────────────────────────── */}
      <Cartao icone={<ClipboardCheck className="h-4 w-4" />} titulo="Indicações da comissão">
        {carencias.length === 0 ? (
          <p className="text-xs text-white/35">
            {elenco.length === 0
              ? "Sem elenco carregado para avaliar."
              : "Nenhum setor pede reforço: o elenco está equilibrado em número e nível."}
          </p>
        ) : (
          <>
            <p className="mb-2.5 text-[10px] leading-tight text-white/35">
              Por número de atletas e nível do setor comparado ao time.
            </p>
            <ul className="space-y-2">
              {carencias.map(({ pos, n }) => {
                const urgencia = n > 0.7 ? "urgente" : n > 0.5 ? "importante" : "desejável"
                const tom = n > 0.7 ? "text-red-300" : n > 0.5 ? "text-amber-300" : "text-white/60"
                return (
                  <li key={pos} className="flex items-center gap-2.5">
                    <span className="w-9 shrink-0 rounded bg-white/[0.06] py-1 text-center text-[10px] font-black text-white/70">
                      {pos}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                        <div
                          className={cn("h-full rounded-full",
                            n > 0.7 ? "bg-red-400" : n > 0.5 ? "bg-amber-400" : "bg-white/35")}
                          style={{ width: `${Math.round(n * 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className={cn("shrink-0 text-[10px] font-bold uppercase", tom)}>{urgencia}</span>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </Cartao>
    </div>
  )
}

function Cartao({ icone, titulo, acessorio, children }: {
  icone: React.ReactNode; titulo: string; acessorio?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-white/[0.07] bg-[#0c0c10] p-4">
      <header className="mb-3 flex items-center gap-2">
        <span className="text-[var(--brand)]">{icone}</span>
        <h3 className="text-sm font-bold text-white">{titulo}</h3>
        {acessorio && <span className="ml-auto">{acessorio}</span>}
      </header>
      {children}
    </section>
  )
}

function Linha({ rotulo, valor, tom, forte }: {
  rotulo: string; valor: string; tom?: "bom" | "ruim"; forte?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-white/55">{rotulo}</span>
      <span className={cn("tabular-nums",
        forte ? "text-sm font-black text-white" : "text-xs font-bold",
        tom === "bom" && "text-emerald-300", tom === "ruim" && "text-red-300",
        !tom && !forte && "text-white/80")}>
        {valor}
      </span>
    </div>
  )
}

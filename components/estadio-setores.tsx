"use client"

// SETORES DO ESTÁDIO — a tela que faltava.
//
// `lib/stadium-sectors.ts` estava pronto e testado desde 29/07/2026 e não tinha
// UM consumidor sequer: capacidade por setor, orçamento de obra, preço por setor
// e humor da torcida existiam só no código. Era o único item da lista de
// "implementado porém desligado" sem equivalente vivo em outro lugar — os demais
// (lesão, treino, julgamento, comissão) são duplicatas mortas de sistemas que já
// rodam dentro do game-engine.
//
// O que esta tela faz, e por que cada parte importa:
//   • PREÇO POR SETOR — cobrar R$ 10 na geral e R$ 70 no camarote é a decisão que
//     o preço global (barato/normal/caro) não permitia. O preço entra na renda da
//     partida de verdade (ver `calcularRenda` no use-game-manager); sem isso a
//     tela seria enfeite.
//   • OBRA POR SETOR — escolher QUAL parte do estádio ampliar, com custo e prazo
//     próprios. A entrega acontece no avanço de semana, não aqui.
//
// O clube que nunca abriu esta tela continua no preço automático: o padrão não
// pode obrigar ninguém a passar por aqui para o jogo funcionar.

import { useMemo, useState } from "react"
import { Building2, Hammer, TicketPercent, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  SETORES, capacidadeTotal, calcularRenda, estadoInicialDoEstadio, iniciarObra,
  orcarObra, precosSugeridos, vagasParaConstruir,
  type PorSetor, type SetorId,
} from "@/lib/stadium-sectors"
import type { GameState } from "@/lib/save-system"
import { formatCurrency, getCurrency } from "@/lib/currency"

/** O que vive no save. `estadoInicialDoEstadio` devolve o mesmo, sem obra. */
type EstadoDoEstadio = NonNullable<GameState["estadioSetores"]>

interface Props {
  saveState: GameState
  setSaveState: (patch: Partial<GameState>) => void
  /** Capacidade que o clube tem hoje, para repartir na primeira vez. */
  capacidadeAtual: number
  prestigio: number
  /** Ocupação projetada do próximo jogo — a mesma que a partida vai usar. */
  ocupacaoProjetada: number
  saldo: number
  /** Debita o caixa; devolve false se não há dinheiro. */
  gastar: (valor: number) => boolean
}

// Moeda do jogador, nao R$ chumbado: `formatCurrency` converte pelo cambio escolhido.
const brl = (n: number) => formatCurrency(Math.round(n))

export function EstadioSetores({
  saveState, setSaveState, capacidadeAtual, prestigio, ocupacaoProjetada, saldo, gastar,
}: Props) {
  const [modalAberto, setModalAberto] = useState(false)
  const [pedido, setPedido] = useState<PorSetor<number>>({ geral: 0, arquibancada: 0, cadeira: 0, camarote: 0 })

  // Migração preguiçosa: o save que ainda não tem setores ganha o estado inicial
  // derivado da capacidade e do tier antigo, sem escrever nada até o técnico agir.
  const estado: EstadoDoEstadio = useMemo(
    () => saveState.estadioSetores ?? estadoInicialDoEstadio({ capacidadeTotal: capacidadeAtual, prestigio }),
    [saveState.estadioSetores, capacidadeAtual, prestigio],
  )
  const sugeridos = useMemo(() => precosSugeridos(prestigio), [prestigio])
  const precos = estado.usarSugeridos ? sugeridos : estado.precos
  const vagas = useMemo(() => vagasParaConstruir(estado.capacidades), [estado.capacidades])
  const orcamento = useMemo(() => orcarObra(estado.capacidades, { lugares: pedido }), [estado.capacidades, pedido])

  const renda = useMemo(
    () => calcularRenda({ capacidades: estado.capacidades, precos, prestigio, atracao: ocupacaoProjetada }),
    [estado.capacidades, precos, prestigio, ocupacaoProjetada],
  )

  const obra = estado.obra
  const emObra = Boolean(obra)

  const gravar = (patch: Partial<NonNullable<GameState["estadioSetores"]>>) =>
    setSaveState({ estadioSetores: { ...estado, ...patch } })

  const mudarPreco = (id: SetorId, valor: number) => {
    gravar({ usarSugeridos: false, precos: { ...precos, [id]: Math.max(1, Math.round(valor)) } })
  }

  const iniciar = () => {
    if (orcamento.totalLugares <= 0 || emObra) return
    if (!gastar(orcamento.custo)) return
    gravar({ obra: iniciarObra(orcamento, saveState.season, saveState.week) })
    setPedido({ geral: 0, arquibancada: 0, cadeira: 0, camarote: 0 })
    setModalAberto(false)
  }

  return (
    <section className="mx-4 mt-4 rounded-xl border border-white/[0.06] bg-[var(--uf-bg-surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-bold text-white">
            <Building2 className="h-4 w-4 text-[var(--brand)]" />
            Setores do estádio
          </h2>
          <p className="mt-1 text-xs text-white/45">
            Cada setor tem preço e capacidade próprios. O que você cobra aqui é o que a bilheteria arrecada na partida.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {estado.usarSugeridos && (
            <span className="rounded bg-white/5 px-2 py-1 text-[10px] uppercase tracking-wide text-white/45">
              preço automático
            </span>
          )}
          <Button size="sm" onClick={() => setModalAberto(true)} disabled={emObra}>
            <Hammer className="mr-1.5 h-3.5 w-3.5" />
            {emObra ? "Obra em andamento" : "Nova obra"}
          </Button>
        </div>
      </div>

      {obra && (
        <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-200/80">
          Obra de {SETORES.reduce((t, s) => t + (obra.lugares[s.id] ?? 0), 0).toLocaleString("pt-BR")} lugares em
          andamento — entrega na semana {obra.terminaEm % 52} de {Math.floor(obra.terminaEm / 52)}.
        </div>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {SETORES.map((s) => {
          const detalhe = renda.porSetor[s.id]
          return (
            <div key={s.id} className="rounded-lg border border-white/[0.05] bg-black/25 p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-white">{s.nome}</span>
                <span className="text-[10px] text-white/40">
                  {(estado.capacidades[s.id] ?? 0).toLocaleString("pt-BR")} lug.
                </span>
              </div>
              <label className="mt-2 block text-[10px] uppercase tracking-wide text-white/40">
                Ingresso
                <div className="mt-1 flex items-center gap-1">
                  <span className="text-xs text-white/50">{getCurrency().symbol}</span>
                  <input
                    type="number"
                    min={1}
                    value={precos[s.id] ?? sugeridos[s.id]}
                    onChange={(e) => mudarPreco(s.id, Number(e.target.value))}
                    className="w-full rounded bg-black/50 p-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-[var(--brand)]"
                  />
                </div>
              </label>
              <div className="mt-2 text-[10px] text-white/40">
                sugerido {brl(sugeridos[s.id])} · ocupação {(detalhe.ocupacao * 100).toFixed(0)}%
              </div>
              <div className="mt-1 text-xs text-white/70">
                {detalhe.publico.toLocaleString("pt-BR")} pagantes · <b className="text-white">{brl(detalhe.renda)}</b>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded bg-black/25 p-2 text-white/55">
          Capacidade total <b className="block text-white">{capacidadeTotal(estado.capacidades).toLocaleString("pt-BR")}</b>
        </div>
        <div className="rounded bg-black/25 p-2 text-white/55">
          Público projetado <b className="block text-white">{renda.publico.toLocaleString("pt-BR")}</b>
        </div>
        <div className="rounded bg-black/25 p-2 text-white/55">
          Renda por jogo <b className="block text-[var(--brand)]">{brl(renda.renda)}</b>
        </div>
      </div>

      {!estado.usarSugeridos && (
        <button
          onClick={() => gravar({ usarSugeridos: true })}
          className="mt-2 text-[11px] text-white/40 underline-offset-2 hover:text-white/70 hover:underline"
        >
          Voltar ao preço sugerido
        </button>
      )}

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center uf-veu p-4">
          <div className="w-full max-w-lg rounded-xl border border-white/10 bg-[var(--uf-bg-surface)] p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="flex items-center gap-2 font-bold text-white">
                  <Hammer className="h-4 w-4 text-[var(--brand)]" />
                  Nova obra
                </h3>
                <p className="mt-1 text-xs text-white/45">
                  Os setores são frentes separadas, então a obra corre em paralelo: o prazo é o do setor mais demorado.
                </p>
              </div>
              <button onClick={() => setModalAberto(false)} className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {SETORES.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-lg bg-black/30 p-2.5">
                  <div className="flex-1">
                    <div className="text-sm text-white">{s.nome}</div>
                    <div className="text-[10px] text-white/40">
                      cabem +{vagas[s.id].toLocaleString("pt-BR")} · {brl(s.custoPorLugar)}/lugar · {s.ritmoObra}/semana
                    </div>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={vagas[s.id]}
                    value={pedido[s.id]}
                    onChange={(e) => setPedido({ ...pedido, [s.id]: Math.max(0, Number(e.target.value)) })}
                    className="w-28 rounded bg-black/50 p-1.5 text-right text-sm text-white outline-none focus:ring-1 focus:ring-[var(--brand)]"
                  />
                </div>
              ))}
            </div>

            {orcamento.aviso && <p className="mt-3 text-xs text-amber-300/80">{orcamento.aviso}</p>}

            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded bg-black/30 p-2 text-white/55">
                Lugares <b className="block text-white">{orcamento.totalLugares.toLocaleString("pt-BR")}</b>
              </div>
              <div className="rounded bg-black/30 p-2 text-white/55">
                Prazo <b className="block text-white">{orcamento.semanas} sem.</b>
              </div>
              <div className={cn("rounded p-2", orcamento.custo > saldo ? "bg-red-500/10 text-red-300/70" : "bg-black/30 text-white/55")}>
                Custo <b className="block text-white">{brl(orcamento.custo)}</b>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setModalAberto(false)}>Cancelar</Button>
              <Button onClick={iniciar} disabled={orcamento.totalLugares <= 0 || orcamento.custo > saldo}>
                <TicketPercent className="mr-1.5 h-3.5 w-3.5" />
                Começar a obra
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

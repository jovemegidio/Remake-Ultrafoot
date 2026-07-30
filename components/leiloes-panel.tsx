"use client"

// PAINEL DE LEILÕES — a aba onde vários clubes disputam o mesmo atleta.
//
// O mercado do jogo é 1-para-1: você propõe, o clube aceita ou recusa. Aqui
// entra o caso em que perder o alvo para outro clube é possível — e é o que faz
// o preço subir de verdade.
//
// DUAS DECISÕES QUE IMPORTAM:
//
// 1. Este painel NÃO conclui a transferência. Vencer o leilão abre a MESMA
//    negociação da aba Buscar, já no valor vencedor. Reimplementar a compra aqui
//    duplicaria teto de dívida, teto de folha, markDeparted e a sincronia do
//    save — todos os defeitos que a compra já resolve.
//
// 2. Quem está em disputa e o que a IA ofereceu são DERIVADOS da semana
//    (lib/leilao), não guardados. Só o lance do usuário vai para o save.

import { useMemo, useState } from "react"
import { Gavel, TrendingUp, Trophy, XCircle, Clock } from "lucide-react"
import { TeamCrest } from "@/components/team-crest"
import { formatCurrency } from "@/lib/teams-data"
import { cn } from "@/lib/utils"
import {
  chaveLeilao, emLeilaoNaSemana, semanaDeEncerramento, valorMinimoDe,
  lanceMinimoSeguinte, lancesDaIA, maiorLance, encerrarLeilao,
  type LeilaoAberto, type LanceLeilao,
} from "@/lib/leilao"

/** O mínimo que o painel precisa de um atleta do mercado. */
export interface AlvoDeLeilao {
  name: string
  position: string
  age: number
  overall: number
  potential?: number
  team: { curto?: string; nome: string; prestigio?: number }
}

export interface LanceSalvo {
  chave: string
  valor: number
  encerraNaSemana: number
  season: number
}

/**
 * Quantos leilões válidos existem nesta semana.
 *
 * Aplica as MESMAS regras do painel — inclusive a de descartar disputa sem
 * nenhum interessado da IA. Existe para a tela de leilões saber se deve aparecer
 * sem reimplementar o critério: duas respostas diferentes para "isto é um
 * leilão?" seria o mesmo defeito das duas escalas de valor.
 */
export function contarLeiloesAbertos(
  pool: AlvoDeLeilao[],
  candidatos: { curto: string; nome: string; prestigio: number; caixa: number; forcaElenco: number }[],
  semana: number,
): number {
  let total = 0
  const encerra = semanaDeEncerramento(semana)
  // Deduplica pela mesma chave que o painel usa — se as duas contas divergirem, a
  // tela dira "1 leilao" e mostrara dois, ou vice-versa.
  const vistos = new Set<string>()
  for (const alvo of pool) {
    if (!alvo.team?.nome) continue
    if (!emLeilaoNaSemana(alvo.name, alvo.team.nome, alvo.overall, semana)) continue
    const chave = chaveLeilao(alvo.name, alvo.team.nome)
    if (vistos.has(chave)) continue
    vistos.add(chave)
    const base: LeilaoAberto = {
      id: chave,
      jogadorNome: alvo.name,
      jogadorOverall: alvo.overall,
      jogadorIdade: alvo.age,
      clubeVendedorCurto: alvo.team.curto ?? "",
      clubeVendedorNome: alvo.team.nome,
      valorMinimo: valorMinimoDe(alvo.overall, alvo.age, alvo.potential),
      encerraNaSemana: encerra,
      lances: [],
    }
    if (lancesDaIA(base, candidatos, semana).length > 0) total++
  }
  return total
}

interface Props {
  /** Catálogo do mercado — o mesmo da aba Buscar. */
  pool: AlvoDeLeilao[]
  semana: number
  season: number
  saldo: number
  /** Clubes que podem entrar na disputa (o mundo, menos o do usuário). */
  candidatos: { curto: string; nome: string; prestigio: number; caixa: number; forcaElenco: number }[]
  lancesSalvos: LanceSalvo[]
  onLance: (lance: LanceSalvo) => void
  /** Vencer abre a negociação normal no valor do lance. */
  onNegociar: (nomeDoAtleta: string, valor: number) => void
  clubeDoUsuario: { curto: string; nome: string; prestigio: number }
}

interface LeilaoNaTela {
  leilao: LeilaoAberto
  alvo: AlvoDeLeilao
  lancesIA: LanceLeilao[]
  meuLance: number | null
  encerrado: boolean
  desfecho: { vencedor: LanceLeilao; motivo: string } | null
  venci: boolean
}

export function LeiloesPanel({
  pool, semana, season, saldo, candidatos, lancesSalvos, onLance, onNegociar, clubeDoUsuario,
}: Props) {
  const [rascunho, setRascunho] = useState<Record<string, number>>({})
  const [aviso, setAviso] = useState<string | null>(null)

  const leiloes = useMemo<LeilaoNaTela[]>(() => {
    const encerra = semanaDeEncerramento(semana)
    const abertos: LeilaoNaTela[] = []
    // O CATALOGO PODE TRAZER O MESMO ATLETA DUAS VEZES (relato com print: James
    // Tarkowski, do Everton, abriu dois leiloes lado a lado). Como a chave do
    // leilao e clube+nome, os dois eram o MESMO leilao aparecendo em dobro — e
    // cobrir um nao mexia no outro. A chave tambem serve para deduplicar.
    const vistos = new Set<string>()
    for (const alvo of pool) {
      if (!alvo.team?.nome) continue
      if (!emLeilaoNaSemana(alvo.name, alvo.team.nome, alvo.overall, semana)) continue
      const chave = chaveLeilao(alvo.name, alvo.team.nome)
      if (vistos.has(chave)) continue
      vistos.add(chave)
      const base: LeilaoAberto = {
        id: chave,
        jogadorNome: alvo.name,
        jogadorOverall: alvo.overall,
        jogadorIdade: alvo.age,
        clubeVendedorCurto: alvo.team.curto ?? "",
        clubeVendedorNome: alvo.team.nome,
        valorMinimo: valorMinimoDe(alvo.overall, alvo.age, alvo.potential),
        encerraNaSemana: encerra,
        lances: [],
      }
      const lancesIA = lancesDaIA(base, candidatos, semana)
      // GARANTIA ESTRUTURAL: leilão sem nenhum interessado não é leilão — seria
      // só uma compra pelo piso com outro nome. Se ninguém da IA entrou, o
      // atleta simplesmente não vai à disputa. Isto também protege contra o
      // ajuste de caixa/interesse voltar a secar os lances sem ninguém notar.
      if (lancesIA.length === 0) continue
      const salvo = lancesSalvos.find(l => l.chave === chave && l.season === season)
      const meuLance = salvo?.valor ?? null
      const todos = meuLance != null
        ? [...lancesIA, {
            clubeCurto: clubeDoUsuario.curto,
            clubeNome: clubeDoUsuario.nome,
            valor: meuLance,
            prestigio: clubeDoUsuario.prestigio,
            doUsuario: true,
          }]
        : lancesIA
      const leilao: LeilaoAberto = { ...base, lances: todos }
      // Encerra quando a semana chega ao fim da janela. Antes disso, dá para cobrir.
      const encerrado = semana >= encerra
      const desfecho = encerrado ? encerrarLeilao(leilao) : null
      abertos.push({
        leilao, alvo, lancesIA, meuLance, encerrado, desfecho,
        venci: desfecho?.vencedor.doUsuario === true,
      })
    }
    // Maior disputa primeiro: é onde o técnico precisa decidir.
    return abertos.sort((a, b) => (maiorLance(b.leilao)?.valor ?? 0) - (maiorLance(a.leilao)?.valor ?? 0))
  }, [pool, semana, season, candidatos, lancesSalvos, clubeDoUsuario])

  function darLance(item: LeilaoNaTela) {
    const minimo = lanceMinimoSeguinte({ ...item.leilao, lances: item.lancesIA })
    const valor = rascunho[item.leilao.id] ?? minimo
    if (valor < minimo) {
      setAviso(`Para cobrir a disputa por ${item.alvo.name} é preciso oferecer ao menos ${formatCurrency(minimo)}.`)
      return
    }
    if (valor > saldo) {
      setAviso(`Seu caixa é de ${formatCurrency(saldo)} — este lance não cabe. Venda alguém antes.`)
      return
    }
    onLance({ chave: item.leilao.id, valor, encerraNaSemana: item.leilao.encerraNaSemana, season })
    setAviso(`Lance de ${formatCurrency(valor)} registrado por ${item.alvo.name}. O leilão fecha na semana ${item.leilao.encerraNaSemana}.`)
  }

  if (leiloes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] py-20 text-center">
        <Gavel className="h-10 w-10 text-white/20" />
        <p className="text-white/60">Nenhum atleta em disputa nesta janela.</p>
        <p className="max-w-md text-sm text-white/35">
          Leilões abrem quando um clube coloca um atleta à disposição e mais de um
          interessado aparece. Volte depois de avançar as semanas.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {aviso && (
        <div className="flex items-center justify-between rounded-lg border border-[var(--brand)]/20 bg-[var(--brand)]/10 px-4 py-2 text-sm text-[var(--brand)]">
          <span>{aviso}</span>
          <button type="button" onClick={() => setAviso(null)} className="rounded p-1 hover:bg-white/10" aria-label="Fechar aviso">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      {leiloes.map((item) => {
        const maior = maiorLance(item.leilao)
        const minimo = lanceMinimoSeguinte({ ...item.leilao, lances: item.lancesIA })
        const valorNoCampo = rascunho[item.leilao.id] ?? minimo
        return (
          <div key={item.leilao.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <TeamCrest teamShort={item.alvo.team.curto} size="md" />
                <div>
                  <p className="text-lg font-semibold text-white">{item.alvo.name}</p>
                  <p className="text-sm text-white/50">
                    {item.alvo.position} · {item.alvo.age} anos · geral {item.alvo.overall} · {item.alvo.team.nome}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-white/40">Piso do vendedor</p>
                <p className="text-base font-semibold text-white/80">{formatCurrency(item.leilao.valorMinimo)}</p>
              </div>
            </div>

            {/* Lances na mesa */}
            <div className="mt-4 space-y-1.5">
              {[...item.leilao.lances].sort((a, b) => b.valor - a.valor).map((l, i) => (
                <div
                  key={`${l.clubeCurto}-${i}`}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2 text-sm",
                    l.doUsuario ? "bg-[var(--brand)]/15 text-[var(--brand)]" : "bg-white/[0.03] text-white/70",
                  )}
                >
                  <span className="flex items-center gap-2">
                    {i === 0 && <TrendingUp className="h-3.5 w-3.5" />}
                    {l.clubeNome}{l.doUsuario ? " (você)" : ""}
                  </span>
                  <span className="font-medium">{formatCurrency(l.valor)}</span>
                </div>
              ))}
              {item.leilao.lances.length === 0 && (
                <p className="text-sm text-white/40">Nenhum lance ainda — dá para levar pelo piso.</p>
              )}
            </div>

            {/* Ação */}
            {item.encerrado ? (
              <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.02] p-3">
                {item.desfecho === null ? (
                  <p className="text-sm text-white/60">
                    Ninguém cobriu o piso. {item.alvo.name} segue no {item.alvo.team.nome}.
                  </p>
                ) : item.venci ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-sm text-[var(--brand)]">
                      <Trophy className="h-4 w-4" />
                      Você venceu o leilão. {item.desfecho.motivo}
                    </p>
                    <button
                      type="button"
                      onClick={() => onNegociar(item.alvo.name, item.desfecho!.vencedor.valor)}
                      className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-black hover:brightness-110"
                    >
                      Fechar contrato
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-white/60">{item.desfecho.motivo}</p>
                )}
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-white/40">
                    Seu lance (mínimo {formatCurrency(minimo)})
                  </span>
                  {/*
                    VALOR FORMATADO. Era `type="number"`, e o navegador mostra o
                    numero cru: o campo exibia "22475111" e nao havia como saber se
                    aquilo eram 2 milhoes ou 22. Agora e texto com separador de
                    milhar (pt-BR) e o valor real fica no estado, nao na string.
                  */}
                  <input
                    type="text"
                    inputMode="numeric"
                    value={valorNoCampo.toLocaleString("pt-BR")}
                    onChange={(e) => {
                      // Aceita so digito: o usuario pode apagar/colar com pontos.
                      const digitos = e.target.value.replace(/\D/g, "")
                      setRascunho(r => ({ ...r, [item.leilao.id]: digitos ? Number(digitos) : 0 }))
                    }}
                    className="w-48 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-right text-sm tabular-nums text-white outline-none focus:border-[var(--brand)]/50"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => darLance(item)}
                  className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-black hover:brightness-110"
                >
                  {item.meuLance != null ? "Cobrir" : "Dar lance"}
                </button>
                <span className="flex items-center gap-1.5 text-xs text-white/40">
                  <Clock className="h-3.5 w-3.5" />
                  fecha na semana {item.leilao.encerraNaSemana}
                  {maior && !maior.doUsuario && ` · ${maior.clubeNome} lidera`}
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

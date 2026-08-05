"use client"

// PAINEL DO LEILÃO DE VENDA — anuncie um atleta SEU e deixe o mercado disputar.
//
// A contrapartida do LeiloesPanel (que é o lado da compra). Ver
// lib/leilao-de-venda.ts para as regras; aqui é só a tela.
//
// UMA DECISÃO QUE IMPORTA: o painel NÃO conclui a venda. Ele registra o anúncio
// no save e mostra a disputa; quem tira o atleta do elenco e credita o caixa é
// `registrarSaidaAcertada`, no motor — o mesmo lugar que trata a janela de
// transferências. Reimplementar a baixa aqui duplicaria a regra da janela, que é
// justamente a parte que o pedido depende ("o jogador sai na abertura da janela").

import { useMemo, useState } from "react"
import { Gavel, Clock, TrendingUp, XCircle, Users } from "lucide-react"
import { formatCurrency } from "@/lib/teams-data"
import { cn } from "@/lib/utils"
import {
  SEMANAS_DE_LEILAO, disputaPorAnuncio, pisoMinimoDe, pisoSugeridoDe,
  type ClubeCandidato, type LeilaoDeVenda,
} from "@/lib/leilao-de-venda"
import { maiorLance } from "@/lib/leilao"

/** O mínimo que o painel precisa de um atleta do SEU elenco. */
export interface AtletaAnunciavel {
  id: number
  name: string
  position: string
  age: number
  overall: number
  marketValue: number
  /** Emprestado não se vende: o passe não é seu. */
  isLoanedIn?: boolean
}

interface Props {
  elenco: readonly AtletaAnunciavel[]
  anuncios: readonly LeilaoDeVenda[]
  candidatos: readonly ClubeCandidato[]
  semana: number
  season: number
  clubeDoUsuario: { curto: string; nome: string }
  /** Elenco mínimo: anunciar todo mundo deixaria o clube sem time. */
  elencoMinimo: number
  onAnunciar: (anuncio: LeilaoDeVenda) => void
  onCancelar: (id: string) => void
}

export function LeilaoVendaPanel({
  elenco, anuncios, candidatos, semana, season, clubeDoUsuario, elencoMinimo, onAnunciar, onCancelar,
}: Props) {
  const [escolhido, setEscolhido] = useState<number | null>(null)
  const [piso, setPiso] = useState<number | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const jaAnunciados = useMemo(() => new Set(anuncios.map(a => a.playerId)), [anuncios])

  const disponiveis = useMemo(
    () => elenco
      .filter(p => !p.isLoanedIn && !jaAnunciados.has(p.id))
      .sort((a, b) => b.overall - a.overall),
    [elenco, jaAnunciados],
  )

  const atleta = disponiveis.find(p => p.id === escolhido) ?? null
  const pisoMinimo = atleta ? pisoMinimoDe(atleta.marketValue) : 0
  const pisoNoCampo = piso ?? (atleta ? pisoSugeridoDe(atleta.marketValue) : 0)

  // ELENCO MÍNIMO. Vender é legítimo; ficar sem time para escalar trava a
  // temporada — a mesma trava que o fim de contrato já respeita no motor.
  const elencoDisponivel = elenco.filter(p => !p.isLoanedIn).length - anuncios.length
  const podeAnunciarMais = elencoDisponivel > elencoMinimo

  function anunciar() {
    if (!atleta) { setAviso("Escolha um atleta do elenco."); return }
    if (!podeAnunciarMais) {
      setAviso(`O elenco ficaria com menos de ${elencoMinimo} atletas. Contrate antes de anunciar mais alguém.`)
      return
    }
    if (pisoNoCampo < pisoMinimo) {
      setAviso(`O piso não pode ficar abaixo de ${formatCurrency(pisoMinimo)} — dar o atleta de graça não é um leilão.`)
      return
    }
    onAnunciar({
      // Semente do sorteio: precisa ser estável (o mesmo anúncio tem sempre a
      // mesma disputa) e única por temporada/atleta.
      id: `venda:${season}:${atleta.id}:${semana}`,
      playerId: atleta.id,
      playerName: atleta.name,
      position: atleta.position,
      overall: atleta.overall,
      idade: atleta.age,
      valorMinimo: pisoNoCampo,
      valorDeMercado: atleta.marketValue,
      abertoNaSemana: semana,
      encerraNaSemana: semana + SEMANAS_DE_LEILAO,
      season,
    })
    setAviso(
      `${atleta.name} está em leilão com piso de ${formatCurrency(pisoNoCampo)}. ` +
      `A disputa fecha na semana ${semana + SEMANAS_DE_LEILAO}.`,
    )
    setEscolhido(null)
    setPiso(null)
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

      {/* ── ANUNCIAR ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2">
          <Gavel className="h-4 w-4 text-[var(--brand)]" />
          <h3 className="font-semibold text-white">Colocar um atleta em leilão</h3>
        </div>
        <p className="mt-1 text-sm text-white/45">
          Você define o piso; os clubes interessados disputam por três semanas. Fechado o
          leilão, o valor entra no caixa e o atleta deixa o elenco na abertura da janela
          de transferências.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex min-w-[240px] flex-1 flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-white/40">Atleta</span>
            <select
              value={escolhido ?? ""}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null
                setEscolhido(id)
                const p = disponiveis.find(item => item.id === id)
                setPiso(p ? pisoSugeridoDe(p.marketValue) : null)
              }}
              className="h-10 rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-white outline-none focus:border-[var(--brand)]/50"
            >
              <option value="">Selecione…</option>
              {disponiveis.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.position} · {p.age} anos · geral {p.overall} · {formatCurrency(p.marketValue)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-white/40">
              Piso {atleta ? `(mínimo ${formatCurrency(pisoMinimo)})` : ""}
            </span>
            {/* Texto com separador de milhar, não `type="number"`: o campo cru
                mostrava "22475111" e não dava para saber se eram 2 ou 22 milhões
                (mesma correção do painel de compra). */}
            <input
              type="text"
              inputMode="numeric"
              disabled={!atleta}
              value={atleta ? pisoNoCampo.toLocaleString("pt-BR") : ""}
              onChange={(e) => {
                const digitos = e.target.value.replace(/\D/g, "")
                setPiso(digitos ? Number(digitos) : 0)
              }}
              className="w-48 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-right text-sm tabular-nums text-white outline-none focus:border-[var(--brand)]/50 disabled:opacity-40"
            />
          </label>

          <button
            type="button"
            onClick={anunciar}
            disabled={!atleta}
            className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--brand-ink)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Anunciar
          </button>
        </div>

        {!podeAnunciarMais && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-300/80">
            <Users className="h-3.5 w-3.5" />
            Elenco no limite ({elencoMinimo} atletas). Reforce o time antes de anunciar mais alguém.
          </p>
        )}
      </div>

      {/* ── ANÚNCIOS ABERTOS ─────────────────────────────────────────────── */}
      {anuncios.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-white/40">
          Nenhum atleta seu em leilão.
        </p>
      ) : (
        anuncios.map(anuncio => {
          const disputa = disputaPorAnuncio(anuncio, candidatos, semana, clubeDoUsuario)
          const lider = maiorLance(disputa)
          const cobreOPiso = (lider?.valor ?? 0) >= anuncio.valorMinimo
          const faltam = anuncio.encerraNaSemana - semana
          return (
            <div key={anuncio.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-white">{anuncio.playerName}</p>
                  <p className="text-sm text-white/50">
                    {anuncio.position} · {anuncio.idade} anos · geral {anuncio.overall}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-white/40">Seu piso</p>
                  <p className="text-base font-semibold text-white/80">{formatCurrency(anuncio.valorMinimo)}</p>
                </div>
              </div>

              <div className="mt-4 space-y-1.5">
                {[...disputa.lances].sort((a, b) => b.valor - a.valor).map((l, i) => (
                  <div
                    key={`${l.clubeCurto}-${i}`}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-3 py-2 text-sm",
                      i === 0 && l.valor >= anuncio.valorMinimo
                        ? "bg-[var(--brand)]/15 text-[var(--brand)]"
                        : "bg-white/[0.03] text-white/70",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {i === 0 && <TrendingUp className="h-3.5 w-3.5" />}
                      {l.clubeNome}
                    </span>
                    <span className="font-medium">{formatCurrency(l.valor)}</span>
                  </div>
                ))}
                {disputa.lances.length === 0 && (
                  <p className="text-sm text-white/40">Nenhum clube entrou na disputa ainda.</p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-xs text-white/40">
                  <Clock className="h-3.5 w-3.5" />
                  {faltam > 0
                    ? `fecha em ${faltam} semana${faltam === 1 ? "" : "s"} (semana ${anuncio.encerraNaSemana})`
                    : "encerrando — o desfecho sai no próximo avanço de semana"}
                  {!cobreOPiso && disputa.lances.length > 0 && " · nenhum lance cobre seu piso ainda"}
                </span>
                <button
                  type="button"
                  onClick={() => { onCancelar(anuncio.id); setAviso(`${anuncio.playerName} saiu do leilão.`) }}
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/60 hover:border-red-400/40 hover:text-red-300"
                >
                  Retirar do leilão
                </button>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

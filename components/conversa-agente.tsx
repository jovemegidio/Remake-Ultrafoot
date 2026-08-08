"use client"

// A CONVERSA COM O EMPRESÁRIO — mesma forma da reunião com a diretoria.
//
// Segue de propósito o desenho de `conversa-diretoria.tsx`: chat, sugestões
// clicáveis, pausa curta de "digitando" e o desfecho aplicado pelo pai. Quem
// aprendeu a conversar com a diretoria já sabe operar esta tela.
//
// O que é DIFERENTE aqui está no cabeçalho: um medidor de relação. Com a
// diretoria o que está em jogo é o cargo, e isso já aparece na tela dela. Com o
// empresário o que está em jogo é a RELAÇÃO — e ela é invisível se não for
// mostrada. Sem o medidor, o técnico recusa três pedidos seguidos e só descobre
// o estrago quando o atleta aparece na lista de transferências.

import { useEffect, useRef, useState } from "react"
import { X, Briefcase, Send, TrendingDown } from "lucide-react"
import {
  aberturaDoAgente, intencaoDoTextoComAgente, responderAgente, valorDoTexto,
  PEDIDO_DE_CLAREZA_AGENTE, SUGESTOES_AGENTE,
  type EstadoDoAgente, type DesfechoDoAgente,
} from "@/lib/conversa-agente"
import { DESGASTE_DE_RUPTURA } from "@/lib/pressao-do-agente"
import { cn } from "@/lib/utils"

interface Mensagem {
  autor: "agente" | "tecnico"
  texto: string
  hora: string
}

const agora = () =>
  new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

/** Rótulo e cor da relação — o técnico precisa VER onde pisa. */
function faixaDaRelacao(desgaste: number) {
  if (desgaste >= DESGASTE_DE_RUPTURA) return { rotulo: "Rompida", cor: "text-red-300", barra: "bg-red-500" }
  if (desgaste >= 45) return { rotulo: "Tensa", cor: "text-amber-300", barra: "bg-amber-400" }
  if (desgaste >= 20) return { rotulo: "Profissional", cor: "text-white/70", barra: "bg-white/40" }
  return { rotulo: "Cordial", cor: "text-emerald-300", barra: "bg-emerald-400" }
}

export function ConversaAgente({
  aberto,
  onFechar,
  estado,
  onDesfecho,
}: {
  aberto: boolean
  onFechar: () => void
  estado: EstadoDoAgente
  /** O pai aplica no save: desgaste, acordo, saída para o mercado. */
  onDesfecho: (d: DesfechoDoAgente) => void
}) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [texto, setTexto] = useState("")
  const [digitando, setDigitando] = useState(false)
  const [encerrada, setEncerrada] = useState(false)
  // Desgaste que a conversa acumulou, para o medidor reagir na hora — o save só
  // é atualizado pelo pai, mas a tela não pode mentir enquanto isso.
  const [desgasteLocal, setDesgasteLocal] = useState(estado.desgaste)
  const fimDaLista = useRef<HTMLDivElement>(null)
  const campo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!aberto) return
    setMensagens([{ autor: "agente", texto: aberturaDoAgente(estado), hora: agora() }])
    setTexto("")
    setDigitando(false)
    setEncerrada(false)
    setDesgasteLocal(estado.desgaste)
    window.setTimeout(() => campo.current?.focus(), 80)
  }, [aberto, estado])

  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [mensagens, digitando])

  if (!aberto) return null

  const faixa = faixaDaRelacao(desgasteLocal)

  const enviar = (mensagem: string) => {
    const limpo = mensagem.trim()
    if (!limpo || digitando || encerrada) return

    setMensagens(m => [...m, { autor: "tecnico", texto: limpo, hora: agora() }])
    setTexto("")
    setDigitando(true)

    window.setTimeout(() => {
      const intencao = intencaoDoTextoComAgente(limpo)
      if (!intencao) {
        setMensagens(m => [...m, { autor: "agente", texto: PEDIDO_DE_CLAREZA_AGENTE, hora: agora() }])
        setDigitando(false)
        return
      }
      // O valor dito na frase só importa na contraproposta — em "recuso 200 mil"
      // o número é ruído, e passá-lo adiante faria o agente responder a uma
      // oferta que ninguém fez.
      const valor = intencao === "contrapor" ? valorDoTexto(limpo) ?? undefined : undefined
      const d = responderAgente(intencao, { ...estado, desgaste: desgasteLocal }, valor)

      setMensagens(m => [...m, { autor: "agente", texto: d.resposta, hora: agora() }])
      setDesgasteLocal(v => Math.max(0, Math.min(100, v + d.desgasteDelta)))
      setDigitando(false)
      if (d.encerra) setEncerrada(true)
      onDesfecho(d)
    }, 700)
  }

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-black/75 p-6" onClick={onFechar}>
      <div
        onClick={e => e.stopPropagation()}
        className="flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c10] shadow-2xl"
      >
        {/* Cabeçalho: quem é, por quem fala, e como está a relação. */}
        <header className="flex items-start gap-3 border-b border-white/[0.07] p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-400/15 text-amber-300">
            <Briefcase className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">{estado.nome}</p>
            <p className="truncate text-xs text-white/45">
              Empresário de {estado.atleta.nome} · {estado.atleta.overall} overall
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1 w-24 overflow-hidden rounded-full bg-white/10">
                <div className={cn("h-full rounded-full transition-all", faixa.barra)}
                  style={{ width: `${Math.max(4, desgasteLocal)}%` }} />
              </div>
              <span className={cn("text-[10px] font-bold uppercase tracking-wide", faixa.cor)}>
                Relação {faixa.rotulo}
              </span>
            </div>
          </div>
          <button onClick={onFechar} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Aviso de ruptura: o técnico precisa saber ANTES de falar. */}
        {desgasteLocal >= DESGASTE_DE_RUPTURA && (
          <p className="flex items-center gap-2 border-b border-red-500/20 bg-red-500/[0.07] px-4 py-2 text-xs text-red-300">
            <TrendingDown className="h-3.5 w-3.5 shrink-0" />
            A relação está rompida — ele já trabalha para tirar o atleta daqui.
          </p>
        )}

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 scrollbar-game">
          {mensagens.map((m, i) => (
            <div key={i} className={cn("flex", m.autor === "tecnico" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[80%] rounded-2xl px-3.5 py-2",
                m.autor === "tecnico"
                  ? "rounded-br-sm bg-[var(--brand)]/15 text-white"
                  : "rounded-bl-sm bg-white/[0.06] text-white/85",
              )}>
                <p className="text-sm leading-snug">{m.texto}</p>
                <p className="mt-0.5 text-right text-[9px] text-white/25">{m.hora}</p>
              </div>
            </div>
          ))}
          {digitando && (
            <p className="text-xs italic text-white/30">{estado.nome} está digitando…</p>
          )}
          <div ref={fimDaLista} />
        </div>

        {!encerrada && (
          <div className="border-t border-white/[0.07] p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {SUGESTOES_AGENTE.map(s => (
                <button
                  key={s.id}
                  onClick={() => enviar(s.frase)}
                  disabled={digitando}
                  className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/65 transition-colors hover:border-white/25 hover:text-white disabled:opacity-40"
                >
                  {s.rotulo}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                ref={campo}
                value={texto}
                onChange={e => setTexto(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") enviar(texto) }}
                placeholder="Escreva para o empresário… (ex.: consigo 120 mil)"
                disabled={digitando}
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[var(--brand)]/40 focus:outline-none"
              />
              <button
                onClick={() => enviar(texto)}
                disabled={digitando || !texto.trim()}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--brand)] text-[var(--brand-ink)] disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {encerrada && (
          <div className="border-t border-white/[0.07] p-3">
            <button
              onClick={onFechar}
              className="w-full rounded-xl bg-white/[0.06] py-2.5 text-sm font-bold text-white/80 hover:bg-white/10"
            >
              Encerrar conversa
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

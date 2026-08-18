"use client"

/**
 * A DOCA DE CONVERSA — as janelinhas do canto, como no Riot e na Epic.
 *
 * ⚠️ POR QUE NÃO BASTAVA A ABA DO FC HUB. Conversar dentro de uma aba obriga a
 * pessoa a ESCOLHER entre falar com o amigo e fazer qualquer outra coisa: sair
 * da aba fecha a conversa, e responder "já vou" custa duas navegações. É por
 * isso que todo launcher grande tem conversa flutuante — ela acompanha você
 * enquanto a Loja, o Changelog ou o download estão na frente.
 *
 * ⚠️ SÓ SONDA O QUE ESTÁ ABERTO E NÃO MINIMIZADO. Ler marca como lida no
 * servidor; uma janela minimizada que continuasse buscando zeraria o "não
 * lidas" de uma conversa que a pessoa não está vendo.
 *
 * ⚠️ NADA DE COR CHUMBADA: tudo sai das variáveis do tema (o launcher tem 20
 * paletas trocáveis).
 */

import { useEffect, useRef, useState } from "react"
import { Loader2, Minus, Send, X } from "lucide-react"

import { desdeQuando, enviarDireta, lerConversa, type MensagemDireta } from "@/lib/hub"
import {
  alternarMinimizada, fecharConversa, recarregarHub, useAmigosDoHub, useConversasAbertas,
} from "@/lib/hub-store"
import { cn } from "@/lib/utils"

const INTERVALO_CONVERSA = 5_000

function Janela({ contaId, minimizada }: { contaId: number; minimizada: boolean }) {
  const painel = useAmigosDoHub()
  const amigo = painel.amigos.find(a => a.conta_id === contaId)
  const [mensagens, setMensagens] = useState<MensagemDireta[]>([])
  const [texto, setTexto] = useState("")
  const [erro, setErro] = useState("")
  const [enviando, setEnviando] = useState(false)
  const ultima = useRef(0)
  const fim = useRef<HTMLDivElement>(null)
  const campo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (minimizada) return
    let vivo = true
    ultima.current = 0
    setMensagens([])
    const buscar = async () => {
      const novas = await lerConversa(contaId, ultima.current)
      if (!vivo || novas.length === 0) return
      ultima.current = novas[novas.length - 1].id
      setMensagens(antes => [...antes, ...novas].slice(-200))
      // Ler zerou o contador no servidor: a lista tem de refletir isso já, e
      // não daqui a 20 s com o selo vermelho ao lado da conversa aberta.
      void recarregarHub()
    }
    void buscar()
    const t = window.setInterval(() => void buscar(), INTERVALO_CONVERSA)
    return () => { vivo = false; window.clearInterval(t) }
  }, [contaId, minimizada])

  useEffect(() => {
    if (!minimizada) fim.current?.scrollIntoView({ block: "end" })
  }, [mensagens.length, minimizada])

  useEffect(() => {
    if (!minimizada) campo.current?.focus()
  }, [minimizada])

  const mandar = async () => {
    const limpo = texto.trim()
    if (!limpo || enviando) return
    setEnviando(true)
    const problema = await enviarDireta(contaId, limpo)
    setErro(problema)
    if (!problema) {
      setTexto("")
      const novas = await lerConversa(contaId, ultima.current)
      if (novas.length) {
        ultima.current = novas[novas.length - 1].id
        setMensagens(antes => [...antes, ...novas].slice(-200))
      }
    }
    setEnviando(false)
  }

  const nome = amigo?.nome ?? "Conversa"
  const estado = !amigo
    ? ""
    : !amigo.online
      ? desdeQuando(amigo.visto_em)
      : amigo.origem === "launcher"
        ? "No launcher"
        : amigo.detalhe || amigo.clube || "No Ultrafoot"

  return (
    <div
      className={cn(
        "pointer-events-auto flex w-[288px] flex-col overflow-hidden rounded-t-xl border border-b-0 border-border bg-card shadow-[0_-8px_40px_rgba(0,0,0,.45)]",
        minimizada ? "h-auto" : "h-[380px]",
      )}
    >
      <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-3 py-2">
        <span className="relative grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
          {(nome || "?").slice(0, 1).toUpperCase()}
          <span className={cn(
            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-card",
            amigo?.online ? "bg-emerald-400" : "bg-white/25",
          )} />
        </span>
        <button
          onClick={() => alternarMinimizada(contaId)}
          className="min-w-0 flex-1 text-left"
          title={minimizada ? "Abrir conversa" : "Minimizar"}
        >
          <span className="block truncate text-[12px] font-semibold text-foreground">{nome}</span>
          {!minimizada && <span className="block truncate text-[10px] text-muted-foreground">{estado}</span>}
        </button>
        {/* O selo aparece na minimizada: é o único jeito de saber que chegou
            mensagem sem reabrir a janela. */}
        {minimizada && !!amigo?.nao_lidas && (
          <span className="rounded-full bg-red-500/90 px-1.5 text-[10px] font-bold text-white">{amigo.nao_lidas}</span>
        )}
        <button
          onClick={() => alternarMinimizada(contaId)}
          className="rounded p-1 text-muted-foreground hover:text-foreground"
          aria-label="Minimizar"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => fecharConversa(contaId)}
          className="rounded p-1 text-muted-foreground hover:text-foreground"
          aria-label="Fechar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {!minimizada && (
        <>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
            {mensagens.length === 0 && (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Nenhuma mensagem ainda. Combine uma liga, troque uma dica de contratação.
              </p>
            )}
            {mensagens.map(m => {
              const meu = m.de_id !== contaId
              return (
                <div key={m.id} className={cn("flex", meu ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[85%] rounded-xl px-2.5 py-1.5 text-[12px] leading-snug",
                    meu ? "bg-primary/15 text-foreground" : "bg-white/[0.06] text-muted-foreground",
                  )}>
                    <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                    <p className="mt-0.5 text-[9px] text-muted-foreground/70">
                      {new Date(m.quando * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              )
            })}
            <div ref={fim} />
          </div>
          {erro && <p className="px-3 pb-1 text-[11px] text-red-400">{erro}</p>}
          <div className="flex gap-1.5 border-t border-border p-2">
            <input
              ref={campo}
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") void mandar() }}
              maxLength={500}
              placeholder="Mensagem…"
              className="min-w-0 flex-1 rounded-lg border border-border bg-black/25 px-2.5 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
            />
            <button
              onClick={() => void mandar()}
              disabled={!texto.trim() || enviando}
              className="rounded-lg bg-primary px-2.5 text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-35"
              aria-label="Enviar"
            >
              {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/** Fica no rodapé do shell, por cima de qualquer aba. */
export function ChatDock() {
  const { abertas, minimizadas } = useConversasAbertas()
  if (abertas.length === 0) return null
  return (
    // `pointer-events-none` no trilho: sem isso a faixa invisível do canto
    // engoliria cliques do conteúdo que está atrás dela.
    <div className="pointer-events-none fixed bottom-0 right-4 z-40 flex items-end gap-3">
      {abertas.map(id => (
        <Janela key={id} contaId={id} minimizada={minimizadas.includes(id)} />
      ))}
    </div>
  )
}

"use client"

import { useEffect, useRef, useState } from "react"
import { Send, Users, MessageSquare, WifiOff } from "lucide-react"
import {
  contaLogada, baterPresenca, enviarMensagem, lerChat,
  type JogadorOnline, type MensagemDoChat,
} from "@/lib/conta-ultrafoot"

/**
 * QUEM ESTÁ ONLINE + CHAT DO FC HUB.
 *
 * Antes a lista de "online" eram os amigos do Discord que estavam jogando — para
 * quem não usa Discord (a maioria), ficava sempre vazia. Agora a presença vem da
 * conta do Ultrafoot: quem entrou pelo launcher aparece para os outros.
 *
 * A conversa é buscada por sondagem, não WebSocket. É de propósito: o servidor
 * de contas é HTTP simples, sem dependência externa, e uma sala de saguão não
 * precisa de tempo real ao segundo. Um WebSocket aqui custaria muito mais do que
 * entrega.
 */

const INTERVALO_PRESENCA = 30_000
const INTERVALO_CHAT = 5_000

export function HubOnlineChat({ clube, situacao }: { clube: string; situacao: string }) {
  const [temConta, setTemConta] = useState<boolean | null>(null)
  const [online, setOnline] = useState<JogadorOnline[]>([])
  const [eu, setEu] = useState(0)
  const [mensagens, setMensagens] = useState<MensagemDoChat[]>([])
  const [texto, setTexto] = useState("")
  const [erro, setErro] = useState("")
  const [enviando, setEnviando] = useState(false)
  const ultimoId = useRef(0)
  const fim = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let vivo = true
    void contaLogada().then(c => { if (vivo) setTemConta(!!c) })
    return () => { vivo = false }
  }, [])

  // Batida de presença. `clube`/`situacao` entram por ref implícita das deps
  // para a lista dos outros mostrar onde a pessoa está agora.
  useEffect(() => {
    if (!temConta) return
    let vivo = true
    const bater = async () => {
      const r = await baterPresenca({ clube, situacao })
      if (!vivo || !r) return
      setEu(r.eu)
      setOnline(r.online)
    }
    void bater()
    const t = setInterval(bater, INTERVALO_PRESENCA)
    return () => { vivo = false; clearInterval(t) }
  }, [temConta, clube, situacao])

  useEffect(() => {
    if (!temConta) return
    let vivo = true
    const buscar = async () => {
      const novas = await lerChat(ultimoId.current)
      if (!vivo || novas.length === 0) return
      ultimoId.current = novas[novas.length - 1].id
      // Corta o histórico na tela: uma conversa longa deixada acumulando vira
      // milhares de nós no DOM e o painel inteiro começa a travar.
      setMensagens(antes => [...antes, ...novas].slice(-120))
    }
    void buscar()
    const t = setInterval(buscar, INTERVALO_CHAT)
    return () => { vivo = false; clearInterval(t) }
  }, [temConta])

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [mensagens.length])

  const enviar = async () => {
    const limpo = texto.trim()
    if (!limpo || enviando) return
    setEnviando(true)
    const problema = await enviarMensagem(limpo)
    setErro(problema)
    if (!problema) {
      setTexto("")
      const novas = await lerChat(ultimoId.current)
      if (novas.length) {
        ultimoId.current = novas[novas.length - 1].id
        setMensagens(antes => [...antes, ...novas].slice(-120))
      }
    }
    setEnviando(false)
  }

  if (temConta === false) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/20 p-5 text-center">
        <WifiOff className="mx-auto mb-2 h-6 w-6 text-white/25" />
        <p className="text-sm font-semibold text-white/70">Entre na sua conta pelo launcher</p>
        <p className="mt-1 text-xs text-white/40">
          É a conta que mostra você para os outros técnicos e libera a conversa aqui.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[.18em] text-white/35">
          <Users className="h-3 w-3" /> Técnicos online · {online.length}
        </p>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {online.length === 0 && (
            <p className="px-1 py-2 text-[11px] text-white/30">Ninguém mais por aqui agora.</p>
          )}
          {online.map(j => (
            <div
              key={j.conta_id}
              className={`flex items-center gap-2 rounded-lg p-2 ${j.conta_id === eu ? "bg-[#00ffc8]/[0.08]" : "hover:bg-white/[0.04]"}`}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#00ffc8]/15 text-[11px] font-black text-[#00ffc8]">
                {(j.nome || "?").slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-semibold text-white/85">
                  {j.nome}{j.conta_id === eu && <span className="text-white/35"> (você)</span>}
                </span>
                <span className="block truncate text-[9px] text-emerald-300/80">
                  {j.clube || j.situacao || "No Ultrafoot"}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex min-h-[260px] flex-col rounded-xl border border-white/10 bg-black/20">
        <p className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5 text-[9px] font-black uppercase tracking-[.18em] text-white/35">
          <MessageSquare className="h-3 w-3" /> Conversa do saguão
        </p>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          {mensagens.length === 0 && (
            <p className="text-[11px] text-white/30">
              Nenhuma mensagem ainda. Diga oi — quem estiver online vai ver.
            </p>
          )}
          {mensagens.map(m => (
            <div key={m.id} className="text-[12px] leading-snug">
              <span className={`font-bold ${m.conta_id === eu ? "text-[#00ffc8]" : "text-white/80"}`}>
                {m.nome}
              </span>
              <span className="ml-1.5 text-[9px] text-white/25">
                {new Date(m.quando * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <p className="text-white/65">{m.texto}</p>
            </div>
          ))}
          <div ref={fim} />
        </div>
        {erro && <p className="px-4 pb-1 text-[11px] text-red-400">{erro}</p>}
        <div className="flex gap-2 border-t border-white/10 p-3">
          <input
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") void enviar() }}
            maxLength={300}
            placeholder="Escreva uma mensagem…"
            className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-white/25 outline-none focus:border-[#00ffc8]/40"
          />
          <button
            onClick={() => void enviar()}
            disabled={!texto.trim() || enviando}
            className="rounded-lg bg-[#00ffc8] px-3 py-2 text-black transition-opacity hover:opacity-90 disabled:opacity-35"
            aria-label="Enviar"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

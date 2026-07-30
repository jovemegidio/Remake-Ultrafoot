"use client"

// CHAT COM A DIRETORIA — campo de texto livre, resposta na hora.
//
// A primeira versão era um menu de três frases prontas. Agora você ESCREVE, e a
// diretoria responde ao que foi escrito: o assunto e o tom saem do próprio texto
// (lib/conversa-diretoria.ts), e a resposta olha confiança, campanha, caixa e
// quantas vezes você já pediu algo na temporada.
//
// SEM MODELO DE LINGUAGEM, e isso é de propósito: o jogo roda offline no PC do
// jogador. Um chat de IA em nuvem exigiria internet, chave de API e custo por
// mensagem — e ficaria mudo no avião. Aqui a leitura é por intenção, e quando
// ela falha a diretoria diz que não entendeu, em vez de inventar resposta.

import { useEffect, useMemo, useRef, useState } from "react"
import { Building2, Send, X } from "lucide-react"
import { formatCurrency } from "@/lib/teams-data"
import {
  ASSUNTOS,
  PEDIDO_DE_CLAREZA,
  RESPOSTAS,
  aberturaDaDiretoria,
  assuntoDoTexto,
  responderDiretoria,
  tomDoTexto,
  type DesfechoDaConversa,
  type EstadoDaDiretoria,
  type FalaDaConversa,
} from "@/lib/conversa-diretoria"
import { cn } from "@/lib/utils"

/** Uma linha do chat, com hora — como qualquer aplicativo de mensagem. */
interface Mensagem extends FalaDaConversa {
  hora: string
}

const agora = () =>
  new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

export function ConversaDiretoria({
  aberto,
  onFechar,
  clube,
  estado,
  onDesfecho,
  onPedirDemissao,
}: {
  aberto: boolean
  onFechar: () => void
  clube: string
  estado: EstadoDaDiretoria
  onDesfecho: (d: DesfechoDaConversa) => void
  /** Confirmada a saída, quem chama executa (limpa o clube e volta ao menu). */
  onPedirDemissao: () => void
}) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [texto, setTexto] = useState("")
  const [digitando, setDigitando] = useState(false)
  // Demissão é irreversível: a conversa pede confirmação antes de executar.
  const [confirmandoSaida, setConfirmandoSaida] = useState(false)
  const fimDaLista = useRef<HTMLDivElement>(null)
  const campo = useRef<HTMLInputElement>(null)

  // Saudação de abertura, uma vez por reunião.
  useEffect(() => {
    if (!aberto) return
    setMensagens([{
      autor: "diretoria",
      texto: `Boa tarde. Você tem a palavra — o conselho do ${clube} está reunido.`,
      hora: agora(),
    }])
    setTexto("")
    setDigitando(false)
    window.setTimeout(() => campo.current?.focus(), 80)
  }, [aberto, clube])

  // Rola para a última mensagem, como todo chat.
  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [mensagens, digitando])

  /** Sugestões clicáveis — atalho para quem não quer digitar. */
  const sugestoes = useMemo(
    () => ASSUNTOS.map(a => ({ id: a.id, rotulo: a.titulo, frase: RESPOSTAS[a.id][1].texto })),
    [],
  )

  if (!aberto) return null

  const enviar = (mensagem: string) => {
    const limpo = mensagem.trim()
    if (!limpo || digitando) return

    setMensagens(m => [...m, { autor: "tecnico", texto: limpo, hora: agora() }])
    setTexto("")

    const assunto = assuntoDoTexto(limpo)
    setDigitando(true)

    // A pausa é curta de propósito: dá a sensação de resposta ("digitando...")
    // sem transformar a conversa numa sala de espera.
    window.setTimeout(() => {
      if (!assunto) {
        setMensagens(m => [...m, { autor: "diretoria", texto: PEDIDO_DE_CLAREZA, hora: agora() }])
        setDigitando(false)
        return
      }
      const tom = tomDoTexto(limpo)
      const desfecho = responderDiretoria(assunto, tom, estado)

      // Contexto do assunto + a resposta, em duas falas — é assim que uma
      // reunião soa: eles reconhecem o tema antes de responder.
      const contexto = aberturaDaDiretoria(assunto, estado)
      const extras: string[] = []
      if (desfecho.verbaLiberada) extras.push(`Liberamos ${formatCurrency(desfecho.verbaLiberada)} para o mercado.`)
      if (desfecho.novaMeta) extras.push(`A meta passa a ser terminar até o ${desfecho.novaMeta}º.`)

      setMensagens(m => [
        ...m,
        { autor: "diretoria", texto: contexto, hora: agora() },
        { autor: "diretoria", texto: [desfecho.resposta, ...extras].join(" "), hora: agora() },
      ])
      setDigitando(false)
      // Sair do clube não acontece por engano: a conversa registra o pedido e a
      // execução espera o botão de confirmação abaixo.
      if (desfecho.pedeDemissao) setConfirmandoSaida(true)
      else onDesfecho(desfecho)
    }, 700)
  }

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-black/75 p-6" onClick={onFechar}>
      <div
        className="flex h-[560px] max-h-[92%] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c14]"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--brand)]/15">
              <Building2 className="h-5 w-5 text-[var(--brand)]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Diretoria do {clube}</h2>
              <p className="text-[11px] text-white/45">
                {digitando ? "digitando..." : `confiança em ${Math.round(estado.confianca)}% · caixa ${formatCurrency(estado.caixa)}`}
              </p>
            </div>
          </div>
          <button onClick={onFechar} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Conversa */}
        <div className="scrollbar-game min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 py-4">
          {mensagens.map((m, i) => (
            <div key={i} className={cn("flex flex-col", m.autor === "tecnico" ? "items-end" : "items-start")}>
              <div
                className={cn(
                  "max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  m.autor === "diretoria"
                    ? "rounded-tl-sm bg-white/[0.07] text-white/85"
                    : "rounded-tr-sm bg-[var(--brand)]/18 text-[var(--brand)]",
                )}
              >
                {m.texto}
              </div>
              <span className="mt-0.5 px-1 text-[10px] text-white/25">{m.hora}</span>
            </div>
          ))}

          {digitando && (
            <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-white/[0.07] px-4 py-3 w-fit">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </div>
          )}
          <div ref={fimDaLista} />
        </div>

        {/* Confirmação da saída — só aparece depois de o pedido ser feito. */}
        {confirmandoSaida && (
          <div className="border-t border-red-500/20 bg-red-500/[0.07] px-5 py-3">
            <p className="text-xs text-red-200/80">
              Confirmar o pedido encerra seu ciclo no {clube} agora. O progresso fica salvo e você
              volta ao menu como técnico sem clube.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={onPedirDemissao}
                className="rounded-lg bg-red-500 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-red-400"
              >
                Confirmar demissão
              </button>
              <button
                onClick={() => {
                  setConfirmandoSaida(false)
                  setMensagens(m => [...m, { autor: "diretoria", texto: "Que bom. Seguimos juntos, então.", hora: agora() }])
                }}
                className="rounded-lg px-3 py-2 text-xs font-semibold text-white/60 hover:bg-white/10"
              >
                Voltar atrás
              </button>
            </div>
          </div>
        )}

        {/* Sugestões — atalho, não substituto do texto livre. */}
        <div className="flex flex-wrap gap-1.5 border-t border-white/[0.04] px-5 py-2">
          {sugestoes.map(s => (
            <button
              key={s.id}
              onClick={() => enviar(s.frase)}
              disabled={digitando}
              className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/55 transition-colors hover:border-[var(--brand)]/40 hover:text-white disabled:opacity-40"
            >
              {s.rotulo}
            </button>
          ))}
        </div>

        {/* Campo de texto */}
        <form
          onSubmit={e => { e.preventDefault(); enviar(texto) }}
          className="flex items-center gap-2 border-t border-white/[0.06] p-3"
        >
          <input
            ref={campo}
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Escreva para a diretoria..."
            maxLength={280}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[var(--brand)]/40 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!texto.trim() || digitando}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--brand)] text-[var(--brand-ink)] transition-all hover:brightness-110 disabled:opacity-30"
            aria-label="Enviar"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  )
}

"use client"

// FALAR EM VEZ DE DIGITAR — nas conversas com a diretoria e com o atleta.
//
// ⚠️ O QUE ISTO É, E O QUE NÃO É (pedido: "implemente uma funcionalidade de falar
// com a diretoria e com o atleta através do microfone").
//
// Isto transcreve VOZ EM TEXTO e joga o texto no mesmo campo que já existe. O
// entendimento continua sendo o do jogo — leitura de intenção por palavra-chave
// (`assuntoDoTexto`/`tomDoTexto`), cujo vocabulário foi ampliado junto com esta
// funcionalidade. Não há modelo de linguagem: o jogo é offline. Falar "preciso
// de grana para reforçar o ataque" funciona porque "grana" e "reforc" estão no
// vocabulário — não porque a diretoria compreendeu a frase.
//
// POR QUE Web Speech API e não uma lib: ela é nativa da WebView (o Ultrafoot roda
// em WebView2/Chromium), não pesa um byte no instalador e já vem com o modelo de
// português do sistema. Uma lib de reconhecimento embarcada custaria dezenas de
// MB num pacote que já tem 837.
//
// ⚠️ RECONHECIMENTO PODE NÃO EXISTIR. Em WebView sem conexão, ou com o serviço de
// fala desligado no Windows, `SpeechRecognition` simplesmente não está no
// `window`. O botão então NÃO É RENDERIZADO — em vez de aparecer e falhar no
// clique, que é a pior das combinações: o usuário fica achando que o microfone
// está quebrado quando ele nunca esteve disponível.

import { useEffect, useRef, useState } from "react"
import { Mic, MicOff, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

// ⚠️ TIPOS DECLARADOS AQUI porque a Web Speech API nao esta na `lib` do
// TypeScript deste projeto (o tsconfig usa DOM padrao, e `SpeechRecognition`
// vive numa spec separada, ainda nao incorporada). Declaramos o MINIMO que este
// componente usa — puxar um pacote de tipos inteiro por seis membros seria
// dependencia nova para nada.
interface ResultadoDeFala { readonly transcript: string }
interface ItemDeResultado { readonly length: number; readonly [i: number]: ResultadoDeFala }
interface ListaDeResultados { readonly length: number; readonly [i: number]: ItemDeResultado }
interface EventoDeFala { readonly resultIndex: number; readonly results: ListaDeResultados }
interface EventoDeErroDeFala { readonly error: string }
interface Reconhecimento {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: EventoDeFala) => void) | null
  onerror: ((e: EventoDeErroDeFala) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

/** O construtor existe neste ambiente? (padrão + prefixo do Chromium) */
function construtorDeFala(): (new () => Reconhecimento) | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as {
    SpeechRecognition?: new () => Reconhecimento
    webkitSpeechRecognition?: new () => Reconhecimento
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

interface Props {
  /** Recebe o texto transcrito — quem chama decide se envia ou só preenche. */
  onTexto: (texto: string) => void
  /** Enviar sozinho ao terminar de falar, em vez de só preencher o campo. */
  enviarAoTerminar?: boolean
  className?: string
}

export function BotaoMicrofone({ onTexto, enviarAoTerminar = false, className }: Props) {
  const [suportado, setSuportado] = useState(false)
  const [ouvindo, setOuvindo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const recRef = useRef<Reconhecimento | null>(null)
  // `onTexto` muda a cada render de quem chama; via ref o listener não precisa
  // ser reinstalado (e o reconhecimento não é reiniciado no meio da fala).
  const onTextoRef = useRef(onTexto)
  onTextoRef.current = onTexto

  useEffect(() => { setSuportado(construtorDeFala() !== null) }, [])

  useEffect(() => () => { try { recRef.current?.stop() } catch { /* já parado */ } }, [])

  if (!suportado) return null

  const alternar = () => {
    setErro(null)
    if (ouvindo) { try { recRef.current?.stop() } catch { /* ignora */ } ; setOuvindo(false); return }

    const Rec = construtorDeFala()
    if (!Rec) return
    const rec = new Rec()
    recRef.current = rec
    rec.lang = "pt-BR"
    // `continuous` false: a pessoa fala uma frase e o resultado sai. Contínuo
    // deixaria o microfone aberto e capturaria conversa de fundo.
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 1

    let ultimo = ""
    rec.onresult = (e: EventoDeFala) => {
      let texto = ""
      for (let i = e.resultIndex; i < e.results.length; i++) texto += e.results[i][0].transcript
      ultimo = texto.trim()
      // Parcial já preenche o campo: a pessoa vê que está sendo ouvida.
      if (ultimo) onTextoRef.current(ultimo)
    }
    rec.onerror = (e: EventoDeErroDeFala) => {
      setOuvindo(false)
      setErro(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Permissão de microfone negada."
          : e.error === "no-speech" ? "Não ouvi nada." : "Falha no microfone.",
      )
      window.setTimeout(() => setErro(null), 3500)
    }
    rec.onend = () => {
      setOuvindo(false)
      if (enviarAoTerminar && ultimo) onTextoRef.current(ultimo)
    }
    try { rec.start(); setOuvindo(true) } catch { setErro("Não foi possível abrir o microfone.") }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={alternar}
        aria-label={ouvindo ? "Parar de falar" : "Falar"}
        title={ouvindo ? "Ouvindo — clique para parar" : "Falar em vez de digitar"}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
          ouvindo
            ? "border-red-400/50 bg-red-500/15 text-red-300"
            : "border-white/10 bg-white/[0.04] text-white/60 hover:border-[var(--brand)]/40 hover:text-[var(--brand)]",
          className,
        )}
      >
        {ouvindo ? <Loader2 className="h-4 w-4 animate-spin" /> : erro ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </button>
      {ouvindo && (
        <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-red-500/90 px-2 py-0.5 text-[10px] font-bold text-white">
          ouvindo…
        </span>
      )}
      {erro && (
        <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-2 py-0.5 text-[10px] text-white/80">
          {erro}
        </span>
      )}
    </div>
  )
}

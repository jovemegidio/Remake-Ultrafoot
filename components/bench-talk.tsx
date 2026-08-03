"use client"

// CONVERSA COM O RESERVA — agora um CHAT DE TEXTO, com consequência.
//
// Depois de X partidas do time sem entrar como titular, o atleta insatisfeito
// PEDE para conversar. Antes o modal oferecia três botões prontos e sempre os
// mesmos três resultados. Agora você ESCREVE e ele responde ao que foi dito
// (lib/conversa-atleta.ts) — e o que sai da conversa mexe no elenco de verdade:
// moral, titularidade, lista de transferências e a PROMESSA que fica registrada
// no save. Prometer vaga e não escalar custa caro na conversa seguinte.
//
// Deteccao: total de partidas do time (maior matchesPlayed do elenco) menos as
// partidas do atleta >= LIMIAR, e ele nao e titular. Dispara uma vez por atleta;
// so volta a cobrar se a situacao persistir por mais um bloco de partidas.

import { useEffect, useMemo, useRef, useState } from "react"
import { Send, X } from "lucide-react"
import { useGameEngine } from "@/lib/game-engine"
import { useGameState } from "@/lib/save-system"
import { useNotifications } from "@/components/notifications-system"
import { PlayerAvatarCircle } from "@/components/player-avatar"
import {
  PEDIDO_DE_CLAREZA,
  SUGESTOES,
  aberturaDoAtleta,
  intencaoDoTexto,
  responderAtleta,
  type EstadoDoAtleta,
} from "@/lib/conversa-atleta"
import { cn } from "@/lib/utils"

const LIMIAR = 5

/** Partidas que o time pode jogar depois da promessa antes de ela virar mentira. */
const PACIENCIA_DA_PROMESSA = 2

interface Fala { autor: "jogador" | "tecnico"; texto: string; hora: string }

const agora = () =>
  new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

export function BenchTalk() {
  const squad = useGameEngine(s => s.squadPlayers)
  const ajustarMoral = useGameEngine(s => s.ajustarMoralJogador)
  const setStarters = useGameEngine(s => s.setStarters)
  const toggleTransferListed = useGameEngine(s => s.toggleTransferListed)
  const transferListedIds = useGameEngine(s => s.transferListedIds)
  const { state: saveState, setState: setSaveState } = useGameState()
  const { addNotification } = useNotifications()
  const notificar = useRef(addNotification)
  notificar.current = addNotification

  // Ultima "conta de reserva" em que ja cobramos cada atleta (por id).
  const cobrado = useRef<Record<number, number>>({})
  const [alvo, setAlvo] = useState<number | null>(null)
  const [chat, setChat] = useState<Fala[]>([])
  const [texto, setTexto] = useState("")
  const [digitando, setDigitando] = useState(false)
  const [encerrado, setEncerrado] = useState(false)
  const fimDaLista = useRef<HTMLDivElement>(null)
  const campo = useRef<HTMLInputElement>(null)

  const totalDoTime = squad.reduce((m, p) => Math.max(m, p.seasonStats?.matchesPlayed ?? 0), 0)

  // ── COBRANÇA DA PROMESSA ───────────────────────────────────────────────────
  //
  // Roda no mesmo gatilho do resto (o time jogou mais uma partida). Promessa
  // cumprida some em silêncio; promessa quebrada custa moral, avisa o técnico e
  // fica no histórico — é o que faz a sua palavra valer alguma coisa.
  const cobrarPromessas = useRef<() => void>(() => undefined)
  cobrarPromessas.current = () => {
    const promessas = saveState.promessasAoAtleta
    if (!promessas || Object.keys(promessas).length === 0) return

    const restantes: NonNullable<typeof promessas> = {}
    let quebradas = 0

    for (const [id, p] of Object.entries(promessas)) {
      const atleta = squad.find(x => String(x.id) === id)
      if (!atleta) continue // saiu do elenco: a dívida morre com a transferência
      const jogosDele = atleta.seasonStats?.matchesPlayed ?? 0
      if (jogosDele > p.jogosDoAtleta) continue // entrou em campo: promessa cumprida
      if (totalDoTime - p.jogosDoTime < PACIENCIA_DA_PROMESSA) {
        restantes[id] = p // ainda dentro do prazo
        continue
      }
      quebradas++
      ajustarMoral(atleta.id, -2)
      notificar.current({
        type: "system", priority: "high",
        title: `${atleta.name} se sentiu enganado`,
        message: `Você prometeu titularidade a ${atleta.name} e ele seguiu fora do time. A moral dele caiu e ` +
          `a sua palavra vale menos na próxima conversa.`,
        conversation: { kind: "bench", playerId: atleta.id },
      })
    }

    if (quebradas > 0 || Object.keys(restantes).length !== Object.keys(promessas).length) {
      setSaveState({
        promessasAoAtleta: restantes,
        promessasQuebradas: (saveState.promessasQuebradas ?? 0) + quebradas,
      })
    }
  }

  useEffect(() => {
    cobrarPromessas.current()
    if (totalDoTime < LIMIAR) return
    for (const p of squad) {
      if (p.injury || p.isStarter) continue
      const semJogar = totalDoTime - (p.seasonStats?.matchesPlayed ?? 0)
      if (semJogar < LIMIAR) continue
      // Cobra a cada novo bloco de LIMIAR partidas sem jogar.
      const bloco = Math.floor(semJogar / LIMIAR)
      if ((cobrado.current[p.id] ?? 0) >= bloco) continue
      cobrado.current[p.id] = bloco
      notificar.current({
        type: "system", priority: "high",
        title: `${p.name} quer conversar`,
        message: `${p.name} está há ${semJogar} jogos sem começar como titular e pediu uma conversa sobre a situação dele.`,
        conversation: { kind: "bench", playerId: p.id },
      })
      // O atleta CHAMA para conversar: a conversa abre na hora.
      window.dispatchEvent(new CustomEvent("ultrafoot:bench-talk", { detail: { playerId: p.id } }))
      break // um por vez, para nao empilhar
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalDoTime])

  const jogador = alvo != null ? squad.find(p => p.id === alvo) : null

  /** A situação REAL do atleta — é dela que sai a resposta dele. */
  const estado: EstadoDoAtleta | null = useMemo(() => {
    if (!jogador) return null
    const concorrencia = squad
      .filter(p => p.isStarter && p.id !== jogador.id && p.position === jogador.position)
      .reduce((m, p) => Math.max(m, p.overall), 0)
    return {
      nome: jogador.name,
      posicao: jogador.position,
      moral: jogador.morale,
      overall: jogador.overall,
      idade: jogador.age ?? 25,
      jogosSemJogar: Math.max(0, totalDoTime - (jogador.seasonStats?.matchesPlayed ?? 0)),
      concorrencia,
      promessasQuebradas: saveState.promessasQuebradas ?? 0,
      naListaDeTransferencias: (transferListedIds ?? []).includes(jogador.id),
    }
  }, [jogador, squad, totalDoTime, saveState.promessasQuebradas, transferListedIds])

  // A Central (ou qualquer tela) abre a conversa disparando este evento.
  useEffect(() => {
    const abrir = (e: Event) => {
      const id = (e as CustomEvent<{ playerId: number }>).detail?.playerId
      const p = squad.find(x => x.id === id)
      if (!p) return
      const concorrencia = squad
        .filter(x => x.isStarter && x.id !== p.id && x.position === p.position)
        .reduce((m, x) => Math.max(m, x.overall), 0)
      setAlvo(id)
      setEncerrado(false)
      setTexto("")
      setDigitando(false)
      setChat([{
        autor: "jogador",
        texto: aberturaDoAtleta({
          nome: p.name,
          posicao: p.position,
          moral: p.morale,
          overall: p.overall,
          idade: p.age ?? 25,
          jogosSemJogar: Math.max(0, totalDoTime - (p.seasonStats?.matchesPlayed ?? 0)),
          concorrencia,
          promessasQuebradas: saveState.promessasQuebradas ?? 0,
          naListaDeTransferencias: (transferListedIds ?? []).includes(p.id),
        }),
        hora: agora(),
      }])
      window.setTimeout(() => campo.current?.focus(), 80)
    }
    window.addEventListener("ultrafoot:bench-talk", abrir)
    return () => window.removeEventListener("ultrafoot:bench-talk", abrir)
  }, [squad, totalDoTime, saveState.promessasQuebradas, transferListedIds])

  // Rola para a última mensagem, como todo chat.
  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [chat, digitando])

  if (!jogador || !estado) return null

  /** Aplica no elenco o que ficou combinado na conversa. */
  const aplicarDesfecho = (d: ReturnType<typeof responderAtleta>) => {
    if (d.moralDegraus !== 0) ajustarMoral(jogador.id, d.moralDegraus)

    if (d.viraTitular) {
      // Ele ENTRA e alguem SAI: sem isso o time fica com 12 titulares — uma
      // escalacao invalida, que faz a tela descartar o XI salvo e voltar ao
      // padrao. Quem sai e o titular de menor overall da MESMA posicao (o
      // concorrente direto); sem concorrente na posicao, sai o pior de linha.
      const titulares = squad.filter(p => p.isStarter && p.id !== jogador.id)
      const mesmaPos = titulares.filter(p => p.position === jogador.position)
      const candidatos = mesmaPos.length > 0 ? mesmaPos : titulares.filter(p => p.position !== "GOL")
      const sai = [...candidatos].sort((a, b) => a.overall - b.overall)[0]
      // GRAVACAO UNICA. Eram dois `setStarter`, e entre eles o elenco ficava com
      // DEZ titulares — estado invalido que o reparo automatico "conserta"
      // chamando o melhor do banco. O atleta a quem voce acabou de PROMETER a
      // vaga era entao cortado como excedente, e a promessa virava mentira sem
      // nenhum aviso. Com uma escrita so, esse instante nao existe.
      setStarters([
        ...titulares.filter(p => p.id !== sai?.id).map(p => p.id),
        jogador.id,
      ])
    }

    if (d.registraPromessa) {
      setSaveState({
        promessasAoAtleta: {
          ...(saveState.promessasAoAtleta ?? {}),
          [String(jogador.id)]: {
            semana: saveState.week ?? 0,
            jogosDoTime: totalDoTime,
            jogosDoAtleta: jogador.seasonStats?.matchesPlayed ?? 0,
          },
        },
      })
    }

    if (d.vaParaAListaDeTransferencias && !estado.naListaDeTransferencias) {
      toggleTransferListed(jogador.id)
    }
  }

  const enviar = (mensagem: string) => {
    const limpo = mensagem.trim()
    if (!limpo || digitando || encerrado) return

    setChat(c => [...c, { autor: "tecnico", texto: limpo, hora: agora() }])
    setTexto("")
    setDigitando(true)

    // A pausa e curta de proposito: da a sensacao de resposta ("digitando...")
    // sem transformar a conversa numa sala de espera.
    window.setTimeout(() => {
      const intencao = intencaoDoTexto(limpo)
      if (!intencao) {
        setChat(c => [...c, { autor: "jogador", texto: PEDIDO_DE_CLAREZA, hora: agora() }])
        setDigitando(false)
        return
      }
      const desfecho = responderAtleta(intencao, estado)
      aplicarDesfecho(desfecho)
      setChat(c => [...c, { autor: "jogador", texto: desfecho.resposta, hora: agora() }])
      setDigitando(false)
      if (desfecho.encerra) setEncerrado(true)
    }, 650)
  }

  const fechar = () => { setAlvo(null); setChat([]); setTexto("") }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/75 p-6" onClick={fechar}>
      <div
        className="flex h-[560px] max-h-[92%] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c14]"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-3">
            {/* Sem teamColor: o avatar monta o gradiente com `${teamColor}66`, que
                so aceita HEX — var(--brand) viraria CSS invalido. */}
            <PlayerAvatarCircle name={jogador.name} playerId={String(jogador.id)} size="md" />
            <div>
              <h2 className="text-sm font-bold text-white">{jogador.name}</h2>
              <p className="text-[11px] text-white/45">
                {digitando
                  ? "digitando..."
                  : `${jogador.position} · moral: ${jogador.morale} · ${estado.jogosSemJogar} jogos sem começar`}
              </p>
            </div>
          </div>
          <button onClick={fechar} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Conversa */}
        <div className="scrollbar-game min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 py-4">
          {chat.map((f, i) => (
            <div key={i} className={cn("flex flex-col", f.autor === "tecnico" ? "items-end" : "items-start")}>
              <div
                className={cn(
                  "max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  f.autor === "jogador"
                    ? "rounded-tl-sm bg-white/[0.07] text-white/85"
                    : "rounded-tr-sm bg-[var(--brand)]/18 text-[var(--brand)]",
                )}
              >
                {f.texto}
              </div>
              <span className="mt-0.5 px-1 text-[10px] text-white/25">{f.hora}</span>
            </div>
          ))}

          {digitando && (
            <div className="flex w-fit items-center gap-1.5 rounded-2xl rounded-tl-sm bg-white/[0.07] px-4 py-3">
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

        {encerrado ? (
          <div className="border-t border-white/[0.06] p-3">
            <button
              onClick={fechar}
              className="w-full rounded-xl bg-white/10 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              Encerrar conversa
            </button>
          </div>
        ) : (
          <>
            {/* Sugestões — atalho, não substituto do texto livre. */}
            <div className="flex flex-wrap gap-1.5 border-t border-white/[0.04] px-5 py-2">
              {SUGESTOES.map(s => (
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

            <form
              onSubmit={e => { e.preventDefault(); enviar(texto) }}
              className="flex items-center gap-2 border-t border-white/[0.06] p-3"
            >
              <input
                ref={campo}
                value={texto}
                onChange={e => setTexto(e.target.value)}
                placeholder={`Responda a ${jogador.name.split(" ")[0]}...`}
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
          </>
        )}
      </div>
    </div>
  )
}

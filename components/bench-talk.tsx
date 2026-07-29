"use client"

import { useEffect, useRef, useState } from "react"
import { useGameEngine } from "@/lib/game-engine"
import { useNotifications } from "@/components/notifications-system"
import { PlayerAvatarCircle } from "@/components/player-avatar"

/**
 * CONVERSA COM O RESERVA (pedido). Depois de X partidas do time sem entrar como
 * titular, o atleta insatisfeito PEDE para conversar sobre a situacao. Abre um
 * chat com o tecnico: o que voce responde muda a moral dele.
 *
 * Deteccao: total de partidas do time (maior matchesPlayed do elenco) menos as
 * partidas do atleta >= LIMIAR, e ele nao e titular. Dispara uma vez por atleta;
 * so volta a cobrar se a situacao persistir por mais um bloco de partidas.
 */
const LIMIAR = 5

interface Fala { autor: "jogador" | "tecnico"; texto: string }

export function BenchTalk() {
  const squad = useGameEngine(s => s.squadPlayers)
  const ajustarMoral = useGameEngine(s => s.ajustarMoralJogador)
  const setStarter = useGameEngine(s => s.setStarter)
  const { addNotification } = useNotifications()
  const notificar = useRef(addNotification)
  notificar.current = addNotification

  // Ultima "conta de reserva" em que ja cobramos cada atleta (por id).
  const cobrado = useRef<Record<number, number>>({})
  const [alvo, setAlvo] = useState<number | null>(null)
  const [chat, setChat] = useState<Fala[]>([])
  const [encerrado, setEncerrado] = useState(false)

  const totalDoTime = squad.reduce((m, p) => Math.max(m, p.seasonStats?.matchesPlayed ?? 0), 0)

  useEffect(() => {
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

  // A Central (ou qualquer tela) abre a conversa disparando este evento.
  useEffect(() => {
    const abrir = (e: Event) => {
      const id = (e as CustomEvent<{ playerId: number }>).detail?.playerId
      const p = squad.find(x => x.id === id)
      if (!p) return
      setAlvo(id)
      setEncerrado(false)
      const semJogar = totalDoTime - (p.seasonStats?.matchesPlayed ?? 0)
      setChat([{ autor: "jogador", texto: `Professor, faz ${semJogar} jogos que não começo. Quero saber o que preciso fazer para ser titular. Estou pensando na minha situação aqui.` }])
    }
    window.addEventListener("ultrafoot:bench-talk", abrir)
    return () => window.removeEventListener("ultrafoot:bench-talk", abrir)
  }, [squad, totalDoTime])

  const jogador = alvo != null ? squad.find(p => p.id === alvo) : null
  if (!jogador) return null

  const responder = (tipo: "promete" | "merece" | "vende") => {
    let fala = ""
    if (tipo === "promete") {
      fala = "Fico feliz de ouvir isso, professor. Vou dar meu máximo para retribuir a confiança."
      ajustarMoral(jogador.id, +2)
      // Promete titularidade: ele ENTRA e alguem SAI. Antes so ligava o
      // isStarter dele, deixando o time com 12 titulares — uma escalacao
      // invalida, que fazia a tela descartar o XI salvo e voltar ao padrao.
      // Quem sai e o titular de menor overall da MESMA posicao (o concorrente
      // direto); sem concorrente na posicao, sai o pior titular de linha.
      const titulares = squad.filter(p => p.isStarter && p.id !== jogador.id)
      const mesmaPos = titulares.filter(p => p.position === jogador.position)
      const candidatos = mesmaPos.length > 0
        ? mesmaPos
        : titulares.filter(p => p.position !== "GOL")
      const sai = [...candidatos].sort((a, b) => a.overall - b.overall)[0]
      if (sai) setStarter(sai.id, false)
      setStarter(jogador.id, true)
    } else if (tipo === "merece") {
      fala = "Entendo. Vou trabalhar mais forte no treino para conquistar meu espaço."
      ajustarMoral(jogador.id, +1)
    } else {
      fala = "Se é assim, prefiro procurar um clube onde eu jogue. Obrigado pela sinceridade."
      ajustarMoral(jogador.id, -2)
    }
    setChat(c => [...c, { autor: "jogador", texto: fala }])
    setEncerrado(true)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      onClick={() => setAlvo(null)}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c0d12] p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-3">
          <PlayerAvatarCircle name={jogador.name} teamColor="#00ffc8" size="md" />
          <div>
            <div className="font-bold text-white">{jogador.name}</div>
            <div className="text-xs text-white/40">{jogador.position} · moral: {jogador.morale}</div>
          </div>
        </div>

        <div className="mb-4 max-h-64 space-y-2 overflow-y-auto">
          {chat.map((f, i) => (
            <div key={i} className={f.autor === "jogador" ? "flex" : "flex justify-end"}>
              <div className={"max-w-[85%] rounded-2xl px-3 py-2 text-sm " +
                (f.autor === "jogador" ? "bg-white/8 text-white/85" : "bg-[var(--brand)] text-[var(--brand-ink)]")}>
                {f.texto}
              </div>
            </div>
          ))}
        </div>

        {encerrado ? (
          <button onClick={() => setAlvo(null)}
            className="w-full rounded-lg bg-white/10 py-2.5 text-sm font-semibold text-white hover:bg-white/15">
            Encerrar conversa
          </button>
        ) : (
          <div className="space-y-2">
            <button onClick={() => responder("promete")}
              className="w-full rounded-lg bg-[var(--brand)]/15 border border-[var(--brand)]/40 py-2.5 text-sm font-semibold text-[var(--brand)] hover:bg-[var(--brand)]/25 text-left px-3">
              &quot;Você será titular na próxima partida.&quot; <span className="text-white/40 text-xs">(+moral, vira titular)</span>
            </button>
            <button onClick={() => responder("merece")}
              className="w-full rounded-lg bg-white/5 border border-white/10 py-2.5 text-sm font-medium text-white hover:bg-white/10 text-left px-3">
              &quot;Titularidade se conquista no treino.&quot; <span className="text-white/40 text-xs">(+moral leve)</span>
            </button>
            <button onClick={() => responder("vende")}
              className="w-full rounded-lg bg-red-500/10 border border-red-500/25 py-2.5 text-sm font-medium text-red-300 hover:bg-red-500/20 text-left px-3">
              &quot;Se quiser jogar, pode procurar outro clube.&quot; <span className="text-white/40 text-xs">(-moral)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

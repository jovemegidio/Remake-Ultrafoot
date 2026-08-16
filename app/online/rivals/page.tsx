"use client"

// MANAGER RIVALS — fila, divisão e ranking.
//
// Aqui ninguém controla jogador: os dois técnicos escalam, montam tática e
// mexem na partida; o motor joga. O que esta tela faz é conversar com o
// SERVIDOR — entrar na fila, receber o adversário que ele escolheu e mandar o
// placar para conferência.
//
// ⚠️ Nenhum número desta tela é calculado aqui. Rating, divisão e validação do
// resultado vêm do relay. Se fossem locais, bastaria editar o save para virar
// primeiro do mundo — que é exatamente o que o anti-cheat existe para impedir.

import { useCallback, useEffect, useState } from "react"
import { Loader2, Swords, Trophy } from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { Button } from "@/components/ui/button"
import { useGameState } from "@/lib/save-system"
import { getTeamByShort } from "@/lib/teams-data"
import { hardNavigate } from "@/lib/hard-navigation"
import { useTelaGamepad } from "@/hooks/use-tela-gamepad"
import { cn } from "@/lib/utils"
import {
  entrarNaFila, ranking, sairDaFila,
  type EstadoDaFila, type LinhaDoRanking,
} from "@/lib/manager-rivals"

export default function RivalsPage() {
  useTelaGamepad({ aoVoltar: () => hardNavigate("/online") })
  const { state } = useGameState()
  const [fila, setFila] = useState<EstadoDaFila | null>(null)
  const [procurando, setProcurando] = useState(false)
  const [tabela, setTabela] = useState<LinhaDoRanking[]>([])

  const clube = getTeamByShort(state.selectedTeamShort ?? "")
  const managerId = state.careerId ?? "convidado"

  useEffect(() => { void ranking(20).then(setTabela) }, [])

  const procurar = useCallback(async () => {
    setProcurando(true)
    const r = await entrarNaFila({
      modo: "rivals",
      managerId,
      managerName: state.managerName || "Técnico",
      forcaDoClube: clube?.prestigio ?? 70,
    })
    setFila(r)
    // Na fila, o cliente volta a perguntar: é o servidor que decide quando há
    // adversário compatível, e a janela de tolerância dele abre com a espera.
    if (r.estado !== "pareado") setTimeout(() => { if (procurando) void procurar() }, 5000)
    else setProcurando(false)
  }, [managerId, state.managerName, clube?.prestigio, procurando])

  const cancelar = async () => {
    setProcurando(false)
    setFila(null)
    await sairDaFila("rivals", managerId)
  }

  if (!state.multiplayerEnabled) {
    return (
      <main className="h-dvh overflow-y-auto bg-[#06090d] text-white">
        <GameHeader />
        <div className="mx-auto max-w-xl px-5 pt-28 text-center">
          <h1 className="text-2xl font-black">O modo online está desligado</h1>
          <Button className="mt-5" onClick={() => hardNavigate("/configuracoes")}>Abrir configurações</Button>
        </div>
      </main>
    )
  }

  return (
    <main className="h-dvh overflow-y-auto bg-[#06090d] text-white">
      <GameHeader />
      <div className="mx-auto max-w-[1000px] px-5 pb-14 pt-20">
        <header className="mb-6">
          <p className="text-xs font-black uppercase tracking-[.25em] text-[var(--brand)]">Competitivo</p>
          <h1 className="mt-1 text-3xl font-black">Manager Rivals</h1>
          <p className="mt-1 max-w-2xl text-sm text-white/50">
            O servidor procura um técnico de ranking parecido <b className="text-white/70">e clube de força
            parecida</b> — sem isso o pareamento produziria Real Madrid contra Criciúma só porque os dois
            têm o mesmo ranking.
          </p>
        </header>

        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[.04] p-5">
          {fila?.estado === "pareado" ? (
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black"><Swords className="text-[var(--brand)]" />Adversário encontrado</h2>
              <p className="mt-2 text-sm text-white/70">
                <b className="text-white">{fila.pareamento.adversario.nome}</b> · rating{" "}
                {fila.pareamento.adversario.rating} · {fila.pareamento.adversario.divisao.nome}
              </p>
              <p className="mt-1 text-[11px] text-white/40">
                Sala <b className="text-white/70">{fila.pareamento.roomCode}</b>, criada pelo servidor —
                ninguém escolhe adversário e ninguém abre a partida para desistir depois de ver quem é.
              </p>
              <Button className="mt-4 bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[#00d9b0]" onClick={() => hardNavigate(`/multiplayer-local?sala=${fila.pareamento.roomCode}`)}>
                Entrar na partida
              </Button>
            </div>
          ) : procurando ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--brand)]" />
                <div>
                  <p className="font-bold">Procurando adversário…</p>
                  <p className="text-[11px] text-white/45">
                    {fila?.estado === "na_fila"
                      ? `Seu rating: ${fila.perfil.rating} · ${fila.perfil.divisao.nome}`
                      : "Entrando na fila"}
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={cancelar}>Cancelar</Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-bold">{clube ? `${clube.nome} · força ${clube.prestigio}` : "Sem clube ativo"}</p>
                <p className="text-[11px] text-white/45">
                  {fila?.estado === "erro"
                    ? fila.erro === "sem_conexao" ? "Servidor fora de alcance agora." : `Recusado: ${fila.erro}`
                    : "O motor joga a partida; você decide escalação, tática e substituições."}
                </p>
              </div>
              <Button className="bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[#00d9b0]" onClick={procurar}>
                <Swords className="mr-2 h-4 w-4" /> Procurar partida
              </Button>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
          <h2 className="flex items-center gap-2 text-xl font-black"><Trophy className="text-[var(--brand)]" />Ranking</h2>
          {tabela.length === 0 ? (
            <p className="mt-3 text-sm text-white/40">Ninguém pontuou ainda neste servidor.</p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-white/40">
                <tr><th className="p-2 text-left">#</th><th className="p-2 text-left">Técnico</th><th className="p-2 text-left">Divisão</th><th className="p-2">Rating</th><th className="p-2">V-E-D</th></tr>
              </thead>
              <tbody>
                {tabela.map(l => (
                  <tr key={l.posicao} className={cn("border-t border-white/5", l.nome === state.managerName && "bg-[var(--brand)]/10")}>
                    <td className="p-2 text-white/40">{l.posicao}</td>
                    <td className="p-2 font-medium">{l.nome}</td>
                    <td className="p-2 text-white/60">{l.divisao}</td>
                    <td className="p-2 text-center font-black">{l.rating}</td>
                    <td className="p-2 text-center text-white/60">{l.v}-{l.e}-{l.d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  )
}

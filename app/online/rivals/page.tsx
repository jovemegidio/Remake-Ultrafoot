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

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Swords, Trophy } from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { Button } from "@/components/ui/button"
import { useGameState } from "@/lib/save-system"
import { getTeamByShort } from "@/lib/teams-data"
import { hardNavigate } from "@/lib/hard-navigation"
import { useTelaGamepad } from "@/hooks/use-tela-gamepad"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import {
  entrarNaFila, ranking, sairDaFila,
  type EstadoDaFila, type LinhaDoRanking,
} from "@/lib/manager-rivals"
import { joinInternetRoom } from "@/lib/internet-multiplayer"

export default function RivalsPage() {
  useTelaGamepad({ aoVoltar: () => hardNavigate("/online") })
  const { state } = useGameState()
  const t = useTranslation()
  const [fila, setFila] = useState<EstadoDaFila | null>(null)
  const [procurando, setProcurando] = useState(false)
  const [tabela, setTabela] = useState<LinhaDoRanking[]>([])
  const [entrando, setEntrando] = useState(false)
  const [erroDaEntrada, setErroDaEntrada] = useState("")

  const clube = getTeamByShort(state.selectedTeamShort ?? "")
  const managerId = state.careerId ?? "convidado"

  useEffect(() => { void ranking(20).then(setTabela) }, [])

  // ⚠️ A ESPERA PRECISA DE UM REF, NÃO DO ESTADO. A re-consulta lia `procurando`
  // capturado no render — que vale `false` na primeira chamada, porque o
  // `setProcurando(true)` da linha de cima só vale no render seguinte. Resultado:
  // a guarda nunca passava, a fila era consultada UMA vez e a tela ficava
  // "Procurando adversário…" para sempre, mesmo com alguém disponível do outro
  // lado. O ref é lido no momento do disparo, que é quando a resposta importa.
  const procurandoRef = useRef(false)
  const pararDeProcurar = useCallback(() => { procurandoRef.current = false; setProcurando(false) }, [])

  const procurar = useCallback(async () => {
    procurandoRef.current = true
    setProcurando(true)
    const r = await entrarNaFila({
      modo: "rivals",
      managerId,
      managerName: state.managerName || "Técnico",
      forcaDoClube: clube?.prestigio ?? 70,
    })
    if (!procurandoRef.current) return // cancelado enquanto o pedido voltava
    setFila(r)
    // Na fila, o cliente volta a perguntar: é o servidor que decide quando há
    // adversário compatível, e a janela de tolerância dele abre com a espera.
    if (r.estado === "pareado" || r.estado === "erro") pararDeProcurar()
    else setTimeout(() => { if (procurandoRef.current) void procurar() }, 5000)
  }, [managerId, state.managerName, clube?.prestigio, pararDeProcurar])

  // Sair da tela não pode deixar o laço de consulta batendo no relay para sempre.
  useEffect(() => () => { procurandoRef.current = false }, [])

  // ⚠️ AQUI O CICLO SE FECHAVA NO VAZIO. O botão levava a
  // `/multiplayer-local?sala=CÓDIGO`, e essa rota é o stub dos modos locais
  // REMOVIDOS: ela ignora todo parâmetro e devolve o jogador à raiz em 2,5s.
  // Ou seja, o pareamento funcionava, o servidor criava a sala — e o jogador era
  // despejado no menu. Mesmo defeito do amistoso da 1.0.336, um passo mais fundo.
  //
  // A sala do pareamento vive no RELAY, então quem sabe entrar nela é o cliente
  // de internet (`lib/internet-multiplayer`), não o de rede local. Entrando por
  // ali a sessão fica salva, e o FC Hub — que é onde a sala de internet tem
  // tela — a restaura sozinha ao montar.
  const entrarNaPartida = useCallback(async (roomCode: string) => {
    setEntrando(true); setErroDaEntrada("")
    try {
      await joinInternetRoom({
        code: roomCode,
        managerName: state.managerName || "Técnico",
        teamShort: state.selectedTeamShort ?? "",
      })
      try { sessionStorage.setItem("ultrafoot:abrir-fc-hub", "1") } catch { /* o Hub abre no Tab */ }
      hardNavigate("/")
    } catch (e) {
      setErroDaEntrada(e instanceof Error ? e.message : "Não deu para entrar na sala.")
      setEntrando(false)
    }
  }, [state.managerName, state.selectedTeamShort])

  const cancelar = async () => {
    pararDeProcurar()
    setFila(null)
    await sairDaFila("rivals", managerId)
  }

  if (!state.multiplayerEnabled) {
    return (
      <main className="h-dvh overflow-y-auto bg-[#06090d] text-white">
        <GameHeader />
        <div className="mx-auto max-w-xl px-5 pt-28 text-center">
          <h1 className="uf-heading text-2xl font-black">{t.champions.online_desligado}</h1>
          <Button className="mt-5" onClick={() => hardNavigate("/configuracoes")}>{t.champions.abrir_configuracoes}</Button>
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
          <h1 className="uf-heading mt-1 text-3xl font-black">Manager Rivals</h1>
          <p className="mt-1 max-w-2xl text-sm text-white/50">
            O servidor procura um técnico de ranking parecido <b className="text-white/70">e clube de força
            parecida</b> — sem isso o pareamento produziria Real Madrid contra Criciúma só porque os dois
            têm o mesmo ranking.
          </p>
        </header>

        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[.04] p-5">
          {fila?.estado === "pareado" ? (
            <div>
              <h2 className="uf-heading flex items-center gap-2 text-xl font-black"><Swords className="text-[var(--brand)]" />{t.champions.adversario_encontrado}</h2>
              <p className="mt-2 text-sm text-white/70">
                <b className="text-white">{fila.pareamento.adversario.nome}</b> · rating{" "}
                {fila.pareamento.adversario.rating} · {fila.pareamento.adversario.divisao.nome}
              </p>
              <p className="mt-1 text-[11px] text-white/40">
                Sala <b className="text-white/70">{fila.pareamento.roomCode}</b>, criada pelo servidor —
                ninguém escolhe adversário e ninguém abre a partida para desistir depois de ver quem é.
              </p>
              <Button
                className="mt-4 bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[#00d9b0]"
                disabled={entrando}
                onClick={() => void entrarNaPartida(fila.pareamento.roomCode)}
              >
                {entrando ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t.champions.entrando}</> : t.champions.entrar_na_partida}
              </Button>
              {erroDaEntrada && (
                <p className="mt-2 text-[11px] text-red-300">{erroDaEntrada}</p>
              )}
            </div>
          ) : procurando ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--brand)]" />
                <div>
                  <p className="font-bold">{t.champions.procurando}</p>
                  <p className="text-[11px] text-white/45">
                    {fila?.estado === "na_fila"
                      ? `Seu rating: ${fila.perfil.rating} · ${fila.perfil.divisao.nome}`
                      : t.champions.entrando_na_fila}
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={cancelar}>{t.champions.cancelar}</Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-bold">{clube ? `${clube.nome} · força ${clube.prestigio}` : t.champions.sem_clube_ativo}</p>
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
          <h2 className="uf-heading flex items-center gap-2 text-xl font-black"><Trophy className="text-[var(--brand)]" />Ranking</h2>
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

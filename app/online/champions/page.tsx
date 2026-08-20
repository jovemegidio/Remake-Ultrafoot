"use client"

// MANAGER CHAMPIONS — o competitivo da SEMANA.
//
// ⚠️ O QUE ELE NÃO É: um segundo matchmaking. A fila, o pareamento, o Elo e o
// anti-cheat são os MESMOS do Manager Rivals (`modo: "champions"` na mesma
// rota) — dois sistemas de pareamento para o mesmo jogo discordariam na
// primeira mudança de regra, e o servidor é quem decide as duas coisas.
//
// O que ele acrescenta é uma TABELA que zera toda segunda-feira: no Rivals você
// sobe uma escada permanente (rating e divisão); aqui você disputa a semana, e
// na segunda todo mundo recomeça do zero. Por isso a tela mostra a contagem
// regressiva: sem ela, classificacao semanal vira so uma palavra.
//
// Nada aqui é calculado no cliente. Pontos, saldo e posição vêm do relay.

import { useCallback, useEffect, useRef, useState } from "react"
import { Clock, Loader2, Swords, Trophy } from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { Button } from "@/components/ui/button"
import { useGameState } from "@/lib/save-system"
import { getTeamByShort } from "@/lib/teams-data"
import { hardNavigate } from "@/lib/hard-navigation"
import { useTelaGamepad } from "@/hooks/use-tela-gamepad"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import {
  classificacaoDaSemana, entrarNaFila, sairDaFila,
  type ClassificacaoSemanal, type EstadoDaFila,
} from "@/lib/manager-rivals"
import { joinInternetRoom } from "@/lib/internet-multiplayer"

/** "2 dias e 4 h" — o suficiente para saber se ainda dá tempo de jogar. */
function faltando(ate: number, t: ReturnType<typeof useTranslation>): string {
  const ms = ate - Date.now()
  if (ms <= 0) return t.champions.virando_agora
  const horas = Math.floor(ms / 3600000)
  const dias = Math.floor(horas / 24)
  if (dias >= 1) return `${dias} ${dias > 1 ? t.champions.dias : t.champions.dia} e ${horas % 24} h`
  if (horas >= 1) return `${horas} h`
  return `${Math.max(1, Math.floor(ms / 60000))} min`
}

export default function ChampionsPage() {
  useTelaGamepad({ aoVoltar: () => hardNavigate("/online") })
  const { state } = useGameState()
  const t = useTranslation()
  const [fila, setFila] = useState<EstadoDaFila | null>(null)
  const [procurando, setProcurando] = useState(false)
  const [semana, setSemana] = useState<ClassificacaoSemanal | null>(null)
  const [entrando, setEntrando] = useState(false)
  const [erroDaEntrada, setErroDaEntrada] = useState("")

  const clube = getTeamByShort(state.selectedTeamShort ?? "")
  const managerId = state.careerId ?? "convidado"

  const recarregarTabela = useCallback(() => { void classificacaoDaSemana(30).then(setSemana) }, [])
  useEffect(() => { recarregarTabela() }, [recarregarTabela])

  // O ref existe pelo mesmo motivo do Manager Rivals: a re-consulta lê o valor
  // no momento do disparo, e o estado do render seria o de antes do clique.
  const procurandoRef = useRef(false)
  const pararDeProcurar = useCallback(() => { procurandoRef.current = false; setProcurando(false) }, [])

  const procurar = useCallback(async () => {
    procurandoRef.current = true
    setProcurando(true)
    const r = await entrarNaFila({
      modo: "champions",
      managerId,
      managerName: state.managerName || t.champions.tecnico,
      forcaDoClube: clube?.prestigio ?? 70,
    })
    if (!procurandoRef.current) return
    setFila(r)
    if (r.estado === "pareado" || r.estado === "erro") pararDeProcurar()
    else setTimeout(() => { if (procurandoRef.current) void procurar() }, 5000)
  }, [managerId, state.managerName, clube?.prestigio, pararDeProcurar, t.champions.tecnico])

  useEffect(() => () => { procurandoRef.current = false }, [])

  const entrarNaPartida = useCallback(async (roomCode: string) => {
    setEntrando(true); setErroDaEntrada("")
    try {
      await joinInternetRoom({
        code: roomCode,
        managerName: state.managerName || t.champions.tecnico,
        teamShort: state.selectedTeamShort ?? "",
      })
      try { sessionStorage.setItem("ultrafoot:abrir-fc-hub", "1") } catch { /* o Hub abre no Tab */ }
      hardNavigate("/")
    } catch (e) {
      setErroDaEntrada(e instanceof Error ? e.message : t.champions.nao_deu_para_entrar)
      setEntrando(false)
    }
  }, [state.managerName, state.selectedTeamShort, t.champions.tecnico, t.champions.nao_deu_para_entrar])

  const cancelar = async () => {
    pararDeProcurar()
    setFila(null)
    await sairDaFila("champions", managerId)
  }

  if (!state.multiplayerEnabled) {
    return (
      <main className="h-screen overflow-y-auto bg-[#06090d] text-white">
        <GameHeader />
        <div className="mx-auto max-w-xl px-5 pt-28 text-center">
          <h1 className="text-2xl font-black">{t.champions.online_desligado}</h1>
          <Button className="mt-5" onClick={() => hardNavigate("/configuracoes")}>{t.champions.abrir_configuracoes}</Button>
        </div>
      </main>
    )
  }

  return (
    <main className="h-screen overflow-y-auto bg-[#06090d] text-white">
      <GameHeader />
      <div className="mx-auto max-w-[1000px] px-5 pb-14 pt-20">
        <header className="mb-6">
          <p className="text-xs font-black uppercase tracking-[.25em] text-[var(--brand)]">{t.champions.competitivo}</p>
          <h1 className="mt-1 text-3xl font-black">{t.champions.titulo}</h1>
          <p className="mt-1 max-w-2xl text-sm text-white/50">
            {t.champions.subtitulo_1} <b className="text-white/70">{t.champions.subtitulo_destaque}</b>{t.champions.subtitulo_2}
          </p>
        </header>

        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[.04] p-5">
          {fila?.estado === "pareado" ? (
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black"><Swords className="text-[var(--brand)]" />{t.champions.adversario_encontrado}</h2>
              <p className="mt-2 text-sm text-white/70">
                <b className="text-white">{fila.pareamento.adversario.nome}</b> · rating{" "}
                {fila.pareamento.adversario.rating} · {fila.pareamento.adversario.divisao.nome}
              </p>
              <p className="mt-1 text-[11px] text-white/40">
                {t.champions.sala_criada} <b className="text-white/70">{fila.pareamento.roomCode}</b>{t.champions.sala_explicacao}
              </p>
              <Button
                className="mt-4 bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[#00d9b0]"
                disabled={entrando}
                onClick={() => void entrarNaPartida(fila.pareamento.roomCode)}
              >
                {entrando ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t.champions.entrando}</> : t.champions.entrar_na_partida}
              </Button>
              {erroDaEntrada && <p className="mt-2 text-[11px] text-red-300">{erroDaEntrada}</p>}
            </div>
          ) : procurando ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--brand)]" />
                <div>
                  <p className="font-bold">{t.champions.procurando}</p>
                  <p className="text-[11px] text-white/45">
                    {fila?.estado === "na_fila"
                      ? `${t.champions.seu_rating} ${fila.perfil.rating} · ${fila.perfil.divisao.nome}`
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
                    ? fila.erro === "sem_conexao" ? t.champions.servidor_fora : `${t.champions.recusado} ${fila.erro}`
                    : t.champions.convite_para_jogar}
                </p>
              </div>
              <Button className="bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[#00d9b0]" onClick={procurar}>
                <Swords className="mr-2 h-4 w-4" /> {t.champions.procurar_partida}
              </Button>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-xl font-black">
              <Trophy className="text-[var(--brand)]" />{t.champions.classificacao_da_semana}
            </h2>
            {semana && (
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-white/55">
                <Clock className="h-3.5 w-3.5 text-[var(--brand)]" />
                {t.champions.zera_em} {faltando(semana.terminaEm, t)}
              </span>
            )}
          </div>

          {!semana || semana.linhas.length === 0 ? (
            <p className="mt-3 text-sm text-white/40">
              {t.champions.tabela_vazia}
            </p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-white/40">
                <tr>
                  <th className="p-2 text-left">#</th>
                  <th className="p-2 text-left">{t.champions.tecnico}</th>
                  <th className="p-2">P</th><th className="p-2">J</th>
                  <th className="p-2">V</th><th className="p-2">E</th><th className="p-2">D</th>
                  <th className="p-2">SG</th>
                </tr>
              </thead>
              <tbody>
                {semana.linhas.map(l => (
                  <tr key={l.posicao} className={cn("border-t border-white/5", l.nome === state.managerName && "bg-[var(--brand)]/10")}>
                    <td className="p-2 text-white/40">{l.posicao}</td>
                    <td className="p-2 font-medium">{l.nome}</td>
                    <td className="p-2 text-center font-black">{l.pontos}</td>
                    <td className="p-2 text-center text-white/60">{l.j}</td>
                    <td className="p-2 text-center text-white/60">{l.v}</td>
                    <td className="p-2 text-center text-white/60">{l.e}</td>
                    <td className="p-2 text-center text-white/60">{l.d}</td>
                    <td className="p-2 text-center text-white/60">{l.saldo > 0 ? `+${l.saldo}` : l.saldo}</td>
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

"use client"

// EVENTOS DA SEMANA — a tela.
//
// Três partidas com a restrição da semana, jogadas com o MESMO motor da partida
// ao vivo (`tickMinute`). Nada de placar sorteado por esta tela: o modo só vale
// alguma coisa se o resultado sair do mesmo lugar de onde sai o da carreira.
//
// ⚠️ QUEM DIZ QUAL É A SEMANA É O SERVIDOR. A tela pede a classificação, e a
// resposta traz a string da semana; a REGRA é derivada dela (regraDaSemana).
// Sem relay no ar a tela cai na semana local, avisa que a tentativa não entra
// em tabela nenhuma e deixa jogar assim mesmo — treino é melhor que porta
// fechada.
//
// ⚠️ E NÃO ENCOSTA NO SAVE — a regra do gate `test-online-nao-toca-no-save`.

import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarRange, Clock, Loader2, Trophy } from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TeamCrest } from "@/components/team-crest"
import { hardNavigate } from "@/lib/hard-navigation"
import { useTelaGamepad } from "@/hooks/use-tela-gamepad"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { allTeams, type Team } from "@/lib/teams-data"
import { useGameState } from "@/lib/save-system"
import { createInitialState, startMatch, tickMinute, type MatchState } from "@/lib/match-engine"
import {
  adversariosDoEvento, clubesElegiveis, pontosDe, regraDaSemana, semanaLocal,
  PARTIDAS_DO_EVENTO,
} from "@/lib/eventos-da-semana"
import {
  classificacaoDoEvento, enviarResultadoDoEvento, type ClassificacaoDoEvento,
} from "@/lib/manager-rivals"

interface PlacarDaRodada { rodada: number; golsPro: number; golsContra: number }

export default function EventosDaSemanaPage() {
  useTelaGamepad({ aoVoltar: () => hardNavigate("/online") })
  const t = useTranslation()
  const { state } = useGameState()

  const [tabela, setTabela] = useState<ClassificacaoDoEvento | null>(null)
  const [clube, setClube] = useState<Team | null>(null)
  const [busca, setBusca] = useState("")
  const [placares, setPlacares] = useState<PlacarDaRodada[]>([])
  const [jogando, setJogando] = useState(false)
  const [envio, setEnvio] = useState<"nao" | "enviando" | "ok" | "falhou">("nao")

  const recarregar = useCallback(() => { void classificacaoDoEvento(30).then(setTabela) }, [])
  useEffect(() => { recarregar() }, [recarregar])

  // A semana do servidor manda; a local só existe para a tela abrir offline.
  const hoje = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const semana = tabela?.semana || semanaLocal(hoje)
  const temServidor = Boolean(tabela?.semana)
  const regra = useMemo(() => regraDaSemana(semana), [semana])

  const elegiveis = useMemo(() => clubesElegiveis(allTeams, regra), [regra])
  const encontrados = useMemo(() => {
    const alvo = busca.trim().toLowerCase()
    const base = alvo ? elegiveis.filter(c => c.nome.toLowerCase().includes(alvo)) : elegiveis
    // Os mais fortes primeiro: numa lista de milhares, sem ordem é ruído.
    return [...base].sort((a, b) => b.prestigio - a.prestigio).slice(0, 24)
  }, [elegiveis, busca])

  const jogos = useMemo(
    () => (clube ? adversariosDoEvento(allTeams, regra, clube, semana) : []),
    [clube, regra, semana],
  )

  const proxima = placares.length + 1
  const terminou = placares.length >= PARTIDAS_DO_EVENTO || (jogos.length > 0 && placares.length >= jogos.length)
  const pontos = placares.reduce((s, p) => s + pontosDe(p.golsPro, p.golsContra), 0)
  const golsPro = placares.reduce((s, p) => s + p.golsPro, 0)
  const saldo = placares.reduce((s, p) => s + p.golsPro - p.golsContra, 0)

  /** Uma partida inteira, do apito inicial ao final, sem tela de acompanhamento. */
  const jogar = () => {
    if (!clube || terminou) return
    const adversario = jogos[placares.length]
    if (!adversario) return
    setJogando(true)

    const forcaMinha = regra.forca(clube)
    const forcaDele = regra.forca(adversario.time)
    // `mandante: false` (semana do visitante) põe o jogador do lado de fora — e
    // o motor cobra por isso, porque a vantagem de casa mora nele.
    const config = {
      homeTeam: regra.mandante ? clube : adversario.time,
      awayTeam: regra.mandante ? adversario.time : clube,
      homeRating: regra.mandante ? forcaMinha : forcaDele,
      awayRating: regra.mandante ? forcaDele : forcaMinha,
      durationMinutes: 90,
    }

    let estado: MatchState = startMatch(createInitialState())
    let voltas = 0
    while (estado.phase !== "fulltime" && voltas++ < 140) {
      if (estado.pendingVar || estado.pendingPenalty) {
        estado = { ...estado, pendingVar: null, pendingPenalty: null }
      }
      estado = tickMinute(estado, config)
    }

    const meus = regra.mandante ? estado.home.goals : estado.away.goals
    const dele = regra.mandante ? estado.away.goals : estado.home.goals
    setPlacares(p => [...p, { rodada: adversario.rodada, golsPro: meus, golsContra: dele }])
    setJogando(false)
  }

  // O envio acontece uma vez, quando a terceira partida fecha.
  useEffect(() => {
    if (!terminou || envio !== "nao" || placares.length === 0) return
    if (!temServidor) { setEnvio("falhou"); return }
    setEnvio("enviando")
    void enviarResultadoDoEvento({
      managerId: state.careerId ?? "convidado",
      managerName: state.managerName || t.eventos.tecnico,
      pontos, saldo, golsPro,
    }).then(r => {
      setEnvio(r.enviado ? "ok" : "falhou")
      if (r.enviado) recarregar()
    })
  }, [terminou, envio, placares.length, temServidor, state.careerId, state.managerName,
    pontos, saldo, golsPro, recarregar, t.eventos.tecnico])

  const recomecar = () => { setPlacares([]); setEnvio("nao") }

  if (!state.multiplayerEnabled) {
    return (
      <main className="h-screen overflow-y-auto bg-[#06090d] text-white">
        <GameHeader />
        <div className="mx-auto max-w-xl px-5 pt-28 text-center">
          <h1 className="text-2xl font-black">{t.eventos.online_desligado}</h1>
          <Button className="mt-5" onClick={() => hardNavigate("/configuracoes")}>
            {t.eventos.abrir_configuracoes}
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="h-screen overflow-y-auto bg-[#06090d] text-white">
      <GameHeader />
      <div className="mx-auto max-w-[1000px] px-5 pb-16 pt-20">
        <header className="mb-6">
          <p className="text-xs font-black uppercase tracking-[.25em] text-[var(--brand)]">{t.eventos.online}</p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-black">
            <CalendarRange className="text-[var(--brand)]" />{t.eventos.titulo}
          </h1>
        </header>

        <section className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--brand)]/25 bg-[var(--brand)]/[.06] p-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wide text-[var(--brand)]">
              {t.eventos.regra_da_semana}
            </p>
            <h2 className="mt-1 text-xl font-black">{regra.nome}</h2>
            <p className="mt-1 max-w-2xl text-sm text-white/55">{regra.resumo}</p>
          </div>
          {tabela && tabela.terminaEm > 0 && (
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-white/55">
              <Clock className="h-3.5 w-3.5 text-[var(--brand)]" />
              {t.eventos.zera_em} {faltando(tabela.terminaEm, t)}
            </span>
          )}
        </section>

        {!clube ? (
          <section className="mb-6 rounded-2xl border border-white/10 bg-white/[.04] p-5">
            <h2 className="text-xl font-black">{t.eventos.escolha_o_clube}</h2>
            <p className="mt-1 text-sm text-white/50">{t.eventos.escolha_explicacao}</p>
            <Input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder={t.eventos.procurar_clube}
              className="mt-4 bg-black/40"
            />
            {elegiveis.length === 0 ? (
              <p className="mt-4 text-sm text-white/40">{t.eventos.sem_clubes_elegiveis}</p>
            ) : encontrados.length === 0 ? (
              <p className="mt-4 text-sm text-white/40">{t.eventos.nenhum_clube}</p>
            ) : (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {encontrados.map(c => (
                  <button
                    key={c.file_key}
                    onClick={() => { setClube(c); recomecar() }}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-3 text-left transition-colors hover:border-[var(--brand)]/50",
                      c.curto === state.selectedTeamShort && "border-[var(--brand)]/40",
                    )}
                  >
                    <TeamCrest fileKey={c.file_key} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{c.nome}</span>
                      <span className="block text-[11px] text-white/40">
                        {regra.forca(c)} {t.eventos.forca_em_campo}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="mb-6 rounded-2xl border border-white/10 bg-white/[.04] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <TeamCrest fileKey={clube.file_key} size="lg" />
                <div>
                  <p className="text-lg font-black">{clube.nome}</p>
                  <p className="text-[11px] text-white/45">{regra.forca(clube)} {t.eventos.forca_em_campo}</p>
                </div>
              </div>
              {placares.length === 0 && (
                <Button variant="outline" onClick={() => setClube(null)}>{t.eventos.trocar_de_clube}</Button>
              )}
            </div>

            <h3 className="mt-5 text-xs font-black uppercase tracking-wide text-white/40">{t.eventos.suas_partidas}</h3>
            <div className="mt-2 space-y-2">
              {jogos.map((j, i) => {
                const placar = placares[i]
                return (
                  <div
                    key={j.time.file_key}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3",
                      placar ? "border-white/10 bg-black/30" : i === placares.length
                        ? "border-[var(--brand)]/40 bg-[var(--brand)]/[.06]" : "border-white/5 bg-black/20 opacity-60",
                    )}
                  >
                    <span className="w-6 text-center font-mono text-white/35">{j.rodada}</span>
                    <TeamCrest fileKey={j.time.file_key} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">{j.time.nome}</span>
                    <span className="text-[11px] text-white/35">
                      {regra.mandante ? t.eventos.em_casa : t.eventos.fora_de_casa}
                    </span>
                    <span className="w-16 text-right font-mono text-lg font-black">
                      {placar ? `${placar.golsPro}–${placar.golsContra}` : "—"}
                    </span>
                  </div>
                )
              })}
            </div>

            {!terminou && (
              <Button
                onClick={jogar}
                disabled={jogando}
                className="mt-5 w-full bg-[var(--brand)] py-6 text-base font-black text-[var(--brand-ink)] hover:bg-[#00d9b0]"
              >
                {jogando
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t.eventos.aguarde}</>
                  : `${t.eventos.jogar_partida} · ${t.eventos.rodada} ${proxima} ${t.eventos.de} ${jogos.length}`}
              </Button>
            )}

            {terminou && (
              <div className="mt-5 rounded-xl border border-white/10 bg-black/35 p-4 text-center">
                <Trophy className="mx-auto h-7 w-7 text-[var(--brand)]" />
                <p className="mt-2 text-2xl font-black">
                  {pontos} {t.eventos.pontos} · {saldo > 0 ? `+${saldo}` : saldo} {t.eventos.saldo}
                </p>
                <p className="mt-1 text-[12px] text-white/45">
                  {envio === "enviando" ? t.eventos.enviando
                    : envio === "ok" ? t.eventos.enviado
                      : envio === "falhou" ? t.eventos.nao_enviado : ""}
                </p>
                <p className="mt-1 text-[11px] text-white/30">{t.eventos.melhor_tentativa}</p>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={recomecar}>{t.eventos.tentar_de_novo}</Button>
                  <Button className="flex-1" onClick={() => hardNavigate("/online")}>{t.eventos.voltar_ao_online}</Button>
                </div>
              </div>
            )}
          </section>
        )}

        <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
          <h2 className="flex items-center gap-2 text-xl font-black">
            <Trophy className="text-[var(--brand)]" />{t.eventos.classificacao}
          </h2>
          {!tabela || tabela.linhas.length === 0 ? (
            <p className="mt-3 text-sm text-white/40">{t.eventos.tabela_vazia}</p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-white/40">
                <tr>
                  <th className="p-2 text-left">#</th>
                  <th className="p-2 text-left">{t.eventos.tecnico}</th>
                  <th className="p-2">{t.eventos.coluna_pontos}</th>
                  <th className="p-2">{t.eventos.coluna_saldo}</th>
                  <th className="p-2">{t.eventos.coluna_gols}</th>
                  <th className="p-2">{t.eventos.coluna_tentativas}</th>
                </tr>
              </thead>
              <tbody>
                {tabela.linhas.map(l => (
                  <tr
                    key={l.id}
                    className={cn("border-t border-white/5", l.id === state.careerId && "bg-[var(--brand)]/10")}
                  >
                    <td className="p-2 text-white/40">{l.posicao}</td>
                    <td className="p-2 font-medium">{l.nome}</td>
                    <td className="p-2 text-center font-black">{l.pontos}</td>
                    <td className="p-2 text-center text-white/60">{l.saldo > 0 ? `+${l.saldo}` : l.saldo}</td>
                    <td className="p-2 text-center text-white/60">{l.gp}</td>
                    <td className="p-2 text-center text-white/40">{l.tentativas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-4 text-center text-[11px] text-white/30">{t.eventos.nao_toca_na_carreira}</p>
        </section>
      </div>
    </main>
  )
}

/** "2 dias e 4 h" — o mesmo formato do Champions. */
function faltando(ate: number, t: ReturnType<typeof useTranslation>): string {
  const ms = ate - Date.now()
  if (ms <= 0) return t.eventos.virando_agora
  const horas = Math.floor(ms / 3600000)
  const dias = Math.floor(horas / 24)
  if (dias >= 1) return `${dias} ${dias > 1 ? t.eventos.dias : t.eventos.dia} · ${horas % 24} h`
  if (horas >= 1) return `${horas} h`
  return `${Math.max(1, Math.floor(ms / 60000))} min`
}

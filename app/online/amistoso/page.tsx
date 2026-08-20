"use client"

// AMISTOSO 1v1 ONLINE — sala com código, dois técnicos, uma partida.
//
// ⚠️ POR QUE ESTA TELA EXISTE (1.0.336). O modo "amistoso" de `MODOS_ONLINE`
// apontava para `/multiplayer-local?online=1`, e essa rota é um STUB de 36
// linhas cujo único trabalho é redirecionar para o Draft do FC Hub. Ou seja: o
// amistoso online não estava "em obras", estava **sem destino** — clicar nele
// levava a outro modo. O estado declarado dizia a verdade sobre a fase, mas o
// `href` mentia sobre existir.
//
// ⚠️ NADA DE ENCANAMENTO NOVO. Sala, entrada por código, prontidão e ações já
// existem inteiras em `lib/online-multiplayer.ts` (e as rotas `/v1/rooms`,
// `/v1/rooms/:code/join` e `/v1/rooms/:code/snapshot` no relay). Escrever um
// segundo cliente de sala aqui seria o erro recorrente deste projeto — dois
// sistemas paralelos para a mesma coisa, discordando na primeira mudança.
//
// ⚠️ O QUE ESTE MODO PROMETE, E SÓ ISSO: "sala com código: você e um amigo, sem
// ranking e sem recompensa". Por isso ele NÃO passa pelo anti-cheat do
// competitivo (`rivals.mjs`): lá o servidor é a verdade porque há Elo e divisão
// em jogo. Aqui não há nada a ganhar trapaceando, e exigir a comparação de
// resultados no servidor só adicionaria um caminho de falha a um amistoso entre
// amigos. Quem quer partida valendo rating usa o Manager Rivals.

import { useCallback, useEffect, useRef, useState } from "react"
import { Users, Copy, Check, LogOut, Swords, Loader2, ArrowLeft } from "lucide-react"
import { useGameState } from "@/lib/save-system"
import { useUserTeam } from "@/lib/time-da-carreira"
import { hardNavigate } from "@/lib/hard-navigation"
import { useTelaGamepad } from "@/hooks/use-tela-gamepad"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import {
  joinOnlineServer,
  leaveOnlineSession,
  refreshOnlineRoom,
  restoreOnlineSession,
  setOnlineReady,
  startOnlineServer,
  stopOnlineServer,
  submitOnlineAction,
  type OnlineSession,
} from "@/lib/online-multiplayer"

/** Um amistoso é 1v1. O número não é configurável de propósito. */
const TECNICOS_NO_AMISTOSO = 2

/** De quanto em quanto tempo a sala é relida enquanto se espera o adversário. */
const INTERVALO_DE_ESPERA_MS = 2000

export default function AmistosoOnlinePage() {
  useTelaGamepad({ aoVoltar: () => hardNavigate("/online") })

  const { state } = useGameState()
  const t = useTranslation()
  const { team: userTeam } = useUserTeam()

  const [sessao, setSessao] = useState<OnlineSession | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [codigoDigitado, setCodigoDigitado] = useState("")
  const [enderecoDigitado, setEnderecoDigitado] = useState("")
  const [copiado, setCopiado] = useState(false)

  const nomeDoTecnico = state.managerName?.trim() || t.amistoso.tecnico
  const meuTime = userTeam?.curto ?? ""

  // Sessão sobrevive à navegação: quem sai para escalar o time e volta continua
  // na mesma sala, em vez de derrubar o amigo do outro lado.
  useEffect(() => { setSessao(restoreOnlineSession()) }, [])

  // ── ESPERA PELO ADVERSÁRIO ────────────────────────────────────────────────
  // Enquanto a sala não está cheia (ou enquanto os dois não confirmam), relemos
  // o estado. O intervalo é limpo no desmonte — sem isso o timer sobrevive à
  // saída da tela e fica batendo no relay para sempre.
  const sessaoRef = useRef<OnlineSession | null>(null)
  sessaoRef.current = sessao
  useEffect(() => {
    if (!sessao) return
    const timer = setInterval(() => {
      const atual = sessaoRef.current
      if (!atual) return
      refreshOnlineRoom(atual).then(setSessao).catch(() => { /* queda de rede não pode derrubar a tela */ })
    }, INTERVALO_DE_ESPERA_MS)
    return () => clearInterval(timer)
  }, [Boolean(sessao)]) // eslint-disable-line react-hooks/exhaustive-deps

  const comErro = useCallback(async (acao: () => Promise<void>) => {
    setOcupado(true); setErro(null)
    try { await acao() } catch (e) { setErro(e instanceof Error ? e.message : t.amistoso.nao_deu_certo) }
    finally { setOcupado(false) }
  }, [t.amistoso.nao_deu_certo])

  const abrirSala = useCallback(() => comErro(async () => {
    setSessao(await startOnlineServer({ managerName: nomeDoTecnico, teamShort: meuTime, maxPlayers: TECNICOS_NO_AMISTOSO }))
  }), [comErro, nomeDoTecnico, meuTime])

  const entrarNaSala = useCallback(() => comErro(async () => {
    setSessao(await joinOnlineServer({
      address: enderecoDigitado.trim(),
      roomCode: codigoDigitado,
      managerName: nomeDoTecnico,
      teamShort: meuTime,
    }))
  }), [comErro, enderecoDigitado, codigoDigitado, nomeDoTecnico, meuTime])

  const sair = useCallback(() => comErro(async () => {
    if (sessao?.isHost) await stopOnlineServer().catch(() => { /* já pode ter caído */ })
    leaveOnlineSession()
    setSessao(null)
  }), [comErro, sessao?.isHost])

  const eu = sessao?.room.participants.find(p => p.id === sessao.participantId)
  const adversario = sessao?.room.participants.find(p => p.id !== sessao.participantId)
  const salaCheia = (sessao?.room.participants.length ?? 0) >= TECNICOS_NO_AMISTOSO
  const ambosProntos = salaCheia && (sessao?.room.participants ?? []).every(p => p.ready)

  const confirmar = useCallback(() => comErro(async () => {
    if (!sessao) return
    setSessao(await setOnlineReady(sessao, !eu?.ready))
  }), [comErro, sessao, eu?.ready])

  // ⚠️ O APITO SÓ SAI COM OS DOIS CONFIRMADOS, e a decisão é anunciada como AÇÃO
  // da sala antes de a partida abrir. Sem isso um lado entraria em campo e o
  // outro continuaria na tela de espera — que é como um amistoso vira dois jogos
  // diferentes contados como um.
  const comecar = useCallback(() => comErro(async () => {
    if (!sessao || !ambosProntos) return
    await submitOnlineAction(sessao, "amistoso:iniciar", {
      mandante: eu?.teamShort ?? "", visitante: adversario?.teamShort ?? "",
    })
    hardNavigate(`/partida/escalacao?amistoso-online=${sessao.room.roomCode}`)
  }), [comErro, sessao, ambosProntos, eu?.teamShort, adversario?.teamShort])

  const copiarCodigo = useCallback(() => {
    if (!sessao) return
    navigator.clipboard?.writeText(sessao.room.roomCode).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1800)
    }).catch(() => { /* área de transferência bloqueada: o código está na tela */ })
  }, [sessao])

  return (
    <main className="min-h-screen bg-[#070b11] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-3xl">
        <button
          onClick={() => hardNavigate("/online")}
          className="mb-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/45 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Modos online
        </button>

        <h1 className="text-3xl font-black">Amistoso online</h1>
        <p className="mt-1 text-sm text-white/50">
          Você e um amigo, uma partida. Sem ranking, sem recompensa e sem efeito na sua carreira —
          para partida valendo rating, o modo é o Manager Rivals.
        </p>

        {erro && (
          <p className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {erro}
          </p>
        )}

        {!sessao ? (
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            {/* ABRIR */}
            <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
              <h2 className="text-lg font-black">Abrir uma sala</h2>
              <p className="mt-1 text-[12px] leading-relaxed text-white/45">
                Você vira o anfitrião e recebe um código de seis caracteres para passar ao seu amigo.
              </p>
              <button
                onClick={abrirSala}
                disabled={ocupado}
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 text-sm font-black uppercase tracking-wide text-[var(--brand-ink)] disabled:opacity-50"
              >
                {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                Abrir sala
              </button>
            </section>

            {/* ENTRAR */}
            <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
              <h2 className="text-lg font-black">Entrar numa sala</h2>
              <label className="mt-3 block text-[11px] text-white/50">
                Endereço do anfitrião
                <input
                  value={enderecoDigitado}
                  onChange={e => setEnderecoDigitado(e.target.value)}
                  placeholder="192.168.0.10:8790"
                  className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-black/50 px-3 text-sm text-white placeholder:text-white/25"
                />
              </label>
              <label className="mt-3 block text-[11px] text-white/50">
                Código da sala
                <input
                  value={codigoDigitado}
                  onChange={e => setCodigoDigitado(e.target.value.toUpperCase())}
                  placeholder={t.amistoso.exemplo_codigo}
                  maxLength={12}
                  className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-black/50 px-3 font-mono text-sm tracking-[.3em] text-white placeholder:tracking-normal placeholder:text-white/25"
                />
              </label>
              <button
                onClick={entrarNaSala}
                disabled={ocupado || codigoDigitado.trim().length < 6 || !enderecoDigitado.trim()}
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-black/50 px-4 text-sm font-black uppercase tracking-wide text-white/85 disabled:opacity-40"
              >
                {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
                Entrar
              </button>
            </section>
          </div>
        ) : (
          <section className="mt-7 rounded-2xl border border-white/10 bg-white/[.03] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">Código da sala</p>
                <p className="font-mono text-3xl font-black tracking-[.35em] text-[var(--brand)]">{sessao.room.roomCode}</p>
              </div>
              <button
                onClick={copiarCodigo}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 px-3 text-xs font-bold uppercase text-white/70 hover:bg-white/10"
              >
                {copiado ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                {copiado ? t.amistoso.copiado : t.amistoso.copiar}
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[eu, adversario].map((p, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-xl border p-4",
                    p?.ready ? "border-emerald-400/40 bg-emerald-400/[.07]" : "border-white/10 bg-black/25",
                  )}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">
                    {i === 0 ? t.amistoso.voce : t.amistoso.adversario}
                  </p>
                  {p ? (
                    <>
                      <p className="mt-1 truncate text-lg font-black">{p.managerName}</p>
                      <p className="text-xs text-white/45">{p.teamShort || "sem clube"}</p>
                      <p className={cn("mt-2 text-[11px] font-bold uppercase", p.ready ? "text-emerald-300" : "text-white/40")}>
                        {p.ready ? "confirmado" : "escolhendo"}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-white/35">Esperando alguém entrar com o código…</p>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={confirmar}
                disabled={ocupado || !salaCheia}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-black/50 px-4 text-sm font-black uppercase tracking-wide text-white/85 disabled:opacity-40"
              >
                {eu?.ready ? t.amistoso.desfazer_confirmacao : t.amistoso.estou_pronto}
              </button>
              <button
                onClick={comecar}
                disabled={ocupado || !ambosProntos}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 text-sm font-black uppercase tracking-wide text-[var(--brand-ink)] disabled:opacity-40"
                title={ambosProntos ? "" : t.amistoso.os_dois_confirmam}
              >
                <Swords className="h-4 w-4" /> Começar a partida
              </button>
              <button
                onClick={sair}
                disabled={ocupado}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-500/25 px-4 text-xs font-bold uppercase text-red-200/80 hover:bg-red-500/10 disabled:opacity-40"
              >
                <LogOut className="h-4 w-4" /> Sair
              </button>
            </div>

            {!salaCheia && (
              <p className="mt-4 text-center text-[11px] text-white/35">
                Passe o código ao seu amigo. A sala se atualiza sozinha quando ele entrar.
              </p>
            )}
          </section>
        )}
      </div>
    </main>
  )
}

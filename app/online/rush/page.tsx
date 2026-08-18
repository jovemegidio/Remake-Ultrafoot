"use client"

// MANAGER RUSH — a tela.
//
// ⚠️ ELE JOGA A PARTIDA DE VERDADE. Do minuto 60 ao apito, com o mesmo
// `tickMinute` da partida ao vivo do técnico: os gols saem do motor calibrado,
// não de um sorteio próprio desta tela. Um modo que inventasse o próprio placar
// seria uma animação com botão, e o jogador percebe isso na terceira partida.
//
// ⚠️ E NÃO ENCOSTA NO SAVE. Nenhum `setState` de carreira aqui — é a regra que o
// gate `test-online-nao-toca-no-save` cobra, e o motivo é simples: o save é o
// único dado do jogador que não tem backup do lado dele.

import { useMemo, useState } from "react"
import { Timer, Trophy, Zap } from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { Button } from "@/components/ui/button"
import { TeamCrest } from "@/components/team-crest"
import { hardNavigate } from "@/lib/hard-navigation"
import { useTelaGamepad } from "@/hooks/use-tela-gamepad"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { allTeams } from "@/lib/teams-data"
import { createInitialState, startMatch, tickMinute, type MatchState } from "@/lib/match-engine"
import { desafioDoDia, avaliarRush, forcasDoRush, MINUTO_INICIAL, type PosturaRush } from "@/lib/manager-rush"

export default function ManagerRushPage() {
  useTelaGamepad({ aoVoltar: () => hardNavigate("/online") })
  const t = useTranslation()

  // A data entra como string para o desafio ser o mesmo o dia inteiro.
  const hoje = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const desafio = useMemo(() => desafioDoDia(allTeams, hoje), [hoje])

  const [postura, setPostura] = useState<PosturaRush>("equilibrado")
  const [resultado, setResultado] = useState<{
    golsPro: number; golsContra: number; venceu: boolean
    lances: { minuto: number; texto: string; pro: boolean }[]
  } | null>(null)

  if (!desafio) {
    return (
      <main className="h-dvh overflow-y-auto bg-[#06090d] text-white">
        <GameHeader />
        <div className="p-10 text-center text-white/60">{t.rush.sem_desafio}</div>
      </main>
    )
  }

  const jogar = () => {
    // ⚠️ A PARTIDA COMEÇA AOS 60 COM O PLACAR JÁ FEITO. O motor não tem uma
    // entrada "comece daqui", então o estado é montado: fase de segundo tempo,
    // relógio em 60 e o placar do desafio. Daí em diante é `tickMinute` puro.
    let estado: MatchState = startMatch(createInitialState())
    estado = {
      ...estado,
      phase: "second",
      minute: MINUTO_INICIAL,
      home: { ...estado.home, goals: desafio.golsPro },
      away: { ...estado.away, goals: desafio.golsContra },
    }

    // ⚠️ AS FORÇAS VÊM DO MÓDULO, e não desta tela. A primeira versão tinha os
    // números aqui e o gate media OUTROS: ele aprovava 4% de sucesso enquanto o
    // jogador jogava um modo diferente. Número de balanceamento em dois lugares
    // é número que diverge — e ninguém percebe até o modo ficar injogável.
    const forcas = forcasDoRush(desafio, postura)
    const config = {
      homeTeam: desafio.clube,
      awayTeam: desafio.adversario,
      homeRating: forcas.homeRating,
      awayRating: forcas.awayRating,
      durationMinutes: 90,
    }

    const lances: { minuto: number; texto: string; pro: boolean }[] = []
    let anteriorPro = desafio.golsPro
    let anteriorContra = desafio.golsContra
    let voltas = 0
    while (estado.phase !== "fulltime" && voltas++ < 120) {
      if (estado.pendingVar || estado.pendingPenalty) {
        // O Rush não abre decisão de VAR nem cobrança escolhida: a partida corre.
        estado = { ...estado, pendingVar: null, pendingPenalty: null }
      }
      estado = tickMinute(estado, config)
      if (estado.home.goals !== anteriorPro) {
        lances.push({ minuto: estado.minute, texto: `GOL do ${desafio.clube.nome}!`, pro: true })
        anteriorPro = estado.home.goals
      }
      if (estado.away.goals !== anteriorContra) {
        lances.push({ minuto: estado.minute, texto: `Gol do ${desafio.adversario.nome}.`, pro: false })
        anteriorContra = estado.away.goals
      }
    }

    setResultado({
      golsPro: estado.home.goals,
      golsContra: estado.away.goals,
      venceu: avaliarRush(desafio, estado.home.goals, estado.away.goals),
      lances,
    })
  }

  return (
    <main className="h-dvh overflow-y-auto bg-[#06090d] text-white">
      <GameHeader />
      <div className="mx-auto max-w-2xl px-5 pb-36 pt-20">
        <header className="mb-6">
          <p className="text-xs font-black uppercase tracking-[.25em] text-[var(--brand)]">
            Ultrafoot online · desafio de {hoje.split("-").reverse().join("/")}
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-black">
            <Zap className="text-[var(--brand)]" />Manager Rush
          </h1>
          <p className="mt-1 text-sm text-white/50">
            A bola volta a rolar aos {MINUTO_INICIAL}′ e você está atrás no placar.
            {desafio.objetivo === "virar" ? " Só a vitória conta." : " Empatar já salva."}
          </p>
        </header>

        <section className="mb-5 rounded-2xl border border-white/10 bg-white/[.04] p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <TeamCrest fileKey={desafio.clube.file_key} size="lg" />
              <span className="truncate font-black">{desafio.clube.nome}</span>
            </div>
            <span className="shrink-0 font-mono text-3xl font-black">
              {resultado ? resultado.golsPro : desafio.golsPro}
              <span className="mx-2 text-white/30">–</span>
              {resultado ? resultado.golsContra : desafio.golsContra}
            </span>
            <div className="flex min-w-0 items-center justify-end gap-3">
              <span className="truncate font-black">{desafio.adversario.nome}</span>
              <TeamCrest fileKey={desafio.adversario.file_key} size="lg" />
            </div>
          </div>
          <p className="mt-3 flex items-center justify-center gap-2 text-xs text-white/40">
            <Timer className="h-3.5 w-3.5" />
            {resultado ? t.rush.apito_final : `${90 - MINUTO_INICIAL} minutos para resolver.`}
          </p>
        </section>

        {!resultado ? (
          <>
            <section className="mb-5 rounded-2xl border border-white/10 bg-black/25 p-5">
              <h2 className="mb-3 text-xs font-black uppercase tracking-wide text-white/40">
                {t.rush.como_vai_para_cima}
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {([
                  ["equilibrado", t.rush.equilibrado, t.rush.equilibrado_texto],
                  ["tudo-ou-nada", t.rush.tudo_ou_nada, t.rush.tudo_ou_nada_texto],
                ] as const).map(([id, titulo, texto]) => (
                  <button
                    key={id}
                    onClick={() => setPostura(id)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-colors",
                      postura === id
                        ? "border-[var(--brand)]/50 bg-[var(--brand)]/[.08]"
                        : "border-white/10 bg-black/30 hover:border-white/25",
                    )}
                  >
                    <p className="font-black">{titulo}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-white/55">{texto}</p>
                  </button>
                ))}
              </div>
            </section>
            <Button
              onClick={jogar}
              className="w-full bg-[var(--brand)] py-6 text-base font-black text-[var(--brand-ink)] hover:bg-[#00d9b0]"
            >
              Entrar em campo aos {MINUTO_INICIAL}′
            </Button>
          </>
        ) : (
          <section className={cn(
            "rounded-2xl border p-5",
            resultado.venceu ? "border-emerald-400/40 bg-emerald-400/[.08]" : "border-white/10 bg-black/30",
          )}>
            <div className="text-center">
              <Trophy className={cn("mx-auto h-8 w-8", resultado.venceu ? "text-emerald-400" : "text-white/25")} />
              <h2 className="mt-2 text-2xl font-black">
                {resultado.venceu ? t.rush.voce_resolveu : t.rush.nao_deu}
              </h2>
              <p className="mt-1 text-sm text-white/55">
                {desafio.objetivo === "virar" ? t.rush.pedia_virada : t.rush.pedia_empate}
              </p>
            </div>

            {resultado.lances.length > 0 && (
              <div className="mt-5 space-y-1.5">
                {resultado.lances.map((l, i) => (
                  <div key={i} className="flex items-baseline gap-3 text-[13px]">
                    <span className="w-9 shrink-0 text-right font-mono text-white/35">{l.minuto}&apos;</span>
                    <span className={l.pro ? "font-bold text-emerald-400" : "text-red-400"}>{l.texto}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setResultado(null)}>
                {t.rush.tentar_de_novo}
              </Button>
              <Button className="flex-1" onClick={() => hardNavigate("/online")}>
                {t.rush.voltar_ao_online}
              </Button>
            </div>
            <p className="mt-3 text-center text-[11px] text-white/30">
              {t.rush.nao_toca_na_carreira}
            </p>
          </section>
        )}
      </div>
    </main>
  )
}

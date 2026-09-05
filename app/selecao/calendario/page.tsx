"use client"

// CALENDÁRIO DA SELEÇÃO.
//
// Por que faltava e por que dói
// ─────────────────────────────
// Dirigindo um clube, o técnico tem `/calendario`: vê a temporada inteira, sabe
// quando joga e contra quem. Dirigindo uma seleção ele tinha convocação,
// amistosos e competições — e nenhuma resposta para "quando é o meu próximo
// jogo?". Era a diferença mais dura entre o modo seleção e o FM26, e não por
// falta de dado: os jogos JÁ existem em
// `save.nationalCareer.currentCompetition.fixtures`.
//
// Esta tela é VISÃO, não sistema novo. Ela não gera confronto, não simula, não
// grava nada — lê o que a competição já tem e o organiza por fase. Criar um
// segundo calendário paralelo seria repetir o erro que hoje custou a remoção do
// `promotion-relegation`: duas fontes para a mesma verdade, e a errada parecendo
// certa.
//
// ⚠️ AS DATAS FIFA SÃO O EIXO. Seleção não joga toda semana: joga em janelas.
// `fifaDates` (no motor) diz quais semanas são janela, e é isso que transforma
// uma lista de confrontos em calendário — sem elas, "próximo jogo" não tem
// quando.

import { useMemo } from "react"
import { CalendarDays, Trophy, ChevronLeft, Flag, Check, Clock } from "lucide-react"
import { LinkLeve as Link } from "@/components/link-leve"
import { GameHeader } from "@/components/game-header"
import { useGameState } from "@/lib/save-system"
import { useGameEngine } from "@/lib/game-engine"
import { useManagingNational } from "@/lib/time-da-carreira"
import { getNationalCrestUrl } from "@/lib/national-assets"
import { getGameDate } from "@/lib/game-date"
import { cn } from "@/lib/utils"
import type { NationalFixture } from "@/lib/national-competitions"

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]

/** Um bloco de jogos da mesma fase — é assim que competição de seleção se lê. */
interface FaseDoCalendario {
  nome: string
  rodada: number
  jogos: NationalFixture[]
}

export default function CalendarioDaSelecaoPage() {
  const { state } = useGameState()
  const { isNational, nationalTeam } = useManagingNational()
  const semanaAtual = useGameEngine(s => s.currentWeek)
  const temporada = useGameEngine(s => s.currentSeason)
  const datasFifa = useGameEngine(s => s.fifaDates)

  const competicao = state.nationalCareer?.currentCompetition ?? null

  /**
   * Os jogos agrupados por fase, na ordem em que acontecem.
   *
   * Agrupa por `round` e não por `stage`: a fase é o RÓTULO (“Fase de grupos”),
   * a rodada é a ordem. Duas rodadas da mesma fase precisam aparecer separadas,
   * senão a Copa vira uma lista de doze jogos sem começo nem fim.
   */
  const fases = useMemo<FaseDoCalendario[]>(() => {
    if (!competicao) return []
    const porRodada = new Map<number, FaseDoCalendario>()
    for (const jogo of competicao.fixtures) {
      const atual = porRodada.get(jogo.round)
      if (atual) atual.jogos.push(jogo)
      else porRodada.set(jogo.round, { nome: jogo.stage, rodada: jogo.round, jogos: [jogo] })
    }
    return [...porRodada.values()].sort((a, b) => a.rodada - b.rodada)
  }, [competicao])

  /** O próximo jogo DO USUÁRIO — a pergunta que a tela existe para responder. */
  const proximoJogo = useMemo(
    () => competicao?.fixtures.find((f: NationalFixture) => f.isUserMatch && !f.played) ?? null,
    [competicao],
  )

  /**
   * A próxima janela FIFA a partir de agora.
   *
   * ⚠️ `fifaDates` guarda SEMANAS, não datas. Converter pela `getGameDate` é o
   * que dá ao técnico uma resposta em linguagem de calendário ("outubro") em vez
   * de "semana 41", que não significa nada para quem joga.
   */
  const proximaJanela = useMemo(() => {
    const futuras = (datasFifa ?? []).filter(s => s >= semanaAtual).sort((a, b) => a - b)
    if (futuras.length === 0) return null
    const data = getGameDate(temporada, futuras[0])
    return { semana: futuras[0], mes: MESES[data.getMonth()], daquiA: futuras[0] - semanaAtual }
  }, [datasFifa, semanaAtual, temporada])

  if (!isNational || !nationalTeam) {
    return (
      <div className="min-h-screen bg-[#08080c]">
        <GameHeader />
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <Flag className="mx-auto h-10 w-10 text-white/20" />
          <h1 className="uf-heading mt-4 text-xl font-bold text-white">Você não dirige uma seleção</h1>
          <p className="mt-2 text-sm text-white/50">
            Este calendário é o das datas FIFA e da competição da sua seleção. O calendário do
            clube continua em <Link href="/calendario" className="text-[var(--brand)]">Calendário</Link>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#08080c]">
      <GameHeader />

      <div className="mx-auto max-w-5xl px-6 py-6">
        <div className="mb-5 flex items-center gap-3">
          <Link href="/selecao" className="rounded-lg border border-white/10 p-2 text-white/50 hover:text-white">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          {/* O escudo da seleção sai de um caminho resolvido em tempo de
              execução (`game-asset://` no app instalado), que o <Image> do Next
              não sabe otimizar — por isso a tag simples, como nas outras telas. */}
          <img src={getNationalCrestUrl(nationalTeam.id)} alt="" className="h-9 w-9 object-contain" />
          <div>
            <h1 className="text-lg font-bold text-white">Calendário da seleção</h1>
            <p className="text-xs text-white/40">{nationalTeam.name} · temporada {temporada}</p>
          </div>
        </div>

        {/* O QUE O TÉCNICO VEIO SABER, no topo e sem rolagem. */}
        <div className="mb-6 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-[var(--brand)]/25 bg-[var(--brand)]/[0.06] p-4">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[var(--brand)]">
              <Trophy className="h-3.5 w-3.5" /> Próximo jogo
            </div>
            {proximoJogo ? (
              <>
                <p className="mt-2 text-base font-bold text-white">
                  {proximoJogo.homeName} <span className="text-white/35">x</span> {proximoJogo.awayName}
                </p>
                <p className="mt-0.5 text-xs text-white/45">{proximoJogo.stage}</p>
              </>
            ) : (
              <p className="mt-2 text-sm text-white/45">
                Nenhum jogo marcado. A próxima competição abre na convocação.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white/40">
              <CalendarDays className="h-3.5 w-3.5" /> Próxima data FIFA
            </div>
            {proximaJanela ? (
              <>
                <p className="mt-2 text-base font-bold text-white">
                  {proximaJanela.daquiA === 0 ? "É esta semana" : `Em ${proximaJanela.daquiA} semana${proximaJanela.daquiA > 1 ? "s" : ""}`}
                </p>
                <p className="mt-0.5 text-xs text-white/45">
                  {proximaJanela.mes} · semana {proximaJanela.semana}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-white/45">Sem datas FIFA restantes nesta temporada.</p>
            )}
          </div>
        </div>

        {/* A COMPETIÇÃO, fase a fase. */}
        {fases.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
            <Flag className="mx-auto h-8 w-8 text-white/15" />
            <p className="mt-3 text-sm text-white/50">
              Nenhuma competição em andamento. Quando a sua seleção entrar num torneio, os jogos
              aparecem aqui divididos por fase.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {fases.map(fase => (
              <section key={fase.rodada}>
                <div className="mb-2 flex items-center gap-2">
                  <h2 className="text-sm font-bold text-white">{fase.nome}</h2>
                  <span className="text-[11px] text-white/30">rodada {fase.rodada}</span>
                </div>
                <div className="space-y-1.5">
                  {fase.jogos.map(jogo => (
                    <div
                      key={jogo.id}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border px-4 py-2.5",
                        // O jogo do técnico tem de saltar da lista: numa fase de
                        // grupos com seis confrontos, o dele é o único que ele
                        // vai jogar.
                        jogo.isUserMatch
                          ? "border-[var(--brand)]/30 bg-[var(--brand)]/[0.07]"
                          : "border-white/5 bg-black/25",
                      )}
                    >
                      <span className={cn("flex-1 truncate text-sm", jogo.isUserMatch ? "text-white" : "text-white/60")}>
                        {jogo.homeName}
                      </span>

                      {jogo.played ? (
                        <span className="shrink-0 rounded-md bg-black/40 px-2.5 py-1 font-mono text-sm font-bold tabular-nums text-white">
                          {jogo.homeScore} - {jogo.awayScore}
                          {jogo.decidedOnPens && <span className="ml-1 text-[10px] text-white/40">pên</span>}
                        </span>
                      ) : (
                        <span className="shrink-0 text-xs text-white/25">x</span>
                      )}

                      <span className={cn("flex-1 truncate text-right text-sm", jogo.isUserMatch ? "text-white" : "text-white/60")}>
                        {jogo.awayName}
                      </span>

                      <span className="w-5 shrink-0 text-right">
                        {jogo.played
                          ? <Check className="ml-auto h-3.5 w-3.5 text-white/25" />
                          : jogo.isUserMatch
                            ? <Clock className="ml-auto h-3.5 w-3.5 text-[var(--brand)]" />
                            : null}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

"use client"

// TRAJETÓRIA — a quarta tela do modo.
//
// Era a aba "Trajetória" do escritório. Aqui ela ganha o que faltava para ser
// uma tela: ao lado da tabela ano a ano, o RESUMO da carreira inteira e a
// estante de títulos e prêmios — que existiam no estado (`resumoDaCarreira`) e
// só apareciam quando o atleta se aposentava.

import { Award, Medal, Trophy } from "lucide-react"

import { AtletaShell, PainelDoAtleta } from "@/components/carreira-jogador/atleta-shell"
import { GameHeader } from "@/components/game-header"
import { Button } from "@/components/ui/button"
import { useGameState } from "@/lib/save-system"
import { useTranslation } from "@/lib/i18n"
import { hardNavigate } from "@/lib/hard-navigation"
import { useControleDoAtleta } from "@/hooks/use-controle-do-atleta"
import { cn } from "@/lib/utils"
import { mediaDaTemporada, resumoDaCarreira } from "@/lib/carreira-de-jogador"

function corDaNota(nota: number): string {
  return nota >= 8 ? "text-emerald-400" : nota >= 7 ? "text-[var(--brand)]" : nota >= 6 ? "text-amber-300" : "text-red-400"
}

export default function TrajetoriaDoAtletaPage() {
  useControleDoAtleta({ rota: "/carreira/jogador/trajetoria" })
  const { state } = useGameState()
  const tr = useTranslation()
  const carreira = state.carreiraDeJogador

  if (!carreira) {
    return (
      <main className="h-screen overflow-y-auto bg-[#06090d] text-white">
        <GameHeader />
        <div className="p-10 text-center">
          <p className="text-white/70">{tr.carreiraDeJogador.nenhuma_carreira_de_jogador_ativa_neste}</p>
          <Button className="mt-4" onClick={() => hardNavigate("/novo-jogo")}>{tr.carreiraDeJogador.criar_carreira}</Button>
        </div>
      </main>
    )
  }

  const resumo = resumoDaCarreira(carreira)
  const t = carreira.temporadaAtual
  // A temporada EM CURSO entra no resumo como linha viva: sem ela a trajetória
  // só existia depois de encerrar o ano, e o modo é partida a partida.
  const jogos = resumo.jogos + t.jogos
  const gols = resumo.gols + t.gols
  const assistencias = resumo.assistencias + t.assistencias

  return (
    <AtletaShell carreira={carreira} ativa="trajetoria">
      <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[1fr_22rem]">

        <PainelDoAtleta titulo={tr.carreiraDeJogador.temporada_a_temporada} icone={<Award className="h-5 w-5 text-[var(--brand)]" />}>
          {carreira.historico.length === 0 ? (
            <p className="py-10 text-center text-white/35">
              Encerre a primeira temporada para começar a escrever sua história.
            </p>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-white/40">
                <tr>
                  <th className="p-2 text-left">{tr.carreiraDeJogador.coluna_temporada}</th>
                  <th className="p-2 text-left">{tr.carreiraDeJogador.coluna_clube}</th>
                  <th className="p-2">J</th><th className="p-2">G</th><th className="p-2">A</th>
                  <th className="p-2">{tr.carreiraDeJogador.coluna_media}</th><th className="p-2">{tr.carreiraDeJogador.coluna_posicao}</th>
                  <th className="p-2 text-left">{tr.carreiraDeJogador.coluna_conquistas}</th>
                </tr>
              </thead>
              <tbody>
                {carreira.historico.map(h => (
                  <tr key={`${h.temporada}-${h.clubeNome}`} className="border-t border-white/5">
                    <td className="p-2">{h.temporada}</td>
                    <td className="p-2">{h.clubeNome}</td>
                    <td className="p-2 text-center">{h.jogos}</td>
                    <td className="p-2 text-center">{h.gols}</td>
                    <td className="p-2 text-center">{h.assistencias}</td>
                    <td className={cn("p-2 text-center font-bold", corDaNota(h.notaMedia))}>{h.notaMedia.toFixed(2)}</td>
                    <td className="p-2 text-center">{h.posicaoNaLiga}º</td>
                    <td className="p-2 text-white/60">{[...h.titulos, ...h.premios].join(" · ") || "—"}</td>
                  </tr>
                ))}
                {/* A linha da temporada em curso, marcada como tal. */}
                <tr className="border-t border-[var(--brand)]/30 bg-[var(--brand)]/[.06]">
                  <td className="p-2 font-bold">{carreira.temporada}</td>
                  <td className="p-2">{carreira.semClube ? tr.carreiraDeJogador.sem_clube : carreira.clubeNome}</td>
                  <td className="p-2 text-center">{t.jogos}</td>
                  <td className="p-2 text-center">{t.gols}</td>
                  <td className="p-2 text-center">{t.assistencias}</td>
                  <td className={cn("p-2 text-center font-bold", corDaNota(mediaDaTemporada(carreira)))}>
                    {mediaDaTemporada(carreira) > 0 ? mediaDaTemporada(carreira).toFixed(2) : "—"}
                  </td>
                  <td className="p-2 text-center text-white/40">—</td>
                  <td className="p-2 text-[11px] uppercase tracking-wide text-[var(--brand)]">{tr.carreiraDeJogador.em_curso}</td>
                </tr>
              </tbody>
            </table>
          )}
        </PainelDoAtleta>

        <div className="flex min-h-0 flex-col gap-3">
          <PainelDoAtleta titulo={tr.carreiraDeJogador.carreira_em_numeros} className="shrink-0">
            <div className="grid grid-cols-2 gap-2.5">
              {[
                [tr.carreiraDeJogador.jogos, jogos],
                [tr.carreiraDeJogador.gols, gols],
                [tr.carreiraDeJogador.assistencias, assistencias],
                [tr.carreiraDeJogador.temporadas, carreira.historico.length + 1],
                [tr.carreiraDeJogador.auge_de_overall, resumo.overallMaximo],
                [tr.carreiraDeJogador.jogos_pela_selecao, resumo.selecao.jogos],
              ].map(([rotulo, valor]) => (
                <div key={String(rotulo)} className="rounded-xl border border-white/10 bg-white/[.04] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-white/45">{rotulo}</p>
                  <p className="text-lg font-black">{valor}</p>
                </div>
              ))}
            </div>
            {(carreira.rodadasPerdidasPorLesao ?? 0) + (carreira.rodadasPerdidasPorSuspensao ?? 0) > 0 && (
              <p className="mt-3 text-[11px] text-white/40">
                Fora de campo: {carreira.rodadasPerdidasPorLesao ?? 0} rodada(s) por lesão ·{" "}
                {carreira.rodadasPerdidasPorSuspensao ?? 0} por suspensão.
              </p>
            )}
            {carreira.capitao && (
              <p className="mt-2 text-[11px] text-[var(--brand)]">
                Capitão desde {carreira.temporadaEmQueVirouCapitao}.
              </p>
            )}
          </PainelDoAtleta>

          <PainelDoAtleta titulo={tr.carreiraDeJogador.estante} icone={<Trophy className="h-5 w-5 text-amber-300" />} className="min-h-0 flex-1">
            {resumo.titulos.length === 0 && resumo.premios.length === 0 ? (
              <p className="py-8 text-center text-sm leading-relaxed text-white/40">
                A estante está vazia. Títulos do clube e prêmios individuais entram aqui na virada da temporada.
              </p>
            ) : (
              <>
                {resumo.titulos.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">{tr.carreiraDeJogador.titulos}</p>
                    <div className="mt-2 space-y-1.5">
                      {resumo.titulos.map((titulo, i) => (
                        <p key={`${titulo}-${i}`} className="flex items-center gap-2 text-[13px] text-white/75">
                          <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-300" />{titulo}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                {resumo.premios.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">{tr.carreiraDeJogador.premios_individuais}</p>
                    <div className="mt-2 space-y-1.5">
                      {resumo.premios.map((premio, i) => (
                        <p key={`${premio}-${i}`} className="flex items-center gap-2 text-[13px] text-white/75">
                          <Medal className="h-3.5 w-3.5 shrink-0 text-[var(--brand)]" />{premio}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </PainelDoAtleta>
        </div>
      </div>
    </AtletaShell>
  )
}

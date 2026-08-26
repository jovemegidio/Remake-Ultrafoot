"use client"

// CAMPEONATO ONLINE DO FC HUB — o painel da competição.
//
// O que existia: uma linha mostrando os confrontos da rodada e o status de cada
// um. Nada mais. E faltava justamente o que faz um campeonato ANDAR:
//
//   • ENVIAR RESULTADO. O relay sempre soube tratar `submit_result` (com dupla
//     confirmação e marcação de divergência), mas NENHUM cliente mandava a
//     mensagem. Na prática o campeonato travava na rodada 1 em "AO VIVO" para
//     sempre — dava para criar a liga e nunca terminá-la.
//   • CLASSIFICAÇÃO. O relay calculava a tabela a cada mensagem e a mandava no
//     snapshot; a tela simplesmente não a exibia.
//   • PRAZO DA RODADA. A sala escolhia 24/48/72h e o número não aparecia em
//     lugar nenhum nem tinha efeito.
//   • DIVERGÊNCIA. Dois placares diferentes marcavam a partida como "disputed"
//     e ninguém tinha como resolver.
//
// Regra de confiança: o placar é confirmado pelos DOIS lados. Iguais, vale;
// diferentes, vira divergência e só o organizador arbitra. É o mesmo desenho de
// qualquer liga online séria, e evita que um lado sozinho decrete o resultado.

import { useEffect, useState } from "react"
import { AlertTriangle, Check, Crown, Gavel, Play, Send, Timer, Trophy } from "lucide-react"
import type { InternetFixture, InternetRoom, InternetRoomSocket } from "@/lib/internet-multiplayer"

function contagem(ateQuando: number, agora: number): string {
  const ms = ateQuando - agora
  if (ms <= 0) return "prazo vencido"
  const horas = Math.floor(ms / 3_600_000)
  const minutos = Math.floor((ms % 3_600_000) / 60_000)
  if (horas >= 24) return `${Math.floor(horas / 24)}d ${horas % 24}h restantes`
  if (horas > 0) return `${horas}h ${String(minutos).padStart(2, "0")}min restantes`
  return `${minutos}min restantes`
}

export function HubCampeonato({
  room,
  participantId,
  socket,
}: {
  room: InternetRoom
  participantId: string
  socket: InternetRoomSocket | null
}) {
  const competicao = room.competition
  // O relógio da tela precisa andar sozinho — o prazo é tempo real, não um
  // número estático que só muda quando o relay manda snapshot.
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), 30_000)
    return () => window.clearInterval(t)
  }, [])

  const [golsCasa, setGolsCasa] = useState(0)
  const [golsFora, setGolsFora] = useState(0)
  const [enviado, setEnviado] = useState<string | null>(null)

  if (!competicao) return null

  const souHost = room.hostId === participantId
  const eu = room.participants.find(p => p.id === participantId)
  const souEspectador = Boolean(eu?.spectator)
  const nome = (id: string) => room.participants.find(p => p.id === id)?.teamShort || "?"
  const tecnico = (id: string) => room.participants.find(p => p.id === id)?.managerName || "Técnico"

  const daRodada = competicao.fixtures.filter(f => f.round === competicao.currentRound)
  const minhaPartida = daRodada.find(f => f.homeId === participantId || f.awayId === participantId)
  const jaEnviei = minhaPartida?.submissions?.some(s => s.participantId === participantId) ?? false
  const prazoVencido = competicao.roundDeadlineAt != null && agora >= competicao.roundDeadlineAt
  const divergentes = daRodada.filter(f => f.status === "disputed")

  const enviarResultado = (fixture: InternetFixture) => {
    if (!socket) return
    socket.send("submit_result", {
      fixtureId: fixture.id,
      homeGoals: Math.max(0, Math.min(99, golsCasa)),
      awayGoals: Math.max(0, Math.min(99, golsFora)),
    })
    setEnviado(fixture.id)
  }

  const arbitrar = (fixture: InternetFixture, casa: number, fora: number) => {
    if (!socket) return
    socket.send("resolve_result", { fixtureId: fixture.id, homeGoals: casa, awayGoals: fora })
  }

  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b className="text-xs text-white">{competicao.name}</b>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-violet-200">
            Rodada {competicao.currentRound}/{competicao.totalRounds}
          </span>
          {competicao.roundDeadlineAt != null && !competicao.finished && (
            <span className={`flex items-center gap-1 font-bold ${prazoVencido ? "text-red-300" : "text-white/45"}`}>
              <Timer className="h-3 w-3" />
              {contagem(competicao.roundDeadlineAt, agora)}
            </span>
          )}
        </div>
      </div>
      <p className="text-[9px] text-emerald-300">
        REGULAMENTO OFICIAL BLOQUEADO · prazo {competicao.roundDeadlineHours}h por rodada ·
        placar confirmado pelos dois técnicos
      </p>
      {/* ESCOPO DECLARADO. A auditoria da 3.0 pediu que o online fosse
          "funcional e confiável, OU explicitamente beta" — e ele é o segundo.

          ⚠️ O TEXTO ESTAVA DESATUALIZADO (corrigido na 1.0.377), e desatualizado
          PARA MENOS: ele dizia que "carreira online completa (mercado, elenco e
          temporada compartilhados)" não existia. Existe desde a 1.0.358, é
          outro modo (`/online/carreira`, rotas `/v1/carreira/*` do relay), e o
          mercado dela é conferido no servidor — caixa, teto e exclusividade do
          anúncio. Um aviso que subestima o próprio jogo custa tanto quanto um
          que o superestima: os dois mandam o jogador para o lugar errado.

          O que continua verdade AQUI, nesta Liga: o servidor não arbitra a
          partida. Ele guarda a tabela e exige que os dois técnicos confirmem o
          mesmo placar — dois jogadores combinados ainda conseguem inventar um
          resultado. Dizer isso na tela é mais barato do que descobrir jogando. */}
      <p className="rounded-lg border border-amber-300/25 bg-amber-300/[0.06] px-2.5 py-2 text-[9px] leading-relaxed text-amber-100/70">
        <b className="text-amber-200">LIGA ONLINE — BETA.</b> O que está pronto: liga de
        pontos corridos, tabela, prazo por rodada e confirmação de placar pelos dois técnicos.
        O que ainda NÃO existe aqui: arbitragem da partida pelo servidor — o placar vale
        porque os dois confirmaram, não porque o jogo foi simulado no servidor, então dois
        jogadores combinados conseguem inventar um resultado. Para mundo compartilhado de
        verdade (mercado, vagas e tabela no servidor), use a <b className="text-amber-200">Carreira
        Online</b>: lá a compra sai da lista de todo mundo no mesmo instante e o placar só
        conta depois dos dois lados baterem.
      </p>

      {/* CAMPEÃO — o fim do campeonato tinha de significar alguma coisa. */}
      {competicao.finished && (
        <div className="flex items-center gap-2 rounded-lg border border-[#ffd700]/35 bg-[#ffd700]/10 p-3">
          <Crown className="h-5 w-5 shrink-0 text-[#ffd700]" />
          <div className="min-w-0">
            <p className="text-xs font-black text-[#ffd700]">
              {competicao.championId
                ? `${nome(competicao.championId)} é campeão`
                : "Campeonato encerrado"}
            </p>
            {competicao.championId && (
              <p className="text-[10px] text-white/50">Técnico {tecnico(competicao.championId)}</p>
            )}
          </div>
        </div>
      )}

      {/* MINHA PARTIDA — o coração do painel. Sem isto o campeonato não anda. */}
      {!souEspectador && minhaPartida && !competicao.finished && minhaPartida.status !== "played" && (
        <div className="rounded-lg border border-violet-400/30 bg-violet-400/[.07] p-3">
          <p className="text-[9px] font-black uppercase tracking-wider text-violet-200">Sua partida da rodada</p>
          <div className="mt-2 flex items-center justify-center gap-3">
            <span className="w-16 truncate text-right text-xs font-bold text-white">{nome(minhaPartida.homeId)}</span>
            <input
              type="number" min={0} max={99} value={golsCasa}
              onChange={e => setGolsCasa(Number(e.target.value))}
              disabled={jaEnviei}
              aria-label={`Gols de ${nome(minhaPartida.homeId)}`}
              className="w-12 rounded border border-white/15 bg-black/40 py-1.5 text-center text-sm font-black text-white outline-none focus:border-violet-300/60 disabled:opacity-40"
            />
            <span className="text-white/30">×</span>
            <input
              type="number" min={0} max={99} value={golsFora}
              onChange={e => setGolsFora(Number(e.target.value))}
              disabled={jaEnviei}
              aria-label={`Gols de ${nome(minhaPartida.awayId)}`}
              className="w-12 rounded border border-white/15 bg-black/40 py-1.5 text-center text-sm font-black text-white outline-none focus:border-violet-300/60 disabled:opacity-40"
            />
            <span className="w-16 truncate text-xs font-bold text-white">{nome(minhaPartida.awayId)}</span>
          </div>

          {minhaPartida.status === "disputed" ? (
            <p className="mt-2 flex items-center gap-1.5 text-[10px] text-red-300">
              <AlertTriangle className="h-3 w-3" />
              Os dois placares não bateram. O organizador precisa arbitrar.
            </p>
          ) : jaEnviei ? (
            <p className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-300">
              <Check className="h-3 w-3" />
              Placar enviado. Aguardando a confirmação do adversário.
            </p>
          ) : (
            <button
              onClick={() => enviarResultado(minhaPartida)}
              disabled={!socket || enviado === minhaPartida.id}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-violet-300 py-2 text-xs font-black text-black disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
              Enviar placar
            </button>
          )}
        </div>
      )}

      {/* Confrontos da rodada */}
      <div className="grid gap-1 sm:grid-cols-2">
        {daRodada.map(fixture => (
          <div key={fixture.id} className="flex items-center justify-between rounded bg-white/[.03] px-2 py-1.5 text-[10px] text-white/60">
            <span className="truncate">{nome(fixture.homeId)} × {nome(fixture.awayId)}</span>
            <span className={`ml-2 font-bold ${fixture.status === "disputed" ? "text-red-300" : "text-white/35"}`}>
              {fixture.status === "played"
                ? `${fixture.homeGoals}–${fixture.awayGoals}${fixture.walkover ? " (W.O.)" : ""}`
                : fixture.status === "live" ? "AO VIVO"
                : fixture.status === "awaiting_confirmation" ? "AGUARDANDO"
                : fixture.status === "disputed" ? "DIVERGENTE"
                : "AGENDADA"}
            </span>
          </div>
        ))}
      </div>

      {/* ARBITRAGEM — só o organizador, e só no que divergiu. */}
      {souHost && divergentes.length > 0 && (
        <div className="space-y-2 rounded-lg border border-red-400/30 bg-red-400/[.06] p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-red-300">
            <Gavel className="h-3 w-3" /> Arbitrar divergências
          </p>
          {divergentes.map(fixture => (
            <div key={fixture.id} className="rounded bg-black/25 p-2">
              <p className="text-[10px] font-bold text-white">{nome(fixture.homeId)} × {nome(fixture.awayId)}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {(fixture.submissions ?? []).map(s => (
                  <button
                    key={s.participantId}
                    onClick={() => arbitrar(fixture, s.homeGoals, s.awayGoals)}
                    className="rounded border border-white/15 px-2 py-1 text-[10px] text-white/75 hover:bg-white/10"
                  >
                    Valer {s.homeGoals}–{s.awayGoals} ({tecnico(s.participantId)})
                  </button>
                ))}
                <button
                  onClick={() => arbitrar(fixture, 0, 0)}
                  className="rounded border border-white/15 px-2 py-1 text-[10px] text-white/50 hover:bg-white/10"
                >
                  Anular (0–0)
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PRAZO VENCIDO — quem sumiu perde por W.O. e o campeonato segue. */}
      {souHost && prazoVencido && !competicao.finished && daRodada.some(f => f.status !== "played") && (
        <button
          onClick={() => socket?.send("expire_round")}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300/35 bg-amber-300/10 py-2 text-xs font-bold text-amber-200"
        >
          <Play className="h-3.5 w-3.5" />
          Encerrar rodada por prazo (W.O. para quem não jogou)
        </button>
      )}

      {/* CLASSIFICAÇÃO — o relay já mandava, a tela nunca mostrou. */}
      {competicao.standings.length > 0 && (
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-white/35">
            <Trophy className="h-3 w-3" /> Classificação
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-[10px]">
              <thead>
                <tr className="text-white/30">
                  <th className="py-1 text-left font-bold">#</th>
                  <th className="py-1 text-left font-bold">Técnico</th>
                  <th className="py-1 text-center font-bold">J</th>
                  <th className="py-1 text-center font-bold">V</th>
                  <th className="py-1 text-center font-bold">E</th>
                  <th className="py-1 text-center font-bold">D</th>
                  <th className="py-1 text-center font-bold">SG</th>
                  <th className="py-1 text-center font-bold">P</th>
                </tr>
              </thead>
              <tbody>
                {competicao.standings.map((linha, indice) => (
                  <tr
                    key={linha.participantId}
                    className={linha.participantId === participantId ? "text-violet-200" : "text-white/60"}
                  >
                    <td className="py-1 font-bold">{indice + 1}</td>
                    <td className="truncate py-1">
                      {nome(linha.participantId)} <span className="text-white/25">· {tecnico(linha.participantId)}</span>
                    </td>
                    <td className="py-1 text-center">{linha.played}</td>
                    <td className="py-1 text-center">{linha.won}</td>
                    <td className="py-1 text-center">{linha.drawn}</td>
                    <td className="py-1 text-center">{linha.lost}</td>
                    <td className="py-1 text-center">{linha.gf - linha.ga}</td>
                    <td className="py-1 text-center font-black text-white">{linha.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

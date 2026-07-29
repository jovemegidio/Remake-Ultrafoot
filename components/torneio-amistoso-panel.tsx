"use client"

// TORNEIO AMISTOSO — o técnico monta a própria competição.
//
// O jogo tinha amistoso avulso (um jogo, um adversário) e competições fixas do
// calendário. Faltava o meio: convidar 4, 6, 8 clubes e disputar um torneio de
// verdade, com tabela ou chave, na pré-temporada.
//
// Os JOGOS DO USUÁRIO são disputados na tela de partida ao vivo — o resultado
// volta pelo contexto (`torneio`). Os jogos entre clubes da IA são resolvidos
// por `simulateFullMatch`, o MESMO motor da partida real: um torneio decidido por
// cara-ou-coroa não valeria o esforço de montá-lo.

import { useMemo, useState } from "react"
import { Trophy, Plus, Trash2, Play, FastForward, Check } from "lucide-react"
import { TeamCrest } from "@/components/team-crest"
import { allTeams, type Team } from "@/lib/teams-data"
import { simulateFullMatch } from "@/lib/match-engine"
import { cn } from "@/lib/utils"
import {
  participantesValidos, validarTorneio, gerarPontosCorridos, gerarMataMata,
  classificacao, avancarMataMata, campeaoMataMata, rotuloFase,
  type FormatoTorneio, type JogoTorneio,
} from "@/lib/torneio-amistoso"

export interface TorneioSalvo {
  nome: string
  formato: FormatoTorneio
  participantes: string[]
  idaEVolta: boolean
  jogos: JogoTorneio[]
  campeao?: string | null
}

interface Props {
  torneio: TorneioSalvo | null | undefined
  clubeDoUsuario: string
  onSalvar: (t: TorneioSalvo | null) => void
  /** Abre a partida ao vivo para um jogo do usuário. */
  onJogar: (jogo: JogoTorneio, nomeDoTorneio: string, rotulo: string) => void
}

function nomeDe(curto: string): string {
  return allTeams.find(t => t.curto === curto)?.nome ?? curto
}

/** Resolve um jogo entre dois clubes da IA com o motor de partida real. */
function simular(mandante: Team, visitante: Team): { gm: number; gv: number } {
  // Mesma chamada que lib/cup-engine.resolveTieByCurto usa — nao inventar uma
  // configuracao paralela do motor.
  const estado = simulateFullMatch({
    homeTeam: mandante, awayTeam: visitante,
    homeRating: mandante.prestigio, awayRating: visitante.prestigio,
    durationMinutes: 90,
  })
  return { gm: estado.home.goals, gv: estado.away.goals }
}

export function TorneioAmistosoPanel({ torneio, clubeDoUsuario, onSalvar, onJogar }: Props) {
  const [nome, setNome] = useState("Torneio de Verão")
  const [formato, setFormato] = useState<FormatoTorneio>("pontos_corridos")
  const [idaEVolta, setIdaEVolta] = useState(false)
  const [convidados, setConvidados] = useState<string[]>([])
  const [busca, setBusca] = useState("")
  const [erro, setErro] = useState<string | null>(null)

  const disponiveis = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return allTeams
      .filter(t => t.curto !== clubeDoUsuario && !/ II$/.test(t.nome))
      .filter(t => !convidados.includes(t.curto))
      .filter(t => !q || t.nome.toLowerCase().includes(q) || t.curto.toLowerCase().includes(q))
      .sort((a, b) => b.prestigio - a.prestigio)
      .slice(0, 30)
  }, [busca, convidados, clubeDoUsuario])

  // O clube do usuário SEMPRE entra: um torneio que ele monta e não disputa não
  // faz sentido, e deixar isso opcional só criaria um estado inválido a mais.
  const listaFinal = useMemo(() => [clubeDoUsuario, ...convidados], [clubeDoUsuario, convidados])

  function criar() {
    const cfg = { nome, formato, participantes: listaFinal, idaEVolta }
    const problema = validarTorneio(cfg)
    if (problema) { setErro(problema); return }
    const times = listaFinal
      .map(c => allTeams.find(t => t.curto === c))
      .filter((t): t is Team => Boolean(t))
    if (times.length !== listaFinal.length) {
      setErro("Um dos clubes escolhidos não foi encontrado no banco.")
      return
    }
    const jogos = formato === "mata_mata"
      ? gerarMataMata(times)
      : gerarPontosCorridos(listaFinal, idaEVolta)
    setErro(null)
    onSalvar({ ...cfg, jogos, campeao: null })
  }

  // ─── TORNEIO EM ANDAMENTO ───────────────────────────────────────────────────
  if (torneio) {
    const rodadaAtual = Math.min(
      ...torneio.jogos.filter(j => !j.jogado).map(j => j.rodada),
      Number.POSITIVE_INFINITY,
    )
    const jogosDaRodada = torneio.jogos.filter(j => j.rodada === rodadaAtual)
    const tabela = torneio.formato === "pontos_corridos"
      ? classificacao(torneio.jogos, torneio.participantes)
      : []
    const campeao = torneio.campeao
      ?? (torneio.formato === "mata_mata" ? campeaoMataMata(torneio.jogos) : null)

    /** Resolve todos os jogos da rodada que NÃO são do usuário. */
    function simularOutros() {
      const atualizados = torneio!.jogos.map(j => {
        if (j.jogado || j.rodada !== rodadaAtual) return j
        if (j.mandanteCurto === clubeDoUsuario || j.visitanteCurto === clubeDoUsuario) return j
        const m = allTeams.find(t => t.curto === j.mandanteCurto)
        const v = allTeams.find(t => t.curto === j.visitanteCurto)
        if (!m || !v) return j
        const { gm, gv } = simular(m, v)
        return { ...j, golsMandante: gm, golsVisitante: gv, jogado: true }
      })
      concluir(atualizados)
    }

    /** Salva, abrindo a próxima fase do mata-mata quando a atual fecha. */
    function concluir(jogos: JogoTorneio[]) {
      let todos = jogos
      if (torneio!.formato === "mata_mata") {
        const proxima = avancarMataMata(todos)
        if (proxima.length > 0) todos = [...todos, ...proxima]
      }
      onSalvar({
        ...torneio!,
        jogos: todos,
        campeao: torneio!.formato === "mata_mata" ? campeaoMataMata(todos) : null,
      })
    }

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-3">
            <Trophy className="h-5 w-5 text-[var(--brand)]" />
            <div>
              <p className="font-semibold text-white">{torneio.nome}</p>
              <p className="text-xs text-white/45">
                {torneio.formato === "mata_mata" ? "Mata-mata" : `Pontos corridos${torneio.idaEVolta ? " (ida e volta)" : ""}`}
                {" · "}{torneio.participantes.length} clubes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSalvar(null)}
            className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-white/60 hover:border-red-500/40 hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" /> Encerrar torneio
          </button>
        </div>

        {campeao && (
          <div className="flex items-center gap-3 rounded-xl border border-[var(--brand)]/30 bg-[var(--brand)]/10 p-4">
            <Trophy className="h-6 w-6 text-[var(--brand)]" />
            <div>
              <p className="font-semibold text-[var(--brand)]">Campeão: {nomeDe(campeao)}</p>
              <p className="text-xs text-white/50">{torneio.nome} encerrado.</p>
            </div>
          </div>
        )}

        {/* Jogos da rodada corrente */}
        {Number.isFinite(rodadaAtual) && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-white/50">
                {torneio.formato === "mata_mata"
                  ? rotuloFase(jogosDaRodada.length)
                  : `Rodada ${rodadaAtual}`}
              </h3>
              {jogosDaRodada.some(j => j.mandanteCurto !== clubeDoUsuario && j.visitanteCurto !== clubeDoUsuario) && (
                <button
                  type="button"
                  onClick={simularOutros}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:border-[var(--brand)]/40 hover:text-white"
                >
                  <FastForward className="h-3.5 w-3.5" /> Simular os outros jogos
                </button>
              )}
            </div>
            <div className="space-y-2">
              {jogosDaRodada.map((j, i) => {
                const meu = j.mandanteCurto === clubeDoUsuario || j.visitanteCurto === clubeDoUsuario
                return (
                  <div
                    key={`${j.rodada}-${j.mandanteCurto}-${j.visitanteCurto}-${i}`}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-lg border p-3",
                      meu ? "border-[var(--brand)]/30 bg-[var(--brand)]/[0.07]" : "border-white/[0.08] bg-white/[0.02]",
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <TeamCrest teamShort={j.mandanteCurto} size="sm" />
                      <span className="truncate text-sm text-white/80">{nomeDe(j.mandanteCurto)}</span>
                    </div>
                    <span className="shrink-0 text-xs text-white/30">x</span>
                    <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                      <span className="truncate text-right text-sm text-white/80">{nomeDe(j.visitanteCurto)}</span>
                      <TeamCrest teamShort={j.visitanteCurto} size="sm" />
                    </div>
                    {meu && (
                      <button
                        type="button"
                        onClick={() => onJogar(
                          j,
                          torneio.nome,
                          torneio.formato === "mata_mata" ? rotuloFase(jogosDaRodada.length) : `Rodada ${j.rodada}`,
                        )}
                        className="ml-2 flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-black hover:brightness-110"
                      >
                        <Play className="h-3.5 w-3.5" /> Jogar
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Tabela (pontos corridos) */}
        {tabela.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/50">Classificação</h3>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-white/[0.03] text-xs uppercase text-white/40">
                  <tr>
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">Clube</th>
                    <th className="p-2 text-center">P</th>
                    <th className="p-2 text-center">J</th>
                    <th className="p-2 text-center">V</th>
                    <th className="p-2 text-center">E</th>
                    <th className="p-2 text-center">D</th>
                    <th className="p-2 text-center">SG</th>
                  </tr>
                </thead>
                <tbody>
                  {tabela.map((l, i) => (
                    <tr
                      key={l.curto}
                      className={cn("border-t border-white/[0.06]", l.curto === clubeDoUsuario && "bg-[var(--brand)]/[0.07]")}
                    >
                      <td className="p-2 text-white/40">{i + 1}</td>
                      <td className="p-2">
                        <span className="flex items-center gap-2">
                          <TeamCrest teamShort={l.curto} size="xs" />
                          <span className="text-white/85">{nomeDe(l.curto)}</span>
                        </span>
                      </td>
                      <td className="p-2 text-center font-semibold text-white">{l.pontos}</td>
                      <td className="p-2 text-center text-white/60">{l.jogos}</td>
                      <td className="p-2 text-center text-white/60">{l.vitorias}</td>
                      <td className="p-2 text-center text-white/60">{l.empates}</td>
                      <td className="p-2 text-center text-white/60">{l.derrotas}</td>
                      <td className="p-2 text-center text-white/60">{l.saldo > 0 ? `+${l.saldo}` : l.saldo}</td>
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

  // ─── CRIAÇÃO ────────────────────────────────────────────────────────────────
  const aceitos = participantesValidos(formato)
  return (
    <div className="space-y-5">
      {erro && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">{erro}</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/40">Nome do torneio</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[var(--brand)]/50"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/40">Formato</span>
          <div className="flex gap-2">
            {(["pontos_corridos", "mata_mata"] as FormatoTorneio[]).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => { setFormato(f); setErro(null) }}
                className={cn("flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-all",
                  formato === f ? "border-[var(--brand)] bg-[var(--brand)]/15 text-[var(--brand)]" : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.06]")}
              >
                {f === "pontos_corridos" ? "Pontos corridos" : "Mata-mata"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {formato === "pontos_corridos" && (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-white/70">
          <input type="checkbox" checked={idaEVolta} onChange={(e) => setIdaEVolta(e.target.checked)} className="accent-[var(--brand)]" />
          Ida e volta (dobra o número de jogos)
        </label>
      )}

      <p className="text-sm text-white/45">
        Este formato aceita <span className="text-white/75">{aceitos.join(", ")}</span> clubes.
        Você já tem <span className={cn("font-semibold", aceitos.includes(listaFinal.length) ? "text-[var(--brand)]" : "text-white")}>{listaFinal.length}</span> (contando o {clubeDoUsuario}).
      </p>

      {/* Convidados */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">Convidados</h3>
        <div className="flex flex-wrap gap-2">
          <span className="flex items-center gap-1.5 rounded-lg border border-[var(--brand)]/40 bg-[var(--brand)]/10 px-2.5 py-1.5 text-sm text-[var(--brand)]">
            <Check className="h-3.5 w-3.5" /> {nomeDe(clubeDoUsuario)} (você)
          </span>
          {convidados.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setConvidados(v => v.filter(x => x !== c))}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm text-white/75 hover:border-red-500/40 hover:text-red-300"
            >
              {nomeDe(c)} <Trash2 className="h-3.5 w-3.5" />
            </button>
          ))}
          {convidados.length === 0 && <span className="py-1.5 text-sm text-white/35">Escolha os adversários abaixo.</span>}
        </div>
      </div>

      {/* Escolha */}
      <div>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar clube para convidar..."
          className="mb-3 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[var(--brand)]/50"
        />
        <div className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
          {disponiveis.map(t => (
            <button
              key={t.curto + t.file_key}
              type="button"
              onClick={() => { setConvidados(v => [...v, t.curto]); setErro(null) }}
              className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] p-2.5 text-left hover:border-[var(--brand)]/40 hover:bg-white/[0.06]"
            >
              <TeamCrest team={t} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm text-white/80">{t.nome}</span>
              <Plus className="h-4 w-4 shrink-0 text-white/25" />
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={criar}
        className="flex items-center gap-2 rounded-lg bg-[var(--brand)] px-5 py-2.5 font-semibold text-black hover:brightness-110"
      >
        <Trophy className="h-4 w-4" /> Criar torneio
      </button>
    </div>
  )
}

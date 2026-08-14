"use client"

import { useMemo, useState } from "react"
import { LinkLeve as Link } from "@/components/link-leve"
import {
  Flag,
  Trophy,
  Check,
  X,
  Crown,
  Globe,
  Swords,
  ChevronRight,
  Lock,
  Award,
  Users,
} from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { useGameState } from "@/lib/save-system"
import { useUserTeam, useManagingNational } from "@/lib/time-da-carreira"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useNationalTeam, salarioDeMercadoDaSelecao, tetoSalarialDaSelecao } from "@/lib/use-national-team"
import { assumirSelecao, voltarAoClube } from "@/lib/career-moves"
import { NationalCrest, NationalKit, strengthTone } from "@/components/national/national-crest"
import {
  NationalCompetitionPanel,
  NationalCompetitionList,
} from "@/components/national/national-competition-panel"
import {
  getNationalSquad,
  getNationalStrength,
  getNationalTeamById,
  CONFEDERATION_LABEL,
  type NationalTeam,
} from "@/lib/national-teams"
import { getCompetitionsForConfederation } from "@/lib/national-competitions"
import type { NationalOffer } from "@/lib/save-system"
import { useTelaGamepad } from "@/hooks/use-tela-gamepad"
import { hardNavigate } from "@/lib/hard-navigation"

// ---------------------------------------------------------
// PROPOSTAS
// ---------------------------------------------------------
function OfferCard({
  offer,
  onAccept,
  onDecline,
  onCounter,
}: {
  offer: NationalOffer
  onAccept: () => void
  onDecline: () => void
  onCounter: (salary: number, months: number) => boolean
}) {
  const nt = getNationalTeamById(offer.nationalTeamId)
  const comps = nt ? getCompetitionsForConfederation(nt.confederation) : []
  // Formula unica, do mesmo dono que julga a contraproposta. Antes a tela
  // repetia a conta na mao, e teto e oferta podiam divergir em silencio.
  const baseSalary = offer.monthlySalary ?? salarioDeMercadoDaSelecao(offer.strength)
  const tetoSalarial = tetoSalarialDaSelecao(offer.strength)
  const baseMonths = offer.contractMonths ?? 18
  const objectives = offer.objectives ?? ["Cumprir a meta da principal competição"]
  const obligations = offer.obligations ?? ["Participar das janelas internacionais", "Convocar atletas por mérito"]
  const [negotiating, setNegotiating] = useState(false)
  const [salary, setSalary] = useState(baseSalary)
  const [months, setMonths] = useState(baseMonths)
  const [feedback, setFeedback] = useState("")
  return (
    <div className="rounded-xl bg-[#0c0c10] border border-white/[0.06] p-5 flex flex-col gap-4">
      <div className="flex items-center gap-4">
        {nt && <NationalCrest team={nt} size={56} />}
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-white truncate">{offer.nationalTeamName}</h3>
          <p className="text-xs text-white/50">{CONFEDERATION_LABEL[offer.confederation as NationalTeam["confederation"]] ?? offer.confederation}</p>
        </div>
        <div className="ml-auto text-right">
          <p className={cn("text-2xl font-bold tabular-nums", strengthTone(offer.strength))}>{offer.strength}</p>
          <p className="text-[10px] uppercase tracking-wide text-white/40">Forca</p>
        </div>
      </div>

      <div>
        <p className="text-xs text-white/40 mb-2">Competicoes que voce disputaria:</p>
        <div className="flex flex-wrap gap-1.5">
          {comps.map(c => (
            <span key={c.id} className="text-[11px] px-2 py-1 rounded-md bg-white/[0.04] text-white/70 border border-white/[0.04]">
              {c.shortName}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-white/[0.03] p-3">
          <p className="text-white/40">Salário mensal</p>
          <p className="mt-1 font-semibold text-white">R$ {baseSalary.toLocaleString("pt-BR")}</p>
        </div>
        <div className="rounded-lg bg-white/[0.03] p-3">
          <p className="text-white/40">Duração</p>
          <p className="mt-1 font-semibold text-white">{baseMonths} meses</p>
        </div>
      </div>
      <div className="text-xs space-y-2">
        <div><p className="text-white/40 mb-1">Metas</p>{objectives.map(item => <p key={item} className="text-white/70">• {item}</p>)}</div>
        <div><p className="text-white/40 mb-1">Deveres e obrigações</p>{obligations.map(item => <p key={item} className="text-white/70">• {item}</p>)}</div>
      </div>

      {negotiating && (
        <div className="rounded-lg border border-[var(--brand)]/20 bg-[var(--brand)]/[0.03] p-3 space-y-3">
          <label className="block text-xs text-white/60">Salário pretendido
            {/* O `max` e a metade visivel da trava; a federacao recusa acima do
                teto de qualquer jeito (ver counterOffer em use-national-team),
                mas sem ele o campo aceitava valor absurdo e ate NaN. */}
            <input
              type="number"
              step={5000}
              min={baseSalary}
              max={tetoSalarial}
              value={salary}
              onChange={e => {
                const v = Number(e.target.value)
                setSalary(Number.isFinite(v) ? Math.min(Math.max(0, v), tetoSalarial) : baseSalary)
              }}
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white"
            />
            <span className="mt-1 block text-[11px] text-white/35">
              A federação não passa de R$ {tetoSalarial.toLocaleString("pt-BR")} por mês.
            </span>
          </label>
          <label className="block text-xs text-white/60">Contrato (meses)
            <select value={months} onChange={e => setMonths(Number(e.target.value))} className="mt-1 w-full rounded-md border border-white/10 bg-[#101015] px-3 py-2 text-white">
              {[12, 18, 24, 36, 48].map(value => <option key={value} value={value}>{value} meses</option>)}
            </select>
          </label>
          {feedback && <p className="text-xs text-yellow-300">{feedback}</p>}
          <button onClick={() => { const ok = onCounter(salary, months); setFeedback(ok ? "Contraproposta aceita. O novo contrato está pronto para assinatura." : "A federação fez uma oferta intermediária.") }} className="w-full rounded-md bg-white/10 py-2 text-xs font-semibold text-white hover:bg-white/15">Enviar contraproposta</button>
        </div>
      )}

      <div className="flex gap-2 mt-1">
        <button
          onClick={onAccept}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[var(--brand)] text-[#050508] font-semibold text-sm py-2.5 hover:bg-[var(--brand)]/90 transition-colors"
        >
          <Check className="h-4 w-4" /> Aceitar
        </button>
        <button onClick={() => setNegotiating(value => !value)} className="rounded-lg bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/[0.08]">Contrapropor</button>
        <button
          onClick={onDecline}
          className="flex items-center justify-center gap-2 rounded-lg bg-white/[0.04] text-white/70 font-medium text-sm py-2.5 px-4 hover:bg-white/[0.08] transition-colors"
        >
          <X className="h-4 w-4" /> Recusar
        </button>
      </div>
    </div>
  )
}

export default function SelecaoPage() {
  // Controle: convencao unica (B volta). Ver hooks/use-tela-gamepad.ts.
  useTelaGamepad({ aoVoltar: () => hardNavigate("/") })

  const { team: userTeam, hydrated: teamHydrated } = useUserTeam()
  const { state, setState } = useGameState()
  const t = useTranslation()
  const {
    hydrated,
    eligible,
    coachScore,
    minScoreForOffers,
    offers,
    hasNationalTeam,
    nationalTeam,
    career,
    availableCompetitions,
    currentCompetition,
    acceptOffer,
    counterOffer,
    declineOffer,
    declineAll,
    leaveNationalTeam,
    startCompetition,
    nationalFriendlies,
  } = useNationalTeam()

  const [confirmLeave, setConfirmLeave] = useState(false)

  // MODO SELEÇÃO (Task 2). Aceitar uma proposta passa a funcionar como assumir um
  // clube: além de firmar o contrato (acceptOffer), a seleção vira o "time atual"
  // e o técnico cai no OFFICE dela. `entrarNoModo`/`voltar` alternam depois.
  const { isNational } = useManagingNational()
  const patch = (p: Record<string, unknown>) => setState(p as Parameters<typeof setState>[0])
  const aceitarEComandar = (offer: NationalOffer) => {
    acceptOffer(offer)
    assumirSelecao(offer.nationalTeamId, { setSaveState: patch, navigate: hardNavigate })
  }
  const entrarNoModoSelecao = () => {
    if (nationalTeam) assumirSelecao(nationalTeam.id, { setSaveState: patch, navigate: hardNavigate })
  }

  // Convocacao: a gestao completa (cortes, chamadas, criterios) fica na tela
  // dedicada /selecao/convocacao. Aqui o hub so mostra o resumo do que esta
  // salvo, para o tecnico saber se mexeu na lista sem precisar abrir.
  const cuts = state.nationalCuts ?? []
  const calls = state.nationalCalls ?? []

  const squad = useMemo(
    () => (nationalTeam ? getNationalSquad(nationalTeam, { cuts, calls }) : []),
    [nationalTeam, cuts, calls],
  )
  const strength = useMemo(() => (nationalTeam ? getNationalStrength(nationalTeam) : 0), [nationalTeam])

  if (!hydrated || !teamHydrated) {
    return (
      <div className="h-screen bg-[#050508] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-[var(--brand)] border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-screen md:pl-0 pl-0 pb-20 md:pb-0 bg-[#050508] flex flex-col overflow-hidden">
      <GameHeader team={userTeam} />

      <main className="flex-1 p-4 overflow-y-auto scrollbar-premium space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-[var(--brand)]/10 flex items-center justify-center">
            <Flag className="h-5 w-5 text-[var(--brand)]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Selecao Nacional</h1>
            <p className="text-sm text-white/50">
              {hasNationalTeam
                ? `Voce comanda ${career.nationalTeamName} e segue no comando do ${userTeam.nome}.`
                : "Construa sua reputacao para receber convites de selecoes."}
            </p>
          </div>
        </div>

        {/* SEM SELECAO */}
        {!hasNationalTeam && (
          <>
            {offers.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Award className="h-5 w-5 text-[var(--brand)]" /> Propostas recebidas
                  </h2>
                  <button
                    onClick={declineAll}
                    className="text-xs text-white/50 hover:text-white/80 transition-colors"
                  >
                    Recusar todas
                  </button>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {offers.map(offer => (
                    <OfferCard
                      key={offer.nationalTeamId}
                      offer={offer}
                      onAccept={() => aceitarEComandar(offer)}
                      onDecline={() => declineOffer(offer.nationalTeamId)}
                      onCounter={(salary, months) => counterOffer(offer, salary, months)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-[#0c0c10] border border-white/[0.06] p-8 text-center space-y-4">
                <div className="mx-auto h-14 w-14 rounded-full bg-white/[0.04] flex items-center justify-center">
                  {eligible ? <Globe className="h-7 w-7 text-white/40" /> : <Lock className="h-7 w-7 text-white/40" />}
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-white">
                    {eligible ? "Nenhuma proposta no momento" : "Ganhe reputacao primeiro"}
                  </h2>
                  <p className="text-sm text-white/50 max-w-md mx-auto text-pretty">
                    {eligible
                      ? "As federacoes estao de olho no seu trabalho. Continue vencendo e novas propostas chegarao nas proximas temporadas."
                      : "Conquiste titulos com seu clube e aumente sua reputacao como treinador. Quando seu prestigio crescer, selecoes nacionais virao te procurar."}
                  </p>
                </div>
                <div className="max-w-xs mx-auto">
                  <div className="flex items-center justify-between text-xs text-white/40 mb-1">
                    <span>Reputacao</span>
                    <span>{coachScore} / {minScoreForOffers}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full bg-[var(--brand)] transition-all"
                      style={{ width: `${Math.min(100, (coachScore / minScoreForOffers) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* COM SELECAO */}
        {hasNationalTeam && nationalTeam && (
          <div className="space-y-4">
            {/* Seletor de modo: comandar a seleção como time pleno (office próprio)
                ou voltar ao clube. Espelha o seletor do office da seleção. */}
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--brand)]/25 bg-[var(--brand)]/[0.05] p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">
                  {isNational ? "Você está no comando da seleção" : "Assuma a seleção como seu time"}
                </p>
                <p className="truncate text-xs text-white/55">
                  {isNational
                    ? "O escritório, o calendário e o elenco já são os da seleção."
                    : "Entre no modo seleção para ter office próprio, como um clube."}
                </p>
              </div>
              {isNational ? (
                <button
                  onClick={() => voltarAoClube({ setSaveState: patch, navigate: hardNavigate })}
                  className="flex shrink-0 items-center gap-2 rounded-lg bg-white/[0.06] px-4 py-2 text-xs font-semibold text-white/80 transition-colors hover:bg-white/[0.12]"
                >
                  Voltar ao clube
                </button>
              ) : (
                <button
                  onClick={entrarNoModoSelecao}
                  className="flex shrink-0 items-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2 text-xs font-black text-[var(--brand-ink)] transition hover:brightness-110"
                >
                  Entrar no modo seleção
                </button>
              )}
            </div>

            {/* Cabecalho da selecao */}
            <div className="rounded-xl bg-[#0c0c10] border border-white/[0.06] p-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <NationalCrest team={nationalTeam} size={64} />
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-semibold text-white">{nationalTeam.name}</h2>
                  <p className="text-xs text-white/50">{CONFEDERATION_LABEL[nationalTeam.confederation]}</p>
                </div>
                {/* Uniforme (UEFA/CONCACAF tem; as demais some sem quebrar). */}
                <NationalKit id={nationalTeam.id} size={56} />
                <div className="grid grid-cols-4 gap-4 sm:gap-6">
                  <div className="text-center">
                    <p className={cn("text-xl font-bold tabular-nums", strengthTone(strength))}>{strength}</p>
                    <p className="text-[10px] uppercase tracking-wide text-white/40">Forca</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-white tabular-nums">{career.titles.length}</p>
                    <p className="text-[10px] uppercase tracking-wide text-white/40">Titulos</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-white tabular-nums">{career.matchesPlayed}</p>
                    <p className="text-[10px] uppercase tracking-wide text-white/40">Jogos</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-white tabular-nums">{career.wins}-{career.draws}-{career.losses}</p>
                    <p className="text-[10px] uppercase tracking-wide text-white/40">V-E-D</p>
                  </div>
                </div>
              </div>

              {/* AMISTOSOS: marcar o jogo e o historico completo ficam na tela
                  dedicada (/selecao/amistosos). Aqui so o retrospecto recente. */}
              <div className="mt-4 border-t border-white/[0.06] pt-4">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Amistosos de preparação</p>
                  <Link
                    href="/selecao/amistosos"
                    className="ml-auto flex items-center gap-1 rounded-lg bg-[var(--brand)]/10 px-3 py-1 text-[11px] font-semibold text-[var(--brand)] transition-colors hover:bg-[var(--brand)]/20"
                  >
                    <Swords className="h-3 w-3" /> Marcar amistoso
                  </Link>
                </div>
                {nationalFriendlies.length > 0 ? (
                  <div className="mt-3 space-y-1.5">
                    {nationalFriendlies.slice(0, 3).map((f, i) => {
                      const r = f.userScore > f.oppScore ? "V" : f.userScore < f.oppScore ? "D" : "E"
                      return (
                        <div key={`${f.opponentId}-${i}`} className="flex items-center gap-3 rounded-lg bg-black/25 px-3 py-2">
                          <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px] font-black",
                            r === "V" ? "bg-[var(--brand)]/20 text-[var(--brand)]" : r === "D" ? "bg-red-400/20 text-red-300" : "bg-white/10 text-white/60")}>{r}</span>
                          <span className="w-14 shrink-0 font-mono text-sm text-white">{f.userScore} x {f.oppScore}</span>
                          <span className="min-w-0 flex-1 truncate text-sm text-white/70">{f.opponentName}</span>
                          <span className="shrink-0 text-[10px] text-white/30">Amistoso</span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-white/40">
                    Nenhum amistoso disputado. Prepare o time antes da janela FIFA.
                  </p>
                )}
              </div>

              {career.titles.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {career.titles.map((titulo, i) => (
                    <span key={i} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-[var(--brand)]/10 text-[var(--brand)] border border-[var(--brand)]/20">
                      <Crown className="h-3 w-3" /> {titulo.competition} {titulo.season}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 flex justify-end">
                {confirmLeave ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/50">Deixar a selecao?</span>
                    <button
                      onClick={() => { leaveNationalTeam(); setConfirmLeave(false) }}
                      className="text-xs px-3 py-1.5 rounded-md bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => setConfirmLeave(false)}
                      className="text-xs px-3 py-1.5 rounded-md bg-white/[0.05] text-white/60 hover:bg-white/[0.1] transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmLeave(true)}
                    className="text-xs px-3 py-1.5 rounded-md bg-white/[0.04] text-white/50 hover:text-white/80 hover:bg-white/[0.08] transition-colors"
                  >
                    Deixar a selecao
                  </button>
                )}
              </div>
            </div>

            {/* Competicao ativa OU lista de competicoes. O id mantem a ancora
                antiga (/selecao#competicoes) funcionando para saves e links velhos. */}
            <div id="competicoes" className="scroll-mt-24" />
            {currentCompetition ? (
              <NationalCompetitionPanel />
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                    <Trophy className="h-5 w-5 text-[var(--brand)]" /> Competicoes disponiveis
                  </h2>
                  <Link
                    href="/selecao/competicoes"
                    className="ml-auto flex items-center gap-1 rounded-lg bg-white/[0.05] px-3 py-1.5 text-[11px] font-semibold text-white/60 transition-colors hover:bg-white/[0.1] hover:text-white"
                  >
                    Tela de competições <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
                <NationalCompetitionList
                  competitions={availableCompetitions}
                  completedThisSeason={career.completedThisSeason}
                  onStart={startCompetition}
                />
              </div>
            )}

            {/* Convocacao: a gestao completa (cortes, chamadas a dedo, criterios
                e elegiveis) tem tela propria. O hub mostra so o estado da lista. */}
            <Link
              href="/selecao/convocacao"
              className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#0c0c10] p-5 transition-colors hover:border-[var(--brand)]/30 hover:bg-white/[0.02]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--brand)]/10">
                <Users className="h-5 w-5 text-[var(--brand)]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold uppercase tracking-wide text-white">Convocacao ({squad.length})</p>
                <p className="truncate text-xs text-white/50">
                  {cuts.length > 0 || calls.length > 0
                    ? `Lista ajustada por voce — ${cuts.length} corte(s) e ${calls.length} chamada(s).`
                    : "Lista automatica pelas cotas de setor. Abra para cortar e convocar a dedo."}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-white/30 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}

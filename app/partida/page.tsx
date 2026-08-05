"use client"

import Link from "next/link"
import Image from "next/image"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Play,
  Star,
  StarHalf,
  ChevronUp,
  ChevronDown,
  Check,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  Trophy,
} from "lucide-react"
import { ActionHint } from "@/components/gamepad-icons"
import { GamepadControlsBar, useGamepadDetection } from "@/components/gamepad-controls-bar"
import { getCompetitionTheme, type CompetitionId } from "@/lib/competition-themes"
import { TeamCrest } from "@/components/team-crest"
import { CtaPill } from "@/components/cta-pill"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  getTeamByShort,
  serieATeams,
  getCamisaUrl,
  getTeamUniforms,
  isKitVariantAvailable,
  type Team,
} from "@/lib/teams-data"
import { useGameState, useUserTeam } from "@/lib/save-system"
import { useGameManager, getLeagueName } from "@/lib/use-game-manager"
import { clearMatchContext, loadMatchContext, saveMatchContext } from "@/lib/match-context"
import { timeDaSelecao } from "@/lib/partida-da-selecao"
import { concluirAmistoso, ehAmistoso } from "@/lib/amistosos-calendario"
import { hardNavigate } from "@/lib/hard-navigation"
import { simulateFullMatch, type MatchEvent as SimEvent, type MatchState } from "@/lib/match-engine"
import { useGameEngine, type MatchEvent as EngineEvent, type Player } from "@/lib/game-engine"
import { teamSectorRatings } from "@/lib/players-data"
import { TacticalEditor } from "@/components/tactical-editor"
import { getLeagueLogo } from "@/lib/league-logos"
import { getCompetitionLogo } from "@/lib/competition-logo"
import { UniformSelectorModal } from "@/components/match/uniform-selector-modal"
import { MatchResultModal } from "@/components/match/match-result-modal"
import { RoundResultsModal } from "@/components/match/round-results-modal"
import { PostMatchPress } from "@/components/match/post-match-press"

type KitVariant = "home" | "away" | "third"

// Mapeia o pais do time para o codigo de bandeira (flagcdn) e nome exibido
function getCountryInfo(team: Team): { name: string; code: string } {
  const pais = (team.pais || "").toLowerCase()
  const map: Record<string, { name: string; code: string }> = {
    brasil: { name: "Brasil", code: "br" },
    brazil: { name: "Brasil", code: "br" },
    argentina: { name: "Argentina", code: "ar" },
    alemanha: { name: "Alemanha", code: "de" },
    inglaterra: { name: "Inglaterra", code: "gb-eng" },
    espanha: { name: "Espanha", code: "es" },
    franca: { name: "França", code: "fr" },
    italia: { name: "Itália", code: "it" },
    portugal: { name: "Portugal", code: "pt" },
  }
  if (map[pais]) return map[pais]
  // fallback por regiao
  if (team.regiao === "americas") return { name: "Argentina", code: "ar" }
  if (team.regiao === "europa") return { name: "Europa", code: "eu" }
  return { name: "Brasil", code: "br" }
}

// ─────────────────────────────────────────────────────────────────────────────
// TeamPanel Component - Estilo EA FC (Selecionar Times)
// ─────────────────────────────────────────────────────────────────────────────

function TeamPanel({
  team,
  selected,
  leagueName,
  leagueLogo,
  onSelect,
}: {
  team: Team
  selected: boolean
  leagueName: string
  leagueLogo: string | null
  onSelect: () => void
}) {
  const country = getCountryInfo(team)

  // Avaliacao em estrelas com suporte a meia-estrela (prestigio em escala 0-10)
  const ratingHalf = Math.max(0.5, Math.min(5, Math.round(team.prestigio) / 2))

  const cor1 = team.cor1 || "#10b981"
  // ATA/MEI/DEF vinham das LETRAS do codigo do clube:
  //   ata = rating + (curto.charCodeAt(0) % 5) - 2
  // Nao era dado nenhum — nem o rating, que usava `teamRating` (seed cru, sem
  // calibracao) e devolvia ~90 para todos os grandes brasileiros.
  // Agora sai do elenco real calibrado; ver teamSectorRatings.
  const stats = useMemo(() => {
    const s = teamSectorRatings(team)
    // A seta compara a linha com o proprio time: um ataque 4 acima do overall e
    // mesmo o forte do elenco. Isso e informacao util antes do jogo, ao
    // contrario da seta antiga, sorteada pelo codigo do clube.
    const trend = (valor: number) =>
      valor >= s.overall + 2 ? "up" : valor <= s.overall - 2 ? "down" : "neutral"
    return {
      overall: s.overall,
      ata: { value: s.ata, trend: trend(s.ata) },
      mei: { value: s.mei, trend: trend(s.mei) },
      def: { value: s.def, trend: trend(s.def) },
    }
  }, [team])

  const TrendIndicator = ({ trend }: { trend: string }) => {
    if (trend === "up") return <ChevronUp className="h-3.5 w-3.5 text-emerald-400" />
    if (trend === "down") return <ChevronDown className="h-3.5 w-3.5 text-red-400" />
    return <Minus className="h-3.5 w-3.5 text-white/35" />
  }

  return (
    <div className="flex w-full max-w-[400px] flex-col items-center gap-3">

      {/* Card de PAIS */}
      <div className="relative flex w-full items-center justify-center rounded-2xl bg-[#0e1116]/85 px-5 py-3.5 backdrop-blur-sm">
        <span className="text-base font-bold tracking-wide text-white">{country.name}</span>
        <img
          src={`https://flagcdn.com/h40/${country.code}.png`}
          alt={country.name}
          className="absolute right-5 top-1/2 h-6 w-9 -translate-y-1/2 rounded-[3px] object-cover shadow-md"
        />
      </div>

      {/* Card de selecao de time */}
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect() }}
        className={cn(
          "relative w-full cursor-pointer overflow-hidden rounded-2xl transition-all",
          selected
            ? "border-2 border-[var(--brand)]/70 bg-[linear-gradient(160deg,rgba(22,30,40,0.96)_0%,rgba(10,14,20,0.96)_100%)] shadow-[0_0_38px_rgba(0,255,200,0.16),0_20px_60px_rgba(0,0,0,0.6)]"
            : "border border-white/[0.07] bg-[linear-gradient(160deg,rgba(20,26,34,0.85)_0%,rgba(10,14,20,0.9)_100%)] shadow-[0_20px_60px_rgba(0,0,0,0.55)]",
        )}
      >
        {/* Nome do time */}
        <div className="px-6 pt-4 pb-1">
          <h2 className="truncate text-center text-xl font-bold tracking-wide text-white">{team.nome}</h2>
        </div>

        {/* Escudo */}
        <div className="relative flex justify-center py-3 sm:py-4">
          <div
            className="flex h-32 w-32 items-center justify-center rounded-full sm:h-36 sm:w-36"
            style={{ background: `radial-gradient(circle, ${cor1}22 0%, transparent 68%)` }}
          >
            <TeamCrest team={team} size="2xl" className="h-28 w-28 sm:h-32 sm:w-32" />
          </div>
        </div>

        {/* Estrelas (com meia-estrela) */}
        <div className="flex items-center justify-center gap-1 pb-4">
          {Array.from({ length: 5 }).map((_, i) => {
            const fill = ratingHalf - i
            if (fill >= 1) {
              return (
                <Star
                  key={i}
                  className="h-5 w-5 fill-amber-400 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]"
                />
              )
            }
            if (fill >= 0.5) {
              return (
                <span key={i} className="relative inline-block h-5 w-5">
                  <Star className="absolute inset-0 h-full w-full text-white/15" />
                  <StarHalf className="absolute inset-0 h-full w-full fill-amber-400 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]" />
                </span>
              )
            }
            return <Star key={i} className="h-5 w-5 text-white/15" />
          })}
        </div>

        {/* ATA / MEI / DEF */}
        <div className="flex items-stretch border-t border-white/[0.07] bg-black/30">
          <div className="flex-1 px-2 py-3.5 text-center">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/45">ATA</div>
            <div className="flex items-center justify-center gap-0.5">
              <span className="text-2xl font-black leading-none tabular-nums text-white">{stats.ata.value}</span>
              <TrendIndicator trend={stats.ata.trend} />
            </div>
          </div>
          <div className="w-px bg-white/[0.07]" />
          <div className="flex-1 px-2 py-3.5 text-center">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/45">MEI</div>
            <div className="flex items-center justify-center gap-0.5">
              <span className="text-2xl font-black leading-none tabular-nums text-white">{stats.mei.value}</span>
              <TrendIndicator trend={stats.mei.trend} />
            </div>
          </div>
          <div className="w-px bg-white/[0.07]" />
          <div className="flex-1 px-2 py-3.5 text-center">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/45">DEF</div>
            <div className="flex items-center justify-center gap-0.5">
              <span className="text-2xl font-black leading-none tabular-nums text-white">{stats.def.value}</span>
              <TrendIndicator trend={stats.def.trend} />
            </div>
          </div>
        </div>
      </div>

      {/* Card de LIGA — logo AMPLIADA (era h-11/44px; ficava minuscula no card). */}
      <div className="flex w-full flex-col items-center gap-2 rounded-2xl bg-[#0e1116]/85 px-5 py-5 backdrop-blur-sm">
        {leagueLogo ? (
          // Sem mixBlendMode: o "screen" tornava as partes escuras da logo
          // transparentes, deixando so um contorno fantasma no lugar do emblema.
          <Image
            src={leagueLogo}
            alt={leagueName}
            width={320}
            height={96}
            className="h-20 w-auto max-w-[280px] object-contain"
            unoptimized
          />
        ) : (
          <Trophy className="h-12 w-12 text-white/60" />
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────────────────────

export default function PartidaPage() {
  const router = useRouter()
  const userTeam = useUserTeam()
  const { currentMatch, seasonCalendar, standings, league, currentRound, registerUserMatchResult, advanceWeek, temPartidaPendenteNaSemana, fifaPause, hydrated: saveHidratado } = useGameManager()

  const { connected: gamepadConnected } = useGamepadDetection()
  const [hydrated, setHydrated] = useState(false)

  // AMISTOSO DO CALENDARIO. As refs existem porque `handleQuickSim` resolve o
  // resultado dentro de um setTimeout: ler o estado direto ali pegaria o valor
  // de quando o callback foi criado (o classico closure velho que ja mordeu esta
  // tela antes).
  const { state: saveAtual, setState: setSaveState } = useGameState()
  const saveRef = useRef(saveAtual)
  saveRef.current = saveAtual
  const amistosoRef = useRef<number | null>(null)
  const registrarAmistosoNoEntrosamento = useCallback(() => {
    // Amistoso e entrosamento pela MESMA porta da partida oficial: minutos
    // jogados juntos. Vale menos que um jogo de verdade (nao ha a mesma pressao),
    // por isso 70 e nao 90. Ver lib/treino-e-entrosamento.ts.
    useGameEngine.getState().registrarMinutosJuntos(70)
  }, [])

  // Blindagem da pausa FIFA: se o campeonato de clubes esta parado (data FIFA /
  // Copa do Mundo), nao ha jogo de clube para disputar — volta ao escritorio, onde
  // o painel da janela mostra a Copa e o botao de avancar. Sem isto, o link direto
  // "proxima partida" furava a pausa (relato: "continuei jogando normalmente").
  useEffect(() => {
    if (fifaPause?.active) hardNavigate("/")
  }, [fifaPause?.active])
  const [homeKit, setHomeKit] = useState<KitVariant>("home")
  const [awayKit, setAwayKit] = useState<KitVariant>("away")
  const [livePhase, setLivePhase] = useState(true)
  const [advantageOptions, setAdvantageOptions] = useState(false)
  const [showUniformModal, setShowUniformModal] = useState(false)

  // VALIDACAO DA ESCALACAO (pedido): expulso/lesionado/suspenso NAO pode ser
  // escalado. Se houver algum titular nessas condicoes, abre uma tela com duas
  // opcoes — corrigir automatico (substituir) ou corrigir manual.
  // Contexto da PARTIDA DA SELEÇÃO. Declarado aqui em cima porque
  // `titularesInvalidos` (logo abaixo) depende dele — `const` em TDZ estoura
  // em tempo de execução, não de compilação.
  const ctxDaSelecao = useMemo(() => loadMatchContext().national ?? null, [])
  const enginePlayersPre = useGameEngine(s => s.squadPlayers)
  const setStarterPre = useGameEngine(s => s.setStarter)
  const [escalacaoInvalida, setEscalacaoInvalida] = useState<Player[] | null>(null)

  // NA SELEÇÃO ESTA CHECAGEM NÃO SE APLICA. `enginePlayersPre` é sempre o
  // plantel do CLUBE; quem entra em campo pela seleção é a convocação, montada
  // em /selecao/convocacao e resolvida na tela da partida. Sem esta guarda, um
  // lesionado do seu clube barrava a escalação da seleção — e o "corrigir
  // automático" mexeria no XI do clube antes de um jogo que nem é dele.
  const titularesInvalidos = useMemo(
    () => (ctxDaSelecao
      ? []
      : enginePlayersPre.filter(p => p.isStarter && (p.injury || (p.suspendedMatches ?? 0) > 0))),
    [enginePlayersPre, ctxDaSelecao],
  )

  /** Motivo da inelegibilidade, para a tela. */
  const motivoInelegivel = (p: Player) =>
    p.injury ? `lesionado (${p.injury.type}, ${p.injury.weeksRemaining} sem.)`
      : (p.suspendedMatches ?? 0) > 0 ? `suspenso (${p.suspendedMatches} jogo${(p.suspendedMatches ?? 0) > 1 ? "s" : ""})`
        : "indisponível"

  /** Ir para a partida — mas so depois de checar a escalacao. */
  const irParaPartida = useCallback(() => {
    if (titularesInvalidos.length > 0) { setEscalacaoInvalida(titularesInvalidos); return }
    hardNavigate("/partida/ao-vivo")
  }, [titularesInvalidos])

  /** Corrige automatico: para cada titular invalido, promove o melhor reserva
   *  APTO da mesma posicao (ou o melhor apto geral) e tira o invalido do XI. */
  const corrigirAutomatico = useCallback(() => {
    const aptos = enginePlayersPre.filter(p => !p.isStarter && !p.injury && (p.suspendedMatches ?? 0) <= 0)
    const usados = new Set<number>()
    for (const inval of titularesInvalidos) {
      const mesmaPos = aptos
        .filter(r => !usados.has(r.id) && r.position === inval.position)
        .sort((a, b) => b.overall - a.overall)[0]
      const qualquer = aptos
        .filter(r => !usados.has(r.id))
        .sort((a, b) => b.overall - a.overall)[0]
      const escolhido = mesmaPos ?? qualquer
      setStarterPre(inval.id, false)
      if (escolhido) { setStarterPre(escolhido.id, true); usados.add(escolhido.id) }
    }
    setEscalacaoInvalida(null)
    hardNavigate("/partida/ao-vivo")
  }, [enginePlayersPre, titularesInvalidos, setStarterPre])
  const [focusedSide, setFocusedSide] = useState<"home" | "away">("home")
  const [showSettings, setShowSettings] = useState(false)
  const [showQuickSim, setShowQuickSim] = useState(false)
  const [showQuickRoundResults, setShowQuickRoundResults] = useState(false)
  const [showQuickPress, setShowQuickPress] = useState(false)
  const [quickSimResult, setQuickSimResult] = useState<{
    homeGoals: number
    awayGoals: number
    events: (SimEvent | EngineEvent)[]
    state: MatchState
  } | null>(null)
  const quickSimRegistered = useRef(false)

  // Hydration
  useEffect(() => {
    setHydrated(true)
  }, [])

  // Resolve teams.
  //
  // Antes, sem currentMatch, isto caia em FLA x MIR HARDCODED — por isso a tela
  // mostrava Flamengo x Mirassol mesmo com outro time selecionado, divergindo do
  // calendario/escritorio. O `userTeam` desta pagina nem chegava a ser usado.
  // Agora usa a PROXIMA partida real do calendario e, se nem isso houver, o time do
  // usuario. Sem clube inventado.
  const nextFixture = seasonCalendar?.nextUserMatch ?? null
  const userTeamData = useMemo(
    () => getTeamByShort(userTeam.team?.curto ?? ""),
    [userTeam.team?.curto],
  )

  // PRÉ-JOGO DA SELEÇÃO. O contexto já foi montado por
  // `prepararPartidaDaSelecao`; aqui ele TEM prioridade sobre o próximo jogo do
  // clube, senão esta tela mostraria o adversário errado — o do campeonato — e
  // ainda gravaria os `shorts` do clube por cima da partida da seleção.
  const selecaoMandante = useMemo(
    () => (ctxDaSelecao ? timeDaSelecao(ctxDaSelecao.usuarioEmCasa ? ctxDaSelecao.selecaoId : ctxDaSelecao.adversarioId) : null),
    [ctxDaSelecao],
  )
  const selecaoVisitante = useMemo(
    () => (ctxDaSelecao ? timeDaSelecao(ctxDaSelecao.usuarioEmCasa ? ctxDaSelecao.adversarioId : ctxDaSelecao.selecaoId) : null),
    [ctxDaSelecao],
  )

  const homeTeam = useMemo(() => {
    if (selecaoMandante) return selecaoMandante
    if (currentMatch) return currentMatch.homeTeam
    if (nextFixture) return nextFixture.homeTeam
    return userTeamData ?? serieATeams[0]
  }, [selecaoMandante, currentMatch, nextFixture, userTeamData])

  const awayTeam = useMemo(() => {
    if (selecaoVisitante) return selecaoVisitante
    if (currentMatch) return currentMatch.awayTeam
    if (nextFixture) return nextFixture.awayTeam
    // Sem calendario: qualquer adversario, menos o proprio time.
    return serieATeams.find(t => t.curto !== (userTeamData?.curto ?? "")) ?? serieATeams[1]
  }, [selecaoVisitante, currentMatch, nextFixture, userTeamData])

  const matchInfo = useMemo(() => {
    // league é a chave de divisao (ex: "serie_a") — usar diretamente para o logo
    const leagueName = getLeagueName(homeTeam.curto)

    // A competicao sai da partida REAL (currentMatch ou a proxima do calendario).
    // Antes so olhava currentMatch: sem ele caia sempre na liga, e um jogo do
    // Paulistao aparecia com a marca do Brasileirao.
    const fixture = currentMatch ?? nextFixture
    const compType = fixture?.competitionType
    const isLeagueMatch = !compType || compType === "league"
    const competition = fixture?.competition ?? leagueName

    return {
      competition,
      // O logo central segue a competicao real da partida
      leagueKey: isLeagueMatch ? league : competition,
      // Em copas/estaduais a fase ja vem no nome da competicao; na liga mostramos a rodada
      round: isLeagueMatch ? `Rodada ${currentRound ?? 1}` : competition,
      date: "01 ABR 2026",
      time: "16:00",
      stadium: homeTeam.estadio_nome,
    }
  }, [league, currentRound, homeTeam, currentMatch, nextFixture])

  const competitionTheme = useMemo(() => {
    const competitionId = (league ?? "serie_a").replace(/_/g, "-") as CompetitionId
    return getCompetitionTheme(competitionId)
  }, [league])

  /**
   * Marca da COMPETICAO da partida (Paulistao, Copa do Brasil, Libertadores...).
   *
   * Antes cada card usava getLeagueLogo(time.divisao) — a liga do CLUBE, nao a
   * competicao do JOGO. Resultado: Mirassol x Palmeiras pelo Paulistao aparecia com a
   * marca do Brasileirao. Sem arte para a competicao, cai na liga (nao inventa outra).
   */
  const matchCompetitionLogo = useMemo(
    () => getCompetitionLogo(matchInfo.competition) ?? getLeagueLogo(homeTeam.divisao),
    [matchInfo.competition, homeTeam.divisao],
  )

  // Quick sim handler
  const handleQuickSim = useCallback(() => {
    if (!homeTeam || !awayTeam) return
    quickSimRegistered.current = false
    setShowQuickSim(true)
    setQuickSimResult(null)
    const result = simulateFullMatch({
      homeTeam,
      awayTeam,
      // Mesma fonte que o card exibe: o numero mostrado e o numero simulado.
      homeRating: teamSectorRatings(homeTeam).overall,
      awayRating: teamSectorRatings(awayTeam).overall,
    })
    setTimeout(() => {
      setQuickSimResult({
        homeGoals: result.home.goals,
        awayGoals: result.away.goals,
        events: result.events,
        state: result,
      })

      if (!quickSimRegistered.current) {
        quickSimRegistered.current = true
        const goalEvents: EngineEvent[] = result.events
          .filter(e => e.type === "goal")
          .map(e => ({
            minute: e.minute,
            type: "goal" as const,
            playerId: 0,
            playerName: e.player || (e.side === "home" ? homeTeam.curto : awayTeam.curto),
          }))

        // AMISTOSO simulado rapido: NAO vai para a tabela, nao vira a semana e
        // nao entra nas estatisticas. So marca o jogo-treino como disputado (com
        // o placar) e credita o entrosamento dos minutos jogados juntos.
        if (amistosoRef.current != null) {
          const usuarioEmCasa = homeTeam.curto === (userTeam.team?.curto ?? "")
          const golsPro = usuarioEmCasa ? result.home.goals : result.away.goals
          const golsContra = usuarioEmCasa ? result.away.goals : result.home.goals
          const atualizados = concluirAmistoso(
            saveRef.current.amistososAgendados ?? [], amistosoRef.current, golsPro, golsContra,
          )
          if (atualizados) setSaveState({ amistososAgendados: atualizados } as Parameters<typeof setSaveState>[0])
          registrarAmistosoNoEntrosamento()
          clearMatchContext()
          return
        }

        registerUserMatchResult(
          homeTeam.curto,
          awayTeam.curto,
          result.home.goals,
          result.away.goals,
          goalEvents
        )
        clearMatchContext()
        // So vira a semana se NAO sobrou jogo seu nela. Numa semana com copa em
        // meio de semana sobra: avancar aqui fazia o motor simular a copa como
        // partida atrasada, sem o jogador jogar.
        if (!temPartidaPendenteNaSemana()) void advanceWeek()
      }
    }, 1500)
  }, [homeTeam, awayTeam, registerUserMatchResult, advanceWeek, temPartidaPendenteNaSemana, setSaveState, userTeam.team?.curto, registrarAmistosoNoEntrosamento])

  // Save match context before navigation
  //
  // AMISTOSO: quando a próxima partida do calendário é um jogo-treino marcado na
  // Área do Treinador, o contexto precisa dizer isso. Sem `friendly: true` o
  // ao-vivo registraria o placar como partida oficial — tabela, estatística e
  // avanço de semana — e o amistoso deixaria de ser amistoso. `amistosoSemana`
  // identifica QUAL dos três marcados é este, para o resultado voltar ao save.
  const fixtureAtual = currentMatch ?? nextFixture
  const amistosoDoCalendario = fixtureAtual && ehAmistoso(fixtureAtual) ? fixtureAtual : null
  amistosoRef.current = amistosoDoCalendario?.week ?? null
  useEffect(() => {
    if (homeTeam && awayTeam) {
      saveMatchContext({
        homeShort: homeTeam.curto,
        awayShort: awayTeam.curto,
        homeKit,
        awayKit,
        // Na partida da seleção, competição e fase já vieram prontas da
        // competição da seleção — `matchInfo` fala do campeonato do CLUBE, e
        // sobrescrever aqui trocaria "Copa do Mundo · Semifinal" pela rodada da
        // Série A. `friendly` também precisa continuar true: é o que impede
        // esta partida de mexer na temporada do clube.
        ...(ctxDaSelecao
          ? { friendly: true }
          : {
              competition: matchInfo.competition,
              round: matchInfo.round,
              friendly: amistosoDoCalendario ? true : undefined,
              amistosoSemana: amistosoDoCalendario?.week,
            }),
      })
    }
  }, [homeTeam, awayTeam, homeKit, awayKit, matchInfo, amistosoDoCalendario, ctxDaSelecao])

  // Gamepad controls
  useEffect(() => {
    const cycleKit = (team: Team, current: KitVariant, direction: number): KitVariant => {
      const kits: KitVariant[] = (["home", "away", "third"] as KitVariant[])
        .filter(variant => isKitVariantAvailable(team.file_key, variant))
      const idx = kits.indexOf(current)
      const newIdx = (idx + direction + kits.length) % kits.length
      return kits[newIdx]
    }

    const handleGamepadButton = (e: Event) => {
      const { button } = (e as CustomEvent).detail
      
      if (showQuickSim) {
        if (button === "B") {
          setShowQuickSim(false)
          setQuickSimResult(null)
        }
        return
      }

      switch (button) {
        case "A":
          irParaPartida()
          break
        case "B":
          // "Voltar" devolve ao ESCRITORIO (de onde a pre-partida foi aberta), nao ao
          // menu de saves. Antes ia para /splash?menu=1, jogando o usuario para a tela de
          // selecao de save no meio da carreira.
          hardNavigate("/")
          break
        case "X":
          handleQuickSim()
          break
        case "Y":
          setShowSettings(true)
          break
        case "LB":
          setHomeKit(prev => cycleKit(homeTeam, prev, -1))
          break
        case "RB":
          setHomeKit(prev => cycleKit(homeTeam, prev, 1))
          break
        case "LT":
          // Abre o MODAL de uniformes pelo controle (antes so a tecla Q ou o
          // clique abriam — relato: "nao consigo abrir o modal de uniforme").
          setShowUniformModal(v => !v)
          break
      }
    }

    window.addEventListener("gamepad:button", handleGamepadButton)
    return () => window.removeEventListener("gamepad:button", handleGamepadButton)
  }, [showQuickSim, router, handleQuickSim])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return
      if (showQuickSim) return

      if (event.key === "Enter") {
        event.preventDefault()
        irParaPartida()
      } else if (event.key.toLowerCase() === "x") {
        event.preventDefault()
        handleQuickSim()
      } else if (event.key === "Escape") {
        event.preventDefault()
        hardNavigate("/")
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleQuickSim, showQuickSim])

  // Tecla Q: abre a selecao de uniformes (o keycap [q] sempre existiu na tela, mas a
  // tecla nunca fez nada — so o clique no botao). Ignora se o modal ja esta aberto (ele
  // trata o proprio Q para fechar) ou se ha texto em foco.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "q" || e.ctrlKey || e.altKey || e.metaKey) return
      if (showUniformModal) return
      const el = document.activeElement as HTMLElement | null
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return
      e.preventDefault()
      setShowUniformModal(true)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [showUniformModal])

  // ⚠️ ESPERAR O SAVE, NAO SO O MONTE DO REACT.
  //
  // `hydrated` local vira true no primeiro efeito depois de montar, mas o SAVE
  // (e com ele o calendario) ainda nao chegou: nesse intervalo `currentMatch` e
  // `nextFixture` sao nulos e os fallbacks logo abaixo caem em `userTeamData` x
  // `serieATeams[0]`. Como serieATeams[0] e o Botafogo e [1] o Palmeiras, quem
  // dirigia o Palmeiras via piscar um "Palmeiras x Botafogo" que nao existe no
  // calendario — a tela mock relatada. Agora a tela so desenha com o save na
  // mao, e o confronto exibido e sempre o de verdade.
  if (!hydrated || !saveHidratado) {
    return (
      <div className="h-screen bg-[#050508] flex items-center justify-center text-white/40 text-sm">
        Carregando...
      </div>
    )
  }
  
  // SEM CONFRONTO NENHUM nao se inventa um. Com o save ja carregado, `nulo` aqui
  // significa que nao ha jogo marcado (temporada encerrada, por exemplo) — e o
  // fallback de adversario logo acima produziria de novo um confronto que nao
  // existe no calendario, que e a tela mock relatada.
  const semConfronto = !ctxDaSelecao && !currentMatch && !nextFixture
  if (semConfronto) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#050508] px-6 text-center">
        <Trophy className="h-10 w-10 text-white/20" />
        <p className="text-sm text-white/60">Nenhuma partida marcada no momento.</p>
        <p className="max-w-sm text-xs text-white/35">
          Avance a semana no escritorio para o proximo compromisso entrar no calendario.
        </p>
        <Link
          href="/dashboard"
          className="mt-2 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--brand-ink)] hover:bg-[var(--brand-2)]"
        >
          Voltar ao escritorio
        </Link>
      </div>
    )
  }

  const homeLeague = getLeagueName(homeTeam.curto)
  const awayLeague = getLeagueName(awayTeam.curto)

  return (
    <div className="h-screen bg-[#050508] flex flex-col overflow-hidden">

      {/* Main Content */}
      <main className="relative flex-1 overflow-hidden">
        {/* Fundo FIXO para toda partida: a cutscene roda em loop, muda, atras dos
            paineis. Antes o fundo vinha por competicao/estadio (lib/pre-match-bg)
            e mostrava "image not found" sempre que faltava a arte daquele clube —
            justamente o que acontecia com times menores. Um video fixo nunca
            depende de arte que pode faltar.
            No modo economico o CSS esconde <video> (poupa GPU fraca); por isso a
            base e um gradiente escuro proprio, que aparece no lugar sem quebrar
            nada. Ver components/performance-profile. */}
        {/* Fundo FIXO da tela de pre-jogo: imagem estatica (pedido do jogador, no
            lugar da cutscene em video). Um PNG proprio nunca depende de arte por
            clube que pode faltar, e nao consome GPU como o video em loop. */}
        <div className="absolute inset-0 bg-[#050508]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,#132534_0%,#070a0f_72%)]" />
          <Image
            src="/images/pre-jogo/pre-jogo-fundo.png"
            alt=""
            fill
            priority
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Escurecimento leve para legibilidade dos paineis por cima */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/35 to-black/70" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/25" />
        </div>

        {/* Header — mostra o CONTEXTO REAL da partida (competicao + rodada +
            estadio) em vez do generico "Partida Classica / Selecionar Times".
            Faz a tela parecer um dia de jogo do calendario, nao um modo
            exibicao. A marca da competicao aparece a esquerda quando existe. */}
        <div className="relative z-20 flex items-center gap-4 px-8 pt-6">
          <Image
            src="/brand/uf26-logo.png"
            alt="UF26"
            width={160}
            height={60}
            className="h-14 w-auto object-contain"
            priority
          />
          <span className="h-8 w-px bg-white/20" />
          {matchCompetitionLogo ? (
            <Image
              src={matchCompetitionLogo}
              alt={matchInfo.competition}
              width={120}
              height={48}
              className="h-9 w-auto max-w-[130px] object-contain"
              unoptimized
            />
          ) : null}
          <div className="flex flex-col leading-tight">
            <h1 className="text-lg font-black tracking-tight text-white">{matchInfo.competition}</h1>
            <div className="flex items-center gap-2 text-xs font-semibold text-white/55">
              <span className="uppercase tracking-wider text-[var(--brand)]">{matchInfo.round}</span>
              {matchInfo.stadium ? (
                <>
                  <span className="h-3 w-px bg-white/20" />
                  <span className="text-white/50">{matchInfo.stadium}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* Teams Section */}
        <div className="relative z-10 flex h-[calc(100%-150px)] items-center justify-center gap-4 px-6 xl:gap-10 xl:px-20">
          {/* Painel CASA */}
          <TeamPanel
            team={homeTeam}
            selected={focusedSide === "home"}
            leagueName={homeLeague}
            leagueLogo={matchCompetitionLogo}
            onSelect={() => setFocusedSide("home")}
          />

          {/* Coluna central de opcoes */}
          <div className="flex shrink-0 flex-col items-center justify-center gap-10 px-2">
            {/* Q agora abre a selecao de UNIFORMES (era "Opcoes de vantagem", que so
                alternava um Sim/Nao sem efeito). */}
            <button
              onClick={() => setShowUniformModal(true)}
              className="flex flex-col items-center gap-1.5 text-center"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md border border-white/20 bg-white/10 text-xs font-bold text-white/70">
                  q
                </span>
                <span className="text-base font-semibold text-white">Uniformes</span>
              </div>
              <span className="max-w-24 text-sm leading-tight text-white/55 text-balance">Casa e visitante</span>
            </button>

            <button
              onClick={() => setLivePhase((v) => !v)}
              className="flex flex-col items-center gap-1.5 text-center"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md border border-white/20 bg-white/10 text-xs font-bold text-white/70">
                  d
                </span>
                {livePhase ? (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500">
                    <Check className="h-3.5 w-3.5 text-black" strokeWidth={3} />
                  </span>
                ) : (
                  <span className="h-6 w-6 rounded-full border-2 border-white/30" />
                )}
              </div>
              <span className="text-sm leading-tight text-white/55">Fase ao vivo</span>
              <span className="text-sm font-medium text-white/75">{livePhase ? "Sim" : "Não"}</span>
            </button>
          </div>

          {/* Painel FORA */}
          <TeamPanel
            team={awayTeam}
            selected={focusedSide === "away"}
            leagueName={awayLeague}
            leagueLogo={matchCompetitionLogo}
            onSelect={() => setFocusedSide("away")}
          />
        </div>

        {/* Bottom Action Bar */}
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black via-black/90 to-transparent px-8 py-5">
          <div className="flex items-center justify-between">
            {/* Atalhos estilo EA FC */}
            <div className="flex items-center gap-7">
              <button onClick={irParaPartida} className="flex items-center gap-2 text-white transition-opacity hover:opacity-80">
                <span className="flex h-7 min-w-7 items-center justify-center rounded-md border border-white/20 bg-white/10 px-1.5 text-xs font-bold">
                  ⏎
                </span>
                <span className="text-sm font-semibold">Selecionar</span>
              </button>
              <button onClick={() => hardNavigate("/")} className="flex items-center gap-2 text-white transition-opacity hover:opacity-80">
                <span className="flex h-7 min-w-7 items-center justify-center rounded-md border border-white/20 bg-white/10 px-1.5 text-xs font-bold">
                  Esc
                </span>
                <span className="text-sm font-semibold">Voltar</span>
              </button>
            </div>

            {/* Botao iniciar (acesso direto) */}
            <CtaPill onClick={irParaPartida}>INICIAR PARTIDA</CtaPill>
          </div>
        </div>
      </main>

      {/* ESCALACAO INVALIDA: titular lesionado/suspenso/expulso. Duas opcoes. */}
      {escalacaoInvalida && escalacaoInvalida.length > 0 && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl border border-amber-400/25 bg-[#0c0d12] p-6 shadow-2xl">
            <h2 className="text-lg font-black text-white">Escalação inválida</h2>
            <p className="mt-1 text-sm text-white/55">
              Você tem {escalacaoInvalida.length} titular{escalacaoInvalida.length > 1 ? "es" : ""} que não pode{escalacaoInvalida.length > 1 ? "m" : ""} jogar:
            </p>
            <ul className="mt-3 space-y-1.5">
              {escalacaoInvalida.map(p => (
                <li key={p.id} className="flex items-center justify-between rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm">
                  <span className="font-semibold text-white">{p.name} <span className="text-white/40 font-normal">({p.position})</span></span>
                  <span className="text-[11px] font-medium text-red-300">{motivoInelegivel(p)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 space-y-2">
              <button onClick={corrigirAutomatico}
                className="w-full rounded-lg bg-[var(--brand)] py-3 text-sm font-bold text-[var(--brand-ink)] hover:brightness-110">
                Corrigir automaticamente
                <span className="block text-[11px] font-medium text-black/60">Substitui pelos melhores reservas aptos e inicia a partida</span>
              </button>
              <button onClick={() => { setEscalacaoInvalida(null); hardNavigate("/elenco/gerenciamento") }}
                className="w-full rounded-lg bg-white/8 border border-white/12 py-3 text-sm font-semibold text-white hover:bg-white/12">
                Corrigir manualmente
                <span className="block text-[11px] font-normal text-white/45">Abre o Gerenciamento do Time para você ajustar</span>
              </button>
              <button onClick={() => setEscalacaoInvalida(null)}
                className="w-full py-2 text-xs text-white/40 hover:text-white/60">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Sim Modal */}
      {showQuickSim && (
        quickSimResult ? (
          <MatchResultModal
            open
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            state={quickSimResult.state}
            userSide={homeTeam.curto === userTeam.team.curto ? "home" : "away"}
            onClose={() => {
              setShowQuickSim(false)
              setShowQuickRoundResults(true)
            }}
          />
        ) : (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0c0c10] border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white text-center mb-6">Simulação Rápida</h3>
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-white/60">Simulando partida...</span>
            </div>
          </div>
        </div>
        )
      )}

      {showQuickRoundResults && quickSimResult && (
        <RoundResultsModal
          open
          results={[{
            competition: matchInfo.competition,
            homeTeam: homeTeam.curto,
            awayTeam: awayTeam.curto,
            homeScore: quickSimResult.homeGoals,
            awayScore: quickSimResult.awayGoals,
          }]}
          userHome={homeTeam.curto}
          userAway={awayTeam.curto}
          onContinue={() => {
            setShowQuickRoundResults(false)
            setShowQuickPress(true)
          }}
        />
      )}

      {showQuickPress && quickSimResult && (
        <PostMatchPress
          isOpen
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          homeGoals={quickSimResult.homeGoals}
          awayGoals={quickSimResult.awayGoals}
          userSide={homeTeam.curto === userTeam.team.curto ? "home" : "away"}
          onClose={() => setShowQuickPress(false)}
          onComplete={() => {
            setShowQuickPress(false)
            setQuickSimResult(null)
            hardNavigate("/")
          }}
        />
      )}
  
  <GamepadControlsBar
        customActions={[
          { button: "A", label: "Iniciar Partida" },
          { button: "B", label: "Voltar" },
          { button: "X", label: "Sim. Rapida" },
          { button: "LB", label: "Kit Casa" },
          { button: "RB", label: "Kit Fora" },
        ]}
      />

      <UniformSelectorModal
        open={showUniformModal}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        homeKit={homeKit}
        awayKit={awayKit}
        onHomeKit={setHomeKit}
        onAwayKit={setAwayKit}
        onClose={() => setShowUniformModal(false)}
      />
    </div>
  )
}

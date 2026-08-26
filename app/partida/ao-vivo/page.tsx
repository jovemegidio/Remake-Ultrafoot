"use client"

import { LinkLeve as Link } from "@/components/link-leve"
import { safeLocalSet } from "@/lib/safe-storage"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNationalTeam } from "@/lib/use-national-team"
import { timeDaSelecao } from "@/lib/partida-da-selecao"
import { getNationalSquad } from "@/lib/national-teams"
import {
  ChevronLeft,
  Activity,
  Users,
  Goal,
  Target as TargetIcon,
  Flag,
  AlertTriangle,
  Sparkles,
  Zap,
  ArrowLeftRight,
  Timer,
  Play,
  Pause,
  FastForward,
  RotateCcw,
  BarChart3,
  Heart,
  Star,
  Settings2,
  ArrowDownUp,
  Triangle,
  ChevronDown,
  ChevronUp,
  Square,
  Hand,
  Stethoscope,
  Circle,
  Maximize2,
  Minimize2,
} from "lucide-react"
import { TeamCrest } from "@/components/team-crest"
import { getCompetitionLogo } from "@/lib/competition-logo"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getTeamByShort, serieATeams, type Team } from "@/lib/teams-data"
import { formatCurrency } from "@/lib/currency"
import { avancarMataMata, campeaoMataMata } from "@/lib/torneio-amistoso"
import { loadGameState, saveGameStateAndFlush, useGameState } from "@/lib/save-system"
import { useUserTeam } from "@/lib/time-da-carreira"
import { bonusPreparacaoAplicavel282, normalizarGestao282, planoDeBolaParada282 } from "@/lib/gestao-282"
import { calcularEfeitoColetiva } from "@/lib/press-effects"
import { useNotifications } from "@/components/notifications-system"
import { getPlayersForTeam, type Player } from "@/lib/players-data"
import { nivelDeDificuldade } from "@/lib/dificuldade"
import { assignPlayersToFormation, completarEscalacao, pickStartingXI, posicaoPelaCoordenada } from "@/lib/formations"
import { clearMatchContext, loadMatchContext } from "@/lib/match-context"
import { concluirAmistoso } from "@/lib/amistosos-calendario"
import { useMatchSimulation } from "@/hooks/use-match-simulation"
import { getActionForButton, type GameContext } from "@/lib/gamepad-controls"
import { useGamepad, type GamepadButtonName } from "@/hooks/use-gamepad"
import { useGameManager, getStateChampRounds } from "@/lib/use-game-manager"
import { outrosEstaduaisDaRodada } from "@/lib/parallel-rounds"
import { useDiscordRPC } from "@/hooks/use-discord-rpc"
import { useTranslation } from "@/lib/i18n"
import { persistGameEngineNow, useGameEngine, shootingForPosition, type Player as EnginePlayer } from "@/lib/game-engine"
import { saldoDeMoralDaPartida } from "@/lib/match-decisions"
import { familiaridadeEm, forcaDeGoleiro, forcaDeGoleiroNoAlto, perfilDoAtleta, pesoDeLesao, type ProgressoDoPerfil } from "@/lib/modelo-de-jogador"
import { caracteristicasDoAtleta, pesoDePenalti, pesosDeLance } from "@/lib/caracteristicas-do-atleta"
import { forcasDaTatica } from "@/lib/forcas-taticas"
import { efeitosDoTreinador } from "@/lib/efeito-do-treinador"
import { forcasDoPlantel, ladoAdversarioEmCampo, titularesAptos, type AtletaEmCampo } from "@/lib/forca-do-plantel"
import { tecnicoDoClube, tecnicosDoSave } from "@/lib/tecnicos-do-save"
import { arbitroDaPartida } from "@/lib/arbitragem"
import type { TeamTactics } from "@/lib/game-engine"
import { aiTacticForClub, applyTacticModifiers, type TacticalIdentity } from "@/lib/tactics-engine"
import { aiClubSocialMatchModifier } from "@/lib/ai-club-social"
import { climaDoVestiario } from "@/lib/hierarquia-do-elenco"
import { forcasDoElenco } from "@/lib/forcas-individuais"
import { perfilEspacial286 } from "@/lib/modelo-espacial-286"
import { flushPersistentStore, storeGet } from "@/lib/persistent-store"
import { applyMedicalRestrictionsForMatch, normalizePerformanceState, performanceStorageKey } from "@/lib/performance-center"
import { hardNavigate } from "@/lib/hard-navigation"
import {
  type MatchSpeed,
  type MatchEvent,
  type MatchState,
} from "@/lib/match-engine"
import { LivePitch } from "@/components/match/live-pitch"
import { SubstitutionModal, type MatchPlayer, type SubstitutionChange } from "@/components/match/substitution-modal"
import { MatchResultModal } from "@/components/match/match-result-modal"
import { RoundResultsModal } from "@/components/match/round-results-modal"
import { PostMatchPress } from "@/components/match/post-match-press"
import { EventAnimation, type AnimatableEvent } from "@/components/match/event-animations"
import { PenaltyTakerModal } from "@/components/match/penalty-taker-modal"
import { RivaisAoVivoPainel } from "@/components/match/rivais-ao-vivo-painel"
import { jogosQueImportam } from "@/lib/rivais-ao-vivo"
import { ShootoutModal } from "@/components/match/shootout-modal"
import { MatchRadar } from "@/components/match/match-radar"
import { padraoDoEventoDaPartida, vibrar } from "@/lib/vibracao-do-controle"
import { useContextoDeInput, useDicasDeControle } from "@/hooks/use-input"
import { AvisoQuedaPara2D, Campo3D } from "@/components/match/campo-3d"
import { selecionarEventoDoRadar } from "@/lib/radar-evento"
import { useCorDoUniforme } from "@/lib/cor-do-uniforme"
import { useMatchSounds } from "@/hooks/use-match-sounds"
import { clearQueue as clearCommentary, enqueueEvent, initAudio } from "@/lib/audio-commentary"
import { applyPlayedYouthMatch } from "@/lib/youth-career-engine"
import { siglaExibivel } from "@/lib/club-identity"

// ─────────────────────────────────────────────────────────────────────────────
// Converte jogadores reais para o formato MatchPlayer
// ─────────────────────────────────────────────────────────────────────────────

const POSITION_NUMBER_MAP: Record<string, number> = {
  GOL: 1, ZAG: 3, LD: 2, LE: 6, VOL: 5, MEI: 8, ATA: 9, PE: 7, PD: 11,
}

// Hash determinístico por nome de jogador — elimina Math.random() nos atributos
function playerHash(name: string, seed: number): number {
  let h = seed
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0
  return Math.abs(h)
}

// Aloca números de camisa ÚNICOS por time: tenta o número real do jogador, senão o típico
// da posição, senão o próximo livre. Sem isto todo LD virava 2, todo ZAG 3, LE 6 — vários
// jogadores com o mesmo número na tela (foi o bug reportado na tela de pênalti).
function makeNumberAllocator() {
  const used = new Set<number>()
  return (prefer: number | undefined, pos: string): number => {
    for (const c of [prefer, POSITION_NUMBER_MAP[pos]]) {
      if (typeof c === "number" && c > 0 && !used.has(c)) { used.add(c); return c }
    }
    for (let n = 1; n <= 99; n++) { if (!used.has(n)) { used.add(n); return n } }
    return 0
  }
}

function playersToMatchSquad(players: Player[], idOffset = 0): { starters: MatchPlayer[]; bench: MatchPlayer[] } {
  // XI encaixado na formacao (garante defesa/meio/ATAQUE completos, nao corta o centroavante).
  const { starters: xi, bench: benchPool } = pickStartingXI(players, (p) => p.pos, (p) => p.base)
  const num = makeNumberAllocator()
  const starters: MatchPlayer[] = xi.map((p, i) => {
    const h = (seed: number) => playerHash(p.nome, seed)
    const isGK = p.pos === "GOL"
    const isAtt = ["ATA", "PE", "PD", "SA", "CA"].includes(p.pos)
    return {
      id: idOffset + i + 1,
      name: p.nome,
      number: num(undefined, p.pos),
      position: p.pos,
      rating: p.base,
      stamina: 100,
      // Atributos EDITADOS (editor de jogador) tem prioridade; senao sintetiza do overall.
      pace:      p.pace      ?? (isGK ? 50 : 65 + (h(1) % 25)),
      shooting:  p.shooting  ?? shootingForPosition(p.base, p.pos),
      passing:   p.passing   ?? (55 + (h(3) % 30)),
      dribbling: p.dribbling ?? (isGK ? 30 : 50 + (h(4) % 35)),
      defending: p.defending ?? (isAtt ? 30 + (h(5) % 20) : 60 + (h(6) % 25)),
      physical:  p.physical  ?? (60 + (h(7) % 25)),
    }
  })
  const bench: MatchPlayer[] = benchPool.map((p, i) => ({
    id: idOffset + 100 + i + 1,
    name: p.nome,
    number: num(undefined, p.pos),
    position: p.pos,
    rating: p.base,
    stamina: 100,
  }))
  return { starters, bench }
}

// Converte jogadores do game-engine para MatchPlayer
function enginePlayersToMatchSquad(
  players: EnginePlayer[],
  idOffset = 0,
  formation = "4-3-3",
  /** Posicoes que o tecnico arrastou no campinho, por NOME (como o motor guarda). */
  posicoesDoTecnico: Record<string, { x: number; y: number }> = {},
): { starters: MatchPlayer[]; bench: MatchPlayer[] } {
  // SUSPENSO nao entra em campo (realismo FM): fica fora ate cumprir a punicao.
  const available = players.filter(p => !p.injury && !p.calledUp && (p.suspendedMatches ?? 0) <= 0)

  // A ESCALACAO SALVA MANDA — e o que sobra dela tambem.
  //
  // Isto era TUDO OU NADA: `if (manual.length >= 11)` usava o XI do tecnico,
  // senao remontava do zero por overall. Bastava UM dos onze ficar indisponivel
  // (lesao na semana, convocacao, suspensao) para a lista cair para dez, a
  // condicao falhar e as OUTRAS DEZ escolhas irem junto para o lixo — e o
  // remonte automatico, que ordena por overall, trazia de volta exatamente os
  // reservas que o tecnico tinha acabado de tirar. Era o relato "salvo a
  // escalacao e os jogadores que tirei continuam jogando".
  const manual = available.filter(p => p.isStarter === true)
  let xi: EnginePlayer[]
  let benchPool: EnginePlayer[]
  if (manual.length >= 11) {
    // A escalação manual é uma decisão do treinador, não um ranking de overall.
    // Ordenamos os MESMOS 11 pelos slots da formação, preservando o titular e a
    // posição que ele deve ocupar no campo/radar.
    const declared = manual.slice(0, 11)
    xi = assignPlayersToFormation(declared, formation).map(player => player as EnginePlayer)
    const xiIds = new Set(xi.map(player => player.id))
    benchPool = available.filter(player => !xiIds.has(player.id))
  } else if (manual.length > 0) {
    // Faltou gente: PRESERVA quem o tecnico escolheu e completa so os buracos,
    // pela posicao do slot vago.
    const completo = completarEscalacao(manual, available, formation, p => p.position, p => p.overall)
    xi = assignPlayersToFormation(completo.starters, formation).map(player => player as EnginePlayer)
    const xiIds = new Set(xi.map(player => player.id))
    benchPool = available.filter(player => !xiIds.has(player.id))
  } else {
    // Nenhuma escolha salva: monta automatico.
    const picked = pickStartingXI(available, (p) => p.position, (p) => p.overall, formation)
    xi = picked.starters
    benchPool = picked.bench
  }

  const num = makeNumberAllocator()
  // assignPlayersToFormation ja aceitava posicoes customizadas, mas ninguem
  // passava: o motor guarda por NOME e a funcao espera por ID. Era por isso que
  // arrastar o jogador no campinho nao refletia na partida nem no radar.
  const porId: Record<number, { x: number; y: number }> = {}
  for (const p of xi) {
    const custom = posicoesDoTecnico[p.name]
    if (custom) porId[p.id] = custom
  }
  const slotted = assignPlayersToFormation(xi, formation, porId)
  const starters: MatchPlayer[] = slotted.map((p, i) => ({
    id: idOffset + i + 1,
    atletaId: p.id,
    posicoesSecundarias: p.secondaryPositions,
    name: p.name,
    number: num(p.shirtNumber, p.position),
    position: p.position,
    rating: p.overall,
    stamina: p.energy,
    pace: p.pace,
    shooting: p.shooting,
    passing: p.passing,
    dribbling: p.dribbling,
    defending: p.defending,
    physical: p.physical,
    tacticalSlot: i,
    // ONDE ELE VAI JOGAR. `slotPos` sozinho nao servia: o encaixe da a cada
    // atleta o slot da PROPRIA posicao dele, entao `pos` e `posNatural` saiam
    // sempre iguais e a penalidade de improvisacao NUNCA disparava no motor —
    // arrastar o goleiro para a zaga nao mudava nada em campo.
    //
    // A coordenada so manda quando o tecnico REALMENTE moveu o atleta: nas
    // posicoes padrao do template ela poderia cair numa faixa vizinha (um VOL
    // desenhado um pouco a frente virando MEI) e cobrar uma penalidade que
    // ninguem pediu.
    formationPosition: porId[p.id] ? posicaoPelaCoordenada(p.x, p.y) : p.slotPos,
    fieldX: p.x,
    fieldY: p.y,
  }))

  const bench: MatchPlayer[] = benchPool.map((p, i) => ({
    id: idOffset + 100 + i + 1,
    atletaId: p.id,
    posicoesSecundarias: p.secondaryPositions,
    name: p.name,
    number: num(p.shirtNumber, p.position),
    position: p.position,
    rating: p.overall,
    stamina: p.energy,
    pace: p.pace,
    shooting: p.shooting,
    passing: p.passing,
    dribbling: p.dribbling,
    defending: p.defending,
    physical: p.physical,
  }))

  return { starters, bench }
}

// ─────────────────────────────────────────────────────────────────────────────
// Velocidades de simulacao
// ─────────────────────────────────────────────────────────────────────────────

const SPEEDS: { id: MatchSpeed; label: string; sublabel: string }[] = [
  { id: "normal", label: "1x", sublabel: "Normal" },
  { id: "fast", label: "3x", sublabel: "Rapido" },
  { id: "ultra", label: "5x", sublabel: "Ultra" },
]

// ─────────────────────────────────────────────────────────────────────────────
// Utilitarios
// ─────────────────────────────────────────────────────────────────────────────

function ratioFor(home: number, away: number) {
  if (home + away === 0) return 50
  return Math.round((home / (home + away)) * 100)
}

function deriveFormation(squad: MatchPlayer[]): string {
  const def = squad.filter(p => ["LD", "LE", "ZAG"].includes(p.position)).length
  const mid = squad.filter(p => ["VOL", "MEI"].includes(p.position)).length
  const att = squad.filter(p => ["PE", "PD", "ATA", "SA"].includes(p.position)).length
  return `${def}-${mid}-${att}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Componentes auxiliares - Estilo EA FC
// ─────────────────────────────────────────────────────────────────────────────

// Stat lateral grande - estilo EA FC
// Coluna lateral de ESCALAÇÃO com barra de condição — recria a leitura da
// referência (FIFA26/16.png): os titulares dos dois times ladeando o campo, com
// a barra de energia que drena ao longo do jogo (mesma fonte da aba Preparo).
// À direita a linha é espelhada (barra | nome | número), como na referência.
function SideLineup({ team, squad, bench = [], side }: { team: Team; squad: MatchPlayer[]; bench?: MatchPlayer[]; side: "left" | "right" }) {
  /**
   * TITULARES ↔ RESERVAS (pedido).
   *
   * A coluna só sabia mostrar os onze. O banco existia no estado da partida
   * (`homeBench`/`awayBench`, a mesma lista que alimenta o modal de
   * substituição) e não aparecia em lugar nenhum durante o jogo: para saber
   * quem estava aquecido — e com qual condição — era preciso ABRIR o modal de
   * substituição, que é uma ação, não uma consulta.
   *
   * A troca é local a cada coluna de propósito: dá para olhar o banco do
   * adversário sem perder de vista os seus onze.
   */
  const [aba, setAba] = useState<"titulares" | "reservas">("titulares")
  const xi = squad.slice(0, 11)
  const lista = aba === "titulares" ? xi : bench
  const alinhadoADireita = side === "right"

  return (
    <div className="flex w-full flex-col">
      <div className={cn("mb-2 flex items-center gap-2 border-b border-white/[0.06] pb-2", alinhadoADireita && "flex-row-reverse")}>
        <TeamCrest team={team} size="xs" />
        <span className="truncate text-[11px] font-bold uppercase tracking-wider text-white/70">{siglaExibivel(team.curto, team.nome)}</span>
      </div>

      {/* Alternador. Duas metades de largura igual — o rótulo ativo é o título
          da lista, então ele substitui o "Titulares" solto que ficava no topo. */}
      <div className={cn("mb-2 flex rounded-md border border-white/[0.06] bg-white/[0.03] p-0.5", alinhadoADireita && "flex-row-reverse")}>
        {(["titulares", "reservas"] as const).map(chave => (
          <button
            key={chave}
            type="button"
            onClick={() => setAba(chave)}
            aria-pressed={aba === chave}
            className={cn(
              "flex-1 rounded-[3px] px-1 py-1 text-[9px] font-semibold uppercase tracking-wider transition-colors",
              aba === chave ? "bg-white/10 text-white" : "text-white/35 hover:text-white/70",
            )}
          >
            {chave === "titulares" ? "Titulares" : `Reservas${bench.length ? ` (${bench.length})` : ""}`}
          </button>
        ))}
      </div>

      <div className="flex flex-col">
        {lista.length === 0 && (
          <span className="py-2 text-[10px] text-white/30">Banco não informado.</span>
        )}
        {lista.map((p) => {
          const cond = Math.round(p.stamina ?? 100)
          return (
            <div key={p.id} className={cn("flex items-center gap-2 py-[3px]", alinhadoADireita && "flex-row-reverse")}>
              <span className="w-4 shrink-0 text-center text-[10px] tabular-nums text-white/35">{p.number}</span>
              <span className={cn(
                "min-w-0 flex-1 truncate text-[11px]",
                // Reserva é quem AINDA não entrou: cinza para a leitura de
                // relance não confundir as duas listas.
                aba === "titulares" ? "text-white" : "text-white/60",
                alinhadoADireita && "text-right",
              )}>{p.name}</span>
              <div className="h-1 w-12 shrink-0 overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn("h-full rounded-full transition-all", cond > 70 ? "bg-emerald-500" : cond > 40 ? "bg-amber-500" : "bg-red-500")}
                  style={{ width: `${cond}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Barra de estatistica comparativa - estilo EA FC
function StatBar({ label, homeValue, awayValue, suffix = "" }: { 
  label: string
  homeValue: number
  awayValue: number
  suffix?: string
}) {
  const total = (homeValue || 0) + (awayValue || 0)
  const homePercent = total > 0 ? ((homeValue || 0) / total) * 100 : 50
  const awayPercent = total > 0 ? ((awayValue || 0) / total) * 100 : 50
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-white font-bold tabular-nums">{homeValue ?? 0}{suffix}</span>
        <span className="text-white/50 uppercase tracking-wider text-[10px]">{label}</span>
        <span className="text-white font-bold tabular-nums">{awayValue ?? 0}{suffix}</span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-white/10">
        <div 
          className="bg-[var(--brand)] transition-all duration-500"
          style={{ width: `${homePercent}%` }}
        />
        <div 
          className="bg-white/40 transition-all duration-500"
          style={{ width: `${awayPercent}%` }}
        />
      </div>
    </div>
  )
}

// Evento de substituicao na timeline
function SubstitutionEvent({ 
  minute, 
  playerOut, 
  playerIn, 
  side 
}: { 
  minute: number
  playerOut: string
  playerIn: string
  side: "home" | "away"
}) {
  const isHome = side === "home"
  return (
    <div className={cn("flex items-center gap-3", isHome ? "flex-row" : "flex-row-reverse")}>
      <div className={cn("flex flex-col", isHome ? "items-end" : "items-start")}>
        <span className="text-white/90 text-sm font-medium">{playerOut}</span>
        <span className="text-white/50 text-xs">{playerIn}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <ArrowDownUp className="w-3.5 h-3.5 text-[var(--brand)]" />
      </div>
      <span className="text-white/60 text-sm font-bold tabular-nums">{minute}&apos;</span>
    </div>
  )
}

// Componente generico de evento na timeline
function TimelineEvent({ event, homeTeam, awayTeam }: { 
  event: { 
    minute: number
    type: string
    side: "home" | "away"
    player?: string
    playerOut?: string
    playerIn?: string
    text?: string
  }
  homeTeam: string
  awayTeam: string
}) {
  const isHome = event.side === "home"
  const teamName = isHome ? homeTeam : awayTeam
  
  // Icone e cor baseados no tipo de evento
  const getEventIcon = () => {
    switch (event.type) {
      case "goal":
        return (
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
              <circle cx="12" cy="12" r="4" fill="currentColor"/>
            </svg>
          </div>
        )
      case "yellow_card":
        return (
          <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
            <div className="w-3 h-4 bg-yellow-400 rounded-sm" />
          </div>
        )
      case "red_card":
        return (
          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
            <div className="w-3 h-4 bg-red-500 rounded-sm" />
          </div>
        )
      case "substitution":
        return (
          <div className="w-8 h-8 rounded-full bg-[var(--brand)]/20 flex items-center justify-center flex-shrink-0">
            <ArrowDownUp className="w-4 h-4 text-[var(--brand)]" />
          </div>
        )
      case "penalty":
        return (
          <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-amber-400 text-xs font-bold">PEN</span>
          </div>
        )
      case "var":
        return (
          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-blue-400 text-xs font-bold">VAR</span>
          </div>
        )
      default:
        return null
    }
  }
  
  // Texto do evento
  const getEventText = () => {
    switch (event.type) {
      case "goal":
        return (
          <div className={cn("flex flex-col", isHome ? "items-end" : "items-start")}>
            <span className="text-emerald-400 text-sm font-bold uppercase">GOL!</span>
            <span className="text-white/90 text-sm font-medium">{event.player || teamName}</span>
          </div>
        )
      case "yellow_card":
        return (
          <div className={cn("flex flex-col", isHome ? "items-end" : "items-start")}>
            <span className="text-yellow-400 text-sm font-bold">Cartao Amarelo</span>
            <span className="text-white/70 text-xs">{event.player || teamName}</span>
          </div>
        )
      case "red_card":
        return (
          <div className={cn("flex flex-col", isHome ? "items-end" : "items-start")}>
            <span className="text-red-400 text-sm font-bold">Cartao Vermelho</span>
            <span className="text-white/70 text-xs">{event.player || teamName}</span>
          </div>
        )
      case "substitution":
        return (
          <div className={cn("flex flex-col", isHome ? "items-end" : "items-start")}>
            <span className="text-[var(--brand)] text-xs font-medium uppercase">Substituição</span>
            <span className="text-white/90 text-sm">{event.playerOut || "Saiu"}</span>
            <span className="text-white/50 text-xs">{event.playerIn || "Entrou"}</span>
          </div>
        )
      case "penalty":
        return (
          <div className={cn("flex flex-col", isHome ? "items-end" : "items-start")}>
            <span className="text-amber-400 text-sm font-bold">Pênalti</span>
            <span className="text-white/70 text-xs">{event.player || teamName}</span>
          </div>
        )
      case "var":
        return (
          <div className={cn("flex flex-col", isHome ? "items-end" : "items-start")}>
            <span className="text-blue-400 text-sm font-bold">Revisao VAR</span>
            <span className="text-white/70 text-xs">{event.text || "Checando..."}</span>
          </div>
        )
      default:
        return null
    }
  }
  
  return (
    <div className={cn(
      "flex items-center gap-3 py-2 px-4",
      isHome ? "justify-start" : "justify-end"
    )}>
      {isHome && (
        <>
          <span className="text-white/50 text-sm font-bold tabular-nums w-10">{event.minute}&apos;</span>
          {getEventIcon()}
          {getEventText()}
        </>
      )}
      {!isHome && (
        <>
          {getEventText()}
          {getEventIcon()}
          <span className="text-white/50 text-sm font-bold tabular-nums w-10 text-right">{event.minute}&apos;</span>
        </>
      )}
    </div>
  )
}

// Tab button estilo EA FC
function TabButton({ 
  label, 
  active, 
  onClick, 
  shortcut 
}: { 
  label: string
  active?: boolean
  onClick?: () => void
  shortcut?: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-sm font-medium transition-colors relative",
        active 
          ? "text-white" 
          : "text-white/40 hover:text-white/60"
      )}
    >
      {shortcut && (
        <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[8px] bg-white/10 px-1.5 py-0.5 rounded text-white/50">
          {shortcut}
        </span>
      )}
      {label}
      {active && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente Principal
// ─────────────────────────────────────────────────────────────────────────────

export default function PartidaAoVivoPage() {
  const { state: savedGame, setState: setSavedGame } = useGameState()
  const { addNotification } = useNotifications()
  const { team: _userTeamHook } = useUserTeam()
  const userTeamId = _userTeamHook.curto
  const { currentMatch, seasonCalendar, currentStandings, registerUserMatchResult, advanceWeek, temPartidaPendenteNaSemana } = useGameManager()
  const { squadPlayers: enginePlayers, formation: savedFormation, teamTactics, tacticalPlayerPositions, processarDesempenhoPartida, squadCohesion } = useGameEngine()
  const bonusEntrosamento = Math.round(Math.max(0, ((squadCohesion ?? 60) - 60)) / 8)
  const engineMatchResults = useGameEngine(s => s.matchResults)
  const engineSeason = useGameEngine(s => s.currentSeason)
  const engineSetPieceTakers = useGameEngine(s => s.setPieceTakers)
  const engineTacticalAssignments = useGameEngine(s => s.tacticalAssignments)
  const medicalRestrictions = useMemo(() => {
    try {
      const raw = storeGet(performanceStorageKey(userTeamId, engineSeason))
      return normalizePerformanceState(raw ? JSON.parse(raw) : null).medicalRestrictions
    } catch { return {} }
  }, [userTeamId, engineSeason])
  const matchEnginePlayers = useMemo(
    () => applyMedicalRestrictionsForMatch(enginePlayers, medicalRestrictions),
    [enginePlayers, medicalRestrictions],
  )
  // Mantém a identidade da partida encerrada mesmo depois de advanceWeek trocar o
  // próximo confronto; o modal da rodada precisa dessa chave estável.
  const [finalMatch, setFinalMatch] = useState<{ home: Team; away: Team; userSide: "home" | "away" } | null>(null)
  // Resultados de todas as competicoes que rodaram nesta rodada (para a tela pos-jogo)
  /**
   * Resultados da rodada que ACABOU de ser jogada.
   *
   * BUG que isto corrige ("a tela de resultados da rodada nao funciona"): o filtro era
   *
   *     r.season === engineSeason && r.week === engineWeek
   *
   * mas o jogo tem DOIS contadores de semana diferentes — `saveState.week` (save) e
   * `gameEngine.currentWeek` (engine) — e o resultado e GRAVADO com `saveState.week + 1`
   * (ver registerUserMatchResult). Filtrar pelo contador do engine quase nunca casava com
   * a semana em que o resultado foi salvo, entao roundResults vinha VAZIO: o modal abria
   * em branco, o que na pratica e o mesmo que nao funcionar.
   *
   * Em vez de tentar sincronizar os dois contadores (fragil), derivamos a rodada dos
   * PROPRIOS resultados: a que acabou de ser jogada e a de maior semana registrada.
   */
  const roundResults = useMemo(() => {
    const targetHome = finalMatch?.home.curto ?? currentMatch?.homeTeam.curto
    const targetAway = finalMatch?.away.curto ?? currentMatch?.awayTeam.curto
    if (!targetHome || !targetAway) return []
    const daTemporada = engineMatchResults.filter(r => r.season === engineSeason)
    const userResult = [...daTemporada].reverse().find(result =>
      result.homeTeam === targetHome && result.awayTeam === targetAway,
    )
    if (!userResult) return []
    return daTemporada
      // TODAS as competicoes que rodaram nesta semana, nao so a que eu disputei.
      // O filtro tinha `&& r.competition === userResult.competition`, entao a
      // tela chamada "Resultados da Rodada" mostrava apenas o Paulista enquanto
      // Brasileirao, Copa do Brasil e Sul-Americana corriam no mesmo periodo e
      // ficavam invisiveis.
      .filter(r => r.week === userResult.week)
      // Um clube joga UMA vez por rodada. Se outro resultado da mesma rodada
      // envolver o meu time, ele nao pode ser meu — e uma partida que o motor
      // resolveu por engano — e mostrar os dois foi o relato "ao terminar a
      // partida, exibe o resultado de outra partida". A que vale e a que acabou
      // de ser disputada.
      .filter(r => r === userResult || (r.homeTeam !== targetHome && r.homeTeam !== targetAway
        && r.awayTeam !== targetHome && r.awayTeam !== targetAway))
      .map(r => ({
        competition: r.competition,
        homeTeam: r.homeTeam,
        awayTeam: r.awayTeam,
        homeScore: r.homeScore,
        awayScore: r.awayScore,
      }))
      // Os demais estaduais correm na mesma janela do ano e o motor nao os
      // simula. Sem eles a tela dizia "Resultados da Rodada" mostrando um
      // campeonato so, como se o resto do pais nao estivesse jogando.
      .concat(outrosEstaduaisDaRodada({
        season: engineSeason,
        week: userResult.week,
        estadoDoUsuario: _userTeamHook.estado ?? "",
        semanasDeEstadual: getStateChampRounds(_userTeamHook.curto),
      }))
  }, [engineMatchResults, engineSeason, finalMatch, currentMatch, _userTeamHook.estado, _userTeamHook.curto])

  const resultRegistered = useRef(false)
  const t = useTranslation()

  // Hydration guard
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { setHydrated(true) }, [])

  // Carrega contexto da partida salva ou usa valores padrao
  const matchCtx = useMemo(() => loadMatchContext(), [])

  // PARTIDA DA SELEÇÃO: gravar o placar de volta na competição.
  //
  // Vai por REF, não direto no efeito do apito final: aquele efeito roda dentro
  // de um closure que já causou congelamento de modal neste arquivo quando
  // capturou callback velho. O ref sempre aponta para a versão atual.
  const { playNextRound: gravarRodadaDaSelecao, nationalTeam: selecaoDoTecnico } = useNationalTeam()
  // Convocação de 23 — a lista que o técnico montou em /selecao/convocacao.
  const selecaoConvocada = useMemo(
    () => (matchCtx.national && selecaoDoTecnico
      ? getNationalSquad(selecaoDoTecnico, {
          cuts: savedGame.nationalCuts ?? [],
          calls: savedGame.nationalCalls ?? [],
        })
      : []),
    [matchCtx.national, selecaoDoTecnico, savedGame.nationalCuts, savedGame.nationalCalls],
  )
  const playNextRoundRef = useRef<typeof gravarRodadaDaSelecao | null>(null)
  useEffect(() => { playNextRoundRef.current = gravarRodadaDaSelecao }, [gravarRodadaDaSelecao])

  // Determina times a partir do contexto salvo. AMISTOSO tem prioridade sobre o jogo da
  // rodada (currentMatch), senao o amistoso acabaria jogando contra o adversario do fixture.
  // PARTIDA DA SELEÇÃO: os dois lados são seleções, não clubes. `getTeamByShort`
  // procura no catálogo de clubes e nunca acha "BRA" — sem esta ponte a tela
  // caía no fallback e mostrava dois times da Série A.
  const selecaoMandante = useMemo(
    () => (matchCtx.national ? timeDaSelecao(matchCtx.national.usuarioEmCasa ? matchCtx.national.selecaoId : matchCtx.national.adversarioId) : null),
    [matchCtx.national],
  )
  const selecaoVisitante = useMemo(
    () => (matchCtx.national ? timeDaSelecao(matchCtx.national.usuarioEmCasa ? matchCtx.national.adversarioId : matchCtx.national.selecaoId) : null),
    [matchCtx.national],
  )

  const homeTeam = useMemo(() => {
    // No apito final o calendário avança e `currentMatch` já aponta para o jogo
    // seguinte. O snapshot impede o placar de trocar A x B por A x C aos 90'.
    if (finalMatch) return finalMatch.home
    if (selecaoMandante) return selecaoMandante
    if ((matchCtx.friendly || matchCtx.youth) && matchCtx.homeShort) return getTeamByShort(matchCtx.homeShort) ?? serieATeams[0]
    if (currentMatch) return currentMatch.homeTeam
    if (matchCtx.homeShort) return getTeamByShort(matchCtx.homeShort) ?? serieATeams[0]
    return getTeamByShort(userTeamId ?? "") ?? serieATeams[0]
  }, [finalMatch, selecaoMandante, currentMatch, matchCtx.friendly, matchCtx.youth, matchCtx.homeShort, userTeamId])

  const awayTeam = useMemo(() => {
    if (finalMatch) return finalMatch.away
    if (selecaoVisitante) return selecaoVisitante
    if ((matchCtx.friendly || matchCtx.youth) && matchCtx.awayShort) return getTeamByShort(matchCtx.awayShort) ?? serieATeams[1]
    if (currentMatch) return currentMatch.awayTeam
    if (matchCtx.awayShort) return getTeamByShort(matchCtx.awayShort) ?? serieATeams[1]
    return serieATeams.find(t => t.curto !== homeTeam.curto) ?? serieATeams[1]
  }, [finalMatch, selecaoVisitante, currentMatch, matchCtx.friendly, matchCtx.youth, matchCtx.awayShort, homeTeam.curto])

  // TORNEIO AMISTOSO: e amistoso (nao conta para a temporada) mas tem nome
  // proprio — mostrar "Amistoso" na Final do torneio que o tecnico montou
  // apagaria justamente o que da sentido ao jogo.
  const displayCompetition = matchCtx.torneio
    ? matchCtx.competition
    : matchCtx.friendly ? "Amistoso" : (matchCtx.youth ? matchCtx.competition : (currentMatch?.competition || matchCtx.competition || "Brasileirao Serie A"))
  // Emblema da competicao para o placar de transmissao (null quando nao ha arte).
  const competitionLogo = getCompetitionLogo(displayCompetition)
  const displayRound = matchCtx.torneio
    ? matchCtx.round
    : matchCtx.youth ? matchCtx.round : (currentMatch ? `Rodada ${currentMatch.round}` : (matchCtx.round || "Rodada 1"))
  // COR DO UNIFORME ESCOLHIDO. Antes vinha so de getKitColors (cor1/cor2 do
  // clube), entao o terceiro uniforme sempre pintava o radar de quase-preto e o
  // visitante branco virava a cor2 cadastrada. Agora a cor sai da ARTE da camisa
  // que a pessoa marcou no pre-jogo; sem arte, cai na estimativa de antes — que
  // e exatamente a cor da camisa desenhada. Ver lib/cor-do-uniforme.
  const homeKitColor = useCorDoUniforme(homeTeam, matchCtx.homeKit ?? "home")
  const awayKitColor = useCorDoUniforme(awayTeam, matchCtx.awayKit ?? "away")

  // Placar agregado de mata-mata. A volta é reconhecida pelo confronto anterior
  // entre o mesmo par de clubes, dentro da mesma competição e temporada. A
  // orientação é sempre a do placar atual (mandante atual à esquerda), mesmo
  // quando ele foi visitante na ida.
  // A ida é buscada no CALENDÁRIO, não na lista de resultados, porque só o fixture
  // guarda a FASE do confronto — e a fase é o que separa um confronto de ida e
  // volta de dois jogos soltos entre os mesmos clubes.
  //
  // Filtrando apenas por competição + par de clubes, a fase de grupos vazava para
  // o mata-mata: quem enfrentou o adversário no grupo e o reencontrava numa
  // semifinal de JOGO ÚNICO (Paulistão A1: quartas e semi são de um jogo só) via
  // um "Agregado" que somava o jogo do grupo. Exigindo a MESMA fase, ida e volta
  // se reconhecem (ambas têm stage "final", "semifinal"…) e o jogo único não
  // encontra par — que é exatamente o correto.
  const previousLeg = useMemo(() => {
    if (
      !currentMatch ||
      matchCtx.friendly ||
      matchCtx.youth ||
      !currentMatch.stage ||
      currentMatch.stage === "fase_classificatoria" ||
      !["cup", "continental", "state"].includes(currentMatch.competitionType)
    ) return null
    return seasonCalendar.fixtures
      .filter(fixture =>
        fixture.played &&
        fixture.homeScore != null &&
        fixture.awayScore != null &&
        fixture.competition === currentMatch.competition &&
        fixture.stage === currentMatch.stage &&
        fixture.week < currentMatch.week &&
        (
          (fixture.homeTeam.curto === homeTeam.curto && fixture.awayTeam.curto === awayTeam.curto) ||
          (fixture.homeTeam.curto === awayTeam.curto && fixture.awayTeam.curto === homeTeam.curto)
        ),
      )
      .sort((a, b) => b.week - a.week)
      .map(fixture => ({
        homeTeam: fixture.homeTeam.curto,
        homeScore: fixture.homeScore ?? 0,
        awayScore: fixture.awayScore ?? 0,
      }))[0] ?? null
  }, [
    currentMatch,
    matchCtx.friendly,
    matchCtx.youth,
    seasonCalendar.fixtures,
    homeTeam.curto,
    awayTeam.curto,
  ])

  // Gols da IDA já orientados como o placar ATUAL (mandante de hoje à esquerda),
  // mesmo que hoje o mando esteja invertido. O agregado em si só pode ser somado
  // depois que `state` existe — ver `aggregateScore`, adiante.
  const firstLeg = previousLeg ? {
    home: previousLeg.homeTeam === homeTeam.curto ? previousLeg.homeScore : previousLeg.awayScore,
    away: previousLeg.homeTeam === awayTeam.curto ? previousLeg.homeScore : previousLeg.awayScore,
  } : null

  // Determina qual lado e o do usuario
  const userTeam = useMemo(() => {
    return getTeamByShort(userTeamId ?? "") ?? serieATeams[0]
  }, [userTeamId])
  
  const isHome = homeTeam.curto === userTeam.curto
  const userSide: "home" | "away" = isHome ? "home" : "away"

  // Squads
  const [homeSquad, setHomeSquad] = useState<MatchPlayer[]>([])
  const [awaySquad, setAwaySquad] = useState<MatchPlayer[]>([])
  const [homeBench, setHomeBench] = useState<MatchPlayer[]>([])
  const [awayBench, setAwayBench] = useState<MatchPlayer[]>([])

  useEffect(() => {
    // getPlayersForTeam garante um elenco jogavel e repoe lacunas por setor com
    // atletas vinculados ao proprio clube. Nunca mascara save/dado ausente com o
    // antigo XI fixo Silva/Santos/Oliveira, que podia aparecer numa partida real.
    const buildSideFromData = (team: typeof homeTeam, offset: number, _prefix: string) => {
      const players = getPlayersForTeam(team)
      return playersToMatchSquad(players, offset)
    }

    // O game-engine so fornece o elenco do time do usuario. O adversario sempre
    // vem dos dados reais, garantindo que AMBOS os lados sejam preenchidos
    // (radar, condicao fisica e notas dependem disso).
    if (matchCtx.youth && savedGame.youthPlayers?.length) {
      const selectedIds = new Set(savedGame.youthCareer?.startingPlayerIds ?? savedGame.youthPlayers.slice(0, 11).map(player => player.id))
      const ordered = [...savedGame.youthPlayers.filter(player => selectedIds.has(player.id)), ...savedGame.youthPlayers.filter(player => !selectedIds.has(player.id))]
      const converted = ordered.map((player, index) => ({ id: index + 1, name: player.name, position: player.position, overall: player.overall, energy: 100, pace: player.pace ?? player.overall, shooting: player.shooting ?? shootingForPosition(player.overall, player.position), passing: player.passing ?? player.overall, dribbling: player.dribbling ?? player.overall, defending: player.defending ?? player.overall, physical: player.physical ?? player.overall, isStarter: selectedIds.has(player.id), shirtNumber: index + 1, injury: null, calledUp: false } as unknown as EnginePlayer))
      const youthSquad = enginePlayersToMatchSquad(converted, isHome ? 0 : 200, savedFormation ?? "4-3-3")
      const opponent = buildSideFromData(isHome ? awayTeam : homeTeam, isHome ? 200 : 0, "SUB20_")
      if (isHome) { setHomeSquad(youthSquad.starters); setHomeBench(youthSquad.bench); setAwaySquad(opponent.starters); setAwayBench(opponent.bench) }
      else { setAwaySquad(youthSquad.starters); setAwayBench(youthSquad.bench); setHomeSquad(opponent.starters); setHomeBench(opponent.bench) }
    } else if (matchCtx.national && selecaoConvocada.length > 0) {
      // SELEÇÃO: quem entra em campo é a CONVOCAÇÃO, não o elenco do clube.
      // `enginePlayers` é sempre o plantel do clube — sem este ramo o técnico
      // jogava a Copa com os jogadores do seu time vestindo o escudo do país.
      // Mesma conversão do ramo da base, que já resolve o caso "atletas que não
      // vivem no game-engine".
      const convocados = selecaoConvocada.map((jogador, indice) => ({
        id: indice + 1,
        name: jogador.nome,
        position: jogador.pos,
        overall: jogador.base,
        energy: 100,
        pace: jogador.base,
        shooting: shootingForPosition(jogador.base, jogador.pos),
        passing: jogador.base,
        dribbling: jogador.base,
        defending: jogador.base,
        physical: jogador.base,
        // A convocação vem ordenada por setor e nota; os onze primeiros começam.
        isStarter: indice < 11,
        shirtNumber: indice + 1,
        injury: null,
        calledUp: false,
      } as unknown as EnginePlayer))
      const userSquad = enginePlayersToMatchSquad(convocados, isHome ? 0 : 200, savedFormation ?? "4-3-3")
      if (isHome) {
        const opp = buildSideFromData(awayTeam, 200, "A_")
        setHomeSquad(userSquad.starters); setHomeBench(userSquad.bench)
        setAwaySquad(opp.starters); setAwayBench(opp.bench)
      } else {
        const opp = buildSideFromData(homeTeam, 0, "H_")
        setAwaySquad(userSquad.starters); setAwayBench(userSquad.bench)
        setHomeSquad(opp.starters); setHomeBench(opp.bench)
      }
    } else if (matchEnginePlayers.length > 0) {
      const userSquad = enginePlayersToMatchSquad(matchEnginePlayers, isHome ? 0 : 200, savedFormation ?? "4-3-3", tacticalPlayerPositions ?? {})
      if (isHome) {
        const opp = buildSideFromData(awayTeam, 200, "A_")
        setHomeSquad(userSquad.starters)
        setHomeBench(userSquad.bench)
        setAwaySquad(opp.starters)
        setAwayBench(opp.bench)
      } else {
        const opp = buildSideFromData(homeTeam, 0, "H_")
        setAwaySquad(userSquad.starters)
        setAwayBench(userSquad.bench)
        setHomeSquad(opp.starters)
        setHomeBench(opp.bench)
      }
    } else {
      // Fallback para players-data nos dois times
      const home = buildSideFromData(homeTeam, 0, "H_")
      const away = buildSideFromData(awayTeam, 200, "A_")
      setHomeSquad(home.starters)
      setHomeBench(home.bench)
      setAwaySquad(away.starters)
      setAwayBench(away.bench)
    }
  }, [matchEnginePlayers, homeTeam.curto, awayTeam.curto, isHome, matchCtx.youth, matchCtx.national, selecaoConvocada, savedGame.youthPlayers, savedGame.youthCareer?.startingPlayerIds, savedFormation, tacticalPlayerPositions])

  // Familiaridade JA APRENDIDA por atleta. So o que evoluiu mora no save; o
  // resto do perfil e derivado do id a cada leitura (lib/modelo-de-jogador.ts).
  const progressoDePerfil = useMemo(() => {
    const mapa: Record<number, ProgressoDoPerfil | undefined> = {}
    for (const atleta of matchEnginePlayers) mapa[atleta.id] = atleta.perfilProgresso
    return mapa
  }, [matchEnginePlayers])

  // CARACTERISTICAS marcadas a mao no editor, por atleta do NOSSO elenco. O que
  // nao estiver aqui e derivado do id + perfil de atributos, dentro de
  // `toSquadPlayer`. Ver lib/caracteristicas-do-atleta.ts.
  const traitsDoEditor = useMemo(() => {
    const mapa: Record<number, string[] | undefined> = {}
    for (const atleta of matchEnginePlayers) mapa[atleta.id] = atleta.traits
    return mapa
  }, [matchEnginePlayers])

  const toSquadPlayer = (p: MatchPlayer) => {
    // PERFIL CANONICO (1.0.293). Sem `atletaId` nada disto e calculado e o motor
    // volta ao comportamento anterior — e o caso dos elencos gerados na hora
    // (amistoso rapido, adversario sem elenco no save).
    const slot = p.formationPosition ?? p.position
    const perfil = typeof p.atletaId === "number"
      ? perfilDoAtleta(p.atletaId, p.position, p.rating, p.posicoesSecundarias ?? [])
      : null
    const progresso = typeof p.atletaId === "number" ? progressoDePerfil[p.atletaId] : undefined
    // CARACTERISTICAS (1.0.298). Derivadas do id + perfil de atributos dele, com
    // a marcacao do editor vencendo quando existe. Viram PESO DE SORTEIO no
    // motor — quem cabeceia o escanteio, quem puxa o contra-ataque — e nao
    // qualidade extra: a conta de forca do time nao muda uma virgula.
    const caracteristicas = typeof p.atletaId === "number"
      ? caracteristicasDoAtleta(
          p.atletaId, p.position,
          {
            pace: p.pace ?? p.rating, shooting: p.shooting ?? p.rating,
            passing: p.passing ?? p.rating, dribbling: p.dribbling ?? p.rating,
            defending: p.defending ?? p.rating, physical: p.physical ?? p.rating,
          },
          p.rating,
          traitsDoEditor[p.atletaId],
        )
      : []
    const pesos = pesosDeLance(caracteristicas)
    return {
    nome: p.name,
    // `pos` = onde ele ESTA jogando (slot da formacao, quando conhecido);
    // `posNatural` = onde ele joga de verdade. Quando diferem, o motor aplica a
    // penalidade de improvisacao — sem estas duas linhas o sistema existiria e
    // nunca dispararia, que e o defeito que esta versao esta corrigindo.
    pos: p.formationPosition ?? p.position,
    posNatural: p.position,
    rating: p.rating,
    stamina: p.stamina,
    shooting: p.shooting,
    passing: p.passing,
    pace: p.pace,
    defending: p.defending,
    physical: p.physical,
    dribbling: p.dribbling,
    // Os tres campos do modelo canonico. `undefined` quando nao ha perfil, o que
    // faz o motor cair exatamente no calculo de antes.
    familiaridade: perfil ? familiaridadeEm(perfil, progresso, slot) : undefined,
    forcaGoleiro: perfil ? (forcaDeGoleiro(perfil, caracteristicas) ?? undefined) : undefined,
    forcaGoleiroAlto: perfil ? (forcaDeGoleiroNoAlto(perfil, caracteristicas) ?? undefined) : undefined,
    pesoLesao: perfil ? pesoDeLesao(perfil) : undefined,
    // Pesos das caracteristicas. Sem perfil (elenco gerado na hora) ficam
    // `undefined` e o motor volta ao sorteio uniforme de antes da 1.0.298.
    pesoFinalizar: perfil ? pesos.pesoFinalizar : undefined,
    pesoAereo: perfil ? pesos.pesoAereo : undefined,
    pesoCriar: perfil ? pesos.pesoCriar : undefined,
    pesoVelocidade: perfil ? pesos.pesoVelocidade : undefined,
    multChute: perfil ? pesos.multChute : undefined,
    multCabeceio: perfil ? pesos.multCabeceio : undefined,
    pesoPenalti: perfil ? pesoDePenalti(caracteristicas) : undefined,
    }
  }

  // Mentalidade do time do USUARIO, mudavel DURANTE a partida (o motor le config ao vivo,
  // entao vale ja no proximo lance / no 2o tempo). Ofensivo = mais ataque, menos solidez.
  const initialMentality = teamTactics.mentality === "muito_defensivo" ? "defensivo" : teamTactics.mentality === "muito_ofensivo" ? "ofensivo" : teamTactics.mentality
  const [userMentality, setUserMentality] = useState<"defensivo" | "equilibrado" | "ofensivo">(initialMentality)

  // Postura do lado da MAQUINA. Clube sem entrada joga equilibrado — o save só
  // guarda quem oscilou.
  const posturasDaIA = savedGame.posturasDaIA
  const posturaDaIA = useCallback(
    (curto?: string): "defensivo" | "equilibrado" | "ofensivo" =>
      (curto && posturasDaIA?.[curto]) || "equilibrado",
    [posturasDaIA],
  )
  const nivelDificuldade = useMemo(() => nivelDeDificuldade(savedGame.dificuldade), [savedGame.dificuldade])
  // A formação pode ser alterada durante a partida sem alterar a escalação salva
  // para a próxima rodada. O radar e o plano de jogo leem este estado ao vivo.
  const [liveFormation, setLiveFormation] = useState(savedFormation ?? "4-3-3")
  const [liveTacticNotice, setLiveTacticNotice] = useState<string | null>(null)

  const applyLiveFormation = (formation: string) => {
    setLiveFormation(formation)
    setLiveTacticNotice(`${formation} aplicado em campo`)
    window.setTimeout(() => setLiveTacticNotice(null), 2600)
  }

  /**
   * Antes este calculo vivia aqui e olhava UM campo: `playingStyle`. Os outros
   * doze controles da tela de Taticas nao mudavam nada no placar — o jogador
   * escolhia marcacao, linha e saida de bola por nada. Agora sai inteiro de
   * `lib/forcas-taticas.ts`, que preserva estes mesmos numeros para o estilo
   * (a calibracao do motor nao muda) e soma os demais como TROCA, com teto.
   */
  // O TÉCNICO ENTRA AQUI, na coerência — ver lib/efeito-do-treinador.ts.
  const tecnico = useMemo(() => efeitosDoTreinador(), [])
  const tacticalForces = useMemo(
    () => forcasDaTatica(teamTactics, tecnico.coerenciaTatica),
    [teamTactics, tecnico.coerenciaTatica],
  )

  /** A identidade da IA agora chega ao motor inteiro, não apenas como rótulo de
   * mentalidade. Pressão, risco, bloco e transição variam por adversário. */
  const cpuMatchProfile = useCallback((team: Team) => {
    const posture = posturaDaIA(team.curto)
    const forcedIdentity: TacticalIdentity | undefined = posture === "ofensivo"
      ? "ofensivo"
      : posture === "defensivo" ? "retranca" : undefined
    const tactic = aiTacticForClub(team.curto, forcedIdentity)
    const modifiers = applyTacticModifiers(tactic)
    const pressingLoad = tactic.press === "tudo_ou_nada" ? 1
      : tactic.press === "alta" ? 0.72
        : tactic.press === "moderada" ? 0.42 : 0.12
    const transitionLoad = tactic.identity === "pressao_alta" ? 0.9
      : tactic.identity === "contra_ataque" || tactic.identity === "ofensivo" ? 0.7
        : tactic.identity === "retranca" ? 0.25 : 0.45
    const socialModifier = aiClubSocialMatchModifier(savedGame.socialDaIA?.[team.curto])
    return { tactic, modifiers, pressingLoad, transitionLoad, socialModifier }
  }, [posturaDaIA, savedGame.socialDaIA])
  const homeCpuProfile = useMemo(() => cpuMatchProfile(homeTeam), [cpuMatchProfile, homeTeam])
  const awayCpuProfile = useMemo(() => cpuMatchProfile(awayTeam), [cpuMatchProfile, awayTeam])
  const userSpatialProfile = useMemo(
    () => perfilEspacial286({ ...teamTactics, formation: liveFormation }),
    [teamTactics, liveFormation],
  )
  const homeSpatialProfile = useMemo(
    () => userSide === "home" ? userSpatialProfile : perfilEspacial286(homeCpuProfile.tactic),
    [userSide, userSpatialProfile, homeCpuProfile.tactic],
  )
  const awaySpatialProfile = useMemo(
    () => userSide === "away" ? userSpatialProfile : perfilEspacial286(awayCpuProfile.tactic),
    [userSide, userSpatialProfile, awayCpuProfile.tactic],
  )

  /**
   * CLIMA DO VESTIARIO. O capitao ja era escolhivel em Elenco > Gerenciamento e
   * nao tinha nenhum efeito no jogo. Agora a moral de quem manda pesa mais que
   * a do quarto goleiro. Derivado do elenco, nao guardado no save.
   */
  const climaDoElenco = useMemo(
    () => climaDoVestiario(enginePlayers, engineTacticalAssignments?.captain),
    [enginePlayers, engineTacticalAssignments?.captain],
  )
  /** Instrucoes por atleta (funcao + 7 ordens). Ver lib/forcas-individuais.ts. */
  const instrucoesIndividuais = useGameEngine(s => s.playerInstructions)

  // FORCA REAL DO LADO DO USUARIO — do elenco, nao do prestigio do clube.
  // Antes homeAttack/Defense/Midfield = prestigio (um numero so): um elenco
  // recheado de craques nao criava mais chances que um mediano de mesmo
  // prestigio. Aqui saem dos atributos do XI titular, por setor, mais a tatica
  // e um modificador de FORMA e MORAL (que o motor ignorava por completo).
  // ── CONFRONTO ENTRE DOIS TÉCNICOS HUMANOS ────────────────────────────────
  //
  // No co-op local o adversário pode ser outra pessoa da mesa. Duas coisas
  // mudam, e as duas são necessárias para o modo não virar enfeite:
  //
  //  1. A PARTIDA NÃO É DIRIGIDA AO VIVO. Comandar em tempo real só faria
  //     sentido para UM dos dois — o outro assistiria o próprio time ser
  //     dirigido por ninguém, e ainda daria ao rival o direito de reagir depois
  //     de ver o time dele em campo. É simulada de uma vez, com o que cada um
  //     já decidiu na sua vez.
  //  2. A FORÇA DELE VEM DO ELENCO DELE. Sem isto o time do outro técnico
  //     entraria como CPU, medido pelo PRESTÍGIO do clube — e o elenco que ele
  //     montou, os reforços que comprou e a tática que escolheu não teriam
  //     efeito nenhum no placar.
  const tecnicosDoJogo = useMemo(
    () => tecnicosDoSave(savedGame.tecnicos, savedGame.managerName, savedGame.selectedTeamShort),
    [savedGame.tecnicos, savedGame.managerName, savedGame.selectedTeamShort],
  )
  /**
   * O adversário de hoje é de outro técnico humano?
   *
   * ⚠️ Só vale para jogo de CLUBE. Na base e na seleção o elenco em campo não é
   * o do clube — casar pelo `curto` do clube apontaria para o time errado.
   */
  const tecnicoAdversario = useMemo(() => {
    if (matchCtx.youth || matchCtx.national) return null
    const rival = userSide === "home" ? awayTeam : homeTeam
    // ⚠️ O `file_key` entra na conta desde a 1.0.304: com cada técnico escolhendo
    // o país dele, um clube estrangeiro de `curto` igual seria confundido com o
    // do vizinho de mesa — e a partida entraria no caminho de "dois humanos"
    // contra um adversário que é da CPU, medindo a força dele pelo elenco errado.
    return tecnicoDoClube(tecnicosDoJogo, rival.curto, (rival as { file_key?: string }).file_key)
  }, [tecnicosDoJogo, matchCtx.youth, matchCtx.national, userSide, awayTeam, homeTeam])

  const forcasDoAdversarioHumano = useMemo(() => {
    if (!tecnicoAdversario) return null
    // O elenco dele mora no bolso que o revezamento guardou. Ver
    // `lib/chaveamento-de-tecnico.ts`.
    const bolso = savedGame.estadoPorTecnico?.[tecnicoAdversario.id]
    const plantel = (bolso?.squadPlayers as AtletaEmCampo[] | undefined) ?? []
    const clube = userSide === "home" ? awayTeam : homeTeam
    // A MESMA função que mede o time do usuário — ver o aviso em
    // `lib/forca-do-plantel.ts` sobre por que a régua tem de ser única.
    const base = forcasDoPlantel(titularesAptos(plantel), clube.prestigio)
    const tat = bolso?.teamTactics ? forcasDaTatica(bolso.teamTactics as TeamTactics) : null
    return {
      overall: base.overall + base.mod,
      attack: base.attack + (tat?.attack ?? 0) + base.mod,
      defense: base.defense + (tat?.defense ?? 0) + base.mod,
      midfield: base.midfield + (tat?.midfield ?? 0) + base.mod,
    }
  }, [tecnicoAdversario, savedGame.estadoPorTecnico, userSide, awayTeam, homeTeam])

  const userForces = useMemo(() => {
    // NA SELEÇÃO A FORÇA É A DA CONVOCAÇÃO. `enginePlayers` é o plantel do
    // clube: sem isto, a força do time em campo numa Copa do Mundo era a do seu
    // clube — o placar sairia do elenco errado mesmo com os nomes certos na
    // escalação. Forma e moral não existem para o convocado (são do vínculo com
    // o clube), então ficam nos neutros e o modificador zera.
    const xi = matchCtx.national && selecaoConvocada.length > 0
      ? selecaoConvocada.slice(0, 11).map(j => ({
          position: j.pos,
          overall: j.base,
          isStarter: true,
          injury: null,
          form: 70,
          morale: "Normal",
          moralePoints: 55,
        } as unknown as EnginePlayer))
      : matchEnginePlayers.filter(p => p.isStarter && !p.injury)
    const setor = (posicoes: string[], quantos: number) => {
      const g = xi.filter(p => posicoes.includes(p.position)).sort((a, b) => b.overall - a.overall).slice(0, quantos)
      return g.length ? g.reduce((s, p) => s + p.overall, 0) / g.length : 65
    }
    const atk = setor(["ATA", "PE", "PD"], 3)
    const mid = setor(["MEI", "VOL"], 4)
    const linha = setor(["ZAG", "LD", "LE"], 4)
    const gk = setor(["GOL"], 1)
    const def = (linha * 4 + gk) / 5
    const overall = xi.length ? xi.reduce((s, p) => s + p.overall, 0) / xi.length : (userSide === "home" ? homeTeam.prestigio : awayTeam.prestigio)
    // Forma (0-100) e moral (rotulo) do XI viram um modificador de +/- ~7.
    const pMoral = (m: string) => (m === "Feliz" ? 80 : m === "Motivado" ? 68 : m === "Descontente" ? 35 : m === "Revoltado" ? 20 : 55)
    const formaMedia = xi.length ? xi.reduce((s, p) => s + (p.form ?? 70), 0) / xi.length : 70
    const moralMedia = xi.length ? xi.reduce((s, p) => s + (p.moralePoints ?? pMoral(p.morale)), 0) / xi.length : 55
    // LIDERANCA. `moralMedia` acima e media SIMPLES; a hierarquia acrescenta so
    // a parcela de quem manda no vestiario estar acima ou abaixo do grupo — por
    // isso somar os dois nao conta moral duas vezes. Ver lib/hierarquia-do-elenco.
    const mod = (formaMedia - 70) / 9 + (moralMedia - 55) / 13 + climaDoElenco.efeito
    /**
     * FUNCOES INDIVIDUAIS. As 66 funcoes de `PlayerRole` e as 7 instrucoes por
     * atleta nao chegavam ao motor — o jogador escolhia e nada mudava. Aqui
     * entra so a ADEQUACAO (os atributos servem a funcao recebida?) e o
     * custo/beneficio das ordens. A qualidade do atleta ja esta em `atk`/`mid`/
     * `def` acima; medir qualidade de novo seria conta-la duas vezes.
     */
    const individuais = forcasDoElenco(xi as unknown as EnginePlayer[], instrucoesIndividuais)
    return {
      overall,
      attack: atk + tacticalForces.attack + individuais.attack + mod,
      defense: def + tacticalForces.defense + individuais.defense + mod,
      midfield: mid + tacticalForces.midfield + individuais.midfield + mod,
    }
  }, [matchEnginePlayers, selecaoConvocada, matchCtx.national, tacticalForces, climaDoElenco.efeito, instrucoesIndividuais, userSide, homeTeam.prestigio, awayTeam.prestigio])

  /**
   * CENTRAL DE GESTÃO EM CAMPO.
   *
   * As rotinas de bola parada e a preparação para o adversário eram gravadas no
   * save e nenhum motor as lia. Aqui elas viram números: o plano vai para o
   * `MatchConfig` do lado do usuário (a IA não ensaia rotina) e o bônus de
   * preparação entra como força, só se foi preparado para ESTE rival nesta
   * semana.
   */
  const gestaoAvancada = useMemo(() => normalizarGestao282(savedGame.gestao282), [savedGame.gestao282])

  const planoBolaParada = useMemo(
    () => planoDeBolaParada282(gestaoAvancada, matchEnginePlayers),
    [gestaoAvancada, matchEnginePlayers],
  )

  const bonusPrep = useMemo(() => {
    const adversario = userSide === "home" ? awayTeam.nome : homeTeam.nome
    return bonusPreparacaoAplicavel282(gestaoAvancada.preparacao, {
      season: savedGame.season,
      week: savedGame.week,
      adversario,
    }, tecnico.preparoDeJogo)
  }, [gestaoAvancada.preparacao, savedGame.season, savedGame.week, userSide, homeTeam.nome, awayTeam.nome, tecnico.preparoDeJogo])

  /**
   * O LADO DE LÁ, em números — máquina ou outro técnico da mesa.
   *
   * Estava espalhado em seis linhas da config, cada uma repetindo
   * `prestigio * modificador + socialModifier`. Virou um lugar só porque agora
   * há dois casos, e porque a escolha entre eles é testada: ver
   * `scripts/test-forca-do-plantel.ts`.
   */
  const ladoAdversario = useMemo(
    () => ladoAdversarioEmCampo(
      forcasDoAdversarioHumano,
      (userSide === "home" ? awayTeam : homeTeam).prestigio,
      userSide === "home" ? awayCpuProfile : homeCpuProfile,
    ),
    [forcasDoAdversarioHumano, userSide, awayCpuProfile, homeCpuProfile, awayTeam, homeTeam],
  )

  // Config da simulacao
  const config = useMemo(() => ({
    homeTeam,
    awayTeam,
    // A IA recebe apenas um pequeno ganho de preparo; a diferença principal continua
    // vindo do elenco. Isso aumenta a dificuldade sem manipular placares.
    // ENTROSAMENTO do usuario vira ate +5 de forca (time que joga junto rende
    // mais, estilo FM). So o lado do usuario recebe; a IA fica no prestigio.
    // Rating do lado do usuario vem do OVERALL do elenco real (+entrosamento);
    // a IA segue no prestigio + pequeno ganho de preparo.
    homeRating: userSide === "home" ? userForces.overall + bonusEntrosamento : ladoAdversario.overall,
    awayRating: userSide === "away" ? userForces.overall + bonusEntrosamento : ladoAdversario.overall,
    homeSquad: homeSquad.map(toSquadPlayer),
    awaySquad: awaySquad.map(toSquadPlayer),
    // ÁRBITRO DA PARTIDA. Determinístico pelos clubes + temporada + semana: o
    // mesmo jogo tem sempre o mesmo juiz, senão o nome mudaria entre a tela de
    // pré-jogo e a súmula. Ele altera só a frequência de cartão.
    arbitro: arbitroDaPartida(`${siglaExibivel(homeTeam.curto, homeTeam.nome)}-${siglaExibivel(awayTeam.curto, awayTeam.nome)}-${savedGame.season}-${savedGame.week}`),
    durationMinutes: matchCtx.duration,
    // Diz ao motor qual lado e o do usuario: no penalti dele, o motor PARA e espera
    // a escolha do batedor em vez de cobrar sozinho.
    userSide,
    // Cobradores designados. PONTE que faltava: a aba Atribuições do
    // gerenciamento grava em tacticalAssignments e a partida só lia
    // setPieceTakers (da aba Bola Parada) — dois cofres, e o que o técnico
    // escolhia no gerenciamento nunca chegava ao jogo. Atribuições prevalece;
    // Bola Parada é o fallback.
    userSetPieceTakers: {
      corner: engineTacticalAssignments?.corner || engineSetPieceTakers?.corner,
      freeKick: engineTacticalAssignments?.freeKickRight || engineTacticalAssignments?.freeKick
        || engineTacticalAssignments?.freeKickLeft || engineSetPieceTakers?.freeKick,
      penalty: engineTacticalAssignments?.penalty || engineSetPieceTakers?.penalty,
    },
    // Mentalidade aplicada ao lado do usuario (afeta a simulacao ao vivo).
    // O LADO DA CPU tambem tem mentalidade agora: ela vem de `posturasDaIA`, que o
    // avanco de semana atualiza quando um clube emenda derrotas (se fecha) ou
    // vitorias (vem para cima). Antes o adversario jogava sempre no mesmo tom,
    // campeao ou lanterna — a "identidade tatica" da IA nunca chegava ao campo.
    homeMentality: userSide === "home" ? userMentality : posturaDaIA(homeTeam?.curto),
    awayMentality: userSide === "away" ? userMentality : posturaDaIA(awayTeam?.curto),
    // Nivel de dificuldade escolhido pelo jogador (lib/dificuldade). Sem ele o
    // motor usa o 9 fixo de sempre.
    cpuBonusBase: nivelDificuldade.bonusBase,
    cpuPesoDoContexto: nivelDificuldade.pesoDoContexto,
    // Linha de impedimento do usuario. Sem esta ligacao o motor ate sabe gerar
    // impedimento, mas nunca ficaria sabendo que a armadilha esta armada — que
    // era exatamente o defeito antigo desta opcao.
    homeOffsideTrap: userSide === "home" ? teamTactics?.offsideTrap : homeCpuProfile.tactic.offsideTrap,
    awayOffsideTrap: userSide === "away" ? teamTactics?.offsideTrap : awayCpuProfile.tactic.offsideTrap,
    homePressingLoad: userSide === "home" ? tacticalForces.pressingLoad : homeCpuProfile.pressingLoad,
    awayPressingLoad: userSide === "away" ? tacticalForces.pressingLoad : awayCpuProfile.pressingLoad,
    homeTransitionLoad: userSide === "home" ? tacticalForces.transitionLoad : homeCpuProfile.transitionLoad,
    awayTransitionLoad: userSide === "away" ? tacticalForces.transitionLoad : awayCpuProfile.transitionLoad,
    // Ocupação por fases: define corredores, proteção às costas, rotações e
    // recuperação alta que o motor usa para criar o lance da 1.0.286.
    homeSpatialProfile,
    awaySpatialProfile,
    // Rotinas ensaiadas: só o lado do usuário tem. A IA não usa a Central de
    // Gestão, então segue no comportamento de base do motor.
    homeSetPiecePlan: userSide === "home" ? planoBolaParada : undefined,
    awaySetPiecePlan: userSide === "away" ? planoBolaParada : undefined,
    // Forcas por setor do lado do usuario — do elenco real + tatica + forma/moral
    // + a sessão de preparação para ESTE adversário (0 quando não há plano).
    homeAttack: userSide === "home" ? userForces.attack + bonusPrep : ladoAdversario.attack,
    homeDefense: userSide === "home" ? userForces.defense + bonusPrep : ladoAdversario.defense,
    homeMidfield: userSide === "home" ? userForces.midfield + bonusPrep : ladoAdversario.midfield,
    awayAttack: userSide === "away" ? userForces.attack + bonusPrep : ladoAdversario.attack,
    awayDefense: userSide === "away" ? userForces.defense + bonusPrep : ladoAdversario.defense,
    awayMidfield: userSide === "away" ? userForces.midfield + bonusPrep : ladoAdversario.midfield,
  }), [homeTeam, awayTeam, homeSquad, awaySquad, matchCtx.duration, userSide, userMentality, tacticalForces, userForces, bonusEntrosamento, engineSetPieceTakers, engineTacticalAssignments, posturaDaIA, nivelDificuldade, homeCpuProfile, awayCpuProfile, planoBolaParada, bonusPrep, homeSpatialProfile, awaySpatialProfile, ladoAdversario])

  const sim = useMatchSimulation(config)
  const { state, speed, isRunning, start, pause, resume, reset, setSpeed, fastForward, addEvent, takePenalty,
    resolveVar, beginShootout, kickShootout, endShootout, shootoutTakers } = sim

  /**
   * Começar a partida — pelo botão, pelo Enter ou pelo controle.
   *
   * Contra outro técnico da mesa isto SIMULA em vez de abrir o ao vivo. O
   * `fastForward` do motor roda a partida inteira pelo MESMO caminho de sempre:
   * mesmo cálculo, mesmo registro de resultado. O que muda é só não haver banco
   * de reservas humano — que é o ponto.
   */
  const comecarPartida = useCallback(() => {
    if (tecnicoAdversario) fastForward()
    else start()
  }, [tecnicoAdversario, fastForward, start])

  /**
   * Esta partida DECIDE um confronto de mata-mata?
   *
   * Só aqui dá para saber: o motor não conhece o calendário, e o calendário é o
   * único lugar que diz se o confronto é de jogo único ou de ida e volta. Jogo
   * único decide sempre; ida e volta decide só na VOLTA.
   *
   * Sem esta checagem a disputa apareceria no fim da IDA de uma semifinal —
   * exatamente o erro oposto ao que estamos consertando.
   */
  const confrontoDecisivo = useMemo(() => {
    // SELEÇÃO: a competição já sabe se está no mata-mata, e ela viaja como
    // `friendly` — sem este ramo antes, a checagem abaixo devolveria false e uma
    // semifinal de Copa do Mundo terminaria empatada, sem dono.
    if (matchCtx.national) return matchCtx.national.mataMata
    if (!currentMatch || matchCtx.friendly || matchCtx.youth || matchCtx.torneio) return false
    const stage = String(currentMatch.stage ?? "").toLowerCase()
    // Fase de grupos e classificatória terminam empatadas normalmente.
    if (!stage || stage === "fase_grupos" || stage === "fase_classificatoria") return false
    if (!["cup", "continental", "state"].includes(currentMatch.competitionType)) return false

    const pernas = seasonCalendar.fixtures.filter(f =>
      f.competition === currentMatch.competition &&
      String(f.stage ?? "").toLowerCase() === stage &&
      (
        (f.homeTeam.curto === homeTeam.curto && f.awayTeam.curto === awayTeam.curto) ||
        (f.homeTeam.curto === awayTeam.curto && f.awayTeam.curto === homeTeam.curto)
      ),
    )
    // Confronto que o calendário não reconhece: trata como jogo único, que é o
    // caso conservador — decidir aqui é melhor que deixar um empate sem dono.
    if (!pernas.length) return true
    // Ordena por (semana, id) e confere se ESTA é a última perna. Comparar só a
    // semana bastaria hoje — ida e volta caem em semanas diferentes —, mas o `id`
    // desempata sem depender disso.
    const ultima = [...pernas].sort((a, b) => a.week - b.week || a.id - b.id).at(-1)!
    return ultima.id === currentMatch.id
  }, [currentMatch, matchCtx.friendly, matchCtx.youth, matchCtx.torneio, seasonCalendar.fixtures, homeTeam.curto, awayTeam.curto])

  // PLACAR AGREGADO do jogo de volta. Tem que ficar DEPOIS de `state`: enquanto
  // era calculado logo após `previousLeg`, lá em cima, lia `state` antes da
  // declaração — no jogo de volta de qualquer confronto de ida e volta o acesso
  // caía na TDZ e a tela de partida ao vivo quebrava com ReferenceError. Era por
  // isso que o agregado "não aparecia": a tela nem chegava a renderizar.
  const aggregateScore = firstLeg ? {
    home: state.home.goals + firstLeg.home,
    away: state.away.goals + firstLeg.away,
    firstLegHome: firstLeg.home,
    firstLegAway: firstLeg.away,
  } : null

  /**
   * Empate que não pode ficar de pé: agregado nivelado numa partida decisiva.
   *
   * Fica DEPOIS de `aggregateScore` de propósito — ver o comentário acima sobre a
   * TDZ que já derrubou a tela inteira no jogo de volta.
   */
  const precisaDePenaltis = confrontoDecisivo && (
    aggregateScore
      ? aggregateScore.home === aggregateScore.away
      : state.home.goals === state.away.goals
  )

  /**
   * Confrontos da MESMA rodada que decidem posição perto da minha.
   *
   * Só em partida de LIGA: copa e mata-mata não têm tabela para brigar por
   * posição. E só da MESMA competição e semana — varrer a rodada inteira do
   * calendário misturaria estadual com Brasileirão na mesma lista.
   */
  const jogosDoRival = useMemo(() => {
    if (!currentMatch || currentMatch.competitionType !== "league") return []
    if (!currentStandings?.length) return []
    const daRodada = seasonCalendar.fixtures
      .filter(f =>
        f.competition === currentMatch.competition &&
        f.week === currentMatch.week &&
        !f.isUserMatch,
      )
      .map(f => ({
        homeCurto: f.homeTeam.curto, awayCurto: f.awayTeam.curto,
        homeNome: f.homeTeam.nome, awayNome: f.awayTeam.nome,
      }))
    // Em jogo de SELEÇÃO nao ha briga por G4 nem por titulo do seu
    // campeonato para acompanhar: os rivais sao os do CLUBE.
    if (matchCtx.national) return []
    if (!daRodada.length) return []
    return jogosQueImportam(daRodada, currentStandings, userTeam.curto, currentStandings.length)
  }, [currentMatch, seasonCalendar.fixtures, currentStandings, userTeam.curto, matchCtx.national])

  // Pulso do ULTIMO evento relevante para o radar REAGIR (chute -> bola voa pro
  // gol; escanteio -> aglomeracao na area). seq = indice do evento (monotonico),
  // entao a reacao dispara uma vez por evento novo.
  // A escolha do lance foi para lib/radar-evento (pura e testada). Ela varria a
  // lista do lado errado — o motor guarda o MAIS NOVO NA FRENTE —, entao o radar
  // encenava o PRIMEIRO chute da partida para sempre, e o `seq` baseado no
  // indice mudava sozinho a cada evento novo, re-disparando a reacao sem parar.
  const radarEvent = useMemo(() => selecionarEventoDoRadar(state.events), [state.events])

  useEffect(() => {
    // Antes do apito inicial a formação deve sempre refletir a última tática salva.
    if (state.phase === "pre") setLiveFormation(savedFormation ?? "4-3-3")
  }, [savedFormation, state.phase])

  useEffect(() => {
    initAudio({
      enabled: savedGame.commentaryEnabled ?? true,
      volume: (savedGame.commentaryVolume ?? 80) / 100,
      mute: !(savedGame.commentaryEnabled ?? true),
      preload: true,
      fallbackToText: true,
      pack: savedGame.commentaryVoice ?? "padrao",
      language: "pt-br",
    })
    return clearCommentary
  }, [savedGame.commentaryEnabled, savedGame.commentaryVolume, savedGame.commentaryVoice])

  // Penalti a favor do usuario: o motor parou e esta esperando o batedor.
  // Isto substitui a deteccao pelo evento (que nunca funcionava — o gol ja vinha por cima).
  useEffect(() => {
    if (state.pendingPenalty) {
      pause()
      if (state.pendingPenalty.side === userSide) setShowPenaltyModal(true)
      else takePenalty(null)
    }
  }, [state.pendingPenalty, userSide, pause, takePenalty])

  // Discord Rich Presence
  useDiscordRPC(state, homeTeam, awayTeam)

  // Sons da partida
  const { play: playSound } = useMatchSounds()
  const lastSoundEventId = useRef<string | null>(null)
  const lastDismissalEventId = useRef<string | null>(null)
  const lastSideFoulEventId = useRef<string | null>(null)
  const sideFoulTimer = useRef<number | null>(null)
  const lastPhase = useRef<string | null>(null)

  // Som por mudança de fase (apito de início/intervalo/fim)
  useEffect(() => {
    if (!hydrated) return
    if (lastPhase.current === state.phase) return
    lastPhase.current = state.phase
    if (state.phase === "first") playSound("apito_inicio")
    else if (state.phase === "halftime") { playSound("apito_intervalo"); enqueueEvent("intervalo") }
    else if (state.phase === "fulltime") { playSound("apito_fim"); enqueueEvent("fimjogo") }
  }, [state.phase, hydrated, playSound])

  // Som por evento (gol, falta, cartão, etc.)
  useEffect(() => {
    if (state.events.length === 0) return
    // O motor PREPENDE os eventos ([novo, ...events]), entao o mais recente e o
    // indice 0. Antes lia events[length-1] = o mais ANTIGO (o kickoff), e por isso
    // nenhum som de gol/cartao/penalti tocava depois do primeiro evento.
    const last = state.events[0]
    const id = `snd-${last.id}`
    if (lastSoundEventId.current === id) return
    lastSoundEventId.current = id
    // GOL CONTRA VOCÊ NÃO É COMEMORAÇÃO. Todo gol enfileirava `gol1` — a
    // narração de festa —, inclusive quando quem marcava era o adversário. O
    // pacote sempre teve o `goladv` gravado para isso, nos NOVE narradores, e
    // ele nunca era pedido: o arquivo existia no disco e não tinha um único
    // chamador. Mesma história do `contusao`, que também nunca tocava.
    const doUsuario = last.side === userSide

    // VIBRAÇÃO. O jogo tinha o subsistema de controle inteiro e nenhuma chamada
    // a `vibrationActuator` — o gol chegava pelos olhos e pelo som, nunca pelas
    // mãos. Quem joga sem som (surdez, lugar silencioso, volume desligado)
    // perdia apito, gol e expulsão por completo; agora eles têm um canal que não
    // depende de ouvir. Desligável em Configurações. Ver lib/vibracao-do-controle.
    const toque = padraoDoEventoDaPartida(last.type, !doUsuario)
    if (toque) vibrar(toque)

    switch (last.type) {
      case "goal":    playSound("gol"); enqueueEvent(doUsuario ? "gol1" : "goladv"); break
      case "foul":    playSound("apito_falta"); break
      case "yellow_card": playSound("cartao_amarelo"); break
      case "red_card":    playSound("cartao_vermelho"); enqueueEvent("expulsao"); break
      case "penalty":     playSound("penalti"); enqueueEvent("penalty"); break
      case "sub":         playSound("substituicao"); break
      case "injury":      enqueueEvent("contusao"); break
    }
  }, [state.events, playSound, userSide])

  // Vermelho precisa retirar o atleta do radar/campo, não apenas reduzir a força do time.
  useEffect(() => {
    const dismissal = state.events.find(event => event.type === "red_card")
    if (!dismissal?.player || dismissal.id === lastDismissalEventId.current) return
    lastDismissalEventId.current = dismissal.id
    const normalized = dismissal.player.trim().toLocaleLowerCase("pt-BR")
    const remove = (players: MatchPlayer[]) => players.filter(player => player.name.trim().toLocaleLowerCase("pt-BR") !== normalized)
    if (dismissal.side === "home") setHomeSquad(remove)
    else setAwaySquad(remove)
  }, [state.events])

  // Contexto atual
  const gameContext: GameContext = state.phase === "pre" 
    ? "match_preview" 
    : state.phase === "fulltime" 
      ? "menu"
      : isRunning 
        ? "match_live" 
        : "match_paused"

  // Modal substituicao
  const [showSubModal, setShowSubModal] = useState(false)
  const [subsRemaining, setSubsRemaining] = useState(5)

  // CONJUNTO DE AÇÕES DA PARTIDA (Action Set separado).
  //
  // Enquanto a bola rola, o losango do controle NÃO pode significar
  // "confirmar/voltar": apertar o botão de baixo tem de acelerar a simulação, e
  // não confirmar um item de menu invisível. Declarar o contexto "MATCH" troca
  // o mapeamento inteiro num lugar só — ver POR_CONTEXTO em lib/input/bindings.
  //
  // O handler de `gamepad:button` mais abaixo (que lê CONTROL_MAPPINGS pelo
  // `gameContext`) continua intacto: é ele que já sabia pausar, acelerar e
  // substituir, e reescrevê-lo seria trocar código testado por código novo sem
  // ganho nenhum.
  useContextoDeInput("MATCH", state.phase !== "pre" && state.phase !== "fulltime")
  useDicasDeControle(
    state.phase === "pre"
      ? [{ acao: "UI_CONFIRM", rotulo: "Começar" }, { acao: "UI_BACK" }]
      : [
          { acao: "MATCH_PAUSE", rotulo: isRunning ? "Pausar" : "Continuar" },
          { acao: "MATCH_SPEED_UP" },
          { acao: "MATCH_SUBSTITUTE", inativa: subsRemaining <= 0 },
          { acao: "MATCH_SKIP" },
        ],
    state.phase !== "fulltime",
  )

  // Tab ativa
  const [activeTab, setActiveTab] = useState<"pitch" | "stats" | "gameplan" | "narration">("narration")
  const [usarCampo3D, setUsarCampo3D] = useState(true)
  const [falhaCampo3D, setFalhaCampo3D] = useState<string | null>(null)
  /** Campo ocupando a janela inteira, para acompanhar a partida. */
  const [campoEmTelaCheia, setCampoEmTelaCheia] = useState(false)

  // Esc sai, F alterna. Esc é o gesto que a pessoa tenta primeiro numa tela que
  // tomou conta do jogo; sem ele, a tela cheia parece travada.
  //
  // ⚠️ Ignora as teclas quando o foco está num campo de texto: digitar "f" numa
  // busca não pode jogar o jogador para dentro da tela cheia.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null
      if (alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.isContentEditable)) return
      if (e.key === "Escape" && campoEmTelaCheia) { e.preventDefault(); setCampoEmTelaCheia(false) }
      else if (e.key === "f" || e.key === "F") { e.preventDefault(); setCampoEmTelaCheia(v => !v) }
    }
    window.addEventListener("keydown", aoTeclar)
    return () => window.removeEventListener("keydown", aoTeclar)
  }, [campoEmTelaCheia])

  // Sair da aba do campo fecha a tela cheia junto: sem isto, voltar para as
  // estatísticas deixaria um retângulo preto cobrindo o jogo.
  useEffect(() => {
    if (activeTab !== "pitch" && campoEmTelaCheia) setCampoEmTelaCheia(false)
  }, [activeTab, campoEmTelaCheia])

  const formacaoDaFase = useMemo(() => {
    const ultimo = state.events[0]?.type
    const temBola = state.ball.side === userSide
    if (temBola && (ultimo === "kickoff" || ultimo === "save")) {
      return teamTactics.buildUpFormation ?? liveFormation
    }
    if (temBola) return teamTactics.inPossessionFormation ?? liveFormation
    return teamTactics.outOfPossessionFormation ?? liveFormation
  }, [liveFormation, state.ball.side, state.events, teamTactics.buildUpFormation, teamTactics.inPossessionFormation, teamTactics.outOfPossessionFormation, userSide])

  const eventosDo3D = useMemo(() => state.events.map(evento => ({
    id: evento.id, tipo: evento.type, lado: evento.side, minuto: evento.minute,
  })), [state.events])
  const velocidadeDo3D = speed === "ultra" ? 5 : speed === "fast" ? 3 : 1

  // Estado para animacoes de eventos
  const [currentAnimation, setCurrentAnimation] = useState<{
    type: AnimatableEvent
    team?: typeof homeTeam
    player?: string
    minute?: number
  } | null>(null)
  const [sideFoul, setSideFoul] = useState<MatchEvent | null>(null)

  // Estado para modal de penalti
  const [showPenaltyModal, setShowPenaltyModal] = useState(false)
  const [pendingPenalty, setPendingPenalty] = useState<{
    side: "home" | "away"
    minute: number
  } | null>(null)

  // Ref para rastrear ultimo evento processado
  const lastProcessedEventId = useRef<string | null>(null)

  // Monitora eventos para mostrar animacoes
  useEffect(() => {
    if (state.events.length === 0) return
    
    // Mesmo bug do handler de som: o motor prepende, entao o evento novo e o [0].
    // Lendo [length-1] o efeito ficava preso no kickoff e NUNCA disparava as
    // animacoes de gol/cartao/falta nem o modal de batedor de penalti.
    const lastEvent = state.events[0]
    const eventId = lastEvent.id

    // Evita processar o mesmo evento duas vezes
    if (lastProcessedEventId.current === eventId) return
    lastProcessedEventId.current = eventId

    const animatableTypes: AnimatableEvent[] = ["goal", "penalty", "yellow_card", "red_card", "var"]
    
    if (animatableTypes.includes(lastEvent.type as AnimatableEvent)) {
      const eventTeam = lastEvent.side === "home" ? homeTeam : awayTeam
      
      // Penalti do usuario NAO e tratado aqui: o motor agora para e sinaliza via
      // state.pendingPenalty (efeito abaixo). Antes isto dependia do evento "penalty"
      // estar no topo da lista — mas o motor ja tinha empilhado o gol por cima dele.
      if (lastEvent.type === "penalty" && lastEvent.side === userSide) {
        // no-op: o modal abre pelo pendingPenalty
      } else {
        // Mostra animacao normal
        pause()
        setCurrentAnimation({
          type: lastEvent.type as AnimatableEvent,
          team: eventTeam,
          player: lastEvent.player,
          minute: lastEvent.minute
        })
      }
    }
  }, [state.events, homeTeam, awayTeam, userSide, pause])

  // Faltas são avisos contextuais e não devem pausar/cobrir o placar. Exibe o lance
  // por alguns segundos na coluna lateral direita, reservada a informações ao vivo.
  useEffect(() => {
    const foul = state.events.find(event => event.type === "foul")
    if (!foul || foul.id === lastSideFoulEventId.current) return
    lastSideFoulEventId.current = foul.id
    setSideFoul(foul)
    if (sideFoulTimer.current !== null) window.clearTimeout(sideFoulTimer.current)
    sideFoulTimer.current = window.setTimeout(() => setSideFoul(current => current?.id === foul.id ? null : current), 6500)
  }, [state.events])

  useEffect(() => () => {
    if (sideFoulTimer.current !== null) window.clearTimeout(sideFoulTimer.current)
  }, [])

  // Cobra o penalti com o batedor escolhido e DEVOLVE o desfecho, para o modal narrar
  // ("La vai Fulano... foi na paradinha... chutou... eeeee... GOOOL!").
  // A escolha IMPORTA: o motor usa o shooting deste jogador na taxa de conversao.
  const handlePenaltyTaker = (player: MatchPlayer) => {
    return takePenalty(toSquadPlayer(player))
  }

  // Narracao terminou: fecha o modal e devolve a partida ao relogio.
  const handlePenaltyFinish = () => {
    setShowPenaltyModal(false)
    setPendingPenalty(null)
    resume()
  }

  // Handler para fechar animacao
  const handleAnimationComplete = () => {
    const eraChecagemDoVar = currentAnimation?.type === "var" && Boolean(state.pendingVar)
    setCurrentAnimation(null)
    if (eraChecagemDoVar) {
      // Primeiro overlay = apreensao; agora o motor publica a decisao. O evento
      // novo abre um segundo overlay e so depois a partida volta a correr.
      resolveVar()
      return
    }
    // Resume a partida apos a animacao
    if (state.phase !== "fulltime" && state.phase !== "pre") {
      resume()
    }
  }

  // Handler de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Durante a disputa de pênaltis o teclado pertence ao modal: avançar,
      // substituir ou pausar não fazem sentido com a partida já encerrada.
      if (state.phase === "penaltis") return
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        if (state.phase === "pre") { comecarPartida(); return }
      }
      if (e.key.toLowerCase() === "x" && state.phase !== "fulltime") {
        e.preventDefault()
        fastForward()
        return
      }
      // Atalho exibido nas configuracoes e no rodape da partida.
      if (e.key.toLowerCase() === "t" && state.phase !== "pre" && state.phase !== "fulltime") {
        e.preventDefault()
        if (subsRemaining > 0) {
          pause()
          setShowSubModal(true)
        }
        return
      }
      if (e.key === "Escape") {
        if (state.phase !== "pre" && state.phase !== "fulltime") {
          if (isRunning) pause()
          else resume()
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [fastForward, isRunning, pause, resume, comecarPartida, state.phase, subsRemaining])

  // Handler de gamepad
  useEffect(() => {
    const handleGamepadButton = (e: CustomEvent<{ button: GamepadButtonName }>) => {
      const button = e.detail.button
      const action = getActionForButton(button, gameContext)
      if (!action) return
      switch (action) {
        case "pause_resume":
          if (state.phase !== "pre" && state.phase !== "fulltime") {
            if (isRunning) pause()
            else resume()
          }
          break
        case "fast_forward":
          // Cicla entre as tres velocidades expostas: 1x -> 3x -> 5x -> 1x.
          if (speed === "normal") setSpeed("fast")
          else if (speed === "fast") setSpeed("ultra")
          else setSpeed("normal")
          break
        case "substitute":
          if (subsRemaining > 0 && state.phase !== "fulltime") {
            setShowSubModal(true)
          }
          break
        case "skip_to_result":
          fastForward()
          break
        case "confirm":
          if (state.phase === "pre") comecarPartida()
          break
        case "back":
          if (showSubModal) setShowSubModal(false)
          break
      }
    }
    window.addEventListener("gamepad:button" as any, handleGamepadButton)
    return () => window.removeEventListener("gamepad:button" as any, handleGamepadButton)
  }, [fastForward, gameContext, isRunning, pause, resume, speed, setSpeed, comecarPartida, subsRemaining, state.phase, showSubModal])

  // Modal de fim
  const [showResult, setShowResult] = useState(false)
  const [showRoundResults, setShowRoundResults] = useState(false)
  const [showPressConference, setShowPressConference] = useState(false)
  const [isLeagueChampion, setIsLeagueChampion] = useState(false)
  const postMatchAdvance = useRef<Promise<unknown> | null>(null)
  /**
   * A TELA DA PARTIDA AINDA ESTÁ ABERTA?
   *
   * ⚠️ RELATO DE JOGADOR: "o leilão aparece do nada e me tira da partida ou de
   * qualquer outra página aberta". A causa é o fim da coletiva: entre o clique e
   * a navegação há três esperas — o avanço de semana (`postMatchAdvance`, que
   * simula a rodada inteira e leva SEGUNDOS), a descarga do disco e a gravação
   * do save. Sair da partida nesse intervalo não cancela nada: a função
   * continua viva, chega ao fim e chama `hardNavigate`, que é navegação de
   * documento inteiro. O jogador estava no elenco, no mercado ou já em outra
   * partida — e era jogado no leilão sem ter pedido.
   *
   * Este ref é o que permite desistir: quem sair da tela cancela a navegação
   * pendente em vez de ser sequestrado por ela.
   */
  const telaAberta = useRef(true)
  useEffect(() => () => { telaAberta.current = false }, [])
  /** Espera única entre o apito e o modal de resultado. Ver o uso, mais abaixo. */
  const resultTimer = useRef<number | null>(null)
  useEffect(() => () => {
    if (resultTimer.current !== null) window.clearTimeout(resultTimer.current)
  }, [])
  // Congela os times do confronto no apito final, ANTES de advanceWeek mudar o
  // currentMatch para a proxima partida (senao o modal mostra o adversario errado).

  // A partida do usuario precisa aparecer mesmo enquanto o Zustand ainda propaga o
  // resultado recém-registrado. Sem este fallback a tela intermediaria podia ficar vazia.
  const postMatchRoundResults = useMemo(() => {
    if (roundResults.length > 0) return roundResults
    if (state.phase !== "fulltime") return []
    return [{
      competition: matchCtx.competition || "Partida",
      homeTeam: (finalMatch?.home ?? homeTeam).curto,
      awayTeam: (finalMatch?.away ?? awayTeam).curto,
      homeScore: state.home.goals,
      awayScore: state.away.goals,
    }]
  }, [roundResults, state.phase, state.home.goals, state.away.goals, matchCtx.competition, finalMatch, homeTeam, awayTeam])

  // MATA-MATA EMPATADO: a partida NÃO acaba aqui. Abre a disputa de pênaltis
  // antes de qualquer registro — o efeito de fim de jogo, logo abaixo, espera.
  useEffect(() => {
    if (state.phase !== "fulltime" || !precisaDePenaltis) return
    if (state.shootout) return
    beginShootout()
  }, [state.phase, state.shootout, precisaDePenaltis, beginShootout])

  useEffect(() => {
    // Enquanto a disputa não terminar, nada é gravado: o classificado ainda não
    // existe e registrar aqui recriaria o velho empate sem dono.
    if (precisaDePenaltis && !state.shootout?.finished) return
    if (state.phase === "fulltime" && !showResult) {
      if (!resultRegistered.current) {
        resultRegistered.current = true
        // AS DECISÕES DO BANCO SOBREVIVEM AO APITO. Antes disto, tudo o que o
        // técnico fez em campo morria no minuto 90 — o elenco não guardava nada.
        // Ver `saldoDeMoralDaPartida`.
        //
        // ⚠️ NÃO vale para jogo de seleção: `squadPlayers` é o elenco do CLUBE, e
        // quem entrou em campo foi a convocação. Creditar aqui daria moral a
        // atletas que não disputaram a partida.
        if (!matchCtx.national) {
          const golsPro = userSide === "home" ? state.home.goals : state.away.goals
          const golsContra = userSide === "home" ? state.away.goals : state.home.goals
          const degraus = saldoDeMoralDaPartida(
            sim.decisionHistory,
            golsPro > golsContra ? "vitoria" : golsPro === golsContra ? "empate" : "derrota",
          )
          if (degraus !== 0) {
            // ⚠️ O `id` do MatchPlayer é POSICIONAL (`idOffset + i + 1`), não o id
            // do atleta no elenco — passá-lo direto para `ajustarMoralJogador`
            // mexeria na moral de outra pessoa. O nome é a única chave comum.
            const emCampo = new Set((userSide === "home" ? homeSquad : awaySquad).slice(0, 11).map(p => p.name))
            for (const atleta of useGameEngine.getState().squadPlayers) {
              if (emCampo.has(atleta.name)) useGameEngine.getState().ajustarMoralJogador(atleta.id, degraus)
            }
          }
        }
        // APRENDER A POSICAO JOGANDO NELA (1.0.293). Quem terminou em campo
        // credita familiaridade no slot em que atuou — e so quem esta fora da
        // posicao natural de fato ganha alguma coisa.
        if (!matchCtx.national) {
          const emCampo = (userSide === "home" ? homeSquad : awaySquad).slice(0, 11)
          const minutos = emCampo
            .filter(a => typeof a.atletaId === "number")
            .map(a => ({
              id: a.atletaId as number,
              posicao: a.formationPosition ?? a.position,
              minutos: Math.max(0, Math.min(120, state.minute)),
              funcao: instrucoesIndividuais[a.atletaId as number]?.role,
              funcaoSemBola: instrucoesIndividuais[a.atletaId as number]?.roleSemBola,
            }))
          if (minutos.length) useGameEngine.getState().registrarPosicoesJogadas(minutos)
        }
        // Snapshot dos times ANTES de avancar a semana (que troca o currentMatch)
        setFinalMatch({ home: homeTeam, away: awayTeam, userSide })
        // AMISTOSO: e so treino — NAO registra resultado, NAO mexe na tabela nem avanca a
        // semana. So mostra o placar. (Sem isto, um amistoso contaria como jogo oficial.)
        if (matchCtx.national) {
          // PARTIDA DA SELEÇÃO. Viaja como `friendly` (não mexe na temporada do
          // clube), mas o resultado NÃO se perde: volta para a competição da
          // seleção, que então simula o resto da rodada. Sem este ramo, o jogo
          // seria disputado e a competição continuaria esperando por ele.
          const golsPro = userSide === "home" ? state.home.goals : state.away.goals
          const golsContra = userSide === "home" ? state.away.goals : state.home.goals
          const penaltisPro = state.shootout
            ? (userSide === "home" ? state.shootout.homeGoals : state.shootout.awayGoals)
            : 0
          const penaltisContra = state.shootout
            ? (userSide === "home" ? state.shootout.awayGoals : state.shootout.homeGoals)
            : 0
          playNextRoundRef.current?.({
            golsDoUsuario: golsPro,
            golsDoAdversario: golsContra,
            venceuNosPenaltis: state.shootout ? penaltisPro > penaltisContra : undefined,
          })
          // SEM `registrarMinutosJuntos` AQUI. Ele credita minutos em campo
          // juntos ao ELENCO DO CLUBE, e quem jogou foi a convocação — o clube
          // ganharia entrosamento de uma partida que os jogadores dele nunca
          // disputaram. O amistoso de clube (abaixo) credita porque lá quem
          // entra em campo é o time do usuário.
          clearMatchContext()
        } else if (matchCtx.friendly) {
          // AMISTOSO DO CALENDARIO (1.0.223): o jogo-treino marcado na Area do
          // Treinador tem semana, aparece no calendario e precisa VOLTAR para o
          // save marcado como disputado — senao ficaria pendente na agenda para
          // sempre, travado como "proxima partida". O placar fica guardado com
          // ele: o card do dia mostra o resultado.
          //
          // E o entrosamento entra pela mesma porta da partida oficial: minutos
          // jogados juntos, nao um +4 avulso.
          if (matchCtx.amistosoSemana != null) {
            const golsPro = userSide === "home" ? state.home.goals : state.away.goals
            const golsContra = userSide === "home" ? state.away.goals : state.home.goals
            // A BILHETERIA ENTRA AGORA, e nao no acerto: o cache foi pago na
            // assinatura, mas o publico so vira dinheiro depois de o jogo
            // acontecer. Creditar antes seria receber por gente que nao foi.
            // Ver lib/amistosos-negociacao.
            const agendado = (savedGame.amistososAgendados ?? [])
              .find(a => a.week === matchCtx.amistosoSemana && !a.jogado)
            const atualizados = concluirAmistoso(
              savedGame.amistososAgendados ?? [], matchCtx.amistosoSemana, golsPro, golsContra,
            )
            if (atualizados) setSavedGame({ amistososAgendados: atualizados })
            if (agendado?.bilheteriaPrevista) {
              useGameEngine.getState().addClubRevenue(agendado.bilheteriaPrevista)
            }
          }
          useGameEngine.getState().registrarMinutosJuntos(70)
          clearMatchContext()
        } else if (matchCtx.youth) {
          const userGoals = userSide === "home" ? state.home.goals : state.away.goals
          const opponentGoals = userSide === "home" ? state.away.goals : state.home.goals
          setSavedGame(applyPlayedYouthMatch(savedGame, userGoals, opponentGoals))
          clearMatchContext()
        } else {
          const events = state.events
            .filter(e => e.type === "goal")
            .map(e => ({
              minute: e.minute,
              type: "goal" as const,
              playerId: 0,
              playerName: e.player || (e.side === "home" ? homeTeam.curto : awayTeam.curto),
            }))
          // Valor do flag de campeao ANTES de registrar: e a unica forma de saber
          // se o titulo saiu DESTA partida. Ver a checagem logo abaixo.
          const championFlagBefore = typeof window !== "undefined"
            ? localStorage.getItem("ultrafoot-pending-champion")
            : null
          registerUserMatchResult(
            homeTeam.curto,
            awayTeam.curto,
            state.home.goals,
            state.away.goals,
            events,
            // O placar das cobranças viaja com o resultado. É ele que decide o
            // classificado em lib/cup-bracket — no lugar do cara-ou-coroa.
            state.shootout?.finished
              ? { home: state.shootout.homeGoals, away: state.shootout.awayGoals }
              : null,
            {
              home: {
                shots: state.home.shots, shotsOnTarget: state.home.shotsOnTarget, xG: state.home.xG,
                corners: state.home.corners, fouls: state.home.fouls, yellows: state.home.yellows,
                reds: state.home.reds, possession: state.home.possession, passes: state.home.passes,
                passAccuracy: state.home.passAccuracy, xA: state.home.xA,
                boxEntries: state.home.entradasNaArea, highRecoveries: state.home.recuperacoesAltas,
                attacksByChannel: { left: state.home.ataquesPorCorredor.esquerda, center: state.home.ataquesPorCorredor.centro, right: state.home.ataquesPorCorredor.direita },
              },
              away: {
                shots: state.away.shots, shotsOnTarget: state.away.shotsOnTarget, xG: state.away.xG,
                corners: state.away.corners, fouls: state.away.fouls, yellows: state.away.yellows,
                reds: state.away.reds, possession: state.away.possession, passes: state.away.passes,
                passAccuracy: state.away.passAccuracy, xA: state.away.xA,
                boxEntries: state.away.entradasNaArea, highRecoveries: state.away.recuperacoesAltas,
                attacksByChannel: { left: state.away.ataquesPorCorredor.esquerda, center: state.away.ataquesPorCorredor.centro, right: state.away.ataquesPorCorredor.direita },
              },
            },
          )

          // REALISMO: nota por jogador + cartoes->suspensao. Mapeia os eventos do
          // MEU lado (nome -> id do elenco do motor) e processa o desempenho.
          try {
            const meuLado = userSide // "home" | "away"
            const porNome = new Map<string, number>()
            for (const p of enginePlayers) porNome.set(p.name.trim().toLowerCase(), p.id)
            const idDe = (nome?: string) => (nome ? porNome.get(nome.trim().toLowerCase()) : undefined)
            const evJogador: { minute: number; type: "goal" | "assist" | "yellow" | "red" | "injury"; playerId: number; playerName: string; assistPlayerId?: number; assistPlayerName?: string; motivoExpulsao?: "segundo_amarelo" | "vermelho_direto"; expulsaoViolenta?: boolean }[] = []
            for (const e of state.events) {
              if (e.side !== meuLado) continue
              const tipo: "goal" | "yellow" | "red" | "injury" | null = e.type === "goal" ? "goal"
                : e.type === "yellow_card" ? "yellow"
                : e.type === "red_card" ? "red"
                : e.type === "injury" ? "injury" : null
              if (!tipo) continue
              const id = idDe(e.player)
              if (id === undefined) continue
              evJogador.push({
                minute: e.minute, type: tipo, playerId: id, playerName: e.player ?? "",
                assistPlayerId: idDe(e.assist), assistPlayerName: e.assist,
                // Natureza da expulsao: sem isto o tribunal julgaria toda
                // expulsao como segundo amarelo (1 jogo), inclusive agressao.
                motivoExpulsao: e.motivoExpulsao,
                expulsaoViolenta: e.expulsaoViolenta,
              })
            }
            const golsPro = meuLado === "home" ? state.home.goals : state.away.goals
            const golsContra = meuLado === "home" ? state.away.goals : state.home.goals
            const vereditos = processarDesempenhoPartida(golsPro, golsContra, evJogador)
            // TRIBUNAL: a expulsao rende uma noticia com a pena e a multa. Antes
            // o vermelho custava 1 jogo em silencio — o tecnico nunca sabia.
            for (const v of vereditos ?? []) {
              const multa = v.julgamento.multaClube > 0
                ? ` Multa ao clube: ${formatCurrency(v.julgamento.multaClube)}.`
                : ""
              addNotification({
                type: "news",
                title: `Tribunal: ${v.playerName} pega ${v.julgamento.jogos} ${v.julgamento.jogos === 1 ? "jogo" : "jogos"}`,
                message: `${v.julgamento.veredito}${multa}`,
                priority: v.julgamento.agravada ? "high" : "medium",
                href: "/elenco",
              })
            }
          } catch { /* nota e um extra: nunca deve travar o fim da partida */ }

          // TORNEIO AMISTOSO: grava o placar no jogo correspondente e, no
          // mata-mata, abre a fase seguinte. Sem isto a partida era disputada e
          // o resultado se perdia — o torneio nunca passava da primeira rodada.
          if (matchCtx.torneio) {
            try {
              const alvo = matchCtx.torneio
              const torneio = savedGame.torneioAmistoso
              if (torneio) {
                let jogos = torneio.jogos.map(j =>
                  j.rodada === alvo.rodada
                    && j.mandanteCurto === alvo.mandanteCurto
                    && j.visitanteCurto === alvo.visitanteCurto
                    ? { ...j, golsMandante: state.home.goals, golsVisitante: state.away.goals, jogado: true }
                    : j,
                )
                if (torneio.formato === "mata_mata") {
                  const proxima = avancarMataMata(jogos)
                  if (proxima.length > 0) jogos = [...jogos, ...proxima]
                }
                setSavedGame({
                  torneioAmistoso: {
                    ...torneio,
                    jogos,
                    campeao: torneio.formato === "mata_mata" ? campeaoMataMata(jogos) : null,
                  },
                })
              }
            } catch { /* o torneio e um extra: nao pode travar o fim da partida */ }
          }

          // NOTIFICACOES que nao existiam: resultado da partida e lesoes. Antes
          // os tipos match_end/injury so viviam na demo — nada era disparado.
          if (!matchCtx.friendly && !matchCtx.youth) {
            try {
              const meuNome = (userSide === "home" ? homeTeam : awayTeam).nome
              const rivalNome = (userSide === "home" ? awayTeam : homeTeam).nome
              const gp = userSide === "home" ? state.home.goals : state.away.goals
              const gc = userSide === "home" ? state.away.goals : state.home.goals
              const res = gp > gc ? "Vitória" : gp < gc ? "Derrota" : "Empate"
              addNotification({
                type: "match_end", priority: "medium",
                title: `${res}: ${meuNome} ${gp} x ${gc} ${rivalNome}`,
                message: `${displayCompetition}. ${gp > gc ? "Três pontos importantes!" : gp < gc ? "Resultado a superar na próxima." : "Um ponto somado."}`,
                href: "/central",
              })
              const lesionados = state.events.filter(e => e.type === "injury" && e.side === userSide).map(e => e.player).filter(Boolean)
              for (const nome of lesionados) {
                addNotification({
                  type: "injury", priority: "high",
                  title: `${nome} se lesionou`,
                  message: `${nome} deixou o jogo machucado e será reavaliado pelo departamento médico. Confira a gravidade no elenco.`,
                  href: "/elenco/gerenciamento",
                })
              }
            } catch { /* notificacao e um extra */ }
          }

          clearMatchContext()
          // Título de mata-mata (estadual/copa) é detectado pelo
          // registerUserMatchResult acima, que grava o pending-champion.
          //
          // Só vale se o flag MUDOU nesta partida. Antes bastava ele EXISTIR — e
          // ele só é apagado quando o jogador abre /campeao. Quem ganhava um
          // título e fechava o modal sem entrar na cerimônia ficava com o flag
          // preso para sempre, e a partir dali TODA partida terminava oferecendo
          // "cerimônia de campeão" sem ter sido campeão de nada (relato).
          if (typeof window !== "undefined") {
            const agora = localStorage.getItem("ultrafoot-pending-champion")
            if (agora && agora !== championFlagBefore) setIsLeagueChampion(true)
          }
          // So vira a semana se NAO sobrou jogo seu nela. Com copa em meio de
          // semana sobra — e avancar aqui fazia o motor simular a copa como
          // partida atrasada, sem o jogador jogar (relato: "tem hora que simula
          // as partidas sem pedir").
          postMatchAdvance.current = temPartidaPendenteNaSemana()
            ? Promise.resolve()
            : advanceWeek()
                .then(result => {
                  if (result && "leagueChampion" in result && result.leagueChampion) {
                    const champ = result.leagueChampion
                    safeLocalSet("ultrafoot-pending-champion", JSON.stringify({
                      competition: champ.competition,
                      season: champ.season,
                      type: "league",
                      stats: champ.stats,
                    }))
                    setIsLeagueChampion(true)
                  }
                })
                .catch(() => undefined)
        }
      }
      // ⚠️ UMA VEZ SÓ, E SEM CANCELAR NO RE-RENDER.
      //
      // Isto era `setTimeout(...); return () => clearTimeout(t)` num efeito cujas
      // dependências incluem `savedGame` e `setSavedGame` — as duas trocam de
      // identidade a cada gravação no save. Cada re-render CANCELAVA a espera e
      // começava outra: enquanto chovesse gravação (e chove, logo depois do
      // apito), o modal era adiado indefinidamente. Medido: o efeito reentrou
      // três vezes seguidas em menos de dez segundos.
      //
      // Com a espera guardada numa ref, o apito agenda o modal uma vez e o
      // restante dos renders não tem mais como empurrá-lo para frente.
      if (resultTimer.current === null) {
        resultTimer.current = window.setTimeout(() => {
          resultTimer.current = null
          setShowResult(true)
        }, 1200)
      }
    }
  }, [state.phase, showResult, state.events, state.home.goals, state.away.goals, state.shootout, precisaDePenaltis, homeTeam.curto, awayTeam.curto, registerUserMatchResult, advanceWeek, temPartidaPendenteNaSemana, matchCtx.friendly, matchCtx.youth, savedGame, setSavedGame, userSide])

  // Stamina drena por minuto. A decisao ativa agora cobra/devolve a energia
  // prometida pelo motor: pressionar e tudo-ou-nada cansam; acalmar, recuar e
  // poupar reduzem o ritmo. Antes energyDelta era apenas texto morto.
  // Dois bugs do relato ("até o goleiro cansou kk" + print "5.4000000000012%"):
  // 1) dreno FIXO de 1.1 para todos — 90' zeravam qualquer atleta, goleiro
  //    incluído. GK agora drena ~20% do ritmo de linha.
  // 2) subtração de floats acumulava lixo binário que vazava para a tela.
  //    Arredonda a 1 casa a cada tick.
  useEffect(() => {
    if (state.phase !== "first" && state.phase !== "second") return
    const drena = (p: MatchPlayer, ladoUsuario: boolean) => {
      const fatorDecisao = ladoUsuario
        ? Math.max(0.6, Math.min(1.5, 1 - sim.decisionEffect.energyDelta * 0.08 + sim.decisionEffect.pressureDelta * 0.012))
        : 1
      // "Resistencia" (lib/caracteristicas-do-atleta.ts) segura os noventa
      // minutos: drena ~15% menos. E o unico efeito dela, e o mais visivel de
      // todos — o atleta chega inteiro nos ultimos vinte, quando o resto cai.
      const fatorFisico = typeof p.atletaId === "number"
        ? pesosDeLance(caracteristicasDoAtleta(
            p.atletaId, p.position,
            {
              pace: p.pace ?? p.rating, shooting: p.shooting ?? p.rating,
              passing: p.passing ?? p.rating, dribbling: p.dribbling ?? p.rating,
              defending: p.defending ?? p.rating, physical: p.physical ?? p.rating,
            },
            p.rating,
            traitsDoEditor[p.atletaId],
          )).multDesgaste
        : 1
      const taxa = (p.position === "GOL" ? 0.22 : 0.62) * fatorDecisao * fatorFisico
      return Math.max(0, Math.round((p.stamina - taxa) * 10) / 10)
    }
    setHomeSquad(prev => prev.map(p => ({ ...p, stamina: drena(p, userSide === "home") })))
    setAwaySquad(prev => prev.map(p => ({ ...p, stamina: drena(p, userSide === "away") })))
  }, [state.minute, state.phase, userSide, sim.decisionEffect.energyDelta, sim.decisionEffect.pressureDelta, traitsDoEditor])

  // Mantém FC Hub e Discord Rich Presence sincronizados com o jogo ao vivo.
  // É um evento local e leve; não envia dados para servidor próprio.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("ultrafoot:live-presence", { detail: {
      home: homeTeam.nome,
      away: awayTeam.nome,
      homeGoals: state.home.goals,
      awayGoals: state.away.goals,
      minute: state.minute,
      phase: state.phase,
      competition: displayCompetition,
    } }))
  }, [homeTeam.nome, awayTeam.nome, state.home.goals, state.away.goals, state.minute, state.phase, displayCompetition])

  // Substituição
  const userStarters = userSide === "home" ? homeSquad : awaySquad
  const userBench = userSide === "home" ? homeBench : awayBench
  const userTeamForSub = userSide === "home" ? homeTeam : awayTeam

  const handleSub = (requestedChanges: SubstitutionChange[]) => {
    const changes = requestedChanges.slice(0, subsRemaining)
    if (changes.length === 0) return
    const setStarters = userSide === "home" ? setHomeSquad : setAwaySquad
    const setBenchSet = userSide === "home" ? setHomeBench : setAwayBench
    // Quem entra herda o slot de quem sai. Assim uma substituição não rearranja
    // Pulgar, Arrascaeta e os demais titulares no radar.
    const replacements = new Map(changes.map(change => [
      change.out.id,
      { ...change.inPlayer, tacticalSlot: change.out.tacticalSlot, formationPosition: change.out.formationPosition },
    ]))
    const incoming = new Set(changes.map(change => change.inPlayer.id))
    setStarters(prev => prev.map(player => replacements.get(player.id) ?? player))
    setBenchSet(prev => prev.filter(player => !incoming.has(player.id)))
    setSubsRemaining(current => Math.max(0, current - changes.length))
    changes.forEach(change => addEvent({
      type: "sub",
      side: userSide,
      text: `Substituição: ${change.inPlayer.name} entra no lugar de ${change.out.name}`,
      player: change.inPlayer.name,
      important: true,
    }))
    setShowSubModal(false)
  }

  // Filtra eventos importantes (gols, cartoes, substituicoes)
  const importantEvents = state.events.filter(e =>
    e.type === "goal" ||
    e.type === "yellow_card" ||
    e.type === "red_card" ||
    e.type === "sub" ||
    e.type === "penalty" ||
    e.type === "var"
  ).sort((a, b) => b.minute - a.minute) // Mais recentes primeiro

  if (!hydrated) {
    return (
      <div className="h-screen bg-[#050508] flex items-center justify-center text-white/40 text-sm">
        Carregando partida...
      </div>
    )
  }

  const isMatchInProgress = state.phase === "first" || state.phase === "second" || state.phase === "halftime"

  // Acréscimos: mostra +N quando o addedTime for não-zero (acréscimo ativo)
  const extraTime = (() => {
    if (state.phase === "first" && state.addedTime > 0) {
      const n = state.minute - 45
      return n > 0 ? `+${n}` : null
    }
    if (state.phase === "second" && state.addedTime > 0) {
      const n = state.minute - 90
      return n > 0 ? `+${n}` : null
    }
    return null
  })()

  return (
    <div className={cn(
      // fixed inset-0 (era h-[100dvh]): no WebView2 o dvh calculava menor que a
      // janela e o body vazava como FAIXA PRETA abaixo do rodapé (2 prints do
      // usuário). Fixando aos 4 cantos, a tela cobre o viewport sempre.
      "fixed inset-0 overflow-hidden flex flex-col",
      "bg-gradient-to-br from-[#1a3d3d] via-[#0d2626] to-[#051515]"
    )} data-match-end={state.phase === "fulltime" ? "true" : undefined}>

      {/* Overlay de pré-jogo — fase "pre" */}
      {state.phase === "pre" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="relative w-[480px] max-w-[92vw] rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#0c0c14]">
            {/* Faixa de cores dos times */}
            <div
              className="h-1 w-full"
              style={{ background: `linear-gradient(to right, ${homeTeam.cor1 || "#00ffc8"} 50%, ${awayTeam.cor1 || "#ffffff"} 50%)` }}
            />

            {/* Header da competição */}
            <div className="flex flex-col items-center py-4 border-b border-white/[0.06] bg-white/[0.02]">
              <span className="text-white/70 text-[11px] font-bold uppercase tracking-[0.2em]">
                {displayCompetition}
              </span>
              <span className="text-white/35 text-[10px] mt-0.5 tracking-wider">
                {displayRound}
              </span>
            </div>

            {/* Times */}
            <div className="flex items-center justify-between px-8 py-8 gap-4">
              {/* Time da casa */}
              <div className="flex flex-col items-center gap-3 flex-1">
                <div className="relative">
                  <div
                    className="absolute inset-0 blur-2xl opacity-40 scale-150 rounded-full"
                    style={{ backgroundColor: homeTeam.cor1 || "#00ffc8" }}
                  />
                  <TeamCrest team={homeTeam} size="3xl" className="relative drop-shadow-xl" />
                </div>
                <span className="text-white text-sm font-bold text-center leading-tight">{homeTeam.nome}</span>
              </div>

              {/* VS central */}
              <div className="flex flex-col items-center shrink-0 px-2">
                <span className="text-white/20 text-4xl font-black tracking-tight select-none">VS</span>
              </div>

              {/* Time visitante */}
              <div className="flex flex-col items-center gap-3 flex-1">
                <div className="relative">
                  <div
                    className="absolute inset-0 blur-2xl opacity-40 scale-150 rounded-full"
                    style={{ backgroundColor: awayTeam.cor1 || "#ffffff" }}
                  />
                  <TeamCrest team={awayTeam} size="3xl" className="relative drop-shadow-xl" />
                </div>
                <span className="text-white text-sm font-bold text-center leading-tight">{awayTeam.nome}</span>
              </div>
            </div>

            {/* Botão e hint */}
            <div className="px-6 pb-6 flex flex-col items-center gap-3 border-t border-white/[0.04] pt-5">
              <button
                onClick={comecarPartida}
                className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl bg-[var(--brand)] text-[var(--brand-ink)] font-black text-base hover:bg-[#00e6b5] transition-all shadow-lg shadow-[var(--brand)]/25 active:scale-[0.98]"
              >
                {tecnicoAdversario ? <FastForward className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
                {tecnicoAdversario ? "SIMULAR CONFRONTO" : "INICIAR PARTIDA"}
              </button>

              {/* Sem esta explicacao o jogador clica esperando o ao vivo e recebe
                  o placar pronto, sem entender o que aconteceu. */}
              {tecnicoAdversario ? (
                <p className="text-white/40 text-xs text-center leading-relaxed px-2">
                  O {userSide === "home" ? awayTeam.nome : homeTeam.nome} é de{" "}
                  <span className="text-white/70 font-semibold">{tecnicoAdversario.nome}</span>. Confronto entre
                  dois técnicos da mesa não é dirigido ao vivo — vale o que cada um já decidiu:
                  elenco, escalação e tática.
                </p>
              ) : (
                <p className="text-white/30 text-xs">
                  Pressione <kbd className="bg-white/10 px-2 py-0.5 rounded text-white/50">Enter</kbd> ou o botão A do controle
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Conteudo Principal - Estilo EA FC */}
      <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">

        {/* PLACAR DE TRANSMISSÃO — versão minimalista.
            A anterior era um totem de quatro andares: duas faixas grandes com a cor
            cheia do clube, o escudo da competição estourando por cima da junção, um
            bloco roxo para o placar e uma tarja rosa-degradê para o relógio. Muita
            cor e muita altura para uma informação que se lê em um segundo.
            Agora é UMA barra só: escudo, sigla, números, relógio. A cor do clube
            vira um filete de 3px — presente, sem gritar — e o resto é superfície
            escura neutra, que é o que as transmissões modernas fazem. */}
        <header className="relative z-10 shrink-0 px-4 pb-3 pt-4 sm:px-8">
          <div className="mx-auto flex w-fit flex-col items-center gap-1.5">

            {/* Competição, em texto — o emblema grande sobrava. */}
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
              {competitionLogo && (
                <img src={competitionLogo} alt="" className="h-4 w-4 object-contain opacity-70" />
              )}
              {displayCompetition}
            </div>

            {/* A barra */}
            <div className="flex items-stretch overflow-hidden rounded-lg border border-white/[0.08] bg-[#0b0e14]/90 shadow-[0_8px_28px_rgba(0,0,0,0.45)] backdrop-blur-sm">

              {/* Mandante */}
              <div className="flex items-center gap-2.5 py-2 pl-3 pr-4 sm:gap-3 sm:pl-4 sm:pr-5">
                <span className="h-7 w-[3px] rounded-full sm:h-8" style={{ backgroundColor: homeTeam.cor1 }} />
                <TeamCrest team={homeTeam} size="sm" />
                <span className="text-lg font-bold tracking-wide text-white sm:text-2xl">{siglaExibivel(homeTeam.curto, homeTeam.nome)}</span>
              </div>

              {/* Placar */}
              <div className="flex items-center gap-2.5 border-x border-white/[0.08] bg-white/[0.03] px-4 py-2 sm:gap-3 sm:px-6">
                <span className="text-2xl font-bold tabular-nums text-white sm:text-3xl">{state.home.goals}</span>
                <span className="text-lg font-light text-white/25 sm:text-xl">:</span>
                <span className="text-2xl font-bold tabular-nums text-white sm:text-3xl">{state.away.goals}</span>
              </div>

              {/* Visitante */}
              <div className="flex items-center gap-2.5 py-2 pl-4 pr-3 sm:gap-3 sm:pl-5 sm:pr-4">
                <span className="text-lg font-bold tracking-wide text-white sm:text-2xl">{siglaExibivel(awayTeam.curto, awayTeam.nome)}</span>
                <TeamCrest team={awayTeam} size="sm" />
                <span className="h-7 w-[3px] rounded-full sm:h-8" style={{ backgroundColor: awayTeam.cor1 }} />
              </div>

              {/* Relógio, encostado na barra. Acréscimo aparece colado no minuto,
                  como "45+2", em vez de virar mais um andar colorido. */}
              <div className="flex min-w-[62px] items-center justify-center gap-0.5 bg-white/[0.06] px-3 sm:min-w-[76px] sm:px-4">
                <span className="text-base font-bold tabular-nums text-white/90 sm:text-lg">
                  {(state.phase === "first" && state.addedTime > 0) ? "45" :
                   (state.phase === "second" && state.addedTime > 0) ? "90" :
                   state.minute}
                </span>
                {extraTime
                  ? <span className="text-[11px] font-bold text-[var(--brand)] sm:text-xs">+{extraTime}</span>
                  : <span className="text-base font-bold text-white/90 sm:text-lg">&apos;</span>}
              </div>
            </div>

            {/* Agregado do mata-mata, discreto embaixo do bloco. */}
            {aggregateScore && (
              <span className="whitespace-nowrap rounded-full border border-white/[0.08] bg-black/40 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-[.14em] text-white/50">
                Agregado {aggregateScore.home}–{aggregateScore.away}
                <span className="ml-2 font-normal text-white/30">
                  ida {aggregateScore.firstLegHome}–{aggregateScore.firstLegAway}
                </span>
              </span>
            )}
          </div>
        </header>

        {/* Area Principal - 3 Colunas */}
        <div className="flex-1 min-h-0 flex px-4 sm:px-8 pb-4 gap-4 sm:gap-8">
          
  {/* Coluna Esquerda - Escalação da Casa (ref. 16.png). As estatísticas seguem
      na aba "Estatísticas" do card central. */}
  <div className="hidden lg:flex flex-col justify-center w-52">
  <SideLineup team={homeTeam} squad={homeSquad} bench={homeBench} side="left" />
  </div>

          {/* Coluna Central - Conteudo baseado na Tab ativa */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 min-h-0 rounded-2xl bg-[#1a2a2a]/60 backdrop-blur-sm border border-white/[0.06] overflow-hidden flex flex-col">

              {/* Conteudo da Tab */}
              <div className={cn("flex-1 min-h-0 p-4", activeTab === "pitch" ? "flex flex-col" : "overflow-y-auto")}>
                {activeTab === "stats" && (
                  <div className="space-y-4">
                    <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-4">{t.match.live.sectionStats}</h3>
                    
  {/* Stats Comparativas */}
  <div className="space-y-3">
  <div className="grid grid-cols-[1fr_auto_1fr] items-center text-[10px] font-bold uppercase tracking-wider text-white/40">
  <span>{siglaExibivel(homeTeam.curto, homeTeam.nome)}</span>
  <span className="px-2 text-white/20">{t.match.live.statLabel}</span>
  <span className="text-right">{siglaExibivel(awayTeam.curto, awayTeam.nome)}</span>
  </div>
  <StatBar label="Posse de Bola" homeValue={state.home?.possession ?? 50} awayValue={state.away?.possession ?? 50} suffix="%" />
  <StatBar label="Chutes" homeValue={state.home?.shots ?? 0} awayValue={state.away?.shots ?? 0} />
  <StatBar label="Chutes no Alvo" homeValue={state.home?.shotsOnTarget ?? 0} awayValue={state.away?.shotsOnTarget ?? 0} />
  <StatBar label="Escanteios" homeValue={state.home?.corners ?? 0} awayValue={state.away?.corners ?? 0} />
  <StatBar label="Faltas" homeValue={state.home?.fouls ?? 0} awayValue={state.away?.fouls ?? 0} />
  <StatBar label="Passes" homeValue={state.home?.passes ?? 0} awayValue={state.away?.passes ?? 0} />
  <StatBar label="xG" homeValue={Math.round((state.home?.xG ?? 0) * 10) / 10} awayValue={Math.round((state.away?.xG ?? 0) * 10) / 10} />
  <StatBar label="xA" homeValue={Math.round((state.home?.xA ?? 0) * 10) / 10} awayValue={Math.round((state.away?.xA ?? 0) * 10) / 10} />
  <StatBar label="Entradas na Área" homeValue={state.home?.entradasNaArea ?? 0} awayValue={state.away?.entradasNaArea ?? 0} />
  <StatBar label="Recuperações Altas" homeValue={state.home?.recuperacoesAltas ?? 0} awayValue={state.away?.recuperacoesAltas ?? 0} />
  <div className="rounded-lg border border-white/[0.06] bg-black/15 p-2.5">
    <p className="mb-2 text-center text-[9px] font-bold uppercase tracking-wider text-white/35">Ataques por corredor · E / C / D</p>
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[10px] font-bold">
      <span className="text-white/65">{state.home.ataquesPorCorredor?.esquerda ?? 0} / {state.home.ataquesPorCorredor?.centro ?? 0} / {state.home.ataquesPorCorredor?.direita ?? 0}</span>
      <span className="text-white/20">×</span>
      <span className="text-right text-white/65">{state.away.ataquesPorCorredor?.esquerda ?? 0} / {state.away.ataquesPorCorredor?.centro ?? 0} / {state.away.ataquesPorCorredor?.direita ?? 0}</span>
    </div>
  </div>
  </div>
                  </div>
                )}

                {activeTab === "narration" && (
                  <div className="space-y-3">
                    <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-2">Narração ao vivo</h3>
                    {state.events.length === 0 ? (
                      <p className="text-white/30 text-sm py-8 text-center">O jogo vai começar...</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {state.events.map((e) => {
                          const color =
                            e.type === "goal" ? "text-emerald-400 font-semibold"
                            : e.type === "red_card" ? "text-red-400 font-semibold"
                            : e.type === "yellow_card" ? "text-yellow-400"
                            : e.type === "penalty" ? "text-orange-400 font-semibold"
                            : e.type === "var" ? "text-sky-300 font-semibold"
                            : e.type === "save" || e.type === "post" ? "text-cyan-300"
                            : e.type === "fulltime" || e.type === "halftime" || e.type === "kickoff" ? "text-white/80 font-semibold"
                            : "text-white/55"
                          const EventIcon =
                            e.type === "goal" ? Goal
                            : e.type === "red_card" || e.type === "yellow_card" ? Square
                            : e.type === "penalty" || e.type === "var" ? TargetIcon
                            : e.type === "corner" ? Flag
                            : e.type === "injury" ? Stethoscope
                            : e.type === "save" ? Hand
                            : e.type === "sub" ? ArrowLeftRight
                            : Circle
                          const iconClass =
                            e.type === "red_card" ? "fill-red-500 text-red-500"
                            : e.type === "yellow_card" ? "fill-yellow-400 text-yellow-400"
                            : e.type === "goal" ? "text-emerald-400"
                            : e.type === "penalty" ? "text-orange-400"
                            : e.type === "var" ? "text-sky-300"
                            : e.type === "corner" ? "text-rose-300"
                            : e.type === "injury" ? "text-red-300"
                            : e.type === "save" ? "text-cyan-300"
                            : "text-white/40"
                          const min = e.addedTime ? `${e.minute}+${e.addedTime}'` : `${e.minute}'`
                          return (
                            <li key={e.id} className="flex items-start gap-2 text-sm leading-snug">
                              <span className="shrink-0 tabular-nums text-white/40 w-10 text-right">{min}</span>
                              <EventIcon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", iconClass)} aria-hidden="true" />
                              <span className={color}>{e.text}</span>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )}

                {activeTab === "pitch" && (
                  // ── TELA CHEIA DO CAMPO ──────────────────────────────────
                  //
                  // Em tela cheia o bloco sai do fluxo e cobre a janela. O motor
                  // 3D se ajusta sozinho (ele tem ResizeObserver + setSize), por
                  // isso não é preciso avisá-lo nem remontar a cena — remontar
                  // perderia o lance em andamento.
                  //
                  // ⚠️ z-[150] fica ABAIXO da tela de passagem de vez (z-200) e
                  // ACIMA do cabeçalho: assistir não pode esconder a troca de
                  // técnico no co-op, que é o que protege o elenco de cada um.
                  <div className={cn(
                    "flex min-h-0 flex-col gap-3",
                    campoEmTelaCheia
                      ? "fixed inset-0 z-[150] bg-[#05070b] p-4"
                      : "flex-1",
                  )}>
                    <div className="flex shrink-0 items-center justify-between gap-3">
                      {campoEmTelaCheia ? (
                        // Sem o resto da tela, o placar e o minuto precisam vir
                        // junto: assistir sem saber como está o jogo é inútil.
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-white">{siglaExibivel(homeTeam.curto, homeTeam.nome)}</span>
                          <span className="rounded-lg bg-white/[0.08] px-3 py-1 text-lg font-black tabular-nums text-white">
                            {state.home.goals} <span className="text-white/30">×</span> {state.away.goals}
                          </span>
                          <span className="text-sm font-bold text-white">{siglaExibivel(awayTeam.curto, awayTeam.nome)}</span>
                          <span className="ml-2 rounded-md bg-[var(--brand)]/15 px-2 py-0.5 text-xs font-bold tabular-nums text-[var(--brand)]">
                            {state.minute}&apos;
                          </span>
                        </div>
                      ) : (
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/60">{t.match.live.sectionPitch}</h3>
                          <p className="text-[10px] text-white/35">Estrutura ativa: {formacaoDaFase}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <div className="flex rounded-lg border border-white/10 bg-black/25 p-1">
                          <button type="button" onClick={() => setUsarCampo3D(false)} className={cn("rounded px-3 py-1 text-xs font-bold", !usarCampo3D ? "bg-white/15 text-white" : "text-white/45")}>2D</button>
                          <button type="button" disabled={Boolean(falhaCampo3D)} onClick={() => setUsarCampo3D(true)} className={cn("rounded px-3 py-1 text-xs font-bold", usarCampo3D ? "bg-[var(--brand)]/20 text-[var(--brand)]" : "text-white/45", falhaCampo3D && "cursor-not-allowed opacity-40")}>3D</button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCampoEmTelaCheia(v => !v)}
                          title={campoEmTelaCheia ? "Sair da tela cheia (Esc)" : "Assistir em tela cheia (F)"}
                          aria-label={campoEmTelaCheia ? "Sair da tela cheia" : "Assistir em tela cheia"}
                          className="rounded-lg border border-white/10 bg-black/25 p-2 text-white/60 transition-colors hover:text-white"
                        >
                          {campoEmTelaCheia ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    {falhaCampo3D && <AvisoQuedaPara2D motivo={falhaCampo3D} />}
                    {usarCampo3D && !falhaCampo3D ? (
                      <Campo3D
                        eventos={eventosDo3D}
                        velocidade={velocidadeDo3D}
                        pausado={!isRunning}
                        formacao={formacaoDaFase}
                        casa={{ nome: homeTeam.nome, sigla: homeTeam.curto, corPrincipal: homeKitColor, corSecundaria: homeTeam.cor2 }}
                        fora={{ nome: awayTeam.nome, sigla: awayTeam.curto, corPrincipal: awayKitColor, corSecundaria: awayTeam.cor2 }}
                        titularesCasa={homeSquad.map(j => ({ id: String(j.atletaId ?? j.id), nome: j.name, numero: j.number, posicao: j.position }))}
                        titularesFora={awaySquad.map(j => ({ id: String(j.atletaId ?? j.id), nome: j.name, numero: j.number, posicao: j.position }))}
                        duracaoDoTempo={matchCtx.duration}
                        aoFalhar={motivo => { setFalhaCampo3D(motivo); setUsarCampo3D(false) }}
                      />
                    ) : <MatchRadar
                      homeTeam={homeTeam}
                      awayTeam={awayTeam}
                      homeSquad={homeSquad}
                      awaySquad={awaySquad}
                      ball={state.ball}
                      event={radarEvent}
                      homePossession={state.home?.possession ?? 50}
                      minute={state.minute}
                      phase={state.phase}
                      homeFormation={userSide === "home" ? liveFormation : undefined}
                      awayFormation={userSide === "away" ? liveFormation : undefined}
                      homeColor={homeKitColor}
                      awayColor={awayKitColor}
                    />}
                  </div>
                )}

                {activeTab === "gameplan" && (
                  <div className="space-y-4">
                    <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-4">{t.match.live.sectionGameplan}</h3>

                    {/* Campo tático e mudança real de formação durante a partida. */}
                    <div className="rounded-xl border border-[var(--brand)]/20 bg-[#071817]/75 p-3">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider text-white">Escalação em campo</p>
                          <p className="mt-0.5 text-[11px] text-white/45">A formação é aplicada imediatamente ao radar e à partida.</p>
                        </div>
                        <span className="rounded-md bg-[var(--brand)]/15 px-2 py-1 text-sm font-black text-[var(--brand)]">{liveFormation}</span>
                      </div>
                      <div className="mb-3 grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                        {["4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "5-3-2"].map(formation => (
                          <button
                            key={formation}
                            type="button"
                            onClick={() => applyLiveFormation(formation)}
                            className={cn(
                              "rounded-md border px-1.5 py-2 text-[11px] font-bold transition-colors",
                              liveFormation === formation
                                ? "border-[var(--brand)] bg-[var(--brand)]/15 text-[var(--brand)]"
                                : "border-white/10 bg-black/20 text-white/60 hover:border-white/30 hover:text-white",
                            )}
                          >
                            {formation}
                          </button>
                        ))}
                      </div>
                      {liveTacticNotice && <p className="mb-2 text-[11px] font-semibold text-[var(--brand)]" role="status">{liveTacticNotice}</p>}
                      <div className="h-44 overflow-hidden rounded-lg border border-white/10 bg-black/20 sm:h-52">
                        <MatchRadar
                          homeTeam={homeTeam}
                          awayTeam={awayTeam}
                          homeSquad={homeSquad}
                          awaySquad={awaySquad}
                          ball={state.ball}
                          event={radarEvent}
                          homePossession={state.home?.possession ?? 50}
                          minute={state.minute}
                          phase={state.phase}
                          homeFormation={userSide === "home" ? liveFormation : undefined}
                          awayFormation={userSide === "away" ? liveFormation : undefined}
                          homeColor={homeKitColor}
                          awayColor={awayKitColor}
                        />
                      </div>
                    </div>

                    {/* Mentalidade AO VIVO do time do usuario — muda a simulacao na hora. */}
                    <div className="mb-4 rounded-lg border border-[var(--brand)]/20 bg-[var(--brand)]/[0.04] p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-white/70 text-xs font-semibold uppercase tracking-wider">Sua mentalidade</span>
                        <span className="text-white/30 text-[10px]">muda em tempo real</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          ["defensivo", "Defensivo", "+ solidez"],
                          ["equilibrado", "Equilibrado", "neutro"],
                          ["ofensivo", "Ofensivo", "+ ataque"],
                        ] as const).map(([val, label, hint]) => (
                          <button
                            key={val}
                            onClick={() => setUserMentality(val)}
                            className={cn(
                              "rounded-lg border px-2 py-2 text-center transition-all",
                              userMentality === val
                                ? "border-[var(--brand)] bg-[var(--brand)]/15 text-[var(--brand)]"
                                : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]",
                            )}
                          >
                            <div className="text-xs font-bold">{label}</div>
                            <div className="text-[9px] opacity-70">{hint}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Decisoes do tecnico — ataque, defesa, energia, moral e
                        pressao permanecem ativos ate o minuto exibido. */}
                    <div className="mb-4 rounded-lg border border-amber-400/20 bg-amber-400/[0.04] p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-white/70">Decisões do técnico</span>
                        {sim.suggestedDecision && (
                          <span className="text-[10px] text-amber-300">auxiliar sugere</span>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {([
                          ["gritar", "Gritar"],
                          ["acalmar", "Acalmar"],
                          ["pressionar", "Pressionar"],
                          ["recuar", "Recuar"],
                          ["tudo_ou_nada", "Tudo ou nada"],
                          ["segurar_resultado", "Segurar"],
                          ["bola_longa", "Bola longa"],
                          ["sub_sugerida", "Poupar"],
                        ] as const).map(([id, label]) => {
                          const active = sim.activeDecisions.some(d => d.id === id)
                          const suggested = sim.suggestedDecision === id
                          return (
                            <button
                              key={id}
                              onClick={() => sim.applyCoachDecision(id)}
                              className={cn(
                                "rounded-lg border px-1.5 py-2 text-center text-[10px] font-bold transition-all",
                                active
                                  ? "border-amber-400 bg-amber-400/20 text-amber-200"
                                  : suggested
                                    ? "border-amber-300/60 bg-amber-300/10 text-amber-200"
                                    : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]",
                              )}
                            >
                              {label}
                            </button>
                          )
                        })}
                      </div>
                      {sim.activeDecisions.length > 0 && (
                        <div className="mt-2 space-y-1 text-[10px] text-white/45">
                          <p>Em vigor: {sim.activeDecisions.map(d => `${d.id.replace(/_/g, " ")} (até ${d.appliedAtMinute + d.effect.durationMinutes}')`).join(" · ")}</p>
                          <p className="text-amber-200/70">
                            Ataque {sim.decisionEffect.attackDelta >= 0 ? "+" : ""}{sim.decisionEffect.attackDelta}
                            {" · "}Defesa {sim.decisionEffect.defenseDelta >= 0 ? "+" : ""}{sim.decisionEffect.defenseDelta}
                            {" · "}Energia {sim.decisionEffect.energyDelta >= 0 ? "+" : ""}{sim.decisionEffect.energyDelta}
                            {" · "}Moral {sim.decisionEffect.moraleDelta >= 0 ? "+" : ""}{sim.decisionEffect.moraleDelta}
                            {" · "}Pressão +{sim.decisionEffect.pressureDelta}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Formacao Casa */}
                      <div className="bg-white/5 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <TeamCrest team={homeTeam} size="xs" />
                          <span className="text-white text-sm font-medium">{siglaExibivel(homeTeam.curto, homeTeam.nome)}</span>
                        </div>
                        <div className="text-[var(--brand)] text-lg font-bold">{userSide === "home" ? liveFormation : "4-4-2"}</div>
                        <div className="text-white/40 text-xs mt-1">Posse: Equilibrado</div>
                        <div className="text-white/40 text-xs">Mentalidade: Normal</div>
                      </div>

                      {/* Formacao Fora */}
                      <div className="bg-white/5 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <TeamCrest team={awayTeam} size="xs" />
                          <span className="text-white text-sm font-medium">{siglaExibivel(awayTeam.curto, awayTeam.nome)}</span>
                        </div>
                        <div className="text-[var(--brand)] text-lg font-bold">{userSide === "away" ? liveFormation : "4-4-2"}</div>
                        <div className="text-white/40 text-xs mt-1">Posse: Equilibrado</div>
                        <div className="text-white/40 text-xs">Mentalidade: Normal</div>
                      </div>
                    </div>

                    {/* Substituicoes */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white/40 text-xs uppercase tracking-wider">{t.match.live.substitutions}</span>
                        <span className="text-[var(--brand)] text-xs font-bold">{t.match.live.subsRemaining(subsRemaining)}</span>
                      </div>
                      {state.events.filter(e => e.type === "sub" && e.side === "home").length > 0 ? (
                        <div className="space-y-1">
                          {state.events
                            .filter(e => e.type === "sub" && e.side === "home")
                            .map((sub, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs bg-white/5 rounded p-2">
                                <span className="text-white/40">{sub.minute}&apos;</span>
                                <ArrowDownUp className="h-3 w-3 text-amber-400" />
                                <span className="text-white">{sub.player}</span>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <div className="text-white/30 text-xs">{t.match.live.noSubs}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Tabs no rodape do card */}
              <div className="border-t border-white/[0.06] bg-[#0d1a1a]/50">
                <div className="flex items-center justify-start overflow-x-auto px-4 py-2 scrollbar-thin scrollbar-thumb-white/15">
                  <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white/40 mr-2">L1</span>
                  <TabButton label="Narração" active={activeTab === "narration"} onClick={() => setActiveTab("narration")} />
                  <TabButton label={t.match.live.tabPitch} active={activeTab === "pitch"} onClick={() => setActiveTab("pitch")} />
                  <TabButton label={t.match.live.tabStats} active={activeTab === "stats"} onClick={() => setActiveTab("stats")} />
                  <TabButton label={t.match.live.tabGameplan} active={activeTab === "gameplan"} onClick={() => setActiveTab("gameplan")} />
                  <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white/40 ml-2">R1</span>
                </div>
              </div>
            </div>

          </div>

  {/* Coluna Direita - Escalação do Visitante (espelhada, ref. 16.png) */}
  <div className="hidden lg:flex flex-col justify-center gap-4 w-52">
  {/* JOGOS QUE IMPORTAM. Fica na coluna já reservada a informação ao vivo, e
      só em partida de LIGA: em copa não há tabela para brigar por posição. */}
  {jogosDoRival.length > 0 && isMatchInProgress && (
    <RivaisAoVivoPainel
      jogos={jogosDoRival}
      minuto={state.minute}
      semente={`${currentMatch?.competition ?? ""}:${currentMatch?.week ?? 0}`}
    />
  )}
  {sideFoul && (
    <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 shadow-[0_12px_35px_rgba(0,0,0,.25)]" role="status" aria-live="polite">
      <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-amber-300">
        <AlertTriangle className="h-3.5 w-3.5" /> Falta marcada
      </div>
      <p className="text-xs leading-snug text-white/80">{sideFoul.text}</p>
      <p className="mt-1 text-[10px] font-bold tabular-nums text-white/40">{sideFoul.minute}&apos;</p>
    </div>
  )}
  <SideLineup team={awayTeam} squad={awaySquad} bench={awayBench} side="right" />
  </div>
        </div>

        {/* Barra de Acoes - Rodape */}
        <div className="shrink-0 border-t border-white/[0.06] bg-[#0a1515]/80 backdrop-blur-sm px-4 sm:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 sm:gap-6">
              {/* Controles da partida */}
              {state.phase === "pre" && (
                <Button
                  size="sm"
                  onClick={comecarPartida}
                  className="text-xs bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand)]/80 font-bold"
                >
                  {tecnicoAdversario
                    ? <FastForward className="mr-1 h-3.5 w-3.5" />
                    : <Play className="mr-1 h-3.5 w-3.5 fill-current" />}
                  {tecnicoAdversario ? "SIMULAR" : "INICIAR"}
                </Button>
              )}
              {isMatchInProgress && (
                <>
                  {isRunning ? (
                    <Button size="sm" onClick={pause} variant="ghost" className="text-xs text-white/70 hover:text-white hover:bg-white/10">
                      <Pause className="mr-1 h-3.5 w-3.5" />
                      PAUSAR
                    </Button>
                  ) : (
                    <Button size="sm" onClick={resume} className="text-xs bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand)]/80 font-bold">
                      <Play className="mr-1 h-3.5 w-3.5 fill-current" />
                      CONTINUAR
                    </Button>
                  )}
                </>
              )}

              {/* Advance Button */}
              <button
                type="button"
                onClick={fastForward}
                disabled={state.phase === "fulltime"}
                className="flex items-center gap-2 hover:text-white disabled:opacity-40 disabled:hover:text-white/60 transition-colors"
              >
                <span className="text-[10px] bg-white/10 px-2 py-1 rounded text-white/50 font-bold">X</span>
                <span className="text-white/60 text-sm">Avancar</span>
              </button>

              {/* Substituicao sempre visivel durante o jogo (teclado T / Y-Triangulo). */}
              {isMatchInProgress && (
                <button
                  type="button"
                  onClick={() => { pause(); setShowSubModal(true) }}
                  disabled={subsRemaining <= 0}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-35"
                >
                  <span className="rounded bg-[var(--brand)]/15 px-2 py-1 text-[10px] font-black text-[var(--brand)]">T</span>
                  <ArrowDownUp className="h-3.5 w-3.5 text-[var(--brand)]" />
                  <span className="text-sm">Substituir ({subsRemaining})</span>
                </button>
              )}

              {/* Post-Match Interview */}
              {state.phase === "fulltime" && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-white/10 px-2 py-1 rounded text-white/50">
                    <Triangle className="w-3 h-3 fill-current" />
                  </span>
                  <span className="text-white/60 text-sm">Coletiva pos-jogo</span>
                </div>
              )}
            </div>

            {/* Velocidade */}
            <div className="hidden sm:flex items-center gap-2">
              {SPEEDS.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSpeed(s.id)}
                  className={cn(
                    "px-2 py-1 text-[10px] font-bold rounded transition",
                    speed === s.id
                      ? "bg-[var(--brand)] text-[var(--brand-ink)]"
                      : "bg-white/10 text-white/50 hover:bg-white/20"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Substituição */}
      {showSubModal && (
        <SubstitutionModal
          open={showSubModal}
          team={userTeamForSub}
          starters={userStarters}
          bench={userBench}
          subsRemaining={subsRemaining}
          onClose={() => setShowSubModal(false)}
          onConfirm={handleSub}
        />
      )}

      {/* Modal de Resultado — usa os times congelados no apito final */}
      {showResult && (
        <MatchResultModal
          open={showResult}
          homeTeam={finalMatch?.home ?? homeTeam}
          awayTeam={finalMatch?.away ?? awayTeam}
          state={state}
          userSide={finalMatch?.userSide ?? userSide}
          isFinal={false}
          isChampion={isLeagueChampion}
          onClose={() => {
            setShowResult(false)
            // Ordem obrigatoria: placar/estatisticas -> resultados da rodada -> imprensa.
            // A base tambem passa pela tela para manter a experiencia igual ao profissional.
            setShowRoundResults(true)
          }}
        />
      )}

  {/* Resultados de toda a rodada (todas as competicoes) antes da coletiva */}
  {showRoundResults && (
    <RoundResultsModal
      open={showRoundResults}
      results={postMatchRoundResults}
      userHome={(finalMatch?.home ?? homeTeam).curto}
      userAway={(finalMatch?.away ?? awayTeam).curto}
      onContinue={() => {
        setShowRoundResults(false)
        setShowPressConference(true)
      }}
    />
  )}

  {/* Coletiva pos-jogo */}
  {showPressConference && (
    <PostMatchPress
      isOpen={showPressConference}
      homeTeam={finalMatch?.home ?? homeTeam}
      awayTeam={finalMatch?.away ?? awayTeam}
      homeGoals={state.home.goals}
      awayGoals={state.away.goals}
      userSide={finalMatch?.userSide ?? userSide}
      onClose={() => setShowPressConference(false)}
      // Artilheiros do MEU time nesta partida: alimentam as perguntas
      // individuais da coletiva (elogiar/cobrar alguem de verdade).
      atletasDaPartida={(() => {
        const meuLado = finalMatch?.userSide ?? userSide
        const golsPorAtleta = new Map<string, number>()
        for (const e of state.events) {
          if (e.type !== "goal" || e.side !== meuLado || !e.player) continue
          golsPorAtleta.set(e.player, (golsPorAtleta.get(e.player) ?? 0) + 1)
        }
        return [...golsPorAtleta.entries()].map(([nome, gols]) => ({ nome, gols }))
      })()}
      onComplete={async ({ moraleImpact, tons, repercussoes }) => {
        setShowPressConference(false)

        // A coletiva agora TEM consequencia. O callback recebia o saldo das
        // respostas e ignorava o valor: escolher "vou cobrar no vestiario" ou
        // "o grupo esta de parabens" dava exatamente no mesmo lugar.
        const userGoals = (finalMatch?.userSide ?? userSide) === "home" ? state.home.goals : state.away.goals
        const rivalGoals = (finalMatch?.userSide ?? userSide) === "home" ? state.away.goals : state.home.goals
        const efeito = calcularEfeitoColetiva({
          moraleImpact,
          tons,
          venceu: userGoals > rivalGoals,
          perdeu: userGoals < rivalGoals,
          comunicacao: tecnico.impactoDaColetiva,
        })

        if (efeito.moralDelta !== 0 || efeito.diretoriaDelta !== 0) {
          const atual = loadGameState()
          setSavedGame({
            teamMorale: Math.max(0, Math.min(100, (atual.teamMorale ?? 65) + efeito.moralDelta)),
            boardConfidence: Math.max(0, Math.min(100, (atual.boardConfidence ?? 60) + efeito.diretoriaDelta)),
          })
        }

        // ── CONDUTA DO TREINADOR (1.0.377) ────────────────────────────────
        //
        // ⚠️ A COLETIVA AGRESSIVA PRECISAVA CUSTAR ALGUMA COISA ALÉM DE HOJE.
        // Ela já mexia em moral e confiança na hora (acima), e ali parava: no
        // jogo seguinte a ficha estava limpa de novo. Bater na arbitragem ou
        // atacar o clube em três coletivas seguidas não deixava rastro nenhum,
        // e o técnico que faz isso toda semana terminava a temporada com a
        // mesma reputação de quem nunca abriu a boca.
        //
        // Agora vira INCIDENTE, e o incidente entra no índice de conduta que a
        // diretoria lê ao decidir demissão (`computeBoardConfidence`). Ele
        // prescreve com o tempo — ver `condutaDoTreinador`.
        const agressivas = (tons ?? []).filter(t => t === "agressivo").length
        if (agressivas > 0) {
          const atual = loadGameState()
          const jaTem = atual.incidentesDoTreinador ?? []
          const id = `coletiva_${atual.season}_${atual.currentRound ?? 0}`
          if (!jaTem.some(i => i.id === id)) {
            setSavedGame({
              incidentesDoTreinador: [...jaTem, {
                id,
                temporada: atual.season,
                // Duas respostas agressivas na MESMA coletiva já não é
                // desabafo: é o tom da entrevista inteira, e pesa mais.
                tipo: agressivas >= 2 ? "briga_com_arbitro" as const : "critica_publica" as const,
                descricao: agressivas >= 2
                  ? "Coletiva inteira em tom de confronto."
                  : "Crítica pública depois da partida.",
              }].slice(-60),
            })
          }
        }
        // O jogador precisa VER a consequencia; senao o efeito existe e passa
        // despercebido, que na pratica e o mesmo que nao existir.
        if (efeito.recadoElenco) {
          addNotification({ type: "system", priority: efeito.moralDelta > 0 ? "medium" : "high",
            title: efeito.recadoElenco.titulo, message: efeito.recadoElenco.texto })
        }
        if (efeito.recadoDiretoria) {
          addNotification({ type: "system", priority: efeito.diretoriaDelta > 0 ? "medium" : "high",
            title: efeito.recadoDiretoria.titulo, message: efeito.recadoDiretoria.texto })
        }
        // RECADO DE CADA ATLETA CITADO na coletiva (pedido: elogiar o Memphis
        // gera mensagem dele). Elogio agrada, cobranca publica magoa.
        for (const r of repercussoes ?? []) {
          addNotification({
            type: "news", priority: r.tom === "cobranca" ? "high" : "medium",
            title: r.titulo, message: r.mensagem,
          })
        }

        // O save so pode liberar a tela depois que resultado, rodada e motor foram
        // confirmados no disco. O href direto quebrava no build Tauri (ERR_FILE_NOT_FOUND)
        // e podia matar o autosave ainda pendente.
        if (postMatchAdvance.current) await postMatchAdvance.current
        persistGameEngineNow()
        await flushPersistentStore()
        await saveGameStateAndFlush(loadGameState())
        // REARMA o portao da caixa de entrada: ele so dispara uma vez por sessao
        // do app, mas o usuario quer a Central SEMPRE apos a partida — e e depois
        // do jogo que chegam os recados do elenco, da diretoria e do mercado.
        try { sessionStorage.removeItem("ultrafoot:inbox-gate-shown") } catch { /* ignora */ }
        // Pos-partida vai ao PRE-OFFICE (pedido), nao ao escritorio direto: e
        // la que ficam o resumo da rodada, as tarefas e o proximo compromisso.
        //
        // EXCECAO: os LEILOES entram ANTES do pre-office (pedido). Um leilao tem
        // prazo de tres semanas; enquanto ele vivia numa aba do Mercado, o
        // tecnico perdia o alvo sem nunca ter sido avisado.
        //
        // Quem decide se ha disputa e a PROPRIA tela de leiloes: descobrir isso
        // aqui exigiria gerar o catalogo inteiro do mercado no fim da partida.
        // Sem leilao aberto, ela segue sozinha para o pre-office.
        // A seleção não tem leilão nem pré-office de clube: o técnico volta para
        // o escritório da seleção, que é onde está a competição dele.
        // ⚠️ SÓ NAVEGA SE O JOGADOR AINDA ESTIVER AQUI. As esperas acima duram
        // segundos; quem saiu da partida nesse meio-tempo já escolheu para onde
        // ir, e levá-lo ao leilão seria tirá-lo da tela que ele abriu. O
        // `pathname` entra como segunda trava porque o ref sozinho não cobre o
        // caso de a tela ter sido recarregada por baixo.
        if (!telaAberta.current) return
        if (typeof window !== "undefined" && !window.location.pathname.includes("/partida")) return
        hardNavigate(matchCtx.national ? "/selecao" : matchCtx.youth ? "/base/carreira" : "/leiloes")
      }}
    />
  )}

  {/* Animacoes de eventos */}
  <EventAnimation
    event={currentAnimation?.type ?? null}
    team={currentAnimation?.team}
    player={currentAnimation?.player}
    minute={currentAnimation?.minute}
    onComplete={handleAnimationComplete}
  />

  {/* DISPUTA DE PENALTIS: mata-mata empatado ao fim dos 90. */}
  {state.phase === "penaltis" && state.shootout && (
    <ShootoutModal
      shootout={state.shootout}
      homeTeam={homeTeam}
      awayTeam={awayTeam}
      userSide={userSide}
      takers={shootoutTakers}
      onKick={kickShootout}
      onFinish={() => endShootout()}
    />
  )}

  {/* Modal de selecao de batedor de penalti */}
  <PenaltyTakerModal
    isOpen={showPenaltyModal}
    team={userSide === "home" ? homeTeam : awayTeam}
    players={userSide === "home" ? homeSquad : awaySquad}
    onSelectPlayer={(p) => handlePenaltyTaker(p as unknown as MatchPlayer)}
    onFinish={handlePenaltyFinish}
    onClose={() => {
      // Fechar sem escolher NAO pode congelar a partida: o relogio so anda quando o
      // penalti pendente e resolvido. Passando null, o motor escolhe o batedor.
      takePenalty(null)
      handlePenaltyFinish()
    }}
  />
  </div>
  )
}

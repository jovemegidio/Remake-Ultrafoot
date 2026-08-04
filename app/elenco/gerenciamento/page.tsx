"use client"

import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ChevronLeft, 
  ChevronRight,
  Star,
  Zap,
  ArrowUpRight,
  Heart,
  Gauge,
  Shield,
  Target,
  TrendingUp,
  Smile,
  ArrowLeftRight,
  RotateCcw,
  Shuffle,
  Trophy,
  Info,
  Scale,
  Clock,
  X,
  Gamepad2,
  Save,
  Check,
  RectangleHorizontal,
  RectangleVertical,
} from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { TeamCrest } from "@/components/team-crest"
import { PlayerAvatar, PlayerAvatarCircle } from "@/components/player-avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ContractNegotiationModal } from "@/components/squad/contract-negotiation-modal"
import { RenovacaoEmprestimoModal } from "@/components/squad/renovacao-emprestimo-modal"
import { artilheiros, cartoes } from "@/lib/leaderboards"
import { FORMATIONS, assignPlayersToFormation, detectarFormacao, normalizePosition, penalidadeImprovisacao, posicaoPelaCoordenada, pickStartingXI } from "@/lib/formations"
import { formatCurrency, getCamisaUrl, isKitVariantAvailable, getTeamByShort, serieATeams } from "@/lib/teams-data"
import { useGameState } from "@/lib/save-system"
import { useDiscordActivity } from "@/hooks/use-discord-rpc"
import { absoluteWeek, CONTRACT_EPOCH_SEASON, defaultRoleForPosition, getContractStatus, isTransferWindowOpen, PLAYER_ROLE_INFO, saveTacticalSetup, terminationCost, useGameEngine, type Player as EnginePlayer, type PlayerRole } from "@/lib/game-engine"
import { useUserRoster, resolverIdsDosTitulares } from "@/lib/use-user-roster"
import { useRequireClub } from "@/lib/use-require-team"
import { useNotifications } from "@/components/notifications-system"
import { avisar as avisarNoJogo, confirmar as confirmarNoJogo } from "@/lib/dialogo-do-jogo"
import { useTranslation } from "@/lib/i18n"
import { announceOnlineAction } from "@/lib/online-multiplayer"
import { generateRetirementSuccessor } from "@/lib/youth-academy"

// FORMATIONS agora vive em lib/formations.ts (compartilhado com a Central de Transferencias).

// Mock players data
// Os elencos MOCK (playersData/benchData) foram REMOVIDOS: eram o elenco do RB
// Bragantino que vazava para todos os clubes quando o save ainda nao havia hidratado.
// Sem time nao se monta elenco nenhum — a tela mostra "carregando".

const positionColors: Record<string, { bg: string; text: string; border: string }> = {
  GOL: { bg: "bg-amber-500/30", text: "text-amber-400", border: "border-amber-500/50" },
  ZAG: { bg: "bg-blue-500/30", text: "text-blue-400", border: "border-blue-500/50" },
  LD: { bg: "bg-blue-500/30", text: "text-blue-400", border: "border-blue-500/50" },
  LE: { bg: "bg-blue-500/30", text: "text-blue-400", border: "border-blue-500/50" },
  ALD: { bg: "bg-blue-500/30", text: "text-blue-400", border: "border-blue-500/50" },
  ALE: { bg: "bg-blue-500/30", text: "text-blue-400", border: "border-blue-500/50" },
  VOL: { bg: "bg-green-500/30", text: "text-green-400", border: "border-green-500/50" },
  MEI: { bg: "bg-green-500/30", text: "text-green-400", border: "border-green-500/50" },
  MD: { bg: "bg-green-500/30", text: "text-green-400", border: "border-green-500/50" },
  ME: { bg: "bg-green-500/30", text: "text-green-400", border: "border-green-500/50" },
  PD: { bg: "bg-purple-500/30", text: "text-purple-400", border: "border-purple-500/50" },
  PE: { bg: "bg-purple-500/30", text: "text-purple-400", border: "border-purple-500/50" },
  ATA: { bg: "bg-red-500/30", text: "text-red-400", border: "border-red-500/50" },
  GL: { bg: "bg-amber-500/30", text: "text-amber-400", border: "border-amber-500/50" },
}

function getOverallColor(overall: number) {
  if (overall >= 85) return "text-yellow-400"
  if (overall >= 80) return "text-lime-400"
  if (overall >= 75) return "text-green-400"
  if (overall >= 70) return "text-blue-400"
  return "text-gray-400"
}

function getStatColor(stat: number) {
  if (stat >= 85) return "text-yellow-400"
  if (stat >= 80) return "text-lime-400"
  if (stat >= 70) return "text-green-400"
  if (stat >= 60) return "text-orange-400"
  return "text-red-400"
}

function getMoralColor(moral: string) {
  switch (moral) {
    case "Feliz": return "text-green-400"
    case "Motivado": return "text-lime-400"
    case "Normal": return "text-yellow-400"
    default: return "text-gray-400"
  }
}

function getStarRating(fintas: number) {
  return Array(5).fill(0).map((_, i) => (
    <Star 
      key={i} 
      className={cn(
        "h-3 w-3",
        i < fintas ? "fill-yellow-400 text-yellow-400" : "text-white/20"
      )} 
    />
  ))
}

// buildElencoPlayers agora vive em lib/use-user-roster.ts (compartilhado com a Escalacao).

/**
 * FAIXA DA CARTA pelo overall — preta, dourada ou bronze.
 *
 * É a leitura que o jogador de futebol faz de relance e que a referência (PES)
 * usa: a cor diz o patamar antes de você ler o número. Três faixas, como pedido:
 * craque (90+) preta, titular consolidado (75-89) dourada, o resto bronze.
 */
type FaixaDaCarta = "preta" | "dourada" | "bronze"

function faixaPorOverall(overall: number): FaixaDaCarta {
  if (overall >= 90) return "preta"
  if (overall >= 75) return "dourada"
  return "bronze"
}

const ESTILO_DA_FAIXA: Record<FaixaDaCarta, { anel: string; fundo: string; texto: string; brilho: string }> = {
  preta: {
    anel: "#e8e8ec",
    fundo: "linear-gradient(160deg,#2b2b33 0%,#0b0b0f 55%,#1a1a20 100%)",
    texto: "#f2f2f6",
    brilho: "0 0 12px rgba(230,230,240,0.45)",
  },
  dourada: {
    anel: "#f5c542",
    fundo: "linear-gradient(160deg,#8a6b16 0%,#3a2c07 55%,#6b520f 100%)",
    texto: "#ffe9a8",
    brilho: "0 0 12px rgba(245,197,66,0.45)",
  },
  bronze: {
    anel: "#c07b46",
    fundo: "linear-gradient(160deg,#6b452a 0%,#2c1c11 55%,#54361f 100%)",
    texto: "#f0cfae",
    brilho: "0 0 10px rgba(192,123,70,0.35)",
  },
}

/**
 * CARTA DO ATLETA — o card da prancheta HORIZONTAL, no estilo da referência.
 *
 * Só existe na horizontal por um motivo prático: em pé, o campo é estreito e
 * onze retratos de 40px viram onze borrões indistinguíveis — a camisa com o
 * número se lê melhor. Deitado sobra largura, e aí o rosto passa a ser a forma
 * mais rápida de achar um atleta no meio dos onze.
 *
 * A foto vem de `getPlayerPhotoUrl` (PlayerAvatar), a mesma do resto do jogo;
 * quem não tem retrato cai na silhueta por posição, nunca num quadrado vazio.
 *
 * O OVERALL EXIBIDO é o EFETIVO naquele slot. Um goleiro escalado na zaga não
 * mostra mais o 78 dele: mostra o que ele de fato rende ali. O motor já aplicava
 * essa penalidade na partida (`penalidadeImprovisacao`), mas ela era invisível
 * na hora de escalar — o técnico só descobria pelo resultado.
 */
function CartaDeJogador({
  nome, fileKey, posicao, slot, overall, numero, selecionado, funcao, promessa, pills, emTreino,
}: {
  nome: string
  fileKey: string
  /** Posição de ORIGEM do atleta. */
  posicao: string
  /** Slot da formação que ele está ocupando. */
  slot: string
  overall: number
  numero?: number
  selecionado: boolean
  funcao: string | null
  promessa: boolean
  pills: { key: string; label: string; cls: string }[]
  emTreino?: boolean
}) {
  const fator = penalidadeImprovisacao(posicao, slot)
  const improvisado = fator < 1
  const overallEfetivo = Math.round(overall * fator)
  // A FAIXA segue o overall EFETIVO: um craque improvisado no gol deixa de ser
  // carta preta, porque ali ele não joga como craque.
  const estilo = ESTILO_DA_FAIXA[faixaPorOverall(overallEfetivo)]

  return (
    <div className="relative flex flex-col items-center">
      {/* A BOLA: rosto ao centro, overall à esquerda e posição à direita, com o
          anel na cor da faixa — o formato da referência. Redonda em vez de
          retangular porque onze retratos redondos se distinguem melhor sobre o
          gramado do que onze retângulos colados. */}
      <div
        className={cn(
          "relative flex h-[52px] w-[52px] items-center justify-center rounded-full border-2 transition-all md:h-[60px] md:w-[60px]",
        )}
        style={{
          background: estilo.fundo,
          borderColor: selecionado ? "var(--brand)" : estilo.anel,
          boxShadow: selecionado ? "0 0 14px var(--brand)" : estilo.brilho,
        }}
      >
        <PlayerAvatar
          name={nome}
          fileKey={fileKey}
          position={posicao}
          size="lg"
          className="h-[44px] w-[44px] rounded-full border-0 bg-transparent md:h-[52px] md:w-[52px]"
        />

        {/* OVERALL EFETIVO. Improvisado, ele aparece em âmbar e com o valor de
            origem riscado ao lado — é a diferença que explica por que o time
            rendeu menos, e ela precisa ser vista ANTES do apito. */}
        <span
          className={cn(
            "absolute -left-1 -top-1 flex min-w-[19px] items-center justify-center rounded-full px-1 text-[10px] font-black leading-[15px] md:text-[11px]",
            improvisado ? "bg-amber-400 text-black" : "text-black",
          )}
          style={improvisado ? undefined : { background: estilo.anel }}
          title={improvisado
            ? `Improvisado: ${posicao} jogando de ${slot}. Rende ${overallEfetivo} em vez de ${overall}.`
            : undefined}
        >
          {overallEfetivo}
        </span>

        {/* A posição mostrada é o SLOT — é onde ele vai jogar. */}
        <span
          className="absolute -bottom-1 -right-1 rounded-full px-1 text-[8px] font-black uppercase leading-[14px] text-black md:text-[9px]"
          style={{ background: estilo.anel }}
        >
          {slot}
        </span>

        {numero != null && (
          <span className="absolute -top-1 right-0 text-[8px] font-black text-white/70 [text-shadow:0_1px_2px_rgba(0,0,0,0.95)]">
            {numero}
          </span>
        )}
      </div>

      {/* Nome + o aviso de improvisação (a origem riscada). */}
      <div className="mt-0.5 max-w-[86px] rounded bg-black/55 px-1 text-center">
        <div className="truncate text-[9px] font-black uppercase tracking-wide" style={{ color: estilo.texto }}>
          {nome.split(" ").pop()}
        </div>
        {improvisado && (
          <div className="text-[7px] font-bold leading-tight text-amber-300">
            {posicao} <span className="text-white/40 line-through">{overall}</span>
          </div>
        )}
      </div>

      {promessa && (
        <div className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--brand)]">
          <TrendingUp className="h-2 w-2 text-black" />
        </div>
      )}

      {/* Lesão / contrato / empréstimo / treino: o mesmo aviso da prancheta em pé. */}
      {pills.length > 0 ? (
        <div className="absolute inset-x-0 -top-2 mx-auto flex w-fit flex-col items-center gap-0.5">
          {pills.map(p => (
            <div key={p.key} className={cn("rounded px-1 text-[7px] font-black leading-tight", p.cls)}>{p.label}</div>
          ))}
        </div>
      ) : emTreino ? (
        <div className="absolute inset-x-0 -top-2 mx-auto w-fit rounded bg-amber-400 px-1 text-[7px] font-black text-black">
          TREINO
        </div>
      ) : null}

      {funcao && (
        <div className="mt-0.5 max-w-[80px] truncate rounded bg-[var(--brand)] px-1.5 text-[8px] font-bold leading-tight text-[var(--brand-ink)]">
          {funcao}
        </div>
      )}
    </div>
  )
}

type ViewType = "menu" | "visao_tatica" | "gerenciamento" | "escalacoes"

export default function ElencoPage() {
  useRequireClub()
  const router = useRouter()
  const { state, setState } = useGameState()
  const { addNotification } = useNotifications()
  const engineFormation = useGameEngine(s => s.formation)
  const engineSetFormation = useGameEngine(s => s.setFormation)
  const engineSquadPlayers = useGameEngine(s => s.squadPlayers)
  const engineMatchResults = useGameEngine(s => s.matchResults)
  const engineSeason = useGameEngine(s => s.currentSeason)
  const engineSetStarters = useGameEngine(s => s.setStarters)
  const enginePlayerInstructions = useGameEngine(s => s.playerInstructions)
  const engineSetPlayerPosition = useGameEngine(s => s.setPlayerPosition)
  const engineSetPlayerInstructions = useGameEngine(s => s.setPlayerInstructions)
  const engineRenewContract = useGameEngine(s => s.renewContract)
  const engineToggleLoanListed = useGameEngine(s => s.toggleLoanListed)
  const loanListedIds = useGameEngine(s => s.loanListedIds)
  const transferListedIds = useGameEngine(s => s.transferListedIds)
  const engineToggleTransferListed = useGameEngine(s => s.toggleTransferListed)
  const engineDevolverEmprestimo = useGameEngine(s => s.devolverEmprestimo)
  const engineRenovarEmprestimo = useGameEngine(s => s.renovarEmprestimo)
  const movimentos = useGameEngine(s => s.tacticalPlayerMovements)
  const setMovimentos = useGameEngine(s => s.setTacticalPlayerMovements)
  const engineTerminateContract = useGameEngine(s => s.terminateContract)
  const engineSellPlayer = useGameEngine(s => s.sellPlayer)
  const engineRetirePlayer = useGameEngine(s => s.retirePlayer)
  const engineBalance = useGameEngine(s => s.balance)
  const engineCurrentWeek = useGameEngine(s => s.currentWeek)
  // SEMANA DA TEMPORADA para a janela de transferencias. O contador do motor
  // (currentWeek) e absoluto e nunca zera; a temporada zera todo ano e acaba
  // na ultima rodada do calendario, quase nunca na 52a semana. Usar o contador
  // absoluto fazia a janela abrir e fechar em datas que nao existem no
  // calendario que o jogador ve.
  const semanaDaTemporada = state.week ?? 0
  // SITUACAO CONTRATUAL por nome. O elenco desta tela vem do hook de UI e nao
  // carrega contrato; o contrato esta no motor. Sem isto, atleta de contrato
  // VENCIDO ficava visualmente igual aos demais e o tecnico so descobria quando
  // ele ia embora de graca.
  const situacaoContrato = useMemo(() => {
    const mapa = new Map<string, "ok" | "expiring" | "expired">()
    for (const p of engineSquadPlayers) mapa.set(p.name, getContractStatus(p, engineCurrentWeek, engineSeason))
    return mapa
  }, [engineSquadPlayers, engineCurrentWeek, engineSeason])

  // REALISMO: nota da ultima partida, media, suspensao e persona por nome — o
  // elenco desta tela vem do hook de UI, os dados vivem no motor.
  const dadosMotor = useMemo(() => {
    const mapa = new Map<string, { nota?: number; media?: number; susp: number; persona?: string }>()
    for (const p of engineSquadPlayers) {
      mapa.set(p.name, {
        nota: p.lastMatchRating, media: p.avgMatchRating,
        susp: p.suspendedMatches ?? 0, persona: p.persona?.rotulo,
      })
    }
    return mapa
  }, [engineSquadPlayers])
  const corDaNota = (n?: number) =>
    n == null ? "text-white/30" : n >= 7.5 ? "text-[var(--brand)]" : n >= 6.5 ? "text-white" : "text-amber-300"
  const engineSetPlayerShirtNumber = useGameEngine(s => s.setPlayerShirtNumber)
  const teamTactics = useGameEngine(s => s.teamTactics)
  const setTeamTactics = useGameEngine(s => s.setTeamTactics)
  const tacticalAssignments = useGameEngine(s => s.tacticalAssignments)
  const setTacticalAssignments = useGameEngine(s => s.setTacticalAssignments)
  const tacticalPlayerPositions = useGameEngine(s => s.tacticalPlayerPositions ?? {})
  const setTacticalPlayerPositions = useGameEngine(s => s.setTacticalPlayerPositions)
  // ATENCAO: NAO colocar um time default aqui.
  //
  // Antes era getTeamByShort(state.selectedTeamShort || "BGT"): enquanto o save nao
  // hidratava (no Tauri o persistent-store carrega do disco de forma ASSINCRONA), o
  // primeiro render usava o RB Bragantino e montava o elenco DELE — que o useState logo
  // abaixo congelava. Resultado: o cabecalho mostrava "Barcelona" (recalculado a cada
  // render) enquanto o elenco continuava sendo o do Bragantino, para sempre.
  // Elenco vem do hook compartilhado (lib/use-user-roster), o mesmo usado pela Escalacao.
  // O hook ja lida com a hidratacao assincrona do save: teamReady=false enquanto nao ha
  // time, e o roster e recarregado quando o clube resolve.
  const { userTeam, teamReady, players, setPlayers, bench, setBench } =
    useUserRoster(state.selectedTeamShort, engineSquadPlayers, engineFormation ?? "4-3-3")

  const t = useTranslation()
  useDiscordActivity("Gerenciando o elenco", userTeam.nome)

  const [currentView, setCurrentView] = useState<ViewType>("gerenciamento")
  const [activeTab, setActiveTab] = useState<"elenco" | "taticas" | "atribuicoes">("elenco")
  const formation = engineFormation ?? "4-3-3"
  const setFormation = engineSetFormation
  const [selectedPlayerId, setSelectedPlayerId] = useState<number>(1)
  // Banco de reservas fechado por padrao — ele so aparece quando o tecnico pede
  // (pedido). Com 23 reservas aberto de cara, o campo ficava espremido.
  const [bancoAberto, setBancoAberto] = useState(false)
  /**
   * MODO MOVIMENTAÇÃO: com ele ligado, arrastar um atleta desenha a SETA do
   * deslocamento dele (para onde vai com a bola) em vez de mudar a posição
   * base. A seta não é enfeite — o motor a traduz em avançar/segurar/abrir/
   * fechar (ver setTacticalPlayerMovements no game-engine).
   */
  const [modoMovimento, setModoMovimento] = useState(false)
  // Mesa de renovacao do emprestimo (atleta que chegou emprestado).
  const [renovacaoAberta, setRenovacaoAberta] = useState(false)
  const [draggingPlayer, setDraggingPlayer] = useState<number | null>(null)
  const [dragOverTarget, setDragOverTarget] = useState<number | null>(null)
  const [playerPositions, setPlayerPositions] = useState<Record<number, { x: number; y: number }>>({})
  const [showMatchNotification, setShowMatchNotification] = useState(false)
  const [isMatchInProgress] = useState(false)
  const [showSubstitutionModal, setShowSubstitutionModal] = useState(false)
  const [showPlayerProfile, setShowPlayerProfile] = useState(false)
  /** Qual negociacao de contrato esta aberta (null = nenhuma). */
  const [negociacao, setNegociacao] = useState<"renovar" | "rescindir" | null>(null)
  const [showTutorials, setShowTutorials] = useState(false)
  const [showSuggestedSubs, setShowSuggestedSubs] = useState(false)
  const [showLeaderboards, setShowLeaderboards] = useState(false)
  const [tacticalSaved, setTacticalSaved] = useState(false)
  const [ballInstruction, setBallInstruction] = useState<"sem_bola" | "com_bola">("sem_bola")
  const pitchRef = useRef<HTMLDivElement>(null)
  const positionsHydratedForTeam = useRef("")

  const TABS: Array<"elenco" | "taticas" | "atribuicoes"> = ["elenco", "taticas", "atribuicoes"]
  const allPlayers = useMemo(() => [...players, ...bench], [players, bench])

  // Restaura e salva automaticamente os ajustes manuais do campo. Usamos o nome
  // como chave porque atletas importados/contratados podem receber outro ID interno.
  useEffect(() => {
    if (!teamReady || allPlayers.length === 0 || positionsHydratedForTeam.current === userTeam.curto) return
    const byName = new Map(allPlayers.map(player => [player.name, player.id]))
    const restored: Record<number, { x: number; y: number }> = {}
    for (const [name, position] of Object.entries(tacticalPlayerPositions)) {
      const id = byName.get(name)
      if (id !== undefined) restored[id] = position
    }
    positionsHydratedForTeam.current = userTeam.curto
    setPlayerPositions(restored)
  }, [allPlayers, tacticalPlayerPositions, teamReady, userTeam.curto])

  useEffect(() => {
    if (!teamReady || positionsHydratedForTeam.current !== userTeam.curto) return
    const byId = new Map(allPlayers.map(player => [player.id, player.name]))
    const saved: Record<string, { x: number; y: number }> = {}
    for (const [rawId, position] of Object.entries(playerPositions)) {
      const name = byId.get(Number(rawId))
      if (name) saved[name] = position
    }
    setTacticalPlayerPositions(saved)
  }, [allPlayers, playerPositions, setTacticalPlayerPositions, teamReady, userTeam.curto])

  // ── TATICAS: antes os botoes eram DECORATIVOS (o "selecionado" era um `i === 1`
  // chumbado no JSX). Agora tem estado de verdade e o clique muda a instrucao.
  const [linhaDefensiva, setLinhaDefensiva] = useState(() => ["baixa", "media", "alta"].indexOf(teamTactics.defensiveLine))
  const [marcacao, setMarcacao] = useState(() => teamTactics.pressingIntensity === "alta" || teamTactics.pressingIntensity === "muito_alta" ? 0 : teamTactics.pressingIntensity === "baixa" ? 2 : 1)
  const [construcao, setConstrucao] = useState(() => ["curto", "misto", "longo"].indexOf(teamTactics.buildUp))
  const [velocidadeAtaque, setVelocidadeAtaque] = useState(() => ["lento", "normal", "rapido"].indexOf(teamTactics.tempo))
  const [mentalidade, setMentalidade] = useState(() => ["muito_defensivo", "defensivo", "equilibrado", "ofensivo", "muito_ofensivo"].indexOf(teamTactics.mentality))

  useEffect(() => {
    setTeamTactics({
      defensiveLine: (["baixa", "media", "alta"] as const)[linhaDefensiva] ?? "media",
      pressingIntensity: (["alta", "media", "baixa"] as const)[marcacao] ?? "media",
      buildUp: (["curto", "misto", "longo"] as const)[construcao] ?? "misto",
      tempo: (["lento", "normal", "rapido"] as const)[velocidadeAtaque] ?? "normal",
      mentality: (["muito_defensivo", "defensivo", "equilibrado", "ofensivo", "muito_ofensivo"] as const)[mentalidade] ?? "equilibrado",
    })
  }, [construcao, linhaDefensiva, marcacao, mentalidade, setTeamTactics, velocidadeAtaque])

  // ── ATRIBUICOES: cobradores/capitao vinham CHUMBADOS ("Eric Ramires", "Lincoln",
  // "Eduardo Sasha", "Pedro Henrique" — elenco do RB Bragantino) e apareciam mesmo
  // jogando com o Corinthians. Agora saem do elenco REAL, por atributo + posicao.
  const setPieceDefaults = useMemo(() => {
    const outfield = allPlayers.filter((p) => p.position !== "GOL")
    if (outfield.length === 0) return { corner: "", freeKick: "", freeKickLeft: "", freeKickRight: "", penalty: "", captain: "" }
    // Peso por posicao: quem realmente bate bola parada.
    const KICK_BIAS: Record<string, number> = {
      ATA: 8, PE: 10, PD: 10, MEI: 12, VOL: 4, LD: 2, LE: 2, ZAG: -6, ALD: 2, ALE: 2,
    }
    const bias = (p: (typeof outfield)[number]) => KICK_BIAS[p.position] ?? 0
    const top = (score: (p: (typeof outfield)[number]) => number) =>
      [...outfield].sort((a, b) => score(b) - score(a))[0]?.name ?? ""
    const fk = top((p) => p.shooting * 0.6 + p.passing * 0.4 + bias(p))
    return {
      corner: top((p) => p.passing + bias(p)),
      freeKick: fk,
      // Batedor de falta por lado (relatado). Sem dado de pe dominante, ambos caem no melhor
      // batedor por padrao; o usuario ajusta cada lado a mao.
      freeKickLeft: fk,
      freeKickRight: fk,
      penalty: top((p) => p.shooting + bias(p)),
      // Capitao: mistura qualidade e experiencia (idade), nao so overall.
      captain: [...allPlayers].sort((a, b) => (b.overall + b.age * 0.6) - (a.overall + a.age * 0.6))[0]?.name ?? "",
    }
  }, [allPlayers])

  const [setPieces, setSetPieces] = useState(setPieceDefaults)
  useEffect(() => {
    setSetPieces({
      corner: tacticalAssignments.corner || setPieceDefaults.corner,
      freeKick: tacticalAssignments.freeKick || setPieceDefaults.freeKick,
      freeKickLeft: tacticalAssignments.freeKickLeft || setPieceDefaults.freeKickLeft,
      freeKickRight: tacticalAssignments.freeKickRight || setPieceDefaults.freeKickRight,
      penalty: tacticalAssignments.penalty || setPieceDefaults.penalty,
      captain: tacticalAssignments.captain || setPieceDefaults.captain,
    })
  }, [setPieceDefaults, tacticalAssignments.captain, tacticalAssignments.corner, tacticalAssignments.freeKick, tacticalAssignments.freeKickLeft, tacticalAssignments.freeKickRight, tacticalAssignments.penalty])

  const updateSetPiece = (key: keyof typeof setPieces, value: string) => {
    setSetPieces(current => ({ ...current, [key]: value }))
    setTacticalAssignments({ [key]: value })
  }

  // Funcao individual por jogador (o <select> antes nao tinha estado nem onChange).
  const [playerRoles, setPlayerRoles] = useState<Record<number, string>>({})
  useEffect(() => {
    const restored = Object.fromEntries(allPlayers.map(player => [player.id, tacticalAssignments.playerRoles[player.name] ?? player.function]))
    setPlayerRoles(restored)
  }, [allPlayers, tacticalAssignments.playerRoles])

  const updatePlayerRole = (playerId: number, role: string) => {
    const player = allPlayers.find(item => item.id === playerId)
    if (!player) return
    setPlayerRoles(current => ({ ...current, [playerId]: role }))
    setTacticalAssignments({ playerRoles: { [player.name]: role } })
  }

  // Match notifications should only show during actual matches (simulations)
  // This would be triggered by the match simulation system
  // For now, we check a hypothetical state flag
  
  const selectedPlayer = useMemo(() => {
    return [...players, ...bench].find(p => p.id === selectedPlayerId) || players[0]
  }, [selectedPlayerId, players, bench])

  /**
   * O atleta selecionado chegou POR EMPRÉSTIMO? Devolve o registro do motor
   * (que é quem tem `isLoanedIn`, `parentClub` e a data-limite) — a tela usa
   * isso para trocar vender/anunciar por devolver/renovar. A ponte é pelo NOME,
   * como no resto da página: os ids divergem para atletas importados.
   */
  const emprestimoDoSelecionado = useMemo(() => {
    if (!selectedPlayer) return null
    const ep = engineSquadPlayers.find(p => p.name === selectedPlayer.name)
    return ep?.isLoanedIn ? ep : null
  }, [selectedPlayer, engineSquadPlayers])
  
  const formationKeys = Object.keys(FORMATIONS)
  const currentFormationIndex = formationKeys.indexOf(formation)
  
  // Encaixe por POSICAO (nao por indice do array) — ver lib/formations.ts.
  const positionedPlayers = useMemo(
    () => assignPlayersToFormation(players, formation, playerPositions),
    [players, formation, playerPositions],
  )

  /**
   * ONDE O ATLETA VAI JOGAR DE FATO — a base da penalidade de improvisação.
   *
   * Não pode ser `slotPos`: `assignPlayersToFormation` encaixa cada atleta no
   * slot da PRÓPRIA posição dele (o passo 1 é casar posição exata), e arrastar
   * alguém pelo campo muda só `x`/`y`. Ligado ao `slotPos`, origem e destino
   * eram sempre iguais, o fator dava 1 e mover o goleiro para a zaga não mudava
   * nada — nem na tela, nem no motor.
   *
   * A coordenada só manda quando o técnico REALMENTE moveu o atleta. Nas
   * posições padrão do template ela poderia cair numa faixa vizinha (um VOL
   * desenhado um pouco à frente virando MEI) e cobrar uma penalidade que
   * ninguém pediu. Mesma regra do caminho da partida (app/partida/ao-vivo).
   */
  const slotEfetivo = useCallback(
    (player: { id: number; position: string; x: number; y: number; slotPos?: string }) =>
      playerPositions[player.id]
        ? posicaoPelaCoordenada(player.x, player.y)
        : normalizePosition(player.slotPos ?? player.position),
    [playerPositions],
  )
  
  // Rótulos do card de função no campo. A instrução salva manda; sem ela, cai no
  // papel padrão da posição (antes todo mundo virava "meia central").
  const roleLabelFor = useCallback((player: { id: number; position: string }) => {
    const role: PlayerRole = enginePlayerInstructions?.[player.id]?.role ?? defaultRoleForPosition(normalizePosition(player.position))
    return PLAYER_ROLE_INFO[role]?.name ?? "Equilibrado"
  }, [enginePlayerInstructions])

  /**
   * UNIFORME DA PRANCHETA (casa / fora / terceiro).
   * A escolha fica no save da carreira — a prancheta abre no mesmo uniforme da
   * última vez, e é a mesma preferência que a tela de partida usa.
   */
  const uniformeDoCampo = (state.selectedUniform as "home" | "away" | "third") ?? "home"
  const uniformesDisponiveis = useMemo(
    () => (["home", "away", "third"] as const).filter(v => isKitVariantAvailable(userTeam.file_key, v)),
    [userTeam.file_key],
  )
  const camisaDoCampo = useMemo(
    () => getCamisaUrl(userTeam.file_key, uniformeDoCampo, userTeam.nome),
    [userTeam.file_key, userTeam.nome, uniformeDoCampo],
  )

  /** Número do atleta no elenco do motor (undefined quando o save não tem). */
  const numeroDaCamisa = useCallback(
    (playerId: number) => engineSquadPlayers.find(p => p.id === playerId)?.shirtNumber,
    [engineSquadPlayers],
  )

  /**
   * ORIENTAÇÃO DA PRANCHETA — vertical (camisas) ou HORIZONTAL (cartas com foto).
   *
   * As coordenadas táticas (`x`, `y` em `positionedPlayers`) continuam SEMPRE no
   * eixo vertical: é assim que elas são gravadas no save, é assim que a partida
   * as lê, e converter o dado ao virar a tela quebraria toda a formação salva.
   * A rotação é só de APRESENTAÇÃO — dois conversores, um em cada sentido.
   *
   * Campo vertical: y=0 é o ataque (topo), y=100 é o próprio gol.
   * Campo horizontal: o próprio gol fica à ESQUERDA e o ataque à DIREITA, que é
   * como todo jogo de futebol desenha a prancheta deitada.
   */
  const campoHorizontal = Boolean(state.campoHorizontal)
  const paraTela = useCallback(
    (p: { x: number; y: number }) => (campoHorizontal ? { left: 100 - p.y, top: p.x } : { left: p.x, top: p.y }),
    [campoHorizontal],
  )
  const paraCampo = useCallback(
    (left: number, top: number) => (campoHorizontal ? { x: top, y: 100 - left } : { x: left, y: top }),
    [campoHorizontal],
  )

  // Força por setor da Visão Tática. Os quatro campos eram rótulos fixos com "ND"
  // chumbado — nenhum dado do elenco chegava ali.
  const sectorRatings = useMemo(() => {
    const byGroup: Record<string, number[]> = { Gol: [], Defesa: [], "Meio-campo": [], Ataque: [] }
    for (const player of players) {
      const pos = normalizePosition(player.position)
      const group = pos === "GOL" ? "Gol"
        : ["ZAG", "LD", "LE"].includes(pos) ? "Defesa"
        : ["ATA", "PD", "PE"].includes(pos) ? "Ataque"
        : "Meio-campo"
      byGroup[group].push(player.overall)
    }
    return (["Ataque", "Meio-campo", "Defesa", "Gol"] as const).map(label => {
      const values = byGroup[label]
      return {
        label,
        value: values.length ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : null,
        count: values.length,
      }
    })
  }, [players])

  /**
   * Escala automaticamente o melhor XI para a formação atual.
   *
   * `pickStartingXI` já existia e era usado pela partida ao vivo para completar
   * escalações incompletas, mas nunca foi exposto ao técnico: montar o time
   * exigia arrastar os 11 na mão, toda vez.
   */
  // Lesão/treino por NOME (a ponte padrão desta tela: os ids divergem do engine).
  const statusFor = useCallback((name: string) => {
    const ep = engineSquadPlayers.find(p => p.name === name)
    return {
      injured: !!ep?.injury,
      injuryWeeks: ep?.injury?.weeksRemaining ?? 0,
      training: !!ep?.training?.currentFocus,
      // Empréstimo: veio EMPRESTADO de outro clube (isLoanedIn) ou você o colocou
      // na lista de empréstimo (loanListed). Ambos merecem destaque distinto.
      loanedIn: !!ep?.isLoanedIn,
      loanListed: ep ? !!loanListedIds?.includes(ep.id) : false,
    }
  }, [engineSquadPlayers, loanListedIds])

  // ── DESTAQUE VISUAL UNIFICADO (lesão / contrato / empréstimo) ───────────────
  // Antes cada situação vivia num canto: lesão só no card do campo, contrato só
  // como moldura na aba de atribuições, empréstimo em lugar nenhum. Estes dois
  // helpers centralizam a regra para TODOS os lugares (campo, banco, listas)
  // ficarem coerentes. Prioridade da moldura: lesão > contrato vencido >
  // empréstimo > a vencer.
  const destaqueStatus = useCallback((name: string) => {
    const st = statusFor(name)
    const ct = situacaoContrato.get(name)
    if (st.injured) return "ring-1 ring-red-500/70 bg-red-500/10"
    if (ct === "expired") return "ring-1 ring-red-500/70 bg-red-500/10"
    if (st.loanedIn || st.loanListed) return "ring-1 ring-sky-400/70 bg-sky-400/[0.08]"
    if (ct === "expiring") return "ring-1 ring-amber-400/60 bg-amber-400/[0.07]"
    return ""
  }, [statusFor, situacaoContrato])

  /** Pílulas de status de um jogador (mais crítica primeiro). */
  const badgesStatus = useCallback((name: string) => {
    const st = statusFor(name)
    const ct = situacaoContrato.get(name)
    const pills: { key: string; label: string; cls: string }[] = []
    if (st.injured) pills.push({ key: "inj", label: `LESÃO ${st.injuryWeeks}sem`, cls: "bg-red-500 text-white" })
    if (ct === "expired") pills.push({ key: "exp", label: "CONTRATO VENCIDO", cls: "bg-red-500/25 text-red-300" })
    else if (ct === "expiring") pills.push({ key: "vnc", label: "A VENCER", cls: "bg-amber-400/20 text-amber-300" })
    if (st.loanedIn) pills.push({ key: "loan", label: "EMPRÉSTIMO", cls: "bg-sky-400/25 text-sky-200" })
    else if (st.loanListed) pills.push({ key: "loanl", label: "NA LISTA DE EMPRÉSTIMO", cls: "bg-sky-400/15 text-sky-200/80" })
    return pills
  }, [statusFor, situacaoContrato])

  const autoPickLineup = useCallback(() => {
    const squad = [...players, ...bench]
    if (squad.length < 11) return
    // Lesionado NÃO entra no XI automático (config pedida pelo usuário após o
    // relato). Quem está em TREINO segue disponível — treino não afasta de
    // jogo, só reduz a recuperação de energia — mas fica sinalizado no card.
    const aptos = squad.filter(p => !statusFor(p.name).injured)
    const base = aptos.length >= 11 ? aptos : squad
    const { starters, bench: rest } = pickStartingXI(
      base,
      p => normalizePosition(p.position),
      p => p.overall,
      formation,
    )
    setPlayers(starters)
    // Lesionados que ficaram fora do XI voltam para o banco.
    const cortados = base === squad ? [] : squad.filter(p => statusFor(p.name).injured)
    setBench([...rest, ...cortados])
    setPlayerPositions({})
    addNotification({
      type: "system",
      title: "Escalação automática",
      message: `Melhor XI disponível montado no ${formation}.`,
      priority: "low",
    })
  }, [players, bench, formation, setPlayers, setBench, addNotification, statusFor])

  const nextFormation = () => {
    const nextIndex = (currentFormationIndex + 1) % formationKeys.length
    setFormation(formationKeys[nextIndex])
    setPlayerPositions({}) // Reset custom positions on formation change
  }
  
  const prevFormation = () => {
    const prevIndex = (currentFormationIndex - 1 + formationKeys.length) % formationKeys.length
    setFormation(formationKeys[prevIndex])
    setPlayerPositions({})
  }

  const handleSaveTacticalSetup = () => {
    if (players.length !== 11) {
      addNotification({ type: "system", title: "Escalação incompleta", message: "Selecione exatamente 11 titulares antes de salvar.", priority: "high" })
      return
    }
    // Faz um snapshot das posições junto com XI e formação. Não depende do efeito
    // assíncrono de arrastar/salvar, que podia deixar a partida seguinte com o layout
    // anterior quando o usuário iniciava o jogo logo após clicar em Salvar.
    const nameById = new Map(allPlayers.map(player => [player.id, player.name]))
    const savedPositions: Record<string, { x: number; y: number }> = {}
    for (const [id, position] of Object.entries(playerPositions)) {
      const name = nameById.get(Number(id))
      if (name) savedPositions[name] = position
    }
    saveTacticalSetup(
      resolverIdsDosTitulares(players, useGameEngine.getState().squadPlayers),
      formation,
      savedPositions,
    )
    announceOnlineAction("lineup_update", { formation, starters: players.map(player => player.name) })

    // Confirmacao SO no botao, que vira "Salvo ✓" por 2,2 s.
    //
    // Aqui havia tambem um `addNotification`, e notificacao neste jogo e
    // PERSISTIDA (components/notifications-system grava em
    // `ultrafoot:notifications` e recarrega em cada tela). O resultado era o
    // relato do betatester: "a notificacao de time salvo apareceu 3x — uma apos
    // salvar, na tela de adversario e na tela de comecar a partida".
    //
    // A central de notificacoes existe para o que o jogador precisa REVER
    // depois (proposta, lesao, resultado). Confirmacao de uma acao que ele
    // acabou de fazer, com feedback imediato no proprio botao, nao pertence la.
    setTacticalSaved(true)
    window.setTimeout(() => setTacticalSaved(false), 2200)
  }

  // Sincroniza titulares com o game-engine sempre que players mudar
  // (game-engine usa nome como chave pois os IDs internos diferem)
  //
  // A dependencia e a ASSINATURA (nomes dos titulares), nao o array `players`.
  // O hook do roster monta objetos novos a cada leitura, entao `players` trocava
  // de identidade sem mudanca real de conteudo e este efeito redisparava — junto
  // com `engineSquadPlayers`, que tambem e referencia nova a cada `set` do
  // zustand. O guard `ep.isStarter !== shouldBeStarter` evitava a escrita, mas
  // nao o ciclo: era o "Maximum update depth exceeded" ao abrir esta tela.
  //
  // 3) ESCRITA ATOMICA — era um `setStarter` por atleta, e cada um e um `set` do
  //    zustand. Promover um reserva passava por um instante com DOZE titulares (o
  //    reserva ja dentro, o titular ainda nao removido); quem lesse o elenco ali
  //    mandava a escalacao para `repararEscalacao`, que corta o de MENOR overall
  //    — exatamente o reserva recem-promovido. A escolha era desfeita e a tela
  //    ressincronizava: o loop relatado ("coloco um reserva e nao salva").
  //    Agora o XI inteiro vai numa gravacao so e esse instante nao existe.
  const assinaturaTitulares = players.map(p => `${p.id}:${p.name}`).join("|")
  useEffect(() => {
    // LOOP DE RENDER — ler `engineSquadPlayers` do store fazia este efeito
    // redisparar a cada `set` do zustand, e `players` (array novo a cada leitura
    // do roster) fechava o ciclo: "Maximum update depth exceeded" ao abrir a
    // tela. Dependemos da ASSINATURA dos titulares e lemos o squad via
    // `getState()`, sem assinar o store.
    const squad = useGameEngine.getState().squadPlayers
    if (squad.length === 0) return

    const titulares = resolverIdsDosTitulares(
      assinaturaTitulares.split("|").filter(Boolean).map(entrada => {
        const corte = entrada.indexOf(":")
        return { id: Number(entrada.slice(0, corte)), name: entrada.slice(corte + 1) }
      }),
      squad,
    )
    // Nada mudou: nao grava. Sem esta saida o efeito escreveria a cada montagem
    // da tela, criando estado novo do zustand por nada.
    const atuais = squad.filter(p => p.isStarter).map(p => p.id).sort((a, b) => a - b)
    const novos = [...titulares].sort((a, b) => a - b)
    if (atuais.length === novos.length && atuais.every((id, i) => id === novos[i])) return

    engineSetStarters(titulares)
  }, [assinaturaTitulares, engineSetStarters])

  // Navegacao por controle no elenco
  useEffect(() => {
    const handleGamepadButton = (e: Event) => {
      const { button } = (e as CustomEvent<{ button: string }>).detail

      if (showSubstitutionModal) {
        if (button === "B") setShowSubstitutionModal(false)
        return
      }
      if (showPlayerProfile) {
        if (button === "B") setShowPlayerProfile(false)
        return
      }

      switch (button) {
        case "B":
          router.back()
          break
        case "LB": {
          const i = TABS.indexOf(activeTab)
          setActiveTab(TABS[(i - 1 + TABS.length) % TABS.length])
          break
        }
        case "RB": {
          const i = TABS.indexOf(activeTab)
          setActiveTab(TABS[(i + 1) % TABS.length])
          break
        }
        case "LT":
          prevFormation()
          break
        case "RT":
          nextFormation()
          break
        case "DPAD_UP": {
          const idx = allPlayers.findIndex(p => p.id === selectedPlayerId)
          if (idx > 0) setSelectedPlayerId(allPlayers[idx - 1].id)
          break
        }
        case "DPAD_DOWN": {
          const idx = allPlayers.findIndex(p => p.id === selectedPlayerId)
          if (idx < allPlayers.length - 1) setSelectedPlayerId(allPlayers[idx + 1].id)
          break
        }
        case "A":
          setShowPlayerProfile(true)
          break
        case "Y":
          setShowSubstitutionModal(true)
          break
      }
    }

    window.addEventListener("gamepad:button", handleGamepadButton)
    return () => window.removeEventListener("gamepad:button", handleGamepadButton)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, activeTab, selectedPlayerId, allPlayers, showSubstitutionModal, showPlayerProfile])

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, playerId: number) => {
    setDraggingPlayer(playerId)
    e.dataTransfer.setData("playerId", playerId.toString())
    e.dataTransfer.effectAllowed = "move"
  }, [])
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }, [])
  
  const handleDragOverPlayer = useCallback((e: React.DragEvent, playerId: number) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverTarget(playerId)
  }, [])
  
  const handleDragLeave = useCallback(() => {
    setDragOverTarget(null)
  }, [])
  
  /**
   * Congela o slot de TODOS os 11 em campo e troca so as coordenadas de A e B.
   *
   * BUG que isto corrige ("ao substituir um jogador, o sistema rotaciona o time"):
   * positionedPlayers reencaixa o elenco por POSICAO a cada mudanca em `players`. Trocar
   * um unico jogador mudava o conjunto de posicoes e o encaixe recalculava para TODOS —
   * varios jogadores pulavam de slot de uma vez. Pior: os handlers ainda APAGAVAM a
   * posicao fixada dos envolvidos, forcando o reencaixe.
   *
   * Fixando os 11 slots atuais, o encaixe automatico nao tem mais o que "decidir": so
   * os dois jogadores da troca mudam de lugar.
   *
   * Precisa vir ANTES de handleDropOnPitch — que o referencia nas deps.
   */
  const pinSlotsAndSwap = useCallback((aId: number, bId: number) => {
    setPlayerPositions(() => {
      const pinned: Record<number, { x: number; y: number }> = {}
      for (const p of positionedPlayers) pinned[p.id] = { x: p.x, y: p.y }

      const slotA = pinned[aId]
      const slotB = pinned[bId]
      // Um deles pode vir do banco (sem slot): quem entra herda o slot de quem sai.
      if (slotA && slotB) {
        pinned[aId] = slotB
        pinned[bId] = slotA
      } else if (slotB) {
        pinned[aId] = slotB   // A veio do banco, assume o slot de B
        delete pinned[bId]
      } else if (slotA) {
        pinned[bId] = slotA   // B veio do banco, assume o slot de A
        delete pinned[aId]
      }
      return pinned
    })
  }, [positionedPlayers])

  const handleDropOnPitch = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const playerId = parseInt(e.dataTransfer.getData("playerId"))
    
    if (!pitchRef.current || !playerId) return
    
    const rect = pitchRef.current.getBoundingClientRect()
    // O ponteiro cai numa posição de TELA; as coordenadas táticas continuam no
    // eixo vertical. Sem esta conversão, arrastar na prancheta horizontal
    // gravaria a formação girada 90° — e a partida escalaria o time de lado.
    const { x, y } = paraCampo(
      ((e.clientX - rect.left) / rect.width) * 100,
      ((e.clientY - rect.top) / rect.height) * 100,
    )

    // Clamp to field bounds
    const clampedX = Math.max(5, Math.min(95, x))
    const clampedY = Math.max(5, Math.min(95, y))
    
    // MODO MOVIMENTAÇÃO: o arrasto não muda onde o atleta FICA, e sim para onde
    // ele VAI. Larga-se o ponteiro no destino e a seta nasce dali.
    if (modoMovimento) {
      const alvo = positionedPlayers.find(p => p.id === playerId)
      if (alvo) {
        const distancia = Math.hypot(clampedX - alvo.x, clampedY - alvo.y)
        const novos = { ...movimentos }
        // Solto quase em cima de si mesmo = apagar a seta.
        if (distancia < 4) delete novos[alvo.name]
        else novos[alvo.name] = { x: clampedX, y: clampedY }
        setMovimentos(novos)
      }
      setDraggingPlayer(null)
      setDragOverTarget(null)
      return
    }

    // Check if player is from bench
    const benchPlayer = bench.find(p => p.id === playerId)
    if (benchPlayer) {
      // Find closest field player to swap
      const fieldPlayer = positionedPlayers.reduce((closest, p) => {
        const dist = Math.hypot(p.x - clampedX, p.y - clampedY)
        const closestDist = closest ? Math.hypot(closest.x - clampedX, closest.y - clampedY) : Infinity
        return dist < closestDist ? p : closest
      }, null as typeof positionedPlayers[0] | null)

      if (fieldPlayer) {
        setPlayers(prev => prev.map(p => p.id === fieldPlayer.id ? benchPlayer : p))
        setBench(prev => prev.map(p => p.id === benchPlayer.id ? fieldPlayer : p))
        // Mesmo motivo do handleDropOnPlayer: sem fixar os slots, o encaixe por posicao
        // recalcula e "rotaciona" varios jogadores de uma vez.
        pinSlotsAndSwap(benchPlayer.id, fieldPlayer.id)
      }
    } else {
      // Jogador de campo largado num ponto livre: so ele se move.
      //
      // O mapa e montado FORA do `setPlayerPositions` porque a formacao tambem sai
      // dele: um updater do React pode ser reexecutado, e disparar `setFormation`
      // la dentro seria efeito colateral em funcao pura.
      const pinned = { ...playerPositions }
      for (const p of positionedPlayers) {
        if (pinned[p.id] === undefined) pinned[p.id] = { x: p.x, y: p.y }
      }
      pinned[playerId] = { x: clampedX, y: clampedY }
      setPlayerPositions(pinned)

      // A FORMACAO SEGUE OS JOGADORES. Antes o rotulo era so o que estava no
      // seletor: dava para arrastar um zagueiro para o meio, montar um 3-5-2 em
      // campo, e a ficha continuar dizendo "4-4-2" — e e o ROTULO que a partida
      // usa. Agora o desenho real em campo renomeia a formacao.
      //
      // NAO limpamos as posicoes personalizadas ao trocar (como faz o seletor):
      // aqui elas sao a propria fonte do novo nome, e apaga-las devolveria o time
      // aos slots padrao, desfazendo o arrasto que acabou de acontecer.
      const nova = detectarFormacao(
        positionedPlayers.map(p => ({ pos: p.position, y: pinned[p.id]?.y ?? p.y })),
      )
      if (nova && nova !== formation) setFormation(nova)
    }

    setDraggingPlayer(null)
    setDragOverTarget(null)
  }, [bench, positionedPlayers, pinSlotsAndSwap, modoMovimento, movimentos, setMovimentos, paraCampo,
    playerPositions, formation, setFormation, setPlayers, setBench])
  
  const handleDropOnPlayer = useCallback((e: React.DragEvent, targetId: number) => {
    e.preventDefault()
    e.stopPropagation()

    const draggedId = parseInt(e.dataTransfer.getData("playerId"))
    if (!draggedId || draggedId === targetId) {
      setDraggingPlayer(null)
      setDragOverTarget(null)
      return
    }

    const draggedFromField = players.find(p => p.id === draggedId)
    const draggedFromBench = bench.find(p => p.id === draggedId)
    const targetFromField = players.find(p => p.id === targetId)
    const targetFromBench = bench.find(p => p.id === targetId)

    if (draggedFromField && targetFromField) {
      // Troca em campo: os dois apenas trocam de slot, o resto fica parado.
      const draggedIdx = players.findIndex(p => p.id === draggedId)
      const targetIdx = players.findIndex(p => p.id === targetId)
      setPlayers(prev => {
        const newPlayers = [...prev]
        ;[newPlayers[draggedIdx], newPlayers[targetIdx]] = [newPlayers[targetIdx], newPlayers[draggedIdx]]
        return newPlayers
      })
      pinSlotsAndSwap(draggedId, targetId)
    } else if (draggedFromBench && targetFromField) {
      // Reserva ENTRA no lugar exato do titular que sai.
      setPlayers(prev => prev.map(p => p.id === targetId ? draggedFromBench : p))
      setBench(prev => prev.map(p => p.id === draggedId ? targetFromField : p))
      pinSlotsAndSwap(draggedId, targetId)
    } else if (draggedFromField && targetFromBench) {
      // Titular vai para o banco; o reserva assume o slot dele.
      setPlayers(prev => prev.map(p => p.id === draggedId ? targetFromBench : p))
      setBench(prev => prev.map(p => p.id === targetId ? draggedFromField : p))
      pinSlotsAndSwap(targetId, draggedId)
    } else if (draggedFromBench && targetFromBench) {
      // Troca dentro do banco: ninguem em campo se mexe.
      const draggedIdx = bench.findIndex(p => p.id === draggedId)
      const targetIdx = bench.findIndex(p => p.id === targetId)
      setBench(prev => {
        const newBench = [...prev]
        ;[newBench[draggedIdx], newBench[targetIdx]] = [newBench[targetIdx], newBench[draggedIdx]]
        return newBench
      })
    }

    setDraggingPlayer(null)
    setDragOverTarget(null)
  }, [players, bench, pinSlotsAndSwap])
  
  const handleDragEnd = useCallback(() => {
    setDraggingPlayer(null)
    setDragOverTarget(null)
  }, [])

  /**
   * Save ainda hidratando: nao ha time nem elenco.
   *
   * Antes a pagina "resolvia" isso com um time default (RB Bragantino) e montava o
   * elenco dele — que o useState congelava. Melhor mostrar carregando por um instante
   * do que exibir, para sempre, o elenco de um clube que nao e o seu.
   * (Todos os hooks ja rodaram acima; este early-return nao quebra a ordem deles.)
   */
  if (!teamReady || players.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050508] text-sm text-white/40">
        Carregando elenco...
      </div>
    )
  }

  // Menu view with cards
  if (currentView === "menu") {
    return (
      <div className="h-screen md:pl-0 pl-0 pb-20 md:pb-0 bg-[#050508] flex flex-col overflow-hidden">
        <GameHeader team={userTeam} />
        
        <main className="flex-1 p-4 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <TeamCrest team={userTeam} size="lg" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">{userTeam.nome}</h1>
              <p className="text-sm text-white/50">{t.squad.title}</p>
            </div>
          </div>
          
          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {/* Visao Tatica Card */}
            <motion.button
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setCurrentView("visao_tatica")}
              className="relative p-6 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-left overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
              <h2 className="text-xl md:text-2xl font-bold text-white mb-1">{t.squad.tacticalView}</h2>
              <p className="text-sm text-primary mb-6">{t.squad.currentTactic}</p>
              
              <div className="flex justify-center mb-6">
                <Scale className="h-20 w-20 md:h-24 md:w-24 text-white/80" />
              </div>
              
              <p className="text-lg font-semibold text-white">{t.squad.standard}</p>

              <div className="flex items-center gap-2 mt-4 text-white/60 text-sm">
                <X className="h-4 w-4" />
                <span>{t.squad.playerImpact}</span>
              </div>
            </motion.button>
            
            {/* Gerenciamento do Time Card */}
            <motion.button
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setCurrentView("gerenciamento")}
              className="relative p-6 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-left overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
              <h2 className="text-xl md:text-2xl font-bold text-white mb-1">{t.squad.teamManagement}</h2>
              <p className="text-sm text-primary mb-4">{t.squad.standard} {userTeam.nome.toUpperCase()}</p>
              
              {/* Mini field preview */}
              <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-green-900/30 mb-4">
                <svg viewBox="0 0 100 75" className="absolute inset-0 w-full h-full">
                  <g stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" fill="none">
                    <rect x="5" y="5" width="90" height="65" />
                    <line x1="50" y1="5" x2="50" y2="70" />
                    <circle cx="50" cy="37.5" r="8" />
                  </g>
                  {/* Players dots */}
                  {FORMATIONS[formation].positions.map((pos, i) => (
                    <circle key={i} cx={pos.x} cy={pos.y * 0.75} r="3" fill="white" />
                  ))}
                </svg>
              </div>
              
              {/* Stats indicators */}
              <div className="flex justify-around">
                <div className="flex flex-col items-center gap-1">
                  <div className="h-8 w-8 rounded-full border-2 border-green-500 flex items-center justify-center">
                    <Zap className="h-4 w-4 text-green-500" />
                  </div>
                  <span className="text-[10px] text-white/60">{t.squad.physicalPrep}</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="h-8 w-8 rounded-full border-2 border-green-500 flex items-center justify-center">
                    <Gauge className="h-4 w-4 text-green-500" />
                  </div>
                  <span className="text-[10px] text-white/60">{t.squad.rhythm}</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="h-8 w-8 rounded-full border-2 border-green-500 flex items-center justify-center">
                    <Heart className="h-4 w-4 text-green-500" />
                  </div>
                  <span className="text-[10px] text-white/60">{t.squad.morale}</span>
                </div>
              </div>
            </motion.button>
            
            {/* Escalacoes Card */}
            <motion.button
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setCurrentView("escalacoes")}
              className="relative p-6 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-left overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
              <h2 className="text-xl md:text-2xl font-bold text-white mb-1">{t.squad.lineups}</h2>
              <p className="text-sm text-primary mb-6">{t.squad.lineupsCreated}</p>
              
              <div className="flex justify-center mb-6">
                <div className="relative w-20 h-20 md:w-24 md:h-24">
                  <div className="absolute inset-0 border-2 border-white/80 rounded-lg" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 border-2 border-white/80 rounded-full" />
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-4 border-2 border-t-0 border-white/80" />
                </div>
              </div>
              
              <p className="text-xs text-white/60 text-center leading-relaxed">
                {t.squad.lineupsDesc}
              </p>
            </motion.button>
          </div>
          
          {/* Bottom controls */}
          <div className="fixed bottom-0 left-0 md:left-16 right-0 h-14 bg-[#0d0d0d] border-t border-white/10 flex items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-2 md:gap-4">
              <Button variant="ghost" size="sm" className="text-white/60 hover:text-white text-xs md:text-sm">
                <Gamepad2 className="h-4 w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">{t.settings.selectBtn}</span>
              </Button>
              <Button variant="ghost" size="sm" className="text-white/60 hover:text-white text-xs md:text-sm">
                <ChevronLeft className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">{t.common.back}</span>
              </Button>
              <Button variant="ghost" size="sm" className="text-white/60 hover:text-white text-xs md:text-sm">
                <Info className="h-4 w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">{t.squad.tutorials}</span>
              </Button>
            </div>
            
            <Button
              onClick={() => setCurrentView("gerenciamento")}
              className="bg-primary hover:bg-primary/90 text-black font-semibold text-xs md:text-sm"
            >
              <Gamepad2 className="h-4 w-4 mr-1 md:mr-2" />
              {t.squad.enterTacticalView}
            </Button>
          </div>
        </main>
      </div>
    )
  }
  
  // Visao Tatica view
  if (currentView === "visao_tatica") {
    return (
      <div className="h-screen md:pl-0 pl-0 pb-20 md:pb-0 bg-gradient-to-br from-primary/20 via-[#0a0a0a] to-primary/10 flex flex-col overflow-hidden">
        <GameHeader team={userTeam} />
        
        <main className="flex-1 p-4 overflow-y-auto">
          {/* Sub-header */}
          <div className="flex items-center gap-4 md:gap-6 mb-6 flex-wrap">
            <Button 
              variant="ghost" 
              onClick={() => setCurrentView("menu")}
              className="text-white/60 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              {t.sidebar.squad}
            </Button>
            <h1 className="text-lg md:text-xl font-bold text-white">{t.squad.tacticalView}</h1>
            <div className="hidden md:flex items-center gap-4 text-white/60">
              <span>Gestao de Auxiliares Tec.</span>
              <span>Predefinicoes Taticas</span>
            </div>
          </div>
          
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left panel - Tactical info */}
            <div className="lg:w-1/3 space-y-6">
              <div>
                <h2 className="text-sm text-white/60 uppercase tracking-wider mb-4">{t.squad.currentTactic}</h2>

                <div className="flex flex-col items-center text-center mb-6">
                  <Scale className="h-24 w-24 md:h-32 md:w-32 text-white/80 mb-4" />
                  <h3 className="text-2xl md:text-3xl font-bold text-white uppercase tracking-wider">{t.squad.standard}</h3>
                </div>
                
                <p className="text-sm text-white/60 text-center leading-relaxed mb-6">
                  O seu time adota um estilo equilibrado, com foco em conservar uma estrutura tatica que de solidez defensiva sem abrir mao de levar perigo no ataque.
                </p>
                
                {/* Tactical categories */}
                <div className="space-y-3">
                  {sectorRatings.map((sector) => (
                    <div key={sector.label} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                      <span className="text-white">{sector.label}</span>
                      {sector.value === null ? (
                        <span className="text-white/40 text-sm">ND</span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <span className="text-[10px] text-white/35">{sector.count} jog.</span>
                          <span className={cn("text-sm font-bold", getOverallColor(sector.value))}>{sector.value}</span>
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* O botão era decorativo. Agora leva ao Centro Tático, onde a
                    mentalidade e as instruções são de fato alteradas. */}
                <Button
                  variant="outline"
                  onClick={() => router.push("/taticas")}
                  className="w-full mt-4 border-white/20 text-white"
                >
                  <Gamepad2 className="h-4 w-4 mr-2" />
                  {t.squad.changeTactic}
                </Button>
              </div>
            </div>
            
            {/* Right panel - Field with players */}
            <div className="lg:flex-1">
              <div className="flex items-center gap-2 mb-4">
                <X className="h-4 w-4 text-white/40" />
                <span className="text-sm text-white/60">{t.squad.playerImpact}</span>
              </div>
              
              {/* O campo só tinha aspect-ratio 3/4 governado pela LARGURA: em tela
                  wide ele ficava mais alto que a viewport e era cortado no meio —
                  7 dos 11 titulares ficavam fora da área visível, e a tela parecia
                  quebrada. Limitando a altura ao espaço disponível, o campo inteiro
                  (e o XI completo) cabe sempre. */}
              <div
                className="relative mx-auto w-full max-w-[min(100%,calc((100vh-260px)*0.75))] rounded-2xl overflow-hidden"
                style={{
                  background: `linear-gradient(180deg, oklch(0.42 0.14 145), oklch(0.32 0.11 145))`,
                  aspectRatio: "3 / 4",
                }}
              >
                {/* Pitch stripes */}
                <div
                  className="absolute inset-0 opacity-15"
                  style={{
                    backgroundImage: "repeating-linear-gradient(0deg, transparent 0 8%, rgba(0,0,0,0.15) 8% 16%)",
                  }}
                />
                
                {/* Pitch markings */}
                <svg viewBox="0 0 100 133" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
                  <g stroke="rgba(255,255,255,0.35)" strokeWidth="0.3" fill="none">
                    {/* Campo exterior */}
                    <rect x="3" y="3" width="94" height="127" rx="1" />
                    {/* Linha do meio */}
                    <line x1="3" y1="66.5" x2="97" y2="66.5" />
                    {/* Circulo central */}
                    <circle cx="50" cy="66.5" r="12" />
                    <circle cx="50" cy="66.5" r="0.8" fill="rgba(255,255,255,0.35)" />
                    {/* Area grande - topo (ataque) */}
                    <rect x="20" y="3" width="60" height="20" />
                    {/* Area pequena - topo */}
                    <rect x="32" y="3" width="36" height="8" />
                    {/* Arco da area - topo */}
                    <path d="M 35 23 Q 50 30 65 23" />
                    {/* Area grande - baixo (defesa) */}
                    <rect x="20" y="110" width="60" height="20" />
                    {/* Area pequena - baixo */}
                    <rect x="32" y="122" width="36" height="8" />
                    {/* Arco da area - baixo */}
                    <path d="M 35 110 Q 50 103 65 110" />
                    {/* Gol - topo */}
                    <rect x="40" y="0" width="20" height="3" strokeWidth="0.4" />
                    {/* Gol - baixo */}
                    <rect x="40" y="130" width="20" height="3" strokeWidth="0.4" />
                  </g>
                </svg>
                
                {/* Players */}
                {positionedPlayers.map((player) => (
                  <motion.button
                    key={player.id}
                    initial={false}
                    animate={{ left: `${player.x}%`, top: `${player.y}%` }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    onClick={() => setSelectedPlayerId(player.id)}
                    onDoubleClick={() => { setSelectedPlayerId(player.id); setShowPlayerProfile(true) }}
                    className={cn(
                      "absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group z-10",
                      selectedPlayerId === player.id && "z-20"
                    )}
                  >
                    <div className={cn(
                      "px-2 py-0.5 rounded text-[8px] md:text-[9px] font-semibold mb-1 whitespace-nowrap transition-all",
                      selectedPlayerId === player.id
                        ? "bg-[var(--brand)] text-[var(--brand-ink)]"
                        : "bg-black/60 text-white/90"
                    )}>
                      {player.name.split(" ").pop()}
                    </div>
                    
                    <div className="relative">
                      {player.potential > player.overall + 3 && (
                        <div className="absolute -top-1 -left-1 h-3 w-3 md:h-4 md:w-4 rounded-full bg-[var(--brand)] flex items-center justify-center z-10">
                          <TrendingUp className="h-2 w-2 md:h-2.5 md:w-2.5 text-black" />
                        </div>
                      )}
                      
                      <PlayerAvatarCircle
                        name={player.name}
                        fileKey={userTeam.file_key}
                        teamColor={userTeam.cor1}
                        size="sm"
                        className={cn(
                          "border-2 transition-all",
                          selectedPlayerId === player.id
                            ? "border-[var(--brand)] shadow-[0_0_12px_rgba(29,185,84,0.5)]"
                            : "border-white/30"
                        )}
                      />
                      
                      <div className={cn(
                        "absolute -bottom-1 -right-1 h-5 w-5 md:h-6 md:w-6 rounded-full flex items-center justify-center text-[9px] md:text-[10px] font-black",
                        "bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border",
                        selectedPlayerId === player.id ? "border-[var(--brand)]" : "border-white/30"
                      )}>
                        <span className={getOverallColor(player.overall)}>{player.overall}</span>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
          
          {/* Bottom controls */}
          <div className="fixed bottom-0 left-0 md:left-16 right-0 h-14 bg-[#0d0d0d] border-t border-white/10 flex items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-2 md:gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setCurrentView("menu")}
                className="text-white/60 hover:text-white text-xs md:text-sm"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t.common.back}
              </Button>
              <Button variant="ghost" size="sm" className="text-white/60 hover:text-white text-xs md:text-sm">
                <Info className="h-4 w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">{t.squad.showDetails}</span>
              </Button>
            </div>

            <Button
              onClick={() => setCurrentView("gerenciamento")}
              className="bg-primary/20 hover:bg-primary/30 text-primary text-xs md:text-sm"
            >
              {t.squad.goToTeamManagement}
            </Button>
          </div>
        </main>
      </div>
    )
  }

  // Gerenciamento view (main view)
  return (
    // pl-16 removido: reservava 64px para uma sidebar que nao existe nesta view,
    // deixando uma faixa vazia a esquerda. Agora o conteudo ocupa a largura toda.
    // flex flex-col: sem isso o flex-1 do conteudo nao tinha efeito (o pai nao era flex),
    // o campo parava na altura natural e sobrava uma faixa preta ate o rodape.
    //
    // pb-12 md:pb-14: a barra de acoes e `fixed bottom-0 h-12 md:h-14` e SOBREPOE o
    // layout. Sem reservar essa faixa, a ultima fileira dos reservas ficava
    // escondida ATRAS da barra — e sem scroll nenhum, porque a lista nao
    // transborda (medido: painel bottom 757 < viewport 768, scrollH == clientH).
    // Era isso, nao falta de scroll, o relato das "reservas cortadas".
    <div className="flex h-screen flex-col overflow-hidden bg-[#050508] pb-12 md:pb-14">
      <GameHeader team={userTeam} />
      
      {/* Match notification toast - only shows during actual match simulations */}
      <AnimatePresence>
        {isMatchInProgress && showMatchNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-[#1a1a1a] border border-white/10 shadow-2xl"
          >
            <Clock className="h-5 w-5 text-white/60" />
            <div>
              <p className="text-sm font-semibold text-white">Partida Iniciada</p>
              <p className="text-xs text-white/50">{userTeam.nome} x Sao Paulo - Campeonato Brasileiro</p>
            </div>
            <button 
              onClick={() => setShowMatchNotification(false)}
              className="p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* flex-1 min-h-0 em vez de h-[calc(100vh-48px-56px)]: a altura fixa reservava ~56px
          a mais que o header realmente ocupa, deixando uma faixa preta vazia no rodape. */}
      <main className="flex-1 min-h-0 flex flex-col">
        {/* Sub-header with tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between px-3 md:px-6 py-2 md:py-3 border-b border-white/10 bg-[#0d0d0d] gap-2 md:gap-0">
          <div className="flex items-center gap-3 md:gap-6">
            <div className="flex items-center gap-2 md:gap-3">
              <TeamCrest team={userTeam} size="sm" />
              <div className="hidden sm:block">
                <h1 className="text-sm font-bold text-white">{t.squad.teamManagement}</h1>
                <p className="text-[10px] text-white/40">{userTeam.nome}</p>
              </div>
            </div>
            
            {/* Tabs */}
            <div className="flex items-center gap-1">
              {(["elenco", "taticas", "atribuicoes"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-2 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium transition-all rounded",
                    activeTab === tab
                      ? "text-white bg-white/10"
                      : "text-white/40 hover:text-white/70"
                  )}
                >
                  {tab === "elenco" ? t.sidebar.squad : tab === "taticas" ? t.squad.tactics : t.squad.assignments}
                </button>
              ))}
            </div>
          </div>
          
          {/* Formation controls */}
          <div className="flex items-center gap-2 justify-center md:justify-end">
            <button
              onClick={handleSaveTacticalSetup}
              title="Salvar tática e escalação"
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-all",
                tacticalSaved
                  ? "border-[var(--brand)] bg-[var(--brand)]/20 text-[var(--brand)]"
                  : "border-white/10 bg-white/5 text-white hover:border-[var(--brand)]/50 hover:text-[var(--brand)]",
              )}
            >
              {tacticalSaved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              <span className="hidden xl:inline">{tacticalSaved ? "Salvo" : "Salvar"}</span>
            </button>
            <button
              onClick={prevFormation}
              className="p-1.5 md:p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {/* Dropdown: escolher a formacao direto (o relatorio pediu — antes so setas). */}
            <select
              value={formation}
              onChange={(e) => { setFormation(e.target.value); setPlayerPositions({}) }}
              title="Escolher formacao"
              className="px-3 md:px-4 py-1.5 md:py-2 min-w-[80px] md:min-w-[110px] text-center rounded-lg bg-[var(--brand)]/20 border border-[var(--brand)]/30 text-base md:text-lg font-black text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/50 appearance-none"
            >
              {formationKeys.map((f) => (
                <option key={f} value={f} className="bg-[#0c0c14] text-white font-bold">{f}</option>
              ))}
            </select>
            <button
              onClick={nextFormation}
              className="p-1.5 md:p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {/* Monta o melhor XI para a formação escolhida. O motor já sabia
                fazer isto (pickStartingXI), mas o técnico precisava arrastar
                os 11 na mão toda vez. */}
            <button
              onClick={autoPickLineup}
              title="Escalar o melhor XI disponível nesta formação"
              className="ml-1 flex items-center gap-1.5 rounded-lg border border-[var(--brand)]/30 bg-[var(--brand)]/10 px-2.5 py-1.5 text-[10px] font-bold text-[var(--brand)] transition hover:bg-[var(--brand)]/20 md:text-xs"
            >
              <Zap className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Auto-escalar</span>
            </button>

            {/* MODO MOVIMENTAÇÃO — ligado, o arrasto desenha a seta do
                deslocamento em vez de mudar a posição base. */}
            <button
              onClick={() => setModoMovimento(v => !v)}
              title={modoMovimento
                ? "Arraste um atleta para marcar PARA ONDE ele se desloca. Solte em cima dele para apagar a seta."
                : "Marcar a movimentação dos atletas"}
              className={cn(
                "ml-1 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition md:text-xs",
                modoMovimento
                  ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-ink)]"
                  : "border-white/15 text-white/70 hover:border-white/30 hover:text-white",
              )}
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Movimentação</span>
            </button>

            {/* ORIENTAÇÃO DA PRANCHETA — em pé (camisas) ou deitada (cartas com
                foto, estilo EA FC). As duas coisas andam juntas de propósito:
                é a largura do campo deitado que dá espaço para a carta. */}
            <button
              onClick={() => setState({ campoHorizontal: !campoHorizontal })}
              title={campoHorizontal
                ? "Voltar à prancheta em pé, com as camisas do clube"
                : "Campo deitado, com os onze em cartas de foto"}
              className={cn(
                "ml-1 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition md:text-xs",
                campoHorizontal
                  ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-ink)]"
                  : "border-white/15 text-white/70 hover:border-white/30 hover:text-white",
              )}
            >
              {campoHorizontal
                ? <RectangleHorizontal className="h-3.5 w-3.5" />
                : <RectangleVertical className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{campoHorizontal ? "Cartas" : "Camisas"}</span>
            </button>

            {/* TROCAR O UNIFORME da prancheta (casa / fora / terceiro). Agora que
                os onze vestem a camisa do clube, dá para ver como o time fica
                com cada uma — e a escolha é a MESMA do save, então vale também
                para a partida. Só aparecem as variantes que o clube tem arte. */}
            {uniformesDisponiveis.length > 1 && (
              <div className="ml-1 flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.04] p-0.5">
                {uniformesDisponiveis.map(v => (
                  <button
                    key={v}
                    onClick={() => setState({ selectedUniform: v })}
                    title={v === "home" ? "Uniforme 1 (casa)" : v === "away" ? "Uniforme 2 (fora)" : "Uniforme 3"}
                    className={cn(
                      "rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors md:text-[11px]",
                      uniformeDoCampo === v
                        ? "bg-[var(--brand)] text-[var(--brand-ink)]"
                        : "text-white/50 hover:bg-white/10 hover:text-white/80",
                    )}
                  >
                    {v === "home" ? "Casa" : v === "away" ? "Fora" : "3º"}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          {/* Main content area */}
          {/* overflow-hidden + coluna flex de verdade: antes era overflow-y-auto e o
              campo (flex-1, sem teto) crescia ate empurrar os reservas para BAIXO
              da tela. O scroll interno do painel nunca entrava em acao porque o
              painel inteiro estava fora do viewport — dava a impressao de que
              faltava scroll quando na verdade faltava ANCORAR o painel. */}
          <div className="flex-1 flex flex-col p-2 md:p-4 min-h-0 overflow-hidden">
            {/* Tab Content: Elenco */}
            {activeTab === "elenco" && (
            <>
            {/* Pitch area */}
            <div
              ref={pitchRef}
              onDragOver={handleDragOver}
              onDrop={handleDropOnPitch}
              // min-h-0: o campo pode encolher para o painel de reservas caber. Com
              // min-h-[350px] ele se recusava a ceder em telas baixas e o banco sumia.
              className={cn(
                "relative rounded-xl md:rounded-2xl overflow-hidden flex-1 min-h-0 w-full mx-auto",
                // Deitado o campo precisa de LARGURA, não de altura: o teto de
                // 560px foi calibrado para a prancheta em pé e espremeria as
                // cartas numa faixa estreita no meio da tela.
                campoHorizontal ? "max-w-[1100px]" : "max-w-[560px]",
              )}
              style={{
                // Prancheta tática em azul-marinho, como a referência do dossiê:
                // os cards de função ficam legíveis por cima, o que o verde vivo
                // anterior não permitia.
                background:
                  "radial-gradient(120% 90% at 50% -6%, #16304d 0%, #122741 44%, #0d1c30 78%, #091320 100%)",
                boxShadow: "inset 0 0 60px rgba(0,0,0,0.55)",
              }}
            >
              {/* Refletores nos quatro cantos (clima de estadio a noite). */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(60% 55% at 15% 8%, rgba(255,255,235,0.10), transparent 70%)," +
                    "radial-gradient(60% 55% at 85% 8%, rgba(255,255,235,0.10), transparent 70%)," +
                    "radial-gradient(60% 55% at 15% 92%, rgba(255,255,235,0.07), transparent 70%)," +
                    "radial-gradient(60% 55% at 85% 92%, rgba(255,255,235,0.07), transparent 70%)",
                }}
              />
              {/* Pitch stripes */}
              <div
                className="absolute inset-0 opacity-15"
                style={{
                  backgroundImage: "repeating-linear-gradient(0deg, transparent 0 8%, rgba(0,0,0,0.15) 8% 16%)",
                }}
              />
              
              {/* Pitch markings.
                  Duas versões, e não uma girada por CSS: com `preserveAspectRatio="none"`
                  o campo é esticado para preencher o contêiner, então rotacionar o SVG
                  deixaria as linhas com espessuras diferentes na horizontal e na
                  vertical — círculo central virando elipse achatada. */}
              {campoHorizontal ? (
                <svg viewBox="0 0 133 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
                  <g stroke="rgba(255,255,255,0.35)" strokeWidth="0.3" fill="none">
                    {/* Campo exterior */}
                    <rect x="3" y="3" width="127" height="94" rx="1" />
                    {/* Linha do meio */}
                    <line x1="66.5" y1="3" x2="66.5" y2="97" />
                    {/* Circulo central */}
                    <circle cx="66.5" cy="50" r="12" />
                    <circle cx="66.5" cy="50" r="0.8" fill="rgba(255,255,255,0.35)" />
                    {/* Area grande - direita (ataque) */}
                    <rect x="110" y="20" width="20" height="60" />
                    <rect x="122" y="32" width="8" height="36" />
                    <circle cx="117" cy="50" r="0.8" fill="rgba(255,255,255,0.35)" />
                    <path d="M 110 35 Q 103 50 110 65" />
                    {/* Area grande - esquerda (defesa) */}
                    <rect x="3" y="20" width="20" height="60" />
                    <rect x="3" y="32" width="8" height="36" />
                    <circle cx="16" cy="50" r="0.8" fill="rgba(255,255,255,0.35)" />
                    <path d="M 23 35 Q 30 50 23 65" />
                    {/* Gols */}
                    <rect x="130" y="40" width="3" height="20" strokeWidth="0.4" />
                    <rect x="0" y="40" width="3" height="20" strokeWidth="0.4" />
                  </g>
                </svg>
              ) : (
              <svg viewBox="0 0 100 133" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
                <g stroke="rgba(255,255,255,0.35)" strokeWidth="0.3" fill="none">
                  {/* Campo exterior */}
                  <rect x="3" y="3" width="94" height="127" rx="1" />
                  {/* Linha do meio */}
                  <line x1="3" y1="66.5" x2="97" y2="66.5" />
                  {/* Circulo central */}
                  <circle cx="50" cy="66.5" r="12" />
                  <circle cx="50" cy="66.5" r="0.8" fill="rgba(255,255,255,0.35)" />
                  {/* Area grande - topo (ataque) */}
                  <rect x="20" y="3" width="60" height="20" />
                  {/* Area pequena - topo */}
                  <rect x="32" y="3" width="36" height="8" />
                  {/* Ponto do penalti - topo */}
                  <circle cx="50" cy="16" r="0.8" fill="rgba(255,255,255,0.35)" />
                  {/* Arco da area - topo */}
                  <path d="M 35 23 Q 50 30 65 23" />
                  {/* Area grande - baixo (defesa) */}
                  <rect x="20" y="110" width="60" height="20" />
                  {/* Area pequena - baixo */}
                  <rect x="32" y="122" width="36" height="8" />
                  {/* Ponto do penalti - baixo */}
                  <circle cx="50" cy="117" r="0.8" fill="rgba(255,255,255,0.35)" />
                  {/* Arco da area - baixo */}
                  <path d="M 35 110 Q 50 103 65 110" />
                  {/* Gol - topo */}
                  <rect x="40" y="0" width="20" height="3" strokeWidth="0.4" />
                  {/* Gol - baixo */}
                  <rect x="40" y="130" width="20" height="3" strokeWidth="0.4" />
                </g>
              </svg>
              )}

              {/* SETAS DE MOVIMENTAÇÃO.
                  Uma por atleta que tem destino marcado: sai da posição base e
                  aponta para onde ele vai com a bola. Fica ATRÁS das camisas
                  (z menor) para não atrapalhar o arrasto. */}
              {Object.keys(movimentos).length > 0 && (
                <svg
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <marker id="ponta-mov" viewBox="0 0 10 10" refX="8" refY="5"
                      markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--brand)" />
                    </marker>
                  </defs>
                  {positionedPlayers.map(p => {
                    const destino = movimentos[p.name]
                    if (!destino) return null
                    // As setas vivem no mesmo sistema de coordenadas das cartas:
                    // sem converter, elas apontariam para o lado errado na
                    // prancheta deitada.
                    const de = paraTela(p)
                    const ate = paraTela(destino)
                    return (
                      <line
                        key={p.id}
                        x1={de.left} y1={de.top} x2={ate.left} y2={ate.top}
                        stroke="var(--brand)" strokeWidth="0.6" strokeOpacity="0.75"
                        strokeDasharray="2.4 1.6" markerEnd="url(#ponta-mov)"
                        vectorEffect="non-scaling-stroke"
                      />
                    )
                  })}
                </svg>
              )}

              {/* Players on pitch */}
              {positionedPlayers.map((player) => {
                // Quem tem seta VAI E VOLTA devagar entre a base e o destino:
                // é o movimento acontecendo, não um desenho parado. Ida de 2,6s,
                // volta igual, com uma pausa curta — leitura calma, sem piscar.
                const destino = movimentos[player.name]
                const temMovimento = Boolean(destino)
                const pos = paraTela(player)
                const posDestino = destino ? paraTela(destino) : null
                return (
                <motion.div
                  key={player.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, player.id)}
                  onDragOver={(e) => handleDragOverPlayer(e as unknown as React.DragEvent, player.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDropOnPlayer(e as unknown as React.DragEvent, player.id)}
                  onDragEnd={handleDragEnd}
                  initial={false}
                  animate={temMovimento && draggingPlayer !== player.id && posDestino ? {
                    left: [`${pos.left}%`, `${posDestino.left}%`, `${pos.left}%`],
                    top: [`${pos.top}%`, `${posDestino.top}%`, `${pos.top}%`],
                    scale: selectedPlayerId === player.id ? 1.05 : 1,
                    opacity: 1,
                  } : {
                    left: `${pos.left}%`,
                    top: `${pos.top}%`,
                    scale: draggingPlayer === player.id ? 1.1 : dragOverTarget === player.id ? 1.15 : selectedPlayerId === player.id ? 1.05 : 1,
                    opacity: draggingPlayer === player.id ? 0.7 : 1,
                  }}
                  transition={temMovimento && draggingPlayer !== player.id
                    ? { duration: 5.2, times: [0, 0.5, 1], repeat: Infinity, repeatDelay: 0.6, ease: "easeInOut" }
                    : { type: "spring", stiffness: 400, damping: 30 }}
                  onClick={() => setSelectedPlayerId(player.id)}
                    onDoubleClick={() => { setSelectedPlayerId(player.id); setShowPlayerProfile(true) }}
                  className={cn(
                    "absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-grab active:cursor-grabbing group z-10",
                    selectedPlayerId === player.id && "z-20",
                    dragOverTarget === player.id && "ring-2 ring-[var(--brand)] ring-offset-2 ring-offset-transparent rounded-full"
                  )}
                >
                  {/* PRANCHETA HORIZONTAL: carta com a FOTO do atleta, no estilo
                      EA FC. Na vertical a camisa do clube é a leitura certa (é o
                      que todo jogo usa em pé, e onze rostos minúsculos não se
                      distinguem). Deitado sobra largura, e a carta com foto,
                      overall e posição é o que a pessoa reconhece de relance. */}
                  {campoHorizontal ? (
                    <CartaDeJogador
                      nome={player.name}
                      fileKey={userTeam.file_key}
                      posicao={normalizePosition(player.position)}
                      slot={slotEfetivo(player)}
                      overall={player.overall}
                      numero={numeroDaCamisa(player.id)}
                      selecionado={selectedPlayerId === player.id}
                      funcao={selectedPlayerId === player.id ? roleLabelFor(player) : null}
                      promessa={player.potential > player.overall + 3}
                      pills={badgesStatus(player.name)}
                      emTreino={statusFor(player.name).training}
                    />
                  ) : (
                  <div className="relative flex flex-col items-center">
                    <div
                      className={cn(
                        "relative h-[42px] w-[42px] md:h-[52px] md:w-[52px] transition-all",
                        selectedPlayerId === player.id && "drop-shadow-[0_0_10px_var(--brand)]",
                      )}
                    >
                      <Image
                        src={camisaDoCampo}
                        alt=""
                        fill
                        unoptimized
                        className="object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]"
                      />
                      {/* Número da camisa, centrado no peito. Sem número no save
                          (elenco importado), cai na sigla da posição. */}
                      <span className="absolute inset-0 flex items-center justify-center pt-[15%] text-[11px] font-black text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.9)] md:text-[13px]">
                        {numeroDaCamisa(player.id) ?? normalizePosition(player.position)}
                      </span>
                    </div>

                    <div
                      className={cn(
                        "mt-0.5 max-w-[86px] rounded px-1.5 py-[1px] text-center transition-colors",
                        selectedPlayerId === player.id ? "bg-[var(--brand)]" : "bg-black/55",
                      )}
                    >
                      <div className={cn(
                        "truncate text-[9px] font-bold leading-tight md:text-[10px]",
                        selectedPlayerId === player.id ? "text-[var(--brand-ink)]" : "text-white",
                      )}>
                        {player.name.split(" ").pop()}
                      </div>
                      {/* OVERALL EFETIVO NO SLOT — a prancheta em pé mostra a
                          mesma verdade da carta: escalar um goleiro na zaga
                          derruba o rendimento dele, e isso precisa aparecer
                          ANTES da partida (o motor já cobrava, em silêncio). */}
                      {(() => {
                        const slot = slotEfetivo(player)
                        const origem = normalizePosition(player.position)
                        const fator = penalidadeImprovisacao(origem, slot)
                        const efetivo = Math.round(player.overall * fator)
                        const improvisado = fator < 1
                        return (
                          <div className="flex items-center justify-center gap-1 text-[8px] leading-tight md:text-[9px]">
                            <span className={cn(
                              selectedPlayerId === player.id ? "text-black/70" : "text-white/50",
                              improvisado && selectedPlayerId !== player.id && "text-amber-300",
                            )}>
                              {improvisado ? `${origem}→${slot}` : origem}
                            </span>
                            <span
                              className={cn(
                                selectedPlayerId === player.id
                                  ? "font-bold text-black"
                                  : improvisado ? "font-bold text-amber-300" : getOverallColor(player.overall),
                              )}
                              title={improvisado ? `Improvisado: rende ${efetivo} no lugar de ${player.overall}.` : undefined}
                            >
                              {efetivo}
                            </span>
                            {improvisado && (
                              <span className="text-white/35 line-through">{player.overall}</span>
                            )}
                          </div>
                        )
                      })()}
                      {/* A função só no selecionado: com onze rótulos o campo
                          virava um mural de texto. */}
                      {selectedPlayerId === player.id && (
                        <div className="truncate text-[8px] leading-tight text-black/70">{roleLabelFor(player)}</div>
                      )}
                    </div>

                    {/* Potential indicator */}
                    {player.potential > player.overall + 3 && (
                      <div className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full bg-[var(--brand)] flex items-center justify-center">
                        <TrendingUp className="h-2 w-2 text-black" />
                      </div>
                    )}
                    {/* Lesão/treino visíveis no card — o relato "em treino fica
                        afastado?" nasceu de status invisível na escalação. */}
                    {(() => {
                      const st = statusFor(player.name)
                      const pills = badgesStatus(player.name)
                      // Sem lesão nem status, mas em treino: mostra só o TREINO.
                      if (pills.length === 0 && st.training) return (
                        <div className="absolute inset-x-0 -top-1 mx-auto w-fit rounded bg-amber-400 px-1 text-[7px] font-black text-black">
                          TREINO
                        </div>
                      )
                      if (pills.length === 0) return null
                      // Empilha as pílulas (lesão/contrato/empréstimo) no topo do card.
                      return (
                        <div className="absolute inset-x-0 -top-1 mx-auto flex w-fit flex-col items-center gap-0.5">
                          {pills.map(p => (
                            <div key={p.key} className={cn("rounded px-1 text-[7px] font-black leading-tight", p.cls)}>{p.label}</div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                  )}
                </motion.div>
                )
              })}

              {/* Tactical instruction overlay */}
              <button 
                onClick={() => setBallInstruction(prev => prev === "sem_bola" ? "com_bola" : "sem_bola")}
                className="absolute bottom-2 md:bottom-4 left-2 md:left-4 flex items-center gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white/70 text-[10px] md:text-xs transition-colors border border-white/10"
              >
                <span>{ballInstruction === "sem_bola" ? "Sem a bola" : "Com a bola"}</span>
                <span className="text-white/40">|</span>
                <span className="text-[var(--brand)]">Trocar instrucao</span>
                <ChevronRight className="h-3 w-3 text-[var(--brand)]" />
              </button>
            </div>
            
            {/* Banco de reservas — FECHADO por padrao (pedido).
                Aberto, ele comia metade da tela e o campo ficava espremido: com
                23 reservas em 7 colunas sao quatro fileiras que quase ninguem
                olha o tempo todo. Agora e uma barra que se abre quando o tecnico
                QUER o banco (substituir, ver quem esta lesionado) e devolve a
                altura para o campo assim que fecha.
                max-h-[46vh] quando aberto: com quatro fileiras, menos que isso
                deixava a ultima sempre pela metade. */}
            <div className={cn(
              "mt-2 flex min-h-0 flex-shrink-0 flex-col rounded-xl border border-white/[0.04] bg-[#111111] p-3",
              bancoAberto && "max-h-[340px]",
            )}>
              <button
                type="button"
                onClick={() => setBancoAberto(v => !v)}
                aria-expanded={bancoAberto}
                className="flex items-center justify-between gap-3 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-white/[0.04]"
              >
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/80">
                  <ChevronRight className={cn("h-3.5 w-3.5 text-[var(--brand)] transition-transform", bancoAberto && "rotate-90")} />
                  {t.squad.reserves} ({bench.length})
                </h3>
                <span className="text-[10px] text-white/40">
                  {bancoAberto ? t.squad.dragToSubstitute : "Clique para abrir o banco"}
                </span>
              </button>

              {bancoAberto && (
              <>
              {/* Legenda das cores de status — para o técnico ler o elenco de relance. */}
              <div className="mb-2 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-white/45">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 ring-1 ring-black/40" /> Lesão / contrato vencido</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-400 ring-1 ring-black/40" /> Empréstimo</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400 ring-1 ring-black/40" /> Contrato a vencer</span>
              </div>

              {/* min-h-0 + flex-1: a lista ocupa a altura que sobrar dentro do
                  teto do painel, em vez de ter um teto proprio que brigava com o
                  do pai e deixava a ultima fileira sempre pela metade. */}
              <div className="min-h-0 flex-1 overflow-y-auto scrollbar-game pr-1">
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-2">
                  {bench.map((player) => {
                    const posColors = positionColors[player.position] || positionColors.MEI
                    return (
                      <motion.div
                        key={player.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, player.id)}
                        onDragOver={(e) => handleDragOverPlayer(e as unknown as React.DragEvent, player.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDropOnPlayer(e as unknown as React.DragEvent, player.id)}
                        onDragEnd={handleDragEnd}
                        animate={{
                          scale: draggingPlayer === player.id ? 1.05 : dragOverTarget === player.id ? 1.1 : 1,
                          opacity: draggingPlayer === player.id ? 0.7 : 1,
                        }}
                        onClick={() => setSelectedPlayerId(player.id)}
                    onDoubleClick={() => { setSelectedPlayerId(player.id); setShowPlayerProfile(true) }}
                        className={cn(
                          "relative flex flex-col items-center p-2 rounded-lg cursor-grab active:cursor-grabbing transition-all",
                          selectedPlayerId === player.id
                            ? "bg-[var(--brand)]/15 ring-1 ring-[var(--brand)]/40"
                            : destaqueStatus(player.name) || "bg-white/[0.03] hover:bg-white/[0.06]",
                          dragOverTarget === player.id && "ring-2 ring-[var(--brand)]"
                        )}
                      >
                        {(() => {
                          const st = statusFor(player.name)
                          const ct = situacaoContrato.get(player.name)
                          const cor = st.injured || ct === "expired" ? "bg-red-500"
                            : (st.loanedIn || st.loanListed) ? "bg-sky-400"
                            : ct === "expiring" ? "bg-amber-400" : null
                          if (!cor) return null
                          const titulo = st.injured ? `Lesão (${st.injuryWeeks} sem.)`
                            : ct === "expired" ? "Contrato vencido"
                            : st.loanedIn ? "Jogador por empréstimo"
                            : st.loanListed ? "Na lista de empréstimo"
                            : "Contrato a vencer"
                          return <span title={titulo} className={cn("absolute right-1 top-1 z-10 h-2 w-2 rounded-full ring-1 ring-black/40", cor)} />
                        })()}
                        <div className="relative mb-1">
                          <PlayerAvatarCircle
                            name={player.name}
                            fileKey={userTeam.file_key}
                            teamColor={userTeam.cor1}
                            size="xs"
                            className={cn(
                              "border-2 transition-colors",
                              selectedPlayerId === player.id ? "border-[var(--brand)]/60" : "border-white/10"
                            )}
                          />
                          <div className={cn(
                            "absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-black",
                            "bg-[#1a1a1a] border",
                            selectedPlayerId === player.id ? "border-[var(--brand)]/50" : "border-white/20"
                          )}>
                            <span className={getOverallColor(player.overall)}>{player.overall}</span>
                          </div>
                        </div>
                        <span className="text-[9px] text-white/80 font-medium truncate w-full text-center">{player.name.split(" ").pop()}</span>
                        <span className={cn("text-[8px] font-semibold mt-0.5 px-1 py-px rounded", posColors.bg, posColors.text)}>{player.position}</span>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
              </>
              )}
            </div>
            </>
            )}

            {/* Tab Content: Taticas */}
            {activeTab === "taticas" && (
              <div className="flex-1 rounded-xl md:rounded-2xl bg-[#111111] border border-white/10 overflow-auto p-4 md:p-6">
                <div className="max-w-4xl mx-auto space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-white mb-2">{t.squad.tacticalInstructions}</h2>
                    <p className="text-sm text-white/50">{t.squad.tacticalInstructionsDesc}</p>
                    {/* A tatica é salva automaticamente a cada mudança — nao ha botao "gravar"
                        (foi relatado como confuso). Este selo deixa isso claro. */}
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--brand)]/10 px-3 py-1 text-[11px] font-medium text-[var(--brand)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" /> Alterações salvas automaticamente
                    </div>
                  </div>

                  {/* Defensive Style */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-blue-400" />
                      {t.squad.defensiveStyle}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-white/60 block mb-2">{t.squad.defensiveLine}</label>
                        <div className="flex gap-2">
                          {[t.squad.low, t.squad.medium, t.squad.high].map((opt, i) => (
                            <button key={opt} onClick={() => setLinhaDefensiva(i)} className={cn(
                              "flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                              linhaDefensiva === i ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "bg-white/5 text-white/60 hover:bg-white/10"
                            )}>{opt}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-white/60 block mb-2">{t.squad.marking}</label>
                        <div className="flex gap-2">
                          {[t.squad.pressure, t.squad.balanced, t.squad.withdrawn].map((opt, i) => (
                            <button key={opt} onClick={() => setMarcacao(i)} className={cn(
                              "flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                              marcacao === i ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "bg-white/5 text-white/60 hover:bg-white/10"
                            )}>{opt}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Offensive Style */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                      <Target className="h-4 w-4 text-red-400" />
                      {t.squad.offensiveStyle}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-white/60 block mb-2">{t.squad.buildStyle}</label>
                        <div className="flex gap-2">
                          {[t.squad.short, t.squad.mixed, t.squad.direct].map((opt, i) => (
                            <button key={opt} onClick={() => setConstrucao(i)} className={cn(
                              "flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                              construcao === i ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "bg-white/5 text-white/60 hover:bg-white/10"
                            )}>{opt}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-white/60 block mb-2">{t.squad.attackSpeed}</label>
                        <div className="flex gap-2">
                          {[t.squad.slow, t.squad.normal, t.squad.fast].map((opt, i) => (
                            <button key={opt} onClick={() => setVelocidadeAtaque(i)} className={cn(
                              "flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                              velocidadeAtaque === i ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "bg-white/5 text-white/60 hover:bg-white/10"
                            )}>{opt}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Team Mentality */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-400" />
                      {t.squad.mentality}
                    </h3>
                    <div className="flex gap-2">
                      {[t.squad.ultraDefensive, t.squad.defensive, t.squad.balanced2, t.squad.offensive, t.squad.ultraOffensive].map((opt, i) => (
                        <button key={opt} onClick={() => setMentalidade(i)} className={cn(
                          "flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                          mentalidade === i ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "bg-white/5 text-white/60 hover:bg-white/10"
                        )}>{opt}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab Content: Atribuicoes */}
            {activeTab === "atribuicoes" && (
              <div className="flex-1 rounded-xl md:rounded-2xl bg-[#111111] border border-white/10 overflow-auto p-4 md:p-6">
                <div className="max-w-4xl mx-auto space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-white mb-2">{t.squad.playerRoles}</h2>
                    <p className="text-sm text-white/50">{t.squad.playerRolesDesc}</p>
                  </div>

                  {/* Bolas paradas — cobradores REAIS do elenco, escolhiveis. */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="text-sm font-semibold text-white mb-4">{t.squad.setPieces}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {([
                        { key: "corner", label: t.squad.cornerKicker, pool: allPlayers.filter(p => p.position !== "GOL") },
                        { key: "freeKickLeft", label: "Falta (esquerda)", pool: allPlayers.filter(p => p.position !== "GOL") },
                        { key: "freeKickRight", label: "Falta (direita)", pool: allPlayers.filter(p => p.position !== "GOL") },
                        { key: "penalty", label: t.squad.penaltyKicker, pool: allPlayers.filter(p => p.position !== "GOL") },
                        { key: "captain", label: t.squad.captain, pool: allPlayers },
                      ] as const).map(({ key, label, pool }) => (
                        <div key={key} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-white/5">
                          <span className="text-xs text-white/70 shrink-0">{label}</span>
                          <select
                            value={setPieces[key]}
                            onChange={(e) => updateSetPiece(key, e.target.value)}
                            className="min-w-0 flex-1 max-w-[60%] truncate rounded-lg border border-white/10 bg-white/10 px-2 py-1 text-xs font-medium text-[var(--brand)] focus:border-[var(--brand)] focus:outline-none"
                          >
                            {pool.map(p => (
                              <option key={p.id} value={p.name} className="bg-[#111111] text-white">
                                {p.name} ({p.position})
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Funcoes individuais — agora com estado (o select nao fazia nada). */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="text-sm font-semibold text-white mb-4">{t.squad.individualRoles}</h3>
                    <div className="space-y-3">
                      {players.map(player => (
                        <div key={player.id} className={cn("flex items-center gap-4 p-3 rounded-lg bg-white/5", destaqueStatus(player.name))}>
                          <PlayerAvatarCircle name={player.name} fileKey={userTeam.file_key} teamColor={userTeam.cor1} size="xs" />
                          <div className="flex-1 min-w-0">
                            <div className="truncate text-sm font-medium text-white">{player.name}</div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] text-white/40">{player.position}</span>
                              {(() => { const d = dadosMotor.get(player.name); return (<>
                                {d?.nota != null && (
                                  <span className={cn("rounded bg-white/8 px-1.5 text-[9px] font-black tabular-nums", corDaNota(d.nota))} title="Nota da última partida">
                                    {d.nota.toFixed(1)}
                                  </span>
                                )}
                                {d && d.susp > 0 && (
                                  <span className="rounded bg-red-500/25 px-1.5 text-[9px] font-black uppercase tracking-wide text-red-300" title="Suspenso">
                                    suspenso {d.susp}
                                  </span>
                                )}
                                {d?.persona && (
                                  <span className="rounded bg-white/6 px-1.5 text-[9px] font-medium uppercase tracking-wide text-white/45">{d.persona}</span>
                                )}
                              </>) })()}
                              {badgesStatus(player.name).map(p => (
                                <span key={p.key} className={cn("rounded px-1.5 text-[9px] font-black uppercase tracking-wide", p.cls)}>{p.label}</span>
                              ))}
                            </div>
                          </div>
                          <select
                            value={playerRoles[player.id] ?? player.function}
                            onChange={(e) => updatePlayerRole(player.id, e.target.value)}
                            className="shrink-0 rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-xs text-white focus:border-[var(--brand)] focus:outline-none"
                          >
                            {Array.from(new Set([player.function, "Equilibrado", "Ofensivo", "Defensivo"])).map(opt => (
                              <option key={opt} value={opt} className="bg-[#111111]">{opt}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right panel - Player details (hidden on mobile, shown in drawer) */}
          <aside className="hidden lg:block w-72 xl:w-80 flex-shrink-0 border-l border-white/[0.04] bg-[#050508] overflow-y-auto">
            {/* Player header - Melhorado */}
            <div className="p-4 border-b border-white/[0.04]" style={{
              background: `linear-gradient(135deg, ${userTeam.cor1}20 0%, transparent 60%)`
            }}>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className={cn(
                    "w-16 h-16 rounded-xl flex items-center justify-center text-3xl font-black",
                    "bg-gradient-to-br from-white/10 to-white/5 border border-white/10"
                  )}>
                    <span className={getOverallColor(selectedPlayer.overall)}>{selectedPlayer.overall}</span>
                  </div>
                  <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md bg-[#1a1a1a] border border-white/10 text-[9px] font-bold text-white/70">
                    {selectedPlayer.position}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-white uppercase truncate">{selectedPlayer.name}</h2>
                  <p className="text-[11px] text-white/40 mt-0.5">
                    {selectedPlayer.position === "ATA" || selectedPlayer.position === "PD" || selectedPlayer.position === "PE" ? "Atacante" : selectedPlayer.position === "MEI" || selectedPlayer.position === "VOL" ? "Meio-campista" : selectedPlayer.position === "ZAG" || selectedPlayer.position === "LD" || selectedPlayer.position === "LE" ? "Defensor" : "Goleiro"}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Player info - Melhorado */}
            <div className="p-4 space-y-4">
              {/* Energia com barra maior */}
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-white/50 font-medium">{t.squad.energy}</span>
                  <span className="text-sm font-bold text-[var(--brand)]">{selectedPlayer.energy}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-[var(--brand)] to-[var(--brand-2)] rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${selectedPlayer.energy}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              {/* Informacoes do atleta - Grid melhorado */}
              <div>
                <h3 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-3">
                  Informacoes do Atleta
                </h3>

                <label className="mb-3 flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] p-2 text-[10px] text-white/55">
                  Número da camisa
                  <select
                    value={engineSquadPlayers.find(player => player.id === selectedPlayer.id)?.shirtNumber ?? ""}
                    onChange={(event) => {
                      const number = Number(event.target.value)
                      if (number && !engineSetPlayerShirtNumber(selectedPlayer.id, number)) {
                        addNotification({ type: "system", title: "Número indisponível", message: `A camisa ${number} já está em uso no elenco.`, priority: "high" })
                      }
                    }}
                    className="rounded border border-white/10 bg-black/50 px-2 py-1 text-xs font-bold text-[var(--brand)]"
                    aria-label={`Número da camisa de ${selectedPlayer.name}`}
                  >
                    <option value="">Automático</option>
                    {Array.from({ length: 99 }, (_, index) => index + 1).map(number => <option key={number} value={number}>{number}</option>)}
                  </select>
                </label>
                
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Ritmo", value: selectedPlayer.rhythm, isNum: true },
                    { label: "Idade", value: selectedPlayer.age, isNum: false },
                    { label: "Moral", value: selectedPlayer.moral, isMoral: true },
                    { label: "Finaliz.", value: selectedPlayer.shooting, isNum: true },
                    { label: "Perna", value: selectedPlayer.foot, isNum: false },
                    { label: "Passes", value: selectedPlayer.passing, isNum: true },
                    { label: "Aceleracao", value: selectedPlayer.acceleration, isNum: false },
                    { label: "Conducao", value: selectedPlayer.dribbling, isNum: true },
                    { label: "Funcao", value: selectedPlayer.function, isNum: false, truncate: true },
                    { label: "Defesa", value: selectedPlayer.defending, isNum: true },
                    { label: "Altura", value: `${selectedPlayer.height} cm`, isNum: false },
                    { label: "Fisico", value: selectedPlayer.physical, isNum: true },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02]">
                      <span className="text-[10px] text-white/40">{item.label}</span>
                      <span className={cn(
                        "text-[11px] font-medium",
                        item.isNum ? getStatColor(item.value as number) : 
                        item.isMoral ? getMoralColor(item.value as string) : "text-white/80",
                        item.truncate && "truncate max-w-[50px]"
                      )}>
                        {item.value}
                        {item.isMoral && item.value === "Feliz" && <Smile className="h-3 w-3 inline ml-1" />}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Playstyles - Melhorado */}
              <div className="pt-3 border-t border-white/[0.04]">
                <h3 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-3">
                  Estilos de Jogo
                </h3>
                
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-white/60">Fintas</span>
                    <div className="flex items-center gap-0.5">
                      {getStarRating(selectedPlayer.fintas)}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Actions - Melhorado */}
              <div className="pt-3 border-t border-white/[0.04]">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSubstitutionModal(true)}
                  className="w-full h-10 border-white/10 text-white/70 hover:text-white hover:bg-[var(--brand)]/10 hover:border-[var(--brand)]/30 text-xs mb-2"
                >
                  <ArrowLeftRight className="h-4 w-4 mr-2" />
                  Substituir
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPlayerProfile(true)}
                  className="w-full h-9 text-white/50 hover:text-white hover:bg-white/5 text-xs"
                >
                  <Info className="h-3.5 w-3.5 mr-2" />
                  Ver Perfil Completo
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </main>
      
      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 h-12 md:h-14 bg-[#0d0d0d] border-t border-white/10 flex items-center justify-between px-2 md:px-6">
        <div className="flex items-center gap-1 md:gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setCurrentView("menu")}
            className="text-white/60 hover:text-white text-[10px] md:text-sm px-2 md:px-3"
          >
            <ChevronLeft className="h-3 w-3 md:h-4 md:w-4 mr-0.5 md:mr-1" />
            <span className="hidden sm:inline">{t.common.back}</span>
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setCurrentView("visao_tatica")}
            className="text-white/60 hover:text-white text-[10px] md:text-sm px-2 md:px-3"
          >
            <RotateCcw className="h-3 w-3 md:h-4 md:w-4 mr-0.5 md:mr-1" />
            <span className="hidden md:inline">Editar tatica ativa</span>
          </Button>
        </div>
        
        <div className="flex items-center gap-1 md:gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowLeaderboards(true)}
            aria-label="Destaques"
            title="Artilheiros, assistências e cartões"
            className="bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white text-[10px] md:text-sm px-2 md:px-3"
          >
            <Trophy className="h-3 w-3 md:h-4 md:w-4 mr-0.5 md:mr-1 text-yellow-400" />
            <span className="hidden sm:inline">Destaques</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSuggestedSubs(true)}
            aria-label="Substituicoes sugeridas"
            title="Substituicoes sugeridas"
            className="bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white text-[10px] md:text-sm px-2 md:px-3"
          >
            <Shuffle className="h-3 w-3 md:h-4 md:w-4 mr-0.5 md:mr-1" />
            <span className="inline max-w-[76px] truncate sm:max-w-none">Substituicoes sugeridas</span>
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowSubstitutionModal(true)}
            className="text-white/60 hover:text-white text-[10px] md:text-sm px-2 md:px-3 hidden sm:flex"
          >
            <ArrowLeftRight className="h-3 w-3 md:h-4 md:w-4 mr-0.5 md:mr-1" />
            <span>Substituicoes rapidas</span>
          </Button>
          <div className="w-px h-4 md:h-6 bg-white/10 hidden md:block" />
          <Button variant="ghost" size="sm" className="text-white/60 hover:text-white text-[10px] md:text-sm px-2 md:px-3 hidden md:flex">
            Rolagem
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowTutorials(true)}
            className="text-white/60 hover:text-white text-[10px] md:text-sm px-2 md:px-3"
          >
            <Info className="h-3 w-3 md:h-4 md:w-4 sm:mr-1" />
            <span className="hidden sm:inline">{t.squad.tutorials}</span>
          </Button>
        </div>
      </div>
      
      {/* Substitution Modal */}
      <AnimatePresence>
        {showSubstitutionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowSubstitutionModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-6 max-w-lg w-full"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Substituir Jogador</h2>
                <button onClick={() => setShowSubstitutionModal(false)} className="p-2 rounded-lg hover:bg-white/10">
                  <X className="h-5 w-5 text-white/60" />
                </button>
              </div>
              <p className="text-sm text-white/60 mb-4">
                Arraste jogadores entre o campo e os reservas para fazer substituicoes, ou selecione um jogador abaixo:
              </p>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {bench.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => {
                      // Swap selected player with this bench player
                      const selectedInField = players.find(p => p.id === selectedPlayerId)
                      if (selectedInField) {
                        setPlayers(prev => prev.map(p => p.id === selectedPlayerId ? player : p))
                        setBench(prev => prev.map(p => p.id === player.id ? selectedInField : p))
                        setShowSubstitutionModal(false)
                      }
                    }}
                    className="flex items-center gap-2 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-left"
                  >
                    <PlayerAvatarCircle name={player.name} fileKey={userTeam.file_key} teamColor={userTeam.cor1} size="xs" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white truncate">{player.name}</div>
                      <div className="text-[10px] text-white/40">{player.position}</div>
                    </div>
                    <span className={cn("text-sm font-bold", getOverallColor(player.overall))}>{player.overall}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Player Profile Modal */}
      <AnimatePresence>
        {showPlayerProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowPlayerProfile(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-6 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Perfil do Jogador</h2>
                <button onClick={() => setShowPlayerProfile(false)} className="p-2 rounded-lg hover:bg-white/10">
                  <X className="h-5 w-5 text-white/60" />
                </button>
              </div>
              <div className="flex items-center gap-4 mb-6">
                <PlayerAvatarCircle name={selectedPlayer.name} fileKey={userTeam.file_key} teamColor={userTeam.cor1} size="lg" />
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedPlayer.name}</h3>
                  <p className="text-sm text-white/50">{selectedPlayer.position} - {selectedPlayer.age} anos</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn("text-2xl font-black", getOverallColor(selectedPlayer.overall))}>{selectedPlayer.overall}</span>
                    <span className="text-xs text-white/40">OVR</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Ritmo", value: selectedPlayer.pace },
                  { label: "Finaliz.", value: selectedPlayer.shooting },
                  { label: "Passe", value: selectedPlayer.passing },
                  { label: "Drible", value: selectedPlayer.dribbling },
                  { label: "Defesa", value: selectedPlayer.defending },
                  { label: "Fisico", value: selectedPlayer.physical },
                ].map(stat => (
                  <div key={stat.label} className="p-3 rounded-lg bg-white/5 text-center">
                    <div className={cn("text-lg font-bold", getStatColor(stat.value))}>{stat.value}</div>
                    <div className="text-[10px] text-white/40">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Resumo da temporada: gols, assistências, cartões e jogos, do
                  seasonStats REAL do engine (era um dado que o jogo acumulava mas
                  nenhuma tela mostrava no perfil do atleta). */}
              {(() => {
                const st = engineSquadPlayers.find(p => p.name === selectedPlayer.name)?.seasonStats
                const linhas: { label: string; value: number; cor?: string }[] = [
                  { label: "Jogos", value: st?.matchesPlayed ?? 0 },
                  { label: "Gols", value: st?.goals ?? 0, cor: "text-[var(--brand)]" },
                  { label: "Assist.", value: st?.assists ?? 0, cor: "text-sky-300" },
                  { label: "Amarelos", value: st?.yellowCards ?? 0, cor: "text-yellow-400" },
                  { label: "Vermelhos", value: st?.redCards ?? 0, cor: "text-red-400" },
                  { label: selectedPlayer.position === "GOL" ? "S/ sofrer" : "Craque", value: (selectedPlayer.position === "GOL" ? st?.cleanSheets : st?.manOfTheMatch) ?? 0 },
                ]
                return (
                  <div className="mt-4">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">Temporada</div>
                    <div className="grid grid-cols-3 gap-2">
                      {linhas.map(l => (
                        <div key={l.label} className="rounded-lg bg-white/[0.03] p-2.5 text-center">
                          <div className={cn("text-lg font-black tabular-nums", l.cor ?? "text-white")}>{l.value}</div>
                          <div className="text-[9px] uppercase text-white/35">{l.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* CONTRATO: tempo de vínculo do atleta (pedido). O contrato vive no
                  motor (endDate em semana ABSOLUTA); aqui derivamos o ano de
                  término e o tempo restante em anos/meses. */}
              {(() => {
                const eng = engineSquadPlayers.find(p => p.name === selectedPlayer.name)
                const c = eng?.contract
                const st = situacaoContrato.get(selectedPlayer.name)
                const weeksLeft = c ? c.endDate - absoluteWeek(engineSeason, engineCurrentWeek) : 0
                const endYear = c ? CONTRACT_EPOCH_SEASON + Math.floor(c.endDate / 52) : null
                const tempo = !c ? "Sem contrato"
                  : weeksLeft <= 0 ? "Contrato vencido"
                  : weeksLeft >= 52 ? `${Math.round(weeksLeft / 52)} ano${Math.round(weeksLeft / 52) === 1 ? "" : "s"} restante${Math.round(weeksLeft / 52) === 1 ? "" : "s"}`
                  : `${Math.max(1, Math.round(weeksLeft / 4.33))} meses restantes`
                const tone = st === "expired" ? "text-red-300" : st === "expiring" ? "text-amber-300" : "text-[var(--brand)]"
                return (
                  <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      <Clock className="h-3 w-3" /> Contrato
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/55">Vínculo até</span>
                      <span className={cn("font-bold", st === "expired" ? "text-red-300" : "text-white")}>{endYear ? `dez/${endYear}` : "—"}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-sm">
                      <span className="text-white/55">Tempo de contrato</span>
                      <span className={cn("font-semibold", tone)}>{tempo}</span>
                    </div>
                    {c && (
                      <div className="mt-1 flex items-center justify-between text-sm">
                        <span className="text-white/55">Salário</span>
                        <span className="font-semibold text-white tabular-nums">R$ {(c.salary * 4).toLocaleString("pt-BR")}/mês</span>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* APOSENTAR — só para atleta que é SEU.
                  Aposentar um emprestado encerrava a carreira de um jogador cujo
                  passe pertence a outro clube (e ainda gerava um "sucessor" na
                  SUA base a partir dele). É o mesmo princípio que já barra vender
                  e anunciar quem chegou por empréstimo. */}
              {selectedPlayer.age >= 32 && !emprestimoDoSelecionado && (
                <button
                  onClick={async () => {
                    const enginePlayer = engineSquadPlayers.find(p => p.name === selectedPlayer.name)
                    if (!enginePlayer) return
                    const confirmado = await confirmarNoJogo({
                      titulo: `Aposentar ${selectedPlayer.name} aos ${selectedPlayer.age} anos?`,
                      mensagem:
                        "O atleta deixa imediatamente o elenco e a folha salarial. " +
                        "Um jovem com o mesmo nome e posição entrará na categoria de base, " +
                        "mas overall e potencial podem ser parecidos ou completamente diferentes.",
                      tom: "alerta",
                      confirmar: "Aposentar",
                    })
                    if (!confirmado) return
                    const successor = generateRetirementSuccessor({
                      name: enginePlayer.name,
                      position: enginePlayer.position,
                      overall: enginePlayer.overall,
                      potential: enginePlayer.potential,
                      season: state.season,
                      nonce: `${engineCurrentWeek}:${enginePlayer.id}`,
                    })
                    if (!engineRetirePlayer(enginePlayer.id)) return
                    setState(current => ({
                      youthPlayers: [...(current.youthPlayers ?? []), successor],
                    }))
                    setPlayers(current => current.filter(player => player.name !== enginePlayer.name))
                    setBench(current => current.filter(player => player.name !== enginePlayer.name))
                    setShowPlayerProfile(false)
                    addNotification({
                      type: "system",
                      priority: "medium",
                      title: `${enginePlayer.name} encerrou a carreira`,
                      message: `${successor.name}, ${successor.position}, ${successor.age} anos, entrou na categoria de base como legado do veterano.`,
                    })
                  }}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-violet-400/40 bg-violet-400/10 py-2.5 text-xs font-bold text-violet-200 transition-all hover:bg-violet-400/20"
                >
                  <Clock className="h-4 w-4" />
                  Aposentar e gerar sucessor na base
                </button>
              )}

              {/* ATLETA EMPRESTADO: o passe não é seu.
                  Vender ou anunciar quem chegou por empréstimo era uma brecha
                  real (pegar craque emprestado e revender no mesmo mercado).
                  Aqui ele ganha as DUAS ações que fazem sentido — devolver
                  agora, ou sentar com o dono para renovar. Ver lib/emprestimos.ts. */}
              {emprestimoDoSelecionado ? (
                <div className="mt-4 space-y-2 rounded-lg border border-sky-400/30 bg-sky-400/[0.06] p-3">
                  <p className="text-[11px] leading-4 text-sky-100/80">
                    <span className="font-bold">Atleta emprestado.</span> O passe pertence ao clube de
                    origem — ele não pode ser vendido nem anunciado. O vínculo vai até a semana{" "}
                    {emprestimoDoSelecionado.loanEndWeek ?? "—"}.
                  </p>
                  <button
                    onClick={() => setRenovacaoAberta(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-sky-400/50 bg-sky-400/10 py-2.5 text-xs font-bold text-sky-200 transition-all hover:bg-sky-400/20"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    Negociar renovação do empréstimo
                  </button>
                  <button
                    onClick={async () => {
                      const confirmado = await confirmarNoJogo({
                        titulo: `Devolver ${selectedPlayer.name} ao clube de origem agora?`,
                        mensagem: "Ele sai do elenco imediatamente e o empréstimo é encerrado.",
                        tom: "alerta",
                        confirmar: "Devolver",
                      })
                      if (!confirmado) return
                      if (engineDevolverEmprestimo(selectedPlayer.id)) {
                        addNotification({
                          type: "transfer", priority: "medium",
                          title: `${selectedPlayer.name} voltou ao clube de origem`,
                          message: "O empréstimo foi encerrado antes do prazo.",
                        })
                      }
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 py-2.5 text-xs font-bold text-white/70 transition-all hover:border-red-400/40 hover:text-red-300"
                  >
                    Devolver ao clube de origem
                  </button>
                </div>
              ) : (
              <>
              {/* Lista de transferíveis: anuncia o atleta ao mercado. Antes não
                  havia como colocar ninguém à venda — só dava para reagir a
                  sondagens que a IA fizesse por conta própria. */}
              <button
                onClick={() => engineToggleTransferListed(selectedPlayer.id)}
                className={cn(
                  "mt-4 flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-bold transition-all",
                  transferListedIds.includes(selectedPlayer.id)
                    ? "border-amber-400/50 bg-amber-400/10 text-amber-300"
                    : "border-white/15 text-white/70 hover:border-white/30 hover:text-white",
                )}
              >
                <ArrowLeftRight className="h-4 w-4" />
                {transferListedIds.includes(selectedPlayer.id)
                  ? "Anunciado no mercado — remover da lista"
                  : "Colocar na lista de transferíveis"}
              </button>
              {transferListedIds.includes(selectedPlayer.id) && (
                <p className="mt-2 text-center text-[10px] leading-4 text-white/40">
                  Clubes interessados passam a sondar este atleta com muito mais frequência.
                </p>
              )}

              {/* VENDER AGORA: sondagem imediata da IA. Aceitando, o atleta SAI do
                  elenco na hora e o valor entra no caixa (engine.sellPlayer, que
                  persiste no save). Antes o perfil so "listava" — o relato "diz que
                  vendeu mas o jogador nao sai" era justamente isso: nao havia venda. */}
              <button
                onClick={async () => {
                  const eng = engineSquadPlayers.find(p => p.id === selectedPlayer.id)
                  const valor = eng?.marketValue ?? 0

                  // JANELA. Vender fora da janela era possivel e instantaneo — a
                  // base ja respeitava a janela e o elenco nao. Era por essa
                  // porta que o garoto promovido virava dinheiro em qualquer
                  // semana do ano.
                  if (!isTransferWindowOpen(semanaDaTemporada)) {
                    await avisarNoJogo({
                      titulo: "A janela de transferências está fechada",
                      mensagem: `${selectedPlayer.name} só pode ser negociado quando ela reabrir.`,
                      tom: "alerta",
                    })
                    return
                  }

                  // INTERESSE. Nem todo atleta tem comprador esperando. Mesma
                  // ideia da venda de jovem: quanto mais valioso, mais fácil
                  // achar quem pague. Sem isto a venda era certa, e vender virava
                  // um botao de sacar dinheiro do elenco a qualquer momento.
                  const interesse = Math.max(0.15, Math.min(0.9, (valor - 300_000) / 8_000_000))
                  if (Math.random() > interesse) {
                    await avisarNoJogo({
                      titulo: `Ninguém fez proposta por ${selectedPlayer.name}`,
                      mensagem: "Coloque-o na lista de transferíveis para atrair sondagens e tente de novo mais adiante.",
                    })
                    return
                  }

                  // NEGOCIACAO. A proposta sai entre 65% e 115% do valor de
                  // mercado, como na venda de jovem — antes pagava-se sempre o
                  // valor cheio, o que tornava vender melhor do que qualquer
                  // outra forma de levantar caixa.
                  const oferta = Math.round((valor * (0.65 + Math.random() * 0.5)) / 10_000) * 10_000
                  const clube = ["Benfica", "Ajax", "Porto", "Palmeiras", "Flamengo", "Sevilla", "Wolves"][Math.floor(Math.random() * 7)]
                  const abaixo = oferta < valor * 0.9
                  const confirmado = await confirmarNoJogo({
                    titulo: `${clube} oferece R$ ${oferta.toLocaleString("pt-BR")} por ${selectedPlayer.name}`,
                    mensagem:
                      `Valor de mercado: R$ ${valor.toLocaleString("pt-BR")}` +
                      (abaixo ? "\n\nA proposta está ABAIXO do valor do atleta." : "") +
                      "\n\nConfirmar a venda? O atleta sai do elenco e o valor entra no caixa.",
                    tom: abaixo ? "perigo" : "alerta",
                    confirmar: "Vender",
                  })
                  if (!confirmado) return
                  engineSellPlayer(selectedPlayer.id, oferta)
                  setShowPlayerProfile(false)
                }}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 py-2.5 text-xs font-bold text-red-300 transition-all hover:bg-red-500/20"
              >
                <ArrowLeftRight className="h-4 w-4" />
                Vender agora
              </button>

              {/* Posição, função, renovação e empréstimo — o modal do
                  gerenciamento agora concentra as decisões sobre o atleta
                  (pedido: duplo-clique abre tudo, inclusive para reservas). */}
              {(() => {
                const enginePlayer = engineSquadPlayers.find(p => p.name === selectedPlayer.name)
                if (!enginePlayer) return null
                const posFamily = normalizePosition(enginePlayer.position)
                const roleAtual = enginePlayerInstructions?.[enginePlayer.id]?.role
                  ?? defaultRoleForPosition(posFamily)
                // Funções compatíveis com a posição atual (falso 9, segundo
                // atacante, centroavante para ATA; regista, box-to-box... etc.).
                const rolesCompat = (Object.keys(PLAYER_ROLE_INFO) as PlayerRole[])
                  .filter(r => PLAYER_ROLE_INFO[r].positions.includes(posFamily))
                return (
                  <div className="mt-4 space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[10px] uppercase tracking-wide text-white/40">
                        Posição
                        <select
                          value={posFamily}
                          onChange={e => engineSetPlayerPosition(enginePlayer.id, e.target.value)}
                          className="mt-1 w-full rounded bg-black/40 px-2 py-1.5 text-xs text-white"
                        >
                          {["GOL", "ZAG", "LD", "LE", "VOL", "MEI", "PD", "PE", "ATA"].map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[10px] uppercase tracking-wide text-white/40">
                        Função
                        <select
                          value={roleAtual}
                          onChange={e => engineSetPlayerInstructions(enginePlayer.id, { role: e.target.value as PlayerRole })}
                          className="mt-1 w-full rounded bg-black/40 px-2 py-1.5 text-xs text-white"
                        >
                          {rolesCompat.map(r => (
                            <option key={r} value={r}>{PLAYER_ROLE_INFO[r].name}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {/* Abre a NEGOCIACAO. Antes este botao renovava direto por
                          salario x1,12 e 3 anos, sem ninguem do outro lado. */}
                      <button
                        onClick={() => setNegociacao("renovar")}
                        className="rounded-lg border border-[var(--brand)]/30 py-2 text-xs font-bold text-[var(--brand)] hover:bg-[var(--brand)]/10"
                      >
                        Renovar contrato
                      </button>
                      <button
                        onClick={() => engineToggleLoanListed(enginePlayer.id)}
                        className={cn(
                          "rounded-lg border py-2 text-xs font-bold transition-all",
                          loanListedIds?.includes(enginePlayer.id)
                            ? "border-sky-400/50 bg-sky-400/10 text-sky-300"
                            : "border-white/15 text-white/70 hover:border-white/30",
                        )}
                      >
                        {loanListedIds?.includes(enginePlayer.id) ? "Retirar do empréstimo" : "Emprestar"}
                      </button>
                    </div>
                  </div>
                )
              })()}
              </>
              )}

              {/* Rescisão: não havia como dispensar ninguém. Um atleta caro que o
                  mercado não quisesse ficava travado no elenco consumindo folha
                  até o contrato vencer sozinho. */}
              {(() => {
                // O elenco da tela e o do engine sao tipos diferentes (contrato só
                // existe no engine) e os IDs divergem para atletas importados — a
                // ponte é pelo nome, como no resto da página.
                const enginePlayer = engineSquadPlayers.find(p => p.name === selectedPlayer.name)
                if (!enginePlayer) return null
                const cost = terminationCost(enginePlayer, engineCurrentWeek)
                const affordable = engineBalance >= cost
                return (
                  <>
                    <button
                      onClick={() => setNegociacao("rescindir")}
                      disabled={!affordable}
                      className={cn(
                        "mt-2 flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-bold transition-all",
                        affordable
                          ? "border-red-400/40 text-red-300 hover:bg-red-400/10"
                          : "cursor-not-allowed border-white/10 text-white/25",
                      )}
                    >
                      <X className="h-4 w-4" />
                      Negociar rescisao — ate {formatCurrency(cost)}
                    </button>
                    {!affordable && (
                      <p className="mt-2 text-center text-[10px] text-red-300/70">
                        Caixa insuficiente para pagar a multa.
                      </p>
                    )}
                  </>
                )
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Tutorials Modal */}
      <AnimatePresence>
        {/* Destaques: artilheiros/assistências/cartões do ELENCO (seasonStats
            real) e do CAMPEONATO (agregado dos eventos de todas as partidas). */}
        {showLeaderboards && (() => {
          const elencoOrd = (campo: "goals" | "assists" | "yellowCards" | "redCards") =>
            [...engineSquadPlayers]
              .map(p => ({ nome: p.name, valor: p.seasonStats?.[campo] ?? 0 }))
              .filter(p => p.valor > 0)
              .sort((a, b) => b.valor - a.valor)
              .slice(0, 8)
          const campArtilheiros = artilheiros(engineMatchResults, engineSeason, 10)
          const campCartoes = cartoes(engineMatchResults, engineSeason, 10)

          const Bloco = ({ titulo, linhas, sufixo }: { titulo: string; linhas: { nome: string; valor: number }[]; sufixo: string }) => (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">{titulo}</div>
              {linhas.length === 0 ? (
                <div className="py-3 text-center text-[11px] text-white/25">Sem dados ainda — jogue algumas partidas.</div>
              ) : (
                <ol className="space-y-1">
                  {linhas.map((l, i) => (
                    <li key={l.nome + i} className="flex items-center gap-2 text-xs">
                      <span className="w-4 text-right text-white/30 tabular-nums">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-white/80">{l.nome}</span>
                      <span className="font-bold tabular-nums text-white">{l.valor}</span>
                      <span className="text-[9px] text-white/30">{sufixo}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setShowLeaderboards(false)}>
              <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#141414] p-5 scrollbar-game" onClick={e => e.stopPropagation()}>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-white"><Trophy className="h-5 w-5 text-yellow-400" /> Destaques da temporada</h2>
                  <button onClick={() => setShowLeaderboards(false)} className="rounded-lg p-2 hover:bg-white/10"><X className="h-5 w-5 text-white/60" /></button>
                </div>

                <div className="mb-2 text-xs font-semibold text-[var(--brand)]">Seu elenco</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Bloco titulo="Artilheiros" linhas={elencoOrd("goals")} sufixo="gols" />
                  <Bloco titulo="Assistências" linhas={elencoOrd("assists")} sufixo="assist" />
                  <Bloco titulo="Mais amarelos" linhas={elencoOrd("yellowCards")} sufixo="CA" />
                  <Bloco titulo="Mais vermelhos" linhas={elencoOrd("redCards")} sufixo="CV" />
                </div>

                <div className="mb-2 mt-5 text-xs font-semibold text-[var(--brand)]">Campeonato</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Bloco titulo="Artilharia" linhas={campArtilheiros} sufixo="gols" />
                  <Bloco titulo="Cartões" linhas={campCartoes.map(c => ({ nome: c.nome, valor: c.valor }))} sufixo="pts" />
                </div>
                <p className="mt-3 text-center text-[10px] leading-4 text-white/30">
                  O campeonato conta os gols de todas as partidas já disputadas nesta temporada.
                </p>
              </div>
            </div>
          )
        })()}

        {/* Negociacao de contrato: renovar e rescindir passam por rodadas de
            proposta e contraproposta, em vez de executar direto. */}
        {negociacao && selectedPlayer && (() => {
          const ep = engineSquadPlayers.find(p => p.name === selectedPlayer.name)
          if (!ep) return null
          const semanasRestantes = Math.max(0, (ep.contract?.endDate ?? engineCurrentWeek) - engineCurrentWeek)
          // O engine guarda moral como rotulo; o motor de negociacao usa 0-100.
          const moralNum = { Feliz: 90, Motivado: 80, Normal: 65, Insatisfeito: 40, Infeliz: 25 }[ep.morale] ?? 65
          return (
            <ContractNegotiationModal
              open
              modo={negociacao}
              clubPrestige={userTeam.prestigio ?? 60}
              clubBalance={engineBalance}
              player={{
                name: selectedPlayer.name,
                overall: selectedPlayer.overall,
                age: selectedPlayer.age,
                salary: ep.contract?.salary ?? 40000,
                // O engine nao guarda valor de mercado; derivamos como o mercado
                // faz (overall^3 ancorado), suficiente para ancorar o pedido.
                marketValue: Math.round(Math.pow(selectedPlayer.overall / 60, 3) * 5_000_000),
                weeksLeft: semanasRestantes,
                morale: moralNum,
              }}
              onClose={() => setNegociacao(null)}
              onRenew={terms => {
                engineRenewContract(ep.id, terms.salary, terms.contractYears * 52)
                addNotification({ type: "system", priority: "low", title: "Contrato renovado",
                  message: `${selectedPlayer.name} renovou por ${terms.contractYears} ano(s) a ${formatCurrency(terms.salary)}/mes.` })
                setNegociacao(null)
              }}
              onRescind={valor => {
                if (engineTerminateContract(ep.id)) {
                  addNotification({ type: "system", priority: "medium", title: "Contrato rescindido",
                    message: `${selectedPlayer.name} deixou o clube. Acordo: ${formatCurrency(valor)}.` })
                  setNegociacao(null)
                  setShowPlayerProfile(false)
                }
              }}
            />
          )
        })()}

        {/* Mesa de renovação do empréstimo. Ver lib/emprestimos.ts: o clube dono
            avalia quanto o atleta JOGOU — quem deixou o garoto no banco paga
            mais caro, e às vezes não renova de jeito nenhum. */}
        {renovacaoAberta && emprestimoDoSelecionado && (
          <RenovacaoEmprestimoModal
            aberto
            onFechar={() => setRenovacaoAberta(false)}
            nome={emprestimoDoSelecionado.name}
            clubeDono={emprestimoDoSelecionado.parentClub ?? "clube de origem"}
            contexto={{
              overall: emprestimoDoSelecionado.overall,
              idade: emprestimoDoSelecionado.age,
              salarioSemanal: emprestimoDoSelecionado.contract?.salary ?? 40_000,
              jogos: emprestimoDoSelecionado.seasonStats?.matchesPlayed ?? 0,
              semanasNoClube: Math.max(1, engineCurrentWeek - (emprestimoDoSelecionado.joinedClubWeek ?? 0)),
              prestigioDono: userTeam.prestigio ?? 60,
            }}
            onAcordo={termos => {
              engineRenovarEmprestimo(emprestimoDoSelecionado.id, termos.semanas)
              addNotification({
                type: "transfer", priority: "medium",
                title: `Empréstimo de ${emprestimoDoSelecionado.name} renovado`,
                message: `Mais ${termos.semanas} semanas, com ${formatCurrency(termos.taxa)} de taxa.`,
              })
              setRenovacaoAberta(false)
            }}
          />
        )}

        {showTutorials && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowTutorials(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-6 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">{t.squad.tutorials}</h2>
                <button onClick={() => setShowTutorials(false)} className="p-2 rounded-lg hover:bg-white/10">
                  <X className="h-5 w-5 text-white/60" />
                </button>
              </div>
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-white/5">
                  <h3 className="text-sm font-medium text-white mb-1">Arrastar jogadores</h3>
                  <p className="text-xs text-white/50">Arraste jogadores no campo para reposiciona-los ou troca-los com reservas.</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5">
                  <h3 className="text-sm font-medium text-white mb-1">Trocar formacao</h3>
                  <p className="text-xs text-white/50">Escolha a formacao no menu suspenso (ou use as setas ao lado) para alterar entre os esquemas taticos.</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5">
                  <h3 className="text-sm font-medium text-white mb-1">Ver detalhes</h3>
                  <p className="text-xs text-white/50">Clique em um jogador para ver seus atributos no painel lateral.</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Suggested Substitutions Modal */}
      <AnimatePresence>
        {showSuggestedSubs && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowSuggestedSubs(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-6 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Substituicoes Sugeridas</h2>
                <button onClick={() => setShowSuggestedSubs(false)} className="p-2 rounded-lg hover:bg-white/10">
                  <X className="h-5 w-5 text-white/60" />
                </button>
              </div>
              <div className="space-y-3">
                {players.filter(p => p.energy < 80).slice(0, 3).map(tiredPlayer => {
                  const replacement = bench.find(b => b.position === tiredPlayer.position) || bench[0]
                  return (
                    <button
                      key={tiredPlayer.id}
                      onClick={() => {
                        setPlayers(prev => prev.map(p => p.id === tiredPlayer.id ? replacement : p))
                        setBench(prev => prev.map(p => p.id === replacement.id ? tiredPlayer : p))
                        setShowSuggestedSubs(false)
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <PlayerAvatarCircle name={tiredPlayer.name} fileKey={userTeam.file_key} teamColor={userTeam.cor1} size="xs" />
                        <div className="text-left">
                          <div className="text-xs text-white">{tiredPlayer.name}</div>
                          <div className="text-[10px] text-red-400">{tiredPlayer.energy}% energia</div>
                        </div>
                      </div>
                      <ArrowLeftRight className="h-4 w-4 text-white/40" />
                      <div className="flex items-center gap-2">
                        <PlayerAvatarCircle name={replacement.name} fileKey={userTeam.file_key} teamColor={userTeam.cor1} size="xs" />
                        <div className="text-left">
                          <div className="text-xs text-white">{replacement.name}</div>
                          <div className="text-[10px] text-green-400">{replacement.energy}% energia</div>
                        </div>
                      </div>
                    </button>
                  )
                })}
                {players.filter(p => p.energy < 80).length === 0 && (
                  <p className="text-sm text-white/50 text-center py-4">
                    Nenhuma substituicao sugerida no momento. Todos os jogadores estao com energia adequada.
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

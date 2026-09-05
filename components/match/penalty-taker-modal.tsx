"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { TeamCrest } from "@/components/team-crest"
import type { Team } from "@/lib/teams-data"
import type { PenaltyOutcome } from "@/lib/match-engine"
import { Button } from "@/components/ui/button"
import { Target, Zap, Star } from "lucide-react"

interface Player {
  id: number
  name: string
  number: number
  position: string
  rating?: number
  shooting?: number
  stamina?: number
}

interface PenaltyTakerModalProps {
  isOpen: boolean
  team: Team
  players: Player[]
  /** Cobra o penalti e DEVOLVE o desfecho, para a narracao saber o que dizer. */
  onSelectPlayer: (player: Player) => PenaltyOutcome | null
  /** Chamado quando a narracao termina e a partida pode seguir. */
  onFinish: () => void
  onClose: () => void
}

// Preparacoes possiveis — sorteadas para a cobranca nunca soar igual.
/** Segundos para o tecnico escolher o batedor antes de o auxiliar assumir. */
const TEMPO_PARA_ESCOLHER = 10

const BUILDUPS = [
  "Ajeita a bola no ponto. Respira fundo.",
  "Foi na paradinha...",
  "Toma distancia. O estadio silencia.",
  "Encara o goleiro. Nao pisca.",
  "Limpa a chuteira na meia. Frieza total.",
]

export function PenaltyTakerModal({
  isOpen,
  team,
  players,
  onSelectPlayer,
  onFinish,
  onClose,
}: PenaltyTakerModalProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [hoveredPlayer, setHoveredPlayer] = useState<Player | null>(null)

  // Narracao da cobranca, no espirito do Brasfoot: as falas entram uma a uma.
  const [narration, setNarration] = useState<string[] | null>(null)
  const [narrationStep, setNarrationStep] = useState(0)
  const [outcome, setOutcome] = useState<PenaltyOutcome | null>(null)

  // Ordena por HABILIDADE DE PENALTI: finalizacao + um peso por posicao. Sem o peso,
  // um zagueiro com finalizacao inflada liderava a lista; batedores de verdade sao
  // atacantes e meias, entao eles sobem e o "Recomendado" cai sobre quem faz sentido.
  const POS_PENALTY_BIAS: Record<string, number> = {
    ATA: 14, CA: 14, SA: 12, PE: 10, PD: 10, MEI: 9, MC: 8, MO: 9,
    ME: 6, MD: 6, VOL: 3, LD: -4, LE: -4, ALD: -3, ALE: -3, ZAG: -8, GOL: -40,
  }
  const penaltyScore = (p: Player) => (p.shooting || 70) + (POS_PENALTY_BIAS[p.position] ?? 0)
  const sortedPlayers = [...players].sort((a, b) => penaltyScore(b) - penaltyScore(a))

  /**
   * TEMPO PARA DECIDIR.
   *
   * Sem relógio, a partida ficava parada indefinidamente esperando o técnico
   * escolher — e um pênalti, que é o lance mais tenso do jogo, virava uma pausa
   * confortável para comparar finalização de onze atletas. O contador devolve a
   * pressão do momento.
   *
   * Esgotado o prazo, o AUXILIAR bate: `onSelectPlayer(null)` deixa o motor
   * escolher, que é o mesmo caminho de quem fecha o modal. Nunca trava.
   */
  const [segundos, setSegundos] = useState(TEMPO_PARA_ESCOLHER)
  useEffect(() => {
    // Enquanto narra, o relógio não corre: a decisão já foi tomada.
    if (!isOpen || narration) return
    if (segundos <= 0) return
    const t = setTimeout(() => setSegundos(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [isOpen, narration, segundos])

  // Reinicia a cada abertura — sem isto o segundo pênalti da partida já nasceria
  // com o relógio zerado e bateria sozinho.
  useEffect(() => {
    if (isOpen) setSegundos(TEMPO_PARA_ESCOLHER)
  }, [isOpen])

  const baterRef = useRef<(jogador: Player | null) => void>(() => {})
  useEffect(() => {
    if (!isOpen || narration || segundos > 0) return
    // Escolha do usuário vale mesmo no estouro: se ele já clicou num nome e só
    // não confirmou, respeitamos a escolha em vez de sortear por cima dela.
    baterRef.current(selectedPlayer)
  }, [isOpen, narration, segundos, selectedPlayer])

  /** Cobra com o atleta escolhido; `null` = deixa o motor decidir. */
  const bater = (jogador: Player | null) => {
    // Cobra AGORA: o desfecho ja existe, a narracao apenas o revela aos poucos.
    const res = jogador ? onSelectPlayer(jogador) : onSelectPlayer(sortedPlayers[0])
    if (!res) {
      onFinish()
      return
    }

    const buildup = BUILDUPS[Math.floor(Math.random() * BUILDUPS.length)]
    const finale =
      res.kind === "gol"
        ? `GOOOOOL! ${res.takerName} nao perdoa!`
        : res.kind === "defesa"
          ? `DEFENDEU! ${res.gkName} voou e espalmou!`
          : `PRA FORA! ${res.takerName} isolou a cobranca!`

    setOutcome(res)
    setNarration([
      `La vai ${res.takerName}...`,
      buildup,
      "Chutou... eeeeeee...",
      finale,
    ])
    setNarrationStep(0)
  }
  // O efeito do estouro precisa chamar `bater` sem entrar nas deps dele — a
  // função é recriada a cada render e reiniciaria o relógio a cada quadro.
  baterRef.current = bater

  const handleConfirm = () => {
    if (!selectedPlayer) return
    bater(selectedPlayer)
  }

  // onFinish num REF — sem isto o modal TRAVA a partida inteira.
  //
  // BUG que isto corrige ("quando abre essa tela nao sai ate acabar o 1o/2o tempo"):
  // o efeito abaixo dependia de `onFinish`, que o pai (a tela da partida) recria a cada
  // render. Como a tela re-renderiza o tempo todo, o efeito refazia o cleanup e
  // REINICIAVA o setTimeout de 1600ms a cada render — o timer nunca chegava ao fim e o
  // onFinish() NUNCA era chamado. A narracao terminava ("GOOOOOL!") e o modal ficava
  // preso para sempre. Como a partida nao concluia, nao gerava resultado, o fixture nao
  // era marcado como jogado e o MESMO jogo se repetia ("6 partidas contra o City").
  const onFinishRef = useRef(onFinish)
  useEffect(() => { onFinishRef.current = onFinish }, [onFinish])

  // Revela uma fala por vez; a ultima (o desfecho) demora mais.
  useEffect(() => {
    if (!narration) return
    if (narrationStep >= narration.length) {
      const t = setTimeout(() => {
        setNarration(null)
        setOutcome(null)
        setSelectedPlayer(null)
        onFinishRef.current()
      }, 1600)
      return () => clearTimeout(t)
    }
    const isFinale = narrationStep === narration.length - 1
    const t = setTimeout(() => setNarrationStep((s) => s + 1), isFinale ? 1200 : 1100)
    return () => clearTimeout(t)
    // onFinish NAO entra nas deps de proposito — ver o ref acima.
  }, [narration, narrationStep])

  // Calcula a probabilidade de gol baseado nos atributos
  const getScoreChance = (player: Player) => {
    const shooting = player.shooting || 70
    const stamina = player.stamina || 80
    const baseChance = 50 + (shooting - 50) * 0.5 + (stamina / 100) * 10
    return Math.min(95, Math.max(40, Math.round(baseChance)))
  }

  // Cor baseada na chance de gol
  const getChanceColor = (chance: number) => {
    if (chance >= 80) return "text-emerald-400"
    if (chance >= 65) return "text-amber-400"
    return "text-red-400"
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md"
      >
        {/* Fundo animado */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            animate={{ 
              background: [
                `radial-gradient(circle at 30% 50%, ${team.cor1}20, transparent 50%)`,
                `radial-gradient(circle at 70% 50%, ${team.cor1}20, transparent 50%)`,
                `radial-gradient(circle at 30% 50%, ${team.cor1}20, transparent 50%)`
              ]
            }}
            transition={{ duration: 4, repeat: Infinity }}
            className="absolute inset-0"
          />
        </div>

        <motion.div
          initial={{ scale: 0.9, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 50 }}
          className="relative w-full max-w-2xl mx-4"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#1a2a2a] to-[#0d1a1a] rounded-t-2xl border border-white/10 border-b-0 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <Target className="w-10 h-10 text-amber-400" />
                </motion.div>
                <div>
                  <h2 className="uf-heading text-2xl font-bold text-white">PENALTI!</h2>
                  <p className="text-white/60 text-sm">
                    {narration ? "A bola está no ponto" : "Escolha o batedor"}
                  </p>
                </div>
                {/* CONTADOR — vermelho e pulsando nos últimos 3 segundos, porque
                    é aí que a decisão importa. Some durante a narração: o lance
                    já foi cobrado e um relógio correndo ali só confundiria. */}
                {!narration && (
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-lg font-black tabular-nums transition-colors",
                      segundos <= 3
                        ? "animate-pulse border-red-500 bg-red-500/15 text-red-400"
                        : "border-white/20 bg-white/[0.06] text-white/80",
                    )}
                    aria-label={`${segundos} segundos para escolher`}
                  >
                    {segundos}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <TeamCrest team={team} size="lg" />
                <span className="text-white font-semibold">{team.nome}</span>
              </div>
            </div>
          </div>

          {/* NARRACAO DA COBRANCA — substitui a lista assim que o batedor e confirmado.
              O desfecho ja foi decidido pelo motor; aqui ele e revelado fala a fala. */}
          {narration ? (
            <div className="bg-[#0d1a1a]/95 backdrop-blur-sm border border-white/10 border-t-0 rounded-b-2xl p-8 min-h-[240px] flex flex-col items-center justify-center gap-4">
              {narration.slice(0, narrationStep + 1).map((line, i) => {
                const isFinale = i === narration.length - 1
                return (
                  <motion.p
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "text-center",
                      isFinale
                        ? cn(
                            "text-3xl font-black tracking-tight",
                            outcome?.kind === "gol" && "text-emerald-400",
                            outcome?.kind === "defesa" && "text-amber-400",
                            outcome?.kind === "fora" && "text-red-400",
                          )
                        : "text-lg text-white/70",
                    )}
                  >
                    {line}
                  </motion.p>
                )
              })}
            </div>
          ) : (
          <>
          {/* Lista de jogadores */}
          <div className="bg-[#0d1a1a]/95 backdrop-blur-sm border border-white/10 border-t-0 max-h-[50vh] overflow-y-auto">
            <div className="p-2">
              {sortedPlayers.map((player, index) => {
                const chance = getScoreChance(player)
                const isSelected = selectedPlayer?.id === player.id
                const isHovered = hoveredPlayer?.id === player.id
                const isRecommended = index === 0

                return (
                  <motion.button
                    key={player.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => setSelectedPlayer(player)}
                    onMouseEnter={() => setHoveredPlayer(player)}
                    onMouseLeave={() => setHoveredPlayer(null)}
                    className={cn(
                      "w-full flex items-center gap-4 p-3 rounded-xl transition-all",
                      isSelected 
                        ? "bg-[var(--brand)]/20 border-2 border-[var(--brand)]" 
                        : isHovered
                          ? "bg-white/10"
                          : "bg-white/5 border-2 border-transparent",
                      "hover:bg-white/10"
                    )}
                  >
                    {/* Numero */}
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg",
                      isSelected ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "bg-white/10 text-white"
                    )}>
                      {player.number}
                    </div>

                    {/* Nome e posicao */}
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold">{player.name}</span>
                        {isRecommended && (
                          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded uppercase">
                            Recomendado
                          </span>
                        )}
                      </div>
                      <span className="text-white/40 text-sm">{player.position}</span>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4">
                      {/* Finalizacao */}
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-white/40 text-[10px] uppercase">
                          <Zap className="w-3 h-3" />
                          <span>FIN</span>
                        </div>
                        <span className="text-white font-bold">{player.shooting || 70}</span>
                      </div>

                      {/* Chance de gol */}
                      <div className="text-center min-w-[60px]">
                        <div className="text-white/40 text-[10px] uppercase">Chance</div>
                        <span className={cn("font-bold text-lg", getChanceColor(chance))}>
                          {chance}%
                        </span>
                      </div>

                      {/* Indicador de selecao */}
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-6 h-6 rounded-full bg-[var(--brand)] flex items-center justify-center"
                        >
                          <Star className="w-4 h-4 text-black fill-black" />
                        </motion.div>
                      )}
                    </div>
                  </motion.button>
                )
              })}
            </div>
          </div>

          {/* Footer com botao de confirmar */}
          <div className="bg-gradient-to-r from-[#1a2a2a] to-[#0d1a1a] rounded-b-2xl border border-white/10 border-t-0 p-4">
            <div className="flex items-center justify-between">
              <div className="text-white/40 text-sm">
                {selectedPlayer ? (
                  <span>
                    Batedor: <span className="text-white font-semibold">{selectedPlayer.name}</span>
                  </span>
                ) : (
                  "Selecione um jogador"
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="border-white/20 text-white/60 hover:bg-white/10"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={!selectedPlayer}
                  className={cn(
                    "font-bold transition-all",
                    selectedPlayer
                      ? "bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[#00e6b5]"
                      : "bg-white/10 text-white/40"
                  )}
                >
                  <Target className="w-4 h-4 mr-2" />
                  BATER PENALTI
                </Button>
              </div>
            </div>
          </div>
          </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

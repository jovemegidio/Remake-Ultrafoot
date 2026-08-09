"use client"

import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import {
  Dumbbell,
  Target,
  Zap,
  Shield,
  Heart,
  Brain,
  TrendingUp,
  Clock,
  Star,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Timer,
  Users,
  Eye,
  X,
  Award,
} from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { TeamCrest } from "@/components/team-crest"
import { Progress } from "@/components/ui/progress"
import { useRouter } from "next/navigation"
import { useUserTeam } from "@/lib/time-da-carreira"
import { useGameEngine, type Player, type TratamentoMedico } from "@/lib/game-engine"
import { MedicalModal } from "@/components/modals/medical-modal"
import { avisar as avisarNoJogo } from "@/lib/dialogo-do-jogo"
import { formatCurrency } from "@/lib/teams-data"
import {
  aplicarSemanaDeTreino, duplasDoGrupo, PISO_ENTROSAMENTO, PLANO_PADRAO,
  ROTULO_DO_FOCO, rotuloDaCarga,
  type FocoColetivo, type IntensidadeTreino,
} from "@/lib/treino-e-entrosamento"
import { montarRotina, ROTULO_DO_DIA } from "@/lib/rotina-da-semana"
import { useGameManager } from "@/lib/use-game-manager"
import { cn } from "@/lib/utils"

// Tipos de treinamento disponiveis
const trainingTypes = [
  { 
    id: "pace", 
    name: "Velocidade", 
    icon: Zap, 
    color: "text-yellow-400",
    bgColor: "bg-yellow-400/10",
    description: "Melhora sprint e aceleracao"
  },
  { 
    id: "shooting", 
    name: "Finalizacao", 
    icon: Target, 
    color: "text-red-400",
    bgColor: "bg-red-400/10",
    description: "Melhora chute e precisao"
  },
  { 
    id: "passing", 
    name: "Passe", 
    icon: TrendingUp, 
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
    description: "Melhora passes curtos e longos"
  },
  { 
    id: "dribbling", 
    name: "Dribles", 
    icon: Star, 
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
    description: "Melhora controle de bola"
  },
  { 
    id: "defending", 
    name: "Defesa", 
    icon: Shield, 
    color: "text-green-400",
    bgColor: "bg-green-400/10",
    description: "Melhora marcacao e desarme"
  },
  { 
    id: "physical", 
    name: "Fisico", 
    icon: Dumbbell, 
    color: "text-orange-400",
    bgColor: "bg-orange-400/10",
    description: "Melhora forca e resistencia"
  },
]

// Posicoes com seus atributos recomendados
const positionTrainingRecommendations: Record<string, string[]> = {
  "GOL": ["physical", "passing"],
  "LD": ["pace", "defending", "physical"],
  "LE": ["pace", "defending", "physical"],
  "ZAG": ["defending", "physical", "passing"],
  "VOL": ["defending", "passing", "physical"],
  "MEI": ["passing", "dribbling", "shooting"],
  "MC": ["passing", "physical", "shooting"],
  "PD": ["pace", "dribbling", "shooting"],
  "PE": ["pace", "dribbling", "shooting"],
  "ATA": ["shooting", "pace", "dribbling"],
  "SA": ["shooting", "dribbling", "passing"],
}

function getRecommendedTraining(position: string): string[] {
  return positionTrainingRecommendations[position] || ["physical", "passing"]
}

/** Objeto vazio ESTÁVEL — ver o comentário no fallback dos seletores do motor. */
const VAZIO: Record<number, number> = {}

const INTENSIDADES: { id: IntensidadeTreino; nome: string; nota: string }[] = [
  { id: "leve", nome: "Leve", nota: "Poupa o elenco. Evolui devagar." },
  { id: "media", nome: "Média", nota: "O equilíbrio entre render e descansar." },
  { id: "alta", nome: "Alta", nota: "Evolui mais rápido — e machuca mais." },
]

const FOCOS: { id: FocoColetivo; nota: string }[] = [
  { id: "entrosamento", nota: "O grupo joga junto. Constrói entrosamento de verdade." },
  { id: "fisico", nota: "Fôlego e força. A carga mais pesada da semana." },
  { id: "ofensivo", nota: "Trabalho de finalização com o time inteiro." },
  { id: "defensivo", nota: "Linha, marcação e cobertura." },
  { id: "bola_parada", nota: "Ensaio de escanteio, falta e pênalti." },
  { id: "recuperacao", nota: "Semana regenerativa. Repõe energia e queima fadiga." },
]

export default function TreinamentoPage() {
  const { team: userTeam } = useUserTeam()
  const { squadPlayers, trainPlayer, currentWeek, clubInfrastructure } = useGameEngine()
  // O calendario e quem diz quantos jogos ha na semana — nao um palpite da tela.
  const { seasonCalendar } = useGameManager()
  const planoDeTreino = useGameEngine(s => s.planoDeTreino) ?? PLANO_PADRAO
  const definirPlanoDeTreino = useGameEngine(s => s.definirPlanoDeTreino)
  const posturaDaSemana = useGameEngine(s => s.posturaDaSemana) ?? "equilibrado"
  const definirPosturaDaSemana = useGameEngine(s => s.definirPosturaDaSemana)
  /**
   * DEPARTAMENTO MEDICO. O modal existia pronto e sem nenhum importador; a porta
   * dele e o selo "Lesionado" da lista, que ja estava aqui.
   */
  const tratarLesao = useGameEngine(s => s.tratarLesao)
  // Guardar o ID, e nao o objeto: guardando o objeto, o modal continua exibindo
  // o prazo ANTIGO depois do tratamento, porque a copia nao acompanha o motor.
  const [idNoMedico, setIdNoMedico] = useState<number | null>(null)
  const atletaNoMedico = useMemo(
    () => squadPlayers.find(p => p.id === idNoMedico) ?? null,
    [squadPlayers, idNoMedico],
  )

  const aplicarTratamento = useCallback((playerId: number, tratamento: TratamentoMedico) => {
    const r = tratarLesao(playerId, tratamento)
    if (!r.ok) {
      avisarNoJogo({
        titulo: "Tratamento nao aplicado",
        tom: "alerta",
        mensagem: r.motivo === "sem-dinheiro"
          ? "O caixa do clube nao cobre esse tratamento."
          : r.motivo === "ja-tratado"
            ? "Esta lesao ja recebeu tratamento. Uma lesao, um tratamento."
            : "O atleta nao esta lesionado.",
      })
      return
    }
    const dif = r.semanasAntes - r.semanasDepois
    avisarNoJogo({
      titulo: "Departamento medico",
      mensagem: dif > 0
        ? `Prazo reduzido de ${r.semanasAntes} para ${r.semanasDepois} semanas.`
          + (r.custo > 0 ? ` Custo: ${formatCurrency(r.custo)}.` : "")
        : dif < 0
          ? `Cirurgia marcada. O prazo sobe para ${r.semanasDepois} semanas, mas a`
            + ` lesao se resolve de vez. Custo: ${formatCurrency(r.custo)}.`
          : `Recuperacao natural mantida: ${r.semanasDepois} semanas.`,
    })
  }, [tratarLesao])
  /**
   * A SEMANA DO CLUBE (pedido: "dia de jogo, dia de descanso, dia de treinamento").
   * Quantos jogos ha na semana vem do calendario; a postura decide o uso dos dias
   * livres. Ver lib/rotina-da-semana.ts.
   */
  const jogosDaSemana = useMemo(() => {
    const cal = seasonCalendar?.fixtures ?? []
    // A semana que vem — a que o motor vai processar no proximo avanco, e a unica
    // sobre a qual a postura escolhida aqui ainda manda.
    //
    // ⚠️ O `|| 1` so vale com o calendario VAZIO (ainda hidratando). Com calendario
    // carregado e nenhum jogo marcado, zero e a resposta certa: e semana livre, e
    // a tela precisa dizer isso. Um `|| 1` cego mostraria jogo onde nao ha.
    if (cal.length === 0) return 1
    return cal.filter(f => f.isUserMatch && !f.played && f.week === currentWeek + 1).length
  }, [seasonCalendar, currentWeek])
  const rotina = useMemo(() => montarRotina(jogosDaSemana, posturaDaSemana), [jogosDaSemana, posturaDaSemana])
  const ultimoTreino = useGameEngine(s => s.ultimoTreino)
  // `?? VAZIO` e nao `?? {}`: um literal novo a cada render invalidaria os
  // useMemo abaixo em todo ciclo, e a prévia do treino é cara (percorre o elenco).
  const fadigaCronica = useGameEngine(s => s.fadigaCronica) ?? VAZIO
  const entrosamentoPares = useGameEngine(s => s.entrosamentoPares) ?? VAZIO
  const squadCohesion = useGameEngine(s => s.squadCohesion) ?? PISO_ENTROSAMENTO
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [inspectPlayer, setInspectPlayer] = useState<Player | null>(null)
  const [selectedTraining, setSelectedTraining] = useState<string | null>(null)

  // % de melhora do treino, espelhando o motor (Centro de Treinamento nivel 1-5).
  const trainingLvl = clubInfrastructure?.training ?? 2
  const trainChancePct = Math.round(Math.min(0.9, 0.6 + trainingLvl * 0.05) * 100)

  // ── PLANO COLETIVO: a previa da semana ────────────────────────────────────
  //
  // O mesmo modelo que o motor roda no avanco de semana, so que aqui em SECO:
  // o tecnico ve a carga, a energia media e o risco de lesao ANTES de escolher.
  // Sem isto, "alta" e "leve" seriam duas palavras sem consequencia visivel.
  const previa = useMemo(() => aplicarSemanaDeTreino(
    squadPlayers.map(p => ({
      id: p.id,
      idade: p.age,
      energia: p.energy ?? 100,
      fadigaCronica: fadigaCronica[p.id] ?? 0,
      minutosJogados: p.isStarter && !p.injury ? 90 : 0,
      resistencia: p.physical ?? 70,
      lesionado: Boolean(p.injury),
      emTreinoIndividual: Boolean(p.training.currentFocus),
      focoIndividual: p.training.currentFocus ?? null,
    })),
    planoDeTreino,
    { centroDeTreinamento: trainingLvl, centroMedico: clubInfrastructure?.medical ?? 2 },
  ), [squadPlayers, fadigaCronica, planoDeTreino, trainingLvl, clubInfrastructure?.medical])

  // Duplas do onze titular: o rosto humano do entrosamento. "Quem ainda nao se
  // conhece" e a informacao que faz o tecnico decidir escalar o mesmo time.
  const duplasDoXI = useMemo(() => {
    const titulares = squadPlayers.filter(p => p.isStarter && !p.injury)
    if (titulares.length < 2) return []
    return duplasDoGrupo(entrosamentoPares, titulares.map(p => ({ id: p.id, nome: p.name })))
  }, [squadPlayers, entrosamentoPares])
  const [filter, setFilter] = useState<"all" | "available" | "training">("all")
  const [sortBy, setSortBy] = useState<"overall" | "potential" | "idade" | "nome">("overall")
  const [feedback, setFeedback] = useState<string | null>(null)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Filtra jogadores
  const filteredPlayers = useMemo(() => {
    let players = [...squadPlayers]
    
    if (filter === "available") {
      players = players.filter(p => !p.training.currentFocus && !p.injury)
    } else if (filter === "training") {
      players = players.filter(p => p.training.currentFocus)
    }
    
    // Ordenacao escolhida pelo usuario (antes era fixo por overall).
    const cmp: Record<typeof sortBy, (a: typeof players[number], b: typeof players[number]) => number> = {
      overall: (a, b) => b.overall - a.overall,
      potential: (a, b) => b.potential - a.potential,
      idade: (a, b) => a.age - b.age,
      nome: (a, b) => a.name.localeCompare(b.name),
    }
    return players.sort(cmp[sortBy])
  }, [squadPlayers, filter, sortBy])

  const router = useRouter()
  const [gpPlayerIdx, setGpPlayerIdx] = useState(0)

  useEffect(() => {
    const handler = (e: Event) => {
      const btn = (e as CustomEvent).detail?.button
      if (!btn) return
      if (btn === "B") {
        if (inspectPlayer) { setInspectPlayer(null); return }
        if (selectedPlayer) { setSelectedPlayer(null); return }
        router.back(); return
      }
      const filterOrder: ("all" | "available" | "training")[] = ["all", "available", "training"]
      if (btn === "LB") setFilter(f => filterOrder[Math.max(0, filterOrder.indexOf(f) - 1)])
      if (btn === "RB") setFilter(f => filterOrder[Math.min(filterOrder.length - 1, filterOrder.indexOf(f) + 1)])
      if (btn === "DPAD_DOWN") {
        setGpPlayerIdx(prev => {
          const next = Math.min(prev + 1, filteredPlayers.length - 1)
          setSelectedPlayer(filteredPlayers[next] ?? null)
          return next
        })
      }
      if (btn === "DPAD_UP") {
        setGpPlayerIdx(prev => {
          const next = Math.max(prev - 1, 0)
          setSelectedPlayer(filteredPlayers[next] ?? null)
          return next
        })
      }
    }
    window.addEventListener("gamepad:button", handler)
    return () => window.removeEventListener("gamepad:button", handler)
  }, [router, selectedPlayer, inspectPlayer, filteredPlayers])

  // Contagem de jogadores em treinamento
  const playersInTraining = squadPlayers.filter(p => p.training.currentFocus).length

  // Inicia treinamento
  const handleStartTraining = () => {
    if (selectedPlayer && selectedTraining) {
      const type = trainingTypes.find(t => t.id === selectedTraining)
      trainPlayer(selectedPlayer.id, selectedTraining)
      const label = type?.name ?? selectedTraining
      setFeedback(`+1 ${label} em progresso para ${selectedPlayer.name}!`)
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
      feedbackTimer.current = setTimeout(() => setFeedback(null), 3000)
      setSelectedPlayer(null)
      setSelectedTraining(null)
    }
  }

  useEffect(() => () => { if (feedbackTimer.current) clearTimeout(feedbackTimer.current) }, [])

  // Verifica se jogador pode treinar.
  //
  // BUG que o `?? 100` corrige: quando `energy` vinha undefined (nem todo jogador do
  // engine traz o campo), `undefined >= 30` e FALSE — entao canTrain dava false para
  // TODO MUNDO, os botoes ficavam `disabled` e clicar num jogador nao fazia nada. O
  // painel "Jogador Selecionado" nunca preenchia e o treino era impossivel de usar.
  const canTrain = (player: Player) => {
    return !player.injury && (player.energy ?? 100) >= 30
  }

  /** Por que este jogador nao pode treinar — antes o clique so era ignorado em silencio. */
  const blockedReason = (player: Player): string | null => {
    if (player.injury) return "Lesionado"
    if ((player.energy ?? 100) < 30) return "Energia baixa"
    if (player.training.currentFocus) return "Ja em treino"
    return null
  }

  return (
    <div className="h-screen md:pl-0 pl-0 pb-20 md:pb-0 bg-[#050508] flex flex-col overflow-hidden">
      <GameHeader team={userTeam} />

      {/* Toast de feedback de treinamento */}
      {feedback && (
        <div className="fixed top-20 right-6 z-50 px-5 py-3 rounded-xl bg-[var(--brand)] text-[var(--brand-ink)] font-bold text-sm shadow-2xl animate-in slide-in-from-right-4 duration-300">
          {feedback}
        </div>
      )}

      <main className="flex-1 p-4 overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Centro de Treinamento</h1>
            <p className="text-sm text-white/50 mt-1">Desenvolva os atributos dos seus jogadores</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0c0c10] border border-white/[0.04]">
              <Dumbbell className="h-4 w-4 text-[var(--brand)]" />
              <span className="text-sm text-white/70">{playersInTraining} em treinamento</span>
            </div>
          </div>
        </div>

        {/* ── TREINO COLETIVO DA SEMANA ─────────────────────────────────────
            Antes esta tela só tinha treino INDIVIDUAL: um atleta, um atributo,
            quatro semanas. Não havia carga, não havia fadiga e não havia risco —
            a energia subia +10 por semana para todo mundo. O plano coletivo é o
            que dá consequência à escolha: carga alta ensina mais e machuca mais,
            semana regenerativa devolve fôlego e queima fadiga crônica. */}
        <section className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-white/60">
                <Users className="h-4 w-4 text-[var(--brand)]" />
                TREINO COLETIVO DA SEMANA
              </div>
              <p className="mt-1 text-[11px] text-white/40">
                Vale para o elenco inteiro e roda sozinho a cada semana que passa.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <PreviaTile rotulo="Carga" valor={`${previa.carga}`} nota={rotuloDaCarga(previa.carga)} />
              <PreviaTile rotulo="Energia média" valor={`${previa.energiaMedia}%`} nota="depois da semana" />
              <PreviaTile
                rotulo="Fadiga"
                valor={`${previa.fadigaMedia}`}
                nota={previa.fadigaMedia >= 55 ? "elenco no limite" : previa.fadigaMedia >= 30 ? "acumulando" : "sob controle"}
                alerta={previa.fadigaMedia >= 55}
              />
              <PreviaTile
                rotulo="Risco de lesão"
                valor={`${(previa.riscoMedio * 100).toFixed(1)}%`}
                nota="por atleta / semana"
                alerta={previa.riscoMedio > 0.045}
              />
            </div>
          </div>

          {/* ── A SEMANA ─────────────────────────────────────────────────────
              O tecnico via so "intensidade" e "foco", como se treinasse todos os
              dias. Aqui aparece a semana de verdade: onde caem os jogos, onde da
              para trabalhar e onde e melhor poupar. A vespera de jogo nunca e
              treino — no futebol ela e de ativacao. */}
          <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/40">Semana de trabalho</div>
                <p className="mt-0.5 text-xs text-white/60">{rotina.resumo}</p>
              </div>
              <div className="flex gap-1.5">
                {([
                  { id: "poupar", rotulo: "Poupar" },
                  { id: "equilibrado", rotulo: "Equilibrado" },
                  { id: "carga_total", rotulo: "Carga total" },
                ] as const).map(op => (
                  <button
                    key={op.id}
                    onClick={() => definirPosturaDaSemana(op.id)}
                    title={op.id === "poupar"
                      ? "Menos treino, mais energia para o jogo — e menos evolucao."
                      : op.id === "carga_total"
                        ? "Treina todos os dias livres: evolui mais, chega mais cansado."
                        : "Um dia de folga, o resto de trabalho."}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
                      posturaDaSemana === op.id
                        ? "bg-[var(--brand)] text-[var(--brand-ink)]"
                        : "border border-white/10 text-white/60 hover:text-white",
                    )}
                  >
                    {op.rotulo}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {rotina.dias.map(d => (
                <div
                  key={d.indice}
                  className={cn(
                    "rounded-lg border p-2 text-center",
                    d.tipo === "jogo" ? "border-[var(--brand)]/50 bg-[var(--brand)]/12"
                      : d.tipo === "descanso" ? "border-sky-400/30 bg-sky-400/[0.07]"
                      : "border-white/10 bg-white/[0.03]",
                  )}
                >
                  <div className="text-[9px] uppercase tracking-wide text-white/35">{d.rotulo.slice(0, 3)}</div>
                  <div className={cn(
                    "mt-0.5 text-[10px] font-bold",
                    d.tipo === "jogo" ? "text-[var(--brand)]"
                      : d.tipo === "descanso" ? "text-sky-300" : "text-white/70",
                  )}>
                    {ROTULO_DO_DIA[d.tipo]}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-4 text-white/35">
              Carga de treino da semana: {Math.round(rotina.fatorDeCarga * 100)}% do normal
              {rotina.recuperacaoExtra > 0 && ` · +${rotina.recuperacaoExtra} de energia pelo descanso`}
            </p>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Intensidade</div>
              <div className="grid grid-cols-3 gap-2">
                {INTENSIDADES.map(i => (
                  <button
                    key={i.id}
                    onClick={() => definirPlanoDeTreino({ intensidade: i.id })}
                    title={i.nota}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left transition-colors",
                      planoDeTreino.intensidade === i.id
                        ? "border-[var(--brand)] bg-[var(--brand)]/10"
                        : "border-white/[0.06] hover:border-white/15 hover:bg-white/5",
                    )}
                  >
                    <div className={cn("text-sm font-semibold", planoDeTreino.intensidade === i.id ? "text-[var(--brand)]" : "text-white")}>{i.nome}</div>
                    <div className="mt-0.5 text-[10px] leading-tight text-white/40">{i.nota}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Foco</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {FOCOS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => definirPlanoDeTreino({ foco: f.id })}
                    title={f.nota}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left transition-colors",
                      planoDeTreino.foco === f.id
                        ? "border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand)]"
                        : "border-white/[0.06] text-white/70 hover:border-white/15 hover:bg-white/5",
                    )}
                  >
                    <div className="text-xs font-semibold">{ROTULO_DO_FOCO[f.id]}</div>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] leading-tight text-white/35">
                {FOCOS.find(f => f.id === planoDeTreino.foco)?.nota}
                {" "}Treino individual no mesmo atributo do foco rende mais.
              </p>
            </div>
          </div>

          {ultimoTreino && (
            <p className="mt-4 border-t border-white/[0.04] pt-3 text-[11px] text-white/45">
              Última semana: carga {ultimoTreino.carga} ({rotuloDaCarga(ultimoTreino.carga)}), energia média{" "}
              {ultimoTreino.energiaMedia}%, fadiga {ultimoTreino.fadigaMedia}.
              {ultimoTreino.lesionados.length > 0 && (
                <span className="text-red-400">
                  {" "}Lesões no treino: {ultimoTreino.lesionados.join(", ")}.
                </span>
              )}
            </p>
          )}
        </section>

        {/* ── ENTROSAMENTO ──────────────────────────────────────────────────
            Vivia solto na Área do Treinador, como um número que subia por botão.
            Aqui ele aparece onde se trabalha o time, e mostrando de onde vem:
            minutos jogados juntos, dupla a dupla. */}
        <section className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-medium text-white/60">
              <Users className="h-4 w-4 text-[var(--brand)]" />
              ENTROSAMENTO DO ONZE
            </div>
            <span className="text-sm font-bold text-white">
              {squadCohesion}<span className="text-white/40">/100</span>
              {squadCohesion > 60 && (
                <span className="ml-2 text-xs font-semibold text-[var(--brand)]">
                  +{Math.round((squadCohesion - 60) / 8)} em campo
                </span>
              )}
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-[var(--brand)]/70 to-[var(--brand)]" style={{ width: `${squadCohesion}%` }} />
          </div>

          {duplasDoXI.length > 0 && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <DuplasLista titulo="Já se acham de olhos fechados" duplas={duplasDoXI.slice(0, 4)} />
              <DuplasLista titulo="Ainda não se conhecem" duplas={duplasDoXI.slice(-4).reverse()} />
            </div>
          )}
          <p className="mt-3 text-[11px] leading-4 text-white/35">
            Cada dupla de titulares acumula os minutos que passou em campo junta. Partida oficial, amistoso e
            treino coletivo com foco em entrosamento alimentam a mesma conta — trocar meio time na janela
            derruba o número sozinho.
          </p>
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Lista de Jogadores */}
          <div className="lg:col-span-2 rounded-xl bg-[#0c0c10] border border-white/[0.04] overflow-hidden">
            {/* Filtros */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs font-medium text-white/60">
                  <Users className="h-4 w-4 text-[var(--brand)]" />
                  ELENCO
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="rounded bg-white/[0.04] border border-white/10 px-2 py-1 text-xs text-white/70 focus:outline-none"
                  title="Ordenar por"
                >
                  <option value="overall">Overall</option>
                  <option value="potential">Potencial</option>
                  <option value="idade">Idade</option>
                  <option value="nome">Nome</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilter("all")}
                  className={cn(
                    "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                    filter === "all" ? "bg-white/10 text-white" : "text-white/50 hover:text-white/70"
                  )}
                >
                  Todos
                </button>
                <button
                  onClick={() => setFilter("available")}
                  className={cn(
                    "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                    filter === "available" ? "bg-white/10 text-white" : "text-white/50 hover:text-white/70"
                  )}
                >
                  Disponiveis
                </button>
                <button
                  onClick={() => setFilter("training")}
                  className={cn(
                    "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                    filter === "training" ? "bg-white/10 text-white" : "text-white/50 hover:text-white/70"
                  )}
                >
                  Em Treino
                </button>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-4 px-5 py-2 border-b border-white/[0.04] bg-white/[0.02]">
              <div className="min-w-[180px] text-[10px] font-medium uppercase tracking-wider text-white/35">
                Jogador
              </div>
              <div className="flex-1 grid grid-cols-6 gap-2">
                {trainingTypes.map(type => {
                  const Icon = type.icon
                  return (
                    <div key={type.id} className="flex items-center justify-center gap-1 text-[10px] font-medium text-white/45">
                      <Icon className={cn("h-3 w-3", type.color)} />
                      <span className="truncate">{type.name}</span>
                    </div>
                  )
                })}
              </div>
              <div className="min-w-[120px] text-right text-[10px] font-medium uppercase tracking-wider text-white/35">
                Status
              </div>
            </div>

            {/* Lista.
                Tinha `max-h-[72vh] overflow-y-auto` — e era daí que vinha a
                faixa morta no pé desta tela. Sob o `zoom` do jogo (body {zoom:
                var(--game-view-scale)}), `vh` continua medindo a janela SEM
                escala: 72vh viram ~57% da tela de verdade. A lista parava alta e
                sobrava um vazio embaixo. Quem rola aqui é o <main>. */}
            <div className="divide-y divide-white/5">
              {filteredPlayers.map(player => {
                const isSelected = selectedPlayer?.id === player.id
                const isTraining = !!player.training.currentFocus
                const canPlayerTrain = canTrain(player)
                const recommended = getRecommendedTraining(player.position)
                const reason = blockedReason(player)

                return (
                  <button
                    key={player.id}
                    // Clicar num jogador bloqueado agora DIZ o porque, em vez de nao
                    // fazer nada — era isso que dava a impressao de tela quebrada.
                    onClick={() => {
                      if (canPlayerTrain && !isTraining) { setSelectedPlayer(player); return }
                      if (reason) {
                        setFeedback(`${player.name}: ${reason}.`)
                        setTimeout(() => setFeedback(null), 2500)
                      }
                    }}
                    title={reason ?? undefined}
                    className={cn(
                      "w-full flex items-center gap-4 px-5 py-4 text-left transition-colors",
                      isSelected && "bg-[var(--brand)]/10 border-l-2 border-[var(--brand)]",
                      !isSelected && canPlayerTrain && !isTraining && "hover:bg-white/5",
                      (!canPlayerTrain || isTraining) && "opacity-60"
                    )}
                  >
                    {/* Avatar / Info basica */}
                    <div className="flex items-center gap-3 min-w-[180px]">
                      <div className="relative">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center text-sm font-bold text-white">
                          {player.overall}
                        </div>
                        {player.injury && (
                          <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-red-500 flex items-center justify-center">
                            <AlertCircle className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-white text-sm">{player.name}</div>
                        <div className="text-xs text-white/50">{player.position} · {player.age} anos</div>
                      </div>
                    </div>

                    {/* Atributos */}
                    <div className="flex-1 grid grid-cols-6 gap-2">
                      {trainingTypes.map(type => {
                        const value = player[type.id as keyof Player] as number
                        const isRecommended = recommended.includes(type.id)
                        const Icon = type.icon
                        
                        return (
                          <div key={type.id} className="text-center">
                            <div className={cn(
                              "text-[10px] text-white/40 flex items-center justify-center gap-1",
                              isRecommended && "text-[var(--brand)]"
                            )}>
                              <Icon className="h-3 w-3" />
                            </div>
                            <div className={cn(
                              "text-sm font-medium",
                              value >= 80 ? "text-[var(--brand)]" : 
                              value >= 70 ? "text-white" : "text-white/60"
                            )}>
                              {value}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Inspecionar (perfil completo) — nao dispara a selecao de treino */}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); setInspectPlayer(player) }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setInspectPlayer(player) } }}
                      title="Inspecionar jogador"
                      className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-white/40 hover:text-[var(--brand)] hover:bg-white/5 transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                    </span>

                    {/* Status */}
                    <div className="min-w-[120px] text-right">
                      {isTraining ? (
                        <div className="flex items-center gap-2 justify-end">
                          <Timer className="h-4 w-4 text-[#ffd700]" />
                          <span className="text-xs text-[#ffd700]">
                            {player.training.currentFocus} ({player.training.weeksTrained}/4 sem)
                          </span>
                        </div>
                      ) : player.injury ? (
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setIdNoMedico(player.id) }}
                          title="Abrir departamento medico"
                          className="flex items-center gap-2 justify-end w-full rounded-md px-2 py-1 -mr-2 transition-colors hover:bg-red-500/10"
                        >
                          <AlertCircle className="h-4 w-4 text-red-500" />
                          <span className="text-xs text-red-500 underline decoration-dotted underline-offset-2">
                            Lesionado · {player.injury.weeksRemaining} sem
                          </span>
                        </button>
                      ) : player.energy < 30 ? (
                        <div className="flex items-center gap-2 justify-end">
                          <Heart className="h-4 w-4 text-orange-500" />
                          <span className="text-xs text-orange-500">Cansado</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 justify-end">
                          <CheckCircle2 className="h-4 w-4 text-[var(--brand)]" />
                          <span className="text-xs text-[var(--brand)]">Disponivel</span>
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Painel de Treinamento */}
          <div className="space-y-4">
            {/* Jogador Selecionado */}
            <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-5">
              <div className="flex items-center gap-2 text-xs font-medium text-white/60 mb-4">
                <Target className="h-4 w-4 text-[var(--brand)]" />
                JOGADOR SELECIONADO
              </div>

              {selectedPlayer ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[var(--brand)]/20 to-[var(--brand)]/5 flex items-center justify-center text-xl font-bold text-[var(--brand)]">
                      {selectedPlayer.overall}
                    </div>
                    <div>
                      <div className="font-semibold text-white">{selectedPlayer.name}</div>
                      <div className="text-sm text-white/50">{selectedPlayer.position} · {selectedPlayer.age} anos</div>
                      <div className="text-xs text-white/40">Potencial: {selectedPlayer.potential}</div>
                    </div>
                  </div>

                  {/* Energia */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/60">Energia</span>
                      <span className="text-white">{selectedPlayer.energy}%</span>
                    </div>
                    <Progress value={selectedPlayer.energy} className="h-2" />
                  </div>

                  {/* FADIGA CRÔNICA: o cansaço que a semana não repôs. É o número
                      que explica o atleta que não parece cansado e quebra em abril
                      — e é ele que multiplica o risco de lesão no treino. */}
                  {(() => {
                    const fadiga = fadigaCronica[selectedPlayer.id] ?? 0
                    const risco = previa.efeitos.find(e => e.id === selectedPlayer.id)?.risco ?? 0
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-white/60">Fadiga acumulada</span>
                          <span className={cn(fadiga >= 55 ? "text-red-400" : fadiga >= 30 ? "text-amber-300" : "text-white")}>
                            {fadiga} · risco {(risco * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className={cn("h-full rounded-full", fadiga >= 55 ? "bg-red-500" : fadiga >= 30 ? "bg-amber-400" : "bg-[var(--brand)]")}
                            style={{ width: `${Math.min(100, fadiga)}%` }}
                          />
                        </div>
                      </div>
                    )
                  })()}

                  {/* Recomendacoes */}
                  <div className="pt-2 border-t border-white/[0.04]">
                    <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Treinos Recomendados</div>
                    <div className="flex flex-wrap gap-1">
                      {getRecommendedTraining(selectedPlayer.position).map(rec => {
                        const type = trainingTypes.find(t => t.id === rec)
                        if (!type) return null
                        return (
                          <span key={rec} className={cn("px-2 py-1 rounded text-[10px] font-medium", type.bgColor, type.color)}>
                            {type.name}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-white/40 text-sm">
                  Selecione um jogador para treinar
                </div>
              )}
            </div>

            {/* Tipos de Treinamento */}
            <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-5">
              <div className="flex items-center gap-2 text-xs font-medium text-white/60 mb-4">
                <Dumbbell className="h-4 w-4 text-[var(--brand)]" />
                TIPO DE TREINAMENTO
              </div>

              <div className="space-y-2">
                {trainingTypes.map(type => {
                  const Icon = type.icon
                  const isSelected = selectedTraining === type.id
                  const currentValue = selectedPlayer ? (selectedPlayer[type.id as keyof Player] as number) : 0
                  const maxValue = selectedPlayer?.potential || 99
                  const canImprove = currentValue < maxValue
                  
                  return (
                    <button
                      key={type.id}
                      onClick={() => selectedPlayer && canImprove && setSelectedTraining(type.id)}
                      disabled={!selectedPlayer || !canImprove}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left",
                        isSelected 
                          ? "border-[var(--brand)] bg-[var(--brand)]/10" 
                          : "border-white/[0.04] hover:border-white/10 hover:bg-white/5",
                        (!selectedPlayer || !canImprove) && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", type.bgColor)}>
                        <Icon className={cn("h-5 w-5", type.color)} />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-white text-sm">{type.name}</div>
                        <div className="text-[10px] text-white/40">{type.description}</div>
                      </div>
                      {selectedPlayer && (
                        <div className="text-right">
                          <div className="text-sm font-bold text-white">{currentValue}</div>
                          <div className="text-[10px] text-white/40">max {maxValue}</div>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Botao de Iniciar */}
            <button
              onClick={handleStartTraining}
              disabled={!selectedPlayer || !selectedTraining}
              className={cn(
                "w-full py-4 rounded-xl font-semibold text-sm transition-colors",
                selectedPlayer && selectedTraining
                  ? "bg-[var(--brand)] text-[var(--brand-ink)] hover:bg-[var(--brand-2)]"
                  : "bg-white/5 text-white/30 cursor-not-allowed"
              )}
            >
              {selectedPlayer && selectedTraining 
                ? `Iniciar Treinamento de ${trainingTypes.find(t => t.id === selectedTraining)?.name}`
                : "Selecione jogador e treinamento"
              }
            </button>

            {/* Info */}
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-start gap-3">
                <Brain className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs text-white/60">
                  <p className="font-medium text-white/80 mb-1">Como funciona</p>
                  <p>O treinamento dura 4 semanas. Ao final, o jogador tem <span className="text-[var(--brand)] font-semibold">{trainChancePct}%</span> de chance de melhorar +1 no atributo escolhido, limitado ao seu potencial maximo.</p>
                  <p className="mt-1 text-white/40">Centro de Treinamento nivel {trainingLvl}/5 — melhore a estrutura para aumentar a chance (ate 90%), e ela reduz o risco de lesao no treino.</p>
                  <p className="mt-1 text-white/40">
                    O PLANO COLETIVO acima modula essa chance: intensidade alta ensina mais, atleta esgotado
                    nao aprende, e treinar o mesmo atributo do foco da semana rende 30% a mais.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {inspectPlayer && (
        <PlayerInspectModal player={inspectPlayer} currentWeek={currentWeek} onClose={() => setInspectPlayer(null)} />
      )}

      <MedicalModal
        open={atletaNoMedico !== null}
        onOpenChange={aberto => { if (!aberto) setIdNoMedico(null) }}
        player={atletaNoMedico}
        onTreatment={aplicarTratamento}
      />
    </div>
  )
}

// Perfil completo do jogador ("inspecionar"): atributos, status, contrato e estatisticas.
function PlayerInspectModal({ player, currentWeek, onClose }: { player: Player; currentWeek: number; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); onClose() } }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  const attrs: { id: keyof Player; label: string; color: string }[] = [
    { id: "pace", label: "Velocidade", color: "bg-yellow-400" },
    { id: "shooting", label: "Finalizacao", color: "bg-red-400" },
    { id: "passing", label: "Passe", color: "bg-blue-400" },
    { id: "dribbling", label: "Dribles", color: "bg-purple-400" },
    { id: "defending", label: "Defesa", color: "bg-green-400" },
    { id: "physical", label: "Fisico", color: "bg-orange-400" },
  ]
  const weeksLeft = player.contract ? Math.max(0, Math.round((player.contract.endDate - currentWeek) / 1)) : null
  const st = player.seasonStats

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-[520px] max-w-[95vw] max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0c0c14] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecalho */}
        <div className="flex items-start justify-between gap-4 p-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[var(--brand)]/20 to-[var(--brand)]/5 flex items-center justify-center text-2xl font-bold text-[var(--brand)]">
              {player.overall}
            </div>
            <div>
              <div className="text-lg font-bold text-white">{player.name}</div>
              <div className="text-sm text-white/50">
                {player.position}
                {player.secondaryPositions?.length ? ` · ${player.secondaryPositions.join(", ")}` : ""} · {player.age} anos
              </div>
              <div className="text-xs text-white/40 mt-0.5 flex items-center gap-1">
                <Award className="h-3 w-3 text-[#ffd700]" /> Potencial {player.potential} · {player.nationality}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Atributos */}
        <div className="p-5 space-y-2.5">
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Atributos</div>
          {attrs.map((a) => {
            const v = (player[a.id] as number) ?? 0
            return (
              <div key={a.id as string} className="flex items-center gap-3">
                <span className="w-24 text-xs text-white/60">{a.label}</span>
                <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className={cn("h-full rounded-full", a.color)} style={{ width: `${Math.min(100, v)}%` }} />
                </div>
                <span className="w-7 text-right text-sm font-semibold text-white tabular-nums">{v}</span>
              </div>
            )
          })}
        </div>

        {/* Status + contrato */}
        <div className="px-5 pb-5 grid grid-cols-2 gap-3">
          <InfoTile label="Energia" value={`${player.energy}%`} />
          <InfoTile label="Moral" value={player.morale} />
          <InfoTile label="Forma" value={`${player.form}%`} />
          <InfoTile label="Valor de mercado" value={formatCurrency(player.marketValue)} />
          {player.contract && <InfoTile label="Salario (sem.)" value={formatCurrency(player.contract.salary)} />}
          {weeksLeft !== null && <InfoTile label="Contrato" value={weeksLeft > 0 ? `${weeksLeft} sem restantes` : "Expira"} />}
          {player.injury && <InfoTile label="Lesao" value={`${player.injury.weeksRemaining} sem`} accent="text-red-400" />}
          {player.training.currentFocus && <InfoTile label="Em treino" value={`${player.training.currentFocus} (${player.training.weeksTrained}/4)`} accent="text-[#ffd700]" />}
        </div>

        {/* Estatisticas da temporada */}
        <div className="px-5 pb-6">
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Temporada</div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <StatTile label="Jogos" value={st.matchesPlayed} />
            <StatTile label="Gols" value={st.goals} />
            <StatTile label="Assist." value={st.assists} />
            <StatTile label="Melhor" value={st.manOfTheMatch} />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Número da prévia do treino coletivo (carga, energia, fadiga, risco). */
function PreviaTile({ rotulo, valor, nota, alerta }: { rotulo: string; valor: string; nota: string; alerta?: boolean }) {
  return (
    <div className={cn(
      "rounded-lg border px-3 py-2 min-w-[104px]",
      alerta ? "border-red-500/40 bg-red-500/[0.07]" : "border-white/[0.06] bg-white/[0.03]",
    )}>
      <div className="text-[10px] uppercase tracking-wider text-white/40">{rotulo}</div>
      <div className={cn("text-lg font-bold tabular-nums leading-tight", alerta ? "text-red-300" : "text-white")}>{valor}</div>
      <div className="text-[10px] text-white/35">{nota}</div>
    </div>
  )
}

function DuplasLista({ titulo, duplas }: { titulo: string; duplas: { a: string; b: string; pct: number }[] }) {
  const sobrenome = (n: string) => n.trim().split(/\s+/).pop() ?? n
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2">{titulo}</div>
      <div className="space-y-1.5">
        {duplas.map(d => (
          <div key={`${d.a}-${d.b}`} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-xs text-white/70">
              {sobrenome(d.a)} <span className="text-white/25">+</span> {sobrenome(d.b)}
            </span>
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${d.pct}%` }} />
            </div>
            <span className="w-8 text-right text-[10px] tabular-nums text-white/45">{d.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function InfoTile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] px-3 py-2">
      <div className="text-[10px] text-white/40">{label}</div>
      <div className={cn("text-sm font-medium text-white truncate", accent)}>{value}</div>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] py-2">
      <div className="text-lg font-bold text-white tabular-nums">{value}</div>
      <div className="text-[10px] text-white/40">{label}</div>
    </div>
  )
}

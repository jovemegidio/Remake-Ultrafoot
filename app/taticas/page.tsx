"use client"

import { useState, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronLeft,
  ChevronRight,
  Shield,
  Sword,
  Target,
  Users,
  Zap,
  Settings,
  Brain,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Save,
  Info,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Eye,
  Gauge,
  X
} from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { forcasDaTatica, resumoDoPlano } from "@/lib/forcas-taticas"
import { efeitosDoTreinador } from "@/lib/efeito-do-treinador"
import { adequacaoAFuncao, forcasDoElenco } from "@/lib/forcas-individuais"
import { useGameState } from "@/lib/save-system"
import { getTeamByShort, serieATeams } from "@/lib/teams-data"
import { useGameEngine, persistGameEngineNow, type TeamTactics, type PlayerInstructions, type PlayerRole, PLAYER_ROLE_INFO } from "@/lib/game-engine"
import { listarTaticas, salvarTatica, removerTatica, obterTatica, type TaticaSalva } from "@/lib/taticas-salvas"
import { pedirTexto as pedirTextoNoJogo } from "@/lib/dialogo-do-jogo"
import { useRouter } from "next/navigation"
import { useDiscordActivity } from "@/hooks/use-discord-rpc"

// Descricoes de mentalidade
const MENTALITY_INFO: Record<string, { label: string; desc: string; color: string }> = {
  muito_defensivo: { label: "Muito Defensivo", desc: "Prioriza nao sofrer gols. Time recuado.", color: "text-blue-400" },
  defensivo: { label: "Defensivo", desc: "Foco em defesa com contra-ataques.", color: "text-cyan-400" },
  equilibrado: { label: "Equilibrado", desc: "Balanco entre ataque e defesa.", color: "text-green-400" },
  ofensivo: { label: "Ofensivo", desc: "Busca o gol com mais frequencia.", color: "text-orange-400" },
  muito_ofensivo: { label: "Muito Ofensivo", desc: "Ataque total. Alto risco.", color: "text-red-400" },
}

const STYLE_INFO: Record<string, { label: string; desc: string }> = {
  posse_bola: { label: "Posse de Bola", desc: "Troca de passes para criar espacos" },
  contra_ataque: { label: "Contra-Ataque", desc: "Transicao rapida ao recuperar a bola" },
  pressao_alta: { label: "Pressao Alta", desc: "Marca no campo adversario" },
  jogo_direto: { label: "Jogo Direto", desc: "Bolas longas para os atacantes" },
  jogo_posicional: { label: "Jogo Posicional", desc: "Movimentacao estruturada" },
}

const PHASE_FORMATIONS = ["4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "5-3-2", "4-1-4-1", "3-4-3", "2-3-5"]

const ROLE_INFO: Record<PlayerRole, { label: string; desc: string; positions: string[] }> = {
  goleiro_defensor: { label: "Goleiro Defensor", desc: "Foca em defender o gol", positions: ["GOL"] },
  goleiro_libero: { label: "Goleiro Libero", desc: "Sai do gol para jogar com os pes", positions: ["GOL"] },
  goleiro_sweeper: { label: "Goleiro Sweeper", desc: "Joga como ultimo defensor", positions: ["GOL"] },
  goleiro_distribuidor: { label: "Goleiro Distribuidor", desc: "Inicia jogadas com passes", positions: ["GOL"] },
  zagueiro_central: { label: "Zagueiro Central", desc: "Defensor classico", positions: ["ZAG"] },
  zagueiro_stopper: { label: "Zagueiro Stopper", desc: "Sai na bola agressivamente", positions: ["ZAG"] },
  zagueiro_cover: { label: "Zagueiro Cover", desc: "Cobre os espacos atras", positions: ["ZAG"] },
  zagueiro_saidor: { label: "Zagueiro Saidor", desc: "Sai jogando pelo chao", positions: ["ZAG"] },
  zagueiro_libero: { label: "Libero", desc: "Zagueiro livre que avanca", positions: ["ZAG"] },
  zagueiro_marcador: { label: "Zagueiro Marcador", desc: "Marcacao individual", positions: ["ZAG"] },
  zagueiro_aereo: { label: "Zagueiro Aereo", desc: "Especialista em aereas", positions: ["ZAG"] },
  zagueiro_lider: { label: "Zagueiro Lider", desc: "Organiza a defesa", positions: ["ZAG"] },
  lateral_defensivo: { label: "Lateral Defensivo", desc: "Prioriza a marcacao", positions: ["LD", "LE"] },
  lateral_equilibrado: { label: "Lateral Equilibrado", desc: "Participa do ataque com moderacao", positions: ["LD", "LE"] },
  lateral_ofensivo: { label: "Lateral Ofensivo", desc: "Sobe constantemente", positions: ["LD", "LE"] },
  ala: { label: "Ala", desc: "Cobre toda a lateral", positions: ["LD", "LE", "ALD", "ALE"] },
  lateral_invertido: { label: "Lateral Invertido", desc: "Corta para dentro", positions: ["LD", "LE"] },
  ala_completo: { label: "Ala Completo", desc: "Cobre toda a faixa com intensidade", positions: ["LD", "LE"] },
  lateral_cruzador: { label: "Lateral Cruzador", desc: "Especialista em cruzamentos", positions: ["LD", "LE"] },
  carrilero: { label: "Carrilero", desc: "Lateral que joga como volante", positions: ["LD", "LE"] },
  lateral_zona: { label: "Lateral por Dentro", desc: "Entra no meio campo ao atacar", positions: ["LD", "LE"] },
  lateral_sobreposto: { label: "Lateral Sobreposto", desc: "Sempre ultrapassa o ponta", positions: ["LD", "LE"] },
  volante_destruidor: { label: "Volante Destruidor", desc: "Foco total em desarmar", positions: ["VOL"] },
  volante_box_to_box: { label: "Volante Box-to-Box", desc: "Cobre todo o campo", positions: ["VOL"] },
  volante_saidor: { label: "Volante Saidor", desc: "Sai jogando e distribui", positions: ["VOL"] },
  meia_defensivo: { label: "Meia Defensivo", desc: "Protege a zaga", positions: ["VOL", "MEI"] },
  regista: { label: "Regista", desc: "Dita o ritmo do jogo", positions: ["VOL", "MEI"] },
  volante_ancora: { label: "Volante Ancora", desc: "Fixo protegendo a defesa", positions: ["VOL"] },
  volante_cobertura: { label: "Volante Cobertura", desc: "Cobre os laterais que avancam", positions: ["VOL"] },
  segundo_volante: { label: "Segundo Volante", desc: "Chega na area para finalizar", positions: ["VOL"] },
  meio_campo_central: { label: "Meio-Campo Central", desc: "Organiza o jogo no centro", positions: ["VOL", "MEI"] },
  volante_tecnico: { label: "Volante Tecnico", desc: "Tecnica aliada a marcacao", positions: ["VOL"] },
  meia_central: { label: "Meia Central", desc: "Equilibrio entre funcoes", positions: ["MEI"] },
  meia_armador: { label: "Meia Armador", desc: "Cria jogadas de ataque", positions: ["MEI"] },
  meia_atacante: { label: "Meia Atacante", desc: "Chega na area para finalizar", positions: ["MEI"] },
  meia_box_to_box: { label: "Meia Box-to-Box", desc: "Intensidade em todo campo", positions: ["MEI"] },
  enganche: { label: "Enganche", desc: "Camisa 10 classico", positions: ["MEI"] },
  mezzala: { label: "Mezzala", desc: "Meia que ataca pelas laterais", positions: ["MEI"] },
  trequartista: { label: "Trequartista", desc: "Criativo entre linhas", positions: ["MEI"] },
  meia_infiltrador: { label: "Meia Infiltrador", desc: "Entra na area pelos espacos", positions: ["MEI"] },
  meia_organizador: { label: "Meia Organizador", desc: "Controla o ritmo do jogo", positions: ["MEI"] },
  meia_livre: { label: "Meia Livre", desc: "Liberdade total no campo", positions: ["MEI"] },
  meia_defensivo_avancado: { label: "Meia Defensivo Avancado", desc: "Defende e arma jogadas", positions: ["MEI"] },
  construtor_jogo: { label: "Construtor de Jogo", desc: "Organiza o ataque desde o fundo", positions: ["MEI"] },
  ponta: { label: "Ponta", desc: "Joga aberto e cruza", positions: ["PD", "PE", "MD", "ME"] },
  ponta_invertido: { label: "Ponta Invertido", desc: "Corta para dentro e finaliza", positions: ["PD", "PE"] },
  ala_ofensivo: { label: "Ala Ofensivo", desc: "Cobre lateral e ataque", positions: ["PD", "PE", "MD", "ME"] },
  meia_ponta: { label: "Meia-Ponta", desc: "Flutua entre meio e ponta", positions: ["PD", "PE", "MEI"] },
  extremo: { label: "Extremo", desc: "Veloz pela beirada", positions: ["PD", "PE"] },
  ponta_fixo: { label: "Ponta Fixo", desc: "Domina o corredor e cruza", positions: ["PD", "PE"] },
  ponta_flutuante: { label: "Ponta Flutuante", desc: "Flutua pelo ataque", positions: ["PD", "PE"] },
  segundo_atacante_ponta: { label: "Segundo Atacante-Ponta", desc: "Joga como ponta e second striker", positions: ["PD", "PE"] },
  ponta_velocista: { label: "Ponta Velocista", desc: "Explora velocidade nas costas", positions: ["PD", "PE"] },
  ponta_finalizador: { label: "Ponta Finalizador", desc: "Corta e finaliza frequentemente", positions: ["PD", "PE"] },
  centroavante: { label: "Centroavante", desc: "Referencia na area", positions: ["ATA"] },
  atacante_movel: { label: "Atacante Movel", desc: "Movimenta-se por todo ataque", positions: ["ATA"] },
  falso_nove: { label: "Falso 9", desc: "Recua para criar espacos", positions: ["ATA"] },
  target_man: { label: "Target Man", desc: "Pivo para receber bolas longas", positions: ["ATA"] },
  poacher: { label: "Poacher", desc: "Vive na area esperando chances", positions: ["ATA"] },
  atacante_completo: { label: "Atacante Completo", desc: "Gol e assistencia com qualidade", positions: ["ATA"] },
  atacante_pressing: { label: "Atacante Pressing", desc: "Pressiona a defesa adversaria", positions: ["ATA"] },
  atacante_referencia: { label: "Atacante Referencia", desc: "Segura a bola e protege", positions: ["ATA"] },
  atacante_area: { label: "Atacante de Area", desc: "Especialista em finalizar", positions: ["ATA"] },
  segundo_atacante: { label: "Segundo Atacante", desc: "Apoia o centroavante", positions: ["ATA"] },
  atacante_profundidade: { label: "Atacante de Profundidade", desc: "Explora espacos nas costas", positions: ["ATA"] },
  atacante_pivot: { label: "Atacante Pivo", desc: "Joga de costas e distribui", positions: ["ATA"] },
}

type TabType = "mentalidade" | "comBola" | "semBola" | "bolaParada" | "instrucoes" | "adversario"

export default function TaticasPage() {
  const { state } = useGameState()
  const userTeam = getTeamByShort(state.selectedTeamShort || "BGT") || serieATeams[0]
  useDiscordActivity("Configurando táticas", userTeam.nome)
  const gameEngine = useGameEngine()
  const setPieceTakers = useGameEngine(s => s.setPieceTakers)
  const setSetPieceTaker = useGameEngine(s => s.setSetPieceTaker)
  
  const [activeTab, setActiveTab] = useState<TabType>("mentalidade")
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null)
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)
  
  const { teamTactics, setTeamTactics, playerInstructions, setPlayerInstructions, squadPlayers } = gameEngine
  // Mesmo calculo que a partida usa — nao uma previa parecida. Se a tela
  // estimasse por conta propria, seriam duas escalas para a mesma grandeza.
  // Mesmo cálculo da partida, técnico incluído: a faixa "Efeito do plano" não
  // pode prometer uma coerência que o jogo não vai usar.
  const efeitoDoPlano = useMemo(
    () => forcasDaTatica(teamTactics, efeitosDoTreinador().coerenciaTatica),
    [teamTactics],
  )
  /**
   * Camada INDIVIDUAL: as 66 funcoes e as ordens por atleta. Mesmo calculo da
   * partida — a tela nao estima por conta propria. Ver lib/forcas-individuais.
   */
  const efeitoIndividual = useMemo(
    () => forcasDoElenco(squadPlayers.filter(p => p.isStarter && !p.injury), playerInstructions),
    [squadPlayers, playerInstructions],
  )

  // ── Táticas salvas (preset do CONJUNTO tático, não da escalação) ──────────
  const [taticasSalvas, setTaticasSalvas] = useState<TaticaSalva[]>([])
  const [avisoTatica, setAvisoTatica] = useState<string | null>(null)
  useEffect(() => { setTaticasSalvas(listarTaticas()) }, [])

  const salvarTaticaAtual = async () => {
    const nome = await pedirTextoNoJogo({
      titulo: "Salvar tática",
      mensagem: "Dê um nome ao conjunto tático para reaproveitá-lo em outras partidas.",
      placeholder: "Nome da tática",
      valorInicial: `Esquema ${taticasSalvas.length + 1}`,
      confirmar: "Salvar",
    })
    if (!nome?.trim()) return
    salvarTatica({
      nome: nome.trim(),
      // A formação vive na RAIZ do engine, não em teamTactics — errei isto na
      // primeira escrita e o tipo pegou.
      formacao: gameEngine.formation ?? "4-3-3",
      mentalidade: teamTactics.mentality,
      marcacao: teamTactics.markingStyle,
      linhaDefesa: teamTactics.defensiveLine,
      armadilhaImpedimento: teamTactics.offsideTrap,
      setorAtaque: teamTactics.crossingStyle,
      ritmo: teamTactics.tempo,
    })
    setTaticasSalvas(listarTaticas())
    setAvisoTatica(`"${nome.trim()}" salva.`)
    setTimeout(() => setAvisoTatica(null), 3000)
  }

  const carregarTatica = (id: string) => {
    const t = obterTatica(id)
    if (!t) return
    // Aplica só o que a tática guarda; o resto do esquema fica como está.
    setTeamTactics({
      mentality: t.mentalidade as TeamTactics["mentality"],
      markingStyle: t.marcacao as TeamTactics["markingStyle"],
      defensiveLine: t.linhaDefesa as TeamTactics["defensiveLine"],
      offsideTrap: t.armadilhaImpedimento,
      crossingStyle: t.setorAtaque as TeamTactics["crossingStyle"],
      tempo: t.ritmo as TeamTactics["tempo"],
    })
    setAvisoTatica(`"${t.nome}" aplicada.`)
    setTimeout(() => setAvisoTatica(null), 3000)
  }

  const tabs: { id: TabType; label: string; icon: typeof Shield }[] = [
    { id: "mentalidade", label: "Mentalidade", icon: Brain },
    { id: "comBola", label: "Com a Bola", icon: Zap },
    { id: "semBola", label: "Sem a Bola", icon: Shield },
    { id: "bolaParada", label: "Bola Parada", icon: Target },
    { id: "instrucoes", label: "Instrucoes", icon: Users },
    { id: "adversario", label: "Adversario", icon: Eye },
  ]

  const handleSaveTactics = () => {
    // A confirmacao nao pode ser apenas visual: garante que o snapshot ja esteja
    // gravado antes de voltar ao elenco ou iniciar uma partida.
    persistGameEngineNow()
    setShowSaveConfirm(true)
    setTimeout(() => setShowSaveConfirm(false), 2000)
  }

  const selectedPlayer = useMemo(() => {
    if (!selectedPlayerId) return null
    return squadPlayers.find(p => p.id === selectedPlayerId)
  }, [selectedPlayerId, squadPlayers])

  const currentPlayerInstructions = useMemo(() => {
    if (!selectedPlayerId) return null
    return playerInstructions[selectedPlayerId] || null
  }, [selectedPlayerId, playerInstructions])

  /** Qual fase o seletor de funcao esta editando. Ver o bloco "Funcao no Time". */
  const [faseDaFuncao, setFaseDaFuncao] = useState<"com" | "sem">("com")

  const router = useRouter()
  const tabOrder: TabType[] = ["mentalidade", "comBola", "semBola", "instrucoes", "adversario"]

  useEffect(() => {
    const handler = (e: Event) => {
      const btn = (e as CustomEvent).detail?.button
      if (!btn) return
      if (btn === "B") { router.back(); return }
      if (btn === "A") { handleSaveTactics(); return }
      if (btn === "LB") {
        setActiveTab(prev => tabOrder[Math.max(0, tabOrder.indexOf(prev) - 1)])
      } else if (btn === "RB") {
        setActiveTab(prev => tabOrder[Math.min(tabOrder.length - 1, tabOrder.indexOf(prev) + 1)])
      }
      if (activeTab === "instrucoes") {
        if (btn === "DPAD_DOWN") {
          setSelectedPlayerId(prev => {
            const idx = squadPlayers.findIndex(p => p.id === prev)
            return squadPlayers[Math.min(squadPlayers.length - 1, idx + 1)]?.id ?? prev
          })
        } else if (btn === "DPAD_UP") {
          setSelectedPlayerId(prev => {
            const idx = squadPlayers.findIndex(p => p.id === prev)
            return squadPlayers[Math.max(0, idx - 1)]?.id ?? prev
          })
        } else if (btn === "DPAD_LEFT") {
          // Alterna COM BOLA / SEM BOLA. Sem isto, o unico controle da tela
          // inalcancavel pelo gamepad seria justamente o novo — e quem joga de
          // controle nunca descobriria que a funcao sem bola existe.
          setFaseDaFuncao("com")
        } else if (btn === "DPAD_RIGHT") {
          setFaseDaFuncao("sem")
        }
      }
    }
    window.addEventListener("gamepad:button", handler)
    return () => window.removeEventListener("gamepad:button", handler)
  }, [router, activeTab, squadPlayers])

  return (
    <div className="h-screen md:pl-0 pl-0 pb-20 md:pb-0 bg-[#050508] flex flex-col overflow-hidden">
      <GameHeader team={userTeam} />
      
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 md:p-4 scrollbar-premium">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Centro Tatico</h1>
            <p className="text-sm text-white/50">Configure sua estrategia de jogo</p>
          </div>
          
          <Button
            onClick={handleSaveTactics}
            className={cn(
              "gap-2 transition-all",
              showSaveConfirm 
                ? "bg-green-600 hover:bg-green-700" 
                : "bg-primary hover:bg-primary/90"
            )}
          >
            {showSaveConfirm ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Salvo!
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Salvar Táticas
              </>
            )}
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-thin">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap transition-all",
                activeTab === tab.id
                  ? "bg-primary text-white"
                  : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* TÁTICAS SALVAS. O jogo já salvava ESCALAÇÃO (os 11 nomes); o conjunto
            tático — mentalidade, marcação, linha, impedimento — tinha de ser
            refeito na mão a cada troca de contexto. Aqui vira preset. */}
        <div className="mb-4 rounded-xl border border-white/[0.06] bg-[#0c0c10] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/50">Táticas salvas</span>
            {taticasSalvas.length === 0 && (
              <span className="text-xs text-white/30">nenhuma ainda</span>
            )}
            {taticasSalvas.map((t) => (
              <span key={t.id} className="flex items-center gap-1 rounded-full bg-white/5 pl-3 pr-1 py-1">
                <button
                  onClick={() => carregarTatica(t.id)}
                  className="text-xs font-medium text-white hover:text-[var(--brand)]"
                >
                  {t.nome}
                </button>
                <button
                  onClick={() => { removerTatica(t.id); setTaticasSalvas(listarTaticas()) }}
                  aria-label={`Excluir ${t.nome}`}
                  className="rounded-full p-1 text-white/30 hover:bg-red-500/15 hover:text-red-300"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button
              onClick={salvarTaticaAtual}
              className="ml-auto rounded-lg border border-dashed border-white/20 px-3 py-1.5 text-xs font-medium text-white/60 hover:bg-white/5 hover:text-white"
            >
              Salvar tática atual
            </button>
          </div>
          {avisoTatica && <p className="mt-2 text-xs text-[var(--brand)]">{avisoTatica}</p>}
        </div>

        {/* EFEITO DO PLANO. Ate a 1.0.277 estes controles nao mudavam nada no
            placar; agora mudam, e o jogador precisa VER isso — senao a mudanca
            e invisivel e vale tanto quanto nao existir. */}
        <div className="mb-4 rounded-xl border border-white/[0.06] bg-[#0c0c10] p-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
              Efeito do plano
            </span>
            {([
              ["Ataque", efeitoDoPlano.attack],
              ["Meio", efeitoDoPlano.midfield],
              ["Defesa", efeitoDoPlano.defense],
            ] as const).map(([rotulo, valor]) => (
              <span key={rotulo} className="flex items-baseline gap-1.5">
                <span className="text-xs text-white/40">{rotulo}</span>
                <span className={cn(
                  "text-sm font-bold tabular-nums",
                  valor > 0 ? "text-[var(--brand)]" : valor < 0 ? "text-red-400" : "text-white/40",
                )}>
                  {valor > 0 ? `+${valor}` : valor}
                </span>
              </span>
            ))}
            <span className={cn(
              "ml-auto rounded-full px-3 py-1 text-xs font-medium",
              efeitoDoPlano.conflitos.length > 0
                ? "bg-red-500/15 text-red-300"
                : efeitoDoPlano.coerencia > 0
                  ? "bg-[var(--brand)]/15 text-[var(--brand)]"
                  : "bg-white/5 text-white/50",
            )}>
              {resumoDoPlano(efeitoDoPlano)}
            </span>
          </div>
          {efeitoDoPlano.conflitos.length > 0 && (
            <ul className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-3">
              {efeitoDoPlano.conflitos.map(c => (
                <li key={c} className="flex gap-2 text-xs leading-relaxed text-white/60">
                  <span className="text-red-400">•</span>
                  {c}
                </li>
              ))}
            </ul>
          )}

          {/* CAMADA INDIVIDUAL. As funcoes de cada atleta nao mudavam nada em
              campo ate a 1.0.280. O que pesa aqui e ADEQUACAO — se os atributos
              dele servem a funcao que recebeu —, nunca a qualidade, que ja conta
              na forca do time. */}
          {(efeitoIndividual.bemEmpregados > 0 || efeitoIndividual.malEmpregados > 0
            || efeitoIndividual.avisos.length > 0) && (
            <div className="mt-3 border-t border-white/[0.06] pt-3">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
                  Funções individuais
                </span>
                <span className="text-xs text-white/40">
                  <span className="font-bold text-[var(--brand)]">{efeitoIndividual.bemEmpregados}</span> bem
                  {" · "}
                  <span className={cn("font-bold", efeitoIndividual.malEmpregados > 0 ? "text-red-400" : "text-white/40")}>
                    {efeitoIndividual.malEmpregados}
                  </span> fora de função
                </span>
                {([
                  ["Ataque", efeitoIndividual.attack],
                  ["Meio", efeitoIndividual.midfield],
                  ["Defesa", efeitoIndividual.defense],
                ] as const).map(([rotulo, valor]) => (
                  <span key={rotulo} className="flex items-baseline gap-1.5">
                    <span className="text-xs text-white/40">{rotulo}</span>
                    <span className={cn(
                      "text-sm font-bold tabular-nums",
                      valor > 0 ? "text-[var(--brand)]" : valor < 0 ? "text-red-400" : "text-white/40",
                    )}>
                      {valor > 0 ? `+${valor}` : valor}
                    </span>
                  </span>
                ))}
              </div>
              {efeitoIndividual.avisos.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {efeitoIndividual.avisos.map(a => (
                    <li key={a} className="flex gap-2 text-xs leading-relaxed text-white/55">
                      <span className="text-amber-400">•</span>{a}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeTab === "mentalidade" && (
            <motion.div
              key="mentalidade"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid items-start gap-3 xl:grid-cols-2"
            >
              {/* Mentalidade */}
              <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  Mentalidade do Time
                </h2>
                
                <div className="grid grid-cols-5 gap-3">
                  {(Object.keys(MENTALITY_INFO) as Array<keyof typeof MENTALITY_INFO>).map((key) => {
                    const info = MENTALITY_INFO[key]
                    const isActive = teamTactics.mentality === key
                    return (
                      <button
                        key={key}
                        onClick={() => setTeamTactics({ mentality: key as TeamTactics["mentality"] })}
                        className={cn(
                          "p-4 rounded-lg border transition-all text-center",
                          isActive
                            ? "bg-primary/20 border-primary"
                            : "bg-white/5 border-white/10 hover:border-white/20"
                        )}
                      >
                        <div className={cn("text-sm font-bold mb-1", info.color)}>
                          {info.label}
                        </div>
                        <div className="text-xs text-white/50">{info.desc}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Estilo de Jogo */}
              <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Estilo de Jogo
                </h2>
                
                <div className="grid grid-cols-5 gap-3">
                  {(Object.keys(STYLE_INFO) as Array<keyof typeof STYLE_INFO>).map((key) => {
                    const info = STYLE_INFO[key]
                    const isActive = teamTactics.playingStyle === key
                    return (
                      <button
                        key={key}
                        onClick={() => setTeamTactics({ playingStyle: key as TeamTactics["playingStyle"] })}
                        className={cn(
                          "p-4 rounded-lg border transition-all text-center",
                          isActive
                            ? "bg-primary/20 border-primary"
                            : "bg-white/5 border-white/10 hover:border-white/20"
                        )}
                      >
                        <div className="text-sm font-bold mb-1 text-white">{info.label}</div>
                        <div className="text-xs text-white/50">{info.desc}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Uma escalação, três organizações: o XI não muda, só os espaços
                  ocupados em cada momento do jogo. */}
              <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.08] to-white/[0.02] p-6">
                <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                  <RotateCcw className="h-5 w-5 text-primary" />
                  Forma Tática Dinâmica
                </h2>
                <p className="mt-1 text-sm text-white/50">
                  O time se reorganiza automaticamente na saída, ao controlar a bola e depois de perdê-la.
                </p>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {([
                    ["buildUpFormation", "Construção", "Reposição do goleiro e saída curta", gameEngine.formation ?? "4-3-3"],
                    ["inPossessionFormation", "Ataque", "Posse estabelecida no campo rival", "2-3-5"],
                    ["outOfPossessionFormation", "Defesa", "Perda da bola e bloco organizado", "4-4-2"],
                  ] as const).map(([field, title, description, fallback]) => (
                    <label key={field} className="rounded-lg border border-white/10 bg-black/20 p-4">
                      <span className="block text-sm font-bold text-white">{title}</span>
                      <span className="mt-0.5 block min-h-8 text-[11px] leading-4 text-white/40">{description}</span>
                      <select
                        value={teamTactics[field] ?? fallback}
                        onChange={event => setTeamTactics({ [field]: event.target.value })}
                        className="mt-3 w-full rounded-lg border border-white/10 bg-[#12131a] px-3 py-2 text-sm font-black text-white"
                      >
                        {PHASE_FORMATIONS.map(formation => <option key={formation}>{formation}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              </div>

              {/* Resumo Visual */}
              <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Gauge className="h-5 w-5 text-primary" />
                  Resumo Tatico
                </h2>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-white/5 rounded-lg">
                    <div className="text-2xl font-bold text-primary">
                      {teamTactics.mentality === "muito_ofensivo" ? "90%" : 
                       teamTactics.mentality === "ofensivo" ? "70%" :
                       teamTactics.mentality === "equilibrado" ? "50%" :
                       teamTactics.mentality === "defensivo" ? "30%" : "15%"}
                    </div>
                    <div className="text-xs text-white/50">Foco Ofensivo</div>
                  </div>
                  <div className="text-center p-4 bg-white/5 rounded-lg">
                    <div className="text-2xl font-bold text-cyan-400">
                      {teamTactics.pressingIntensity === "muito_alta" ? "95%" : 
                       teamTactics.pressingIntensity === "alta" ? "75%" :
                       teamTactics.pressingIntensity === "media" ? "50%" : "25%"}
                    </div>
                    <div className="text-xs text-white/50">Intensidade Pressao</div>
                  </div>
                  <div className="text-center p-4 bg-white/5 rounded-lg">
                    <div className="text-2xl font-bold text-green-400">
                      {teamTactics.playingStyle === "posse_bola" ? "Alta" : 
                       teamTactics.playingStyle === "jogo_posicional" ? "Media-Alta" :
                       teamTactics.playingStyle === "contra_ataque" ? "Baixa" : "Media"}
                    </div>
                    <div className="text-xs text-white/50">Posse Esperada</div>
                  </div>
                  <div className="text-center p-4 bg-white/5 rounded-lg">
                    <div className="text-2xl font-bold text-orange-400">
                      {teamTactics.tempo === "rapido" ? "Alto" : 
                       teamTactics.tempo === "normal" ? "Medio" : "Baixo"}
                    </div>
                    <div className="text-xs text-white/50">Ritmo de Jogo</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "comBola" && (
            <motion.div
              key="comBola"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid md:grid-cols-2 gap-6"
            >
              {/* Construcao */}
              <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-6">
                <h2 className="text-lg font-bold text-white mb-4">Construcao de Jogadas</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-white/70 mb-2 block">Estilo de Passe</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["curto", "misto", "direto"] as const).map(opt => (
                        <button
                          key={opt}
                          onClick={() => setTeamTactics({ passingStyle: opt })}
                          className={cn(
                            "py-2 px-3 rounded-lg text-sm font-medium transition-all",
                            teamTactics.passingStyle === opt
                              ? "bg-primary text-white"
                              : "bg-white/10 text-white/70 hover:bg-white/15"
                          )}
                        >
                          {opt.charAt(0).toUpperCase() + opt.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm text-white/70 mb-2 block">Saida de Bola</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["curto", "misto", "longo"] as const).map(opt => (
                        <button
                          key={opt}
                          onClick={() => setTeamTactics({ buildUp: opt })}
                          className={cn(
                            "py-2 px-3 rounded-lg text-sm font-medium transition-all",
                            teamTactics.buildUp === opt
                              ? "bg-primary text-white"
                              : "bg-white/10 text-white/70 hover:bg-white/15"
                          )}
                        >
                          {opt.charAt(0).toUpperCase() + opt.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm text-white/70 mb-2 block">Ritmo</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["lento", "normal", "rapido"] as const).map(opt => (
                        <button
                          key={opt}
                          onClick={() => setTeamTactics({ tempo: opt })}
                          className={cn(
                            "py-2 px-3 rounded-lg text-sm font-medium transition-all",
                            teamTactics.tempo === opt
                              ? "bg-primary text-white"
                              : "bg-white/10 text-white/70 hover:bg-white/15"
                          )}
                        >
                          {opt.charAt(0).toUpperCase() + opt.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Finalizacao */}
              <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-6">
                <h2 className="text-lg font-bold text-white mb-4">Finalizacao</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-white/70 mb-2 block">Criacao de Chances</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["largura", "centro", "misto"] as const).map(opt => (
                        <button
                          key={opt}
                          onClick={() => setTeamTactics({ chanceCreation: opt })}
                          className={cn(
                            "py-2 px-3 rounded-lg text-sm font-medium transition-all",
                            teamTactics.chanceCreation === opt
                              ? "bg-primary text-white"
                              : "bg-white/10 text-white/70 hover:bg-white/15"
                          )}
                        >
                          {opt === "largura" ? "Pelas Laterais" : opt === "centro" ? "Pelo Centro" : "Misto"}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm text-white/70 mb-2 block">Cruzamentos</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["baixo", "misto", "alto"] as const).map(opt => (
                        <button
                          key={opt}
                          onClick={() => setTeamTactics({ crossingStyle: opt })}
                          className={cn(
                            "py-2 px-3 rounded-lg text-sm font-medium transition-all",
                            teamTactics.crossingStyle === opt
                              ? "bg-primary text-white"
                              : "bg-white/10 text-white/70 hover:bg-white/15"
                          )}
                        >
                          {opt === "baixo" ? "Rasteiros" : opt === "alto" ? "Na Area" : "Misto"}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={teamTactics.shootFromDistance}
                        onChange={(e) => setTeamTactics({ shootFromDistance: e.target.checked })}
                        className="w-4 h-4 rounded border-white/20 bg-white/10 text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-white/80">Chutar de Fora da Area</span>
                    </label>
                    
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={teamTactics.playThroughBalls}
                        onChange={(e) => setTeamTactics({ playThroughBalls: e.target.checked })}
                        className="w-4 h-4 rounded border-white/20 bg-white/10 text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-white/80">Bolas Entrelinha</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Transicoes */}
              <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-6 md:col-span-2">
                <h2 className="text-lg font-bold text-white mb-4">Transicoes</h2>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <label className="flex items-center gap-3 p-3 bg-white/5 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={teamTactics.counterAttack}
                      onChange={(e) => setTeamTactics({ counterAttack: e.target.checked })}
                      className="w-4 h-4 rounded border-white/20 bg-white/10 text-primary focus:ring-primary"
                    />
                    <div>
                      <div className="text-sm font-medium text-white">Contra-Ataque</div>
                      <div className="text-xs text-white/50">Transicao rapida ao recuperar</div>
                    </div>
                  </label>
                  
                  <label className="flex items-center gap-3 p-3 bg-white/5 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={teamTactics.holdPosition}
                      onChange={(e) => setTeamTactics({ holdPosition: e.target.checked })}
                      className="w-4 h-4 rounded border-white/20 bg-white/10 text-primary focus:ring-primary"
                    />
                    <div>
                      <div className="text-sm font-medium text-white">Manter Posição</div>
                      <div className="text-xs text-white/50">Jogadores ficam em suas zonas</div>
                    </div>
                  </label>
                  
                  <label className="flex items-center gap-3 p-3 bg-white/5 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={teamTactics.counterPress}
                      onChange={(e) => setTeamTactics({ counterPress: e.target.checked })}
                      className="w-4 h-4 rounded border-white/20 bg-white/10 text-primary focus:ring-primary"
                    />
                    <div>
                      <div className="text-sm font-medium text-white">Counter-Press</div>
                      <div className="text-xs text-white/50">Pressao imediata ao perder a bola</div>
                    </div>
                  </label>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "semBola" && (
            <motion.div
              key="semBola"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid md:grid-cols-2 gap-6"
            >
              {/* Linha Defensiva */}
              <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-6">
                <h2 className="text-lg font-bold text-white mb-4">Posicionamento Defensivo</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-white/70 mb-2 block">Altura da Linha Defensiva</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["baixa", "media", "alta"] as const).map(opt => (
                        <button
                          key={opt}
                          onClick={() => setTeamTactics({ defensiveLine: opt })}
                          className={cn(
                            "py-2 px-3 rounded-lg text-sm font-medium transition-all",
                            teamTactics.defensiveLine === opt
                              ? "bg-primary text-white"
                              : "bg-white/10 text-white/70 hover:bg-white/15"
                          )}
                        >
                          {opt.charAt(0).toUpperCase() + opt.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm text-white/70 mb-2 block">Tipo de Marcacao</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["zonal", "individual", "misto"] as const).map(opt => (
                        <button
                          key={opt}
                          onClick={() => setTeamTactics({ markingStyle: opt })}
                          className={cn(
                            "py-2 px-3 rounded-lg text-sm font-medium transition-all",
                            teamTactics.markingStyle === opt
                              ? "bg-primary text-white"
                              : "bg-white/10 text-white/70 hover:bg-white/15"
                          )}
                        >
                          {opt.charAt(0).toUpperCase() + opt.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={teamTactics.offsideTrap}
                      onChange={(e) => setTeamTactics({ offsideTrap: e.target.checked })}
                      className="w-4 h-4 rounded border-white/20 bg-white/10 text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-white/80">Armadilha de Impedimento</span>
                  </label>
                </div>
              </div>

              {/* Pressao */}
              <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-6">
                <h2 className="text-lg font-bold text-white mb-4">Pressao</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-white/70 mb-2 block">Intensidade da Pressao</label>
                    <div className="grid grid-cols-4 gap-2">
                      {(["baixa", "media", "alta", "muito_alta"] as const).map(opt => (
                        <button
                          key={opt}
                          onClick={() => setTeamTactics({ pressingIntensity: opt })}
                          className={cn(
                            "py-2 px-3 rounded-lg text-sm font-medium transition-all",
                            teamTactics.pressingIntensity === opt
                              ? "bg-primary text-white"
                              : "bg-white/10 text-white/70 hover:bg-white/15"
                          )}
                        >
                          {opt === "muito_alta" ? "Muito Alta" : opt.charAt(0).toUpperCase() + opt.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="p-4 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-[#ffd700]" />
                      <span className="text-sm font-medium text-white">Impacto no Stamina</span>
                    </div>
                    <div className="text-xs text-white/60">
                      Pressao alta consome mais energia dos jogadores. Use com cuidado em jogos seguidos.
                    </div>
                    <div className="mt-2">
                      <Progress 
                        value={
                          teamTactics.pressingIntensity === "muito_alta" ? 100 :
                          teamTactics.pressingIntensity === "alta" ? 75 :
                          teamTactics.pressingIntensity === "media" ? 50 : 25
                        } 
                        className="h-2"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "bolaParada" && (
            <motion.div
              key="bolaParada"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="rounded-xl border border-white/10 bg-[#0c0c10] p-5">
                <h3 className="text-lg font-bold text-white">Cobradores designados</h3>
                <p className="mt-1 text-sm text-white/50">
                  Sem escolha definida, o motor sorteia um jogador da posição a cada lance — o
                  especialista do elenco batia por acaso. Quem for designado e estiver em campo cobra.
                </p>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {([
                    ["freeKick", "Faltas", "Chute e passe pesam mais"],
                    ["corner", "Escanteios", "Passe define a qualidade do cruzamento"],
                    ["penalty", "Pênaltis", "Sugestão inicial no modal da partida"],
                  ] as const).map(([tipo, titulo, dica]) => (
                    <div key={tipo} className="rounded-lg border border-white/[0.06] bg-black/25 p-4">
                      <p className="text-sm font-semibold text-white">{titulo}</p>
                      <p className="mt-0.5 text-[11px] leading-4 text-white/40">{dica}</p>
                      <select
                        value={setPieceTakers?.[tipo] ?? ""}
                        onChange={event => setSetPieceTaker(tipo, event.target.value || null)}
                        className="mt-3 w-full rounded-lg border border-white/10 bg-[#12131a] px-3 py-2 text-xs text-white"
                      >
                        <option value="">Deixar o motor escolher</option>
                        {[...squadPlayers]
                          .sort((a, b) => b.overall - a.overall)
                          .map(player => (
                            <option key={player.id} value={player.name}>
                              {player.name} · {player.position} · {player.overall}
                            </option>
                          ))}
                      </select>
                    </div>
                  ))}
                </div>

                <p className="mt-4 text-[11px] leading-4 text-white/35">
                  Vale apenas para o seu time. Se o designado não estiver em campo no momento da
                  cobrança, o motor escolhe um substituto pela posição.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0c0c10] p-5">
                <h3 className="text-lg font-bold text-white">Defesa de lançamentos laterais</h3>
                <p className="mt-1 text-sm text-white/50">
                  Define como os defensores ocupam a primeira bola, a linha de fundo e a sobra, evitando marcações automáticas amontoadas.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {([
                    ["zona", "Zona compacta", "Protege área e segunda bola"],
                    ["mista", "Mista", "Dois encaixes e cobertura por zona"],
                    ["individual", "Individual", "Persegue os alvos mais perigosos"],
                  ] as const).map(([shape, label, hint]) => (
                    <button key={shape} type="button" onClick={() => setTeamTactics({ defensiveThrowInShape: shape })}
                      className={cn("rounded-lg border p-4 text-left transition-colors", (teamTactics.defensiveThrowInShape ?? "mista") === shape ? "border-primary bg-primary/15" : "border-white/10 bg-white/[0.03] hover:border-white/25")}>
                      <span className="block text-sm font-bold text-white">{label}</span>
                      <span className="mt-1 block text-xs text-white/45">{hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "instrucoes" && (
            <motion.div
              key="instrucoes"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid md:grid-cols-3 gap-6"
            >
              {/* Lista de Jogadores */}
              <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-4">
                <h2 className="text-lg font-bold text-white mb-4">Jogadores</h2>
                
                <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin">
                  {squadPlayers.map(player => {
                    const hasInstructions = !!playerInstructions[player.id]
                    return (
                      <button
                        key={player.id}
                        onClick={() => setSelectedPlayerId(player.id)}
                        className={cn(
                          "w-full p-3 rounded-lg text-left transition-all flex items-center gap-3",
                          selectedPlayerId === player.id
                            ? "bg-primary/20 border border-primary"
                            : "bg-white/5 border border-transparent hover:bg-white/10"
                        )}
                      >
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white">
                          {player.position}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">{player.name}</div>
                          <div className="text-xs text-white/50">OVR {player.overall}</div>
                        </div>
                        {hasInstructions && (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Instrucoes do Jogador */}
              <div className="md:col-span-2 bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-6">
                {selectedPlayer ? (
                  <>
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <Settings className="h-5 w-5 text-primary" />
                      Instrucoes: {selectedPlayer.name}
                    </h2>
                    
                    <div className="grid gap-6">
                      {/* FUNCAO POR FASE.
                          Posicao, funcao e fase sao tres coisas: o mesmo PD pode
                          ser ponta invertido com a bola e lateral sem ela. A aba
                          "sem a bola" so grava `roleSemBola` quando o tecnico
                          escolhe algo DIFERENTE — deixar as duas iguais devolve
                          exatamente o comportamento antigo. Ver
                          lib/forcas-individuais.ts. */}
                      <div>
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <label className="text-sm text-white/70">Funcao no Time</label>
                          <div className="ml-auto flex gap-1 rounded-lg bg-black/30 p-1">
                            {([["com", "Com a bola"], ["sem", "Sem a bola"]] as const).map(([id, rotulo]) => (
                              <button
                                key={id}
                                onClick={() => setFaseDaFuncao(id)}
                                className={cn(
                                  "rounded-md px-3 py-1 text-xs font-bold transition-all",
                                  faseDaFuncao === id ? "bg-primary text-white" : "text-white/50 hover:text-white/80",
                                )}
                              >
                                {rotulo}
                              </button>
                            ))}
                          </div>
                        </div>
                        {faseDaFuncao === "sem" && (
                          <p className="mb-2 text-xs text-white/45">
                            Sem escolha propria, ele defende na mesma funcao que exerce com a bola.
                            {currentPlayerInstructions?.roleSemBola && (
                              <button
                                onClick={() => setPlayerInstructions(selectedPlayer.id, { roleSemBola: undefined })}
                                className="ml-2 font-bold text-primary underline"
                              >
                                usar a mesma
                              </button>
                            )}
                          </p>
                        )}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[200px] overflow-y-auto scrollbar-thin">
                          {Object.entries(ROLE_INFO)
                            .filter(([_, info]) => info.positions.includes(selectedPlayer.position))
                            .map(([key, info]) => {
                              const ativa = faseDaFuncao === "com"
                                ? currentPlayerInstructions?.role === key
                                : (currentPlayerInstructions?.roleSemBola ?? currentPlayerInstructions?.role) === key
                              // ADEQUACAO A FUNCAO, em estrelas. E a MESMA conta
                              // que o motor faz (`adequacaoAFuncao`, -2 a +2), so
                              // que visivel ANTES de escalar. Sem ela o tecnico
                              // escolhia entre 66 nomes sem nenhuma pista de qual
                              // servia ao atleta que estava na mao.
                              const encaixe = adequacaoAFuncao(selectedPlayer, key as PlayerRole)
                              const estrelas = Math.max(1, Math.min(5, Math.round(3 + encaixe)))
                              return (
                                <button
                                  key={key}
                                  onClick={() => setPlayerInstructions(selectedPlayer.id, faseDaFuncao === "com"
                                    ? { role: key as PlayerRole }
                                    : { roleSemBola: key as PlayerRole })}
                                  className={cn(
                                    "p-3 rounded-lg text-left transition-all",
                                    ativa
                                      ? "bg-primary/20 border border-primary"
                                      : "bg-white/5 border border-white/10 hover:border-white/20"
                                  )}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="text-sm font-medium text-white">{info.label}</div>
                                    <span
                                      title={`Adequação ${encaixe > 0 ? "+" : ""}${encaixe} — os atributos dele servem a esta função?`}
                                      className={cn(
                                        "shrink-0 text-[10px] tracking-tight",
                                        estrelas >= 4 ? "text-emerald-300" : estrelas <= 2 ? "text-red-300" : "text-white/40",
                                      )}
                                    >
                                      {"★".repeat(estrelas)}<span className="text-white/15">{"★".repeat(5 - estrelas)}</span>
                                    </span>
                                  </div>
                                  <div className="text-xs text-white/50 mt-1">{info.desc}</div>
                                </button>
                              )
                            })}
                        </div>
                      </div>

                      {/* Outras instrucoes */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-white/70 mb-2 block">Movimentacao</label>
                          <div className="space-y-2">
                            {(["ficar_posicao", "liberdade_moderada", "liberdade_total"] as const).map(opt => (
                              <button
                                key={opt}
                                onClick={() => setPlayerInstructions(selectedPlayer.id, { roaming: opt })}
                                className={cn(
                                  "w-full py-2 px-3 rounded-lg text-sm text-left transition-all",
                                  currentPlayerInstructions?.roaming === opt
                                    ? "bg-primary text-white"
                                    : "bg-white/10 text-white/70 hover:bg-white/15"
                                )}
                              >
                                {opt === "ficar_posicao" ? "Ficar na Posição" :
                                 opt === "liberdade_moderada" ? "Liberdade Moderada" : "Liberdade Total"}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-sm text-white/70 mb-2 block">Projecoes</label>
                          <div className="space-y-2">
                            {(["raramente", "as_vezes", "frequentemente"] as const).map(opt => (
                              <button
                                key={opt}
                                onClick={() => setPlayerInstructions(selectedPlayer.id, { runs: opt })}
                                className={cn(
                                  "w-full py-2 px-3 rounded-lg text-sm text-left transition-all",
                                  currentPlayerInstructions?.runs === opt
                                    ? "bg-primary text-white"
                                    : "bg-white/10 text-white/70 hover:bg-white/15"
                                )}
                              >
                                {opt === "raramente" ? "Raramente" :
                                 opt === "as_vezes" ? "As Vezes" : "Frequentemente"}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Checkboxes */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { key: "stayWider", label: "Abrir na Lateral" },
                          { key: "cutInside", label: "Cortar para Dentro" },
                          { key: "getForward", label: "Chegar na Area" },
                          { key: "holdPosition", label: "Manter Posição" },
                        ].map(({ key, label }) => (
                          <label key={key} className="flex items-center gap-2 cursor-pointer p-3 bg-white/5 rounded-lg">
                            <input
                              type="checkbox"
                              checked={currentPlayerInstructions?.[key as keyof PlayerInstructions] as boolean || false}
                              onChange={(e) => setPlayerInstructions(selectedPlayer.id, { [key]: e.target.checked })}
                              className="w-4 h-4 rounded border-white/20 bg-white/10 text-primary focus:ring-primary"
                            />
                            <span className="text-xs text-white/80">{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                    <Users className="h-12 w-12 text-white/20 mb-4" />
                    <p className="text-white/50">Selecione um jogador para configurar instrucoes individuais</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "adversario" && (
            <motion.div
              key="adversario"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid items-start gap-3 xl:grid-cols-2"
            >
              <div className="bg-gradient-to-br from-white/5 to-white/[0.02] rounded-xl border border-white/10 p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" />
                  Analise de Adversarios
                </h2>
                
                <p className="text-sm text-white/60 mb-6">
                  Use seus olheiros para analisar os proximos adversarios e descobrir suas fraquezas.
                </p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {gameEngine.opponentAnalyses.length > 0 ? (
                    gameEngine.opponentAnalyses.map(analysis => (
                      <div key={analysis.teamShort} className="p-4 bg-white/5 rounded-lg">
                        <div className="font-bold text-white mb-2">{analysis.teamName}</div>
                        <Progress value={analysis.analysisProgress} className="h-2 mb-2" />
                        <div className="text-xs text-white/50">{analysis.analysisProgress}% analisado</div>
                        {analysis.formation && (
                          <div className="mt-2 text-xs text-primary">Formacao: {analysis.formation}</div>
                        )}
                        {analysis.weaknesses.length > 0 && (
                          <div className="mt-2 text-xs text-green-400">
                            Fraqueza: {analysis.weaknesses[0]}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-8 text-white/40">
                      Nenhum adversario analisado ainda. Envie olheiros para analisar seus proximos oponentes.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}

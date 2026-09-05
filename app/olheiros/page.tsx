"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { GameHeader } from "@/components/game-header"
import { Button } from "@/components/ui/button"
import { useGameManager } from "@/lib/use-game-manager"
import { cn } from "@/lib/utils"
import {
  Search,
  Globe,
  Star,
  MapPin,
  Clock,
  Users,
  DollarSign,
  Plus,
  Play,
  Pause,
  Eye,
  EyeOff,
  TrendingUp,
  Award,
  ChevronRight,
  Plane,
  Target,
  UserPlus,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  X,
  Landmark,
  Compass,
  UserMinus
} from "lucide-react"
import type { Scout } from "@/lib/game-engine"
import { useGameState } from "@/lib/save-system"
import { getTeamByShort } from "@/lib/teams-data"
import { aiTacticForClub, cargaDaTatica } from "@/lib/tactics-engine"
import { estiloDoAdversario } from "@/lib/plano-contra-o-adversario"
import { createScoutingDepartment, createScoutMission, departmentReputationLabel, departmentScoutSeverance, fireDepartmentScout, generatePerformanceAnalysis, hireDepartmentScout, type EntradaDaAnalise, type ScoutMissionType, type ScoutTier } from "@/lib/scout-engine"
import { formatCurrency } from "@/lib/currency"
import { calcularFama, faixaDeOverall } from "@/lib/player-fame"

/**
 * A FAMA DE UM ATLETA DESCOBERTO POR OLHEIRO.
 *
 * `lib/player-fame` foi escrito para um pedido de jogador ("um Mbappe ou um
 * Yamal, por serem famosos, voce ja conhece") e ficou sem um unico chamador —
 * o proprio `lib/prestigio-do-atleta` registra o caso. Aqui ele entra: quem o
 * mundo ja conhece nao precisa de relatorio pago; o olheiro passa a servir para
 * o que e realmente desconhecido.
 *
 * Observado nao tem clube na ficha, entao a fama sai de overall e idade.
 */
const famaDoLead = (atleta: { overall: number; age: number }) =>
  calcularFama({ overall: atleta.overall, age: atleta.age })

// Regioes disponiveis para scouting
const SCOUTING_REGIONS = [
  { 
    id: "brasil", 
    name: "Brasil", 
    icon: MapPin, 
    searchCost: 50000, 
    weeksToComplete: 2,
    description: "Promessas das series A, B e C",
    avgPlayerValue: "500K - 5M"
  },
  { 
    id: "americas", 
    name: "Americas", 
    icon: Globe, 
    searchCost: 150000, 
    weeksToComplete: 3,
    description: "Argentina, Colombia, Mexico, EUA",
    avgPlayerValue: "1M - 10M"
  },
  { 
    id: "europa", 
    name: "Europa", 
    icon: Landmark, 
    searchCost: 300000, 
    weeksToComplete: 4,
    description: "Ligas europeias menores e jovens",
    avgPlayerValue: "2M - 20M"
  },
  { 
    id: "asia", 
    name: "Asia/Africa", 
    icon: Compass, 
    searchCost: 100000, 
    weeksToComplete: 3,
    description: "Mercados emergentes",
    avgPlayerValue: "200K - 3M"
  },
]

// Olheiros disponiveis para contratar
const AVAILABLE_SCOUTS: Omit<Scout, "id" | "isSearching" | "searchProgress" | "foundPlayers">[] = [
  { name: "Carlos Mendes", region: "Brasil", skill: 4, salary: 25000, weeksToComplete: 0, searchCost: 0 },
  { name: "Ricardo Alves", region: "Brasil", skill: 3, salary: 18000, weeksToComplete: 0, searchCost: 0 },
  { name: "Juan Martinez", region: "Americas", skill: 4, salary: 35000, weeksToComplete: 0, searchCost: 0 },
  { name: "Diego Fernandez", region: "Americas", skill: 3, salary: 28000, weeksToComplete: 0, searchCost: 0 },
  { name: "Pierre Dubois", region: "Europa", skill: 5, salary: 60000, weeksToComplete: 0, searchCost: 0 },
  { name: "Hans Mueller", region: "Europa", skill: 4, salary: 45000, weeksToComplete: 0, searchCost: 0 },
  { name: "Kenji Tanaka", region: "Asia", skill: 3, salary: 22000, weeksToComplete: 0, searchCost: 0 },
  { name: "Ahmed Hassan", region: "Asia", skill: 4, salary: 30000, weeksToComplete: 0, searchCost: 0 },
]

export default function OlheirosPage() {
  const router = useRouter()

  // Gamepad support
  useEffect(() => {
    const handler = (e: Event) => {
      const btn = (e as CustomEvent).detail?.button
      if (btn === 'B') router.back()
    }
    window.addEventListener('gamepad:button', handler)
    return () => window.removeEventListener('gamepad:button', handler)
  }, [router])
  const { gameEngine, userTeam } = useGameManager()
  const { state: saveState, setState: setSaveState } = useGameState()
  const department = saveState.scoutingDepartment ?? createScoutingDepartment()
  const [activeTab, setActiveTab] = useState<"meus_olheiros" | "contratar" | "descobertos">("meus_olheiros")
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [showHireModal, setShowHireModal] = useState(false)
  const [selectedScoutToHire, setSelectedScoutToHire] = useState<typeof AVAILABLE_SCOUTS[0] | null>(null)
  // DEMISSÃO: `gameEngine.fireScout` existia desde sempre e NENHUMA tela o
  // chamava — não havia como dispensar um olheiro. Contratar era definitivo.
  const [scoutParaDemitir, setScoutParaDemitir] = useState<Scout | null>(null)
  const [avisoOlheiros, setAvisoOlheiros] = useState("")

  // Olheiros contratados e talentos descobertos vem do game-engine (persistidos no save),
  // nao mais de uma lista fixa. Comecam vazios: voce contrata olheiros e os envia buscar.
  const myScouts = gameEngine.scouts
  const discoveredPlayers = gameEngine.scoutedLeads

  const handleHireScout = (scout: typeof AVAILABLE_SCOUTS[0]) => {
    gameEngine.hireScout({
      id: Date.now(),
      ...scout,
      isSearching: false,
      searchProgress: 0,
      foundPlayers: [],
    })
    setShowHireModal(false)
    setSelectedScoutToHire(null)
  }

  const handleStartSearch = (scoutId: number, regionId: string) => {
    const region = SCOUTING_REGIONS.find(r => r.id === regionId)
    if (!region) return
    gameEngine.startScoutSearch(scoutId, region.name, region.weeksToComplete, region.searchCost)
    setSelectedRegion(null)
  }

  const handleStopSearch = (scoutId: number) => {
    gameEngine.stopScoutSearch(scoutId)
  }

  /** Confirma a demissão: paga a rescisão e tira o olheiro da folha. */
  const confirmarDemissao = () => {
    const alvo = scoutParaDemitir
    if (!alvo) return
    // Busca em andamento morre com ele — encerra antes para não deixar a
    // expedição órfã no save.
    if (alvo.isSearching) gameEngine.stopScoutSearch(alvo.id)
    const custo = gameEngine.fireScout(alvo.id)
    setScoutParaDemitir(null)
    setAvisoOlheiros(
      `${alvo.name} foi demitido. Rescisão de ${formatCurrency(custo)} paga` +
      `${alvo.isSearching ? " e a busca em andamento foi cancelada" : ""}.`,
    )
  }

  const demitirScoutEstrategico = (scoutId: string) => {
    const alvo = department.scouts.find(s => s.id === scoutId)
    if (!alvo) return
    const custo = departmentScoutSeverance(alvo)
    gameEngine.addClubExpense(custo)
    setSaveState({ scoutingDepartment: fireDepartmentScout(department, scoutId) })
    setAvisoOlheiros(`${alvo.name} saiu do departamento. Rescisão de ${formatCurrency(custo)}.`)
  }

  const hireStrategicScout = (tier:ScoutTier) => {
    const level={regional:58,national:70,continental:82,elite_global:94}[tier]
    const scout={id:`dept-${Date.now()}`,name:tier==="elite_global"?"Diretor de Scouting Global":"Analista de Mercado",tier,monthlySalary:Math.round(level*1800),attributes:{currentAbility:level,potentialAbility:Math.min(99,level+3),youthDiscovery:Math.min(99,level+5),marketKnowledge:level,negotiation:Math.max(45,level-4)}}
    setSaveState({scoutingDepartment:hireDepartmentScout(department,scout)})
  }
  const assignStrategicMission = (type:ScoutMissionType) => {
    const scout=department.scouts.find(item=>!item.missionId);if(!scout)return
    setSaveState({scoutingDepartment:createScoutMission(department,{id:`mission-${Date.now()}`,scoutId:scout.id,type,region:scout.tier==="regional"?"Brasil":"Mundo",ageMin:type==="young"?15:undefined,ageMax:type==="young"?20:undefined,startedWeek:gameEngine.currentWeek,durationWeeks:Math.max(2,7-department.observationCentreLevel),progressWeeks:0,status:"active"})})
  }
  /**
   * A ANÁLISE DO CENTRO DE DADOS.
   *
   * ⚠️ Até a 1.0.382 este botão gravava TEXTO CHUMBADO: as mesmas frases
   * ("Monitore a fadiga dos laterais") para qualquer elenco, qualquer
   * adversário, qualquer temporada — e o nível do centro de dados só CORTAVA a
   * lista fixa. Agora cada linha sai de um número do save, e o adversário é
   * lido pela mesma régua que a preparação e a partida usam (`cargaDaTatica` →
   * `estiloDoAdversario`): um relatório que enxergasse um time diferente do que
   * entra em campo seria pior que relatório nenhum.
   */
  const analyzePerformance = () => {
    const proxima = saveState.fixtures?.find(f => !f.played && f.isUserMatch)
    const rivalCurto = proxima
      ? (proxima.homeCurto === saveState.selectedTeamShort ? proxima.awayCurto : proxima.homeCurto)
      : null
    const rival = rivalCurto ? getTeamByShort(rivalCurto) : null
    let adversario: EntradaDaAnalise["adversario"] = null
    if (rival) {
      const carga = cargaDaTatica(aiTacticForClub(rival.curto))
      adversario = {
        nome: rival.nome,
        estilo: estiloDoAdversario({
          pressao: carga.pressingLoad,
          transicao: carga.transitionLoad,
          mentalidade: saveState.posturasDaIA?.[rival.curto] ?? "equilibrado",
        }),
        dossie: gameEngine.opponentAnalyses.find(a => a.teamShort === rival.curto)?.analysisProgress ?? 0,
      }
    }
    setSaveState({ scoutingDepartment: { ...department, lastAnalysis: generatePerformanceAnalysis({
      week: gameEngine.currentWeek,
      season: gameEngine.currentSeason,
      dataLevel: department.dataCentreLevel,
      elenco: gameEngine.squadPlayers.map(p => ({
        name: p.name, position: p.position, age: p.age, overall: p.overall,
        energy: p.energy, form: p.form, moralePoints: p.moralePoints,
        injuryWeeks: p.injury?.weeksRemaining ?? 0,
        seasonYellows: p.seasonYellows,
        // `contract.endDate` é semana absoluta; a análise pensa em temporada.
        // A conversão é a mesma que `app/performance` já usa.
        contractEndSeason: p.contract
          ? gameEngine.currentSeason + Math.floor(Math.max(0, p.contract.endDate - gameEngine.currentWeek) / 52)
          : undefined,
      })),
      adversario,
    }) } })
  }

  const tabs = [
    { id: "meus_olheiros", label: "Meus Olheiros", icon: Users },
    { id: "contratar", label: "Contratar", icon: UserPlus },
    { id: "descobertos", label: "Descobertos", icon: Eye },
  ]

  return (
    <div className="flex h-screen flex-col overflow-hidden md:pl-0 pl-0 pb-20 md:pb-0 bg-transparent">
      <GameHeader team={userTeam ?? undefined} />

      <main className="flex min-h-0 flex-1 flex-col">
        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 py-3 border-b border-white/[0.04] bg-[#0d0d0d]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-[var(--brand)]/20 text-[var(--brand)]"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.id === "descobertos" && discoveredPlayers.length + department.reports.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[var(--brand)] text-[var(--brand-ink)] text-[10px] font-bold">
                  {discoveredPlayers.length + department.reports.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-game">
          <section className="mb-4 rounded-xl border border-[var(--brand)]/15 bg-[var(--brand)]/[0.04] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-wider text-[var(--brand)]">Departamento estratégico · {departmentReputationLabel(department.reputation)}</div><p className="mt-1 text-xs text-white/45">Centro de Observação Nv. {department.observationCentreLevel} · Centro de Dados Nv. {department.dataCentreLevel} · custo mensal {formatCurrency(department.monthlyCost)}</p></div><div className="flex flex-wrap gap-2"><button onClick={()=>hireStrategicScout(department.scouts.length<1?"regional":department.scouts.length<3?"national":"continental")} className="rounded-lg bg-[var(--brand)] px-3 py-2 text-[10px] font-bold text-[var(--brand-ink)]">Contratar scout por nível</button><button onClick={()=>assignStrategicMission("young")} disabled={!department.scouts.some(s=>!s.missionId)} className="rounded-lg border border-white/15 px-3 py-2 text-[10px] text-white disabled:opacity-30">Missão: jovens 15–20</button><button onClick={()=>assignStrategicMission("expiring")} disabled={!department.scouts.some(s=>!s.missionId)} className="rounded-lg border border-white/15 px-3 py-2 text-[10px] text-white disabled:opacity-30">Fim de contrato</button><button onClick={analyzePerformance} className="rounded-lg border border-violet-400/30 px-3 py-2 text-[10px] text-violet-300">Analisar elenco/adversário</button></div></div>
            {/* QUEM ESTÁ NO DEPARTAMENTO — e como tirar alguém dele.
                Antes só existia o botão de contratar: os scouts contratados por
                nível não apareciam em lugar nenhum e o custo mensal só subia. */}
            {department.scouts.length > 0 && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {department.scouts.map(s => (
                  <div key={s.id} className="flex items-center gap-2 rounded-lg bg-black/30 p-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-white">{s.name}</p>
                      <p className="text-[10px] text-white/40">
                        {s.tier.replace("_", " ")} · {formatCurrency(s.monthlySalary)}/mês
                        {s.missionId ? " · em missão" : " · livre"}
                        {/* Missão encerrada sem ninguém no perfil pedido. Antes desta
                            versão o departamento inventava um atleta em vez de dizer
                            isto — ver `ScoutMission.semAchados`. */}
                        {!s.missionId && department.missions.some(m => m.scoutId === s.id && m.semAchados) && (
                          <span className="text-amber-300"> · última missão não achou ninguém no perfil</span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => demitirScoutEstrategico(s.id)}
                      title={`Demitir ${s.name} (rescisão de ${formatCurrency(departmentScoutSeverance(s))})`}
                      className="shrink-0 rounded-md border border-red-500/30 p-1.5 text-red-400 transition-colors hover:bg-red-500/10"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {avisoOlheiros && (
              <p className="mt-3 rounded-lg border border-[var(--brand)]/25 bg-[var(--brand)]/[0.06] px-3 py-2 text-[11px] text-[var(--brand)]">
                {avisoOlheiros}
              </p>
            )}
            {department.lastAnalysis&&<div className="mt-3 grid gap-2 md:grid-cols-3 text-[11px]"><div className="rounded-lg bg-black/30 p-3"><b className="text-amber-300">Alertas do elenco</b><p className="mt-1 text-white/55">{department.lastAnalysis.squadAlerts.join(" · ")}</p></div><div className="rounded-lg bg-black/30 p-3"><b className="text-red-300">Adversário</b><p className="mt-1 text-white/55">{department.lastAnalysis.opponentStrengths.join(" · ")}</p></div><div className="rounded-lg bg-black/30 p-3"><b className="text-[var(--brand)]">Recomendação</b><p className="mt-1 text-white/55">{department.lastAnalysis.tacticalRecommendations.join(" · ")}</p></div></div>}
          </section>
          <AnimatePresence mode="wait">
            {/* Meus Olheiros */}
            {activeTab === "meus_olheiros" && (
              <motion.div
                key="meus_olheiros"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {/* Stats gerais */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-4 rounded-xl bg-[#111] border border-white/[0.04]">
                    <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
                      <Users className="h-3.5 w-3.5" />
                      Olheiros Ativos
                    </div>
                    <div className="text-2xl font-bold text-white">{myScouts.length}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#111] border border-white/[0.04]">
                    <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
                      <Search className="h-3.5 w-3.5" />
                      Em Busca
                    </div>
                    <div className="text-2xl font-bold text-[var(--brand)]">{myScouts.filter(s => s.isSearching).length}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#111] border border-white/[0.04]">
                    <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
                      <Eye className="h-3.5 w-3.5" />
                      Descobertos
                    </div>
                    <div className="text-2xl font-bold text-amber-400">{discoveredPlayers.length}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#111] border border-white/[0.04]">
                    <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
                      <DollarSign className="h-3.5 w-3.5" />
                      Custo Semanal
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {formatCurrency(myScouts.reduce((acc, s) => acc + s.salary, 0))}
                    </div>
                  </div>
                </div>

                {/* Lista de olheiros */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Meus Olheiros</h2>
                    <Button
                      size="sm"
                      onClick={() => setActiveTab("contratar")}
                      className="bg-[var(--brand)] hover:bg-[var(--brand-2)] text-[var(--brand-ink)] text-xs"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Contratar Olheiro
                    </Button>
                  </div>

                  {myScouts.length === 0 ? (
                    <div className="p-8 rounded-xl bg-[#111] border border-white/[0.04] text-center">
                      <Search className="h-12 w-12 mx-auto text-white/20 mb-3" />
                      <p className="text-white/50">Voce ainda nao tem olheiros</p>
                      <p className="text-white/30 text-sm mt-1">Contrate olheiros para descobrir talentos</p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {myScouts.map((scout) => (
                        <div
                          key={scout.id}
                          className="p-4 rounded-xl bg-[#111] border border-white/[0.04] hover:border-white/10 transition-all"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                                <Briefcase className="h-5 w-5 text-white/60" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-white">{scout.name}</h3>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-xs text-white/50 flex items-center gap-1">
                                    <Globe className="h-3 w-3" />
                                    {SCOUTING_REGIONS.find(r => r.id === scout.region)?.name || scout.region}
                                  </span>
                                  <span className="text-xs text-white/50 flex items-center gap-1">
                                    <DollarSign className="h-3 w-3" />
                                    {formatCurrency(scout.salary)}/sem
                                  </span>
                                </div>
                                <div className="flex items-center gap-0.5 mt-1">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <Star
                                      key={i}
                                      className={cn(
                                        "h-3 w-3",
                                        i < scout.skill ? "text-amber-400 fill-amber-400" : "text-white/20"
                                      )}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="text-right">
                              {scout.isSearching ? (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-[var(--brand)]">
                                    <Search className="h-4 w-4 animate-pulse" />
                                    <span className="text-sm font-medium">Buscando...</span>
                                  </div>
                                  <div className="w-32 h-2 rounded-full bg-white/10 overflow-hidden">
                                    <motion.div
                                      className="h-full bg-[var(--brand)]"
                                      initial={{ width: 0 }}
                                      animate={{ width: `${scout.searchProgress}%` }}
                                      transition={{ duration: 0.5 }}
                                    />
                                  </div>
                                  <p className="text-[10px] text-white/40">
                                    {scout.weeksToComplete} semana(s) restante(s)
                                  </p>
                                  <div className="flex items-center justify-end gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleStopSearch(scout.id)}
                                      className="border-white/15 text-white/60 hover:bg-white/5 text-xs"
                                    >
                                      <Pause className="h-3 w-3 mr-1" />
                                      Parar
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setScoutParaDemitir(scout)}
                                      className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs"
                                    >
                                      <UserMinus className="h-3 w-3 mr-1" />
                                      Demitir
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-white/40">
                                    <Clock className="h-4 w-4" />
                                    <span className="text-sm">Disponivel</span>
                                  </div>
                                  <div className="flex items-center justify-end gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => setSelectedRegion(selectedRegion === scout.id.toString() ? null : scout.id.toString())}
                                      className="bg-[var(--brand)] hover:bg-[var(--brand-2)] text-[var(--brand-ink)] text-xs"
                                    >
                                      <Play className="h-3 w-3 mr-1" />
                                      Iniciar Busca
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setScoutParaDemitir(scout)}
                                      className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs"
                                    >
                                      <UserMinus className="h-3 w-3 mr-1" />
                                      Demitir
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Selecao de regiao */}
                          <AnimatePresence>
                            {selectedRegion === scout.id.toString() && !scout.isSearching && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="mt-4 pt-4 border-t border-white/[0.04]"
                              >
                                <p className="text-xs text-white/50 mb-3">Selecione a regiao para buscar:</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                  {SCOUTING_REGIONS.map((region) => (
                                    <button
                                      key={region.id}
                                      onClick={() => handleStartSearch(scout.id, region.id)}
                                      className="p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/[0.04] hover:border-[var(--brand)]/30 transition-all text-left"
                                    >
                                      <div className="flex items-center gap-2 mb-1">
                                        <region.icon className="h-4 w-4 text-[var(--brand)]" />
                                        <span className="text-sm font-medium text-white">{region.name}</span>
                                      </div>
                                      <p className="text-[10px] text-white/40 mb-2">{region.description}</p>
                                      <div className="flex items-center justify-between text-[10px]">
                                        <span className="text-white/50">
                                          <Clock className="h-3 w-3 inline mr-1" />
                                          {region.weeksToComplete} sem
                                        </span>
                                        <span className="text-amber-400">
                                          {formatCurrency(region.searchCost)}
                                        </span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Jogadores encontrados */}
                          {scout.foundPlayers.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-white/[0.04]">
                              <div className="flex items-center gap-2 text-xs text-white/50 mb-2">
                                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--brand)]" />
                                {scout.foundPlayers.length} jogador(es) descoberto(s)
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Contratar Olheiros */}
            {activeTab === "contratar" && (
              <motion.div
                key="contratar"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
                    Olheiros Disponiveis para Contratacao
                  </h2>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  {AVAILABLE_SCOUTS.filter(s => !myScouts.find(ms => ms.name === s.name)).map((scout, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-[#111] border border-white/[0.04] hover:border-white/10 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                            <Briefcase className="h-5 w-5 text-white/60" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-white">{scout.name}</h3>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-white/50 flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                Especialista: {scout.region}
                              </span>
                            </div>
                            <div className="flex items-center gap-0.5 mt-1">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={cn(
                                    "h-3 w-3",
                                    i < scout.skill ? "text-amber-400 fill-amber-400" : "text-white/20"
                                  )}
                                />
                              ))}
                              <span className="text-[10px] text-white/40 ml-2">
                                Habilidade {scout.skill}/5
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-white/[0.04] flex items-center justify-between">
                        <div>
                          <p className="text-xs text-white/40">Salario Semanal</p>
                          <p className="text-sm font-semibold text-white">
                            {formatCurrency(scout.salary)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedScoutToHire(scout)
                            setShowHireModal(true)
                          }}
                          className="bg-[var(--brand)] hover:bg-[var(--brand-2)] text-[var(--brand-ink)] text-xs"
                        >
                          <UserPlus className="h-3.5 w-3.5 mr-1" />
                          Contratar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Jogadores Descobertos */}
            {activeTab === "descobertos" && (
              <motion.div
                key="descobertos"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
                    Jogadores Descobertos
                  </h2>
                  <p className="text-xs text-white/40">
                    Jogadores encontrados pelos seus olheiros
                  </p>
                </div>

                {department.reports.length > 0 && (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-wider text-[var(--brand)]">Relatórios do universo 286</h3>
                        <p className="mt-1 text-[11px] text-white/40">O mesmo atleta e clube persistem entre observações, partidas e janelas.</p>
                      </div>
                      <span className="rounded-full bg-[var(--brand)]/15 px-2.5 py-1 text-[10px] font-bold text-[var(--brand)]">{department.reports.length} monitorados</span>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {[...department.reports].sort((a,b)=>b.generatedAt-a.generatedAt).map(report => (
                        <article key={report.id} className="rounded-xl border border-[var(--brand)]/15 bg-[#111] p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="truncate font-bold text-white">{report.playerName}</h4>
                                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-white/60">{report.position ?? "?"}</span>
                                <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold uppercase", report.stage === "complete" ? "bg-emerald-500/15 text-emerald-300" : report.stage === "partial" ? "bg-amber-500/15 text-amber-300" : "bg-white/10 text-white/45")}>{report.stage === "complete" ? "completo" : report.stage === "partial" ? "parcial" : "inicial"}</span>
                              </div>
                              <p className="mt-1 text-xs text-white/45">{report.age ?? "?"} anos · {report.clubName ?? "Clube não confirmado"} · {report.nationality ?? report.country ?? "nacionalidade desconhecida"}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] uppercase text-white/35">Potencial estimado</p>
                              <p className="text-lg font-black text-amber-300">{report.potentialEstimate.min}–{report.potentialEstimate.max}</p>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px]">
                            <div className="rounded-lg bg-black/30 p-2"><p className="text-white/35">Overall</p><b className="text-white">{report.knownAttributes.overall ?? "?"}</b></div>
                            <div className="rounded-lg bg-black/30 p-2"><p className="text-white/35">Encaixe</p><b className="text-white">{report.tacticalFit != null ? `${report.tacticalFit}%` : "?"}</b></div>
                            <div className="rounded-lg bg-black/30 p-2"><p className="text-white/35">Custo</p><b className="text-white">{report.estimatedTransferCost != null ? formatCurrency(report.estimatedTransferCost) : "?"}</b></div>
                          </div>
                          <p className="mt-3 text-[11px] leading-relaxed text-white/45">{report.notes}</p>
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <span className={cn("text-[10px] font-bold uppercase",report.recommendation === "sign" ? "text-emerald-300" : report.recommendation === "monitor" ? "text-amber-300" : "text-white/35")}>{report.recommendation === "sign" ? "recomenda contratar" : report.recommendation === "monitor" ? "manter monitorado" : "não recomendado"}</span>
                            <Button size="sm" onClick={()=>router.push(`/mercado?aba=buscar&jogador=${encodeURIComponent(report.playerName)}`)} className="bg-[var(--brand)] text-[10px] font-bold text-[var(--brand-ink)]"><Target className="mr-1 h-3 w-3"/>Abrir no mercado</Button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                )}

                {discoveredPlayers.length === 0 && department.reports.length === 0 ? (
                  <div className="p-8 rounded-xl bg-[#111] border border-white/[0.04] text-center">
                    <Eye className="h-12 w-12 mx-auto text-white/20 mb-3" />
                    <p className="text-white/50">Nenhum jogador descoberto ainda</p>
                    <p className="text-white/30 text-sm mt-1">Envie seus olheiros para buscar talentos</p>
                  </div>
                ) : discoveredPlayers.length > 0 ? (
                  <div className="grid gap-3">
                    {discoveredPlayers.map((player) => (
                      <div
                        key={player.id}
                        className="p-4 rounded-xl bg-[#111] border border-white/[0.04] hover:border-white/10 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[var(--brand)]/20 to-[var(--brand)]/5 flex items-center justify-center">
                                <span className="text-xl font-black text-[var(--brand)]">
                                  {/* ⚠️ Era "?" seco para TODO atleta nao pago. `lib/player-fame`
                                      existia desde sempre e nunca foi chamado por ninguem: o
                                      mundo inteiro sabe o nivel de um craque, e cobrar R$ 50 mil
                                      para "descobrir" um atleta de overall 88 e o oposto do real.
                                      Quem a fama nao revela mostra FAIXA, nao interrogacao. */}
                                  {player.revealedAttributes || famaDoLead(player).revelaOverall
                                    ? player.overall
                                    : faixaDeOverall(player.overall, famaDoLead(player))}
                                </span>
                              </div>
                              <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded bg-white/10 text-[9px] font-bold text-white/70">
                                {player.position}
                              </div>
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-semibold text-white">{player.name}</h3>
                                {famaDoLead(player).nivel !== "desconhecido" && (
                                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/60">
                                    {famaDoLead(player).rotulo}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-white/50">
                                  {player.age} anos
                                </span>
                                <span className="text-xs text-white/50">
                                  {player.nationality}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-amber-400 flex items-center gap-1">
                                  <TrendingUp className="h-3 w-3" />
                                  Potencial: {player.revealedAttributes || famaDoLead(player).revelaAtributos ? player.potential : "??"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right space-y-2">
                            <div>
                              <p className="text-xs text-white/40">Valor de Mercado</p>
                              <p className="text-sm font-semibold text-white">
                                {formatCurrency(player.marketValue)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {!player.revealedAttributes && !famaDoLead(player).revelaAtributos && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => gameEngine.revealScoutedLead(player.id)}
                                  className="border-white/10 text-white/70 hover:text-white text-xs"
                                >
                                  <Eye className="h-3.5 w-3.5 mr-1" />
                                  Revelar ({formatCurrency(50_000)})
                                </Button>
                              )}
                              <Button
                                size="sm"
                                className="bg-[var(--brand)] hover:bg-[var(--brand-2)] text-[var(--brand-ink)] text-xs"
                              >
                                <Target className="h-3.5 w-3.5 mr-1" />
                                Negociar
                              </Button>
                            </div>
                          </div>
                        </div>

                        {(player.revealedAttributes || famaDoLead(player).revelaAtributos) && (
                          <div className="mt-4 pt-4 border-t border-white/[0.04] grid grid-cols-6 gap-2">
                            {[
                              { label: "RIT", value: player.pace },
                              { label: "FIN", value: player.shooting },
                              { label: "PAS", value: player.passing },
                              { label: "DRI", value: player.dribbling },
                              { label: "DEF", value: player.defending },
                              { label: "FIS", value: player.physical },
                            ].map((attr) => (
                              <div key={attr.label} className="text-center">
                                <p className="text-[10px] text-white/40">{attr.label}</p>
                                <p className={cn(
                                  "text-sm font-bold",
                                  attr.value >= 80 ? "text-[var(--brand)]" :
                                  attr.value >= 70 ? "text-amber-400" :
                                  attr.value >= 60 ? "text-white" : "text-white/50"
                                )}>
                                  {attr.value}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Modal de DEMISSÃO — a rescisão é dinheiro saindo do caixa e pode
          cancelar uma busca já paga, então nunca acontece em um clique só. */}
      <AnimatePresence>
        {scoutParaDemitir && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center uf-veu"
            onClick={() => setScoutParaDemitir(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md mx-4 p-6 rounded-2xl bg-[#1a1a1a] border border-red-500/20"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Demitir olheiro</h3>
                <button
                  onClick={() => setScoutParaDemitir(null)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-sm text-white/60">
                <span className="font-semibold text-white">{scoutParaDemitir.name}</span> sai da folha
                imediatamente. A rescisão equivale a 4 semanas de salário.
              </p>

              <div className="mt-4 space-y-2 rounded-xl bg-white/5 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-white/50">Salário semanal</span>
                  <span className="text-white">{formatCurrency(scoutParaDemitir.salary)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/50">Rescisão</span>
                  <span className="font-semibold text-red-300">
                    {formatCurrency((scoutParaDemitir.salary * 4))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/50">Economia semanal</span>
                  <span className="text-[var(--brand)]">
                    {formatCurrency(scoutParaDemitir.salary)}
                  </span>
                </div>
              </div>

              {scoutParaDemitir.isSearching && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] p-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <p className="text-xs leading-snug text-amber-200">
                    Ele está no meio de uma busca. Demitir agora cancela a expedição e o
                    valor já investido nela não volta.
                  </p>
                </div>
              )}

              <div className="mt-6 flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setScoutParaDemitir(null)}
                  className="flex-1 border-white/10 text-white/70"
                >
                  Manter
                </Button>
                <Button
                  onClick={confirmarDemissao}
                  className="flex-1 bg-red-500 text-white hover:bg-red-500/90"
                >
                  Confirmar demissão
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de contratacao */}
      <AnimatePresence>
        {showHireModal && selectedScoutToHire && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center uf-veu"
            onClick={() => setShowHireModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md mx-4 p-6 rounded-2xl bg-[#1a1a1a] border border-white/10"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Contratar Olheiro</h3>
                <button
                  onClick={() => setShowHireModal(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-4 rounded-xl bg-white/5 mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                    <Briefcase className="h-6 w-6 text-white/60" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">{selectedScoutToHire.name}</h4>
                    <p className="text-sm text-white/50">Especialista: {selectedScoutToHire.region}</p>
                    <div className="flex items-center gap-0.5 mt-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            "h-3 w-3",
                            i < selectedScoutToHire.skill ? "text-amber-400 fill-amber-400" : "text-white/20"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/50">Salario Semanal</span>
                  <span className="font-medium text-white">
                    {formatCurrency(selectedScoutToHire.salary)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/50">Custo Anual Estimado</span>
                  <span className="font-medium text-amber-400">
                    {formatCurrency((selectedScoutToHire.salary * 52))}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowHireModal(false)}
                  className="flex-1 border-white/10 text-white/70"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => handleHireScout(selectedScoutToHire)}
                  className="flex-1 bg-[var(--brand)] hover:bg-[var(--brand-2)] text-[var(--brand-ink)]"
                >
                  Confirmar Contratacao
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

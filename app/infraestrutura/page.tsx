"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { Button } from "@/components/ui/button"
import { useGameManager } from "@/lib/use-game-manager"
import { cn } from "@/lib/utils"
import {
  Building2,
  Home,
  Mic2,
  TreeDeciduous,
  Dumbbell,
  GraduationCap,
  Heart,
  Shield,
  Lock,
  ArrowUp,
  Check,
  Clock,
  DollarSign,
  AlertTriangle,
  Wrench,
  Zap,
  Volume2,
  Users,
  TrendingUp,
  Info
} from "lucide-react"

// Definicao das areas de infraestrutura
const INFRASTRUCTURE_AREAS = [
  {
    id: "stadium",
    name: "Estadio",
    icon: Building2,
    description: "Capacidade e estrutura do estadio",
    color: "#00ffc8",
    levels: [
      { level: 1, name: "Basico", capacity: 15000, cost: 0, benefits: ["15.000 lugares"] },
      { level: 2, name: "Intermediario", capacity: 25000, cost: 5000000, benefits: ["25.000 lugares", "+20% renda de bilheteria"] },
      { level: 3, name: "Profissional", capacity: 40000, cost: 15000000, benefits: ["40.000 lugares", "+40% renda de bilheteria", "Camarotes VIP"] },
      { level: 4, name: "Elite", capacity: 55000, cost: 35000000, benefits: ["55.000 lugares", "+70% renda de bilheteria", "Area premium"] },
      { level: 5, name: "Mundial", capacity: 70000, cost: 80000000, benefits: ["70.000 lugares", "+100% renda de bilheteria", "Eventos internacionais"] },
    ]
  },
  {
    id: "acoustics",
    name: "Acustica",
    icon: Volume2,
    description: "Sistema de som e pressao da torcida",
    color: "#f59e0b",
    levels: [
      { level: 1, name: "Basico", capacity: 0, cost: 0, benefits: ["Som ambiente padrao"] },
      { level: 2, name: "Amplificado", capacity: 0, cost: 500000, benefits: ["+5% pressao em visitantes"] },
      { level: 3, name: "Profissional", capacity: 0, cost: 1500000, benefits: ["+10% pressao em visitantes", "Anuncios personalizados"] },
      { level: 4, name: "Caldeirão", capacity: 0, cost: 4000000, benefits: ["+15% pressao em visitantes", "Experiencia imersiva"] },
      { level: 5, name: "Inferno", capacity: 0, cost: 10000000, benefits: ["+20% pressao em visitantes", "Intimidacao maxima"] },
    ]
  },
  {
    id: "pitch",
    name: "Gramado",
    icon: TreeDeciduous,
    description: "Qualidade e manutencao do gramado",
    color: "#22c55e",
    levels: [
      { level: 1, name: "Natural", capacity: 0, cost: 0, benefits: ["Gramado natural padrao"] },
      { level: 2, name: "Tratado", capacity: 0, cost: 300000, benefits: ["Menor risco de lesoes", "Melhor toque de bola"] },
      { level: 3, name: "Premium", capacity: 0, cost: 800000, benefits: ["-10% lesoes", "+5% passe para time da casa"] },
      { level: 4, name: "Hibrido", capacity: 0, cost: 2000000, benefits: ["-15% lesoes", "+8% passe para time da casa"] },
      { level: 5, name: "FIFA Quality", capacity: 0, cost: 5000000, benefits: ["-20% lesoes", "+12% passe", "Padrao mundial"] },
    ]
  },
  {
    id: "training",
    name: "Centro de Treinamento",
    icon: Dumbbell,
    description: "Instalacoes de treino",
    color: "#8b5cf6",
    levels: [
      { level: 1, name: "Basico", capacity: 0, cost: 0, benefits: ["Campos de treino"] },
      { level: 2, name: "Estruturado", capacity: 0, cost: 2000000, benefits: ["+10% desenvolvimento", "Academia"] },
      { level: 3, name: "Profissional", capacity: 0, cost: 6000000, benefits: ["+20% desenvolvimento", "Campos cobertos"] },
      { level: 4, name: "Elite", capacity: 0, cost: 15000000, benefits: ["+35% desenvolvimento", "Simuladores"] },
      { level: 5, name: "Referencia", capacity: 0, cost: 40000000, benefits: ["+50% desenvolvimento", "Tecnologia de ponta"] },
    ]
  },
  {
    id: "youth",
    name: "Base/Academia",
    icon: GraduationCap,
    description: "Formacao de jovens talentos",
    color: "#06b6d4",
    levels: [
      { level: 1, name: "Categorias", capacity: 0, cost: 0, benefits: ["Sub-17 e Sub-20"] },
      { level: 2, name: "Estruturada", capacity: 0, cost: 3000000, benefits: ["Todas as categorias", "+1 jovem/ano"] },
      { level: 3, name: "Reconhecida", capacity: 0, cost: 8000000, benefits: ["+2 jovens/ano", "Olheiros regionais"] },
      { level: 4, name: "Referencia", capacity: 0, cost: 20000000, benefits: ["+3 jovens/ano", "Escola de futebol"] },
      { level: 5, name: "La Masia", capacity: 0, cost: 50000000, benefits: ["+5 jovens/ano", "Promessas de alto potencial"] },
    ]
  },
  {
    id: "medical",
    name: "Centro Medico",
    icon: Heart,
    description: "Departamento medico e recuperacao",
    color: "#ef4444",
    levels: [
      { level: 1, name: "Basico", capacity: 0, cost: 0, benefits: ["Atendimento basico"] },
      { level: 2, name: "Clinica", capacity: 0, cost: 1000000, benefits: ["-10% tempo de lesao", "Fisioterapia"] },
      { level: 3, name: "Hospital", capacity: 0, cost: 3000000, benefits: ["-20% tempo de lesao", "Cirurgias"] },
      { level: 4, name: "Centro Avancado", capacity: 0, cost: 8000000, benefits: ["-35% tempo de lesao", "Crioterapia"] },
      { level: 5, name: "Referencia", capacity: 0, cost: 20000000, benefits: ["-50% tempo de lesao", "Recuperacao recorde"] },
    ]
  },
  {
    id: "security",
    name: "Seguranca",
    icon: Shield,
    description: "Seguranca do estadio e eventos",
    color: "#64748b",
    levels: [
      { level: 1, name: "Basica", capacity: 0, cost: 0, benefits: ["Seguranca minima"] },
      { level: 2, name: "Reforcada", capacity: 0, cost: 500000, benefits: ["-20% chance de incidentes"] },
      { level: 3, name: "Profissional", capacity: 0, cost: 1500000, benefits: ["-40% chance de incidentes", "Cameras"] },
      { level: 4, name: "Completa", capacity: 0, cost: 4000000, benefits: ["-60% chance de incidentes", "Monitoramento 24h"] },
      { level: 5, name: "Maxima", capacity: 0, cost: 10000000, benefits: ["-80% chance de incidentes", "Reconhecimento facial"] },
    ]
  },
  {
    id: "data",
    name: "Seguranca de Dados",
    icon: Lock,
    description: "Protecao de informacoes do clube",
    color: "#0ea5e9",
    levels: [
      { level: 1, name: "Basica", capacity: 0, cost: 0, benefits: ["Backup simples"] },
      { level: 2, name: "Protegida", capacity: 0, cost: 200000, benefits: ["-30% vazamentos", "Criptografia"] },
      { level: 3, name: "Segura", capacity: 0, cost: 500000, benefits: ["-50% vazamentos", "Firewall"] },
      { level: 4, name: "Blindada", capacity: 0, cost: 1000000, benefits: ["-70% vazamentos", "Auditoria"] },
      { level: 5, name: "Fortaleza", capacity: 0, cost: 2500000, benefits: ["-90% vazamentos", "Nivel bancario"] },
    ]
  },
]

export default function InfraestruturaPage() {
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
  const { userTeam } = useGameManager()
  const [selectedArea, setSelectedArea] = useState<string | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  // Estado simulado de infraestrutura (em producao viria do gameEngine)
  const [infrastructure, setInfrastructure] = useState<Record<string, number>>({
    stadium: 2,
    acoustics: 1,
    pitch: 2,
    training: 2,
    youth: 1,
    medical: 2,
    security: 1,
    data: 1,
  })

  const [upgradesInProgress, setUpgradesInProgress] = useState<Record<string, { weeksLeft: number; targetLevel: number }>>({})

  const balance = 15000000 // Simulado - viria do gameEngine

  const handleUpgrade = (areaId: string) => {
    const area = INFRASTRUCTURE_AREAS.find(a => a.id === areaId)
    if (!area) return

    const currentLevel = infrastructure[areaId]
    const nextLevel = area.levels[currentLevel]
    if (!nextLevel) return

    // Simular upgrade
    setUpgradesInProgress({
      ...upgradesInProgress,
      [areaId]: { weeksLeft: 4, targetLevel: currentLevel + 1 }
    })

    setShowUpgradeModal(false)
    setSelectedArea(null)
  }

  const getMaintenanceCost = () => {
    let total = 0
    Object.entries(infrastructure).forEach(([areaId, level]) => {
      total += level * 50000 // R$ 50k por nivel por semana
    })
    return total
  }

  const selectedAreaData = selectedArea ? INFRASTRUCTURE_AREAS.find(a => a.id === selectedArea) : null

  return (
    <div className="h-screen overflow-hidden md:pl-16 pl-0 pb-20 md:pb-0 bg-[#050508]">
      <GameSidebar />
      <GameHeader team={userTeam ?? undefined} />

      <main className="h-[calc(100vh-48px-56px)] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/[0.04] bg-[#0d0d0d]">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="h-5 w-5 text-[#00ffc8]" />
                Infraestrutura do Clube
              </h1>
              <p className="text-xs text-white/50 mt-0.5">Gerencie e evolua as instalacoes do {userTeam?.nome || "seu clube"}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[10px] text-white/40 uppercase">Manutencao Semanal</p>
                <p className="text-sm font-semibold text-amber-400">
                  R$ {getMaintenanceCost().toLocaleString("pt-BR")}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-white/40 uppercase">Saldo Disponivel</p>
                <p className="text-sm font-semibold text-[#00ffc8]">
                  R$ {balance.toLocaleString("pt-BR")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-game">
          {/* Stats gerais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="p-4 rounded-xl bg-[#111] border border-white/[0.04]">
              <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
                <Building2 className="h-3.5 w-3.5" />
                Capacidade
              </div>
              <div className="text-2xl font-bold text-white">
                {INFRASTRUCTURE_AREAS[0].levels[infrastructure.stadium - 1]?.capacity?.toLocaleString("pt-BR") || "15.000"}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-[#111] border border-white/[0.04]">
              <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
                <TrendingUp className="h-3.5 w-3.5" />
                Nivel Medio
              </div>
              <div className="text-2xl font-bold text-[#00ffc8]">
                {(Object.values(infrastructure).reduce((a, b) => a + b, 0) / Object.keys(infrastructure).length).toFixed(1)}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-[#111] border border-white/[0.04]">
              <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
                <Wrench className="h-3.5 w-3.5" />
                Em Construcao
              </div>
              <div className="text-2xl font-bold text-amber-400">
                {Object.keys(upgradesInProgress).length}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-[#111] border border-white/[0.04]">
              <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
                <Zap className="h-3.5 w-3.5" />
                Pressao Casa
              </div>
              <div className="text-2xl font-bold text-white">
                +{(infrastructure.acoustics * 4) + (infrastructure.stadium)}%
              </div>
            </div>
          </div>

          {/* Grid de areas */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            {INFRASTRUCTURE_AREAS.map((area) => {
              const currentLevel = infrastructure[area.id]
              const currentLevelData = area.levels[currentLevel - 1]
              const nextLevelData = area.levels[currentLevel]
              const isUpgrading = upgradesInProgress[area.id]
              const isMaxLevel = currentLevel >= 5

              return (
                <motion.div
                  key={area.id}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => !isMaxLevel && setSelectedArea(area.id)}
                  className={cn(
                    "p-4 rounded-xl border transition-all cursor-pointer",
                    isUpgrading 
                      ? "bg-amber-500/10 border-amber-500/30" 
                      : isMaxLevel
                      ? "bg-[#00ffc8]/10 border-[#00ffc8]/30"
                      : "bg-[#111] border-white/[0.04] hover:border-white/20"
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${area.color}20` }}
                    >
                      <area.icon className="h-5 w-5" style={{ color: area.color }} />
                    </div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            "w-2 h-2 rounded-full",
                            i < currentLevel ? "bg-[#00ffc8]" : "bg-white/10"
                          )}
                        />
                      ))}
                    </div>
                  </div>

                  <h3 className="font-semibold text-white text-sm">{area.name}</h3>
                  <p className="text-[10px] text-white/40 mt-0.5">{area.description}</p>

                  <div className="mt-3 pt-3 border-t border-white/[0.04]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/60">
                        Nivel {currentLevel}: {currentLevelData?.name}
                      </span>
                      {isUpgrading ? (
                        <span className="text-[10px] text-amber-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {isUpgrading.weeksLeft} sem
                        </span>
                      ) : isMaxLevel ? (
                        <span className="text-[10px] text-[#00ffc8] flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          MAX
                        </span>
                      ) : (
                        <span className="text-[10px] text-white/40 flex items-center gap-1">
                          <ArrowUp className="h-3 w-3" />
                          Evoluir
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </main>

      {/* Modal de upgrade */}
      <AnimatePresence>
        {selectedArea && selectedAreaData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setSelectedArea(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg mx-4 p-6 rounded-2xl bg-[#1a1a1a] border border-white/10"
            >
              <div className="flex items-center gap-4 mb-6">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${selectedAreaData.color}20` }}
                >
                  <selectedAreaData.icon className="h-7 w-7" style={{ color: selectedAreaData.color }} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedAreaData.name}</h3>
                  <p className="text-sm text-white/50">{selectedAreaData.description}</p>
                </div>
              </div>

              {/* Nivel atual */}
              <div className="p-4 rounded-xl bg-white/5 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white/60">Nivel Atual</span>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "w-3 h-3 rounded-full",
                          i < infrastructure[selectedArea] ? "bg-[#00ffc8]" : "bg-white/10"
                        )}
                      />
                    ))}
                  </div>
                </div>
                <h4 className="font-semibold text-white">
                  Nivel {infrastructure[selectedArea]}: {selectedAreaData.levels[infrastructure[selectedArea] - 1]?.name}
                </h4>
                <div className="mt-2 space-y-1">
                  {selectedAreaData.levels[infrastructure[selectedArea] - 1]?.benefits.map((benefit, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-white/60">
                      <Check className="h-3 w-3 text-[#00ffc8]" />
                      {benefit}
                    </div>
                  ))}
                </div>
              </div>

              {/* Proximo nivel */}
              {infrastructure[selectedArea] < 5 && (
                <div className="p-4 rounded-xl border border-[#00ffc8]/30 bg-[#00ffc8]/5 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-[#00ffc8]">Proximo Nivel</span>
                    <span className="text-sm font-semibold text-[#00ffc8]">
                      R$ {selectedAreaData.levels[infrastructure[selectedArea]]?.cost.toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <h4 className="font-semibold text-white">
                    Nivel {infrastructure[selectedArea] + 1}: {selectedAreaData.levels[infrastructure[selectedArea]]?.name}
                  </h4>
                  <div className="mt-2 space-y-1">
                    {selectedAreaData.levels[infrastructure[selectedArea]]?.benefits.map((benefit, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-[#00ffc8]">
                        <ArrowUp className="h-3 w-3" />
                        {benefit}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-white/40">
                    <Clock className="h-3 w-3" />
                    Tempo de construcao: 4 semanas
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setSelectedArea(null)}
                  className="flex-1 border-white/10 text-white/70"
                >
                  Cancelar
                </Button>
                {infrastructure[selectedArea] < 5 && (
                  <Button
                    onClick={() => handleUpgrade(selectedArea)}
                    disabled={balance < (selectedAreaData.levels[infrastructure[selectedArea]]?.cost || 0)}
                    className="flex-1 bg-[#00ffc8] hover:bg-[#00c8ff] text-black disabled:opacity-50"
                  >
                    <ArrowUp className="h-4 w-4 mr-2" />
                    Evoluir
                  </Button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

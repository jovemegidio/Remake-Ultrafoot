"use client"

import { useMemo } from "react"
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Building2,
  Trophy,
  ShoppingCart,
  Shirt,
  Tv,
  Ticket,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Target,
  Calendar,
  Award,
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { MusicPlayer } from "@/components/music-player"
import { TeamCrest } from "@/components/team-crest"
import { Progress } from "@/components/ui/progress"
import { formatCurrency } from "@/lib/teams-data"
import { useUserTeam } from "@/lib/save-system"
import { useGameEngine } from "@/lib/game-engine"
import { useGameManager } from "@/lib/use-game-manager"
import { cn } from "@/lib/utils"

// Premiacoes por posicao no Brasileirao
const PRIZE_MONEY = {
  champion: 48000000, // Campeao
  second: 44800000,
  third: 41600000,
  fourth: 38400000,
  fifth: 35200000,
  sixth: 32000000,
  seventh: 28800000,
  eighth: 25600000,
  ninth: 22400000,
  tenth: 19200000,
  eleventh: 16000000,
  twelfth: 14400000,
  thirteenth: 12800000,
  fourteenth: 11200000,
  fifteenth: 9600000,
  sixteenth: 8000000,
  // Rebaixados
  seventeenth: 6400000,
  eighteenth: 4800000,
  nineteenth: 3200000,
  twentieth: 1600000,
}

// Premiacoes da Copa do Brasil
const COPA_PRIZE = {
  firstRound: 1470000,
  secondRound: 1785000,
  thirdRound: 2205000,
  roundOf16: 3150000,
  quarterFinals: 4200000,
  semiFinals: 8400000,
  runnerUp: 31500000,
  champion: 73500000,
}

// Premiacoes Libertadores (fase de grupos em diante)
const LIBERTADORES_PRIZE = {
  groupStage: 3000000 * 5.5, // USD to BRL
  roundOf16: 1500000 * 5.5,
  quarterFinals: 2000000 * 5.5,
  semiFinals: 2500000 * 5.5,
  runnerUp: 6000000 * 5.5,
  champion: 23000000 * 5.5,
}

export default function FinancasPage() {
  const { team: userTeam } = useUserTeam()
  const gameEngine = useGameEngine()
  const { currentWeek, currentSeason, userPosition, standings, hydrated } = useGameManager()

  // Calcula receitas dinamicas
  const dynamicFinances = useMemo(() => {
    if (!userTeam) return null

    // Base de receitas
    const tvRights = Math.round(userTeam.prestigio * 25000 + 1500000) // Baseado no prestigio
    const sponsorship = Math.round(userTeam.prestigio * 15000 + 800000)
    
    // Bilheteria baseada em jogos em casa jogados
    const homeMatches = gameEngine.matchResults.filter(m => m.homeTeam === userTeam.curto).length
    const avgAttendance = Math.round(userTeam.estadio_capacidade * 0.7)
    const ticketPrice = 50 + (userTeam.prestigio * 0.5)
    const ticketRevenue = homeMatches * avgAttendance * ticketPrice

    // Premiacoes estimadas baseadas na posicao atual
    const prizeKeys = Object.keys(PRIZE_MONEY) as (keyof typeof PRIZE_MONEY)[]
    const estimatedPrize = userPosition > 0 ? PRIZE_MONEY[prizeKeys[userPosition - 1]] || 0 : 0

    // Despesas
    const totalWages = gameEngine.squadPlayers.reduce((sum, p) => sum + (p.contract?.salary || 0), 0) * 4 // Mensal
    const scoutWages = gameEngine.scouts.reduce((sum, s) => sum + s.salary, 0) * 4
    const infrastructure = Math.round(userTeam.estadio_capacidade * 5)
    const staff = 250000
    const other = 100000

    const monthlyIncome = tvRights + sponsorship + Math.round(ticketRevenue / 12) + Math.round(estimatedPrize / 12)
    const monthlyExpenses = totalWages + scoutWages + infrastructure + staff + other

    return {
      balance: gameEngine.balance,
      weeklyIncome: gameEngine.weeklyIncome,
      weeklyExpenses: gameEngine.weeklyExpenses,
      transferBudget: gameEngine.transferBudget,
      wageBudget: gameEngine.wageBudget,
      
      // Breakdown de receitas
      income: {
        tvRights,
        sponsorship,
        ticketRevenue: Math.round(ticketRevenue / 12),
        estimatedPrize: Math.round(estimatedPrize / 12),
        total: monthlyIncome,
      },
      
      // Breakdown de despesas
      expenses: {
        wages: totalWages,
        scoutWages,
        infrastructure,
        staff,
        other,
        total: monthlyExpenses,
      },
      
      // Metricas
      netIncome: monthlyIncome - monthlyExpenses,
      wageUsed: totalWages + scoutWages,
      homeMatches,
      avgAttendance,
    }
  }, [userTeam, gameEngine.balance, gameEngine.squadPlayers, gameEngine.scouts, gameEngine.matchResults, gameEngine.weeklyIncome, gameEngine.weeklyExpenses, gameEngine.transferBudget, gameEngine.wageBudget, userPosition])

  // Transacoes recentes baseadas nos resultados
  const recentTransactions = useMemo(() => {
    const transactions: { type: "income" | "expense"; description: string; value: number; date: string }[] = []
    
    // Ultimas 5 partidas
    const recentMatches = [...gameEngine.matchResults].slice(-5).reverse()
    recentMatches.forEach((match, i) => {
      if (match.homeTeam === userTeam?.curto || match.awayTeam === userTeam?.curto) {
        const isHome = match.homeTeam === userTeam?.curto
        if (isHome) {
          const ticketRev = Math.round((userTeam?.estadio_capacidade || 30000) * 0.7 * 55)
          transactions.push({
            type: "income",
            description: `Bilheteria vs ${match.awayTeam}`,
            value: ticketRev,
            date: `Rodada ${match.week}`,
          })
        }
      }
    })

    // Salarios semanais
    if (currentWeek > 0) {
      transactions.push({
        type: "expense",
        description: "Folha salarial semanal",
        value: dynamicFinances?.expenses.wages ? Math.round(dynamicFinances.expenses.wages / 4) : 0,
        date: `Semana ${currentWeek}`,
      })
    }

    // Cota de TV mensal
    if (currentWeek % 4 === 0) {
      transactions.push({
        type: "income",
        description: "Cota mensal de TV",
        value: dynamicFinances?.income.tvRights || 0,
        date: `Semana ${currentWeek}`,
      })
    }

    return transactions.slice(0, 6)
  }, [gameEngine.matchResults, userTeam, currentWeek, dynamicFinances])

  if (!hydrated || !userTeam || !dynamicFinances) {
    return (
      <div className="h-screen pl-[72px] bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const wagePercentage = (dynamicFinances.wageUsed / dynamicFinances.wageBudget) * 100

  return (
    <div className="h-screen pl-[72px] bg-[#0a0a0a] flex flex-col overflow-hidden">
      <GameSidebar />
      <GameHeader team={userTeam} />

      <main className="flex-1 p-4 overflow-y-auto space-y-4 scrollbar-thin">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Financas</h1>
            <p className="text-sm text-white/50 mt-1">Gestao financeira do clube - Temporada {currentSeason}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/50">
            <Calendar className="h-4 w-4" />
            Semana {currentWeek}/38
          </div>
        </div>

        {/* Balance Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-[#141414] border border-white/5 p-4">
            <div className="flex items-center gap-2 text-xs text-white/40 font-medium tracking-wider">
              <Wallet className="h-4 w-4 text-[#1db954]" />
              SALDO ATUAL
            </div>
            <div className="mt-2 text-2xl font-semibold text-[#1db954]">
              {formatCurrency(dynamicFinances.balance)}
            </div>
            <div className={cn(
              "mt-1 flex items-center gap-1 text-xs",
              dynamicFinances.netIncome >= 0 ? "text-[#1db954]" : "text-red-400"
            )}>
              {dynamicFinances.netIncome >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{dynamicFinances.netIncome >= 0 ? "+" : ""}{formatCurrency(dynamicFinances.netIncome)}/mes</span>
            </div>
          </div>

          <div className="rounded-xl bg-[#141414] border border-white/5 p-4">
            <div className="flex items-center gap-2 text-xs text-white/40 font-medium tracking-wider">
              <TrendingUp className="h-4 w-4 text-blue-400" />
              RECEITA MENSAL
            </div>
            <div className="mt-2 text-2xl font-semibold text-blue-400">
              {formatCurrency(dynamicFinances.income.total)}
            </div>
            <div className="mt-1 text-xs text-white/40">
              {dynamicFinances.homeMatches} jogos em casa
            </div>
          </div>

          <div className="rounded-xl bg-[#141414] border border-white/5 p-4">
            <div className="flex items-center gap-2 text-xs text-white/40 font-medium tracking-wider">
              <TrendingDown className="h-4 w-4 text-red-400" />
              DESPESAS MENSAIS
            </div>
            <div className="mt-2 text-2xl font-semibold text-red-400">
              {formatCurrency(dynamicFinances.expenses.total)}
            </div>
            <div className="mt-1 text-xs text-white/40">
              {gameEngine.squadPlayers.length} jogadores + {gameEngine.scouts.length} olheiros
            </div>
          </div>

          <div className="rounded-xl bg-[#141414] border border-white/5 p-4">
            <div className="flex items-center gap-2 text-xs text-white/40 font-medium tracking-wider">
              <DollarSign className="h-4 w-4 text-yellow-400" />
              VERBA DE TRANSFERENCIAS
            </div>
            <div className="mt-2 text-2xl font-semibold text-yellow-400">
              {formatCurrency(dynamicFinances.transferBudget)}
            </div>
            <div className="mt-1 text-xs text-white/40">
              Disponivel para contratacoes
            </div>
          </div>
        </div>

        {/* Breakdown Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Income Breakdown */}
          <div className="rounded-xl bg-[#141414] border border-white/5 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5 bg-white/[0.02]">
              <TrendingUp className="h-4 w-4 text-blue-400" />
              <h2 className="text-xs font-medium text-white tracking-wider">RECEITAS</h2>
            </div>
            <div className="p-4 space-y-4">
              <FinanceItem
                icon={Tv}
                label="Direitos de TV"
                value={dynamicFinances.income.tvRights}
                total={dynamicFinances.income.total}
                color="text-primary"
                isIncome
              />
              <FinanceItem
                icon={Ticket}
                label="Bilheteria"
                value={dynamicFinances.income.ticketRevenue}
                total={dynamicFinances.income.total}
                color="text-accent"
                isIncome
                subtitle={`Media ${dynamicFinances.avgAttendance.toLocaleString()} torcedores`}
              />
              <FinanceItem
                icon={Building2}
                label="Patrocinios"
                value={dynamicFinances.income.sponsorship}
                total={dynamicFinances.income.total}
                color="text-yellow-400"
                isIncome
              />
              <FinanceItem
                icon={Trophy}
                label="Premiacoes (estimado)"
                value={dynamicFinances.income.estimatedPrize}
                total={dynamicFinances.income.total}
                color="text-purple-400"
                isIncome
                subtitle={`Baseado na ${userPosition}a posicao`}
              />
            </div>
          </div>

          {/* Expense Breakdown */}
          <div className="rounded-xl bg-[#141414] border border-white/5 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5 bg-white/[0.02]">
              <TrendingDown className="h-4 w-4 text-red-400" />
              <h2 className="text-xs font-medium text-white tracking-wider">DESPESAS</h2>
            </div>
            <div className="p-4 space-y-4">
              <FinanceItem
                icon={Users}
                label="Salarios de Jogadores"
                value={dynamicFinances.expenses.wages}
                total={dynamicFinances.expenses.total}
                color="text-red-400"
                isIncome={false}
                subtitle={`${gameEngine.squadPlayers.length} jogadores`}
              />
              <FinanceItem
                icon={Target}
                label="Salarios de Olheiros"
                value={dynamicFinances.expenses.scoutWages}
                total={dynamicFinances.expenses.total}
                color="text-orange-400"
                isIncome={false}
                subtitle={`${gameEngine.scouts.length} olheiros`}
              />
              <FinanceItem
                icon={Building2}
                label="Infraestrutura"
                value={dynamicFinances.expenses.infrastructure}
                total={dynamicFinances.expenses.total}
                color="text-blue-400"
                isIncome={false}
              />
              <FinanceItem
                icon={Shirt}
                label="Staff Tecnico"
                value={dynamicFinances.expenses.staff}
                total={dynamicFinances.expenses.total}
                color="text-cyan-400"
                isIncome={false}
              />
              <FinanceItem
                icon={ShoppingCart}
                label="Outros"
                value={dynamicFinances.expenses.other}
                total={dynamicFinances.expenses.total}
                color="text-white/50"
                isIncome={false}
              />
            </div>
          </div>
        </div>

        {/* Prize Money Section */}
        <div className="rounded-xl bg-[#141414] border border-white/5 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5 bg-white/[0.02]">
            <Award className="h-4 w-4 text-yellow-400" />
            <h2 className="text-xs font-medium text-white tracking-wider">PREMIACOES POR COMPETICAO</h2>
          </div>
          <div className="p-4 grid gap-4 md:grid-cols-3">
            {/* Brasileirao */}
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-5 w-5 text-[#1db954]" />
                <span className="text-sm font-medium text-white">Brasileirao</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-white/50">Campeao</span>
                  <span className="text-[#1db954] font-medium">{formatCurrency(PRIZE_MONEY.champion)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">G4 (4o lugar)</span>
                  <span className="text-white/70">{formatCurrency(PRIZE_MONEY.fourth)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Sua posicao ({userPosition}o)</span>
                  <span className="text-primary font-medium">
                    {formatCurrency(Object.values(PRIZE_MONEY)[userPosition - 1] || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Copa do Brasil */}
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-5 w-5 text-yellow-400" />
                <span className="text-sm font-medium text-white">Copa do Brasil</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-white/50">Campeao</span>
                  <span className="text-yellow-400 font-medium">{formatCurrency(COPA_PRIZE.champion)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Vice</span>
                  <span className="text-white/70">{formatCurrency(COPA_PRIZE.runnerUp)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Oitavas</span>
                  <span className="text-white/70">{formatCurrency(COPA_PRIZE.roundOf16)}</span>
                </div>
              </div>
            </div>

            {/* Libertadores */}
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-5 w-5 text-amber-400" />
                <span className="text-sm font-medium text-white">Libertadores</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-white/50">Campeao</span>
                  <span className="text-amber-400 font-medium">{formatCurrency(LIBERTADORES_PRIZE.champion)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Vice</span>
                  <span className="text-white/70">{formatCurrency(LIBERTADORES_PRIZE.runnerUp)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Fase de Grupos</span>
                  <span className="text-white/70">{formatCurrency(LIBERTADORES_PRIZE.groupStage)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Wage Budget & Recent Transactions */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Wage Budget */}
          <div className="rounded-xl bg-[#141414] border border-white/5 p-4">
            <div className="flex items-center gap-2 text-xs text-white/40 font-medium tracking-wider mb-4">
              <Users className="h-4 w-4" />
              FOLHA SALARIAL
            </div>
            <div className="space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-sm text-white/50">Utilizado</div>
                  <div className="text-2xl font-semibold text-white">{formatCurrency(dynamicFinances.wageUsed)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-white/50">Limite</div>
                  <div className="text-lg text-white/50">{formatCurrency(dynamicFinances.wageBudget)}</div>
                </div>
              </div>
              <Progress value={Math.min(100, wagePercentage)} className="h-2" />
              <div className="flex items-center justify-between text-xs">
                <span className={wagePercentage > 90 ? "text-red-400" : "text-white/50"}>
                  {wagePercentage.toFixed(0)}% utilizado
                </span>
                <span className="text-[#1db954]">
                  {formatCurrency(Math.max(0, dynamicFinances.wageBudget - dynamicFinances.wageUsed))} disponivel
                </span>
              </div>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="lg:col-span-2 rounded-xl bg-[#141414] border border-white/5 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-yellow-400" />
                <h2 className="text-xs font-medium text-white tracking-wider">TRANSACOES RECENTES</h2>
              </div>
            </div>
            <div className="divide-y divide-white/5 max-h-64 overflow-y-auto scrollbar-thin">
              {recentTransactions.length > 0 ? (
                recentTransactions.map((tx, index) => (
                  <div key={index} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        tx.type === "income" ? "bg-[#1db954]/20" : "bg-red-400/20"
                      }`}>
                        {tx.type === "income" ? (
                          <ArrowUpRight className="h-4 w-4 text-[#1db954]" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-red-400" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm text-white">{tx.description}</div>
                        <div className="text-xs text-white/40">{tx.date}</div>
                      </div>
                    </div>
                    <span className={`text-sm font-medium ${
                      tx.type === "income" ? "text-[#1db954]" : "text-red-400"
                    }`}>
                      {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.value)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="px-5 py-8 text-center text-white/40 text-sm">
                  Nenhuma transacao registrada ainda
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <MusicPlayer />
    </div>
  )
}

// Componente para item de financa
function FinanceItem({
  icon: Icon,
  label,
  value,
  total,
  color,
  isIncome,
  subtitle,
}: {
  icon: React.ElementType
  label: string
  value: number
  total: number
  color: string
  isIncome: boolean
  subtitle?: string
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0
  
  return (
    <div className="flex items-center gap-4">
      <div className={`h-10 w-10 rounded-lg bg-card flex items-center justify-center ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-white">{label}</span>
            {subtitle && <div className="text-[10px] text-white/40">{subtitle}</div>}
          </div>
          <span className={cn("text-sm font-medium", isIncome ? "text-[#1db954]" : "text-red-400")}>
            {formatCurrency(value)}
          </span>
        </div>
        <Progress value={percentage} className="h-1.5 mt-1" />
      </div>
    </div>
  )
}

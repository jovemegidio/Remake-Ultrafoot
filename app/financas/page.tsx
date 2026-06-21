"use client"

import { useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
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
  AlertTriangle,
} from "lucide-react"
import { GameHeader } from "@/components/game-header"
import { TeamCrest } from "@/components/team-crest"
import { Progress } from "@/components/ui/progress"
import { formatCurrency } from "@/lib/teams-data"
import { useUserTeam } from "@/lib/save-system"
import { useGameEngine } from "@/lib/game-engine"
import { useGameManager } from "@/lib/use-game-manager"
import { useDiscordActivity } from "@/hooks/use-discord-rpc"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"

// Premiações por posição no Brasileirao 2026 (total ~R$435M distribuidos)
const PRIZE_MONEY = {
  champion: 77000000,   // R$77M - Campeao
  second: 60000000,     // R$60M
  third: 50000000,      // R$50M
  fourth: 43000000,     // R$43M - G4 / Libertadores
  fifth: 36000000,      // R$36M
  sixth: 31000000,      // R$31M
  seventh: 26000000,    // R$26M
  eighth: 22000000,     // R$22M
  ninth: 17000000,      // R$17M
  tenth: 13500000,      // R$13.5M
  eleventh: 11000000,   // R$11M
  twelfth: 9000000,     // R$9M
  thirteenth: 7500000,  // R$7.5M
  fourteenth: 6000000,  // R$6M
  fifteenth: 5000000,   // R$5M
  sixteenth: 4000000,   // R$4M
  // Rebaixados
  seventeenth: 3500000, // R$3.5M
  eighteenth: 3000000,  // R$3M
  nineteenth: 2500000,  // R$2.5M
  twentieth: 2000000,   // R$2M
}

// Premiações da Copa do Brasil 2026
const COPA_PRIZE = {
  firstRound: 1600000,
  secondRound: 1950000,
  thirdRound: 2400000,
  roundOf16: 3400000,
  quarterFinals: 4500000,
  semiFinals: 9000000,
  runnerUp: 34000000,
  champion: 80000000,
}

// Premiações Libertadores 2026 (USD x cambio BRL ~5.85)
const LIBERTADORES_PRIZE = {
  groupStage: 3000000 * 5.85,   // USD to BRL
  roundOf16: 1500000 * 5.85,
  quarterFinals: 2000000 * 5.85,
  semiFinals: 2500000 * 5.85,
  runnerUp: 6000000 * 5.85,
  champion: 23000000 * 5.85,
}

export default function FinancasPage() {
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
  const { team: userTeam } = useUserTeam()
  useDiscordActivity("Gerenciando finanças", userTeam.nome)
  const gameEngine = useGameEngine()
  const { currentWeek, currentSeason, userPosition, standings, hydrated } = useGameManager()
  const t = useTranslation()

  // Calcula receitas dinamicas
  const dynamicFinances = useMemo(() => {
    if (!userTeam) return null

    // Base de receitas
    const tvRights = Math.round(userTeam.prestigio * 25000 + 1500000) // Baseado no prestigio
    const sponsorship = Math.round(userTeam.prestigio * 15000 + 800000)
    
    // Bilheteria baseada em jogos em casa jogados
    const homeMatches = gameEngine.matchResults.filter(m => m.homeTeam === userTeam.curto).length
    const avgAttendance = Math.round((userTeam.estadio_cap || 30000) * 0.7)
    const ticketPrice = 50 + (userTeam.prestigio * 0.5)
    const ticketRevenue = homeMatches * avgAttendance * ticketPrice

    // Premiacoes estimadas baseadas na posicao atual
    const prizeKeys = Object.keys(PRIZE_MONEY) as (keyof typeof PRIZE_MONEY)[]
    const estimatedPrize = userPosition > 0 ? PRIZE_MONEY[prizeKeys[userPosition - 1]] || 0 : 0

    // Despesas
    const totalWages = gameEngine.squadPlayers.reduce((sum, p) => sum + (p.contract?.salary || 0), 0) * 4 // Mensal
    const scoutWages = gameEngine.scouts.reduce((sum, s) => sum + s.salary, 0) * 4
    const infrastructure = Math.round((userTeam.estadio_cap || 30000) * 5)
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
          const ticketRev = Math.round((userTeam?.estadio_cap || 30000) * 0.7 * 55)
          transactions.push({
            type: "income",
            description: `${t.finances.ticketing} vs ${match.awayTeam}`,
            value: ticketRev,
            date: `${t.common.week} ${match.week}`,
          })
        }
      }
    })

    // Salarios semanais
    if (currentWeek > 0) {
      transactions.push({
        type: "expense",
        description: t.finances.weeklyPayroll,
        value: dynamicFinances?.expenses.wages ? Math.round(dynamicFinances.expenses.wages / 4) : 0,
        date: `${t.common.week} ${currentWeek}`,
      })
    }

    // Cota de TV mensal
    if (currentWeek % 4 === 0) {
      transactions.push({
        type: "income",
        description: t.finances.tvRightsSlot,
        value: dynamicFinances?.income.tvRights || 0,
        date: `${t.common.week} ${currentWeek}`,
      })
    }

    return transactions.slice(0, 6)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameEngine.matchResults, userTeam, currentWeek, dynamicFinances, t])

  if (!hydrated || !userTeam || !dynamicFinances) {
    return (
      <div className="h-screen md:pl-0 pl-0 pb-20 md:pb-0 bg-[#050508] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const wagePercentage = dynamicFinances.wageBudget > 0 ? (dynamicFinances.wageUsed / dynamicFinances.wageBudget) * 100 : 0

  return (
    <div className="h-screen md:pl-0 pl-0 pb-20 md:pb-0 bg-[#050508] flex flex-col overflow-hidden">
      <GameHeader team={userTeam} />

      <main className="flex-1 p-4 overflow-y-auto space-y-4 scrollbar-thin">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/50">{t.common.season} {currentSeason}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/50">
            <Calendar className="h-4 w-4" />
            {t.common.week} {currentWeek}/38
          </div>
        </div>

        {wagePercentage >= 100 && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-red-400" />
              <div>
                <h2 className="text-sm font-semibold text-red-200">Limite salarial excedido</h2>
                <p className="mt-1 text-xs leading-relaxed text-red-100/70">
                  A folha esta em {wagePercentage.toFixed(0)}% do limite. Renegocie contratos, venda atletas ou aumente receitas para liberar margem de contratacao.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Balance Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-xs text-white/40 font-medium tracking-wider">
              <Wallet className="h-4 w-4 text-[#00ffc8]" />
              {t.finances.currentBalanceHeader}
            </div>
            <div className="mt-2 text-2xl font-semibold text-[#00ffc8]">
              {formatCurrency(dynamicFinances.balance)}
            </div>
            <div className={cn(
              "mt-1 flex items-center gap-1 text-xs",
              dynamicFinances.netIncome >= 0 ? "text-[#00ffc8]" : "text-red-400"
            )}>
              {dynamicFinances.netIncome >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{dynamicFinances.netIncome >= 0 ? "+" : ""}{formatCurrency(dynamicFinances.netIncome)}/mes</span>
            </div>
          </div>

          <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-xs text-white/40 font-medium tracking-wider">
              <TrendingUp className="h-4 w-4 text-blue-400" />
              {t.finances.monthlyIncomeHeader}
            </div>
            <div className="mt-2 text-2xl font-semibold text-blue-400">
              {formatCurrency(dynamicFinances.income.total)}
            </div>
            <div className="mt-1 text-xs text-white/40">
              {t.finances.homeMatchesN(dynamicFinances.homeMatches)}
            </div>
          </div>

          <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-xs text-white/40 font-medium tracking-wider">
              <TrendingDown className="h-4 w-4 text-red-400" />
              {t.finances.monthlyExpensesHeader}
            </div>
            <div className="mt-2 text-2xl font-semibold text-red-400">
              {formatCurrency(dynamicFinances.expenses.total)}
            </div>
            <div className="mt-1 text-xs text-white/40">
              {t.finances.playersN(gameEngine.squadPlayers.length)} + {t.finances.scoutsN(gameEngine.scouts.length)}
            </div>
          </div>

          <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-xs text-white/40 font-medium tracking-wider">
              <DollarSign className="h-4 w-4 text-yellow-400" />
              {t.finances.transferBudgetHeader}
            </div>
            <div className="mt-2 text-2xl font-semibold text-yellow-400">
              {formatCurrency(dynamicFinances.transferBudget)}
            </div>
            <div className="mt-1 text-xs text-white/40">
              {t.finances.availableForHiring}
            </div>
          </div>
        </div>

        {/* Breakdown Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Income Breakdown */}
          <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.04] bg-white/[0.02]">
              <TrendingUp className="h-4 w-4 text-blue-400" />
              <h2 className="text-xs font-medium text-white tracking-wider">{t.finances.income.toUpperCase()}</h2>
            </div>
            <div className="p-4 space-y-4">
              <FinanceItem
                icon={Tv}
                label={t.finances.tvRights}
                value={dynamicFinances.income.tvRights}
                total={dynamicFinances.income.total}
                color="text-primary"
                isIncome
              />
              <FinanceItem
                icon={Ticket}
                label={t.finances.ticketing}
                value={dynamicFinances.income.ticketRevenue}
                total={dynamicFinances.income.total}
                color="text-accent"
                isIncome
                subtitle={t.finances.avgAttendanceN(dynamicFinances.avgAttendance)}
              />
              <FinanceItem
                icon={Building2}
                label={t.finances.sponsorship}
                value={dynamicFinances.income.sponsorship}
                total={dynamicFinances.income.total}
                color="text-yellow-400"
                isIncome
              />
              <FinanceItem
                icon={Trophy}
                label={t.finances.estimatedPrizes}
                value={dynamicFinances.income.estimatedPrize}
                total={dynamicFinances.income.total}
                color="text-purple-400"
                isIncome
                subtitle={t.finances.yourPosition(userPosition)}
              />
            </div>
          </div>

          {/* Expense Breakdown */}
          <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.04] bg-white/[0.02]">
              <TrendingDown className="h-4 w-4 text-red-400" />
              <h2 className="text-xs font-medium text-white tracking-wider">{t.finances.expenses.toUpperCase()}</h2>
            </div>
            <div className="p-4 space-y-4">
              <FinanceItem
                icon={Users}
                label={t.finances.playerSalaries}
                value={dynamicFinances.expenses.wages}
                total={dynamicFinances.expenses.total}
                color="text-red-400"
                isIncome={false}
                subtitle={t.finances.playersN(gameEngine.squadPlayers.length)}
              />
              <FinanceItem
                icon={Target}
                label={t.finances.scoutSalaries}
                value={dynamicFinances.expenses.scoutWages}
                total={dynamicFinances.expenses.total}
                color="text-orange-400"
                isIncome={false}
                subtitle={t.finances.scoutsN(gameEngine.scouts.length)}
              />
              <FinanceItem
                icon={Building2}
                label={t.finances.infrastructure}
                value={dynamicFinances.expenses.infrastructure}
                total={dynamicFinances.expenses.total}
                color="text-blue-400"
                isIncome={false}
              />
              <FinanceItem
                icon={Shirt}
                label={t.finances.techStaff}
                value={dynamicFinances.expenses.staff}
                total={dynamicFinances.expenses.total}
                color="text-cyan-400"
                isIncome={false}
              />
              <FinanceItem
                icon={ShoppingCart}
                label={t.finances.other}
                value={dynamicFinances.expenses.other}
                total={dynamicFinances.expenses.total}
                color="text-white/50"
                isIncome={false}
              />
            </div>
          </div>
        </div>

        {/* Prize Money Section */}
        <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.04] bg-white/[0.02]">
            <Award className="h-4 w-4 text-yellow-400" />
            <h2 className="text-xs font-medium text-white tracking-wider">{t.finances.prizesByCompetition}</h2>
          </div>
          <div className="p-4 grid gap-4 md:grid-cols-3">
            {/* Brasileirao */}
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.04]">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-5 w-5 text-[#00ffc8]" />
                <span className="text-sm font-medium text-white">{t.competitions.brasileirao}</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-white/50">{t.finances.champion}</span>
                  <span className="text-[#00ffc8] font-medium">{formatCurrency(PRIZE_MONEY.champion)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">G4 (4o lugar)</span>
                  <span className="text-white/70">{formatCurrency(PRIZE_MONEY.fourth)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">{t.finances.yourPosition(userPosition)}</span>
                  <span className="text-primary font-medium">
                    {formatCurrency(Object.values(PRIZE_MONEY)[userPosition - 1] || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Copa do Brasil */}
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.04]">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-5 w-5 text-yellow-400" />
                <span className="text-sm font-medium text-white">{t.competitions.copaDoBrasil}</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-white/50">{t.finances.champion}</span>
                  <span className="text-yellow-400 font-medium">{formatCurrency(COPA_PRIZE.champion)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">{t.finances.runnerUp}</span>
                  <span className="text-white/70">{formatCurrency(COPA_PRIZE.runnerUp)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">{t.competitions.roundOf16}</span>
                  <span className="text-white/70">{formatCurrency(COPA_PRIZE.roundOf16)}</span>
                </div>
              </div>
            </div>

            {/* Libertadores */}
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.04]">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-5 w-5 text-amber-400" />
                <span className="text-sm font-medium text-white">{t.competitions.libertadores}</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-white/50">{t.finances.champion}</span>
                  <span className="text-amber-400 font-medium">{formatCurrency(LIBERTADORES_PRIZE.champion)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">{t.finances.runnerUp}</span>
                  <span className="text-white/70">{formatCurrency(LIBERTADORES_PRIZE.runnerUp)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">{t.competitions.groupStage}</span>
                  <span className="text-white/70">{formatCurrency(LIBERTADORES_PRIZE.groupStage)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Wage Budget & Recent Transactions */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Wage Budget */}
          <div className="rounded-xl bg-[#0c0c10] border border-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-xs text-white/40 font-medium tracking-wider mb-4">
              <Users className="h-4 w-4" />
              {t.finances.wageBill}
            </div>
            <div className="space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-sm text-white/50">{t.finances.used}</div>
                  <div className="text-2xl font-semibold text-white">{formatCurrency(dynamicFinances.wageUsed)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-white/50">{t.finances.limit}</div>
                  <div className="text-lg text-white/50">{formatCurrency(dynamicFinances.wageBudget)}</div>
                </div>
              </div>
              <Progress value={Math.min(100, wagePercentage)} className="h-2" />
              <div className="flex items-center justify-between text-xs">
                <span className={wagePercentage > 90 ? "text-red-400" : "text-white/50"}>
                  {t.finances.usedPercentage(wagePercentage.toFixed(0))}
                </span>
                <span className="text-[#00ffc8]">
                  {formatCurrency(Math.max(0, dynamicFinances.wageBudget - dynamicFinances.wageUsed))} {t.finances.availableForHiring}
                </span>
              </div>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="lg:col-span-2 rounded-xl bg-[#0c0c10] border border-white/[0.04] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04] bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-yellow-400" />
                <h2 className="text-xs font-medium text-white tracking-wider">{t.finances.recentTransactions}</h2>
              </div>
            </div>
            <div className="divide-y divide-white/5 max-h-64 overflow-y-auto scrollbar-thin">
              {recentTransactions.length > 0 ? (
                recentTransactions.map((tx, index) => (
                  <div key={index} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        tx.type === "income" ? "bg-[#00ffc8]/20" : "bg-red-400/20"
                      }`}>
                        {tx.type === "income" ? (
                          <ArrowUpRight className="h-4 w-4 text-[#00ffc8]" />
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
                      tx.type === "income" ? "text-[#00ffc8]" : "text-red-400"
                    }`}>
                      {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.value)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="px-5 py-8 text-center text-white/40 text-sm">
                  {t.finances.noTransactions}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

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
          <span className={cn("text-sm font-medium", isIncome ? "text-[#00ffc8]" : "text-red-400")}>
            {formatCurrency(value)}
          </span>
        </div>
        <Progress value={percentage} className="h-1.5 mt-1" />
      </div>
    </div>
  )
}

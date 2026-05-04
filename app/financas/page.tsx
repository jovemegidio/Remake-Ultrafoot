"use client"

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
} from "lucide-react"
import { GameSidebar } from "@/components/game-sidebar"
import { GameHeader } from "@/components/game-header"
import { MusicPlayer } from "@/components/music-player"
import { TeamCrest } from "@/components/team-crest"
import { Progress } from "@/components/ui/progress"
import { getTeamByShort, serieATeams, formatCurrency } from "@/lib/teams-data"

const userTeam = getTeamByShort("RBB") || serieATeams[0]

// Financial data
const financialData = {
  balance: userTeam.saldo,
  monthlyIncome: 4500000,
  monthlyExpenses: 3200000,
  transferBudget: 15000000,
  wageBudget: 8500000,
  wageUsed: 6200000,
}

const incomeBreakdown = [
  { label: "Direitos de TV", value: 2100000, icon: Tv, color: "text-primary" },
  { label: "Bilheteria", value: 850000, icon: Ticket, color: "text-accent" },
  { label: "Patrocinios", value: 1200000, icon: Building2, color: "text-gold" },
  { label: "Premiacoes", value: 350000, icon: Trophy, color: "text-purple-400" },
]

const expenseBreakdown = [
  { label: "Salarios", value: 2400000, icon: Users, color: "text-destructive" },
  { label: "Infraestrutura", value: 450000, icon: Building2, color: "text-orange-400" },
  { label: "Staff", value: 250000, icon: Shirt, color: "text-blue-400" },
  { label: "Outros", value: 100000, icon: ShoppingCart, color: "text-muted-foreground" },
]

const recentTransactions = [
  { type: "income", description: "Cota mensal de TV", value: 2100000, date: "01/01/2026" },
  { type: "expense", description: "Folha salarial - Janeiro", value: 2400000, date: "05/01/2026" },
  { type: "income", description: "Patrocinio master", value: 800000, date: "10/01/2026" },
  { type: "expense", description: "Manutencao do estadio", value: 150000, date: "12/01/2026" },
  { type: "income", description: "Bilheteria - Amistoso", value: 320000, date: "15/01/2026" },
]

export default function FinancasPage() {
  const netIncome = financialData.monthlyIncome - financialData.monthlyExpenses
  const wagePercentage = (financialData.wageUsed / financialData.wageBudget) * 100

  return (
    <div className="min-h-screen pl-[72px] pb-24 bg-[#0a0a0a]">
      <GameSidebar />
      <GameHeader team={userTeam} />

      <main className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Financas</h1>
          <p className="text-sm text-white/50 mt-1">Gestao financeira do clube - Temporada 2026</p>
        </div>

        {/* Balance Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-[#141414] border border-white/5 p-4">
            <div className="flex items-center gap-2 text-xs text-white/40 font-medium tracking-wider">
              <Wallet className="h-4 w-4 text-[#1db954]" />
              SALDO ATUAL
            </div>
            <div className="mt-2 text-2xl font-semibold text-[#1db954]">
              {formatCurrency(financialData.balance)}
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-[#1db954]">
              <TrendingUp className="h-3 w-3" />
              <span>+{formatCurrency(netIncome)}/mes</span>
            </div>
          </div>

          <div className="rounded-xl bg-[#141414] border border-white/5 p-4">
            <div className="flex items-center gap-2 text-xs text-white/40 font-medium tracking-wider">
              <TrendingUp className="h-4 w-4 text-blue-400" />
              RECEITA MENSAL
            </div>
            <div className="mt-2 text-2xl font-semibold text-blue-400">
              {formatCurrency(financialData.monthlyIncome)}
            </div>
            <div className="mt-1 text-xs text-white/40">
              Previsao para janeiro
            </div>
          </div>

          <div className="rounded-xl bg-[#141414] border border-white/5 p-4">
            <div className="flex items-center gap-2 text-xs text-white/40 font-medium tracking-wider">
              <TrendingDown className="h-4 w-4 text-red-400" />
              DESPESAS MENSAIS
            </div>
            <div className="mt-2 text-2xl font-semibold text-red-400">
              {formatCurrency(financialData.monthlyExpenses)}
            </div>
            <div className="mt-1 text-xs text-white/40">
              Custos fixos e variaveis
            </div>
          </div>

          <div className="rounded-xl bg-[#141414] border border-white/5 p-4">
            <div className="flex items-center gap-2 text-xs text-white/40 font-medium tracking-wider">
              <DollarSign className="h-4 w-4 text-yellow-400" />
              VERBA DE TRANSFERENCIAS
            </div>
            <div className="mt-2 text-2xl font-semibold text-yellow-400">
              {formatCurrency(financialData.transferBudget)}
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
              {incomeBreakdown.map((item) => (
                <div key={item.label} className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-lg bg-card flex items-center justify-center ${item.color}`}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{item.label}</span>
                      <span className="text-sm font-medium text-primary">{formatCurrency(item.value)}</span>
                    </div>
                    <Progress 
                      value={(item.value / financialData.monthlyIncome) * 100} 
                      className="h-1.5 mt-1" 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Expense Breakdown */}
          <div className="rounded-xl bg-[#141414] border border-white/5 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5 bg-white/[0.02]">
              <TrendingDown className="h-4 w-4 text-red-400" />
              <h2 className="text-xs font-medium text-white tracking-wider">DESPESAS</h2>
            </div>
            <div className="p-4 space-y-4">
              {expenseBreakdown.map((item) => (
                <div key={item.label} className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-lg bg-card flex items-center justify-center ${item.color}`}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{item.label}</span>
                      <span className="text-sm font-medium text-destructive">{formatCurrency(item.value)}</span>
                    </div>
                    <Progress 
                      value={(item.value / financialData.monthlyExpenses) * 100} 
                      className="h-1.5 mt-1" 
                    />
                  </div>
                </div>
              ))}
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
                  <div className="text-2xl font-semibold text-white">{formatCurrency(financialData.wageUsed)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-white/50">Limite</div>
                  <div className="text-lg text-white/50">{formatCurrency(financialData.wageBudget)}</div>
                </div>
              </div>
              <Progress value={wagePercentage} className="h-2" />
              <div className="flex items-center justify-between text-xs">
                <span className={wagePercentage > 90 ? "text-red-400" : "text-white/50"}>
                  {wagePercentage.toFixed(0)}% utilizado
                </span>
                <span className="text-[#1db954]">
                  {formatCurrency(financialData.wageBudget - financialData.wageUsed)} disponivel
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
            <div className="divide-y divide-white/5">
              {recentTransactions.map((tx, index) => (
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
              ))}
            </div>
          </div>
        </div>
      </main>

      <MusicPlayer />
    </div>
  )
}

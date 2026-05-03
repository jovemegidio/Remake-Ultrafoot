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
    <div className="min-h-screen pl-[72px] pb-24">
      <GameSidebar />

      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-6">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-display tracking-widest text-primary">ULTRAFOOT</span>
          <span className="text-border">/</span>
          <span className="text-foreground">Financas</span>
        </div>
        <div className="flex items-center gap-2">
          <TeamCrest team={userTeam} size="sm" />
          <span className="text-sm font-medium">{userTeam.nome}</span>
        </div>
      </header>

      <main className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-display-italic text-3xl tracking-tight">FINANCAS</h1>
          <p className="text-sm text-muted-foreground">Gestao financeira do clube - Temporada 2026</p>
        </div>

        {/* Balance Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="eafc-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-display tracking-widest">
              <Wallet className="h-4 w-4 text-accent" />
              SALDO ATUAL
            </div>
            <div className="mt-2 font-display-italic text-3xl text-accent">
              {formatCurrency(financialData.balance)}
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-accent">
              <TrendingUp className="h-3 w-3" />
              <span>+{formatCurrency(netIncome)}/mes</span>
            </div>
          </div>

          <div className="eafc-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-display tracking-widest">
              <TrendingUp className="h-4 w-4 text-primary" />
              RECEITA MENSAL
            </div>
            <div className="mt-2 font-display-italic text-3xl text-primary">
              {formatCurrency(financialData.monthlyIncome)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Previsao para janeiro
            </div>
          </div>

          <div className="eafc-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-display tracking-widest">
              <TrendingDown className="h-4 w-4 text-destructive" />
              DESPESAS MENSAIS
            </div>
            <div className="mt-2 font-display-italic text-3xl text-destructive">
              {formatCurrency(financialData.monthlyExpenses)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Custos fixos e variaveis
            </div>
          </div>

          <div className="eafc-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-display tracking-widest">
              <DollarSign className="h-4 w-4 text-gold" />
              VERBA DE TRANSFERENCIAS
            </div>
            <div className="mt-2 font-display-italic text-3xl text-gold">
              {formatCurrency(financialData.transferBudget)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Disponivel para contratacoes
            </div>
          </div>
        </div>

        {/* Breakdown Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Income Breakdown */}
          <div className="eafc-card overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-card/50">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="font-display tracking-widest text-xs">RECEITAS</h2>
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
          <div className="eafc-card overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-card/50">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <h2 className="font-display tracking-widest text-xs">DESPESAS</h2>
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
          <div className="eafc-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-display tracking-widest mb-4">
              <Users className="h-4 w-4" />
              FOLHA SALARIAL
            </div>
            <div className="space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Utilizado</div>
                  <div className="font-display-italic text-2xl">{formatCurrency(financialData.wageUsed)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Limite</div>
                  <div className="font-display text-lg text-muted-foreground">{formatCurrency(financialData.wageBudget)}</div>
                </div>
              </div>
              <Progress value={wagePercentage} className="h-2" />
              <div className="flex items-center justify-between text-xs">
                <span className={wagePercentage > 90 ? "text-destructive" : "text-muted-foreground"}>
                  {wagePercentage.toFixed(0)}% utilizado
                </span>
                <span className="text-accent">
                  {formatCurrency(financialData.wageBudget - financialData.wageUsed)} disponivel
                </span>
              </div>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="lg:col-span-2 eafc-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card/50">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-gold" />
                <h2 className="font-display tracking-widest text-xs">TRANSACOES RECENTES</h2>
              </div>
            </div>
            <div className="divide-y divide-border">
              {recentTransactions.map((tx, index) => (
                <div key={index} className="flex items-center justify-between px-5 py-3 hover:bg-card/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                      tx.type === "income" ? "bg-accent/20" : "bg-destructive/20"
                    }`}>
                      {tx.type === "income" ? (
                        <ArrowUpRight className="h-4 w-4 text-accent" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm">{tx.description}</div>
                      <div className="text-xs text-muted-foreground">{tx.date}</div>
                    </div>
                  </div>
                  <span className={`font-display text-sm ${
                    tx.type === "income" ? "text-accent" : "text-destructive"
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

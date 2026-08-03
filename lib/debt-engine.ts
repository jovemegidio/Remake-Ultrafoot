export type DebtPreset = "none" | "light" | "realistic" | "high"

export interface ClubDebtState {
  enabled: boolean
  originalPrincipal: number
  principal: number
  annualInterestRate: number
  termMonths: number
  monthsPaid: number
  monthlyPayment: number
  nextPaymentWeek: number
  missedPayments: number
  renegotiations: number
  sponsorContributions: number
}

export interface DebtConsequences {
  level: "regular" | "attention" | "overdue" | "embargo" | "wage_crisis" | "insolvency"
  label: string
  description: string
  moraleDelta: number
  confidenceDelta: number
  transferEmbargo: boolean
}

const PRESETS: Record<Exclude<DebtPreset, "none">, { ratio: number; rate: number; months: number }> = {
  light: { ratio: .15, rate: .06, months: 60 },
  realistic: { ratio: .35, rate: .095, months: 84 },
  high: { ratio: .65, rate: .14, months: 120 },
}

export function createClubDebt(preset: DebtPreset, clubValue = 100_000_000): ClubDebtState {
  if (preset === "none") return { enabled:false,originalPrincipal:0,principal:0,annualInterestRate:0,termMonths:0,monthsPaid:0,monthlyPayment:0,nextPaymentWeek:4,missedPayments:0,renegotiations:0,sponsorContributions:0 }
  const p=PRESETS[preset], principal=Math.round(clubValue*p.ratio), monthlyRate=p.rate/12
  const payment=Math.round(principal*monthlyRate/(1-Math.pow(1+monthlyRate,-p.months)))
  return { enabled:true,originalPrincipal:principal,principal,annualInterestRate:p.rate,termMonths:p.months,monthsPaid:0,monthlyPayment:payment,nextPaymentWeek:4,missedPayments:0,renegotiations:0,sponsorContributions:0 }
}

export function processDebtMonth(debt: ClubDebtState, availableBalance: number): { debt: ClubDebtState; paid: number; interest: number; principalPaid: number } {
  const next={...debt};if(!next.enabled||next.principal<=0)return{debt:next,paid:0,interest:0,principalPaid:0}
  const interest=Math.round(next.principal*next.annualInterestRate/12), due=Math.min(next.principal+interest,next.monthlyPayment)
  const paid=Math.max(0,Math.min(availableBalance,due));const principalPaid=Math.max(0,paid-interest)
  if(paid<due){
    next.missedPayments++
    // Juros não pagos são capitalizados; além deles há multa de mora de 2% sobre
    // o restante da parcela. Sem isso, deixar de pagar podia sair mais barato.
    const unpaidInterest=Math.max(0,interest-paid)
    next.principal+=unpaidInterest+Math.round((due-paid)*.02)
  }else{
    next.monthsPaid++
    // Regularização é gradual: uma parcela paga não apaga meses de crise, mas
    // permite ao clube sair do embargo depois de uma sequência de pagamentos.
    next.missedPayments=Math.max(0,next.missedPayments-1)
  }
  next.principal=Math.max(0,next.principal-principalPaid);next.nextPaymentWeek+=4;if(next.principal===0)next.enabled=false
  return{debt:next,paid,interest:Math.min(paid,interest),principalPaid}
}

/** Consequências esportivas e administrativas conforme a inadimplência. */
export function debtConsequences(debt: ClubDebtState | undefined): DebtConsequences {
  const atrasos = debt?.enabled ? debt.missedPayments : 0
  if (atrasos >= 8) return { level:"insolvency",label:"Risco de insolvência",description:"Salários e fornecedores estão comprometidos; atletas podem forçar saída e a diretoria corre risco de intervenção.",moraleDelta:-10,confidenceDelta:-14,transferEmbargo:true }
  if (atrasos >= 6) return { level:"wage_crisis",label:"Salários em risco",description:"O caixa não sustenta folha e dívida ao mesmo tempo. O elenco perde confiança e jogadores podem pedir para sair.",moraleDelta:-7,confidenceDelta:-10,transferEmbargo:true }
  if (atrasos >= 3) return { level:"embargo",label:"Embargo de transferências",description:"Contratações e novos empréstimos estão suspensos até a regularização das parcelas.",moraleDelta:-4,confidenceDelta:-6,transferEmbargo:true }
  if (atrasos === 2) return { level:"overdue",label:"Inadimplência",description:"Duas parcelas estão em atraso; fornecedores pressionam e o ambiente interno começa a piorar.",moraleDelta:-2,confidenceDelta:-3,transferEmbargo:false }
  if (atrasos === 1) return { level:"attention",label:"Parcela em atraso",description:"O clube recebeu a primeira cobrança e precisa recompor o caixa.",moraleDelta:-1,confidenceDelta:-1,transferEmbargo:false }
  return { level:"regular",label:"Dívida regular",description:"Parcelas em dia e risco financeiro controlado.",moraleDelta:0,confidenceDelta:0,transferEmbargo:false }
}

/**
 * Caixa mensal que uma diretoria sucessora consegue reservar para a dívida.
 * Usa porte e prestígio do clube; não depende do caixa do novo clube do usuário.
 */
export function successorDebtBudget(clubBalance: number, prestige: number): number {
  return Math.max(100_000, Math.round(Math.max(0, clubBalance) * .0125 + Math.max(0, prestige) * 5_000))
}

export function debtTransferLimit(debt: ClubDebtState | undefined, balance: number): number {
  if(!debt?.enabled)return Math.max(0,balance)
  const burden=debt.principal/Math.max(1,debt.originalPrincipal)
  return Math.max(0,Math.round(balance*(burden>.75?.25:burden>.4?.5:.75)))
}

/**
 * Transferencias CONGELADAS por inadimplencia: atrasar 3+ parcelas trava as
 * contratacoes (a diretoria corta o mercado ate regularizar). Antes missedPayments
 * era incrementado e NUNCA lido — atrasar nao tinha consequencia nenhuma.
 */
export function transfersFrozen(debt: ClubDebtState | undefined): boolean {
  return debtConsequences(debt).transferEmbargo
}

/** Uma compra de `fee` e permitida? Respeita o teto por divido e o congelamento. */
export function canAffordTransfer(
  debt: ClubDebtState | undefined,
  balance: number,
  fee: number,
): { ok: boolean; reason?: "frozen" | "limit" } {
  if (transfersFrozen(debt)) return { ok: false, reason: "frozen" }
  if (fee > debtTransferLimit(debt, balance)) return { ok: false, reason: "limit" }
  return { ok: true }
}

/**
 * FINANCIAR uma contratacao: o clube toma um emprestimo para cobrir o que falta
 * no caixa. Antes a compra simplesmente falhava com "saldo insuficiente" — nao
 * havia como se endividar para reforcar o elenco, que e o ciclo real do futebol.
 *
 * Cria a divida se ainda nao existir, ou soma ao saldo devedor e recalcula a
 * parcela. A taxa de um credito novo e mais salgada que a da divida herdada.
 */
export function financeWithDebt(
  debt: ClubDebtState | undefined,
  amount: number,
  opts?: { rate?: number; months?: number },
): ClubDebtState {
  const valor = Math.max(0, Math.round(amount))
  const rate = opts?.rate ?? 0.13
  const months = opts?.months ?? 48
  if (!debt?.enabled || debt.principal <= 0) {
    const monthlyRate = rate / 12
    const payment = Math.round(valor * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months)))
    return {
      enabled: valor > 0, originalPrincipal: valor, principal: valor,
      annualInterestRate: rate, termMonths: months, monthsPaid: 0,
      monthlyPayment: payment, nextPaymentWeek: 4, missedPayments: 0,
      renegotiations: 0, sponsorContributions: 0,
    }
  }
  const next = { ...debt }
  next.principal += valor
  next.originalPrincipal += valor
  // Mistura a taxa nova ao saldo (media ponderada) e recalcula a parcela.
  const peso = valor / Math.max(1, next.principal)
  next.annualInterestRate = next.annualInterestRate * (1 - peso) + rate * peso
  const restante = Math.max(1, next.termMonths - next.monthsPaid)
  const r = next.annualInterestRate / 12
  next.monthlyPayment = Math.round(next.principal * r / (1 - Math.pow(1 + r, -restante)))
  return next
}

/** Quanto o clube consegue tomar emprestado agora (teto prudencial). */
export function borrowingCapacity(debt: ClubDebtState | undefined, weeklyIncome: number): number {
  if (transfersFrozen(debt)) return 0
  // Ate ~30 semanas de receita, menos o que ja deve.
  const teto = Math.max(0, Math.round(weeklyIncome * 30))
  const jaDevido = debt?.enabled ? debt.principal : 0
  return Math.max(0, teto - jaDevido)
}

export function renegotiateDebt(debt: ClubDebtState): ClubDebtState {
  if(!debt.enabled||debt.renegotiations>=2)return debt
  const next={...debt,annualInterestRate:debt.annualInterestRate+.01,termMonths:debt.termMonths+24,renegotiations:debt.renegotiations+1}
  const remaining=Math.max(1,next.termMonths-next.monthsPaid),rate=next.annualInterestRate/12
  next.monthlyPayment=Math.round(next.principal*rate/(1-Math.pow(1+rate,-remaining)));return next
}

/**
 * AMORTIZAR (quitar antecipado) a dívida com dinheiro do caixa — resposta direta
 * ao "como pago as dívidas?": além do desconto automático mensal, o técnico pode
 * abater o principal quando quiser. Retorna a dívida atualizada e o valor pago.
 */
export function amortizeDebt(debt: ClubDebtState, amount: number): { debt: ClubDebtState; paid: number } {
  if (!debt.enabled || debt.principal <= 0 || amount <= 0) return { debt, paid: 0 }
  const paid = Math.min(amount, debt.principal)
  const principal = debt.principal - paid
  const next: ClubDebtState = { ...debt, principal, enabled: principal > 0 }
  // Recalcula a parcela pelo saldo restante (fica mais leve depois de amortizar).
  if (principal > 0) {
    const remaining = Math.max(1, next.termMonths - next.monthsPaid)
    const rate = next.annualInterestRate / 12
    next.monthlyPayment = Math.round(principal * rate / (1 - Math.pow(1 + rate, -remaining)))
  } else {
    next.monthlyPayment = 0
  }
  return { debt: next, paid }
}

export function applySponsorDebtContribution(debt: ClubDebtState, amount: number): ClubDebtState {
  const contribution=Math.max(0,Math.min(amount,debt.principal));return{...debt,principal:debt.principal-contribution,sponsorContributions:debt.sponsorContributions+contribution,enabled:debt.principal-contribution>0}
}

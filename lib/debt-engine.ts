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
  if(paid<due){next.missedPayments++;next.principal+=Math.round((due-paid)*.02)}else next.monthsPaid++
  next.principal=Math.max(0,next.principal-principalPaid);next.nextPaymentWeek+=4;if(next.principal===0)next.enabled=false
  return{debt:next,paid,interest:Math.min(paid,interest),principalPaid}
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
  return Boolean(debt?.enabled && debt.missedPayments >= 3)
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

export function renegotiateDebt(debt: ClubDebtState): ClubDebtState {
  if(!debt.enabled||debt.renegotiations>=2)return debt
  const next={...debt,annualInterestRate:debt.annualInterestRate+.01,termMonths:debt.termMonths+24,renegotiations:debt.renegotiations+1}
  const remaining=Math.max(1,next.termMonths-next.monthsPaid),rate=next.annualInterestRate/12
  next.monthlyPayment=Math.round(next.principal*rate/(1-Math.pow(1+rate,-remaining)));return next
}

export function applySponsorDebtContribution(debt: ClubDebtState, amount: number): ClubDebtState {
  const contribution=Math.max(0,Math.min(amount,debt.principal));return{...debt,principal:debt.principal-contribution,sponsorContributions:debt.sponsorContributions+contribution,enabled:debt.principal-contribution>0}
}

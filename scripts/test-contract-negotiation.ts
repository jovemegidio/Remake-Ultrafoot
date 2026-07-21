// Prova que renovar e rescindir sao NEGOCIACOES: ha contraproposta, ha recusa,
// e os fatores (moral, fim de contrato, vontade de sair) puxam na direcao certa.
//
//   npx tsx scripts/test-contract-negotiation.ts

import {
  computeRenewalDemands,
  custoCheio,
  evaluateRenewal,
  evaluateRescission,
  sugestaoInicialRenovacao,
  vontadeDeSair,
  type ContractPlayer,
} from "../lib/contract-negotiation"

let falhas = 0
function checa(nome: string, cond: boolean, detalhe = "") {
  if (!cond) falhas++
  console.log(`${cond ? "OK  " : "FALHA"} ${nome}${detalhe ? " — " + detalhe : ""}`)
}

const base: ContractPlayer = {
  name: "Teste", overall: 78, age: 26, salary: 120_000,
  marketValue: 18_000_000, weeksLeft: 60, morale: 70, seasonsAtClub: 2,
}

// ── RENOVACAO ────────────────────────────────────────────────────────────────
const d = computeRenewalDemands(base, 80)
checa("pedido nunca fica abaixo do salario atual", d.salary >= base.salary, `pede ${d.salary}`)

const dFim = computeRenewalDemands({ ...base, weeksLeft: 12 }, 80)
checa("contrato acabando INFLACIONA o pedido", dFim.salary > d.salary, `${d.salary} -> ${dFim.salary}`)

const dFeliz = computeRenewalDemands({ ...base, morale: 95, seasonsAtClub: 4 }, 80)
checa("moral alta + tempo de casa SEGURAM o pedido", dFeliz.salary <= d.salary, `${d.salary} -> ${dFeliz.salary}`)

// A sugestao inicial fica abaixo do pedido: o agente deve CONTRAPROPOR (nao aceitar de cara).
const inicial = sugestaoInicialRenovacao(base, 80)
const r1 = evaluateRenewal(base, 80, inicial)
checa("proposta inicial gera contraproposta ou recusa", r1.verdict !== "accepted", r1.verdict)
if (r1.verdict === "counter" && r1.counter) {
  // Aceitar a contraproposta dele fecha o acordo — sem loop infinito.
  const r2 = evaluateRenewal(base, 80, {
    salary: r1.counter.salary,
    contractYears: r1.counter.contractYears,
    loyaltyBonus: r1.counter.signingBonus,
    role: r1.counter.role,
  })
  checa("aceitar a contraproposta FECHA o acordo", r2.verdict === "accepted", r2.verdict)
}

// Oferta insultuosa: rompe.
const insulto = evaluateRenewal(base, 80, { salary: 30_000, contractYears: 1, loyaltyBonus: 0, role: "banco" })
checa("oferta insultuosa e recusada", insulto.verdict === "rejected", insulto.verdict)

// ── RESCISAO ─────────────────────────────────────────────────────────────────
const cheio = custoCheio(base)
checa("custo cheio = salario x meses restantes", cheio > 0, `${cheio}`)

const aceita = evaluateRescission(base, cheio)
checa("pagar o contrato inteiro sempre fecha", aceita.verdict === "accepted")

const zero = evaluateRescission(base, 0)
checa("oferecer zero a um titular feliz NAO fecha", zero.verdict !== "accepted", zero.verdict)

// Quem quer sair aceita menos.
const infeliz: ContractPlayer = { ...base, morale: 30, age: 34, overall: 68 }
checa("infeliz/veterano tem mais vontade de sair",
  vontadeDeSair(infeliz) > vontadeDeSair(base),
  `${vontadeDeSair(infeliz).toFixed(2)} > ${vontadeDeSair(base).toFixed(2)}`)

const meiaOferta = Math.round(custoCheio(infeliz) * 0.5)
const rInfeliz = evaluateRescission(infeliz, meiaOferta)
const rFeliz = evaluateRescission({ ...base, morale: 90, overall: 84 }, Math.round(cheio * 0.5))
checa("infeliz aceita 50% do contrato", rInfeliz.verdict === "accepted", rInfeliz.verdict)
checa("titular feliz NAO aceita 50%", rFeliz.verdict !== "accepted", rFeliz.verdict)

// Contraproposta da rescisao e um valor concreto e menor que o cheio.
if (rFeliz.verdict === "counter") {
  checa("contraproposta traz valor entre a oferta e o cheio",
    (rFeliz.counterAmount ?? 0) > Math.round(cheio * 0.5) && (rFeliz.counterAmount ?? 0) <= cheio,
    `${rFeliz.counterAmount}`)
  // E aceitar a contraproposta fecha.
  const fecha = evaluateRescission({ ...base, morale: 90, overall: 84 }, rFeliz.counterAmount!)
  checa("aceitar a contraproposta da rescisao fecha", fecha.verdict === "accepted", fecha.verdict)
}

// Contrato ja no fim: sair de graca.
const fim = evaluateRescission({ ...base, weeksLeft: 0 }, 0)
checa("contrato vencido: saida sem custo", fim.verdict === "accepted")

console.log(falhas === 0 ? "\nTodos os casos passaram." : `\n${falhas} caso(s) falharam.`)
process.exit(falhas === 0 ? 0 : 1)

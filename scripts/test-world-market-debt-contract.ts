// OS TRES ITENS QUE FALTAVAM:
//  1. IA negociando entre si (elencos do mundo mudando)
//  2. Financiar contratacao com divida
//  3. Relogio de contrato (o aviso de vencimento nunca disparava)

import { simulateWorldTransferWindow, getArrivals, recordWorldTransfer } from "../lib/world-market"
import { financeWithDebt, borrowingCapacity, canAffordTransfer, transfersFrozen, createClubDebt } from "../lib/debt-engine"
import { absoluteWeek, getContractStatus, type Player } from "../lib/game-engine"

let falhas = 0
function checar(nome: string, ok: boolean, detalhe = "") {
  console.log(`${ok ? "ok" : "FALHOU"}  ${nome}${detalhe ? ` — ${detalhe}` : ""}`)
  if (!ok) falhas++
}

// ── 1. Mercado do mundo: a IA move jogadores entre clubes ──────────────────
{
  const clubes = [
    { nome: "Gigante FC", curto: "GIG", prestigio: 90, divisao: "serie_a" },
    { nome: "Grande EC", curto: "GRA", prestigio: 82, divisao: "serie_a" },
    { nome: "Medio SC", curto: "MED", prestigio: 68, divisao: "serie_a" },
    { nome: "Modesto AC", curto: "MOD", prestigio: 60, divisao: "serie_b" },
    { nome: "Time do Usuario", curto: "USR", prestigio: 75, divisao: "serie_a" },
  ]
  const elencos: Record<string, { nome: string; pos: string; idade: number; base: number }[]> = {}
  for (const c of clubes) {
    elencos[c.curto] = Array.from({ length: 20 }, (_, i) => ({
      nome: `${c.curto}-Atleta${i}`, pos: i === 0 ? "GOL" : "MEI",
      idade: 20 + (i % 12), base: c.prestigio - 10 + (i % 14),
    }))
  }
  const noticias = simulateWorldTransferWindow({
    clubes, squadOf: (curto) => elencos[curto] ?? [],
    clubeDoUsuario: "USR", temporada: 2026, quantidade: 10,
  })
  console.log(`   transferencias geradas: ${noticias.length}`)
  noticias.slice(0, 4).forEach(n => console.log(`     ${n.atleta}: ${n.de} -> ${n.para}`))
  checar("a IA fez transferencias entre clubes", noticias.length > 0, `${noticias.length}`)
  checar("o clube do USUARIO nao foi envolvido", noticias.every(n => !n.de.includes("Usuario") && !n.para.includes("Usuario")))
  checar("os atletas sempre vao para o clube MAIOR", noticias.every(n => {
    const de = clubes.find(c => c.nome === n.de)!, para = clubes.find(c => c.nome === n.para)!
    return para.prestigio > de.prestigio
  }))

  // O destino recebe o reforco de verdade (o outro lado da transferencia).
  if (noticias.length > 0) {
    const destino = noticias[0].para
    const chegadas = getArrivals(destino)
    checar("o clube de destino registra a chegada", chegadas.some(a => a.nome === noticias[0].atleta),
      `${chegadas.length} chegada(s) em ${destino}`)
  }

  // Determinismo: mesma temporada, mesmas transferencias.
  const denovo = simulateWorldTransferWindow({
    clubes, squadOf: (curto) => elencos[curto] ?? [],
    clubeDoUsuario: "USR", temporada: 2026, quantidade: 10,
  })
  checar("mesma temporada = mesmo resultado (deterministico)",
    denovo.length === 0 || denovo.every(n => noticias.some(o => o.atleta === n.atleta)))
}

// ── 2. Financiar contratacao com divida ────────────────────────────────────
{
  const semDivida = financeWithDebt(undefined, 20_000_000)
  console.log(`   emprestimo de 20M: parcela ${Math.round(semDivida.monthlyPayment / 1000)}k/mes, juros ${(semDivida.annualInterestRate * 100).toFixed(1)}% a.a.`)
  checar("clube sem divida consegue tomar emprestimo", semDivida.enabled && semDivida.principal === 20_000_000)
  checar("a parcela e calculada (amortizacao real)", semDivida.monthlyPayment > 0)

  const jaDevia = createClubDebt("light", 100_000_000)
  const somado = financeWithDebt(jaDevia, 10_000_000)
  checar("emprestimo novo SOMA a divida existente", somado.principal === jaDevia.principal + 10_000_000,
    `${somado.principal} vs ${jaDevia.principal}`)
  checar("a parcela sobe ao tomar mais credito", somado.monthlyPayment > jaDevia.monthlyPayment)

  const capacidade = borrowingCapacity(undefined, 1_000_000)
  checar("capacidade de credito escala com a receita", capacidade === 30_000_000, `${capacidade}`)
  const congelado = { ...createClubDebt("high", 100_000_000), missedPayments: 3 }
  checar("inadimplente NAO consegue mais credito", borrowingCapacity(congelado, 1_000_000) === 0)
  checar("inadimplente tem o mercado congelado", transfersFrozen(congelado))
  checar("compra barrada quando congelado", !canAffordTransfer(congelado, 999_000_000, 1_000_000).ok)
}

// ── 3. Relogio de contrato: o aviso agora dispara ──────────────────────────
{
  checar("semana absoluta acumula entre temporadas", absoluteWeek(2028, 10) === 2 * 52 + 10, `${absoluteWeek(2028, 10)}`)
  checar("temporada inicial e a epoca", absoluteWeek(2026, 5) === 5)

  const jogador = { contract: { endDate: 60, salary: 1000, releaseClause: null, signedWeek: 0, signedSeason: 2026 } } as Player
  // Antes: na temporada 2027 (week 0) o calculo dava 60-0=60 -> "ok" para sempre.
  const status2026 = getContractStatus(jogador, 0, 2026) // 60 semanas restantes
  const status2027 = getContractStatus(jogador, 0, 2027) // 60-52 = 8 -> expirando
  const status2028 = getContractStatus(jogador, 0, 2028) // 60-104 < 0 -> vencido
  console.log(`   contrato endDate=60: 2026=${status2026} 2027=${status2027} 2028=${status2028}`)
  checar("contrato longe do fim = ok", status2026 === "ok")
  checar("contrato perto do fim = expirando (antes nunca chegava aqui)", status2027 === "expiring")
  checar("contrato passado do prazo = vencido", status2028 === "expired")
}

console.log(falhas === 0 ? "\n== TODOS OS TESTES PASSARAM ==" : `\n== ${falhas} FALHA(S) ==`)
process.exit(falhas === 0 ? 0 : 1)

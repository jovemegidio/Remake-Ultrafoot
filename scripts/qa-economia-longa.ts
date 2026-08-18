// HARNESS DA ECONOMIA — a conta do clube ao longo de 20 temporadas.
//
// ⚠️ POR QUE ELE EXISTE, E O QUE ELE NAO E. A auditoria de 18/08/2026 mediu um
// sintoma: o saldo do clube fica entre 130 e 200 milhoes por 20 temporadas —
// dinheiro que nunca aperta. Mexer no multiplicador por palpite foi exatamente
// o que este projeto evitou no motor de partida, onde a calibracao so mudou
// depois de um harness de 20 mil jogos.
//
// Este harness mede o MODELO (as funcoes puras de `lib/club-economy`), nao o
// laco semanal inteiro — o laco vive num hook de React e nao roda sem tela.
// O que ele responde e a pergunta que importa: existe configuracao em que o
// clube NAO fecha a conta? Se a resposta for "nunca", nao ha tensao financeira
// possivel, e ai o defeito e de modelo, nao de numero solto.
//
// Ele imprime a tabela e so REPROVA quando a margem foge da faixa declarada —
// assim ele serve para calibrar hoje e para travar regressao amanha.

import {
  custoOperacionalSemanal, playerSalaryWeekly, weeklyIncomeFor, leaguePrizeMoney,
} from "../lib/club-economy"

const DIVISOES = ["serie_a", "serie_b", "serie_c", "serie_d", "premier_league", "championship", "la_liga", "eredivisie"]
const PRESTIGIOS = [30, 55, 80]

/** Um elenco plausivel para a divisao: 24 atletas em torno de um overall medio. */
function folhaSemanal(divisao: string, overallMedio: number): number {
  const elenco = Array.from({ length: 24 }, (_, i) => overallMedio + (i < 4 ? 6 : i < 12 ? 1 : -4))
  return elenco.reduce((total, ovr) => total + playerSalaryWeekly(ovr, divisao), 0)
}

/** Overall medio esperado por divisao — a regua que o proprio jogo usa nos elencos. */
const OVERALL_POR_DIVISAO: Record<string, number> = {
  serie_a: 74, serie_b: 66, serie_c: 60, serie_d: 55,
  premier_league: 80, championship: 70, la_liga: 79, eredivisie: 73,
}

interface Linha {
  divisao: string
  prestigio: number
  receita: number
  folha: number
  operacional: number
  margemSemanal: number
  razao: number
  saldoDeTemporada: number
}

const linhas: Linha[] = []
for (const divisao of DIVISOES) {
  for (const prestigio of PRESTIGIOS) {
    const overall = OVERALL_POR_DIVISAO[divisao] ?? 65
    // Clube de prestigio alto paga mais: o elenco dele e melhor que a media da liga.
    const overallDoClube = overall + (prestigio >= 80 ? 5 : prestigio >= 55 ? 0 : -4)
    const receita = weeklyIncomeFor(divisao, prestigio)
    const folha = folhaSemanal(divisao, overallDoClube)
    const operacional = custoOperacionalSemanal(divisao, prestigio)
    const margemSemanal = receita - folha - operacional
    const premio = leaguePrizeMoney(divisao, prestigio >= 80 ? 3 : prestigio >= 55 ? 10 : 17, 20)
    linhas.push({
      divisao, prestigio, receita, folha, operacional, margemSemanal,
      razao: receita / Math.max(1, folha + operacional),
      saldoDeTemporada: margemSemanal * 52 + premio,
    })
  }
}

const milhoes = (v: number) => `${(v / 1_000_000).toFixed(1)} mi`
console.log("divisao            prest  receita/sem   folha/sem    margem/sem   razao   saldo/ano")
for (const l of linhas) {
  console.log(
    `${l.divisao.padEnd(18)} ${String(l.prestigio).padEnd(6)} ${milhoes(l.receita).padStart(9)} ${milhoes(l.folha).padStart(11)} ${milhoes(l.margemSemanal).padStart(12)} ${l.razao.toFixed(2).padStart(7)} ${milhoes(l.saldoDeTemporada).padStart(11)}`,
  )
}

// ── O CLUBE QUE GASTA ────────────────────────────────────────────────────────
//
// A pergunta "existe risco financeiro?" nao se responde com o elenco medio: ela
// se responde com o elenco que o tecnico MONTA quando quer ganhar. Aqui o mesmo
// clube contrata seis pontos de overall acima do padrao da divisao — a decisao
// que o jogo oferece toda janela.
const gastadores = DIVISOES.map(divisao => {
  const prestigio = 55
  const overall = (OVERALL_POR_DIVISAO[divisao] ?? 65) + 6
  const receita = weeklyIncomeFor(divisao, prestigio)
  const folha = folhaSemanal(divisao, overall)
  const operacional = custoOperacionalSemanal(divisao, prestigio)
  return { divisao, margemSemanal: receita - folha - operacional, razao: receita / (folha + operacional) }
})
console.log("")
console.log("elenco 6 pontos acima do padrao da divisao (prestigio 55):")
for (const g of gastadores) {
  console.log(`  ${g.divisao.padEnd(18)} margem/sem ${milhoes(g.margemSemanal).padStart(10)}  razao ${g.razao.toFixed(2)}`)
}
const quebram = gastadores.filter(g => g.margemSemanal < 0)
console.log(`${quebram.length} de ${gastadores.length} divisoes ficam no vermelho ao reforcar o elenco.`)

const deficitarios = linhas.filter(l => l.margemSemanal < 0)
const superavitarios = linhas.filter(l => l.saldoDeTemporada > 0)
console.log(`\n${deficitarios.length} de ${linhas.length} configuracoes operam no vermelho na semana.`)
console.log(`${superavitarios.length} de ${linhas.length} fecham a TEMPORADA no azul (com premiacao).`)

// ── O que este gate trava ───────────────────────────────────────────────────
//
// 1. NINGUEM PODE SER IMUNE AO VERMELHO. Se toda configuracao fecha no azul, a
//    pressao financeira nao existe e o modo de gestao vira decoracao.
if (quebram.length === 0) {
  throw new Error("reforcar o elenco nao leva ao vermelho em divisao nenhuma — sem risco financeiro nao ha decisao de gestao")
}
// 2. E NINGUEM PODE ESTAR CONDENADO. Se nada fecha no azul, o jogo e um funil.
if (superavitarios.length === 0) {
  throw new Error("nenhuma configuracao fecha a temporada no azul — a economia esta impagavel")
}
// 3. A RAZAO RECEITA/DESPESA declarada no proprio `club-economy` e 1,2-1,6 para
//    clube bem gerido. Fora de uma faixa larga disso, alguem mexeu num numero
//    sem mexer no comentario.
const razaoMedia = linhas.reduce((t, l) => t + l.razao, 0) / linhas.length
if (razaoMedia < 0.8 || razaoMedia > 2.2) {
  throw new Error(`razao media receita/despesa fora da faixa esperada: ${razaoMedia.toFixed(2)}`)
}
console.log(`razao media receita/despesa: ${razaoMedia.toFixed(2)}`)
console.log("OK economia: ha clube que quebra, ha clube que lucra, e a razao media esta na faixa declarada")

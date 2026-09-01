/**
 * O DESEMPATE DA CLASSIFICACAO SEGUE A REGRA DA COMPETICAO.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/qa-desempate.ts
 *
 * ⚠️ ATE A 1.0.386 O JOGO ORDENAVA O MUNDO INTEIRO IGUAL: pontos → saldo de
 * gols → gols marcados, em TRES implementacoes independentes que concordavam no
 * mesmo erro. E o criterio certo ja estava declarado em `tiebreakers`, dentro
 * de `competition-regulations-2026.ts`, sem NENHUM leitor.
 *
 * ⚠️ NO BRASIL ISSO DECIDE TITULO E REBAIXAMENTO. A regra da CBF desempata por
 * NUMERO DE VITORIAS antes do saldo. Um clube com mais vitorias e saldo pior
 * ficava atras — e em 38 rodadas com quatro rebaixados, isso muda temporada.
 */
import { DESEMPATE_CBF, DESEMPATE_PADRAO, desempateDaDivisao, ordenarPorCriterios } from "@/lib/desempate"

let falhas = 0
const ok = (t: string) => console.log(`ok   ${t}`)
const erro = (t: string) => { console.log(`FALHA ${t}`); falhas++ }

function linha(nome: string, points: number, won: number, gf: number, ga: number) {
  return { nome, points, won, goalsFor: gf, goalsAgainst: ga }
}

// ── 1. No Brasil, vitorias vencem saldo ────────────────────────────────────
{
  // Mesmos pontos. "Vitorioso" tem MAIS vitorias e saldo PIOR.
  const vitorioso = linha("Vitorioso", 50, 15, 40, 35)   // 15 vitorias, saldo +5
  const saldoso   = linha("Saldoso",   50, 13, 45, 20)   // 13 vitorias, saldo +25
  const cbf = ordenarPorCriterios([saldoso, vitorioso], DESEMPATE_CBF)
  if (cbf[0].nome === "Vitorioso") ok("CBF: mais VITORIAS passa na frente de melhor saldo")
  else erro(`CBF: quem liderou foi ${cbf[0].nome} — o saldo voltou a mandar no Brasil`)

  const europa = ordenarPorCriterios([vitorioso, saldoso], DESEMPATE_PADRAO)
  if (europa[0].nome === "Saldoso") ok("padrao europeu: o saldo continua mandando")
  else erro(`padrao europeu: quem liderou foi ${europa[0].nome}`)
}

// ── 2. A divisao escolhe o criterio ────────────────────────────────────────
{
  const casos: [string, readonly string[], string][] = [
    ["serie_a", DESEMPATE_CBF, "Serie A brasileira"],
    ["serie_b", DESEMPATE_CBF, "Serie B"],
    ["paulistao_a1", DESEMPATE_CBF, "estadual"],
    ["brasileirao_fem_a1", DESEMPATE_CBF, "Brasileirao feminino"],
    ["premier_league", DESEMPATE_PADRAO, "Premier League"],
    ["la_liga", DESEMPATE_PADRAO, "La Liga"],
  ]
  for (const [divisao, esperado, rotulo] of casos) {
    const obtido = desempateDaDivisao(divisao)
    if (obtido.join("|") === esperado.join("|")) ok(`${rotulo} usa o criterio certo`)
    else erro(`${rotulo}: criterio ${obtido.join(" → ")}`)
  }
}

// ── 3. Pontos sempre mandam primeiro ───────────────────────────────────────
{
  const menosPontos = linha("Menos pontos", 40, 20, 90, 10)  // muito melhor em tudo
  const maisPontos  = linha("Mais pontos",  41, 5, 10, 40)
  const r = ordenarPorCriterios([menosPontos, maisPontos], DESEMPATE_CBF)
  if (r[0].nome === "Mais pontos") ok("ponto vale mais que qualquer desempate")
  else erro("um criterio de desempate passou na frente dos pontos")
}

// ── 4. Criterio desconhecido e PULADO, nao inventado ───────────────────────
{
  const a = linha("A", 10, 3, 9, 9)
  const b = linha("B", 10, 5, 9, 9)
  // "confronto direto" e "fair play" nao sao aplicaveis aqui: devem ser
  // ignorados e deixar as vitorias decidirem.
  const r = ordenarPorCriterios([a, b], ["pontos", "confronto direto", "fair play", "numero de vitorias"])
  if (r[0].nome === "B") ok("criterio que o jogo nao sabe aplicar e pulado, e o proximo decide")
  else erro("criterio desconhecido alterou a ordem — desempate inventado")
}

// ── 5. A ordenacao e ESTAVEL ───────────────────────────────────────────────
{
  const iguais = [linha("Zebra", 10, 3, 5, 5), linha("Alfa", 10, 3, 5, 5)]
  const r1 = ordenarPorCriterios(iguais, DESEMPATE_CBF).map(l => l.nome).join(",")
  const r2 = ordenarPorCriterios([...iguais].reverse(), DESEMPATE_CBF).map(l => l.nome).join(",")
  if (r1 === r2) ok(`empate total resolve sempre igual (${r1}) — a tabela nao pisca`)
  else erro(`ordem instavel: ${r1} x ${r2}`)
}

console.log(falhas === 0 ? "\nDESEMPATE OK — cada competicao ordena pela regra dela.\n" : `\n${falhas} falha(s).\n`)
process.exit(falhas === 0 ? 0 : 1)

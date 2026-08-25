/**
 * O LEGADO E A VIDA NOTURNA (1.0.374) — o que este teste protege.
 *
 * ⚠️ OS DOIS SISTEMAS FALHAM DO MESMO JEITO, e não é por erro de conta: é por
 * erro de DESENHO. Uma pontuação final pode existir, somar certo, aparecer na
 * tela — e ainda assim estar quebrada, se puder ser maximizada por uma coisa só.
 * Um cassino pode sortear certo e ainda assim destruir o modo, se pagar mais do
 * que cobra.
 *
 * Nenhum dos dois defeitos aparece em teste de unidade comum, porque nenhum dos
 * dois é uma exceção — é o sistema funcionando exatamente como foi escrito, na
 * direção errada. As asserções abaixo cobram a DIREÇÃO.
 */
import {
  CONQUISTAS, LENDAS_DE_REFERENCIA, bonusDasConquistas, conquistasAtingidas,
  montarRanking, patamarDaPontuacao, pontuacaoDaCarreira, pontuacaoFinal,
  posicaoNoRanking, type FolhaDaCarreira,
} from "../lib/legado-do-atleta"
import {
  CAVALOS_DO_ATLETA, CONVITES_DE_EVENTO, MESAS_DE_CASSINO,
  convitesDaSemana, correrNaSemana, jogarNoCassino,
} from "../lib/vida-noturna-do-atleta"

let passou = 0
let falhou = 0
function ok(nome: string, cond: boolean, detalhe = "") {
  if (cond) { passou++; console.log(`  ok   ${nome}`) }
  else { falhou++; console.log(`  FALHA ${nome} ${detalhe}`) }
}

const VAZIA: FolhaDaCarreira = {
  nome: "Ninguém", posicao: "ATA", temporadas: 0, jogos: 0, gols: 0, assistencias: 0,
  notaMedia: 0, titulos: 0, premios: 0, overallMaximo: 55, prestigioMaximo: 40,
  selecaoJogos: 0, selecaoGols: 0, saldoNoCassino: 0, noitesNoCassino: 0, reputacaoFinal: 30,
}

console.log("\n── 1. A PONTUAÇÃO NÃO É MAXIMIZÁVEL POR UM EIXO SÓ ───────────")
{
  // ⚠️ A ASSERÇÃO CENTRAL DO ARQUIVO. Se um eixo não tivesse teto, a resposta
  // ótima seria empilhar aquela estatística e ignorar o resto — e um zagueiro
  // genial terminaria atrás de um centroavante medíocre.
  const soGols: FolhaDaCarreira = { ...VAZIA, jogos: 400, gols: 900, notaMedia: 6, temporadas: 12 }
  const p = pontuacaoDaCarreira(soGols)
  const producao = p.eixos.find(e => e.id === "producao")!
  ok("produção respeita o teto mesmo com 900 gols", producao.pontos === producao.teto)
  ok("e 900 gols não chegam perto de 1000 pontos", p.total < 700, `${p.total}`)

  const equilibrada: FolhaDaCarreira = {
    ...VAZIA, temporadas: 16, jogos: 520, gols: 180, assistencias: 120, notaMedia: 7.3,
    titulos: 11, premios: 5, overallMaximo: 90, prestigioMaximo: 88, selecaoJogos: 60, selecaoGols: 22,
  }
  ok("a carreira completa vence a especializada",
    pontuacaoDaCarreira(equilibrada).total > p.total,
    `${pontuacaoDaCarreira(equilibrada).total} vs ${p.total}`)

  // Um zagueiro não pode ser punido por não marcar: os outros cinco eixos têm
  // de bastar para uma grande carreira.
  const zagueiro: FolhaDaCarreira = {
    ...VAZIA, posicao: "ZAG", temporadas: 17, jogos: 600, gols: 30, assistencias: 25,
    notaMedia: 7.4, titulos: 12, premios: 4, overallMaximo: 89, prestigioMaximo: 85,
    selecaoJogos: 70, selecaoGols: 3,
  }
  ok("um zagueiro pode ter uma grande carreira",
    pontuacaoDaCarreira(zagueiro).total >= 540, `${pontuacaoDaCarreira(zagueiro).total}`)
}

console.log("\n── 2. A REGULARIDADE É O CONTRAPESO ──────────────────────────")
{
  const longaMedíocre: FolhaDaCarreira = { ...VAZIA, temporadas: 20, jogos: 700, gols: 60, notaMedia: 5.9 }
  const curtaBrilhante: FolhaDaCarreira = {
    ...VAZIA, temporadas: 6, jogos: 210, gols: 110, assistencias: 60, notaMedia: 8.1,
    titulos: 7, premios: 4, overallMaximo: 91, prestigioMaximo: 90, selecaoJogos: 40, selecaoGols: 20,
  }
  const r1 = pontuacaoDaCarreira(longaMedíocre).total
  const r2 = pontuacaoDaCarreira(curtaBrilhante).total
  ok("a carreira curta e brilhante compete com a longa e morna", r2 > r1, `${r2} vs ${r1}`)

  const regularidade = pontuacaoDaCarreira(longaMedíocre).eixos.find(e => e.id === "regularidade")!
  ok("média 5.9 quase não pontua em regularidade", regularidade.pontos < 25, `${regularidade.pontos}`)
}

console.log("\n── 3. O DINHEIRO NÃO PONTUA; O CASSINO DESCONTA ──────────────")
{
  const limpo: FolhaDaCarreira = { ...VAZIA, temporadas: 10, jogos: 350, gols: 90, notaMedia: 7, titulos: 4 }
  const jogador: FolhaDaCarreira = { ...limpo, noitesNoCassino: 80, saldoNoCassino: -12_000_000 }

  ok("o cassino desconta", pontuacaoDaCarreira(jogador).total < pontuacaoDaCarreira(limpo).total)
  // ⚠️ E DESCONTA POUCO. Punição pesada transformaria a mesa numa armadilha a
  // evitar; leve, ela continua sendo uma escolha com preço.
  ok("mas não destrói a carreira", pontuacaoDaCarreira(jogador).desconto >= -60)
  ok("quem nunca entrou ganha a conquista",
    conquistasAtingidas({ ...limpo, jogos: 350 }).some(c => c.id === "limpo"))
  ok("e quem entrou, não",
    !conquistasAtingidas(jogador).some(c => c.id === "limpo"))
}

console.log("\n── 4. TODA MESA DE CASSINO PAGA MENOS DO QUE COBRA ───────────")
{
  // ⚠️ A ASSERÇÃO QUE PROTEGE O MODO INTEIRO. Uma mesa com retorno positivo
  // viraria fonte de renda infinita, e contrato, patrocínio e bônus por gol
  // deixariam de importar.
  for (const m of MESAS_DE_CASSINO) {
    ok(`${m.nome}: retorno esperado < 1`, m.chance * m.pagamento < 1,
      `${(m.chance * m.pagamento).toFixed(3)}`)
  }

  // E o retorno medido bate com o teórico — sorteio semeado, sem viés.
  let saldo = 0
  const mesa = MESAS_DE_CASSINO[0]
  for (let i = 0; i < 4000; i++) saldo += jogarNoCassino(mesa, mesa.minimo, `medida:${i}`).saldo
  ok("medido em 4000 noites, a casa ganha", saldo < 0, `${saldo}`)

  const r = jogarNoCassino(mesa, mesa.minimo, "x")
  ok("a noite cobra forma mesmo ganhando", r.forma < 0)
  ok("e cobra a família sempre", r.familia < 0)
  ok("o mesmo jogo dá o mesmo resultado",
    jogarNoCassino(mesa, mesa.minimo, "igual").saldo === jogarNoCassino(mesa, mesa.minimo, "igual").saldo)
}

console.log("\n── 5. O CAVALO É QUASE NEUTRO, E O CAMPEÃO É ARMADILHA ───────")
{
  for (const c of CAVALOS_DO_ATLETA) {
    const esperado = c.chanceDeVitoria * c.premio
    const razao = esperado / c.manutencaoSemanal
    // Nenhum é dinheiro fácil (>1,3) nem armadilha pura (<0,7).
    ok(`${c.nome}: retorno entre 0,7 e 1,3 do custo`, razao > 0.7 && razao < 1.3, razao.toFixed(2))
  }

  const campeao = CAVALOS_DO_ATLETA.find(c => c.id === "campeao")!
  const potro = CAVALOS_DO_ATLETA.find(c => c.id === "potro")!
  ok("o campeão custa muito mais para manter", campeao.manutencaoSemanal > potro.manutencaoSemanal * 8)

  ok("a corrida é semeada", correrNaSemana("potro", "s1")?.venceu === correrNaSemana("potro", "s1")?.venceu)
  ok("cavalo inexistente não corre", correrNaSemana("pegaso", "s1") === null)
}

console.log("\n── 6. NENHUM EVENTO É SÓ BOM ─────────────────────────────────")
{
  for (const e of CONVITES_DE_EVENTO) {
    const efeitos = Object.values(e.efeitos).filter(v => typeof v === "number") as number[]
    const cobra = e.energia > 0 || e.custo > 0 || efeitos.some(v => v < 0)
    ok(`${e.nome} cobra alguma coisa`, cobra)
  }

  const baixaReputacao = convitesDaSemana(10, "s")
  ok("quem não é conhecido não é convidado para a gala",
    !baixaReputacao.some(c => c.id === "gala"))
  ok("mas sempre tem para onde ir", baixaReputacao.length > 0)
  ok("no máximo dois convites por semana", convitesDaSemana(90, "s").length <= 2)
}

console.log("\n── 7. AS CONQUISTAS E O RANKING ──────────────────────────────")
{
  ok("a carreira vazia não desbloqueia nada", conquistasAtingidas(VAZIA).length === 0)
  ok("uma partida desbloqueia a estreia",
    conquistasAtingidas({ ...VAZIA, jogos: 1 }).some(c => c.id === "estreia"))

  const lenda: FolhaDaCarreira = {
    ...VAZIA, temporadas: 18, jogos: 620, gols: 310, assistencias: 140, notaMedia: 7.6,
    titulos: 15, premios: 8, overallMaximo: 93, prestigioMaximo: 92, selecaoJogos: 90, selecaoGols: 44,
  }
  ok("a carreira de lenda desbloqueia quase tudo",
    conquistasAtingidas(lenda).length >= CONQUISTAS.length - 2,
    `${conquistasAtingidas(lenda).length}/${CONQUISTAS.length}`)
  ok("e chega ao topo dos patamares", pontuacaoFinal(lenda).patamar === "Lenda do futebol",
    `${pontuacaoFinal(lenda).total}`)

  ok("o bônus das conquistas soma", pontuacaoFinal(lenda).total > pontuacaoDaCarreira(lenda).total)
  ok("carreira vazia não ganha bônus", bonusDasConquistas(VAZIA) === 0)

  // ⚠️ SEM RÉGUA, A PRIMEIRA CARREIRA DO JOGADOR SERIA A MELHOR E A PIOR DE
  // TODOS OS TEMPOS AO MESMO TEMPO, e o número final não diria nada.
  ok("o ranking tem referências", LENDAS_DE_REFERENCIA.length >= 10)
  ok("o ranking sai ordenado", montarRanking([]).every((e, i, l) => i === 0 || l[i - 1].pontos >= e.pontos))
  ok("uma carreira fraca fica no fim", posicaoNoRanking(150, []) > LENDAS_DE_REFERENCIA.length)
  ok("uma carreira de lenda fica no topo", posicaoNoRanking(940, []) === 1)

  ok("os patamares cobrem a escala inteira",
    patamarDaPontuacao(0) !== patamarDaPontuacao(1000)
    && patamarDaPontuacao(500) !== patamarDaPontuacao(900))
}

console.log(`\n${falhou === 0 ? "PASSOU" : "FALHOU"} — ${passou} ok, ${falhou} falha(s)\n`)
process.exit(falhou === 0 ? 0 : 1)

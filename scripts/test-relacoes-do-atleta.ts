/**
 * AS RELAÇÕES E OS COMPANHEIROS (1.0.374) — o que este teste protege.
 *
 * ⚠️ O MODO DE FALHAR AQUI TEM NOME NESTE PROJETO: "sistema implementado porém
 * desligado". Um medidor bonito na tela, um número que sobe e desce, e NADA
 * lendo esse número. O jogo compila, a tela fica bonita, os gates passam, e o
 * jogador passa cinco temporadas cultivando uma relação que não muda nada.
 *
 * Por isso cada asserção abaixo cobra o EFEITO, nunca o medidor. Não basta o
 * número existir: ele tem de mover a confiança do treinador, a nota da partida,
 * quantas propostas chegam, quanto o treino rende ou quantas vezes a bola chega
 * em você. Se alguém apagar a ligação e deixar o medidor, isto quebra.
 *
 * A segunda armadilha que ele protege é a que quase aconteceu aqui: a 1.0.373
 * JÁ tinha `relacoes.elenco`, e a primeira versão deste módulo criou um
 * `vestiario` paralelo. Dois medidores para o mesmo grupo, discordando em
 * silêncio. O teste final cobra que só exista um.
 */
import {
  criarAtletaDaCarreira, criarCarreiraDeJogador, jogarProximaRodada, encerrarTemporada,
  type EstadoCarreiraDeJogador,
} from "../lib/carreira-de-jogador"
import { semearMotorDePartida } from "../lib/match-engine"
import { getTeamByShort } from "../lib/teams-data"
import {
  ajusteDaNotaPeloVestiario, amplificacaoDaImprensa, companheirosDoClube,
  esfriarCompanheiros, esfriarUmaRodada, frequenciaDeLancesPeloCraque,
  ganhoDaNegociacao, lerRelacoes, moverCompanheiro, multiplicadorDePropostas,
  multiplicadorDeTreinoPeloVeterano, pisoDaNotaDoTreinador, pressaoDoRival,
  puxaoDoCapitao, recuperacaoPelaFamilia, relacoesIniciais, PESSOAS,
} from "../lib/relacoes-do-atleta"

let passou = 0
let falhou = 0
function ok(nome: string, cond: boolean, detalhe = "") {
  if (cond) { passou++; console.log(`  ok   ${nome}`) }
  else { falhou++; console.log(`  FALHA ${nome} ${detalhe}`) }
}

console.log("\n── 1. CADA RELAÇÃO MEXE EM ALGO, E EM SENTIDOS OPOSTOS ───────")
{
  const frio = { ...relacoesIniciais(), treinador: 5, elenco: 5, empresario: 5, familia: 5, imprensa: 5 }
  const quente = { ...relacoesIniciais(), treinador: 95, elenco: 95, empresario: 95, familia: 95, imprensa: 95 }

  ok("treinador amigo levanta um piso na confiança",
    pisoDaNotaDoTreinador(quente) > pisoDaNotaDoTreinador(frio) + 15)
  ok("e o técnico hostil não dá piso nenhum", pisoDaNotaDoTreinador(frio) === 0)

  ok("vestiário contra você custa nota", ajusteDaNotaPeloVestiario(frio) < 0)
  ok("vestiário a favor soma", ajusteDaNotaPeloVestiario(quente) > 0)
  // ±0,5 é o teto: o grupo tempera, não substitui a atuação.
  ok("mas o grupo não decide a atuação sozinho", Math.abs(ajusteDaNotaPeloVestiario(quente)) <= 0.5)

  ok("empresário próximo traz mais propostas", multiplicadorDePropostas(quente) > multiplicadorDePropostas(frio))
  ok("e arranca mais no salário", ganhoDaNegociacao(quente) > ganhoDaNegociacao(frio))
  ok("empresário frio não arranca nada", ganhoDaNegociacao(frio) === 0)

  ok("família recupera mais", recuperacaoPelaFamilia(quente) > recuperacaoPelaFamilia(frio))

  // ⚠️ A ASSERÇÃO QUE IMPEDE "AGRADE A IMPRENSA" DE SER RESPOSTA ÓTIMA.
  ok("imprensa amiga amplifica", amplificacaoDaImprensa(quente) > 1)
  ok("imprensa hostil atenua", amplificacaoDaImprensa(frio) < 1)
}

console.log("\n── 2. AS RELAÇÕES ESFRIAM NOS DOIS SENTIDOS ──────────────────")
{
  const alto = { ...relacoesIniciais(), treinador: 90 }
  const baixo = { ...relacoesIniciais(), treinador: 10 }
  ok("quem está em 90 escorrega", esfriarUmaRodada(alto).treinador < 90)
  // Sem os DOIS sentidos, uma briga no vestiário seria sentença perpétua.
  ok("quem está em 10 é perdoado aos poucos", esfriarUmaRodada(baixo).treinador > 10)

  let r = { ...relacoesIniciais(), treinador: 50 }
  for (let i = 0; i < 50; i++) r = esfriarUmaRodada(r)
  ok("o neutro não se move", Math.abs(r.treinador - 50) < 1e-9)
}

console.log("\n── 3. OS COMPANHEIROS TÊM NOME E EFEITO PRÓPRIO ──────────────")
{
  const time = companheirosDoClube("FLA", "ATA")
  ok("são quatro papéis", time.length === 4)
  ok("todos têm nome", time.every(c => c.nome.includes(" ")))
  ok("o rival joga na sua posição", time.find(c => c.papel === "rival")?.posicao === "ATA")

  // ⚠️ SEMEADO PELO CLUBE: voltar cinco temporadas depois reencontra as mesmas
  // pessoas. Sem isto a carreira não teria memória.
  ok("o mesmo clube dá o mesmo elenco",
    JSON.stringify(companheirosDoClube("FLA", "ATA")) === JSON.stringify(time))
  ok("clube diferente dá gente diferente",
    JSON.stringify(companheirosDoClube("COR", "ATA")) !== JSON.stringify(time))

  const craqueAmigo = moverCompanheiro(time, "craque", 45)
  const craqueFrio = moverCompanheiro(time, "craque", -45)
  ok("o craque decide se a bola chega",
    frequenciaDeLancesPeloCraque(craqueAmigo) > frequenciaDeLancesPeloCraque(craqueFrio))

  const veteranoAmigo = moverCompanheiro(time, "veterano", 40)
  ok("o veterano multiplica o treino",
    multiplicadorDeTreinoPeloVeterano(veteranoAmigo) > multiplicadorDeTreinoPeloVeterano(time))

  ok("o capitão puxa o grupo", puxaoDoCapitao(moverCompanheiro(time, "capitao", 45)) > 0)
  ok("e o capitão contra você empurra para baixo", puxaoDoCapitao(moverCompanheiro(time, "capitao", -45)) < 0)

  // ⚠️ A RELAÇÃO EM QUE SER AMIGO CUSTA. Sem um laço assim, "seja legal com
  // todo mundo" seria a resposta ótima e as escolhas parariam de ser escolhas.
  ok("o rival bem com o grupo TIRA da sua confiança",
    pressaoDoRival(moverCompanheiro(time, "rival", 45)) < 0)
  ok("e o rival isolado não tira nada",
    pressaoDoRival(moverCompanheiro(time, "rival", -45)) === 0)

  ok("companheiros também esfriam", esfriarCompanheiros(moverCompanheiro(time, "craque", 40))
    .find(c => c.papel === "craque")!.nivel < 90)
}

console.log("\n── 4. NÃO EXISTEM DOIS MEDIDORES PARA O MESMO GRUPO ──────────")
{
  // ⚠️ ESTA É A ASSERÇÃO MAIS IMPORTANTE DO ARQUIVO, e é histórica: a primeira
  // versão criou um `vestiario` novo enquanto a 1.0.373 já tinha `elenco`
  // funcionando, com interação semanal e custo de energia. Dois números para a
  // mesma pergunta, discordando sem aviso.
  ok("o laço coletivo se chama `elenco`", PESSOAS.includes("elenco" as never))
  ok("e NÃO existe um `vestiario` paralelo", !PESSOAS.includes("vestiario" as never))

  // save antigo (só `elenco` e `marcas`) não pode quebrar nem zerar nada
  const antigo = lerRelacoes({ elenco: 78 } as never)
  ok("save antigo mantém o elenco que tinha", antigo.elenco === 78)
  ok("e ganha o padrão nas quatro novas", antigo.familia === 72 && antigo.treinador === 50)
}

console.log("\n── 5. NENHUM EFEITO SANGRA A CARREIRA AO LONGO DO TEMPO ──────")
{
  // ⚠️ ESTA SEÇÃO EXISTE POR UM DEFEITO QUE ESTE ARQUIVO DEIXOU PASSAR.
  //
  // As asserções acima conferem o SINAL de cada efeito: o concorrente tira da
  // confiança, o capitão soma no grupo, a imprensa amplifica. Todas passavam —
  // e a carreira afundava assim mesmo, porque a pressão do concorrente estava
  // sendo aplicada à nota corrente A CADA PARTIDA, enquanto o mérito só
  // recupera 12% da distância por rodada. O saldo era negativo toda semana.
  //
  // Medido antes da correção: um meia de 24 anos fechava a segunda temporada
  // com 5 jogos e 95 minutos, nota do treinador em 5,7. Quem pegou foi o gate
  // de LESÕES, e por acidente — atleta que não entra em campo não se machuca.
  //
  // A lição: conferir o sinal de um efeito não diz nada sobre o acúmulo dele.
  // Efeito por rodada precisa de um teste que rode MUITAS rodadas.
  const clube = getTeamByShort("FLA")!
  const atleta = criarAtletaDaCarreira({
    nome: "Sonda de Acumulo", posicao: "MEI", idade: 24, nacionalidade: "Brasil",
    pePreferido: "direito", alturaCm: 178, pesoKg: 72, numero: 8,
  })
  semearMotorDePartida(20260818)
  let c: EstadoCarreiraDeJogador = criarCarreiraDeJogador(clube, atleta, "Brasileirao Serie A", 2026)

  const minutosPorTemporada: number[] = []
  for (let t = 0; t < 3; t++) {
    let n = 0
    while (!c.temporadaEncerrada && n < 120) { c = jogarProximaRodada(c); n++ }
    minutosPorTemporada.push(c.temporadaAtual.minutos)
    c = encerrarTemporada(c)
    if (c.aposentado) break
  }

  // 100 e nao 500: este atleta comeca "fora dos planos" num clube grande, e a
  // primeira temporada dele e mesmo de poucos minutos — e assim que a 1.0.373
  // calibrou a hierarquia. O que o teste cobra e que ele ENTRE em campo.
  ok("o atleta entra em campo na primeira temporada", minutosPorTemporada[0] > 100,
    `${minutosPorTemporada[0]} min`)

  // O número que separa o certo do errado: com a sangria eram 95 minutos na
  // segunda temporada; sem ela, mais de mil.
  ok("e joga MAIS na segunda, não menos", (minutosPorTemporada[1] ?? 0) > minutosPorTemporada[0],
    `${minutosPorTemporada[0]} → ${minutosPorTemporada[1]}`)

  ok("a confiança não afunda sozinha em três temporadas", c.notaDoTreinador > 15,
    `${c.notaDoTreinador.toFixed(1)}`)

  ok("nenhuma relação fica presa no fundo",
    Object.values(lerRelacoes(c.relacoes as never)).every(v => v > 5),
    JSON.stringify(lerRelacoes(c.relacoes as never)))
}

console.log(`\n${falhou === 0 ? "PASSOU" : "FALHOU"} — ${passou} ok, ${falhou} falha(s)\n`)
process.exit(falhou === 0 ? 0 : 1)

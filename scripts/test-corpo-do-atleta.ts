/**
 * O CORPO DO ATLETA DENTRO DA FÍSICA (1.0.374) — e por que este teste existe.
 *
 * ⚠️ O DEFEITO QUE ELE PROTEGE NÃO DÁ ERRO NENHUM. Até a 1.0.373 a ficha do
 * atleta guardava altura, peso e pé preferido, e o jogador os escolhia na
 * criação da carreira achando que decidia alguma coisa. Nada os lia. Um `grep`
 * por `altura` em `lib/partida-do-atleta.ts` voltava vazio, o jogo compilava,
 * os gates passavam, e a escolha era decorativa.
 *
 * Dado de enfeite é pior que dado nenhum: ele mente para o jogador na tela de
 * criação, que é o momento em que ele mais acredita no que o jogo diz.
 *
 * Cada asserção abaixo cobra que UM desses números mude o que a bola faz. Se
 * alguém apagar a leitura do corpo dentro de `calcularTrajetoria`, o teste
 * quebra aqui em vez de o atributo voltar a ser enfeite em silêncio.
 */
import {
  calcularTrajetoria, defesaDoGoleiro, resolverChute,
  type AtributosDoChute, type ChuteDoJogador, type ContextoDoChute,
} from "../lib/fisica-do-chute"

let passou = 0
let falhou = 0
function ok(nome: string, cond: boolean, detalhe = "") {
  if (cond) { passou++; console.log(`  ok   ${nome}`) }
  else { falhou++; console.log(`  FALHA ${nome} ${detalhe}`) }
}

const CHUTE: ChuteDoJogador = { alvo: { x: 0.62, y: 0.55 }, forca: 0.8, efeito: 0.4 }
const LIVRE: ContextoDoChute = { distancia: 0.3, angulo: 0.2, pressao: 0.2 }

/** Quanto a bola se afastou de onde ele apontou. É o desvio, medido. */
function erro(atributos: AtributosDoChute, contexto: ContextoDoChute, n = 240): number {
  let total = 0
  for (let i = 0; i < n; i++) {
    const t = calcularTrajetoria(CHUTE, atributos, `corpo:${i}`, contexto)
    total += Math.hypot(t.chegada.x - CHUTE.alvo.x, t.chegada.y - CHUTE.alvo.y)
  }
  return total / n
}

function velocidadeMedia(atributos: AtributosDoChute, contexto: ContextoDoChute, n = 120): number {
  let total = 0
  for (let i = 0; i < n; i++) total += calcularTrajetoria(CHUTE, atributos, `v:${i}`, contexto).velocidade
  return total / n
}

console.log("\n── 1. O PÉ ERRADO COBRA, E COBRA ONDE DEVE ───────────────────")
{
  const destro: AtributosDoChute = { finalizacao: 78, fisico: 76, drible: 74, pePreferido: "direito", peFraco: 2 }
  const comPeBom = { ...LIVRE, pe: "direito" as const }
  const comPeRuim = { ...LIVRE, pe: "esquerdo" as const }

  ok("bater com o pé ruim erra mais", erro(destro, comPeRuim) > erro(destro, comPeBom) * 1.3,
    `${erro(destro, comPeRuim).toFixed(3)} vs ${erro(destro, comPeBom).toFixed(3)}`)

  ok("e a bola sai mais fraca", velocidadeMedia(destro, comPeRuim) < velocidadeMedia(destro, comPeBom))

  // ⚠️ ESTA É A ASSERÇÃO QUE IMPEDE O PÉ FRACO DE VIRAR PENALIDADE CEGA. Quem
  // treinou o pé ruim tem de sentir a diferença; se 5 estrelas ainda errasse
  // mais, o atributo seria um imposto e ninguém investiria nele.
  const ambidestro: AtributosDoChute = { ...destro, peFraco: 5 }
  ok("5 estrelas anulam a penalidade", Math.abs(erro(ambidestro, comPeRuim) - erro(ambidestro, comPeBom)) < 1e-9)

  const canhotoDeUmPe: AtributosDoChute = { ...destro, peFraco: 1 }
  ok("1 estrela erra mais que 2", erro(canhotoDeUmPe, comPeRuim) > erro(destro, comPeRuim))

  const dosDois: AtributosDoChute = { ...destro, pePreferido: "ambos" }
  ok("quem bate dos dois nunca é penalizado", Math.abs(erro(dosDois, comPeRuim) - erro(dosDois, comPeBom)) < 1e-9)

  // Sem lado declarado (pênalti, falta parada) ele bate com o pé bom.
  ok("bola parada não sorteia o pé", Math.abs(erro(destro, LIVRE) - erro(destro, comPeBom)) < 1e-9)
}

console.log("\n── 2. A ALTURA SÓ DECIDE ONDE O CORPO DECIDE ─────────────────")
{
  const alto: AtributosDoChute = { finalizacao: 70, fisico: 78, drible: 60, altura: 196 }
  const baixo: AtributosDoChute = { ...alto, altura: 170 }
  const deCabeca = { ...LIVRE, deCabeca: true }

  ok("no cabeceio o alto erra menos", erro(alto, deCabeca) < erro(baixo, deCabeca),
    `${erro(alto, deCabeca).toFixed(3)} vs ${erro(baixo, deCabeca).toFixed(3)}`)
  ok("e cabeceia mais forte", velocidadeMedia(alto, deCabeca) > velocidadeMedia(baixo, deCabeca))

  // ⚠️ O CONTRAPESO. Sem esta asserção a altura viraria bônus grátis, e a tela
  // de criação teria uma resposta ótima ("escolha 2,05 m") — que é o mesmo
  // defeito do enfeite, de cabeça para baixo.
  ok("no chute com o pé a altura não muda nada", Math.abs(erro(alto, LIVRE) - erro(baixo, LIVRE)) < 1e-9)

  const comEfeito = calcularTrajetoria({ ...CHUTE, efeito: 1 }, alto, "cab", deCabeca)
  const semEfeito = calcularTrajetoria({ ...CHUTE, efeito: 0 }, alto, "cab", deCabeca)
  ok("cabeça não imprime curva", Math.abs(comEfeito.chegada.x - semEfeito.chegada.x) < 1e-9)

  ok("cabeceio chega mais fraco que o pé", velocidadeMedia(alto, deCabeca) < velocidadeMedia(alto, LIVRE))
}

console.log("\n── 3. A ALTURA DO GOLEIRO É TROCA, NÃO BÔNUS ─────────────────")
{
  const atributos: AtributosDoChute = { finalizacao: 80, fisico: 80, drible: 70 }
  const noAlto = calcularTrajetoria({ alvo: { x: 0.55, y: 0.95 }, forca: 0.7, efeito: 0 }, atributos, "alto", LIVRE)
  const rasteiro = calcularTrajetoria({ alvo: { x: 0.55, y: 0.05 }, forca: 0.7, efeito: 0 }, atributos, "baixo", LIVRE)

  const gigante = { qualidade: 70, altura: 200 }
  const baixinho = { qualidade: 70, altura: 172 }

  ok("goleirão alcança mais no alto",
    defesaDoGoleiro(noAlto, gigante, LIVRE).alcance >= defesaDoGoleiro(noAlto, baixinho, LIVRE).alcance)

  // A distância que ele PRECISA cobrir é o que muda; o alcance bruto é o mesmo.
  const dGigante = defesaDoGoleiro(noAlto, gigante, LIVRE)
  const dBaixinho = defesaDoGoleiro(noAlto, baixinho, LIVRE)
  ok("e isso se traduz em defesa no alto, não em velocidade",
    dGigante.alcancou || !dBaixinho.alcancou, `${dGigante.alcancou} / ${dBaixinho.alcancou}`)

  ok("no rasteiro o alto não leva vantagem",
    defesaDoGoleiro(rasteiro, gigante, LIVRE).alcancou === defesaDoGoleiro(rasteiro, baixinho, LIVRE).alcancou
    || !defesaDoGoleiro(rasteiro, gigante, LIVRE).alcancou)
}

console.log("\n── 4. O CORPO NÃO ANULA A MIRA ───────────────────────────────")
{
  // ⚠️ A INVARIANTE DO MODO INTEIRO, aplicada ao corpo. Se o pé errado bastasse
  // para perder o lance, a mira deixaria de decidir e o jogador voltaria a
  // assistir — que é exatamente o que a física veio consertar.
  const destro: AtributosDoChute = { finalizacao: 74, fisico: 74, drible: 70, pePreferido: "direito", peFraco: 2 }
  const gk = { qualidade: 68 }
  let bemComPeRuim = 0
  let malComPeBom = 0
  for (let i = 0; i < 200; i++) {
    const bem = resolverChute({ alvo: { x: 0.86, y: 0.62 }, forca: 0.82, efeito: 0.2 }, destro, gk, `bem:${i}`,
      { ...LIVRE, pe: "esquerdo" })
    const mal = resolverChute({ alvo: { x: 0.05, y: 0.3 }, forca: 0.55, efeito: 0 }, destro, gk, `mal:${i}`,
      { ...LIVRE, pe: "direito" })
    if (bem.tipo === "gol") bemComPeRuim++
    if (mal.tipo === "gol") malComPeBom++
  }
  ok("apontar bem com o pé ruim ainda vence apontar mal com o bom",
    bemComPeRuim > malComPeBom, `${bemComPeRuim} vs ${malComPeBom}`)
  ok("mas o pé ruim não é grátis: não converte quase tudo", bemComPeRuim < 160, `${bemComPeRuim}/200`)
}

console.log(`\n${falhou === 0 ? "PASSOU" : "FALHOU"} — ${passou} ok, ${falhou} falha(s)\n`)
process.exit(falhou === 0 ? 0 : 1)

// CPE — CAPACIDADE POTENCIAL ESTIMADA.
//
// ⚠️ POR QUE ISTO EXISTE (pedido de 12/08/2026, inspirado no Brasfoot).
//
// O jogo mostrava o POTENCIAL REAL do garoto, cru, na tela da base: "Overall 43,
// Potencial 82". Com o número exato à vista não existe promessa, não existe
// surpresa e não existe decepção — as três coisas que fazem a categoria de base
// valer alguma coisa. Escolher quem promover e quem dispensar vira aritmética.
//
// O CPE é a AVALIAÇÃO do clube sobre aquele talento, não o talento. Ele erra:
//
//   • o erro é PRÓPRIO DE CADA ATLETA e estável — reabrir a tela não sorteia
//     outra opinião, e não adianta recarregar o jogo para "rolar de novo";
//   • o tamanho do erro cai conforme a estrutura de avaliação melhora (olheiros,
//     centro de observação, centro de dados, nível da academia);
//   • melhorar a estrutura aproxima o CPE do valor real SEM nunca mexer no
//     talento: quem era craque sempre foi craque, você é que passou a enxergar.
//
// Com isso, o mesmo garoto de potencial real 86 pode aparecer como CPE 74 numa
// base amadora (e surpreender três temporadas depois) ou como "84 a 88" num
// clube com departamento montado.
//
// ⚠️ REGRA DE OURO: o CPE é de TELA. Evolução, mercado da IA, promoção e preço
// continuam usando o potencial real. Se algum motor começar a consumir o CPE, o
// erro de avaliação vira erro de simulação — que é outra coisa, e errada.

import { efeitosDoTreinador } from "@/lib/efeito-do-treinador"

/** Peças que determinam o quanto o clube enxerga de um jovem. */
export interface EstruturaDeAvaliacao {
  /** Nível da academia/base (1-5). `clubInfrastructure.youth`. */
  academia?: number
  /** Nível do centro de observação (1-5). */
  centroDeObservacao?: number
  /** Nível do centro de dados (1-5). */
  centroDeDados?: number
  /** Média de "descoberta de jovens" dos olheiros contratados (0-100). */
  olheiros?: number
  /**
   * Pontos que o TÉCNICO acrescenta (ou tira) da avaliação. Ausente = o retrato
   * publicado do técnico da carreira; informado = este valor, que é como o teste
   * fixa o cenário sem depender do save aberto.
   */
  tecnico?: number
}

/** O que a tela mostra no lugar do potencial real. */
export interface Cpe {
  /** Valor central da avaliação — já contém o erro do clube. */
  valor: number
  /** Faixa exibida (`valor` ± confiança). */
  minimo: number
  maximo: number
  /** 0-100: o quanto esta avaliação é confiável. */
  qualidade: number
  /** 1 a 5 estrelas, para quem prefere ler símbolo a número. */
  estrelas: number
}

const LIMITE_INFERIOR = 35
const LIMITE_SUPERIOR = 99

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.max(minimo, Math.min(maximo, valor))
}

/** Hash estável — mesma semente, mesmo número, em qualquer máquina e sessão. */
function embaralhar(semente: string): number {
  let acumulado = 2166136261
  for (let i = 0; i < semente.length; i++) {
    acumulado ^= semente.charCodeAt(i)
    acumulado = Math.imul(acumulado, 16777619)
  }
  return (acumulado >>> 0) / 4294967295
}

/**
 * Quanto o clube enxerga, de 0 (chute) a 100 (praticamente exato).
 *
 * A academia entra com peso menor que os olheiros de propósito: quem avalia
 * talento é gente que vê jogar, e a estrutura só amplifica.
 */
export function qualidadeDeAvaliacao(estrutura: EstruturaDeAvaliacao): number {
  const academia = limitar(estrutura.academia ?? 1, 1, 5)
  const observacao = limitar(estrutura.centroDeObservacao ?? 1, 1, 5)
  const dados = limitar(estrutura.centroDeDados ?? 1, 1, 5)
  const olheiros = limitar(estrutura.olheiros ?? 0, 0, 100)
  // O OLHO DO TÉCNICO (`lib/efeito-do-treinador.ts`: atributo RECRUTAMENTO +
  // habilidade "Olho Clínico"). Neutro em 0, então nada muda sem perfil.
  //
  // Vale até ±22 pontos de qualidade — mais que subir um nível de centro de
  // observação e menos que o departamento inteiro. É o que faz "ex-olheiro"
  // significar alguma coisa na hora de escolher quem promover.
  const tecnico = estrutura.tecnico ?? efeitosDoTreinador().precisaoDeAvaliacao
  // Base 12 para uma base nível 1 sem olheiro nenhum: mesmo o clube mais
  // improvisado tem um treinador de base com opinião — só que uma opinião ruim.
  const bruto = 12
    + (academia - 1) * 5
    + (observacao - 1) * 6
    + (dados - 1) * 4
    + olheiros * 0.33
    + tecnico
  return Math.round(limitar(bruto, 0, 100))
}

/** Erro máximo (em pontos de overall) que uma avaliação desta qualidade comete. */
function amplitudeDoErro(qualidade: number): number {
  // 16 pontos no amadorismo, 2 no departamento completo. Não chega a zero: nem
  // o melhor olheiro do mundo garante que o garoto vira o que prometia.
  return 2 + (1 - limitar(qualidade, 0, 100) / 100) * 14
}

/**
 * A avaliação do clube sobre um jovem.
 *
 * `id` precisa ser estável para o atleta (id do save, não índice de lista): é
 * ele que garante que a opinião do clube não muda a cada render.
 */
export function estimarPotencial(
  id: string | number,
  potencialReal: number,
  estrutura: EstruturaDeAvaliacao | number,
): Cpe {
  const qualidade = typeof estrutura === "number"
    ? Math.round(limitar(estrutura, 0, 100))
    : qualidadeDeAvaliacao(estrutura)
  const amplitude = amplitudeDoErro(qualidade)
  // Erro PRÓPRIO do atleta, em [-1, 1]. Ele não muda nunca — o que muda é o
  // quanto dele sobrevive à qualidade da avaliação. Por isso melhorar o
  // departamento aproxima o CPE do real em vez de sortear outro palpite.
  const vies = embaralhar(`cpe:${id}`) * 2 - 1
  const valor = Math.round(limitar(potencialReal + vies * amplitude, LIMITE_INFERIOR, LIMITE_SUPERIOR))
  // A faixa exibida é mais estreita que o erro real, de propósito: o clube tem
  // MAIS confiança do que deveria. É isso que produz a decepção ocasional — e é
  // assim que funciona um departamento de futebol de verdade.
  const confianca = Math.max(1, Math.round(amplitude * 0.6))
  return {
    valor,
    minimo: Math.round(limitar(valor - confianca, LIMITE_INFERIOR, LIMITE_SUPERIOR)),
    maximo: Math.round(limitar(valor + confianca, LIMITE_INFERIOR, LIMITE_SUPERIOR)),
    qualidade,
    estrelas: limitar(Math.round((valor - 45) / 10), 1, 5),
  }
}

/** "78 a 86" — o texto que vai para a tela no lugar do número exato. */
export function faixaDeCpe(cpe: Cpe): string {
  return cpe.minimo === cpe.maximo ? String(cpe.valor) : `${cpe.minimo} a ${cpe.maximo}`
}

/** Como o clube descreve a própria capacidade de avaliar. */
export function rotuloDaAvaliacao(qualidade: number): string {
  if (qualidade >= 85) return "Avaliação precisa"
  if (qualidade >= 65) return "Avaliação confiável"
  if (qualidade >= 45) return "Avaliação razoável"
  if (qualidade >= 25) return "Avaliação limitada"
  return "Avaliação amadora"
}

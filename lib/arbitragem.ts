// QUEM APITA MUDA O JOGO.
//
// O motor de partida já tinha cartão amarelo, segundo amarelo, vermelho direto e
// conduta violenta — tudo, menos o árbitro. A chance de cartão era a mesma em
// toda partida do jogo, então "hoje pegou um juiz rigoroso" nunca acontecia.
//
// Isto acrescenta a variável que faltava, e é de propósito a MENOR das que
// decidem uma partida: o árbitro tempera, não define. Um juiz rigoroso torna a
// entrada dura mais cara; ele não faz o time pior ganhar.
//
// ⚠️ NADA AQUI MEXE NO PLACAR. Ele altera cartões e faltas, e é o jogador que
// converte isso em consequência (expulsão, suspensão, mudança de postura). Um
// árbitro que empurrasse gol seria injustiça sem contrapartida — o oposto do que
// dá graça a ter arbitragem.
//
// Módulo PURO.

export interface Arbitro {
  nome: string
  /**
   * Quanto ele puxa o cartão, em multiplicador. 1 = a média de hoje.
   * Faixa estreita de propósito: fora dela, a arbitragem deixa de temperar e
   * passa a decidir.
   */
  rigor: number
  /** Como o jogador lê o perfil dele antes da partida. */
  perfil: "permissivo" | "equilibrado" | "rigoroso" | "caseiro"
  /**
   * O quanto ele favorece o mandante, somado ao empurrão de mando que a partida
   * já tem. Só o perfil "caseiro" tem valor relevante.
   */
  peso_da_casa: number
}

/**
 * O quadro de árbitros.
 *
 * Nomes fictícios de propósito: um árbitro real ganharia um traço de
 * personalidade inventado ("rigoroso", "caseiro") atribuído a uma pessoa
 * existente, o que é diferente de usar o nome de um clube ou de um atleta.
 */
const QUADRO: Arbitro[] = [
  { nome: "R. Marques", rigor: 1.35, perfil: "rigoroso", peso_da_casa: 0 },
  { nome: "A. Vilela", rigor: 1.22, perfil: "rigoroso", peso_da_casa: 0 },
  { nome: "C. Fontana", rigor: 1.05, perfil: "equilibrado", peso_da_casa: 0 },
  { nome: "D. Peixoto", rigor: 1.0, perfil: "equilibrado", peso_da_casa: 0 },
  { nome: "E. Barreto", rigor: 0.95, perfil: "equilibrado", peso_da_casa: 0 },
  { nome: "F. Nogueira", rigor: 0.78, perfil: "permissivo", peso_da_casa: 0 },
  { nome: "G. Salles", rigor: 0.7, perfil: "permissivo", peso_da_casa: 0 },
  { nome: "H. Toledo", rigor: 1.1, perfil: "caseiro", peso_da_casa: 0.12 },
]

/** Limites duros. Existem para uma edição futura não transformar o juiz no protagonista. */
export const RIGOR_MINIMO = 0.6
export const RIGOR_MAXIMO = 1.5

/**
 * O árbitro desta partida — sempre o mesmo para a mesma partida.
 *
 * ⚠️ Determinístico pela semente, como o placar. O jogo recalcula rodadas por
 * mais de um caminho; um árbitro sorteado na hora faria a mesma partida ter
 * escalação de arbitragem diferente a cada leitura, e o jogador veria o nome
 * mudar entre a tela de pré-jogo e a súmula.
 */
export function arbitroDaPartida(semente: string): Arbitro {
  let h = 2166136261
  for (let i = 0; i < semente.length; i++) {
    h ^= semente.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return QUADRO[Math.abs(h) % QUADRO.length]
}

/** Multiplicador de cartão, já limitado. É o que o motor de partida consome. */
export function rigorDoArbitro(arbitro: Arbitro | null | undefined): number {
  if (!arbitro) return 1
  return Math.min(RIGOR_MAXIMO, Math.max(RIGOR_MINIMO, arbitro.rigor))
}

/** Frase curta para a tela de pré-jogo. */
export function descreverArbitro(a: Arbitro): string {
  if (a.perfil === "caseiro") return `${a.nome} — costuma dar a dúvida ao mandante`
  if (a.perfil === "rigoroso") return `${a.nome} — puxa o cartão com facilidade`
  if (a.perfil === "permissivo") return `${a.nome} — deixa o jogo correr`
  return `${a.nome} — apita na média`
}

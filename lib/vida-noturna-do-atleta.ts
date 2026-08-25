/**
 * CASSINO, CAVALOS E EVENTOS (1.0.374) — o dinheiro tem para onde ir.
 *
 * ─── POR QUE ISTO PRECISOU EXISTIR ──────────────────────────────────────────
 *
 * A 1.0.373 já tinha patrimônio: casa, carro, relógio, lancha. Todos eram a
 * MESMA decisão com preços diferentes — pagar uma vez, pagar manutenção toda
 * semana, ganhar estilo. Nenhum deles podia dar errado, e por isso nenhum deles
 * era uma decisão: com dinheiro sobrando, comprar tudo é sempre certo.
 *
 * O que faltava não era "mais itens". Era RISCO. Um atleta rico que não pode
 * perder dinheiro não tem vida financeira nenhuma — tem uma lista de compras.
 *
 * ─── AS TRÊS COISAS, E POR QUE SÃO TRÊS E NÃO UMA ───────────────────────────
 *
 *   CASSINO   risco imediato, retorno negativo. É o único sistema do modo em
 *             que a decisão ÓTIMA é não jogar — e ele existe justamente por
 *             isso: para que exista uma tentação de verdade, com uma saída
 *             fácil e errada quando o jogador está sem dinheiro.
 *
 *   CAVALO    risco lento, retorno quase neutro. Custa toda semana e paga de
 *             vez em quando. É a aposta de quem tem paciência, e o contrário
 *             exato do cassino em ritmo.
 *
 *   EVENTO    não é aposta: é TROCA. Você dá tempo e energia e recebe
 *             reputação e relação — ou o inverso, se for ao lugar errado na
 *             semana errada.
 *
 * ⚠️ NADA AQUI INVENTA UM MEDIDOR NOVO. Cassino e cavalo mexem em `dinheiro`,
 * `reputacao`, `forma` e nas relações que a 1.0.374 acabou de ligar; evento
 * mexe nos mesmos. É a regra do modo inteiro: sistema que não move número que
 * o jogo já lê é enfeite, e este projeto já pagou caro por enfeite.
 */

import type { Relacoes } from "@/lib/relacoes-do-atleta"

/** Sorteio semeado — a mesma noite dá o mesmo resultado. */
function roll(semente: string): number {
  let h = 2166136261
  for (let i = 0; i < semente.length; i++) {
    h ^= semente.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 100000) / 100000
}

const limitar = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v))

// ═══════════════════════════════════════════════════════════════════════════
// O CASSINO
// ═══════════════════════════════════════════════════════════════════════════

export type JogoDeCassino = "roleta" | "blackjack" | "bacara" | "vip"

export interface MesaDeCassino {
  id: JogoDeCassino
  nome: string
  /** Aposta mínima. A mesa VIP existe para o atleta que já ganhou muito. */
  minimo: number
  maximo: number
  /** Quanto paga quando ganha, em cima da aposta. */
  pagamento: number
  /** Chance real de ganhar, 0 a 1. */
  chance: number
}

/**
 * AS MESAS — e a única regra que as governa.
 *
 * ⚠️ TODA MESA TEM RETORNO ESPERADO NEGATIVO, e isso não é um detalhe de
 * calibração: é o sistema. `chance × pagamento < 1` em todas as quatro.
 *
 *     roleta     0,47 × 2,0  = 0,94
 *     blackjack  0,49 × 1,95 = 0,955
 *     bacará     0,45 × 2,1  = 0,945
 *     VIP        0,34 × 2,7  = 0,918
 *
 * Se alguma delas fosse lucrativa, o cassino viraria uma fonte de renda e o
 * modo inteiro perderia o sentido: bastaria apertar um botão até ficar rico, e
 * contrato, patrocínio e bônus por gol deixariam de importar. Ele existe para
 * ser uma tentação com resposta errada — e a mesa VIP é a mais errada de todas
 * justamente por ser a que mais paga.
 */
export const MESAS_DE_CASSINO: MesaDeCassino[] = [
  { id: "roleta", nome: "Roleta", minimo: 1_000, maximo: 50_000, pagamento: 2.0, chance: 0.47 },
  { id: "blackjack", nome: "Blackjack", minimo: 2_500, maximo: 120_000, pagamento: 1.95, chance: 0.49 },
  { id: "bacara", nome: "Bacará", minimo: 10_000, maximo: 400_000, pagamento: 2.1, chance: 0.45 },
  { id: "vip", nome: "Sala VIP", minimo: 50_000, maximo: 2_000_000, pagamento: 2.7, chance: 0.34 },
]

export interface ResultadoDoCassino {
  ganhou: boolean
  /** Positivo = lucro; negativo = o que ele perdeu. */
  saldo: number
  /** O que a noite custou fora do dinheiro. */
  forma: number
  reputacao: number
  familia: number
  texto: string
}

/**
 * UMA NOITE NO CASSINO.
 *
 * ⚠️ O CUSTO NÃO É SÓ O DINHEIRO, e é por isso que ganhar também cobra. A noite
 * inteira acordado custa FORMA sempre — ganhando ou perdendo. Se ganhar saísse
 * de graça, a decisão seria "jogue quando puder pagar", e o risco viraria só
 * uma barra de progresso com variância.
 *
 * A FAMÍLIA é o que separa isto de um minijogo. Ela cai a cada noite, e a
 * família é justamente o laço que multiplica a recuperação semanal
 * (`recuperacaoPelaFamilia`) — então o atleta que vive no cassino se recupera
 * pior, joga pior e precisa de mais dinheiro. É o ciclo que o sistema existe
 * para oferecer, e ele se fecha sozinho, sem nenhuma regra escrita à mão.
 */
export function jogarNoCassino(
  mesa: MesaDeCassino,
  aposta: number,
  semente: string,
): ResultadoDoCassino {
  const valor = Math.max(mesa.minimo, Math.min(mesa.maximo, Math.round(aposta)))
  const ganhou = roll(`${semente}:${mesa.id}`) < mesa.chance

  const saldo = ganhou ? Math.round(valor * (mesa.pagamento - 1)) : -valor

  return {
    ganhou,
    saldo,
    // A noite cobra o mesmo sono, tenha ele ganhado ou perdido.
    forma: -3,
    // ⚠️ GANHAR APARECE. Foto na sala VIP com uma pilha de fichas repercute —
    // e repercussão não é elogio: é a imprensa falando de você por algo que não
    // é futebol. Quem perde some, e por isso perder não move a reputação.
    reputacao: ganhou && mesa.id === "vip" ? 2 : 0,
    familia: -4,
    texto: ganhou
      ? `Noite boa na ${mesa.nome}: +${saldo.toLocaleString("pt-BR")}.`
      : `A ${mesa.nome} levou ${valor.toLocaleString("pt-BR")}.`,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// OS CAVALOS
// ═══════════════════════════════════════════════════════════════════════════

export interface CavaloDeCorrida {
  id: string
  nome: string
  preco: number
  /** Custa toda semana, ganhe ou não. Cavalo come todo dia. */
  manutencaoSemanal: number
  /** Chance de vencer uma corrida na semana, 0 a 1. */
  chanceDeVitoria: number
  /** Prêmio quando vence. */
  premio: number
  /** Quanto ele soma no estilo — o mesmo eixo dos outros bens. */
  estilo: number
}

/**
 * O HARAS.
 *
 * ⚠️ RETORNO QUASE NEUTRO, DE PROPÓSITO — e "quase" é a palavra. O potro paga
 * levemente abaixo do que custa; o campeão paga levemente acima, e custa uma
 * fortuna para entrar. Nenhum é dinheiro fácil e nenhum é armadilha pura:
 *
 *     potro     0,18 × 42.000 = 7.560/sem contra 8.200 de custo
 *     promessa  0,22 × 96.000 = 21.120     contra 19.500
 *     campeão   0,26 × 320.000 = 83.200    contra 74.000
 *
 * O campeão é melhor no papel e pior na prática para quase todo mundo: ele
 * custa 4,2 milhões para comprar e 74 mil por semana MESMO nas semanas em que
 * não corre. Um atleta de Série B que compra um campeão quebra, e é essa a
 * decisão — não "qual rende mais", e sim "qual eu aguento manter".
 */
export const CAVALOS_DO_ATLETA: CavaloDeCorrida[] = [
  { id: "potro", nome: "Potro promissor", preco: 320_000, manutencaoSemanal: 8_200, chanceDeVitoria: 0.18, premio: 42_000, estilo: 9 },
  { id: "promessa", nome: "Puro-sangue de pista", preco: 980_000, manutencaoSemanal: 19_500, chanceDeVitoria: 0.22, premio: 96_000, estilo: 18 },
  { id: "campeao", nome: "Campeão de haras", preco: 4_200_000, manutencaoSemanal: 74_000, chanceDeVitoria: 0.26, premio: 320_000, estilo: 34 },
]

export interface CorridaDaSemana {
  venceu: boolean
  premio: number
  nome: string
}

/**
 * A CORRIDA DA SEMANA — resolvida junto com o resto da vida pessoal.
 *
 * Semeada pela rodada: a mesma semana dá o mesmo resultado, como todo o resto
 * da carreira. Sem isso, recarregar o save até o cavalo ganhar seria a jogada
 * ótima, e a aposta deixaria de ser aposta.
 */
export function correrNaSemana(cavaloId: string, semente: string): CorridaDaSemana | null {
  const cavalo = CAVALOS_DO_ATLETA.find(c => c.id === cavaloId)
  if (!cavalo) return null
  const venceu = roll(`${semente}:corrida:${cavalo.id}`) < cavalo.chanceDeVitoria
  return { venceu, premio: venceu ? cavalo.premio : 0, nome: cavalo.nome }
}

// ═══════════════════════════════════════════════════════════════════════════
// OS EVENTOS
// ═══════════════════════════════════════════════════════════════════════════

export type TipoDeEvento = "gala" | "beneficente" | "marca" | "torcida" | "balada"

export interface ConviteDeEvento {
  id: string
  tipo: TipoDeEvento
  nome: string
  descricao: string
  /** Custo de energia. Evento também cansa. */
  energia: number
  /** Quanto custa do bolso (ou quanto paga, se negativo). */
  custo: number
  efeitos: {
    reputacao?: number
    imprensa?: number
    elenco?: number
    familia?: number
    marcas?: number
    moral?: number
    forma?: number
  }
  /** Reputação mínima para ser convidado. Ninguém chama um desconhecido. */
  reputacaoMinima: number
}

/**
 * OS CONVITES.
 *
 * ⚠️ NENHUM DELES É SÓ BOM, e é isso que os torna decisões. Cada um cobra em
 * uma moeda e paga em outra:
 *
 *   GALA          reputação e imprensa; custa caro e cansa.
 *   BENEFICENTE   torcida, imprensa e família; custa dinheiro de verdade.
 *   MARCA         PAGA dinheiro e sobe `marcas`; a imprensa acha oportunista.
 *   TORCIDA       o mais barato, e o único que o elenco aprova junto.
 *   BALADA        moral e nada mais — e cobra forma, família e imprensa.
 *
 * A BALADA existe para que "sair para se divertir" tenha preço. Sem ela, a
 * vida do atleta seria uma lista de obrigações rentáveis, que é o oposto do
 * que uma carreira de jogador conta.
 */
export const CONVITES_DE_EVENTO: ConviteDeEvento[] = [
  {
    id: "gala", tipo: "gala", nome: "Gala do futebol",
    descricao: "Smoking, fotógrafos e o presidente da federação na mesa ao lado.",
    energia: 8, custo: 45_000, reputacaoMinima: 45,
    efeitos: { reputacao: 5, imprensa: 6, familia: -2 },
  },
  {
    id: "beneficente", tipo: "beneficente", nome: "Ação beneficente",
    descricao: "Um dia inteiro na comunidade onde o clube nasceu.",
    energia: 12, custo: 120_000, reputacaoMinima: 0,
    efeitos: { reputacao: 3, imprensa: 8, familia: 4, moral: 3 },
  },
  {
    id: "marca", tipo: "marca", nome: "Evento de patrocinador",
    descricao: "Três horas de fotos com o produto na mão. Eles pagam bem.",
    energia: 10, custo: -180_000, reputacaoMinima: 35,
    efeitos: { marcas: 10, reputacao: 2, imprensa: -3 },
  },
  {
    id: "torcida", tipo: "torcida", nome: "Encontro com a torcida",
    descricao: "Portão do CT, camisa para assinar e duas horas de fila.",
    energia: 6, custo: 0, reputacaoMinima: 0,
    efeitos: { reputacao: 2, elenco: 3, moral: 4 },
  },
  {
    id: "balada", tipo: "balada", nome: "Noite na cidade",
    descricao: "Só desta vez. Sempre é só desta vez.",
    energia: 14, custo: 25_000, reputacaoMinima: 0,
    efeitos: { moral: 8, forma: -5, familia: -6, imprensa: -5 },
  },
]

/**
 * QUAIS CONVITES CHEGAM NESTA SEMANA.
 *
 * ⚠️ A REPUTAÇÃO É PORTA DE ENTRADA, NÃO BÔNUS. Ninguém convida um garoto da
 * quarta divisão para a gala do futebol — e é isso que faz a reputação valer
 * alguma coisa fora da mesa de transferência. A balada e a torcida chegam
 * sempre, porque essas duas portas estão abertas para qualquer um.
 *
 * Dois por semana, semeados pela rodada. Oferecer os cinco toda semana faria a
 * escolha desaparecer: o jogador pegaria o melhor de cada eixo e pronto.
 */
export function convitesDaSemana(reputacao: number, semente: string): ConviteDeEvento[] {
  const posso = CONVITES_DE_EVENTO.filter(c => reputacao >= c.reputacaoMinima)
  if (posso.length <= 2) return posso
  const inicio = Math.floor(roll(`${semente}:convite`) * posso.length)
  return [posso[inicio], posso[(inicio + 1 + Math.floor(roll(`${semente}:convite2`) * (posso.length - 1))) % posso.length]]
    .filter((c, i, lista) => lista.findIndex(o => o.id === c.id) === i)
}

/** Aplica os efeitos de relação de um evento sobre os cinco laços. */
export function relacoesDepoisDoEvento(r: Relacoes, evento: ConviteDeEvento): Relacoes {
  return {
    ...r,
    imprensa: limitar(r.imprensa + (evento.efeitos.imprensa ?? 0)),
    elenco: limitar(r.elenco + (evento.efeitos.elenco ?? 0)),
    familia: limitar(r.familia + (evento.efeitos.familia ?? 0)),
  }
}

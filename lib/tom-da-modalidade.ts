// O QUE A DIRETORIA, A IMPRENSA E O TREINO COBRAM — POR MODALIDADE.
//
// ⚠️ POR QUE ISTO EXISTE. A auditoria de 18/08/2026 mediu: apenas SETE arquivos
// do jogo consultavam a modalidade da carreira, e só mercado e leilões mudavam
// de comportamento. Na prática, a diretoria de um clube feminino cobrava com a
// mesma escala de dinheiro do masculino, a imprensa usava o mesmo vocabulário, e
// o Sub-20 era cobrado por resultado como se formar atleta não fosse o trabalho.
//
// Era essa a origem da sensação de que as outras modalidades são "menos
// profissionais" que a carreira de técnico: os sistemas ao redor delas estavam
// certos, mas falavam com todo mundo do mesmo jeito.
//
// A regra do módulo: ele NÃO decide nada de simulação. Ele responde três
// perguntas — com que ESCALA de dinheiro esta modalidade vive, o que a diretoria
// cobra ANTES de resultado, e com que PALAVRAS o clube e a imprensa falam dela.
// Quem simula continua sendo quem já simulava.
//
// ⚠️ NADA AQUI PRESUME O GÊNERO DE QUEM DIRIGE. Um clube feminino pode ser
// dirigido por qualquer pessoa; o vocabulário fala da EQUIPE e da COMPETIÇÃO,
// nunca de quem está no banco. Tratar o técnico do time feminino no feminino
// seria inventar um dado que o jogo não tem.
//
// ⚠️ QUASE puro: a última seção publica um RETRATO da modalidade, porque o
// motor (`lib/game-engine`) é um store separado que não pode importar o save
// sem criar ciclo. É o mesmo encanamento de `sincronizarTreinador` e
// `sincronizarDesafioAtivo`, e pela mesma razão: quem simula precisa saber a
// regra sem depender de qual tela está montada.

import type { ModalidadeDeCarreira } from "@/lib/modalidade-de-carreira"

/** O que a diretoria cobra antes de tudo. Muda o peso das áreas da confiança. */
export type PrioridadeDaDiretoria = "resultado" | "crescimento" | "formacao"

export interface TomDaModalidade {
  id: ModalidadeDeCarreira
  /** Como a diretoria e a imprensa chamam o time. Entra no meio de frases. */
  equipe: string
  /** O plural de quem joga, para as falas ("os atletas", "as atletas"). */
  atletas: string
  /**
   * Escala de dinheiro em relação ao futebol masculino profissional.
   *
   * Vem da mesma modelagem que `construirTimesFemininos` já usava para caixa
   * (12%) — aqui ela deixa de valer só para o cadastro do clube e passa a valer
   * para o que a diretoria considera "gasto alto" e para o que a imprensa
   * chama de "contratação cara".
   */
  escalaFinanceira: number
  /** O que a diretoria cobra ANTES de resultado. */
  prioridade: PrioridadeDaDiretoria
  /** Como a diretoria abre uma conversa de verba nesta modalidade. */
  falaDeVerba: string
  /** O que a diretoria considera sucesso, em uma linha. */
  oQueEsperam: string
  /** Como a imprensa chama a competição principal. */
  competicao: string
}

const TONS: Record<ModalidadeDeCarreira, TomDaModalidade> = {
  profissional: {
    id: "profissional",
    equipe: "o elenco",
    atletas: "os atletas",
    escalaFinanceira: 1,
    prioridade: "resultado",
    falaDeVerba: "O clube investe quando o projeto responde. Diga o que precisa.",
    oQueEsperam: "resultado na tabela e equilíbrio nas contas",
    competicao: "o campeonato",
  },
  feminino: {
    id: "feminino",
    equipe: "a equipe feminina",
    atletas: "as atletas",
    // A mesma fração que o cadastro do clube já usa para caixa. Sem isto, a
    // diretoria de um clube feminino chamava de "gasto controlado" uma folha
    // que na modalidade seria impagável.
    escalaFinanceira: 0.12,
    prioridade: "crescimento",
    falaDeVerba:
      "O departamento cresce com resultado e com público. Mostre o que a verba devolve em campo e nas arquibancadas.",
    oQueEsperam: "crescimento do departamento, público e um título ao alcance",
    competicao: "a liga",
  },
  sub20: {
    id: "sub20",
    equipe: "o Sub-20",
    atletas: "os garotos",
    // Base vive de orçamento de formação, não de folha de profissional.
    escalaFinanceira: 0.05,
    prioridade: "formacao",
    falaDeVerba:
      "Aqui a conta é outra: a base existe para formar. Verba para a categoria sai quando atleta nosso sobe e rende.",
    oQueEsperam: "atletas promovidos ao profissional, antes de qualquer taça",
    competicao: "a competição da categoria",
  },
  jogador: {
    id: "jogador",
    equipe: "o elenco",
    atletas: "os companheiros",
    escalaFinanceira: 1,
    prioridade: "resultado",
    falaDeVerba: "Isso é conversa de diretoria com treinador — você joga.",
    oQueEsperam: "seu rendimento em campo",
    competicao: "o campeonato",
  },
}

export function tomDaModalidade(id: ModalidadeDeCarreira | undefined): TomDaModalidade {
  return TONS[id ?? "profissional"] ?? TONS.profissional
}

/**
 * PESO DE CADA ÁREA NA CONFIANÇA DA DIRETORIA, por modalidade.
 *
 * ⚠️ ESTE É O CORAÇÃO DA CORREÇÃO. Antes, "base" pesava igual para todo mundo —
 * inclusive para quem dirige o Sub-20, onde formar não é uma das áreas: é O
 * trabalho. E o clube feminino era cobrado pelas finanças na mesma régua de um
 * clube masculino de Série A, o que é cobrar por um problema que a modalidade
 * não escolheu ter.
 *
 * Os pesos multiplicam a nota de cada área antes da média. Peso 0 não existe de
 * propósito: nenhuma área some da leitura, todas apenas pesam o que devem.
 */
export function pesoDasAreas(
  id: ModalidadeDeCarreira | undefined,
): Record<"resultados" | "financas" | "mercado" | "base" | "vestiario", number> {
  switch (id ?? "profissional") {
    case "sub20":
      // Formar é o trabalho. Resultado importa, mas não é o que mantém o emprego.
      return { resultados: 0.7, financas: 0.5, mercado: 0.4, base: 2.2, vestiario: 1 }
    case "feminino":
      // Crescimento e campo pesam; a cobrança financeira é mais tolerante porque
      // a modalidade opera com uma fração do orçamento.
      return { resultados: 1.2, financas: 0.6, mercado: 0.8, base: 1.1, vestiario: 1 }
    case "jogador":
      // Quem joga não responde por caixa nem por mercado.
      return { resultados: 1.4, financas: 0.2, mercado: 0.2, base: 0.4, vestiario: 1.3 }
    default:
      return { resultados: 1, financas: 1, mercado: 1, base: 1, vestiario: 1 }
  }
}

/**
 * O valor em dinheiro relido na escala da modalidade.
 *
 * Usado por quem precisa dizer "isso é caro" sem chumbar um número de futebol
 * masculino profissional: R$ 2 milhões é contratação modesta na Série A e é a
 * folha inteira de um ano no feminino.
 */
export function naEscalaDaModalidade(valor: number, id: ModalidadeDeCarreira | undefined): number {
  return Math.round(valor * tomDaModalidade(id).escalaFinanceira)
}

/**
 * QUANTO O TREINO RENDE NESTA MODALIDADE.
 *
 * ⚠️ No Sub-20 formar NAO e um efeito colateral do trabalho: e o trabalho. Um
 * elenco de garotos que evolui no mesmo ritmo de um elenco profissional torna a
 * carreira de base uma versao mais pobre da mesma coisa — que era exatamente a
 * queixa. O ganho e modesto de proposito: quem forma tem vantagem, nao um botao
 * de trapaca.
 *
 * Multiplica o `rendimentoDeTreino` publicado pelo retrato do treinador, entao
 * ele se soma ao que o tecnico ja e — sem cano novo e sem tela nova.
 */
export function rendimentoDeTreinoDaModalidade(id: ModalidadeDeCarreira | undefined): number {
  switch (id ?? "profissional") {
    case "sub20": return 1.25
    default: return 1
  }
}

// ─── Retrato publicado (o encanamento) ───────────────────────────────────────

let _modalidade: ModalidadeDeCarreira = "profissional"

/**
 * Publica a modalidade da carreira aberta. Chamado pelo `save-system` a cada
 * carga e a cada gravação — nunca por uma tela, para não depender de qual tela
 * está montada. Sem isto, o motor não tem como saber que a coletiva de hoje é
 * de um Sub-20 e faz a imprensa perguntar sobre briga por título.
 */
export function sincronizarModalidade(
  state: { modalidade?: ModalidadeDeCarreira; youthCareer?: { active?: boolean } } | null | undefined,
): void {
  _modalidade = state?.modalidade ?? (state?.youthCareer?.active ? "sub20" : "profissional")
}

/** A modalidade da carreira aberta. "profissional" quando não há carreira. */
export function modalidadeAtual(): ModalidadeDeCarreira {
  return _modalidade
}

/** Só para teste: devolve o retrato ao padrão. */
export function limparModalidade(): void {
  _modalidade = "profissional"
}

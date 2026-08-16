// MODALIDADE DA CARREIRA — o que exatamente esta carreira é.
//
// Até aqui "carreira" tinha um significado só: técnico de clube profissional
// masculino. As outras três já existiam pela metade e sem nome — a carreira de
// base (`youthCareer`) tinha motor e tela e NENHUM caminho para ser criada
// (`careerStart` nunca deixava de ser "professional", como o próprio comentário
// em `app/novo-jogo` reconhecia), e o futebol feminino não existia em lugar
// nenhum.
//
// Dar nome à escolha é o que permite as telas perguntarem "que carreira é esta?"
// sem cada uma inventar a própria heurística — que foi como o jogo terminou com
// três lugares diferentes decidindo se uma liga tem rebaixamento.

export type ModalidadeDeCarreira =
  /** Técnico de clube profissional (o modo de sempre). */
  | "profissional"
  /** Técnica/técnico de clube FEMININO — liga, copa e continental próprias. */
  | "feminino"
  /** Técnico da base: Sub-20 do clube, com as competições de base do país. */
  | "sub20"
  /** UM atleta, do começo ao fim da carreira (o Player Career do EA FC). */
  | "jogador"

export interface DescricaoDeModalidade {
  id: ModalidadeDeCarreira
  titulo: string
  resumo: string
  /** Frase curta que a tela de criação usa como subtítulo do card. */
  detalhe: string
}

/**
 * ⚠️ AS TRÊS DE TÉCNICO E A DE ATLETA ENTRAM POR PORTAS DIFERENTES (1.0.324).
 *
 * `MODALIDADES` é a lista da tela de criação de carreira, e ela só tem as de
 * TÉCNICO: profissional, feminino e sub-20 — as três respondem à mesma pergunta
 * ("que clube você vai dirigir?") e por isso convivem no mesmo seletor.
 *
 * A carreira de JOGADOR não responde a essa pergunta: quem escolhe ser atleta
 * escolhe primeiro um CORPO e só depois um clube. Ela virou item do MENU
 * PRINCIPAL, ao lado de "Novo jogo" (pedido do usuário). Quem precisa da lista
 * das quatro — para rotular um save, por exemplo — usa `TODAS_AS_MODALIDADES`.
 */
export const MODALIDADES: DescricaoDeModalidade[] = [
  {
    id: "profissional",
    titulo: "Técnico profissional",
    resumo: "Comande um clube masculino em qualquer uma das ligas do jogo.",
    detalhe: "Liga, copa nacional, continental, mercado e diretoria.",
  },
  {
    id: "feminino",
    titulo: "Futebol feminino",
    resumo: "Dirija um clube feminino — ligas, copas e calendário da modalidade.",
    detalhe: "Brasileirão A1/A2, WSL, Liga F, NWSL, Frauen-Bundesliga e mais.",
  },
  {
    id: "sub20",
    titulo: "Categoria de base",
    resumo: "Comece no Sub-20 e chegue ao profissional formando atletas.",
    detalhe: "Copinha, Brasileirão Sub-20 e as competições de base do país.",
  },
]

/** A carreira de atleta — fora do seletor de técnico, no menu principal. */
export const MODALIDADE_DE_JOGADOR: DescricaoDeModalidade = {
  id: "jogador",
  titulo: "Carreira de jogador",
  resumo: "Uma atleta ou um atleta só: da estreia à aposentadoria.",
  detalhe: "Nota do treinador, evolução por pontos, seleção e propostas.",
}

/** As quatro, para quem precisa rotular um save qualquer. */
export const TODAS_AS_MODALIDADES: DescricaoDeModalidade[] = [...MODALIDADES, MODALIDADE_DE_JOGADOR]

export function descricaoDaModalidade(id: ModalidadeDeCarreira | undefined): DescricaoDeModalidade {
  return TODAS_AS_MODALIDADES.find(m => m.id === id) ?? MODALIDADES[0]
}

/**
 * A modalidade de um save.
 *
 * Saves anteriores não têm o campo — e todos eles são carreira de técnico
 * profissional, então a ausência responde "profissional". É o mesmo critério do
 * `tecnicos?: TecnicoDoSave[]`: ausente significa o modo antigo, nunca "não
 * sei".
 */
export function modalidadeDoSave(state: {
  modalidade?: ModalidadeDeCarreira
  youthCareer?: { active?: boolean } | undefined
} | null | undefined): ModalidadeDeCarreira {
  if (!state) return "profissional"
  if (state.modalidade) return state.modalidade
  // Save antigo com carreira de base ativa: a modalidade sempre foi sub-20, o
  // campo é que não existia.
  if (state.youthCareer?.active) return "sub20"
  return "profissional"
}

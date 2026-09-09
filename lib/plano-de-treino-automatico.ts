// PLANO DE TREINO AUTOMATICO — as regras que ajustam o treino de cada atleta
// sozinhas, sem o tecnico abrir a tela toda semana.
//
// ⚠️ O QUE ISTO ACRESCENTA, E O QUE ELE NAO REFAZ.
//
// O jogo ja tinha o plano COLETIVO (`PlanoDeTreino` em treino-e-entrosamento:
// intensidade, foco e as sete sessoes da semana) e ja tinha a medida de RITMO
// DE JOGO por atleta (`lib/ritmo-de-jogo.ts`, 1.0.386). O que nao existia era a
// ponte entre os dois: um atleta encostado ha dois meses e um titular que jogou
// 90 minutos na quarta recebiam exatamente o mesmo treino, porque o plano so
// sabia falar com o elenco inteiro de uma vez.
//
// A referencia (PDF Ultra26, p.15) resolve isso com REGRAS: cada plano tem um
// limite, e ele vale para quem estiver abaixo daquele limite de ritmo. Nada
// disso substitui o plano coletivo — a semana continua sendo dele. Isto decide,
// atleta a atleta, se ele puxa mais, puxa menos ou so se recupera.
//
// ⚠️ E ISTO NAO INVENTA NUMERO NOVO. Os limites saem das constantes que o ritmo
// ja publica (PISO_SEM_EFEITO, RITMO_AFIADO, RITMO_INICIAL). Cravar 70/85/95
// aqui a mao criaria uma segunda fonte da mesma regra, que e como
// `duas escalas` ja mordeu este projeto antes.

import { PISO_SEM_EFEITO, RITMO_AFIADO, RITMO_INICIAL } from "@/lib/ritmo-de-jogo"

/** Os quatro planos da referencia, mais o neutro. */
export type PlanoAutomatico = "intenso" | "pesado" | "leve" | "recuperacao" | "equilibrado"

export const ROTULO_DO_PLANO: Record<PlanoAutomatico, string> = {
  intenso: "Intenso",
  pesado: "Pesado",
  leve: "Leve",
  recuperacao: "Recuperação",
  equilibrado: "Equilibrado",
}

export const DESCRICAO_DO_PLANO: Record<PlanoAutomatico, string> = {
  intenso: "Puxa forte para devolver ritmo a quem está há muito tempo sem jogar. Cansa mais.",
  pesado: "Carga acima da média para quem está perdendo ritmo, sem chegar ao desgaste do intenso.",
  leve: "Mantém o atleta afiado sem acumular fadiga. É o treino de quem está jogando.",
  recuperacao: "Só recupera. Para quem acabou de jogar, está no limite físico ou voltando de lesão.",
  equilibrado: "Ativado por padrão se nenhuma outra regra alcançar o atleta.",
}

/**
 * Uma regra: "este plano vale para quem tiver RITMO abaixo deste limite".
 *
 * `limite: null` e o plano sem gatilho — ele so entra pela porta dos fundos, no
 * `equilibrado`, ou quando o tecnico o escolhe a mao no plano manual.
 */
export interface RegraDePlano {
  plano: PlanoAutomatico
  /** Ritmo de jogo abaixo do qual a regra dispara. `null` = sem gatilho. */
  limite: number | null
  /** O tecnico ligou esta regra? Regra desligada nao e avaliada. */
  ativa: boolean
}

/**
 * ⚠️ A ORDEM DESTA LISTA E A REGRA, e nao um detalhe de apresentacao.
 *
 * As regras sao avaliadas de cima para baixo e a PRIMEIRA que alcanca o atleta
 * ganha. Por isso os limites vao do menor para o maior: quem esta em 40 de
 * ritmo precisa do intenso, nao do leve — e se a lista comecasse pelo leve
 * (limite 95, que alcanca quase todo mundo) nenhum atleta jamais chegaria ao
 * intenso. Foi assim que o `assignPlayersToFormation` ja se enganou uma vez,
 * gastando o especialista no primeiro slot que o aceitava.
 */
export const REGRAS_PADRAO: RegraDePlano[] = [
  // Sem ritmo nenhum: precisa jogar e treinar forte para voltar.
  { plano: "intenso", limite: PISO_SEM_EFEITO - 20, ativa: true },
  // Perdendo ritmo: ja sente a penalidade de forca.
  { plano: "pesado", limite: PISO_SEM_EFEITO, ativa: true },
  // Em ritmo de jogo normal: manutencao.
  { plano: "leve", limite: RITMO_AFIADO, ativa: true },
  // Sem gatilho por ritmo — a recuperacao e decidida pela ENERGIA, abaixo.
  { plano: "recuperacao", limite: null, ativa: true },
]

/**
 * Energia abaixo da qual a recuperacao vence QUALQUER regra de ritmo.
 *
 * ⚠️ ELA VEM ANTES DE TUDO de proposito. Um atleta a 30% de energia e a 40% de
 * ritmo satisfaz a regra do "intenso" — e mandar quem esta exausto para o
 * treino mais pesado do jogo e exatamente como se contunde alguem. Falta de
 * ritmo se resolve com o tempo; lesao por sobrecarga custa meses.
 */
export const ENERGIA_DE_RECUPERACAO = 55

export interface AtletaParaPlano {
  id: number
  /** Ritmo de jogo (0-100). Ausente em save antigo — cai no neutro. */
  ritmo?: number
  /** Energia (0-100). */
  energy?: number
  /** Lesionado nao treina: ele se recupera. */
  injury?: unknown
}

export interface PlanoDoAtleta {
  id: number
  plano: PlanoAutomatico
  /** Por que este plano — o texto que a tela mostra ao lado do atleta. */
  motivo: string
}

/**
 * Decide o plano de UM atleta a partir das regras ligadas.
 *
 * Determinística e sem estado: a mesma entrada dá a mesma saída, para o portão
 * poder afirmar alguma coisa sobre ela.
 */
export function planoDoAtleta(
  atleta: AtletaParaPlano,
  regras: readonly RegraDePlano[] = REGRAS_PADRAO,
): PlanoDoAtleta {
  const ritmo = atleta.ritmo ?? RITMO_INICIAL
  const energia = atleta.energy ?? 100

  if (atleta.injury) {
    return { id: atleta.id, plano: "recuperacao", motivo: "Em tratamento" }
  }

  const recuperacaoLigada = regras.some(r => r.plano === "recuperacao" && r.ativa)
  if (recuperacaoLigada && energia < ENERGIA_DE_RECUPERACAO) {
    return { id: atleta.id, plano: "recuperacao", motivo: `Energia em ${Math.round(energia)}%` }
  }

  for (const regra of regras) {
    if (!regra.ativa || regra.limite === null) continue
    if (ritmo < regra.limite) {
      return {
        id: atleta.id,
        plano: regra.plano,
        motivo: `Ritmo de jogo ${Math.round(ritmo)} (abaixo de ${regra.limite})`,
      }
    }
  }

  return { id: atleta.id, plano: "equilibrado", motivo: "Em dia — nenhuma regra alcança" }
}

/** O mesmo para o elenco inteiro. */
export function planoDoElenco(
  elenco: readonly AtletaParaPlano[],
  regras: readonly RegraDePlano[] = REGRAS_PADRAO,
): PlanoDoAtleta[] {
  return elenco.map(a => planoDoAtleta(a, regras))
}

/**
 * COMO O PLANO CHEGA AO MOTOR DE TREINO.
 *
 * ⚠️ ELE NAO INVENTA UM MULTIPLICADOR NOVO. `AtletaNaSemana.cargaIndividual`
 * ("poupado" | "normal" | "reforcado") ja existia inteira em
 * lib/treino-e-entrosamento.ts: ela mexe na carga (0,55x / 1,4x) e no
 * rendimento (0,7x / 1,25x) de cada atleta, com comentario explicando que serve
 * para "poupar o veterano de 34 e puxar o jovem que precisa de folego".
 *
 * E NADA NO JOGO INTEIRO A DEFINIA. Grep em lib/, app/ e components/: as quatro
 * unicas ocorrencias eram a declaracao e os proprios usos dentro do motor. Um
 * parametro morto desde que nasceu — o padrao de
 * [[ultrafoot-sistemas-implementados-porem-desligados]].
 *
 * Este mapa e o motorista que faltava. Criar um `CARGA_DO_PLANO` proprio seria
 * a segunda escala do mesmo numero, que e o erro que
 * [[ultrafoot-duas-escalas-prestigio-elenco]] documenta.
 */
export const CARGA_INDIVIDUAL_DO_PLANO: Record<PlanoAutomatico, "poupado" | "normal" | "reforcado"> = {
  intenso: "reforcado",
  pesado: "reforcado",
  equilibrado: "normal",
  leve: "poupado",
  recuperacao: "poupado",
}

/** Contagem por plano, para o resumo da tela. */
export function resumoDosPlanos(planos: readonly PlanoDoAtleta[]): Record<PlanoAutomatico, number> {
  const out: Record<PlanoAutomatico, number> = {
    intenso: 0, pesado: 0, leve: 0, recuperacao: 0, equilibrado: 0,
  }
  for (const p of planos) out[p.plano]++
  return out
}

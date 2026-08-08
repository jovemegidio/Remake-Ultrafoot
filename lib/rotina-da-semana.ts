// A SEMANA TEM DIAS — jogo, treino e descanso.
//
// ⚠️ POR QUE ISTO EXISTE (pedido: "implemente dia de jogo, dia de descanso, dia
// de treinamento, assim como na vida real").
//
// O jogo avança por SEMANA. Dentro dela, o técnico treinava o tempo todo: havia
// um plano (intensidade + foco) aplicado de bloco, e descanso só acontecia por
// acidente — numa semana sem partida, porque ninguém gastava minutos. Não existia
// a decisão que todo treinador real toma na segunda-feira: com jogo na quarta e
// no domingo, quantos dias eu treino e quantos eu poupo?
//
// ⚠️ O QUE ISTO **NÃO** FAZ, e por quê: não muda a cadência do avanço para dia a
// dia. Trocar a unidade do relógio quebraria calendário, contratos, empréstimos e
// todo save em andamento — e o pedido é de realismo na rotina, não de um relógio
// novo. Aqui a semana continua sendo a unidade; o que passa a existir é a sua
// COMPOSIÇÃO, e ela modula a carga de treino e a recuperação que já existem.
//
// A REGRA VEM DO CALENDÁRIO, não de um botão: o número de jogos da semana define
// quantos dias sobram. Semana de jogo único tem 6 dias livres; semana de dois
// jogos (meio de semana + fim de semana) tem 4; semana cheia de copa, menos.
// O técnico distribui esses dias livres entre treinar e poupar.

/** O que se faz num dia da semana. */
export type TipoDeDia = "jogo" | "treino" | "descanso" | "viagem"

export interface DiaDaSemana {
  /** 0 = segunda … 6 = domingo. */
  indice: number
  tipo: TipoDeDia
  rotulo: string
}

/** Quanto o técnico quer poupar o elenco nos dias livres. */
export type Postura = "carga_total" | "equilibrado" | "poupar"

export interface RotinaDaSemana {
  dias: DiaDaSemana[]
  diasDeJogo: number
  diasDeTreino: number
  diasDeDescanso: number
  /**
   * Multiplicador da CARGA de treino da semana (1 = a carga cheia de hoje).
   * Menos dias de treino, menos carga — é o que faz poupar custar rendimento.
   */
  fatorDeCarga: number
  /**
   * Energia extra recuperada por dia de descanso, somada ao que o motor já faz.
   * É o outro lado da moeda: quem poupa chega mais inteiro no jogo.
   */
  recuperacaoExtra: number
  /** Frase curta para a tela. */
  resumo: string
}

const NOMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]

/**
 * Em que dias da semana caem os jogos.
 *
 * Um jogo → domingo. Dois → quarta e domingo (o padrão brasileiro de meio de
 * semana). Três → segunda, quinta e domingo. Acima disso a semana está cheia e
 * praticamente não sobra treino, que é exatamente o problema de um clube em
 * três competições.
 */
function diasDosJogos(jogos: number): number[] {
  if (jogos <= 0) return []
  if (jogos === 1) return [6]
  if (jogos === 2) return [2, 6]
  if (jogos === 3) return [0, 3, 6]
  return [0, 2, 4, 6]
}

/**
 * Monta a semana.
 *
 * `postura` decide o que fazer com os dias livres. A véspera de jogo NUNCA é dia
 * de treino forte — no futebol ela é de ativação/viagem —, então o dia anterior a
 * cada partida entra como descanso mesmo na carga total. É o que impede o técnico
 * de chegar em campo com o elenco moído por escolha da interface.
 */
export function montarRotina(jogosNaSemana: number, postura: Postura = "equilibrado"): RotinaDaSemana {
  const jogos = new Set(diasDosJogos(jogosNaSemana))
  const vespera = new Set([...jogos].map(d => d - 1).filter(d => d >= 0 && !jogos.has(d)))

  const dias: DiaDaSemana[] = []
  for (let i = 0; i < 7; i++) {
    let tipo: TipoDeDia
    if (jogos.has(i)) tipo = "jogo"
    else if (vespera.has(i)) tipo = "descanso"
    else tipo = "treino"
    dias.push({ indice: i, tipo, rotulo: NOMES[i] })
  }

  // A postura converte dias de treino em descanso (ou o contrário, quando dá).
  const livres = dias.filter(d => d.tipo === "treino")
  if (postura === "poupar") {
    // Poupa metade dos dias de treino, começando pelos mais próximos do jogo.
    const aPoupar = Math.ceil(livres.length / 2)
    for (const d of livres.slice(-aPoupar)) d.tipo = "descanso"
  } else if (postura === "equilibrado" && livres.length >= 4) {
    // Semana folgada: um dia de folga é padrão em qualquer clube.
    livres[livres.length - 1].tipo = "descanso"
  }
  // carga_total não converte nada — mas as vésperas continuam de descanso.

  const diasDeJogo = dias.filter(d => d.tipo === "jogo").length
  const diasDeTreino = dias.filter(d => d.tipo === "treino").length
  const diasDeDescanso = dias.filter(d => d.tipo === "descanso").length

  // 4 dias de treino é a semana "normal" de referência (jogo único, equilibrado).
  // O fator sai daí: mais treino que isso rende mais, menos rende menos — com
  // teto, para uma semana livre não valer o dobro de uma semana de jogo.
  const fatorDeCarga = Math.max(0.35, Math.min(1.5, diasDeTreino / 4))
  // Cada dia de descanso além do primeiro devolve energia. O primeiro não conta:
  // ele é a folga que todo elenco já tem, e o motor já a considera na conta base.
  const recuperacaoExtra = Math.max(0, diasDeDescanso - 1) * 4

  const resumo = diasDeJogo === 0
    ? `Semana livre: ${diasDeTreino} dias de treino e ${diasDeDescanso} de descanso.`
    : `${diasDeJogo} jogo(s), ${diasDeTreino} dia(s) de treino e ${diasDeDescanso} de descanso.`

  return { dias, diasDeJogo, diasDeTreino, diasDeDescanso, fatorDeCarga, recuperacaoExtra, resumo }
}

/** Rótulo curto por tipo — usado pela tela e pelo resumo. */
export const ROTULO_DO_DIA: Record<TipoDeDia, string> = {
  jogo: "Jogo",
  treino: "Treino",
  descanso: "Descanso",
  viagem: "Viagem",
}

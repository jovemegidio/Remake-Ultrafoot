// AGENTES QUE PROCURAM VOCÊ.
//
// O jogo já tinha `contract-negotiation` (quanto o agente pede para renovar),
// `negotiation-engine` e `agente-do-jovem` (perfis, comissão). Tudo REATIVO: o
// agente só existia quando o técnico abria uma tela e começava a conversa. Na
// vida real é o contrário — é o empresário que liga, e ele liga insistindo.
//
// Este módulo é a INICIATIVA: quando o agente aborda, o que ele pede, e o que
// acontece com a relação quando não há acordo. É puro de propósito (nada de
// React nem de save) para poder ser testado — a regra de "o agente leva o
// jogador embora" é séria demais para depender de teste manual.

/** O que o agente veio cobrar. */
export type TipoDePedido = "salario" | "minutagem" | "renovacao"

export interface AtletaParaAgente {
  id: number
  nome: string
  overall: number
  idade: number
  /** Salário MENSAL atual. */
  salarioMensal: number
  valorDeMercado: number
  /** Semanas restantes de contrato. */
  semanasDeContrato: number
  /** Minutos jogados na temporada. */
  minutosNaTemporada: number
  /** Partidas que o CLUBE disputou na temporada — a régua da minutagem. */
  jogosDoClube: number
  titular: boolean
  /** 0-100. */
  moral: number
}

export interface RelacaoComAgente {
  /** 0 = cordial, 100 = rompida. */
  desgaste: number
  /** Semana do último contato, para o agente não ligar toda semana. */
  ultimoPedidoSemana: number
  pedidosRecusados: number
}

export interface PedidoDoAgente {
  playerId: number
  nome: string
  tipo: TipoDePedido
  /** Salário mensal pedido (em `salario` e `renovacao`). */
  salarioPedido?: number
  /** Anos de contrato pedidos (só em `renovacao`). */
  anosPedidos?: number
  /** O que o agente diz, na voz dele. */
  fala: string
  /** Quanto o desgaste sobe se o clube recusar. Pedido justo dói mais recusar. */
  pesoDaRecusa: number
}

export const RELACAO_INICIAL: RelacaoComAgente = {
  desgaste: 0,
  ultimoPedidoSemana: -99,
  pedidosRecusados: 0,
}

/** Semanas de silêncio entre dois contatos do mesmo agente. */
const INTERVALO_ENTRE_PEDIDOS = 8

/** A partir daqui o agente para de negociar e vai oferecer o atleta no mercado. */
export const DESGASTE_DE_RUPTURA = 70

/**
 * Fatia dos minutos possíveis que o atleta jogou (0-1).
 *
 * `jogosDoClube * 90` é o teto. Sem jogos ainda (começo de temporada) devolve
 * `null`: cobrar minutagem na primeira rodada seria absurdo, e dividir por zero
 * daria `Infinity` — que passaria em qualquer comparação de "jogou pouco".
 */
export function fatiaDeMinutos(atleta: AtletaParaAgente): number | null {
  const teto = atleta.jogosDoClube * 90
  if (teto <= 0) return null
  return Math.max(0, Math.min(1, atleta.minutosNaTemporada / teto))
}

/**
 * Salário que o mercado pagaria a este atleta, por mês.
 *
 * Serve de régua para o agente saber se está defasado. Ancorado no valor de
 * mercado (aprox. 0,55% ao mês) com um piso por qualidade, para que um atleta
 * bom e barato ainda gere pedido quando o valor de mercado está desatualizado.
 */
export function salarioJusto(atleta: AtletaParaAgente): number {
  const porValor = atleta.valorDeMercado * 0.0055
  const porQualidade = Math.max(0, atleta.overall - 55) ** 2 * 40
  return Math.round(Math.max(porValor, porQualidade) / 1000) * 1000
}

/**
 * O agente vai ligar agora? E sobre o quê?
 *
 * A ordem é a de urgência real: contrato acabando manda em tudo (é a última
 * chance de o clube não perdê-lo de graça), depois salário defasado, depois
 * minutagem. `null` = não há do que reclamar nesta semana.
 */
export function pedidoDaSemana(
  atleta: AtletaParaAgente,
  relacao: RelacaoComAgente,
  semana: number,
): TipoDePedido | null {
  // Relação rompida: o agente não negocia mais, já está procurando clube.
  if (relacao.desgaste >= DESGASTE_DE_RUPTURA) return null
  if (semana - relacao.ultimoPedidoSemana < INTERVALO_ENTRE_PEDIDOS) return null

  if (atleta.semanasDeContrato <= 30) return "renovacao"
  if (atleta.salarioMensal < salarioJusto(atleta) * 0.75) return "salario"

  const fatia = fatiaDeMinutos(atleta)
  // Só reclama de minutagem depois de a temporada ter amostra (5 jogos) e para
  // quem tem nível para exigir: reserva de overall baixo pedindo vaga é ruído.
  if (fatia !== null && atleta.jogosDoClube >= 5 && fatia < 0.3 && atleta.overall >= 68 && !atleta.titular) {
    return "minutagem"
  }
  return null
}

/** Monta o pedido concreto, com números e a fala do agente. */
export function montarPedido(atleta: AtletaParaAgente, tipo: TipoDePedido): PedidoDoAgente {
  const justo = salarioJusto(atleta)
  if (tipo === "renovacao") {
    const pedido = Math.round(Math.max(justo, atleta.salarioMensal * 1.15) / 1000) * 1000
    const anos = atleta.idade >= 32 ? 1 : atleta.idade >= 29 ? 2 : 3
    return {
      playerId: atleta.id, nome: atleta.nome, tipo,
      salarioPedido: pedido, anosPedidos: anos,
      fala: `O contrato do ${atleta.nome} acaba em ${atleta.semanasDeContrato} semanas. `
        + `Ou renovamos agora, ou ele escuta quem já está ligando.`,
      // Recusar quem está de saída é o erro mais caro: some de graça.
      pesoDaRecusa: 26,
    }
  }
  if (tipo === "salario") {
    const pedido = Math.round(justo / 1000) * 1000
    return {
      playerId: atleta.id, nome: atleta.nome, tipo,
      salarioPedido: pedido,
      fala: `O ${atleta.nome} rende como titular e ganha como reserva. `
        + `O mercado paga bem mais do que ele recebe aqui.`,
      pesoDaRecusa: 18,
    }
  }
  const fatia = fatiaDeMinutos(atleta) ?? 0
  return {
    playerId: atleta.id, nome: atleta.nome, tipo,
    fala: `O ${atleta.nome} jogou ${Math.round(fatia * 100)}% dos minutos possíveis. `
      + `Ele não veio para isso — ou joga, ou procuramos quem o coloque em campo.`,
    pesoDaRecusa: 20,
  }
}

export type RespostaDoClube = "aceito" | "recusado" | "ignorado"

/**
 * Efeito da resposta na relação.
 *
 * Aceitar RECUPERA terreno (não zera: a desconfiança acumulada não some com um
 * "sim"). Ignorar desgasta quase tanto quanto recusar — na prática, para o
 * agente, silêncio é recusa com falta de educação.
 */
export function aplicarResposta(
  relacao: RelacaoComAgente,
  pedido: PedidoDoAgente,
  resposta: RespostaDoClube,
  semana: number,
): RelacaoComAgente {
  const base = { ...relacao, ultimoPedidoSemana: semana }
  if (resposta === "aceito") {
    return { ...base, desgaste: Math.max(0, relacao.desgaste - 25) }
  }
  const acrescimo = resposta === "ignorado" ? pedido.pesoDaRecusa + 4 : pedido.pesoDaRecusa
  return {
    ...base,
    desgaste: Math.min(100, relacao.desgaste + acrescimo),
    pedidosRecusados: relacao.pedidosRecusados + 1,
  }
}

/** O agente desistiu de negociar e está oferecendo o atleta a outros clubes. */
export function agenteProcuraOutroClube(relacao: RelacaoComAgente): boolean {
  return relacao.desgaste >= DESGASTE_DE_RUPTURA
}

/**
 * Chance de o atleta ASSINAR PRÉ-CONTRATO com outro clube nesta semana.
 *
 * Só existe para quem está em fim de contrato: no futebol real, faltando poucos
 * meses o atleta pode acertar com quem quiser e sair de graça. É o que faltava
 * para o "ou ele mesmo aceita outra proposta e sai".
 *
 * Zero enquanto houver contrato longo — sem isto um desentendimento em janeiro
 * levaria embora um atleta com três anos de vínculo, o que não acontece.
 */
export function chanceDePreContrato(atleta: AtletaParaAgente, relacao: RelacaoComAgente): number {
  if (atleta.semanasDeContrato > 26) return 0
  const rompida = relacao.desgaste >= DESGASTE_DE_RUPTURA ? 0.55 : relacao.desgaste / 100 * 0.35
  const moralBaixa = atleta.moral < 45 ? 0.15 : 0
  // Quanto melhor o atleta, mais clubes na fila.
  const procura = atleta.overall >= 78 ? 0.15 : atleta.overall >= 70 ? 0.08 : 0.03
  return Math.max(0, Math.min(0.9, rompida + moralBaixa + procura))
}

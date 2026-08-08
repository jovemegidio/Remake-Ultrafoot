// CONVERSA COM O EMPRESÁRIO — o terceiro motor de diálogo do jogo.
//
// Já havia dois, e este segue o MESMO contrato deles (`conversa-atleta`,
// `conversa-diretoria`): ler a intenção do texto livre, devolver a fala e os
// efeitos, e expor sugestões clicáveis para quem não quer digitar. Manter a
// forma importa — três motores com três formatos diferentes envelheceriam em
// três velocidades.
//
// ⚠️ O QUE MUDA AQUI: o empresário NÃO é o atleta e NÃO é a diretoria.
//
//  • O atleta fala de sentimento (moral, vaga, respeito). Rebaixá-lo ao banco
//    magoa.
//  • A diretoria fala de resultado e de cargo.
//  • O empresário fala de NEGÓCIO. Ele não se ofende, ele calcula. Não adianta
//    apelar para gratidão nem para o bem do clube: o que move é dinheiro,
//    minutagem e o próximo contrato do cliente dele. É por isso que "acolher",
//    que funciona com atleta, aqui soa a enrolação e PIORA a relação.
//
// A moeda desta conversa é o `desgaste` de `lib/pressao-do-agente` (0 cordial,
// 100 rompida, 70 = ruptura). Nada aqui inventa estado novo.

import { DESGASTE_DE_RUPTURA, salarioJusto, fatiaDeMinutos, type AtletaParaAgente, type TipoDePedido } from "@/lib/pressao-do-agente"

export type IntencaoComAgente =
  | "aceitar"      // "fechado", "topo o valor"
  | "recusar"      // "não tenho como", "está fora"
  | "contrapor"    // "consigo até X", "proponho outro valor"
  | "prometer"     // "ele vai jogar mais", "vamos renovar na janela"
  | "adiar"        // "conversamos depois da janela"
  | "pressionar"   // "o contrato é meu, ele cumpre"
  | "vender"       // "se não serve, aceito proposta por ele"
  | "perguntar"    // "o que ele quer, afinal?"

export interface EstadoDoAgente {
  /** Nome do empresário. */
  nome: string
  /** Perfil de negociação — muda o tom e a paciência. */
  perfil: PerfilDoAgente
  /** 0 cordial … 100 rompida. */
  desgaste: number
  pedidosRecusados: number
  /** O pedido em cima da mesa, quando há um. */
  pedido?: { tipo: TipoDePedido; salarioPedido?: number; anosPedidos?: number }
  atleta: AtletaParaAgente
  /** Caixa do clube — o empresário sabe ler balanço. */
  caixaDoClube: number
}

/** Três perfis, porque um só deixaria toda negociação igual. */
export type PerfilDoAgente = "duro" | "razoavel" | "conciliador"

export interface DesfechoDoAgente {
  resposta: string
  /** Variação no desgaste (+ piora, − melhora). */
  desgasteDelta: number
  /** O clube fechou o pedido como estava. */
  acordoFechado?: boolean
  /** Contraproposta aceita — o valor que ficou combinado. */
  valorAcordado?: number
  /** O agente vai oferecer o atleta no mercado. */
  vaiOferecerNoMercado?: boolean
  /** Promessa registrada: minutagem cobrada nas próximas semanas. */
  registraPromessaDeMinutos?: boolean
  encerra?: boolean
}

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

// ── LEITURA DA INTENÇÃO ──────────────────────────────────────────────────────
//
// Mesma mecânica dos outros dois motores: pontuar por palavra e ficar com o
// maior. A ORDEM resolve empate, e as falas de consequência pesada
// (aceitar/vender) exigem palavra específica — quem escreve solto cai em
// `perguntar`, que é inofensivo.

const PALAVRAS: Record<IntencaoComAgente, string[]> = {
  aceitar:    ["aceito", "fechado", "topo", "combinado", "pode ser", "de acordo", "aprovado", "feito"],
  recusar:    ["nao tenho", "nao da", "recuso", "fora de cogitacao", "impossivel", "nao posso", "negativo", "sem chance"],
  contrapor:  ["consigo", "ofereco", "proponho", "contraproposta", "meio termo", "no maximo", "ate ", "que tal"],
  prometer:   ["vai jogar", "vou escalar", "mais minutos", "titular", "prometo", "garanto", "renovamos", "na janela"],
  adiar:      ["depois", "mais para frente", "fim da temporada", "proxima janela", "adiar", "agora nao", "aguarde"],
  pressionar: ["contrato", "cumpre", "tem contrato", "nao vou ceder", "ele fica", "manda quem", "multa"],
  vender:     ["vendo", "aceito proposta", "pode negociar", "esta na lista", "libero", "pode sair", "vender"],
  perguntar:  ["o que", "quanto", "quanto ele", "qual", "por que", "como assim", "explique", "me diga"],
}

const ORDEM: IntencaoComAgente[] = [
  "aceitar", "vender", "contrapor", "prometer", "recusar", "adiar", "pressionar", "perguntar",
]

function pontos(t: string, palavras: string[]): number {
  return palavras.reduce((n, p) => (t.includes(p) ? n + 1 : n), 0)
}

export function intencaoDoTextoComAgente(texto: string): IntencaoComAgente | null {
  const t = semAcento(texto)
  // "NÃO aceito" não é aceitar; "não vou vender" não é vender.
  const negado = /\b(nao|jamais|nunca)\b[^.!?]{0,20}(aceito|topo|vendo|libero|fechado)/.test(t)
  let melhor: { id: IntencaoComAgente; n: number } | null = null
  for (const id of ORDEM) {
    if ((id === "aceitar" || id === "vender") && negado) continue
    const n = pontos(t, PALAVRAS[id])
    if (n > 0 && (!melhor || n > melhor.n)) melhor = { id, n }
  }
  return melhor?.id ?? null
}

/**
 * Valor numérico dito na frase ("consigo 120 mil", "até 1,2 mi", "1.200.000").
 *
 * ⚠️ Duas armadilhas que me pegaram ao escrever isto:
 *
 *  1. A alternância precisa vir da MAIS LONGA para a mais curta. Com
 *     `(mi|mil)`, o regex casa "mi" dentro de "mil" e "120 mil" vira 120
 *     milhões — erro de mil vezes, silencioso, direto no salário.
 *  2. Ponto é separador de MILHAR em pt-BR ("1.200") mas decimal em "1.2 mi".
 *     Apagar todo ponto quebra o segundo caso. A regra aqui: só é milhar quando
 *     vem seguido de exatamente três dígitos.
 */
export function valorDoTexto(texto: string): number | null {
  const t = semAcento(texto)
  const m = t.match(/(\d[\d.,]*)\s*(milhoes|milhao|milh|mil|mi|k)?/)
  if (!m) return null
  const bruto = m[1]
    .replace(/\.(?=\d{3}(\D|$))/g, "")  // 1.200.000 -> 1200000
    .replace(",", ".")                    // 1,2 -> 1.2
  const n = Number(bruto)
  if (!Number.isFinite(n) || n <= 0) return null
  const u = m[2] ?? ""
  if (u === "mil" || u === "k") return Math.round(n * 1_000)
  if (u.startsWith("mi")) return Math.round(n * 1_000_000)
  return Math.round(n)
}

export const PEDIDO_DE_CLAREZA_AGENTE =
  "Vamos ser objetivos, treinador. O senhor topa o que eu pedi, faz uma contraproposta, " +
  "ou prefere que eu leve o rapaz para outro lugar?"

// ── ABERTURA ─────────────────────────────────────────────────────────────────

const TRATAMENTO: Record<PerfilDoAgente, string> = {
  duro: "Treinador",
  razoavel: "Professor",
  conciliador: "Meu caro professor",
}

export function aberturaDoAgente(e: EstadoDoAgente): string {
  const t = TRATAMENTO[e.perfil]
  const a = e.atleta
  if (e.desgaste >= DESGASTE_DE_RUPTURA) {
    return `${t}, eu já vim aqui vezes demais. Do jeito que está, meu trabalho é achar outro clube para o ` +
      `${a.nome} — e é o que eu vou fazer, a menos que o senhor me dê um motivo concreto para não fazer.`
  }
  if (!e.pedido) {
    return `${t}, passando para falar do ${a.nome}. Ele está ${a.titular ? "jogando" : "no banco"} e o contrato ` +
      `dele tem ${a.semanasDeContrato} semanas. Queria entender o que o clube pensa para ele.`
  }
  if (e.pedido.tipo === "salario") {
    return `${t}, o ${a.nome} está entregando e recebendo abaixo do mercado. Eu preciso de um reajuste — ` +
      `${formatar(e.pedido.salarioPedido ?? 0)} por mês resolve.`
  }
  if (e.pedido.tipo === "minutagem") {
    const fatia = fatiaDeMinutos(a)
    return `${t}, o ${a.nome} jogou ${fatia === null ? "quase nada" : `${Math.round(fatia * 100)}% dos minutos`} ` +
      `nesta temporada. Ele não veio para cá para assistir. Ou ele joga, ou eu vou ter que buscar alternativa.`
  }
  return `${t}, o contrato do ${a.nome} acaba em ${a.semanasDeContrato} semanas. Se o clube quer segurá-lo, ` +
    `é agora — daqui a pouco ele conversa com quem quiser, de graça.`
}

const formatar = (n: number) =>
  `R$ ${Math.round(n).toLocaleString("pt-BR")}`

export const SUGESTOES_AGENTE: { id: IntencaoComAgente; rotulo: string; frase: string }[] = [
  { id: "aceitar", rotulo: "Aceitar o pedido", frase: "Fechado, aceito o que você pediu." },
  { id: "contrapor", rotulo: "Contrapropor", frase: "Não consigo esse valor. Proponho um meio termo." },
  { id: "prometer", rotulo: "Prometer minutos", frase: "Ele vai jogar mais, prometo. Me dê tempo." },
  { id: "recusar", rotulo: "Recusar", frase: "Não tenho como atender esse pedido agora." },
  { id: "pressionar", rotulo: "Bater no contrato", frase: "Ele tem contrato e vai cumprir." },
  { id: "vender", rotulo: "Liberar a saída", frase: "Se não serve assim, aceito proposta por ele." },
  { id: "perguntar", rotulo: "Perguntar o que ele quer", frase: "O que exatamente ele quer?" },
]

// ── DESFECHO ─────────────────────────────────────────────────────────────────
//
// A regra que dá peso: **o empresário sabe o valor de mercado do cliente dele**.
// Recusar pedido JUSTO de atleta bom custa caro; recusar pedido inflado de
// reserva quase não custa. É o que impede o jogador de aprender a dizer "não"
// para tudo sem consequência — e também o que impede o agente de virar chantagem
// impossível de recusar.

/** Tolerância do perfil a um "não": quanto ele releva antes de esquentar. */
const TOLERANCIA: Record<PerfilDoAgente, number> = { duro: 0.6, razoavel: 1, conciliador: 1.4 }

export function responderAgente(
  intencao: IntencaoComAgente,
  e: EstadoDoAgente,
  valorOferecido?: number,
): DesfechoDoAgente {
  const a = e.atleta
  const t = TRATAMENTO[e.perfil]
  const tol = TOLERANCIA[e.perfil]
  const justo = salarioJusto(a)
  const pedido = e.pedido?.salarioPedido ?? justo
  /** Pedido acima do justo é ganância; abaixo ou igual é legítimo. */
  const exagero = justo > 0 ? Math.max(0, pedido / justo - 1) : 0
  const legitimo = exagero <= 0.15
  const rompido = e.desgaste >= DESGASTE_DE_RUPTURA

  switch (intencao) {
    case "aceitar": {
      const custa = pedido > e.caixaDoClube / 12
      return {
        resposta: custa
          ? `${t}, agradeço. Sei que não é pouco para o momento do clube — o rapaz vai retribuir em campo.`
          : `Assim se faz negócio, ${t.toLowerCase()}. Pode contar comigo daqui para frente.`,
        desgasteDelta: -30,
        acordoFechado: true,
        valorAcordado: pedido,
        encerra: true,
      }
    }

    case "contrapor": {
      const oferta = valorOferecido ?? Math.round(pedido * 0.85)
      const fracao = pedido > 0 ? oferta / pedido : 1
      // Quanto mais perto do pedido, mais fácil aceitar; perfil duro exige mais.
      const piso = e.perfil === "duro" ? 0.92 : e.perfil === "razoavel" ? 0.85 : 0.78
      if (fracao >= piso) {
        return {
          resposta: `${formatar(oferta)}… não é o que eu queria, mas dá para trabalhar. Fechado, ${t.toLowerCase()}.`,
          desgasteDelta: -18,
          acordoFechado: true,
          valorAcordado: oferta,
          encerra: true,
        }
      }
      if (fracao >= piso - 0.15) {
        return {
          resposta: `Está longe ainda. Chegue mais perto e a gente assina hoje — ${formatar(Math.round(pedido * piso))} ` +
            `eu levo para ele agora mesmo.`,
          desgasteDelta: Math.round(4 * tol),
        }
      }
      return {
        resposta: `${t}, com todo o respeito, isso é menos do que ele ganha hoje em qualquer conversa lá fora. ` +
          `Não vou levar essa proposta para ele.`,
        desgasteDelta: Math.round(12 * tol),
      }
    }

    case "recusar": {
      // O peso do "não" depende de o pedido ser justo E de o atleta valer.
      const peso = (legitimo ? 18 : 7) * (a.overall >= 75 ? 1.3 : 1) * tol
      if (rompido) {
        return {
          resposta: `Então está encerrado. Vou colocar o ${a.nome} na roda — alguém vai querer.`,
          desgasteDelta: Math.round(peso),
          vaiOferecerNoMercado: true,
          encerra: true,
        }
      }
      return {
        resposta: legitimo
          ? `${t}, eu vim com um número honesto. Se o clube não pode, tudo bem — mas não me cobre lealdade depois.`
          : `Eu esperava mais abertura. Vamos deixar assim por ora, mas essa conversa não acabou.`,
        desgasteDelta: Math.round(peso),
      }
    }

    case "prometer": {
      // Promessa só vale se ele NÃO estiver jogando; prometer minutos a titular
      // é conversa vazia, e o agente percebe.
      const fatia = fatiaDeMinutos(a) ?? 0
      if (a.titular && fatia > 0.6) {
        return {
          resposta: `Ele já joga, ${t.toLowerCase()}. Meu assunto aqui é outro — e o senhor sabe qual é.`,
          desgasteDelta: Math.round(6 * tol),
        }
      }
      if (e.pedidosRecusados >= 2) {
        return {
          resposta: `O senhor já me prometeu antes. Palavra eu aceito uma vez; agora eu quero ver a escalação.`,
          desgasteDelta: Math.round(8 * tol),
        }
      }
      return {
        resposta: `Tudo bem. Eu seguro o rapaz e o senhor bota ele em campo. Volto a falar com o senhor em breve.`,
        desgasteDelta: -12,
        registraPromessaDeMinutos: true,
      }
    }

    case "adiar": {
      return {
        resposta: e.pedidosRecusados >= 1
          ? `Sempre depois. Da próxima vez eu venho com uma proposta de fora na mão, ${t.toLowerCase()}.`
          : `Eu espero. Mas não espere demais: quem tem contrato curto conversa com todo mundo.`,
        desgasteDelta: Math.round((e.pedidosRecusados >= 1 ? 12 : 6) * tol),
      }
    }

    case "pressionar": {
      // O contrato é argumento real — mas curto ele vira fraqueza, e o agente sabe.
      const curto = a.semanasDeContrato <= 26
      return {
        resposta: curto
          ? `Contrato de ${a.semanasDeContrato} semanas, ${t.toLowerCase()}. Daqui a pouco ele assina onde quiser ` +
            `e o clube não vê um centavo. Pense bem em quem está com a faca.`
          : `Tem contrato, tem. E vai cumprir. Mas quem joga contrariado rende menos — o senhor sabe disso melhor que eu.`,
        desgasteDelta: Math.round((curto ? 16 : 9) * tol),
      }
    }

    case "vender": {
      return {
        resposta: `Se é assim que o clube vê, eu trabalho com isso. Vou buscar um destino para o ${a.nome}.`,
        // Não é ruptura: é acordo. O desgaste até cai — os dois queriam saída.
        desgasteDelta: -8,
        vaiOferecerNoMercado: true,
        encerra: true,
      }
    }

    case "perguntar": {
      const fatia = fatiaDeMinutos(a)
      const detalhe = e.pedido?.tipo === "salario"
        ? `Ele quer ${formatar(pedido)} por mês. O justo pelo que ele entrega é ${formatar(justo)} — ` +
          `eu pedi ${exagero > 0.15 ? "acima disso, é verdade" : "dentro disso"}.`
        : e.pedido?.tipo === "minutagem"
          ? `Ele quer jogar. Jogou ${fatia === null ? "quase nada" : `${Math.round(fatia * 100)}%`} dos minutos, ` +
            `e nessa idade ${a.idade < 24 ? "parar é perder carreira" : "ficar no banco é encerrar carreira"}.`
          : `Ele quer segurança: contrato novo antes de ficar livre.`
      return {
        resposta: `${detalhe} Agora o senhor sabe. O que o clube faz com isso é decisão sua.`,
        // Perguntar não custa nada e ainda mostra respeito pela conversa.
        desgasteDelta: -3,
      }
    }
  }
}

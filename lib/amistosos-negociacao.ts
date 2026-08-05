// AMISTOSO SE NEGOCIA — o clube do outro lado decide, e cobra.
//
// Até aqui marcar um amistoso era clicar num nome de uma lista: o Real Madrid
// aceitava vir jogar contra um clube da Série D, de graça, na semana que você
// escolhesse. Não havia do outro lado nenhum clube — havia uma lista.
//
// Na vida real um amistoso é um CONTRATO. O clube convidado cobra CACHÊ DE
// PRESENÇA (é a receita dele na data), pesa a viagem, olha o próprio calendário
// e, muitas vezes, simplesmente não tem interesse: enfrentar um clube muito
// menor não rende bilheteria, não rende imagem e ainda arrisca lesão.
//
// Este módulo é PURO: recebe o retrato dos dois clubes e devolve a decisão e o
// dinheiro. Quem grava (e quem cobra do caixa) é a tela.
//
// ⚠️ A DECISÃO É DETERMINÍSTICA por (clubes + semana + temporada). Sem isso,
// recusar viraria um botão de re-rolar: bastava clicar de novo até o "sim". É a
// mesma razão pela qual a recusa no mercado abre carência e o leilão fixa a
// semana.

import type { Team } from "@/lib/teams-data"

/** O que o técnico paga e o que ele recebe por um amistoso. */
export interface ContaDoAmistoso {
  /** Cachê de presença pago ao clube convidado. Sempre >= 0. */
  cache: number
  /** Bilheteria estimada — só existe com mando de campo. */
  bilheteria: number
  /** `bilheteria - cache`. Negativo é o normal ao convidar clube grande. */
  saldo: number
}

export type MotivoDaRecusa =
  | "calendario"
  | "sem_interesse"
  | "viagem"

export interface RespostaAoConvite {
  aceita: boolean
  motivo?: MotivoDaRecusa
  /** Frase pronta para a tela, na voz do clube convidado. */
  recado: string
  conta: ContaDoAmistoso
}

export interface ConviteDeAmistoso {
  clube: Team
  adversario: Team
  /** Semana da temporada em que o jogo aconteceria. */
  semana: number
  temporada: number
  /** O clube do usuário joga em casa? */
  emCasa: boolean
  /** Semana de pausa FIFA — quando os amistosos de verdade acontecem. */
  dataFifa?: boolean
}

// ─── Dinheiro ────────────────────────────────────────────────────────────────

/**
 * Cachê de presença pelo prestígio do convidado.
 *
 * Exponencial, e não linear, porque é assim que o mercado de amistosos se
 * comporta: a diferença entre um clube de prestígio 50 e um de 60 é pequena; a
 * diferença entre 78 e 88 é o que separa um amistoso regional de uma excursão
 * internacional. Na escala do jogo isso vai de ~25 mil a ~4,6 milhões.
 */
export function cacheDePresenca(adversario: Team): number {
  const prestigio = Math.max(0, Math.min(100, adversario.prestigio ?? 50))
  const base = 25_000 * Math.pow(1.115, Math.max(0, prestigio - 40))
  // Torcida grande cobra mais: quem leva público cobra pelo público que leva.
  const porTorcida = 1 + Math.min(1.2, (adversario.torcida ?? 0) / 25_000_000)
  return Math.round(base * porTorcida)
}

/** Mesmo país < mesmo continente < intercontinental. */
export function fatorDeViagem(clube: Team, adversario: Team): number {
  const paisA = (clube.pais ?? "Brasil").toLowerCase()
  const paisB = (adversario.pais ?? "Brasil").toLowerCase()
  if (paisA === paisB) return 1
  const regA = clube.regiao ?? ""
  const regB = adversario.regiao ?? ""
  if (regA && regA === regB) return 1.35
  return 1.9
}

/**
 * Bilheteria estimada do mando de campo.
 *
 * Amistoso não lota estádio: o público sai da SUA torcida, limitado pela
 * capacidade, e cresce quando o visitante é atraente (é o que faz valer a pena
 * pagar caro por um adversário grande). Sem mando, não há bilheteria nenhuma —
 * quem recebe fica com ela.
 */
export function bilheteriaEstimada(clube: Team, adversario: Team): number {
  const capacidade = Math.max(0, clube.estadio_cap ?? 0)
  if (capacidade === 0) return 0
  // ⚠️ QUEM ENCHE O ESTADIO NUM AMISTOSO E O VISITANTE. Derivar o publico so da
  // torcida do mandante (`torcida * 0.004`) dava 1.200 pessoas para um clube de
  // 300 mil torcedores — receber o Flamengo rendia 188 mil, o que tornava o
  // amistoso um negocio sem sentido em qualquer cenario.
  const atracao = Math.max(0, Math.min(1, ((adversario.prestigio ?? 50) - 35) / 55))
  // A propria torcida sustenta a base de publico, saturando pela capacidade.
  const daTorcida = Math.max(0.08, Math.min(1, (clube.torcida ?? 0) / Math.max(1, capacidade * 40)))
  const ocupacao = Math.max(0.08, Math.min(0.98, 0.10 + 0.75 * atracao + 0.25 * daTorcida))
  const publico = Math.round(capacidade * ocupacao)
  // Ingresso de amistoso acompanha o tamanho do visitante.
  const ingresso = 30 + Math.max(0, (adversario.prestigio ?? 50) - 45) * 2.2
  return Math.round(publico * ingresso)
}

export function contaDoAmistoso(convite: ConviteDeAmistoso): ContaDoAmistoso {
  const { clube, adversario, emCasa } = convite
  // Fora de casa o convidado ganha a bilheteria dele, entao cobra menos de voce.
  const mando = emCasa ? 1 : 0.55
  const cache = Math.round(cacheDePresenca(adversario) * fatorDeViagem(clube, adversario) * mando)
  const bilheteria = emCasa ? bilheteriaEstimada(clube, adversario) : 0
  return { cache, bilheteria, saldo: bilheteria - cache }
}

// ─── Decisão ─────────────────────────────────────────────────────────────────

/** Semente estável: o mesmo convite devolve sempre a mesma resposta. */
function semente(convite: ConviteDeAmistoso): number {
  const txt = `${convite.clube.curto}|${convite.adversario.curto}|${convite.semana}|${convite.temporada}|${convite.emCasa ? "C" : "F"}`
  let h = 2166136261
  for (let i = 0; i < txt.length; i++) {
    h ^= txt.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1000) / 1000
}

/**
 * O clube convidado aceita?
 *
 * O peso maior é a DIFERENÇA DE PRESTÍGIO, e ela é assimétrica de propósito:
 * um clube muito maior não ganha nada em enfrentar um muito menor (não vende
 * ingresso, não ganha imagem, e ainda arrisca o elenco), enquanto o menor
 * adoraria. É por isso que, na vida real, quem convida o grande é quem paga.
 */
export function avaliarConvite(convite: ConviteDeAmistoso): RespostaAoConvite {
  const { clube, adversario, dataFifa } = convite
  const conta = contaDoAmistoso(convite)
  const meu = clube.prestigio ?? 50
  const dele = adversario.prestigio ?? 50
  const diferenca = dele - meu

  let interesse = 55

  // Quanto maior o convidado em relacao a voce, menos ele quer.
  interesse -= Math.max(0, diferenca) * 1.9
  // E um clube menor que voce topa com facilidade: e vitrine para ele.
  interesse += Math.max(0, -diferenca) * 0.9

  const viagem = fatorDeViagem(clube, adversario)
  if (viagem >= 1.9) interesse -= 22      // intercontinental
  else if (viagem > 1) interesse -= 8     // mesmo continente, outro pais

  // Data FIFA e a janela natural do amistoso: todo mundo esta livre.
  if (dataFifa) interesse += 18

  // Torcida grande do anfitriao compensa: da publico e visibilidade.
  if (convite.emCasa) interesse += Math.min(14, (clube.torcida ?? 0) / 1_500_000)

  const sorte = semente(convite)
  interesse += (sorte - 0.5) * 24

  if (interesse >= 0) {
    return {
      aceita: true,
      recado: `${adversario.nome} aceitou o amistoso.`,
      conta,
    }
  }

  // A RECUSA DIZ O MOTIVO. "Não foi possível" não ensina nada a quem joga;
  // saber que faltou prestígio (ou que a viagem é longa demais) muda a próxima
  // escolha do técnico.
  if (viagem >= 1.9 && interesse > -28) {
    return {
      aceita: false,
      motivo: "viagem",
      recado: `${adversario.nome} recusou: a viagem não se paga por um amistoso nesta data.`,
      conta,
    }
  }
  if (diferenca >= 12) {
    return {
      aceita: false,
      motivo: "sem_interesse",
      recado: `${adversario.nome} recusou: não há interesse esportivo nem comercial no confronto.`,
      conta,
    }
  }
  return {
    aceita: false,
    motivo: "calendario",
    recado: `${adversario.nome} recusou: o calendário do clube não abre nesta semana.`,
    conta,
  }
}

/**
 * Rótulo curto do quanto o convite é viável, para a tela mostrar ANTES do
 * clique. Sem isto o técnico só descobre o preço depois de tentar.
 */
export function chanceDoConvite(convite: ConviteDeAmistoso): "provavel" | "incerto" | "dificil" {
  const diferenca = (convite.adversario.prestigio ?? 50) - (convite.clube.prestigio ?? 50)
  if (diferenca >= 12) return "dificil"
  if (diferenca >= 4 || fatorDeViagem(convite.clube, convite.adversario) >= 1.9) return "incerto"
  return "provavel"
}

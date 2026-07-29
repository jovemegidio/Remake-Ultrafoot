"use client"

// APLICAÇÃO DE PUNIÇÃO AO ATLETA — o lado "porrete" do vestiário.
//
// O catálogo já existia em lib/game-engine (DISCIPLINE_PUNISHMENTS, com multa de
// 10%/30%, banco, afastamento e rescisão) e o save já guardava `disciplineIssues`
// — mas NADA aplicava a punição. Era mais um sistema declarado e desligado.
//
// O que faltava, e está aqui: converter a punição escolhida em três efeitos que
// o jogo já sabe consumir (dinheiro, moral individual, respeito ao técnico) e
// devolver a RESPOSTA do atleta. A resposta é o ponto: uma multa sem reação é só
// um débito, não uma decisão. No Brasfoot o jogador rebate ("Você acha que é
// quem cara? Eu nem tive culpa"), e é isso que faz a punição ter peso.

import { DISCIPLINE_PUNISHMENTS, type DisciplinePunishment } from "@/lib/game-engine"

export interface EfeitoPunicao {
  /** Valor descontado do salário semanal do atleta (0 quando a punição não é financeira). */
  valorMulta: number
  /** Variação da moral individual (negativa). */
  moral: number
  /** Variação do respeito do elenco ao técnico. Punir dá autoridade — até certo ponto. */
  respeito: number
  /** O que o atleta responde. Vazio quando aceita calado. */
  resposta: string
  /** true quando o atleta ficou revoltado: a punição saiu pela culatra. */
  revoltado: boolean
}

/**
 * Respostas do atleta. A escolha depende de ele achar a punição JUSTA, que por
 * sua vez depende da gravidade real da infração contra o peso da punição.
 */
const ACEITA = [
  "Reconheço o erro. Não vai se repetir.",
  "Tudo certo, professor. Errei e assumo.",
  "Justo. Vou trabalhar para recuperar a confiança.",
]
const RECLAMA = [
  "Não gostei de ter sido multado. Se continuar assim o clima aqui vai ficar ruim.",
  "Achei pesado demais para o que aconteceu.",
  "Vou cumprir, mas discordo da decisão.",
]
const REVOLTA = [
  "Não pode ficar me multando. Quando o time perde, a diretoria multa você?",
  "Eu nem tive culpa e você desconta do meu salário? Assim fica complicado jogar aqui.",
  "Isso é perseguição. Vou conversar com meu empresário.",
]

/** Quanto "peso" cada punição tem, para comparar com a gravidade da infração. */
const PESO: Record<DisciplinePunishment, number> = {
  advertencia: 1,
  multa_leve: 2,
  multa_pesada: 3,
  banco_1_jogo: 2,
  banco_3_jogos: 3,
  afastamento_treinos: 4,
  rescisao_contrato: 5,
}

const PESO_GRAVIDADE = { leve: 1, moderada: 2, grave: 3 } as const

/**
 * Aplica a punição e devolve os efeitos.
 *
 * `salarioSemanal` entra para a multa sair em dinheiro de verdade, e não como
 * porcentagem abstrata que a tela teria de reinterpretar.
 */
export function aplicarPunicao(
  punicao: DisciplinePunishment,
  gravidade: "leve" | "moderada" | "grave",
  salarioSemanal: number,
  sorteio: number = Math.random(),
): EfeitoPunicao {
  const cfg = DISCIPLINE_PUNISHMENTS[punicao]
  const valorMulta = Math.round((salarioSemanal * cfg.finePercent) / 100)

  // Exagero = peso da punição acima da gravidade. É o que gera revolta.
  const exagero = PESO[punicao] - PESO_GRAVIDADE[gravidade]
  const chanceRevolta = exagero >= 2 ? 0.75 : exagero === 1 ? 0.35 : 0.08

  const revoltado = sorteio < chanceRevolta
  const aceitouBem = !revoltado && exagero <= 0

  const lista = revoltado ? REVOLTA : aceitouBem ? ACEITA : RECLAMA
  const resposta = lista[Math.floor(sorteio * lista.length) % lista.length]

  // Punição exagerada perde autoridade em vez de ganhar: o elenco vê injustiça.
  const respeito = revoltado ? Math.round(cfg.respectChange * -0.5) : cfg.respectChange
  const moral = revoltado ? Math.round(cfg.moraleImpact * 1.5) : cfg.moraleImpact

  return { valorMulta, moral, respeito, resposta, revoltado }
}

/** Punições oferecidas para uma infração, da mais branda à mais dura. */
export function punicoesSugeridas(gravidade: "leve" | "moderada" | "grave"): DisciplinePunishment[] {
  if (gravidade === "leve") return ["advertencia", "multa_leve", "banco_1_jogo"]
  if (gravidade === "moderada") return ["advertencia", "multa_leve", "multa_pesada", "banco_1_jogo", "banco_3_jogos"]
  return ["multa_pesada", "banco_3_jogos", "afastamento_treinos", "rescisao_contrato"]
}

/** Rótulo pronto para a tela, com o valor já em dinheiro. */
export function rotuloPunicao(punicao: DisciplinePunishment, salarioSemanal: number): string {
  const cfg = DISCIPLINE_PUNISHMENTS[punicao]
  if (cfg.finePercent === 0) return cfg.label
  const valor = Math.round((salarioSemanal * cfg.finePercent) / 100)
  return `${cfg.label} — R$ ${valor.toLocaleString("pt-BR")}`
}

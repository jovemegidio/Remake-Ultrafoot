"use client"

/**
 * Apresentação de salário conforme a escolha da criação de carreira.
 *
 * O jogador escolhe "mensal" ou "semanal" nas configurações iniciais (1.0.283).
 * Antes disto a escolha era gravada no save e NENHUMA tela a consultava: os
 * valores saíam sempre semanais, independentemente do que tivesse sido marcado.
 *
 * O dado no save continua semanal — só a exibição muda. Trocar a unidade
 * armazenada quebraria contratos, teto salarial e saves antigos de uma vez.
 */
import { useMemo } from "react"
import { useGameState } from "@/lib/save-system"
import { formatCurrency } from "@/lib/currency"
import {
  normalizarConfiguracoes283, salarioPorPeriodo283, sufixoSalario283,
  type SistemaForca283, type SistemaSalarios283,
} from "@/lib/configuracoes-iniciais-283"

export interface FormatadorDeSalario {
  sistema: SistemaSalarios283
  /** Valor no período escolhido, sem formatação. */
  valor: (salarioSemanal: number) => number
  /** "R$ 120.000/sem" ou "R$ 480.000/mês". */
  formatar: (salarioSemanal: number) => string
  /** Só o sufixo, para quem já formata o número por conta própria. */
  sufixo: string
}

export function useSalario(): FormatadorDeSalario {
  const { state } = useGameState()
  const sistema = normalizarConfiguracoes283(state.configuracoesIniciais283).sistemaSalarios
  return useMemo(() => ({
    sistema,
    valor: (semanal: number) => salarioPorPeriodo283(semanal, sistema),
    formatar: (semanal: number) => `${formatCurrency(salarioPorPeriodo283(semanal, sistema))}${sufixoSalario283(sistema)}`,
    sufixo: sufixoSalario283(sistema),
  }), [sistema])
}

/**
 * Sistema de força escolhido na criação da carreira.
 *
 * "individual" mostra os atributos detalhados; "classico" mostra só a nota
 * geral, como no futebol de gerência antigo. É escolha de APRESENTAÇÃO: o motor
 * usa os atributos nos dois casos, então trocar o modo não altera resultado
 * nenhum — só o que a ficha do atleta exibe.
 */
export function useSistemaForca(): SistemaForca283 {
  const { state } = useGameState()
  return normalizarConfiguracoes283(state.configuracoesIniciais283).sistemaForca
}

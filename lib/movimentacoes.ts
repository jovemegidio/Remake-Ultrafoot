"use client"

// EXTRATO DE MOVIMENTAÇÕES DO ELENCO — o que o técnico fez, gravado no save.
//
// ⚠️ POR QUE ISTO EXISTE (pedido: "ao salvar deve salvar tudo — transferências,
// contratações, rescisões de contrato, empréstimo entre outros, elenco, todas as
// movimentações feitas pelo jogador").
//
// O save JÁ guardava o elenco e o caixa (o motor inteiro é persistido), mas o
// HISTÓRICO do que aconteceu era um recorte: só três telas escreviam em
// `state.transfers` — a compra pelo mercado, a venda de jovem da base e o motor
// de transferências. Rescindir, renovar, emprestar, devolver empréstimo, perder
// atleta por fim de contrato, promover da base e aposentar não deixavam rastro
// nenhum. Ao reabrir o save, essas decisões simplesmente não tinham acontecido.
//
// DUAS DECISÕES QUE IMPORTAM:
//
// 1. A gravação é por `commitGameState`, NÃO pelo `setState` do React. Quase toda
//    movimentação vem acompanhada de navegação ou de fechamento de modal, e o
//    `setState` descarta a atualização pendente quando o componente desmonta
//    antes de o React processar a fila (ver o comentário de `commitGameState` em
//    lib/save-system.ts). Era exatamente assim que uma rescisão "sumia".
//
// 2. Isto NÃO é a fonte da verdade do elenco — quem manda continua sendo o motor
//    (`squadPlayers`). Aqui fica o extrato: o que aconteceu, quando e por quanto.
//    Duas fontes para "quem está no elenco" seria a receita de divergência que o
//    resto do jogo já pagou caro.

import { commitGameState } from "@/lib/save-system"
import type { TransferRecord, TransferRecordType } from "@/lib/career-types"

/** Quantas movimentações o save guarda. Uma carreira longa não pode inchar o arquivo. */
const LIMITE = 400

export interface NovaMovimentacao {
  playerName: string
  type: TransferRecordType
  /** Valor em caixa do negócio (0 quando não houve dinheiro). */
  value?: number
  fromTeam?: string
  toTeam?: string
  detalhe?: string
  week?: number
  season?: number
}

/**
 * Grava uma movimentação no save da carreira.
 *
 * Nunca lança: um extrato que derruba a venda seria pior do que extrato nenhum.
 * Fora do browser (SSR/scripts) é um no-op.
 */
export function registrarMovimentacao(mov: NovaMovimentacao): void {
  if (typeof window === "undefined") return
  try {
    commitGameState(atual => {
      const registro: TransferRecord = {
        id: `mov_${Date.now()}_${Math.round(Math.random() * 1e6)}`,
        playerName: mov.playerName,
        fromTeam: mov.fromTeam ?? "",
        toTeam: mov.toTeam ?? "",
        value: Math.round(mov.value ?? 0),
        type: mov.type,
        week: mov.week ?? atual.week ?? 0,
        season: mov.season ?? atual.season ?? 2026,
        detalhe: mov.detalhe,
        em: Date.now(),
      }
      // O extrato guarda os MAIS RECENTES: cortar pelo fim descartaria a
      // movimentação que acabou de acontecer numa carreira longa.
      const lista = [...(atual.transfers ?? []), registro]
      return { transfers: lista.length > LIMITE ? lista.slice(-LIMITE) : lista }
    })
  } catch {
    /* o extrato é registro, nunca pode derrubar a ação que o gerou */
  }
}

/** Rótulo em português de cada tipo — usado pela tela de movimentações. */
export const ROTULO_DA_MOVIMENTACAO: Record<TransferRecordType, string> = {
  buy: "Contratação",
  sell: "Venda",
  loan: "Empréstimo (chegada)",
  loan_out: "Empréstimo (saída)",
  loan_return: "Fim de empréstimo",
  loan_buy: "Opção de compra",
  auction: "Leilão",
  release: "Rescisão / fim de contrato",
  renew: "Renovação",
  promote: "Promoção da base",
  retire: "Aposentadoria",
}

/** Movimentações de uma temporada, da mais recente para a mais antiga. */
export function movimentacoesDaTemporada(
  transfers: readonly TransferRecord[] | undefined,
  season: number,
): TransferRecord[] {
  return [...(transfers ?? [])]
    .filter(t => t.season === season)
    .sort((a, b) => (b.em ?? 0) - (a.em ?? 0) || b.week - a.week)
}

import { safeLocalSet } from "@/lib/safe-storage"
// Carencia depois de uma proposta RECUSADA.
//
// Sem isso, recusar nao custava nada: bastava reabrir o modal e propor de novo no
// mesmo dia ate a sorte virar.
//
// Sao DOIS motivos, com pesos diferentes (pedido 30/07/2026):
//
//   • JOGADOR recusou o projeto — 30 dias. E uma decisao pessoal: ele nao muda de
//     ideia porque voce voltou com mais dinheiro na mesma semana.
//   • CLUBE recusou a compra ou o emprestimo — 21 dias. A porta nao fecha para
//     sempre (ali e negocio), mas tambem nao reabre no mesmo dia: um "nao" da
//     diretoria adversaria vale por um tempo, e insistir na hora nao existe.
//
// Antes so a recusa do JOGADOR gerava carencia; a do clube nao gerava nada, e o
// mercado virava um botao de tentar de novo ate passar.

/** Dias de carencia por motivo da recusa. */
export const CARENCIA_POR_MOTIVO = { jogador: 30, clube: 21 } as const

export type MotivoDaRecusa = keyof typeof CARENCIA_POR_MOTIVO

const KEY = (playerId: number | string) => `ultrafoot:transfer-reject:${playerId}`

const MS_PER_DAY = 86_400_000

interface RegistroDeRecusa {
  data: string
  motivo: MotivoDaRecusa
}

/**
 * Le o registro aceitando o FORMATO ANTIGO (uma data ISO solta), que e o que os
 * saves anteriores gravaram. Sem isto, quem ja tinha carencia em curso a perderia
 * na primeira atualizacao.
 */
function lerRegistro(playerId: number | string): RegistroDeRecusa | null {
  let stored: string | null
  try {
    stored = localStorage.getItem(KEY(playerId))
  } catch {
    return null
  }
  if (!stored) return null
  if (stored.startsWith("{")) {
    try {
      const parsed = JSON.parse(stored) as Partial<RegistroDeRecusa>
      if (parsed.data) return { data: parsed.data, motivo: parsed.motivo === "clube" ? "clube" : "jogador" }
    } catch {
      return null
    }
    return null
  }
  return { data: stored, motivo: "jogador" }
}

function limpar(playerId: number | string): void {
  try {
    localStorage.removeItem(KEY(playerId))
  } catch {
    /* ignore */
  }
}

/** Registra a recusa na data ATUAL do jogo (nao a data real). */
export function markRejection(
  playerId: number | string,
  gameDate: Date,
  motivo: MotivoDaRecusa,
): void {
  try {
    safeLocalSet(KEY(playerId), JSON.stringify({ data: gameDate.toISOString(), motivo }))
  } catch {
    /* ignore */
  }
}

/** Compatibilidade: recusa do jogador, o unico caso que existia antes. */
export function markPlayerRejection(playerId: number | string, gameDate: Date): void {
  markRejection(playerId, gameDate, "jogador")
}

/**
 * Carencia em aberto.
 * @returns `null` quando pode negociar; caso contrario, dias restantes e motivo.
 */
export function getRejectionCooldown(
  playerId: number | string,
  gameDate: Date,
): { dias: number; motivo: MotivoDaRecusa } | null {
  const registro = lerRegistro(playerId)
  if (!registro) return null

  const rejectedAt = new Date(registro.data)
  if (Number.isNaN(rejectedAt.getTime())) return null

  const elapsedDays = Math.floor((gameDate.getTime() - rejectedAt.getTime()) / MS_PER_DAY)
  const dias = CARENCIA_POR_MOTIVO[registro.motivo] - elapsedDays

  // Carencia vencida: limpa o registro para nao acumular lixo no storage.
  if (dias <= 0) {
    limpar(playerId)
    return null
  }
  return { dias, motivo: registro.motivo }
}

/** Dias que ainda faltam para poder propor de novo (0 = liberado). */
export function getRejectionCooldownDays(
  playerId: number | string,
  gameDate: Date,
): number {
  return getRejectionCooldown(playerId, gameDate)?.dias ?? 0
}

export function isPlayerOnCooldown(playerId: number | string, gameDate: Date): boolean {
  return getRejectionCooldownDays(playerId, gameDate) > 0
}

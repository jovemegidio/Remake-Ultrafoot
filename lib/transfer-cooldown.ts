import { safeLocalSet } from "@/lib/safe-storage"
// Carencia apos o jogador recusar uma proposta.
//
// Sem isso, recusar nao custava nada: bastava reabrir o modal e propor de novo no
// mesmo dia ate a sorte virar. A recusa vira uma decisao com consequencia — o atleta
// so volta a ouvir o clube depois de 30 dias.

const COOLDOWN_DAYS = 30
const KEY = (playerId: number | string) => `ultrafoot:transfer-reject:${playerId}`

const MS_PER_DAY = 86_400_000

/** Registra a recusa do jogador na data ATUAL do jogo (nao a data real). */
export function markPlayerRejection(playerId: number | string, gameDate: Date): void {
  try {
    safeLocalSet(KEY(playerId), gameDate.toISOString())
  } catch {
    /* ignore */
  }
}

/**
 * Dias que ainda faltam para poder propor de novo.
 * @returns 0 quando nao ha carencia (pode negociar).
 */
export function getRejectionCooldownDays(
  playerId: number | string,
  gameDate: Date,
): number {
  let stored: string | null = null
  try {
    stored = localStorage.getItem(KEY(playerId))
  } catch {
    return 0
  }
  if (!stored) return 0

  const rejectedAt = new Date(stored)
  if (Number.isNaN(rejectedAt.getTime())) return 0

  const elapsedDays = Math.floor((gameDate.getTime() - rejectedAt.getTime()) / MS_PER_DAY)
  const left = COOLDOWN_DAYS - elapsedDays

  // Carencia vencida: limpa o registro para nao acumular lixo no storage.
  if (left <= 0) {
    try {
      localStorage.removeItem(KEY(playerId))
    } catch {
      /* ignore */
    }
    return 0
  }
  return left
}

export function isPlayerOnCooldown(playerId: number | string, gameDate: Date): boolean {
  return getRejectionCooldownDays(playerId, gameDate) > 0
}

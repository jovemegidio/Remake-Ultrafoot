"use client"

// VOLUME DOS EFEITOS SONOROS — a ponte entre o slider e o barramento de audio.
//
// O slider "Efeitos Sonoros" existia na tela de configuracoes desde sempre e
// nao fazia NADA: o valor morria num useState local, ninguem lia e ele voltava
// para 80% na proxima abertura. O ganho do barramento (hooks/use-match-sounds)
// era uma constante 0.9.
//
// Aqui o valor vira um evento, para o som mudar ENQUANTO se arrasta o slider —
// sem isto o jogador so ouviria o efeito da mudanca no proximo apito, o que
// torna impossivel calibrar de ouvido.

/** Evento com o volume 0-100 no `detail`. */
export const EVENTO_SFX = "ultrafoot:sfx-volume"

/** 0-100 → ganho 0..1 do barramento. 0.9 no topo era o valor fixo antigo. */
export function ganhoDoVolume(volume0a100: number): number {
  const v = Math.max(0, Math.min(100, Number(volume0a100) || 0))
  return (v / 100) * 0.9
}

export function anunciarSfx(volume0a100: number): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(EVENTO_SFX, { detail: volume0a100 }))
}

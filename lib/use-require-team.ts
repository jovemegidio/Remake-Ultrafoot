// Hook de guarda: garante que existe um time selecionado no save.
// Caso nao exista (usuario abriu uma rota interna sem ter iniciado um jogo),
// redireciona para a tela inicial (splash) onde ele escolhe o time.

"use client"

import { useEffect } from "react"
import { loadGameState } from "@/lib/save-system"
import { hardNavigate } from "@/lib/hard-navigation"

/**
 * Redireciona para "/splash" se nao houver time selecionado.
 * @param redirectTo - rota de destino quando nao ha time (padrao: "/splash").
 */
export function useRequireTeam(redirectTo = "/splash"): void {
  useEffect(() => {
    const state = loadGameState()
    if (!state || !state.selectedTeamShort) {
      hardNavigate(redirectTo)
    }
  }, [redirectTo])
}

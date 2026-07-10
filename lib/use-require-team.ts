// Hook de guarda: garante que existe um time selecionado no save.
// Caso nao exista (usuario abriu uma rota interna sem ter iniciado um jogo),
// redireciona para a tela inicial (splash) onde ele escolhe o time.

"use client"

import { useEffect } from "react"
import { loadGameState } from "@/lib/save-system"
import { initPersistentStore } from "@/lib/persistent-store"
import { hardNavigate } from "@/lib/hard-navigation"

/**
 * Redireciona para "/splash" se nao houver time selecionado.
 * @param redirectTo - rota de destino quando nao ha time (padrao: "/splash").
 */
export function useRequireTeam(redirectTo = "/splash"): void {
  useEffect(() => {
    let cancelled = false
    // Espera o persistent-store carregar do disco antes de decidir. O save chega de
    // forma async; sem esperar, o usuario seria expulso de toda tela do jogo para a
    // splash no primeiro render mesmo tendo um jogo em andamento.
    void initPersistentStore().then(() => {
      if (cancelled) return
      const state = loadGameState()
      if (!state || !state.selectedTeamShort) {
        hardNavigate(redirectTo)
      }
    })
    return () => { cancelled = true }
  }, [redirectTo])
}

"use client"

import { useEffect, useRef } from "react"
import { persistGameEngineNow, useGameEngine } from "@/lib/game-engine"
import { podeSalvarCarreira, saveGameStateAndFlush, useGameState } from "@/lib/save-system"
import { useNotifications } from "@/components/notifications-system"
import { getSavedCloudCode, uploadSave } from "@/lib/cloud-save"

/** Salva os dois estados da carreira após a quantidade configurada de partidas. */
export function GameAutosave() {
  const matchResults = useGameEngine(state => state.matchResults)
  const { state, hydrated } = useGameState()
  const { addNotification } = useNotifications()
  // Via REF, e fora das dependencias: a identidade de addNotification muda a
  // cada notificacao criada. Como dependencia, o proprio aviso de "jogo salvo"
  // reagendava o efeito que o criou — realimentacao que leva ao React #185
  // ("Maximum update depth exceeded") e derruba o app inteiro.
  const notificar = useRef(addNotification)
  notificar.current = addNotification
  const ready = useRef(false)
  const saving = useRef(false)
  const teamShort = state.selectedTeamShort
  const matchCount = teamShort
    ? matchResults.filter(result => result.homeTeam === teamShort || result.awayTeam === teamShort).length
    : 0

  useEffect(() => {
    if (!hydrated) return
    // Mesma regra do salvamento manual: nada e gravado antes de a carreira
    // comecar no pre-office.
    if (!podeSalvarCarreira(state)) return
    // A primeira leitura apenas estabelece o ponto de partida da sessão. Isso impede
    // um aviso de autosave ao abrir uma carreira antiga, antes de jogar outra partida.
    if (!ready.current) {
      ready.current = true
      return
    }

    const interval = state.autoSaveInterval ?? 1
    if (interval === 0 || matchCount <= (state.lastAutoSaveMatchCount ?? 0)) return
    if (matchCount % interval !== 0) return

    if (saving.current) return
    saving.current = true
    void (async () => {
      try {
        persistGameEngineNow()
        const next = { ...state, lastAutoSaveMatchCount: matchCount, updatedAt: Date.now() }
        await saveGameStateAndFlush(next)
        const cloudCode = getSavedCloudCode()
        if (cloudCode) await uploadSave(cloudCode)
        notificar.current({
          type: "system",
          title: "Jogo salvo automaticamente",
          message: `Progresso salvo após ${matchCount} partida${matchCount === 1 ? "" : "s"}.`,
          priority: "low",
        })
      } finally {
        saving.current = false
      }
    })()
  }, [hydrated, matchCount, state])

  return null
}

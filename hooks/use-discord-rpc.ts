"use client"

import { invoke } from "@tauri-apps/api/core"
import { useEffect } from "react"
import type { MatchState } from "@/lib/match-engine"
import type { Team } from "@/lib/teams-data"

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window

function updatePresence(details: string, state: string) {
  if (!isTauri) return
  invoke("discord_update", { details, state }).catch(() => {})
}

function clearPresence() {
  if (!isTauri) return
  invoke("discord_clear").catch(() => {})
}

// Hook genérico — use em qualquer página
export function useDiscordActivity(details: string, state: string) {
  useEffect(() => {
    updatePresence(details, state)
  }, [details, state])

  useEffect(() => {
    return () => clearPresence()
  }, [])
}

// Hook específico para partida ao vivo
export function useDiscordRPC(
  matchState: MatchState,
  homeTeam: Team,
  awayTeam: Team,
) {
  const { phase, minute, home, away } = matchState

  useEffect(() => {
    const score = `${home.goals} x ${away.goals}`
    const matchup = `${homeTeam.curto} ${score} ${awayTeam.curto}`

    switch (phase) {
      case "pre":
        updatePresence(
          `${homeTeam.nome} vs ${awayTeam.nome}`,
          "Aguardando início da partida",
        )
        break
      case "first":
        updatePresence(matchup, `1º Tempo · ${minute}'`)
        break
      case "halftime":
        updatePresence(matchup, "Intervalo")
        break
      case "second":
        updatePresence(matchup, `2º Tempo · ${minute}'`)
        break
      case "fulltime":
        updatePresence(matchup, "Partida encerrada")
        break
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, home.goals, away.goals, minute % 5 === 0 ? minute : undefined])

  useEffect(() => {
    return () => clearPresence()
  }, [])
}

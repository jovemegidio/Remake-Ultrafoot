"use client"

// Escalacoes salvas — de verdade.
//
// Antes a tela de Configuracoes mostrava tres cartoes CHUMBADOS ("Escalacao Principal",
// "Rotacao", "Jovens"), todos com "4-3-3 - 11 jogadores" escrito no HTML. Nao havia
// escalacao salva nenhuma: nada era gravado, nada era carregado, e clicar so navegava.
//
// Aqui as escalacoes viram dado real, no persistent-store (sobrevive a reinstalacao).

import { storeGet, storeSet } from "@/lib/persistent-store"

const KEY = "ultrafoot:saved-lineups"

export interface SavedLineup {
  id: string
  name: string
  formation: string
  /** Ids dos titulares, na ordem. */
  starters: number[]
  /** Nomes dos titulares — para exibir sem depender do elenco carregado. */
  starterNames: string[]
  updatedAt: number
}

function readAll(): SavedLineup[] {
  const raw = storeGet(KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SavedLineup[]) : []
  } catch {
    return []
  }
}

function writeAll(list: SavedLineup[]): void {
  storeSet(KEY, JSON.stringify(list))
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ultrafoot:lineups:changed"))
  }
}

export function listSavedLineups(): SavedLineup[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt)
}

/** Salva (ou sobrescreve, se o nome ja existir) uma escalacao. */
export function saveLineup(input: {
  name: string
  formation: string
  starters: number[]
  starterNames: string[]
}): SavedLineup {
  const list = readAll()
  const name = input.name.trim() || "Escalação"
  const existing = list.find((l) => l.name.toLowerCase() === name.toLowerCase())

  const lineup: SavedLineup = {
    id: existing?.id ?? `lineup_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    formation: input.formation,
    starters: input.starters,
    starterNames: input.starterNames,
    updatedAt: Date.now(),
  }

  const next = existing
    ? list.map((l) => (l.id === existing.id ? lineup : l))
    : [...list, lineup]

  writeAll(next)
  return lineup
}

export function deleteLineup(id: string): void {
  writeAll(readAll().filter((l) => l.id !== id))
}

export function getLineup(id: string): SavedLineup | undefined {
  return readAll().find((l) => l.id === id)
}

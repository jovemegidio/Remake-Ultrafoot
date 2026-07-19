"use client"

import { storeGet, storeSet } from "@/lib/persistent-store"
import { defaultPlayerAttributes } from "@/lib/player-overrides"

export interface YouthEditorPlayer {
  id: number
  originalName: string
  nome: string
  posicao: string
  pais: string
  idade: number
  overall: number
  caracteristica: string
  lado: string
  pace: number
  shooting: number
  passing: number
  dribbling: number
  defending: number
  physical: number
}

const KEY = (teamKey: string) => `ultrafoot:youth-editor:${teamKey}`
const FIRST = ["Lucas", "Gabriel", "Pedro", "Matheus", "João", "Rafael", "Thiago", "Bruno", "Caio", "Gustavo", "Enzo", "Davi"]
const LAST = ["Silva", "Santos", "Oliveira", "Costa", "Souza", "Pereira", "Lima", "Almeida", "Rocha", "Ferreira", "Martins", "Gomes"]
const POSITIONS = ["GOL", "ZAG", "LD", "LE", "VOL", "MEI", "PD", "PE", "ATA"]

function hash(input: string): number {
  let out = 2166136261
  for (const char of input) out = Math.imul(out ^ char.charCodeAt(0), 16777619)
  return out >>> 0
}

export function generateYouthRoster(teamKey: string, generation = 0): YouthEditorPlayer[] {
  return Array.from({ length: 15 }, (_, index) => {
    const seed = hash(`${teamKey}:${generation}:${index}`)
    const posicao = POSITIONS[index === 0 ? 0 : 1 + (seed % (POSITIONS.length - 1))]
    const overall = 45 + (seed % 24)
    const nome = `${FIRST[seed % FIRST.length]} ${LAST[(seed >>> 5) % LAST.length]}`
    const attrs = defaultPlayerAttributes(overall, posicao)
    return {
      id: 10000 + generation * 100 + index,
      originalName: nome,
      nome,
      posicao,
      pais: "-",
      idade: 15 + ((seed >>> 9) % 6),
      overall,
      caracteristica: overall >= 63 ? "Promissor" : "Em formação",
      lado: (seed >>> 12) % 4 === 0 ? "E" : "D",
      ...attrs,
    }
  })
}

export function getYouthRoster(teamKey: string): YouthEditorPlayer[] {
  const raw = storeGet(KEY(teamKey))
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as YouthEditorPlayer[]
      if (Array.isArray(parsed)) return parsed
    } catch { /* gera um elenco novo abaixo */ }
  }
  return generateYouthRoster(teamKey)
}

export function saveYouthRoster(teamKey: string, players: YouthEditorPlayer[]): void {
  storeSet(KEY(teamKey), JSON.stringify(players))
}

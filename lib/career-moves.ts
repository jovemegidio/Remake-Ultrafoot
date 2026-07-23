"use client"

// Ciclo de carreira do TECNICO: propostas de outros clubes e pedido de demissao.
//
// O que a auditoria encontrou:
//   - `generateJobOffers()` (lib/board-engine.ts) estava escrita, completa... e NUNCA era
//     chamada. Codigo morto: nenhum clube jamais procurava o tecnico, por melhor que
//     fosse a campanha. O ciclo "performar -> ser cortejado -> subir de patamar" nunca
//     fechava.
//   - "Pedir demissao" nao existia. So havia o TIPO (`endReason: "resigned"` no hall da
//     fama); a acao nunca foi implementada, entao o tecnico ficava preso no clube.
//
// Este modulo liga as duas pontas e persiste as propostas no save.

import { storeGet, storeSet } from "@/lib/persistent-store"
import { getCareerScopedKey } from "@/lib/save-system"
import type { JobOffer } from "@/lib/board-engine"

const key = () => getCareerScopedKey("ultrafoot:job-offers")

export interface PendingJobOffer extends JobOffer {
  id: string
  /** Temporada/semana em que a proposta chegou (ela expira). */
  season: number
  week: number
}

/** Propostas expiram em 4 semanas — nao ficam encalhadas para sempre. */
const EXPIRA_EM_SEMANAS = 4

function readAll(): PendingJobOffer[] {
  const raw = storeGet(key())
  if (!raw) return []
  try {
    const p = JSON.parse(raw)
    return Array.isArray(p) ? (p as PendingJobOffer[]) : []
  } catch {
    return []
  }
}

function writeAll(list: PendingJobOffer[]): void {
  storeSet(key(), JSON.stringify(list))
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ultrafoot:job-offers:changed"))
  }
}

/** Propostas ainda validas (as vencidas somem sozinhas). */
export function listJobOffers(season: number, week: number): PendingJobOffer[] {
  const vivas = readAll().filter((o) => {
    const semanasPassadas = (season - o.season) * 52 + (week - o.week)
    return semanasPassadas >= 0 && semanasPassadas <= EXPIRA_EM_SEMANAS
  })
  if (vivas.length !== readAll().length) writeAll(vivas)
  return vivas
}

/** Guarda as propostas geradas, sem duplicar clube. */
export function addJobOffers(offers: JobOffer[], season: number, week: number): void {
  if (offers.length === 0) return
  const atuais = readAll()
  const jaTem = new Set(atuais.map((o) => o.clubShort))

  const novas: PendingJobOffer[] = offers
    .filter((o) => !jaTem.has(o.clubShort))
    .map((o) => ({
      ...o,
      id: `job_${o.clubShort}_${season}_${week}`,
      season,
      week,
    }))

  if (novas.length) writeAll([...atuais, ...novas])
}

export function removeJobOffer(id: string): void {
  writeAll(readAll().filter((o) => o.id !== id))
}

export function clearJobOffers(): void {
  writeAll([])
}

/**
 * ASSUMIR UM CLUBE a partir de uma proposta. Centraliza a troca de emprego que
 * antes so existia no card do Escritorio — a Area do Treinador so deixava
 * RECUSAR, e mandava o usuario ir a outra tela para aceitar.
 *
 * Recarrega o motor no clube novo (senao elenco, tatica e fixtures do emprego
 * anterior ficavam para tras) e preserva apenas o tempo da carreira. As
 * dependencias entram por parametro para este modulo nao importar o store nem o
 * roteador (evita ciclo e mantem a funcao testavel).
 */
export function assumirClube(
  clubShort: string,
  deps: {
    initializeGame: (short: string) => void
    setEngineTime: (week: number, season: number) => void
    setSaveState: (patch: Record<string, unknown>) => void
    navigate: (href: string) => void
    week: number
    season: number
  },
): void {
  clearJobOffers()
  deps.initializeGame(clubShort)
  deps.setEngineTime(deps.week, deps.season)
  deps.setSaveState({
    selectedTeamShort: clubShort,
    divisionOverride: undefined,
    fixtures: [],
    standings: [],
    squadPlayers: undefined,
    youthPlayers: undefined,
    youthCareer: undefined,
  })
  deps.navigate("/")
}

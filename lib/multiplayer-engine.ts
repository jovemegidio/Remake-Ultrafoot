// PHASE 29 — Multiplayer local
// Status: skeleton — 2-4 técnicos no mesmo save, turnos semanais,
// disputa de mercado, tabela compartilhada.

import { DEFAULT_STATE, type GameState, type SavedTeam } from "@/lib/save-system"

export type LocalMultiplayerMode = "shared_career" | "versus" | "fantasy_draft" | "knockout"

export interface LocalKnockoutFixture {
  id: string
  round: number
  homeSlotId: number
  awaySlotId: number
  homeGoals?: number
  awayGoals?: number
  winnerSlotId?: number
}

export interface MultiplayerSlot {
  slotId: number                   // 1..4
  managerName: string
  team: SavedTeam
  isAI: boolean
  ready: boolean                   // marcou turno como concluído?
  pendingDecisions: string[]       // ids de eventos pendentes
}

export interface MultiplayerSession {
  id: string
  slots: MultiplayerSlot[]
  sharedState: GameState
  currentTurn: number              // round
  turnOwner: number                // 1..4 (alternância) ou -1 = todos simultâneo
  marketLockedBy?: number
  createdAt: number
  mode: LocalMultiplayerMode
  competitionName: string
  knockoutFixtures: LocalKnockoutFixture[]
  draft: { order: number[]; currentPick: number; picks: Record<number, string[]> } | null
}

/** Cria sessão local com N humanos. */
export function createSession(
  humans: { managerName: string; team: SavedTeam }[],
  mode: LocalMultiplayerMode = "shared_career",
): MultiplayerSession {
  if (humans.length < 2 || humans.length > 4) throw new Error("Uma sessão local requer de 2 a 4 técnicos.")
  if (mode === "versus" && humans.length !== 2) throw new Error("Versus requer exatamente dois técnicos.")
  if (mode === "knockout" && humans.length === 3) throw new Error("Mata-mata local requer dois ou quatro técnicos.")
  const teamKeys = humans.map(human => human.team.fileKey || human.team.curto)
  if (new Set(teamKeys).size !== teamKeys.length) throw new Error("Cada técnico precisa escolher um clube diferente.")
  const now = Date.now()
  const slots = humans.map((human, index) => ({
    slotId: index + 1,
    managerName: human.managerName.trim() || `Técnico ${index + 1}`,
    team: structuredClone(human.team),
    isAI: false,
    ready: false,
    pendingDecisions: [],
  }))
  const knockoutFixtures = mode === "knockout"
    ? Array.from({ length: Math.floor(slots.length / 2) }, (_, index) => ({
        id: `semi-${index + 1}`,
        round: 1,
        homeSlotId: slots[index * 2].slotId,
        awaySlotId: slots[index * 2 + 1].slotId,
      }))
    : []
  return {
    id: `local-${now}`,
    slots,
    sharedState: {
      ...structuredClone(DEFAULT_STATE),
      multiplayerEnabled: true,
      createdAt: now,
      updatedAt: now,
      selectedTeam: structuredClone(humans[0].team),
      selectedTeamShort: humans[0].team.curto,
    },
    currentTurn: 0,
    turnOwner: mode === "versus" ? 1 : -1,
    createdAt: now,
    mode,
    competitionName: mode === "knockout" ? "Copa local" : mode === "fantasy_draft" ? "Fantasy Draft" : mode === "versus" ? "Versus local" : "Carreira compartilhada",
    knockoutFixtures,
    draft: mode === "fantasy_draft"
      ? { order: slots.map(slot => slot.slotId), currentPick: 0, picks: Object.fromEntries(slots.map(slot => [slot.slotId, []])) }
      : null,
  }
}

export function setSlotReady(session: MultiplayerSession, slotId: number, ready: boolean): MultiplayerSession {
  return { ...session, slots: session.slots.map(slot => slot.slotId === slotId ? { ...slot, ready } : slot) }
}

export function registerDraftPick(session: MultiplayerSession, playerId: string): MultiplayerSession {
  if (!session.draft) return session
  if (Object.values(session.draft.picks).some(picks => picks.includes(playerId))) throw new Error("Este atleta já foi escolhido.")
  const order = session.draft.order
  const slotId = order[session.draft.currentPick % order.length]
  return {
    ...session,
    draft: {
      ...session.draft,
      currentPick: session.draft.currentPick + 1,
      picks: { ...session.draft.picks, [slotId]: [...(session.draft.picks[slotId] ?? []), playerId] },
    },
  }
}

export function registerKnockoutResult(
  session: MultiplayerSession,
  fixtureId: string,
  homeGoals: number,
  awayGoals: number,
): MultiplayerSession {
  if (!Number.isInteger(homeGoals) || !Number.isInteger(awayGoals) || homeGoals < 0 || awayGoals < 0 || homeGoals > 99 || awayGoals > 99) {
    throw new Error("Informe um placar válido entre 0 e 99 gols.")
  }
  if (homeGoals === awayGoals) throw new Error("Mata-mata local precisa de um vencedor; informe o placar após os pênaltis.")
  if (!session.knockoutFixtures.some(fixture => fixture.id === fixtureId)) throw new Error("Partida do mata-mata não encontrada.")
  const updated = session.knockoutFixtures.map(fixture => fixture.id === fixtureId
    ? { ...fixture, homeGoals, awayGoals, winnerSlotId: homeGoals > awayGoals ? fixture.homeSlotId : fixture.awaySlotId }
    : fixture)

  // Em uma copa de quatro técnicos a final só nasce quando as duas semifinais
  // terminam. Assim não precisamos inventar participantes ou deixar um confronto
  // com clubes vazios na interface.
  const semifinals = updated.filter(fixture => fixture.round === 1)
  const needsFinal = semifinals.length === 2 && semifinals.every(fixture => fixture.winnerSlotId != null)
    && !updated.some(fixture => fixture.round === 2)
  if (needsFinal) {
    updated.push({
      id: "final-1",
      round: 2,
      homeSlotId: semifinals[0].winnerSlotId!,
      awaySlotId: semifinals[1].winnerSlotId!,
    })
  }
  return {
    ...session,
    knockoutFixtures: updated,
  }
}

/** Avança turno só quando todos slots ready=true. */
export function advanceTurnIfReady(session: MultiplayerSession): MultiplayerSession {
  const next=structuredClone(session);if(next.slots.every(s=>s.ready&&s.pendingDecisions.length===0)){next.currentTurn++;next.sharedState.week++;next.slots.forEach(s=>s.ready=false)}return next
}

/** Disputa de mercado: 2 humanos miram mesmo jogador. */
export function resolveMarketDispute(
  session: MultiplayerSession,
  playerId: string,
): { winnerSlotId: number; reason: string } {
  const eligible=session.slots.filter(s=>s.pendingDecisions.includes(`transfer:${playerId}`));if(!eligible.length)throw new Error("Nenhum técnico disputa este jogador.");const winner=eligible.toSorted((a,b)=>b.team.prestigio-a.team.prestigio||b.team.saldo-a.team.saldo||a.slotId-b.slotId)[0];return{winnerSlotId:winner.slotId,reason:"Melhor combinação de projeto esportivo e capacidade financeira."}
}

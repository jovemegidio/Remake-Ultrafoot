// PHASE 23 — Estádio e infraestrutura
// Status: skeleton — estádio, CT, base, gramado, médico, marketing, centro análise.
// Impacta receita, evolução, lesões, moral, torcida.

export type FacilityType =
  | "stadium"
  | "training_center"
  | "youth_academy"
  | "pitch"
  | "medical"
  | "marketing"
  | "analysis_center"

export interface Facility {
  type: FacilityType
  level: number                    // 0..10
  upgradeProgress: number          // 0..1
  monthlyMaintenance: number
  upgradeCost: number              // próximo nível
  upgradeMonths: number
}

export interface FacilityImpact {
  matchdayRevenue?: number         // stadium
  trainingMultiplier?: number      // training_center
  youthIntakeQuality?: number      // youth_academy
  injuryRate?: number              // pitch (negativo se nível baixo)
  injuryRecoverySpeed?: number     // medical
  sponsorshipMultiplier?: number   // marketing
  scoutAccuracyBonus?: number      // analysis_center
}

export const DEFAULT_FACILITIES: Record<FacilityType, Facility> = {
  stadium: { type: "stadium", level: 1, upgradeProgress: 0, monthlyMaintenance: 0, upgradeCost: 0, upgradeMonths: 0 },
  training_center: { type: "training_center", level: 1, upgradeProgress: 0, monthlyMaintenance: 0, upgradeCost: 0, upgradeMonths: 0 },
  youth_academy: { type: "youth_academy", level: 1, upgradeProgress: 0, monthlyMaintenance: 0, upgradeCost: 0, upgradeMonths: 0 },
  pitch: { type: "pitch", level: 1, upgradeProgress: 0, monthlyMaintenance: 0, upgradeCost: 0, upgradeMonths: 0 },
  medical: { type: "medical", level: 1, upgradeProgress: 0, monthlyMaintenance: 0, upgradeCost: 0, upgradeMonths: 0 },
  marketing: { type: "marketing", level: 1, upgradeProgress: 0, monthlyMaintenance: 0, upgradeCost: 0, upgradeMonths: 0 },
  analysis_center: { type: "analysis_center", level: 1, upgradeProgress: 0, monthlyMaintenance: 0, upgradeCost: 0, upgradeMonths: 0 },
}

/** Inicia upgrade — debita custo. */
export function startUpgrade(_facility: Facility): Facility {
  throw new Error("infrastructure-engine.startUpgrade: not implemented")
}

/** Avança 1 mês de obras (upgradeProgress += 1/upgradeMonths). */
export function tickUpgrade(_facility: Facility): Facility {
  throw new Error("infrastructure-engine.tickUpgrade: not implemented")
}

/** Calcula impacto agregado das instalações. */
export function calcImpact(_facilities: Record<FacilityType, Facility>): FacilityImpact {
  throw new Error("infrastructure-engine.calcImpact: not implemented")
}

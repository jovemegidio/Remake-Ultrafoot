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

export type PitchSurface="natural"|"synthetic"
export type PitchQuality="poor"|"medium"|"good"
export interface StadiumPitch{surface:PitchSurface;quality:PitchQuality;lastUpgradeSeason:number;monthlyMaintenance:number}
const QUALITY_RISK:Record<PitchQuality,number>={poor:1.55,medium:1,good:.68}
const QUALITY_COST:Record<PitchQuality,number>={poor:1,medium:1.8,good:3}
export function createStadiumPitch(clubPrestige:number,season=2026):StadiumPitch{const quality:PitchQuality=clubPrestige<45?"poor":clubPrestige<75?"medium":"good";return configurePitch("natural",quality,season)}
export function configurePitch(surface:PitchSurface,quality:PitchQuality,season:number):StadiumPitch{const naturalBase=180000,base=surface==="synthetic"?naturalBase*.58:naturalBase;return{surface,quality,lastUpgradeSeason:season,monthlyMaintenance:Math.round(base*QUALITY_COST[quality])}}
export function pitchInjuryFrequencyMultiplier(pitch:StadiumPitch):number{return QUALITY_RISK[pitch.quality]}
export function pitchInjuryDurationMultiplier(pitch:StadiumPitch):number{return pitch.surface==="synthetic"?1.35:1}
export function pitchUpgradeCost(current:StadiumPitch,targetSurface:PitchSurface,targetQuality:PitchQuality):number{const rank={poor:0,medium:1,good:2};const qualityCost=Math.max(0,rank[targetQuality]-rank[current.quality])*2_500_000,surfaceCost=current.surface===targetSurface?0:targetSurface==="synthetic"?5_000_000:3_500_000;return qualityCost+surfaceCost}

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
export function startUpgrade(facility: Facility): Facility {
  if(facility.level>=10||facility.upgradeProgress>0)return {...facility};const months=Math.max(1,Math.ceil((facility.level+1)/2));return{...facility,upgradeProgress:1/months,upgradeMonths:months,upgradeCost:Math.max(facility.upgradeCost,500000*(facility.level+1)),monthlyMaintenance:Math.max(facility.monthlyMaintenance,25000*facility.level)}
}

/** Avança 1 mês de obras (upgradeProgress += 1/upgradeMonths). */
export function tickUpgrade(facility: Facility): Facility {
  if(facility.upgradeProgress<=0||facility.level>=10)return{...facility};const progress=facility.upgradeProgress+1/Math.max(1,facility.upgradeMonths);return progress>=1?{...facility,level:Math.min(10,facility.level+1),upgradeProgress:0,upgradeCost:Math.round(facility.upgradeCost*1.55),monthlyMaintenance:Math.round(facility.monthlyMaintenance*1.25)}:{...facility,upgradeProgress:progress}
}

/** Calcula impacto agregado das instalações. */
export function calcImpact(f: Record<FacilityType, Facility>): FacilityImpact {
  return{matchdayRevenue:1+f.stadium.level*.045,trainingMultiplier:1+f.training_center.level*.035,youthIntakeQuality:f.youth_academy.level*8,injuryRate:Math.max(.55,1-f.pitch.level*.035),injuryRecoverySpeed:1+f.medical.level*.04,sponsorshipMultiplier:1+f.marketing.level*.05,scoutAccuracyBonus:f.analysis_center.level*3}
}

// PHASE 10 — Staff técnico
// Status: skeleton — auxiliar, prep físico, médico, fisio, analista, olheiro,
// treinador GK, treinador base, diretor futebol, psicólogo. Cada um impacta gameplay.

export type StaffRole =
  | "auxiliar"
  | "prep_fisico"
  | "medico"
  | "fisioterapeuta"
  | "analista"
  | "olheiro"
  | "treinador_goleiros"
  | "treinador_base"
  | "diretor_futebol"
  | "psicologo"

export interface StaffMember {
  id: string
  name: string
  role: StaffRole
  ability: number                  // 0-100
  potential: number                // 0-100
  age: number
  monthlyWage: number
  contractMonths: number
  reputation: number
  specialty?: string               // ex: "atletismo", "psicologia ofensiva"
  morale: number                   // 0-100
}

export interface StaffImpact {
  // Como cada role afeta o gameplay (multiplicadores)
  injuryRecovery?: number          // medico/fisio
  fitnessGain?: number             // prep_fisico
  trainingMultiplier?: number      // auxiliar
  scoutAccuracy?: number           // olheiro
  youthDevelopment?: number        // treinador_base
  goalkeepingAttribute?: number    // treinador_goleiros
  tacticalAnalysis?: number        // analista
  moralBonus?: number              // psicologo
  transferNegotiation?: number     // diretor_futebol
}

export interface StaffSlots {
  auxiliar: StaffMember | null
  prep_fisico: StaffMember | null
  medico: StaffMember | null
  fisioterapeuta: StaffMember | null
  analista: StaffMember | null
  olheiro: StaffMember | null
  treinador_goleiros: StaffMember | null
  treinador_base: StaffMember | null
  diretor_futebol: StaffMember | null
  psicologo: StaffMember | null
}

/** Calcula impacto do staff atual sobre o gameplay. */
export function calcStaffImpact(_slots: StaffSlots): StaffImpact {
  throw new Error("staff-engine.calcStaffImpact: not implemented")
}

/** Contrata staff. */
export function hireStaff(_slots: StaffSlots, _member: StaffMember): StaffSlots {
  throw new Error("staff-engine.hireStaff: not implemented")
}

/** Demite staff. */
export function fireStaff(_slots: StaffSlots, _role: StaffRole): { slots: StaffSlots; severance: number } {
  throw new Error("staff-engine.fireStaff: not implemented")
}

/** Gera candidatos para uma vaga. */
export function generateCandidates(_role: StaffRole, _budget: number): StaffMember[] {
  throw new Error("staff-engine.generateCandidates: not implemented")
}

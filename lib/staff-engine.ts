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
  const quality = (role: StaffRole) => (_slots[role]?.ability ?? 0) / 100
  return {
    trainingMultiplier: 1 + quality("auxiliar") * 0.2,
    fitnessGain: 1 + quality("prep_fisico") * 0.25,
    injuryRecovery: 1 + quality("medico") * 0.18 + quality("fisioterapeuta") * 0.22,
    tacticalAnalysis: quality("analista") * 20,
    scoutAccuracy: quality("olheiro") * 25,
    goalkeepingAttribute: quality("treinador_goleiros") * 3,
    youthDevelopment: quality("treinador_base") * 20,
    transferNegotiation: quality("diretor_futebol") * 12,
    moralBonus: quality("psicologo") * 8,
  }
}

/** Contrata staff. */
export function hireStaff(_slots: StaffSlots, _member: StaffMember): StaffSlots {
  return { ..._slots, [_member.role]: { ..._member } }
}

/** Demite staff. */
export function fireStaff(_slots: StaffSlots, _role: StaffRole): { slots: StaffSlots; severance: number } {
  const member = _slots[_role]
  return {
    slots: { ..._slots, [_role]: null },
    severance: member ? Math.round(member.monthlyWage * Math.max(1, Math.min(6, member.contractMonths)) * 0.5) : 0,
  }
}

/** Gera candidatos para uma vaga. */
export function generateCandidates(_role: StaffRole, _budget: number): StaffMember[] {
  const base = Math.max(35, Math.min(92, Math.round(35 + Math.log10(Math.max(1, _budget)) * 8)))
  const first = ["Carlos", "Rafael", "Marcos", "André", "Paulo", "Renato", "Diego", "Eduardo"]
  const last = ["Silva", "Costa", "Oliveira", "Santos", "Pereira", "Souza", "Almeida", "Ferreira"]
  return Array.from({ length: 6 }, (_, index) => {
    const ability = Math.max(30, Math.min(95, base - 12 + index * 4))
    return {
      id: `staff_${_role}_${index}_${_budget}`,
      name: `${first[index]} ${last[(index + _role.length) % last.length]}`,
      role: _role,
      ability,
      potential: Math.min(99, ability + 4 + index),
      age: 32 + index * 4,
      monthlyWage: Math.round(Math.min(_budget, 4000 + ability ** 2 * 7) / 100) * 100,
      contractMonths: 24,
      reputation: Math.max(20, ability - 8),
      morale: 75,
    }
  })
}

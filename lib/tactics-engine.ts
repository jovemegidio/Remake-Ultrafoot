// PHASE 12 — Tática avançada
// Instruções com/sem bola, blocos, pressão, saída, jogo direto,
// amplitude, linha defensiva, marcação. Identidade tática influencia IA do clube.

export type Formation =
  | "4-4-2" | "4-3-3" | "4-2-3-1" | "3-5-2" | "4-1-4-1" | "5-3-2" | "3-4-3" | "4-3-1-2"

export type DefensiveBlock = "alto" | "medio" | "baixo"
export type PressIntensity = "nenhuma" | "moderada" | "alta" | "tudo_ou_nada"
export type BuildUp = "curta" | "mista" | "direta"
export type Width = "estreita" | "media" | "ampla"
export type DefenseLine = "baixa" | "media" | "alta" | "muito_alta"
export type MarkingType = "zona" | "individual" | "mista"

export type TacticalIdentity =
  | "ofensivo"
  | "retranca"
  | "posse"
  | "pressao_alta"
  | "contra_ataque"
  | "bola_aerea"
  | "base_forte"

export interface TacticConfig {
  formation: Formation
  identity: TacticalIdentity

  // Com bola
  buildUp: BuildUp
  width: Width
  tempo: "lento" | "medio" | "rapido"
  passingStyle: "curto" | "misto" | "direto"

  // Sem bola
  defensiveBlock: DefensiveBlock
  press: PressIntensity
  postLossPress: boolean
  defenseLine: DefenseLine
  marking: MarkingType
  offsideTrap: boolean

  // Bola parada
  setPieceTaker?: { freeKick: string; corner: string; penalty: string }
}

// ─── Presets por identidade ──────────────────────────────────────────────────

const IDENTITY_PRESETS: Record<TacticalIdentity, TacticConfig> = {
  ofensivo: {
    formation: "4-3-3", identity: "ofensivo",
    buildUp: "curta", width: "ampla", tempo: "rapido", passingStyle: "misto",
    defensiveBlock: "alto", press: "alta", postLossPress: true,
    defenseLine: "alta", marking: "zona", offsideTrap: true,
  },
  retranca: {
    formation: "5-3-2", identity: "retranca",
    buildUp: "direta", width: "estreita", tempo: "lento", passingStyle: "direto",
    defensiveBlock: "baixo", press: "nenhuma", postLossPress: false,
    defenseLine: "baixa", marking: "individual", offsideTrap: false,
  },
  posse: {
    formation: "4-2-3-1", identity: "posse",
    buildUp: "curta", width: "media", tempo: "lento", passingStyle: "curto",
    defensiveBlock: "medio", press: "moderada", postLossPress: true,
    defenseLine: "media", marking: "zona", offsideTrap: false,
  },
  pressao_alta: {
    formation: "4-3-3", identity: "pressao_alta",
    buildUp: "curta", width: "media", tempo: "rapido", passingStyle: "curto",
    defensiveBlock: "alto", press: "tudo_ou_nada", postLossPress: true,
    defenseLine: "muito_alta", marking: "mista", offsideTrap: true,
  },
  contra_ataque: {
    formation: "4-4-2", identity: "contra_ataque",
    buildUp: "direta", width: "media", tempo: "rapido", passingStyle: "direto",
    defensiveBlock: "baixo", press: "moderada", postLossPress: false,
    defenseLine: "baixa", marking: "zona", offsideTrap: false,
  },
  bola_aerea: {
    formation: "4-4-2", identity: "bola_aerea",
    buildUp: "direta", width: "ampla", tempo: "medio", passingStyle: "direto",
    defensiveBlock: "medio", press: "moderada", postLossPress: false,
    defenseLine: "media", marking: "individual", offsideTrap: false,
  },
  base_forte: {
    formation: "4-1-4-1", identity: "base_forte",
    buildUp: "mista", width: "media", tempo: "medio", passingStyle: "misto",
    defensiveBlock: "medio", press: "moderada", postLossPress: true,
    defenseLine: "media", marking: "zona", offsideTrap: false,
  },
}

/** Tática default por identidade. */
export function defaultTacticForIdentity(id: TacticalIdentity): TacticConfig {
  return { ...IDENTITY_PRESETS[id] }
}

// Identidades históricas de clubes conhecidos (fallback: hash determinístico)
const CLUB_IDENTITIES: Record<string, TacticalIdentity> = {
  FLA: "ofensivo", PAL: "posse", COR: "contra_ataque", SAO: "posse",
  GRE: "posse", INT: "ofensivo", CAM: "ofensivo", CRU: "posse",
  BOT: "pressao_alta", FLU: "posse", VAS: "contra_ataque", SAN: "base_forte",
  BAH: "posse", RBB: "pressao_alta", FOR: "retranca", CEA: "contra_ataque",
  CUI: "retranca", GOI: "contra_ataque", COR_ITA: "retranca", JUV: "retranca",
}

const IDENTITY_LIST: TacticalIdentity[] = [
  "ofensivo", "retranca", "posse", "pressao_alta", "contra_ataque", "bola_aerea", "base_forte",
]

/** IA do clube respeita identidade ao montar tática. */
export function aiTacticForClub(clubCurto: string, identity?: TacticalIdentity): TacticConfig {
  if (identity) return defaultTacticForIdentity(identity)
  const known = CLUB_IDENTITIES[clubCurto]
  if (known) return defaultTacticForIdentity(known)
  // Hash determinístico do curto → identidade estável por clube
  let h = 0
  for (let i = 0; i < clubCurto.length; i++) h = (h * 31 + clubCurto.charCodeAt(i)) >>> 0
  return defaultTacticForIdentity(IDENTITY_LIST[h % IDENTITY_LIST.length])
}

/**
 * Quanto uma tática CARREGA de pressão e de transição, 0-1.
 *
 * ⚠️ ESTES NÚMEROS MORAVAM DENTRO DE `app/partida/ao-vivo` (em `cpuMatchProfile`).
 * Saíram de lá quando a preparação para o adversário passou a precisar da mesma
 * leitura na Central de Gestão: duas cópias seriam duas réguas para a mesma
 * grandeza, e este projeto já pagou três vezes por esse erro (leilão, caixa dos
 * clubes e Championship — ver o histórico em `lib/repartir-venda.ts` e nas
 * memórias do projeto). A tela de preparação e a partida têm de ler o mesmo
 * adversário, senão o plano é feito contra um time e jogado contra outro.
 */
export function cargaDaTatica(tactic: TacticConfig): { pressingLoad: number; transitionLoad: number } {
  const pressingLoad = tactic.press === "tudo_ou_nada" ? 1
    : tactic.press === "alta" ? 0.72
      : tactic.press === "moderada" ? 0.42 : 0.12
  const transitionLoad = tactic.identity === "pressao_alta" ? 0.9
    : tactic.identity === "contra_ataque" || tactic.identity === "ofensivo" ? 0.7
      : tactic.identity === "retranca" ? 0.25 : 0.45
  return { pressingLoad, transitionLoad }
}

/** Aplica tática ao motor de partida (modificadores multiplicativos, 1 = neutro). */
export function applyTacticModifiers(tactic: TacticConfig): {
  attackBoost: number
  defenseBoost: number
  pressureBoost: number
  injuryRisk: number
  fatigueRate: number
} {
  let attackBoost = 1
  let defenseBoost = 1
  let pressureBoost = 1
  let injuryRisk = 1
  let fatigueRate = 1

  // Bloco defensivo e linha
  if (tactic.defensiveBlock === "alto") { attackBoost += 0.05; defenseBoost -= 0.05 }
  if (tactic.defensiveBlock === "baixo") { attackBoost -= 0.05; defenseBoost += 0.06 }
  if (tactic.defenseLine === "muito_alta") { attackBoost += 0.04; defenseBoost -= 0.07; pressureBoost += 0.10 }
  if (tactic.defenseLine === "alta") { attackBoost += 0.02; defenseBoost -= 0.03 }
  if (tactic.defenseLine === "baixa") { defenseBoost += 0.04; attackBoost -= 0.03 }

  // Pressão
  if (tactic.press === "alta") { pressureBoost += 0.12; fatigueRate += 0.15; injuryRisk += 0.08 }
  if (tactic.press === "tudo_ou_nada") { pressureBoost += 0.22; fatigueRate += 0.30; injuryRisk += 0.15; defenseBoost -= 0.04 }
  if (tactic.press === "nenhuma") { pressureBoost -= 0.10; fatigueRate -= 0.10 }
  if (tactic.postLossPress) { pressureBoost += 0.05; fatigueRate += 0.08 }

  // Tempo de jogo
  if (tactic.tempo === "rapido") { attackBoost += 0.03; fatigueRate += 0.10 }
  if (tactic.tempo === "lento") { defenseBoost += 0.02; fatigueRate -= 0.08 }

  // Amplitude
  if (tactic.width === "ampla") { attackBoost += 0.03; defenseBoost -= 0.02 }
  if (tactic.width === "estreita") { defenseBoost += 0.03; attackBoost -= 0.02 }

  // Impedimento
  if (tactic.offsideTrap) { defenseBoost += 0.02; attackBoost += 0.01 }

  const clamp = (v: number) => Math.max(0.75, Math.min(1.3, v))
  return {
    attackBoost: clamp(attackBoost),
    defenseBoost: clamp(defenseBoost),
    pressureBoost: clamp(pressureBoost),
    injuryRisk: clamp(injuryRisk),
    fatigueRate: clamp(fatigueRate),
  }
}

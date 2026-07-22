// Prospectos da categoria de base.
//
// O que a auditoria encontrou: a pagina /base le `state.youthPlayers`, mas NINGUEM
// populava esse campo. O motor ate gera jovens ao virar a temporada, mas os despeja
// direto no ELENCO PROFISSIONAL (game-engine, squadPlayers) — nunca na base do save que
// a tela le. Resultado: a categoria de base ficava SEMPRE VAZIA.
//
// Aqui geramos os prospectos de forma DETERMINISTICA (seed = clube + temporada): a base
// e estavel dentro da temporada e se renova a cada ano. A /base semeia isto quando o
// campo esta vazio; promover/dispensar seguem persistindo normalmente.

import type { SquadPlayer } from "@/lib/save-system"

const FIRST = ["Lucas","Gabriel","Pedro","Matheus","João","Rafael","Felipe","André","Bruno","Kauan","Thiago","Vitor","Diego","Kayke","Guilherme","Luan","Enzo","Miguel","Davi","Arthur"]
const LAST = ["Silva","Santos","Oliveira","Lima","Costa","Ferreira","Ribeiro","Alves","Carvalho","Nascimento","Gomes","Martins","Pereira","Araújo","Souza","Rocha","Barbosa","Moraes","Cardoso","Pinto"]
const POSITIONS = ["GOL","ZAG","ZAG","LD","LE","VOL","VOL","MEI","MEI","PD","PE","ATA","ATA"]

// mulberry32: RNG deterministico e estavel por seed.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

/**
 * Gera os prospectos da base para um clube/temporada.
 *
 * @param teamShort clube (parte do seed — cada clube tem a sua leva)
 * @param season    temporada (parte do seed — renova a cada ano)
 * @param prestige  prestigio do clube — clube grande revela joias melhores
 * @param count     quantos prospectos (default 6)
 */
export function generateYouthProspects(
  teamShort: string,
  season: number,
  prestige = 60,
  count = 6,
): SquadPlayer[] {
  const rnd = mulberry32(hash(`${teamShort}:${season}:base`))
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]

  // Base do overall e do potencial sobem um pouco com o prestigio do clube.
  const overallFloor = 48 + Math.round((prestige - 50) * 0.12)   // ~48-54
  const potentialCeil = 70 + Math.round((prestige - 50) * 0.30)  // ~70-85

  const out: SquadPlayer[] = []
  for (let i = 0; i < count; i++) {
    const position = pick(POSITIONS)
    const overall = overallFloor + Math.floor(rnd() * 10)          // ~48-64
    const potential = Math.min(
      95,
      Math.max(overall + 6, potentialCeil - 8 + Math.floor(rnd() * 16)),
    )
    // Base começa aos 14 (pedido): garotos de 14-17 vão amadurecendo até
    // subirem ao profissional aos 18. Antes nasciam 16-19 (já quase prontos).
    const age = 14 + Math.floor(rnd() * 4)                          // 14-17
    // Valor cresce com o potencial (a joia vale pela promessa, nao pelo hoje).
    const value = Math.round((overall * 40_000 + potential * 90_000) / 10_000) * 10_000

    // ATRIBUTOS. Nao eram preenchidos: o card da base mostrava VEL/FIN/PAS 0
    // em todo garoto recem-gerado, e quem subisse ao profissional viraria perna
    // de pau no motor de partida. Cada posicao puxa os seus para cima.
    const vies: Record<string, Partial<Record<"pace" | "shooting" | "passing" | "dribbling" | "defending" | "physical", number>>> = {
      GOL: { defending: 6, physical: 4, pace: -10, shooting: -14, dribbling: -10 },
      ZAG: { defending: 7, physical: 6, pace: -4, shooting: -10, dribbling: -6 },
      LE: { pace: 6, defending: 3, shooting: -6 },
      LD: { pace: 6, defending: 3, shooting: -6 },
      VOL: { defending: 5, passing: 3, physical: 3, shooting: -5 },
      MEI: { passing: 7, dribbling: 5, defending: -6, physical: -4 },
      PE: { pace: 7, dribbling: 6, defending: -8, physical: -5 },
      PD: { pace: 7, dribbling: 6, defending: -8, physical: -5 },
      ATA: { shooting: 8, pace: 4, defending: -10 },
    }
    const b = vies[position] ?? {}
    const atr = (chave: keyof typeof b) =>
      Math.max(25, Math.min(85, overall + (b[chave] ?? 0) + Math.floor(rnd() * 9) - 4))

    out.push({
      id: `youth_${teamShort}_${season}_${i}`,
      name: `${pick(FIRST)} ${pick(LAST)}`,
      position,
      age,
      overall,
      potential,
      value,
      pace: atr("pace"),
      shooting: atr("shooting"),
      passing: atr("passing"),
      dribbling: atr("dribbling"),
      defending: atr("defending"),
      physical: atr("physical"),
      fromTeam: "Categoria de Base",
      trend: "up",
      seasonSigned: season,
    })
  }

  // Joia primeiro (maior potencial no topo).
  return out.sort((a, b) => b.potential - a.potential)
}

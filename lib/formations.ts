// Formacoes e suas coordenadas no campo (sistema 100x133, EA FC style).
//
// Estava declarado DENTRO de app/elenco/gerenciamento/page.tsx, entao nenhuma outra tela
// podia usar — e a Central de Transferencias acabou desenhando um 4-3-3 com 11 <div>
// chumbados no HTML (overalls 81/78/80/84..., rotulos "ZAG"/"MC"), sem relacao com o
// elenco nem com a formacao real do usuario. Compartilhando daqui, cada tela desenha o
// time DE VERDADE.

export interface FormationSlot { pos: string; x: number; y: number }
export const FORMATIONS: Record<string, { name: string; positions: FormationSlot[] }> = {
  "4-3-3": {
    name: "4-3-3",
    positions: [
      { pos: "GOL", x: 50, y: 92 },
      { pos: "LD", x: 85, y: 75 },
      { pos: "ZAG", x: 65, y: 80 },
      { pos: "ZAG", x: 35, y: 80 },
      { pos: "LE", x: 15, y: 75 },
      { pos: "VOL", x: 50, y: 55 },
      { pos: "MEI", x: 75, y: 42 },
      { pos: "MEI", x: 25, y: 42 },
      { pos: "PD", x: 80, y: 22 },
      { pos: "ATA", x: 50, y: 12 },
      { pos: "PE", x: 20, y: 22 },
    ],
  },
  "4-4-2": {
    name: "4-4-2",
    positions: [
      { pos: "GOL", x: 50, y: 92 },
      { pos: "LD", x: 85, y: 75 },
      { pos: "ZAG", x: 65, y: 80 },
      { pos: "ZAG", x: 35, y: 80 },
      { pos: "LE", x: 15, y: 75 },
      { pos: "MD", x: 85, y: 48 },
      { pos: "VOL", x: 60, y: 52 },
      { pos: "VOL", x: 40, y: 52 },
      { pos: "ME", x: 15, y: 48 },
      { pos: "ATA", x: 62, y: 15 },
      { pos: "ATA", x: 38, y: 15 },
    ],
  },
  "4-2-3-1": {
    name: "4-2-3-1",
    positions: [
      { pos: "GOL", x: 50, y: 92 },
      { pos: "LD", x: 85, y: 75 },
      { pos: "ZAG", x: 65, y: 80 },
      { pos: "ZAG", x: 35, y: 80 },
      { pos: "LE", x: 15, y: 75 },
      { pos: "VOL", x: 60, y: 58 },
      { pos: "VOL", x: 40, y: 58 },
      { pos: "PD", x: 82, y: 35 },
      { pos: "MEI", x: 50, y: 32 },
      { pos: "PE", x: 18, y: 35 },
      { pos: "ATA", x: 50, y: 12 },
    ],
  },
  "3-5-2": {
    name: "3-5-2",
    positions: [
      { pos: "GOL", x: 50, y: 92 },
      { pos: "ZAG", x: 75, y: 78 },
      { pos: "ZAG", x: 50, y: 82 },
      { pos: "ZAG", x: 25, y: 78 },
      { pos: "ALD", x: 90, y: 50 },
      { pos: "VOL", x: 65, y: 55 },
      { pos: "MEI", x: 50, y: 42 },
      { pos: "VOL", x: 35, y: 55 },
      { pos: "ALE", x: 10, y: 50 },
      { pos: "ATA", x: 62, y: 15 },
      { pos: "ATA", x: 38, y: 15 },
    ],
  },
  "5-3-2": {
    name: "5-3-2",
    positions: [
      { pos: "GOL", x: 50, y: 92 },
      { pos: "ALD", x: 90, y: 65 },
      { pos: "ZAG", x: 70, y: 78 },
      { pos: "ZAG", x: 50, y: 82 },
      { pos: "ZAG", x: 30, y: 78 },
      { pos: "ALE", x: 10, y: 65 },
      { pos: "MEI", x: 70, y: 45 },
      { pos: "VOL", x: 50, y: 50 },
      { pos: "MEI", x: 30, y: 45 },
      { pos: "ATA", x: 62, y: 15 },
      { pos: "ATA", x: 38, y: 15 },
    ],
  },
}

/** Slots da formacao pedida; cai no 4-3-3 se a formacao nao existir. */
export function getFormationSlots(formation: string | undefined): FormationSlot[] {
  return (FORMATIONS[formation ?? ""] ?? FORMATIONS["4-3-3"]).positions
}

/**
 * Quem pode cobrir cada slot quando nao ha ninguem da posicao exata.
 *
 * Um elenco raramente tem o jogador certo para TODO slot de TODA formacao (um 3-5-2 pede
 * 3 zagueiros; um 4-3-3 pede 2). Sem isto, o encaixe caia no "pega o proximo da fila" e
 * um lateral acabava no miolo de zaga — ou, pior, um meia no gol.
 * A ordem importa: a primeira opcao e a mais natural.
 */
export const COMPATIBLE_POSITIONS: Record<string, string[]> = {
  GOL: [],                          // goleiro nao se improvisa
  ZAG: ["LD", "LE", "VOL"],         // lateral ou volante fecham a zaga
  LD: ["LE", "ZAG", "PD", "MEI"],
  LE: ["LD", "ZAG", "PE", "MEI"],
  VOL: ["MEI", "ZAG"],
  MEI: ["VOL", "PD", "PE", "ATA"],
  PD: ["PE", "MEI", "ATA", "LD"],
  PE: ["PD", "MEI", "ATA", "LE"],
  ATA: ["PD", "PE", "MEI"],

  // Slots que so existem em algumas formacoes. Sem eles no mapa, o encaixe caia no
  // "pega quem sobrou" — foi o teste (scripts/qa-formation.ts) que apontou: no 3-5-2 um
  // LATERAL-ESQUERDO ia parar na ALA DIREITA; no 4-4-2, um VOLANTE virava MEIA-DIREITA.
  MD: ["PD", "MEI", "LD", "PE"],    // meia-direita (4-4-2)
  ME: ["PE", "MEI", "LE", "PD"],    // meia-esquerda (4-4-2)
  ALD: ["LD", "PD", "MEI", "LE"],   // ala-direita (3-5-2 / 5-3-2)
  ALE: ["LE", "PE", "MEI", "LD"],   // ala-esquerda (3-5-2 / 5-3-2)
}

/**
 * Encaixa o elenco nos slots da formacao pela POSICAO de cada jogador.
 *
 * Antes cada tela fazia isto por INDICE do array:
 *   players.map((player, index) => ({ x: formationData.positions[index]?.x }))
 *
 * O elenco vem ordenado por posicao (GOL, ZAG, ZAG, LD, LE, VOL, MEI...) mas os slots do
 * 4-3-3 sao (GOL, LD, ZAG, ZAG, LE, ...). No indice 1 o jogador e ZAGUEIRO e o slot e
 * LATERAL-DIREITO; no indice 3 e o inverso. Cada um caia no buraco errado — dai "zagueiro
 * marcado como goleiro, meio-campista como zagueiro". Em 3-5-2/5-3-2, cuja ordem de slots
 * e outra, piorava.
 *
 * @param customPositions posicoes movidas a mao pelo usuario (arrastar no campo), por id.
 */
export function assignPlayersToFormation<T extends { id: number; position: string }>(
  players: T[],
  formation: string | undefined,
  customPositions: Record<number, { x: number; y: number }> = {},
): (T & { x: number; y: number; slotPos: string })[] {
  const slots = getFormationSlots(formation)
  const pool = [...players]
  const out: (T & { x: number; y: number; slotPos: string })[] = []

  for (const slot of slots) {
    // 1) alguem que joga EXATAMENTE nessa posicao
    let idx = pool.findIndex((p) => p.position === slot.pos)
    // 2) senao, alguem de posicao compativel
    if (idx === -1) {
      idx = pool.findIndex((p) => COMPATIBLE_POSITIONS[slot.pos]?.includes(p.position))
    }
    // 3) por ultimo, quem sobrou (elenco incompleto para essa formacao)
    if (idx === -1) idx = 0

    const player = pool.splice(idx, 1)[0]
    if (!player) continue

    const custom = customPositions[player.id]
    out.push({ ...player, x: custom?.x ?? slot.x, y: custom?.y ?? slot.y, slotPos: slot.pos })
  }
  return out
}

/**
 * Garante NO MAXIMO 1 goleiro no XI titular.
 *
 * As telas de partida montavam o time com sortByPosition(...).slice(0, 11). Como GOL e a
 * primeira posicao na ordenacao, um elenco com 3 goleiros (comum e correto — os clubes
 * carregam 3) colocava OS TRES como titulares. Este helper preserva a ordem recebida
 * (isStarter/posicao) e apenas move os goleiros excedentes para o fim (banco), de modo que
 * slice(0, 11) passe a ter 1 goleiro + 10 de linha.
 */
export function capGoalkeepers<T>(ordered: T[], getPos: (p: T) => string): T[] {
  const kept: T[] = []
  const surplusGks: T[] = []
  let gkSeen = 0
  for (const p of ordered) {
    if (getPos(p) === "GOL") {
      gkSeen++
      if (gkSeen > 1) { surplusGks.push(p); continue }
    }
    kept.push(p)
  }
  return [...kept, ...surplusGks]
}

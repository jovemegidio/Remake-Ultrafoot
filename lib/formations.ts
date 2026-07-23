// Formacoes e suas coordenadas no campo (sistema 100x133, EA FC style).
//
// Estava declarado DENTRO de app/elenco/gerenciamento/page.tsx, entao nenhuma outra tela
// podia usar — e a Central de Transferencias acabou desenhando um 4-3-3 com 11 <div>
// chumbados no HTML (overalls 81/78/80/84..., rotulos "ZAG"/"MC"), sem relacao com o
// elenco nem com a formacao real do usuario. Compartilhando daqui, cada tela desenha o
// time DE VERDADE.

export interface FormationSlot { pos: string; x: number; y: number }

/**
 * A base de dados usa algumas abreviações diferentes para a mesma função.
 * O motor tático trabalha com um vocabulário único; sem essa normalização um
 * CA/MC não encontrava o seu slot e caía no "primeiro que sobrou".
 */
export function normalizePosition(position: string | undefined): string {
  const value = (position ?? "").trim().toUpperCase()
  const aliases: Record<string, string> = {
    GK: "GOL", GOLEIRO: "GOL",
    CB: "ZAG", DEF: "ZAG", ZC: "ZAG",
    RB: "LD", LB: "LE", LAT: "ZAG",
    DM: "VOL", MCD: "VOL", CDM: "VOL",
    MC: "MEI", CM: "MEI", CAM: "MEI", MO: "MEI", MAT: "MEI",
    RM: "MD", LM: "ME",
    RW: "PD", AD: "PD", MAD: "PD",
    LW: "PE", AE: "PE", MAE: "PE",
    CA: "ATA", ST: "ATA", CF: "ATA", SA: "ATA", CENTROAVANTE: "ATA",
  }
  return aliases[value] ?? value
}
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
    let idx = pool.findIndex((p) => normalizePosition(p.position) === slot.pos)
    // 2) senao, alguem de posicao compativel
    if (idx === -1) {
      // Respeita a ORDEM de compatibilidade. `findIndex(includes)` escolhia o primeiro
      // atleta por overall; um MEI forte era lateral antes de um ZAG, embora ZAG viesse
      // antes na lista de alternativas.
      for (const compatible of COMPATIBLE_POSITIONS[slot.pos] ?? []) {
        idx = pool.findIndex((p) => normalizePosition(p.position) === compatible)
        if (idx !== -1) break
      }
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
 * Seleciona os 11 titulares ENCAIXANDO o elenco numa formacao (por posicao), com o resto
 * no banco.
 *
 * BUG que isto corrige: as telas de partida montavam o XI com
 * `sortByPosition(players).slice(0, 11)`. Como a ordenacao vai GOL -> defesa -> meio ->
 * ATAQUE, num elenco de 18+ com muitos defensores os 11 primeiros eram goleiro + zaga +
 * meio, e os ATACANTES sobravam de fora. Resultado: time escalado sem centroavante e, na
 * tela de penalti, so zagueiros/laterais na lista de batedores. Usando a formacao, cada
 * linha (defesa/meio/ataque) recebe a cota certa e o melhor jogador de cada posicao.
 */
export function pickStartingXI<T>(
  players: T[],
  getPos: (p: T) => string,
  getRating: (p: T) => number,
  formation = "4-3-3",
): { starters: T[]; bench: T[] } {
  const byRating = [...players].sort((a, b) => getRating(b) - getRating(a))
  const tagged = byRating.map((p, i) => ({ id: i, position: normalizePosition(getPos(p)), ref: p }))
  // Somente o melhor goleiro participa da alocação do XI. Se faltasse um jogador de
  // linha compatível, o fallback do alocador podia puxar o segundo/terceiro goleiro.
  const bestGoalkeeper = tagged.find(t => t.position === "GOL")
  const eligible = tagged.filter(t =>
    t.position !== "GOL" || t.id === bestGoalkeeper?.id,
  )
  const assigned = assignPlayersToFormation(eligible, formation)
  const chosen = new Set(assigned.map((a) => a.id))
  return {
    starters: assigned.map((a) => a.ref),
    bench: tagged.filter((t) => !chosen.has(t.id)).map((t) => t.ref),
  }
}

/**
 * CONSERTA a escalacao do tecnico em vez de joga-la fora.
 *
 * O relato do jogador: "a escalacao salva volta para a padrao apos a partida".
 * A causa era uma validacao tudo-ou-nada — se os titulares declarados nao fossem
 * EXATAMENTE 11 com EXATAMENTE 1 goleiro, o XI inteiro era descartado e trocado
 * pelo automatico. E a tela entao gravava esse automatico por cima do salvo, o
 * que tornava a perda PERMANENTE.
 *
 * Bastava um evento comum para desequilibrar a conta:
 *  - a conversa com o reserva promete titularidade e cria um 12o titular;
 *  - um titular vendido ou emprestado deixa o XI com 10.
 *
 * Aqui as escolhas do tecnico sao respeitadas ao maximo: sobrando, sai quem tem
 * o menor overall (nunca o unico goleiro); faltando, entra o melhor do banco
 * pelo slot que a formacao pede. So cai no automatico se nao houver XI algum.
 */
export function repararEscalacao<T>(
  declarados: T[],
  disponiveis: T[],
  getPos: (p: T) => string,
  getRating: (p: T) => number,
  formation = "4-3-3",
): { starters: T[]; bench: T[] } | null {
  if (declarados.length === 0) return null

  const ehGol = (p: T) => normalizePosition(getPos(p)) === "GOL"
  const piorPrimeiro = (a: T, b: T) => getRating(a) - getRating(b)
  let xi = [...declarados]

  // 1) Goleiros: mantem so o melhor; os demais voltam ao banco.
  const gols = xi.filter(ehGol).sort((a, b) => getRating(b) - getRating(a))
  if (gols.length > 1) {
    const excedentes = new Set(gols.slice(1))
    xi = xi.filter(p => !excedentes.has(p))
  }

  // 2) Sem goleiro nenhum: chama o melhor do banco (um XI sem goleiro nao joga).
  if (!xi.some(ehGol)) {
    const golBanco = disponiveis
      .filter(p => ehGol(p) && !xi.includes(p))
      .sort((a, b) => getRating(b) - getRating(a))[0]
    if (!golBanco) return null
    if (xi.length >= 11) xi = xi.filter(p => p !== [...xi].sort(piorPrimeiro)[0])
    xi.push(golBanco)
  }

  // 3) Sobrando: corta o de menor overall, preservando sempre o goleiro.
  while (xi.length > 11) {
    const cortavel = xi.filter(p => !ehGol(p)).sort(piorPrimeiro)[0] ?? xi.sort(piorPrimeiro)[0]
    xi = xi.filter(p => p !== cortavel)
  }

  // 4) Faltando: completa com o banco pelos slots que a formacao ainda pede.
  if (xi.length < 11) {
    const noXi = new Set(xi)
    const banco = disponiveis
      .filter(p => !noXi.has(p) && !ehGol(p))
      .sort((a, b) => getRating(b) - getRating(a))
    const faltam = 11 - xi.length
    const completado = assignPlayersToFormation(
      [...xi, ...banco.slice(0, faltam * 3)].map((ref, id) => ({ id, position: normalizePosition(getPos(ref)), ref })),
      formation,
    )
    // O alocador devolve 11 pelos slots; garante que ninguem declarado caia fora.
    const escolhidos = completado.map(a => a.ref as T)
    const perdidos = xi.filter(p => !escolhidos.includes(p))
    xi = [...perdidos, ...escolhidos].slice(0, 11)
    if (xi.length < 11) {
      for (const p of banco) {
        if (xi.length >= 11) break
        if (!xi.includes(p)) xi.push(p)
      }
    }
  }

  if (xi.length !== 11 || xi.filter(ehGol).length !== 1) return null
  const dentro = new Set(xi)
  return { starters: xi, bench: disponiveis.filter(p => !dentro.has(p)) }
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
    if (normalizePosition(getPos(p)) === "GOL") {
      gkSeen++
      if (gkSeen > 1) { surplusGks.push(p); continue }
    }
    kept.push(p)
  }
  return [...kept, ...surplusGks]
}

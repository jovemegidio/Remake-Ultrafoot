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
 * Contador de peneiras desta sessao, para o id do jovem ser unico.
 *
 * `Date.now()` NAO basta: ele tem resolucao de milissegundo e duas geracoes
 * seguidas caem no mesmo ms (medido: 2 de 6 ids ainda colidiam so com o
 * relogio). O contador nao depende de tempo — duas chamadas nunca empatam.
 *
 * O relogio continua no id junto com o contador: o contador zera quando o jogo
 * reabre, e sozinho voltaria a repetir os ids de uma sessao anterior.
 */
let peneirasGeradas = 0

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

  // Selo desta peneira: contador (nunca empata) + relogio (sobrevive ao reinicio).
  const peneira = `${Date.now().toString(36)}${(peneirasGeradas++).toString(36)}`

  // Base do overall e do potencial sobem um pouco com o prestigio do clube.
  const overallFloor = 48 + Math.round((prestige - 50) * 0.12)   // ~48-54
  const potentialCeil = 70 + Math.round((prestige - 50) * 0.30)  // ~70-85

  const out: SquadPlayer[] = []
  for (let i = 0; i < count; i++) {
    const position = pick(POSITIONS)
    const overall = overallFloor + Math.floor(rnd() * 10)          // ~48-64
    // A base e formacao modesta: a MAIORIA tem teto de potencial ~73. Mas ha uma
    // JOIA RARA — chance pequena, maior em clubes de mais prestigio — que nasce
    // com potencial 82-92, como as academias reais volta e meia revelam. Antes o
    // teto era 73 fixo e a UI ainda prometia "joias >=85 sao raras" (promessa
    // morta: nunca aparecia uma).
    const gemChance = 0.03 + Math.max(0, prestige - 55) * 0.004     // ~3% a ~15%
    const potential = rnd() < gemChance
      ? Math.min(92, 82 + Math.floor(rnd() * 11))
      : Math.min(73, Math.max(overall + 6, potentialCeil - 8 + Math.floor(rnd() * 16)))
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
      // ID PRECISA SER ÚNICO ENTRE GERAÇÕES.
      //
      // Era `youth_<time>_<temporada>_<i>` — nada ali distingue uma peneira
      // da outra. Duas gerações do mesmo clube na mesma temporada produziam
      // os MESMOS 6 ids (medido: 6 de 6 colidiam).
      //
      // O estrago aparecia na venda: `receberPorJovem` usa `jovem:<id>` como
      // recibo anti-duplicata, então a segunda venda com um id repetido era
      // barrada em silêncio — o jovem saía da base e o dinheiro NÃO entrava.
      // Era o relato "vendi o jogador e o dinheiro não caiu".
      //
      // Só o relógio não resolve: duas peneiras seguidas caem no mesmo
      // milissegundo (2 de 6 ainda colidiam). Ver `peneirasGeradas`.
      id: `youth_${teamShort}_${season}_${peneira}_${i}`,
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

const YOUTH_MARKET_CLUBS = [
  { key: "ajax", name: "Ajax", prestige: 84 },
  { key: "benfica", name: "Benfica", prestige: 82 },
  { key: "porto", name: "Porto", prestige: 80 },
  { key: "palmeiras", name: "Palmeiras", prestige: 83 },
  { key: "flamengo", name: "Flamengo", prestige: 84 },
  { key: "santos", name: "Santos", prestige: 79 },
  { key: "river", name: "River Plate", prestige: 81 },
  { key: "nacional", name: "Nacional", prestige: 73 },
] as const

/**
 * Mercado mensal de atletas de base pertencentes a outros clubes.
 * A lista é determinística durante quatro semanas para não mudar ao reabrir a tela.
 */
export function generateYouthMarketProspects(season: number, week: number, count = 8): SquadPlayer[] {
  const cycle = Math.floor(Math.max(0, week) / 4)
  return Array.from({ length: count }, (_, index) => {
    const club = YOUTH_MARKET_CLUBS[(hash(`${season}:${cycle}:club:${index}`) % YOUTH_MARKET_CLUBS.length)]
    const generated = generateYouthProspects(
      `${club.key}_market_${cycle}_${index}`,
      season,
      club.prestige,
      1,
    )[0]
    // Clubes cobram mais do que o valor contábil da promessa; joias têm ágio.
    const premium = generated.potential >= 85 ? 1.65 : generated.potential >= 78 ? 1.3 : 1.05
    return {
      ...generated,
      id: `youth_market_${season}_${cycle}_${club.key}_${index}`,
      fromTeam: club.name,
      value: Math.round(generated.value * premium / 50_000) * 50_000,
    }
  }).sort((a, b) => b.potential - a.potential)
}

/**
 * Cria o sucessor de um atleta aposentado. Nome e posição são herdados; a
 * qualidade pode ou não guardar relação com a carreira do veterano.
 */
export function generateRetirementSuccessor(input: {
  name: string
  position: string
  overall: number
  potential: number
  season: number
  nonce?: string
}): SquadPlayer {
  const rnd = mulberry32(hash(`${input.name}:${input.position}:${input.season}:${input.nonce ?? Date.now()}:legado`))
  const similar = rnd() < 0.45
  const age = 14 + Math.floor(rnd() * 4)
  const overall = similar
    ? Math.max(45, Math.min(70, Math.round(input.overall * 0.68) + Math.floor(rnd() * 7) - 3))
    : 45 + Math.floor(rnd() * 20)
  const potential = similar
    ? Math.max(overall + 5, Math.min(94, input.potential + Math.floor(rnd() * 13) - 6))
    : Math.max(overall + 5, 65 + Math.floor(rnd() * 28))
  const base = generateYouthProspects(
    `legacy_${hash(input.name).toString(36)}`,
    input.season + Math.floor(rnd() * 1000),
    Math.max(45, Math.min(90, potential)),
    1,
  )[0]
  const scale = (value?: number) => Math.max(25, Math.min(88, (value ?? overall) + overall - base.overall))
  return {
    ...base,
    id: `legacy_${Date.now()}_${hash(input.name).toString(36)}`,
    name: input.name,
    position: input.position,
    age,
    overall,
    potential,
    value: Math.round((overall * 35_000 + potential * 70_000) / 10_000) * 10_000,
    pace: scale(base.pace),
    shooting: scale(base.shooting),
    passing: scale(base.passing),
    dribbling: scale(base.dribbling),
    defending: scale(base.defending),
    physical: scale(base.physical),
    fromTeam: "Legado de aposentadoria",
    seasonSigned: input.season,
  }
}

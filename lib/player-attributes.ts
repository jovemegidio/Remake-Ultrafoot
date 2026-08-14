// ATRIBUTOS COERENTES COM A POSICAO — e o overall reconciliado com eles.
//
// O que a auditoria achou de irreal:
//   - So a FINALIZACAO respeitava a posicao (shootingForPosition). Os outros
//     cinco atributos saiam como `base +/- 14` cegos a posicao: um centroavante
//     85 podia ter DEFESA 90; um zagueiro nao tinha defesa garantidamente alta.
//   - O overall exibido nao batia com a media dos atributos (gerados em volta do
//     base, sem recomputar).
//
// Este modulo gera os 6 atributos a partir do overall E da posicao, com perfis
// realistas (zagueiro: defesa/fisico altos, finalizacao baixa; atacante o
// inverso), e recomputa o overall a partir dos atributos com o MESMO peso por
// posicao — entao o numero exibido corresponde ao jogador. Puro e testavel.

export type Attrs = {
  pace: number
  shooting: number
  passing: number
  dribbling: number
  defending: number
  physical: number
}

const ATTR_KEYS: (keyof Attrs)[] = ["pace", "shooting", "passing", "dribbling", "defending", "physical"]

/**
 * Normaliza siglas de posicao para uma familia.
 *
 * ⚠️ O `default` e ATACANTE, e isso torna o casamento CRITICO para o GOLEIRO.
 * Antes a comparacao era na string crua: qualquer grafia diferente de "GOL"
 * exatamente — "gol", "GK", "G", "Goleiro", com espaco em volta — caia no perfil
 * de centroavante, que pesa finalizacao 0.36 e defesa 0.02. Como goleiro tem
 * finalizacao ~20, `overallFromAttributes` devolvia um numero muito abaixo do
 * real e o arqueiro aparecia com overall ridiculo (relato: "o Weverton esta com
 * o overall bem baixo"). Clubes sem elenco no seed do Transfermarkt — o Gremio e
 * um deles — tem as posicoes GERADAS, e ai a grafia varia.
 *
 * Agora normalizamos (maiuscula, sem acento, sem pontuacao) e aceitamos os
 * sinonimos de cada familia.
 */
function posFamily(position: string): "GOL" | "ZAG" | "LAT" | "VOL" | "MEI" | "EXT" | "ATA" {
  const p = (position ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().replace(/[^A-Z]/g, "")

  if (["GOL", "GK", "G", "GOLEIRO", "POR", "GOALKEEPER", "GUARDAREDES"].includes(p)) return "GOL"
  if (["ZAG", "ZC", "CB", "DEF", "ZAGUEIRO", "DEFESACENTRAL"].includes(p)) return "ZAG"
  if (["LD", "LE", "ALD", "ALE", "LAT", "ALA", "RB", "LB", "LATERAL"].includes(p)) return "LAT"
  if (["VOL", "MC", "CDM", "CM", "VOLANTE"].includes(p)) return "VOL"
  if (["MEI", "MD", "ME", "CAM", "MEIA"].includes(p)) return "MEI"
  if (["PD", "PE", "LW", "RW", "EXT", "PONTA"].includes(p)) return "EXT"
  return "ATA" // ATA, CA, SA, ST, CF...
}

// Perfil por familia: deslocamento (em pontos) de cada atributo em relacao ao
// overall, E o peso desse atributo no calculo do overall. Deslocamento positivo
// = ponto forte da posicao; negativo = ponto fraco. Os pesos somam ~1 e definem
// quais atributos "fazem" o overall daquela posicao.
interface PosProfile {
  offset: Attrs
  weight: Attrs
}

const PROFILES: Record<ReturnType<typeof posFamily>, PosProfile> = {
  // Goleiro: o "defending" representa a habilidade de goleiro (defesas). Os
  // demais sao baixos e pouco relevantes. Finalizacao/drible irrisorios.
  GOL: {
    offset: { pace: -18, shooting: -55, passing: -8, dribbling: -35, defending: +6, physical: -2 },
    weight: { pace: 0.05, shooting: 0.0, passing: 0.1, dribbling: 0.0, defending: 0.75, physical: 0.1 },
  },
  ZAG: {
    offset: { pace: -6, shooting: -30, passing: -6, dribbling: -16, defending: +9, physical: +7 },
    weight: { pace: 0.12, shooting: 0.02, passing: 0.1, dribbling: 0.04, defending: 0.44, physical: 0.28 },
  },
  LAT: {
    offset: { pace: +8, shooting: -14, passing: +2, dribbling: +2, defending: +2, physical: +1 },
    weight: { pace: 0.24, shooting: 0.05, passing: 0.18, dribbling: 0.16, defending: 0.24, physical: 0.13 },
  },
  VOL: {
    offset: { pace: -2, shooting: -12, passing: +6, dribbling: -2, defending: +8, physical: +6 },
    weight: { pace: 0.1, shooting: 0.06, passing: 0.24, dribbling: 0.12, defending: 0.26, physical: 0.22 },
  },
  MEI: {
    offset: { pace: 0, shooting: +2, passing: +10, dribbling: +8, defending: -12, physical: -6 },
    weight: { pace: 0.12, shooting: 0.16, passing: 0.3, dribbling: 0.24, defending: 0.06, physical: 0.12 },
  },
  EXT: {
    offset: { pace: +10, shooting: +4, passing: +2, dribbling: +11, defending: -18, physical: -6 },
    weight: { pace: 0.24, shooting: 0.2, passing: 0.14, dribbling: 0.28, defending: 0.02, physical: 0.12 },
  },
  ATA: {
    offset: { pace: +6, shooting: +12, passing: -4, dribbling: +6, defending: -22, physical: +2 },
    weight: { pace: 0.2, shooting: 0.36, passing: 0.08, dribbling: 0.18, defending: 0.02, physical: 0.16 },
  },
}

const clamp = (v: number, lo = 20, hi = 99) => Math.max(lo, Math.min(hi, Math.round(v)))

/**
 * Gera os 6 atributos a partir do overall e da posicao, com um ruido pequeno e
 * deterministico (semente = nome+posicao, para o mesmo jogador sair igual). Os
 * atributos ficam coerentes com a posicao, e a media ponderada CORRESPONDE ao
 * overall (ajuste final para reconciliar).
 */
export function attributesFromOverall(overall: number, position: string, seed = ""): Attrs {
  const fam = posFamily(position)
  const prof = PROFILES[fam]
  // Ruido deterministico por atributo (+/-3), para variacao sem bagunca.
  let h = 2166136261
  for (const c of `${seed}:${position}:${overall}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  const ruido = (k: string): number => {
    let x = h
    for (const c of k) x = Math.imul(x ^ c.charCodeAt(0), 16777619)
    return ((x >>> 0) % 7) - 3
  }

  const bruto: Attrs = {
    pace: clamp(overall + prof.offset.pace + ruido("pa")),
    shooting: clamp(overall + prof.offset.shooting + ruido("sh")),
    passing: clamp(overall + prof.offset.passing + ruido("ps")),
    dribbling: clamp(overall + prof.offset.dribbling + ruido("dr")),
    defending: clamp(overall + prof.offset.defending + ruido("df")),
    physical: clamp(overall + prof.offset.physical + ruido("ph")),
  }

  // Reconcilia: ajusta os atributos de PESO relevante para a media ponderada
  // bater com o overall. So mexe nos que importam para a posicao (nao sobe a
  // finalizacao do zagueiro so para fechar a conta).
  const atual = overallFromAttributes(bruto, position)
  const delta = overall - atual
  if (delta !== 0) {
    for (const k of ATTR_KEYS) {
      if (prof.weight[k] >= 0.12) bruto[k] = clamp(bruto[k] + delta)
    }
  }
  return bruto
}

/**
 * Desloca os atributos de PESO relevante da posicao por `delta`, mantendo o
 * perfil (nao mexe na finalizacao do zagueiro). Usado quando o overall muda por
 * envelhecimento/evolucao, para overall e atributos seguirem reconciliados.
 */
export function shiftAttributes(a: Attrs, position: string, delta: number): Attrs {
  if (!delta) return a
  const w = PROFILES[posFamily(position)].weight
  const out = { ...a }
  for (const k of ATTR_KEYS) if (w[k] >= 0.12) out[k] = clamp(out[k] + delta)
  return out
}

/**
 * EVOLUCAO SEPARADA POR ATRIBUTO (1.0.293).
 *
 * `shiftAttributes` soma o MESMO delta em todo atributo relevante da posicao. Na
 * pratica isso fazia o veterano de 36 perder passe na mesma medida em que perdia
 * velocidade, e o jovem ganhar fisico tao rapido quanto tecnica — nenhuma das
 * duas coisas parece futebol.
 *
 * Aqui o delta e DISTRIBUIDO com vies por idade:
 *   - ate 23 crescendo: tecnica e leitura sobem mais rapido que o fisico, que ja
 *     esta perto do limite biologico;
 *   - dos 24 aos 31: crescimento parelho, com leve favorecimento do passe;
 *   - de 32 em diante caindo: as PERNAS vao primeiro (ritmo e fisico), e passe e
 *     defesa quase se seguram — e o veterano que "joga de cabeca".
 *
 * ⚠️ A MEDIA PONDERADA DO RESULTADO CONTINUA SENDO `delta`. Sem essa
 * normalizacao, os atributos e o overall — que quem chama calcula por fora —
 * voltariam a divergir, que e exatamente o defeito que este arquivo nasceu para
 * corrigir. O `overallFromAttributes` e a prova, e o teste cobre.
 */
export function evoluirAtributos(a: Attrs, position: string, delta: number, idade: number): Attrs {
  if (!delta) return a
  const w = PROFILES[posFamily(position)].weight

  const crescendo = delta > 0
  const vies: Attrs = idade <= 23 && crescendo
    ? { pace: 0.7, shooting: 1.2, passing: 1.2, dribbling: 1.25, defending: 1.15, physical: 0.85 }
    : idade >= 32 && !crescendo
      ? { pace: 1.6, shooting: 0.95, passing: 0.45, dribbling: 1.15, defending: 0.6, physical: 1.5 }
      : { pace: 0.95, shooting: 1.0, passing: 1.1, dribbling: 1.0, defending: 1.05, physical: 0.95 }

  // Normaliza para a media ponderada bater `delta` exatamente.
  const somaPesos = ATTR_KEYS.reduce((s, k) => s + w[k], 0)
  const somaViesada = ATTR_KEYS.reduce((s, k) => s + w[k] * vies[k], 0)
  const escala = somaViesada > 0 ? somaPesos / somaViesada : 1

  const out = { ...a }
  for (const k of ATTR_KEYS) {
    // O corte de peso continua: nao se mexe na finalizacao do zagueiro.
    if (w[k] < 0.12) continue
    out[k] = clamp(out[k] + Math.round(delta * vies[k] * escala))
  }
  return out
}

/** Overall a partir dos atributos, com o peso da POSICAO — o inverso coerente
 *  de attributesFromOverall. Um zagueiro vale pela defesa/fisico; um atacante
 *  pela finalizacao/velocidade. */
export function overallFromAttributes(a: Attrs, position: string): number {
  const w = PROFILES[posFamily(position)].weight
  const soma = ATTR_KEYS.reduce((s, k) => s + a[k] * w[k], 0)
  const pesoTotal = ATTR_KEYS.reduce((s, k) => s + w[k], 0)
  return clamp(soma / (pesoTotal || 1))
}

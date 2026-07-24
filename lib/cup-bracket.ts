// CHAVEAMENTO DE COPA — o caminho real do clube dentro de cada competição.
//
// O que existia antes: `generateUserCupMatches` agendava N adversários sorteados
// (5 para copa nacional, 6 ou 8 para continental) sem fase, sem chaveamento e
// sem eliminação. O clube jogava a mesma quantidade de partidas ganhando ou
// perdendo, e o calendário não sabia dizer se aquilo era oitavas ou final.
//
// Aqui o caminho vem do REGULAMENTO: cada etapa sabe se é confronto de jogo
// único, de ida e volta, ou fase de grupos. Quem perde uma etapa não tem as
// seguintes no calendário — e é isso que torna a final uma conquista.
//
// (Existe um `lib/cup-engine.ts` com um chaveamento de 16/8 clubes, mas ele
// nunca foi ligado à geração de partidas — só uma função auxiliar dele é
// importada em uma tela. Este módulo é o caminho que o jogo de fato usa.)

import type { Team } from "@/lib/teams-data"

export type FaseCopa =
  | "primeira_fase" | "segunda_fase" | "terceira_fase" | "quarta_fase" | "quinta_fase"
  | "fase_grupos" | "playoff" | "oitavas" | "quartas" | "semifinal" | "final"

export interface EtapaCopa {
  stage: FaseCopa
  /** Confronto: 1 = jogo único, 2 = ida e volta. Grupo: total de partidas. */
  jogos: number
  tipo: "confronto" | "grupo"
}

const confronto = (stage: FaseCopa, jogos: 1 | 2): EtapaCopa => ({ stage, jogos, tipo: "confronto" })
const grupo = (jogos: number): EtapaCopa => ({ stage: "fase_grupos", jogos, tipo: "grupo" })

/**
 * COPA DO BRASIL 2026 (CBF): 126 clubes em 9 fases. Da 1ª à 4ª é jogo único; da
 * 5ª às semifinais é ida e volta; a FINAL é jogo único. Os 20 clubes da Série A
 * entram direto na 5ª fase.
 */
function copaDoBrasil(entraTarde: boolean): EtapaCopa[] {
  const finais: EtapaCopa[] = [
    confronto("quinta_fase", 2),
    confronto("oitavas", 2),
    confronto("quartas", 2),
    confronto("semifinal", 2),
    confronto("final", 1),
  ]
  if (entraTarde) return finais
  return [
    confronto("primeira_fase", 1),
    confronto("segunda_fase", 1),
    confronto("terceira_fase", 1),
    confronto("quarta_fase", 1),
    ...finais,
  ]
}

/** Libertadores: 8 grupos de 4 (6 jogos), mata-mata em ida e volta, final única. */
const LIBERTADORES: EtapaCopa[] = [
  grupo(6),
  confronto("oitavas", 2),
  confronto("quartas", 2),
  confronto("semifinal", 2),
  confronto("final", 1),
]

/** Sul-Americana: grupos, playoff antes das oitavas, final única. */
const SULAMERICANA: EtapaCopa[] = [
  grupo(6),
  confronto("playoff", 2),
  confronto("oitavas", 2),
  confronto("quartas", 2),
  confronto("semifinal", 2),
  confronto("final", 1),
]

/** Champions/Europa: liga única (8 jogos), playoff do 9º ao 24º, final única. */
const LIGA_EUROPEIA = (jogosDaLiga: number): EtapaCopa[] => [
  grupo(jogosDaLiga),
  confronto("playoff", 2),
  confronto("oitavas", 2),
  confronto("quartas", 2),
  confronto("semifinal", 2),
  confronto("final", 1),
]

/** Copas europeias nacionais: mata-mata de jogo único até a final. */
const COPA_JOGO_UNICO: EtapaCopa[] = [
  confronto("oitavas", 1),
  confronto("quartas", 1),
  confronto("semifinal", 1),
  confronto("final", 1),
]

/** Supercopa: decisão em partida única. */
const SUPERCOPA: EtapaCopa[] = [confronto("final", 1)]

/**
 * Caminho do clube na competição. `entraTarde` = clube de primeira divisão, que
 * na Copa do Brasil pula as quatro fases iniciais.
 */
export function caminhoDaCopa(
  competicaoId: string,
  nome: string,
  competitionType: "cup" | "continental",
  entraTarde: boolean,
): EtapaCopa[] {
  const id = `${competicaoId} ${nome}`.toLowerCase()

  // RECOPA e ida e volta (o catalogo ja dizia matchCount 2, mas o regex de
  // "supercopa" a capturava antes e ela virava jogo unico).
  if (/recopa/.test(id)) return [confronto("final", 2)]
  // COPA INTERCONTINENTAL: anual, entre os campeoes continentais. O clube das
  // Americas/Europa entra direto na decisao; os demais vem de uma eliminatoria.
  if (/intercontinental/.test(id)) return [confronto("semifinal", 1), confronto("final", 1)]
  // MUNDIAL DE CLUBES no formato de 32: fase de grupos de 3 jogos e mata-mata
  // ate a final, tudo em jogo unico (como o torneio real). Antes caia no
  // fallback de copa nacional e virava um mata-mata de 4 jogos.
  if (/mundial/.test(id)) {
    return [
      grupo(3),
      confronto("oitavas", 1),
      confronto("quartas", 1),
      confronto("semifinal", 1),
      confronto("final", 1),
    ]
  }
  if (/supercopa|supercup|super cup/.test(id)) return SUPERCOPA
  if (/copa do brasil|copa_brasil/.test(id)) return copaDoBrasil(entraTarde)
  if (/libertadores/.test(id)) return LIBERTADORES
  if (/sul-?americana|sudamericana/.test(id)) return SULAMERICANA
  if (/champions|europa league/.test(id)) return LIGA_EUROPEIA(8)
  if (/conference/.test(id)) return LIGA_EUROPEIA(6)

  // Copas regionais brasileiras (Nordeste, Verde) usam grupos + mata-mata.
  if (/nordeste|verde/.test(id)) {
    return [grupo(6), confronto("quartas", 1), confronto("semifinal", 1), confronto("final", 2)]
  }

  if (competitionType === "continental") return LIBERTADORES
  return COPA_JOGO_UNICO
}

// ── Resolução de confronto ────────────────────────────────────────────────

export interface PlacarDaCopa {
  /** Gols do clube do usuário na partida. */
  golsPro: number
  golsContra: number
}

/** Aleatório determinístico: a mesma disputa dá sempre o mesmo resultado. */
function rngDeterministico(semente: string): () => number {
  let h = 2166136261
  for (let i = 0; i < semente.length; i++) {
    h ^= semente.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h += 0x6d2b79f5
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * O clube passou pelo confronto? Soma os gols das partidas disputadas; empate no
 * agregado vai para os pênaltis, decididos de forma determinística (a mesma
 * carreira nunca muda de resultado ao recarregar a tela).
 *
 * `null` = confronto ainda não terminou.
 */
export function passouNoConfronto(
  placares: readonly PlacarDaCopa[],
  jogosDoConfronto: number,
  semente: string,
): boolean | null {
  if (placares.length < jogosDoConfronto) return null
  const pro = placares.reduce((s, p) => s + p.golsPro, 0)
  const contra = placares.reduce((s, p) => s + p.golsContra, 0)
  if (pro !== contra) return pro > contra
  // Pênaltis: moeda levemente honesta, sem favorecer o usuário.
  return rngDeterministico(`penaltis:${semente}`)() >= 0.5
}

/**
 * O clube passou da fase de grupos? Monta a tabela do grupo: os pontos do
 * usuário saem das partidas de verdade; os dos outros três saem de uma
 * simulação determinística ponderada pelo prestígio. Passam os dois primeiros.
 *
 * `null` = grupo ainda não terminou.
 */
export function passouNoGrupo(
  placares: readonly PlacarDaCopa[],
  jogosDoGrupo: number,
  adversarios: readonly Team[],
  prestigioDoUsuario: number,
  semente: string,
): boolean | null {
  if (placares.length < jogosDoGrupo) return null

  const pontosUsuario = placares.reduce((s, p) => s + (p.golsPro > p.golsContra ? 3 : p.golsPro === p.golsContra ? 1 : 0), 0)
  const saldoUsuario = placares.reduce((s, p) => s + p.golsPro - p.golsContra, 0)

  const rng = rngDeterministico(`grupo:${semente}`)
  // Cada rival joga 4 partidas entre si (os outros dois, ida e volta). A força
  // relativa ao usuário desloca a média de pontos: rival mais forte pontua mais.
  const tabela = adversarios.map(adv => {
    const forca = (adv.prestigio ?? 60) - prestigioDoUsuario
    const media = 4 + forca * 0.06        // ~4 pontos em 4 jogos entre iguais
    const pontos = Math.max(0, Math.round(media + (rng() - 0.5) * 4))
    return { curto: adv.curto, pontos, saldo: Math.round((rng() - 0.5) * 6) }
  })

  // Só contam os pontos que os rivais fizeram ENTRE SI; os que fizeram contra o
  // usuário ja estao nos placares dele e sao somados aqui para nao contar duas vezes.
  for (const [i, p] of placares.entries()) {
    const alvo = tabela[i % Math.max(1, tabela.length)]
    if (!alvo) continue
    alvo.pontos += p.golsContra > p.golsPro ? 3 : p.golsPro === p.golsContra ? 1 : 0
    alvo.saldo += p.golsContra - p.golsPro
  }

  const melhoresQueOUsuario = tabela.filter(t =>
    t.pontos > pontosUsuario || (t.pontos === pontosUsuario && t.saldo > saldoUsuario),
  ).length

  return melhoresQueOUsuario < 2   // passam os dois primeiros
}

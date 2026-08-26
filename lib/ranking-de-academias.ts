/**
 * RANKING DE ACADEMIAS E O TORNEIO INTERNACIONAL DE BASE (1.0.377).
 *
 * ─── O QUE FALTAVA, E POR QUE ISSO IMPORTAVA ────────────────────────────────
 *
 * A carreira de base ganhou calendário, tabela, copa, titulares, propostas para
 * o profissional e legado de atletas (1.0.351 → 1.0.374). Ela funciona. Mas ela
 * terminava a temporada respondendo apenas "como foi o seu ano" — nunca "onde
 * você está entre as outras academias".
 *
 * ⚠️ E ESSA É A PERGUNTA QUE UM TÉCNICO DE BASE FAZ. O trabalho dele não é
 * ganhar o Brasileirão Sub-20 de um ano: é construir uma academia que forma
 * gente por uma década. Sem uma medida entre clubes, formar três jogadores para
 * a seleção e formar nenhum davam exatamente a mesma tela no fim do ano.
 *
 * ─── COMO O RANKING É CALCULADO, E POR QUE NÃO É SÓ PRESTÍGIO ───────────────
 *
 * Prestígio é do CLUBE; academia é outra coisa. Existem clubes médios que são
 * potências de formação e gigantes que compram tudo pronto — e um ranking que
 * fosse só prestígio ordenado apagaria justamente o espaço onde o jogador de
 * base pode vencer. Por isso o prestígio entra como base e é corrigido por
 * três coisas que a academia controla:
 *
 *   INFRAESTRUTURA   o nível da academia (`nivelAcademia`, o que o clube pagou).
 *   FORMAÇÃO         quantos garotos daquela academia chegaram ao profissional.
 *   RESULTADO        títulos de base e a campanha da temporada.
 *
 * ⚠️ AS ACADEMIAS DA IA SÃO SEMEADAS, NÃO SORTEADAS. A mesma liga dá o mesmo
 * ranking em qualquer save e em qualquer máquina, e ele muda ao longo das
 * temporadas por acumulação — não por um dado novo a cada abertura de tela.
 * Um ranking que embaralha sozinho não é uma classificação: é ruído.
 *
 * ─── O TORNEIO INTERNACIONAL ────────────────────────────────────────────────
 *
 * `formatosDeBase(pais)` já entrega as competições nacionais de cada país. O
 * que não existia era um torneio ACIMA delas — e é ele que dá à academia um
 * objetivo que atravessa temporadas: só entra quem está entre as melhores do
 * ranking. Ver `vagaNoTorneioInternacional`.
 */

import type { Team } from "@/lib/teams-data"

export interface EntradaDoRankingDeAcademias {
  clubeCurto: string
  clubeNome: string
  fileKey: string
  pais: string
  /** 0–100. É a nota da ACADEMIA, não do clube. */
  nota: number
  posicao: number
  /** Quantos formados chegaram ao profissional, na conta do ranking. */
  formados: number
  titulosDeBase: number
  /** A academia do jogador. */
  minha?: boolean
  /** Quanto a nota mudou desde a temporada anterior. */
  variacao?: number
}

/** Hash semeado — mesma liga, mesmo ranking, em qualquer máquina. */
function hash(texto: string): number {
  let h = 2166136261
  for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 16777619) }
  h ^= h >>> 16
  h = Math.imul(h, 2246822507)
  h ^= h >>> 13
  h = Math.imul(h, 3266489909)
  h ^= h >>> 16
  return h >>> 0
}

const entre = (semente: string, min: number, max: number) => min + (hash(semente) % 1000) / 1000 * (max - min)

export interface MinhaAcademia {
  clubeCurto: string
  clubeNome: string
  fileKey: string
  pais: string
  nivelAcademia: number
  /** `alumni.length` — quem saiu daqui para o profissional. */
  formados: number
  titulosDeBase: number
  /** Campanha da temporada corrente: aproveitamento 0–100. */
  aproveitamento: number
  temporada: number
}

/**
 * A NOTA DE UMA ACADEMIA.
 *
 * ⚠️ O TETO DE FORMAÇÃO É 26 PONTOS DE PROPÓSITO. Sem teto, uma carreira de
 * vinte temporadas acumularia formados até a nota estourar e o ranking virar
 * "quem jogou mais tempo" — que é exatamente o que um ranking não pode medir.
 * Com teto, chega um ponto em que subir exige melhorar a academia e ganhar,
 * não apenas continuar existindo.
 */
export function notaDaAcademia(a: {
  prestigio: number
  nivelAcademia: number
  formados: number
  titulosDeBase: number
  aproveitamento: number
}): number {
  const base = Math.max(0, Math.min(100, a.prestigio)) * 0.34
  const infra = Math.max(0, Math.min(10, a.nivelAcademia)) * 2.6
  const formacao = Math.min(26, a.formados * 2.4)
  const troféus = Math.min(18, a.titulosDeBase * 4.5)
  const campanha = Math.max(0, Math.min(100, a.aproveitamento)) * 0.12
  return Math.round(Math.max(0, Math.min(100, base + infra + formacao + troféus + campanha)) * 10) / 10
}

/**
 * O RANKING DA DIVISÃO — as academias rivais, mais a sua.
 *
 * As rivais não têm estado guardado (seria save inflado por dado derivável),
 * então formados e títulos delas saem do hash do clube + temporada: estáveis
 * dentro de uma temporada, evoluindo devagar entre elas.
 */
export function rankingDeAcademias(
  clubesDaDivisao: readonly Team[],
  minha: MinhaAcademia,
): EntradaDoRankingDeAcademias[] {
  const linhas: EntradaDoRankingDeAcademias[] = []

  for (const clube of clubesDaDivisao) {
    if (clube.curto === minha.clubeCurto) continue
    const prestigio = Number(clube.prestigio ?? 50)
    // ⚠️ A ACADEMIA DA IA ACOMPANHA O CLUBE, MAS NÃO É O CLUBE. O desvio de
    // ±2,5 níveis é o que permite existir a potência de formação de porte médio
    // e o gigante que não forma — sem ele, o ranking seria a tabela de
    // prestígio com outro título.
    const nivel = Math.max(1, Math.min(10, Math.round(prestigio / 14 + entre(`${clube.file_key}:infra`, -2.5, 2.5))))
    const formados = Math.round(entre(`${clube.file_key}:${minha.temporada}:form`, 0, 3) + nivel * 0.9)
    const titulos = Math.floor(entre(`${clube.file_key}:${minha.temporada}:tit`, 0, 1 + nivel / 4))
    const aproveitamento = Math.round(entre(`${clube.file_key}:${minha.temporada}:apr`, 25, 78))

    linhas.push({
      clubeCurto: clube.curto,
      clubeNome: clube.nome,
      fileKey: clube.file_key,
      pais: String(clube.pais ?? minha.pais),
      nota: notaDaAcademia({ prestigio, nivelAcademia: nivel, formados, titulosDeBase: titulos, aproveitamento }),
      posicao: 0,
      formados,
      titulosDeBase: titulos,
    })
  }

  const clubeDoUsuario = clubesDaDivisao.find(c => c.curto === minha.clubeCurto)
  linhas.push({
    clubeCurto: minha.clubeCurto,
    clubeNome: minha.clubeNome,
    fileKey: minha.fileKey,
    pais: minha.pais,
    nota: notaDaAcademia({
      prestigio: Number(clubeDoUsuario?.prestigio ?? 50),
      nivelAcademia: minha.nivelAcademia,
      formados: minha.formados,
      titulosDeBase: minha.titulosDeBase,
      aproveitamento: minha.aproveitamento,
    }),
    posicao: 0,
    formados: minha.formados,
    titulosDeBase: minha.titulosDeBase,
    minha: true,
  })

  return linhas
    .sort((a, b) => b.nota - a.nota || a.clubeNome.localeCompare(b.clubeNome))
    .map((l, i) => ({ ...l, posicao: i + 1 }))
}

/** Onde a minha academia está. Atalho para a tela não refiltrar a lista. */
export function minhaPosicao(ranking: EntradaDoRankingDeAcademias[]): EntradaDoRankingDeAcademias | null {
  return ranking.find(r => r.minha) ?? null
}

export function faixaDaAcademia(nota: number): { texto: string; tom: "elite" | "forte" | "media" | "fraca" } {
  if (nota >= 72) return { texto: "Celeiro de craques", tom: "elite" }
  if (nota >= 55) return { texto: "Academia de referência", tom: "forte" }
  if (nota >= 36) return { texto: "Formação regular", tom: "media" }
  return { texto: "Academia em construção", tom: "fraca" }
}

// ═══════════════════════════════════════════════════════════════════════════
// O TORNEIO INTERNACIONAL
// ═══════════════════════════════════════════════════════════════════════════

export interface TorneioInternacionalDeBase {
  nome: string
  /** Quantas academias entram. */
  participantes: number
  /** Posição máxima no ranking da divisão que ainda dá vaga. */
  corte: number
  fases: { nome: string; jogos: number }[]
  /** Prêmio em prestígio de academia por levantar a taça. */
  bonusDeNota: number
  descricao: string
}

/**
 * OS TRÊS TORNEIOS, por nível de academia.
 *
 * ⚠️ TRÊS E NÃO UM, porque uma competição internacional única com corte no
 * top-4 tornaria o objetivo inalcançável para quem começa numa academia
 * pequena — e a carreira de base é justamente o modo em que se começa pequeno.
 * Aqui existe sempre um degrau logo acima do jogador: quem está em 14º persegue
 * a Copa Continental, quem entrou nela persegue a Mundial de Clubes Sub-20.
 */
export const TORNEIOS_INTERNACIONAIS_DE_BASE: TorneioInternacionalDeBase[] = [
  {
    nome: "Copa Continental Sub-20",
    participantes: 16,
    corte: 12,
    fases: [
      { nome: "Fase de grupos", jogos: 3 },
      { nome: "Quartas de final", jogos: 1 },
      { nome: "Semifinal", jogos: 1 },
      { nome: "Final", jogos: 1 },
    ],
    bonusDeNota: 4,
    descricao: "As melhores academias do continente. Porta de entrada do calendário internacional.",
  },
  {
    nome: "Liga dos Campeões Sub-20",
    participantes: 24,
    corte: 6,
    fases: [
      { nome: "Fase de grupos", jogos: 4 },
      { nome: "Oitavas de final", jogos: 1 },
      { nome: "Quartas de final", jogos: 1 },
      { nome: "Semifinal", jogos: 1 },
      { nome: "Final", jogos: 1 },
    ],
    bonusDeNota: 7,
    descricao: "Só quem está entre as seis melhores academias da divisão entra.",
  },
  {
    nome: "Mundial de Clubes Sub-20",
    participantes: 8,
    corte: 2,
    fases: [
      { nome: "Quartas de final", jogos: 1 },
      { nome: "Semifinal", jogos: 1 },
      { nome: "Final", jogos: 1 },
    ],
    bonusDeNota: 11,
    descricao: "Oito academias, oito continentes. O teto do calendário de base.",
  },
]

export interface VagaInternacional {
  torneio: TorneioInternacionalDeBase
  /** Verdadeiro quando a academia se classificou. */
  classificada: boolean
  /** Quantas posições faltam no ranking. */
  faltamPosicoes: number
}

/**
 * EM QUE TORNEIOS A MINHA ACADEMIA ENTRA — e quanto falta para os outros.
 *
 * ⚠️ ELE DEVOLVE OS TRÊS, INCLUSIVE OS NÃO ALCANÇADOS. Mostrar só o que já foi
 * conquistado esconde do jogador o próximo degrau, que é a única informação que
 * o faz continuar melhorando a academia. É a mesma decisão das insígnias do
 * treinador: progresso à vista, nunca cadeado mudo.
 */
export function vagaNoTorneioInternacional(posicaoNoRanking: number): VagaInternacional[] {
  return TORNEIOS_INTERNACIONAIS_DE_BASE.map(torneio => ({
    torneio,
    classificada: posicaoNoRanking > 0 && posicaoNoRanking <= torneio.corte,
    faltamPosicoes: Math.max(0, posicaoNoRanking - torneio.corte),
  }))
}

/** Quanto uma campanha internacional soma à nota da academia. */
export function bonusDaCampanhaInternacional(
  torneio: TorneioInternacionalDeBase,
  faseAlcancada: string,
): number {
  const indice = torneio.fases.findIndex(f => f.nome === faseAlcancada)
  if (indice < 0) return 0
  const fracao = (indice + 1) / torneio.fases.length
  return Math.round(torneio.bonusDeNota * fracao * 10) / 10
}

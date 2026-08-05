// DATAS REAIS das competicoes de 2026. O jogo e por SEMANA (nao por dia do
// calendario), entao estas datas sao METADADO de exibicao — a Copa do Mundo cai
// na janela de junho/julho do motor, e aqui mostramos o periodo real ao jogador.
//
// Pedido do usuario: "a copa do mundo foi de 11 jun a 19 jul 2026, essas coisas
// tem que ficar configurado". Fontes conferidas (jul/2026):
//   Copa do Mundo FIFA 2026 ..... 11/jun – 19/jul (EUA, Mexico, Canada)
//   Libertadores 2026 ........... final 28/nov em Montevideu (CONMEBOL)
//   Sul-Americana 2026 .......... final 21/nov (CONMEBOL)
//   Copa do Brasil 2026 ......... 17/fev – 06/dez (CBF)
//   Champions League 2025/26 .... final 30/mai/2026 em Budapeste (UEFA)
//   Europa League 2025/26 ....... final 20/mai/2026 (UEFA)
//   Conference League 2025/26 ... final 27/mai/2026 (UEFA)
//   Intercontinental FIFA ....... primeira semana de dezembro (por isso ~)
// As competicoes da UEFA sao a edicao 2025/26 (final em maio/2026), que e a que
// se encerra dentro da temporada do jogo. Onde a data exata ainda nao saiu, fica
// a estimativa (marcada com ~).
//
// A tela de competicoes usa ids genericos ("libertadores", "copa-do-brasil")
// com NOMES dinamicos (Champions League para clube europeu etc.), entao o
// casamento e por NOME — indexando as regulations (que ja tem data para o
// futebol domestico) + as internacionais abaixo.

import { COMPETITION_REGULATIONS_2026 } from "@/lib/competition-regulations-2026"

export interface PeriodoCompeticao {
  startsOn: string // ISO YYYY-MM-DD
  endsOn: string
  /** true quando a data exata do fim ainda nao foi divulgada (estimativa). */
  aproximado?: boolean
}

// Marquee internacionais/continentais que NAO estao nas regulations com data.
// `nomes` sao os rotulos como aparecem na UI (para o casamento por nome).
const INTERNACIONAIS: { id: string; nomes: string[]; periodo: PeriodoCompeticao }[] = [
  { id: "copa_mundo", nomes: ["Copa do Mundo", "Copa do Mundo FIFA"], periodo: { startsOn: "2026-06-11", endsOn: "2026-07-19" } },
  { id: "libertadores", nomes: ["CONMEBOL Libertadores", "Libertadores", "Copa Libertadores"], periodo: { startsOn: "2026-02-04", endsOn: "2026-11-28" } },
  { id: "sulamericana", nomes: ["CONMEBOL Sul-Americana", "Sul-Americana", "Copa Sul-Americana"], periodo: { startsOn: "2026-03-03", endsOn: "2026-11-21" } },
  // UEFA: edicao 2025/26, que se encerra em maio/2026 (finais confirmadas).
  { id: "champions_league", nomes: ["UEFA Champions League", "Champions League"], periodo: { startsOn: "2025-09-16", endsOn: "2026-05-30" } },
  { id: "europa_league", nomes: ["UEFA Europa League", "Europa League"], periodo: { startsOn: "2025-09-24", endsOn: "2026-05-20" } },
  { id: "conference_league", nomes: ["UEFA Conference League", "Conference League"], periodo: { startsOn: "2025-10-02", endsOn: "2026-05-27" } },
  // Intercontinental: final normalmente na 1a semana de dezembro (data movel).
  { id: "copa_intercontinental", nomes: ["Copa Intercontinental", "Mundial de Clubes FIFA"], periodo: { startsOn: "2026-12-01", endsOn: "2026-12-10", aproximado: true } },

  // ── Ligas europeias (temporada 2025/26; ULTIMA RODADA informada) ─────────
  // Nao tem final unica — sao decididas pela classificacao. O inicio (ago/2025)
  // e o padrao dessas ligas; a data que importa, o encerramento, veio na fonte.
  { id: "premier_league", nomes: ["Premier League"], periodo: { startsOn: "2025-08-15", endsOn: "2026-05-24" } },
  { id: "la_liga", nomes: ["La Liga", "LaLiga"], periodo: { startsOn: "2025-08-15", endsOn: "2026-05-24" } },
  { id: "serie_a_ita", nomes: ["Serie A"], periodo: { startsOn: "2025-08-23", endsOn: "2026-05-24" } },
  { id: "bundesliga", nomes: ["Bundesliga"], periodo: { startsOn: "2025-08-22", endsOn: "2026-05-16" } },
  { id: "ligue_1", nomes: ["Ligue 1"], periodo: { startsOn: "2025-08-15", endsOn: "2026-05-16" } },
  { id: "primeira_liga", nomes: ["Primeira Liga", "Liga Portugal"], periodo: { startsOn: "2025-08-08", endsOn: "2026-05-16" } },
  { id: "eredivisie", nomes: ["Eredivisie"], periodo: { startsOn: "2025-08-08", endsOn: "2026-05-17" } },

  // ── Copas nacionais europeias (FINAL informada) ──────────────────────────
  { id: "fa_cup", nomes: ["FA Cup"], periodo: { startsOn: "2025-11-01", endsOn: "2026-05-16" } },
  { id: "copa_del_rey", nomes: ["Copa del Rey"], periodo: { startsOn: "2025-10-29", endsOn: "2026-04-18" } },
  { id: "coppa_italia", nomes: ["Coppa Italia"], periodo: { startsOn: "2025-08-15", endsOn: "2026-05-13" } },
  { id: "dfb_pokal", nomes: ["DFB-Pokal"], periodo: { startsOn: "2025-08-15", endsOn: "2026-05-23" } },
  { id: "coupe_de_france", nomes: ["Coupe de France", "Copa da Franca"], periodo: { startsOn: "2025-11-14", endsOn: "2026-05-22" } },
  { id: "taca_portugal", nomes: ["Taca de Portugal", "Taça de Portugal"], periodo: { startsOn: "2025-09-12", endsOn: "2026-05-24" } },
  { id: "knvb_beker", nomes: ["KNVB Beker"], periodo: { startsOn: "2025-08-29", endsOn: "2026-04-19" } },
]

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]

const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

// Indice por id (regulations + internacionais).
const porId = new Map<string, PeriodoCompeticao>()
// Indice por nome normalizado.
const porNome = new Map<string, PeriodoCompeticao>()

for (const reg of Object.values(COMPETITION_REGULATIONS_2026)) {
  if (reg.startsOn && reg.endsOn) {
    const p: PeriodoCompeticao = { startsOn: reg.startsOn, endsOn: reg.endsOn }
    porId.set(reg.id, p)
    porNome.set(norm(reg.name), p)
  }
}
for (const item of INTERNACIONAIS) {
  porId.set(item.id, item.periodo)
  for (const nome of item.nomes) porNome.set(norm(nome), item.periodo)
}

/** Periodo real da competicao em 2026 por id (regulamento ou internacional). */
export function periodo2026(competitionId: string): PeriodoCompeticao | null {
  return porId.get(competitionId) ?? null
}

/** Periodo real por NOME de exibicao (o que a tela de competicoes tem em maos). */
export function periodo2026PorNome(nome: string): PeriodoCompeticao | null {
  return porNome.get(norm(nome)) ?? null
}

/** Temporada de referencia das datas cadastradas neste arquivo. */
export const TEMPORADA_DAS_DATAS = 2026

function rotuloData(iso: string, comAno: boolean, deslocamento: number): string {
  const [a, m, d] = iso.split("-").map(Number)
  return `${d} ${MESES[(m ?? 1) - 1]}${comAno ? ` ${(a ?? TEMPORADA_DAS_DATAS) + deslocamento}` : ""}`
}

function formatar(p: PeriodoCompeticao, deslocamento: number): string {
  const mesmoAno = p.startsOn.slice(0, 4) === p.endsOn.slice(0, 4)
  return `${p.aproximado ? "~" : ""}${rotuloData(p.startsOn, !mesmoAno, deslocamento)} – ${rotuloData(p.endsOn, true, deslocamento)}`
}

/**
 * ⚠️ O ANO ACOMPANHA A TEMPORADA.
 *
 * As datas aqui sao as REAIS de 2026 e eram exibidas cruas: na temporada 2027 a
 * tela continuava anunciando "11 jun – 19 jul 2026", uma data no passado. Como
 * isto e metadado de EXIBICAO (o motor e por semana), deslocar o ano pela
 * temporada mantem o que e util — o mes em que a competicao acontece — e para
 * de mentir o ano. Dia e mes ficam como estao: uma liga comeca praticamente no
 * mesmo periodo todo ano.
 */
function deslocamentoDe(season?: number): number {
  if (!season || !Number.isFinite(season)) return 0
  return season - TEMPORADA_DAS_DATAS
}

/** "11 jun – 19 jul 2026" (mesmo ano) ou "15 set 2026 – 29 mai 2027". Por id. */
export function periodoLabel(competitionId: string, season?: number): string | null {
  const p = periodo2026(competitionId)
  return p ? formatar(p, deslocamentoDe(season)) : null
}

/** Idem, mas casando pelo NOME de exibicao. */
export function periodoLabelPorNome(nome: string, season?: number): string | null {
  const p = periodo2026PorNome(nome)
  return p ? formatar(p, deslocamentoDe(season)) : null
}

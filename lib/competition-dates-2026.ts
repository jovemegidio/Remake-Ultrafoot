// DATAS REAIS das competicoes de 2026. O jogo e por SEMANA (nao por dia do
// calendario), entao estas datas sao METADADO de exibicao — a Copa do Mundo cai
// na janela de junho/julho do motor, e aqui mostramos o periodo real ao jogador.
//
// Pedido do usuario: "a copa do mundo foi de 11 jun a 19 jul 2026, essas coisas
// tem que ficar configurado". Fontes conferidas (jul/2026):
//   Copa do Mundo FIFA 2026 ..... 11/jun – 19/jul (EUA, Mexico, Canada)
//   Libertadores 2026 ........... final 28/nov em Montevideu (CONMEBOL)
//   Copa do Brasil 2026 ......... 17/fev – 06/dez (CBF)
//   Champions League 2025/26 .... final 30/mai/2026 em Budapeste (UEFA)
// Onde a data exata do fim ainda nao saiu, fica a estimativa do calendario da
// entidade (marcada com ~).
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
  { id: "sulamericana", nomes: ["CONMEBOL Sul-Americana", "Sul-Americana", "Copa Sul-Americana"], periodo: { startsOn: "2026-03-03", endsOn: "2026-11-21", aproximado: true } },
  { id: "champions_league", nomes: ["UEFA Champions League", "Champions League"], periodo: { startsOn: "2026-09-15", endsOn: "2027-05-29", aproximado: true } },
  { id: "europa_league", nomes: ["UEFA Europa League", "Europa League"], periodo: { startsOn: "2026-09-24", endsOn: "2027-05-26", aproximado: true } },
  { id: "conference_league", nomes: ["UEFA Conference League", "Conference League"], periodo: { startsOn: "2026-10-01", endsOn: "2027-05-26", aproximado: true } },
  { id: "copa_intercontinental", nomes: ["Copa Intercontinental", "Mundial de Clubes FIFA"], periodo: { startsOn: "2026-12-09", endsOn: "2026-12-16", aproximado: true } },
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

function rotuloData(iso: string, comAno: boolean): string {
  const [a, m, d] = iso.split("-").map(Number)
  return `${d} ${MESES[(m ?? 1) - 1]}${comAno ? ` ${a}` : ""}`
}

function formatar(p: PeriodoCompeticao): string {
  const mesmoAno = p.startsOn.slice(0, 4) === p.endsOn.slice(0, 4)
  return `${p.aproximado ? "~" : ""}${rotuloData(p.startsOn, !mesmoAno)} – ${rotuloData(p.endsOn, true)}`
}

/** "11 jun – 19 jul 2026" (mesmo ano) ou "15 set 2026 – 29 mai 2027". Por id. */
export function periodoLabel(competitionId: string): string | null {
  const p = periodo2026(competitionId)
  return p ? formatar(p) : null
}

/** Idem, mas casando pelo NOME de exibicao. */
export function periodoLabelPorNome(nome: string): string | null {
  const p = periodo2026PorNome(nome)
  return p ? formatar(p) : null
}

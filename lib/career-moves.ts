"use client"

// Ciclo de carreira do TECNICO: propostas de outros clubes e pedido de demissao.
//
// O que a auditoria encontrou:
//   - `generateJobOffers()` (lib/board-engine.ts) estava escrita, completa... e NUNCA era
//     chamada. Codigo morto: nenhum clube jamais procurava o tecnico, por melhor que
//     fosse a campanha. O ciclo "performar -> ser cortejado -> subir de patamar" nunca
//     fechava.
//   - "Pedir demissao" nao existia. So havia o TIPO (`endReason: "resigned"` no hall da
//     fama); a acao nunca foi implementada, entao o tecnico ficava preso no clube.
//
// Este modulo liga as duas pontas e persiste as propostas no save.

import { storeGet, storeSet } from "@/lib/persistent-store"
import { getCareerScopedKey } from "@/lib/save-system"
import type { JobOffer } from "@/lib/board-engine"

const key = () => getCareerScopedKey("ultrafoot:job-offers")

export interface PendingJobOffer extends JobOffer {
  id: string
  /** Temporada/semana em que a proposta chegou (ela expira). */
  season: number
  week: number
}

/** Propostas expiram em 4 semanas — nao ficam encalhadas para sempre. */
const EXPIRA_EM_SEMANAS = 4

function readAll(): PendingJobOffer[] {
  const raw = storeGet(key())
  if (!raw) return []
  try {
    const p = JSON.parse(raw)
    return Array.isArray(p) ? (p as PendingJobOffer[]) : []
  } catch {
    return []
  }
}

function writeAll(list: PendingJobOffer[]): void {
  storeSet(key(), JSON.stringify(list))
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ultrafoot:job-offers:changed"))
  }
}

/** Propostas ainda validas (as vencidas somem sozinhas). */
export function listJobOffers(season: number, week: number): PendingJobOffer[] {
  const vivas = readAll().filter((o) => {
    const semanasPassadas = (season - o.season) * 52 + (week - o.week)
    return semanasPassadas >= 0 && semanasPassadas <= EXPIRA_EM_SEMANAS
  })
  if (vivas.length !== readAll().length) writeAll(vivas)
  return vivas
}

/** Guarda as propostas geradas, sem duplicar clube. */
export function addJobOffers(offers: JobOffer[], season: number, week: number): void {
  if (offers.length === 0) return
  const atuais = readAll()
  const jaTem = new Set(atuais.map((o) => o.clubShort))

  const novas: PendingJobOffer[] = offers
    .filter((o) => !jaTem.has(o.clubShort))
    .map((o) => ({
      ...o,
      id: `job_${o.clubShort}_${season}_${week}`,
      season,
      week,
    }))

  if (novas.length) writeAll([...atuais, ...novas])
}

export function removeJobOffer(id: string): void {
  writeAll(readAll().filter((o) => o.id !== id))
}

export function clearJobOffers(): void {
  writeAll([])
}

/**
 * ASSUMIR UM CLUBE a partir de uma proposta. Centraliza a troca de emprego que
 * antes so existia no card do Escritorio — a Area do Treinador so deixava
 * RECUSAR, e mandava o usuario ir a outra tela para aceitar.
 *
 * Recarrega o motor no clube novo (senao elenco, tatica e fixtures do emprego
 * anterior ficavam para tras) e preserva apenas o tempo da carreira. As
 * dependencias entram por parametro para este modulo nao importar o store nem o
 * roteador (evita ciclo e mantem a funcao testavel).
 */
export function assumirClube(
  clubShort: string,
  deps: {
    initializeGame: (short: string) => void
    setEngineTime: (week: number, season: number) => void
    setSaveState: (patch: Record<string, unknown>) => void
    navigate: (href: string) => void
    week: number
    season: number
  },
): void {
  clearJobOffers()
  // CENTRAL DE NOTIFICACOES ZERA ao trocar de clube: os avisos do emprego
  // anterior (proposta por um atleta que nao e mais seu, obra do estadio antigo,
  // recado da diretoria que te demitiu) nao fazem sentido no clube novo.
  limparNotificacoes()
  deps.initializeGame(clubShort)
  deps.setEngineTime(deps.week, deps.season)
  deps.setSaveState({
    selectedTeamShort: clubShort,
    // Assumir um CLUBE volta ao modo clube: se o técnico estava no modo seleção
    // (ex.: demitido e seguindo só na seleção — caso Diniz), o novo clube passa a
    // ser o time ativo. A seleção continua no save; alterna de volta pela /selecao.
    managingNationalTeamId: null,
    divisionOverride: undefined,
    fixtures: [],
    standings: [],
    squadPlayers: undefined,
    youthPlayers: undefined,
    youthCareer: undefined,
    // COOLDOWN: registra quando o tecnico assumiu. Sem isto dava para aceitar
    // uma proposta e, na semana seguinte, aceitar outra — trocando de clube
    // varias vezes na mesma temporada. Ver podeTrocarDeClube.
    contratadoEm: { season: deps.season, week: deps.week },
  })
  deps.navigate("/")
}

// ─── FIM DE PASSAGEM: pedir demissão ou ser demitido ────────────────────────

/** Como a passagem por um clube terminou. */
export type MotivoDeSaida = "resigned" | "fired"

/**
 * Uma passagem do técnico por um clube, do jeito que ela fica no save.
 *
 * Isto NÃO existia. O tipo `endReason` vivia só no hall da fama
 * (lib/hall-of-fame-engine), e `buildCareerStats` chumbava `"contract_ended"`
 * para todo mundo — ou seja: dava para ser demitido dez vezes e o histórico
 * dizia que os dez ciclos "terminaram o contrato". A própria tela do Escritório
 * prometia "registra a passagem no seu histórico" e nada era gravado.
 */
export interface PassagemPorClube {
  teamCurto: string
  teamNome: string
  endReason: MotivoDeSaida
  season: number
  week: number
}

/**
 * ENCERRA a passagem pelo clube atual — o caminho único de "pedir demissão" e
 * "ser demitido".
 *
 * Os dois caminhos faziam apenas `setSaveState({ selectedTeamShort: null })`, e
 * isso deixava duas pontas soltas:
 *
 *   1. A PASSAGEM NÃO ERA REGISTRADA. Ver `PassagemPorClube` acima.
 *   2. O MOTOR CONTINUAVA NO CLUBE ANTIGO. `squadPlayers`, `myTeamShort`,
 *      propostas e sondagens ficavam carregados. Quem saía do clube continuava
 *      vendo o elenco antigo, e o mercado seguia mandando proposta por atleta
 *      que já não era seu — a ponte de notificações não tem como saber que você
 *      foi embora. O reinit só acontecia ao ASSUMIR outro clube; no meio do
 *      caminho (a Área do Treinador, onde se escolhe o próximo emprego) o estado
 *      era do emprego anterior.
 *
 * `limparOfertas` é falso na demissão de propósito: as propostas de clube que já
 * tinham chegado continuam valendo para quem foi demitido — é justamente quando
 * elas importam. Quem pede demissão abre mão delas.
 */
export function encerrarPassagem(
  motivo: MotivoDeSaida,
  deps: {
    teamCurto: string
    teamNome: string
    season: number
    week: number
    passagensAtuais?: PassagemPorClube[]
    setSaveState: (patch: Record<string, unknown>) => void
    /** Zera o estado de clube no motor (elenco, mercado, tabela). */
    limparClubeNoMotor?: () => void
    /** Campos extras a gravar junto (ex.: entrar no modo seleção). */
    patchExtra?: Record<string, unknown>
  },
): void {
  const passagem: PassagemPorClube = {
    teamCurto: deps.teamCurto,
    teamNome: deps.teamNome,
    endReason: motivo,
    season: deps.season,
    week: deps.week,
  }

  if (motivo === "resigned") clearJobOffers()

  deps.setSaveState({
    selectedTeamShort: null,
    // Guarda as últimas 40: o histórico de um técnico longevo não precisa de mais
    // que isso, e o save não pode crescer sem limite.
    passagens: [...(deps.passagensAtuais ?? []), passagem].slice(-40),
    // O cooldown de troca de clube é do emprego que acabou.
    contratadoEm: undefined,
    ...(deps.patchExtra ?? {}),
  })

  deps.limparClubeNoMotor?.()
}

/**
 * MODO SELEÇÃO (Task 2). Assumir/alternar para a SELEÇÃO como time ativo. Ao
 * contrário de trocar de CLUBE, aqui NÃO recarregamos o motor nem zeramos
 * notificações: o clube continua existindo por baixo — só muda qual entidade o
 * office/central/elenco/partida enxergam como "time atual". Voltar ao clube é o
 * inverso (managingNationalTeamId = null).
 */
export function assumirSelecao(
  nationalTeamId: string,
  deps: { setSaveState: (patch: Record<string, unknown>) => void; navigate: (href: string) => void },
): void {
  deps.setSaveState({ managingNationalTeamId: nationalTeamId })
  deps.navigate("/")
}

/** Volta a comandar o CLUBE (sai do modo seleção). */
export function voltarAoClube(
  deps: { setSaveState: (patch: Record<string, unknown>) => void; navigate: (href: string) => void },
): void {
  deps.setSaveState({ managingNationalTeamId: null })
  deps.navigate("/")
}

/** Notificacoes sao por carreira; ao trocar de clube o historico e zerado. */
function limparNotificacoes(): void {
  if (typeof window === "undefined") return
  try {
    storeSet(getCareerScopedKey("ultrafoot:notifications"), JSON.stringify([]))
    window.dispatchEvent(new CustomEvent("ultrafoot:notifications:cleared"))
  } catch { /* limpar aviso nunca pode impedir a troca de clube */ }
}

/**
 * O tecnico pode assumir outro clube agora?
 *
 * Na vida real ninguem troca de clube tres vezes no mesmo ano. Depois de assumir,
 * e preciso CUMPRIR a temporada: so a partir da temporada seguinte outras
 * propostas podem ser aceitas. Quem esta sem clube (demitido ou pediu demissao)
 * nao tem trava — precisa poder voltar a trabalhar.
 */
export function podeTrocarDeClube(
  contratadoEm: { season: number; week: number } | undefined,
  temporadaAtual: number,
  temClube: boolean,
): { pode: boolean; motivo?: string } {
  if (!temClube) return { pode: true }
  if (!contratadoEm) return { pode: true } // carreira antiga, sem registro
  if (temporadaAtual > contratadoEm.season) return { pode: true }
  return {
    pode: false,
    motivo: "Você assumiu este clube nesta temporada. Cumpra o ano antes de aceitar outra proposta — trocar de clube no meio do caminho queima seu nome no mercado.",
  }
}

// EM QUE ANO O MUNDO ESTÁ — a ponte entre o save e o `players-data`.
//
// `players-data` não pode importar o `game-engine` nem o `use-game-manager`
// (ciclo garantido: os dois importam players-data). É o mesmo motivo de
// `departed-players` e `world-market` viverem fora do motor.
//
// Então a temporada corrente chega aqui por um canal próprio: o manager avisa
// quando ela muda, e na dúvida lemos o save da carreira ativa uma única vez.
// Sem nenhum dos dois, o valor é a temporada base — ou seja, mundo parado, que
// é exatamente o comportamento anterior. Falhar para o lado de não envelhecer é
// o certo: melhor um mundo parado do que um mundo que salta 10 anos por engano.

import { storeGet } from "@/lib/persistent-store"
import { getActiveCareerId, getCareerScopedKey } from "@/lib/save-system"
import { TEMPORADA_BASE_DO_MUNDO } from "@/lib/mundo-vivo"

const LEGACY_KEY = "ultrafoot:save"

let cache: number | null = null
let cacheCarreira: string | null = null
let cacheClube: string | null = null
let cacheClubeCarreira: string | null = null

/** O manager chama sempre que a temporada é conhecida ou muda. */
export function setTemporadaDoMundo(temporada: number): void {
  if (!Number.isFinite(temporada) || temporada < TEMPORADA_BASE_DO_MUNDO) return
  cache = temporada
  cacheCarreira = getActiveCareerId()
}

/** Zera o cache — usado ao trocar de carreira. */
export function limparTemporadaDoMundo(): void {
  cache = null
  cacheCarreira = null
  cacheClube = null
  cacheClubeCarreira = null
}

/**
 * Sigla do clube que o usuário comanda, ou `null`.
 *
 * O elenco do usuário NÃO pode envelhecer por este caminho: ele vive no motor
 * (`squadPlayers`), que já o envelhece na virada de temporada. Envelhecer de
 * novo aqui faria a tela de Elenco mostrar um atleta dois anos mais velho do que
 * o mesmo atleta na escalação.
 */
export function getClubeDoUsuario(): string | null {
  const atual = getActiveCareerId()
  if (cacheClube !== null && cacheClubeCarreira === atual) return cacheClube
  cacheClubeCarreira = atual
  cacheClube = lerClubeDoSave()
  return cacheClube
}

/** O manager avisa quando o clube muda (contratação, demissão, modo seleção). */
export function setClubeDoUsuario(curto: string | null): void {
  cacheClube = curto ?? ""
  cacheClubeCarreira = getActiveCareerId()
}

export function getTemporadaDoMundo(): number {
  const atual = getActiveCareerId()
  if (cache !== null && cacheCarreira === atual) return cache
  cacheCarreira = atual
  cache = lerDoSave()
  return cache
}

/** Quantas temporadas o mundo andou desde a foto do seed. */
export function temporadasDesdeOSeed(): number {
  return Math.max(0, getTemporadaDoMundo() - TEMPORADA_BASE_DO_MUNDO)
}

function lerSave(): { season?: number; selectedTeamShort?: string } | null {
  try {
    const raw = storeGet(getCareerScopedKey(LEGACY_KEY)) ?? storeGet(LEGACY_KEY)
    return raw ? (JSON.parse(raw) as { season?: number; selectedTeamShort?: string }) : null
  } catch {
    return null
  }
}

function lerDoSave(): number {
  const s = Number(lerSave()?.season)
  return Number.isFinite(s) && s >= TEMPORADA_BASE_DO_MUNDO ? s : TEMPORADA_BASE_DO_MUNDO
}

function lerClubeDoSave(): string {
  return lerSave()?.selectedTeamShort ?? ""
}

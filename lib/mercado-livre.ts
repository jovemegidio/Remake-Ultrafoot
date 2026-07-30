"use client"

// SITUACAO CONTRATUAL DO MUNDO + LISTA DE OBSERVADOS.
//
// O jogo controla contrato de verdade so no elenco do USUARIO (`getContractStatus`,
// game-engine). Os 53 mil atletas do catalogo nao tem contrato nenhum — e sem isso
// nao existe "atleta em fim de contrato" nem "sem clube" para acompanhar.
//
// Aqui a situacao e DERIVADA do id do atleta e da temporada, por hash: estavel
// (o mesmo atleta tem o mesmo contrato durante toda a temporada, e a lista nao
// muda a cada render) e sem custo de armazenamento. Na virada da temporada o
// relogio anda: quem estava a um ano do fim fica livre, quem tinha tres passa a
// ter dois. E a mesma licenca que o mercado ja usa para multa rescisoria e
// atributos derivados — o que importa e ser consistente e crivel.

import { storeGet, storeSet } from "@/lib/persistent-store"
import { getActiveCareerId, getCareerScopedKey } from "@/lib/save-system"

export type SituacaoContrato = "sem_clube" | "fim_de_contrato" | "sob_contrato"

function hash(v: string): number {
  let h = 2166136261
  for (let i = 0; i < v.length; i++) h = Math.imul(h ^ v.charCodeAt(i), 16777619)
  return h >>> 0
}

/**
 * Temporada em que o vinculo do atleta termina. Sorteada UMA vez (pelo id) numa
 * janela de 1 a 4 temporadas a partir da temporada em que ele entrou no catalogo,
 * e daí em diante o tempo corre normalmente.
 */
export function temporadaFimDeContrato(id: number, temporadaBase: number): number {
  return temporadaBase + (hash(`contrato:${id}`) % 4)
}

/**
 * Situacao do atleta nesta temporada.
 *
 * - `sem_clube`: o vinculo venceu e ninguem renovou. So acontece com quem tem
 *   perfil de quem sobra no mercado (veterano ou reserva de baixo overall) —
 *   craque de 25 anos nao fica solto por ai.
 * - `fim_de_contrato`: ultima temporada de contrato. Sai de graca no ano que vem,
 *   entao vale observar (ou tentar levar por menos agora).
 */
export function situacaoContratual(
  atleta: { id: number; age: number; overall: number },
  temporada: number,
  temporadaBase = 2026,
): SituacaoContrato {
  const fim = temporadaFimDeContrato(atleta.id, temporadaBase)
  if (temporada > fim) {
    // Venceu. Quem tem mercado assinou noutro clube (segue sob contrato);
    // sobram os que o mercado real deixa sem clube.
    const sobra = atleta.age >= 32 || atleta.overall <= 68 || atleta.age <= 19
    return sobra && hash(`livre:${atleta.id}:${temporada}`) % 3 !== 0 ? "sem_clube" : "sob_contrato"
  }
  return temporada === fim ? "fim_de_contrato" : "sob_contrato"
}

/** Quantas temporadas de contrato restam (0 = acabou). */
export function temporadasRestantes(id: number, temporada: number, temporadaBase = 2026): number {
  return Math.max(0, temporadaFimDeContrato(id, temporadaBase) - temporada + 1)
}

// ── OBSERVADOS ──────────────────────────────────────────────────────────────
//
// "Observar" e o outro lado do "contratar": marcar o atleta para acompanhar sem
// gastar nada. Fica no save da carreira (nao no global), como todo resto.

const KEY = () => getCareerScopedKey("ultrafoot:observados")

let cache: number[] | null = null
let cacheCareerId: string | null = null

export function getObservados(): number[] {
  const atual = getActiveCareerId()
  if (cache && cacheCareerId === atual) return cache
  cacheCareerId = atual
  try {
    const raw = storeGet(KEY())
    const parsed = raw ? JSON.parse(raw) : []
    cache = Array.isArray(parsed) ? (parsed as number[]) : []
  } catch {
    cache = []
  }
  return cache
}

export function estaObservado(id: number): boolean {
  return getObservados().includes(id)
}

/** Marca/desmarca e devolve a lista nova (para a tela re-renderizar). */
export function alternarObservado(id: number): number[] {
  const atual = getObservados()
  const nova = atual.includes(id) ? atual.filter(x => x !== id) : [...atual, id]
  cache = nova
  cacheCareerId = getActiveCareerId()
  storeSet(KEY(), JSON.stringify(nova))
  return nova
}

export function recarregarObservados(): void {
  cache = null
  cacheCareerId = null
}

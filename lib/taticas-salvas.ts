"use client"

// TÁTICAS SALVAS — o conjunto tático, não só a escalação.
//
// O jogo já salvava ESCALAÇÃO (lib/saved-lineups: formação + os 11 nomes). O que
// faltava era guardar COMO o time joga: mentalidade, marcação, linha de defesa,
// armadilha de impedimento, largura, ritmo e os batedores. Quem montava um
// esquema para clássico e outro para jogo fora tinha de refazer tudo na mão.
//
// Mesmo modelo do saved-lineups: persistent-store, sobrevive a reinstalação.

import { storeGet, storeSet } from "@/lib/persistent-store"

const KEY = "ultrafoot:saved-tactics"

export interface TaticaSalva {
  id: string
  nome: string
  formacao: string
  mentalidade: string
  marcacao: string
  linhaDefesa: string
  armadilhaImpedimento: boolean
  /** "largura" | "centro" | "misto" — por onde os ataques saem. */
  setorAtaque: string
  ritmo: string
  batedores?: { freeKick?: string; corner?: string; penalty?: string }
  atualizadaEm: number
}

function lerTodas(): TaticaSalva[] {
  const cru = storeGet(KEY)
  if (!cru) return []
  try {
    const lido = JSON.parse(cru)
    return Array.isArray(lido) ? (lido as TaticaSalva[]) : []
  } catch {
    // Save corrompido não pode derrubar a tela de táticas.
    return []
  }
}

function gravar(lista: TaticaSalva[]): void {
  storeSet(KEY, JSON.stringify(lista))
}

export function listarTaticas(): TaticaSalva[] {
  return lerTodas().sort((a, b) => b.atualizadaEm - a.atualizadaEm)
}

export function salvarTatica(entrada: Omit<TaticaSalva, "id" | "atualizadaEm"> & { id?: string }): TaticaSalva {
  const lista = lerTodas()
  const agora = Date.now()
  // Nome repetido SOBRESCREVE em vez de duplicar: quem salva "Clássico" duas
  // vezes quer atualizar, não ficar com dois "Clássico" indistinguíveis.
  const existente = lista.find(t => t.id === entrada.id || t.nome.trim().toLowerCase() === entrada.nome.trim().toLowerCase())
  const tatica: TaticaSalva = {
    ...entrada,
    id: existente?.id ?? `tat_${agora.toString(36)}`,
    atualizadaEm: agora,
  }
  const nova = existente
    ? lista.map(t => (t.id === tatica.id ? tatica : t))
    : [...lista, tatica]
  // Teto de 12: a lista é para escolher rápido, não um arquivo morto.
  gravar(nova.slice(-12))
  return tatica
}

export function removerTatica(id: string): void {
  gravar(lerTodas().filter(t => t.id !== id))
}

export function obterTatica(id: string): TaticaSalva | undefined {
  return lerTodas().find(t => t.id === id)
}

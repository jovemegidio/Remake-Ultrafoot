"use client"

// SALVAR = GRAVAR TUDO, DE UMA VEZ.
//
// ⚠️ POR QUE ISTO EXISTE (pedido: "ao salvar deve salvar tudo — transferências,
// contratações, rescisões de contrato, empréstimo entre outros, elenco, todas as
// movimentações feitas pelo jogador").
//
// O jogo guarda o progresso em TRÊS lugares, e salvar mexia em dois deles de
// forma frouxa:
//
//   1. `ultrafoot:save:<carreira>` — o save da carreira (semana, temporada,
//      finanças, base, histórico, extrato de movimentações);
//   2. `ultrafoot-game-engine:<carreira>` — o MOTOR (elenco, contratos,
//      empréstimos, propostas, fila de chegadas/saídas, caixa);
//   3. o resto das chaves `ultrafoot:` da carreira (observados, ofertas de
//      emprego, atletas que saíram do mundo, lances de leilão...).
//
// O botão de salvar chamava `saveGameStateAndFlush({ ...state })` com o `state`
// do React da TELA que fez a chamada. Esse objeto é um retrato do momento em que
// o componente montou: qualquer coisa gravada depois por `commitGameState` (que
// escreve direto no disco — é o caminho de toda decisão seguida de navegação)
// ficava FORA do merge e era sobrescrita pelo valor antigo. Salvar podia
// literalmente desfazer a rescisão que você acabou de assinar.
//
// A correção é ler o save do disco na hora de gravar e mesclar o retrato do
// React POR CIMA dele apenas nos campos que a tela realmente mudou — o padrão
// que `commitGameState` já usava para o resto do jogo.

import {
  commitGameState,
  saveGameStateAndFlush,
  podeSalvarCarreira,
  loadGameState,
  type GameState,
} from "@/lib/save-system"
import { persistGameEngineNow } from "@/lib/game-engine"
import { flushPersistentStore } from "@/lib/persistent-store"

export interface ResultadoDoSalvamento {
  ok: boolean
  /** Motivo em português quando não deu para salvar. */
  motivo?: string
  /** O estado efetivamente gravado (útil para a tela mostrar nome/data). */
  estado?: GameState
}

/**
 * Grava TUDO: motor, save da carreira e as demais chaves da carreira, e só
 * retorna quando o disco confirmou.
 *
 * `patch` é o que a tela quer mudar junto (nome do save, por exemplo) — nunca o
 * estado inteiro. Passar o `state` do React aqui reintroduz o bug descrito acima.
 */
export async function salvarTudo(patch: Partial<GameState> = {}): Promise<ResultadoDoSalvamento> {
  if (typeof window === "undefined") return { ok: false, motivo: "Sem navegador." }

  const atual = loadGameState()
  if (!podeSalvarCarreira(atual)) {
    return { ok: false, motivo: "Entre no pré-jogo para começar a carreira antes de salvar." }
  }

  // 1. MOTOR PRIMEIRO. Ele carrega elenco, contratos, empréstimos, caixa e as
  //    filas de chegada/saída. O middleware `persist` já grava a cada mudança,
  //    mas o snapshot explícito garante que o último `set` desta mesma tacada
  //    (ex.: a venda que abriu o diálogo de salvar) esteja no arquivo.
  persistGameEngineNow()

  // 2. SAVE DA CARREIRA, mesclado sobre o que está no DISCO — nunca sobre um
  //    retrato do React (ver o cabeçalho).
  const gravado = commitGameState(prev => ({ ...prev, ...patch, updatedAt: Date.now() }))

  // 3. Espelho na pasta do Windows + espera as gravações pendentes do
  //    persistent-store (que serializa motor, save e as demais chaves).
  await saveGameStateAndFlush(gravado)
  await flushPersistentStore()

  return { ok: true, estado: gravado }
}

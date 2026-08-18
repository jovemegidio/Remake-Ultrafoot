"use client"

// ESTADO COMPARTILHADO DO FC HUB — uma sondagem só para o launcher inteiro.
//
// ⚠️ POR QUE ISTO EXISTE. A presença e a lista de amigos aparecem em três
// lugares ao mesmo tempo: o painel da direita, a janela de conversa e a aba do
// FC Hub. Com cada um sondando por conta própria, a mesma conta batia três vezes
// a cada 20 s — e, pior, cada tela via um retrato diferente: o painel dizia "2
// não lidas" enquanto a conversa ao lado já estava lida.
//
// Aqui existe UM temporizador. Quem monta assina; quando o último desmonta, ele
// para. Nada sonda com a janela fechada.
//
// Também é aqui que mora "quais conversas estão abertas": o painel da direita
// precisa ABRIR uma conversa que é desenhada lá embaixo, na doca — passar isso
// por props atravessaria o shell inteiro só para carregar um número.

import {
  PAINEL_VAZIO, baterPresenca, listarAmigos,
  type PainelDeAmigos, type RespostaDePresenca,
} from "@/lib/hub"
import { useSyncExternalStore } from "react"

const INTERVALO = 20_000
/** Quantas conversas cabem abertas ao mesmo tempo, como nos launchers grandes. */
export const MAX_CONVERSAS = 3

type Ouvinte = () => void

let presenca: RespostaDePresenca | null = null
let painel: PainelDeAmigos = PAINEL_VAZIO
let conversas: number[] = []
let minimizadas: number[] = []

const ouvintes = new Set<Ouvinte>()
let timer: number | null = null
let ativo = false
let buscando = false

function avisar(): void {
  for (const o of ouvintes) o()
}

async function umaRodada(): Promise<void> {
  // Uma rodada por vez: rede lenta enfileirava chamadas e o servidor recebia
  // rajadas de batidas atrasadas de uma vez só.
  if (buscando) return
  buscando = true
  try {
    const [p, a] = await Promise.all([baterPresenca(), listarAmigos()])
    if (p) presenca = p
    painel = a
    avisar()
  } finally {
    buscando = false
  }
}

function reavaliar(): void {
  const precisa = ativo && ouvintes.size > 0
  if (precisa && timer === null) {
    void umaRodada()
    timer = window.setInterval(() => void umaRodada(), INTERVALO)
  } else if (!precisa && timer !== null) {
    window.clearInterval(timer)
    timer = null
  }
}

/**
 * Liga ou desliga a sondagem. Chamado pelo shell.
 *
 * ⚠️ DESLIGADO TEM DE LIMPAR. Sair da conta e continuar mostrando a lista de
 * amigos da sessão anterior é vazamento de dado de quem saiu — e a próxima
 * pessoa a entrar veria os amigos alheios até a primeira resposta chegar.
 */
export function ligarHub(ligado: boolean): void {
  if (ativo === ligado) return
  ativo = ligado
  if (!ligado) {
    presenca = null
    painel = PAINEL_VAZIO
    conversas = []
    minimizadas = []
  }
  reavaliar()
  avisar()
}

/** Força uma leitura agora — depois de aceitar um pedido, mandar mensagem etc. */
export async function recarregarHub(): Promise<void> {
  if (!ativo) return
  await umaRodada()
}

function assinar(o: Ouvinte): () => void {
  ouvintes.add(o)
  reavaliar()
  return () => {
    ouvintes.delete(o)
    reavaliar()
  }
}

export function usePresencaDoHub(): RespostaDePresenca | null {
  return useSyncExternalStore(assinar, () => presenca, () => null)
}

export function useAmigosDoHub(): PainelDeAmigos {
  return useSyncExternalStore(assinar, () => painel, () => PAINEL_VAZIO)
}

// ─── Conversas abertas ───────────────────────────────────────────────────────

export function abrirConversa(conta_id: number): void {
  minimizadas = minimizadas.filter(id => id !== conta_id)
  if (conversas.includes(conta_id)) { avisar(); return }
  // A mais antiga sai quando o teto estoura — é o que os launchers grandes
  // fazem, e é melhor do que empilhar janelas até cobrir a tela.
  conversas = [...conversas, conta_id].slice(-MAX_CONVERSAS)
  avisar()
}

export function fecharConversa(conta_id: number): void {
  conversas = conversas.filter(id => id !== conta_id)
  minimizadas = minimizadas.filter(id => id !== conta_id)
  avisar()
}

export function alternarMinimizada(conta_id: number): void {
  minimizadas = minimizadas.includes(conta_id)
    ? minimizadas.filter(id => id !== conta_id)
    : [...minimizadas, conta_id]
  avisar()
}

export function useConversasAbertas(): { abertas: number[]; minimizadas: number[] } {
  return useSyncExternalStore(
    assinar,
    () => {
      // O getSnapshot do React precisa devolver o MESMO objeto enquanto nada
      // muda: criar um literal a cada chamada faz o React achar que mudou
      // sempre e re-renderizar em laço.
      if (cacheConversas.abertas !== conversas || cacheConversas.minimizadas !== minimizadas) {
        cacheConversas = { abertas: conversas, minimizadas }
      }
      return cacheConversas
    },
    () => VAZIO_CONVERSAS,
  )
}

const VAZIO_CONVERSAS = { abertas: [] as number[], minimizadas: [] as number[] }
let cacheConversas = VAZIO_CONVERSAS

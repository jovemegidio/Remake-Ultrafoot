// MANAGER RIVALS — o cliente do competitivo.
//
// A regra que organiza este arquivo: **o cliente manda intenção, o servidor
// devolve fato**. Entrar na fila, sair da fila e enviar o placar são pedidos; o
// adversário, a validação e o rating vêm de lá. Nada aqui calcula rating, e é
// de propósito — se o cliente calculasse, bastaria editar o save para virar
// primeiro do mundo.
//
// O servidor é o relay que já existe (`services/multiplayer-relay-vps`), com os
// endpoints `/v1/competitivo/*` acrescentados na 1.0.330.

import { ONLINE_PROTOCOL_VERSION } from "@/lib/online-multiplayer"
import { configuredRelayUrl } from "@/lib/internet-multiplayer"

export interface DivisaoCompetitiva { id: number; nome: string; piso: number }

export interface PerfilCompetitivo {
  rating: number
  divisao: DivisaoCompetitiva
}

export interface Pareamento {
  matchId: string
  roomCode: string
  adversario: { nome: string; rating: number; divisao: DivisaoCompetitiva }
}

export type EstadoDaFila =
  | { estado: "na_fila"; perfil: PerfilCompetitivo }
  | { estado: "pareado"; pareamento: Pareamento }
  | { estado: "erro"; erro: string }

/**
 * Endereço do relay. O MESMO que o resto do online usa — e "o mesmo" aqui é
 * literal, não uma cópia parecida.
 *
 * ⚠️ Até a 1.0.336 este arquivo tinha o endereço próprio, lido de
 * `NEXT_PUBLIC_RELAY_URL`, enquanto o resto do jogo usa `configuredRelayUrl()`
 * — que lê outra variável (`NEXT_PUBLIC_ULTRAFOOT_RELAY_URL`) e ainda respeita
 * o relay personalizado que o jogador salva em Configurações. Quem trocasse de
 * relay entrava na fila de um servidor e na sala de outro: o pareamento saía e
 * o código não existia do outro lado.
 */
function servidor(): string {
  return configuredRelayUrl()
}

async function pedir<T>(caminho: string, corpo: unknown): Promise<T | { erro: string }> {
  try {
    const resposta = await fetch(`${servidor()}${caminho}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corpo),
    })
    const dados = await resposta.json()
    if (!resposta.ok || dados?.ok === false) return { erro: String(dados?.erro ?? dados?.error ?? "falha") }
    return dados as T
  } catch {
    // Sem rede, sem drama: o modo competitivo simplesmente não abre. O resto do
    // jogo (carreira offline) nunca depende disto.
    return { erro: "sem_conexao" }
  }
}

/**
 * Entra na fila do modo.
 *
 * `forcaDoClube` vai junto porque o pareamento olha DUAS coisas — o rating do
 * técnico e a força do clube. Só o rating produziria "Real Madrid × Criciúma
 * entre dois jogadores de mesmo ranking", que é o caso que o próprio pedido
 * apontou como errado.
 */
export async function entrarNaFila(input: {
  modo: "rivals" | "champions" | "amistoso"
  managerId: string
  managerName: string
  forcaDoClube: number
}): Promise<EstadoDaFila> {
  const r = await pedir<{
    estado: string; rating?: number; divisao?: DivisaoCompetitiva
    matchId?: string; roomCode?: string; adversario?: Pareamento["adversario"]
  }>("/v1/competitivo/fila", { ...input, gameVersion: ONLINE_PROTOCOL_VERSION })

  if ("erro" in r) return { estado: "erro", erro: r.erro }
  if (r.estado === "pareado" && r.matchId && r.roomCode && r.adversario) {
    return { estado: "pareado", pareamento: { matchId: r.matchId, roomCode: r.roomCode, adversario: r.adversario } }
  }
  return {
    estado: "na_fila",
    perfil: { rating: r.rating ?? 1000, divisao: r.divisao ?? { id: 10, nome: "Divisão 10", piso: 0 } },
  }
}

export async function sairDaFila(modo: string, managerId: string): Promise<void> {
  await pedir("/v1/competitivo/sair", { modo, managerId })
}

/**
 * Envia o placar. Só vale quando o adversário mandar o MESMO — e quem decide
 * isso é o servidor.
 *
 * ⚠️ Não existe "confiar no cliente" aqui: divergiu, ninguém pontua. É a
 * proteção possível enquanto a partida roda nas duas máquinas; fechar a última
 * porta (cliente adulterado com motor modificado) exige rodar a simulação no
 * servidor, e isso está anotado como o passo seguinte em `rivals.mjs`.
 */
export async function enviarResultado(input: {
  matchId: string
  managerId: string
  golsCasa: number
  golsFora: number
}): Promise<{ estado: "aguardando_confirmacao" | "confirmada" | "divergente" } | { erro: string }> {
  return pedir("/v1/competitivo/resultado", input)
}

export interface LinhaDoRanking {
  posicao: number
  nome: string
  rating: number
  partidas: number
  v: number
  e: number
  d: number
  divisao: string
}

export async function ranking(limite = 50): Promise<LinhaDoRanking[]> {
  try {
    const r = await fetch(`${servidor()}/v1/competitivo/ranking?limite=${limite}`)
    const dados = await r.json()
    return Array.isArray(dados?.ranking) ? dados.ranking : []
  } catch {
    return []
  }
}

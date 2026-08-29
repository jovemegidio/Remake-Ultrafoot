// CARREIRA ONLINE — o cliente do mundo compartilhado.
//
// A mesma regra do Manager Rivals: **o cliente manda intenção, o servidor
// devolve fato**. Entrar no mundo, abrir a rodada, anunciar e comprar são
// pedidos; a vaga do clube, a tabela, o caixa e — o que sustenta o modo — a
// SEMENTE de cada confronto vêm de lá.
//
// ⚠️ A SEMENTE É O QUE FAZ O MODO EXISTIR. O relay não simula partida. Sem
// semente, os dois lados de um confronto simulariam por conta própria e
// chegariam a placares diferentes: a tabela passaria a depender de quem clicou
// primeiro. Com a semente do servidor e as forças que ele mesmo calcula, as
// duas máquinas jogam a MESMA partida — e o segundo envio vira conferência.

import { configuredRelayUrl } from "@/lib/internet-multiplayer"

export interface ClubeDoMundo { fileKey: string; nome: string }

export type PapelNoClube = "tecnico" | "diretor" | "presidente" | "olheiro"

export const PAPEIS: PapelNoClube[] = ["tecnico", "diretor", "presidente", "olheiro"]

export type PapeisDoClube = Partial<Record<PapelNoClube, { id: string; nome: string }>>

export interface LinhaDaCarreiraOnline {
  posicao: number
  fileKey: string
  clube: string
  forca: number
  caixa: number
  reforcos: number
  papeis: PapeisDoClube
  pontos: number
  j: number; v: number; e: number; d: number
  gp: number; gc: number; saldo: number
}

export interface PartidaDoMundo {
  matchId: string
  rodada: number
  /** file_key do clube — o mundo é dos CLUBES, não das pessoas. */
  casa: string
  fora: string
  semente: number
  forcaCasa: number
  forcaFora: number
  placar: { casa: number; fora: number } | null
  nomeCasa: string
  nomeFora: string
}

export interface AtletaAnunciado {
  id: string
  nome: string
  posicao: string
  overall: number
}

export interface AnuncioDoMercado {
  anuncioId: string
  /** file_key do clube vendedor. */
  clube: string
  vendedor: string
  porQuem: string
  atleta: AtletaAnunciado
  preco: number
  criadoEm: number
}

export interface MembroDoMundo {
  id: string
  nome: string
  fileKey: string
  papel: PapelNoClube
}

export interface ClubeCompartilhado {
  fileKey: string
  nome: string
  forcaBase: number
  caixa: number
  reforcos: (AtletaAnunciado & { veioDe?: string })[]
  /** `null` = sem teto. Só existe quando um presidente define um. */
  tetoDeCompra: number | null
}

/**
 * O que ESTE jogador pode fazer, decidido pelo SERVIDOR.
 *
 * A tela mostra o botão a partir daqui em vez de deduzir do papel: assim as
 * duas pontas nunca discordam sobre a regra, e mudar a regra é mexer num lugar.
 */
export interface PermissoesNoClube {
  jogar: boolean
  negociar: boolean
  abrirRodada: boolean
  definirTeto: boolean
  espiar: boolean
}

export interface TemporadaEncerrada {
  temporada: number
  campeao: string
  nomeDoCampeao: string
  pontos: number
  encerradaEm: number
  podio: { fileKey: string; nome: string; pontos: number }[]
}

export interface EstadoDoMundo {
  vagas: number
  ocupadas: number
  rodada: number
  /** Temporada corrente. Mundo criado antes da 1.0.379 comeca na 1. */
  temporada?: number
  /** Quantas rodadas tem esta temporada. 0 = ainda nao comecou. */
  rodadasDaTemporada?: number
  /** As dez ultimas temporadas encerradas, da mais recente para a mais antiga. */
  historico?: TemporadaEncerrada[]
  pendentes: number
  sou: MembroDoMundo | null
  meuClube: ClubeCompartilhado | null
  papeisDoMeuClube: PapeisDoClube
  permissoes: PermissoesNoClube | null
  tabela: LinhaDaCarreiraOnline[]
  minhasPartidas: PartidaDoMundo[]
  mercado: AnuncioDoMercado[]
  clubesOcupados: string[]
  papeisLivres: PapelNoClube[]
}

export interface RelatorioDoOlheiro {
  clube: string
  forca: number
  caixa: number
  reforcos: { nome: string; posicao: string; overall: number }[]
  papeis: string[]
}

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
    // Sem relay o mundo simplesmente não abre — e a tela diz isso. A carreira
    // offline nunca depende daqui.
    return { erro: "sem_conexao" }
  }
}

export async function estadoDoMundo(managerId: string): Promise<EstadoDoMundo | null> {
  try {
    const resposta = await fetch(`${servidor()}/v1/carreira/estado?managerId=${encodeURIComponent(managerId)}`)
    const dados = await resposta.json()
    if (!resposta.ok || dados?.ok === false) return null
    return dados as EstadoDoMundo
  } catch {
    return null
  }
}

export async function entrarNoMundo(input: {
  managerId: string
  managerName: string
  clube: ClubeDoMundo
  forca: number
  /** Ausente = técnico. É o papel que abre a cooperativa e a diretoria online. */
  papel?: PapelNoClube
}): Promise<{ erro?: string }> {
  const r = await pedir<{ ok: boolean }>("/v1/carreira/entrar", input)
  return "erro" in r ? { erro: r.erro } : {}
}

export async function sairDoMundo(managerId: string): Promise<void> {
  await pedir("/v1/carreira/sair", { managerId })
}

export async function abrirRodada(managerId: string): Promise<{ erro?: string; rodada?: number }> {
  const r = await pedir<{ rodada: number }>("/v1/carreira/rodada", { managerId })
  return "erro" in r ? { erro: r.erro } : { rodada: r.rodada }
}

export async function enviarPlacarDoMundo(input: {
  matchId: string
  managerId: string
  golsCasa: number
  golsFora: number
}): Promise<{ erro?: string; estado?: "registrada" | "confirmada" | "divergente" }> {
  const r = await pedir<{ estado: "registrada" | "confirmada" | "divergente" }>("/v1/carreira/resultado", input)
  return "erro" in r ? { erro: r.erro } : { estado: r.estado }
}

export async function anunciarAtleta(input: {
  managerId: string
  atleta: AtletaAnunciado
  preco: number
}): Promise<{ erro?: string }> {
  const r = await pedir<{ ok: boolean }>("/v1/carreira/anunciar", input)
  return "erro" in r ? { erro: r.erro } : {}
}

export async function comprarAnuncio(input: {
  managerId: string
  anuncioId: string
}): Promise<{ erro?: string }> {
  const r = await pedir<{ ok: boolean }>("/v1/carreira/comprar", input)
  return "erro" in r ? { erro: r.erro } : {}
}

/** Os papéis ainda livres num clube — para a tela oferecer só o que existe. */
export async function papeisLivresDoClube(fileKey: string): Promise<PapelNoClube[]> {
  try {
    const resposta = await fetch(`${servidor()}/v1/carreira/papeis?fileKey=${encodeURIComponent(fileKey)}`)
    const dados = await resposta.json()
    if (!resposta.ok || dados?.ok === false) return ["tecnico"]
    return (dados.livres ?? ["tecnico"]) as PapelNoClube[]
  } catch {
    return ["tecnico"]
  }
}

/** Mão do presidente: `null` tira o teto. */
export async function definirTetoDeCompra(input: {
  managerId: string
  teto: number | null
}): Promise<{ erro?: string }> {
  const r = await pedir<{ ok: boolean }>("/v1/carreira/teto", input)
  return "erro" in r ? { erro: r.erro } : {}
}

/** Mão do olheiro: o próximo adversário por dentro. */
export async function espiarAdversario(managerId: string): Promise<RelatorioDoOlheiro | { erro: string }> {
  try {
    const resposta = await fetch(`${servidor()}/v1/carreira/espiar?managerId=${encodeURIComponent(managerId)}`)
    const dados = await resposta.json()
    if (!resposta.ok || dados?.ok === false) return { erro: String(dados?.erro ?? "falha") }
    return dados.relatorio as RelatorioDoOlheiro
  } catch {
    return { erro: "sem_conexao" }
  }
}

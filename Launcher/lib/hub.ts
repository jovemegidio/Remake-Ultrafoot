"use client"

// PRESENÇA E CHAT DO FC HUB, no launcher.
//
// As mesmas rotas que o jogo usa. Ter isso no launcher é o que faz a aba FC Hub
// valer alguma coisa: dá para ver quem está online e combinar uma liga ANTES de
// abrir o jogo — que é justamente quando a pessoa está no launcher.

import { sessaoSalva } from "@/lib/auth"

const BASE = "https://ultrafoot.zyntraerp.com.br/auth"

export interface JogadorOnline {
  conta_id: number
  nome: string
  clube: string
  situacao: string
  /** O que a pessoa está fazendo agora, pronto para a tela. */
  detalhe: string
  /** O mesmo em código (partida, mercado, treino…), para escolher o ícone. */
  atividade: string
  /** "jogo" ou "launcher" — é o que separa quem está jogando de quem só abriu
   *  o launcher. Sem isso, chamar alguém para uma partida vira loteria. */
  origem: string
  visto_em: number
}

export interface RespostaDePresenca {
  eu: number
  online: JogadorOnline[]
  amigos_online: number[]
  /** Pedidos de amizade esperando resposta — vira o número vermelho da aba. */
  pedidos: number
  /** Mensagens diretas não lidas. */
  nao_lidas: number
}

export interface AmigoDoHub {
  conta_id: number
  nome: string
  online: boolean
  clube: string
  situacao: string
  detalhe: string
  atividade: string
  origem: string
  visto_em: number
  nao_lidas: number
  ultima: string
  ultima_em: number
}

export interface PedidoDeAmizade {
  conta_id: number
  nome: string
  quando: number
}

export interface PessoaEncontrada {
  conta_id: number
  nome: string
  relacao: "nenhuma" | "enviado" | "recebido" | "amigo"
}

export interface MensagemDireta {
  id: number
  de_id: number
  para_id: number
  texto: string
  quando: number
  lida_em: number | null
}

export interface EventoDoMural {
  id: number
  conta_id: number
  nome: string
  tipo: string
  texto: string
  clube: string
  quando: number
}

export interface PainelDeAmigos {
  eu: number
  amigos: AmigoDoHub[]
  recebidos: PedidoDeAmizade[]
  enviados: PedidoDeAmizade[]
  bloqueados: { conta_id: number; nome: string }[]
}

export const PAINEL_VAZIO: PainelDeAmigos = {
  eu: 0, amigos: [], recebidos: [], enviados: [], bloqueados: [],
}

export interface MensagemDoChat {
  id: number
  conta_id: number
  nome: string
  texto: string
  quando: number
}

async function chamar<T>(rota: string, corpo?: unknown): Promise<T | null> {
  const s = sessaoSalva()
  if (!s) return null
  try {
    const r = await fetch(`${BASE}${rota}`, {
      method: corpo === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${s.token}`,
        ...(corpo === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
    })
    if (!r.ok) return null
    return await r.json() as T
  } catch {
    return null
  }
}

/**
 * Avisa que esta pessoa está online e devolve quem mais está.
 *
 * `situacao` diz "No launcher" de propósito: quem está no jogo aparece com o
 * clube. Sem essa distinção, chamar alguém para uma partida viraria loteria.
 */
export async function baterPresenca(): Promise<RespostaDePresenca | null> {
  return chamar<RespostaDePresenca>("/hub/presenca", {
    situacao: "No launcher",
    origem: "launcher",
  })
}

export async function lerChat(desde: number): Promise<MensagemDoChat[]> {
  const r = await chamar<{ mensagens: MensagemDoChat[] }>(`/hub/chat?desde=${desde}`)
  return r?.mensagens ?? []
}

/** Devolve "" quando deu certo, ou a mensagem de erro. */
export async function enviarMensagem(texto: string): Promise<string> {
  const s = sessaoSalva()
  if (!s) return "entre na sua conta para conversar"
  try {
    const r = await fetch(`${BASE}/hub/chat`, {
      method: "POST",
      headers: { Authorization: `Bearer ${s.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ texto }),
    })
    if (r.ok) return ""
    const d = await r.json().catch(() => ({})) as { erro?: string }
    return d.erro || "não foi possível enviar"
  } catch {
    return "sem conexão com o servidor"
  }
}

// ─── AMIGOS, CONVERSA PRIVADA E MURAL ────────────────────────────────────────
//
// As MESMAS rotas do jogo (`lib/hub-social.ts`), pelo mesmo motivo da presença:
// o launcher é onde a pessoa está antes de jogar, que é justamente quando ela
// quer combinar uma partida, responder um pedido de amizade ou ver o que os
// amigos andaram fazendo. Manter isso só dentro do jogo obrigava a abrir o jogo
// para descobrir que não havia ninguém online.

/** Amigos, pedidos e bloqueios numa chamada só. */
export async function listarAmigos(): Promise<PainelDeAmigos> {
  return (await chamar<PainelDeAmigos>("/hub/amigos")) ?? PAINEL_VAZIO
}

export interface PerfilDoHub {
  conta_id: number
  nome: string
  /** Código de amigo formatado: `7KM2-49XB`. */
  codigo_amigo: string
}

/**
 * Quem sou eu no FC Hub, com o CÓDIGO DE AMIGO.
 *
 * É o identificador curto que se passa para alguém adicionar você — como o
 * Riot ID ou o nome de exibição da Epic. Existe porque a única forma exata de
 * achar uma conta era o e-mail, e ninguém quer dar o e-mail para jogar.
 *
 * O código nasce na primeira vez que esta rota é chamada e não muda mais.
 */
export async function meuPerfil(): Promise<PerfilDoHub | null> {
  return chamar<PerfilDoHub>("/hub/perfil")
}

/** Procura pelo código de amigo, pelo nome, ou pelo e-mail exato da conta. */
export async function buscarPessoas(termo: string): Promise<PessoaEncontrada[]> {
  const limpo = termo.trim()
  if (limpo.length < 3) return []
  const r = await chamar<{ pessoas: PessoaEncontrada[] }>(`/hub/buscar?q=${encodeURIComponent(limpo)}`)
  return r?.pessoas ?? []
}

/**
 * Devolve "" quando deu certo, ou o motivo para mostrar na tela.
 *
 * Vai por `fetch` direto, e não por `chamar`, porque `chamar` engole o corpo do
 * erro: "muitos pedidos aguardando resposta" viraria um "não foi possível"
 * genérico, e a pessoa não teria como saber o que fazer.
 */
export async function pedirAmizade(alvo: { conta_id?: number; email?: string; codigo?: string }): Promise<string> {
  return postarComMotivo("/hub/amigos/pedir", alvo, "não foi possível enviar o pedido")
}

async function postarComMotivo(rota: string, corpo: unknown, padrao: string): Promise<string> {
  const s = sessaoSalva()
  if (!s) return "entre na sua conta para usar o FC Hub"
  try {
    const r = await fetch(`${BASE}${rota}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${s.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    })
    if (r.ok) return ""
    const d = await r.json().catch(() => ({})) as { erro?: string }
    return d.erro || padrao
  } catch {
    return "sem conexão com o servidor"
  }
}

export async function responderPedido(conta_id: number, aceitar: boolean): Promise<boolean> {
  const r = await chamar<{ ok?: boolean }>("/hub/amigos/responder", { conta_id, aceitar })
  return !!r?.ok
}

export async function removerAmigo(conta_id: number): Promise<boolean> {
  const r = await chamar<{ ok?: boolean }>("/hub/amigos/remover", { conta_id })
  return !!r?.ok
}

/** Bloquear também desfaz a amizade — é regra do servidor, não da tela. */
export async function bloquearPessoa(conta_id: number, bloquear = true): Promise<boolean> {
  const r = await chamar<{ ok?: boolean }>("/hub/bloquear", { conta_id, bloquear })
  return !!r?.ok
}

/**
 * Conversa privada com um amigo.
 *
 * ⚠️ LER MARCA COMO LIDA no servidor. Só chame com a conversa aberta na tela —
 * sondar em segundo plano zeraria o "não lidas" de quem nunca olhou.
 */
export async function lerConversa(com: number, desde = 0): Promise<MensagemDireta[]> {
  const r = await chamar<{ mensagens: MensagemDireta[] }>(`/hub/dm?com=${com}&desde=${desde}`)
  return r?.mensagens ?? []
}

/** Devolve "" quando deu certo, ou a mensagem de erro. */
export async function enviarDireta(para: number, texto: string): Promise<string> {
  return postarComMotivo("/hub/dm", { para, texto }, "não foi possível enviar")
}

/** O que os amigos andaram fazendo no jogo. Sobrevive a eles estarem offline. */
export async function lerMural(): Promise<EventoDoMural[]> {
  const r = await chamar<{ eventos: EventoDoMural[] }>("/hub/feed")
  return r?.eventos ?? []
}

/** Rótulo curto de "há quanto tempo", para quem está offline. */
export function desdeQuando(segundos: number): string {
  if (!segundos) return "nunca visto"
  const minutos = Math.max(0, Math.floor((Date.now() / 1000 - segundos) / 60))
  if (minutos < 1) return "agora"
  if (minutos < 60) return `há ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `há ${horas} h`
  const dias = Math.floor(horas / 24)
  return dias === 1 ? "ontem" : `há ${dias} dias`
}

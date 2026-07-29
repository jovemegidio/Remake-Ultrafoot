"use client"

// PRESENÇA E CHAT DO FC HUB, no launcher.
//
// As mesmas rotas que o jogo usa. Ter isso no launcher é o que faz a aba FC Hub
// valer alguma coisa: dá para ver quem está online e combinar uma liga ANTES de
// abrir o jogo — que é justamente quando a pessoa está no launcher.

import { sessaoSalva } from "@/lib/auth"

const BASE = "https://ultrafoot.179-198-103-30.sslip.io/auth"

export interface JogadorOnline {
  conta_id: number
  nome: string
  clube: string
  situacao: string
  visto_em: number
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
export async function baterPresenca(): Promise<{ eu: number; online: JogadorOnline[] } | null> {
  return chamar<{ eu: number; online: JogadorOnline[] }>("/hub/presenca", {
    situacao: "No launcher",
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

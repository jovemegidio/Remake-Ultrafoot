"use client"

import { useEffect, useRef } from "react"
import { useGameEngine } from "@/lib/game-engine"
import { useNotifications } from "@/components/notifications-system"
import { formatCurrency } from "@/lib/teams-data"

/**
 * Ponte entre o MERCADO (game-engine, Zustand) e a CENTRAL DE NOTIFICAÇÕES
 * (contexto React). O engine gera ofertas mas nao tem como chamar
 * addNotification; este componente observa o estado e emite os avisos que o
 * usuario pediu:
 *   - alguem fez PROPOSTA por um jogador meu (transferOffers);
 *   - alguem SONDOU um jogador meu antes de propor (marketInterests).
 *
 * A resposta a uma proposta que EU fiz e sincrona (decidida na hora no mercado),
 * entao aquele aviso e disparado direto na tela do mercado, nao aqui.
 *
 * Montado uma unica vez no provider global. Guarda os ids ja vistos em ref para
 * nao repetir o aviso a cada render.
 */
export function MarketNotificationsBridge() {
  const { addNotification } = useNotifications()
  const transferOffers = useGameEngine(s => s.transferOffers)
  const marketInterests = useGameEngine(s => s.marketInterests)

  const seenOffers = useRef<Set<number>>(new Set())
  const seenInterests = useRef<Set<string>>(new Set())
  const primed = useRef(false)

  // Na primeira passada, marca tudo como visto SEM notificar — senao o jogador
  // levaria um monte de avisos de coisas antigas ao abrir o jogo.
  useEffect(() => {
    if (primed.current) return
    primed.current = true
    for (const o of transferOffers ?? []) seenOffers.current.add(o.id)
    for (const i of marketInterests ?? []) seenInterests.current.add(i.id)
  }, [transferOffers, marketInterests])

  // PROPOSTA RECEBIDA por um jogador meu.
  useEffect(() => {
    if (!primed.current) return
    for (const o of transferOffers ?? []) {
      if (seenOffers.current.has(o.id)) continue
      seenOffers.current.add(o.id)
      if (o.status !== "pendente") continue
      addNotification({
        type: "transfer", priority: "high",
        title: `Proposta por ${o.playerName}`,
        message: `${o.fromTeam} ofereceu ${formatCurrency(o.offerAmount)} ` +
          `${o.offerType === "emprestimo" ? "por empréstimo" : "pela compra"} de ${o.playerName}. Responda na Central de Transferências.`,
      })
    }
  }, [transferOffers, addNotification])

  // SONDAGEM: interesse antes da proposta formal.
  useEffect(() => {
    if (!primed.current) return
    for (const i of marketInterests ?? []) {
      if (seenInterests.current.has(i.id)) continue
      seenInterests.current.add(i.id)
      addNotification({
        type: "transfer", priority: "medium",
        title: `Sondagem por ${i.playerName}`,
        message: `${i.club} está de olho em ${i.playerName}. Uma proposta pode chegar em breve.`,
      })
    }
  }, [marketInterests, addNotification])

  return null
}

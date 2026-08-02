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
  // addNotification via REF: a identidade dela muda toda vez que uma notificacao
  // e criada. Como dependencia de efeito, isso realimentava o proprio efeito —
  // caminho classico para "Maximum update depth exceeded" (React #185), que
  // derrubava o app inteiro porque esta ponte roda em TODA tela.
  const notificar = useRef(addNotification)
  notificar.current = addNotification
  const transferOffers = useGameEngine(s => s.transferOffers)
  const marketInterests = useGameEngine(s => s.marketInterests)
  const pendingIn = useGameEngine(s => s.pendingIncomingTransfers)
  const squad = useGameEngine(s => s.squadPlayers)

  const seenOffers = useRef<Set<number>>(new Set())
  const seenInterests = useRef<Set<string>>(new Set())
  /** id da transferencia pendente -> nome, para avisar quando ela sair da fila. */
  const pendentesVistos = useRef<Map<string, string>>(new Map())
  const primed = useRef(false)

  // Na primeira passada, marca tudo como visto SEM notificar — senao o jogador
  // levaria um monte de avisos de coisas antigas ao abrir o jogo.
  useEffect(() => {
    if (primed.current) return
    primed.current = true
    for (const o of transferOffers ?? []) seenOffers.current.add(o.id)
    for (const i of marketInterests ?? []) seenInterests.current.add(i.id)
    // A fila de chegadas tambem entra "ja vista": quem abre o jogo com um acerto
    // pendente nao deve levar o aviso de chegada antes de a janela abrir.
    for (const p of pendingIn ?? []) pendentesVistos.current.set(p.id, p.player?.name ?? "")
  }, [transferOffers, marketInterests, pendingIn])

  // PROPOSTA RECEBIDA por um jogador meu.
  useEffect(() => {
    if (!primed.current) return
    for (const o of transferOffers ?? []) {
      if (seenOffers.current.has(o.id)) continue
      seenOffers.current.add(o.id)
      if (o.status !== "pendente") continue
      notificar.current({
        type: "transfer", priority: "high",
        title: `Proposta por ${o.playerName}`,
        message: `${o.fromTeam} ofereceu ${formatCurrency(o.offerAmount)} ` +
          `${o.offerType === "emprestimo" ? "por empréstimo" : "pela compra"} de ${o.playerName}. Responda na Central de Transferências.`,
      })
    }
  }, [transferOffers])

  // SONDAGEM: interesse antes da proposta formal.
  useEffect(() => {
    if (!primed.current) return
    for (const i of marketInterests ?? []) {
      if (seenInterests.current.has(i.id)) continue
      seenInterests.current.add(i.id)
      // A sondagem agora DIZ POR QUÊ (1.0.223): que papel o atleta teria lá, o
      // que o clube viu no próprio elenco e se ele tem caixa para transformar
      // isso em proposta. Antes era só "está de olho" — um aviso que não mudava
      // decisão nenhuma. Campos opcionais: save antigo cai no texto de sempre.
      const detalhe = i.papel
        ? ` Chegaria como ${i.papel}.${i.motivo ? ` ${i.motivo}` : ""}`
        : " Uma proposta pode chegar em breve."
      const caixa = i.temCaixa === false ? " Hoje eles não têm caixa para bancar." : ""
      notificar.current({
        type: "transfer", priority: "medium",
        title: `Sondagem por ${i.playerName}`,
        message: `${i.club} está de olho em ${i.playerName}.${detalhe}${caixa}`,
      })
    }
  }, [marketInterests])

  // ─── CHEGADA DE REFORÇO ACERTADO FORA DA JANELA ────────────────────────────
  //
  // ⚠️ O RELATO QUE ISTO RESOLVE: "paguei a multa, negociei com o jogador, e o
  // acertado não veio ao clube".
  //
  // A janela de transferências fica FECHADA em 30 das 52 semanas. Fechada, o
  // motor cobra o valor NA HORA e guarda o atleta em `pendingIncomingTransfers`
  // até a janela abrir. Ele chega mesmo — mas nada avisava, nenhuma tela
  // mostrava a fila, e a única pista era um aviso passageiro no mercado. Para
  // quem joga: o dinheiro sumiu e o reforço não existe em lugar nenhum.
  //
  // Aqui fica a METADE do conserto que avisa a chegada; a outra é a fila
  // visível na Central de Transferências.
  useEffect(() => {
    if (!primed.current) return
    const agora = new Set((pendingIn ?? []).map(p => p.id))
    for (const [id, nome] of pendentesVistos.current) {
      if (agora.has(id)) continue
      pendentesVistos.current.delete(id)
      // Saiu da fila E está no elenco = chegou de verdade. Sem esta conferência,
      // uma entrada descartada por nome repetido viraria um "chegou" mentiroso.
      const chegou = (squad ?? []).some(
        p => p.name.trim().toLocaleLowerCase("pt-BR") === nome.trim().toLocaleLowerCase("pt-BR"),
      )
      if (!chegou) continue
      notificar.current({
        type: "transfer", priority: "high",
        title: `${nome} se apresentou`,
        message: `A janela abriu e ${nome} foi registrado no elenco. O acerto tinha sido fechado fora do período de inscrições.`,
        href: "/elenco",
      })
    }
    for (const p of pendingIn ?? []) pendentesVistos.current.set(p.id, p.player?.name ?? "")
  }, [pendingIn, squad])

  return null
}

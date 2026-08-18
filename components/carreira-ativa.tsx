"use client"

import dynamic from "next/dynamic"

import { useGameState } from "@/lib/save-system"

/**
 * OS SERVIÇOS DE FUNDO QUE SÓ EXISTEM COM UMA CARREIRA ABERTA.
 *
 * ⚠️ ESTES CINCO ESTAVAM DIRETO NO LAYOUT RAIZ — e o layout raiz envolve TODAS as
 * telas, inclusive a splash. Como cada um deles alcança `teams-data`,
 * `game-engine` ou `player-photos`, o menu principal baixava e interpretava os
 * seeds (pool de 2.452 clubes + elencos reais + manifesto de rostos) só para
 * desenhar uma lista de texto. Medido em 06/08/2026: 17 MB de JavaScript,
 * 4,7 MB comprimidos, ~1,1 s de indexação num PC de mesa — 4 a 8x num celular.
 *
 * Aqui eles entram por `next/dynamic` E atrás de um portão: sem clube nem
 * seleção no save, nada é montado e o navegador nem pede a chunk. Quem abre uma
 * carreira paga o preço — o que é justo, porque aí as telas mostram elenco,
 * tabela e mercado de qualquer jeito.
 *
 * A ORDEM ENTRE ELES É A MESMA que estava no layout, de propósito: `BenchTalk`
 * desenha na tela, e mudar a ordem dos irmãos mudaria o empilhamento.
 *
 * **Ao acrescentar algo ao layout raiz, pergunte se aquilo precisa existir na
 * splash.** Se não precisa e o módulo toca dados de clube ou de jogador, o lugar
 * é aqui — senão os 17 MB voltam para a abertura, sem nada denunciando na tela.
 */

const GameAutosave = dynamic(() => import("@/components/game-autosave").then(m => m.GameAutosave), { ssr: false })
const MarketNotificationsBridge = dynamic(() => import("@/components/market-notifications-bridge").then(m => m.MarketNotificationsBridge), { ssr: false })
const FinanceInfraNotificationsBridge = dynamic(() => import("@/components/finance-infra-notifications-bridge").then(m => m.FinanceInfraNotificationsBridge), { ssr: false })
const SeasonReviewBridge = dynamic(() => import("@/components/season-review-bridge").then(m => m.SeasonReviewBridge), { ssr: false })
const BenchTalk = dynamic(() => import("@/components/bench-talk").then(m => m.BenchTalk), { ssr: false })
// Publica no mural do FC Hub o que a carreira conquista (titulo, acesso,
// contratacao de peso). Global pelo mesmo motivo das outras pontes: preso a
// uma tela, quase nada seria publicado.
const HubAtividadeBridge = dynamic(() => import("@/components/hub-atividade-bridge").then(m => m.HubAtividadeBridge), { ssr: false })

export function CarreiraAtiva() {
  const { state, hydrated } = useGameState()
  // Enquanto o save não hidratou não dá para saber se há carreira — e montar por
  // engano é justamente o que traria os seeds de volta para a splash.
  if (!hydrated) return null
  // Seleção conta como carreira: no modo seleção o técnico não tem clube, mas
  // tem mercado, finanças e banco de reservas iguais.
  if (!state.selectedTeamShort && !state.managingNationalTeamId) return null

  return (
    <>
      <GameAutosave />
      <MarketNotificationsBridge />
      <FinanceInfraNotificationsBridge />
      <SeasonReviewBridge />
      <BenchTalk />
      <HubAtividadeBridge />
    </>
  )
}

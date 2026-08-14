"use client"

// LINK QUE NÃO PRÉ-CARREGA EM MÁQUINA APERTADA.
//
// O problema, medido
// ──────────────────
// O `<Link>` do Next busca a rota de destino assim que ele aparece na tela. Num
// site isso é ótimo: a navegação fica instantânea e o custo é de rede ociosa.
// Aqui não é rede — é DISCO E CPU LOCAL. O jogo é export estático dentro de uma
// webview, e cada rota aquecida significa baixar e **compilar** o JavaScript
// dela: a mediana de uma tela é 3,34 MB (medido em 13/08/2026). Um menu com
// vários destinos visíveis dispara isso tudo de uma vez, competindo com a thread
// que desenha a tela que a pessoa está olhando.
//
// Foi o que a auditoria mostrou: as telas pintavam em ~200 ms e continuavam
// trabalhando por até 6 s depois.
//
// A escolha, e por que ela não é global
// ─────────────────────────────────────
// Desligar o pré-carregamento para todo mundo tornaria a PRIMEIRA visita a cada
// tela mais lenta — trocaria um problema por outro. Quem tem máquina folgada não
// precisa dessa troca. Então quem decide é o perfil de desempenho, que é a
// resposta que o jogo já tem para "que computador é este":
//
//   econômico   → não pré-carrega nada
//   equilibrado → pré-carrega (comportamento padrão do Next)
//   qualidade   → pré-carrega
//
// ⚠️ USE ESTE, E NÃO `next/link`, em tela de jogo. O import direto volta a
// aquecer tudo em qualquer máquina, e o defeito reaparece sem ninguém notar —
// ele não dá erro, só deixa o jogo pesado em quem tem menos.

import NextLink from "next/link"
import { useSyncExternalStore, type ComponentProps } from "react"
import { performanceStore } from "@/components/performance-profile"

type Props = ComponentProps<typeof NextLink>

export function LinkLeve({ prefetch, ...props }: Props) {
  const perfil = useSyncExternalStore(
    performanceStore.subscribe,
    performanceStore.getSnapshot,
    performanceStore.getServerSnapshot,
  )
  // Quem passou `prefetch` explicitamente sabe o que quer: respeitamos.
  const decidido = prefetch ?? (perfil === "economy" ? false : undefined)
  return <NextLink prefetch={decidido} {...props} />
}

export default LinkLeve

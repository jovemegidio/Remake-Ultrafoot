"use client"

// O modo economico precisa alcancar o framer-motion tambem.
//
// O CSS do perfil economico zera `animation-duration` e `transition-duration`,
// e isso resolve tudo que e animado por CSS. Mas o framer-motion nao usa CSS:
// ele escreve estilo inline a cada quadro via requestAnimationFrame. O jogo tem
// centenas de `motion.*` — so components/match/event-animations.tsx tem 78 —
// e todos continuavam rodando a todo vapor no modo economico, justamente
// durante a partida, que e quando o jogador mais precisa de fluidez.
//
// `reducedMotion="always"` faz o framer-motion pular direto para o estado final
// de transform/opacity em vez de interpolar quadro a quadro. O layout nao muda
// e nada some da tela — o que some e o trabalho por quadro.
//
// Fora do economico usamos "user", que respeita "reduzir movimento" do Windows.

import { MotionConfig } from "framer-motion"
import { useSyncExternalStore, type ReactNode } from "react"
import { performanceStore } from "@/components/performance-profile"

export function MotionProfileProvider({ children }: { children: ReactNode }) {
  const perfil = useSyncExternalStore(
    performanceStore.subscribe,
    performanceStore.getSnapshot,
    performanceStore.getServerSnapshot,
  )
  return (
    <MotionConfig reducedMotion={perfil === "economy" ? "always" : "user"}>
      {children}
    </MotionConfig>
  )
}

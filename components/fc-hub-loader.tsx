"use client"

import dynamic from "next/dynamic"

// O Hub reúne Discord, rede local e internet. Ele não precisa entrar no bundle de
// cada tela do jogo: é carregado somente quando o jogador aciona Tab.
const FcHub = dynamic(() => import("@/components/fc-hub").then(module => module.FcHub), {
  ssr: false,
  loading: () => null,
})

export function FcHubLoader() {
  return <FcHub />
}

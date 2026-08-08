"use client"

import dynamic from "next/dynamic"

import { useEhAppCelular } from "@/lib/plataforma"

// O Hub reúne Discord, rede local e internet. Ele não precisa entrar no bundle de
// cada tela do jogo: é carregado somente quando o jogador aciona Tab.
const FcHub = dynamic(() => import("@/components/fc-hub").then(module => module.FcHub), {
  ssr: false,
  loading: () => null,
})

/**
 * O FC HUB É SÓ DO COMPUTADOR. Ele vive de Discord, rede local e do atalho Tab —
 * três coisas que não existem num celular sem teclado, e o botão "Abrir Discord"
 * mandava a pessoa para fora do jogo. No app de celular ele nem é montado, então
 * o `import()` do Hub também não é baixado lá.
 */
export function FcHubLoader() {
  const celular = useEhAppCelular()
  if (celular) return null
  return <FcHub />
}

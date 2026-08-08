"use client"

import { useEffect, useState } from "react"

/**
 * ONDE O JOGO ESTÁ RODANDO.
 *
 * A versão web é a MESMA em todo lugar: navegador, app do Windows (Tauri) e app
 * de celular (a WebView do `Mobile/`). Quando um recurso vale só para o
 * computador, é aqui que se pergunta.
 *
 * A marca vem do user-agent: o app de celular acrescenta `UltrafootMobile` ao
 * final do user-agent padrão do Android (`applicationNameForUserAgent`, em
 * `Mobile/src/app/index.tsx`). É o único sinal confiável — largura de tela não
 * serve, porque uma janela estreita no Windows não é um celular.
 */
export const MARCA_APP_CELULAR = "UltrafootMobile"

/** Está rodando dentro do app de celular? Fora do navegador, sempre `false`. */
export function ehAppCelular(): boolean {
  if (typeof navigator === "undefined") return false
  return navigator.userAgent.includes(MARCA_APP_CELULAR)
}

/**
 * Versão em hook. **Responde `false` na primeira renderização** e só depois diz a
 * verdade, de propósito: o jogo é exportado como HTML estático, e ler o
 * `navigator` durante a renderização faria o cliente desenhar diferente do que
 * veio no arquivo — o React descarta a árvore inteira e a tela pisca.
 *
 * Ou seja: use para ESCONDER o que é só do PC, nunca para revelar algo que
 * precise estar lá no primeiro quadro.
 */
export function useEhAppCelular(): boolean {
  const [celular, setCelular] = useState(false)
  useEffect(() => setCelular(ehAppCelular()), [])
  return celular
}

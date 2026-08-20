"use client"

// O SISTEMA DE INPUT, montado uma vez.
//
// Ele NAO e um Context Provider — de proposito. Os gerentes vivem em modulo
// (lib/input, lib/focus, lib/display) e quem precisa deles assina direto pelos
// hooks. Um contexto aqui rerenderizaria toda a arvore do jogo a cada mudanca
// de modo, que e exatamente o custo que este sistema inteiro existe para
// evitar.
//
// Entao este componente faz tres coisas e so:
//   1. liga e desliga os gerentes junto com a janela;
//   2. avisa o gerente de foco quando a ROTA muda;
//   3. desenha as pecas globais (anel, barra, menu rapido, avisos).

import { useEffect } from "react"
import { usePathname } from "next/navigation"

import { gerenteDeInput } from "@/lib/input/manager"
import { gerenteDeExibicao } from "@/lib/display/manager"
import { gerenteDeFoco } from "@/lib/focus/manager"
import { AnelDeFoco } from "./anel-de-foco"
import { AvisoDeControle } from "./aviso-de-controle"
import { BarraDeDicas } from "./barra-de-dicas"
import { DepuracaoDeControle } from "./depuracao-de-controle"
import { IndicadorDeControle } from "./indicador-de-controle"
import { MenuRapido } from "./menu-rapido"

export function SistemaDeInput() {
  useEffect(() => {
    gerenteDeInput.iniciar()
    gerenteDeExibicao.iniciar()
    // Sem `parar()` no cleanup DE PROPOSITO.
    //
    // Em Strict Mode o React monta, desmonta e remonta este efeito. Parar no
    // cleanup derrubaria o laco nativo e as assinaturas entre as duas montagens
    // — e, pior, o `iniciar()` e idempotente mas o `parar()` nao tem como saber
    // que uma remontagem vem em seguida. O sistema de input tem o tempo de vida
    // da JANELA, nao o de um componente; quando a janela morre, o processo morre
    // junto e o laco nativo encerra pelo `parar` do lado Rust.
  }, [])

  // ROTA NOVA: o foco lembrado aponta para elementos que nao existem mais. Sem
  // isto, entrar numa tela e apertar o D-pad tentava restaurar um item da tela
  // anterior e o primeiro movimento sumia.
  const pathname = usePathname()
  useEffect(() => {
    gerenteDeFoco.aoTrocarDeRota()
  }, [pathname])

  return (
    <>
      <AnelDeFoco />
      <BarraDeDicas />
      <MenuRapido />
      <IndicadorDeControle />
      <AvisoDeControle />
      <DepuracaoDeControle />
    </>
  )
}

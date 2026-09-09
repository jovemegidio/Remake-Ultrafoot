"use client"

// QUANTOS AMIGOS ESTAO ONLINE — de verdade.
//
// ⚠️ O QUE ESTE GANCHO SUBSTITUI. A barra do rodape (components/ea-action-bar)
// mostrava DOIS contadores chumbados no codigo: um `1` e um `0`, escritos a mao
// no JSX, com o mesmo icone de pessoas nos dois. O relatorio (PDF Ultra26,
// p.18) marcou exatamente essa area: "ajuste para ser o player de musica e
// exibir quantos players online ou amigos online, ajuste para funcionar
// corretamente com dados reais".
//
// ⚠️ E O QUE ELE SE RECUSA A FAZER: inventar numero. Sem conta ligada, sem rede
// ou com a VPS fora do ar ele devolve `null` — e a barra ESCONDE o contador em
// vez de mostrar zero. Zero e uma afirmacao ("ninguem seu esta online"); a
// ausencia de dado nao e. Mostrar `0` quando nao se sabe e o mesmo tipo de
// mentira que os contadores antigos contavam, so que com mais passos.

import { useEffect, useState } from "react"

import { listarAmigos } from "@/lib/hub-social"
import { contaLogada } from "@/lib/conta-ultrafoot"

/**
 * De quanto em quanto tempo reconsultamos.
 *
 * Trinta segundos porque presenca de amigo nao e dado urgente e cada consulta
 * atravessa a rede ate a VPS. O `system-media-player` pergunta ao sistema local
 * a cada 1,5s — a distancia entre os dois numeros e a distancia entre uma
 * chamada em memoria e uma chamada de rede.
 */
const INTERVALO_MS = 30_000

export interface PresencaDeAmigos {
  /** Quantos amigos estao online agora. */
  online: number
  /** Total de amigos, para o rotulo do `title`. */
  total: number
}

/** `null` = nao sabemos (sem conta, sem rede, ou ainda carregando). */
export function useAmigosOnline(): PresencaDeAmigos | null {
  const [presenca, setPresenca] = useState<PresencaDeAmigos | null>(null)

  useEffect(() => {
    let vivo = true
    let timer: ReturnType<typeof setInterval> | undefined

    const consultar = async () => {
      // Sem conta nao ha lista de amigos — e nem faz sentido bater na VPS.
      // `contaLogada` e assincrona: ela consulta o servidor de contas.
      if (!(await contaLogada())) {
        if (vivo) setPresenca(null)
        return
      }
      try {
        const painel = await listarAmigos()
        if (!vivo) return
        setPresenca({
          online: painel.amigos.filter(a => a.online).length,
          total: painel.amigos.length,
        })
      } catch {
        // Rede fora, VPS fora, sessao expirada: volta a "nao sabemos". Um
        // catch silencioso aqui e proposital — isto e um contador de rodape,
        // nao pode virar erro na tela de quem so quer jogar offline.
        if (vivo) setPresenca(null)
      }
    }

    void consultar()
    const iniciar = () => {
      if (timer) return
      timer = setInterval(() => void consultar(), INTERVALO_MS)
    }
    const parar = () => {
      if (timer) clearInterval(timer)
      timer = undefined
    }
    // Nao consulta a VPS com a janela minimizada, pelo mesmo motivo do
    // system-media-player: ninguem esta olhando.
    const aoTrocarVisibilidade = () => (document.hidden ? parar() : (void consultar(), iniciar()))

    iniciar()
    document.addEventListener("visibilitychange", aoTrocarVisibilidade)
    return () => {
      vivo = false
      parar()
      document.removeEventListener("visibilitychange", aoTrocarVisibilidade)
    }
  }, [])

  return presenca
}

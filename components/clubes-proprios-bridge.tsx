"use client"

/**
 * Publica os clubes criados pelo jogador em `lib/teams-data` assim que o
 * persistent-store fica pronto.
 *
 * ⚠️ Sem isto o clube próprio existe no registro e NÃO existe no jogo: as listas
 * de `teams-data` são montadas na carga do módulo, antes de o store ter lido o
 * arquivo. O sintoma seria o pior tipo — o clube aparece na tela de criação,
 * some da tela de nova carreira, e nada acusa.
 *
 * Fica no layout, e não numa tela, porque qualquer rota pode ser a primeira a
 * resolver um clube por código (uma carreira salva abre direto no escritório).
 */

import { useEffect } from "react"
import { sincronizarClubesProprios } from "@/lib/clubes-proprios-runtime"

export function ClubesPropriosBridge() {
  useEffect(() => {
    // O store pode já estar pronto quando este efeito roda (navegação interna),
    // então sincroniza AGORA e também no aviso — ouvir só o evento perderia o
    // caso mais comum, que é o de quem volta ao menu.
    sincronizarClubesProprios()
    const aoFicarPronto = () => { sincronizarClubesProprios() }
    window.addEventListener("ultrafoot:store:ready", aoFicarPronto)
    window.addEventListener("ultrafoot:clubes-proprios:mudou", aoFicarPronto)
    return () => {
      window.removeEventListener("ultrafoot:store:ready", aoFicarPronto)
      window.removeEventListener("ultrafoot:clubes-proprios:mudou", aoFicarPronto)
    }
  }, [])
  return null
}

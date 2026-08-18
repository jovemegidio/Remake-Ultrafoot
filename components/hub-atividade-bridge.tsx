"use client"

import { useEffect, useRef } from "react"
import { useGameState } from "@/lib/save-system"
import { publicarNoMural } from "@/lib/hub-social"

/**
 * PONTE ENTRE A CARREIRA E O MURAL DO FC HUB.
 *
 * "Acompanhar o que os jogadores estão fazendo" tem duas metades. A presença
 * cobre a primeira (quem está jogando agora) e some em 90 segundos. Esta ponte
 * cobre a segunda: o que ACONTECEU — título ganho, acesso conquistado,
 * contratação de peso —, que é o que os amigos querem ver mesmo quando a pessoa
 * desligou o PC.
 *
 * Fica montada no provider global, como a ponte de finanças/obras: se o aviso
 * dependesse de a pessoa estar numa tela específica na hora, quase nada seria
 * publicado.
 *
 * ## AS DUAS ARMADILHAS QUE ESTA PONTE PRECISA DESVIAR
 *
 * 1. **O save chega DEPOIS do primeiro render.** O estado começa em
 *    `DEFAULT_STATE`; publicar antes de hidratar mandaria a carreira inteira
 *    (dez temporadas de títulos) para o mural dos amigos de uma vez, como se
 *    tivesse acabado de acontecer. Por isso só olhamos com `hydrated` e a
 *    primeira leitura serve de LINHA DE BASE — ela é anotada e não publica nada.
 * 2. **Trocar de save recomeça a base.** Cada carreira tem a sua linha de base
 *    (a chave inclui a carreira), senão abrir uma carreira antiga publicaria os
 *    títulos dela de novo.
 *
 * Ainda assim, o servidor ignora `chave` repetida — é o cinto de segurança para
 * o caso de a linha de base falhar.
 */
export function HubAtividadeBridge() {
  const { state, hydrated } = useGameState()
  // Chaves já vistas nesta carreira. Ref porque mudança aqui não deve
  // re-renderizar nada: esta ponte não desenha.
  const vistos = useRef<Set<string> | null>(null)
  const carreiraDaBase = useRef("")

  useEffect(() => {
    if (!hydrated) return
    const clube = state.selectedTeamShort || ""
    if (!clube) return

    // Identidade da carreira: clube + treinador. Trocou, a linha de base é outra.
    const carreira = `${clube}|${state.managerName || ""}`
    const primeiraVez = carreiraDaBase.current !== carreira
    if (primeiraVez) {
      carreiraDaBase.current = carreira
      vistos.current = new Set()
    }
    const jaVistos = vistos.current ?? new Set()

    const novos: { tipo: "titulo" | "temporada" | "contratacao"; texto: string; chave: string; clube: string }[] = []

    for (const registro of state.seasonHistory ?? []) {
      if (registro.champion && registro.champion === registro.teamCurto) {
        const chave = `titulo:${registro.season}:${registro.competition}`
        if (!jaVistos.has(chave)) {
          jaVistos.add(chave)
          novos.push({
            tipo: "titulo",
            chave,
            clube: registro.teamNome,
            texto: `foi campeão do ${registro.competition} de ${registro.season} com o ${registro.teamNome}`,
          })
        }
      }
      if (registro.promoted) {
        const chave = `acesso:${registro.season}:${registro.competition}`
        if (!jaVistos.has(chave)) {
          jaVistos.add(chave)
          novos.push({
            tipo: "temporada",
            chave,
            clube: registro.teamNome,
            texto: `subiu de divisão com o ${registro.teamNome} na temporada ${registro.season}`,
          })
        }
      }
    }

    // Contratação: só a que vale notícia. Publicar toda compra encheria o mural
    // dos amigos de reforço de reserva, e o que é notícia deixaria de aparecer.
    for (const transferencia of state.transfers ?? []) {
      if (transferencia.type !== "buy" || transferencia.value < 5_000_000) continue
      const chave = `contratacao:${transferencia.id}`
      if (jaVistos.has(chave)) continue
      jaVistos.add(chave)
      novos.push({
        tipo: "contratacao",
        chave,
        clube: transferencia.toTeam,
        texto: `contratou ${transferencia.playerName} para o ${transferencia.toTeam}`,
      })
    }

    vistos.current = jaVistos
    // A PRIMEIRA passada é só linha de base: as chaves ficam anotadas e nada é
    // publicado. Sem isto, abrir um save antigo despejaria a carreira inteira.
    if (primeiraVez || novos.length === 0) return

    for (const evento of novos.slice(0, 5)) {
      // Best-effort e sem await encadeado na tela: sem conta, sem rede ou com o
      // servidor fora do ar isto simplesmente não acontece, e o jogo segue.
      void publicarNoMural(evento)
    }
  }, [hydrated, state.seasonHistory, state.transfers, state.selectedTeamShort, state.managerName])

  return null
}

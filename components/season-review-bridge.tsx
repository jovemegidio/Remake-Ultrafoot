"use client"

import { useEffect, useRef } from "react"
import { useGameState } from "@/lib/save-system"
import { useUserTeam } from "@/lib/time-da-carreira"
import { useNotifications } from "@/components/notifications-system"
import { calcSeasonObjective } from "@/lib/board-engine"

/**
 * RECONHECIMENTO DA DIRETORIA no fim de cada temporada (pedido).
 *
 * Detecta a virada (a temporada aumentou), le o ultimo registro em
 * seasonHistory e compara a posicao final com o OBJETIVO da diretoria:
 *   - CAMPEAO ou vice: elogio explicito;
 *   - objetivo cumprido (posicao <= alvo): reconhecimento + renovacao automatica;
 *   - parcial (dentro do minimo, mas abaixo do alvo): diretoria quer NEGOCIAR a
 *     renovacao, com direito a contraproposta;
 *   - falhou (abaixo do minimo / rebaixado): sem renovacao — o tecnico vai para
 *     a Area do Treinador ver as propostas.
 *
 * O RESULTADO fica em `state.renewalStatus` para a Area do Treinador / pre-office
 * agirem. Aqui garantimos o AVISO; a negociacao interativa vive na tela propria.
 */
export function SeasonReviewBridge() {
  const { state, setState } = useGameState()
  const { team } = useUserTeam()
  const { addNotification } = useNotifications()
  const notificar = useRef(addNotification)
  notificar.current = addNotification

  const temporadaVista = useRef<number | null>(null)

  useEffect(() => {
    // Primeira passada: apenas registra a temporada atual sem reagir.
    if (temporadaVista.current === null) {
      temporadaVista.current = state.season
      return
    }
    if (state.season <= temporadaVista.current) return
    temporadaVista.current = state.season

    const historico = state.seasonHistory ?? []
    // O registro recem-fechado e o da temporada ANTERIOR a atual.
    const registro = [...historico].reverse().find(r => r.season === state.season - 1)
    if (!registro || !team) return

    // calcSeasonObjective usa so prestigio/divisao/nome; adaptamos o Team ao
    // SavedTeam esperado com os campos que faltam.
    const objetivo = calcSeasonObjective({
      ...team,
      fileKey: team.file_key ?? team.curto,
      estadio: team.estadio_nome ?? "",
      pais: team.pais ?? "Brasil",
    } as unknown as Parameters<typeof calcSeasonObjective>[0])
    const pos = registro.position
    const foiCampeao = registro.champion && registro.champion === registro.teamCurto
    const cumpriu = pos > 0 && pos <= objetivo.targetPosition
    const parcial = !cumpriu && pos > 0 && pos <= objetivo.minPosition && !registro.relegated
    const falhou = !cumpriu && !parcial

    let status: "auto" | "negociar" | "ofertas"
    let titulo: string
    let mensagem: string

    if (foiCampeao) {
      status = "auto"
      titulo = "A diretoria parabeniza pelo TÍTULO"
      mensagem = `Campeão da ${registro.competition}! A diretoria reconhece o trabalho e renova seu contrato automaticamente para a próxima temporada.`
    } else if (pos === 2) {
      status = cumpriu ? "auto" : "negociar"
      titulo = "Vice-campeão — a diretoria reconhece"
      mensagem = `Um brilhante 2º lugar na ${registro.competition}. A diretoria valoriza a campanha${cumpriu ? " e renova seu contrato." : " e quer conversar sobre a renovação."}`
    } else if (cumpriu) {
      status = "auto"
      titulo = "Objetivo cumprido"
      mensagem = `${objetivo.targetPosition}º ou melhor era a meta e você entregou (${pos}º na ${registro.competition}). A diretoria renova seu contrato automaticamente.`
    } else if (parcial) {
      status = "negociar"
      titulo = "A diretoria quer negociar sua renovação"
      mensagem = `A temporada ficou dentro do aceitável (${pos}º), mas abaixo da meta de ${objetivo.targetPosition}º. A diretoria chama para negociar a renovação — você pode fazer contraproposta na Área do Treinador.`
    } else {
      status = "ofertas"
      titulo = registro.relegated ? "Rebaixamento: contrato não renovado" : "Objetivo não cumprido"
      mensagem = registro.relegated
        ? `O rebaixamento custou caro. A diretoria não renova seu contrato. Veja as propostas de outros clubes na Área do Treinador.`
        : `A meta era ${objetivo.minPosition}º ou melhor e a campanha ficou em ${pos}º. Sem renovação — veja as propostas na Área do Treinador.`
    }

    setState({ renewalStatus: status })
    notificar.current({
      type: "system",
      priority: status === "ofertas" ? "urgent" : "high",
      title: titulo,
      message: mensagem,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.season])

  return null
}

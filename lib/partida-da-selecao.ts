"use client"

import { saveMatchContext } from "@/lib/match-context"
import { nationalTeamToTeam } from "@/lib/save-system"
import { getNationalTeamById, type NationalTeam } from "@/lib/national-teams"
import type { NationalFixture, NationalCompetitionState } from "@/lib/national-competitions"
import type { Team } from "@/lib/teams-data"

/**
 * PONTE ENTRE A SELECAO E O MOTOR DE PARTIDA.
 *
 * O clube tinha pre-jogo -> ao vivo -> coletiva -> escritorio. A selecao tinha
 * um botao "Jogar proxima partida" que resolvia tudo por simulacao instantanea.
 * Este modulo prepara o contexto para a partida da selecao passar pelo MESMO
 * fluxo do clube, sem duplicar a tela de partida.
 *
 * Selecao nao e clube: `getTeamByShort` nunca acha "BRA". Quem resolve escudo,
 * cores e nome e o banco de selecoes, por isso o contexto marca `national` e
 * quem le a partida usa `timeDaSelecao` em vez do catalogo de clubes.
 */

/** Converte uma selecao em `Team` para o motor de partida. */
export function timeDaSelecao(id: string): Team | null {
  const nt = getNationalTeamById(id)
  return nt ? nationalTeamToTeam(nt) : null
}

/**
 * Grava o contexto da partida da selecao e devolve a rota do pre-jogo.
 *
 * `friendly: true` de proposito: e o que ja existia para dizer "esta partida NAO
 * mexe na temporada do clube" (sem tabela, sem avancar semana). Sem
 * `amistosoSemana`, o caminho de escrita do amistoso do calendario nao dispara —
 * o resultado desta partida volta para a competicao da selecao.
 */
export function prepararPartidaDaSelecao(
  selecao: NationalTeam,
  fixture: NationalFixture,
  competicao: NationalCompetitionState,
): string {
  const usuarioEmCasa = fixture.homeId === selecao.id
  const adversarioId = usuarioEmCasa ? fixture.awayId : fixture.homeId

  saveMatchContext({
    homeShort: fixture.homeCode,
    awayShort: fixture.awayCode,
    homeKit: "home",
    awayKit: "away",
    competition: competicao.competitionName,
    round: fixture.stage || `Rodada ${fixture.round}`,
    friendly: true,
    // Nao e amistoso do calendario do clube — sem isto o placar seria devolvido
    // para `amistososAgendados` e sumiria da competicao da selecao.
    amistosoSemana: undefined,
    national: {
      selecaoId: selecao.id,
      adversarioId,
      usuarioEmCasa,
      mataMata: selecaoEmMataMata(competicao),
    },
  })

  return "/partida"
}

/** Empate em mata-mata de selecao vai para os penaltis, como no clube. */
export function selecaoEmMataMata(competicao: NationalCompetitionState): boolean {
  return competicao.currentRound > competicao.totalGroupRounds
}

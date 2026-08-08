"use client"

/**
 * O TIME DA CARREIRA — a ponte entre o save e os dados de clube/seleção.
 *
 * ⚠️ POR QUE ISTO NÃO MORA MAIS EM `lib/save-system`.
 *
 * Estes quatro pedaços eram os ÚNICOS de lá que precisavam de `teams-data` e
 * `national-teams` em tempo de execução — e `teams-data` traz junto o pool de
 * 2.452 clubes (`imported-bf2026.json`, 8,9 MB), enquanto `national-teams`
 * alcança `players-data` (`real-squads-tm.json`, 3,8 MB).
 *
 * Como `save-system` é usado até pela tela de splash (que só quer LISTAR as
 * carreiras salvas), o jogo baixava e interpretava ~17 MB de JavaScript antes de
 * mostrar o menu principal. Medido em 06/08/2026 na chunk publicada: 17,0 MB
 * (4,7 MB comprimidos) e ~1,1 s só de indexação de módulo num PC de mesa — 4 a 8
 * vezes isso num celular.
 *
 * Separar deixou o `save-system` sem nenhum import pesado. Quem precisa do time
 * importa daqui, e aí sim paga o preço dos dados — o que é justo, porque essas
 * telas mostram elenco, tabela e mercado de qualquer jeito.
 *
 * **Não volte a importar `teams-data`/`national-teams` dentro de
 * `lib/save-system.ts`.** É um import de uma linha que devolve os 17 MB para a
 * abertura do jogo, sem nada na tela denunciando.
 */

import { getTeamByShort, type Team } from "@/lib/teams-data"
import { getNationalTeamById, getNationalStrength, type NationalTeam } from "@/lib/national-teams"
import { getNationalCrestUrl } from "@/lib/national-assets"
import { applyTeamOverride } from "@/lib/team-overrides"
import { useGameState } from "@/lib/save-system"

/**
 * ⚠️ CLUBE NEUTRO, NUNCA UM CLUBE DE VERDADE.
 *
 * Isto era `serieATeams[0]` — e `serieATeams[0]` e o **Botafogo**. Como
 * `useUserTeam` cai aqui enquanto o save nao hidratou (assincrono, acontece em
 * TODA navegacao), qualquer tela que pintasse antes da hidratacao mostrava nome,
 * escudo, cores, estadio e saldo do Botafogo — para quem dirige outro clube.
 * Era o relato "toda pagina que entro aparece dados do Botafogo RJ", e a mesma
 * familia do falso "mock Palmeiras x Botafogo" do pre-jogo.
 *
 * Um placeholder SEM identidade e melhor que o clube errado: a tela aparece
 * vazia por um instante em vez de mentir. O `curto` vazio tambem serve de
 * sentinela — `getTeamByShort("")` nao resolve, entao nada casa com ele por
 * engano.
 *
 * O tipo continua `Team` (e nao `null`) de proposito: dezenas de telas leem
 * `userTeam.nome` direto, e trocar por nulo espalharia `?.` por todo lado sem
 * resolver o que importa, que e nao exibir dado de outro clube.
 */
const FALLBACK_TEAM: Team = {
  nome: "",
  curto: "",
  cidade: "",
  estado: "",
  cor1: "#1f2937",
  cor2: "#111827",
  prestigio: 0,
  torcida: 0,
  estadio_cap: 0,
  saldo: 0,
  file_key: "",
  estadio_nome: "",
  patrocinador: "",
  escudo_url: "",
  divisao: "serie_a",
}

/**
 * Converte uma SELEÇÃO nacional no tipo Team usado por todas as telas (office,
 * central, calendário, elenco, partida). É a peça que permite "comandar uma
 * seleção como um clube" (Task 2): as telas continuam falando `Team`, sem saber
 * se por trás há um clube ou uma seleção.
 *
 * `file_key` recebe o prefixo `nation_` para NÃO colidir com nenhum clube; o
 * `escudo_url` já aponta para o escudo real da seleção, então o TeamCrest resolve
 * pela imagem mesmo sem entrada no mapa de escudos de clubes.
 */
export function nationalTeamToTeam(nt: NationalTeam): Team {
  const forca = getNationalStrength(nt)
  return applyTeamOverride({
    nome: nt.name,
    curto: nt.code,
    cor1: nt.cor1,
    cor2: nt.cor2,
    prestigio: forca,
    saldo: 0,
    // Seleção não tem divisão de liga; sentinela só para satisfazer o tipo.
    divisao: "selecao" as Team["divisao"],
    pais: nt.name,
    cidade: "",
    estado: "",
    torcida: 0,
    estadio_cap: 0,
    file_key: `nation_${nt.id}`,
    estadio_nome: "",
    patrocinador: "",
    escudo_url: getNationalCrestUrl(nt.id),
  })
}

export function useUserTeam(): { team: Team; hydrated: boolean } {
  const { state, hydrated } = useGameState()
  // MODO SELEÇÃO tem prioridade: se o técnico assumiu uma seleção, o "time atual"
  // de todas as telas passa a ser ela. Cai no clube quando o id não resolve.
  const nation = state.managingNationalTeamId ? getNationalTeamById(state.managingNationalTeamId) : null
  const team = nation
    ? nationalTeamToTeam(nation)
    : state.selectedTeamShort
      ? getTeamByShort(state.selectedTeamShort) ?? FALLBACK_TEAM
      : FALLBACK_TEAM
  return { team, hydrated }
}

/**
 * Estado do MODO SELEÇÃO para as telas que precisam adaptar o comportamento
 * (não só o rótulo): elenco vira convocação, calendário usa janelas FIFA, etc.
 */
export function useManagingNational(): { isNational: boolean; nationalTeam: NationalTeam | null; hydrated: boolean } {
  const { state, hydrated } = useGameState()
  const nationalTeam = (state.managingNationalTeamId ? getNationalTeamById(state.managingNationalTeamId) : null) ?? null
  return { isNational: !!nationalTeam, nationalTeam, hydrated }
}

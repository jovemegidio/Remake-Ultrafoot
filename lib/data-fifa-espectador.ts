import {
  CONFEDERATION_LABEL,
  getNationalStrength,
  getNationalTeamsByConfederation,
  type Confederation,
  type NationalTeam,
} from "@/lib/national-teams"
import { getCompetitionDef } from "@/lib/national-competitions"
import { planWindowCompetition, windowLabel } from "@/lib/national-windows"

/**
 * O QUE ACONTECE NO MUNDO DURANTE UMA DATA FIFA COMUM.
 *
 * A Copa do Mundo ja tinha o seu espectador (lib/world-cup-spectator). As demais
 * janelas — Marco, Setembro, Outubro, Novembro e os Junhos sem torneio — nao
 * tinham nada: o clube parava e a tela ficava muda. Aqui geramos os jogos de
 * Eliminatorias / Liga das Nacoes / amistosos das seis confederacoes para o
 * tecnico acompanhar enquanto os dias passam.
 *
 * Determinismo pelo mesmo motivo do Mundial: reabrir o escritorio, recarregar o
 * jogo ou voltar a janela nao pode trocar um placar que o jogador ja leu. Nada
 * disto entra no save — e derivado de (temporada, mes).
 */

export interface JogoDaJanela {
  mandanteId: string
  visitanteId: string
  mandante: string
  visitante: string
  siglaMandante: string
  siglaVisitante: string
  golsMandante: number
  golsVisitante: number
}

export interface BlocoDaJanela {
  confederacao: Confederation
  /** "CONMEBOL" — cabecalho do bloco. */
  rotuloConfederacao: string
  /** "Eliminatorias da Copa", "Liga das Nacoes", "Amistosos". */
  competicao: string
  jogos: JogoDaJanela[]
}

function hash(valor: string): number {
  let r = 2166136261
  for (const c of valor) r = Math.imul(r ^ c.charCodeAt(0), 16777619)
  return r >>> 0
}

/**
 * Embaralhamento por Fisher-Yates com sorteio semeado. NAO usar
 * `sort(() => Math.random() - 0.5)`: alem de nao ser uniforme, mudaria o
 * confronto a cada leitura e quebraria o determinismo.
 */
function embaralharComSemente<T>(itens: readonly T[], semente: string): T[] {
  const saida = [...itens]
  for (let i = saida.length - 1; i > 0; i--) {
    const j = hash(`${semente}:${i}`) % (i + 1)
    ;[saida[i], saida[j]] = [saida[j], saida[i]]
  }
  return saida
}

/** Placar de um jogo de selecao. Mesma curva do espectador do Mundial. */
function disputar(mandante: NationalTeam, visitante: NationalTeam, semente: string): JogoDaJanela {
  // +2 de mando de campo, como no Mundial.
  const forcaMandante = getNationalStrength(mandante) + 2
  const forcaVisitante = getNationalStrength(visitante)
  const sorteioMandante = hash(`${semente}:m`) % 100
  const sorteioVisitante = hash(`${semente}:v`) % 100

  const golsMandante = Math.max(
    0,
    Math.min(5, Math.floor((forcaMandante - 60) / 18) + (sorteioMandante < 55 ? 1 : 0) + (sorteioMandante < 13 ? 1 : 0)),
  )
  const golsVisitante = Math.max(
    0,
    Math.min(5, Math.floor((forcaVisitante - 60) / 20) + (sorteioVisitante < 48 ? 1 : 0) + (sorteioVisitante < 10 ? 1 : 0)),
  )

  return {
    mandanteId: mandante.id,
    visitanteId: visitante.id,
    mandante: mandante.name,
    visitante: visitante.name,
    siglaMandante: mandante.code,
    siglaVisitante: visitante.code,
    golsMandante,
    golsVisitante,
  }
}

const CONFEDERACOES: Confederation[] = ["CONMEBOL", "UEFA", "CONCACAF", "AFC", "CAF", "OFC"]

/** Nome de exibicao da competicao da janela. `amistosos` nao tem def propria. */
function nomeDaCompeticao(competitionId: string): string {
  if (competitionId === "amistosos") return "Amistosos"
  return getCompetitionDef(competitionId)?.name ?? "Amistosos"
}

/**
 * Jogos de selecao da janela FIFA de (temporada, mes).
 *
 * Confederacao com menos de dois times fica de fora — a OFC tem uma selecao so
 * no banco, entao nunca gera bloco. Numero impar deixa um time sem jogo na
 * janela, que e o que acontece de verdade.
 */
export function jogosDaJanelaFifa(temporada: number, mes: number): BlocoDaJanela[] {
  const blocos: BlocoDaJanela[] = []

  for (const confederacao of CONFEDERACOES) {
    const times = getNationalTeamsByConfederation(confederacao)
    if (times.length < 2) continue

    const plano = planWindowCompetition({ season: temporada, month: mes, confederation: confederacao })
    const semente = `janela:${temporada}:${mes}:${confederacao}`
    const sorteados = embaralharComSemente(times, semente)

    const jogos: JogoDaJanela[] = []
    for (let i = 0; i + 1 < sorteados.length; i += 2) {
      jogos.push(disputar(sorteados[i], sorteados[i + 1], `${semente}:${i}`))
    }

    blocos.push({
      confederacao,
      rotuloConfederacao: CONFEDERATION_LABEL[confederacao],
      competicao: nomeDaCompeticao(plano.competitionId),
      jogos,
    })
  }

  return blocos
}

/** "Data FIFA de Marco" — cabecalho do painel. `windowLabel` ja traz o prefixo. */
export function tituloDaJanela(mes: number): string {
  return windowLabel(mes)
}

// VALIDACAO DE PLANTEL — a regra que o editor precisava ter e nao tinha.
//
// A regra dura vem do Brasfoot e e a mesma que o motor de partida assume: um
// clube so escala se tiver goleiro e onze em campo. O resto e ALERTA, nao erro:
// um elenco de 15 e ruim de administrar, mas nao impede o jogo de rodar.
//
// Por que isso importa aqui: com criar/excluir/transferir no editor
// (lib/roster-overrides), da para deixar um clube com 6 atletas sem perceber.
// `ensurePlayableSquad` (players-data) cobre o buraco em silencio inventando
// reservas — o clube joga, mas com nomes que ninguem cadastrou. O aviso existe
// para a pessoa saber ANTES que isso aconteca.

export type NivelDoProblema = "erro" | "alerta"

export interface ProblemaDeElenco {
  nivel: NivelDoProblema
  mensagem: string
}

/** Minimo para o clube ser considerado valido — goleiro + os dez de linha. */
export const MIN_GOLEIROS = 1
export const MIN_LINHA = 11
/** Abaixo disto o elenco nao aguenta uma temporada (mesmo piso do motor). */
export const ELENCO_CONFORTAVEL = 18
/** Acima disto vira folha salarial inutil. */
export const ELENCO_INCHADO = 35

const POSICOES_DE_GOLEIRO = new Set(["GOL", "GK", "G"])

export function ehGoleiro(pos: string): boolean {
  return POSICOES_DE_GOLEIRO.has((pos ?? "").toUpperCase())
}

/**
 * Confere o plantel e devolve os problemas, do mais grave para o menos.
 *
 * Lista vazia = clube valido. Quem consome so precisa perguntar se existe algum
 * item com `nivel === "erro"`.
 */
export function validarElenco(elenco: Array<{ pos: string }>): ProblemaDeElenco[] {
  const goleiros = elenco.filter(p => ehGoleiro(p.pos)).length
  const linha = elenco.length - goleiros
  const problemas: ProblemaDeElenco[] = []

  if (goleiros < MIN_GOLEIROS) problemas.push({ nivel: "erro", mensagem: "O time precisa de pelo menos 1 goleiro." })
  if (linha < MIN_LINHA)
    problemas.push({
      nivel: "erro",
      mensagem: `O time precisa de pelo menos ${MIN_LINHA} jogadores de linha (tem ${linha}).`,
    })

  // Alertas so fazem sentido depois que o basico esta de pe: dizer "tenha dois
  // goleiros" para quem nao tem nenhum e ruido.
  if (goleiros === 1) problemas.push({ nivel: "alerta", mensagem: "Só um goleiro — uma lesão deixa o gol descoberto." })
  if (elenco.length > 0 && elenco.length < ELENCO_CONFORTAVEL)
    problemas.push({
      nivel: "alerta",
      mensagem: `Elenco curto: ${elenco.length} atletas (o recomendado é ${ELENCO_CONFORTAVEL}).`,
    })
  if (elenco.length > ELENCO_INCHADO)
    problemas.push({
      nivel: "alerta",
      mensagem: `Elenco inchado: ${elenco.length} atletas (acima de ${ELENCO_INCHADO} vira folha salarial parada).`,
    })

  return problemas
}

/** Atalho para quem so quer saber se o clube passa. */
export function elencoValido(elenco: Array<{ pos: string }>): boolean {
  return !validarElenco(elenco).some(p => p.nivel === "erro")
}

// PONTE ENTRE O XI DA TELA E O ELENCO DO MOTOR.
//
// Modulo proprio, sem dependencia de seeds nem de React, para poder ser testado
// isolado — este casamento ja foi origem de dois defeitos (homonimo escalado em
// dobro e titular trocado pelo xara) e merece teste.

/** So o que o casamento precisa: a tela e o motor tem formatos bem diferentes. */
export interface AtletaIdentificavel {
  id: number
  name: string
}

/**
 * Traduz o XI da TELA para os ids do MOTOR.
 *
 * As telas casavam titular por NOME porque "os ids divergem do engine". Isso e
 * verdade so no caminho de fallback do roster (`buildElencoPlayers`, que numera
 * por indice do array); quando o elenco vem do motor — o caso normal de qualquer
 * save real — `enginePlayerToElenco` PRESERVA o id do motor, e casar por nome era
 * um desvio desnecessario que ainda por cima erra com homonimo: 33 clubes dos
 * dados reais tem dois atletas de mesmo nome no mesmo elenco, e nao ha como o
 * nome dizer qual dos dois o tecnico escalou.
 *
 * O id vem primeiro. O nome so entra para quem nao casou por id, e mesmo assim
 * contando quantos de cada nome foram escalados — nunca marcando todos os xaras.
 */
export function resolverIdsDosTitulares(
  titularesDaTela: readonly AtletaIdentificavel[],
  squad: readonly AtletaIdentificavel[],
): number[] {
  const porId = new Map(squad.map(p => [p.id, p]))
  const ids: number[] = []
  const semCasamento: AtletaIdentificavel[] = []

  for (const escalado of titularesDaTela) {
    if (porId.has(escalado.id)) ids.push(escalado.id)
    else semCasamento.push(escalado)
  }

  if (semCasamento.length) {
    const jaUsados = new Set(ids)
    const faltam = new Map<string, number>()
    for (const p of semCasamento) faltam.set(p.name, (faltam.get(p.name) ?? 0) + 1)
    for (const ep of squad) {
      if (jaUsados.has(ep.id)) continue
      const restantes = faltam.get(ep.name) ?? 0
      if (restantes <= 0) continue
      faltam.set(ep.name, restantes - 1)
      ids.push(ep.id)
    }
  }

  return ids
}

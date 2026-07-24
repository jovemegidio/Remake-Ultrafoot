// NOME DE EXIBICAO x NOME DO CLUBE.
//
// O jogo tinha um campo so: o nome curto, de exibicao ("Flamengo"). Faltava o
// nome oficial ("Clube de Regatas do Flamengo") — o que aparece em tabela
// oficial, sumula e no editor de equipes.
//
// Os dados sao gerados por scripts/gerar-nomes-oficiais.mjs (curado para os
// clubes conhecidos, derivado do Transfermarkt para o resto) e o jogador pode
// sobrescrever os dois no editor.

import oficiais from "@/data/seeds/club-official-names.json"

// DOIS indices. O `byKey` cobre os clubes do seed; o `byName` cobre os CURADOS
// do teams-data, que tem file_key proprio e nao casariam pela chave (o Liverpool
// tinha nome oficial escrito e mesmo assim saia sem ele).
const DADOS = oficiais as { byKey: Record<string, string>; byName: Record<string, string> }
const POR_CHAVE = DADOS.byKey ?? {}
const POR_NOME = DADOS.byName ?? {}

const normNome = (s: string) => (s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

function buscar(team: { file_key?: string; nome: string }): string | undefined {
  return POR_CHAVE[team.file_key ?? ""] ?? POR_NOME[normNome(team.nome)]
}

/**
 * Nome OFICIAL do clube. Cai no nome de exibicao quando nao temos o oficial —
 * nunca inventa. Uma edicao do jogador (override) vence tudo.
 */
export function nomeOficialDoClube(
  team: { file_key?: string; nome: string },
  override?: string | null,
): string {
  if (override && override.trim()) return override.trim()
  return buscar(team) ?? team.nome
}

/** Ha um nome oficial DIFERENTE do de exibicao para este clube? */
export function temNomeOficialProprio(team: { file_key?: string; nome: string }): boolean {
  const oficial = buscar(team)
  return Boolean(oficial && oficial !== team.nome)
}

export function totalNomesOficiais(): number {
  return new Set([...Object.values(POR_CHAVE), ...Object.values(POR_NOME)]).size
}

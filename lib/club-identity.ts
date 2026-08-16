// IDENTIDADE DE CLUBE PARA AS TELAS (sigla, escudo, cores).
//
// O pool `imported-bf2026.json` (2.994 clubes) traz um campo `curto` que NAO e
// uma sigla: e o `fileKey` em caixa alta, cortado em 8 caracteres e completado
// com X. Dai as siglas que apareciam no mercado:
//
//   MACHESTE  -> Manchester United E Manchester City (a mesma, nos dois!)
//   QUEENSPA  -> Queens Park       FENIXXUR -> Fenix      CAENXFR -> Caen
//   ALVORADO  -> Alvarado          AUSTIN43 -> Austin FC
//
// Sao 2.904 dos 2.994 clubes com 8 caracteres e 138 siglas repetidas entre
// clubes diferentes. O jogador leu isso como "nome corrompido" — e de fato o
// campo esta errado, so nao e o `nome` (esse esta certo no seed).
//
// A sigla ruim vinha junto de um segundo defeito: o clube do pool que TAMBEM
// existe no catalogo curado aparecia com o `fileKey` do pool
// (`machester_ing`), e nao com o do catalogo (`manchester_united`). Como o
// escudo importado no editor de equipes e guardado por `ultrafoot:logo:<fileKey>`
// e o escudo do jogo sai de `getEscudoUrl(file_key)`, a arte certa nunca era
// encontrada e o TeamCrest desenhava o escudo generico com as iniciais ("MAC").
//
// Resolver o clube do pool para o clube CURADO conserta os dois de uma vez:
// sigla de verdade (MUN/MCI), escudo do catalogo e escudo importado no editor.

import { allTeams, type Team } from "@/lib/teams-data"
import { repairMojibake } from "@/lib/text-normalization"
import siglasDesambiguadas from "@/data/seeds/siglas-clubes.json"

/** Palavras que nao ajudam a distinguir clubes ao montar uma sigla. */
const RUIDO = new Set([
  "fc", "sc", "ec", "ca", "cr", "ac", "se", "afc", "cf", "ud", "cd", "cs", "rc", "as", "ss", "us",
  "sv", "sk", "fk", "nk", "kv", "ks", "gd", "sd", "ad", "ce", "aa", "esporte", "esportivo",
  "clube", "club", "futebol", "football", "atletico", "athletic", "de", "do", "da", "dos", "das",
  "del", "the", "el", "la", "los", "and", "e", "y",
])

const semAcento = (s: string) =>
  repairMojibake(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")

/** Nome comparavel entre pool e catalogo (sem acento, caixa, pontuacao e sigla de tipo). */
export function chaveDeClube(nome?: string): string {
  return semAcento(nome ?? "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    .split(" ").filter(w => w && !RUIDO.has(w)).join(" ")
}

/**
 * Sigla legivel a partir do NOME do clube, na mesma convencao do catalogo curado
 * (tres letras: MUN, MCI, FLA). Uma palavra -> tres primeiras letras; duas ->
 * inicial + duas da segunda (Real Madrid = RMA); tres ou mais -> as iniciais.
 */
export function siglaDoNome(nome?: string): string {
  const palavras = semAcento(nome ?? "")
    .toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").trim().split(/\s+/)
    .filter(w => w && !RUIDO.has(w.toLowerCase()))
  const uteis = palavras.length ? palavras : semAcento(nome ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").split(/(?=.)/)
  if (uteis.length === 0) return "???"
  if (uteis.length === 1) return uteis[0].slice(0, 3).padEnd(3, uteis[0][0] ?? "X")
  if (uteis.length === 2) return (uteis[0][0] + uteis[1].slice(0, 2)).slice(0, 3)
  return uteis.slice(0, 3).map(w => w[0]).join("")
}

/**
 * A sigla armazenada e uma sigla de verdade, ou o slug do fileKey?
 * O slug tem 8 caracteres (o corte) ou nao guarda relacao com o nome.
 */
export function siglaEhSlugDeArquivo(curto?: string, nome?: string): boolean {
  const c = (curto ?? "").trim()
  if (!c) return true
  if (c.length >= 8) return true
  const alvo = semAcento(nome ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "")
  // "MCI" nao e prefixo de "MANCHESTERCITY" e mesmo assim e legitima; so
  // acusamos slug quando a sigla e longa (>=5) e nem prefixo do nome e.
  return c.length >= 5 && !alvo.startsWith(c.toUpperCase())
}

/**
 * Desempate das siglas derivadas (gerado por scripts/gerar-siglas-desambiguadas.mjs).
 *
 * Tres letras colidem: "Swansea City", "Stoke City" e "Salford City" derivam
 * todos SCI, e uma tabela com tres SCI e tao ruim quanto o slug de arquivo.
 * O arquivo traz SO os clubes que precisaram de alternativa dentro da propria
 * liga — 182 de 3.064 — e o clube de maior prestigio fica com a sigla base
 * (o Manchester United nao perde MUN para o Maidenhead United).
 */
const DESEMPATE = siglasDesambiguadas as Record<string, string>

/** Sigla boa para exibir: mantem a curada/legitima, troca o slug pela derivada do nome. */
export function siglaExibivel(curto: string | undefined, nome: string | undefined): string {
  if (!siglaEhSlugDeArquivo(curto, nome)) return curto as string
  return DESEMPATE[chaveDeClube(nome)] ?? siglaDoNome(nome)
}

/**
 * Catalogo curado indexado por nome comparavel. Nomes que aparecem em MAIS DE UM
 * clube curado ficam de fora de proposito: Botafogo (RJ/SP/PB) e Barcelona
 * (Espanha/Guayaquil) sao clubes diferentes com o mesmo nome, e casar no
 * homonimo colaria escudo e sigla do time errado — o mesmo risco que a trava de
 * colisao do import do Transfermarkt ja vigia.
 */
let _curados: Map<string, Team> | null = null
function curados(): Map<string, Team> {
  if (_curados) return _curados
  const mapa = new Map<string, Team>()
  const repetidos = new Set<string>()
  for (const t of allTeams) {
    const k = chaveDeClube(t.nome)
    if (!k) continue
    if (mapa.has(k)) { repetidos.add(k); continue }
    mapa.set(k, t)
  }
  for (const k of repetidos) mapa.delete(k)
  _curados = mapa
  return mapa
}

/**
 * Nome OFICIAL por extenso no pool -> file_key do clube curado.
 *
 * O seed passou a usar o nome oficial de alguns clubes ("Olympique Lyonnais",
 * "Lille Olympique Sporting Club"), enquanto o catalogo curado usa o nome curto
 * ("Lyon", "LOSC Lille"). Sem esta ponte o clube perde no mercado a sigla e o
 * escudo do catalogo — inclusive o escudo importado no editor, que e guardado
 * pelo file_key curado.
 *
 * E uma lista A MAO de proposito: casar pelo fileKey sem mais nada colaria o
 * Juventus-SP no Juventus da Italia e o Santos do Mexico no Santos (`juventus_sp`
 * e `santos_mex` viram o mesmo radical do curado). Uma linha por clube renomeado
 * custa pouco e nao tem esse risco.
 */
const OFICIAL_PARA_CURADO: Record<string, string> = {
  "olympique lyonnais": "lyon",
  "lille olympique sporting": "lille",
}

/** O clube curado equivalente a este nome do pool, quando existe sem ambiguidade. */
export function clubeCuradoPorNome(nome?: string): Team | undefined {
  const k = chaveDeClube(nome)
  if (!k) return undefined
  const porOficial = OFICIAL_PARA_CURADO[k]
  if (porOficial) {
    const achado = allTeams.find(t => t.file_key === porOficial)
    if (achado) return achado
  }
  return curados().get(k)
}

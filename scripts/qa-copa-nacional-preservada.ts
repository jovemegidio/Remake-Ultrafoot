/**
 * A COPA NACIONAL NAO PODE SER EXPULSA PELA COPA DA LIGA.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/qa-copa-nacional-preservada.ts
 *
 * ⚠️ ESTE PORTAO NASCEU DE UM DEFEITO MEU, pego antes de publicar (1.0.384).
 *
 * O calendario escolhe as copas assim: se `competitionsByLeague[divisao]` tem
 * alguma copa, ele usa a de maior prestigio como principal e IGNORA o
 * `domesticCup` de `country-competitions.ts`; o `domesticCup` so entra por
 * FALLBACK, quando o catalogo esta vazio.
 *
 * Escocia, Japao e Argentina viviam do fallback. Ao acrescentar a copa da liga
 * de cada um ao catalogo, eu fiz o catalogo deixar de estar vazio — e a copa da
 * liga virou a PRINCIPAL, apagando a Scottish Cup, a Copa do Imperador e a Copa
 * Argentina do jogo. Somar uma competicao teria SUBTRAIDO tres.
 *
 * ⚠️ O QUE TORNA ISSO PERIGOSO E QUE NADA ACUSA: compila, os outros portoes
 * passam, a contagem "divisoes com copa nacional" continua 154 porque ela le a
 * OUTRA fonte, e o jogador so descobre no primeiro sorteio da temporada.
 */
import { competitionsByLeague } from "@/lib/international-competitions"
import { LEAGUE_COMPETITIONS } from "@/lib/country-competitions"

/** Compara ignorando acento, caixa e pontuacao: "Taca Portugal" x "Taça de Portugal". */
function normal(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")
}

/**
 * Mesma competicao escrita de dois jeitos nas duas fontes. Nao e defeito: o
 * calendario joga a copa certa, so o nome diverge entre os arquivos.
 */
const MESMO_TORNEIO_NOME_DIFERENTE = new Set([
  "saudi_pro",        // "King's Cup" x "King Cup" — o apostrofo.
  "primera_div_par",  // "Copa Paraguai" (pt) x "Copa Paraguay" (es).
  "primera_div_bol",  // "Copa Bolivia" x o nome oficial, "Copa de la Division Profesional".
])

/**
 * ⚠️ ESTEVE POVOADO E FOI ESVAZIADO NA 1.0.384. Continha "mls" e "liga_mx":
 * nos dois, o MATA-MATA DO TITULO DA LIGA (MLS Cup Playoffs e Liguilla) estava
 * cadastrado como `type: "cup"` com prestigio acima da copa nacional, e por
 * isso ocupava o lugar dela — a US Open Cup existia no catalogo e NUNCA era
 * disputada.
 *
 * Corrigido baixando o prestigio do playoff da MLS para 40 (abaixo dos 45 da US
 * Open Cup) e alinhando o `domesticCup` do Mexico ao que e de fato jogado, ja
 * que a Copa MX acabou em 2020 e o pais nao tem copa nacional hoje.
 *
 * Fica vazio de proposito, e nao apagado: se um playoff voltar a ser tipado
 * como copa, e aqui que a excecao seria pedida — e ela tem de vir com o motivo
 * escrito, nunca so com o nome da divisao.
 */
const PLAYOFF_TIPADO_COMO_COPA = new Set<string>([])

const falhas: string[] = []
const conhecidos: string[] = []
let comCatalogo = 0

for (const [div, c] of Object.entries(LEAGUE_COMPETITIONS)) {
  const copas = (competitionsByLeague[div] ?? [])
    .filter(x => x.type === "cup")
    .sort((a, b) => b.prestige - a.prestige)
  if (copas.length === 0) continue
  comCatalogo++

  const prometida = c.domesticCup
  if (prometida === "Copa Nacional") continue
  const principal = copas[0]
  const bate =
    normal(principal.name).includes(normal(prometida))
    || normal(prometida).includes(normal(principal.name))
    || normal(principal.shortName ?? "").includes(normal(prometida))
    || normal(prometida).includes(normal(principal.shortName ?? ""))
  if (bate) continue
  if (MESMO_TORNEIO_NOME_DIFERENTE.has(div)) continue

  const linha = `${c.country} (${div}): promete "${prometida}" e o calendario jogaria "${principal.name}"`
  if (PLAYOFF_TIPADO_COMO_COPA.has(div)) conhecidos.push(linha)
  else falhas.push(linha)
}

console.log(`\n  divisoes com copa no catalogo: ${comCatalogo}`)
console.log(`  divergencia nova ............: ${falhas.length}`)
console.log(`  defeito conhecido e nomeado .: ${conhecidos.length}\n`)
for (const k of conhecidos) console.log(`  (conhecido) ${k}`)
for (const f of falhas) console.log(`  ${f}`)

if (falhas.length > 0) {
  console.log("\nA copa da liga tomou o lugar da copa nacional. Acrescente a copa")
  console.log("nacional ao catalogo com prestigio MAIOR que o da copa da liga.\n")
  process.exit(1)
}
console.log("COPA NACIONAL PRESERVADA — a copa da liga entra como segunda, nunca no lugar.\n")

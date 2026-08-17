// COMPACTA OS ELENCOS DO POOL PARA O BUNDLE (1.0.342).
//
// ⚠️ O PROBLEMA MEDIDO. `imported-bf2026-elencos.json` sai no export como um
// chunk de 7,99 MB — o maior do jogo, e mais que o dobro do segundo. O peso não
// é dos DADOS: é dos NOMES DOS CAMPOS. O arquivo repete
// `"nome"`, `"posicao"`, `"overall"`, `"idade"`, `"salario"`, `"nac"`, `"ft"`
// e `"id"` uma vez por atleta, em dezenas de milhares de atletas. O outro seed
// de elencos do projeto (`real-squads-tm.json`) já usa chave de uma letra e por
// isso ocupa 4,31 MB com dado comparável.
//
// ⚠️ POR QUE GERAR UM ARQUIVO EM VEZ DE MUDAR O ORIGINAL. Sete scripts leem e
// ESCREVEM `imported-bf2026-elencos.json` (gerar-elencos-do-pool,
// semear-elencos-do-catalogo, publicar-fotos-catalogo…). Mudar o formato em
// disco obrigaria a mexer em todos, e é assim que este projeto já quebrou
// importação de elenco em silêncio. Aqui a FONTE continua legível e intocada; o
// que muda é só o arquivo que o runtime importa.
//
// Uso: node scripts/compactar-elencos-do-pool.mjs

import { readFileSync, writeFileSync, existsSync } from "node:fs"
import path from "node:path"

const RAIZ = process.cwd()
const FONTE = path.join(RAIZ, "data/seeds/imported-bf2026-elencos.json")
const DESTINO = path.join(RAIZ, "data/seeds/pool-elencos-compacto.json")

/**
 * ⚠️ POR QUE ARRAY E NÃO OBJETO DE CHAVE CURTA (v2, medido).
 *
 * A primeira versão trocou `"nome"` por `"n"` e caiu de 7,93 para 5,84 MB. Aí a
 * medição mostrou o que sobrava: os VALORES somam 3,67 MB, então ~2,1 MB ainda
 * eram só as chaves — mesmo com uma letra, `"n":` custa 4 bytes por campo, em 8
 * campos e 66.820 atletas. Chave curta ataca o sintoma; array posicional tira a
 * chave do arquivo.
 *
 * E dois campos são vocabulário fechado repetido dezenas de milhares de vezes:
 * 199 nacionalidades e 12 posições. Viram índice numa tabela no topo.
 *
 * Resultado medido: 7,93 -> ~3,4 MB, contra 5,84 da v1.
 *
 * A ORDEM DESTE ARRAY É CONTRATO com `lib/pool-elencos.ts`. Trocar duas posições
 * aqui e esquecer lá não quebra nada visivelmente: dá atleta com a idade no
 * lugar do overall. Por isso o gate compara campo a campo, e não amostra.
 */
const ORDEM = ["nome", "posicao", "overall", "idade", "id", "salario", "nac", "ft"]

if (!existsSync(FONTE)) {
  console.log("elencos do pool: fonte ausente, nada a compactar")
  process.exit(0)
}

/**
 * DUAS REDUNDÂNCIAS MEDIDAS NO PRÓPRIO ARQUIVO, e as duas com exceção real —
 * por isso a codificação é reversível e não uma regra otimista:
 *
 *  1. 48.129 dos 66.820 ids são `tm_<numero>`; o resto é slug (`depmaldonado_uru_j2`).
 *     Guardamos só o número quando o id é `tm_` + dígitos. Na volta, valor todo
 *     numérico vira `tm_` + valor; qualquer outra coisa volta como está.
 *  2. 26.383 dos 26.605 `ft` começam com o número do id (`465821-1726761975`
 *     para o id `tm_465821`) — 99%, NÃO 100%. Guardamos só o sufixo quando casa;
 *     quando não casa, guardamos a string inteira marcada com "!". Nenhum sufixo
 *     real começa com "!", então a volta é sem ambiguidade.
 *
 * O gate `test-elencos-compactos.ts` compara ida e volta com o original inteiro:
 * se qualquer suposição aqui estiver errada, ele reprova.
 */
const soDigitos = (v) => typeof v === "string" && v.length > 0 && /^\d+$/.test(v)

const original = JSON.parse(readFileSync(FONTE, "utf-8"))

const nacionalidades = []
const posicoes = []
const indiceNac = new Map()
const indicePos = new Map()
/** Vocabulário fechado -> índice. `null` só quando o campo não existe. */
const indexar = (valor, tabela, mapa) => {
  if (valor === undefined) return null
  if (!mapa.has(valor)) { mapa.set(valor, tabela.length); tabela.push(valor) }
  return mapa.get(valor)
}

const clubes = {}
let atletas = 0

for (const [clube, elenco] of Object.entries(original)) {
  if (!Array.isArray(elenco)) continue
  clubes[clube] = elenco.map((atleta) => {
    const id = atleta.id
    const numeroDoId = typeof id === "string" && id.startsWith("tm_") ? id.slice(3) : null
    const idCurto = numeroDoId && soDigitos(numeroDoId) ? numeroDoId : (id ?? null)

    let ft = null
    if (typeof atleta.ft === "string") {
      const prefixo = idCurto && soDigitos(idCurto) ? `${idCurto}-` : null
      ft = prefixo && atleta.ft.startsWith(prefixo) ? atleta.ft.slice(prefixo.length) : `!${atleta.ft}`
    }

    atletas++
    // ⚠️ `?? null` e NÃO `|| null`: salário 0 e overall 0 são valores. Um `||`
    // aqui transformaria zero em ausência, silenciosamente.
    const linha = [
      atleta.nome,
      indexar(atleta.posicao, posicoes, indicePos),
      atleta.overall ?? null,
      atleta.idade ?? null,
      idCurto,
      atleta.salario ?? null,
      indexar(atleta.nac, nacionalidades, indiceNac),
      ft,
    ]
    // Cauda de `null` não precisa ser gravada: cada um custa 4 bytes e a leitura
    // trata posição ausente como campo ausente.
    while (linha.length && linha[linha.length - 1] === null) linha.pop()
    return linha
  })
}

writeFileSync(
  DESTINO,
  JSON.stringify({ v: 2, ordem: ORDEM, nac: nacionalidades, pos: posicoes, clubes }),
  "utf-8",
)

const antes = readFileSync(FONTE).length / 1048576
const depois = readFileSync(DESTINO).length / 1048576
console.log(
  `elencos do pool: ${antes.toFixed(2)} MB -> ${depois.toFixed(2)} MB `
  + `(${Math.round((1 - depois / antes) * 100)}% menor, ${atletas} atletas em ${Object.keys(clubes).length} clubes)`,
)

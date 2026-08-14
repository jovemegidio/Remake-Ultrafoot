// Entrega os seeds ao webpack como STRING + JSON.parse, em vez de literal de objeto.
//
// POR QUE ISTO EXISTE
//
// `import seed from "@/data/seeds/imported-bf2026.json"` faz o webpack embutir o
// arquivo no chunk como um LITERAL DE OBJETO JavaScript. O V8 entao tem que
// passar o parser completo de JS em 8,9 MB de codigo: cada chave vira um
// identificador, cada valor um no de sintaxe, e nada disso pode ser adiado
// porque o literal esta no topo do modulo.
//
// O mesmo dado como `JSON.parse("...")` usa o parser de JSON do V8, que e uma
// maquina de estados especializada e nao precisa montar arvore de sintaxe. E o
// truque que o proprio time do V8 recomenda para blobs grandes de dado.
//
// MEDIDO NESTE PC em 11/08/2026 (mediana de 3, processo isolado por amostra,
// so os seeds que entram no bundle):
//
//   imported-bf2026.json        8,91 MB   521 ms -> 277 ms
//   real-squads-tm.json         3,92 MB   311 ms -> 113 ms
//   tm-fisico.json              1,16 MB   141 ms ->  36 ms
//   player_photo_overrides.json 1,68 MB    76 ms ->  43 ms
//   faces-manifest.json         1,35 MB    67 ms ->  42 ms
//   (+ 5 menores)
//   ----------------------------------------------------------
//   TOTAL                                1206 ms -> 558 ms   (-54%)
//
// Pelo criterio do proprio `scripts/bench-boot-seeds.ts` (a maquina do jogador e
// 3 a 5 vezes mais lenta), sao 2 a 3 SEGUNDOS a menos por carga de tela pesada.
//
// POR QUE E SEGURO (e por que nao repete os dois recuos de 07/08/2026)
//
// As duas tentativas anteriores mexeram em QUANDO o trabalho acontece — tornar
// `playersByTeam` preguicoso derrubou o office, e o seed "so de clubes" somou
// 1 MB sem remover nada. Aqui nada disso muda: o import continua SINCRONO, o
// valor continua pronto no carregamento do modulo e o objeto resultante e
// identico. Muda so a forma como o dado atravessa o parser.
//
// LIMITE CONHECIDO: `import { algumaChave } from "...json"` deixa de funcionar,
// porque o modulo passa a ser JS e nao ha mais tree-shaking por chave. Hoje
// nenhum import de seed e nomeado (todos sao default) — se um dia alguem
// escrever um, o build quebra na hora, que e o modo certo de descobrir.

/** U+2028/U+2029 sao quebra de linha para o parser de JS, mas JSON.stringify os
 * deixa literais. Dentro de uma string JS eles quebrariam o arquivo. Sao raros,
 * porem aparecem em nome vindo de fonte externa (o Transfermarkt ja mandou). */
const QUEBRAS_INVISIVEIS = new RegExp("[\\u2028\\u2029]", "g")

/** Envolve o JSON numa string JS entre ASPAS SIMPLES. */
function comoLiteralDeString(texto) {
  // Aspas simples de proposito: JSON e feito de aspas DUPLAS, e escapar cada uma
  // delas engordaria o chunk em mais de 1 MB so de contrabarras. Com aspas
  // simples so sobram tres coisas para escapar.
  return (
    "'" +
    texto
      // A contrabarra vem primeiro, senao ela re-escaparia o que veio depois.
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(QUEBRAS_INVISIVEIS, c => "\\u" + c.charCodeAt(0).toString(16)) +
    "'"
  )
}

module.exports = function seedJsonLoader(source) {
  this.cacheable?.(true)

  const texto = typeof source === "string" ? source : String(source)

  // Reserializar tambem MINIFICA (o seed cru vem indentado de varios scripts de
  // importacao) e valida o arquivo: um seed corrompido falha aqui, no build, e
  // nao na tela do jogador.
  const dado = JSON.parse(texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto)
  const canonico = JSON.stringify(dado)

  return `module.exports = JSON.parse(${comoLiteralDeString(canonico)})`
}

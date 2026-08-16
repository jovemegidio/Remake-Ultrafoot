/**
 * PROVA DA REGRA DO ESCUDO FEMININO (1.0.334)
 *
 * O pedido tem duas metades e elas se contradizem se a leitura for ingenua:
 * "os escudos dos times femininos devem ser o mesmo dos masculinos, EXCECAO DE
 * ALGUNS".
 *
 *   1. REGRA — o time feminino desenha o brasão do clube-mãe. Isso ja valia:
 *      o sufixo `__fem` cai na resolucao do asset (senao seriam ~250 arquivos
 *      duplicados no instalador para desenhar a mesma imagem).
 *   2. EXCECAO — o clube que tem brasão feminino PROPRIO desenha o dele. Isso
 *      NAO valia para a arte empacotada: o sufixo caia antes de qualquer
 *      consulta, entao um arquivo `<clube>__fem` no build nunca seria achado.
 *      (Pelas camadas de usuario/canal/mod ja funcionava — quem desenha passa
 *      por getCustomLogoUrl, que nao corta o sufixo.)
 *
 *   npx tsx scripts/test-escudo-feminino.ts
 */
import { getLocalEscudoPath, localEscudoMap } from "../lib/escudos-map"
import { SUFIXO_FEMININO, chaveDeAssetMasculina } from "../lib/futebol-feminino"

let falhas = 0
const checar = (nome: string, ok: boolean, detalhe = "") => {
  console.log(`${ok ? "OK  " : "FALHA"} ${nome}${detalhe ? " — " + detalhe : ""}`)
  if (!ok) falhas++
}

// 1. REGRA: sem arte propria, o feminino cai no brasão do clube-mãe.
const MAES = ["corinthians_bra", "palmeiras_bra", "flamengo_bra", "barcelona_esp"]
for (const mae of MAES) {
  const fem = `${mae}${SUFIXO_FEMININO}`
  if (localEscudoMap[fem]) continue // esse tem arte propria: e caso da excecao
  checar(`${mae}: feminino usa o brasão do clube-mãe`,
    getLocalEscudoPath(fem) === getLocalEscudoPath(mae),
    getLocalEscudoPath(fem))
}

// 2. A chave de asset realmente perde o sufixo.
checar("chaveDeAssetMasculina corta o sufixo",
  chaveDeAssetMasculina(`corinthians_bra${SUFIXO_FEMININO}`) === "corinthians_bra")
checar("chave sem sufixo passa intacta",
  chaveDeAssetMasculina("corinthians_bra") === "corinthians_bra")
checar("sufixo tem DOIS sublinhados (clube que termina em 'fem' nao pode ser cortado)",
  SUFIXO_FEMININO === "__fem")

// 3. EXCECAO: com arte propria empacotada, ela vence o brasão do clube-mãe.
//    Injetada aqui porque a prova e do CAMINHO, e nao de um clube especifico —
//    quem publicar a arte no futuro cai exatamente neste caminho.
const CHAVE_TESTE = `clube_de_prova_bra${SUFIXO_FEMININO}`
localEscudoMap["clube_de_prova_bra"] = "/escudos/clube_de_prova_bra.webp"
localEscudoMap[CHAVE_TESTE] = "/escudos/clube_de_prova_bra__fem.webp"
checar("com brasão próprio, a excecao vence",
  getLocalEscudoPath(CHAVE_TESTE) === "/escudos/clube_de_prova_bra__fem.webp",
  getLocalEscudoPath(CHAVE_TESTE))
delete localEscudoMap[CHAVE_TESTE]
checar("tirada a arte propria, volta para o clube-mãe",
  getLocalEscudoPath(CHAVE_TESTE) === "/escudos/clube_de_prova_bra.webp",
  getLocalEscudoPath(CHAVE_TESTE))
delete localEscudoMap["clube_de_prova_bra"]

// 4. Quantas artes femininas proprias existem hoje no build.
const proprias = Object.keys(localEscudoMap).filter(k => k.endsWith(SUFIXO_FEMININO))
console.log(`\nbrasões femininos próprios empacotados: ${proprias.length}`)
if (proprias.length) console.log("  " + proprias.slice(0, 12).join(", "))

console.log(falhas === 0 ? "\nESCUDO FEMININO OK" : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)

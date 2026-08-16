/**
 * PROVA DAS SIGLAS LEGIVEIS (1.0.334)
 *
 * O `curto` do pool NAO e uma sigla: e o fileKey em maiusculas, cortado em 8
 * letras e completado com X. Por isso "Manchester City" virava MACHESTE,
 * "Queens Park Rangers" virava QUEENSPA e vinte e dois clubes diferentes
 * dividiam a mesma "DEPORTIV" na tela. Como o `curto` tambem e a CHAVE das
 * tabelas, dos jogos e do save, ele nao pode ser reescrito no dado — a correcao
 * mora na exibicao (`siglaExibivel`).
 *
 * Este teste prova as duas metades:
 *   1. a sigla mostrada e legivel e derivada do NOME;
 *   2. a sigla curada de verdade (FLA, MCI) continua intacta.
 *
 *   npx tsx scripts/test-siglas-legiveis.ts
 */
import { siglaExibivel, siglaDoNome, siglaEhSlugDeArquivo } from "../lib/club-identity"

let falhas = 0
const checar = (nome: string, ok: boolean, detalhe = "") => {
  console.log(`${ok ? "OK  " : "FALHA"} ${nome}${detalhe ? " — " + detalhe : ""}`)
  if (!ok) falhas++
}

// 1. Os casos reais que o usuario via na tela.
const SLUGS: Array<[string, string]> = [
  ["MACHESTE", "Manchester City"],
  ["QUEENSPA", "Queens Park Rangers"],
  ["DEPORTIV", "Deportivo La Coruña"],
  ["SANLOREN", "San Lorenzo"],
  ["JUXREZXM", "Juárez"],
  ["FORTUNAX", "Fortuna Düsseldorf"],
]
for (const [curto, nome] of SLUGS) {
  const sigla = siglaExibivel(curto, nome)
  checar(`"${nome}" nao mostra mais "${curto}"`, sigla !== curto, `mostra "${sigla}"`)
  checar(`"${nome}" cabe em 3 letras`, sigla.length <= 3, `"${sigla}"`)
}

// 2. Siglas de verdade nao podem ser trocadas.
const CURADAS: Array<[string, string]> = [
  ["FLA", "Flamengo"],
  ["MCI", "Manchester City"],
  ["RMA", "Real Madrid"],
  ["PAL", "Palmeiras"],
]
for (const [curto, nome] of CURADAS) {
  checar(`"${nome}" mantem a sigla curada ${curto}`, siglaExibivel(curto, nome) === curto, siglaExibivel(curto, nome))
}

// 3. A derivacao segue a convencao do catalogo (uma palavra / duas / tres+).
checar("uma palavra -> 3 primeiras letras", siglaDoNome("Flamengo") === "FLA", siglaDoNome("Flamengo"))
checar("duas palavras -> inicial + 2", siglaDoNome("Real Madrid") === "RMA", siglaDoNome("Real Madrid"))
checar("tres palavras -> iniciais", siglaDoNome("Queens Park Rangers") === "QPR", siglaDoNome("Queens Park Rangers"))
checar("ruido ignorado", siglaDoNome("Sport Club Corinthians") !== "SCC", siglaDoNome("Sport Club Corinthians"))

// 4. O detector nao pode confundir sigla legitima com slug.
checar("MCI nao e slug", !siglaEhSlugDeArquivo("MCI", "Manchester City"))
checar("MACHESTE e slug", siglaEhSlugDeArquivo("MACHESTE", "Manchester City"))
checar("sigla vazia conta como slug", siglaEhSlugDeArquivo("", "Qualquer Clube"))

// 5. DESEMPATE: tres letras colidem, e a tabela nao pode ter dois iguais.
//    O clube de maior prestigio fica com a base; o outro recebe alternativa.
checar("Manchester United mantem MUN", siglaExibivel("MACHESTX", "Manchester United") === "MUN", siglaExibivel("MACHESTX", "Manchester United"))
checar("Maidenhead United nao rouba MUN", siglaExibivel("MAIDENHE", "Maidenhead United") !== "MUN", siglaExibivel("MAIDENHE", "Maidenhead United"))
checar("Stoke City sai de SCI", siglaExibivel("STOKECIT", "Stoke City") !== "SCI", siglaExibivel("STOKECIT", "Stoke City"))
checar("Burnley e Bury nao coincidem",
  siglaExibivel("BURNLEYX", "Burnley") !== siglaExibivel("BURYXXXX", "Bury"),
  `${siglaExibivel("BURNLEYX", "Burnley")} x ${siglaExibivel("BURYXXXX", "Bury")}`)
checar("Cobresal e Cobreloa nao coincidem",
  siglaExibivel("COBRESAL", "Cobresal") !== siglaExibivel("COBRELOA", "Cobreloa"),
  `${siglaExibivel("COBRESAL", "Cobresal")} x ${siglaExibivel("COBRELOA", "Cobreloa")}`)
checar("desempate cabe em 4 letras", siglaExibivel("STOKECIT", "Stoke City").length <= 4)

// 5b. O desempate NAO pode vazar para quem tem sigla curada.
checar("curada vence o desempate", siglaExibivel("MUN", "Manchester United") === "MUN")

// 6. Sem acento na tela (o SVG do escudo de reserva nao tem fonte para isso).
checar("acento removido", /^[A-Z0-9?]+$/.test(siglaExibivel("ATLETICX", "Atlético Mineiro")), siglaExibivel("ATLETICX", "Atlético Mineiro"))

console.log(falhas === 0 ? "\nSIGLAS OK" : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)

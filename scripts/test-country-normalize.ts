// Normalização do país do clube.
//
// Rodar: npx tsx scripts/test-country-normalize.ts

import { readFileSync } from "node:fs"
import path from "node:path"
import { normalizeCountry, PAIS_DESCONHECIDO } from "../lib/country-normalize"

let falhas = 0
function check(nome: string, atual: string, esperado: string) {
  const ok = atual === esperado
  if (!ok) falhas++
  console.log(`${ok ? "  ok  " : " FALHA"} ${nome}${ok ? "" : ` — esperado "${esperado}", veio "${atual}"`}`)
}

console.log("\nColisão UF brasileira x código de país (a armadilha)\n")

// Estes são os casos que quase me fizeram mandar clubes brasileiros para o país
// errado. "SP" parece Espanha e é São Paulo.
check('"SP" é São Paulo, não Espanha', normalizeCountry("SP"), "Brasil")
check('"AL" é Alagoas, não Albânia', normalizeCountry("AL"), "Brasil")
check('"PR" é Paraná, não Porto Rico', normalizeCountry("PR"), "Brasil")
check('"AM" é Amazonas, não Armênia', normalizeCountry("AM"), "Brasil")
check('"BA" é Bahia', normalizeCountry("BA"), "Brasil")
check('"RJ" é Rio de Janeiro', normalizeCountry("RJ"), "Brasil")
check('"BR" é Brasil', normalizeCountry("BR"), "Brasil")

console.log("\nCódigos de país legítimos\n")

check('"ALB" é Albânia', normalizeCountry("ALB"), "Albânia")
check('"ARA" é Arábia Saudita', normalizeCountry("ARA"), "Arábia Saudita")
check('"AFS" é África do Sul', normalizeCountry("AFS"), "África do Sul")
check('"CHN" é China', normalizeCountry("CHN"), "China")

console.log("\nLixo de parsing vira Indefinido, não um país errado\n")

check('"172" não é país', normalizeCountry("172"), PAIS_DESCONHECIDO)
check('"B.O" não é país', normalizeCountry("B.O"), PAIS_DESCONHECIDO)
check("vazio não é país", normalizeCountry(""), PAIS_DESCONHECIDO)
check("nulo não é país", normalizeCountry(null), PAIS_DESCONHECIDO)

console.log("\nNomes já canônicos passam intactos\n")

check("Brasil intacto", normalizeCountry("Brasil"), "Brasil")
check("Argentina intacta", normalizeCountry("Argentina"), "Argentina")
check("Alemanha intacta", normalizeCountry("Alemanha"), "Alemanha")

console.log("\nEfeito no banco real\n")

const seed = JSON.parse(
  readFileSync(path.join(process.cwd(), "data/seeds/imported-bf2026.json"), "utf8"),
) as { teams: Array<{ pais?: string; nome: string; jogadores?: unknown[] }> }

if (!seed.teams?.length) {
  console.error("FALHA: seed não carregou")
  process.exit(1)
}

const antes = new Set(seed.teams.map(t => t.pais ?? ""))
const depois = new Set(seed.teams.map(t => normalizeCountry(t.pais)))
const brasilAntes = seed.teams.filter(t => t.pais === "Brasil").length
const brasilDepois = seed.teams.filter(t => normalizeCountry(t.pais) === "Brasil").length

console.log(`  valores distintos: ${antes.size} -> ${depois.size}`)
console.log(`  clubes no Brasil:  ${brasilAntes} -> ${brasilDepois} (+${brasilDepois - brasilAntes} reunificados)`)
console.log(`  indefinidos:       ${seed.teams.filter(t => normalizeCountry(t.pais) === PAIS_DESCONHECIDO).length}`)

// Estas duas verificacoes mudaram de forma em 22/07/2026. Antes o seed guardava
// o defeito (UF e codigo de pais no campo `pais`) e o teste exigia que o
// normalizador o consertasse EM TEMPO DE EXECUCAO. O seed foi corrigido na
// origem por fix-pool-countries.mjs e assign-pool-br-states.mjs, entao ja nao
// ha o que reunificar — exigir aumento fazia o teste falhar justamente porque o
// dado ficou certo. O normalizador segue valendo como protecao para o PROXIMO
// import, que vem da mesma fonte torta.
if (depois.size > antes.size) { console.log("FALHA: normalizacao AUMENTOU os valores distintos"); falhas++ }
if (brasilDepois < brasilAntes) { console.log("FALHA: normalizacao PERDEU clubes brasileiros"); falhas++ }

const SIGLA = /^[A-Z.0-9]{1,3}$/
const siglasQueSobraram = [...depois].filter(pais => SIGLA.test(pais) && pais !== PAIS_DESCONHECIDO)
if (siglasQueSobraram.length > 0) { console.log(`FALHA: ainda passam siglas como pais: ${siglasQueSobraram.join(", ")}`); falhas++ }

const braForaDoBrasil = seed.teams.filter(t =>
  /_bra$/.test(String((t as { fileKey?: string }).fileKey ?? "")) && normalizeCountry(t.pais) !== "Brasil")
if (braForaDoBrasil.length > 0) { console.log(`FALHA: ${braForaDoBrasil.length} clubes com fileKey _bra fora do Brasil`); falhas++ }

console.log(`\n${falhas === 0 ? "TODOS OS TESTES PASSARAM" : `${falhas} FALHA(S)`}\n`)
process.exit(falhas === 0 ? 0 : 1)

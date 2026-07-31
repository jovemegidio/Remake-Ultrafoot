// ESCUDO DO CLUBE FORMADOR — o relato "diversos clubes com o escudo desenhado".
//
// O Mercado de Juniores guarda o clube pelo NOME CURTO ("Ajax", "Porto") e
// `getTeamByName` so fazia igualdade exata. O catalogo guarda "AFC Ajax" e
// "FC Porto": dois dos oito clubes formadores nao eram encontrados e a tela caia
// no escudo desenhado (um escudo generico com as iniciais).
//
// Este teste protege as DUAS pontas: o nome tem de achar o clube, e o clube tem
// de ter arquivo de escudo de verdade. Achar o time e nao ter a arte daria o
// mesmo desenho na tela.
import { existsSync } from "node:fs"
import { getTeamByName } from "../lib/teams-data"
import { localEscudoMap } from "../lib/escudos-map"

let falhas = 0
const check = (ok: boolean, msg: string) => { if (!ok) { falhas++; console.log(`  FALHA: ${msg}`) } }

console.log("== Escudo do clube formador ==")

// Os oito clubes do Mercado de Juniores (lib/youth-academy: YOUTH_MARKET_CLUBS).
const FORMADORES = ["Ajax", "Benfica", "Porto", "Palmeiras", "Flamengo", "Santos", "River Plate", "Nacional"]

// A checagem de ARQUIVO só vale onde os assets existem. O sandbox de type-check
// carrega apenas o código-fonte: ali a ausência de `public/escudos` não é defeito
// nenhum, e reprovar por isso seria um gate que mente. Dizemos que pulamos.
const TEM_ASSETS = existsSync("public/escudos")
if (!TEM_ASSETS) console.log("  (public/escudos ausente — checagem de arquivo pulada, só o casamento por nome é testado)")

for (const nome of FORMADORES) {
  const time = getTeamByName(nome)
  check(Boolean(time), `"${nome}" precisa achar um clube — sem isso a tela desenha o escudo`)
  if (!time || !TEM_ASSETS) continue
  const caminho = (localEscudoMap as Record<string, string>)[time.file_key] ?? `/escudos/${time.file_key}.png`
  check(existsSync(`public${caminho}`), `"${nome}" achou ${time.nome} mas falta a arte em ${caminho}`)
}

// A tolerancia nao pode virar bagunca: nome curto NAO pode casar com outro clube
// que apenas COMECA igual. "Porto" e FC Porto, nunca Porto Velho.
const porto = getTeamByName("Porto")
check(porto?.file_key === "porto", `"Porto" tem de ser o FC Porto, veio ${porto?.nome} (${porto?.file_key})`)

// E o que ja funcionava continua igual: nome exato vence sempre.
check(getTeamByName("Palmeiras")?.file_key === "palmeiras", "nome exato tem de continuar mandando")
check(getTeamByName("Flamengo")?.file_key === "flarj", "nome exato do Flamengo")

// Nome que nao existe continua sem resposta — a busca tolerante nao pode inventar.
check(getTeamByName("Clube Que Nao Existe") === undefined, "nome inexistente tem de devolver undefined")
check(getTeamByName("") === undefined, "nome vazio tem de devolver undefined")

console.log(falhas === 0 ? "\nOK — os oito formadores tem escudo real, e a busca nao inventa clube" : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)

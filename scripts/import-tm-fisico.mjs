// ALTURA E PE REAIS, do Transfermarkt, para o pool inteiro.
//
//   node scripts/import-tm-fisico.mjs --limite 3      # amostra
//   node scripts/import-tm-fisico.mjs                 # tudo (retomavel)
//
// ⚠️ O QUE ISTO CORRIGE: altura e pe NUNCA foram dados — eram sorteados a partir
// da posicao em lib/use-user-roster.ts (`seededInt(..., 185, 194)` para GOL/ZAG,
// `170..184` para o resto). Por isso o Neymar aparecia com 1,88m: nao e um caso
// isolado, e TODO atleta esta com medida ficticia.
//
// UMA REQUISICAO POR CLUBE, nao por atleta. A pagina de elenco detalhado
// (`/kader/verein/<id>/plus/1`) traz altura e pe de todos de uma vez: sao ~2.245
// clubes para 52 mil atletas, e nao 66 mil requisicoes.
//
// ⚠️ O TRANSFERMARKT NAO PUBLICA PESO. Altura e pe saem daqui; peso continua
// derivado — mas passa a sair da altura real, e nao de um sorteio solto.
//
// ARMADILHA JA CONHECIDA (ver a memoria do catalogo DF11): a tabela tem colunas
// que variam de linha para linha. Nao contar posicao de coluna — ler pelo
// FORMATO da celula (altura casa `1,92m`; pe e uma de tres palavras).

import { readFile, writeFile, rename } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

const ENTRADA = path.resolve("data/seeds/tm-squads.json")
const SAIDA = path.resolve("data/seeds/tm-fisico.json")
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"

const args = process.argv.slice(2)
const num = (bandeira, padrao) => args.includes(bandeira) ? Number(args[args.indexOf(bandeira) + 1]) : padrao
const limite = num("--limite", 0)
const espera = num("--delay", 1500)
const dorme = ms => new Promise(r => setTimeout(r, ms))

const PE = { direito: "D", esquerdo: "E", ambidestro: "A" }

/** `https://.../fc-santos/startseite/verein/221` -> `.../kader/verein/221/plus/1` */
function urlDoElenco(url) {
  const m = url.match(/^(https?:\/\/[^/]+\/[^/]+)\/[^/]+\/verein\/(\d+)/)
  return m ? `${m[1]}/kader/verein/${m[2]}/plus/1` : null
}

/** tmId -> { a: altura em cm, p: D|E|A }. Le pelo FORMATO, nunca pela coluna. */
function extrair(html) {
  const achados = new Map()
  // Cada atleta comeca no link do proprio perfil; a fatia ate o proximo link
  // contem as celulas dele.
  const partes = html.split(/\/profil\/spieler\//).slice(1)
  for (const parte of partes) {
    const id = parte.match(/^(\d+)/)?.[1]
    if (!id || achados.has(id)) continue
    const janela = parte.slice(0, 3000)
    const celulas = [...janela.matchAll(/<td[^>]*>(.*?)<\/td>/gs)]
      .map(m => m[1].replace(/<[^>]+>/g, "").trim())
      .filter(Boolean)

    let altura = null
    let pe = null
    for (const c of celulas) {
      if (!altura) {
        const m = c.match(/^(\d),(\d{2})\s*m$/)
        // 1,40m–2,20m: fora disso e outra celula que por acaso pareceu altura.
        if (m) {
          const cm = Number(m[1]) * 100 + Number(m[2])
          if (cm >= 140 && cm <= 220) altura = cm
        }
      }
      if (!pe) {
        const p = PE[c.toLowerCase()]
        if (p) pe = p
      }
      if (altura && pe) break
    }
    if (altura || pe) achados.set(id, { ...(altura ? { a: altura } : {}), ...(pe ? { p: pe } : {}) })
  }
  return achados
}

async function main() {
  const cache = JSON.parse(await readFile(ENTRADA, "utf8"))
  const saida = existsSync(SAIDA) ? JSON.parse(await readFile(SAIDA, "utf8")) : { atletas: {}, clubesFeitos: [] }
  const feitos = new Set(saida.clubesFeitos ?? [])

  const clubes = Object.entries(cache.clubs ?? {})
    .filter(([chave, c]) => c.url && urlDoElenco(c.url) && !feitos.has(chave))
  const alvo = limite ? clubes.slice(0, limite) : clubes

  console.log(`clubes pendentes: ${clubes.length}${limite ? ` (processando ${alvo.length})` : ""}`)
  console.log(`atletas ja com dado: ${Object.keys(saida.atletas).length}`)

  let n = 0
  for (const [chave, clube] of alvo) {
    const url = urlDoElenco(clube.url)
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA } })
      if (!r.ok) { console.log(`  ! ${chave}: HTTP ${r.status}`); await dorme(espera); continue }
      const achados = extrair(await r.text())
      for (const [id, dados] of achados) saida.atletas[id] = dados
      feitos.add(chave)
      n++
      if (n % 10 === 0 || n === alvo.length) {
        saida.clubesFeitos = [...feitos]
        // Grava em temporario e move: uma interrupcao no meio nao corrompe o
        // arquivo, e o proximo `node` retoma de onde parou.
        await writeFile(`${SAIDA}.parcial`, JSON.stringify(saida))
        await rename(`${SAIDA}.parcial`, SAIDA)
        process.stdout.write(`\r  ${n}/${alvo.length} clubes · ${Object.keys(saida.atletas).length} atletas`)
      }
    } catch (e) {
      console.log(`  ! ${chave}: ${e.message}`)
    }
    await dorme(espera)
  }

  saida.clubesFeitos = [...feitos]
  await writeFile(`${SAIDA}.parcial`, JSON.stringify(saida))
  await rename(`${SAIDA}.parcial`, SAIDA)
  const comAltura = Object.values(saida.atletas).filter(x => x.a).length
  const comPe = Object.values(saida.atletas).filter(x => x.p).length
  console.log(`\n${Object.keys(saida.atletas).length} atletas · ${comAltura} com altura · ${comPe} com pé`)
}

await main()

// Importa POSIÇÃO e NACIONALIDADE reais do Transfermarkt, elenco por elenco.
//
// Resolve dois relatos de jogador de uma vez:
//   - "Cole Palmer como goleiro / diversos jogadores fora de posição"
//   - nacionalidade inexistente (o chip do mercado era inferido do país do clube)
//
// POR QUE POR ELENCO, e não por atleta: buscar "Fulano futebol" no Google/TM
// devolve *alguém* — não necessariamente o atleta certo. Casando dentro da
// página do CLUBE, o par (clube, nome) é praticamente único e o risco de
// atribuir a nacionalidade da pessoa errada cai a quase zero. São ~2.900
// requisições em vez de 53.406.
//
// Uso:
//   node scripts/import-tm-squads.mjs --limit 20      (teste)
//   node scripts/import-tm-squads.mjs                 (tudo, retomando)
//
// Seguro para interromper: grava o progresso a cada clube e retoma de onde parou.

import { readFile, writeFile, mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

const SEED = path.resolve("data/seeds/imported-bf2026.json")
const OUT = path.resolve("data/seeds/tm-squads.json")
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"

// Versão do parser. Clube gravado com versão anterior é rebaixado e refeito —
// foi assim que a v1 (que só lia o grupo grosso) foi descartada sem eu ter de
// apagar o cache na mão.
const PARSER_V = 2

/**
 * Transfermarkt PT-BR -> códigos do jogo.
 *
 * ⚠️ NÃO usar o title da célula da camisa (`rueckennummer`): ele traz só o GRUPO
 * ("Defensor", "Meio-Campo", "Atacante", "Goleiro") — quatro baldes. Importar
 * por ali transformava TODO lateral em zagueiro e TODO ponta em centroavante,
 * que é exatamente o bug que este script existe para corrigir. A posição real
 * está na sub-tabela, na linha logo abaixo do nome.
 *
 * Por palavra-chave e não por string exata porque o TM alterna entre "Lateral
 * Esq." e "Lateral esquerdo" conforme a página.
 */
function mapPos(txt) {
  const s = (txt || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  if (s.includes("goleiro")) return "GOL"
  // Lateral antes de zagueiro/defensor: "Lateral" não pode cair em ZAG.
  if (s.includes("lateral")) return s.includes("esq") ? "LE" : s.includes("dir") ? "LD" : "LD"
  if (s.includes("zagueiro") || s.includes("libero") || s.includes("defensor")) return "ZAG"
  if (s.includes("volante")) return "VOL"
  // Ponta antes de atacante: "Ponta" não pode cair em ATA.
  if (s.includes("ponta")) return s.includes("esq") ? "PE" : s.includes("dir") ? "PD" : "PD"
  if (s.includes("centroavante") || s.includes("atacante") || s.includes("ataque")) return "ATA"
  if (s.includes("meia") || s.includes("meio")) return "MEI"
  return null
}

const args = process.argv.slice(2)
const limit = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : Infinity
const delayMs = args.includes("--delay") ? Number(args[args.indexOf("--delay") + 1]) : 1500

const sleep = ms => new Promise(r => setTimeout(r, ms))

/** Normaliza nome para casar entre as duas bases (acentos, caixa, pontuação). */
export function nameKey(s) {
  return (s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

/**
 * Busca o clube no TM exigindo que o PAÍS bata. Devolve a URL do elenco ou null.
 *
 * ⚠️ Duas armadilhas que a versão ingênua caiu (teste real):
 *  1. A busca rápida lista JOGADORES primeiro. Pegar o primeiro link
 *     `/startseite/verein/` capturava o clube DO ATLETA homônimo — "Fénix"
 *     (Uruguai) virou "Atlético San Cristóbal II" (Rep. Dominicana).
 *  2. Mesmo dentro dos clubes há homônimos em países diferentes ("CA Fénix"
 *     existe no Uruguai E na Argentina). Sem checar o país, "Orense" (Equador)
 *     virou um clube italiano.
 * Por isso: recorta a seção de CLUBES e só aceita país compatível.
 */
async function findClubUrl(clubName, clubCountry) {
  const q = encodeURIComponent(clubName)
  const url = `https://www.transfermarkt.com.br/schnellsuche/ergebnis/schnellsuche?query=${q}`
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9" } })
  if (!res.ok) return null
  const html = await res.text()

  const i = html.indexOf("Resultados da pesquisa para Clubes")
  if (i < 0) return null
  const secao = html.slice(i, i + 20000)

  const alvoPais = nameKey(clubCountry)
  const alvoNome = nameKey(clubName)
  const candidatos = []
  for (const row of secao.split(/<tr class="(?:odd|even)">/).slice(1)) {
    const link = row.match(/href="(\/[^"]*\/startseite\/verein\/\d+)"[^>]*>\s*([^<]+)/)
    const pais = row.match(/title="([^"]+)"[^>]*class="flaggenrahmen/)
    if (!link) continue
    candidatos.push({ href: link[1], nome: link[2].trim(), pais: pais ? pais[1] : "" })
  }
  if (candidatos.length === 0) return null

  const mesmoPais = candidatos.filter(c => alvoPais && nameKey(c.pais) === alvoPais)
  if (mesmoPais.length === 0) return null // sem país compatível: NÃO adivinha

  // Dentro do país certo, prefere o nome mais próximo (exato > contém > 1º).
  const exato = mesmoPais.find(c => nameKey(c.nome) === alvoNome)
  const contem = mesmoPais.find(c => nameKey(c.nome).includes(alvoNome) || alvoNome.includes(nameKey(c.nome)))
  const escolhido = exato ?? contem ?? mesmoPais[0]
  return `https://www.transfermarkt.com.br${escolhido.href}`
}

/** Extrai [{nome, posicao, nacionalidade}] da página de elenco. */
export function parseSquad(html) {
  const out = []
  // As linhas contêm tabelas aninhadas; cortar por INÍCIO de linha, não por </tr>
  // (o </tr> interno truncava a linha e a bandeira ficava de fora).
  const parts = html.split(/<tr class="(?:odd|even)">/).slice(1)
  for (const row of parts) {
    // Nome + a posição específica, que vem na linha seguinte da sub-tabela.
    const m = row.match(/\/profil\/spieler\/(\d+)">\s*([^<]+?)\s*<\/a>[\s\S]*?<tr>\s*<td>\s*([^<]+?)\s*<\/td>/)
    const nac = row.match(/title="([^"]+)"[^>]*class="flaggenrahmen/)
    if (!m) continue
    out.push({
      tmId: m[1],
      nome: m[2],
      posicaoTM: m[3],
      posicao: mapPos(m[3]),
      nacionalidade: nac ? nac[1] : null,
    })
  }
  return out
}

async function main() {
  const seed = JSON.parse(await readFile(SEED, "utf8"))
  const teams = seed.teams ?? []
  const cache = existsSync(OUT) ? JSON.parse(await readFile(OUT, "utf8")) : { clubs: {}, updatedAt: null }

  // Refaz o que foi gravado por um parser antigo.
  const pendentes = teams.filter(t => (cache.clubs[t.curto]?.v ?? 0) < PARSER_V).slice(0, limit)
  console.log(`${teams.length} clubes no seed | ${Object.keys(cache.clubs).length} já importados | processando ${pendentes.length}`)

  let ok = 0, semClube = 0, erro = 0
  for (const [i, team] of pendentes.entries()) {
    try {
      const url = await findClubUrl(team.nome, team.pais)
      if (!url) { cache.clubs[team.curto] = { v: PARSER_V, nome: team.nome, players: [], naoEncontrado: true }; semClube++; continue }
      await sleep(delayMs)
      const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9" } })
      const squad = res.ok ? parseSquad(await res.text()) : []
      cache.clubs[team.curto] = { v: PARSER_V, nome: team.nome, url, players: squad }
      ok++
      console.log(`[${i + 1}/${pendentes.length}] ${team.nome}: ${squad.length} atletas`)
    } catch (e) {
      cache.clubs[team.curto] = { v: PARSER_V, nome: team.nome, players: [], erro: String(e).slice(0, 120) }
      erro++
    }
    // Grava a cada clube: interromper nunca perde o que já foi baixado.
    cache.updatedAt = new Date().toISOString()
    await mkdir(path.dirname(OUT), { recursive: true })
    await writeFile(OUT, JSON.stringify(cache, null, 1))
    await sleep(delayMs)
  }

  const totalAtletas = Object.values(cache.clubs).reduce((n, c) => n + (c.players?.length ?? 0), 0)
  console.log(`\nOK: ${ok} | clube não encontrado: ${semClube} | erro: ${erro}`)
  console.log(`Total acumulado: ${totalAtletas} atletas em ${Object.keys(cache.clubs).length} clubes`)
  console.log(`Arquivo: ${OUT}`)
}

if (process.argv[1]?.includes("import-tm-squads")) main()

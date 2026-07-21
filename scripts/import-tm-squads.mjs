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
// Concorrência modesta de propósito: 2.947 clubes em série levariam ~4h. Quatro
// tarefas, cada uma ainda respeitando o delay, derrubam para ~1h sem virar
// enxurrada em cima do site.
const conc = args.includes("--conc") ? Number(args[args.indexOf("--conc") + 1]) : 4

const sleep = ms => new Promise(r => setTimeout(r, ms))

/** Normaliza nome para casar entre as duas bases (acentos, caixa, pontuação). */
export function nameKey(s) {
  return (s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

// O campo `pais` do seed é inconsistente: às vezes nome inteiro ("Uruguai"),
// às vezes sigla ("ENG", "FR", "UZB"), às vezes UF brasileira ("RJ"). Comparar
// cru contra o nome em português do Transfermarkt reprovava TODO clube com
// sigla — Preston, Caen e Bristol City caíam por isso, não por não existirem.
const PAIS_ALIAS = {
  eng: "inglaterra", gbr: "inglaterra", uk: "inglaterra", sco: "escocia", wal: "gales", nir: "irlanda do norte",
  fr: "franca", fra: "franca", esp: "espanha", es: "espanha", ita: "italia", it: "italia",
  ale: "alemanha", ger: "alemanha", de: "alemanha", por: "portugal", pt: "portugal",
  hol: "paises baixos", ned: "paises baixos", nl: "paises baixos", holanda: "paises baixos",
  bel: "belgica", sui: "suica", tur: "turquia", gre: "grecia", rus: "russia", ucr: "ucrania",
  aut: "austria", din: "dinamarca", sue: "suecia", nor: "noruega", fin: "finlandia",
  pol: "polonia", tch: "republica tcheca", cze: "republica tcheca", cro: "croacia",
  ser: "servia", srb: "servia", rom: "romenia", bul: "bulgaria", hun: "hungria",
  esl: "eslovenia", svn: "eslovenia", elv: "eslovenia", svk: "eslovaquia",
  uzb: "uzbequistao", jap: "japao", jpn: "japao", cor: "coreia do sul", kor: "coreia do sul",
  chn: "china", ara: "arabia saudita", ksa: "arabia saudita", eau: "emirados arabes unidos",
  eua: "estados unidos", usa: "estados unidos", mex: "mexico", can: "canada",
  arg: "argentina", uru: "uruguai", ury: "uruguai", par: "paraguai", chi: "chile",
  col: "colombia", equ: "equador", ecu: "equador", per: "peru", bol: "bolivia", ven: "venezuela",
  bra: "brasil", br: "brasil", aus: "australia", mar: "marrocos", egi: "egito", rsa: "africa do sul",
}

// UFs brasileiras: um clube cujo "país" é RJ/SP/MG é, obviamente, do Brasil.
const UF_BR = new Set(["ac","al","ap","am","ba","ce","df","es","go","ma","mt","ms","mg","pa","pb","pr","pe","pi","rj","rn","rs","ro","rr","sc","sp","se","to"])

/** Devolve o país em forma comparável, ou null se não der para saber. */
function paisKey(bruto) {
  const k = nameKey(bruto)
  if (!k) return null
  if (UF_BR.has(k)) return "brasil"
  // "es" é Espírito Santo E Espanha; a UF vence porque o seed usa UF com muito
  // mais frequência do que sigla de país de duas letras.
  return PAIS_ALIAS[k] ?? k
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
/**
 * Devolve { url } | { semClube: true } | { falhou: true }.
 *
 * A distinção importa: "falhou" (HTTP ruim, resposta sem a seção de clubes —
 * tipicamente throttling) NÃO pode virar cache definitivo. Na primeira versão
 * virava, e 39% dos clubes ficavam marcados como inexistentes para sempre
 * enquanto a mesma busca, feita à mão, achava o clube na hora. Seria uma base
 * silenciosamente pela metade se dando por concluída.
 */
async function findClubUrl(clubName, clubCountry, buscar) {
  const q = encodeURIComponent(clubName)
  const url = `https://www.transfermarkt.com.br/schnellsuche/ergebnis/schnellsuche?query=${q}`
  const res = await buscar(url)
  if (!res.ok) return { falhou: true }
  const html = await res.text()

  const i = html.indexOf("Resultados da pesquisa para Clubes")
  if (i < 0) {
    // Sem NENHUMA seção de resultado: resposta anômala, provavelmente bloqueio.
    // Com outras seções presentes, a busca funcionou e o clube é que não existe.
    return html.includes("Resultados da pesquisa") ? { semClube: true } : { falhou: true }
  }
  const secao = html.slice(i, i + 20000)

  const alvoPais = paisKey(clubCountry)
  const alvoNome = nameKey(clubName)
  const candidatos = []
  for (const row of secao.split(/<tr class="(?:odd|even)">/).slice(1)) {
    const link = row.match(/href="(\/[^"]*\/startseite\/verein\/\d+)"[^>]*>\s*([^<]+)/)
    const pais = row.match(/title="([^"]+)"[^>]*class="flaggenrahmen/)
    if (!link) continue
    candidatos.push({ href: link[1], nome: link[2].trim(), pais: pais ? pais[1] : "" })
  }
  if (candidatos.length === 0) return { semClube: true }

  // Times B/sub-20 aparecem primeiro em algumas buscas e não são o clube.
  const principal = c => !/\b(ii|b|u\s?\d{2}|sub\s?\d{2})\b/i.test(c.nome)

  const mesmoPais = alvoPais ? candidatos.filter(c => paisKey(c.pais) === alvoPais) : []
  // País desconhecido no seed: aceita só nome IDÊNTICO. Sem essa trava foi que
  // "Fénix" do Uruguai virou um clube dominicano.
  const pool = mesmoPais.length > 0 ? mesmoPais : candidatos.filter(c => nameKey(c.nome) === alvoNome)
  if (pool.length === 0) return { semClube: true }

  const ordenado = [...pool.filter(principal), ...pool.filter(c => !principal(c))]
  const exato = ordenado.find(c => nameKey(c.nome) === alvoNome)
  const contem = ordenado.find(c => nameKey(c.nome).includes(alvoNome) || alvoNome.includes(nameKey(c.nome)))
  const escolhido = exato ?? contem ?? ordenado[0]
  return { url: `https://www.transfermarkt.com.br${escolhido.href}` }
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

  let ok = 0, semClube = 0, erro = 0, feitos = 0
  let sujo = false
  const t0 = Date.now()

  // Grava em intervalo, não a cada clube: com várias tarefas em paralelo,
  // reserializar 2.900 clubes a cada resposta custava mais que o download.
  const salvar = async () => {
    if (!sujo) return
    sujo = false
    cache.updatedAt = new Date().toISOString()
    await mkdir(path.dirname(OUT), { recursive: true })
    await writeFile(OUT, JSON.stringify(cache, null, 1))
  }
  const timerSalvar = setInterval(() => { salvar().catch(() => {}) }, 10_000)

  /**
   * Uma tarefa puxa clubes da fila comum. Concorrência baixa e delay mantido por
   * tarefa: o site continua vendo requisições espaçadas, só que intercaladas.
   * Se ele reclamar (429/403), TODAS recuam juntas — ser bloqueado no meio
   * perderia horas de download.
   */
  let proximo = 0
  let pausaAte = 0
  const respeitarPausa = async () => {
    const espera = pausaAte - Date.now()
    if (espera > 0) await sleep(espera)
  }
  const recuar = (segundos, motivo) => {
    pausaAte = Math.max(pausaAte, Date.now() + segundos * 1000)
    console.log(`  ! ${motivo} — pausando ${segundos}s`)
  }

  const buscar = async url => {
    await respeitarPausa()
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9" } })
    if (res.status === 429 || res.status === 403) {
      recuar(60, `HTTP ${res.status}`)
      await respeitarPausa()
      return fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9" } })
    }
    return res
  }

  async function tarefa() {
    while (true) {
      const i = proximo++
      if (i >= pendentes.length) return
      const team = pendentes[i]
      try {
        const achado = await findClubUrl(team.nome, team.pais, buscar)
        if (achado.falhou) {
          // Não grava nada: fica pendente e uma passada posterior tenta de novo.
          erro++
        } else if (achado.semClube) {
          cache.clubs[team.curto] = { v: PARSER_V, nome: team.nome, players: [], naoEncontrado: true }
          semClube++
        } else {
          await sleep(delayMs)
          const res = await buscar(achado.url)
          if (!res.ok) { erro++; feitos++; await sleep(delayMs); continue }
          const squad = parseSquad(await res.text())
          cache.clubs[team.curto] = { v: PARSER_V, nome: team.nome, url: achado.url, players: squad }
          ok++
        }
      } catch {
        erro++ // idem: transitório, não vira registro definitivo
      }
      sujo = true
      feitos++
      if (feitos % 25 === 0) {
        const min = (Date.now() - t0) / 60000
        const restam = ((pendentes.length - feitos) / (feitos / min)).toFixed(0)
        console.log(`${feitos}/${pendentes.length} | ok ${ok} | s/clube ${semClube} | erro ${erro} | ~${restam} min restantes`)
      }
      await sleep(delayMs)
    }
  }

  await Promise.all(Array.from({ length: conc }, tarefa))
  clearInterval(timerSalvar)
  sujo = true
  await salvar()

  const totalAtletas = Object.values(cache.clubs).reduce((n, c) => n + (c.players?.length ?? 0), 0)
  console.log(`\nOK: ${ok} | clube não encontrado: ${semClube} | erro: ${erro}`)
  console.log(`Total acumulado: ${totalAtletas} atletas em ${Object.keys(cache.clubs).length} clubes`)
  console.log(`Tempo: ${((Date.now() - t0) / 60000).toFixed(1)} min`)
  console.log(`Arquivo: ${OUT}`)
}

if (process.argv[1]?.includes("import-tm-squads")) main()

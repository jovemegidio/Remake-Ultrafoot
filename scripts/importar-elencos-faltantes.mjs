// ELENCO REAL PARA CLUBE QUE JÁ EXISTE NO CATÁLOGO.
//
// O `importar-clubes-tm.mjs` CRIA clube (linhas de `Team` + elenco). Aqui o caso
// é o inverso e mais comum: o clube já está em `allTeams`, jogando a liga
// normalmente, e o que falta é o ELENCO — então o jogo completa com atletas
// gerados. Medido na auditoria 4.0: 1.196 atletas gerados em 105 clubes das
// ligas jogáveis (J-League, K-League, Ligue 2, Equador, Escócia, nórdicos,
// andinos), e nenhum deles tinha entrada no `tm-squads.json`.
//
//   node scripts/importar-elencos-faltantes.mjs                  # ensaio
//   node scripts/importar-elencos-faltantes.mjs --gravar
//   node scripts/importar-elencos-faltantes.mjs --limite 20
//
// ⚠️ HOMÔNIMO É O RISCO DESTE SCRIPT, não a rede. "Barcelona" existe na Espanha
// e no Equador; "Arsenal" na Inglaterra, na Argentina, na Rússia e na Ucrânia.
// Casar pelo primeiro resultado da busca colaria o elenco errado — e o erro
// seria SILENCIOSO, porque o elenco existe e parece plausível. Por isso:
//   • a busca confere o PAÍS da página do clube contra o país do catálogo;
//   • time B/sub-20/reserva é descartado pelo nome da URL;
//   • quem não casa com confiança fica de fora e aparece no relatório.
//
// O overall não vem do TM (que não tem esse conceito): é derivado do valor de
// mercado pela mesma curva do `importar-clubes-tm.mjs`.

import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { parseSquad } from "./import-tm-squads.mjs"

const RAIZ = path.resolve(import.meta.dirname, "..")
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
const args = process.argv.slice(2)
const gravar = args.includes("--gravar")
const limite = args.includes("--limite") ? Number(args[args.indexOf("--limite") + 1]) : Infinity
const divisao = args.includes("--divisao") ? args[args.indexOf("--divisao") + 1] : null
const apenasUrlsDiretas = args.includes("--urls-diretas")
const sleep = ms => new Promise(r => setTimeout(r, ms))

const nomeChave = s => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

// ── Overall a partir do valor (mesma curva do importar-clubes-tm) ───────────
function ajusteIdade(idade) {
  if (idade == null) return 0
  if (idade <= 19) return -5
  if (idade === 20) return -4
  if (idade === 21) return -3
  if (idade === 22) return -2
  if (idade === 23) return -1
  if (idade <= 29) return 0
  if (idade === 30) return 1
  if (idade <= 33) return 0
  return -2
}
const ANCORAS = [
  [200_000_000, 91], [80_000_000, 87], [30_000_000, 83], [10_000_000, 78],
  [3_000_000, 72], [1_000_000, 68], [300_000, 63], [50_000, 57],
].map(([v, o]) => [Math.log10(v), o])

function overallDoValor(valor, idade, posicao) {
  if (!valor || valor <= 0) return null
  const x = Math.log10(valor)
  let base
  if (x >= ANCORAS[0][0]) base = Math.min(93, Math.round(ANCORAS[0][1] + (x - ANCORAS[0][0]) * 3))
  else if (x <= ANCORAS.at(-1)[0]) base = Math.max(52, Math.round(ANCORAS.at(-1)[1] + (x - ANCORAS.at(-1)[0]) * 3))
  else {
    base = null
    for (let i = 0; i < ANCORAS.length - 1; i++) {
      const [xa, oa] = ANCORAS[i], [xb, ob] = ANCORAS[i + 1]
      if (x <= xa && x >= xb) { base = Math.round(ob + ((x - xb) / (xa - xb)) * (oa - ob)); break }
    }
  }
  if (base == null) return null
  // Goleiro vale menos no mercado pelo mesmo nível — sem isto todo GOL entra fraco.
  const ajusteGol = posicao === "GOL" ? 3 : 0
  return Math.max(45, Math.min(93, base + ajusteIdade(idade) + ajusteGol))
}

/**
 * Valor de mercado por atleta, lido LINHA A LINHA da mesma tabela do elenco.
 *
 * ⚠️ Duas coisas que a primeira versão errou e que fizeram TODO atleta importado
 * sair com overall 55 (o padrão de "sem valor"):
 *   1. o cifrão vem ANTES do número — `€ 1.50 mi`, não `1.50 mi €`;
 *   2. o link do atleta é `/profil/spieler/<id>`, não `spielprofil/<id>`.
 * Casar por proximidade no HTML inteiro também é frágil; aqui o par (atleta,
 * valor) sai da MESMA linha `<tr>`, que é como o `parseSquad` já lê o elenco.
 *
 * O ponto é separador DECIMAL nesta página (`1.50 mi` = 1,5 milhão): tratá-lo
 * como separador de milhar daria 150 milhões para um atleta da J-League.
 */
function valoresPorTmId(html) {
  const mapa = new Map()
  for (const row of html.split(/<tr class="(?:odd|even)[^"]*">/).slice(1)) {
    const id = row.match(/\/profil\/spieler\/(\d+)/)
    if (!id) continue
    const v = row.match(/€\s*([\d.,]+)\s*(mil|mi|bi)\b/i)
    if (!v) continue
    const n = parseFloat(v[1].replace(",", "."))
    if (!Number.isFinite(n)) continue
    const unidade = v[2].toLowerCase()
    const mult = unidade === "mil" ? 1_000 : unidade === "mi" ? 1_000_000 : 1_000_000_000
    if (!mapa.has(id[1])) mapa.set(id[1], Math.round(n * mult))
  }
  return mapa
}

/** Descarta base, reservas e feminino — o nome da URL denuncia. */
const EH_TIME_SECUNDARIO = /-(u\d{2}|sub\d{2}|reserve|reserves|ii|b|feminino|women|w)$/i

/**
 * País da página do clube, para não colar elenco de homônimo.
 *
 * ⚠️ O `title` vem ANTES do `class` no HTML do TM:
 *   <img ... title="Japão" alt="Japão" class="flaggenrahmen vm lazy lazy" />
 * Procurar `class=...title=` (a ordem intuitiva) não casa NADA — e a primeira
 * versão deste script rejeitou os 4 clubes do ensaio por isso, sem escrever
 * nada. A trava falhando para o lado seguro foi o que salvou.
 *
 * A primeira bandeira da página é a da competição do clube, que é o país dele.
 */
function paisDaPagina(html) {
  const m = html.match(/title="([^"]+)"\s+alt="[^"]*"\s+class="[^"]*flaggenrahmen/i)
  return m ? m[1].trim() : null
}

/** Nomes de país batem? Compara de forma tolerante (PT/EN e acento). */
const APELIDOS_DE_PAIS = {
  "coreia do sul": ["coreia do sul", "south korea", "korea, south", "korea republic", "sudkorea"],
  "japao": ["japao", "japan"],
  "franca": ["franca", "france", "frankreich"],
  "equador": ["equador", "ecuador"],
  "escocia": ["escocia", "scotland", "schottland"],
  "dinamarca": ["dinamarca", "denmark", "danemark"],
  "noruega": ["noruega", "norway", "norwegen"],
  "paraguai": ["paraguai", "paraguay"],
  "peru": ["peru"],
  "chile": ["chile"],
  "uruguai": ["uruguai", "uruguay"],
  "bolivia": ["bolivia"],
  "venezuela": ["venezuela"],
  "grecia": ["grecia", "greece", "griechenland"],
  "chequia": ["chequia", "czech republic", "republica checa", "republica tcheca", "tchequia", "czechia", "tschechien"],
  "azerbaijao": ["azerbaijao", "azerbaijan"],
  "cazaquistao": ["cazaquistao", "kazakhstan"],
  "chipre": ["chipre", "cyprus", "zypern"],
}
function paisBate(doCatalogo, doTm) {
  if (!doTm) return false
  const a = nomeChave(doCatalogo), b = nomeChave(doTm)
  if (!a || a === b) return a === b
  const lista = APELIDOS_DE_PAIS[a]
  return lista ? lista.some(x => nomeChave(x) === b) : a === b
}

/**
 * Baixa com nova tentativa.
 *
 * ⚠️ A primeira versão não tinha retry E só gravava no FIM: um `TypeError:
 * terminated` do undici na página 45 jogou fora 44 clubes já raspados — meia
 * hora de rede perdida por um erro que some sozinho na tentativa seguinte.
 */
async function baixar(url, tentativas = 3) {
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA } })
      if (r.ok) return await r.text()
      // 5xx costuma ser bloqueio momentâneo do TM; 4xx não melhora com espera.
      if (r.status < 500) return ""
    } catch { /* rede caiu: tenta de novo */ }
    if (i < tentativas - 1) await sleep(8000 * (i + 1))
  }
  return ""
}

/** Acha a página do clube no TM, conferindo o país. */
const ALIAS_BUSCA = {
  "1. SK Prostejov": "1. SK Prostějov",
  "FC Banik Ostrava B": "FC Baník Ostrava B",
  "FC Sellier & Bellot Vlasim": "FC Sellier & Bellot Vlašim",
  "FC SILON Taborsko": "FC SILON Táborsko",
  "FC Vysocina Jihlava": "FC Vysočina Jihlava",
  "FK Arsenal Ceska Lipa": "FK Arsenal Česká Lípa",
  "FK Trinec": "FK Třinec",
  "FK VIAGEM Usti nad Labem": "FK VIAGEM Ústí nad Labem",
  "FK Viktoria Zizkov": "FK Viktoria Žižkov",
  "Fotbal Pribram": "Fotbal Příbram",
  "MFK Karvina": "MFK Karviná",
  "SK Hanacka Slavia Kromeriz": "SK Hanácká Slavia Kroměříž",
  "Slezsky FC Opava": "Slezský FC Opava",
}

// URLs confirmadas individualmente. Evitam falsos negativos da busca rápida do
// TM (que frequentemente bloqueia/omite a seção de clubes), sem relaxar o país.
const URL_DIRETA = {
  "1. SK Prostejov": "https://www.transfermarkt.com.br/1-sk-prostejov/startseite/verein/13718",
  "FC Banik Ostrava B": "https://www.transfermarkt.com.br/fc-banik-ostrau-b/startseite/verein/6201",
  "FC Sellier & Bellot Vlasim": "https://www.transfermarkt.com.br/fc-sellier-amp-bellot-vlasim/startseite/verein/13299",
  "FC SILON Taborsko": "https://www.transfermarkt.com.br/fc-silon-taborsko/startseite/verein/28596",
  "FC Vysocina Jihlava": "https://www.transfermarkt.com.br/fc-vysocina-jihlava/startseite/verein/7975",
  "FK Arsenal Ceska Lipa": "https://www.transfermarkt.com.br/arsenal-ceska-lipa/startseite/verein/19077",
  "FK Dukla Praha": "https://www.transfermarkt.com.br/fk-dukla-praga/startseite/verein/450",
  "FK Trinec": "https://www.transfermarkt.com.br/fk-fotbal-trinec/startseite/verein/804",
  "FK VIAGEM Usti nad Labem": "https://www.transfermarkt.com.br/fk-usti-nad-labem/startseite/verein/6377",
  "FK Viktoria Zizkov": "https://www.transfermarkt.com.br/fk-viktoria-zizkov/startseite/verein/892",
  "Fotbal Pribram": "https://www.transfermarkt.com.br/1-fk-pribram/startseite/verein/2598",
  "MFK Karvina": "https://www.transfermarkt.com.br/mfk-karvina/startseite/verein/13726",
  "SK Hanacka Slavia Kromeriz": "https://www.transfermarkt.com.br/sk-hanacka-slavia-kromeriz/startseite/verein/3795",
  "SK Kladno": "https://www.transfermarkt.com.br/sk-kladno/startseite/verein/6380",
  "SK Slavia Praha B": "https://www.transfermarkt.com.br/sk-slavia-prag-b/startseite/verein/6541",
  "Slezsky FC Opava": "https://www.transfermarkt.com.br/slezsky-fc-opava/startseite/verein/479",
}

async function acharClube(nome, pais, aceitarReserva = false) {
  const direta = URL_DIRETA[nome]
  if (direta) {
    const pagina = await baixar(direta)
    const paisTm = paisDaPagina(pagina)
    if (pagina && paisBate(pais, paisTm)) {
      const match = direta.match(/\/([^/]+)\/startseite\/verein\/(\d+)/)
      return { slug: match?.[1] ?? nomeChave(nome).replace(/ /g, "-"), id: match?.[2] ?? "", html: pagina, paisTm }
    }
  }
  nome = ALIAS_BUSCA[nome] ?? nome
  const busca = `https://www.transfermarkt.com.br/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(nome)}`
  const html = await baixar(busca)
  if (!html) return null
  const vistos = new Set()
  const candidatos = []
  for (const m of html.matchAll(/\/([a-z0-9-]+)\/startseite\/verein\/(\d+)/g)) {
    const chave = `${m[1]}/${m[2]}`
    if (vistos.has(chave) || (!aceitarReserva && EH_TIME_SECUNDARIO.test(m[1]))) continue
    vistos.add(chave)
    candidatos.push({ slug: m[1], id: m[2] })
    if (candidatos.length >= 4) break
  }
  for (const c of candidatos) {
    await sleep(4000)
    const pagina = await baixar(`https://www.transfermarkt.com.br/${c.slug}/startseite/verein/${c.id}`)
    if (!pagina) continue
    const paisTm = paisDaPagina(pagina)
    if (paisBate(pais, paisTm)) return { ...c, html: pagina, paisTm }
  }
  return null
}

// ── Quem precisa de elenco ──────────────────────────────────────────────────

const seed = JSON.parse(await readFile(path.join(RAIZ, "data/seeds/imported-bf2026.json"), "utf8"))
const reais = new Set()
for (const t of seed.teams ?? []) for (const j of t.jogadores ?? []) reais.add(nomeChave(j.nome))
const rsPath = path.join(RAIZ, "data/seeds/real-squads-tm.json")
const rs = JSON.parse(await readFile(rsPath, "utf8"))
for (const lista of Object.values(rs)) for (const p of lista) reais.add(nomeChave(p.n))

// A lista de alvos vem de um arquivo gerado pelo medidor (para o script não
// precisar importar o TypeScript do jogo).
const alvos = JSON.parse(await readFile(path.join(RAIZ, "scripts/elencos-faltantes.json"), "utf8"))
  .filter(alvo => !divisao || alvo.divisao === divisao)
  .filter(alvo => !apenasUrlsDiretas || Boolean(URL_DIRETA[alvo.nome]))
  .slice(0, limite)

console.log(`${alvos.length} clubes sem elenco real\n`)

const novos = {}
const semCasar = []
let comElenco = 0

for (const alvo of alvos) {
  const chave = `${alvo.curto}|${nomeChave(alvo.nome)}`
  if (rs[chave]?.length >= 14) { console.log(`  = ${alvo.nome}: ja tinha`); continue }

  const achado = await acharClube(alvo.nome, alvo.pais, alvo.promotionEligible === false)
  if (!achado) {
    semCasar.push(alvo)
    console.log(`  ! ${alvo.nome.padEnd(26)} nao casou (pais ${alvo.pais})`)
    await sleep(4000)
    continue
  }

  const elenco = parseSquad(achado.html)
  const valores = valoresPorTmId(achado.html)
  if (elenco.length < 11) {
    semCasar.push(alvo)
    console.log(`  ! ${alvo.nome.padEnd(26)} elenco curto (${elenco.length}) em ${achado.slug}`)
    await sleep(4000)
    continue
  }

  novos[chave] = elenco.map(p => ({
    n: p.nome,
    p: p.posicao ?? "MEI",
    c: p.nacionalidade ?? "-",
    ...(p.foto ? { f: p.foto.split("/").pop().replace(/\.(jpg|png).*$/i, "") } : {}),
    i: p.idade ?? 24,
    o: overallDoValor(valores.get(p.tmId), p.idade, p.posicao) ?? 55,
    ...(valores.get(p.tmId) != null ? { valor: valores.get(p.tmId) } : {}),
  }))
  comElenco++
  // GRAVA A CADA CLUBE. Acumular para escrever no fim transforma qualquer queda
  // de rede em perda total do que já foi raspado — foi exatamente o que
  // aconteceu na primeira rodada, no 45º clube.
  if (gravar) {
    rs[chave] = novos[chave]
    await writeFile(rsPath, JSON.stringify(rs), "utf8")
  }
  const media = Math.round(novos[chave].reduce((t, p) => t + p.o, 0) / novos[chave].length)
  console.log(`  ok ${alvo.nome.padEnd(26)} ${String(elenco.length).padStart(2)} atletas · ovr ${media} · ${achado.slug} (${achado.paisTm})`)
  // 4s entre paginas: o TM bloqueia rajada devolvendo pagina SEM elenco em vez
  // de erro — a falha e muda, e so o relatorio acusa.
  await sleep(4000)
}

console.log(`\n${comElenco} clubes com elenco novo | ${semCasar.length} sem casar`)
if (semCasar.length) console.log(`nao casaram: ${semCasar.map(a => a.nome).join(", ")}`)

if (!gravar) {
  console.log("\nEnsaio. Use --gravar para escrever o real-squads-tm.json.")
} else {
  // Ja foi gravado clube a clube (ver o aviso em `baixar`); aqui e so o resumo.
  console.log(`\nreal-squads-tm.json: +${Object.keys(novos).length} clubes`)
}

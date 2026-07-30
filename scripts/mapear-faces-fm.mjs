// FM ID -> jogador do Ultrafoot, para usar os rostos do megapack de cutouts.
//
//   node scripts/mapear-faces-fm.mjs nacao 796            # lista as competicoes de um pais
//   node scripts/mapear-faces-fm.mjs varrer 67 12 1846    # varre competicoes (clubes -> jogadores)
//   node scripts/mapear-faces-fm.mjs casar                # cruza o que foi varrido com o nosso elenco
//
// POR QUE ASSIM. O pack tem 68.153 rostos nomeados `face_<FM ID>.png` e nenhum
// nome: saber de quem e cada arquivo exige a base do FM. Consultar ID a ID seriam
// 68 mil requisicoes. Mas a pagina de um CLUBE lista o elenco inteiro com o ID e o
// nome dentro do proprio link (`/person/19273276/eder-militao`) — uma requisicao
// por clube, ~80 jogadores de cada vez. E a pagina da competicao lista os clubes.
// Sao ~20 requisicoes por liga em vez de milhares.
//
// O `config.xml` do pack NAO ajuda: todos os 68.153 registros apontam para
// `person/0/portrait` (o pack veio com o mapeamento quebrado). O que presta ali e
// o lado `from`, que carrega o ID — e e so isso que lemos dele.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs"
import { execFileSync } from "node:child_process"
import path from "node:path"

const RAIZ = path.resolve(import.meta.dirname, "..")
const CACHE = path.join(RAIZ, "data/faces-fm/paginas")
const INDICE = path.join(RAIZ, "data/faces-fm/fm-person-index.json")
const PACK = path.join(RAIZ,
  "sortitoutsi/sortitoutsi_cutout_megapack_2026.07/sortitoutsi/faces/config.xml")
/** IDs do DF11, lidos do indice do .zip (ver README do comando `casar`). */
const DF11 = path.join(RAIZ, "data/faces-fm/df11-ids.txt")
const BASE = "https://sortitoutsi.net/football-manager-2026"
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

const [comando, ...argumentos] = process.argv.slice(2)

// ─── Rede ────────────────────────────────────────────────────────────────────

/**
 * Busca uma pagina, com CACHE EM DISCO.
 *
 * O sortitoutsi responde 403 para bibliotecas HTTP comuns mas aceita curl com
 * user-agent de navegador. O cache existe para a varredura ser retomavel: sao
 * centenas de paginas, e uma queda no meio nao pode custar tudo de novo — nem
 * render uma segunda rodada de requisicoes ao site de outra pessoa.
 */
function buscar(tipo, id, slug = "x") {
  mkdirSync(CACHE, { recursive: true })
  const arquivo = path.join(CACHE, `${tipo}-${id}.html`)
  if (existsSync(arquivo)) return readFileSync(arquivo, "utf-8")

  let ultimoErro = ""
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const html = execFileSync("curl", [
        "-sL", "--max-time", "40", "-A", UA, `${BASE}/${tipo}/${id}/${slug}`,
      ], { encoding: "utf-8", maxBuffer: 32 * 1024 * 1024 })
      // Pagina curta demais e resposta de bloqueio/erro, nao conteudo.
      if (html.length < 5000) throw new Error(`resposta de ${html.length} bytes`)
      writeFileSync(arquivo, html)
      return html
    } catch (e) {
      ultimoErro = e instanceof Error ? e.message : String(e)
      esperar(2000 * tentativa)
    }
  }
  console.log(`  ! ${tipo}/${id}: ${ultimoErro}`)
  return ""
}

/** Pausa entre requisicoes: e o site de outra pessoa, nao vale martelar. */
function esperar(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

// ─── Extracao ────────────────────────────────────────────────────────────────

// ̀-ͯ = marcas de acento combinantes. Escrito escapado de proposito:
// o intervalo literal ja veio corrompido de um editor uma vez.
const semAcento = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
const chave = (s) => semAcento(s).toLowerCase().replace(/[^a-z0-9]/g, "")
const doSlug = (slug) => slug.split("-").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ")

/**
 * Nome do clube pelo <title> da propria pagina.
 *
 * O slug da URL vem ABREVIADO nos clubes brasileiros (`for`, `spo`, `vdg`), e
 * abreviacao de tres letras nao serve para desambiguar homonimo: "Fred do For"
 * nao casa com "Fortaleza", e pior, "san" casaria com Santos, Santa Cruz e Santo
 * Andre ao mesmo tempo. O titulo traz o nome inteiro.
 */
function nomeDoTitulo(html, reserva) {
  const t = html.match(/<title>([^<]+)<\/title>/)?.[1] ?? ""
  const nome = t.split(/\s+FM26\b|\s+-\s+Football Manager/)[0].trim()
  return nome && nome.length > 1 ? nome : doSlug(reserva)
}

const times = (html) => [...new Set(
  [...html.matchAll(/\/football-manager-2026\/team\/(\d+)\/([a-z0-9-]+)/g)].map(m => `${m[1]}|${m[2]}`),
)].map(v => { const [id, slug] = v.split("|"); return { id, slug } })

/**
 * Elenco pela TABELA do clube, com idade e posicao.
 *
 * Pegar os links `/person/...` da pagina inteira trazia tambem comissao tecnica e
 * idolos — o Florentino Perez entrava como se fosse atleta. Pior: sem idade nao
 * havia como separar o Cesar Sampaio ex-jogador (comissao do Santos) do Cesar
 * Sampaio que existe no nosso elenco num clube pequeno. A tabela tem as colunas
 * Name, Age e Position, e so linha de tabela e gente que joga.
 */
function pessoas(html) {
  const saida = new Map()
  for (const linha of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []) {
    const quem = linha.match(/\/person\/(\d+)\/([a-z0-9-]+)/)
    if (!quem) continue
    const celulas = linha.split(/<td/).slice(1).map(c => c
      .replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ")
      .replace(/^\s*>/, "").replace(/\s+/g, " ").trim())
    const posDaIdade = celulas.findIndex(c => /^\d{2}$/.test(c) && +c >= 14 && +c <= 50)
    if (posDaIdade < 0) continue // sem idade na linha: nao e linha de elenco
    saida.set(quem[1], {
      id: quem[1],
      slug: quem[2],
      idade: Number(celulas[posDaIdade]),
      posicao: (celulas[posDaIdade + 1] ?? "").slice(0, 24),
    })
  }
  return [...saida.values()]
}

const competicoes = (html) => [...new Set(
  [...html.matchAll(/\/football-manager-2026\/competition\/(\d+)\/([a-z0-9-]+)/g)].map(m => `${m[1]}|${m[2]}`),
)].map(v => { const [id, slug] = v.split("|"); return { id, slug } })

// ─── Comandos ────────────────────────────────────────────────────────────────

if (comando === "nacao") {
  const [id] = argumentos
  if (!id) throw new Error("uso: nacao <id>   (Espanha=796, Portugal=788, Polonia=787...)")
  const lista = competicoes(buscar("nation", id))
  console.log(`${lista.length} competicoes:`)
  for (const c of lista) console.log(`  ${c.id.padStart(10)}  ${c.slug}`)
  console.log("\nVarra as que interessam:  node scripts/mapear-faces-fm.mjs varrer <ids...>")
  process.exit(0)
}

if (comando === "nacoes") {
  const [de, ate] = argumentos.map(Number)
  if (!de || !ate) throw new Error("uso: nacoes <de> <ate>   (UEFA fica em 755-800, CONMEBOL em 1645-1670)")
  for (let id = de; id <= ate; id++) {
    const html = buscar("nation", id)
    const nome = html ? nomeDoTitulo(html, String(id)) : ""
    if (nome && !/^\d+$/.test(nome) && !/not found/i.test(nome)) console.log(`  ${id}  ${nome}`)
    esperar(600)
  }
  process.exit(0)
}

/**
 * Competicoes de topo de um pais.
 *
 * Heuristica: ID BAIXO. As divisoes principais entraram na base do FM primeiro
 * (Premier=11, Ligue 1=16, Bundesliga=22, Eredivisie=29, Serie A=32, La Liga=67)
 * e as regionais/amadoras receberam IDs enormes depois (2000005024). Ordenar
 * crescente e pegar as primeiras acerta o topo sem eu ter de conhecer o nome da
 * liga de cada pais — a Espanha sozinha lista 101 competicoes.
 */
function topoDaNacao(nacao, quantas) {
  const html = buscar("nation", nacao)
  if (!html) return []
  return competicoes(html)
    .sort((a, b) => Number(a.id) - Number(b.id))
    .slice(0, quantas)
    .map(c => c.id)
}

if (comando === "varrer") {
  if (argumentos.length === 0) {
    throw new Error("uso: varrer <idDaCompeticao|nacao:<id>[:quantas]...>")
  }
  const indice = existsSync(INDICE) ? JSON.parse(readFileSync(INDICE, "utf-8")) : {}
  let novos = 0

  // `nacao:1651:2` vira as 2 competicoes de topo do Brasil.
  const alvos = argumentos.flatMap(a => {
    if (!a.startsWith("nacao:")) return [a]
    const [, id, quantas] = a.split(":")
    const lista = topoDaNacao(id, Number(quantas) || 2)
    console.log(`nacao ${id}: ${lista.join(", ") || "(nenhuma competicao)"}`)
    return lista
  })

  for (const competicao of alvos) {
    const htmlCompeticao = buscar("competition", competicao)
    if (!htmlCompeticao) continue
    const clubes = times(htmlCompeticao)
    console.log(`competicao ${competicao}: ${clubes.length} clubes`)

    for (const clube of clubes) {
      const htmlClube = buscar("team", clube.id, clube.slug)
      if (!htmlClube) continue
      const elenco = pessoas(htmlClube)
      const nomeDoClube = nomeDoTitulo(htmlClube, clube.slug)
      for (const p of elenco) {
        if (!indice[p.id]) novos++
        // Clube E idade juntos: nome sozinho casa homonimo errado, e o clube
        // muda de uma base para a outra (transferencia) — a idade nao.
        indice[p.id] = { nome: doSlug(p.slug), clube: nomeDoClube, idade: p.idade, posicao: p.posicao }
      }
      console.log(`  ${nomeDoClube}: ${elenco.length} pessoas`)
      esperar(1200)
    }
  }

  mkdirSync(path.dirname(INDICE), { recursive: true })
  writeFileSync(INDICE, `${JSON.stringify(indice, null, 1)}\n`)
  console.log(`\nindice: ${Object.keys(indice).length} pessoas (${novos} novas) em ${path.relative(RAIZ, INDICE)}`)
  process.exit(0)
}

if (comando === "casar") {
  if (!existsSync(INDICE)) throw new Error("varra alguma competicao antes (comando `varrer`)")
  const indice = JSON.parse(readFileSync(INDICE, "utf-8"))

  // So interessa ID que TENHA rosto em algum pack — mapear o resto seria mentira.
  //
  // Dois acervos, e o DF11 vem primeiro por ser 3,6x maior (243.681 rostos contra
  // 68.153). A lista do DF11 sai do indice do .zip, sem extrair os 13 GB; a do
  // sortitoutsi sai do `from` do config.xml, unica parte dele que presta.
  const rosto = new Map()
  for (const id of [...readFileSync(PACK, "utf-8").matchAll(/<record from="face_(\d+)"/g)].map(m => m[1])) {
    rosto.set(id, "sortitoutsi")
  }
  if (existsSync(DF11)) {
    for (const id of readFileSync(DF11, "utf-8").split(/\r?\n/)) {
      if (id) rosto.set(id, "df11")
    }
  }
  const comRosto = rosto

  const jogo = JSON.parse(readFileSync(path.join(RAIZ, "data/seeds/imported-bf2026.json"), "utf-8"))
  const porNome = new Map()
  for (const time of jogo.teams ?? []) {
    for (const j of time.jogadores ?? []) {
      const k = chave(j.nome)
      porNome.set(k, [...(porNome.get(k) ?? []), {
        id: j.id, nome: j.nome, clube: time.nome, idade: Number(j.idade) || 0,
      }])
    }
  }

  /** Idades a no maximo um ano de distancia: as duas bases sao de datas diferentes. */
  const mesmaIdade = (a, b) => a > 0 && b > 0 && Math.abs(a - b) <= 1

  // Palavras que aparecem em clube de meio mundo e nao identificam ninguem.
  const GENERICAS = new Set([
    "club", "clube", "futbol", "futebol", "football", "atletico", "atletica",
    "sport", "sporting", "sportivo", "deportivo", "esporte", "esportivo", "asociacion",
    "associacao", "united", "city", "real", "internacional", "nacional", "juventude",
    "athletic", "calcio", "verein", "socios", "sociedad", "regatas", "recreativo",
  ])

  /**
   * Mesmo clube, mesmo escrito diferente.
   *
   * A nossa base abrevia e o FM escreve inteiro: "RB Leipzig" x "RasenBallsport
   * Leipzig", "SC Freiburg" x "Sport-Club Freiburg", "Gimnasia de La Plata" x
   * "Club de Gimnasia y Esgrima". Comparar a string toda reprova todos esses, e
   * eles iam depender da idade para casar — desperdicio de um sinal forte. Basta
   * uma palavra PROPRIA em comum (Leipzig, Freiburg, Gimnasia); "Club" e
   * "Atletico" nao valem, senao meio mundo casaria com meio mundo.
   */
  function mesmoClube(a, b) {
    const x = chave(a), y = chave(b)
    if (!x || !y) return false
    if (x === y || (x.length >= 5 && y.includes(x)) || (y.length >= 5 && x.includes(y))) return true
    const palavras = (s) => new Set(semAcento(s).toLowerCase()
      .split(/[^a-z0-9]+/).filter(p => p.length >= 5 && !GENERICAS.has(p)))
    const pa = palavras(a), pb = palavras(b)
    for (const p of pa) if (pb.has(p)) return true
    return false
  }

  const mapa = {}
  const ambiguos = []
  const outroClube = []
  const perdidos = []
  let semRosto = 0, semJogador = 0, porTransferencia = 0
  for (const [fmId, pessoa] of Object.entries(indice)) {
    if (!comRosto.has(fmId)) { semRosto++; continue }
    const candidatos = porNome.get(chave(pessoa.nome))
    // TEM ROSTO E NAO CASOU e o balde que interessa: ou e gente que o jogo nao
    // tem (comissao tecnica, veterano), ou e o mesmo atleta escrito diferente —
    // e esse segundo caso e rosto perdido a toa. Por isso vai para o relatorio.
    if (!candidatos) { semJogador++; perdidos.push({ fmId, ...pessoa }); continue }
    // O CLUBE E EXIGIDO SEMPRE, mesmo com um unico candidato.
    //
    // Aceitar nome unico sem conferir clube colou o rosto do Mauro Silva do
    // Corinthians num Mauro Silva do Atletico Roraima, e o Jose Sanchez do Sao
    // Paulo virou um do Industrial Aviles. Nome comum existe uma vez no nosso
    // elenco e outra no FM sem serem a mesma pessoa. Rosto errado aparece para
    // todo jogador — e pior do que rosto nenhum.
    //
    const doClube = candidatos.filter(c => mesmoClube(c.clube, pessoa.clube))
    if (doClube.length === 1) {
      mapa[fmId] = doClube[0].id
      continue
    }
    // CLUBE DIFERENTE: pode ser transferencia entre as duas bases, pode ser xara.
    // A idade decide. "Cesar Sampaio" existe duas vezes — o do Santos tem 57 anos
    // (comissao) e o nosso do Horizonte tem 24; sem idade, viraria rosto errado.
    const porIdade = candidatos.filter(c => mesmaIdade(c.idade, pessoa.idade))
    if (porIdade.length === 1) {
      mapa[fmId] = porIdade[0].id
      porTransferencia++
      continue
    }
    const registro = {
      fmId, ...pessoa, candidatos: candidatos.map(c => `${c.nome} (${c.clube}, ${c.idade}a)`),
    }
    if (doClube.length === 0) outroClube.push(registro)
    else ambiguos.push(registro)
  }

  const destino = path.join(RAIZ, "data/seeds/face-id-map.json")
  const anterior = existsSync(destino) ? JSON.parse(readFileSync(destino, "utf-8")) : {}
  // As 5 entradas escritas a mao continuam valendo: sao confirmacoes visuais.
  const final = { ...mapa, ...anterior }
  writeFileSync(destino, `${JSON.stringify(final, null, 2)}\n`)
  // De qual acervo sai cada rosto. Fica FORA do face-id-map porque aquele arquivo
  // ja tem consumidor com formato definido (id do FM -> id do atleta).
  writeFileSync(path.join(RAIZ, "data/faces-fm/origem-do-rosto.json"),
    `${JSON.stringify(Object.fromEntries(
      Object.keys(mapa).map(id => [id, comRosto.get(id)]),
    ), null, 1)}\n`)
  writeFileSync(path.join(RAIZ, "data/faces-fm/casamento-relatorio.json"),
    `${JSON.stringify({
      casados: Object.keys(mapa).length, semRosto, semJogador,
      ambiguos, outroClube, perdidos,
    }, null, 1)}\n`)

  console.log(`casados:       ${Object.keys(mapa).length}  (${porTransferencia} por idade, clube diferente)`)
  console.log(`sem rosto:     ${semRosto}  (esta no FM, nao esta no pack)`)
  console.log(`sem jogador:   ${semJogador}  (tem rosto, nao esta no nosso elenco — tecnico, ídolo)`)
  console.log(`outro clube:   ${outroClube.length}  (mesmo nome em clube diferente: transferencia ou xara)`)
  console.log(`ambiguos:      ${ambiguos.length}`)
  console.log(`gravado em     data/seeds/face-id-map.json  (${Object.keys(final).length} entradas)`)
  process.exit(0)
}

console.log(readFileSync(new URL(import.meta.url)).toString().split("\n").slice(0, 8).join("\n"))

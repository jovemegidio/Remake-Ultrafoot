// Catalogo de estudo do DF11 Classic Megapack FM26: 243 mil PNGs achatados
// `<FM ID>.png` viram uma arvore Pais/Clube/Jogador navegavel.
//
//   node scripts/catalogo-df11.mjs varrer [--nacoes N] [--ligas K]   # cache de paginas (rede)
//   node scripts/catalogo-df11.mjs indexar                           # cache -> fm-catalogo.json (offline)
//   node scripts/catalogo-df11.mjs montar [--sem-anonimos]           # arvore + CSV + HTML
//
// POR QUE ASSIM. O pack nao diz de quem e nenhum rosto: o `config.xml` que deveria
// mapear veio quebrado (todos os registros apontam para `person/0/portrait`). O nome
// so existe na base do FM, e a pagina de CLUBE do sortitoutsi lista o elenco inteiro
// numa tabela com ID, nome, nacionalidade, idade, posicao e valor — uma requisicao
// por clube em vez de 243 mil por jogador.
//
// A ARVORE E FEITA DE HARDLINK, nao de copia. Origem e destino estao no mesmo volume
// NTFS, entao cada rosto aparece nos dois lugares ocupando um espaco so: o pack
// original fica intacto e o catalogo custa ~0 byte. Apagar um lado nao perde o dado.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, linkSync, copyFileSync, rmSync, statSync } from "node:fs"
import { execFileSync } from "node:child_process"
import path from "node:path"

const RAIZ = path.resolve(import.meta.dirname, "..")
const CACHE = path.join(RAIZ, "data/faces-fm/paginas")
const CATALOGO = path.join(RAIZ, "data/faces-fm/fm-catalogo.json")
const MANIFESTO = path.join(RAIZ, "data/faces-fm/catalogo-manifesto.json")
const NACOES = path.join(RAIZ, "data/faces-fm/nacoes-descobertas.json")
const PACK = "C:/Users/SnyX/Downloads/DF11 Classic - Megapack FM26 (Original 13GB)/DF11 Classic - Megapack FM26 (Original 13GB)"
const DESTINO = "C:/Users/SnyX/Downloads/DF11 Catalogo"
const BASE = "https://sortitoutsi.net/football-manager-2026"
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

const argv = process.argv.slice(2)
const comando = argv[0]
const opcao = (nome, padrao) => {
  const i = argv.indexOf(`--${nome}`)
  return i < 0 ? padrao : (argv[i + 1] ?? padrao)
}
const tem = (nome) => argv.includes(`--${nome}`)

// ─── Rede ────────────────────────────────────────────────────────────────────

/**
 * Pagina com cache em disco. O cache e o que torna a varredura retomavel: sao
 * milhares de paginas e uma queda no meio nao pode custar tudo de novo — nem
 * render uma segunda rodada de requisicoes ao site de outra pessoa.
 *
 * `null` = nunca buscamos. `""` gravado como marca de falha permanente (404),
 * para nao insistir a cada execucao.
 */
function buscar(tipo, id, slug = "x", { soCache = false } = {}) {
  mkdirSync(CACHE, { recursive: true })
  const arquivo = path.join(CACHE, `${tipo}-${id}.html`)
  if (existsSync(arquivo)) return readFileSync(arquivo, "utf-8")
  if (soCache) return ""

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

const ENTIDADES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  pound: "£", euro: "€", dollar: "$", eacute: "é", oacute: "ó", aacute: "á",
}
const texto = (s) => String(s ?? "")
  .replace(/<[^>]+>/g, " ")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => ENTIDADES[n.toLowerCase()] ?? m)
  .replace(/\s+/g, " ")
  .trim()

const doSlug = (slug) => slug.split("-")
  .map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ")

/**
 * Nome do clube pelo <title>. O slug da URL vem ABREVIADO nos clubes brasileiros
 * (`for`, `spo`, `vdg`) e abreviacao de tres letras nao identifica ninguem —
 * "san" serve a Santos, Santa Cruz e Santo Andre ao mesmo tempo.
 */
function nomeDoTitulo(html, reserva) {
  const t = html.match(/<title>([^<]+)<\/title>/)?.[1] ?? ""
  const nome = texto(t).split(/\s+FM26\b|\s+-\s+Football Manager/)[0].trim()
  return nome && nome.length > 1 ? nome : doSlug(reserva)
}

/**
 * Nome do pais em portugues, pelo SLUG da URL.
 *
 * O texto visivel varia na propria pagina ("The Netherlands" no breadcrumb,
 * "Netherlands" na bandeira do jogador) e sairiam duas pastas para o mesmo pais.
 * O slug e estavel, entao ele e a chave. Quem faltar fica com o nome em ingles —
 * pasta com nome estranho e melhor do que pasta duplicada.
 */
const PAIS_PT = {
  afghanistan: "Afeganistão", albania: "Albânia", algeria: "Argélia", andorra: "Andorra",
  angola: "Angola", argentina: "Argentina", armenia: "Armênia", aruba: "Aruba",
  australia: "Austrália", austria: "Áustria", azerbaijan: "Azerbaijão",
  bangladesh: "Bangladesh", barbados: "Barbados", belarus: "Bielorrússia",
  belgium: "Bélgica", benin: "Benin", bermuda: "Bermudas", bolivia: "Bolívia",
  bonaire: "Bonaire", "bosnia-and-herzegovina": "Bósnia e Herzegovina",
  botswana: "Botsuana", brazil: "Brasil", bulgaria: "Bulgária",
  "burkina-faso": "Burquina Faso", burundi: "Burundi", cameroon: "Camarões",
  canada: "Canadá", "cape-verde-islands": "Cabo Verde", "cayman-islands": "Ilhas Cayman",
  "central-african-republic": "República Centro-Africana", chad: "Chade", chile: "Chile",
  "china-pr": "China", colombia: "Colômbia", comoros: "Comores", congo: "Congo",
  "costa-rica": "Costa Rica", croatia: "Croácia", cuba: "Cuba", curacao: "Curaçao",
  cyprus: "Chipre", czechia: "Chéquia", "democratic-republic-of-congo": "República Democrática do Congo",
  denmark: "Dinamarca", "dominican-republic": "República Dominicana", "east-timor": "Timor-Leste",
  ecuador: "Equador", egypt: "Egito", "el-salvador": "El Salvador", england: "Inglaterra",
  "equatorial-guinea": "Guiné Equatorial", eritrea: "Eritreia", estonia: "Estônia",
  "faroe-islands": "Ilhas Faroé", fiji: "Fiji", finland: "Finlândia", france: "França",
  "french-guiana": "Guiana Francesa", gabon: "Gabão", georgia: "Geórgia", germany: "Alemanha",
  ghana: "Gana", gibraltar: "Gibraltar", greece: "Grécia", grenada: "Granada",
  guadeloupe: "Guadalupe", guatemala: "Guatemala", guinea: "Guiné",
  "guinea-bissau": "Guiné-Bissau", guyana: "Guiana", haiti: "Haiti", honduras: "Honduras",
  hungary: "Hungria", iceland: "Islândia", india: "Índia", indonesia: "Indonésia",
  iran: "Irã", iraq: "Iraque", israel: "Israel", italy: "Itália", "ivory-coast": "Costa do Marfim",
  jamaica: "Jamaica", japan: "Japão", jordan: "Jordânia", kazakhstan: "Cazaquistão",
  kenya: "Quênia", kosovo: "Kosovo", latvia: "Letônia", lebanon: "Líbano", libya: "Líbia",
  liechtenstein: "Liechtenstein", lithuania: "Lituânia", luxembourg: "Luxemburgo",
  madagascar: "Madagascar", malawi: "Malaui", malaysia: "Malásia", mali: "Mali",
  malta: "Malta", martinique: "Martinica", mauritania: "Mauritânia", mauritius: "Maurício",
  mayotte: "Maiote", mexico: "México", moldova: "Moldávia", monaco: "Mônaco",
  montenegro: "Montenegro", morocco: "Marrocos", mozambique: "Moçambique", myanmar: "Mianmar",
  namibia: "Namíbia", netherlands: "Holanda",
  "new-caledonia": "Nova Caledônia", "new-zealand": "Nova Zelândia", nicaragua: "Nicarágua",
  niger: "Níger", nigeria: "Nigéria", "north-macedonia": "Macedônia do Norte",
  "northern-ireland": "Irlanda do Norte", norway: "Noruega", oman: "Omã", pakistan: "Paquistão",
  palestine: "Palestina", panama: "Panamá", paraguay: "Paraguai", peru: "Peru",
  philippines: "Filipinas", poland: "Polônia", portugal: "Portugal", "puerto-rico": "Porto Rico",
  qatar: "Catar", "republic-of-ireland": "Irlanda", romania: "Romênia", russia: "Rússia",
  rwanda: "Ruanda", "saint-kitts-and-nevis": "São Cristóvão e Névis",
  "saint-martin": "São Martinho", "san-marino": "San Marino",
  "sao-tome-and-principe": "São Tomé e Príncipe", "saudi-arabia": "Arábia Saudita",
  scotland: "Escócia", senegal: "Senegal", serbia: "Sérvia", seychelles: "Seicheles",
  "sierra-leone": "Serra Leoa", singapore: "Singapura", slovakia: "Eslováquia",
  slovenia: "Eslovênia", somalia: "Somália", "south-africa": "África do Sul",
  "south-korea": "Coreia do Sul", spain: "Espanha", sudan: "Sudão", suriname: "Suriname",
  sweden: "Suécia", switzerland: "Suíça", syria: "Síria", tajikistan: "Tajiquistão",
  tanzania: "Tanzânia", thailand: "Tailândia", "the-gambia": "Gâmbia", togo: "Togo",
  "trinidad-and-tobago": "Trinidad e Tobago", tunisia: "Tunísia", turkiye: "Turquia",
  uganda: "Uganda", ukraine: "Ucrânia", "united-arab-emirates": "Emirados Árabes Unidos",
  "united-states": "Estados Unidos", uruguay: "Uruguai", uzbekistan: "Uzbequistão",
  venezuela: "Venezuela", wales: "País de Gales", zambia: "Zâmbia", zimbabwe: "Zimbábue",
}
const emPortugues = (slug, reserva) => PAIS_PT[slug] ?? texto(reserva) ?? doSlug(slug)

/** Pais do clube: o primeiro /nation/ da pagina e o do BREADCRUMB, nao o de um jogador. */
function paisDoClube(html) {
  const bc = html.match(/breadcrumb[\s\S]{0,900}?\/nation\/(\d+)\/([a-z0-9-]+)"[^>]*>([^<]+)</)
  if (bc) return { id: bc[1], slug: bc[2], nome: emPortugues(bc[2], bc[3]) }
  const dd = html.match(/>Nation<\/dt>[\s\S]{0,400}?\/nation\/(\d+)\/([a-z0-9-]+)/)
  if (dd) return { id: dd[1], slug: dd[2], nome: emPortugues(dd[2], "") }
  return null
}

const liga = (html, tipo) => [...new Set(
  [...html.matchAll(new RegExp(`/football-manager-2026/${tipo}/(\\d+)/([a-z0-9-]+)`, "g"))]
    .map(m => `${m[1]}|${m[2]}`),
)].map(v => { const [id, slug] = v.split("|"); return { id, slug } })

const DATA = /^\d{2}-\d{2}-\d{4}$/
const DINHEIRO = /^[£€$]/
/**
 * Posicao de quem joga: so maiuscula, barra e virgula ("GK", "D C", "AM LC, F C",
 * "D/WB/AM L"). Cargo de comissao sempre tem minuscula ("Coach (U19 Team)",
 * "Performance Analyst"), e e essa a unica diferenca confiavel entre os dois.
 */
const POSICAO = /^(GK|SW|D|WB|DM|M|AM|ST|F)[A-Z/,\s]*$/

/**
 * Elenco pela TABELA do clube.
 *
 * Pegar todo link `/person/...` da pagina traria tambem idolos e dirigentes soltos
 * pelo texto — o Florentino Perez entrava como se fosse atleta. So linha de tabela
 * COM CELULA DE IDADE e gente do clube. A linha ainda carrega nacionalidade,
 * posicao e valor, e o clube dela vence o da pagina: quem esta emprestado aparece
 * na lista do clube de origem apontando para o clube onde de fato joga.
 *
 * A pagina tem DUAS tabelas com colunas diferentes, e nada no <tr> diz qual e qual:
 *   jogador  Name | Age | Position | Wage | Value   | Cost | Expires | Rating | Potential
 *   comissao Name | Age | Job      | Wage | Expires | Rating
 * Sem separar as duas, o "valor" de um treinador virava a data do contrato dele.
 * Contar colunas nao resolve: linha de reserva vem com celulas vazias e a de
 * comissao as vezes nem tem data. Por isso o valor e lido pelo FORMATO da celula
 * (dinheiro / data) e o papel sai da propria posicao.
 */
function pessoas(html) {
  const saida = []
  for (const linha of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []) {
    const quem = linha.match(/\/person\/(\d+)\/([a-z0-9-]+)"[^>]*>([^<]*)</)
    if (!quem) continue
    const celulas = linha.split(/<td/).slice(1).map(c => texto(c.replace(/^[^>]*>/, "")))
    const i = celulas.findIndex(c => /^\d{2}$/.test(c) && +c >= 14 && +c <= 50)
    if (i < 0) continue

    // O texto da ancora, nao o href: capturar `>([^<]*)<` logo apos a URL pegava a
    // propria URL de volta porque o <a> comeca com um <img> de bandeira.
    const nac = linha.match(/\/nation\/(\d+)\/([a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/)
    const clube = linha.match(/\/team\/(\d+)\/([a-z0-9-]+)"[^>]*>([^<]*)</)
    const posicao = (celulas[i + 1] ?? "").slice(0, 40)
    const comissao = posicao ? !POSICAO.test(posicao) : DATA.test(celulas[i + 3] ?? "")
    const monetarias = celulas.slice(i + 2).filter(c => DINHEIRO.test(c))
    saida.push({
      id: quem[1],
      nome: texto(quem[3]) || doSlug(quem[2]),
      nacionalidadeId: nac?.[1] ?? "",
      nacionalidade: nac ? emPortugues(nac[2], nac[3]) : "",
      clubeId: clube?.[1] ?? "",
      clube: clube ? (texto(clube[3]) || doSlug(clube[2])) : "",
      idade: Number(celulas[i]),
      comissao, posicao,
      salario: monetarias[0] ?? "",
      valor: comissao ? "" : (monetarias[1] ?? ""),
      contrato: celulas.slice(i + 2).find(c => DATA.test(c)) ?? "",
    })
  }
  return saida
}

// ─── varrer ──────────────────────────────────────────────────────────────────

if (comando === "varrer") {
  const quantasLigas = Number(opcao("ligas", 4))
  const nacoes = Object.keys(JSON.parse(readFileSync(NACOES, "utf-8")))
    .slice(0, Number(opcao("nacoes", 9999)))

  let clubesVistos = 0, novosDoDisco = 0
  for (const [n, nacao] of nacoes.entries()) {
    const htmlNacao = buscar("nation", nacao)
    if (!htmlNacao) continue
    const nome = nomeDoTitulo(htmlNacao, nacao)

    // Competicao de topo = ID BAIXO. As divisoes principais entraram na base do FM
    // primeiro (Premier=11, Ligue 1=16, Bundesliga=22, Serie A=32, La Liga=67) e as
    // regionais/amadoras receberam IDs enormes depois (2000005024). Ordenar
    // crescente acerta o topo sem eu conhecer o nome da liga de cada pais.
    const ligas = liga(htmlNacao, "competition")
      .sort((a, b) => Number(a.id) - Number(b.id))
      .slice(0, quantasLigas)

    console.log(`[${n + 1}/${nacoes.length}] ${nome}: ${ligas.length} competicoes`)
    for (const c of ligas) {
      const htmlLiga = buscar("competition", c.id, c.slug)
      if (!htmlLiga) continue
      for (const clube of liga(htmlLiga, "team")) {
        const jaTinha = existsSync(path.join(CACHE, `team-${clube.id}.html`))
        if (buscar("team", clube.id, clube.slug)) clubesVistos++
        if (!jaTinha) { novosDoDisco++; esperar(1200) }
      }
    }
    console.log(`    acumulado: ${clubesVistos} clubes (${novosDoDisco} baixados agora)`)
  }
  console.log(`\ncache: ${readdirSync(CACHE).filter(f => f.startsWith("team-")).length} paginas de clube`)
  console.log("agora:  node scripts/catalogo-df11.mjs indexar")
  process.exit(0)
}

// ─── indexar ─────────────────────────────────────────────────────────────────

if (comando === "indexar") {
  const arquivos = readdirSync(CACHE).filter(f => f.startsWith("team-"))
  const clubes = {}   // id do clube -> { nome, paisId, pais }
  const gente = {}    // id da pessoa -> registro

  for (const arquivo of arquivos) {
    const html = readFileSync(path.join(CACHE, arquivo), "utf-8")
    const id = arquivo.slice(5, -5)
    const pais = paisDoClube(html)
    clubes[id] = { nome: nomeDoTitulo(html, id), paisId: pais?.id ?? "", pais: pais?.nome ?? "" }

    for (const p of pessoas(html)) {
      // Quem aparece em duas paginas (emprestimo) fica com o clube da propria
      // linha, que e o time onde ele de fato joga.
      const anterior = gente[p.id]
      if (anterior && anterior.clubeId && anterior.clubeId === anterior.paginaId) continue
      gente[p.id] = { ...p, paginaId: id }
    }
  }

  // Pais de cada pessoa: o do clube DELA, e so.
  //
  // Herdar o pais da pagina onde a linha apareceu parece inofensivo e nao e: quem
  // esta emprestado ao exterior aparece na lista do clube de origem, entao o
  // Al-Dhafra (Emirados) virava pasta dentro do Brasil. Sem pagina propria do
  // clube o pais e desconhecido mesmo — e assim ele fica, ate a varredura chegar la.
  const registros = {}
  for (const [id, p] of Object.entries(gente)) {
    const dono = clubes[p.clubeId]
    registros[id] = {
      nome: p.nome,
      clube: p.clube || dono?.nome || "",
      clubeId: p.clubeId || p.paginaId,
      pais: dono?.pais ?? "",
      nacionalidade: p.nacionalidade,
      idade: p.idade,
      posicao: p.posicao,
      comissao: p.comissao,
      salario: p.salario,
      valor: p.valor,
      contrato: p.contrato,
    }
  }

  mkdirSync(path.dirname(CATALOGO), { recursive: true })
  writeFileSync(CATALOGO, `${JSON.stringify(registros, null, 1)}\n`)

  const lista = Object.values(registros)
  console.log(`paginas de clube:  ${arquivos.length}`)
  console.log(`clubes:            ${Object.keys(clubes).length}`)
  console.log(`paises:            ${new Set(lista.map(r => r.pais)).size}`)
  console.log(`pessoas:           ${lista.length}  (${lista.filter(r => r.comissao).length} de comissao tecnica)`)
  console.log(`gravado em         data/faces-fm/fm-catalogo.json`)
  process.exit(0)
}

// ─── HTML ────────────────────────────────────────────────────────────────────

const escapar = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const ESTILO = `
:root{color-scheme:dark light}
body{margin:0;padding:24px;background:#0e1116;color:#e7edf5;
 font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
a{color:#7dd3fc;text-decoration:none}a:hover{text-decoration:underline}
h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;font-weight:600;margin:28px 0 10px;
 color:#93a4b8;text-transform:uppercase;letter-spacing:.06em}
.sub{color:#8b9bb0;margin:0 0 24px;font-size:13px}
.cols{columns:260px;gap:20px}.cols a{display:block;padding:3px 0;break-inside:avoid}
.grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:14px}
.c{background:#161b22;border:1px solid #232c38;border-radius:10px;padding:10px;text-align:center}
.c img{width:100%;aspect-ratio:26/31;object-fit:contain;background:#0b0e13;border-radius:6px}
.n{font-weight:600;font-size:13px;margin-top:8px;overflow-wrap:anywhere}
.m{color:#8b9bb0;font-size:11px;margin-top:2px}
.busca{width:100%;max-width:420px;padding:9px 12px;margin-bottom:20px;border-radius:8px;
 border:1px solid #2a3441;background:#161b22;color:inherit;font:inherit}
@media(prefers-color-scheme:light){body{background:#f6f8fa;color:#111}
 .c{background:#fff;border-color:#d8dee6}.c img{background:#f0f3f6}a{color:#0b6bcb}}
`

const pagina = (titulo, corpo) => `<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapar(titulo)}</title><style>${ESTILO}</style></head><body>${corpo}
<script>
const b=document.querySelector('.busca');
if(b)b.addEventListener('input',()=>{const q=b.value.toLowerCase();
for(const el of document.querySelectorAll('[data-b]'))
  el.style.display=el.dataset.b.includes(q)?'':'none';});
</script></body></html>`

/** Um indice por pais e um por clube: 42 mil <img> numa pagina so nao abre. */
function escreverHtml(destino, porPais, total) {
  const paises = [...porPais.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))

  // O <img> aponta para o arquivo ao lado, entao o caminho e relativo A PASTA DO
  // CLUBE — a comissao mora um nivel abaixo e usar so o nome do arquivo quebrava.
  const cartao = (pais, clube) => (j) => `<div class="c" data-b="${escapar(`${j.nome} ${j.posicao} ${j.nacionalidade}`.toLowerCase())}">
<img loading="lazy" src="${path.relative(path.join(pais, clube), j.arquivo).split(path.sep).map(encodeURIComponent).join("/")}" alt="${escapar(j.nome)}">
<div class="n">${escapar(j.nome)}</div>
<div class="m">${escapar([j.posicao, j.idade ? `${j.idade}a` : "", j.nacionalidade].filter(Boolean).join(" · "))}</div>
<div class="m">#${j.id}${j.valor ? ` · ${escapar(j.valor)}` : ""}</div></div>`

  for (const [pais, clubes] of paises) {
    for (const [clube, elenco] of clubes) {
      elenco.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      const jogadores = elenco.filter(j => !j.comissao)
      const staff = elenco.filter(j => j.comissao)
      const monta = cartao(pais, clube)
      writeFileSync(path.join(destino, pais, clube, "index.html"), pagina(`${clube} — rostos`,
        `<h1>${escapar(clube)}</h1><p class="sub">${jogadores.length} jogadores${staff.length ? ` · ${staff.length} na comissão` : ""} ·
<a href="../index.html">${escapar(pais)}</a> · <a href="../../index.html">catálogo</a></p>
<input class="busca" placeholder="filtrar jogador, posição, nacionalidade…">
<div class="grade">${jogadores.map(monta).join("")}</div>
${staff.length ? `<h2>Comissão técnica</h2><div class="grade">${staff.map(monta).join("")}</div>` : ""}`))
    }

    const lista = [...clubes.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([clube, elenco]) => `<a data-b="${escapar(clube.toLowerCase())}" href="${encodeURIComponent(clube)}/index.html">${escapar(clube)} <span class="m">(${elenco.length})</span></a>`).join("")
    writeFileSync(path.join(destino, pais, "index.html"), pagina(`${pais} — clubes`,
      `<h1>${escapar(pais)}</h1><p class="sub">${clubes.size} clubes ·
<a href="../index.html">voltar ao catálogo</a></p>
<input class="busca" placeholder="filtrar clube…"><div class="cols">${lista}</div>`))
  }

  const blocos = paises.map(([pais, clubes]) => {
    const n = [...clubes.values()].reduce((s, e) => s + e.length, 0)
    return `<a data-b="${escapar(pais.toLowerCase())}" href="${encodeURIComponent(pais)}/index.html">${escapar(pais)} <span class="m">(${clubes.size} clubes · ${n} rostos)</span></a>`
  }).join("")
  writeFileSync(path.join(destino, "index.html"), pagina("Catálogo DF11",
    `<h1>Catálogo DF11 Classic — FM26</h1>
<p class="sub">${total.identificados.toLocaleString("pt-BR")} rostos identificados em ${paises.length} países ·
${total.anonimos.toLocaleString("pt-BR")} ainda sem nome (<code>_Sem identificacao/</code>) ·
planilha completa em <a href="catalogo.csv">catalogo.csv</a></p>
<input class="busca" placeholder="filtrar país…"><div class="cols">${blocos}</div>`))
}

// ─── montar ──────────────────────────────────────────────────────────────────

/** Nome de arquivo/pasta valido no Windows. */
const RESERVADOS = /^(con|prn|aux|nul|com\d|lpt\d)$/i
function limpo(s, max = 60) {
  let v = String(s ?? "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ").trim().slice(0, max).replace(/[. ]+$/, "")
  if (!v) v = "sem nome"
  if (RESERVADOS.test(v)) v = `_${v}`
  return v
}

/**
 * Apaga pasta de pais/clube que deixou de existir.
 *
 * Realocar um rosto so apaga o LINK antigo; a pasta continua la, e o `index.html`
 * gerado na rodada anterior segura ela de parecer vazia. Depois de uma varredura
 * que descobre o pais de verdade de um clube emprestado sobram centenas dessas —
 * pastas fantasma com um indice apontando para rostos que ja mudaram de lugar.
 */
function limparObsoletos(destino, porPais) {
  const guardadas = new Set(["_Sem identificacao"])
  let removidas = 0
  for (const pais of readdirSync(destino, { withFileTypes: true })) {
    if (!pais.isDirectory() || guardadas.has(pais.name)) continue
    const clubes = porPais.get(pais.name)
    const caminhoPais = path.join(destino, pais.name)
    if (!clubes) { rmSync(caminhoPais, { recursive: true, force: true }); removidas++; continue }
    for (const clube of readdirSync(caminhoPais, { withFileTypes: true })) {
      if (!clube.isDirectory() || clubes.has(clube.name)) continue
      rmSync(path.join(caminhoPais, clube.name), { recursive: true, force: true })
      removidas++
    }
  }
  return removidas
}

if (comando === "montar") {
  if (!existsSync(CATALOGO)) throw new Error("rode `indexar` antes")
  const registros = JSON.parse(readFileSync(CATALOGO, "utf-8"))
  const packDir = opcao("pack", PACK)
  const destino = opcao("destino", DESTINO)

  const rostos = readdirSync(packDir).filter(f => f.toLowerCase().endsWith(".png"))
  console.log(`pack:    ${rostos.length} rostos em ${packDir}`)

  // Hardlink so existe dentro do mesmo volume. Fora dele o jeito e copiar — e ai
  // o catalogo passa a ocupar espaco de verdade, entao vale avisar.
  const mesmoVolume = path.parse(path.resolve(packDir)).root.toLowerCase()
    === path.parse(path.resolve(destino)).root.toLowerCase()
  if (!mesmoVolume) console.log("!  destino em outro volume: vai COPIAR (13,8 GB) em vez de hardlink")

  const manifesto = existsSync(MANIFESTO) ? JSON.parse(readFileSync(MANIFESTO, "utf-8")) : {}
  const novoManifesto = {}
  const linhas = [["fm_id", "nome", "papel", "pais_do_clube", "clube", "nacionalidade",
    "idade", "posicao", "salario", "valor", "contrato", "arquivo"]]
  const porPais = new Map()

  let identificados = 0, anonimos = 0, criados = 0, movidos = 0, jaOk = 0, falhas = 0

  for (const arquivo of rostos) {
    const id = arquivo.replace(/\.png$/i, "")
    const r = registros[id]

    let relativo
    if (r) {
      identificados++
      const pais = limpo(r.pais || "_Pais a confirmar", 40)
      const clube = limpo(r.clube || "Sem clube", 60)
      // Treinador, olheiro e fisioterapeuta tambem tem rosto no pack, mas
      // misturados ao elenco poluem justamente o que se quer estudar.
      const pasta = r.comissao ? path.join(pais, clube, "_Comissao tecnica") : path.join(pais, clube)
      relativo = path.join(pasta, `${limpo(r.nome, 60)} (${id}).png`)
      const mapaPais = porPais.get(pais) ?? new Map()
      mapaPais.set(clube, [...(mapaPais.get(clube) ?? []), { ...r, id, arquivo: relativo }])
      porPais.set(pais, mapaPais)
      linhas.push([id, r.nome, r.comissao ? "comissao" : "jogador", r.pais, r.clube,
        r.nacionalidade, r.idade, r.posicao, r.salario, r.valor, r.contrato, relativo])
    } else {
      anonimos++
      if (tem("sem-anonimos")) continue
      // Balde de espera: sao os que a varredura ainda nao nomeou. Fatiado por
      // prefixo porque 200 mil arquivos numa pasta so trava qualquer explorador.
      relativo = path.join("_Sem identificacao", id.slice(0, 2).padStart(2, "0"), `${id}.png`)
    }

    novoManifesto[id] = relativo
    const alvo = path.join(destino, relativo)
    const anterior = manifesto[id]

    if (anterior === relativo && existsSync(alvo)) { jaOk++; continue }
    // Mudou de lugar (a varredura descobriu o nome, ou o jogador trocou de clube):
    // o link velho vira lixo e some.
    if (anterior && anterior !== relativo) {
      try { rmSync(path.join(destino, anterior), { force: true }) ; movidos++ } catch { /* ja nao existe */ }
    }
    try {
      mkdirSync(path.dirname(alvo), { recursive: true })
      if (existsSync(alvo)) rmSync(alvo, { force: true })
      if (mesmoVolume) linkSync(path.join(packDir, arquivo), alvo)
      else copyFileSync(path.join(packDir, arquivo), alvo)
      criados++
    } catch (e) {
      falhas++
      if (falhas <= 5) console.log(`  ! ${relativo}: ${e.message}`)
    }
  }

  // ── CSV e HTML ──
  const csv = linhas.map(l => l.map(c => {
    const v = String(c ?? "")
    return /[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
  }).join(";")).join("\r\n")
  // BOM: sem ele o Excel abre o CSV em CP1252 e come todo acento.
  writeFileSync(path.join(destino, "catalogo.csv"), `\ufeff${csv}\r\n`)
  writeFileSync(MANIFESTO, `${JSON.stringify(novoManifesto, null, 0)}\n`)
  escreverHtml(destino, porPais, { identificados, anonimos })
  const obsoletas = limparObsoletos(destino, porPais)

  console.log(`identificados:  ${identificados}  (${(100 * identificados / rostos.length).toFixed(1)}%)`)
  console.log(`sem nome:       ${anonimos}${tem("sem-anonimos") ? " (ignorados)" : " -> _Sem identificacao/"}`)
  console.log(`links criados:  ${criados}  | ja estavam: ${jaOk} | realocados: ${movidos} | falhas: ${falhas}`)
  if (obsoletas) console.log(`pastas obsoletas removidas: ${obsoletas}`)
  console.log(`catalogo em     ${destino}`)
  process.exit(0)
}

console.log(readFileSync(new URL(import.meta.url)).toString().split("\n").slice(0, 8).join("\n"))

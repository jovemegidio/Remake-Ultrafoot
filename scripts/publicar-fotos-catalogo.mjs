// PREPARA ROSTOS DO CATALOGO DF11 PARA O CANAL DE ATUALIZACAO.
//
//   node scripts/publicar-fotos-catalogo.mjs --exportar saida.json \
//     palmeiras="C:/Users/SnyX/Downloads/DF11 Catalogo/Brasil/Sociedade Esportiva Palmeiras" \
//     santos="C:/Users/SnyX/Downloads/DF11 Catalogo/Brasil/Santos Futebol Clube"
//
// Irmao do publicar-fotos-editor.mjs, para a outra origem de rosto. Aquele le o
// que VOCE licenciou no editor; este le a pasta do catalogo DF11, onde o nome do
// arquivo e `Nome do Jogador (FM ID).png`. A saida e identica: o mesmo JSON que
// o carregador da VPS consome.
//
// ⚠️ RODE DE UM DIRETORIO COM node_modules (C:\Ultrafoot). O `sharp` nao existe
// no G:, e sem ele os 750 KB por rosto virariam ~52 MB de base64 — o servidor
// corta em 12 MB por requisicao.
//
// ⚠️ O file_key NAO segue padrao. Corinthians e `corinthians_bra`, Palmeiras e
// so `palmeiras`. Chutar o sufixo grava a foto numa chave que o jogo nunca
// consulta, e o sintoma e nenhum: a foto simplesmente nao aparece. Por isso o
// file_key e LIDO de lib/teams-data.ts e conferido antes de qualquer coisa.
//
// AS ARMADILHAS DO CASAMENTO (as mesmas do casar-faces-catalogo):
//   1. So casa DENTRO do mesmo clube. Nome igual entre clubes diferentes e
//      coincidencia, nao prova.
//   2. Sem atleta correspondente no elenco do jogo, NAO inventa. Silhueta e
//      melhor do que a cara de outra pessoa.
//
// RECORTE: o catalogo entrega 1254x1254 da cintura para cima, e o quadro varia
// MUITO de foto para foto — o mesmo elenco tem busto e corpo inteiro lado a
// lado. Por padrao o recorte peitoral e aplicado (`--sem-recorte` desliga), e
// ele normaliza todos no mesmo enquadramento. Os seis clubes publicados ate
// 02/08/2026 saem sem recorte; para arrumar, basta rodar de novo.

import { readFileSync, writeFileSync, readdirSync } from "node:fs"
import path from "node:path"
import sharp from "sharp"

const RAIZ = path.resolve(import.meta.dirname, "..")
const LARGURA = 320 // mesma do editor (compressImageDataUrl)

const saida = process.argv.includes("--exportar")
  ? process.argv[process.argv.indexOf("--exportar") + 1]
  : ""

const recortar = !process.argv.includes("--sem-recorte")

// ─── --incluir: atletas que o BUILD nao conhece ──────────────────────────────
//
// O casamento normal exige que o nome exista no elenco do jogo, e e essa trava
// que impede colar rosto em quem nao e do clube. Mas ha um caso legitimo fora
// dela: o atleta que chega pelo PROPRIO canal, como transferencia (`para`), e
// portanto nao esta no elenco de nenhum build ainda.
//
// Para esses, o nome do arquivo do catalogo vira a chave direto — e por isso ele
// tem de ser IDENTICO ao `nome` da transferencia publicada, acento inclusive: a
// chave e `fileKey__nome_normalizado` e uma letra fora deixa a foto orfa, sem
// erro nenhum.
const incluir = new Set(
  (process.argv.includes("--incluir")
    ? (process.argv[process.argv.indexOf("--incluir") + 1] ?? "").split(",")
    : []
  ).map(s => s.trim()).filter(Boolean),
)

const pares = process.argv
  .filter(a => a.includes("=") && !a.startsWith("--"))
  .map(a => {
    const i = a.indexOf("=")
    return { fileKey: a.slice(0, i).trim(), pasta: a.slice(i + 1).trim() }
  })

// ─── --catalogo: a pasta INTEIRA, sem um par por clube ───────────────────────
//
// O catalogo passou de 6 pastas para 288 e escrever `fileKey="caminho"` para
// cada uma na linha de comando deixou de ser possivel. Com `--catalogo <raiz>`
// as subpastas viram os pares sozinhas: o nome da pasta e o nome FORMAL
// ("Clube de Regatas do Flamengo") e o casamento e por contencao do nome curto,
// com desempate pela UF entre parenteses. Ver acharClubeDaPasta.
const catalogo = process.argv.includes("--catalogo")
  ? process.argv[process.argv.indexOf("--catalogo") + 1]
  : ""

if (!pares.length && !catalogo && !process.argv.includes("--pares-de")) {
  console.error('uso: --exportar saida.json fileKey="caminho da pasta" [outro=...]   |   --catalogo "<raiz>"')
  process.exit(1)
}

// ─── Normalizacao ────────────────────────────────────────────────────────────
// Igual a `normPlayerName` de lib/player-overrides: e ela que forma a chave que
// o jogo consulta. Divergir aqui quebra o casamento em silencio.
const semAcento = s => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
const norm = s => semAcento(s).toLowerCase().replace(/[^a-z0-9]/g, "")

// ─── Recorte peitoral ────────────────────────────────────────────────────────
//
// O sujeito sobre fundo branco tem um perfil de largura caracteristico: a
// cabeca alarga, o PESCOCO estrangula, e o tronco abre. E o estrangulamento que
// da a escala do rosto — sem ele nao da para saber se a foto ja e de busto ou
// se e de corpo, e o enquadramento sairia diferente em cada uma.
//
// ⚠️ O OMBRO NAO E UM SALTO, E UMA RAMPA. A primeira versao procurava uma linha
// 1.6x mais larga que tudo acima e nao achou NENHUMA das 36 fotos do Gremio: do
// pescoco ao peito a largura sobe de 32 para 122 de dois em dois pixels, e o
// maximo corrente sobe junto. Quem tem degrau e o pescoco, para baixo.
async function medirCabeca(caminho) {
  const LARG = 200 // basta para o perfil, e 1254 linhas cheias seriam 40x mais lento
  const { data, info } = await sharp(caminho).resize(LARG).removeAlpha()
    .raw().toBuffer({ resolveWithObject: true })

  const larguras = [], centros = []
  for (let y = 0; y < info.height; y++) {
    let min = -1, max = -1
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 3
      if (!(data[i] > 238 && data[i + 1] > 238 && data[i + 2] > 238)) { if (min < 0) min = x; max = x }
    }
    larguras.push(min < 0 ? 0 : max - min + 1)
    centros.push(min < 0 ? info.width / 2 : (min + max) / 2)
  }

  const y0 = larguras.findIndex(v => v > 2)
  if (y0 < 0) return null

  // ⚠️ E NAO BASTA SER UM MINIMO: entre o cabelo e o rosto ha uma cova rasa (a
  // altura das tempas) que enganou Athos Thawan, Leonel Perez e Zortea — os
  // tres sairam em close no queixo. A cova do cabelo fica em ~0,86 da cabeca; o
  // pescoco tipico, em ~0,66.
  //
  // ⚠️ MAS QUEM TEM CABELO COMPRIDO NAO TEM ESTRANGULAMENTO: no Canobbio o
  // cabelo desce ate o queixo e o "pescoco" fica em 0,82 — ou seja, o corte nao
  // pode ser apertado. Quem sustenta o 0,85 e a regra do MAIS FUNDO logo
  // abaixo: onde a cova do cabelo entra como candidata (Leonel Perez, 0,84), o
  // pescoco de verdade entra junto e e mais fundo. Abaixo do pescoco a largura
  // so cresce, entao o mais fundo nunca cai no tronco.
  const JANELA = 6
  let maxAcima = 0, yPescoco = -1
  for (let y = y0 + 4; y < info.height * 0.6; y++) {
    maxAcima = Math.max(maxAcima, ...larguras.slice(y0, y))
    const w = larguras[y]
    if (w >= 0.85 * maxAcima) continue
    let ehMin = true
    for (let k = Math.max(0, y - JANELA); k <= Math.min(info.height - 1, y + JANELA); k++) {
      if (larguras[k] < w) { ehMin = false; break }
    }
    if (!ehMin) continue
    if (!larguras.slice(y + 1, y + 51).some(v => v >= 1.5 * w)) continue
    if (yPescoco < 0 || w < larguras[yPescoco]) yPescoco = y
  }
  if (yPescoco < 0) return null

  // Plateau e comum (varias linhas com a mesma largura minima): fico no meio.
  let fim = yPescoco
  while (fim + 1 < info.height && larguras[fim + 1] === larguras[yPescoco]) fim++
  const yMeio = Math.round((yPescoco + fim) / 2)

  const alturaCabeca = yMeio - y0
  if (alturaCabeca < 6) return null

  let cx = 0
  for (let y = y0; y < yMeio; y++) cx += centros[y]

  // A cor do fundo sai daqui, do canto do raster que ja esta na mao. Ver a nota
  // em recortarPeitoral sobre por que NAO da para perguntar isso ao sharp.
  const fundo = { r: data[0], g: data[1], b: data[2] }

  return { y0, alturaCabeca, cx: cx / (yMeio - y0), larguraAnalise: LARG, fundo }
}

const AR = 0.15, ABAIXO = 1.25 // ar acima da cabeca e tronco abaixo do pescoco,
                               // em alturas de cabeca — da rosto em ~42% do quadro

/**
 * Tira MOLDURA ESCURA, se houver.
 *
 * A deteccao inteira assume que o que nao e claro e o sujeito. O Diogenes
 * (Santos) vem 1024x1536 dentro de uma tarja preta: a moldura conta como
 * sujeito em TODA linha, nao existe estrangulamento, e a foto saia inteira — e
 * ainda por cima nao quadrada (320x480) e com barra preta, destoando das outras
 * na tela. So corto quando o canto e escuro: nas fotos normais (canto ~254) o
 * trim comeria a margem branca e mudaria o enquadramento de todas as que ja
 * conferi.
 */
async function semMoldura(caminho) {
  const LARG = 200
  const { data, info } = await sharp(caminho).resize(LARG).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  if ((data[0] + data[1] + data[2]) / 3 > 100) return caminho // canto claro: sem moldura

  // ⚠️ `sharp.trim()` NAO resolve: ele corta a borda igual ao pixel do canto e
  // essa moldura tem gradiente — 1024x1536 virava 926x1414 ainda toda preta.
  // O que resolve e achar o RETANGULO CLARO de dentro: linha/coluna do retrato
  // e majoritariamente branca, a da moldura nao tem quase nada branco.
  const claro = (x, y) => {
    const i = (y * info.width + x) * 3
    return data[i] > 238 && data[i + 1] > 238 && data[i + 2] > 238
  }
  // ⚠️ "linha majoritariamente branca" NAO serve: com o sujeito no meio, nenhuma
  // linha passa de 46% de branco, e o corte nunca disparava. A moldura, por
  // outro lado, nao tem UM pixel claro — entao a caixa dos pixels claros e
  // exatamente o retangulo do retrato.
  let y0 = info.height, y1 = -1, x0 = info.width, x1 = -1
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (!claro(x, y)) continue
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      if (x < x0) x0 = x
      if (x > x1) x1 = x
    }
  }
  if (y1 - y0 < info.height * 0.3 || x1 - x0 < info.width * 0.3) return caminho // nao achei retrato

  const meta = await sharp(caminho).metadata()
  const k = meta.width / info.width
  return sharp(caminho).extract({
    left: Math.round(x0 * k), top: Math.round(y0 * k),
    width: Math.round((x1 - x0 + 1) * k), height: Math.round((y1 - y0 + 1) * k),
  }).toBuffer()
}

/**
 * Devolve { fonte, recortou }. `fonte` serve mesmo quando o recorte e recusado:
 * a moldura ja foi tirada, e e ela que estragava a foto (saia 320x480 com tarja
 * preta, destoando de todas as outras). Recusar o RECORTE nao e motivo para
 * devolver a foto crua.
 */
async function recortarPeitoral(entrada) {
  const caminho = await semMoldura(entrada)
  const m = await medirCabeca(caminho)
  const meta = await sharp(caminho).metadata()

  if (!m) {
    // Mesmo recusando o recorte, entrego QUADRADO: todo retrato publicado e
    // quadrado, e um 320x513 no meio deles aparece menor na tela (o avatar usa
    // object-contain). Quadro pelo TOPO porque retrato e ancorado na cabeca.
    if (meta.height > meta.width) {
      const q = await sharp(caminho)
        .extract({ left: 0, top: 0, width: meta.width, height: meta.width }).toBuffer()
      return { fonte: q, recortou: false }
    }
    return { fonte: caminho, recortou: false }
  }

  const k = meta.width / m.larguraAnalise
  const hh = m.alturaCabeca * k
  const lado = Math.round(hh * (1 + AR + ABAIXO))
  const topo = Math.round(m.y0 * k - AR * hh)
  const esq = Math.round(m.cx * k - lado / 2)

  // ⚠️ O fundo NAO e 255 puro (fica em ~254). Estender com branco chapado
  // deixaria uma faixa visivel de um lado quando o recorte sai da imagem — e
  // ele sai quase sempre, porque a cabeca costuma encostar no topo.
  //
  // ⚠️ E A COR TEM DE SAIR DO RASTER, NAO DO `stats()`. O `stats()` do sharp
  // ignora o `extract` da cadeia e devolve a media da IMAGEM INTEIRA: pedir a
  // media do canto 4x4 devolvia 237,194,173 — cor de pele, a media da foto
  // toda. O Flamengo saiu com uma faixa salmao em volta da cabeca.
  const fundo = m.fundo

  const pad = Math.max(0, -topo, -esq, topo + lado - meta.height, esq + lado - meta.width) + 2

  // ⚠️ EXTEND E EXTRACT NA MESMA CADEIA NAO RODAM NA ORDEM ESCRITA. O sharp
  // guarda o primeiro `extract` como o PRE-resize e o executa antes do
  // `extend`: pedir extend(10) + extract(50x50) numa imagem 100x100 devolve
  // 70x70, nao 50x50. Como os offsets aqui sao calculados para a imagem JA
  // esticada, aplicá-los na original desloca o corte em `pad` pixels e ainda
  // deixa a borda em volta. No Gremio passou despercebido (a caixa cabia na
  // imagem); no Flamengo, com a cabeca grande, estourou em "bad extract area".
  // Dois pipelines separados nao tem essa ambiguidade.
  const esticada = await sharp(caminho)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: fundo })
    .png().toBuffer()

  const cortada = await sharp(esticada)
    .extract({ left: esq + pad, top: topo + pad, width: lado, height: lado })
    .toBuffer()

  // Barato, e teria pego o erro acima na primeira foto.
  const conf = await sharp(cortada).metadata()
  if (conf.width !== lado || conf.height !== lado) {
    throw new Error(`recorte saiu ${conf.width}x${conf.height}, esperado ${lado}x${lado}`)
  }
  return { fonte: cortada, recortou: true }
}

// ─── Clubes do jogo: file_key -> nome ────────────────────────────────────────
function clubesDoJogo() {
  const texto = readFileSync(path.join(RAIZ, "lib/teams-data.ts"), "utf-8")
  const mapa = new Map()
  // ⚠️ `estadio_nome:` TERMINA em `nome:`. Procurar `nome:` solto casava com ele
  // e o Palmeiras virou "Engenhao". O lookbehind exige que `nome` comece a
  // palavra; e a busca vai do file_key PARA TRAS, pegando o `nome` mais proximo,
  // que e o do proprio objeto — uma janela para a frente atravessaria o objeto
  // seguinte quando algum campo faltasse.
  const doNome = /(?<![A-Za-z_])nome:\s*"([^"]+)"/g
  const reChave = /file_key:\s*"([^"]+)"/g
  let m
  while ((m = reChave.exec(texto))) {
    const antes = texto.slice(Math.max(0, m.index - 900), m.index)
    let ultimo = null
    doNome.lastIndex = 0
    let n
    while ((n = doNome.exec(antes))) ultimo = n[1]
    if (ultimo && !mapa.has(m[1])) mapa.set(m[1], ultimo)
  }
  return mapa
}

// ─── Elenco por clube, NA MESMA ORDEM QUE O JOGO ─────────────────────────────
//
// ⚠️ NAO BASTA O real-squads-tm. O Gremio nao esta la (so o Novorizontino) e a
// primeira tentativa morreu em "sem elenco real". O elenco dele vem do indice
// CURADO, players_br.json — que em lib/players-data.ts e o caminho de MENOR
// prioridade, usado justamente quando o Transfermarkt nao cobre o clube.
// Inverter isto colaria o nome errado: onde as duas fontes existem, o jogo
// mostra o nome do TM, e a foto e indexada pelo nome que o jogo mostra.
//
// (A camada de prioridade MAIOR, o overlay de real-positions.json, nao alcanca
// clube brasileiro nenhum — 250 chaves, e a unica parecida e "santoslaguna".)
//
// Nome do clube com acento: players_br usa "Grêmio", teams-data usa "Gremio".
// Comparar sem acento e o que junta os dois.
const normClube = s => semAcento(s)
  .toLowerCase().replace(/\s+/g, " ").trim()

function elencosPorNome() {
  const mapa = new Map()

  // 1) Transfermarkt — chaves `SIGLA|nome em minusculas`.
  const real = JSON.parse(readFileSync(path.join(RAIZ, "data/seeds/real-squads-tm.json"), "utf-8"))
  for (const [chave, elenco] of Object.entries(real)) {
    const nome = chave.split("|")[1]
    if (nome && elenco?.length) mapa.set(normClube(nome), { fonte: "TM", elenco })
  }

  // 2) Curado — so preenche buraco; `nome` aqui, `n` no TM.
  const curado = JSON.parse(readFileSync(path.join(RAIZ, "data/seeds/players_br.json"), "utf-8"))
  for (const [clube, elenco] of Object.entries(curado)) {
    const k = normClube(clube)
    if (mapa.has(k) || !elenco?.length) continue
    mapa.set(k, { fonte: "curado", elenco: elenco.map(p => ({ ...p, n: p.nome })) })
  }

  return mapa
}

const CLUBES = clubesDoJogo()
const ELENCOS = elencosPorNome()

// ─── O POOL, e por que ele precisou entrar ───────────────────────────────────
//
// Ate 06/08 o universo era so lib/teams-data.ts: 79 clubes, todos brasileiros
// de A/B/C/D. O catalogo de hoje tem 288 pastas — estadual, base e Serie D
// inteira —, e para essas o clube so existe no POOL (imported-bf2026), com
// elenco proprio em imported-bf2026-elencos.json (indexado pelo `id`, nao pelo
// fileKey). Sem isto, 200 das 288 pastas cairiam como "clube desconhecido".
const POOL = JSON.parse(readFileSync(path.join(RAIZ, "data/seeds/imported-bf2026.json"), "utf-8")).teams ?? []
const ELENCO_POOL = JSON.parse(readFileSync(path.join(RAIZ, "data/seeds/imported-bf2026-elencos.json"), "utf-8"))
const poolPorChave = new Map()
for (const t of POOL) if (t.fileKey && t.nome) poolPorChave.set(t.fileKey, t)

// ⚠️ A MESMA LICAO DO UNIFORME: quem a tela desenha nas Series A/B/C/D e o
// CURADO, e o mesmo clube tem chave diferente nos dois (`santa` x
// `santacruz_pe`). Foto publicada so na chave do pool nao aparece, e sem erro.
const fonteCurada = readFileSync(path.join(RAIZ, "lib/teams-data.ts"), "utf-8")
  + "\n" + readFileSync(path.join(RAIZ, "lib/international-teams.ts"), "utf-8")
const curadoPorNome = new Map()
const chavesCuradas = new Set()
for (const m of fonteCurada.matchAll(/\{[^{}]*\}/g)) {
  const fk = m[0].match(/file_key:\s*"([^"]+)"/)
  const nm = m[0].match(/(?:^|[\s,{])nome:\s*"([^"]+)"/) // `estadio_nome` tambem casa "nome:"
  if (!fk || !nm) continue
  chavesCuradas.add(fk[1])
  if (!curadoPorNome.has(norm(nm[1]))) curadoPorNome.set(norm(nm[1]), fk[1])
}
const gemeoCurado = (fileKey, nome) => {
  if (chavesCuradas.has(fileKey)) return null
  const g = curadoPorNome.get(norm(nome))
  return g && g !== fileKey ? g : null
}

/** Elenco do clube, venha ele do curado ou do pool. */
function elencoDe(fileKey) {
  const nomeCurado = CLUBES.get(fileKey)
  if (nomeCurado) {
    const a = ELENCOS.get(normClube(nomeCurado))
    if (a?.elenco?.length) return { ...a, nomeClube: nomeCurado }
  }
  const t = poolPorChave.get(fileKey)
  if (t) {
    // Antes do pool, ainda vale o TM/curado pelo nome: onde as duas fontes
    // existem, o jogo mostra o nome do TM, e a foto e indexada pelo nome que o
    // jogo mostra.
    const porNome = ELENCOS.get(normClube(t.nome))
    if (porNome?.elenco?.length) return { ...porNome, nomeClube: t.nome }
    const e = ELENCO_POOL[t.id]
    if (e?.length) return { fonte: "pool", elenco: e.map(p => ({ ...p, n: p.nome })), nomeClube: t.nome }
  }
  return null
}

// ─── --catalogo: casar PASTA -> clube ────────────────────────────────────────
//
// A pasta traz o nome FORMAL ("Clube de Regatas do Flamengo", "Esporte Clube
// Vitória") e o jogo guarda o curto ("Flamengo", "Vitória"). O casamento e por
// CONTENCAO do nome do jogo dentro do nome da pasta, com duas travas:
//
//   1. vence o nome MAIS LONGO contido (senao "Nacional" ganha de "Nacional
//      Atlético Clube de Patos" em qualquer pasta que contenha os dois);
//   2. a UF entre parenteses ("(SP)", "(MG)") desempata — e ela existe na pasta
//      exatamente porque ha homonimo.
//
// Empate que sobra NAO e chutado: sai no relatorio e a pasta fica de fora.
// Rosto errado e pior do que rosto faltando.
const PARES_CATALOGO = new Map(Object.entries({
  // Conferidos a mao: o nome do jogo nao esta contido no da pasta.
  "Red Bull Bragantino": "bragantino_bra",
  "Grêmio Foot-Ball Porto Alegrense": "gremio",
  "Clube Athlético Paranaense": "atleticopr_bra",
  "Esporte Clube Bahia SAF": "bahia",
  "Sociedade Esportiva e Recreativa Caxias do Sul": "caxias_rs",
  "Osasco Sporting": "oestesp_bra",
  "Associação Desportiva Vasco da Gama": "vascoac_bra",
  "Club de Regatas Vasco da Gama SAF": "vasco",
  "Instituto de Adm. de Projetos Educacionais FC": "iape_ma",
  // Homonimo em que a UF da pasta nao aparece em nenhum candidato, mas o clube
  // do jogo E aquele: a Lusa do Caninde e a "Portuguesa" lisa do seed (a de
  // chave propria e a do Rio), e o Inter e o "Internacional" liso.
  "Associação Atlética Portuguesa (SP)": "portuguesa_bra",
  "Esporte Clube Internacional (RS)": "internacional_bra",
  "América Futebol Clube de Propriá": "americase_bra",          // Propria e SE
  "Associação Desportiva Ferroviária Vale do Rio Doce": "desportivaferroviaria_es",
  "Clube Esportivo Operário Várzea-Grandense": "operariomt",     // Varzea Grande e MT
  "Athletic Club SAF (MG)": "athleticclub_mg",
  // ─── Clubes CRIADOS em 15/08 que o casamento nao alcanca ──────────────
  // A ancora no fim do nome formal nao chega neles: "Associação Atlética
  // Internacional de Bebedouro" termina em "bebedouro" e o clube se chama
  // "Inter de Bebedouro"; "Associação Desportiva Atlética Gloriense" tem
  // "atletica" onde o clube tem "atletico"; e "Academia" e "Atlético-PI"
  // viram nomes 100% genericos depois do filtro. Par manual resolve.
  "Academia Futebol Clube (MT)": "academia_mt",
  "Clube Sociedade Esportiva": "cseal_bra",              // CSE de Palmeira dos Índios (AL)
  "Vila Operária Clube Esporte Mariano": "vocem_sp",     // o clube se chama VOCEM no seed
  "Associação Atlética Internacional de Bebedouro": "interbebedouro_sp",
  "Associação Desportiva Atlética Gloriense": "gloriense_se",
  "Associação Desportiva Jaboatão dos Guararapes": "jaboatao_pe",
  "Clube Atlético Piauiense": "atleticopi",
  "Coimbra Sports SAF": "coimbra_mg",
  "Confiança Esporte Clube de Sapé": "confiancasape_pb",
  "Desportivo Brasil Participações Ltda": "desportivobrasil_sp",
  "Esporte Clube de Patos": "ecpatos_pb",
  "Esporte Clube XV de Novembro de Jaú": "xvdejau_sp",
  "Grêmio Desportivo Prudente": "gremioprudente_sp",
  "Rondoniense Social Clube": "rondoniense_ro",
  "Sporting Club Paulinense": "paulinense_sp",

  // ─── Homonimos que o veto de UF deixou em aberto ──────────────────────
  // Aqui os DOIS clubes existem e a pasta nao diz a UF; quem separa e o
  // apelido/forma juridica do nome formal. Conferido um a um.
  "Esporte Clube Primavera SAF": "primavera_bra",       // Primavera de Indaiatuba (SP)
  "Primavera Atlético Clube": "primavera_mt",           // Primavera do Leste (MT)
  // "Rio Branco Esporte Clube" (Americana/SP) NAO existe no seed — entra na
  // leva de criacao, nao aqui. Escrevi `riobrancosp_bra` de cabeca e a trava
  // de chave inexistente pegou: sem ela a foto iria para chave nenhuma.
  "Rio Branco Sport Club SAF": "riobrancovn_es",        // Rio Branco de Venda Nova (ES)
  "Ypiranga Clube": "ypiranga_ap",                      // o de Erechim (RS) e "Ypiranga Futebol Clube (RS)"
  // ─── Clubes que EXISTEM no seed com outro nome (15/08/2026) ───────────
  // O casamento e ancorado no FIM do nome formal, e essas 26 pastas nao tem
  // como casar: o seed escreve "Atlético Alagoinhas" e a pasta "Alagoinhas
  // Atlético Clube" (ordem trocada); guarda o ESTADIO no campo nome
  // (`lagunarn` = "Nazarenão"); ou usa sigla ("ABECAT", "URT", "CRAC").
  // Sem estes pares o rosto desses clubes nunca era publicado — e criar o
  // clube "que faltava" teria gerado 26 duplicatas.
  "Alagoinhas Atlético Clube": "atleticoalagoinhas_bra",
  "Associação Beneficente e Esportiva Ouvidorense": "abecat",
  "Associação Cultural e Desp. Potyguar Seridoense": "potyguarrn_bra",
  "Associação Esportiva Velo Clube Rioclarense": "veloclube_bra",
  "Atlético Clube Goianiense SAF": "atleticogo_bra",
  "Bragantino Clube do Pará": "bragantino_pa",
  "Centro Sportivo Alagoano": "csa_bra",
  "Centro de Formação de Atletas do Tirol": "tirol_ce",
  "Clube Atlético Mineiro SAF": "atleticomg_bra",
  "Clube Atlético Piauiense": "atleticopi",
  "Clube Esportivo Bento Gonçalves": "esportivors_bra",
  "Clube Laguna SAF": "lagunarn",
  "Clube Náutico Capibaribe": "nautico_pe",
  "Clube Recreativo e Atlético Catalano": "cracgo_bra",
  "Clube de Regatas Brasil": "crb_bra",
  "Decisão Goiana Futebol Clube": "decisaope_bra",
  "Esporte Clube Democrata": "ecdemocrata_mg",
  "Esporte Clube XV de Novembro SAF": "xvdepiracicaba_sp",
  "Forte Futebol Clube": "fortefc",
  "Futebol Clube Atlético Cearense": "atleticoce_bra",
  "Moto Club de São Luís": "motoclub_ma",
  "Nacional Atlético Clube de Patos": "nacional_pb",
  "Paulista Futebol Clube": "paulista_sp",
  "Sport Club do Recife": "sport",
  "União Agrícola Barbarense Futebol Clube": "uniaobarbarense_bra",
  "União Recreativa dos Trabalhadores": "urt_bra",                   // "Athletic Club" sozinho e generico demais para casar
}))

const ufDaPasta = (nome) => (nome.match(/\(([A-Z]{2})\)\s*$/)?.[1] ?? "").toUpperCase()
const semUf = (nome) => nome.replace(/\s*\([A-Z]{2}\)\s*$/, "").trim()

// ⚠️ CONTENCAO CRUA COLA CLUBE ERRADO, e em silencio. Comparando as letras
// coladas, "1º de Maio Esporte Clube" contem "Esporte" (que e um clube de
// verdade, `esporte_pb`), "Atlético Clube Paranavaí" contem "Avaí" e
// "Freipaulistano" contem "Paulista". Foram 30+ trocas de clube na primeira
// versao. As duas travas que resolvem:
//
//   1. a comparacao e por PALAVRA INTEIRA, em sequencia contigua;
//   2. o nome do clube precisa ter ao menos uma palavra que nao seja generica —
//      "Esporte", "Sport" e "Clube" sozinhos nao identificam ninguem.
const GENERICAS = new Set([
  "esporte", "esportes", "esportivo", "esportiva", "sport", "sporting", "clube", "club",
  "futebol", "football", "foot", "ball", "associacao", "sociedade", "desportivo", "desportiva", "desportos",
  "atletico", "atletica", "athletico", "athletic", "recreativo", "recreativa", "cultural", "regatas", "academia",
  "de", "do", "da", "dos", "das", "e", "saf", "ltda", "fc", "ec", "ac", "sc", "aa", "ad", "cf",
])
// ⚠️ E NEM PALAVRA INTEIRA BASTA: "Grêmio Desportivo Prudente" contem "Grêmio"
// (o de Porto Alegre), "União São João" contem "União" e "Guarani de Palhoça"
// contem "Guarani". Todos casavam, e todos sao outro clube. O que separa
// "Clube de Regatas do Flamengo" -> Flamengo desses casos e a POSICAO: o nome
// do clube TERMINA o nome formal; o que vem depois dele ("Prudente", "Palhoça",
// "São João") e justamente o que diz que o clube e outro.
//
// Palavras que podem sobrar no fim sem mudar o clube — o Corinthians "Paulista"
// e o Retrô "Brasil" nao sao outro clube.
const CAUDA_OK = new Set(["paulista", "brasil", "brasileiro", "brasileira"])
const tokens = (s) => semAcento(s).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean)
const semCauda = (ts) => {
  const r = [...ts]
  while (r.length && (GENERICAS.has(r.at(-1)) || CAUDA_OK.has(r.at(-1)))) r.pop()
  return r
}
const terminaEmSequencia = (agulha, palheiro) => {
  if (!agulha.length || agulha.length > palheiro.length) return false
  const i = palheiro.length - agulha.length
  return agulha.every((t, j) => t === palheiro[i + j])
}

// A pasta e do BRASIL. Sem o recorte, "Barcelona Futebol Clube (RO)" casa com o
// Barcelona da Espanha e "Guarani" com o do Paraguai.
const UFS_BR = new Set(["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"])
const ehBrasileiro = (t) => {
  const p = (t.pais ?? "").toUpperCase()
  return normClube(t.pais ?? "") === "brasil" || UFS_BR.has(p)
    || UFS_BR.has((t.estado ?? "").toUpperCase())
    || /_(bra|br)$/i.test(t.fileKey ?? "")
    // ⚠️ HA CHAVE COM HIFEN (`santacruz-ac`), e so com `_` ela ficava de fora do
    // universo brasileiro — o Santa Cruz do Acre sumia do casamento inteiro.
    || UFS_BR.has(((t.fileKey ?? "").split(/[_-]/).at(-1) ?? "").toUpperCase())
}

// ⚠️ PAR MANUAL COM CHAVE ERRADA SOME EM SILENCIO. Escrevi `gremio_bra`,
// `bahia_bra` e `vasco_bra`, que nao existem — e os tres clubes simplesmente
// nao apareceram no pacote, sem uma linha de erro. Agora a chave e conferida
// contra o pool e o curado antes de qualquer casamento.
for (const [pasta, fk] of PARES_CATALOGO) {
  if (!poolPorChave.has(fk) && !CLUBES.has(fk) && !chavesCuradas.has(fk)) {
    console.error(`PARES_CATALOGO: "${pasta}" aponta para "${fk}", que nao existe nem no pool nem no curado.`)
    process.exit(1)
  }
}

// ⚠️ O NOME DA PASTA PODE VIR EM NFD. "Clube Atlético Piauiense" chega do disco
// como `Atle` + acento COMBINANTE + `tico`; a chave escrita aqui esta em NFC.
// As duas strings mostram o mesmo texto e `===` diz que sao diferentes — o par
// manual simplesmente nao era encontrado, sem erro nenhum. Normalizar os dois
// lados e o que faz a busca funcionar.
const PARES_NFC = new Map([...PARES_CATALOGO].map(([k, v]) => [k.normalize("NFC"), v]))

function acharClubeDaPasta(nomePastaCru) {
  const nomePasta = nomePastaCru.normalize("NFC")
  const manual = PARES_NFC.get(nomePasta) ?? PARES_NFC.get(semUf(nomePasta))
  if (manual) return { fileKey: manual, via: "par manual" }

  const alvo = semCauda(tokens(semUf(nomePasta)))
  const uf = ufDaPasta(nomePasta)
  const candidatos = []
  const ver = (fileKey, nome, estado) => {
    // ⚠️ O SEED GUARDA A UF DENTRO DO NOME: "Botafogo-SP", "Cruzeiro - AL",
    // "Santa Cruz - RN". Comparada crua, "Botafogo-SP" nunca esta contida em
    // "Botafogo Futebol Clube (SP)" — e o casamento cai no "Botafogo" liso, que
    // e o do Rio. A UF sai do nome e vira prova, em vez de atrapalhar.
    const m = String(nome).match(/\s*-\s*([A-Za-z]{2})\s*$/)
    const ufClube = (m && UFS_BR.has(m[1].toUpperCase()) ? m[1] : (estado ?? "")).toUpperCase()
    const base = m && UFS_BR.has(m[1].toUpperCase()) ? nome.slice(0, m.index) : nome
    const t = tokens(base)
    if (!t.length || t.every(w => GENERICAS.has(w))) return
    if (!terminaEmSequencia(semCauda(t), alvo)) return
    // Peso: palavras proprias contam, genericas nao — assim "Vitória" nao ganha
    // de "Vitória das Tabocas" so por empatar em numero de palavras.
    const peso = t.filter(w => !GENERICAS.has(w)).join("").length
    candidatos.push({ fileKey, nome, tamanho: peso, uf: UFS_BR.has(ufClube) ? ufClube : "" })
  }
  for (const [fk, nome] of CLUBES) ver(fk, nome, "")
  for (const t of POOL) { if (ehBrasileiro(t)) ver(t.fileKey, t.nome, t.estado || ((t.pais ?? "").length === 2 ? t.pais : "")) }
  if (!candidatos.length) return { nada: true }

  let melhor = candidatos.filter(c => c.tamanho === Math.max(...candidatos.map(c => c.tamanho)))

  // ⚠️ A UF ENTRE PARENTESES SO EXISTE PORQUE HA HOMONIMO — e por isso ela e
  // VETO, nao so desempate. Sem isto, "Botafogo Futebol Clube (PB)" casava com
  // o Botafogo do Rio e "Cruzeiro Esporte Clube (PB)" com o de Belo Horizonte,
  // porque esses sao os que se chamam so "Botafogo" e "Cruzeiro" no seed.
  // Quando nenhum candidato traz a UF pedida, o certo e NAO publicar: o clube
  // daquela UF provavelmente nao esta no jogo. Sai no relatorio para virar par
  // manual se for o caso.
  if (uf) {
    const doUf = melhor.filter(c => c.uf === uf)
    if (!doUf.length) return { ufNaoConfere: melhor.map(c => `${c.fileKey}${c.uf ? `/${c.uf}` : ""}`) }
    melhor = doUf
  } else {
    // Pasta SEM UF e o clube "padrao" — entre "Cruzeiro" e "Cruzeiro - AL",
    // e o primeiro. Sem esta regra os dois empatam e o clube fica sem foto.
    const semUfClube = melhor.filter(c => !c.uf)
    if (semUfClube.length) melhor = semUfClube
  }

  // ⚠️ CURADO + POOL COM O MESMO NOME NAO E AMBIGUIDADE, E GEMEO. `remo` e
  // `remo_pa`, `nautico` e `nautico_pe`, `figueirense` e `figueirense_sc` sao o
  // mesmo clube com as duas chaves do jogo (ver a nota grande la em cima).
  // Chamar isso de empate deixava 8 clubes sem rosto nenhum. Fica o do POOL, e
  // o gemeoCurado acrescenta a chave curada na hora de gravar.
  const unicas = new Set(melhor.map(c => c.fileKey))
  if (unicas.size > 1) {
    const nomes = new Set(melhor.map(c => norm(c.nome)))
    const doPool = melhor.filter(c => !chavesCuradas.has(c.fileKey))
    const chavesPool = new Set(doPool.map(c => c.fileKey))
    if (nomes.size === 1 && chavesPool.size === 1) melhor = doPool
  }
  if (new Set(melhor.map(c => c.fileKey)).size > 1) return { ambiguo: [...unicas] }
  return { fileKey: melhor[0].fileKey, via: `contencao ("${melhor[0].nome}")` }
}

// ─── --pares-de: arvore cujas SUBPASTAS JA SAO file_key ──────────────────────
// Usado pelas variacoes de rosto (montar-variacoes-de-rosto.mjs), onde o
// casamento de clube ja foi feito. 92 pares nao cabem na linha de comando.
const paresDe = process.argv.includes("--pares-de")
  ? process.argv[process.argv.indexOf("--pares-de") + 1]
  : ""
if (paresDe) {
  for (const d of readdirSync(paresDe, { withFileTypes: true }).filter(d => d.isDirectory())) {
    pares.push({ fileKey: d.name, pasta: path.join(paresDe, d.name), rotulo: d.name })
  }
  console.log(`${pares.length} pastas vindas de --pares-de.
`)
}

const semClube = [], semElenco = [], ambiguos = []
if (catalogo) {
  for (const nome of readdirSync(catalogo, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)) {
    const r = acharClubeDaPasta(nome)
    if (r.ambiguo) { ambiguos.push(`${nome} -> ${r.ambiguo.join(", ")}`); continue }
    if (r.ufNaoConfere) { ambiguos.push(`${nome} -> nenhum candidato dessa UF (achei ${r.ufNaoConfere.join(", ")})`); continue }
    if (!r.fileKey) { semClube.push(nome); continue }
    pares.push({ fileKey: r.fileKey, pasta: path.join(catalogo, nome), rotulo: nome })
  }
  console.log(`Catalogo: ${pares.length} pastas casadas, ${semClube.length} sem clube, ${ambiguos.length} ambiguas.\n`)
  // Conferir o casamento custa segundos; converter 3 mil rostos custa dezenas de
  // minutos. `--casar` para aqui, que e onde mora o erro que importa.
  if (process.argv.includes("--casar")) {
    for (const p of pares) console.log(`  ${p.rotulo} -> ${p.fileKey}${elencoDe(p.fileKey) ? "" : "   [SEM ELENCO]"}`)
    if (ambiguos.length) console.log(`\nAMBIGUAS:\n   ${ambiguos.join("\n   ")}`)
    if (semClube.length) console.log(`\nSEM CLUBE:\n   ${semClube.join("\n   ")}`)
    process.exit(0)
  }
}

const itens = []
const relatorio = []

for (const { fileKey, pasta, rotulo } of pares) {
  let achado = elencoDe(fileKey)
  if (!achado?.elenco?.length) {
    // Em modo catalogo isto e rotina (clube sem elenco no jogo), nao erro fatal.
    // ⚠️ CLUBE SEM ELENCO AINDA PODE RECEBER FOTO — se ela veio do `--incluir`.
    // Ali o nome nao e conferido contra elenco nenhum (e o atleta que chega por
    // transferencia, ou a variacao de rosto publicada para um clube onde ele
    // ainda nao joga). Pular o clube inteiro descartava justamente esses.
    if (incluir.size) {
      const nome = poolPorChave.get(fileKey)?.nome ?? CLUBES.get(fileKey) ?? fileKey
      achado = { elenco: [], fonte: "so --incluir", nomeClube: nome }
      semElenco.push(`${rotulo ?? fileKey} (${fileKey}) — so --incluir`)
    } else if (catalogo || paresDe) { semElenco.push(`${rotulo ?? fileKey} (${fileKey})`); continue }
    else {
      console.error(`sem elenco para "${fileKey}" — nem Transfermarkt, nem curado, nem pool`)
      process.exit(1)
    }
  }
  const { elenco, fonte, nomeClube } = achado

  // nome normalizado -> nome COMO O JOGO ESCREVE (e ele que vira nome_original)
  const porNome = new Map()
  for (const p of elenco) if (p?.n) porNome.set(norm(p.n), p.n)

  // ─── Segundo passe: nome parcial ───────────────────────────────────────────
  //
  // O catalogo e o jogo abreviam diferente: "Benedetti" x "Luis Benedetti",
  // "Arthur" x "Arthur Gabriel". Casar so por igualdade exata perdia titular.
  //
  // ⚠️ MAS PRIMEIRO NOME NAO IDENTIFICA NINGUEM. A primeira versao desta regra
  // aceitava qualquer palavra de 4+ letras em comum e produziu tres trocas de
  // pessoa: "Felipe Goto" virou Felipe Anderson, "Vitor Andre" virou Vitor
  // Roque, "Rodrigo Cezar" virou Rodrigo Falcao. Todos casados pelo PRENOME.
  //
  // A regra que resta: a palavra em comum tem de ser a ULTIMA de um dos dois
  // lados — o sobrenome de quem esta no catalogo, ou o nome unico de quem esta
  // no jogo ("Alex"). Prenome no meio nao vale, e o token tem de ser unico no
  // elenco do clube.
  const tokensDe = nome => nome.split(/\s+/).map(norm).filter(t => t.length >= 4)
  const ultimoDe = nome => tokensDe(nome).at(-1) ?? ""

  const frequencia = new Map()
  for (const p of elenco) for (const t of new Set(tokensDe(p.n))) frequencia.set(t, (frequencia.get(t) ?? 0) + 1)
  const porToken = new Map()
  for (const p of elenco) {
    for (const t of new Set(tokensDe(p.n))) {
      if (frequencia.get(t) !== 1) continue
      porToken.set(t, { nome: p.n, ehUltimoNoJogo: ultimoDe(p.n) === t })
    }
  }

  const arquivos = readdirSync(pasta).filter(f => f.toLowerCase().endsWith(".png"))
  let casados = 0
  const sobraram = []
  const inferidos = []
  const incluidos = []
  const semRecorte = []
  const incluirNorm = new Map([...incluir].map(n => [norm(n), n]))

  for (const arquivo of arquivos) {
    // "Agustín Giay (2000044680).png" -> "Agustín Giay"
    const nomeDoArquivo = arquivo.replace(/\s*\(\d+\)\.png$/i, "").replace(/\.png$/i, "").trim()
    let doJogo = porNome.get(norm(nomeDoArquivo))
    if (!doJogo) {
      const ultimoNoCatalogo = ultimoDe(nomeDoArquivo)
      const candidatos = new Map()
      const palavras = s => s.trim().split(/\s+/).filter(Boolean)
      for (const t of tokensDe(nomeDoArquivo)) {
        const c = porToken.get(t)
        if (!c) continue
        // A palavra em comum precisa ser o sobrenome de um dos dois lados.
        if (t !== ultimoNoCatalogo && !c.ehUltimoNoJogo) continue
        // ⚠️ E SE OS DOIS LADOS DIZEM O PRENOME, ELE TEM DE BATER.
        //
        // "Matheus Ferreira" casou com "Pedro Ferreira" por sobrenome — sao
        // pessoas diferentes, e Ferreira e dos sobrenomes mais comuns do pais.
        // O casamento parcial so faz sentido quando um dos lados esta ABREVIADO
        // ("Benedetti", "Arthur", "Alex"); quando ambos trazem prenome e eles
        // divergem, sao duas pessoas.
        const pc = palavras(nomeDoArquivo)
        const pj = palavras(c.nome)
        if (pc.length > 1 && pj.length > 1 && norm(pc[0]) !== norm(pj[0])) continue
        candidatos.set(c.nome, t)
      }
      if (candidatos.size === 1) {
        const [nome, token] = [...candidatos][0]
        doJogo = nome
        inferidos.push(`${nomeDoArquivo} -> ${nome}  (por "${token}")`)
      }
    }
    if (!doJogo && incluirNorm.has(norm(nomeDoArquivo))) {
      // O nome pedido no --incluir vence o do arquivo: e ele que tem de casar
      // com a transferencia publicada.
      doJogo = incluirNorm.get(norm(nomeDoArquivo))
      incluidos.push(doJogo)
    }
    if (!doJogo) { sobraram.push(nomeDoArquivo); continue }

    const origem = path.join(pasta, arquivo)
    let fonte = origem
    if (recortar) {
      const r = await recortarPeitoral(origem)
      // Sem pescoco reconhecivel a foto vai INTEIRA (ja sem moldura), e o nome
      // aparece no relatorio: melhor um enquadramento largo do que um corte na
      // testa. Costuma ser retrato que ja vem justo, com o ombro saindo pela
      // borda — e ai nao ha estrangulamento para achar.
      fonte = r.fonte
      if (!r.recortou) semRecorte.push(nomeDoArquivo)
    }

    // ⚠️ WEBP, E AQUI ELE GANHA DE LAVADA — nao repita o resultado do escudo.
    // No escudo o PNG paletizado venceu (area chapada, monocromatico) e a nota
    // ficou registrada; ROSTO e o caso oposto: foto de verdade, com gradiente e
    // fundo. Medido nos mesmos 8 retratos do Corinthians: 786 KB em PNG contra
    // 55 KB em webp 82 — 14x. Em 1.085 retratos e a diferenca entre 125 MB e
    // 9 MB, e o orcamento de imagem do cliente e de 72 MB para TUDO (escudo,
    // uniforme e rosto): em PNG a maioria dos rostos nao caberia e sumiria da
    // tela sem erro nenhum, que e o sintoma classico daqui.
    const imagem = await sharp(fonte)
      .resize({ width: LARGURA, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer()

    const foto_data = `data:image/webp;base64,${imagem.toString("base64")}`
    itens.push({ file_key: fileKey, nome_original: doJogo, foto_data })
    // A chave curada tambem, quando existe: e ela que a tela consulta nas
    // Series A/B/C/D. Mesma imagem, e o servidor deduplica por sha.
    const gemeo = gemeoCurado(fileKey, nomeClube)
    if (gemeo) itens.push({ file_key: gemeo, nome_original: doJogo, foto_data })
    casados++
  }

  relatorio.push({ fileKey, nomeClube, fonte, gemeo: gemeoCurado(fileKey, nomeClube), naPasta: arquivos.length, casados, sobraram, inferidos, incluidos, semRecorte })
}

console.log("CASAMENTO POR CLUBE")
for (const r of relatorio) {
  console.log(`  ${r.nomeClube} (${r.fileKey}): ${r.casados} de ${r.naPasta} rostos — elenco ${r.fonte}`)
  // Inferencia aparece SEMPRE, uma por linha: e a unica parte do casamento que
  // nao e igualdade, e portanto a unica que pode colar o rosto errado.
  for (const i of r.inferidos) console.log(`     por sobrenome: ${i}`)
  // Idem para o --incluir: nao passou por trava nenhuma, foi decidido a mao.
  if (r.incluidos?.length) {
    console.log(`     fora do elenco do build (--incluir): ${r.incluidos.join(", ")}`)
  }
  if (r.sobraram.length) {
    console.log(`     sem atleta no elenco do jogo: ${r.sobraram.join(", ")}`)
  }
  if (r.semRecorte.length) {
    console.log(`     ⚠️ sem pescoco reconhecivel, foto inteira: ${r.semRecorte.join(", ")}`)
  }
}

if (catalogo) {
  if (ambiguos.length) console.log(`\nPASTA AMBIGUA (nenhuma foto publicada) — ${ambiguos.length}:\n   ${ambiguos.join("\n   ")}`)
  if (semClube.length) console.log(`\nSEM CLUBE no jogo — ${semClube.length}:\n   ${semClube.join("\n   ")}`)
  if (semElenco.length) console.log(`\nCLUBE SEM ELENCO no jogo — ${semElenco.length}:\n   ${semElenco.join("\n   ")}`)
}

// ⚠️ DOIS ARQUIVOS NA MESMA CHAVE, E NINGUEM RECLAMA. A pasta do Athletico tem
// "Dudu" e "Dudu Marques" e o elenco do jogo so tem "Dudu": os dois viram
// `atleticopr_bra__dudu`, o upsert do carregador grava por chave e vence o
// ULTIMO da ordem alfabetica — ou seja, o rosto e sorteado.
//
// Quem fica e quem casou por IGUALDADE de nome; a inferencia por sobrenome
// perde. Quando os dois sao inferencia, NENHUM fica: nao ha como saber, e cara
// de outra pessoa e pior do que silhueta.
const porChave = new Map()
for (const i of itens) {
  const k = `${i.file_key}__${norm(i.nome_original)}`
  const antes = porChave.get(k)
  if (!antes) { porChave.set(k, i); continue }
  if (antes.exato === i.exato) porChave.set(k, { ...antes, empatado: true })
  else if (i.exato) porChave.set(k, i)
}
const disputadas = [...porChave].filter(([, i]) => i.empatado)
const perdidas = itens.length - porChave.size
if (perdidas) console.log(`\n⚠️ ${perdidas} arquivos caiam na chave de outro ja presente (ficou o de nome exato).`)
if (disputadas.length) {
  console.log(`\n⚠️ ${disputadas.length} CHAVES EM EMPATE, nenhuma publicada:`)
  for (const [k] of disputadas) { console.log(`   ${k}`); porChave.delete(k) }
}
const finais = [...porChave.values()].map(({ exato, empatado, ...resto }) => resto)

const mb = (finais.reduce((s, i) => s + i.foto_data.length, 0) / 1024 / 1024).toFixed(1)
console.log(`
${finais.length} rostos prontos (~${mb} MB em base64)`)

if (!saida) {
  console.log("Ensaio. Use --exportar <arquivo> para gravar o pacote.")
  process.exit(0)
}
writeFileSync(saida, JSON.stringify({ jogadores: finais }), "utf-8")
console.log(`Exportado para ${saida}`)

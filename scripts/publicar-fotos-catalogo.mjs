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

if (!pares.length) {
  console.error('uso: --exportar saida.json fileKey="caminho da pasta" [outro=...]')
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

const itens = []
const relatorio = []

for (const { fileKey, pasta } of pares) {
  const nomeClube = CLUBES.get(fileKey)
  if (!nomeClube) {
    console.error(`file_key desconhecido: "${fileKey}" — confira em lib/teams-data.ts`)
    process.exit(1)
  }
  const achado = ELENCOS.get(normClube(nomeClube))
  if (!achado?.elenco?.length) {
    console.error(`sem elenco para "${nomeClube}" (${fileKey}) — nem Transfermarkt nem curado`)
    process.exit(1)
  }
  const { elenco, fonte } = achado

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

    itens.push({
      file_key: fileKey,
      nome_original: doJogo,
      foto_data: `data:image/webp;base64,${imagem.toString("base64")}`,
    })
    casados++
  }

  relatorio.push({ fileKey, nomeClube, fonte, naPasta: arquivos.length, casados, sobraram, inferidos, incluidos, semRecorte })
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

const mb = (itens.reduce((s, i) => s + i.foto_data.length, 0) / 1024 / 1024).toFixed(1)
console.log(`\n${itens.length} rostos prontos (~${mb} MB em base64)`)

if (!saida) {
  console.log("Ensaio. Use --exportar <arquivo> para gravar o pacote.")
  process.exit(0)
}
writeFileSync(saida, JSON.stringify({ jogadores: itens }), "utf-8")
console.log(`Exportado para ${saida}`)

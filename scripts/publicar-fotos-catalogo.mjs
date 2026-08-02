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

import { readFileSync, writeFileSync, readdirSync } from "node:fs"
import path from "node:path"
import sharp from "sharp"

const RAIZ = path.resolve(import.meta.dirname, "..")
const LARGURA = 320 // mesma do editor (compressImageDataUrl)

const saida = process.argv.includes("--exportar")
  ? process.argv[process.argv.indexOf("--exportar") + 1]
  : ""

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
const norm = s => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")

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

// ─── Elenco real por clube ───────────────────────────────────────────────────
// As chaves de real-squads-tm.json sao `SIGLA|nome em minusculas`.
function elencosPorNome() {
  const real = JSON.parse(readFileSync(path.join(RAIZ, "data/seeds/real-squads-tm.json"), "utf-8"))
  const mapa = new Map()
  for (const [chave, elenco] of Object.entries(real)) {
    const nome = chave.split("|")[1]
    if (nome) mapa.set(nome.toLowerCase(), elenco ?? [])
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
  const elenco = ELENCOS.get(nomeClube.toLowerCase())
  if (!elenco?.length) {
    console.error(`sem elenco real para "${nomeClube}" (${fileKey})`)
    process.exit(1)
  }

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
    if (!doJogo) { sobraram.push(nomeDoArquivo); continue }

    const png = await sharp(path.join(pasta, arquivo))
      .resize({ width: LARGURA, withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer()

    itens.push({
      file_key: fileKey,
      nome_original: doJogo,
      foto_data: `data:image/png;base64,${png.toString("base64")}`,
    })
    casados++
  }

  relatorio.push({ fileKey, nomeClube, naPasta: arquivos.length, casados, sobraram, inferidos })
}

console.log("CASAMENTO POR CLUBE")
for (const r of relatorio) {
  console.log(`  ${r.nomeClube} (${r.fileKey}): ${r.casados} de ${r.naPasta} rostos`)
  // Inferencia aparece SEMPRE, uma por linha: e a unica parte do casamento que
  // nao e igualdade, e portanto a unica que pode colar o rosto errado.
  for (const i of r.inferidos) console.log(`     por sobrenome: ${i}`)
  if (r.sobraram.length) {
    console.log(`     sem atleta no elenco do jogo: ${r.sobraram.join(", ")}`)
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

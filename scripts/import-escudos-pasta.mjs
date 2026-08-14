// Importa os escudos da pasta `Escudos/` para public/escudos, casando cada
// arquivo com o clube certo.
//
// O relato: "Olaria e São Gonçalo estão sem escudo". Os arquivos EXISTIAM em
// public/escudos, mas eram placeholders de ~2,5 KB; os escudos de verdade
// (150-200 KB) estavam parados na pasta `Escudos/`, nunca importados.
//
// O casamento e por NOME + UF/PAIS no nome do arquivo ("Olaria - RJ.png" ->
// clube Olaria do RJ). Ambiguo (mesmo nome em UFs diferentes) sem a UF no
// arquivo NAO e importado — melhor deixar como esta do que por o escudo do
// Botafogo-PB no Botafogo-RJ.
//
// COMPRESSAO: 181 arquivos de ~180 KB somariam ~32 MB no instalador. Reduzimos
// para 256px, que e o maior tamanho que qualquer tela usa.
//
//   node scripts/import-escudos-pasta.mjs --dry   (so relatorio)
//   node scripts/import-escudos-pasta.mjs         (importa)

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import sharp from "sharp"

// A pasta de origem pode ficar no G: (Google Drive) enquanto o script roda em
// C:\Ultrafoot — o node_modules do G: e corrompido pelo Drive e o sharp nao
// carrega de la. Por isso --origem aceita caminho absoluto.
const argOrigem = process.argv.indexOf("--origem")
const ORIGEM = argOrigem >= 0 ? path.resolve(process.argv[argOrigem + 1]) : path.resolve("Escudos")
const DESTINO = path.resolve("public/escudos")
const DRY = process.argv.includes("--dry")
const TAMANHO = 256

// UF/pais no fim do nome do arquivo -> sufixo do file_key no jogo.
// Os sufixos sao os que o JOGO usa no file_key (conferido no proprio dado:
// columbuscrew_eua, aldosivi_arg, tigres_col). Eu tinha chutado EUA -> "usa" e
// a MLS inteira falhava na validacao.
// ⚠️ ESTA TABELA JA CUSTOU UMA CONCLUSAO ERRADA. Em 12/08/2026 eu rodei o
// casamento sobre a pasta do canal e reportei "zero dos 660 clubes sem escudo
// sao cobertos". Era falso: a pasta tem "Slavia Praga - CZE.png" e
// "Dinamo Zagreb - Croacia.png", e nenhum desses sufixos estava aqui — o
// arquivo existia e o casamento e que nao o enxergava.
//
// Duas licoes ficaram no formato desta tabela:
//   1. Ela cobria so a America do Sul e as cinco grandes ligas, porque foi
//      escrita quando o jogo tinha so isso. Toda expansao de paises PRECISA
//      passar por aqui, senao os escudos entram na pasta e nao chegam ao jogo.
//   2. O sufixo nem sempre e sigla: o arquivo pode trazer o PAIS POR EXTENSO.
//      Por isso NOME_DO_PAIS existe logo abaixo.
const SUFIXO_PAIS = {
  ARG: "arg", ARB: "arb", POR: "por", ING: "ing", EUA: "eua", ESP: "esp",
  ITA: "ita", ALE: "ale", FRA: "fra", HOL: "hol", MEX: "mex", CHI: "chi",
  URU: "uru", COL: "col", PAR: "par", BOL: "bol", EQU: "equ", VEN: "ven",
  // Expansao UEFA e resto do mundo — os sufixos sao os que o JOGO usa no
  // file_key (conferido em data/seeds/escudos-faltantes.json).
  ROM: "rou", ROU: "rou", POL: "pol", AUT: "aut", AUS: "aut",
  BLR: "blr", BIE: "blr", BUL: "bgr", BGR: "bgr", LUX: "lux",
  SUE: "swe", SWE: "swe", UCR: "ukr", UKR: "ukr", SMR: "smr",
  ISR: "isr", SER: "srb", SRB: "srb", SUI: "sui", SUV: "sui",
  ESL: "svk", SVK: "svk", NIR: "nir", MLT: "mlt", MAL: "mlt",
  GAL: "wal", WAL: "wal", ISL: "isl", ALB: "alb", AND: "and",
  CRO: "hrv", HRV: "hrv", EST: "est", FIN: "fin", GEO: "geo",
  GIB: "gib", HUN: "hun", HUN2: "hun", FRO: "fro", KVX: "kvx",
  KOS: "kvx", LVA: "lva", LET: "lva", LTU: "ltu", LIT: "ltu",
  MNE: "mne", BIH: "bih", IRL: "irl", MKD: "mkd", SVN: "svn",
  ESN: "svn", MDA: "mda", ARM: "arm", CZE: "cze", TCH: "cze",
  NOR: "nor", DEN: "den", DIN: "den", GRE: "gre", GRC: "gre",
  CYP: "cyp", CIP: "cyp", AZE: "aze", AZB: "aze", KAZ: "kaz",
  TUR: "tur", RUS: "rus", UCRA: "ukr", COR: "kor", JAP: "jpn",
  CHN: "chn", ESC: "esc", SCO: "esc", BEL: "bel", ECU: "equ",
  PER: "per",
}

/**
 * O sufixo pode vir com o PAIS POR EXTENSO ("Dinamo Zagreb - Croacia.png").
 * Normalizado sem acento e em maiuscula, cai nas mesmas chaves acima.
 */
const NOME_DO_PAIS = {
  CROACIA: "hrv", ROMENIA: "rou", POLONIA: "pol", AUSTRIA: "aut",
  BELARUS: "blr", BULGARIA: "bgr", LUXEMBURGO: "lux", SUECIA: "swe",
  UCRANIA: "ukr", ISRAEL: "isr", SERVIA: "srb", SERBIA: "srb",
  SUICA: "sui", ESLOVAQUIA: "svk", ESLOVENIA: "svn", MALTA: "mlt",
  ISLANDIA: "isl", ALBANIA: "alb", ANDORRA: "and", ESTONIA: "est",
  FINLANDIA: "fin", GEORGIA: "geo", GIBRALTAR: "gib", HUNGRIA: "hun",
  KOSOVO: "kvx", LETONIA: "lva", LITUANIA: "ltu", MONTENEGRO: "mne",
  IRLANDA: "irl", MOLDAVIA: "mda", ARMENIA: "arm", CHEQUIA: "cze",
  TCHEQUIA: "cze", NORUEGA: "nor", DINAMARCA: "den", GRECIA: "gre",
  CHIPRE: "cyp", AZERBAIJAO: "aze", CAZAQUISTAO: "kaz", TURQUIA: "tur",
  RUSSIA: "rus", ESCOCIA: "esc", BELGICA: "bel", HOLANDA: "hol",
  PORTUGAL: "por", ESPANHA: "esp", ITALIA: "ita", ALEMANHA: "ale",
  FRANCA: "fra", INGLATERRA: "ing",
}
const UFS = new Set(["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"])

const norm = s => (s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "")

/** "Olaria - RJ.png" -> { nome: "Olaria", uf: "RJ" } */
function parseArquivo(arquivo) {
  const base = arquivo.replace(/\.png$/i, "")
  // Ate 14 letras: o sufixo pode ser sigla ("CZE") ou o pais por extenso
  // ("Croacia", "Cazaquistao"). Com o limite de 4 que havia aqui, todo arquivo
  // escrito por extenso caia em `uf: null` e perdia a validacao de pais.
  const m = base.match(/^(.*?)\s*[-–]\s*([A-Za-zÀ-ÿ ]{2,14})$/)
  if (m) {
    const bruto = m[2].trim()
    const sigla = bruto.toUpperCase()
    if (UFS.has(sigla) || SUFIXO_PAIS[sigla]) return { nome: m[1].trim(), uf: sigla }
    const porExtenso = NOME_DO_PAIS[norm(bruto).toUpperCase()]
    if (porExtenso) return { nome: m[1].trim(), uf: sigla, sufixoDireto: porExtenso }
  }
  return { nome: base.trim(), uf: null }
}

async function main() {
  if (!existsSync(ORIGEM)) { console.error(`Pasta nao encontrada: ${ORIGEM}`); process.exit(1) }
  await mkdir(DESTINO, { recursive: true })

  // Catalogo de clubes: le o teams-data compilado nao da; usamos os arquivos ja
  // existentes em public/escudos como universo de file_keys validos, mais o
  // mapa nome->file_key montado a partir do proprio nome do arquivo.
  const seed = JSON.parse(await readFile(path.resolve("data/seeds/imported-bf2026.json"), "utf8"))
  const clubes = []
  for (const t of seed.teams ?? []) {
    if (t.fileKey || t.file_key) clubes.push({ nome: t.nome, fileKey: t.fileKey ?? t.file_key, uf: t.estado ?? null, pais: t.pais ?? null })
  }

  // ⚠️ O SEED SOZINHO NAO E O UNIVERSO DO JOGO — e esta e a segunda camada do
  // mesmo engano.
  //
  // Depois da expansao UEFA, o MESMO clube existe com DUAS chaves: o seed antigo
  // guarda `slavia_cze` e `dinamozagreb_cro`, e o jogo procura
  // `slavia_praha_b` e `dinamo_zagreb_hrv`. Casando so contra o seed, o arquivo
  // "Slavia Praga - CZE.png" era gravado numa chave que NENHUMA tela consulta —
  // o escudo entrava no repositorio e continuava faltando na tela, sem erro
  // nenhum. E a mesma familia do escudo publicado que nunca chegava ao jogo.
  //
  // `data/seeds/escudos-faltantes.json` e gerado a partir de `allTeams` (o
  // universo real) por scripts/gerar-lista-escudos-faltantes.ts. Os clubes dele
  // entram PRIMEIRO: sao justamente os que precisam do arquivo.
  const alvos = path.resolve("data/seeds/escudos-faltantes.json")
  let faltantes = 0
  if (existsSync(alvos)) {
    for (const t of JSON.parse(await readFile(alvos, "utf8"))) {
      clubes.unshift({ nome: t.nome, fileKey: t.fileKey, uf: null, pais: t.pais ?? null, precisa: true, escudo: t.escudo })
      faltantes++
    }
    console.log(`alvos sem escudo carregados: ${faltantes}`)
  }
  // Indice por nome normalizado -> lista de clubes (pode ter homonimos).
  const porNome = new Map()
  for (const c of clubes) {
    const k = norm(c.nome)
    if (!porNome.has(k)) porNome.set(k, [])
    porNome.get(k).push(c)
  }

  const arquivos = (await readdir(ORIGEM)).filter(f => /\.png$/i.test(f))
  let importados = 0, ambiguos = 0, semClube = 0
  const relatorio = { ambiguos: [], semClube: [], casados: [] }

  for (const arquivo of arquivos) {
    const { nome, uf, sufixoDireto } = parseArquivo(arquivo)
    const candidatos = porNome.get(norm(nome)) ?? []

    // A UF/pais do nome do arquivo VALIDA sempre, nao so desempata.
    //
    // Sem isto, "Santos - MEX.png" (Santos Laguna) casava com o Santos
    // BRASILEIRO — unico candidato pelo nome, sufixo ignorado — e o escudo do
    // mexicano ia parar na Vila Belmiro. "TIGRES - MEX" idem, foi para o Tigres
    // colombiano. Escudo errado e pior que escudo faltando.
    const compativel = (c) => {
      if (!uf) return true
      const alvoUf = (c.uf ?? "").toUpperCase()
      if (UFS.has(uf)) return alvoUf === uf || norm(c.fileKey).includes(norm(uf))
      // Pais: confere pelo sufixo do fileKey (ex.: _arg, _mex) ou pelo campo pais.
      const suf = sufixoDireto ?? SUFIXO_PAIS[uf]
      return Boolean(suf) && (norm(c.fileKey).endsWith(suf) || norm(c.pais ?? "").startsWith(suf.slice(0, 3)))
    }

    let validos = candidatos.filter(compativel)
    // Empate entre a chave velha do seed e a chave nova do jogo: fica com quem
    // esta SEM escudo. Gravar na outra seria escrever num arquivo que a tela
    // nao le.
    const precisando = validos.filter(c => c.precisa)
    if (precisando.length) validos = precisando
    const alvo = validos.length === 1 ? validos[0] : null

    if (!alvo) {
      if (candidatos.length > 1) { ambiguos++; relatorio.ambiguos.push(`${arquivo} (${candidatos.length} clubes com esse nome)`) }
      else { semClube++; relatorio.semClube.push(arquivo) }
      continue
    }

    if (!DRY) {
      // ⚠️ A EXTENSAO TEM DE SER A QUE A TELA PROCURA — terceira camada do mesmo
      // engano de hoje. `getLocalEscudoPath` devolve `.webp` por padrao; gravar
      // `.png` aqui poe o arquivo no repositorio e deixa o clube sem escudo do
      // mesmo jeito, sem erro nenhum em lugar nenhum.
      //
      // O alvo carrega o caminho exato quando veio da lista de faltantes; sem
      // ele, mantemos `.png`, que e o que o catalogo antigo usa.
      const destinoRelativo = alvo.escudo ?? `/escudos/${alvo.fileKey}.png`
      const nomeFinal = path.basename(destinoRelativo)
      const ehWebp = /\.webp$/i.test(nomeFinal)

      const base = sharp(await readFile(path.join(ORIGEM, arquivo)))
        .resize(TAMANHO, TAMANHO, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      // PNG paletizado ganha do webp em escudo (area chapada, poucas cores);
      // webp so entra quando e a extensao que a tela pede.
      const saida = await (ehWebp
        ? base.webp({ quality: 92, effort: 4 })
        : base.png({ compressionLevel: 9, palette: true })).toBuffer()
      await writeFile(path.join(DESTINO, nomeFinal), saida)
    }
    relatorio.casados.push(`${arquivo} -> ${alvo.nome} [${alvo.fileKey}]`)
    importados++
  }

  console.log(`arquivos na pasta : ${arquivos.length}`)
  console.log(`IMPORTADOS        : ${importados}${DRY ? " (dry-run, nada gravado)" : ""}`)
  console.log(`ambiguos (pulados): ${ambiguos}`)
  console.log(`sem clube         : ${semClube}`)
  // `--todos` imprime a lista COMPLETA em vez da amostra de 18. Serve para
  // cruzar o casamento com a lista de clubes sem escudo ANTES de gravar: escudo
  // errado é pior do que escudo nenhum, porque o canal vence o embutido e apaga
  // a arte boa que já viajava no build (o Santos com o escudo do Santos Laguna).
  const TODOS = process.argv.includes("--todos")
  if (DRY) console.log("\ncasamentos:\n  " + (TODOS ? relatorio.casados : relatorio.casados.slice(0, 18)).join("\n  "))
  if (relatorio.ambiguos.length) console.log("\nambiguos:\n  " + relatorio.ambiguos.slice(0, 15).join("\n  "))
  if (relatorio.semClube.length) console.log("\nsem clube no jogo:\n  " + relatorio.semClube.slice(0, 25).join("\n  "))
}

main().catch(e => { console.error(e); process.exit(1) })

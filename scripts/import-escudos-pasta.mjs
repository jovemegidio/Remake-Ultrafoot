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
const SUFIXO_PAIS = {
  ARG: "arg", ARB: "arb", POR: "por", ING: "ing", EUA: "eua", ESP: "esp",
  ITA: "ita", ALE: "ale", FRA: "fra", HOL: "hol", MEX: "mex", CHI: "chi",
  URU: "uru", COL: "col", PAR: "par", BOL: "bol", EQU: "equ", VEN: "ven",
}
const UFS = new Set(["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"])

const norm = s => (s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "")

/** "Olaria - RJ.png" -> { nome: "Olaria", uf: "RJ" } */
function parseArquivo(arquivo) {
  const base = arquivo.replace(/\.png$/i, "")
  const m = base.match(/^(.*?)\s*-\s*([A-Za-z]{2,4})$/)
  if (m) {
    const suf = m[2].toUpperCase()
    if (UFS.has(suf) || SUFIXO_PAIS[suf]) return { nome: m[1].trim(), uf: suf }
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
    const { nome, uf } = parseArquivo(arquivo)
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
      const suf = SUFIXO_PAIS[uf]
      return Boolean(suf) && (norm(c.fileKey).endsWith(suf) || norm(c.pais ?? "").startsWith(suf.slice(0, 3)))
    }

    const validos = candidatos.filter(compativel)
    const alvo = validos.length === 1 ? validos[0] : null

    if (!alvo) {
      if (candidatos.length > 1) { ambiguos++; relatorio.ambiguos.push(`${arquivo} (${candidatos.length} clubes com esse nome)`) }
      else { semClube++; relatorio.semClube.push(arquivo) }
      continue
    }

    if (!DRY) {
      const buf = await readFile(path.join(ORIGEM, arquivo))
      const png = await sharp(buf)
        .resize(TAMANHO, TAMANHO, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ compressionLevel: 9, palette: true })
        .toBuffer()
      await writeFile(path.join(DESTINO, `${alvo.fileKey}.png`), png)
    }
    relatorio.casados.push(`${arquivo} -> ${alvo.nome} [${alvo.fileKey}]`)
    importados++
  }

  console.log(`arquivos na pasta : ${arquivos.length}`)
  console.log(`IMPORTADOS        : ${importados}${DRY ? " (dry-run, nada gravado)" : ""}`)
  console.log(`ambiguos (pulados): ${ambiguos}`)
  console.log(`sem clube         : ${semClube}`)
  if (DRY) console.log("\namostra de casamentos:\n  " + relatorio.casados.slice(0, 18).join("\n  "))
  if (relatorio.ambiguos.length) console.log("\nambiguos:\n  " + relatorio.ambiguos.slice(0, 15).join("\n  "))
  if (relatorio.semClube.length) console.log("\nsem clube no jogo:\n  " + relatorio.semClube.slice(0, 25).join("\n  "))
}

main().catch(e => { console.error(e); process.exit(1) })

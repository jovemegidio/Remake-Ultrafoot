// Extrai do DF11 os rostos JA MAPEADOS e os empacota no formato do jogo.
//
//   node scripts/importar-faces-df11.mjs            # mostra o que faria
//   node scripts/importar-faces-df11.mjs --gravar   # extrai, converte e registra
//
// Entra: data/seeds/face-id-map.json (FM ID -> id do atleta), feito pelo
// mapear-faces-fm.mjs. Sai: public/jogadores/df11-<id>.webp + a entrada no
// player_photo_overrides.json + faces-manifest.json regerado.
//
// POR QUE WEBP DE 200px. O PNG do pack tem 260x310 e 58 KB de media — 3.604 deles
// dariam 205 MB num instalador que ja pesa 550. Em webp q82 com 200px de altura
// cada rosto fica em ~5 KB (18 MB no total) e a transparencia do recorte
// sobrevive (yuva420p), que e o que faz o cutout parecer cutout.
//
// A CHAVE E O ID DO ATLETA, nao o nome. `lib/player-photos.ts` consulta o
// manifesto primeiro por id e so depois por nome normalizado; com id, xara nao
// rouba rosto de ninguem.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, rmSync } from "node:fs"
import { execFileSync, spawn } from "node:child_process"
import { cpus } from "node:os"
import path from "node:path"

const RAIZ = path.resolve(import.meta.dirname, "..")
const ZIP = process.env.DF11_ZIP
  ?? "C:/Users/SnyX/Downloads/DF11 Classic - Megapack FM26 (Original 13GB).zip"
const MAPA = path.join(RAIZ, "data/seeds/face-id-map.json")
const ORIGEM = path.join(RAIZ, "data/faces-fm/origem-do-rosto.json")
const OVERRIDES = path.join(RAIZ, "data/seeds/player_photo_overrides.json")
const DESTINO = path.join(RAIZ, "public/jogadores")
const TEMP = path.join(RAIZ, "data/faces-fm/png-extraidos")

const gravar = process.argv.includes("--gravar")
const ALTURA = 200
const QUALIDADE = 82

if (!existsSync(ZIP)) throw new Error(`zip do DF11 nao encontrado: ${ZIP}\n  (defina DF11_ZIP)`)

const mapa = JSON.parse(readFileSync(MAPA, "utf-8"))
const origem = existsSync(ORIGEM) ? JSON.parse(readFileSync(ORIGEM, "utf-8")) : {}

// Sem origem registrada, tenta o DF11: as 5 entradas escritas a mao nao passaram
// pelo `casar` e nao tem origem, mas os arquivos existem no pack.
const alvos = Object.entries(mapa).filter(([fmId]) => (origem[fmId] ?? "df11") === "df11")

console.log(`mapa:      ${Object.keys(mapa).length} vinculos`)
console.log(`do DF11:   ${alvos.length}`)
console.log(`destino:   ${path.relative(RAIZ, DESTINO)}/df11-<id>.webp  (${ALTURA}px, q${QUALIDADE})`)

const jaFeitos = new Set(
  existsSync(DESTINO)
    ? readdirSync(DESTINO).filter(f => f.startsWith("df11-") && f.endsWith(".webp"))
    : [],
)
const pendentes = alvos.filter(([, id]) => !jaFeitos.has(`df11-${id}.webp`))
console.log(`ja no disco: ${alvos.length - pendentes.length}  |  a fazer: ${pendentes.length}`)

if (!gravar) {
  console.log("\nNada foi gravado. Rode com --gravar para valer.")
  process.exit(0)
}
if (pendentes.length === 0) {
  console.log("\nNada a fazer.")
  process.exit(0)
}

// ─── 1. Extracao ─────────────────────────────────────────────────────────────
//
// UMA passada pelo indice do zip. Procurar entrada por entrada (`Where-Object`
// por id) e O(n*m): com 243 mil entradas e milhares de alvos, nao termina.

mkdirSync(TEMP, { recursive: true })
const listaAlvos = path.join(TEMP, "_alvos.txt")
writeFileSync(listaAlvos, pendentes.map(([fmId]) => `${fmId}.png`).join("\n"))

console.log("\n→ extraindo do zip (uma passada pelo indice)")
const ps = `
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$querer = New-Object System.Collections.Generic.HashSet[string]
foreach ($l in Get-Content '${listaAlvos.replace(/\\/g, "/")}') { if ($l) { [void]$querer.Add($l) } }
$z = [System.IO.Compression.ZipFile]::OpenRead('${ZIP.replace(/\\/g, "/")}')
$n = 0
foreach ($e in $z.Entries) {
  if ($querer.Contains($e.Name)) {
    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($e, (Join-Path '${TEMP.replace(/\\/g, "/")}' $e.Name), $true)
    $n++
  }
}
$z.Dispose()
Write-Output "extraidos=$n"
`
const saida = execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", ps],
  { encoding: "utf-8", maxBuffer: 16 * 1024 * 1024 })
console.log(`  ${saida.trim()}`)

// ─── 2. Conversao ────────────────────────────────────────────────────────────

mkdirSync(DESTINO, { recursive: true })
const paralelo = Math.max(2, Math.min(8, cpus().length - 2))
console.log(`\n→ convertendo para webp (${paralelo} de cada vez)`)

let feitos = 0, faltando = 0, erros = 0
const fila = [...pendentes]

async function converter(fmId, jogadorId) {
  const entrada = path.join(TEMP, `${fmId}.png`)
  if (!existsSync(entrada)) { faltando++; return }
  const saidaArq = path.join(DESTINO, `df11-${jogadorId}.webp`)
  await new Promise((resolve) => {
    const p = spawn("ffmpeg", [
      "-y", "-v", "error", "-i", entrada,
      "-vf", `scale=-1:${ALTURA}`,
      "-c:v", "libwebp", "-q:v", String(QUALIDADE), "-compression_level", "6",
      saidaArq,
    ], { stdio: "ignore" })
    p.on("exit", (codigo) => {
      if (codigo === 0 && existsSync(saidaArq) && statSync(saidaArq).size > 0) feitos++
      else erros++
      resolve()
    })
    p.on("error", () => { erros++; resolve() })
  })
  if ((feitos + erros) % 500 === 0) console.log(`  ${feitos + erros}/${pendentes.length}`)
}

const trabalhadores = Array.from({ length: paralelo }, async () => {
  for (;;) {
    const proximo = fila.shift()
    if (!proximo) return
    await converter(proximo[0], proximo[1])
  }
})
await Promise.all(trabalhadores)

console.log(`  convertidos ${feitos}  |  png ausente no pack ${faltando}  |  erros ${erros}`)

// ─── 3. Registro ─────────────────────────────────────────────────────────────

const overrides = JSON.parse(readFileSync(OVERRIDES, "utf-8"))
let novos = 0
for (const [, jogadorId] of alvos) {
  const arquivo = `df11-${jogadorId}.webp`
  if (!existsSync(path.join(DESTINO, arquivo))) continue
  // O cutout do DF11 VENCE o retrato do Transfermarkt de proposito: misturar
  // recorte transparente com foto de fundo real fica pior que qualquer um dos
  // dois puro. Quem nao tem DF11 continua no Transfermarkt.
  if (overrides[jogadorId] !== `/jogadores/${arquivo}`) novos++
  overrides[jogadorId] = `/jogadores/${arquivo}`
}
writeFileSync(OVERRIDES, `${JSON.stringify(overrides, null, 2)}\n`)
console.log(`\n→ overrides: ${novos} entradas novas/atualizadas (${Object.keys(overrides).length} no total)`)

execFileSync("node", ["scripts/build-faces-manifest.mjs"], { cwd: RAIZ, stdio: "inherit" })

// Os PNGs crus sao intermediarios: 58 KB cada, sem uso depois do webp.
rmSync(TEMP, { recursive: true, force: true })
console.log("\nPRONTO. Rode o build para empacotar as fotos novas.")

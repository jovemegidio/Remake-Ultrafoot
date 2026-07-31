// IMPORTA OS ROSTOS DIRETO DA PASTA `DF11 Catalogo`.
//
//   node scripts/importar-faces-catalogo.mjs            # mostra o que faria
//   node scripts/importar-faces-catalogo.mjs --gravar   # converte e registra
//
// POR QUE ESTE, E NÃO O `importar-faces-df11.mjs`.
//
// O importador antigo extrai cada PNG do zip de 13 GB do megapack. A pasta
// `DF11 Catalogo` é o MESMO acervo já extraído (a árvore é feita de hardlink, o
// que é o motivo de ela custar ~0 byte), organizada em País/Clube/Nome (ID).png
// mais um `_Sem identificacao/<prefixo>/<ID>.png` para os rostos que a varredura
// nunca conseguiu atribuir a alguém. Ler dali dispensa o zip inteiro.
//
// O QUE ISTO CONSERTA — e é o achado que motivou o script:
//
// O `face-id-map.json` tinha **16.495 vínculos** e o jogo só tinha **7.913
// arquivos** de rosto em disco. Ou seja, 8.510 rostos já estavam CASADOS com um
// atleta e nunca chegaram a virar imagem — a importação anterior parou no meio e
// ninguém percebeu, porque nada quebra: o atleta simplesmente cai na silhueta.
// Destes, 8.141 existem no catálogo. É quase dobrar os rostos do jogo sem
// depender de nenhum casamento novo.
//
// FORMATO. webp 310px q90 com alfa (`yuva420p` vem de graça no libwebp): o PNG
// do pack tem 260x310 e ~58 KB; em webp fica em ~5 KB e a transparência do
// recorte sobrevive, que é o que faz o cutout parecer cutout. O mesmo formato do
// importador antigo, para os rostos novos não destoarem dos que já estão no ar.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, rmSync } from "node:fs"
import { spawn } from "node:child_process"
import { cpus } from "node:os"
import path from "node:path"

const RAIZ = path.resolve(import.meta.dirname, "..")
const CATALOGO = process.env.DF11_CATALOGO ?? "C:/Users/SnyX/Downloads/DF11 Catalogo"
const MAPA = path.join(RAIZ, "data/seeds/face-id-map.json")
const DESTINO = path.join(RAIZ, "public/jogadores")
const RELATORIO = path.join(RAIZ, "data/faces-fm/importacao-catalogo.json")

const gravar = process.argv.includes("--gravar")
/** Apaga os rostos de atleta que não existe no jogo (libera espaço no instalador). */
const limpar = process.argv.includes("--limpar")
const ALTURA = 310
const QUALIDADE = 90

// ─── SÓ QUEM EXISTE NO JOGO ──────────────────────────────────────────────────
//
// O `face-id-map` foi montado por uma varredura que casou o facepack com uma
// base de atletas MAIOR do que a que o jogo carrega: dos 16.740 vínculos, 3.975
// (24%) apontam para gente que não está em elenco nenhum do jogo. Converter esses
// rostos é peso morto no instalador — ninguém nunca vai vê-los.
//
// O conjunto abaixo é a verdade sobre quem existe: os ids `tm_<id>` derivados do
// campo do Transfermarkt nos elencos reais e no pool importado. É a MESMA regra
// que `lib/player-photos.ts` usa para consultar o manifesto, então o que passa
// por aqui é exatamente o que a tela consegue exibir.
function idsQueExistemNoJogo() {
  const ids = new Set()
  const idDoJogo = (f) => {
    const bruto = String(f ?? "").split("-")[0].trim()
    return bruto ? `tm_${bruto}` : ""
  }
  const real = JSON.parse(readFileSync(path.join(RAIZ, "data/seeds/real-squads-tm.json"), "utf-8"))
  for (const elenco of Object.values(real)) {
    for (const p of elenco ?? []) { const i = idDoJogo(p.f); if (i) ids.add(i) }
  }
  const bf = JSON.parse(readFileSync(path.join(RAIZ, "data/seeds/imported-bf2026.json"), "utf-8"))
  for (const t of bf.teams ?? []) {
    for (const j of t.jogadores ?? []) { const i = idDoJogo(j.ft); if (i) ids.add(i) }
  }
  return ids
}

if (!existsSync(CATALOGO)) throw new Error(`catálogo não encontrado: ${CATALOGO}\n  (defina DF11_CATALOGO)`)

// ─── Índice do catálogo por FM ID ────────────────────────────────────────────
//
// Percorre a árvore inteira, inclusive `_Sem identificacao`: aqui não importa de
// quem é o rosto — o vínculo já foi decidido no face-id-map. O que se quer é
// achar o arquivo daquele FM ID, e ele pode estar em qualquer um dos dois lados.
console.log("indexando o catálogo...")
const porFmId = new Map()
;(function varrer(dir) {
  let itens
  try { itens = readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const item of itens) {
    const cheio = path.join(dir, item.name)
    if (item.isDirectory()) { varrer(cheio); continue }
    if (!item.name.toLowerCase().endsWith(".png")) continue
    // Cobre "Nome (123456).png" e "123456.png" com o mesmo padrão.
    const m = /(\d{4,})\)?\.png$/i.exec(item.name)
    if (m) porFmId.set(m[1], cheio)
  }
})(CATALOGO)
console.log(`  ${porFmId.size} rostos indexados`)

// ─── O que falta materializar ────────────────────────────────────────────────

const mapa = JSON.parse(readFileSync(MAPA, "utf-8"))
mkdirSync(DESTINO, { recursive: true })
const emDisco = new Set(
  readdirSync(DESTINO)
    .filter((f) => f.startsWith("df11-") && f.endsWith(".webp"))
    .map((f) => f.slice("df11-".length, -".webp".length)),
)

const noJogo = idsQueExistemNoJogo()

const pendentes = []
let semArquivo = 0, foraDoJogo = 0
for (const [fmId, jogadorId] of Object.entries(mapa)) {
  if (!noJogo.has(jogadorId)) { foraDoJogo++; continue }
  if (emDisco.has(jogadorId)) continue
  const origem = porFmId.get(fmId)
  if (!origem) { semArquivo++; continue }
  pendentes.push([fmId, jogadorId, origem])
}

// Rostos já convertidos de gente que não está no jogo: peso morto no instalador.
const sobrando = [...emDisco].filter((id) => !noJogo.has(id))

console.log("")
console.log(`atletas com id no jogo : ${noJogo.size}`)
console.log(`vínculos no mapa       : ${Object.keys(mapa).length}`)
console.log(`  fora do jogo (pulados): ${foraDoJogo}`)
console.log(`rostos já em disco     : ${emDisco.size}  (${sobrando.length} de quem não está no jogo)`)
console.log(`a converter            : ${pendentes.length}`)
console.log(`sem PNG no acervo      : ${semArquivo}`)
console.log(`destino                : public/jogadores/df11-<id>.webp  (${ALTURA}px, q${QUALIDADE})`)
if (sobrando.length > 0) {
  console.log(`\n${limpar ? "→ APAGANDO" : "use --limpar para apagar"} os ${sobrando.length} rostos sem atleta correspondente`)
}

if (!gravar) {
  console.log("\nNada gravado. Rode com --gravar para valer.")
  process.exit(0)
}

let apagados = 0
if (limpar) {
  for (const id of sobrando) {
    try { rmSync(path.join(DESTINO, `df11-${id}.webp`)); apagados++ } catch { /* já não existe */ }
  }
  console.log(`apagados: ${apagados} rostos sem atleta no jogo`)
}

// ⚠️ Sem `exit` aqui, mesmo com a fila vazia: o REGISTRO no mapa editorial vem
// depois e precisa rodar sempre. Um `process.exit(0)` neste ponto foi o que fez
// 12.542 arquivos existirem em disco com só 8.660 no manifesto — os rostos
// estavam lá e o jogo não os enxergava.
if (pendentes.length === 0) {
  console.log("\nNada a converter — todo atleta do jogo com vínculo já tem rosto.")
}

// ─── Conversão ───────────────────────────────────────────────────────────────

const paralelo = Math.max(2, Math.min(8, cpus().length - 2))
if (pendentes.length > 0) console.log(`\n→ convertendo (${paralelo} de cada vez)`)

let feitos = 0, erros = 0
const fila = [...pendentes]

async function converter(_fmId, jogadorId, origem) {
  const saida = path.join(DESTINO, `df11-${jogadorId}.webp`)
  await new Promise((resolve) => {
    const p = spawn("ffmpeg", [
      "-y", "-v", "error", "-i", origem,
      "-vf", `scale=-1:${ALTURA}`,
      "-c:v", "libwebp", "-q:v", String(QUALIDADE), "-compression_level", "6",
      saida,
    ], { stdio: "ignore" })
    p.on("exit", (codigo) => {
      // Arquivo de 0 byte conta como ERRO: publicado, ele viraria imagem
      // quebrada na tela, que é pior do que a silhueta.
      if (codigo === 0 && existsSync(saida) && statSync(saida).size > 0) feitos++
      else erros++
      resolve()
    })
    p.on("error", () => { erros++; resolve() })
  })
  const total = feitos + erros
  if (total % 500 === 0) console.log(`  ${total}/${pendentes.length}`)
}

const t0 = Date.now()
await Promise.all(Array.from({ length: paralelo }, async () => {
  for (;;) {
    const proximo = fila.shift()
    if (!proximo) return
    await converter(...proximo)
  }
}))

const seg = ((Date.now() - t0) / 1000).toFixed(0)
const agora = readdirSync(DESTINO).filter((f) => f.startsWith("df11-") && f.endsWith(".webp"))
const bytes = agora.reduce((s, f) => s + statSync(path.join(DESTINO, f)).size, 0)

// ─── REGISTRAR NO MAPA EDITORIAL ─────────────────────────────────────────────
//
// ⚠️ SEM ISTO O ROSTO NÃO APARECE. Converter o webp não basta: o
// `build-faces-manifest.mjs` monta o manifesto a partir de
// `player_photo_overrides.json` e publica apenas o que tem arquivo em disco. Um
// rosto convertido e não registrado fica invisível — foi o que aconteceu na
// primeira execução (12.542 arquivos, só 8.660 no manifesto).
//
// A varredura é feita pelo DISCO, não pelo mapa: assim o registro reflete
// exatamente o que existe, e as entradas dos rostos apagados por `--limpar`
// saem junto em vez de virar referência quebrada.
const OVERRIDES = path.join(RAIZ, "data/seeds/player_photo_overrides.json")
const overrides = existsSync(OVERRIDES) ? JSON.parse(readFileSync(OVERRIDES, "utf-8")) : {}
let registrados = 0, removidos = 0

// Tira as entradas df11 antigas; as de OUTRAS fontes (Transfermarkt, curadas)
// não são tocadas.
for (const [chave, url] of Object.entries(overrides)) {
  if (typeof url === "string" && url.includes("/jogadores/df11-")) { delete overrides[chave]; removidos++ }
}
for (const arquivo of agora) {
  const id = arquivo.slice("df11-".length, -".webp".length)
  overrides[id] = `/jogadores/${arquivo}`
  registrados++
}
writeFileSync(OVERRIDES, JSON.stringify(overrides, null, 2) + "\n")
console.log(`\nmapa editorial: ${registrados} rostos df11 registrados (${removidos} entradas antigas substituídas)`)

console.log("")
console.log(`convertidos: ${feitos}   erros: ${erros}   (${seg}s)`)
console.log(`rostos df11 agora: ${agora.length}  (${(bytes / 1024 / 1024).toFixed(1)} MB, média ${(bytes / agora.length / 1024).toFixed(1)} KB)`)
console.log("\nagora rode:  node scripts/build-faces-manifest.mjs")

writeFileSync(RELATORIO, JSON.stringify({
  geradoEm: new Date().toISOString(),
  catalogoIndexado: porFmId.size,
  vinculos: Object.keys(mapa).length,
  jaEmDisco: emDisco.size,
  convertidos: feitos,
  erros,
  semPngNoAcervo: semArquivo,
  totalAgora: agora.length,
  megabytes: Number((bytes / 1024 / 1024).toFixed(1)),
}, null, 2))

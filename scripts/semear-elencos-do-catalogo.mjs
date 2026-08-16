// Semeia o elenco dos clubes CRIADOS com os atletas REAIS do catalogo DF11.
//
//   node scripts/semear-elencos-do-catalogo.mjs --lista clubes-novos.json \
//     --catalogo "<raiz do catalogo>" [--gravar]
//
// ⚠️ POR QUE ISTO PRECISOU EXISTIR. Os clubes novos entraram com
// `jogadores: []` — decisao certa (nao inventar elenco), mas com uma
// consequencia que so apareceu ao medir o que tinha chegado aos jogadores:
// **71 clubes ficaram sem UM rosto publicado**. O motivo e que o
// publicar-fotos-catalogo so publica foto de quem existe no elenco, e a chave e
// `fileKey__nome_normalizado`.
//
// E o buraco nao se fecharia sozinho: o `ensurePlayableSquad` completa o elenco
// com nomes GERADOS ("Lucas Silva"), que nunca vao bater com
// `jabaquara_sp__carlosdaniel`. Sem esta semeadura, esses clubes ficariam
// permanentemente sem rosto, tendo a foto publicada no canal.
//
// ⚠️ E ISTO NAO E INVENTAR ELENCO. Nome, POSICAO e IDADE saem do proprio
// catalogo (o `index.html` de cada clube traz "D/WB R · 23a · Brasil"). O que
// nao vem de la e `overall` e `salario` — e esses seguem a convencao que o pool
// JA usa nos 2.994 clubes (mediana 57 e R$ 42.400 nos clubes de prestigio
// 45-62), derivada do prestigio do clube. Sao os dois unicos campos derivados, e
// sao os mesmos que o pool inteiro ja tem derivados.

import { readFileSync, writeFileSync, readdirSync, existsSync, copyFileSync } from "node:fs"
import path from "node:path"

const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : "" }
const RAIZ = path.resolve(import.meta.dirname, "..")
const lista = arg("--lista")
const catalogo = arg("--catalogo")
const gravar = process.argv.includes("--gravar")
if (!lista || !catalogo) { console.error('uso: --lista <json> --catalogo "<raiz>" [--gravar]'); process.exit(1) }

// ─── Posicao: do codigo do FM para a do jogo ────────────────────────────────
//
// ⚠️ A ORDEM IMPORTA. "D/WB R" tem D e WB; se GK for testado depois de M, um
// "GK" nunca sai goleiro. Vou do mais especifico para o mais generico, e o
// LADO (R/L) decide entre LD e LE — sem ele o lateral vira zagueiro.
function posicaoDoCatalogo(cru) {
  const s = (cru ?? "").toUpperCase()
  if (/\bGK\b/.test(s)) return "GOL"
  const direita = /\bR\b/.test(s), esquerda = /\bL\b/.test(s)
  if (/\bWB\b/.test(s) || (/\bD\b/.test(s) && (direita || esquerda))) {
    if (direita) return "LD"
    if (esquerda) return "LE"
  }
  if (/\bD\b/.test(s)) return "ZAG"
  if (/\bDM\b/.test(s)) return "VOL"
  if (/\bST\b/.test(s)) return "ATA"
  if (/\bAM\b/.test(s)) return "MEI"
  if (/\bM\b/.test(s)) return "MEI"
  return "MEI"
}

/** Le nome, posicao e idade do index.html do clube (dado real do catalogo). */
function fichasDoIndex(pasta) {
  const arquivo = path.join(pasta, "index.html")
  if (!existsSync(arquivo)) return new Map()
  const html = readFileSync(arquivo, "utf-8")
  const fichas = new Map()
  // <div class="n">Nome</div><div class="m">D/WB R · 23a · Brasil</div>
  for (const m of html.matchAll(/<div class="n">([^<]+)<\/div>\s*<div class="m">([^<]*)<\/div>/g)) {
    const nome = m[1].trim()
    const [pos, idade] = m[2].split("·").map(s => s.trim())
    fichas.set(nome, { pos, idade: Number((idade ?? "").replace(/\D/g, "")) || 0 })
  }
  return fichas
}

const pacote = JSON.parse(readFileSync(path.resolve(lista), "utf-8"))
const arquivoSeed = path.join(RAIZ, "data/seeds/imported-bf2026.json")
const arquivoElencos = path.join(RAIZ, "data/seeds/imported-bf2026-elencos.json")
const seed = JSON.parse(readFileSync(arquivoSeed, "utf-8"))
const elencos = JSON.parse(readFileSync(arquivoElencos, "utf-8"))
const porChave = new Map(seed.teams.filter(t => t.fileKey).map(t => [t.fileKey, t]))

// Deterministico: o mesmo clube gera o mesmo elenco toda vez.
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) }

let clubes = 0, atletas = 0
const semPasta = [], vazios = []

for (const c of pacote.novos ?? []) {
  const time = porChave.get(c.fileKey)
  if (!time) continue
  const pasta = path.join(catalogo, c.pasta)
  if (!existsSync(pasta)) { semPasta.push(c.pasta); continue }

  const fichas = fichasDoIndex(pasta)
  const arquivos = readdirSync(pasta).filter(f => f.toLowerCase().endsWith(".png"))
  const jogadores = []
  const vistos = new Set()
  for (const arquivo of arquivos) {
    const nome = arquivo.replace(/\s*\(\d+\)\.png$/i, "").replace(/\.png$/i, "").trim()
    if (!nome || vistos.has(nome)) continue
    vistos.add(nome)
    const ficha = fichas.get(nome)
    const h = hash(`${c.fileKey}:${nome}`)
    // overall e salario seguem a convencao do pool para clube pequeno
    // (mediana 57 / R$ 42.400), ancorados no prestigio do proprio clube.
    const base = Math.max(40, Math.min(72, Math.round((time.prestigio ?? 50) * 0.95)))
    const overall = base + (h % 7) - 3
    jogadores.push({
      id: `${c.fileKey}_j${jogadores.length}`,
      nome,
      posicao: posicaoDoCatalogo(ficha?.pos),
      overall,
      idade: ficha?.idade && ficha.idade >= 15 && ficha.idade <= 45 ? ficha.idade : 20 + (h % 15),
      salario: Math.round((30000 + overall * 400) / 100) * 100,
    })
  }
  if (!jogadores.length) { vazios.push(c.fileKey); continue }
  time.jogadores = jogadores
  elencos[time.id] = jogadores
  clubes++; atletas += jogadores.length
}

console.log(`${clubes} clubes semeados | ${atletas} atletas reais do catalogo`)
if (semPasta.length) console.log(`sem pasta no catalogo (${semPasta.length}): ${semPasta.join(", ")}`)
if (vazios.length) console.log(`pasta sem PNG (${vazios.length}): ${vazios.join(", ")}`)

if (!gravar) { console.log("\nEnsaio. Use --gravar."); process.exit(0) }

for (const [arq, dado] of [[arquivoSeed, seed], [arquivoElencos, elencos]]) {
  const bak = `${arq}.antes-semear-elencos`
  if (!existsSync(bak)) copyFileSync(arq, bak)
  // ⚠️ MINIFICADO. Reformatar o seed vira um diff de centenas de milhares de
  // linhas e +4 MB (ver a nota em corrigir-clubes-corrompidos).
  writeFileSync(arq, JSON.stringify(dado), "utf-8")
}
console.log("\nGravado (seed + elencos), com backup .antes-semear-elencos")

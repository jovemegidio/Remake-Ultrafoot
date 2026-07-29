// Republica o game-assets.zip — o canal pelo qual os ASSETS BINARIOS chegam a
// Linux, macOS e a versao web.
//
// POR QUE ISTO EXISTE:
//
// `public/jogadores/`, `public/escudos/` e companhia estao no .gitignore (sao
// centenas de MB). Entao o que voce edita no editor NAO viaja pelo git: os
// seeds JSON (faces-manifest, team-overrides) sao commitados, mas as IMAGENS
// que eles referenciam nao. Quem builda no Windows nem percebe, porque le os
// arquivos locais; ja o CI de Linux/macOS monta a maquina do zero e baixa
// justamente este zip no passo "Fetch game assets".
//
// Resultado do elo faltando: as edicoes paravam no Windows, e um manifesto
// novo apontando para imagens ausentes do zip antigo produzia IMAGEM QUEBRADA
// nas outras plataformas — pior que nao ter editado.
//
// QUANDO RODAR: sempre que o bake mexer em assets (escudos, uniformes ou fotos
// importadas no editor) e voce quiser que isso alcance as outras plataformas.
// O passo seguinte e disparar o workflow "Desktop Linux and macOS".
//
// Uso:
//   node scripts/publish-game-assets.mjs            (empacota e mostra o tamanho)
//   node scripts/publish-game-assets.mjs --publish  (envia para o release)

import { execFileSync } from "node:child_process"
import { existsSync, statSync } from "node:fs"
import { rm } from "node:fs/promises"
import path from "node:path"

const PUBLICAR = process.argv.includes("--publish")
const REPO = "jovemegidio/Ultrafoot26"
const TAG = "game-assets"
const ZIP = path.resolve("game-assets.zip")

// Pastas empacotadas. O CI extrai o zip na RAIZ do repositorio, entao os
// caminhos dentro dele precisam comecar em `public/`.
const PASTAS = [
  "public/jogadores",
  "public/escudos",
  "public/escudos-mini",
  "public/escudos-selecoes",
  "public/selecoes",
  "public/camisas",
  "public/camisas2",
  "public/camisas3",
  "public/kits-imported",
  "public/overrides",   // escudos/uniformes extraidos do save pelo split-override-assets
  "public/ads",         // arte da publicidade
  "public/trofeus",
  "public/stadiums",
  "public/audio/commentary",
]

const presentes = PASTAS.filter(p => existsSync(p))
const ausentes = PASTAS.filter(p => !existsSync(p))
if (ausentes.length) console.log(`aviso: nao encontradas (seguem de fora): ${ausentes.join(", ")}`)
if (!presentes.length) {
  console.error("ERRO: nenhuma pasta de asset encontrada — rode a partir da raiz do projeto.")
  process.exit(1)
}

// Checagem de sanidade ANTES de empacotar: as duas pastas que o CI valida
// explicitamente precisam existir, senao o build quebra depois de baixar.
for (const obrigatoria of ["public/escudos", "public/jogadores"]) {
  if (!existsSync(obrigatoria)) {
    console.error(`ERRO: ${obrigatoria} e obrigatoria para o CI e nao existe.`)
    process.exit(1)
  }
}

// TRAVA DE VOLUME. Publicar com --clobber SUBSTITUI o zip que Linux, macOS e a
// web consomem: um pacote incompleto apaga assets de todo mundo de uma vez.
//
// Isto ja quase aconteceu: rodar `npm run build` sem TAURI_BUILD dispara o
// prune-export-music.mjs, que apaga os diretorios pesados do PROPRIO public/ —
// public/jogadores caiu de 20.429 para 30 arquivos. O zip gerado em seguida
// tinha 83 MB contra os 218 MB do publicado. Se tivesse subido, levaria junto
// mais de 20 mil fotos e todos os escudos.
//
// Os pisos abaixo sao ordens de grandeza, nao numeros exatos: existem para
// pegar uma pasta ESVAZIADA, nao para auditar o acervo.
const PISO_MINIMO = { "public/jogadores": 5000, "public/escudos": 2000, "public/camisas": 1000 }
const { readdirSync } = await import("node:fs")
let suspeito = false
for (const [pasta, piso] of Object.entries(PISO_MINIMO)) {
  if (!existsSync(pasta)) continue
  const n = readdirSync(pasta).length
  if (n < piso) {
    console.error(`ERRO: ${pasta} tem ${n} arquivos, abaixo do piso de ${piso}.`)
    suspeito = true
  }
}
if (suspeito) {
  console.error(`
Isto indica um public/ PODADO, nao um acervo legitimamente pequeno.
Ressincronize a partir do repositorio (node scripts/sync-para-build.mjs) e
rode de novo. Nada foi publicado.`)
  process.exit(1)
}

await rm(ZIP, { force: true })
console.log(`empacotando ${presentes.length} pastas...`)

// ⚠️ NAO use Compress-Archive aqui. Ele grava apenas o NOME de cada pasta na
// raiz do zip: `-Path public/jogadores` vira `jogadores/`, nao
// `public/jogadores/`. O CI extrai o pacote na RAIZ do repositorio e depois
// verifica `public/escudos` e `public/jogadores` — que nunca apareciam. Os dois
// jobs morriam com "a extracao dos assets falhou", ja depois de o zip antigo ter
// sido substituido pelo --clobber.
//
// O 7z preserva o caminho relativo como informado, que e o que precisamos.
const SETE_ZIP = path.resolve("src-tauri/resources/extractor/7z.exe")
if (!existsSync(SETE_ZIP)) {
  console.error(`ERRO: 7z nao encontrado em ${SETE_ZIP}`)
  process.exit(1)
}
execFileSync(SETE_ZIP, ["a", "-tzip", "-mx=5", ZIP, ...presentes], { stdio: "inherit" })

const mb = (statSync(ZIP).size / 1024 / 1024).toFixed(1)
console.log(`game-assets.zip: ${mb} MB`)

// TRAVA DE ESTRUTURA. A de volume acima nao pega este caso: um zip com o
// tamanho certo e o LAYOUT errado passa por ela e quebra o CI do mesmo jeito.
//
// Foi o que aconteceu com Compress-Archive, que grava so o nome da pasta na
// raiz (`escudos/` em vez de `public/escudos/`). O CI extrai na raiz do
// repositorio e valida `public/escudos` e `public/jogadores` — nao achava, e os
// dois jobs morriam DEPOIS de o pacote bom ja ter sido substituido.
// Barras normalizadas para uma so forma: o 7z lista com "\" no Windows e "/"
// em outros sistemas, e comparar as duas variantes na mao ja rendeu erro aqui.
const listagem = execFileSync(SETE_ZIP, ["l", ZIP], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
  .split("\\").join("/")
const semPrefixo = ["escudos", "jogadores"].filter(sub => !listagem.includes(`public/${sub}/`))
if (semPrefixo.length) {
  console.error(`ERRO: o zip nao tem os caminhos com prefixo public/ para: ${semPrefixo.join(", ")}.`)
  console.error("O CI extrai na raiz do repositorio e nao encontraria os assets. Nada foi publicado.")
  process.exit(1)
}
console.log("estrutura conferida: caminhos gravados sob public/")

if (!PUBLICAR) {
  console.log(`\nZIP gerado (nao publicado). Para enviar de verdade:`)
  console.log(`  node scripts/publish-game-assets.mjs --publish`)
  process.exit(0)
}

console.log(`enviando para ${REPO} (release "${TAG}")...`)
execFileSync("gh", ["release", "upload", TAG, ZIP, "--repo", REPO, "--clobber"], { stdio: "inherit" })
await rm(ZIP, { force: true })

console.log(`
OK — game-assets.zip republicado.

Agora dispare o build multiplataforma para as outras plataformas pegarem:
  gh workflow run "Desktop Linux and macOS" --repo ${REPO}
`)

// Copia o projeto do Google Drive (G:) para C:\Ultrafoot, onde o build roda.
//
// POR QUE existe: o build nunca sai do G:. O Drive nao suporta symlink nem um
// `npm install` confiavel, e o `tsc` do G: aprova sem verificar de verdade.
//
// POR QUE VIROU SCRIPT: fazer o robocopy a mao quebrou o build de 2026-07-23.
// O Drive espalha um `desktop.ini` (sistema + oculto) em CADA pasta — vieram
// 16.960 deles. O Cargo tenta ler public/escudos/desktop.ini na hora de gerar
// os rerun-if-changed, esbarra em "Acesso negado. (os error 5)" e derruba o
// build inteiro com uma mensagem que nao diz nada sobre o arquivo culpado.
//
// O /XF desktop.ini abaixo e o ponto principal deste arquivo.
//
//   node scripts/sync-para-build.mjs

import { spawnSync } from "node:child_process"
import path from "node:path"

const ORIGEM = process.cwd()
const DESTINO = process.env.ULTRAFOOT_BUILD_DIR ?? "C:\\Ultrafoot"

// node_modules/.next/target ficam de fora: o destino tem os seus proprios, e
// copiar dezenas de milhares de arquivos a cada sync levaria minutos. .git idem
// (o repositorio e o G:). `out` e artefato do export do Next.
//
// ⚠️ O ENTULHO LOCAL ENTROU DEPOIS, e por um motivo medido: `Backup Jogo` tem
// **12 GB** de copias inteiras de versoes antigas do projeto — inclusive `.next`
// de builds passados, que a exclusao de ".next" nao pega porque la eles se
// chamam "(1).next", "(2).next". Em 04/08/2026 ela sozinha segurou o
// espelhamento por quase uma hora, com o release parado esperando; logo atras
// vinha `dev/`, com OUTROS projetos dentro (Landing-Page-Mirassol-FC,
// _ultrafoot-remote).
//
// A lista abaixo e a mesma secao de "entulho local" do .gitignore. Nenhuma
// dessas pastas e referenciada por codigo nem entra no bundle do Tauri (que so
// empacota caminhos `public/...`), entao copia-las e trabalho puro.
//
// ⚠️ SO SAI O QUE FOI CONFERIDO PASTA A PASTA. Estar no .gitignore NAO basta
// para excluir daqui: `Estadios/`, `Jogadores/`, `Tela/`, `Nova pasta/`,
// `Donwloader/` e `Templates de Noticias/` sao ASSETS do jogo e precisam
// chegar ao disco de build — nao versionar e uma decisao de repositorio, nao de
// build. Excluir por engano nao quebra o build: produz um instalador com asset
// velho, que e pior porque nao acusa.
//
// Pastas excluidas por /XD NAO sao apagadas pelo /MIR: o que ja esta no destino
// fica onde esta, so deixa de ser copiado de novo.
const EXCLUIR_PASTAS = [
  "node_modules", ".next", "target", ".git", "out",
  "Backup Jogo", "dev",
]
// desktop.ini: lixo do Drive que quebra o Cargo (ver acima).
// Thumbs.db/.DS_Store: mesma categoria, inofensivos mas inuteis.
const EXCLUIR_ARQUIVOS = ["desktop.ini", "Thumbs.db", ".DS_Store"]

console.log(`[sync] ${ORIGEM}\n    -> ${DESTINO}`)

const r = spawnSync("robocopy", [
  ORIGEM, DESTINO, "/MIR",
  "/XD", ...EXCLUIR_PASTAS,
  "/XF", ...EXCLUIR_ARQUIVOS,
  "/NFL", "/NDL", "/NP", "/R:1", "/W:1",
], { stdio: "inherit", shell: false })

// Robocopy nao usa 0 para sucesso: 0-7 sao variacoes de "deu certo" (0 = nada a
// fazer, 1 = copiou, 2 = tinha extras, 3 = os dois...). Only >= 8 e falha real.
// Tratar != 0 como erro faria todo sync bem-sucedido parecer quebrado.
const code = r.status ?? 16
if (code >= 8) {
  console.error(`[sync] FALHOU (robocopy ${code})`)
  process.exit(1)
}
console.log(`[sync] ok (robocopy ${code}) — agora: cd ${DESTINO} && npx tauri build`)

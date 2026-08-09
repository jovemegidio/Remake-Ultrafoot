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
import { readdirSync } from "node:fs"
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
  // ⚠️ sortitoutsi — MATERIA-PRIMA de importacao, nao asset do jogo.
  //
  // Conferida pasta a pasta, como manda a regra acima, antes de sair daqui:
  //  · nao esta em `bundle.resources` do tauri.conf.json (que so empacota
  //    `public/**` e `src-tauri/resources`);
  //  · nenhuma referencia dentro de src-tauri;
  //  · os 14 scripts que a leem sao de IMPORTACAO (match-sortitoutsi-kits,
  //    catalogo-df11, mapear-faces-fm…). Eles rodam no repositorio, geram
  //    arquivo dentro de `public/`, e e o `public/` que viaja para o build.
  //
  // Alem de nao servir para nada aqui, ela QUEBRA o espelhamento: varios logos
  // dela sao placeholders do Drive que nunca materializam, e cada um custa
  // "ERRO 3 - o sistema nao pode encontrar o caminho especificado" mais o tempo
  // de repeticao, a cada build.
  "sortitoutsi",
]

// ⚠️ /XD CASA POR NOME EXATO — e foi por isso que o sync de 06/08/2026 copiou
// 11,5 GB de lixo antes de alguem perceber.
//
// O Windows renomeia colisao com prefixo, nao com sufixo: uma pasta `.next` que
// colide vira `(1).next`, `(2).next`, `(3).next`. Nenhuma dessas casa com
// `/XD .next`. O mesmo vale para os node_modules quebrados que foram guardados
// de lado — `.node_modules-corrupt-20260719225924` nao casa com
// `/XD node_modules`. Medido no destino:
//
//   (3).next   4,93 GB      (4).next   4,70 GB      (2).next   0,92 GB
//   (1).next   0,42 GB      .qa-chrome-profile 0,22 GB
//   .node_modules-corrupt-* 0,24 GB     resto 0,06 GB
//   --------------------------------------------------  SOMA: 11,49 GB
//
// Onze gigas a ~5 MB/s do Drive sao ~40 minutos de espera por versao. Nada disso
// e referenciado por codigo nem entra no bundle do Tauri.
//
// A lista e montada VARRENDO A RAIZ DA ORIGEM, nao escrita a mao: entulho novo
// aparece com data nova (`.node_modules-corrupt-<carimbo>`), e uma lista fixa
// ficaria desatualizada no dia seguinte sem ninguem notar.
const PADROES_DE_ENTULHO = [
  /(^|\W)\.next(\W|$)/i,          // ".next (1)", "(1).next", "(2).next"…
  /^\.node_modules-/i,            // node_modules quebrado guardado de lado
  /^\.local-backup/i,             // copias locais antes de merge
  /^\.qa-chrome-profile$/i,       // perfil do Chrome dos testes de UI
  /^\.face-import-temp$/i,        // sobra do import de rostos
  /^\.codex-pdf-preview$/i,
]

/** Pastas da raiz da origem que batem nos padroes acima (excluindo a `.next` exata,
 *  que ja esta na lista principal). */
function entulhoDaRaiz() {
  let entradas
  try {
    entradas = readdirSync(ORIGEM, { withFileTypes: true })
  } catch {
    // Origem ilegivel e problema do robocopy reportar, nao deste filtro.
    return []
  }
  return entradas
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .filter(nome => !EXCLUIR_PASTAS.includes(nome))
    .filter(nome => PADROES_DE_ENTULHO.some(p => p.test(nome)))
    // Caminho COMPLETO: o nome solto faria o /XD casar tambem com uma pasta de
    // mesmo nome no meio da arvore, e aqui a intencao e so a raiz.
    .map(nome => path.join(ORIGEM, nome))
}
// desktop.ini: lixo do Drive que quebra o Cargo (ver acima).
// Thumbs.db/.DS_Store: mesma categoria, inofensivos mas inuteis.
const EXCLUIR_ARQUIVOS = ["desktop.ini", "Thumbs.db", ".DS_Store"]

console.log(`[sync] ${ORIGEM}\n    -> ${DESTINO}`)

const entulho = entulhoDaRaiz()
if (entulho.length > 0) {
  console.log(`[sync] ${entulho.length} pasta(s) de entulho fora do caminho:`)
  for (const p of entulho) console.log(`         ${path.basename(p)}`)
}

const r = spawnSync("robocopy", [
  ORIGEM, DESTINO, "/MIR",
  "/XD", ...EXCLUIR_PASTAS, ...entulho,
  "/XF", ...EXCLUIR_ARQUIVOS,
  // ⚠️ /FFT — TOLERANCIA DE 2 SEGUNDOS NA DATA DO ARQUIVO.
  //
  // O G: e um ponto de montagem do Google Drive, nao NTFS. A data que ele devolve
  // nao tem a mesma granularidade do destino, entao o robocopy achava DIFERENTE
  // quase todo arquivo e recopiava a arvore inteira a cada sync — ~15 GB de
  // conteudo legitimo, toda vez, mesmo sem nada ter mudado.
  //
  // /FFT compara com folga de 2s (a granularidade do FAT), que e exatamente a
  // margem de erro dessa conversao. O risco teorico e ignorar uma alteracao feita
  // dentro da mesma janela de 2 segundos com o tamanho identico; na pratica o
  // build roda depois de um commit, nao no meio de uma gravacao.
  "/FFT",
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

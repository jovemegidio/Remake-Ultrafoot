import { existsSync, mkdirSync, renameSync, readdirSync, rmSync } from "node:fs"
import path from "node:path"

/**
 * TIRA AS IMAGENS PESADAS DE `public/` DURANTE O `next build` E DEVOLVE DEPOIS.
 *
 * Por que existe: o export do Next copia TUDO que esta em `public/` para `out/`.
 * Sao ~33 mil fotos de jogador mais milhares de escudos e uniformes — e o passo
 * seguinte do build (scripts/prune-export-music.mjs) APAGA exatamente esses
 * diretorios de `out/`. Ou seja, o build copiava 40 mil arquivos para deleta-los
 * na linha de baixo.
 *
 * Isso nao era so desperdicio: era o ponto onde o build travava. Uma copia
 * massiva de arquivos recem-escritos disputa cada arquivo com o antivirus e com
 * o cliente do Google Drive, e o Next morria em
 * `EBUSY: resource busy or locked, copyfile ... public/jogadores/x.webp`,
 * sempre num arquivo diferente. Nao ha como pedir ao Next que pule uma pasta de
 * `public/`; da para tirar a pasta do caminho.
 *
 * As imagens NAO somem do jogo: elas chegam ao app instalado como *resources* do
 * Tauri, empacotadas a partir de `public/` na etapa do cargo — que roda DEPOIS
 * do `beforeBuildCommand`, ja com tudo restaurado.
 *
 * Uso:
 *   node scripts/reservar-imagens-pesadas.mjs guardar
 *   node scripts/reservar-imagens-pesadas.mjs devolver
 *
 * SEGURANCA. `guardar` comeca devolvendo o que por acaso tenha ficado para tras
 * (build anterior interrompido no meio), e o `devolver` roda mesmo se o build
 * falhar — ver o `build:tauri` no package.json. O movimento e um rename dentro
 * do MESMO volume: atomico, instantaneo e sem copia de bytes.
 */

// Os mesmos diretorios que o prune apaga de `out/`. Se um dia essa lista mudar
// la, tem que mudar aqui — os dois falam do mesmo conjunto.
const PESADOS = [
  "jogadores",
  "camisas",
  "camisas2",
  "camisas3",
  "escudos",
  "escudos-mini",
  "escudos-selecoes",
  "selecoes",
  "trofeus",
]

const PUBLIC = path.resolve("public")
// Fora de `public/` (senao o Next copiaria do mesmo jeito) e no mesmo volume,
// para o rename continuar sendo instantaneo.
const RESERVA = path.resolve(".imagens-reservadas")

/**
 * Move uma pasta inteira. Tenta o rename do DIRETORIO (instantaneo) e, se o
 * Windows nao deixar, move ARQUIVO A ARQUIVO.
 *
 * O fallback nao e teorico: numa maquina de build o `public/jogadores` recusava
 * `rename` com EPERM enquanto aceitava escrita, remocao e leitura normalmente —
 * sintoma de alguem com o diretorio aberto so para enumerar (indexador,
 * antivirus, um `find` esquecido). Isso trava o rename da PASTA e nao trava o
 * conteudo. Mover os arquivos e igualmente barato: rename no mesmo volume e
 * operacao de metadado, nao copia bytes.
 */
const TRAVA = new Set(["EPERM", "EBUSY", "EACCES"])

/**
 * `rename` com repeticao. Antivirus e indexadores abrem cada arquivo por alguns
 * milissegundos ao varrer a pasta; quem tentar renomear naquele instante leva
 * EBUSY. Foi assim que uma passagem por 33 mil fotos parou em UMA. Esperar e
 * insistir resolve — e o mesmo que o robocopy faz com /R e /W. Sem isto, o
 * build depende de sorte.
 */
function renomearInsistindo(de, para, tentativas = 40) {
  for (let i = 1; ; i++) {
    try {
      renameSync(de, para)
      return
    } catch (erro) {
      if (!TRAVA.has(erro.code) || i >= tentativas) throw erro
      // Espera crescente ate 200ms, sem async: este script roda sozinho.
      const ate = Date.now() + Math.min(200, i * 25)
      while (Date.now() < ate) { /* aguarda o scanner soltar o arquivo */ }
    }
  }
}

function moverPasta(de, para) {
  try {
    renameSync(de, para)
    return
  } catch (erro) {
    if (!TRAVA.has(erro.code)) throw erro
  }
  mkdirSync(para, { recursive: true })
  for (const item of readdirSync(de)) {
    renomearInsistindo(path.join(de, item), path.join(para, item))
  }
  // A pasta de origem fica vazia de proposito: sem poder renomea-la, tambem nao
  // daria para recria-la depois. Vazia, o Next nao tem o que copiar — que e o
  // objetivo — e o `devolver` reenche a mesma pasta.
}

function guardar() {
  devolver({ silencioso: true })
  mkdirSync(RESERVA, { recursive: true })
  let movidos = 0
  for (const nome of PESADOS) {
    const origem = path.join(PUBLIC, nome)
    if (!existsSync(origem)) continue
    moverPasta(origem, path.join(RESERVA, nome))
    movidos++
  }
  console.log(`[imagens] ${movidos} diretorios pesados fora do export`)
}

function devolver({ silencioso = false } = {}) {
  if (!existsSync(RESERVA)) {
    if (!silencioso) console.log("[imagens] nada para devolver")
    return
  }
  let devolvidos = 0
  for (const nome of readdirSync(RESERVA)) {
    const guardado = path.join(RESERVA, nome)
    const destino = path.join(PUBLIC, nome)
    if (existsSync(destino)) {
      // O destino so sobrevive quando o `guardar` teve de esvazia-lo em vez de
      // renomea-lo (pasta presa por quem so a enumera). Nesse caso ela esta
      // VAZIA e e para onde os arquivos voltam — apagar seria recriar o mesmo
      // impasse, ja que sem rename tambem nao da para recria-la.
      for (const item of readdirSync(guardado)) {
        renomearInsistindo(path.join(guardado, item), path.join(destino, item))
      }
      rmSync(guardado, { recursive: true, force: true })
    } else {
      renomearInsistindo(guardado, destino)
    }
    devolvidos++
  }
  rmSync(RESERVA, { recursive: true, force: true })
  if (!silencioso || devolvidos > 0) {
    console.log(`[imagens] ${devolvidos} diretorios pesados de volta em public/`)
  }
}

const acao = process.argv[2]
if (acao === "guardar") guardar()
else if (acao === "devolver") devolver()
else {
  console.error("uso: node scripts/reservar-imagens-pesadas.mjs guardar|devolver")
  process.exit(1)
}

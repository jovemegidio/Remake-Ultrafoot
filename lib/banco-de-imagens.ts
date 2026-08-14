"use client"

// BANCO LOCAL DE IMAGENS — os bytes saem do JSON e viram arquivo no disco.
//
// ─── O QUE ESTAVA ERRADO ─────────────────────────────────────────────────────
//
// Escudo, uniforme e retrato eram gravados como base64 DENTRO do persistent-store,
// que e um UNICO arquivo JSON (`ultrafoot-clubs.json`). Medido nesta maquina em
// 11/08/2026, no arquivo real de quem joga:
//
//   ultrafoot-clubs.json .................. 245,67 MB   753 chaves
//     ultrafoot:atualizacao-fotos ......... 170,11 MB   (cache do canal)
//     ultrafoot:save:career-… ..............  16,94 MB
//     ultrafoot:team-override:<clube> ..... ~0,5 MB cada
//   imagens em base64 ..................... 3.488
//
// E o `storeSet` do persistent-store faz `store.save()` a CADA gravacao, o que
// reescreve o arquivo inteiro. Ou seja, mudar uma configuracao — ou o autosave
// do zustand, que grava a cada acao do jogo — custava:
//
//   ler + parse no boot .......... 1.028 ms
//   stringify por gravacao ......... 882 ms  + escrever 246 MB no disco
//
// Isso NESTE PC, com cache quente. Era esse o gargalo da webview: nao o React,
// nao o 3D, e nem o parse dos seeds (que e real, mas menor). Era um arquivo de
// um quarto de gigabyte sendo reescrito por baixo de cada clique.
//
// ─── O QUE ESTE MODULO FAZ ───────────────────────────────────────────────────
//
// Os bytes de cada imagem viram um arquivo em `<AppData>/imagens/<sha256>.<ext>`
// e o que fica no JSON e so a REFERENCIA (`uf-img:<sha>.<ext>`, ~50 bytes). Com
// isso:
//
//  • o JSON volta a ser pequeno, entao gravar deixa de custar quase um segundo;
//  • imagem igual em dois clubes vira UM arquivo (a chave e o sha do conteudo);
//  • nada se perde ao atualizar o jogo — o instalador e `currentUser` e nunca
//    encosta em `%APPDATA%\com.ultrafoot.remake`, que e onde a pasta fica;
//  • a imagem so e lida do disco quando alguma tela pede.
//
// ─── DEGRADACAO ──────────────────────────────────────────────────────────────
//
// Fora do Tauri (versao web e celular) NAO existe disco: `guardarImagem`
// devolve a propria data URL e tudo continua exatamente como era. O banco e um
// ganho do app instalado, nunca um requisito.
//
// ⚠️ NUNCA deixe uma falha daqui apagar uma imagem. Toda funcao de escrita cai
// para o comportamento antigo (base64 no JSON) se o disco recusar. Perder o
// escudo que o jogador importou e pior do que um arquivo grande.

const PASTA = "imagens"
const PREFIXO = "uf-img:"
export type ReferenciaImagemLocal = `uf-img:${string}`

/** Extensao a partir do mime da data URL. Fora da lista vira `.bin` (o
 *  navegador sniffa o conteudo pelo Blob de qualquer forma). */
const EXTENSAO_POR_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/avif": "avif",
}

const MIME_POR_EXTENSAO: Record<string, string> = Object.fromEntries(
  Object.entries(EXTENSAO_POR_MIME).map(([mime, ext]) => [ext, mime]),
)

function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== "undefined"
  )
}

/** Uma referencia do banco (`uf-img:…`), e nao uma imagem inline. */
export function isRefDeImagem(valor: string | null | undefined): valor is ReferenciaImagemLocal {
  return typeof valor === "string" && valor.startsWith(PREFIXO)
}

// ─── Leitura ─────────────────────────────────────────────────────────────────

/**
 * blob: URL ja criada para cada ref.
 *
 * ⚠️ ISTO ERA UMA FUGA DE MEMORIA SEM TETO, e foi o "Out of Memory" que derrubou
 * a pagina depois de um tempo de jogo (relato de 12/08/2026).
 *
 * `URL.createObjectURL` mantem o Blob VIVO ate alguem chamar `revokeObjectURL`.
 * O mapa nao tinha limite e o revoke nao existia em lugar nenhum do arquivo:
 * cada escudo, uniforme e retrato visto ficava na memoria da webview para
 * sempre. Sao 3.363 imagens no disco de quem joga, 160,6 MB — navegar por
 * elenco, mercado e adversarios ia somando ate estourar.
 *
 * Por isso o erro nao aparecia ao ABRIR o jogo: ele aparecia depois de jogar.
 *
 * Agora e um LRU: as `TETO_DE_IMAGENS` mais recentes ficam, e a mais antiga e
 * revogada ao dar lugar. O `Map` do JS itera em ordem de insercao, entao a
 * primeira chave e a mais antiga — e reinserir no acesso e o que a torna "menos
 * antiga".
 */
const urlPorRef = new Map<string, string>()

/**
 * Quantas imagens ficam vivas ao mesmo tempo.
 *
 * ⚠️ NAO BAIXAR MUITO. Revogar uma URL que ainda esta na tela quebra a imagem
 * exibida — vira escudo em branco no meio da partida. A tela mais pesada do jogo
 * (mercado, com catalogo aberto) mostra algumas centenas de itens; 600 deixa
 * folga larga sobre isso e ainda limita o gasto a algo entre 30 e 60 MB.
 */
const TETO_DE_IMAGENS = 600

/** Marca a ref como usada AGORA (reinsere no fim da ordem de iteracao). */
function tocar(ref: string, url: string): void {
  urlPorRef.delete(ref)
  urlPorRef.set(ref, url)
}

/** Revoga as mais antigas ate caber no teto. */
function podarImagens(): void {
  while (urlPorRef.size > TETO_DE_IMAGENS) {
    const maisAntiga = urlPorRef.keys().next().value as string | undefined
    if (maisAntiga === undefined) return
    const url = urlPorRef.get(maisAntiga)
    urlPorRef.delete(maisAntiga)
    // Sem isto, tirar do mapa NAO libera nada: o Blob continua vivo preso a URL.
    if (url) URL.revokeObjectURL(url)
  }
}

/** Quantas imagens estao vivas. Existe para o teste provar que o teto funciona. */
export function imagensVivas(): number {
  return urlPorRef.size
}
/** Refs cuja leitura ja falhou — nao insiste a cada render. */
const refsQuebradas = new Set<string>()
/** Leituras em voo, para dez telas pedindo o mesmo escudo lerem o disco uma vez. */
const emVoo = new Map<string, Promise<string | null>>()

/**
 * A URL exibivel desta referencia, SE ela ja estiver carregada.
 *
 * Sincrona de proposito: quem desenha escudo (`getCustomLogoUrl`) e chamado
 * durante o render e nao pode esperar o disco. Quando devolve `null`, dispara a
 * leitura por baixo e avisa com `ultrafoot:imagem:pronta` — os componentes de
 * imagem ja escutam esse evento e se redesenham.
 */
export function resolverImagem(ref: string | null | undefined): string | null {
  if (!isRefDeImagem(ref)) return ref ?? null
  const pronta = urlPorRef.get(ref)
  if (pronta) { tocar(ref, pronta); return pronta }
  if (!refsQuebradas.has(ref)) void carregarImagem(ref)
  return null
}

/** Le a imagem do disco e devolve uma blob: URL estavel para ela. */
export async function carregarImagem(ref: string): Promise<string | null> {
  if (!isRefDeImagem(ref)) return ref ?? null
  const pronta = urlPorRef.get(ref)
  if (pronta) { tocar(ref, pronta); return pronta }
  if (refsQuebradas.has(ref)) return null

  const jaPedida = emVoo.get(ref)
  if (jaPedida) return jaPedida

  const promessa = (async (): Promise<string | null> => {
    try {
      if (!isTauri()) return null
      const fs = await import("@tauri-apps/plugin-fs")
      const nome = ref.slice(PREFIXO.length)
      const bytes = await fs.readFile(`${PASTA}/${nome}`, { baseDir: fs.BaseDirectory.AppData })
      const ext = nome.split(".").pop() ?? ""
      const tipo = MIME_POR_EXTENSAO[ext] ?? "application/octet-stream"
      // `slice()` desencosta do buffer do Tauri: guardar a view inteira segurava
      // o ArrayBuffer original vivo junto com a blob.
      const url = URL.createObjectURL(new Blob([bytes.slice()], { type: tipo }))
      urlPorRef.set(ref, url)
      podarImagens()
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("ultrafoot:imagem:pronta", { detail: { ref } }))
      }
      return url
    } catch {
      // Arquivo sumiu (limpeza manual, disco cheio): marca e nao tenta de novo.
      // A tela cai no fallback dela, que e o mesmo de um clube sem escudo.
      refsQuebradas.add(ref)
      return null
    } finally {
      emVoo.delete(ref)
    }
  })()

  emVoo.set(ref, promessa)
  return promessa
}

/**
 * Carrega um lote de referencias de uma vez.
 *
 * Uma tabela de liga desenha 20 escudos; sem isto sao 20 idas ao disco disparadas
 * por 20 renders, cada uma com o seu evento e o seu redesenho. Aqui elas vao
 * juntas e a tela redesenha uma vez so.
 */
export async function precarregarImagens(refs: Array<string | null | undefined>): Promise<void> {
  const pendentes = refs.filter(
    (r): r is string => isRefDeImagem(r) && !urlPorRef.has(r) && !refsQuebradas.has(r),
  )
  if (pendentes.length === 0) return
  await Promise.allSettled([...new Set(pendentes)].map(carregarImagem))
}

// ─── Escrita ─────────────────────────────────────────────────────────────────

function partesDaDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  const m = /^data:([^;,]+)(;base64)?,/.exec(dataUrl)
  if (!m) return null
  const mime = m[1]
  const corpo = dataUrl.slice(m[0].length)
  try {
    if (m[2]) {
      const bin = atob(corpo)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      return { mime, bytes }
    }
    // SVG costuma vir percent-encoded em vez de base64.
    return { mime, bytes: new TextEncoder().encode(decodeURIComponent(corpo)) }
  } catch {
    return null
  }
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer)
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("")
}

/**
 * Grava a imagem no banco e devolve a REFERENCIA para guardar no lugar dela.
 *
 * Devolve a propria `dataUrl` — sem gravar nada — quando nao ha disco (web) ou
 * quando o valor nao e uma imagem inline. Assim o chamador pode sempre fazer
 * `campo = await guardarImagem(campo)` sem se preocupar com o ambiente.
 */
export async function guardarImagem(dataUrl: string | null | undefined): Promise<string | null> {
  if (!dataUrl) return dataUrl ?? null
  if (isRefDeImagem(dataUrl)) return dataUrl // ja esta no banco
  if (!dataUrl.startsWith("data:image/")) return dataUrl // http(s), blob: ou caminho — nao e nosso
  if (!isTauri()) return dataUrl

  try {
    const partes = partesDaDataUrl(dataUrl)
    if (!partes) return dataUrl

    const sha = await sha256(partes.bytes)
    const ext = EXTENSAO_POR_MIME[partes.mime] ?? "bin"
    const nome = `${sha}.${ext}`
    const ref = `${PREFIXO}${nome}`

    const fs = await import("@tauri-apps/plugin-fs")
    const base = { baseDir: fs.BaseDirectory.AppData }
    if (!(await fs.exists(PASTA, base))) await fs.mkdir(PASTA, { ...base, recursive: true })

    // O nome E o sha do conteudo: se o arquivo ja existe, ele ja e esta imagem.
    // E o que faz dois clubes com o mesmo escudo ocuparem um arquivo so, e o que
    // torna regravar a mesma imagem uma operacao de graca.
    if (!(await fs.exists(`${PASTA}/${nome}`, base))) {
      await fs.writeFile(`${PASTA}/${nome}`, partes.bytes, base)
    }
    return ref
  } catch (e) {
    // Disco cheio, permissao, o que for: devolve a data URL e o chamador grava
    // como sempre gravou. Fica grande, mas nao perde a imagem.
    console.warn("[banco-de-imagens] gravacao falhou, mantendo inline:", e)
    return dataUrl
  }
}

/**
 * Apaga do disco as imagens que ninguem mais referencia.
 *
 * Chamado depois da migracao e ao remover escudo/uniforme. Recebe TODAS as refs
 * ainda vivas — se a lista vier incompleta, apaga imagem em uso, entao quem
 * chama precisa varrer o store inteiro antes.
 */
export async function limparImagensOrfas(refsVivas: Iterable<string>): Promise<number> {
  if (!isTauri()) return 0
  try {
    const fs = await import("@tauri-apps/plugin-fs")
    const base = { baseDir: fs.BaseDirectory.AppData }
    if (!(await fs.exists(PASTA, base))) return 0

    const vivas = new Set<string>()
    for (const r of refsVivas) if (isRefDeImagem(r)) vivas.add(r.slice(PREFIXO.length))

    let apagadas = 0
    for (const entrada of await fs.readDir(PASTA, base)) {
      if (!entrada.isFile || vivas.has(entrada.name)) continue
      await fs.remove(`${PASTA}/${entrada.name}`, base)
      apagadas++
    }
    return apagadas
  } catch (e) {
    console.warn("[banco-de-imagens] limpeza falhou (ignorada):", e)
    return 0
  }
}

/** Quantas imagens e quantos bytes o banco ocupa. Para a tela de armazenamento. */
export async function tamanhoDoBanco(): Promise<{ arquivos: number; bytes: number }> {
  if (!isTauri()) return { arquivos: 0, bytes: 0 }
  try {
    const fs = await import("@tauri-apps/plugin-fs")
    const base = { baseDir: fs.BaseDirectory.AppData }
    if (!(await fs.exists(PASTA, base))) return { arquivos: 0, bytes: 0 }
    let arquivos = 0
    let bytes = 0
    for (const entrada of await fs.readDir(PASTA, base)) {
      if (!entrada.isFile) continue
      arquivos++
      bytes += (await fs.stat(`${PASTA}/${entrada.name}`, base)).size
    }
    return { arquivos, bytes }
  } catch {
    return { arquivos: 0, bytes: 0 }
  }
}

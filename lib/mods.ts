"use client"

// MODS DO JOGADOR — pastas que qualquer pessoa monta e o jogo carrega por cima
// da base, sem substituir arquivo nenhum da instalação.
//
// POR QUE ISTO EXISTE. O Ultrafoot já tinha TRÊS camadas de dados por cima do
// build (seed embutido, canal de atualização, edição local do editor), mas todas
// INTERNAS: só quem tem o repositório ou o painel da VPS consegue produzir uma.
// Um jogador não tinha como montar um "Brasileirão 2026" e passar para outro. É
// exatamente a abertura do Brasfoot (a pasta `teams` editável) que faltava —
// menos a parte ruim, que é o patch sobrescrever a base oficial e não ter volta.
//
// ONDE FICA
// ─────────
//   Documentos\Ultrafoot 26 Mods\<id-do-mod>\
//
// ⚠️ Em `Documentos`, NÃO em `%LOCALAPPDATA%`. Uma pasta de mod que o jogador não
// acha não é aberta coisa nenhuma — e `lib/save-folder.ts` já ensinou o jogador a
// procurar as coisas dele em `Documentos\Ultrafoot 26 Saves`. De quebra, as
// capabilities já liberam `fs:allow-document-read-recursive`: nenhuma permissão
// nova precisou ser pedida para isto funcionar.
//
// FORMATO
// ───────
//   <id-do-mod>/
//     mod.json        obrigatório — id, name, version, author, gameVersion
//     clubes.json     opcional — Record<file_key, TeamOverride>
//     atletas.json    opcional — Record<`${file_key}__${nome}`, PlayerOverride>
//     escudos/        opcional — <file_key>.png (ou .webp/.jpg)
//
// Os dois JSON usam os MESMOS tipos que o editor e o canal já produzem
// (`TeamOverride`, `PlayerOverride`). Isso é de propósito: um mod não é um
// conceito novo para o motor, é mais uma camada no funil que já existia. Quem
// exporta edições pelo editor tem um mod pronto sem converter nada.
//
// PRECEDÊNCIA (a parte que não pode quebrar)
// ──────────────────────────────────────────
//   build  <  canal  <  MOD  <  edição local do jogador
//
// O mod vence o canal porque instalar um mod é um ato explícito do jogador; e
// PERDE para a edição local dele pelo mesmo motivo — instalar um pacote não pode
// apagar em silêncio o escudo que a pessoa importou à mão. Esse erro já aconteceu
// aqui de outra forma (lote parcial do canal apagando as colunas que não vinham
// no lote) e é caro justamente por ser silencioso.
//
// ENTRE MODS: `ordem` do manifesto (maior vence); empate, ordem alfabética do id.
// Sem isso, "qual dos dois valeu" viraria sorteio conforme o sistema de arquivos
// devolvesse as pastas.
//
// ⚠️ IMAGEM DE MOD NUNCA VAI PARA O STORE. Ela vira blob em memória e morre com a
// sessão. Escudo em base64 dentro do store foi o que inchou o save até 246 MB.

import { storeGet, storeSet } from "@/lib/persistent-store"
import type { TeamOverride } from "@/lib/team-overrides"
import type { PlayerOverride } from "@/lib/player-overrides"

const PASTA = "Ultrafoot 26 Mods"
const CHAVE_DESATIVADOS = "ultrafoot:mods:desativados"

/** Manifesto que o autor do mod escreve. Só `id` e `name` são obrigatórios. */
export interface ModManifest {
  id: string
  name: string
  version?: string
  author?: string
  /** Informativo por enquanto ("1.0+"). Não recusamos por versão: um mod velho
   *  que ainda casa por file_key continua valendo, e recusar seria pior. */
  gameVersion?: string
  /** Maior vence quando dois mods tocam o mesmo clube. Ausente = 0. */
  ordem?: number
}

export interface ModCarregado {
  manifest: ModManifest
  pasta: string
  clubes: Record<string, TeamOverride>
  atletas: Record<string, PlayerOverride>
  /** file_key -> blob: URL do escudo. Vazio na web. */
  escudos: Record<string, string>
  /** Problemas não fatais (arquivo corrompido, imagem ilegível). */
  avisos: string[]
}

export interface ResumoDosMods {
  carregados: ModCarregado[]
  /** Pastas que existem mas não puderam ser lidas, com o motivo. */
  recusados: { pasta: string; motivo: string }[]
}

// Índices achatados na ordem de precedência já resolvida. Os getters abaixo são
// SÍNCRONOS porque quem os chama (`getTeamOverride`, `getPlayerOverride`,
// `getCustomLogoUrl`) é síncrono no meio da montagem do elenco — mesma razão
// documentada em `getAtualizacao`.
let indiceClubes: Record<string, TeamOverride> = {}
let indiceAtletas: Record<string, PlayerOverride> = {}
let indiceEscudos: Record<string, string> = {}
let resumo: ResumoDosMods = { carregados: [], recusados: [] }
let blobsVivos: string[] = []

function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== "undefined"
  )
}

/** Ids que o jogador desligou na tela de mods. */
export function modsDesativados(): string[] {
  try {
    const bruto = storeGet(CHAVE_DESATIVADOS)
    const lido = bruto ? (JSON.parse(bruto) as unknown) : []
    return Array.isArray(lido) ? lido.filter((x): x is string => typeof x === "string") : []
  } catch {
    return []
  }
}

export function modAtivo(id: string): boolean {
  return !modsDesativados().includes(id)
}

/**
 * Liga/desliga um mod. NÃO recarrega sozinho: quem chama decide a hora de
 * chamar `carregarMods()` de novo, para a tela não recarregar a cada clique.
 */
export function definirModAtivo(id: string, ativo: boolean): void {
  const atual = new Set(modsDesativados())
  if (ativo) atual.delete(id)
  else atual.add(id)
  storeSet(CHAVE_DESATIVADOS, JSON.stringify([...atual]))
}

const MIME: Record<string, string> = {
  png: "image/png",
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
}

/** Lê um JSON da pasta do mod. Ausente devolve `{}`; corrompido, `null` + aviso. */
async function lerJson<T>(
  fs: typeof import("@tauri-apps/plugin-fs"),
  caminho: string,
  avisos: string[],
): Promise<Record<string, T>> {
  try {
    const base = { baseDir: fs.BaseDirectory.Document }
    if (!(await fs.exists(caminho, base))) return {}
    const texto = await fs.readTextFile(caminho, base)
    const lido = JSON.parse(texto) as unknown
    // Um array aqui é o engano mais provável de quem monta o arquivo à mão, e
    // seria aceito em silêncio como objeto vazio — 93% de um lote do canal já se
    // perdeu exatamente assim. Melhor avisar alto.
    if (!lido || typeof lido !== "object" || Array.isArray(lido)) {
      avisos.push(`${caminho}: esperado um objeto { chave: valor }, veio ${Array.isArray(lido) ? "uma lista" : typeof lido}`)
      return {}
    }
    return lido as Record<string, T>
  } catch (e) {
    avisos.push(`${caminho}: ${String(e).split("\n")[0]}`)
    return {}
  }
}

async function lerEscudos(
  fs: typeof import("@tauri-apps/plugin-fs"),
  pastaDoMod: string,
  avisos: string[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  const dir = `${pastaDoMod}/escudos`
  const base = { baseDir: fs.BaseDirectory.Document }
  try {
    if (!(await fs.exists(dir, base))) return out
    for (const entry of await fs.readDir(dir, base)) {
      if (!entry.isFile) continue
      const ponto = entry.name.lastIndexOf(".")
      if (ponto <= 0) continue
      const fileKey = entry.name.slice(0, ponto)
      const ext = entry.name.slice(ponto + 1).toLowerCase()
      const mime = MIME[ext]
      if (!mime) continue
      try {
        const bytes = await fs.readFile(`${dir}/${entry.name}`, base)
        const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }))
        blobsVivos.push(url)
        out[fileKey] = url
      } catch (e) {
        avisos.push(`escudos/${entry.name}: ${String(e).split("\n")[0]}`)
      }
    }
  } catch (e) {
    avisos.push(`escudos/: ${String(e).split("\n")[0]}`)
  }
  return out
}

/**
 * Varre a pasta de mods e reconstrói os índices. Chamada no boot
 * (`NativeAppProvider`) e de novo quando o jogador liga/desliga um mod.
 *
 * Nunca lança: mod quebrado entra em `recusados` e o jogo segue sem ele. Um
 * pacote de terceiro derrubando o boot seria o pior desfecho possível aqui.
 */
export async function carregarMods(): Promise<ResumoDosMods> {
  // Solta os blobs da carga anterior antes de trocar os índices, senão recarregar
  // a lista algumas vezes vaza a imagem de todo escudo já lido.
  for (const url of blobsVivos) URL.revokeObjectURL(url)
  blobsVivos = []

  const novo: ResumoDosMods = { carregados: [], recusados: [] }
  if (!isTauri()) {
    aplicar(novo)
    return novo
  }

  try {
    const fs = await import("@tauri-apps/plugin-fs")
    const base = { baseDir: fs.BaseDirectory.Document }
    if (!(await fs.exists(PASTA, base))) {
      // Cria vazia para o jogador achar o lugar sem precisar de instrução.
      await fs.mkdir(PASTA, { ...base, recursive: true }).catch(() => {})
      aplicar(novo)
      return novo
    }

    const desativados = new Set(modsDesativados())

    for (const entry of await fs.readDir(PASTA, base)) {
      if (!entry.isDirectory) continue
      const pastaDoMod = `${PASTA}/${entry.name}`
      const avisos: string[] = []
      try {
        const caminhoManifesto = `${pastaDoMod}/mod.json`
        if (!(await fs.exists(caminhoManifesto, base))) {
          novo.recusados.push({ pasta: entry.name, motivo: "sem mod.json" })
          continue
        }
        const manifest = JSON.parse(await fs.readTextFile(caminhoManifesto, base)) as ModManifest
        if (!manifest?.id || typeof manifest.id !== "string") {
          novo.recusados.push({ pasta: entry.name, motivo: "mod.json sem `id`" })
          continue
        }
        if (!manifest.name) manifest.name = manifest.id

        // Desligado pelo jogador: entra na lista (a tela precisa mostrá-lo) mas
        // sem ler dado nenhum do disco.
        if (desativados.has(manifest.id)) {
          novo.carregados.push({ manifest, pasta: entry.name, clubes: {}, atletas: {}, escudos: {}, avisos })
          continue
        }

        const [clubes, atletas, escudos] = await Promise.all([
          lerJson<TeamOverride>(fs, `${pastaDoMod}/clubes.json`, avisos),
          lerJson<PlayerOverride>(fs, `${pastaDoMod}/atletas.json`, avisos),
          lerEscudos(fs, pastaDoMod, avisos),
        ])
        novo.carregados.push({ manifest, pasta: entry.name, clubes, atletas, escudos, avisos })
      } catch (e) {
        novo.recusados.push({ pasta: entry.name, motivo: String(e).split("\n")[0] })
      }
    }
  } catch (e) {
    // Sem acesso a disco: não é erro do jogador, e o jogo funciona sem mods.
    console.warn("[mods] pasta indisponível (seguindo sem mods):", e)
  }

  aplicar(novo)
  return novo
}

export interface IndicesDeMod {
  clubes: Record<string, TeamOverride>
  atletas: Record<string, PlayerOverride>
  escudos: Record<string, string>
}

/**
 * Achata a lista de mods num índice só, resolvendo quem vence.
 *
 * Separada de `aplicar` e exportada porque é a REGRA — quem vence quando dois
 * pacotes tocam o mesmo clube — e regra sem teste vira sorteio na primeira vez
 * que alguém mexer na ordenação. Pura de propósito: não toca em `window`, então
 * `scripts/test-mods.ts` a exercita direto no node.
 */
export function mesclarMods(carregados: ModCarregado[]): IndicesDeMod {
  const duplicados = new Map<string, string>()
  const ordenados = [...carregados].sort((a, b) => {
    const d = (a.manifest.ordem ?? 0) - (b.manifest.ordem ?? 0)
    return d !== 0 ? d : a.manifest.id.localeCompare(b.manifest.id)
  })

  const clubes: Record<string, TeamOverride> = {}
  const atletas: Record<string, PlayerOverride> = {}
  const escudos: Record<string, string> = {}

  for (const mod of ordenados) {
    // Dois mods com o MESMO id são um engano de quem copiou a pasta e esqueceu de
    // trocar o manifesto — o segundo venceria em silêncio. Avisa nos dois.
    const anterior = duplicados.get(mod.manifest.id)
    if (anterior) {
      mod.avisos.push(`id "${mod.manifest.id}" repetido (também em "${anterior}") — este venceu`)
    }
    duplicados.set(mod.manifest.id, mod.pasta)

    // Mescla RASA por clube, mas os kits mesclam por variante: um mod que só troca
    // o uniforme 1 não pode zerar o 2 e o 3 que vieram do canal.
    for (const [fileKey, over] of Object.entries(mod.clubes)) {
      const base = clubes[fileKey]
      clubes[fileKey] = base
        ? { ...base, ...over, kits: { ...base.kits, ...over.kits } }
        : over
    }
    Object.assign(atletas, mod.atletas)
    Object.assign(escudos, mod.escudos)
  }

  return { clubes, atletas, escudos }
}

/** Achata os mods carregados nos índices síncronos, na ordem de precedência. */
function aplicar(novo: ResumoDosMods): void {
  const { clubes, atletas, escudos } = mesclarMods(novo.carregados)

  indiceClubes = clubes
  indiceAtletas = atletas
  indiceEscudos = escudos
  resumo = novo

  if (typeof window !== "undefined") {
    // Mesmo caminho de `ultrafoot:imagem:pronta`: as telas já montadas com os
    // dados de antes precisam se redesenhar quando o disco termina de responder.
    window.dispatchEvent(new CustomEvent("ultrafoot:mods:prontos", { detail: { total: novo.carregados.length } }))
  }
}

/** O que foi carregado na última varredura — usado pela tela de mods. */
export function estadoDosMods(): ResumoDosMods {
  return resumo
}

export function temMods(): boolean {
  return resumo.carregados.length > 0
}

/** Clube publicado por algum mod ativo, ou null. */
export function timeDoMod(fileKey: string): TeamOverride | null {
  return indiceClubes[fileKey] ?? null
}

/** Atleta publicado por algum mod ativo. A chave é a mesma de player-overrides. */
export function jogadorDoMod(chave: string): PlayerOverride | null {
  return indiceAtletas[chave] ?? null
}

/** Escudo publicado por algum mod ativo (blob: URL), ou null. */
export function escudoDoMod(fileKey: string): string | null {
  return indiceEscudos[fileKey] ?? indiceClubes[fileKey]?.logoUrl ?? null
}

/** Caminho da pasta, para mostrar na tela e para o botão "abrir pasta". */
export async function caminhoDaPastaDeMods(): Promise<string | null> {
  if (!isTauri()) return null
  try {
    const { documentDir, join } = await import("@tauri-apps/api/path")
    return await join(await documentDir(), PASTA)
  } catch {
    return null
  }
}

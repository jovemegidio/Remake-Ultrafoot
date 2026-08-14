"use client"

// Tira do `ultrafoot-clubs.json` as imagens que já estão gravadas nele.
//
// Quem instalou o jogo antes do banco de imagens tem tudo em base64 dentro do
// JSON único do persistent-store. Medido no arquivo real desta máquina em
// 11/08/2026: 245,67 MB, 3.488 imagens, das quais 170,11 MB só no cache do canal
// de atualização. Como `store.save()` reescreve o arquivo INTEIRO a cada
// gravação, esse peso aparecia como lentidão em cada clique do jogo — não como
// "o save está grande".
//
// Esta migração roda uma vez, em segundo plano, depois que o store carrega.
//
// ⚠️ ELA NUNCA PODE PERDER UMA IMAGEM. As regras que garantem isso:
//
//  1. O arquivo é escrito ANTES de a referência substituir o base64. Se o jogo
//     fechar no meio, o store continua com o base64 e a migração recomeça —
//     idempotente, porque o nome do arquivo é o sha do conteúdo.
//  2. Uma imagem que falhar ao gravar FICA como está. Ela não é perdida, só não
//     migra; a próxima execução tenta de novo.
//  3. Nada é apagado do disco aqui. A limpeza de órfãs é uma operação separada
//     e explícita.

import { storeGet, storeKeys, storeSetMany } from "@/lib/persistent-store"
import { guardarImagem, isRefDeImagem } from "@/lib/banco-de-imagens"

const CHAVE_FEITA = "ultrafoot:banco-de-imagens:migracao"
/** Sobe quando o formato mudar e a varredura precisar rodar de novo. */
const VERSAO = "1"

function isImagemInline(v: unknown): v is string {
  return typeof v === "string" && v.startsWith("data:image/")
}

/** Promove todo campo de imagem inline de um override de clube. */
async function migrarOverrideDeClube(bruto: string): Promise<string | null> {
  const ov = JSON.parse(bruto) as {
    logoUrl?: string
    kits?: Record<string, { imageUrl?: string } | undefined>
  }
  let mudou = false

  if (isImagemInline(ov.logoUrl)) {
    const ref = await guardarImagem(ov.logoUrl)
    if (ref && ref !== ov.logoUrl) {
      ov.logoUrl = ref
      mudou = true
    }
  }
  for (const k of Object.values(ov.kits ?? {})) {
    if (!k || !isImagemInline(k.imageUrl)) continue
    const ref = await guardarImagem(k.imageUrl)
    if (ref && ref !== k.imageUrl) {
      k.imageUrl = ref
      mudou = true
    }
  }
  return mudou ? JSON.stringify(ov) : null
}

/** Promove o rosto de um override de atleta. */
async function migrarOverrideDeAtleta(bruto: string): Promise<string | null> {
  const ov = JSON.parse(bruto) as { faceDataUrl?: string }
  if (!isImagemInline(ov.faceDataUrl)) return null
  const ref = await guardarImagem(ov.faceDataUrl)
  if (!ref || ref === ov.faceDataUrl) return null
  return JSON.stringify({ ...ov, faceDataUrl: ref })
}

/**
 * O cache do canal — a chave mais pesada de longe (170 MB).
 *
 * Formato: `{ chave: { u: urlDeOrigem, d: imagem, b?: bytes } }`. Só o `d` muda;
 * `u` continua sendo a prova de que a cópia é daquela publicação, e `b` passa a
 * guardar o tamanho real (sem ele o teto de download perderia a referência).
 */
async function migrarCacheDoCanal(bruto: string): Promise<string | null> {
  const mapa = JSON.parse(bruto) as Record<string, { u?: string; d?: string; b?: number }>
  let mudou = false
  for (const entrada of Object.values(mapa)) {
    if (!entrada || !isImagemInline(entrada.d)) continue
    const bytes = entrada.d.length
    const ref = await guardarImagem(entrada.d)
    if (!ref || ref === entrada.d) continue
    entrada.d = ref
    entrada.b = bytes
    mudou = true
  }
  return mudou ? JSON.stringify(mapa) : null
}

let jaRodou = false

/**
 * Roda a migração. Best-effort e silenciosa: qualquer falha deixa o dado como
 * estava. Devolve quantas chaves foram reescritas.
 */
export async function migrarImagensParaOBanco(): Promise<number> {
  if (jaRodou || typeof window === "undefined") return 0
  // Na web nao ha AppData; varrer milhares de entradas para concluir que todas
  // precisam continuar inline so criaria outro custo de boot.
  if (!("__TAURI_INTERNALS__" in window)) return 0
  jaRodou = true
  if (storeGet(CHAVE_FEITA) === VERSAO) return 0

  const novas: Array<[string, string]> = []
  let imagensPendentes = false

  for (const chave of storeKeys()) {
    const bruto = storeGet(chave)
    if (!bruto) continue
    try {
      let migrado: string | null = null

      if (chave.startsWith("ultrafoot:logo:") || chave.startsWith("ultrafoot:player-photo:")) {
        if (!isImagemInline(bruto) || isRefDeImagem(bruto)) continue
        const ref = await guardarImagem(bruto)
        migrado = ref && ref !== bruto ? ref : null
      } else if (chave.startsWith("ultrafoot:team-override:")) {
        migrado = await migrarOverrideDeClube(bruto)
      } else if (chave.startsWith("ultrafoot:player-override:")) {
        migrado = await migrarOverrideDeAtleta(bruto)
      } else if (chave === "ultrafoot:atualizacao-fotos") {
        migrado = await migrarCacheDoCanal(bruto)
      }

      // Uma chave pode migrar algumas imagens e falhar em outras. Conferimos o
      // resultado inteiro para nao declarar a migracao concluida pela metade.
      if ((migrado ?? bruto).includes("data:image/")) imagensPendentes = true
      if (migrado) novas.push([chave, migrado])
    } catch {
      // Chave corrompida ou formato inesperado: deixa exatamente como está.
      if (bruto.includes("data:image/")) imagensPendentes = true
    }
  }

  // So marca concluida quando nenhum base64 ficou para tras. Disco cheio ou
  // uma falha temporaria mantem a imagem inline e faz a migracao tentar de novo
  // no proximo boot, conforme a promessa de nunca perder o arquivo importado.
  if (!imagensPendentes) novas.push([CHAVE_FEITA, VERSAO])
  // Um commit só: 3.500 `storeSet` seriam 3.500 reescritas do arquivo inteiro.
  await storeSetMany(novas)
  return novas.length - (imagensPendentes ? 0 : 1)
}

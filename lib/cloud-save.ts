import { safeLocalSet } from "@/lib/safe-storage"
// Save na "nuvem" baseado em codigo de 6 caracteres.
// Sem backend configurado, os saves sao guardados localmente sob o codigo,
// permitindo exportar/importar entre sessoes no mesmo dispositivo.
// A mesma API pode ser apontada para um endpoint remoto futuramente.

const SAVE_KEY = "ultrafoot:save"
const CLOUD_PREFIX = "ultrafoot:cloud:"
const LAST_CODE_KEY = "ultrafoot:cloud:last-code"

export interface CloudResult {
  success: boolean
  error?: string
}

function hasWindow(): boolean {
  return typeof window !== "undefined" && !!window.localStorage
}

/** Recupera o ultimo codigo de nuvem usado pelo jogador. */
export function getSavedCloudCode(): string | null {
  if (!hasWindow()) return null
  try {
    return window.localStorage.getItem(LAST_CODE_KEY)
  } catch {
    return null
  }
}

/** Gera um codigo aleatorio de 6 caracteres hexadecimais maiusculos. */
export function generateCloudCode(): string {
  let code = ""
  const chars = "0123456789ABCDEF"
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

/**
 * Envia o save atual para a "nuvem" sob um codigo.
 * Retorna o codigo gerado (ou o informado) em caso de sucesso.
 */
export async function uploadSave(code?: string): Promise<CloudResult & { code?: string }> {
  if (!hasWindow()) return { success: false, error: "Ambiente sem armazenamento" }
  try {
    const save = window.localStorage.getItem(SAVE_KEY)
    if (!save) return { success: false, error: "Nenhum jogo salvo para enviar" }
    const finalCode = (code && code.length === 6 ? code : generateCloudCode()).toUpperCase()
    safeLocalSet(CLOUD_PREFIX + finalCode, save)
    safeLocalSet(LAST_CODE_KEY, finalCode)
    return { success: true, code: finalCode }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro ao enviar" }
  }
}

/**
 * Baixa um save da "nuvem" pelo codigo e o aplica ao save local.
 */
export async function downloadSave(code: string): Promise<CloudResult> {
  if (!hasWindow()) return { success: false, error: "Ambiente sem armazenamento" }
  const normalized = (code ?? "").trim().toUpperCase()
  if (normalized.length !== 6) {
    return { success: false, error: "Codigo invalido" }
  }
  try {
    const stored = window.localStorage.getItem(CLOUD_PREFIX + normalized)
    if (!stored) {
      return { success: false, error: "Codigo nao encontrado (404)" }
    }
    // Aplica o save baixado como save atual.
    safeLocalSet(SAVE_KEY, stored)
    safeLocalSet(LAST_CODE_KEY, normalized)
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro ao baixar" }
  }
}

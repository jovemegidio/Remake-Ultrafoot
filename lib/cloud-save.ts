import { safeLocalSet } from "@/lib/safe-storage"
import { storeRemove, storeSet } from "@/lib/persistent-store"
import { catalogarSave } from "@/lib/conta-ultrafoot"

// Sincronizacao de carreira por codigo. Na versao web usa a API da VPS; se a
// API estiver indisponivel (por exemplo no desktop offline), preserva um
// fallback local para o jogador nunca perder o save durante uma falha de rede.

const CLOUD_PREFIX = "ultrafoot:cloud:"
const LAST_CODE_KEY = "ultrafoot:cloud:last-code"
const API_BASE = (process.env.NEXT_PUBLIC_CLOUD_SAVE_API || "/api/cloud-saves").replace(/\/$/, "")

export interface CloudResult {
  success: boolean
  error?: string
}

interface CloudBundle {
  version: 2
  createdAt: number
  entries: Record<string, string>
}

function hasWindow(): boolean {
  return typeof window !== "undefined" && !!window.localStorage
}

function isSaveKey(key: string): boolean {
  if (key.startsWith("ultrafoot-game-engine")) return true
  if (!key.startsWith("ultrafoot:")) return false
  if (key.startsWith(CLOUD_PREFIX) || key === LAST_CODE_KEY) return false
  // Credenciais/licencas pertencem ao dispositivo, nunca ao save da carreira.
  if (/licen|license|serial|registr|device/i.test(key)) return false
  return (
    key === "ultrafoot:save"
    || key === "ultrafoot:active-career"
    || key === "ultrafoot:career-index"
    || key.startsWith("ultrafoot:save:")
    || key.includes("game-engine")
    || key.includes("career")
  )
}

function collectBundle(): CloudBundle {
  const entries: Record<string, string> = {}
  for (let index = 0; index < window.localStorage.length; index++) {
    const key = window.localStorage.key(index)
    if (!key || !isSaveKey(key)) continue
    const value = window.localStorage.getItem(key)
    if (value !== null) entries[key] = value
  }
  return { version: 2, createdAt: Date.now(), entries }
}

function applyBundle(bundle: CloudBundle): void {
  const existing: string[] = []
  for (let index = 0; index < window.localStorage.length; index++) {
    const key = window.localStorage.key(index)
    if (key && isSaveKey(key)) existing.push(key)
  }
  for (const key of existing) storeRemove(key)
  for (const [key, value] of Object.entries(bundle.entries)) storeSet(key, value)
}

/** Recupera o ultimo codigo de nuvem usado pelo jogador. */
export function getSavedCloudCode(): string | null {
  if (!hasWindow()) return null
  try { return window.localStorage.getItem(LAST_CODE_KEY) } catch { return null }
}

/** Gera um codigo aleatorio de 6 caracteres hexadecimais maiusculos. */
export function generateCloudCode(): string {
  const bytes = new Uint8Array(3)
  if (typeof crypto !== "undefined") crypto.getRandomValues(bytes)
  else for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256)
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("").toUpperCase()
}

/**
 * Rotulo curto para a pessoa reconhecer o save na lista da conta.
 *
 * Sem isso a lista vira uma coluna de codigos hexadecimais, e escolher qual
 * baixar depois de formatar seria adivinhacao.
 */
function rotuloDoSave(bundle: CloudBundle): string {
  try {
    const cru = bundle.entries["ultrafoot:career-index"] ?? bundle.entries["ultrafoot:save"]
    if (!cru) return ""
    const dado = JSON.parse(cru) as unknown
    const lista = Array.isArray(dado) ? dado : (dado as { careers?: unknown[] })?.careers
    const primeiro = (Array.isArray(lista) ? lista[0] : dado) as
      { clube?: string; teamName?: string; time?: string; temporada?: number; season?: number } | undefined
    const clube = primeiro?.clube ?? primeiro?.teamName ?? primeiro?.time
    const temporada = primeiro?.temporada ?? primeiro?.season
    if (clube && temporada) return `${clube} — ${temporada}`
    if (clube) return String(clube)
  } catch { /* rotulo e conforto, nao requisito */ }
  const quantas = Object.keys(bundle.entries).length
  return quantas ? `${quantas} itens` : ""
}

/** Envia todas as carreiras atuais para a VPS sob um codigo recuperavel. */
export async function uploadSave(code?: string): Promise<CloudResult & { code?: string }> {
  if (!hasWindow()) return { success: false, error: "Ambiente sem armazenamento" }
  try {
    const bundle = collectBundle()
    if (!Object.keys(bundle.entries).length) return { success: false, error: "Nenhuma carreira salva para enviar" }
    const finalCode = (code?.trim().length === 6 ? code : generateCloudCode()).toUpperCase()

    const response = await fetch(`${API_BASE}/${finalCode}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bundle),
    })
    if (!response.ok) throw new Error(`Servidor respondeu ${response.status}`)
    safeLocalSet(CLOUD_PREFIX + finalCode, JSON.stringify(bundle))
    safeLocalSet(LAST_CODE_KEY, finalCode)
    // Anota o codigo na conta do launcher, se houver uma. E o que permite achar
    // a carreira depois de formatar sem ter decorado o codigo. Nao bloqueia:
    // o save JA subiu, e uma falha de catalogo nao pode virar erro na tela.
    void catalogarSave(finalCode, rotuloDoSave(bundle))
    return { success: true, code: finalCode }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erro ao enviar save" }
  }
}

/** Baixa uma carreira da VPS e restaura todas as chaves do save. */
export async function downloadSave(code: string): Promise<CloudResult> {
  if (!hasWindow()) return { success: false, error: "Ambiente sem armazenamento" }
  const normalized = (code ?? "").trim().toUpperCase()
  if (!/^[A-F0-9]{6}$/.test(normalized)) return { success: false, error: "Codigo invalido" }

  try {
    let bundle: CloudBundle | null = null
    const response = await fetch(`${API_BASE}/${normalized}`, { cache: "no-store" })
    if (response.status === 404) return { success: false, error: "Codigo nao encontrado (404)" }
    if (!response.ok) throw new Error(`Servidor respondeu ${response.status}`)
    bundle = await response.json() as CloudBundle
    if (!bundle || bundle.version !== 2 || !bundle.entries) throw new Error("Formato de save invalido")
    applyBundle(bundle)
    safeLocalSet(CLOUD_PREFIX + normalized, JSON.stringify(bundle))
    safeLocalSet(LAST_CODE_KEY, normalized)
    return { success: true }
  } catch (error) {
    // Fallback local permite continuar usando o recurso no desktop sem internet.
    try {
      const local = window.localStorage.getItem(CLOUD_PREFIX + normalized)
      if (local) {
        const bundle = JSON.parse(local) as CloudBundle
        applyBundle(bundle)
        safeLocalSet(LAST_CODE_KEY, normalized)
        return { success: true }
      }
    } catch { /* o erro remoto abaixo e mais util */ }
    return { success: false, error: error instanceof Error ? error.message : "Erro ao baixar save" }
  }
}

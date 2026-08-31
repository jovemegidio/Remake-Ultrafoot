import { safeLocalSet } from "@/lib/safe-storage"
import { storeRemove, storeSet } from "@/lib/persistent-store"
import { catalogarSave } from "@/lib/conta-ultrafoot"
import { getActiveCareerId, listCareerSaves, type CareerSaveSummary } from "@/lib/save-system"
import { fetchDoAmbiente } from "@/lib/buscar-json"
import { isTauri } from "@/lib/game-asset"

// Sincronizacao de carreira por codigo. Na versao web usa a API da VPS; se a
// API estiver indisponivel (por exemplo no desktop offline), preserva um
// fallback local para o jogador nunca perder o save durante uma falha de rede.

const CLOUD_PREFIX = "ultrafoot:cloud:"
const LAST_CODE_KEY = "ultrafoot:cloud:last-code"
// As mesmas chaves de `lib/save-system.ts`. Repetidas aqui de propósito: lá elas
// são privadas do módulo, e exportá-las só para isto alargaria a superfície do
// save por conveniência de um consumidor.
const CAREER_INDEX_KEY = "ultrafoot:career-index"
const ACTIVE_CAREER_KEY = "ultrafoot:active-career"

import { SERVIDOR_ULTRAFOOT } from "@/lib/servidor-ultrafoot"
const VPS = SERVIDOR_ULTRAFOOT

/**
 * Onde mora a API de saves.
 *
 * ⚠️ O CAMINHO E `/save`, NAO `/api/cloud-saves`. O nginx da VPS antiga expunha
 * `/api/cloud-saves/`; o da VPS nova (28/07/2026) expoe `/save/`. Com o caminho
 * velho a chamada cai no `try_files` da SPA: o GET volta o index.html do jogo
 * com **200** (e o JSON.parse estoura sem dizer o motivo) e o PUT volta **405**.
 * Ou seja, salvar na nuvem falhava em silencio na web e no celular.
 *
 * Dentro do Tauri a pagina roda em `tauri.localhost`, entao caminho relativo
 * apontaria para dentro do proprio app e nunca sairia da maquina — la vai a URL
 * absoluta (o host ja esta na allowlist de src-tauri/capabilities/default.json).
 * Na web e no WebView do celular a pagina JA vem da VPS: relativo e melhor,
 * porque continua valendo se o endereco mudar.
 */
function baseDaApi(): string {
  const configurada = process.env.NEXT_PUBLIC_CLOUD_SAVE_API
  if (configurada) return configurada.replace(/\/$/, "")
  if (typeof window !== "undefined" && isTauri()) return `${VPS}/save`
  return "/save"
}

export interface CloudResult {
  success: boolean
  error?: string
}

/**
 * ⚠️ UM CÓDIGO POR CARREIRA (v3), e não um código para tudo (v2).
 *
 * A v2 juntava TODAS as carreiras do aparelho num pacote só. Três consequências
 * que só apareciam com mais de uma carreira, e todas ruins:
 *
 *  1. **Não dava para mandar uma carreira para alguém.** O código levava junto
 *     todas as outras.
 *  2. **Baixar APAGAVA o que estava no aparelho.** `applyBundle` limpava toda
 *     chave de save antes de escrever — restaurar uma carreira antiga destruía
 *     as outras, sem aviso.
 *  3. **A lista da conta mentia.** O rótulo saía do PRIMEIRO item do índice, de
 *     modo que várias carreiras diferentes apareciam como "Cruzeiro — 2026".
 *
 * A v3 carrega UMA carreira, com o resumo dela junto, e é aplicada por FUSÃO:
 * entra a carreira baixada e as que já existiam continuam onde estavam.
 *
 * A v2 continua sendo LIDA para sempre — há códigos v2 circulando por aí, e o
 * caminho de leitura deles é o único jeito de essas pessoas não perderem nada.
 */
interface CloudBundleV2 {
  version: 2
  createdAt: number
  entries: Record<string, string>
}

interface CloudBundleV3 {
  version: 3
  createdAt: number
  careerId: string
  /** Para a lista da conta mostrar clube e temporada sem abrir o save. */
  resumo?: CareerSaveSummary
  entries: Record<string, string>
}

type CloudBundle = CloudBundleV2 | CloudBundleV3

function hasWindow(): boolean {
  return typeof window !== "undefined" && !!window.localStorage
}

function isSaveKey(key: string): boolean {
  // ⚠️ A QUARENTENA NÃO SOBE PARA A NUVEM. Ela guarda o que o jogo escreveu sem
  // carreira ativa (boot, splash, logo após apagar uma carreira). É lixo por
  // definição, e mandá-la junto levaria a contaminação de "um save invadindo
  // outro" para a máquina que baixasse o pacote. Ver `getCareerScopedKey`.
  if (key.endsWith(":__sem-carreira") || key.includes(":__legado-consumido-por")) return false
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
    // O universo da CPU saiu de dentro do save na 1.0.301 e ganhou chave própria.
    // Sem esta linha ele deixaria de subir para a nuvem, e restaurar a carreira
    // em outra máquina devolveria o mundo dos rivais ao retrato de 2026.
    || key.startsWith("ultrafoot:universo:")
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

/**
 * Aplica um pacote v2 (tudo do aparelho).
 *
 * ⚠️ ISTO APAGA AS CARREIRAS LOCAIS, e é assim de propósito: um pacote v2 é o
 * retrato do aparelho inteiro, então restaurá-lo é "voltar a máquina para
 * aquele dia". Mesclar dois retratos completos produziria um índice com
 * carreiras de duas linhas do tempo. Quem chama precisa avisar antes.
 */
function applyBundleV2(bundle: CloudBundleV2): void {
  const existing: string[] = []
  for (let index = 0; index < window.localStorage.length; index++) {
    const key = window.localStorage.key(index)
    if (key && isSaveKey(key)) existing.push(key)
  }
  for (const key of existing) storeRemove(key)
  for (const [key, value] of Object.entries(bundle.entries)) storeSet(key, value)
}

/** Toda chave do localStorage que pertence a UMA carreira. */
function chavesDaCarreira(careerId: string): string[] {
  const chaves: string[] = []
  for (let index = 0; index < window.localStorage.length; index++) {
    const key = window.localStorage.key(index)
    // A convenção do jogo é `<base>:<careerId>` (ver `getCareerScopedKey`), o
    // que cobre o save, o motor, o universo, as notificações e o resto.
    if (key && isSaveKey(key) && key.endsWith(`:${careerId}`)) chaves.push(key)
  }
  return chaves
}

/**
 * Aplica UMA carreira por fusão: ela entra, as outras ficam.
 *
 * O índice é reescrito à mão em vez de vir do pacote porque o pacote traz o
 * índice de OUTRO aparelho — copiá-lo apagaria da lista as carreiras daqui, que
 * continuariam existindo no armazenamento sem aparecer em lugar nenhum. É o
 * mesmo defeito de apagar, só que mais difícil de perceber.
 */
function applyBundleV3(bundle: CloudBundleV3): void {
  for (const [key, value] of Object.entries(bundle.entries)) {
    if (key === CAREER_INDEX_KEY || key === ACTIVE_CAREER_KEY) continue
    storeSet(key, value)
  }

  const resumo = bundle.resumo
    ?? { id: bundle.careerId, name: "Carreira", teamShort: "", managerName: "", season: 0, week: 0, updatedAt: Date.now() }
  let indice: CareerSaveSummary[] = []
  try {
    const cru = JSON.parse(window.localStorage.getItem(CAREER_INDEX_KEY) ?? "[]")
    if (Array.isArray(cru)) indice = cru as CareerSaveSummary[]
  } catch { /* índice ilegível vira lista de uma */ }
  storeSet(CAREER_INDEX_KEY, JSON.stringify([
    resumo,
    ...indice.filter(item => item.id !== bundle.careerId),
  ]))
  storeSet(ACTIVE_CAREER_KEY, bundle.careerId)
}

/**
 * O código desta carreira, se ela já foi para a nuvem alguma vez.
 *
 * ⚠️ Mora sob `CLOUD_PREFIX`, que `isSaveKey` exclui de propósito: o código é do
 * PAR carreira-aparelho, não conteúdo de save. Se entrasse no pacote, baixar a
 * carreira noutra máquina levaria o código junto e as duas máquinas passariam a
 * sobrescrever a mesma entrada da nuvem.
 */
export function codigoDaCarreira(careerId: string): string | null {
  if (!hasWindow()) return null
  try { return window.localStorage.getItem(`${CLOUD_PREFIX}codigo:${careerId}`) } catch { return null }
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

// `rotuloDoSave` saiu daqui: ela adivinhava o clube pelo PRIMEIRO item do índice
// de um pacote com várias carreiras, e por isso rotulava carreiras diferentes
// com o mesmo nome. Com um código por carreira o rótulo é o resumo dela —
// `rotuloDaCarreira`, mais abaixo, sem adivinhação.

/**
 * Rótulo de UMA carreira: é o que a pessoa lê na lista da conta.
 *
 * ⚠️ ELE PRECISA IDENTIFICAR A CARREIRA, e "clube — ano" não bastava: quem joga
 * várias temporadas do mesmo clube via a mesma linha repetida e não sabia qual
 * baixar. A lista LOCAL, na mesma tela e poucos pixels acima, mostra clube,
 * temporada e semana; a da nuvem mostrava menos que ela — descrevendo a mesma
 * carreira de dois jeitos diferentes.
 *
 * Fica com a SIGLA do clube de propósito: resolver o nome exigiria
 * `lib/teams-data`, o pedaço mais pesado do bundle, dentro de um módulo que a
 * tela de abertura carrega.
 */
function rotuloDaCarreira(resumo: CareerSaveSummary | undefined): string {
  if (!resumo) return "Carreira salva"
  const clube = resumo.teamShort || resumo.name || "Carreira"
  const temporada = resumo.season ? `${resumo.season}/${resumo.season + 1}` : ""
  const semana = Number.isFinite(resumo.week) ? `Semana ${resumo.week}` : ""
  // Mesa de co-op é o que mais distingue duas carreiras parecidas do mesmo clube.
  const mesa = (resumo.tecnicos ?? 1) > 1 ? `${resumo.tecnicos} técnicos` : ""
  const detalhe = [temporada, semana, mesa].filter(Boolean).join(" · ")
  return detalhe ? `${clube} — ${detalhe}` : String(clube)
}

/**
 * ENVIA UMA CARREIRA, sob o código dela.
 *
 * ⚠️ O código NUNCA vem de `getSavedCloudCode()`. Aquele é o último código usado
 * no aparelho e costuma ser um pacote v2 com várias carreiras — reaproveitá-lo
 * aqui gravaria UMA carreira por cima do pacote de TODAS, no servidor. Cada
 * carreira usa o código dela, ou ganha um novo.
 */
export async function uploadCarreira(
  careerId?: string,
  code?: string,
): Promise<CloudResult & { code?: string }> {
  if (!hasWindow()) return { success: false, error: "Ambiente sem armazenamento" }
  const id = careerId ?? getActiveCareerId()
  if (!id) return { success: false, error: "Nenhuma carreira ativa para enviar" }

  try {
    const chaves = chavesDaCarreira(id)
    if (!chaves.length) return { success: false, error: "Esta carreira ainda nao tem nada salvo" }

    const entries: Record<string, string> = {}
    for (const chave of chaves) {
      const valor = window.localStorage.getItem(chave)
      if (valor !== null) entries[chave] = valor
    }
    const resumo = listCareerSaves().find(item => item.id === id)
    const bundle: CloudBundleV3 = { version: 3, createdAt: Date.now(), careerId: id, resumo, entries }

    const finalCode = (
      code?.trim().length === 6 ? code : (codigoDaCarreira(id) ?? generateCloudCode())
    ).toUpperCase()

    const requisitar = await fetchDoAmbiente()
    const response = await requisitar(`${baseDaApi()}/${finalCode}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bundle),
    })
    if (!response.ok) throw new Error(`Servidor respondeu ${response.status}`)

    safeLocalSet(CLOUD_PREFIX + finalCode, JSON.stringify(bundle))
    safeLocalSet(`${CLOUD_PREFIX}codigo:${id}`, finalCode)
    safeLocalSet(LAST_CODE_KEY, finalCode)
    // Anota o codigo na conta do launcher, se houver uma. E o que permite achar
    // a carreira depois de formatar sem ter decorado o codigo. Nao bloqueia:
    // o save JA subiu, e uma falha de catalogo nao pode virar erro na tela.
    void catalogarSave(finalCode, rotuloDaCarreira(resumo))
    return { success: true, code: finalCode }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erro ao enviar save" }
  }
}

/**
 * Envia a carreira ATIVA. É o que o salvamento manual e o automático usam.
 *
 * Mudou de sentido na 1.0.305: antes subia o aparelho inteiro num pacote só.
 * O parâmetro continua aceito para quem quiser forçar um código, mas o normal é
 * chamar sem nada e deixar cada carreira com o código dela.
 */
export async function uploadSave(code?: string): Promise<CloudResult & { code?: string }> {
  return uploadCarreira(undefined, code)
}

/**
 * Envia TODAS as carreiras num pacote v2 — o retrato do aparelho.
 *
 * Continua existindo por um motivo só: backup antes de formatar. Não é o
 * caminho normal, e quem restaura um pacote destes substitui o que houver aqui.
 */
export async function uploadBackupCompleto(code?: string): Promise<CloudResult & { code?: string }> {
  if (!hasWindow()) return { success: false, error: "Ambiente sem armazenamento" }
  try {
    const bundle = collectBundle()
    if (!Object.keys(bundle.entries).length) return { success: false, error: "Nenhuma carreira salva para enviar" }
    const finalCode = (code?.trim().length === 6 ? code : generateCloudCode()).toUpperCase()

    const requisitar = await fetchDoAmbiente()
    const response = await requisitar(`${baseDaApi()}/${finalCode}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bundle),
    })
    if (!response.ok) throw new Error(`Servidor respondeu ${response.status}`)
    safeLocalSet(CLOUD_PREFIX + finalCode, JSON.stringify(bundle))
    safeLocalSet(LAST_CODE_KEY, finalCode)
    void catalogarSave(finalCode, `Backup — ${Object.keys(bundle.entries).length} itens`)
    return { success: true, code: finalCode }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erro ao enviar backup" }
  }
}

/** Baixa uma carreira da VPS e restaura todas as chaves do save. */
export async function downloadSave(code: string): Promise<CloudResult> {
  if (!hasWindow()) return { success: false, error: "Ambiente sem armazenamento" }
  const normalized = (code ?? "").trim().toUpperCase()
  if (!/^[A-F0-9]{6}$/.test(normalized)) return { success: false, error: "Codigo invalido" }

  try {
    let bundle: CloudBundle | null = null
    const requisitar = await fetchDoAmbiente()
    const response = await requisitar(`${baseDaApi()}/${normalized}`, { cache: "no-store" })
    if (response.status === 404) return { success: false, error: "Codigo nao encontrado (404)" }
    if (!response.ok) throw new Error(`Servidor respondeu ${response.status}`)
    // Se a rota do save estiver errada, o nginx devolve o index.html do JOGO com
    // 200 e o JSON.parse estoura com uma mensagem que nao ajuda ninguem. Conferir
    // o tipo transforma isso num erro que diz o que houve.
    const tipo = response.headers.get("content-type") || ""
    if (!tipo.includes("json")) {
      throw new Error("O servidor nao devolveu um save (endereco da API errado?)")
    }
    bundle = await response.json() as CloudBundle
    const aplicado = aplicarPacote(bundle)
    if (!aplicado.success) return aplicado
    safeLocalSet(CLOUD_PREFIX + normalized, JSON.stringify(bundle))
    safeLocalSet(LAST_CODE_KEY, normalized)
    if (bundle.version === 3) safeLocalSet(`${CLOUD_PREFIX}codigo:${bundle.careerId}`, normalized)
    return aplicado
  } catch (error) {
    // Fallback local permite continuar usando o recurso no desktop sem internet.
    try {
      const local = window.localStorage.getItem(CLOUD_PREFIX + normalized)
      if (local) {
        const bundle = JSON.parse(local) as CloudBundle
        const aplicado = aplicarPacote(bundle)
        if (aplicado.success) safeLocalSet(LAST_CODE_KEY, normalized)
        return aplicado
      }
    } catch { /* o erro remoto abaixo e mais util */ }
    return { success: false, error: error instanceof Error ? error.message : "Erro ao baixar save" }
  }
}

/**
 * Aplica o pacote conforme a versão dele.
 *
 * ⚠️ A v2 SUBSTITUI e a v3 FUNDE, e a diferença tem de ser respeitada aqui e não
 * na tela: se alguma chamada esquecer, o jogador perde carreira sem que nada
 * acuse. Ver os comentários de `applyBundleV2`/`applyBundleV3`.
 */
function aplicarPacote(bundle: CloudBundle | null): CloudResult & { substituiuTudo?: boolean } {
  if (!bundle || !bundle.entries) return { success: false, error: "Formato de save invalido" }
  if (bundle.version === 3) {
    if (!bundle.careerId) return { success: false, error: "Save sem identificacao de carreira" }
    applyBundleV3(bundle)
    return { success: true }
  }
  if (bundle.version === 2) {
    applyBundleV2(bundle)
    return { success: true, substituiuTudo: true }
  }
  return { success: false, error: "Formato de save invalido" }
}

/**
 * O pacote deste código substitui TUDO (v2) ou entra ao lado (v3)?
 *
 * A tela precisa saber ANTES de baixar: um pacote v2 apaga as carreiras do
 * aparelho, e isso não pode acontecer sem a pessoa ter dito que sim.
 */
export async function inspecionarCodigo(code: string): Promise<
  { ok: true; substituiTudo: boolean; rotulo: string } | { ok: false; error: string }
> {
  const normalized = (code ?? "").trim().toUpperCase()
  if (!/^[A-F0-9]{6}$/.test(normalized)) return { ok: false, error: "Codigo invalido" }
  try {
    const requisitar = await fetchDoAmbiente()
    const r = await requisitar(`${baseDaApi()}/${normalized}`, { cache: "no-store" })
    if (r.status === 404) return { ok: false, error: "Codigo nao encontrado (404)" }
    if (!r.ok) return { ok: false, error: `Servidor respondeu ${r.status}` }
    if (!(r.headers.get("content-type") || "").includes("json")) {
      return { ok: false, error: "O servidor nao devolveu um save (endereco da API errado?)" }
    }
    const bundle = await r.json() as CloudBundle
    if (bundle?.version === 3) {
      return { ok: true, substituiTudo: false, rotulo: rotuloDaCarreira(bundle.resumo) }
    }
    if (bundle?.version === 2) {
      const quantas = Object.keys(bundle.entries ?? {}).length
      return { ok: true, substituiTudo: true, rotulo: `Backup completo — ${quantas} itens` }
    }
    return { ok: false, error: "Formato de save invalido" }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Erro ao consultar o codigo" }
  }
}

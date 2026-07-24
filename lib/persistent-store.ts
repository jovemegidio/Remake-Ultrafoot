"use client"

// Persistent store backed by tauri-plugin-store in Tauri (survives reinstalls),
// with automatic one-time migration from localStorage and in-memory cache for
// synchronous reads.

type TauriStore = {
  has: (key: string) => Promise<boolean>
  set: (key: string, value: unknown) => Promise<void>
  get: <T>(key: string) => Promise<T | undefined>
  delete: (key: string) => Promise<boolean>
  keys: () => Promise<string[]>
  entries: <T>() => Promise<[string, T][]>
  save: () => Promise<void>
}

const cache = new Map<string, string>()
const pendingOperations = new Set<Promise<void>>()
let writeQueue: Promise<void> = Promise.resolve()
let _initialized = false
let _initPromise: Promise<void> | null = null
let _tauriStore: TauriStore | null = null

function _isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== "undefined"
  )
}

async function _getStore(): Promise<TauriStore> {
  if (!_tauriStore) {
    const { load } = await import("@tauri-apps/plugin-store")
    _tauriStore = (await load("ultrafoot-clubs.json", { autoSave: false } as Parameters<typeof load>[1])) as TauriStore
  }
  return _tauriStore
}

async function _migrateLocalStorage(store: TauriStore): Promise<void> {
  let migrated = 0
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k?.startsWith("ultrafoot:")) continue
    const v = localStorage.getItem(k)
    if (v === null) continue
    const exists = await store.has(k)
    if (!exists) {
      await store.set(k, v)
      migrated++
    }
  }
  if (migrated > 0) await store.save()
}

/**
 * Promove para o arquivo durável as chaves ultrafoot: que existam apenas no
 * localStorage. Usa o `cache` (ja carregado do durável) para decidir, sem
 * round-trip async por chave. Diferente de _migrateLocalStorage, roda SEMPRE —
 * nao so quando o durável esta vazio — para nao perder registro/settings que
 * so vivem no localStorage. Idempotente: depois de promovida, a chave esta no
 * cache e e ignorada.
 */
async function _promoteLocalOnlyKeys(store: TauriStore): Promise<void> {
  if (typeof localStorage === "undefined") return
  let promoted = 0
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k?.startsWith("ultrafoot:")) continue
    if (cache.has(k)) continue // ja e durável
    const v = localStorage.getItem(k)
    if (v === null) continue
    cache.set(k, v)
    await store.set(k, v)
    promoted++
  }
  if (promoted > 0) await store.save()
}

async function _init(): Promise<void> {
  if (typeof window === "undefined") {
    _initialized = true
    return
  }

  if (_isTauri()) {
    try {
      const store = await _getStore()
      const keys = await store.keys()
      if (keys.length === 0) {
        await _migrateLocalStorage(store)
      }
      const entries = await store.entries<string>()
      for (const [k, v] of entries) {
        if (typeof v === "string") {
          cache.set(k, v)
          // Mantem um espelho local para as rotinas sincronas de listagem/exportacao.
          // Antes o editor gravava corretamente no plugin-store, mas
          // listLocalTeamOverrides() varria o localStorage e concluia que nao havia
          // nenhuma edicao. O espelho tambem serve como recuperacao se o arquivo do
          // plugin ficar temporariamente indisponivel.
          try { localStorage.setItem(k, v) } catch { /* quota/privacidade: cache segue valido */ }
        }
      }

      // PROMOCAO: qualquer chave ultrafoot: que exista SO no localStorage vai para
      // o arquivo durável agora. Sem isto, dado gravado apenas via safeLocalSet
      // (o REGISTRO de builds antigas, e settings como acessibilidade/desempenho)
      // se perde na proxima atualizacao — o WebView2 limpa o localStorage, e a
      // migracao antiga so rodava com o arquivo VAZIO (o do jogador ja tem save,
      // entao nunca rodava). Aqui promove key a key o que faltar, sem sobrescrever
      // o que ja e durável. Como cada navegacao recarrega a pagina, roda cedo e
      // frequente; depois de promovida, a chave ja esta no cache e e ignorada.
      await _promoteLocalOnlyKeys(store)
    } catch (e) {
      console.warn("[persistent-store] Tauri store failed, using localStorage:", e)
      _loadFromLocalStorage()
    }
  } else {
    _loadFromLocalStorage()
  }

  _initialized = true

  // Sinaliza que o cache foi populado a partir do disco. Componentes que leem o
  // store de forma sincrona no mount (ex.: TeamCrest) montam antes desta carga
  // async terminar; sem este evento continuariam mostrando o fallback mesmo com
  // um escudo/override ja salvo. Cada navegacao e um reload completo, entao isto
  // dispara uma vez por tela.
  window.dispatchEvent(new CustomEvent("ultrafoot:store:ready"))
}

function _loadFromLocalStorage(): void {
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k?.startsWith("ultrafoot:")) continue
    const v = localStorage.getItem(k)
    if (v !== null) cache.set(k, v)
  }
}

function _dispatch(key: string): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ultrafoot:store:changed", { detail: { key } }))
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function initPersistentStore(): Promise<void> {
  if (_initialized) return Promise.resolve()
  if (!_initPromise) _initPromise = _init()
  return _initPromise
}

export function storeGet(key: string): string | null {
  return cache.get(key) ?? null
}

export function storeSet(key: string, value: string): void {
  cache.set(key, value)
  // Espelha imediatamente: a UI e os exportadores enxergam a mesma versao antes
  // mesmo do commit assincrono do plugin-store terminar.
  if (typeof window !== "undefined") {
    try { localStorage.setItem(key, value) } catch { /* plugin-store continua sendo a fonte */ }
  }
  _dispatch(key)
  // O plugin-store usa um unico arquivo. Gravacoes paralelas de save, motor e
  // autosave podiam chamar store.save() ao mesmo tempo e deixar o arquivo com um
  // snapshot antigo. Serializar todas as mutacoes torna o commit deterministico.
  const operation = writeQueue.then(() => _writeAsync(key, value))
  writeQueue = operation.catch(() => undefined)
  pendingOperations.add(operation)
  void operation.finally(() => pendingOperations.delete(operation))
}

export function storeRemove(key: string): void {
  cache.delete(key)
  if (typeof window !== "undefined") {
    try { localStorage.removeItem(key) } catch { /* ignora */ }
  }
  _dispatch(key)
  const operation = writeQueue.then(() => _deleteAsync(key))
  writeQueue = operation.catch(() => undefined)
  pendingOperations.add(operation)
  void operation.finally(() => pendingOperations.delete(operation))
}

/** Aguarda todas as gravacoes iniciadas antes de uma navegacao com reload completo. */
export async function flushPersistentStore(): Promise<void> {
  while (pendingOperations.size > 0) {
    await Promise.allSettled([...pendingOperations])
  }
}

async function _writeAsync(key: string, value: string): Promise<void> {
  if (typeof window === "undefined") return
  try {
    if (_isTauri()) {
      const store = await _getStore()
      await store.set(key, value)
      await store.save()
    } else {
      localStorage.setItem(key, value)
    }
  } catch (e) {
    console.warn("[persistent-store] write failed:", e)
  }
}

// Storage compativel com o middleware `persist` do zustand, backed pelo
// persistent-store (sobrevive a reinstalacoes). getItem e async de proposito: o
// zustand aguarda a carga do disco antes de hidratar, evitando que a store inicie
// vazia (elenco/tabela em branco) logo apos abrir o app.
export function createTauriZustandStorage() {
  const resolveName = (name: string): string => {
    if (name !== "ultrafoot-game-engine") return name
    const careerId = storeGet("ultrafoot:active-career")
    return careerId ? `${name}:${careerId}` : name
  }
  return {
    getItem: async (name: string): Promise<string | null> => {
      await initPersistentStore()
      const resolvedName = resolveName(name)
      let value = storeGet(resolvedName)
      // Migra o motor unico das builds antigas para a carreira ativa. A copia e
      // feita uma vez e o legado permanece como recuperacao de emergencia.
      if (value == null && resolvedName !== name) {
        const legacy = storeGet(name)
        if (legacy != null) {
          storeSet(resolvedName, legacy)
          value = legacy
        }
      }
      // Migra dado legado que so exista no localStorage da webview (saves de versoes
      // que nao sobreviviam a reinstalacao). Uma unica vez: passa a viver no store.
      if (value == null && typeof window !== "undefined" && window.localStorage) {
        const legacy = window.localStorage.getItem(resolvedName) ?? window.localStorage.getItem(name)
        if (legacy != null) {
          storeSet(resolvedName, legacy)
          value = legacy
        }
      }
      return value
    },
    setItem: (name: string, value: string): void => storeSet(resolveName(name), value),
    removeItem: (name: string): void => storeRemove(resolveName(name)),
  }
}

async function _deleteAsync(key: string): Promise<void> {
  if (typeof window === "undefined") return
  try {
    if (_isTauri()) {
      const store = await _getStore()
      await store.delete(key)
      await store.save()
    } else {
      localStorage.removeItem(key)
    }
  } catch (e) {
    console.warn("[persistent-store] delete failed:", e)
  }
}

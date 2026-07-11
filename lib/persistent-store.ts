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
        if (typeof v === "string") cache.set(k, v)
      }
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
  _dispatch(key)
  void _writeAsync(key, value)
}

export function storeRemove(key: string): void {
  cache.delete(key)
  _dispatch(key)
  void _deleteAsync(key)
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
  return {
    getItem: async (name: string): Promise<string | null> => {
      await initPersistentStore()
      let value = storeGet(name)
      // Migra dado legado que so exista no localStorage da webview (saves de versoes
      // que nao sobreviviam a reinstalacao). Uma unica vez: passa a viver no store.
      if (value == null && typeof window !== "undefined" && window.localStorage) {
        const legacy = window.localStorage.getItem(name)
        if (legacy != null) {
          storeSet(name, legacy)
          value = legacy
        }
      }
      return value
    },
    setItem: (name: string, value: string): void => storeSet(name, value),
    removeItem: (name: string): void => storeRemove(name),
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

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
/**
 * ⚠️ QUANTAS MUTAÇÕES AINDA ESTÃO NA FILA (1.0.346).
 *
 * `store.set()` é barato: mexe na memória do plugin. Quem custa é `store.save()`,
 * que **reescreve o arquivo inteiro** — medido nesta máquina: 217 ms de
 * serialização mais 50 MB de disco, por chamada.
 *
 * E `saveGameState` não faz uma gravação: faz de cinco a oito seguidas (save,
 * backup, índice de carreiras, retratos, universo). Uma por uma, cada autosave
 * reescrevia o arquivo todo várias vezes — segundos de disco enquanto o jogador
 * clica. Este contador deixa as intermediárias apenas `set()` e guarda o
 * `save()` para a ÚLTIMA da fila: um commit por rajada, não por chave.
 *
 * O que NÃO muda: a fila continua serializada (era o que impedia snapshot
 * antigo), o cache já respondeu à UI de forma síncrona, e `flushPersistentStore`
 * espera a fila drenar — logo o commit final sempre acontece antes de um reload.
 */
let mutacoesEnfileiradas = 0
/** Arquivos com `set`/`delete` ainda não commitados. Ver `_commitDosArquivosSujos`. */
const arquivosSujos = new Set<TauriStore>()
let _initialized = false
let _initPromise: Promise<void> | null = null
let _tauriStore: TauriStore | null = null
let _universeStore: TauriStore | null = null

// O localStorage e apenas um espelho de compatibilidade. Nunca duplicamos nele
// blobs/base64 nem valores grandes: isso fazia a WebView manter outra copia de
// centenas de MB na memoria e no disco durante o boot.
const MAX_LOCAL_MIRROR_LENGTH = 512 * 1024

function _mirrorToLocalStorage(key: string, value: string): void {
  if (typeof window === "undefined") return
  try {
    const isHeavy = value.length > MAX_LOCAL_MIRROR_LENGTH || value.includes("data:image/")
    if (_isTauri() && isHeavy) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Quota/privacidade: o plugin-store e o cache continuam sendo a fonte.
  }
}

function _isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== "undefined"
  )
}

/**
 * ⚠️ O UNIVERSO MORA EM ARQUIVO PRÓPRIO (1.0.346).
 *
 * `store.save()` reescreve o arquivo INTEIRO. Enquanto o universo da carreira
 * (~42 MB) dividia arquivo com o resto, cada troca de configuração e cada
 * autosave arrastava esses 42 MB junto — medido nesta máquina: 50 MB e 217 ms
 * de serialização por commit, contra 7,5 MB e 31 ms sem ele.
 *
 * É a mesma jogada que `lib/banco-de-imagens` fez com os escudos em 11/08: o
 * inquilino grande sai do JSON que é reescrito o tempo todo. A diferença é que
 * aqui ele continua sendo um plugin-store, carregado para o MESMO cache no
 * boot — então `storeGet`/`storeKeys` seguem síncronos e nenhuma tela muda.
 *
 * Se este arquivo sumir ou corromper, nada se perde de verdade: o universo é
 * reconstruível pela semeadura (~1,8 s). Ver `lerUniverso` em lib/save-system.
 */
/** A mesma chave de `save-system`, repetida aqui para não criar ciclo. */
const CHAVE_CARREIRA_ATIVA = "ultrafoot:active-career"
const ARQUIVO_PRINCIPAL = "ultrafoot-clubs.json"
const ARQUIVO_DO_UNIVERSO = "ultrafoot-universo.json"
const PREFIXO_UNIVERSO = "ultrafoot:universo:"

function ehChaveDeUniverso(key: string): boolean {
  return key.startsWith(PREFIXO_UNIVERSO)
}

async function _carregarArquivo(nome: string): Promise<TauriStore> {
  const { load } = await import("@tauri-apps/plugin-store")
  return (await load(nome, { autoSave: false } as Parameters<typeof load>[1])) as TauriStore
}

async function _getStore(): Promise<TauriStore> {
  if (!_tauriStore) _tauriStore = await _carregarArquivo(ARQUIVO_PRINCIPAL)
  return _tauriStore
}

async function _getStoreDoUniverso(): Promise<TauriStore> {
  if (!_universeStore) _universeStore = await _carregarArquivo(ARQUIVO_DO_UNIVERSO)
  return _universeStore
}

/** O arquivo a que a chave pertence. É o único ponto que decide isso. */
async function _getStoreDaChave(key: string): Promise<TauriStore> {
  return ehChaveDeUniverso(key) ? _getStoreDoUniverso() : _getStore()
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

/** Lê `ultrafoot-universo.json` para o cache comum. Falhar aqui não é fatal:
 *  sem universo em cache a carreira apenas ressemeia (~1,8 s). */
async function _carregarUniversoParaOCache(): Promise<void> {
  try {
    const store = await _getStoreDoUniverso()
    for (const [k, v] of await store.entries<string>()) {
      // O espelho no localStorage fica de fora de propósito: são dezenas de MB,
      // exatamente o que `MAX_LOCAL_MIRROR_LENGTH` existe para manter fora dele.
      if (typeof v === "string") cache.set(k, v)
    }
  } catch (e) {
    console.warn("[persistent-store] universo indisponivel, sera ressemeado:", e)
  }
}

/**
 * Migração de casa, uma vez por máquina: universo que ainda esteja no arquivo
 * principal é copiado para o dele e removido de lá.
 *
 * ⚠️ A ORDEM IMPORTA. Grava e faz commit no arquivo NOVO antes de apagar do
 * antigo. Se a energia cair no meio, o pior caso é o universo existir nos dois
 * — e não em nenhum.
 */
async function _mudarUniversoDeArquivo(principal: TauriStore): Promise<void> {
  const doArquivoAntigo = [...cache.keys()].filter(ehChaveDeUniverso)
    .filter(k => !!cache.get(k))
  if (doArquivoAntigo.length === 0) return
  try {
    const universo = await _getStoreDoUniverso()
    let mudou = 0
    for (const k of doArquivoAntigo) {
      if (!(await principal.has(k))) continue // ja mora no arquivo novo
      await universo.set(k, cache.get(k) as string)
      mudou++
    }
    if (mudou === 0) return
    await universo.save()
    for (const k of doArquivoAntigo) await principal.delete(k)
    await principal.save()
    console.info(`[persistent-store] ${mudou} universo(s) movidos para ${ARQUIVO_DO_UNIVERSO}`)
  } catch (e) {
    console.warn("[persistent-store] mudanca do universo de arquivo falhou:", e)
  }
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
          _mirrorToLocalStorage(k, v)
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

      // O universo vem do arquivo dele para o MESMO cache — por isso storeGet
      // continua síncrono e nenhuma tela precisou mudar.
      // ⚠️ SEM CARREIRA ABERTA, O UNIVERSO NÃO ENTRA NA MEMÓRIA (1.0.356).
      //
      // Medido nesta máquina: o arquivo do universo tem 42,3 MB e custa
      // **158 MB de heap** — 85 MB só para segurar o texto e mais 74 MB depois
      // do `JSON.parse` — além de ~300 ms. E como toda navegação do jogo é
      // recarga completa, isso se paga a cada troca de tela.
      //
      // Na splash, no menu principal e nas telas de online não há carreira
      // aberta e ninguém lê o universo: carregá-lo ali é gastar 158 MB de RAM
      // numa máquina modesta para não usar nada. É o caminho mais provável de um
      // "out of memory" logo na abertura, que é justamente onde ele mais dói.
      //
      // Com carreira aberta ele continua vindo — quem joga precisa do mundo.
      if (cache.get(CHAVE_CARREIRA_ATIVA)) {
        await _carregarUniversoParaOCache()
      }
      // E o que ficou no arquivo antigo muda de casa agora. Sem este passo, o
      // arquivo principal continuaria carregando os 42 MB que o tornam caro de
      // reescrever, e a separação só valeria para carreira nova.
      await _mudarUniversoDeArquivo(store)
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

/**
 * Chamada no momento em que a mutação SAI da fila. Se outra já entrou atrás
 * dela, esta não precisa tocar o disco — a de trás vai reescrever o arquivo
 * inteiro de qualquer jeito, com este valor já dentro.
 */
function ehAUltimaDaFila(): boolean {
  mutacoesEnfileiradas = Math.max(0, mutacoesEnfileiradas - 1)
  return mutacoesEnfileiradas === 0
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
    _mirrorToLocalStorage(key, value)
  }
  _dispatch(key)
  // O plugin-store usa um unico arquivo. Gravacoes paralelas de save, motor e
  // autosave podiam chamar store.save() ao mesmo tempo e deixar o arquivo com um
  // snapshot antigo. Serializar todas as mutacoes torna o commit deterministico.
  mutacoesEnfileiradas++
  const operation = writeQueue.then(() => _writeAsync(key, value, ehAUltimaDaFila()))
  writeQueue = operation.catch(() => undefined)
  pendingOperations.add(operation)
  void operation.finally(() => pendingOperations.delete(operation))
}

/**
 * Grava VÁRIAS chaves com UM commit no disco.
 *
 * `storeSet` chama `store.save()` a cada chave, e `save()` reescreve o arquivo
 * inteiro. Para uma gravação isolada tudo bem; para um lote é quadrático — a
 * migração de imagens toca ~3.500 chaves, e uma por uma seriam 3.500 reescritas
 * de um arquivo que chegou a 245 MB. Aqui as chaves entram todas e o disco é
 * tocado uma vez só, no fim.
 */
export function storeSetMany(entries: Iterable<[string, string]>): Promise<void> {
  const lista = [...entries]
  if (lista.length === 0) return Promise.resolve()

  for (const [key, value] of lista) {
    cache.set(key, value)
    if (typeof window !== "undefined") {
      _mirrorToLocalStorage(key, value)
    }
    _dispatch(key)
  }

  const operation = writeQueue.then(async () => {
    if (typeof window === "undefined") return
    try {
      if (_isTauri()) {
        for (const [key, value] of lista) {
          const store = await _getStoreDaChave(key)
          await store.set(key, value)
          arquivosSujos.add(store)
        }
        await _commitDosArquivosSujos()
      } else {
        for (const [key, value] of lista) localStorage.setItem(key, value)
      }
    } catch (e) {
      console.warn("[persistent-store] gravacao em lote falhou:", e)
    }
  })
  writeQueue = operation.catch(() => undefined)
  pendingOperations.add(operation)
  void operation.finally(() => pendingOperations.delete(operation))
  return operation
}

/** Todas as chaves `ultrafoot:` conhecidas pelo cache (já vindas do disco). */
export function storeKeys(): string[] {
  return [...cache.keys()]
}

export function storeRemove(key: string): void {
  cache.delete(key)
  if (typeof window !== "undefined") {
    try { localStorage.removeItem(key) } catch { /* ignora */ }
  }
  _dispatch(key)
  mutacoesEnfileiradas++
  const operation = writeQueue.then(() => _deleteAsync(key, ehAUltimaDaFila()))
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

async function _writeAsync(key: string, value: string, commit: boolean): Promise<void> {
  if (typeof window === "undefined") return
  try {
    if (_isTauri()) {
      const store = await _getStoreDaChave(key)
      await store.set(key, value)
      arquivosSujos.add(store)
      if (commit) await _commitDosArquivosSujos()
    } else {
      localStorage.setItem(key, value)
    }
  } catch (e) {
    console.warn("[persistent-store] write failed:", e)
  }
}

/**
 * ⚠️ COMMITA TODOS OS ARQUIVOS TOCADOS, não só o da última chave.
 *
 * Com dois arquivos, "a última da fila salva" deixaria um buraco: uma rajada que
 * grava o save (arquivo principal) e depois o universo (arquivo dele) terminaria
 * commitando só o segundo, e o save ficaria na memória do plugin até alguém
 * mexer no principal de novo. Aqui a rajada inteira vai ao disco de uma vez.
 */
async function _commitDosArquivosSujos(): Promise<void> {
  const arquivos = [...arquivosSujos]
  arquivosSujos.clear()
  for (const store of arquivos) await store.save()
}

// Storage compativel com o middleware `persist` do zustand, backed pelo
// persistent-store (sobrevive a reinstalacoes). getItem e async de proposito: o
// zustand aguarda a carga do disco antes de hidratar, evitando que a store inicie
// vazia (elenco/tabela em branco) logo apos abrir o app.
const MOTOR = "ultrafoot-game-engine"
/** Onde o motor vai parar quando NÃO há carreira ativa. Nunca a chave nua. */
export const MOTOR_SEM_CARREIRA = `${MOTOR}:__sem-carreira`
/** Marca qual carreira já consumiu o motor legado (pré-carreiras). */
const MOTOR_LEGADO_CONSUMIDO = `${MOTOR}:__legado-consumido-por`

export function createTauriZustandStorage() {
  /**
   * ⚠️ SEM CARREIRA ATIVA, O MOTOR VAI PARA A QUARENTENA — nunca para a chave nua.
   *
   * Este `: name` era a origem de UM SAVE INVADINDO OUTRO. A chave nua
   * `ultrafoot-game-engine` é COMPARTILHADA por todas as carreiras, e há janelas
   * reais sem carreira ativa: o boot antes de hidratar, a splash, e logo depois
   * de apagar uma carreira (o `active-career` é removido). Tudo que o motor
   * gravasse nessas janelas — elenco, caixa, táticas — ficava num balde comum.
   */
  const resolveName = (name: string): string => {
    if (name !== MOTOR) return name
    const careerId = storeGet("ultrafoot:active-career")
    return careerId ? `${name}:${careerId}` : MOTOR_SEM_CARREIRA
  }
  return {
    getItem: async (name: string): Promise<string | null> => {
      await initPersistentStore()
      const resolvedName = resolveName(name)
      let value = storeGet(resolvedName)
      // ⚠️ A MIGRAÇÃO DO MOTOR LEGADO VALE PARA UMA CARREIRA SÓ.
      //
      // Ela existe para o save das builds antigas (motor único, antes de haver
      // carreiras) não se perder. Mas sem a trava abaixo ela disparava para
      // TODA carreira nova: carreira criada = motor ainda vazio = o adaptador
      // copiava o balde comum para dentro dela. O jogador criava uma carreira do
      // zero e encontrava o elenco, o caixa e a tática de outra.
      //
      // A marca diz qual carreira já herdou. A segunda em diante começa vazia,
      // como tem de começar. O legado fica no disco como recuperação.
      if (value == null && resolvedName !== name && resolvedName !== MOTOR_SEM_CARREIRA) {
        const jaConsumido = storeGet(MOTOR_LEGADO_CONSUMIDO)
        if (!jaConsumido || jaConsumido === resolvedName) {
          const legacy = storeGet(name)
          if (legacy != null) {
            storeSet(resolvedName, legacy)
            storeSet(MOTOR_LEGADO_CONSUMIDO, resolvedName)
            value = legacy
          }
        }
      }
      // Migra dado legado que so exista no localStorage da webview (saves de versoes
      // que nao sobreviviam a reinstalacao). Uma unica vez: passa a viver no store.
      //
      // ⚠️ Mesma trava: sem ela, o `?? window.localStorage.getItem(name)` reabria
      // exatamente o mesmo caminho de contaminação por outra porta.
      if (value == null && typeof window !== "undefined" && window.localStorage) {
        const podeHerdarLegado = resolvedName !== MOTOR_SEM_CARREIRA
          && (storeGet(MOTOR_LEGADO_CONSUMIDO) ?? resolvedName) === resolvedName
        const legacy = window.localStorage.getItem(resolvedName)
          ?? (podeHerdarLegado ? window.localStorage.getItem(name) : null)
        if (legacy != null) {
          storeSet(resolvedName, legacy)
          if (name === MOTOR && podeHerdarLegado) storeSet(MOTOR_LEGADO_CONSUMIDO, resolvedName)
          value = legacy
        }
      }
      return value
    },
    setItem: (name: string, value: string): void => storeSet(resolveName(name), value),
    removeItem: (name: string): void => storeRemove(resolveName(name)),
  }
}

async function _deleteAsync(key: string, commit: boolean): Promise<void> {
  if (typeof window === "undefined") return
  try {
    if (_isTauri()) {
      const store = await _getStoreDaChave(key)
      await store.delete(key)
      arquivosSujos.add(store)
      if (commit) await _commitDosArquivosSujos()
    } else {
      localStorage.removeItem(key)
    }
  } catch (e) {
    console.warn("[persistent-store] delete failed:", e)
  }
}

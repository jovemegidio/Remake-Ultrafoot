class MemoryStorage {
  private data = new Map<string, string>()
  get length() { return this.data.size }
  key(index: number) { return [...this.data.keys()][index] ?? null }
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.data.set(key, String(value)) }
  removeItem(key: string) { this.data.delete(key) }
}

const localStorage = new MemoryStorage()
const eventTarget = new EventTarget()
Object.assign(globalThis, {
  localStorage,
  window: {
    localStorage,
    addEventListener: eventTarget.addEventListener.bind(eventTarget),
    removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
    dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
    setTimeout,
    clearTimeout,
  },
})

async function main() {
const save = await import("../lib/save-system")
const store = await import("../lib/persistent-store")
await store.initPersistentStore()

const careerA = save.createCareerId()
save.setActiveCareerId(careerA)
save.saveGameState({ ...save.DEFAULT_STATE, careerId: careerA, selectedTeamShort: "INT", managerName: "A", week: 12, createdAt: 1 })
store.storeSet(save.getCareerScopedKey("ultrafoot-game-engine"), "engine-A")
await store.flushPersistentStore()

const careerB = save.createCareerId()
save.setActiveCareerId(careerB)
save.saveGameState({ ...save.DEFAULT_STATE, careerId: careerB, selectedTeamShort: "FLA", managerName: "B", week: 3, createdAt: 2 })
store.storeSet(save.getCareerScopedKey("ultrafoot-game-engine"), "engine-B")
await store.flushPersistentStore()

if (!save.activateCareerSave(careerA)) throw new Error("Nao ativou carreira A")
const loadedA = save.loadGameState()
if (loadedA.managerName !== "A" || loadedA.week !== 12 || loadedA.selectedTeamShort !== "INT") throw new Error("Carreira A contaminada")
if (store.storeGet(save.getCareerScopedKey("ultrafoot-game-engine")) !== "engine-A") throw new Error("Motor A contaminado")

if (!save.activateCareerSave(careerB)) throw new Error("Nao ativou carreira B")
const loadedB = save.loadGameState()
if (loadedB.managerName !== "B" || loadedB.week !== 3 || loadedB.selectedTeamShort !== "FLA") throw new Error("Carreira B contaminada")
if (store.storeGet(save.getCareerScopedKey("ultrafoot-game-engine")) !== "engine-B") throw new Error("Motor B contaminado")

if (save.listCareerSaves().length !== 2) throw new Error("Indice nao preservou os dois saves")

// Uma tela antiga ainda pode disparar um save em microtask depois que o jogador
// ja abriu outro slot. Essa gravacao nunca pode reativar nem alterar A.
save.saveGameState({ ...loadedA, careerId: careerA, managerName: "A atrasado", week: 99 })
if (save.getActiveCareerId() !== careerB) throw new Error("Gravacao atrasada reativou o save A")
const depoisDoAtrasado = save.loadGameState()
if (depoisDoAtrasado.managerName !== "B" || depoisDoAtrasado.week !== 3) {
  throw new Error("Gravacao atrasada do save A contaminou o save B")
}

console.log("OK saves: duas carreiras, motores, progresso e gravacoes atrasadas isolados")
}

void main()
export {}

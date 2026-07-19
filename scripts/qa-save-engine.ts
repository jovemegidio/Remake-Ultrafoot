import { DEFAULT_STATE } from "../lib/save-system"
import { deleteSlot, exportSave, importSave, listSlots, loadSlot, migrate, saveSlot } from "../lib/save-engine"
import { storeGet, storeSet } from "../lib/persistent-store"

const state = migrate({
  ...DEFAULT_STATE,
  managerName: "QA Save",
  selectedTeamShort: "FLA",
  selectedTeam: {
    nome: "Flamengo", curto: "FLA", cor1: "#f00", cor2: "#000",
    prestigio: 90, saldo: 100, divisao: "serie_a", pais: "Brasil", fileKey: "flarj", estadio: "Maracanã",
  },
  season: 2031,
  week: 17,
})

deleteSlot("slot1")
saveSlot("slot1", state)
const first = loadSlot("slot1")
if (!first || first.managerName !== "QA Save" || first.season !== 2031) throw new Error("slot não persistiu")

saveSlot("slot1", { ...state, week: 18 })
storeSet("ultrafoot:save-slot:slot1", "{corrompido")
const recovered = loadSlot("slot1")
if (!recovered || recovered.week !== 17) throw new Error("backup não recuperou save corrompido")

// Duas gerações: mesmo com primário e backup danificados, a campanha anterior
// precisa continuar disponível.
saveSlot("slot1", { ...state, week: 19 })
saveSlot("slot1", { ...state, week: 20 })
storeSet("ultrafoot:save-slot:slot1", "{interrompido")
storeSet("ultrafoot:save-slot:slot1:backup", "{corrompido")
const deepRecovered = loadSlot("slot1")
if (!deepRecovered || deepRecovered.week !== 17) throw new Error("segundo backup não recuperou campanha")

// Simula encerramento entre a escrita do staging e o commit.
saveSlot("slot2", { ...state, managerName: "Carreira B", selectedTeamShort: "PAL", week: 7 })
const staged = storeGet("ultrafoot:save-slot:slot2")
if (!staged) throw new Error("staging de teste ausente")
storeSet("ultrafoot:save-slot:slot2:staging", staged)
storeSet("ultrafoot:save-slot:slot2", "{processo encerrado")
const interrupted = loadSlot("slot2")
if (!interrupted || interrupted.managerName !== "Carreira B" || interrupted.week !== 7) throw new Error("gravação interrompida não foi recuperada")

// Carreiras distintas não podem compartilhar clube/elenco por estado residual.
const slot1 = loadSlot("slot1")
const slot2 = loadSlot("slot2")
if (!slot1 || !slot2 || slot1.selectedTeamShort === slot2.selectedTeamShort) throw new Error("isolamento entre carreiras falhou")

const imported = importSave(exportSave({ ...state, version: 2 as never }))
if (imported.version !== DEFAULT_STATE.version || imported.coachSkills.length === 0) throw new Error("migração falhou")
const exportedPayload = exportSave(state)
if (/data:image|kits-imported|\/jogadores\//i.test(exportedPayload)) throw new Error("asset global vazou para o save da carreira")
const legacy = importSave(JSON.stringify({ season: 2027, week: -4, managerName: "Legado", version: 1 }))
if (legacy.version !== DEFAULT_STATE.version || legacy.week !== 0 || !Array.isArray(legacy.pendingNationalOffers)) throw new Error("migração de save legado incompleto falhou")
if (!listSlots().some(slot => slot.id === "slot1")) throw new Error("metadados do slot ausentes")
deleteSlot("slot1")
deleteSlot("slot2")

console.log("OK saves: slots, checksum, backup, importação e migração")

// GERA UM SAVE DE VERDADE para os harnesses de navegador.
//
// ⚠️ POR QUE ISTO PRECISOU EXISTIR.
//
// O `perf-avancar.mjs` injetava um objeto de cinco campos como "save":
//
//     { version: 8, careerId: "perf", selectedTeamShort: "FLARJ", ... }
//
// Isso não é uma carreira. O jogo abria com a tela vazia (quatro botões), o
// `advanceWeek` saía na primeira guarda e o harness reportava "0 ms travado" —
// medindo o nada e parecendo um resultado ótimo. Foi a medição mais perigosa
// desta auditoria, porque um falso "está tudo bem" encerra a investigação.
//
// Aqui o save sai do PRÓPRIO MOTOR: inicializa a carreira, avança algumas
// semanas para que existam calendário, resultados, finanças e elenco com
// história, e despeja o armazenamento inteiro num arquivo. O harness então
// planta esse armazenamento no `localStorage` antes de a página carregar, e o
// jogo abre numa carreira real.
//
// Uso:
//   node --import tsx scripts/perf-gerar-save.ts [semanas] [arquivo.json]
import { writeFileSync } from "node:fs"
import { storeKeys, storeGet, storeSet } from "../lib/persistent-store"

const SEMANAS = Number(process.argv[2] ?? 12)
const DESTINO = process.argv[3] ?? "scripts/fixtures/save-perf.json"

async function principal(): Promise<void> {
  // A carreira ativa precisa existir ANTES de o motor gravar: sem ela o
  // adaptador manda o estado para a quarentena (`MOTOR_SEM_CARREIRA`) e o save
  // gerado não seria o de uma carreira de verdade. Ver persistent-store.
  storeSet("ultrafoot:active-career", "perf")

  const { useGameEngine } = await import("../lib/game-engine")
  useGameEngine.getState().initializeGame("BGT")
  for (let i = 0; i < SEMANAS; i++) useGameEngine.getState().advanceWeek()

  // ⚠️ A CHAVE DA CARREIRA TEM DE SER ESCRITA À MÃO AQUI.
  //
  // `saveGameState` (e `loadGameState`) retornam cedo quando não há `window`,
  // que é o caso em Node. Sem esta gravação sai só o estado do MOTOR, e a
  // interface abre sem carreira — foi assim que o harness antigo acabou medindo
  // uma tela vazia. O formato é o mesmo que `saveGameState` produz; as guardas
  // que estou contornando são sobre trocar de slot, não sobre o formato.
  const { DEFAULT_STATE } = await import("../lib/save-system")
  const agora = Date.now()
  const estadoDaCarreira = {
    ...DEFAULT_STATE,
    careerId: "perf",
    saveName: "Medição de performance",
    selectedTeamShort: "BGT",
    managerName: "Perf",
    season: useGameEngine.getState().currentSeason,
    week: useGameEngine.getState().currentWeek,
    createdAt: agora,
    updatedAt: agora,
  }
  storeSet("ultrafoot:save:perf", JSON.stringify(estadoDaCarreira))

  const dados: Record<string, string> = {}
  for (const chave of storeKeys()) {
    const valor = storeGet(chave)
    if (valor !== null) dados[chave] = valor
  }

  const bytes = Object.values(dados).reduce((t, v) => t + v.length, 0)
  writeFileSync(DESTINO, JSON.stringify(dados), "utf8")
  console.log(`save gerado: ${Object.keys(dados).length} chaves, ${(bytes / 1048576).toFixed(1)} MB -> ${DESTINO}`)
  const motor = Object.keys(dados).find(k => k.startsWith("ultrafoot-game-engine"))
  console.log(`  chave do motor: ${motor ?? "(NENHUMA — o save não serve)"}`)
  const elenco = motor ? (JSON.parse(dados[motor]).state?.squadPlayers?.length ?? 0) : 0
  console.log(`  atletas no elenco: ${elenco}`)
  if (!motor || elenco === 0) {
    console.error("FALHA: o save saiu vazio; medir com ele repetiria o erro que este script existe para corrigir.")
    process.exit(1)
  }
}

void principal()

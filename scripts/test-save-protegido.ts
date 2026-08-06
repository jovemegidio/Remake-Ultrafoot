/**
 * O SAVE NÃO PODE SER PERDIDO NUMA ATUALIZAÇÃO.
 *
 * Cobre as três camadas de lib/save-system.ts (ver o comentário lá):
 *
 *  1. retrato do save antes da primeira gravação de uma versão nova;
 *  2. recusa da gravação que apagaria uma carreira em andamento;
 *  3. save de versão desconhecida carrega em vez de virar "não há save".
 *
 * Roda sem React e sem Tauri: o persistent-store cai no localStorage, então aqui
 * montamos um `window`/`localStorage` de mentira antes de importar o módulo.
 */

// ── ambiente de navegador mínimo (tem de vir ANTES do import do save-system) ──
// ⚠️ `export {}` marca este arquivo como MODULO. Sem ele o tsc trata todo script
// sem import/export no topo como global, e `falhas`/`ok` colidem com os mesmos
// nomes de outros scripts de teste ("Cannot redeclare block-scoped variable").
export {}

const memoria = new Map<string, string>()
const localStorageFalso = {
  get length() { return memoria.size },
  key: (i: number) => Array.from(memoria.keys())[i] ?? null,
  getItem: (k: string) => memoria.get(k) ?? null,
  setItem: (k: string, v: string) => { memoria.set(k, String(v)) },
  removeItem: (k: string) => { memoria.delete(k) },
  clear: () => memoria.clear(),
}
const g = globalThis as unknown as Record<string, unknown>
g.localStorage = localStorageFalso
g.window = {
  localStorage: localStorageFalso,
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
  setTimeout: (fn: () => void) => { fn(); return 0 },
}
g.CustomEvent = class { constructor(public type: string, public init?: unknown) {} }

// Import ESTATICO so funciona porque o ambiente acima e montado no topo do
// modulo, antes de qualquer import ser avaliado? Nao: os imports sobem. Por isso
// o modulo e carregado por `require` — depois do `window` de mentira existir.
// (tsx compila este arquivo para CJS, entao top-level await nao esta disponivel.)
/* eslint-disable @typescript-eslint/no-require-imports */
const {
  saveGameState, loadGameState, setActiveCareerId,
  temRetratoPreAtualizacao, restaurarRetratoPreAtualizacao,
} = require("../lib/save-system") as typeof import("../lib/save-system")
// ⚠️ LER/ESCREVER PELO STORE, NUNCA pelo localStorage direto.
//
// O persistent-store mantem um CACHE em memoria e `storeGet` le dele — escrever
// so no localStorage nao muda o que o jogo enxerga. A primeira versao deste teste
// fazia isso e "reprovava" o carregamento de save desconhecido por um motivo que
// nao existia no jogo: o valor plantado nunca chegava a ser lido.
const { storeGet, storeSet } = require("../lib/persistent-store") as typeof import("../lib/persistent-store")

let falhas = 0
const ok = (nome: string, condicao: boolean, detalhe = "") => {
  console.log(`${condicao ? "OK  " : "FALHA"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`)
  if (!condicao) falhas++
}

const CARREIRA = "career-teste"
const CHAVE = `ultrafoot:save:${CARREIRA}`
type Save = ReturnType<typeof loadGameState>

/** Carreira em andamento: clube, semana avançada e histórico. */
function carreiraEmAndamento(): Save {
  return {
    ...loadGameState(),
    careerId: CARREIRA,
    selectedTeamShort: "FLA",
    managerName: "Tecnico",
    saveName: "Carreira principal",
    season: 2028,
    week: 30,
    preOfficeVisitado: true,
    seasonHistory: [{ season: 2027 }] as unknown as Save["seasonHistory"],
  } as Save
}

setActiveCareerId(CARREIRA)

// ── CAMADA 1: retrato da versão anterior ────────────────────────────────────
//
// O cenario REAL e: a carreira ja existia em disco, gravada por uma versao
// anterior do jogo, e agora a versao nova grava pela primeira vez. Plantamos o
// save e a MARCA DE VERSAO antiga direto no store para simular exatamente isso —
// uma carreira criada agora nao tem nada "de antes" para guardar, e e correto que
// ela nao gere retrato.
storeSet(CHAVE, JSON.stringify(carreiraEmAndamento()))
storeSet(`${CHAVE}:versao`, "1.0.100-antiga")
ok("a carreira da versao anterior esta em disco", loadGameState().week === 30,
  `semana ${loadGameState().week}`)
ok("ainda nao ha retrato (nada foi gravado por esta versao)", !temRetratoPreAtualizacao(CARREIRA))

// A versao nova grava pela primeira vez: e AQUI que o retrato nasce.
saveGameState({ ...carreiraEmAndamento(), week: 44 })
ok("o jogo seguiu", loadGameState().week === 44, `semana ${loadGameState().week}`)
ok("a primeira gravacao da versao nova criou o retrato", temRetratoPreAtualizacao(CARREIRA))

// Jogar mais NAO pode substituir o retrato pela partida de hoje.
saveGameState({ ...carreiraEmAndamento(), week: 48 })
const retratoBruto = storeGet(`${CHAVE}:pre-atualizacao`)
ok("o retrato continua sendo o de ANTES (semana 30, nao 44/48)",
  Boolean(retratoBruto) && JSON.parse(retratoBruto!).week === 30,
  `retrato na semana ${retratoBruto ? JSON.parse(retratoBruto).week : "?"}`)

// ── CAMADA 2: gravacao que apagaria a carreira ──────────────────────────────
const estadoZerado = {
  ...loadGameState(),
  careerId: CARREIRA,
  selectedTeamShort: null,
  season: 2026,
  week: 0,
  seasonHistory: [],
  passagens: [],
  squadPlayers: [],
} as unknown as Save
saveGameState(estadoZerado)
ok("gravacao vazia NAO apaga a carreira em andamento", loadGameState().week === 48,
  `semana apos a tentativa: ${loadGameState().week}`)

// Pedir demissao (clube zerado, mas com passagem registrada) TEM de gravar.
const aposDemissao = {
  ...loadGameState(),
  selectedTeamShort: null,
  passagens: [{ teamCurto: "FLA", teamNome: "Flamengo", endReason: "resigned", season: 2028, week: 44 }],
} as unknown as Save
saveGameState(aposDemissao)
ok("pedir demissao continua gravando (nao e falso positivo)",
  loadGameState().selectedTeamShort === null && (loadGameState().passagens?.length ?? 0) === 1)

// ── CAMADA 3: save de versao desconhecida ───────────────────────────────────
const doFuturo = { ...JSON.parse(storeGet(CHAVE)!), version: 999, week: 51 }
storeSet(CHAVE, JSON.stringify(doFuturo))
storeSet(`${CHAVE}:backup`, JSON.stringify(doFuturo))
const carregado = loadGameState()
ok("save de versao desconhecida CARREGA em vez de sumir", carregado.week === 51,
  `semana lida: ${carregado.week}`)
ok("e mantem o clube/nome da carreira", carregado.saveName === "Carreira principal")

// ── restaurar o retrato ─────────────────────────────────────────────────────
ok("da para restaurar o retrato pre-atualizacao", restaurarRetratoPreAtualizacao(CARREIRA))
ok("o save voltou ao estado de antes da atualizacao", loadGameState().week === 30,
  `semana apos restaurar: ${loadGameState().week}`)
ok("o retrato e consumido (nao restaura duas vezes)", !temRetratoPreAtualizacao(CARREIRA))

console.log(`\nRESULTADO: ${falhas === 0 ? "TUDO OK" : `${falhas} FALHA(S)`}`)
process.exit(falhas === 0 ? 0 : 1)

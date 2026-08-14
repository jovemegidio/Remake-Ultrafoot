// PASSAR O COMPUTADOR SEM VAZAR DADO ENTRE TÉCNICOS.
//
// O teste que importa aqui é o ÚLTIMO: ele lê o estado real de
// `lib/game-engine.ts` e reprova se existir campo que ninguém classificou como
// "do clube" ou "do mundo".
//
// Por que isso e não outra coisa: o motor cresce toda versão. Um campo novo de
// CLUBE que fique fora da lista não é trocado ao passar a vez — e o técnico que
// entra vê o dado do anterior. Não dá erro, não aparece em log, e vira um jogo
// incoerente que ninguém liga à causa. Uma lista escrita à mão envelhece em
// silêncio; esta não pode.
//
//   npx tsx scripts/test-chaveamento-de-tecnico.ts

export {}

let falhas = 0
function check(nome: string, cond: boolean, detalhe = "") {
  if (!cond) falhas++
  console.log(`${cond ? "  ok  " : " FALHA"} ${nome}${cond ? "" : ` — ${detalhe}`}`)
}

async function main() {
  const {
    CAMPOS_DO_CLUBE, CAMPOS_DO_MUNDO,
    guardarEstadoDoClube, restaurarEstadoDoClube, camposFaltandoNoBolso, guardarEstadoDoMundo,
    CAMPOS_DE_SAVE_DO_TECNICO, CAMPOS_DE_SAVE_DO_MUNDO, CAMPOS_DE_SAVE_DA_LIGA,
    guardarSaveDoTecnico, restaurarSaveDoTecnico,
    CAMPOS_DO_TEMPO, CAMPOS_DA_LIGA, guardarEstadoDoTempo, guardarEstadoDaLiga, chaveDaLiga,
  } = await import("../lib/chaveamento-de-tecnico")
  const { readFileSync } = await import("node:fs")

  console.log("\nGuardar e devolver o bolso do tecnico\n")

  // Estado de mentira com um campo de cada lado.
  const estadoGustavo: Record<string, unknown> = {}
  for (const c of CAMPOS_DO_CLUBE) estadoGustavo[c] = `cruzeiro:${c}`
  for (const m of CAMPOS_DO_MUNDO) estadoGustavo[m] = `mundo:${m}`

  const bolso = guardarEstadoDoClube(estadoGustavo)

  check("o bolso leva TODOS os campos do clube",
    camposFaltandoNoBolso(bolso).length === 0,
    camposFaltandoNoBolso(bolso).join(", "))
  check("e NENHUM campo do mundo",
    CAMPOS_DO_MUNDO.every(m => !(m in bolso)),
    CAMPOS_DO_MUNDO.filter(m => m in bolso).join(", "))
  check("o elenco entra no bolso", bolso.squadPlayers === "cruzeiro:squadPlayers")
  check("o caixa entra no bolso", bolso.balance === "cruzeiro:balance")
  check("a rodada NAO entra", !("currentWeek" in bolso))
  check("a tabela do Brasileirao NAO entra", !("serieAStandings" in bolso))

  console.log("\nTecnico novo nao herda a tela do anterior\n")

  const bolsos = { gustavo: bolso }
  check("quem ja tem bolso recebe o dele",
    restaurarEstadoDoClube(bolsos, "gustavo")?.squadPlayers === "cruzeiro:squadPlayers")
  check("quem NUNCA sentou recebe null (quem chama tem de montar do mundo)",
    restaurarEstadoDoClube(bolsos, "joao") === null)
  check("sem bolso nenhum tambem devolve null",
    restaurarEstadoDoClube(undefined, "gustavo") === null)

  console.log("\nBolso incompleto e denunciado\n")

  const incompleto = { ...bolso }
  delete incompleto.balance
  check("faltar o caixa e detectado",
    camposFaltandoNoBolso(incompleto).includes("balance"))

  console.log("\nGuardar o mundo para devolver depois do initializeGame\n")

  // ⚠️ Este é o passo que impede o modo de mandar todos de volta à rodada zero:
  // `initializeGame` zera semana, temporada, resultados e tabela, e é ele que
  // carrega o clube de um técnico que nunca sentou.
  const mundo = guardarEstadoDoMundo(estadoGustavo)
  check("o mundo leva a rodada e a temporada",
    mundo.currentWeek === "mundo:currentWeek" && mundo.currentSeason === "mundo:currentSeason")
  check("e a tabela e os resultados",
    mundo.serieAStandings === "mundo:serieAStandings" && mundo.matchResults === "mundo:matchResults")
  check("e NENHUM campo de clube",
    CAMPOS_DO_CLUBE.every(c => !(c in mundo)),
    CAMPOS_DO_CLUBE.filter(c => c in mundo).join(", "))

  console.log("\nAs duas listas nao se sobrepoem\n")

  const naDuas = CAMPOS_DO_CLUBE.filter(c => (CAMPOS_DO_MUNDO as readonly string[]).includes(c))
  check("nenhum campo esta nas duas listas", naDuas.length === 0, naDuas.join(", "))

  console.log("\n⚠️ A GUARDA QUE IMPORTA: campo novo do motor precisa ser classificado\n")

  const fonte = readFileSync("lib/game-engine.ts", "utf-8")
  const i = fonte.indexOf("interface GameEngineState")
  const j = fonte.indexOf("\n}", i)
  const bloco = fonte.slice(i, j)
  // Campos de DADO: os que não são funções (ação do store).
  const todos = [...bloco.matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9_]*)\??:\s/gm)].map(m => m[1])
  const acoes = [...bloco.matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9_]*)\??:\s*\(/gm)].map(m => m[1])
  const dados = todos.filter(c => !acoes.includes(c))

  check("achou o estado do motor para conferir", dados.length > 20, `${dados.length} campos`)

  const classificados = new Set<string>([...CAMPOS_DO_CLUBE, ...CAMPOS_DO_MUNDO])
  const naoClassificados = dados.filter(c => !classificados.has(c))
  check(
    "todo campo do motor esta classificado como do CLUBE ou do MUNDO",
    naoClassificados.length === 0,
    `sem classificacao: ${naoClassificados.join(", ")} — decida em lib/chaveamento-de-tecnico.ts`,
  )

  const fantasmas = [...classificados].filter(c => !dados.includes(c))
  check(
    "nenhuma lista cita campo que o motor nao tem mais",
    fantasmas.length === 0,
    `sobrando: ${fantasmas.join(", ")}`,
  )

  console.log("\nO tempo e a liga sao donos DIFERENTES\n")

  // ⚠️ Este bloco cobre a correcao da 1.0.304: a tabela nao e do mundo, e da
  // LIGA. Um tecnico da Premier League nao pode receber a tabela do Brasileirao
  // do vizinho de mesa.
  const tempo = guardarEstadoDoTempo(estadoGustavo)
  const liga = guardarEstadoDaLiga(estadoGustavo)

  check("a rodada e a temporada sao do TEMPO",
    tempo.currentWeek === "mundo:currentWeek" && tempo.currentSeason === "mundo:currentSeason")
  check("a tabela NAO e do tempo", !("serieAStandings" in tempo))
  check("a tabela, a artilharia e a copa sao da LIGA",
    liga.serieAStandings === "mundo:serieAStandings"
    && liga.topScorers === "mundo:topScorers"
    && liga.copaBrasil === "mundo:copaBrasil")
  check("a rodada NAO e da liga", !("currentWeek" in liga))

  const tempoELiga = CAMPOS_DO_TEMPO.filter(c => (CAMPOS_DA_LIGA as readonly string[]).includes(c))
  check("nenhum campo e do tempo E da liga", tempoELiga.length === 0, tempoELiga.join(", "))
  check("tempo + liga cobrem o antigo CAMPOS_DO_MUNDO",
    CAMPOS_DO_MUNDO.every(c => (CAMPOS_DO_TEMPO as readonly string[]).includes(c)
      || (CAMPOS_DA_LIGA as readonly string[]).includes(c)))

  check("dois tecnicos do MESMO campeonato caem na mesma chave de liga",
    chaveDaLiga("Brasil", "serie_a") === chaveDaLiga("brasil", "SERIE_A"))
  check("campeonatos diferentes NAO se misturam",
    chaveDaLiga("Brasil", "serie_a") !== chaveDaLiga("Inglaterra", "premier_league"))
  check("divisao homonima de outro pais nao colide",
    chaveDaLiga("Brasil", "serie_a") !== chaveDaLiga("Italia", "serie_a"))

  // ─── A OUTRA METADE: O SAVE ────────────────────────────────────────────────
  //
  // Trocar só o motor deixava o segundo tecnico com o elenco dele e o
  // CALENDARIO do primeiro. As duas listas do save precisam da mesma guarda.

  console.log("\nGuardar e devolver a carreira do tecnico (o save)\n")

  const saveFalso: Record<string, unknown> = {}
  for (const c of CAMPOS_DE_SAVE_DO_TECNICO) saveFalso[c] = `carreira:${c}`
  for (const m of CAMPOS_DE_SAVE_DO_MUNDO) saveFalso[m] = `mesa:${m}`
  for (const l of CAMPOS_DE_SAVE_DA_LIGA) saveFalso[l] = `liga:${l}`

  const bolsoSave = guardarSaveDoTecnico(saveFalso)

  check("o calendario da carreira entra no bolso",
    bolsoSave.fixtures === "carreira:fixtures")
  check("a tabela NAO entra no bolso do tecnico (ela e da liga)",
    !("standings" in bolsoSave))
  check("a liga e a divisao entram no bolso",
    bolsoSave.leagueTeams === "carreira:leagueTeams"
    && bolsoSave.divisionOverride === "carreira:divisionOverride")
  check("o clube e o nome de quem joga entram no bolso",
    bolsoSave.selectedTeamShort === "carreira:selectedTeamShort"
    && bolsoSave.managerName === "carreira:managerName")
  check("a semana e a temporada NAO entram (o tempo e um so)",
    !("week" in bolsoSave) && !("season" in bolsoSave))
  check("o universo da CPU NAO entra (o mundo e um so)",
    !("universo286" in bolsoSave))
  check("a lista de tecnicos NAO entra (senao a mesa se perderia na troca)",
    !("tecnicos" in bolsoSave) && !("rodadaCompartilhada" in bolsoSave))

  check("quem ja jogou recebe a carreira dele",
    restaurarSaveDoTecnico({ joao: bolsoSave }, "joao")?.fixtures === "carreira:fixtures")
  check("quem NUNCA sentou recebe null (a carreira dele precisa NASCER)",
    restaurarSaveDoTecnico({ joao: bolsoSave }, "pedro") === null)

  // Campo opcional ausente nao pode virar `undefined` gravado: restaurar
  // apagaria do save de quem entra algo que ele nunca teve.
  const parcial = guardarSaveDoTecnico({ fixtures: [1], standings: undefined })
  check("campo ausente nao vira undefined no bolso",
    "fixtures" in parcial && !("standings" in parcial))

  const naDuasNoSave = CAMPOS_DE_SAVE_DO_TECNICO
    .filter(c => (CAMPOS_DE_SAVE_DO_MUNDO as readonly string[]).includes(c))
  check("nenhum campo do save esta nas duas listas", naDuasNoSave.length === 0, naDuasNoSave.join(", "))

  console.log("\n⚠️ A GUARDA QUE IMPORTA (save): campo novo do save precisa ser classificado\n")

  const fonteSave = readFileSync("lib/save-system.ts", "utf-8")
  const inicio = fonteSave.indexOf("export interface GameState {")
  check("achou a GameState para conferir", inicio >= 0)
  // Varre casando chaves: a interface tem objetos aninhados, e cortar no
  // primeiro "\n}" pegaria só o começo dela.
  let profundidade = 0
  let fim = inicio
  for (let k = fonteSave.indexOf("{", inicio); k < fonteSave.length; k++) {
    if (fonteSave[k] === "{") profundidade++
    else if (fonteSave[k] === "}") { profundidade--; if (profundidade === 0) { fim = k; break } }
  }
  // Só o nível de cima: campo dentro de objeto aninhado não é campo do save.
  const corpo = fonteSave.slice(fonteSave.indexOf("{", inicio) + 1, fim)
  let raso = ""
  let nivel = 0
  for (const ch of corpo) {
    if (ch === "{") { nivel++; continue }
    if (ch === "}") { nivel--; continue }
    if (nivel === 0) raso += ch
  }
  const camposDoSave = [...new Set(
    [...raso.matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9_]*)\??\s*:/gm)].map(m => m[1]),
  )]

  check("achou os campos do save", camposDoSave.length > 80, `${camposDoSave.length} campos`)

  const classificadosNoSave = new Set<string>([
    ...CAMPOS_DE_SAVE_DO_TECNICO, ...CAMPOS_DE_SAVE_DO_MUNDO, ...CAMPOS_DE_SAVE_DA_LIGA,
  ])
  const semClasse = camposDoSave.filter(c => !classificadosNoSave.has(c))
  check(
    "todo campo do save esta classificado como do TECNICO ou do MUNDO",
    semClasse.length === 0,
    `sem classificacao: ${semClasse.join(", ")} — decida em lib/chaveamento-de-tecnico.ts`,
  )

  // `saveDoTecnico` é o bolso em si: ele é citado na lista do mundo de
  // propósito (para nunca ser trocado) e pode não estar declarado ainda.
  const bolsosDoProprioModo = new Set(["saveDoTecnico", "estadoPorLiga"])
  const fantasmasNoSave = [...classificadosNoSave]
    .filter(c => !bolsosDoProprioModo.has(c) && !camposDoSave.includes(c))
  check(
    "nenhuma lista do save cita campo que a GameState nao tem mais",
    fantasmasNoSave.length === 0,
    `sobrando: ${fantasmasNoSave.join(", ")}`,
  )

  console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM\n" : `\n${falhas} FALHA(S)\n`)
  process.exit(falhas === 0 ? 0 : 1)
}

void main()

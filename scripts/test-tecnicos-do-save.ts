// MULTITÉCNICO NO MESMO MUNDO — as invariantes que não podem quebrar.
//
// O modo só faz sentido se três coisas forem verdade ao mesmo tempo:
//   1. UM CLUBE POR TÉCNICO. Dois humanos no mesmo clube é um mundo incoerente
//      — dois titulares e dois caixas no mesmo registro. Barrar na criação é a
//      única hora barata.
//   2. A RODADA NÃO ANDA sem todos fecharem. Se andar, alguém perde a rodada sem
//      ter escalado — e isso não dá erro, só um resultado ruim inexplicável.
//   3. SAVE ANTIGO CONTINUA CARREIRA NORMAL. Todo save existente tem um técnico
//      só nos campos singulares; ler isso errado quebraria todas as carreiras.
//
//   npx tsx scripts/test-tecnicos-do-save.ts

import {
  avancarFase,
  desmarcarPronto,
  ehDuploHumano,
  ehMultitecnico,
  faltamFechar,
  iniciarRodada,
  marcarPronto,
  MAXIMO_DE_TECNICOS,
  podeAvancar,
  proximoAJogar,
  tecnicoDoClube,
  tecnicosDoSave,
  validarTecnicos,
  type TecnicoDoSave,
} from "../lib/tecnicos-do-save"

let falhas = 0
function check(nome: string, cond: boolean, detalhe = "") {
  if (!cond) falhas++
  console.log(`${cond ? "  ok  " : " FALHA"} ${nome}${cond ? "" : ` — ${detalhe}`}`)
}

const humano = (id: string, nome: string, clube: string | null): TecnicoDoSave =>
  ({ id, nome, clubeCurto: clube, tipo: "humano" })

// A mesa do exemplo: quatro pessoas, quatro clubes, mesmo universo.
const mesa = [
  humano("t1", "Gustavo", "CRU"),
  humano("t2", "João", "FLA"),
  humano("t3", "Pedro", "PAL"),
  humano("t4", "Lucas", "GRE"),
]

console.log("\nUm clube por tecnico\n")

check("mesa valida passa", validarTecnicos(mesa).length === 0,
  JSON.stringify(validarTecnicos(mesa)))
check("dois tecnicos no MESMO clube e rejeitado",
  validarTecnicos([...mesa, humano("t5", "Ana", "FLA")]).some(e => e.campo === "clube"))
check("nome repetido e rejeitado (na mesa ninguem sabe de quem e a vez)",
  validarTecnicos([...mesa, humano("t5", "joão", "SAO")]).some(e => e.campo === "nome"))
check("nome vazio e rejeitado",
  validarTecnicos([humano("t1", "   ", "CRU")]).some(e => e.campo === "nome"))
check(`acima de ${MAXIMO_DE_TECNICOS} e rejeitado`,
  validarTecnicos(Array.from({ length: MAXIMO_DE_TECNICOS + 1 }, (_, i) =>
    humano(`t${i}`, `Tecnico ${i}`, `C${i}`))).some(e => e.campo === "quantidade"))
check(`exatamente ${MAXIMO_DE_TECNICOS} passa`,
  validarTecnicos(Array.from({ length: MAXIMO_DE_TECNICOS }, (_, i) =>
    humano(`t${i}`, `Tecnico ${i}`, `C${i}`))).length === 0)
check("tecnico desempregado (sem clube) nao conflita com outro sem clube",
  validarTecnicos([humano("t1", "A", null), humano("t2", "B", null)]).length === 0)

console.log("\nQuem controla o que\n")

check("acha o dono do clube", tecnicoDoClube(mesa, "PAL")?.nome === "Pedro")
check("clube da maquina nao tem dono", tecnicoDoClube(mesa, "SAN") === null)
check("clube nulo nao tem dono", tecnicoDoClube(mesa, null) === null)
check("Cruzeiro x Flamengo e humano contra humano", ehDuploHumano(mesa, "CRU", "FLA"))
check("Cruzeiro x Santos NAO e", ehDuploHumano(mesa, "CRU", "SAN") === false)

// ─── HOMONIMOS (1.0.304) ─────────────────────────────────────────────────────
//
// ⚠️ Desde que cada tecnico escolhe o PAIS dele, `curto` deixou de bastar: 134
// codigos se repetem no banco. Sem o `file_key`, dois clubes diferentes seriam
// tratados como um so — a mesa valida seria barrada, e um adversario da CPU
// seria confundido com o clube de quem esta na mesa.

console.log("\nClubes homonimos de paises diferentes\n")

const comArquivo = (id: string, nome: string, curto: string, fileKey: string): TecnicoDoSave =>
  ({ id, nome, clubeCurto: curto, clubeFileKey: fileKey, tipo: "humano" })

const mesaComHomonimos = [
  comArquivo("t1", "Gustavo", "AME", "america_mineiro_bra"),
  comArquivo("t2", "João", "AME", "america_de_cali_col"),
]
check("dois clubes DIFERENTES de mesmo `curto` formam mesa valida",
  validarTecnicos(mesaComHomonimos).length === 0,
  JSON.stringify(validarTecnicos(mesaComHomonimos)))
check("o MESMO clube (mesmo file_key) continua sendo rejeitado",
  validarTecnicos([
    comArquivo("t1", "Gustavo", "AME", "america_mineiro_bra"),
    comArquivo("t2", "João", "AME", "america_mineiro_bra"),
  ]).some(e => e.campo === "clube"))

check("com file_key, acha o tecnico certo entre homonimos",
  tecnicoDoClube(mesaComHomonimos, "AME", "america_de_cali_col")?.nome === "João")
check("file_key de clube da CPU nao casa com nenhum tecnico",
  tecnicoDoClube(mesaComHomonimos, "AME", "america_rn_bra") === null)
check("sem file_key na busca, o `curto` ainda resolve (saves da 1.0.302)",
  tecnicoDoClube(mesa, "PAL")?.nome === "Pedro")
check("tecnico de save antigo (sem file_key) ainda e achado por file_key novo",
  tecnicoDoClube(mesa, "PAL", "palmeiras_bra")?.nome === "Pedro")

console.log("\nA rodada so anda quando todos fecham\n")

let rodada = iniciarRodada(10)
check("comeca aguardando", rodada.fase === "aguardando_tecnicos" && rodada.numero === 10)
check("ninguem pronto: nao avanca", podeAvancar(rodada, mesa) === false)
check("o primeiro da fila e o primeiro que falta",
  proximoAJogar(rodada, mesa)?.nome === "Gustavo")

rodada = marcarPronto(rodada, "t1")
rodada = marcarPronto(rodada, "t2")
check("dois prontos: ainda nao avanca", podeAvancar(rodada, mesa) === false)
check("faltam dois", faltamFechar(rodada, mesa).length === 2)
check("agora a vez e do Pedro", proximoAJogar(rodada, mesa)?.nome === "Pedro")

check("avancar fase com gente faltando devolve a MESMA rodada",
  avancarFase(rodada, mesa) === rodada)

rodada = marcarPronto(rodada, "t1")
check("marcar duas vezes nao duplica", rodada.prontos.filter(id => id === "t1").length === 1)

rodada = marcarPronto(rodada, "t3")
rodada = marcarPronto(rodada, "t4")
check("todos prontos: pode avancar", podeAvancar(rodada, mesa))
check("nao falta mais ninguem", proximoAJogar(rodada, mesa) === null)

console.log("\nDesmarcar volta a travar\n")

const voltou = desmarcarPronto(rodada, "t3")
check("quem voltou a mexer no time trava a rodada de novo",
  podeAvancar(voltou, mesa) === false)
check("e ele e o proximo da fila", proximoAJogar(voltou, mesa)?.nome === "Pedro")

console.log("\nCiclo da rodada\n")

const processando = avancarFase(rodada, mesa)
check("aguardando -> processando", processando.fase === "processando")
const pos = avancarFase(processando, mesa)
check("processando -> pos_rodada", pos.fase === "pos_rodada")
const proxima = avancarFase(pos, mesa)
check("pos_rodada -> proxima rodada, aguardando de novo",
  proxima.numero === 11 && proxima.fase === "aguardando_tecnicos")
check("a nova rodada comeca com ninguem pronto", proxima.prontos.length === 0)

console.log("\nSave antigo continua carreira normal\n")

const antigo = tecnicosDoSave(undefined, "Zeca", "COR")
check("save de um tecnico vira lista de um", antigo.length === 1)
check("com o nome e o clube que ele ja tinha",
  antigo[0].nome === "Zeca" && antigo[0].clubeCurto === "COR")
check("e NAO e multitecnico", ehMultitecnico(antigo) === false)
check("save sem nome nao fica sem tecnico",
  tecnicosDoSave(undefined, "", null)[0].nome === "Técnico")
check("save novo com lista usa a lista", tecnicosDoSave(mesa, "Zeca", "COR").length === 4)
check("quatro tecnicos e multitecnico", ehMultitecnico(mesa))

console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM\n" : `\n${falhas} FALHA(S)\n`)
process.exit(falhas === 0 ? 0 : 1)

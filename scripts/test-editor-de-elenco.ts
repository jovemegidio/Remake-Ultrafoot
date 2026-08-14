/**
 * EDITOR DE ELENCO — criar, excluir e transferir atletas (1.0.299).
 *
 * Duas camadas, e a segunda e a que importa:
 *
 *  1. o modulo puro (`aplicarPatch`, `validarElenco`);
 *  2. a CONSEQUENCIA no elenco que o jogo monta — `getPlayersForTeam`. Foi
 *     nessa camada que a 1.0.293 descobriu um campo "implementado" que o motor
 *     lia por outro caminho e ignorava. Aqui o risco concreto e a calibracao:
 *     `calibrateSquadRatings` reescreve o overall de todo mundo, e um atleta
 *     criado com 90 sairia de la com 60 se nao fosse dispensado dela.
 */
import {
  aplicarPatch,
  semearElencosEditados,
  transferirAtleta,
  getRosterPatch,
  limparRosterPatch,
  normNome,
  type RosterPatch,
} from "../lib/roster-overrides"
import { validarElenco, elencoValido, ELENCO_CONFORTAVEL, ELENCO_INCHADO } from "../lib/validacao-de-elenco"
import { getPlayersForTeam } from "../lib/players-data"
import { allTeams } from "../lib/teams-data"

let falhas = 0
const ok = (nome: string, condicao: boolean, detalhe = "") => {
  console.log(`${condicao ? "OK  " : "FALHA"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`)
  if (!condicao) falhas++
}

// ─── 1. modulo puro ────────────────────────────────────────────────────────
type Simples = { nome: string; pos: string; idade: number; base: number; time: string }
const elenco = (nomes: string[]): Simples[] =>
  nomes.map(nome => ({ nome, pos: "MEI", idade: 25, base: 70, time: "Clube" }))

const tres = elenco(["Ana Souza", "Bruno Lima", "Carla Dias"])

ok("patch nulo devolve a lista intacta", aplicarPatch(null, tres, "Clube") === tres)
ok("patch vazio devolve a lista intacta", aplicarPatch({}, tres, "Clube") === tres)

const semBruno = aplicarPatch({ removidos: [normNome("Bruno Lima")] }, tres, "Clube")
ok("remocao tira o atleta", semBruno.length === 2 && !semBruno.some(p => p.nome === "Bruno Lima"))

// A chave e normalizada: acento, caixa e espaco nao podem decidir quem sai.
const comAcento = elenco(["João Grão"])
ok(
  "remocao ignora acento e caixa",
  aplicarPatch({ removidos: [normNome("joao grao")] }, comAcento, "Clube").length === 0,
)

const criado = aplicarPatch(
  { criados: [{ nome: "Gabriel Silva", pos: "ATA", idade: 19, base: 82, nac: "Brasil" }] },
  tres,
  "Clube",
)
ok("criacao acrescenta o atleta", criado.length === 4)
const novo = criado.find(p => p.nome === "Gabriel Silva")!
ok("o atleta criado nasce no clube certo", novo.time === "Clube")
ok("o overall digitado chega inteiro", novo.base === 82)
ok(
  "o atleta criado e marcado como do editor",
  (novo as unknown as { generatedOrigin?: string }).generatedOrigin === "editor",
)

ok(
  "criar alguem que ja existe nao duplica",
  aplicarPatch({ criados: [{ nome: "Ana Souza", pos: "ATA", idade: 20, base: 88 }] }, tres, "Clube").length === 3,
)

// Remover e criar o MESMO nome no mesmo patch: o removido vence a criacao, senao
// o "removido" reapareceria a cada abertura do jogo pela camada de baixo.
const conflito: RosterPatch = {
  criados: [{ nome: "Ana Souza", pos: "ATA", idade: 20, base: 88 }],
  removidos: [normNome("Ana Souza")],
}
ok("remocao vence criacao do mesmo nome", !aplicarPatch(conflito, tres, "Clube").some(p => p.nome === "Ana Souza"))

// ─── 2. validacao de plantel ───────────────────────────────────────────────
const posicoes = (lista: string[]) => lista.map(pos => ({ pos }))
const plantelOk = posicoes([
  "GOL", "GOL", "GOL", "ZAG", "ZAG", "ZAG", "ZAG", "LD", "LE", "VOL", "VOL",
  "MEI", "MEI", "MEI", "PD", "PE", "ATA", "ATA",
])
ok("plantel completo nao acusa erro", elencoValido(plantelOk))
ok("plantel completo nao acusa alerta", validarElenco(plantelOk).length === 0, JSON.stringify(validarElenco(plantelOk)))

const semGoleiro = posicoes(Array.from({ length: 20 }, () => "MEI"))
ok("sem goleiro e ERRO", validarElenco(semGoleiro).some(p => p.nivel === "erro" && p.mensagem.includes("goleiro")))
ok("sem goleiro reprova o clube", !elencoValido(semGoleiro))

const dezDeLinha = posicoes(["GOL", ...Array.from({ length: 10 }, () => "MEI")])
ok("dez de linha e ERRO", !elencoValido(dezDeLinha))
const onzeDeLinha = posicoes(["GOL", ...Array.from({ length: 11 }, () => "MEI")])
ok("onze de linha ja passa", elencoValido(onzeDeLinha))
ok(
  "mas onze de linha ainda avisa que o elenco e curto",
  validarElenco(onzeDeLinha).some(p => p.nivel === "alerta" && p.mensagem.includes("curto")),
)
ok(
  "um goleiro so vira alerta (nao erro)",
  validarElenco(onzeDeLinha).some(p => p.nivel === "alerta" && p.mensagem.includes("goleiro")),
)
ok(
  "elenco inchado avisa",
  validarElenco(posicoes(["GOL", "GOL", ...Array.from({ length: ELENCO_INCHADO }, () => "MEI")]))
    .some(p => p.nivel === "alerta" && p.mensagem.includes("inchado")),
)
ok("o piso confortavel e o mesmo do motor", ELENCO_CONFORTAVEL === 18)
// Elenco vazio: erro, mas sem o alerta de "curto" em cima — dois avisos para o
// mesmo buraco so atrapalham quem le.
ok("elenco vazio nao empilha alerta de curto", !validarElenco([]).some(p => p.mensagem.includes("curto")))

// ─── 3. consequencia no elenco montado pelo jogo ───────────────────────────
const time = allTeams.find(t => t.file_key)!
const antes = getPlayersForTeam(time)
ok("o clube de teste tem elenco", antes.length > 0, `${time.nome}: ${antes.length}`)

const alvo = antes.find(p => p.pos !== "GOL")!
semearElencosEditados({
  [time.file_key]: {
    criados: [{ nome: "Zeca Editorial", pos: "ATA", idade: 21, base: 90 }],
    removidos: [normNome(alvo.nome)],
  },
})
const depois = getPlayersForTeam(time)
const zeca = depois.find(p => p.nome === "Zeca Editorial")

ok("o atleta criado aparece no elenco do jogo", Boolean(zeca))
ok(
  "e sobrevive a calibracao com o overall digitado",
  zeca?.base === 90,
  `base=${zeca?.base ?? "ausente"} (${time.nome}, ${time.divisao})`,
)
ok("o atleta removido some do elenco", !depois.some(p => p.nome === alvo.nome), `removido: ${alvo.nome}`)
// O preenchimento automatico entra DEPOIS da edicao — o clube continua jogavel
// mesmo que a pessoa apague meio elenco.
ok("o clube continua com plantel jogavel", elencoValido(depois), `${depois.length} atletas`)

// O modo `raw` e o que o editor consome: precisa enxergar a mesma edicao.
const cru = getPlayersForTeam(time, { raw: true })
ok("o editor (modo raw) tambem enxerga a criacao", cru.some(p => p.nome === "Zeca Editorial"))
ok("o editor (modo raw) tambem enxerga a remocao", !cru.some(p => p.nome === alvo.nome))

const outro = allTeams.find(t => t.file_key && t.file_key !== time.file_key)!
semearElencosEditados(null)
ok("sem semente, o clube volta ao cadastro original", getPlayersForTeam(time).length === antes.length)
ok("e o clube vizinho nunca foi afetado", getPlayersForTeam(outro).length > 0)

// ─── 4. transferencia: os DOIS lados ───────────────────────────────────────
// Aqui a API completa e exercitada de verdade (grava e le do armazenamento),
// nao so o nucleo puro.
const viajante = antes.find(p => p.pos !== "GOL" && p.nome !== alvo.nome)!
const ficha = { nome: viajante.nome, pos: viajante.pos, idade: viajante.idade, base: viajante.base }
ok("a transferencia e aceita", transferirAtleta(time.file_key, outro.file_key, ficha))
ok("o atleta sai do clube de origem", !getPlayersForTeam(time).some(p => p.nome === viajante.nome))
ok("e aparece no clube de destino", getPlayersForTeam(outro).some(p => p.nome === viajante.nome))
ok(
  "o destino registra de onde ele veio",
  getRosterPatch(outro.file_key)?.criados?.some(a => a.origem === time.file_key) === true,
)
ok("transferir para o proprio clube e recusado", !transferirAtleta(time.file_key, time.file_key, ficha))

// ⚠️ O CASO QUE QUASE PASSOU: atleta RENOMEADO no editor. O elenco do clube
// guarda o nome do cadastro; a tela mostra o editado. Transferir pelo nome novo
// nao removeria ninguem da origem e ele ficaria nos DOIS clubes.
const renomeado = getPlayersForTeam(time).find(p => p.pos !== "GOL")!
const terceiro = allTeams.find(t => t.file_key && ![time.file_key, outro.file_key].includes(t.file_key))!
transferirAtleta(
  time.file_key,
  terceiro.file_key,
  { nome: "Apelido Novo", pos: renomeado.pos, idade: renomeado.idade, base: renomeado.base },
  renomeado.nome, // ← nome ORIGINAL
)
ok(
  "atleta renomeado sai mesmo assim da origem",
  !getPlayersForTeam(time).some(p => p.nome === renomeado.nome),
  `original: ${renomeado.nome}`,
)
ok("e chega ao destino com o nome novo", getPlayersForTeam(terceiro).some(p => p.nome === "Apelido Novo"))

limparRosterPatch(time.file_key)
limparRosterPatch(outro.file_key)
limparRosterPatch(terceiro.file_key)
ok("limpar devolve o clube ao cadastro original", getPlayersForTeam(time).length === antes.length)

console.log(falhas === 0 ? "\nTUDO OK" : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)

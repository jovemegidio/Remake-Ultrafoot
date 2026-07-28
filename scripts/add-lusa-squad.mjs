// Cadastra o elenco da PORTUGUESA (Associacao Portuguesa de Desportos / SP) e
// corrige o estado do clube.
//
// DOIS DEFEITOS QUE ISTO RESOLVE:
//
// 1) A Lusa jogava com atletas VENEZUELANOS. getRealSquad() procura primeiro a
//    chave exata `${curto}|${nome}` — `PRT|portuguesa`, que nao existia — e cai
//    no indice por NOME. Havia tres clubes "portuguesa" no seed, todos com o
//    codigo PORTUGUE: `portuguesa santista`, `portuguesa rj` e `portuguesa`.
//    Como os nomes normalizados sao distintos, nenhum e descartado como
//    duplicado, e `portuguesa` casa com o clube da Venezuela (Juan Reyes,
//    Moises Acuna...). Gravar a chave exata tira o clube desse fallback.
//
// 2) O clube estava com estado "ES". A Lusa e de SAO PAULO e esta na lista
//    oficial do Paulistao A1 2026; com a UF errada ela ficava fora do pool do
//    estadual montado por getStateChampionshipTeams.
//
// ORIGEM DOS DADOS: nomes, posicoes e idades vem do elenco real no Transfermarkt
// (clube 10247, temporada 2026). Os OVERALLS sao estimados — o Transfermarkt nao
// publica overall. A referencia usada foi o proprio seed: os clubes irmaos
// (`portuguesa rj`, `portuguesa santista`) estao com 66 achatado para todo o
// elenco, entao aqui usamos uma faixa estreita em torno desse mesmo patamar,
// variando por funcao e experiencia, em vez de um numero unico.
//
// Uso: node scripts/add-lusa-squad.mjs

import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const SQUADS = path.resolve("data/seeds/real-squads-tm.json")
const TEAMS = path.resolve("data/seeds/teams_br.json")
const CHAVE = "PRT|portuguesa"

// n=nome, p=posicao, i=idade, o=overall estimado, c=pais.
const ELENCO = [
  { n: "Bruno Bertinato",   p: "GOL", i: 28, o: 67 },
  { n: "João Paulo",        p: "GOL", i: 25, o: 64 },

  { n: "Eric Botteghin",    p: "ZAG", i: 38, o: 71 }, // ex-Feyenoord/Fluminense/Gremio
  { n: "Gustavo Henrique",  p: "ZAG", i: 26, o: 66 },
  { n: "Carlos Eduardo",    p: "ZAG", i: 25, o: 65 },
  { n: "Eduardo Biazus",    p: "ZAG", i: 25, o: 64 },
  { n: "Wellington",        p: "ZAG", i: 21, o: 62 },

  { n: "Gustavo Salomão",   p: "LE",  i: 29, o: 66 },
  { n: "Lucas Hipólito",    p: "LE",  i: 31, o: 65 },
  { n: "João Vitor",        p: "LD",  i: 24, o: 65 },
  { n: "Gustavo Sciencia",  p: "LD",  i: 22, o: 63 },

  { n: "Franco",            p: "VOL", i: 33, o: 67 },
  { n: "Matheus Cecchini",  p: "VOL", i: 23, o: 64 },
  { n: "Hudson",            p: "VOL", i: 25, o: 65 },

  { n: "Felipe Tontini",    p: "MEI", i: 31, o: 67 },
  { n: "Thiaguinho",        p: "MEI", i: 29, o: 66 },
  { n: "Denis",             p: "MEI", i: 22, o: 63 },
  { n: "Guilherme Portuga", p: "MEI", i: 28, o: 68 },

  { n: "Jonas Toró",        p: "PE",  i: 27, o: 69 }, // ex-Sao Paulo
  { n: "Everton",           p: "PE",  i: 24, o: 65 },
  { n: "Thiago Rubim",      p: "PE",  i: 27, o: 65 },
  { n: "Guilherme Henrique",p: "PE",  i: 19, o: 61 },

  { n: "João Diogo",        p: "PD",  i: 27, o: 66 },
  { n: "Guilherme Santos",  p: "PD",  i: 25, o: 64 },

  { n: "Cauari",            p: "ATA", i: 23, o: 65 },
  { n: "Igor Torres",       p: "ATA", i: 26, o: 67 },
  { n: "Matheus Cadorini",  p: "ATA", i: 23, o: 66 },
].map(j => ({ ...j, c: "Brasil" }))

const squads = JSON.parse(await readFile(SQUADS, "utf8"))
if (squads[CHAVE]) console.log(`aviso: ${CHAVE} ja existia com ${squads[CHAVE].length} atletas — sera substituido`)
squads[CHAVE] = ELENCO
await writeFile(SQUADS, `${JSON.stringify(squads)}\n`, "utf8")
console.log(`elenco gravado em ${CHAVE}: ${ELENCO.length} atletas`)

// ── UF do clube ──
const teamsRaw = JSON.parse(await readFile(TEAMS, "utf8"))
let corrigido = false
const corrigir = (t) => {
  if (t?.file_key === "portuguesa_bra" && t.estado !== "SP") {
    console.log(`estado de ${t.nome} (${t.file_key}): ${t.estado} -> SP`)
    t.estado = "SP"
    corrigido = true
  }
}
if (Array.isArray(teamsRaw)) teamsRaw.forEach(corrigir)
else for (const v of Object.values(teamsRaw)) (Array.isArray(v) ? v : [v]).forEach(corrigir)

if (corrigido) {
  await writeFile(TEAMS, `${JSON.stringify(teamsRaw)}\n`, "utf8")
  console.log("teams_br.json atualizado")
} else {
  console.log("estado ja estava correto (ou clube nao encontrado)")
}

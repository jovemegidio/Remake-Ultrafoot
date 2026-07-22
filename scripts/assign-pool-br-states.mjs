// Atribui ESTADO (UF) aos clubes brasileiros do pool (imported-bf2026.json), que vinham
// todos "sem estado" (liga generica "Serie A"). Assim o editor agrupa os clubes BR do pool
// por estado (como os curados) e da pra montar/preencher estaduais.
//
// Fonte do estado: (1) sufixo no nome ("-RJ", "MG", "PI"...), (2) mapa curado abaixo por
// conhecimento. Clubes que nao dao pra identificar com seguranca ficam sem estado (melhor
// vazio do que errado). Entradas de LIXO (nome de estadio) sao ignoradas.
//
// Uso: node scripts/assign-pool-br-states.mjs

import { readFile, writeFile } from "node:fs/promises"

const POOL = "data/seeds/imported-bf2026.json"

const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]

// Mapa curado: nome normalizado -> UF. So clubes que reconheco com confianca.
const CURATED = {
  madureira:"RJ", boavista:"RJ", americarj:"RJ", macae:"RJ", araruama:"RJ", americano:"RJ",
  friburguense:"RJ", cabofriense:"RJ", resende:"RJ", voltaredonda:"RJ",
  avenida:"RS", brasildepelotas:"RS", saojose:"RS", canoas:"RS", monsoonfc:"RS", guaranybage:"RS",
  novohamburgo:"RS", aimore:"RS", esportivo:"RS", pelotas:"RS", uniaors:"RS",
  abc:"RN", potyguar:"RN", potiguar:"RN", baraunas:"RN", forcaeluz:"RN", potiguardemossoro:"RN",
  ferroviario:"CE", icasa:"CE", pacajus:"CE", caucaia:"CE",
  gama:"DF", brasilia:"DF", samambaia:"DF", realbrasilia:"DF", brasiliense:"DF", paranoa:"DF", sobradinho:"DF",
  maranhao:"MA", motoclub:"MA", pinheiro:"MA", tuntum:"MA",
  noroeste:"SP", veloclube:"SP", aguasanta:"SP", osascosporting:"SP", saocaetano:"SP",
  mogimirim:"SP", portuguesasantista:"SP", capivariano:"SP", uniaobarbarense:"SP", saobento:"SP",
  caldense:"MG", ipatinga:"MG", boaesporte:"MG", democratasl:"MG", villanovamg:"MG", urt:"MG",
  betim:"MG", guaranimg:"MG",
  jaciaboa:"AL", jacioba:"AL", cse:"AL", asa:"AL", csa:"AL",
  rionegro:"AM", manaus:"AM", parintins:"AM", saoraimundoam:"AM",
  vitoriadaconquista:"BA", ipitanga:"BA", colocolo:"BA", jacuipense:"BA", atleticoalagoinhas:"BA",
  barcelonadeilheus:"BA", fluminensedefeira:"BA", itabuna:"BA",
  goianesia:"GO", morrinhos:"GO", inhumas:"GO", anapolis:"GO", crac:"GO", iporra:"GO", ipora:"GO",
  gremioanapolis:"GO", goiatuba:"GO", mineirosgo:"GO",
  ananindeua:"PA", castanhal:"PA", tapajos:"PA", aguiademaraba:"PA",
  azuriz:"PR", uniaobandeirante:"PR", iraty:"PR", romaapucarana:"PR", toledo:"PR",
  salgueiro:"PE", serranope:"PE", retro:"PE", afogados:"PE", central:"PE",
  dorense:"SE", pirambu:"SE", decisao:"SE", falconfc:"SE", americase:"SE",
  coxim:"MS", operariomss:"MS", operarioms:"MS", aguianegra:"MS",
  hercilioluz:"SC", atleticodeibirama:"SC", juventusjaragua:"SC", metropolitano:"SC",
  marciliodias:"SC", concordia:"SC",
  estreladonorte:"ES", cachoeiro:"ES", colatina:"ES", jaguare:"ES", realnoroeste:"ES",
  campinense:"PB", sousa:"PB", treze:"PB",
  riobranco:"AC", galvez:"AC",
  jiparana:"RO", genus:"RO",
  saoraimundorr:"RR", nauticorr:"RR",
  gurupi:"TO",
  riverpi:"PI", flamengopi:"PI",
}

// Clubes do pool que ficaram sem UF depois de a UF sair do campo `pais`. So
// entram nomes SEM homonimo conhecido — Botafogo (RJ/SP/PB), Guarani (SP/MG/CE),
// Portuguesa (SP/RJ), Palmeira, Ulbra e Santa Rosa ficam de fora de proposito:
// a trava de clubes homonimos ja custou caro nesta base.
const CURATED_POOL = {
  cruzeiro:"MG", rbbragantino:"SP", coritiba:"PR", chapecoense:"SC", internacional:"RS",
  crb:"AL", brusque:"SC", ceara:"CE", cuiaba:"MT", avai:"SC", criciuma:"SC",
  pontepreta:"SP", corinthians:"SP", saopaulo:"SP", parnahyba:"PI", naviraiense:"MS",
  manauara:"AM", amazoniaindependente:"AM", guapore:"RO", uniaocarmolandense:"TO",
}

// Aliases especificos p/ nomes com pontuacao no pool.
const NAME_UF = { "Porto - PE":"PE" }

function ufFromSuffix(nome) {
  // "-RJ", " RJ", " - PE", "-MG"
  const m = nome.match(/[-\s]([A-Z]{2})\s*$/)
  if (m && UFS.includes(m[1])) return m[1]
  return null
}

const isJunk = (nome) => /^est[aá]dio|^arena\b/i.test(nome)

async function main() {
  const data = JSON.parse(await readFile(POOL, "utf8"))
  const teams = data.teams || data
  let assigned = 0, junk = 0, unknown = []

  // PASSO 1 — a UF foi parar no campo `pais`. Sao 103 clubes com pais "AP",
  // "BA", "PE"... e estado vazio. Como a divisao do pool e derivada de `pais`
  // (`pool:<pais>`), eles apareciam no editor sob um "pais" chamado AP, fora do
  // Brasil e sem estado nenhum. Aqui a UF volta para o lugar dela.
  let realocados = 0
  for (const t of teams) {
    const paisAtual = String(t.pais || "").toUpperCase()
    // "BR" e o codigo do pais, nao uma UF: vira Brasil sem estado definido.
    if (paisAtual === "BR") { t.pais = "Brasil"; realocados++; continue }
    if (!UFS.includes(paisAtual)) continue
    if (!t.estado) t.estado = paisAtual
    t.pais = "Brasil"
    realocados++
  }

  // PASSO 2 — clubes ja marcados como Brasil que seguem sem UF: tenta o sufixo
  // do nome e o mapa curado.
  for (const t of teams) {
    if (!/brasil/i.test(t.pais || "")) continue
    if (t.estado) continue
    const nome = t.nome || ""
    if (isJunk(nome)) { junk++; continue }
    const uf = NAME_UF[nome] || ufFromSuffix(nome) || CURATED[norm(nome)] || CURATED_POOL[norm(nome)] || null
    if (uf) { t.estado = uf; assigned++ }
    else unknown.push(nome)
  }
  console.log(`UF movida de pais para estado: ${realocados}`)

  await writeFile(POOL, JSON.stringify(data), "utf8")
  console.log(`clubes BR com estado atribuido: ${assigned}`)
  console.log(`lixo ignorado (estadio): ${junk}`)
  console.log(`sem estado (nao identificado): ${unknown.length}`)
  console.log("  " + unknown.join(", "))
}

main().catch((e) => { console.error(e); process.exit(1) })

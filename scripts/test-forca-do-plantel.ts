// A MESMA RÉGUA PARA OS DOIS LADOS.
//
// O que este teste protege não é a fórmula em si — é o fato de ela ser ÚNICA.
// Com o multitécnico, o Flamengo do João precisa ser medido exatamente como o
// Cruzeiro do Gustavo. Se o adversário humano fosse medido pelo prestígio do
// clube (que era o comportamento antigo, herdado da CPU), o elenco que ele
// montou não teria efeito nenhum no placar.
//
//   npx tsx scripts/test-forca-do-plantel.ts

import {
  forcasDoPlantel, ladoAdversarioEmCampo, titularesAptos,
  type AtletaEmCampo, type PerfilDeCpu,
} from "../lib/forca-do-plantel"

let falhas = 0
function check(nome: string, cond: boolean, detalhe = "") {
  if (!cond) falhas++
  console.log(`${cond ? "  ok  " : " FALHA"} ${nome}${cond ? "" : ` — ${detalhe}`}`)
}

const atleta = (position: string, overall: number, extra: Partial<AtletaEmCampo> = {}): AtletaEmCampo =>
  ({ position, overall, isStarter: true, injury: null, form: 70, moralePoints: 55, ...extra })

// Um 4-3-3 neutro: forma 70 e moral 55 zeram o modificador.
const xiNeutro: AtletaEmCampo[] = [
  atleta("GOL", 70),
  atleta("LD", 70), atleta("ZAG", 70), atleta("ZAG", 70), atleta("LE", 70),
  atleta("VOL", 70), atleta("MEI", 70), atleta("MEI", 70),
  atleta("PD", 70), atleta("ATA", 70), atleta("PE", 70),
]

console.log("\nO basico\n")

const neutro = forcasDoPlantel(xiNeutro, 50)
check("time todo 70 da 70 em tudo",
  neutro.overall === 70 && neutro.attack === 70 && neutro.midfield === 70 && neutro.defense === 70,
  JSON.stringify(neutro))
check("forma 70 e moral 55 nao mexem no modificador", Math.abs(neutro.mod) < 1e-9, `${neutro.mod}`)

console.log("\nPlantel vazio cai no prestigio, nao em zero\n")

const vazio = forcasDoPlantel([], 62)
check("overall vira o prestigio informado", vazio.overall === 62, `${vazio.overall}`)
check("e os setores viram o neutro de 65, nao 0",
  vazio.attack === 65 && vazio.midfield === 65 && vazio.defense === 65,
  JSON.stringify(vazio))

console.log("\nO elenco IMPORTA — e este e o ponto do modo\n")

// O mesmo clube, dois elencos. Se a forca viesse do prestigio, os dois dariam
// igual — que era exatamente o defeito.
const xiForte = xiNeutro.map(p => ({ ...p, overall: 85 }))
const forte = forcasDoPlantel(xiForte, 70)
check("elenco melhor da forca maior", forte.overall > neutro.overall, `${forte.overall} vs ${neutro.overall}`)
check("e isso vale setor a setor",
  forte.attack > neutro.attack && forte.defense > neutro.defense && forte.midfield > neutro.midfield)

console.log("\nSetores sao medidos por quem joga neles\n")

const soAtaqueForte = xiNeutro.map(p =>
  ["ATA", "PE", "PD"].includes(p.position) ? { ...p, overall: 90 } : p)
const desequilibrado = forcasDoPlantel(soAtaqueForte, 70)
check("ataque sobe", desequilibrado.attack === 90, `${desequilibrado.attack}`)
check("defesa NAO sobe junto", desequilibrado.defense === neutro.defense,
  `${desequilibrado.defense} vs ${neutro.defense}`)
check("meio NAO sobe junto", desequilibrado.midfield === neutro.midfield)

console.log("\nO goleiro pesa 1 em 5 na defesa\n")

const goleiroRuim = xiNeutro.map(p => (p.position === "GOL" ? { ...p, overall: 50 } : p))
const comGoleiroRuim = forcasDoPlantel(goleiroRuim, 70)
// linha 70, gk 50  ->  (70*4 + 50) / 5 = 66
check("goleiro fraco derruba a defesa na proporcao certa",
  Math.abs(comGoleiroRuim.defense - 66) < 1e-9, `${comGoleiroRuim.defense}`)
check("e nao mexe no ataque", comGoleiroRuim.attack === neutro.attack)

console.log("\nForma e moral movem o modificador\n")

const felizes = xiNeutro.map(p => ({ ...p, form: 90, moralePoints: 80 }))
const alto = forcasDoPlantel(felizes, 70)
check("elenco em forma e feliz tem modificador positivo", alto.mod > 0, `${alto.mod}`)
check("e nao passa de ~7", alto.mod < 7, `${alto.mod}`)

const revoltados = xiNeutro.map(p => ({ ...p, form: 40, morale: "Revoltado", moralePoints: undefined }))
const baixo = forcasDoPlantel(revoltados, 70)
check("elenco mal e desmotivado tem modificador negativo", baixo.mod < 0, `${baixo.mod}`)
check("e nao passa de ~-7", baixo.mod > -7, `${baixo.mod}`)
check("moral por ROTULO funciona sem moralePoints", Number.isFinite(baixo.mod), `${baixo.mod}`)

console.log("\nLesionado e reserva ficam de fora\n")

const plantel: AtletaEmCampo[] = [
  ...xiNeutro,
  atleta("ATA", 99, { isStarter: false }),
  atleta("ZAG", 99, { injury: { semanas: 3 } }),
  atleta("ATA", 99, { isStarter: true, injury: { semanas: 2 } }),
]
const aptos = titularesAptos(plantel)
check("so os 11 titulares aptos entram", aptos.length === 11, `${aptos.length}`)
check("o craque no banco nao infla a forca",
  forcasDoPlantel(aptos, 70).attack === 70,
  `${forcasDoPlantel(aptos, 70).attack}`)
check("nem o titular lesionado",
  forcasDoPlantel(aptos, 70).defense === 70)

console.log("\nA regua e a mesma independente de quem chama\n")

// O mesmo XI medido duas vezes tem de dar o MESMO numero: e isso que impede o
// vies silencioso entre o time do usuario e o do outro tecnico.
const a = forcasDoPlantel(xiNeutro, 70)
const b = forcasDoPlantel([...xiNeutro].reverse(), 55)
check("ordem do array nao muda nada",
  a.attack === b.attack && a.defense === b.defense && a.midfield === b.midfield && a.overall === b.overall,
  `${JSON.stringify(a)} vs ${JSON.stringify(b)}`)

console.log("\n⚠️ O QUE IMPORTA: humano NAO cai no caminho da CPU\n")

const perfilCpu: PerfilDeCpu = {
  socialModifier: 1,
  modifiers: { attackBoost: 1.02, defenseBoost: 0.98, pressureBoost: 0.5 },
}

// Um clube de prestigio ALTO com um elenco RUIM: e o caso que separa as duas
// contas. Se o humano caisse no caminho da CPU, ele jogaria com a forca do
// escudo em vez da forca do time — que e exatamente o defeito.
const elencoRuim = { overall: 55, attack: 54, defense: 56, midfield: 55 }
const comHumano = ladoAdversarioEmCampo(elencoRuim, 90, perfilCpu)
check("o lado humano entra com o elenco DELE",
  comHumano.overall === 55 && comHumano.attack === 54,
  JSON.stringify(comHumano))
check("e o prestigio do clube nao encosta nele",
  comHumano.overall < 90, `${comHumano.overall}`)
check("nem o modificador social da CPU",
  comHumano.defense === 56, `${comHumano.defense}`)

const semHumano = ladoAdversarioEmCampo(null, 90, perfilCpu)
check("sem humano segue o prestigio, como sempre foi",
  semHumano.overall === 90 + 2 + 1, `${semHumano.overall}`)
check("com o ganho de ataque da CPU",
  Math.abs(semHumano.attack - (90 * 1.02 + 1)) < 1e-9, `${semHumano.attack}`)
check("o +2 e SO da CPU — humano nao recebe compensacao",
  semHumano.overall - 90 === 3 && comHumano.overall === 55)

// Elenco bom num clube pequeno: o outro lado da mesma moeda.
const elencoBom = { overall: 84, attack: 86, defense: 82, midfield: 83 }
check("elenco bom em clube pequeno JOGA como elenco bom",
  ladoAdversarioEmCampo(elencoBom, 40, perfilCpu).overall === 84)
check("e a CPU no mesmo clube pequeno seria bem mais fraca",
  ladoAdversarioEmCampo(null, 40, perfilCpu).overall < 84)

console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM\n" : `\n${falhas} FALHA(S)\n`)
process.exit(falhas === 0 ? 0 : 1)

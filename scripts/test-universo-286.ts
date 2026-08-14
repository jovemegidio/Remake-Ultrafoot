import assert from "node:assert/strict"
import { avancarUniverso286, criarUniversoPersistente286 } from "../lib/universo-286.ts"
import { advanceScoutingWeek, createScoutMission, createScoutingDepartment, hireDepartmentScout, type ScoutCandidate } from "../lib/scout-engine.ts"
import { confrontoEspacial286, perfilEspacial286 } from "../lib/modelo-espacial-286.ts"

function elenco(prefixo: string, forca: number, semAtaque = false) {
  const posicoes = semAtaque
    ? ["GOL","GOL","ZAG","ZAG","ZAG","ZAG","LD","LE","VOL","VOL","MEI","MEI","MEI","MEI","VOL","ZAG","LD","LE"]
    : ["GOL","GOL","ZAG","ZAG","ZAG","ZAG","LD","LE","VOL","VOL","MEI","MEI","MEI","ATA","ATA","ATA","ATA","ATA"]
  return posicoes.map((posicao, indice) => ({
    id: `${prefixo}-${indice}`,
    nome: `${prefixo} Jogador ${indice}`,
    posicao,
    idade: 18 + indice % 16,
    overall: forca + indice % 5,
    nacionalidade: "Brasil",
  }))
}

let universo = criarUniversoPersistente286({
  temporada: 2026,
  clubeDoUsuario: "USR",
  geradoEm: 1,
  clubes: [
    { curto: "USR", nome: "Usuário", pais: "Brasil", divisao: "liga_a", prestigio: 72, saldo: 80_000_000, jogadores: elenco("USR", 68) },
    { curto: "BUY", nome: "Comprador", pais: "Brasil", divisao: "liga_a", prestigio: 82, saldo: 180_000_000, jogadores: elenco("BUY", 70, true) },
    { curto: "SEL", nome: "Vendedor", pais: "Brasil", divisao: "liga_a", prestigio: 66, saldo: 40_000_000, jogadores: elenco("SEL", 72) },
    { curto: "RIV", nome: "Rival", pais: "Brasil", divisao: "liga_a", prestigio: 78, saldo: 150_000_000, jogadores: elenco("RIV", 71, true) },
  ],
})

assert.equal(Object.keys(universo.clubes).length, 4)
assert.equal(Object.keys(universo.jogadores).length, 72)
assert.equal(universo.ligas.liga_a.tabela.length, 4)
assert.equal(universo.clubes.BUY.carencias[0].setor, "ATA")

let negocios = 0
for (let semana = 1; semana <= 8; semana++) {
  const resultado = avancarUniverso286(universo, {
    temporada: 2026,
    semana,
    janelaAberta: semana % 2 === 0,
    quantidadeNegocios: 4,
  })
  universo = resultado.estado
  negocios += resultado.novosNegocios.length
}
assert.ok(universo.ligas.liga_a.tabela.every(linha => linha.jogos > 0), "liga da CPU precisa avançar")
assert.ok(Object.values(universo.jogadores).some(jogador => jogador.temporada.jogos > 0), "atletas precisam acumular estatísticas")
assert.ok(negocios > 0, "IA precisa fechar ao menos um negócio por carência")
assert.ok(universo.negocios.some(negocio => negocio.motivo.includes("ATA")), "negócio deve guardar o motivo posicional")
const universoParaScouting = structuredClone(universo)

for (let temporada = 2027; temporada <= 2046; temporada++) {
  universo = avancarUniverso286(universo, {
    temporada,
    semana: 1,
    janelaAberta: true,
    quantidadeNegocios: 1,
  }).estado
}
assert.equal(universo.temporada, 2046)
assert.ok(universo.ligas.liga_a.historico.length <= 20)
assert.ok(Object.values(universo.jogadores).some(jogador => jogador.historico.length > 0))

const candidatoDoMundo = Object.values(universoParaScouting.jogadores).find(jogador => jogador.clubeCurto && jogador.clubeCurto !== "USR")!
const clubeDoCandidato = universoParaScouting.clubes[candidatoDoMundo.clubeCurto!]
const candidato: ScoutCandidate = {
  id: candidatoDoMundo.id,
  name: candidatoDoMundo.nome,
  clubShort: candidatoDoMundo.clubeCurto,
  clubName: clubeDoCandidato.nome,
  country: clubeDoCandidato.pais,
  nationality: candidatoDoMundo.nacionalidade,
  position: candidatoDoMundo.posicao,
  age: candidatoDoMundo.idade,
  overall: candidatoDoMundo.overall,
  potential: candidatoDoMundo.potencial,
  value: candidatoDoMundo.valor,
  weeklySalary: candidatoDoMundo.contrato.salarioSemanal,
  contractEndSeason: candidatoDoMundo.contrato.ateTemporada,
  currentSeason: universoParaScouting.temporada,
  morale: candidatoDoMundo.moral,
  injuryWeeks: candidatoDoMundo.lesaoSemanas,
  attributes: candidatoDoMundo.atributos,
}
let departamento = hireDepartmentScout(createScoutingDepartment(), {
  id: "scout-1", name: "Scout Real", tier: "continental", monthlySalary: 50_000,
  attributes: { currentAbility: 82, potentialAbility: 84, youthDiscovery: 80, marketKnowledge: 85, negotiation: 75 },
})
departamento = createScoutMission(departamento, {
  id: "missao-real", scoutId: "scout-1", type: "first_team", region: "Mundo",
  startedWeek: 1, durationWeeks: 3, progressWeeks: 0, status: "active",
})
for (let semana = 2; semana <= 4; semana++) departamento = advanceScoutingWeek(departamento, semana, [candidato])
assert.equal(departamento.reports.length, 1)
assert.equal(departamento.reports[0].playerId, candidato.id)
assert.equal(departamento.reports[0].playerName, candidato.name)
assert.equal(departamento.reports[0].clubName, candidato.clubName)
assert.equal(departamento.reports[0].stage, "complete")
assert.ok(!departamento.reports[0].playerName.startsWith("Atleta "))

const amplo = perfilEspacial286({ inPossessionFormation: "3-2-5", outOfPossessionFormation: "4-4-2", chanceCreation: "largura", defensiveLine: "alta", pressingIntensity: "alta", counterPress: true })
const estreito = perfilEspacial286({ inPossessionFormation: "4-3-1-2", outOfPossessionFormation: "5-4-1", chanceCreation: "centro", defensiveLine: "baixa", pressingIntensity: "baixa", holdPosition: true })
assert.ok(amplo.largura > estreito.largura)
assert.ok(estreito.protecaoTransicao > amplo.protecaoTransicao)
assert.notEqual(confrontoEspacial286(amplo, estreito).diagnostico, "")

console.log(`OK 1.0.286: ${Object.keys(universo.clubes).length} clubes, ${Object.keys(universo.jogadores).length} atletas, ${negocios} negócios e scouting real.`)

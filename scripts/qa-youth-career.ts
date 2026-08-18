import { DEFAULT_STATE, type GameState } from "../lib/save-system"
import { allTeams } from "../lib/teams-data"
import { acceptProfessionalOffer, candidatosAPromocao, createYouthCareer, finishYouthSeason, generateProfessionalOffers, simulateYouthRound, vagasNoProfissional, YOUTH_COMPETITION_FORMATS_2026 } from "../lib/youth-career-engine"

const team=allTeams.find(t=>t.curto==="COR")??allTeams[0]
if(!team)throw new Error("Base de clubes vazia")
const seeded=createYouthCareer(team,2026)
let state:GameState={...structuredClone(DEFAULT_STATE),selectedTeamShort:team.curto,managerName:"QA Base",season:2026,createdAt:Date.now(),updatedAt:Date.now(),youthCareer:seeded.career,youthPlayers:seeded.players}
if(state.youthPlayers!.length<20||state.youthPlayers!.some(p=>p.age>20))throw new Error("Elenco Sub-20 inválido")

for(let season=0;season<5;season++){
  let guard=0
  while(!state.youthCareer?.seasonFinished&&guard++<60)state=simulateYouthRound(state)
  if(!state.youthCareer?.seasonFinished||state.youthCareer.matches<3||state.youthCareer.matches>45)throw new Error(`Temporada Sub-20 ${season+1} não terminou com calendário válido`)
  state=finishYouthSeason(state)
}
if(!state.youthCareer?.alumni.length)throw new Error("Nenhum atleta formado entrou no legado")
if(!state.youthCareer.professionalOffers.length)throw new Error("Nenhuma proposta profissional após cinco temporadas")
const offer=state.youthCareer.professionalOffers[0]
state=acceptProfessionalOffer(state,offer.id)
if(state.youthCareer?.active||state.selectedTeamShort!==offer.clubCurto)throw new Error("Transição ao profissional falhou")
if(YOUTH_COMPETITION_FORMATS_2026[0].participants!==128||YOUTH_COMPETITION_FORMATS_2026[1].stages[0].matches!==19||YOUTH_COMPETITION_FORMATS_2026[2].participants!==64)throw new Error("Formatos oficiais Sub-20 2026 divergentes")
console.log(`OK carreira Sub-20: 5 temporadas, três calendários independentes, ${state.youthCareer!.alumni.length} atletas no legado, proposta do ${offer.clubNome}`)

// ─── 1.0.351 ────────────────────────────────────────────────────────────────
//
// Três defeitos que o gate acima não via, e que agora não voltam:
//
//  1. QUEM JOGA EVOLUI MAIS. O desenvolvimento era `roll() < 0.2` para todo
//     mundo — escalar não mudava nada, e o bônus de treino do Sub-20 nunca
//     chegava a um garoto.
//  2. QUEM SOBE É DECISÃO DO TÉCNICO. `finishYouthSeason` promovia os primeiros
//     da lista com 19+ anos.
//  3. AS PROPOSTAS SÃO DO PAÍS DA CARREIRA. Eram Ponte Preta, CRB e Ceará
//     mesmo numa carreira fora do Brasil.


// 1. minutos mudam a evolução
//
// ⚠️ O ELENCO DO TESTE É ESCRITO À MÃO, não gerado. `generateYouthBatch` usa
// `Math.random`: com ele, cada execução compararia atletas diferentes e o gate
// daria veredicto diferente a cada rodada — gate instável é pior que gate
// nenhum. Aqui os 22 são IDÊNTICOS (mesma idade, overall e potencial) e a única
// diferença entre os dois grupos é quem foi escalado.
const doTeste = createYouthCareer(team, 2026)
const iguais = Array.from({ length: 22 }, (_, i) => ({
  id: `qa_base_${i}`,
  name: `Garoto ${i}`,
  position: i === 0 ? "GOL" : i < 8 ? "ZAG" : i < 16 ? "MEI" : "ATA",
  age: 17,
  overall: 60,
  potential: 85,
  value: 500_000,
  seasonSigned: 2026,
}))
let comEscala: GameState = {
  ...structuredClone(DEFAULT_STATE), selectedTeamShort: team.curto, managerName: "QA Minutos",
  season: 2026, createdAt: Date.now(), updatedAt: Date.now(),
  youthCareer: doTeste.career, youthPlayers: iguais,
}
const titularesFixos = iguais.slice(0, 11).map(p => p.id)
const reservasFixos = iguais.slice(11).map(p => p.id)
comEscala.youthCareer!.startingPlayerIds = titularesFixos
const antes = new Map((comEscala.youthPlayers ?? []).map(p => [p.id, p.overall]))
let voltas = 0
while (!comEscala.youthCareer?.seasonFinished && voltas++ < 60) comEscala = simulateYouthRound(comEscala)
const ganho = (ids: string[]) => ids.reduce((total, id) => {
  const atual = (comEscala.youthPlayers ?? []).find(p => p.id === id)
  return total + (atual ? atual.overall - (antes.get(id) ?? atual.overall) : 0)
}, 0) / Math.max(1, ids.length)
const ganhoTitular = ganho(titularesFixos), ganhoReserva = ganho(reservasFixos)
if (!(ganhoTitular > ganhoReserva)) {
  throw new Error(`quem joga tinha de evoluir mais: titular ${ganhoTitular.toFixed(2)} x reserva ${ganhoReserva.toFixed(2)}`)
}

// 2. a promoção obedece a escolha
const elegiveis = candidatosAPromocao(comEscala)
if (elegiveis.length) {
  const escolhido = elegiveis[elegiveis.length - 1]
  const depois = finishYouthSeason(comEscala, [escolhido.id])
  const subiu = depois.youthCareer!.alumni.some(a => a.playerId === escolhido.id)
  if (!subiu) throw new Error("o atleta escolhido não foi promovido")
  const promovidosDemais = depois.youthCareer!.alumni.length - comEscala.youthCareer!.alumni.length
  if (promovidosDemais !== 1) throw new Error(`promoveu ${promovidosDemais} em vez do único escolhido`)
  if ((depois.youthPlayers ?? []).some(p => p.age > 20)) throw new Error("atleta acima da idade continuou na base")
}
if (vagasNoProfissional(comEscala.youthCareer!) < 2) throw new Error("vagas no profissional zeradas")

// 3. propostas do país da carreira
const ingles = allTeams.find(t => String(t.divisao) === "premier_league")
if (ingles) {
  const carreiraInglesa = createYouthCareer(ingles, 2026).career
  carreiraInglesa.coachReputation = 90
  const ofertas = generateProfessionalOffers(carreiraInglesa)
  if (!ofertas.length) throw new Error("carreira inglesa sem propostas")
  if (ofertas.some(o => ["PON", "CRB", "CEA"].includes(o.clubCurto))) {
    throw new Error(`proposta brasileira chumbada numa carreira inglesa: ${ofertas.map(o => o.clubNome).join(", ")}`)
  }
}

console.log(`OK 1.0.351: titular evoluiu ${ganhoTitular.toFixed(2)} contra ${ganhoReserva.toFixed(2)} do reserva, promoção obedece a escolha e as propostas são do país da carreira`)

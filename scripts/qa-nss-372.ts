import { allTeams } from "@/lib/teams-data"
import {
  atributosEfetivosDoAtleta, comprarEnergia, comprarEquipamento, criarAtletaDaCarreira,
  criarCarreiraDeJogador, economiaDoAtleta, fazerAposta, interagirComParceira,
  jogarProximaRodada, treinarAtributoIndividual,
} from "@/lib/carreira-de-jogador"
import { decidirMomento, partidaTerminou } from "@/lib/partida-do-atleta"

let falhas = 0
let testes = 0
function ok(condicao: unknown, mensagem: string) {
  testes++
  if (!condicao) { falhas++; console.error(`FALHA: ${mensagem}`) }
}

const clube = allTeams.find(t => t.prestigio >= 75 && t.prestigio <= 85) ?? allTeams[0]
const atleta = criarAtletaDaCarreira({
  nome: "NSS 372", posicao: "ATA", idade: 19, nacionalidade: "Brasil",
  pePreferido: "direito", alturaCm: 181, pesoKg: 75, numero: 9,
})
let carreira = criarCarreiraDeJogador(clube, atleta, "Liga NSS", 2026)

const inicial = economiaDoAtleta(carreira)
ok(inicial.energia === 100 && inicial.dinheiro > 0, "carreira nova precisa nascer com energia e carteira")

const finalizacaoAntes = carreira.atleta.atributos.finalizacao
carreira = treinarAtributoIndividual(carreira, "finalizacao")
ok(carreira.atleta.atributos.finalizacao === finalizacaoAntes + 1, "treino individual nao aumentou o atributo")
ok(economiaDoAtleta(carreira).energia === 88, "treino individual nao gastou 12 de energia")

carreira.economia!.energia = 20
const dinheiroAntesDaEnergia = economiaDoAtleta(carreira).dinheiro
carreira = comprarEnergia(carreira, 25)
ok(economiaDoAtleta(carreira).energia === 45, "compra de energia nao creditou 25")
ok(economiaDoAtleta(carreira).dinheiro === dinheiroAntesDaEnergia - 4_000, "compra de energia nao debitou dinheiro")

carreira.economia!.dinheiro = Math.max(carreira.economia!.dinheiro, 100_000)
const ritmoAntes = atributosEfetivosDoAtleta(carreira).ritmo
carreira = comprarEquipamento(carreira, "chuteira_agilidade")
ok(atributosEfetivosDoAtleta(carreira).ritmo === ritmoAntes + 3, "equipamento nao alterou o atributo efetivo")

carreira = interagirComParceira(carreira, "conhecer")
ok(carreira.parceira?.fase === "conhecendo", "relacionamento proprio nao foi iniciado")

const caixaAntesDaAposta = economiaDoAtleta(carreira).dinheiro
carreira = fazerAposta(carreira, "vitoria", 1_000)
ok(carreira.apostaAtiva?.valor === 1_000, "aposta valida nao foi registrada")
ok(economiaDoAtleta(carreira).dinheiro === caixaAntesDaAposta - 1_000, "aposta nao debitou a carteira")

carreira.notaDoTreinador = 90
carreira = jogarProximaRodada(carreira, { viver: true })
ok(Boolean(carreira.partidaEmCurso?.aoVivo), "partida vivida nao abriu o motor ao vivo")
if (carreira.partidaEmCurso?.aoVivo) {
  let partida = carreira.partidaEmCurso
  const tipos = new Set<string>()
  let guarda = 0
  while (!partidaTerminou(partida) && guarda++ < 40) {
    const lance = partida.aoVivo?.lancePendente
    if (!lance) break
    tipos.add(lance.tipo)
    partida = decidirMomento(carreira, partida, lance.opcoes[0].id, 0.9).partida
  }
  ok(partida.aoVivo!.lancesOferecidos >= 8, `ritmo NSS entregou so ${partida.aoVivo!.lancesOferecidos} lances`)
  ok(partida.aoVivo!.lancesOferecidos <= 16, "ritmo NSS passou de 16 lances")
  ok(tipos.has("falta"), "falta nao apareceu como lance proprio")
  if ((partida.aoVivo!.metaDeLances ?? 0) >= 10) ok(tipos.has("penalti"), "penalti nao apareceu como lance proprio")
}

console.log(falhas === 0 ? `NSS 372 OK — ${testes} verificacoes.` : `${falhas} falha(s) em ${testes} verificacoes.`)
process.exit(falhas === 0 ? 0 : 1)

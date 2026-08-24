import { allTeams } from "@/lib/teams-data"
import {
  assinarPatrocinioPessoal,
  atributosEfetivosDoAtleta,
  comprarBemDoAtleta,
  contratarTreinadorPessoal,
  criarAtletaDaCarreira,
  criarCarreiraDeJogador,
  economiaDoAtleta,
  interagirComElenco,
  jogarPartidaDaSelecao,
  proximaPartidaDaSelecao,
  realizarMinijogoDeTreino,
  relacoesDoAtleta,
} from "@/lib/carreira-de-jogador"

let testes = 0
let falhas = 0
function ok(condicao: unknown, mensagem: string) {
  testes++
  if (!condicao) { falhas++; console.error(`FALHA: ${mensagem}`) }
}

const clube = allTeams.find(t => t.prestigio >= 75 && t.prestigio <= 85) ?? allTeams[0]
const atleta = criarAtletaDaCarreira({
  nome: "QA 373", posicao: "ATA", idade: 20, nacionalidade: "Brasil",
  pePreferido: "direito", alturaCm: 180, pesoKg: 75, numero: 11,
})
let carreira = criarCarreiraDeJogador(clube, atleta, "Liga QA", 2026)
carreira.economia = { ...economiaDoAtleta(carreira), dinheiro: 2_000_000, energia: 100 }

const cheio = atributosEfetivosDoAtleta(carreira).ritmo
carreira.economia.energia = 0
const exausto = atributosEfetivosDoAtleta(carreira).ritmo
ok(exausto < cheio, "energia baixa precisa reduzir a execucao em campo")
carreira.economia.energia = 100

carreira = contratarTreinadorPessoal(carreira, "bia")
ok(carreira.treinadorPessoal?.semanasRestantes === 12, "treinador pessoal nao foi contratado")
const atributoAntes = carreira.atleta.atributos.ritmo
const energiaAntes = economiaDoAtleta(carreira).energia
carreira = realizarMinijogoDeTreino(carreira, "ritmo", 1)
ok(carreira.atleta.atributos.ritmo > atributoAntes, "minijogo perfeito nao evoluiu o atributo")
ok(economiaDoAtleta(carreira).energia === energiaAntes - 6, "treinador pessoal nao reduziu o custo do minijogo")

const elencoAntes = relacoesDoAtleta(carreira).elenco
carreira = interagirComElenco(carreira, "treinar_junto")
ok(relacoesDoAtleta(carreira).elenco > elencoAntes, "interacao nao melhorou a relacao com o elenco")

carreira.reputacao = 80
carreira = assinarPatrocinioPessoal(carreira, "aurora")
ok(carreira.patrocinioPessoal?.marca === "Aurora Eleven", "patrocinio pessoal elegivel nao foi assinado")

carreira = comprarBemDoAtleta(carreira, "apto")
ok(carreira.patrimonio?.itens.includes("apto"), "imovel comprado nao entrou no patrimonio")
ok((carreira.patrimonio?.estilo ?? 0) > 0, "patrimonio nao alterou o estilo de vida")

carreira.selecao.convocada = true
carreira.selecao.nivel = "principal"
const internacional = proximaPartidaDaSelecao(carreira)
ok(Boolean(internacional), "convocacao nao criou calendario internacional")
carreira = jogarPartidaDaSelecao(carreira, { viver: true })
ok(carreira.partidaEmCurso?.origem === "selecao", "partida da selecao nao abriu como partida jogavel")
ok(Boolean(carreira.partidaEmCurso?.aoVivo), "selecao nao usa o motor ao vivo do atleta")

console.log(falhas === 0 ? `NSS 373 OK — ${testes} verificacoes.` : `${falhas} falha(s) em ${testes} verificacoes.`)
process.exit(falhas === 0 ? 0 : 1)

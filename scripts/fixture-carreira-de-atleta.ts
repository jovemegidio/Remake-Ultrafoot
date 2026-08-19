// Gera UMA carreira de atleta em JSON, para o teste de tela injetar no save.
//
// Ela nasce do MESMO `criarCarreiraDeJogador` do jogo: um JSON escrito à mão
// seria uma segunda ideia do que é uma carreira de atleta, e envelheceria
// sozinho na primeira mudança do estado.
import { allTeams } from "@/lib/teams-data"
import { criarAtletaDaCarreira, criarCarreiraDeJogador, jogarProximaRodada } from "@/lib/carreira-de-jogador"

const clube = allTeams.find(t => t.curto === "FLA") ?? allTeams[0]
const atleta = criarAtletaDaCarreira({
  nome: "Atleta Teste", posicao: "ATA", idade: 19, nacionalidade: "Brasil",
  pePreferido: "direito", alturaCm: 180, pesoKg: 74, numero: 19,
})
let carreira = criarCarreiraDeJogador(clube, atleta, "Brasileirao Serie A", 2026)
// Algumas rodadas jogadas: a tela precisa ter conteúdo (atuações, repercussão,
// tabela com jogos) — é com conteúdo que ela transborda, se transbordar.
// `RODADAS=0` devolve a carreira RECÉM-CRIADA — o estado em que o jogador cai
// logo depois de preencher os dados em /novo-jogo.
const rodadas = Number(process.env.RODADAS ?? 8)
for (let i = 0; i < rodadas; i++) carreira = jogarProximaRodada(carreira)
// `VIVER=1` devolve a carreira com uma PARTIDA EM CURSO, para a tela de
// pré-jogo/ao vivo ter o que mostrar.
if (process.env.VIVER === "1") {
  // Ele precisa ENTRAR EM CAMPO para existir partida vivida: um reserva fora dos
  // planos não gera momentos, e a tela abriria em "nenhuma partida".
  carreira = { ...carreira, notaDoTreinador: 88 }
  carreira = jogarProximaRodada(carreira, { viver: true })
}
process.stdout.write(JSON.stringify(carreira))

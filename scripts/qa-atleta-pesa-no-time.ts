/**
 * O ATLETA PESA NO RESULTADO DO CLUBE (1.0.375).
 *
 * Ate a 1.0.374 a partida SIMULADA saia de `simulateFullMatch` com prestigio
 * contra prestigio, e `desempenhoDaPartida` apenas ATRIBUIA ao atleta uma fatia
 * dos gols que o clube ja havia feito. Medido em 10 temporadas: um atacante de
 * 92 marcava 30,3 gols por temporada contra 6,0 de um de 48, e o clube dele
 * terminava 1,8 ponto na frente — ruido. A carreira inteira nao movia a tabela.
 *
 * A partida VIVIDA ja estava certa ("o placar nasce do que voce faz"); o buraco
 * era o caminho simulado, que e o que o jogador mais usa — ninguem vive as 38
 * rodadas.
 *
 * O gate compara o MESMO clube com um atleta fraco e com um craque e exige que
 * o craque renda mais pontos ao time. A margem exigida (5) fica bem abaixo da
 * diferenca medida (11,3 com 32 amostras por faixa, erro padrao ~1,5), porque
 * teste que oscila e pior que teste nenhum. O teto tambem e verificado: um
 * jogador entre onze nao pode valer uma liga inteira.
 */
import { allTeams } from "@/lib/teams-data"
import {
  criarAtletaDaCarreira, criarCarreiraDeJogador, encerrarTemporada, jogarProximaRodada,
  type EstadoCarreiraDeJogador,
} from "@/lib/carreira-de-jogador"
import { sortStandings } from "@/lib/career-engine"

// ⚠️ NAO BAIXE ESTE NUMERO. Com SEMENTES = 3 (18 amostras por faixa) este
// portao REPROVOU a 1.0.383 medindo ganho 4.8 contra o piso 5 — e o codigo
// estava certo: 8 sementes deram 11.5 e 12 deram 9.8, ambos folgados. Era ruido
// de amostra pequena raspando o limiar, e o comentario acima ja prometia "32
// amostras por faixa" enquanto o codigo entregava 18.
//
// Portao que oscila em cima do limiar e pior que portao nenhum: ele custa uma
// investigacao de release inteira para no fim dizer que nao havia defeito, e da
// terceira vez que isso acontece alguem passa a ignorar o vermelho — que e
// exatamente quando ele estaria certo.
//
// Custa ~157s. Vale: e a invariante de que o elenco mexe no placar, que ja
// esteve quebrada de verdade (o placar ouvia so o prestigio, 1.0.375).
const SEMENTES = 8
const TEMPORADAS = 6
const clube = allTeams.find(t => t.prestigio >= 78 && t.prestigio <= 85)!

function pontosMedios(overall: number): number {
  const todos: number[] = []
  for (let s = 0; s < SEMENTES; s++) {
    const a = criarAtletaDaCarreira({
      nome: `Gate ${overall}/${s}`, posicao: "ATA", idade: 24, nacionalidade: "Brasil",
      pePreferido: "direito", alturaCm: 180, pesoKg: 75, numero: 9,
    })
    a.overall = overall
    a.potencial = Math.max(overall, a.potencial)
    for (const k of Object.keys(a.atributos) as (keyof typeof a.atributos)[]) a.atributos[k] = overall
    let c: EstadoCarreiraDeJogador = criarCarreiraDeJogador(clube, a, "Liga do gate", 2026)
    for (let t = 0; t < TEMPORADAS; t++) {
      let guarda = 0
      while (!c.temporadaEncerrada && guarda++ < 200) c = jogarProximaRodada(c)
      const linha = sortStandings(c.tabela).find(x => x.curto === c.clubeCurto) as
        { points?: number; pontos?: number } | undefined
      todos.push(linha?.points ?? linha?.pontos ?? 0)
      c = encerrarTemporada(c)
    }
  }
  return todos.reduce((x, y) => x + y, 0) / todos.length
}

let falhas = 0
const erro = (m: string) => { falhas++; console.error(`FALHA: ${m}`) }

const fraco = pontosMedios(50)
const craque = pontosMedios(90)
const ganho = Math.round((craque - fraco) * 10) / 10
console.log(`clube ${clube.nome} (prestigio ${clube.prestigio}), ${SEMENTES} sementes x ${TEMPORADAS} temporadas`)
console.log(`  atleta 50: ${Math.round(fraco * 10) / 10} pts/temporada`)
console.log(`  atleta 90: ${Math.round(craque * 10) / 10} pts/temporada`)
console.log(`  ganho do craque: ${ganho}`)

if (ganho < 5) erro(`o craque so rendeu ${ganho} ponto(s) a mais — o atleta voltou a nao pesar no resultado`)
if (ganho > 25) erro(`o craque rendeu ${ganho} pontos a mais — um jogador entre onze nao pode valer isso`)

console.log(falhas === 0 ? "\nOK: o que o atleta faz chega a tabela do clube." : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)

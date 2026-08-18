// A NARRAÇÃO NÃO PODE CONTRADIZER O PLACAR.
//
// ⚠️ POR QUE ISTO É UM GATE. O usuário pediu que a partida da carreira de atleta
// fosse "como a tela ao vivo do técnico" e, quando não era, foi direto ao ponto:
// "sem narração". A narração entrou na 1.0.353 — e ela tem um jeito específico
// de estragar tudo que não dá erro nenhum: NARRAR UM GOL A MAIS.
//
// O placar já está fechado quando a tela abre (o motor decidiu a partida antes).
// A narração só DISTRIBUI esses gols no relógio. Se ela sortear por conta
// própria, o jogador lê "GOL do seu time! 2–1" num jogo que o cabeçalho mostra
// 1–1, e a partir daí não confia em mais nada do que a tela conta.
//
// Uso: npx tsx scripts/test-narracao-do-atleta.ts

import { allTeams } from "@/lib/teams-data"
import { semearMotorDePartida } from "@/lib/match-engine"
import {
  criarAtletaDaCarreira, criarCarreiraDeJogador, jogarProximaRodada,
} from "@/lib/carreira-de-jogador"

let falhas = 0
const erro = (m: string) => { console.log("FALHA: " + m); falhas++ }
const ok = (m: string) => console.log("ok   " + m)

const clube = allTeams.find(t => t.prestigio >= 78 && t.prestigio <= 90) ?? allTeams[0]

let partidasConferidas = 0
let comNarracao = 0

// Várias sementes: um placar 0–0 não prova nada sobre distribuir gols.
for (const semente of [7, 21, 55, 91, 130]) {
  const atleta = criarAtletaDaCarreira({
    nome: "Narrado", posicao: "ATA", idade: 24, nacionalidade: "Brasil",
    pePreferido: "direito", alturaCm: 180, pesoKg: 75, numero: 9,
  })
  semearMotorDePartida(semente)
  let carreira = criarCarreiraDeJogador(clube, atleta, "Brasileirao Serie A", 2026)

  for (let tentativa = 0; tentativa < 8 && !carreira.partidaEmCurso; tentativa++) {
    carreira = jogarProximaRodada(carreira, { viver: true })
  }
  const partida = carreira.partidaEmCurso
  if (!partida) continue
  partidasConferidas++

  const lances = partida.narracaoDaPartida ?? []
  if (lances.length === 0) {
    erro(`semente ${semente}: partida sem narracao nenhuma`)
    continue
  }
  comNarracao++

  // 1. O NÚMERO DE GOLS NARRADOS É O PLACAR. Nem um a mais, nem a menos.
  const narradosPro = lances.filter(l => l.tipo === "gol-pro").length
  const narradosContra = lances.filter(l => l.tipo === "gol-contra").length
  if (narradosPro !== partida.golsPro || narradosContra !== partida.golsContra) {
    erro(`semente ${semente}: narracao diz ${narradosPro}-${narradosContra} e o placar e `
      + `${partida.golsPro}-${partida.golsContra}`)
  }

  // 2. O RELÓGIO NÃO VOLTA. Uma narração fora de ordem é ilegível.
  for (let i = 1; i < lances.length; i++) {
    if (lances[i].minuto < lances[i - 1].minuto) {
      erro(`semente ${semente}: a narracao volta no tempo (${lances[i - 1].minuto}' -> ${lances[i].minuto}')`)
      break
    }
  }

  // 3. TODO LANCE CABE NUMA PARTIDA. 0 a 90.
  const forade = lances.filter(l => l.minuto < 0 || l.minuto > 90)
  if (forade.length > 0) {
    erro(`semente ${semente}: ${forade.length} lance(s) fora dos 90 minutos`)
  }

  // 4. QUEM ENTRA DO BANCO É NARRADO ENTRANDO — e no minuto certo.
  if (!partida.titular && partida.minutos > 0) {
    const entrada = lances.find(l => l.tipo === "voce")
    if (!entrada) {
      erro(`semente ${semente}: o atleta entrou do banco e a narracao nao contou`)
    } else if (entrada.minuto !== 90 - partida.minutos) {
      erro(`semente ${semente}: entrada narrada aos ${entrada.minuto}', mas ele jogou ${partida.minutos} min`)
    }
  }
}

if (partidasConferidas === 0) {
  erro("nenhuma partida vivida foi produzida — o gate nao olhou para nada")
} else {
  ok(`${partidasConferidas} partida(s) vividas, ${comNarracao} com narracao`)
  if (falhas === 0) ok("a narracao bate com o placar, anda para frente e cabe nos 90 minutos")
}

semearMotorDePartida(null)

console.log(falhas === 0
  ? "\nNARRACAO OK — o que a tela conta e o que o motor decidiu."
  : `\n${falhas} problema(s): a narracao pode estar contradizendo o placar.`)
process.exit(falhas === 0 ? 0 : 1)

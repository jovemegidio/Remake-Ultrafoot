// O ONLINE NÃO PODE ENCOSTAR NO SAVE DA CARREIRA.
//
// ⚠️ POR QUE ISTO É UM GATE E NÃO UMA INTENÇÃO. Pedido do usuário, literal:
// "os modos online não podem interferir nos saves". Hoje eles não interferem —
// medido: zero chamadas de gravação nos módulos e nas telas de online. Mas
// "hoje não interfere" é um fato que expira: basta alguém querer guardar o
// resultado de um amistoso e escrever `setState({...})` numa tela de online
// para a carreira de um jogador passar a depender do que aconteceu numa sala
// com um estranho.
//
// O estrago desse tipo é silencioso e caro: o save é o único dado do jogador
// que não tem backup do lado dele. Por isso a regra vira teste.
//
// ⚠️ O QUE ESTE GATE NÃO PROVA. Ele lê o CÓDIGO, não o comportamento: um módulo
// que chame a gravação por um apelido importado com outro nome passa. Ele fecha
// o caminho óbvio — que é por onde esse defeito entraria — e não substitui ler o
// diff de uma tela nova de online.
//
// Uso: npx tsx scripts/test-online-nao-toca-no-save.ts

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

let falhas = 0
const erro = (m: string) => { console.log("FALHA: " + m); falhas++ }
const ok = (m: string) => console.log("ok   " + m)

/** Tudo que grava no save da carreira, de um jeito ou de outro. */
const GRAVA_NO_SAVE = [
  "saveGameState",
  "commitGameState",
  "setState(",
  "storeSet(",
  "persistGameEngineNow",
]

/** Os módulos e telas que são ONLINE e nada mais. */
const DO_ONLINE = [
  "lib/manager-rivals.ts",
  "lib/internet-multiplayer.ts",
  "lib/online-multiplayer.ts",
  "lib/modos-online.ts",
]

function telasDeOnline(): string[] {
  const raiz = "app/online"
  if (!existsSync(raiz)) return []
  const saida: string[] = []
  const andar = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const completo = path.join(dir, nome)
      if (statSync(completo).isDirectory()) { andar(completo); continue }
      if (/\.tsx?$/.test(nome)) saida.push(completo)
    }
  }
  andar(raiz)
  return saida
}

const alvos = [...DO_ONLINE.filter(existsSync), ...telasDeOnline()]

if (alvos.length === 0) {
  erro("nenhum arquivo de online encontrado — o gate perdeu o alvo e deixaria tudo passar")
}

for (const arquivo of alvos) {
  const texto = readFileSync(arquivo, "utf-8")
  // Comentários não contam: eles EXPLICAM a regra, e explicar não é gravar.
  const codigo = texto
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter(l => !/^\s*(\/\/|\*)/.test(l))
    .join("\n")

  for (const chamada of GRAVA_NO_SAVE) {
    if (codigo.includes(chamada)) {
      erro(`${arquivo} chama \`${chamada}\` — o online passou a escrever no save da carreira`)
    }
  }
}

if (falhas === 0) ok(`${alvos.length} arquivo(s) de online, nenhuma escrita no save da carreira`)

// ⚠️ E A RECÍPROCA: o interruptor do online não pode ser marcado como "escolha
// do jogador" sem ele ter mexido nela. A versão anterior marcava a cada
// salvamento de Configurações, e quem entrou lá para mudar o VOLUME saía optado
// para fora do online automático — voltando a ter de ligar tudo na mão.
{
  const configuracoes = readFileSync("app/configuracoes/page.tsx", "utf-8")
  if (!configuracoes.includes("mexeuNoOnline")) {
    erro("Configuracoes voltou a marcar `multiplayerDefinidoPeloJogador` sem conferir se mudou")
  } else {
    ok("Configuracoes so registra a escolha do online quando ela MUDA")
  }
}

console.log(falhas === 0
  ? "\nONLINE OK — ele nao encosta no save, e o interruptor respeita quem nao o tocou."
  : `\n${falhas} problema(s): o online pode estar mexendo na carreira do jogador.`)
process.exit(falhas === 0 ? 0 : 1)

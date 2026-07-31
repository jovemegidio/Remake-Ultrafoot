// O RADAR TEM DE ENCENAR O LANCE CERTO.
//
// O motor guarda os eventos com o MAIS NOVO NA FRENTE. A escolha antiga varria a
// lista do fim para o comeco "procurando o mais recente" — e o fim da lista e o
// COMECO da partida. Resultado: aos 66 minutos o radar ainda mandava a bola para
// o gol de quem tinha finalizado aos 3, e o `seq` (que era o indice) mudava a
// cada evento novo, re-disparando a reacao para sempre.
import { selecionarEventoDoRadar, type EventoDaPartida } from "../lib/radar-evento"

let falhas = 0
const check = (ok: boolean, msg: string) => { if (!ok) { falhas++; console.log(`  FALHA: ${msg}`) } }

console.log("== Evento do radar ==")

// A lista chega do motor com o MAIS NOVO NA FRENTE.
const novoNaFrente = (...eventos: EventoDaPartida[]) => eventos

// 1) O LANCE ENCENADO E O MAIS RECENTE, nao o primeiro da partida.
const partida = novoNaFrente(
  { type: "corner", side: "away" },   // <- o mais novo
  { type: "foul", side: "home" },
  { type: "goal", side: "home" },
  { type: "shot", side: "home" },     // <- o mais antigo
)
const escolhido = selecionarEventoDoRadar(partida)
check(escolhido?.type === "corner" && escolhido.side === "away",
  `deveria encenar o escanteio do visitante (o mais novo), veio ${escolhido?.type}/${escolhido?.side}`)

// 2) IDENTIDADE ESTAVEL: o mesmo lance mantem o mesmo `seq` quando OUTROS
//    eventos chegam na frente. Era isto que fazia a reacao re-disparar sozinha.
const antes = selecionarEventoDoRadar(partida)
const depoisDeDoisLances = selecionarEventoDoRadar(
  novoNaFrente({ type: "foul", side: "home" }, { type: "throw_in", side: "away" }, ...partida),
)
check(antes?.seq === depoisDeDoisLances?.seq,
  `o mesmo lance tem de manter o seq (${antes?.seq} -> ${depoisDeDoisLances?.seq})`)

// 3) ...e um lance NOVO tem de trazer um seq MAIOR, senao a reacao nunca dispara.
const comLanceNovo = selecionarEventoDoRadar(novoNaFrente({ type: "goal", side: "away" }, ...partida))
check((comLanceNovo?.seq ?? 0) > (antes?.seq ?? 0),
  `lance novo precisa de seq maior (${antes?.seq} -> ${comLanceNovo?.seq})`)
check(comLanceNovo?.type === "goal" && comLanceNovo.side === "away", "e tem de ser o gol novo")

// 4) Eventos que o radar nao encena sao PULADOS — nao podem esconder o lance bom.
const soFaltas = selecionarEventoDoRadar(novoNaFrente(
  { type: "foul", side: "home" },
  { type: "yellow_card", side: "away" },
  { type: "substitution", side: "home" },
  { type: "shot", side: "away" },
))
check(soFaltas?.type === "shot" && soFaltas.side === "away",
  "falta/cartao/substituicao nao encenam; o chute atras deles sim")

// 5) Sem lado nao da para saber para que gol a bola vai — encenar seria chutar.
const semLado = selecionarEventoDoRadar([{ type: "goal" } as EventoDaPartida, { type: "shot", side: "home" }])
check(semLado?.side === "home", "evento sem lado tem de ser ignorado")

// 6) Partida sem lance nenhum nao encena nada.
check(selecionarEventoDoRadar([]) === undefined, "lista vazia devolve undefined")
check(selecionarEventoDoRadar([{ type: "foul", side: "home" }]) === undefined,
  "so eventos nao encenaveis devolve undefined")

// 7) Cada tipo de finalizacao vira reacao de chute (o gol tem a sua propria).
for (const t of ["shot", "shot_on_target", "save", "post", "miss", "penalty", "free_kick"]) {
  const r = selecionarEventoDoRadar([{ type: t, side: "home" }])
  check(r?.type === "shot", `"${t}" deveria virar reacao de chute, veio ${r?.type}`)
}
check(selecionarEventoDoRadar([{ type: "goal", side: "home" }])?.type === "goal", "gol tem reacao propria")

console.log(falhas === 0 ? "\nOK — o radar encena o lance mais recente, e so uma vez por lance" : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)

// Trava as regras do draft online (lib/draft-online.ts). O que este teste
// protege é o que quebraria em silêncio numa sala real: catálogo divergente
// entre os dois clientes e disputa pelo mesmo atleta.
import {
  catalogoDoDraft, estadoDoDraft, ordemDasEscolhas, podeEscolher, forcaDoElenco,
  type AtletaDoDraft, type EscolhaDoDraft,
} from "../lib/draft-online"

let falhas = 0
function ok(condicao: boolean, descricao: string, detalhe = ""): void {
  if (condicao) { console.log(`  ok   ${descricao}`); return }
  falhas++
  console.log(`  FALHA ${descricao}${detalhe ? ` — ${detalhe}` : ""}`)
}

const SETORES = ["GOL", "DEF", "MEI", "ATA"] as const
const mundo: AtletaDoDraft[] = Array.from({ length: 600 }, (_, i) => ({
  id: `a${i}`,
  nome: `Atleta ${i}`,
  posicao: SETORES[i % 4],
  setor: SETORES[i % 4],
  overall: 55 + (i % 35),
  idade: 18 + (i % 18),
  clube: `Clube ${i % 40}`,
}))

console.log("Draft online")

// 1. O catálogo é derivado da sala: os dois clientes montam a MESMA lista.
const cliente1 = catalogoDoDraft("SALA42", mundo, 60)
const cliente2 = catalogoDoDraft("SALA42", mundo, 60)
ok(cliente1.map(a => a.id).join() === cliente2.map(a => a.id).join(),
  "mesma sala gera catálogo idêntico nos dois clientes")
const outraSala = catalogoDoDraft("SALA99", mundo, 60)
ok(outraSala.map(a => a.id).join() !== cliente1.map(a => a.id).join(),
  "salas diferentes geram catálogos diferentes")

// 2. Dá para montar 11 de verdade: o catálogo tem goleiro e gente de cada setor.
for (const setor of SETORES) {
  ok(cliente1.filter(a => a.setor === setor).length >= 2, `catálogo tem ${setor} suficiente`,
    String(cliente1.filter(a => a.setor === setor).length))
}

// 3. Ordem serpentina.
const ordem = ordemDasEscolhas(["A", "B"], 3)
ok(ordem.join(",") === "A,B,B,A,A,B", "serpentina 1-2-2-1", ordem.join(","))

// 4. Turno: quem não é da vez não escolhe.
const config = { participantes: ["A", "B"], escolhasPorTecnico: 3, tamanhoDoCatalogo: 60 }
const vazio = estadoDoDraft(cliente1, [], config)
ok(vazio.daVez === "A", "o primeiro da fila começa")
ok(podeEscolher(vazio, "A") && !podeEscolher(vazio, "B"), "só o da vez pode escolher")

// 5. DISPUTA PELO MESMO ATLETA: vence o menor sequence, o outro é descartado.
const alvo = cliente1[0].id
const disputa: EscolhaDoDraft[] = [
  { sequence: 10, participantId: "A", atletaId: alvo },
  { sequence: 11, participantId: "B", atletaId: alvo },
]
const aposDisputa = estadoDoDraft(cliente1, disputa, config)
ok(aposDisputa.elencos.A.some(a => a.id === alvo), "quem chegou primeiro leva o atleta")
ok(!aposDisputa.elencos.B.some(a => a.id === alvo), "o segundo não leva o mesmo atleta")
ok(aposDisputa.daVez === "B", "a vez passa mesmo com a escolha duplicada descartada")

// 6. A ordem de chegada é a do relay, não a do array.
const foraDeOrdem = estadoDoDraft(cliente1, [...disputa].reverse(), config)
ok(foraDeOrdem.elencos.A.some(a => a.id === alvo),
  "lista embaralhada dá o mesmo resultado (ordena por sequence)")

// 7. Escolha de quem não é da vez é ignorada sem travar o draft.
const foraDaVez = estadoDoDraft(cliente1, [{ sequence: 1, participantId: "B", atletaId: alvo }], config)
ok(foraDaVez.escolhasFeitas === 0 && foraDaVez.daVez === "A", "escolha fora da vez não avança o draft")

// 8. O draft termina e cada um sai com o número combinado de atletas.
const completo: EscolhaDoDraft[] = []
let estado = estadoDoDraft(cliente1, completo, config)
let seq = 0
while (!estado.encerrado) {
  completo.push({ sequence: ++seq, participantId: estado.daVez!, atletaId: estado.disponiveis[0].id })
  estado = estadoDoDraft(cliente1, completo, config)
}
ok(estado.elencos.A.length === 3 && estado.elencos.B.length === 3, "cada técnico monta o total combinado",
  `${estado.elencos.A.length} / ${estado.elencos.B.length}`)
ok(estado.daVez === null, "não há vez depois de encerrado")
const semRepetido = new Set([...estado.elencos.A, ...estado.elencos.B].map(a => a.id))
ok(semRepetido.size === 6, "nenhum atleta em dois elencos", String(semRepetido.size))

// 9. Escolha depois do fim não entra.
completo.push({ sequence: ++seq, participantId: "A", atletaId: estado.disponiveis[0].id })
ok(estadoDoDraft(cliente1, completo, config).escolhasFeitas === 6, "escolha após o fim é ignorada")

// 10. Força do elenco pune quem não pegou goleiro.
const comGoleiro = cliente1.filter(a => a.setor === "GOL").slice(0, 1)
  .concat(cliente1.filter(a => a.setor !== "GOL").slice(0, 10))
const semGoleiro = cliente1.filter(a => a.setor !== "GOL").slice(0, 11)
ok(forcaDoElenco(comGoleiro) > 0 && forcaDoElenco(semGoleiro) > 0, "força calculada nos dois casos")
ok(forcaDoElenco(semGoleiro) < Math.max(...semGoleiro.map(a => a.overall)),
  "elenco sem goleiro não sai com a nota do melhor jogador")

console.log(falhas === 0 ? "\nDraft online: tudo certo." : `\nDraft online: ${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)

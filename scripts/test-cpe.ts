// Trava as invariantes do CPE (lib/cpe.ts). Falha se o potencial real voltar a
// vazar para a tela ou se melhorar o departamento deixar de melhorar a leitura.
import { estimarPotencial, qualidadeDeAvaliacao, faixaDeCpe, rotuloDaAvaliacao } from "../lib/cpe"

let falhas = 0
function ok(condicao: boolean, descricao: string, detalhe = ""): void {
  if (condicao) { console.log(`  ok   ${descricao}`); return }
  falhas++
  console.log(`  FALHA ${descricao}${detalhe ? ` — ${detalhe}` : ""}`)
}

console.log("CPE — capacidade potencial estimada")

// 1. Determinismo: a opinião do clube não muda a cada render.
const a = estimarPotencial("youth_FLA_2026_1", 84, 40)
const b = estimarPotencial("youth_FLA_2026_1", 84, 40)
ok(a.valor === b.valor && a.minimo === b.minimo, "a mesma avaliação sai igual duas vezes", `${a.valor} vs ${b.valor}`)

// 2. O CPE ERRA — se ele fosse sempre igual ao real, não haveria surpresa.
const amostra = Array.from({ length: 400 }, (_, i) => {
  const real = 55 + (i % 40)
  return { real, cpe: estimarPotencial(`atleta-${i}`, real, 20).valor }
})
const errados = amostra.filter(x => x.cpe !== x.real).length
ok(errados > amostra.length * 0.8, "com estrutura amadora, a maioria das avaliações erra", `${errados}/${amostra.length}`)
const paraCima = amostra.filter(x => x.cpe > x.real).length
const paraBaixo = amostra.filter(x => x.cpe < x.real).length
ok(paraCima > 0 && paraBaixo > 0, "erra para os dois lados (promessa e decepção)", `+${paraCima} / -${paraBaixo}`)

// 3. Melhorar a estrutura APROXIMA do real, sem mexer no talento.
const erroMedio = (qualidade: number) =>
  amostra.reduce((soma, x) => soma + Math.abs(estimarPotencial(`atleta-${x.real}`, x.real, qualidade).valor - x.real), 0) / amostra.length
const amador = erroMedio(qualidadeDeAvaliacao({ academia: 1, centroDeObservacao: 1, centroDeDados: 1, olheiros: 0 }))
const completo = erroMedio(qualidadeDeAvaliacao({ academia: 5, centroDeObservacao: 5, centroDeDados: 5, olheiros: 95 }))
ok(completo < amador, "departamento montado erra menos que o amador", `${completo.toFixed(2)} < ${amador.toFixed(2)}`)
ok(amador > 3, "a avaliação amadora erra o bastante para importar", `erro medio ${amador.toFixed(2)}`)

// 4. Monotonicidade: cada degrau de qualidade aproxima ou mantém, nunca piora.
const degraus = [0, 20, 40, 60, 80, 100].map(q => erroMedio(q))
ok(degraus.every((v, i) => i === 0 || v <= degraus[i - 1] + 0.001),
  "erro cai (ou empata) a cada degrau de qualidade", degraus.map(v => v.toFixed(2)).join(" > "))

// 5. A faixa exibida é uma faixa de verdade e respeita os limites.
const faixa = estimarPotencial("garoto-x", 90, 10)
ok(faixa.minimo <= faixa.valor && faixa.valor <= faixa.maximo, "o valor fica dentro da faixa")
ok(faixa.minimo >= 35 && faixa.maximo <= 99, "faixa dentro dos limites de overall")
ok(/^\d+( a \d+)?$/.test(faixaDeCpe(faixa)), "texto da faixa formatado", faixaDeCpe(faixa))

// 6. Qualidade responde à estrutura, e o rótulo acompanha.
const qBase = qualidadeDeAvaliacao({ academia: 1, centroDeObservacao: 1, centroDeDados: 1, olheiros: 0 })
const qTopo = qualidadeDeAvaliacao({ academia: 5, centroDeObservacao: 5, centroDeDados: 5, olheiros: 100 })
ok(qBase < 25 && qTopo > 85, "estrutura mexe na qualidade", `${qBase} -> ${qTopo}`)
ok(rotuloDaAvaliacao(qBase) === "Avaliação amadora" && rotuloDaAvaliacao(qTopo) === "Avaliação precisa",
  "rótulos das pontas corretos", `${rotuloDaAvaliacao(qBase)} / ${rotuloDaAvaliacao(qTopo)}`)

// 7. Nem no topo o CPE vira o valor exato sempre: o futebol não dá essa garantia.
const noTopo = amostra.slice(0, 120).filter(x => estimarPotencial(`atleta-${x.real}`, x.real, 100).valor !== x.real).length
ok(noTopo > 0, "mesmo o melhor departamento erra de vez em quando", `${noTopo} de 120`)

console.log(falhas === 0 ? "\nCPE: tudo certo." : `\nCPE: ${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)

// Cobre a COMISSÃO TÉCNICA regra a regra.
//
// Importa porque um parecer errado é pior que parecer nenhum: o jogador confia
// e age. Cada teste monta o cenário mínimo e verifica que o alerta certo aparece
// — e, tão importante quanto, que ele NÃO aparece quando não deve.

import { analisarComComissao, type AtletaParaAnalise } from "@/lib/comissao-tecnica"

let falhas = 0
function ok(cond: boolean, msg: string) {
  console.log(`  ${cond ? "ok  " : "FALHA"} ${msg}`)
  if (!cond) falhas++
}

function atleta(over: Partial<AtletaParaAnalise> & { id: number }): AtletaParaAnalise {
  return {
    nome: `Atleta ${over.id}`, posicao: "MEI", overall: 70, idade: 26,
    energia: 90, forma: 70, titular: false, lesionado: false, jogosDeSuspensao: 0,
    ...over,
  }
}

/** Elenco saudável de 20, com 11 titulares — a linha de base "sem alertas". */
function elencoSadio(): AtletaParaAnalise[] {
  const posicoes = ["GOL", "ZAG", "ZAG", "LD", "LE", "VOL", "VOL", "MEI", "PD", "PE", "ATA"]
  const time = posicoes.map((p, i) => atleta({ id: i + 1, posicao: p, titular: true }))
  const banco = ["GOL", "ZAG", "LD", "VOL", "MEI", "PD", "ATA", "ATA", "LE"]
    .map((p, i) => atleta({ id: 100 + i, posicao: p }))
  return [...time, ...banco]
}

const base = { semanaAtual: 10, caixa: 50_000_000, saldoSemanal: 500_000 }

console.log("== Comissao tecnica ==")

// 1. Lesionado escalado
{
  const e = elencoSadio()
  e[3] = { ...e[3], lesionado: true }
  const p = analisarComComissao({ ...base, elenco: e })
  ok(p.some(x => x.id === "medico-lesionado-escalado" && x.urgencia === "critico"),
    "lesionado escalado vira alerta CRITICO do departamento medico")
}

// 2. Suspenso escalado — alerta SEPARADO do lesionado
{
  const e = elencoSadio()
  e[5] = { ...e[5], jogosDeSuspensao: 2 }
  const p = analisarComComissao({ ...base, elenco: e })
  ok(p.some(x => x.id === "medico-suspenso-escalado"), "suspenso escalado tem alerta proprio")
  ok(!p.some(x => x.id === "medico-lesionado-escalado"), "suspenso NAO e reportado como lesionado")
}

// 3. Desgaste com substituto disponivel
{
  const e = elencoSadio()
  e[7] = { ...e[7], energia: 40, posicao: "MEI" }
  const p = analisarComComissao({ ...base, elenco: e })
  const d = p.find(x => x.id === "preparador-desgaste")
  ok(Boolean(d), "titular exausto gera parecer do preparador")
  ok(Boolean(d && d.detalhe.includes("→")), "o parecer NOMEIA o substituto, nao so o problema")
}

// 4. Elenco sadio nao inventa alerta critico
{
  const p = analisarComComissao({ ...base, elenco: elencoSadio() })
  ok(!p.some(x => x.urgencia === "critico"),
    "elenco saudavel nao gera nenhum alerta critico (evita alarme que se aprende a ignorar)")
}

// 5. Caixa negativo
{
  const p = analisarComComissao({ ...base, elenco: elencoSadio(), caixa: 4_000_000, saldoSemanal: -1_000_000 })
  const c = p.find(x => x.id === "diretor-caixa")
  ok(Boolean(c && c.urgencia === "critico"), "caixa para 4 semanas e CRITICO")
  ok(Boolean(c && c.titulo.includes("4")), "o parecer diz QUANTAS semanas o caixa cobre")
}

// 6. Elenco curto
{
  const p = analisarComComissao({ ...base, elenco: elencoSadio().slice(0, 15) })
  ok(p.some(x => x.id === "olheiro-elenco-curto"), "menos de 18 disponiveis vira alerta")
}

// 7. Contrato de titular a vencer
{
  const e = elencoSadio()
  e[0] = { ...e[0], fimDeContrato: 20, overall: 80 }
  const p = analisarComComissao({ ...base, elenco: e, semanaAtual: 10 })
  ok(p.some(x => x.id === "diretor-contratos"), "contrato acabando em 10 semanas e sinalizado")
}
{
  const e = elencoSadio()
  e[0] = { ...e[0], fimDeContrato: 300 }
  const p = analisarComComissao({ ...base, elenco: e, semanaAtual: 10 })
  ok(!p.some(x => x.id === "diretor-contratos"), "contrato longe NAO gera alerta")
}

// 8. Leitura do adversario
{
  const p = analisarComComissao({
    ...base, elenco: elencoSadio(), forcaDoTime: 78,
    proximoAdversario: { nome: "Rival", forca: 60, casa: true },
  })
  const a = p.find(x => x.id === "analista-adversario")
  ok(Boolean(a && a.titulo.includes("favorito")), "time muito superior e lido como favorito")
}

// 9. Sequencia de derrotas so com 3+ jogos
{
  const p2 = analisarComComissao({ ...base, elenco: elencoSadio(), formaRecente: ["D", "D"] })
  ok(!p2.some(x => x.id === "analista-sequencia"), "duas derrotas ainda NAO acionam o alerta")
  const p3 = analisarComComissao({ ...base, elenco: elencoSadio(), formaRecente: ["D", "D", "D"] })
  ok(p3.some(x => x.id === "analista-sequencia"), "tres derrotas seguidas acionam")
}

// 10. Ordenacao por urgencia
{
  const e = elencoSadio()
  e[3] = { ...e[3], lesionado: true }
  const p = analisarComComissao({ ...base, elenco: e, forcaDoTime: 70,
    proximoAdversario: { nome: "X", forca: 70, casa: true } })
  ok(p[0].urgencia === "critico", "o critico vem primeiro na lista")
}

// 11. Elenco vazio nao quebra
{
  const p = analisarComComissao({ ...base, elenco: [] })
  ok(p.length === 0, "elenco vazio devolve lista vazia sem explodir")
}

console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM" : `\n${falhas} TESTE(S) FALHARAM`)
process.exit(falhas ? 1 : 0)

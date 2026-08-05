/**
 * A diretoria segura o elenco quando o técnico não renova.
 *
 * Sem isto, uma carreira passiva perdia 100% do elenco em 6 temporadas (medido:
 * overall médio 74 -> 42, com os 18 atletas finais valendo zero). A diretoria é
 * FALLBACK: age só no último momento e só sobre quem o clube quer manter.
 */
import { decidirRenovacoes, IDADE_LIMITE, IDADE_DE_PROMESSA, ANOS_DA_RENOVACAO } from "../lib/diretoria"
import { useGameEngine } from "../lib/game-engine"

let falhas = 0
const ok = (nome: string, cond: boolean, det = "") => {
  console.log(`${cond ? "OK  " : "FALHA"} ${nome}${det ? ` — ${det}` : ""}`)
  if (!cond) falhas++
}

const base = { salarioSemanal: 10000, listadoParaSair: false }
const ctx = { agora: 200, caixa: 50_000_000, folhaAtual: 100_000 }

const elenco = [
  { id: 1, name: "Titular vencendo", overall: 75, age: 28, fimDoContrato: 200, ...base },
  { id: 2, name: "Reserva fraco vencendo", overall: 55, age: 30, fimDoContrato: 200, ...base },
  { id: 3, name: "Promessa fraca vencendo", overall: 58, age: 20, fimDoContrato: 200, ...base },
  { id: 4, name: "Veterano vencendo", overall: 80, age: IDADE_LIMITE + 1, fimDoContrato: 200, ...base },
  { id: 5, name: "Titular em dia", overall: 78, age: 27, fimDoContrato: 400, ...base },
  { id: 6, name: "Listado para sair", overall: 82, age: 26, fimDoContrato: 200, salarioSemanal: 10000, listadoParaSair: true },
  { id: 7, name: "Mediano", overall: 65, age: 29, fimDoContrato: 999, ...base },
]

const d = decidirRenovacoes(elenco, ctx)
const renovados = new Set(d.map(x => x.id))

ok("renova o titular que está vencendo", renovados.has(1))
ok("renova a promessa mesmo abaixo da média", renovados.has(3), `${IDADE_DE_PROMESSA} anos é o limite`)
ok("NÃO renova o reserva fraco", !renovados.has(2))
ok("NÃO renova quem passou da idade limite", !renovados.has(4), `limite ${IDADE_LIMITE}`)
ok("NÃO mexe em contrato em dia", !renovados.has(5))
ok("NÃO passa por cima do técnico (listado para sair)", !renovados.has(6))
ok("o novo vínculo tem os anos combinados", d.every(x => x.novoFim === ctx.agora + 52 * ANOS_DA_RENOVACAO))
ok("o salário sobe na renovação", d.every(x => x.novoSalario > 10000))

ok("clube sem caixa não renova ninguém", decidirRenovacoes(elenco, { ...ctx, caixa: 0 }).length === 0)
ok("elenco sem ninguém vencendo devolve vazio", decidirRenovacoes([elenco[4], elenco[6]], ctx).length === 0)
ok("teto de folha segura a renovação", decidirRenovacoes(elenco, { ...ctx, tetoDeFolha: 100_000 }).length === 0)

// ---- efeito real na carreira -------------------------------------------------
const g = () => useGameEngine.getState()
const media = (pl: readonly { overall: number }[]) => pl.length ? Math.round(pl.reduce((s, p) => s + p.overall, 0) / pl.length) : 0
g().initializeGame("FLA")
const ovrInicial = media(g().squadPlayers)
for (let t = 1; t <= 6; t++) {
  for (let w = 0; w < 52; w++) g().advanceWeek()
  const b = g()
  g().processSeasonEnd(b.currentSeason + 1, b.serieAStandings, b.serieAStandings)
}
const fim = g()
const ovrFinal = media(fim.squadPlayers)
const emergenciais = fim.squadPlayers.filter(p => (p.marketValue ?? 0) === 0).length

// Antes da diretoria: 74 -> 42 e 18 de 18 emergenciais. A régua é generosa de
// propósito — o que não pode voltar é o colapso.
ok("o elenco não colapsa em 6 temporadas passivas", ovrFinal >= ovrInicial - 10, `${ovrInicial} -> ${ovrFinal}`)
ok("o clube não vira um time inteiro de emergenciais", emergenciais < fim.squadPlayers.length, `${emergenciais} de ${fim.squadPlayers.length}`)
ok("a receita semanal acompanha a divisão", fim.weeklyIncome > 0, `${Math.round(fim.weeklyIncome)}`)

console.log(falhas === 0 ? "\nRESULTADO: TUDO OK" : `\nRESULTADO: ${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)

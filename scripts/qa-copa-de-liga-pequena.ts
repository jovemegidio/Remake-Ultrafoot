/**
 * Copa nacional em liga PEQUENA.
 *
 * `generateCupBracket` monta a chave pareando 1v16 (`shuffled[15 - i]`). Ligas
 * com menos de 16 clubes — a escocesa e boa parte da expansao UEFA, 426 dos
 * 1350 clubes — liam `undefined` e derrubavam a criacao da carreira: a tela
 * ficava presa em "Montando a sua temporada..." para sempre, sem erro visivel,
 * porque a excecao morria dentro do handler async.
 *
 * Pegou a carreira de ATLETA e a de BASE, que usam o mesmo gerador.
 *
 * Este gate cobre TODA divisao com menos de 16 clubes, que e a superficie de
 * risco real, e exige chave cheia: 8 confrontos nas oitavas.
 */
import { allTeams } from "@/lib/teams-data"
import { criarAtletaDaCarreira, criarCarreiraDeJogador } from "@/lib/carreira-de-jogador"
import { academiasDaDivisao, createYouthCareer, montarTemporadaDaBase } from "@/lib/youth-career-engine"

let falhas = 0
const erro = (m: string) => { falhas++; console.error(`FALHA: ${m}`) }

const atleta = criarAtletaDaCarreira({
  nome: "QA copa", posicao: "ATA", idade: 20, nacionalidade: "Brasil",
  pePreferido: "direito", alturaCm: 180, pesoKg: 75, numero: 11,
})

const porDivisao = new Map<string, typeof allTeams>()
for (const t of allTeams) {
  const d = String(t.divisao)
  porDivisao.set(d, [...(porDivisao.get(d) ?? []), t])
}

const pequenas = [...porDivisao.entries()].filter(([, times]) => times.length < 16)
console.log(`divisoes com menos de 16 clubes: ${pequenas.length}`)

for (const [divisao, times] of pequenas) {
  const clube = times[0]
  try {
    const carreira = criarCarreiraDeJogador(clube, atleta, "Liga QA", 2026)
    const confrontos = carreira.copa?.matches.length ?? 0
    if (confrontos !== 8) erro(`${divisao}: copa do atleta com ${confrontos} confrontos, esperado 8`)
    const nomes = new Set((carreira.copa?.matches ?? []).flatMap(m => [m.homeCurto, m.awayCurto]))
    if (nomes.size !== 16) erro(`${divisao}: copa com ${nomes.size} clubes distintos, esperado 16`)
  } catch (e) {
    erro(`${divisao}: carreira de atleta nao nasce — ${(e as Error).message}`)
  }
  if (academiasDaDivisao(divisao, clube.curto).length >= 4) {
    try {
      const base = createYouthCareer(clube, 2026)
      montarTemporadaDaBase(base.career, divisao)
    } catch (e) {
      erro(`${divisao}: carreira de base nao nasce — ${(e as Error).message}`)
    }
  }
}

console.log(falhas === 0
  ? `OK: ${pequenas.length} divisoes pequenas com copa cheia, atleta e base nascendo.`
  : `${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)

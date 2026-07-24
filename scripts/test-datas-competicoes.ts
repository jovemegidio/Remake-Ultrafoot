// As datas reais das competicoes de 2026 tem que bater com a vida real e casar
// tanto por id quanto pelo nome que a tela usa.
import { periodoLabel, periodoLabelPorNome, periodo2026 } from "../lib/competition-dates-2026"

let falhas = 0
const check = (ok: boolean, msg: string) => { if (!ok) { falhas++; console.log(`  FALHA: ${msg}`) } }

console.log("== Datas reais das competicoes 2026 ==")

// 1) Copa do Mundo: 11 jun – 19 jul 2026 (o exemplo do usuario).
const wc = periodo2026("copa_mundo")
check(wc?.startsOn === "2026-06-11" && wc?.endsOn === "2026-07-19", `Copa do Mundo: ${wc?.startsOn}..${wc?.endsOn}`)
check(periodoLabel("copa_mundo") === "11 jun – 19 jul 2026", `label WC: ${periodoLabel("copa_mundo")}`)

// 2) Finais continentais confirmadas na fonte / informadas pelo usuario.
check(periodo2026("libertadores")?.endsOn === "2026-11-28", "Libertadores final 28/nov")
check(periodo2026("sulamericana")?.endsOn === "2026-11-21", "Sul-Americana final 21/nov")
check(periodo2026("champions_league")?.endsOn === "2026-05-30", "Champions final 30/mai/2026")
check(periodo2026("europa_league")?.endsOn === "2026-05-20", "Europa League final 20/mai/2026")
check(periodo2026("conference_league")?.endsOn === "2026-05-27", "Conference final 27/mai/2026")

// 3) UEFA e edicao 2025/26: o label cruza 2025 -> 2026.
const cl = periodoLabel("champions_league")
check(!!cl && /2025.*2026/.test(cl), `Champions cruza 2025->2026: ${cl}`)

// 4) Copa do Brasil vem do REGULAMENTO (17 fev – 6 dez) via casamento por id.
check(periodo2026("copa_brasil")?.startsOn === "2026-02-17" || periodo2026("copa_brasil")?.startsOn === "2026-02-18", `Copa do Brasil: ${periodo2026("copa_brasil")?.startsOn}`)

// 5) Casamento por NOME (a tela usa nome dinamico).
check(periodoLabelPorNome("UEFA Champions League") === periodoLabel("champions_league"), "casa 'UEFA Champions League' por nome")
check(periodoLabelPorNome("CONMEBOL Libertadores") === periodoLabel("libertadores"), "casa 'CONMEBOL Libertadores' por nome")
check(periodoLabelPorNome("Copa do Brasil") !== null, "casa 'Copa do Brasil' por nome (via regulamento)")
check(periodoLabelPorNome("Brasileirão Série A") !== null, "casa 'Brasileirão Série A' por nome (via regulamento)")

// 6) Competicao sem data configurada nao quebra.
check(periodoLabelPorNome("Torneio Inexistente") === null, "nome desconhecido -> null")

console.log(falhas === 0 ? "\nOK — datas reais configuradas e casando por id e nome" : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)

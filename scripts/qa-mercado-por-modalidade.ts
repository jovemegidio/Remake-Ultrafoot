// GATE DA 1.0.335 — o mercado segue a modalidade, e o nome do clube feminino
// perdeu o sufixo sem perder a separação de elenco.
//
// As duas mudanças estão no mesmo gate de propósito: elas se sustentam. Tirar
// " Feminino" do nome só é seguro porque `getPlayersForTeam` fecha as fontes
// masculinas por `file_key`; se alguém reabrir qualquer uma delas, o teste do
// elenco quebra ANTES de um clube feminino entrar em campo com onze homens —
// que é um defeito que não parece defeito na tela (o elenco fica cheio de
// atletas reais, só que os errados).

import { getAllTimesFemininos, getTeamsByDivision } from "../lib/teams-data"
import { getPlayersForTeam } from "../lib/players-data"
import { ehClubeFeminino } from "../lib/futebol-feminino"
import { vitrineDaModalidade, IDADE_MAXIMA_DA_BASE } from "../lib/mercado-da-modalidade"
import { generateDetailedMarketTargets } from "../lib/transfer-engine"
import { clubesDeEstreia } from "../lib/carreira-de-jogador"

let okCount = 0
let falhas = 0
function ok(nome: string, condicao: boolean, detalhe = "") {
  if (condicao) { okCount++; console.log(`  ok   ${nome}`) }
  else { falhas++; console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ""}`) }
}

const femininos = getAllTimesFemininos()
const clube = femininos.find(t => t.divisao === "brasileirao_fem_a1")
if (!clube) { console.log("FALHA: nenhum clube do Brasileirao Feminino A1"); process.exit(1) }

console.log("\n— NOME DO CLUBE FEMININO —")
const comSufixo = femininos.filter(t => / Feminino$/i.test(t.nome))
ok(`nenhum dos ${femininos.length} clubes femininos mostra " Feminino" no nome`,
  comSufixo.length === 0, comSufixo.slice(0, 3).map(t => t.nome).join(", "))
ok("o file_key continua marcado com __fem (é ele que separa tudo agora)",
  femininos.every(t => t.file_key.endsWith("__fem")))
ok("o codigo curto continua exclusivo entre os femininos",
  new Set(femininos.map(t => t.curto)).size === femininos.length)

console.log("\n— A SEPARACAO DE ELENCO SOBREVIVEU AO NOME LIMPO —")
// A prova direta: o clube feminino e o masculino de mesmo nome não podem
// compartilhar UMA atleta sequer. Sem a guarda, o elenco sai idêntico.
const masculinos = getTeamsByDivision("serie_a")
let paresConferidos = 0
let vazamentos = 0
for (const fem of femininos) {
  const irmao = masculinos.find(m => m.nome === fem.nome)
  if (!irmao) continue
  paresConferidos++
  const nomesFem = new Set(getPlayersForTeam(fem).map(p => p.nome))
  const doMasculino = getPlayersForTeam(irmao).map(p => p.nome)
  if (doMasculino.some(n => nomesFem.has(n))) {
    vazamentos++
    console.log(`       vazou: ${fem.nome} (fem) x ${irmao.nome} (masc)`)
  }
}
ok(`ha pares de mesmo nome para conferir (${paresConferidos})`, paresConferidos > 0)
ok("nenhum clube feminino recebeu atleta do elenco masculino homonimo", vazamentos === 0)
ok("o clube feminino tem elenco jogavel", getPlayersForTeam(clube).length >= 11)
ok("ehClubeFeminino reconhece o clube pelo file_key", ehClubeFeminino(clube.file_key))

console.log("\n— A VITRINE SEGUE A MODALIDADE —")
const feminina = vitrineDaModalidade({ modalidade: "feminino", clubeCurto: clube.curto, clubeNome: clube.nome, temporada: 2026 })
ok("a vitrine feminina nao volta vazia", feminina.length > 0, `${feminina.length} atletas`)
ok("toda atleta da vitrine feminina veio de clube feminino",
  feminina.every(a => a.team.file_key.endsWith("__fem")))
ok("o proprio clube fica fora da vitrine", feminina.every(a => a.team.curto !== clube.curto))
ok("a vitrine feminina tem valor de mercado na escala do jogo (nao zerada)",
  feminina.some(a => a.value > 0))

const profissional = vitrineDaModalidade({ modalidade: "profissional", clubeCurto: "FLA", clubeNome: "Flamengo", temporada: 2026 })
const antiga = generateDetailedMarketTargets("FLA", undefined, 2026, "Flamengo")
ok("a carreira profissional continua vendo EXATAMENTE o mercado de antes",
  profissional.length === antiga.length && profissional[0]?.name === antiga[0]?.name,
  `${profissional.length} x ${antiga.length}`)
ok("nenhuma atleta de clube feminino entrou no mercado masculino",
  profissional.every(a => !a.team.file_key.endsWith("__fem")))

const base = vitrineDaModalidade({ modalidade: "sub20", clubeCurto: "FLA", clubeNome: "Flamengo", temporada: 2026 })
ok("a vitrine do sub-20 nao volta vazia", base.length > 0, `${base.length} atletas`)
ok(`nenhum atleta do sub-20 passa de ${IDADE_MAXIMA_DA_BASE} anos`,
  base.every(a => a.age <= IDADE_MAXIMA_DA_BASE))
ok("o sub-20 e um recorte do mercado, nao um catalogo paralelo",
  base.length < profissional.length)

console.log("\n— ONDE UMA PROMESSA PODE ESTREAR —")
const serieA = getTeamsByDivision("serie_a")
const estreia = clubesDeEstreia(serieA)
const maisForteDaLiga = [...serieA].sort((a, b) => (b.prestigio ?? 0) - (a.prestigio ?? 0))[0]
ok("a lista de estreia encolheu", estreia.length < serieA.length, `${estreia.length} de ${serieA.length}`)
ok("mas nao ficou vazia", estreia.length > 0)
ok(`o clube mais forte da liga (${maisForteDaLiga.nome}) esta fora`,
  !estreia.some(t => t.file_key === maisForteDaLiga.file_key))
ok("a ordem original da liga foi preservada (o carrossel nao se reordena)",
  estreia.every((t, i) => i === 0 || serieA.indexOf(t) > serieA.indexOf(estreia[i - 1])))
// ⚠️ A regra e RELATIVA: liga minuscula nao pode ficar sem nenhum clube, senao
// a modalidade abre sem opcao e parece quebrada.
ok("liga pequena demais para cortar devolve a lista inteira",
  clubesDeEstreia(serieA.slice(0, 4)).length === 4)
// A regra vale em TODA liga, inclusive nas de escala de prestigio diferente —
// foi o erro do corte fixo que a Divisao de Acesso ja cometeu uma vez.
let ligasSemOpcao = 0
for (const divisao of ["serie_b", "premier_league", "la_liga", "divisao_acesso_br"]) {
  const daLiga = getTeamsByDivision(divisao)
  if (daLiga.length > 4 && clubesDeEstreia(daLiga).length === 0) ligasSemOpcao++
}
ok("nenhuma liga conferida ficou sem clube de estreia", ligasSemOpcao === 0)

console.log(`\n${okCount} ok, ${falhas} falha(s)`)
process.exit(falhas === 0 ? 0 : 1)

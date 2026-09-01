// PORTAO DA 1.0.385 — o mundo tem campeoes, e eles precisam ser CRIVEIS.
//
//   npx tsx scripts/qa-campeoes-do-mundo.ts
//
// ⚠️ POR QUE ESTE PORTAO EXISTE. `lib/campeoes-do-mundo` responde quem levantou
// cada taca do planeta em cada temporada sem simular partida nenhuma. Um modulo
// assim erra em SILENCIO: ninguem percebe que o campeao ingles de 2034 foi o
// Hull City, ou que a Copa do Brasil masculina foi vencida pelo time feminino do
// Athletico, ate ler a tela por acaso. Foram exatamente esses dois os defeitos
// que a prova de mesa desta versao pegou antes de o codigo ficar pronto.
//
// ⚠️ E ELE COBRA OS DOIS SENTIDOS DO PESO. E a licao do fator de furia da
// 1.0.383: um numero testado num sentido so esta pela metade. Aqui isso quer
// dizer exigir que o favorito NAO ganhe todo ano E que a zebra NAO seja rotina.
// A primeira versao do modulo passava no primeiro teste e falhava feio no
// segundo — Hull City, Brentford e Coventry campeoes ingleses.

import {
  campeaoDaLiga,
  campeaoDaCopaNacional,
  campeaoDaSupercopaNacional,
  campeaoContinentalDeClubes,
  campeoesDaTemporada,
  clubesDoPais,
  limparCacheDeCampeoes,
  CONTINENTAIS_DE_CLUBE,
} from "../lib/campeoes-do-mundo"
import { berthsForSeason } from "../lib/super-cups"
import { getUserCupPlan } from "../lib/use-game-manager"
import { allTeams, getTeamsByDivision } from "../lib/teams-data"
import { getCountryCompetitions } from "../lib/country-competitions"
import { ehDivisaoFeminina } from "../lib/futebol-feminino"
import type { SeasonRecord } from "../lib/career-types"

let falhas = 0
function checa(condicao: boolean, titulo: string, detalhe = "") {
  if (condicao) {
    console.log(`  ok    ${titulo}`)
  } else {
    falhas++
    console.log(`  FALHA ${titulo}${detalhe ? `\n          ${detalhe}` : ""}`)
  }
}

const TEMPORADAS = 40
const PRIMEIRA = 2026
const anos = Array.from({ length: TEMPORADAS }, (_, i) => PRIMEIRA + i)

console.log("\n  CAMPEOES DO MUNDO (1.0.385)\n")

// ── 1. Determinismo ───────────────────────────────────────────────────────
{
  const primeira = anos.map(t => campeaoDaLiga("premier_league", t)?.clube)
  limparCacheDeCampeoes()
  const segunda = anos.map(t => campeaoDaLiga("premier_league", t)?.clube)
  const iguais = primeira.every((c, i) => c === segunda[i])
  checa(iguais, "a mesma pergunta devolve a mesma resposta (ate com cache limpo)")

  const copa1 = anos.map(t => campeaoDaCopaNacional("serie_a", t)?.clube).join()
  const copa2 = anos.map(t => campeaoDaCopaNacional("serie_a", t)?.clube).join()
  checa(copa1 === copa2, "a copa nacional tambem e deterministica")
}

// ── 2. O registro do save vence a derivacao ───────────────────────────────
{
  const clube = allTeams.find(t => t.curto === "COR")!
  const historico: SeasonRecord[] = [{
    season: 2030, competition: "Campeonato Brasileiro Serie A", position: 1, points: 80,
    won: 24, drawn: 8, lost: 6, goalsFor: 70, goalsAgainst: 35, champion: clube.curto,
    managerName: "Teste", promoted: false, relegated: false,
    teamCurto: clube.curto, teamNome: clube.nome,
  }]
  const comRegistro = campeaoDaLiga("serie_a", 2030, { historico, clubeDoUsuario: clube.curto })
  checa(comRegistro?.clube === clube.curto && comRegistro?.origem === "registro",
    "havendo registro no seasonHistory, e ele que responde",
    `devolveu ${comRegistro?.clube} (${comRegistro?.origem})`)

  const semRegistro = campeaoDaLiga("serie_a", 2031, { historico, clubeDoUsuario: clube.curto })
  checa(semRegistro?.origem === "derivado", "sem registro, o mundo deriva")
}

// ── 3. A derivacao NUNCA coroa o clube do usuario ─────────────────────────
//
// ⚠️ E A REGRA MAIS IMPORTANTE DAQUI. Um palmares que da ao tecnico um titulo
// que a carreira dele nao tem e pior do que nao ter palmares nenhum.
{
  let invadiu = 0
  for (const curto of ["FLA", "MCI", "REA", "PAL"]) {
    const verdade = { historico: [] as SeasonRecord[], clubeDoUsuario: curto }
    for (const t of anos) {
      const time = allTeams.find(x => x.curto === curto)
      const divisao = String(time?.divisao ?? "serie_a")
      if (campeaoDaLiga(divisao, t, verdade)?.clube === curto) invadiu++
      if (campeaoDaCopaNacional(divisao, t, verdade)?.clube === curto) invadiu++
      for (const id of Object.keys(CONTINENTAIS_DE_CLUBE)) {
        if (campeaoContinentalDeClubes(id, t, verdade)?.clube === curto) invadiu++
      }
    }
  }
  checa(invadiu === 0, "a derivacao nunca da um titulo ao clube do usuario",
    `${invadiu} titulos inventados`)
}

// ── 4. Coerencia: o campeao pertence a competicao ─────────────────────────
{
  let fora = 0
  const exemplos: string[] = []
  for (const divisao of ["premier_league", "serie_a", "la_liga", "serie_a_ita", "primeira_liga", "liga_argentina"]) {
    const daDivisao = new Set(getTeamsByDivision(divisao).map(t => t.curto))
    for (const t of anos) {
      const c = campeaoDaLiga(divisao, t)
      if (c && !daDivisao.has(c.clube)) { fora++; exemplos.push(`${divisao} ${t}: ${c.nome}`) }
    }
  }
  checa(fora === 0, "o campeao de uma liga joga naquela liga", exemplos.slice(0, 3).join(" | "))

  let foraDoPais = 0
  const exemplosPais: string[] = []
  for (const divisao of ["serie_a", "la_liga", "premier_league", "primeira_liga"]) {
    const pais = getCountryCompetitions(divisao).country
    const doPais = new Set(clubesDoPais(pais).map(t => t.curto))
    for (const t of anos) {
      const c = campeaoDaCopaNacional(divisao, t)
      if (c && !doPais.has(c.clube)) { foraDoPais++; exemplosPais.push(`${divisao} ${t}: ${c.nome}`) }
    }
  }
  checa(foraDoPais === 0, "o campeao de uma copa nacional e um clube daquele pais",
    exemplosPais.slice(0, 3).join(" | "))
}

// ── 5. Modalidade: masculino e feminino nao se misturam ───────────────────
//
// ⚠️ DEFEITO REAL PEGO NA PROVA DE MESA: a Copa do Brasil MASCULINA saia sendo
// disputada pelo `Athletico Paranaense` de chave `atleticopr_bra__fem`, que joga
// o Brasileirao Feminino A2. Varrer "as divisoes do pais" junta as duas
// modalidades num balde so.
{
  const femininos = new Set(allTeams.filter(t => ehDivisaoFeminina(String(t.divisao))).map(t => t.curto))
  let misturou = 0
  const casos: string[] = []
  for (const divisao of ["serie_a", "la_liga", "premier_league", "serie_a_ita"]) {
    for (const t of anos) {
      const c = campeaoDaCopaNacional(divisao, t)
      if (c && femininos.has(c.clube)) { misturou++; casos.push(`${divisao} ${t}: ${c.nome}`) }
      const l = campeaoDaLiga(divisao, t)
      if (l && femininos.has(l.clube)) { misturou++; casos.push(`liga ${divisao} ${t}: ${l.nome}`) }
    }
  }
  checa(misturou === 0, "competicao masculina nao e vencida por clube feminino",
    casos.slice(0, 3).join(" | "))

  // E o inverso: nenhuma continental masculina aparece no quadro de um clube feminino.
  const divisaoFem = allTeams.find(t => ehDivisaoFeminina(String(t.divisao)))?.divisao
  if (divisaoFem) {
    const quadro = campeoesDaTemporada(String(divisaoFem), 2026)
    const temContinental = quadro.some(c => CONTINENTAIS_DE_CLUBE[c.competicaoId])
    checa(!temContinental, "o quadro de um clube feminino nao inventa continental feminina",
      quadro.map(c => c.competicao).join(", "))
  }
}

// ── 6. O PESO NOS DOIS SENTIDOS ───────────────────────────────────────────
//
// ⚠️ NAO ASSERTAR CONTRA UM NUMERO CHUMBADO, e sim contra a FORMA da
// distribuicao — foi assim que a 1.0.383 descobriu que a propria constante de
// teto do teste estava errada. Aqui o que se afirma e: o favorito domina sem
// monopolizar, e quem levanta a taca costuma estar na elite da competicao.
{
  for (const divisao of ["premier_league", "serie_a", "la_liga", "serie_a_ita"]) {
    const porClube = new Map<string, number>()
    for (const t of anos) {
      const c = campeaoDaLiga(divisao, t)
      if (c) porClube.set(c.clube, (porClube.get(c.clube) ?? 0) + 1)
    }
    const maior = Math.max(...porClube.values())
    checa(porClube.size >= 4,
      `${divisao}: a liga nao tem dono unico (${porClube.size} campeoes distintos em ${TEMPORADAS})`)
    checa(maior <= TEMPORADAS * 0.5,
      `${divisao}: o favorito nao ganha sempre (maior sequencia ${maior}/${TEMPORADAS})`)

    // A ZEBRA NAO PODE SER ROTINA: o campeao sai do terco de cima da liga na
    // maioria esmagadora das temporadas.
    const ordenados = [...getTeamsByDivision(divisao)].sort((a, b) => (b.prestigio ?? 0) - (a.prestigio ?? 0))
    const elite = new Set(ordenados.slice(0, Math.max(6, Math.ceil(ordenados.length / 3))).map(t => t.curto))
    const naElite = anos.filter(t => {
      const c = campeaoDaLiga(divisao, t)
      return c ? elite.has(c.clube) : false
    }).length
    checa(naElite >= TEMPORADAS * 0.8,
      `${divisao}: a zebra e excecao (${naElite}/${TEMPORADAS} campeoes vieram do terco de cima)`)
  }
}

// ── 7. Supercopa e campeao CONTRA campeao ─────────────────────────────────
//
// ⚠️ ERA O DEFEITO MAIS VISIVEL DA AUSENCIA DE PALMARES: o calendario sorteava
// um clube da REGIAO. O campeao da Champions decidia a Supercopa da UEFA contra
// um time do meio da tabela do Chipre e nada no jogo acusava.
{
  const casos: Array<{ curto: string; divisao: string; titulo: string; supercopa: RegExp; esperado: (v: { historico: SeasonRecord[]; clubeDoUsuario: string }) => string | undefined }> = [
    {
      curto: "LIV", divisao: "premier_league", titulo: "UEFA Champions League",
      supercopa: /Supercopa da UEFA/,
      esperado: v => campeaoContinentalDeClubes("europa_league", 2026, v)?.clube,
    },
    {
      curto: "PAL", divisao: "serie_a", titulo: "Copa do Brasil",
      supercopa: /Supercopa do Brasil/,
      esperado: v => campeaoDaLiga("serie_a", 2026, v)?.clube,
    },
    {
      curto: "BAR", divisao: "la_liga", titulo: "La Liga",
      supercopa: /Supercopa/,
      esperado: v => campeaoDaCopaNacional("la_liga", 2026, v)?.clube,
    },
  ]

  for (const caso of casos) {
    const time = allTeams.find(t => t.curto === caso.curto)
    if (!time) { checa(false, `clube de teste ${caso.curto} existe no catalogo`); continue }
    const historico: SeasonRecord[] = [{
      season: 2026, competition: caso.titulo, position: 1, points: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, champion: time.curto, managerName: "Teste",
      promoted: false, relegated: false, teamCurto: time.curto, teamNome: time.nome,
    }]
    const verdade = { historico, clubeDoUsuario: time.curto }
    const vagas = berthsForSeason(historico, time.curto, 2027, caso.divisao)
    const planos = getUserCupPlan(time, vagas, null, 2027, 1, verdade)
    const plano = planos.find(p => caso.supercopa.test(p.competition.name))
    // ⚠️ O ESPERADO PRECISA DA MESMA VERDADE QUE O PLANO. A primeira versao deste
    // teste chamava `campeaoDaCopaNacional("la_liga", 2026)` SEM a verdade: a
    // derivacao livre devolvia o proprio Barcelona como campeao da Copa del Rey,
    // e o portao acusou de errado um codigo que estava certo (o adversario da
    // supercopa nao pode ser o proprio usuario). Comparar duas contas so vale
    // quando as duas partem da mesma entrada.
    const esperado = caso.esperado(verdade)
    checa(Boolean(plano?.adversarioFixo), `${caso.curto}: a supercopa tem adversario definido, nao sorteado`,
      `planos: ${planos.map(p => p.competition.name).join(", ")}`)
    checa(plano?.adversarioFixo?.curto === esperado,
      `${caso.curto}: o adversario da supercopa e o campeao do outro torneio`,
      `veio ${plano?.adversarioFixo?.curto}, esperado ${esperado}`)
  }
}

// ── 8. Custo ──────────────────────────────────────────────────────────────
//
// ⚠️ O MODULO E CHAMADO POR TELA, e a 1.0.300 ja cobrou uma vez o preco de uma
// varredura O(n^2) sobre o universo. Cinquenta temporadas de quadro completo e
// mais do que qualquer tela pede de uma vez.
{
  limparCacheDeCampeoes()
  const inicio = Date.now()
  for (const t of anos) campeoesDaTemporada("serie_a", t)
  const gasto = Date.now() - inicio
  checa(gasto < 2000, `o quadro de ${TEMPORADAS} temporadas sai em menos de 2s (${gasto}ms)`)
}

// ── 9. Cobertura: todo pais jogavel tem quem levante a taca ───────────────
{
  const divisoes = ["serie_a", "premier_league", "la_liga", "bundesliga", "ligue_1", "primeira_liga",
    "eredivisie", "liga_argentina", "j_league", "mls", "liga_mx", "saudi_pro", "uefa_pol_1", "uefa_hun_1"]
  const semCampeao: string[] = []
  for (const d of divisoes) {
    if (!campeaoDaLiga(d, 2026)) semCampeao.push(`${d} (liga)`)
    if (!campeaoDaCopaNacional(d, 2026)) semCampeao.push(`${d} (copa)`)
  }
  checa(semCampeao.length === 0, "toda divisao de amostra tem campeao de liga e de copa",
    semCampeao.join(", "))

  const comSupercopa = ["la_liga", "premier_league", "serie_a_ita", "primeira_liga"]
    .filter(d => getCountryCompetitions(d).superCup)
  const semSuper = comSupercopa.filter(d => !campeaoDaSupercopaNacional(d, 2028))
  checa(semSuper.length === 0, "todo pais com supercopa tem campeao de supercopa", semSuper.join(", "))
}

console.log(falhas === 0
  ? "\nCAMPEOES DO MUNDO OK — o palmares e crivel, deterministico e nao contradiz o save.\n"
  : `\n${falhas} verificacao(oes) falharam.\n`)
process.exit(falhas === 0 ? 0 : 1)

/**
 * DIVISÃO DE ACESSO NO MUNDO — o que este teste protege.
 *
 * O degrau de base nasceu no Brasil (1.0.318) e virou catálogo de 13 países
 * (1.0.319). Generalizar multiplicou por treze cada erro possível, e todos eles
 * são silenciosos:
 *
 *   1. A ESCADA DE CIMA QUEBRAR. Se o acesso virar uma pirâmide separada de duas
 *      divisões, `TIER_INDEX` reindexa a divisão de cima com `idx 0` e ela para
 *      de subir. A Série D deixaria de levar à Série C sem nada acusar.
 *   2. A PIRÂMIDE INVERTER. O prestígio do pool é um ranking interno do pool; a
 *      faixa de destino precisa sair do PISO da divisão de cima, país a país.
 *      Uma faixa fixa (a primeira versão usava 6-34) poria a base francesa acima
 *      da própria segunda divisão.
 *   3. A DIVISÃO NASCER MENOR QUE A TABELA. A contagem crua do pool promete
 *      clubes que as divisões de cima vão reservar antes. Peru, Paraguai e
 *      Bolívia prometiam 39/26/24 e entregavam 8/5/**2**.
 *   4. AS DUAS LISTAS DE ESCADA DIVERGIREM. `PYRAMIDS` e
 *      `PIRAMIDES_PROFUNDAS_DO_POOL` descrevem a mesma coisa em arquivos
 *      diferentes; sair de sincronia pendura a base no país errado.
 */
import { DIVISOES_DE_ACESSO, acessoPorId, ehDivisaoDeAcesso } from "../lib/divisao-de-acesso"
import { PYRAMIDS, divisionAbove, divisionBelow, promotionCount, relegationCount, divisionLabel } from "../lib/league-pyramid"
import { completarLigaComPool, getTeamsByDivision, tamanhoDaLiga, MIN_TIMES_PARA_LIGA, allPoolTeams, effectiveDivision } from "../lib/teams-data"
import { competitionsByLeague } from "../lib/international-competitions"
import { getCountryCompetitions, getConfederation } from "../lib/country-competitions"

let passou = 0
let falhou = 0
function ok(nome: string, cond: boolean, detalhe = "") {
  if (cond) { passou++; console.log(`  ok   ${nome}`) }
  else { falhou++; console.log(`  FALHA ${nome} ${detalhe}`) }
}

const faixa = (t: { prestigio?: number }[]) => {
  if (!t.length) return { min: 0, max: 0 }
  const p = t.map(x => x.prestigio ?? 0)
  return { min: Math.min(...p), max: Math.max(...p) }
}

console.log("\nDIVISAO DE ACESSO NO MUNDO\n")

// 1. Identidade: ids únicos, permanentes e reconhecíveis.
{
  const ids = DIVISOES_DE_ACESSO.map(d => d.id)
  ok("os ids sao unicos", new Set(ids).size === ids.length)
  ok("todo id e reconhecido pelo proprio catalogo", ids.every(ehDivisaoDeAcesso))
  ok("divisao normal nao e confundida com acesso", !ehDivisaoDeAcesso("serie_a"))
  // ⚠️ Este id shipou na 1.0.318 e vai para o save. Renomear derruba a carreira
  // de quem ja esta jogando nele.
  ok("o id brasileiro continua sendo `divisao_acesso_br`",
    ids.includes("divisao_acesso_br"))
  ok("os paises nao se repetem",
    new Set(DIVISOES_DE_ACESSO.map(d => d.country)).size === DIVISOES_DE_ACESSO.length)
}

// 2. A ESCADA DE CIMA CONTINUA INTEIRA — o teste que pega a reindexacao.
{
  for (const [div, esperado] of [
    ["serie_d", "serie_c"], ["serie_c", "serie_b"], ["serie_b", "serie_a"],
    ["bundesliga_2", "bundesliga"], ["ligue_2", "ligue_1"], ["serie_b_ita", "serie_a_ita"],
  ] as const) {
    ok(`${div} continua subindo para ${esperado}`, divisionAbove(div) === esperado,
      `(${divisionAbove(div)})`)
  }
}

// 3. Cada acesso encaixa embaixo da divisao declarada, nos dois sentidos.
{
  for (const a of DIVISOES_DE_ACESSO) {
    ok(`${a.id}: acima esta ${a.acima}`, divisionAbove(a.id) === a.acima, `(${divisionAbove(a.id)})`)
    ok(`${a.id}: e a BASE (nada abaixo)`, divisionBelow(a.id) === null, `(${divisionBelow(a.id)})`)
    ok(`${a.id}: promove ${a.sobem}`, promotionCount(a.id) === a.sobem, `(${promotionCount(a.id)})`)
    ok(`${a.id}: nao rebaixa ninguem`, relegationCount(a.id) === 0, `(${relegationCount(a.id)})`)
    ok(`${a.acima}: passou a rebaixar para o acesso`, divisionBelow(a.acima) === a.id,
      `(${divisionBelow(a.acima)})`)
  }
}

// 4. A PIRAMIDE NAO PODE INVERTER — em nenhum dos paises.
{
  let invertidas = 0
  for (const a of DIVISOES_DE_ACESSO) {
    const base = faixa(getTeamsByDivision(a.id))
    const cima = faixa(getTeamsByDivision(a.acima))
    if (!base.max || !cima.min) continue
    if (base.max >= cima.min) {
      invertidas++
      ok(`${a.id} fica abaixo de ${a.acima}`, false,
        `(base vai a ${base.max}, piso de cima e ${cima.min})`)
    }
  }
  ok(`nenhuma das ${DIVISOES_DE_ACESSO.length} bases invertou a piramide`, invertidas === 0)
}

// 5. A DIVISAO NAO PODE NASCER MENOR QUE A TABELA — o erro de Peru/Paraguai/Bolivia.
{
  for (const a of DIVISOES_DE_ACESSO) {
    const naDivisao = getTeamsByDivision(a.id)
    const tabela = completarLigaComPool(a.id)
    ok(`${a.id}: tem clubes suficientes (${naDivisao.length})`,
      naDivisao.length >= MIN_TIMES_PARA_LIGA, `(${naDivisao.length} < ${MIN_TIMES_PARA_LIGA})`)
    ok(`${a.id}: a tabela tem o tamanho oficial`, tabela.length === tamanhoDaLiga(a.id),
      `(${tabela.length} de ${tamanhoDaLiga(a.id)})`)
  }
}

// 6. AS DUAS ESCADAS BATEM. `PYRAMIDS` tem de terminar no acesso do pais.
{
  for (const a of DIVISOES_DE_ACESSO) {
    const p = PYRAMIDS.find(x => x.country === a.country)
    ok(`${a.country} tem piramide`, Boolean(p))
    if (!p) continue
    ok(`${a.country}: a piramide termina no acesso`, p.tiers[p.tiers.length - 1] === a.id,
      `(${p.tiers[p.tiers.length - 1]})`)
    ok(`${a.country}: tiers e swaps continuam alinhados`, p.swaps.length === p.tiers.length - 1,
      `(${p.tiers.length} tiers, ${p.swaps.length} swaps)`)
  }
}

// 7. Regulamento, rotulo, competicao e confederacao existem para TODAS.
{
  for (const a of DIVISOES_DE_ACESSO) {
    ok(`${a.id}: tem regulamento`, Boolean(competitionsByLeague[a.id]?.length))
    const comp = competitionsByLeague[a.id]?.[0]
    if (comp) {
      // Base da piramide nao anuncia rebaixamento — 16 ligas ja fizeram isso.
      ok(`${a.id}: o regulamento nao anuncia rebaixamento`, !comp.relegation, `(${comp.relegation})`)
      ok(`${a.id}: o regulamento promove o mesmo que a piramide`, comp.promotion === a.sobem,
        `(${comp.promotion} x ${a.sobem})`)
    }
    ok(`${a.id}: tem rotulo proprio`, divisionLabel(a.id) !== a.id, `(${divisionLabel(a.id)})`)
    const pais = getCountryCompetitions(a.id)
    ok(`${a.id}: herdou o pais da divisao de cima`,
      pais.country === getCountryCompetitions(a.acima).country,
      `(${pais.country} x ${getCountryCompetitions(a.acima).country})`)
    ok(`${a.id}: esta na mesma confederacao da divisao de cima`,
      getConfederation(a.id) === getConfederation(a.acima),
      `(${getConfederation(a.id)} x ${getConfederation(a.acima)})`)
  }
}

// 8. O efeito que justifica tudo: muito menos clube sem divisao no mundo.
{
  const livres = allPoolTeams.filter(t => String(effectiveDivision(t)).startsWith("pool:"))
  ok(`sobraram menos de 800 clubes sem divisao (eram 1.618)`, livres.length < 800,
    `(${livres.length})`)
  const total = DIVISOES_DE_ACESSO.reduce((s, a) => s + getTeamsByDivision(a.id).length, 0)
  ok(`as bases juntas passaram de 800 clubes`, total > 800, `(${total})`)
}

// 9. `acessoPorId` responde por todos e por mais ninguem.
{
  ok("acessoPorId acha todos", DIVISOES_DE_ACESSO.every(a => acessoPorId(a.id)?.country === a.country))
  ok("acessoPorId nao inventa", acessoPorId("serie_a") === undefined)
}

// 10. NENHUM CAMPO QUE O JOGO DIVIDE PODE SER ZERO — o crash da 1.0.320.
//
// O pool sempre gravou `torcida: 0` e `estadio_cap: 0`, e isso nunca importou
// porque clube do pool NAO ERA JOGAVEL. A Divisao de Acesso tornou centenas
// deles dirigiveis de uma vez: a bilheteria DIVIDE pela capacidade, juniores e
// mercado escalam pela torcida, o NaN contamina saldo e forca, e a simulacao
// morre no meio. Era o relato "crasha ao abrir elenco, no mercado, nos juniores,
// e a simulacao crasha de ponta a ponta".
{
  let ruins = 0
  let gigantes = 0
  for (const a of DIVISOES_DE_ACESSO) {
    const naDivisao = getTeamsByDivision(a.id)
    const acima = getTeamsByDivision(a.acima)
    const tetoDeCima = Math.max(0, ...acima.map(t => t.estadio_cap ?? 0))
    for (const t of naDivisao) {
      const bom = Number.isFinite(t.torcida) && (t.torcida ?? 0) > 0
        && Number.isFinite(t.estadio_cap) && (t.estadio_cap ?? 0) > 0
      if (!bom) { ruins++; if (ruins <= 3) console.log(`       ${a.id}/${t.nome}: torcida=${t.torcida} cap=${t.estadio_cap}`) }
      // Estadio maior que o da divisao ACIMA seria bilheteria invertida.
      if (tetoDeCima > 0 && (t.estadio_cap ?? 0) > tetoDeCima) gigantes++
    }
  }
  ok("nenhum clube de acesso tem torcida ou estadio zero/NaN", ruins === 0, `(${ruins})`)
  ok("nenhum estadio de acesso passa o maior da divisao de cima", gigantes === 0, `(${gigantes})`)
}

console.log(`\n${passou} ok, ${falhou} falha(s)\n`)
if (falhou > 0) process.exit(1)

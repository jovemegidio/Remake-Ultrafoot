/**
 * PIRAMIDE BRASILEIRA PROFUNDA — o que este teste protege.
 *
 * A Divisao de Acesso deu divisao a 260 clubes brasileiros que antes viviam em
 * `pool:Brasil` e nao podiam ser dirigidos nem subir. Os riscos de fazer isso
 * sao todos SILENCIOSOS — nenhum deles quebraria o jogo, todos o deixariam
 * errado sem nada na tela denunciando:
 *
 *   1. ESCALAS DIFERENTES. O prestigio do pool (50-98) e um ranking interno do
 *      pool; o do catalogo (10-93) e a forca na piramide nacional. Cru, o
 *      quinto nivel nasceria mais forte que a Serie B e subiria inteiro na
 *      primeira virada de temporada. Este teste trava as faixas.
 *   2. O POOL INVADIR AS SERIES. O laco das piramides profundas preenche o que
 *      "falta" em cada nivel. Se ele contar zero curados no Brasil — o que
 *      acontece quando a UF nao e reconhecida como pais —, ele conclui que
 *      faltam 20 clubes em CADA Serie e enche todas com clubes do pool.
 *   3. A UF DERIVADA CONTRADIZER A DECLARADA. Deduzir a UF pelo nome ou pelo
 *      arquivo so vale enquanto nao discordar de quem ja tem o campo; um
 *      palpite errado manda o clube para a regiao errada em silencio.
 *   4. O CLUBE FICAR FORA DA PROPRIA LIGA. Com 260 clubes para 20 vagas, aparar
 *      por prestigio elimina justamente o clube pequeno que o jogador escolheu.
 */
import {
  allPoolTeams, completarLigaComPool, effectiveDivision, getTeamsByDivision,
  tamanhoDaLiga,
} from "../lib/teams-data"
import { divisionAbove, divisionBelow, promotionCount, relegationCount, evolvePyramids } from "../lib/league-pyramid"

let passou = 0
let falhou = 0
function ok(nome: string, cond: boolean, detalhe = "") {
  if (cond) { passou++; console.log(`  ok   ${nome}`) }
  else { falhou++; console.log(`  FALHA ${nome} ${detalhe}`) }
}

const faixa = (times: { prestigio?: number }[]) => {
  const p = times.map(t => t.prestigio ?? 0)
  return { min: Math.min(...p), max: Math.max(...p) }
}

console.log("\nPIRAMIDE BRASILEIRA PROFUNDA\n")

// 1. As quatro Series nao podem ter sido tocadas pela chegada do quinto nivel.
//    Os numeros sao os medidos ANTES da mudanca — se algum se mexer, o pool
//    invadiu uma divisao curada.
{
  const esperado: Record<string, { min: number; max: number }> = {
    serie_a: { min: 43, max: 93 },
    serie_b: { min: 19, max: 75 },
    serie_c: { min: 16, max: 71 },
    serie_d: { min: 15, max: 45 },
  }
  for (const [div, alvo] of Object.entries(esperado)) {
    const liga = completarLigaComPool(div)
    const f = faixa(liga)
    ok(`${div} continua com 20 clubes`, liga.length === 20, `(${liga.length})`)
    ok(`${div} mantem a faixa de prestigio ${alvo.min}-${alvo.max}`,
      f.min === alvo.min && f.max === alvo.max, `(${f.min}-${f.max})`)
  }
}

// 2. Nenhum clube brasileiro do pool pode continuar sem divisao — o motivo de
//    o quinto nivel existir.
{
  const semDivisao = allPoolTeams.filter(
    t => (t.pais ?? "") === "Brasil" && String(effectiveDivision(t)).startsWith("pool:"),
  )
  ok("nenhum brasileiro do pool ficou sem divisao", semDivisao.length === 0,
    `(${semDivisao.length} sobraram: ${semDivisao.slice(0, 3).map(t => t.nome).join(", ")})`)

  const noAcesso = getTeamsByDivision("divisao_acesso_br")
  ok("a Divisao de Acesso recebeu a maioria do pool brasileiro", noAcesso.length > 200,
    `(${noAcesso.length})`)
}

// 3. O quinto nivel tem de ser MAIS FRACO que a Serie D. Este e o teste que
//    pega a inversao da piramide.
{
  const acesso = faixa(getTeamsByDivision("divisao_acesso_br"))
  const serieD = faixa(completarLigaComPool("serie_d"))
  ok("o teto do acesso nao passa o teto da Serie D", acesso.max <= serieD.max,
    `(acesso ${acesso.min}-${acesso.max} x serie_d ${serieD.min}-${serieD.max})`)
  ok("o piso do acesso fica abaixo do piso da Serie D", acesso.min < serieD.min,
    `(${acesso.min} x ${serieD.min})`)
  ok("nenhum clube do acesso alcanca a Serie B", acesso.max < 45, `(${acesso.max})`)
}

// 4. A UF derivada nunca pode contradizer a declarada. Zero conflitos foi o que
//    autorizou a deducao; se aparecer um, a regra deixou de ser segura.
{
  const UFS = new Set(["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"])
  const br = allPoolTeams.filter(t => (t.pais ?? "") === "Brasil")
  const semUF = br.filter(t => !String(t.estado ?? "").trim())
  ok("a deducao de UF cobriu a maior parte dos 138 sem UF", semUF.length <= 35,
    `(${semUF.length} ainda sem UF)`)
  for (const t of br) {
    const uf = String(t.estado ?? "").toUpperCase()
    if (uf && !UFS.has(uf)) { ok(`UF valida em ${t.nome}`, false, `(${uf})`); break }
  }
  ok("toda UF atribuida e uma UF real", br.every(t => {
    const uf = String(t.estado ?? "").toUpperCase()
    return !uf || UFS.has(uf)
  }))
}

// 5. A liga do clube pequeno e REGIONAL e contem o proprio clube.
{
  const capixaba = allPoolTeams.find(t => t.nome === "Serra" && t.estado === "ES")
  ok("o Serra-ES existe e ganhou a UF pelo file_key", Boolean(capixaba))
  if (capixaba) {
    const liga = completarLigaComPool("divisao_acesso_br", tamanhoDaLiga("divisao_acesso_br"), {
      file_key: capixaba.file_key, estado: capixaba.estado, prestigio: capixaba.prestigio,
    })
    ok("a liga tem o tamanho oficial", liga.length === 20, `(${liga.length})`)
    ok("o clube escolhido esta na propria liga",
      liga.some(t => t.file_key === capixaba.file_key))
    const forasteiros = liga.filter(t => !["ES", "SP", "RJ", "MG"].includes(String(t.estado ?? "")))
    ok("os adversarios sao todos do Sudeste", forasteiros.length === 0,
      `(${forasteiros.map(t => `${t.nome}/${t.estado}`).join(", ")})`)
  }
}

// 6. Sem ancora o comportamento antigo continua valendo — nenhuma das outras
//    divisoes do mundo pode ter mudado de forma.
{
  for (const div of ["championship", "eerste_divisie", "dritte_liga_ger"]) {
    const liga = completarLigaComPool(div)
    ok(`${div} continua com ${tamanhoDaLiga(div)} clubes`,
      liga.length === tamanhoDaLiga(div), `(${liga.length})`)
  }
}

// 7. O degrau existe nos dois sentidos: sobe para a Serie D e nao ha nada abaixo.
{
  ok("acima do acesso esta a Serie D", divisionAbove("divisao_acesso_br") === "serie_d",
    `(${divisionAbove("divisao_acesso_br")})`)
  ok("abaixo do acesso nao ha nada", divisionBelow("divisao_acesso_br") === null)
  ok("o acesso promove 4 clubes", promotionCount("divisao_acesso_br") === 4,
    `(${promotionCount("divisao_acesso_br")})`)
  ok("a base da piramide nao rebaixa ninguem", relegationCount("divisao_acesso_br") === 0,
    `(${relegationCount("divisao_acesso_br")})`)
  ok("a Serie D passou a rebaixar 4", relegationCount("serie_d") === 4,
    `(${relegationCount("serie_d")})`)
}

// 8. A virada de temporada faz clube subir de verdade — e sem inverter a
//    piramide, que e o risco da escala.
{
  const serieD = completarLigaComPool("serie_d").map(t => ({
    curto: t.curto, id: t.file_key, division: "serie_d", prestige: t.prestigio ?? 0,
  }))
  const acesso = getTeamsByDivision("divisao_acesso_br").slice(0, 20).map(t => ({
    curto: t.curto, id: t.file_key, division: "divisao_acesso_br", prestige: t.prestigio ?? 0,
  }))
  const overrides = evolvePyramids({
    clubs: [...serieD, ...acesso],
    userDivision: null,
    userFinalOrder: [],
    seed: 2026,
  })
  const subiram = Object.entries(overrides).filter(([, div]) => div === "serie_d")
  const desceram = Object.entries(overrides).filter(([, div]) => div === "divisao_acesso_br")
  ok("4 clubes sobem do acesso para a Serie D", subiram.length === 4, `(${subiram.length})`)
  ok("4 clubes descem da Serie D para o acesso", desceram.length === 4, `(${desceram.length})`)
  ok("quem sobe vinha mesmo do acesso",
    subiram.every(([id]) => acesso.some(c => c.id === id)))
  ok("quem desce vinha mesmo da Serie D",
    desceram.every(([id]) => serieD.some(c => c.id === id)))
}

console.log(`\n${passou} ok, ${falhou} falha(s)\n`)
if (falhou > 0) process.exit(1)

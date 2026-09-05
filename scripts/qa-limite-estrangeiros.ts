/**
 * O LIMITE DE ESTRANGEIROS E REGRA DO JOGO, NAO TEXTO DE REGULAMENTO.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/qa-limite-estrangeiros.ts
 *
 * ⚠️ ATE A 1.0.387 ISSO ERA SO TEXTO. `competition-regulations-2026.ts`
 * declarava "máximo de cinco estrangeiros simultaneamente em campo" e NADA no
 * jogo lia o campo `registrationRules` — o quarto caso do mesmo padrao nesta
 * linhagem, depois dos 3 medidores da 1.0.377, dos 4 focos da 1.0.383 e do
 * desempate da 1.0.387.
 */
import {
  limiteDeEstrangeiros, mensagemDeViolacao, violacaoDeEstrangeiros,
} from "@/lib/limite-de-estrangeiros"

let falhas = 0
const ok = (t: string) => console.log(`ok   ${t}`)
const erro = (t: string) => { console.log(`FALHA ${t}`); falhas++ }

function atleta(name: string, nationality?: string) {
  return { name, nationality }
}

function xiCom(estrangeiros: number, local = "Brasil"): { name: string; nationality?: string }[] {
  const time: { name: string; nationality?: string }[] = []
  for (let i = 0; i < estrangeiros; i++) time.push(atleta(`Gringo ${i + 1}`, "Argentina"))
  while (time.length < 11) time.push(atleta(`Local ${time.length}`, local))
  return time
}

// ── 1. Onde ha limite, ele vale ────────────────────────────────────────────
{
  if (violacaoDeEstrangeiros(xiCom(5), "serie_a") === null) ok("Brasil: cinco estrangeiros PASSA")
  else erro("Brasil: cinco estrangeiros foi recusado — o limite ficou apertado demais")

  const v = violacaoDeEstrangeiros(xiCom(6), "serie_a")
  if (v && v.escalados === 6 && v.limite === 5 && v.excedentes.length === 1) ok("Brasil: seis estrangeiros e RECUSADO, com um excedente nomeado")
  else erro(`Brasil: seis estrangeiros deu ${JSON.stringify(v)}`)

  const chile = violacaoDeEstrangeiros(xiCom(6, "Chile"), "primera_div_chi")
  if (chile) ok("Chile: seis estrangeiros e recusado")
  else erro("Chile: seis estrangeiros passou")
}

// ── 2. Onde NAO ha limite, nada e barrado ──────────────────────────────────
{
  // Europa nao tem limite de estrangeiro; um XI inteiro de fora e legal.
  for (const divisao of ["premier_league", "la_liga", "bundesliga"]) {
    if (violacaoDeEstrangeiros(xiCom(11, "Inglaterra"), divisao) === null) ok(`${divisao}: sem limite, XI inteiro de estrangeiros passa`)
    else erro(`${divisao}: inventou um limite que nao existe`)
  }
  if (limiteDeEstrangeiros("premier_league") === null) ok("a Premier League nao declara limite")
  else erro("a Premier League ganhou um limite do nada")
}

// ── 3. Divisao desconhecida nunca barra ────────────────────────────────────
{
  if (violacaoDeEstrangeiros(xiCom(11), undefined) === null) ok("sem divisao: nao barra")
  if (violacaoDeEstrangeiros(xiCom(11), "divisao_que_nao_existe") === null) ok("divisao desconhecida: nao barra")
  else erro("divisao desconhecida barrou a escalacao")
}

// ── 4. Atleta SEM nacionalidade conta como local ───────────────────────────
{
  // Save antigo pode nao ter o campo. Recusar por dado ausente transformaria
  // uma regra de futebol num defeito de migracao.
  const semDado = Array.from({ length: 11 }, (_, i) => atleta(`Atleta ${i}`, undefined))
  if (violacaoDeEstrangeiros(semDado, "serie_a") === null) ok("atleta sem nacionalidade conta como local — save antigo nao trava")
  else erro("elenco sem nacionalidade foi recusado; save antigo travaria")
}

// ── 5. A mensagem diz QUEM esta fora ───────────────────────────────────────
{
  const v = violacaoDeEstrangeiros(xiCom(7), "serie_a")
  if (!v) { erro("sete estrangeiros passou") }
  else {
    const msg = mensagemDeViolacao(v)
    if (msg.includes("7") && msg.includes("5") && msg.includes("Gringo")) ok("a mensagem traz o total, o limite e os nomes")
    else erro(`mensagem pobre: ${msg}`)
  }
}

// ── 6. O limite vale para as divisoes de baixo e o feminino ────────────────
{
  for (const divisao of ["serie_b", "serie_c", "serie_d", "brasileirao_fem_a1"]) {
    if (violacaoDeEstrangeiros(xiCom(6), divisao)) ok(`${divisao}: o limite vale aqui tambem`)
    else erro(`${divisao}: ficou de fora da regra`)
  }
}

console.log(falhas === 0 ? "\nLIMITE DE ESTRANGEIROS OK — a regra sai do texto e chega ao campo.\n" : `\n${falhas} falha(s).\n`)
process.exit(falhas === 0 ? 0 : 1)

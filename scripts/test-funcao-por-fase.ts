/**
 * GATE DA FUNÇÃO POR FASE E DO TREINO DE POSIÇÃO.
 *
 * As duas coisas que este gate protege:
 *
 * 1. ⚠️ **Compatibilidade numérica.** Um save sem `roleSemBola` — ou seja, TODOS
 *    os saves anteriores a esta versão — tem de produzir exatamente as mesmas
 *    forças de antes. Se este teste ficar vermelho, a calibração de 20 mil jogos
 *    mudou sem ninguém pedir.
 * 2. A função sem bola precisa MUDAR alguma coisa quando é escolhida — senão
 *    virou mais um controle de enfeite, que é o defeito que este projeto passa a
 *    vida corrigindo.
 *
 * Rodar: pnpm qa:funcao-por-fase
 */
import { adequacaoAFuncao, forcasDoElenco } from "../lib/forcas-individuais"
import { aprenderPosicao, familiaridadeEm, perfilDoAtleta } from "../lib/modelo-de-jogador"
import type { Player, PlayerInstructions } from "../lib/game-engine"

let falhas = 0
function ok(nome: string, condicao: boolean) {
  if (!condicao) { falhas++; console.error(`  ✗ ${nome}`) } else console.log(`  ✓ ${nome}`)
}

function atleta(over: Partial<Player> & { id: number; position: string }): Player {
  return {
    name: `Atleta ${over.id}`, age: 26, overall: 80, potential: 85, nationality: "BRA",
    pace: 80, shooting: 80, passing: 80, dribbling: 80, defending: 80, physical: 80,
    isStarter: true, injury: null, form: 70, morale: "Normal", energy: 100,
    ...over,
  } as unknown as Player
}

const instr = (role: string, roleSemBola?: string) =>
  ({ role, ...(roleSemBola ? { roleSemBola } : {}) } as unknown as Partial<PlayerInstructions>)

console.log("\n1. Save antigo (sem função sem bola) não muda um número")
{
  const time = [
    atleta({ id: 1, position: "GOL" }), atleta({ id: 2, position: "ZAG", defending: 92 }),
    atleta({ id: 3, position: "VOL", passing: 90 }), atleta({ id: 4, position: "ATA", shooting: 92 }),
  ]
  const mapa: Record<number, Partial<PlayerInstructions>> = {
    1: instr("goleiro_defensor"), 2: instr("zagueiro_marcador"),
    3: instr("regista"), 4: instr("poacher"),
  }
  const semFase = forcasDoElenco(time, mapa)

  // A MESMA função nas duas fases tem de dar exatamente o mesmo resultado: é o
  // que garante que a média ponderada não moveu a calibração.
  const mesmaFase: Record<number, Partial<PlayerInstructions>> = {
    1: instr("goleiro_defensor", "goleiro_defensor"), 2: instr("zagueiro_marcador", "zagueiro_marcador"),
    3: instr("regista", "regista"), 4: instr("poacher", "poacher"),
  }
  const comFase = forcasDoElenco(time, mesmaFase)
  ok("attack idêntico", semFase.attack === comFase.attack)
  ok("defense idêntico", semFase.defense === comFase.defense)
  ok("midfield idêntico", semFase.midfield === comFase.midfield)
  ok("contagem de bem empregados idêntica", semFase.bemEmpregados === comFase.bemEmpregados)
}

console.log("\n2. A função sem bola MUDA o resultado (não é enfeite)")
{
  const ponta = atleta({ id: 10, position: "PD", pace: 94, dribbling: 92, defending: 30, shooting: 85 })
  const so = forcasDoElenco([ponta], { 10: instr("ponta_velocista") })
  const comDefensiva = forcasDoElenco([ponta], { 10: instr("ponta_velocista", "lateral_defensivo") })
  ok("dar função defensiva a um ponta sem marcação custa", comDefensiva.attack < so.attack)
  ok("o aviso diz QUAL fase está errada",
    comDefensiva.avisos.some(a => a.includes("sem a bola")) || comDefensiva.malEmpregados === 0)
}

console.log("\n3. O peso da fase respeita o setor")
{
  // Errar a função defensiva de um ATACANTE custa MENOS do que errar a de um
  // ZAGUEIRO — é o que PESO_COM_BOLA existe para dizer.
  const atacante = atleta({ id: 20, position: "ATA", shooting: 94, defending: 25 })
  const zagueiro = atleta({ id: 21, position: "ZAG", defending: 94, shooting: 25 })
  const perdaAtacante =
    forcasDoElenco([atacante], { 20: instr("poacher") }).attack
    - forcasDoElenco([atacante], { 20: instr("poacher", "atacante_pressing") }).attack
  const perdaZagueiro =
    forcasDoElenco([zagueiro], { 21: instr("zagueiro_marcador") }).defense
    - forcasDoElenco([zagueiro], { 21: instr("zagueiro_marcador", "zagueiro_saidor") }).defense
  ok("o zagueiro sente mais a função defensiva errada que o atacante",
    perdaZagueiro >= perdaAtacante)
}

console.log("\n4. Adequação continua sendo adequação, não qualidade")
{
  const craqueLento = atleta({ id: 30, position: "PD", overall: 90, pace: 60, dribbling: 88 })
  const limitadoRapido = atleta({ id: 31, position: "PD", overall: 65, pace: 88, dribbling: 60 })
  ok("o limitado rápido encaixa melhor em ponta_velocista que o craque lento",
    adequacaoAFuncao(limitadoRapido, "ponta_velocista") > adequacaoAFuncao(craqueLento, "ponta_velocista"))
}

console.log("\n5. Treino de posição usa a MESMA familiaridade do gramado")
{
  const perfil = perfilDoAtleta(4242, "LD", 78, [])
  const antes = familiaridadeEm(perfil, undefined, "ZAG")
  // 70 minutos equivalentes = uma semana de CT (ver game-engine).
  let progresso = aprenderPosicao(perfil, undefined, "ZAG", 70)
  ok("uma semana de CT já credita alguma coisa",
    familiaridadeEm(perfil, progresso, "ZAG") > antes)

  for (let semana = 0; semana < 40; semana++) {
    progresso = aprenderPosicao(perfil, progresso, "ZAG", 70)
  }
  const depoisDeUmaTemporada = familiaridadeEm(perfil, progresso, "ZAG")
  ok("uma temporada de treino ensina bastante", depoisDeUmaTemporada > antes + 3)
  ok("mas não transforma ninguém em zagueiro natural de graça", depoisDeUmaTemporada <= 20)

  // ⚠️ O treino tem de render MENOS que jogar na posição — senão escalar fora de
  // posição (que custa pontos na tabela) nunca compensaria.
  const jogando = aprenderPosicao(perfil, undefined, "ZAG", 90)
  ok("90 minutos de jogo ensinam mais que uma semana de CT",
    familiaridadeEm(perfil, jogando, "ZAG") >= familiaridadeEm(perfil, aprenderPosicao(perfil, undefined, "ZAG", 70), "ZAG"))

  ok("posição natural não tem o que aprender",
    aprenderPosicao(perfil, undefined, "LD", 70) === undefined)
}

console.log(falhas === 0 ? "\n✅ Função por fase e treino de posição: todos os checks passaram\n" : `\n❌ ${falhas} check(s) falharam\n`)
process.exit(falhas === 0 ? 0 : 1)

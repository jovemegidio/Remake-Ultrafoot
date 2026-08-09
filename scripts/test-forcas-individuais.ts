/**
 * FORCAS INDIVIDUAIS — o que este teste protege.
 *
 * Ao dar efeito as 66 funcoes e as 7 instrucoes por atleta, os riscos sao os
 * mesmos que ja mordi neste projeto:
 *
 *   1. CONTAR QUALIDADE DUAS VEZES — o overall ja entra na forca do time. Aqui
 *      so pode valer ADEQUACAO. Um craque e um limitado igualmente bem
 *      empregados tem de receber a MESMA nota.
 *   2. EMPILHAR — ligar tudo e virar time impossivel.
 *   3. SOMAR EM VEZ DE MEDIAR — elenco grande valendo mais que elenco bom.
 *   4. FUNCAO NOVA QUEBRAR — as 66 atuais precisam classificar.
 */
import {
  adequacaoAFuncao, atributosDaFuncao, forcasDoElenco, TETO_INDIVIDUAL,
} from "../lib/forcas-individuais"
import type { Player, PlayerInstructions } from "../lib/game-engine"

let passou = 0
let falhou = 0
function ok(nome: string, cond: boolean, detalhe = "") {
  if (cond) { passou++; console.log(`  ok   ${nome}`) }
  else { falhou++; console.log(`  FALHA ${nome} ${detalhe}`) }
}

let id = 1
function atleta(p: Partial<Player> = {}): Player {
  const base = p.overall ?? 70
  return {
    id: id++, name: `Atleta ${id}`, position: "MEI", age: 25,
    overall: base, potential: base + 5, nationality: "BRA",
    pace: base, shooting: base, passing: base, dribbling: base, defending: base, physical: base,
    energy: 100, morale: "Normal", form: 70, contract: null, injury: null, isStarter: true,
    seasonStats: {} as Player["seasonStats"],
    ...p,
  } as Player
}

console.log("\nFORCAS INDIVIDUAIS\n")

// ─── 1. Todas as 66 funcoes classificam ─────────────────────────────────────
const TODAS_AS_FUNCOES = [
  "goleiro_defensor","goleiro_libero","goleiro_sweeper","goleiro_distribuidor",
  "zagueiro_central","zagueiro_stopper","zagueiro_cover","zagueiro_saidor",
  "zagueiro_libero","zagueiro_marcador","zagueiro_aereo","zagueiro_lider",
  "lateral_defensivo","lateral_equilibrado","lateral_ofensivo","ala","lateral_invertido",
  "ala_completo","lateral_cruzador","carrilero","lateral_zona","lateral_sobreposto",
  "volante_destruidor","volante_box_to_box","volante_saidor","meia_defensivo","regista",
  "volante_ancora","volante_cobertura","segundo_volante","meio_campo_central","volante_tecnico",
  "meia_central","meia_armador","meia_atacante","meia_box_to_box","enganche",
  "mezzala","trequartista","meia_infiltrador","meia_organizador","meia_livre",
  "meia_defensivo_avancado","construtor_jogo",
  "ponta","ponta_invertido","ala_ofensivo","meia_ponta",
  "extremo","ponta_fixo","ponta_flutuante","segundo_atacante_ponta","ponta_velocista","ponta_finalizador",
  "centroavante","atacante_movel","falso_nove","target_man","poacher",
  "atacante_completo","atacante_pressing","atacante_referencia","atacante_area",
  "segundo_atacante","atacante_profundidade","atacante_pivot",
]
{
  const sem = TODAS_AS_FUNCOES.filter(f => atributosDaFuncao(f).length === 0)
  ok(`as ${TODAS_AS_FUNCOES.length} funcoes recebem atributos-chave`, sem.length === 0, sem.join(", "))
  const naoEspecializadas = TODAS_AS_FUNCOES.filter(f => {
    const bom = atleta({ overall: 70, pace: 90, shooting: 90, passing: 90, dribbling: 90, defending: 90, physical: 90 })
    return adequacaoAFuncao(bom, f) <= 0
  })
  ok("atleta acima do proprio overall pontua em toda funcao", naoEspecializadas.length === 0,
    naoEspecializadas.slice(0, 4).join(", "))
}

// ─── 2. ADEQUACAO, NAO QUALIDADE ────────────────────────────────────────────
{
  // Dois atletas com o MESMO desequilibrio de atributos, qualidades diferentes.
  const craque = atleta({ overall: 90, pace: 98, defending: 82 })
  const limitado = atleta({ overall: 50, pace: 58, defending: 42 })
  const a = adequacaoAFuncao(craque, "ponta_velocista")
  const b = adequacaoAFuncao(limitado, "ponta_velocista")
  ok("craque e limitado igualmente bem empregados recebem a MESMA nota", a === b, `${a} x ${b}`)
  ok("a nota e positiva (o perfil serve a funcao)", a > 0, `${a}`)
}
{
  // Atleta uniforme nao ganha nem perde: nao ha desequilibrio a medir.
  const uniforme = atleta({ overall: 75 })
  ok("atleta uniforme tem adequacao zero", adequacaoAFuncao(uniforme, "regista") === 0)
}
{
  // Lento escalado como velocista PERDE, por melhor que seja.
  const lento = atleta({ overall: 88, pace: 60 })
  ok("craque lento como ponta_velocista fica negativo", adequacaoAFuncao(lento, "ponta_velocista") < 0)
}

// ─── 3. Limite: -2 a +2 ─────────────────────────────────────────────────────
{
  const extremo = atleta({ overall: 40, pace: 99, shooting: 99, passing: 99, dribbling: 99, defending: 99, physical: 99 })
  ok("adequacao nunca passa de +2", adequacaoAFuncao(extremo, "regista") <= 2)
  const oposto = atleta({ overall: 99, pace: 20, shooting: 20, passing: 20, dribbling: 20, defending: 20, physical: 20 })
  ok("adequacao nunca passa de -2", adequacaoAFuncao(oposto, "regista") >= -2)
}

// ─── 4. MEDIA, NAO SOMA ─────────────────────────────────────────────────────
{
  const instr = (role: string): Partial<PlayerInstructions> => ({ role } as Partial<PlayerInstructions>)
  const um = atleta({ position: "ATA", overall: 70, shooting: 85 })
  const onze = Array.from({ length: 11 }, () => atleta({ position: "ATA", overall: 70, shooting: 85 }))
  const mapaUm = { [um.id]: instr("poacher") }
  const mapaOnze = Object.fromEntries(onze.map(p => [p.id, instr("poacher")]))
  const a = forcasDoElenco([um], mapaUm).attack
  const b = forcasDoElenco(onze, mapaOnze).attack
  ok("11 atletas iguais nao valem 11x um", a === b, `${a} x ${b}`)
}

// ─── 5. NAO EMPILHAR ────────────────────────────────────────────────────────
{
  const tudo: Partial<PlayerInstructions> = {
    role: "atacante_completo",
    roaming: "liberdade_total", runs: "frequentemente", markingTightness: "apertado",
    closingDown: "mais", dribbling: "mais", passingRisk: "arriscado", crossFrequency: "mais",
    stayWider: true, cutInside: true, getForward: true, holdPosition: true, tackleHarder: true,
  } as Partial<PlayerInstructions>
  const time = Array.from({ length: 11 }, () => atleta({ position: "ATA", overall: 99, pace: 99, shooting: 99, passing: 99, dribbling: 99, defending: 99, physical: 99 }))
  const mapa = Object.fromEntries(time.map(p => [p.id, tudo]))
  const f = forcasDoElenco(time, mapa)
  ok("tudo ligado respeita o teto no ataque", Math.abs(f.attack) <= TETO_INDIVIDUAL, `${f.attack}`)
  ok("tudo ligado respeita o teto na defesa", Math.abs(f.defense) <= TETO_INDIVIDUAL, `${f.defense}`)
  ok("tudo ligado respeita o teto no meio", Math.abs(f.midfield) <= TETO_INDIVIDUAL, `${f.midfield}`)
  ok("ordens que se anulam sao apontadas", f.avisos.some(a => a.includes("se anulam")))
}

// ─── 6. Save antigo: sem instrucoes, efeito zero ────────────────────────────
{
  const time = Array.from({ length: 11 }, () => atleta())
  const f = forcasDoElenco(time, {})
  ok("sem instrucoes definidas o efeito e zero", f.attack === 0 && f.defense === 0 && f.midfield === 0)
  ok("sem instrucoes nao ha aviso", f.avisos.length === 0)
  ok("elenco vazio nao quebra", forcasDoElenco([], {}).attack === 0)
}

// ─── 7. O tecnico e avisado de quem esta fora de funcao ─────────────────────
{
  const lento = atleta({ name: "Tartaruga", position: "PD", overall: 85, pace: 55 })
  const mapa = { [lento.id]: { role: "ponta_velocista" } as Partial<PlayerInstructions> }
  const f = forcasDoElenco([lento], mapa)
  ok("atleta fora de funcao e contado", f.malEmpregados === 1)
  ok("e nomeado no aviso", f.avisos.some(a => a.includes("Tartaruga")))
  ok("o ataque cai", f.attack < 0, `${f.attack}`)
}
{
  const certo = atleta({ name: "Foguete", position: "PD", overall: 70, pace: 88 })
  const mapa = { [certo.id]: { role: "ponta_velocista" } as Partial<PlayerInstructions> }
  const f = forcasDoElenco([certo], mapa)
  ok("atleta bem empregado e contado", f.bemEmpregados === 1)
  ok("o ataque sobe", f.attack > 0, `${f.attack}`)
  ok("sem aviso quando esta tudo certo", f.avisos.length === 0)
}

// ─── 8. Funcao desconhecida nao quebra ──────────────────────────────────────
{
  const p = atleta({ position: "MEI" })
  ok("funcao inexistente cai no perfil neutro", atributosDaFuncao("funcao_que_nao_existe").length > 0)
  ok("e nao gera excecao", typeof adequacaoAFuncao(p, "funcao_que_nao_existe") === "number")
}

console.log(`\n${passou} ok, ${falhou} falha(s)\n`)
process.exit(falhou === 0 ? 0 : 1)

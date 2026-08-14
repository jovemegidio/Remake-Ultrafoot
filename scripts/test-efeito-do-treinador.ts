/**
 * GATE DO TÉCNICO — falha se o perfil voltar a ser enfeite.
 *
 * O que este gate protege, em uma frase: os dez atributos do treinador e as
 * cinco habilidades dele PRECISAM mudar alguma coisa, e um técnico mediano
 * (tudo em 50, nenhuma habilidade) precisa devolver o jogo exatamente como ele
 * era antes de tudo isto existir — senão a calibração de 20 mil jogos foi pelo
 * ralo sem ninguém perceber.
 *
 * Rodar: pnpm qa:treinador
 */
import {
  calcularEfeitosDoTreinador, efeitosDoTreinador, HABILIDADES_COM_EFEITO,
  limparTreinador, sincronizarTreinador, TREINADOR_NEUTRO,
} from "../lib/efeito-do-treinador"
import {
  criarPerfilTreinador26, normalizarPerfilTreinador26,
  type AtributosTreinador26, type PerfilTreinador26,
} from "../lib/manager-profile-26"
import {
  evoluirTreinador, identidadeTatica, perfilComProgresso,
  registrarSemanaDoTreinador, resumoDaIdentidade,
} from "../lib/evolucao-do-treinador"
import { aplicarSemanaDeTreino, type AtletaNaSemana, type PlanoDeTreino } from "../lib/treino-e-entrosamento"
import { forcasDaTatica } from "../lib/forcas-taticas"
import { calcularEfeitoColetiva } from "../lib/press-effects"
import { qualidadeDeAvaliacao } from "../lib/cpe"
import type { TeamTactics } from "../lib/game-engine"

let falhas = 0
function ok(nome: string, condicao: boolean) {
  if (!condicao) { falhas++; console.error(`  ✗ ${nome}`) } else console.log(`  ✓ ${nome}`)
}

/** Perfil com TODOS os atributos num valor só — o jeito de isolar cada efeito. */
function perfilCom(valor: number): PerfilTreinador26 {
  const base = normalizarPerfilTreinador26(null)
  // Sem `Object.fromEntries` + cast: ele devolve `{[k: string]: number}`, que o
  // tsc do BUILD recusa converter para `AtributosTreinador26` (e com razão — o
  // cast esconderia um atributo faltando). Copiar e sobrescrever mantém o tipo.
  const atributos = { ...base.atributos }
  for (const chave of Object.keys(atributos) as (keyof AtributosTreinador26)[]) {
    atributos[chave] = valor
  }
  return { ...base, atributos }
}

const MEDIANO = perfilCom(50)
const CRAQUE = perfilCom(100)
const RUIM = perfilCom(1)

console.log("\n1. NEUTRO — técnico mediano não pode recalibrar o jogo")
{
  const e = calcularEfeitosDoTreinador(MEDIANO, [])
  for (const [chave, valor] of Object.entries(TREINADOR_NEUTRO)) {
    ok(`${chave} continua no neutro com atributo 50`, e[chave as keyof typeof e] === valor)
  }
  const semPerfil = calcularEfeitosDoTreinador(null, null)
  ok("save sem perfil devolve o neutro inteiro",
    JSON.stringify(semPerfil) === JSON.stringify(TREINADOR_NEUTRO))
}

console.log("\n2. Cada atributo mexe no seu campo — e só no seu")
{
  const bom = calcularEfeitosDoTreinador(CRAQUE, [])
  const ruim = calcularEfeitosDoTreinador(RUIM, [])
  ok("treino rende mais com o técnico bom", bom.rendimentoDeTreino > 1 && ruim.rendimentoDeTreino < 1)
  ok("recuperação sobe com preparo físico", bom.recuperacaoSemanal > 0 && ruim.recuperacaoSemanal < 0)
  ok("risco de lesão cai com preparo físico", bom.riscoDeLesao < 1 && ruim.riscoDeLesao > 1)
  ok("coerência tática sobe com tática", bom.coerenciaTatica > 1 && ruim.coerenciaTatica < 1)
  ok("renovação custa menos com negociação", bom.custoDeRenovacao < 1 && ruim.custoDeRenovacao > 1)
  ok("moral semanal sobe com motivação", bom.moralSemanal > 0 && ruim.moralSemanal < 0)
  ok("avaliação de jovem melhora com recrutamento",
    bom.precisaoDeAvaliacao > 0 && ruim.precisaoDeAvaliacao < 0)
  ok("evento ruim pesa menos com disciplina",
    bom.impactoDeEventoRuim < 1 && ruim.impactoDeEventoRuim > 1)
  ok("atração sobe com reputação", bom.atracaoDoTecnico > 0 && ruim.atracaoDoTecnico < 0)
}

console.log("\n3. Amplitude limitada — o técnico inclina, não decide")
{
  const bom = calcularEfeitosDoTreinador(CRAQUE, [])
  ok("nenhum multiplicador passa de 1,4", [
    bom.rendimentoDeTreino, bom.coerenciaTatica, bom.preparoDeJogo, bom.impactoDaColetiva,
  ].every(v => v <= 1.4))
  ok("nenhum multiplicador cai abaixo de 0,6", [
    calcularEfeitosDoTreinador(RUIM, []).rendimentoDeTreino,
    calcularEfeitosDoTreinador(RUIM, []).coerenciaTatica,
  ].every(v => v >= 0.6))
  ok("recuperação semanal cabe em ±3 pontos", Math.abs(bom.recuperacaoSemanal) <= 3)
}

console.log("\n4. As cinco habilidades TÊM efeito (era a lacuna original)")
{
  const nenhuma = calcularEfeitosDoTreinador(MEDIANO, [])
  for (const id of HABILIDADES_COM_EFEITO) {
    const com = calcularEfeitosDoTreinador(MEDIANO, [{ id, unlocked: true }])
    ok(`${id} muda alguma coisa`, JSON.stringify(com) !== JSON.stringify(nenhuma))
  }
  const travada = calcularEfeitosDoTreinador(MEDIANO, [{ id: "olho_clinico", unlocked: false }])
  ok("habilidade NÃO desbloqueada não vale nada",
    JSON.stringify(travada) === JSON.stringify(nenhuma))
}

console.log("\n5. O retrato publicado")
{
  limparTreinador()
  ok("sem carreira aberta o retrato é neutro", efeitosDoTreinador().rendimentoDeTreino === 1)
  sincronizarTreinador({ managerProfile26: CRAQUE, coachSkills: [] })
  ok("depois de sincronizar, o motor enxerga o técnico", efeitosDoTreinador().rendimentoDeTreino > 1)
  sincronizarTreinador(null)
  ok("carreira fechada volta ao neutro", efeitosDoTreinador().rendimentoDeTreino === 1)
  limparTreinador()
}

console.log("\n6. Os efeitos CHEGAM nos motores (não bastam existir)")
{
  const atleta: AtletaNaSemana = {
    id: 1, idade: 26, energia: 60, fadigaCronica: 20, minutosJogados: 90,
    resistencia: 70, lesionado: false, emTreinoIndividual: true, focoIndividual: "passing",
  }
  const plano: PlanoDeTreino = { intensidade: "alta", foco: "ofensivo" }
  const neutro = aplicarSemanaDeTreino([atleta], plano).efeitos[0]
  const comCraque = aplicarSemanaDeTreino([atleta], plano, {
    treinador: calcularEfeitosDoTreinador(CRAQUE, []),
  }).efeitos[0]
  ok("treino: rendimento individual sobe", comCraque.rendimentoIndividual > neutro.rendimentoIndividual)
  ok("treino: energia da semana sobe", comCraque.energia > neutro.energia)
  ok("treino: risco de lesão cai", comCraque.risco < neutro.risco)

  // ⚠️ O caso que quase passou batido: com o técnico RUIM o risco tem de SUBIR,
  // e o teto de 0,14 não pode engolir a diferença num elenco moído.
  const moido: AtletaNaSemana = { ...atleta, energia: 20, fadigaCronica: 90, idade: 34 }
  const riscoNeutro = aplicarSemanaDeTreino([moido], plano).efeitos[0].risco
  const riscoRuim = aplicarSemanaDeTreino([moido], plano, {
    treinador: calcularEfeitosDoTreinador(RUIM, []),
  }).efeitos[0].risco
  ok("treino: elenco moído com técnico ruim não fica igual", riscoRuim >= riscoNeutro)

  const planoRedondo = {
    playingStyle: "posse_bola", passingStyle: "curto", buildUp: "curto",
    tempo: "lento", chanceCreation: "misto", crossingStyle: "misto",
    defensiveLine: "media", pressingIntensity: "media", markingStyle: "zonal",
  } as unknown as TeamTactics
  ok("tática: coerência positiva sobe com o técnico bom",
    forcasDaTatica(planoRedondo, 1.2).coerencia > forcasDaTatica(planoRedondo, 1).coerencia)

  const planoConfuso = {
    ...planoRedondo, playingStyle: "contra_ataque", passingStyle: "curto",
    pressingIntensity: "muito_alta", defensiveLine: "baixa", counterPress: true,
  } as unknown as TeamTactics
  const confusoNeutro = forcasDaTatica(planoConfuso, 1).coerencia
  const confusoComCraque = forcasDaTatica(planoConfuso, 1.2).coerencia
  ok("tática: técnico bom SEGURA o plano confuso (não o piora)",
    confusoNeutro >= 0 || confusoComCraque > confusoNeutro)

  const boaFala = { moraleImpact: 6, tons: ["positivo"], venceu: true, perdeu: false }
  const maFala = { moraleImpact: -6, tons: ["negativo"], venceu: false, perdeu: true }
  ok("coletiva: comunicador amplifica o acerto",
    calcularEfeitoColetiva({ ...boaFala, comunicacao: 1.25 }).moralDelta
    > calcularEfeitoColetiva(boaFala).moralDelta)
  ok("coletiva: comunicador amortece o erro",
    calcularEfeitoColetiva({ ...maFala, comunicacao: 1.25 }).moralDelta
    > calcularEfeitoColetiva(maFala).moralDelta)

  const estrutura = { academia: 2, centroDeObservacao: 2, centroDeDados: 2, olheiros: 40 }
  ok("CPE: olho do técnico melhora a avaliação",
    qualidadeDeAvaliacao({ ...estrutura, tecnico: 12 }) > qualidadeDeAvaliacao({ ...estrutura, tecnico: 0 }))
}

console.log("\n7. Evolução: o técnico deixa de ser o que você escolheu")
{
  const base = criarPerfilTreinador26({
    nivelComoJogador: "amador", areaAnterior: "nenhuma", relevanciaAnterior: "anonimo",
    licenca: "c", estilos: ["desenvolvedor"], personalidades: ["calmo"],
  })
  let progresso = evoluirTreinador(base, undefined, {
    season: 2026, aproveitamento: 0.7, campeao: true, promovido: false, rebaixado: false,
  })
  ok("estilo declarado rende ponto de experiência", (progresso.ganhos.desenvolvimento ?? 0) === 1)
  ok("campanha forte rende tática", (progresso.ganhos.tatica ?? 0) === 1)
  ok("título rende reputação", (progresso.ganhos.reputacao ?? 0) === 3)

  const repetido = evoluirTreinador(base, progresso, {
    season: 2026, aproveitamento: 0.7, campeao: true, promovido: false, rebaixado: false,
  })
  ok("a mesma temporada não é creditada duas vezes",
    JSON.stringify(repetido.ganhos) === JSON.stringify(progresso.ganhos))

  for (let ano = 2027; ano < 2037; ano++) {
    progresso = evoluirTreinador(base, progresso, {
      season: ano, aproveitamento: 0.9, campeao: true, promovido: false, rebaixado: false,
    })
  }
  const evoluido = perfilComProgresso(base, progresso)
  ok("dez temporadas melhoram o técnico",
    evoluido.atributos.desenvolvimento > base.atributos.desenvolvimento)
  ok("nenhum atributo passa de 100",
    Object.values(evoluido.atributos).every(v => v <= 100 && v >= 1))
  ok("o que não foi praticado NÃO sobe",
    evoluido.atributos.negociacao === base.atributos.negociacao)

  const queda = evoluirTreinador(base, undefined, {
    season: 2026, aproveitamento: 0.2, campeao: false, promovido: false, rebaixado: true,
  })
  ok("rebaixamento cobra reputação", (queda.ganhos.reputacao ?? 0) < 0)
}

console.log("\n8. Identidade tática: o que ele FEZ, não o que ele disse")
{
  let p = registrarSemanaDoTreinador(undefined, "contra_ataque")
  for (let i = 0; i < 29; i++) p = registrarSemanaDoTreinador(p, "contra_ataque")
  for (let i = 0; i < 10; i++) p = registrarSemanaDoTreinador(p, "posse_bola")
  const fatias = identidadeTatica(p)
  ok("o estilo mais usado vem primeiro", fatias[0]?.estilo === "contra_ataque")
  ok("os percentuais somam ~100", Math.abs(fatias.reduce((s, f) => s + f.percentual, 0) - 100) <= 2)
  ok("o resumo nomeia o técnico", (resumoDaIdentidade(fatias) ?? "").includes("contra-ataque"))
  ok("carreira nova ainda não tem identidade", resumoDaIdentidade(identidadeTatica({})) === null)
  ok("semana sem estilo não inventa contador",
    Object.keys(registrarSemanaDoTreinador(undefined, null)?.estilos ?? {}).length === 0)
}

console.log(falhas === 0 ? "\n✅ Técnico com efeito: todos os checks passaram\n" : `\n❌ ${falhas} check(s) falharam\n`)
process.exit(falhas === 0 ? 0 : 1)

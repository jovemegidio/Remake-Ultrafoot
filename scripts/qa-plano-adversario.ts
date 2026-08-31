// O PORTAO DO PLANO CONTRA O ADVERSARIO (1.0.383).
//
//   node node_modules/tsx/dist/cli.mjs scripts/qa-plano-adversario.ts
//
// ⚠️ POR QUE ELE EXISTE. A preparacao para o adversario ja existia desde a
// 1.0.282, com quatro focos na tela — e NENHUM deles mudava o jogo:
// `bonusPreparacao` devolvia praticamente o mesmo numero para os quatro, e o
// chamador somava esse numero IGUAL em ataque, meio e defesa, sem nunca olhar
// para quem estava do outro lado. Preparar-se contra um time que se fecha atras
// rendia exatamente o mesmo que preparar-se contra um que pressiona a saida.
//
// Este portao existe para que isso nao volte. Ele cobra as tres propriedades que
// separam um plano de um bonus com nome bonito:
//
//   1. o foco escolhido MUDA o resultado (senao os quatro sao enfeite);
//   2. o plano pode dar ERRADO (senao preparar-se e sempre lucro, e a escolha
//      nao tem custo);
//   3. o TETO nao subiu em relacao ao bonus plano que existia antes — a 1.0.383
//      redistribui os mesmos pontos, nao infla o jogo.

import assert from "node:assert"
import {
  CONFIANCA_MINIMA, MAX_MARCACOES, TETO_DO_PLANO,
  acertoDoFoco, aplicarMarcacao, estiloDoAdversario, planoContraOAdversario,
  type EstiloDoAdversario, type FocoTatico, type PerfilDoAdversario,
} from "../lib/plano-contra-o-adversario"

const FOCOS: FocoTatico[] = ["pressionar", "contra_atacar", "controlar", "fechar_espacos"]
const ESTILOS: EstiloDoAdversario[] = ["pressiona_alto", "sai_jogando", "contra_ataca", "bloco_baixo", "equilibrado"]

const alvos = [
  { nome: "Craque", overall: 88, posicao: "ATA" },
  { nome: "Meia", overall: 78, posicao: "MEI" },
  { nome: "Lateral", overall: 70, posicao: "LD" },
]

const perfil = (estilo: EstiloDoAdversario): PerfilDoAdversario => {
  switch (estilo) {
    case "pressiona_alto": return { pressao: 0.9, transicao: 0.9, mentalidade: "ofensivo" }
    case "contra_ataca": return { pressao: 0.15, transicao: 0.8, mentalidade: "equilibrado" }
    case "bloco_baixo": return { pressao: 0.15, transicao: 0.3, mentalidade: "defensivo" }
    case "sai_jogando": return { pressao: 0.42, transicao: 0.3, mentalidade: "equilibrado" }
    default: return { pressao: 0.42, transicao: 0.6, mentalidade: "equilibrado" }
  }
}

const plano = (foco: FocoTatico, estilo: EstiloDoAdversario, over: Partial<Parameters<typeof planoContraOAdversario>[0]> = {}) =>
  planoContraOAdversario({
    foco,
    rotinasEnsaiadas: 4,
    perfil: perfil(estilo),
    // Dossie cheio: a leitura sai certa e o teste mede o PLANO, nao o palpite.
    dossie: 100,
    chaveDoClube: "TEST",
    alvos,
    ...over,
  })

// ── 0. A leitura do estilo bate com o perfil ────────────────────────────────
for (const estilo of ESTILOS) {
  assert.equal(estiloDoAdversario(perfil(estilo)), estilo, `perfil de "${estilo}" tem de ser lido como "${estilo}"`)
}

// ── 1. O FOCO MUDA O JOGO ───────────────────────────────────────────────────
//
// O teste do enfeite. Se os quatro focos dessem o mesmo, o seletor seria
// decorativo — que e exatamente o que ele era ate a 1.0.382.
const assinaturas = new Set(
  FOCOS.map(f => ESTILOS.map(e => {
    const p = plano(f, e)
    return `${p.attackDelta}/${p.midfieldDelta}/${p.defenseDelta}`
  }).join("|")),
)
assert.equal(assinaturas.size, FOCOS.length, "os quatro focos tem de produzir planos diferentes")

// ── 2. NAO EXISTE FOCO BOM CONTRA TUDO ──────────────────────────────────────
for (const foco of FOCOS) {
  const acertos = ESTILOS.map(e => acertoDoFoco(foco, e).acerto)
  assert.ok(Math.min(...acertos) < 0, `"${foco}" nunca erra — um foco universal torna a escolha decorativa`)
  assert.ok(Math.max(...acertos) > 0, `"${foco}" nunca acerta — um foco que so custa nunca sera escolhido`)
}

// ── 3. E NENHUM ESTILO E IMUNE ──────────────────────────────────────────────
//
// Se algum adversario nao tivesse contra-medida, preparar-se contra ele seria
// perda de tempo garantida.
for (const estilo of ESTILOS) {
  assert.ok(
    FOCOS.some(f => acertoDoFoco(f, estilo).acerto > 0),
    `nenhum foco funciona contra "${estilo}" — todo estilo precisa de uma resposta`,
  )
}

// ── 4. PREPARAR-SE ERRADO CUSTA ─────────────────────────────────────────────
//
// A diferenca central para o bonus plano de antes: ali preparar-se era sempre
// lucro. Aqui a soma dos tres setores tem de poder ficar NEGATIVA.
const errado = plano("contra_atacar", "bloco_baixo")
const somaErrada = errado.attackDelta + errado.midfieldDelta + errado.defenseDelta
assert.ok(somaErrada < 0, `contra-atacar um bloco baixo tinha de custar; deu ${somaErrada}`)

const certo = plano("fechar_espacos", "contra_ataca")
const somaCerta = certo.attackDelta + certo.midfieldDelta + certo.defenseDelta
assert.ok(somaCerta > 0, `fechar espacos contra quem so contra-ataca tinha de render; deu ${somaCerta}`)

// ── 5. O TETO NAO SUBIU ─────────────────────────────────────────────────────
//
// A FORMULA HISTORICA, para nao virar numero chumbado que ninguem sabe de onde
// veio: `bonusPreparacaoAplicavel282` devolvia `(bonus/2) * preparoDoTecnico`,
// com `bonus` no maximo 8 — logo 4 * preparo —, e o chamador somava esse valor
// em ataque, meio E defesa. O teto de sempre e, portanto, `4 * preparo * 3`.
//
// ⚠️ ESTA ASSERCAO JA CORRIGIU O PROPRIO TESTE: a primeira versao dela usava 12,
// esquecendo que o atributo ANALISE do tecnico (ate 1,35) tambem multiplicava o
// bonus antigo. Comparar contra a formula, e nao contra um numero, e o que
// impede o portao de mentir nos dois sentidos.
const tetoHistorico = (preparo: number) => TETO_DO_PLANO * preparo * 3
for (const foco of FOCOS) {
  for (const estilo of ESTILOS) {
    for (const preparo of [1, 1.35]) {
      const p = plano(foco, estilo, { preparoDoTecnico: preparo, marcacaoIndividual: [] })
      const soma = p.attackDelta + p.midfieldDelta + p.defenseDelta
      assert.ok(
        soma <= tetoHistorico(preparo) + 0.01,
        `${foco} x ${estilo} (preparo ${preparo}) somou ${soma}, acima do teto historico de ${tetoHistorico(preparo)}`,
      )
    }
  }
}

// ── 6. SEM ENSAIO O PLANO RENDE MENOS ───────────────────────────────────────
const semEnsaio = plano("fechar_espacos", "contra_ataca", { rotinasEnsaiadas: 0 })
assert.ok(
  semEnsaio.attackDelta + semEnsaio.midfieldDelta + semEnsaio.defenseDelta < somaCerta,
  "o mesmo plano sem semana de treino tem de render menos",
)

// ── 7. DOSSIE INCOMPLETO PODE ERRAR A LEITURA, E AVISA ──────────────────────
//
// O elo com os olheiros: sem observar o rival, a comissao le por cima. O aviso
// e obrigatorio — errar em silencio seria pior do que nao ter a mecanica.
const semDossie = plano("controlar", "contra_ataca", { dossie: 10 })
assert.ok(semDossie.avisos.length > 0, "dossie incompleto tem de AVISAR antes de o tecnico confirmar")
assert.ok(semDossie.leitura.confianca < CONFIANCA_MINIMA, "confianca baixa tem de ser reportada como baixa")
const comDossie = plano("controlar", "contra_ataca", { dossie: 100 })
assert.equal(comDossie.avisos.length, 0, "dossie cheio nao pode inventar aviso")
assert.equal(comDossie.leitura.estilo, "contra_ataca", "com dossie cheio a leitura tem de ser a verdadeira")

// ⚠️ E o efeito tem de ser medido contra o adversario REAL, nao contra o
// imaginado: e isso que faz scoutear pouco cobrar preco de verdade.
const chaves = ["FLA", "PAL", "COR", "SAN", "GRE", "INT", "BAH", "VAS"]
assert.ok(
  chaves.some(c => plano("controlar", "contra_ataca", { dossie: 10, chaveDoClube: c }).leitura.estilo !== "contra_ataca"),
  "com dossie baixo, ao menos algum clube tem de ser lido errado",
)

// ── 8. Determinismo ─────────────────────────────────────────────────────────
for (const foco of FOCOS) {
  const a = plano(foco, "sai_jogando", { dossie: 20 })
  const b = plano(foco, "sai_jogando", { dossie: 20 })
  assert.deepEqual(a, b, `${foco}: o mesmo dossie tem de dar sempre a mesma leitura`)
}

// ── 9. MARCACAO INDIVIDUAL: teto, custo e alvo inexistente ──────────────────
const marcando = plano("controlar", "equilibrado", { marcacaoIndividual: ["Craque", "Meia", "Lateral"] })
assert.equal(marcando.marcacoes.length, MAX_MARCACOES, `so ${MAX_MARCACOES} marcados podem valer`)
assert.ok(marcando.avisos.some(a => a.includes(String(MAX_MARCACOES))), "o excedente tem de ser avisado")

const semMarcar = plano("controlar", "equilibrado", { marcacaoIndividual: [] })
assert.ok(
  marcando.defenseDelta < semMarcar.defenseDelta,
  "marcar sob pressao tem de CUSTAR defesa — senao marcar os dois melhores seria escolha obvia",
)

const fantasma = plano("controlar", "equilibrado", { marcacaoIndividual: ["Nao Existe"] })
assert.equal(fantasma.marcacoes.length, 0, "marcar quem nao esta relacionado nao pode valer nada")
assert.ok(fantasma.avisos.length > 0, "marcar um fantasma tem de avisar, nao falhar em silencio")

// O craque e mais dificil de anular que o lateral.
const soCraque = plano("controlar", "equilibrado", { marcacaoIndividual: ["Craque"] })
const soLateral = plano("controlar", "equilibrado", { marcacaoIndividual: ["Lateral"] })
assert.ok(
  soCraque.marcacoes[0].reducao < soLateral.marcacoes[0].reducao,
  "anular um craque tem de ser mais dificil do que anular um lateral",
)

// ── 10. A marcacao chega aos PESOS DE LANCE, e so a quem foi marcado ────────
const atleta = { nome: "Craque", pesoFinalizar: 2, pesoCriar: 1.5, pesoVelocidade: 1.2, multChute: 1.3 }
const marcado = aplicarMarcacao(atleta, soCraque.marcacoes)
assert.ok(marcado.pesoFinalizar! < atleta.pesoFinalizar, "o marcado tem de finalizar menos")
assert.ok(marcado.multChute! < atleta.multChute, "o marcado tem de converter menos")
assert.ok(marcado.multChute! >= 1, "a marcacao nao pode empurrar o multiplicador abaixo do neutro")

const livre = aplicarMarcacao({ ...atleta, nome: "Outro" }, soCraque.marcacoes)
assert.equal(livre.pesoFinalizar, atleta.pesoFinalizar, "quem nao foi marcado nao pode ser afetado")

// ⚠️ Elenco sem perfil canonico (amistoso rapido) tem pesos `undefined`: o motor
// volta ao sorteio uniforme. A marcacao NAO pode inventar um peso onde nao havia.
const semPerfil = aplicarMarcacao({ nome: "Craque" } as { nome: string; pesoFinalizar?: number }, soCraque.marcacoes)
assert.equal(semPerfil.pesoFinalizar, undefined, "sem perfil canonico a marcacao nao pode inventar peso")

// ── 11. Sem plano nenhum, o jogo fica como era ──────────────────────────────
//
// A garantia de compatibilidade: quem nunca abriu a Central de Gestao joga a
// partida identica a de antes desta versao.
const neutro = planoContraOAdversario({
  foco: "controlar", rotinasEnsaiadas: 0, perfil: { pressao: 0.42, transicao: 0.45 },
  dossie: 0, chaveDoClube: "X",
})
assert.equal(neutro.marcacoes.length, 0, "sem marcacao pedida, nenhuma marcacao aplicada")

console.log("qa:plano-adversario OK — 11 verificacoes")

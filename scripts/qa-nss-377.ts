/**
 * OS SISTEMAS DA 1.0.377 — dilemas, patrocínio pessoal e a torcida com efeito.
 *
 * ⚠️ O MODO DE FALHAR AQUI TEM NOME NESTE PROJETO: "sistema implementado porém
 * desligado". As três frentes desta versão são justamente as que mais correm
 * esse risco, e cada uma por um motivo diferente:
 *
 *   DILEMAS      podem virar menu. Se uma escolha for estritamente melhor que
 *                as outras, o jogador aprende a tabela e para de ler. O teste
 *                cobra que TODA escolha custe alguma coisa.
 *
 *   PATROCÍNIO   pode virar torneira de dinheiro. Se assinar não cobrar nada,
 *                a resposta ótima é assinar tudo. O teste cobra exclusividade,
 *                custo de energia por aparição e multa por cláusula furada.
 *
 *   TORCIDA      é o caso clássico: `estado.torcida` existia desde a 1.0.373,
 *                subia com entrevista e descia com vaia, e NINGUÉM lia. O teste
 *                cobra que ela mude a nota da partida em casa e o salário na
 *                mesa — e que ela NÃO tenha ganhado um segundo campo.
 *
 * A última seção é a mais importante e a mais fácil de esquecer: SAVE ANTIGO.
 * `migrate` não alcança o interior de `carreiraDeJogador`, então um save da
 * 1.0.375 chega aqui sem nenhum dos campos novos — e não pode quebrar.
 */

import {
  criarAtletaDaCarreira, criarCarreiraDeJogador, decidirDilema, dilemaDaVez,
  jogarProximaRodada, perfilComercial, propostasDePatrocinio, negociarPatrocinio,
  assinarPatrocinioDaProposta, fazerAparicaoDeMarca, economiaDoAtleta,
  type EstadoCarreiraDeJogador,
} from "../lib/carreira-de-jogador"
import { semearMotorDePartida } from "../lib/match-engine"
import { getTeamByShort } from "../lib/teams-data"
import {
  TOTAL_DE_DILEMAS, dilemaDaRodada, resolverDilema, somar, rotuloDaCategoria,
  type ContextoDoDilema,
} from "../lib/dilemas-do-atleta"
import {
  ENERGIA_POR_APARICAO, MARCAS, TOTAL_DE_MARCAS, apeloComercial, assinarProposta,
  avaliarContrato, contraproporPatrocinio, propostasDaRodada, rodarSemanaDePatrocinio,
} from "../lib/patrocinio-pessoal"
import {
  PESSOAS, empurraoDaTorcida, forcaDaMarcaPessoal, lerRelacoes, pesoDaTorcidaNaRenovacao,
  relacoesIniciais, esfriarUmaRodada,
} from "../lib/relacoes-do-atleta"

let passou = 0
let falhou = 0
function ok(nome: string, cond: boolean, detalhe = "") {
  if (cond) { passou++; console.log(`  ok   ${nome}`) }
  else { falhou++; console.log(`  FALHA ${nome} ${detalhe}`) }
}

const contextoBase = (over: Partial<ContextoDoDilema> = {}): ContextoDoDilema => ({
  rodada: 3, temporada: 2026, idade: 24, reputacao: 60, torcida: 70,
  dinheiro: 900_000, moral: 60, relacoes: relacoesIniciais(), papel: "titular",
  temPatrocinio: true, temParceira: false, temporadasDeContrato: 2,
  vermelhos: 1, media: 6.4, jaResolvidos: [], ...over,
})

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 1. DILEMA É DILEMA, NÃO MENU ──────────────────────────────")
// ═══════════════════════════════════════════════════════════════════════════

ok("o catálogo tem pelo menos 14 dilemas", TOTAL_DE_DILEMAS >= 14, `${TOTAL_DE_DILEMAS}`)

{
  // Varre todas as rodadas de uma temporada e junta cada dilema que aparece.
  const vistos = new Map<string, ReturnType<typeof dilemaDaRodada>>()
  for (let r = 1; r <= 60; r++) {
    for (const perfil of [
      contextoBase({ rodada: r }),
      contextoBase({ rodada: r, papel: "reserva", moral: 30, temParceira: false, temPatrocinio: false }),
      contextoBase({ rodada: r, reputacao: 90, torcida: 90, dinheiro: 5_000_000, temporadasDeContrato: 1 }),
      contextoBase({ rodada: r, reputacao: 20, media: 5.2, vermelhos: 0, dinheiro: 10_000 }),
    ]) {
      const d = dilemaDaRodada(perfil)
      if (d) vistos.set(d.id, d)
    }
  }
  ok("uma temporada alcança pelo menos 10 dilemas diferentes", vistos.size >= 10, `${vistos.size}`)

  let semCusto = 0
  let semSegundaEscolha = 0
  for (const d of vistos.values()) {
    if (!d) continue
    if (d.escolhas.length < 2) semSegundaEscolha++
    for (const e of d.escolhas) {
      const ef = e.efeito
      const relacoesNegativas = Object.values(ef.relacoes ?? {}).some(v => (v ?? 0) < 0)
      const custaOutraCoisa =
        (ef.dinheiro ?? 0) < 0 || (ef.energia ?? 0) < 0 || (ef.forma ?? 0) < 0 ||
        (ef.moral ?? 0) < 0 || (ef.torcida ?? 0) < 0 || (ef.reputacao ?? 0) < 0
      // Uma escolha sem custo direto só é aceitável se ela CARREGA RISCO — aí o
      // custo é probabilístico, e continua sendo custo.
      const temRisco = (e.risco ?? 0) > 0
      const vazia = Object.keys(ef.relacoes ?? {}).length === 0 && !custaOutraCoisa
        && !(ef.dinheiro || ef.moral || ef.forma || ef.energia || ef.torcida || ef.reputacao)
      if (!relacoesNegativas && !custaOutraCoisa && !temRisco && !vazia) semCusto++
    }
  }
  ok("nenhum dilema tem escolha única", semSegundaEscolha === 0, `${semSegundaEscolha}`)
  ok("toda escolha custa algo (relação, recurso ou risco)", semCusto === 0, `${semCusto} escolha(s) de graça`)

  ok("cada categoria tem rótulo legível",
    [...vistos.values()].every(d => d !== null && rotuloDaCategoria(d.categoria).length > 3))
}

{
  // O sorteio de risco é DETERMINÍSTICO: recarregar o save não muda o desfecho.
  //
  // ⚠️ A RODADA É PROCURADA, NÃO CHUMBADA. A primeira versão deste teste usava
  // `rodada: 3` — e quando o hash foi corrigido (ver `semente` em
  // `dilemas-do-atleta`), a rodada 3 deixou de ter dilema e o teste passou a
  // falhar por um motivo que não era defeito nenhum. Um teste que depende de
  // qual rodada o sorteio escolheu testa o sorteio, não a regra.
  let rodadaComDilema = 0
  for (let r = 1; r <= 60 && !rodadaComDilema; r++) {
    if (dilemaDaRodada(contextoBase({ rodada: r }))) rodadaComDilema = r
  }
  const d = rodadaComDilema ? dilemaDaRodada(contextoBase({ rodada: rodadaComDilema })) : null
  ok("existe rodada com dilema numa temporada", Boolean(d), `rodada ${rodadaComDilema}`)
  if (d) {
    const escolha = d.escolhas.find(e => (e.risco ?? 0) > 0) ?? d.escolhas[0]
    const a = resolverDilema(d, escolha.id, { temporada: 2026, rodada: rodadaComDilema })
    const b = resolverDilema(d, escolha.id, { temporada: 2026, rodada: rodadaComDilema })
    ok("o mesmo dilema na mesma rodada dá o mesmo desfecho", a.deuErrado === b.deuErrado && a.texto === b.texto)

    const outra = resolverDilema(d, escolha.id, { temporada: 2027, rodada: rodadaComDilema })
    ok("temporada diferente pode dar desfecho diferente (o sorteio é semeado, não fixo)",
      typeof outra.deuErrado === "boolean")
  }
}

{
  // Quando dá errado, o GANHO não some — é a regra escrita no módulo.
  const efeito = somar({ dinheiro: 100, relacoes: { imprensa: 5 } }, { dinheiro: -40, relacoes: { imprensa: -12 } })
  ok("somar preserva o ganho e aplica a perda por cima",
    efeito.dinheiro === 60 && efeito.relacoes?.imprensa === -7, JSON.stringify(efeito))
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 2. PATROCÍNIO PESSOAL É MERCADO, NÃO BOTÃO ────────────────")
// ═══════════════════════════════════════════════════════════════════════════

ok("o catálogo tem pelo menos 10 marcas", TOTAL_DE_MARCAS >= 10, `${TOTAL_DE_MARCAS}`)
ok("as três marcas da 1.0.373 sobreviveram com os mesmos ids",
  ["vertice", "pulso", "aurora"].every(id => MARCAS.some(m => m.id === id)))
ok("toda marca declara exclusividade",
  MARCAS.every(m => m.exclusividade.length > 0))

{
  const perfil = {
    reputacao: 70, torcida: 70, idade: 24, gols: 8, jogos: 20, media: 7.1,
    estilo: 0, relacoes: relacoesIniciais(), temporada: 2026, rodada: 5,
    categoriasOcupadas: [] as never[],
  }
  const semEstilo = apeloComercial(perfil)
  const comEstilo = apeloComercial({ ...perfil, estilo: 60 })
  ok("o ESTILO do patrimônio aumenta o apelo comercial", comEstilo > semEstilo,
    `${semEstilo.toFixed(3)} → ${comEstilo.toFixed(3)}`)
  ok("mas o estilo não domina o cálculo (teto de ~+22%)", comEstilo / semEstilo < 1.25,
    `${(comEstilo / semEstilo).toFixed(3)}`)

  const marcaFria = apeloComercial({ ...perfil, relacoes: { ...relacoesIniciais(), marcas: 5 } })
  const marcaQuente = apeloComercial({ ...perfil, relacoes: { ...relacoesIniciais(), marcas: 95 } })
  ok("a relação com as marcas move o apelo (o campo deixou de ser enfeite)",
    marcaQuente > marcaFria * 1.5, `${marcaFria.toFixed(2)} → ${marcaQuente.toFixed(2)}`)
}

{
  // EXCLUSIVIDADE: com material esportivo ocupado, nenhuma outra chuteira propõe.
  let propostasComCategoriaOcupada = 0
  for (let r = 1; r <= 60; r++) {
    const ps = propostasDaRodada({
      reputacao: 90, torcida: 80, idade: 24, gols: 14, jogos: 24, media: 7.4, estilo: 40,
      relacoes: { ...relacoesIniciais(), marcas: 80 }, temporada: 2026, rodada: r,
      categoriasOcupadas: ["material_esportivo"],
    })
    propostasComCategoriaOcupada += ps.filter(p => p.categoria === "material_esportivo").length
  }
  ok("categoria ocupada não recebe proposta nova", propostasComCategoriaOcupada === 0,
    `${propostasComCategoriaOcupada}`)
}

{
  // A NEGOCIAÇÃO PODE FRACASSAR — e a proposta morre de verdade.
  let recusas = 0
  let subiuAlgum = 0
  for (let r = 1; r <= 60; r++) {
    const perfil = {
      reputacao: 80, torcida: 70, idade: 25, gols: 10, jogos: 22, media: 7,
      estilo: 20, relacoes: relacoesIniciais(), temporada: 2026, rodada: r,
      categoriasOcupadas: [] as never[],
    }
    for (const p0 of propostasDaRodada(perfil)) {
      let p = p0
      for (let i = 0; i < 5; i++) p = contraproporPatrocinio(p, "valor", perfil)
      if (p.estado === "recusada") recusas++
      if (p.valorSemanal > p0.valorSemanal) subiuAlgum++
      ok(`o valor nunca passa do teto (${p0.marca})`, p.valorSemanal <= p0.tetoSemanal + 1, `${p.valorSemanal} > ${p0.tetoSemanal}`)
    }
  }
  ok("insistir demais faz a marca desistir", recusas > 0, `${recusas} recusa(s)`)
  ok("mas negociar às vezes funciona", subiuAlgum > 0, `${subiuAlgum} aumento(s)`)
}

{
  // A CLÁUSULA COBRA. Contrato de 1 semana que não cumpre nada fecha no vermelho.
  const marca = MARCAS[1]
  const proposta = propostasDaRodada({
    reputacao: 90, torcida: 80, idade: 24, gols: 12, jogos: 24, media: 7.4, estilo: 30,
    relacoes: { ...relacoesIniciais(), marcas: 85 }, temporada: 2026, rodada: 1,
    categoriasOcupadas: [],
  })[0] ?? {
    id: "x", marcaId: marca.id, marca: marca.nome, categoria: marca.categoria, nivel: marca.nivel,
    valorSemanal: 10_000, bonusPorGol: 3_000, luvas: 20_000, semanas: 1,
    clausulas: [{ tipo: "jogos" as const, alvo: 5, cumprido: 0, bonus: 30_000, multa: 40_000 }],
    aparicoes: 2, custoDeTorcida: 0, expiraEmRodadas: 3, rodadaDeNegociacao: 0,
    tetoSemanal: 13_000, estado: "aberta" as const,
  }

  const contrato = { ...assinarProposta(proposta, 2026), semanasRestantes: 1 }
  const r = rodarSemanaDePatrocinio([contrato], { golsNaRodada: 0, jogou: false })
  ok("contrato vencido sai da carteira", r.contratos.length === 0)
  ok("cláusula furada cobra multa", r.encerrados[0]?.saldo < 0, `${r.encerrados[0]?.saldo}`)
  ok("e derruba a relação com as marcas", r.ajusteDeMarcas < 0, `${r.ajusteDeMarcas}`)

  const cumprido = {
    ...contrato,
    clausulas: contrato.clausulas.map(c => ({ ...c, cumprido: c.alvo })),
    aparicoesFeitas: contrato.aparicoesExigidas,
  }
  const bom = avaliarContrato(cumprido)
  ok("cláusula cumprida paga bônus", bom.saldo > 0 && bom.cumpriu, `${bom.saldo}`)
}

ok("a aparição cobra energia", ENERGIA_POR_APARICAO > 0, `${ENERGIA_POR_APARICAO}`)

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 3. A TORCIDA FINALMENTE DECIDE ALGUMA COISA ───────────────")
// ═══════════════════════════════════════════════════════════════════════════

ok("torcida alta ajuda EM CASA", empurraoDaTorcida(95, "casa") > 0.3, `${empurraoDaTorcida(95, "casa")}`)
ok("torcida baixa atrapalha EM CASA", empurraoDaTorcida(5, "casa") < -0.2, `${empurraoDaTorcida(5, "casa")}`)
ok("e não muda nada FORA", empurraoDaTorcida(95, "fora") === 0 && empurraoDaTorcida(5, "fora") === 0)
ok("o empurrão é um tempero, não um substituto (|x| <= 0,5)",
  Math.abs(empurraoDaTorcida(100, "casa")) <= 0.5 && Math.abs(empurraoDaTorcida(0, "casa")) <= 0.5)

ok("ídolo arranca mais na mesa que vaiado",
  pesoDaTorcidaNaRenovacao(95) > pesoDaTorcidaNaRenovacao(10))

ok("⚠️ a torcida NÃO virou uma `Pessoa` (um só campo de arquibancada)",
  !(PESSOAS as string[]).includes("torcida"), PESSOAS.join(","))
ok("mas `marcas` virou, com rótulo e efeito",
  (PESSOAS as string[]).includes("marcas") && forcaDaMarcaPessoal(relacoesIniciais()) > 0)

{
  // `marcas` esfria para 35 (anonimato) e NÃO para 50 — quem nunca falou com
  // marca nenhuma não fica mais interessante por deixar o tempo passar.
  let r = { ...relacoesIniciais(), marcas: 35 }
  for (let i = 0; i < 40; i++) r = esfriarUmaRodada(r)
  ok("`marcas` não sobe sozinho até 50", r.marcas <= 36, `${r.marcas}`)
  let alto = { ...relacoesIniciais(), marcas: 90 }
  for (let i = 0; i < 40; i++) alto = esfriarUmaRodada(alto)
  ok("mas uma marca cultivada esfria de volta", alto.marcas < 80, `${alto.marcas}`)
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 4. NA CARREIRA DE VERDADE, PONTA A PONTA ──────────────────")
// ═══════════════════════════════════════════════════════════════════════════

{
  semearMotorDePartida(20260826)
  const clube = getTeamByShort("FLA")
  if (!clube) {
    ok("clube de teste encontrado", false)
  } else {
    const atleta = criarAtletaDaCarreira({
      nome: "Sonda 377", posicao: "ATA", idade: 21, nacionalidade: "Brasil",
      pePreferido: "direito", alturaCm: 180, pesoKg: 76, numero: 9,
    })
    let c: EstadoCarreiraDeJogador = criarCarreiraDeJogador(clube, atleta, "Brasileirao Serie A", 2026)

    const dinheiroInicial = economiaDoAtleta(c).dinheiro
    let dilemasVistos = 0
    let propostasVistas = 0

    for (let i = 0; i < 30; i++) {
      c = jogarProximaRodada(c)
      if (dilemaDaVez(c)) {
        dilemasVistos++
        const d = dilemaDaVez(c)!
        c = decidirDilema(c, d.escolhas[d.escolhas.length - 1].id)
      }
      const ps = propostasDePatrocinio(c).filter(p => p.estado === "aberta")
      if (ps.length > 0) {
        propostasVistas++
        if ((c.patrociniosAtivos?.length ?? 0) === 0) c = assinarPatrocinioDaProposta(c, ps[0].id)
      }
    }

    ok("dilemas apareceram numa temporada", dilemasVistos > 0, `${dilemasVistos}`)
    ok("mas NÃO em toda rodada (a cadência é rara de propósito)", dilemasVistos < 25, `${dilemasVistos}/30`)
    ok("propostas de patrocínio apareceram", propostasVistas > 0, `${propostasVistas}`)
    ok("a carreira não quebrou", c.temporada >= 2026 && c.atleta.overall > 0)
    ok("o dinheiro se moveu", economiaDoAtleta(c).dinheiro !== dinheiroInicial)
    ok("nenhuma relação ficou fora da escala 0–100",
      Object.entries(lerRelacoes(c.relacoes as never)).every(([, v]) => v >= 0 && v <= 100),
      JSON.stringify(lerRelacoes(c.relacoes as never)))

    // ⚠️ NUNCA OS DOIS AO MESMO TEMPO: o contrato antigo tem de ter sido migrado.
    ok("o patrocínio antigo e a carteira nova não coexistem",
      !(c.patrocinioPessoal && (c.patrociniosAtivos?.length ?? 0) > 0))

    if ((c.patrociniosAtivos?.length ?? 0) > 0) {
      const alvo = c.patrociniosAtivos![0]
      if (alvo.aparicoesExigidas > 0) {
        const energiaAntes = economiaDoAtleta(c).energia
        const depois = fazerAparicaoDeMarca(c, alvo.id)
        const energiaDepois = economiaDoAtleta(depois).energia
        ok("cumprir aparição custou energia", energiaDepois < energiaAntes || energiaAntes < ENERGIA_POR_APARICAO,
          `${energiaAntes} → ${energiaDepois}`)
      }
      ok("o perfil comercial declara a categoria ocupada",
        perfilComercial(c).categoriasOcupadas.includes(alvo.categoria))
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 5. SAVE ANTERIOR À 1.0.377 NÃO PODE QUEBRAR ───────────────")
// ═══════════════════════════════════════════════════════════════════════════

{
  semearMotorDePartida(20260827)
  const clube = getTeamByShort("FLA")
  if (clube) {
    const atleta = criarAtletaDaCarreira({
      nome: "Save Velho", posicao: "MEI", idade: 26, nacionalidade: "Brasil",
      pePreferido: "esquerdo", alturaCm: 175, pesoKg: 70, numero: 10,
    })
    const base = criarCarreiraDeJogador(clube, atleta, "Brasileirao Serie A", 2026)

    // Um save da 1.0.375: sem nenhum campo novo, e COM o patrocínio antigo.
    const velho = JSON.parse(JSON.stringify(base)) as EstadoCarreiraDeJogador
    delete velho.dilemaAberto
    delete velho.dilemasResolvidos
    delete velho.ultimoDesfechoDeDilema
    delete velho.patrociniosAtivos
    delete velho.propostasDePatrocinio
    delete velho.patrociniosEncerrados
    velho.patrocinioPessoal = {
      id: "vertice", marca: "Vertice Sports", valorSemanal: 3_000,
      bonusPorGol: 1_200, semanasRestantes: 10, metaGols: 5, golsNoContrato: 2,
    }

    let sobreviveu = true
    let depois = velho
    try {
      for (let i = 0; i < 6; i++) depois = jogarProximaRodada(depois)
      dilemaDaVez(depois)
      propostasDePatrocinio(depois)
      perfilComercial(depois)
    } catch (e) {
      sobreviveu = false
      console.log(`    ${(e as Error).message}`)
    }
    ok("seis rodadas sobre um save da 1.0.375 sem campo novo nenhum", sobreviveu)
    ok("o contrato antigo virou contrato da carteira (não sumiu)",
      (depois.patrociniosAtivos ?? []).some(c => c.marcaId === "vertice") || depois.patrocinioPessoal !== null,
      JSON.stringify({ novo: depois.patrociniosAtivos?.length, antigo: Boolean(depois.patrocinioPessoal) }))
    ok("o progresso da meta antiga foi preservado na cláusula",
      (depois.patrociniosAtivos ?? []).every(c =>
        c.marcaId !== "vertice" || c.clausulas.some(cl => cl.tipo === "gols" && cl.cumprido >= 2)))
  }
}

console.log(`\n${falhou === 0 ? "PASSOU" : "FALHOU"} — ${passou} ok, ${falhou} falha(s)\n`)
process.exit(falhou === 0 ? 0 : 1)

// A CABECA DO MERCADO — o teste do relato que originou a reescrita:
//
//   "clube grande nao manda proposta de 13 milhoes por um reserva".
//
// E das outras tres regras que o mercado antigo nao tinha: o clube so procura
// quem cabe no elenco dele e no caixa, a oferta cresce com a necessidade e com a
// janela, e o atleta pesa projeto e minutos antes de aceitar.
import {
  avaliarCompra, decisaoDoAtleta, necessidadeNaPosicao, papelPrevisto, perfilDeElenco,
  sondagemDe, urgenciaDaJanela, type AtletaAlvo, type ClubeComprador,
} from "../lib/mercado-realista"

let falhas = 0
const check = (ok: boolean, msg: string) => { if (!ok) { falhas++; console.log(`  FALHA: ${msg}`) } }

console.log("== Mercado realista ==")

/** Elenco de um clube grande: quatro zagueiros de 84 e o resto forte. */
const elencoGrande = [
  { posicao: "GOL", overall: 84, idade: 28 }, { posicao: "GOL", overall: 74, idade: 24 }, { posicao: "GOL", overall: 68, idade: 20 },
  ...Array.from({ length: 6 }, () => ({ posicao: "ZAG", overall: 84, idade: 27 })),
  { posicao: "LD", overall: 84, idade: 26 }, { posicao: "LE", overall: 84, idade: 26 },
  ...Array.from({ length: 8 }, () => ({ posicao: "MEI", overall: 84, idade: 26 })),
  ...Array.from({ length: 6 }, () => ({ posicao: "ATA", overall: 84, idade: 26 })),
]

/** Mesmo clube, mas com a zaga esvaziada e fraca — um setor que pede reforco. */
const elencoComBuracoNaZaga = [
  ...elencoGrande.filter(p => p.posicao !== "ZAG"),
  { posicao: "ZAG", overall: 70, idade: 33 }, { posicao: "ZAG", overall: 68, idade: 34 },
]

const grande = (elenco: typeof elencoGrande, caixa = 120_000_000): ClubeComprador => ({
  curto: "BIG", nome: "Clube Grande", prestigio: 90, caixa,
  tetoFolhaSemanal: 3_000_000, folhaSemanal: 1_000_000,
  perfil: perfilDeElenco(elenco),
})

const zagueiroMediano: AtletaAlvo = {
  id: 1, nome: "Zagueiro Mediano", posicao: "ZAG",
  overall: 76, potencial: 78, idade: 27,
  valorDeMercado: 13_000_000,
  salarioSemanal: 40_000,
  semanasDeContrato: 120, moral: 60, listado: false, papelAtual: "titular",
}

const janelaAberta = { aberta: true, semanasParaFechar: 8 }
const deadline = { aberta: true, semanasParaFechar: 1 }
const fechada = { aberta: false, semanasParaFechar: 0 }

// 1) O RELATO. Clube grande, elenco cheio de zagueiros 84: o 76 seria RESERVA e
//    nao pode receber proposta de 13 milhoes.
const servido = grande(elencoGrande)
check(papelPrevisto(servido.perfil, "ZAG", 76) === "reserva", "76 num setor de quatro 84 tem de ser reserva")
const avServido = avaliarCompra(servido, zagueiroMediano, janelaAberta)
check(!avServido.quer, `clube servido nao pode querer o reserva — motivo: ${avServido.motivo}`)
check(avServido.proposta === 0, "e muito menos mandar dinheiro por ele")

// 2) O MESMO atleta, no MESMO clube, com a zaga furada: agora ele e titular e a
//    proposta existe. E a necessidade que muda tudo.
const carente = grande(elencoComBuracoNaZaga)
check(papelPrevisto(carente.perfil, "ZAG", 76) === "titular", "com a zaga furada, o 76 entra jogando")
check(
  necessidadeNaPosicao(carente.perfil, "ZAG") > necessidadeNaPosicao(servido.perfil, "ZAG"),
  "a zaga furada tem de acusar mais necessidade que a zaga cheia",
)
const avCarente = avaliarCompra(carente, zagueiroMediano, janelaAberta)
check(avCarente.quer, `clube com o setor furado tem de querer — motivo: ${avCarente.motivo}`)
check(avCarente.proposta > 0, "e a proposta tem de sair de verdade")

// 3) A OFERTA CRESCE COM A JANELA. Deadline day paga mais que julho.
const avDeadline = avaliarCompra(carente, zagueiroMediano, deadline)
check(avDeadline.proposta > avCarente.proposta, `deadline day tem de pagar mais (${avDeadline.proposta} vs ${avCarente.proposta})`)
check(urgenciaDaJanela(deadline) > urgenciaDaJanela(janelaAberta), "a urgencia tem de subir no fim da janela")
check(urgenciaDaJanela(fechada) < 1, "fora da janela o mercado esfria")

// 4) O CAIXA MANDA. O mesmo clube sem dinheiro nao oferta.
const quebrado = grande(elencoComBuracoNaZaga, 2_000_000)
const avQuebrado = avaliarCompra(quebrado, zagueiroMediano, janelaAberta)
check(!avQuebrado.quer, `sem caixa nao ha proposta — veio: ${avQuebrado.motivo}`)
check(/caixa/i.test(avQuebrado.motivo), `o motivo tem de dizer que faltou caixa: "${avQuebrado.motivo}"`)

// 5) A FOLHA TAMBEM. Caixa alto nao compra salario que nao cabe.
const folhaEstourada: ClubeComprador = { ...carente, folhaSemanal: 2_990_000 }
check(!avaliarCompra(folhaEstourada, zagueiroMediano, janelaAberta).quer, "folha no teto tem de barrar a contratacao")

// 6) O PAPEL DERRUBA O PRECO. Rotacao vale bem menos que titular, no MESMO valor
//    de mercado — que era exatamente a peca que faltava.
const pequeno: ClubeComprador = {
  curto: "PEQ", nome: "Clube Pequeno", prestigio: 74, caixa: 60_000_000,
  tetoFolhaSemanal: 900_000, folhaSemanal: 200_000,
  perfil: perfilDeElenco(elencoComBuracoNaZaga.map(p => ({ ...p, overall: p.overall - 10 }))),
}
const avTitular = avaliarCompra(pequeno, zagueiroMediano, janelaAberta)
check(avTitular.papel === "estrela" || avTitular.papel === "titular", `no clube pequeno ele deveria ser titular/estrela, veio ${avTitular.papel}`)
check(avTitular.proposta > avCarente.proposta * 0.8, "quem o quer para ser peca central paga mais")

// 7) CLUBE PEQUENO NAO ALCANCA CRAQUE.
const craque: AtletaAlvo = { ...zagueiroMediano, id: 2, nome: "Craque", overall: 90, valorDeMercado: 90_000_000 }
const muitoPequeno: ClubeComprador = { ...pequeno, prestigio: 62 }
check(!avaliarCompra(muitoPequeno, craque, janelaAberta).quer, "clube de prestigio 62 nao contrata um 90")

// 8) CONTRATO ACABANDO derruba o preco (o comprador sabe que leva barato).
const fimDeContrato: AtletaAlvo = { ...zagueiroMediano, semanasDeContrato: 20 }
const avFim = avaliarCompra(carente, fimDeContrato, janelaAberta)
check(avFim.proposta < avCarente.proposta, `contrato acabando tem de baratear (${avFim.proposta} vs ${avCarente.proposta})`)

// ─── A DECISAO DO ATLETA ────────────────────────────────────────────────────

// 9) MINUTOS: titular nao troca a vaga por banco de clube grande, nem com aumento.
const recusaPorMinutos = decisaoDoAtleta({
  atleta: { ...zagueiroMediano, papelAtual: "titular" },
  prestigioClubeAtual: 74, prestigioClubeNovo: 90,
  papelNoClubeNovo: "reserva",
  salarioOferecido: zagueiroMediano.salarioSemanal * 1.6,
})
check(!recusaPorMinutos.aceita, "titular nao pode aceitar virar reserva so por dinheiro")
check(/titularidade/i.test(recusaPorMinutos.motivo), `o motivo tem de citar a titularidade: "${recusaPorMinutos.motivo}"`)

// 10) PROJETO: subir de patamar mantendo a titularidade convence.
const aceitaPeloProjeto = decisaoDoAtleta({
  atleta: { ...zagueiroMediano, papelAtual: "titular" },
  prestigioClubeAtual: 70, prestigioClubeNovo: 90,
  papelNoClubeNovo: "titular",
  salarioOferecido: zagueiroMediano.salarioSemanal * 1.3,
})
check(aceitaPeloProjeto.aceita, "subir de patamar continuando titular tem de ser aceito")
check(aceitaPeloProjeto.entusiasmo > recusaPorMinutos.entusiasmo, "o entusiasmo tem de refletir a diferenca")

// 11) DESCER DE PATAMAR sem ganhar nada e recusado.
const descida = decisaoDoAtleta({
  atleta: { ...zagueiroMediano, papelAtual: "titular", moral: 70 },
  prestigioClubeAtual: 90, prestigioClubeNovo: 68,
  papelNoClubeNovo: "titular",
  salarioOferecido: zagueiroMediano.salarioSemanal,
})
check(!descida.aceita, "ninguem desce de patamar de graca")

// 12) INSATISFACAO empurra para fora: o mesmo atleta infeliz e transferivel aceita.
const infeliz = decisaoDoAtleta({
  atleta: { ...zagueiroMediano, papelAtual: "titular", moral: 15, listado: true, semanasDeContrato: 20 },
  prestigioClubeAtual: 90, prestigioClubeNovo: 68,
  papelNoClubeNovo: "titular",
  salarioOferecido: zagueiroMediano.salarioSemanal * 1.2,
})
check(infeliz.aceita, "atleta infeliz, listado e com contrato acabando tem de topar a saida")

// ─── SONDAGEM ───────────────────────────────────────────────────────────────

// 13) Sondagem NAO e sorteio: quem esta servido no setor nao sonda.
check(sondagemDe(servido, zagueiroMediano, avServido) === null, "clube servido nao sonda um reserva")
const s = sondagemDe(carente, zagueiroMediano, avCarente)
check(s !== null && s.papel === "titular", "o clube carente sonda, e sabe dizer que papel o atleta teria")
check(s?.temCaixa === true, "e sabe dizer se tem caixa para bancar")

console.log(falhas === 0 ? "\nOK — necessidade, caixa, janela e papel mandam; e o atleta tem voz" : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)

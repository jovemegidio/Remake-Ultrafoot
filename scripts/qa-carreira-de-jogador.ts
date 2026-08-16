// QA DA CARREIRA DE JOGADOR — o beco sem saída não pode voltar.
//
// Reproduz o caso RELATADO com print (1.0.324): atleta de 18 anos, overall 65,
// criado no River Plate. Antes desta versão ele terminava a temporada com UMA
// partida, "fora dos planos", e toda a lista de atuações dizendo "não saiu do
// banco" — a confiança caía 0,8 por rodada no banco e, abaixo de 24, ele parava
// de entrar, sem nenhum caminho de volta.
//
// O que este teste garante:
//   1. um jovem de clube grande JOGA (não fica a temporada inteira no banco);
//   2. quem está fora dos planos ainda tem fresta de entrar — a carreira nunca
//      congela;
//   3. a confiança PERSEGUE O MÉRITO nos dois sentidos: um atleta muito melhor
//      que a fila da posição sobe, mesmo tendo começado mal.
import { allTeams, getTeamByFileKey } from "@/lib/teams-data"
import {
  confiancaMerecida, criarAtletaDaCarreira, criarCarreiraDeJogador, hierarquiaDaPosicao,
  jogarProximaRodada, papelNoElenco, encerrarTemporada, potencialVisivel,
  concluirPartidaDoAtleta,
  type EstadoCarreiraDeJogador,
} from "@/lib/carreira-de-jogador"
import { decidirMomento, partidaTerminou } from "@/lib/partida-do-atleta"

let falhas = 0
const erro = (m: string) => { console.log("FALHA: " + m); falhas++ }

function rodarTemporada(estado: EstadoCarreiraDeJogador): EstadoCarreiraDeJogador {
  let n = 0
  while (!estado.temporadaEncerrada && n < 120) { estado = jogarProximaRodada(estado); n++ }
  return estado
}

// ── 1. O caso do print: jovem promissor num clube grande ────────────────────
const river = allTeams.find(t => t.nome.includes("River Plate")) ?? allTeams.find(t => t.prestigio >= 85)!
const jovem = criarAtletaDaCarreira({
  nome: "Antonio Teste", posicao: "ATA", idade: 18, nacionalidade: "Brasil",
  pePreferido: "direito", alturaCm: 180, pesoKg: 74, numero: 19,
})
let carreira = criarCarreiraDeJogador(river, jovem, "Liga Profesional", 2026)
const h = hierarquiaDaPosicao(carreira)
console.log(`${river.nome} | atleta ${carreira.atleta.overall} | fila da posicao: ${h.posto}o de ${h.concorrentes} (melhor rival ${h.melhorRival})`)
console.log(`confianca inicial ${carreira.notaDoTreinador} (merecida ${confiancaMerecida(carreira).toFixed(0)}) -> ${papelNoElenco(carreira.notaDoTreinador)}`)

carreira = rodarTemporada(carreira)
const t = carreira.temporadaAtual
const rodadas = carreira.calendario.filter(f => f.isUserMatch).length
console.log(`temporada: ${t.jogos} jogos (${t.titularidades} como titular) em ${rodadas} rodadas | media ${(t.jogos ? t.somaDasNotas / t.jogos : 0).toFixed(2)}`)

if (t.jogos === 0) erro("o atleta nao entrou em campo NENHUMA vez na temporada")
if (t.jogos < rodadas * 0.15) erro(`jogou so ${t.jogos} de ${rodadas} — o beco sem saida voltou`)
// ⚠️ E o pendulo nao pode ir para o outro extremo: o 11o da fila NAO vira
// titular absoluto por jogar bem. Quem muda de patamar e a evolucao.
if (h.posto >= h.concorrentes && t.titularidades > rodadas * 0.5) {
  erro(`o ultimo da fila foi titular em ${t.titularidades} de ${rodadas} rodadas`)
}

// ── 2. Fora dos planos ainda tem fresta ─────────────────────────────────────
const fundo: EstadoCarreiraDeJogador = { ...carreira, notaDoTreinador: 5, temporadaEncerrada: false }
fundo.calendario = fundo.calendario.map(f => ({ ...f, played: false }))
let comFresta = 0
let e2 = fundo
for (let i = 0; i < 20 && !e2.temporadaEncerrada; i++) {
  const antes = e2.temporadaAtual.jogos
  e2 = jogarProximaRodada(e2)
  if (e2.temporadaAtual.jogos > antes) comFresta++
}
console.log(`fora dos planos: entrou em ${comFresta} de 20 rodadas`)
if (comFresta === 0) erro("quem esta fora dos planos nunca mais entra — carreira congelada")

// ── 3. A confianca sobe quando o merito sobe ────────────────────────────────
const craque = { ...carreira, atleta: { ...carreira.atleta, overall: 92 }, notaDoTreinador: 15 }
const merecidaCraque = confiancaMerecida(craque)
const merecidaFraca = confiancaMerecida({ ...carreira, atleta: { ...carreira.atleta, overall: 45 } })
console.log(`merecida com overall 92: ${merecidaCraque.toFixed(0)} | com 45: ${merecidaFraca.toFixed(0)}`)
if (merecidaCraque <= merecidaFraca) erro("o merito nao acompanha o overall do atleta")
if (merecidaCraque < 60) erro("um atleta de 92 nao chega nem perto de titular")

// ── 4. A hierarquia e do elenco REAL ────────────────────────────────────────
const clube = getTeamByFileKey(carreira.clubeFileKey)
if (!clube) erro("clube da carreira nao resolve por file_key")
if (h.concorrentes < 2) erro("a posicao nao tem concorrencia nenhuma no elenco real")

// ── 5. EVOLUCAO ORGANICA (1.0.325) ──────────────────────────────────────────
//
// Duas carreiras com o MESMO atleta e personalidades opostas: quem tem
// profissionalismo e determinacao altos tem de terminar mais forte. E ninguem
// pode passar do proprio teto — que continua escondido atras de uma faixa.
const base = criarAtletaDaCarreira({
  nome: "Evolucao Teste", posicao: "MEI", idade: 18, nacionalidade: "Brasil",
  pePreferido: "direito", alturaCm: 178, pesoKg: 72, numero: 8, arquetipo: "maestro",
})
const santos = allTeams.find(t => t.nome === "Santos") ?? allTeams.find(t => t.prestigio < 80)!

function tresTemporadas(pers: Partial<typeof base.personalidade>): EstadoCarreiraDeJogador {
  const atleta = { ...base, personalidade: { ...base.personalidade, ...pers } }
  let e = criarCarreiraDeJogador(santos, atleta, "Brasileirao Serie A", 2026)
  for (let ano = 0; ano < 3; ano++) { e = rodarTemporada(e); e = encerrarTemporada(e) }
  return e
}

const dedicado = tresTemporadas({ profissionalismo: 19, determinacao: 19 })
const relaxado = tresTemporadas({ profissionalismo: 4, determinacao: 4 })
console.log(`overall apos 3 temporadas: dedicado ${dedicado.atleta.overall} | relaxado ${relaxado.atleta.overall} (comecaram em ${base.overall})`)

if (dedicado.atleta.overall <= base.overall) erro("o atleta dedicado nao evoluiu em tres temporadas")
if (dedicado.atleta.overall <= relaxado.atleta.overall) erro("a personalidade nao muda a evolucao")
if (dedicado.atleta.overall > dedicado.atleta.potencial) erro("o atleta passou do proprio teto")
if (!dedicado.historico.length) erro("historico vazio depois de tres temporadas")
if (!dedicado.ultimaEvolucao.length) erro("a evolucao nao registrou em que atributo o atleta cresceu")

const jogosNaCarreira = dedicado.historico.reduce((n, h) => n + h.jogos, 0)
const faixa = potencialVisivel(dedicado.atleta, jogosNaCarreira)
console.log(`faixa mostrada: ${faixa.min}-${faixa.max} (real ${dedicado.atleta.potencial}, escondido)`)
if (faixa.min > dedicado.atleta.potencial || faixa.max < dedicado.atleta.potencial) {
  erro("a faixa mostrada nao contem o potencial real")
}
if (faixa.max - faixa.min <= 0) erro("a faixa fechou de todo — o teto deixou de ser segredo")

// ── 6. VIVER A PARTIDA (1.0.329) ────────────────────────────────────────────
//
// A trava que importa: quem VIVE a partida nao pode marcar mais gols do que o
// TIME fez. O placar sai do motor antes de a tela abrir; os momentos so
// redistribuem participacao dentro dele. E os dois caminhos (viver e simular)
// tem de passar pela MESMA contabilidade — senao a carreira ganha duas
// verdades, que foi o que quebrou o co-op quando metade do estado viajava.
let vivendo = criarCarreiraDeJogador(santos, base, "Brasileirao Serie A", 2026)
vivendo = { ...vivendo, notaDoTreinador: 70 }   // titular, para garantir minutos
vivendo = jogarProximaRodada(vivendo, { viver: true })
const emCurso = vivendo.partidaEmCurso

if (!emCurso) {
  erro("viver a partida nao montou os momentos")
} else {
  console.log(`partida vivida: ${emCurso.minutos}' | ${emCurso.momentos.length} momentos | placar ${emCurso.golsPro}-${emCurso.golsContra}`)
  if (!emCurso.momentos.length) erro("a partida vivida nao tem momento nenhum")
  if (vivendo.temporadaAtual.jogos !== 0) erro("a partida foi contabilizada ANTES de o jogador decidir")

  // Decide sempre a opcao mais agressiva, que e a que mais tenta gol.
  let p = emCurso
  while (!partidaTerminou(p)) {
    const m = p.momentos[p.atual]
    p = decidirMomento(vivendo, p, m.escolhas[0].id).partida
  }
  if (p.gols > p.golsPro) erro(`o atleta fez ${p.gols} gols num time que fez ${p.golsPro}`)
  if (p.gols + p.assistencias > p.golsPro) erro("gols + assistencias passaram dos gols do time")
  if (p.nota < 3 || p.nota > 10) erro(`nota fora da escala: ${p.nota}`)

  const fechada = concluirPartidaDoAtleta({ ...vivendo, partidaEmCurso: p })
  if (fechada.partidaEmCurso) erro("a partida continuou em curso depois de fechada")
  if (fechada.temporadaAtual.jogos !== 1) erro("a partida vivida nao entrou na temporada")
  if (fechada.temporadaAtual.gols !== p.gols) erro("os gols da partida vivida nao foram para a temporada")
  if (fechada.ultimasPartidas[0]?.nota !== p.nota) erro("a nota da partida vivida nao foi registrada")
  console.log(`fechada: ${fechada.temporadaAtual.jogos} jogo, ${fechada.temporadaAtual.gols} gol(s), nota ${p.nota}`)
}

console.log(falhas === 0 ? "TUDO OK" : `${falhas} falha(s)`)
process.exit(falhas === 0 ? 0 : 1)

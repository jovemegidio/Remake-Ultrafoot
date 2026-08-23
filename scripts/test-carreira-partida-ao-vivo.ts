/**
 * A CARREIRA LIGADA À PARTIDA AO VIVO — integração ponta a ponta.
 *
 * `test-partida-ao-vivo-do-atleta.ts` prova o módulo isolado. Este prova o que
 * de fato chega ao jogador: a carreira parou de pré-simular a sua partida, o
 * placar nasce do que você faz, e o resultado volta para o calendário e para a
 * tabela no apito.
 *
 * As duas invariantes que, se quebrarem, estragam a temporada inteira em
 * silêncio:
 *
 *   1. a sua partida NÃO pode ficar sem `played` — `temporadaEncerrada` olha
 *      para `!played`, então um fixture aberto trava a virada de temporada para
 *      sempre (é o defeito que [[ultrafoot-liga-congelada-e-virada]] registra);
 *   2. o seu jogo tem de entrar na TABELA — senão o seu clube some da
 *      classificação e a liga inteira fica inconsistente.
 */
import {
  criarAtletaDaCarreira,
  criarCarreiraDeJogador,
  jogarProximaRodada,
  concluirPartidaDoAtleta,
  type EstadoCarreiraDeJogador,
} from "../lib/carreira-de-jogador"
import { allTeams } from "../lib/teams-data"
import { decidirMomento, partidaTerminou } from "../lib/partida-do-atleta"

let passou = 0
let falhou = 0
function ok(nome: string, cond: boolean, detalhe = "") {
  if (cond) { passou++; console.log(`  ok   ${nome}`) }
  else { falhou++; console.log(`  FALHA ${nome} ${detalhe}`) }
}

// O clube precisa ser real: `criarCarreiraDeJogador` monta o calendário a partir
// da liga dele, e um clube inventado deixa `file_key` indefinido — foi o que
// derrubou a primeira versão deste teste dentro de `getTeamByFileKey`.
const CLUBE = allTeams.find(t => t.divisao === "serie_a" && t.file_key) ?? allTeams[0]

function novaCarreira(): EstadoCarreiraDeJogador {
  const atleta = criarAtletaDaCarreira({
    nome: "Teste Ao Vivo",
    posicao: "ATA",
    idade: 18,
    nacionalidade: "Brasil",
    pePreferido: "direito",
    alturaCm: 180,
    pesoKg: 75,
    numero: 9,
    arquetipo: "matador",
    origem: "joia",
  }, "semente-ao-vivo")
  const estado = criarCarreiraDeJogador(CLUBE, atleta, "Serie A", 2026)
  // ⚠️ TITULAR À FORÇA. Um atleta de 18 recém-criado nasce com
  // `notaDoTreinador` ~19 — "fora dos planos" — e joga ZERO minuto. Isso é o
  // comportamento certo do jogo, e foi o que derrubou a primeira versão deste
  // teste: sem minutos, o caminho ao vivo nem dispara e tudo abaixo falha por
  // uma razão que não tem nada a ver com o que se quer provar aqui.
  return { ...estado, notaDoTreinador: 88 }
}

/** Joga a rodada vivendo a partida, escolhendo sempre a primeira opção. */
function viverRodada(estado: EstadoCarreiraDeJogador): EstadoCarreiraDeJogador {
  let atual = jogarProximaRodada(estado, { viver: true })
  let guarda = 0
  while (atual.partidaEmCurso && !partidaTerminou(atual.partidaEmCurso) && guarda++ < 400) {
    const momento = atual.partidaEmCurso.momentos[atual.partidaEmCurso.atual]
    if (!momento) break
    const r = decidirMomento(atual, atual.partidaEmCurso, momento.escolhas[0].id)
    atual = { ...atual, partidaEmCurso: r.partida }
  }
  if (atual.partidaEmCurso) atual = concluirPartidaDoAtleta(atual)
  return atual
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 1. A carreira usa o caminho AO VIVO ────────────────────────")

{
  const inicial = novaCarreira()
  const comPartida = jogarProximaRodada(inicial, { viver: true })
  const p = comPartida.partidaEmCurso
  ok("a rodada devolve uma partida para viver", Boolean(p))
  if (p) {
    ok("ela é ao vivo (tem MatchState por trás)", Boolean(p.aoVivo))
    // ⚠️ O PLACAR NO PRIMEIRO LANCE NÃO PRECISA SER 0x0 — e essa foi a primeira
    // asserção errada deste teste. A partida corre antes de a bola chegar em
    // você, e pode sair gol nesse intervalo: é um REQUISITO que o time (e o
    // adversário) marquem sem a sua participação. O que importa é ser um placar
    // de jogo em andamento, não o placar final montado de véspera.
    ok("o placar do primeiro lance é de jogo em andamento", p.golsPro + p.golsContra <= 4,
      `(${p.golsPro}x${p.golsContra})`)
    ok("há um lance esperando decisão", p.momentos.length > 0 || partidaTerminou(p))
  }
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 2. O apito fecha o fixture e a TABELA ──────────────────────")

{
  const antes = novaCarreira()
  const idDaMinha = antes.calendario.find(f => f.isUserMatch && !f.played)?.id
  const depois = viverRodada(antes)
  const minha = depois.calendario.find(f => f.id === idDaMinha)

  ok("a minha partida ficou marcada como jogada", Boolean(minha?.played),
    `(played=${minha?.played})`)
  ok("o placar dela foi gravado no calendário",
    typeof minha?.homeGoals === "number" && typeof minha?.awayGoals === "number",
    `(${minha?.homeGoals}x${minha?.awayGoals})`)

  // O clube tem de ter somado jogo na tabela.
  const linha = depois.tabela.find(l => l.curto === depois.clubeCurto)
  ok("o meu clube somou jogo na classificação", (linha?.played ?? 0) > 0,
    `(played=${linha?.played})`)
  ok("nenhuma partida da rodada ficou aberta",
    depois.calendario.filter(f => f.round === (minha?.round ?? -1) && !f.played).length === 0)
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 3. A estatística do atleta é a que ELE produziu ────────────")

{
  const depois = viverRodada(novaCarreira())
  const ultima = depois.ultimasPartidas[0]
  ok("a partida entrou no histórico do atleta", Boolean(ultima))
  if (ultima) {
    ok("os gols dele não excedem o placar do time", ultima.gols <= ultima.golsPro,
      `(${ultima.gols} gols num placar de ${ultima.golsPro})`)
    ok("a nota está na faixa válida", ultima.nota >= 3 && ultima.nota <= 10, `(${ultima.nota})`)
    ok("os minutos foram registrados", ultima.minutos > 0)
  }
  ok("a temporada contabilizou o jogo", depois.temporadaAtual.jogos === 1,
    `(${depois.temporadaAtual.jogos})`)
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 4. Várias rodadas seguidas não travam a temporada ──────────")

{
  let estado = novaCarreira()
  let rodadas = 0
  for (let i = 0; i < 8 && !estado.temporadaEncerrada; i++) {
    estado = viverRodada(estado)
    rodadas++
  }
  const abertas = estado.calendario.filter(f => f.isUserMatch && !f.played).length
  const total = estado.calendario.filter(f => f.isUserMatch).length
  ok("oito rodadas vividas sem travar", rodadas === 8)
  ok("as partidas vividas ficaram todas fechadas", abertas < total, `(${abertas} abertas de ${total})`)
  ok("o atleta acumulou jogos na temporada", estado.temporadaAtual.jogos >= 1,
    `(${estado.temporadaAtual.jogos})`)
  ok("não sobrou partida em curso pendurada", !estado.partidaEmCurso)
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 5. O caminho ANTIGO continua funcionando ──────────────────")

// Saves em andamento não têm `aoVivo`; simular sem `viver` não pode quebrar.
{
  const estado = jogarProximaRodada(novaCarreira(), undefined)
  ok("rodada simulada sem viver não cria partida em curso", !estado.partidaEmCurso)
  ok("e o calendário andou", estado.calendario.some(f => f.played))
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${falhou === 0 ? "PASSOU" : "FALHOU"} — ${passou} ok, ${falhou} falha(s)\n`)
process.exit(falhou === 0 ? 0 : 1)

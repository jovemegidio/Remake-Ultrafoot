// O GATE DAS CONVERSAS DO ATLETA (1.0.340).
//
// ⚠️ POR QUE ELE EXISTE. Este modo já produziu duas vezes o mesmo defeito: uma
// tela que oferece uma escolha e não muda nada atrás dela (o "foco de treino"
// que só valia na virada do ano, corrigido na 1.0.339). Conversa é o formato
// mais fácil de cair nisso — texto bonito, botão, e o estado igual depois.
//
// Então o que este gate cobra não é que a conversa APAREÇA, e sim que ela
// CUSTE: toda resposta tem de mover pelo menos um número que o resto do modo
// lê (moral, forma, confiança do treinador, reputação, torcida ou o pedido
// formal ao clube). E cobra também que ela não apareça duas vezes, e que não
// apareça quando a situação não pede.
//
// Uso: npx tsx scripts/test-conversas-do-atleta.ts

import {
  criarAtletaDaCarreira, criarCarreiraDeJogador, type EstadoCarreiraDeJogador,
} from "@/lib/carreira-de-jogador"
import { conversasDoMomento, responderConversa } from "@/lib/conversas-do-atleta"
import { allTeams } from "@/lib/teams-data"

let falhas = 0
const erro = (m: string) => { console.log("FALHA: " + m); falhas++ }

const clube = allTeams.find(t => t.prestigio >= 80)!

function carreiraNova(): EstadoCarreiraDeJogador {
  const atleta = criarAtletaDaCarreira({
    nome: "Conversa Teste", posicao: "ATA", idade: 18, nacionalidade: "Brasil",
    pePreferido: "direito", alturaCm: 180, pesoKg: 74, numero: 19,
  })
  return criarCarreiraDeJogador(clube, atleta, "Liga Teste", 2026)
}

/** Os números que uma conversa pode legitimamente mover. */
function retrato(e: EstadoCarreiraDeJogador) {
  return [e.moral, e.forma, e.notaDoTreinador, e.reputacao ?? 30, e.torcida ?? 50, e.pedido].join("|")
}

// ── 1. A conversa aparece quando a SITUACAO pede ─────────────────────────────
const desanimado = carreiraNova()
desanimado.moral = 20
const comFamilia = conversasDoMomento(desanimado)
if (!comFamilia.some(c => c.com === "familia")) {
  erro("atleta com moral 20 nao recebeu conversa da familia")
}

const fimDeContrato = carreiraNova()
fimDeContrato.contrato.ateTemporada = fimDeContrato.temporada + 1
if (!conversasDoMomento(fimDeContrato).some(c => c.com === "diretoria")) {
  erro("contrato acabando nao gerou conversa com a diretoria")
}

// ── 2. E NAO aparece quando nada pede ────────────────────────────────────────
// Diálogo que aparece em toda rodada vira botão de "continuar".
const tranquilo = carreiraNova()
tranquilo.moral = 60
tranquilo.reputacao = 20
tranquilo.contrato.ateTemporada = tranquilo.temporada + 5
const emPaz = conversasDoMomento(tranquilo)
if (emPaz.length > 0) {
  erro(`atleta sem nenhuma pendencia recebeu ${emPaz.length} conversa(s): ${emPaz.map(c => c.id).join(", ")}`)
}

// ── 3. TODA resposta move algum numero ───────────────────────────────────────
// É o coração do gate: uma escolha que não custa nada não é escolha.
const cenarios: { nome: string; montar: () => EstadoCarreiraDeJogador }[] = [
  { nome: "moral baixa", montar: () => { const c = carreiraNova(); c.moral = 20; return c } },
  { nome: "moral alta", montar: () => { const c = carreiraNova(); c.moral = 85; c.temporadaAtual.jogos = 8; return c } },
  { nome: "com proposta", montar: () => {
    const c = carreiraNova()
    c.propostas = [{
      id: "p1", clubeNome: "Clube X", clubeCurto: "CLX", clubeFileKey: "clube_x",
      ligaNome: "Liga Y", pais: "Brasil", divisao: "A", salarioSemanal: 5000,
      temporadas: 3, valorDePasse: 1_000_000, prestigio: 80, statusPrometido: "titular",
    } as unknown as EstadoCarreiraDeJogador["propostas"][number]]
    return c
  } },
  { nome: "reputacao alta", montar: () => { const c = carreiraNova(); c.reputacao = 70; return c } },
  { nome: "fim de contrato", montar: () => { const c = carreiraNova(); c.contrato.ateTemporada = c.temporada + 1; return c } },
  { nome: "encostado", montar: () => {
    const c = carreiraNova(); c.temporadaAtual.jogos = 8; c.notaDoTreinador = 20; return c
  } },
]

let respostasConferidas = 0
for (const cenario of cenarios) {
  const base = cenario.montar()
  for (const conversa of conversasDoMomento(base)) {
    for (const escolha of conversa.escolhas) {
      const d = responderConversa(base, conversa.id, escolha.id)
      respostasConferidas++
      if (!d.texto.trim()) {
        erro(`[${cenario.nome}] ${conversa.id}/${escolha.id} respondeu sem texto nenhum`)
      }
      if (retrato(d.estado) === retrato(base)) {
        erro(`[${cenario.nome}] ${conversa.id}/${escolha.id} nao mudou NENHUM numero — e enfeite`)
      }
    }
  }
}
console.log(`${respostasConferidas} respostas conferidas em ${cenarios.length} cenarios`)
if (respostasConferidas < 12) erro(`so ${respostasConferidas} respostas exercitadas — cobertura fraca demais`)

// ── 4. Conversa respondida nao volta ─────────────────────────────────────────
const umaVez = carreiraNova()
umaVez.moral = 20
const primeira = conversasDoMomento(umaVez)[0]
const depois = responderConversa(umaVez, primeira.id, primeira.escolhas[0].id).estado
if (conversasDoMomento(depois).some(c => c.id === primeira.id)) {
  erro(`a conversa ${primeira.id} voltou depois de respondida`)
}

// ── 5. Cobrar promessa que nao existe nao pode PREMIAR ───────────────────────
// Sem `statusPrometido` no contrato o atleta esta cobrando algo que ninguem
// prometeu — a diretoria devolve isso, em vez de premiar a bravata.
const semPromessa = carreiraNova()
semPromessa.temporadaAtual.jogos = 8
semPromessa.notaDoTreinador = 20
semPromessa.contrato.statusPrometido = undefined
const cobranca = conversasDoMomento(semPromessa).find(c => c.com === "diretoria")
if (!cobranca) {
  erro("cenario de encostado nao gerou a conversa da diretoria")
} else {
  const r = responderConversa(semPromessa, cobranca.id, "cobrar")
  if (r.estado.notaDoTreinador > semPromessa.notaDoTreinador) {
    erro("cobrar promessa inexistente AUMENTOU a confianca do treinador")
  }
}

console.log(falhas === 0
  ? "\nCONVERSAS OK — aparecem so quando cabe, custam alguma coisa e nao se repetem."
  : `\n${falhas} problema(s) nas conversas do atleta.`)
process.exit(falhas === 0 ? 0 : 1)

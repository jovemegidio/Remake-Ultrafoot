// AS CONVERSAS DO ATLETA — família, empresário e diretoria.
//
// ⚠️ POR QUE ISTO EXISTE. O modo de atleta já falava com a IMPRENSA (entrevista,
// 1.0.328) e já tinha empresário como DADO (`EMPRESARIOS`, 1.0.326: um nome, uma
// comissão e três números). O que faltava era o resto da vida do jogador — as
// pessoas que cobram, apoiam e prometem coisas a ele fora de campo.
//
// ⚠️ E "CONVERSA" AQUI NÃO É TEXTO DECORATIVO. Cada resposta mexe em número que
// o resto do modo já lê: moral e forma entram na nota da partida; a nota do
// treinador decide se ele joga; reputação move as propostas; torcida decide se
// a saída é aplaudida. Uma tela de diálogo que não altera nada é a mesma
// armadilha do "foco de treino" que só valia uma vez por ano — e este modo já
// caiu nela uma vez.
//
// ⚠️ E ELAS NÃO APARECEM SEMPRE. Cada conversa tem uma CONDIÇÃO tirada do estado
// real: a mãe liga quando ele está encostado, o empresário aparece quando há
// proposta ou reputação para vender, a diretoria chama quando o contrato está
// perto do fim. Diálogo que aparece em toda rodada vira botão de "continuar",
// e o jogador para de ler na terceira vez.

import type { EstadoCarreiraDeJogador } from "@/lib/carreira-de-jogador"

export type Interlocutor = "familia" | "empresario" | "diretoria"

export interface EscolhaDaConversa {
  id: string
  texto: string
}

export interface ConversaDoAtleta {
  id: string
  com: Interlocutor
  /** Quem está falando, do ponto de vista do atleta. */
  quem: string
  assunto: string
  fala: string
  escolhas: EscolhaDaConversa[]
}

export interface DesfechoDaConversa {
  estado: EstadoCarreiraDeJogador
  /** O que dizer de volta ao jogador — inclusive quando a escolha custou caro. */
  texto: string
}

const ROTULO: Record<Interlocutor, string> = {
  familia: "Família",
  empresario: "Empresário",
  diretoria: "Diretoria",
}

export function rotuloDoInterlocutor(com: Interlocutor): string {
  return ROTULO[com]
}

const limitar = (v: number) => Math.max(0, Math.min(100, Math.round(v * 10) / 10))

/** Minutos por jogo disputado — a medida de "estou jogando ou não". */
function minutosPorRodada(estado: EstadoCarreiraDeJogador): number {
  const t = estado.temporadaAtual
  return t.jogos > 0 ? t.minutos / t.jogos : 0
}

/**
 * AS CONVERSAS QUE FAZEM SENTIDO AGORA.
 *
 * A ordem importa: a lista é lida de cima para baixo pela tela, e a primeira é a
 * que ele vê primeiro. Família vem antes de negócio de propósito — quando o
 * atleta está mal, é a ligação de casa que chega primeiro.
 */
export function conversasDoMomento(estado: EstadoCarreiraDeJogador): ConversaDoAtleta[] {
  if (estado.aposentado) return []
  const respondidas = new Set(estado.conversasRespondidas ?? [])
  const lista: ConversaDoAtleta[] = []
  const temporada = estado.temporada
  const minutos = minutosPorRodada(estado)
  const jogou = estado.temporadaAtual.jogos

  // ── FAMÍLIA ───────────────────────────────────────────────────────────────
  // Ela não fala de tática: fala de como ele está. Por isso a condição é moral
  // e minutos, não desempenho técnico.
  if (estado.moral < 45 || (jogou >= 3 && minutos < 30)) {
    lista.push({
      id: `familia_apoio_${temporada}`,
      com: "familia",
      quem: "Sua mãe",
      assunto: "A ligação de domingo à noite",
      fala: minutos < 30 && jogou >= 3
        ? "Vi que você não está entrando. Você está bem? Aqui em casa todo mundo torce, mas o que a gente quer mesmo é te ver feliz."
        : "Te achei pra baixo no último jogo. Quer conversar?",
      escolhas: [
        { id: "desabafar", texto: "Desabafar — dizer que está difícil" },
        { id: "firme", texto: "Dizer que está tudo sob controle" },
        { id: "cortar", texto: "Cortar a conversa, não é hora" },
      ],
    })
  }

  // Quando a coisa vai BEM a família também aparece — senão ela vira só o
  // canal das más notícias, e o jogador aprende a evitá-la.
  if (estado.moral >= 75 && jogou >= 5) {
    lista.push({
      id: `familia_orgulho_${temporada}`,
      com: "familia",
      quem: "Seu pai",
      assunto: "Depois da vitória",
      fala: "O pessoal do bairro inteiro viu o jogo. Não deixa isso subir à cabeça, viu?",
      escolhas: [
        { id: "pe_no_chao", texto: "Prometer manter os pés no chão" },
        { id: "comemorar", texto: "Aproveitar o momento — é para isso que se joga" },
      ],
    })
  }

  // ── EMPRESÁRIO ────────────────────────────────────────────────────────────
  // Ele só tem o que dizer quando há negócio: proposta na mesa ou reputação
  // suficiente para ir atrás de uma.
  if (estado.propostas.length > 0) {
    lista.push({
      id: `empresario_proposta_${temporada}_${estado.propostas.length}`,
      com: "empresario",
      quem: estado.empresario.nome,
      assunto: "Tem clube perguntando por você",
      fala: `Apareceu coisa na mesa. Posso empurrar a negociação, mas se eu forçar demais o ${estado.clubeNome} vai saber que você quer sair.`,
      escolhas: [
        { id: "forcar", texto: "Force a saída — quero jogar em outro lugar" },
        { id: "ouvir", texto: "Só ouça, sem se comprometer" },
        { id: "recusar", texto: "Não quero sair agora" },
      ],
    })
  } else if ((estado.reputacao ?? 30) >= 55) {
    lista.push({
      id: `empresario_vitrine_${temporada}`,
      com: "empresario",
      quem: estado.empresario.nome,
      assunto: "Sua imagem",
      fala: "Seu nome está circulando. Dá para trabalhar isso — mas exposição demais também cria cobrança.",
      escolhas: [
        { id: "expor", texto: "Aparecer mais — quero as vitrines" },
        { id: "discreto", texto: "Prefiro trabalhar em silêncio" },
      ],
    })
  }

  // ── DIRETORIA ─────────────────────────────────────────────────────────────
  // O clube chama quando tem assunto contratual ou quando ele está fora do time.
  if (estado.contrato.ateTemporada - temporada <= 1) {
    lista.push({
      id: `diretoria_renovacao_${temporada}`,
      com: "diretoria",
      quem: `Diretoria do ${estado.clubeNome}`,
      assunto: "Seu contrato está acabando",
      fala: "Queremos resolver sua situação antes do fim da temporada. O que você espera da gente?",
      escolhas: [
        { id: "salario", texto: "Quero salário à altura do que produzo" },
        { id: "minutos", texto: "Quero garantia de minutos, não dinheiro" },
        { id: "esperar", texto: "Prefiro esperar o fim da temporada" },
      ],
    })
  } else if (jogou >= 5 && estado.notaDoTreinador < 35) {
    lista.push({
      id: `diretoria_encostado_${temporada}`,
      com: "diretoria",
      quem: `Diretoria do ${estado.clubeNome}`,
      assunto: "Uma conversa franca",
      fala: "Sabemos que você não está jogando. O treinador tem os critérios dele, e a gente não passa por cima deles.",
      escolhas: [
        { id: "cobrar", texto: "Cobrar a promessa que me fizeram" },
        { id: "trabalhar", texto: "Dizer que vou brigar pela vaga no treino" },
        { id: "pedir_saida", texto: "Pedir para sair" },
      ],
    })
  }

  return lista.filter(c => !respondidas.has(c.id))
}

/**
 * A RESPOSTA, E O QUE ELA CUSTA.
 *
 * ⚠️ Toda escolha mexe em pelo menos um número que o resto do modo já usa. E
 * NENHUMA é gratuita: a que dá mais moral cobra em outro lugar, porque escolha
 * sem custo não é escolha — é botão.
 */
export function responderConversa(
  estado: EstadoCarreiraDeJogador,
  conversaId: string,
  escolhaId: string,
): DesfechoDaConversa {
  const conversa = conversasDoMomento(estado).find(c => c.id === conversaId)
  if (!conversa) return { estado, texto: "" }

  const novo: EstadoCarreiraDeJogador = structuredClone(estado)
  novo.conversasRespondidas = [...(novo.conversasRespondidas ?? []), conversaId]
  let texto = ""

  // ── FAMÍLIA: mexe em moral e forma, que é o que o apoio de casa alcança ───
  if (conversa.com === "familia") {
    if (escolhaId === "desabafar") {
      novo.moral = limitar(novo.moral + 9)
      novo.forma = limitar(novo.forma - 2)
      texto = "Você põe para fora. Sai mais leve — e um pouco mais cansado da semana."
    } else if (escolhaId === "firme") {
      novo.moral = limitar(novo.moral + 3)
      texto = "Você segura a barra sozinho. Ajuda menos, mas ninguém em casa fica preocupado."
    } else if (escolhaId === "cortar") {
      novo.moral = limitar(novo.moral - 6)
      texto = "Você desliga. A cobrança continua exatamente onde estava."
    } else if (escolhaId === "pe_no_chao") {
      novo.moral = limitar(novo.moral + 4)
      novo.forma = limitar(novo.forma + 3)
      texto = "Você mantém a rotina. O treinador nota quem não se perde na boa fase."
    } else if (escolhaId === "comemorar") {
      novo.moral = limitar(novo.moral + 8)
      novo.forma = limitar(novo.forma - 5)
      texto = "Você aproveita. Valeu a pena — a semana de trabalho é que sentiu."
    }
  }

  // ── EMPRESÁRIO: mexe em reputação, torcida e no pedido formal ─────────────
  if (conversa.com === "empresario") {
    if (escolhaId === "forcar") {
      novo.pedido = "transferencia"
      novo.reputacao = limitar((novo.reputacao ?? 30) + 4)
      novo.torcida = limitar((novo.torcida ?? 50) - 12)
      novo.notaDoTreinador = limitar(novo.notaDoTreinador - 4)
      texto = "O recado chega ao clube. O mercado esquenta, e a arquibancada não gosta."
    } else if (escolhaId === "ouvir") {
      novo.reputacao = limitar((novo.reputacao ?? 30) + 1)
      texto = "Ele ouve sem se comprometer. Nada muda hoje — e nada se queima."
    } else if (escolhaId === "recusar") {
      novo.torcida = limitar((novo.torcida ?? 50) + 8)
      novo.moral = limitar(novo.moral + 3)
      texto = "Você fica. A torcida fica sabendo que você escolheu ficar."
    } else if (escolhaId === "expor") {
      novo.reputacao = limitar((novo.reputacao ?? 30) + 7)
      novo.moral = limitar(novo.moral - 4)
      texto = "Seu nome circula mais. A cobrança vem junto."
    } else if (escolhaId === "discreto") {
      novo.forma = limitar(novo.forma + 4)
      texto = "Sem holofote, sobra semana para treinar."
    }
  }

  // ── DIRETORIA: mexe no contrato, na confiança e na relação com a torcida ──
  if (conversa.com === "diretoria") {
    if (escolhaId === "salario") {
      novo.pedido = "renovacao"
      novo.torcida = limitar((novo.torcida ?? 50) - 5)
      texto = "Pedido registrado. A diretoria responde no fim da temporada."
    } else if (escolhaId === "minutos") {
      novo.pedido = "mais_minutos"
      novo.notaDoTreinador = limitar(novo.notaDoTreinador + 3)
      texto = "Você troca dinheiro por vaga. O treinador é avisado do combinado."
    } else if (escolhaId === "esperar") {
      novo.moral = limitar(novo.moral - 3)
      texto = "Fica para depois. A indefinição pesa."
    } else if (escolhaId === "cobrar") {
      // ⚠️ COBRAR SÓ VALE SE HOUVE PROMESSA. Sem `statusPrometido` no contrato o
      // atleta está cobrando algo que ninguém prometeu — e a diretoria devolve
      // isso na cara dele, em vez de premiar a bravata.
      if (estado.contrato.statusPrometido) {
        novo.notaDoTreinador = limitar(novo.notaDoTreinador + 6)
        novo.moral = limitar(novo.moral + 4)
        texto = `Você lembra o que foi combinado (${estado.contrato.statusPrometido}). O clube cede.`
      } else {
        novo.moral = limitar(novo.moral - 5)
        novo.notaDoTreinador = limitar(novo.notaDoTreinador - 2)
        texto = "Ninguém prometeu nada por escrito. A conversa volta vazia."
      }
    } else if (escolhaId === "trabalhar") {
      novo.notaDoTreinador = limitar(novo.notaDoTreinador + 2)
      novo.forma = limitar(novo.forma + 4)
      texto = "Você promete brigar pela vaga. Ninguém garante nada, mas a porta fica aberta."
    } else if (escolhaId === "pedir_saida") {
      novo.pedido = "transferencia"
      novo.torcida = limitar((novo.torcida ?? 50) - 8)
      novo.moral = limitar(novo.moral - 2)
      texto = "Você pede para sair. O clube passa a ouvir propostas."
    }
  }

  return { estado: novo, texto }
}

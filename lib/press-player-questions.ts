// Perguntas de coletiva SOBRE ATLETAS específicos, e a repercussão individual
// que elas geram no vestiário.
//
// Pedido do usuário: "perguntas sobre atuação... se eu respondi 'o Memphis foi
// incrível', na central de notificações receberei uma mensagem dele".
//
// As perguntas fixas que existiam nunca citavam ninguém — elogiar ou cobrar não
// tinha destinatário. Aqui a pergunta nasce da PARTIDA que acabou (quem marcou,
// quem foi mal), então elogiar tem quem agradecer e cobrar tem quem se magoar.

export type TomResposta = "elogio" | "neutro" | "cobranca"

export interface AtletaDaPartida {
  nome: string
  gols: number
  /** Nota da atuação (0-10) quando disponível. */
  nota?: number
}

export interface PerguntaSobreAtleta {
  id: string
  /** Atleta a quem a resposta se destina. */
  atleta: string
  pergunta: string
  opcoes: { texto: string; tom: TomResposta; moralDelta: number }[]
}

export interface RepercussaoAtleta {
  atleta: string
  tom: TomResposta
  moralDelta: number
  titulo: string
  mensagem: string
}

/**
 * Monta perguntas a partir de quem se destacou (ou falhou) na partida.
 *
 * DESTAQUE tem prioridade sobre a crítica: perguntar sobre quem marcou é o que
 * o jornalista faria, e dá ao técnico a chance de elogiar publicamente.
 */
export function perguntasSobreAtletas(
  atletas: AtletaDaPartida[],
  venceu: boolean,
  limite = 2,
): PerguntaSobreAtleta[] {
  const out: PerguntaSobreAtleta[] = []

  const artilheiros = atletas.filter(a => a.gols > 0).sort((a, b) => b.gols - a.gols)
  for (const a of artilheiros.slice(0, limite)) {
    out.push({
      id: `destaque-${a.nome}`,
      atleta: a.nome,
      pergunta: a.gols > 1
        ? `${a.nome} marcou ${a.gols} vezes. Como avalia a atuação dele?`
        : `${a.nome} decidiu no gol. O que achou da partida dele?`,
      opcoes: [
        { texto: `${a.nome} foi incrível, fez a diferença sozinho.`, tom: "elogio", moralDelta: 8 },
        { texto: "Fez o trabalho dele, como todo o grupo fez.", tom: "neutro", moralDelta: 1 },
        { texto: "Marcou, mas ainda pode render muito mais.", tom: "cobranca", moralDelta: -5 },
      ],
    })
  }

  // Sem gols, ou sobrando espaço: pergunta sobre quem foi pior em campo.
  if (out.length < limite) {
    const piores = atletas
      .filter(a => a.nota != null && a.gols === 0)
      .sort((a, b) => (a.nota ?? 10) - (b.nota ?? 10))
    for (const a of piores.slice(0, limite - out.length)) {
      out.push({
        id: `critica-${a.nome}`,
        atleta: a.nome,
        pergunta: `${a.nome} teve uma atuação abaixo. Ele preocupa?`,
        opcoes: [
          { texto: `Confio no ${a.nome}, ele vai reencontrar o nível.`, tom: "elogio", moralDelta: 7 },
          { texto: "Faz parte, vamos trabalhar isso no dia a dia.", tom: "neutro", moralDelta: 0 },
          { texto: venceu
            ? `Ganhamos apesar dele. Precisa render muito mais.`
            : `Foi um dos motivos da derrota. Não dá para aceitar.`, tom: "cobranca", moralDelta: -10 },
        ],
      })
    }
  }

  return out
}

/**
 * O recado que o atleta manda depois de ouvir o técnico na coletiva.
 *
 * Elogio público gera agradecimento e sobe a moral; cobrança pública magoa. É o
 * que fecha o ciclo pedido: a resposta vira uma mensagem dele na Central.
 */
export function repercussaoDoAtleta(
  atleta: string,
  tom: TomResposta,
  moralDelta: number,
): RepercussaoAtleta {
  if (tom === "elogio") {
    return {
      atleta, tom, moralDelta,
      titulo: `${atleta} agradeceu o elogio`,
      mensagem: `"Vi o que o professor falou na coletiva. Isso me dá confiança — vou retribuir dentro de campo." — ${atleta}`,
    }
  }
  if (tom === "cobranca") {
    return {
      atleta, tom, moralDelta,
      titulo: `${atleta} não gostou da cobrança`,
      mensagem: `"Prefiro que essas conversas aconteçam no vestiário, não na imprensa." — ${atleta}`,
    }
  }
  return {
    atleta, tom, moralDelta,
    titulo: `${atleta} comentou a coletiva`,
    mensagem: `"Ouvi o professor. Sigo trabalhando normalmente." — ${atleta}`,
  }
}

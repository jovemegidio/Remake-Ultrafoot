// PRESTÍGIO DO ATLETA — Normal → Estrela → Top Mundial, ganho em campo.
//
// ## O buraco que isto tapa
//
// O campo `reputation` já existia, com os três níveis certos. Duas coisas o
// tornavam decorativo:
//
//  1. SÓ O EDITOR O DEFINIA. Ninguém virava Estrela jogando. Um garoto podia ser
//     artilheiro e Bola de Ouro cinco temporadas seguidas e continuar "normal"
//     para sempre — a carreira não escrevia nada de volta no atleta.
//  2. O EFEITO ERA `+10 NO OVERALL` (`reputationBonus`). Isso é força
//     disfarçada de status, e é o erro que mais vale evitar aqui: transformaria
//     "ganhou a Bola de Ouro" em "ficou 10 pontos melhor", o que dobra o prêmio
//     de quem já era o melhor e faz a curva de qualidade do mundo explodir em
//     dez temporadas.
//
// Os prêmios de fim de temporada (`lib/awards-engine.ts`) já eram calculados —
// Bola de Ouro, artilheiro, luva de ouro, revelação, seleção do campeonato — e
// morriam num registro histórico que ninguém lia. Este módulo é o que liga o
// feito à ficha do atleta.
//
// ## A regra
//
// **Prestígio é REPUTAÇÃO, não qualidade.** Ele muda quanto o mundo sabe dele,
// quanto ele custa, quanto ele quer ganhar, quem o procura — e quase nada dentro
// das quatro linhas. A única exceção é um empurrão de ~3% em jogo decisivo, que
// é pequeno o bastante para ser sabor e não desequilíbrio, e que anda junto com
// os `jogosDecisivos` que o perfil canônico já tinha.
//
// Consequência que importa para o desenho: **um atleta 89 pode ser Top Mundial e
// um 90 pode ser Normal.** É esse descolamento que faz o sistema valer.
//
// ⚠️ `reputationBonus` CONTINUA existindo e continua dando +10/+5 — mas só onde
// sempre esteve: no editor, quando o usuário marca a reputação à mão. É um botão
// manual dele, com efeito imediato e reversível na tela. O prestígio GANHADO em
// campo nunca passa por lá.

/** Os três níveis. Mesmos nomes do campo `reputation` que já existia. */
export type NivelDePrestigio = "normal" | "estrela" | "top_mundial"

/**
 * Pontos por feito, apurados na virada de temporada.
 *
 * A escala é calibrada para uma carreira: ~100 pontos é uma grande temporada
 * individual, e é o que separa o bom jogador do craque reconhecido. Ganhar a
 * Bola de Ouro do seu país duas vezes basta para virar Estrela; chegar a Top
 * Mundial exige repetir o feito por anos, que é exatamente o que o Brasfoot faz.
 */
export const PONTOS_POR_FEITO: Record<string, number> = {
  bola_de_ouro: 100,
  artilheiro: 55,
  luva_de_ouro: 45,
  revelacao: 30,
  selecao_do_campeonato: 15,
  titulo_nacional: 20,
  titulo_continental: 45,
  titulo_mundial: 60,
}

/** Faixas dos níveis. */
export const LIMIAR_ESTRELA = 100
export const LIMIAR_TOP_MUNDIAL = 250

/**
 * QUANTO O PRESTÍGIO ESFRIA POR TEMPORADA.
 *
 * Sem isto, o prestígio só sobe: quem foi artilheiro aos 22 seria Top Mundial
 * aos 38 encostado no banco, e a distinção perderia o sentido em dez
 * temporadas. É subtração pequena de propósito — o craque não vira anônimo em um
 * ano ruim, mas some se desaparecer por cinco.
 */
export const DECAIMENTO_POR_TEMPORADA = 12

/** Teto: acima disto os pontos só engordariam o save sem mudar nada. */
const TETO = 600

export function nivelDePrestigio(pontos: number): NivelDePrestigio {
  if (pontos >= LIMIAR_TOP_MUNDIAL) return "top_mundial"
  if (pontos >= LIMIAR_ESTRELA) return "estrela"
  return "normal"
}

export const ROTULO_DO_PRESTIGIO: Record<NivelDePrestigio, string> = {
  normal: "Normal",
  estrela: "Estrela",
  top_mundial: "Top Mundial",
}

/**
 * O que o save guarda: id do atleta → pontos. Só quem tem ponto entra.
 *
 * Um `Record` de números é o formato mais barato que existe para isto, e o
 * decaimento remove a entrada quando ela zera — então um save de vinte
 * temporadas guarda algumas dezenas de atletas, não o mundo inteiro. Ver
 * [[ultrafoot-imagens-pesando-no-save]] para o custo de fazer o contrário.
 */
export type PrestigioDosAtletas = Record<number, number>

export interface FeitoDaTemporada {
  playerId: number
  /** Chave de `PONTOS_POR_FEITO`. Chave desconhecida é ignorada, não quebra. */
  feito: string
}

/**
 * VIRADA DE TEMPORADA: credita os feitos e esfria o resto.
 *
 * ⚠️ A ORDEM IMPORTA e é esta: decai TODO MUNDO primeiro, credita depois. Ao
 * contrário, quem acabou de ganhar a Bola de Ouro pagaria o decaimento no mesmo
 * ano em que a ganhou — e o atleta que se manteve no topo por dez temporadas
 * acumularia sempre `feitos - decaimento` em vez de `feitos`.
 */
export function virarTemporada(
  atual: PrestigioDosAtletas | undefined,
  feitos: FeitoDaTemporada[],
): PrestigioDosAtletas {
  const saida: PrestigioDosAtletas = {}

  for (const [id, pontos] of Object.entries(atual ?? {})) {
    const esfriado = Math.round(Number(pontos) - DECAIMENTO_POR_TEMPORADA)
    // Zerou: sai do save. É o que impede o mapa de crescer para sempre.
    if (esfriado > 0) saida[Number(id)] = esfriado
  }

  for (const { playerId, feito } of feitos) {
    const ganho = PONTOS_POR_FEITO[feito]
    if (!ganho) continue
    saida[playerId] = Math.min(TETO, (saida[playerId] ?? 0) + ganho)
  }

  return saida
}

/** Nível de um atleta. Sem entrada = normal, que é o caso do mundo inteiro. */
export function prestigioDe(
  mapa: PrestigioDosAtletas | undefined,
  playerId: number,
): NivelDePrestigio {
  return nivelDePrestigio(mapa?.[playerId] ?? 0)
}

/**
 * Quem SUBIU DE NÍVEL nesta virada. É o que a notícia do jogo precisa saber —
 * "Fulano virou Estrela" só é notícia no ano em que acontece.
 */
export function promocoesDePrestigio(
  antes: PrestigioDosAtletas | undefined,
  depois: PrestigioDosAtletas,
): { playerId: number; de: NivelDePrestigio; para: NivelDePrestigio }[] {
  const saida: { playerId: number; de: NivelDePrestigio; para: NivelDePrestigio }[] = []
  for (const [chave, pontos] of Object.entries(depois)) {
    const id = Number(chave)
    const de = nivelDePrestigio(antes?.[id] ?? 0)
    const para = nivelDePrestigio(pontos)
    if (de !== para && (para === "estrela" || para === "top_mundial")) {
      saida.push({ playerId: id, de, para })
    }
  }
  return saida
}

// ─── EFEITOS ─────────────────────────────────────────────────────────────────
//
// Todos fora das quatro linhas, com uma exceção declarada. Se algum dia alguém
// quiser somar prestígio no overall, o lugar de discutir isso é aqui, à vista,
// e não escondido num `* 1.53` dentro do motor.

/**
 * VALOR DE MERCADO. O craque reconhecido custa mais que o número dele sugere —
 * é a diferença entre comprar um atleta e comprar um nome.
 */
export function multiplicadorDeValor(nivel: NivelDePrestigio): number {
  return nivel === "top_mundial" ? 1.85 : nivel === "estrela" ? 1.35 : 1
}

/**
 * SALÁRIO PEDIDO. Sobe menos que o valor de mercado de propósito: o clube que
 * vende lucra mais do que o que paga a folha sofre, senão contratar Estrela
 * viraria armadilha financeira sem contrapartida.
 */
export function multiplicadorDeSalario(nivel: NivelDePrestigio): number {
  return nivel === "top_mundial" ? 1.55 : nivel === "estrela" ? 1.25 : 1
}

// ⚠️ NÃO ACRESCENTE AQUI UM MULTIPLICADOR SEM UM CONSUMIDOR.
//
// A primeira versão deste arquivo tinha também `multiplicadorDeInteresse`
// (quantos clubes sondam o atleta) e `bonusDeJogoDecisivo` (~3% em final). Os
// dois foram removidos antes de subir, por um motivo que este projeto já pagou
// caro várias vezes: nenhum dos dois tinha quem os chamasse.
//
// Função exportada sem consumidor parece sistema pronto, some no arquivo e volta
// meses depois como "isso já não existia?" — foi assim com `calcularFama`
// (lib/player-fame.ts, ninguém chama até hoje) e com `fatorDeJogoDecisivo` e
// `semanasParaAdaptar` (lib/modelo-de-jogador.ts, 1.0.293, idem). Ver
// [[ultrafoot-sistemas-implementados-porem-desligados]].
//
// Os dois são a continuação natural desta versão. Quando entrarem, entram junto
// com o lugar que os lê — o motor de propostas e o `MatchConfig`, respectivamente.

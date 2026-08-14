// CARACTERÍSTICAS DO ATLETA — o "em que ele é bom", separado do "quanto ele é bom".
//
// ## O que existia, e por que não bastava
//
// O catálogo das características (Armação, Cabeceio, Cruzamento, Desarme,
// Drible, Finalização, Marcação, Passe, Resistência, Velocidade + as cinco de
// goleiro) JÁ existia — em `lib/player-overrides.ts`, junto do editor. Duas
// coisas o tornavam inerte:
//
//  1. SÓ O EDITOR CRIAVA. Nenhum dos ~66 mil atletas do pool tinha
//     característica nenhuma até alguém abrir a ficha dele e marcar à mão. Na
//     prática o sistema existia para uma dúzia de jogadores.
//  2. O EFEITO ERA `+6 NO ATRIBUTO`. Isso não é característica, é atributo
//     disfarçado: dois laterais 80, um de Cruzamento+Velocidade e outro de
//     Marcação+Desarme, viravam simplesmente um lateral 80 com ritmo alto e
//     outro com defesa alta — e o motor tratava os dois igual no lance.
//
// Havia ainda um SEGUNDO sistema paralelo, as `tendencias` de
// `lib/modelo-de-jogador.ts`: oito movimentos preferidos, derivados do id,
// exibidos na tela de gerenciamento e lidos por ninguém. Duas listas de
// "temperos do atleta" concorrendo é exatamente o padrão que já custou caro
// neste projeto (ver [[ultrafoot-sistemas-implementados-porem-desligados]]).
// Este módulo é o sobrevivente: as tendências passam a ser DERIVADAS daqui.
//
// ## A regra que sustenta o desenho
//
// **A característica não soma qualidade — ela redistribui OPORTUNIDADE.**
//
// A qualidade do atleta já entra no motor pelo overall e pelos seis atributos.
// Se a característica somasse de novo, seria contar duas vezes (o defeito
// recorrente do projeto — ver o cabeçalho de `lib/forcas-individuais.ts`). O que
// ela decide é OUTRA coisa: quem cabeceia o escanteio, quem puxa o
// contra-ataque, quem dá a assistência, quem aguenta os noventa minutos.
//
// Consequência prática, e é o teste do desenho: gerar característica para o
// mundo inteiro NÃO pode mexer na força de nenhum elenco. Os pesos abaixo são
// todos relativos ao sorteio dentro do próprio time, e os multiplicadores de xG
// vêm em par com um custo. `test-caracteristicas.ts` mede isso em 4 mil jogos.
//
// ⚠️ O `+6` do editor CONTINUA valendo para quem foi marcado à mão. Ele é um
// botão manual do usuário, já estava calibrado assim, e tirá-lo mudaria elencos
// que alguém editou de propósito. As características GERADAS não somam nada.

import { normalizePosition } from "@/lib/formations"

// ─── CATÁLOGO ────────────────────────────────────────────────────────────────
//
// Duas por atleta, no máximo. Cada uma aponta o atributo que reforça (usado só
// pelo bônus do editor) e, mais importante, o COMPORTAMENTO que ela muda.

export const MAX_CARACTERISTICAS = 2

export interface Caracteristica {
  id: string
  nome: string
  /** Atributo reforçado pelo bônus do EDITOR. `null` = efeito amplo. */
  atributo: "pace" | "shooting" | "passing" | "dribbling" | "defending" | "physical" | null
  descricao: string
}

/** Características de goleiro. */
export const CARACTERISTICAS_GOLEIRO: Caracteristica[] = [
  { id: "colocacao", nome: "Colocação", atributo: "defending", descricao: "Escolhe bem a posição e encurta o ângulo do atacante." },
  { id: "defesa_penalty", nome: "Defesa Penalty", atributo: "defending", descricao: "Lê a cobrança e cresce na marca da cal." },
  { id: "reflexo", nome: "Reflexo", atributo: "pace", descricao: "Reage a finalização de curta distância." },
  { id: "saida_gol", nome: "Saída Gol", atributo: "physical", descricao: "Sai bem do gol e domina a área alta." },
  { id: "reposicao", nome: "Reposição", atributo: "passing", descricao: "Começa a jogada com o pé, não só chuta para frente." },
]

/** Características de quem joga na linha — as mesmas para todas as posições. */
export const CARACTERISTICAS_LINHA: Caracteristica[] = [
  { id: "armacao", nome: "Armação", atributo: "passing", descricao: "Organiza a saída e acha o passe que quebra a linha." },
  { id: "cabeceio", nome: "Cabeceio", atributo: "physical", descricao: "Ganha a bola aérea nas duas áreas." },
  { id: "cruzamento", nome: "Cruzamento", atributo: "passing", descricao: "Bola na área com precisão pelos lados." },
  { id: "desarme", nome: "Desarme", atributo: "defending", descricao: "Chega no carrinho e no bote com limpeza." },
  { id: "drible", nome: "Drible", atributo: "dribbling", descricao: "Encara o marcador no um contra um." },
  { id: "finalizacao", nome: "Finalização", atributo: "shooting", descricao: "Converte o que aparece dentro e fora da área." },
  { id: "marcacao", nome: "Marcação", atributo: "defending", descricao: "Fecha espaço e não larga o homem." },
  { id: "passe", nome: "Passe", atributo: "passing", descricao: "Troca de bola limpa e sem perder a posse." },
  { id: "resistencia", nome: "Resistência", atributo: "physical", descricao: "Mantém o ritmo os noventa minutos." },
  { id: "velocidade", nome: "Velocidade", atributo: "pace", descricao: "Ganha no primeiro passo e no espaço aberto." },
  { id: "lideranca", nome: "Liderança", atributo: null, descricao: "Puxa o time quando o jogo aperta." },
]

/** O catálogo certo para a posição. Goleiro tem o seu; o resto compartilha. */
export function caracteristicasDaPosicao(posicao: string): Caracteristica[] {
  return normalizePosition(posicao) === "GOL" ? CARACTERISTICAS_GOLEIRO : CARACTERISTICAS_LINHA
}

const POR_ID = new Map(
  [...CARACTERISTICAS_GOLEIRO, ...CARACTERISTICAS_LINHA].map(c => [c.id, c]),
)

export function caracteristicaPorId(id: string): Caracteristica | undefined {
  return POR_ID.get(id)
}

/**
 * Quanto cada característica do EDITOR soma no atributo que reforça.
 *
 * Só vale para quem foi marcado à mão — ver o aviso no cabeçalho. As geradas
 * passam longe daqui.
 */
export const BONUS_CARACTERISTICA = 6

export function bonusDasCaracteristicas(
  traits: string[] | undefined,
): Partial<Record<"pace" | "shooting" | "passing" | "dribbling" | "defending" | "physical", number>> {
  const saida: Partial<Record<"pace" | "shooting" | "passing" | "dribbling" | "defending" | "physical", number>> = {}
  for (const id of (traits ?? []).slice(0, MAX_CARACTERISTICAS)) {
    const c = POR_ID.get(id)
    if (!c?.atributo) continue
    saida[c.atributo] = (saida[c.atributo] ?? 0) + BONUS_CARACTERISTICA
  }
  return saida
}

// ─── GERAÇÃO ─────────────────────────────────────────────────────────────────

/**
 * Quais características fazem sentido em cada posição.
 *
 * Segue o que o manual do Brasfoot associa a cada função: Cruzamento em
 * lateral/ala, Desarme e Marcação em zagueiro e volante, Finalização em atacante
 * e meia ofensivo, Velocidade em ponta, lateral e atacante. Um zagueiro não sai
 * daqui com "Finalização" — não porque seja impossível, mas porque o mundo
 * inteiro sorteado sem filtro vira ruído em vez de identidade.
 */
const CANDIDATAS_POR_POSICAO: Record<string, string[]> = {
  GOL: ["reflexo", "colocacao", "saida_gol", "defesa_penalty", "reposicao"],
  ZAG: ["marcacao", "desarme", "cabeceio", "lideranca", "velocidade"],
  LD: ["velocidade", "cruzamento", "marcacao", "resistencia", "desarme"],
  LE: ["velocidade", "cruzamento", "marcacao", "resistencia", "desarme"],
  VOL: ["desarme", "marcacao", "passe", "resistencia", "armacao", "lideranca"],
  MEI: ["armacao", "passe", "drible", "finalizacao", "lideranca"],
  MD: ["cruzamento", "drible", "velocidade", "passe"],
  ME: ["cruzamento", "drible", "velocidade", "passe"],
  PD: ["drible", "velocidade", "cruzamento", "finalizacao"],
  PE: ["drible", "velocidade", "cruzamento", "finalizacao"],
  ATA: ["finalizacao", "cabeceio", "velocidade", "drible"],
}

export interface AtributosDoAtleta {
  pace: number
  shooting: number
  passing: number
  dribbling: number
  defending: number
  physical: number
}

/** Aleatório determinístico por semente. Multiplicador próprio, para o sorteio
 *  da característica não andar junto com o da persona nem com o do perfil. */
function rng(semente: number): () => number {
  let h = (semente * 3266489917) >>> 0
  return () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5; h >>>= 0
    return h / 4294967296
  }
}

// Chave inclui a posição e o overall: um atleta que muda de função ou evolui
// pode legitimamente ganhar outra característica na leitura seguinte.
const cache = new Map<string, string[]>()

/**
 * CARACTERÍSTICAS DE UM ATLETA — as marcadas no editor, ou 0 a 2 geradas.
 *
 * Determinístico: mesma entrada, mesma saída, sem gravar um byte no save. Mesmo
 * princípio de `perfilDoAtleta` e `gerarPersona`.
 *
 * A escolha NÃO é sorteio puro: parte do desnível dos atributos DELE contra o
 * próprio overall. Um atacante cuja finalização está acima do resto do perfil
 * tende a sair com "Finalização"; um cujo ritmo se destaca, com "Velocidade".
 * É o que faz a característica explicar o atleta em vez de contradizê-lo.
 *
 * Quantas: ~30% ficam sem nenhuma, ~45% com uma, ~25% com duas — inclinado pelo
 * overall, porque o limitado tende a ter menos coisa que o distinga. Isso segue
 * o próprio manual do Brasfoot, que avisa que UMA característica indica atleta
 * mais limitado, não um especialista extraordinário.
 *
 * @param override Lista marcada à mão no editor. Quando existe, vence inteira —
 *                 o editor é a fonte de verdade, como em todo o resto do jogo.
 */
export function caracteristicasDoAtleta(
  id: number,
  posicao: string,
  atributos: AtributosDoAtleta,
  overall: number,
  override?: string[] | null,
): string[] {
  if (override && override.length > 0) return override.slice(0, MAX_CARACTERISTICAS)

  const natural = normalizePosition(posicao)
  const chave = `${id}|${natural}|${overall}`
  const guardado = cache.get(chave)
  if (guardado) return guardado

  const candidatas = CANDIDATAS_POR_POSICAO[natural] ?? CANDIDATAS_POR_POSICAO.ATA
  const r = rng(id || 1)

  // Quantas. O viés por overall é modesto: um atleta 60 não fica proibido de ter
  // duas, só é menos provável.
  const vies = (overall - 68) / 100 // ~-0,28 a +0,31
  const sorteioQuantas = r()
  const quantas = sorteioQuantas < 0.30 - vies ? 0 : sorteioQuantas < 0.75 - vies * 0.5 ? 1 : 2

  if (quantas === 0) {
    cache.set(chave, [])
    return []
  }

  // Nota de cada candidata: o quanto o atributo dela se destaca no perfil DELE,
  // mais um ruído que impede o elenco inteiro de sair idêntico. O goleiro não
  // tem atributo de linha que sirva de pista, então vai no ruído puro.
  const notas = candidatas.map(idCarac => {
    const c = POR_ID.get(idCarac)
    const destaque = c?.atributo ? (atributos[c.atributo] ?? overall) - overall : 0
    return { id: idCarac, nota: destaque * 0.6 + r() * 10 }
  })
  notas.sort((a, b) => b.nota - a.nota)

  const escolhidas = notas.slice(0, quantas).map(n => n.id)
  // Teto de memória: o pool tem dezenas de milhares de atletas e as telas de
  // mercado varrem elencos inteiros. Mesmo motivo do cache de `perfilDoAtleta`.
  if (cache.size > 8000) cache.clear()
  cache.set(chave, escolhidas)
  return escolhidas
}

// ─── EFEITO NO MOTOR ─────────────────────────────────────────────────────────

/**
 * Como as características deste atleta mudam o que ele FAZ em campo.
 *
 * Os campos `peso*` são pesos de SORTEIO dentro do próprio time: 1 = a média do
 * elenco. Não criam qualidade — redistribuem quem participa de cada tipo de
 * lance. Os `mult*` são multiplicadores de eficiência, e vêm sempre pequenos.
 */
export interface PesosDeLance {
  /** Peso no sorteio de quem finaliza em jogada trabalhada. */
  pesoFinalizar: number
  /** Peso no sorteio do alvo aéreo (escanteio, cruzamento). */
  pesoAereo: number
  /** Peso no sorteio de quem dá a assistência. */
  pesoCriar: number
  /** Peso no sorteio de quem puxa o contra-ataque. */
  pesoVelocidade: number
  /** Multiplicador do xG do chute dele em jogada trabalhada. */
  multChute: number
  /** Multiplicador do xG da cabeçada dele. */
  multCabeceio: number
  /** Multiplicador de queda de energia. Abaixo de 1 = aguenta mais. */
  multDesgaste: number
  /** Multiplicador de rendimento em jogo decisivo (final, clássico, mata-mata). */
  multDecisivo: number
}

export const PESOS_NEUTROS: PesosDeLance = {
  pesoFinalizar: 1, pesoAereo: 1, pesoCriar: 1, pesoVelocidade: 1,
  multChute: 1, multCabeceio: 1, multDesgaste: 1, multDecisivo: 1,
}

/**
 * ⚠️ TODA LINHA COM `mult` ACIMA DE 1 TEM DE VIR COM UM CUSTO EM ALGUM LUGAR, ou
 * gerar característica para o mundo inteiro inflaciona o mundo inteiro.
 *
 * O custo aqui é estrutural, não uma penalidade escrita linha a linha: o
 * finalizador converte mais no chute trabalhado (`multChute`) e nada muda no
 * resto; o cabeceador converte mais de cabeça e o time não ganha escanteio
 * extra por isso. Como os pesos de sorteio somam sempre 1 na média do elenco, a
 * bola muda de pé — não aparece bola nova.
 */
const EFEITO: Record<string, Partial<PesosDeLance>> = {
  // Linha
  armacao: { pesoCriar: 1.7 },
  cabeceio: { pesoAereo: 2.2, multCabeceio: 1.12 },
  cruzamento: { pesoCriar: 1.6 },
  desarme: { multDesgaste: 0.97 },
  // ⚠️ OS `multChute` SAO PEQUENOS PORQUE FORAM MEDIDOS, nao chutados. Com 1.10
  // no finalizador e 1.04 no driblador, `test-caracteristicas` mediu a media de
  // gols do mundo subindo 3,7% ao ligar caracteristica para todos — pouco para
  // notar numa partida, muito para uma calibracao feita em 20 mil jogos
  // ([[ultrafoot-calibracao-do-motor]]). Baixados ate a deriva ficar em ~1%.
  //
  // O grosso do efeito do "Finalizacao" nao esta aqui: esta no `pesoFinalizar`,
  // que poe a bola no pe de quem chuta melhor. Esse redistribui; este soma.
  drible: { pesoFinalizar: 1.3, pesoCriar: 1.3, multChute: 1.015 },
  finalizacao: { pesoFinalizar: 1.8, multChute: 1.04 },
  marcacao: { multDesgaste: 0.98 },
  passe: { pesoCriar: 1.6 },
  resistencia: { multDesgaste: 0.85 },
  velocidade: { pesoVelocidade: 2.0, pesoFinalizar: 1.2 },
  lideranca: { multDecisivo: 1.03 },
  // Goleiro — o efeito de verdade sai de `goleiroPorCaracteristicas`, abaixo.
  // Aqui só o que vale para o arqueiro como jogador de campo.
  reposicao: { pesoCriar: 1.2 },
  saida_gol: { pesoAereo: 1.2 },
}

/** Multiplica os efeitos das características do atleta. Lista vazia = neutro. */
export function pesosDeLance(traits: string[] | undefined): PesosDeLance {
  if (!traits || traits.length === 0) return PESOS_NEUTROS
  const out = { ...PESOS_NEUTROS }
  for (const id of traits.slice(0, MAX_CARACTERISTICAS)) {
    const efeito = EFEITO[id]
    if (!efeito) continue
    for (const chave of Object.keys(efeito) as (keyof PesosDeLance)[]) {
      out[chave] *= efeito[chave] as number
    }
  }
  for (const chave of Object.keys(out) as (keyof PesosDeLance)[]) {
    out[chave] = Math.round(out[chave] * 1000) / 1000
  }
  return out
}

// ─── GOLEIRO ─────────────────────────────────────────────────────────────────

/**
 * As características de goleiro REDISTRIBUEM as cinco habilidades dele, sem
 * mexer na média.
 *
 * Isso é de propósito, e é a única forma de o sistema valer alguma coisa: o
 * motor lia UM escalar (`forcaGoleiro`) em todo lance, então qualquer
 * redistribuição que preservasse a média seria literalmente invisível. Junto
 * desta função, `lib/modelo-de-jogador.ts` passa a publicar uma força AÉREA
 * separada e um peso de pênalti — aí "Saída Gol" e "Defesa Penalty" viram
 * consequência: o arqueiro que domina a área sofre menos em escanteio e paga por
 * isso no chute de fora.
 *
 * Devolve os deltas a somar em cada habilidade (escala 1-20), somando ~0.
 */
export function goleiroPorCaracteristicas(traits: string[] | undefined): {
  reflexos: number; saidaDoGol: number; jogoAereo: number; jogoComOsPes: number; posicionamento: number
} {
  const d = { reflexos: 0, saidaDoGol: 0, jogoAereo: 0, jogoComOsPes: 0, posicionamento: 0 }
  if (!traits) return d
  for (const id of traits.slice(0, MAX_CARACTERISTICAS)) {
    // Cada linha tira de um lado o que põe no outro. `defesa_penalty` não
    // aparece aqui: ela não muda o arqueiro no jogo corrido, só na marca da cal.
    if (id === "reflexo") { d.reflexos += 3; d.saidaDoGol -= 1.5; d.jogoAereo -= 1.5 }
    else if (id === "colocacao") { d.posicionamento += 3; d.reflexos -= 1.5; d.jogoComOsPes -= 1.5 }
    else if (id === "saida_gol") { d.saidaDoGol += 2; d.jogoAereo += 2; d.reflexos -= 2; d.posicionamento -= 2 }
    else if (id === "reposicao") { d.jogoComOsPes += 3; d.reflexos -= 1.5; d.posicionamento -= 1.5 }
  }
  return d
}

/** Peso do goleiro na cobrança de pênalti. 1 = média; acima, defende mais. */
export function pesoDePenalti(traits: string[] | undefined): number {
  return traits?.includes("defesa_penalty") ? 1.6 : 1
}

// ─── PONTE COM AS TENDÊNCIAS ─────────────────────────────────────────────────

/**
 * As oito `tendencias` de `lib/modelo-de-jogador.ts` viram TEXTO derivado daqui.
 *
 * Elas nunca tiveram efeito no motor e nunca vão ter — eram a segunda lista de
 * "temperos" concorrendo com esta. Em vez de apagar (a tela de gerenciamento já
 * as mostra e o usuário já as conhece), elas passam a ser a LEITURA em
 * português das características, que agora são as que valem. Uma verdade só.
 */
export function frasesDasCaracteristicas(traits: string[] | undefined): string[] {
  return (traits ?? [])
    .slice(0, MAX_CARACTERISTICAS)
    .map(id => POR_ID.get(id)?.nome)
    .filter((n): n is string => Boolean(n))
}

// MODELO CANÔNICO DO ATLETA — a camada que faltava debaixo dos seis atributos.
//
// O que existia antes desta versão (e é bom, não jogar fora)
// ─────────────────────────────────────────────────────────
// - `lib/player-attributes.ts`: os seis atributos (pace, shooting, passing,
//   dribbling, defending, physical) GERADOS a partir da posição, com o overall
//   reconciliado. Nada aqui substitui isso.
// - `lib/player-realism.ts` → `PlayerPersona`: determinação, profissionalismo,
//   temperamento e consistência, ocultos, derivados do id.
// - `preferredFoot` e `height` REAIS, importados do Transfermarkt.
// - `secondaryPositions`: uma LISTA de posições alternativas.
//
// O que faltava, e é o que este arquivo acrescenta
// ────────────────────────────────────────────────
// 1. GOLEIRO não tinha atributo nenhum de goleiro. O arqueiro era avaliado pelos
//    mesmos seis atributos do jogador de linha, e o `gkRating` do motor saía do
//    `defending` dele. Reflexo, saída do gol e jogo com os pés não existiam.
// 2. PÉ FRACO não existia — só o pé dominante.
// 3. FAMILIARIDADE era binária: a posição estava na lista de secundárias ou não.
//    Não havia "joga de lateral razoavelmente e de zagueiro mal", nem qualquer
//    forma de APRENDER uma posição jogando nela.
// 4. Quatro ocultos que o resto do jogo pedia e ninguém tinha: jogos decisivos,
//    adaptação, versatilidade e propensão a lesão.
// 5. TENDÊNCIAS (movimentos preferidos) não existiam.
//    ⚠️ Voltaram atrás na 1.0.298: viraram enfeite que ninguém lia e concorriam
//    com as CARACTERÍSTICAS. Ver o aviso no lugar onde ficavam, mais abaixo.
//
// Como isto NÃO incha o save
// ──────────────────────────
// O perfil é DERIVADO do id do atleta, como a persona já era: mesma entrada,
// mesma saída, para sempre, sem gravar um byte. Só o que EVOLUI — a
// familiaridade ganha jogando — é guardado, e só quando sai de zero.
// Ver [[ultrafoot-imagens-pesando-no-save]] para o custo de fazer o contrário.
//
// ⚠️ Nada aqui vale se ninguém consumir. O critério do próprio usuário é
// "nenhum controle de interface sem consequência no motor". Os consumidores
// estão marcados campo a campo abaixo.

import { goleiroPorCaracteristicas } from "@/lib/caracteristicas-do-atleta"
import { normalizePosition, penalidadeImprovisacao } from "@/lib/formations"

/** Atributos que só o goleiro tem. 1-20, escala dos ocultos. */
export interface AtributosDeGoleiro {
  reflexos: number
  saidaDoGol: number
  jogoAereo: number
  jogoComOsPes: number
  posicionamento: number
}

export interface PerfilCanonico {
  /** Qualidade do pé fraco, 1-5 (a escala que o jogador reconhece). */
  pesFraco: number
  /** Familiaridade BASE por posição normalizada, 0-20. Não inclui o aprendido. */
  familiaridadeBase: Record<string, number>
  /** 1-20. Rende mais em final, clássico e decisão. */
  jogosDecisivos: number
  /** 1-20. Velocidade com que se entrosa num clube novo. */
  adaptacao: number
  /** 1-20. Rapidez para aprender uma posição nova. */
  versatilidade: number
  /** 1-20. Quanto MAIS alto, mais se machuca. */
  propensaoALesao: number
  /** Só para goleiros; `undefined` para jogador de linha. */
  goleiro?: AtributosDeGoleiro
}

/** O que de fato vai para o save: apenas o que muda com o tempo. */
export interface ProgressoDoPerfil {
  /** Posição normalizada -> pontos de familiaridade GANHOS jogando (0-20). */
  familiaridadeGanha?: Record<string, number>
  /**
   * Função individual (`PlayerRole`) -> partidas exercendo ela.
   *
   * ⚠️ É COISA DIFERENTE da adequação de `lib/forcas-individuais.ts`. Aquela
   * pergunta "os atributos dele servem para esta função?" e é imediata; esta
   * pergunta "ele já se acostumou a exercê-la?" e só o tempo responde. Um
   * zagueiro com o perfil perfeito de `zagueiro_libero` ainda erra a saída de
   * bola nas primeiras partidas na função.
   */
  funcoesExercidas?: Record<string, number>
}

/**
 * MULTIPLICADOR DE FAMILIARIDADE COM A FUNÇÃO, ~0,80 a 1,00.
 *
 * Aplicado por cima da adequação por atributos. Fica ABAIXO de 1 no começo em
 * vez de acima de 1 no fim, de propósito: função nova deve custar, não premiar.
 * Fosse bônus, trocar a função de todo mundo toda semana seria vantagem.
 *
 * A curva satura em ~15 partidas — uma meia temporada, que é mais ou menos o
 * tempo em que um atleta de verdade "assenta" numa função nova.
 */
export function familiaridadeComAFuncao(
  progresso: ProgressoDoPerfil | undefined,
  funcao: string | undefined,
  versatilidade: number,
): number {
  if (!funcao) return 1
  const partidas = progresso?.funcoesExercidas?.[funcao] ?? 0
  const alvo = Math.max(6, Math.round(18 - versatilidade / 2))
  return Math.round((0.8 + Math.min(1, partidas / alvo) * 0.2) * 1000) / 1000
}

/** Credita UMA partida exercendo a função. Devolve o mesmo objeto se saturou. */
export function exercerFuncao(
  progresso: ProgressoDoPerfil | undefined,
  funcao: string | undefined,
): ProgressoDoPerfil | undefined {
  if (!funcao) return progresso
  const atual = progresso?.funcoesExercidas?.[funcao] ?? 0
  // Teto de 30: acima disso o multiplicador já saturou em 1,00 e continuar
  // contando só engordaria o save por nada.
  if (atual >= 30) return progresso
  return { ...progresso, funcoesExercidas: { ...progresso?.funcoesExercidas, [funcao]: atual + 1 } }
}

/**
 * Aleatório determinístico por semente. Cópia deliberada do `rng` de
 * `player-realism`: o perfil precisa ser estável entre sessões e não pode
 * depender da ordem em que as telas pedem o dado.
 */
function rng(semente: number): () => number {
  let h = (semente * 2246822519) >>> 0
  return () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5; h >>>= 0
    return h / 4294967296
  }
}

const TODAS_AS_POSICOES = ["GOL", "ZAG", "LD", "LE", "VOL", "MEI", "MD", "ME", "PD", "PE", "ATA"]

// ⚠️ AS `tendencias` SAIRAM DAQUI NA 1.0.298.
//
// Eram oito "movimentos preferidos" derivados do id, exibidos na tela de
// gerenciamento e lidos por NINGUEM no motor — enfeite, pelo criterio do proprio
// projeto. Pior: concorriam com as CARACTERISTICAS (Cabeceio, Finalizacao,
// Velocidade...), que ja existiam no editor e dizem a mesma coisa com os nomes
// que o jogador reconhece. Duas listas de "tempero do atleta" e o padrao que ja
// custou caro aqui — ver [[ultrafoot-sistemas-implementados-porem-desligados]].
//
// A sobrevivente e `lib/caracteristicas-do-atleta.ts`, que agora gera a lista
// para TODO atleta e tem efeito de verdade no motor.

/**
 * FAMILIARIDADE BASE.
 *
 * A posição natural é 20. As demais saem da mesma tabela de parentesco que o
 * motor já usava para penalizar improvisação (`penalidadeImprovisacao`), para
 * as duas coisas não discordarem: seria absurdo o atleta ter familiaridade alta
 * numa posição que o motor considera improviso. As secundárias declaradas no
 * elenco entram por cima, com um piso alto — elas são informação de cadastro,
 * não estimativa.
 */
function montarFamiliaridade(
  posicaoNatural: string,
  secundarias: string[],
  versatilidade: number,
): Record<string, number> {
  const natural = normalizePosition(posicaoNatural)
  const mapa: Record<string, number> = {}
  for (const alvo of TODAS_AS_POSICOES) {
    if (alvo === natural) { mapa[alvo] = 20; continue }
    // A penalidade vale 0,55 (gol) a 0,94 (mesmo setor, outro lado). Convertida
    // para 0-20, e depois inclinada pela versatilidade: um atleta versátil
    // aproveita melhor o parentesco entre as funções.
    const parentesco = penalidadeImprovisacao(natural, alvo)
    const bruto = Math.max(0, (parentesco - 0.55) / (0.94 - 0.55)) * 13
    mapa[alvo] = Math.round(Math.max(0, Math.min(16, bruto * (0.7 + versatilidade / 40))))
  }
  for (const secundaria of secundarias) {
    const chave = normalizePosition(secundaria)
    if (!chave || chave === natural) continue
    mapa[chave] = Math.max(mapa[chave] ?? 0, 15)
  }
  return mapa
}

// Memória curta: o perfil é pedido em render, por dezenas de telas, para elencos
// inteiros. Recalcular 25 perfis por quadro é desperdício puro.
//
// ⚠️ A CHAVE INCLUI AS SECUNDÁRIAS. Chavear só por id ignorava a diferença entre
// "lateral" e "lateral que também joga de zagueiro": a primeira leitura vencia e
// a segunda devolvia o perfil errado, sem erro nenhum na tela. O teste
// `test-modelo-de-jogador` cobre exatamente este caso.
const cache = new Map<string, PerfilCanonico>()

function chaveDeCache(id: number, posicao: string, overall: number, secundarias: string[]): string {
  return `${id}|${posicao}|${overall}|${secundarias.join(",")}`
}

/**
 * Perfil canônico de um atleta. Determinístico: mesma entrada, mesma saída.
 *
 * ⚠️ NÃO chame com `overall` variável ao longo da carreira esperando estabilidade
 * — o overall entra só como viés de distribuição, mas ele MUDA quando o atleta
 * evolui. Os campos que precisam ser imutáveis (tendências, pé fraco, ocultos)
 * usam apenas o `id` como semente; o overall inclina somente o goleiro, que
 * acompanha a qualidade do arqueiro de propósito.
 */
export function perfilDoAtleta(
  id: number,
  posicao: string,
  overall: number,
  secundarias: string[] = [],
): PerfilCanonico {
  const chave = chaveDeCache(id, posicao, overall, secundarias)
  const guardado = cache.get(chave)
  if (guardado) return guardado

  const r = rng(id || 1)
  const oculto = () => 1 + Math.floor(r() * 20)

  const jogosDecisivos = oculto()
  const adaptacao = oculto()
  const versatilidade = oculto()
  const propensaoALesao = oculto()
  const pesFraco = 1 + Math.floor(r() * 5)

  const natural = normalizePosition(posicao)

  // GOLEIRO. Gira em volta do overall dele — um arqueiro 80 não pode ter
  // reflexo de 5. Convertido de 0-100 para 1-20 e depois espalhado, para que
  // dois goleiros de mesmo overall ainda sejam goleiros diferentes.
  let goleiro: AtributosDeGoleiro | undefined
  if (natural === "GOL") {
    const centro = Math.max(1, Math.min(20, Math.round(overall / 5)))
    const perto = () => Math.max(1, Math.min(20, centro + Math.floor(r() * 7) - 3))
    goleiro = {
      reflexos: perto(),
      saidaDoGol: perto(),
      jogoAereo: perto(),
      jogoComOsPes: perto(),
      posicionamento: perto(),
    }
  }

  const perfil: PerfilCanonico = {
    pesFraco,
    familiaridadeBase: montarFamiliaridade(posicao, secundarias, versatilidade),
    jogosDecisivos,
    adaptacao,
    versatilidade,
    propensaoALesao,
    goleiro,
  }
  // Teto de memória: o pool tem 66 mil atletas e telas de mercado varrem elencos
  // inteiros. Sem o teto, o cache seguraria todos eles pela sessão inteira.
  if (cache.size > 4000) cache.clear()
  cache.set(chave, perfil)
  return perfil
}

/** Familiaridade EFETIVA numa posição: a base mais o que ele aprendeu jogando. */
export function familiaridadeEm(
  perfil: PerfilCanonico,
  progresso: ProgressoDoPerfil | undefined,
  posicao: string,
): number {
  const chave = normalizePosition(posicao)
  const base = perfil.familiaridadeBase[chave] ?? 0
  const ganho = progresso?.familiaridadeGanha?.[chave] ?? 0
  return Math.max(0, Math.min(20, base + ganho))
}

/**
 * APRENDER A POSIÇÃO JOGANDO NELA.
 *
 * Um lateral escalado de zagueiro por meia temporada tem de ficar melhor de
 * zagueiro — era isso que não existia: a improvisação custava o mesmo no
 * primeiro e no trigésimo jogo. O ganho é lento de propósito (o teto de 20 é a
 * posição natural, e ninguém vira zagueiro de verdade em três partidas) e o
 * versátil aprende mais rápido.
 *
 * Devolve o progresso ATUALIZADO, ou o mesmo objeto quando nada mudou — quem
 * chama pode comparar por referência para evitar gravar save à toa.
 */
export function aprenderPosicao(
  perfil: PerfilCanonico,
  progresso: ProgressoDoPerfil | undefined,
  posicao: string,
  minutosJogados: number,
): ProgressoDoPerfil | undefined {
  if (minutosJogados <= 0) return progresso
  const chave = normalizePosition(posicao)
  const base = perfil.familiaridadeBase[chave] ?? 0
  if (base >= 20) return progresso

  const ganhoAtual = progresso?.familiaridadeGanha?.[chave] ?? 0
  const teto = 20 - base
  if (ganhoAtual >= teto) return progresso

  // ~90 minutos de um atleta de versatilidade média valem ~0,25 ponto: uma
  // temporada inteira fora da posição rende uns 10 pontos, não os 20.
  const passo = (minutosJogados / 90) * (0.12 + perfil.versatilidade / 100)
  const novo = Math.min(teto, Math.round((ganhoAtual + passo) * 100) / 100)
  if (novo === ganhoAtual) return progresso

  return { ...progresso, familiaridadeGanha: { ...progresso?.familiaridadeGanha, [chave]: novo } }
}

/**
 * RENDIMENTO DO ATLETA NAQUELE SLOT, 0..1.
 *
 * Substitui `penalidadeImprovisacao` quando há perfil: aquela função só conhece
 * o PAR de posições, então dois atletas diferentes escalados fora de posição
 * rendiam exatamente o mesmo. Agora o que manda é a familiaridade DELE.
 *
 * A curva é deliberadamente igual à antiga nas pontas (familiaridade 20 = 1,00;
 * familiaridade 0 ≈ 0,76) para não mudar o equilíbrio de partidas já calibrado
 * em 20 mil jogos — ver [[ultrafoot-calibracao-do-motor]]. O que muda é o MEIO
 * da curva, que antes não existia.
 */
export function rendimentoNaPosicao(
  perfil: PerfilCanonico,
  progresso: ProgressoDoPerfil | undefined,
  slot: string,
): number {
  const fam = familiaridadeEm(perfil, progresso, slot)
  return Math.round((0.76 + (fam / 20) * 0.24) * 1000) / 1000
}

/**
 * As cinco habilidades do arqueiro JÁ COM as características dele aplicadas.
 *
 * `goleiroPorCaracteristicas` devolve deltas que somam ~0: "Reflexo" tira do
 * jogo aéreo e da saída o que põe no reflexo. Não é um buff — é o que
 * diferencia dois goleiros de mesma força.
 */
function habilidadesDoArqueiro(
  perfil: PerfilCanonico,
  caracteristicas?: string[],
): AtributosDeGoleiro | null {
  const g = perfil.goleiro
  if (!g) return null
  if (!caracteristicas?.length) return g
  const d = goleiroPorCaracteristicas(caracteristicas)
  const chaves = ["reflexos", "saidaDoGol", "jogoAereo", "jogoComOsPes", "posicionamento"] as const
  const limitar = (v: number) => Math.max(1, Math.min(20, v))

  // ⚠️ O TETO DE 20 QUASE INVERTEU O SISTEMA. Um arqueiro que já tinha reflexo 19
  // ganhava só +1 do "Reflexo" (o resto batia no teto) e pagava os -3 inteiros nas
  // outras habilidades — ou seja, a característica que deveria destacá-lo o
  // deixava PIOR. Falhava só nos goleiros perto do teto, que são justamente os
  // craques; o teste `test-caracteristicas` pegou isto na primeira execução.
  //
  // A conta agora é em duas fases: aplica o que sobe, mede quanto de fato coube,
  // e cobra o custo NA MESMA PROPORÇÃO. Quem não pôde ganhar, não paga.
  let prometido = 0
  let entregue = 0
  const parcial: Record<string, number> = {}
  for (const k of chaves) {
    if (d[k] <= 0) continue
    prometido += d[k]
    const novo = limitar(g[k] + d[k])
    entregue += novo - g[k]
    parcial[k] = novo
  }
  const proporcao = prometido > 0 ? entregue / prometido : 1

  const saida = { ...g }
  for (const k of chaves) {
    if (d[k] > 0) saida[k] = parcial[k] ?? g[k]
    else if (d[k] < 0) saida[k] = limitar(g[k] + d[k] * proporcao)
  }
  return saida
}

/**
 * FORÇA DO GOLEIRO a partir dos atributos de goleiro, em escala de overall.
 *
 * O motor lia `defending` do arqueiro, um atributo de jogador de linha que nada
 * dizia sobre defender pênalti ou sair no cruzamento. Os pesos seguem o que
 * decide jogo: reflexo e posicionamento acima de jogo com os pés.
 */
export function forcaDeGoleiro(perfil: PerfilCanonico, caracteristicas?: string[]): number | null {
  const g = habilidadesDoArqueiro(perfil, caracteristicas)
  if (!g) return null
  const media =
    g.reflexos * 0.34 +
    g.posicionamento * 0.26 +
    g.jogoAereo * 0.18 +
    g.saidaDoGol * 0.14 +
    g.jogoComOsPes * 0.08
  return Math.round(media * 5)
}

/**
 * FORÇA DO GOLEIRO NA BOLA ALTA — escanteio, cruzamento, falta na área.
 *
 * ⚠️ SEM ISTO AS CARACTERÍSTICAS DE GOLEIRO SERIAM INVISÍVEIS, e o motivo é
 * matemático, não de gosto: o motor lia UM escalar em todo lance, e
 * `goleiroPorCaracteristicas` redistribui preservando a média. Redistribuir sem
 * ninguém consultar a distribuição é o mesmo que não fazer nada.
 *
 * Com duas leituras — uma de jogo corrido, esta do jogo aéreo — "Saída Gol"
 * finalmente significa algo: o arqueiro que domina a área sofre menos em
 * escanteio E paga por isso no chute de fora, porque tirou do reflexo e do
 * posicionamento para pôr ali.
 */
export function forcaDeGoleiroNoAlto(perfil: PerfilCanonico, caracteristicas?: string[]): number | null {
  const g = habilidadesDoArqueiro(perfil, caracteristicas)
  if (!g) return null
  const media =
    g.jogoAereo * 0.42 +
    g.saidaDoGol * 0.30 +
    g.posicionamento * 0.16 +
    g.reflexos * 0.12
  return Math.round(media * 5)
}

/**
 * MULTIPLICADOR DE JOGO DECISIVO (final, clássico, mata-mata).
 *
 * Fica entre ~0,96 e ~1,04: é o suficiente para o craque de personalidade
 * aparecer numa decisão sem transformar a final num sorteio diferente do resto
 * da temporada.
 */
export function fatorDeJogoDecisivo(perfil: PerfilCanonico, decisivo: boolean): number {
  if (!decisivo) return 1
  return Math.round((0.96 + (perfil.jogosDecisivos / 20) * 0.08) * 1000) / 1000
}

/**
 * PESO NO SORTEIO DE LESÃO. 1 = média do elenco.
 *
 * Antes o motor sorteava a vítima entre as posições, com todo atleta tendo
 * exatamente a mesma chance — o "jogador de vidro" não existia.
 */
export function pesoDeLesao(perfil: PerfilCanonico): number {
  return Math.round((0.55 + (perfil.propensaoALesao / 20) * 0.9) * 100) / 100
}

/**
 * SEMANAS PARA SE ENTROSAR num clube novo. Reforço que não se adapta demora.
 */
export function semanasParaAdaptar(perfil: PerfilCanonico): number {
  return Math.max(2, Math.round(14 - (perfil.adaptacao / 20) * 10))
}

/**
 * A BOLA VOA DE VERDADE — o que separa este modo de um simulador de manager.
 *
 * ─── O QUE ESTE ARQUIVO SUBSTITUI ───────────────────────────────────────────
 *
 * Até a 1.0.368 a sua mira virava um NÚMERO que multiplicava uma probabilidade,
 * e um dado decidia:
 *
 *     const chance = base * (0.35 + 0.9 * qualidade.precisao) * conversao
 *     const sucesso = roll(...) < chance
 *
 * Era melhor que o sorteio cego que veio antes — a mira passou a importar —,
 * mas continuava sendo sorteio informado. O jogador nunca via POR QUE a bola
 * entrou ou saiu, e "acertei e não foi gol" ficava indistinguível de azar.
 *
 * Aqui não há dado no desfecho. Você aponta, a bola SAI, e onde ela termina é
 * consequência de trajetória: efeito curva o caminho, gravidade puxa, o goleiro
 * decide o lado e chega ou não chega. O gol é geometria.
 *
 * ─── ONDE O ATLETA ENTRA, JÁ QUE NÃO HÁ MAIS ROLAGEM ────────────────────────
 *
 * ⚠️ ESTA É A DECISÃO DE DESENHO MAIS IMPORTANTE DO ARQUIVO. Sem dado, o
 * atributo precisa de outro lugar para viver — e o lugar errado é o desfecho
 * (um "atributo alto = mais gol" no fim devolveria a roleta por outro nome).
 *
 * O atributo vive em TRÊS lugares, todos ANTES de a bola sair:
 *
 *   DESVIO    a bola não vai exatamente aonde você apontou. Finalização 40
 *             erra muito; finalização 95, quase nada. É o tremor da mão, e é
 *             determinístico pela semente — a mesma jogada replayada erra igual.
 *   POTÊNCIA  o teto de força. Um atleta fraco não bate no ângulo de longe
 *             porque a bola não CHEGA com velocidade, não porque "falhou".
 *   EFEITO    quanto a bola curva. Só quem tem drible alto consegue a curva que
 *             passa pelo goleiro e volta.
 *
 * Depois disso a física é igual para todo mundo. É por isso que um atleta
 * comum bem apontado supera um craque mal apontado — e é o que o teste cobra.
 */

/** Onde a bola termina, no plano do gol. Origem no centro da linha. */
export interface PontoNoGol {
  /** −1 = poste esquerdo, +1 = poste direito. Fora disso, saiu. */
  x: number
  /** 0 = rasteiro, 1 = travessão. Acima de 1, passou por cima. */
  y: number
}

export interface ChuteDoJogador {
  /** Para onde ele apontou: mesmo sistema de `PontoNoGol`. */
  alvo: PontoNoGol
  /** 0 a 1. */
  forca: number
  /** −1 (curva para a esquerda) a +1 (para a direita). 0 = sem efeito. */
  efeito: number
}

export interface AtributosDoChute {
  finalizacao: number
  /** Governa a potência máxima. */
  fisico: number
  /** Governa quanta curva ele consegue imprimir. */
  drible: number
  /**
   * ALTURA EM CENTÍMETROS (1.0.374).
   *
   * ⚠️ ELA SÓ EXISTE ONDE O CORPO DECIDE, e isso é de propósito. Até aqui
   * altura e peso eram gravados na ficha do atleta e não entravam em conta
   * nenhuma — dado de enfeite, que é pior que dado nenhum porque o jogador
   * escolhe achando que escolhe algo.
   *
   * Onde ela entra: NO CABECEIO, e só. Num chute com o pé, ser alto não ajuda
   * a acertar o canto — inventar um bônus ali seria devolver o enfeite com
   * outro nome. No jogo aéreo ela decide se a bola sai de cima ou de baixo do
   * zagueiro, e é a diferença entre o centroavante de área e o ponta franzino.
   */
  altura?: number
  /** Pé bom. `"ambos"` = não há pé fraco. */
  pePreferido?: "direito" | "esquerdo" | "ambos"
  /**
   * QUÃO BOM É O PÉ RUIM — 1 (não bate) a 5 (bate igual).
   *
   * Mesma escala de estrelas que a ficha do atleta já mostrava sem usar.
   */
  peFraco?: number
}

/**
 * DE ONDE O CHUTE SAI — e por que isto precisou existir.
 *
 * ⚠️ SEM CONTEXTO, A FÍSICA VIRA UM JOGO RESOLVIDO. Medido: com o goleiro
 * mecânico e nada mais, um atacante de finalização 94 apontava no canto e fazia
 * 100% — porque o desvio dele é ínfimo e o canto está fora do alcance do
 * goleiro. A resposta ótima virava "mire sempre no canto baixo", e o jogo
 * acabava na segunda partida.
 *
 * O erro era de modelo, não de número: no futebol o que limita o atacante NÃO é
 * a mão trêmula dele — é o tempo que ele tem, o ângulo que sobrou e o zagueiro
 * em cima. Um centroavante profissional acerta o canto num treino de bola
 * parada quase sempre; o que ele não consegue é fazer isso com um marcador
 * chegando e meio segundo para decidir.
 *
 * Por isso o contexto entra ANTES da física e mexe nas três coisas que o atleta
 * controlava sozinho. É ele que separa a grande chance do chute de fora.
 */
export interface ContextoDoChute {
  /** 0 = dentro da pequena área; 1 = fora da grande. */
  distancia: number
  /** 0 = de frente para o gol; 1 = quase na linha de fundo. */
  angulo: number
  /** 0 = livre; 1 = zagueiro em cima, sem tempo. */
  pressao: number
  /**
   * O GOLEIRO ESTÁ PRESO À LINHA?
   *
   * ⚠️ ISTO É REGRA, NÃO AJUSTE DE DIFICULDADE. Num pênalti o goleiro não pode
   * sair da linha antes da batida — e sem esta distinção o modelo dava 16% de
   * conversão de pênalti (o futebol real dá ~76%), porque o goleiro "avançava"
   * numa cobrança em que ele legalmente não pode avançar.
   */
  goleiroNaLinha?: boolean
  /**
   * COM QUE PÉ A BOLA VEM (1.0.374).
   *
   * ⚠️ QUEM ESCOLHE NÃO É O JOGADOR, É A JOGADA. Deixar o atleta optar pelo pé
   * bom em todo lance apagaria o pé fraco do jogo — na prática ninguém usaria
   * o ruim, e o atributo voltaria a ser enfeite. A bola sobra do lado que
   * sobra: cruzamento que vem da direita cai no pé esquerdo, e é aí que se
   * descobre se o atleta bate com os dois.
   *
   * Ausente = o lance não força lado (pênalti, falta parada), e aí ele bate
   * com o pé bom.
   */
  pe?: "direito" | "esquerdo"
  /**
   * A BOLA VEM ALTA e a finalização é de cabeça.
   *
   * Muda a física de verdade, não é rótulo: cabeça não imprime curva, alcança
   * menos potência e erra mais — o que se ganha é ALTURA, e por isso este é o
   * único lugar onde o centímetro do atleta conta.
   */
  deCabeca?: boolean
}

/** Contexto de uma finalização normal dentro da área, sob marcação leve. */
export const CHANCE_PADRAO: ContextoDoChute = { distancia: 0.35, angulo: 0.25, pressao: 0.35 }

export interface Goleiro {
  /** 1 a 99. Decide alcance, tempo de reação e leitura. */
  qualidade: number
  /**
   * ALTURA DELE, em centímetros (1.0.374).
   *
   * ⚠️ SÓ MEXE NO ALCANCE VERTICAL, nunca no horizontal. Goleiro alto pega
   * mais bola no alto e NÃO corre mais rápido pelo chão — no futebol real é
   * exatamente esse o trade-off, e somar altura no alcance total faria o
   * goleirão defender também o canto rasteiro, que é justamente o que ele
   * defende pior.
   */
  altura?: number
}

export interface TrajetoriaDaBola {
  /** Onde ela de fato cruzou o plano do gol. */
  chegada: PontoNoGol
  /** Pontos do caminho, para a tela desenhar. */
  caminho: { x: number; y: number; z: number }[]
  /** Velocidade com que chegou, 0 a 1. O goleiro alcança menos bola forte. */
  velocidade: number
  /** Quanto a bola levou para chegar. É o tempo que o goleiro tem. */
  tempoDeVoo: number
}

export type DesfechoDoChute =
  | { tipo: "gol"; onde: PontoNoGol; trajetoria: TrajetoriaDaBola; texto: string }
  | { tipo: "defesa"; onde: PontoNoGol; trajetoria: TrajetoriaDaBola; ladoDoGoleiro: number; texto: string }
  | { tipo: "trave"; onde: PontoNoGol; trajetoria: TrajetoriaDaBola; texto: string }
  | { tipo: "fora"; onde: PontoNoGol; trajetoria: TrajetoriaDaBola; texto: string }

const limitar = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

/** Sorteio semeado — a MESMA jogada replayada erra do mesmo jeito. */
function ruido(semente: string): number {
  let h = 2166136261
  for (let i = 0; i < semente.length; i++) {
    h ^= semente.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (((h >>> 0) % 100000) / 100000) * 2 - 1
}

/**
 * O DESVIO QUE O ATLETA NÃO CONTROLA.
 *
 * ⚠️ ELE É O SUBSTITUTO DO DADO. Sem contexto (bola parada, sem ninguém perto):
 *
 *     finalização 40  →  ate ~0,20 da meia-largura do gol
 *     finalização 70  →  ate ~0,07
 *     finalização 95  →  ate ~0,01
 *
 * Esses números são de TREINO, e é assim que tem de ser: um profissional acerta
 * o canto quando tem tempo. Quem afasta a bola do lugar é o contexto —
 * marcação, distância e ângulo multiplicam este desvio por até 4x.
 *
 * Força alta também abre: bater com tudo é menos preciso, o que dá sentido a
 * escolher a força em vez de deixá-la sempre no máximo.
 */
export function desvioDoAtleta(
  finalizacao: number,
  forca: number,
  contexto: ContextoDoChute = { distancia: 0, angulo: 0, pressao: 0 },
): number {
  const habilidade = limitar(finalizacao, 1, 99) / 100
  const base = 0.42 * Math.pow(1 - habilidade, 2.1)

  // ⚠️ O PISO É O QUE IMPEDE O CRAQUE DE SER PERFEITO, e a primeira versão o
  // deixou perto de zero (0,012): medido, o atacante bom convertia 100% de
  // pênalti e de grande chance. Um jogo em que a resposta ótima acerta sempre
  // acabou na segunda partida.
  //
  // 0,045 é o tremor que ninguém elimina — a bola de futebol não vai no
  // milímetro nem no treino. A pressão soma por cima.
  const piso = 0.045 + contexto.pressao * 0.075

  // Pressão pesa mais que tudo: e o zagueiro chegando que estraga finalizacao.
  const doContexto = 1
    + contexto.pressao * 2.4
    + contexto.distancia * 1.1
    + contexto.angulo * 0.8

  return (base + piso) * doContexto * (0.75 + forca * 0.55)
}

/**
 * Potência real: o teto é físico, e o atleta fraco não alcança o ângulo de longe.
 *
 * Sob pressão ele não consegue armar a perna — o teto cai. É isso que faz o
 * chute de primeira, apertado, ser fraco mesmo com um atacante forte.
 */
export function potenciaReal(
  forca: number,
  fisico: number,
  contexto: ContextoDoChute = { distancia: 0, angulo: 0, pressao: 0 },
): number {
  const teto = (0.55 + (limitar(fisico, 1, 99) / 100) * 0.45) * (1 - contexto.pressao * 0.28)
  return limitar(forca, 0, 1) * teto
}

/** Curva máxima que ele consegue imprimir. */
export function efeitoReal(efeito: number, drible: number): number {
  return limitar(efeito, -1, 1) * (0.2 + (limitar(drible, 1, 99) / 100) * 0.8)
}

/**
 * O PÉ ERRADO — o que ele custa, e por que custa nisto e não no desfecho.
 *
 * ⚠️ A TENTAÇÃO ERA UM `if (peErrado) chance *= 0.7` NO FIM. Isso seria a
 * roleta de volta: o jogador apontaria igual, veria a bola sair igual, e
 * perderia o gol por um número invisível. Aqui o pé ruim aparece onde ele
 * aparece no futebol — a bola sai TORTA e sai MOLE, e o jogador vê os dois.
 *
 * Escala de estrelas (a mesma da ficha, que até a 1.0.373 não era lida):
 *
 *     1 estrela  →  desvio 2,05x, potência 0,74x   (não bate mesmo)
 *     3 estrelas →  desvio 1,45x, potência 0,88x
 *     5 estrelas →  desvio 1,00x, potência 1,00x   (canhoto dos dois)
 *
 * Quem tem `pePreferido: "ambos"` nunca é penalizado — e é isso que faz esse
 * perfil valer alguma coisa na hora de montar o atleta.
 */
function fatoresDoPe(atributos: AtributosDoChute, contexto: ContextoDoChute): { desvio: number; potencia: number; efeito: number } {
  const neutro = { desvio: 1, potencia: 1, efeito: 1 }
  // Cabeceio não tem pé: quem decide ali é a altura, logo abaixo.
  if (contexto.deCabeca) return neutro
  const preferido = atributos.pePreferido ?? "ambos"
  if (preferido === "ambos" || !contexto.pe || contexto.pe === preferido) return neutro

  const estrelas = limitar(atributos.peFraco ?? 3, 1, 5)
  const ruim = (5 - estrelas) / 4          // 0 = bate igual, 1 = não bate
  return {
    desvio: 1 + ruim * 1.05,
    potencia: 1 - ruim * 0.26,
    // Curva com o pé ruim é o que mais se perde: quem não bate de canhota não
    // faz a bola voltar. Sem esta linha, o pé fraco ainda cobraria falta.
    efeito: 1 - ruim * 0.62,
  }
}

/**
 * A CABEÇA — e o único lugar em que a altura do atleta decide alguma coisa.
 *
 * Um cabeceio não é um chute fraco: é outro gesto. Não curva (a cabeça não
 * imprime efeito), chega com menos velocidade que o pé, e erra mais. O que ele
 * tem de próprio é a ALTURA — e é ela que separa quem ganha a bola de quem
 * pula junto e não alcança.
 *
 * 185 cm é o eixo: nele nada muda. Abaixo perde potência e precisão, acima
 * ganha — com teto, porque a partir de certo ponto o problema deixa de ser
 * alcançar e passa a ser a bola chegar boa.
 */
function fatoresDaCabeca(atributos: AtributosDoChute, contexto: ContextoDoChute): { desvio: number; potencia: number; efeito: number } {
  if (!contexto.deCabeca) return { desvio: 1, potencia: 1, efeito: 1 }
  const altura = limitar(atributos.altura ?? 180, 155, 210)
  const vantagem = limitar((altura - 185) / 25, -1, 1)
  return {
    // Cabeceio é sempre menos preciso que o pé; o alto compensa parte disso.
    desvio: 1.5 - vantagem * 0.34,
    potencia: 0.78 + vantagem * 0.16,
    // Zerado, não reduzido: cabeça não faz a bola curvar, ponto.
    efeito: 0,
  }
}

/**
 * A TRAJETÓRIA.
 *
 * Modelo simples de propósito: o que precisa ser verdade é que o jogador
 * ENTENDA o voo olhando. A curva desloca lateralmente ao longo do caminho (mais
 * no fim, como bola com efeito de verdade); a gravidade puxa proporcional ao
 * tempo de voo, e bola fraca cai mais porque demora mais para chegar.
 */
export function calcularTrajetoria(
  chute: ChuteDoJogador,
  atributos: AtributosDoChute,
  semente: string,
  contexto: ContextoDoChute = CHANCE_PADRAO,
): TrajetoriaDaBola {
  // ⚠️ O CORPO ENTRA AQUI, E NÃO NO DESFECHO (1.0.374). Pé errado e cabeceio
  // multiplicam as MESMAS três grandezas que o atributo já governava — desvio,
  // potência e efeito. Nada disso toca no resultado depois que a bola sai: a
  // física continua igual para todos, que é o que faz o modo ser jogável em
  // vez de sorteado.
  const pe = fatoresDoPe(atributos, contexto)
  const cabeca = fatoresDaCabeca(atributos, contexto)

  const potencia = potenciaReal(chute.forca, atributos.fisico, contexto) * pe.potencia * cabeca.potencia
  const curva = efeitoReal(chute.efeito, atributos.drible) * pe.efeito * cabeca.efeito
  const desvio = desvioDoAtleta(atributos.finalizacao, chute.forca, contexto) * pe.desvio * cabeca.desvio

  // O tremor: um em x, outro em y, sementes diferentes para não correlacionar.
  const erroX = ruido(`${semente}:x`) * desvio
  const erroY = ruido(`${semente}:y`) * desvio * 0.7

  // ⚠️ BOLA FRACA CAI. O tempo de voo é inverso da potência, e a queda é
  // proporcional a ele. Sem isto, a força viraria só "mais difícil de defender"
  // e bater fraco no ângulo seria gratuito.
  // ⚠️ A DISTANCIA ENTRA NO TEMPO DE VOO, e e por isso que chute de fora e
  // dificil: a bola demora mais para chegar e o goleiro cobre mais chao.
  // ⚠️ 0,35 E NAO 0,55. Com 0,55 o chute de fora demorava tanto que a queda
  // levava TODA bola para o chao antes da linha — medido: 600 de 600 "fora".
  // Chute de fora e dificil por causa do goleiro ter tempo, nao por ser
  // fisicamente impossivel acertar o gol.
  const tempoDeVoo = (1.35 - potencia * 0.75) * (1 + contexto.distancia * 0.35)
  const queda = tempoDeVoo * tempoDeVoo * 0.28

  const chegada: PontoNoGol = {
    x: chute.alvo.x + erroX + curva * 0.45,
    y: chute.alvo.y + erroY - queda + potencia * 0.12,
  }

  const caminho: TrajetoriaDaBola["caminho"] = []
  for (let i = 0; i <= 24; i++) {
    const t = i / 24
    // A curva age mais no fim do voo — é o que faz a bola "voltar".
    const lateral = curva * 0.45 * (t * t)
    caminho.push({
      x: (chute.alvo.x + erroX) * t + lateral,
      y: (chute.alvo.y + erroY) * t - queda * t * t + potencia * 0.12 * t,
      z: t,
    })
  }

  return { chegada, caminho, velocidade: potencia, tempoDeVoo }
}

/**
 * O GOLEIRO.
 *
 * ⚠️ A PRIMEIRA VERSÃO DELE DEFENDIA TUDO — 0% de gol em 60 cenários medidos.
 *
 * O defeito era conceitual, não numérico. Eu fazia o goleiro "projetar" a
 * direção a partir de um quadro inicial:
 *
 *     const projetado = lido.x / lido.z        // ⬅ clarividência
 *
 * Só que o caminho da bola é linear em `t`, então `x/z` reconstrói o destino
 * EXATO de qualquer chute sem efeito. O goleiro lia o futuro e escolhia sempre
 * o lado certo; a partir daí, qualquer alcance razoável pegava tudo.
 *
 * ─── O MODELO CERTO É MECÂNICO, NÃO ADIVINHATÓRIO ───────────────────────────
 *
 * O goleiro começa PARADO NO CENTRO, em pé. Quando a bola sai, ele mergulha. O
 * que decide a defesa é uma corrida:
 *
 *     quanto ele consegue COBRIR   =  velocidade dele × tempo de voo da bola
 *     quanto ele PRECISA cobrir    =  distância do centro até onde a bola vai
 *
 * Daí sai tudo o que se espera de um jogo de futebol, sem nenhuma regra
 * especial escrita à mão:
 *
 *   · canto vale mais que meio — está mais longe do centro;
 *   · bola forte vale mais — encurta o tempo de voo, e ele cobre menos;
 *   · bola alta no canto é a mais difícil — a distância é diagonal;
 *   · goleiro melhor cobre mais chão.
 *
 * ⚠️ E O LADO AINDA IMPORTA, senão o efeito seria decorativo. Ele lê a direção
 * INICIAL do voo (o primeiro terço) e se compromete. Uma bola com curva sai
 * para um lado e termina no outro: quem se comprometeu errado perde metade do
 * alcance. Chute reto não engana ninguém — e isso é correto, porque a
 * dificuldade dele tem de vir da potência e do canto, não de enganação.
 */
export function defesaDoGoleiro(
  trajetoria: TrajetoriaDaBola,
  goleiro: Goleiro,
  contexto: ContextoDoChute = CHANCE_PADRAO,
): { alcancou: boolean; ladoEscolhido: number; alcance: number } {
  const q = limitar(goleiro.qualidade, 1, 99) / 100

  // ── O compromisso ────────────────────────────────────────────────────────
  // Ele lê o primeiro terço do voo e se joga naquela direção.
  const inicio = trajetoria.caminho[8] ?? trajetoria.caminho[1]
  const direcaoLida = limitar(inicio.x / Math.max(0.01, inicio.z), -1, 1)
  const ladoEscolhido = direcaoLida

  // ── A corrida ────────────────────────────────────────────────────────────
  // O tempo que ele tem vem da trajetória — bola forte chega antes, chute de
  // fora demora mais. Recalcular aqui seria repetir a regra em dois lugares.
  const tempoDeVoo = trajetoria.tempoDeVoo

  // ⚠️ 0,92 É O NÚMERO CALIBRADO, não escolhido. Com ele um goleiro mediano
  // (68) num chute de força média cobre ~0,58 da meia-largura do gol: pega o
  // que vai perto do meio, não alcança canto de verdade. Foi medido em
  // `scripts/calibrar-fisica-do-chute.ts` contra as faixas do futebol real
  // (grande chance converte 35 a 45%).
  const VELOCIDADE_DO_GOLEIRO = 0.92
  const alcanceParado = VELOCIDADE_DO_GOLEIRO * (0.45 + q * 0.55) * tempoDeVoo

  // ⚠️ O GOLEIRO SAI DO GOL — e sem isto o modelo dizia o OPOSTO do futebol.
  //
  // Medido na primeira versão: o cara a cara convertia 89%, contra 35 a 45% no
  // futebol real. A causa era mecânica e óbvia depois de vista: com o goleiro
  // colado na linha, chute de PERTO tem tempo de voo curto, ele cobre menos, e
  // quanto mais perto mais fácil. É o inverso do que todo mundo que já jogou
  // sabe: o goleiro AVANÇA e fecha o ângulo, e é por isso que o atacante no
  // cara a cara vê um gol pequeno em vez de um gol grande.
  //
  // O avanço cresce ao quadrado da proximidade porque o efeito é angular: sair
  // dois metros de dez muda pouco, sair dois de quatro muda tudo. Goleiro bom
  // sai melhor — é uma das coisas que separa goleiro de goleiro.
  // 0,30 e nao 0,42: com 0,42 o cara a cara caiu para 19% (alvo 35 a 45) e a
  // finalizacao na area para 10% (alvo 15 a 25). Medido, nao estimado.
  const avanco = contexto.goleiroNaLinha
    ? 0
    : Math.pow(1 - limitar(contexto.distancia, 0, 1), 2) * 0.30 * q
  const alcance = alcanceParado + avanco

  // ── A distância que ele precisa cobrir ───────────────────────────────────
  // Do CENTRO, e em duas dimensões: bola alta obriga a subir. A escala vertical
  // é 0,75 porque o gol é mais largo que alto — subir custa menos que correr.
  // ⚠️ A ALTURA DO GOLEIRO ENCURTA A SUBIDA, NÃO A CORRIDA (1.0.374). Ela
  // divide só o componente VERTICAL da distância: o goleirão de 196 alcança a
  // bola no ângulo que o de 178 não alcança, e continua chegando igual (mal)
  // no canto rasteiro. Somar altura no alcance total daria um goleiro melhor
  // em tudo, que é o oposto do trade-off real.
  const alturaDoGoleiro = limitar(goleiro.altura ?? 186, 165, 205)
  const escalaVertical = 0.75 * (1 - (alturaDoGoleiro - 186) / 100)

  const alturaDeRepouso = 0.3
  const dx = trajetoria.chegada.x
  const dy = (trajetoria.chegada.y - alturaDeRepouso) * escalaVertical
  const distancia = Math.sqrt(dx * dx + dy * dy)

  // Errar o lado custa metade do alcance. Não custa TUDO porque o goleiro que
  // se joga errado ainda estica a perna — e porque zerar faria a curva vencer
  // sozinha, sem o jogador precisar acertar o canto.
  const errouOLado = Math.sign(dx) !== 0 && Math.sign(direcaoLida) !== 0
    && Math.sign(dx) !== Math.sign(direcaoLida)
  const alcanceEfetivo = errouOLado ? alcance * 0.5 : alcance

  return { alcancou: distancia <= alcanceEfetivo, ladoEscolhido, alcance: alcanceEfetivo }
}

const POSTE = 1
const TRAVESSAO = 1
const MARGEM_DA_TRAVE = 0.05

/**
 * O DESFECHO — puro, sem um único sorteio.
 *
 * A ordem das checagens é a ordem física: primeiro a bola sai ou não do alvo,
 * depois bate na trave, depois o goleiro alcança. Inverter isso faria o goleiro
 * "defender" uma bola que ia para a arquibancada.
 */
export function resolverChute(
  chute: ChuteDoJogador,
  atributos: AtributosDoChute,
  goleiro: Goleiro,
  semente: string,
  contexto: ContextoDoChute = CHANCE_PADRAO,
): DesfechoDoChute {
  const trajetoria = calcularTrajetoria(chute, atributos, semente, contexto)
  const { chegada } = trajetoria

  if (Math.abs(chegada.x) > POSTE + MARGEM_DA_TRAVE || chegada.y > TRAVESSAO + MARGEM_DA_TRAVE || chegada.y < 0) {
    return {
      tipo: "fora", onde: chegada, trajetoria,
      texto: chegada.y < 0 ? "No chão antes da linha."
        : chegada.y > TRAVESSAO ? "Por cima do travessão."
          : "Pela linha de fundo.",
    }
  }

  const naTrave = Math.abs(Math.abs(chegada.x) - POSTE) <= MARGEM_DA_TRAVE
    || Math.abs(chegada.y - TRAVESSAO) <= MARGEM_DA_TRAVE
  if (naTrave) {
    return { tipo: "trave", onde: chegada, trajetoria, texto: "NA TRAVE! O estádio inteiro em pé." }
  }

  const gk = defesaDoGoleiro(trajetoria, goleiro, contexto)
  if (gk.alcancou) {
    return {
      tipo: "defesa", onde: chegada, trajetoria, ladoDoGoleiro: gk.ladoEscolhido,
      texto: Math.abs(chegada.x) > 0.7 ? "Defendeu no canto — que goleiro." : "O goleiro pegou.",
    }
  }

  return {
    tipo: "gol", onde: chegada, trajetoria,
    texto: Math.abs(chegada.x) > 0.78 ? "GOL! No ângulo!"
      : trajetoria.velocidade > 0.75 ? "GOL! Uma bomba."
        : "GOL!",
  }
}

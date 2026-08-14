// Tipos do Pitch Engine PRO.
//
// O motor em si (`motor.js`) e JavaScript de propósito: são 3.163 linhas
// convertidas de um HTML solto, e anotá-las uma a uma seria reescrever o motor —
// com risco real de mudar a física sem querer. Os tipos moram aqui, cobrindo a
// **API pública**, que é o que o resto do projeto de fato consome.
//
// Consequência assumida: o miolo do motor não tem checagem de tipo. Em troca, a
// fronteira tem, e é a fronteira que quebra build de quem chama.

export interface OpcoesMotor {
  /** Elemento que recebe o canvas. O motor não procura mais por `#stage`. */
  palco: HTMLElement

  /** Identidade visual enviada pela partida; evita uniformes genéricos. */
  casa?: IdentidadeVisualTime
  fora?: IdentidadeVisualTime

  /**
   * Qualidade inicial. Omitido, o motor escolhe: `mid` em telas de toque
   * (`pointer:coarse`), `high` no resto.
   *
   * O que muda: `high` = 64k tufos de grama e sombra 4096; `mid` = 22k e 1024;
   * `low` = sem grama instanciada e sem pós-processamento.
   */
  qualidade?: QualidadeMotor

  /**
   * Progresso da montagem, 0-100, com o rótulo da etapa atual.
   *
   * A cena é montada em 8 passos com um quadro de respiro entre eles — sem isso
   * a aba travaria por segundos e a barra pularia direto de 0 a 100.
   */
  aoProgredir?: (pct: number, etapa: string) => void

  /** Cena pronta, primeiro quadro desenhado, simulação rodando. */
  aoIniciar?: () => void

  /**
   * Falha na montagem (WebGL indisponível, shader que não compila).
   * Quem chama deve mostrar isto — sem tratar, o jogador vê um retângulo preto
   * e nenhuma explicação.
   */
  aoFalhar?: (erro: Error) => void
}

export interface IdentidadeVisualTime {
  nome?: string
  sigla?: string
  corPrincipal?: string
  corSecundaria?: string
}

export type QualidadeMotor = "high" | "mid" | "low"

/**
 * Retrato do estado interno da simulação 3D.
 *
 * Existe para o HUD (React) e para o painel de comparação. No HTML original o
 * motor escrevia os números direto no DOM por id; aqui quem desenha é o React,
 * que não tem como ler `textContent` de elementos que nunca criou.
 */
export interface Telemetria {
  relogio: {
    /** Segundos de jogo simulados neste tempo. */
    segundos: number
    /** 1 ou 2. */
    tempo: number
    /**
     * Acréscimo acumulado, **em segundos** — não em minutos. É tempo de bola
     * parada somado de verdade, então vem quebrado (`73.4`). Quem mostra na
     * tela arredonda para cima: `Math.ceil(acrescimo / 60)`.
     */
    acrescimo: number
    fase: string
    pausado: boolean
  }
  placar: { casa: number; fora: number }
  posse: {
    /** Percentual 0-100, derivado do TEMPO com a bola. */
    casa: number
    fora: number
    atual: "home" | "away"
  }
  casa: TelemetriaTime
  fora: TelemetriaTime
  /**
   * Física da bola. **Só o motor 3D tem estes números** — o `match-engine` do
   * jogo não simula física, trabalha com a bola em coordenadas abstratas.
   */
  bola: {
    velocidadeKmh: number
    /** Rotação, para efeito Magnus. */
    rotacaoRpm: number
    alturaM: number
    alturaMaximaM: number
    percursoM: number
    /** Subpassos de física no último quadro. Sobe quando a bola está rápida. */
    subpassos: number
    x: number
    z: number
    dono: "home" | "away" | null
    ultimoToque: "home" | "away" | null
  }
  /** Multiplicador de velocidade da simulação (1 = tempo real). */
  velocidadeSim: number
  /** Passos de física acumulados. Só cresce — bom para detectar loop parado. */
  passos: number
}

/**
 * Evento vindo do `match-engine` para o 3D encenar.
 *
 * `tipo` aceita os valores de `EventType` (lib/match-engine). Fica como `string`
 * de propósito: o motor é JavaScript e não importa tipos do jogo — acoplar os
 * dois obrigaria o motor a conhecer o `match-engine`, e a ideia é o contrário,
 * que ele saiba o mínimo.
 *
 * Os tipos que o motor sabe encenar hoje estão em {@link TipoEncenavel}. Mandar
 * qualquer outro não é erro: `encenar` devolve `false` e a cena segue.
 */
export interface EventoParaEncenar {
  tipo: TipoEncenavel | (string & {})
  /**
   * De quem é o lance. Para "o adversário atacou", é o mesmo evento com o
   * outro lado — não existe evento espelhado.
   */
  lado: "home" | "away"
  /** Minuto do jogo, só informativo. O 3D não usa para decidir nada. */
  minuto?: number
}

/**
 * O que o motor sabe pôr em cena.
 *
 * **Nenhum destes altera o placar por conta própria.** Só `goal` marca, e ele
 * marca porque o `match-engine` mandou. As finalizações encenadas miram no
 * alcance do goleiro, no pau ou para fora — nunca num canto livre —, senão o 3D
 * inventaria um gol que o jogo não teve.
 */
export type TipoEncenavel =
  /** Bolas paradas: reposicionam o campo inteiro e a cobrança sai sozinha. */
  | "kickoff" | "corner" | "goal_kick" | "throw_in" | "foul" | "free_kick" | "penalty"
  /** Lances com bola rolando. */
  | "pass" | "shot" | "shot_on_target" | "miss" | "post" | "save"
  /** Estados do jogo: recolocam os 22 e mudam o critério da IA. */
  | "counter_attack" | "attack" | "pressure"
  /** Cartões e marcos do relógio. */
  | "goal" | "yellow_card" | "red_card" | "halftime" | "fulltime"

/**
 * Slot de formação no formato do 2D (`lib/formations.ts`).
 *
 * Declarado aqui em vez de importado de propósito: o motor é JavaScript e não
 * conhece o resto do jogo — acoplá-lo ao `formations.ts` inverteria a direção
 * da dependência.
 */
export interface SlotDeFormacao {
  pos: string
  /** Largura, 0-100. */
  x: number
  /** Profundidade: menor = mais perto do gol adversário. */
  y: number
}

export interface TelemetriaTime {
  finalizacoes: number
  noGol: number
  passesCertos: number
  passesTentados: number
  bloqueios: number
  faltas: number
  amarelos: number
  vermelhos: number
}

export interface Motor {
  /**
   * Monta a cena e começa a simular. Resolve quando o primeiro quadro foi
   * desenhado. Chamar depois de `destruir()` não faz nada.
   */
  iniciar(): Promise<void>

  /**
   * Retrato do estado atual, ou `null` se já foi destruído.
   *
   * Barato: só lê campos, não aloca cena. Pode ser chamado a cada quadro do
   * HUD sem custo perceptível.
   */
  lerTelemetria(): Telemetria | null

  /**
   * Velocidade da simulação. **A física não muda** — muda quanto tempo simulado
   * cabe em cada segundo real.
   *
   * O motor tem 6 marchas internas (0.15 · 0.5 · 1 · 2 · 4 · 8) e escolhe a mais
   * próxima do valor pedido. O jogo expõe 1x/3x/5x ao jogador (`MatchSpeed`), e
   * é por aqui que os dois ritmos ficam alinhados: sem isso a partida 3D descola
   * do `match-engine` e o jogador vê um lance que o placar já passou.
   */
  definirVelocidade(multiplicador: number): void

  /**
   * Duração de CADA tempo, em minutos de jogo (padrão 45).
   *
   * Em teste, tempos curtos deixam ver 90 minutos depressa. Em jogo, precisa
   * bater com o `durationMinutes` do `MatchConfig` — senão um lado termina o
   * primeiro tempo enquanto o outro ainda está no meio.
   */
  definirDuracaoDoTempo(minutos: number): void

  /** Pausa ou retoma a simulação. */
  definirPausa(pausado: boolean): void

  /**
   * Usa a formação do 2D (`lib/formations.ts`) no lugar da embutida no motor.
   *
   * O motor 3D tinha um 4-3-3 próprio, sem relação com o que a tela de
   * escalação desenha — o time montado no campinho não era o que entrava em
   * campo. Passando os slots do 2D, os dois passam a concordar.
   *
   * A conversão troca os eixos e normaliza pela faixa realmente ocupada:
   * no 2D `x` é largura e `y` profundidade (12 = ataque, 92 = próprio gol);
   * no 3D `x` é comprimento e `z` largura.
   *
   * Pode ser chamada antes ou durante a partida. Durante o jogo, os novos
   * pontos de referência são adotados no deslocamento seguinte, sem teleporte.
   *
   * @returns `true` se a formação foi aceita; `false` se os slots eram
   *   inválidos (não são 11, ou sem variação de profundidade), caso em que o
   *   motor mantém a formação embutida.
   */
  definirFormacao(slots: SlotDeFormacao[]): boolean

  /**
   * Encena um evento que o `match-engine` decidiu.
   *
   * **Esta é a ponte entre os dois motores.** O 3D não decide nada aqui — quem
   * manda no resultado é o motor de partida do jogo; `encenar` só põe a cena no
   * estado certo para o lance acontecer.
   *
   * Existe porque os dois ritmos são incompatíveis por construção. Medido numa
   * RTX 3060 a 60 fps: o 3D produz no máximo **7,6 segundos de jogo por segundo
   * real**; o 2D, no ritmo mais lento, produz **120**. Nenhum multiplicador
   * fecha essa conta — o 2D avança 1 minuto por tick, o 3D avança 1/60 de
   * segundo por passo (90 passos contra 324.000 numa partida).
   *
   * Encenando eventos, a velocidade dos dois deixa de precisar bater.
   *
   * @returns `true` se o motor mudou a cena; `false` para eventos sem
   *   encenação própria (`offside`, `sub`, `var`, `injury`), em que ou o lance
   *   já está acontecendo em campo, ou o que mudou é administrativo e não tem
   *   imagem. O `false` é informativo, não é erro.
   */
  encenar(evento: EventoParaEncenar): boolean

  /**
   * Para o loop, remove os listeners e libera a GPU. Idempotente.
   *
   * **Obrigatório** ao desmontar: sem isto o `requestAnimationFrame` continua
   * rodando com a placa ligada, o áudio segue tocando, e entrar na partida de
   * novo cria um segundo motor por cima do primeiro.
   */
  destruir(): void

  /** True depois de `destruir()`. */
  readonly destruido: boolean
}

/**
 * Cria uma instância do motor 3D.
 *
 * Uma instância por tela. O estado vive no fecho da função, então duas
 * instâncias não disputam variáveis — mas cada uma segura um contexto WebGL, e
 * navegador tem limite (~8-16). Sempre `destruir()` antes de criar outra.
 */
export function criarMotor(opcoes: OpcoesMotor): Motor

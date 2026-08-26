/**
 * DILEMAS FORA DE CAMPO — a escolha que custa alguma coisa (1.0.377).
 *
 * ─── O QUE FALTAVA ──────────────────────────────────────────────────────────
 *
 * O modo já tinha CONVERSAS (`lib/conversas-do-atleta`) e ENTREVISTAS
 * (`entrevistaDaVez`, em `carreira-de-jogador`). As duas são boas e nenhuma é
 * isto. A conversa é um momento de relação com UMA pessoa; a entrevista é a sua
 * fala pública depois de uma partida. O que não existia era a decisão que
 * coloca duas pessoas de lados opostos e obriga o jogador a perder alguma coisa
 * nos dois caminhos.
 *
 * ⚠️ SEM PERDA NOS DOIS LADOS NÃO É DILEMA — É MENU. Foi o critério de aceitação
 * de cada entrada deste arquivo: se uma das escolhas é estritamente melhor que
 * as outras, ela não entra. Por isso quase toda escolha aqui mexe em DUAS
 * relações com sinais contrários, e as que dão dinheiro cobram em relação.
 *
 * ─── O RISCO, E POR QUE ELE EXISTE ──────────────────────────────────────────
 *
 * Metade das escolhas tem `risco`: uma chance de o caminho escolhido dar errado
 * em público. Sem ele, "aceitar o dinheiro escondido" seria só um pequeno preço
 * fixo em relação — o jogador aprenderia a tabela em duas temporadas e pararia
 * de pensar. Com risco, a mesma escolha é uma aposta cujo resultado ele lê no
 * jornal na rodada seguinte.
 *
 * ⚠️ O SORTEIO É SEMEADO PELO ID DO DILEMA + RODADA, nunca `Math.random()`.
 * Recarregar o save para tentar de novo daria outro resultado e transformaria
 * cada dilema numa consulta ao oráculo — é o mesmo motivo pelo qual os
 * companheiros de `relacoes-do-atleta` são semeados pelo clube.
 *
 * ─── COMO ELE CHEGA AO JOGADOR ──────────────────────────────────────────────
 *
 * `dilemaDaRodada(contexto)` devolve no máximo UM por rodada, e só quando as
 * condições daquele dilema batem com o momento da carreira. Um jogador em fim
 * de contrato recebe dilemas de contrato; um que acabou de ser expulso recebe
 * dilemas de conduta. Sorteio puro devolveria "a marca quer você num evento"
 * para quem não tem patrocínio nenhum.
 */

import type { Pessoa } from "@/lib/relacoes-do-atleta"

/** O que uma escolha move. Tudo opcional: quase nenhuma mexe em tudo. */
export interface EfeitoDoDilema {
  /** Delta por pessoa, na escala 0–100 das relações. */
  relacoes?: Partial<Record<Pessoa, number>>
  dinheiro?: number
  reputacao?: number
  /** Moral do atleta (0–100). */
  moral?: number
  /** Forma física (0–100) — festa cobra aqui. */
  forma?: number
  energia?: number
  /** Apoio da torcida (0–100), o campo `estado.torcida`. */
  torcida?: number
}

export interface EscolhaDoDilema {
  id: string
  texto: string
  /** O que o jogador VÊ antes de escolher. Nunca o efeito completo. */
  previa: string
  efeito: EfeitoDoDilema
  /**
   * 0 a 1 — chance de a escolha vazar ou dar errado.
   *
   * ⚠️ A PRÉVIA NÃO ESCONDE O RISCO, só o resultado. O jogador lê que pode
   * vazar; ele não lê se vazou. Esconder a existência do risco seria
   * enganação, e não é isso que torna a decisão difícil.
   */
  risco?: number
  /** O que acontece quando o risco se realiza. */
  seDerErrado?: EfeitoDoDilema
  textoSeDerErrado?: string
}

export type CategoriaDoDilema =
  | "imprensa" | "patrocinio" | "familia" | "vestiario" | "torcida" | "dinheiro" | "conduta"

export interface Dilema {
  id: string
  categoria: CategoriaDoDilema
  titulo: string
  /** O parágrafo que situa a decisão. É o que faz o dilema não ser um formulário. */
  contexto: string
  escolhas: EscolhaDoDilema[]
}

/** O retrato da carreira que decide QUAIS dilemas fazem sentido agora. */
export interface ContextoDoDilema {
  rodada: number
  temporada: number
  idade: number
  reputacao: number
  torcida: number
  dinheiro: number
  moral: number
  relacoes: Record<Pessoa, number>
  /** Papel no elenco, como `papelNoElenco` devolve. */
  papel: string
  temPatrocinio: boolean
  temParceira: boolean
  /** Temporadas restantes de contrato. */
  temporadasDeContrato: number
  /** Cartões vermelhos na temporada — abre a trilha de conduta. */
  vermelhos: number
  /** Média da temporada até aqui. */
  media: number
  jaResolvidos: string[]
}

/**
 * Semente determinística — o mesmo dilema na mesma rodada dá o mesmo desfecho.
 *
 * ⚠️ O FNV SOZINHO NÃO SERVE AQUI, e isto foi PEGO PELO GATE, não previsto.
 * `qa-nss-377` cobra "uma temporada alcança pelo menos 10 dilemas diferentes" e
 * a resposta foi ZERO. O motivo: FNV-1a sobre chaves curtas e quase iguais
 * (`janela:2026:1`, `janela:2026:2`, …) devolve valores COLADOS — medido, as 60
 * rodadas de uma temporada caíam todas entre 0,31 e 0,49. Com a janela em 0,28,
 * nenhuma rodada do jogo inteiro abriria um dilema. O sistema teria sido
 * publicado inteiro, com tela, texto e efeito, e simplesmente nunca apareceria.
 *
 * O conserto é o finalizador de avalanche do MurmurHash3: três xor-shifts com
 * multiplicações ímpares grandes, que espalham os bits altos pelos baixos. É o
 * mesmo hash de antes com uma etapa de mistura no fim.
 *
 * ⚠️ E POR QUE NÃO CONSERTAR O `hash()` DE `carreira-de-jogador` JUNTO: porque
 * ele decide nota, lesão e evolução de TODA carreira já em andamento. Trocar a
 * distribuição dele reescreveria o futuro de cada save publicado — um conserto
 * correto com um custo que ninguém pediu. Aqui é código novo, sem save atrás.
 */
function semente(texto: string): number {
  let h = 2166136261
  for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 16777619) }
  h ^= h >>> 16
  h = Math.imul(h, 2246822507)
  h ^= h >>> 13
  h = Math.imul(h, 3266489909)
  h ^= h >>> 16
  return (h >>> 0) / 4294967295
}

// ═══════════════════════════════════════════════════════════════════════════
// O CATÁLOGO
// ═══════════════════════════════════════════════════════════════════════════
//
// Cada entrada é uma função de contexto para `Dilema | null`. Devolver `null`
// é dizer "não faz sentido agora" — é assim que a trilha de conduta só aparece
// para quem foi expulso e a de patrocínio só para quem tem marca.

type Gerador = (c: ContextoDoDilema) => Dilema | null

const CATALOGO: Gerador[] = [

  // ── IMPRENSA ────────────────────────────────────────────────────────────
  c => c.reputacao < 35 ? null : ({
    id: "documentario",
    categoria: "imprensa",
    titulo: "Um documentário sobre você",
    contexto:
      "Uma produtora quer seguir a sua rotina por três meses: treino, casa, viagem. " +
      "Paga bem e coloca o seu nome onde o mercado olha — mas uma câmera dentro do " +
      "vestiário é exatamente o que um grupo unido não quer.",
    escolhas: [
      {
        id: "aceitar",
        texto: "Aceitar e abrir a rotina inteira",
        previa: "Dinheiro e imprensa · o vestiário não vai gostar",
        efeito: { dinheiro: 240_000, reputacao: 7, relacoes: { imprensa: 12, marcas: 8, elenco: -9 } },
        risco: 0.3,
        seDerErrado: { relacoes: { elenco: -10, treinador: -6 }, moral: -5 },
        textoSeDerErrado: "Um take de bastidor com você reclamando da escalação foi ao ar.",
      },
      {
        // ⚠️ ESTA ESCOLHA ERA ALMOÇO GRÁTIS E O GATE PEGOU (1.0.377). Ela dava
        // dinheiro, reputação e duas relações sem cobrar nada — a resposta
        // ótima em qualquer situação, o que apaga as outras duas. Gravar fora
        // do clube continua sendo gravar: come a folga da semana, e o
        // vestiário registra que houve câmera atrás de você.
        id: "parcial",
        texto: "Aceitar, mas só fora do clube",
        previa: "Metade do dinheiro · come a sua folga",
        efeito: { dinheiro: 90_000, reputacao: 3, relacoes: { imprensa: 4, marcas: 3, elenco: -3 }, energia: -12 },
      },
      {
        id: "recusar",
        texto: "Recusar — este ano é de futebol",
        previa: "A imprensa esfria · o vestiário aprova",
        efeito: { relacoes: { imprensa: -8, elenco: 6, treinador: 4 }, moral: 3 },
      },
    ],
  }),

  c => c.media >= 6.8 || c.reputacao < 45 ? null : ({
    id: "coluna_hostil",
    categoria: "imprensa",
    titulo: "A coluna que escolheu você",
    contexto:
      "Um colunista transformou a sua fase ruim em pauta semanal. Hoje ele publicou " +
      "que você vive de contrato. O empresário sugere responder; o treinador pediu " +
      "silêncio até a próxima partida.",
    escolhas: [
      {
        id: "responder",
        texto: "Responder publicamente, com nome e sobrenome",
        previa: "Torcida do seu lado · o treinador não pediu isso",
        efeito: { reputacao: 5, torcida: 7, relacoes: { imprensa: -14, treinador: -7, empresario: 3 }, moral: 6 },
        risco: 0.35,
        seDerErrado: { reputacao: -8, torcida: -10, relacoes: { imprensa: -8 } },
        textoSeDerErrado: "A resposta virou manchete maior que a crítica. Saiu pior.",
      },
      {
        id: "silencio",
        texto: "Calar e responder em campo",
        previa: "O treinador agradece · a cobrança continua",
        efeito: { relacoes: { treinador: 8, imprensa: 2 }, moral: -4 },
      },
      {
        id: "bastidor",
        texto: "Pedir ao empresário que trate por baixo dos panos",
        previa: "Some da coluna · custa caro e pode vazar",
        efeito: { dinheiro: -60_000, relacoes: { imprensa: 9, empresario: -4 } },
        risco: 0.25,
        seDerErrado: { reputacao: -12, relacoes: { imprensa: -18, marcas: -10 } },
        textoSeDerErrado: "O acerto vazou. Jogador tentando comprar silêncio foi a chamada.",
      },
    ],
  }),

  // ── PATROCÍNIO ──────────────────────────────────────────────────────────
  c => !c.temPatrocinio ? null : ({
    id: "campanha_no_jogo",
    categoria: "patrocinio",
    titulo: "A gravação cai na véspera",
    contexto:
      "A marca marcou a gravação da campanha para a sexta — véspera de jogo fora de " +
      "casa. O contrato prevê disponibilidade. O departamento físico foi claro sobre " +
      "o que uma viagem extra faz com as suas pernas.",
    escolhas: [
      {
        id: "gravar",
        texto: "Gravar e viajar direto para o jogo",
        previa: "A marca fica feliz · você chega gasto",
        efeito: { dinheiro: 70_000, relacoes: { marcas: 12 }, forma: -8, energia: -22 },
      },
      {
        id: "adiar",
        texto: "Pedir para adiar para depois da rodada",
        previa: "Nada muda no futebol · a marca registra",
        efeito: { relacoes: { marcas: -7, treinador: 5 } },
      },
      {
        id: "quebrar",
        texto: "Faltar sem avisar",
        previa: "Descanso completo · multa provável",
        efeito: { forma: 3, energia: 8, relacoes: { marcas: -20, empresario: -8 } },
        risco: 0.5,
        seDerErrado: { dinheiro: -180_000, relacoes: { marcas: -12 } },
        textoSeDerErrado: "A cláusula de disponibilidade foi acionada. Multa cobrada.",
      },
    ],
  }),

  c => c.reputacao < 55 ? null : ({
    id: "marca_polemica",
    categoria: "patrocinio",
    titulo: "Dinheiro de uma marca que divide",
    contexto:
      "Uma casa de apostas quer o seu rosto por uma temporada, e o valor é maior que " +
      "tudo que você já assinou. Parte da torcida do clube fez campanha contra a " +
      "categoria no ano passado.",
    escolhas: [
      {
        id: "assinar",
        texto: "Assinar — é o maior contrato da sua vida",
        previa: "Muito dinheiro · a arquibancada cobra",
        efeito: { dinheiro: 900_000, relacoes: { marcas: 16, empresario: 8 }, torcida: -12 },
        risco: 0.3,
        seDerErrado: { torcida: -12, reputacao: -6, relacoes: { imprensa: -8 } },
        textoSeDerErrado: "Faixa contra você na arquibancada. A imagem correu o país.",
      },
      {
        id: "negociar",
        texto: "Assinar sem exposição no estádio",
        previa: "Menos dinheiro, menos atrito",
        efeito: { dinheiro: 420_000, relacoes: { marcas: 8 }, torcida: -3 },
      },
      {
        id: "recusar",
        texto: "Recusar por princípio",
        previa: "A torcida vê · o empresário não entende",
        efeito: { torcida: 9, reputacao: 3, relacoes: { empresario: -9, marcas: -6 } },
      },
    ],
  }),

  // ── FAMÍLIA ─────────────────────────────────────────────────────────────
  () => ({
    id: "casamento_da_irma",
    categoria: "familia",
    titulo: "O casamento é no dia do jogo",
    contexto:
      "A sua irmã casa no sábado. O jogo é no sábado. Ela avisou com um ano de " +
      "antecedência, quando você jogava na segunda divisão e sábado era dia livre.",
    escolhas: [
      {
        id: "ir",
        texto: "Pedir dispensa e ir",
        previa: "Casa em paz · o treinador perde você",
        efeito: { relacoes: { familia: 18, treinador: -12, elenco: -5 }, moral: 8 },
      },
      {
        id: "jogar",
        texto: "Jogar e chegar na festa de madrugada",
        previa: "Ninguém fica inteiro · ninguém fica sem",
        efeito: { relacoes: { familia: -4, treinador: 3 }, energia: -18, moral: -2 },
      },
      {
        id: "presente",
        texto: "Mandar um presente caro e uma mensagem em vídeo",
        previa: "Resolve por fora · a sua mãe percebe",
        efeito: { dinheiro: -80_000, relacoes: { familia: -10, treinador: 3 }, moral: -6 },
      },
    ],
  }),

  c => c.dinheiro < 150_000 ? null : ({
    id: "primo_do_negocio",
    categoria: "familia",
    titulo: "O parente com o negócio da vida",
    contexto:
      "Um primo apareceu com um plano de negócio, uma planilha bonita e a frase de " +
      "que é só você entrar que o resto ele faz. O seu empresário pediu para ver os " +
      "números antes. O seu primo não gostou disso.",
    escolhas: [
      {
        id: "investir",
        texto: "Entrar com o dinheiro na hora",
        previa: "A família comemora · pode ser tudo perdido",
        efeito: { dinheiro: -300_000, relacoes: { familia: 14, empresario: -8 } },
        risco: 0.55,
        seDerErrado: { dinheiro: -120_000, relacoes: { familia: -16 }, moral: -8 },
        textoSeDerErrado: "O negócio afundou em quatro meses e levou mais um pedaço junto.",
      },
      {
        id: "auditar",
        texto: "Deixar o empresário auditar antes",
        previa: "Decisão adiada · o primo se ofende",
        efeito: { relacoes: { empresario: 7, familia: -6 } },
      },
      {
        id: "recusar",
        texto: "Dizer não, e explicar por quê",
        previa: "Dinheiro guardado · silêncio no almoço de domingo",
        efeito: { relacoes: { familia: -11, empresario: 5 }, moral: -3 },
      },
    ],
  }),

  // ── VESTIÁRIO ───────────────────────────────────────────────────────────
  () => ({
    id: "multa_do_grupo",
    categoria: "vestiario",
    titulo: "A multa que o grupo quer esconder",
    contexto:
      "Dois companheiros furaram o toque de recolher na concentração. O capitão " +
      "propôs resolver internamente, com multa entre eles, sem levar ao treinador. " +
      "Alguém do clube já desconfia e perguntou a você.",
    escolhas: [
      {
        id: "cobrir",
        texto: "Cobrir o grupo",
        previa: "O vestiário é seu · se o treinador souber, é seu também",
        efeito: { relacoes: { elenco: 14 }, moral: 3 },
        risco: 0.35,
        seDerErrado: { relacoes: { treinador: -14 }, moral: -6 },
        textoSeDerErrado: "O treinador soube — e soube que você sabia.",
      },
      {
        id: "contar",
        texto: "Contar ao treinador",
        previa: "Crédito com quem escala · o grupo marca",
        efeito: { relacoes: { treinador: 12, elenco: -16 } },
      },
      {
        id: "fora",
        texto: "Dizer que não viu nada e sair da conversa",
        previa: "Ninguém ganha nada com você",
        efeito: { relacoes: { elenco: -4, treinador: -2 } },
      },
    ],
  }),

  c => c.papel.includes("titular") ? null : ({
    id: "vaga_do_amigo",
    categoria: "vestiario",
    titulo: "A vaga é do seu amigo",
    contexto:
      "O treinador chamou você para dizer que estuda escalá-lo no lugar de quem o " +
      "recebeu no clube. Ele quer saber se você acha que está pronto — e o que " +
      "você responder vai chegar ao vestiário de um jeito ou de outro.",
    escolhas: [
      {
        id: "quero",
        texto: "Dizer que está pronto, e que quer a vaga",
        previa: "O treinador respeita · o amigo entende como traição",
        efeito: { relacoes: { treinador: 11, elenco: -8 }, moral: 7 },
      },
      {
        id: "elogiar",
        texto: "Defender o companheiro e pedir mais tempo",
        previa: "O grupo vê · o treinador anota que você recuou",
        efeito: { relacoes: { elenco: 12, treinador: -9 }, moral: -3 },
      },
      {
        // Mesma correção: recuar não é neutro. O treinador anota +2 pela
        // deferência, o grupo lê como quem não se posiciona, e você sai da
        // conversa sem ter defendido a si nem o amigo.
        id: "neutro",
        texto: "Dizer que a decisão é dele",
        previa: "Ninguém se compromete · ninguém te vê",
        efeito: { relacoes: { treinador: 2, elenco: -2 }, moral: -2 },
      },
    ],
  }),

  // ── TORCIDA ─────────────────────────────────────────────────────────────
  () => ({
    id: "organizada_no_ct",
    categoria: "torcida",
    titulo: "A organizada apareceu no CT",
    contexto:
      "Depois da quarta partida sem vitória, um grupo de torcedores esperou o elenco " +
      "no portão. Não houve agressão, mas houve cobrança de perto. O clube pediu que " +
      "ninguém falasse. Você foi o único que eles chamaram pelo nome.",
    escolhas: [
      {
        id: "descer",
        texto: "Descer do carro e conversar",
        previa: "A torcida não esquece · o clube pediu o contrário",
        efeito: { torcida: 16, relacoes: { elenco: 5, imprensa: 6 }, moral: 4 },
        risco: 0.25,
        seDerErrado: { torcida: -8, reputacao: -5, relacoes: { treinador: -8 } },
        textoSeDerErrado: "A conversa virou empurra-empurra no vídeo que circulou.",
      },
      {
        id: "seguir",
        texto: "Seguir em frente, como o clube pediu",
        previa: "Nada acontece hoje · a arquibancada lembra",
        efeito: { torcida: -9, relacoes: { treinador: 4 } },
      },
      {
        id: "post",
        texto: "Publicar um texto de desculpas à noite",
        previa: "Metade acha sincero, metade acha ensaiado",
        efeito: { torcida: 5, reputacao: 2, relacoes: { imprensa: 3, elenco: -3 } },
      },
    ],
  }),

  c => c.torcida < 62 ? null : ({
    id: "camisa_do_rival",
    categoria: "torcida",
    titulo: "A foto com a camisa errada",
    contexto:
      "Numa festa de família alguém fotografou você segurando a camisa do maior " +
      "rival — presente de um sobrinho, brincadeira de dez segundos. A foto está " +
      "circulando e ainda não chegou aos grandes perfis.",
    escolhas: [
      {
        id: "assumir",
        texto: "Assumir e explicar em vídeo, hoje",
        previa: "Corta o assunto pela metade · vira notícia oficial",
        efeito: { torcida: -6, reputacao: 2, relacoes: { imprensa: 7 } },
      },
      {
        id: "ignorar",
        texto: "Ignorar e esperar passar",
        previa: "Pode morrer sozinho · pode crescer",
        efeito: {},
        risco: 0.45,
        seDerErrado: { torcida: -18, relacoes: { imprensa: -6 }, moral: -5 },
        textoSeDerErrado: "A foto chegou aos perfis grandes sem a sua versão junto.",
      },
      {
        id: "comprar",
        texto: "Pedir ao empresário para tirar a foto do ar",
        previa: "Some rápido · deixa rastro",
        efeito: { dinheiro: -45_000, relacoes: { empresario: -5 } },
        risco: 0.3,
        seDerErrado: { torcida: -14, reputacao: -7, relacoes: { imprensa: -12 } },
        textoSeDerErrado: "Jogador manda apagar foto rendeu mais assunto que a foto.",
      },
    ],
  }),

  // ── DINHEIRO ────────────────────────────────────────────────────────────
  c => c.dinheiro < 400_000 ? null : ({
    id: "amistoso_no_exterior",
    categoria: "dinheiro",
    titulo: "O amistoso de meio de semana no exterior",
    contexto:
      "Um empresário oferece um cachê alto para você jogar 45 minutos de um festivo " +
      "a 9 mil quilômetros, na quarta, voltando na quinta. O clube não proíbe " +
      "expressamente. O departamento médico proíbe com todas as letras.",
    escolhas: [
      {
        id: "ir",
        texto: "Ir — é meio salário em um dia",
        previa: "Muito dinheiro · o corpo paga",
        efeito: { dinheiro: 350_000, energia: -35, forma: -12, relacoes: { treinador: -8, marcas: 6 } },
        risco: 0.3,
        seDerErrado: { forma: -12, energia: -15, relacoes: { treinador: -10 } },
        textoSeDerErrado: "Voltou com desconforto muscular e virou dúvida para o fim de semana.",
      },
      {
        id: "recusar",
        texto: "Recusar",
        previa: "Nada muda · o empresário lembra que você recusou",
        efeito: { relacoes: { empresario: -5, treinador: 5 } },
      },
    ],
  }),

  c => c.temporadasDeContrato > 1 ? null : ({
    id: "luvas_por_fora",
    categoria: "dinheiro",
    titulo: "Luvas por fora",
    contexto:
      "Um intermediário oferece um valor de assinatura pago fora do contrato para " +
      "você acertar com um clube antes de a janela abrir. É comum no meio e é " +
      "irregular nos dois regulamentos que se aplicam a você.",
    escolhas: [
      {
        id: "aceitar",
        texto: "Aceitar em dinheiro, sem papel",
        previa: "Entra muito · não existe se der errado",
        efeito: { dinheiro: 600_000, relacoes: { empresario: 6 } },
        risco: 0.4,
        seDerErrado: { dinheiro: -200_000, reputacao: -14, relacoes: { imprensa: -14, marcas: -14 } },
        textoSeDerErrado: "A negociação vazou antes da janela. Processo aberto e imagem arranhada.",
      },
      {
        id: "formalizar",
        texto: "Exigir tudo em contrato, com o clube ciente",
        previa: "Menos dinheiro · nada pode ser usado contra você",
        efeito: { dinheiro: 220_000, relacoes: { empresario: -4, imprensa: 4 } },
      },
      {
        id: "recusar",
        texto: "Recusar e avisar o clube atual",
        previa: "Crédito interno · o mercado esfria",
        efeito: { relacoes: { treinador: 10, empresario: -12 }, reputacao: 3 },
      },
    ],
  }),

  // ── CONDUTA ─────────────────────────────────────────────────────────────
  c => c.vermelhos < 1 ? null : ({
    id: "tribunal",
    categoria: "conduta",
    titulo: "O julgamento no tribunal",
    contexto:
      "A expulsão virou processo e a pena pode passar de uma partida. O advogado do " +
      "clube tem duas estratégias, e elas dizem coisas opostas sobre você.",
    escolhas: [
      {
        id: "assumir",
        texto: "Assumir a falta e pedir desculpa formal",
        previa: "Pena mínima provável · parece recuo",
        efeito: { relacoes: { treinador: 8, imprensa: 6, elenco: -4 }, reputacao: -2 },
      },
      {
        id: "brigar",
        texto: "Contestar o lance inteiro, com vídeo",
        previa: "Pode zerar a pena · pode dobrar",
        efeito: { relacoes: { elenco: 8 }, moral: 4 },
        risco: 0.45,
        seDerErrado: { relacoes: { treinador: -10, imprensa: -8 }, moral: -8 },
        textoSeDerErrado: "A defesa irritou o tribunal e a pena aumentou.",
      },
    ],
  }),

  c => c.moral > 45 || c.temParceira ? null : ({
    id: "noite_antes_do_classico",
    categoria: "conduta",
    titulo: "A noite antes do clássico",
    contexto:
      "Você está mal, a semana foi longa e um grupo chamou para uma noite fora — " +
      "quinta-feira, clássico no domingo. Ninguém do clube ficaria sabendo. Quase " +
      "ninguém.",
    escolhas: [
      {
        id: "sair",
        texto: "Sair, e voltar cedo",
        previa: "A cabeça melhora · o corpo não",
        efeito: { moral: 12, energia: -20, forma: -6 },
        risco: 0.4,
        seDerErrado: { reputacao: -10, torcida: -12, relacoes: { treinador: -14, imprensa: -10 } },
        textoSeDerErrado: "Um vídeo seu na saída do lugar circulou às 4h da manhã.",
      },
      {
        id: "ficar",
        texto: "Ficar em casa",
        previa: "Pronto para domingo · a semana continua pesada",
        efeito: { energia: 10, forma: 4, moral: -4 },
      },
      {
        id: "familia",
        texto: "Chamar a família para jantar em casa",
        previa: "Levanta sem custar nada em campo",
        efeito: { moral: 8, relacoes: { familia: 8 }, energia: -4 },
      },
    ],
  }),
]

/**
 * O DILEMA DA RODADA — no máximo um, e só quando cabe.
 *
 * ⚠️ NÃO É TODA RODADA, DE PROPÓSITO. Um dilema por semana viraria rotina
 * administrativa em três temporadas — o jogador clicaria a opção neutra sem
 * ler. A cadência é de aproximadamente um a cada quatro rodadas, e ela sai da
 * própria semente: rodadas em que nenhum candidato passa no filtro simplesmente
 * não têm dilema, e isso é uma resposta legítima.
 */
export function dilemaDaRodada(c: ContextoDoDilema): Dilema | null {
  const janela = semente(`janela:${c.temporada}:${c.rodada}`)
  if (janela > 0.28) return null

  const candidatos = CATALOGO
    .map(g => g(c))
    .filter((d): d is Dilema => d !== null && !c.jaResolvidos.includes(chaveDoDilema(d, c)))

  if (candidatos.length === 0) return null
  const escolhido = Math.floor(semente(`qual:${c.temporada}:${c.rodada}`) * candidatos.length)
  return candidatos[Math.min(escolhido, candidatos.length - 1)]
}

/**
 * A CHAVE QUE IMPEDE REPETIÇÃO — id + temporada.
 *
 * ⚠️ NÃO É SÓ O `id`. Travar pelo id puro aposentaria cada dilema para sempre
 * depois da primeira vez, e uma carreira de quinze temporadas ficaria sem
 * nenhum na metade. Travar por temporada deixa o mesmo dilema voltar em anos
 * diferentes, que é como a vida funciona: o casamento da irmã não acontece
 * duas vezes no mesmo ano.
 */
export function chaveDoDilema(d: Dilema, c: { temporada: number }): string {
  return `${d.id}@${c.temporada}`
}

export interface DesfechoDoDilema {
  efeito: EfeitoDoDilema
  deuErrado: boolean
  texto: string
}

/**
 * RESOLVE UMA ESCOLHA — soma o efeito e sorteia o risco, de forma determinística.
 *
 * ⚠️ QUANDO DÁ ERRADO O EFEITO BOM NÃO SOME. O dinheiro do documentário entra
 * mesmo que o take vaze; a multa da marca é cobrada por cima do cachê. Anular o
 * ganho transformaria o risco em "a escolha não aconteceu", e é justamente a
 * convivência dos dois que faz o jogador se lembrar da decisão.
 */
export function resolverDilema(
  dilema: Dilema,
  escolhaId: string,
  c: { temporada: number; rodada: number },
): DesfechoDoDilema {
  const escolha = dilema.escolhas.find(e => e.id === escolhaId) ?? dilema.escolhas[0]
  const risco = escolha.risco ?? 0
  const sorteio = semente(`risco:${dilema.id}:${escolha.id}:${c.temporada}:${c.rodada}`)
  const deuErrado = risco > 0 && sorteio < risco

  if (!deuErrado) return { efeito: escolha.efeito, deuErrado: false, texto: escolha.previa }

  return {
    efeito: somar(escolha.efeito, escolha.seDerErrado ?? {}),
    deuErrado: true,
    texto: escolha.textoSeDerErrado ?? "A escolha teve consequências que você não previu.",
  }
}

/** Soma dois efeitos campo a campo — inclusive as relações, uma a uma. */
export function somar(a: EfeitoDoDilema, b: EfeitoDoDilema): EfeitoDoDilema {
  const relacoes: Partial<Record<Pessoa, number>> = { ...(a.relacoes ?? {}) }
  for (const [k, v] of Object.entries(b.relacoes ?? {})) {
    const p = k as Pessoa
    relacoes[p] = (relacoes[p] ?? 0) + (v ?? 0)
  }
  return {
    relacoes,
    dinheiro: (a.dinheiro ?? 0) + (b.dinheiro ?? 0),
    reputacao: (a.reputacao ?? 0) + (b.reputacao ?? 0),
    moral: (a.moral ?? 0) + (b.moral ?? 0),
    forma: (a.forma ?? 0) + (b.forma ?? 0),
    energia: (a.energia ?? 0) + (b.energia ?? 0),
    torcida: (a.torcida ?? 0) + (b.torcida ?? 0),
  }
}

/** Rótulo curto da categoria, para a tela agrupar sem inventar texto. */
export function rotuloDaCategoria(cat: CategoriaDoDilema): string {
  const mapa: Record<CategoriaDoDilema, string> = {
    imprensa: "Imprensa", patrocinio: "Patrocínio", familia: "Família",
    vestiario: "Vestiário", torcida: "Torcida", dinheiro: "Dinheiro", conduta: "Conduta",
  }
  return mapa[cat]
}

/** Quantos dilemas o catálogo oferece — o gate usa isto para pegar regressão. */
export const TOTAL_DE_DILEMAS = CATALOGO.length

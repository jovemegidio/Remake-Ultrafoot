// OS MODOS ONLINE, EM DADO.
//
// O pedido (1.0.327): os modos online só aparecem — no menu principal e na tela
// de criação — quando o jogo está EM MODO ONLINE. O interruptor não é novo:
// é o `multiplayerEnabled` que já existe no save e é ligado em Configurações →
// Configurações online. Ligar ali passa a abrir uma porta; desligado, o jogo
// inteiro segue como sempre foi, sem um item sequer de online no caminho.
//
// ⚠️ ESTA LISTA DIZ A VERDADE SOBRE O QUE EXISTE. Cada modo declara `estado`:
//   · "pronto"       — dá para jogar hoje;
//   · "em obras"     — parte funciona, parte não;
//   · "planejado"    — ainda não existe, e a tela DIZ isso.
// Um menu que oferece dez modos e entrega dois é pior do que um menu com dois:
// o jogador clica, não acontece nada, e ele deixa de confiar no resto da tela.
// A ordem das fases é a que o próprio usuário definiu ao descrever o modo.

export type EstadoDoModo = "pronto" | "em obras" | "planejado"

/**
 * Nem todo modo é uma ROTA. O FC Hub e o Draft moram numa camada sobreposta que
 * o jogo monta em toda tela (ver components/fc-hub-loader) e que se abre por
 * evento — Tab, ou `ultrafoot:fc-hub`. Um modo assim declara `acao` em vez de
 * `href`.
 *
 * ⚠️ ATÉ A 1.0.336 OS DOIS DECLARAVAM `href: "/?hub=1"` e `href: "/?draft=1"`.
 * Nenhum arquivo do projeto lê `hub` ou `draft` da query: clicar levava à raiz
 * com um parâmetro que ninguém consome — a MESMA falha do amistoso, e no hub
 * ela é pior, porque ele se declarava "pronto".
 */
export type AcaoDoModo = "abrir-hub"

export interface ModoOnline {
  id: string
  nome: string
  resumo: string
  /** Para onde o item leva quando está pronto. */
  href?: string
  /** Modos que não são rota: o item dispara isto no lugar de navegar. */
  acao?: AcaoDoModo
  estado: EstadoDoModo
  /** Fase do plano de desenvolvimento (1 a 5). */
  fase: 1 | 2 | 3 | 4 | 5
  /**
   * A arte do modo, em `public/online`. Cada modo tem a sua — antes a lista era
   * só texto, e dez cartões de texto puro numa grade viram parede.
   */
  icone: string
}

/** Um modo é clicável quando tem para onde ir — rota OU ação. */
export function temDestino(modo: ModoOnline): boolean {
  return Boolean(modo.href || modo.acao)
}

export const MODOS_ONLINE: ModoOnline[] = [
  {
    id: "amistoso",
    icone: "/online/01_amistoso_online.webp",
    nome: "Amistoso online",
    resumo: "Sala com código: você e um amigo, sem ranking e sem recompensa.",
    // ⚠️ ATÉ A 1.0.335 ISTO APONTAVA PARA `/multiplayer-local?online=1`, que é um
    // stub de 36 linhas cujo único trabalho é REDIRECIONAR PARA O DRAFT. O modo
    // não estava "em obras": estava sem destino, e clicar nele levava a outro
    // modo. Um `href` quebrado é pior que um estado "planejado" honesto — o
    // estado avisa, o link mente.
    href: "/online/amistoso",
    estado: "pronto",
    fase: 1,
  },
  {
    id: "hub",
    icone: "/online/02_fc_hub.webp",
    nome: "FC Hub",
    resumo: "Quem está conectado agora, conversa e convite para partida.",
    // O Hub não é rota: é a camada que abre por Tab em qualquer tela.
    acao: "abrir-hub",
    estado: "pronto",
    fase: 1,
  },
  {
    id: "draft",
    icone: "/online/03_manager_draft.webp",
    nome: "Manager Draft",
    resumo: "Monte um elenco escolhendo atleta por atleta e dispute o mata-mata.",
    // O draft vive DENTRO da sala de internet do Hub (components/hub-draft), e
    // até a 1.0.357 só depois de o anfitrião achar o botão "draft x draft nesta
    // sala". O caminho existia inteiro; o que faltava era a PORTA — e um modo
    // que exige três passos não explicados é um modo em obras, por mais pronto
    // que esteja o código do outro lado.
    //
    // A 1.0.358 abriu a porta: /online/draft cria (ou entra n)a sala com as
    // MESMAS funções do Hub e chega lá com o draft já aberto.
    href: "/online/draft",
    estado: "pronto",
    fase: 3,
  },
  {
    id: "rivals",
    icone: "/online/04_manager_rivals.webp",
    nome: "Manager Rivals",
    resumo: "Divisões e ranking por habilidade. O motor joga; quem gerencia melhor vence.",
    href: "/online/rivals",
    // ⚠️ SAIU DE "EM OBRAS" NA 1.0.358, e o que faltava era do SERVIDOR: as rotas
    // `/v1/competitivo/*` existiam no repositório e NÃO estavam publicadas na VPS
    // (o `server.mjs` de lá era uma versão anterior), e o pareamento avisava só
    // quem chegava por último — o primeiro da fila ficava em "Procurando
    // adversário…" para sempre. Com o relay atualizado, o caminho inteiro foi
    // percorrido contra o servidor de verdade: fila → pareamento → sala →
    // "Entrar na partida". Ver e2e/rivals-ao-vivo.spec.ts.
    estado: "pronto",
    fase: 2,
  },
  {
    id: "champions",
    icone: "/online/05_manager_champions.webp",
    nome: "Manager Champions",
    resumo: "O competitivo da semana: vitória vale 3, e a tabela zera toda segunda.",
    href: "/online/champions",
    // A MESMA fila, o MESMO Elo e o MESMO anti-cheat do Rivals (`modo:
    // "champions"`), com uma tabela semanal por cima — ver `classificacaoSemanal`
    // no relay. Não há um segundo matchmaking: haveria duas verdades sobre quem
    // joga contra quem.
    estado: "pronto",
    fase: 2,
  },
  {
    id: "carreira-online",
    icone: "/online/06_carreira_online.webp",
    nome: "Carreira Online",
    resumo: "Um mundo, vários técnicos humanos: o mercado e as vagas são compartilhados.",
    href: "/online/carreira",
    // ⚠️ SAIU DE "PLANEJADO" NA 1.0.358, e o que destravou foi a SEMENTE. O
    // relay não simula partida; sem semente, os dois lados de um confronto
    // simulariam por conta e chegariam a placares diferentes — a tabela
    // dependeria de quem clicou primeiro. Com a semente e as forças vindas do
    // servidor (`semearMotorDePartida`), as duas máquinas jogam o MESMO jogo, e
    // o segundo envio vira conferência. Vaga de clube e mercado são do
    // servidor: é o que "compartilhado" quer dizer.
    estado: "pronto",
    fase: 4,
  },
  {
    id: "coop",
    icone: "/online/07_carreira_cooperativa.webp",
    nome: "Carreira cooperativa",
    resumo: "Duas pessoas no mesmo clube — uma no banco, outra na diretoria.",
    href: "/online/carreira",
    // ⚠️ NÃO É OUTRO MUNDO — É O MESMO. Na 1.0.358 o clube da Carreira Online
    // deixou de ser "o time de um técnico" e virou uma entidade com até quatro
    // cadeiras. Cooperativa é entrar no clube de outra pessoa como DIRETOR: a
    // tabela é do clube, o caixa é o mesmo, e cada um faz o que o outro não
    // faz (só o técnico joga a partida; só o diretor negocia). Um segundo
    // sistema para isso seria dois mundos que discordam do mesmo placar.
    estado: "pronto",
    fase: 5,
  },
  {
    id: "diretoria",
    icone: "/online/08_diretoria_online.webp",
    nome: "Diretoria online",
    resumo: "Presidente, treinador, diretor e olheiro: cada função com uma pessoa.",
    href: "/online/carreira",
    // A cooperativa com as QUATRO cadeiras ocupadas. Cada papel tem uma mão
    // que os outros não têm — presidente abre a rodada e define o teto de
    // gastos; olheiro vê a força real do próximo adversário —, e o servidor é
    // quem cobra isso (`permissoes` em carreira-online.mjs). Papel que só
    // muda o rótulo na tela é papel que a segunda pessoa abandona no dia
    // seguinte.
    estado: "pronto",
    fase: 5,
  },
  {
    id: "rush",
    icone: "/online/09_rush.webp",
    nome: "Manager Rush",
    resumo: "Partida começada aos 60 minutos: vire o jogo antes do apito.",
    // ⚠️ SAIU DE "PLANEJADO" PORQUE EXISTE (1.0.354). Ele não precisa de servidor:
    // é uma variação de REGRA sobre o motor que já existe, e por isso pôde ser
    // feito enquanto Champions, Carreira Online, Diretoria e Cooperativa
    // continuam esperando estado compartilhado entre pessoas.
    href: "/online/rush",
    estado: "pronto",
    fase: 3,
  },
  {
    id: "eventos",
    icone: "/online/10_eventos_da_semana.webp",
    nome: "Eventos da semana",
    resumo: "Regras diferentes a cada semana: só sub-23, teto salarial, só clubes pequenos.",
    href: "/online/eventos",
    // ⚠️ SAIU DE "PLANEJADO" NA 1.0.358. A regra da semana é DERIVADA da string
    // da semana que o relay devolve (`regraDaSemana` em lib/eventos-da-semana),
    // e não guardada nos dois lados: uma lista de regras no servidor seria uma
    // segunda verdade, e bastaria esquecer de publicá-la para dois jogadores
    // verem restrições diferentes na mesma quinta-feira. O que o servidor
    // guarda é a MELHOR tentativa da semana de cada técnico.
    estado: "pronto",
    fase: 3,
  },
]

/** Os modos que valem mostrar primeiro: o que já dá para jogar. */
export function modosJogaveis(): ModoOnline[] {
  return MODOS_ONLINE.filter(m => m.estado !== "planejado")
}

export const ROTULO_DO_ESTADO: Record<EstadoDoModo, string> = {
  pronto: "Disponível",
  "em obras": "Em obras",
  planejado: "Em breve",
}

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

export interface ModoOnline {
  id: string
  nome: string
  resumo: string
  /** Para onde o item leva quando está pronto. */
  href?: string
  estado: EstadoDoModo
  /** Fase do plano de desenvolvimento (1 a 5). */
  fase: 1 | 2 | 3 | 4 | 5
}

export const MODOS_ONLINE: ModoOnline[] = [
  {
    id: "amistoso",
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
    nome: "FC Hub",
    resumo: "Quem está conectado agora, conversa e convite para partida.",
    href: "/?hub=1",
    estado: "pronto",
    fase: 1,
  },
  {
    id: "draft",
    nome: "Manager Draft",
    resumo: "Monte um elenco escolhendo atleta por atleta e dispute o mata-mata.",
    href: "/?draft=1",
    estado: "em obras",
    fase: 3,
  },
  {
    id: "rivals",
    nome: "Manager Rivals",
    resumo: "Divisões e ranking por habilidade. O motor joga; quem gerencia melhor vence.",
    href: "/online/rivals",
    estado: "em obras",
    fase: 2,
  },
  {
    id: "champions",
    nome: "Manager Champions",
    resumo: "O competitivo do fim de semana, com classificação por desempenho.",
    estado: "planejado",
    fase: 2,
  },
  {
    id: "carreira-online",
    nome: "Carreira Online",
    resumo: "Um mundo, vários técnicos humanos: o mercado e as vagas são compartilhados.",
    estado: "planejado",
    fase: 4,
  },
  {
    id: "coop",
    nome: "Carreira cooperativa",
    resumo: "Duas pessoas no mesmo clube — uma no banco, outra na diretoria.",
    estado: "planejado",
    fase: 5,
  },
  {
    id: "diretoria",
    nome: "Diretoria online",
    resumo: "Presidente, treinador, diretor e olheiro: cada função com uma pessoa.",
    estado: "planejado",
    fase: 5,
  },
  {
    id: "rush",
    nome: "Manager Rush",
    resumo: "Partida começada aos 60 minutos: vire o jogo em dez minutos de relógio.",
    estado: "planejado",
    fase: 3,
  },
  {
    id: "eventos",
    nome: "Eventos da semana",
    resumo: "Regras diferentes a cada semana: só sub-23, teto salarial, só clubes pequenos.",
    estado: "planejado",
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

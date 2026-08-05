// NÍVEIS DE DIFICULDADE — o dedo na balança agora é escolha do jogador.
//
// O que existia (achado da auditoria 4.0): `match-engine` dava ao adversário um
// bônus FIXO de +9 em ataque, defesa e meio — mais até +7 por diferença de força
// e +2/+3 por clássico/decisão/final — SEMPRE que o usuário entrava em campo.
// Partidas entre dois clubes da IA ficavam neutras.
//
// Isso tem duas consequências que ninguém escolheu:
//   1. o time do usuário rende PIOR nas partidas que ele disputa do que nas que
//      são simuladas — a mesma tabela mistura dois regimes;
//   2. não havia como pedir um jogo mais fácil nem mais difícil.
//
// O número não sai do jogo: ele vira NÍVEL. "Normal" é exatamente o que o jogo
// sempre fez (base 9), então save antigo e calibração do motor continuam valendo.
// "Justo" é o modo sem dedo na balança — o adversário joga com a força que tem.

export type NivelDeDificuldade = "amador" | "justo" | "normal" | "dificil" | "lendario"

export interface NivelInfo {
  id: NivelDeDificuldade
  nome: string
  descricao: string
  /** Bônus base do adversário quando o usuário está em campo, em pontos de overall. */
  bonusBase: number
  /**
   * Peso do bônus por diferença de força e por importância do jogo.
   * 0 zera os dois: no "justo" nem o clássico infla o adversário.
   */
  pesoDoContexto: number
}

export const NIVEIS: NivelInfo[] = [
  {
    id: "amador",
    nome: "Amador",
    descricao: "O adversário joga abaixo da própria força. Para conhecer o jogo sem sufoco.",
    bonusBase: -6,
    pesoDoContexto: 0.5,
  },
  {
    id: "justo",
    nome: "Justo",
    descricao: "Sem vantagem para ninguém: o adversário joga exatamente com a força do elenco dele.",
    bonusBase: 0,
    pesoDoContexto: 0,
  },
  {
    id: "normal",
    nome: "Normal",
    descricao: "O equilíbrio padrão do Ultrafoot. Jogos apertados, com o adversário um degrau acima.",
    bonusBase: 9,
    pesoDoContexto: 1,
  },
  {
    id: "dificil",
    nome: "Difícil",
    descricao: "O adversário chega mais forte e clássicos e decisões pesam mais.",
    bonusBase: 14,
    pesoDoContexto: 1.3,
  },
  {
    id: "lendario",
    nome: "Lendário",
    descricao: "Cada ponto conquistado é mérito. Não espere favor de ninguém.",
    bonusBase: 20,
    pesoDoContexto: 1.6,
  },
]

export const DIFICULDADE_PADRAO: NivelDeDificuldade = "normal"

const POR_ID = Object.fromEntries(NIVEIS.map(n => [n.id, n])) as Record<NivelDeDificuldade, NivelInfo>

/** Nível pelo id, tolerante a save antigo/valor desconhecido. */
export function nivelDeDificuldade(id?: string | null): NivelInfo {
  return POR_ID[(id ?? "") as NivelDeDificuldade] ?? POR_ID[DIFICULDADE_PADRAO]
}

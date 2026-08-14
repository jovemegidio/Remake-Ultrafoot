// DO MOTOR DE PARTIDA PARA A CENA — a tradução dos eventos.
//
// O 3D **encena**, não decide. Quem produz gol, cartão e placar é o
// `match-engine`; este módulo só traduz o vocabulário dele para o do motor
// visual. Nenhuma linha aqui pode inventar um evento que a partida não teve.
//
// Por que é um módulo, e não um `switch` dentro da tela
// ─────────────────────────────────────────────────────
// Porque a tradução tem casos que exigem decisão, e decisão escondida numa tela
// de 2.800 linhas não é revisável nem testável:
//
//   - `card` é genérico no motor de partida (o amarelo e o vermelho também
//     chegam explícitos). Encenar cartão sem saber a cor seria mostrar um
//     vermelho onde houve amarelo.
//   - `offside` não existe no vocabulário visual. Mas impedimento PARA o jogo e
//     devolve a bola ao adversário — é uma falta marcada, então `free_kick` é a
//     tradução honesta, e não uma invenção.
//   - `injury` não tem equivalente nenhum. ⚠️ Aqui a resposta certa é **não
//     encenar**: escolher qualquer coisa "parecida" faria a cena mostrar um
//     lance que não aconteceu. Devolver `null` e deixar a narração contar é
//     melhor que mentir em movimento.
//
// ⚠️ NUNCA "adivinhe" um tipo desconhecido. Um evento novo do motor de partida
// que chegue aqui sem tradução deve devolver `null` — a cena segue no fluxo
// normal e ninguém vê um lance falso. Ver o teste.

/** O vocabulário que o motor 3D aceita (espelha `TipoEncenavel` do V5). */
export type TipoEncenavel3D =
  | "kickoff" | "corner" | "goal_kick" | "throw_in" | "foul" | "free_kick" | "penalty"
  | "pass" | "shot" | "shot_on_target" | "miss" | "post" | "save"
  | "counter_attack" | "attack" | "pressure"
  | "goal" | "yellow_card" | "red_card" | "halftime" | "fulltime"

/**
 * Tradução direta — os tipos que já falam a mesma língua nos dois lados.
 * Manter como tabela (e não `if`s) é o que torna a cobertura conferível.
 */
const DIRETOS: Record<string, TipoEncenavel3D> = {
  kickoff: "kickoff",
  corner: "corner",
  foul: "foul",
  penalty: "penalty",
  goal: "goal",
  miss: "miss",
  post: "post",
  save: "save",
  counter_attack: "counter_attack",
  yellow_card: "yellow_card",
  red_card: "red_card",
  halftime: "halftime",
  fulltime: "fulltime",
}

/**
 * Traduções que exigiram decisão. Cada uma tem motivo, e o motivo está no
 * comentário do topo — não repita a decisão sem lê-lo.
 */
const COM_DECISAO: Record<string, TipoEncenavel3D> = {
  // Impedimento para o jogo e devolve a posse: visualmente, é falta marcada.
  offside: "free_kick",
  // "chance" é ataque criado sem desfecho declarado. `attack` é o estado que o
  // motor usa para recolocar os 22 em postura ofensiva — o que de fato houve.
  chance: "attack",
}

/**
 * Traduz um evento do motor de partida para a cena.
 *
 * Devolve `null` quando não há tradução honesta — e quem chama **não deve
 * encenar nada** nesse caso.
 */
export function tipoParaCena(tipoDoMotor: string): TipoEncenavel3D | null {
  const t = (tipoDoMotor || "").toLowerCase()
  return DIRETOS[t] ?? COM_DECISAO[t] ?? null
}

/**
 * Tipos que o motor de partida produz e que NÃO devem virar cena.
 *
 * Existe para ficar explícito que a ausência é decisão, não esquecimento —
 * alguém revisando isto precisa distinguir "ninguém traduziu ainda" de "não se
 * traduz de propósito".
 */
export const SEM_ENCENACAO = new Set(["injury", "card"])

/** É um evento conhecido do motor de partida, mesmo que não vire cena? */
export function conhecido(tipoDoMotor: string): boolean {
  const t = (tipoDoMotor || "").toLowerCase()
  return t in DIRETOS || t in COM_DECISAO || SEM_ENCENACAO.has(t)
}

// FORÇA DE UM PLANTEL EM CAMPO — a mesma régua para os dois lados.
//
// Por que este arquivo existe
// ───────────────────────────
// A conta de força do time do usuário sempre viveu dentro de
// `app/partida/ao-vivo/page.tsx`, e o motor de partida só conhece UM lado
// humano: o adversário entra como CPU, com força derivada do PRESTÍGIO do clube.
//
// Isso não incomodava enquanto o outro lado era a máquina. Com o multitécnico
// passa a incomodar muito: se o Flamengo do João for medido pelo prestígio,
// o elenco que ele montou, os reforços que comprou e a escalação que escolheu
// não valem NADA no placar — o modo vira enfeite. Ver
// [[ultrafoot-sistemas-implementados-porem-desligados]]: o padrão de "existe mas
// não tem efeito" já custou caro aqui.
//
// ⚠️ A régua tem de ser LITERALMENTE a mesma para os dois. Se o adversário
// humano fosse medido por uma conta parecida-mas-não-igual, o modo teria um viés
// silencioso a favor de um dos lados — o tipo de defeito que ninguém consegue
// provar olhando o jogo, só sentir depois de dez partidas. Por isso a conta mora
// aqui e é chamada nos dois lugares, em vez de copiada.
//
// Este arquivo é PURO: sem React, sem store, sem save.

import { efeitoDoRitmoNoGrupo } from "@/lib/ritmo-de-jogo"

/** O mínimo que um atleta precisa ter para entrar na conta. */
export interface AtletaEmCampo {
  position: string
  overall: number
  isStarter?: boolean
  injury?: unknown
  form?: number
  morale?: string
  moralePoints?: number
  /** Ritmo de jogo (0-100). Ausente = neutro; ver `lib/ritmo-de-jogo.ts`. */
  ritmo?: number
}

export interface ForcasDoPlantel {
  /** Média simples do XI. */
  overall: number
  /** Média dos 3 melhores do ataque. */
  attack: number
  /** Linha de 4 + goleiro, com peso 4:1. */
  defense: number
  /** Média dos 4 melhores do meio. */
  midfield: number
  /**
   * Modificador de forma, moral e RITMO DE JOGO, de cerca de -13 a +8. Vem
   * separado porque quem chama soma o clima do elenco por cima, e clima é do
   * CLUBE de quem joga.
   *
   * ⚠️ O ritmo entra AQUI, e não no overall de cada setor (1.0.386). Somá-lo ao
   * overall mudaria as médias por setor — que são o que decide a identidade de
   * ataque e defesa do time — para medir uma coisa que não é qualidade do
   * atleta, e sim o estado dele nesta semana. `mod` é o canal que já existe para
   * exatamente isso, e todos os chamadores já o somam por igual aos três
   * setores.
   */
  mod: number
}

/** Setor vazio vale 65: um time sem ponta não fica sem ataque, fica mediano. */
const SEM_SETOR = 65

function mediaDoSetor(xi: AtletaEmCampo[], posicoes: string[], quantos: number): number {
  const grupo = xi
    .filter(p => posicoes.includes(p.position))
    .sort((a, b) => b.overall - a.overall)
    .slice(0, quantos)
  return grupo.length ? grupo.reduce((s, p) => s + p.overall, 0) / grupo.length : SEM_SETOR
}

/** Moral em rótulo vira pontos, para o caso de o atleta não ter `moralePoints`. */
function pontosDeMoral(m: string | undefined): number {
  return m === "Feliz" ? 80
    : m === "Motivado" ? 68
    : m === "Descontente" ? 35
    : m === "Revoltado" ? 20
    : 55
}

/**
 * Titulares aptos: é com eles que se mede a força.
 *
 * ⚠️ O lesionado sai da conta de propósito. Ele continua no `squadPlayers`, e
 * incluí-lo mediria um time que não vai entrar em campo — que é justamente o
 * erro que faria o adversário humano parecer mais forte do que é.
 */
export function titularesAptos(plantel: AtletaEmCampo[]): AtletaEmCampo[] {
  return plantel.filter(p => p.isStarter && !p.injury)
}

/** Os quatro números que o motor de partida pede de cada lado. */
export interface LadoEmCampo {
  overall: number
  attack: number
  defense: number
  midfield: number
}

/** O que o perfil de CPU oferece — só o que a conta abaixo usa. */
export interface PerfilDeCpu {
  socialModifier: number
  modifiers: { attackBoost: number; defenseBoost: number; pressureBoost: number }
}

/**
 * QUEM É O ADVERSÁRIO: outro técnico da mesa, ou a máquina?
 *
 * ⚠️ Esta escolha é o coração do multitécnico e é fácil de errar em silêncio.
 * Se o lado humano cair no caminho da CPU, o jogo continua funcionando, o placar
 * continua saindo — e o elenco que a outra pessoa montou simplesmente não conta.
 * Ninguém percebe olhando a tela; percebe-se depois de dez partidas, sentindo
 * que "dá no mesmo". Por isso a decisão mora aqui, testada, e não num ternário
 * dentro do componente.
 *
 * O `+2` do prestígio é a compensação histórica da CPU. Um humano não a recebe:
 * ele tem o elenco dele.
 */
export function ladoAdversarioEmCampo(
  humano: LadoEmCampo | null,
  prestigioDoClube: number,
  perfil: PerfilDeCpu,
): LadoEmCampo {
  if (humano) return humano
  return {
    overall: prestigioDoClube + 2 + perfil.socialModifier,
    attack: prestigioDoClube * perfil.modifiers.attackBoost + perfil.socialModifier,
    defense: prestigioDoClube * perfil.modifiers.defenseBoost + perfil.socialModifier,
    midfield: prestigioDoClube * (0.94 + perfil.modifiers.pressureBoost * 0.06) + perfil.socialModifier,
  }
}

/**
 * A conta em si.
 *
 * `overallDeReserva` é o que vale quando não há XI nenhum — o prestígio do
 * clube. Sem ele um plantel vazio daria força zero e o placar seria absurdo.
 */
export function forcasDoPlantel(xi: AtletaEmCampo[], overallDeReserva: number): ForcasDoPlantel {
  const atk = mediaDoSetor(xi, ["ATA", "PE", "PD"], 3)
  const mid = mediaDoSetor(xi, ["MEI", "VOL"], 4)
  const linha = mediaDoSetor(xi, ["ZAG", "LD", "LE"], 4)
  const gk = mediaDoSetor(xi, ["GOL"], 1)
  const def = (linha * 4 + gk) / 5

  const overall = xi.length
    ? xi.reduce((s, p) => s + p.overall, 0) / xi.length
    : overallDeReserva

  // Forma (0-100) e moral (rotulo ou pontos) do XI viram +/- ~7.
  const formaMedia = xi.length ? xi.reduce((s, p) => s + (p.form ?? 70), 0) / xi.length : 70
  const moralMedia = xi.length
    ? xi.reduce((s, p) => s + (p.moralePoints ?? pontosDeMoral(p.morale)), 0) / xi.length
    : 55
  // RITMO DE JOGO (1.0.386): quem nao joga ha semanas entra sem ritmo.
  //
  // ⚠️ ELE MEDE O QUE NENHUM DOS DOIS ACIMA MEDIA. `form` so se move para quem
  // PARTICIPOU da partida, entao a forma do reserva fica congelada; a energia
  // ate PREMIA quem descansa. O atleta tres meses no banco entrava com forma
  // intacta e energia cheia. Ver `lib/ritmo-de-jogo.ts`.
  //
  // ⚠️ E ELE VALE PARA OS DOIS LADOS pelo simples fato de morar aqui — que e a
  // regra que abre este arquivo. O tecnico adversario do co-op paga o mesmo
  // preco por revezar demais.
  const ritmoMod = efeitoDoRitmoNoGrupo(xi.map(p => p.ritmo))
  const mod = (formaMedia - 70) / 9 + (moralMedia - 55) / 13 + ritmoMod

  return { overall, attack: atk, defense: def, midfield: mid, mod }
}

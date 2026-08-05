// O MUNDO ENVELHECE JUNTO — antes só o clube do usuário tinha passagem do tempo.
//
// O buraco (auditoria 4.0): `players-data` não tinha UMA ocorrência de "season".
// O elenco de qualquer clube que não é o do usuário é remontado do seed a cada
// consulta — inclusive a cada partida simulada (`use-game-manager`). Em 2036 o
// rival ainda tinha o elenco de 2026 com as idades de 2026: ninguém envelhecia,
// ninguém evoluía, ninguém se aposentava. Uma carreira longa era jogada contra
// um álbum de figurinhas.
//
// Este módulo é PURO e DETERMINÍSTICO: a mesma dupla (atleta, temporada) sempre
// devolve o mesmo resultado. Isso importa porque o elenco da CPU é recalculado o
// tempo todo — se a evolução sorteasse a cada chamada, o mesmo zagueiro teria um
// overall diferente na tela de adversários e na partida.
//
// A curva segue a mesma ideia que o motor já aplica ao elenco do usuário
// (`processSeasonEnd`): cresce até o pico, estabiliza, cai depois dos 30. Aqui
// ela é aplicada de uma vez, em função de quantas temporadas se passaram — não
// ano a ano —, porque não existe estado guardado por atleta da CPU.

/** Temporada em que os elencos do seed foram fotografados. */
export const TEMPORADA_BASE_DO_MUNDO = 2026

/** Idade a partir da qual o atleta pode pendurar as chuteiras. */
const IDADE_DE_APOSENTADORIA = 36
/** Ninguém segue jogando além disso. */
const IDADE_LIMITE_ABSOLUTA = 41

export interface AtletaDoMundo {
  nome: string
  idade: number
  base: number
}

export interface AtletaEnvelhecido {
  idade: number
  base: number
  /** Pendurou as chuteiras — quem chama tira do elenco. */
  aposentado: boolean
}

function semente(chave: string): number {
  let h = 2166136261
  for (const c of chave) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return (h >>> 0) / 4294967296
}

/**
 * Quanto um atleta ganha (ou perde) de overall entre duas idades.
 *
 * Somatório de deltas ano a ano, para a curva não depender de "quantos anos
 * passaram" e sim de POR ONDE ele passou: um atleta de 19 que avança 5 anos
 * cresce; um de 31 que avança os mesmos 5 anos despenca.
 */
function deltaDaCurva(idadeInicial: number, anos: number, sorte: number): number {
  let delta = 0
  for (let i = 0; i < anos; i++) {
    const idade = idadeInicial + i
    if (idade < 21) delta += 2.2
    else if (idade < 24) delta += 1.5
    else if (idade < 27) delta += 0.6
    else if (idade < 30) delta += 0
    else if (idade < 33) delta -= 1.4
    else if (idade < 36) delta -= 2.6
    else delta -= 3.6
  }
  // ±35% de variação individual, estável por atleta: dois jovens do mesmo clube
  // não evoluem no mesmo passo, mas cada um evolui sempre igual.
  return delta * (0.65 + sorte * 0.7)
}

/**
 * Como este atleta está `temporadas` anos depois da foto do seed.
 *
 * `chave` identifica o atleta de forma estável (nome + clube serve): é dela que
 * sai a variação individual, então ela não pode mudar entre duas chamadas.
 */
export function envelhecerAtleta(
  atleta: AtletaDoMundo,
  temporadas: number,
  chave: string,
): AtletaEnvelhecido {
  if (temporadas <= 0) return { idade: atleta.idade, base: atleta.base, aposentado: false }
  const idade = atleta.idade + temporadas
  const sorte = semente(`${chave}:${atleta.nome}`)

  if (idade >= IDADE_LIMITE_ABSOLUTA) return { idade, base: atleta.base, aposentado: true }
  if (idade >= IDADE_DE_APOSENTADORIA) {
    // Entre 36 e 40 a aposentadoria é progressiva: aos 36 sai ~20%, aos 40 sai
    // quase todo mundo. Sem isso o mundo acumularia atletas de 40 anos.
    const chance = 0.2 + (idade - IDADE_DE_APOSENTADORIA) * 0.2
    if (semente(`aposenta:${chave}:${atleta.nome}`) < chance) {
      return { idade, base: atleta.base, aposentado: true }
    }
  }

  const base = Math.max(40, Math.min(94, Math.round(atleta.base + deltaDaCurva(atleta.idade, temporadas, sorte))))
  return { idade, base, aposentado: false }
}

export interface ElencoEnvelhecido<T> {
  elenco: T[]
  /** Quantos penduraram as chuteiras — cada um abre uma vaga na base. */
  aposentados: number
}

/**
 * Aplica a passagem do tempo a um elenco inteiro do mundo.
 *
 * ⚠️ O NÚMERO DE APOSENTADOS IMPORTA, e é por isso que ele volta daqui. Se as
 * saídas só descontassem, o mundo encolheria para sempre: medido, os clubes iam
 * de ~26 para ~20 atletas em 10 temporadas, e a rede de segurança
 * (`ensurePlayableSquad`) só repõe até o mínimo jogável — nunca de volta ao
 * plantel que o clube tinha. Um clube de verdade repõe quem se aposenta com
 * gente da base; quem chama usa esta contagem para isso.
 */
export function envelhecerElenco<T extends AtletaDoMundo>(
  elenco: readonly T[],
  temporadas: number,
  chaveDoClube: string,
): ElencoEnvelhecido<T> {
  if (temporadas <= 0) return { elenco: elenco as T[], aposentados: 0 }
  const vivos: T[] = []
  let aposentados = 0
  for (const p of elenco) {
    const r = envelhecerAtleta(p, temporadas, chaveDoClube)
    if (r.aposentado) { aposentados++; continue }
    vivos.push({ ...p, idade: r.idade, base: r.base })
  }
  return { elenco: vivos, aposentados }
}

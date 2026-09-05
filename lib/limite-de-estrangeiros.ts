/**
 * LIMITE DE ESTRANGEIROS EM CAMPO.
 *
 * ⚠️ A REGRA JA ESTAVA ESCRITA NO JOGO, SEM LEITOR (achado na 1.0.387).
 * `competition-regulations-2026.ts` declara `registrationRules` — "máximo de
 * cinco estrangeiros simultaneamente em campo", entre outras — e NADA no jogo
 * lia esse campo. Era texto para o olho humano, nao regra do jogo: o mesmo
 * padrao dos 4 focos da 1.0.383, dos 3 medidores da 1.0.377 e do desempate da
 * 1.0.387.
 *
 * ⚠️ SO ENTRA PAIS CUJO LIMITE EU SEI QUE VIGORA HOJE. Brasil e Chile estao
 * aqui porque a regra e estavel e conhecida. Ficam de fora, de proposito:
 *
 *   · Europa (UEFA) — nao ha limite de estrangeiro; ha COTA DE FORMADOS EM
 *     CASA, que e outra regra e exige saber onde cada atleta se formou, dado
 *     que o jogo nao tem;
 *   · Arabia Saudita, China, Japao e Coreia — todos tem limite, mas o numero
 *     mudou nas ultimas temporadas e eu nao tenho o valor vigente com certeza.
 *     Chutar aqui seria pior que a ausencia: o jogador conferiria, veria que
 *     esta errado, e passaria a duvidar do resto do regulamento.
 *
 * Quando o valor for confirmado, acrescentar aqui basta — o resto ja funciona.
 */
import { LEAGUE_COMPETITIONS } from "@/lib/country-competitions"

export interface LimiteDeEstrangeiros {
  /** Quantos podem estar em campo AO MESMO TEMPO. */
  emCampo: number
  /** Nacionalidade que NAO conta como estrangeira nesta liga. */
  pais: string
  /** De onde a regra veio, para conferencia. */
  fonte: string
}

/**
 * Por PAIS, e nao por divisao: a regra vale para todas as divisoes de um pais,
 * inclusive as femininas e os estaduais, sem precisar enumerar cada uma.
 */
const LIMITES_POR_PAIS: Record<string, LimiteDeEstrangeiros> = {
  "Brasil": { emCampo: 5, pais: "Brasil", fonte: "CBF: cinco estrangeiros simultaneamente em campo" },
  "Chile": { emCampo: 5, pais: "Chile", fonte: "ANFP: seis habilitados, cinco simultaneamente em campo" },
}

/**
 * ⚠️ NAO MODELAMOS A EXCECAO FORMATIVA. O regulamento chileno abre excecao para
 * quem se formou no pais, e o brasileiro ja teve variacoes parecidas. O jogo nao
 * guarda onde o atleta se formou, entao a excecao nao tem como ser aplicada — e
 * fingir que aplicamos seria repetir o defeito que este arquivo conserta.
 * O efeito pratico e um limite LIGEIRAMENTE mais duro que o real em casos raros.
 */
export function limiteDeEstrangeiros(divisao?: string): LimiteDeEstrangeiros | null {
  if (!divisao) return null
  const pais = LEAGUE_COMPETITIONS[divisao]?.country
  return pais ? (LIMITES_POR_PAIS[pais] ?? null) : null
}

/**
 * O minimo que a checagem precisa ler de um atleta.
 *
 * ⚠️ SEM `id` DE PROPOSITO. O atleta do motor tem id NUMERICO e o do save tem
 * id de TEXTO; exigir o campo aqui obrigaria um dos dois lados a converter so
 * para passar por esta funcao. A regra so precisa de nome e nacionalidade.
 */
export interface AtletaComNacionalidade {
  name: string
  nationality?: string
}

export interface ViolacaoDeEstrangeiros {
  limite: number
  pais: string
  fonte: string
  /** Quantos estrangeiros a escalacao tem. */
  escalados: number
  /** Os que passam do limite — os ULTIMOS da lista recebida. */
  excedentes: AtletaComNacionalidade[]
}

/**
 * Diz se a escalacao fura o limite. `null` quando esta dentro da regra, ou
 * quando a liga nao tem limite nenhum.
 *
 * ⚠️ SEM NACIONALIDADE, O ATLETA CONTA COMO LOCAL. Save antigo e elenco gerado
 * podem nao ter o campo, e recusar escalacao por dado ausente transformaria uma
 * regra de futebol num defeito de migracao. Errar para o lado de DEIXAR JOGAR e
 * o unico erro aceitavel aqui.
 */
export function violacaoDeEstrangeiros(
  xi: readonly AtletaComNacionalidade[],
  divisao?: string,
): ViolacaoDeEstrangeiros | null {
  const limite = limiteDeEstrangeiros(divisao)
  if (!limite) return null
  const estrangeiros = xi.filter(p => p.nationality && p.nationality !== limite.pais)
  if (estrangeiros.length <= limite.emCampo) return null
  return {
    limite: limite.emCampo,
    pais: limite.pais,
    fonte: limite.fonte,
    escalados: estrangeiros.length,
    excedentes: estrangeiros.slice(limite.emCampo),
  }
}

/** Frase pronta para a tela, no lugar de um numero solto. */
export function mensagemDeViolacao(v: ViolacaoDeEstrangeiros): string {
  const nomes = v.excedentes.map(p => p.name).join(", ")
  return `Escalação com ${v.escalados} estrangeiros: o limite em ${v.pais} é ${v.limite} em campo ao mesmo tempo. Fora do limite: ${nomes}.`
}

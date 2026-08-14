/**
 * FORCAS INDIVIDUAIS — a funcao de cada atleta passa a valer em campo.
 *
 * ## O que existia
 *
 * `PlayerRole` declara **66 funcoes** (goleiro_libero, regista, mezzala,
 * falso_nove, ponta_invertido...) e `PlayerInstructions` traz mais sete
 * controles por atleta. O motor de partida lia ZERO deles: o jogador escolhia
 * a funcao e nada mudava no placar. E a mesma lacuna que as taticas coletivas
 * tinham antes de `lib/forcas-taticas.ts`.
 *
 * ## A ideia central: ADEQUACAO, nao qualidade
 *
 * A qualidade do atleta JA entra na forca do time pelo overall. Se a funcao
 * somasse qualidade de novo, seria contar duas vezes — o defeito recorrente
 * deste projeto.
 *
 * O que se mede aqui e OUTRA coisa: se os atributos dele servem para a funcao
 * que recebeu. Um lateral lento escalado como `ponta_velocista` rende menos que
 * o overall dele promete; um zagueiro forte no jogo aereo como `zagueiro_aereo`
 * rende mais. A comparacao e sempre contra o PROPRIO overall do atleta, entao
 * um craque mal empregado perde e um limitado bem empregado ganha.
 *
 * ## As tres travas
 *
 * 1. ⚠️ Efeito por SETOR e por MEDIA, nunca por soma: senao um elenco grande
 *    valeria mais que um bom.
 * 2. ⚠️ Teto proprio (`TETO_INDIVIDUAL`), menor que o das taticas coletivas —
 *    esta e a segunda camada e nao pode dominar a primeira.
 * 3. ⚠️ As instrucoes sao TROCA, como em forcas-taticas. Nenhuma e bonus puro.
 *
 * ## Limite conhecido
 *
 * As funcoes sao classificadas por PADRAO DE NOME, nao por tabela de 66 linhas.
 * E deliberado: uma tabela dessas envelhece e ninguem a revisa. A contrapartida
 * e que uma funcao nova com nome fora do padrao cai no perfil neutro do setor —
 * nao quebra, so nao especializa. Ha teste cobrindo as 66 atuais.
 */
import type { Player, PlayerInstructions, PlayerRole } from "./game-engine"
import { familiaridadeComAFuncao, perfilDoAtleta } from "./modelo-de-jogador"

export interface ForcasIndividuais {
  attack: number
  defense: number
  midfield: number
  /** Quantos atletas estao BEM empregados (adequacao positiva). */
  bemEmpregados: number
  /** Quantos estao mal empregados — o numero que o tecnico precisa ver. */
  malEmpregados: number
  /** Frases nomeando quem esta fora de funcao, para a tela explicar. */
  avisos: string[]
}

/** Menor que TETO_TATICO (8): camada individual nao pode dominar a coletiva. */
export const TETO_INDIVIDUAL = 4

type Atributo = "pace" | "shooting" | "passing" | "dribbling" | "defending" | "physical"
type Setor = "ATA" | "MEI" | "DEF" | "GOL"

/**
 * Atributos que cada PALAVRA de uma funcao valoriza. A funcao e classificada
 * pelas palavras que contem — `ponta_velocista` pega "ponta" e "velocista".
 * Ordem nao importa; os atributos se acumulam sem repetir.
 */
const POR_PALAVRA: Record<string, Atributo[]> = {
  // Defender / destruir
  marcador: ["defending", "physical"], destruidor: ["defending", "physical"],
  stopper: ["defending", "physical"], ancora: ["defending", "physical"],
  defensor: ["defending"], defensivo: ["defending"], cobertura: ["defending", "pace"],
  cover: ["defending", "pace"], zona: ["defending"], tackleharder: ["defending"],
  // Construir / passar
  saidor: ["passing"], regista: ["passing"], organizador: ["passing"],
  armador: ["passing", "dribbling"], construtor: ["passing"], distribuidor: ["passing"],
  libero: ["passing", "defending"], sweeper: ["pace", "defending"],
  enganche: ["passing", "dribbling"], trequartista: ["passing", "dribbling"],
  // Correr / infiltrar
  velocista: ["pace"], infiltrador: ["pace", "shooting"], profundidade: ["pace"],
  sobreposto: ["pace", "physical"], ofensivo: ["pace"], ala: ["pace", "physical"],
  extremo: ["pace", "dribbling"], flutuante: ["dribbling", "pace"],
  movel: ["pace", "dribbling"], carrilero: ["physical", "passing"],
  // Finalizar
  finalizador: ["shooting"], poacher: ["shooting"], area: ["shooting"],
  atacante: ["shooting"], centroavante: ["shooting", "physical"],
  // Fisico / aereo
  aereo: ["physical"], target: ["physical", "shooting"], man: ["physical"],
  pivot: ["physical", "passing"], referencia: ["physical", "shooting"],
  box: ["physical", "pace"], to: [], completo: [],
  // Tecnica
  tecnico: ["dribbling", "passing"], invertido: ["dribbling", "shooting"],
  cutinside: ["dribbling", "shooting"], cruzador: ["passing", "pace"],
  falso: ["passing", "dribbling"], nove: ["shooting"],
  lider: ["defending", "physical"], pressing: ["physical", "pace"],
  fixo: ["dribbling"], livre: ["dribbling", "passing"],
  mezzala: ["dribbling", "physical"], segundo: ["pace"],
}

/** Setor que cada funcao alimenta, pela raiz do nome. */
function setorDaFuncao(role: string): Setor {
  if (role.startsWith("goleiro")) return "GOL"
  if (role.startsWith("zagueiro") || role.startsWith("lateral")) return "DEF"
  if (role.startsWith("volante") || role.startsWith("meia") || role.startsWith("meio")
    || role === "regista" || role === "carrilero" || role === "mezzala"
    || role === "enganche" || role === "trequartista" || role === "construtor_jogo") return "MEI"
  return "ATA"
}

/** Atributos-chave de uma funcao, pela uniao das palavras que ela contem. */
export function atributosDaFuncao(role: PlayerRole | string): Atributo[] {
  const chaves = new Set<Atributo>()
  for (const palavra of String(role).split("_")) {
    for (const attr of POR_PALAVRA[palavra] ?? []) chaves.add(attr)
  }
  if (chaves.size > 0) return [...chaves]
  // Funcao sem palavra conhecida: perfil neutro do setor. Nao quebra.
  const setor = setorDaFuncao(String(role))
  return setor === "GOL" ? ["defending"]
    : setor === "DEF" ? ["defending", "physical"]
      : setor === "MEI" ? ["passing"] : ["shooting"]
}

/**
 * Adequacao a funcao, de -2 a +2.
 *
 * Compara os atributos-chave com o PROPRIO overall do atleta. Positivo = os
 * pontos dele estao onde a funcao pede. Nunca mede se ele e bom — isso o
 * overall ja faz na forca do time.
 */
export function adequacaoAFuncao(atleta: Player, role: PlayerRole | string): number {
  const chaves = atributosDaFuncao(role)
  if (chaves.length === 0) return 0
  const media = chaves.reduce((s, k) => s + (Number(atleta[k]) || 0), 0) / chaves.length
  const diferenca = media - atleta.overall
  return Math.max(-2, Math.min(2, Math.round((diferenca / 4) * 10) / 10))
}

/** Instrucoes individuais: cada uma cobra o seu preco. */
function efeitoDasInstrucoes(instr: Partial<PlayerInstructions> | undefined): {
  attack: number; defense: number; midfield: number; conflitos: number
} {
  const e = { attack: 0, defense: 0, midfield: 0, conflitos: 0 }
  if (!instr) return e

  if (instr.roaming === "liberdade_total") { e.attack += 0.4; e.defense -= 0.4 }
  if (instr.roaming === "ficar_posicao") { e.defense += 0.3; e.attack -= 0.3 }
  if (instr.runs === "frequentemente") { e.attack += 0.4; e.midfield -= 0.4 }
  if (instr.runs === "raramente") { e.midfield += 0.2; e.attack -= 0.2 }
  if (instr.markingTightness === "apertado") { e.defense += 0.3; e.midfield -= 0.3 }
  if (instr.closingDown === "mais") { e.midfield += 0.3; e.defense -= 0.3 }
  if (instr.dribbling === "mais") { e.attack += 0.3; e.midfield -= 0.3 }
  if (instr.passingRisk === "arriscado") { e.attack += 0.4; e.midfield -= 0.4 }
  if (instr.passingRisk === "seguro") { e.midfield += 0.2; e.attack -= 0.2 }
  if (instr.crossFrequency === "mais") { e.attack += 0.2; e.midfield -= 0.2 }
  if (instr.getForward) { e.attack += 0.4; e.defense -= 0.4 }
  if (instr.holdPosition) { e.defense += 0.4; e.attack -= 0.4 }
  if (instr.tackleHarder) { e.defense += 0.3; e.midfield -= 0.3 }
  if (instr.cutInside) { e.attack += 0.3; e.midfield -= 0.3 }
  if (instr.stayWider) { e.attack += 0.2; e.midfield -= 0.2 }

  // Ordens que se anulam — o atleta nao consegue obedecer as duas.
  if (instr.getForward && instr.holdPosition) e.conflitos++
  if (instr.roaming === "ficar_posicao" && instr.runs === "frequentemente") e.conflitos++
  if (instr.stayWider && instr.cutInside) e.conflitos++

  return e
}

/**
 * QUANTO A FASE COM BOLA PESA, por setor.
 *
 * ⚠️ Estes pesos precisam somar 1 com o complemento — quando o atleta tem a
 * MESMA funcao nas duas fases (o caso de todo save anterior a esta versao), a
 * media ponderada devolve exatamente a nota antiga. E assim que a funcao por
 * fase entrou sem recalibrar uma unica partida ja jogada.
 *
 * Os numeros dizem uma coisa simples: errar a funcao ofensiva de um atacante
 * custa caro, errar a defensiva dele custa pouco — e no zagueiro e o contrario.
 */
const PESO_COM_BOLA: Record<Setor, number> = { ATA: 0.7, MEI: 0.5, DEF: 0.3, GOL: 0.3 }

const SETOR_DA_POSICAO: Record<string, Setor> = {
  GOL: "GOL",
  ZAG: "DEF", LD: "DEF", LE: "DEF", LAT: "DEF",
  VOL: "MEI", MEI: "MEI",
  ATA: "ATA", PE: "ATA", PD: "ATA",
}

/**
 * Efeito do XI titular. Por MEDIA de setor: um elenco grande nao pode valer
 * mais que um bem escalado.
 */
export function forcasDoElenco(
  titulares: Player[],
  instrucoes: Record<number, Partial<PlayerInstructions>> = {},
): ForcasIndividuais {
  const vazio: ForcasIndividuais = {
    attack: 0, defense: 0, midfield: 0, bemEmpregados: 0, malEmpregados: 0, avisos: [],
  }
  if (titulares.length === 0) return vazio

  const porSetor: Record<Setor, number[]> = { ATA: [], MEI: [], DEF: [], GOL: [] }
  const extras = { attack: 0, defense: 0, midfield: 0 }
  let conflitos = 0
  const foraDeFuncao: { nome: string; nota: number; fase: string | null }[] = []
  let bem = 0

  for (const atleta of titulares) {
    const instr = instrucoes[atleta.id]
    const role = instr?.role
    // Sem funcao definida nao ha adequacao a medir — e o estado da maioria dos
    // saves antigos, que nunca abriram a aba de instrucoes.
    if (role) {
      // ADEQUACAO x FAMILIARIDADE sao duas coisas. A primeira pergunta se os
      // atributos servem para a funcao (imediata); a segunda, se ele ja se
      // acostumou a exerce-la (so o tempo responde). Funcao nova CUSTA: o
      // multiplicador comeca em 0,80 e sobe ate 1,00 em ~meia temporada. Fosse
      // bonus no fim em vez de custo no comeco, trocar a funcao de todo mundo
      // toda semana viraria vantagem. Ver lib/modelo-de-jogador.ts.
      const perfil = perfilDoAtleta(atleta.id, atleta.position, atleta.overall, atleta.secondaryPositions ?? [])
      // A FUNCAO SEM BOLA e opcional: ausente, e a mesma, e tudo abaixo devolve
      // o numero de antes. Ver o comentario de PESO_COM_BOLA.
      const roleSemBola = instr?.roleSemBola ?? role
      const notaDaFase = (funcao: PlayerRole | string) => {
        const habito = familiaridadeComAFuncao(atleta.perfilProgresso, String(funcao), perfil.versatilidade)
        const bruta = adequacaoAFuncao(atleta, funcao)
        // So a nota POSITIVA e descontada pelo habito: quem nao tem os atributos
        // ja esta pagando o preco, e cobrar de novo puniria duas vezes.
        return bruta > 0 ? Math.round(bruta * habito * 10) / 10 : bruta
      }
      const setor = SETOR_DA_POSICAO[atleta.position] ?? setorDaFuncao(String(role))
      const notaCom = notaDaFase(role)
      const notaSem = roleSemBola === role ? notaCom : notaDaFase(roleSemBola)
      const peso = PESO_COM_BOLA[setor]
      const nota = Math.round((notaCom * peso + notaSem * (1 - peso)) * 100) / 100
      porSetor[setor].push(nota)
      if (nota > 0.3) bem++
      else if (nota < -0.5) {
        // O aviso precisa dizer QUAL fase esta errada — "fora de funcao" sem
        // dizer se e com ou sem bola manda o tecnico procurar no lugar errado.
        const fase = roleSemBola === role ? null
          : notaCom < notaSem ? "com a bola" : "sem a bola"
        foraDeFuncao.push({ nome: atleta.name, nota, fase })
      }
    }
    const efeito = efeitoDasInstrucoes(instr)
    extras.attack += efeito.attack
    extras.defense += efeito.defense
    extras.midfield += efeito.midfield
    conflitos += efeito.conflitos
  }

  const media = (lista: number[]) =>
    lista.length ? lista.reduce((s, n) => s + n, 0) / lista.length : 0

  // O goleiro entra na defesa, como no calculo de forca do XI.
  const defesa = media([...porSetor.DEF, ...porSetor.GOL])
  const bruto = {
    attack: media(porSetor.ATA) + extras.attack,
    defense: defesa + extras.defense,
    midfield: media(porSetor.MEI) + extras.midfield,
  }

  // Ordem contraditoria custa: o atleta hesita em campo.
  const penalidade = conflitos * 0.4
  const limitar = (v: number) =>
    Math.round(Math.max(-TETO_INDIVIDUAL, Math.min(TETO_INDIVIDUAL, v - penalidade)) * 10) / 10

  const avisos: string[] = []
  for (const { nome, fase } of foraDeFuncao.sort((a, b) => a.nota - b.nota).slice(0, 3)) {
    avisos.push(fase
      ? `${nome} nao tem os atributos da funcao que recebeu ${fase}.`
      : `${nome} nao tem os atributos da funcao que recebeu.`)
  }
  if (conflitos > 0) {
    avisos.push(`${conflitos} atleta(s) com ordens que se anulam — decida uma.`)
  }

  return {
    attack: limitar(bruto.attack),
    defense: limitar(bruto.defense),
    midfield: limitar(bruto.midfield),
    bemEmpregados: bem,
    malEmpregados: foraDeFuncao.length,
    avisos,
  }
}

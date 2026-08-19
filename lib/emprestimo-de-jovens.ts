// EMPRÉSTIMO DE GAROTO DA BASE — como funciona na vida real.
//
// ⚠️ O QUE ISTO SUBSTITUI. A tela da base pedia o clube de destino num campo de
// TEXTO LIVRE ("Para qual clube o jovem vai jogar nesta temporada?") e o
// `loanYouth` do youth-engine só trocava o rótulo `fromTeam` para "Emprestado ao
// <texto>". Dava para digitar "Real Madrid" — ou "asdf" — e o garoto ficava
// emprestado a um clube que não existe, sem prazo, sem salário, sem volta e sem
// nenhum efeito no desenvolvimento dele.
//
// Empréstimo de base não é o técnico escolher: é o clube COLOCAR O ATLETA À
// DISPOSIÇÃO e esperar que alguém se interesse. Quem procura garoto emprestado é
// clube de divisão igual ou inferior que precisa de gente barata e tem jogo para
// oferecer — e o que ele negocia é minutagem, prazo e quanto do salário paga.
//
// As propostas são DETERMINÍSTICAS por atleta e semana: a mesma semana mostra
// sempre a mesma mesa de interessados (não dá para "rerrolar" saindo e voltando
// da tela), e a semana seguinte traz outra. É o mesmo princípio do resto do
// módulo de base — ver o comentário do id em lib/youth-academy.ts.

import { allBrazilianTeams, type Team } from "@/lib/teams-data"
import type { JovemBase } from "@/lib/youth-academy-rules"

/** Idade mínima para assinar e ser cedido. Abaixo disso o garoto só treina. */
export const IDADE_MINIMA_EMPRESTIMO = 16

/** Quanta bola o garoto vai ver no clube de destino. */
export type MinutagemProposta = "titular" | "rotacao" | "raro"

export const ROTULO_DA_MINUTAGEM: Record<MinutagemProposta, string> = {
  titular: "Titular",
  rotacao: "Rotação",
  raro: "Poucos minutos",
}

export interface PropostaDeEmprestimo {
  /** Estável por atleta + semana: serve de `key` na lista e de trava do aceite. */
  id: string
  clube: string
  curto: string
  fileKey: string
  divisao: string
  divisaoLabel: string
  prestigio: number
  /** Duração em semanas de calendário. */
  semanas: number
  minutagem: MinutagemProposta
  /** Percentual do salário que o clube de destino assume (0-100). */
  salarioCoberto: number
  /** Taxa paga ao clube formador. Costuma ser zero num garoto de base. */
  taxa: number
  /** Tem opção de compra ao fim do empréstimo? Só aparece em garoto cobiçado. */
  opcaoDeCompra: number | null
}

/** O empréstimo em andamento, gravado no próprio registro do jovem. */
export interface EmprestimoEmCurso {
  clube: string
  curto: string
  divisaoLabel: string
  minutagem: MinutagemProposta
  salarioCoberto: number
  taxa: number
  opcaoDeCompra: number | null
  /** Semana ABSOLUTA (temporada × 52 + semana) em que ele volta. */
  ateSemanaAbsoluta: number
  /** Semana absoluta em que saiu — para dizer há quanto tempo está fora. */
  desdeSemanaAbsoluta: number
}

const LABEL_DA_DIVISAO: Record<string, string> = {
  serie_a: "Série A",
  serie_b: "Série B",
  serie_c: "Série C",
  serie_d: "Série D",
}

export function rotuloDaDivisao(divisao: string): string {
  return LABEL_DA_DIVISAO[divisao] ?? "Divisão de acesso"
}

/**
 * Sorteio ESTÁVEL a partir de um texto (mulberry32 sobre um hash simples).
 *
 * `Math.random` não serve aqui: a lista de interessados seria outra a cada
 * render, e o técnico veria as propostas mudarem embaixo do dedo.
 */
function sorteioEstavel(semente: string): () => number {
  let h = 2166136261
  for (let i = 0; i < semente.length; i++) {
    h ^= semente.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  let estado = h >>> 0
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0
    let t = estado
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Quão pronto o garoto está para jogar fora. É o que decide se alguém liga.
 *
 * Overall pesa mais que potencial: quem empresta quer alguém que AJUDE agora.
 * O potencial entra como tempero — clube pequeno gosta de vitrine.
 */
function prontidao(j: JovemBase): number {
  const margem = Math.max(0, (j.potential ?? j.overall) - j.overall)
  return j.overall + Math.min(6, margem * 0.25)
}

export interface ContextoDeEmprestimo {
  /** Curto do clube do técnico — ele nunca aparece entre os interessados. */
  clubeDoTecnico: string
  /** Divisão do clube do técnico: ninguém empresta garoto para cima de graça. */
  divisaoDoTecnico: string
  prestigioDoTecnico: number
  /** Semana ABSOLUTA atual (temporada × 52 + semana). Semeia o sorteio. */
  semanaAbsoluta: number
}

/** Quanta bola o clube de destino tem para oferecer, dado o nível dele. */
function minutagemPara(j: JovemBase, clube: Team, rng: () => number): MinutagemProposta {
  // A distância entre o garoto e o nível do clube manda. Um moleque de 55 é
  // titular na Série D, rotação na C e reserva na B.
  const nivelDoClube = clube.prestigio
  const folga = prontidao(j) - nivelDoClube
  if (folga >= 8) return "titular"
  if (folga >= -4) return rng() < 0.65 ? "titular" : "rotacao"
  if (folga >= -14) return rng() < 0.6 ? "rotacao" : "raro"
  return "raro"
}

/**
 * OS CLUBES QUE VÊM BUSCAR o garoto nesta semana.
 *
 * Devolve lista vazia quando ninguém se interessou — é o caso mais comum com um
 * moleque cru, e é justamente isso que torna o empréstimo uma DECISÃO: o técnico
 * põe o atleta à disposição e espera.
 */
export function propostasDeEmprestimo(
  j: JovemBase,
  ctx: ContextoDeEmprestimo,
): PropostaDeEmprestimo[] {
  if (j.age < IDADE_MINIMA_EMPRESTIMO) return []

  const rng = sorteioEstavel(`emprestimo:${j.id}:${ctx.semanaAbsoluta}`)
  const nivel = prontidao(j)

  // Quem procura: clube brasileiro, não o do técnico, com prestígio ao alcance
  // do garoto. Clube muito acima não perde vaga com um moleque; clube muito
  // abaixo do nível dele não segura o salário nem a expectativa.
  const candidatos = allBrazilianTeams.filter(t =>
    t.curto !== ctx.clubeDoTecnico
    && !t.reserveTeamOf
    && t.prestigio <= ctx.prestigioDoTecnico + 4
    && t.prestigio <= nivel + 16
    && t.prestigio >= nivel - 30,
  )
  if (candidatos.length === 0) return []

  // Quantos aparecem. Garoto cru raramente atrai alguém; um que já joga atrai
  // uma pequena fila. O teto de 4 mantém a decisão legível.
  const atracao = Math.max(0, Math.min(1, (nivel - 44) / 26))
  const sorte = rng()
  const quantos = sorte < 0.42 - atracao * 0.34 ? 0
    : sorte < 0.80 - atracao * 0.28 ? 1
    : sorte < 0.95 - atracao * 0.10 ? 2
    : 3 + (rng() < atracao ? 1 : 0)
  if (quantos === 0) return []

  // Embaralha os candidatos com o MESMO sorteio (estável) e tira os primeiros.
  const baralho = [...candidatos]
  for (let i = baralho.length - 1; i > 0; i--) {
    const k = Math.floor(rng() * (i + 1))
    ;[baralho[i], baralho[k]] = [baralho[k], baralho[i]]
  }

  return baralho.slice(0, Math.min(quantos, baralho.length)).map((clube, indice) => {
    const minutagem = minutagemPara(j, clube, rng)
    // Prazo: meia temporada (~22 semanas) ou temporada inteira (~40). Clube que
    // promete titularidade costuma querer o ano todo.
    const semanas = minutagem === "titular"
      ? (rng() < 0.6 ? 40 : 22)
      : (rng() < 0.7 ? 22 : 40)
    // Salário: clube maior banca tudo; clube pequeno divide com o formador.
    const base = 45 + Math.round((clube.prestigio / Math.max(1, ctx.prestigioDoTecnico)) * 45)
    const salarioCoberto = Math.max(30, Math.min(100, base + Math.round(rng() * 20) - 10))
    // Taxa: quase sempre zero em garoto de base. Só aparece quando o clube
    // formador tem algo que o outro quer muito.
    const taxa = nivel >= 62 && rng() < 0.35
      ? Math.round((nivel - 55) * 12_000 * (0.6 + rng()))
      : 0
    // Opção de compra: só num garoto que já chamou atenção.
    const opcaoDeCompra = nivel >= 64 && rng() < 0.3
      ? Math.round(((j.value ?? nivel * 12_000) * (1.4 + rng() * 0.8)) / 50_000) * 50_000
      : null

    return {
      id: `emp:${j.id}:${ctx.semanaAbsoluta}:${clube.curto}:${indice}`,
      clube: clube.nome,
      curto: clube.curto,
      fileKey: clube.file_key,
      divisao: String(clube.divisao),
      divisaoLabel: rotuloDaDivisao(String(clube.divisao)),
      prestigio: clube.prestigio,
      semanas,
      minutagem,
      salarioCoberto,
      taxa,
      opcaoDeCompra,
    }
  })
}

export interface RetornoDoEmprestimo {
  ganho: number
  /** Frase pronta para a notificação de volta. */
  resumo: string
}

/**
 * O QUE O GAROTO TROUXE DE VOLTA.
 *
 * Empréstimo bom é o que dá JOGO: quem foi ser titular na Série C volta melhor
 * do que quem foi ficar no banco de um clube da Série B. O ganho respeita o
 * potencial — ninguém volta melhor do que pode ser.
 */
export function retornoDoEmprestimo(
  j: JovemBase,
  emprestimo: EmprestimoEmCurso,
  semanaAbsoluta: number,
  rng: () => number = Math.random,
): RetornoDoEmprestimo {
  const semanasJogadas = Math.max(0, Math.min(
    emprestimo.ateSemanaAbsoluta - emprestimo.desdeSemanaAbsoluta,
    semanaAbsoluta - emprestimo.desdeSemanaAbsoluta,
  ))
  const margem = Math.max(0, (j.potential ?? j.overall) - j.overall)
  if (margem <= 0 || semanasJogadas <= 0) {
    return { ganho: 0, resumo: `${j.name} voltou de ${emprestimo.clube} sem evolução mensurável.` }
  }

  const porMinutagem = emprestimo.minutagem === "titular" ? 1 : emprestimo.minutagem === "rotacao" ? 0.55 : 0.2
  // Uma temporada inteira jogando rende, no máximo, um salto de 5 pontos — e só
  // em quem tinha margem para tanto. Interromper cedo rende proporcionalmente.
  const bruto = (semanasJogadas / 40) * porMinutagem * 5 * (0.7 + rng() * 0.6)
  const ganho = Math.max(0, Math.min(Math.round(margem * 0.6), Math.round(bruto)))

  const tempo = semanasJogadas >= 34 ? "uma temporada inteira"
    : semanasJogadas >= 18 ? "meia temporada"
    : `${semanasJogadas} semana(s)`
  const papel = emprestimo.minutagem === "titular" ? "como titular"
    : emprestimo.minutagem === "rotacao" ? "na rotação" : "com poucos minutos"

  return {
    ganho,
    resumo: ganho > 0
      ? `${j.name} passou ${tempo} no ${emprestimo.clube} ${papel} e voltou +${ganho} de overall.`
      : `${j.name} passou ${tempo} no ${emprestimo.clube} ${papel} e voltou sem evolução: jogou pouco.`,
  }
}

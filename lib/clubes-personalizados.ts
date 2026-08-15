"use client"

/**
 * CLUBE PRÓPRIO — o jogador cria o seu clube do zero e dirige a carreira com ele.
 *
 * ⚠️ POR QUE ISTO NÃO É UM `TeamOverride`.
 *
 * `lib/team-overrides.ts` já sabe trocar nome, cores, escudo, uniformes,
 * estádio e prestígio — tudo o que um clube novo precisa. A tentação é grande, e
 * está errada: um override é uma EDIÇÃO de um `file_key` que já existe. Usar um
 * override para "criar" um clube significaria escolher um clube real qualquer e
 * apagá-lo por cima — o Cariacica do jogador nasceria ocupando a vaga (e o
 * elenco, e a história) de um clube de verdade, que sumiria do jogo.
 *
 * Por isso o clube próprio é uma entidade nova, com `file_key` próprio, e o
 * override continua sendo o que sempre foi. Quem quer RENOMEAR um clube existente
 * continua usando o editor.
 *
 * ⚠️ A HIDRATAÇÃO É ASSÍNCRONA, E `teams-data` É SÍNCRONO.
 *
 * As listas de `lib/teams-data.ts` são montadas na CARGA DO MÓDULO; o
 * persistent-store lê o arquivo depois. Um clube criado não pode, portanto,
 * entrar em `allTeams` — no primeiro render ele ainda não existe. O caminho é o
 * mesmo que a pirâmide viva já usa: um registro mutável em `teams-data`
 * (`setClubesPersonalizados`) alimentado quando o store avisa que ficou pronto,
 * e as telas revisando em `ultrafoot:store:ready`.
 *
 * Ver [[lib/beneficios]] — criar clube é benefício de quem registrou o jogo, e o
 * portão fica na TELA, nunca aqui: um save que já tem clube próprio continua
 * jogável mesmo que o registro saia, pela regra da casa de "só benefício, nunca
 * trava".
 */

import { storeGet, storeSet } from "@/lib/persistent-store"
import { guardarImagem, resolverImagem } from "@/lib/banco-de-imagens"
import type { KitData } from "@/lib/team-overrides"

const KEY = "ultrafoot:clubes-personalizados"

/** Prefixo do `file_key`. Serve de sentinela: nenhum clube real começa assim. */
export const PREFIXO_CLUBE_PROPRIO = "meuclube_"

export interface ClubePersonalizado {
  /** `meuclube_<slug>`. Estável — é a identidade do clube no save e no escudo. */
  fileKey: string
  nome: string
  /** Código curto usado em tabela, placar e escudo. Único entre todos os clubes. */
  curto: string
  cidade: string
  /** UF. Define a região na Divisão de Acesso e o campeonato estadual. */
  estado: string
  cor1: string
  cor2: string
  divisao: string
  estadioNome: string
  estadioCap: number
  /** Referência `uf-img:` do escudo, nunca o base64 (ver o aviso abaixo). */
  logoUrl?: string
  kits?: { home?: KitData; away?: KitData; third?: KitData }
  /** Quando foi criado, em ISO. Só para ordenar a lista na tela. */
  criadoEm: string
}

/**
 * O prestígio de um clube criado NÃO é escolhido pelo jogador.
 *
 * Deixar o campo aberto seria oferecer um seletor de dificuldade disfarçado de
 * identidade visual: prestígio move orçamento, valor de mercado, quem aceita
 * proposta e a força dos rivais gerados. Um clube novo entra pelo piso da
 * divisão que escolheu — é o que "começar do zero" quer dizer.
 */
// ⚠️ Os numeros acompanham o PISO MEDIDO de cada divisao (acesso 6, D 10, C 16,
// B 19, A 43). `scripts/test-clube-proprio.ts` compara os dois e falha se algum
// clube novo nascer acima do lanterna da propria divisao — foi assim que a
// Serie B foi pega valendo 22 contra um piso de 19.
export const PRESTIGIO_POR_DIVISAO: Record<string, number> = {
  divisao_acesso_br: 8,
  serie_d: 12,
  serie_c: 18,
  serie_b: 20,
  serie_a: 45,
}

export function prestigioDeClubeNovo(divisao: string): number {
  return PRESTIGIO_POR_DIVISAO[divisao] ?? 10
}

/** Divisões em que um clube próprio pode nascer, do mais fácil ao mais difícil. */
export const DIVISOES_PARA_CLUBE_PROPRIO: readonly { id: string; rotulo: string; nota: string }[] = [
  { id: "divisao_acesso_br", rotulo: "Divisão de Acesso", nota: "A base da pirâmide. Quatro degraus até a Série A." },
  { id: "serie_d", rotulo: "Série D", nota: "Quarta divisão nacional." },
  { id: "serie_c", rotulo: "Série C", nota: "Terceira divisão nacional." },
  { id: "serie_b", rotulo: "Série B", nota: "Segunda divisão nacional." },
  { id: "serie_a", rotulo: "Série A", nota: "A elite. O clube nasce como o mais fraco dela." },
]

function ler(): ClubePersonalizado[] {
  try {
    const cru = storeGet(KEY)
    if (!cru) return []
    const lista = JSON.parse(cru)
    return Array.isArray(lista) ? (lista as ClubePersonalizado[]) : []
  } catch {
    // Registro corrompido não pode derrubar a tela de nova carreira: sem clube
    // próprio o jogo inteiro continua jogável.
    return []
  }
}

function gravar(lista: ClubePersonalizado[]): void {
  storeSet(KEY, JSON.stringify(lista))
}

/** Todos os clubes criados nesta instalação, do mais novo para o mais antigo. */
export function listarClubesPersonalizados(): ClubePersonalizado[] {
  return ler().sort((a, b) => (b.criadoEm ?? "").localeCompare(a.criadoEm ?? ""))
}

export function getClubePersonalizado(fileKey: string): ClubePersonalizado | null {
  return ler().find(c => c.fileKey === fileKey) ?? null
}

export function ehClubeProprio(fileKey: string | undefined): boolean {
  return Boolean(fileKey?.startsWith(PREFIXO_CLUBE_PROPRIO))
}

/** Nome -> `meuclube_<slug>`, sem acento e sem colidir com o que já existe. */
export function chaveDoClubeProprio(nome: string, jaUsadas: Iterable<string>): string {
  const base = nome
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "clube"
  const usadas = new Set(jaUsadas)
  let chave = `${PREFIXO_CLUBE_PROPRIO}${base}`
  let n = 2
  while (usadas.has(chave)) { chave = `${PREFIXO_CLUBE_PROPRIO}${base}${n}`; n++ }
  return chave
}

/**
 * Grava o clube. As imagens (escudo e uniformes) entram no BANCO DE IMAGENS e o
 * registro guarda só a referência `uf-img:`.
 *
 * ⚠️ Isto não é organização — é o que impede o save de estourar. Um escudo em
 * base64 dentro do registro já custou a cota de armazenamento uma vez
 * ([[ultrafoot-imagens-pesando-no-save]]); com três uniformes mais o escudo por
 * clube, o registro cresceria alguns MB por clube criado.
 */
export async function salvarClubePersonalizado(clube: ClubePersonalizado): Promise<ClubePersonalizado> {
  const guardado: ClubePersonalizado = { ...clube }

  if (clube.logoUrl?.startsWith("data:")) {
    guardado.logoUrl = (await guardarImagem(clube.logoUrl)) ?? undefined
  }
  if (clube.kits) {
    const kits: ClubePersonalizado["kits"] = {}
    for (const variante of ["home", "away", "third"] as const) {
      const kit = clube.kits[variante]
      if (!kit) continue
      kits[variante] = kit.imageUrl?.startsWith("data:")
        ? { ...kit, imageUrl: (await guardarImagem(kit.imageUrl)) ?? undefined }
        : kit
    }
    guardado.kits = kits
  }

  const lista = ler().filter(c => c.fileKey !== guardado.fileKey)
  lista.push(guardado)
  gravar(lista)
  return guardado
}

export function excluirClubePersonalizado(fileKey: string): void {
  gravar(ler().filter(c => c.fileKey !== fileKey))
}

/** O clube com as imagens já resolvidas para exibição (`uf-img:` -> data URL). */
export function comImagensResolvidas(clube: ClubePersonalizado): ClubePersonalizado {
  const kits: ClubePersonalizado["kits"] = {}
  for (const variante of ["home", "away", "third"] as const) {
    const kit = clube.kits?.[variante]
    if (!kit) continue
    kits[variante] = { ...kit, imageUrl: resolverImagem(kit.imageUrl) ?? kit.imageUrl }
  }
  return {
    ...clube,
    logoUrl: resolverImagem(clube.logoUrl) ?? clube.logoUrl,
    kits: clube.kits ? kits : undefined,
  }
}

/**
 * VALIDAÇÃO — devolve a lista de problemas, vazia quando pode salvar.
 *
 * `curto` é conferido contra os clubes que já existem porque ele é CHAVE de
 * tabela, de resultado e de escudo. Dois clubes com o mesmo código não geram
 * erro: eles se sobrepõem em silêncio na classificação, que é o pior resultado
 * possível.
 */
export function validarClubeProprio(
  clube: Pick<ClubePersonalizado, "nome" | "curto" | "estado" | "estadioCap">,
  curtosEmUso: Iterable<string>,
): string[] {
  const problemas: string[] = []
  const nome = clube.nome.trim()
  const curto = clube.curto.trim().toUpperCase()

  if (nome.length < 3) problemas.push("O nome precisa de pelo menos 3 letras.")
  if (nome.length > 28) problemas.push("O nome passa de 28 letras e seria cortado na tabela.")
  if (!/^[A-Z0-9]{2,8}$/.test(curto)) problemas.push("O código curto usa de 2 a 8 letras ou números, sem espaço.")
  else if (new Set([...curtosEmUso].map(c => c.toUpperCase())).has(curto)) {
    problemas.push(`O código ${curto} já pertence a outro clube. Escolha outro.`)
  }
  if (!clube.estado) problemas.push("Escolha o estado — é ele que define a região e o campeonato estadual.")
  if (!Number.isFinite(clube.estadioCap) || clube.estadioCap < 500 || clube.estadioCap > 100000) {
    problemas.push("A capacidade do estádio vai de 500 a 100.000 lugares.")
  }
  return problemas
}

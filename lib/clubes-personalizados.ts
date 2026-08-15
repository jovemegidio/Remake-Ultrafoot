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
  /**
   * País do clube, como escrito nas pirâmides (`Brasil`, `Alemanha`, `Russia`).
   * É ele que decide quais divisões estão disponíveis e de onde vêm os rivais.
   */
  pais: string
  /**
   * UF (Brasil) ou região/província (resto do mundo). Vazio é aceito fora do
   * Brasil: 30 clubes do próprio acervo não têm região, e exigir o campo
   * inventaria um dado que o jogo não tem.
   */
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
/**
 * ⚠️ A FORÇA DO CLUBE NOVO É MEDIDA, NÃO TABELADA.
 *
 * A primeira versão era um mapa fixo com as cinco divisões brasileiras. Isso
 * parou de servir no instante em que treze países ganharam pirâmide completa:
 * um clube criado na Regionalliga alemã pegaria o `?? 10` do fallback e nasceria
 * com a força de um clube de Série D brasileira, num país cuja base vai a 86.
 *
 * A regra é a mesma de sempre neste projeto: antes de escrever um número de
 * força, importe a escala que o jogo já usa. Aqui a escala é o PISO da divisão
 * escolhida — "o clube nasce como o mais fraco dela" é exatamente o que
 * "começar do zero" quer dizer, e vale em qualquer país.
 *
 * `scripts/test-clube-proprio.ts` confere que nenhum clube novo nasce acima do
 * lanterna da própria divisão. Foi assim que a Série B foi pega valendo 22
 * contra um piso de 19.
 */
export function prestigioDeClubeNovo(divisao: string, pisoDaDivisao?: number): number {
  if (typeof pisoDaDivisao === "number" && pisoDaDivisao > 0) return pisoDaDivisao
  // Sem o piso em mãos (chamadas de UI antes de os dados hidratarem), um valor
  // baixo e neutro. Nunca alto: um palpite para cima daria ao clube criado uma
  // vantagem invisível sobre os rivais da própria divisão.
  return 8
}

/**
 * PAÍSES onde um clube próprio pode nascer.
 *
 * São os que têm Divisão de Acesso — ou seja, uma pirâmide COMPLETA, da base ao
 * topo. Oferecer um país sem base faria o clube nascer já na segunda ou terceira
 * divisão, sem o "começar do zero" que é o ponto do recurso.
 *
 * ⚠️ A grafia tem de ser a das PIRÂMIDES (`Russia`, `Franca`, `Holanda`, sem
 * acento), e não a do pool (`Rússia`, `França`, `Países Baixos`). São duas bases
 * com escritas diferentes, e o `_paisCanonico` só reconcilia no lado do jogo.
 */
export const PAISES_PARA_CLUBE_PROPRIO: readonly { pais: string; rotulo: string; ufs?: readonly string[] }[] = [
  {
    pais: "Brasil", rotulo: "Brasil",
    ufs: ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"],
  },
  { pais: "Argentina", rotulo: "Argentina" },
  { pais: "Chile", rotulo: "Chile" },
  { pais: "Alemanha", rotulo: "Alemanha" },
  { pais: "Franca", rotulo: "França" },
  { pais: "Italia", rotulo: "Itália" },
  { pais: "Espanha", rotulo: "Espanha" },
  { pais: "Portugal", rotulo: "Portugal" },
  { pais: "Holanda", rotulo: "Países Baixos" },
  { pais: "Belgica", rotulo: "Bélgica" },
  { pais: "Turquia", rotulo: "Turquia" },
  { pais: "Russia", rotulo: "Rússia" },
  { pais: "China", rotulo: "China" },
]

/**
 * ESTABILIDADE FINANCEIRA DE SEGUNDA DIVISÃO, sempre.
 *
 * Decisão do usuário (15/08/2026): o clube criado nasce fraco em CAMPO, mas com
 * as contas de um clube de Série B — não importa a divisão escolhida.
 *
 * ⚠️ Isto separa de propósito duas coisas que o jogo mistura em todo lugar:
 * `prestigio` (força do elenco, que decide adversário e valor de mercado) e
 * CAIXA (que decide se você sobrevive à temporada). Um clube novo sem dinheiro
 * na base da pirâmide não é desafio, é beco: sem caixa não há contratação, sem
 * contratação não há acesso, e a carreira morre na primeira janela.
 *
 * O número sai do catálogo, nunca inventado — é a média de `saldo` dos clubes de
 * Série B, calculada em `saldoDeClubeNovo`. Escrever um valor fixo aqui seria a
 * quarta aparição do defeito "duas escalas para a mesma grandeza".
 */
export const DIVISAO_DE_REFERENCIA_FINANCEIRA = "serie_b"

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
  clube: Pick<ClubePersonalizado, "nome" | "curto" | "estado" | "estadioCap"> & { pais?: string },
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

  const pais = clube.pais ?? "Brasil"
  const entrada = PAISES_PARA_CLUBE_PROPRIO.find(p => p.pais === pais)
  if (!entrada) problemas.push("Escolha um país com pirâmide completa.")
  // ⚠️ A UF só é obrigatória onde ela EXISTE como dado. Exigir "estado" da
  // Alemanha inventaria um campo que o jogo não tem para nenhum clube alemão —
  // e a região só é usada para montar a tabela da base, que degrada para
  // "sem proximidade" sem quebrar nada.
  else if (entrada.ufs && !entrada.ufs.includes(clube.estado)) {
    problemas.push("Escolha o estado — é ele que define a região e o campeonato estadual.")
  }

  if (!Number.isFinite(clube.estadioCap) || clube.estadioCap < 500 || clube.estadioCap > 100000) {
    problemas.push("A capacidade do estádio vai de 500 a 100.000 lugares.")
  }
  return problemas
}

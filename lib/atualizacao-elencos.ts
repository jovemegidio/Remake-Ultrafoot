"use client"

// ATUALIZAÇÃO DE ELENCOS PELO SERVIDOR — o "squad update" do EA FC.
//
// O problema que isto resolve: elenco, escudo, uniforme e liga viajavam APENAS
// dentro do build. Corrigir uma transferência ou um escudo exigia publicar o
// jogo inteiro (meio giga) e esperar todo mundo atualizar. Agora um arquivo de
// poucos KB no servidor faz o mesmo, e o jogador recebe ao abrir o jogo.
//
// AS TRÊS CAMADAS, nesta ordem de prioridade:
//
//   1. LOCAL     — o que o jogador editou na máquina dele. Sempre vence: uma
//                  atualização nossa não pode apagar o trabalho de quem edita.
//   2. SERVIDOR  — este arquivo. Mais novo que o build, chega sem reinstalar.
//   3. EMBUTIDO  — o seed que saiu no build. É o piso, e o que faz o jogo
//                  funcionar offline e na primeira execução.
//
// O download é sempre BEST-EFFORT: sem internet, o jogo abre com o que já tem.
// Nada aqui pode bloquear o boot.
//
// NADA É APLICADO SEM O JOGADOR MANDAR. A consulta ao servidor apenas OLHA; quem
// grava é `aplicarAtualizacao`, e ela só roda quando o jogador clica em Baixar no
// aviso (components/aviso-atualizacao-elencos). Quem não quiser nem a consulta
// desliga o canal em Personalizar > Atualizações — os interruptores vivem em
// lib/atualizacoes-preferencias e são consultados em cada leitura aqui embaixo.
//
// A VERSÃO DO PACOTE É INDEPENDENTE DA VERSÃO DO JOGO, de propósito: é isso que
// permite corrigir um elenco sem publicar meio giga de instalador. Quem cuida de
// os dois não se atropelarem é `maisNovoQueOBuild`, logo abaixo.

import { storeGet, storeSet } from "@/lib/persistent-store"
import { buscarJson } from "@/lib/buscar-json"
import { canalAtivo } from "@/lib/atualizacoes-preferencias"
import type { TeamOverride } from "@/lib/team-overrides"
import type { PlayerOverride } from "@/lib/player-overrides"

const CHAVE = "ultrafoot:atualizacao-elencos"
/** Versao que o jogador mandou nao oferecer de novo. */
const CHAVE_DISPENSADA = "ultrafoot:atualizacao-elencos:dispensada"

// A VPS primeiro; o GitHub e reserva para quando ela estiver fora do ar.
const FONTES = [
  "https://ultrafoot.179-198-103-30.sslip.io/atualizacoes/elencos.json",
  "https://github.com/jovemegidio/Ultrafoot26/releases/download/elencos/elencos.json",
]

/** Quando ESTE build foi feito (epoch em segundos). Ver next.config.mjs. */
const SELO_DO_BUILD = Number(process.env.NEXT_PUBLIC_SELO_DO_BUILD ?? 0)

/**
 * ⚠️ A TRAVA QUE PERMITE ESTE CANAL EXISTIR — nao remover sem ler isto.
 *
 * O canal foi desligado inteiro na 1.0.240 por uma falha real: o pacote gravado
 * no disco valia para SEMPRE. Quem baixasse elencos na 1.0.230 e atualizasse o
 * jogo continuava com aquele pacote sobrescrevendo o elenco da build nova — com
 * dados mais VELHOS do que os do proprio build, e sem ninguem para corrigi-lo.
 *
 * Comparar a versao do pacote com a versao do jogo NAO resolve: sao numeracoes
 * independentes de proposito (e justamente isso que deixa a correcao de elenco
 * sair sem mexer na versao do jogo). Comparar DATAS resolve, e e demonstravel:
 * um pacote publicado depois deste build so pode conhecer o que este build ja
 * conhece, e mais. Publicado antes, o build sabe pelo menos tanto quanto ele.
 *
 * Efeito pratico: ao atualizar o jogo, um pacote velho para de valer sozinho e o
 * aviso reaparece oferecendo o pacote atual do servidor. Quem estiver offline
 * joga com o seed do build, que e mais novo — nunca com dado pior.
 */
function maisNovoQueOBuild(a: AtualizacaoElencos): boolean {
  // Build sem selo (dev server, teste unitario): nao trava nada.
  if (!SELO_DO_BUILD) return true
  return (a.publicado_em ?? 0) > SELO_DO_BUILD
}

/** Um atleta que mudou de clube depois do lançamento do build. */
export interface TransferenciaOficial {
  /** Nome do atleta como aparece no elenco de origem. */
  nome: string
  /** Nome do clube de ORIGEM (mesmo texto de `team.nome`). Vazio = chegada sem saída. */
  de?: string
  /** Nome do clube de DESTINO. Vazio = saiu do futebol coberto pelo jogo. */
  para?: string
  pos?: string
  idade?: number
  base?: number
  nac?: string
}

export interface AtualizacaoElencos {
  /** Inteiro crescente. É por ele que decidimos se o que chegou é mais novo. */
  versao: number
  publicado_em?: number
  notas?: string
  /** Edições de clube: escudo, uniforme, cores, estádio. */
  times?: Record<string, TeamOverride>
  /** Edições de atleta, na mesma chave de player-overrides: `fileKey__nomenormalizado`. */
  jogadores?: Record<string, PlayerOverride>
  /** Quem mudou de clube. */
  transferencias?: TransferenciaOficial[]
  /** Ligas: pote/participantes corrigidos, por nome de competição. */
  ligas?: Record<string, { clubes?: string[] }>
}

const VAZIA: AtualizacaoElencos = { versao: 0 }


// Memoriza o pacote JÁ PARSEADO, indexado pelo texto de onde ele veio.
//
// ⚠️ Nunca guardar resultado NEGATIVO: `storeGet` lê de um cache em memória que
// só existe depois de `initPersistentStore`, e no Tauri isso é assíncrono. Um
// `cache = VAZIA` gravado antes da hidratação congelaria o canal desligado pelo
// resto da sessão — a mesma armadilha do efeito que grava antes de hidratar.
let cache: { bruto: string; valor: AtualizacaoElencos } | null = null

/**
 * O que já está na máquina. Leitura SÍNCRONA de propósito: quem chama são as
 * funções de override, no meio da montagem do elenco — um await ali obrigaria a
 * reescrever meia dezena de caminhos que hoje são síncronos.
 */
export function getAtualizacao(): AtualizacaoElencos {
  if (typeof window === "undefined") return VAZIA
  const bruto = storeGet(CHAVE)
  if (!bruto) return VAZIA
  if (cache?.bruto === bruto) return cache.valor
  let valor = VAZIA
  try {
    const lido = JSON.parse(bruto) as AtualizacaoElencos
    // O pacote continua gravado mesmo quando não vale: ele volta a valer sozinho
    // se um dia for republicado, e apagá-lo só criaria download desnecessário.
    if (lido && typeof lido.versao === "number" && maisNovoQueOBuild(lido)) valor = lido
  } catch { /* pacote corrompido: o build assume */ }
  cache = { bruto, valor }
  return valor
}

export function versaoAtualizacao(): number {
  return getAtualizacao().versao
}


/**
 * Le o que o servidor publicou SEM gravar nada.
 *
 * É a metade "conferir" da atualização: a tela de Atualizações mostra o que
 * chegaria — versão, notas e quantos clubes/atletas — e só grava depois que o
 * jogador manda aplicar. Devolve null sem consentimento ou sem rede.
 */
export async function consultarServidor(): Promise<AtualizacaoElencos | null> {
  if (typeof window === "undefined") return null
  // Canal desligado nas preferências: nem a consulta sai da máquina.
  if (!canalAtivo("elencos") && !canalAtivo("times")) return null
  for (const url of FONTES) {
    const lido = await buscarJson<AtualizacaoElencos>(url, 8000)
    if (!lido || typeof lido.versao !== "number") continue
    // Um pacote anterior a este build não tem o que acrescentar: oferecê-lo seria
    // um convite para PIORAR o elenco. Ver `maisNovoQueOBuild`.
    if (!maisNovoQueOBuild(lido)) return null
    return lido
  }
  return null
}

/**
 * Grava uma atualização já baixada.
 *
 * DESLIGADO NA 1.0.240: ninguém mais chega aqui com conteúdo, porque
 * `consultarServidor` não traz nada. Continua existindo — e continua gravando —
 * para o dia em que o canal voltar; o que NÃO pode voltar por engano é a
 * gravação passar a valer sem `getAtualizacao` voltar junto.
 */
export function aplicarAtualizacao(nova: AtualizacaoElencos): number {
  if (typeof window === "undefined") return 0
  if (!nova || nova.versao <= getAtualizacao().versao) return 0

  storeSet(CHAVE, JSON.stringify(nova))
  window.dispatchEvent(
    new CustomEvent("ultrafoot:elencos:atualizados", { detail: { versao: nova.versao } }),
  )
  return nova.versao
}

/**
 * Procura atualização e guarda se for mais nova. Chamado no boot.
 *
 * Devolve a versão aplicada (0 = nada novo), para a interface avisar o jogador.
 *
 * SEM CONSENTIMENTO NÃO CONECTA — e não há parâmetro para contornar isso. A
 * tela de Atualizações pede a autorização ANTES de chamar qualquer coisa daqui,
 * então quando esta função roda o jogador já disse sim.
 */
export async function baixarAtualizacao(): Promise<number> {
  if (typeof window === "undefined") return 0
  const nova = await consultarServidor()
  if (!nova) return 0
  return aplicarAtualizacao(nova)
}

/** Quanto conteúdo há em cada seção — o que a tela mostra como "o que vem aí". */
export interface ResumoAtualizacao {
  clubes: number
  jogadores: number
  transferencias: number
  competicoes: number
  /** Quantos atletas vêm com retrato — o que o jogador mais percebe na tela. */
  fotos: number
}

export function resumir(a: AtualizacaoElencos | null): ResumoAtualizacao {
  return {
    clubes: Object.keys(a?.times ?? {}).length,
    jogadores: Object.keys(a?.jogadores ?? {}).length,
    transferencias: (a?.transferencias ?? []).length,
    competicoes: Object.keys(a?.ligas ?? {}).length,
    fotos: Object.values(a?.jogadores ?? {}).filter(j => j.faceDataUrl).length,
  }
}

/**
 * As seções que cada canal consome. Usado para dizer, por canal, se o que está
 * no servidor é diferente do que já está na máquina.
 *
 * O manifesto é um só e tem uma só `versao` — sem isto, uma publicação que
 * mexeu apenas em escudos apareceria como "elencos: atualização disponível" e
 * aplicá-la não mudaria atleta nenhum.
 */
function secaoDoCanal(a: AtualizacaoElencos | null, canal: "elencos" | "times"): string {
  if (!a) return ""
  return canal === "elencos"
    ? JSON.stringify({ j: a.jogadores ?? {}, t: a.transferencias ?? [] })
    : JSON.stringify({ t: a.times ?? {}, l: a.ligas ?? {} })
}

/**
 * true = este canal traz conteúdo diferente do que já está gravado E o pacote
 * pode mesmo ser aplicado.
 *
 * A trava de versão entra aqui também de propósito: sem ela, um pacote com
 * `versao` igual ou menor e conteúdo diferente (rollback no servidor) apareceria
 * como "atualização disponível", e o botão de aplicar seria recusado por
 * aplicarAtualizacao — um botão que não faz nada, para sempre. Só oferecemos o
 * que dá para instalar.
 */
export function canalTemNovidade(servidor: AtualizacaoElencos | null, canal: "elencos" | "times"): boolean {
  if (!servidor || servidor.versao <= getAtualizacao().versao) return false
  return secaoDoCanal(servidor, canal) !== secaoDoCanal(getAtualizacao(), canal)
}

// ─── Consultas usadas pelas camadas de override ──────────────────────────────

// Cada consulta passa pelo canal correspondente: desligar "times" em
// Atualizações faz o jogo voltar a enxergar o escudo/uniforme do build sem
// apagar nada do que ja foi baixado — religar devolve tudo na hora.

export function timeDoServidor(fileKey: string): TeamOverride | null {
  if (!canalAtivo("times")) return null
  return getAtualizacao().times?.[fileKey] ?? null
}

export function jogadorDoServidor(chave: string): PlayerOverride | null {
  if (!canalAtivo("elencos")) return null
  return getAtualizacao().jogadores?.[chave] ?? null
}

/**
 * Índice de transferências por clube, montado uma vez.
 *
 * Sem o índice, cada montagem de elenco varreria a lista inteira duas vezes —
 * e getPlayersForTeam roda em tela de tabela, com dezenas de clubes.
 */
let indice: { versao: number; saidas: Map<string, Set<string>>; chegadas: Map<string, TransferenciaOficial[]> } | null = null

function indexar() {
  const at = getAtualizacao()
  if (indice && indice.versao === at.versao) return indice
  const saidas = new Map<string, Set<string>>()
  const chegadas = new Map<string, TransferenciaOficial[]>()
  for (const t of at.transferencias ?? []) {
    if (t.de) {
      const chave = t.de.toLowerCase()
      if (!saidas.has(chave)) saidas.set(chave, new Set())
      saidas.get(chave)!.add((t.nome ?? "").toLowerCase())
    }
    if (t.para) {
      const chave = t.para.toLowerCase()
      if (!chegadas.has(chave)) chegadas.set(chave, [])
      chegadas.get(chave)!.push(t)
    }
  }
  indice = { versao: at.versao, saidas, chegadas }
  return indice
}

/** true = este atleta saiu deste clube na atualização oficial. */
export function saiuDoClube(nomeClube: string, nomeAtleta: string): boolean {
  if (!canalAtivo("elencos")) return false
  const i = indexar()
  if (i.saidas.size === 0) return false
  return i.saidas.get((nomeClube ?? "").toLowerCase())?.has((nomeAtleta ?? "").toLowerCase()) ?? false
}

/** Atletas que CHEGARAM a este clube na atualização oficial. */
export function chegouAoClube(nomeClube: string): TransferenciaOficial[] {
  if (!canalAtivo("elencos")) return []
  const i = indexar()
  if (i.chegadas.size === 0) return []
  return i.chegadas.get((nomeClube ?? "").toLowerCase()) ?? []
}

export function temTransferencias(): boolean {
  if (!canalAtivo("elencos")) return false
  const i = indexar()
  return i.saidas.size > 0 || i.chegadas.size > 0
}

/** Participantes corrigidos de uma competição, se a atualização trouxer. */
export function clubesDaLigaNoServidor(competicao: string): string[] | null {
  if (!canalAtivo("times")) return null
  return getAtualizacao().ligas?.[competicao]?.clubes ?? null
}

// ─── Retratos publicados pelo servidor ───────────────────────────────────────
//
// POR QUE ESTE ÍNDICE EXISTE, se o retrato já chega dentro de `jogadores`:
//
// a chave do manifesto é `fileKey__nome` (o clube junto), mas `getPlayerPhotoUrl`
// — a função que TODO `PlayerAvatar` usa — recebe só o nome. Foi exatamente esse
// descasamento que fez a importação dos rostos do DF11 parecer pronta e aparecer
// vazia na tela. Aqui o índice é por nome, e o clube some.
//
// XARÁS: nome repetido em clubes diferentes, com retratos diferentes, fica de
// FORA. A silhueta é melhor do que o rosto de outra pessoa — mesma regra que a
// importação de rostos já seguia (178 xarás excluídos lá).

let indiceFotos: { versao: number; porNome: Map<string, string> } | null = null

/** Mesma normalização de `normPlayerName` (player-overrides), sem importá-la: o
 *  import criaria ciclo, porque player-overrides já depende deste módulo. */
function normalizarNome(nome: string): string {
  return (nome ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

function indexarFotos(): Map<string, string> {
  const at = getAtualizacao()
  if (indiceFotos && indiceFotos.versao === at.versao) return indiceFotos.porNome
  const porNome = new Map<string, string>()
  const ambiguos = new Set<string>()
  for (const [chave, jogador] of Object.entries(at.jogadores ?? {})) {
    const url = jogador.faceDataUrl
    if (!url) continue
    // `fileKey__nome`: o nome é tudo depois do primeiro separador duplo.
    const corte = chave.indexOf("__")
    const nome = corte >= 0 ? chave.slice(corte + 2) : chave
    if (!nome) continue
    const anterior = porNome.get(nome)
    if (anterior && anterior !== url) { ambiguos.add(nome); continue }
    porNome.set(nome, url)
  }
  for (const nome of ambiguos) porNome.delete(nome)
  indiceFotos = { versao: at.versao, porNome }
  return porNome
}

/**
 * Retrato publicado para este atleta, ou null.
 *
 * Consultado por `getPlayerPhotoUrl` DEPOIS da edição local (o trabalho de quem
 * edita na própria máquina sempre vence) e ANTES do manifesto embutido.
 *
 * A cópia GUARDADA vence a URL remota: é ela que faz o retrato aparecer sem
 * internet. Enquanto o download não termina, a remota atende.
 */
export function fotoDoServidor(nome: string, fileKey?: string): string | null {
  if (!canalAtivo("elencos")) return null
  const chave = normalizarNome(nome)
  if (!chave) return null

  // ⚠️ COM O CLUBE, NAO HA AMBIGUIDADE.
  //
  // A chave publicada e `fileKey__nome`. Quando quem chama sabe o clube, a busca
  // e EXATA e o xara deixa de ser problema: o "Carlos Miguel" do Palmeiras e o do
  // Benfica B sao chaves diferentes. E so quando o clube e desconhecido que vale
  // a trava de nome repetido (getNomesAmbiguos, em player-photos).
  //
  // ⚠️ E QUANDO NAO ACHA, PARA AQUI. Nao cair no indice por nome e o ponto:
  // "subi o Bruno do Flamengo, entao e do Flamengo e nao de outro time". Se este
  // clube nao publicou rosto para este atleta, ele NAO TEM rosto — pegar o do
  // xara de outro time foi exatamente o relato (Bruno Henrique, Paulinho).
  if (fileKey) {
    const exata = getAtualizacao().jogadores?.[`${fileKey}__${chave}`]?.faceDataUrl
    return exata ? (fotosGuardadas().get(chave) ?? exata) : null
  }
  const guardada = fotosGuardadas().get(chave)
  if (guardada) return guardada
  const mapa = indexarFotos()
  return mapa.size === 0 ? null : mapa.get(chave) ?? null
}

// ─── Cópia local dos retratos (para funcionar SEM internet) ──────────────────
//
// O manifesto já fica gravado no disco, então elenco, transferência e escudo
// funcionam offline assim que o pacote é aplicado. A FOTO não: ela viaja como
// URL remota (é o que evitou o seed de 30 MB em base64). Sem esta cópia, o rosto
// aparecia com internet e sumia sem ela — "atualizou" pela metade.
//
// Guardadas num ÚNICO valor, gravado uma vez só no fim: são 59 retratos hoje, e
// 59 gravações separadas fariam o persistent-store reescrever o arquivo inteiro
// 59 vezes.

const CHAVE_FOTOS = "ultrafoot:atualizacao-fotos"

/**
 * Teto da cópia local. Acima disto o retrato continua funcionando ONLINE, pela
 * URL remota — só não fica guardado. O limite existe porque `storeSet` espelha em
 * `localStorage`, que estoura por volta de 5–10 MB (e na versão web ele é o
 * único armazenamento que existe).
 */
const TETO_FOTOS_BYTES = 8 * 1024 * 1024

let cacheFotos: { bruto: string; mapa: Map<string, string> } | null = null

function fotosGuardadas(): Map<string, string> {
  if (typeof window === "undefined") return new Map()
  const bruto = storeGet(CHAVE_FOTOS)
  if (!bruto) return new Map()
  if (cacheFotos?.bruto === bruto) return cacheFotos.mapa
  let mapa = new Map<string, string>()
  try {
    mapa = new Map(Object.entries(JSON.parse(bruto) as Record<string, string>))
  } catch { /* corrompido: volta a valer a URL remota */ }
  cacheFotos = { bruto, mapa }
  return mapa
}

function paraDataUrl(bytes: ArrayBuffer, tipo: string): string {
  const b = new Uint8Array(bytes)
  let binario = ""
  // Em blocos: `String.fromCharCode(...array)` estoura a pilha num PNG de 100 KB.
  for (let i = 0; i < b.length; i += 0x8000) {
    binario += String.fromCharCode(...b.subarray(i, i + 0x8000))
  }
  return `data:${tipo || "image/png"};base64,${btoa(binario)}`
}

/**
 * Baixa e guarda os retratos do pacote. Best-effort: o que falhar continua
 * funcionando online, e nada aqui pode atrapalhar o que já foi aplicado.
 *
 * Chamada DEPOIS de `aplicarAtualizacao` — o elenco já vale antes de a primeira
 * foto chegar.
 */
export async function guardarFotosLocalmente(
  pacote: AtualizacaoElencos,
  aoProgredir?: (feitas: number, total: number) => void,
): Promise<number> {
  if (typeof window === "undefined") return 0
  const alvos = new Map<string, string>()
  for (const [chave, jogador] of Object.entries(pacote.jogadores ?? {})) {
    const url = jogador.faceDataUrl
    if (!url || url.startsWith("data:")) continue
    const corte = chave.indexOf("__")
    const nome = corte >= 0 ? chave.slice(corte + 2) : chave
    if (nome) alvos.set(nome, url)
  }
  if (alvos.size === 0) return 0

  const { fetchDoAmbiente } = await import("@/lib/buscar-json")
  const requisitar = await fetchDoAmbiente()
  const guardadas: Record<string, string> = Object.fromEntries(fotosGuardadas())
  let bytes = JSON.stringify(guardadas).length
  let feitas = 0
  let novas = 0

  for (const [nome, url] of alvos) {
    feitas++
    aoProgredir?.(feitas, alvos.size)
    if (guardadas[nome]?.startsWith("data:")) continue
    if (bytes >= TETO_FOTOS_BYTES) break
    try {
      const r = await requisitar(url, {})
      if (!r.ok) continue
      const dados = paraDataUrl(await r.arrayBuffer(), r.headers.get("content-type") ?? "")
      guardadas[nome] = dados
      bytes += dados.length + nome.length + 8
      novas++
    } catch { /* uma foto a menos não invalida o pacote */ }
  }

  if (novas > 0) storeSet(CHAVE_FOTOS, JSON.stringify(guardadas))
  return novas
}

// ─── Dispensa ────────────────────────────────────────────────────────────────

/** "Agora não": esta versão não volta a ser oferecida. A próxima, sim. */
export function dispensarVersao(versao: number): void {
  storeSet(CHAVE_DISPENSADA, String(versao))
}

export function foiDispensada(versao: number): boolean {
  if (typeof window === "undefined") return false
  return Number(storeGet(CHAVE_DISPENSADA) ?? 0) >= versao
}

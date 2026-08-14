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
import { isTauri } from "@/lib/game-asset"
import { canalAtivo } from "@/lib/atualizacoes-preferencias"
import { guardarImagem, resolverImagem } from "@/lib/banco-de-imagens"
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
  /** Ligas: participantes, identidade e regulamento, por nome de competição. */
  ligas?: Record<string, LigaNoCanal>
}

/**
 * Regulamento publicado pelo painel.
 *
 * Todo campo é opcional de propósito: o admin preenche o que quer corrigir e o
 * jogo mantém o próprio valor no resto. Um regulamento pela metade não pode
 * zerar o que não foi informado.
 */
export interface RegulamentoDaLiga {
  /** 1 = turno único, 2 = ida e volta. */
  turnos?: number
  /** 0 ou ausente = o jogo calcula pelo número de participantes. */
  rodadas?: number
  pontosVitoria?: number
  acessos?: number
  rebaixamentos?: number
  mataMata?: boolean
  criteriosDesempate?: string[]
}

export interface LigaNoCanal {
  clubes?: string[]
  regulamento?: RegulamentoDaLiga
  /** Nome exibido; quando a competição não é licenciada, vem o genérico. */
  nome?: string
  logoUrl?: string
  /** Ausente = licenciada. Só aparece quando o painel desligou a licença. */
  licenciado?: boolean
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
  const r = await consultarServidorDetalhado()
  return r.estado === "ok" ? r.pacote : null
}

/**
 * POR QUE ESTA VERSAO DETALHADA EXISTE.
 *
 * `consultarServidor` devolve `null` por TRES motivos completamente diferentes,
 * e a tela de Atualizações traduzia os três como **"Não foi possível falar com o
 * servidor agora"** — culpando a VPS por coisas que não são dela. Relato com
 * print (04/08/2026): o jogador via essa mensagem com o servidor no ar,
 * respondendo o manifesto normalmente; o que ele tinha eram os dois canais
 * DESLIGADOS nas próprias preferências, logo abaixo na mesma tela.
 *
 * Cada motivo pede uma ação diferente do jogador — ligar o canal, atualizar o
 * jogo, ou tentar de novo mais tarde —, então quem chama precisa distingui-los.
 */
export type ResultadoDaConsulta =
  | { estado: "ok"; pacote: AtualizacaoElencos }
  /** Os dois canais estão desligados: a consulta nem sai da máquina. */
  | { estado: "canais-desligados" }
  /** O pacote publicado é ANTERIOR a este build — ver `maisNovoQueOBuild`. */
  | { estado: "anterior-ao-build"; publicadoEm: number }
  /** Nenhuma fonte respondeu (VPS e GitHub). Aí sim é rede. */
  | { estado: "sem-rede" }

export async function consultarServidorDetalhado(): Promise<ResultadoDaConsulta> {
  if (typeof window === "undefined") return { estado: "sem-rede" }
  // Canal desligado nas preferências: nem a consulta sai da máquina.
  if (!canalAtivo("elencos") && !canalAtivo("times")) return { estado: "canais-desligados" }
  let respondeu: AtualizacaoElencos | null = null
  for (const url of FONTES) {
    const lido = await buscarJson<AtualizacaoElencos>(url, 8000)
    if (!lido || typeof lido.versao !== "number") continue
    respondeu = lido
    // Um pacote anterior a este build não tem o que acrescentar: oferecê-lo seria
    // um convite para PIORAR o elenco. Ver `maisNovoQueOBuild`.
    if (!maisNovoQueOBuild(lido)) break
    return { estado: "ok", pacote: lido }
  }
  // Distinguir "o servidor respondeu, mas o pacote é velho" de "ninguém
  // respondeu" é justamente o que faltava: o primeiro NÃO é problema de rede.
  if (respondeu) return { estado: "anterior-ao-build", publicadoEm: respondeu.publicado_em ?? 0 }
  return { estado: "sem-rede" }
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

/**
 * A cópia local desta URL, se houver — senão a própria URL.
 *
 * ⚠️ NO APP INSTALADO ISTO NÃO É OTIMIZAÇÃO, É O QUE FAZ A IMAGEM EXISTIR. A
 * webview do Tauri não alcança a VPS, então `<img src="https://…">` do manifesto
 * nunca pinta; só o `data:` pinta. Como a chave do mapa É a url (e a url termina
 * no sha), achar aqui já prova que a cópia é desta imagem.
 */
function comCopiaLocal(url: string | undefined): string | undefined {
  if (!url || url.startsWith("data:")) return url
  const copia = imagensGuardadas().porUrl.get(url)
  if (!copia) return url
  // A cópia agora costuma ser uma REFERÊNCIA do banco de imagens, não mais o
  // base64 inteiro. Enquanto o arquivo não terminou de ser lido do disco,
  // `resolverImagem` devolve null e a URL remota volta a valer — no app ela não
  // pinta, mas é só até o evento `ultrafoot:imagem:pronta` chegar e a tela se
  // redesenhar (o mesmo caminho que TeamCrest já usa para `store:ready`).
  return resolverImagem(copia) ?? url
}

export function timeDoServidor(fileKey: string): TeamOverride | null {
  if (!canalAtivo("times")) return null
  const bruto = getAtualizacao().times?.[fileKey]
  if (!bruto) return null
  // Troca escudo E uniforme pela cópia local antes de entregar. É por aqui que
  // `getCamisaUrl` (lib/teams-data) recebe o uniforme publicado — sem a troca
  // ele receberia a url remota e a camisa ficaria invisível no app.
  if (!bruto.logoUrl && !bruto.kits) return bruto
  const kits = bruto.kits
    ? Object.fromEntries(Object.entries(bruto.kits).map(([variante, k]) =>
        [variante, k ? { ...k, imageUrl: comCopiaLocal(k.imageUrl) } : k]))
    : undefined
  return { ...bruto, logoUrl: comCopiaLocal(bruto.logoUrl), ...(kits ? { kits } : {}) } as TeamOverride
}

/**
 * Escudo publicado para este clube, ou null.
 *
 * ⚠️ EXISTE PORQUE `timeDoServidor` NÃO BASTAVA. O escudo do canal chegava até
 * `getTeamOverride`, mas a tela não passa por lá: `getCustomLogoUrl`
 * (components/team-crest) lia só o save local e o seed EMBUTIDO no build. Ou
 * seja, dava para publicar escudo pelo canal e ele não aparecia em lugar
 * nenhum, sem erro nenhum — o mesmo descasamento que os retratos do DF11
 * tiveram entre a chave do manifesto e `getPlayerPhotoUrl`.
 *
 * Mesma regra da foto: a CÓPIA guardada vence a URL remota (é ela que faz o
 * escudo aparecer sem internet), mas só se for cópia DESTA url — como a url
 * termina no sha da imagem, comparar as duas é a verificação de validade.
 */
export function escudoDoServidor(fileKey: string): string | null {
  if (!canalAtivo("times")) return null
  return comCopiaLocal(getAtualizacao().times?.[fileKey]?.logoUrl) ?? null
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

/**
 * Chave de competição comparável.
 *
 * O painel é digitado à mão e o jogo pergunta por dois formatos diferentes: a
 * divisão (`serie_a`) e o nome (`Série A`). Exigir igualdade exata faria o
 * cadastro certo não pegar, e o sintoma seria mudo — a liga montaria pelo seed
 * como se o canal não tivesse nada.
 */
function chaveDeCompeticao(bruto: string): string {
  return bruto
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

/** Participantes corrigidos de uma competição, se a atualização trouxer. */
export function clubesDaLigaNoServidor(competicao: string): string[] | null {
  if (!canalAtivo("times")) return null
  return ligaNoServidor(competicao)?.clubes ?? null
}

/** Regulamento publicado para a competição (turnos, acessos, rebaixamentos…). */
export function regulamentoDaLigaNoServidor(competicao: string): RegulamentoDaLiga | null {
  if (!canalAtivo("times")) return null
  return ligaNoServidor(competicao)?.regulamento ?? null
}

function ligaNoServidor(competicao: string) {
  const ligas = getAtualizacao().ligas
  if (!ligas || !competicao) return null
  const exata = ligas[competicao]
  if (exata) return exata
  const alvo = chaveDeCompeticao(competicao)
  if (!alvo) return null
  for (const [chave, valor] of Object.entries(ligas)) {
    if (chaveDeCompeticao(chave) === alvo) return valor
  }
  return null
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
  //
  // ⚠️ E A COPIA LOCAL SO VALE SE FOR COPIA DESTA URL. Ver a nota do
  // CHAVE_FOTOS: enquanto ela vencia sem conferencia, republicar um clube nao
  // tinha efeito nenhum em quem ja tinha baixado.
  if (fileKey) {
    const chaveCompleta = `${fileKey}__${chave}`
    const exata = getAtualizacao().jogadores?.[chaveCompleta]?.faceDataUrl
    if (!exata) return null
    const copia = imagensGuardadas().porChave.get(chaveCompleta)
    return copia?.u === exata ? resolverImagem(copia.d) ?? exata : exata
  }
  const mapa = indexarFotos()
  const url = mapa.size === 0 ? undefined : mapa.get(chave)
  if (!url) return null
  const copia = imagensGuardadas().porUrl.get(url)
  return (copia ? resolverImagem(copia) : null) ?? url
}

// ─── Cópia local das imagens (para funcionar SEM internet) ───────────────────
//
// O manifesto já fica gravado no disco, então elenco e transferência funcionam
// offline assim que o pacote é aplicado. A IMAGEM não: retrato e escudo viajam
// como URL remota (é o que evitou o seed de 30 MB em base64). Sem esta cópia, a
// figura aparecia com internet e sumia sem ela — "atualizou" pela metade.
//
// Guardadas num ÚNICO valor, gravado uma vez só no fim: são centenas de
// imagens, e uma gravação por imagem faria o persistent-store reescrever o
// arquivo inteiro a cada uma.

// ⚠️ O NOME DA CHAVE CONTINUA "fotos" DE PROPÓSITO, mesmo agora que ela guarda
// escudo também: mudar a string descartaria a cópia de quem já baixou, e todo
// mundo voltaria a depender da internet até o próximo pacote.
const CHAVE_IMAGENS = "ultrafoot:atualizacao-fotos"

/** Prefixos dentro da cópia. Atleta é `fileKey__nome`; clube não tem `__`, então
 *  os espaços de chave não se encostam. */
const chaveEscudo = (fileKey: string) => `escudo__${fileKey}`
const chaveKit = (fileKey: string, variante: string) => `kit__${fileKey}__${variante}`

/**
 * ⚠️ A CÓPIA LOCAL PRECISA SABER DE QUAL FOTO ELA É CÓPIA.
 *
 * A primeira versão guardava `{ nome: "data:..." }` e tinha dois furos que só
 * apareceram quando um clube foi republicado (Cruzeiro, 03/08/2026):
 *
 *  1. **Indexada só pelo NOME**, jogando fora o clube — o mesmo descasamento que
 *     `fotoDoServidor` já evita quando recebe o `fileKey`.
 *  2. **Nunca invalidada**: `guardarFotosLocalmente` pulava quem já tinha cópia e
 *     `fotoDoServidor` devolvia a cópia ANTES da URL do manifesto. Republicar
 *     virava operação sem efeito para quem já tinha baixado — e sem sintoma
 *     nenhum, porque a foto continuava aparecendo; só que a antiga.
 *
 * Agora a cópia guarda a URL de origem junto. Como a URL termina no sha da
 * imagem, comparar as duas É a verificação de validade: mudou a foto, mudou o
 * sha, mudou a URL, a cópia cai sozinha.
 */
interface ImagemGuardada {
  /** URL de origem no manifesto. Termina no sha, então é o teste de validade. */
  u: string
  /**
   * A imagem. Hoje é uma REFERÊNCIA do banco (`uf-img:<sha>.<ext>`, ~50 bytes);
   * em cópias antigas — e sempre na web, que não tem disco — ainda é o base64
   * inteiro. `resolverImagem` aceita os dois e devolve algo que `<img src>` come.
   */
  d: string
  /**
   * Tamanho REAL da imagem em bytes.
   *
   * Existe porque o teto abaixo era calculado com `d.length`, e isso deixou de
   * medir qualquer coisa quando `d` virou uma referência de 50 bytes: sem este
   * campo o orçamento acharia que nada foi gasto e baixaria o pacote inteiro a
   * cada abertura. Ausente nas cópias antigas, onde `d.length` ainda serve.
   */
  b?: number
}

/**
 * ⚠️ NO APP INSTALADO A CÓPIA LOCAL NÃO É "PARA FUNCIONAR OFFLINE" — É A ÚNICA
 * FORMA DE A IMAGEM APARECER.
 *
 * A webview do Tauri **não alcança a VPS**: é por isso que o download logo abaixo
 * usa `fetchDoAmbiente` (plugin HTTP do Tauri) em vez do `fetch` da webview. O
 * mesmo vale para `<img src="https://...">` — a URL remota do manifesto nunca
 * pinta. Só o `data:` da cópia local pinta.
 *
 * Foi assim que a 1.0.250 saiu com 599 escudos publicados e o jogador viu 234:
 * o teto de 8 MB coube exatamente 234, e os outros 365 ficaram com a URL remota,
 * que no app não vale nada. Na versão WEB o problema não existe — a página é
 * servida pela própria VPS, mesma origem.
 *
 * Daí os dois tetos. Na web o limite é real (`storeSet` espelha em
 * `localStorage`, que estoura por volta de 5–10 MB e é o único armazenamento que
 * existe lá). No app o armazenamento é ARQUIVO — o save deste projeto já passa
 * de 60 MB — e apertar aqui não economiza nada, só apaga escudo da tela.
 */
const TETO_WEB = 8 * 1024 * 1024
// 200 MB porque e o que o conteudo real pede depois do lote de 06/08/2026,
// MEDIDO no manifesto v46 e nao estimado: 603 escudos (16,2 MB), 2.000
// uniformes em resolucao NATIVA (137,1 MB) e 1.088 retratos (9,2 MB) — 163 MB,
// com ~20% de folga para o proximo lote. O uniforme so nao e reduzido porque
// reduzir foi testado e reprovado — ver scripts/publicar-camisas-pasta.mjs.
//
// ⚠️ MECA, NAO ESTIME. Eu tinha chutado 90 MB para os uniformes e o numero real
// era 137 — a arte do FenixCAP e maior que a do sortitoutsi e os lotes antigos
// pesam mais. Como conferir na VPS, somando o tamanho no disco das URLs UNICAS
// do manifesto e inflando por 4/3 (base64):
//
//   {u.rsplit('/',1)[-1] for u in urls} -> os.path.getsize -> * 4/3
//
// ⚠️ O TETO NAO E UM LIMITE DE DISCO, E O QUE DECIDE O QUE APARECE. No app a
// webview nao alcanca a VPS, entao imagem que nao coube aqui simplesmente nao
// pinta — apertar este numero nao "economiza", apaga clube da tela. Com 72 MB o
// lote de 06/08 entrava pela metade: as fatias de escudo e de uniforme
// estouravam antes de o pacote acabar, e o sintoma seria o mesmo da 1.0.250
// (escudo publicado, conferido no ar, e invisivel no jogo).
//
// O custo e o arquivo do store (%APPDATA%\com.ultrafoot.remake\ultrafoot-
// clubs.json), que passa de ~127 MB para ~215 MB e e lido inteiro no boot.
const TETO_APP = 200 * 1024 * 1024

function tetoDeImagens(): number {
  return isTauri() ? TETO_APP : TETO_WEB
}

/**
 * ⚠️ ORÇAMENTO SEPARADO POR TIPO, e não uma fila só.
 *
 * Com fila única o que vem primeiro come tudo: pôr escudo na frente (para ele
 * caber, ver acima) fez a 1.0.250 guardar 234 escudos e **zero retratos**. Quem
 * vem depois não fica "com menos" — fica sem nada, porque o laço para no teto.
 * Cada tipo tem metade e um não pode invadir o do outro.
 */
//
// As fatias saem do PESO REAL de cada tipo, nao de um rateio bonito. Medido no
// manifesto v46 (já em base64, que é como fica guardado): escudo 16,2 MB,
// uniforme 137,1 MB (nativo, e é de longe o item caro), retrato 9,2 MB. Uma
// divisão igual deixaria o uniforme de fora e sobraria fatia nos outros dois
// sem uso, porque um tipo não invade o do outro.
const FATIA = { escudo: 0.12, kit: 0.78, foto: 0.1 }

interface CacheImagens { porChave: Map<string, ImagemGuardada>; porUrl: Map<string, string> }
let cacheImagens: { bruto: string; dados: CacheImagens } | null = null

const VAZIO: CacheImagens = { porChave: new Map(), porUrl: new Map() }

function imagensGuardadas(): CacheImagens {
  if (typeof window === "undefined") return VAZIO
  const bruto = storeGet(CHAVE_IMAGENS)
  if (!bruto) return VAZIO
  if (cacheImagens?.bruto === bruto) return cacheImagens.dados
  const dados: CacheImagens = { porChave: new Map(), porUrl: new Map() }
  try {
    for (const [chave, valor] of Object.entries(JSON.parse(bruto) as Record<string, unknown>)) {
      // Formato antigo (`nome: "data:..."`): DESCARTADO de propósito. Não tem
      // URL para conferir e está indexado pelo nome sem clube — é justamente a
      // cópia que servia foto velha. Descartar é seguro: o retrato continua
      // vindo pela URL do manifesto e volta a ser guardado no próximo pacote.
      if (typeof valor !== "object" || valor === null) continue
      const { u, d, b } = valor as Partial<ImagemGuardada>
      if (typeof u !== "string" || typeof d !== "string") continue
      dados.porChave.set(chave, { u, d, ...(typeof b === "number" ? { b } : {}) })
      dados.porUrl.set(u, d)
    }
  } catch { /* corrompido: volta a valer a URL remota */ }
  cacheImagens = { bruto, dados }
  return dados
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
 * Baixa e guarda os retratos E os escudos do pacote. Best-effort: o que falhar
 * continua funcionando online, e nada aqui pode atrapalhar o que já foi aplicado.
 *
 * Chamada DEPOIS de `aplicarAtualizacao` — o elenco já vale antes de a primeira
 * imagem chegar.
 */
export async function guardarFotosLocalmente(
  pacote: AtualizacaoElencos,
  aoProgredir?: (feitas: number, total: number) => void,
): Promise<number> {
  if (typeof window === "undefined") return 0
  // Chaveado por `fileKey__nome`, o mesmo do manifesto: guardar por nome jogava
  // fora o clube e fazia xarás de clubes diferentes dividirem uma cópia só.
  const escudos = new Map<string, string>()
  const kits = new Map<string, string>()
  const fotos = new Map<string, string>()
  for (const [fileKey, time] of Object.entries(pacote.times ?? {})) {
    const url = time?.logoUrl
    if (url && !url.startsWith("data:")) escudos.set(chaveEscudo(fileKey), url)
    for (const [variante, k] of Object.entries(time?.kits ?? {})) {
      const img = k?.imageUrl
      if (img && !img.startsWith("data:")) kits.set(chaveKit(fileKey, variante), img)
    }
  }
  for (const [chave, jogador] of Object.entries(pacote.jogadores ?? {})) {
    const url = jogador.faceDataUrl
    if (!url || url.startsWith("data:")) continue
    fotos.set(chave, url)
  }
  // ⚠️ A MESMA IMAGEM CHEGA EM VÁRIAS CHAVES, e guardá-la duas vezes gasta
  // orçamento por nada. O canal publica todo clube nas DUAS chaves — a do pool e
  // a curada (`santa` e `santacruz_pe`) — porque não dá para saber qual delas a
  // tela vai consultar. Como a URL termina no sha do conteúdo, as duas chaves
  // trazem a MESMA url; e `comCopiaLocal` procura por URL, não por chave, então
  // uma cópia já atende as duas.
  //
  // No lote de 06/08 isso era 163 escudos e centenas de uniformes repetidos — o
  // bastante para estourar a fatia do escudo e derrubar da tela clube que estava
  // publicado, exatamente o sintoma da 1.0.250.
  const soUmaPorUrl = (m: Map<string, string>): Map<string, string> => {
    const vistas = new Set<string>()
    const saida = new Map<string, string>()
    for (const [chave, url] of m) {
      if (vistas.has(url)) continue
      vistas.add(url)
      saida.set(chave, url)
    }
    return saida
  }
  const escudosUnicos = soUmaPorUrl(escudos)
  const kitsUnicos = soUmaPorUrl(kits)
  const fotosUnicas = soUmaPorUrl(fotos)
  const alvos = new Map([...escudosUnicos, ...kitsUnicos, ...fotosUnicas])
  if (alvos.size === 0) return 0

  const { fetchDoAmbiente } = await import("@/lib/buscar-json")
  const requisitar = await fetchDoAmbiente()
  const guardadas: Record<string, ImagemGuardada> = Object.fromEntries(imagensGuardadas().porChave)

  // Cópia de quem saiu do pacote não serve mais para nada e ainda ocupa o teto —
  // é o que sobrava do elenco antigo depois de uma transferência.
  let removidas = 0
  for (const chave of Object.keys(guardadas)) {
    if (alvos.has(chave)) continue
    delete guardadas[chave]
    removidas++
  }

  const teto = tetoDeImagens()
  let feitas = 0
  let novas = 0

  // Quanto do que JÁ está guardado pertence a cada tipo: sem isto o orçamento de
  // um tipo seria gasto de novo a cada pacote e o dos outros nunca sobraria.
  const tipoDa = (chave: string) =>
    chave.startsWith("escudo__") ? "escudo" : chave.startsWith("kit__") ? "kit" : "foto"
  // `b` quando a imagem foi para o banco (`d` virou uma referência curta);
  // `d.length` nas cópias antigas, que ainda carregam o base64 inteiro.
  const pesoDe = (v: ImagemGuardada) => v.b ?? v.d.length
  const gastoDe = (tipo: string) =>
    Object.entries(guardadas)
      .filter(([c]) => tipoDa(c) === tipo)
      .reduce((s, [c, v]) => s + pesoDe(v) + v.u.length + c.length + 16, 0)

  async function baixar(tipo: keyof typeof FATIA, lista: Map<string, string>) {
    const limite = teto * FATIA[tipo]
    let bytes = gastoDe(tipo)
    for (const [chave, url] of lista) {
      feitas++
      aoProgredir?.(feitas, alvos.size)
      // Rebaixa quando a URL MUDOU — e ela muda sempre que a imagem muda, porque
      // termina no sha. Era aqui que a republicação morria.
      if (guardadas[chave]?.u === url) continue
      if (bytes >= limite) break
      try {
        const r = await requisitar(url, {})
        if (!r.ok) continue
        const dados = paraDataUrl(await r.arrayBuffer(), r.headers.get("content-type") ?? "")
        // Os bytes vão para um ARQUIVO e no JSON fica só a referência. Era este
        // ponto que engordava o `ultrafoot-clubs.json` até 170 MB só de cópia de
        // imagem — e como o persistent-store reescreve o arquivo inteiro a cada
        // gravação, cada clique do jogo pagava por isso. Na web `guardarImagem`
        // devolve a própria data URL e nada muda.
        const guardada = (await guardarImagem(dados)) ?? dados
        guardadas[chave] = { u: url, d: guardada, b: dados.length }
        bytes += dados.length + url.length + chave.length + 16
        novas++
      } catch { /* uma imagem a menos não invalida o pacote */ }
    }
  }

  await baixar("escudo", escudosUnicos)
  await baixar("kit", kitsUnicos)
  await baixar("foto", fotosUnicas)

  // Grava também quando só houve descarte: a limpeza do formato antigo e das
  // sobras de elenco anterior precisa persistir mesmo que nenhuma imagem nova
  // tenha entrado (offline, teto batido, servidor fora).
  if (novas > 0 || removidas > 0) storeSet(CHAVE_IMAGENS, JSON.stringify(guardadas))
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

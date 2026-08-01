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
// E nada aqui conecta sem AUTORIZAÇÃO. O jogador aceita uma vez (o convite do
// primeiro boot, ou a tela Personalizar > Atualizações) e pode revogar quando
// quiser; enquanto não aceitar, este arquivo não faz uma requisição sequer. Os
// canais ligados/desligados vivem em lib/atualizacoes-preferencias e são
// consultados em cada leitura aqui embaixo.

import { storeSet } from "@/lib/persistent-store"
import { canalAtivo } from "@/lib/atualizacoes-preferencias"
import type { TeamOverride } from "@/lib/team-overrides"
import type { PlayerOverride } from "@/lib/player-overrides"

const CHAVE = "ultrafoot:atualizacao-elencos"

// As URLs do manifesto (VPS + reserva no GitHub) sairam na 1.0.240 junto com o
// canal. Ficam registradas aqui porque o servidor continua publicando o
// elencos.json — quem o consome agora e o BUILD, na hora de gerar os seeds, nao
// mais o jogo na maquina do jogador:
//   https://ultrafoot.179-198-103-30.sslip.io/atualizacoes/elencos.json
//   https://github.com/jovemegidio/Ultrafoot26/releases/download/elencos/elencos.json

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


/**
 * O que já está na máquina. Leitura SÍNCRONA de propósito: quem chama são as
 * funções de override, no meio da montagem do elenco — um await ali obrigaria a
 * reescrever meia dezena de caminhos que hoje são síncronos.
 *
 * ⚠️ DESLIGADO NA 1.0.240: devolve sempre VAZIA. A atualização deixou de ser por
 * partes — quem entrega elenco, time e liga agora é a BUILD, inteira, trazida
 * pelo Ultrafoot Launcher.
 *
 * E não bastava parar de baixar. O manifesto que já estava gravado no disco
 * continuaria valendo para sempre: um pacote baixado na 1.0.230 sobrescreveria
 * o elenco da 1.0.240 com dados mais VELHOS do que os do próprio build, e sem
 * ninguém para atualizá-lo. Ignorar o que está gravado é o que faz a build voltar
 * a ser a única fonte. O arquivo continua no disco, intocado, caso um dia o canal
 * volte.
 */
export function getAtualizacao(): AtualizacaoElencos {
  return VAZIA
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
  // DESLIGADO NA 1.0.240 junto com `getAtualizacao`. Consultar aqui só ofereceria
  // ao jogador um pedaço que o jogo não aplica mais — botão que não faz nada.
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
}

export function resumir(a: AtualizacaoElencos | null): ResumoAtualizacao {
  return {
    clubes: Object.keys(a?.times ?? {}).length,
    jogadores: Object.keys(a?.jogadores ?? {}).length,
    transferencias: (a?.transferencias ?? []).length,
    competicoes: Object.keys(a?.ligas ?? {}).length,
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

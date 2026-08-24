"use client"

// ELENCO EDITADO — criar, excluir e transferir atletas pelo editor.
//
// Por que um modulo NOVO em vez de mais campos em `player-overrides`: aquele
// arquivo edita um atleta que JA EXISTE (a chave dele e o nome original dentro
// do clube). Nao ha onde pendurar "este atleta nao existe mais" nem "este aqui
// passou a existir" — sao operacoes sobre a LISTA, nao sobre um item dela.
//
// A separacao tambem espelha a do Brasfoot que o usuario levantou: mexer no
// cadastro do clube (editor) nao e uma transferencia de carreira. Aqui nao ha
// proposta, salario nem contrato: o atleta simplesmente passa a constar no
// outro clube. A negociacao continua sendo assunto do mercado, dentro do save.
//
// Camadas (mesma ordem de team-overrides / player-overrides):
//   seed EMBUTIDO no build  <  edicao LOCAL do jogador
//
// Aplicado em `players-data.getPlayersForTeam`, inclusive no modo `raw` — sem
// isso o proprio editor nao enxergaria o que acabou de criar.

import { storeGet, storeSet, storeRemove } from "@/lib/persistent-store"
import bundled from "@/data/seeds/roster-overrides.json"

/** Atleta acrescentado ao clube pelo editor (criado do zero ou transferido). */
export interface AtletaCriado {
  nome: string
  pos: string
  idade: number
  /** Overall. Mesmo nome do campo em `Player` para o cruzamento ficar obvio. */
  base: number
  nac?: string
  lado?: "E" | "D" | "C"
  preferredFoot?: "Direita" | "Esquerda" | "Ambidestro"
  reputation?: "normal" | "estrela" | "top_mundial"
  traits?: string[]
  pace?: number
  shooting?: number
  passing?: number
  dribbling?: number
  defending?: number
  physical?: number
  /** `file_key` do clube de onde ele veio, quando a entrada nasceu de uma transferencia. */
  origem?: string
}

export interface RosterPatch {
  criados?: AtletaCriado[]
  /** Nomes ORIGINAIS normalizados (ver `normNome`) que sairam do clube. */
  removidos?: string[]
}

const BUNDLED = bundled as Record<string, RosterPatch>
const KEY = (fileKey: string) => `ultrafoot:roster-override:${fileKey}`
const PREFIXO = "ultrafoot:roster-override:"

/**
 * Mesma normalizacao de `player-overrides.normPlayerName`, repetida aqui de
 * proposito: importar de la criaria uma dependencia circular (aquele modulo
 * chega a este pelo `players-data`), e um acento a mais ou a menos aqui
 * significaria remover o atleta errado.
 */
export function normNome(nome: string): string {
  return (nome ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")
}

function vazio(patch: RosterPatch | null | undefined): boolean {
  return !patch || ((patch.criados?.length ?? 0) === 0 && (patch.removidos?.length ?? 0) === 0)
}

function juntar(base: RosterPatch | undefined, local: RosterPatch | undefined): RosterPatch | null {
  if (!base && !local) return null
  const criados = [...(base?.criados ?? []), ...(local?.criados ?? [])]
  // O local pode desfazer uma criacao do seed: se o nome consta em `removidos`,
  // ele sai da lista de criados em vez de virar um atleta fantasma que reaparece
  // a cada abertura do jogo.
  const removidos = new Set([...(base?.removidos ?? []), ...(local?.removidos ?? [])])
  const filtrados = criados.filter(a => !removidos.has(normNome(a.nome)))
  // Nome repetido entre as camadas: a edicao local vence (vem depois).
  const porNome = new Map(filtrados.map(a => [normNome(a.nome), a]))
  return { criados: [...porNome.values()], removidos: [...removidos] }
}

/**
 * Costura de TESTE — patches em memoria, sem armazenamento nem `window`.
 *
 * Existe porque o que precisa de guarda nao e o `aplicarPatch` puro: e a
 * CONSEQUENCIA no elenco que o jogo monta (o atleta criado sobrevive a
 * calibracao? o removido some mesmo?). Isso so se mede chamando
 * `getPlayersForTeam`, e la o patch vem daqui.
 *
 * `null` = comportamento normal do jogo. NENHUM caminho de producao chama.
 */
let patchesDeTeste: Record<string, RosterPatch> | null = null
// Revisao monotona consumida pelo cache de `players-data`. Eventos do browser
// nao existem em SSR/testes, portanto a invalidacao precisa acompanhar a fonte
// do dado e funcionar em qualquer runtime.
let revisaoDosElencos = 0
export function revisaoDosElencosEditados(): number {
  return revisaoDosElencos
}
export function semearElencosEditados(patches: Record<string, RosterPatch> | null): void {
  patchesDeTeste = patches
  revisaoDosElencos++
}

export function getRosterPatch(fileKey: string): RosterPatch | null {
  if (!fileKey) return null
  if (patchesDeTeste) {
    const p = patchesDeTeste[fileKey]
    return vazio(p) ? null : juntar(undefined, p)
  }
  const base = BUNDLED[fileKey]
  // Sem guarda de `window`: o `storeGet` le de um Map em memoria, que no
  // servidor esta vazio de qualquer jeito — a guarda seria enfeite. Sem ela, a
  // API inteira (criar/remover/transferir) fica exercitavel por teste em node,
  // e nao so o nucleo puro.
  const raw = storeGet(KEY(fileKey))
  let local: RosterPatch | undefined
  if (raw) {
    try { local = JSON.parse(raw) as RosterPatch } catch { /* save corrompido: fica so a base */ }
  }
  const junto = juntar(base, local)
  return vazio(junto) ? null : junto
}

/** So a camada LOCAL — e o que o editor grava e reescreve. */
function getLocalPatch(fileKey: string): RosterPatch {
  const raw = storeGet(KEY(fileKey))
  if (!raw) return {}
  try { return JSON.parse(raw) as RosterPatch } catch { return {} }
}

function gravar(fileKey: string, patch: RosterPatch): void {
  if (vazio(patch)) storeRemove(KEY(fileKey))
  else storeSet(KEY(fileKey), JSON.stringify(patch))
  revisaoDosElencos++
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("ultrafoot:elenco:changed", { detail: { fileKey } }))
}

/** Acrescenta um atleta ao clube. Nome repetido no mesmo clube e recusado. */
export function criarAtleta(fileKey: string, atleta: AtletaCriado): boolean {
  if (!fileKey || !atleta.nome.trim()) return false
  const patch = getLocalPatch(fileKey)
  const chave = normNome(atleta.nome)
  if ((patch.criados ?? []).some(a => normNome(a.nome) === chave)) return false
  gravar(fileKey, {
    ...patch,
    criados: [...(patch.criados ?? []), atleta],
    // Criar alguem com o nome de quem foi removido desfaz a remocao — senao o
    // filtro do `getPlayersForTeam` apagaria o recem-criado em silencio.
    removidos: (patch.removidos ?? []).filter(n => n !== chave),
  })
  return true
}

/**
 * Tira o atleta do clube.
 *
 * Duas situacoes diferentes no mesmo botao: se ele veio do cadastro do jogo,
 * entra na lista de removidos; se foi criado no editor, some da lista de
 * criados. Sem a segunda, criar e apagar deixaria lixo acumulado no save.
 */
export function removerAtleta(fileKey: string, nomeOriginal: string): void {
  if (!fileKey || !nomeOriginal) return
  const patch = getLocalPatch(fileKey)
  const chave = normNome(nomeOriginal)
  const eraCriado = (patch.criados ?? []).some(a => normNome(a.nome) === chave)
  const criados = (patch.criados ?? []).filter(a => normNome(a.nome) !== chave)
  // Criado no editor E tambem presente no seed embutido: alem de sair dos
  // criados, precisa entrar em removidos, senao a camada de baixo o traz de volta.
  const noSeed = (BUNDLED[fileKey]?.criados ?? []).some(a => normNome(a.nome) === chave)
  const precisaMarcar = !eraCriado || noSeed
  gravar(fileKey, {
    criados,
    removidos: precisaMarcar && !(patch.removidos ?? []).includes(chave)
      ? [...(patch.removidos ?? []), chave]
      : patch.removidos,
  })
}

/**
 * Transferencia ADMINISTRATIVA: sai de um clube e entra no outro.
 *
 * Nao passa por dinheiro, contrato nem janela — isso e carreira, e carreira e o
 * outro editor (o save). Aqui e cadastro.
 */
export function transferirAtleta(
  deFileKey: string,
  paraFileKey: string,
  atleta: AtletaCriado,
  /**
   * Nome ORIGINAL no clube de origem.
   *
   * ⚠️ Nao e detalhe: o elenco do clube guarda o nome do cadastro, e o editor
   * mostra o nome EDITADO (player-overrides chaveia pelo original justamente
   * para a edicao sobreviver ao rebatismo). Transferir um atleta renomeado
   * usando o nome novo nao removeria ninguem da origem — ele apareceria nos
   * DOIS clubes, que e o mesmo defeito que o mercado ja teve.
   */
  nomeOriginal: string = atleta.nome,
): boolean {
  if (!deFileKey || !paraFileKey || deFileKey === paraFileKey) return false
  const entrou = criarAtleta(paraFileKey, { ...atleta, origem: deFileKey })
  if (!entrou) return false
  removerAtleta(deFileKey, nomeOriginal)
  return true
}

/** Devolve o clube ao cadastro original. */
export function limparRosterPatch(fileKey: string): void {
  storeRemove(KEY(fileKey))
  revisaoDosElencos++
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("ultrafoot:elenco:changed", { detail: { fileKey } }))
}

/** Todas as edicoes locais de elenco — para o editor exportar. */
export function listLocalRosterPatches(): Record<string, RosterPatch> {
  const out: Record<string, RosterPatch> = {}
  if (typeof window === "undefined") return out
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k?.startsWith(PREFIXO)) continue
    const raw = storeGet(k)
    if (!raw) continue
    try {
      const patch = JSON.parse(raw) as RosterPatch
      if (!vazio(patch)) out[k.replace(PREFIXO, "")] = patch
    } catch { /* ignora entrada corrompida */ }
  }
  return out
}

/**
 * NUCLEO PURO — aplica o patch a uma lista de atletas.
 *
 * Separado da leitura do save de proposito: e esta funcao que o teste exercita,
 * sem precisar de `window` nem de armazenamento. Quem le do disco e
 * `aplicarPatchDeElenco`, logo abaixo.
 *
 * `T` fica generico porque o `Player` de `players-data` traz campos que este
 * modulo nao precisa conhecer (foto, token do Transfermarkt, origem gerada).
 */
export function aplicarPatch<T extends { nome: string; pos: string; idade: number; base: number; time: string }>(
  patch: RosterPatch | null,
  players: T[],
  time: string,
): T[] {
  if (vazio(patch)) return players
  const fora = new Set(patch!.removidos ?? [])
  const ficam = fora.size ? players.filter(p => !fora.has(normNome(p.nome))) : players
  // A REMOCAO VENCE A CRIACAO do mesmo nome. `juntar` ja limpa isso ao mesclar
  // as camadas, mas a regra precisa valer tambem aqui: esta e a unica funcao por
  // onde todo patch passa, venha ele do seed, do save ou de um teste. Um patch
  // inconsistente que escapasse produziria um atleta que reaparece toda vez que
  // o jogo abre, e o jogador nao teria como remover.
  const criados = (patch!.criados ?? []).filter(a => !fora.has(normNome(a.nome)))
  if (criados.length === 0) return ficam

  const jaTem = new Set(ficam.map(p => normNome(p.nome)))
  const novos = criados
    .filter(a => !jaTem.has(normNome(a.nome)))
    .map(a => ({
      nome: a.nome,
      pos: a.pos,
      idade: a.idade,
      base: a.base,
      time,
      ...(a.nac ? { nac: a.nac } : {}),
      ...(a.preferredFoot ? { preferredFoot: a.preferredFoot } : {}),
      ...(a.reputation ? { reputation: a.reputation } : {}),
      ...(a.traits ? { traits: a.traits } : {}),
      ...(a.pace != null ? { pace: a.pace } : {}),
      ...(a.shooting != null ? { shooting: a.shooting } : {}),
      ...(a.passing != null ? { passing: a.passing } : {}),
      ...(a.dribbling != null ? { dribbling: a.dribbling } : {}),
      ...(a.defending != null ? { defending: a.defending } : {}),
      ...(a.physical != null ? { physical: a.physical } : {}),
      // ⚠️ ESTA MARCA E O QUE PROTEGE O OVERALL DIGITADO.
      // `calibrateSquadRatings` reescreve o `base` de TODO atleta a partir da
      // liga, do prestigio do clube e da posicao dele no ranking do elenco —
      // um atleta criado com 90 numa Serie D sairia de la com 62 e o editor
      // pareceria nao ter funcionado. A calibracao devolve intacto quem tem
      // esta origem.
      generatedOrigin: "editor" as const,
    })) as unknown as T[]

  return [...ficam, ...novos]
}

/** Le o patch do clube e aplica. Usado por `players-data.getPlayersForTeam`. */
export function aplicarPatchDeElenco<T extends { nome: string; pos: string; idade: number; base: number; time: string }>(
  fileKey: string | undefined,
  players: T[],
  time: string,
): T[] {
  if (!fileKey) return players
  return aplicarPatch(getRosterPatch(fileKey), players, time)
}

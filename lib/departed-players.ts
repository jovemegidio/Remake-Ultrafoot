"use client"

// Atletas que DEIXARAM o clube de origem nesta carreira.
//
// O relato: "contratei o Neymar no mercado mas ele continua no Santos". O elenco
// do usuario vive no engine, mas os elencos ADVERSARIOS sao gerados na hora a
// partir do seed (players-data.getPlayersForTeam) — e o seed ainda tem o Neymar
// no Santos. Sem um registro de quem saiu, o mesmo atleta existe nos dois lugares.
//
// Este modulo e o registro. Fica FORA do engine e do players-data de proposito:
// os dois precisam le-lo e importar um ao outro criaria ciclo. Mesma estrategia
// de [[player-overrides]].
//
// Escopo por carreira (getCareerScopedKey): vender numa carreira nao pode sumir
// com o atleta na carreira de outro save. Persistido em arquivo (persistent-store),
// entao sobrevive a fechar o jogo.

import { storeGet, storeSet } from "@/lib/persistent-store"
import { getActiveCareerId, getCareerScopedKey } from "@/lib/save-system"

const KEY = () => getCareerScopedKey("ultrafoot:departed-players")

// Siglas de tipo de clube — tiradas para "FC Santos" (nome do catalogo no
// mercado) e "Santos" (nome do time no gerador de elenco) casarem. Sem isto o
// filtro falharia justamente quando os dois lados escrevem o clube diferente.
const SIGLA_CLUBE = new Set(["fc", "cf", "sc", "ec", "ca", "cr", "ac", "se", "afc", "ud", "cd", "clube", "club"])

// MEMOIZACAO DE NORMALIZACAO DE NOME.
//
// MEDIDO no perfil de CPU da campanha: esta funcao sozinha passava de 4% do
// tempo total. Ela e PURA — NFD + duas regex + toLowerCase — e e chamada com o
// MESMO punhado de nomes milhoes de vezes, porque todo casamento de atleta com
// clube passa por aqui.
//
// Funcao pura de string: o cache nao tem como divergir da fonte, porque nao ha
// fonte alem do argumento.
//
// ⚠️ TETO OBRIGATORIO. Sem limite seria vazamento silencioso numa sessao longa.
// O espaco de chaves e fechado na pratica (nomes de clube e de atleta), entao
// estourar o teto significa entrada inesperada — e ai limpar tudo e mais barato
// e mais previsivel que uma politica LRU.
const TETO_Norm = 50_000
const _cacheNorm = new Map<string, string>()

function norm(s: string): string {
  const emCache = _cacheNorm.get(s)
  if (emCache !== undefined) return emCache
  const base = (s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
  const resultado = base.split(" ").filter(w => w && !SIGLA_CLUBE.has(w)).join(" ")
  if (_cacheNorm.size >= TETO_Norm) _cacheNorm.clear()
  _cacheNorm.set(s, resultado)
  return resultado
}

/** Chave de um atleta: clube de origem + nome, ambos normalizados. */
function chave(clube: string, nome: string): string {
  return `${norm(clube)}::${norm(nome)}`
}

// Cache atrelado ao careerId que o gerou. Ao trocar de save, o id muda e o
// cache e refeito sozinho — sem save-system precisar avisar (evita ciclo de
// import). Vender numa carreira nunca some com o atleta na de outro save.
let cache: Set<string> | null = null
let cacheCareerId: string | null = null

function carregar(): Set<string> {
  const atual = getActiveCareerId()
  if (cache && cacheCareerId === atual) return cache
  cacheCareerId = atual
  try {
    const raw = storeGet(KEY())
    cache = new Set<string>(raw ? JSON.parse(raw) : [])
  } catch {
    cache = new Set<string>()
  }
  return cache
}

/** Registra que um atleta saiu do clube de origem. */
export function markDeparted(clubeOrigem: string, nomeAtleta: string): void {
  if (!clubeOrigem || !nomeAtleta) return
  const set = carregar()
  set.add(chave(clubeOrigem, nomeAtleta))
  storeSet(KEY(), JSON.stringify([...set]))
}

/** O atleta ja saiu deste clube? Usado para nao o listar de novo. */
export function hasDeparted(clubeOrigem: string, nomeAtleta: string): boolean {
  return carregar().has(chave(clubeOrigem, nomeAtleta))
}

/** Força releitura do arquivo (a troca de carreira já e detectada em carregar). */
export function reloadDeparted(): void {
  cache = null
  cacheCareerId = null
}

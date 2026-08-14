// BUSCA GLOBAL — um campo só para tela, clube, atleta e competição.
//
// Onde ela mora, e por que não é uma tela nova
// ────────────────────────────────────────────
// O jogo já tem o menu de navegação da tecla **W** (`components/game-header`),
// que é uma lista plana de TODAS as telas com cabeçalho de seção. Ele já é o
// lugar onde se procura para onde ir. A busca entra ali dentro: com o campo
// vazio o menu continua exatamente como era; digitando, a lista passa a mostrar
// resultados de quatro tipos em vez das telas.
//
// Criar uma `/busca` seria empilhar página sobre página para resolver um
// problema que é justamente de navegação — e obrigaria a navegar até a busca
// para poder navegar.
//
// Este módulo é PURO: recebe o catálogo e o termo, devolve resultados ordenados.
// Sem React, sem store, testável em `scripts/test-busca-global.ts`.

export type TipoDeResultado = "tela" | "clube" | "atleta" | "competicao"

export interface ItemBuscavel {
  tipo: TipoDeResultado
  /** O que aparece em negrito na linha. */
  titulo: string
  /** Contexto à direita: a seção da tela, o país do clube, o clube do atleta. */
  detalhe?: string
  /** Para onde ir ao escolher. */
  href: string
  /** Texto adicional que também casa a busca (sigla, apelido, chave). */
  sinonimos?: string[]
}

export interface Resultado extends ItemBuscavel {
  /** Quanto casou, 0..1. Só para ordenar. */
  peso: number
}

/**
 * Normaliza para comparar: sem acento, minúsculo, sem pontuação.
 *
 * ⚠️ Tem de tirar ACENTO. Metade do catálogo é nome próprio acentuado —
 * "Grêmio", "Atlético", "Žalgiris" — e quem digita numa busca rápida não põe
 * acento. Sem isto a busca falharia justamente nos nomes mais procurados.
 */
export function normalizar(valor: string): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Iniciais de um nome composto: "Real Madrid" -> "rm". Faz "psg" achar o Paris. */
function iniciais(valor: string): string {
  const partes = normalizar(valor).split(" ").filter(Boolean)
  return partes.length > 1 ? partes.map(p => p[0]).join("") : ""
}

/**
 * Peso do casamento entre o termo e um texto. 0 = não casa.
 *
 * A ordem das faixas é o que faz a busca parecer esperta:
 *   1,00 igual              — "santos" acha o Santos antes de "Santos Laguna"
 *   0,90 começa com         — "fla" -> Flamengo antes de "Ferroviária Flamengo"
 *   0,75 palavra começa com — "madrid" -> Real Madrid
 *   0,60 iniciais           — "psg", "rm"
 *   0,40 contém             — último recurso
 */
function pesoDoTexto(termo: string, texto: string): number {
  const t = normalizar(texto)
  if (!t || !termo) return 0
  if (t === termo) return 1
  if (t.startsWith(termo)) return 0.9
  if (t.split(" ").some(p => p.startsWith(termo))) return 0.75
  if (iniciais(texto) === termo) return 0.6
  if (t.includes(termo)) return 0.4
  return 0
}

/** Desempate entre tipos quando o peso empata. Tela vem primeiro: é navegação. */
const PRIORIDADE: Record<TipoDeResultado, number> = {
  tela: 0.04,
  clube: 0.03,
  competicao: 0.02,
  atleta: 0.01,
}

/**
 * Busca no catálogo. Devolve no máximo `limite` resultados, mais fortes antes.
 *
 * ⚠️ O limite existe porque o catálogo tem DEZENAS DE MILHARES de atletas: sem
 * corte, digitar "a" tentaria desenhar o pool inteiro e travaria a tela — o
 * mesmo tipo de defeito que fazia todas as telas demorarem a abrir.
 */
export function buscar(catalogo: ItemBuscavel[], termo: string, limite = 24): Resultado[] {
  const alvo = normalizar(termo)
  if (alvo.length < 2) return []

  const achados: Resultado[] = []
  for (const item of catalogo) {
    let peso = pesoDoTexto(alvo, item.titulo)
    if (peso < 1 && item.sinonimos) {
      for (const s of item.sinonimos) {
        // Sinônimo vale um pouco menos que o nome: quem digita "COR" quer o
        // Corinthians, mas se existir um clube CHAMADO "Cor" ele vem antes.
        peso = Math.max(peso, pesoDoTexto(alvo, s) * 0.95)
      }
    }
    if (peso <= 0) continue
    achados.push({ ...item, peso: peso + PRIORIDADE[item.tipo] })
  }

  return achados
    .sort((a, b) => b.peso - a.peso || a.titulo.localeCompare(b.titulo))
    .slice(0, limite)
}

/** Agrupa preservando a ordem de relevância — o cabeçalho sai do primeiro de cada tipo. */
export function agrupar(resultados: Resultado[]): { tipo: TipoDeResultado; itens: Resultado[] }[] {
  const grupos: { tipo: TipoDeResultado; itens: Resultado[] }[] = []
  for (const r of resultados) {
    const atual = grupos.find(g => g.tipo === r.tipo)
    if (atual) atual.itens.push(r)
    else grupos.push({ tipo: r.tipo, itens: [r] })
  }
  return grupos
}

export const ROTULO_DO_TIPO: Record<TipoDeResultado, string> = {
  tela: "Telas",
  clube: "Clubes",
  atleta: "Atletas",
  competicao: "Competições",
}

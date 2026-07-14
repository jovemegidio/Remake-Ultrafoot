// Relacionamento entre clubes — usado pela negociacao para deixar o mercado menos
// "estabacado". Tres eixos:
//
//   1) GRUPOS multi-clube (mesmo dono): Red Bull, City Football Group, Eagle, 777...
//      Vendem/emprestam entre si com prioridade e desconto (a "linha de producao").
//   2) SATELITES / relacao historica: Ajax->Barca, Salzburg->Leipzig, Sao Paulo<->Porto,
//      Chelsea<->Vitesse, Juventus<->Sassuolo, Real->Getafe, Inter<->Genoa,
//      Southampton->Liverpool. Confianca construida: negocio flui mais facil.
//   3) RIVAIS: derbies. Rival NAO fortalece rival — venda dificil e mais cara (ou recusada).
//
// A identificacao e por PALAVRA-CHAVE no nome do clube (o banco tem 2.900+ clubes com
// nomes variados), entao funciona sem depender de IDs fixos.

export type RelationKind = "group" | "satellite" | "rival" | "neutral"

export interface ClubRelationship {
  kind: RelationKind
  /** -100 (arqui-rival) a +100 (mesmo grupo). 0 = neutro. */
  score: number
  /** Rotulo curto em PT-BR para a UI. */
  label: string
  /** Nome do grupo/relacao, quando houver. */
  detail?: string
}

// Normaliza nome: minusculo, sem acento, sem pontuacao.
function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function hasAny(name: string, keys: string[]): boolean {
  const n = norm(name)
  return keys.some((k) => n.includes(norm(k)))
}

// ── Grupos multi-clube (mesmo dono) ──────────────────────────────────────────
interface Group { name: string; members: string[] }
const OWNERSHIP_GROUPS: Group[] = [
  { name: "Red Bull", members: ["red bull", "bragantino", "rb leipzig", "leipzig", "salzburg", "new york red bull", "bulls"] },
  { name: "City Football Group", members: ["manchester city", "man city", "girona", "new york city", "melbourne city", "troyes", "palermo", "lommel", "montevideo city", "mumbai city"] },
  { name: "Eagle Football (Botafogo/Lyon)", members: ["botafogo", "olympique lyonnais", "lyon"] },
  { name: "777 Partners", members: ["vasco", "genoa", "standard liege", "hertha", "red star", "melbourne victory"] },
  { name: "Grupo Pacheco (Atletico/Cruzeiro)", members: [] }, // reservado p/ expansao
]

// ── Satelites / relacoes historicas (bidirecional salvo nota) ─────────────────
interface Pair { a: string[]; b: string[]; detail: string; score?: number }
const SATELLITE_PAIRS: Pair[] = [
  { a: ["ajax"], b: ["barcelona"], detail: "Ajax–Barcelona (filosofia e confianca historica)", score: 55 },
  { a: ["chelsea"], b: ["vitesse"], detail: "Chelsea–Vitesse (clube de desenvolvimento)", score: 65 },
  { a: ["juventus"], b: ["sassuolo"], detail: "Juventus–Sassuolo (cooperacao de mercado)", score: 60 },
  { a: ["real madrid"], b: ["getafe"], detail: "Real Madrid–Getafe (destino de jovens)", score: 55 },
  { a: ["inter", "internazionale"], b: ["genoa"], detail: "Inter–Genoa (parceria recorrente)", score: 55 },
  { a: ["southampton"], b: ["liverpool"], detail: "Southampton–Liverpool (canal recorrente)", score: 45 },
  { a: ["sao paulo"], b: ["porto"], detail: "Sao Paulo–Porto (operacoes recentes)", score: 55 },
  { a: ["salzburg"], b: ["leipzig"], detail: "Salzburg–Leipzig (linha de producao)", score: 70 },
]

// ── Rivalidades (bidirecional) ────────────────────────────────────────────────
const RIVALRIES: { a: string[]; b: string[]; detail: string }[] = [
  { a: ["palmeiras"], b: ["corinthians"], detail: "Derby Paulista" },
  { a: ["sao paulo"], b: ["corinthians"], detail: "Majestoso" },
  { a: ["sao paulo"], b: ["palmeiras"], detail: "Choque-Rei" },
  { a: ["santos"], b: ["corinthians"], detail: "Classico Alvinegro" },
  { a: ["flamengo"], b: ["fluminense"], detail: "Fla-Flu" },
  { a: ["flamengo"], b: ["vasco"], detail: "Classico dos Milhoes" },
  { a: ["flamengo"], b: ["botafogo"], detail: "Classico da Rivalidade" },
  { a: ["vasco"], b: ["botafogo"], detail: "Classico" },
  { a: ["fluminense"], b: ["botafogo"], detail: "Classico Vovo" },
  { a: ["gremio"], b: ["internacional", "inter "], detail: "Gre-Nal" },
  { a: ["atletico mineiro", "atletico mg", "atletico-mg"], b: ["cruzeiro"], detail: "Classico Mineiro" },
  { a: ["bahia"], b: ["vitoria"], detail: "Ba-Vi" },
  { a: ["barcelona"], b: ["real madrid"], detail: "El Clasico" },
  { a: ["atletico madrid", "atletico de madrid"], b: ["real madrid"], detail: "Derby Madrilenho" },
  { a: ["milan", "ac milan"], b: ["inter", "internazionale"], detail: "Derby della Madonnina" },
  { a: ["liverpool"], b: ["manchester united", "man united"], detail: "North West Derby" },
  { a: ["boca", "boca juniors"], b: ["river", "river plate"], detail: "Superclasico" },
]

function pairMatch(aName: string, bName: string, a: string[], b: string[]): boolean {
  return (hasAny(aName, a) && hasAny(bName, b)) || (hasAny(aName, b) && hasAny(bName, a))
}

function sameGroup(aName: string, bName: string): Group | null {
  for (const g of OWNERSHIP_GROUPS) {
    if (g.members.length && hasAny(aName, g.members) && hasAny(bName, g.members)) return g
  }
  return null
}

/**
 * Relacionamento entre DOIS clubes pelos seus nomes. Prioridade:
 * mesmo grupo > satelite > rival > neutro.
 */
export function getClubRelationship(teamAName: string, teamBName: string): ClubRelationship {
  if (!teamAName || !teamBName || norm(teamAName) === norm(teamBName)) {
    return { kind: "neutral", score: 0, label: "Neutro" }
  }

  const g = sameGroup(teamAName, teamBName)
  if (g) return { kind: "group", score: 90, label: "Mesmo grupo", detail: g.name }

  for (const p of SATELLITE_PAIRS) {
    if (pairMatch(teamAName, teamBName, p.a, p.b)) {
      return { kind: "satellite", score: p.score ?? 55, label: "Clube parceiro", detail: p.detail }
    }
  }

  for (const r of RIVALRIES) {
    if (pairMatch(teamAName, teamBName, r.a, r.b)) {
      return { kind: "rival", score: -70, label: "Rival", detail: r.detail }
    }
  }

  return { kind: "neutral", score: 0, label: "Neutro" }
}

export interface RelationshipEffect {
  /** Multiplica a CHANCE do clube vendedor aceitar (ex.: 0.55 rival, 1.25 grupo). */
  chanceMult: number
  /** Multiplica o PRECO pedido (rival cobra caro; grupo da desconto). */
  priceMult: number
  /** Se true, o clube recusa de cara vender ao rival (so cede com oferta gigante). */
  hardBlock: boolean
  /** Nota em PT-BR para a UI. */
  note: string
}

/**
 * Efeito do relacionamento sobre uma negociacao de COMPRA/EMPRESTIMO em que o clube
 * do usuario (`buyerName`) tenta tirar um jogador do `sellerName`.
 */
export function getRelationshipEffect(
  buyerName: string,
  sellerName: string,
  type: "buy" | "loan" = "buy",
): RelationshipEffect {
  const rel = getClubRelationship(buyerName, sellerName)

  switch (rel.kind) {
    case "group":
      return {
        chanceMult: type === "loan" ? 1.6 : 1.3,
        priceMult: type === "loan" ? 0.7 : 0.82,
        hardBlock: false,
        note: `Mesmo grupo (${rel.detail}): negocio facilitado, com prioridade e desconto.`,
      }
    case "satellite":
      return {
        chanceMult: type === "loan" ? 1.4 : 1.18,
        priceMult: type === "loan" ? 0.82 : 0.9,
        hardBlock: false,
        note: `${rel.detail}: relacao de confianca, a conversa flui.`,
      }
    case "rival":
      return {
        chanceMult: 0.4,
        priceMult: 1.6,
        hardBlock: true,
        note: `${rel.detail}: rival dificulta a venda — so libera por muito acima do valor.`,
      }
    default:
      return { chanceMult: 1, priceMult: 1, hardBlock: false, note: "" }
  }
}

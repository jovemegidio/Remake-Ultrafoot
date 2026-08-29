// O MERCADO SEGUE A MODALIDADE DA CARREIRA (1.0.335).
//
// Relato do usuário: "selecionei para jogar com um time feminino, mas o mercado
// exibe jogadores masculinos".
//
// A causa é estrutural, não um filtro esquecido. `generateDetailedMarketTargets`
// percorre `ALL_BF_TEAMS` — o pool do Brasfoot, que é INTEIRAMENTE masculino — e
// não tem como saber que carreira está aberta. A tela do mercado chamava essa
// função direto, então toda modalidade via a mesma vitrine.
//
// Aqui a modalidade passa a decidir DE ONDE saem os candidatos, e não a filtrar
// depois. Filtrar depois seria pior do que não fazer nada: o catálogo masculino
// não tem nenhuma atleta, então "filtrar" devolveria zero e a tela diria
// "nenhum atleta com esses filtros" — que é exatamente o print que veio junto.
//
// ⚠️ VALOR, ATRIBUTOS E ALEATORIEDADE SÃO OS DO JOGO, IMPORTADOS.
// `calcMarketValueFromAttrs`, `deriveStats` e o `mulberry32` vêm de
// `transfer-engine`. Escrever fórmula nova aqui repetiria o bug recorrente do
// projeto — duas escalas para a mesma grandeza —, e uma atleta de overall 82
// valeria uma fração do que vale um atleta de overall 82.

import {
  calcMarketValueFromAttrs,
  deriveStats,
  generateDetailedMarketTargets,
  hashSeed,
  mulberry32,
  type DetailedMarketTarget,
  type MarketTeamInfo,
} from "@/lib/transfer-engine"
import { getAllTimesFemininos, type Team } from "@/lib/teams-data"
import { getPlayersForTeam, type Player } from "@/lib/players-data"
import type { ModalidadeDeCarreira } from "@/lib/modalidade-de-carreira"
import { naEscalaDaModalidade } from "@/lib/tom-da-modalidade"

/**
 * Idade máxima de quem disputa a base. É o mesmo corte do nome da competição
 * (Sub-20) — não um número escolhido aqui.
 */
export const IDADE_MAXIMA_DA_BASE = 20

/** O `Team` do jogo já é, campo a campo, o que a vitrine precisa saber do clube. */
function clubeParaVitrine(team: Team, liga?: string): MarketTeamInfo {
  return {
    nome: team.nome,
    curto: team.curto,
    cidade: team.cidade ?? "",
    estado: team.estado ?? "",
    cor1: team.cor1 ?? "#888888",
    cor2: team.cor2 ?? "#222222",
    prestigio: team.prestigio ?? 70,
    torcida: team.torcida ?? 0,
    estadio_cap: team.estadio_cap ?? 20000,
    saldo: team.saldo ?? 0,
    file_key: team.file_key,
    estadio_nome: team.estadio_nome ?? "",
    patrocinador: team.patrocinador ?? "",
    escudo_url: team.escudo_url ?? "",
    divisao: String(team.divisao),
    pais: team.pais,
    liga: liga ?? String(team.divisao),
  }
}

const POSICOES_SECUNDARIAS: Record<string, string[]> = {
  GOL: [], ZAG: ["VOL"], LD: ["MEI"], LE: ["MEI"],
  VOL: ["MEI", "ZAG"], MEI: ["VOL", "ATA"], ATA: ["MEI"],
}

/**
 * Um atleta do elenco (a forma que o motor usa) vira um alvo da vitrine.
 *
 * O `id` é o índice no catálogo montado, como no gerador masculino: a tela e a
 * carência de negociação guardam esse número, então ele precisa ser estável
 * dentro da temporada — e é, porque o catálogo é construído na mesma ordem.
 */
function atletaParaAlvo(
  jogador: Player,
  clube: MarketTeamInfo,
  indice: number,
  rng: () => number,
): DetailedMarketTarget {
  const overall = Math.max(30, Math.min(99, Math.round(jogador.base)))
  const idade = jogador.idade
  // Mesma curva do gerador masculino: promessa jovem tem teto acima do overall,
  // veterano tem teto abaixo. Copiada de propósito para as duas vitrines
  // envelhecerem igual.
  const bonusDePotencial =
    idade < 20 ? 8 + Math.floor(rng() * 5)
      : idade < 23 ? 4 + Math.floor(rng() * 4)
        : idade < 27 ? 1 + Math.floor(rng() * 3)
          : idade < 31 ? Math.floor(rng() * 2) - 1
            : Math.floor(rng() * 2) - 3
  const posicao = String(jogador.pos || "MEI")
  // ⚠️ A ESCALA DA MODALIDADE ENTRA AQUI, e nao depois: `releaseClause` e
  // derivada de `valor` logo abaixo, e escalar so um dos dois deixaria a
  // multa rescisoria na escala masculina.
  //
  // `naEscalaDaModalidade` existia desde a 1.0.347 e NAO TINHA UM SO
  // CONSUMIDOR no jogo — so o gate a chamava. Media em 28/08/2026: o clube
  // feminino nascia com 12% do caixa e comprava a 100% do preco, entao o alvo
  // mediano custava 92% de todo o caixa dele (no masculino, 7%).
  const valor = naEscalaDaModalidade(calcMarketValueFromAttrs(overall, idade, clube.pais), "feminino")
  const alturaCm = posicao === "GOL" ? 172 + Math.floor(rng() * 10) : 160 + Math.floor(rng() * 20)

  return {
    id: indice + 1,
    name: jogador.nome,
    team: clube,
    position: posicao,
    secondaryPositions: POSICOES_SECUNDARIAS[posicao] ?? [],
    age: idade,
    overall,
    potential: Math.min(99, Math.max(overall, overall + bonusDePotencial)),
    value: valor,
    trend:
      idade < 23 ? (rng() < 0.6 ? "up" : "stable")
        : idade < 28 ? (rng() < 0.4 ? "stable" : rng() < 0.5 ? "up" : "down")
          : idade < 32 ? (rng() < 0.5 ? "down" : "stable") : "down",
    // Nacionalidade real quando o elenco importado a traz; o país do clube é o
    // palpite de reserva, como no masculino.
    nationality: jogador.nac ?? clube.pais ?? "Brasil",
    height: `${alturaCm} cm`,
    weight: `${Math.round(21.4 * (alturaCm / 100) ** 2)} kg`,
    foot: jogador.preferredFoot === "Esquerda" ? "E" : jogador.preferredFoot === "Direita" ? "D" : (rng() < 0.72 ? "D" : "E"),
    stats: deriveStats(posicao, overall, rng),
    releaseClause: rng() < 0.65 ? Math.round((valor * (2.2 + rng() * 0.8)) / 500_000) * 500_000 : null,
    scoutedBy: null,
    scoutProgress: 0,
  }
}

let _cacheFeminino: { chave: string; alvos: DetailedMarketTarget[] } | null = null

/**
 * A vitrine do futebol feminino: todas as atletas de todos os clubes femininos
 * do jogo, menos as do próprio clube.
 *
 * A fonte é a MESMA que monta o elenco em campo (`getPlayersForTeam`), que já
 * sabe ler `data/seeds/elencos-femininos.json` e cair no gerador quando o clube
 * não tem elenco importado. Duplicar essa decisão aqui faria a vitrine e o
 * elenco discordarem sobre quem joga onde.
 */
export function vitrineFeminina(clubeCurto: string, temporada = 0): DetailedMarketTarget[] {
  const chave = `${clubeCurto}|${temporada}`
  if (_cacheFeminino?.chave === chave) return _cacheFeminino.alvos

  const rng = mulberry32(hashSeed(`${clubeCurto}-${temporada}-mercado-feminino`))
  const alvos: DetailedMarketTarget[] = []
  for (const time of getAllTimesFemininos()) {
    if (time.curto === clubeCurto) continue
    const clube = clubeParaVitrine(time)
    for (const atleta of getPlayersForTeam(time)) {
      alvos.push(atletaParaAlvo(atleta, clube, alvos.length, rng))
    }
  }
  alvos.sort((a, b) => b.overall - a.overall)
  _cacheFeminino = { chave, alvos }
  return alvos
}

/**
 * A VITRINE QUE A CARREIRA ABERTA PODE VER.
 *
 * - `feminino` → clubes e atletas femininos (catálogo próprio).
 * - `sub20`    → o catálogo do mundo, cortado na idade da base. Quem dirige o
 *   Sub-20 não negocia com o elenco principal dos outros clubes; e o corte por
 *   idade usa o dado REAL de idade que o catálogo já tem, em vez de inventar um
 *   segundo cadastro de garotos.
 * - `profissional` / `jogador` → o mercado de sempre, sem mudança nenhuma.
 */
export function vitrineDaModalidade(opts: {
  modalidade: ModalidadeDeCarreira
  clubeCurto: string
  clubeNome?: string
  temporada?: number
}): DetailedMarketTarget[] {
  const { modalidade, clubeCurto, clubeNome, temporada = 0 } = opts

  if (modalidade === "feminino") return vitrineFeminina(clubeCurto, temporada)

  const doMundo = generateDetailedMarketTargets(clubeCurto, undefined, temporada, clubeNome)
  if (modalidade === "sub20") {
    // ⚠️ O PRECO DO SUB-20 SO PODE SER ESCALADO PORQUE A VERBA PASSOU A SER
    // LIMITADA (1.0.379). Ate a 1.0.378 a base gastava o caixa do clube
    // profissional inteiro; baratear o preco naquele mundo daria vinte vezes
    // mais poder de compra, e foi por isso que a escala ficou de fora la.
    // Agora as duas pontas andam juntas — verba e preco na mesma escala —,
    // como no feminino.
    return doMundo
      .filter(alvo => alvo.age <= IDADE_MAXIMA_DA_BASE)
      .map(alvo => ({
        ...alvo,
        value: naEscalaDaModalidade(alvo.value ?? 0, "sub20"),
        releaseClause: alvo.releaseClause == null
          ? alvo.releaseClause
          : naEscalaDaModalidade(alvo.releaseClause, "sub20"),
      }))
  }
  return doMundo
}

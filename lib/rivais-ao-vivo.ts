// JOGOS DO RIVAL, ACOMPANHADOS AO VIVO DURANTE A SUA PARTIDA.
//
// Enquanto o técnico joga, os concorrentes diretos jogam junto — e é isso que
// transforma uma rodada em briga de campeonato. Até aqui os outros resultados só
// apareciam DEPOIS, na tela de fim de rodada: durante os 90 minutos não havia
// como saber se vencer ainda dava a liderança, ou se o 5º colocado já tinha
// tropeçado e o G4 estava mais perto.
//
// COMO OS PLACARES EVOLUEM: cada partida rival tem os MINUTOS dos seus gols
// sorteados de forma determinística no começo; o placar exibido é simplesmente
// quantos desses minutos já passaram. Isso dá o efeito de acompanhamento sem
// simular onze motores em paralelo, e — o que importa mais — o mesmo jogo
// mostra sempre a mesma história: reabrir a tela não reescreve o que aconteceu.
//
// Não persiste nada, pelo mesmo motivo de lib/parallel-rounds: é dado de
// LEITURA, recalculável, e gravá-lo incharia o save sem necessidade.

/** Por que este jogo importa para o técnico. */
export type MotivoDoDestaque = "lider" | "titulo" | "g4" | "rebaixamento" | "perseguidor"

export interface JogoRival {
  homeCurto: string
  awayCurto: string
  homeNome: string
  awayNome: string
  /**
   * Posição do clube que TORNA o jogo relevante — o mais próximo do usuário na
   * tabela, e não o mais bem colocado do confronto.
   *
   * A diferença aparece num caso real que o teste pegou: para quem está em 7º,
   * "Líder x 10º" entra na lista por causa do 10º, que está a três posições. Com
   * a referência no melhor colocado, o cartão viria rotulado como jogo do LÍDER
   * — e o técnico leria uma briga de título onde a notícia é o perseguidor logo
   * atrás dele.
   */
  posicaoDeReferencia: number
  motivo: MotivoDoDestaque
}

export interface PlacarAoVivo {
  homeGols: number
  awayGols: number
  /** Minutos em que caíram os gols, para a tela poder anunciar "GOL agora". */
  minutosHome: readonly number[]
  minutosAway: readonly number[]
}

function semear(texto: string): number {
  let h = 2166136261
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function rng(semente: number): () => number {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Minutos dos gols de um lado.
 *
 * A força relativa desloca a média de gols. Os minutos são ORDENADOS: sem isso
 * o placar poderia "desandar" — um gol de 80' aparecendo antes de um de 20'.
 */
function minutosDeGol(semente: string, forca: number, forcaRival: number): number[] {
  const r = rng(semear(semente))
  const vantagem = (forca - forcaRival) / 100
  // ~1,3 gol de média entre iguais; a vantagem move para cima ou para baixo.
  const media = Math.max(0.25, 1.3 + vantagem * 1.6)
  // Poisson por inversão — o padrão para contagem de gols no futebol.
  const limite = Math.exp(-media)
  let p = 1
  let gols = 0
  while (gols < 6) {
    p *= r()
    if (p <= limite) break
    gols++
  }
  return Array.from({ length: gols }, () => 1 + Math.floor(r() * 90)).sort((a, b) => a - b)
}

/** Placar do rival NO MINUTO pedido. */
export function placarNoMinuto(
  jogo: Pick<JogoRival, "homeCurto" | "awayCurto">,
  forcaHome: number,
  forcaAway: number,
  minuto: number,
  semente = "",
): PlacarAoVivo {
  const chave = `${semente}:${jogo.homeCurto}x${jogo.awayCurto}`
  // O mando vale ~4 pontos de força, como no resto do motor.
  const minutosHome = minutosDeGol(`${chave}:h`, forcaHome + 4, forcaAway)
  const minutosAway = minutosDeGol(`${chave}:a`, forcaAway, forcaHome + 4)
  return {
    minutosHome,
    minutosAway,
    homeGols: minutosHome.filter(m => m <= minuto).length,
    awayGols: minutosAway.filter(m => m <= minuto).length,
  }
}

/** Houve gol neste minuto exato? Serve para a tela dar o alerta. */
export function golAgora(placar: PlacarAoVivo, minuto: number): "home" | "away" | null {
  if (placar.minutosAway.includes(minuto)) return "away"
  if (placar.minutosHome.includes(minuto)) return "home"
  return null
}

export interface LinhaDaTabela {
  teamShort: string
  points: number
}

/**
 * Quais jogos da rodada merecem espaço na tela.
 *
 * O critério é a DISTÂNCIA NA TABELA, não a fama do clube: o que interessa a
 * quem está em 7º é o 6º e o 8º, não o líder disparado. Só entra quem está a até
 * três posições — mais que isso vira placar de jornal, não briga.
 *
 * O líder entra sempre que o técnico está brigando pelo título (top 4), porque
 * aí ele é o adversário real mesmo estando longe na lista.
 */
export function jogosQueImportam(
  confrontosDaRodada: readonly { homeCurto: string; awayCurto: string; homeNome: string; awayNome: string }[],
  tabela: readonly LinhaDaTabela[],
  clubeDoUsuario: string,
  totalDeClubes = tabela.length,
  limite = 4,
): JogoRival[] {
  const posicao = new Map(tabela.map((l, i) => [l.teamShort, i + 1]))
  const minhaPos = posicao.get(clubeDoUsuario) ?? 0
  if (!minhaPos) return []

  const zonaDeQueda = totalDeClubes - 3

  const avaliados = confrontosDaRodada
    .filter(c => c.homeCurto !== clubeDoUsuario && c.awayCurto !== clubeDoUsuario)
    .map(c => {
      const pH = posicao.get(c.homeCurto) ?? 99
      const pA = posicao.get(c.awayCurto) ?? 99
      // O clube que interessa é o mais PRÓXIMO na tabela, não o melhor colocado.
      const maisPerto = Math.abs(pH - minhaPos) <= Math.abs(pA - minhaPos) ? pH : pA
      const distancia = Math.abs(maisPerto - minhaPos)

      let motivo: MotivoDoDestaque | null = null
      // O líder só é "o jogo do líder" quando ELE é o vizinho de tabela — quem
      // está em 7º e vê "Líder x 10º" está de olho no 10º, não no título.
      if (maisPerto === 1 && minhaPos <= 4) motivo = "lider"
      else if (distancia <= 3 && minhaPos <= 4) motivo = "titulo"
      else if (distancia <= 3 && minhaPos >= zonaDeQueda) motivo = "rebaixamento"
      else if (distancia <= 3 && minhaPos <= 8) motivo = "g4"
      else if (distancia <= 3) motivo = "perseguidor"
      if (!motivo) return null

      return { ...c, posicaoDeReferencia: maisPerto, motivo, distancia }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    // Mais perto de mim primeiro; empate desempata por quem está melhor colocado.
    .sort((a, b) => a.distancia - b.distancia || a.posicaoDeReferencia - b.posicaoDeReferencia)

  return avaliados.slice(0, limite).map(({ distancia: _d, ...jogo }) => jogo)
}

export const ROTULO_DO_MOTIVO: Record<MotivoDoDestaque, string> = {
  lider: "Líder",
  titulo: "Briga pelo título",
  g4: "Briga pelo G4",
  rebaixamento: "Zona de rebaixamento",
  perseguidor: "Rival direto",
}

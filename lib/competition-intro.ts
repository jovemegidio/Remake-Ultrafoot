// Sistema de intros cinematograficas por competicao - Ultrafoot 26
// Define quais competicoes tem intro animada, suas cores, trofeu e tagline.
// As intros tocam antes de abrir a tela da partida quando o jogo e de uma
// copa / competicao continental / selecao (NAO toca em jogos de pontos corridos).

export interface CompetitionIntroConfig {
  id: string
  /** Nome exibido em destaque na intro */
  name: string
  /** Subtitulo / tagline curta */
  tagline: string
  /** Caminho do trofeu (em /public) */
  trophy: string
  /** Logo opcional da competicao (em /public) */
  logo?: string
  /** Video local opcional (.mp4 em /public). Se existir, toca em vez da animacao. */
  video?: string
  colors: {
    primary: string
    accent: string
    /** gradiente de fundo (CSS) */
    background: string
    /** cor do texto principal */
    text: string
  }
}

// ── Configuracoes de intro por competicao ────────────────────────────────────
export const COMPETITION_INTROS: Record<string, CompetitionIntroConfig> = {
  libertadores: {
    id: "libertadores",
    name: "CONMEBOL Libertadores",
    tagline: "A GLORIA ETERNA",
    trophy: "/trofeus/tr_libertadores.png",
    logo: "/ligas/03.png",
    colors: {
      primary: "#d4af37",
      accent: "#ffd700",
      background: "radial-gradient(ellipse at center, #3d2a00 0%, #0a0a0a 70%)",
      text: "#ffffff",
    },
  },
  copa_brasil: {
    id: "copa_brasil",
    name: "Copa do Brasil",
    tagline: "O SONHO DE TODO CLUBE",
    trophy: "/trofeus/tr_copa_BRA.png",
    logo: "/ligas/02.png",
    colors: {
      primary: "#009c3b",
      accent: "#ffdf00",
      background: "radial-gradient(ellipse at center, #002776 0%, #0a0a0a 70%)",
      text: "#ffffff",
    },
  },
  copa_mundo: {
    id: "copa_mundo",
    name: "Copa do Mundo FIFA",
    tagline: "O MUNDO PARA NUM SO JOGO",
    trophy: "/trofeus/tr_copamundo.png",
    logo: "/competicoes/copa-do-mundo-2026.png",
    colors: {
      primary: "#d4af37",
      accent: "#f5d76e",
      background: "radial-gradient(ellipse at center, #1a2a4a 0%, #050810 70%)",
      text: "#ffffff",
    },
  },
  sulamericana: {
    id: "sulamericana",
    name: "CONMEBOL Sul-Americana",
    tagline: "A BATALHA CONTINENTAL",
    trophy: "/trofeus/tr_sulamericana.png",
    logo: "/ligas/04.png",
    colors: {
      primary: "#e63946",
      accent: "#ff6b6b",
      background: "radial-gradient(ellipse at center, #4a0d0d 0%, #0a0a0a 70%)",
      text: "#ffffff",
    },
  },
  champions_league: {
    id: "champions_league",
    name: "UEFA Champions League",
    tagline: "THE CHAMPIONS",
    trophy: "/trofeus/tr_ligacampeoes.png",
    colors: {
      primary: "#1a237e",
      accent: "#c0c0c0",
      background: "radial-gradient(ellipse at center, #1a237e 0%, #050510 70%)",
      text: "#ffffff",
    },
  },
  europa_league: {
    id: "europa_league",
    name: "UEFA Europa League",
    tagline: "A NOITE E DELAS",
    trophy: "/trofeus/tr_ligaeuropa.png",
    colors: {
      primary: "#f57c00",
      accent: "#ffb74d",
      background: "radial-gradient(ellipse at center, #4a2800 0%, #0a0a0a 70%)",
      text: "#ffffff",
    },
  },
  conference_league: {
    id: "conference_league",
    name: "UEFA Conference League",
    tagline: "RUMO A EUROPA",
    trophy: "/trofeus/tr_conference.png",
    colors: {
      primary: "#2e7d32",
      accent: "#81c784",
      background: "radial-gradient(ellipse at center, #1b4d1e 0%, #0a0a0a 70%)",
      text: "#ffffff",
    },
  },
  mundial_clubes: {
    id: "mundial_clubes",
    name: "Mundial de Clubes FIFA",
    tagline: "OS MELHORES DO MUNDO",
    trophy: "/trofeus/tr_mundial.png",
    colors: {
      primary: "#5b6cf0",
      accent: "#00c853",
      background: "radial-gradient(ellipse at center, #3d1a6d 0%, #0a0a0a 70%)",
      text: "#ffffff",
    },
  },
  supercopa: {
    id: "supercopa",
    name: "Supercopa do Brasil",
    tagline: "CAMPEAO DOS CAMPEOES",
    trophy: "/trofeus/tr_supercopa_BRA.png",
    colors: {
      primary: "#d4af37",
      accent: "#ffd700",
      background: "radial-gradient(ellipse at center, #1a1500 0%, #0a0a0a 70%)",
      text: "#ffffff",
    },
  },
  // A Supercopa da UEFA caia no `supercopa` acima e exibia o trofeu da Supercopa
  // do BRASIL — nome e arte de outra competicao. Agora tem a propria (o acervo
  // nao tem o trofeu da UEFA; usamos o generico, que ao menos nao mente).
  supercopa_uefa: {
    id: "supercopa_uefa",
    name: "Supercopa da UEFA",
    tagline: "CAMPEAO DA EUROPA X CAMPEAO DA LIGA EUROPA",
    trophy: "/trofeus/tr_supercopa_generico.png",
    colors: {
      primary: "#1e3a8a",
      accent: "#60a5fa",
      background: "radial-gradient(ellipse at center, #0b1530 0%, #05070f 70%)",
      text: "#ffffff",
    },
  },
  recopa: {
    id: "recopa",
    name: "Recopa Sul-Americana",
    tagline: "O CHOQUE DOS CAMPEOES",
    trophy: "/trofeus/tr_recopasulamaericana.png",
    colors: {
      primary: "#c0c0c0",
      accent: "#e8e8e8",
      background: "radial-gradient(ellipse at center, #404040 0%, #0a0a0a 70%)",
      text: "#ffffff",
    },
  },
  // Copas nacionais europeias (para times internacionais)
  copa_inglaterra: {
    id: "copa_inglaterra",
    name: "FA Cup",
    tagline: "THE OLDEST CUP",
    trophy: "/trofeus/tr_copa_ING.png",
    colors: {
      primary: "#c8102e",
      accent: "#ffffff",
      background: "radial-gradient(ellipse at center, #2a0008 0%, #0a0a0a 70%)",
      text: "#ffffff",
    },
  },
  copa_espanha: {
    id: "copa_espanha",
    name: "Copa del Rey",
    tagline: "LA COPA DEL REY",
    trophy: "/trofeus/tr_copa_ESP.png",
    colors: {
      primary: "#c60b1e",
      accent: "#ffc400",
      background: "radial-gradient(ellipse at center, #2a0006 0%, #0a0a0a 70%)",
      text: "#ffffff",
    },
  },
  copa_italia: {
    id: "copa_italia",
    name: "Coppa Italia",
    tagline: "LA COPPA NAZIONALE",
    trophy: "/trofeus/tr_copa_ITA.png",
    colors: {
      primary: "#0066b3",
      accent: "#ffffff",
      background: "radial-gradient(ellipse at center, #001a33 0%, #0a0a0a 70%)",
      text: "#ffffff",
    },
  },
}

// ── Mapeamento de nome de competicao -> intro ────────────────────────────────
// Os fixtures guardam `competition` como string de exibicao. Casamos por palavra-chave.
const INTRO_KEYWORDS: Array<{ keys: string[]; intro: string }> = [
  { keys: ["libertadores"], intro: "libertadores" },
  { keys: ["copa do brasil"], intro: "copa_brasil" },
  { keys: ["sul-americana", "sulamericana", "sudamericana", "sul americana"], intro: "sulamericana" },
  { keys: ["recopa"], intro: "recopa" },
  // A da UEFA vem ANTES do "supercopa" generico, senao e capturada por ele e
  // exibe o trofeu da Supercopa do Brasil.
  { keys: ["supercopa da uefa", "supercopa uefa", "uefa super cup", "super cup uefa"], intro: "supercopa_uefa" },
  { keys: ["supercopa", "super copa"], intro: "supercopa" },
  { keys: ["champions"], intro: "champions_league" },
  { keys: ["europa league", "uefa europa", "liga europa"], intro: "europa_league" },
  { keys: ["conference"], intro: "conference_league" },
  { keys: ["mundial de clubes", "mundial fifa", "club world", "mundial"], intro: "mundial_clubes" },
  { keys: ["copa do mundo", "world cup", "fifa world", "mundo fifa"], intro: "copa_mundo" },
  { keys: ["fa cup", "copa da inglaterra"], intro: "copa_inglaterra" },
  { keys: ["copa del rey", "copa do rei", "copa da espanha"], intro: "copa_espanha" },
  { keys: ["coppa italia", "copa da italia"], intro: "copa_italia" },
]

/**
 * Retorna a config de intro para um nome de competicao, ou null se nao houver
 * intro (ex: jogos de pontos corridos / estaduais nao tem intro).
 */
export function getIntroForCompetition(competitionName: string | undefined | null): CompetitionIntroConfig | null {
  if (!competitionName) return null
  const normalized = competitionName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  for (const { keys, intro } of INTRO_KEYWORDS) {
    if (keys.some(k => normalized.includes(k))) {
      return COMPETITION_INTROS[intro] ?? null
    }
  }
  return null
}

// ── Estado: intro pendente para a proxima partida ────────────────────────────
// Quando o usuario avanca o calendario e cai numa partida de copa, marcamos a
// intro pendente. A tela /partida consome e exibe a intro uma unica vez.
const PENDING_KEY = "ultrafoot:pending-intro"
const SEEN_KEY = "ultrafoot:intro-seen"

/** Marca que uma intro deve tocar na proxima tela de partida. */
export function setPendingIntro(competitionName: string): void {
  if (typeof window === "undefined") return
  const intro = getIntroForCompetition(competitionName)
  if (!intro) return
  window.sessionStorage.setItem(PENDING_KEY, intro.id)
}

/** Le (sem limpar) a intro pendente. */
export function getPendingIntro(): CompetitionIntroConfig | null {
  if (typeof window === "undefined") return null
  const id = window.sessionStorage.getItem(PENDING_KEY)
  if (!id) return null
  return COMPETITION_INTROS[id] ?? null
}

/** Limpa a intro pendente (apos exibir ou pular). */
export function clearPendingIntro(): void {
  if (typeof window === "undefined") return
  window.sessionStorage.removeItem(PENDING_KEY)
}

/**
 * Marca uma assinatura de partida como ja vista para nao repetir a intro caso o
 * usuario volte e entre de novo na mesma partida.
 */
export function markIntroSeen(signature: string): void {
  if (typeof window === "undefined") return
  window.sessionStorage.setItem(SEEN_KEY, signature)
}

export function wasIntroSeen(signature: string): boolean {
  if (typeof window === "undefined") return false
  return window.sessionStorage.getItem(SEEN_KEY) === signature
}

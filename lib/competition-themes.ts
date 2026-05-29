// Temas visuais por competicao - Ultrafoot 26
// Define cores, gradientes e estilos para cada liga/copa

export type CompetitionId = 
  | "brasileirao"
  | "copa_brasil"
  | "libertadores"
  | "sulamericana"
  | "champions_league"
  | "europa_league"
  | "conference_league"
  | "premier_league"
  | "la_liga"
  | "serie_a_ita"
  | "bundesliga"
  | "ligue_1"
  | "paulistao"
  | "carioca"
  | "mineiro"
  | "gaucho"
  | "supercopa"
  | "recopa"
  | "mundial_clubes"
  | "friendly"

export interface CompetitionTheme {
  id: CompetitionId
  name: string
  shortName: string
  logo?: string
  backgroundImage?: string // URL da imagem de fundo do tema
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    gradient: string
    text: string
    textSecondary: string
  }
  headerStyle: "solid" | "gradient" | "pattern"
}

export const competitionThemes: Record<CompetitionId, CompetitionTheme> = {
  brasileirao: {
    id: "brasileirao",
    name: "Campeonato Brasileiro Serie A",
    shortName: "BRASILEIRAO",
    backgroundImage: "/themes/brasileirao.png",
    colors: {
      primary: "#1db954",
      secondary: "#0a0a0a",
      accent: "#1ed760",
      background: "linear-gradient(135deg, #0a3d1f 0%, #0a0a0a 100%)",
      gradient: "linear-gradient(90deg, #1db954 0%, #0a3d1f 50%, #1db954 100%)",
      text: "#ffffff",
      textSecondary: "#1db954",
    },
    headerStyle: "gradient",
  },
  copa_brasil: {
    id: "copa_brasil",
    name: "Copa do Brasil",
    shortName: "COPA BR",
    backgroundImage: "/themes/copa-do-brasil.png",
    colors: {
      primary: "#009c3b",
      secondary: "#002776",
      accent: "#ffdf00",
      background: "linear-gradient(135deg, #002776 0%, #0a0a0a 100%)",
      gradient: "linear-gradient(90deg, #009c3b 0%, #002776 50%, #ffdf00 100%)",
      text: "#ffffff",
      textSecondary: "#ffdf00",
    },
    headerStyle: "gradient",
  },
  libertadores: {
    id: "libertadores",
    name: "CONMEBOL Libertadores",
    shortName: "LIBERTADORES",
    backgroundImage: "/themes/libertadores.png",
    colors: {
      primary: "#d4af37",
      secondary: "#1a1a1a",
      accent: "#ffd700",
      background: "linear-gradient(135deg, #3d2a00 0%, #0a0a0a 100%)",
      gradient: "linear-gradient(90deg, #d4af37 0%, #8b6914 50%, #ffd700 100%)",
      text: "#ffffff",
      textSecondary: "#d4af37",
    },
    headerStyle: "gradient",
  },
  sulamericana: {
    id: "sulamericana",
    name: "CONMEBOL Sul-Americana",
    shortName: "SULA",
    backgroundImage: "/themes/sudamericana.png",
    colors: {
      primary: "#e63946",
      secondary: "#1a1a1a",
      accent: "#ff6b6b",
      background: "linear-gradient(135deg, #4a0d0d 0%, #0a0a0a 100%)",
      gradient: "linear-gradient(90deg, #e63946 0%, #8b0000 50%, #ff6b6b 100%)",
      text: "#ffffff",
      textSecondary: "#e63946",
    },
    headerStyle: "gradient",
  },
  champions_league: {
    id: "champions_league",
    name: "UEFA Champions League",
    shortName: "UCL",
    colors: {
      primary: "#1a237e",
      secondary: "#0a0a0a",
      accent: "#c0c0c0",
      background: "linear-gradient(135deg, #1a237e 0%, #0a0a0a 100%)",
      gradient: "linear-gradient(90deg, #1a237e 0%, #0d1544 50%, #3f51b5 100%)",
      text: "#ffffff",
      textSecondary: "#c0c0c0",
    },
    headerStyle: "gradient",
  },
  europa_league: {
    id: "europa_league",
    name: "UEFA Europa League",
    shortName: "UEL",
    backgroundImage: "/themes/europa-league.png",
    colors: {
      primary: "#f57c00",
      secondary: "#1a1a1a",
      accent: "#ffb74d",
      background: "linear-gradient(135deg, #4a2800 0%, #0a0a0a 100%)",
      gradient: "linear-gradient(90deg, #f57c00 0%, #e65100 50%, #ffb74d 100%)",
      text: "#ffffff",
      textSecondary: "#f57c00",
    },
    headerStyle: "gradient",
  },
  conference_league: {
    id: "conference_league",
    name: "UEFA Conference League",
    shortName: "UECL",
    colors: {
      primary: "#2e7d32",
      secondary: "#1a1a1a",
      accent: "#81c784",
      background: "linear-gradient(135deg, #1b4d1e 0%, #0a0a0a 100%)",
      gradient: "linear-gradient(90deg, #2e7d32 0%, #1b5e20 50%, #81c784 100%)",
      text: "#ffffff",
      textSecondary: "#81c784",
    },
    headerStyle: "gradient",
  },
  premier_league: {
    id: "premier_league",
    name: "Premier League",
    shortName: "PL",
    colors: {
      primary: "#38003c",
      secondary: "#00ff85",
      accent: "#04f5ff",
      background: "linear-gradient(135deg, #38003c 0%, #0a0a0a 100%)",
      gradient: "linear-gradient(90deg, #38003c 0%, #1f0022 50%, #00ff85 100%)",
      text: "#ffffff",
      textSecondary: "#00ff85",
    },
    headerStyle: "gradient",
  },
  la_liga: {
    id: "la_liga",
    name: "LaLiga",
    shortName: "LALIGA",
    colors: {
      primary: "#ee8707",
      secondary: "#1a1a1a",
      accent: "#ff6b00",
      background: "linear-gradient(135deg, #4a2800 0%, #0a0a0a 100%)",
      gradient: "linear-gradient(90deg, #ee8707 0%, #dc2626 50%, #ff6b00 100%)",
      text: "#ffffff",
      textSecondary: "#ee8707",
    },
    headerStyle: "gradient",
  },
  serie_a_ita: {
    id: "serie_a_ita",
    name: "Serie A",
    shortName: "SERIE A",
    colors: {
      primary: "#024494",
      secondary: "#1a1a1a",
      accent: "#00b4d8",
      background: "linear-gradient(135deg, #024494 0%, #0a0a0a 100%)",
      gradient: "linear-gradient(90deg, #024494 0%, #001d42 50%, #00b4d8 100%)",
      text: "#ffffff",
      textSecondary: "#00b4d8",
    },
    headerStyle: "gradient",
  },
  bundesliga: {
    id: "bundesliga",
    name: "Bundesliga",
    shortName: "BUNDESLIGA",
    colors: {
      primary: "#d20515",
      secondary: "#1a1a1a",
      accent: "#ffffff",
      background: "linear-gradient(135deg, #4a0008 0%, #0a0a0a 100%)",
      gradient: "linear-gradient(90deg, #d20515 0%, #8b0000 50%, #ff4d4d 100%)",
      text: "#ffffff",
      textSecondary: "#d20515",
    },
    headerStyle: "gradient",
  },
  ligue_1: {
    id: "ligue_1",
    name: "Ligue 1",
    shortName: "LIGUE 1",
    colors: {
      primary: "#091c3e",
      secondary: "#d8e925",
      accent: "#d8e925",
      background: "linear-gradient(135deg, #091c3e 0%, #0a0a0a 100%)",
      gradient: "linear-gradient(90deg, #091c3e 0%, #061228 50%, #d8e925 100%)",
      text: "#ffffff",
      textSecondary: "#d8e925",
    },
    headerStyle: "gradient",
  },
  paulistao: {
    id: "paulistao",
    name: "Campeonato Paulista",
    shortName: "PAULISTAO",
    colors: {
      primary: "#1a4fd6",
      secondary: "#0a0a1a",
      accent: "#ff4500",
      background: "linear-gradient(135deg, #0a0a2e 0%, #1a0a0a 100%)",
      gradient: "linear-gradient(90deg, #1a4fd6 0%, #8b1a1a 50%, #ff4500 100%)",
      text: "#ffffff",
      textSecondary: "#ff4500",
    },
    headerStyle: "gradient",
  },
  carioca: {
    id: "carioca",
    name: "Campeonato Carioca",
    shortName: "CARIOCA",
    colors: {
      primary: "#2962ff",
      secondary: "#1a1a1a",
      accent: "#82b1ff",
      background: "linear-gradient(135deg, #0d2a66 0%, #0a0a0a 100%)",
      gradient: "linear-gradient(90deg, #2962ff 0%, #1a237e 50%, #82b1ff 100%)",
      text: "#ffffff",
      textSecondary: "#82b1ff",
    },
    headerStyle: "gradient",
  },
  mineiro: {
    id: "mineiro",
    name: "Campeonato Mineiro",
    shortName: "MINEIRO",
    colors: {
      primary: "#0d7377",
      secondary: "#0a1f20",
      accent: "#14a3a8",
      background: "linear-gradient(135deg, #0a1f20 0%, #0a0a0a 100%)",
      gradient: "linear-gradient(90deg, #0d7377 0%, #063d3f 50%, #14a3a8 100%)",
      text: "#ffffff",
      textSecondary: "#14a3a8",
    },
    headerStyle: "gradient",
  },
  gaucho: {
    id: "gaucho",
    name: "Campeonato Gaucho",
    shortName: "GAUCHO",
    colors: {
      primary: "#27ae60",
      secondary: "#1a1a1a",
      accent: "#58d68d",
      background: "linear-gradient(135deg, #145a32 0%, #0a0a0a 100%)",
      gradient: "linear-gradient(90deg, #27ae60 0%, #1e8449 50%, #58d68d 100%)",
      text: "#ffffff",
      textSecondary: "#58d68d",
    },
    headerStyle: "gradient",
  },
  supercopa: {
    id: "supercopa",
    name: "Supercopa do Brasil",
    shortName: "SUPERCOPA",
    colors: {
      primary: "#d4af37",
      secondary: "#0a0a0a",
      accent: "#ffd700",
      background: "linear-gradient(135deg, #1a1500 0%, #0a0a0a 100%)",
      gradient: "linear-gradient(90deg, #d4af37 0%, #8b6914 50%, #ffd700 100%)",
      text: "#ffffff",
      textSecondary: "#d4af37",
    },
    headerStyle: "gradient",
  },
  recopa: {
    id: "recopa",
    name: "Recopa Sul-Americana",
    shortName: "RECOPA",
    colors: {
      primary: "#c0c0c0",
      secondary: "#1a1a1a",
      accent: "#e8e8e8",
      background: "linear-gradient(135deg, #404040 0%, #0a0a0a 100%)",
      gradient: "linear-gradient(90deg, #c0c0c0 0%, #808080 50%, #e8e8e8 100%)",
      text: "#1a1a1a",
      textSecondary: "#c0c0c0",
    },
    headerStyle: "gradient",
  },
  mundial_clubes: {
    id: "mundial_clubes",
    name: "Mundial de Clubes FIFA",
    shortName: "MUNDIAL",
    colors: {
      primary: "#5b6cf0",
      secondary: "#00c853",
      accent: "#ff6b6b",
      background: "linear-gradient(135deg, #3d1a6d 0%, #1a4d3d 100%)",
      gradient: "linear-gradient(90deg, #5b6cf0 0%, #00c853 50%, #ff6b6b 100%)",
      text: "#ffffff",
      textSecondary: "#00c853",
    },
    headerStyle: "pattern",
  },
  friendly: {
    id: "friendly",
    name: "Amistoso",
    shortName: "AMISTOSO",
    colors: {
      primary: "#6b7280",
      secondary: "#1a1a1a",
      accent: "#9ca3af",
      background: "linear-gradient(135deg, #374151 0%, #0a0a0a 100%)",
      gradient: "linear-gradient(90deg, #6b7280 0%, #4b5563 50%, #9ca3af 100%)",
      text: "#ffffff",
      textSecondary: "#9ca3af",
    },
    headerStyle: "solid",
  },
}

// Helper para obter tema por ID
export function getCompetitionTheme(id: CompetitionId): CompetitionTheme {
  return competitionThemes[id] || competitionThemes.friendly
}

// Mapear divisao para competicao
export function getDivisionCompetition(divisao: string): CompetitionId {
  const map: Record<string, CompetitionId> = {
    serie_a: "brasileirao",
    serie_b: "brasileirao",
    serie_c: "brasileirao",
    serie_d: "brasileirao",
    premier_league: "premier_league",
    la_liga: "la_liga",
    serie_a_ita: "serie_a_ita",
    bundesliga: "bundesliga",
    ligue_1: "ligue_1",
    paulistao: "paulistao",
    carioca: "carioca",
    mineiro: "mineiro",
    gaucho: "gaucho",
  }
  return map[divisao] || "brasileirao"
}

// CSS vars helper
export function getCompetitionCSSVars(theme: CompetitionTheme): Record<string, string> {
  return {
    "--competition-primary": theme.colors.primary,
    "--competition-secondary": theme.colors.secondary,
    "--competition-accent": theme.colors.accent,
    "--competition-bg": theme.colors.background,
    "--competition-gradient": theme.colors.gradient,
    "--competition-text": theme.colors.text,
    "--competition-text-secondary": theme.colors.textSecondary,
  }
}

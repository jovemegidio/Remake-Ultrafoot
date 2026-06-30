// Registro central das 40 fases do Ultrafoot.
// Fonte da verdade: status de cada fase, arquivos relacionados, próximos passos.
// Usado para navegação interna, doc, e debugging — não tem efeito em runtime.

export type PhaseStatus = "skeleton" | "partial" | "implemented" | "missing"

export interface PhaseEntry {
  phase: number
  title: string
  status: PhaseStatus
  files: string[]
  routes?: string[]
  notes?: string
}

export const PHASES: PhaseEntry[] = [
  {
    phase: 1,
    title: "Core do modo carreira",
    status: "partial",
    files: [
      "lib/career-engine.ts",
      "lib/career-types.ts",
      "lib/save-system.ts",
      "lib/season-engine.ts",
      "lib/table-engine.ts",
      "lib/competition-engine.ts",
      "lib/save-engine.ts",
    ],
    notes: "career-engine já implementa fixtures + simulação CPU + tabela. Faltam: season-engine, table-engine, competition-engine, save-engine.",
  },
  {
    phase: 2,
    title: "Central da Temporada (HUB principal)",
    status: "skeleton",
    files: [],
    routes: ["app/central-da-temporada/page.tsx"],
    notes: "Substituirá dashboard quando implementada.",
  },
  {
    phase: 3,
    title: "Modo Desafios",
    status: "skeleton",
    files: ["lib/challenge-engine.ts"],
    routes: ["app/desafios/page.tsx"],
  },
  {
    phase: 4,
    title: "Reconstrução de clube",
    status: "skeleton",
    files: ["lib/rebuild-engine.ts"],
  },
  {
    phase: 5,
    title: "Base e jovens",
    status: "skeleton",
    files: ["lib/youth-engine.ts"],
    routes: ["app/base/page.tsx"],
  },
  {
    phase: 6,
    title: "Editor completo",
    status: "skeleton",
    files: [],
    routes: ["app/editor/page.tsx"],
    notes: "Conteúdo licenciado vem via packs externos (fase 7).",
  },
  {
    phase: 7,
    title: "Sistema de packs (.ultrafoot)",
    status: "skeleton",
    files: ["lib/pack-engine.ts"],
    notes: "Compatibilidade com packs Brasfoot/fantasy/retrô.",
  },
  {
    phase: 8,
    title: "Mercado de transferências",
    status: "skeleton",
    files: ["lib/transfer-engine.ts"],
    notes: "UI atual em app/mercado é mock — engine criado, falta integrar.",
  },
  {
    phase: 9,
    title: "Scouting",
    status: "skeleton",
    files: ["lib/scout-engine.ts"],
  },
  {
    phase: 10,
    title: "Staff técnico",
    status: "skeleton",
    files: ["lib/staff-engine.ts"],
  },
  {
    phase: 11,
    title: "Treino semanal",
    status: "skeleton",
    files: ["lib/training-engine.ts"],
  },
  {
    phase: 12,
    title: "Tática avançada",
    status: "skeleton",
    files: ["lib/tactics-engine.ts"],
  },
  {
    phase: 13,
    title: "Partida ao vivo: decisões",
    status: "skeleton",
    files: ["lib/match-decisions.ts"],
    notes: "Estende lib/match-engine.ts existente.",
  },
  {
    phase: 14,
    title: "Narração + Voz (howler.js)",
    status: "skeleton",
    files: ["lib/commentary-engine.ts", "lib/audio-commentary.ts"],
    notes: "Adicionar howler.js a package.json antes da implementação.",
  },
  {
    phase: 15,
    title: "Pós-jogo",
    status: "skeleton",
    files: ["lib/post-match-engine.ts"],
  },
  {
    phase: 16,
    title: "Moral e personalidade",
    status: "skeleton",
    files: ["lib/morale-engine.ts"],
  },
  {
    phase: 17,
    title: "Vestiário",
    status: "skeleton",
    files: ["lib/dressing-room-engine.ts"],
  },
  {
    phase: 18,
    title: "Diretoria",
    status: "skeleton",
    files: ["lib/board-engine.ts"],
  },
  {
    phase: 19,
    title: "Torcida",
    status: "skeleton",
    files: ["lib/fans-engine.ts"],
  },
  {
    phase: 20,
    title: "Entrevistas",
    status: "skeleton",
    files: ["lib/interviews-engine.ts"],
  },
  {
    phase: 21,
    title: "Eventos dinâmicos",
    status: "skeleton",
    files: ["lib/events-engine.ts"],
  },
  {
    phase: 22,
    title: "Rivalidades",
    status: "skeleton",
    files: ["lib/rivalry-engine.ts"],
  },
  {
    phase: 23,
    title: "Estádio e infraestrutura",
    status: "skeleton",
    files: ["lib/infrastructure-engine.ts"],
    routes: ["app/clube/page.tsx"],
  },
  {
    phase: 24,
    title: "Patrocínios",
    status: "skeleton",
    files: ["lib/sponsor-engine.ts"],
  },
  {
    phase: 25,
    title: "Receitas",
    status: "skeleton",
    files: ["lib/revenue-engine.ts"],
  },
  {
    phase: 26,
    title: "Seleções",
    status: "skeleton",
    files: ["lib/national-team-engine.ts"],
  },
  {
    phase: 27,
    title: "Futebol feminino",
    status: "skeleton",
    files: ["lib/women-football-engine.ts"],
    notes: "Estrutura para expansão futura.",
  },
  {
    phase: 28,
    title: "Modo Presidente",
    status: "skeleton",
    files: ["lib/president-mode-engine.ts"],
  },
  {
    phase: 29,
    title: "Multiplayer local",
    status: "skeleton",
    files: ["lib/multiplayer-engine.ts"],
  },
  {
    phase: 30,
    title: "Conquistas",
    status: "skeleton",
    files: ["lib/achievement-engine.ts"],
  },
  {
    phase: 31,
    title: "Museu do clube",
    status: "skeleton",
    files: ["lib/museum-engine.ts"],
  },
  {
    phase: 32,
    title: "Hall da Fama (técnico)",
    status: "skeleton",
    files: ["lib/hall-of-fame-engine.ts"],
  },
  {
    phase: 33,
    title: "Ranking dinâmico",
    status: "skeleton",
    files: ["lib/ranking-engine.ts"],
  },
  {
    phase: 34,
    title: "Reputação de jogadores",
    status: "skeleton",
    files: ["lib/reputation-engine.ts"],
  },
  {
    phase: 35,
    title: "Lesões",
    status: "skeleton",
    files: ["lib/injury-engine.ts"],
  },
  {
    phase: 36,
    title: "Disciplina",
    status: "skeleton",
    files: ["lib/discipline-engine.ts"],
  },
  {
    phase: 37,
    title: "Calendário realista",
    status: "skeleton",
    files: ["lib/calendar-engine.ts"],
  },
  {
    phase: 38,
    title: "IA dos clubes",
    status: "skeleton",
    files: ["lib/ai-club-engine.ts"],
  },
  {
    phase: 39,
    title: "Notícias dinâmicas",
    status: "skeleton",
    files: ["lib/news-engine.ts"],
  },
  {
    phase: 40,
    title: "Relatório final / metadados",
    status: "implemented",
    files: ["lib/phases-registry.ts"],
    notes: "Este arquivo. Mapa central de progresso.",
  },
]

export function getPhase(n: number): PhaseEntry | undefined {
  return PHASES.find(p => p.phase === n)
}

export function phasesByStatus(s: PhaseStatus): PhaseEntry[] {
  return PHASES.filter(p => p.status === s)
}

export function progressSummary(): { total: number; skeleton: number; partial: number; implemented: number; missing: number } {
  return {
    total: PHASES.length,
    skeleton: PHASES.filter(p => p.status === "skeleton").length,
    partial: PHASES.filter(p => p.status === "partial").length,
    implemented: PHASES.filter(p => p.status === "implemented").length,
    missing: PHASES.filter(p => p.status === "missing").length,
  }
}

import type { Game, Release, ChangelogEntry, News } from "@/lib/db/schema"

/**
 * Fonte de dados real do Launcher — sem banco de dados.
 *
 * Espelha os dados oficiais do Ultrafoot 26:
 *  - versão / publisher / tamanho vêm de src-tauri/tauri.conf.json e dos builds reais
 *  - releases e changelog vêm do histórico de versões do jogo
 *  - downloadUrl aponta para os setups reais publicados em
 *    github.com/jovemegidio/Ultrafoot26/releases  (mesmo endpoint do auto-updater)
 *
 * Para publicar uma nova versão: adicione um objeto em RELEASES (isLatest: true),
 * marque o anterior como isLatest: false, e some as entradas de changelog.
 */

const GITHUB = "https://github.com/jovemegidio/Ultrafoot26/releases/download"

/** Monta a URL real do setup.exe seguindo o padrão dos releases publicados. */
function setupUrl(version: string): string {
  return `${GITHUB}/build-${version}/Ultrafoot.26_${version}_x64-setup.exe`
}

export const GAMES: Game[] = [
  {
    id: 1,
    slug: "ultrafoot-26",
    name: "Ultrafoot 26",
    tagline: "O simulador de futebol brasileiro — gerencie seu clube da várzea à glória continental.",
    description:
      "Ultrafoot 26 é um simulador de gerenciamento de futebol com elencos, escudos e uniformes reais, " +
      "competições nacionais, estaduais e continentais fiéis ao calendário de 2026, motor de partida " +
      "realista e Área do Treinador completa.",
    developer: "Ultrafoot Studio",
    genre: "Simulador de Futebol / Manager",
    coverImage: "/games/ultrafoot-icon.png",
    bannerImage: "/games/ultrafoot.png",
    sizeMb: 438,
    isFeatured: true,
    createdAt: new Date("2026-05-01T00:00:00Z"),
  },
]

export const RELEASES: Release[] = [
  {
    id: 145,
    gameId: 1,
    version: "1.0.145",
    channel: "stable",
    title: "Datas reais das competições de 2026",
    downloadUrl: setupUrl("1.0.145"),
    sizeMb: 438,
    isLatest: true,
    isRequired: false,
    releasedAt: new Date("2026-07-23T00:00:00Z"),
    createdAt: new Date("2026-07-23T00:00:00Z"),
  },
  {
    id: 144,
    gameId: 1,
    version: "1.0.144",
    channel: "stable",
    title: "Área do Treinador: amistosos e entrosamento",
    downloadUrl: setupUrl("1.0.144"),
    sizeMb: 437,
    isLatest: false,
    isRequired: false,
    releasedAt: new Date("2026-07-21T00:00:00Z"),
    createdAt: new Date("2026-07-21T00:00:00Z"),
  },
  {
    id: 142,
    gameId: 1,
    version: "1.0.142",
    channel: "stable",
    title: "Registro e configurações sobrevivem à atualização",
    downloadUrl: setupUrl("1.0.142"),
    sizeMb: 436,
    isLatest: false,
    isRequired: true,
    releasedAt: new Date("2026-07-20T00:00:00Z"),
    createdAt: new Date("2026-07-20T00:00:00Z"),
  },
  {
    id: 141,
    gameId: 1,
    version: "1.0.141",
    channel: "stable",
    title: "Interface em vidro fosco e fundo em vídeo na partida",
    downloadUrl: setupUrl("1.0.141"),
    sizeMb: 435,
    isLatest: false,
    isRequired: false,
    releasedAt: new Date("2026-07-19T00:00:00Z"),
    createdAt: new Date("2026-07-19T00:00:00Z"),
  },
  {
    id: 140,
    gameId: 1,
    version: "1.0.140",
    channel: "stable",
    title: "Modo econômico e clubes faltantes",
    downloadUrl: setupUrl("1.0.140"),
    sizeMb: 434,
    isLatest: false,
    isRequired: false,
    releasedAt: new Date("2026-07-18T00:00:00Z"),
    createdAt: new Date("2026-07-18T00:00:00Z"),
  },
  {
    id: 139,
    gameId: 1,
    version: "1.0.139",
    channel: "stable",
    title: "Vagas continentais de 2026 fiéis à vida real",
    downloadUrl: setupUrl("1.0.139"),
    sizeMb: 433,
    isLatest: false,
    isRequired: false,
    releasedAt: new Date("2026-07-17T00:00:00Z"),
    createdAt: new Date("2026-07-17T00:00:00Z"),
  },
]

export const CHANGELOG: ChangelogEntry[] = [
  // 1.0.145
  { id: 1, releaseId: 145, type: "added", description: "Datas reais da Copa do Mundo e das competições continentais de 2026.", sortOrder: 0 },
  { id: 2, releaseId: 145, type: "changed", description: "Ligas e copas europeias e campeonatos estaduais ajustados às datas informadas.", sortOrder: 1 },
  { id: 3, releaseId: 145, type: "fixed", description: "Finais continentais com datas precisas (Europa 20/mai, Conference 27/mai, Sula 21/nov).", sortOrder: 2 },
  { id: 4, releaseId: 145, type: "removed", description: "Removidos 3 clubes duplicados (Al-Ahli, New York Red Bulls, Al-Hazem).", sortOrder: 3 },

  // 1.0.144
  { id: 5, releaseId: 144, type: "added", description: "Até 3 amistosos na Área do Treinador.", sortOrder: 0 },
  { id: 6, releaseId: 144, type: "added", description: "Treino de entrosamento na data FIFA.", sortOrder: 1 },
  { id: 7, releaseId: 144, type: "added", description: "Pausa para data FIFA no calendário de clubes.", sortOrder: 2 },

  // 1.0.142
  { id: 8, releaseId: 142, type: "fixed", description: "Registro e configurações agora sobrevivem à atualização automática.", sortOrder: 0 },
  { id: 9, releaseId: 142, type: "added", description: "Liga do Equador (que faltava) + 108 uniformes reais.", sortOrder: 1 },

  // 1.0.141
  { id: 10, releaseId: 141, type: "changed", description: "Menu de navegação em vidro fosco (90% transparente com desfoque leve).", sortOrder: 0 },
  { id: 11, releaseId: 141, type: "fixed", description: "Fundo fixo em vídeo na tela de partida — fim do \"image not found\".", sortOrder: 1 },

  // 1.0.140
  { id: 12, releaseId: 140, type: "added", description: "Modo econômico de verdade para máquinas mais fracas.", sortOrder: 0 },
  { id: 13, releaseId: 140, type: "added", description: "10 clubes que faltavam adicionados ao pool.", sortOrder: 1 },

  // 1.0.139
  { id: 14, releaseId: 139, type: "changed", description: "Vagas continentais de 2026 batem com a vida real.", sortOrder: 0 },
  { id: 15, releaseId: 139, type: "fixed", description: "Fim dos nomes obviamente fictícios no preenchimento de elencos.", sortOrder: 1 },
]

export const NEWS: News[] = [
  {
    id: 1,
    gameId: 1,
    title: "Calendário de 2026 completo: Copa do Mundo e continentais nas datas reais",
    category: "Atualização",
    excerpt:
      "A temporada 2026 chega com as datas reais da Copa do Mundo, Libertadores, Champions e Sul-Americana, além das finais continentais precisas.",
    body:
      "A versão 1.0.145 traz o calendário de 2026 fiel à vida real: Copa do Mundo, competições continentais e as finais em datas precisas. Ligas europeias e campeonatos estaduais também foram ajustados.",
    image: "/games/ultrafoot.png",
    isPinned: true,
    publishedAt: new Date("2026-07-23T00:00:00Z"),
  },
  {
    id: 2,
    gameId: 1,
    title: "Área do Treinador ganha amistosos e treino de entrosamento",
    category: "Novidades",
    excerpt:
      "Agende até 3 amistosos e use a data FIFA para treinar entrosamento do elenco.",
    body:
      "Agora você pode marcar até três amistosos pela Área do Treinador e aproveitar a pausa da data FIFA para um treino focado em entrosamento.",
    image: null,
    isPinned: false,
    publishedAt: new Date("2026-07-21T00:00:00Z"),
  },
  {
    id: 3,
    gameId: 1,
    title: "Seu progresso sobrevive às atualizações",
    category: "Correção",
    excerpt:
      "Registro e configurações passam a persistir através do atualizador automático.",
    body:
      "A partir da 1.0.142, o registro e as suas configurações permanecem intactos quando o jogo se atualiza sozinho. Atualização recomendada para todos.",
    image: null,
    isPinned: false,
    publishedAt: new Date("2026-07-20T00:00:00Z"),
  },
  {
    id: 4,
    gameId: 1,
    title: "Mundial de Clubes de 32 e Copa Intercontinental",
    category: "Novidades",
    excerpt:
      "Novas competições internacionais entram no ciclo com formato ampliado.",
    body:
      "O Mundial de Clubes de 32 times e a Copa Intercontinental agora fazem parte do calendário internacional do Ultrafoot 26.",
    image: null,
    isPinned: false,
    publishedAt: new Date("2026-07-15T00:00:00Z"),
  },
]

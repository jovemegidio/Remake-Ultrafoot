// TIPOS DO CATÁLOGO DO LAUNCHER.
//
// ⚠️ ISTO VIVIA EM `lib/db/schema.ts`, COMO TABELAS DO DRIZZLE.
//
// Aquele arquivo declarava quatro `pgTable` e derivava os tipos com
// `$inferSelect`; ao lado dele, `lib/db/index.ts` abria um `Pool` do Postgres
// com `process.env.DATABASE_URL`. Num launcher de export estático, que roda de
// arquivo local dentro do Tauri, não existe banco nenhum para conectar — o
// catálogo é o dado embutido em `lib/ultrafoot-data.ts`, e o que sobrava do
// drizzle era só a FORMA dos objetos. Eram três dependências (`drizzle-orm`,
// `pg`, `@types/pg`) instaladas, e uma string de conexão a um banco inexistente
// no meio de um aplicativo de desktop, para descrever quatro interfaces.
//
// A nulidade abaixo é EXATAMENTE a que o `$inferSelect` produzia: coluna
// `notNull()` vira `T`, o resto vira `T | null`. `default()` não entra na conta
// — ele preenche na escrita e não garante nada na leitura. Mantida igual de
// propósito: nenhum consumidor precisou mudar junto.

export interface Game {
  id: number
  slug: string
  name: string
  tagline: string | null
  description: string | null
  developer: string | null
  genre: string | null
  coverImage: string | null
  bannerImage: string | null
  sizeMb: number | null
  isFeatured: boolean | null
  createdAt: Date
}

export interface Release {
  id: number
  gameId: number
  version: string
  channel: string
  title: string | null
  downloadUrl: string | null
  sizeMb: number | null
  isLatest: boolean | null
  isRequired: boolean | null
  releasedAt: Date
  createdAt: Date
}

export interface ChangelogEntry {
  id: number
  releaseId: number
  type: string
  description: string
  sortOrder: number | null
}

export interface News {
  id: number
  gameId: number | null
  title: string
  category: string | null
  excerpt: string | null
  body: string | null
  image: string | null
  isPinned: boolean | null
  publishedAt: Date
}

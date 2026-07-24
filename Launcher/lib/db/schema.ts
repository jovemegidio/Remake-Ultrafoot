import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core"

export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tagline: text("tagline"),
  description: text("description"),
  developer: text("developer"),
  genre: text("genre"),
  coverImage: text("cover_image"),
  bannerImage: text("banner_image"),
  sizeMb: integer("size_mb").default(0),
  isFeatured: boolean("is_featured").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const releases = pgTable("releases", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull(),
  version: text("version").notNull(),
  channel: text("channel").notNull().default("stable"),
  title: text("title"),
  downloadUrl: text("download_url"),
  sizeMb: integer("size_mb").default(0),
  isLatest: boolean("is_latest").default(false),
  isRequired: boolean("is_required").default(false),
  releasedAt: timestamp("released_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const changelogEntries = pgTable("changelog_entries", {
  id: serial("id").primaryKey(),
  releaseId: integer("release_id").notNull(),
  type: text("type").notNull().default("added"),
  description: text("description").notNull(),
  sortOrder: integer("sort_order").default(0),
})

export const news = pgTable("news", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id"),
  title: text("title").notNull(),
  category: text("category").default("Novidades"),
  excerpt: text("excerpt"),
  body: text("body"),
  image: text("image"),
  isPinned: boolean("is_pinned").default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
})

export type Game = typeof games.$inferSelect
export type Release = typeof releases.$inferSelect
export type ChangelogEntry = typeof changelogEntries.$inferSelect
export type News = typeof news.$inferSelect

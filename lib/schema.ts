import { pgTable, text, jsonb, timestamp, integer } from 'drizzle-orm/pg-core'
import type { Chunk } from './types'

export const articles = pgTable('articles', {
  id:         text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  url:        text('url').notNull().unique(),
  title:      text('title').notNull(),
  byline:     text('byline'),
  chunks:     jsonb('chunks').notNull().$type<Chunk[]>(),
  language:   text('language').notNull().default('en'),
  cefrLevel:  text('cefr_level'),
  sourceMode: text('source_mode').notNull().default('url'),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// Documentation-only: this table is created/altered via scoped one-off SQL
// scripts, never `drizzle-kit push` — see CLAUDE.md (DATABASE_URL is shared
// with several other unrelated projects).
export const listeningSessions = pgTable('listening_sessions', {
  id:        text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  language:  text('language').notNull(),
  articleId: text('article_id'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  seconds:   integer('seconds').notNull(),
})

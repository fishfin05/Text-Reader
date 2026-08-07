import { pgTable, text, jsonb, timestamp } from 'drizzle-orm/pg-core'
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

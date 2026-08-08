import { neon } from '@neondatabase/serverless';
import type { Chunk, SourceMode } from './types';

function getSQL() {
  return neon(process.env.DATABASE_URL!);
}

export async function getArticleByUrl(url: string) {
  const sql = getSQL();
  const rows = await sql`SELECT * FROM articles WHERE url = ${url} LIMIT 1`;
  return rows[0] ?? null;
}

export async function getArticleById(id: string) {
  const sql = getSQL();
  const rows = await sql`SELECT * FROM articles WHERE id = ${id} LIMIT 1`;
  return rows[0] ?? null;
}

export async function createArticle(
  url: string,
  title: string,
  byline: string | null,
  chunks: Chunk[],
  language: string,
  cefrLevel: string | null,
  sourceMode: SourceMode
) {
  const sql = getSQL();
  const wordCount = chunks.reduce((sum, c) => sum + c.text.split(/\s+/).filter(Boolean).length, 0);
  const rows = await sql`
    INSERT INTO articles (url, title, byline, chunks, language, cefr_level, source_mode, word_count)
    VALUES (${url}, ${title}, ${byline}, ${JSON.stringify(chunks)}::jsonb, ${language}, ${cefrLevel}, ${sourceMode}, ${wordCount})
    RETURNING *
  `;
  return rows[0];
}

export async function updateArticleChunks(id: string, chunks: Chunk[]) {
  const sql = getSQL();
  await sql`
    UPDATE articles SET chunks = ${JSON.stringify(chunks)}::jsonb WHERE id = ${id}
  `;
}

export async function listArticles() {
  const sql = getSQL();
  return sql`
    SELECT
      id, title, byline, language, cefr_level, source_mode, created_at, word_count,
      chunks->0->>'text' AS snippet
    FROM articles
    ORDER BY created_at DESC
    LIMIT 200
  `;
}

export async function logListeningSession(
  language: string,
  articleId: string | null,
  startedAt: string,
  seconds: number
) {
  const sql = getSQL();
  await sql`
    INSERT INTO listening_sessions (language, article_id, started_at, seconds)
    VALUES (${language}, ${articleId}, ${startedAt}, ${seconds})
  `;
}

export async function getListeningTotals() {
  const sql = getSQL();
  return sql`
    SELECT language, SUM(seconds)::int AS seconds
    FROM listening_sessions
    GROUP BY language
    ORDER BY seconds DESC
  `;
}

export interface ListeningSessionRow {
  language: string;
  article_id: string | null;
  started_at: string;
  seconds: number;
}

export async function getListeningSessions(): Promise<ListeningSessionRow[]> {
  const sql = getSQL();
  return sql`
    SELECT language, article_id, started_at, seconds
    FROM listening_sessions
    ORDER BY started_at DESC
  ` as unknown as Promise<ListeningSessionRow[]>;
}

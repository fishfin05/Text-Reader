import { listArticles, getListeningSessions } from '@/lib/db';
import Library from '@/components/Library';
import type { LibraryEntry } from '@/lib/types';

// This page reads live DB state (articles + listening sessions) on every
// visit — without this it gets statically prerendered at deploy time and
// serves that frozen snapshot until the next deploy.
export const dynamic = 'force-dynamic';

export default async function LibraryPage() {
  const [rows, sessions] = await Promise.all([listArticles(), getListeningSessions()]);

  const entries: LibraryEntry[] = rows.map(r => ({
    id: r.id,
    title: r.title,
    byline: r.byline,
    language: r.language,
    cefrLevel: r.cefr_level,
    sourceMode: r.source_mode,
    createdAt: r.created_at,
    snippet: r.snippet,
    wordCount: r.word_count,
  }));

  const listeningSessions = sessions.map(s => ({
    language: s.language,
    startedAt: typeof s.started_at === 'string' ? s.started_at : new Date(s.started_at).toISOString(),
    seconds: s.seconds,
  }));

  return <Library entries={entries} listeningSessions={listeningSessions} />;
}

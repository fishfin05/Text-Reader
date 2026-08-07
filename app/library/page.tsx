import { listArticles } from '@/lib/db';
import Library from '@/components/Library';
import type { LibraryEntry } from '@/lib/types';

export default async function LibraryPage() {
  const rows = await listArticles();

  const entries: LibraryEntry[] = rows.map(r => ({
    id: r.id,
    title: r.title,
    byline: r.byline,
    language: r.language,
    cefrLevel: r.cefr_level,
    sourceMode: r.source_mode,
    createdAt: r.created_at,
    snippet: r.snippet,
  }));

  return <Library entries={entries} />;
}

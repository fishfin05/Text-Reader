import { listArticles, getListeningTotals } from '@/lib/db';
import Library from '@/components/Library';
import type { LibraryEntry } from '@/lib/types';

export default async function LibraryPage() {
  const [rows, totalsRows] = await Promise.all([listArticles(), getListeningTotals()]);

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

  const listeningTotals = totalsRows.map(r => ({ language: r.language as string, seconds: r.seconds as number }));

  return <Library entries={entries} listeningTotals={listeningTotals} />;
}

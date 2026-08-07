import { NextRequest } from 'next/server';
import { logListeningSession, getListeningTotals, getListeningSessions, type ListeningSessionRow } from '@/lib/db';

const MAX_SESSION_SECONDS = 6 * 60 * 60; // guard against bogus/runaway values

export async function POST(request: NextRequest) {
  try {
    const { language, articleId, startedAt, seconds } = await request.json();
    const clean = Math.floor(Number(seconds));
    if (!language || !startedAt || !clean || clean < 1) {
      return Response.json({ error: 'language, startedAt, and a positive seconds value are required' }, { status: 400 });
    }
    await logListeningSession(language, articleId ?? null, startedAt, Math.min(clean, MAX_SESSION_SECONDS));
    return Response.json({ ok: true });
  } catch (err) {
    console.error('Listening log error:', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Failed to log session' }, { status: 500 });
  }
}

function toCsv(rows: ListeningSessionRow[]): string {
  const header = 'language,article_id,started_at,seconds';
  const lines = rows.map(r =>
    [r.language, r.article_id ?? '', new Date(r.started_at).toISOString(), r.seconds].join(',')
  );
  return [header, ...lines].join('\n');
}

export async function GET(request: NextRequest) {
  try {
    if (request.nextUrl.searchParams.get('format') === 'csv') {
      const sessions = await getListeningSessions();
      return new Response(toCsv(sessions), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="listening-sessions.csv"',
        },
      });
    }
    const totals = await getListeningTotals();
    return Response.json({ totals });
  } catch (err) {
    console.error('Listening fetch error:', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Failed to load listening data' }, { status: 500 });
  }
}

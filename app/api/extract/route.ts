import { NextRequest } from 'next/server';
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import { getArticleByUrl, createArticle } from '@/lib/db';
import { simplifyText, generateGradedText, type ArticleLength } from '@/lib/ai';
import { WORDS_PER_MINUTE } from '@/lib/languages';
import type { Chunk, SourceMode } from '@/lib/types';

// Generate mode can chain up to 3 sequential AI calls (initial + 2 extend
// rounds) — give it plenty of room rather than risk a platform timeout
// killing a request mid-generation.
export const maxDuration = 180;

function splitIntoChunks(paragraphs: string[]): Chunk[] {
  const chunks: Chunk[] = [];
  let index = 0;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    const sentences = trimmed.match(/[^.!?]+[.!?]+[\s]*/g) || [trimmed];
    let current = '';

    for (const sentence of sentences) {
      if (current.length + sentence.length > 800 && current.length > 0) {
        chunks.push(makeChunk(index++, current.trim()));
        current = sentence;
      } else {
        current += sentence;
      }
    }
    if (current.trim()) chunks.push(makeChunk(index++, current.trim()));
  }

  return chunks;
}

function makeChunk(index: number, text: string): Chunk {
  return {
    index,
    text,
    wordTimestamps: text.split(/\s+/).filter(Boolean).map(w => ({ word: w, startTime: 0 })),
    audioUrl: null,
    voice: null,
  };
}

async function extractParagraphsFromUrl(url: string): Promise<{ title: string; byline: string | null; paragraphs: string[] }> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TextReader/1.0)' },
  });
  if (!res.ok) throw new Error(`Failed to fetch article: ${res.status}`);

  const html = await res.text();
  const { document } = parseHTML(html);

  // linkedom doesn't set document.baseURI so patch location manually
  try { (document as unknown as { _URL: string })._URL = url; } catch { /* ignore */ }

  const reader = new Readability(document as unknown as Document);
  const parsed = reader.parse();
  if (!parsed) throw new Error('Could not extract article content');

  const { document: contentDoc } = parseHTML(parsed.content ?? '');
  let paragraphs = Array.from(
    contentDoc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li')
  )
    .map(el => el.textContent?.trim() ?? '')
    .filter(t => t.length > 20);

  if (paragraphs.length === 0) {
    paragraphs = parsed.textContent?.split('\n').filter(l => l.trim().length > 20) ?? [];
  }

  return { title: parsed.title || 'Untitled', byline: parsed.byline || null, paragraphs };
}

function syntheticUrl(prefix: string): string {
  return `${prefix}:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const mode: SourceMode = body.mode ?? (body.text ? 'paste' : 'url');
    const language: string = body.language || 'en';
    const cefrLevel: string | null = body.cefrLevel || null;

    // ── generate mode ──────────────────────────────────────────────────────
    if (mode === 'generate') {
      const topic: string = (body.topic || '').trim();
      const length: ArticleLength = body.length || 30;
      if (!topic) return Response.json({ error: 'Topic required' }, { status: 400 });
      if (!cefrLevel) return Response.json({ error: 'CEFR level required to generate text' }, { status: 400 });

      const { title, paragraphs, actualWords } = await generateGradedText({ language, level: cefrLevel, topic, length });
      console.log(`Generated "${title}": ${actualWords} words (target ${length * WORDS_PER_MINUTE}) for a ${length}min request`);
      const chunks = splitIntoChunks(paragraphs);
      const data = await createArticle(syntheticUrl('gen'), title, null, chunks, language, cefrLevel, mode);
      return Response.json({ id: data.id, url: data.url, title: data.title, byline: null, chunks: data.chunks, createdAt: data.created_at });
    }

    // ── paste-text mode ──────────────────────────────────────────────────────
    if (mode === 'paste') {
      const text: string = (body.text || '').trim();
      if (!text) return Response.json({ error: 'Text required' }, { status: 400 });
      const title: string = (body.title || '').trim() || 'Untitled';

      let paragraphs = text
        .split('\n')
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 20);
      if (paragraphs.length === 0) paragraphs = [text];

      if (cefrLevel) {
        paragraphs = await simplifyText({ paragraphs, language, level: cefrLevel });
      }

      const chunks = splitIntoChunks(paragraphs);
      const data = await createArticle(syntheticUrl('text'), title, null, chunks, language, cefrLevel, mode);
      return Response.json({ id: data.id, url: data.url, title: data.title, byline: null, chunks: data.chunks, createdAt: data.created_at });
    }

    // ── url mode ──────────────────────────────────────────────────────────
    const url: string = (body.url || '').trim();
    if (!url) return Response.json({ error: 'URL required' }, { status: 400 });

    // Only reuse the cache for unmodified (no-level) reads — a leveled read
    // always regenerates, since the cached copy is the original, unsimplified text.
    if (!cefrLevel) {
      const existing = await getArticleByUrl(url);
      if (existing) {
        return Response.json({
          id: existing.id,
          url: existing.url,
          title: existing.title,
          byline: existing.byline,
          chunks: existing.chunks,
          createdAt: existing.created_at,
        });
      }
    }

    const { title, byline, paragraphs: extracted } = await extractParagraphsFromUrl(url);
    const paragraphs = cefrLevel
      ? await simplifyText({ paragraphs: extracted, language, level: cefrLevel })
      : extracted;

    const chunks = splitIntoChunks(paragraphs);
    const storedUrl = cefrLevel ? syntheticUrl('url') : url;
    const data = await createArticle(storedUrl, title, byline, chunks, language, cefrLevel, mode);

    return Response.json({
      id: data.id,
      url: data.url,
      title: data.title,
      byline: data.byline,
      chunks: data.chunks,
      createdAt: data.created_at,
    });
  } catch (err) {
    console.error('Extract error:', err);
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to extract article' },
      { status: 500 }
    );
  }
}

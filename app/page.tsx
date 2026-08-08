'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Spanish' },
  { id: 'fr', label: 'French' },
  { id: 'de', label: 'German' },
  { id: 'it', label: 'Italian' },
  { id: 'pt', label: 'Portuguese' },
];

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

const LENGTHS = [10, 20, 30] as const;

type Mode = 'url' | 'paste' | 'generate';
type Length = (typeof LENGTHS)[number];

export default function Home() {
  // Server and client must render the same thing on first paint (no
  // localStorage server-side), or React throws a hydration mismatch — so
  // these all start with a fixed default and get synced from localStorage
  // in an effect, which only ever runs client-side, after hydration.
  const [mode, setMode] = useState<Mode>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [length, setLength] = useState<Length>(30);
  const [language, setLanguage] = useState('en');
  const [level, setLevel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    // One-time hydration-safe sync from localStorage — not derived state,
    // just reading an external browser API that isn't available server-side.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode((localStorage.getItem('reader-mode') as Mode) || 'url');
    setLanguage(localStorage.getItem('reader-language') || 'en');
    setLevel(localStorage.getItem('reader-level') || '');
  }, []);

  const updateMode = (v: Mode) => {
    setMode(v);
    localStorage.setItem('reader-mode', v);
  };

  const updateLanguage = (v: string) => {
    setLanguage(v);
    localStorage.setItem('reader-language', v);
  };

  const updateLevel = (v: string) => {
    setLevel(v);
    localStorage.setItem('reader-level', v);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const cefrLevel = level || null;
      const body =
        mode === 'url' ? { mode, url: url.trim(), language, cefrLevel }
        : mode === 'paste' ? { mode, text: text.trim(), title: title.trim() || 'Untitled', language, cefrLevel }
        : { mode, topic: topic.trim(), language, cefrLevel, length };

      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const raw = await res.text();
      let data: { id?: string; error?: string };
      try { data = JSON.parse(raw); }
      catch { throw new Error(`Server error (${res.status}): ${raw.slice(0, 200)}`); }

      if (!res.ok) throw new Error(data.error || 'Failed to load article');
      router.push(`/reader/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  const isValid =
    mode === 'url' ? url.trim().length > 0
    : mode === 'paste' ? text.trim().length > 0
    : topic.trim().length > 0 && level.length > 0;

  const submitLabel = mode === 'generate' ? 'Generate Article' : 'Load Article';

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center relative">
          <Link href="/library" className="absolute right-0 top-1 text-sm text-blue-600 font-medium">My Articles</Link>
          <h1 className="text-3xl font-bold text-gray-900">Text Reader</h1>
          <p className="mt-2 text-gray-500 text-sm">Comprehensible-input narration, at your level</p>
        </div>

        {/* Language + Level */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Language</label>
            <select
              value={language}
              onChange={e => updateLanguage(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Level</label>
            <select
              value={level}
              onChange={e => updateLevel(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">As-is</option>
              {LEVELS.map(lv => <option key={lv} value={lv}>{lv}</option>)}
            </select>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex bg-gray-100 rounded-xl p-1">
          {([
            { id: 'url' as const, label: 'URL' },
            { id: 'paste' as const, label: 'Paste' },
            { id: 'generate' as const, label: 'Generate' },
          ]).map(m => (
            <button
              key={m.id}
              onClick={() => updateMode(m.id)}
              className={['flex-1 py-2 text-sm font-medium rounded-lg transition-colors', mode === m.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'].join(' ')}
            >
              {m.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'url' && (
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              required
              autoFocus
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            />
          )}

          {mode === 'paste' && (
            <>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Title (optional)"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
              />
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Paste your article, essay, or any text here…"
                required
                autoFocus
                rows={8}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base resize-none"
              />
            </>
          )}

          {mode === 'generate' && (
            <>
              <textarea
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="What should the article be about? e.g. 'a trip to a coffee shop', 'the history of the Eiffel Tower'…"
                required
                autoFocus
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base resize-none"
              />
              <div className="flex gap-2">
                {LENGTHS.map(minutes => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => setLength(minutes)}
                    className={[
                      'flex-1 py-2 rounded-xl text-sm font-medium border transition-colors',
                      length === minutes ? 'bg-blue-50 border-blue-400 text-blue-700' : 'border-gray-300 text-gray-500 hover:bg-gray-50',
                    ].join(' ')}
                  >
                    {minutes} min
                  </button>
                ))}
              </div>
              {!level && (
                <p className="text-xs text-amber-600 text-center">Pick a level above to generate an article.</p>
              )}
            </>
          )}

          {mode !== 'generate' && level && (
            <p className="text-xs text-blue-600 text-center">Will be simplified to CEFR {level}.</p>
          )}

          <button
            type="submit"
            disabled={loading || !isValid}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium text-base hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                {mode === 'generate' ? 'Generating…' : 'Loading…'}
              </>
            ) : submitLabel}
          </button>
        </form>

        {error && (
          <p className="text-sm text-red-600 text-center bg-red-50 px-4 py-3 rounded-lg">{error}</p>
        )}

        <p className="text-xs text-gray-400 text-center">
          {mode === 'url' && 'Works with most news sites, blogs, and long-form articles.'}
          {mode === 'paste' && 'Paste any text — articles, book chapters, documents.'}
          {mode === 'generate' && 'AI writes a new article at your level and topic.'}
          <br/>First listen takes a moment to generate audio per paragraph.
        </p>
      </div>
    </main>
  );
}

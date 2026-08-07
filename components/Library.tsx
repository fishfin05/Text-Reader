'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { LibraryEntry } from '@/lib/types';
import { languageName } from '@/lib/languages';

const SOURCE_LABELS: Record<string, string> = {
  url: 'URL',
  paste: 'Pasted',
  generate: 'Generated',
};

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function Library({ entries }: { entries: LibraryEntry[] }) {
  const [language, setLanguage] = useState('');
  const [level, setLevel] = useState('');

  const languages = useMemo(
    () => Array.from(new Set(entries.map(e => e.language))).sort(),
    [entries]
  );
  const levels = useMemo(
    () => Array.from(new Set(entries.map(e => e.cefrLevel).filter((l): l is string => !!l))).sort(),
    [entries]
  );

  const filtered = entries.filter(e =>
    (!language || e.language === language) && (!level || e.cefrLevel === level)
  );

  return (
    <main className="min-h-screen bg-gray-50 pb-10">
      <div className="px-4 py-4 border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">My Articles</h1>
          <Link href="/" className="text-blue-600 text-sm font-medium">+ New</Link>
        </div>

        {(languages.length > 1 || levels.length > 0) && (
          <div className="max-w-2xl mx-auto flex gap-2 mt-3 overflow-x-auto">
            {languages.length > 1 && (
              <select
                value={language}
                onChange={e => setLanguage(e.target.value)}
                className="text-xs px-2 py-1.5 border border-gray-300 rounded-lg bg-white text-gray-700"
              >
                <option value="">All languages</option>
                {languages.map(l => <option key={l} value={l}>{languageName(l)}</option>)}
              </select>
            )}
            {levels.length > 0 && (
              <select
                value={level}
                onChange={e => setLevel(e.target.value)}
                className="text-xs px-2 py-1.5 border border-gray-300 rounded-lg bg-white text-gray-700"
              >
                <option value="">All levels</option>
                {levels.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            )}
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400 text-sm">
            {entries.length === 0 ? (
              <>No articles yet. <Link href="/" className="text-blue-600">Load your first one</Link>.</>
            ) : (
              'No articles match these filters.'
            )}
          </div>
        )}

        {filtered.map(e => (
          <Link
            key={e.id}
            href={`/reader/${e.id}`}
            className="block bg-white rounded-xl px-4 py-3 border border-gray-200 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-medium text-gray-900 text-sm leading-snug truncate flex-1">{e.title}</h2>
              <span className="text-[11px] text-gray-400 whitespace-nowrap shrink-0">{formatRelativeTime(e.createdAt)}</span>
            </div>
            {e.snippet && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{e.snippet}</p>
            )}
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-[11px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                {e.cefrLevel ? `${e.cefrLevel} · ` : ''}{languageName(e.language)}
              </span>
              <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {SOURCE_LABELS[e.sourceMode] ?? e.sourceMode}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}

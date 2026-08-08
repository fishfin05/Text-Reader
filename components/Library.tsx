'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import type { LibraryEntry } from '@/lib/types';
import { languageName, WORDS_PER_MINUTE } from '@/lib/languages';

const SOURCE_LABELS: Record<string, string> = {
  url: 'URL',
  paste: 'Pasted',
  generate: 'Generated',
};

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

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

interface ListeningSession {
  language: string;
  startedAt: string;
  seconds: number;
}

interface LanguageStats {
  language: string;
  today: number;
  week: number;
  total: number;
}

function computeStats(sessions: ListeningSession[]): LanguageStats[] {
  const now = Date.now();
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const byLanguage = new Map<string, LanguageStats>();
  for (const s of sessions) {
    const stats = byLanguage.get(s.language) ?? { language: s.language, today: 0, week: 0, total: 0 };
    const startedAt = new Date(s.startedAt).getTime();
    stats.total += s.seconds;
    if (startedAt >= sevenDaysAgo) stats.week += s.seconds;
    if (startedAt >= startOfToday) stats.today += s.seconds;
    byLanguage.set(s.language, stats);
  }
  return Array.from(byLanguage.values()).sort((a, b) => b.total - a.total);
}

export default function Library({
  entries,
  listeningSessions,
}: {
  entries: LibraryEntry[];
  listeningSessions: ListeningSession[];
}) {
  const [language, setLanguage] = useState('');
  const [level, setLevel] = useState('');
  const listeningStats = useMemo(() => computeStats(listeningSessions), [listeningSessions]);

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

      {listeningStats.length > 0 && (
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-400">Time practiced</span>
              <a href="/api/listening?format=csv" download className="text-xs text-blue-600 font-medium">
                Export CSV
              </a>
            </div>
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1 text-sm items-center">
              <span className="text-[11px] font-medium text-gray-400"></span>
              <span className="text-[11px] font-medium text-gray-400 text-right">Today</span>
              <span className="text-[11px] font-medium text-gray-400 text-right">Week</span>
              <span className="text-[11px] font-medium text-gray-400 text-right">Total</span>
              {listeningStats.map(s => (
                <Fragment key={s.language}>
                  <span className="text-gray-700 font-medium">{languageName(s.language)}</span>
                  <span className="text-gray-600 text-right">{formatDuration(s.today)}</span>
                  <span className="text-gray-600 text-right">{formatDuration(s.week)}</span>
                  <span className="text-gray-600 text-right">{formatDuration(s.total)}</span>
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      )}

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
              <span className="text-[11px] text-gray-400">
                {formatDuration(Math.round((e.wordCount / WORDS_PER_MINUTE) * 60))} at 1x
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}

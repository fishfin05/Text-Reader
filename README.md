# Text Reader

Comprehensible-input reader PWA: pick a language and CEFR level, then paste a URL/text (optionally simplified to your level) or give a topic to have an article generated from scratch — get synced text-to-speech (word-level highlighting, click-to-seek) tuned to that level.

## Stack

Next.js PWA (`@ducanh2912/next-pwa`), Neon Postgres + Drizzle ORM, `@mozilla/readability` + `linkedom` for content extraction, Google Cloud TTS, Vercel Blob for audio caching, `ai` SDK + Vercel AI Gateway (`anthropic/claude-sonnet-5`) for simplification/generation.

## How it works

1. **Intake** (`app/page.tsx`) — pick a language (en/es/fr/de/it/pt) and CEFR level (or "As-is"), then one of three modes: **URL** (server fetches it with a Mozilla user-agent), **Paste** (raw text with an optional title), or **Generate** (a topic + length, no source text at all).
2. **Extraction/Simplify/Generate** (`app/api/extract/route.ts`) — for URL/Paste, `linkedom` + `@mozilla/readability` pull the main content out (paragraphs/headings/list items under 20 characters filtered as noise); if a level is set, `lib/ai.ts`'s `simplifyText()` rewrites it to that CEFR level before chunking. For Generate mode, `generateGradedText()` writes an original article from a topic at the target level/length — no extraction step at all.
3. **Chunking** — cleaned content is split into ~800-character chunks at sentence boundaries. Each chunk is stored with an index, the text, a word-timestamps array, and (once generated) an audio URL.
4. **TTS** (`app/api/tts/route.ts`) — Google Cloud TTS generates SSML-marked audio with word-level timing data, using a `languageCode` derived from the article's language; the MP3 is cached in Vercel Blob so it's not regenerated on replay. Voice options come from `app/api/voices/route.ts`, which queries Google's live voice catalog per language (cached in-memory) rather than a hardcoded list — works for any of the supported languages, not just English.
5. **Reader** (`app/reader/[id]/page.tsx` + `components/Reader.tsx`) — playback syncs to individual words via the timestamp array (click any word to seek there), playback rate 0.75x–2x, ±15s skip, per-chunk seeking, per-language voice preference (localStorage), CEFR/language badge in the header.

## Database (`lib/schema.ts`)

Single `articles` table: `id` (UUID), `url` (unique — synthetic for paste/generate/leveled reads), `title`, `byline`, `chunks` (JSONB array of `{index, text, wordTimestamps, audioUrl}`), `language`, `cefrLevel` (nullable — null means "as-is, no leveling"), `sourceMode` (`url`/`paste`/`generate`), `createdAt`. No separate progress table.

⚠️ The Neon database behind `DATABASE_URL` is **shared with several other personal projects** (Estira, WaniKani, Abacus, JLPT Level Estimator). Never run `drizzle-kit push` here — it diffs the entire database and will propose dropping every table not declared in this project's `schema.ts`. Apply schema changes as scoped `ALTER TABLE` statements instead.

## Known gaps (intentionally not built yet)

- **No persistent library/collections** — each article exists standalone; there's no "your saved articles" list view, and no way to browse by language/level.
- **No saved reading progress** — current chunk/word position is tracked live in the client during a session but isn't written back to the DB, so reopening an article starts from the top.
- **No Japanese/CJK support** — word-highlighting splits on whitespace, which doesn't segment CJK text; needs a real tokenizer first.
- **No independent difficulty scoring** — simplify/generate trust the model's self-reported CEFR level rather than verifying it against a frequency-based engine.
- **No vocabulary/SRS tracking** — words looked up during reading aren't captured anywhere for spaced-repetition review.
- PWA manifest (`public/manifest.json`) makes the app installable, but there's no service worker doing actual offline asset caching yet — it's installable, not offline-capable.

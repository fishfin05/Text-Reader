# Text Reader — Project Status

> Vault note: [Text Reader](obsidian://open?vault=Notes&file=Projects%2FStarted%2FText%20Reader)

## What It Offers
A PWA (Progressive Web App) for **comprehensible-input language learning**: paste a URL/text or give a topic, pick a language and CEFR level, and get synchronized, audiobook-quality narration tuned to that level. Core flow: choose language + level → content is fetched/simplified/generated → chunked → Google Cloud TTS generates audio with word-level timing marks → playback with word-by-word highlighting. Features:

- Three intake modes: **URL** (Readability extraction), **Paste** (raw text), **Generate** (AI writes an original graded-reader article from a topic)
- Per-article **language** (English, Spanish, French, German, Italian, Portuguese) and **CEFR level** (A1–C2)
- **AI simplification** — pasted/URL content gets rewritten to the chosen CEFR level before narration (Vercel AI Gateway + Claude), original meaning/structure preserved
- **AI generation** — give a topic + language + level + length (short/medium/long, defaults to long for long-form listening), get an original article written for that level
- Word-level synchronized highlighting (yellow = current word, gray = past)
- Playback controls: play/pause, skip ±15s, 5 speed settings (0.75x–2x)
- Dynamic, per-language TTS voice catalog (queried live from Google Cloud TTS, not hardcoded — works for any supported language)
- Click any word to jump to that position in the audio
- Global progress bar with drag-to-seek
- Smart chunk preloading (next chunk generates while current plays)
- Article caching in Neon Postgres + Vercel Blob (no regenerating the same as-is URL twice; leveled/generated reads always produce fresh content)
- Installable as a PWA (manifest configured)

**Tech**: Next.js, Neon Postgres + Drizzle ORM, Google Cloud TTS (v1beta1 SSML marks), Vercel Blob (OIDC-authenticated locally), Vercel AI Gateway (`ai` SDK, `anthropic/claude-sonnet-5`), Mozilla Readability + linkedom.

**Local dev setup**: `vercel link` then `vercel env pull --environment=production` gets `DATABASE_URL` and enables OIDC for Blob/AI Gateway — but `DATABASE_URL` and `GOOGLE_TTS_API_KEY` are stored as Vercel "sensitive" vars and can't actually be retrieved this way (pull writes a `[SENSITIVE]` placeholder). `DATABASE_URL` is already in `.env.local`; `GOOGLE_TTS_API_KEY` still needs to be pasted in manually from Google Cloud Console → APIs & Services → Credentials.

⚠️ **`DATABASE_URL` points to a Neon database shared with several other projects** (Estira, WaniKani, Abacus, JLPT Level Estimator all have tables in it). Never run `drizzle-kit push` against it — it diffs the whole database and will try to drop every table not in this project's `schema.ts`. Use scoped `ALTER TABLE` statements for schema changes instead.

---

## The Ideal
The best way to get comprehensible input passively — commuting, doing dishes, etc. — in whatever language you're learning, at whatever level you're at, without losing your place. The ideal version:

- Paste a URL or give a topic, pick your level, it "just works" like a personal graded-reader assistant
- A library of all your past articles (by language/level), resumable from where you left off
- Fully offline-capable PWA — install it, it works without internet for already-fetched articles
- Clean, distraction-free UI that feels as polished as a real audiobook app
- Vocabulary you look up gets captured into spaced-repetition review (inspired by Lingua/Anime Subs ES)
- Japanese/CJK support once word-tokenization is solved
- Potential monetization: subscription for unlimited articles + premium voices

---

## Currently Falling Short

### Critical gaps
1. **No reading progress persistence** — closing the tab loses your position. Every article restarts from the beginning.
2. **No article library** — articles are stored in the database but there's no "My Articles" page to browse or resume them, and no way to filter by language/level. The only way back to an article is if you kept the link.
3. **Offline mode incomplete** — the PWA manifest is configured and the app is installable, but there's no service worker or asset caching. It's not actually usable offline.
4. **PWA icons missing** — `manifest.json` references `/icon-192.png` and `/icon-512.png` but these files don't exist in `/public/`. Browsers will show installation warnings.
5. **No Japanese/CJK support** — word-highlighting splits text on whitespace, which doesn't work for languages without spaces between words. Needs a real tokenizer (e.g. kuromoji) before Japanese/Chinese can be added; would likely also want JLPT-style leveling (N5–N1) instead of CEFR for Japanese specifically.

### Language-learning follow-ups (not built yet, by design — see PROJECT_STATUS at time of the CI pivot)
6. **No independent difficulty verification** — simplified/generated text trusts the model's self-reported CEFR level rather than being scored by a separate frequency-based engine (like `spanish-cefr-engine`/CEFR Search Badges' `LanguageProfile` pattern). Fine for v1; worth revisiting if leveling accuracy becomes a problem.
7. **No vocabulary tracking / SRS** — no way to capture words you looked up into spaced repetition, unlike Lingua or Anime Subs ES's exposure-logging pattern.

### Polish
8. **No retry on TTS failure** — if a chunk fails to generate, the error state is permanent until the page is refreshed.
9. **No error auto-dismiss** — error banners stay until manually closed.
10. **No reading speed memory** — preferred playback rate is not saved between sessions (voice now is, per-language, via localStorage).

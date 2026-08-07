# Working agreements for this repo

- **Always commit finished work to git** — no need to ask first. Write a clear commit message describing the change.
- **Always deploy to Vercel production after committing** — `vercel --prod`, no need to ask first. This is a personal single-maintainer project; there's no staging gate.
- The exception: if something is broken, half-finished, or the user explicitly says to hold off, don't commit/deploy — ask instead.

## Known gotchas

- `DATABASE_URL` points to a Neon database **shared with several other personal projects** (Estira, WaniKani, Abacus, JLPT Level Estimator). Never run `drizzle-kit push` — it diffs the whole database and will try to drop every table not in this project's `schema.ts`. Use scoped `ALTER TABLE` statements instead.
- `DATABASE_URL` and `GOOGLE_TTS_API_KEY` are stored as Vercel "sensitive" env vars — `vercel env pull` cannot retrieve their values (writes a `[SENSITIVE]` placeholder instead). Blob and AI Gateway auth work around this via OIDC (`VERCEL_OIDC_TOKEN` + `BLOB_STORE_ID` in `.env.local`), but `GOOGLE_TTS_API_KEY` has no OIDC equivalent — it's a Google Cloud key, not a Vercel one.

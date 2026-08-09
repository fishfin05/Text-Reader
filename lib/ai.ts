import { generateText, Output } from 'ai';
import { z } from 'zod';
import { languageName, WORDS_PER_MINUTE } from './languages';

const MODEL = 'anthropic/claude-sonnet-5';

// Listening length in minutes — how long the generated article should take
// to narrate at 1x speed, per WORDS_PER_MINUTE.
export type ArticleLength = 10 | 20 | 30;

// generateText occasionally throws AI_NoOutputGeneratedError on a transient
// hiccup (provider blip, structured-output parse miss) — a bare retry
// resolves most of these rather than failing the whole request outright.
function describeError(err: unknown): Record<string, unknown> {
  if (!(err instanceof Error)) return { value: err };
  const e = err as Error & { text?: string; cause?: unknown; finishReason?: string; usage?: unknown };
  return {
    name: e.name,
    message: e.message,
    cause: e.cause ? String(e.cause) : undefined,
    finishReason: e.finishReason,
    usage: e.usage,
    // The raw text the model returned, if any — the most useful field for
    // telling apart "model refused/returned prose instead of JSON" from
    // "truly empty response" from "malformed JSON."
    text: e.text?.slice(0, 1000),
  };
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      console.error(`Generation attempt ${i + 1}/${attempts} failed:`, JSON.stringify(describeError(err)));
      if (i < attempts - 1) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastErr;
}

// Non-English languages (and denser prose at higher CEFR levels) run
// noticeably more tokens per word than English — a budget sized only off
// English assumptions truncates the JSON mid-generation for those cases,
// which fails schema validation and surfaces as a generic "no output"
// error. Generous on purpose; the model stops on its own once done.
function tokenBudget(words: number): number {
  return Math.min(32000, words * 6 + 3000);
}

export async function simplifyText({
  paragraphs,
  language,
  level,
}: {
  paragraphs: string[];
  language: string;
  level: string;
}): Promise<string[]> {
  const inputWords = countWords(paragraphs);
  const { output } = await withRetry(() => generateText({
    model: MODEL,
    maxOutputTokens: tokenBudget(inputWords),
    output: Output.object({
      schema: z.object({
        paragraphs: z.array(z.string()),
      }),
    }),
    prompt: `Rewrite the following ${languageName(language)} text for a language learner at CEFR level ${level}.

Rules:
- Use vocabulary and grammar appropriate for CEFR ${level}.
- Preserve the original meaning, facts, and paragraph-by-paragraph structure as closely as possible.
- Write entirely in ${languageName(language)}.
- Do not add commentary, notes, or explanations — only the rewritten text.

Original text (one paragraph per line):
${paragraphs.join('\n\n')}`,
  }));

  return output.paragraphs;
}

function countWords(paragraphs: string[]): number {
  return paragraphs.reduce((sum, p) => sum + p.split(/\s+/).filter(Boolean).length, 0);
}

const UNDERSHOOT_TOLERANCE = 0.85; // accept within 15% of target without extending
const MAX_EXTEND_ROUNDS = 2;

export async function generateGradedText({
  language,
  level,
  topic,
  length,
}: {
  language: string;
  level: string;
  topic: string;
  length: ArticleLength;
}): Promise<{ title: string; paragraphs: string[]; actualWords: number }> {
  const targetWords = length * WORDS_PER_MINUTE;
  const maxWords = Math.round(targetWords * 1.15);

  const { output } = await withRetry(() => generateText({
    model: MODEL,
    maxOutputTokens: tokenBudget(maxWords),
    output: Output.object({
      schema: z.object({
        title: z.string(),
        paragraphs: z.array(z.string()),
      }),
    }),
    prompt: `Write an original article in ${languageName(language)} at CEFR level ${level} about: ${topic}

Rules:
- REQUIRED LENGTH: between ${targetWords} and ${maxWords} words — stay inside this range. This article is meant to be listened to for about ${length} minutes, so stopping well short of ${targetWords} defeats the point, but running far past ${maxWords} makes it noticeably longer than what was asked for. If ${targetWords} words feels like more than the topic "needs," widen the scope: cover the topic from multiple angles, add relevant background, examples, sub-stories, or related tangents, the way a real long-form article or podcast episode would — but stop once you're within range rather than continuing to expand. Do not pad with repetition — add genuinely new content instead.
- Before finalizing, mentally check your draft's length against the ${targetWords}–${maxWords} word range. If it's short, keep writing additional sections; if it's already past ${maxWords}, wrap up rather than adding more.
- Use vocabulary and grammar appropriate for CEFR ${level} — this is comprehensible input for a language learner at this level.
- Write natural, engaging, well-organized prose in ${languageName(language)}, split into paragraphs.
- Give it a short, fitting title (in ${languageName(language)}).
- Do not add commentary or notes — only the title and article text.`,
  }));

  const title = output.title;
  let paragraphs = output.paragraphs;
  let wordCount = countWords(paragraphs);

  // Single-pass generation reliably undershoots explicit word targets — a
  // prompt asking for "at least N words" is a request, not a guarantee. If
  // we're meaningfully short, ask the model to keep going and append. If an
  // extend round fails even after retries, return what we already have
  // rather than losing a perfectly good draft over it.
  for (let round = 0; round < MAX_EXTEND_ROUNDS && wordCount < targetWords * UNDERSHOOT_TOLERANCE; round++) {
    const remaining = targetWords - wordCount;
    try {
      const { output: more } = await withRetry(() => generateText({
        model: MODEL,
        maxOutputTokens: tokenBudget(remaining),
        output: Output.object({
          schema: z.object({ paragraphs: z.array(z.string()) }),
        }),
        prompt: `You are continuing an in-progress article titled "${title}", written in ${languageName(language)} at CEFR level ${level}, about: ${topic}

Here is the article so far:
${paragraphs.join('\n\n')}

Write approximately ${remaining} MORE words continuing this article — new sections, angles, examples, or sub-topics, not a summary or repetition of what's already there. Match the same CEFR ${level} vocabulary/grammar level, tone, and language. Output only the new paragraphs to append — do not repeat the existing text, and do not add commentary.`,
      }));
      paragraphs = [...paragraphs, ...more.paragraphs];
      wordCount = countWords(paragraphs);
    } catch (err) {
      console.error('Extend round failed after retries, returning draft as-is:', err);
      break;
    }
  }

  return { title, paragraphs, actualWords: wordCount };
}

import { generateText, Output } from 'ai';
import { z } from 'zod';
import { languageName, WORDS_PER_MINUTE } from './languages';

const MODEL = 'anthropic/claude-sonnet-5';

// Listening length in minutes — how long the generated article should take
// to narrate at 1x speed, per WORDS_PER_MINUTE.
export type ArticleLength = 10 | 20 | 30;

export async function simplifyText({
  paragraphs,
  language,
  level,
}: {
  paragraphs: string[];
  language: string;
  level: string;
}): Promise<string[]> {
  const { output } = await generateText({
    model: MODEL,
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
  });

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

  const { output } = await generateText({
    model: MODEL,
    maxOutputTokens: Math.min(16000, targetWords * 2 + 1000),
    output: Output.object({
      schema: z.object({
        title: z.string(),
        paragraphs: z.array(z.string()),
      }),
    }),
    prompt: `Write an original article in ${languageName(language)} at CEFR level ${level} about: ${topic}

Rules:
- REQUIRED LENGTH: at least ${targetWords} words. This is a hard minimum, not a suggestion — this article is meant to be listened to for about ${length} minutes, so stopping early defeats the point. If ${targetWords} words feels like more than the topic "needs," widen the scope: cover the topic from multiple angles, add relevant background, examples, sub-stories, or related tangents, the way a real long-form article or podcast episode would. Do not pad with repetition — add genuinely new content instead.
- Before finalizing, mentally check your draft's length against the ${targetWords}-word minimum. If it's short, keep writing additional sections rather than concluding.
- Use vocabulary and grammar appropriate for CEFR ${level} — this is comprehensible input for a language learner at this level.
- Write natural, engaging, well-organized prose in ${languageName(language)}, split into paragraphs.
- Give it a short, fitting title (in ${languageName(language)}).
- Do not add commentary or notes — only the title and article text.`,
  });

  const title = output.title;
  let paragraphs = output.paragraphs;
  let wordCount = countWords(paragraphs);

  // Single-pass generation reliably undershoots explicit word targets — a
  // prompt asking for "at least N words" is a request, not a guarantee. If
  // we're meaningfully short, ask the model to keep going and append,
  // rather than silently handing back something shorter than requested.
  for (let round = 0; round < MAX_EXTEND_ROUNDS && wordCount < targetWords * UNDERSHOOT_TOLERANCE; round++) {
    const remaining = targetWords - wordCount;
    const { output: more } = await generateText({
      model: MODEL,
      maxOutputTokens: Math.min(16000, remaining * 2 + 1000),
      output: Output.object({
        schema: z.object({ paragraphs: z.array(z.string()) }),
      }),
      prompt: `You are continuing an in-progress article titled "${title}", written in ${languageName(language)} at CEFR level ${level}, about: ${topic}

Here is the article so far:
${paragraphs.join('\n\n')}

Write approximately ${remaining} MORE words continuing this article — new sections, angles, examples, or sub-topics, not a summary or repetition of what's already there. Match the same CEFR ${level} vocabulary/grammar level, tone, and language. Output only the new paragraphs to append — do not repeat the existing text, and do not add commentary.`,
    });
    paragraphs = [...paragraphs, ...more.paragraphs];
    wordCount = countWords(paragraphs);
  }

  return { title, paragraphs, actualWords: wordCount };
}

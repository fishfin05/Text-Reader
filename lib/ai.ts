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
}): Promise<{ title: string; paragraphs: string[] }> {
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

  return output;
}

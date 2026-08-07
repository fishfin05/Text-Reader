import { generateText, Output } from 'ai';
import { z } from 'zod';
import { languageName } from './languages';

const MODEL = 'anthropic/claude-sonnet-5';

export const LENGTH_WORD_TARGETS = {
  short: 400,
  medium: 800,
  long: 1500,
} as const;

export type ArticleLength = keyof typeof LENGTH_WORD_TARGETS;

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
  const targetWords = LENGTH_WORD_TARGETS[length];

  const { output } = await generateText({
    model: MODEL,
    output: Output.object({
      schema: z.object({
        title: z.string(),
        paragraphs: z.array(z.string()),
      }),
    }),
    prompt: `Write an original article in ${languageName(language)} at CEFR level ${level} about: ${topic}

Rules:
- Target length: approximately ${targetWords} words.
- Use vocabulary and grammar appropriate for CEFR ${level} — this is comprehensible input for a language learner at this level.
- Write natural, engaging, well-organized prose in ${languageName(language)}, split into paragraphs.
- Give it a short, fitting title (in ${languageName(language)}).
- Do not add commentary or notes — only the title and article text.`,
  });

  return output;
}

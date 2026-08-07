export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
};

// BCP-47 locale Google Cloud TTS expects for each supported language.
export const LANGUAGE_LOCALES: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-BR',
};

export function languageName(language: string): string {
  return LANGUAGE_NAMES[language] ?? language;
}

export function languageLocale(language: string): string {
  return LANGUAGE_LOCALES[language] ?? 'en-US';
}

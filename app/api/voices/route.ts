import { NextRequest } from 'next/server';
import { languageLocale } from '@/lib/languages';

const TTS_API_KEY = process.env.GOOGLE_TTS_API_KEY!;

// Preferred voice quality tiers, best first — we keep only the best tier available.
const QUALITY_TIERS = ['Chirp3-HD', 'Studio', 'Neural2', 'Wavenet', 'Standard'];

const MALE_NAMES = ['James', 'David', 'Ivan', 'Marcus', 'Leo', 'Felix', 'Victor', 'Oscar', 'Noah'];
const FEMALE_NAMES = ['Amy', 'Clara', 'Emily', 'Fiona', 'Grace', 'Hannah', 'Sofia', 'Elena', 'Mia'];
const NEUTRAL_NAMES = ['Alex', 'Sam', 'Robin', 'Jordan'];

export interface VoiceOption {
  id: string;
  label: string;
  gender: 'Male' | 'Female' | 'Neutral';
}

interface GoogleVoice {
  name: string;
  ssmlGender: 'MALE' | 'FEMALE' | 'SSML_VOICE_GENDER_UNSPECIFIED';
  languageCodes: string[];
}

const cache = new Map<string, VoiceOption[]>();

function pickTier(voices: GoogleVoice[]): GoogleVoice[] {
  for (const tier of QUALITY_TIERS) {
    const inTier = voices.filter(v => v.name.includes(tier));
    if (inTier.length > 0) return inTier;
  }
  return voices;
}

function buildVoiceOptions(voices: GoogleVoice[]): VoiceOption[] {
  const tiered = pickTier(voices).sort((a, b) => a.name.localeCompare(b.name));
  let maleI = 0, femaleI = 0, neutralI = 0;

  return tiered.map(v => {
    if (v.ssmlGender === 'MALE') {
      return { id: v.name, label: MALE_NAMES[maleI++ % MALE_NAMES.length], gender: 'Male' as const };
    }
    if (v.ssmlGender === 'FEMALE') {
      return { id: v.name, label: FEMALE_NAMES[femaleI++ % FEMALE_NAMES.length], gender: 'Female' as const };
    }
    return { id: v.name, label: NEUTRAL_NAMES[neutralI++ % NEUTRAL_NAMES.length], gender: 'Neutral' as const };
  });
}

export async function GET(request: NextRequest) {
  try {
    const language = request.nextUrl.searchParams.get('language') || 'en';
    const languageCode = languageLocale(language);

    if (cache.has(languageCode)) {
      return Response.json({ voices: cache.get(languageCode) });
    }

    const res = await fetch(
      `https://texttospeech.googleapis.com/v1beta1/voices?languageCode=${languageCode}&key=${TTS_API_KEY}`
    );
    if (!res.ok) throw new Error(`Voices API error ${res.status}: ${await res.text()}`);

    const data = await res.json();
    const voices = buildVoiceOptions((data.voices ?? []) as GoogleVoice[]);

    cache.set(languageCode, voices);
    return Response.json({ voices });
  } catch (err) {
    console.error('Voices error:', err);
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to load voices' },
      { status: 500 }
    );
  }
}

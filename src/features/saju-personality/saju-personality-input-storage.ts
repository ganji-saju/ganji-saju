import type {
  PersonalityAxisScores,
  PersonalityCheckAnswer,
  PersonalityProfileSource,
  PersonalityTypeCode,
} from '@/domain/personality';
import type { SajuPersonalityLifeArea } from '@/domain/saju-personality';
import type { BirthInput } from '@/lib/saju/types';

export const SAJU_PERSONALITY_INPUT_SESSION_KEY = 'moonlight:saju-personality-input:v1';

export interface SajuPersonalityInputPayload {
  version: 1;
  entryMode: 'saved_profile' | 'manual';
  profileId: string | null;
  profileSource: 'self' | 'family' | 'manual';
  displayName: string;
  birthInput: BirthInput;
  birthSummary: string;
  personality: {
    typeCode: PersonalityTypeCode;
    source: PersonalityProfileSource;
    confidence: number;
    axisScores?: PersonalityAxisScores;
    answers?: readonly PersonalityCheckAnswer[];
  };
  lifeArea: SajuPersonalityLifeArea;
  lifeAreaLabel: string;
  createdAt: string;
}

export function saveSajuPersonalityInputPayload(payload: SajuPersonalityInputPayload) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(SAJU_PERSONALITY_INPUT_SESSION_KEY, JSON.stringify(payload));
}

export function loadSajuPersonalityInputPayload(): SajuPersonalityInputPayload | null {
  if (typeof window === 'undefined') return null;

  const raw = window.sessionStorage.getItem(SAJU_PERSONALITY_INPUT_SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<SajuPersonalityInputPayload>;
    if (parsed.version !== 1 || !parsed.birthInput || !parsed.personality || !parsed.lifeArea) {
      return null;
    }
    return parsed as SajuPersonalityInputPayload;
  } catch {
    return null;
  }
}

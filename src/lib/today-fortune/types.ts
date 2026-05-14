import type { FocusTopic } from '@/domain/saju/report';
import type {
  UnifiedCalendarType,
  UnifiedTimeRule,
} from '@/lib/saju/unified-birth-entry';

export type ConcernId =
  | 'love_contact'
  | 'money_spend'
  | 'work_meeting'
  | 'relationship_conflict'
  | 'energy_health'
  | 'general';

export type TodayCalendarType = UnifiedCalendarType;
export type TodayTimeRule = UnifiedTimeRule;

export interface TodayConcernDefinition {
  id: ConcernId;
  label: string;
  hanja: string;
  shortLabel: string;
  prompt: string;
  focusTopic: FocusTopic;
  staticUpsellCopy: string;
  followUpQuestions: string[];
}

export interface TodayScoreItem {
  key: 'overall' | 'love' | 'wealth' | 'career' | 'relationship' | 'condition';
  label: string;
  score: number;
  summary: string;
}

export interface TodayFortuneFreeResult {
  sourceSessionId: string;
  /** YYYY-MM-DD (timezone-local). 2026-05-15: 일자별 캐시 분리 + 매일 다른 결과 보장용. */
  dateKey: string;
  concernId: ConcernId;
  concernLabel: string;
  concernHanja: string;
  focusTopic: FocusTopic;
  birthMeta: {
    calendarType: TodayCalendarType;
    timeRule: TodayTimeRule;
    unknownBirthTime: boolean;
    usesLocation: boolean;
  };
  oneLine: {
    eyebrow: string;
    headline: string;
    body: string;
  };
  scores: TodayScoreItem[];
  opportunity: {
    title: string;
    body: string;
  };
  risk: {
    title: string;
    body: string;
  };
  reasonSnippet: {
    title: string;
    body: string;
  };
  groundingSummary: {
    primaryConcept: string;
    factLines: string[];
    evidenceLines: string[];
    kasi: {
      available: boolean;
      ok: boolean;
      summary: string;
    };
  };
  nextAction: {
    copy: string;
    product: 'TODAY_DEEP_READING';
    coinCost: 1;
  };
  followUpQuestions: string[];
}

export interface TodayTimeWindow {
  range: string;
  mood: 'favorable' | 'caution';
  title: string;
  body: string;
}

export interface TodayScenarioComparison {
  title: string;
  better: string;
  watch: string;
}

export interface TodayFortunePremiumResult {
  productCode: 'TODAY_DEEP_READING';
  coinCost: 1;
  groundingSummary: TodayFortuneFreeResult['groundingSummary'];
  favorableWindows: TodayTimeWindow[];
  cautionWindows: TodayTimeWindow[];
  avoidActions: string[];
  recommendedActions: string[];
  scenarios: TodayScenarioComparison[];
  evidenceLines: string[];
  followUpQuestions: string[];
  safetyNote: string;
}

export interface TodayFortuneBirthPayload {
  concernId: ConcernId;
  calendarType: TodayCalendarType;
  timeRule: TodayTimeRule;
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  unknownBirthTime: boolean;
  gender: string;
  birthLocationCode: string;
  birthLocationLabel: string;
  birthLatitude: string;
  birthLongitude: string;
}

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

// 2026-05-15 PR 1 — 운세톡톡 벤치마크 적용 (간지사주_무료일진운세_적용방안.md 5-6쪽).
// 사주 명식 신뢰 카드 + 오행 분포 + 일주 강약 노출용 스냅샷.
// 빌더에서 한 번 만들어 result 페이로드에 실어 보낸다 (raw SajuDataV1 직접 노출 회피).
export interface TodaySajuChartSnapshot {
  pillars: {
    year: { stem: string; branch: string; ganzi: string };
    month: { stem: string; branch: string; ganzi: string };
    day: { stem: string; branch: string; ganzi: string };
    hour: { stem: string; branch: string; ganzi: string } | null;
  };
  dayMaster: {
    stem: string;
    element: '목' | '화' | '토' | '금' | '수';
  };
  fiveElements: Array<{
    element: '목' | '화' | '토' | '금' | '수';
    count: number;
    percentage: number;
    isDominant: boolean;
    isWeakest: boolean;
  }>;
  strengthLabel: string | null;
  patternName: string | null;
  /** 오늘 일진 (날짜의 ganzi). "丁酉" 같은 한자 2자. */
  todayGanzi: string | null;
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
  /** 2026-05-15 PR 1 — 사주 명식 신뢰 카드용 스냅샷. 미산정 시 null. */
  sajuChart?: TodaySajuChartSnapshot | null;
  /** 2026-05-15 PR 1 — 깊은 풀이 / 대운 풀이 CTA 용 사주 slug.
   *  result 만든 사용자가 이미 /saju 에 사주 reading 을 등록했으면 deep 탭으로 연결. */
  sajuSlug?: string | null;
  /** 2026-05-15 PR 2 — 운세톡톡 벤치마크: 행운 패키지 12종. */
  luckyPackage?: TodayLuckyPackage | null;
}

// 2026-05-15 PR 2 — 운세톡톡 벤치마크 (간지사주_무료일진운세_적용방안.md 3-5):
// "운세톡톡 기본 5종(색·숫자·방향·성씨·로또) + 간지사주 차별화 7종(시간·음식·향·보석·동물·음악·피해야할것) = 12종+".
// 용신/희신 오행 → 행운 항목, 기신/오늘 일진 충 → 피해야 할 항목.
export interface TodayLuckyNumberCircle {
  number: number;
  element: '목' | '화' | '토' | '금' | '수';
  color: string;
}

export interface TodayLuckyPackage {
  /** 행운 오행 (용신 또는 fallback 최약 오행). UI 헤더 노출용. */
  luckyElement: '목' | '화' | '토' | '금' | '수';
  /** 기신 오행 (피해야 할 행운). UI 피해야 할 것 묶음에 사용. */
  unluckyElement: '목' | '화' | '토' | '금' | '수' | null;
  // 운세톡톡 기본 5종
  colors: string[];
  numbers: number[];
  directions: string[];
  surnameInitials: string[];
  lottoNumbers: TodayLuckyNumberCircle[];
  // 간지사주 차별화 7종
  timeWindows: string[];
  foods: string[];
  aromas: string[];
  gemstones: string[];
  zodiacFriends: string[];
  musicGenres: string[];
  // 피해야 할 것 (negative lucky)
  avoidColors: string[];
  avoidDirections: string[];
  avoidTimeWindows: string[];
  avoidZodiacs: string[];
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
  /** YYYY-MM-DD (timezone-local). 2026-05-15: 매일 다른 자세히-보기 결과를 보장하기 위해 추가. */
  dateKey: string;
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

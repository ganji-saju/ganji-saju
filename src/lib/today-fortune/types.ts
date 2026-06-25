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
  /** 2026-05-15 PR — 종합 신살 탐지 결과 (사주 원국 + 일진). UI chip 노출용. */
  detectedSinsals?: TodayDetectedSinsal[];
}

export interface TodayDetectedSinsal {
  name: string;
  category: '길신' | '흉신' | '양날의검';
  positions: Array<'year' | 'month' | 'day' | 'hour' | 'iljin'>;
  scoreHint: number;
  hint: string;
}

export interface TodayFortuneFreeResult {
  sourceSessionId: string;
  /** YYYY-MM-DD (timezone-local). 2026-05-15: 일자별 캐시 분리 + 매일 다른 결과 보장용. */
  dateKey: string;
  /** 2026-05-15 — 사용자 입력 이름. 없으면 null. UI hero 인사말 ("김영민님,") 노출용. */
  userName: string | null;
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
  /** LLM 풀이 출처. 'openai'/'cache' = AI 생성(고지 배지 노출), 'fallback'/미설정 = 결정론(배지 없음). */
  aiSource?: 'openai' | 'fallback' | 'cache';
  scores: TodayScoreItem[];
  /** 2026-05-16 PR #149 (Part C) — 사용자 입력 상황. UI 가 chip strip + perspective 한 줄에 사용.
      grounding.personalizationContext.userSituation 에서 추출. 미입력이면 null. */
  userSituation: import('@/lib/saju/types').UserSituation | null;
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
  /** 2026-05-15 PR 3 — 운세톡톡 벤치마크: 일진 점수 산출 8영역 breakdown. */
  iljinScore?: TodayIljinScoreSnapshot | null;
  /** 2026-05-15 PR 3 — 일진 메시지 라이브러리 발동 케이스 + 변수 치환된 메시지. */
  iljinMessages?: TodayIljinMessages | null;
}

// 2026-05-15 PR 3 — 운세톡톡 벤치마크: 점수 산출 8영역 + 7단계 등급.
export interface TodayIljinScoreSnapshot {
  totalScore: number;
  grade: '최고' | '매우 좋음' | '좋음' | '무난' | '보통' | '주의' | '매우 주의';
  gradeEmoji: string;
  gradeMessage: string;
  breakdown: {
    cheongan: number;
    jiji: number;
    ohaeng: number;
    sinsal: number;
    balance: number;
    regulation: number;
    unsung: number;
    special: number;
  };
}

export interface TodayIljinMessages {
  /** 발동 케이스 id 목록 (디버깅·확장용). */
  caseIds: string[];
  /** 변수 치환된 풀이 문장 (상위 3개). */
  messages: string[];
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
  /**
   * 2026-06-24 — 오늘 일진(日辰) 풀이. 결제 자세히보기가 "매일 오늘 상황에 맞게" 달라지도록
   * free 와 동일한 pickIljinMessages(오늘 일진 vs 사주 발동 케이스 50종)를 premium 에도 통합.
   * 근인: 일진 메시지 라이브러리를 free 만 쓰고 premium 은 안 써서 매일 거의 동일했음.
   * 매일 다른 60갑자 → 발동 케이스 → 메시지로 결제 풀이가 오늘 위주로 변동. ganzi 한글 독음은 UI.
   */
  todayIljinReading?: {
    ganzi: string;
    score: number | null;
    messages: string[];
  } | null;
  /**
   * 2026-06-05 Phase 2 (PR #393 로드맵) — 오늘운세 프리미엄 LLM 깊은 풀이.
   * 언락(결제) 시 1회 생성되어 snapshot 에 영속(캐시 생략). 생성 실패·플래그 OFF 시 null
   * → UI 는 블록 미노출(graceful degrade). plain 티어: 한자/명리어/"기운" 0.
   */
  aiNarrative?: string | null;
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

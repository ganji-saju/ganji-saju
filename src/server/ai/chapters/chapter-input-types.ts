import type { ClassicReadingGrounding } from '@/server/classics/reading-grounding';
import type { NatalReadingEvidence } from '@/domain/saju/report/natal-reading-evidence';
// 2026-05-19 — 9 챕터 LLM 호출의 입력 JSON 스키마.
//   report-llm-spec.md §2 의 ChapterLLMInput 을 TypeScript 로 구체화.
//   LLM 호출 자체는 아직 구현 안 함 — 본 파일은 정적 자산.

export type ChapterId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface ChapterMeta {
  /** 화면용 챕터 제목 (예: '타고난 성향') */
  title: string;
  /** 챕터별 렌즈 키워드 (예: '마음의 결') — system prompt 에 주입 */
  lens: string;
  /** 다른 챕터의 영역 (cross-reference 차단) */
  forbiddenTopics: string[];
}

export interface ChapterSajuPillars {
  /** 한글 ganzi 'X갑오' 형태 */
  year: string;
  month: string;
  /** 일주 (예: '기사') */
  day: string;
  hour: string | null;
}

export interface ChapterDayMaster {
  /** 한글 천간 (예: '기') */
  stem: string;
  /** 오행 한글 표기 라벨 (예: '토 기운') */
  element: string;
  metaphor: string;
}

export interface ChapterFiveElements {
  dominant: string;
  weakest: string;
  supportElements: string[];
  /** 5 element 분포 비율 0~1 */
  distribution: Record<string, number>;
}

export interface ChapterPattern {
  /** 격국 라벨 (예: '정인격') */
  label: string;
  /** 일상어 풀이 (예: '돌봄·후원의 결') — MYEONGRI_GLOSSARY.plainCue */
  plainCue: string;
}

export interface ChapterYongsin {
  primary: string;
  /** 명리 근거 — LLM 컨텍스트용. 본문 인용 금지. */
  reason: string;
}

export interface ChapterTenGods {
  dominant: string;
  shortageList: string[];
}

export interface ChapterNotableSinsal {
  name: string;
  plainCue: string;
}

export interface ChapterSaju {
  pillars: ChapterSajuPillars;
  dayMaster: ChapterDayMaster;
  fiveElements: ChapterFiveElements;
  pattern: ChapterPattern;
  yongsin: ChapterYongsin;
  strength: '신강' | '중화' | '신약' | '미산정' | '에너지가 강한 편' | '균형이 잡힌 편' | '에너지가 차분한 편';
  tenGods: ChapterTenGods;
  notableSinsals: ChapterNotableSinsal[];
  /** Engine facts, not an invitation for the model to recalculate a chart. */
  natalEvidence?: NatalReadingEvidence;
  /**
   * 2026-10-10 — 타고난 사주 안의 지지 관계(합·충·형 등)와 각 자리(궁)의 생활 영역.
   *   "이 사람만의 차이"의 근거(점검 B #1). 계산값 — 모델이 다시 계산하지 않는다.
   */
  natalStructure?: {
    palaces: Record<'year' | 'month' | 'day' | 'hour', string>;
    relations: Array<{ kind: string; between: string; meaning: string }>;
  };
  /** 지금 대운과 앞뒤 대운(10년 단위 큰 흐름). 사건 예고가 아니라 시기 조건의 근거. */
  luck?: {
    current: { ganji: string; ages: string } | null;
    cycles: Array<{ ganji: string; ages: string }>;
  };
}

export interface ChapterUserContext {
  name: string | null;
  age: number | null;
  relationshipStatus: 'single' | 'dating' | 'married' | 'separated' | null;
  occupation: 'employee' | 'self-employed' | 'job-seeking' | 'student' | null;
  currentConcern: 'business' | 'love' | 'wealth' | 'health' | 'relationship' | null;
  /** 2026-10-10 — 대운 순역·배우자 별(남성 재성/여성 관성) 해석에 필요. */
  gender?: 'male' | 'female' | null;
}

export interface ChapterPriorDigest {
  chapterId: ChapterId;
  title: string;
  /** 그 챕터의 핵심 결론 1줄 (50자 이내) */
  digest: string;
}

export interface ChapterLLMInput {
  classicGrounding?: ClassicReadingGrounding;
  chapterId: ChapterId;
  chapter: ChapterMeta;
  saju: ChapterSaju;
  userContext: ChapterUserContext;
  /** 9장 (synthesis) 전용 — 1~7장 핵심 결론 */
  priorChapterDigests?: ChapterPriorDigest[];
}

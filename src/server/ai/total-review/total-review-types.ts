// 2026-05-21 — 사주 총평 LLM 입력/출력 타입. saju-total-review-llm-spec.md §2·§6.
//   _internal_* 명리어/한자는 *이 입력 객체에 포함하지 않는다* — 본문 누출 원천 차단.
//   모든 _easy 필드는 build-total-review-input.ts 에서 미리 일상어로 도출.

export type TotalReviewSectionId =
  | 'one_line_summary'
  | 'main_narrative'
  | 'lifetime_keys';

// ── 입력 (spec §2) ──────────────────────────────────────────────────────────

export interface TotalReviewIlganEasy {
  /** 일주 본질 라벨 (예: '물처럼 부드럽게 흐르는 결') */
  label: string;
  /** 상세 풀이 */
  detail: string;
  /** 자연 비유 (예: '조용히 스며들어 필요한 자리를 채우는 물') */
  metaphor: string;
}

export interface TotalReviewIljuEasy {
  label: string;
  detail: string;
}

export interface TotalReviewOhaengEntry {
  /** 한글 오행 ('금' 등) */
  element: string;
  /** plainCue 라벨 ('금 기운') */
  label: string;
  /** 일상어 의미 (ELEMENT_PLAIN_EFFECT 기반) */
  meaning: string;
}

export interface TotalReviewGangukEasy {
  label: string;
  detail: string;
}

export interface TotalReviewYongsinEasy {
  primary: { label: string; meaning: string };
  secondary: { label: string; meaning: string } | null;
}

export interface TotalReviewKyeokgukEasy {
  label: string;
  detail: string;
  career_fit: string[];
}

export interface TotalReviewWonkuk {
  ilgan_easy: TotalReviewIlganEasy;
  ilju_easy: TotalReviewIljuEasy;
  /** 오행 분포 (한글 키 → count) */
  ohaeng_balance: Record<string, number>;
  ohaeng_lack_easy: TotalReviewOhaengEntry[];
  ohaeng_excess_easy: TotalReviewOhaengEntry[];
  ganguk_easy: TotalReviewGangukEasy;
  yongsin_easy: TotalReviewYongsinEasy;
  kyeokguk_easy: TotalReviewKyeokgukEasy;
  /** 정확히 3개 (build-total-review-input 에서 패딩 보장) */
  key_strengths_easy: string[];
  /** 정확히 3개 */
  key_weaknesses_easy: string[];
}

export interface TotalReviewTimelineEntry {
  label_easy: string;
  meaning_easy: string;
}

export interface TotalReviewDaewoonEntry extends TotalReviewTimelineEntry {
  label_short: string;
  is_current: boolean;
}

export interface TotalReviewTimeline {
  daewoon: TotalReviewDaewoonEntry;
  saewoon: TotalReviewTimelineEntry;
  wolun: TotalReviewTimelineEntry;
}

export interface TotalReviewContext {
  /** 한글 라벨 ('기혼' 등) | null */
  relationship_status: string | null;
  occupation_status: string | null;
  concern: string | null;
}

export interface TotalReviewUser {
  name: string | null;
  gender: 'M' | 'F' | null;
  current_age: number | null;
}

export interface TotalReviewInput {
  user: TotalReviewUser;
  context: TotalReviewContext;
  wonkuk: TotalReviewWonkuk;
  current_timeline: TotalReviewTimeline;
}

// ── 출력 (spec §6) ──────────────────────────────────────────────────────────

export interface TotalReviewNarrative {
  paragraph_1_who_you_are: string;
  paragraph_2_strong_environment: string;
  paragraph_3_weak_zone: string;
  paragraph_4_now: string;
}

export interface TotalReviewLifetimeKey {
  title: string;
  subtitle: string;
  body: string;
}

export interface TotalReviewOutput {
  one_line_summary: string;
  main_narrative: TotalReviewNarrative;
  lifetime_keys: TotalReviewLifetimeKey[];
}

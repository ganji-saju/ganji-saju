import type { ReportEvidenceCard } from './types';
import type { ReportMetadata } from '@/lib/saju/report-contract';

export interface LifetimeKeyword {
  label: string;
  reason: string;
}

export interface LifetimePillarSummary {
  year: string;
  month: string;
  day: string;
  hour: string | null;
}

export interface LifetimeCoverSection {
  headline: string;
  oneLineSummary: string;
  keywords: LifetimeKeyword[];
  lifetimeRule: string;
  basis: string[];
}

export interface LifetimeCoreIdentitySection {
  headline: string;
  summary: string;
  reactionStyle: string;
  bestEnvironment: string;
  weakPattern: string;
  basis: string[];
}

export interface LifetimeStrengthBalanceSection {
  headline: string;
  summary: string;
  strongAxis: string;
  weakAxis: string;
  energyDrain: string;
  recovery: string;
  balanceGuide: string[];
  elementHighlights: string[];
  basis: string[];
}

export interface LifetimePatternAndYongsinSection {
  headline: string;
  summary: string;
  patternRole: string;
  yongsinDirection: string;
  choiceRule: string;
  supportSymbols: string[];
  cautionSymbols: string[];
  practicalActions: string[];
  detailLines: string[];
  basis: string[];
}

export interface LifetimeRelationshipPatternSection {
  headline: string;
  summary: string;
  distanceStyle: string;
  expressionStyle: string;
  conflictTriggers: string;
  longevityGuide: string;
  basis: string[];
}

export interface LifetimeWealthStyleSection {
  headline: string;
  summary: string;
  earningStyle: string;
  keepingStyle: string;
  spendingMistakes: string;
  operatingStyle: string;
  basis: string[];
}

export interface LifetimeCareerDirectionSection {
  headline: string;
  summary: string;
  fitStructure: string;
  endureVsShine: string;
  independenceStyle: string;
  recognitionStyle: string;
  basis: string[];
}

export interface LifetimeHealthRhythmSection {
  headline: string;
  summary: string;
  warningSignals: string;
  recoveryRoutine: string;
  habitPoints: string[];
  basis: string[];
}

export type LifetimeLuckPhase =
  | '성장기'
  | '전달기'
  | '기반기'
  | '결정기'
  | '준비기'
  | '전환기';

// 2026-05-15 PR 2 — 사주아이 8단 프레임워크 reference: 대운 cycle 본문 구조 확장.
// 기존 `summary` / `task` 는 backward-compat 유지. 신규 8개 필드는 모두 optional —
// 빌더가 채우지 못한 경우(legacy reading / 부분 데이터)에도 UI 가 안전하게 폴백.
export interface PracticalAction {
  /** 왜 필요한지 (오행/십성 근거). */
  reason: string;
  /** 무엇을 해야 하는지 (방향). */
  what: string;
  /** 어떻게 (실생활 행동). */
  how: string;
}

export interface LifetimeMajorLuckCycle {
  ganzi: string;
  ageLabel: string;
  phase: LifetimeLuckPhase;
  /** @deprecated 2026-05-15 PR 2 — chapterBody 로 대체 예정. 호환 위해 유지. */
  summary: string;
  /** @deprecated 2026-05-15 PR 2 — practicalActions 로 대체 예정. 호환 위해 유지. */
  task: string;
  isCurrent: boolean;

  // 2026-05-15 PR 2 — 사주아이 8단 sub-section. 빌더가 모두 채우는 것이 목표.
  // 현재는 optional 로 두고 점진 채움 (PR 2 응답 1: 타입만, 응답 2~3: 채움).
  /** ①  Hook — 사용자 상황 호명. "자영업이신 [이름]님에게 이번 대운은…". */
  hook?: string;
  /** ②  Chapter title — 10 패턴 중 1개 (PR 3 에서 카피 패턴 적용 예정). */
  chapterTitle?: string;
  /** ③  Chapter body — 상세 해설. 명리 + 일상 비유 병기. 400~600자. */
  chapterBody?: string;
  /** ④  Mental — 내면/멘탈. 일간 + 천간 합 + 인성/식상 작용. 400~500자. */
  mental?: string;
  /** ⑤  Relationship — 인간관계/로맨스. userSituation.relationshipStatus 분기. 400~500자. */
  relationship?: string;
  /** ⑥  Wealth/Career — 돈/커리어. userSituation.occupation 분기. 500~700자. */
  wealthCareer?: string;
  /** ⑦  Practical actions — 개운법 4개. "왜 → 무엇을 → 어떻게" 3단 (PR 4 에서 채움). */
  practicalActions?: PracticalAction[];
  /** ⑧  Closing note — 마지막 한마디. "절대 X / 반드시 Y / 응원" 3 문장 정도. */
  closingNote?: string;
  /** 2026-05-15 PR 6 — 해당 cycle 지지의 12운성 (일간 원칙). 카피 부각용. */
  twelveStage?: string | null;
  /** 2026-05-15 PR 6 — 사주 원국과 cycle 지지 간 원진 관계의 자리. (예: ['日支']) */
  wonjinWith?: string[];
  /** 2026-05-15 PR 7 응답 3 — 교운기(交運期) 표시. cycle 시작 ±1년 또는 끝 ±1년 사용자. */
  transitionPhase?: 'entering' | 'leaving' | null;
}

export interface LifetimeMajorLuckTimelineSection {
  headline: string;
  summary: string;
  currentMeaning: string;
  cycles: LifetimeMajorLuckCycle[];
  basis: string[];
}

export interface LifetimeStrategySection {
  headline: string;
  summary: string;
  useWhenStrong: string[];
  defendWhenShaken: string[];
  rememberRules: string[];
  basis: string[];
}

export interface LifetimeYearlyAppendix {
  year: number;
  yearLabel: string;
  yearGanji: string;
  headline: string;
  oneLineSummary: string;
  firstHalf: string;
  secondHalf: string;
  goodPeriods: string[];
  cautionPeriods: string[];
  actionAdvice: string[];
  ctaLabel: string;
  ctaAnchor: string;
  basis: string[];
}

export interface SajuLifetimeReport {
  targetYear: number;
  pillars: LifetimePillarSummary;
  cover: LifetimeCoverSection;
  coreIdentity: LifetimeCoreIdentitySection;
  strengthBalance: LifetimeStrengthBalanceSection;
  patternAndYongsin: LifetimePatternAndYongsinSection;
  relationshipPattern: LifetimeRelationshipPatternSection;
  wealthStyle: LifetimeWealthStyleSection;
  careerDirection: LifetimeCareerDirectionSection;
  healthRhythm: LifetimeHealthRhythmSection;
  majorLuckTimeline: LifetimeMajorLuckTimelineSection;
  lifetimeStrategy: LifetimeStrategySection;
  yearlyAppendix: LifetimeYearlyAppendix;
  evidenceCards: ReportEvidenceCard[];
  metadata?: ReportMetadata;
}

// 2026-05-23 — 궁합 LLM 깊은 풀이 타입(②-b). ohaeng-guidance 패턴.
//   유료 §8 deepSections 를 LLM 으로 더 깊게 생성. 플래그 OFF 기본 → 결정론 fallback.
import type { CompatibilityRelationshipSlug } from '@/content/moonlight';

/** UI 가 그리는 한 섹션(제목 + 본문). lib/compatibility 의 CompatibilityDeepSection 과 동형. */
export interface CompatibilityInterpretationSection {
  key: string;
  title: string;
  body: string;
}

/** LLM/캐시 입력 — 결정론 궁합 해석에서 파생한 자체 완결 grounding. */
export interface CompatibilityInterpretationInput {
  relationship: CompatibilityRelationshipSlug;
  relationshipLabel: string;
  selfName: string;
  partnerName: string;
  score: number;
  scoreLabel: string;
  headline: string;
  /** 한글 "X 기운" (목/화/토/금/수) */
  selfElementLabel: string;
  partnerElementLabel: string;
  supportiveSummary: string;
  cautionSummary: string;
  evidence: { title: string; body: string }[];
  axes: { eyebrow: string; summary: string; practice: string }[];
  /** 캐시 식별자 — 두 명식의 안정적 식별 문자열(순서 무관 정렬용). 노출 안 됨. */
  selfChartKey: string;
  partnerChartKey: string;
  /** 플래그 OFF·LLM 실패 시 그대로 노출하는 결정론 섹션(=lib deepSections). */
  fallbackSections: CompatibilityInterpretationSection[];
}

export interface CompatibilityInterpretationResult {
  /** llm = 신규 생성 / cache = 캐시 hit / fallback = 플래그 OFF·검증 실패 */
  source: 'llm' | 'cache' | 'fallback';
  sections: CompatibilityInterpretationSection[];
  reasons: string[];
  meta: { generatedAt: string; cacheKey: string; promptVersion: string };
}

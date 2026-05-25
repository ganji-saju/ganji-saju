// 2026-05-23 — 궁합 깊은 풀이 입력 빌더(②-b). 결정론 CompatibilityInterpretation → LLM grounding.
//   fallbackSections = lib 의 결정론 deepSections 를 그대로 사용(플래그 OFF·LLM 실패 시 노출).
import { ELEMENT_INFO } from '@/lib/saju/elements';
import type { CompatibilityInterpretation } from '@/lib/compatibility';
import type { SajuDataV1, SajuDataV2 } from '@/domain/saju/engine';
import type { CompatibilityRelationshipSlug } from '@/content/moonlight';
import type { CompatibilityInterpretationInput } from './compatibility-interpretation-types';

const RELATIONSHIP_LABELS: Record<CompatibilityRelationshipSlug, string> = {
  lover: '연인·배우자',
  family: '가족',
  friend: '친구·형제',
  partner: '동업·파트너',
};

/** 두 명식의 안정적 식별 문자열(네 기둥 간지). 캐시 키 산출에만 사용 — 사용자 노출 없음. */
function chartKey(data: SajuDataV1 | SajuDataV2): string {
  const p = data.pillars;
  return [p.year.ganzi, p.month.ganzi, p.day.ganzi, p.hour?.ganzi ?? '_'].join('|');
}

export function buildCompatibilityInterpretationInput(
  interpretation: CompatibilityInterpretation,
  selfName: string,
  partnerName: string
): CompatibilityInterpretationInput {
  return {
    relationship: interpretation.relationship,
    relationshipLabel: RELATIONSHIP_LABELS[interpretation.relationship],
    selfName,
    partnerName,
    score: interpretation.score,
    scoreLabel: interpretation.scoreLabel,
    headline: interpretation.headline,
    selfElementLabel: ELEMENT_INFO[interpretation.selfData.dayMaster.element].name,
    partnerElementLabel: ELEMENT_INFO[interpretation.partnerData.dayMaster.element].name,
    supportiveSummary: interpretation.supportiveSummary,
    cautionSummary: interpretation.cautionSummary,
    evidence: interpretation.evidence.map((item) => ({ title: item.title, body: item.body })),
    axes: interpretation.practicalCards.map((card) => ({
      eyebrow: card.eyebrow,
      summary: card.summary,
      practice: card.practice,
    })),
    selfChartKey: chartKey(interpretation.selfData),
    partnerChartKey: chartKey(interpretation.partnerData),
    fallbackSections: interpretation.deepSections.map((section) => ({
      key: section.key,
      title: section.title,
      body: section.body,
    })),
  };
}

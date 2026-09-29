import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';

/** Shared facts for every reading surface; no new chart judgment or life-event inference. */
export function buildNatalReadingEvidence(data: SajuDataV1 | SajuDataV2) {
  return {
    scope: 'natal' as const,
    hourKnown: data.input.hourKnown,
    dayMaster: data.dayMaster,
    pillars: Object.entries(data.pillars)
      .filter(([position, pillar]) => pillar && (position !== 'hour' || data.input.hourKnown))
      .map(([position, pillar]) => ({ position, ...pillar! })),
    strength: data.strength,
    pattern: data.pattern,
    yongsin: data.yongsin,
    tenGods: data.tenGods,
    fiveElements: data.fiveElements,
  };
}

export type NatalReadingEvidence = ReturnType<typeof buildNatalReadingEvidence>;

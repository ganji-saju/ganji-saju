import assert from 'node:assert/strict';
import { normalizeToSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import {
  buildSajuInterpretationGrounding,
  buildSajuReport,
  SAJU_EVIDENCE_JSON_V1,
  SAJU_FACT_JSON_V1,
  SAJU_PERSONALIZATION_CONTEXT_V1,
} from '@/domain/saju/report';
import type { BirthInput } from '@/lib/saju/types';

declare const test: (name: string, fn: () => void) => void;

const birthInput: BirthInput = {
  year: 1982,
  month: 1,
  day: 29,
  hour: 8,
  minute: 45,
  gender: 'male',
};

test('buildSajuInterpretationGrounding creates fact_json and evidence_json from the same saju data', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildSajuReport(birthInput, data, 'today');
  const grounding = buildSajuInterpretationGrounding(birthInput, data, report);

  assert.equal(grounding.factJson.schemaVersion, SAJU_FACT_JSON_V1);
  assert.equal(grounding.evidenceJson.schemaVersion, SAJU_EVIDENCE_JSON_V1);
  assert.equal(grounding.personalizationContext.schemaVersion, SAJU_PERSONALIZATION_CONTEXT_V1);
  assert.ok(grounding.factJson.metadata.ruleSetVersion.length > 0);
  assert.equal(grounding.factJson.pillars.day.ganzi, data.pillars.day.ganzi);
  assert.equal(grounding.factJson.dayMaster.stem, data.dayMaster.stem);
  assert.equal(grounding.factJson.fiveElements.dominant, data.fiveElements.dominant);
  assert.equal(grounding.evidenceJson.strength.level, data.strength?.level ?? null);
  assert.equal(grounding.evidenceJson.pattern.name, data.pattern?.name ?? null);
  assert.equal(
    grounding.evidenceJson.yongsin.primary,
    data.yongsin?.primary?.label ?? null
  );
  assert.ok(grounding.evidenceJson.classics.cards.length > 0);
  assert.ok(grounding.evidenceJson.classics.cards.some((card) => card.key === 'yongsin'));
  assert.equal(grounding.personalizationContext.dayGanziHanja, data.pillars.day.ganzi);
  assert.match(grounding.personalizationContext.dayGanziCode, /^[가-힣]{2}$/);
  assert.ok(grounding.personalizationContext.sixtyGapja);
  assert.deepEqual(
    Object.keys(grounding.personalizationContext.fiveElementRatio).sort(),
    ['금', '목', '수', '토', '화'].sort()
  );
  assert.deepEqual(
    Object.keys(grounding.personalizationContext.tenGodDistribution).sort(),
    ['비겁', '식상', '재성', '관성', '인성'].sort()
  );
  assert.ok(grounding.personalizationContext.promptFacts.some((item) => item.includes('일주코드')));
});

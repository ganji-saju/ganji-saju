import assert from 'node:assert/strict';
import { normalizeToSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import {
  buildGroundingDecisionTrace,
  buildSajuInterpretationGrounding,
  buildSajuReport,
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
  birthLocation: {
    code: 'seoul',
    label: '서울특별시',
    latitude: 37.5665,
    longitude: 126.978,
    timezone: 'Asia/Seoul',
  },
  solarTimeMode: 'longitude',
};

test('grounding decision trace exposes calculation badges and decision steps for report UI', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildSajuReport(birthInput, data, 'today');
  const grounding = buildSajuInterpretationGrounding(birthInput, data, report);
  const trace = buildGroundingDecisionTrace(grounding, null);

  assert.ok(trace.badges.some((badge) => badge.label.includes('절기 정보 명식')));
  assert.ok(trace.badges.some((badge) => badge.label.includes('진태양시 보정')));
  assert.ok(trace.steps.some((step) => step.title === '격국 후보 검토'));
  assert.ok(trace.steps.some((step) => step.title === '용신 / 희신 / 기신'));
  assert.ok(trace.notes.length > 0);
});

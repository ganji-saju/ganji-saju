import assert from 'node:assert/strict';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import {
  buildTodayFortuneFreeResult,
  buildTodayFortunePremiumResult,
} from '@/server/today-fortune/build-today-fortune';
import type { BirthInput } from '@/lib/saju/types';

declare const test: (name: string, fn: () => void) => void;

const birth: BirthInput = { year: 1982, month: 1, day: 29, hour: 8, minute: 0, gender: 'male' };
const now = new Date('2026-08-02T03:00:00Z');

test('wiring: 무료 reasonSnippet.body 에 실제 사주 근거(십성/오행)가 들어간다', () => {
  const data = calculateSajuDataV1(birth);
  const free = buildTodayFortuneFreeResult(birth, data, {
    concernId: 'general', sourceSessionId: 't', calendarType: 'solar', timeRule: 'standard', now,
  });
  assert.match(free.reasonSnippet.body, /편관|화 기운/);
});

test('wiring: 유료 causalNarrative 가 full 인과 문단을 담는다', () => {
  const data = calculateSajuDataV1(birth);
  const premium = buildTodayFortunePremiumResult(birth, data, 'general', null, null, { now });
  assert.ok(premium.causalNarrative, 'causalNarrative null');
  assert.match(premium.causalNarrative!.body, /편관\(밀어붙이는 별\)/);
  assert.match(premium.causalNarrative!.body, /삼합/);
});

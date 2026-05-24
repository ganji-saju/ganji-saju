import assert from 'node:assert/strict';
import { normalizeToSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import {
  buildTodayFlowSignal,
  getTodayPillarSnapshot,
  formatTodayDateMarker,
} from '@/server/today-fortune/build-today-fortune';
import type { BirthInput } from '@/lib/saju/types';

declare const test: (name: string, fn: () => void) => void;

const CJK = /[㐀-鿿]/;
// 오늘운세 본문은 plain 티어 — 명리 용어(기운/강약/격국/용신/대운/세운/월운/일진) 노출 금지.
const MYEONGRI_JARGON = /기운|강약|격국|용신|대운|세운|월운|일진/;

const birth: BirthInput = { year: 1996, month: 6, day: 1, hour: 6, minute: 30, gender: 'male' };

test('formatTodayDateMarker: 한자 일진을 한글 독음으로 변환 + 본문 한자·명리어 0', () => {
  const marker = formatTodayDateMarker('己亥');
  assert.ok(marker, '마커가 null');
  assert.ok(!CJK.test(marker as string), `마커 한자 잔존: "${marker}"`);
  assert.ok((marker as string).includes('기해'), `한글 독음(기해) 누락: "${marker}"`);
  assert.doesNotMatch(marker as string, MYEONGRI_JARGON, `마커 명리어 노출: "${marker}"`);
  assert.equal(formatTodayDateMarker(null), null);
});

test('buildTodayFlowSignal: 오늘운세 본문 — 한자 0 + 명리어 0 (plain 티어)', () => {
  const data = normalizeToSajuDataV1(birth, null);
  const days = [
    new Date('2026-05-25T03:00:00Z'),
    new Date('2026-06-02T03:00:00Z'),
    new Date('2026-07-01T03:00:00Z'),
    new Date('2026-08-15T03:00:00Z'),
    new Date('2026-09-10T03:00:00Z'),
  ];
  let seen = 0;
  for (const now of days) {
    const pillar = getTodayPillarSnapshot(data, { now });
    const signal = buildTodayFlowSignal(pillar, data);
    if (!signal) continue;
    seen += 1;
    assert.ok(!CJK.test(signal), `flowSignal 한자 잔존: "${signal}"`);
    assert.doesNotMatch(signal, MYEONGRI_JARGON, `flowSignal 명리어 노출: "${signal}"`);
  }
  assert.ok(seen > 0, 'flowSignal 샘플이 비어 검증 불가');
});

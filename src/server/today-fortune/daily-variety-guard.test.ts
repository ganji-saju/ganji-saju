// 오늘운세 무료 — 일별 다양성 + 단정/doom 금지어 회귀 가드.
//   2026-06-28 변형 풀 확장(lead/avoid/강약) 후, 다중일 출력으로 (1)인접일 상이
//   (2)일정 기간 distinct 다양성 (3)금지어 0 을 잠근다. 렌더 출력 기반 검증.
import assert from 'node:assert/strict';
import { buildFreshTodaySajuData } from '@/server/today-fortune/fresh-saju-data';
import { buildTodayFortuneFreeResult } from '@/server/today-fortune/build-today-fortune';
import type { BirthInput } from '@/lib/saju/types';

declare const test: (name: string, fn: () => void) => void;

const FORBIDDEN = ['반드시', '절대', '100%', '무조건', '대박', '암흑기', '죽음', '불행'];

function buildDays(input: BirthInput, isoDays: string[]): string[] {
  const sajuData = buildFreshTodaySajuData(input, { now: `${isoDays[0]}T03:00:00Z` });
  return isoDays.map((d) =>
    JSON.stringify(
      buildTodayFortuneFreeResult(input, sajuData, {
        concernId: 'general',
        sourceSessionId: 'guard',
        calendarType: 'solar',
        timeRule: 'standard',
        now: new Date(`${d}T03:00:00Z`),
      })
    )
  );
}

function range(startIso: string, n: number): string[] {
  const base = Date.parse(`${startIso}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) =>
    new Date(base + i * 86_400_000).toISOString().slice(0, 10)
  );
}

const input: BirthInput = { year: 1982, month: 1, day: 29, hour: 9, minute: 0, gender: 'female' };

test('오늘운세: 인접일 항상 다른 출력(14일)', () => {
  const days = range('2026-06-28', 14);
  const outs = buildDays(input, days);
  for (let i = 1; i < outs.length; i += 1) {
    assert.notEqual(outs[i], outs[i - 1], `${days[i]} 가 ${days[i - 1]} 와 동일`);
  }
});

test('오늘운세: 14일 중 distinct 출력 다양성 충분', () => {
  const outs = buildDays(input, range('2026-06-28', 14));
  const distinct = new Set(outs).size;
  // 변형 풀 확장 전엔 4~6 수준에서 막혔음. 확장 후 10+ 기대(보수적으로 9 이상 요구).
  assert.ok(distinct >= 9, `distinct ${distinct} < 9 — 다양성 부족(변형 풀 축소 회귀?)`);
});

test('오늘운세: 다중일 출력에 단정/doom 금지어 0(30일)', () => {
  const outs = buildDays(input, range('2026-06-28', 30));
  for (const token of FORBIDDEN) {
    for (let i = 0; i < outs.length; i += 1) {
      assert.ok(!outs[i].includes(token), `금지어 "${token}" 노출(${i}일째)`);
    }
  }
});

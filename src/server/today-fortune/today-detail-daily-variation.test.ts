// 2026-06-24 — 회귀 가드: "오늘 자세히보기"(premium) 풀이가 날짜마다 달라지는지.
// 근인: 오늘 일진(60갑자) 메시지 라이브러리를 free 만 쓰고 premium 은 안 써서 결제 풀이가
// 매일 거의 동일했음. todayIljinReading 통합 후, 날짜가 바뀌면 일진 풀이도 달라져야 한다.
import assert from 'node:assert/strict';
import { normalizeToSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { buildTodayFortunePremiumResult } from '@/server/today-fortune/build-today-fortune';
import type { BirthInput } from '@/lib/saju/types';

declare const test: (name: string, fn: () => void) => void;

const birth: BirthInput = { year: 1996, month: 6, day: 1, hour: 6, minute: 30, gender: 'male' };
const dates = ['2026-06-24', '2026-06-25', '2026-06-26', '2026-07-15', '2026-08-03'];

test('today premium: 오늘 일진 풀이가 날짜마다 달라진다 (결제 가치 가드)', () => {
  const data = normalizeToSajuDataV1(birth, null);
  const readings = dates.map(
    (d) =>
      buildTodayFortunePremiumResult(birth, data, 'general', null, null, {
        now: new Date(`${d}T03:00:00Z`),
      }).todayIljinReading
  );

  // 1) 모든 날짜에 일진 풀이가 존재한다.
  for (const r of readings) {
    assert.ok(r && r.messages.length > 0, '일진 풀이(todayIljinReading) 누락');
  }

  // 2) 날짜별 일진 풀이 조합이 충분히 다양하다(전부 동일이면 결제 가치 회귀).
  const joined = readings.map((r) => r!.messages.join('|'));
  const unique = new Set(joined);
  assert.ok(
    unique.size >= 3,
    `오늘 일진 풀이가 날짜별로 거의 동일(고유 ${unique.size}/${dates.length}) — 매일 변화 보장 실패`
  );
});

import assert from 'node:assert/strict';
import { buildCohortRetention, type CohortRow } from './cohort';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const NOW = '2026-06-06T00:00:00.000Z';
function r(signup: string, last: string, ltv = 0): CohortRow {
  return { signup_at: signup, last_active_at: last, ltv_won: ltv };
}

test('buildCohortRetention: 월별 그룹·평균LTV·최신순', () => {
  const rows = [
    r('2026-04-02T00:00:00Z', '2026-04-20T00:00:00Z', 10000),
    r('2026-04-10T00:00:00Z', '2026-04-12T00:00:00Z', 20000),
    r('2026-05-01T00:00:00Z', '2026-05-02T00:00:00Z', 0),
  ];
  const cs = buildCohortRetention(rows, NOW);
  assert.equal(cs[0].cohort, '2026-05');
  assert.equal(cs[1].cohort, '2026-04');
  assert.equal(cs[1].size, 2);
  assert.equal(cs[1].avgLtvWon, 15000);
});

test('buildCohortRetention: 성숙 코호트 D7/D30 계산', () => {
  const rows = [
    r('2026-04-01T00:00:00Z', '2026-04-09T00:00:00Z', 0),
    r('2026-04-01T00:00:00Z', '2026-05-15T00:00:00Z', 0),
  ];
  const c = buildCohortRetention(rows, NOW)[0];
  assert.equal(c.d7Measurable, true);
  assert.equal(c.d30Measurable, true);
  assert.equal(c.d7, 1);
  assert.equal(c.d30, 0.5);
});

test('buildCohortRetention: 미성숙 코호트는 null', () => {
  const c = buildCohortRetention([r('2026-06-02T00:00:00Z', '2026-06-05T00:00:00Z', 0)], NOW)[0];
  assert.equal(c.d7Measurable, false);
  assert.equal(c.d7, null);
  assert.equal(c.d30, null);
});

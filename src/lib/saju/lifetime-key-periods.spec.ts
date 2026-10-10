import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { buildTransientReading } from '@/lib/saju/readings';
import { buildLifetimeKeyPeriods } from './lifetime-key-periods';

const people = [
  { year: 1988, month: 3, day: 21, hour: 9, minute: 30, gender: 'female' },
  { year: 1979, month: 10, day: 5, hour: 22, minute: 10, gender: 'male' },
];

describe('인생 주요 시기', () => {
  it('좋은 시기 ≤3·조심할 시기 ≤2·전환기 ≤2, 연도순, 한자·예고 표현 없음', () => {
    const dump: string[] = [];
    for (const p of people) {
      const r = buildTransientReading(p as never, 'x');
      const periods = buildLifetimeKeyPeriods(r.sajuData, p.year, 2026);
      dump.push(String(p.year), ...periods.map((x) => `  ${x.year}(${x.age}) ${x.kind} ${x.reason}`));
      expect(periods.length).toBeGreaterThan(0);
      expect(periods.filter((x) => x.kind === '좋은 시기').length).toBeLessThanOrEqual(3);
      expect(periods.filter((x) => x.kind === '조심할 시기').length).toBeLessThanOrEqual(2);
      expect(periods.filter((x) => x.kind === '전환기').length).toBeLessThanOrEqual(2);
      expect(periods.map((x) => x.year)).toEqual([...periods.map((x) => x.year)].sort((a, b) => a - b));
      expect(periods.every((x) => x.year >= 2021 && x.age <= 85)).toBe(true);
      const text = periods.map((x) => x.reason).join(' ');
      expect(text.match(/[一-鿿]/g) ?? []).toEqual([]);
      expect(text).not.toMatch(/반드시|무조건|사고|병/);
    }
    if (process.env.DUMP_KEY_PERIODS) writeFileSync(process.env.DUMP_KEY_PERIODS, dump.join('\n'));
  });
});

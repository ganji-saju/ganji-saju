import { describe, expect, it } from 'vitest';
import { buildTransientReading } from '@/lib/saju/readings';
import { buildYearlyReport } from '@/domain/saju/report';
import { buildYearPoints } from '@/lib/saju/yearly-month-view';

const signals = (p: Record<string, unknown>) => {
  const r = buildTransientReading(p as never, 'x');
  return buildYearlyReport(r.input, r.sajuData, 2027).yearSignals!;
};

describe('신년 총론 근거 팩(세운)', () => {
  it('삼재는 띠(태어난 해 지지) 기준 — 양띠는 2027 정미년이 날삼재, 용띠는 해당 없음', () => {
    expect(signals({ year: 1979, month: 10, day: 5, hour: 22, minute: 10, gender: 'male' }).samjae).toEqual({ stage: '날삼재', branches: '사·오·미' });
    expect(signals({ year: 1988, month: 3, day: 21, hour: 9, minute: 30, gender: 'female' }).samjae).toBeNull();
  });

  it('세운 십성·대운 관계·귀인 달·행운을 계산하고, 문장에는 한자와 공포 표현이 없다', () => {
    const ys = signals({ year: 1979, month: 10, day: 5, hour: 22, minute: 10, gender: 'male' });
    expect(ys.stemTenGod).toBeTruthy();
    expect(ys.majorLuck?.ganji).toHaveLength(2);
    expect(ys.gwiinMonths.every((m) => m >= 1 && m <= 12)).toBe(true);
    expect(ys.lucky?.colors.length).toBeGreaterThan(0);
    const text = [...ys.summary, ...buildYearPoints(ys).map((p) => p.value)].join(' ');
    expect(text.match(/[一-鿿]/g) ?? []).toEqual([]);
    expect(text).not.toMatch(/반드시|무조건|큰\s*병|사고가/);
    expect(text).toContain('나쁜 일이 생긴다는 뜻은 아닙니다');
  });

  it('올해의 사주 포인트는 삼재가 없어도 "해당 없음"으로 항목을 채운다', () => {
    const points = buildYearPoints(signals({ year: 1988, month: 3, day: 21, hour: 9, minute: 30, gender: 'female' }));
    expect(points.find((p) => p.label === '삼재(띠 기준)')?.value).toBe('해당 없음');
    expect(points.map((p) => p.label)).toEqual(expect.arrayContaining(['올해 기운', '타고난 사주와의 관계', '필요한 기운인지', '도움받기 좋은 달']));
  });
});

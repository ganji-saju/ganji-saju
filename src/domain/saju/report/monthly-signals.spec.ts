import { describe, expect, it } from 'vitest';
import { buildTransientReading } from '@/lib/saju/readings';
import { computeMonthSignals, monthLuckPeriod } from './monthly-signals';

const reading = buildTransientReading({ name: '검증', year: 1982, month: 1, day: 29, hour: 8, minute: 45, gender: 'male' } as never, 'x');
const base = {
  year: 2027, yearlyGanji: '丁未', dayMasterStem: reading.sajuData.dayMaster.stem,
  pillars: reading.sajuData.pillars, yongsin: reading.sajuData.yongsin, fallbackAreas: ['health', 'relationship'] as const,
};

describe('월운 근거', () => {
  it('절기 기준 기간을 낸다(입춘~경칩 전날)', () => {
    expect(monthLuckPeriod(2027, 2)).toMatch(/^2월 [34]일~3월 [45]일$/);
    expect(monthLuckPeriod(2027, 12)).toMatch(/^12월 [67]일~1월 [45]일$/);
  });

  it('그 달 간지의 십성·원국 관계·용신 적합도를 계산하고 분야 2개를 고른다', () => {
    const s = computeMonthSignals({ ...base, fallbackAreas: [...base.fallbackAreas], month: 2, monthlyGanji: '壬寅' });
    expect(s.stemTenGod).not.toBeNull();
    expect(s.branchTenGod).not.toBeNull();
    expect(s.tenGodTheme).toBeTruthy();
    expect(['support', 'burden', 'mixed', 'neutral']).toContain(s.yongsinFit);
    expect(s.focusAreas).toHaveLength(2);
    expect(new Set(s.focusAreas).size).toBe(2);
    // 원국 지지 중 하나와 같은 지지가 오는 달이 아니면 관계는 실제 판정 결과만 담는다.
    for (const r of s.natalRelations) expect(r.palace).toBeTruthy();
  });

  it('사람마다 그 달 분야가 달라질 수 있다(고정표가 아니다)', () => {
    const other = buildTransientReading({ name: '검증2', year: 1995, month: 7, day: 3, gender: 'female' } as never, 'y');
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const ganji = ['辛丑', '壬寅', '癸卯', '甲辰', '乙巳', '丙午', '丁未', '戊申', '己酉', '庚戌', '辛亥', '壬子'];
    const a = months.map((m) => computeMonthSignals({ ...base, fallbackAreas: ['health', 'work'], month: m, monthlyGanji: ganji[m - 1] }).focusAreas.join());
    const b = months.map((m) => computeMonthSignals({ ...base, dayMasterStem: other.sajuData.dayMaster.stem, pillars: other.sajuData.pillars, yongsin: other.sajuData.yongsin, fallbackAreas: ['health', 'work'], month: m, monthlyGanji: ganji[m - 1] }).focusAreas.join());
    expect(a).not.toEqual(b);
  });

  it('간지가 없으면 고정표 분야로 돌아간다', () => {
    const s = computeMonthSignals({ ...base, fallbackAreas: ['work', 'wealth'], month: 3, monthlyGanji: null });
    expect(s).toMatchObject({ stemTenGod: null, natalRelations: [], focusAreas: ['work', 'wealth'], yongsinFit: 'neutral' });
  });
});

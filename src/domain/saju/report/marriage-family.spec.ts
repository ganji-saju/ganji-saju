import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { buildTransientReading } from '@/lib/saju/readings';
import { buildLifetimeReport } from '@/domain/saju/report';
import { buildFallbackLifetimeInterpretation, parseLifetimeInterpretationText } from '@/server/ai/saju-lifetime-interpretation';
import { buildMarriageFamily } from './marriage-family';

const FORBIDDEN = /이혼|재혼|불임|난임|과부|상처|첩|사별|반드시|무조건|[一-鿿]/;
const adult = (p: Record<string, unknown>) => buildTransientReading(p as never, 'x');

describe('결혼·배우자·자녀', () => {
  it('남성은 재성, 여성은 관성을 배우자 별로 읽고, 예고·금지 표현·한자가 없다', () => {
    const dump: string[] = [];
    for (const p of [
      { year: 1988, month: 3, day: 21, hour: 9, minute: 30, gender: 'female' },
      { year: 1979, month: 10, day: 5, hour: 22, minute: 10, gender: 'male' },
      { year: 1991, month: 7, day: 2, gender: 'female' },
    ]) {
      const r = adult(p);
      const section = buildMarriageFamily(r.sajuData, p.gender as 'male' | 'female');
      dump.push(String(p.year), section.summary);
      expect(section.spouseStar).toContain(p.gender === 'male' ? '재성' : '관성');
      expect(section.summary).not.toMatch(FORBIDDEN);
      expect(section.timing).toMatch(/예고하지 않습니다|기준을 먼저 세우는/);
      expect(section.windows.length).toBeLessThanOrEqual(3);
    }
    if (process.env.DUMP_MF) writeFileSync(process.env.DUMP_MF, dump.join('\n\n'));
  });

  it('시간을 모르면 자녀 자리는 풀이에서 뺀다고 밝힌다', () => {
    const r = adult({ year: 1991, month: 7, day: 2, gender: 'female' });
    expect(buildMarriageFamily(r.sajuData, 'female').childrenPalace).toContain('태어난 시간을 몰라');
  });

  it('미성년 평생 리포트에는 결혼·배우자·자녀가 없다', () => {
    const r = adult({ year: 2015, month: 5, day: 5, hour: 10, minute: 0, gender: 'male' });
    expect(buildLifetimeReport(r.input, r.sajuData, 2026).marriageFamily).toBeNull();
  });

  it('AI 응답이 새 섹션을 빠뜨려도 본편 전체를 버리지 않고 그 섹션만 계산 문단으로 채운다', () => {
    const r = adult({ year: 1988, month: 3, day: 21, hour: 9, minute: 30, gender: 'female' });
    const report = buildLifetimeReport(r.input, r.sajuData, 2026);
    const fallback = buildFallbackLifetimeInterpretation(report);
    expect(fallback.sections.marriageFamily).toBe(report.marriageFamily!.summary);
    const { marriageFamily: _drop, ...rest } = fallback.sections;
    const longText = '이 장은 충분히 길게 쓴 본문입니다. '.repeat(12);
    const aiSections = Object.fromEntries(Object.keys(rest).map((key) => [key, longText]));
    const parsed = parseLifetimeInterpretationText(JSON.stringify({ ...fallback, sections: aiSections }), fallback);
    expect(parsed.ok).toBe(true);
    expect(parsed.interpretation.sections.marriageFamily).toBe(report.marriageFamily!.summary);
  });
});

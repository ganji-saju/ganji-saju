import { describe, expect, it } from 'vitest';
import { buildCompatibilityInterpretation } from '@/lib/compatibility';
import { computePairSignals } from './pair-signals';

const A = { year: 1988, month: 3, day: 21, hour: 9, minute: 30, gender: 'female' } as never;
const B = { year: 1985, month: 11, day: 2, hour: 14, minute: 0, gender: 'male' } as never;

describe('궁합 관계 근거', () => {
  it('서로의 역할·지금 대운을 담고, 한자·단정 표현이 없다', () => {
    const c = buildCompatibilityInterpretation('lover', { name: '가나', birthInput: A }, { name: '다라', birthInput: B });
    const { lines } = computePairSignals({ self: c.selfData, partner: c.partnerData, selfName: '가나', partnerName: '다라', romantic: true, currentYearGanji: '丙午' });
    const text = lines.join(' ');
    expect(lines[0]).toMatch(/가나님에게 다라님은 .+\(.+\)로, 다라님에게 가나님은 .+\(.+\)로/);
    expect(text).toMatch(/지금 .+ 대운/);
    expect(text.match(/[一-鿿]/g) ?? []).toEqual([]);
    expect(text).not.toMatch(/반드시|무조건|이혼|헤어진다|운명/);
  });

  it('가족·친구 관계에는 배우자 별 문장을 넣지 않는다', () => {
    const c = buildCompatibilityInterpretation('friend', { name: '가나', birthInput: A }, { name: '다라', birthInput: B });
    const { lines } = computePairSignals({ self: c.selfData, partner: c.partnerData, selfName: '가나', partnerName: '다라', romantic: false, currentYearGanji: null });
    expect(lines.join(' ')).not.toContain('배우자 별');
  });
});

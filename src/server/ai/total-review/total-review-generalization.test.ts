import assert from 'node:assert/strict';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { buildSajuPersonalizationContext } from '@/domain/saju/report/personalization-context';
import { buildTotalReviewInput } from './build-total-review-input';

// 2026-05-21 — verification 5 (일반화). _easy 도출이 계미 케이스 밖 5개 다른 사주에서도
//   구조 불변식(강점/약점 3개·한자 0·5오행 키)을 유지하는지. spec §10 / verification-prompts.md 검증5.

declare const test: (name: string, fn: () => void | Promise<void>) => void;

interface Case {
  label: string;
  birth: { year: number; month: number; day: number; hour?: number; gender: 'male' | 'female' };
  situation: {
    relationshipStatus?: string | null;
    occupation?: string | null;
    currentConcern?: string | null;
    concernNote?: string | null;
  };
}

const CASES: Case[] = [
  { label: '1999-04-01 14 여 (계미)', birth: { year: 1999, month: 4, day: 1, hour: 14, gender: 'female' }, situation: { relationshipStatus: 'married', occupation: 'employee', currentConcern: 'wealth' } },
  { label: '1996-06-01 06 남 (기사)', birth: { year: 1996, month: 6, day: 1, hour: 6, gender: 'male' }, situation: { relationshipStatus: 'single', occupation: 'job-seeking', currentConcern: 'business' } },
  { label: '1988-12-15 23 남', birth: { year: 1988, month: 12, day: 15, hour: 23, gender: 'male' }, situation: { relationshipStatus: 'dating', occupation: 'self-employed', currentConcern: 'romance' } },
  { label: '2001-07-22 09 여', birth: { year: 2001, month: 7, day: 22, hour: 9, gender: 'female' }, situation: { relationshipStatus: 'single', occupation: 'student', currentConcern: 'health' } },
  { label: '1975-03-30 18 남 (시간모름 변형)', birth: { year: 1975, month: 3, day: 30, hour: 18, gender: 'male' }, situation: {} },
];

for (const c of CASES) {
  test(`일반화 [${c.label}]: 강점/약점 3개·한자 0·5오행 키 불변`, () => {
    const data = calculateSajuDataV1(c.birth as never);
    const ctx = buildSajuPersonalizationContext(data, c.situation as never);
    const input = buildTotalReviewInput(data, ctx, {
      userName: '검증',
      gender: c.birth.gender === 'female' ? 'F' : 'M',
      now: new Date('2026-05-21T00:00:00Z'),
    });

    assert.equal(input.wonkuk.key_strengths_easy.length, 3, `${c.label} 강점 3개`);
    assert.equal(input.wonkuk.key_weaknesses_easy.length, 3, `${c.label} 약점 3개`);

    const wonkukJson = JSON.stringify(input.wonkuk);
    const timelineJson = JSON.stringify(input.current_timeline);
    assert.ok(!/[一-鿿]/.test(wonkukJson), `${c.label} wonkuk 한자`);
    assert.ok(!/[一-鿿]/.test(timelineJson), `${c.label} timeline 한자`);

    for (const el of ['목', '화', '토', '금', '수']) {
      assert.ok(el in input.wonkuk.ohaeng_balance, `${c.label} ${el} 키`);
    }
    assert.ok(input.wonkuk.ilgan_easy.label.length > 0, `${c.label} ilgan label`);
    assert.ok(input.current_timeline.daewoon.meaning_easy.length > 0, `${c.label} daewoon 의미`);
  });
}

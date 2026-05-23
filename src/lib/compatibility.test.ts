import assert from 'node:assert/strict';
import {
  buildCompatibilityInterpretation,
  inferCompatibilityRelationshipSlug,
  resolveProfileDisplayName,
} from './compatibility';

declare const test: (name: string, fn: () => Promise<void> | void) => void;

test('compatibility infers broader relationship types from saved labels', () => {
  assert.equal(inferCompatibilityRelationshipSlug('배우자'), 'lover');
  assert.equal(inferCompatibilityRelationshipSlug('큰아들'), 'family');
  assert.equal(inferCompatibilityRelationshipSlug('친구'), 'friend');
  assert.equal(inferCompatibilityRelationshipSlug('회사 동료'), 'partner');
});

test('compatibility display name falls back to email local part', () => {
  assert.equal(resolveProfileDisplayName('  ', 'dalbit@example.com'), 'dalbit');
  assert.equal(resolveProfileDisplayName('', null), '선생님');
});

test('compatibility interpretation compares two saved people and emits evidence and data notes', () => {
  const result = buildCompatibilityInterpretation(
    'family',
    {
      name: '나',
      birthInput: {
        year: 1982,
        month: 1,
        day: 29,
        gender: 'male',
      },
    },
    {
      name: '큰아들',
      birthInput: {
        year: 2008,
        month: 7,
        day: 14,
        gender: 'male',
      },
    }
  );

  assert.match(result.headline, /나님과 큰아들님/);
  assert.ok(result.score >= 52 && result.score <= 92);
  assert.match(result.scoreLabel, /흐름/);
  assert.doesNotMatch(
    result.summary,
    /일간|일지|육합|천간합|반합|[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]/
  );
  assert.ok(result.evidence.length >= 4);
  assert.equal(result.practicalCards.length, 4);
  assert.deepEqual(
    result.practicalCards.map((card) => card.key),
    ['conflict', 'communication', 'money', 'distance']
  );
  assert.match(result.relationshipLensBody, /말의 무게|가족/);
  assert.match(result.practicalCards[1]?.eyebrow ?? '', /대화 방식/);
  assert.match(result.dataNote ?? '', /태어난 시간이|출생지/);
});

// 2026-05-23: 궁합 결과 화면은 simplifySajuCopy 를 거치지 않고 raw 렌더하므로,
//   '오행 라벨(… 기운) + 기운' 중복 같은 텍스트 버그가 그대로 노출된다. 라벨 뒤에
//   ' 기운' 을 덧붙이지 않고 조사만 붙였는지 회귀 가드.
test('compatibility: 오행 라벨 뒤 "기운" 중복("화 기운 기운이")이 발생하지 않음', () => {
  const years: Array<[number, number]> = [
    [1982, 1990],
    [1990, 1995],
    [1995, 2001],
    [1988, 1976],
    [1999, 1970],
  ];
  for (const [ya, yb] of years) {
    for (const slug of ['lover', 'family', 'friend', 'partner'] as const) {
      const result = buildCompatibilityInterpretation(
        slug,
        { name: '나', birthInput: { year: ya, month: 3, day: 12, hour: 9, gender: 'male' } },
        { name: '상대', birthInput: { year: yb, month: 7, day: 21, hour: 14, gender: 'female' } }
      );
      const fields = [
        result.supportiveSummary,
        result.cautionSummary,
        result.summary,
        result.practiceSummary,
        result.currentFlowSummary,
        ...result.evidence.map((e) => e.body),
      ];
      for (const text of fields) {
        for (const dup of ['기운 기운', '흐름 흐름', '자리 자리', '역할 역할']) {
          assert.ok(
            !text.includes(dup),
            `궁합(${slug}, ${ya}×${yb}) 텍스트에 중복 "${dup}" 잔존: "${text}"`
          );
        }
      }
    }
  }
});

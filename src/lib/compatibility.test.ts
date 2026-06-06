import assert from 'node:assert/strict';
import {
  buildCompatibilityCoupleKey,
  buildCompatibilityInterpretation,
  buildCompatibilityScopeKey,
  inferCompatibilityRelationshipSlug,
  resolveProfileDisplayName,
} from './compatibility';
import type { CompatibilityRelationshipSlug } from '@/content/moonlight';
import type { BirthInput } from '@/lib/saju/types';

declare const test: (name: string, fn: () => Promise<void> | void) => void;

function makeCompat(slug: CompatibilityRelationshipSlug, ya: number, yb: number) {
  return buildCompatibilityInterpretation(
    slug,
    { name: '나', birthInput: { year: ya, month: 3, day: 12, hour: 9, gender: 'male' } },
    { name: '상대', birthInput: { year: yb, month: 7, day: 21, hour: 14, gender: 'female' } }
  );
}

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

// 2026-05-23: 궁합 본문(evidence/practicalCards 포함)은 simplifySajuCopy 미경유 → raw 노출.
//   (1) naming-policy §5: 본문에 한자(천간·지지) 0개. 일간/일지는 한글로.
//   (2) bug class (a): 받침 없는 일간/일지(戊무·己기·癸계·子자 등) 뒤에 '과/은/을'
//       대신 '와/는/를' 가 붙어야 함. "戊과 己은" 류 회귀 가드.
test('compatibility: 본문에 한자 천간·지지 노출 0개 + 받침 조사 정합(戊과/己은 류 없음)', () => {
  const HANJA = /[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]/;
  // 받침 없는 한글 일간/일지 뒤에 붙으면 안 되는 조사 조합.
  const BAD_JOSA = /(무|기|계|자|오|미|유|이|해|사|묘|차)(과|은|을)(?=[\s.,])/;
  const inputs: Array<[number, number, number, number]> = [
    [1982, 3, 1990, 7], // 다양한 일간/일지 조합
    [1978, 11, 2001, 2],
    [1995, 6, 1970, 9],
    [1988, 12, 1999, 4],
    [2000, 8, 1985, 1],
    [1972, 5, 1993, 10],
  ];
  for (const [ya, ma, yb, mb] of inputs) {
    for (const slug of ['lover', 'family', 'friend', 'partner'] as const) {
      const result = buildCompatibilityInterpretation(
        slug,
        { name: '나', birthInput: { year: ya, month: ma, day: 12, hour: 9, gender: 'male' } },
        { name: '상대', birthInput: { year: yb, month: mb, day: 21, hour: 14, gender: 'female' } }
      );
      const fields = [
        result.headline,
        result.summary,
        result.supportiveSummary,
        result.cautionSummary,
        result.practiceSummary,
        result.currentFlowSummary,
        result.relationshipLensBody,
        ...result.evidence.map((e) => e.body),
        ...result.practicalCards.flatMap((c) => [c.title, c.summary, c.practice]),
      ];
      for (const text of fields) {
        assert.ok(
          !HANJA.test(text),
          `궁합(${slug}, ${ya}×${yb}) 본문에 한자 노출: "${text}"`
        );
        assert.ok(
          !BAD_JOSA.test(text),
          `궁합(${slug}, ${ya}×${yb}) 받침 조사 오류(예: 戊과/己은): "${text}"`
        );
      }
    }
  }
});

// 2026-05-23 — ②-a: 유료 §8 "깊은 풀이" 가 관계유형별 정적 텍스트라 모든 커플이
//   동일했던 문제(=부실)를 해소하기 위해 커플별 맞춤 deepSections 를 추가했다.
//   (1) 최소 3개 섹션, 각 본문은 충분한 분량, (2) 서로 다른 커플은 내용이 달라야 함
//   (정적 텍스트 회귀 가드), (3) 본문 한자 0개(naming-policy §5).
test('compatibility: deepSections 가 커플별로 다르고(정적 회귀 가드) 분량·네이밍 정책을 지킴', () => {
  const a = makeCompat('lover', 1982, 1990);

  assert.ok(Array.isArray(a.deepSections), 'deepSections 가 배열이어야 함');
  assert.ok(
    a.deepSections.length >= 3,
    `deepSections 가 너무 적음: ${a.deepSections.length}`
  );
  for (const section of a.deepSections) {
    assert.ok(section.title.trim().length > 0, 'deep section title 비어 있음');
    assert.ok(
      [...section.body].length >= 30,
      `deep section body 가 너무 짧음: "${section.body}"`
    );
  }

  // 서로 다른 커플 → 깊은 풀이 본문이 달라야 한다(모든 커플 동일 = 부실 회귀).
  const b = makeCompat('lover', 1995, 1970);
  assert.notEqual(
    a.deepSections.map((s) => s.body).join('|'),
    b.deepSections.map((s) => s.body).join('|'),
    '서로 다른 두 커플의 deepSections 가 완전히 동일 — 정적 텍스트 회귀'
  );

  // 본문 한자 0개 (naming-policy §5) — 모든 관계유형.
  const HANJA = /[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]/;
  for (const slug of ['lover', 'family', 'friend', 'partner'] as const) {
    const r = makeCompat(slug, 1988, 1999);
    for (const section of r.deepSections) {
      assert.ok(!HANJA.test(section.title), `deep title 한자: "${section.title}"`);
      assert.ok(!HANJA.test(section.body), `deep body 한자: "${section.body}"`);
    }
  }
});

// 2026-05-23 — ① per-couple 1회권용 커플 키. 결제 CTA(클라이언트)와 권한 게이트(서버)가
//   같은 키를 만들어야 per-couple scope 가 맞물린다. node:crypto 없이 isomorphic, 순서 무관.
test('compatibility 커플 키: 순서 무관·결정론·다른 커플은 다른 키 + scope 포맷', () => {
  const a: BirthInput = { year: 1990, month: 4, day: 12, hour: 9, gender: 'female' };
  const b: BirthInput = { year: 1988, month: 9, day: 3, hour: 14, gender: 'male' };
  const c: BirthInput = { year: 2000, month: 1, day: 1, gender: 'male' };

  const k1 = buildCompatibilityCoupleKey(a, b);
  const k2 = buildCompatibilityCoupleKey(b, a);
  assert.equal(k1, k2, '순서만 바꾼 동일 커플의 키가 다름');
  assert.ok(k1.length > 0 && /^[a-z0-9]+$/.test(k1), `커플 키가 URL-safe 가 아님: "${k1}"`);
  assert.equal(buildCompatibilityCoupleKey(a, b), k1, '같은 입력인데 키가 비결정론적');
  assert.notEqual(buildCompatibilityCoupleKey(a, c), k1, '다른 커플인데 키가 동일');
  assert.equal(buildCompatibilityScopeKey(k1), `compat:${k1}`);
});

test('deep sections are differentiated from free summary cards and carry evidence', () => {
  const result = makeCompat('lover', 1988, 1991);

  for (const section of result.deepSections) {
    const card = result.practicalCards.find((c) => c.key === section.key);
    assert.ok(card, `practical card for ${section.key} must exist`);
    assert.notEqual(
      section.body,
      card!.summary,
      `${section.key}: deep body must differ from free summary`
    );
    assert.notEqual(
      section.body,
      card!.practice,
      `${section.key}: deep body must not equal raw practice`
    );
    assert.ok(
      typeof section.evidence === 'string' && section.evidence.trim().length > 0,
      `${section.key}: evidence one-liner must be present`
    );
  }

  assert.deepEqual(
    result.deepSections.map((s) => s.key).sort(),
    ['communication', 'conflict', 'distance', 'money']
  );
});

test('deep section framing reflects score band and stem-interaction kind', () => {
  const a = makeCompat('lover', 1988, 1991).deepSections.find((s) => s.key === 'conflict');
  const b = makeCompat('lover', 1990, 1990).deepSections.find((s) => s.key === 'conflict');
  assert.ok(a && b);
  for (const s of [a!, b!]) {
    assert.doesNotMatch(s.body, /반드시|100%|완벽한 궁합|무조건|절대/);
  }
});

test('deep section body never repeats a caution sentence for same-element couples', () => {
  // 1980×1982: 두 일간이 같은 오행(목) → 과거엔 caution 문장이 중복되었다.
  const result = makeCompat('lover', 1980, 1982);
  for (const section of result.deepSections) {
    const sentences = section.body
      .split(/(?<=다\.)\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const seen = new Set<string>();
    for (const s of sentences) {
      assert.ok(!seen.has(s), `${section.key}: duplicated sentence -> "${s}"`);
      seen.add(s);
    }
  }
});

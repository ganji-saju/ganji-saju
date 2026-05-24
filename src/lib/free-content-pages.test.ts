import assert from 'node:assert/strict';
import { ZODIAC_FORTUNES, type ZodiacByYearFortune } from './free-content-pages';

declare const test: (name: string, fn: () => void) => void;

// naming-policy.md §12 — 본문(요약·풀이)에서 0건이어야 하는 금지 어휘.
const FORBIDDEN_PATTERNS: RegExp[] = [
  /(새싹|햇살|흙|쇠|물)의\s*결/g,
  /\b(새싹|햇살)\s+(기운|결|흐름)/g,
  /결단과|안정과|열정과|시작과|지혜과/g,
  /(표현|생각|절제|직관|돌봄|관찰|베푸는|밀어붙이는)의\s*기운/g,
  /[가-힣]+의\s*결[은이를을과와\s]/g,
  /(표현|돌봄|재물|관계|기준)형\s*사주/g,
  /(돌봄|표현|기준|단단함)의\s*결/g,
];

// 본문 한자 노출 금지(naming-policy §10). 천간/지지/오행 한자가 summary·detail 에 있으면 위반.
const HANJA_PATTERN = /[一-鿿]/;

function getRooster() {
  const rooster = ZODIAC_FORTUNES.find((item) => item.slug === 'rooster');
  assert.ok(rooster, '닭띠(rooster) 항목이 있어야 합니다');
  return rooster;
}

test('닭띠 byYear 는 1957/1969/1981/1993/2005 다섯 연생을 가진다', () => {
  const rooster = getRooster();
  assert.ok(rooster.byYear, '닭띠는 byYear 데이터를 가져야 합니다');
  const years = Object.keys(rooster.byYear).map(Number).sort((a, b) => a - b);
  assert.deepEqual(years, [1957, 1969, 1981, 1993, 2005]);
});

test('닭띠 각 연생은 간지·독음·오행 라벨과 비지 않은 요약/풀이/행동조언을 가진다', () => {
  const rooster = getRooster();
  const expected: Record<number, { ganji: string; ganjiKo: string; element: string }> = {
    1957: { ganji: '丁酉', ganjiKo: '정유', element: '화 기운' },
    1969: { ganji: '己酉', ganjiKo: '기유', element: '토 기운' },
    1981: { ganji: '辛酉', ganjiKo: '신유', element: '금 기운' },
    1993: { ganji: '癸酉', ganjiKo: '계유', element: '수 기운' },
    2005: { ganji: '乙酉', ganjiKo: '을유', element: '목 기운' },
  };

  for (const [yearKey, fortune] of Object.entries(rooster.byYear ?? {})) {
    const year = Number(yearKey);
    const want = expected[year];
    assert.ok(want, `예상치 못한 연생 ${year}`);
    assert.equal(fortune.ganji, want.ganji, `${year} 간지`);
    assert.equal(fortune.ganjiKo, want.ganjiKo, `${year} 독음`);
    assert.equal(fortune.element, want.element, `${year} 오행 라벨`);
    assert.ok(fortune.summary.length > 0, `${year} 요약 비어있음`);
    assert.ok(fortune.detail.length >= 80, `${year} 풀이가 너무 짧음`);
    assert.ok(fortune.action.length > 0, `${year} 행동 조언 비어있음`);
  }
});

test('닭띠 연생 본문(요약·풀이)에는 한자가 노출되지 않는다', () => {
  const rooster = getRooster();
  for (const [year, fortune] of Object.entries(rooster.byYear ?? {})) {
    assert.ok(!HANJA_PATTERN.test(fortune.summary), `${year} 요약에 한자 노출`);
    assert.ok(!HANJA_PATTERN.test(fortune.detail), `${year} 풀이에 한자 노출`);
    assert.ok(!HANJA_PATTERN.test(fortune.action), `${year} 행동 조언에 한자 노출`);
  }
});

test('닭띠 연생 본문은 naming-policy 금지 어휘를 포함하지 않는다', () => {
  const rooster = getRooster();
  const findings: string[] = [];
  for (const [year, fortune] of Object.entries(rooster.byYear ?? {})) {
    const text = `${fortune.summary} ${fortune.detail} ${fortune.action}`;
    for (const pattern of FORBIDDEN_PATTERNS) {
      pattern.lastIndex = 0;
      const matches = text.match(pattern) ?? [];
      if (matches.length > 0) {
        findings.push(`${year}: ${matches.join(', ')}`);
      }
    }
  }
  assert.deepEqual(findings, []);
});

test('연생 풀이는 닭띠 파일럿 범위 — 다른 띠에는 byYear 가 없다', () => {
  const withByYear = ZODIAC_FORTUNES.filter(
    (item): item is typeof item & { byYear: Record<number, ZodiacByYearFortune> } =>
      Boolean(item.byYear)
  ).map((item) => item.slug);
  assert.deepEqual(withByYear, ['rooster']);
});

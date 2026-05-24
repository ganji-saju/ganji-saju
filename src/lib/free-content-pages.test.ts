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

// 2026-05-24 — 12지 전체 연생별 풀이의 단일 진실 표(간지·독음·오행 라벨).
//   free-content-pages.ts 의 byYear 데이터가 이 표와 정확히 일치해야 한다.
type ByYearSpec = { ganji: string; ganjiKo: string; element: string };
const EXPECTED_BY_YEAR: Record<string, Record<number, ByYearSpec>> = {
  rat: {
    1960: { ganji: '庚子', ganjiKo: '경자', element: '금 기운' },
    1972: { ganji: '壬子', ganjiKo: '임자', element: '수 기운' },
    1984: { ganji: '甲子', ganjiKo: '갑자', element: '목 기운' },
    1996: { ganji: '丙子', ganjiKo: '병자', element: '화 기운' },
    2008: { ganji: '戊子', ganjiKo: '무자', element: '토 기운' },
  },
  ox: {
    1961: { ganji: '辛丑', ganjiKo: '신축', element: '금 기운' },
    1973: { ganji: '癸丑', ganjiKo: '계축', element: '수 기운' },
    1985: { ganji: '乙丑', ganjiKo: '을축', element: '목 기운' },
    1997: { ganji: '丁丑', ganjiKo: '정축', element: '화 기운' },
    2009: { ganji: '己丑', ganjiKo: '기축', element: '토 기운' },
  },
  tiger: {
    1962: { ganji: '壬寅', ganjiKo: '임인', element: '수 기운' },
    1974: { ganji: '甲寅', ganjiKo: '갑인', element: '목 기운' },
    1986: { ganji: '丙寅', ganjiKo: '병인', element: '화 기운' },
    1998: { ganji: '戊寅', ganjiKo: '무인', element: '토 기운' },
    2010: { ganji: '庚寅', ganjiKo: '경인', element: '금 기운' },
  },
  rabbit: {
    1963: { ganji: '癸卯', ganjiKo: '계묘', element: '수 기운' },
    1975: { ganji: '乙卯', ganjiKo: '을묘', element: '목 기운' },
    1987: { ganji: '丁卯', ganjiKo: '정묘', element: '화 기운' },
    1999: { ganji: '己卯', ganjiKo: '기묘', element: '토 기운' },
    2011: { ganji: '辛卯', ganjiKo: '신묘', element: '금 기운' },
  },
  dragon: {
    1964: { ganji: '甲辰', ganjiKo: '갑진', element: '목 기운' },
    1976: { ganji: '丙辰', ganjiKo: '병진', element: '화 기운' },
    1988: { ganji: '戊辰', ganjiKo: '무진', element: '토 기운' },
    2000: { ganji: '庚辰', ganjiKo: '경진', element: '금 기운' },
    2012: { ganji: '壬辰', ganjiKo: '임진', element: '수 기운' },
  },
  snake: {
    1965: { ganji: '乙巳', ganjiKo: '을사', element: '목 기운' },
    1977: { ganji: '丁巳', ganjiKo: '정사', element: '화 기운' },
    1989: { ganji: '己巳', ganjiKo: '기사', element: '토 기운' },
    2001: { ganji: '辛巳', ganjiKo: '신사', element: '금 기운' },
    2013: { ganji: '癸巳', ganjiKo: '계사', element: '수 기운' },
  },
  horse: {
    1954: { ganji: '甲午', ganjiKo: '갑오', element: '목 기운' },
    1966: { ganji: '丙午', ganjiKo: '병오', element: '화 기운' },
    1978: { ganji: '戊午', ganjiKo: '무오', element: '토 기운' },
    1990: { ganji: '庚午', ganjiKo: '경오', element: '금 기운' },
    2002: { ganji: '壬午', ganjiKo: '임오', element: '수 기운' },
  },
  goat: {
    1955: { ganji: '乙未', ganjiKo: '을미', element: '목 기운' },
    1967: { ganji: '丁未', ganjiKo: '정미', element: '화 기운' },
    1979: { ganji: '己未', ganjiKo: '기미', element: '토 기운' },
    1991: { ganji: '辛未', ganjiKo: '신미', element: '금 기운' },
    2003: { ganji: '癸未', ganjiKo: '계미', element: '수 기운' },
  },
  monkey: {
    1956: { ganji: '丙申', ganjiKo: '병신', element: '화 기운' },
    1968: { ganji: '戊申', ganjiKo: '무신', element: '토 기운' },
    1980: { ganji: '庚申', ganjiKo: '경신', element: '금 기운' },
    1992: { ganji: '壬申', ganjiKo: '임신', element: '수 기운' },
    2004: { ganji: '甲申', ganjiKo: '갑신', element: '목 기운' },
  },
  rooster: {
    1957: { ganji: '丁酉', ganjiKo: '정유', element: '화 기운' },
    1969: { ganji: '己酉', ganjiKo: '기유', element: '토 기운' },
    1981: { ganji: '辛酉', ganjiKo: '신유', element: '금 기운' },
    1993: { ganji: '癸酉', ganjiKo: '계유', element: '수 기운' },
    2005: { ganji: '乙酉', ganjiKo: '을유', element: '목 기운' },
  },
  dog: {
    1958: { ganji: '戊戌', ganjiKo: '무술', element: '토 기운' },
    1970: { ganji: '庚戌', ganjiKo: '경술', element: '금 기운' },
    1982: { ganji: '壬戌', ganjiKo: '임술', element: '수 기운' },
    1994: { ganji: '甲戌', ganjiKo: '갑술', element: '목 기운' },
    2006: { ganji: '丙戌', ganjiKo: '병술', element: '화 기운' },
  },
  pig: {
    1959: { ganji: '己亥', ganjiKo: '기해', element: '토 기운' },
    1971: { ganji: '辛亥', ganjiKo: '신해', element: '금 기운' },
    1983: { ganji: '癸亥', ganjiKo: '계해', element: '수 기운' },
    1995: { ganji: '乙亥', ganjiKo: '을해', element: '목 기운' },
    2007: { ganji: '丁亥', ganjiKo: '정해', element: '화 기운' },
  },
};

const EXPECTED_SLUGS = Object.keys(EXPECTED_BY_YEAR);

function getZodiac(slug: string) {
  const item = ZODIAC_FORTUNES.find((entry) => entry.slug === slug);
  assert.ok(item, `${slug} 항목이 있어야 합니다`);
  return item;
}

test('12지 모든 띠가 byYear 연생별 풀이를 가진다', () => {
  const withByYear = ZODIAC_FORTUNES.filter(
    (item): item is typeof item & { byYear: Record<number, ZodiacByYearFortune> } =>
      Boolean(item.byYear)
  ).map((item) => item.slug);
  assert.deepEqual(withByYear.slice().sort(), EXPECTED_SLUGS.slice().sort());
  assert.equal(withByYear.length, 12, '12지 전체가 byYear 를 가져야 합니다');
});

test('각 띠 byYear 는 표에 정의된 다섯 연생을 정확히 가진다', () => {
  for (const slug of EXPECTED_SLUGS) {
    const item = getZodiac(slug);
    assert.ok(item.byYear, `${slug} 는 byYear 데이터를 가져야 합니다`);
    const years = Object.keys(item.byYear ?? {}).map(Number).sort((a, b) => a - b);
    const expectedYears = Object.keys(EXPECTED_BY_YEAR[slug]).map(Number).sort((a, b) => a - b);
    assert.deepEqual(years, expectedYears, `${slug} 연생 목록`);
  }
});

test('각 연생은 표와 일치하는 간지·독음·오행 라벨과 비지 않은 풀이를 가진다', () => {
  for (const slug of EXPECTED_SLUGS) {
    const item = getZodiac(slug);
    for (const [yearKey, fortune] of Object.entries(item.byYear ?? {})) {
      const year = Number(yearKey);
      const want = EXPECTED_BY_YEAR[slug][year];
      assert.ok(want, `${slug} 예상치 못한 연생 ${year}`);
      assert.equal(fortune.ganji, want.ganji, `${slug} ${year} 간지`);
      assert.equal(fortune.ganjiKo, want.ganjiKo, `${slug} ${year} 독음`);
      assert.equal(fortune.element, want.element, `${slug} ${year} 오행 라벨`);
      assert.ok(fortune.summary.length > 0, `${slug} ${year} 요약 비어있음`);
      assert.ok(fortune.detail.length >= 80, `${slug} ${year} 풀이가 너무 짧음`);
      assert.ok(fortune.action.length > 0, `${slug} ${year} 행동 조언 비어있음`);
    }
  }
});

test('모든 연생 본문(요약·풀이·행동조언)에 한자가 노출되지 않는다', () => {
  for (const slug of EXPECTED_SLUGS) {
    const item = getZodiac(slug);
    for (const [year, fortune] of Object.entries(item.byYear ?? {})) {
      assert.ok(!HANJA_PATTERN.test(fortune.summary), `${slug} ${year} 요약에 한자 노출`);
      assert.ok(!HANJA_PATTERN.test(fortune.detail), `${slug} ${year} 풀이에 한자 노출`);
      assert.ok(!HANJA_PATTERN.test(fortune.action), `${slug} ${year} 행동 조언에 한자 노출`);
    }
  }
});

test('모든 연생 본문은 naming-policy 금지 어휘를 포함하지 않는다', () => {
  const findings: string[] = [];
  for (const slug of EXPECTED_SLUGS) {
    const item = getZodiac(slug);
    for (const [year, fortune] of Object.entries(item.byYear ?? {})) {
      const text = `${fortune.summary} ${fortune.detail} ${fortune.action}`;
      for (const pattern of FORBIDDEN_PATTERNS) {
        pattern.lastIndex = 0;
        const matches = text.match(pattern) ?? [];
        if (matches.length > 0) {
          findings.push(`${slug} ${year}: ${matches.join(', ')}`);
        }
      }
    }
  }
  assert.deepEqual(findings, []);
});

// 2026-05-25 — 기간별 한 줄(periodLines) 가드.
//   상세 페이지 기간 탭(오늘/이번주/이번달/올해) 라벨과 내용 일치를 위해 추가한 필드.
const PERIOD_KEYS = ['today', 'week', 'month', 'year'] as const;

test('12지 모든 띠가 periodLines 의 4기간(오늘/이번주/이번달/올해)을 모두 가진다', () => {
  for (const item of ZODIAC_FORTUNES) {
    assert.ok(item.periodLines, `${item.slug} 는 periodLines 를 가져야 합니다`);
    for (const key of PERIOD_KEYS) {
      const line = item.periodLines[key];
      assert.equal(typeof line, 'string', `${item.slug} periodLines.${key} 는 문자열이어야 합니다`);
      assert.ok(line.trim().length > 0, `${item.slug} periodLines.${key} 가 비어있음`);
    }
  }
});

test('모든 띠 periodLines 4기간이 서로 다른 문장이다', () => {
  for (const item of ZODIAC_FORTUNES) {
    const lines = PERIOD_KEYS.map((key) => item.periodLines[key]);
    const unique = new Set(lines);
    assert.equal(unique.size, PERIOD_KEYS.length, `${item.slug} periodLines 기간별 문장이 중복됨`);
  }
});

test('모든 띠 periodLines 에 한자가 노출되지 않는다', () => {
  for (const item of ZODIAC_FORTUNES) {
    for (const key of PERIOD_KEYS) {
      assert.ok(
        !HANJA_PATTERN.test(item.periodLines[key]),
        `${item.slug} periodLines.${key} 에 한자 노출`
      );
    }
  }
});

test('모든 띠 periodLines 는 naming-policy 금지 어휘를 포함하지 않는다', () => {
  const findings: string[] = [];
  for (const item of ZODIAC_FORTUNES) {
    for (const key of PERIOD_KEYS) {
      const text = item.periodLines[key];
      for (const pattern of FORBIDDEN_PATTERNS) {
        pattern.lastIndex = 0;
        const matches = text.match(pattern) ?? [];
        if (matches.length > 0) {
          findings.push(`${item.slug} ${key}: ${matches.join(', ')}`);
        }
      }
    }
  }
  assert.deepEqual(findings, []);
});

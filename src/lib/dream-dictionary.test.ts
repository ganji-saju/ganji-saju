// 2026-05-24 꿈해몽 풍부화 phase 1 — 사전 구조 강화 + 검색↔상세 연결 회귀 테스트.
//   run-unit-tests.mjs (globalThis.test) 에서 수집. free-content-pages.test.ts 스타일.
import assert from 'node:assert/strict';
import {
  DREAM_DICTIONARY,
  DREAM_FORTUNE_LABEL,
  searchDream,
  type DreamFortune,
} from './dream-dictionary';
import { DREAM_CONTENT } from './dream/dream-content';
import { DREAM_ENTRIES } from './free-content-pages';
import { toChosung } from './dream/hangul-search';

declare const test: (name: string, fn: () => void) => void;

const VALID_FORTUNES: DreamFortune[] = ['길몽', '흉몽', '중립'];

// naming-policy.md §12 — 본문(요약·상황·행동)에서 0건이어야 하는 금지 어휘.
const FORBIDDEN_PATTERNS: RegExp[] = [
  /(새싹|햇살|흙|쇠|물)의\s*결/g,
  /\b(새싹|햇살)\s+(기운|결|흐름)/g,
  /결단과|안정과|열정과|시작과|지혜과/g,
  /(표현|생각|절제|직관|돌봄|관찰|베푸는|밀어붙이는)의\s*기운/g,
  /[가-힣]+의\s*결[은이를을과와\s]/g,
  /(표현|돌봄|재물|관계|기준)형\s*사주/g,
  /(돌봄|표현|기준|단단함)의\s*결/g,
];

// 본문 한자 노출 지양(naming-policy §10). summary·action·상황 meaning 에 한자가 있으면 위반.
//   keyword/hanja 필드는 정체성 표기라 제외(hanja 카드 노출은 허용).
const HANJA_PATTERN = /[一-鿿]/;

function entryText(key: string): string {
  const e = DREAM_DICTIONARY[key];
  return [e.summary, e.action ?? '', ...e.situations.map((s) => `${s.label} ${s.meaning}`)].join(' ');
}

test('사전은 300개 이상으로 대량 확충되어 있다(phase 5)', () => {
  const count = Object.keys(DREAM_DICTIONARY).length;
  assert.ok(count >= 300, `사전 엔트리 수 ${count} 가 300 이상이어야 합니다`);
});

test('keyword 는 사전 전체에서 유니크하다(중복 표제어 금지)', () => {
  const keywords = Object.values(DREAM_DICTIONARY).map((e) => e.keyword);
  const seen = new Set<string>();
  const dups: string[] = [];
  for (const kw of keywords) {
    if (seen.has(kw)) dups.push(kw);
    seen.add(kw);
  }
  assert.deepEqual(dups, [], `중복 키워드: ${dups.join(', ')}`);
  assert.equal(seen.size, keywords.length, '유니크 키워드 수가 전체 엔트리 수와 일치해야 합니다');
});

test('흉몽 분류가 1건 이상 존재한다(주의·점검 신호 톤)', () => {
  const hyung = Object.entries(DREAM_DICTIONARY).filter(
    ([, e]) => e.fortune === '흉몽'
  );
  assert.ok(hyung.length >= 1, '흉몽으로 분류된 엔트리가 최소 1건 있어야 합니다');
});

test('흉몽 본문은 공포·단정 표현을 쓰지 않는다(순화 톤 가드)', () => {
  // 흉몽도 "주의가 필요하다는 신호" 식 순화. 공포/단정 어휘는 0건이어야 함.
  const FEAR_WORDS = /불행|재앙|저주|죽을|망한다|반드시|틀림없이|큰일난다/;
  const findings: string[] = [];
  for (const [key, entry] of Object.entries(DREAM_DICTIONARY)) {
    if (entry.fortune !== '흉몽') continue;
    const text = entryText(key);
    if (FEAR_WORDS.test(text)) findings.push(`${key}: ${text.match(FEAR_WORDS)?.[0]}`);
  }
  assert.deepEqual(findings, [], `흉몽 본문 공포·단정 표현: ${findings.join(', ')}`);
});

test('모든 엔트리는 fortune(길/흉/중립)·action·situations 강화 필드를 가진다', () => {
  for (const [key, entry] of Object.entries(DREAM_DICTIONARY)) {
    assert.ok(entry.fortune, `${key}: fortune 누락`);
    assert.ok(VALID_FORTUNES.includes(entry.fortune!), `${key}: fortune 값 "${entry.fortune}" 가 허용 집합 밖`);
    assert.ok((entry.action ?? '').trim().length > 0, `${key}: action(행동 가이드) 비어있음`);
    assert.ok(entry.situations.length > 0, `${key}: situations 비어있음`);
  }
});

test('keyword 필드는 객체 키와 일치한다', () => {
  for (const [key, entry] of Object.entries(DREAM_DICTIONARY)) {
    assert.equal(entry.keyword, key, `${key}: keyword 불일치`);
  }
});

test('detailSlug 는 실재하는 DREAM_CONTENT slug 를 가리킨다', () => {
  for (const [key, entry] of Object.entries(DREAM_DICTIONARY)) {
    if (!entry.detailSlug) continue;
    assert.ok(
      DREAM_CONTENT[entry.detailSlug],
      `${key}: detailSlug "${entry.detailSlug}" 가 DREAM_CONTENT 에 없음`
    );
    assert.equal(
      DREAM_CONTENT[entry.detailSlug].slug,
      entry.detailSlug,
      `${key}: DREAM_CONTENT slug 정합성`
    );
  }
});

test('DREAM_CONTENT 의 모든 slug 는 최소 한 키워드에서 연결된다(검색↔상세)', () => {
  const linked = new Set(
    Object.values(DREAM_DICTIONARY)
      .map((e) => e.detailSlug)
      .filter((s): s is string => Boolean(s))
  );
  const missing = Object.keys(DREAM_CONTENT).filter((slug) => !linked.has(slug));
  assert.deepEqual(missing, [], `연결되지 않은 상세 slug: ${missing.join(', ')}`);
});

test('searchDream 정확 매치는 강화 필드를 그대로 전달한다', () => {
  const result = searchDream('뱀');
  assert.equal(result.exact, true);
  assert.equal(result.match.keyword, '뱀');
  assert.equal(result.match.fortune, '길몽');
  assert.equal(result.match.detailSlug, 'snake-dream');
  assert.ok((result.match.action ?? '').length > 0);
});

test('searchDream 미등록 검색어는 fallback(상세 링크 없음)을 반환한다', () => {
  // 순수 ASCII 쿼리는 정확/부분/초성/자모/related 단계를 모두 통과하지 못하고
  // 최종 FALLBACK_MEANING(detailSlug 없음)으로 수렴한다. (한글 쿼리는 자모 단계에서
  // detailSlug 가 붙은 인기 키워드로 흡수될 수 있으므로 진짜 fallback 경로를 검증)
  const result = searchDream('zzzqqq');
  assert.equal(result.exact, false);
  assert.equal(result.match.detailSlug, undefined, 'fallback 은 detailSlug 가 없어야 함');
});

test('DREAM_FORTUNE_LABEL 은 세 분류를 모두 정의한다', () => {
  for (const f of VALID_FORTUNES) {
    assert.ok(DREAM_FORTUNE_LABEL[f], `${f} 라벨 누락`);
  }
});

test('모든 엔트리 본문(요약·상황·행동)에 한자가 노출되지 않는다', () => {
  for (const key of Object.keys(DREAM_DICTIONARY)) {
    assert.ok(!HANJA_PATTERN.test(entryText(key)), `${key}: 본문에 한자 노출`);
  }
});

test('모든 엔트리 본문은 naming-policy 금지 어휘를 포함하지 않는다', () => {
  const findings: string[] = [];
  for (const key of Object.keys(DREAM_DICTIONARY)) {
    const text = entryText(key);
    for (const pattern of FORBIDDEN_PATTERNS) {
      pattern.lastIndex = 0;
      const matches = text.match(pattern) ?? [];
      if (matches.length > 0) findings.push(`${key}: ${matches.join(', ')}`);
    }
  }
  assert.deepEqual(findings, []);
});

test('searchDream matches by chosung-only query', () => {
  // 'ㅂ' 초성 입력 → fallback 에코('ㅂ')가 아닌 실제 사전 키워드로 수렴해야 한다.
  const r = searchDream('ㅂ');
  assert.equal(r.exact, false);
  assert.notEqual(r.match.keyword, 'ㅂ', 'must not echo the query as fallback');
  assert.ok(r.match.keyword in DREAM_DICTIONARY, 'must resolve to a real dictionary entry');
  assert.equal(toChosung(r.match.keyword).startsWith('ㅂ'), true);
});

test('searchDream still honors exact and substring matches (regression)', () => {
  const exact = searchDream('뱀');
  assert.equal(exact.exact, true);
  assert.equal(exact.match.keyword, '뱀');

  const empty = searchDream('');
  assert.equal(empty.exact, true);
  assert.equal(empty.match.keyword, '이빨');
});

test('searchDream resolves jamo-level partial input via the jamo tier', () => {
  // 실제 사전에서 2음절+ 키를 골라, 1음절 + (2음절 초성) 형태의 부분입력을 만든다.
  // 이 쿼리는 정확/부분(substring)/초성 단계를 통과하지 못하고 자모 단계(2.6)로 수렴해야 한다.
  const CHOSUNG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  const key = Object.keys(DREAM_DICTIONARY).find((k) => k.length >= 2 && /^[가-힣]+$/.test(k));
  assert.ok(key, 'expected at least one multi-syllable Hangul key');
  const second = key!.charCodeAt(1) - 0xac00;
  const query = key![0] + CHOSUNG[Math.floor(second / 588)];

  // 가드: 이 쿼리가 정말 자모 단계 대상인지(정확/부분/초성 아님) 확인.
  assert.notEqual(query, key);
  assert.equal(key!.includes(query), false);
  assert.equal(query.includes(key!), false);

  const r = searchDream(query);
  assert.equal(r.exact, false);
  assert.ok(r.match.keyword in DREAM_DICTIONARY, 'must resolve to a real dictionary entry, not echo');
  assert.notEqual(r.match.keyword, query);
});

test('DREAM_CONTENT 는 21개 이상이며 본문에 한자/금지어휘가 없다', () => {
  const slugs = Object.keys(DREAM_CONTENT);
  // 기존 8개 + Batch1 12개 + Batch2 12개 + Batch3 12개 + Batch4 12개 = 56개. 임계값은 실제 데이터에 맞춰 56 로 둔다.
  assert.ok(slugs.length >= 56, `DREAM_CONTENT ${slugs.length} 개 (>=56 기대)`);

  const HANJA = /[一-鿿]/;
  const FORBIDDEN: RegExp[] = [
    /(새싹|햇살|흙|쇠|물)의\s*결/g,
    /(반드시|100%|완치|무조건|틀림없이)/g,
  ];
  const findings: string[] = [];
  for (const [slug, e] of Object.entries(DREAM_CONTENT)) {
    const body = [
      e.oneLineSummary, e.baseMeaning, e.psychological, e.caution,
      ...e.situations.map((s) => `${s.heading} ${s.body}`),
      ...e.actionGuide,
      ...e.faqs.map((f) => `${f.question} ${f.answer}`),
    ].join(' ');
    if (HANJA.test(body)) findings.push(`${slug}: 한자 노출`);
    for (const p of FORBIDDEN) { p.lastIndex = 0; if (p.test(body)) findings.push(`${slug}: 금지어휘`); }
    for (const rel of e.relatedSlugs) {
      assert.ok(DREAM_CONTENT[rel], `${slug}: relatedSlug "${rel}" 미실재`);
    }
  }
  assert.deepEqual(findings, []);
});

test('신규 12 슬러그는 DREAM_ENTRIES·DREAM_CONTENT·detailSlug 3곳에 모두 존재한다', () => {
  const NEW = ['pig-dream','dragon-dream','feces-dream','tiger-dream','fire-dream',
    'death-dream','marriage-dream','fish-dream','house-dream','exam-dream',
    'baby-dream','blood-dream'];
  const entrySlugs = new Set(DREAM_ENTRIES.map((e) => e.slug));
  const linked = new Set(
    Object.values(DREAM_DICTIONARY).map((e) => e.detailSlug).filter(Boolean)
  );
  for (const s of NEW) {
    assert.ok(DREAM_CONTENT[s], `${s} DREAM_CONTENT 누락`);
    assert.ok(entrySlugs.has(s), `${s} DREAM_ENTRIES 누락`);
    assert.ok(linked.has(s), `${s} detailSlug 연결 누락`);
  }
});

test('Batch3 12 슬러그는 DREAM_ENTRIES·DREAM_CONTENT·detailSlug 3곳에 모두 존재한다', () => {
  const NEW = ['rat-dream','clothes-dream','school-dream','clock-dream','phone-dream','moving-dream',
    'airplane-dream','snow-dream','flower-dream','cow-dream','mirror-dream','tree-dream'];
  const entrySlugs = new Set(DREAM_ENTRIES.map((e) => e.slug));
  const linked = new Set(
    Object.values(DREAM_DICTIONARY).map((e) => e.detailSlug).filter(Boolean)
  );
  for (const s of NEW) {
    assert.ok(DREAM_CONTENT[s], `${s} DREAM_CONTENT 누락`);
    assert.ok(entrySlugs.has(s), `${s} DREAM_ENTRIES 누락`);
    assert.ok(linked.has(s), `${s} detailSlug 연결 누락`);
  }
});

test('Batch4 12 슬러그는 DREAM_ENTRIES·DREAM_CONTENT·detailSlug 3곳에 모두 존재한다', () => {
  const NEW = ['hand-dream','foot-dream','star-dream','moon-dream','horse-dream','food-dream',
    'wallet-dream','bag-dream','knife-dream','police-dream','soldier-dream','alcohol-dream'];
  const entrySlugs = new Set(DREAM_ENTRIES.map((e) => e.slug));
  const linked = new Set(
    Object.values(DREAM_DICTIONARY).map((e) => e.detailSlug).filter(Boolean)
  );
  for (const s of NEW) {
    assert.ok(DREAM_CONTENT[s], `${s} DREAM_CONTENT 누락`);
    assert.ok(entrySlugs.has(s), `${s} DREAM_ENTRIES 누락`);
    assert.ok(linked.has(s), `${s} detailSlug 연결 누락`);
  }
});

test('Batch5 12 슬러그는 DREAM_ENTRIES·DREAM_CONTENT·detailSlug 3곳에 모두 존재한다', () => {
  const NEW = ['celebrity-dream','ex-lover-dream','earthquake-dream','crying-dream','bear-dream','frog-dream',
    'chicken-dream','egg-dream','ring-dream','gold-dream','cleaning-dream','stairs-dream'];
  const entrySlugs = new Set(DREAM_ENTRIES.map((e) => e.slug));
  const linked = new Set(
    Object.values(DREAM_DICTIONARY).map((e) => e.detailSlug).filter(Boolean)
  );
  for (const s of NEW) {
    assert.ok(DREAM_CONTENT[s], `${s} DREAM_CONTENT 누락`);
    assert.ok(entrySlugs.has(s), `${s} DREAM_ENTRIES 누락`);
    assert.ok(linked.has(s), `${s} detailSlug 연결 누락`);
  }
});

test('Batch2 12 슬러그는 DREAM_ENTRIES·DREAM_CONTENT·detailSlug 3곳에 모두 존재한다', () => {
  const NEW = ['hair-dream','shoes-dream','car-dream','cat-dream','puppy-dream','bird-dream',
    'sea-dream','rain-dream','mountain-dream','spider-dream','thief-dream','fight-dream'];
  const entrySlugs = new Set(DREAM_ENTRIES.map((e) => e.slug));
  const linked = new Set(
    Object.values(DREAM_DICTIONARY).map((e) => e.detailSlug).filter(Boolean)
  );
  for (const s of NEW) {
    assert.ok(DREAM_CONTENT[s], `${s} DREAM_CONTENT 누락`);
    assert.ok(entrySlugs.has(s), `${s} DREAM_ENTRIES 누락`);
    assert.ok(linked.has(s), `${s} detailSlug 연결 누락`);
  }
});

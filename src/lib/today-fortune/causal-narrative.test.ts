import assert from 'node:assert/strict';
import { hashSeed, pickVariant, TermInk, rankJijiRelations, buildCausalNarrative, type CausalInput } from '@/lib/today-fortune/causal-narrative';

declare const test: (name: string, fn: () => void) => void;

test('causal: hashSeed 는 결정론이고 pickVariant 는 시드로 안정 선택', () => {
  assert.equal(hashSeed('a'), hashSeed('a'));
  assert.notEqual(hashSeed('a'), hashSeed('b'));
  const items = ['x', 'y', 'z'];
  const s = hashSeed('seed-1');
  assert.equal(pickVariant(items, s, 0), pickVariant(items, s, 0)); // 안정
  assert.ok(items.includes(pickVariant(items, s, 1)));
});

test('causal: TermInk 는 첫 등장에만 괄호 설명을 붙인다', () => {
  const ink = new TermInk();
  assert.equal(ink.sipsung('편관'), '편관(밀어붙이는 별)');
  assert.equal(ink.sipsung('편관'), '편관'); // 재등장은 bare
  assert.equal(ink.element('화'), '화 기운(말·밝게 퍼짐)');
  assert.equal(ink.element('화'), '화 기운');
  assert.deepEqual(ink.terms, ['편관', '화 기운']);
});

test('causal: rankJijiRelations 는 오늘 지지의 최강 관계를 고른다(申子辰 삼합 수)', () => {
  // 1982-01-29 남 진시 원국 지지: 酉(년) 丑(월) 子(일) 辰(시), 오늘 일진 지지 申
  const rel = rankJijiRelations('申', ['酉', '丑', '子', '辰']);
  assert.ok(rel, '관계 미탐지');
  assert.equal(rel!.kind, '삼합');
  assert.equal(rel!.element, '수');
  // 申子辰 → 자수·진토와 만남
  assert.deepEqual(rel!.natalBranches.sort(), ['子', '辰'].sort());
});

test('causal: rankJijiRelations 는 관계 없으면 null', () => {
  assert.equal(rankJijiRelations('午', ['申']), null);
});

// naming-policy §12 금지 정규식 (전량 0건이어야 함)
const FORBIDDEN_PATTERNS: RegExp[] = [
  /(새싹|햇살|흙|쇠|물)의\s*결/g,
  /\b(새싹|햇살)\s+(기운|결|흐름)/g,
  /결단과|안정과|열정과|시작과|지혜과/g,
  /(표현|생각|절제|직관|돌봄|관찰|베푸는|밀어붙이는)의\s*기운/g,
  /[가-힣]+의\s*결[은이를을과와\s]/g,
  /(표현|돌봄|재물|관계|기준)형\s*사주/g,
  /(돌봄|표현|기준|단단함)의\s*결/g,
];
const HANJA = /[㐀-鿿]/;

// 1982-01-29 남 진시, 2026-08-02 기준 CausalInput
const FIXTURE: CausalInput = {
  dayMaster: '壬', todayStem: '戊', todayBranch: '申',
  iljinTenGod: '편관',
  saewoonTenGod: '편재', wolwoonTenGod: '정관',
  topRelation: { kind: '삼합', element: '수', natalBranches: ['子', '辰'] },
  yongsin: '화', kishin: '금',
  dominantElement: '금', weakestElement: '화',
  topSinsal: { name: '귀문관살', category: '흉신' },
  strengthLevel: '중화',
};

test('causal: full 은 명리 근거(편관·삼합·화 기운·귀문관살)를 담는다', () => {
  const n = buildCausalNarrative(FIXTURE, { seed: '2026-08-02' });
  assert.match(n.full, /편관\(밀어붙이는 별\)/);
  assert.match(n.full, /삼합/);
  assert.match(n.full, /화 기운/);
  assert.match(n.full, /귀문관살\(예민함의 별\)/);
  assert.ok(n.full.length > n.brief.length, 'full 이 brief 보다 길어야');
});

test('causal: brief 는 원인+조언만(다층/신살 제외)', () => {
  const n = buildCausalNarrative(FIXTURE, { seed: '2026-08-02' });
  assert.match(n.brief, /편관/);
  assert.doesNotMatch(n.brief, /귀문관살|올해 흐름|이번 달/);
});

test('causal: naming-policy 금지 정규식 0건 + 본문 한자 0', () => {
  const n = buildCausalNarrative(FIXTURE, { seed: '2026-08-02' });
  for (const text of [n.full, n.brief]) {
    for (const re of FORBIDDEN_PATTERNS) {
      assert.equal(text.match(re), null, `금지 어휘: ${text.match(re)}`);
    }
    assert.doesNotMatch(text, HANJA, `본문 한자: ${text}`);
  }
});

test('causal: 결정론 — 같은 입력·시드는 동일, 십성 다르면 다르다', () => {
  const a = buildCausalNarrative(FIXTURE, { seed: '2026-08-02' });
  const b = buildCausalNarrative(FIXTURE, { seed: '2026-08-02' });
  assert.equal(a.full, b.full);
  const other = buildCausalNarrative({ ...FIXTURE, iljinTenGod: '식신' }, { seed: '2026-08-02' });
  assert.notEqual(a.full, other.full);
});

test('causal: 폴백 — 관계·세운·신살 없어도 brief/full 비어있지 않음', () => {
  const bare: CausalInput = {
    ...FIXTURE, saewoonTenGod: null, wolwoonTenGod: null, topRelation: null, topSinsal: null,
  };
  const n = buildCausalNarrative(bare, { seed: 'x' });
  assert.ok(n.brief.length > 0 && n.full.length > 0);
});

test('causal: 조사 받침 일치 — 모음 종결 지지/신살에 가/과 적용', () => {
  const vowel: CausalInput = {
    ...FIXTURE,
    todayBranch: '子',
    topRelation: { kind: '삼합', element: '수', natalBranches: ['寅'] },
    topSinsal: { name: '공망살', category: '흉신' },
  };
  const n = buildCausalNarrative(vowel, { seed: 'josa' });
  assert.match(n.full, /자수가/);   // 子=자수(모음) → 가
  assert.match(n.full, /인목과/);   // 寅=인목(받침) → 과
  assert.doesNotMatch(n.full, /자수이|인목와/);
  assert.match(n.full, /자리\)가/); // 공망살(…자리) → 가
});

test('causal: 비-오행 관계(충/육합/형/해/파/원진)도 지지 레이어를 서술한다', () => {
  for (const kind of ['충', '육합', '형', '해', '파', '원진'] as const) {
    const rel: CausalInput = {
      ...FIXTURE,
      todayBranch: '申',
      topRelation: { kind, element: null, natalBranches: ['寅'] },
    };
    const n = buildCausalNarrative(rel, { seed: kind });
    const clauseMark: Record<string, RegExp> = {
      충: /충으로 부딪/, 육합: /육합으로 부드럽게/, 형: /형으로 어긋나/,
      해: /해로 살짝/, 파: /파로 어긋나 깨/, 원진: /원진으로 서로/,
    };
    assert.match(n.full, clauseMark[kind], `${kind} 관계 절 누락/오배치`);
    assert.match(n.full, /인목과/); // 寅=인목, josa 과
    assert.doesNotMatch(n.full, /[㐀-鿿]/, `${kind} 본문 한자`);
    for (const re of FORBIDDEN_PATTERNS) {
      assert.equal(n.full.match(re), null, `${kind} 금지어: ${n.full.match(re)}`);
    }
  }
});

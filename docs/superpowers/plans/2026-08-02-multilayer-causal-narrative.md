# 다층 인과 조립기 (Multi-layer Causal Narrative) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이미 계산된 오늘운세 재료(일진 십성·합충·용신/기신·세운/월운·신살)를 하나의 인과 문단으로 엮는 순수 결정론 조립기를 만들어 무료 `reasonSnippet`과 유료 `오늘 자세히보기`에 연결한다.

**Architecture:** 신규 순수 모듈 `src/lib/today-fortune/causal-narrative.ts`가 구조화 입력(`CausalInput`)을 받아 5슬롯(원인→겹침→다층→신살→조언) 문장을 시드 결정론으로 조립한다. `build-today-fortune.ts`가 기존 `sajuData`/`todayPillar`/신살에서 입력을 파생해 무료(brief)·유료(full)에 주입한다. LLM·DB·부작용 없음.

**Tech Stack:** TypeScript, 기존 유닛 러너(`node scripts/run-unit-tests.mjs`, `*.test.ts` glob), `@/` 별칭.

## Global Constraints

- **어휘 정책 최상위 권위: `docs/claude-specs/02-naming-policy.md`** (충돌 시 이 정책이 정답).
  - 오행은 "X 기운"(목/화/토/금/수 기운). "X의 기운"·"X의 결" 금지.
  - 십성·신살·강약·용신은 **한글 원어 + 첫 등장 시 괄호 설명 1회**(식신(나누고 베푸는 별)).
  - **본문 한자 0** (사주팔자 8글자 카드만 예외 — 이 기능은 본문이므로 한자 금지).
- 설계 스펙: `docs/superpowers/specs/2026-08-02-multilayer-causal-assembler-design.md`.
- **작업 브랜치에서 진행**(main 직접 커밋 금지). PR/머지는 `./scripts/gh-ganji`.
- 커밋 메시지 마지막 줄: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- 테스트 러너는 파일 단독 필터가 없다 → `npm test 2>&1 | grep -iE "causal|인과"` 로 해당 테스트 줄(`ok - ` / `not ok - `)을 확인한다. 타입체크는 `npm run typecheck`.
- 검증 하네스(실측 대조용): `$CLAUDE_JOB_DIR/tmp/run-today.mjs` (1982-01-29 남 진시, now=2026-08-02).

---

## Setup: 작업 브랜치

- [ ] **브랜치 생성**

```bash
git checkout -b feat/today-causal-narrative
```

---

### Task 1: 조립기 모듈 스캐폴드 (타입·유틸·설명 사전·TermInk)

**Files:**
- Create: `src/lib/today-fortune/causal-narrative.ts`
- Test: `src/lib/today-fortune/causal-narrative.test.ts`

**Interfaces:**
- Consumes: `Stem`, `Branch`, `SipSung` from `@/lib/today-fortune/iljin-rules`.
- Produces: `Element`, `hashSeed`, `pickVariant`, `TermInk`, types `JijiRelation`/`CausalSinsal`/`CausalInput`/`CausalNarrative`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/today-fortune/causal-narrative.test.ts
import assert from 'node:assert/strict';
import { hashSeed, pickVariant, TermInk } from '@/lib/today-fortune/causal-narrative';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test 2>&1 | grep -iE "causal|인과"`
Expected: `not ok - causal: ...` (모듈/함수 미정의 에러).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/today-fortune/causal-narrative.ts
import type { Stem, Branch, SipSung } from '@/lib/today-fortune/iljin-rules';

export type Element = '목' | '화' | '토' | '금' | '수';

// ── 결정론 유틸 ──────────────────────────────────────────
export function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pickVariant<T>(items: T[], seed: number, offset = 0): T {
  if (items.length === 0) throw new Error('pickVariant: empty items');
  return items[(seed + offset) % items.length];
}

// ── 설명 사전 (naming-policy §2/§3/§5/§8) ────────────────
export const SIPSUNG_DESC: Record<SipSung, string> = {
  비견: '같이 가는 별', 겁재: '경쟁하며 끌어가는 별',
  식신: '나누고 베푸는 별', 상관: '재능을 드러내는 별',
  편재: '움직이는 돈의 별', 정재: '꾸준한 살림의 별',
  편관: '밀어붙이는 별', 정관: '책임과 규범의 별',
  편인: '혼자 깊이 파고드는 별', 정인: '돌봄과 배움의 별',
};

export const ELEMENT_DESC: Record<Element, string> = {
  목: '자라남·시작', 화: '말·밝게 퍼짐', 토: '담아냄·안정', 금: '단단함·결단', 수: '흐름·깊이',
};

export const STEM_ELEMENT: Record<Stem, Element> = {
  甲: '목', 乙: '목', 丙: '화', 丁: '화', 戊: '토', 己: '토', 庚: '금', 辛: '금', 壬: '수', 癸: '수',
};

// 지지 → 한글(지지+오행). 본문 한자 금지이므로 한글로만 노출.
export const BRANCH_KOR: Record<Branch, string> = {
  子: '자수', 丑: '축토', 寅: '인목', 卯: '묘목', 辰: '진토', 巳: '사화',
  午: '오화', 未: '미토', 申: '신금', 酉: '유금', 戌: '술토', 亥: '해수',
};

const SINSAL_DESC: Record<string, string> = {
  천을귀인: '도움이 오는 별', 문창귀인: '학업·문서의 별', 천덕귀인: '덕을 받는 별',
  월덕귀인: '덕을 받는 별', 금여록: '잔잔한 복의 별', 암록: '숨은 복의 별',
  양인살: '강한 의지의 별', 백호살: '큰 변동의 별', 괴강살: '강단의 별',
  귀문관살: '예민함의 별', 원진살: '어긋남의 별', 겁살: '휘둘리기 쉬운 별',
  공망살: '비어 채워야 할 자리', 망신살: '체면을 조심할 별',
  도화살: '매력과 인기의 별', 역마살: '이동과 변화의 별', 화개살: '학문·예술의 별',
};

const STRENGTH_DESC: Record<string, string> = {
  신강: '본인 기운이 강한 편', 신약: '본인 기운이 다소 약한 편', 중화: '균형 잡힌 상태',
};

// ── 첫 등장 설명 트래커 ──────────────────────────────────
export class TermInk {
  private seen = new Set<string>();
  terms: string[] = [];
  sipsung(name: SipSung): string { return this.mark(name, SIPSUNG_DESC[name]); }
  sinsal(name: string): string { return this.mark(name, SINSAL_DESC[name] ?? '특별한 별'); }
  element(el: Element): string { return this.mark(`${el} 기운`, ELEMENT_DESC[el]); }
  strength(level: string): string {
    const d = STRENGTH_DESC[level];
    return d ? this.mark(level, d) : level;
  }
  private mark(name: string, desc: string): string {
    if (this.seen.has(name)) return name;
    this.seen.add(name);
    this.terms.push(name);
    return `${name}(${desc})`;
  }
}

// ── 타입 ────────────────────────────────────────────────
export interface JijiRelation {
  kind: '삼합' | '방합' | '육합' | '충' | '형' | '해' | '파' | '원진';
  element: Element | null; // 삼합/방합만 결과 오행
  natalBranches: Branch[]; // 오늘 지지와 만난 원국 지지들
}

export interface CausalSinsal {
  name: string;
  category: '길신' | '흉신' | '양날의검';
}

export interface CausalInput {
  dayMaster: Stem;
  todayStem: Stem;
  todayBranch: Branch;
  iljinTenGod: SipSung;
  saewoonTenGod: SipSung | null;
  wolwoonTenGod: SipSung | null;
  topRelation: JijiRelation | null;
  yongsin: Element;
  kishin: Element | null;
  dominantElement: Element;
  weakestElement: Element;
  topSinsal: CausalSinsal | null;
  strengthLevel: '신강' | '신약' | '중화' | null;
}

export interface CausalNarrative {
  full: string;
  brief: string;
  terms: string[];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test 2>&1 | grep -iE "causal|인과"`
Expected: `ok - causal: hashSeed ...`, `ok - causal: TermInk ...`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/today-fortune/causal-narrative.ts src/lib/today-fortune/causal-narrative.test.ts
git commit -m "feat(today): 인과 조립기 스캐폴드(타입·설명사전·TermInk)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 지지 관계 랭킹 (`rankJijiRelations`) + BANGHAP_GROUPS export

**Files:**
- Modify: `src/lib/today-fortune/iljin-rules.ts:86` (const BANGHAP_GROUPS → export)
- Modify: `src/lib/today-fortune/causal-narrative.ts` (rankJijiRelations 추가)
- Test: `src/lib/today-fortune/causal-narrative.test.ts` (추가)

**Interfaces:**
- Consumes: `SAMHAP_GROUPS`, `BANGHAP_GROUPS`, `isSamhap`, `isBanghap`, `isYukhap`, `isBranchChung`, `isBranchHyung`, `isBranchHae`, `isBranchPa`, `isBranchWonjin` from `@/lib/today-fortune/iljin-rules`.
- Produces: `rankJijiRelations(today: Branch, natal: Branch[]): JijiRelation | null`.

- [ ] **Step 1: Write the failing test**

```ts
// causal-narrative.test.ts 에 추가
import { rankJijiRelations } from '@/lib/today-fortune/causal-narrative';

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
  // 午·申 은 삼합/방합/육합/충/형/해/파/원진 8종 모두 무관계
  assert.equal(rankJijiRelations('午', ['申']), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test 2>&1 | grep -iE "rankJiji|삼합"`
Expected: `not ok`(rankJijiRelations 미정의) + BANGHAP_GROUPS import 에러.

- [ ] **Step 3: Write minimal implementation**

먼저 `iljin-rules.ts:86` 의 선언을 export 로 변경:

```ts
// BEFORE: const BANGHAP_GROUPS: Array<{ element: Elem; branches: Branch[] }> = [
export const BANGHAP_GROUPS: Array<{ element: Elem; branches: Branch[] }> = [
```

그다음 `causal-narrative.ts` 에 추가:

```ts
import {
  SAMHAP_GROUPS, BANGHAP_GROUPS,
  isSamhap, isBanghap, isYukhap,
  isBranchChung, isBranchHyung, isBranchHae, isBranchPa, isBranchWonjin,
} from '@/lib/today-fortune/iljin-rules';

const RELATION_RANK: Record<JijiRelation['kind'], number> = {
  삼합: 6, 충: 6, 방합: 4, 육합: 4, 형: 3, 해: 2, 파: 2, 원진: 2,
};

export function rankJijiRelations(today: Branch, natal: Branch[]): JijiRelation | null {
  const found: JijiRelation[] = [];
  const collect = (
    kind: JijiRelation['kind'],
    matcher: (a: string, b: string) => boolean,
    element: Element | null,
  ) => {
    const matches = natal.filter((b) => b !== today && matcher(today, b));
    if (matches.length > 0) found.push({ kind, element, natalBranches: matches });
  };
  const samEl = (SAMHAP_GROUPS.find((g) => g.branches.includes(today))?.element ?? null) as Element | null;
  const bangEl = (BANGHAP_GROUPS.find((g) => g.branches.includes(today))?.element ?? null) as Element | null;
  collect('삼합', isSamhap, samEl);
  collect('방합', isBanghap, bangEl);
  collect('육합', isYukhap, null);
  collect('충', isBranchChung, null);
  collect('형', isBranchHyung, null);
  collect('해', isBranchHae, null);
  collect('파', isBranchPa, null);
  collect('원진', isBranchWonjin, null);
  if (found.length === 0) return null;
  found.sort((a, b) => RELATION_RANK[b.kind] - RELATION_RANK[a.kind]);
  return found[0];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test 2>&1 | grep -iE "rankJiji|삼합"`
Expected: 두 테스트 `ok`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/today-fortune/iljin-rules.ts src/lib/today-fortune/causal-narrative.ts src/lib/today-fortune/causal-narrative.test.ts
git commit -m "feat(today): 지지 관계 랭킹 rankJijiRelations + BANGHAP_GROUPS export

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 5슬롯 조립 (`buildCausalNarrative`)

**Files:**
- Modify: `src/lib/today-fortune/causal-narrative.ts` (슬롯 빌더 + 조립기)
- Test: `src/lib/today-fortune/causal-narrative.test.ts` (추가)

**Interfaces:**
- Consumes: `CausalInput`, `TermInk`, `pickVariant`, `hashSeed`, `STEM_ELEMENT`, `BRANCH_KOR`.
- Produces: `buildCausalNarrative(input: CausalInput, opts?: { seed?: string }): CausalNarrative`.

- [ ] **Step 1: Write the failing test**

```ts
// causal-narrative.test.ts 에 추가
import { buildCausalNarrative, type CausalInput } from '@/lib/today-fortune/causal-narrative';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test 2>&1 | grep -iE "causal:"`
Expected: `buildCausalNarrative` 미정의로 `not ok`.

- [ ] **Step 3: Write minimal implementation**

```ts
// causal-narrative.ts 에 추가 (import 위쪽 유틸/타입 이미 존재)

// 받침(batchim) 인식 조사 헬퍼 — 마지막 한글 음절 기준(괄호 설명 등 뒤 문장부호 무시).
function hasBatchim(word: string): boolean {
  for (let i = word.length - 1; i >= 0; i--) {
    const ch = word.charCodeAt(i);
    if (ch >= 0xac00 && ch <= 0xd7a3) return (ch - 0xac00) % 28 !== 0;
  }
  return false;
}
function josa(word: string, withBatchim: string, withoutBatchim: string): string {
  return `${word}${hasBatchim(word) ? withBatchim : withoutBatchim}`;
}

// 슬롯 1 — 원인(일진 십성)
function slotCause(i: CausalInput, ink: TermInk, seed: number): string {
  const tg = ink.sipsung(i.iljinTenGod);
  const flavor: Record<SipSung, string> = {
    편관: '책임과 압박이 커지는', 정관: '규칙과 책임을 챙기게 되는',
    편재: '기회와 씀씀이가 커지는', 정재: '살림과 실속을 따지는',
    식신: '나눔과 여유가 살아나는', 상관: '재능과 말이 튀는',
    편인: '혼자 파고들고 싶어지는', 정인: '배우고 기대고 싶어지는',
    비견: '내 페이스를 지키게 되는', 겁재: '경쟁심이 올라오는',
  };
  return pickVariant(
    [
      `오늘은 ${tg} 기운이 들어와 ${flavor[i.iljinTenGod]} 날이에요.`,
      `오늘 하루에는 ${tg} 기운이 겹쳐 ${flavor[i.iljinTenGod]} 흐름이 돌아요.`,
    ],
    seed, 0,
  );
}

// 슬롯 2 — 겹침(합충 + 용신/기신)
function slotOverlap(i: CausalInput, ink: TermInk): string {
  const parts: string[] = [];
  if (i.topRelation && i.topRelation.element) {
    const natal = i.topRelation.natalBranches.map((b) => BRANCH_KOR[b]).join('·');
    parts.push(
      `오늘 ${josa(BRANCH_KOR[i.todayBranch], '이', '가')} 사주의 ${josa(natal, '과', '와')} 만나 ${ink.element(i.topRelation.element)}으로 ${josa(i.topRelation.kind, '을', '를')} 이루는데,`,
    );
  }
  const focusEl = i.topRelation?.element ?? STEM_ELEMENT[i.todayStem];
  const dir =
    focusEl === i.yongsin
      ? `모자란 ${ink.element(i.yongsin)}을 채워 주는 반가운 흐름이에요.`
      : focusEl === i.dominantElement || (i.kishin != null && focusEl === i.kishin)
        ? `원래 강한 ${ink.element(i.dominantElement)}을 더 키워 흐름이 무거워질 수 있어요.`
        : `기운이 한쪽으로 쏠리기 쉬우니 균형을 챙기는 게 좋아요.`;
  parts.push(dir);
  return parts.join(' ');
}

// 슬롯 3 — 다층(세운/월운)
function slotLayers(i: CausalInput, ink: TermInk, seed: number): string | null {
  const layers: string[] = [];
  if (i.saewoonTenGod) layers.push(`올해 흐름은 ${ink.sipsung(i.saewoonTenGod)}`);
  if (i.wolwoonTenGod) layers.push(`이번 달은 ${ink.sipsung(i.wolwoonTenGod)}`);
  if (layers.length === 0) return null;
  return pickVariant(
    [
      `여기에 ${layers.join(', ')}이라, 여러 흐름이 겹쳐 마음이 복잡해지기 쉬워요.`,
      `${layers.join(', ')}까지 맞물려, 하루가 조금 더 묵직하게 느껴질 수 있어요.`,
    ],
    seed, 1,
  );
}

// 슬롯 4 — 신살 색채
function slotSinsal(i: CausalInput, ink: TermInk): string | null {
  if (!i.topSinsal) return null;
  const s = ink.sinsal(i.topSinsal.name);
  return i.topSinsal.category === '길신'
    ? `${josa(s, '이', '가')} 함께라 내미는 도움을 잘 잡으면 하루가 한결 수월해요.`
    : `${josa(s, '이', '가')} 함께라 예민해지거나 서두르기 쉬우니 한 박자 쉬어 가세요.`;
}

// 슬롯 5 — 조언(용신 + 십성 대응)
function slotAdvice(i: CausalInput, ink: TermInk, seed: number): string {
  const yong = ink.element(i.yongsin);
  const perTenGod: Record<SipSung, string> = {
    편관: '큰 결정보다 정리와 기록으로', 정관: '원칙을 먼저 정하고',
    편재: '벌이기보다 나갈 것부터 챙기고', 정재: '실속을 확인하며',
    식신: '가볍게 나누고 베풀며', 상관: '한 박자 눌러 담아 말하고',
    편인: '혼자 정리하는 시간을 두고', 정인: '기대고 배우는 쪽으로',
    비견: '내 페이스를 지키며', 겁재: '경쟁보다 협력으로',
  };
  return pickVariant(
    [
      `그래서 오늘은 ${yong}을 채우듯, ${perTenGod[i.iljinTenGod]} 천천히 가면 좋아요.`,
      `오늘은 ${perTenGod[i.iljinTenGod]}, ${yong}을 곁들이면 흐름이 한결 부드러워져요.`,
    ],
    seed, 2,
  );
}

export function buildCausalNarrative(
  input: CausalInput,
  opts: { seed?: string } = {},
): CausalNarrative {
  const seed = hashSeed(opts.seed ?? `${input.dayMaster}${input.todayStem}${input.todayBranch}`);

  const briefInk = new TermInk();
  const brief = [slotCause(input, briefInk, seed), slotAdvice(input, briefInk, seed)]
    .filter((s): s is string => Boolean(s))
    .join(' ');

  const fullInk = new TermInk();
  const full = [
    slotCause(input, fullInk, seed),
    slotOverlap(input, fullInk),
    slotLayers(input, fullInk, seed),
    slotSinsal(input, fullInk),
    slotAdvice(input, fullInk, seed),
  ]
    .filter((s): s is string => Boolean(s))
    .join(' ');

  return { full, brief, terms: fullInk.terms };
}
```

> 참고: `SipSung` import 는 Task 1 의 `import type { ... SipSung }` 에 이미 포함. 없으면 추가.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test 2>&1 | grep -iE "causal:"`
Expected: 5개 신규 테스트 `ok`. 이어서 `npm run typecheck` → 에러 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/today-fortune/causal-narrative.ts src/lib/today-fortune/causal-narrative.test.ts
git commit -m "feat(today): 5슬롯 인과 조립기 buildCausalNarrative(brief/full)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 입력 파생 헬퍼 (`detectTodaySinsals`, `buildCausalInput`)

**Files:**
- Modify: `src/server/today-fortune/build-today-fortune.ts` (헬퍼 2종 추가; import 추가)
- Test: `src/server/today-fortune/causal-input.test.ts` (신규)

**Interfaces:**
- Consumes: `calculateSipsung`, `deriveLuckyElements`, `getTodayPillarSnapshot`, `detectComprehensiveSinsals`, `applyActiveSinsalWeights`, `computeDayGanziIndex`, `rankJijiRelations`, `SinsalHit`, `CausalInput`.
- Produces:
  - `detectTodaySinsals(sajuData, todayStem, todayBranch, currentYearBranch?): SinsalHit[]`
  - `buildCausalInput(sajuData, todayPillar, detectedSinsals): CausalInput | null`

- [ ] **Step 1: Write the failing test**

```ts
// src/server/today-fortune/causal-input.test.ts
import assert from 'node:assert/strict';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { getTodayPillarSnapshot } from '@/server/today-fortune/build-today-fortune';
import { detectTodaySinsals, buildCausalInput } from '@/server/today-fortune/build-today-fortune';
import type { BirthInput } from '@/lib/saju/types';

declare const test: (name: string, fn: () => void) => void;

const birth: BirthInput = { year: 1982, month: 1, day: 29, hour: 8, minute: 0, gender: 'male' };

test('causal-input: 1982-01-29 남 진시 → 편관·삼합수·용신화 파생', () => {
  const data = calculateSajuDataV1(birth);
  const todayPillar = getTodayPillarSnapshot(data, { now: new Date('2026-08-02T03:00:00Z') });
  const sinsals = detectTodaySinsals(data, todayPillar.stem, todayPillar.branch);
  const input = buildCausalInput(data, todayPillar, sinsals);
  assert.ok(input, 'CausalInput null');
  assert.equal(input!.dayMaster, '壬');
  assert.equal(input!.iljinTenGod, '편관'); // 壬 대비 오늘 천간 戊
  assert.equal(input!.yongsin, '화');
  assert.ok(input!.topRelation && input!.topRelation.element === '수'); // 申子辰 삼합
});

test('causal-input: 시간 미입력(일진 없음) → null', () => {
  const noTime: BirthInput = { year: 1982, month: 1, day: 29, gender: 'male', unknownTime: true };
  const data = calculateSajuDataV1(noTime);
  const input = buildCausalInput(data, { stem: null, branch: null } as never, []);
  assert.equal(input, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test 2>&1 | grep -iE "causal-input"`
Expected: `detectTodaySinsals`/`buildCausalInput` 미export → `not ok`.

- [ ] **Step 3: Write minimal implementation**

`build-today-fortune.ts` 상단 import 에 조립기 심볼 추가(`buildCausalInput`/`detectTodaySinsals` 는 이 파일에서 정의하므로 import 하지 않는다):

```ts
import {
  buildCausalNarrative,
  rankJijiRelations,
  type CausalInput,
} from '@/lib/today-fortune/causal-narrative';
import type { Stem, Branch } from '@/lib/today-fortune/iljin-rules';
```

그다음 파일 하단(다른 export 함수 인근, 예: `buildSajuOriginForIljin` 근처 :2887)에 추가:

```ts
// 오늘 일진 기준 신살 탐지 (free 의 buildSajuChartSnapshot 블록과 동일 로직을 재사용 가능하게 추출).
export function detectTodaySinsals(
  sajuData: SajuDataV1 | SajuDataV2,
  todayStem: string | null,
  todayBranch: string | null,
  currentYearBranch?: string,
): SinsalHit[] {
  // ⚠️ 오늘 천간/지지가 없어도(예: getTodayPillarSnapshot 실패 시 '' 반환) 조기 return 하지 않는다.
  //   원 인라인 블록(buildSajuChartSnapshot)은 iljin=undefined 로 detectComprehensiveSinsals 를
  //   호출해 원국(년/월/일/시) 신살을 여전히 탐지한다. 조기 return [] 이면 Task 5 DRY 교체 후
  //   시간미입력 사용자의 원국 신살이 사라지는 회귀. iljin 옵션만 조건부로 둔다.
  try {
    const dayGanziIndex = computeDayGanziIndex(
      sajuData.pillars.day.stem,
      sajuData.pillars.day.branch,
    );
    const rawHits = detectComprehensiveSinsals(
      {
        dayMaster: sajuData.pillars.day.stem as IljinStem,
        yearBranch: sajuData.pillars.year.branch as IljinBranch,
        monthBranch: sajuData.pillars.month.branch as IljinBranch,
        dayBranch: sajuData.pillars.day.branch as IljinBranch,
        hourBranch: (sajuData.pillars.hour?.branch ?? null) as IljinBranch | null,
        dayGanziIndex,
      },
      {
        iljin:
          todayStem && todayBranch
            ? { stem: todayStem as IljinStem, branch: todayBranch as IljinBranch }
            : undefined,
        currentYearBranch: currentYearBranch as IljinBranch | undefined,
      },
    );
    return applyActiveSinsalWeights(rawHits);
  } catch {
    return [];
  }
}

function pickTopSinsal(hits: SinsalHit[]): SinsalHit | null {
  if (hits.length === 0) return null;
  return [...hits].sort((a, b) => {
    const ai = a.positions.includes('iljin') ? 1 : 0;
    const bi = b.positions.includes('iljin') ? 1 : 0;
    if (ai !== bi) return bi - ai; // 오늘과 상호작용하는 신살 우선
    return Math.abs(b.scoreHint) - Math.abs(a.scoreHint);
  })[0];
}

export function buildCausalInput(
  sajuData: SajuDataV1 | SajuDataV2,
  todayPillar: { stem: string | null; branch: string | null },
  detectedSinsals: SinsalHit[],
): CausalInput | null {
  if (!todayPillar.stem || !todayPillar.branch) return null;
  const dayMaster = sajuData.pillars.day.stem as Stem;
  const todayStem = todayPillar.stem as Stem;
  const todayBranch = todayPillar.branch as Branch;
  const { lucky, unlucky } = deriveLuckyElements(sajuData);
  const natal = [
    sajuData.pillars.year.branch,
    sajuData.pillars.month.branch,
    sajuData.pillars.day.branch,
    sajuData.pillars.hour?.branch,
  ].filter(Boolean) as Branch[];
  const cl = sajuData.currentLuck;
  const tenGodOf = (ganzi?: string | null) =>
    ganzi ? calculateSipsung(dayMaster, ganzi[0] as Stem) : null;
  const top = pickTopSinsal(detectedSinsals);
  return {
    dayMaster,
    todayStem,
    todayBranch,
    iljinTenGod: calculateSipsung(dayMaster, todayStem),
    saewoonTenGod: tenGodOf(cl?.saewoon?.ganzi),
    wolwoonTenGod: tenGodOf(cl?.wolwoon?.ganzi),
    topRelation: rankJijiRelations(todayBranch, natal),
    yongsin: lucky,
    kishin: unlucky,
    dominantElement: sajuData.fiveElements.dominant as CausalInput['dominantElement'],
    weakestElement: sajuData.fiveElements.weakest as CausalInput['weakestElement'],
    topSinsal: top ? { name: top.name, category: top.category } : null,
    strengthLevel: (sajuData.strength?.level as CausalInput['strengthLevel']) ?? null,
  };
}
```

> 확인: `calculateSipsung`, `SinsalHit`, `computeDayGanziIndex`, `applyActiveSinsalWeights`, `detectComprehensiveSinsals`, `IljinStem`, `IljinBranch` 가 이미 이 파일에서 import/사용 중이다(buildSajuChartSnapshot 블록 :2667 참고). 누락 시 해당 import 추가.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test 2>&1 | grep -iE "causal-input"` → 2개 `ok`.
Run: `npm run typecheck` → 에러 0.

- [ ] **Step 5: Commit**

```bash
git add src/server/today-fortune/build-today-fortune.ts src/server/today-fortune/causal-input.test.ts
git commit -m "feat(today): CausalInput 파생 헬퍼(detectTodaySinsals·buildCausalInput)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: 무료/유료 배선 + 타입 필드 + 회귀

**Files:**
- Modify: `src/lib/today-fortune/types.ts:216` (TodayFortunePremiumResult 에 causalNarrative 추가)
- Modify: `src/server/today-fortune/build-today-fortune.ts` (무료 reasonBody 교체 :2763, 유료 반환 필드 :2968, buildSajuChartSnapshot IIFE → detectTodaySinsals 로 DRY)
- Test: `src/server/today-fortune/causal-wiring.test.ts` (신규) + 기존 today-fortune 테스트 회귀

**Interfaces:**
- Consumes: `buildCausalInput`, `buildCausalNarrative`, `detectTodaySinsals`.
- Produces: `TodayFortuneFreeResult.reasonSnippet.body`(명리 근거 포함), `TodayFortunePremiumResult.causalNarrative`.

- [ ] **Step 1: Write the failing test**

```ts
// src/server/today-fortune/causal-wiring.test.ts
import assert from 'node:assert/strict';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import {
  buildTodayFortuneFreeResult,
  buildTodayFortunePremiumResult,
} from '@/server/today-fortune/build-today-fortune';
import type { BirthInput } from '@/lib/saju/types';

declare const test: (name: string, fn: () => void) => void;

const birth: BirthInput = { year: 1982, month: 1, day: 29, hour: 8, minute: 0, gender: 'male' };
const now = new Date('2026-08-02T03:00:00Z');

test('wiring: 무료 reasonSnippet.body 에 실제 사주 근거(십성/오행)가 들어간다', () => {
  const data = calculateSajuDataV1(birth);
  const free = buildTodayFortuneFreeResult(birth, data, {
    concernId: 'general', sourceSessionId: 't', calendarType: 'solar', timeRule: 'standard', now,
  });
  assert.match(free.reasonSnippet.body, /편관|화 기운/);
});

test('wiring: 유료 causalNarrative 가 full 인과 문단을 담는다', () => {
  const data = calculateSajuDataV1(birth);
  const premium = buildTodayFortunePremiumResult(birth, data, 'general', null, null, { now });
  assert.ok(premium.causalNarrative, 'causalNarrative null');
  assert.match(premium.causalNarrative!.body, /편관\(밀어붙이는 별\)/);
  assert.match(premium.causalNarrative!.body, /삼합/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test 2>&1 | grep -iE "wiring:"`
Expected: `causalNarrative` 미존재 + reasonSnippet 에 명리어 없음 → `not ok`.

- [ ] **Step 3: Write minimal implementation**

(3a) `types.ts` TodayFortunePremiumResult 에 필드 추가 (:216 인터페이스 내부, 예: `todayIljinReading` 인근):

```ts
  causalNarrative: { title: string; body: string } | null;
```

(3b) 무료 배선 — `build-today-fortune.ts` :2763 `const reasonBody = buildPublicReasonBody(...)` 를 아래로 교체:

```ts
  const causalDetectedSinsals = detectTodaySinsals(sajuData, todayPillar.stem, todayPillar.branch);
  const causalInput = buildCausalInput(sajuData, todayPillar, causalDetectedSinsals);
  const causal = causalInput
    ? buildCausalNarrative(causalInput, { seed: todayPillar.dateKey })
    : null;
  const reasonBody = causal?.brief || buildPublicReasonBody(profile, Boolean(input.unknownTime));
```

(3c) 유료 배선 — `buildTodayFortunePremiumResult` 반환 객체(:2968~)에 필드 추가. `todayPillar` 는 :2952 에 이미 있음:

```ts
    causalNarrative: (() => {
      const sinsals = detectTodaySinsals(sajuData, todayPillar.stem, todayPillar.branch);
      const ci = buildCausalInput(sajuData, todayPillar, sinsals);
      if (!ci) return null;
      const c = buildCausalNarrative(ci, { seed: `premium::${todayPillar.dateKey}` });
      return { title: '오늘 이 흐름인 이유', body: c.full };
    })(),
```

(3d) DRY — `buildSajuChartSnapshot` 의 detectedSinsals IIFE(:2667~2703) 를 헬퍼 호출로 단순화(출력 동일 유지):

```ts
    detectedSinsals: detectTodaySinsals(sajuData, todayStem, todayBranch, currentYearBranch),
```

> `detectTodaySinsals` 는 SinsalHit[] 를 그대로 반환하고, 기존 IIFE 도 동일 필드(name/category/positions/scoreHint/hint)를 반환했다 → 타입·값 동일.

(3e) legacy 카피 가드 대응 — 무료 `reasonSnippet.body` 가 이제 causal.brief 이므로, `build-today-fortune.test.ts` 의 "today fortune free visible copy avoids legacy word choices" 테스트(`visibleFreeResultText` 가 reasonSnippet.body 를 포함, `/표현|기준/` 금지)가 **식신 일진일 때 red** 가 된다(식신 flavor/advice 에 "표현" 포함; 실측: 1996-06-01 샘플이 2026-05-27 에 식신). Task 3 에서 커밋된 `src/lib/today-fortune/causal-narrative.ts` 의 식신 두 문자열을 교체(정책 준수, 식신=나누고 베푸는 별 의미 유지):

```ts
// slotCause flavor
식신: '나눔과 여유가 살아나는',   // was '표현과 여유가 살아나는'
// slotAdvice perTenGod
식신: '가볍게 나누고 베풀며',      // was '가볍게 표현하고 나누며'
```
(라인 80 헬퍼 주석의 "기준"은 코드 주석이라 출력에 안 나가므로 무관. 다른 템플릿엔 표현/기준 없음.)

- [ ] **Step 4: Run tests + 회귀 확인**

```bash
npm test 2>&1 | grep -iE "wiring:"            # 2개 ok
npm test 2>&1 | grep -c "^not ok"              # 0 이어야 (전체 회귀)
npm run typecheck                              # 에러 0
```
- `daily-variety-guard.test.ts`·`today-detail-daily-variation.test.ts`·`build-today-fortune.test.ts` 가 red 면, reasonSnippet 문구 단언을 새 인과 문장에 맞게 갱신(레거시 문구 grep). 점수·구조 단언은 불변이어야 한다.
- DRY 변경 검증: 하네스로 detectedSinsals 동일 확인 —
  `node $CLAUDE_JOB_DIR/tmp/run-today.mjs && node -e "console.log(require('$CLAUDE_JOB_DIR/tmp/out-1982.json').free.sajuChart.detectedSinsals.map(s=>s.name).join(','))"`
  → 이전과 동일한 신살 목록(금여록,양인살,귀문관살,망신살,도화살,화개살).

- [ ] **Step 5: Commit**

```bash
git add src/lib/today-fortune/types.ts src/server/today-fortune/build-today-fortune.ts src/server/today-fortune/causal-wiring.test.ts
git commit -m "feat(today): 인과 조립기 무료 reasonSnippet·유료 causalNarrative 배선

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: 유료 UI 카드

**Files:**
- Modify: `src/features/today-fortune/today-fortune-detail-client.tsx` (causalNarrative 카드 1개)

**Interfaces:**
- Consumes: `result.causalNarrative: { title; body } | null`.
- Produces: (UI) null 이면 미렌더.

- [ ] **Step 1: causalNarrative 렌더 위치 파악**

Run: `grep -n "groundingSummary\|evidenceLines\|reasonSnippet\|className" src/features/today-fortune/today-fortune-detail-client.tsx | head -30`
Expected: 근거/요약 섹션 렌더 지점을 찾는다(예: groundingSummary 카드 위/아래).

- [ ] **Step 2: 카드 추가 (null 가드)**

groundingSummary/evidenceLines 렌더 인근에, 기존 카드 마크업 패턴을 그대로 따라 추가:

```tsx
{result.causalNarrative ? (
  <section className="today-detail-card">
    <h3 className="today-detail-card__title">{result.causalNarrative.title}</h3>
    <p className="today-detail-card__body">{result.causalNarrative.body}</p>
  </section>
) : null}
```

> className 은 해당 파일의 기존 카드 클래스에 맞춘다(위 Step 1 grep 결과 기준). 새 스타일을 만들지 말고 기존 카드 컴포넌트/클래스를 재사용.

- [ ] **Step 3: 타입체크 + 렌더 확인**

```bash
npm run typecheck   # 에러 0
```
- 렌더 확인: `verify` 스킬 또는 dev 서버로 유료 오늘 자세히보기 화면에 "오늘 이 흐름인 이유" 카드가 뜨는지, 문장이 자연스러운지(비문·명리어 노출 정책 준수) 육안 확인. 실제 조립 문장은 하네스 `out-1982.json` 의 `premium.causalNarrative.body` 와 대조.

- [ ] **Step 4: Commit**

```bash
git add src/features/today-fortune/today-fortune-detail-client.tsx
git commit -m "feat(today): 오늘 자세히보기 '이 흐름인 이유' 인과 카드

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (계획 검수)

**Spec coverage:**
- §2 모듈 경계 → Task 1·3. §3 출력계약(full/brief/terms) → Task 3. §4 입력계약 → Task 4. §4.1 지지랭킹 → Task 2. §5 5슬롯 → Task 3. §6 폴백 → Task 3(폴백 테스트)·Task 4(null). §7 플러그인(무료/유료/UI) → Task 5·6. §8 어휘가드·테스트 → Task 3(정규식·한자)·Task 5(회귀). §9 파일요약 → 전 Task. ✅ 갭 없음.

**Placeholder scan:** "TBD/TODO/적절히" 없음. 모든 코드 스텝에 실제 코드. Task 4 import 는 `buildCausalNarrative, rankJijiRelations, type CausalInput` + `Stem, Branch` 만(파일 내 정의 심볼은 import 안 함).

**Type consistency:** `CausalInput`/`CausalNarrative`/`JijiRelation`/`CausalSinsal` 필드명이 Task 1 정의와 Task 3·4 사용에서 일치. `buildCausalNarrative(input, {seed})`·`rankJijiRelations(today, natal[])`·`buildCausalInput(sajuData, todayPillar, SinsalHit[])`·`detectTodaySinsals(sajuData, stem, branch, currentYearBranch?)` 시그니처가 전 Task 동일. `dominantElement`/`weakestElement`(fiveElements.dominant/weakest 매핑) 일치.

**주의(실행 시):** `currentLuck`(세운/월운)은 `metadata.calculatedAt` 기반이라 주입 `now` 와 별개다. Task 5 wiring 테스트에서 `saewoonTenGod`/`wolwoonTenGod` 의 구체값은 단언하지 않는다(프로덕션 real-now 에서만 일진과 정합). full 문단에 "올해 흐름/이번 달" 존재 여부만 확인.

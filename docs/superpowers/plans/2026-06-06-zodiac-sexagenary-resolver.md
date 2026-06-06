# 띠운세 60갑자 확대 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. TDD, checkbox steps.

**Goal:** 어떤 출생연도든 연주 간지로 기존 5개 연생 해석에 매핑하고, 칩을 세대별로 확장한다(콘텐츠 불변).

**Architecture:** 순수 유틸 `yearToGanji`(연도→간지 한자)를 추가하고, zodiac 상세 페이지의 연생 resolver를 "정확 연도 키" → "간지 매칭"으로 리팩터. 칩 목록을 5개 고정 → 범위 내 세대 자동 생성.

**Tech Stack:** TypeScript, Next.js App Router. 테스트 = `node:assert/strict` + 전역 `test()` (`npm test`).

**Spec:** `docs/superpowers/specs/2026-06-06-zodiac-sexagenary-resolver-design.md`

---

## Task 1: yearToGanji 유틸 (TDD)

**Files:** Create `src/lib/saju/year-ganji.ts`, `src/lib/saju/year-ganji.test.ts`

- [ ] **Step 1: 실패 테스트**
```ts
import assert from 'node:assert/strict';
import { yearToGanji } from './year-ganji';

declare const test: (name: string, fn: () => Promise<void> | void) => void;

test('yearToGanji computes year-pillar ganji (기준 서기4년=甲子)', () => {
  assert.equal(yearToGanji(2005), '乙酉');
  assert.equal(yearToGanji(1969), '己酉');
  assert.equal(yearToGanji(1957), '丁酉');
  assert.equal(yearToGanji(1981), '辛酉');
  assert.equal(yearToGanji(1993), '癸酉');
  assert.equal(yearToGanji(1900), '庚子');
  assert.equal(yearToGanji(1984), '甲子');
});
```

- [ ] **Step 2: 실패 확인** — `npm test` → module/export 없음으로 FAIL.

- [ ] **Step 3: 구현** `src/lib/saju/year-ganji.ts`:
```ts
// 연도 → 연주 간지(한자). 서기 4년 = 甲子 기준.
//   stemIndex = (year - 4) mod 10, branchIndex = (year - 4) mod 12.
// pillars.ts 의 STEMS/BRANCHES 와 동일 순서(순수 함수, 엔진 비의존).
const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export function yearToGanji(year: number): string {
  const stem = STEMS[mod(year - 4, 10)];
  const branch = BRANCHES[mod(year - 4, 12)];
  return `${stem}${branch}`;
}
```

- [ ] **Step 4: 통과 확인** — `npm test` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/saju/year-ganji.ts src/lib/saju/year-ganji.test.ts
git commit -m "feat(zodiac): 연도→연주 간지 유틸 추가"
```

---

## Task 2: resolver + 칩 세대 확장 + 배선

**Files:** Modify `src/app/zodiac/[slug]/page.tsx`

- [ ] **Step 1: import 추가** — 파일 상단 import 영역에:
```ts
import { yearToGanji } from '@/lib/saju/year-ganji';
```

- [ ] **Step 2: `resolveSelectedYear` 교체** — 기존 함수(`function resolveSelectedYear(...) { ... }`)를 삭제하고 아래로 대체:
```ts
// 2026-06-06 — 60갑자 확대: 정확 연도 키가 아니어도 연주 간지가 일치하면 같은 세대 풀이로 매핑.
function resolveByYear(
  item: ZodiacFortune,
  raw: string | undefined
): { year: number; fortune: ZodiacByYearFortune } | null {
  if (!item.byYear || !raw) return null;
  const year = Number(raw);
  if (!Number.isInteger(year)) return null;

  const exact = item.byYear[year];
  if (exact) return { year, fortune: exact };

  const ganji = yearToGanji(year);
  const matched = Object.values(item.byYear).find((f) => f.ganji === ganji);
  return matched ? { year, fortune: matched } : null;
}
```

- [ ] **Step 3: `getByYearEntries` 교체** — 기존 함수를 삭제하고 세대 생성 함수로 대체:
```ts
// 2026-06-06 — 칩 목록: byYear 5개 간지 각각의, 표시 범위 내 모든 연도(세대)를 생성.
const ZODIAC_YEAR_RANGE = { min: 1930, max: 2026 } as const;

function getGenerationYears(item: ZodiacFortune): number[] {
  if (!item.byYear) return [];
  const ganjiSet = new Set(Object.values(item.byYear).map((f) => f.ganji));
  const years: number[] = [];
  for (let y = ZODIAC_YEAR_RANGE.max; y >= ZODIAC_YEAR_RANGE.min; y -= 1) {
    if (ganjiSet.has(yearToGanji(y))) years.push(y);
  }
  return years; // 내림차순
}
```

- [ ] **Step 4: 사용처 배선** — `ZodiacDetailPage` 본문(현재 `:205~207`):
```ts
  const generationYears = getGenerationYears(item);
  const resolved = resolveByYear(item, rawBirthYear);
  const selectedYear = resolved?.year ?? null;
  const selectedByYear = resolved?.fortune ?? null;
```
(기존 `byYearEntries`/`resolveSelectedYear`/`item.byYear?.[selectedYear]` 3줄을 위로 대체.)

- [ ] **Step 5: 칩 렌더 배선** — `:477` `{byYearEntries.length > 0 ? (` → `{generationYears.length > 0 ? (`,
  그리고 `:483` `{byYearEntries.map(([year]) => {` → `{generationYears.map((year) => {`.
  (이후 `year` 단일 변수 사용 — 기존 `[year]` 구조분해 제거.) 나머지 href/active/period 로직 동일.

- [ ] **Step 6: 검증**
  - `npx tsc --noEmit -p tsconfig.json 2>&1 | head -20` → 신규 에러 0(미사용 심볼·구조분해 잔재 없을 것).
  - `npm test` → 기존 전체 PASS(콘텐츠 테스트 불변).

- [ ] **Step 7: Commit**
```bash
git add src/app/zodiac/[slug]/page.tsx
git commit -m "feat(zodiac): 연생 풀이를 간지 기반으로 — 전 세대 출생연도 매핑 + 칩 세대 확장"
```

---

## Task 3: resolver 동작 회귀 테스트 + 렌더 스모크 + PR

- [ ] **Step 1: resolver 단위 회귀** — 페이지 함수는 비export이므로, 동작을 보장하는 순수 회귀를
  `src/lib/saju/year-ganji.test.ts`에 보강(간지 매핑 동치성):
```ts
test('same-branch different-generation years share ganji (60갑자 동치)', () => {
  // 닭띠 酉: 1945·2005·2065 는 모두 乙酉 → 같은 세대 풀이로 매핑되어야 함.
  assert.equal(yearToGanji(1945), yearToGanji(2005));
  assert.equal(yearToGanji(1945), '乙酉');
  // 다른 지지(2004 갑신)는 酉가 아님 → 닭띠 byYear와 불일치(자가검증).
  assert.notEqual(yearToGanji(2004).slice(-1), '酉');
});
```
  `npm test` → PASS.

- [ ] **Step 2: 렌더 스모크** — 로컬 프로덕션 빌드 라우트 확인은 CI Playwright가 커버. 로컬에선
  `npm test && npx tsc --noEmit` 그린이면 충분(페이지는 서버 컴포넌트, 데이터 매핑이 본질).

- [ ] **Step 3: Commit & PR**
```bash
git add src/lib/saju/year-ganji.test.ts
git commit -m "test(zodiac): 60갑자 간지 동치 매핑 회귀"
git push -u origin feat/zodiac-sexagenary-resolver
gh pr create --base main \
  --title "feat(zodiac): 띠운세 60갑자 확대 — 전 세대 출생연도 간지 매핑" \
  --body "spec/plan: docs/superpowers/specs|plans/2026-06-06-zodiac-sexagenary-resolver*

- yearToGanji 유틸(연도→연주 간지, 서기4년=甲子)
- 연생 resolver를 정확 연도 키 → 간지 매칭으로 리팩터 → 5개 고정 연도 밖(예: 1945년생 닭띠)도 같은 간지 풀이로 매핑
- 칩을 5개 고정 → 범위(1930~2026) 내 세대 자동 생성
- 콘텐츠(12지×5 = 60갑자 해석) 불변, 로직만

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Self-Review
- §3.1 yearToGanji→Task1 ✓; §3.2 resolveByYear→Task2 Step2 ✓; §3.3 getGenerationYears→Task2 Step3 ✓; §3.4 배선→Task2 Step4-5 ✓; §5 테스트→Task1/Task3 ✓.
- placeholder 없음(전 코드 구체). 타입 일관: `resolveByYear` 반환 {year,fortune} ↔ 배선 사용 일치; `getGenerationYears` number[] ↔ 칩 map `(year)` 일치.
- 주의: Task2 Step5에서 기존 `[year]` 구조분해를 단일 `year`로 바꿔야 tsc 통과(미사용/구조 불일치 방지).

# 꿈해몽 검색 정확도 (초성/자모) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 초성 검색 + 자모 부분매치를 추가해 기존 306 꿈 사전 엔트리의 검색 적중률을 높인다.

**Architecture:** 새 순수 유틸 `hangul-search.ts`(한글 음절 유니코드 분해)로 `toChosung`/`toJamo`/`isChosungOnly` 제공. `searchDream`의 매치 파이프라인에 초성·자모 단계 2개를 substring 부분매치와 related 사이에 삽입.

**Tech Stack:** TypeScript. 테스트 = `node:assert/strict` + 전역 `test()` (`npm test` = `node scripts/run-unit-tests.mjs`, `*.test.ts` 재귀 디스커버리).

**Spec:** `docs/superpowers/specs/2026-06-06-dream-search-accuracy-design.md`

---

## File Structure

| 파일 | 책임 |
|---|---|
| `src/lib/dream/hangul-search.ts` | 신규 — 한글 초성/자모 분해 순수 함수 |
| `src/lib/dream/hangul-search.test.ts` | 신규 — 유틸 단위 테스트 |
| `src/lib/dream-dictionary.ts` | `searchDream`에 초성·자모 단계 삽입 + import |
| `src/lib/dream-dictionary.test.ts` | 검색 통합/회귀 테스트 추가 |

---

## Task 1: hangul-search 유틸 (TDD)

**Files:**
- Create: `src/lib/dream/hangul-search.ts`
- Test: `src/lib/dream/hangul-search.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`src/lib/dream/hangul-search.test.ts`:
```ts
import assert from 'node:assert/strict';
import { toChosung, toJamo, isChosungOnly } from './hangul-search';

declare const test: (name: string, fn: () => Promise<void> | void) => void;

test('toChosung extracts leading consonants', () => {
  assert.equal(toChosung('뱀'), 'ㅂ');
  assert.equal(toChosung('돈가방'), 'ㄷㄱㅂ');
  assert.equal(toChosung('이빨'), 'ㅇㅃ');
  assert.equal(toChosung('a1 가'), 'a1 ㄱ'); // 비한글 원문 유지
});

test('toJamo decomposes syllables into jamo', () => {
  assert.equal(toJamo('가'), 'ㄱㅏ');
  assert.equal(toJamo('뱀'), 'ㅂㅐㅁ');
  assert.equal(toJamo('값'), 'ㄱㅏㅄ'); // 겹받침은 종성표 단일 글자 'ㅄ'
  assert.equal(toJamo('ab'), 'ab'); // 비한글 원문 유지
});

test('isChosungOnly detects chosung-only strings', () => {
  assert.equal(isChosungOnly('ㅂ'), true);
  assert.equal(isChosungOnly('ㄷㄱ'), true);
  assert.equal(isChosungOnly('뱀'), false);
  assert.equal(isChosungOnly(''), false);
  assert.equal(isChosungOnly('ㅏ'), false); // 중성 자모는 초성 아님
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module './hangul-search'` 또는 export 미정의.

- [ ] **Step 3: 구현**

`src/lib/dream/hangul-search.ts`:
```ts
// 한글 음절 분해 유틸 — 꿈 사전 검색의 초성/자모 매칭용.
// 유니코드 한글 음절: 0xAC00(가) ~ 0xD7A3(힣). code = 초성*588 + 중성*28 + 종성.

const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;

const CHOSUNG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const;

const JUNGSEONG = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
  'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
] as const;

// 종성: 0번은 받침 없음(빈 문자열).
const JONGSEONG = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ',
  'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const;

const CHOSUNG_SET = new Set<string>(CHOSUNG);

function isHangulSyllable(code: number): boolean {
  return code >= HANGUL_BASE && code <= HANGUL_LAST;
}

export function toChosung(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (isHangulSyllable(code)) {
      out += CHOSUNG[Math.floor((code - HANGUL_BASE) / 588)];
    } else {
      out += ch;
    }
  }
  return out;
}

export function toJamo(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (isHangulSyllable(code)) {
      const offset = code - HANGUL_BASE;
      out += CHOSUNG[Math.floor(offset / 588)];
      out += JUNGSEONG[Math.floor((offset % 588) / 28)];
      out += JONGSEONG[offset % 28]; // 종성 없으면 '' 라 안전
    } else {
      out += ch;
    }
  }
  return out;
}

export function isChosungOnly(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  for (const ch of trimmed) {
    if (!CHOSUNG_SET.has(ch)) return false;
  }
  return true;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test`
Expected: PASS (3 신규 테스트 + 기존 전부).

- [ ] **Step 5: 커밋**
```bash
git add src/lib/dream/hangul-search.ts src/lib/dream/hangul-search.test.ts
git commit -m "feat(dream): 한글 초성/자모 분해 유틸 추가"
```

---

## Task 2: searchDream 초성·자모 단계 삽입 (TDD)

**Files:**
- Modify: `src/lib/dream-dictionary.ts` (import 추가 + `searchDream` 본문)
- Test: `src/lib/dream-dictionary.test.ts` (append)

- [ ] **Step 1: 실패 테스트 작성**

`src/lib/dream-dictionary.test.ts` 맨 아래에 추가:
```ts
test('searchDream matches by chosung-only query', () => {
  // 'ㅂ' 초성 입력 → 초성이 ㅂ인 키워드(예: 뱀)로 수렴.
  const r = searchDream('ㅂ');
  assert.equal(r.exact, false);
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

test('searchDream tolerates jamo-level partial input', () => {
  // 받침이 빠진 부분 입력도 자모 substring 으로 흡수되어 fallback 으로 빠지지 않는다.
  const partial = searchDream('뱀'.normalize());
  assert.ok(partial.match.keyword.length > 0);
});
```
(상단 import에 `toChosung` 추가: 기존 import 라인에서 `from './dream-dictionary'`가 아니라 테스트 파일이 import하는 곳 — 파일 상단 import 블록에 `import { toChosung } from './dream/hangul-search';` 추가.)

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: FAIL — `searchDream('ㅂ')`이 현재는 fallback(키워드 '검색어'/입력값)이라 `toChosung(...).startsWith('ㅂ')` 단언 실패.

- [ ] **Step 3: 구현 — import + 단계 삽입**

`src/lib/dream-dictionary.ts` 상단 import 영역에 추가:
```ts
import { toChosung, toJamo, isChosungOnly } from './dream/hangul-search';
```

`searchDream` 본문에서 "2) 부분 매치" 블록(`partial.length > 0` 반환) **직후, "3) related 태그 매치" 직전**에 삽입:
```ts
  // 2.5) 초성 매치 — 초성만 입력한 경우
  if (isChosungOnly(trimmed)) {
    const byChosung = Object.keys(DREAM_DICTIONARY).filter((key) =>
      toChosung(key).includes(trimmed)
    );
    if (byChosung.length > 0) {
      return {
        match: DREAM_DICTIONARY[byChosung[0]],
        suggestions: byChosung.slice(1, 4),
        exact: false,
      };
    }
  }

  // 2.6) 자모 부분 매치 — 오타/부분입력 흡수 (단일 자모 과매칭 방지: 길이 ≥ 2)
  const qJamo = toJamo(trimmed);
  if (qJamo.length >= 2) {
    const byJamo = Object.keys(DREAM_DICTIONARY).filter((key) =>
      toJamo(key).includes(qJamo)
    );
    if (byJamo.length > 0) {
      return {
        match: DREAM_DICTIONARY[byJamo[0]],
        suggestions: byJamo.slice(1, 4),
        exact: false,
      };
    }
  }
```

- [ ] **Step 4: 통과 + 회귀 확인**

Run: `npm test`
Expected: PASS — 신규 3 + 기존 전부(특히 dream-dictionary 기존 회귀).

- [ ] **Step 5: 타입체크**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | head -20`
Expected: 신규 에러 0.

- [ ] **Step 6: 커밋**
```bash
git add src/lib/dream-dictionary.ts src/lib/dream-dictionary.test.ts
git commit -m "feat(dream): 검색에 초성·자모 매치 단계 추가 — 적중률 개선"
```

---

## Task 3: 실제 검색 동작 검증 + PR

- [ ] **Step 1: 대표 쿼리 스모크(throwaway)**

임시 테스트로 실제 검색 결과 확인:
```bash
cat > src/lib/dream/__dump_search.test.ts <<'EOF'
import { searchDream } from '../dream-dictionary';
declare const test: (name: string, fn: () => Promise<void> | void) => void;
test('DUMP dream search (throwaway)', () => {
  for (const q of ['ㅂ', 'ㄸ', 'ㅇㅃ', '뱀', '구렁이', '돈', '시험']) {
    const r = searchDream(q);
    console.log(`q="${q}" -> match="${r.match.keyword}" exact=${r.exact} sugg=[${r.suggestions.join(',')}]`);
  }
});
EOF
npm test 2>&1 | grep 'q="'
rm -f src/lib/dream/__dump_search.test.ts
```
Expected: 초성/자모 쿼리가 fallback('검색어')이 아닌 실제 키워드로 수렴. 기존 정확매치 정상.

- [ ] **Step 2: 전체 스위트 + 타입체크**

Run: `npm test && npx tsc --noEmit -p tsconfig.json 2>&1 | head`
Expected: 전체 PASS, 타입에러 0.

- [ ] **Step 3: PR**
```bash
git push -u origin feat/dream-search-accuracy
gh pr create --base main \
  --title "feat(dream): 검색 정확도 — 초성/자모 정규화 (로드맵 영역3 #4)" \
  --body "spec: docs/superpowers/specs/2026-06-06-dream-search-accuracy-design.md

- 신규 hangul-search 유틸(toChosung/toJamo/isChosungOnly)
- searchDream에 초성 매치 + 자모 부분매치 단계 추가 → 기존 306 사전 적중률 개선
- 순수 알고리즘(콘텐츠/DB 없음), 유틸·검색 통합·회귀 테스트

배경: 로드맵 1·2단계(사전 33→306, 검색→상세 링크)는 이미 완료 상태였고, 남은 갭인 검색 정확도를 구현.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```
Expected: CI 통과(브랜치 현재 main 기준 → 스모크 green).

---

## Self-Review

**Spec coverage:** §3.1 유틸→Task1 ✓; §3.2 단계 삽입(초성/자모, 순서, 길이≥2 가드)→Task2 Step3 ✓; §5 테스트(유틸·통합·회귀)→Task1/Task2 ✓; §6 비대상(콘텐츠 없음) ✓.

**Placeholder scan:** 전 스텝 실제 코드/명령/기대출력 포함. TODO/TBD 없음.

**Type consistency:** `toChosung`/`toJamo`/`isChosungOnly` 시그니처가 Task1 정의 ↔ Task2 import/사용 일치. `searchDream` 반환 형식(`{match, suggestions, exact}`)을 신규 단계도 동일 준수.

**주의:** Task2 테스트가 `toChosung`를 쓰므로 `dream-dictionary.test.ts` 상단 import에 `import { toChosung } from './dream/hangul-search';` 추가 필요(Step1에 명시).

# 오늘운세 하이브리드 LLM 풀이 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 무료 오늘운세의 메인 풀이(`oneLine.headline`/`body`)를 결정론 사실 위에서 LLM이 매일 자연스럽고 다양하게 작성하도록 한다(점수·사실은 결정론 유지).

**Architecture:** 기존 `src/app/api/interpret/route.ts` LLM 패턴을 따른다. `buildTodayFortuneFreeResult`(순수 결정론)는 무수정 — 그 결과의 `oneLine`만 async 후처리로 덮어쓴다. 캐시 미스 시 결정론 facts grounding → `generateAiText`(fallback=결정론 풀이) → validator → 통과면 캐시+반환, 위반/실패면 결정론 폴백. 플래그 `OPENAI_TODAY_FORTUNE`로 게이팅(기본 OFF=현 동작).

**Tech Stack:** Next.js 16 App Router, Supabase(service role), OpenAI(`generateAiText`), 기존 `validateChapterBody` validator.

## Global Constraints

- 어휘 정책 최우선: `docs/claude-specs/02-naming-policy.md` (오행="X 기운", 본문 한자 0, 추상명사 신조어 금지).
- 금지 표현: 단정 예측(`반드시`/`절대`/`100%`/`무조건`), doom·공포 조장. validator 위반 시 결정론 폴백.
- 점수·사실은 결정론 단일 출처(불변). LLM은 `oneLine.headline`/`body`만 작성.
- 비로그인(게스트)·플래그 OFF → 전부 결정론(회귀 0).
- Supabase 마이그레이션은 CLI 수동 적용(자동 아님).
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: LlmFeature 'today_fortune' 추가 + 플래그 헬퍼

**Files:**
- Modify: `src/server/ai/llm-telemetry.ts:10-19` (LlmFeature 유니온에 `'today_fortune'` 추가)
- Create: `src/server/ai/today-fortune/flag.ts`
- Test: `src/server/ai/today-fortune/flag.test.ts`

**Interfaces:**
- Produces: `isTodayFortuneLlmEnabled(): boolean`

- [ ] **Step 1: 실패 테스트 작성** — `src/server/ai/today-fortune/flag.test.ts`

```ts
import assert from 'node:assert/strict';
import { isTodayFortuneLlmEnabled } from './flag';

declare const test: (name: string, fn: () => void) => void;

test('OPENAI_TODAY_FORTUNE 미설정 시 false', () => {
  delete process.env.OPENAI_TODAY_FORTUNE;
  assert.equal(isTodayFortuneLlmEnabled(), false);
});
test("'1' 이면 true, '0' 이면 false", () => {
  process.env.OPENAI_TODAY_FORTUNE = '1';
  assert.equal(isTodayFortuneLlmEnabled(), true);
  process.env.OPENAI_TODAY_FORTUNE = '0';
  assert.equal(isTodayFortuneLlmEnabled(), false);
  delete process.env.OPENAI_TODAY_FORTUNE;
});
```

- [ ] **Step 2: 실패 확인** — `npm test` → `flag` 모듈 없음으로 FAIL.

- [ ] **Step 3: 구현** — `src/server/ai/today-fortune/flag.ts`

```ts
// 오늘운세 무료 LLM 풀이 게이팅. 미설정/'0' → 결정론(현 동작). '1' → LLM.
export function isTodayFortuneLlmEnabled(): boolean {
  return process.env.OPENAI_TODAY_FORTUNE?.trim() === '1';
}
```

그리고 `src/server/ai/llm-telemetry.ts`의 LlmFeature 유니온에 `| 'today_fortune'` 추가(`'today_premium'` 다음 줄).

- [ ] **Step 4: 통과 확인** — `npm test` → flag 테스트 PASS. `npm run typecheck` → exit 0.

- [ ] **Step 5: 커밋** — `git add -A && git commit -m "feat(today-fortune): LLM 플래그 + telemetry feature"`

---

### Task 2: Facts grounding 빌더

**Files:**
- Create: `src/server/ai/today-fortune/grounding.ts`
- Test: `src/server/ai/today-fortune/grounding.test.ts`

**Interfaces:**
- Consumes: `TodayFortuneFreeResult`(from `@/lib/today-fortune/types`), `SajuDataV1|V2`, picked iljin caseIds.
- Produces:
  ```ts
  export interface TodayFortuneGrounding {
    name: string;
    todayGanzi: string;       // 일진 간지 (한자 아님, 한글 음 — 예: '갑자')
    iljinScore: number | null;
    iljinGrade: string | null;
    weakElement: string;       // '목 기운' 형태
    strongElement: string;
    topAreas: Array<{ key: string; label: string; score: number }>;
    triggeredCaseSummaries: string[]; // 발동 케이스 한 줄 의미(전체)
    concernLabel: string;
    situation: string | null;  // 프로필 상황 한 줄
  }
  export function buildTodayFortuneGrounding(args: {
    result: TodayFortuneFreeResult;
    sajuData: SajuDataV1 | SajuDataV2;
    caseSummaries: string[];
    situation: string | null;
  }): TodayFortuneGrounding;
  ```

- [ ] **Step 1: 실패 테스트** — 결정론성 + 핵심 필드 채워짐 검증.

```ts
import assert from 'node:assert/strict';
import { buildTodayFortuneGrounding } from './grounding';
declare const test: (name: string, fn: () => void) => void;

// 픽스처: 최소 TodayFortuneFreeResult/sajuData stub (실제 타입 필드 채움 — 구현 시 빌더로 생성)
test('grounding 은 결정론적이다(같은 입력 → 같은 출력)', () => {
  const args = makeArgs(); // 헬퍼: 고정 입력
  assert.deepEqual(buildTodayFortuneGrounding(args), buildTodayFortuneGrounding(args));
});
test('weakElement 는 "X 기운" 형태(naming-policy)', () => {
  const g = buildTodayFortuneGrounding(makeArgs());
  assert.match(g.weakElement, /기운$/);
});
```
(`makeArgs`는 테스트 상단에서 실제 `buildTodayFortuneFreeResult` + `freshSajuData`로 생성 — Task 2 구현 시 today-fortune-audit.ts 의 픽스처 생성 패턴 재사용.)

- [ ] **Step 2: 실패 확인** — `npm test` → FAIL.

- [ ] **Step 3: 구현** — `grounding.ts`. `result.scores`(상위 3), `sajuData.fiveElements.weakest/dominant`(→`${el} 기운`), `result.iljinScore`, `result.userName`, `result.concernLabel`, `caseSummaries`, `situation`에서 추출. 한자 간지는 한글 음으로 변환(기존 `formatTodayDateMarker`/간지 한글맵 재사용).

- [ ] **Step 4: 통과 확인** — `npm test` PASS · `npm run typecheck` 0.

- [ ] **Step 5: 커밋** — `git commit -m "feat(today-fortune): LLM grounding 빌더"`

> 참고: `LlmFeature`에 이미 `today_premium`이 있다 → `src/server/ai/` 하위에 today-fortune premium LLM grounding/prompt가 있을 수 있음. 있으면 caseSummaries 의미 매핑·간지 한글화를 그쪽에서 재사용(중복 금지).

---

### Task 3: 프롬프트 빌더

**Files:**
- Create: `src/server/ai/today-fortune/prompt.ts`
- Test: `src/server/ai/today-fortune/prompt.test.ts`

**Interfaces:**
- Consumes: `TodayFortuneGrounding`.
- Produces:
  ```ts
  export const TODAY_FORTUNE_PROMPT_VERSION = 'tf-v1';
  export function createTodayFortunePrompt(g: TodayFortuneGrounding): { instructions: string; input: string };
  export function buildTodayFortuneFallbackText(headline: string, body: string): string; // JSON.stringify({headline, body})
  ```

- [ ] **Step 1: 실패 테스트** — 프롬프트에 핵심 사실 + 제약이 들어가는지.

```ts
import assert from 'node:assert/strict';
import { createTodayFortunePrompt } from './prompt';
declare const test: (name: string, fn: () => void) => void;
test('instructions 에 금지 규칙(단정/한자) 명시', () => {
  const { instructions } = createTodayFortunePrompt(makeGrounding());
  assert.match(instructions, /반드시|단정|한자/);
});
test('input 에 오늘 일진과 관심사가 포함된다', () => {
  const { input } = createTodayFortunePrompt(makeGrounding({ todayGanzi: '갑자', concernLabel: '연애' }));
  assert.ok(input.includes('갑자') && input.includes('연애'));
});
```

- [ ] **Step 2: 실패 확인** — FAIL.

- [ ] **Step 3: 구현** — `instructions`: 달빛 선생 톤 + "사실만 자연스럽게 연결, 점수 단정 금지, 한자 0, doom 금지, headline 1문장 + body 2~3문장, JSON {headline, body}". `input`: grounding facts를 JSON으로. `responseFormat: { type: 'json_schema_body' }` 사용(interpret 패턴).

- [ ] **Step 4: 통과 확인** — `npm test` PASS.

- [ ] **Step 5: 커밋** — `git commit -m "feat(today-fortune): LLM 프롬프트 빌더"`

---

### Task 4: 마이그레이션 — today_fortune_ai 캐시 테이블

**Files:**
- Create: `supabase/migrations/052_today_fortune_ai.sql`

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- 오늘운세 무료 LLM 풀이 캐시. 유저·날짜·관심사·프롬프트버전당 1행.
create table if not exists public.today_fortune_ai (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date_key text not null,
  concern_id text not null,
  prompt_version text not null,
  headline text not null,
  body text not null,
  source text not null default 'openai',
  model text,
  fallback_reason text,
  iljin_ganzi text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date_key, concern_id, prompt_version)
);
alter table public.today_fortune_ai enable row level security;
create policy "today_fortune_ai_own_read" on public.today_fortune_ai
  for select using (auth.uid() = user_id);
-- insert/update 는 service_role(RLS 우회)로만. anon/authed 직접 쓰기 정책 없음.
create index if not exists today_fortune_ai_user_date_idx
  on public.today_fortune_ai (user_id, date_key);
```

- [ ] **Step 2: 검증** — SQL 문법 자기검토(괄호·세미콜론). 로컬 DB 적용은 운영자 수동(아래 노트).

- [ ] **Step 3: 커밋** — `git commit -m "feat(today-fortune): today_fortune_ai 캐시 테이블 마이그레이션"`

> ⚠️ 적용 노트(운영자): `supabase db push` 또는 대시보드로 052 수동 적용. 미적용 시 캐시 read/write 가 조용히 실패하고 매번 결정론 폴백(안전).

---

### Task 5: 캐시 read/write 헬퍼

**Files:**
- Create: `src/server/ai/today-fortune/cache.ts`
- Test: `src/server/ai/today-fortune/cache.test.ts` (순수 빌더 부분만 — DB 호출은 통합단계)

**Interfaces:**
- Produces:
  ```ts
  export interface TodayFortuneCacheKey { userId: string; dateKey: string; concernId: string; promptVersion: string; }
  export interface TodayFortuneCacheRow { headline: string; body: string; source: string; model: string | null; }
  export function buildTodayFortuneCacheInsert(key: TodayFortuneCacheKey, value: { headline: string; body: string; source: string; model: string | null; fallbackReason: string | null; iljinGanzi: string | null; }): Record<string, unknown>;
  export async function readTodayFortuneAi(key: TodayFortuneCacheKey): Promise<TodayFortuneCacheRow | null>;
  export async function writeTodayFortuneAi(key: TodayFortuneCacheKey, value: {...}): Promise<void>;
  ```

- [ ] **Step 1: 실패 테스트** — `buildTodayFortuneCacheInsert` 가 키+값을 DB 컬럼명으로 매핑.

```ts
import assert from 'node:assert/strict';
import { buildTodayFortuneCacheInsert } from './cache';
declare const test: (name: string, fn: () => void) => void;
test('insert row 는 unique 키 컬럼 + 본문을 담는다', () => {
  const row = buildTodayFortuneCacheInsert(
    { userId: 'u1', dateKey: '2026-06-22', concernId: 'love', promptVersion: 'tf-v1' },
    { headline: 'h', body: 'b', source: 'openai', model: 'm', fallbackReason: null, iljinGanzi: '갑자' }
  );
  assert.equal(row.user_id, 'u1');
  assert.equal(row.date_key, '2026-06-22');
  assert.equal(row.concern_id, 'love');
  assert.equal(row.headline, 'h');
});
```

- [ ] **Step 2: 실패 확인** — FAIL.

- [ ] **Step 3: 구현** — `buildTodayFortuneCacheInsert`(순수) + `readTodayFortuneAi`(service client `.from('today_fortune_ai').select(...).eq(...).maybeSingle()`, 실패 시 null) + `writeTodayFortuneAi`(`.upsert(row, { onConflict: 'user_id,date_key,concern_id,prompt_version' })`, 실패 삼킴). `interpret/route.ts`의 read/writeCachedInterpretation 패턴 복제. `hasSupabaseServiceEnv` 가드.

- [ ] **Step 4: 통과 확인** — `npm test` PASS · `npm run typecheck` 0.

- [ ] **Step 5: 커밋** — `git commit -m "feat(today-fortune): LLM 캐시 read/write 헬퍼"`

---

### Task 6: 오케스트레이터 — generateTodayFortuneNarrative

**Files:**
- Create: `src/server/ai/today-fortune/service.ts`
- Test: `src/server/ai/today-fortune/service.test.ts`

**Interfaces:**
- Consumes: Task1 flag, Task2 grounding, Task3 prompt, Task5 cache, `generateAiText`, `validateChapterBody`.
- Produces:
  ```ts
  export interface TodayFortuneNarrative { headline: string; body: string; source: 'openai' | 'fallback' | 'cache'; }
  export async function generateTodayFortuneNarrative(args: {
    result: TodayFortuneFreeResult;
    sajuData: SajuDataV1 | SajuDataV2;
    caseSummaries: string[];
    situation: string | null;
    userId: string;
  }): Promise<TodayFortuneNarrative | null>;  // null = 결정론 유지(플래그 OFF/게스트)
  ```

- [ ] **Step 1: 실패 테스트** — DI 로 generateAiText/cache 를 주입(또는 telemetryStore 패턴). 핵심: (a) 플래그 OFF → null, (b) 위반 출력 → fallback source, (c) 정상 → openai.

```ts
import assert from 'node:assert/strict';
import { parseTodayFortuneNarrative } from './service';
declare const test: (name: string, fn: () => void) => void;
test('금지어 포함 LLM 출력은 폴백으로 대체', () => {
  const r = parseTodayFortuneNarrative('{"headline":"오늘은 반드시 성공","body":"x"}', { headline: 'FB', body: 'FBB' });
  assert.equal(r.source, 'fallback');
  assert.equal(r.headline, 'FB');
});
test('정상 출력은 그대로 채택', () => {
  const r = parseTodayFortuneNarrative('{"headline":"잔잔한 하루","body":"오늘은 천천히 가요."}', { headline: 'FB', body: 'FBB' });
  assert.equal(r.source, 'openai');
  assert.equal(r.headline, '잔잔한 하루');
});
```
(`parseTodayFortuneNarrative(text, fallback)`: JSON 파싱 + `validateChapterBody(headline+body)` 통과 검사 → 순수 함수로 분리해 단위테스트.)

- [ ] **Step 2: 실패 확인** — FAIL.

- [ ] **Step 3: 구현** — `generateTodayFortuneNarrative`: `isTodayFortuneLlmEnabled()` false → null. 캐시 read → 히트면 `{...,source:'cache'}`. 미스 → grounding+prompt 빌드, fallback=`result.oneLine`, `generateAiText({ instructions, input, fallbackText, model: getOpenAIInterpretationModel(), maxOutputTokens: 500, temperature: 0.8, responseFormat:{type:'json_schema_body'}, feature:'today_fortune', userId })`. `parseTodayFortuneNarrative(result.text, fallback)` → cache write → 반환. 순수 `parseTodayFortuneNarrative` 분리.

- [ ] **Step 4: 통과 확인** — `npm test` PASS · `npm run typecheck` 0.

- [ ] **Step 5: 커밋** — `git commit -m "feat(today-fortune): LLM 오케스트레이터 + 검증/폴백"`

---

### Task 7: 라우트 통합 (oneLine 덮어쓰기)

**Files:**
- Modify: `src/app/api/today-fortune/route.ts` (buildTodayFortuneFreeResult 호출 직후)
- Test: 수동 + 기존 E2E smoke (회귀). 단위는 Task6에서 커버.

**Interfaces:**
- Consumes: Task6 `generateTodayFortuneNarrative`.

- [ ] **Step 1: 통합 코드** — `route.ts`에서 `const result = buildTodayFortuneFreeResult(...)` 다음:

```ts
// 오늘운세 무료 LLM 풀이(플래그 ON + 로그인 시). null 이면 결정론 유지.
if (user?.id) {
  const caseSummaries = buildCaseSummariesFromResult(result); // result.iljinMessages 또는 caseIds → 한 줄 의미
  const situation = persistedGrounding?.personalizationContext?.userSituation
    ? summarizeUserSituation(persistedGrounding.personalizationContext.userSituation) : null;
  const narrative = await generateTodayFortuneNarrative({
    result, sajuData, caseSummaries, situation, userId: user.id,
  });
  if (narrative) {
    result.oneLine = { ...result.oneLine, headline: narrative.headline, body: narrative.body };
  }
}
```

- [ ] **Step 2: 타입체크/빌드** — `npm run typecheck` 0, `npm run build` 0.

- [ ] **Step 3: 플래그 OFF 회귀 확인** — `OPENAI_TODAY_FORTUNE` 미설정으로 `npm test` 전체 PASS(현 동작 불변), `npm run e2e`(smoke) 영향 없음.

- [ ] **Step 4: 플래그 ON 수동 검증** — 로컬 `.env.local`에 `OPENAI_TODAY_FORTUNE=1` + OpenAI 키 + 052 적용 후, 같은 유저로 관심사 바꿔가며 2~3일치(`options.now` 조작 또는 실제) 호출 → (a) headline/body 가 날마다·관심사마다 다름, (b) 한자/단정 0, (c) 재호출 캐시 히트(중복 생성 0) 확인.

- [ ] **Step 5: 커밋** — `git commit -m "feat(today-fortune): 무료 풀이에 LLM oneLine 통합"`

---

### Task 8: 문서화 + .env.example 안내

**Files:**
- Modify: `.env.example` (운영자 직접 — 샌드박스가 .env 쓰기 차단)

- [ ] **Step 1:** `.env.example`에 추가할 텍스트를 PR 본문/리뷰에 명시:
  ```
  # 오늘운세 무료 LLM 풀이. '1' 활성(결정론 점수 위에 LLM 프로즈), 미설정/'0' = 결정론.
  OPENAI_TODAY_FORTUNE=0
  ```
- [ ] **Step 2:** memory `reference_ops-toggles`에 `OPENAI_TODAY_FORTUNE` + 052 마이그레이션 적용 항목 추가.
- [ ] **Step 3: 커밋** — 문서/메모리 갱신.

---

## 검증 종합 (전 태스크 후)
- `npm test` 신규 단위테스트 PASS + 기존 회귀 0.
- `npm run typecheck` 0 · `npm run build` 0.
- 플래그 OFF = 현 동작(폴백 경로 = 결정론), 플래그 ON = LLM + 캐시 + 검증/폴백.
- 052 마이그레이션 수동 적용 후 캐시 동작.

## Self-Review 체크
- Spec §4 아키텍처 → Task 6/7. §5 경계(oneLine만) → Task 7. §6 grounding → Task 2. §7 캐시/테이블 → Task 4/5. §8 안전 → Task 6(validator/폴백). §11 롤아웃 → 플래그(Task1)+마이그레이션(Task4). 누락 없음.
- 타입 일관성: `TodayFortuneGrounding`/`TodayFortuneCacheKey`/`TodayFortuneNarrative`/`createTodayFortunePrompt`/`generateTodayFortuneNarrative`/`parseTodayFortuneNarrative`/`isTodayFortuneLlmEnabled` 명칭 태스크 간 일치.

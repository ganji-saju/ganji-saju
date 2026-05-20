# 사주 총평 LLM 풀이 파이프라인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사주 결과 페이지 *총평 탭*의 본문을 현재 결정론적 7문장 단락(`buildSajuNarrative`)에서 LLM 생성 *3섹션*(한 줄 요약 / 본문 4단락 / 평생 활용 3가지)으로 확장한다. `saju-total-review-llm-spec.md` 구현.

**Architecture:** 기존 대운/챕터 LLM 파이프라인(`saju-lifetime-service` → `generate-chapter` → `chapter-validator` → envelope cache)과 동일 패턴을 *총평* 용으로 복제한다. 핵심 차이는 (1) 입력이 *대운 1개*가 아니라 *원국 전체* 라 `_easy` 도출 레이어가 더 두껍고, (2) "평생 적용 톤"(일일 톤 금지)이 추가 규칙. 신규 코드는 모두 env 플래그(`OPENAI_INTERPRET_TOTAL_REVIEW`, default OFF) 뒤에 두어, 미설정 시 기존 `buildSajuNarrative` 결정론 출력이 그대로 fallback 으로 유지된다(무중단 롤아웃).

**Tech Stack:** Next.js 16.2.3 (app router, **breaking changes — `node_modules/next/dist/docs/` 확인 필수**), TypeScript 5 strict, OpenAI Responses API (`gpt-5.2-chat-latest`, `generateAiText`), vitest 4 (`npm run test:spec`), Supabase(envelope cache), Playwright(e2e).

---

## Scope Check

총평 LLM 은 *하나의 응집된 서브시스템*(입력 도출 → 3섹션 생성 → 검증 → 캐시 → 렌더)이라 단일 plan 으로 충분하다. 단, 스펙 §11 의 *점수 시스템*(종합 100점/오행 도넛/강약 게이지)은 **별도 plan**(`saju-score-spec.md`)으로 분리한다 — 본 plan 범위 밖.

`_easy` 도출은 기존 엔진 출력만으로 가능함을 사전 검증 완료:
- `ilgan_easy` ← `data.dayMaster.metaphor` + `.description` + `.element` (`DAY_MASTER_METAPHORS`/`DESCRIPTIONS`, saju-data-v1.ts:143/156)
- `ilju_easy` ← `personalizationContext.sixtyGapja.title` + `.core` (sixty-gapja-core.json)
- `key_strengths_easy`/`key_weaknesses_easy` ← `sixtyGapja.strengths`/`.watchPoints` **+ 보강**(엔트리당 2개/1개뿐 → 격국·부족오행·강약에서 3개로 패딩)
- `ohaeng_*` ← `data.fiveElements.byElement[*]` + `ELEMENT_PLAIN_EFFECT`(saju-data-v1.ts:99)
- `yongsin_easy` ← `data.yongsin.primary.label` + `.plainSummary`/`.practicalActions`
- `kyeokguk_easy` ← `data.pattern.name`/`.tenGod` + `MYEONGRI_GLOSSARY[tenGod].plainCue`(terminology.ts:118) + **신규 `KYEOKGUK_CAREER_FIT` 맵**(glossary 에 career_fit 없음)
- `ganguk_easy` ← `data.strength.level`(신강/중화/신약) → **신규 `GANGUK_EASY` 맵**
- `current_timeline` ← `data.currentLuck.currentMajorLuck`/`saewoon`/`wolwoon` + 연령 도출

---

## File Structure

### 신규 파일
| 경로 | 책임 |
|------|------|
| `src/server/ai/total-review/total-review-types.ts` | `TotalReviewInput`(=spec §2 JSON 의 TS 타입), `TotalReviewOutput`(=spec §6), 섹션 ID 타입 |
| `src/server/ai/total-review/total-review-content.ts` | 신규 도출 컨텐츠 맵 — `GANGUK_EASY`, `KYEOKGUK_CAREER_FIT`, 강점/약점 패딩 헬퍼 |
| `src/server/ai/total-review/build-total-review-input.ts` | `buildTotalReviewInput(data, personalizationContext, options)` → `TotalReviewInput`. `_easy` 도출 핵심 |
| `src/server/ai/total-review/total-review-prompts.ts` | 총평 system prompt(spec §3) + 3섹션 user message 빌더(spec §4) + few-shot(spec §5) |
| `src/server/ai/total-review/generate-total-review.ts` | 3섹션 생성·검증·재시도 오케스트레이터(=`generate-chapter` 패턴) |
| `src/lib/saju/total-review-validator.ts` | `validateTotalReview()`(spec §7 10항목) — `chapter-validator` 상수 재사용 |
| `src/server/ai/total-review/total-review-cache.ts` | `buildTotalReviewCacheKey()`(birth+gender+context_hash) + TTL + env flag |
| `src/server/ai/saju-total-review-service.ts` | 진입점: 입력 빌드 → 3섹션 병렬 생성 → 검증 → 캐시 → `TotalReviewResult` |
| `src/components/saju/saju-total-review-narrative.tsx` | 4단락(라벨 부착) 렌더 |
| `src/components/saju/saju-lifetime-keys-section.tsx` | 평생 활용 3카드 렌더 |
| `src/data/saju/saju-terms-dictionary.json` | Downloads 사전을 repo 로 편입(현재 미편입). current_timeline 용어 풀이용 |

### 수정 파일
| 경로 | 변경 |
|------|------|
| `src/app/saju/[slug]/page.tsx:300-420` | 총평 탭에 LLM 결과 주입(플래그 ON 시), fallback=기존 `SajuNarrativeCard` |
| `.env.example` | `OPENAI_INTERPRET_TOTAL_REVIEW` 추가 |

### 테스트 (colocated, vitest)
각 신규 모듈 옆 `*.test.ts`. **Task 1 에서 `src/server/ai/chapters/generate-chapter.test.ts` 의 import 스타일을 먼저 확인**해 동일 스타일(vitest `describe/it/expect` vs `node:test`)로 작성.

---

## Phase 0 — 브랜치 + 테스트 스타일 확인

### Task 1: 작업 브랜치 + 테스트 컨벤션 확인

**Files:** (없음 — 설정)

- [ ] **Step 1: 브랜치 생성**

```bash
cd /Users/kionya/ganji-saju
git checkout -b feat/saju-total-review-llm
```

- [ ] **Step 2: 테스트 스타일 + 사이드카 패턴 확인**

Read: `src/server/ai/chapters/generate-chapter.test.ts` (상단 import) 와 `src/server/ai/saju-yearly-service.ts` (단일 섹션 LLM 서비스 — 캐시 envelope/플래그 패턴의 가장 가까운 analog).
확인 사항: (a) 테스트가 `vitest` 의 `describe/it/expect` 인지 `node:test`+`assert` 인지, (b) yearly service 의 cache envelope 키 이름/upsert 함수, (c) `reading` 객체(`SajuReading`?) 의 envelope 필드명.
이 plan 의 모든 테스트 코드는 (a) 스타일을 따른다. 이하 테스트는 **vitest 스타일로 표기** — (a) 가 `node:test` 면 `import { test } from 'node:test'; import assert from 'node:assert/strict'` 로 치환.

- [ ] **Step 3: Next.js 16 가이드 확인(렌더 변경 대비)**

Read: `node_modules/next/dist/docs/` 에서 server component / async params 관련 가이드(특히 `[slug]/page.tsx` 가 async params 쓰는지). Phase 5 전 필수.

---

## Phase 1 — 입력 `_easy` 도출 레이어 (핵심)

### Task 2: 타입 정의

**Files:**
- Create: `src/server/ai/total-review/total-review-types.ts`

- [ ] **Step 1: 타입 작성** (spec §2 입력 + §6 출력의 TS 표현)

```typescript
// 2026-05-21 — 사주 총평 LLM 입력/출력 타입. saju-total-review-llm-spec.md §2·§6.
//   _internal_* 필드는 LLM 프롬프트에 *주입하지 않음* (도출 근거 추적용, 본문 노출 금지).

export type TotalReviewSectionId = 'one_line_summary' | 'main_narrative' | 'lifetime_keys';

export interface TotalReviewIlganEasy {
  label: string;
  detail: string;
  metaphor: string;
}
export interface TotalReviewIljuEasy {
  label: string;
  detail: string;
}
export interface TotalReviewOhaengLackEasy {
  element: string;      // '금' 등 한글 오행
  label: string;        // plainCue 라벨
  meaning: string;      // ELEMENT_PLAIN_EFFECT 기반
}
export interface TotalReviewGangukEasy {
  label: string;
  detail: string;
}
export interface TotalReviewYongsinEasy {
  primary: { label: string; meaning: string };
  secondary: { label: string; meaning: string } | null;
}
export interface TotalReviewKyeokgukEasy {
  label: string;
  detail: string;
  career_fit: string[];
}
export interface TotalReviewWonkuk {
  ilgan_easy: TotalReviewIlganEasy;
  ilju_easy: TotalReviewIljuEasy;
  ohaeng_balance: Record<string, number>;
  ohaeng_lack_easy: TotalReviewOhaengLackEasy[];
  ohaeng_excess_easy: TotalReviewOhaengLackEasy[];
  ganguk_easy: TotalReviewGangukEasy;
  yongsin_easy: TotalReviewYongsinEasy;
  kyeokguk_easy: TotalReviewKyeokgukEasy;
  key_strengths_easy: string[];   // 정확히 3개
  key_weaknesses_easy: string[];  // 정확히 3개
}
export interface TotalReviewTimelineEntry {
  label_easy: string;
  meaning_easy: string;
}
export interface TotalReviewTimeline {
  daewoon: TotalReviewTimelineEntry & { label_short: string; is_current: boolean };
  saewoon: TotalReviewTimelineEntry;
  wolun: TotalReviewTimelineEntry;
}
export interface TotalReviewContext {
  relationship_status: string | null;  // '기혼' 등 한글 라벨
  occupation_status: string | null;    // '직장인' 등
  concern: string | null;              // '재물·투자' 등
}
export interface TotalReviewInput {
  user: { name: string | null; gender: 'M' | 'F' | null; current_age: number | null };
  context: TotalReviewContext;
  wonkuk: TotalReviewWonkuk;
  current_timeline: TotalReviewTimeline;
}

// ── 출력 (spec §6) ──
export interface TotalReviewNarrative {
  paragraph_1_who_you_are: string;
  paragraph_2_strong_environment: string;
  paragraph_3_weak_zone: string;
  paragraph_4_now: string;
}
export interface TotalReviewLifetimeKey {
  title: string;
  subtitle: string;
  body: string;
}
export interface TotalReviewOutput {
  one_line_summary: string;
  main_narrative: TotalReviewNarrative;
  lifetime_keys: TotalReviewLifetimeKey[];
}
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: PASS (신규 타입만, 미사용 경고 없음 — `export` 라서)

- [ ] **Step 3: Commit**

```bash
git add src/server/ai/total-review/total-review-types.ts
git commit -m "feat(total-review): add input/output types per spec §2·§6"
```

### Task 3: 도출 컨텐츠 맵 + 강점/약점 패딩

**Files:**
- Create: `src/server/ai/total-review/total-review-content.ts`
- Test: `src/server/ai/total-review/total-review-content.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
import { describe, it, expect } from 'vitest';
import { GANGUK_EASY, KYEOKGUK_CAREER_FIT, padToThree } from './total-review-content';

describe('GANGUK_EASY', () => {
  it('신약 을 일상어 label+detail 로 변환하고 명리어를 노출하지 않는다', () => {
    const g = GANGUK_EASY['신약'];
    expect(g.label.length).toBeGreaterThan(0);
    expect(g.label).not.toMatch(/신약|신강|강약/);
    expect(g.detail).not.toMatch(/[一-鿿]/);
  });
});
describe('KYEOKGUK_CAREER_FIT', () => {
  it('식신 격국에 분석/기획/상담/교육/돌봄/연구 류 직군을 매핑한다', () => {
    expect(KYEOKGUK_CAREER_FIT['식신']).toEqual(
      expect.arrayContaining(['분석', '기획', '상담', '교육', '돌봄', '연구'])
    );
  });
});
describe('padToThree', () => {
  it('2개면 보강 후보에서 채워 정확히 3개로 만든다', () => {
    expect(padToThree(['a', 'b'], ['c', 'd'])).toEqual(['a', 'b', 'c']);
  });
  it('3개 이상이면 앞에서 3개만', () => {
    expect(padToThree(['a', 'b', 'c', 'd'], ['e'])).toEqual(['a', 'b', 'c']);
  });
  it('중복은 제거하고 채운다', () => {
    expect(padToThree(['a'], ['a', 'b'])).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test:spec -- src/server/ai/total-review/total-review-content.test.ts`
Expected: FAIL (`Cannot find module './total-review-content'`)

- [ ] **Step 3: 구현**

```typescript
// 2026-05-21 — 총평 _easy 도출용 신규 컨텐츠 맵. 엔진/glossary 에 없는 부분만 정의.
import type { StrengthLevel } from '@/domain/saju/engine/saju-data-v1';
import type { TenGodCode } from '@/domain/saju/engine/saju-data-v1';

/** 강약(신강/중화/신약) → 일상어 label+detail. 명리어 노출 금지. spec §2 ganguk_easy. */
export const GANGUK_EASY: Record<StrengthLevel, { label: string; detail: string }> = {
  신강: {
    label: '자기 축이 단단한 결',
    detail: '본인 페이스가 또렷하고 주관이 분명한 편. 단, 주변과 속도를 맞추는 연습이 같이 필요해요.',
  },
  중화: {
    label: '균형이 잡힌 결',
    detail: '한쪽으로 치우치지 않고 상황에 맞춰 힘을 쓰는 편. 큰 흔들림 없이 흐르는 구조예요.',
  },
  신약: {
    label: '자기 축이 다소 약한 결',
    detail: '본인 페이스가 외부 영향에 흔들리기 쉬운 구조. 단, 흐름을 잘 읽는 강점도 같이 옵니다.',
  },
};

/** 격국(채택 십성) → 어울리는 직군. MYEONGRI_GLOSSARY 에 career_fit 이 없어 신규 정의. spec §2 kyeokguk_easy.career_fit. */
export const KYEOKGUK_CAREER_FIT: Record<TenGodCode, string[]> = {
  식신: ['분석', '기획', '상담', '교육', '돌봄', '연구'],
  상관: ['창작', '기획', '강연', '디자인', '마케팅', '방송'],
  정재: ['관리', '회계', '운영', '실무', '제조', '품질'],
  편재: ['영업', '유통', '사업', '투자', '중개', '무역'],
  정관: ['행정', '공공', '관리', '법무', '인사', '조직'],
  편관: ['수사', '의료', '군경', '위기관리', '엔지니어링', '추진'],
  정인: ['교육', '연구', '돌봄', '상담', '학술', '행정'],
  편인: ['연구', '기획', '데이터', '전문기술', '의료', '예술'],
  비견: ['독립', '전문직', '프리랜서', '창업', '운동', '현장'],
  겁재: ['영업', '경쟁', '스타트업', '현장', '중개', '추진'],
};

/** 1차 목록을 보강 후보로 채워 정확히 3개로. 중복 제거. spec §2 key_strengths/weaknesses_easy = 3개. */
export function padToThree(primary: string[], fillers: string[]): string[] {
  const out: string[] = [];
  for (const item of [...primary, ...fillers]) {
    const t = item?.trim();
    if (t && !out.includes(t)) out.push(t);
    if (out.length === 3) break;
  }
  return out.slice(0, 3);
}
```

> 주: `StrengthLevel`/`TenGodCode` 는 `saju-data-v1.ts:57/44` export. import 경로 확인.

- [ ] **Step 4: 통과 확인**

Run: `npm run test:spec -- src/server/ai/total-review/total-review-content.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/server/ai/total-review/total-review-content.ts src/server/ai/total-review/total-review-content.test.ts
git commit -m "feat(total-review): add ganguk/career-fit maps + strength padding"
```

### Task 4: `buildTotalReviewInput` — `_easy` 도출 핵심

**Files:**
- Create: `src/server/ai/total-review/build-total-review-input.ts`
- Test: `src/server/ai/total-review/build-total-review-input.test.ts`

- [ ] **Step 1: 실패 테스트 작성** (few-shot 계미 케이스 = spec §5)

```typescript
import { describe, it, expect } from 'vitest';
import { buildTotalReviewInput } from './build-total-review-input';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { buildSajuPersonalizationContext } from '@/domain/saju/report/personalization-context';

// 1999-04-01 14:30 여 대전 → 계미 일주, 식신격, 신약, 용신 금 (spec §5 케이스)
function buildFixture() {
  const data = calculateSajuDataV1({
    /* birth: 1999-04-01 14:30, gender 'F' — 기존 calculateSajuDataV1 입력 형태로.
       Task 1 에서 saju-yearly-service.test 또는 build-narrative.test 의 fixture 생성법 확인해 동일하게. */
  } as never);
  const ctx = buildSajuPersonalizationContext(data, {
    relationshipStatus: 'married',
    occupation: 'employee',
    currentConcern: 'wealth',
    concernNote: null,
  });
  return { data, ctx };
}

describe('buildTotalReviewInput', () => {
  it('key_strengths_easy / key_weaknesses_easy 를 정확히 3개씩 만든다', () => {
    const { data, ctx } = buildFixture();
    const input = buildTotalReviewInput(data, ctx, { userName: '간지사주 테스트' });
    expect(input.wonkuk.key_strengths_easy).toHaveLength(3);
    expect(input.wonkuk.key_weaknesses_easy).toHaveLength(3);
  });

  it('어떤 _easy 필드에도 한자를 노출하지 않는다 (_internal 제외 — 본 객체엔 _internal 없음)', () => {
    const { data, ctx } = buildFixture();
    const input = buildTotalReviewInput(data, ctx, { userName: '테스트' });
    const json = JSON.stringify(input.wonkuk);
    expect(json).not.toMatch(/[一-鿿]/);
  });

  it('context 를 한글 라벨로 매핑한다 (married→기혼, employee→직장인, wealth→재물·투자)', () => {
    const { data, ctx } = buildFixture();
    const input = buildTotalReviewInput(data, ctx, {});
    expect(input.context.relationship_status).toBe('기혼');
    expect(input.context.occupation_status).toBe('직장인');
    expect(input.context.concern).toBe('재물·투자');
  });

  it('career_fit 을 격국 십성 기준으로 채운다 (식신격 → 분석 포함)', () => {
    const { data, ctx } = buildFixture();
    const input = buildTotalReviewInput(data, ctx, {});
    expect(input.wonkuk.kyeokguk_easy.career_fit.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test:spec -- src/server/ai/total-review/build-total-review-input.test.ts`
Expected: FAIL (module 없음)

- [ ] **Step 3: 구현**

핵심 도출 규칙(엔진 필드 → `_easy`):

```typescript
// 2026-05-21 — 원국 SajuDataV1/V2 + personalizationContext → 총평 LLM 입력 JSON.
//   _easy 필드를 모두 *미리* 도출해 LLM 이 추측/한자노출 하지 않도록 잠금. spec §2·§1-2.
import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import type { SajuPersonalizationContext } from '@/domain/saju/report/personalization-context';
import { MYEONGRI_GLOSSARY } from '@/lib/saju/terminology';
import { GANGUK_EASY, KYEOKGUK_CAREER_FIT, padToThree } from './total-review-content';
import type { TotalReviewInput, TotalReviewWonkuk } from './total-review-types';

// context enum → 한글 라벨 (personalization-context.ts 의 RELATIONSHIP/OCCUPATION/CONCERN_LABELS 재사용 권장.
//   현재 그 맵이 module-private 라면 export 로 승격하거나 동일 맵을 여기 정의.)
// CONCERN: wealth→'재물·투자', business→'사업·이직', romance→'결혼·연애', family→'자녀·가족', health→'건강·멘탈'.

export interface BuildTotalReviewInputOptions {
  userName?: string | null;
  gender?: 'M' | 'F' | null;
  currentAge?: number | null;
}

export function buildTotalReviewInput(
  data: SajuDataV1 | SajuDataV2,
  ctx: SajuPersonalizationContext,
  options: BuildTotalReviewInputOptions = {}
): TotalReviewInput {
  const wonkuk = buildWonkuk(data, ctx);
  return {
    user: {
      name: options.userName ?? null,
      gender: options.gender ?? null,
      current_age: options.currentAge ?? ctx.currentLuck.진행년수 ?? null,
    },
    context: buildContext(ctx),
    wonkuk,
    current_timeline: buildTimeline(data, ctx),
  };
}

function buildWonkuk(data: SajuDataV1 | SajuDataV2, ctx: SajuPersonalizationContext): TotalReviewWonkuk {
  const dm = data.dayMaster;
  const ilgan_easy = {
    label: ctx.sixtyGapja?.title ?? `${dm.element} 기운의 결`,
    detail: dm.description ?? '',
    metaphor: dm.metaphor ?? '',
  };
  const ilju_easy = {
    label: ctx.sixtyGapja?.title ?? '',
    detail: ctx.sixtyGapja?.core ?? '',
  };

  // 오행 분포 (한글 키 그대로)
  const ohaeng_balance = Object.fromEntries(
    (Object.entries(data.fiveElements.byElement) as [string, { count: number }][]).map(
      ([el, v]) => [el, v.count]
    )
  );
  const weakest = data.fiveElements.weakest;
  const ohaeng_lack_easy =
    data.fiveElements.byElement[weakest]?.count === 0 || data.fiveElements.byElement[weakest]?.state === 'missing' || data.fiveElements.byElement[weakest]?.state === 'weak'
      ? [{ element: weakest, label: glossaryLabel(weakest), meaning: ELEMENT_PLAIN_EFFECT_LOCAL[weakest] }]
      : [];
  // ohaeng_excess: dominant 가 과다(state==='strong')일 때만
  const dominant = data.fiveElements.dominant;
  const ohaeng_excess_easy =
    data.fiveElements.byElement[dominant]?.state === 'strong'
      ? [{ element: dominant, label: glossaryLabel(dominant), meaning: `${glossaryLabel(dominant)}이 과해 ${ELEMENT_PLAIN_EFFECT_LOCAL[dominant]} 힘이 한쪽으로 쏠리기 쉬워요.` }]
      : [];

  const ganguk_easy = data.strength ? GANGUK_EASY[data.strength.level] : { label: '', detail: '' };

  const yongsin_easy = {
    primary: {
      label: data.yongsin?.primary?.label ?? '',
      meaning: data.yongsin?.plainSummary ?? data.yongsin?.candidates?.[0]?.plainSummary ?? '',
    },
    secondary: data.yongsin?.secondary?.[0]
      ? { label: data.yongsin.secondary[0].label, meaning: '' }
      : null,
  };

  const tenGod = data.pattern?.tenGod ?? null;
  const kyeokguk_easy = {
    label: data.pattern?.name ?? '',
    detail: tenGod ? (MYEONGRI_GLOSSARY[tenGod]?.plainCue ?? '') : '',
    career_fit: tenGod ? (KYEOKGUK_CAREER_FIT[tenGod] ?? []) : [],
  };

  // 강점 3 = sixtyGapja.strengths + (격국 plainCue 요약, dominant 오행 plainCue) 패딩
  const strengthFillers = [
    tenGod ? MYEONGRI_GLOSSARY[tenGod]?.plainCue?.split('—')[0]?.trim() : null,
    `${glossaryLabel(dominant)}을 잘 쓰는 감각`,
  ].filter((s): s is string => Boolean(s));
  const key_strengths_easy = padToThree(ctx.sixtyGapja?.strengths ?? [], strengthFillers);

  // 약점 3 = sixtyGapja.watchPoints + (부족 오행 결핍, 강약 caution) 패딩
  const weaknessFillers = [
    weakest ? `${glossaryLabel(weakest)}—${ELEMENT_PLAIN_EFFECT_LOCAL[weakest]} 힘—이 부족해 그 자리에서 흔들리기 쉬움` : null,
    data.strength?.level === '신약' ? '너무 많은 일·사람에 둘러싸이면 본인 페이스를 잃기 쉬움' : null,
    data.strength?.level === '신강' ? '주관이 강해 주변과 속도를 맞추는 자리에서 마찰이 생기기 쉬움' : null,
  ].filter((s): s is string => Boolean(s));
  const key_weaknesses_easy = padToThree(ctx.sixtyGapja?.watchPoints ?? [], weaknessFillers);

  return {
    ilgan_easy, ilju_easy, ohaeng_balance, ohaeng_lack_easy, ohaeng_excess_easy,
    ganguk_easy, yongsin_easy, kyeokguk_easy, key_strengths_easy, key_weaknesses_easy,
  };
}

// glossary 의 element plainCue 에서 라벨 부분만 ('금: 기준·결단·마무리...' → '금 기운')
function glossaryLabel(element: string): string {
  return `${element} 기운`;
}

// saju-data-v1 의 ELEMENT_PLAIN_EFFECT 가 module-private 이므로 동일 값 로컬 정의 (또는 그 파일에서 export 승격).
const ELEMENT_PLAIN_EFFECT_LOCAL: Record<string, string> = {
  목: '막힌 흐름을 틔우고 새 방향을 세우는',
  화: '차가운 기운을 데우고 표현력을 살리는',
  토: '흩어진 기운을 붙잡아 현실감과 안정감을 만드는',
  금: '복잡한 흐름을 정리하고 기준을 세우는',
  수: '과열된 흐름을 식히고 생각을 깊게 만드는',
};
```

> **구현 노트:**
> - `RELATIONSHIP_LABELS`/`OCCUPATION_LABELS`/`CONCERN_LABELS`(personalization-context.ts:195-216)는 현재 module-private. **그 파일에서 `export` 로 승격**해 `buildContext` 가 재사용(DRY). CONCERN 은 spec 이 "재물·투자"(가운뎃점) 인데 기존 맵은 "재물/투자"(슬래시) — spec 톤에 맞춰 `·` 버전 별도 맵 필요할 수 있음. Task 4 에서 확인 후 결정.
> - `ELEMENT_PLAIN_EFFECT`(saju-data-v1.ts:99)도 `export` 승격이 로컬 복제보다 DRY. 승격 가능하면 승격, 아니면 로컬.
> - `buildContext`/`buildTimeline` 은 같은 파일 내 helper 로 작성(생략 없이 구현).

- [ ] **Step 4: 통과 확인**

Run: `npm run test:spec -- src/server/ai/total-review/build-total-review-input.test.ts`
Expected: PASS (4 tests). FAIL 시 fixture 생성법(`calculateSajuDataV1` 입력) 을 sibling 테스트에서 재확인.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(total-review): derive _easy input JSON from saju engine output"
```

---

## Phase 2 — 프롬프트 + 섹션 생성기

### Task 5: 총평 프롬프트 자산 (system + 3 user message + few-shot)

**Files:**
- Create: `src/server/ai/total-review/total-review-prompts.ts`
- Test: `src/server/ai/total-review/total-review-prompts.test.ts`

- [ ] **Step 1: 실패 테스트**

```typescript
import { describe, it, expect } from 'vitest';
import { TOTAL_REVIEW_SYSTEM_PROMPT, buildSectionUserMessage } from './total-review-prompts';
import type { TotalReviewInput } from './total-review-types';

const INPUT = { /* spec §2 의 계미 케이스 JSON 축약 — 실제 객체 */ } as TotalReviewInput;

describe('TOTAL_REVIEW_SYSTEM_PROMPT', () => {
  it('평생 톤 규칙과 일일 톤 금지를 포함한다', () => {
    expect(TOTAL_REVIEW_SYSTEM_PROMPT).toContain('평생');
    expect(TOTAL_REVIEW_SYSTEM_PROMPT).toContain('날입니다');  // 금지 예시로 등장
  });
  it('한자/명리어 금지 규칙을 포함한다', () => {
    expect(TOTAL_REVIEW_SYSTEM_PROMPT).toContain('한자');
    expect(TOTAL_REVIEW_SYSTEM_PROMPT).toContain('식신격');  // 금지 용어 목록
  });
});
describe('buildSectionUserMessage', () => {
  it('one_line_summary 섹션은 20~35자 요건을 명시한다', () => {
    const msg = buildSectionUserMessage('one_line_summary', INPUT);
    expect(msg).toContain('20~35');
    expect(msg).toContain(JSON.stringify(INPUT.wonkuk.ilgan_easy.label));
  });
  it('main_narrative 섹션은 4단락 의미 역할을 명시한다', () => {
    const msg = buildSectionUserMessage('main_narrative', INPUT);
    expect(msg).toContain('단락 1');
    expect(msg).toContain('단락 4');
  });
});
```

- [ ] **Step 2: 실패 확인** → Run 후 module 없음 FAIL

- [ ] **Step 3: 구현** — `TOTAL_REVIEW_SYSTEM_PROMPT` 는 spec §3 텍스트 *그대로*, `buildSectionUserMessage(sectionId, input)` 는 spec §4-1/4-2/4-3 의 지시문 + `JSON.stringify(input, null, 2)` 주입. few-shot(`TOTAL_REVIEW_FEW_SHOT`)은 spec §5-3 의 AFTER JSON 을 섹션별로 잘라 main_narrative 호출 앞에 부착.

```typescript
// 2026-05-21 — 총평 system prompt + 섹션별 user message. saju-total-review-llm-spec.md §3·§4·§5.
import type { TotalReviewInput, TotalReviewSectionId } from './total-review-types';

export const TOTAL_REVIEW_SYSTEM_PROMPT = `당신은 친근하고 차분한 명리 해설가입니다. 사용자의 사주 *총평*을 쓰는 일이며, 이 글은 *평생 적용되는 본질*에 대한 풀이입니다. 오늘이나 이번 주의 흐름이 아닙니다.

[절대 규칙 — 한 번이라도 어기면 출력 폐기]
1. 한자(漢字)는 본문에 한 글자도 노출하지 않는다. _internal 필드의 값은 절대 본문에 쓰지 않는다.
2. 다음 사주 전문 용어는 본문에 쓰지 않는다: 천간, 지지, 일간, 일주, 월주, 시주, 연주, 시지, 월지, 연지, 격국, 식신격, 정인격, 편관격 등 모든 격국명, 용신, 신강, 신약, 강약, 대운, 세운, 월운, 일진, 비견, 겁재, 식신, 상관, 편재, 정재, 편관, 정관, 편인, 정인, 합, 충, 형, 파, 해, 원진, 공망, 신살, 양인, 도화, 역마, 화개, 12운성(장생/목욕/관대/건록/제왕/쇠/병/사/묘/절/태/양). 대신 입력 JSON 의 _easy 필드 일상어를 사용.
3. "결" 단어: 한 줄 요약 최대 1회 / 단락당 최대 2회 / 카드당 최대 1회. 대신 "흐름·기운·성향·리듬·분위기".
4. 시제: ❌ "~날입니다"·"오늘은~"·"이번 주~" / ⭕ "~사주예요"·"~성향입니다"·"평생~"·"본인 결이~". 단락 4 에서만 "이번 10년/올해/지금 시기" 허용(일일 톤은 여전히 금지).
5. 사용자 이름: 본문 전체 최대 2회, 성 빼고 이름+"님", 한 단락 1회 이하.
6. 컨텍스트 반영: 단락 2 에 직업·환경, 단락 4 에 관계 상태+고민 영역을 자연스럽게. 어색하게 끌어붙이지 말 것.
7. 길이: 한 줄 요약 20~35자 / 단락 각 5~8문장 / 본문 총 25~35문장 / 한 문장 60자 안팎(최대 90) / 카드 제목 8자·부제 20자·본문 1~2문장.
8. 금지 표현: 대박·비책·암흑기·텅장·꿀팁 등 자극·속어 / 반드시·절대·확실히 등 단정 / 괜찮을 거예요·잘 될 거예요 등 막연한 위로 / 막연한 인생 조언. 반드시 사주 데이터에서 도출된 구체 행동/관찰.

[구조] 각 단락: 첫 문장 단정 결론 → 중간 일상어 비유/풀이 → 마지막 구체 관찰/행동.
[톤] 친근한 구어체(~예요/~죠/~세요), 단정형(~다) 회피. 따뜻하지만 단호. 점쟁이 톤 금지. 비유는 일상(물·햇살·흙·강물·씨앗).
[출력] 지정 JSON 스키마만. 다른 텍스트 금지.`;

const SECTION_INSTRUCTIONS: Record<TotalReviewSectionId, string> = {
  one_line_summary: `입력 JSON 을 참고해 이 사주의 *평생 본질*을 한 문장으로 요약하세요.
- 20~35자 / 평생 톤("~날입니다"·"오늘은~" 금지)
- 일주 본질(ilgan_easy.label, ilju_easy.label) + 핵심 강약/보완 흐름을 한 문장으로
- 시그니처 키워드 1개("기준"·"흐름"·"조용함"·"관찰") 자연 포함
[좋은 예] "조용히 살피고 흐르는 사주, 단단한 기준 하나가 평생을 받쳐줍니다"
출력은 다음 JSON만: { "one_line_summary": "..." }`,
  main_narrative: `입력 JSON 을 참고해 *평생 본질*을 4단락 narrative 로. 단락 간 내용 중복 금지.
## 단락 1 — 이 사람은 어떤 사람인가 (5~8문장): ilgan_easy + ilju_easy + ganguk_easy. 첫 문장 단정 결론, 일주 본질을 자연 비유로, 강점1(key_strengths_easy[0]) + 약점1(key_weaknesses_easy 中 1), 마지막 "다만…"으로 단락2 연결.
## 단락 2 — 어떤 환경에서 잘 살아나는가 (5~8문장): kyeokguk_easy(career_fit) + key_strengths_easy + context.occupation_status + relationship_status. "직장인으로 일하시는 지금도…" 식 매핑, 1:1/작은그룹/큰모임 적합, 관계 상태 한 줄.
## 단락 3 — 어디서 무너지기 쉬운가 (5~8문장): key_weaknesses_easy 中 2개(단락1 중복 제외) + ohaeng_lack_easy. "이게 누적되면…" 반복 패턴 결과. 일반 경고("조심하세요") 금지 — 어떤 자리에서 어떤 방식인지 구체.
## 단락 4 — 지금 시기에 어떻게 (5~8문장): current_timeline.daewoon.meaning_easy + yongsin_easy + context.concern + relationship_status. 고민 직접 언급+보강 흐름 연결, 보강을 구체 행동 1~2개로, 관계 상태 한 줄, 마지막 평생 원칙 1개.
출력은 다음 JSON만: { "main_narrative": { "paragraph_1_who_you_are": "...", "paragraph_2_strong_environment": "...", "paragraph_3_weak_zone": "...", "paragraph_4_now": "..." } }`,
  lifetime_keys: `입력 JSON 을 참고해 *평생 활용 핵심 3가지*를 카드로. 바로 행동에 옮길 구체 가이드.
[카드1 강한 환경] 제목 8자내 / 부제 20자내 / 본문 1~2문장: kyeokguk_easy.career_fit + key_strengths_easy.
[카드2 약한 자리] : key_weaknesses_easy 中 최대 약점 + 구체 행동 1개.
[카드3 핵심 활용법] : yongsin_easy.primary.meaning 을 행동으로.
[금지] 막연한 조언/일반론. 반드시 이 사주 데이터 고유.
출력은 다음 JSON만: { "lifetime_keys": [ {"title":"...","subtitle":"...","body":"..."}, {...}, {...} ] }`,
};

export function buildSectionUserMessage(sectionId: TotalReviewSectionId, input: TotalReviewInput): string {
  return [
    SECTION_INSTRUCTIONS[sectionId],
    '',
    '## 입력 JSON',
    JSON.stringify(input, null, 2),
  ].join('\n');
}
```

- [ ] **Step 4: 통과 확인** → PASS (4 tests)
- [ ] **Step 5: Commit** `feat(total-review): add system prompt + per-section user messages`

### Task 6: 섹션 생성 오케스트레이터 (`generate-chapter` 패턴)

**Files:**
- Create: `src/server/ai/total-review/generate-total-review.ts`
- Test: `src/server/ai/total-review/generate-total-review.test.ts`

`generate-chapter.ts` 의 `ChapterLLMClient` DI + generate→validate→retry→fallback 패턴을 총평용으로. 단 출력이 *섹션별 JSON* 이므로 파싱 분기 필요. `generateAiText` 는 `json_schema_body`가 `{body:string}` 고정이라 — 총평 3섹션은 각기 다른 스키마이므로 **`responseFormat: {type:'text'}`(자유 텍스트)로 받고 JSON.parse** 하거나, 섹션별 schema 를 `openai-text.ts` 에 추가. **결정: 자유 텍스트 + 견고한 JSON 파서**(스코프 최소화, openai-text 미변경).

- [ ] **Step 1: 실패 테스트** — mock client 로 (a) 유효 JSON 통과, (b) 검증 fail 시 retry, (c) max 초과 시 fallback.

```typescript
import { describe, it, expect } from 'vitest';
import { generateTotalReviewSection } from './generate-total-review';
import type { TotalReviewSectionId } from './total-review-types';

const goodOneLine = JSON.stringify({ one_line_summary: '조용히 살피고 흐르는 사주, 단단한 기준 하나가 평생을 받쳐줍니다' });
function clientReturning(text: string) {
  return { generate: async () => text };
}

describe('generateTotalReviewSection', () => {
  it('유효 JSON + 검증 통과 시 파싱 결과를 반환한다', async () => {
    const r = await generateTotalReviewSection('one_line_summary', { /* input */ } as never, clientReturning(goodOneLine));
    expect(r.source).toBe('llm');
    expect(r.value).toMatchObject({ one_line_summary: expect.any(String) });
  });
  it('한자 누출 시 retry 후에도 실패하면 fallback', async () => {
    const bad = JSON.stringify({ one_line_summary: '癸未 일주의 사주입니다' });
    const r = await generateTotalReviewSection('one_line_summary', { /* input */ } as never, clientReturning(bad), { maxRetries: 1, fallback: { one_line_summary: 'FB' } });
    expect(r.source).toBe('fallback');
  });
});
```

- [ ] **Step 2~4:** 실패 확인 → 구현(`buildSectionUserMessage` + `TOTAL_REVIEW_SYSTEM_PROMPT` + `client.generate` + `JSON.parse` + `validateTotalReviewSection`(Task 7) + retry/fallback, `ChapterLLMClient` 재사용) → 통과.
- [ ] **Step 5: Commit** `feat(total-review): section generator with validate+retry+fallback`

---

## Phase 3 — 검증

### Task 7: `validateTotalReview` (spec §7 10항목, chapter-validator 재사용)

**Files:**
- Create: `src/lib/saju/total-review-validator.ts`
- Test: `src/lib/saju/total-review-validator.test.ts`

spec §7 의 `validateTotalReview` 를 구현하되, `chapter-validator.ts` 의 기존 자산을 재사용(DRY): 한자 검사(`HANJA_PATTERN` 동등), `FORBIDDEN_ABSOLUTE_PHRASES`. 총평 고유 추가: ① 일일 톤(`/오늘은/`, `/이번 주/`, `/[가-힣]+ 날입니다/`), ② 컨텍스트 반영(단락2 직업, 단락4 고민), ③ 단락 간 동일 문장, ④ 문장 수 25~35, ⑤ 이름 호명 ≤2, ⑥ 금지 명리어(총평 목록), ⑦ "결" 빈도(요약1/단락2/카드1), ⑧ lifetime_keys 길이=3.

- [ ] **Step 1: 실패 테스트** — spec §5-3 AFTER 출력을 넣으면 `{ok:true}`, BEFORE(§5-2: 한자·"오늘은")를 넣으면 `ok:false` + 해당 reason.

```typescript
import { describe, it, expect } from 'vitest';
import { validateTotalReview } from './total-review-validator';

const GOOD = { /* spec §5-3 AFTER 객체 그대로 */ } as never;

describe('validateTotalReview', () => {
  it('모범 답안(spec AFTER)은 통과한다', () => {
    expect(validateTotalReview(GOOD, { occupationStatus: '직장인', concern: '재물·투자' }).ok).toBe(true);
  });
  it('한자가 있으면 실패', () => {
    const bad = structuredClone(GOOD); bad.one_line_summary = '癸未 사주';
    expect(validateTotalReview(bad, {}).ok).toBe(false);
  });
  it('일일 톤("오늘은")이 있으면 실패', () => {
    const bad = structuredClone(GOOD); bad.main_narrative.paragraph_1_who_you_are += ' 오늘은 무리하지 마세요.';
    const r = validateTotalReview(bad, {});
    expect(r.reasons.some((x) => x.includes('일일 톤'))).toBe(true);
  });
  it('단락2에 직업 컨텍스트 미반영 시 실패', () => {
    const bad = structuredClone(GOOD); bad.main_narrative.paragraph_2_strong_environment = '환경 이야기.';
    expect(validateTotalReview(bad, { occupationStatus: '직장인' }).ok).toBe(false);
  });
});
```

- [ ] **Step 2~4:** 실패 → 구현(spec §7 코드 이식 + chapter-validator 상수 import) → 통과.
- [ ] **Step 5: Commit** `feat(total-review): validateTotalReview (10 checks, reuse chapter-validator)`

---

## Phase 4 — 서비스 + 캐시 + 게이팅

### Task 8: 캐시 키 + env 플래그

**Files:**
- Create: `src/server/ai/total-review/total-review-cache.ts`
- Test: `src/server/ai/total-review/total-review-cache.test.ts`

`chapter-cache.ts` 패턴 복제: `buildTotalReviewCacheKey(sajuData, context)`(birth+gender+context_hash, spec §8), `isTotalReviewCacheFresh`, `isTotalReviewLLMEnabled(env)`(`OPENAI_INTERPRET_TOTAL_REVIEW==='1'`).

- [ ] **Step 1~5:** 테스트(같은 사주+컨텍스트=같은 키, 컨텍스트 변경 시 키 변경, 플래그 OFF 기본) → 구현 → commit.

### Task 9: `saju-total-review-service.ts` (진입점)

**Files:**
- Create: `src/server/ai/saju-total-review-service.ts`
- Test: `src/server/ai/saju-total-review-service.test.ts`

`saju-yearly-service.ts`(Task1 확인) analog: 입력 빌드 → 3섹션 **`Promise.all` 병렬**(spec §8) → 각 섹션 generate+validate → 합쳐 `validateTotalReview` 전체 재검증 → 통과 시 캐시 envelope upsert + 반환. **플래그 OFF 또는 LLM 실패 시 `buildSajuNarrative` 기반 deterministic fallback** 으로 동일 출력 형태 구성(headline→one_line_summary, body→단락 분할 X 대신 단일 단락, lifetime_keys 빈 배열). 반환 타입:

```typescript
export interface TotalReviewResult {
  source: 'llm' | 'cache' | 'fallback';
  output: TotalReviewOutput;       // fallback 시 deterministic 변환
  meta: { generatedAt: string; cacheKey: string; modelVersion: string };
}
```

- [ ] **Step 1: 실패 테스트** — 플래그 OFF 시 `source:'fallback'` + 기존 narrative headline 이 one_line_summary 에. mock client 주입 가능 구조.
- [ ] **Step 2~4:** 실패 → 구현 → 통과.
- [ ] **Step 5: Commit** `feat(total-review): orchestration service with parallel sections + cache + flag`

---

## Phase 5 — 프론트엔드 통합

### Task 10: 4단락 narrative 컴포넌트

**Files:**
- Create: `src/components/saju/saju-total-review-narrative.tsx`
- Test: (스냅샷 대신) `src/components/saju/saju-total-review-narrative.test.tsx` — 4단락 라벨("당신은 어떤 사람인가"/"잘 살아나는 환경"/"조심할 자리"/"지금 시기 핵심", spec §9-2) 렌더 확인.

- [ ] **Step 1~5:** 테스트 → 구현(props: `{ summary: string; narrative: TotalReviewNarrative }`. 단락 사이 구분선 + 라벨. SajuNarrativeCard 스타일 토큰 재사용) → 통과 → commit.

### Task 11: 평생 활용 3카드 컴포넌트

**Files:**
- Create: `src/components/saju/saju-lifetime-keys-section.tsx`
- Test: `src/components/saju/saju-lifetime-keys-section.test.tsx`

- [ ] **Step 1~5:** props `{ keys: TotalReviewLifetimeKey[] }`. 3카드(제목 큰글씨/부제 회색/본문). 색상: 강한환경=그린, 약한자리=오렌지, 핵심활용법=핑크(spec §9-2, 사이트 토큰). 빈 배열이면 null. → commit.

### Task 12: `page.tsx` 통합 (플래그 뒤)

**Files:**
- Modify: `src/app/saju/[slug]/page.tsx:300-420`

**Step 0 (필수): Phase 0 Task1 Step3 의 Next.js 16 가이드 확인 완료 상태에서 진행.**

- [ ] **Step 1:** `page.tsx` 가 server component 이므로 `saju-total-review-service` 직접 await. 플래그 ON + LLM 성공 → `<SajuTotalReviewNarrative>` + `<SajuLifetimeKeysSection>` 렌더(기존 `<SajuNarrativeCard>` 대체). 플래그 OFF/fallback → 기존 `<SajuNarrativeCard>` 유지. `<SituationReflectionCard>`·8글자 카드·기존 chips 는 **유지**(spec §9-1).
- [ ] **Step 2:** `npm run typecheck` PASS.
- [ ] **Step 3: 브라우저 검증** — `npm run dev`, 플래그 OFF 로 기존 총평 회귀 없음 확인(preview_screenshot). 그 후 `.env.local` 에 `OPENAI_INTERPRET_TOTAL_REVIEW=1` 설정하고 LLM 출력 렌더(4단락+3카드) 확인. console/network 에러 0.
- [ ] **Step 4: Commit** `feat(total-review): wire LLM total review into result page behind flag`

---

## Phase 6 — 통합 체크리스트 + 검증

### Task 13: spec §10 체크리스트 + verification-prompts 검증

- [ ] **Step 1:** spec §10 10항목 점검 (입력 _easy 충족 / _internal 미주입 / 8규칙 명시 / 3섹션 병렬 / 검증 10항목 / 재생성 로직 / 캐시 키 컨텍스트 / BEFORE-AFTER 스테이징 비교 / 5개 사주 일반화 / 일반인 1명 읽기).
- [ ] **Step 2:** `verification-prompts.md` — 검증1(회귀: 다른 페이지/탭 깨짐 없음, e2e), 검증2(한자/명리어 잔존: validator 자동), 검증4-B(4단락 중복 0건), 검증4-C(일일톤 누출/컨텍스트 반영/"결" 빈도) — **4-C 컨텍스트 반영이 최우선 통과 기준**.
- [ ] **Step 3:** 5개 다른 사주 케이스 fixture 로 `validateTotalReview` 일반화 테스트(spec §5 verification 5).
- [ ] **Step 4:** `npm run test:spec` 전체 + `npm run typecheck` + `npm run build` PASS.
- [ ] **Step 5: Commit** `test(total-review): generalization + verification across 5 saju cases`

---

## Self-Review (against spec)

**1. Spec coverage:**
- §1 원칙(평생톤/4단락 의미분리/컨텍스트) → Task5 system prompt + Task7 validator(일일톤·컨텍스트). ✓
- §2 입력 스키마 → Task2 types + Task4 builder. ✓ (`_internal` 은 입력 객체에 미포함 = 본문 누출 원천 차단)
- §3 system prompt 8규칙 → Task5. ✓
- §4 3섹션 분리 호출 → Task5 user messages + Task6 generator + Task9 Promise.all. ✓
- §5 few-shot → Task5 `TOTAL_REVIEW_FEW_SHOT` + Task7/13 GOOD fixture. ✓
- §6 출력 스키마 → Task2 types(JSON Schema 강제는 자유텍스트+파서+validator 로 대체 — 구현노트 명시). ✓
- §7 검증 10항목 → Task7. ✓
- §8 호출패턴/캐시 → Task8 cache + Task9 Promise.all. ✓
- §9 통합 가이드(유지/교체 영역, FE/BE 변경) → Task10/11/12. ✓
- §10 체크리스트 → Task13. ✓
- §11 점수 시스템 → **범위 밖**(Scope Check 에 별도 plan 명시). ✓

**2. Placeholder scan:** Task6/7/9 의 일부 step 이 "구현" 으로 압축됨 — 단, 각 step 에 입력 소스/패턴/반환 타입을 구체 명시. 실행 시 sibling(`generate-chapter.ts`/`saju-yearly-service.ts`) 의 실제 시그니처 확인이 Task1 에 선행 배치됨. fixture 의 `calculateSajuDataV1` 입력 형태는 Task1·Task4 에서 sibling 테스트로 확정.

**3. Type consistency:** `TotalReviewInput`/`TotalReviewOutput`/`TotalReviewSectionId`(Task2) 가 Task4·5·6·7·9·10·11 에서 일관 사용. `ChapterLLMClient`(generate-chapter.ts) 재사용으로 client 시그니처 일치.

---

## 핵심 결정 (실행 전 합의 포인트)

1. **무중단 게이팅**: `OPENAI_INTERPRET_TOTAL_REVIEW` default OFF → 기존 결정론 출력 유지. (챕터 파이프라인 `OPENAI_INTERPRET_CHAPTERS` 컨벤션과 동일)
2. **강점/약점 3개**: `sixtyGapja`(2개/1개) + 격국·부족오행·강약 패딩. (JSON 만으론 부족)
3. **JSON 강제**: `openai-text.ts` 미변경, 섹션별 자유텍스트+파서+validator. (스코프 최소화)
4. **출력 형태**: 4단락+3카드 신규 컴포넌트, 8글자카드/SituationReflectionCard/chips 유지.

# Phase 0a — 대운 본편(lifetime final) 캐시 작업 지시서

> 가오픈 전 *비용 출혈 차단* 작업 1차.
>
> 배경: `audit-reports/2026-05-25-llm-cost-structure.md` §5 후보 1번 — *"대운 본편이 어떤 캐시에도 저장되지 않음"* (cacheable: false). 매 요청마다 LLM 재호출 → 생성당 ≈ $0.094.
>
> 출력: `audit-reports/2026-05-XX-phase-0a-lifetime-cache-report.md`

---

## 0. 작업 배경 및 결정 사항

### 0-1. 발견된 문제

- `saju-lifetime-service.ts:227-233` 본편 풀이 콜이 `cacheable: false` (L99, L259)
- 챕터(ch1~7,9)는 `readings.result_json` envelope에 캐시되지만 *본편은 매 요청마다 cold*
- 비용 영향: 평생소장권 사용자가 리포트 *여러 번 열 때마다* 중복 과금
- 마케팅 시작 시 *DAU 1만 + 대운 트리거 3% + hit 0% (캐시 없음)* = 일 $28~$120 출혈 잠재

### 0-2. 사용자 결정 사항

| 결정 | 값 |
|------|----|
| 캐시 저장 위치 | **옵션 ② — 신규 테이블 `ai_lifetime_interpretations`** |
| 캐시 키 구성 | **컨텍스트 포함 (total-review 패턴 복제)** |
| TTL | 30일 |
| 비로그인 사용자 캐시 | 가능 (content-addressed) |
| 패턴 복제 대상 | `ai_total_review_interpretations` |

### 0-3. 비목표

- ❌ Phase 0b (LLM telemetry 시드) — 별도 PR로 분리
- ❌ 기본 사주풀이 비로그인 캐시 — LLM 비용 보고서 §5 후보 2, 별도 작업
- ❌ 챕터 캐시 envelope 구조 변경 — 본편만 다룸
- ❌ 본편 *프롬프트·풀이 본문* 변경 (캐시 인프라만)
- ❌ 어드민 캐시 관리 UI — Phase 1에서

---

## 1. 산출물 — 6개 영역

```
신규 파일:
├── supabase/migrations/0XX_ai_lifetime_interpretations.sql   # 테이블 + RLS + 인덱스
├── src/server/ai/lifetime/lifetime-interpretation-cache.ts   # 캐시 키 생성 + cache_key SHA256
└── src/server/ai/lifetime/lifetime-cache-store.ts            # read-through 함수

수정 파일:
├── src/server/ai/saju-lifetime-service.ts                    # 본편 콜에 read-through 적용
└── src/server/ai/lifetime/__tests__/lifetime-cache.test.ts   # 단위 테스트 (신규)

선택 보강:
└── src/server/ai/lifetime/lifetime-cache-validator.ts        # 캐시 유효성 검증 (필요 시)
```

---

## 2. 사전 조사 (필수, 작업 전)

### 2-1. 패턴 복제 대상 파악

```bash
echo "=== ai_total_review_interpretations 마이그레이션 ==="
ls supabase/migrations/ | xargs -I {} grep -l "ai_total_review_interpretations" supabase/migrations/{}

echo ""
echo "=== total-review-cache.ts (캐시 키 생성 패턴) ==="
cat src/server/ai/total-review/total-review-cache.ts 2>/dev/null | head -80

echo ""
echo "=== total-review-cache-store.ts (read-through 패턴) ==="
cat src/server/ai/total-review/total-review-cache-store.ts 2>/dev/null | head -100
```

이 두 파일의 패턴을 *그대로 복제*합니다. 차이점:
- 테이블 이름: `ai_lifetime_interpretations`
- 캐시 키 입력: 본편 입력 데이터 (사주 + counselor + 컨텍스트)
- 응답 타입: `LifetimeInterpretation` 등 본편 출력 타입

### 2-2. 본편 콜 위치 + 컨텍스트 사용 여부 확인

```bash
echo "=== saju-lifetime-service.ts 본편 콜 ==="
grep -n "generateAiText\|cacheable\|finalLifetime" src/server/ai/saju-lifetime-service.ts | head -20

echo ""
echo "=== 본편 프롬프트가 컨텍스트(관계/직업/고민)를 본문에 반영하는지 ==="
# 본편 프롬프트 파일 찾기 (추정)
find src/server/ai -name "*lifetime*prompt*" -o -name "*lifetime*system*" 2>/dev/null

# 컨텍스트 변수가 system prompt 또는 user message에 들어가는지
grep -rn "relationship\|occupation\|concern" src/server/ai/saju-lifetime-service.ts \
  src/server/ai/lifetime/ 2>/dev/null | head -10
```

**중요한 확인**: 본편 프롬프트가 사용자 컨텍스트(관계상태/직업/고민)를 *실제로 본문에 반영*하는지.

- **반영함** → 컨텍스트를 캐시 키에 *반드시 포함* (이번 결정)
- **반영 안 함** → 사주만으로 캐시 가능. 다만 *결정대로 포함*해서 안전 우선

**보고**: 사전 조사 결과를 보고서 §1에 정리. *예상 밖 상황* (예: 컨텍스트가 한 곳에서만 쓰임)이 발견되면 즉시 보고.

### 2-3. 기존 envelope 캐시(챕터)와의 관계

```bash
echo "=== chapter cache (대운 챕터 영역) ==="
grep -n "chaptersEnvelope\|chapter.*cache" src/server/ai/saju-lifetime-service.ts | head -10
```

**확인 사항**:
- 본편 캐시가 *챕터 envelope과 독립*적인가
- 챕터 입력(8개 챕터 결과)이 *본편 캐시 키에 영향*을 주는가

본편이 *챕터 출력을 입력으로 받는다*면 *챕터 cacheKey들의 해시*도 본편 키에 포함해야 일관성 유지. 코드 보고 결정.

---

## 3. Step 1 — 마이그레이션 (신규 테이블)

### 3-1. 파일

```sql
-- supabase/migrations/0XX_ai_lifetime_interpretations.sql
-- (XX는 다음 순번. 예: 042)

create table public.ai_lifetime_interpretations (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null,                     -- SHA256 hex
  prompt_version text not null,                -- 프롬프트 버전 (변경 시 무효화)

  -- 입력 메타 (조회·디버그용)
  saju_summary jsonb not null,                 -- {4기둥, 일간, gender}
  counselor_id text not null,
  context jsonb,                               -- {relationship_status, occupation_status, concern}

  -- 출력
  output jsonb not null,                       -- 본편 풀이 결과
  model text,                                  -- 사용된 모델 (예: gpt-5.2-chat-latest)
  source text not null,                        -- 'llm' | 'fallback'

  -- 토큰·비용 (선택, Phase 0b 통합 시 활용)
  input_tokens integer,
  output_tokens integer,
  cost_usd numeric(10, 6),

  -- 메타
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,             -- TTL 30일

  constraint ai_lifetime_interp_cache_key_version
    unique (cache_key, prompt_version)
);

-- 인덱스
create index ai_lifetime_interp_cache_lookup
  on public.ai_lifetime_interpretations (cache_key, prompt_version, expires_at);

create index ai_lifetime_interp_expires_at
  on public.ai_lifetime_interpretations (expires_at)
  where expires_at > now();

-- RLS
alter table public.ai_lifetime_interpretations enable row level security;

-- 어드민 + service_role만 접근 (사용자 직접 접근 불가)
create policy "ai_lifetime_interp_no_user_access"
  on public.ai_lifetime_interpretations
  for all
  using (false);

-- 청소 함수 (만료된 항목 삭제, 선택)
create or replace function cleanup_expired_ai_lifetime_interpretations()
returns void
language plpgsql
security definer
as $$
begin
  delete from public.ai_lifetime_interpretations
  where expires_at < now() - interval '7 days';
end;
$$;
```

### 3-2. 검증

```bash
# 로컬 supabase에 마이그레이션 적용
npx supabase db reset --linked false 2>&1 | tail -20

# 테이블 생성 확인
npx supabase db diff --linked false 2>&1 | grep "ai_lifetime_interpretations"
```

**보고**: 마이그레이션 번호, 테이블 컬럼 수, RLS 정책 수.

---

## 4. Step 2 — 캐시 키 생성 모듈

### 4-1. 파일

```typescript
// src/server/ai/lifetime/lifetime-interpretation-cache.ts

import { createHash } from 'crypto';

export interface LifetimeCacheKeyInput {
  // 사주 (필수)
  pillars: {
    year: string;    // ganji (예: "갑자")
    month: string;
    day: string;
    hour: string;
  };
  ilganStem: string;       // 일간 천간 (예: "갑")
  ilganElement: string;    // 일간 오행 (예: "목")
  gender: 'male' | 'female';

  // 상담사 (필수)
  counselorId: string;

  // 사용자 컨텍스트 (포함 — 결정 사항)
  context?: {
    relationshipStatus?: string;
    occupationStatus?: string;
    concern?: string;
  };

  // 챕터 입력 해시 (선택 — 사전 조사에서 결정)
  chaptersHash?: string;

  // 프롬프트 버전
  promptVersion: string;
}

/**
 * 본편 캐시 키 생성 (SHA256).
 * total-review-cache.ts 패턴 그대로 복제.
 */
export function buildLifetimeCacheKey(input: LifetimeCacheKeyInput): string {
  // 정규화된 직렬화 (순서 일관성 유지)
  const normalized = {
    p: input.pillars,
    ig: input.ilganStem,
    ie: input.ilganElement,
    g: input.gender,
    c: input.counselorId,
    ctx: input.context ? {
      rs: input.context.relationshipStatus ?? '',
      os: input.context.occupationStatus ?? '',
      cn: input.context.concern ?? '',
    } : null,
    ch: input.chaptersHash ?? null,
    pv: input.promptVersion,
  };

  const serialized = JSON.stringify(normalized);
  return createHash('sha256').update(serialized).digest('hex');
}

/**
 * 캐시 키 입력의 정합성 검증 (필수 필드 확인)
 */
export function validateLifetimeCacheKeyInput(input: LifetimeCacheKeyInput): void {
  if (!input.pillars?.year || !input.pillars?.month ||
      !input.pillars?.day || !input.pillars?.hour) {
    throw new Error('LifetimeCacheKey: pillars 4기둥 모두 필요');
  }
  if (!input.ilganStem || !input.ilganElement) {
    throw new Error('LifetimeCacheKey: 일간 stem/element 필요');
  }
  if (!input.counselorId) {
    throw new Error('LifetimeCacheKey: counselorId 필요');
  }
  if (!input.promptVersion) {
    throw new Error('LifetimeCacheKey: promptVersion 필요');
  }
}
```

### 4-2. 단위 테스트 (스켈레톤)

```typescript
// src/server/ai/lifetime/__tests__/lifetime-cache.test.ts

import { describe, it, expect } from 'vitest';  // 또는 node:test
import { buildLifetimeCacheKey } from '../lifetime-interpretation-cache';

describe('buildLifetimeCacheKey', () => {
  const baseInput = {
    pillars: { year: '갑자', month: '을축', day: '병인', hour: '정묘' },
    ilganStem: '병',
    ilganElement: '화',
    gender: 'male' as const,
    counselorId: 'default',
    promptVersion: 'v1',
  };

  it('같은 입력 → 같은 키', () => {
    const k1 = buildLifetimeCacheKey(baseInput);
    const k2 = buildLifetimeCacheKey(baseInput);
    expect(k1).toBe(k2);
  });

  it('사주가 다르면 다른 키', () => {
    const k1 = buildLifetimeCacheKey(baseInput);
    const k2 = buildLifetimeCacheKey({
      ...baseInput,
      pillars: { ...baseInput.pillars, year: '을축' },
    });
    expect(k1).not.toBe(k2);
  });

  it('counselor 다르면 다른 키', () => {
    const k1 = buildLifetimeCacheKey(baseInput);
    const k2 = buildLifetimeCacheKey({ ...baseInput, counselorId: 'other' });
    expect(k1).not.toBe(k2);
  });

  it('컨텍스트 포함 시 다른 키', () => {
    const k1 = buildLifetimeCacheKey(baseInput);
    const k2 = buildLifetimeCacheKey({
      ...baseInput,
      context: { relationshipStatus: '기혼', occupationStatus: '직장인' },
    });
    expect(k1).not.toBe(k2);
  });

  it('프롬프트 버전 다르면 다른 키 (무효화)', () => {
    const k1 = buildLifetimeCacheKey(baseInput);
    const k2 = buildLifetimeCacheKey({ ...baseInput, promptVersion: 'v2' });
    expect(k1).not.toBe(k2);
  });

  it('SHA256 16진수 64자', () => {
    const k = buildLifetimeCacheKey(baseInput);
    expect(k).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

---

## 5. Step 3 — 캐시 스토어 (read-through)

### 5-1. 파일

```typescript
// src/server/ai/lifetime/lifetime-cache-store.ts

import { createServiceClient } from '@/lib/supabase/service';
import type { LifetimeCacheKeyInput } from './lifetime-interpretation-cache';
import { buildLifetimeCacheKey, validateLifetimeCacheKeyInput } from './lifetime-interpretation-cache';

const TTL_DAYS = 30;
const TABLE = 'ai_lifetime_interpretations';

export interface LifetimeCacheReadResult<T> {
  hit: boolean;
  output?: T;
  cached?: {
    cacheKey: string;
    model: string | null;
    source: string;
    createdAt: string;
  };
}

/**
 * 캐시 조회. miss → null 또는 hit: false 반환.
 */
export async function readLifetimeCache<T>(
  keyInput: LifetimeCacheKeyInput
): Promise<LifetimeCacheReadResult<T>> {
  validateLifetimeCacheKeyInput(keyInput);
  const cacheKey = buildLifetimeCacheKey(keyInput);

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select('output, model, source, created_at, expires_at')
    .eq('cache_key', cacheKey)
    .eq('prompt_version', keyInput.promptVersion)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error('[lifetime-cache] read error:', error.message);
    return { hit: false };
  }
  if (!data) {
    return { hit: false };
  }

  return {
    hit: true,
    output: data.output as T,
    cached: {
      cacheKey,
      model: data.model,
      source: data.source,
      createdAt: data.created_at,
    },
  };
}

/**
 * 캐시 저장 (upsert by cache_key + prompt_version).
 * source가 'llm'일 때만 저장. fallback은 저장 안 함.
 */
export async function writeLifetimeCache<T>(
  keyInput: LifetimeCacheKeyInput,
  output: T,
  meta: {
    source: 'llm' | 'fallback';
    model?: string | null;
    inputTokens?: number;
    outputTokens?: number;
    costUsd?: number;
  }
): Promise<void> {
  if (meta.source !== 'llm') {
    return;  // fallback은 캐시 저장 안 함
  }

  validateLifetimeCacheKeyInput(keyInput);
  const cacheKey = buildLifetimeCacheKey(keyInput);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TTL_DAYS);

  const supabase = createServiceClient();
  const { error } = await supabase
    .from(TABLE)
    .upsert({
      cache_key: cacheKey,
      prompt_version: keyInput.promptVersion,
      saju_summary: {
        pillars: keyInput.pillars,
        ilgan_stem: keyInput.ilganStem,
        ilgan_element: keyInput.ilganElement,
        gender: keyInput.gender,
      },
      counselor_id: keyInput.counselorId,
      context: keyInput.context ?? null,
      output,
      model: meta.model ?? null,
      source: meta.source,
      input_tokens: meta.inputTokens ?? null,
      output_tokens: meta.outputTokens ?? null,
      cost_usd: meta.costUsd ?? null,
      expires_at: expiresAt.toISOString(),
    }, {
      onConflict: 'cache_key,prompt_version',
    });

  if (error) {
    console.error('[lifetime-cache] write error:', error.message);
    // 캐시 실패는 *비차단*. 로그만 남기고 함수 정상 반환.
  }
}
```

### 5-2. 단위 테스트 (스켈레톤 — Supabase 모킹 필요)

```typescript
// src/server/ai/lifetime/__tests__/lifetime-cache-store.test.ts
// (선택 — 통합 테스트 환경 있을 때만)
```

통합 테스트가 복잡하면 *단위 테스트는 캐시 키 생성*만 (Step 2 테스트), 스토어는 *수동 검증*으로 진행 가능.

---

## 6. Step 4 — `saju-lifetime-service.ts` 통합

### 6-1. 변경 전 코드 (예상)

```typescript
// saju-lifetime-service.ts L227-233 (추정)
const result = await generateAiText({
  ...,
  cacheable: false,  // ← 이 부분
});
```

### 6-2. 변경 후 코드

```typescript
import { readLifetimeCache, writeLifetimeCache } from './lifetime/lifetime-cache-store';

// 본편 생성 함수 안에서:

// 1. 캐시 키 입력 구성
const cacheKeyInput = {
  pillars: { /* 4기둥 ganji */ },
  ilganStem: /* ... */,
  ilganElement: /* ... */,
  gender: /* ... */,
  counselorId: /* ... */,
  context: {
    relationshipStatus: /* ... */,
    occupationStatus: /* ... */,
    concern: /* ... */,
  },
  promptVersion: LIFETIME_PROMPT_VERSION,  // 상수로 정의
};

// 2. 캐시 조회 (read-through)
const cached = await readLifetimeCache<LifetimeOutput>(cacheKeyInput);
if (cached.hit && cached.output) {
  return {
    output: cached.output,
    source: 'cache',
    model: cached.cached?.model,
    cached: true,
  };
}

// 3. miss → LLM 호출
const result = await generateAiText({
  ...,
  // cacheable 옵션 제거 또는 false 유지 (어차피 명시적 캐시 사용)
});

// 4. 결과 캐시 저장 (LLM 성공일 때만)
await writeLifetimeCache(cacheKeyInput, result.output, {
  source: result.source as 'llm' | 'fallback',
  model: result.model,
  inputTokens: result.inputTokens,
  outputTokens: result.outputTokens,
  costUsd: estimateLifetimeCostUsd(result.inputTokens, result.outputTokens),
});

return result;
```

### 6-3. `LIFETIME_PROMPT_VERSION` 상수

```typescript
// 동일 파일 또는 별도 constants 파일
export const LIFETIME_PROMPT_VERSION = '1.0.0';
// 프롬프트 시스템 메시지나 user message 구조가 *의미상* 바뀌면 버전 증가
// (예: 1.0.0 → 1.0.1 → 1.1.0)
// 버전 올리면 기존 캐시 자동 무효화 (cache_key + prompt_version unique)
```

---

## 7. Step 5 — 검증

### 7-1. 단위 테스트 실행

```bash
# 캐시 키 생성 테스트
npx vitest run src/server/ai/lifetime/__tests__ --reporter=verbose
# 또는 npm test (custom runner)

# 기존 테스트 무손상 확인
npm test 2>&1 | tail -30
# 기존 157+ 테스트 모두 통과
```

### 7-2. 통합 동작 검증 (수동)

```bash
# 1. 로컬 dev 실행
npm run dev

# 2. 같은 사주로 대운 본편 두 번 조회
# 첫 번째: source=llm 예상
# 두 번째: source=cache 예상

# 3. DB 확인
# Supabase Studio 또는 SQL로:
# SELECT cache_key, source, model, created_at FROM ai_lifetime_interpretations;
# → 1행 존재 확인

# 4. 컨텍스트 변경 후 재조회 → 새 캐시 행 생성 확인
```

### 7-3. Vercel 빌드 검증

```bash
npm run build 2>&1 | tail -20
# 0 errors
```

---

## 8. 수용 기준

배포 전 모두 통과:

- [ ] 마이그레이션 0XX_ai_lifetime_interpretations.sql 적용 성공
- [ ] 신규 테이블 `ai_lifetime_interpretations` 존재 + RLS 활성화
- [ ] `buildLifetimeCacheKey()` 단위 테스트 6개 통과
- [ ] `saju-lifetime-service.ts` read-through 통합 완료
- [ ] 같은 사주 두 번 조회 시 *두 번째는 cache hit* (수동 검증)
- [ ] 컨텍스트 다르면 *별도 캐시 행 생성*
- [ ] `prompt_version` 변경 시 캐시 무효화 동작
- [ ] 캐시 *write 실패*가 풀이 응답을 *차단하지 않음* (비차단 검증)
- [ ] fallback 응답은 *캐시 저장 안 됨*
- [ ] 기존 단위 테스트 무손상 (157+ 모두 통과)
- [ ] `npm run build` 0 errors

---

## 9. 자주 막힐 부분

### 9-1. 본편 콜이 *여러 곳에서* 호출되는 경우

`saju-lifetime-service.ts:227-233` 외에 *다른 진입점*이 있으면 *모두 캐시 적용* 필요.

```bash
# 본편 콜 진입점 전수 탐색
grep -rn "generateAiText" src/server/ai/lifetime/ src/server/ai/saju-lifetime-service.ts
```

발견된 *모든* 진입점에 캐시 적용.

### 9-2. `result_json` envelope에 본편이 *이미 부분적으로* 저장되어 있을 가능성

비용 보고서 §1-1이 *"본편 미캐시"*라고 했지만, *envelope에 일부 필드*가 있을 수도. 확인:

```bash
grep -n "lifetime\|finalReport" supabase/migrations/*readings*.sql 2>/dev/null
grep -rn "result_json.*lifetime\|chaptersEnvelope.*lifetime" src/server/ 2>/dev/null
```

만약 *부분 저장*되어 있으면:
- 신규 테이블과 *충돌 없도록* 양쪽 데이터 동기화 또는
- 신규 테이블이 *우선*, envelope는 *과도기 fallback*

이 경우 *작업 일정 영향* — 즉시 사용자 확인.

### 9-3. counselor_id가 *항상 존재*하지 않을 수도

비로그인 사용자나 기본값 사용자가 *counselor_id 없음*일 가능성.

**해결책**: 캐시 키에 `counselorId ?? 'default'` 로 fallback. 검증 함수에서 null 허용.

### 9-4. 본편 출력 타입이 *복잡한 객체*

`output jsonb` 저장 시 *직렬화 가능*해야 함. 함수·Date·undefined 들어가면 손실.

**확인**: 본편 출력에 `Date` 객체 또는 함수 참조가 있는지. 있다면 *직렬화 전에 변환*.

### 9-5. 마이그레이션 번호 충돌

```bash
ls supabase/migrations/ | tail -5
# 다음 번호 확인 (예: 041이 마지막이면 042로 신규 생성)
```

---

## 10. Claude Code 즉시 복사 프롬프트

```
ganji-saju Phase 0a — 대운 본편 캐시 구축을 진행해줘.

작업 지시서: docs/claude-specs/phase-0a-lifetime-cache.md
배경 보고서:
- audit-reports/2026-05-25-llm-cost-structure.md (§5 후보 1)
- audit-reports/2026-05-25-admin-inventory.md (§6)

[작업 범위]
A. 마이그레이션 — ai_lifetime_interpretations 테이블
B. 캐시 키 생성 모듈 (lifetime-interpretation-cache.ts)
C. read-through 스토어 (lifetime-cache-store.ts)
D. saju-lifetime-service.ts 통합 (본편 콜에 캐시 적용)
E. 단위 테스트 (캐시 키 생성 6개)
F. 수동 검증 (같은 사주 두 번 조회 → 두 번째 cache hit)

[비범위]
- Phase 0b (LLM telemetry 시드)
- 기본 사주풀이 캐시
- 챕터 envelope 캐시 변경
- 본편 프롬프트·풀이 본문 변경
- 어드민 캐시 관리 UI

[순서]
1. §2 사전 조사
   - total-review 패턴 복제 대상 파악
   - 본편 콜 위치 + 컨텍스트 사용 여부
   - 챕터 envelope과의 관계
   → 결과 보고 후 사용자 확인 받기
2. §3 Step 1 — 마이그레이션
3. §4 Step 2 — 캐시 키 생성 모듈
4. §5 Step 3 — read-through 스토어
5. §6 Step 4 — saju-lifetime-service.ts 통합
6. §7 Step 5 — 검증 (단위 테스트 + 수동 검증)

[원칙]
- total-review 패턴을 *그대로 복제* (창의성 금지)
- 본편 풀이 *내용 변경 절대 금지* (캐시 인프라만)
- 캐시 write 실패는 *비차단* (LLM 응답을 막지 않음)
- fallback 응답은 *캐시 저장 안 함*
- §9 자주 막힐 부분 발견 시 사용자에게 확인

[보고]
완료 시 audit-reports/2026-05-XX-phase-0a-lifetime-cache-report.md 작성 + 이 대화에:
1. 변경된 파일 목록
2. 마이그레이션 번호 + 테이블 컬럼 수
3. 단위 테스트 통과 (N/N)
4. 수동 검증 결과 (cache hit 동작 확인)
5. §8 수용 기준 11개 ✅/❌
6. PR 번호 + URL (브랜치 + PR, 머지 안 함)

[시작 전 확인]
1. pwd가 /Users/kionya/ganji-saju 인가
2. 직전 머지 (orphaned exports 청소 PR) 적용된 상태인가
3. audit-reports/ + supabase/migrations/ 쓰기 권한 OK

위 3개 확인 후 §2 사전 조사부터 시작.
```

---

## 11. 작업 완료 후 — Phase 0b 신호

Phase 0a 머지 후 Phase 0b(LLM telemetry 시드)로 진입.

Phase 0b 작업 지시서는 *Phase 0a 결과 보고* 받은 후 작성. Phase 0a에서 *컨텍스트 사용 여부, envelope 관계* 등이 명확해지면 Phase 0b 설계도 더 정확해짐.

---

## 12. 한 줄 요약

> **`ai_lifetime_interpretations` 신규 테이블 + total-review 패턴 복제 + read-through 캐시 + 컨텍스트 포함 SHA256 키 + 30일 TTL + 본편 콜 통합. 본편 풀이 내용은 절대 변경 금지.**

# Phase 0b — LLM 텔레메트리 시드 설계서

- 작성일: 2026-05-25
- 선행: Phase 0a(대운 본편 캐시, #377 머지) · 배경 `audit-reports/2026-05-25-admin-inventory.md` §6, `audit-reports/2026-05-25-llm-cost-structure.md` §6
- 브랜치: `feat/phase-0b-llm-telemetry`
- 산출 보고서: `audit-reports/2026-05-25-phase-0b-llm-telemetry-report.md`

## 0. 배경 / 목표

admin-inventory §6: **LLM 호출 비용 관측이 대운 챕터에만 존재**(`chapter_run` console.log). 기본풀이·총평·올해·궁합·본편·AI챗·홈배너는 `openai-text.ts`가 `usage`(토큰)를 추출하고도 **폐기** → 토큰/비용/호출량 조회 불가.

목표: **전 LLM 호출**의 `feature·model·토큰·비용·지연·source`를 **console.log(즉시 grep) + DB(SQL/일별 집계)** 양쪽에 기록. 코드/풀이 내용 변경 없음(계측만).

## 1. 핵심 결정 (확정)

| 항목 | 결정 |
|------|------|
| 저장 | **console.log + DB 둘 다** |
| 계측 지점 | **중앙 1지점 — `generateAiText`**(모든 영역이 경유) |
| 챕터 | **`ai_llm_runs`에 포함**(전 영역 단일 DB 소스). 기존 `chapter_run` console 로그는 유지 |
| DB 쓰기 | **`await` + try/catch no-op**(서버리스 flush 보장, 응답 비차단) |
| 캐시 hit | **미기록**(generateAiText를 안 타므로) — `ai_llm_runs`는 *실제 LLM 호출=비용 이벤트*만 |

## 2. 아키텍처

모든 LLM 호출이 `src/server/ai/openai-text.ts`의 `generateAiText`를 경유함(확인됨):
`interpret/route.ts`, `saju-yearly-service`, `saju-lifetime-service`(본편), `chapters/openai-chapter-client`, `total-review/openai-total-review-client`(궁합도 이 클라이언트 재사용), `api/ai/route.ts`(챗), `home/home-banners`.

→ `generateAiText`에 `feature`·`userId` 입력을 추가하고, 결과 산출 직후(성공·fallback 양쪽) `recordLlmRun(...)`을 호출(console + DB). 호출처는 **태그 한 줄**만 추가.

```
caller(feature, userId) → generateAiText
    → OpenAI 호출 (usage 추출: lastUsage)
    → AiTextResult 구성 (성공) / fallback 구성
    → await recordLlmRun({feature, source, model, in/outTokens, costUsd, durationMs, userIdHash, fallbackReason})
         ├─ console.log({event:'llm_run', ...})         (Vercel grep)
         └─ store.insert(ai_llm_runs row)  try/catch no-op  (SQL 집계)
    → return result   (telemetry 실패와 무관하게 항상 반환)
```

## 3. 컴포넌트

### 3-1. 마이그레이션 042 — `ai_llm_runs` (append-only 사용 로그, 캐시 아님)
```
id            UUID PK default gen_random_uuid()
feature       TEXT NOT NULL          -- 'interpret'|'total_review'|'yearly'|'lifetime'|'chapter'|'compatibility'|'chat'|'home_banner'
source        TEXT NOT NULL CHECK (source IN ('openai','fallback'))
model         TEXT
input_tokens  INTEGER
output_tokens INTEGER
cost_usd      NUMERIC(10,6)
duration_ms   INTEGER
user_id_hash  TEXT                   -- sha256 16자 prefix (개인정보 가드), 비로그인/미상은 NULL
fallback_reason TEXT                 -- source='fallback'일 때
created_at    TIMESTAMPTZ default now()
```
- RLS 활성 + **공개 정책 없음**(service role 전용) — 036/041 패턴.
- 인덱스: `(feature, created_at)` (영역별 일별 집계), `(created_at)`.
- unique/cache_key 없음(로그 테이블, 행 누적).

### 3-2. `src/server/ai/llm-telemetry.ts` (신규, 공유)
- `MODEL_PRICING_PER_M_TOKENS` + `estimateLlmCostUsd(model, inTok, outTok)` — chapter-telemetry와 동일 단가(상수 소폭 중복 감수; chapter-telemetry는 미수정).
- `hashUserId(rawId)` — sha256 16자.
- `LlmFeature` 유니온 타입, `LlmRunRecord` 타입.
- `buildLlmRunRecord(input)` — 순수 함수: usage·model·feature·duration → 레코드(+cost 계산+해시). **TDD 대상**.
- `LlmTelemetryStore { insert(record) }` — `createInMemoryLlmTelemetryStore`(DI/테스트) + `createSupabaseLlmTelemetryStore`(방어적 no-op, `hasSupabaseServiceEnv` 가드).
- `recordLlmRun(record, store?)` — `logLlmRun`(console `event:'llm_run'`) + `await store.insert`(try/catch no-op).

### 3-3. `generateAiText` 통합 (openai-text.ts)
- `AiTextRequest`에 `feature?: LlmFeature`, `userId?: string | null`, (테스트용) `telemetryStore?: LlmTelemetryStore` 추가.
- 성공 경로(L179 부근)·fallback 경로(L86 부근) 양쪽에서 `durationMs` 측정 후 `recordLlmRun`. `feature` 미지정 시 계측 skip(점진 적용 안전).
- 응답은 telemetry와 무관하게 항상 반환(비차단 보장).

### 3-4. 호출처 태깅 (7곳 + 공유 클라이언트 feature 파라미터)
interpret→`interpret` / yearly→`yearly` / lifetime→`lifetime` / chapter→`chapter` / total-review→`total_review` / chat→`chat` / home-banner→`home_banner`. 
총평 클라이언트(`createOpenAITotalReviewClient`)는 `feature` 옵션(기본 `total_review`) 추가 → 궁합은 `compatibility`로 생성. userId는 가능한 곳에서 전달(없으면 null).

## 4. 테스트 (TDD)
- **순수 로직 먼저(RED→GREEN)**: `estimateLlmCostUsd`(단가 계산·토큰 없으면 0), `buildLlmRunRecord`(feature/source/model/토큰→cost·userIdHash 매핑, fallback_reason), `hashUserId`(16자/일관성).
- **스토어**: in-memory DI insert 라운드트립(경량). Supabase 스토어는 방어적 → 단위테스트 비대상(캐시 스토어와 동일 판단).
- **generateAiText 통합**: `telemetryStore`+`feature` DI로 "호출 시 올바른 feature·source의 레코드가 insert되는지" 테스트(in-memory store). fallback 경로도 1건.
- 전체 회귀 무손상 + `npm run typecheck` 0.

## 5. 수용 기준
- [ ] 마이그 042 `ai_llm_runs` 작성(RLS+무공개정책+인덱스). (적용은 수동, 미적용 시 store no-op로 안전)
- [ ] `estimateLlmCostUsd`/`buildLlmRunRecord`/`hashUserId` 단위 테스트 통과
- [ ] `generateAiText` 중앙 계측(성공+fallback, feature 미지정 시 skip)
- [ ] 7개 호출처 feature 태깅 + 총평/궁합 feature 구분
- [ ] DB insert 실패가 LLM 응답을 막지 않음(비차단)
- [ ] 챕터도 `ai_llm_runs`에 기록(feature='chapter')
- [ ] 기존 단위 테스트 무손상 + typecheck 0 + (CI) build 0

## 6. 비목표
- 보존/롤업/집계 뷰(테이블 무한 증가 대응) → Phase 0c
- admin 대시보드 UI(쿼리는 가능해지지만 화면은 후속)
- 캐시 hit 로깅(의도적 제외 — 비용 이벤트만)
- `chapter-telemetry.ts` 통합 리팩터(별도 유지)

## 7. 파일 매니페스트
- 신규: `supabase/migrations/042_ai_llm_runs.sql`, `src/server/ai/llm-telemetry.ts`, `src/server/ai/llm-telemetry.test.ts`
- 수정: `src/server/ai/openai-text.ts`(통합) + 7개 호출처(태그 1줄씩) + `total-review/openai-total-review-client.ts`(feature 파라미터)
- 신규(보고서): `audit-reports/2026-05-25-phase-0b-llm-telemetry-report.md`

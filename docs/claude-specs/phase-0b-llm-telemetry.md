# Phase 0b — LLM 텔레메트리 시드 설계서 (v2)

- 작성일: 2026-05-25 (v2 — 사용자 검토 반영: 캐시 hit 기록 추가, 챕터 미래제거 구조)
- 선행: Phase 0a(대운 본편 캐시, #377 머지) · 배경 `audit-reports/2026-05-25-admin-inventory.md` §6, `2026-05-25-llm-cost-structure.md` §6
- 브랜치: `feat/phase-0b-llm-telemetry`
- 산출 보고서: `audit-reports/2026-05-25-phase-0b-llm-telemetry-report.md`

## 0. 배경 / 목표

admin-inventory §6: **LLM 관측이 대운 챕터에만 존재**(`chapter_run`). 그 외 영역은 `openai-text.ts`가 `usage`를 추출하고도 폐기 → 토큰/비용/호출량/hit률 조회 불가.

목표: **전 LLM 호출 + 캐시 hit**의 `feature·source·model·토큰·비용·지연·user_id_hash`를 **console.log(grep) + DB(SQL 집계)** 양쪽 기록. 코드/풀이 내용 변경 없음(계측만).

## 1. 핵심 결정 (확정, v2)

| 항목 | 결정 |
|------|------|
| 저장 | console.log + DB(`ai_llm_runs`) 둘 다 |
| 계측 지점 | LLM 호출은 **중앙 `generateAiText`**, **캐시 hit은 서비스 호출처** |
| AI챗 | `feature='chat'`로 통합 |
| 챕터 | `ai_llm_runs`에 기록(LLM 호출). 기존 `chapter_run` console 유지 → **미래 제거 가능 구조**(`chapter_run`과 `llm_run`은 *별도 함수*로 분리되어 추후 1지점 삭제로 정리 가능) |
| **캐시 hit** | **기록함** — `source='cache'`, `cost_usd=0`, `model=cached.model`, `user_id_hash` 포함(사용자별 hit률 분석). **캐시 스토어는 수정 안 함**(순수 layer 유지) — 서비스 호출처의 hit 분기에서 `recordLlmRun` 호출 |

## 2. 아키텍처

모든 LLM 호출이 `openai-text.ts`의 `generateAiText`를 경유(확인). 캐시 hit은 호출처가 generateAiText *이전*에 단락(short-circuit).

```
[LLM 호출]  caller(feature,userId) → generateAiText → OpenAI(usage) → 결과 구성
              → await recordLlmRun({feature, source:'openai'|'fallback', model, in/outTokens, costUsd, durationMs, userIdHash, fallbackReason})
[캐시 hit]  caller 가 cacheStore.get() == hit → recordLlmRun({feature, source:'cache', cost_usd:0, model:cached.model, userIdHash}) → 캐시 결과 반환
recordLlmRun: console.log({event:'llm_run',...}) + await store.insert(row) [try/catch no-op]
```

응답은 telemetry 성공/실패와 무관하게 항상 반환(비차단).

## 3. 컴포넌트

### 3-1. 마이그레이션 042 — `ai_llm_runs` (append-only 로그)
```
id, feature TEXT NOT NULL,
source TEXT NOT NULL CHECK (source IN ('openai','fallback','cache')),   -- v2: 'cache' 추가
model TEXT, input_tokens INTEGER, output_tokens INTEGER,
cost_usd NUMERIC(10,6), duration_ms INTEGER,
user_id_hash TEXT,                       -- sha256 16자; 비로그인/미상 NULL
fallback_reason TEXT,                    -- 'ai_not_configured'|'empty_ai_response'|'quota_exceeded'|'openai_error'|NULL
created_at TIMESTAMPTZ default now()
```
RLS 활성 + 공개 정책 없음(service role 전용). 인덱스 `(feature, created_at)`, `(created_at)`. (`source='cache'` 행은 cost_usd=0/토큰 NULL.)

### 3-2. `src/server/ai/llm-telemetry.ts` (신규, 공유)
- `MODEL_PRICING_PER_M_TOKENS` + `estimateLlmCostUsd(model,inTok,outTok)` (chapter-telemetry와 동일 단가; chapter-telemetry 미수정 — 상수 소폭 중복 감수).
- `hashUserId(rawId)` — sha256 16자.
- `LlmFeature` 유니온, `LlmRunSource = 'openai'|'fallback'|'cache'`, `LlmRunRecord` 타입.
- `buildLlmRunRecord(input)` — 순수 함수(usage·feature·source·duration → 레코드, cost·hash 계산). **TDD**.
- `LlmTelemetryStore { insert(record) }` — `createInMemory…`(DI/테스트) + `createSupabase…`(방어적 no-op, `hasSupabaseServiceEnv` 가드).
- `logLlmRun`(console) + `recordLlmRun(record, store?)`(console + `await store.insert` try/catch).

### 3-3. `generateAiText` 통합 (openai-text.ts)
`AiTextRequest`에 `feature?: LlmFeature`, `userId?: string|null`, `telemetryStore?`(테스트용) 추가. 성공·fallback 양쪽에서 `durationMs` 측정 후 `recordLlmRun`. `feature` 미지정 시 skip(점진 적용 안전).

### 3-4. LLM 호출처 태깅 (7곳)
interpret→`interpret` / yearly→`yearly` / lifetime→`lifetime` / chapter→`chapter` / total-review→`total_review` / chat→`chat` / home-banner→`home_banner`. 총평 클라이언트(`createOpenAITotalReviewClient`)에 `feature` 옵션(기본 `total_review`) 추가 → 궁합은 `compatibility`로 생성. userId는 가능한 곳에서 전달.

### 3-5. 캐시 hit 기록 (서비스 호출처, source='cache')
서비스 레벨 캐시 layer의 hit 분기에서 `recordLlmRun({source:'cache', cost_usd:0, model:cached.model, userIdHash, feature})`:
- **본편**(saju-lifetime-service, Phase 0a cacheHit 분기) · **총평**(saju-total-review-service) · **기본풀이**(interpret/route.ts `ai_interpretations` hit) · **궁합**(generate-compatibility-interpretation hit) · **올해**(saju-yearly-service — 응답이 캐시로 충족될 때 1건).
- 캐시 스토어 코드는 **불변**(순수). 기록은 전부 호출처 측.

### 3-6. 챕터 경계 (시드 범위 명시)
- 챕터 **LLM 호출**은 generateAiText 경유로 `ai_llm_runs`(feature='chapter', source openai/fallback) 기록.
- 챕터 **envelope 캐시 hit**은 이번 시드에서 `ai_llm_runs` 미기록 — 기존 `chapter_run`(source='cache')에 이미 존재. 8개 apply 함수 수정을 피하기 위한 의도적 범위 경계(추후 필요 시 추가). `(saju-lifetime-service 등)` 서비스 캐시 hit과 구분.

## 4. 테스트 (TDD)
- 순수 로직 RED→GREEN 먼저: `estimateLlmCostUsd`(토큰 없으면 0), `buildLlmRunRecord`(openai/fallback/**cache** 3종 source·model·토큰→cost·userIdHash·fallback_reason 매핑; cache는 cost 0), `hashUserId`(16자/일관성).
- in-memory store insert 라운드트립.
- `generateAiText` 통합: `telemetryStore`+`feature` DI로 openai·fallback 레코드 검증.
- 캐시 hit 기록: 호출처(가능하면 본편)에서 hit 시 source='cache' 레코드 1건 검증(in-memory store DI).
- 전체 회귀 무손상 + typecheck 0.

## 5. 수용 기준
- [ ] 마이그 042 `ai_llm_runs`(source 3종 CHECK, RLS+무공개정책, 인덱스). (적용 수동; 미적용 시 store no-op로 안전)
- [ ] `estimateLlmCostUsd`/`buildLlmRunRecord`(3 source)/`hashUserId` 단위 테스트 통과
- [ ] `generateAiText` 중앙 계측(openai+fallback, feature 미지정 skip)
- [ ] 7개 호출처 feature 태깅 + 총평/궁합 구분
- [ ] **캐시 hit 기록**(본편·총평·기본·궁합·올해, source='cache', cost 0, userIdHash)
- [ ] 캐시 스토어 코드 불변(순수 layer)
- [ ] 챕터 LLM 호출 `ai_llm_runs` 기록(envelope hit은 경계대로 chapter_run 유지)
- [ ] DB insert 실패가 응답을 막지 않음(비차단)
- [ ] 회귀 무손상 + typecheck 0 + (CI) build 0

## 6. 비목표
- 보존/롤업/집계 뷰(무한 증가 대응) → 별도(필요 시). 
- admin 대시보드 UI(쿼리는 가능, 화면은 후속).
- `chapter-telemetry.ts` 통합 리팩터(별도 유지) + 챕터 envelope hit의 ai_llm_runs 편입.

## 7. 파일 매니페스트
- 신규: `supabase/migrations/042_ai_llm_runs.sql`, `src/server/ai/llm-telemetry.ts`, `src/server/ai/llm-telemetry.test.ts`
- 수정: `src/server/ai/openai-text.ts` + 7 LLM 호출처(태그) + 5 서비스 캐시 hit 분기(source='cache') + `total-review/openai-total-review-client.ts`(feature 파라미터)
- 신규(보고서): `audit-reports/2026-05-25-phase-0b-llm-telemetry-report.md`

## 8. 자율 판단 결과 (작업 시작 시 조사)
- **home_banner**: `unstable_cache`(revalidate 24h)로 감싸짐 → 실제 generateAiText 호출은 하루 1회 수준(저빈도). 계측 포함, 노이즈 적음.
- **fallback_reason**: 코드상 4종(`ai_not_configured`/`empty_ai_response`/`quota_exceeded`/`openai_error`) + null. TEXT 저장(향후 확장 위해 CHECK 미부여).
- **비로그인 user_id_hash**: NULL 처리.

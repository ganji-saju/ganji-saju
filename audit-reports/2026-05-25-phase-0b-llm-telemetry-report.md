# Phase 0b — LLM 텔레메트리 시드 구현 보고서

- 작성일: 2026-05-25
- 브랜치: `feat/phase-0b-llm-telemetry` (origin/main `98e67e6` = Phase 0a 포함)
- 설계서: `docs/claude-specs/phase-0b-llm-telemetry.md` (v2, 커밋됨)
- 방법: 순수 로직 **TDD**(RED→GREEN), 통합은 typecheck/회귀 + (post-apply) 라이브 검증

## 1. 변경 파일

| 구분 | 파일 |
|---|---|
| 신규 마이그 | `supabase/migrations/042_ai_llm_runs.sql` |
| 신규 모듈 | `src/server/ai/llm-telemetry.ts` (+ `llm-telemetry.test.ts`) |
| 중앙 통합 | `src/server/ai/openai-text.ts` (feature/userId/telemetryStore + record 래퍼) |
| LLM 호출 태깅 | `interpret/route.ts`·`saju-yearly-service.ts`·`saju-lifetime-service.ts`·`chapters/openai-chapter-client.ts`·`api/ai/route.ts`(2)·`home/home-banners.ts`·`total-review/openai-total-review-client.ts`(feature 파라미터)·`compatibility/generate-compatibility-interpretation.ts`(client feature) |
| 캐시 hit 기록 | `saju-lifetime-service.ts`·`saju-total-review-service.ts`·`saju-yearly-service.ts`·`interpret/route.ts`·`compatibility/generate-compatibility-interpretation.ts` |
| 신규 설계서/보고서 | `docs/claude-specs/phase-0b-llm-telemetry.md`, 본 보고서 |

## 2. 마이그레이션
- 번호 **042** · 테이블 `ai_llm_runs` (append-only 로그) · **컬럼 11개**: `id, feature, source(CHECK openai|fallback|cache), model, input_tokens, output_tokens, cost_usd, duration_ms, user_id_hash, fallback_reason, created_at`
- 인덱스 `(feature, created_at)`·`(created_at)` · RLS 활성 + **공개 정책 없음**(service role 전용).

## 3. 동작
```
[LLM 호출]  caller(feature,userId) → generateAiText → runGenerateAiText(OpenAI) → 결과
              → await recordLlmRun({feature, source:'openai'|'fallback', model, tokens, costUsd, durationMs, userIdHash, fallbackReason})
[캐시 hit]  서비스 호출처 hit 분기 → await recordLlmRun({feature, source:'cache', cost 0, model:cached.model, userIdHash})
recordLlmRun = buildLlmRunRecord → logLlmRun(console 'llm_run') + store.insert(await, try/catch no-op)
```
- `feature` 미지정 호출은 계측 skip(점진 적용·기본 호환). `recordLlmRun`은 어떤 경우도 throw 안 함(응답 비차단).
- 캐시 스토어 코드 **불변**(순수) — 캐시 hit 기록은 전부 호출처 측.

## 4. 단위 테스트 (TDD)
- `llm-telemetry.test.ts` **10개** 통과:
  - 순수 로직(RED→GREEN): `estimateLlmCostUsd`(단가/0/unknown), `hashUserId`(16자/일관성/null), `buildLlmRunRecord`(openai cost·해시 / **cache cost 0** / fallback reason / 비로그인 null) — 8개
  - `generateAiText` 통합 DI: feature 지정→fallback 경로 레코드 1건 / feature 미지정→skip — 2개
- 전체 **714/714 통과**(회귀 0) · `npm run typecheck` **RC=0**.

## 5. 영역별 계측 매트릭스
| feature | LLM 호출(openai/fallback) | 캐시 hit(source='cache') | userId |
|---|---|---|---|
| interpret(기본풀이) | ✅ 중앙 | ✅ | reading.userId |
| total_review(총평) | ✅ 중앙(공유 클라이언트) | ✅ | (서비스에 userId 없음→null) |
| yearly(올해) | ✅ 중앙(2스테이지) | ✅(응답 캐시) | reading.userId |
| lifetime(본편) | ✅ 중앙 | ✅ | reading.userId |
| compatibility(궁합) | ✅ 중앙(공유 클라이언트 feature 구분) | ✅ | (커플 기반→null) |
| chat(AI챗) | ✅ 중앙(2 호출) | (자체 캐시 없음) | user.id(주 핸들러) |
| chapter(챕터) | ✅ 중앙(openai-chapter-client) | ⛔ 경계(아래) | (client 레벨 없음→null) |
| home_banner | ✅ 중앙 | (unstable_cache 24h 외부 캐시) | (없음) |

## 6. 수용 기준 점검
- [x] 마이그 042(source 3종 CHECK·RLS·인덱스) — ⏳ **수동 적용 대기**(미적용 시 store no-op로 안전)
- [x] `estimateLlmCostUsd`/`buildLlmRunRecord`(3 source)/`hashUserId` 단위 테스트
- [x] `generateAiText` 중앙 계측(openai+fallback, feature 미지정 skip)
- [x] 7개 호출처 태깅 + 총평/궁합 feature 구분
- [x] 캐시 hit 기록(본편·총평·기본·궁합·올해, source='cache' cost 0 + userIdHash)
- [x] 캐시 스토어 코드 불변(순수 layer)
- [x] 챕터 LLM 호출 ai_llm_runs 기록(envelope hit은 §7 경계대로 chapter_run 유지)
- [x] DB insert 실패 비차단(try/catch no-op + hasSupabaseServiceEnv 가드)
- [x] 회귀 무손상(714) + typecheck 0 / (CI) build 검증 예정

## 7. 범위 경계 (의도적)
- **챕터 envelope 캐시 hit**: `ai_llm_runs` 미기록 — 기존 `chapter_run`(source='cache')에 이미 존재. 8개 apply 함수 수정을 피하기 위한 시드 경계(추후 추가 가능). 챕터 LLM 호출은 중앙 기록됨.
- **챕터 이중로깅 미래제거**: `chapter_run`(chapter-telemetry.ts)과 `llm_run`(llm-telemetry.ts)은 **별도 함수** → 추후 `chapter_run` 제거 시 1지점 변경.

## 8. ⚠️ 라이브 검증 (마이그 적용 후)
- 로컬 빌드는 워크트리 node_modules 심링크를 Turbopack이 거부 → **CI 빌드로 검증**.
- 마이그 042 적용 후: 각 영역 1회 호출/재열람 → `SELECT feature, source, count(*), sum(cost_usd) FROM ai_llm_runs GROUP BY feature, source;` 로 영역별 호출/hit/비용 확인. 미적용 상태에선 store no-op(회귀 0).

## 9. 자율 결정 (조사 결과)
- home_banner: `unstable_cache`(revalidate 24h) → generateAiText 실호출 하루 1회 수준(저빈도). 포함.
- fallback_reason: 4종(`ai_not_configured`/`empty_ai_response`/`quota_exceeded`/`openai_error`)+null. TEXT 저장.
- 비로그인 user_id_hash: NULL.

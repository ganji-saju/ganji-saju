# Phase 0a — 대운 본편(lifetime final) 캐시 구축 보고서

- 작성일: 2026-05-25
- 브랜치: `feat/phase-0a-lifetime-cache` (origin/main `298b000` 기준)
- 지시서: `docs/claude-specs/phase-0a-lifetime-cache.md`(원본은 사용자 Downloads), 배경 `audit-reports/2026-05-25-llm-cost-structure.md` §5 후보 1
- 원칙 준수: 본편 풀이 **내용 불변**(캐시 인프라만), total-review 패턴 복제, write 실패 비차단, fallback 미저장
- 방법: 캐시 키 모듈은 **TDD**(실패 테스트 먼저 → 구현), 스토어·통합은 지시서 §5-2 허용대로 단위테스트는 키에 집중 + typecheck/회귀로 검증

---

## 1. 변경된 파일 목록

| 구분 | 파일 |
|---|---|
| 신규 (마이그) | `supabase/migrations/041_ai_lifetime_interpretations.sql` |
| 신규 (키 모듈) | `src/server/ai/lifetime/lifetime-interpretation-cache.ts` |
| 신규 (키 테스트) | `src/server/ai/lifetime/lifetime-interpretation-cache.test.ts` |
| 신규 (스토어) | `src/server/ai/lifetime/lifetime-cache-store.ts` |
| 수정 (통합) | `src/server/ai/saju-lifetime-service.ts` |
| 신규 (본 보고서) | `audit-reports/2026-05-25-phase-0a-lifetime-cache-report.md` |

`saju-lifetime-service.ts` 수정 4곳: ① 캐시 모듈 import, ② request에 `cacheStore?` (DI), ③ payload `cached`/`cacheable` 리터럴 `false`→`boolean`, ④ 본편 콜을 read-through로 래핑(hit→캐시 반환, miss→LLM→`source==='openai'`만 저장).

---

## 2. 마이그레이션

- 번호: **041** (현재 최신 040; 지시서 예시 042 아님)
- 테이블: `ai_lifetime_interpretations`, **컬럼 16개**:
  `id, cache_key, prompt_version, model, source(CHECK llm|fallback), output_json, reasons, saju_summary, counselor_id, target_year, context, input_tokens, output_tokens, cost_usd, created_at, updated_at`
- 제약/인덱스: `UNIQUE(cache_key, prompt_version)`(조회 인덱스 겸용), RLS 활성 + **공개 정책 없음**(service role 전용) — 036 패턴 동일.
- freshness: 별도 `expires_at` 없이 `updated_at` + `isLifetimeCacheFresh`(TTL 30일) — total-review와 동일.

---

## 3. 단위 테스트

- 캐시 키 모듈 신규 테스트 **12개** (지시서 요구 6개 + 누락 결정요인 3개 + report 해시/TTL):
  같은 입력=같은 키 / 사주·counselor·context·gender·**targetYear**·**reportHash(챕터)**·**recentFeedbackSummary**·promptVersion 다르면 다른 키 / SHA256 64hex / hashLifetimeReport / isLifetimeCacheFresh.
- TDD 절차 준수: 모듈 부재로 **RED**("Cannot find module") 확인 → 구현 → **GREEN**.
- **전체 스위트: 704/704 통과 (회귀 0)**. `node scripts/run-unit-tests.mjs` exit 0.
- typecheck: `npm run typecheck` **RC=0** (통합 타입 정합 확인. `reading.input.gender`로 V1/V2 union 대응).

---

## 4. 사전 조사 결과 (§2) — 설계에 영향을 준 발견

1. **본편 콜은 단일 진입점**: `saju-lifetime-service.ts`의 `generateAiText`는 L227 1곳. `cacheable:false`는 응답 메타 필드일 뿐 스위치 아님 → 캐시 로직 자체가 없었음.
2. **본편 출력 결정요인**(`createLifetimeInterpretationPrompt`의 input 직렬화):
   - `report`(= LLM enhance된 챕터 요약 포함) → **본편은 챕터 출력에 의존**
   - `recentFeedbackSummary`(사용자별·시변, "단정 강도 조정"에 사용)
   - grounding/kasi(사주 결정론), counselor별 instructions, `targetYear`
3. **지시서 §4 구조화 키의 누락**: `targetYear`·`recentFeedbackSummary` 미포함 + chaptersHash 미지정 → 그대로 쓰면 다른 연도·다른 피드백에 잘못된 캐시 반환 위험. → 사용자 결정으로 **결정요인 전부 포함**(아래 §5).
4. **total-review 실제 패턴**은 지시서 §3/§5 스켈레톤과 다름(DI store, `output_json`, `updated_at` freshness, standalone 함수 아님) → 사용자 결정으로 **실제 패턴 복제**.
5. **'orphaned exports 청소 PR' 부재**: 지시서가 직전 머지로 가정했으나 main 최근 25커밋에 없음. 본 작업과 의존성 없어 영향 없이 진행.

---

## 5. 사용자 결정 사항 반영

| 항목 | 결정 | 구현 |
|---|---|---|
| 캐시 키 | 구조화 키 + **결정요인 전부 포함** | `buildLifetimeCacheKey(sajuData, ctx)` = SHA256(pillars + dayMaster + gender + context(관계/직업/고민) + counselorId + **targetYear** + **reportHash**(챕터 포함 report 해시) + **feedback** + promptVersion) |
| 스토어/스키마 | **실제 total-review 패턴** | `LifetimeCacheStore`(get/set DI), in-memory + Supabase 구현, `output_json`/`updated_at`, source='llm'만 저장, 방어적 no-op. + Phase 0b용 토큰/비용 + 디버그 컬럼 |
| promptVersion | (기존 재사용) | 신규 상수 대신 `getLifetimeInterpretationPromptVersion(counselorId)` 주입 (이미 counselor별 버전) |

> reportHash가 핵심: 본편 프롬프트가 `report`를 통째로 직렬화하므로, report 해시를 키에 넣으면 (envelope-cached) 챕터 변화가 본편 키에 정확히 반영되고, 챕터 flag OFF(결정론)면 report가 안정적이라 hit률도 높다.

---

## 6. 수용 기준 (§8) 점검

| # | 기준 | 상태 |
|---|---|---|
| 1 | 마이그 041 적용 성공 | ⏳ **작성 완료, prod 적용 대기**(마이그는 supabase CLI 수동 적용 — 미적용 시 앱은 캐시 no-op로 안전) |
| 2 | 테이블 존재 + RLS 활성 | ⏳ SQL에 정의(RLS+무공개정책), 적용 대기 |
| 3 | `buildLifetimeCacheKey` 단위 테스트 6개 | ✅ **12개 통과** |
| 4 | service read-through 통합 | ✅ |
| 5 | 같은 사주 2번째 cache hit (수동) | ⚠️ **코드/타입/키 단위테스트로 검증**. 라이브 end-to-end는 마이그 적용+dev+Supabase 필요 → 본 환경 미수행(아래 주의) |
| 6 | 컨텍스트 다르면 별도 캐시 행 | ✅ 키 테스트(context/targetYear/feedback/reportHash 다르면 다른 키) |
| 7 | promptVersion 변경 시 무효화 | ✅ 키 테스트 |
| 8 | write 실패 비차단 | ✅ Supabase store try/catch no-op + `hasSupabaseServiceEnv` 가드 |
| 9 | fallback 미저장 | ✅ `source==='openai'`일 때만 set + store도 source='llm'만 upsert |
| 10 | 기존 단위 테스트 무손상 | ✅ 704/704 |
| 11 | `npm run build` 0 errors | ⚠️ **로컬 워크트리는 node_modules 심링크를 Turbopack이 거부**(코드 문제 아님, typecheck는 통과). 실제 빌드는 **CI "Test, Typecheck, Build" 잡**이 검증 |

### ⚠️ 라이브 검증 주의
- 본 환경에서 dev 서버 + Supabase로 실제 cache hit를 띄우려면 **마이그 041을 먼저 적용**해야 함(미적용 상태에선 `hasSupabaseServiceEnv`/테이블 부재로 store가 no-op → 캐시 미작동이지만 본편은 정상 fallback 경로로 동작, 즉 **회귀 0·기존 동작 유지**).
- 따라서 머지 후 **마이그 041 수동 적용 → dev/prod에서 동일 사주 재열람으로 hit 확인**이 라이브 검증 단계.

---

## 7. 동작 요약

```
generateLifetimeInterpretation:
  report 빌드(챕터 enhance) → prompt 빌드
  → cacheKey = SHA256(saju + context + counselor + targetYear + reportHash + feedback + promptVersion)
  → regenerate=false면 cacheStore.get(cacheKey, promptVersion)
     ├─ hit  → 캐시된 interpretation 반환 (cached:true, source:'openai', LLM 미호출) ★비용 0
     └─ miss → generateAiText(본편 LLM)
               ├─ source='openai' → 응답 + cacheStore.set(...)  (다음 조회부터 hit)
               └─ fallback        → 응답만 (저장 안 함)
```

- 효과: 평생소장권 사용자가 같은 리포트를 **재열람·새로고침**할 때 본편 LLM($≈0.01/회) 중복 호출 제거. content-addressed라 동일 사주(비로그인 포함)는 사용자 무관 dedup.

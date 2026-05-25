# Phase 3 — Gap C: LLM 비용 대시보드 설계서

- 작성일: 2026-05-25
- 선행: Phase 0b(`ai_llm_runs` 텔레메트리 #378). 로드맵 Phase 3 — 0b 데이터 시각화.
- 브랜치: `feat/phase-3-llm-cost-dashboard`
- **핵심: 신규 테이블 없음.** 기존 `ai_llm_runs` 재활용(중복 `llm_usage_logs` 안 만듦).

## 1. 배경
Phase 0b가 `ai_llm_runs`(created_at·feature·source('openai'|'fallback'|'cache')·model·input_tokens·output_tokens·cost_usd·duration_ms·user_id_hash·fallback_reason)에 전 LLM 호출·캐시 hit을 적재 중. 이를 운영자가 보는 화면이 없음 → 대시보드.

## 2. 산출물
1. **집계 모듈** `src/lib/admin/llm-cost-stats.ts` (operations-stats 패턴, service_role):
   - `getLlmCostStats(days=30)` — 최근 N일 `ai_llm_runs` fetch → 집계.
   - 순수 집계(TDD): `aggregateByDay`·`aggregateByFeature`·`overallSummary`.
2. **`/admin/llm-cost` 페이지** — 카드:
   - 일별 비용·호출수 추이(최근 30일)
   - 영역(feature)별: 호출수·토큰·비용·**캐시 hit률**
   - 전체 요약: 총비용·총호출·LLM 활성 사용자수·hit률
   - **DAU(LLM 활성) 대비 비용**: 일별 distinct user_id_hash 대비 cost
3. 관리자 메뉴(operations)에 "LLM 비용" 진입점 추가.

## 3. 집계 정의 (순수 함수)
- `aggregateByDay(rows)` → `[{ date, calls, costUsd, distinctUsers }]` (date 오름차순).
- `aggregateByFeature(rows)` → `[{ feature, calls, openai, cache, fallback, cacheHitRate, inputTokens, outputTokens, costUsd }]` (cost 내림차순).
  - cacheHitRate = cache / calls (소수 3자리).
- `overallSummary(rows)` → `{ totalCalls, totalCostUsd, distinctUsers, cacheHitRate }`.
- distinctUsers: `user_id_hash` non-null 고유 수(= LLM 활성 사용자; 비로그인/미상 제외).

## 4. 결정 (확정)
- **DAU 출처 = ai_llm_runs distinct user_id_hash/day** (ⓐ, 자기완결). 화면 라벨 "LLM 활성 사용자" 로 명시(진짜 방문 DAU 아님).
- **retry_count 컬럼 생략** — 오케스트레이터 재시도는 generateAiText 재호출 → 이미 별도 행. "feature별 호출수"가 재시도 반영.
- **챕터 envelope 캐시 hit 한계** — ai_llm_runs 미포함(0b 경계) → 챕터 hit률 과소집계, 화면에 주석.
- **성능**: 시드는 최근 30일 rows fetch 후 **JS 집계**. 대량 시 RPC/집계뷰는 비목표(후속).

## 5. 테스트
- 순수 집계 3종 **TDD**(RED→GREEN): aggregateByDay/aggregateByFeature(hit률)/overallSummary.
- fetch·페이지는 typecheck + 회귀. UI 라이브는 admin 세션 필요(명시).

## 6. 파일 매니페스트
- 신규: `src/lib/admin/llm-cost-stats.ts`(+test), `src/app/admin/llm-cost/page.tsx`
- 수정: `src/app/admin/operations/page.tsx`(진입점)
- 신규 보고서: `audit-reports/2026-05-25-phase-3-llm-cost-dashboard-report.md`

## 7. 비목표
- 신규 텔레메트리 테이블(ai_llm_runs 재활용). RPC/집계뷰/보존정책. 챕터 envelope hit 편입. 알림/예산 경보(후속).

# Phase 3 — Gap C: LLM 비용 대시보드 구현 보고서

- 작성일: 2026-05-25
- 브랜치: `feat/phase-3-llm-cost-dashboard` (origin/main `a938246` = Phase 2 포함)
- 설계서: `docs/claude-specs/phase-3-llm-cost-dashboard.md`
- 핵심: **신규 테이블 없음** — Phase 0b `ai_llm_runs` 재활용. 순수 집계 **TDD**.

## 1. 변경 파일
| 구분 | 파일 |
|---|---|
| 신규 집계 | `src/lib/admin/llm-cost-stats.ts` (+ `llm-cost-stats.test.ts`) |
| 신규 페이지 | `src/app/admin/llm-cost/page.tsx` |
| 수정 | `src/app/admin/operations/page.tsx`(관리자 메뉴 "LLM 비용" 진입점) |
| 신규 문서 | 설계서, 본 보고서 |
| **마이그레이션** | **없음** (ai_llm_runs 재활용) |

## 2. 대시보드 `/admin/llm-cost`
- **요약**(최근 30일): 총 비용 · 총 호출수 · LLM 활성 사용자 · 캐시 hit률.
- **영역별**(비용 순): feature × 호출·openai/cache/fallback·**hit률**·토큰(in/out)·비용. fallback>0 빨강.
- **일별 추이**: 날짜별 비용 막대 + LLM 활성 사용자수.
- 기존 `/admin` 가드 재사용. service_role 로 최근 30일 rows fetch 후 JS 집계.

## 3. 테스트 (TDD)
- 순수 집계 **4테스트**: `aggregateByDay`(날짜별·고유사용자) · `aggregateByFeature`(source 카운트·hit률·토큰·비용) · `overallSummary` · 빈 배열 안전.
- 전체 **732/732** · `typecheck` 0.

## 4. 확정 결정
- **DAU = ai_llm_runs distinct user_id_hash/day**(= LLM 활성 사용자, 비로그인 제외). 화면에 "방문 DAU 아님" 주석.
- **retry_count 컬럼 생략** — 오케스트레이터 재시도는 generateAiText 재호출 → 이미 별도 행. "호출수"가 재시도 반영.
- **챕터 envelope 캐시 hit 한계** — ai_llm_runs 미포함 → 챕터 hit률 과소집계, 화면 주석.

## 5. 검증 한계
- ⚠️ **UI 라이브 검증 미수행**: admin 세션 필요. typecheck + 단위테스트 + (CI) build 로 코드 정합 검증.
- 데이터는 **Phase 0b 배포(2026-05-25) 이후** 호출분만 → 추이가 아직 짧음(정상). 사용량 쌓일수록 의미 생김.
- 로컬 build는 워크트리 심링크로 Turbopack 거부 → CI 검증.

## 6. 로드맵 완료
| Phase | 내용 | 상태 |
|---|---|---|
| 0 | 본편 캐시(#377) + 텔레메트리 시드(#378) | ✅ |
| 1 | 사용자 상세 + 검색(#379) | ✅ |
| 2 | 환불 자동화(#380) | ✅ |
| **3** | **LLM 비용 대시보드** | ✅ (본 PR) |

## 7. 비목표 (후속 선택)
- RPC/집계뷰(대량 시), 보존정책, 예산/비용 경보 알림, 챕터 envelope hit 편입, retry_count.

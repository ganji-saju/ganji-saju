# Phase 1 — Gap A: 어드민 사용자 상세 페이지 + 검색 설계서

- 작성일: 2026-05-25
- 선행: Phase 0a(본편 캐시 #377)·0b(LLM 텔레메트리 #378). 로드맵상 Phase 1.
- 브랜치: `feat/phase-1-admin-user-detail`
- 목표: 첫 사용자가 들어왔을 때 운영자가 **이메일/UUID로 찾아 전체 활동을 한 화면에서 추적**. CS·운영 도구.

## 1. 라우트 / 인증
- `/admin/users` — 검색(이메일·UUID) + 목록.
- `/admin/users/[id]` — 사용자 상세(6섹션).
- 기존 `/admin/*` 가드 재사용: `admin/layout.tsx`의 `getCurrentAdminCheck`(미인증→`/login?next=/admin`, 비어드민→`/`) + `admin_users` 화이트리스트 + `service_role`(own-row RLS 우회).
- **마이그레이션 없음** — 전부 조회.

## 2. 상세 페이지 6섹션 — 데이터 소스 + 재활용

| # | 섹션 | 소스 | 재활용/메모 |
|---|---|---|---|
| 1 | 회원 정보 | `auth.users`(id/email/생성일) + `profiles`(생년월일·성별·상담사 등) | `auth.admin.getUserById`, `getUserProfileById` |
| 2 | 사주 데이터 | `readings` 최신행 + `result_json` → **팔자 8글자**(4기둥 ganzi) | 순수 추출 함수 |
| 3 | 결제 이력 | `product_entitlements` + `credit_transactions` + `subscriptions` | **`buildPaymentHistory` 매퍼 재활용**; account.ts는 RLS본이라 admin용 service fetch만 신규 |
| 4 | AI챗 사용량 | `dialogue_messages` **count**(내용 미노출) | count 쿼리 |
| 5 | LLM 캐시 hit 통계 | **`ai_llm_runs` WHERE `user_id_hash`=hashUserId(id)** GROUP BY feature·source | Phase 0b 자산. 보조: `ai_interpretations`(reading_id→user join) |
| 6 | 환불 가능 여부 | `product_entitlements` 활성 상태(환불 대상·금액 표시) | `audit-user-entitlements.mjs` 로직. **상태 표시만** |

## 3. 핵심 결정 (사용자 승인)
1. **이메일 검색** = `auth.admin.listUsers`(profiles에 email 컬럼 없음). 초기 트래픽 충분; 대규모 시 페이지네이션 비용 — 추후 개선.
2. **사용자별 LLM 통계** 주 소스 = `ai_llm_runs.user_id_hash`. ⚠️ **Phase 0b 배포 이후 데이터만** 집계(기존 사용자는 활동해야 누적). `ai_interpretations`(reading join)는 과거분 보조.
3. **환불 가능 여부 = 상태 표시만**. 실제 환불(Toss cancel)은 **Phase 2**. 본 페이지는 환불 대상 entitlement 유무·금액 + Phase 2 연결점만.
4. **AI챗 = count만**(내용 미노출 = PII 최소화).
5. **PII**: 이메일·생년월일·결제 집약 → admin 가드 필수(존재). 추가 마스킹 필요 시 후속.

## 4. 데이터 레이어 + 순수 로직
- `src/lib/admin/user-detail.ts`(operations-stats 패턴):
  - `searchAdminUsers(query)` — UUID면 `getUserById`, 아니면 `listUsers` 필터 → 목록(id·email·생성일).
  - `getAdminUserDetail(userId)` — 6섹션 집계(service_role).
- **순수 로직(TDD 대상)**:
  - `extractPalja(resultJson)` → 8글자(4기둥 ganzi) / 결측 처리.
  - `buildUserLlmStats(rows)` → feature별 {openai, cache, fallback, costUsd}.
  - `determineRefundEligibility(entitlements)` → 환불 대상 목록·합계.

## 5. 페이지
- `/admin/users/page.tsx` — server component, `searchParams.q` 읽어 `searchAdminUsers` → 결과 테이블(행 클릭→상세).
- `/admin/users/[id]/page.tsx` — server component, `getAdminUserDetail` → 6섹션 카드. 기존 admin 페이지 레이아웃·토큰 재사용.

## 6. 테스트
- 순수 로직 3종 **TDD**(RED→GREEN): `extractPalja`·`buildUserLlmStats`·`determineRefundEligibility`.
- `buildPaymentHistory`는 기존 테스트 존재(재활용).
- 데이터 fetch(auth.admin/supabase)·페이지는 typecheck + 회귀. UI 라이브 확인은 admin 세션 필요(해당 시 명시).

## 7. 파일 매니페스트
- 신규: `src/lib/admin/user-detail.ts`(+ `user-detail.test.ts`), `src/app/admin/users/page.tsx`, `src/app/admin/users/[id]/page.tsx`
- 재활용: `src/lib/billing/payment-history.ts`(buildPaymentHistory), `src/lib/profile.ts`(getUserProfileById), `src/lib/admin-auth.ts`, `src/server/ai/llm-telemetry.ts`(hashUserId)
- 신규(보고서): `audit-reports/2026-05-25-phase-1-admin-user-detail-report.md`

## 8. 비목표
- 실제 환불 실행(Toss cancel) → Phase 2.
- 사용자 데이터 *수정*(읽기 전용 상세). 
- LLM 비용 *대시보드*(영역별 추세) → Phase 3.
- dialogue_messages 내용 열람(count만).

# Phase 2 — Gap B: 환불 자동화 구현 보고서

- 작성일: 2026-05-25
- 브랜치: `feat/phase-2-refund-automation` (origin/main `8915bdd` = Phase 1 포함)
- 설계서: `docs/claude-specs/phase-2-refund-automation.md`
- 방법: 상태머신·검증·역할게이트·실행 오케스트레이션 **TDD**(DI mock). 실 Toss 호출 없음.

## 0. 안전 경계 (재확인)
- 코드·UI 구현 + **mock 테스트**까지. **실제 Toss 환불 실행은 라이브 super_admin(사람)** 이 버튼으로 — 개발 중 프로덕션 결제 미취소. TOSS_SECRET_KEY 없는 환경에선 cancelPayment 가 throw → 상태 'failed'(안전).

## 1. 변경 파일
| 구분 | 파일 |
|---|---|
| 신규 마이그 | `supabase/migrations/043_refund_requests.sql` |
| 신규 서비스 | `src/lib/admin/refund-service.ts` (+ `refund-service.test.ts`) |
| 신규 라우트 | `src/app/api/admin/refund/route.ts` |
| 신규 UI | `src/app/admin/users/[id]/refund-actions.tsx` (client) |
| 수정 | `src/lib/admin-auth.ts`(super_admin 역할), `src/lib/payments/toss.ts`(cancelPayment), `src/lib/admin/user-detail.ts`(refundRequests), `src/app/admin/users/[id]/page.tsx`(§6 연결) |
| 재사용 | `revokeProductEntitlement`(product-entitlements.ts) |
| 신규 문서 | 설계서, 본 보고서 |

## 2. 동작 — 2단계 워크플로우
- **`POST /api/admin/refund`**:
  - `action:'request'`(admin/super_admin): 대상 entitlement 스냅샷 → `refund_requests`(status `requested`). **돈 안 움직임**.
  - `action:'approve'`(**super_admin**): `executeRefund` 상태머신 실행.
  - `action:'reject'`(super_admin): `rejected`.
  - 역할 게이트: `canRoleActOnRefund` + `getCurrentAdminRole`.
- **상태머신**(`executeRefund`, 실패 안전 + 멱등):
  ```
  requested/failed → processing
    → Toss cancel(payment_key, Idempotency-Key=idempotency_key)
        실패 → failed (재시도 가능, 멱등키로 이중환불 방지)
        성공 → revokeProductEntitlement(actor=super_admin)
                성공 → completed
                실패 → revoke_pending (돈 환불·권한 미회수 = 경보, revoke 재시도)
  ```
- **UI**(`/admin/users/[id]` §6): admin엔 "환불 요청" 버튼, super_admin엔 요청 목록 + "승인·실행"(confirm 후 실제 Toss 취소)·"거부"·"재시도".

## 3. 테스트 (TDD)
- `refund-service.test.ts` **10개**: 순수(`validateRefundRequest`·`nextRefundStatus`(정상/재시도/잘못된 전이)·`canRoleActOnRefund`) 6 + `executeRefund` DI(toss성공+revoke성공→completed/멱등키 전달, toss실패→failed, revoke실패→revoke_pending, 이미 completed→승인불가) 4.
- 전체 **728/728** · `typecheck` **0**.

## 4. 검증 한계 (정직)
- ⚠️ **실 환불·UI 라이브 검증 미수행**: super_admin 세션 + TOSS_SECRET_KEY + 실제 결제건 필요. 상태머신은 DI mock으로 전이 검증 완료.
- 로컬 build는 워크트리 node_modules 심링크 → **CI 빌드 검증**.
- **권장 라이브 절차**(머지·마이그 적용 후): ① super_admin이 `/admin/users/[id]`에서 본인 소액 결제건으로 환불 요청·승인 1건 → Toss 대시보드 + `refund_requests.status='completed'` 확인.

## 5. 주의
- **마이그 043 수동 적용** 필요(supabase CLI). 미적용 시 refund_requests 부재로 요청/실행 실패(돈은 안전 — 아무 일도 안 일어남).
- **env ADMIN_USER_IDS = super_admin 취급**(부트스트랩 설립자). DB admin_users.role 로 일반 admin 구분.
- **revoke_pending**(Toss 환불됐는데 권한 회수 실패)는 경보 상태 — super_admin "재시도"로 revoke만 재실행(멱등키로 Toss 이중취소 없음).
- Webhook 수신은 **Phase 3**.

## 6. 비목표
- Toss Webhook → Phase 3. 부분 환불(전액만). 코인/구독 환불(단건·평생 우선). 자동 환불(항상 수동 승인).

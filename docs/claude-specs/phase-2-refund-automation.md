# Phase 2 — Gap B: 환불 자동화 설계서

- 작성일: 2026-05-25
- 선행: Phase 1(어드민 사용자 상세 #379). 로드맵 Phase 2 — 마찰점 1(환불) 해결 본체.
- 브랜치: `feat/phase-2-refund-automation`
- 워크플로우: **2단계** — admin 요청 → **super_admin 승인·실행**(사용자 확정).

## 0. 안전 경계 (필수)
- 본 작업은 **오케스트레이션 코드·UI 구현 + mock 테스트**까지. **실제 Toss 환불 실행은 라이브 환경의 super_admin(사람)** 이 버튼으로 수행. 개발 중 프로덕션 결제를 실제로 취소하지 않는다.
- 프로덕션 DDL(마이그 043)·실 환불은 사용자/운영자 확인 후.

## 1. 배경
admin-inventory §7: 환불 진입점 0(전부 수동), Toss cancel 미구현. `revokeProductEntitlement`(product-entitlements.ts:473)는 존재하고 **paymentKey·amount를 반환**하며 주석에 "Toss cancel은 이 함수 밖, 호출부가 처리"라고 이미 설계됨 → 그 호출부를 만든다.

## 2. 아키텍처
1. **`refund_requests` 테이블(마이그 043)** — 요청/승인 워크플로우 + 멱등키 + 상태머신 source of truth.
2. **`POST /api/admin/refund`** — `action`별 역할 게이트:
   - `request`(admin/super_admin): 대상 entitlement 스냅샷 → `refund_requests` 행(status `requested`). 돈 안 움직임.
   - `approve`(**super_admin 전용**): 실행(아래 상태머신).
   - `reject`(super_admin): status `rejected`.
3. **super_admin 체크 추가** — admin-auth에 `getAdminRole(userId)`/`isSuperAdmin`(`admin_users.role`). 기존 `isAdminUser`(boolean) 보강.
4. **`toss.ts` `cancelPayment(paymentKey, {cancelReason, idempotencyKey})`** — `POST /v1/payments/{key}/cancel`, `Idempotency-Key` 헤더, confirm과 동일 Basic auth.
5. **`revokeProductEntitlement` 재사용**(reason, actor=super_admin, paymentKey).
6. **UI**(Phase 1 `/admin/users/[id]` §6 환불 섹션): admin엔 "환불 요청", super_admin엔 pending 목록 + "승인·실행"/"거부".
7. **Webhook 수신: Phase 3로 연기**(승인).

## 3. refund_requests 스키마 (043)
```
id uuid pk, user_id uuid(대상), entitlement_id uuid(snapshot 출처),
product_id text, scope_key text, payment_key text, amount integer,
reason text not null, requested_by uuid not null, approved_by uuid,
status text not null default 'requested'
  check (status in ('requested','processing','completed','failed','revoke_pending','rejected')),
idempotency_key uuid not null default gen_random_uuid(),  -- Toss Idempotency-Key
toss_response jsonb, error_message text,
created_at timestamptz, updated_at timestamptz
```
RLS 활성 + 공개 정책 없음(service role 전용). 인덱스 `(status, created_at)`, `(user_id, created_at)`.

## 4. 상태머신 (실패 안전 + 멱등) — 진짜 원자성 불가(Toss 외부)
```
requested ──approve(super_admin)──▶ processing
  processing ──Toss cancel(payment_key, Idempotency-Key=idempotency_key)──
      ├ 실패 ▶ failed          (재시도 가능 — 멱등키로 이중환불 방지)
      └ 성공 ▶ revokeProductEntitlement(reason, actor=super_admin, paymentKey)
                ├ 성공 ▶ completed
                └ 실패 ▶ revoke_pending   (돈 환불됨·권한 미회수 = 경보, revoke 재시도)
requested ──reject(super_admin)──▶ rejected
failed ──approve(재시도)──▶ processing ...   (idempotency_key 동일 → Toss 이중취소 없음)
```
- 멱등키: `refund_requests.idempotency_key`(uuid) = Toss `Idempotency-Key`. 재시도 안전.
- audit: `revokeProductEntitlement`가 `entitlement_revoke` 감사행을 이미 남김 + refund_requests 자체가 감사 기록.

## 5. 순수 로직 (TDD 대상)
- `validateRefundRequest(input)` → ok/사유 (amount>0, payment_key 존재, reason 비어있지 않음).
- `nextRefundStatus(current, event)` → 상태 전이(event: approve/toss_ok/toss_fail/revoke_ok/revoke_fail/reject). 불변·순수.
- `canRoleActOnRefund(role, action)` → admin=request만, super_admin=request/approve/reject. 순수 게이트.

## 6. 오케스트레이션 (DI, integration)
`src/lib/admin/refund-service.ts`:
- `createRefundRequest({entitlementId, reason, requestedBy})` — entitlement 로드(snapshot) → 검증 → insert.
- `executeRefund({requestId, approvedBy}, deps)` — deps={tossCancel, revoke} DI. 상태머신 실행. **Toss/DB/revoke는 DI로 주입** → 테스트는 mock, 실호출 없음.
- super_admin 게이트는 라우트에서 + 서비스에서 이중 확인.

## 7. 테스트
- 순수 로직 3종 **TDD**(RED→GREEN). 
- 오케스트레이션: DI mock으로 상태 전이 검증(toss 성공/실패, revoke 실패→revoke_pending, 재시도 멱등). **실 Toss 호출 없음**.
- 전체 회귀 + typecheck 0. ⚠️ UI·실환불 라이브 검증은 super_admin 세션 필요(명시).

## 8. 파일 매니페스트
- 신규: `supabase/migrations/043_refund_requests.sql`, `src/lib/admin/refund-service.ts`(+test), `src/app/api/admin/refund/route.ts`
- 수정: `src/lib/admin-auth.ts`(super_admin), `src/lib/payments/toss.ts`(cancelPayment), `src/app/admin/users/[id]/page.tsx`(환불 UI), `src/lib/admin/user-detail.ts`(pending 요청·entitlement_id 노출)
- 재사용: `revokeProductEntitlement`(product-entitlements.ts)
- 신규 보고서: `audit-reports/2026-05-25-phase-2-refund-automation-report.md`

## 9. 비목표
- Toss Webhook 수신 → Phase 3.
- 부분 환불(전액 취소만). 코인/구독 환불(단건·평생 product_entitlements 우선).
- 자동 환불(항상 super_admin 수동 승인).

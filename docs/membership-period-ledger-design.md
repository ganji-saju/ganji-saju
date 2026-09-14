# 멤버십 결제별 기간 원장 설계 (2026-09-14, 사용자 결정)

## 왜
구독은 사용자당 1행(`subscriptions.renews_at`)에 결제(30일)·관리자 부여가 끝에 누적된다. 결제별 실제 기간이 없어서
환불 잠금(되돌릴 수 없는 삭제)을 추정 기간으로 했고, 연속 결제·관리자 부여·해제·재구매가 섞이면 남의 기간을 지우거나(과다)
환불된 주문 기록 때문에 못 잠갔다(과소). 리뷰 3회에서 매번 새 조합이 터졌다 → **기간을 표로 기록하고 모든 변경이 표를 갱신**한다.
유료 멤버십 결제 0건(2026-09-13 실측) — 지금이 가장 싸다.

## 표 `membership_periods` (migration 086 — 사용자가 SQL Editor 로 머지 전 적용)
- id uuid pk default gen_random_uuid() · user_id uuid not null references auth.users on delete cascade
- source text not null check (source in ('payment','admin_grant','legacy'))
- order_id text null (source='payment' 이면 not null — check) · start_at timestamptz not null · end_at timestamptz not null check (end_at > start_at)
- voided_at timestamptz null · void_reason text null · created_at timestamptz not null default now()
- index (user_id, end_at) · unique (order_id) where source='payment' and voided_at is null (같은 결제 이중 기록 방지 — 지급 재시도는 **새 행을 만들지 말고** 기존 행을 쓴다)
- RLS enable + 정책 없음(service 전용) + `revoke all on table ... from anon, authenticated`(083·085 교훈). 머리말에 적용 전/후 확인 쿼리.
- 백필: 지금 active·cancelled 이고 renews_at > now() 인 구독마다 source='legacy' 1행 [now(), renews_at). (잠금 대상 아님, 사슬 끝 맞추기용)

## 불변식
살아 있는(voided_at null) 기간은 겹치지 않고 끝을 이어 붙인 사슬이다. `subscriptions.renews_at` = 살아 있는 기간의 max(end_at)(없으면 expired).

## 연산 (전부 src/lib/subscription.ts 쪽, service 주입 가능)
1. **지급(activate)**: base = max(now, 살아 있는 기간 max(end_at) ?? subscriptions.renews_at) → [base, base+days) 행 추가(source payment/admin_grant), subscriptions upsert(renews_at=end, active).
   지급 재시도(같은 order_id 살아 있는 행이 있으면) → 행·구독 **변경 없음**(+60 버그 제거). #820 의 metadata.membershipDaysGranted 는 호환용으로 계속 쓰되 정본은 표.
2. **전액환불(주문 P, 시각 t)**: P 행 void(reason refund). 잠금 창 = [P.start, min(P.end, t)) (t < P.start 면 없음).
   뒤 기간 당기기: 이동량 = t < P.start ? (P.end−P.start) : t < P.end ? (P.end−t) : 0. start_at ≥ P.end 인 살아 있는 행을 이동량만큼 앞당김.
   renews_at = 살아 있는 max(end_at); 살아 있는 기간이 없거나 max(end_at) ≤ t 면 expired + renews_at=t.
3. **관리자 해제(expireMembershipNow, t)**: end_at > t 인 살아 있는 행 중 진행 중인 행은 end_at=t, 미래 행은 void(reason admin_revoke). 구독 expired + renews_at=t.
4. **부분환불(B단계 — 이번 범위 밖)**: P 를 k일 줄이고 [newEnd, min(oldEnd,t)) 잠금, 뒤 기간 k 만큼 당김. 표 구조가 이를 지원해야 한다.
5. **잠금(전액환불)**: 창은 표의 P 원래 창(void 전 값) 그대로 — 사슬이라 다른 결제 창과 겹치지 않으므로 claimant·window_not_current 휴리스틱을 **삭제**한다.
   A단계 규칙은 유지: via:'membership' 열람 행 · 스냅샷 날 단위 판정(그날 전·카드·쿠폰·주제 단품 근거 있으면 유지) · 근거 조회 범위+페이지네이션(정렬 필수).
   **감사 먼저(write-ahead)**: 지울 식별자를 계산해 감사행을 먼저 insert → 스냅샷 삭제 → 열람 행 삭제. 부분 실패해도 식별자가 남고, 재실행은 표(void 된 P 창)로 같은 계산을 한다.
   잠금 실패는 주문 last_error + 운영 메일(alertOps 선례가 있으면 재사용) 로 드러낸다.
6. **환불 훅**: markPaymentOrderRefunded 전이 분기 — 표에 P 행이 있으면 2·5 를 실행(없으면 #820 의 일수 차감으로 폴백, 잠금은 skip 감사). partial 은 지금처럼 구독 유지.

## 테스트(가짜 DB, 행동 우선)
연속 A·B 에서 A 환불(B 당겨짐·A 창만 잠금) · B 먼저 환불 · 해제→재구매→옛 주문 환불(과다 없음) · 환불→재구매→환불(과소 없음) · 관리자 부여 사이 끼기 ·
지급 재시도 멱등 · 미래 기간 환불(잠금 없음, 당김) · 감사 먼저 + 부분 실패 재실행 · 스냅샷 날 규칙 회귀 · 정렬 없는 페이지 금지.

## 구현하며 정한 것 (2026-09-14, feat/membership-period-ledger)
- **함수**: `activateMembershipSubscription(userId, {plan, days, orderId?, now?, service?}) → {subscription, granted}` · `refundMembershipPeriod(userId, orderId)` (연산 2, 반환 = 표가 이 주문을 아는가) ·
  `expireMembershipNow` (연산 3) · `lockMembershipContentForRefund(userId, orderId, …)` (연산 5, 창을 표에서 읽는다) · `shortenMembershipForRefund` (#820 폴백).
- **지급 재시도 판정은 이 주문의 행이 하나라도 있으면**(무효 포함) — 설계의 "살아 있는 행"보다 좁혀서, 환불·관리자 해제로 무효된 주문이 재시도로 되살아나지 않게.
  앞 시도가 행만 쓰고 구독 갱신 전에 끊겼으면(구독 끝 < 살아 있는 끝) 구독만 살아 있는 끝으로 맞춘다(새 행·연장 없음). `granted` 일 때만 `membershipDaysGranted` 기록.
- **잠금 창 = 이 주문의 무효 행 전부의 [start_at, min(end_at, voided_at))** — void_reason 무관. 관리자 해제로 무효된 미래 기간은 빈 창(skip). 재실행도 같은 행에서 같은 창.
- **환불 시각 t = 원장 전이 시각(now)** — PG 취소 시각(`refunded_at`)이 아니다(기존 차감·잠금과 같은 기준).
- **폴백(표에 없는 086 이전 주문)**: `membershipDaysGranted` 일수 차감 + **표도 그 새 끝에서 자른다**(백필된 legacy 행이 옛 끝을 기억하면 다음 결제 base 로 뺀 기간이 되살아난다).
  잠금은 창을 몰라 skip(`no_refunded_period`). **원장 연산이 실패하면 폴백 차감을 겹치지 않는다**(두 번 빼기 방지 — last_error·운영 메일로 수동 보정).
- **skip 사유**: `no_refunded_period`(표에 이 주문 무효 행 없음 — 옛 주문·원장 실패) · `no_elapsed_window`(시작 전 환불·해제로 무효된 미래 기간).
  A단계의 `window_not_current`·`subscription_unknown`·`no_membership_periods`·`claimedByOrderId` 는 삭제.
- **감사 먼저**: 감사 insert 가 실패하면 던진다(아무것도 안 지운다). 감사 metadata 에 `orderId` 추가. 순서 = 감사 → 스냅샷 삭제 → 열람 행 삭제(①에서 읽은 id 만).
- **운영 메일**: 후처리 실패가 있으면 `sendOpsAlertEmail`(프로덕션 배포만, 실패 무시) — last_error 이어 붙임은 그대로.
- 주문 `metadata.membershipPeriods` 는 더 쓰지도 읽지도 않는다(A단계 브랜치 미머지라 프로덕션 주문엔 없다).

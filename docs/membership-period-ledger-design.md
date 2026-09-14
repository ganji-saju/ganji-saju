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
- 배제 제약 `membership_periods_live_no_overlap`: exclude using gist (user_id with =, tstzrange(start_at, end_at) with &&) where (voided_at is null) — btree_gist(schema extensions).
- `membership_periods_ms_precision`: start_at·end_at 은 ms 정밀도(check = date_trunc('milliseconds', …)). 두 제약은 create table 밖에서 drop if exists → add(옛 086 재적용에도 붙는다).
- RLS enable + 정책 없음(service 전용) + `revoke all on table ... from anon, authenticated`(083·085 교훈). 머리말에 적용 전/후 확인 쿼리.
- 백필: 지금 active·cancelled 이고 renews_at > now() 인 구독마다 source='legacy' 1행 [now(), renews_at). (잠금 대상 아님, 사슬 끝 맞추기용)
  백필 전에 그 구독들의 µs renews_at 을 ms 로 자르고 start 도 date_trunc('milliseconds', now()).

## 불변식
살아 있는(voided_at null) 기간은 겹치지 않고 끝을 이어 붙인 사슬이다. `subscriptions.renews_at` = 살아 있는 기간의 max(end_at)(없으면 expired).

## 연산 (전부 src/lib/subscription.ts 쪽, service 주입 가능)
1. **지급(activate)**: base = max(now, 살아 있는 기간 max(end_at) ?? subscriptions.renews_at) → [base, base+days) 행 추가(source payment/admin_grant), subscriptions upsert(renews_at=end, active).
   지급 재시도(같은 order_id 살아 있는 행이 있으면) → 행·구독 **변경 없음**(+60 버그 제거). (최종: base·재시도·#820 기록은 아래 "구현하며 정한 것")
2. **전액환불(주문 P, 시각 t)**: P 행 void(reason refund). 잠금 창 = [P.start, min(P.end, t)) (t < P.start 면 없음).
   뒤 기간 당기기: 이동량 = t < P.start ? (P.end−P.start) : t < P.end ? (P.end−t) : 0. start_at ≥ P.end 인 살아 있는 행을 이동량만큼 앞당김.
   renews_at = 살아 있는 max(end_at); 살아 있는 기간이 없거나 max(end_at) ≤ t 면 expired + renews_at=t.
3. **관리자 해제(expireMembershipNow, t)**: end_at > t 인 살아 있는 행 중 진행 중인 행은 end_at=t, 미래 행은 void(reason admin_revoke). 구독 expired + renews_at=t.
4. **부분환불(B단계 — 이번 범위 밖)**: P 를 k일 줄이고 [newEnd, min(oldEnd,t)) 잠금, 뒤 기간 k 만큼 당김. 표 구조가 이를 지원해야 한다.
5. **잠금(전액환불)**: 창은 표의 P 원래 창(void 전 값) 그대로 — 사슬이라 다른 결제 창과 겹치지 않으므로 claimant·window_not_current 휴리스틱을 **삭제**한다.
   A단계 규칙은 유지: via:'membership' 열람 행 · 스냅샷 날 단위 판정(그날 전·카드·쿠폰·주제 단품 근거 있으면 유지) · 근거 조회 범위+페이지네이션(정렬 필수).
   **감사 먼저(write-ahead)**: 지울 식별자를 계산해 감사행을 먼저 insert → 스냅샷 삭제 → 열람 행 삭제. 부분 실패해도 식별자가 남고, 재실행은 표(void 된 P 창)로 같은 계산을 한다.
   잠금 실패는 주문 last_error + 운영 메일(alertOps 선례가 있으면 재사용) 로 드러낸다.
6. **환불 훅**: markPaymentOrderRefunded 전이 분기 — 표에 P 행이 있으면 2·5 를 실행. partial 은 지금처럼 구독 유지. (최종: 폴백 삭제 — 아래)

## 테스트(가짜 DB, 행동 우선)
연속 A·B 에서 A 환불(B 당겨짐·A 창만 잠금) · B 먼저 환불 · 해제→재구매→옛 주문 환불(과다 없음) · 환불→재구매→환불(과소 없음) · 관리자 부여 사이 끼기 ·
지급 재시도 멱등 · 미래 기간 환불(잠금 없음, 당김) · 감사 먼저 + 부분 실패 재실행 · 스냅샷 날 규칙 회귀 · 정렬 없는 페이지 금지.

## 구현하며 정한 것 — 최종 (2026-09-14, feat/membership-period-ledger · 리뷰 반영)
- **함수**: `activateMembershipSubscription(userId, {plan, days, orderId?, now?, service?}) → {subscription, granted}` · `refundMembershipPeriod(userId, orderId)` (연산 2, 반환 = 표가 이 주문을 아는가) ·
  `expireMembershipNow` (연산 3) · `lockMembershipContentForRefund(userId, orderId, …)` (연산 5, 창을 표에서 읽는다).
- **#820 폴백 삭제 — 정본은 표 하나**: `shortenMembershipForRefund`·`refundedMembershipRenewal`·`membershipDaysToRemove`·`recordMembershipDaysGranted` 와
  `metadata.membershipDaysGranted` 기록을 없앴다(유료 멤버십 결제 0건이라 읽을 옛 주문도 없다). 폴백이 사슬을 '새 끝'에서 잘라 086 이후 결제 행을
  무효로 만들던 버그(O·Q 둘 다 환불했는데 멤버십 유지)가 같이 사라진다.
- **표에 없는 주문의 환불**: `refundMembershipPeriod` 가 false → 아무것도 안 바꾼다. 지급된 주문(`fulfilledAt`)이면 last_error 에 `membership_period_missing`
  (086 적용~배포 사이 옛 코드 지급 등) + 운영 메일. 지급 안 된 주문은 아무것도 안 함. 잠금은 skip 감사(`no_refunded_period`).
  수동 조치 = 구독 renews_at **과** 그 몫을 덮은 legacy 행(백필·자가치유 — 이후 결제가 그 뒤에 붙어 있다)을 같이 줄이거나 무효로 하고 뒤 행은 당긴 뒤
  086 드리프트 쿼리 0 확인. renews_at 만 빼면 하향 드리프트가 남아 다음 결제가 환불분을 되살린다.
  원장 연산이 실패(throw)하면 `membership_shorten_failed` 만 — '표에 없음'으로 겹쳐 적지 않는다. 수동 조치 = 구독 renews_at 을 살아 있는 사슬 끝으로
  (끝이 지났거나 없으면 expired + 지금). 그 전에 온 지급은 무효 행이 있어 자가치유하지 않으므로 틈을 굳히지 않는다(아래).
- **지급 base = max(지금, 살아 있는 사슬 끝)** + **상향 자가치유**: 구독 renews_at 이 그보다 뒤면 틈 [max(지금, 사슬 끝), renews_at) 을 source 'legacy' 행으로
  먼저 메우고 이어 붙인다(표가 추적 못 한 시간 — 옛 코드 지급·수동 SQL 연장, 잠금 대상 아님). base 만 올리면 새 결제 환불 때 구독이 사슬 끝으로 내려가 그 시간이 사라진다.
  **하향(renews_at < 사슬 끝 — 옛 코드 해제·환불)은 코드로 흡수하지 않는다** — 찢긴 지급(행만 쓰고 구독 갱신 실패)과 구별이 안 돼 유료 행을 지울 수 있다 → 배포 절차 + 드리프트 쿼리.
  **무효 행이 하나라도 있는 사용자는 치유하지 않는다**(적대적 리뷰): 찢긴 환불·해제(표는 무효·당기기까지 됐고 구독 갱신만 실패)는 구독 끝이 표보다 뒤인
  상향 틈과 모양이 같아, 치유하면 환불·해제된 기간을 legacy 로 굳히고 드리프트 쿼리도 0 이 된다. 무효 행은 새 코드의 환불·해제만 만들고 옛 코드 지급 틈은
  그 전에 생기므로(②~④ 사이 환불·해제 금지) 정당한 치유는 잃지 않는다. 남는 구멍: 해제가 진행 중 기간만 자르고(무효 행 없음) 구독 갱신 전에 끊기면 —
  관리자 화면이 500 을 보여 주니 다시 해제한다(재실행이 구독을 맞춘다). 수동 SQL 연장은 치유를 기대하지 말고 관리자 부여를 쓴다.
- **지급 재시도 판정은 이 주문의 행이 하나라도 있으면**(무효 포함) — 환불·관리자 해제로 무효된 주문이 재시도로 되살아나지 않게.
  앞 시도가 행만 쓰고 구독 갱신 전에 끊겼으면(구독 끝 < 살아 있는 끝) 구독만 살아 있는 끝으로 맞춘다(새 행·연장 없음 — 이 수리 경로는 유지).
- **겹침 배제 제약(DB)**: 살아 있는 기간 겹침을 DB 가 거부(23P01) — 결제 지급·관리자 부여 동시 실행 경합도 한쪽이 실패한다. 앱의 update 순서가 이를 지킨다:
  환불은 P 무효 → 당기기(start_at 오름차순) → 구독, 해제는 진행 중 끝 당기기·미래 무효(해제 시각 = 행 시작이면 무효 — 0 길이 금지), 지급·치유는 사슬 끝 뒤에만 insert.
  가짜 DB 도 같은 제약(23P01)과 CHECK(end_at > start_at, 23514)를 흉내 내 모든 시나리오가 불변식을 검증한다.
- **ms 정밀도**: 앱은 JS Date(ms)로 경계를 읽고 쓴다. µs 경계(수동 SQL·옛 finalize RPC 의 now()+interval)를 백필하면 새 행이 사슬 끝보다 1ms 미만 앞서
  그 사용자의 지급·부여가 매번 23P01 로 실패했다(적대적 리뷰 실측) → 086 이 백필 전 구독 renews_at 을 ms 로 자르고 표에 ms CHECK. 수동 SQL 은 date_trunc('milliseconds', …) 로.
- **잠금 창 = 이 주문의 무효 행 전부의 [start_at, min(end_at, voided_at))** — void_reason 무관. 관리자 해제로 무효된 미래 기간은 빈 창(skip). 재실행도 같은 행에서 같은 창.
- **환불 시각 t = 원장 전이 시각(now)** — PG 취소 시각(`refunded_at`)이 아니다(기존 차감·잠금과 같은 기준).
- **페이지**: 잠금 ①(창 안 via:'membership' 열람 행)과 근거 조회가 같은 페이지 루프(`readAllPages` — created_at·id 오름차순 + range)를 쓴다. 가짜 DB 는 id 로 끝나지 않는
  정렬의 range 를 throw, range 없는 select 는 1000행에서 자른다.
- **근거 — 레거시 전 주제 구매 포함**: 주제 단품 보유 = 이용권 행(범위 무관) 또는 앱 게이트 `getTasteProductEntitlement` 의 2순위 `getLegacyTasteProductEntitlement`
  (export, client 주입) 그대로. subscription → product-entitlements 정적 import 는 순환(product-scope → credits/detail-report-access → subscription)이라 동적 import.
- **skip 사유**: `no_refunded_period`(표에 이 주문 무효 행 없음 — 옛 코드 지급·원장 실패) · `no_elapsed_window`(시작 전 환불·해제로 무효된 미래 기간).
  A단계의 `window_not_current`·`subscription_unknown`·`no_membership_periods`·`claimedByOrderId` 는 삭제.
- **감사 먼저**: 감사 insert 가 실패하면 던진다(아무것도 안 지운다). 감사 metadata 에 `orderId`. 순서 = 감사 → 스냅샷 삭제 → 열람 행 삭제(①에서 읽은 id 만).
- **운영 메일**: 후처리 실패가 있으면 `sendOpsAlertEmail`(프로덕션 배포만, 실패 무시) — last_error 이어 붙임은 그대로.
- **배포 절차(086 머리말)**: ① 적용 전 확인 → ② 적용(+적용 후 확인·드리프트 0) → 이 PR 의 E2E 재실행(픽스처가 표를 쓴다 — ② 전엔 빨갛다)
  → ③ 곧바로 main 머지 + staging 밀기 → ④ 프로덕션·staging 배포와 main push E2E 가 끝난 뒤 드리프트 쿼리 재실행, 0 이 아니면 멈추고 보고(머리말의 정리 SQL).
  ②~④ 사이 관리자 멤버십 부여/해제·멤버십 환불 금지, 옛 코드 런타임(프리뷰·로컬 dev·옛 브랜치 — 같은 DB)에선 계속 금지. 드리프트 = `chain_vs_renews`(살아 있는 사슬 끝이
  미래인데 renews_at 과 다름) + `entitled_without_end`(권한 남은 구독인데 renews_at 에서 끝나는 살아 있는 행 없음). 적용 직후 확인만으로는 ②~④ 사이 옛 코드가 만든 어긋남을 못 본다.
  ⚠️ 드리프트 쿼리를 주기적으로(헬스·일일 크론) 돌릴지는 사용자 결정 — 지금은 1회성.
- **E2E 픽스처**(`e2e/fixtures/entitlement-helpers.ts`): seed = 그 사용자의 살아 있는 행 무효(e2e_reset) → admin_grant 행 [지금, +30일) → 구독 upsert,
  cleanup = 살아 있는 행 무효 → 구독 expired. 구독만 쓰던 픽스처가 공유 DB 에 어긋남을 남겨 ④ 를 거짓 경보로 멈추고 해제된 기간을 되살릴 수 있었다.
- 주문 `metadata.membershipPeriods` 는 더 쓰지도 읽지도 않는다(A단계 브랜치 미머지라 프로덕션 주문엔 없다).

# 오프라인 할인쿠폰 설계 (v2)

> 2026-09-11. 전단·명함에 인쇄해 배포하는 할인코드.
> v1 은 서브에이전트 8개(조사 5 + 설계 3)로 만들었고, v2 는 적대적 검수 18개(4렌즈 + 실증 14)를 거쳐
> **v1 의 핵심 전제 3개가 틀린 것을 확인하고 고친 판**이다. v1 결함은 §0 에 남긴다 — 같은 실수를 반복하지 않기 위해.

---

## 0. v1 이 틀렸던 곳 (검수로 확인)

| # | v1 주장 | 실제 | 영향 |
|---|---|---|---|
| 1 | "표시가 초크포인트 2곳" | **21파일 / 55호출부.** 가격 표시는 `resolvePackagePrice` 가 아니라 루트 레이아웃의 **전역 캐시 맵**(`getPriceDisplayMap` → `PriceProvider` → `<Price>`)에서 나온다. `layout.tsx` 에 인증 호출이 0건이라 **사용자별로 만들 수 없다** | 표시 전략 전면 수정(§3) |
| 2 | "21종 전 상품이 초크포인트를 지난다" | **14종.** 7종은 prepare 410 으로 잘린다. 게다가 **전(코인) 차감 언락 2경로는 결제 원장을 통째로 우회**한다 | 적용 범위 재정의(§3·§7) |
| 3 | "환불은 이미 `order.amount` 를 본다 → 자동 정확" | **세 번째 환불 경로가 카탈로그 정가로 환불한다.** 쿠폰과 무관하게 **현존 버그**(§9) | 선행 수정 필요 |
| 4 | §5-2 의 CAS SQL | `where bound_user_id is null` 이라 **본인 두 번째 결제에서 0행** — 요구 7 을 스스로 차단 | SQL 수정(§5) |
| 5 | "24시간 자동 회수로 태우기 공격 차단" | `payment_orders.expires_at` 을 보는 곳이 **정산 크론뿐**이라 옛 할인 주문이 무기한 살아 있다 → 한 코드로 두 명이 할인받는 창이 그대로 재현 | 승인 직전 재검증(§5-4) |
| 6 | "계정당 1개가 상한을 만든다" | **계정 생성 = 이메일 인증 없는 POST 1회**(`signup/route.ts:149` `email_confirm: true`). 레이트리밋 인프라 0건 | 신원 앵커 필요(§6) |

**기각된 지적 1건**: "990원 상품이 3종" → `taste_today_basic`·`taste_dream_search` 는 **판매중단**이라 실제 990원 판매 상품은 `taste_dialogue_entry` 1종.

---

## 1. 요구사항 → 구현 매핑

| # | 요구 | 구현 | 강제 주체 |
|---|---|---|---|
| 1 | 코드 입력 → 할인 | 체크아웃에서 입력, 서버가 계산 | `prepare` |
| 2 | 할인률을 관리자가 변경 | `coupon_tiers.percent` (유일 정본) | `/admin/coupons` |
| 3 | `ganji{NN}{일련번호}`, 최대 50% | 접두는 **등급 라벨**, 상한은 계산 함수에서 clamp | 파서 + `Math.min(p,50)` |
| 4 | 한 사람이 쓰면 타인 사용 불가 | `bound_user_id` CAS | DB |
| 5 | 중복 적용 불가 | 계정당 1개라 **자동 성립** | 스키마 |
| 6 | 계정당 쿠폰 1개 | `unique(bound_user_id) where not null` | DB 부분 유니크 인덱스 |
| 7 | 본인은 반복 사용 | 사용 횟수 컬럼 없음(귀속=상태) + CAS 에 `or bound_user_id = $user` | 설계 |
| 8 | 전 유료메뉴 적용 | **현금 결제 전 표면**(§3). 전 차감 경로는 명시적 제외 | 컴파일러 + CI 가드 |

---

## 2. 코드의 숫자는 할인율이 아니라 **등급 라벨**이다

요구 2 와 요구 3 을 둘 다 정본으로 두면 반드시 어긋난다.

| 계층 | 값 | 바꿀 수 있나 |
|---|---|---|
| 코드 접두 `ganji**20**0137` | 등급 라벨 `tier='20'` | ✗ 인쇄물은 롤백 불가 |
| `coupon_tiers.percent` | **실제 적용률 = 유일 정본** | ✓ super_admin |
| `discount_coupons.bound_percent` / `bound_max_discount_won` | 귀속 순간 스냅샷 | ✗ (소급은 체크박스 + 감사) |
| `payment_orders.coupon_percent` | 그 주문에 적용된 율 | ✗ 정산·분쟁 증거 |

⚠️ v1 지적 반영: **상한(`max_discount_won`)도 함께 스냅샷**한다. 요율만 얼리고 상한을 안 얼리면
"관리자가 내려도 안 깎인다"는 약속이 상한 축에서 깨진다.

⚠️ `percent` 는 `check (between 1 and 50)` — **0 을 허용하지 않는다.** 0% 로 귀속되면 계정당 1개 제약 때문에
그 계정은 영구히 다른 쿠폰을 못 쓴다. 등급을 끄려면 `disabled_at` 을 쓴다.

---

## 3. 적용 범위: 청구는 4개 초크포인트, 표시는 체크아웃만

### 3-1. 청구 초크포인트 (v1 그대로 유효)

| 대상 | 개수 | 위치 |
|---|---|---|
| `payment_orders` insert | 1 | `order-ledger.ts` `createPaymentOrder` |
| 그 호출부 | 1 | `prepare/route.ts:387` |
| PG SDK 호출 | 1 | `toss-membership-checkout.tsx` |
| 승인 확정 | 1 | `fulfillPaymentOrder` (3경로 통과) |

→ **prepare 410 을 통과하는 14종**이 예외 없이 이 4개를 지난다.

### 3-2. 🔴 표시는 사용자별로 못 만든다 — 체크아웃에서만 할인 표기

가격 표시의 진짜 정본은 `getPriceDisplayMap` → 루트 레이아웃 `PriceProvider` → `<Price>` 이고
**21파일 / 55호출부**가 소비한다. `layout.tsx` 에는 인증 호출이 0건이라 정적 렌더이고,
`admin/pricing/route.ts:71` 의 `revalidatePath('/','layout')` 로 무효화되는 **전 방문자 공유 캐시**다.

> 여기에 userId 의존 값을 넣으면 앱 전체가 사용자별 동적 렌더가 되어 캐시가 폐기되고,
> `search-index`·`generateMetadata`·PDF 처럼 **사용자 컨텍스트가 아예 없는** 소비처는 담을 그릇조차 없다.

**결정: 전 표면은 정가를 유지하고, 할인은 체크아웃에서만 표기한다.**
(일반 커머스의 쿠폰 UX 와 동일 — 상품면 정가, 체크아웃에서 적용. 코드 diff 0.)

🔴 **금지 조항**: `getPriceDisplayMap`/`PriceProvider` 맵에 user·coupon 의존 값을 넣지 않는다.
→ §12 가드 테스트로 고정("`buildPriceDisplayMap` 입력에 user/coupon 인자가 없다").

### 3-3. 체크아웃 한 화면 안에서는 표시가 = 청구가

`checkout/page.tsx:325` 는 `auth.getUser()` 를 부르는 **동적 페이지**라 사용자별 계산이 성립한다.

```ts
resolveChargeForUser(pkgId, userId, couponCode?)
  → { listAmount, discountWon, chargeAmount, couponCode, percent, reason }
```
- 3번째 인자로 **미입력 코드까지 미리보기**한다(화이트리스트·`disabled_at`·`expires_at`만 확인, `bound_user_id` 는 안 건드림).
  → 별도 preview 라우트 불필요. 코드 입력은 `<form method="get">` + 서버 재렌더로 처리.
- 🔴 이 함수가 **반복 사용 경로의 유일한 검사 지점**이다. 조회 조건에 `disabled_at is null`,
  `(expires_at is null or expires_at > now())`, `tier.disabled_at is null` 을 **전부** 넣는다.
  (v1 은 귀속 후 재검사가 없어 만료·킬스위치가 실효 0 이었다)

🔴 **같이 고쳐야 하는 것 3개** (v1 은 1개만 지적했다):
1. `toss-membership-checkout.tsx:215` — `prepare.amount > 0 ? prepare.amount : amount` 폴백 **제거**.
   서버 금액이 없으면 **결제 중단**(할인 실패 시 조용히 정가 청구를 막는다).
2. `checkout/page.tsx:448`(GTM `value`) · `:632`(prop) 의 `?? paymentPackage.price` 폴백 2곳.
3. `prepare/route.ts:460` 응답을 `amount: order.amount` 로. `resolvedAmount` 를 응답에서 참조하지 못하게 한다.
   → **타입이 못 잡는 자리다.** 여기가 어긋나면 `confirm:66`·`nicepay-return:216` 이 **전건 거부** = 매출 0 사고.

---

## 4. 데이터 모델 (`supabase/migrations/079_discount_coupons.sql`)

v1 §4 를 기준으로 하되 아래를 반영한다(전문은 구현 PR 에서 확정).

```sql
create table public.coupon_tiers (
  tier text primary key check (tier in ('10','20','30','40','50')),
  percent integer not null check (percent between 1 and 50),   -- 🔴 0 금지
  max_discount_won integer check (max_discount_won is null or max_discount_won > 0),
  disabled_at timestamptz, updated_at timestamptz not null default now(), updated_by text
);

create table public.discount_coupons (
  code text primary key check (code ~ '^ganji(10|20|30|40|50)[0-9a-z]{4,8}$'),
  tier text not null references public.coupon_tiers(tier),
  batch text,                                   -- 인쇄 배치 = ROI 조인 키
  identity_hash text,                           -- 🔴 지속 신원 앵커(§6). 계정 수명과 분리
  bound_user_id uuid,                           -- auth.users FK 없음
  bound_at timestamptz,
  bound_percent integer check (bound_percent between 1 and 50),
  bound_max_discount_won integer,               -- 🔴 상한도 스냅샷
  bound_origin text,                            -- production|staging
  expires_at timestamptz not null,              -- 🔴 NULL 금지(§9-D)
  disabled_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index discount_coupons_one_per_user
  on public.discount_coupons(bound_user_id) where bound_user_id is not null;
create unique index discount_coupons_one_per_identity
  on public.discount_coupons(identity_hash) where identity_hash is not null;  -- 🔴 사람당 1개
```
`payment_orders` 스냅샷 추가: `list_amount` · `discount_won` · `coupon_code` · `coupon_percent`.
**`amount`(실청구액)의 의미는 바꾸지 않는다** — 승인 대조·환불·집계가 전부 이 값을 본다.

RLS on + **정책 없음**(service role 전용). 072 식 "본인 select" 를 복사하지 말 것 —
미사용 코드 목록은 곧 현금 목록이다.

> `user_coupons`(072)를 재사용하지 않는 이유: `status: issued→redeemed` 1회용 종료상태라
> **요구 7(반복 사용)을 표현할 수 없고** `code` 컬럼이 없다.

---

## 5. 귀속(bind)

### 5-1. 귀속 = 상태, 시점 = `prepare` (410 가드·중복구매·동의 검증을 통과한 뒤)

결제확정 귀속은 "두 사용자가 각자 결제를 마친 뒤에야 한쪽만 귀속"되는 창이 열려 **되돌릴 수 없는 할인**이 나간다.
돈이 틀리는 쪽보다 코드가 타는 쪽이 낫다.

### 5-2. 🔴 CAS SQL — 요구 7 을 막지 않도록

```sql
update discount_coupons c
   set bound_user_id = $user, bound_at = now(),
       bound_percent = $pct, bound_max_discount_won = $cap
 where c.code = $code
   and c.disabled_at is null
   and (c.expires_at is null or c.expires_at > now())
   and ( c.bound_user_id is null                     -- 최초 귀속
      or c.bound_user_id = $user                     -- 🔴 본인 반복(v1 이 빠뜨린 절)
      or not exists (                                -- 미결제 회수
           select 1 from payment_orders o
            where o.coupon_code = c.code and o.user_id = c.bound_user_id
              and o.status in ('prepared','in_progress','confirmed','fulfilling','fulfillment_failed')
         ) and c.bound_at < now() - interval '24 hours' )
```
- 회수 판정을 `first_used_at` 스탬프가 아니라 **주문 원장**으로 옮긴다.
  (v1 은 "스탬프 실패는 무시한다"면서 그 스탬프를 소유권 판정의 유일 근거로 썼다 — 자기모순)
- `fulfillment_failed` 도 **돈이 나간 주문**이므로 차단 쪽에 둔다.
- 본인 재입력(`bound_user_id = $user`)이 0행이 되지 않으므로 "이미 사용된 코드" 오표기도 사라진다.

### 5-3. 승인 **직전** 재검증 (v1 에 없던 관문)

`payment_orders.expires_at` 을 검사하는 곳은 정산 크론뿐이라, 할인가가 박힌 `prepared` 주문은
**무기한 결제 가능**하다. 캠페인 종료·코드 회수·요율 인하 이후에도 옛 주문이 옛 할인가로 승인된다.

```ts
// src/lib/payments/coupon-order-guard.ts — 할인 주문에만 적용(일반 결제 회귀 0)
// 호출: confirm/route.ts:88(attachPaymentKeyToOrder 직전) · nicepay/return/route.ts:236(approve 직전)
```
→ `disabled_at`·`expires_at`·`bound_user_id === order.userId` 중 하나라도 어긋나면 **승인 거부**.
금액 대조 때문에 "정가로 재승인"은 불가하므로 거부가 맞다.
⚠️ `fulfillPaymentOrder` 는 **승인 이후**라 늦다.

---

## 6. 🔴 부정사용: "계정이 비싸다"는 전제가 거짓이다

`signup/route.ts:149` 가 `email_confirm: true` 로 **이메일 인증을 건너뛴다.** 아무 문자열이나 이메일로
넣으면 즉시 계정이 생성되고, 저장소에 레이트리밋 인프라는 0건이다.
→ **계정당 1개 · 시도 제한 · 24시간 회수 세 방어가 동시에 무너진다.**

또 `bound_user_id` 에 FK 를 안 거는 것만으로는 **재가입 초기화를 못 막는다**.
075·076 의 교훈은 "FK 제거"가 아니라 **계정 수명과 분리된 지속 신원 앵커**다.

### 대책: 쿠폰 등록에 신원 앵커를 요구한다

| 안 | 앵커 | 강도 | 비용 |
|---|---|---|---|
| **A (권장)** | 카카오 OAuth `kakaoUidHash` — 075 가 이미 쓰는 함수 | 카카오 가입에 휴대폰 인증 필요 → 실질 비용 있음 | 이메일 가입자는 쿠폰 사용 불가 |
| B | 구글 `sub` 해시 | 중간(무료 계정 양산 가능) | 낮음 |
| C | 앵커 없음(v1) | **0** | — |

**A 채택 시**: `identity_hash` = `kakaoUidHash(kakao_uid)`, 부분 유니크 인덱스로 **사람당 1개**.
탈퇴·재가입해도 같은 카카오 계정이면 코드가 부활하지 않는다(075 와 동일 구조).

그 외 방어는 v1 §6 유지: 화이트리스트 절대 조건 · 코드 추측 시도 제한(056 `consume_member_benefit`
원자적 일일 카운터 **재사용**, 새 테이블 만들지 않음) · `disabled_at` 회수 · staging 가드.

⚠️ **staging 오염**: staging 과 프로덕션이 같은 Supabase 를 쓴다. `bound_origin` 은 기록일 뿐 가드가 아니다.
→ staging 에서는 `batch='staging-test'` 코드만 허용하는 **차단 가드**를 넣는다(fail-closed).

---

## 7. 적용 대상에서 **명시적으로 제외**하는 것

| 대상 | 이유 |
|---|---|
| **전(코인) 차감 언락** (`/api/today-fortune/unlock`, `/api/fortune-calendar/unlock`, 대화상담) | `deduct_credits` RPC 로 끝나고 `payment_orders`·PG·`fulfillPaymentOrder` 를 **통째로 우회**한다. 이미 산 재화를 쓰는 것이지 현금 결제가 아니다 |
| **판매중단 7종** | prepare 410 |
| `taste_dialogue_entry` (990원) | 🔴 전달물이 이용권이 아니라 **전 3개**(`fulfillment.ts:218`). 쿠폰이 **재화 할인**이 되어 다른 상품 가격 페그를 깨뜨린다(상한 50% 가 실효로 더 커진다) |

🔴 **화면이 이유를 말해야 한다.** 쿠폰 보유자가 페이월에서 "3전으로 열기"와 "3,300원으로 열기"를 나란히 보는데
할인이 후자에만 붙으면 전으로 여는 사람이 손해다. "쿠폰은 현금 결제에만 적용됩니다" 를 표기한다.
(멤버십 통과가 안 보이면 버그 신고가 된다 — 같은 구조)

---

## 8. 0원·최소금액

상한 50% × 최저 판매가 3,300원 = 1,650원. **0원 도달 경로 없음.**
방어 4중: `check (1..50)` → API 재검증 → `Math.min(p,50)` clamp → `payment_orders.amount CHECK (>0)`.

⚠️ PG 최소 승인금액은 나이스페이 매뉴얼에 **일시불 하한이 명시돼 있지 않다**(할부만 5만원↑).
`taste_dialogue_entry` 를 §7 에서 제외했으므로 v1 의 `MIN_CHARGE_WON` 논쟁은 **사라진다**.

---

## 9. 🔴 선행 수정: 쿠폰과 무관한 **현존 버그**

**전(錢) 결제 환불이 카탈로그 정가로 계산된다.**
- `fulfillment.ts:180·218` 이 `addCredits` metadata 에 `amount` 를 **안 싣는다**
- → `credit-refunds.ts:132` 의 `readNumber(row.metadata,'amount')` 가 **항상 null**
- → `?? pkg?.price` 정가 폴백이 100% 쓰인다 (주석엔 "실결제액 우선"이라 적혀 있는데 그 값을 쓰는 곳이 없다)

지금은 990원 결제 = 990원 정가라 **우연히 맞아서** 안 보인다. `/admin/pricing` 으로 가격을 바꾸는 순간
과다환불이 난다. **쿠폰 작업과 별개로 먼저 고쳐야 한다.**

수정: ① `addCredits` metadata 에 `amount: claimed.amount` 추가(1줄 × 2)
② `credit-refunds.ts:132` 의 `?? pkg?.price` **삭제** — 모르면 `null`(실패-닫힘)이 맞다.
정가 폴백은 "모르는 금액"을 "그럴듯한 금액"으로 바꿔 PG 에 잘못된 취소액을 쏘는 장치다.

**번들 결제내역 정가 표시**도 같은 계열이다(`payment-history.ts:125` `?? getPackage().price`).
⚠️ 단순히 carrier 구성품에 금액을 넣으면 **더 나빠진다** — `bundlePriceCarrierIds` 가 `amount=null` 행 중에서만
carrier 를 고르므로 금액을 넣은 행이 스캔에서 빠지고 남은 null 행이 새 carrier 가 되어 정가가 **한 번 더** 붙는다.
별도 PR 로 다룬다.

---

## 10. 환불·정산·통계

| 항목 | 처리 |
|---|---|
| 환불 금액 | **실청구액(`order.amount`)**. 🔴 정가를 넣으면 즉시 과다환불 |
| 전액/부분 판정 | `isFullRefund(amount vs original_amount)` — 둘 다 `order.amount` |
| 매출 집계 | `revenue_won += order.amount` — 할인 후 순매출 자동 |
| GA4 purchase | `order.amount` 서버 정본 — 자동 |
| GA4 `begin_checkout`·`add_payment_info` | prepare **이전**에 prop 으로 발사된다 → prop 을 `chargeAmount`(할인 후)로 내리고 `listAmount` 는 취소선용 **별도 prop** |
| 쿠폰 ROI | `batch` + `coupon_code` + `discount_won` 조인 |

---

## 11. ✅ 결정 완료 (2026-09-11 사용자 확정)

| | 결정 | 반영 |
|---|---|---|
| **A. 일련번호** | **4자리**. 인쇄 형식 `ganji-10-0000`, 저장은 정규형 `ganji100000` | `parseCouponCode` 가 하이픈·공백·대소문자를 흡수 |
| **B. 사용 조건** | **로그인 계정이면 사용 가능**(구글·카카오·이메일). 소셜 전용으로 제한하지 않음 | 신원 앵커(`identity_hash`) **미도입** |
| **C. 인쇄물 문구** | 미정. 코드 형식만 `ganji-10-0000` 확정 | — |
| **D. 만료일** | **2027-12-31 까지**, 관리자가 변경 | `expires_at` 기본값 + 관리자 일괄 변경 |

### 🔴 B 결정이 남기는 위험 (수용된 것)

`signup/route.ts:149` 가 `email_confirm: true` 로 이메일 인증을 건너뛴다 → **계정 생성 비용이 사실상 0**.
따라서 "계정당 쿠폰 1개"는 **손실 상한이 되지 못한다.** 봇이 계정을 양산해 전단 코드를 귀속만 시켜
무력화할 수 있다(태우기 공격).

남은 완화책은 셋뿐이고, 전부 **사후 대응**이다:
1. 24시간 미결제 자동 회수(§5-2) — 공격 비용을 24시간마다 재시도로 올린다
2. 코드 추측 시도 제한 — 056 `consume_member_benefit` 원자적 일일 카운터 재사용
3. `disabled_at` **배치 단위 회수** — 전단이 비정상적으로 빨리 소진되면 그 `batch` 를 통째로 끄고 재발행

→ **운영 지표가 방어의 일부다.** 관리자 화면에 "배치별 귀속 속도"를 넣어, 하루에 수백 장이 귀속되는데
결제는 0 인 패턴이 보이면 사람이 개입할 수 있게 한다(§12 PR6).

⚠️ 4자리(등급당 10,000개)는 전수 열거가 가능하다. 화이트리스트가 **수확**은 막지만(발급 안 된 코드는
무효), **소진**은 막지 못한다. 발급량을 실제 인쇄 수량만큼만 유지하고 순차가 아닌 **무작위 4자리**로
발급하면 성공률이 발급량/10,000 로 떨어진다 — 500장 뿌리면 5%.

---

## 11-A. (참고) 검토했으나 채택하지 않은 것

### A. 일련번호 자릿수 — **4자리로 확정**
`ganji{NN}{4자리}` = 등급당 **10,000개**가 전부. 화이트리스트가 수확은 막지만 **소진 공격**은 열거 가능.
→ **뒤 6자리 영숫자 권장**(공간 20억+). 4자리 유지 시 반드시 **무작위 발급**(순차 금지).
**인쇄 발주 전이면 지금이 마지막 시점이다.**

### B. 신원 앵커 — **미도입으로 확정**(위 위험 수용)
카카오 OAuth 필수로 할 것인가. 안 하면 계정 무한생성으로 전단이 하루 만에 무력화될 수 있다.

### C. 인쇄물 문구
등급 숫자를 인쇄하면 관리자가 요율을 바꿀 때 신규 고객이 괴리를 본다.
→ **"최대 50% 할인 · 할인율은 결제 화면에서 확인"** 권장.

### D. 만료일 — **2027-12-31 로 확정**(관리자 변경 가능)
자동청구가 없어 멤버십 49,000원은 **매달 수동 재결제**다. 쿠폰은 "상태"라 매달 붙는다.
→ 만료 없는 50% 쿠폰 1장 = **매달 24,500원 영구 손실**.
**`expires_at` 을 NULL 금지로 하고 발급 화면에서 캠페인 종료일을 필수 입력**(기본 발급일+90일).
멤버십만 "최초 1회 결제 한정"으로 두는 것도 요구 7 을 훼손하지 않는다
— 요구 7 은 "여러 상품에 반복 사용"이지 "같은 구독을 영구 할인"이 아니다.

---

## 12. 구현 순서

| PR | 내용 |
|---|---|
| **0** | **선행**: 전 결제 환불 정가 버그(§9) — 쿠폰과 무관하게 현존 |
| 1 | 마이그레이션 079 + 순수 함수(`parseCouponCode`·`applyCouponDiscount`) + 단위테스트 |
| 2 | `createPaymentOrder` 시그니처 교체 + **prepare 응답 `amount: order.amount`** — 기능 변화 0 |
| 3 | prepare 쿠폰 수신·귀속·할인 + `resolveChargeForUser` + 체크아웃 표시 + 폴백 3곳 제거 |
| 4 | 승인 직전 재검증 가드(§5-3) |
| 5 | 체크아웃 쿠폰 입력 UI |
| 6 | `/admin/coupons` — 요율 편집 + 대량 발급 + 현황 + **[귀속 해제]**(구제 수단, v1 에 없었음) |
| 7 | CI 가드 테스트 |

## 13. 가드 테스트 (불변식)

1. `applyCouponDiscount` — 50% 초과 clamp / 원 단위 절사
2. `parseCouponCode` — 정규화, 위조 등급 거부, 미발급 코드 거부
3. **초크포인트 불변식**: `createPaymentOrder` 호출부 1곳 · PG SDK 1곳 · `payment_orders` insert 1곳
4. **`prepare` 응답 `amount` === 생성된 `order.amount`** (타입이 못 잡는 자리)
5. **`prepare` 가 body 에서 `discountRate|discountPercent|finalAmount` 를 읽지 않는다**
6. **`buildPriceDisplayMap` 입력에 user/coupon 인자가 없다** (전역 캐시 오염 방지)
7. 귀속 CAS — 동시 2요청 중 1건만 / **본인 재요청은 성공**(요구 7)
8. 반복 사용 — 귀속 계정이 서로 다른 상품 3건 결제 시 전부 할인
9. 환불 — 할인 결제의 환불액이 `order.amount`
10. 만료된 쿠폰의 옛 `prepared` 주문이 승인 거부되는지(§5-3)

## 14. 포기한 것
캠페인 관리 · 다중 쿠폰 스택 · 조건부 할인 · 배치 일괄 무효화 · 쿠폰 이전.

# 02. Paid Funnel Audit — 결제 카탈로그 · 권한 매트릭스 · sandbox 흐름

> 2026-05-13 · 라이브 sandbox (`http://localhost:3100` + 테스트 Supabase + 토스 `test_ck_/test_sk_`)
> 5×10 페르소나 매트릭스 + 결제 prepare→confirm 트레이스 + **P0-1 멱등성 실증**

---

## 1. 카탈로그 SSOT (단일 출처)

[`src/lib/payments/catalog.ts`](../src/lib/payments/catalog.ts)에 14개 상품 정의.

| id | kind | name | credits | price (KRW) | scope | 실증 |
|---|---|---|---:|---:|---|---|
| `credit_1` | credit_pack | 체험 1 코인 | 1 | 500 | — | ⚠️ P0-1 영향 |
| `credit_3` | credit_pack | 스타터 3 코인 | 3 | 990 | — | ⚠️ P0-1 영향 |
| `credit_7` | credit_pack | 기본 7 코인 | 7 | 2,000 | — | ⚠️ P0-1 영향 |
| `subscription_30` | subscription (bonus pack) | 보너스 36 코인 | 36 | 9,900 | — | ⚠️ P0-1 영향 |
| `membership_plus` | subscription | 라이트 대화 멤버십 | 2/월 | 4,900/월 | plus_monthly | ✅ user_id PK |
| `membership_premium` | subscription | 프리미엄 대화 멤버십 | 10/월 | 9,900/월 | premium_monthly | ✅ user_id PK |
| `taste_today_detail` | taste_product | 오늘 자세히 보기 | — | 550 | reading slug | ✅ DB UNIQUE |
| `taste_love_question` | taste_product | 연애 마음 확인 | — | 990 | global | ✅ DB UNIQUE |
| `taste_money_pattern` | taste_product | 돈이 새는 패턴 | — | 990 | global | ✅ DB UNIQUE |
| `taste_work_flow` | taste_product | 일/직장 흐름 | — | 990 | global | ✅ DB UNIQUE |
| `taste_monthly_calendar` | taste_product | 월간 달력 | — | 1,900 | reading slug | ✅ DB UNIQUE |
| `taste_year_core` | taste_product | 올해 핵심 3줄 | — | 3,900 | reading slug | ✅ DB UNIQUE |
| `lifetime_report` | lifetime_report | 보관형 사주 리포트 | — | 49,000 | reading slug | ✅ paymentKey check |

---

## 2. 서버 측 SSOT 검증 결과 — ✅ 안전

### Prepare API ([prepare/route.ts:53](../src/app/api/payments/prepare/route.ts))
```ts
const pkg = getPackage(packageId);
if (!pkg) return 400;
```
클라이언트의 `pkg` 객체를 신뢰하지 않고 catalog 재조회.

### Confirm API ([confirmation.ts:55-57](../src/lib/payments/confirmation.ts))
```ts
const pkg = getPackage(packageId);
if (!pkg || pkg.price !== amount) return { ok: false, error: '잘못된 결제 정보입니다.' };
```
catalog 가격과 클라이언트 amount 1원 단위 일치 검증.

### 라이브 검증 (Phase 5)
| 시나리오 | 응답 | 검증 |
|---|---|---|
| 정상 prepare credit_3 | 200 `{ok:true, authenticated:true, alreadyPurchased:false}` | ✅ |
| 가짜 paymentKey confirm | **400** "결제 시간이 만료되어 결제 진행 데이터가 존재하지 않습니다." | ✅ Toss 거부, addCredits 미호출 |
| 금액 조작 (amount: 1, packageId: credit_3) | **400** "잘못된 결제 정보입니다." | ✅ catalog SSOT 검증 동작 |
| 비로그인 confirm | **401** "로그인이 필요합니다." | ✅ auth gate 동작 |

---

## 3. UI 측 SSOT 위반 — 🟠 P1 (13곳 하드코딩)

서버는 안전하지만 UI 텍스트가 catalog를 참조하지 않아 표시가-청구가 불일치 위험.

| 위치 | 하드코딩 가격 | 권고 |
|---|---|---|
| [src/app/membership/checkout/page.tsx:71-111](../src/app/membership/checkout/page.tsx) | 550/990/990/990/1,900/3,900 | `PAYMENT_PACKAGES.find(p=>p.id===id).price` |
| [src/content/moonlight.ts:263-313, 970-990, 1206-1222](../src/content/moonlight.ts) | 550/990/1,900/3,900/4,900/9,900/49,000 | packageId만 두고 컴포넌트에서 lookup |
| [src/content/gangi-market.ts:92-110](../src/content/gangi-market.ts) | 550원~/990원 | 동상 |
| [src/components/gangi/gangi-ui.tsx:25-32](../src/components/gangi/gangi-ui.tsx) | 550원~/990원~ | 동상 |
| [src/components/today-fortune/premium-lock-card.tsx:37,85](../src/components/today-fortune/premium-lock-card.tsx) | "550원 또는 {coinCost}코인" / "550원 바로 열기" | 동상 |
| [src/components/today-fortune/today-premium-panel.tsx:48](../src/components/today-fortune/today-premium-panel.tsx) | "550원 풀이" | 동상 |
| [src/components/ai/fortune-calendar-panel.tsx:700](../src/components/ai/fortune-calendar-panel.tsx) | "1,900원으로 열기" | 동상 |
| [src/app/membership/page.tsx:24](../src/app/membership/page.tsx) | `'49,000원'` | 동상 |
| [src/app/pricing/page.tsx:22,51](../src/app/pricing/page.tsx) | metadata description "550원/990원" | metadata도 동적 생성 |
| [src/app/saju/[slug]/page.tsx:436](../src/app/saju/[slug]/page.tsx) | "오늘 자세히 보기 · 550원" | 동상 |
| [src/app/saju/[slug]/today-detail/page.tsx:159,168,199](../src/app/saju/[slug]/today-detail/page.tsx) | 잠금 카드 "550원..." 3회 | 동상 |
| [src/app/saju/[slug]/premium/page.tsx:443](../src/app/saju/[slug]/premium/page.tsx) | "깊은 사주풀이 · 49,000원" | 동상 |
| [src/features/home/compatibility-section.tsx:50](../src/features/home/compatibility-section.tsx) | "990원 이상" | 동상 |

**권고**: `formatPriceLabel(pkg, style: 'simple'|'from'|'tilde')` 헬퍼 도입 + CI grep 차단 룰 추가.

---

## 4. 5-페르소나 × 10-라우트 매트릭스

### 페르소나 시드 결과
| persona | balance | sub_balance | subscription | entitlement |
|---|---:|---:|---|---|
| guest   | — | — | none | none |
| fresh   | 3 (auto signup_bonus) | 0 | none | none |
| credit  | 10 | 0 | none | none |
| plus    | 3 | 2 | plus_monthly active | none |
| premium | 3 | 10 | premium_monthly active | today-detail (scope: today:d2d157dd-…) |

신규가입 보너스 트리거(`handle_new_user`)가 4명 모두에게 +3 자동 부여 ✓

### 결과 매트릭스

| 라우트 | guest | fresh | credit | plus | premium |
|---|---|---|---|---|---|
| `/`             | 200 OK | 200 OK | 200 OK | 200 OK | 200 OK |
| `/free`         | 200 OK | 200 OK | 200 OK | 200 OK | 200 OK |
| `/pricing`      | 200 OK | 200 OK | 200 OK | 200 OK | 200 OK |
| `/saju/new`     | 200 OK | 200 OK | 200 OK | 200 OK | 200 OK |
| `/credits`      | 200 OK | 200 OK | 200 OK | 200 OK | 200 OK |
| `/dialogue`     | 200 OK | 200 OK | 200 OK | 200 OK | 200 OK |
| `/my/results`   | **→ /login** | 200 OK | 200 OK | 200 OK | 200 OK |
| `/my/billing`   | **→ /login** | 200 OK | 200 OK | 200 OK | 200 OK |
| `/membership/checkout` | 200 OK | 200 OK | 200 OK | 200 OK | 200 OK |
| `/saju/[premium-reading]/today-detail` | **LOCK** | **LOCK** | **LOCK** | **LOCK** | **200 풀콘텐츠** |

### 콘텐츠 크기로 본 entitlement 효과
- today-detail Guest/Fresh/Credit/Plus: 41,859–41,908 bytes (잠금 카드만)
- today-detail Premium: **60,180 bytes** (+18KB 풀 콘텐츠)

→ `getSajuTodayDetailEntitlement` 게이트 **정확히 동작**.

### Open-redirect probe
`/login?next=https://attacker.example/` → 외부로 안 튕김. `externalLeaked: false`, `finalOrigin: localhost:3100`. ✅

---

## 5. 🔴 P0-1: `addCredits` 멱등성 부재 — 라이브 실증

### 재현
같은 `paymentKey`로 `add_credits()` SQL function 2회 호출 (Fresh 페르소나 대상):

```
1차 호출 (paymentKey = AUDIT-PHASE5-SAME-KEY-…):  balance 3 → 6  (+3)
2차 호출 (같은 paymentKey)               :  balance 6 → 9  (+3)
```

### 결과
- 시작 balance: 3 / 최종: **9** / delta: **+6** (멱등이면 +3)
- `credit_transactions`에 동일 paymentKey row **2개**:
  ```
  94423f82-bcfc-4cb3-9273-a7c731c12689  +3  purchase
  a3aa6363-ea17-4cc4-92ca-7716db2b9632  +3  purchase
  ```

### 운영 영향
- 영향 상품: `credit_1`/`credit_3`/`credit_7`/`subscription_30` — 코인이 핵심 deliverable인 4종 전부
- 트리거 시나리오: success URL 새로고침, 클라이언트 retry, 동일 paymentKey 재호출
- 금전 손해: 36코인 패키지(9,900원) 1회 결제 시 **72코인(19,800원 상당)** 부여 가능

### 권고 fix (택1)
**Option A — SQL 함수 레벨**:
```sql
CREATE OR REPLACE FUNCTION add_credits(...) AS $$
DECLARE
  v_payment_key text := p_metadata->>'paymentKey';
BEGIN
  IF v_payment_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM credit_transactions
    WHERE user_id = p_user_id AND type = p_type
      AND metadata->>'paymentKey' = v_payment_key
  ) THEN
    RETURN;  -- already processed, no-op
  END IF;
  ...
END $$;
```

**Option B — 호출자 레벨**:
[`src/lib/credits/deduct.ts:143`](../src/lib/credits/deduct.ts) `addCredits()` 안에서 `credit_transactions`를 paymentKey로 조회 후 early-return.

대조: `grantTasteProductEntitlement` ([product-entitlements.ts:186-202](../src/lib/product-entitlements.ts))는 이 패턴을 이미 구현.

---

## 6. 🔴 P0-2: 결제 confirm 트랜잭션 원자성 부재

[`/api/payments/confirm/route.ts:60-110`](../src/app/api/payments/confirm/route.ts):

```
1) auth check
2) Toss confirmPayment           ── 외부 호출, 멱등 (Toss-side)
3) addCredits                    ── ❌ 멱등 X (P0-1)
4) activateMembershipSubscription ── ✅ user_id PK
5) grantLifetimeReportEntitlement ── ✅ paymentKey lookup
6) grantTasteProductEntitlement   ── ✅ paymentKey + DB UNIQUE
7) upsertPaidReadingSnapshot     ── ✅ UPSERT
```

5개 후처리(3~7)가 **별개 호출**. 중간 실패 시:
- `addCredits` 성공 + `grantTasteProductEntitlement` 실패 → 잔액↔권한 불일치
- `grantTasteProductEntitlement` 성공 + `upsertPaidReadingSnapshot` 실패 → `/my/results` 누락

### 권고 fix
**Option A — 단일 RPC**:
```sql
CREATE OR REPLACE FUNCTION finalize_payment(
  p_user_id uuid, p_payment_key text, p_order_id text,
  p_package_id text, p_amount int, p_meta jsonb
) RETURNS jsonb AS $$
BEGIN
  -- idempotency check
  -- addCredits (멱등)
  -- activateMembershipSubscription
  -- grantEntitlement
  -- upsertSnapshot
EXCEPTION WHEN OTHERS THEN ROLLBACK;
END $$;
```

**Option B — outbox 패턴**: `payment_events` 큐 + Vercel cron retry. Toss callback url로 web-hook 받기.

---

## 7. 결제 confirm 흐름 안전성 매트릭스

| # | 단계 | 위치 | 안전성 | 비고 |
|---|---|---|---|---|
| 1 | payload validation | [confirmation.ts:36](../src/lib/payments/confirmation.ts) | ✅ | catalog 재조회 + amount 일치 |
| 2 | auth check | [confirm/route.ts:42](../src/app/api/payments/confirm/route.ts) | ✅ | 401 처리 |
| 3 | Toss confirmPayment | [toss.ts](../src/lib/payments/toss.ts) | ✅ | Toss-side idempotent |
| 4 | **addCredits** | [deduct.ts:143](../src/lib/credits/deduct.ts) | **🔴 P0-1** | paymentKey 중복 체크 부재 |
| 5 | activateMembershipSubscription | [subscription.ts](../src/lib/subscription.ts) | ✅ | user_id PK |
| 6 | grantLifetimeReportEntitlement | [report-entitlements.ts:125](../src/lib/report-entitlements.ts) | ✅ | paymentKey lookup |
| 7 | grantTasteProductEntitlement | [product-entitlements.ts:186](../src/lib/product-entitlements.ts) | ✅ | paymentKey + DB UNIQUE |
| 8 | upsertPaidReadingSnapshot | [paid-reading-snapshots.ts](../src/lib/payments/paid-reading-snapshots.ts) | ✅ | UPSERT |
| 트랜잭션 묶음 | 3~8 atomicity | 동상 | **🔴 P0-2** | 5개 호출 분리 |

---

## 8. 미검증 / 향후 작업

- [ ] 멤버십 자동 갱신 cron — `vercel.json`에 결제 갱신 cron 없음. 수동 호출 또는 Toss billing key + cron 추가 필요
- [ ] Toss webhook (`/api/payments/webhook`) — 코드베이스에 없음. 결제 완료 통보는 클라이언트 confirm-only
- [ ] 환불·정산 API — 본 감사 범위 외
- [ ] 만료 구독 자동 강등 시 코인이 자동 회수되는지 (`subscription_balance` 처리)
- [ ] OAuth 가입 시 보너스 트리거가 동등하게 동작하는지 (password 가입만 실증됨)

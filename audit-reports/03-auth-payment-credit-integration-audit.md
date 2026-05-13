# 03. Auth · Payment · Credit Integration Audit

> 2026-05-13 · 인증·결제·코인 통합 흐름 감사

---

## 1. 인증 아키텍처

### 라이브러리
- **Supabase Auth** (`@supabase/supabase-js@2.103.1` + `@supabase/ssr@0.10.2`)
- 제공자: Email/Password, Google OAuth, Kakao OAuth

### 세션 관리
- **클라이언트**: [`src/lib/supabase/client.ts`](../src/lib/supabase/client.ts) — `createBrowserClient` (cookies 기반)
- **서버**: [`src/lib/supabase/server.ts`](../src/lib/supabase/server.ts) — `createClient()` (요청 쿠키), `createServiceClient()` (RLS 우회)
- **미들웨어 등가물**: [`src/proxy.ts`](../src/proxy.ts) (Next.js 16의 proxy export). canonical host redirect만 수행.

### 보호 메커니즘
```
서버 컴포넌트:
  await requireAccount(redirectPath)  →  supabase.auth.getUser()  →  없으면 redirect(`/login?next=${path}`)

API 라우트:
  const { user } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({error:'로그인이 필요합니다.'}, {status:401})
```

### 라이브 검증 (Phase 4)
- `/my/results` 비로그인 → **307 → /login?next=%2Fmy%2Fresults** ✓
- `/my/billing` 비로그인 → **307 → /login?next=%2Fmy%2Fbilling** ✓
- 로그인 후 4명 페르소나 모두 `/my/*` 정상 진입 ✓
- `/login?next=https://attacker.example/` → 외부로 안 튕김 (origin: `localhost:3100` 유지) ✓ — `getAfterLoginHref()` 안전 검증 동작

### `getAccountDashboardData` local-preview fallback (잠재 P1)
[`src/lib/account.ts:147`](../src/lib/account.ts):
```ts
if (!hasSupabaseServerEnv || !hasSupabaseServiceEnv) {
  return buildLocalPreviewDashboard();  // dummy data, no requireAccount
}
```
운영에 SUPABASE env vars가 미설정될 경우 더미 대시보드가 무인증 사용자에게 제공됨. 운영 배포 직전 env presence 체크 권장.

---

## 2. 결제 시스템

### SDK
- `@tosspayments/payment-widget-sdk@0.12.1` (결제 위젯)
- `@tosspayments/tosspayments-sdk@2.6.0` (서버 confirm)

### 환경변수 (`.env.example` 키 목록, 값 출력 금지)
- Client: `NEXT_PUBLIC_TOSS_CLIENT_KEY` (test_ck_*) 
- Server: `TOSS_SECRET_KEY` (test_sk_*)
- 운영 배포 시점에 `test_*` → 운영 키 전환 + grep 자동 차단 룰 필요

### 결제 흐름 (8단계)
[`/api/payments/confirm/route.ts:60-110`](../src/app/api/payments/confirm/route.ts):

| # | 단계 | 안전 |
|---|---|---|
| 1 | validate payload (catalog SSOT) | ✅ |
| 2 | auth.getUser | ✅ |
| 3 | Toss confirmPayment | ✅ (Toss-side idempotent) |
| 4 | **addCredits** | **🔴 P0-1 멱등성 부재** |
| 5 | activateMembershipSubscription | ✅ user_id PK |
| 6 | grantLifetimeReportEntitlement | ✅ paymentKey lookup |
| 7 | grantTasteProductEntitlement | ✅ paymentKey + DB UNIQUE |
| 8 | upsertPaidReadingSnapshot | ✅ UPSERT |
| atomicity | 3~8 트랜잭션 묶음 | **🔴 P0-2 부재** |

자세한 P0 실증·운영 영향·fix 권고는 [`02-paid-funnel-audit.md`](02-paid-funnel-audit.md#5-p0-1-addcredits-멱등성-부재--라이브-실증) 참조.

---

## 3. 코인 시스템

### DB 스키마
```sql
-- 001_initial.sql
CREATE TABLE user_credits (
  user_id UUID PRIMARY KEY,
  balance INT NOT NULL DEFAULT 0,
  subscription_balance INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ
);

CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  amount INT,
  type TEXT,         -- 'purchase' | 'subscription' | 'use' | 'signup_bonus'
  feature TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ
);
```

### RPC 함수
- `add_credits(p_user_id, p_amount, p_type, p_metadata)` — **🔴 멱등성 부재 (P0-1)**
- `deduct_credits(p_user_id, p_cost, p_feature)` — `FOR UPDATE` 락 사용, 구독잔액 먼저 차감 ✓

### 신규가입 보너스
- `handle_new_user()` 트리거 — `auth.users` INSERT 시 `user_credits`(balance=3) + `credit_transactions`(+3 signup_bonus) 자동
- **라이브 확인** (Phase 4): 4명 페르소나 모두 자동 부여 ✓

### 차감 패턴
```ts
deductCredits(userId, cost, feature)  // SQL 단일 트랜잭션, 구독잔액 → 일반잔액 순 차감
```
- 동시성: `FOR UPDATE` 락으로 race 보호 ✓
- 음수 잔액 방지: balance 충분치 않으면 `{success: false}` 반환 ✓

---

## 4. Supabase RLS 정책 매트릭스

19개 마이그레이션 분석 결과:

| 테이블 | SELECT | INSERT | UPDATE | DELETE | 평가 |
|---|---|---|---|---|---|
| user_credits | 본인만 | — | — | — | service-role only writes ✅ |
| credit_transactions | 본인만 | — | — | — | ✅ |
| subscriptions | 본인만 | — | — | — | ✅ |
| readings | **본인 OR user_id IS NULL** | 본인 (019) | — | 본인 (019) | ⚠️ slug guessing 검증 필요 (P1) |
| profiles | 본인 | 본인 | 본인 | — | ✅ |
| family_profiles | 본인 | 본인 | 본인 | 본인 | ✅ |
| notification_preferences | 본인 | 본인 | 본인 | — | ✅ |
| push_subscriptions | 본인 | 본인 | 본인 | 본인 | ✅ |
| product_entitlements | 본인 | — | — | — | service-role only ✅ |
| paid_reading_snapshots | 본인 | — | — | — | service-role only ✅ |
| ai_interpretations | 본인 | (verify) | — | — | VERIFY |
| yearly_ai_interpretations | 본인 | (verify) | — | — | VERIFY |
| fortune_feedback | 본인 | (verify) | — | — | VERIFY |
| notification_delivery_logs | 본인 | — | — | — | ✅ |

### 결제·과금 테이블 결론 — ✅ 안전 설계
- 사용자(anon JWT)는 자기 balance/구독/권한을 **읽기만 가능**
- 모든 쓰기는 service-role을 통한 서버 코드에서만 발생
- 클라이언트가 anon key로 잔액·구독·entitlement를 직접 변경 불가

### 잠재 위험 — `readings`의 `user_id IS NULL`
- 비로그인 사용자가 익명으로 저장한 readings를 누구나 SELECT 가능 (의도)
- slug 추측으로 타인의 익명 reading 열람 가능성 → **VERIFY**: `resolveReading()`의 ownership 체크 필요

---

## 5. 인증·결제·코인 통합 시나리오 검증

### 정상 흐름
1. 비회원이 `/saju/[slug]/today-detail` 접근 → 잠금 카드 표시 ✓
2. "550원 결제하고 열기" 클릭 → `/membership/checkout?product=today-detail&slug=...` → prepare API 401 → `/login?next=...`
3. 로그인 후 다시 checkout → prepare 200 (`alreadyPurchased:false`) → Toss 위젯
4. 결제 완료 → success URL → `/api/payments/confirm` → addCredits (코인) + grantTasteProductEntitlement (권한)
5. `/saju/[slug]/today-detail` 재접근 → 풀 콘텐츠

### 위험 흐름
1. **새로고침/retry로 confirm 재호출** → P0-1 발현 (코인 +6 부여) 🔴
2. **confirm 중 step 7 실패** → 코인은 들어왔지만 권한은 없음 (P0-2) 🔴
3. **OAuth callback `next` 외부 URL** → 코드 검토상 `getAfterLoginHref()`로 차단되지만 OAuth 흐름은 별도 검증 권고

---

## 6. 우선순위 정리

- **P0** (2): P0-1 (멱등성), P0-2 (원자성) — 모두 본 흐름
- **P1** (3): UI 가격 SSOT 위반 / `readings` RLS slug guessing 검증 / `getAccountDashboardData` local fallback
- **P2** (2): `/api/dialogue/safety` 무인증 익명 POST / `/dialogue/[expert]` 페이지 무인증
- **VERIFY**: OAuth callback `next` 검증, AI 해석 테이블들의 RLS INSERT 정책

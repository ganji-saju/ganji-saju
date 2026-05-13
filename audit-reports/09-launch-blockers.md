# 09. Launch Blockers (P0 + P1) — 당장 조치할 항목

> 2026-05-13 · 오픈 차단 P0 2건 + 48시간 권고 P1 7건
> 각 항목: 위치 · 영향 · 수정안 · 검증

---

## 🔴 P0 — 오픈 차단 (2건)

### P0-1. `addCredits` 멱등성 부재 → 코인 중복 적립

**상태**: 🔥 라이브 실증 완료 (`balance 3 → 6 → 9`)

**위치**:
- [`src/lib/credits/deduct.ts:143-157`](../src/lib/credits/deduct.ts) — `addCredits()` 함수
- [`supabase/migrations/002_credit_functions.sql:52-82`](../supabase/migrations/002_credit_functions.sql) — `add_credits` RPC

**영향**:
- 같은 paymentKey로 `/api/payments/confirm` 두 번 호출 시 코인 2배 적립
- 영향 상품: `credit_1` (1코인 500원), `credit_3` (3코인 990원), `credit_7` (7코인 2,000원), `subscription_30` (36코인 9,900원)
- 트리거 시나리오: success URL 새로고침 / 클라이언트 retry / 동일 paymentKey 재호출
- 최대 손해: 36코인 패키지(9,900원) 1회 결제 → 72코인 (19,800원 상당) 부여

**수정안 (택1, 추천 A)**:

A) SQL 함수 레벨:
```sql
CREATE OR REPLACE FUNCTION add_credits(
  p_user_id UUID, p_amount INT, p_type TEXT, p_metadata JSONB DEFAULT '{}'
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_payment_key text := p_metadata->>'paymentKey';
BEGIN
  IF v_payment_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM credit_transactions
    WHERE user_id = p_user_id AND type = p_type
      AND metadata->>'paymentKey' = v_payment_key
  ) THEN
    RETURN;  -- 이미 처리됨, no-op
  END IF;
  -- 기존 로직...
END $$;
```

B) 호출자 레벨 (`src/lib/credits/deduct.ts:143`):
```ts
export async function addCredits(userId, amount, type, metadata = {}) {
  const supabase = await createServiceClient();
  if (metadata?.paymentKey) {
    const { data } = await supabase
      .from('credit_transactions')
      .select('id')
      .eq('user_id', userId).eq('type', type)
      .contains('metadata', { paymentKey: metadata.paymentKey })
      .limit(1);
    if (data?.length) return;  // already credited, no-op
  }
  await supabase.rpc('add_credits', { p_user_id: userId, p_amount: amount, p_type: type, p_metadata: metadata });
}
```

**검증**:
```bash
source /tmp/ganji-audit-2026-05-13/.env.audit
node /tmp/ganji-audit-2026-05-13/payment-trace.mjs
# 기대: 2차 호출에서 balance 변화 0 (3→6에서 멈춤)
```

**owner**: backend lead · **예상 작업량**: 2-4h (구현 + 회귀 테스트)

---

### P0-2. 결제 confirm 트랜잭션 원자성 부재

**위치**: [`src/app/api/payments/confirm/route.ts:60-110`](../src/app/api/payments/confirm/route.ts)

**영향**:
- `addCredits` → `activateMembershipSubscription` → `grantTasteProductEntitlement` → `upsertPaidReadingSnapshot` 5개 호출이 별개 트랜잭션
- 중간 실패 시 코인↔권한 불일치 발생
  - 시나리오 A: 코인 적립 후 권한 부여 실패 → "결제했는데 콘텐츠 안 보임" CS
  - 시나리오 B: 권한 부여 후 스냅샷 실패 → `/my/results` 보관함 누락

**수정안 (택1, 추천 A)**:

A) 단일 RPC로 통합:
```sql
CREATE OR REPLACE FUNCTION finalize_payment(
  p_user_id uuid, p_payment_key text, p_order_id text,
  p_package_id text, p_amount int, p_meta jsonb
) RETURNS jsonb AS $$
BEGIN
  -- 1) idempotency check (paymentKey unique)
  -- 2) addCredits
  -- 3) activateMembershipSubscription
  -- 4) grantEntitlement
  -- 5) upsertSnapshot
EXCEPTION WHEN OTHERS THEN
  -- 자동 ROLLBACK
  RAISE;
END $$ LANGUAGE plpgsql;
```

B) Outbox + retry 패턴:
- `payment_events` 큐 테이블 추가
- Vercel cron이 실패한 event 재시도
- 또는 Toss webhook 엔드포인트 추가 후 멱등 처리

**검증**: 단위 테스트로 step 4 mock failure 주입 시 step 3 rollback 확인

**owner**: backend lead · **예상 작업량**: 4-8h

---

> P0-1, P0-2는 **하나의 PR로 함께 fix 권고** (같은 코드 블록 + 회귀 테스트 공유 가능)

---

## 🟠 P1 — 48시간 내 권고 (7건)

### P1-1. 보안 응답 헤더 5종 누락
- **누락**: CSP, X-Frame-Options, Referrer-Policy, X-Content-Type-Options, Permissions-Policy
- **위치**: `next.config.ts` 또는 `vercel.json`
- **수정안**: [`08-technical-risk-audit.md`](08-technical-risk-audit.md#1-응답-보안-헤더--p1) 1절 참조
- **owner**: devops · **작업량**: 1-2h

### P1-2. 결제 가격 UI 13곳 하드코딩 (catalog SSOT 위반)
- **위치**: [`02-paid-funnel-audit.md`](02-paid-funnel-audit.md#3-ui-측-ssot-위반--p1-13곳-하드코딩) 표 참조
- **수정안**: `formatPriceLabel(pkg, style)` 헬퍼 도입 + CI grep 차단 룰
- **owner**: frontend lead · **작업량**: 4-8h

### P1-3. `/saju/new` 색인 차단 (Lighthouse SEO 66)
- **위치**: `public/robots.txt` 또는 generated robots
- **현재**: `Disallow: /saju/` (전체 차단)
- **수정안**:
  ```
  Disallow: /saju/
  Allow: /saju/new
  ```
- **owner**: SEO lead · **작업량**: 30분

### P1-4. 페이지별 OG 메타 미적용 + og:image 누락
- **위치**: `src/app/*/page.tsx`의 `metadata` export
- **수정안**:
  ```ts
  export const metadata = {
    openGraph: {
      title: '특정 페이지 제목',
      description: '특정 설명',
      images: [{ url: '/og-default.jpg', width: 1200, height: 630 }],
    },
  };
  ```
  + `public/og-default.jpg` (1200×630) 생성
- **owner**: frontend + design · **작업량**: 4-8h

### P1-5. 홈 `/` canonical 누락
- **위치**: `src/app/page.tsx`
- **수정안**: `metadata: { alternates: { canonical: '/' } }`
- **owner**: frontend · **작업량**: 5분

### P1-6. color-contrast serious 위반 (전 10페이지, ~111 노드)
- **위치**: [`src/app/styles/tokens.css`](../src/app/styles/tokens.css) `--app-pink` 등
- **수정안**: 본문 텍스트 핑크 → `--app-pink-strong` (`#d81b72`, 4.62:1)
- **owner**: design + frontend · **작업량**: 2-4h
- **추가 안내**: [`06-accessibility-audit.md`](06-accessibility-audit.md)

### P1-7. 모바일 LCP 5/5 페이지 예산(2.5s) 미달 — 평균 3.92s
- **수정안 4가지**:
  1. 번들 split (`/saju/new`의 unused JS 0.6s)
  2. 이미지 priority (`moonlight-teacher-hero` poster `priority`)
  3. 폰트 weight 축소 (6종 → 3-4종)
  4. CSS code split
- **owner**: frontend lead · **작업량**: 4-8h

---

## 📋 GO 체크리스트 (모두 만족 시 본 리포트 GO 전환)

- [ ] P0-1 fix 머지 + 단위 테스트 통과 (같은 paymentKey 2회 confirm 시 1회만 적립)
- [ ] P0-2 fix 머지 + 단위 테스트 통과 (step 4 mock fail 시 step 3 rollback)
- [ ] `node /tmp/ganji-audit-2026-05-13/payment-trace.mjs` 재실증 → 2차 호출 no-op 확인
- [ ] P1-1 보안 헤더 5종 배포 + curl 재측정
- [ ] P1-3 `/saju/new` 색인 허용 + Google Search Console 재크롤
- [ ] P1-6 핑크 토큰 교체 + axe-core 재측정 → 0 serious
- [ ] (강력 권고) P1-2, P1-7도 같이 머지하면 사용자 신뢰·Core Web Vitals 함께 개선

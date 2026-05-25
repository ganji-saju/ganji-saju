# 상품 카탈로그 / 가격 / 환불 정책 구조

작성일: 2026-05-17 / 출처: `src/lib/payments/catalog.ts` 인벤토리 + migration 016/018/020 + FAQ 정책 문구

> **주의**: 본 문서는 **현 상태 audit + 일관성 문제 정리**. 실제 정책 수치는 운영자 확정값으로 [`../legal-required-fields.md`](../legal-required-fields.md) 입력 후 갱신.

---

## 1. 카탈로그 인벤토리 (현 코드 기준)

### 1.1 코인 상품 (credits)
| 상품ID | 이름 | 가격 | 코인 적립 | 비고 |
|---|---|---|---|---|
| `credit_1` | 체험 1 코인 | 500원 | 1 | 진입 |
| `credit_3` | 스타터 3 코인 | 990원 | 3 | |
| `credit_7` | 기본 7 코인 | 2,000원 | 7 | |
| `subscription_30` | 보너스 36 코인 | 9,900원 | 36 | 일회성 / 1년 유효 (FAQ) |

### 1.2 구독 상품 (subscription)
| 상품ID | 이름 | 가격 | 주기 | 혜택 |
|---|---|---|---|---|
| `membership_plus` | 라이트 대화 멤버십 | 4,900원/월 | 월간 | AI 대화 코인 제공 |
| `membership_premium` | 프리미엄 대화 멤버십 | 9,900원/월 | 월간 | AI 대화 코인 + 추가 혜택 |

### 1.3 단건 권한 상품 (entitlement)
| 상품ID | 이름 | 가격 | scope 필요 | 환불정책 명시 |
|---|---|---|---|---|
| `lifetime_report` | 보관형 사주 리포트 | **49,000원** | ✓ slug | 🚨 별도 환불 페이지 없음 |
| `taste_today_detail` | 오늘 자세히 보기 | 550원 | ✓ slug | FAQ 일반조항 |
| `taste_love_question` | 연애 마음 확인 | 990원 | — | FAQ 일반조항 |
| `taste_money_pattern` | 돈이 새는 패턴 | 990원 | — | FAQ 일반조항 |
| `taste_work_flow` | 일/직장 흐름 | 990원 | — | FAQ 일반조항 |
| `taste_monthly_calendar` | 월간 달력 | 1,900원 | ✓ slug | FAQ 일반조항 |
| `taste_year_core` | 올해 핵심 3줄 | 3,900원 | ✓ slug | FAQ 일반조항 |

---

## 2. 발견된 일관성 문제

### 2.1 🚨 P0 — Migration drift 의심
- `supabase/migrations/016_product_entitlements.sql` 의 `product_id` CHECK 제약: `today-detail|monthly-calendar|love-question|money-pattern|work-flow|year-core` 6종
- **`lifetime-report` 누락** — 코드 (`src/lib/product-entitlements.ts`) 는 `grantProductEntitlement('lifetime-report', ...)` 호출 가능. migration 018/020 후속에서 추가됐는지 확인 필요
- 후속 migration 까지 확인 후 누락 시 Phase 6 에서 CHECK 제약 갱신 migration 추가

### 2.2 🚨 P0 — 카탈로그 vs FAQ 가격 표기 불일치
- `src/app/support/faq/page.tsx:39` — monthly-calendar 를 **"2코인(1,900원)"** 으로 표기
- 카탈로그 = 단건 1,900원 결제 상품 (taste_product)
- 코인 차감 (`unlock_credit_feature_once`) feature 목록에 `monthly-calendar` 도 있어 양쪽 경로 존재 가능. 사용자에게 혼란 → 표기 통일 또는 분리 안내 필요

### 2.3 🚨 P0 — 코인 유효기간 정책-구현 불일치
- FAQ: "결제 시점부터 1년간 유효", "구독 코인은 구독 종료 시 만료"
- DB: `user_credits` 에 `expires_at` 컬럼 **없음** + 만료 cron **없음**
- 현 구현 = **영구 유효**. 정책 vs 구현 충돌 → Phase 8 에서 둘 중 선택:
  - (A) DB 컬럼 + 만료 cron 추가 (정책 유지)
  - (B) FAQ "1년 유효" 문구 삭제 (구현 유지)

### 2.4 🟡 P0(부분 해소) — 49,000원 lifetime-report 환불 인프라
- **2026-05-23 회수 함수 추가 완료**:
  - `revokeProductEntitlement(userId, productId, scopeKey, { reason, actor?, paymentKey? })` — `src/lib/product-entitlements.ts`. **조회 우선순위 양쪽**(product_entitlements + legacy credit_transactions)을 모두 제거 → 환불 후 권한이 되살아나지 않음. audit 행(`type='purchase'`, `feature='entitlement_revoke'`, `metadata.kind='entitlement_revoked'`)으로 환불 흔적 보존.
  - `revokeLifetimeReportEntitlement(userId, readingKey, { reason, ... })` — `src/lib/report-entitlements.ts`. lifetime 전용 wrapper.
  - 대칭성 회귀 방지: `resolveEntitlementRevokeQuery` + `product-entitlements.revoke.test.ts` (grant↔revoke 키 대칭 고정).
  - `/refund-policy` 페이지는 이미 존재(안내 UI). 마이그레이션 불필요(hard-delete + audit, `payment_key` 컬럼으로 결제건 역매칭).
- **남은 후속 작업** (별도 PR):
  1. 회수 함수를 호출하는 운영 경로 — admin 환불 처리 UI 또는 CLI 스크립트(`scripts/revoke-entitlement.mjs`)
  2. Toss 환불 API (`/v1/payments/{paymentKey}/cancel`) 연동 — `revoke...` 반환 `paymentKey` 로 결제 취소
  3. (선택) `refund_requests` 테이블 + 사용자 환불 신청 flow

### 2.5 🟡 P1 — orderId 충돌 가능성
- 생성식: `order_${pkg.id}_${method}_${Date.now()}`
- 같은 사용자가 같은 ms 더블 클릭 시 동일 orderId → Toss 측에서 거부
- Phase 6 에서 `crypto.randomUUID()` 기반 변경

### 2.6 🟡 P1 — Toss webhook 라우트 부재
- 현재 `/api/payments/confirm` 만 의존 (사용자가 success 페이지 도달 가정)
- 브라우저 닫기 등으로 success 미도달 시 entitlement 미발급
- Phase 6 에서 `/api/payments/webhook/toss` 신설 + idempotency 보강

### 2.7 🟡 P1 — addCredits paymentKey 기반 idempotency 없음
- 같은 paymentKey 로 confirm 2회 호출 시 코인 2배 적립 위험
- entitlement 는 UNIQUE 로 차단되나 코인은 별도 경로
- Phase 6 에서 `addCredits(paymentKey, ...)` 시그니처 변경 + DB 컬럼 추가

---

## 3. 결제 흐름 다이어그램 (현 상태)

```
[브라우저: /credits 또는 /membership/checkout]
   │
   ├─ POST /api/payments/prepare ──→ funnel: prepare_attempt | blocked | ready
   │   (인증 / 중복 구매 차단)
   │
   ├─ loadTossPayments + requestPayment({method: 'CARD'|'TRANSFER'})
   │   (orderId = `order_${pkg.id}_${method}_${Date.now()}`)
   │
   ├─ Toss 결제창
   │
   ├─ /credits/success 또는 /membership/success
   │
   └─ POST /api/payments/confirm
       ├─ confirmPayment(orderId, paymentKey, amount)  → Toss API
       ├─ addCredits (paymentKey idempotency ❌)
       └─ grantProductEntitlement (UNIQUE 23505 idempotency ✓)
```

**누락 경로**: Toss webhook → success 페이지 미도달 시 entitlement 미발급.

---

## 4. 환불 정책 합의안 (Phase 5/6 작성 예정)

> 본 섹션은 운영자 확정값이 필요. [`../legal-required-fields.md`](../legal-required-fields.md) §1.2 의 "환불 기준 세부 수치" 확정 후 채움.

| 상품 카테고리 | 청약철회 가능 기간 | 디지털콘텐츠 열람 후 | 부분환불 |
|---|---|---|---|
| 코인 패키지 | ? 일 (운영자 확정) | 불가 (사용 코인 차감) | 미사용분 환불 가능? |
| 구독 (멤버십) | ? 일 (전자상거래법 §17 검토) | 진행 중 구독 해지 → 다음 결제일까지 유지 | — |
| lifetime-report (49,000원) | ? 일 (열람 전) | 불가 | — |
| taste 상품 (550~3,900원) | 열람 전 ? 일 | 불가 | — |

### 4.1 청약철회 예외 사유 (전자상거래법 §17②)
- 디지털콘텐츠 제공 개시 후 (사용자 명시 동의 + 안내 시)
- 복제 가능한 콘텐츠 (사주 PDF 등)

→ 결제 흐름에 "열람 시 환불 불가" 사전 동의 체크박스 추가 필요 (Phase 5 동의 모달과 연계)

---

## 5. admin 환불 흐름 합의안

1. 사용자가 `/refund-policy` 페이지 또는 `/my/billing` 에서 환불 신청 (form → API)
2. `refund_requests` 테이블에 행 insert (status='pending')
3. admin `/admin/refunds` (신설) 에서 검토
4. 승인 시:
   - Toss `/v1/payments/{paymentKey}/cancel` 호출
   - entitlement / 코인 회수
   - `refund_requests.status='approved'`, `processed_at`
5. 거부 시: 사유 + 안내 이메일 자동 발송

---

## 6. 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-05-17 | 초기 작성 (Phase 1 audit) |
| 2026-05-23 | §2.4 P0 부분 해소 — entitlement 회수 함수(`revokeProductEntitlement`/`revokeLifetimeReportEntitlement`) + 대칭성 테스트 추가. 이중 결제(prepare today-detail 코인경로 인식)·올해 핵심 3줄 명칭 통일 동반 |

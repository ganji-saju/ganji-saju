# 상품 카탈로그 / 가격 / 환불 정책 구조

작성일: 2026-05-17
최종 갱신: 2026-05-27 / 출처: `src/lib/payments/catalog.ts`, `src/lib/payments/product-scope.ts`, `src/shared/payments/consent-rules.ts`, `supabase/migrations/040_credit_lots_expiry.sql`, `supabase/migrations/043_refund_requests.sql`, `supabase/migrations/044_credit_payment_idempotency.sql`

> 목적: 현재 로컬 구현과 운영 정책 문서의 기준점을 맞춘다. 정책 수치가 운영자 확정값이 아닌 항목은 "확인 필요"로 남긴다.

---

## 1. 카탈로그 인벤토리 (현재 로컬 코드 기준)

현재 `PAYMENT_PACKAGES`는 총 16개다.

### 1.1 코인/충전 상품

| 상품ID | 이름 | 가격 | 적립 | 종류 | 비고 |
|---|---|---:|---:|---|---|
| `credit_1` | 체험 1 코인 | 500원 | 1 | `credits` | 일회성 충전 |
| `credit_3` | 스타터 3 코인 | 990원 | 3 | `credits` | 일회성 충전 |
| `credit_7` | 기본 7 코인 | 2,000원 | 7 | `credits` | 일회성 충전 |
| `subscription_30` | 보너스 36 코인 | 9,900원 | 36 | `subscription` | `planSlug` 없음 → 월구독이 아니라 일회성 36코인 상품. confirm에서는 `purchase` grant type으로 처리 |

### 1.2 멤버십

| 상품ID | 이름 | 가격 | 종류 | planSlug | subscriptionPlan |
|---|---|---:|---|---|---|
| `membership_plus` | 라이트 대화 멤버십 | 4,900원/월 | `subscription` | `basic` | `plus_monthly` |
| `membership_premium` | 프리미엄 대화 멤버십 | 9,900원/월 | `subscription` | `premium` | `premium_monthly` |

### 1.3 단건 권한 상품

| 상품ID | 이름 | 가격 | productId | scope | 비고 |
|---|---|---:|---|---|---|
| `lifetime_report` | 보관형 사주 리포트 | 49,000원 | `lifetime-report` | `lifetime:{readingKey}` | slug 필요 |
| `taste_today_detail` | 오늘 자세히 보기 | 550원 | `today-detail` | `today:{readingKey}` | slug 필요 |
| `taste_love_question` | 연애 마음 확인 | 990원 | `love-question` | global | slug 불필요 |
| `taste_money_pattern` | 돈이 새는 패턴 | 990원 | `money-pattern` | global | slug 불필요 |
| `taste_work_flow` | 일/직장 흐름 | 990원 | `work-flow` | global | slug 불필요 |
| `taste_monthly_calendar` | 월간 달력 | 1,900원 | `monthly-calendar` | `calendar:{readingKey}:{YYYY-MM}` | slug 필요 |
| `taste_year_core` | 올해 핵심 3줄 | 3,900원 | `year-core` | `year:{readingKey}:{year}` | slug 필요 |
| `taste_score_factor` | 점수 풀이 보기 | 550원 | `score-factor` | `score:{readingKey}:{F1..F5}` | slug + factor scope 필요 |
| `taste_compat_reading` | 궁합 깊은 풀이 | 990원 | `compat-reading` | `compat:{coupleKey}` | slug 필요 |

### 1.4 묶음 상품

| 상품ID | 이름 | 가격 | 종류 | 구성 | 비고 |
|---|---|---:|---|---|---|
| `bundle_today_set` | 오늘 풀세트 | 990원 | `bundle` | `today-detail` + `score-factor` F1~F5 | 결제 1건으로 구성품 6개 entitlement를 개별 grant |

---

## 2. 구현 상태

### 2.1 결제 준비/확정

- `/membership/checkout`과 `/credits` 경로는 `/api/payments/prepare`를 호출해 인증, 중복 구매, consent 기록, funnel 이벤트를 처리한 뒤 Toss 결제를 연다.
- `/api/payments/confirm`은 Toss confirm 후 상품 종류별로 `addCredits`, `activateMembershipSubscription`, `grantLifetimeReportEntitlement`, `grantTasteProductEntitlement`, `grantBundleComponents`를 호출한다.
- `bundle_today_set`은 구성품 분해 grant 방식이다. 기존 조회 경로는 각 단건 entitlement를 그대로 본다.
- prepare API는 `acceptedKinds`를 필수로 검증한다. 누락 시 `prepare_blocked` / `consent_missing`으로 기록하고 결제창을 열지 않는다.
- `/credits`는 `PaymentConsentCheckboxes`를 표시하고, credit 상품에 필요한 `coin` 동의를 서버에 기록한다.
- `subscription_30`은 `kind='subscription'`이지만 관리형 구독이 아니므로 동의 정책도 `subscription`이 아니라 `coin`을 요구한다.

### 2.2 코인 만료 정책

- `040_credit_lots_expiry.sql`로 결제 코인 1년 만료 모델이 구현돼 있다.
- `credit_lots`가 결제/이관 코인의 source of truth이고, `user_credits.balance`는 비만료 lot 합의 캐시다.
- 기존 잔액은 migration 적용 시점 + 1년 만료인 `grandfather` lot으로 백필한다.
- 신규 결제 코인은 결제 시점 + 1년 만료 lot으로 적립된다.
- `subscription_30`은 월구독이 아니므로 confirm에서 `purchase` 타입으로 적립되어 1년 만료 lot에 들어간다.
- `getCredits`는 표시 잔액을 비만료 lot 합으로 재계산한다. cleanup cron 없이도 만료분은 조회/차감에서 제외된다.
- 관리형 멤버십(`membership_plus`, `membership_premium`) 지급분만 `subscription_balance`로 분리된다.

### 2.3 환불/회수

- `revokeProductEntitlement`, `revokeLifetimeReportEntitlement`, bundle revoke 경로가 존재한다.
- `043_refund_requests.sql`은 admin 요청 → super_admin 승인/실행의 2단계 상태머신을 제공한다.
- 사용자 확인 기준 2026-05-27에 prod 043 적용 완료. 실제 환불은 진행 중.
- Toss cancel은 idempotency key를 사용한다.

### 2.4 credit confirm idempotency

- `044_credit_payment_idempotency.sql`은 `processed_credit_payments` 테이블을 추가한다.
- `payment_key`는 UNIQUE이며, `add_credits`가 잔액을 더하기 전에 먼저 paymentKey를 예약한다.
- 같은 `paymentKey/orderId` confirm이 재시도되면 두 번째 호출은 잔액과 `credit_transactions`를 다시 쓰지 않고 idempotent success로 종료한다.
- migration 적용 시 기존 `credit_transactions.metadata.paymentKey`를 backfill해 과거 성공 결제도 재시도 중복 적립을 막는다.
- 사용자 확인 기준 2026-05-27에 Supabase prod 수동 적용 완료.

### 2.5 월간 달력 이중 경로

- 월간 달력은 단건 현금(`taste_monthly_calendar`, 1,900원)과 코인 unlock(`calendar`, 2코인) 양쪽 경로가 있다.
- UI/FAQ에서 `2코인` 또는 `1,900원` 대안으로 명시한다.
- 운영 정책이 "두 대안 허용"이면 정합 상태다. "단일 경로 강제"가 목표라면 추가 정책 결정이 필요하다.

---

## 3. 남은 결제정책 리스크

### 3.1 P1 — orderId 충돌 가능성

- `/credits`: `order_${pkg.id}_${method}_${Date.now()}`
- `/membership/checkout`: `membership_${packageId}_${method}_${Date.now()}`
- 같은 ms 더블 클릭 같은 극단 상황에서 orderId 충돌 가능성이 있다. `crypto.randomUUID()` 또는 서버 발급 order id로 개선 권장.

### 3.2 P1 — Toss webhook 라우트 부재

- 현재 success 페이지 도달 후 `/api/payments/confirm` 호출에 의존한다.
- 사용자가 결제 후 브라우저를 닫는 경우 entitlement/credit 지급 누락 가능성이 있다.
- 후속: Toss webhook 또는 결제 상태 reconciliation job.

### 3.3 문서/노출 범위

- `/pricing` 공개 페이지는 현재 주요 taste 상품과 코인/멤버십 중심이며 `taste_score_factor`, `taste_compat_reading`, `bundle_today_set`은 맥락형 상품으로 checkout/결과 화면에서 노출된다.
- 공개 가격표가 전체 카탈로그 표 역할이어야 한다면 `/pricing`에도 추가 노출이 필요하다. 맥락형 upsell만 의도라면 현 상태 유지 가능.

---

## 4. 환불 정책 합의안

| 상품 카테고리 | 청약철회 가능 기간 | 디지털콘텐츠 열람 후 | 부분환불 |
|---|---|---|---|
| 코인 패키지 | 운영자 확정 필요 | 사용 코인 차감 후 환불 기준 확정 필요 | 미사용분 기준 가능 여부 확정 필요 |
| 구독/멤버십 | 운영자 확정 필요 | 다음 결제일까지 유지/즉시 해지 기준 확정 필요 | 일반적으로 부분환불 없음 또는 별도 기준 |
| lifetime-report | 열람 전 기준 확정 필요 | 제공 개시 후 불가 고지 필요 | 원칙상 없음 |
| taste 상품 | 열람 전 기준 확정 필요 | 제공 개시 후 불가 고지 필요 | 원칙상 없음 |
| bundle 상품 | 구성품 제공 전/후 기준 확정 필요 | 구성품 중 하나라도 제공 개시 후 불가 고지 필요 | 구성품별 부분환불 허용 여부 확정 필요 |

청약철회 예외 고지는 결제 전 동의 체크박스와 함께 유지한다. bundle도 digital-content 동의를 요구한다.

---

## 5. 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-05-17 | 초기 작성 (Phase 1 audit) |
| 2026-05-23 | entitlement 회수 함수, today-detail/score-factor 정합성 내용 반영 |
| 2026-05-27 | 현재 로컬 구현 기준으로 전면 갱신: 16개 카탈로그, `bundle_today_set`, `taste_compat_reading`, `credit_lots` 1년 만료, 043 환불 workflow, 남은 P0/P1 리스크 재정리 |
| 2026-05-27 | Codex 결제정책 보완 — `/credits` prepare/consent 통합, bundle digital-content 동의, 044 credit paymentKey idempotency, `subscription_30` purchase lot 적립 타입 및 coin 동의 반영 |
| 2026-05-27 | 사용자 확인 기준 Supabase prod에 `044_credit_payment_idempotency.sql` 수동 적용 완료 |

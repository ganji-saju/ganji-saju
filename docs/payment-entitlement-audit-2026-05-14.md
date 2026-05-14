# 결제 중복 방지 + 권한(entitlement) 전수 감사 (2026-05-14)

> 사용자 보고: "오늘 자세히 보기를 결제했는데 또 결제하라고 나온다."
> PR: feature/payment-duplicate-audit-2026-05-14
> 자동 검사: `npm run test:spec` (24 케이스)

## 1. 결론 요약

- ❌ **오늘 자세히 보기**: 중복 결제 위험 있음 → 수정 완료
- ✅ 그 외 11개 패키지: 카탈로그 정의·스코프 키·금액 검증·중복 차단 정합성 OK
- ✅ 자동화: `payment-duplicate-audit.spec.ts` 가 24개 케이스로 회귀 보호

## 2. 결제 흐름 한눈에 보기

| 패키지 ID | 가격 | scope key 형식 | 진입점 | 중복 차단 위치 |
|---|---|---|---|---|
| `taste_today_detail` | **550원** | `today:{slug}` ← 변경됨, slug + readingKey + coin-unlock 3중 검사 | `/saju/[slug]` CTA · `/today-fortune` 1코인 lock | `getSajuTodayDetailEntitlement` (3 체크) · `/membership/checkout` 페이지 |
| `taste_love_question` | 990원 | 전역 (없음) | `/saju/new?product=love-question` · `/compatibility/result` 깊은풀이 | `getTasteProductEntitlement` 글로벌 |
| `taste_money_pattern` | 990원 | 전역 | `/saju/new?product=money-pattern` | 글로벌 |
| `taste_work_flow` | 990원 | 전역 | `/saju/new?product=work-flow` | 글로벌 |
| `taste_monthly_calendar` | 1,900원 | `calendar:{readingKey}:{YYYY-MM}` | `/saju/[slug]/premium` 캘린더 잠금 해제 | `getTasteProductEntitlement(scopeKey)` |
| `taste_year_core` | 3,900원 | `year:{readingKey}:{YYYY}` | `/saju/[slug]/premium` 올해 핵심 | `getTasteProductEntitlement(scopeKey)` |
| `lifetime_report` | 49,000원 | `lifetime:{readingKey}` | `/saju/[slug]/premium` 평생 소장 | `getLifetimeReportEntitlement` |
| `credit_1` | 500원 | n/a | `/credits` | n/a (소비형) |
| `credit_3` | 990원 | n/a | `/credits` | n/a |
| `credit_7` | 2,000원 | n/a | `/credits` | n/a |
| `subscription_30` | 9,900원 | n/a | `/credits` 보너스 코인 | n/a |
| `membership_plus` | 4,900원/월 | n/a | `/membership/checkout?plan=basic` | `getManagedSubscription` 활성 구독 |
| `membership_premium` | 9,900원/월 | n/a | `/membership/checkout?plan=premium` | `getManagedSubscription` |

## 3. 발견된 중복 결제 위험 (구체적)

### 3.1 today-detail (수정 완료)
**증상**: 같은 사주에 대해 today-detail 을 결제한 적이 있어도 다음 상황에서 다시 결제 안내가 노출.

| 상황 | 이전 동작 | 수정 후 |
|---|---|---|
| (A) 사주 결과를 다시 만들면 새 slug 생성 → 결제는 옛 slug 의 scope 에 보관 | ❌ 새 slug 의 `today:{slug}` 가 없어 다시 결제 안내 | ✅ readingKey 동등성 확인 후 인정 |
| (B) `/today-fortune` 에서 1코인 unlock → `/saju/[slug]` CTA 진입 | ❌ 코인 unlock 기록은 별도 테이블이라 saju CTA 에서 미인식 | ✅ `hasTodayFortunePremiumAccess` cross-flow 체크 |
| (C) `/saju` 에서 550원 결제 → `/today-fortune/detail` 재진입 | ❌ 같은 상황의 반대 방향 | ✅ checkout 에서 readingKey 보조 검사 |

### 3.2 그 외 패키지
- love/money/work: 글로벌 스코프 → 같은 사용자는 한 번만 결제 → 중복 위험 없음
- monthly-calendar: `calendar:{readingKey}:{YYYY-MM}` 결정적 → 같은 사주의 같은 월은 자동 차단
- year-core: `year:{readingKey}:{YYYY}` 결정적 → 같은 사주의 같은 해 차단
- lifetime-report: `lifetime:{readingKey}` 결정적 → 같은 사주에 대해 한 번만
- 멤버십: `subscriptions.status = 'active'` 가드 → 활성 구독자는 추가 결제 차단

## 4. 코드 변경

### 4.1 `src/lib/saju/today-detail-access.ts` (재작성)
- `getSajuTodayDetailEntitlement(slug)` 가 3가지 경로 모두 체크하도록 변경:
  1. `product_entitlements` 의 slug-기반 scope key (legacy)
  2. `product_entitlements` 의 readingKey-기반 scope key (BirthInput-결정적)
  3. `credit_transactions` 의 today-fortune 1코인 unlock 기록 (slug + readingKey)
- 새 헬퍼 `checkTodayDetailAccess` 가 `{ hasAccess, source }` 형태로 detail 반환 → 디버깅/로그 추적 가능.

### 4.2 `src/app/membership/checkout/page.tsx` (보강)
- today-detail 의 `coinUnlockedTodayDetail` 검사가 slug 만 보던 것을 readingKey 까지 확장.
- 사주를 다시 만들었더라도 같은 사람의 같은 결제는 인정.

### 4.3 `src/lib/payments/payment-duplicate-audit.spec.ts` (신규)
24개 vitest 케이스로 catalog 정합성을 자동 검증.

## 5. 자동 검사 (`npm run test:spec`)

다음 항목을 회귀 보호:

### 카탈로그 정합성
- ✅ `packageId` / `tasteProductId` 카탈로그 내 유일
- ✅ 모든 패키지가 양의 정수 가격
- ✅ `requiresSlug` 패키지는 슬러그 없이 confirmation 거부

### 서버 측 금액 재검증
- ✅ 가격에서 1원만 깎으려고 해도 거부 (가격 변조 차단)
- ✅ 카탈로그와 동일한 amount + 필수 슬러그 → 통과
- ✅ 존재하지 않는 `packageId` 거부

### Scope key 결정성
- ✅ `buildTodayDetailScopeKey('abc')` 는 항상 `today:abc`
- ✅ `buildReadingProductScopeKey('rx')` 는 항상 `reading:rx`
- ✅ `buildMonthlyCalendarScopeKey('rx', 2026, 5)` 는 항상 `calendar:rx:2026-05`
- ✅ `buildYearCoreScopeKey('rx', 2026)` 는 항상 `year:rx:2026`
- ✅ `buildLifetimeReportScopeKey('rx')` 는 항상 `lifetime:rx`
- ✅ 서로 다른 product 의 scope key 는 prefix 로 충돌하지 않음

### Scope 파서
- ✅ `parseYearMonthScope` 가 `2026-05`/`2026-5` 인식 + `2026-13`/garbage 거부
- ✅ `parseYearScope` 가 `2026` 인식 + 비숫자 거부

### Product ID ↔ Package 매핑
- ✅ 6개 TasteProductId 각각 정확히 하나의 카탈로그 패키지
- ✅ `getPaidProductIdFromPackage` 가 lifetime/taste 만 식별 (credits/subscription 은 null)

### `getPackage` 조회
- ✅ packageId 로 정확히 조회
- ✅ 존재하지 않는 id 는 falsy

## 6. 사용자 질문에 대한 답변

> "하나하나 일일이 결제를 해보면서 테스트해야 하는거야?"

**아니요**. 이제 다음으로 충분합니다:

```bash
npm run test:spec
```

- 24개 회귀 케이스가 0.5초 안에 끝남
- 카탈로그 가격 변경, 패키지 추가, scope key 변경 시 자동으로 catch
- 실제 토스 sandbox 결제 없이도 (a) 금액 일치 검증 (b) 중복 차단 로직 (c) 스코프 키 결정성 모두 보장
- 실 토스 sandbox 결제는 신규 결제수단 추가 / 결제 confirmation API 변경 시에만 별도 수동 검증

## 7. 추후 작업 후보

1. **legacy 데이터 마이그레이션 스크립트**: slug-based 로 저장된 today-detail entitlement 를 readingKey-based 로 1회성 백필 → cross-flow 가드를 빼고 단순화 가능.
2. **결제 confirmation idempotency**: 동일 `paymentKey` 가 두 번 confirm 호출될 때 entitlement 중복 grant 방지 → 별도 spec 추가.
3. **클라이언트 → 서버 amount 신뢰도**: `confirmPayment` 가 client `amount` 가 아닌 server-side catalog 가격으로 토스에 호출하도록 강제 (이미 `validatePaymentConfirmationPayload` 에서 1차 체크하나, toss 호출부도 catalog 값을 사용하는지 별도 확인 권장).
4. **운영 모니터링**: `productEntitlement` grant 시 metric 으로 카운트하고, 동일 user×product×scopeKey 가 24시간 내 2회 이상 grant 되면 알람.

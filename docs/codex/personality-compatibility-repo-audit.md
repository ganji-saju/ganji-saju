# Personality Compatibility Repo Audit

작성일: 2026-05-11  
대상 브랜치: `feature/personality-compatibility`  
범위: 달빛 성향궁합 구현 전 리포지토리 구조 조사

## 1. 기술 스택과 명령

### 프레임워크

- Next.js App Router 기반 프로젝트입니다.
- `src/pages`는 없고, 라우팅은 `src/app` 아래에서 관리됩니다.
- React 19, Next 16, TypeScript 5, Tailwind CSS 4를 사용합니다.
- Supabase Auth/DB, Toss Payments, OpenAI, Vercel Analytics/Speed Insights가 연결되어 있습니다.

### 주요 의존성

- UI/프론트: `next`, `react`, `react-dom`, `lucide-react`, `tailwindcss`, `@tailwindcss/postcss`
- DB/Auth: `@supabase/ssr`, `@supabase/supabase-js`
- 결제: `@tosspayments/payment-widget-sdk`, `@tosspayments/tosspayments-sdk`
- AI: `openai`
- 사주/달력: `lunar-typescript`
- 배포/관측: `@vercel/analytics`, `@vercel/speed-insights`
- 알림: `web-push`

### package.json scripts

| 명령 | 역할 |
| --- | --- |
| `npm run dev` | Next 개발 서버 실행 |
| `npm run build` | production build |
| `npm test` | `scripts/run-unit-tests.mjs` 실행 |
| `npm run typecheck` | `tsc --noEmit --pretty false --incremental false -p tsconfig.json` |
| `npm run start` | Next production server |
| `npm run preflight` | 배포 전 환경/설정 점검 |
| `npm run smoke` | smoke test |
| `npm run verify:imports` | import 검증 |
| `npm run validate:kasi` | KASI 달력 검증 |
| `npm run validate:classics` | 고전 코퍼스 검증 |

주의: `npm run lint` 스크립트는 현재 `package.json`에 없습니다.

## 2. 주요 폴더 구조

### 앱 라우팅

- `src/app`
  - Next.js App Router 라우트 루트입니다.
  - 주요 서비스 라우트:
    - `/`
    - `/saju/new`
    - `/saju/[slug]`
    - `/saju/[slug]/premium`
    - `/saju/[slug]/today-detail`
    - `/compatibility`
    - `/compatibility/input`
    - `/compatibility/result`
    - `/today-fortune`
    - `/tarot/daily`
    - `/membership`
    - `/membership/checkout`
    - `/membership/success`
    - `/pricing`
    - `/my`
    - `/my/profile`
    - `/my/billing`
    - `/login`
    - `/reset-password`
  - 주요 API 라우트:
    - `/api/ai`
    - `/api/interpret`
    - `/api/interpret/yearly`
    - `/api/interpret/lifetime`
    - `/api/profile`
    - `/api/family-profiles`
    - `/api/payments/prepare`
    - `/api/payments/confirm`
    - `/api/readings`
    - `/api/credits/use`
    - `/api/today-fortune/unlock`
    - `/api/fortune-calendar`

### UI/기능 레이어

- `src/components`
  - 공통 UI, Gangi 디자인 컴포넌트, 결제 UI, 사주 공유 입력 필드 등이 있습니다.
- `src/features`
  - 화면 단위 클라이언트 기능이 있습니다.
  - 궁합은 `src/features/compatibility`에 집중되어 있습니다.
- `src/shared/layout`
  - 앱 쉘과 모바일 레이아웃 공통 구조가 있습니다.
- `src/content`
  - 서비스 카피, 상품/탭/선생/궁합 관계 타입 등 화면 콘텐츠 상수가 있습니다.

### 도메인/서버/라이브러리

- `src/domain/saju`
  - 사주 엔진, 리포트 빌더, 검증 로직이 있습니다.
- `src/lib`
  - Supabase 접근, 프로필, 결제, 권한, 크레딧, 사주 타입/저장/읽기 유틸이 있습니다.
- `src/server`
  - AI 호출, 오늘운 빌더, 검증 서버 로직이 있습니다.

### DB와 마이그레이션

- `supabase/migrations`
  - 001부터 020까지 마이그레이션이 있습니다.
  - `prisma`, 루트 `migrations`, `src/pages` 폴더는 현재 없습니다.

## 3. 기존 사주 관련 파일

### 입력/결과 라우트

- `src/app/saju/new/page.tsx`
- `src/features/saju-intake/saju-intake-page.tsx`
- `src/features/saju-intake/onboarding-storage.ts`
- `src/app/saju/[slug]/page.tsx`
- `src/app/saju/[slug]/premium/page.tsx`
- `src/app/saju/[slug]/today-detail/page.tsx`
- `src/app/saju/[slug]/overview/page.tsx`
- `src/app/saju/[slug]/nature/page.tsx`
- `src/app/saju/[slug]/elements/page.tsx`

### 사주 엔진과 리포트

- `src/domain/saju/engine/saju-data-v1.ts`
- `src/domain/saju/engine/orrery-adapter.ts`
- `src/domain/saju/report/build-report.ts`
- `src/domain/saju/report/build-report-copy.ts`
- `src/domain/saju/report/build-report-scores.ts`
- `src/domain/saju/report/build-yearly-report.ts`
- `src/domain/saju/report/build-lifetime-report.ts`
- `src/domain/saju/report/build-fortune-calendar.ts`
- `src/domain/saju/report/topic-rule-table.ts`
- `src/domain/saju/report/types.ts`
- `src/domain/saju/validators/birth-input.ts`
- `src/domain/saju/validation/kasi-calendar.ts`

### 사주 저장/입력 유틸

- `src/lib/saju/types.ts`
- `src/lib/saju/unified-birth-entry.ts`
- `src/lib/saju/birth-location.ts`
- `src/lib/saju/readings.ts`
- `src/lib/saju/pillars.ts`
- `src/lib/saju/today-detail-access.ts`
- `src/lib/saju/today-detail-links.ts`
- `src/components/saju/shared/unified-birth-info-fields.tsx`

### AI 해석

- `src/app/api/interpret/route.ts`
- `src/app/api/interpret/yearly/route.ts`
- `src/app/api/interpret/lifetime/route.ts`
- `src/server/ai/saju-interpretation.ts`
- `src/server/ai/yearly-interpretation.ts`
- `src/server/ai/lifetime-interpretation.ts`

## 4. 기존 궁합 관련 파일

### 라우트

- `src/app/compatibility/page.tsx`
- `src/app/compatibility/input/page.tsx`
- `src/app/compatibility/result/page.tsx`

### 화면 컴포넌트

- `src/features/compatibility/compatibility-input-client.tsx`
- `src/features/compatibility/compatibility-result-view.tsx`
- `src/features/compatibility/manual-compatibility-result-client.tsx`
- `src/features/compatibility/manual-compatibility-storage.ts`

### 도메인/계산

- `src/lib/compatibility.ts`
- `src/lib/compatibility.test.ts`

### 콘텐츠 상수

- `src/content/moonlight.ts`
  - `CompatibilityRelationshipSlug`
  - `COMPATIBILITY_RELATIONSHIPS`
  - `COMPATIBILITY_RESULT_LABELS`
  - `COMPATIBILITY_PREMIUM_EXPANSION`
  - `MOONLIGHT_TASTE_PRODUCTS` 중 `love-question`

### 현재 궁합 흐름

1. `/compatibility/input`에서 관계 타입을 query로 받습니다.
2. 로그인 사용자는 `/api/profile`에서 내 프로필과 가족 프로필을 불러옵니다.
3. 비로그인 사용자는 내 정보와 상대 정보를 직접 입력합니다.
4. 입력값은 `UnifiedBirthInfoFields`와 `resolveUnifiedBirthInput`을 통해 `BirthInput`으로 정규화됩니다.
5. 수동 입력 결과는 `sessionStorage`의 `moonlight:compatibility-manual-v1`에 저장됩니다.
6. `/compatibility/result?source=manual` 또는 저장 프로필 기반 결과가 표시됩니다.
7. `buildCompatibilityInterpretation`이 두 사람의 사주 데이터를 계산하고 관계 요약을 만듭니다.

## 5. 기존 결제/코인/멤버십 관련 파일

### 상품 카탈로그

- `src/lib/payments/catalog.ts`
  - `PaymentPackageKind`
  - `TasteProductId`
  - `PAYMENT_PACKAGES`
  - `getPackage`
  - `getTasteProductPackage`

현재 상품 종류:

- 코인: `credit_1`, `credit_3`, `credit_7`
- 구독/멤버십: `subscription_30`, `membership_plus`, `membership_premium`
- 평생/보관형 리포트: `lifetime_report`
- 소액 풀이:
  - `today-detail`
  - `love-question`
  - `money-pattern`
  - `work-flow`
  - `monthly-calendar`
  - `year-core`

### 상품 scope와 중복 결제 방지

- `src/lib/payments/product-scope.ts`
  - `resolvePaymentProductScope`
  - `buildTodayDetailScopeKey`
  - `buildMonthlyCalendarScopeKey`
  - `buildYearCoreScopeKey`
  - `buildLifetimeReportScopeKey`
  - `buildPurchasedProductHref`

현재 `love-question`, `money-pattern`, `work-flow`은 전역 상품으로 처리됩니다.  
성향궁합을 두 사람 단위로 과금하려면 전역 scope가 아니라 두 사람 입력 해시 또는 compatibility session key 기반 scope가 필요합니다.

### 결제 API

- `src/app/api/payments/prepare/route.ts`
  - 결제창 진입 전 로그인 여부와 기존 권한을 확인합니다.
  - 이미 구매한 상품은 결제창 대신 기존 열람 경로를 반환합니다.
- `src/app/api/payments/confirm/route.ts`
  - Toss 결제 승인 후 코인/구독/상품 권한을 부여합니다.
  - `product_entitlements`와 `paid_reading_snapshots` 저장을 연결합니다.

### 권한과 스냅샷

- `src/lib/product-entitlements.ts`
- `src/lib/report-entitlements.ts`
- `src/lib/payments/paid-reading-snapshots.ts`

### 코인 차감

- `src/lib/credits/deduct.ts`
- `src/lib/credits/detail-report-access.ts`
- `src/lib/credits/calendar-access.ts`
- `src/app/api/credits/use/route.ts`
- `src/app/api/today-fortune/unlock/route.ts`

## 6. 기존 사용자 프로필/출생정보 구조

### 프로필 라이브러리

- `src/lib/profile.ts`

주요 타입:

- `BirthProfileFields`
- `UserProfile`
- `FamilyProfile`
- `FamilyProfileInput`

저장되는 주요 출생 필드:

- `calendarType`
- `timeRule`
- `birthYear`
- `birthMonth`
- `birthDay`
- `birthHour`
- `birthMinute`
- `birthLocationCode`
- `birthLocationLabel`
- `birthLatitude`
- `birthLongitude`
- `solarTimeMode`
- `gender`
- `note`
- `preferredCounselor`

### 프로필 API와 화면

- `src/app/api/profile/route.ts`
- `src/app/api/profile/route-helpers.ts`
- `src/app/api/family-profiles/route.ts`
- `src/app/api/family-profiles/route-helpers.ts`
- `src/components/my/profile-manager.tsx`
- `src/app/my/profile/page.tsx`
- `src/app/my/page.tsx`

### BirthInput 변환

- `src/lib/profile.ts`의 `toBirthInputFromProfile`
- `src/lib/saju/unified-birth-entry.ts`의 `resolveUnifiedBirthInput`

성향궁합은 이 변환 흐름을 그대로 쓰는 것이 안전합니다.

## 7. 기존 DB 구조

마이그레이션 기준으로 확인한 구조입니다. 운영 DB에 실제로 모두 적용되었는지는 별도 `supabase migration list` 또는 SQL 확인이 필요합니다.

### 사용자/프로필

- `profiles`
  - 사용자 기본 프로필과 출생 정보
- `family_profiles`
  - 가족/상대 저장 프로필

관련 마이그레이션:

- `003_profiles.sql`
- `005_profile_birth_minutes.sql`
- `009_profile_birth_locations.sql`
- `010_profile_preferred_counselor.sql`
- `014_profile_birth_calendar_fields.sql`

### 사주 결과/캐시

- `readings`
  - 무료/기본 사주 결과 저장
  - `019_readings_owner_mutations.sql`에서 로그인 사용자의 저장/삭제 정책이 추가되었습니다.

### 코인/구독

- `user_credits`
- `credit_transactions`
- `subscriptions`

관련 마이그레이션:

- `001_initial.sql`
- `002_credit_functions.sql`
- `015_idempotent_credit_unlocks.sql`

### 유료 상품 권한/스냅샷

- `product_entitlements`
  - 유료 상품 해금 기준 테이블
  - unique index: `(user_id, product_id, scope_key)`
- `paid_reading_snapshots`
  - 결제 당시 결과 스냅샷 저장

관련 마이그레이션:

- `016_product_entitlements.sql`
- `018_product_entitlements_taste_product_check.sql`
- `020_product_entitlements_paid_snapshots.sql`

주의: 새 `product_id`를 추가하려면 `product_entitlements_product_id_check` 제약을 확장하는 마이그레이션이 필요합니다.

## 8. 새 기능 추천 위치

### 가장 안전한 방향

기존 `/compatibility/input`과 `/compatibility/result` 흐름을 유지하고, 그 위에 `성향궁합` 모드를 얹는 방식이 가장 안전합니다.

이유:

- 이미 내 정보/상대 정보 입력과 저장 프로필 불러오기가 구현되어 있습니다.
- 비로그인 수동 입력 흐름도 이미 있습니다.
- 사주 엔진을 새로 건드리지 않고 `BirthInput -> SajuDataV1 -> CompatibilityInterpretation` 흐름을 재사용할 수 있습니다.
- 결제는 기존 `prepare -> checkout -> confirm -> entitlement -> snapshot` 흐름을 확장할 수 있습니다.

### 추천 파일 위치

| 목적 | 추천 위치 |
| --- | --- |
| 성향궁합 판단 타입/빌더 | `src/lib/personality-compatibility.ts` 또는 `src/lib/compatibility.ts` 내부 확장 |
| 성향궁합 UI | `src/features/compatibility/` |
| 관계/문제 선택 콘텐츠 | `src/content/moonlight.ts` |
| 입력 화면 확장 | `src/features/compatibility/compatibility-input-client.tsx` |
| 결과 화면 확장 | `src/features/compatibility/compatibility-result-view.tsx` 또는 신규 `personality-compatibility-result-view.tsx` |
| 수동 입력 저장 | `src/features/compatibility/manual-compatibility-storage.ts` |
| 결제 상품 추가 | `src/lib/payments/catalog.ts` |
| scope key 추가 | `src/lib/payments/product-scope.ts` |
| DB product_id 추가 | 신규 Supabase migration |
| 보관함 표시 | `src/app/my/page.tsx`, `src/lib/payments/paid-reading-snapshots.ts` |

### 피해야 할 변경

- `src/domain/saju/engine`의 사주 계산 로직을 성향궁합 때문에 변경하지 않습니다.
- 기존 `readings` slug 정책을 성향궁합 구현과 함께 바꾸지 않습니다.
- 기존 결제 승인 로직을 직접 분기 추가로 복잡하게 만들기보다 `catalog`, `product-scope`, `product_entitlements` 체계를 먼저 확장합니다.
- 무료 결과 단계에서는 새 DB 테이블을 만들지 않고 session/profile 기반 흐름으로 시작합니다.

## 9. 다음 구현 순서

1. 성향궁합 결과 타입 정의
   - 무료 결과: 한 줄 요약, 잘 맞는 지점, 어긋나는 지점, 오늘 해볼 행동
   - 상세 결과: 관계 온도, 표현 방식, 갈등 패턴, 회복 문장
2. 기존 `buildCompatibilityInterpretation`을 건드리기 전에 별도 빌더를 추가하거나 래핑합니다.
3. `/compatibility/input`에 `성향궁합` 진입 문구와 관계/문제 선택을 추가합니다.
4. `/compatibility/result`에 성향궁합 무료 결과 화면을 연결합니다.
5. 입력값을 바꿨을 때 결과가 실제로 달라지는지 테스트를 추가합니다.
6. 소액 상세 상품을 붙일지 결정한 뒤, 결제 상품과 scope를 추가합니다.
7. 유료 상세는 결제 완료 후 별도 결과 화면 또는 snapshot 기반 재열람으로 연결합니다.
8. 보관함에서 성향궁합 결과가 당시 스냅샷으로 열리는지 확인합니다.
9. 모바일 QA 후 typecheck/test/build를 실행합니다.

## 10. 조사 결론

성향궁합은 완전히 새 기능처럼 보이지만, 현재 코드베이스에는 이미 필요한 기반이 대부분 있습니다.

- 입력 기반: `UnifiedBirthInfoFields`, `resolveUnifiedBirthInput`
- 저장 기반: `profiles`, `family_profiles`, sessionStorage manual compatibility payload
- 계산 기반: `normalizeToSajuDataV1`, `buildCompatibilityInterpretation`
- 결제 기반: `PAYMENT_PACKAGES`, `product-scope`, `product_entitlements`
- 보관 기반: `paid_reading_snapshots`

따라서 첫 구현은 "새 엔진"보다 "기존 궁합 위에 성향궁합 결과 레이어 추가"가 가장 안전합니다. 결제 상품은 무료 결과 검증 후 별도 단계에서 붙이는 편이 좋습니다.

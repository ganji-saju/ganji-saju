# 결제/멤버십 연결 감사 기록 - 2026-05-05

## 확인 범위

- 실제 결제 상품 정의: `src/lib/payments/catalog.ts`
- 멤버십/가격 화면: `src/app/membership/page.tsx`, `src/app/pricing/page.tsx`
- 코인 충전 화면: `src/app/credits/page.tsx`
- 결제 확인 흐름: `src/app/membership/checkout/page.tsx`, `src/app/membership/success/page.tsx`, `src/app/api/payments/confirm/route.ts`
- 사주 입력 후 결제 연결: `src/features/saju-intake/saju-intake-page.tsx`
- 결과 화면 소액 상품 연결: `src/app/saju/[slug]/page.tsx`, `src/app/saju/[slug]/premium/page.tsx`

## 발견한 불일치

| 영역 | 문제 | 조치 |
| --- | --- | --- |
| 보관형 리포트 가격 | 멤버십/가격 화면은 `49,000원~79,000원` 범위, 실제 결제는 `49,000원` 단일 상품 | 실제 결제 카탈로그의 `lifetime_report` 가격을 화면 표시 기준으로 연결 |
| 소장형 리포트 카드 | `yearly-2026`, `relationship-standard`, `family-report`는 실제 SKU 없이 가격 범위가 표시됨 | 실제 결제 미연결 상품은 `결제 준비 중` 또는 `준비 중`으로 표시 |
| 사주 입력 후 보관형 리포트 | `/saju/new?product=life-standard`는 입력 후 결제로 이어지지 않음 | `/saju/new?plan=lifetime`을 받아 결과 생성 후 `/membership/checkout?plan=lifetime&slug=...`로 이동 |
| 소액 상품 목록 | 결제 카탈로그에는 6개, 화면 공통 목록에는 4개만 존재 | `monthly-calendar`, `year-core`를 `TASTE_PRODUCTS`에 추가 |
| 프리미엄 결과 소액 링크 | `money-pattern`, `work-flow`가 `/today-fortune`으로 빠질 수 있음 | 각 상품별 checkout 링크로 분기 |
| 월간 코인팩 | 화면은 코인 전용이라고 설명하지만 실제 confirm에서 멤버십 구독처럼 활성화 가능 | `subscription_30`을 멤버십 활성화 대상에서 제외하고 `보너스 36 코인`으로 표현 정리 |
| 코인 화면 상품 정의 | `credits/page.tsx`에 가격/코인 수가 별도 하드코딩됨 | `PAYMENT_PACKAGES`를 기준으로 렌더링 |

## 남은 확인 필요

- Toss 실제 결제창에서 각 `packageId`와 금액이 맞게 표시되는지 운영 계정으로 실결제 직전까지 확인
- Supabase `product_entitlements` 마이그레이션이 운영 DB에 적용되어 있는지 확인
- 결제 완료 후 `/my/billing`, `/my`, 결과 화면의 이용권 표시가 같은 데이터를 보는지 재검증
- 연결되지 않은 고가 리포트 상품을 계속 유지할지, 실제 SKU를 만들지 상품 정책 확정

# 달빛 성향사주 결제/권한 연결 노트

작성일: 2026-05-11  
문서 상태: Draft  
작업 범위: 990원 깊이보기 상품 등록 코드, entitlement scope, 결제 성공/실패 이동 경로

## 1. 상품 정보

| 항목 | 값 |
| --- | --- |
| product_code | `saju_personality_mini` |
| package_id | `taste_saju_personality_mini` |
| 상품명 | 달빛 성향사주 깊이보기 |
| 가격 | 990원 |
| scope prefix | `saju-personality` |

## 2. 재사용한 결제 구조

- 기존 Toss 결제창 진입: `/membership/checkout`
- 기존 결제 준비 API: `/api/payments/prepare`
- 기존 결제 승인 API: `/api/payments/confirm`
- 기존 소액 상품 catalog: `src/lib/payments/catalog.ts`
- 기존 product entitlement 저장: `product_entitlements`
- 기존 중복 구매 차단: `getTasteProductEntitlement`
- 기존 결제 스냅샷: `paid_reading_snapshots`

새 결제 시스템은 만들지 않았다.

## 3. 권한 확인 방식

- 성향사주 결과에서 입력값 기반 비식별 scope key를 생성한다.
- scope key 예시 형태: `saju-personality:{hash}`
- `/api/saju/personality/entitlement?scope=...`에서 로그인 사용자와 `product_entitlements`를 확인한다.
- 권한이 없으면 무료 결과와 잠금 영역만 표시한다.
- 권한이 있으면 같은 결과 범위의 유료 섹션을 표시한다.
- 이미 구매한 scope는 `/api/payments/prepare`와 `/membership/checkout`에서 재결제를 막고 결과 화면으로 되돌린다.

## 4. 결제 이동 경로

- 무료 결과 CTA:
  - `/api/payments/prepare`
  - `/membership/checkout?product=saju_personality_mini&scope=...&from=saju-personality-result`
- 결제 성공:
  - `/membership/success`
  - `/api/payments/confirm`
  - `/saju/personality/result?paid=saju_personality_mini&scope=...`
- 결제 실패/취소:
  - `/saju/personality/result?payment=failed&scope=...`

## 5. 운영 확인 필요

- Toss/운영 상품 관리에서 `saju_personality_mini` 990원 상품 노출 정책 확인 필요.
- Supabase production에 `025_saju_personality_mini_entitlement.sql` 적용 필요.
- 프리미엄 멤버십에 달빛 성향사주 깊이보기를 포함할지 정책 결정 필요.
- 현재 코드는 멤버십 포함 플랜을 빈 배열로 두고 `membershipPolicy: policy_pending`을 반환한다.

## 6. 개인정보 주의

- 결제 scope query에는 이름, 생년월일시, 성별 원본값을 넣지 않는다.
- scope는 브라우저 입력값에서 생성한 hash 기반 키만 전달한다.
- 결제/analytics payload에는 `productCode`, `packageId`, `amount`, `from` 정도의 비식별 정보만 포함한다.

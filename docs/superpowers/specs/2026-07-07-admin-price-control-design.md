# 관리자 전상품 가격 제어 — 설계문서

> 작성일: 2026-07-07 · 상태: 승인됨(사용자) · 전달: 3단계 PR(Phase 1부터)

## 목표

관리자 콘솔에서 **모든 상품의 가격을 변경**할 수 있게 하고, 변경 시 **실서비스 청구액과 사이트 전 노출(가격 페이지·페이월·체크아웃·마케팅 카피·정책/약관 문구)이 한 번에 동기화**되게 한다. 각 상품에 **현재가격·과거가격·변경가격**을 입력하고, 수정 시 **"한 번 변경하면 되돌릴 수 없습니다"** 확인창을 띄운다.

## 배경 — 현재 아키텍처 검수 결과

| 영역 | 현황 | 단일화 난이도 |
|---|---|---|
| **결제 청구액** | `PAYMENT_PACKAGES`(`src/lib/payments/catalog.ts`)의 `price`(컴파일 상수)가 `prepare`·`confirmation`·`order-ledger`·`nicepay/return` 4곳에서 청구+검증 | 작음 — 서버 리졸버 1개로 라우팅 |
| **표시 가격** | `'9,900원'` 등 문자열이 ~30개 파일에 하드코딩(가격페이지·페이월·체크아웃·메가내브·SEO·마케팅 콘텐츠) | 큼 — 레지스트리 참조로 교체 |
| **법률 약관 본문** | 대부분 가격 없음(예약정책은 "요금 표시 항목 제거"됨). 가격은 마케팅/가격 페이지·commerce-disclosure·FAQ에 집중 | 작음 — 소수만 토큰화 |
| **과거 주문 금액** | 이미 실결제액(`metadata.amount`) 보존 — 가격 개정해도 소급 왜곡 없음(`payment-history.ts`·`credit-refunds.ts`가 이미 대비) | 없음(그대로) |
| **과거가 취소선** | premium/deep 페이지에 `line-through` 이미 존재 | 재사용 |

**핵심 제약(머니패스 일관성):** `pkg.price`는 청구액이자 **위변조 방지 가드**다.
- `src/app/api/payments/prepare/route.ts` — 주문 금액 = `pkg.price`
- `src/lib/payments/confirmation.ts:56` — `pkg.price !== amount`면 거부
- `src/lib/payments/order-ledger.ts:187` — 주문 원장 금액 = `pkg.price`
- `src/app/api/payments/nicepay/return/route.ts:208` — `pkg.price !== amount`면 거부

→ 가격을 admin에서 바꾸면 **이 4곳이 모두 같은 리졸버를 경유**해야 한다. 하나라도 카탈로그 상수를 직접 읽으면 "사용자가 본 가격 ≠ confirm이 검증하는 가격"이 되어 결제가 거부된다.

## 확정된 의미론(사용자 결정)

1. **과거가격(`previous_price`)** = 취소선 정가 표시용(마케팅). 청구·검증에는 쓰지 않는다.
2. **"되돌릴 수 없습니다"** = 저장 시 실서비스 청구액에 **즉시 반영**된다는 확인창 경고. 기술적 하드 잠금이 아니다 — 이후 재변경 가능. 단, **모든 변경은 append-only 이력으로 감사 저장**한다(누가·언제·old→new).

## 아키텍처

### 공통 기반 — 데이터 모델 + 리졸버 (Phase 1에서 구축)

**DB 테이블 2종** (마이그레이션 수동 적용 — 프로젝트 관례. 카탈로그 기본가로 시드):

```
product_prices
  package_id      text primary key   -- PAYMENT_PACKAGES[].id 와 일치
  price           integer not null   -- 현재 라이브 청구가(₩)
  previous_price  integer            -- 과거가(취소선 표시용, nullable)
  updated_at      timestamptz not null default now()
  updated_by      text               -- admin user id
  -- RLS enable, 정책 0개(deny-all, service 전용)

product_price_changes           -- append-only 감사 이력
  id              uuid primary key default gen_random_uuid()
  package_id      text not null
  old_price       integer            -- 변경 전 라이브가
  new_price       integer not null   -- 변경 후
  previous_price  integer            -- 변경 시 함께 설정한 과거가
  changed_by      text
  changed_at      timestamptz not null default now()
  -- RLS enable, 정책 0개(deny-all)
```

- 카탈로그 `PAYMENT_PACKAGES[].price`는 **기본값/시드/폴백**으로 유지(코드 진실 → 런타임 진실은 DB).
- 시드: 마이그레이션이 현 카탈로그 12개 상품의 `id`·`price`를 `product_prices`에 insert(`on conflict do nothing`).

**리졸버** `src/lib/payments/price-resolver.ts` (서버 전용):
- `getResolvedPrices(): Promise<Map<PackageId, { price: number; previousPrice: number | null }>>`
  — `product_prices` 전체 조회, 누락 id는 카탈로그 기본값으로 채움. React `cache()`로 per-request 캐시.
- `resolvePackagePrice(id: PackageId): Promise<number>` — 단일 가격(폴백 포함).
- Supabase env 없을 때(CI/preview) 카탈로그 기본값으로 graceful fallback.

### Phase 1 — 결제 금액 + admin 메뉴 (PR ①)

**머니패스 리졸버 전환**(4곳, 서버):
- `prepare/route.ts` — 주문 amount = `await resolvePackagePrice(pkg.id)`
- `confirmation.ts` — 검증 기준을 리졸버 값으로
- `order-ledger.ts` — 원장 금액을 리졸버 값으로(주문 생성 시점 스냅샷 — 과거 주문은 자기 값 보존)
- `nicepay/return/route.ts` — 검증 기준을 리졸버 값으로
- 4곳 모두 **동일 리졸버** → 사용자 노출가 = 청구액 = 검증값.

**신규 `/admin/pricing`** (`/admin/policies` 3파일 구조 미러):
- `src/app/admin/pricing/page.tsx` — 서버 컴포넌트, **super_admin** 게이트, 전 카탈로그 상품 + 리졸버 가격 로드.
- `src/app/admin/pricing/pricing-admin-client.tsx` — 표: `상품명 · 현재가격(읽기, DB) · 과거가격(입력) · 변경가격(입력) · [수정]`.
  - [수정] → 확인창: **"한 번 변경하면 되돌릴 수 없습니다. 실서비스 청구액에 즉시 반영됩니다. 계속할까요?"** → 확인 시 POST.
- `src/app/api/admin/pricing/route.ts` — super_admin 게이트. 입력 검증(정수 > 0, package_id 카탈로그 존재). `product_prices` upsert(price=변경가, previous_price=과거가) + `product_price_changes` insert. 응답으로 갱신 목록.
- `src/lib/admin/nav.ts` — `{ href: '/admin/pricing', label: '가격 관리', minRole: 'super_admin' }` 추가(운영 도구 그룹).

**테스트(Phase 1):**
- 리졸버: DB 오버라이드 우선, 누락 시 카탈로그 폴백, env 없을 때 폴백.
- 머니패스 일관성: prepare·confirm이 같은 리졸버 값을 쓴다(오버라이드 시 confirm이 새 가격을 통과, 구 가격은 거부).
- admin API: 정수>0 검증, 잘못된 package_id 거부, 감사행 insert, super_admin 아닌 요청 거부.

### Phase 2 — 전 노출 단일화 (PR ②)

- `src/lib/payments/price-registry.ts`: `PriceKey`(표시 지점 논리키) → `PackageId` 맵 + 포맷 헬퍼 `priceLabel(key)`(예: `'9,900원'`), `priceWon(key)`.
- `PriceProvider`(서버→클라 컨텍스트): 루트 레이아웃에서 리졸버로 1회 하이드레이트 → 클라 컴포넌트 `usePriceLabel(key)`. 서버 컴포넌트는 리졸버 직접 사용.
- **~30개 파일 리팩터**: `'9,900원'` 등 하드코딩 → 레지스트리 참조. 콘텐츠 파일(`moonlight.ts`·`gangi-market.ts`)의 `price` 필드도 키로 전환.
- Phase 2 계획 수립 시 **가격 노출 지점 전수 감사(워크플로 fan-out)**로 정확한 인벤토리를 먼저 확정한다.
- 결과: 화면의 모든 가격 = admin 값.

### Phase 3 — 정책/가격 텍스트 토큰화 (PR ③)

- 토큰 `{{price:today-detail}}`·`{{price:membership_premium}}`을 policy_versions 본문·가격페이지 카피·commerce-disclosure·FAQ에 도입.
- 렌더러(`policy-content.tsx`·가격페이지)가 서브 시 리졸버로 치환.
- 가격을 담은 소수 텍스트를 토큰으로 마이그레이트.
- 결과: 약관/가격 문구도 자동 반영.

## 단계 간 주의(중요)

Phase 1은 **인프라 + 청구 정합 구축**이 목적이다. Phase 1 단독 상태에서 가격을 실제로 바꾸면 **표시가(하드코딩 문자열)와 청구액이 불일치**한다(페이월 카드는 구 가격, PG 결제창은 새 가격). 보안 문제는 아니나(사용자는 PG 창에서 실제 금액 확인) 혼란을 준다.

→ **실제 운영 가격 변경은 Phase 2 완료 후 수행**을 권장한다. admin 페이지에 이 안내 배너를 노출한다("표시 단일화(Phase 2) 적용 전에는 가격 변경 시 화면 표시가 청구액과 다를 수 있습니다"). Phase 2 완료 후 배너 제거.

## 컴포넌트 경계(단일 책임)

| 유닛 | 책임 | 의존 |
|---|---|---|
| `price-resolver.ts` | DB 오버라이드 + 카탈로그 폴백을 병합해 "현재 가격"을 제공 | catalog, supabase service |
| `product_prices` / `product_price_changes` | 런타임 가격 진실 + 감사 이력 | — |
| `api/admin/pricing` | 검증·upsert·감사·권한 | resolver, supabase service, admin-auth |
| `pricing-admin-client` | 입력 UI + 확인창 | api/admin/pricing |
| `price-registry` (Phase 2) | 표시 지점 논리키 ↔ 패키지 + 포맷 | resolver |
| `PriceProvider` (Phase 2) | 클라 표시 하이드레이트 | resolver |
| 토큰 치환기 (Phase 3) | 텍스트 내 `{{price:*}}` 치환 | resolver |

## 오류 처리

- 리졸버: DB 조회 실패/누락 → 카탈로그 기본값(서비스 지속). env 없음 → 카탈로그 기본값.
- admin API: 정수>0 아님·미존재 package_id·권한 없음 → 4xx, 이력 미기록.
- 머니패스: 리졸버가 폴백을 반환해도 4곳이 **같은 값**을 받으므로 confirm 정합 유지.

## 테스트 전략

- 단위: 리졸버 폴백/오버라이드, 포맷 헬퍼(Phase 2), 토큰 치환(Phase 3).
- 통합: 머니패스 일관성(오버라이드가 prepare·confirm·ledger·return에 일관 반영).
- API: admin/pricing 검증·감사·권한 게이트.
- 게이트: `tsc --noEmit` · 커스텀 유닛러너 · `next build`.

## 명시적 비목표(YAGNI)

- 예약 가격 변경(effective_date 스케줄링) — 즉시 반영만.
- 통화·다국어 가격 — ₩ 단일.
- 쿠폰/프로모션 엔진 — 별개.
- 가격 A/B 테스트 — 별개.
- Phase 2/3의 상세 파일별 계획 — 각 단계 착수 시 별도 spec+plan.

## 리스크 / 가정 붕괴 조건

- **가정:** 머니패스 가격 읽기는 위 4곳뿐. → Phase 1 계획 전 `pkg.price`/`\.price` 전 사용처 재확인으로 검증.
- **리스크:** admin이 실수로 잘못된 가격 저장 → 확인창 + 정수>0 검증 + 감사이력으로 완화(재변경으로 정정).
- **리스크:** 리졸버 async 전환이 동기 호출부를 깨뜨림 → 머니패스는 모두 서버 async 경로라 안전. 동기 표시부는 Phase 2에서 컨텍스트로 처리.

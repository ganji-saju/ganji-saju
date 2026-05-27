# 가격 사다리 신규 상품 — 반영 계획 & 코드 영향 분석

작성일: 2026-05-23 / 최종 갱신: 2026-05-27 / 상태: **계획 문서 + 일부 구현 완료 상태 반영** / 출처: [`pricing-proposal.md`](pricing-proposal.md) 롤아웃 1~3순위 + 검증 지표
초안 대상 커밋 기준: `1f65f40` (결제 P0 정비 직후)

> 목적: 제안서의 신규 상품을 **실제로 코드에 반영하면 무엇을 건드려야 하고 어떤 리스크가 있는지** 사전 검토. 실제 구현은 별도 승인 후.

---

## 0. 핵심 결론 (먼저 읽기)

> 2026-05-27 갱신: 아래 진단은 2026-05-23 초안 기준이다. 현재 로컬 코드에는 `kind: 'bundle'`, `components`, `grantBundleComponents`, `revokeBundleComponents`, `bundle_today_set`이 구현돼 있다. 아직 남은 것은 후속 번들, bundle 결제 동의 규칙, credit prepare/동의 경로 정합화다.

1. **초안 당시 결제 모델은 `1 패키지 = 1 productId = 1 scope`** 로 고정돼 있었다(catalog·confirmation·confirm·scope·조회 전부 이 가정). 제안서의 묶음 상품(오늘 풀세트·올해 풀패키지)은 **`1 결제 = N 권한`** 이라, 이 모델에 없는 **묶음 인프라를 새로 도입**해야 했다.
2. 그래서 제안서의 **"1순위 = 난이도 낮음"은 카탈로그/카피 관점일 뿐**, 실제로는 결제 백엔드(`confirm` grant 경로) 변경이 처음으로 필요해 **실질 난이도는 "중"**이었다.
3. **진짜 난이도 최저는 티어 C "분할 환산 문구"** (카피 1곳, 로직 0). 이건 즉시 가능.
4. 따라서 권장 실행 순서를 아래처럼 재배열한다:
   - **0순위**: 분할 환산 문구 (카피만, 코드 로직 0)
   - **1순위**: **묶음 인프라** + 오늘 풀세트 990원 (2026-05-27 기준 구현 완료)
   - **2순위**: 올해 풀패키지 7,900원 (1순위 인프라 재사용)
   - **3순위**: 사주 코어팩 19,000원 (부분 lifetime — 별도 스펙, 이번 롤아웃 제외 권장)
5. **묶음 설계는 "구성품 분해 grant" 방식(A안)을 권장**: 묶음 결제 시 confirm 이 구성 상품을 각각 기존 방식으로 grant. 조회·렌더(`useProductEntitlement`, premium/page.tsx)는 기존 productId 그대로라 **변경 0**. 새 productId를 만드는 B안은 조회/렌더 전면 변경이라 비권장.

---

## 1. 현재 결제 아키텍처 제약 (왜 묶음이 어려운가)

| 레이어 | 파일 | 현재 가정 | 묶음에 걸리는 지점 |
|---|---|---|---|
| 카탈로그 | `src/lib/payments/catalog.ts:14-24,26` | `PaymentPackage` = 단일 `tasteProductId?` | 묶음은 구성품 목록이 필요 → 필드/kind 추가 |
| 결제 검증 | `src/lib/payments/confirmation.ts:55-58` | `pkg.price === amount` 1건 | catalog 행만 있으면 통과 (OK) |
| | `confirmation.ts:48-49` | `scope` 단일 문자열 | 묶음의 다중 scope를 1개로 못 담음 |
| 권한 부여 | `src/app/api/payments/confirm/route.ts:107-116` | `grantTasteProductEntitlement(단일)` | 묶음이면 N개 grant 루프 필요 ★ |
| | `confirm/route.ts:98-105` | `grantLifetimeReportEntitlement(단일)` | 코어팩(부분 lifetime) 미지원 |
| scope 해석 | `src/lib/payments/product-scope.ts:129-236` | productId 1개 → scopeKey 1개 | 묶음은 구성품별 scope 파생 필요 |
| 중복 차단 | `src/app/api/payments/prepare/route.ts:132-161` | 단일 entitlement/코인 확인 | 묶음 "전부 보유" 판정 신규 |
| 조회(서버) | `product-entitlements.ts` / `report-entitlements.ts` | productId+scopeKey 단건 | 분해 grant면 **변경 불필요** |
| 조회(client) | `src/lib/payments/use-product-entitlement.ts:35` | `productId: string` 단건 | 분해 grant면 **변경 불필요** |
| 환불 회수 | `product-entitlements.ts revokeProductEntitlement` (커밋 1f65f40) | 단건 회수 | 묶음 환불 = 구성품 N건 회수 루프 |

★ = 가장 핵심적인 변경 지점.

---

## 2. 상품별 반영 계획 + 영향 파일

### 2.0 [난이도 ★☆☆☆☆ 최저] 분할 환산 문구 — 티어 C (0순위)

- **무엇**: lifetime 49,000원 옆에 "월 4,900원 멤버십 × 12 = 58,800원 / 평생 49,000원" 비교 문구 노출(앵커링).
- **건드릴 파일**: `src/app/saju/[slug]/premium/page.tsx` (lifetime CTA 카드, 대략 :708-760 영역) — **카피 추가만**.
- **코드 로직**: 0. entitlement·scope·결제 흐름 무관. 단순 정적 텍스트(또는 `membership_plus.price * 12` 산술).
- **리스크**: 거의 없음. 단 표현은 단순 산술 비교만(과장·단정 금지). 사주 서비스라 의료광고법 무관하나, 톤은 `docs/safety-copy-guide.md` 준수.
- **선행조건**: 없음. 즉시 가능.

### 2.1 [구현 완료] 묶음 인프라 + 오늘 풀세트 990원 — 티어 A (1순위)

> 이 단계가 **묶음 인프라의 최초 도입**이다. 이후 2순위는 이걸 재사용한다.

- **구현된 범위**: today-detail(550) + score-factor F1~F5 전체(550×5)를 990원에 묶음. 결제 1건이 구성품 6개 entitlement를 개별 grant한다.
- **구현된 설계 (A안)**:
  1. `catalog.ts`: `kind: 'bundle'` 추가 + `components: { productId, scopeFrom }[]` 필드. 묶음 패키지 1행(`bundle_today_set`, 990원, requiresSlug).
  2. `confirm/route.ts`: `pkg.kind === 'bundle'` 분기 — `components` 순회하며 각 구성품에 `resolvePaymentProductScope` + `grantTasteProductEntitlement`. 멱등(이미 보유분은 grant가 23505로 skip).
  3. `confirmation.ts`: 묶음도 `pkg.price===amount`로 통과(추가 변경 거의 없음). scope 다중화는 confirm 내부에서 파생(payload scope는 대표 slug만).
  4. `prepare/route.ts`: 묶음 중복차단 = "구성품 **전부** 보유 시 alreadyPurchased". 부분 보유는 결제 허용 + 보유분 skip(멱등).
  5. `checkout/page.tsx`: 묶음 안내 카드. (단 `TASTE_PRODUCT_GUIDE`/`TASTE_PRODUCT_ZODIAC`는 `Record<TasteProductId>`라, 묶음은 TasteProductId가 아니면 별도 `BUNDLE_GUIDE` 맵 신설 — 타입 충돌 회피)
  6. `paid-reading-snapshots.ts`: bundle 직접 snapshot은 아직 제한적이다. 구성품 entitlement 기반 접근은 가능하나 "구매 결과 목록" UX는 추가 점검 여지.
  7. **테스트**: 묶음 grant/revoke와 구성품 scope 테스트 존재.
- **남은 리스크**: bundle은 디지털 콘텐츠 묶음이므로 `getRequiredConsentKinds`에서 `digital-content` 동의를 요구하도록 보완 권장.

### 2.2 [난이도 ★★★☆☆ 중] 올해 풀패키지 7,900원 — 티어 B (2순위)

- **무엇**: year-core(3,900) + monthly-calendar(1,900) + 관심사 3종(love/money/work 990×3) 묶음. 개별합 8,770원 → 7,900원(약 10% 할인, 명분 OK).
- **재사용**: 2.1의 묶음 인프라 그대로. `catalog.ts`에 `bundle_year_pack` 1행 + components 5개.
- **추가 난점 (2.1 대비)**:
  - **다중 scope 혼합**: year-core·monthly-calendar는 `requiresSlug`(reading scope), love/money/work는 `global`. confirm의 components 순회가 **scope 종류가 섞인 grant**를 처리해야 함 → `resolvePaymentProductScope`를 구성품마다 호출(이미 가능).
  - **monthly-calendar scope**: `calendar:{readingKey}:{YYYY-MM}` 라 "어느 달"인지 필요. 묶음은 "올해 전체"가 아니라 특정 월? → 스펙에서 "현재 월" 또는 "year-core만 + 대표월" 등 범위 확정 필요.
- **영향 파일**: 2.1과 동일 + catalog 1행. 인프라가 있으면 추가 비용 작음.
- **리스크**: scope 혼합 grant의 정확성. 환불 시 5건 회수.

### 2.3 [난이도 ★★★★★ 고] 사주 코어팩 19,000원 — 티어 B (3순위, 별도 스펙)

- **무엇**: lifetime(49,000)의 **핵심 챕터 일부만** 1년 보관. 9,900↔49,000 갭의 디딤돌.
- **근본 난점**: 현재 lifetime 조회 `getLifetimeReportEntitlement`(`report-entitlements.ts:79`)와 렌더 분기 `premium/page.tsx`의 `hasLifetimeAccess`는 **"전부 열림 / 전부 잠금" 이분법**을 가정한다. "일부 챕터만 열림"은 모델에 없다.
  - 신규 scope 종류(부분 권한) + 챕터 단위 게이팅(score-factor의 per-factor 모델과 유사) + lifetime 조회/렌더 **전면 분기 재설계** 필요.
  - lifetime 환불 회수(커밋 1f65f40)도 "부분 권한" 개념을 추가로 다뤄야.
- **권장**: **이번 롤아웃에서 제외**. score-factor per-factor 모델(#314/#315)을 참고해 별도 스펙 문서로 분리. 갭 메우기는 2.2(올해 풀패키지)로 먼저 시작.

---

## 3. 검증 지표 — 계측(measurement) 영향

| 지표(제안서) | 측정 방법 | 코드 영향 |
|---|---|---|
| 묶음 ARPU / 단건 잠식 | `product_entitlements`·`credit_transactions` 집계 | `scripts/audit-business-activity.mjs` 확장(묶음 vs 단건 매출 비교 쿼리) |
| 9,900~49,000 구간 결제 건수 | `product_entitlements.amount` 구간 집계 | 신규 audit 쿼리 또는 `audit-lifetime-report.mjs` 확장 |
| lifetime 전환율 + 앵커 A/B | 퍼널 이벤트 + 노출군 비교 | **A/B 전용 인프라 없음** (admin override는 #185로 종료) |
| 결제 퍼널 단계 | `payment_funnel_events` (마이그 030) | **변경 0** — `logPaymentFunnelEvent`가 packageId/amount 기록 → 신규 packageId 자동 집계 |

- **A/B 부재 대응**: 제안서의 "A/B 또는 단계 출시" 중 현실적인 건 **환경변수 기반 노출 토글**(`NEXT_PUBLIC_*` 또는 서버 플래그)로 신규 상품을 단계 출시하는 것. 정밀 A/B(군 분리)는 별도 인프라 필요 → 1차는 "출시 전/후 비교"로 갈음.
- **신규로 필요한 계측**: ① 상품 노출 on/off 플래그, ② 묶음 잠식 추적 쿼리(묶음 구매자가 이전에 단건을 샀는지). 둘 다 분석용이라 결제 핵심 경로와 분리 가능.

---

## 4. 이번 커밋(P0)과의 상호작용 ⚠️

1f65f40에서 추가한 두 P0 정비가 묶음 도입 시 **함께 확장**돼야 한다:

- **이중결제 가드** (`prepare/route.ts`): 현재 today-detail 단건만 코인+entitlement 교차 확인. 묶음은 "구성품 전부 보유" 판정을 새로 정의해야 하며, 부분 보유 시 재결제 허용(멱등 grant)로 설계해야 함. → 2.1에서 함께 처리.
- **환불 회수** (`revokeProductEntitlement`): 현재 단건 회수. 묶음 환불은 **구성품 N건을 순회 회수**해야 함(예: `revokeBundleEntitlement` wrapper가 components 순회). 단건 회수 함수는 그대로 재사용 가능 → 추가 비용 작음. 단 "묶음 중 일부만 환불" 정책은 운영 결정 필요.

---

## 5. 권장 실행 순서 & 공수 요약

| 순서 | 산출물 | 영향 파일(추정) | 결제 백엔드 변경 | 리스크 | 선행조건 |
|---|---|---|---|---|---|
| 0 | 분할 환산 문구 | 1 (premium/page.tsx) | 없음 | 최저 | 없음 |
| 1 | 묶음 인프라 + 오늘 풀세트 | 6~7 + 테스트 | **있음 (confirm grant 루프)** | 중 | 묶음 스펙 확정(score-factor 구성 범위) |
| 2 | 올해 풀패키지 | 1~2 (catalog 행) | 인프라 재사용 | 중(scope 혼합) | 1순위 완료 + 월 범위 정책 |
| 3 | 사주 코어팩(부분 lifetime) | 다수 (lifetime 조회/렌더 재설계) | 큼 | 고 | **별도 스펙 문서** |

- **공통 권장**: 결제는 매출 직결이라 회귀 시 환불 부담이 크다. 1순위부터는 `superpowers:test-driven-development`로 grant 멱등성·환불 회수를 먼저 테스트로 고정.
- **AGENTS.md 유의**: 이 저장소는 "네가 아는 Next.js가 아니다 — `node_modules/next/dist/docs/` 확인 후 작성" 규칙. 신규 라우트/서버액션을 만들 경우 해당 가이드 확인 필요(이번 계획은 기존 라우트 핸들러 확장 위주라 신규 라우트 최소).

---

## 6. 리스크 요약 (한눈에)

- 🔴 **결제 백엔드 변경 = 매출/환불 직결**. 묶음 grant 멱등성, 부분보유 재결제, 묶음 환불 회수 = 엣지 다수 → TDD 필수.
- ✅ **score-factor 묶음 구성 확정**: 오늘 풀세트는 F1~F5 전체를 포함하는 것으로 구현 완료.
- 🟡 **monthly-calendar 월 범위**: 올해 풀패키지에서 "어느 달" 문제. 정책 결정 필요.
- 🟡 **A/B 인프라 부재**: 정밀 A/B 불가 → 단계 출시 + 전후 비교로 갈음.
- 🟢 **조회/렌더는 분해 grant(A안)면 변경 0** — client hook·premium 분기 안 건드림.
- 🟢 **퍼널 계측 자동** — 신규 packageId가 funnel_events에 자동 집계.

---

## 7. 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-05-23 | 초안 — 묶음 인프라 부재 진단 + 상품별 영향 분석 + 순서 재배열(0~3순위) |
| 2026-05-27 | 현재 로컬 구현 반영 — `bundle_today_set` 및 묶음 인프라 구현 완료로 상태 갱신. 남은 리스크를 bundle 동의/credit prepare/idempotency로 재정리 |

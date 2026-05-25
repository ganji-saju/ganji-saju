# today-detail 결제 정합성 — entitlement 스코프 안정화 설계

- 날짜: 2026-05-24
- 상태: 승인됨 (구현 계획 작성 대기)
- 관련 화면/제품: 오늘운세 "오늘 자세히 보기"(today-detail, 550원)

## 1. 배경 / 증상

사용자가 오늘운세 결과에서 "오늘 자세히 보기"(550원)를 결제했는데도 "풀이열기"가 상세 페이지로 넘어가지 못하고 무료 결과 페이지(`/today-fortune/result`)로 되돌아가며, 그 페이지는 "무료 결과가 이 브라우저에 남아 있지 않아요"를 표시한다. 한 사용자가 같은 상품을 **6번 결제**하고도 한 번도 열지 못했다.

흐름:
1. 결과 페이지 → "풀이열기" → `openHref = /today-fortune/detail?paid=today-detail&sourceSessionId=<X>`
2. `TodayFortuneDetailClient`가 `GET /api/today-fortune/unlock`으로 접근권 확인
3. `hasAccess:false` → `window.location.replace('/today-fortune/result?...')`
4. 결과 페이지는 서버 재조회를 하지 않으므로(개인정보 정책) "결과 없어요" 표시

## 2. 근본 원인 (코드 + 데이터로 확정)

### 2-1. 세션ID가 매 생성마다 바뀜
`src/app/api/today-fortune/route.ts`의 생성 핸들러가 매 요청마다 `createReading()`을 호출해 **새 `readings` 행 + 새 UUID**를 발급하고, 그 UUID를 `sourceSessionId`로 사용한다(서비스 키 없거나 실패 시엔 `toSlug()` 슬러그로 폴백, 슬러그의 `keyXXXX` 토큰은 이름 포함 해시라 세션마다 가변).

### 2-2. entitlement가 휘발성 세션ID로 묶임
550원 결제는 `product_entitlements`에 `scope_key = today:${sourceSessionId}` (`buildTodayDetailScopeKey`)로 저장된다. 결제 시점의 `sourceSessionId`와 이후 열람 시점의 `sourceSessionId`가 다르므로, 열람 판정(`resolveTodayFortuneUnlockAccess`의 paid 경로 = `getTasteProductEntitlement(user, 'today-detail', today:${현재 sourceSessionId})`)이 항상 불일치 → `hasAccess:false` → 되돌림.

### 2-3. 데이터 증거 (계정 ae93a898, 이메일 qwe@qwe.com)
`product_entitlements`에 today-detail 6건, 전부 다른 scope_key:
- `today:1995-4-1-...-key1qiprog` / `today:1995-4-1-...-key1wnf06j` (슬러그, 05-24, 3분 간격인데 key 다름)
- `today:60c05a25-...` / `today:7afd6aed-...` / `today:d7476410-...` / `today:198b3ae3-...` (UUID, 05-23)
- 현재 화면이 찾는 키 `today:65ef0a06-...` 와 **6건 모두 불일치**.

## 3. 목표 / 비목표

**목표**
- 결제한 today-detail을 같은 날 안정적으로 열 수 있게 한다.
- 향후 같은 날 중복 과금이 발생하지 않게 한다(entitlement 판정 정상화로 결제창 대신 "이미 구매"가 뜨도록).
- 기존 고아 결제(같은 날 분)를 마이그레이션 없이 인정한다.

**비목표**
- 과거 날짜 결제분의 소급 열람(per-day 제품 특성상 제외) — 중복 과금은 환불로 처리.
- 결과 페이지의 서버 재조회(rehydration) 정책 변경 — 별개 UX 이슈.
- "사주풀이(saju-detail) 550원"은 별도 상품 — 같은 패턴인지 별도 점검(이 스펙 범위 밖, §10 비고).

## 4. 제품 결정 (확정)

- 소유 단위: **사람 × 날** (한 번 결제하면 그 사람의 그날 상세를 하루 종일 재열람, 매일 일진이 바뀌는 '오늘' 제품 특성과 일치 → 날마다 재구매).
- 기존 결제 인정: **같은 날(KST) 결제분 자동 인정** (fallback). 과거 날짜/중복분은 환불 대상.
- 수정 범위: **entitlement 계층 + 근본(reading 중복생성) 둘 다** (단, 별도 PR로 분리).

## 5. 설계

핵심: *정밀한 주(canonical) 키 + 너그러운 같은날 fallback* 2단 구조. readingKey가 미세하게 흔들려도 같은날 fallback이 결제자를 막지 않는 안전망이 된다.

### 5-1. Layer 1 — entitlement 스코프 (핵심 수정, 낮은 리스크)

**canonical 키**
- `today:${readingKey}:${kstDay}` 형식. `readingKey = toSlug(reading.input)`, `kstDay = getKoreaAccessDay()` (`YYYY-MM-DD`).
- write(결제 grant)와 read(1차 열람확인)가 같은 공식을 쓴다.
- `src/lib/payments/product-scope.ts`의 `buildTodayDetailScopeKey`를 날짜 포함 형태로 확장(또는 신규 빌더). today-detail의 `resolvePaymentProductScope`가 이 키를 만들도록 수정.

**열람 판정 fallback 순서** (`unlock/route-helpers.ts`의 `resolveTodayFortuneUnlockAccess`와 `payments/entitlement` API 양쪽을 **동일 로직**으로):
1. canonical: `getTasteProductEntitlement(user, 'today-detail', today:${readingKey}:${today})`
2. 레거시 정확 매치: `today:${sourceSessionId}` (기존 동작 보존, 같은 세션 내 즉시 결제→열람 케이스)
3. **같은날 안전망**: 이 사용자가 **오늘(KST)** 결제한 today-detail `product_entitlements`(또는 legacy taste_product credit_transactions)가 1건이라도 있으면 허용. 신규 헬퍼 `hasTodayDetailEntitlementForDay(userId, kstDay)` 제안 — `product_entitlements`에서 `product_id='today-detail'` AND `created_at`이 KST 당일 구간(`[day 00:00+09:00, +24h)`) 인 행 존재 여부. (coin 경로의 `hasTodayFortuneDailyAccess`와 동일 사고)

> fallback 3이 기존 고아 결제(이 사용자 오늘 2건)를 **마이그레이션 없이 즉시** 인정한다. 정밀도(다른 사람 상세까지 열리는 느슨함)는 주 키(1)가 담당하고, 3은 결제자 보호용 안전망.

**중복 과금 차단(부수효과)**: 위 판정이 entitlement API에도 동일 적용되므로, 같은 날 재방문 시 `hasEntitlement:true`가 떠 결제창 대신 "이미 구매 → 바로 열기"가 노출 → 추가 결제 자체가 발생하지 않는다.

### 5-2. Layer 2 — 근본(reading 중복생성) 수정 (별도 PR, 다소 높은 리스크)

- `src/lib/saju/readings.ts`에 `findReadingByInput(userId, input)` 추가: 로그인 사용자의 같은 birth input(`birth_year/month/day/hour/gender`) reading을 최신순 1건 조회.
- `src/app/api/today-fortune/route.ts`: `createReading` 직접 호출 대신 "기존 reading 있으면 재사용, 없으면 생성"으로 변경(로그인 사용자만 dedup, 익명은 기존대로).
- 효과: `sourceSessionId` 안정화 → 재방문/새로고침에서 같은 reading 식별, DB 누적 감소. (단, 결과 페이지 rehydration은 §3 비목표.)
- **분리 배포**: Layer 1을 먼저 긴급 배포, Layer 2는 핵심 생성 로직 변경이라 별도 PR로 신중히.

## 6. 키 형식 / 데이터 모델

- canonical scope_key: `today:${readingKey}:${YYYY-MM-DD(KST)}`
- 레거시(기존 데이터, 변경 없음): `today:${uuid}` / `today:${슬러그}`
- 신규/레거시 혼재를 read fallback이 흡수. 기존 데이터 마이그레이션 없음.
- 경계 케이스: KST 자정 전후 결제↔열람 시 날짜 롤오버로 canonical/같은날 fallback 모두 불일치 가능(매우 좁은 구간). '오늘' 제품 특성상 수용. 문서화.

## 7. 영향 파일 (예상)

Layer 1:
- `src/lib/payments/product-scope.ts` — `buildTodayDetailScopeKey`(+날짜), today-detail scope 생성.
- `src/lib/product-entitlements.ts` — `hasTodayDetailEntitlementForDay` 헬퍼.
- `src/app/api/payments/entitlement/route.ts` (+ `route-helpers.ts`) — today-detail fallback.
- `src/app/api/today-fortune/unlock/route.ts` (+ `route-helpers.ts`) — `resolveTodayFortuneUnlockAccess` fallback.
- (결제 grant) `src/app/api/payments/confirm/route.ts`는 `resolvePaymentProductScope` 결과를 그대로 쓰므로 scope 빌더 변경으로 자동 반영.

Layer 2:
- `src/lib/saju/readings.ts` — `findReadingByInput`.
- `src/app/api/today-fortune/route.ts` — find-or-reuse.

## 8. 테스트 계획 (TDD, 기존 `*/route-helpers.test.ts` 패턴)

Layer 1:
- canonical 키 정확 매치 → 'taste-product' ✅
- 오늘 `today:${uuid}`(레거시)만 존재 + canonical 불일치 → 같은날 fallback으로 허용 ✅
- 어제 결제만 존재 → 오늘 열람 불가 ✅
- 미결제 → null/차단 ✅
- entitlement API와 unlock GET이 같은 입력에 같은 결론을 내는지(정합성) ✅

Layer 2:
- `findReadingByInput`: 동일 birth 기존 reading 재사용, 없으면 신규 생성 분기 ✅

## 9. 과금 감사/환불 (운영 — 코드와 별개)

- read-only 감사 쿼리 제공: `product_entitlements`에서 `product_id='today-detail'`를 user별로 집계해 **2건 이상(중복 결제)** 사용자 목록 + 금액 산출 → 환불 대상.
- 이 사용자(ae93a898)는 6건 중 5건이 중복 → 약 2,750원 환불 후보.
- 실행/환불 결정은 운영. (스펙은 쿼리만 제공)

## 10. 롤아웃 / 비고

- PR 분리: **PR-A(Layer 1)** 먼저 — 긴급 결제 정합성. **PR-B(Layer 2)** 이후 — reading dedup.
- main 머지 시 Vercel 자동 배포(앱). DB 마이그레이션은 이번 변경엔 없음(읽기 fallback만).
- 비고: "사주풀이(saju-detail) 550원"이 today-detail과 다른 productId/스코프인지 별도 점검 필요(같은 휘발성 키 문제 여부).
- 비고: 결과 페이지 "결과 없어요"는 bounce가 사라지면 자연 해소되나, 진짜 새 브라우저 직접진입 시의 rehydration은 별개 과제.

## 11. 구현 조정 (2026-05-24, 실제 빌드 기준)

구현 착수 시 **현재 main(3298abd)에 PR #346(`de6b509`)이 이미 today-detail 결제/조회를 안정적 `readingKey` 기반으로 옮겨두고** `checkTodayDetailAccess`(readingKey + legacy readingId + 코인)를 읽기 단일 출처로 만들어 둔 것을 발견. entitlement API는 이걸 쓰는데 **unlock 라우트만 옛 `today:${sourceSessionId}`로 남아** 불일치(이미 구매 ↔ 못 엶)가 났다.

→ §5의 "per-day canonical 키 재설계"는 #346과 충돌(기존 `today:${readingKey}` 결제분 재고아화)하므로 **채택하지 않고**, 더 작고 안전한 조정안으로 구현:

- **Layer 1**: unlock 라우트(GET·POST)를 `todayDetailEntitlementScopeKeys`(readingKey 우선 + legacy slug) + **같은날(KST) fallback**으로 통일 → entitlement API와 동일 판정. `checkTodayDetailAccess`에도 같은날 fallback 추가(SSR·체크아웃 전파). 신규 `hasTodayDetailEntitlementForDay`. **키는 #346의 `today:${readingKey}` 유지(날짜 미포함, per-day 강제 안 함)** — readingKey 해시 드리프트/과거 readingId 결제분은 같은날 fallback이 흡수.
- **Layer 2**: `findReadingByInput`로 today-fortune 생성 시 동일 reading 재사용(전체 readingKey 일치).
- per-day 재과금 모델은 #346(영구 readingKey)과 충돌 → 별도 제품 결정으로 보류.
- 검증: 타입체크 0, 단위테스트 645 통과. (커밋 d4832c9, 3eba861)

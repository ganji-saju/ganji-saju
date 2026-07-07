# 가격 제어 Phase 2(전 노출 단일화) 구현 계획

> REQUIRED SUB-SKILL: superpowers:executing-plans. 상세 근거는 설계문서 `2026-07-07-admin-price-control-phase2-design.md` + 감사 인벤토리(워크플로 출력, 105지점/86치환).

**Goal:** 사이트 전역 가격 표시(카드·pill·CTA·nav·산문·SEO)를 `price-display` 레지스트리(리졸버 기반)로 단일화. 결정: 완전 단일화(86) + 카탈로그 `compareAt`(=취소선, previous_price와 통합) + 상품-가격 매핑 정합화.

**Tech Stack:** Next 16.2.6 · React 19 · 서버 리졸버(`price-resolver`) + 클라 Context.

## Global Constraints
- 리터럴 제거 = 단일 진실(카탈로그). 콘텐츠 상수는 `price:'9,900원'` → `priceKey` + 소비처 리졸버 렌더.
- 서버 컴포넌트=`resolvePriceLabel`/맵 직접, 클라=`PriceProvider`/`usePriceLabel`.
- 무료 라벨(today/tarot/dream/consult)·"전"(재화)·이미지baked·주석은 스코프 밖(단 stale 주석 정정).
- compareAt(취소선)=DB `previous_price` ?? 카탈로그 `compareAt`. 새 catalog 필드 `compareAt?: number`.
- 커밋은 브랜치 `feat/admin-price-control-phase2`. PR=`./scripts/gh-ganji`.
- 게이트: tsc·커스텀러너·vitest·build. 최종 적대적 리뷰.

## 태스크

### Task 1 — 파운데이션: catalog compareAt + price-display 레지스트리
- `catalog.ts`: `PaymentPackage`에 `compareAt?: number`. 마케팅 앵커 시드: lifetime_report `compareAt: 69000`.
- `price-resolver.ts`: `ResolvedPrice`에 이미 `previousPrice`. compareAt 병합 = `previousPrice ?? catalog.compareAt ?? null` 헬퍼 `resolveCompareAt`.
- `src/lib/payments/price-display.ts`(신규): `PriceKey`(카탈로그 PackageId + 특수키 `saju_entry`·`membership_generic`) → 해석. `getPriceDisplayMap()`(서버, 리졸버 1회 → {key:{label, value, compareLabel}}). `resolvePriceLabel(key)`·`resolvePriceValue(key)`·`resolveCompareLabel(key)`. 포맷: `formatWon` 재사용, 구독은 `월 ` 접두.
- 테스트: 폴백/오버라이드/compareAt/특수키.

### Task 2 — PriceProvider(클라 전파)
- `src/components/payments/price-provider.tsx`(신규, client): Context + `usePriceLabel(key)`·`usePriceValue(key)`·`useCompareLabel(key)`. props=직렬화된 맵.
- 루트 레이아웃(`src/app/layout.tsx`)에서 `getPriceDisplayMap()` 서버 로드 → `<PriceProvider map={...}>` 래핑.
- 테스트: 맵 주입 시 훅 반환.

### Task 3 — moonlight.ts 콘텐츠 상수 + 소비처
- TASTE_PRODUCTS(×6)·PLAN_BLUEPRINT(×2)·CHECKOUT_PLAN_GUIDE(×3): `price` 리터럴 → `priceKey`. 소비처(pricing·membership·premium·checkout 페이지)가 `priceLabel(priceKey)` 렌더(서버=resolve, 클라=hook).

### Task 4 — 나머지 콘텐츠 상수 + 소비처
- `gangi-market.ts`(GANGI_HOME_CARDS 유료 5 + 무료 라벨 유지), `search-index.ts`(MENU_HITS ×4, description 토큰), `paid-funnel-grid.tsx`(ITEMS), `report-document.tsx`(nextProducts), `mega-nav-data.ts`, `support/faq/page.tsx`(FAQ_GROUPS + JSON-LD), `concerns.ts`(upsell copy), `gangi-ui.tsx`(GANGI_TEACHERS). 산문 임베드는 가격 토큰 함수로 재구성.

### Task 5 — 페이지/컴포넌트 인라인
- 서버: `saju/[slug]/page.tsx`(SMALL_PICKS·라벨), `premium/page.tsx`(~12 인라인+compareAt 취소선), `deep/page.tsx`, `pricing/page.tsx`(산문), `compatibility-result-view.tsx`.
- 클라: `premium-lock-card.tsx`(×6), `fortune-calendar-panel.tsx`(×2), `taekil-client.tsx`, `mega-nav.tsx`·`site-header.tsx`(alt).

### Task 6 — 매핑 정합화 + compareAt 취소선 + stale 정정
- "깊은 사주 9,900→/premium" 불일치: 링크/라벨을 실제 상품(lifetime 49,000 또는 today_detail 9,900)로 일치. 궁합 9,900 vs 990: [[project_compat-paid-model]] 실측(글로벌 990 love-question) 반영해 표시가=청구가 일치.
- 69,000 취소선 3지점 → `resolveCompareLabel('lifetime_report')`.
- stale 주석 정정(score-lock-gate·index.ts·today-detail-cta 550, compat-view 990, paid-funnel 헤더).

### Task 7 — 게이트 + 적대적 리뷰
- tsc·커스텀러너·vitest·build. 리뷰 렌즈: 잔존 리터럴 0(무료/전/이미지/주석 제외), 서버/클라 경계 정확, 산문 토큰 문법, compareAt 표기.

## 통지
- 이미지baked(`gangi-market` saju-9900.avif) 가격은 텍스트 치환 불가 — 가격 변경 시 이미지 재생성 별도(스코프 밖).

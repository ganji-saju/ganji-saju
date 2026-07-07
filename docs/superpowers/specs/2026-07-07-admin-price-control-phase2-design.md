# 관리자 가격 제어 — Phase 2(전 노출 단일화) 설계 + 감사 인벤토리

> 작성일: 2026-07-07 · 상위 설계 `2026-07-07-admin-price-control-design.md` · Phase 1(#616) 완료 후속

## 목표

사이트 전역의 가격 **표시**가 admin 값(리졸버)을 따르게 한다. Phase 1은 청구·체크아웃을 리졸버로 통일했고, Phase 2는 **화면에 보이는 가격 문자열**(카드·pill·CTA·nav 배지·산문·SEO)을 단일 소스로.

## 감사 결과(5에이전트 전수)

- **총 105 노출 지점 · 치환대상 86 · 스코프밖 19**(주석·이미지baked·전(코인)·비가격 무료라벨 일부).
- 원천 분류:
  | 유형 | 대표 위치 | 처리 |
  |---|---|---|
  | **콘텐츠 상수** | `moonlight.ts`(TASTE_PRODUCTS×6·PLAN_BLUEPRINT×2·CHECKOUT_PLAN_GUIDE×3), `gangi-market.ts`(GANGI_HOME_CARDS), `search-index.ts`(MENU_HITS×4), page-local(SMALL_PICKS·TASTE_PRODUCT_GUIDE·BUNDLE_GUIDE·GANGI_TEACHERS), `paid-funnel-grid.ts`(ITEMS), `report-document.tsx`(nextProducts), `mega-nav-data.ts`, FAQ_GROUPS, `concerns.ts` | 항목에 `priceKey` 추가 → 소비처가 레지스트리로 렌더 |
  | **서버 컴포넌트 인라인** | `saju/[slug]/premium/page.tsx`(~12), `deep`, `pricing`, `compatibility-result-view` | `priceLabel(key)` (async 리졸버) |
  | **클라이언트 컴포넌트** | `premium-lock-card.tsx`×6, `fortune-calendar-panel.tsx`×2, `taekil-client`, mega-nav/site-header alt | `usePriceLabel(key)` (PriceProvider) |
  | **산문/SEO 임베드** | pricing/premium 산문, FAQ 답변(+JSON-LD), MENU_HITS description, concerns upsell copy | 문장을 가격 토큰 함수로 재구성 |
  | **스코프밖(replaceable=false)** | 취소선 앵커 69,000원(카탈로그 없음)×3, 이미지baked `saju-9900`, "N전"(재화), 각종 stale 주석 | 아래 결정/통지 |

- **감사가 잡은 버그**:
  - `membership/checkout` BUNDLE_GUIDE fallback `9,900원` **STALE**(카탈로그 bundle_today_set=19,800). 리졸버 정상 시 가려지나 fallback 시 오표시.
  - stale 주석 다수: score-lock-gate·index.ts·today-detail-cta(550원), compat-view(990원), paid-funnel 헤더(550/990).
  - **상품-가격 매핑 의심**: `saju/[slug]/page.tsx:426` "깊은 사주 풀이 9,900원"인데 링크 `/premium`(lifetime 49,000) — 불일치. `paid-funnel-grid` 궁합 9,900 vs 프로덕션 990 이력([[project_compat-paid-model]]).

## 아키텍처

### price-display 레지스트리 (`src/lib/payments/price-display.ts`)

- **키 → 해석**: 대부분 카탈로그 `PackageId`. 특수:
  - `무료` 라벨(today/tarot/dream/consult) = 정적 "무료"(리졸버 무관, 상수 유지).
  - 멤버십 대표 라벨 "월정액" = premium 대표 or 정적.
  - 브랜드 진입가(nav alt "간지사주 9,900원", 홈 saju 카드) = 대표 키 `saju_entry`(→ 대표 상품 가격).
- `resolvePriceLabel(key)`(서버 async) → 포맷 문자열("9,900원"/"월 49,000원").
- `getPriceLabelMap()`(서버, 리졸버 1회) → 전 키 라벨맵.
- 산문용 `priceValue(key)`(숫자) + 포맷터로 문장 내 보간.

### PriceProvider (클라이언트 전파)

- 루트 레이아웃(서버)에서 `getPriceLabelMap()` 1회 → 직렬화해 `PriceProvider` context 주입.
- 클라 컴포넌트 `usePriceLabel(key)` / `usePriceValue(key)`.
- 서버 컴포넌트는 `resolvePriceLabel`/맵 직접.

### 콘텐츠 상수 변환 원칙

- 각 상수 항목(TASTE_PRODUCTS 등)에서 하드코딩 `price: '9,900원'` → `priceKey: 'taste_today_detail'`. 소비처가 `priceLabel(item.priceKey)` 렌더. (리터럴 제거 = 단일 진실.)
- 자유 라벨(무료)은 `priceKey: null` + 정적 라벨 유지.

## 열린 결정(사용자 확인 필요)

1. **범위/전달**: 86지점을 (A) 산문·SEO 임베드까지 한 번에 완전 단일화 vs (B) 구조적 표시(카드/pill/CTA/nav) 먼저·산문/SEO는 후속.
2. **취소선 앵커 69,000원**(카탈로그에 없는 마케팅 원가, 3지점): (A) 카탈로그 `compareAt` 필드 신설해 admin 편집 대상에 포함 vs (B) 마케팅 상수로 그대로 둠.
3. **모호한 매핑 정정**: "깊은 사주 풀이 9,900→/premium(49,000)" 불일치, 궁합 9,900 vs 990 — 이번에 정합화할지.

## 통지(결정 아님)

- **이미지 baked 가격**(`gangi-market` `saju-9900.avif` 등)은 그림에 9,900이 박혀 텍스트 치환 불가 → Phase 2 스코프 밖(가격 변경 시 이미지 재생성 별도 필요). alt 텍스트만 치환 가능.
- 스코프밖 stale 주석은 정정(무해, 함께).

## 비목표
- "전"(코인) 재화 표시, 무료 서비스 라벨 로직 변경, 이미지 재생성.

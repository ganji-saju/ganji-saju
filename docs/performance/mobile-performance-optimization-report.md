# Mobile Performance Optimization Report

작성일: 2026-05-12

## Executive Summary

구형 모바일 기기에서 홈과 주요 입력 페이지의 초기 렌더링 부담을 줄이기 위해 전역 레이아웃, 공통 헤더, 홈/입력 페이지 client boundary, third-party script, 이미지/폰트/의존성을 점검했다.

이번 단계에서는 기능 로직, 결제, DB, 사주/성향 계산 로직을 건드리지 않고 아래의 안전한 최적화만 적용했다.

- Noto Sans KR 로드 weight를 `400/500/600/700/800/900`에서 `400/500/600/700/800`으로 축소했다.
- 공통 `SiteHeader`에서 현재 렌더링되지 않는 desktop sidebar 관련 dead component와 사용하지 않는 `LayoutModeControl` import를 제거했다.
- 로그인 사용자의 notification heartbeat를 hydration 직후 즉시 실행하지 않고 `requestIdleCallback` 또는 timeout fallback으로 지연했다.
- 홈과 성향사주/성향궁합 입력 페이지가 이미 Server Component 또는 active step 중심 구조로 정리되어 있음을 확인했다.

## Initial Checks

### package.json Dependency

- Framework: Next.js `16.2.3`, React `19.2.4`, TypeScript `5`.
- App Router 기반이며 `src/app` 아래에 route가 구성되어 있다.
- Analytics: `@vercel/analytics`, `@vercel/speed-insights`.
- Payment: Toss SDK는 결제/충전 route와 checkout component에서만 사용된다.
- Icon: `lucide-react`를 사용하며 대부분 named import 형태다.
- Animation: `framer-motion`, `lottie`, `recharts`, `chart.js`, `d3`, `gsap`, `swiper` dependency는 없다.
- CSS animation helper로 `tw-animate-css`가 `src/app/globals.css`에서 import된다.

### Next.js App Router

- 루트 layout: `src/app/layout.tsx`.
- 홈 route는 `/`이고, `src/features/home/gangi-home-client.tsx`가 화면을 구성한다.
- 주요 입력 route:
  - `/saju/personality`
  - `/compatibility/personality`

### Client Component Inventory

`src/app`, `src/components`, `src/features` 기준 `"use client"` 파일은 56개다. 이번 작업에서 주요 병목 후보로 본 파일은 아래와 같다.

- `src/features/shared-navigation/site-header.tsx`
- `src/features/home/home-analytics-boundary.tsx`
- `src/features/saju-personality/saju-personality-input-client.tsx`
- `src/features/compatibility/personality-compatibility-input-client.tsx`
- `src/components/saju/shared/unified-birth-info-fields.tsx`
- `src/components/dialogue/dialogue-chat-panel.tsx`
- `src/app/credits/page.tsx`
- `src/components/membership/toss-membership-checkout.tsx`

## Applied Optimizations

### 1. Font Weight Reduction

수정 파일: `src/app/layout.tsx`

Noto Sans KR에서 거의 쓰이지 않는 `900` weight 요청을 제거했다. `font-black` 또는 900에 가까운 스타일은 브라우저 합성/근접 weight로 표시될 수 있지만, 모바일 초기 폰트 요청과 캐시 부담을 줄이는 효과가 있다.

```ts
weight: ["400", "500", "600", "700", "800"]
```

### 2. SiteHeader Client Bundle Reduction

수정 파일: `src/features/shared-navigation/site-header.tsx`

현재 `SiteHeader`는 `MobileChrome`만 반환하고 있었고, 내부에 더 이상 렌더링되지 않는 `DesktopSidebar`, `DesktopNavLink`, `DesktopNavChip` 구현이 남아 있었다. 해당 dead component와 `LayoutModeControl` import를 제거해 client module parse/compile 대상과 icon/import 참조를 줄였다.

유지한 동작:

- 기존 route href 유지.
- 모바일 하단 nav 유지.
- 상단 nav 유지.
- 로그인/로그아웃 동작 유지.
- 코인 표시/캐시 동작 유지.
- 읽기 크기 control 유지.

### 3. Notification Heartbeat Idle Scheduling

수정 파일: `src/features/shared-navigation/site-header.tsx`

로그인 사용자가 헤더를 hydration할 때 notification heartbeat fetch가 바로 실행되던 흐름을 idle 시점으로 미뤘다.

- 지원 브라우저: `requestIdleCallback(..., { timeout: 2500 })`.
- 미지원 브라우저: `setTimeout(..., 1200)` fallback.
- unmount 이후 실행을 막기 위해 `isActive` 확인을 유지했다.

## Existing Optimizations Confirmed

### Home

홈 화면은 `src/features/home/gangi-home-client.tsx`가 이름과 달리 Server Component 형태로 구성되어 있고, analytics는 `HomeAnalyticsBoundary` client island로 분리되어 있다. 홈 above-the-fold에는 큰 이미지나 hero video가 직접 사용되지 않는다.

### Saju Personality Input

`src/features/saju-personality/saju-personality-input-client.tsx`는 `StepFlowShell`, `ChoiceRow`, `AxisChipGrid`, `StickyActionBar`를 사용하며 active step 중심으로 입력 UI를 구성하고 있다.

### Personality Compatibility Input

`src/features/compatibility/personality-compatibility-input-client.tsx`도 active step 중심 구조를 사용한다. 긴 폼 전체를 한 번에 노출하는 구조는 줄어든 상태다.

## Script / Third-Party Review

- `@vercel/analytics/next`와 `@vercel/speed-insights/next`는 `src/app/layout.tsx`에 전역으로 위치한다.
- Vercel Analytics와 Speed Insights는 내부적으로 defer script를 주입하므로 immediate blocking script는 아니다.
- Toss SDK는 `/credits`, membership checkout 등 결제 route에서만 load되는 구조다.
- global GTM, PostHog, Amplitude, custom gtag script는 확인되지 않았다.
- production env는 수정하지 않았다.

## Image / Above-The-Fold Review

홈 above-the-fold에는 `next/image` 기반 무거운 hero image가 현재 직접 렌더링되지 않는다.

확인된 이미지 사용처:

- `src/components/tarot/tarot-card-artwork.tsx`
- `src/app/tarot/daily/pick/tarot-card-picker.tsx`
- `src/components/counselor/counselor-selector.tsx`
- `src/components/home/moonlight-hero-video.tsx`

`moonlight-hero-video`는 현재 홈 주요 route에서 직접 사용되지 않는 것으로 확인했다.

## Bundle Analyzer

현재 `package.json`과 `next.config.ts`에는 `@next/bundle-analyzer` 설정이 없다. `ANALYZE=true npm run build`는 빌드 자체는 수행하지만 별도 분석 리포트를 생성하지 않는다.

확인 결과:

- 첫 실행은 sandbox 네트워크 제한으로 Google Fonts fetch가 실패했다.
- 네트워크 허용 후 `ANALYZE=true npm run build`는 통과했다.
- `.next` 하위에 bundle analyzer 전용 산출물은 생성되지 않았다.
- `.next/static` 크기 확인값: 약 `10M`, 파일 `193`개.

추가 제안:

- 다음 단계에서 lightweight analyzer 도입이 필요하면 `@next/bundle-analyzer`를 devDependency로 추가하는 별도 작업으로 분리한다.
- 이번 작업에서는 새 dependency 추가 금지 조건에 따라 analyzer dependency를 추가하지 않았다.

## RUM / Web Vitals Plan

구형 모바일 성능은 로컬 빌드만으로는 판단이 어렵기 때문에 production 또는 preview에서 실제 사용자 환경 기반 RUM이 필요하다.

권장 방향:

- `useReportWebVitals` 또는 Next/Vercel Web Vitals 기반으로 `LCP`, `INP`, `CLS`, `TTFB`, `FCP`를 route별로 수집한다.
- payload에는 route group, device class, connection type 정도만 포함한다.
- 이름, 생년월일, 성별, 성향 체크 답변, 질문 원문, 결제 상세 정보는 전송하지 않는다.
- `/`, `/saju/personality`, `/compatibility/personality`, `/today-fortune`, `/dialogue`를 우선 측정 route로 둔다.

## Remaining Risks

- `SiteHeader` 자체는 여전히 auth/session/credit state를 포함한 전역 client boundary다. 더 크게 줄이려면 server header + 작은 auth island로 분리하는 별도 리팩터가 필요하다.
- `UnifiedBirthInfoFields`는 위치 검색과 복수 입력 field를 포함해 주요 입력 페이지의 hydration 비용이 남아 있다.
- `dialogue-chat-panel`, AI 리포트 패널, tarot picker는 route별로 더 무거운 client component일 가능성이 있다.
- 전역 `tw-animate-css` import와 일부 큰 shadow/backdrop blur 스타일은 구형 기기에서 paint 비용을 만들 수 있다.
- `next/font/google`은 빌드 시 Google Fonts fetch가 필요하다. CI/로컬 네트워크 제한이 있으면 빌드 실패 가능성이 있다.

## Validation Result

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run typecheck` | 통과 |
| `npm run build` | 통과 |
| `git diff --check` | 통과 |
| `ANALYZE=true npm run build` | 네트워크 허용 후 통과, analyzer 리포트는 미생성 |

## Next Step

1. Preview/production에서 실제 모바일 기기 기준 `/`, `/saju/personality`, `/compatibility/personality`를 Lighthouse 또는 WebPageTest로 측정한다.
2. `SiteHeader`를 server shell + auth/credit client island로 더 분리할지 결정한다.
3. `UnifiedBirthInfoFields`의 위치 검색 UI를 interaction 이후 lazy render할 수 있는지 검토한다.
4. RUM 수집을 별도 작업으로 구현해 route별 Mobile LCP/INP/CLS를 추적한다.

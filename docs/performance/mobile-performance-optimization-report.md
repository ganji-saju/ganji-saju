# 모바일 성능 최적화 보고서

작성일: 2026-05-12

## 1. 성능 병목 후보

구형 모바일 기기에서 체감 성능을 떨어뜨릴 수 있는 후보를 홈, 입력 페이지, 대화방 중심으로 점검했다.

- 홈은 `src/app/page.tsx`에서 App Router 기반으로 렌더링되며, 화면 구성은 `src/features/home/gangi-home-client.tsx`가 담당한다.
- `GangiHomeClient`는 이름과 달리 Server Component 형태로 동작하지만, 기존 analytics wrapper가 children 전체를 감싸면 홈 DOM 전체가 client boundary처럼 다뤄질 여지가 있었다.
- 성향사주와 성향궁합 입력 페이지는 active step 중심으로 이미 정리되어 있어 전체 긴 폼을 한 번에 렌더링하지 않는다.
- 성향사주/성향궁합의 16유형 선택지는 렌더마다 같은 배열을 다시 만들고 있었다.
- 성향궁합 입력 페이지는 첫 관계유형 선택 단계에서도 저장 프로필 API를 즉시 호출하고 있었다.
- 12간지 대화방은 glyph/emoji/text 중심이라 12개 대형 이미지를 첫 화면에서 동시에 로드하지 않는다.
- `framer-motion`, `lottie`, `chart.js`, `recharts`, `swiper`, `gsap` 같은 무거운 animation/chart/carousel dependency는 확인되지 않았다.
- `lucide-react`는 named import 중심으로 사용되며, 전체 icon library import 패턴은 확인되지 않았다.
- `@vercel/analytics`와 `@vercel/speed-insights`는 `src/app/layout.tsx`에 전역 배치되어 있다.

## 2. 수정한 파일

- `src/app/layout.tsx`
- `src/features/home/home-analytics-boundary.tsx`
- `src/features/home/gangi-home-client.tsx`
- `src/features/saju-personality/saju-personality-input-client.tsx`
- `src/features/compatibility/personality-compatibility-input-client.tsx`
- `docs/performance/mobile-performance-optimization-report.md`

## 3. 줄인 Client Component / Hydration 부담

### Home Analytics Boundary

`HomeAnalyticsBoundary`를 children wrapper 방식에서 `null`을 반환하는 작은 observer island로 변경했다.

변경 전에는 홈 콘텐츠 전체가 analytics boundary 아래에 들어갔고, 클릭 추적을 위해 wrapper element가 추가됐다. 변경 후에는 `document` click listener만 등록하고, `[data-analytics-event]`가 있는 element를 찾아 기존 analytics payload를 전송한다.

유지한 동작:

- `home_viewed` 이벤트 전송
- `data-analytics-event`, `data-analytics-section`, `data-analytics-target`, `data-feature-id`, `data-service-id` 기반 클릭 추적
- PII 없는 payload 구조

개선 효과:

- 홈 전체 DOM을 client wrapper로 감싸지 않는다.
- wrapper div 추가를 제거한다.
- analytics 추적은 작은 client island 하나로 제한한다.

### Home Route

`src/features/home/gangi-home-client.tsx`에서 `HomeAnalyticsBoundary`를 페이지 children 밖에 독립적으로 렌더링하도록 조정했다. 홈 route 자체는 기존 route를 유지하고, 기능 링크와 결제/DB/계산 로직은 변경하지 않았다.

## 4. 이미지 최적화 내용

- 홈 hero와 12간지 CTA는 이미지 asset을 추가하지 않고 CSS/text/glyph 중심으로 유지했다.
- 대화방의 12간지 캐릭터는 현재 glyph/emoji fallback 중심으로 렌더링되며, 12개 대형 이미지를 첫 화면에서 동시에 로드하지 않는다.
- 이번 작업에서는 새 이미지 asset, GIF, Lottie를 추가하지 않았다.
- 향후 캐릭터 이미지가 들어가더라도 compact list는 glyph/text 우선, 상세 영역에서만 lazy load하는 정책을 유지해야 한다.

## 5. Script 최적화 내용

- 새 third-party script를 추가하지 않았다.
- Vercel Analytics와 Speed Insights는 기존 전역 배치를 유지했다.
- Toss 결제 SDK, Supabase, OpenAI, 결제/권한 로직은 수정하지 않았다.
- 성향궁합 저장 프로필 fetch를 첫 진입 즉시 실행하지 않고, 사용자가 첫 관계유형 단계에서 다음 단계로 넘어간 뒤 한 번만 시작하도록 지연했다.

## 6. Icon / Import 최적화 내용

- icon library 전체 import 패턴은 발견되지 않았다.
- `lucide-react`는 named import 형태를 유지했다.
- 성향사주/성향궁합 16유형 chip item 배열을 component render 내부에서 매번 생성하지 않고 module scope 상수로 hoist했다.

## 7. Font 최적화 내용

`src/app/layout.tsx`에서 `Noto Sans KR` 로드 weight를 `400`, `500`, `700` 중심으로 축소했다.

기대 효과:

- 폰트 요청 후보 감소
- 모바일 초기 렌더링과 캐시 부담 감소

주의:

- 기존 UI에 `font-semibold`, `font-extrabold`가 남아 있는 경우 브라우저가 근접 weight 또는 합성 weight로 표시할 수 있다.
- 시각 QA에서 강조 weight가 부족해 보이면 일부 컴포넌트만 별도 조정이 필요하다.

## 8. Active Step / DOM Size 점검

### 성향사주 입력

- route: `/saju/personality`
- active step 중심으로 렌더링된다.
- 16유형 선택지는 `PERSONALITY_TYPE_ITEMS` module 상수로 이동했다.
- 성향 체크 질문은 check mode에서만 표시된다.

### 성향궁합 입력

- route: `/compatibility/personality`
- active step 중심으로 렌더링된다.
- 내 정보와 상대 정보가 한 화면에 모두 길게 펼쳐지는 구조는 아니다.
- 16유형 선택지는 `PERSONALITY_TYPE_ITEMS` module 상수로 이동했다.
- 저장 프로필 API 호출은 관계유형 단계 이후 한 번만 실행되도록 지연했다.

## 9. Bundle 분석 가능 여부

- `package.json`과 `next.config.ts` 기준 `@next/bundle-analyzer` 설정은 확인되지 않았다.
- 새 dependency 추가 금지 조건에 따라 analyzer dependency는 추가하지 않았다.
- `ANALYZE=true npm run build`는 실행 가능하지만, 현재 설정에서는 별도 bundle analyzer 리포트를 생성하지 않는다.

## 10. 남은 리스크

- `SiteHeader`는 여전히 전역 client component이며 auth, credit, notification 상태를 포함한다. 더 큰 축소는 server shell + auth/credit island 분리 작업이 필요하다.
- `UnifiedBirthInfoFields`는 여러 입력 필드와 위치 관련 UI를 포함하므로 입력 페이지 hydration 비용이 남아 있다.
- 대화방의 chat panel은 입력/스크롤/대화 저장 등 상호작용이 많아 route 단위 client JS가 클 수 있다.
- `tw-animate-css` 전역 import와 일부 shadow/transition 스타일은 구형 기기에서 paint 비용을 만들 수 있다.
- 실제 LCP/INP/CLS는 로컬 build만으로 확정할 수 없고, preview 또는 production의 실제 모바일 기기 측정이 필요하다.

## 11. 추가 권장 작업

1. Vercel Preview에서 `/`, `/saju/personality`, `/compatibility/personality`, `/dialogue`를 실제 iOS Safari와 Android Chrome으로 측정한다.
2. `SiteHeader`를 Server Component shell과 작은 auth/credit client island로 분리할지 별도 작업으로 검토한다.
3. `UnifiedBirthInfoFields`의 위치 검색 UI를 interaction 이후 lazy render할 수 있는지 검토한다.
4. `useReportWebVitals` 또는 Vercel Web Analytics 기반으로 route group별 LCP/INP/CLS를 수집한다.
5. bundle 분석이 필요하면 `@next/bundle-analyzer` devDependency 추가를 별도 승인 후 진행한다.

## 12. 검수 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` | 통과 |
| `npm run typecheck` | 통과 |
| `npm run build` | 통과 |
| `git diff --check` | 통과 |
| `ANALYZE=true npm run build` | 최종 통과. 단, 첫 병렬 실행은 Next build lock으로 실패했고, sandbox 실행은 Google Fonts 네트워크 제한으로 실패해 네트워크 허용 후 재실행했다. 별도 analyzer 리포트는 현재 설정상 생성되지 않는다. |

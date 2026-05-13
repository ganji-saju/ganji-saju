# Performance Risk Map

기준 브랜치: `main`

조사 명령:

```bash
cat package.json
rg -n "^['\"]use client['\"]" src/app src/components src/features | sort
rg -n "from ['\"]lucide-react|framer-motion|lottie|chart|recharts|swiper|carousel|@base-ui|TossPayments|PaymentWidget|Analytics|SpeedInsights|next/image|<img|\\.png|\\.jpg|\\.jpeg|\\.webp|\\.gif|\\.mp4|video" src/app src/components src/features src/lib src/content | sort
find public -type f | sort
```

## Summary

- `use client` 파일은 56개로, 입력/결과/대화/결제/알림 등 상호작용 영역에 집중되어 있음.
- `lucide-react`는 다수 파일에서 사용되며 개별 import 형태라 전체 import 위험은 낮지만 아이콘 사용량 자체는 많음.
- `framer-motion`, `lottie`, `recharts`, `swiper` dependency는 없음.
- `tw-animate-css`가 global import되어 있음.
- Vercel Analytics/Speed Insights는 root layout에서 전체 route에 로드됨.
- 홈 hero video asset은 존재하지만 현재 홈 사용 여부와 route-level loading 기준 확인 필요.
- 타로 카드 이미지 78장과 tarot carousel이 모바일 성능 리스크.

## Dependency Risk

| dependency | 사용처 | 리스크 |
|---|---|---|
| `next@16.2.3`, React 19 | 전체 | AGENTS 지침상 Next docs 확인 후 수정 필요 |
| `lucide-react` | nav/home/result/today/dialogue 등 | 아이콘 개별 import지만 UI 전반에 많음 |
| `@base-ui/react` | Button/Input/Badge/Separator | primitive 자체는 괜찮으나 input height/touch target 기준 확인 |
| `@tosspayments/*` | credits, membership checkout | 결제 route에서만 유지해야 함 |
| `@vercel/analytics`, `@vercel/speed-insights` | root layout | 전 route script 로드, 운영 측정용 |
| `tw-animate-css` | globals import | 사용량 대비 global CSS 비용 확인 필요 |
| `openai`, `workflow`, `web-push`, `lunar-typescript` | server/feature | UI bundle 포함 여부 확인 필요 |

## Asset Risk

| asset | 위치 | 리스크 |
|---|---|---|
| hero video mp4 | `public/videos/moonlight-teacher-hero.mp4` 약 2.9MB | 구형 모바일에서 preload/paint 위험 |
| hero video webm | `public/videos/moonlight-teacher-hero.webm` 약 2.7MB | 사용 route 제한 필요 |
| hero poster | `public/images/moonlight-teacher-hero-poster.jpg` 약 172KB | above-the-fold 사용 시 LCP 영향 |
| tarot card png | `public/images/tarot/cards/*.png` 78장 | picker/result에서 lazy loading 필요 |
| intro png | `public/intro/*.png` 3장 | counselor selector 이미지 |

## Client Component Hotspots

| 파일 | 리스크 |
|---|---|
| `src/features/shared-navigation/site-header.tsx` | 모든 page에 붙는 큰 client component, Supabase session/credit/notification fetch 포함 |
| `src/features/saju-intake/saju-intake-page.tsx` | 기본 사주 입력 전체 client, 많은 local state |
| `src/features/saju-personality/saju-personality-input-client.tsx` | 성향사주 입력 전체 client |
| `src/features/compatibility/personality-compatibility-input-client.tsx` | 성향궁합 입력 전체 client |
| `src/components/dialogue/dialogue-chat-panel.tsx` | 채팅 state, textarea, scroll, 12간지 selector |
| `src/components/ai/yearly-report-panel.tsx` | 긴 report, hash sync, fetch, 많은 subcomponent |
| `src/components/ai/lifetime-report-panel.tsx` | 긴 report, fetch |
| `src/components/ai/fortune-calendar-panel.tsx` | calendar grid, fetch |
| `src/features/notifications/notification-center-page.tsx` | push subscription, permissions |
| `src/app/login/page.tsx` | 긴 auth/signup form |

## Paint / Layout Risk

- `backdrop-filter: blur(18px)` in header.
- multiple global fixed pseudo backgrounds in `base.css`.
- many large custom shadows in result cards and buttons.
- `hover:-translate-y` and `transition-all` in Button variants.
- `overflow-x-auto` carousels in home/tarot/report sections.
- sticky/fixed elements in header, bottom nav, sticky CTA, print actions.

## Recommended Optimization Order

1. Split `SiteHeader` into server shell + small client islands for auth/credits/menu.
2. Remove or gate global video/large visual components from home above-the-fold.
3. Convert input pages to active-step rendering with lazy heavy sections.
4. Reduce shadows/blur/transition-all in core Button/Card/Header CSS.
5. Keep Toss SDK imports isolated to payment routes/components.
6. Confirm `tw-animate-css` actual usage before keeping global import.
7. Add bundle analysis only if package/config decision is approved later.
8. Add automated screenshot/performance QA after visual standardization.


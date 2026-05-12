# Style Debt Map

기준 브랜치: `main`

조사 명령:

```bash
rg -n "text-\[|p[xy]?\-\[|m[xy]?\-\[|gap-\[|bg-\[#|text-\[#|border-\[#|rounded-\[|shadow|backdrop-blur|blur-\[|animate-|transition-|duration-" src/app src/components src/features | sort
rg -n "className=|className=\{|className=\`" src/app src/components src/features | sort
```

## Summary

- `className` 사용처가 3,000개 이상으로 넓게 퍼져 있음.
- arbitrary value/style debt 검색 결과가 1,500줄 이상 나옴.
- `app-*`, `gyeol-*`, shadcn/base token, Tailwind arbitrary value, page-specific CSS가 동시에 사용됨.
- 디자인 시스템 붕괴의 원인은 신규 컴포넌트 부족보다 "표준 컴포넌트를 우회하는 직접 className"의 양이 큼.

## Token Families In Use

| 계열 | 위치 | 문제 |
|---|---|---|
| shadcn/base token | `src/components/ui/*`, `src/app/styles/tokens.css` | `bg-card`, `text-card-foreground`, `--radius` 등 기본 token이 남아 있음 |
| app token | `--app-*` | 대부분 기존 Gangi/결제/사주 페이지에서 사용 |
| gyeol token | `--gyeol-*` | 신규 Moonlight Flow 계열에서 사용 |
| direct color | `bg-[#...]`, `rgba(...)`, `rose-*`, `emerald-*` | 페이지별 상태/강조가 산발적 |
| component CSS class | `gangi-*`, `app-*`, `gyeol-*`, `moon-*` | 이름 체계가 공존 |

## High Debt Patterns

| 패턴 | 대표 파일 | 영향 |
|---|---|---|
| 직접 `rounded-[...]` | `src/app/saju/[slug]/page.tsx`, `src/features/saju-personality/*`, `src/components/dialogue/dialogue-chat-panel.tsx` | radius scale이 화면마다 다름 |
| 직접 shadow | `src/components/ui/button.tsx`, `src/app/saju/[slug]/page.tsx`, `src/components/today-fortune/*` | 구형 모바일 paint 비용 증가 |
| `backdrop-blur` | `src/features/shared-navigation/site-header.tsx`, `src/features/home/mobile-home-dock.tsx`, `src/components/report/report-print-actions.tsx` | low-end device에서 scroll jank 가능 |
| fixed/sticky 직접 조합 | `site-header`, `StickyActionBar`, print actions, chat panel | 모바일 safe-area 충돌 가능 |
| page-local CTA class | `gangi-primary-button`, `buttonVariants`, direct Link class 혼합 | CTA 위계가 일관되지 않음 |
| section/card 중복 | `ProductGrid`, `FeatureCard`, `LightSection`, `SectionSurface`, `app-panel`, `gangi-card-panel` | 카드 과다와 화면 밀도 문제 |

## CSS Files

| 파일 | 크기/성격 | 리스크 |
|---|---|---|
| `src/app/globals.css` | import aggregator | import 순서가 cascade 우선순위를 좌우 |
| `src/app/styles/tokens.css` | token source | shadcn/app/gyeol token이 모두 존재 |
| `src/app/styles/base.css` | body, animation, global background | fixed pseudo background와 animation keyframe 포함 |
| `src/app/styles/app-shell.css` | shell/header/bottom nav override | `!important`, backdrop blur, mobile dock 기준점 |
| `src/app/styles/components.css` | 약 91KB, 최대 CSS 파일 | 가장 큰 style debt; 많은 컴포넌트 class 집중 |
| `src/app/styles/subpages.css` | 약 37KB | 사주/오늘/타로/서브페이지 old style |
| `src/app/styles/home.css` | 약 23KB | 홈 전용 old/new style 혼합 |
| `src/app/styles/flow-polish.css` | 약 17KB | 신규 flow 보정 layer |
| `src/app/styles/mobile-polish.css` | 약 7KB | screenshot-driven `!important` 보정 |
| `src/app/styles/dialogue-reports.css` | 대화/리포트 | chat/report height 관리 |
| `src/app/styles/responsive-print.css` | print/responsive | print와 screen 규칙 충돌 가능 |

## UI Primitives To Standardize First

1. Button/CTA: `buttonVariants`, `gangi-primary-button`, `gangi-secondary-button`, direct rounded link를 하나의 semantic variant로 묶기.
2. Panel/Section: `LightSection`, `SectionSurface`, `app-panel`, `gangi-card-panel`, `ProductGrid`를 역할별로 축소.
3. Form field: `Input`, native select, `UnifiedBirthInfoFields`, login form input style을 44px 이상 touch target으로 통일.
4. Badge/Chip: `Badge`, 직접 `rounded-full`, `AxisChipGrid`, expert chip을 같은 chip scale로 정리.
5. Result: `ResultShell`, `AxisMeter`, `SafetyNotice`를 결과 페이지의 기본 단위로 고정.

## Priority Files

- `src/app/styles/components.css`
- `src/app/styles/app-shell.css`
- `src/app/styles/subpages.css`
- `src/app/styles/mobile-polish.css`
- `src/features/shared-navigation/site-header.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/features/saju-intake/saju-intake-page.tsx`
- `src/features/saju-personality/saju-personality-input-client.tsx`
- `src/features/compatibility/personality-compatibility-input-client.tsx`
- `src/components/dialogue/dialogue-chat-panel.tsx`

